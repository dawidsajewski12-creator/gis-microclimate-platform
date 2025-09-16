// Professional GIS Microclimate Platform - Complete Visualization
// Version: 2.4.0 - Full wind visualization with buildings and terrain layers

class GISMicroclimateUpgrade {
    constructor() {
        this.config = {
            apiConfig: {
                githubBaseUrl: "https://api.github.com/repos",
                defaultRepo: "dawidsajewski12-creator/gis-microclimate-platform",
                endpoints: {
                    windSimulation: "api/data/wind_simulation/current.json",
                    systemMetadata: "api/data/system/metadata.json",
                    buildings: "api/data/layers/buildings.json",
                    terrain: "api/data/layers/terrain.json"
                },
                refreshInterval: 30000,
                timeout: 5000
            },
            mapConfig: {
                center: [54.16, 19.40],
                zoom: 14,
                minZoom: 10,
                maxZoom: 18,
                locations: [
                    {
                        id: 'loc1',
                        name: 'Centrum Miasta - Mikroklima',
                        coords: [54.16, 19.40],
                        status: 'active',
                        description: 'Główna stacja badawcza mikroklimatu miejskiego',
                        lastUpdate: '2024-03-15T14:30:00Z',
                        dataQuality: 'high'
                    }
                ]
            },
            visualization: {
                defaultOpacity: 70,
                defaultMode: 'vectors',
                particleCount: 2000,
                streamlineCount: 150,
                vectorScale: 15,
                colorSchemes: {
                    magnitude: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
                    elevation: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6']
                }
            }
        };

        this.state = {
            currentModule: 'dashboard',
            isLoading: false,
            apiConnected: false,
            lastUpdate: null,
            windData: null,
            buildingsData: null,
            terrainData: null,
            autoRefreshEnabled: false,
            refreshTimer: null,
            vizMode: 'vectors',
            showBuildings: true,
            showTerrain: true,
            opacity: 70,
            particleCount: 2000
        };

        // Map instances and layers
        this.dashboardMap = null;
        this.windMap = null;
        this.windCanvas = null;
        this.windCtx = null;
        this.windLayer = null;
        this.buildingsLayer = null;
        this.terrainLayer = null;

        // Animation and rendering
        this.particles = [];
        this.streamlines = [];
        this.animationFrame = null;
        this.renderingActive = false;

        this.init();
    }

    async init() {
        console.log('🚀 Initializing GIS Microclimate Platform v2.4.0');
        try {
            this.setupEventListeners();
            this.initializeDashboardMap();
            this.initializeWindVisualizationMap();
            await this.loadSampleData();
            this.updateUI();
            this.showConnectionOption();
            console.log('✅ Platform with full visualization initialized');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showToast('Platform initialization failed', 'error');
        }
    }

    // ===== MAP INITIALIZATION =====
    
    initializeDashboardMap() {
        const mapElement = document.getElementById('dashboard-map');
        if (!mapElement) return;

        this.dashboardMap = L.map('dashboard-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.mapConfig.center, this.config.mapConfig.zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.config.mapConfig.maxZoom
        }).addTo(this.dashboardMap);

        L.control.zoom({ position: 'bottomright' }).addTo(this.dashboardMap);
        this.addLocationMarkers();
        console.log('✅ Dashboard map initialized');
    }

    initializeWindVisualizationMap() {
        const mapElement = document.getElementById('wind-map');
        if (!mapElement) return;

        this.windMap = L.map('wind-map', {
            zoomControl: true,
            attributionControl: true
        }).setView(this.config.mapConfig.center, this.config.mapConfig.zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.config.mapConfig.maxZoom
        }).addTo(this.windMap);

        // Initialize canvas overlay for wind visualization
        this.setupWindCanvas();
        console.log('✅ Wind visualization map initialized');
    }

    setupWindCanvas() {
        if (!this.windMap) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'wind-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1000';

        const mapContainer = this.windMap.getContainer();
        mapContainer.appendChild(canvas);

        this.windCanvas = canvas;
        this.windCtx = canvas.getContext('2d');

        this.resizeWindCanvas();
        this.windMap.on('resize', () => this.resizeWindCanvas());
        this.windMap.on('moveend zoomend', () => this.renderWindVisualization());
    }

    resizeWindCanvas() {
        if (!this.windCanvas || !this.windMap) return;

        const mapContainer = this.windMap.getContainer();
        this.windCanvas.width = mapContainer.offsetWidth;
        this.windCanvas.height = mapContainer.offsetHeight;
        this.windCanvas.style.width = mapContainer.offsetWidth + 'px';
        this.windCanvas.style.height = mapContainer.offsetHeight + 'px';
    }

    // ===== WIND VISUALIZATION RENDERING =====

    renderWindVisualization() {
        if (!this.windData || !this.windCtx || !this.windMap) return;

        this.clearCanvas();

        switch (this.state.vizMode) {
            case 'vectors':
                this.renderWindVectors();
                break;
            case 'streamlines':
                this.renderStreamlines();
                break;
            case 'particles':
                this.startParticleAnimation();
                break;
            case 'heatmap':
                this.renderWindHeatmap();
                break;
        }
    }

    clearCanvas() {
        if (!this.windCtx) return;
        this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);
    }

    renderWindVectors() {
        if (!this.windData.vector_field) return;

        const vectors = this.windData.vector_field;
        const bounds = this.windMap.getBounds();
        const zoom = this.windMap.getZoom();
        const scale = this.config.visualization.vectorScale * Math.pow(2, zoom - 14);

        this.windCtx.strokeStyle = 'rgba(33, 128, 141, 0.8)';
        this.windCtx.lineWidth = 2;
        this.windCtx.lineCap = 'round';

        vectors.forEach(vector => {
            // Convert grid coordinates to map coordinates
            const gridBounds = this.getGridBounds();
            const lat = gridBounds.north - (vector.y / this.getGridHeight()) * (gridBounds.north - gridBounds.south);
            const lng = gridBounds.west + (vector.x / this.getGridWidth()) * (gridBounds.east - gridBounds.west);

            if (!bounds.contains([lat, lng])) return;

            const point = this.windMap.latLngToContainerPoint([lat, lng]);
            const magnitude = vector.magnitude;
            const length = magnitude * scale;

            if (length < 1) return; // Skip very small vectors

            // Calculate arrow direction
            const angle = Math.atan2(vector.vy, vector.vx);
            const endX = point.x + Math.cos(angle) * length;
            const endY = point.y + Math.sin(angle) * length;

            // Color based on magnitude
            const color = this.getWindColor(magnitude);
            this.windCtx.strokeStyle = color;

            // Draw arrow shaft
            this.windCtx.beginPath();
            this.windCtx.moveTo(point.x, point.y);
            this.windCtx.lineTo(endX, endY);
            this.windCtx.stroke();

            // Draw arrowhead
            const headLength = Math.min(length * 0.3, 8);
            const headAngle = Math.PI / 6;

            this.windCtx.beginPath();
            this.windCtx.moveTo(endX, endY);
            this.windCtx.lineTo(
                endX - headLength * Math.cos(angle - headAngle),
                endY - headLength * Math.sin(angle - headAngle)
            );
            this.windCtx.moveTo(endX, endY);
            this.windCtx.lineTo(
                endX - headLength * Math.cos(angle + headAngle),
                endY - headLength * Math.sin(angle + headAngle)
            );
            this.windCtx.stroke();
        });
    }

    renderStreamlines() {
        if (!this.windData.streamlines) return;

        const bounds = this.windMap.getBounds();
        const streamlines = this.windData.streamlines;

        streamlines.forEach(streamline => {
            if (streamline.length < 2) return;

            this.windCtx.beginPath();
            let isFirst = true;

            streamline.forEach(point => {
                const gridBounds = this.getGridBounds();
                const lat = gridBounds.north - (point.y / this.getGridHeight()) * (gridBounds.north - gridBounds.south);
                const lng = gridBounds.west + (point.x / this.getGridWidth()) * (gridBounds.east - gridBounds.west);

                if (!bounds.contains([lat, lng])) return;

                const containerPoint = this.windMap.latLngToContainerPoint([lat, lng]);
                
                if (isFirst) {
                    this.windCtx.moveTo(containerPoint.x, containerPoint.y);
                    isFirst = false;
                } else {
                    this.windCtx.lineTo(containerPoint.x, containerPoint.y);
                }
            });

            this.windCtx.strokeStyle = 'rgba(33, 128, 141, 0.6)';
            this.windCtx.lineWidth = 1.5;
            this.windCtx.stroke();
        });
    }

    renderWindHeatmap() {
        if (!this.windData.magnitude_grid) return;

        const bounds = this.windMap.getBounds();
        const grid = this.windData.magnitude_grid;
        const gridBounds = this.getGridBounds();

        // Create heatmap using ImageData
        const imageData = this.windCtx.createImageData(this.windCanvas.width, this.windCanvas.height);
        const data = imageData.data;

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const magnitude = grid[y][x];
                const lat = gridBounds.north - (y / grid.length) * (gridBounds.north - gridBounds.south);
                const lng = gridBounds.west + (x / grid[y].length) * (gridBounds.east - gridBounds.west);

                if (!bounds.contains([lat, lng])) continue;

                const point = this.windMap.latLngToContainerPoint([lat, lng]);
                const pixelIndex = (Math.floor(point.y) * this.windCanvas.width + Math.floor(point.x)) * 4;

                if (pixelIndex >= 0 && pixelIndex < data.length - 4) {
                    const color = this.getWindColorRGB(magnitude);
                    data[pixelIndex] = color.r;
                    data[pixelIndex + 1] = color.g;
                    data[pixelIndex + 2] = color.b;
                    data[pixelIndex + 3] = Math.floor(this.state.opacity * 2.55);
                }
            }
        }

        this.windCtx.putImageData(imageData, 0, 0);
    }

    startParticleAnimation() {
        if (this.renderingActive) return;
        
        this.initializeParticles();
        this.renderingActive = true;
        this.animateParticles();
    }

    initializeParticles() {
        this.particles = [];
        const bounds = this.windMap.getBounds();

        for (let i = 0; i < this.state.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.windCanvas.width,
                y: Math.random() * this.windCanvas.height,
                age: Math.random() * 100,
                maxAge: 100 + Math.random() * 100
            });
        }
    }

    animateParticles() {
        if (!this.renderingActive || this.state.vizMode !== 'particles') {
            this.renderingActive = false;
            return;
        }

        this.clearCanvas();
        this.updateParticles();
        this.drawParticles();

        this.animationFrame = requestAnimationFrame(() => this.animateParticles());
    }

    updateParticles() {
        if (!this.windData || !this.windData.vector_field) return;

        this.particles.forEach(particle => {
            // Get wind vector at particle position
            const windVector = this.getWindAtPosition(particle.x, particle.y);
            
            if (windVector) {
                particle.x += windVector.vx * 0.5;
                particle.y += windVector.vy * 0.5;
            }

            particle.age++;

            // Reset particle if it's too old or out of bounds
            if (particle.age > particle.maxAge || 
                particle.x < 0 || particle.x > this.windCanvas.width ||
                particle.y < 0 || particle.y > this.windCanvas.height) {
                particle.x = Math.random() * this.windCanvas.width;
                particle.y = Math.random() * this.windCanvas.height;
                particle.age = 0;
                particle.maxAge = 100 + Math.random() * 100;
            }
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            const opacity = 1 - (particle.age / particle.maxAge);
            this.windCtx.fillStyle = `rgba(33, 128, 141, ${opacity * 0.8})`;
            this.windCtx.beginPath();
            this.windCtx.arc(particle.x, particle.y, 1, 0, Math.PI * 2);
            this.windCtx.fill();
        });
    }

    // ===== BUILDING AND TERRAIN LAYERS =====

    renderBuildingsLayer() {
        if (!this.buildingsData || !this.windMap) return;

        if (this.buildingsLayer) {
            this.windMap.removeLayer(this.buildingsLayer);
        }

        this.buildingsLayer = L.geoJSON(this.buildingsData, {
            style: {
                color: '#8B4513',
                weight: 2,
                fillColor: '#D2691E',
                fillOpacity: 0.7
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    layer.bindPopup(`
                        <div class="building-popup">
                            <h4>Budynek</h4>
                            <p><strong>Wysokość:</strong> ${feature.properties.height || 'N/A'} m</p>
                            <p><strong>Typ:</strong> ${feature.properties.type || 'Nieznany'}</p>
                        </div>
                    `);
                }
            }
        }).addTo(this.windMap);
    }

    renderTerrainLayer() {
        if (!this.terrainData || !this.windMap) return;

        if (this.terrainLayer) {
            this.windMap.removeLayer(this.terrainLayer);
        }

        // Add terrain as heatmap or contour lines
        this.terrainLayer = L.geoJSON(this.terrainData, {
            style: (feature) => ({
                color: this.getElevationColor(feature.properties.elevation),
                weight: 1,
                fillOpacity: 0.3
            })
        }).addTo(this.windMap);
    }

    // ===== UTILITY FUNCTIONS =====

    getWindColor(magnitude) {
        const colors = this.config.visualization.colorSchemes.magnitude;
        const normalized = Math.min(magnitude / 10, 1); // Normalize to 0-1
        const index = Math.floor(normalized * (colors.length - 1));
        return colors[index];
    }

    getWindColorRGB(magnitude) {
        const color = this.getWindColor(magnitude);
        // Convert hex to RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { r, g, b };
    }

    getElevationColor(elevation) {
        const colors = this.config.visualization.colorSchemes.elevation;
        const normalized = Math.min(elevation / 100, 1); // Normalize to 0-1
        const index = Math.floor(normalized * (colors.length - 1));
        return colors[index];
    }

    getWindAtPosition(canvasX, canvasY) {
        if (!this.windData || !this.windData.vector_field) return null;

        // Convert canvas coordinates to grid coordinates
        const bounds = this.windMap.getBounds();
        const containerPoint = L.point(canvasX, canvasY);
        const latlng = this.windMap.containerPointToLatLng(containerPoint);

        const gridBounds = this.getGridBounds();
        const gridX = Math.floor(((latlng.lng - gridBounds.west) / (gridBounds.east - gridBounds.west)) * this.getGridWidth());
        const gridY = Math.floor(((gridBounds.north - latlng.lat) / (gridBounds.north - gridBounds.south)) * this.getGridHeight());

        // Find closest vector
        let closestVector = null;
        let minDistance = Infinity;

        this.windData.vector_field.forEach(vector => {
            const distance = Math.sqrt(Math.pow(vector.x - gridX, 2) + Math.pow(vector.y - gridY, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestVector = vector;
            }
        });

        return closestVector;
    }

    getGridBounds() {
        // This should be derived from your actual simulation bounds
        return {
            north: 54.18,
            south: 54.14,
            east: 19.45,
            west: 19.35
        };
    }

    getGridWidth() {
        return this.windData?.metadata?.grid_width || 750;
    }

    getGridHeight() {
        return this.windData?.metadata?.grid_height || 500;
    }

    // ===== EVENT HANDLERS =====

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const module = button.dataset.module;
                this.switchModule(module);
            });
        });

        // Visualization controls
        const vizModeSelect = document.getElementById('viz-mode');
        if (vizModeSelect) {
            vizModeSelect.addEventListener('change', (e) => {
                this.state.vizMode = e.target.value;
                this.renderWindVisualization();
            });
        }

        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.state.opacity = parseInt(e.target.value);
                document.getElementById('opacity-value').textContent = `${this.state.opacity}%`;
                this.renderWindVisualization();
            });
        }

        // Layer toggles
        const buildingsToggle = document.getElementById('show-buildings');
        if (buildingsToggle) {
            buildingsToggle.addEventListener('change', (e) => {
                this.state.showBuildings = e.target.checked;
                if (this.state.showBuildings) {
                    this.renderBuildingsLayer();
                } else if (this.buildingsLayer) {
                    this.windMap.removeLayer(this.buildingsLayer);
                }
            });
        }

        const terrainToggle = document.getElementById('show-terrain');
        if (terrainToggle) {
            terrainToggle.addEventListener('change', (e) => {
                this.state.showTerrain = e.target.checked;
                if (this.state.showTerrain) {
                    this.renderTerrainLayer();
                } else if (this.terrainLayer) {
                    this.windMap.removeLayer(this.terrainLayer);
                }
            });
        }

        // Simulation controls
        const runSimButton = document.getElementById('run-simulation');
        if (runSimButton) {
            runSimButton.addEventListener('click', () => this.runSimulation());
        }

        const connectApiButton = document.getElementById('connect-api');
        if (connectApiButton) {
            connectApiButton.addEventListener('click', () => this.connectToAPI());
        }
    }

    // ===== DATA LOADING =====

    async loadSampleData() {
        console.log('📊 Loading sample wind simulation data...');
        
        // Create sample wind data for demonstration
        this.windData = this.generateSampleWindData();
        this.buildingsData = this.generateSampleBuildings();
        this.terrainData = this.generateSampleTerrain();

        this.state.lastUpdate = new Date();
        this.updateWindStatistics();
        
        if (this.state.currentModule === 'wind') {
            this.renderWindVisualization();
            if (this.state.showBuildings) this.renderBuildingsLayer();
            if (this.state.showTerrain) this.renderTerrainLayer();
        }

        console.log('✅ Sample data loaded');
    }

    generateSampleWindData() {
        // Generate sample vector field
        const vectors = [];
        const streamlines = [];
        const magnitude_grid = [];

        // Create a simple wind pattern with obstacles
        for (let y = 0; y < 50; y++) {
            const row = [];
            for (let x = 0; x < 75; x++) {
                // Simulate wind from west to east with some variation
                let vx = 3 + Math.sin(y * 0.1) * 0.5;
                let vy = Math.cos(x * 0.1) * 0.3;
                
                // Add obstacle effect (simple building at center)
                if (x > 35 && x < 40 && y > 20 && y < 30) {
                    vx = 0; vy = 0; // Inside building
                } else if (x > 33 && x < 42 && y > 18 && y < 32) {
                    // Around building - create wake effect
                    vx *= 0.3;
                    vy += (y - 25) * 0.2;
                }

                const magnitude = Math.sqrt(vx * vx + vy * vy);
                row.push(magnitude);

                if (x % 3 === 0 && y % 3 === 0) {
                    vectors.push({
                        x: x,
                        y: y,
                        vx: vx,
                        vy: vy,
                        magnitude: magnitude
                    });
                }
            }
            magnitude_grid.push(row);
        }

        // Generate sample streamlines
        for (let i = 0; i < 20; i++) {
            const streamline = [];
            let x = Math.random() * 75;
            let y = Math.random() * 50;

            for (let j = 0; j < 30; j++) {
                streamline.push({
                    x: x,
                    y: y,
                    speed: 3 + Math.random()
                });
                x += 2.5;
                y += (Math.random() - 0.5) * 0.5;
                if (x > 75) break;
            }
            streamlines.push(streamline);
        }

        return {
            metadata: {
                version: "2.4.0",
                timestamp: Date.now(),
                grid_width: 75,
                grid_height: 50
            },
            vector_field: vectors,
            streamlines: streamlines,
            magnitude_grid: magnitude_grid,
            flow_statistics: {
                mean_magnitude: 3.2,
                max_magnitude: 4.8,
                min_magnitude: 0.0,
                turbulence_intensity: 0.15
            }
        };
    }

    generateSampleBuildings() {
        return {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {
                        height: 25,
                        type: "Residential"
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [19.39, 54.165],
                            [19.392, 54.165],
                            [19.392, 54.163],
                            [19.39, 54.163],
                            [19.39, 54.165]
                        ]]
                    }
                },
                {
                    type: "Feature",
                    properties: {
                        height: 15,
                        type: "Commercial"
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [19.395, 54.162],
                            [19.398, 54.162],
                            [19.398, 54.159],
                            [19.395, 54.159],
                            [19.395, 54.162]
                        ]]
                    }
                }
            ]
        };
    }

    generateSampleTerrain() {
        return {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {
                        elevation: 45
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [19.385, 54.17],
                            [19.405, 54.17],
                            [19.405, 54.15],
                            [19.385, 54.15],
                            [19.385, 54.17]
                        ]]
                    }
                }
            ]
        };
    }

    // ===== UI UPDATES =====

    updateWindStatistics() {
        if (!this.windData || !this.windData.flow_statistics) return;

        const stats = this.windData.flow_statistics;
        
        document.getElementById('mean-speed').textContent = `${stats.mean_magnitude.toFixed(1)} m/s`;
        document.getElementById('max-speed').textContent = `${stats.max_magnitude.toFixed(1)} m/s`;
        document.getElementById('turbulence').textContent = `${(stats.turbulence_intensity * 100).toFixed(1)}%`;
        
        // Update progress bars
        const meanSpeedBar = document.querySelector('.speed-progress');
        if (meanSpeedBar) {
            meanSpeedBar.style.width = `${(stats.mean_magnitude / 10) * 100}%`;
        }
    }

    switchModule(module) {
        // Hide all modules
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));

        // Show selected module
        document.getElementById(`${module}-module`).classList.add('active');
        document.querySelector(`[data-module="${module}"]`).classList.add('active');

        this.state.currentModule = module;

        // Initialize module-specific functionality
        if (module === 'wind' && this.windMap) {
            setTimeout(() => {
                this.windMap.invalidateSize();
                this.renderWindVisualization();
            }, 100);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
                ${message}
            </div>
        `;

        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    }

    updateUI() {
        // Update connection status
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = this.state.apiConnected ? 'Połączono' : 'Rozłączono';
            statusElement.className = `status ${this.state.apiConnected ? 'status--success' : 'status--error'}`;
        }

        // Update last update time
        const lastUpdateElement = document.getElementById('last-update');
        if (lastUpdateElement && this.state.lastUpdate) {
            lastUpdateElement.textContent = this.state.lastUpdate.toLocaleString('pl-PL');
        }
    }

    showConnectionOption() {
        const connectBtn = document.getElementById('connect-api');
        if (connectBtn) {
            connectBtn.style.display = 'inline-flex';
        }
    }

    async connectToAPI() {
        this.showToast('Łączenie z API...', 'info');
        // Implement actual API connection logic here
        setTimeout(() => {
            this.state.apiConnected = true;
            this.updateUI();
            this.showToast('Połączono z API', 'success');
        }, 2000);
    }

    async runSimulation() {
        this.showToast('Rozpoczynanie symulacji...', 'info');
        this.state.isLoading = true;
        
        // Simulate API call
        setTimeout(() => {
            this.loadSampleData();
            this.state.isLoading = false;
            this.showToast('Symulacja zakończona pomyślnie', 'success');
        }, 3000);
    }

    // Add location markers (existing functionality)
    addLocationMarkers() {
        if (!this.dashboardMap) return;

        this.config.mapConfig.locations.forEach(location => {
            const icon = this.createLocationIcon(location.status);
            const marker = L.marker(location.coords, { icon }).addTo(this.dashboardMap);

            const popupContent = `
            <div class="location-popup">
              <h4>${location.name}</h4>
              <p>${location.description}</p>
              <div class="popup-details">
                <div class="detail-item">
                  <strong>Status:</strong> 
                  <span class="status ${location.status}">${location.status}</span>
                </div>
                <div class="detail-item">
                  <strong>Jakość danych:</strong> 
                  <span class="quality-${location.dataQuality || 'unknown'}">${location.dataQuality || 'Brak danych'}</span>
                </div>
              </div>
            </div>`;

            marker.bindPopup(popupContent);
        });
    }

    createLocationIcon(status) {
        const iconClass = status === 'active' ? 'active' : 'planned';
        const iconHtml = `<div class="custom-marker ${iconClass}">📍</div>`;

        return L.divIcon({
            html: iconHtml,
            className: 'marker-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.gisApp = new GISMicroclimateUpgrade();
});
