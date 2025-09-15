import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
import rasterio.features
from rasterio.features import rasterize
from rasterio.mask import mask as rio_mask
from rasterio.transform import from_bounds
import matplotlib.pyplot as plt
from datetime import datetime
import requests
import json
import time
import shutil
from pathlib import Path
from numba import njit, prange
from google.colab import userdata, drive
from IPython.display import clear_output
import traceback

# === LBM SIMULATION ENGINE ===
@njit(parallel=True, fastmath=True)
def run_lbm_simulation(obstacle_mask, wind_speed, wind_deg, nx, ny, max_iter, relaxation_rate):
    """
    High-performance LBM wind simulation - ORIGINAL ALGORITHM
    Lattice Boltzmann Method implementation with D2Q9 model
    """
    
    # D2Q9 lattice constants
    c = np.array([[0,0], [1,0], [0,1], [-1,0], [0,-1], [1,1], [-1,1], [-1,-1], [1,-1]], dtype=np.int64)
    w = np.array([4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0])
    
    # Pre-compute lattice directions for performance
    cx, cy = np.empty(9, dtype=np.int64), np.empty(9, dtype=np.int64)
    c_x, c_y = np.empty(9, dtype=np.float64), np.empty(9, dtype=np.float64)
    
    for k in range(9):
        cx[k], cy[k] = c[k, 0], c[k, 1]
        c_x[k], c_y[k] = float(c[k, 0]), float(c[k, 1])
    
    # Initialize distribution functions
    F = np.ones((ny, nx, 9), dtype=np.float64)
    F_streamed = np.empty_like(F)
    
    # Wind direction conversion (meteorological to mathematical coordinates)
    # ORIGINAL FORMULA - Fixed from 270.0 to 90.0
    math_rad = np.deg2rad(90.0 - wind_deg)
    inlet_velocity_magnitude = 0.1
    vel_x_sim = np.cos(math_rad) * inlet_velocity_magnitude
    vel_y_sim = np.sin(math_rad) * inlet_velocity_magnitude
    
    # Macroscopic variables
    rho = np.empty((ny, nx), dtype=np.float64)
    ux = np.zeros((ny, nx), dtype=np.float64)
    uy = np.zeros((ny, nx), dtype=np.float64)
    
    # === MAIN SIMULATION LOOP ===
    for it in range(max_iter):
        # 1) Streaming step - particles move along lattice directions
        for j in prange(ny):
            for i in range(nx):
                for k in range(9):
                    sj, si = j - cy[k], i - cx[k]
                    # Periodic boundary conditions
                    if sj < 0: sj += ny
                    elif sj >= ny: sj -= ny
                    if si < 0: si += nx
                    elif si >= nx: si -= nx
                    F_streamed[j, i, k] = F[sj, si, k]
        
        # Swap arrays for memory efficiency
        tmp = F; F = F_streamed; F_streamed = tmp
        
        # 2) Bounce-back boundary conditions on obstacles
        for j in prange(ny):
            for i in range(nx):
                if obstacle_mask[j, i]:
                    # Reverse particle directions at solid boundaries
                    f1, f2, f3, f4 = F[j, i, 1], F[j, i, 2], F[j, i, 3], F[j, i, 4]
                    f5, f6, f7, f8 = F[j, i, 5], F[j, i, 6], F[j, i, 7], F[j, i, 8]
                    
                    F[j, i, 1], F[j, i, 3] = f3, f1  # horizontal flip
                    F[j, i, 2], F[j, i, 4] = f4, f2  # vertical flip
                    F[j, i, 5], F[j, i, 7] = f7, f5  # diagonal flip
                    F[j, i, 6], F[j, i, 8] = f8, f6  # diagonal flip
        
        # 3) Outflow boundary conditions (open boundaries)
        for i in range(nx):
            for k in range(9):
                F[0, i, k], F[ny-1, i, k] = F[1, i, k], F[ny-2, i, k]
        for j in range(ny):
            for k in range(9):
                F[j, 0, k], F[j, nx-1, k] = F[j, 1, k], F[j, nx-2, k]
        
        # 4) Compute macroscopic variables (density and velocity)
        for j in prange(ny):
            for i in range(nx):
                s_rho, s_ux, s_uy = 0.0, 0.0, 0.0
                for k in range(9):
                    fval = F[j, i, k]
                    s_rho += fval
                    s_ux += fval * c_x[k]
                    s_uy += fval * c_y[k]
                
                rho[j, i] = s_rho
                if s_rho > 1e-12:
                    ux[j, i], uy[j, i] = s_ux / s_rho, s_uy / s_rho
                else:
                    ux[j, i], uy[j, i] = 0.0, 0.0
        
        # 5) Inflow boundary conditions (ORIGINAL DIRECTION LOGIC)
        if wind_deg >= 315 or wind_deg < 45:      # North wind -> inlet at top
            for i in range(nx): ux[0, i], uy[0, i] = vel_x_sim, vel_y_sim
        elif wind_deg >= 45 and wind_deg < 135:   # East wind -> inlet at right
            for j in range(ny): ux[j, nx-1], uy[j, nx-1] = vel_x_sim, vel_y_sim
        elif wind_deg >= 135 and wind_deg < 225:  # South wind -> inlet at bottom
            for i in range(nx): ux[ny-1, i], uy[ny-1, i] = vel_x_sim, vel_y_sim
        else:                                      # West wind -> inlet at left
            for j in range(ny): ux[j, 0], uy[j, 0] = vel_x_sim, vel_y_sim
        
        # 6) Collision step (BGK approximation)
        for j in prange(ny):
            for i in range(nx):
                usq = ux[j, i]**2 + uy[j, i]**2
                for k in range(9):
                    cu = ux[j, i] * c_x[k] + uy[j, i] * c_y[k]
                    # Equilibrium distribution function
                    eq = rho[j, i] * w[k] * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq)
                    # Relaxation towards equilibrium
                    F[j, i, k] += relaxation_rate * (eq - F[j, i, k])
    
    # Scale velocities to real physical values
    velocity_scale = wind_speed / inlet_velocity_magnitude
    ux_real = ux * velocity_scale
    uy_real = uy * velocity_scale
    
    return ux_real, uy_real

class SimulationEngine:
    """Enhanced simulation engine with original logic"""
    
    def __init__(self, config):
        self.config = config
    
    def create_obstacle_mask_original(self, raster_data):
        """Create obstacle mask using ORIGINAL enhanced logic with proper error handling"""
        print("🏗️  Creating simulation geometry...")
        
        try:
            # Extract aligned raster data
            nmt_data = raster_data['nmt_data']
            nmpt_data = raster_data['nmpt_data']
            profile = raster_data['profile']
            temp_files = raster_data['temp_files']
            
            print(f"   Working with aligned rasters: {nmt_data.shape}")
            
            # Load buildings with proper CRS handling
            buildings_gdf = gpd.read_file(temp_files['buildings'])
            print(f"   Loaded {len(buildings_gdf)} buildings")
            
            # Ensure CRS alignment between buildings and rasters
            if buildings_gdf.crs != profile['crs']:
                print("   Aligning building CRS with raster CRS...")
                buildings_gdf = buildings_gdf.to_crs(profile['crs'])
            
            # Create Canopy Height Model (CHM) - difference between DSM and DTM
            chm = nmpt_data - nmt_data
            print(f"   CHM statistics: min={np.min(chm):.2f}m, max={np.max(chm):.2f}m, mean={np.mean(chm):.2f}m")
            
            # Create building footprint mask by rasterizing building geometries
            print("   Rasterizing building footprints...")
            building_footprints_mask = rasterize(
                shapes=buildings_gdf.geometry,
                out_shape=nmt_data.shape,
                transform=profile['transform'],
                fill=0,
                default_value=1,
                dtype=np.uint8
            ).astype(bool)
            
            print(f"   Building footprint pixels: {np.sum(building_footprints_mask):,}")
            
            # Create final obstacle mask: buildings above height threshold
            obstacle_mask = building_footprints_mask & (chm >= self.config.simulation['height_threshold'])
            
            obstacle_count = np.sum(obstacle_mask)
            print(f"   Obstacles (>{self.config.simulation['height_threshold']}m): {obstacle_count:,} pixels")
            
            # === ORIGINAL RESIZING LOGIC FOR SIMULATION ===
            original_height, original_width = obstacle_mask.shape
            aspect_ratio = original_height / original_width
            sim_width = self.config.simulation['grid_width']
            sim_height = int(sim_width * aspect_ratio)
            
            print(f"   Resizing from {original_width}×{original_height} to {sim_width}×{sim_height}")
            
            # Create index arrays for nearest-neighbor resampling
            y_indices = np.linspace(0, original_height - 1, sim_height).astype(int)
            x_indices = np.linspace(0, original_width - 1, sim_width).astype(int)
            
            # Resize obstacle mask using index selection
            resized_mask = obstacle_mask[np.ix_(y_indices, x_indices)]
            
            # Add buffer padding for simulation stability
            buffer_size = self.config.simulation['buffer_size']
            final_mask = np.pad(resized_mask, pad_width=buffer_size, 
                              mode='constant', constant_values=False)
            
            print(f"   Final simulation grid with buffer: {final_mask.shape[1]}×{final_mask.shape[0]}")
            
            # Calculate geographic bounds for metadata
            bounds = [
                profile['transform'][2],  # left (west)
                profile['transform'][5] + profile['transform'][4] * profile['height'],  # bottom (south)
                profile['transform'][2] + profile['transform'][0] * profile['width'],   # right (east)
                profile['transform'][5]   # top (north)
            ]
            
            # Grid properties for API and visualization
            grid_info = {
                'width': final_mask.shape[1],
                'height': final_mask.shape[0], 
                'obstacles': int(np.sum(final_mask)),
                'buildings': len(buildings_gdf),
                'bounds': bounds,
                'pixel_size_original': abs(profile['transform'][0]),
                'pixel_size_simulation': abs(profile['transform'][0]) * (original_width / sim_width),
                'aspect_ratio': aspect_ratio,
                'buffer_size': buffer_size
            }
            
            print(f"✅ Simulation geometry created successfully:")
            print(f"   Grid size: {grid_info['width']}×{grid_info['height']}")
            print(f"   Obstacles: {grid_info['obstacles']:,}")
            print(f"   Buildings processed: {grid_info['buildings']:,}")
            print(f"   Pixel resolution: {grid_info['pixel_size_simulation']:.2f}m")
            
            return final_mask, grid_info
            
        except Exception as e:
            print(f"❌ Failed to create obstacle mask: {e}")
            traceback.print_exc()
            return None, None
    
    def run_simulation(self, obstacle_mask, grid_info, weather_data):
        """Run complete LBM wind simulation with comprehensive statistics"""
        print("💨 Running LBM wind simulation...")
        
        try:
            ny, nx = obstacle_mask.shape
            
            print(f"   Simulation setup:")
            print(f"   • Grid size: {nx}×{ny}")
            print(f"   • Iterations: {self.config.simulation['max_iterations']:,}")
            print(f"   • Relaxation rate: {self.config.simulation['relaxation_rate']}")
            print(f"   • Wind input: {weather_data['wind_speed_ms']:.2f} m/s @ {weather_data['wind_direction_deg']}°")
            print(f"   • Temperature: {weather_data['temperature_c']:.1f}°C")
            
            # Record simulation start time
            start_time = time.time()
            
            # Run high-performance LBM simulation
            ux, uy = run_lbm_simulation(
                obstacle_mask,
                weather_data['wind_speed_ms'],
                weather_data['wind_direction_deg'],
                nx, ny,
                self.config.simulation['max_iterations'],
                self.config.simulation['relaxation_rate']
            )
            
            sim_time = time.time() - start_time
            print(f"✅ LBM simulation completed in {sim_time:.2f} seconds")
            
            # Calculate comprehensive flow statistics
            magnitude = np.sqrt(ux**2 + uy**2)
            
            # Exclude buffer zones from statistics for accuracy
            buffer = self.config.simulation['buffer_size']
            if buffer > 0:
                core_magnitude = magnitude[buffer:-buffer, buffer:-buffer]
                core_ux = ux[buffer:-buffer, buffer:-buffer]
                core_uy = uy[buffer:-buffer, buffer:-buffer]
            else:
                core_magnitude = magnitude
                core_ux = ux
                core_uy = uy
            
            # Comprehensive flow statistics
            flow_stats = {
                'min_magnitude': float(np.min(core_magnitude)),
                'max_magnitude': float(np.max(core_magnitude)),
                'mean_magnitude': float(np.mean(core_magnitude)),
                'std_magnitude': float(np.std(core_magnitude)),
                'median_magnitude': float(np.median(core_magnitude)),
                'percentile_95': float(np.percentile(core_magnitude, 95)),
                'percentile_05': float(np.percentile(core_magnitude, 5))
            }
            
            print(f"   Flow field statistics:")
            print(f"   • Speed range: {flow_stats['min_magnitude']:.2f} - {flow_stats['max_magnitude']:.2f} m/s")
            print(f"   • Average speed: {flow_stats['mean_magnitude']:.2f} ± {flow_stats['std_magnitude']:.2f} m/s")
            print(f"   • Median speed: {flow_stats['median_magnitude']:.2f} m/s")
            
            # Create vector field for web application visualization (ORIGINAL STRIDE LOGIC)
            print("   Generating vector field for visualization...")
            stride = self.config.simulation['vector_stride']
            vectors = []
            
            for y in range(0, ny, stride):
                for x in range(0, nx, stride):
                    if not obstacle_mask[y, x]:  # Only include free space
                        vectors.append({
                            'x': x,
                            'y': y,
                            'vx': round(float(ux[y, x]), self.config.simulation['output_precision']),
                            'vy': round(float(uy[y, x]), self.config.simulation['output_precision']),
                            'magnitude': round(float(magnitude[y, x]), self.config.simulation['output_precision'])
                        })
            
            print(f"   Vector field: {len(vectors):,} vectors generated (stride: {stride})")
            
            # Prepare complete simulation results
            simulation_results = {
                'computation_time': round(sim_time, 2),
                'flow_statistics': flow_stats,
                'vector_field': vectors,
                'magnitude_grid': magnitude.round(self.config.simulation['output_precision']).tolist(),
                'simulation_params': {
                    'grid_size': [nx, ny],
                    'iterations': self.config.simulation['max_iterations'],
                    'relaxation_rate': self.config.simulation['relaxation_rate'],
                    'buffer_size': self.config.simulation['buffer_size'],
                    'vector_stride': stride
                }
            }
            
            return simulation_results
            
        except Exception as e:
            print(f"❌ Wind simulation failed: {e}")
            traceback.print_exc()
            return None

# === RESULTS PROCESSOR ===
class ResultsProcessor:
    """Process and save simulation results in GitHub Pages API format"""
    
    def __init__(self, config):
        self.config = config
    
    def create_api_structure(self):
        """Create complete GitHub Pages API directory structure"""
        required_dirs = [
            self.config.paths['api_dir'],
            self.config.paths['wind_api'],
            self.config.paths['system_api'],
            self.config.paths['results_dir'],
            os.path.join(self.config.paths['api_dir'], 'vegetation_analysis'),
            os.path.join(self.config.paths['api_dir'], 'thermal_comfort')
        ]
        
        for directory in required_dirs:
            os.makedirs(directory, exist_ok=True)
        
        print("📁 Complete GitHub Pages API directory structure created")
    
    def save_results(self, simulation_results, weather_data, grid_info):
        """Save comprehensive results in professional GitHub Pages API format"""
        print("💾 Saving simulation results...")
        
        try:
            current_timestamp = datetime.utcnow().isoformat()
            
            # === MAIN WIND SIMULATION API ENDPOINT ===
            wind_api_data = {
                'metadata': {
                    'timestamp': current_timestamp,
                    'module': 'wind_simulation',
                    'version': '2.2.0',
                    'computation_time': simulation_results['computation_time'],
                    'platform': 'professional_gis_microclimate',
                    'data_source': weather_data['source'],
                    'simulation_id': f"sim_{int(time.time())}"
                },
                'configuration': {
                    'simulation': {
                        'resolution_width': self.config.simulation['grid_width'],
                        'max_iterations': self.config.simulation['max_iterations'],
                        'relaxation_rate': self.config.simulation['relaxation_rate'],
                        'height_threshold': self.config.simulation['height_threshold'],
                        'buffer_size': self.config.simulation['buffer_size']
                    },
                    'location': {
                        'latitude': self.config.location['latitude'],
                        'longitude': self.config.location['longitude'],
                        'coordinate_system': 'EPSG:2180'
                    }
                },
                'grid_properties': {
                    'width': grid_info['width'],
                    'height': grid_info['height'],
                    'bounds': grid_info['bounds'],
                    'obstacle_count': grid_info['obstacles'],
                    'buildings_count': grid_info['buildings'],
                    'pixel_size_m': round(grid_info['pixel_size_simulation'], 2),
                    'aspect_ratio': round(grid_info['aspect_ratio'], 3)
                },
                'weather_conditions': weather_data,
                'flow_statistics': simulation_results['flow_statistics'],
                'vector_field': simulation_results['vector_field'],
                'magnitude_grid': simulation_results['magnitude_grid']
            }
            
            # Save main wind simulation API file
            wind_api_file = os.path.join(self.config.paths['wind_api'], 'current.json')
            with open(wind_api_file, 'w', encoding='utf-8') as f:
                json.dump(wind_api_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Wind simulation API: {wind_api_file}")
            
            # === SYSTEM METADATA API ENDPOINT ===
            system_metadata = {
                'timestamp': current_timestamp,
                'system_status': 'operational',
                'platform_version': '2.2.0',
                'modules': {
                    'wind_simulation': {
                        'status': 'active',
                        'last_update': current_timestamp,
                        'computation_time': simulation_results['computation_time'],
                        'data_points': len(simulation_results['vector_field']),
                        'grid_size': f"{grid_info['width']}×{grid_info['height']}"
                    },
                    'vegetation_analysis': {
                        'status': 'pending',
                        'last_update': None,
                        'description': 'Vegetation and landcover analysis module'
                    },
                    'thermal_comfort': {
                        'status': 'pending',
                        'last_update': None,
                        'description': 'Thermal comfort assessment module'
                    }
                },
                'api_endpoints': [
                    'wind_simulation/current.json',
                    'system/metadata.json',
                    'vegetation_analysis/current.json',
                    'thermal_comfort/current.json'
                ],
                'github_pages': {
                    'repository': f"{self.config.github_username}/{self.config.github_repo}",
                    'last_deployment': current_timestamp,
                    'auto_refresh_interval': 30000
                }
            }
            
            # Save system metadata
            metadata_file = os.path.join(self.config.paths['system_api'], 'metadata.json')
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(system_metadata, f, indent=2, ensure_ascii=False)
            
            print(f"✅ System metadata API: {metadata_file}")
            
            # === BACKUP TO ORIGINAL RESULTS STRUCTURE ===
            backup_data = wind_api_data.copy()
            backup_file = os.path.join(self.config.paths['results_dir'], 'wind_data.json')
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Results backup: {backup_file}")
            
            # === CREATE PLACEHOLDER FILES FOR FUTURE MODULES ===
            placeholder_modules = ['vegetation_analysis', 'thermal_comfort']
            for module in placeholder_modules:
                placeholder_data = {
                    'metadata': {
                        'timestamp': current_timestamp,
                        'module': module,
                        'version': '2.2.0',
                        'status': 'pending',
                        'message': f'{module.replace("_", " ").title()} module will be available in future updates'
                    }
                }
                
                placeholder_file = os.path.join(self.config.paths['api_dir'], module, 'current.json')
                os.makedirs(os.path.dirname(placeholder_file), exist_ok=True)
                with open(placeholder_file, 'w', encoding='utf-8') as f:
                    json.dump(placeholder_data, f, indent=2, ensure_ascii=False)
            
            print("✅ All API endpoints created successfully")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save simulation results: {e}")
            traceback.print_exc()
            return False
