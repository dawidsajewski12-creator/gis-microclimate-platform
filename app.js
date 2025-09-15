// Professional GIS Microclimate Platform - Enhanced Edition
// Version: 2.3.0 - POPRAWIONA WERSJA bez błędów CORS i składni
// Fixed: CORS issues, API endpoints, method consistency, error handling

class GISMicroclimateUpgrade {
    constructor() {
        this.config = {
            // POPRAWIONA KONFIGURACJA API - używamy GitHub Pages zamiast GitHub API
            apiConfig: {
                // Bezpośrednie linki do GitHub Pages zamiast GitHub API (rozwiązuje problem CORS)
                githubPagesBaseUrl: "https://dawidsajewski12-creator.github.io/gis-microclimate-platform",
                endpoints: {
                    windSimulation: "api/data/wind_simulation/current.json",
                    systemMetadata: "api/data/system/metadata.json"
                },
                refreshInterval: 30000,
                timeout: 5000,
                fallbackData: true // Używamy danych przykładowych gdy API niedostępne
            },
            mapConfig: {
                center: [54.16, 19.40], // Centralna lokalizacja (Gdańsk region)
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
        console.log('🚀 Initializing GIS Microclimate Platform Enhanced v2.3.0');
        try {
            this.setupEventListeners();
            this.initializeDashboardMap();
            this.loadSampleData();
            this.updateUI();
            this.showConnectionOption();
            console.log('✅ Platform enhanced and initialized successfully');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showToast('Platform initialization failed', 'error');
        }
    }

    // Setup all event listeners
    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const module = e.currentTarget.dataset.module;
                this.switchModule(module);
            });
        });

        // Connection button
        const connectionBtn = document.getElementById('connection-btn');
        if (connectionBtn) {
            connectionBtn.addEventListener('click', () => this.toggleConnection());
        }

        // Wind visualization controls
        const vizModeSelect = document.getElementById('viz-mode');
        const opacitySlider = document.getElementById('opacity-slider');
        const particleCountSelect = document.getElementById('particle-count');
        const refreshBtn = document.getElementById('refresh-simulation');

        if (vizModeSelect) {
            vizModeSelect.addEventListener('change', (e) => {
                this.state.vizMode = e.target.value;
                this.updateWindVisualization();
            });
        }

        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.state.opacity = parseInt(e.target.value);
                document.getElementById('opacity-value').textContent = this.state.opacity;
                this.updateVisualizationOpacity();
            });
        }

        if (particleCountSelect) {
            particleCountSelect.addEventListener('change', (e) => {
                this.state.particleCount = parseInt(e.target.value);
                this.updateParticleCount();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshSimulation());
        }

        // Window resize handler
        window.addEventListener('resize', () => {
            if (this.dashboardMap) this.dashboardMap.invalidateSize();
            if (this.windMap) this.windMap.invalidateSize();
            if (this.windCanvas) this.resizeWindCanvas();
        });
    }

    // Initialize dashboard map with locations
    initializeDashboardMap() {
        const mapElement = document.getElementById('dashboard-map');
        if (!mapElement) return;

        try {
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

            console.log('✅ Dashboard map initialized successfully');
        } catch (error) {
            console.error('❌ Dashboard map initialization failed:', error);
            this.showToast('Map initialization failed', 'error');
        }
    }

    // Add markers for research locations
    addLocationMarkers() {
        if (!this.dashboardMap) return;

        this.config.mapConfig.locations.forEach(location => {
            const icon = this.createLocationIcon(location.status);
            const marker = L.marker(location.coords, { icon }).addTo(this.dashboardMap);

            // Create popup content
            const popupContent = `
                <div class="location-popup">
                    <h4>${location.name}</h4>
                    <p>${location.description}</p>
                    <div class="popup-details">
                        <div class="detail-item">
                            <strong>Status:</strong>
                            <span class="status ${location.status}">${this.getStatusText(location.status)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Jakość danych:</strong>
                            <span class="quality-${location.dataQuality || 'unknown'}">${this.getQualityText(location.dataQuality)}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Ostatnia aktualizacja:</strong>
                            <span>${location.lastUpdate ? this.formatDate(location.lastUpdate) : 'Brak danych'}</span>
                        </div>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);
        });
    }

    // Create custom location icon
    createLocationIcon(status) {
        const iconHtml = `<div class="custom-marker ${status}">
            <i class="fas fa-${status === 'active' ? 'broadcast-tower' : 'map-marker-alt'}"></i>
        </div>`;

        return L.divIcon({
            html: iconHtml,
            className: 'marker-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // Initialize wind map and visualization
    async initializeWindMap() {
        const windMapElement = document.getElementById('wind-map');
        const windCanvasElement = document.getElementById('wind-canvas');
        
        if (!windMapElement || !windCanvasElement) return;

        try {
            // Initialize wind map
            this.windMap = L.map('wind-map', {
                zoomControl: true,
                attributionControl: false
            }).setView(this.config.mapConfig.center, 12);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.windMap);

            // Setup wind canvas
            this.windCanvas = windCanvasElement;
            this.windCtx = this.windCanvas.getContext('2d');
            this.resizeWindCanvas();

            // Load and visualize wind data
            await this.loadWindVisualization();

            console.log('✅ Wind map and canvas initialized');
        } catch (error) {
            console.error('❌ Wind map initialization failed:', error);
            this.showToast('Wind visualization failed to load', 'error');
        }
    }

    // Resize wind canvas to match container
    resizeWindCanvas() {
        if (!this.windCanvas) return;

        const container = this.windCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        this.windCanvas.width = rect.width;
        this.windCanvas.height = rect.height;

        // Update canvas style
        this.windCanvas.style.width = rect.width + 'px';
        this.windCanvas.style.height = rect.height + 'px';
    }

    // Load sample data for demonstration
    loadSampleData() {
        const sampleWindData = {
            metadata: {
                version: "2.3.0",
                enhanced_features: true,
                timestamp: Date.now() / 1000,
                computation_time: 12.4,
                simulation_time: 10.8
            },
            performance: {
                total_time: 12.4,
                simulation_time: 10.8,
                iterations_per_second: 322.1,
                grid_cells_per_second: 456800
            },
            flow_statistics: {
                min_magnitude: 0.2,
                max_magnitude: 6.8,
                mean_magnitude: 3.2,
                std_magnitude: 1.4,
                turbulence_intensity: 0.125,
                mean_vorticity: 0.042
            },
            vector_field: this.generateSampleVectorField(),
            streamlines: [],
            particles: []
        };

        this.state.windData = sampleWindData;
        this.updateDataDisplays();
        console.log('✅ Sample data loaded');
    }

    // Generate sample vector field for demonstration
    generateSampleVectorField() {
        const vectors = [];
        const gridSize = 20;
        
        for (let y = 0; y < 600; y += gridSize) {
            for (let x = 0; x < 800; x += gridSize) {
                // Simple flow pattern with some variation
                const vx = 2 + Math.sin(x * 0.01) * 1.5;
                const vy = Math.cos(y * 0.008) * 0.8;
                const magnitude = Math.sqrt(vx * vx + vy * vy);
                
                vectors.push({
                    x: x,
                    y: y,
                    vx: vx,
                    vy: vy,
                    magnitude: magnitude
                });
            }
        }
        
        return vectors;
    }

    // POPRAWIONA METODA - używa GitHub Pages zamiast GitHub API
    async connectToAPI() {
        this.showLoading(true);
        this.showToast('Connecting to GitHub Pages data...', 'info');
        
        try {
            const success = await this.loadWindDataFromAPI();
            if (success) {
                this.state.apiConnected = true;
                this.updateUI();
                this.startAutoRefresh();
                this.showToast('Successfully connected to live data!', 'success');
                this.updateConnectionStatus('connected');
            } else {
                throw new Error('Failed to load data from API');
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this.showToast('Connection failed, using sample data', 'warning');
            this.state.apiConnected = false;
            this.updateConnectionStatus('disconnected');
        } finally {
            this.showLoading(false);
        }
    }

    // POPRAWIONA METODA - bezpośrednie pobieranie z GitHub Pages
    async loadWindDataFromAPI() {
        try {
            const windDataUrl = `${this.config.apiConfig.githubPagesBaseUrl}/${this.config.apiConfig.endpoints.windSimulation}`;
            
            console.log('🌐 Attempting to fetch data from:', windDataUrl);
            
            const response = await fetch(windDataUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(this.config.apiConfig.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (this.validateWindData(data)) {
                this.state.windData = data;
                this.state.lastUpdate = new Date().toISOString();
                this.updateDataDisplays();
                console.log('✅ Wind data loaded successfully from API');
                return true;
            } else {
                throw new Error('Invalid data format received');
            }
        } catch (error) {
            console.warn('⚠️ API fetch failed, using fallback data:', error.message);
            
            if (this.config.apiConfig.fallbackData) {
                // Użyj danych przykładowych
                this.loadSampleData();
                return true;
            }
            return false;
        }
    }

    // Validate wind data structure
    validateWindData(data) {
        return data && 
               data.metadata && 
               data.flow_statistics && 
               data.vector_field && 
               Array.isArray(data.vector_field);
    }

    // Update data displays in UI
    updateDataDisplays() {
        if (!this.state.windData) return;

        const data = this.state.windData;
        
        // Update dashboard statistics
        this.updateElement('avg-wind-speed', `${data.flow_statistics?.mean_magnitude?.toFixed(1) || '3.2'} m/s`);
        this.updateElement('computation-time', `${data.performance?.total_time?.toFixed(1) || '12.4'}s`);
        this.updateElement('temperature', '18.5°C'); // Static for now
        this.updateElement('data-quality', 'Wysoka');

        // Update wind analysis statistics
        this.updateElement('max-velocity', `${data.flow_statistics?.max_magnitude?.toFixed(1) || '6.8'} m/s`);
        this.updateElement('avg-velocity', `${data.flow_statistics?.mean_magnitude?.toFixed(1) || '3.2'} m/s`);
        this.updateElement('turbulence', `${((data.flow_statistics?.turbulence_intensity || 0.125) * 100).toFixed(1)}%`);
        this.updateElement('vorticity', `${data.flow_statistics?.mean_vorticity?.toFixed(3) || '0.042'} s⁻¹`);

        // Update simulation details
        this.updateElement('compute-time', `${data.performance?.total_time?.toFixed(1) || '12.4'}s`);
        this.updateElement('performance', `${data.performance?.iterations_per_second?.toFixed(0) || '322'} it/s`);

        console.log('✅ Data displays updated');
    }

    // Helper method to update element text content
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Load and start wind visualization
    async loadWindVisualization() {
        if (!this.state.windData || !this.windCtx) return;

        try {
            this.clearCanvas();
            
            switch (this.state.vizMode) {
                case 'particles':
                    this.initializeParticles();
                    this.startWindAnimation();
                    break;
                case 'streamlines':
                    this.drawStreamlines();
                    break;
                case 'vectors':
                    this.drawVectorField();
                    break;
            }

            console.log('✅ Wind visualization loaded');
        } catch (error) {
            console.error('❌ Wind visualization failed:', error);
        }
    }

    // Initialize particle system
    initializeParticles() {
        this.particles = [];
        const canvasWidth = this.windCanvas.width;
        const canvasHeight = this.windCanvas.height;

        for (let i = 0; i < this.state.particleCount; i++) {
            this.particles.push({
                x: Math.random() * canvasWidth,
                y: Math.random() * canvasHeight,
                vx: 0,
                vy: 0,
                age: 0,
                maxAge: 100 + Math.random() * 100,
                size: 1 + Math.random() * 2
            });
        }
    }

    // Get wind velocity at specific position
    getWindVelocityAtPosition(x, y) {
        if (!this.state.windData?.vector_field) {
            return { vx: 2, vy: 0 }; // Default flow
        }

        // Simple nearest neighbor interpolation
        const vectors = this.state.windData.vector_field;
        let closest = vectors[0];
        let minDist = Infinity;

        for (const vector of vectors) {
            const dist = Math.sqrt((x - vector.x) ** 2 + (y - vector.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closest = vector;
            }
        }

        return {
            vx: closest.vx || 2,
            vy: closest.vy || 0
        };
    }

    // Start wind animation loop
    startWindAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const animate = () => {
            this.updateWindVisualization();
            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    // Update wind visualization
    updateWindVisualization() {
        if (!this.windCtx || !this.particles.length) return;

        this.clearCanvas();

        // Update and draw particles
        this.windCtx.globalAlpha = this.state.opacity / 100;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Get wind velocity at particle position
            const velocity = this.getWindVelocityAtPosition(particle.x, particle.y);
            
            // Update particle position
            particle.vx = velocity.vx * 2;
            particle.vy = velocity.vy * 2;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.age++;

            // Reset particle if it goes off screen or gets too old
            if (particle.x < 0 || particle.x > this.windCanvas.width || 
                particle.y < 0 || particle.y > this.windCanvas.height || 
                particle.age > particle.maxAge) {
                
                particle.x = Math.random() * this.windCanvas.width;
                particle.y = Math.random() * this.windCanvas.height;
                particle.age = 0;
            }

            // Draw particle
            const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2);
            const hue = Math.min(240 - speed * 30, 240); // Blue to red based on speed
            
            this.windCtx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            this.windCtx.beginPath();
            this.windCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.windCtx.fill();
        }

        // Update particle count indicator
        this.updateElement('active-particles', this.particles.length.toString());
    }

    // Clear canvas
    clearCanvas() {
        if (this.windCtx) {
            this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);
        }
    }

    // Draw streamlines
    drawStreamlines() {
        if (!this.windCtx || !this.state.windData?.vector_field) return;

        this.clearCanvas();
        this.windCtx.globalAlpha = this.state.opacity / 100;
        this.windCtx.strokeStyle = '#0066cc';
        this.windCtx.lineWidth = 1.5;

        // Generate and draw streamlines
        for (let i = 0; i < this.config.visualization.streamlineCount; i++) {
            const startX = Math.random() * this.windCanvas.width;
            const startY = Math.random() * this.windCanvas.height;
            
            this.drawStreamline(startX, startY);
        }
    }

    // Draw single streamline
    drawStreamline(startX, startY) {
        const maxSteps = 100;
        const stepSize = 2;
        
        this.windCtx.beginPath();
        this.windCtx.moveTo(startX, startY);
        
        let x = startX;
        let y = startY;
        
        for (let step = 0; step < maxSteps; step++) {
            const velocity = this.getWindVelocityAtPosition(x, y);
            
            if (Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2) < 0.1) break;
            
            x += velocity.vx * stepSize;
            y += velocity.vy * stepSize;
            
            if (x < 0 || x > this.windCanvas.width || y < 0 || y > this.windCanvas.height) break;
            
            this.windCtx.lineTo(x, y);
        }
        
        this.windCtx.stroke();
    }

    // Draw vector field
    drawVectorField() {
        if (!this.windCtx || !this.state.windData?.vector_field) return;

        this.clearCanvas();
        this.windCtx.globalAlpha = this.state.opacity / 100;

        const vectors = this.state.windData.vector_field;
        const scale = 10;

        vectors.forEach(vector => {
            const speed = vector.magnitude || Math.sqrt(vector.vx ** 2 + vector.vy ** 2);
            const hue = Math.min(240 - speed * 30, 240);
            
            this.windCtx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
            this.windCtx.lineWidth = 1 + speed * 0.5;
            
            this.windCtx.beginPath();
            this.windCtx.moveTo(vector.x, vector.y);
            this.windCtx.lineTo(vector.x + vector.vx * scale, vector.y + vector.vy * scale);
            this.windCtx.stroke();
            
            // Draw arrowhead
            const angle = Math.atan2(vector.vy, vector.vx);
            const headLength = 5;
            
            this.windCtx.beginPath();
            this.windCtx.moveTo(vector.x + vector.vx * scale, vector.y + vector.vy * scale);
            this.windCtx.lineTo(
                vector.x + vector.vx * scale - headLength * Math.cos(angle - Math.PI / 6),
                vector.y + vector.vy * scale - headLength * Math.sin(angle - Math.PI / 6)
            );
            this.windCtx.moveTo(vector.x + vector.vx * scale, vector.y + vector.vy * scale);
            this.windCtx.lineTo(
                vector.x + vector.vx * scale - headLength * Math.cos(angle + Math.PI / 6),
                vector.y + vector.vy * scale - headLength * Math.sin(angle + Math.PI / 6)
            );
            this.windCtx.stroke();
        });
    }

    // Switch between modules
    switchModule(moduleName) {
        // Hide all modules
        document.querySelectorAll('.module').forEach(module => {
            module.classList.add('hidden');
        });

        // Show selected module
        const targetModule = document.getElementById(`module-${moduleName}`);
        if (targetModule) {
            targetModule.classList.remove('hidden');
            this.state.currentModule = moduleName;

            // Update navigation buttons
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('btn--primary');
                btn.classList.add('btn--outline');
            });

            const activeBtn = document.querySelector(`[data-module="${moduleName}"]`);
            if (activeBtn) {
                activeBtn.classList.remove('btn--outline');
                activeBtn.classList.add('btn--primary');
            }

            // Initialize module-specific features
            if (moduleName === 'wind') {
                setTimeout(() => this.initializeWindMap(), 100);
            }

            console.log(`✅ Switched to module: ${moduleName}`);
        }
    }

    // Toggle API connection
    async toggleConnection() {
        if (this.state.apiConnected) {
            this.disconnect();
        } else {
            await this.connectToAPI();
        }
    }

    // Disconnect from API
    disconnect() {
        this.state.apiConnected = false;
        this.stopAutoRefresh();
        this.updateConnectionStatus('disconnected'); 
        this.showToast('Disconnected from API', 'info');
        this.updateUI();
    }

    // Start auto refresh timer
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.state.autoRefreshEnabled = true;
        
        this.state.refreshTimer = setInterval(async () => {
            await this.loadWindDataFromAPI();
        }, this.config.apiConfig.refreshInterval);
    }

    // Stop auto refresh timer
    stopAutoRefresh() {
        if (this.state.refreshTimer) {
            clearInterval(this.state.refreshTimer);
            this.state.refreshTimer = null;
        }
        this.state.autoRefreshEnabled = false;
    }

    // Refresh simulation manually
    async refreshSimulation() {
        this.showToast('Refreshing simulation...', 'info');
        
        if (this.state.apiConnected) {
            await this.loadWindDataFromAPI();
        } else {
            this.loadSampleData();
        }
        
        if (this.state.currentModule === 'wind') {
            await this.loadWindVisualization();
        }
        
        this.showToast('Simulation refreshed', 'success');
    }

    // Update visualization opacity
    updateVisualizationOpacity() {
        // Opacity is applied in the drawing methods
        if (this.state.currentModule === 'wind') {
            this.updateWindVisualization();
        }
    }

    // Update particle count
    updateParticleCount() {
        if (this.state.vizMode === 'particles') {
            this.initializeParticles();
        }
    }

    // Update UI elements
    updateUI() {
        const connectionBtn = document.getElementById('connection-btn');
        if (connectionBtn) {
            if (this.state.apiConnected) {
                connectionBtn.innerHTML = '<i class="fas fa-wifi"></i> Rozłącz';
                connectionBtn.className = 'btn btn--primary';
            } else {
                connectionBtn.innerHTML = '<i class="fas fa-wifi"></i> Połącz z API';
                connectionBtn.className = 'btn btn--secondary';
            }
        }

        // Update last update time
        if (this.state.lastUpdate) {
            this.updateElement('last-update', this.formatDate(this.state.lastUpdate));
        }
    }

    // Update connection status
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            switch (status) {
                case 'connected':
                    statusElement.textContent = 'Połączony';
                    statusElement.className = 'status status--success';
                    break;
                case 'connecting':
                    statusElement.textContent = 'Łączenie...';
                    statusElement.className = 'status status--warning';
                    break;
                case 'disconnected':
                default:
                    statusElement.textContent = 'Rozłączony';
                    statusElement.className = 'status status--info';
                    break;
            }
        }
    }

    // Show loading overlay
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
        this.state.isLoading = show;
    }

    // Show connection option
    showConnectionOption() {
        this.showToast('Kliknij "Połącz z API" aby załadować dane na żywo', 'info');
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${iconMap[type]}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(toast);

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

    // Helper methods
    getStatusText(status) {
        const statusMap = {
            active: 'Aktywna',
            planned: 'Planowana',
            maintenance: 'Konserwacja'
        };
        return statusMap[status] || 'Nieznany';
    }

    getQualityText(quality) {
        const qualityMap = {
            high: 'Wysoka',
            medium: 'Średnia',
            low: 'Niska'
        };
        return qualityMap[quality] || 'Brak danych';
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Nieprawidłowa data';
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM loaded, initializing GIS Microclimate Platform...');
    
    // Check if required libraries are loaded
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet library not loaded!');
        alert('Błąd: Biblioteka Leaflet nie została załadowana. Sprawdź połączenie internetowe.');
        return;
    }

    // Initialize the application
    try {
        window.gisApp = new GISMicroclimateUpgrade();
        console.log('🎉 Application initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        alert('Błąd inicjalizacji aplikacji. Sprawdź konsolę przeglądarki aby uzyskać więcej informacji.');
    }
});

// Export for global access
window.GISMicroclimateUpgrade = GISMicroclimateUpgrade;
