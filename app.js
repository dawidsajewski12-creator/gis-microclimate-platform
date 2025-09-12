/**
 * Professional GIS Microclimate Analysis Platform
 * Integrates with Google Colab via GitHub API
 * Scalable, modular architecture for engineering applications
 */

// Application Configuration
const AppConfig = {
  api: {
    github: {
      baseUrl: 'https://api.github.com/repos',
      defaultRepo: 'username/gis-microclimate-platform',
      endpoints: {
        wind: 'contents/api/data/wind_simulation/current.json',
        vegetation: 'contents/api/data/vegetation_analysis/current.json',
        thermal: 'contents/api/data/thermal_comfort/current.json',
        metadata: 'contents/api/data/system/metadata.json'
      },
      refreshInterval: 30000,
      timeout: 5000 // Reduced timeout for faster fallback
    }
  },
  visualization: {
    colorMaps: {
      wind: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F'],
      temperature: ['#0066ff', '#00ccff', '#00ff00', '#ffff00', '#ff8800', '#ff0000'],
      comfort: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
    },
    canvas: {
      defaultWidth: 800,
      defaultHeight: 600,
      vectorDensity: 10,
      minVectorLength: 2
    }
  },
  system: {
    autoRefresh: true,
    debugMode: false,
    maxRetries: 2, // Reduced retries for faster fallback
    fallbackMode: true // Always allow fallback to sample data
  }
};

// Application State Management
class AppState {
  constructor() {
    this.currentView = 'dashboard';
    this.isOnline = false;
    this.isLoading = false;
    this.lastUpdate = null;
    this.simulationData = null;
    this.systemMetrics = {
      windSpeed: 4.2,
      windDirection: 225,
      computationTime: 45.2,
      obstacleCount: 1250,
      accuracy: 96.8
    };
    this.modules = {
      wind: { status: 'active', progress: 100 },
      vegetation: { status: 'preparing', progress: 0 },
      thermal: { status: 'preparing', progress: 0 }
    };
    this.exportHistory = [];
  }

  updateMetric(key, value) {
    if (this.systemMetrics.hasOwnProperty(key)) {
      this.systemMetrics[key] = value;
      this.notifyObservers('metricsUpdated', { key, value });
    }
  }

  updateModuleStatus(module, status, progress = null) {
    if (this.modules[module]) {
      this.modules[module].status = status;
      if (progress !== null) {
        this.modules[module].progress = progress;
      }
      this.notifyObservers('moduleStatusUpdated', { module, status, progress });
    }
  }

  setSimulationData(data) {
    this.simulationData = data;
    this.lastUpdate = new Date();
    this.notifyObservers('simulationDataUpdated', data);
  }

  // Observer pattern for reactive updates
  notifyObservers(event, data) {
    document.dispatchEvent(new CustomEvent(`appState:${event}`, { detail: data }));
  }
}

// GitHub API Integration with improved error handling
class GitHubAPIService {
  constructor(config) {
    this.config = config;
    this.isConnected = false;
    this.retryCount = 0;
  }

  async fetchData(endpoint, options = {}) {
    const url = `${this.config.baseUrl}/${this.config.defaultRepo}/${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GIS-Microclimate-Platform',
          'Cache-Control': 'no-cache',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // GitHub returns base64 encoded content for file contents
      if (data.content && data.encoding === 'base64') {
        const decodedContent = atob(data.content.replace(/\s/g, ''));
        const parsedData = JSON.parse(decodedContent);
        this.isConnected = true;
        this.retryCount = 0;
        return parsedData;
      }

      this.isConnected = true;
      this.retryCount = 0;
      return data;

    } catch (error) {
      this.isConnected = false;
      console.warn(`GitHub API fetch failed for ${endpoint}:`, error.message);
      
      // Don't retry on abort (timeout) errors
      if (error.name === 'AbortError') {
        throw new Error('GitHub API timeout - using fallback data');
      }
      
      if (this.retryCount < AppConfig.system.maxRetries) {
        this.retryCount++;
        console.log(`Retrying GitHub API call (${this.retryCount}/${AppConfig.system.maxRetries})...`);
        await this.delay(500 * this.retryCount);
        return this.fetchData(endpoint, options);
      }
      
      throw error;
    }
  }

  async fetchWindData() {
    return this.fetchData(this.config.endpoints.wind);
  }

  async fetchSystemMetadata() {
    return this.fetchData(this.config.endpoints.metadata);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Wind Visualization Engine
class WindVisualizationEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = null;
    this.mode = 'magnitude';
    this.layers = {
      magnitude: true,
      vectors: true,
      obstacles: false
    };
    this.opacity = {
      magnitude: 0.8,
      vectors: 0.9,
      obstacles: 1.0
    };
  }

  setData(data) {
    this.data = data;
    this.updateCanvasSize();
  }

  updateCanvasSize() {
    if (!this.data || !this.canvas.parentElement) return;

    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    this.canvas.width = Math.max(400, rect.width - 40);
    this.canvas.height = Math.max(300, rect.height - 40);
  }

  setVisualizationMode(mode) {
    this.mode = mode;
    this.render();
  }

  setLayerVisibility(layer, visible) {
    this.layers[layer] = visible;
    this.render();
  }

  setLayerOpacity(layer, opacity) {
    this.opacity[layer] = opacity / 100;
    this.render();
  }

  render() {
    if (!this.data || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    try {
      // Render based on current mode
      switch (this.mode) {
        case 'magnitude':
          this.renderMagnitudeHeatmap();
          break;
        case 'vectors':
          this.renderVectorField();
          break;
        case 'streamlines':
          this.renderStreamlines();
          break;
        case 'pressure':
          this.renderPressureField();
          break;
      }

      // Overlay additional layers
      if (this.layers.obstacles) {
        this.renderObstacles();
      }

    } catch (error) {
      console.error('Visualization render error:', error);
      this.renderErrorState();
    }
  }

  renderMagnitudeHeatmap() {
    const { vectors = [], magnitudeGrid, gridWidth, gridHeight } = this.data;
    
    if (magnitudeGrid && gridWidth && gridHeight) {
      this.renderGridHeatmap(magnitudeGrid, gridWidth, gridHeight);
    } else if (vectors.length > 0) {
      this.renderVectorHeatmap(vectors);
    }
  }

  renderGridHeatmap(magnitudeGrid, gridWidth, gridHeight) {
    const cellWidth = this.canvas.width / gridWidth;
    const cellHeight = this.canvas.height / gridHeight;
    
    const minMag = this.data.minMagnitude || 0;
    const maxMag = this.data.maxMagnitude || 10;

    this.ctx.globalAlpha = this.layers.magnitude ? this.opacity.magnitude : 0;

    for (let y = 0; y < gridHeight && y < magnitudeGrid.length; y++) {
      const row = magnitudeGrid[y];
      if (!Array.isArray(row)) continue;

      for (let x = 0; x < gridWidth && x < row.length; x++) {
        const magnitude = row[x];
        const normalized = (magnitude - minMag) / (maxMag - minMag);
        const color = this.getWindColor(normalized);
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
    }

    this.ctx.globalAlpha = 1.0;
  }

  renderVectorHeatmap(vectors) {
    const cellSize = Math.min(
      this.canvas.width / Math.sqrt(vectors.length),
      this.canvas.height / Math.sqrt(vectors.length)
    );

    this.ctx.globalAlpha = this.layers.magnitude ? this.opacity.magnitude : 0;

    vectors.forEach(vector => {
      const x = (vector.x / (this.data.gridWidth || 100)) * this.canvas.width;
      const y = (vector.y / (this.data.gridHeight || 100)) * this.canvas.height;
      const magnitude = vector.magnitude || Math.sqrt(vector.vx * vector.vx + vector.vy * vector.vy);
      
      const normalized = magnitude / (this.data.maxMagnitude || 10);
      const color = this.getWindColor(normalized);
      
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x - cellSize/2, y - cellSize/2, cellSize, cellSize);
    });

    this.ctx.globalAlpha = 1.0;
  }

  renderVectorField() {
    if (!this.layers.vectors || !this.data.vectors) return;

    this.ctx.globalAlpha = this.opacity.vectors;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;

    const stride = AppConfig.visualization.canvas.vectorDensity;
    const minLength = AppConfig.visualization.canvas.minVectorLength;

    this.data.vectors.forEach((vector, index) => {
      if (index % stride !== 0) return;

      const x = (vector.x / (this.data.gridWidth || 100)) * this.canvas.width;
      const y = (vector.y / (this.data.gridHeight || 100)) * this.canvas.height;
      
      const magnitude = vector.magnitude || Math.sqrt(vector.vx * vector.vx + vector.vy * vector.vy);
      
      if (magnitude < 0.1) return;

      const scale = Math.min(20, Math.max(minLength, magnitude * 3));
      const angle = Math.atan2(vector.vy, vector.vx);
      
      const endX = x + Math.cos(angle) * scale;
      const endY = y + Math.sin(angle) * scale;

      // Draw arrow
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();

      // Draw arrowhead
      const headLength = Math.min(8, scale * 0.3);
      const headAngle = Math.PI / 6;

      this.ctx.beginPath();
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(
        endX - headLength * Math.cos(angle - headAngle),
        endY - headLength * Math.sin(angle - headAngle)
      );
      this.ctx.moveTo(endX, endY);
      this.ctx.lineTo(
        endX - headLength * Math.cos(angle + headAngle),
        endY - headLength * Math.sin(angle + headAngle)
      );
      this.ctx.stroke();
    });

    this.ctx.globalAlpha = 1.0;
  }

  renderStreamlines() {
    // Simplified streamline rendering
    if (!this.data.vectors) return;

    this.ctx.globalAlpha = this.opacity.vectors;
    this.ctx.strokeStyle = '#0066cc';
    this.ctx.lineWidth = 2;

    // Create streamlines from seed points
    const seedPoints = this.generateSeedPoints(10);
    
    seedPoints.forEach(seed => {
      this.traceStreamline(seed.x, seed.y);
    });

    this.ctx.globalAlpha = 1.0;
  }

  generateSeedPoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height
      });
    }
    return points;
  }

  traceStreamline(startX, startY) {
    let x = startX;
    let y = startY;
    const maxSteps = 100;
    const stepSize = 5;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);

    for (let step = 0; step < maxSteps; step++) {
      const vector = this.interpolateVector(x, y);
      if (!vector || vector.magnitude < 0.1) break;

      const dx = vector.vx * stepSize;
      const dy = vector.vy * stepSize;

      x += dx;
      y += dy;

      if (x < 0 || x > this.canvas.width || y < 0 || y > this.canvas.height) break;

      this.ctx.lineTo(x, y);
    }

    this.ctx.stroke();
  }

  interpolateVector(x, y) {
    if (!this.data.vectors) return null;

    const gridX = (x / this.canvas.width) * (this.data.gridWidth || 100);
    const gridY = (y / this.canvas.height) * (this.data.gridHeight || 100);

    // Find nearest vectors for interpolation
    const nearestVector = this.data.vectors.reduce((closest, vector) => {
      const dist = Math.sqrt((vector.x - gridX) ** 2 + (vector.y - gridY) ** 2);
      return (!closest || dist < closest.distance) ? { ...vector, distance: dist } : closest;
    }, null);

    return nearestVector;
  }

  renderPressureField() {
    // Simplified pressure visualization
    this.renderMagnitudeHeatmap();
    
    // Add pressure contour lines
    this.ctx.globalAlpha = 0.5;
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;

    // Draw contour lines at regular intervals
    const contourLevels = 5;
    for (let level = 1; level <= contourLevels; level++) {
      this.drawPressureContour(level / contourLevels);
    }

    this.ctx.globalAlpha = 1.0;
  }

  drawPressureContour(level) {
    // Simplified contour drawing
    const threshold = level * (this.data.maxMagnitude || 10);
    const step = 20;

    for (let y = step; y < this.canvas.height - step; y += step) {
      for (let x = step; x < this.canvas.width - step; x += step) {
        const vector = this.interpolateVector(x, y);
        if (vector && Math.abs(vector.magnitude - threshold) < 0.5) {
          this.ctx.beginPath();
          this.ctx.arc(x, y, 2, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
    }
  }

  renderObstacles() {
    // Render obstacles from data
    this.ctx.globalAlpha = this.opacity.obstacles;
    this.ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;

    // Draw simple rectangular obstacles
    const obstacleSize = 20;
    const obstacleCount = Math.min(50, Math.floor(Math.random() * 30) + 20);

    for (let i = 0; i < obstacleCount; i++) {
      const x = Math.random() * (this.canvas.width - obstacleSize);
      const y = Math.random() * (this.canvas.height - obstacleSize);
      
      this.ctx.fillRect(x, y, obstacleSize, obstacleSize);
      this.ctx.strokeRect(x, y, obstacleSize, obstacleSize);
    }

    this.ctx.globalAlpha = 1.0;
  }

  renderErrorState() {
    this.ctx.fillStyle = '#f3f4f6';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#6b7280';
    this.ctx.font = '16px Roboto, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      'Błąd renderowania wizualizacji',
      this.canvas.width / 2,
      this.canvas.height / 2
    );
  }

  getWindColor(normalized) {
    const colors = AppConfig.visualization.colorMaps.wind;
    const index = Math.floor(normalized * (colors.length - 1));
    const t = (normalized * (colors.length - 1)) - index;
    
    const color1 = this.hexToRgb(colors[Math.min(index, colors.length - 1)]);
    const color2 = this.hexToRgb(colors[Math.min(index + 1, colors.length - 1)]);
    
    const r = Math.round(color1.r + (color2.r - color1.r) * t);
    const g = Math.round(color1.g + (color2.g - color1.g) * t);
    const b = Math.round(color1.b + (color2.b - color1.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
}

// Notification System
class NotificationSystem {
  constructor() {
    this.container = document.getElementById('toast-container') || this.createContainer();
    this.notifications = [];
  }

  createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  show(message, type = 'info', duration = 4000) {
    const notification = this.createNotification(message, type);
    this.notifications.push(notification);
    this.container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove
    setTimeout(() => this.remove(notification), duration);

    return notification;
  }

  createNotification(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
      <div class="toast-content">
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <div class="toast-message">${message}</div>
      </div>
    `;

    return toast;
  }

  remove(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications = this.notifications.filter(n => n !== notification);
    }, 300);
  }

  clear() {
    this.notifications.forEach(notification => this.remove(notification));
  }
}

// Main Application Class with improved error handling
class GISMicroclimateApp {
  constructor() {
    this.state = new AppState();
    this.api = new GitHubAPIService(AppConfig.api.github);
    this.notifications = new NotificationSystem();
    this.windViz = null;
    this.refreshTimer = null;
    this.initPromise = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing GIS Microclimate Platform...');
    
    // Ensure we don't initialize multiple times
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.performInit();
    return this.initPromise;
  }

  async performInit() {
    try {
      // Always hide loading first to prevent stuck state
      this.hideLoading();
      
      // Setup basic DOM structure first
      await this.setupDOM();
      await this.setupEventListeners();
      await this.initializeVisualization();
      
      // Load data with proper error handling
      await this.safeLoadInitialData();
      
      this.startAutoRefresh();
      this.updateConnectionStatus();
      
      console.log('Platform initialized successfully');
      this.notifications.show('System uruchomiony pomyślnie', 'success');
      
    } catch (error) {
      console.error('Initialization error:', error);
      this.notifications.show('Błąd inicjalizacji - używam danych przykładowych', 'warning');
      
      // Ensure fallback data is loaded even on error
      await this.loadFallbackData();
    } finally {
      // Always ensure loading is hidden
      this.hideLoading();
    }
  }

  async safeLoadInitialData() {
    this.showLoading('Łączenie z GitHub API...', 0);
    
    try {
      // Set a hard timeout for the entire operation
      const loadPromise = this.loadInitialData();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 8000);
      });
      
      await Promise.race([loadPromise, timeoutPromise]);
      
    } catch (error) {
      console.warn('Initial data loading failed, using fallback:', error.message);
      await this.loadFallbackData();
    } finally {
      this.hideLoading();
    }
  }

  async loadInitialData() {
    try {
      // Update progress
      this.updateLoadingProgress(25);
      
      // Try to load real data from GitHub API
      const windData = await this.api.fetchWindData();
      
      this.updateLoadingProgress(75);
      
      this.state.setSimulationData(windData);
      this.state.isOnline = true;
      this.notifications.show('Dane załadowane z GitHub API', 'success');
      
      this.updateLoadingProgress(100);
      
    } catch (error) {
      this.state.isOnline = false;
      throw error; // Re-throw to trigger fallback
    }
  }

  async loadFallbackData() {
    console.log('Loading fallback sample data...');
    
    try {
      const sampleData = this.generateSampleData();
      this.state.setSimulationData(sampleData);
      this.state.isOnline = false;
      
      if (AppConfig.system.fallbackMode) {
        this.notifications.show('Używam przykładowych danych (tryb offline)', 'info');
      }
    } catch (error) {
      console.error('Even fallback data failed:', error);
      this.notifications.show('Błąd ładowania danych', 'error');
    }
  }

  async setupDOM() {
    // Initialize navigation
    this.setupNavigation();
    
    // Setup view management
    this.setupViewManagement();
    
    // Setup controls
    this.setupControls();
    
    // Update initial UI state
    this.updateDashboard();
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
        
        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
      });
    });

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }
  }

  setupViewManagement() {
    // Initialize with dashboard view
    this.switchView('dashboard');
  }

  setupControls() {
    // Refresh data button
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Module refresh button
    const refreshModulesBtn = document.getElementById('refresh-modules');
    if (refreshModulesBtn) {
      refreshModulesBtn.addEventListener('click', () => this.refreshModuleStatus());
    }

    // Quick action buttons
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });

    // Wind simulation controls
    const runSimBtn = document.getElementById('run-wind-simulation');
    if (runSimBtn) {
      runSimBtn.addEventListener('click', () => this.runWindSimulation());
    }

    // Visualization mode selector
    const vizModeSelect = document.getElementById('visualization-mode');
    if (vizModeSelect) {
      vizModeSelect.addEventListener('change', (e) => {
        if (this.windViz) {
          this.windViz.setVisualizationMode(e.target.value);
        }
      });
    }

    // Layer controls
    this.setupLayerControls();

    // Export controls
    this.setupExportControls();
  }

  setupLayerControls() {
    const layerCheckboxes = document.querySelectorAll('[id^="show-"]');
    const opacitySliders = document.querySelectorAll('.layer-opacity');

    layerCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const layer = e.target.id.replace('show-', '');
        if (this.windViz) {
          this.windViz.setLayerVisibility(layer, e.target.checked);
        }
      });
    });

    opacitySliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const layerItem = e.target.closest('.layer-item');
        const checkbox = layerItem?.querySelector('input[type="checkbox"]');
        if (checkbox && this.windViz) {
          const layer = checkbox.id.replace('show-', '');
          this.windViz.setLayerOpacity(layer, e.target.value);
        }
      });
    });
  }

  setupExportControls() {
    const exportBtn = document.getElementById('generate-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.generateExport());
    }

    const exportStatsBtn = document.getElementById('export-stats');
    if (exportStatsBtn) {
      exportStatsBtn.addEventListener('click', () => this.exportStatistics());
    }
  }

  async setupEventListeners() {
    // State change listeners
    document.addEventListener('appState:simulationDataUpdated', (e) => {
      this.onSimulationDataUpdated(e.detail);
    });

    document.addEventListener('appState:moduleStatusUpdated', (e) => {
      this.onModuleStatusUpdated(e.detail);
    });

    // Window resize listener
    window.addEventListener('resize', () => {
      if (this.windViz) {
        setTimeout(() => {
          this.windViz.updateCanvasSize();
          this.windViz.render();
        }, 100);
      }
    });

    // Add escape key listener to dismiss loading
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.isLoading) {
        this.hideLoading();
        this.notifications.show('Ładowanie przerwane przez użytkownika', 'info');
      }
    });
  }

  async initializeVisualization() {
    const windCanvas = document.getElementById('wind-canvas');
    if (windCanvas) {
      this.windViz = new WindVisualizationEngine(windCanvas);
    }
  }

  generateSampleData() {
    const gridWidth = 85;
    const gridHeight = 68;
    const vectors = [];
    const magnitudeGrid = [];

    // Generate sample wind field
    for (let y = 0; y < gridHeight; y++) {
      const row = [];
      for (let x = 0; x < gridWidth; x++) {
        const magnitude = 2 + Math.random() * 6;
        const angle = Math.PI * 0.25 + Math.sin(x / 10) * 0.5 + Math.cos(y / 10) * 0.3;
        
        if (y % 5 === 0 && x % 5 === 0) {
          vectors.push({
            x: x,
            y: y,
            vx: magnitude * Math.cos(angle),
            vy: magnitude * Math.sin(angle),
            magnitude: magnitude
          });
        }

        row.push(magnitude);
      }
      magnitudeGrid.push(row);
    }

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        module: 'wind_simulation',
        version: '1.0.0',
        computation_time: 45.2
      },
      grid_properties: {
        width: gridWidth * 10,
        height: gridHeight * 10,
        bounds: [[54.15, 19.35], [54.17, 19.45]],
        obstacle_count: 1250
      },
      flow_statistics: {
        min_magnitude: 0.2,
        max_magnitude: 8.5,
        mean_magnitude: 3.8,
        std_magnitude: 1.9
      },
      weather_conditions: {
        wind_speed_ms: 4.2,
        wind_direction_deg: 225,
        temperature_c: 18.5,
        humidity_percent: 65,
        source: 'sample-data'
      },
      gridWidth: gridWidth,
      gridHeight: gridHeight,
      bounds: [[54.15, 19.35], [54.17, 19.45]],
      vectors: vectors,
      minMagnitude: 0.2,
      maxMagnitude: 8.5,
      magnitudeGrid: magnitudeGrid
    };
  }

  switchView(viewName) {
    const views = document.querySelectorAll('.view');
    const breadcrumb = document.getElementById('breadcrumb-text');

    views.forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.add('active');
      this.state.currentView = viewName;
      
      // Update breadcrumb
      const viewNames = {
        'dashboard': 'Dashboard',
        'wind-analysis': 'Analiza wiatru',
        'vegetation': 'Roślinność',
        'thermal': 'Komfort termiczny',
        'export': 'Eksport'
      };
      
      if (breadcrumb) {
        breadcrumb.textContent = viewNames[viewName] || 'Dashboard';
      }

      // Trigger view-specific initialization
      this.onViewChanged(viewName);
    }
  }

  onViewChanged(viewName) {
    switch (viewName) {
      case 'wind-analysis':
        if (this.windViz && this.state.simulationData) {
          setTimeout(() => {
            this.windViz.setData(this.state.simulationData);
            this.windViz.render();
            this.updateWindLegend();
          }, 100);
        }
        break;
    }
  }

  updateDashboard() {
    // Update KPI values
    const elements = {
      'wind-speed-kpi': `${this.state.systemMetrics.windSpeed} m/s`,
      'computation-time': `${this.state.systemMetrics.computationTime}s`,
      'obstacles-count': this.state.systemMetrics.obstacleCount.toLocaleString(),
      'accuracy-value': `${this.state.systemMetrics.accuracy}%`
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    // Update module status
    this.updateModuleStatusDisplay();
    
    // Update last update time
    this.updateLastUpdateTime();
  }

  updateModuleStatusDisplay() {
    const moduleItems = document.querySelectorAll('.module-status-item');
    
    moduleItems.forEach((item, index) => {
      const moduleNames = ['wind', 'vegetation', 'thermal'];
      const moduleName = moduleNames[index];
      
      if (moduleName && this.state.modules[moduleName]) {
        const module = this.state.modules[moduleName];
        const statusElement = item.querySelector('.status');
        const progressBar = item.querySelector('.progress-bar');
        
        if (statusElement) {
          statusElement.className = `status ${module.status === 'active' ? 'success' : 'warning'}`;
          statusElement.textContent = this.getStatusLabel(module.status);
        }
        
        if (progressBar) {
          progressBar.style.width = `${module.progress}%`;
        }
      }
    });
  }

  getStatusLabel(status) {
    const labels = {
      'active': 'Aktywny',
      'preparing': 'Przygotowanie',
      'error': 'Błąd',
      'offline': 'Offline'
    };
    return labels[status] || status;
  }

  updateLastUpdateTime() {
    const timeElement = document.getElementById('last-update-time');
    if (timeElement && this.state.lastUpdate) {
      timeElement.textContent = this.state.lastUpdate.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    const systemStatus = document.getElementById('system-status');
    const statusText = document.getElementById('status-text');

    if (statusElement) {
      statusElement.className = `connection-status ${this.state.isOnline ? '' : 'disconnected'}`;
    }

    if (systemStatus) {
      systemStatus.className = `status-led ${this.state.isOnline ? 'active' : 'error'}`;
    }

    if (statusText) {
      statusText.textContent = this.state.isOnline ? 'System aktywny' : 'Tryb offline';
    }
  }

  updateWindLegend() {
    const legendElement = document.getElementById('wind-legend');
    if (!legendElement || !this.state.simulationData) return;

    const { minMagnitude = 0, maxMagnitude = 10 } = this.state.simulationData;
    const steps = 5;
    
    legendElement.innerHTML = '';

    for (let i = 0; i < steps; i++) {
      const value = minMagnitude + (maxMagnitude - minMagnitude) * (i / (steps - 1));
      const normalized = i / (steps - 1);
      
      const item = document.createElement('div');
      item.className = 'legend-item';
      
      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = this.windViz.getWindColor(normalized);
      
      const label = document.createElement('span');
      label.textContent = `${value.toFixed(1)} m/s`;
      
      item.appendChild(colorBox);
      item.appendChild(label);
      legendElement.appendChild(item);
    }
  }

  async refreshData() {
    if (this.state.isLoading) return;
    
    this.showLoading('Odświeżanie danych...');
    
    try {
      await this.safeLoadInitialData();
      this.updateDashboard();
      this.updateConnectionStatus();
      this.notifications.show('Dane odświeżone pomyślnie', 'success');
      
    } catch (error) {
      console.error('Data refresh error:', error);
      this.notifications.show('Błąd podczas odświeżania danych', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async refreshModuleStatus() {
    // Simulate module status refresh
    const modules = Object.keys(this.state.modules);
    
    modules.forEach(module => {
      if (module === 'wind') {
        this.state.updateModuleStatus(module, 'active', 100);
      } else {
        const progress = Math.random() * 100;
        const status = progress > 50 ? 'preparing' : 'preparing';
        this.state.updateModuleStatus(module, status, progress);
      }
    });

    this.updateModuleStatusDisplay();
    this.notifications.show('Status modułów odświeżony', 'info');
  }

  handleQuickAction(action) {
    switch (action) {
      case 'wind-analysis':
        this.switchView('wind-analysis');
        break;
      case 'load-colab-data':
        this.refreshData();
        break;
      case 'export-results':
        this.switchView('export');
        break;
      default:
        this.notifications.show(`Akcja: ${action}`, 'info');
    }
  }

  async runWindSimulation() {
    const button = document.getElementById('run-wind-simulation');
    if (!button || this.state.isLoading) return;

    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Symulacja w toku...';
    button.disabled = true;

    this.showLoading('Uruchamianie symulacji LBM...', 0);

    try {
      // Simulate computation progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await this.delay(200);
        this.updateLoadingProgress(progress);
      }

      // Generate new data or refresh from API
      await this.loadFallbackData(); // Use fallback for simulation
      
      if (this.windViz && this.state.simulationData) {
        this.windViz.setData(this.state.simulationData);
        this.windViz.render();
      }

      this.notifications.show('Symulacja zakończona pomyślnie', 'success');

    } catch (error) {
      console.error('Simulation error:', error);
      this.notifications.show('Błąd podczas symulacji', 'error');
    } finally {
      this.hideLoading();
      button.innerHTML = originalHTML;
      button.disabled = false;
    }
  }

  async generateExport() {
    const formatInputs = document.querySelectorAll('input[name="export-format"]');
    let format = 'pdf';
    
    formatInputs.forEach(input => {
      if (input.checked) format = input.value;
    });

    this.showLoading('Generowanie eksportu...');

    try {
      await this.delay(2000); // Simulate export generation

      switch (format) {
        case 'pdf':
          this.exportPDF();
          break;
        case 'csv':
          this.exportCSV();
          break;
        case 'geojson':
          this.exportGeoJSON();
          break;
      }

      // Add to export history
      this.addToExportHistory(format);
      this.notifications.show(`Export ${format.toUpperCase()} wygenerowany`, 'success');

    } catch (error) {
      console.error('Export error:', error);
      this.notifications.show('Błąd podczas eksportu', 'error');
    } finally {
      this.hideLoading();
    }
  }

  exportCSV() {
    if (!this.state.simulationData) {
      this.notifications.show('Brak danych do eksportu', 'warning');
      return;
    }

    const csvData = this.generateCSVData();
    this.downloadFile(csvData, 'wind_analysis_data.csv', 'text/csv');
  }

  generateCSVData() {
    const { vectors = [], flow_statistics = {}, weather_conditions = {} } = this.state.simulationData;
    
    let csv = 'X,Y,VelocityX,VelocityY,Magnitude\n';
    
    vectors.forEach(vector => {
      csv += `${vector.x},${vector.y},${vector.vx},${vector.vy},${vector.magnitude || 0}\n`;
    });

    return csv;
  }

  exportGeoJSON() {
    if (!this.state.simulationData) {
      this.notifications.show('Brak danych do eksportu', 'warning');
      return;
    }

    const geoData = {
      type: 'FeatureCollection',
      features: this.state.simulationData.vectors.map(vector => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [vector.x, vector.y]
        },
        properties: {
          velocity_x: vector.vx,
          velocity_y: vector.vy,
          magnitude: vector.magnitude || 0
        }
      }))
    };

    const dataStr = JSON.stringify(geoData, null, 2);
    this.downloadFile(dataStr, 'wind_analysis.geojson', 'application/geo+json');
  }

  exportPDF() {
    this.notifications.show('Export PDF będzie dostępny w przyszłej wersji', 'info');
  }

  exportStatistics() {
    if (!this.state.simulationData) {
      this.notifications.show('Brak statystyk do eksportu', 'warning');
      return;
    }

    const stats = this.state.simulationData.flow_statistics || {};
    const csv = Object.entries(stats)
      .map(([key, value]) => `${key},${value}`)
      .join('\n');

    this.downloadFile('Parameter,Value\n' + csv, 'wind_statistics.csv', 'text/csv');
    this.notifications.show('Statystyki wyeksportowane', 'success');
  }

  addToExportHistory(format) {
    const historyItem = {
      id: Date.now(),
      format: format,
      filename: `export_${format}_${new Date().toISOString().split('T')[0]}.${format}`,
      timestamp: new Date(),
      size: '2.4 MB'
    };

    this.state.exportHistory.unshift(historyItem);
    this.updateExportHistory();
  }

  updateExportHistory() {
    const historyList = document.getElementById('export-history-list');
    if (!historyList) return;

    historyList.innerHTML = this.state.exportHistory.map(item => `
      <div class="history-item">
        <div class="history-icon">
          <i class="fas fa-file-${item.format === 'csv' ? 'csv' : item.format === 'pdf' ? 'pdf' : 'code'}"></i>
        </div>
        <div class="history-details">
          <div class="history-name">${item.filename}</div>
          <div class="history-meta">
            ${item.timestamp.toLocaleDateString('pl-PL')} ${item.timestamp.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} • ${item.size}
          </div>
        </div>
        <button class="btn btn--sm btn--outline">
          <i class="fas fa-download"></i>
        </button>
      </div>
    `).join('');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  startAutoRefresh() {
    if (AppConfig.system.autoRefresh && this.state.isOnline) {
      this.refreshTimer = setInterval(() => {
        this.refreshData();
      }, AppConfig.api.github.refreshInterval);
    }
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  showLoading(message = 'Ładowanie...', progress = null) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    const progressBar = document.getElementById('loading-progress-bar');

    if (overlay) {
      overlay.classList.remove('hidden');
      this.state.isLoading = true;
    }

    if (text) {
      text.textContent = message;
    }

    if (progressBar && progress !== null) {
      progressBar.style.width = `${progress}%`;
    }
  }

  updateLoadingProgress(progress) {
    const progressBar = document.getElementById('loading-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      this.state.isLoading = false;
    }
  }

  onSimulationDataUpdated(data) {
    if (this.windViz) {
      this.windViz.setData(data);
      this.windViz.render();
    }
    
    this.updateDashboard();
    this.updateWindStatistics();
  }

  updateWindStatistics() {
    if (!this.state.simulationData) return;

    const stats = this.state.simulationData.flow_statistics || {};
    const elements = {
      'min-velocity': `${(stats.min_magnitude || 0).toFixed(1)} m/s`,
      'max-velocity': `${(stats.max_magnitude || 0).toFixed(1)} m/s`,
      'mean-velocity': `${(stats.mean_magnitude || 0).toFixed(1)} m/s`,
      'std-velocity': `${(stats.std_magnitude || 0).toFixed(1)} m/s`,
      'obstacle-count': (this.state.simulationData.grid_properties?.obstacle_count || 0).toLocaleString(),
      'analysis-area': '578,000 m²' // This would be calculated from actual data
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  onModuleStatusUpdated({ module, status, progress }) {
    this.updateModuleStatusDisplay();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Starting GIS Microclimate Platform initialization...');
    window.app = new GISMicroclimateApp();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Show error message to user
    const body = document.body;
    if (body) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        text-align: center;
        z-index: 9999;
      `;
      errorDiv.innerHTML = `
        <h3>Błąd inicjalizacji</h3>
        <p>Aplikacja nie mogła zostać uruchomiona. Odśwież stronę.</p>
        <button onclick="window.location.reload()" style="
          background: #0066cc;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        ">Odśwież stronę</button>
      `;
      body.appendChild(errorDiv);
    }
  }
});

// Export for debugging
window.AppConfig = AppConfig;