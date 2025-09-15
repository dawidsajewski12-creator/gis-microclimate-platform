class MicroclimateMappingApp {
    constructor() {
        this.map = null;
        this.windCanvas = null;
        this.windCtx = null;
        this.particles = [];
        this.windData = null;
        this.animationId = null;
        this.isAnimating = false;
        this.isFullscreen = false;
        
        // Warstwy
        this.layers = {
            windParticles: true,
            windStreamlines: false,
            buildings: false,
            windContours: false
        };
        
        // Ustawienia
        this.settings = {
            particleCount: 1000,
            animationSpeed: 1.0,
            particleSize: 1.5,
            trailLength: 10,
            colorScale: ['#0000ff', '#00ff00', '#ffff00', '#ff0000']
        };
        
        this.buildingLayer = null;
        this.buildingsData = [];
        
        this.init();
    }
    
    init() {
        this.showLoadingIndicator();
        this.initMap();
        this.initWindCanvas();
        this.initControls();
        this.loadSampleData();
        this.setupEventListeners();
        this.startAnimation();
        this.hideLoadingIndicator();
    }
    
    showLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    initMap() {
        // Inicjalizacja mapy Leaflet
        this.map = L.map('map', {
            center: [52.0, 19.0], // Centrum Polski
            zoom: 7,
            zoomControl: true,
            attributionControl: true
        });
        
        // Dodanie warstwy OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
        
        // Event listener dla kliknięć na mapie
        this.map.on('click', (e) => {
            this.showWindInfo(e.latlng);
        });
        
        // Event listener dla ruchu myszy
        this.map.on('mousemove', (e) => {
            this.updateMousePosition(e.latlng);
        });
    }
    
    initWindCanvas() {
        this.windCanvas = document.getElementById('windCanvas');
        this.windCtx = this.windCanvas.getContext('2d');
        
        // Ustawienie rozmiaru canvas
        this.resizeCanvas();
        
        // Event listener dla zmiany rozmiaru okna
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        
        // Ustawienia kontekstu dla lepszej wydajności
        this.windCtx.globalCompositeOperation = 'source-over';
        this.windCtx.lineWidth = 1;
    }
    
    resizeCanvas() {
        const mapContainer = document.querySelector('.map-container');
        this.windCanvas.width = mapContainer.clientWidth;
        this.windCanvas.height = mapContainer.clientHeight;
    }
    
    initControls() {
        // Inicjalizacja kontrolek
        const particleCountSlider = document.getElementById('particleCount');
        const animationSpeedSlider = document.getElementById('animationSpeed');
        const visualStyleSelect = document.getElementById('visualStyle');
        
        // Event listeners dla sliderów
        particleCountSlider.addEventListener('input', (e) => {
            this.settings.particleCount = parseInt(e.target.value);
            document.getElementById('particleCountValue').textContent = e.target.value;
            this.regenerateParticles();
        });
        
        animationSpeedSlider.addEventListener('input', (e) => {
            this.settings.animationSpeed = parseFloat(e.target.value);
            document.getElementById('animationSpeedValue').textContent = e.target.value + 'x';
        });
        
        // Event listeners dla checkboxów warstw
        Object.keys(this.layers).forEach(layerName => {
            const checkbox = document.getElementById(layerName);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.layers[layerName] = e.target.checked;
                    this.updateLayerVisibility(layerName, e.target.checked);
                });
            }
        });
        
        // Event listener dla stylu wizualizacji
        visualStyleSelect.addEventListener('change', (e) => {
            this.updateVisualizationStyle(e.target.value);
        });
    }
    
    setupEventListeners() {
        // Toggle panel
        document.getElementById('togglePanel').addEventListener('click', () => {
            const panel = document.getElementById('controlPanel');
            panel.classList.toggle('collapsed');
        });
        
        // Reset widoku
        document.getElementById('resetView').addEventListener('click', () => {
            this.map.setView([52.0, 19.0], 7);
        });
        
        // Pełny ekran
        document.getElementById('fullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // Export PNG
        document.getElementById('exportView').addEventListener('click', () => {
            this.exportToPNG();
        });
        
        // Event listener dla klawisza Escape (wyjście z pełnego ekranu)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });
    }
    
    loadSampleData() {
        // Ładowanie przykładowych danych wiatru
        this.windData = this.generateSampleWindData();
        
        // Ładowanie danych budynków
        this.buildingsData = [
            {lat: 52.2297, lng: 21.0122, height: 15.5, name: "Budynek Warszawa 1"},
            {lat: 52.2317, lng: 21.0144, height: 25.2, name: "Budynek Warszawa 2"},
            {lat: 52.2287, lng: 21.0156, height: 12.8, name: "Budynek Warszawa 3"},
            {lat: 50.0647, lng: 19.9450, height: 18.3, name: "Budynek Kraków 1"},
            {lat: 50.0667, lng: 19.9470, height: 22.1, name: "Budynek Kraków 2"}
        ];
        
        this.initializeParticles();
        this.initializeBuildingLayer();
    }
    
    generateSampleWindData() {
        const width = 100;
        const height = 60;
        const bounds = [49.0, 14.0, 55.0, 24.0]; // [south, west, north, east]
        
        const u = new Float32Array(width * height);
        const v = new Float32Array(width * height);
        
        // Generowanie przykładowych danych wiatru z wzorcem cyrkulacji
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const index = i * width + j;
                const x = j / width;
                const y = i / height;
                
                // Tworzenie wzorca cyrkulacji z wariancją
                const centerX = 0.5;
                const centerY = 0.5;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Prędkość bazowa z wzorcem wiru
                const baseSpeed = Math.sin(x * Math.PI * 2) * Math.cos(y * Math.PI * 2) * 0.3;
                const vortexStrength = Math.exp(-distance * 3) * 0.5;
                
                u[index] = (-dy * vortexStrength + baseSpeed + (Math.random() - 0.5) * 0.1) * 10;
                v[index] = (dx * vortexStrength + baseSpeed * 0.5 + (Math.random() - 0.5) * 0.1) * 10;
            }
        }
        
        return {
            width,
            height,
            bounds,
            u,
            v,
            timestamp: new Date().toISOString()
        };
    }
    
    initializeParticles() {
        this.particles = [];
        for (let i = 0; i < this.settings.particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    createParticle() {
        const bounds = this.map.getBounds();
        return {
            lat: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
            lng: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
            age: 0,
            maxAge: Math.random() * 50 + 50,
            speed: 0,
            u: 0,
            v: 0
        };
    }
    
    regenerateParticles() {
        const currentCount = this.particles.length;
        const targetCount = this.settings.particleCount;
        
        if (targetCount > currentCount) {
            // Dodaj cząsteczki
            for (let i = 0; i < targetCount - currentCount; i++) {
                this.particles.push(this.createParticle());
            }
        } else if (targetCount < currentCount) {
            // Usuń cząsteczki
            this.particles.splice(targetCount);
        }
    }
    
    initializeBuildingLayer() {
        this.buildingLayer = L.layerGroup();
        
        this.buildingsData.forEach(building => {
            const marker = L.circleMarker([building.lat, building.lng], {
                radius: Math.max(4, building.height / 3),
                fillColor: '#e6814c',
                color: '#a84b2f',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6,
                className: 'building-marker'
            });
            
            marker.bindPopup(`
                <div class="building-popup">
                    <div class="popup-title">${building.name}</div>
                    <div class="popup-height">Wysokość: ${building.height}m</div>
                </div>
            `);
            
            this.buildingLayer.addLayer(marker);
        });
    }
    
    updateLayerVisibility(layerName, visible) {
        switch (layerName) {
            case 'buildings':
                if (visible) {
                    this.map.addLayer(this.buildingLayer);
                } else {
                    this.map.removeLayer(this.buildingLayer);
                }
                break;
            // Inne warstwy są renderowane w animacji
        }
    }
    
    updateVisualizationStyle(style) {
        switch (style) {
            case 'particles':
                this.layers.windParticles = true;
                this.layers.windStreamlines = false;
                break;
            case 'streamlines':
                this.layers.windParticles = false;
                this.layers.windStreamlines = true;
                break;
            case 'both':
                this.layers.windParticles = true;
                this.layers.windStreamlines = true;
                break;
        }
        
        // Aktualizuj checkboxy
        document.getElementById('windParticles').checked = this.layers.windParticles;
        document.getElementById('windStreamlines').checked = this.layers.windStreamlines;
    }
    
    getWindAtPosition(lat, lng) {
        if (!this.windData) return {u: 0, v: 0, speed: 0};
        
        const bounds = this.windData.bounds;
        const width = this.windData.width;
        const height = this.windData.height;
        
        // Konwersja współrzędnych geograficznych do indeksów siatki
        const x = ((lng - bounds[1]) / (bounds[3] - bounds[1])) * (width - 1);
        const y = ((lat - bounds[0]) / (bounds[2] - bounds[0])) * (height - 1);
        
        if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) {
            return {u: 0, v: 0, speed: 0};
        }
        
        // Interpolacja dwuliniowa
        const x1 = Math.floor(x);
        const x2 = Math.ceil(x);
        const y1 = Math.floor(y);
        const y2 = Math.ceil(y);
        
        const dx = x - x1;
        const dy = y - y1;
        
        const getIndex = (i, j) => Math.min(Math.max(0, i), height - 1) * width + Math.min(Math.max(0, j), width - 1);
        
        const u11 = this.windData.u[getIndex(y1, x1)];
        const u12 = this.windData.u[getIndex(y1, x2)];
        const u21 = this.windData.u[getIndex(y2, x1)];
        const u22 = this.windData.u[getIndex(y2, x2)];
        
        const v11 = this.windData.v[getIndex(y1, x1)];
        const v12 = this.windData.v[getIndex(y1, x2)];
        const v21 = this.windData.v[getIndex(y2, x1)];
        const v22 = this.windData.v[getIndex(y2, x2)];
        
        const u = u11 * (1 - dx) * (1 - dy) + u12 * dx * (1 - dy) + u21 * (1 - dx) * dy + u22 * dx * dy;
        const v = v11 * (1 - dx) * (1 - dy) + v12 * dx * (1 - dy) + v21 * (1 - dx) * dy + v22 * dx * dy;
        
        const speed = Math.sqrt(u * u + v * v);
        
        return {u, v, speed};
    }
    
    getSpeedColor(speed) {
        const maxSpeed = 15; // m/s
        const normalizedSpeed = Math.min(speed / maxSpeed, 1);
        
        const colors = [
            {r: 0, g: 0, b: 255, t: 0},     // niebieski - 0 m/s
            {r: 0, g: 255, b: 0, t: 0.33},  // zielony - 5 m/s
            {r: 255, g: 255, b: 0, t: 0.66}, // żółty - 10 m/s
            {r: 255, g: 0, b: 0, t: 1}      // czerwony - 15+ m/s
        ];
        
        for (let i = 0; i < colors.length - 1; i++) {
            if (normalizedSpeed >= colors[i].t && normalizedSpeed <= colors[i + 1].t) {
                const t = (normalizedSpeed - colors[i].t) / (colors[i + 1].t - colors[i].t);
                const r = Math.round(colors[i].r + (colors[i + 1].r - colors[i].r) * t);
                const g = Math.round(colors[i].g + (colors[i + 1].g - colors[i].g) * t);
                const b = Math.round(colors[i].b + (colors[i + 1].b - colors[i].b) * t);
                return `rgba(${r}, ${g}, ${b}, 0.8)`;
            }
        }
        
        return 'rgba(255, 0, 0, 0.8)';
    }
    
    updateParticles() {
        this.particles.forEach(particle => {
            const wind = this.getWindAtPosition(particle.lat, particle.lng);
            
            // Aktualizacja prędkości cząsteczki
            const scale = 0.0001 * this.settings.animationSpeed;
            particle.u = wind.u;
            particle.v = wind.v;
            particle.speed = wind.speed;
            
            // Ruch cząsteczki
            particle.lat += wind.v * scale;
            particle.lng += wind.u * scale;
            
            // Zwiększenie wieku
            particle.age++;
            
            // Reset cząsteczki jeśli jest zbyt stara lub poza granicami
            const bounds = this.map.getBounds();
            if (particle.age > particle.maxAge || 
                particle.lat < bounds.getSouth() || particle.lat > bounds.getNorth() ||
                particle.lng < bounds.getWest() || particle.lng > bounds.getEast()) {
                
                const newParticle = this.createParticle();
                Object.assign(particle, newParticle);
            }
        });
    }
    
    drawParticles() {
        if (!this.layers.windParticles) return;
        
        this.windCtx.globalCompositeOperation = 'destination-out';
        this.windCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.windCtx.fillRect(0, 0, this.windCanvas.width, this.windCanvas.height);
        
        this.windCtx.globalCompositeOperation = 'source-over';
        
        this.particles.forEach(particle => {
            const point = this.map.latLngToContainerPoint([particle.lat, particle.lng]);
            
            if (point.x >= 0 && point.x <= this.windCanvas.width && 
                point.y >= 0 && point.y <= this.windCanvas.height) {
                
                const color = this.getSpeedColor(particle.speed);
                const alpha = 1 - (particle.age / particle.maxAge);
                
                this.windCtx.fillStyle = color.replace('0.8', alpha.toFixed(2));
                this.windCtx.beginPath();
                this.windCtx.arc(point.x, point.y, this.settings.particleSize, 0, Math.PI * 2);
                this.windCtx.fill();
            }
        });
    }
    
    drawStreamlines() {
        if (!this.layers.windStreamlines) return;
        
        const bounds = this.map.getBounds();
        const step = 0.1; // Krok w stopniach
        
        this.windCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.windCtx.lineWidth = 1;
        
        for (let lat = bounds.getSouth(); lat < bounds.getNorth(); lat += step) {
            for (let lng = bounds.getWest(); lng < bounds.getEast(); lng += step) {
                this.drawStreamline(lat, lng);
            }
        }
    }
    
    drawStreamline(startLat, startLng) {
        const points = [];
        let lat = startLat;
        let lng = startLng;
        const maxLength = 20;
        const stepSize = 0.01;
        
        for (let i = 0; i < maxLength; i++) {
            const wind = this.getWindAtPosition(lat, lng);
            if (wind.speed < 0.1) break;
            
            const point = this.map.latLngToContainerPoint([lat, lng]);
            points.push(point);
            
            lat += wind.v * stepSize * 0.001;
            lng += wind.u * stepSize * 0.001;
        }
        
        if (points.length > 1) {
            this.windCtx.beginPath();
            this.windCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.windCtx.lineTo(points[i].x, points[i].y);
            }
            this.windCtx.stroke();
        }
    }
    
    animate() {
        if (!this.isAnimating) return;
        
        this.updateParticles();
        
        // Wyczyść canvas
        this.windCtx.clearRect(0, 0, this.windCanvas.width, this.windCanvas.height);
        
        // Rysuj warstwy
        this.drawParticles();
        this.drawStreamlines();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animate();
        }
    }
    
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    showWindInfo(latlng) {
        const wind = this.getWindAtPosition(latlng.lat, latlng.lng);
        const direction = Math.atan2(wind.v, wind.u) * 180 / Math.PI;
        const normalizedDirection = ((direction + 360) % 360); // Normalizacja do 0-360
        const compassDirection = this.getCompassDirection(normalizedDirection);
        
        document.getElementById('windSpeed').textContent = `${wind.speed.toFixed(1)} m/s`;
        document.getElementById('windDirection').textContent = `${compassDirection} (${normalizedDirection.toFixed(0)}°)`;
        
        L.popup()
            .setLatLng(latlng)
            .setContent(`
                <strong>Dane wiatru:</strong><br>
                Prędkość: ${wind.speed.toFixed(1)} m/s<br>
                Kierunek: ${compassDirection} (${normalizedDirection.toFixed(0)}°)
            `)
            .openOn(this.map);
    }
    
    updateMousePosition(latlng) {
        document.getElementById('mousePosition').textContent = 
            `${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
    }
    
    getCompassDirection(degrees) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(degrees / 45) % 8;
        return directions[index];
    }
    
    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }
    
    enterFullscreen() {
        this.isFullscreen = true;
        document.body.classList.add('fullscreen');
        
        // Zmień tekst przycisku
        document.getElementById('fullscreen').textContent = 'Wyjdź z pełnego ekranu';
        
        setTimeout(() => {
            this.map.invalidateSize();
            this.resizeCanvas();
        }, 300);
    }
    
    exitFullscreen() {
        this.isFullscreen = false;
        document.body.classList.remove('fullscreen');
        
        // Zmień tekst przycisku
        document.getElementById('fullscreen').textContent = 'Pełny ekran';
        
        setTimeout(() => {
            this.map.invalidateSize();
            this.resizeCanvas();
        }, 300);
    }
    
    exportToPNG() {
        // Stwórz tymczasowy canvas z mapą i wizualizacją
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.windCanvas.width;
        tempCanvas.height = this.windCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Skopiuj dane z wind canvas
        tempCtx.drawImage(this.windCanvas, 0, 0);
        
        // Pobierz jako PNG
        const link = document.createElement('a');
        link.download = `wind_visualization_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = tempCanvas.toDataURL();
        link.click();
    }
}

// Inicjalizacja aplikacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    new MicroclimateMappingApp();
});