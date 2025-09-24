/**
 * UPORZĄDKOWANA WERSJA APP.JS
 * Autor: Refaktoryzacja kodu aplikacji wizualizacji symulacji wiatru
 * Wersja: 2.0 - Przepisane dla czytelności i wydajności
 */

// ======================================================
// 1. KONFIGURACJA GLOBALNA I ZMIENNE
// ======================================================

// Główne zmienne globalne aplikacji
let windSimulationData = null;
let maps = {
    wind: null,
    risk: null,
    comfort: null,
    gallery: null
};

// Kontrolki warstw map
let layerControls = {};

// Warstwy wizualizacji
let visualizationLayers = {
    velocityField: null,
    windParticles: null,
    windArrows: null,
    heatmap: null
};

// Stan aktualnej wizualizacji
let visualizationState = {
    currentDataset: null,
    isPlaying: false,
    playbackSpeed: 1,
    selectedParameters: new Set()
};

// Konfiguracja wizualizacji wiatru
const WIND_CONFIG = {
    PARTICLE_COUNT: 3000,
    PARTICLE_SPEED_SCALE: 0.5,
    PARTICLE_LIFESPAN: 1500,
    PARTICLE_LINE_WIDTH: 1.6,
    PARTICLE_COLOR: "rgba(110, 190, 255, 0.8)",
    GLOW_COLOR: "rgba(110, 190, 255, 0.5)",
    GLOW_BLUR: 7,
    ARROW_SIZE: 12,
    ARROW_COLOR: "#00f5ff",
    HEATMAP_OPACITY: 0.6
};

// Kolory dla różnych skal
const COLOR_SCALES = {
    viridis: {
        name: 'Viridis',
        colors: ['#440154', '#31688e', '#35b779', '#fde725']
    },
    temperature: {
        name: 'Temperature',
        colors: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
    },
    wind: {
        name: 'Wind Speed',
        colors: ['#001f3f', '#2E8B57', '#FFD700', '#FF8C00', '#FF4500', '#DC143C']
    }
};

// ======================================================
// 2. INICJALIZACJA APLIKACJI
// ======================================================

/**
 * Główna funkcja inicjalizująca aplikację
 */
async function initializeApplication() {
    console.log('🚀 Inicjalizacja aplikacji...');
    
    try {
        // Inicjalizuj interfejs użytkownika
        await initializeUI();
        
        // Załaduj dane symulacji
        await loadWindSimulationData();
        
        // Inicjalizuj mapy
        await initializeMaps();
        
        // Uruchom główną funkcjonalność
        console.log('✅ Aplikacja zainicjalizowana pomyślnie');
        
    } catch (error) {
        console.error('❌ Błąd inicjalizacji aplikacji:', error);
        showError('Nie udało się zainicjalizować aplikacji. Sprawdź konsolę dla szczegółów.');
    }
}

/**
 * Inicjalizuje interfejs użytkownika
 */
async function initializeUI() {
    console.log('📱 Inicjalizacja interfejsu użytkownika...');
    
    // Ukryj loader po załadowaniu
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
    
    // Inicjalizuj kontrolki
    initializeControls();
    
    // Dodaj listenery eventów
    attachEventListeners();
}

/**
 * Inicjalizuje kontrolki interfejsu
 */
function initializeControls() {
    // Kontrolki odtwarzania animacji
    const playButton = document.getElementById('play-btn');
    const speedSlider = document.getElementById('speed-slider');
    const parameterCheckboxes = document.querySelectorAll('input[name="parameter"]');
    
    if (playButton) {
        playButton.addEventListener('click', togglePlayback);
    }
    
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            visualizationState.playbackSpeed = parseFloat(e.target.value);
        });
    }
    
    // Obsługa checkboxów parametrów
    parameterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                visualizationState.selectedParameters.add(e.target.value);
            } else {
                visualizationState.selectedParameters.delete(e.target.value);
            }
            updateVisualization();
        });
    });
}

/**
 * Dołącza event listenery
 */
function attachEventListeners() {
    // Obsługa zmiany rozmiaru okna
    window.addEventListener('resize', debounce(handleWindowResize, 300));
    
    // Obsługa kliknięć na karty
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', handleTabSwitch);
    });
}

// ======================================================
// 3. ŁADOWANIE I WALIDACJA DANYCH
// ======================================================

/**
 * Załadowanie i walidacja danych symulacji wiatru
 */
async function loadWindSimulationData() {
    console.log('📊 Ładowanie danych symulacji wiatru...');
    
    try {
        // Spróbuj załadować rzeczywiste dane
        const data = await loadDataFromFile();
        
        if (data) {
            windSimulationData = validateAndTransformData(data);
            console.log('✅ Dane symulacji załadowane i zwalidowane');
            return windSimulationData;
        } else {
            throw new Error('Nie udało się załadować danych');
        }
        
    } catch (error) {
        console.error('❌ Błąd podczas ładowania danych:', error);
        
        // Użyj danych fallback
        console.log('🔄 Używanie danych zastępczych...');
        windSimulationData = generateFallbackData();
        return windSimulationData;
    }
}

/**
 * Ładuje dane z pliku current-1.json
 */
async function loadDataFromFile() {
    const possiblePaths = [
        './current-1.json',
        './data/current-1.json',
        './api/data/wind_simulation/current-1.json'
    ];
    
    for (const path of possiblePaths) {
        try {
            console.log(`Próbuję ścieżkę: ${path}`);
            const response = await fetch(path);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Dane załadowane z: ${path}`);
                return data;
            }
        } catch (error) {
            console.log(`Ścieżka ${path} niedostępna:`, error.message);
        }
    }
    
    return null;
}

/**
 * Waliduje i przekształca surowe dane
 */
function validateAndTransformData(rawData) {
    console.log('🔍 Walidacja i transformacja danych...');
    
    // Przekształć dane do standardowego formatu
    const transformedData = {
        metadata: extractMetadata(rawData),
        spatial_reference: extractSpatialReference(rawData),
        vector_field: extractVectorField(rawData),
        flow_statistics: calculateFlowStatistics(rawData),
        performance: extractPerformance(rawData)
    };
    
    // Waliduj wymagane pola
    if (!transformedData.vector_field || transformedData.vector_field.length === 0) {
        throw new Error('Brak danych wektorowych w pliku');
    }
    
    console.log(`✅ Przetworzono ${transformedData.vector_field.length} wektorów`);
    return transformedData;
}

/**
 * Wyodrębnia metadane z surowych danych
 */
function extractMetadata(rawData) {
    return {
        version: rawData.metadata?.version || '2.3.1',
        title: "Symulacja przepływu powietrza - current-1.json",
        description: "Dane symulacji CFD przepływu wiatru",
        timestamp: new Date().toISOString(),
        computation_time: rawData.performance?.computationtime || 0,
        grid_resolution: "1m"
    };
}

/**
 * Wyodrębnia informacje przestrzenne
 */
function extractSpatialReference(rawData) {
    // Oblicz bounds na podstawie danych wektorowych
    if (!rawData.vectorfield || rawData.vectorfield.length === 0) {
        throw new Error('Brak danych wektorowych do obliczenia bounds');
    }
    
    const lats = rawData.vectorfield.map(v => v.latitude);
    const lngs = rawData.vectorfield.map(v => v.longitude);
    
    return {
        crs: "EPSG:4326",
        bounds_wgs84: {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
        }
    };
}

/**
 * Wyodrębnia pole wektorowe
 */
function extractVectorField(rawData) {
    if (!rawData.vectorfield) {
        throw new Error('Brak vectorfield w danych');
    }
    
    return rawData.vectorfield.map(vector => ({
        x: vector.x,
        y: vector.y,
        longitude: vector.longitude,
        latitude: vector.latitude,
        pixel_x: vector.pixelx,
        pixel_y: vector.pixely,
        vx: vector.vx || 0,
        vy: vector.vy || 0,
        magnitude: vector.magnitude || Math.sqrt((vector.vx || 0)**2 + (vector.vy || 0)**2)
    }));
}

/**
 * Oblicza statystyki przepływu
 */
function calculateFlowStatistics(rawData) {
    const magnitudes = rawData.vectorfield
        .map(v => v.magnitude || Math.sqrt((v.vx || 0)**2 + (v.vy || 0)**2))
        .filter(m => m > 0);
    
    if (magnitudes.length === 0) {
        return {
            min_magnitude: 0,
            max_magnitude: 0,
            mean_magnitude: 0
        };
    }
    
    return {
        min_magnitude: Math.min(...magnitudes),
        max_magnitude: Math.max(...magnitudes),
        mean_magnitude: magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
    };
}

/**
 * Wyodrębnia informacje o wydajności
 */
function extractPerformance(rawData) {
    return {
        computation_time: rawData.performance?.computationtime || 0,
        simulation_time: rawData.performance?.simulationtime || 0,
        generation_time: `${rawData.performance?.computationtime || 0}s`,
        grid_points: rawData.vectorfield?.length || 0
    };
}

/**
 * Generuje dane zastępcze w przypadku błędu
 */
function generateFallbackData() {
    console.log('🔄 Generowanie danych zastępczych...');
    
    const bounds = {
        north: 52.2320,
        south: 52.2280,
        east: 21.0150,
        west: 21.0100
    };
    
    const vectorField = [];
    const gridSize = 50; // 50x50 siatka
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const lat = bounds.south + (i / (gridSize - 1)) * (bounds.north - bounds.south);
            const lng = bounds.west + (j / (gridSize - 1)) * (bounds.east - bounds.west);
            
            vectorField.push({
                x: j * 10,
                y: i * 10,
                longitude: lng,
                latitude: lat,
                pixel_x: j * 10,
                pixel_y: i * 10,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                magnitude: Math.random() * 6 + 1
            });
        }
    }
    
    return {
        metadata: {
            title: "Dane zastępcze - symulacja wiatru",
            description: "Wygenerowane dane testowe",
            timestamp: new Date().toISOString()
        },
        spatial_reference: {
            crs: "EPSG:4326",
            bounds_wgs84: bounds
        },
        vector_field: vectorField,
        flow_statistics: {
            min_magnitude: 1,
            max_magnitude: 7,
            mean_magnitude: 4
        },
        performance: {
            computation_time: 0,
            grid_points: vectorField.length
        }
    };
}

// ======================================================
// 4. INICJALIZACJA MAP
// ======================================================

/**
 * Inicjalizuje wszystkie mapy w aplikacji
 */
async function initializeMaps() {
    console.log('🗺️ Inicjalizacja map...');
    
    // Inicjalizuj mapę wiatru (główna)
    if (document.getElementById('wind-map')) {
        maps.wind = await initializeWindMap();
    }
    
    // Inicjalizuj mapę ryzyka
    if (document.getElementById('risk-map')) {
        maps.risk = await initializeRiskMap();
    }
    
    // Inicjalizuj mapę komfortu
    if (document.getElementById('comfort-map')) {
        maps.comfort = await initializeComfortMap();
    }
    
    // Inicjalizuj mapę galerii
    if (document.getElementById('gallery-map')) {
        maps.gallery = await initializeGalleryMap();
    }
}

/**
 * Inicjalizuje mapę wizualizacji wiatru
 */
async function initializeWindMap() {
    if (!windSimulationData) {
        throw new Error('Brak danych do inicjalizacji mapy wiatru');
    }
    
    const bounds = windSimulationData.spatial_reference.bounds_wgs84;
    const mapBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
    );
    
    // Utwórz mapę
    const map = L.map('wind-map', {
        center: mapBounds.getCenter(),
        zoom: 15,
        zoomControl: true,
        attributionControl: true
    });
    
    // Dodaj warstwę bazową
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    // Dopasuj widok do danych
    map.fitBounds(mapBounds, { padding: [20, 20] });
    
    // Inicjalizuj warstwy wizualizacji
    await initializeVisualizationLayers(map);
    
    // Dodaj kontrolki warstw
    setupLayerControls(map);
    
    // Dodaj legendę
    addLegendControl(map);
    
    console.log('✅ Mapa wiatru zainicjalizowana');
    return map;
}

/**
 * Inicjalizuje warstwy wizualizacji
 */
async function initializeVisualizationLayers(map) {
    console.log('🎨 Inicjalizacja warstw wizualizacji...');
    
    try {
        // Warstwa pola prędkości (heatmapa)
        visualizationLayers.velocityField = new VelocityFieldLayer(windSimulationData);
        
        // Warstwa animacji cząstek
        visualizationLayers.windParticles = new WindParticleLayer(windSimulationData);
        
        // Warstwa strzałek wiatru
        visualizationLayers.windArrows = new WindArrowLayer(windSimulationData);
        
        console.log('✅ Warstwy wizualizacji utworzone');
        
    } catch (error) {
        console.error('❌ Błąd tworzenia warstw wizualizacji:', error);
        throw error;
    }
}

/**
 * Konfiguruje kontrolki warstw
 */
function setupLayerControls(map) {
    const overlayMaps = {
        "Pole prędkości": visualizationLayers.velocityField,
        "Animacja cząstek": visualizationLayers.windParticles,
        "Strzałki wiatru": visualizationLayers.windArrows
    };
    
    layerControls.wind = L.control.layers(null, overlayMaps, {
        collapsed: false,
        position: 'topright'
    }).addTo(map);
    
    // Domyślnie dodaj pole prędkości i animację cząstek
    visualizationLayers.velocityField.addTo(map);
    visualizationLayers.windParticles.addTo(map);
}

/**
 * Dodaje kontrolkę legendy
 */
function addLegendControl(map) {
    const legend = new WindLegendControl({
        position: 'bottomright',
        data: windSimulationData
    });
    legend.addTo(map);
}

// ======================================================
// 5. KLASY WARSTW WIZUALIZACJI
// ======================================================

/**
 * Warstwa pola prędkości (heatmapa)
 */
class VelocityFieldLayer extends L.Layer {
    constructor(data) {
        super();
        this._data = data;
        this._canvas = null;
        this._ctx = null;
    }
    
    onAdd(map) {
        this._map = map;
        this._createCanvas();
        this._setupEventListeners();
        this._draw();
    }
    
    onRemove(map) {
        if (this._canvas) {
            map.getPanes().overlayPane.removeChild(this._canvas);
        }
        this._removeEventListeners();
    }
    
    _createCanvas() {
        this._canvas = L.DomUtil.create('canvas', 'velocity-field-canvas');
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        
        this._map.getPanes().overlayPane.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
    }
    
    _setupEventListeners() {
        this._map.on('moveend zoomend resize', this._redraw, this);
    }
    
    _removeEventListeners() {
        this._map.off('moveend zoomend resize', this._redraw, this);
    }
    
    _redraw() {
        this._resetCanvas();
        this._draw();
    }
    
    _resetCanvas() {
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);
        
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.width = size.x + 'px';
        this._canvas.style.height = size.y + 'px';
    }
    
    _draw() {
        if (!this._data.vector_field) return;
        
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        const vectors = this._data.vector_field;
        const { min_magnitude, max_magnitude } = this._data.flow_statistics;
        
        // Rysuj heatmapę
        vectors.forEach(vector => {
            const point = this._map.latLngToContainerPoint([vector.latitude, vector.longitude]);
            
            // Sprawdź czy punkt jest w zasięgu canvas
            if (point.x >= 0 && point.x < this._canvas.width && 
                point.y >= 0 && point.y < this._canvas.height) {
                
                const normalizedMagnitude = (vector.magnitude - min_magnitude) / (max_magnitude - min_magnitude);
                const color = this._getColorForMagnitude(normalizedMagnitude);
                
                this._ctx.fillStyle = color;
                this._ctx.fillRect(
                    Math.round(point.x - 2), 
                    Math.round(point.y - 2), 
                    4, 4
                );
            }
        });
    }
    
    _getColorForMagnitude(normalized) {
        // Skala kolorów Viridis
        const t = Math.max(0, Math.min(1, normalized));
        const r = Math.round(255 * (0.267004 + 1.15172 * t - 2.92336 * t**2 + 1.52013 * t**3));
        const g = Math.round(255 * (0.018623 + 2.75701 * t - 4.49472 * t**2 + 1.77533 * t**3));
        const b = Math.round(255 * (0.354456 - 2.11226 * t + 10.5126 * t**2 - 12.3881 * t**3 + 3.63582 * t**4));
        return `rgba(${r}, ${g}, ${b}, ${WIND_CONFIG.HEATMAP_OPACITY})`;
    }
}

/**
 * Warstwa animacji cząstek wiatru
 */
class WindParticleLayer extends L.Layer {
    constructor(data) {
        super();
        this._data = data;
        this._canvas = null;
        this._ctx = null;
        this._particles = [];
        this._animationFrame = null;
        this._lastTime = 0;
    }
    
    onAdd(map) {
        this._map = map;
        this._createCanvas();
        this._initializeParticles();
        this._setupEventListeners();
        this._startAnimation();
    }
    
    onRemove(map) {
        this._stopAnimation();
        if (this._canvas) {
            map.getPanes().overlayPane.removeChild(this._canvas);
        }
        this._removeEventListeners();
    }
    
    _createCanvas() {
        this._canvas = L.DomUtil.create('canvas', 'wind-particles-canvas');
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        
        this._map.getPanes().overlayPane.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
        
        // Ustawienia dla efektu świecenia
        this._ctx.globalCompositeOperation = 'screen';
        this._ctx.lineWidth = WIND_CONFIG.PARTICLE_LINE_WIDTH;
    }
    
    _initializeParticles() {
        this._particles = [];
        
        for (let i = 0; i < WIND_CONFIG.PARTICLE_COUNT; i++) {
            this._particles.push(this._createParticle());
        }
    }
    
    _createParticle() {
        const bounds = this._map.getBounds();
        const randomLat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
        const randomLng = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
        
        // Znajdź najbliższy wektor dla początkowej prędkości
        const nearestVector = this._findNearestVector(randomLat, randomLng);
        
        const point = this._map.latLngToContainerPoint([randomLat, randomLng]);
        
        return {
            x: point.x,
            y: point.y,
            lat: randomLat,
            lng: randomLng,
            vx: (nearestVector?.vx || 0) * WIND_CONFIG.PARTICLE_SPEED_SCALE,
            vy: -(nearestVector?.vy || 0) * WIND_CONFIG.PARTICLE_SPEED_SCALE, // odwrócone Y
            age: Math.random() * WIND_CONFIG.PARTICLE_LIFESPAN,
            magnitude: nearestVector?.magnitude || 0
        };
    }
    
    _findNearestVector(lat, lng) {
        if (!this._data.vector_field) return null;
        
        let minDistance = Infinity;
        let nearestVector = null;
        
        for (const vector of this._data.vector_field) {
            const distance = Math.sqrt(
                Math.pow(vector.latitude - lat, 2) + 
                Math.pow(vector.longitude - lng, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestVector = vector;
            }
        }
        
        return nearestVector;
    }
    
    _setupEventListeners() {
        this._map.on('moveend zoomend resize', this._handleMapChange, this);
    }
    
    _removeEventListeners() {
        this._map.off('moveend zoomend resize', this._handleMapChange, this);
    }
    
    _handleMapChange() {
        this._resetCanvas();
        this._initializeParticles();
    }
    
    _resetCanvas() {
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);
        
        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.width = size.x + 'px';
        this._canvas.style.height = size.y + 'px';
    }
    
    _startAnimation() {
        this._lastTime = performance.now();
        this._animate();
    }
    
    _stopAnimation() {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
    }
    
    _animate(currentTime = performance.now()) {
        const deltaTime = currentTime - this._lastTime;
        this._lastTime = currentTime;
        
        // Wyczyść canvas
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        // Aktualizuj i rysuj cząstki
        this._updateAndDrawParticles(deltaTime);
        
        // Kontynuuj animację
        this._animationFrame = requestAnimationFrame((time) => this._animate(time));
    }
    
    _updateAndDrawParticles(deltaTime) {
        const speedMultiplier = visualizationState.playbackSpeed * (deltaTime / 16.67); // 60 FPS baseline
        
        for (let i = 0; i < this._particles.length; i++) {
            const particle = this._particles[i];
            
            // Zapisz starą pozycję
            const oldX = particle.x;
            const oldY = particle.y;
            
            // Aktualizuj pozycję
            particle.x += particle.vx * speedMultiplier;
            particle.y += particle.vy * speedMultiplier;
            particle.age += deltaTime;
            
            // Sprawdź granice i wiek cząstki
            if (particle.x < 0 || particle.x > this._canvas.width || 
                particle.y < 0 || particle.y > this._canvas.height ||
                particle.age > WIND_CONFIG.PARTICLE_LIFESPAN) {
                
                this._particles[i] = this._createParticle();
                continue;
            }
            
            // Rysuj ślad cząstki
            const alpha = Math.max(0, 1 - particle.age / WIND_CONFIG.PARTICLE_LIFESPAN);
            const color = WIND_CONFIG.PARTICLE_COLOR.replace('0.8', alpha.toFixed(2));
            
            this._ctx.strokeStyle = color;
            this._ctx.beginPath();
            this._ctx.moveTo(oldX, oldY);
            this._ctx.lineTo(particle.x, particle.y);
            this._ctx.stroke();
        }
    }
}

/**
 * Warstwa strzałek wiatru
 */
class WindArrowLayer extends L.Layer {
    constructor(data) {
        super();
        this._data = data;
        this._markers = [];
    }
    
    onAdd(map) {
        this._map = map;
        this._createArrows();
        this._setupEventListeners();
    }
    
    onRemove(map) {
        this._clearArrows();
        this._removeEventListeners();
    }
    
    _createArrows() {
        if (!this._data.vector_field) return;
        
        // Próbkuj wektory co N-ty punkt dla wydajności
        const sampleRate = Math.max(1, Math.floor(this._data.vector_field.length / 1000));
        
        for (let i = 0; i < this._data.vector_field.length; i += sampleRate) {
            const vector = this._data.vector_field[i];
            
            if (vector.magnitude > 0.1) { // Pomiń bardzo słabe wektory
                const arrow = this._createArrowMarker(vector);
                this._markers.push(arrow);
                arrow.addTo(this._map);
            }
        }
    }
    
    _createArrowMarker(vector) {
        // Oblicz kierunek i siłę strzałki
        const angle = Math.atan2(vector.vy, vector.vx) * 180 / Math.PI;
        const magnitude = vector.magnitude;
        const normalizedMagnitude = magnitude / this._data.flow_statistics.max_magnitude;
        
        // Utwórz ikonę strzałki
        const arrowIcon = L.divIcon({
            html: this._createArrowSVG(angle, normalizedMagnitude),
            className: 'wind-arrow-icon',
            iconSize: [WIND_CONFIG.ARROW_SIZE, WIND_CONFIG.ARROW_SIZE],
            iconAnchor: [WIND_CONFIG.ARROW_SIZE / 2, WIND_CONFIG.ARROW_SIZE / 2]
        });
        
        return L.marker([vector.latitude, vector.longitude], { 
            icon: arrowIcon,
            interactive: false
        }).bindTooltip(`Prędkość: ${magnitude.toFixed(2)} m/s`, {
            permanent: false,
            direction: 'top'
        });
    }
    
    _createArrowSVG(angle, normalizedMagnitude) {
        const opacity = Math.max(0.3, normalizedMagnitude);
        const size = WIND_CONFIG.ARROW_SIZE;
        
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <path d="M${size/2},2 L${size-2},${size/2} L${size/2+1},${size/2} L${size/2+1},${size-2} L${size/2-1},${size-2} L${size/2-1},${size/2} L2,${size/2} Z" 
                      fill="${WIND_CONFIG.ARROW_COLOR}" 
                      fill-opacity="${opacity}"
                      transform="rotate(${angle}, ${size/2}, ${size/2})"/>
            </svg>
        `;
    }
    
    _clearArrows() {
        this._markers.forEach(marker => {
            this._map.removeLayer(marker);
        });
        this._markers = [];
    }
    
    _setupEventListeners() {
        this._map.on('zoomend', this._handleZoom, this);
    }
    
    _removeEventListeners() {
        this._map.off('zoomend', this._handleZoom, this);
    }
    
    _handleZoom() {
        // Odśwież strzałki po zmianie zoomu
        this._clearArrows();
        this._createArrows();
    }
}

/**
 * Kontrolka legendy dla wizualizacji wiatru
 */
class WindLegendControl extends L.Control {
    constructor(options) {
        super(options);
        this._data = options.data;
    }
    
    onAdd(map) {
        this._container = L.DomUtil.create('div', 'wind-legend-control');
        this._updateLegend();
        return this._container;
    }
    
    _updateLegend() {
        if (!this._data?.flow_statistics) return;
        
        const { min_magnitude, max_magnitude, mean_magnitude } = this._data.flow_statistics;
        
        // Utwórz gradient dla skali kolorów
        const gradientStops = [];
        for (let i = 0; i <= 100; i += 10) {
            const normalized = i / 100;
            const color = this._getViridisColor(normalized);
            gradientStops.push(`${color} ${i}%`);
        }
        
        const gradient = `linear-gradient(to top, ${gradientStops.join(', ')})`;
        
        this._container.innerHTML = `
            <div class="legend-title">Prędkość wiatru [m/s]</div>
            <div class="legend-gradient" style="background: ${gradient}; width: 20px; height: 150px; margin: 10px auto;"></div>
            <div class="legend-labels">
                <div class="legend-max">${max_magnitude.toFixed(1)}</div>
                <div class="legend-mean">${mean_magnitude.toFixed(1)} (śr.)</div>
                <div class="legend-min">${min_magnitude.toFixed(1)}</div>
            </div>
            <div class="legend-stats">
                <small>Punktów: ${this._data.vector_field?.length || 0}</small>
            </div>
        `;
    }
    
    _getViridisColor(normalized) {
        const t = Math.max(0, Math.min(1, normalized));
        const r = Math.round(255 * (0.267004 + 1.15172 * t - 2.92336 * t**2 + 1.52013 * t**3));
        const g = Math.round(255 * (0.018623 + 2.75701 * t - 4.49472 * t**2 + 1.77533 * t**3));
        const b = Math.round(255 * (0.354456 - 2.11226 * t + 10.5126 * t**2 - 12.3881 * t**3 + 3.63582 * t**4));
        return `rgb(${r}, ${g}, ${b})`;
    }
}

// ======================================================
// 6. FUNKCJE POMOCNICZE I NARZĘDZIA
// ======================================================

/**
 * Inicjalizuje pozostałe mapy (zastępcze implementacje)
 */
async function initializeRiskMap() {
    const map = L.map('risk-map').setView([52.23, 21.01], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    return map;
}

async function initializeComfortMap() {
    const map = L.map('comfort-map').setView([52.23, 21.01], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    return map;
}

async function initializeGalleryMap() {
    const map = L.map('gallery-map').setView([52.23, 21.01], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    return map;
}

/**
 * Obsługa przełączania zakładek
 */
function handleTabSwitch(event) {
    const tabId = event.target.dataset.tab;
    
    // Ukryj wszystkie panele
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Usuń aktywne klasy z przycisków
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Pokaż wybrany panel i aktywuj przycisk
    const selectedPanel = document.getElementById(`${tabId}-panel`);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
        event.target.classList.add('active');
        
        // Odśwież mapę jeśli jest potrzebne
        if (maps[tabId]) {
            setTimeout(() => maps[tabId].invalidateSize(), 100);
        }
    }
}

/**
 * Przełącza odtwarzanie animacji
 */
function togglePlayback() {
    visualizationState.isPlaying = !visualizationState.isPlaying;
    
    const playButton = document.getElementById('play-btn');
    if (playButton) {
        playButton.textContent = visualizationState.isPlaying ? '⏸️ Pauza' : '▶️ Odtwórz';
    }
    
    // Implementuj logikę odtwarzania animacji
    if (visualizationState.isPlaying) {
        startVisualizationPlayback();
    } else {
        stopVisualizationPlayback();
    }
}

/**
 * Rozpoczyna odtwarzanie animacji
 */
function startVisualizationPlayback() {
    // Implementacja animacji czasowej - rozszerz w razie potrzeby
    console.log('▶️ Rozpoczynanie animacji...');
}

/**
 * Zatrzymuje odtwarzanie animacji
 */
function stopVisualizationPlayback() {
    console.log('⏸️ Zatrzymywanie animacji...');
}

/**
 * Aktualizuje wizualizację na podstawie wybranych parametrów
 */
function updateVisualization() {
    console.log('🔄 Aktualizacja wizualizacji...', Array.from(visualizationState.selectedParameters));
    
    // Implementuj logikę aktualizacji warstw na podstawie wybranych parametrów
    if (maps.wind) {
        // Odśwież warstwy wizualizacji
        Object.values(visualizationLayers).forEach(layer => {
            if (layer && layer._map) {
                layer._redraw?.();
            }
        });
    }
}

/**
 * Obsługuje zmianę rozmiaru okna
 */
function handleWindowResize() {
    Object.values(maps).forEach(map => {
        if (map) {
            map.invalidateSize();
        }
    });
}

/**
 * Pokazuje błąd użytkownikowi
 */
function showError(message) {
    console.error('❌', message);
    
    // Pokaż toast lub modal z błędem
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        max-width: 300px;
    `;
    
    document.body.appendChild(errorDiv);
    
    // Usuń po 5 sekundach
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

/**
 * Funkcja debounce dla wydajności
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ======================================================
// 7. INICJALIZACJA PRZY ZAŁADOWANIU STRONY
// ======================================================

// Uruchom aplikację po załadowaniu DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM załadowany, inicjalizacja aplikacji...');
    await initializeApplication();
});

// Dodatkowe CSS dla nowych elementów
function addCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .velocity-field-canvas {
            mix-blend-mode: multiply;
        }
        
        .wind-particles-canvas {
            mix-blend-mode: screen;
        }
        
        .wind-arrow-icon {
            pointer-events: none;
        }
        
        .wind-legend-control {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 12px;
        }
        
        .legend-title {
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .legend-labels {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            height: 150px;
            justify-content: space-between;
            margin-left: 25px;
        }
        
        .legend-stats {
            margin-top: 8px;
            text-align: center;
            opacity: 0.7;
        }
        
        .error-notification {
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            font-family: Arial, sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Dodaj CSS po załadowaniu
document.addEventListener('DOMContentLoaded', addCustomCSS);
