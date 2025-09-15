// Professional GIS Microclimate Platform - Upgraded Edition
// Version: 2.3.0 - Enhanced with Leaflet OSM integration and advanced wind visualization

class GISMicroclimateUpgrade {
    constructor() {
        this.config = {
            apiConfig: {
                githubBaseUrl: "https://api.github.com/repos",
                defaultRepo: "dawidsajewski12-creator/gis-microclimate-platform",
                endpoints: {
                    windSimulation: "api/data/wind_simulation/current.json",
                    systemMetadata: "api/data/system/metadata.json"
                },
                refreshInterval: 30000,
                timeout: 5000
            },
            mapConfig: {
                center: [54.16, 19.40], // Centrala lokalizacja (Gdańsk region example)
                zoom: 10,
                minZoom: 8,
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
                    },
                    {
                        id: 'loc2', 
                        name: 'Park Miejski - Strefa Zieleni',
                        coords: [54.18, 19.35],
                        status: 'planned',
                        description: 'Planowana analiza wpływu zieleni na mikroklimat',
                        lastUpdate: null,
                        dataQuality: null
                    }
                ]
            },
            visualization: {
                defaultOpacity: 80,
                defaultMode: 'particles',
                particleCount: 5000,
                streamlineCount: 200,
                colorSchemes: {
                    magnitude: 'viridis',
                    temperature: 'plasma'
                }
            }
        };

        this.state = {
            currentModule: 'dashboard',
            isLoading: false,
            apiConnected: false,
            lastUpdate: null,
            windData: null,
            autoRefreshEnabled: false,
            refreshTimer: null,
            vizMode: 'particles',
            opacity: 80,
            particleCount: 5000
        };

        // Map instances
        this.dashboardMap = null;
        this.windMap = null;
        this.windCanvas = null;
        this.windCtx = null;
        
        // Particles and animation
        this.particles = [];
        this.streamlines = [];
        this.animationFrame = null;
        this.buildings = [];

        this.init();
    }

    // Initialize application
    async init() {
        console.log('🚀 Initializing GIS Microclimate Platform Upgrade v2.3.0');
        try {
            this.setupEventListeners();
            this.initializeDashboardMap();
            this.loadSampleData();
            this.updateUI();
            this.showConnectionOption();
            console.log('✅ Platform upgraded and initialized');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showToast('Platform initialization failed', 'error');
        }
    }

    // Initialize dashboard map with locations
    initializeDashboardMap() {
        const mapElement = document.getElementById('dashboard-map');
        if (!mapElement) return;

        // Create dashboard map
        this.dashboardMap = L.map('dashboard-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.mapConfig.center, this.config.mapConfig.zoom);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.config.mapConfig.maxZoom
        }).addTo(this.dashboardMap);

        // Add custom zoom control
        L.control.zoom({ position: 'bottomright' }).addTo(this.dashboardMap);

        // Add location markers
        this.addLocationMarkers();

        console.log('✅ Dashboard map initialized');
    }

    // Add markers for research locations
    addLocationMarkers() {
        if (!this.dashboardMap) return;

        this.config.mapConfig.locations.forEach(location => {
            const icon = this.createLocationIcon(location.status);
            
            const marker = L.marker(location.coords, { icon })
                .addTo(this.dashboardMap);

            // Create popup content
            const popupContent = `
                <div class="location-popup">
                    <h4>${location.name}</h4>
                    <p>${location.description}</p>
                    <div class="popup-details">
                        <div class="detail-item">
                            <strong>Status:</strong> 
                            <span class="status ${location.status}">${location.status === 'active' ? 'Aktywny' : 'Planowany'}</span>
                        </div>
                        ${location.lastUpdate ? `
                            <div class="detail-item">
                                <strong>Ostatnia aktualizacja:</strong>
                                ${new Date(location.lastUpdate).toLocaleString('pl-PL')}
                            </div>
                        ` : ''}
                        ${location.dataQuality ? `
                            <div class="detail-item">
                                <strong>Jakość danych:</strong> 
                                <span class="quality-${location.dataQuality}">${location.dataQuality === 'high' ? 'Wysoka' : 'Średnia'}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${location.status === 'active' ? `
                        <button class="btn btn-primary btn-sm" onclick="app.viewLocationDetails('${location.id}')">
                            <i class="fas fa-eye"></i> Zobacz szczegóły
                        </button>
                    ` : ''}
                </div>
            `;

            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });
        });
    }

    // Create custom icon for location markers
    createLocationIcon(status) {
        const color = status === 'active' ? '#32a852' : '#ff9800';
        const iconHtml = `
            <div class="custom-marker ${status}">
                <i class="fas fa-${status === 'active' ? 'broadcast-tower' : 'clock'}"></i>
            </div>
        `;

        return L.divIcon({
            html: iconHtml,
            className: 'marker-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });
    }

    // Initialize wind visualization map
    async initializeWindMap() {
        console.log('🗺️ Initializing wind visualization map...');
        
        const mapElement = document.getElementById('wind-map');
        if (!mapElement) return;

        // Create wind map
        this.windMap = L.map('wind-map', {
            zoomControl: true,
            attributionControl: true
        }).setView([54.16, 19.40], 15);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.windMap);

        // Load and display buildings
        await this.loadBuildingsData();

        // Setup canvas overlay for particles and streamlines
        this.setupWindCanvas();

        console.log('✅ Wind map initialized');
    }

    // Load buildings data from OpenStreetMap Overpass API
    async loadBuildingsData() {
        console.log('🏢 Loading buildings data...');
        
        try {
            // Sample buildings data (in real implementation, use Overpass API)
            const buildingsData = this.generateSampleBuildingsData();
            
            // Create buildings layer
            this.buildingsLayer = L.geoJSON(buildingsData, {
                style: {
                    color: '#666',
                    weight: 1,
                    fillColor: '#999',
                    fillOpacity: 0.6
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        layer.bindPopup(`
                            <strong>Budynek</strong><br>
                            Typ: ${feature.properties.type || 'Nieznany'}<br>
                            Powierzchnia: ${feature.properties.area || 'N/A'} m²
                        `);
                    }
                }
            }).addTo(this.windMap);

            console.log('✅ Buildings data loaded');
        } catch (error) {
            console.error('❌ Failed to load buildings:', error);
        }
    }

    // Generate sample buildings data (GeoJSON)
    generateSampleBuildingsData() {
        const buildings = {
            type: 'FeatureCollection',
            features: []
        };

        // Generate sample rectangular buildings
        const centerLat = 54.16;
        const centerLng = 19.40;
        const buildingCount = 50;

        for (let i = 0; i < buildingCount; i++) {
            const offsetLat = (Math.random() - 0.5) * 0.01;
            const offsetLng = (Math.random() - 0.5) * 0.01;
            const size = 0.0005 + Math.random() * 0.001;

            const lat = centerLat + offsetLat;
            const lng = centerLng + offsetLng;

            buildings.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [lng - size, lat - size],
                        [lng + size, lat - size],
                        [lng + size, lat + size],
                        [lng - size, lat + size],
                        [lng - size, lat - size]
                    ]]
                },
                properties: {
                    type: 'residential',
                    area: Math.round(size * 111000 * size * 111000), // Approximate area in m²
                    height: 10 + Math.random() * 20
                }
            });
        }

        return buildings;
    }

    // Setup wind canvas overlay
    setupWindCanvas() {
        this.windCanvas = document.getElementById('wind-canvas');
        if (!this.windCanvas) return;

        this.windCtx = this.windCanvas.getContext('2d');
        this.resizeWindCanvas();

        // Setup particles
        this.initializeParticles();

        // Start animation
        this.startWindAnimation();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeWindCanvas();
        });

        // Handle map events
        this.windMap.on('zoomend moveend', () => {
            this.updateParticlePositions();
        });

        console.log('✅ Wind canvas overlay setup complete');
    }

    // Resize wind canvas
    resizeWindCanvas() {
        if (!this.windCanvas || !this.windMap) return;

        const mapContainer = this.windMap.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        
        this.windCanvas.width = rect.width;
        this.windCanvas.height = rect.height;
        this.windCanvas.style.width = rect.width + 'px';
        this.windCanvas.style.height = rect.height + 'px';
    }

    // Initialize particles for wind visualization
    initializeParticles() {
        this.particles = [];
        const count = this.state.particleCount;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.windCanvas.width,
                y: Math.random() * this.windCanvas.height,
                vx: 0,
                vy: 0,
                age: 0,
                maxAge: 100 + Math.random() * 100,
                opacity: 0.8
            });
        }

        console.log(`✅ ${count} particles initialized`);
    }

    // Update particle positions based on wind data
    updateParticlePositions() {
        if (!this.state.windData || !this.windMap) return;

        const mapBounds = this.windMap.getBounds();
        const mapSize = this.windMap.getSize();

        this.particles.forEach(particle => {
            // Get wind velocity at particle position
            const velocity = this.getWindVelocityAtPosition(particle.x, particle.y, mapBounds, mapSize);
            
            if (velocity) {
                particle.vx = velocity.vx * 2; // Scale for visibility
                particle.vy = velocity.vy * 2;
            }

            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Age particle
            particle.age++;

            // Reset particle if too old or out of bounds
            if (particle.age > particle.maxAge || 
                particle.x < 0 || particle.x > this.windCanvas.width ||
                particle.y < 0 || particle.y > this.windCanvas.height) {
                
                particle.x = Math.random() * this.windCanvas.width;
                particle.y = Math.random() * this.windCanvas.height;
                particle.age = 0;
                particle.vx = 0;
                particle.vy = 0;
            }

            // Update opacity based on age
            particle.opacity = Math.max(0.1, 1 - particle.age / particle.maxAge);
        });
    }

    // Get wind velocity at specific position
    getWindVelocityAtPosition(canvasX, canvasY, mapBounds, mapSize) {
        if (!this.state.windData?.vector_field) return null;

        // Convert canvas position to map coordinates
        const lat = mapBounds.getNorth() - (canvasY / mapSize.y) * (mapBounds.getNorth() - mapBounds.getSouth());
        const lng = mapBounds.getWest() + (canvasX / mapSize.x) * (mapBounds.getEast() - mapBounds.getWest());

        // Convert to grid coordinates
        const gridX = Math.floor((lng - 19.35) / (19.45 - 19.35) * 850);
        const gridY = Math.floor((54.17 - lat) / (54.17 - 54.15) * 680);

        // Find nearest vector
        const nearestVector = this.findNearestVector(gridX, gridY);
        return nearestVector ? { vx: nearestVector.vx, vy: nearestVector.vy } : null;
    }

    // Generate streamlines from wind data
    generateStreamlines() {
        if (!this.state.windData?.vector_field) return;

        this.streamlines = [];
        const streamlineCount = 200;
        const maxPoints = 50;

        for (let i = 0; i < streamlineCount; i++) {
            const streamline = [];
            let x = Math.random() * 850;
            let y = Math.random() * 680;

            for (let j = 0; j < maxPoints; j++) {
                const velocity = this.findNearestVector(x, y);
                if (!velocity || velocity.magnitude < 0.1) break;

                streamline.push({ x, y });

                // Move to next position
                x += velocity.vx * 2;
                y += velocity.vy * 2;

                // Stop if out of bounds
                if (x < 0 || x > 850 || y < 0 || y > 680) break;
            }

            if (streamline.length > 5) {
                this.streamlines.push(streamline);
            }
        }

        console.log(`✅ Generated ${this.streamlines.length} streamlines`);
    }

    // Start wind animation loop
    startWindAnimation() {
        const animate = () => {
            this.updateWindVisualization();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    // Update wind visualization
    updateWindVisualization() {
        if (!this.windCtx || !this.windCanvas) return;

        // Clear canvas
        this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);

        const vizMode = this.state.vizMode;
        const opacity = this.state.opacity / 100;

        // Update particles
        this.updateParticlePositions();

        // Render based on selected visualization mode
        switch (vizMode) {
            case 'particles':
                this.renderParticles(opacity);
                break;
            case 'streamlines':
                this.renderStreamlines(opacity);
                break;
            case 'magnitude':
                this.renderMagnitudeField(opacity);
                break;
            case 'combined':
                this.renderParticles(opacity * 0.7);
                this.renderStreamlines(opacity * 0.5);
                break;
        }
    }

    // Render particles
    renderParticles(opacity) {
        this.windCtx.save();
        this.windCtx.globalAlpha = opacity;

        this.particles.forEach(particle => {
            const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
            const color = this.getColorFromSpeed(speed);

            this.windCtx.fillStyle = color;
            this.windCtx.globalAlpha = particle.opacity * opacity;
            this.windCtx.beginPath();
            this.windCtx.arc(particle.x, particle.y, 1.5, 0, Math.PI * 2);
            this.windCtx.fill();
        });

        this.windCtx.restore();
    }

    // Render streamlines
    renderStreamlines(opacity) {
        if (!this.streamlines.length) return;

        this.windCtx.save();
        this.windCtx.globalAlpha = opacity;
        this.windCtx.strokeStyle = '#00ff88';
        this.windCtx.lineWidth = 1;

        this.streamlines.forEach(streamline => {
            if (streamline.length < 2) return;

            // Convert grid coordinates to canvas coordinates
            const mapBounds = this.windMap.getBounds();
            const mapSize = this.windMap.getSize();

            this.windCtx.beginPath();
            
            streamline.forEach((point, index) => {
                // Convert grid to lat/lng
                const lat = 54.17 - (point.y / 680) * (54.17 - 54.15);
                const lng = 19.35 + (point.x / 850) * (19.45 - 19.35);

                // Convert lat/lng to canvas coordinates
                const canvasX = ((lng - mapBounds.getWest()) / (mapBounds.getEast() - mapBounds.getWest())) * mapSize.x;
                const canvasY = ((mapBounds.getNorth() - lat) / (mapBounds.getNorth() - mapBounds.getSouth())) * mapSize.y;

                if (index === 0) {
                    this.windCtx.moveTo(canvasX, canvasY);
                } else {
                    this.windCtx.lineTo(canvasX, canvasY);
                }
            });

            this.windCtx.stroke();
        });

        this.windCtx.restore();
    }

    // Render magnitude field
    renderMagnitudeField(opacity) {
        if (!this.state.windData?.magnitude_grid) return;

        this.windCtx.save();
        this.windCtx.globalAlpha = opacity;

        const mapBounds = this.windMap.getBounds();
        const mapSize = this.windMap.getSize();
        const grid = this.state.windData.magnitude_grid;
        
        const cellWidth = mapSize.x / 850;
        const cellHeight = mapSize.y / 680;

        for (let y = 0; y < 680; y += 5) {
            for (let x = 0; x < 850; x += 5) {
                if (grid[y] && grid[y][x] !== undefined) {
                    const magnitude = grid[y][x];
                    const color = this.getColorFromSpeed(magnitude);
                    
                    this.windCtx.fillStyle = color;
                    this.windCtx.fillRect(
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth * 5,
                        cellHeight * 5
                    );
                }
            }
        }

        this.windCtx.restore();
    }

    // Get color based on wind speed
    getColorFromSpeed(speed) {
        // Viridis-like color scale
        const normalizedSpeed = Math.min(speed / 8.5, 1);
        
        if (normalizedSpeed < 0.25) {
            return `rgba(68, 1, 84, ${0.3 + normalizedSpeed * 0.7})`;
        } else if (normalizedSpeed < 0.5) {
            return `rgba(65, 68, 135, ${0.3 + normalizedSpeed * 0.7})`;
        } else if (normalizedSpeed < 0.75) {
            return `rgba(42, 120, 142, ${0.3 + normalizedSpeed * 0.7})`;
        } else {
            return `rgba(34, 197, 132, ${0.3 + normalizedSpeed * 0.7})`;
        }
    }

    // Find nearest vector to a point
    findNearestVector(x, y) {
        if (!this.state.windData?.vector_field) return null;

        let nearest = null;
        let minDistance = Infinity;

        for (const vector of this.state.windData.vector_field) {
            const distance = Math.sqrt((vector.x - x) ** 2 + (vector.y - y) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = vector;
            }
        }

        return nearest;
    }

    // View location details
    viewLocationDetails(locationId) {
        const location = this.config.mapConfig.locations.find(loc => loc.id === locationId);
        if (!location) return;

        // Switch to wind module and focus on this location
        this.switchModule('wind');
        
        setTimeout(() => {
            if (this.windMap) {
                this.windMap.setView(location.coords, 16);
            }
        }, 100);

        this.showToast(`Przechodzenie do analizy: ${location.name}`, 'info');
    }

    // Manual API connection method (same as original)
    async connectToAPI() {
        this.showLoading(true);
        this.showToast('Connecting to live data from GitHub Pages...', 'info');
        
        try {
            const success = await this.loadWindDataFromAPI();
            if (success) {
                this.state.apiConnected = true;
                this.updateUI();
                this.startAutoRefresh();
                this.showToast('Successfully connected to live data!', 'success');
                this.updateConnectionStatus('connected');
                
                if (this.state.currentModule === 'wind') {
                    setTimeout(() => this.initializeWindMap(), 100);
                }
            } else {
                throw new Error('Failed to load live data from API');
            }
        } catch (error) {
            console.error('Failed to connect to API:', error);
            this.showToast('Failed to connect to live data. Continuing with sample data.', 'warning');
            this.updateConnectionStatus('failed');
        }

        this.showLoading(false);
    }

    // Show connection option
    showConnectionOption() {
        const statusElement = document.getElementById('api-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <i class="fas fa-circle status-warning"></i>
                <span>Sample Mode</span>
                <button class="btn btn-sm btn-primary" onclick="app.connectToAPI()" style="margin-left: 10px;">
                    <i class="fas fa-plug"></i> Połącz
                </button>
            `;
        }
    }

    // Load wind data from API (same as original)
    async loadWindDataFromAPI() {
        const repoOwner = this.getRepoOwner();
        const repoName = this.getRepoName();
        const url = `https://${repoOwner}.github.io/${repoName}/${this.config.apiConfig.endpoints.windSimulation}`;
        
        try {
            console.log(`🌐 Loading live data from: ${url}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.apiConfig.timeout);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                if (this.validateWindData(data)) {
                    this.state.windData = data;
                    this.state.lastUpdate = new Date();
                    console.log('✅ Live wind data loaded successfully:', data.metadata);
                    return true;
                } else {
                    console.warn('⚠️ Invalid data structure received from API');
                    return false;
                }
            } else {
                console.warn(`❌ API returned status ${response.status}: ${response.statusText}`);
                return false;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('❌ API request timeout');
            } else {
                console.error('❌ API loading error:', error.message);
            }
            return false;
        }
    }

    // Validate wind data structure
    validateWindData(data) {
        const requiredFields = [
            'metadata',
            'grid_properties', 
            'flow_statistics',
            'weather_conditions',
            'vector_field'
        ];
        return requiredFields.every(field => field in data);
    }

    // Get repository owner from config
    getRepoOwner() {
        return this.config.apiConfig.defaultRepo.split('/')[0];
    }

    // Get repository name from config
    getRepoName() {
        return this.config.apiConfig.defaultRepo.split('/')[1];
    }

    // Load sample data
    loadSampleData() {
        this.state.windData = {
            metadata: {
                timestamp: new Date().toISOString(),
                module: "wind_simulation",
                version: "2.3.0",
                computation_time: 45.2,
                platform: "sample_data_mode"
            },
            configuration: {
                location: {
                    latitude: 54.16,
                    longitude: 19.40
                }
            },
            grid_properties: {
                width: 850,
                height: 680,
                bounds: [[54.15, 19.35], [54.17, 19.45]],
                obstacle_count: 1250,
                buildings_count: 2556,
                pixel_size_m: 2.5
            },
            flow_statistics: {
                min_magnitude: 0.2,
                max_magnitude: 8.5,
                mean_magnitude: 3.8,
                std_magnitude: 1.9,
                median_magnitude: 3.5,
                percentile_95: 7.2,
                percentile_05: 0.8
            },
            weather_conditions: {
                wind_speed_ms: 4.2,
                wind_direction_deg: 225,
                temperature_c: 18.5,
                humidity_percent: 65,
                source: "sample-data",
                timestamp: new Date().toISOString()
            },
            vector_field: this.generateSampleVectorField(),
            magnitude_grid: this.generateSampleMagnitudeGrid()
        };

        this.state.lastUpdate = new Date();
        console.log('📊 Enhanced sample data loaded successfully');
    }

    // Generate sample vector field (same as original)
    generateSampleVectorField() {
        const vectors = [];
        const gridSize = 20;
        const windDirection = Math.PI * 1.25; // 225 degrees

        for (let x = 0; x < 850; x += gridSize) {
            for (let y = 0; y < 680; y += gridSize) {
                const centerX = 425;
                const centerY = 340;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let angle = windDirection + Math.sin(distance * 0.01) * 0.3;
                
                if (distance < 100) {
                    angle += Math.PI * 0.2 * Math.sin(Math.atan2(dy, dx) * 3);
                }

                let magnitude = Math.max(0.5, 6.0 - distance * 0.008 + Math.random() * 0.5);
                magnitude *= (0.8 + 0.4 * Math.sin(x * 0.02) * Math.cos(y * 0.02));

                const vx = Math.cos(angle) * magnitude;
                const vy = Math.sin(angle) * magnitude;

                vectors.push({
                    x: x,
                    y: y,
                    vx: parseFloat(vx.toFixed(4)),
                    vy: parseFloat(vy.toFixed(4)),
                    magnitude: parseFloat(magnitude.toFixed(4))
                });
            }
        }

        console.log(`📈 Generated ${vectors.length} sample vectors`);
        return vectors;
    }

    // Generate sample magnitude grid
    generateSampleMagnitudeGrid() {
        const grid = [];
        for (let y = 0; y < 680; y++) {
            grid[y] = [];
            for (let x = 0; x < 850; x++) {
                const centerX = 425;
                const centerY = 340;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                let magnitude = Math.max(0.2, 6.0 - distance * 0.008 + Math.random() * 0.5);
                magnitude *= (0.8 + 0.4 * Math.sin(x * 0.02) * Math.cos(y * 0.02));
                
                grid[y][x] = parseFloat(magnitude.toFixed(4));
            }
        }
        return grid;
    }

    // Setup event listeners
    setupEventListeners() {
        // Navigation menu items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const module = item.dataset.module;
                if (module) {
                    this.switchModule(module);
                }
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.state.apiConnected) {
                    this.refreshData();
                } else {
                    this.connectToAPI();
                }
            });
        }

        // Export button
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.showExportDialog();
            });
        }

        // Visualization controls
        const vizMode = document.getElementById('viz-mode');
        if (vizMode) {
            vizMode.addEventListener('change', (e) => {
                this.state.vizMode = e.target.value;
                if (e.target.value === 'streamlines' && !this.streamlines.length) {
                    this.generateStreamlines();
                }
            });
        }

        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.state.opacity = parseInt(e.target.value);
                const rangeValue = document.querySelector('.range-value');
                if (rangeValue) rangeValue.textContent = `${e.target.value}%`;
            });
        }

        const particleCount = document.getElementById('particle-count');
        if (particleCount) {
            particleCount.addEventListener('change', (e) => {
                this.state.particleCount = parseInt(e.target.value);
                if (this.particles.length > 0) {
                    this.initializeParticles();
                }
            });
        }

        // Reset view button
        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                if (this.windMap) {
                    this.windMap.setView([54.16, 19.40], 15);
                }
            });
        }

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('open');
                }
            });
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.state.autoRefreshEnabled = e.target.checked;
                if (this.state.apiConnected) {
                    if (this.state.autoRefreshEnabled) {
                        this.startAutoRefresh();
                    } else {
                        this.stopAutoRefresh();
                    }
                }
            });
        }
    }

    // Switch between application modules
    switchModule(moduleId) {
        console.log(`🔄 Switching to module: ${moduleId}`);
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-module="${moduleId}"]`)?.classList.add('active');

        // Update content visibility
        document.querySelectorAll('.module').forEach(module => {
            module.classList.remove('active');
        });
        document.getElementById(`${moduleId}-module`)?.classList.add('active');

        // Update breadcrumbs
        this.updateBreadcrumbs(moduleId);
        this.state.currentModule = moduleId;

        // Module-specific initialization
        this.initializeModule(moduleId);
    }

    // Update breadcrumb navigation
    updateBreadcrumbs(moduleId) {
        const moduleNames = {
            dashboard: 'Dashboard',
            wind: 'Analiza Wiatru',
            vegetation: 'Analiza Wegetacji',
            thermal: 'Komfort Termiczny',
            scenarios: 'Zarządzanie Scenariuszami',
            export: 'Eksport i Raporty'
        };

        const breadcrumbs = document.getElementById('breadcrumbs');
        if (breadcrumbs) {
            breadcrumbs.innerHTML = `<span class="breadcrumb-item active">${moduleNames[moduleId]}</span>`;
        }
    }

    // Initialize specific module
    async initializeModule(moduleId) {
        switch (moduleId) {
            case 'wind':
                if (!this.windMap) {
                    await this.initializeWindMap();
                }
                break;
            case 'vegetation':
                this.showModuleComingSoon('Analiza Wegetacji');
                break;
            case 'thermal':
                this.showModuleComingSoon('Komfort Termiczny');
                break;
            case 'scenarios':
                this.showModuleComingSoon('Zarządzanie Scenariuszami');
                break;
            case 'export':
                this.showModuleComingSoon('Eksport i Raporty');
                break;
        }
    }

    // Show "coming soon" message for future modules
    showModuleComingSoon(moduleName) {
        const moduleContent = document.getElementById(`${this.state.currentModule}-module`);
        if (moduleContent && !moduleContent.querySelector('.coming-soon')) {
            moduleContent.innerHTML = `
                <div class="coming-soon">
                    <i class="fas fa-tools fa-3x"></i>
                    <h3>${moduleName}</h3>
                    <p>Ten moduł jest obecnie w fazie rozwoju i będzie dostępny w przyszłych aktualizacjach.</p>
                    <p>Oczekujcie zaawansowanych możliwości ${moduleName.toLowerCase()}!</p>
                </div>
            `;
        }
    }

    // Utility methods (loading, toasts, etc. - same as original but adapted)
    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.add('active');
            } else {
                loadingOverlay.classList.remove('active');
            }
        }
        this.state.isLoading = show;
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        }[type] || 'fas fa-info-circle';

        toast.innerHTML = `
            <div class="toast-content">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);

        // Remove on click
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('api-status');
        if (!statusElement) return;
        
        switch (status) {
            case 'connected':
                statusElement.innerHTML = '<i class="fas fa-circle status-active"></i> <span>Live Data Connected</span>';
                break;
            case 'disconnected':
                this.showConnectionOption();
                break;
            case 'failed':
                statusElement.innerHTML = `
                    <i class="fas fa-circle status-error"></i>
                    <span>Connection Failed</span>
                    <button class="btn btn-sm btn-secondary" onclick="app.connectToAPI()" style="margin-left: 10px;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                `;
                break;
        }
    }

    updateUI() {
        // Update last update time if connected
        if (this.state.apiConnected && this.state.lastUpdate) {
            const timeElements = document.querySelectorAll('[data-update-time]');
            timeElements.forEach(element => {
                element.textContent = this.state.lastUpdate.toLocaleTimeString('pl-PL');
            });
        }
    }

    refreshData() {
        console.log('🔄 Refreshing data...');
        this.showToast('Refreshing data...', 'info');
        this.loadWindDataFromAPI();
    }

    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            if (this.state.apiConnected && this.state.autoRefreshEnabled) {
                this.refreshData();
            }
        }, this.config.apiConfig.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    showExportDialog() {
        this.showToast('Export functionality will be available in next update', 'info');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GISMicroclimateUpgrade();
});

// Global function for location details (called from map popups)
function viewLocationDetails(locationId) {
    if (window.app) {
        window.app.viewLocationDetails(locationId);
    }
}
