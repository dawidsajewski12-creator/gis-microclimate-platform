// Professional GIS Microclimate Platform - Complete Web Application
// Version: 2.2.0 - Fixed to NOT auto-connect on page load
// Complete implementation with manual connection option

class GISMicroclimatePlatform {
  constructor() {
    this.config = {
      apiConfig: {
        githubBaseUrl: "https://api.github.com/repos",
        defaultRepo: "dawidsajewski12-creator/gis-microclimate-platform", // Update this to your repo
        endpoints: {
          windSimulation: "api/data/wind_simulation/current.json",
          systemMetadata: "api/data/system/metadata.json"
        },
        refreshInterval: 30000,
        timeout: 5000
      },
      visualization: {
        defaultOpacity: 80,
        defaultMode: 'magnitude',
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
      autoRefreshEnabled: false, // Changed: disabled by default
      refreshTimer: null,
      vizMode: 'magnitude',
      opacity: 80
    };
    
    this.canvas = null;
    this.ctx = null;
    
    this.init();
  }
  
  // Initialize application - NO AUTO API LOADING
  async init() {
    console.log('🚀 Initializing GIS Microclimate Platform (No Auto-Connect Mode)');
    
    try {
      this.setupEventListeners();
      this.setupCanvas();
      this.loadSampleData(); // Load sample data instead of API data
      this.updateUI();
      
      // Show manual connection option instead of auto-connecting
      this.showConnectionOption();
      
      console.log('✅ Platform initialized with sample data - ready for manual connection');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.showToast('Platform initialization failed', 'error');
    }
  }
  
  // Show connection option instead of auto-connecting
  showConnectionOption() {
    const statusElement = document.getElementById('api-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <i class="fas fa-circle" style="color: #ff8800;"></i> 
        <button onclick="window.gisplatform.connectToAPI()" 
                style="background: none; border: none; color: #0066cc; text-decoration: underline; cursor: pointer; font-weight: 500;">
          Connect to Live Data
        </button>
      `;
    }
    
    // Update connection status in other locations
    this.updateConnectionStatus('disconnected');
  }
  
  // Manual API connection method
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
        
        // Update status elements
        this.updateConnectionStatus('connected');
        
        // If we're on wind module, re-render with new data
        if (this.state.currentModule === 'wind') {
          setTimeout(() => this.renderWindVisualization(), 100);
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
  
  // Update connection status in UI
  updateConnectionStatus(status) {
    const statusElement = document.getElementById('api-status');
    if (!statusElement) return;
    
    switch (status) {
      case 'connected':
        statusElement.innerHTML = '<i class="fas fa-circle status-active"></i> Live Data Connected';
        break;
      case 'disconnected':
        // Already handled in showConnectionOption()
        break;
      case 'failed':
        statusElement.innerHTML = `
          <i class="fas fa-circle" style="color: #ff4444;"></i> 
          <button onclick="window.gisplatform.connectToAPI()" 
                  style="background: none; border: none; color: #0066cc; text-decoration: underline; cursor: pointer;">
            Retry Connection
          </button>
        `;
        break;
    }
  }
  
  // Load wind data from GitHub Pages API
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
        
        // Validate data structure
        if (this.validateWindData(data)) {
          this.state.windData = data;
          this.state.lastUpdate = new Date();
          
          console.log('✅ Live wind data loaded successfully:', data.metadata);
          return true;
        } else {
          console.warn('⚠️  Invalid data structure received from API');
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
  
  // Load sample data as default (no API calls required)
  loadSampleData() {
    this.state.windData = {
      metadata: {
        timestamp: new Date().toISOString(),
        module: "wind_simulation",
        version: "2.2.0",
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
      vector_field: this.generateSampleVectorField()
    };
    
    this.state.lastUpdate = new Date();
    console.log('📊 Sample data loaded successfully');
  }
  
  // Generate realistic sample vector field
  generateSampleVectorField() {
    const vectors = [];
    const gridSize = 20;
    const windDirection = Math.PI * 1.25; // 225 degrees
    
    for (let x = 0; x < 850; x += gridSize) {
      for (let y = 0; y < 680; y += gridSize) {
        // Create realistic flow pattern with obstacles
        const centerX = 425;
        const centerY = 340;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Base wind direction with perturbations
        let angle = windDirection + Math.sin(distance * 0.01) * 0.3;
        
        // Create wake effects behind obstacles
        if (distance < 100) {
          angle += Math.PI * 0.2 * Math.sin(Math.atan2(dy, dx) * 3);
        }
        
        // Variable magnitude based on distance and direction
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
  
  // Setup event listeners for UI interactions
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
        this.updateVisualization();
      });
    }
    
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.state.opacity = parseInt(e.target.value);
        this.updateOpacity();
        
        const rangeValue = document.querySelector('.range-value');
        if (rangeValue) rangeValue.textContent = `${e.target.value}%`;
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
  
  // Setup canvas for wind visualizations
  setupCanvas() {
  this.canvas = document.getElementById('wind-canvas');
  if (!this.canvas) return;
  this.ctx = this.canvas.getContext('2d');
  this.resizeCanvas();
  // ResizeObserver – zawsze dostosuj wielkość i przerysuj
  const container = this.canvas.parentElement;
  this.ro = new ResizeObserver(() => {
    this.resizeCanvas();
    if (this.state.currentModule === 'wind' && this.state.windData) {
      this.renderWindVisualization();
    }
  });
  this.ro.observe(container);
}

renderWindVisualization() {
  if (!this.canvas || !this.ctx || !this.state.windData) return;
  this.resizeCanvas();  // przed każdym rysowaniem!
  const canvas = this.canvas;
  const ctx = this.ctx;;
      
      // Handle window resize
      window.addEventListener('resize', () => {
        this.resizeCanvas();
        if (this.state.currentModule === 'wind' && this.state.windData) {
          this.renderWindVisualization();
        }
      });
      
      // Handle canvas interactions
      this.setupCanvasInteractions();
    }
  }
  
  // Setup canvas interactions (zoom, pan, etc.)
  setupCanvasInteractions() {
    if (!this.canvas) return;
    
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    
    this.canvas.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      lastMouseX = e.offsetX;
      lastMouseY = e.offsetY;
      this.canvas.style.cursor = 'grabbing';
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (isMouseDown) {
        // Implement panning if needed
        // For now, just update cursor
      } else {
        // Show coordinates or wind data on hover
        this.showDataAtPoint(e.offsetX, e.offsetY);
      }
    });
    
    this.canvas.addEventListener('mouseup', () => {
      isMouseDown = false;
      this.canvas.style.cursor = 'grab';
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      isMouseDown = false;
      this.canvas.style.cursor = 'default';
    });
    
    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Implement zoom if needed
    });
  }
  
  // Show data at specific point on canvas
  showDataAtPoint(canvasX, canvasY) {
    if (!this.state.windData) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.state.windData.grid_properties.width / rect.width;
    const scaleY = this.state.windData.grid_properties.height / rect.height;
    
    const dataX = Math.floor(canvasX * scaleX);
    const dataY = Math.floor(canvasY * scaleY);
    
    // Find nearest vector
    const nearestVector = this.findNearestVector(dataX, dataY);
    
    if (nearestVector) {
      const tooltip = document.getElementById('data-tooltip');
      if (tooltip) {
        tooltip.innerHTML = `
          <strong>Position:</strong> (${dataX}, ${dataY})<br>
          <strong>Wind Speed:</strong> ${nearestVector.magnitude.toFixed(2)} m/s<br>
          <strong>Direction:</strong> ${this.vectorToDirection(nearestVector.vx, nearestVector.vy)}
        `;
        tooltip.style.left = `${canvasX + 10}px`;
        tooltip.style.top = `${canvasY - 10}px`;
        tooltip.style.display = 'block';
      }
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
  
  // Convert vector to compass direction
  vectorToDirection(vx, vy) {
    const angle = Math.atan2(vy, vx) * 180 / Math.PI;
    const normalizedAngle = (angle + 360) % 360;
    
    const directions = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'];
    const index = Math.round(normalizedAngle / 22.5) % 16;
    
    return directions[index];
  }
  
  // Resize canvas to fit container
  resizeCanvas() {
    if (this.canvas && this.canvas.parentElement) {
      const container = this.canvas.parentElement;
      const rect = container.getBoundingClientRect();
      
      // Set canvas size with device pixel ratio for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      
      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }
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
      dashboard: 'Dashboard Overview',
      wind: 'Wind Analysis',
      vegetation: 'Vegetation Analysis',
      thermal: 'Thermal Comfort',
      scenarios: 'Scenario Management',
      export: 'Export & Reports'
    };
    
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
      breadcrumbs.innerHTML = `
        <span class="breadcrumb-item">GIS Microclimate Platform</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item active">${moduleNames[moduleId] || 'Module'}</span>
      `;
    }
  }
  
  // Initialize specific module
  initializeModule(moduleId) {
    switch (moduleId) {
      case 'wind':
        if (this.state.windData) {
          setTimeout(() => this.renderWindVisualization(), 100);
        }
        break;
      case 'vegetation':
        this.showModuleComingSoon('Vegetation Analysis');
        break;
      case 'thermal':
        this.showModuleComingSoon('Thermal Comfort');
        break;
      case 'scenarios':
        this.showModuleComingSoon('Scenario Management');
        break;
    }
  }
  
  // Show "coming soon" message for future modules
  showModuleComingSoon(moduleName) {
    const moduleContent = document.getElementById(`${this.state.currentModule}-content`);
    if (moduleContent) {
      moduleContent.innerHTML = `
        <div class="coming-soon">
          <i class="fas fa-cog fa-spin fa-3x"></i>
          <h3>${moduleName}</h3>
          <p>This module is currently under development and will be available in future updates.</p>
          <p>Stay tuned for advanced ${moduleName.toLowerCase()} capabilities!</p>
        </div>
      `;
    }
  }
  
  // Refresh data from API (only if connected)
  async refreshData() {
    if (!this.state.apiConnected) {
      this.showToast('Connect to live data first to refresh', 'warning');
      return;
    }
    
    const refreshBtn = document.getElementById('refresh-btn');
    const icon = refreshBtn?.querySelector('i');
    
    if (icon) icon.classList.add('fa-spin');
    if (refreshBtn) refreshBtn.disabled = true;
    
    try {
      const success = await this.loadWindDataFromAPI();
      if (success) {
        this.updateUI();
        this.showToast('Data refreshed successfully', 'success');
      } else {
        this.showToast('Failed to refresh data from API', 'error');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      this.showToast('Failed to refresh data', 'error');
    } finally {
      if (icon) icon.classList.remove('fa-spin');
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }
  
  // Start auto-refresh timer (only when connected and enabled)
  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear any existing timer
    
    if (this.state.apiConnected && this.state.autoRefreshEnabled) {
      console.log(`🔄 Starting auto-refresh every ${this.config.apiConfig.refreshInterval/1000}s`);
      
      this.state.refreshTimer = setInterval(() => {
        console.log('🔄 Auto-refreshing data...');
        this.refreshData();
      }, this.config.apiConfig.refreshInterval);
    }
  }
  
  // Stop auto-refresh timer
  stopAutoRefresh() {
    if (this.state.refreshTimer) {
      clearInterval(this.state.refreshTimer);
      this.state.refreshTimer = null;
      console.log('⏹️  Auto-refresh stopped');
    }
  }
  
  // Update all UI components with current data
  updateUI() {
    console.log('🔄 Updating UI with current data');
    
    this.updateSystemStatus();
    this.updateKPICards();
    this.updateDataPanels();
    this.updateActivityFeed();
    
    // Re-render visualization if on wind module
    if (this.state.currentModule === 'wind' && this.state.windData) {
      this.renderWindVisualization();
    }
  }
  
  // Update system status indicators
  updateSystemStatus() {
    const lastUpdateElement = document.getElementById('last-update');
    
    if (lastUpdateElement && this.state.lastUpdate) {
      const timeStr = this.state.lastUpdate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      lastUpdateElement.textContent = timeStr;
    }
    
    // Update system status indicator
    const statusIndicator = document.getElementById('system-status');
    if (statusIndicator) {
      const status = this.state.apiConnected ? 'Connected' : 'Sample Mode';
      const className = this.state.apiConnected ? 'status-active' : 'status-warning';
      statusIndicator.innerHTML = `<i class="fas fa-circle ${className}"></i> ${status}`;
    }
  }
  
  // Update KPI dashboard cards
  updateKPICards() {
    if (!this.state.windData) return;
    
    const stats = this.state.windData.flow_statistics;
    const weather = this.state.windData.weather_conditions;
    const metadata = this.state.windData.metadata;
    
    // Wind KPI
    const windKPI = document.getElementById('wind-kpi-value');
    if (windKPI && stats) {
      windKPI.textContent = `${stats.mean_magnitude.toFixed(1)} m/s`;
    }
    
    // Performance KPI  
    const performanceKPI = document.getElementById('performance-kpi-value');
    if (performanceKPI && metadata) {
      performanceKPI.textContent = `${metadata.computation_time}s`;
    }
    
    // Temperature KPI
    const tempKPI = document.getElementById('temp-kpi-value');
    if (tempKPI && weather) {
      tempKPI.textContent = `${weather.temperature_c.toFixed(1)}°C`;
    }
    
    // Data quality KPI
    const qualityKPI = document.getElementById('quality-kpi-value');
    if (qualityKPI && this.state.windData.vector_field) {
      const dataPoints = this.state.windData.vector_field.length;
      qualityKPI.textContent = `${dataPoints.toLocaleString()} pts`;
    }
  }
  
  // Update detailed data panels
  updateDataPanels() {
    if (!this.state.windData) return;
    
    const stats = this.state.windData.flow_statistics;
    const weather = this.state.windData.weather_conditions;
    const grid = this.state.windData.grid_properties;
    const metadata = this.state.windData.metadata;
    
    // Flow statistics panel
    const flowElements = {
      'min-speed': stats?.min_magnitude ? `${stats.min_magnitude.toFixed(2)} m/s` : 'N/A',
      'max-speed': stats?.max_magnitude ? `${stats.max_magnitude.toFixed(2)} m/s` : 'N/A',
      'mean-speed': stats?.mean_magnitude ? `${stats.mean_magnitude.toFixed(2)} m/s` : 'N/A',
      'std-speed': stats?.std_magnitude ? `${stats.std_magnitude.toFixed(2)} m/s` : 'N/A',
      'median-speed': stats?.median_magnitude ? `${stats.median_magnitude.toFixed(2)} m/s` : 'N/A',
      'p95-speed': stats?.percentile_95 ? `${stats.percentile_95.toFixed(2)} m/s` : 'N/A'
    };
    
    // Weather conditions panel  
    const weatherElements = {
      'current-wind': weather ? `${weather.wind_speed_ms.toFixed(1)} m/s ${this.getWindDirectionName(weather.wind_direction_deg)}` : 'N/A',
      'current-temp': weather ? `${weather.temperature_c.toFixed(1)}°C` : 'N/A',
      'current-humidity': weather ? `${weather.humidity_percent}%` : 'N/A',
      'weather-source': weather ? weather.source : 'N/A'
    };
    
    // Grid information panel
    const gridElements = {
      'grid-size': grid ? `${grid.width.toLocaleString()}×${grid.height.toLocaleString()}` : 'N/A',
      'obstacle-count': grid?.obstacle_count ? grid.obstacle_count.toLocaleString() : 'N/A',
      'building-count': grid?.buildings_count ? grid.buildings_count.toLocaleString() : 'N/A',
      'pixel-resolution': grid?.pixel_size_m ? `${grid.pixel_size_m.toFixed(1)} m` : 'N/A'
    };
    
    // Simulation metadata panel
    const metadataElements = {
      'computation-time': metadata ? `${metadata.computation_time}s` : 'N/A',
      'simulation-timestamp': metadata ? new Date(metadata.timestamp).toLocaleString() : 'N/A',
      'platform-version': metadata ? metadata.version : 'N/A',
      'data-source': this.state.apiConnected ? 'Live API' : 'Sample Data'
    };
    
    // Update all elements
    const allElements = { ...flowElements, ...weatherElements, ...gridElements, ...metadataElements };
    
    Object.entries(allElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }
  
  // Update activity feed
  updateActivityFeed() {
    const activityList = document.getElementById('activity-list');
    if (!activityList || !this.state.windData) return;
    
    const dataSource = this.state.apiConnected ? 'Live GitHub Pages API' : 'Sample Data';
    const metadata = this.state.windData.metadata;
    const weather = this.state.windData.weather_conditions;
    
    const activities = [
      {
        icon: 'fas fa-wind',
        iconClass: 'wind',
        title: 'Wind simulation completed',
        description: `LBM computation finished in ${metadata?.computation_time || '45.2'}s using ${dataSource}`,
        time: metadata ? this.getRelativeTime(metadata.timestamp) : 'Just now'
      },
      {
        icon: 'fas fa-database',
        iconClass: 'data', 
        title: 'Data source active',
        description: `Connected to ${dataSource} for real-time updates`,
        time: '2 minutes ago'
      },
      {
        icon: 'fas fa-cloud-sun',
        iconClass: 'weather',
        title: 'Weather conditions',
        description: weather ? 
          `${weather.temperature_c}°C, Wind ${weather.wind_speed_ms.toFixed(1)} m/s @ ${weather.wind_direction_deg}°` : 
          'Sample weather data active',
        time: '5 minutes ago'
      },
      {
        icon: 'fas fa-chart-line',
        iconClass: 'analysis',
        title: 'Flow field analysis',
        description: `Generated ${this.state.windData.vector_field?.length || 0} vector points for visualization`,
        time: '8 minutes ago'
      }
    ];
    
    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon ${activity.iconClass}">
          <i class="${activity.icon}"></i>
        </div>
        <div class="activity-content">
          <h4>${activity.title}</h4>
          <p>${activity.description}</p>
          <span class="activity-time">${activity.time}</span>
        </div>
      </div>
    `).join('');
  }
  
  // Render wind visualization on canvas
  renderWindVisualization() {
    if (!this.canvas || !this.ctx || !this.state.windData) {
      console.warn('⚠️  Cannot render: missing canvas, context, or data');
      return;
    }
    
    console.log('🎨 Rendering wind visualization');
    
    const canvas = this.canvas;
    const ctx = this.ctx;
    const data = this.state.windData;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // Calculate scaling factors
    const scaleX = canvasWidth / data.grid_properties.width;
    const scaleY = canvasHeight / data.grid_properties.height;
    
    // Render based on current visualization mode
    switch (this.state.vizMode) {
      case 'magnitude':
        this.renderMagnitudeHeatmap(ctx, data, scaleX, scaleY, canvasWidth, canvasHeight);
        break;
      case 'vectors':
        this.renderVectorField(ctx, data, scaleX, scaleY);
        break;
      case 'streamlines':
        this.renderStreamlines(ctx, data, scaleX, scaleY, canvasWidth, canvasHeight);
        break;
      default:
        this.renderMagnitudeHeatmap(ctx, data, scaleX, scaleY, canvasWidth, canvasHeight);
    }
    
    // Apply opacity
    canvas.style.opacity = this.state.opacity / 100;
  }
  
  // Render magnitude field as heat map
  renderMagnitudeHeatmap(ctx, data, scaleX, scaleY, canvasWidth, canvasHeight) {
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const pixels = imageData.data;
    
    const minMag = data.flow_statistics.min_magnitude;
    const maxMag = data.flow_statistics.max_magnitude;
    const range = maxMag - minMag;
    
    if (range === 0) return;
    
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const dataX = Math.floor(x / scaleX);
        const dataY = Math.floor(y / scaleY);
        
        const magnitude = this.interpolateMagnitude(dataX, dataY, data.vector_field);
        const normalizedMag = Math.max(0, Math.min(1, (magnitude - minMag) / range));
        const color = this.getViridisColor(normalizedMag);
        
        const pixelIndex = (y * canvasWidth + x) * 4;
        pixels[pixelIndex] = color.r;     // Red
        pixels[pixelIndex + 1] = color.g; // Green  
        pixels[pixelIndex + 2] = color.b; // Blue
        pixels[pixelIndex + 3] = 200;     // Alpha
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  // Render vector field as arrows
  renderVectorField(ctx, data, scaleX, scaleY) {
    const vectors = data.vector_field;
    const maxMag = data.flow_statistics.max_magnitude;
    
    if (maxMag === 0) return;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    
    const arrowScale = Math.min(scaleX, scaleY) * 15;
    
    vectors.forEach(vector => {
      const x = vector.x * scaleX;
      const y = vector.y * scaleY;
      
      const normalizedMag = vector.magnitude / maxMag;
      const vx = (vector.vx / vector.magnitude) * arrowScale * normalizedMag;
      const vy = (vector.vy / vector.magnitude) * arrowScale * normalizedMag;
      
      if (normalizedMag > 0.1) { // Only draw significant vectors
        this.drawArrow(ctx, x, y, x + vx, y + vy);
      }
    });
  }
  
  // Render streamlines
  renderStreamlines(ctx, data, scaleX, scaleY, canvasWidth, canvasHeight) {
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.7)';
    ctx.lineWidth = 1.5;
    
    const numStreamlines = Math.min(30, Math.floor(canvasWidth / 30));
    const stepSize = Math.min(scaleX, scaleY) * 2;
    const maxSteps = Math.floor(Math.max(canvasWidth, canvasHeight) / stepSize);
    
    for (let i = 0; i < numStreamlines; i++) {
      const startX = (canvasWidth / (numStreamlines + 1)) * (i + 1);
      const startY = Math.random() * canvasHeight;
      
      this.traceStreamline(ctx, data, startX, startY, scaleX, scaleY, stepSize, maxSteps);
    }
  }
  
  // Helper: Interpolate magnitude at a point
  interpolateMagnitude(x, y, vectors) {
    let nearestVector = null;
    let minDistance = Infinity;
    
    for (const vector of vectors) {
      const distance = Math.sqrt((vector.x - x) ** 2 + (vector.y - y) ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        nearestVector = vector;
      }
    }
    
    return nearestVector ? nearestVector.magnitude : 0;
  }
  
  // Helper: Interpolate vector at a point
  interpolateVector(x, y, vectors) {
    return this.findNearestVector(x, y);
  }
  
  // Helper: Get Viridis colormap color
  getViridisColor(value) {
    value = Math.max(0, Math.min(1, value));
    
    // Viridis color scheme approximation
    if (value < 0.25) {
      const t = value / 0.25;
      return {
        r: Math.floor(68 + (72 - 68) * t),
        g: Math.floor(1 + (40 - 1) * t),
        b: Math.floor(84 + (120 - 84) * t)
      };
    } else if (value < 0.5) {
      const t = (value - 0.25) / 0.25;
      return {
        r: Math.floor(72 + (94 - 72) * t),
        g: Math.floor(40 + (79 - 40) * t),
        b: Math.floor(120 + (162 - 120) * t)
      };
    } else if (value < 0.75) {
      const t = (value - 0.5) / 0.25;
      return {
        r: Math.floor(94 + (134 - 94) * t),
        g: Math.floor(79 + (120 - 79) * t),
        b: Math.floor(162 + (142 - 162) * t)
      };
    } else {
      const t = (value - 0.75) / 0.25;
      return {
        r: Math.floor(134 + (253 - 134) * t),
        g: Math.floor(120 + (231 - 120) * t),
        b: Math.floor(142 + (37 - 142) * t)
      };
    }
  }
  
  // Helper: Draw arrow
  drawArrow(ctx, x1, y1, x2, y2) {
    const headSize = 4;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headSize * Math.cos(angle - Math.PI / 6),
      y2 - headSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headSize * Math.cos(angle + Math.PI / 6),
      y2 - headSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
  
  // Helper: Trace streamline
  traceStreamline(ctx, data, startX, startY, scaleX, scaleY, stepSize, maxSteps) {
    let x = startX;
    let y = startY;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    for (let step = 0; step < maxSteps; step++) {
      const dataX = x / scaleX;
      const dataY = y / scaleY;
      
      const vector = this.interpolateVector(dataX, dataY, data.vector_field);
      if (!vector || vector.magnitude < 0.1) break;
      
      const magnitude = vector.magnitude;
      const normalizedVx = (vector.vx / magnitude) * stepSize;
      const normalizedVy = (vector.vy / magnitude) * stepSize;
      
      x += normalizedVx;
      y += normalizedVy;
      
      // Check bounds
      const rect = this.canvas.getBoundingClientRect();
      if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) break;
      
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
  }
  
  // Update visualization mode
  updateVisualization() {
    if (this.state.currentModule === 'wind' && this.state.windData) {
      console.log(`🎨 Updating visualization mode: ${this.state.vizMode}`);
      this.renderWindVisualization();
    }
  }
  
  // Update canvas opacity
  updateOpacity() {
    if (this.canvas) {
      this.canvas.style.opacity = this.state.opacity / 100;
    }
  }
  
  // Show loading overlay
  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.toggle('active', show);
    }
    this.state.isLoading = show;
  }
  
  // Show toast notification
  showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.warn('⚠️  Toast container not found');
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas fa-${this.getToastIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
    
    // Click to dismiss
    toast.addEventListener('click', () => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
  }
  
  // Get icon for toast type
  getToastIcon(type) {
    const icons = {
      info: 'info-circle',
      success: 'check-circle',
      warning: 'exclamation-triangle',
      error: 'times-circle'
    };
    return icons[type] || 'info-circle';
  }
  
  // Show export dialog
  showExportDialog() {
    const message = this.state.apiConnected ? 
      'Export functionality will be available with your live data connection' : 
      'Connect to live data first to enable export functionality';
    
    this.showToast(message, 'info');
  }
  
  // Utility: Get wind direction name from degrees
  getWindDirectionName(degrees) {
    const directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  // Utility: Get relative time string
  getRelativeTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
}

// Initialize platform when DOM is ready - NO AUTO API CONNECTION
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded - initializing GIS Microclimate Platform');
  
  try {
    window.gisplatform = new GISMicroclimatePlatform();
    console.log('✅ Platform initialized successfully');
  } catch (error) {
    console.error('❌ Platform initialization failed:', error);
  }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (window.gisplatform) {
    if (document.hidden) {
      window.gisplatform.stopAutoRefresh();
    } else if (window.gisplatform.state.apiConnected && window.gisplatform.state.autoRefreshEnabled) {
      window.gisplatform.startAutoRefresh();
    }
  }
});

// Handle before unload
window.addEventListener('beforeunload', () => {
  if (window.gisplatform) {
    window.gisplatform.stopAutoRefresh();
  }
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GISMicroclimatePlatform;
}
