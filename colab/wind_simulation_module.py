# -*- coding: utf-8 -*-
"""
GIS Microclimate Professional Platform
Module 1: Wind Simulation with LBM Integration
GitHub Integration Ready
"""

import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
import rasterio.features
from rasterio.warp import transform_geom
import matplotlib.pyplot as plt
import requests
import json
import time
from datetime import datetime
from numba import njit, prange
from PIL import Image
from google.colab import files
import os

# =============================================================================
# PROFESSIONAL CONFIGURATION CLASS
# =============================================================================

class WindSimulationConfig:
    """Professional configuration management for wind simulation"""
    
    # File paths (Google Drive)
    DTM_PATH = '/content/nmt.tif'
    DSM_PATH = '/content/nmpt.tif' 
    BUILDINGS_PATH = '/content/buildings.gpkg'
    
    # Geographic coordinates
    AREA_LATITUDE = 54.16
    AREA_LONGITUDE = 19.40
    
    # Simulation parameters
    SIM_RESOLUTION_WIDTH = 750
    BUFFER_SIZE = 50
    MAX_ITER = 4000
    RELAXATION_RATE = 1.4
    OBSTACLE_HEIGHT_THRESHOLD = 2.5
    
    # API endpoints for GitHub integration
    GITHUB_API_BASE = "https://api.github.com/repos/{username}/{repo}/contents"
    GITHUB_PAGES_BASE = "https://{username}.github.io/{repo}/api/data"
    
    # Output configuration
    OUTPUT_PRECISION = 4
    VECTOR_FIELD_STRIDE = 5
    
    @classmethod
    def to_dict(cls):
        """Export configuration as dictionary"""
        return {
            'simulation': {
                'resolution_width': cls.SIM_RESOLUTION_WIDTH,
                'buffer_size': cls.BUFFER_SIZE,
                'max_iterations': cls.MAX_ITER,
                'relaxation_rate': cls.RELAXATION_RATE,
                'obstacle_threshold': cls.OBSTACLE_HEIGHT_THRESHOLD
            },
            'location': {
                'latitude': cls.AREA_LATITUDE,
                'longitude': cls.AREA_LONGITUDE
            },
            'precision': cls.OUTPUT_PRECISION
        }

# =============================================================================
# PROFESSIONAL API CLIENT
# =============================================================================

class GitHubAPIClient:
    """Professional client for GitHub API integration"""
    
    def __init__(self, username, repo, token=None):
        self.username = username
        self.repo = repo
        self.token = token
        self.api_base = f"https://api.github.com/repos/{username}/{repo}/contents"
        
    def upload_data(self, file_path, data, message="Update simulation data"):
        """Upload data to GitHub repository"""
        try:
            import base64
            
            # Encode data
            content = base64.b64encode(json.dumps(data, indent=2).encode()).decode()
            
            # Prepare payload
            payload = {
                'message': message,
                'content': content,
                'branch': 'main'
            }
            
            headers = {}
            if self.token:
                headers['Authorization'] = f'token {self.token}'
            
            # Upload to GitHub
            url = f"{self.api_base}/{file_path}"
            response = requests.put(url, json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                print(f"✅ Data uploaded successfully to: {file_path}")
                return True
            else:
                print(f"❌ Upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False
    
    def create_simulation_metadata(self, results):
        """Create professional metadata for simulation results"""
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'module': 'wind_simulation',
            'version': '1.0.0',
            'status': 'completed',
            'statistics': {
                'grid_size': f"{results['gridWidth']}x{results['gridHeight']}",
                'vector_count': len(results['vectors']),
                'magnitude_range': [results['minMagnitude'], results['maxMagnitude']],
                'computation_time': results.get('computation_time', 0)
            },
            'configuration': WindSimulationConfig.to_dict()
        }

# =============================================================================
# PROFESSIONAL GIS PROCESSOR  
# =============================================================================

class ProfessionalGISProcessor:
    """Advanced GIS data processing with professional standards"""
    
    @staticmethod
    def get_weather_data_open_meteo(latitude, longitude):
        """Fetch real-time weather data with error handling"""
        print(f"🌤️  Fetching weather data for: {latitude:.3f}, {longitude:.3f}")
        
        base_url = "https://api.open-meteo.com/v1/forecast"
        params = {
            'latitude': latitude, 
            'longitude': longitude, 
            'current': 'wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m'
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            wind_speed_ms = data['current']['wind_speed_10m'] / 3.6
            wind_deg = data['current']['wind_direction_10m']
            temperature = data['current']['temperature_2m']
            humidity = data['current']['relative_humidity_2m']
            
            weather_data = {
                'wind_speed_ms': wind_speed_ms,
                'wind_direction_deg': wind_deg,
                'temperature_c': temperature,
                'humidity_percent': humidity,
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'open-meteo'
            }
            
            print(f"✅ Weather data: {wind_speed_ms:.2f} m/s, {wind_deg}°, {temperature}°C")
            return weather_data
            
        except Exception as e:
            print(f"⚠️  Weather API error: {e}. Using defaults.")
            return {
                'wind_speed_ms': 5.0,
                'wind_direction_deg': 270.0,
                'temperature_c': 20.0,
                'humidity_percent': 60.0,
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'default'
            }
    
    @staticmethod
    def process_and_rasterize_geodata(dtm_path, dsm_path, buildings_path, 
                                     height_threshold, sim_width, buffer_size):
        """Professional geodata processing with comprehensive error handling"""
        print("🗺️  Processing geodata with professional standards...")
        
        try:
            # Load and validate data
            buildings_gdf = gpd.read_file(buildings_path)
            
            with rasterio.open(dtm_path) as dtm_src, rasterio.open(dsm_path) as dsm_src:
                # CRS alignment
                if buildings_gdf.crs != dtm_src.crs:
                    print("🔄 Aligning coordinate systems...")
                    buildings_gdf = buildings_gdf.to_crs(dtm_src.crs)
                
                buildings_gdf_wgs84 = buildings_gdf.to_crs("EPSG:4326")
                
                # Load raster data
                dtm_data = dtm_src.read(1)
                dsm_data = dsm_src.read(1)
                
                # Validate dimensions
                if dtm_data.shape != dsm_data.shape:
                    print(f"⚠️  Raster dimension mismatch: {dtm_data.shape} vs {dsm_data.shape}")
                    target_h = min(dtm_data.shape[0], dsm_data.shape[0])
                    target_w = min(dtm_data.shape[1], dsm_data.shape[1])
                    dtm_data = dtm_data[:target_h, :target_w]
                    dsm_data = dsm_data[:target_h, :target_w]
                
                # Create building footprint mask
                print("🏢 Rasterizing building footprints...")
                building_footprints_mask = rasterio.features.rasterize(
                    shapes=buildings_gdf.geometry,
                    out_shape=dtm_data.shape,
                    transform=dtm_src.transform,
                    fill=0, default_value=1,
                    dtype=np.uint8
                ).astype(bool)
                
                # Create Canopy Height Model
                chm = dsm_data - dtm_data
                
                # Generate obstacle mask
                obstacle_mask = building_footprints_mask & (chm >= height_threshold)
                
                # Resize for simulation
                original_height, original_width = obstacle_mask.shape
                aspect_ratio = original_height / original_width
                sim_height = int(sim_width * aspect_ratio)
                
                y_indices = np.linspace(0, original_height - 1, sim_height).astype(int)
                x_indices = np.linspace(0, original_width - 1, sim_width).astype(int)
                
                resized_mask = obstacle_mask[np.ix_(y_indices, x_indices)]
                final_mask = np.pad(resized_mask, pad_width=buffer_size, 
                                  mode='constant', constant_values=False)
                
                total_width, total_height = final_mask.shape[1], final_mask.shape[0]
                
                # Calculate geographic bounds
                bounds = dtm_src.bounds
                transform = dtm_src.transform
                pixel_size_x, pixel_size_y = transform[0], -transform[4]
                
                buffer_x_meters = buffer_size * (original_width / sim_width) * pixel_size_x
                buffer_y_meters = buffer_size * (original_width / sim_width) * pixel_size_y
                
                final_bounds = (
                    bounds.left - buffer_x_meters,
                    bounds.bottom - buffer_y_meters,
                    bounds.right + buffer_x_meters,
                    bounds.top + buffer_y_meters
                )
                
                # Transform to WGS84
                geom = {'type': 'Polygon', 'coordinates': [[
                    (final_bounds[0], final_bounds[1]),
                    (final_bounds[2], final_bounds[1]),
                    (final_bounds[2], final_bounds[3]),
                    (final_bounds[0], final_bounds[3]),
                    (final_bounds[0], final_bounds[1])
                ]]}
                
                warped_geom = transform_geom(dtm_src.crs, 'EPSG:4326', geom)
                lon_coords, lat_coords = zip(*warped_geom['coordinates'][0])
                
                final_latlon_bounds = [
                    [min(lat_coords), min(lon_coords)],
                    [max(lat_coords), max(lon_coords)]
                ]
                
                processing_stats = {
                    'original_size': f"{original_width}x{original_height}",
                    'simulation_size': f"{total_width}x{total_height}",
                    'buildings_count': len(buildings_gdf),
                    'obstacles_pixels': int(np.sum(final_mask)),
                    'geographic_bounds': final_latlon_bounds
                }
                
                print(f"✅ Geodata processing complete: {processing_stats}")
                
                return {
                    'obstacle_mask': final_mask,
                    'width': total_width,
                    'height': total_height,
                    'bounds': final_latlon_bounds,
                    'buildings_geojson': buildings_gdf_wgs84,
                    'stats': processing_stats
                }
                
        except Exception as e:
            print(f"❌ Critical geodata processing error: {e}")
            return None

# =============================================================================
# OPTIMIZED LBM SIMULATION
# =============================================================================

@njit(parallel=True, fastmath=True)
def run_professional_lbm_simulation(obstacle_mask, wind_speed, wind_deg, nx, ny, max_iter, relaxation_rate):
    """Highly optimized LBM simulation with professional-grade performance"""
    
    # Lattice constants
    c = np.array([[0,0], [1,0], [0,1], [-1,0], [0,-1], [1,1], [-1,1], [-1,-1], [1,-1]], dtype=np.int64)
    w = np.array([4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0])
    
    # Pre-compute lattice vectors
    cx, cy = np.empty(9, dtype=np.int64), np.empty(9, dtype=np.int64)
    c_x, c_y = np.empty(9, dtype=np.float64), np.empty(9, dtype=np.float64)
    
    for k in range(9):
        cx[k], cy[k] = c[k, 0], c[k, 1]
        c_x[k], c_y[k] = float(c[k, 0]), float(c[k, 1])
    
    # Initialize distribution functions
    F = np.ones((ny, nx, 9), dtype=np.float64)
    F_streamed = np.empty_like(F)
    
    # Wind direction conversion (meteorological to mathematical)
    math_rad = np.deg2rad(90.0 - wind_deg)
    inlet_velocity_magnitude = 0.1
    vel_x_sim = np.cos(math_rad) * inlet_velocity_magnitude
    vel_y_sim = np.sin(math_rad) * inlet_velocity_magnitude
    
    # Macroscopic variables
    rho = np.empty((ny, nx), dtype=np.float64)
    ux = np.zeros((ny, nx), dtype=np.float64)
    uy = np.zeros((ny, nx), dtype=np.float64)
    
    # Main simulation loop
    for it in range(max_iter):
        # Streaming step
        for j in prange(ny):
            for i in range(nx):
                for k in range(9):
                    sj, si = j - cy[k], i - cx[k]
                    if sj < 0: sj += ny
                    elif sj >= ny: sj -= ny
                    if si < 0: si += nx
                    elif si >= nx: si -= nx
                    F_streamed[j, i, k] = F[sj, si, k]
        
        # Swap arrays
        tmp = F; F = F_streamed; F_streamed = tmp
        
        # Bounce-back boundary conditions
        for j in prange(ny):
            for i in range(nx):
                if obstacle_mask[j, i]:
                    f1, f2, f3, f4 = F[j, i, 1], F[j, i, 2], F[j, i, 3], F[j, i, 4]
                    f5, f6, f7, f8 = F[j, i, 5], F[j, i, 6], F[j, i, 7], F[j, i, 8]
                    
                    F[j, i, 1], F[j, i, 3] = f3, f1
                    F[j, i, 2], F[j, i, 4] = f4, f2
                    F[j, i, 5], F[j, i, 7] = f7, f5
                    F[j, i, 6], F[j, i, 8] = f8, f6
        
        # Outflow boundary conditions
        for i in range(nx):
            for k in range(9):
                F[0, i, k], F[ny-1, i, k] = F[1, i, k], F[ny-2, i, k]
        for j in range(ny):
            for k in range(9):
                F[j, 0, k], F[j, nx-1, k] = F[j, 1, k], F[j, nx-2, k]
        
        # Compute macroscopic variables
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
        
        # Inflow boundary conditions
        if wind_deg >= 315 or wind_deg < 45:
            for i in range(nx): ux[0, i], uy[0, i] = vel_x_sim, vel_y_sim
        elif wind_deg >= 45 and wind_deg < 135:
            for j in range(ny): ux[j, nx-1], uy[j, nx-1] = vel_x_sim, vel_y_sim
        elif wind_deg >= 135 and wind_deg < 225:
            for i in range(nx): ux[ny-1, i], uy[ny-1, i] = vel_x_sim, vel_y_sim
        else:
            for j in range(ny): ux[j, 0], uy[j, 0] = vel_x_sim, vel_y_sim
        
        # Collision step
        for j in prange(ny):
            for i in range(nx):
                usq = ux[j, i]**2 + uy[j, i]**2
                for k in range(9):
                    cu = ux[j, i] * c_x[k] + uy[j, i] * c_y[k]
                    eq = rho[j, i] * w[k] * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * usq)
                    F[j, i, k] += relaxation_rate * (eq - F[j, i, k])
    
    # Scale to real values
    ux_real = np.empty((ny, nx), dtype=np.float64)
    uy_real = np.empty((ny, nx), dtype=np.float64)
    scale = wind_speed / inlet_velocity_magnitude
    
    for j in prange(ny):
        for i in range(nx):
            ux_real[j, i], uy_real[j, i] = ux[j, i] * scale, uy[j, i] * scale
    
    return ux_real, uy_real

# =============================================================================
# PROFESSIONAL VISUALIZATION
# =============================================================================

class ProfessionalVisualizer:
    """Professional visualization with scientific standards"""
    
    @staticmethod
    def create_wind_field_plot(ux, uy, obstacle_mask, save_path=None):
        """Create professional wind field visualization"""
        
        magnitude = np.sqrt(ux**2 + uy**2)
        ny, nx = magnitude.shape
        Y, X = np.mgrid[0:ny:1, 0:nx:1]
        
        plt.figure(figsize=(16, 12))
        
        # Masked magnitude plot
        masked_magnitude = np.ma.masked_where(obstacle_mask, magnitude)
        plt.imshow(masked_magnitude, cmap='viridis', origin='lower', interpolation='bicubic')
        
        cbar = plt.colorbar(label='Wind Speed (m/s)', shrink=0.8)
        cbar.ax.tick_params(labelsize=12)
        
        # Streamlines
        stride = 8
        plt.streamplot(X[::stride, ::stride], Y[::stride, ::stride],
                      ux[::stride, ::stride], uy[::stride, ::stride],
                      color='white', linewidth=1.0, density=1.5)
        
        # Obstacle overlay
        obstacle_viz = np.zeros((ny, nx, 4))
        obstacle_viz[obstacle_mask] = [0.2, 0.2, 0.2, 0.8]
        plt.imshow(obstacle_viz, origin='lower', interpolation='nearest')
        
        plt.title('Professional Wind Field Analysis', fontsize=16, fontweight='bold')
        plt.xlabel('X Coordinate (pixels)', fontsize=14)
        plt.ylabel('Y Coordinate (pixels)', fontsize=14)
        plt.xlim(0, nx)
        plt.ylim(0, ny)
        plt.gca().set_aspect('equal', adjustable='box')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"✅ Visualization saved: {save_path}")
        
        plt.show()

# =============================================================================
# MAIN PROFESSIONAL EXECUTION CLASS
# =============================================================================

class WindSimulationPipeline:
    """Professional pipeline for wind simulation with full integration"""
    
    def __init__(self, config=None):
        self.config = config or WindSimulationConfig()
        self.processor = ProfessionalGISProcessor()
        self.visualizer = ProfessionalVisualizer()
        self.github_client = None
        self.results = {}
        
    def set_github_integration(self, username, repo, token=None):
        """Configure GitHub integration"""
        self.github_client = GitHubAPIClient(username, repo, token)
        
    def run_complete_pipeline(self):
        """Execute complete professional pipeline"""
        print("🚀 Starting Professional Wind Simulation Pipeline")
        print("=" * 70)
        
        pipeline_start = time.time()
        
        # Step 1: Process geodata
        print("📊 Step 1: Geodata Processing")
        geodata = self.processor.process_and_rasterize_geodata(
            self.config.DTM_PATH,
            self.config.DSM_PATH, 
            self.config.BUILDINGS_PATH,
            self.config.OBSTACLE_HEIGHT_THRESHOLD,
            self.config.SIM_RESOLUTION_WIDTH,
            self.config.BUFFER_SIZE
        )
        
        if not geodata:
            print("❌ Pipeline failed at geodata processing")
            return None
            
        # Step 2: Get weather data
        print("\n🌤️  Step 2: Weather Data Acquisition")
        weather_data = self.processor.get_weather_data_open_meteo(
            self.config.AREA_LATITUDE, self.config.AREA_LONGITUDE
        )
        
        # Step 3: Run LBM simulation
        print(f"\n⚡ Step 3: LBM Simulation ({self.config.MAX_ITER} iterations)")
        sim_start = time.time()
        
        ux, uy = run_professional_lbm_simulation(
            geodata['obstacle_mask'],
            weather_data['wind_speed_ms'],
            weather_data['wind_direction_deg'],
            geodata['width'],
            geodata['height'],
            self.config.MAX_ITER,
            self.config.RELAXATION_RATE
        )
        
        sim_time = time.time() - sim_start
        print(f"✅ Simulation completed in {sim_time:.2f} seconds")
        
        # Step 4: Process results
        print("\n📈 Step 4: Results Processing")
        results = self._process_simulation_results(ux, uy, geodata, weather_data, sim_time)
        
        # Step 5: Visualization
        print("\n🎨 Step 5: Professional Visualization") 
        self.visualizer.create_wind_field_plot(
            ux, uy, geodata['obstacle_mask'], 
            save_path='wind_field_professional.png'
        )
        
        # Step 6: Export and Integration
        print("\n💾 Step 6: Data Export & Integration")
        self._export_results(results)
        
        if self.github_client:
            self._upload_to_github(results)
        
        pipeline_time = time.time() - pipeline_start
        print(f"\n🎉 Pipeline completed in {pipeline_time:.2f} seconds")
        print("=" * 70)
        
        return results
    
    def _process_simulation_results(self, ux, uy, geodata, weather_data, sim_time):
        """Process and format simulation results professionally"""
        
        magnitude = np.sqrt(ux**2 + uy**2)
        
        # Calculate statistics (excluding buffer zones)
        buffer = 10
        core_magnitude = magnitude[buffer:-buffer, buffer:-buffer]
        
        # Create vector field for visualization
        stride = self.config.VECTOR_FIELD_STRIDE
        vector_field = []
        
        ny, nx = magnitude.shape
        for y in range(0, ny, stride):
            for x in range(0, nx, stride):
                if not geodata['obstacle_mask'][y, x]:
                    vector_field.append({
                        'x': x,
                        'y': y,
                        'vx': round(float(ux[y, x]), self.config.OUTPUT_PRECISION),
                        'vy': round(float(uy[y, x]), self.config.OUTPUT_PRECISION),
                        'magnitude': round(float(magnitude[y, x]), self.config.OUTPUT_PRECISION)
                    })
        
        results = {
            'metadata': {
                'timestamp': datetime.utcnow().isoformat(),
                'module': 'wind_simulation',
                'version': '1.0.0',
                'computation_time': round(sim_time, 2)
            },
            'configuration': self.config.to_dict(),
            'weather_conditions': weather_data,
            'grid_properties': {
                'width': int(geodata['width']),
                'height': int(geodata['height']),
                'bounds': geodata['bounds'],
                'obstacle_count': int(np.sum(geodata['obstacle_mask']))
            },
            'flow_statistics': {
                'min_magnitude': round(float(np.min(core_magnitude)), self.config.OUTPUT_PRECISION),
                'max_magnitude': round(float(np.max(core_magnitude)), self.config.OUTPUT_PRECISION),
                'mean_magnitude': round(float(np.mean(core_magnitude)), self.config.OUTPUT_PRECISION),
                'std_magnitude': round(float(np.std(core_magnitude)), self.config.OUTPUT_PRECISION)
            },
            'vector_field': vector_field,
            'magnitude_grid': magnitude.round(self.config.OUTPUT_PRECISION).tolist()
        }
        
        self.results = results
        return results
    
    def _export_results(self, results):
        """Export results in multiple professional formats"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # JSON export for web integration
        json_file = f'wind_simulation_{timestamp}.json'
        with open(json_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"✅ JSON exported: {json_file}")
        
        # CSV export for analysis
        df = pd.DataFrame(results['vector_field'])
        csv_file = f'wind_vectors_{timestamp}.csv'
        df.to_csv(csv_file, index=False)
        
        print(f"✅ CSV exported: {csv_file}")
        
        # Download files in Colab
        files.download(json_file)
        files.download(csv_file)
        
    def _upload_to_github(self, results):
        """Upload results to GitHub for web integration"""
        
        try:
            # Upload main data file
            data_path = "api/data/wind_simulation/current.json"
            success = self.github_client.upload_data(
                data_path, results, 
                f"Update wind simulation data - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )
            
            if success:
                # Upload metadata
                metadata = self.github_client.create_simulation_metadata(results)
                meta_path = "api/data/wind_simulation/metadata.json"
                self.github_client.upload_data(
                    meta_path, metadata,
                    "Update simulation metadata"
                )
                
                print("🌐 Data successfully integrated with GitHub Pages!")
                pages_url = f"https://{self.github_client.username}.github.io/{self.github_client.repo}"
                print(f"📱 View results at: {pages_url}")
                
        except Exception as e:
            print(f"⚠️  GitHub integration error: {e}")

# =============================================================================
# PROFESSIONAL EXECUTION
# =============================================================================

if __name__ == "__main__":
    # Initialize professional pipeline
    pipeline = WindSimulationPipeline()
    
    # Optional: Configure GitHub integration
    # pipeline.set_github_integration("your-username", "your-repo", "your-token")
    
    # Run complete pipeline
    results = pipeline.run_complete_pipeline()
    
    if results:
        print("\n📋 PROFESSIONAL SUMMARY:")
        print(f"   Simulation time: {results['metadata']['computation_time']} seconds")
        print(f"   Grid size: {results['grid_properties']['width']}x{results['grid_properties']['height']}")
        print(f"   Vector count: {len(results['vector_field'])}")
        print(f"   Wind speed range: {results['flow_statistics']['min_magnitude']:.2f} - {results['flow_statistics']['max_magnitude']:.2f} m/s")
        print("\n✅ Professional Wind Simulation Pipeline Complete!")
    else:
        print("\n❌ Pipeline execution failed!")
