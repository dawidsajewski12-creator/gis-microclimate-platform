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
                center: [54.16, 19.40], // Centrala lokalizacja (Gdańsk region)
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

    // Setup event listeners
    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const module = e.target.dataset.module;
                this.switchModule(module);
            });
        });

        // Controls
        const vizModeSelect = document.getElementById('viz-mode');
        if (vizModeSelect) {
            vizModeSelect.addEventListener('change', (e) => {
                this.state.vizMode = e.target.value;
                this.updateVisualization();
            });
        }

        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                this.state.opacity = parseInt(e.target.value);
                document.getElementById('opacity-value').textContent = `${this.state.opacity}%`;
                this.updateVisualization();
            });
        }

        const particleCountSlider = document.getElementById('particle-count');
        if (particleCountSlider) {
            particleCountSlider.addEventListener('input', (e) => {
                this.state.particleCount = parseInt(e.target.value);
                document.getElementById('particle-count-value').textContent = this.state.particleCount;
                this.updateVisualization();
            });
        }

        // Buttons
        const runSimBtn = document.getElementById('run-simulation');
        if (runSimBtn) {
            runSimBtn.addEventListener('click', () => this.runWindSimulation());
        }

        const connectApiBtn = document.getElementById('connect-api');
        if (connectApiBtn) {
            connectApiBtn.addEventListener('click', () => this.connectToAPI());
        }
    }

    // Switch between modules
    switchModule(moduleName) {
        // Hide all modules
        document.querySelectorAll('.module').forEach(module => {
            module.classList.remove('active');
        });
        
        // Show selected module
        const targetModule = document.getElementById(`${moduleName}-module`);
        if (targetModule) {
            targetModule.classList.add('active');
        }
        
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-module="${moduleName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.state.currentModule = moduleName;

        // Initialize module-specific components
        if (moduleName === 'wind' && !this.windMap) {
            setTimeout(() => this.initializeWindMap(), 100);
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

    // Initialize wind analysis map
    initializeWindMap() {
        const mapElement = document.getElementById('wind-map');
        if (!mapElement) return;

        this.windMap = L.map('wind-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.mapConfig.center, this.config.mapConfig.zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.config.mapConfig.maxZoom
        }).addTo(this.windMap);

        L.control.zoom({ position: 'bottomright' }).addTo(this.windMap);

        // Initialize canvas for wind visualization
        this.initializeWindCanvas();
        
        console.log('✅ Wind map initialized');
    }

    // Initialize wind visualization canvas
    initializeWindCanvas() {
        const canvas = document.getElementById('wind-canvas');
        if (!canvas) return;

        this.windCanvas = canvas;
        this.windCtx = canvas.getContext('2d');

        // Set canvas size
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Handle resize
        window.addEventListener('resize', () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            this.updateVisualization();
        });
    }

    // Add markers for research locations
    addLocationMarkers() {
        if (!this.dashboardMap) return;

        this.config.mapConfig.locations.forEach(location => {
            const icon = this.createLocationIcon(location.status);
            const marker = L.marker(location.coords, { icon })
                .addTo(this.dashboardMap);

            // FIXED: Poprawiony popup content bez niezdefiniowanej zmiennej
            const popupContent = `
                <div class="location-popup">
                    <h4>${location.name}</h4>
                    <p>${location.description}</p>
                    <div class="popup-details">
                        <div class="detail-item">
                            <strong>Status:</strong> 
                            <span class="status ${location.status}">${location.status === 'active' ? 'Aktywny' : 'Planowany'}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Jakość danych:</strong> 
                            <span class="quality-${location.dataQuality || 'unknown'}">${location.dataQuality === 'high' ? 'Wysoka' : 'Brak danych'}</span>
                        </div>
                        ${location.lastUpdate ? `
                        <div class="detail-item">
                            <strong>Ostatnia aktualizacja:</strong> 
                            <span>${new Date(location.lastUpdate).toLocaleDateString('pl-PL')}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                className: 'custom-popup',
                maxWidth: 300,
                closeButton: true
            });
        });
    }

    // Create location icon based on status
    createLocationIcon(status) {
        const iconHtml = status === 'active' 
            ? `<div class="custom-marker active">📍</div>`
            : `<div class="custom-marker planned">📋</div>`;
        
        return L.divIcon({
            html: iconHtml,
            className: 'marker-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // Load sample data
    loadSampleData() {
        this.state.windData = {
            avgSpeed: 4.2,
            direction: 225,
            temperature: 18,
            lastUpdate: new Date().toISOString()
        };

        // Simulate some wind vectors for demo
        this.generateSampleWindData();
    }

    // Generate sample wind data for demo
    generateSampleWindData() {
        this.particles = [];
        const particleCount = Math.min(this.state.particleCount, 2000); // Limit for demo
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: Math.random() * 100,
                maxLife: 100
            });
        }
    }

    // Update UI with current data
    updateUI() {
        if (this.state.windData) {
            this.updateElement('avg-wind-speed', `${this.state.windData.avgSpeed} m/s`);
            this.updateElement('temperature', `${this.state.windData.temperature}°C`);
            this.updateElement('computation-time', '2.3s');
            
            if (this.state.windData.lastUpdate) {
                this.updateElement('last-update', new Date(this.state.windData.lastUpdate).toLocaleTimeString('pl-PL'));
            }
        }

        // Update API status
        this.updateElement('api-status', this.state.apiConnected ? 'Połączony' : 'Rozłączony');
        this.updateElement('active-locations', '1/2');
        this.updateElement('auto-refresh', this.state.autoRefreshEnabled ? 'Włączone' : 'Wyłączone');
    }

    // Helper to update element content safely
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }

    // Update visualization based on current settings
    updateVisualization() {
        if (!this.windCtx) return;

        const canvas = this.windCanvas;
        const ctx = this.windCtx;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set global alpha based on opacity
        ctx.globalAlpha = this.state.opacity / 100;

        switch (this.state.vizMode) {
            case 'particles':
                this.drawParticles(ctx);
                break;
            case 'streamlines':
                this.drawStreamlines(ctx);
                break;
            case 'vectors':
                this.drawVectors(ctx);
                break;
        }

        ctx.globalAlpha = 1.0;
    }

    // Draw particle visualization
    drawParticles(ctx) {
        ctx.fillStyle = '#32a0dd';
        
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha * (this.state.opacity / 100);
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Update particle
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            // Reset particle if dead or out of bounds
            if (particle.life <= 0 || particle.x < 0 || particle.x > ctx.canvas.width || 
                particle.y < 0 || particle.y > ctx.canvas.height) {
                particle.x = Math.random() * ctx.canvas.width;
                particle.y = Math.random() * ctx.canvas.height;
                particle.life = particle.maxLife;
            }
        });
    }

    // Draw streamlines visualization
    drawStreamlines(ctx) {
        ctx.strokeStyle = '#32a0dd';
        ctx.lineWidth = 1;
        
        // Simple curved lines for demo
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            const startX = (i / 20) * ctx.canvas.width;
            const startY = ctx.canvas.height * 0.3;
            
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(
                startX + 100, startY + Math.sin(i) * 50,
                startX + 200, startY + 100
            );
            ctx.stroke();
        }
    }

    // Draw vector field visualization
    drawVectors(ctx) {
        ctx.strokeStyle = '#32a0dd';
        ctx.lineWidth = 2;
        
        const gridSize = 40;
        for (let x = gridSize; x < ctx.canvas.width; x += gridSize) {
            for (let y = gridSize; y < ctx.canvas.height; y += gridSize) {
                const angle = Math.atan2(y - ctx.canvas.height/2, x - ctx.canvas.width/2);
                const length = 15;
                
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                ctx.stroke();
                
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                ctx.lineTo(
                    x + Math.cos(angle - 0.5) * (length - 5),
                    y + Math.sin(angle - 0.5) * (length - 5)
                );
                ctx.moveTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                ctx.lineTo(
                    x + Math.cos(angle + 0.5) * (length - 5),
                    y + Math.sin(angle + 0.5) * (length - 5)
                );
                ctx.stroke();
            }
        }
    }

    // Run wind simulation
    async runWindSimulation() {
        this.showLoading(true);
        this.showToast('Uruchamianie symulacji wiatru...', 'info');
        
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate new sample data
            this.generateSampleWindData();
            this.updateVisualization();
            
            // Start animation loop
            this.startAnimationLoop();
            
            this.showToast('Symulacja wiatru zakończona pomyślnie', 'success');
        } catch (error) {
            console.error('Simulation failed:', error);
            this.showToast('Błąd podczas symulacji', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Connect to API
    async connectToAPI() {
        this.showLoading(true);
        this.showToast('Łączenie z API...', 'info');
        
        try {
            // Simulate API connection
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.state.apiConnected = true;
            this.updateUI();
            
            this.showToast('Połączono z API pomyślnie', 'success');
        } catch (error) {
            console.error('API connection failed:', error);
            this.showToast('Błąd połączenia z API', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Start animation loop
    startAnimationLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const animate = () => {
            if (this.state.vizMode === 'particles') {
                this.updateVisualization();
            }
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Show/hide loading overlay
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
        this.state.isLoading = show;
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <i>${icons[type] || icons.info}</i>
                ${message}
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

    // Show connection options (placeholder)
    showConnectionOption() {
        console.log('Connection options ready');
    }

    // Cleanup on page unload
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gisApp = new GISMicroclimateUpgrade();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.gisApp) {
            window.gisApp.destroy();
        }
    });
});
