// Sample data from provided JSON
// === PODSTAWOWE FUNKCJE ŁADOWANIA DANYCH ===
let windSimulationData = null;

// Przykładowe dane fallback
const fallbackWindData = {
    "metadata": {
        "title": "Symulacja przepływu powietrza - przykładowe dane",
        "description": "Fallback dane dla demonstracji",
        "timestamp": "2024-09-23T12:00:00Z",
        "grid_resolution": "1m",
        "wind_direction": 270,
        "reference_wind_speed": 5.0
    },
    "spatial_reference": {
        "crs": "EPSG:4326",
        "bounds_wgs84": {
            "north": 52.2320,
            "south": 52.2280,
            "east": 21.0150,
            "west": 21.0100
        }
    },
    // POPRAWIONA struktura - vector_field z magnitude (nie speed)
    "vector_field": Array(100).fill().map((_, i) => ({
        "pixel_x": (i % 10) * 10,
        "pixel_y": Math.floor(i / 10) * 10,
        "longitude": 21.0100 + (i % 10) * 0.0005,
        "latitude": 52.2280 + Math.floor(i / 10) * 0.0004,
        "vx": (Math.random() - 0.5) * 4,
        "vy": (Math.random() - 0.5) * 4,
        "magnitude": Math.random() * 6 + 2  // ZMIANA: magnitude zamiast speed
    })),
    "flow_statistics": {
        "min_magnitude": 0.5,
        "max_magnitude": 8.5,
        "mean_magnitude": 4.2
    },
    "streamlines": Array(5).fill().map(() => 
        Array(20).fill().map((_, i) => ({
            "longitude": 21.0100 + Math.random() * 0.005,
            "latitude": 52.2280 + Math.random() * 0.004,
            "vx": Math.random() * 2 - 1,
            "vy": Math.random() * 2 - 1,
            "magnitude": Math.random() * 5 + 1  // ZMIANA: magnitude zamiast speed
        }))
    ),
    "particles": Array(3).fill().map(() => 
        Array(30).fill().map(() => ({
            "longitude": 21.0100 + Math.random() * 0.005,
            "latitude": 52.2280 + Math.random() * 0.004,
            "vx": (Math.random() - 0.5) * 3,
            "vy": (Math.random() - 0.5) * 3,
            "magnitude": Math.random() * 4 + 1  // ZMIANA: magnitude zamiast speed
        }))
    ),
    "performance": {
        "generation_time": "2.3s",
        "grid_points": 400
    }
};

async function loadWindSimulationData() {
    try {
        console.log('Próba ładowania danych symulacji wiatru...');
        
        // POPRAWIONA ścieżka - spróbuj różnych możliwych lokalizacji
        const possiblePaths = [
            'wind_simulation_results.json',           // bezpośrednio w folderze
            'api/data/wind_simulation_results.json',  // w api
            'data/wind_simulation_results.json',      // w data
            'current.json',                           // obecna nazwa
            'api/data/wind_simulation/current.json'   // obecna ścieżka
        ];
        
        let response = null;
        let successfulPath = null;
        
        // Spróbuj każdej ścieżki po kolei
        for (const path of possiblePaths) {
            try {
                console.log(`Próbuję ścieżkę: ${path}`);
                response = await fetch(path);
                if (response.ok) {
                    successfulPath = path;
                    console.log(`✅ Znaleziono plik pod ścieżką: ${path}`);
                    break;
                }
            } catch (error) {
                console.log(`Ścieżka ${path} niedostępna:`, error.message);
            }
        }
        
        if (!response || !response.ok) {
            console.warn(`Nie można załadować pliku danych z żadnej ścieżki, używam danych fallback`);
            windSimulationData = fallbackWindData;
        } else {
            const rawData = await response.json();
            console.log('✅ Surowe dane załadowane z:', successfulPath);
            console.log('Struktura danych:', Object.keys(rawData));
            
            // WALIDACJA i transformacja danych
            windSimulationData = validateAndTransformWindData(rawData);
        }
        
        // Walidacja końcowa
        if (!windSimulationData.spatial_reference) {
            console.warn('Brak informacji spatial_reference w danych!');
        } else {
            console.log('CRS danych:', windSimulationData.spatial_reference.crs);
            console.log('Bounds WGS84:', windSimulationData.spatial_reference.bounds_wgs84);
        }
        
        // Sprawdź czy vector_field ma poprawną strukturę
        if (windSimulationData.vector_field && windSimulationData.vector_field.length > 0) {
            const firstPoint = windSimulationData.vector_field[0];
            console.log('Struktura pierwszego punktu:', Object.keys(firstPoint));
            
            if (firstPoint.longitude !== undefined && firstPoint.latitude !== undefined) {
                console.log('✅ Dane zawierają współrzędne geograficzne');
                console.log('Przykładowy punkt:', {
                    pixel: firstPoint.pixel_x !== undefined ? `(${firstPoint.pixel_x}, ${firstPoint.pixel_y})` : 'brak',
                    geo: `(${firstPoint.longitude.toFixed(6)}, ${firstPoint.latitude.toFixed(6)})`,
                    magnitude: firstPoint.magnitude || firstPoint.speed || 'brak'
                });
            } else {
                console.error('❌ Dane NIE zawierają współrzędnych geograficznych!');
            }
        }
        
        // Po załadowaniu danych, zainicjalizuj wizualizację
        if (maps.wind) {
            addAdvancedWindCSS();
            initAdvancedWindVisualization();
        }
        
        return windSimulationData;
        
    } catch (error) {
        console.error('Błąd podczas ładowania danych symulacji wiatru:', error);
        console.log('Używam danych fallback...');
        windSimulationData = fallbackWindData;
        
        // Również dla fallback, zainicjalizuj wizualizację jeśli mapa istnieje
        if (maps.wind) {
            addAdvancedWindCSS();
            initAdvancedWindVisualization();
        }
        
        return windSimulationData;
    }
}
function validateAndTransformWindData(rawData) {
    console.log('Walidacja i transformacja danych...');
    
    const transformed = {
        metadata: rawData.metadata || {
            title: "Imported wind simulation data",
            timestamp: new Date().toISOString()
        },
        spatial_reference: rawData.spatial_reference || {
            crs: "EPSG:4326"
        },
        vector_field: [],
        flow_statistics: {
            min_magnitude: Infinity,
            max_magnitude: -Infinity,
            mean_magnitude: 0
        },
        streamlines: rawData.streamlines || [],
        particles: rawData.particles || [],
        performance: rawData.performance || {}
    };
    
    // Sprawdź czy mamy vector_field
    if (rawData.vector_field && Array.isArray(rawData.vector_field)) {
        console.log(`Przetwarzanie ${rawData.vector_field.length} wektorów...`);
        
        let magnitudeSum = 0;
        let validVectors = 0;
        
        rawData.vector_field.forEach((vector, index) => {
            // Sprawdź czy wektor ma wymagane pola
            if (vector.longitude === undefined || vector.latitude === undefined) {
                console.warn(`Wektor ${index} nie ma współrzędnych geograficznych`);
                return;
            }
            
            // Oblicz magnitude jeśli brakuje
            let magnitude = vector.magnitude;
            if (magnitude === undefined && vector.vx !== undefined && vector.vy !== undefined) {
                magnitude = Math.sqrt(vector.vx * vector.vx + vector.vy * vector.vy);
                console.log(`Obliczono magnitude dla wektora ${index}: ${magnitude}`);
            }
            
            // Użyj speed jako fallback dla magnitude
            if (magnitude === undefined && vector.speed !== undefined) {
                magnitude = vector.speed;
            }
            
            if (magnitude !== undefined && !isNaN(magnitude)) {
                const transformedVector = {
                    pixel_x: vector.pixel_x,
                    pixel_y: vector.pixel_y,
                    longitude: vector.longitude,
                    latitude: vector.latitude,
                    vx: vector.vx || 0,
                    vy: vector.vy || 0,
                    magnitude: magnitude
                };
                
                transformed.vector_field.push(transformedVector);
                
                // Aktualizuj statystyki
                transformed.flow_statistics.min_magnitude = Math.min(transformed.flow_statistics.min_magnitude, magnitude);
                transformed.flow_statistics.max_magnitude = Math.max(transformed.flow_statistics.max_magnitude, magnitude);
                magnitudeSum += magnitude;
                validVectors++;
            }
        });
        
        if (validVectors > 0) {
            transformed.flow_statistics.mean_magnitude = magnitudeSum / validVectors;
            console.log(`✅ Przetworzone ${validVectors} wektorów`);
            console.log('Statystyki magnitude:', {
                min: transformed.flow_statistics.min_magnitude.toFixed(2),
                max: transformed.flow_statistics.max_magnitude.toFixed(2),
                mean: transformed.flow_statistics.mean_magnitude.toFixed(2)
            });
        } else {
            console.error('❌ Brak prawidłowych wektorów w danych!');
            return fallbackWindData;
        }
    } else {
        console.error('❌ Brak vector_field w danych!');
        return fallbackWindData;
    }
    
    // Sprawdź i ustaw bounds jeśli nie ma
    if (!transformed.spatial_reference.bounds_wgs84 && transformed.vector_field.length > 0) {
        console.log('Obliczanie bounds na podstawie vector_field...');
        const lats = transformed.vector_field.map(v => v.latitude);
        const lngs = transformed.vector_field.map(v => v.longitude);
        
        transformed.spatial_reference.bounds_wgs84 = {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
        };
        
        console.log('Obliczone bounds:', transformed.spatial_reference.bounds_wgs84);
    }
    
    // Twórz magnitude_grid na podstawie vector_field (dla kompatybilności)
    if (transformed.vector_field.length > 0) {
        transformed.magnitude_grid = createMagnitudeGrid(transformed.vector_field, transformed.spatial_reference.bounds_wgs84);
    }
    
    return transformed;
}

// Pomocnicza funkcja do tworzenia siatki magnitude
function createMagnitudeGrid(vectorField, bounds) {
    if (!bounds) return [];
    
    const gridSize = 20; // 20x20 siatka
    const latStep = (bounds.north - bounds.south) / gridSize;
    const lngStep = (bounds.east - bounds.west) / gridSize;
    
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const cellLat = bounds.south + (i + 0.5) * latStep;
            const cellLng = bounds.west + (j + 0.5) * lngStep;
            
            // Znajdź najbliższy wektor
            let minDist = Infinity;
            let closestMagnitude = 0;
            
            vectorField.forEach(vector => {
                const dist = Math.sqrt(
                    Math.pow(vector.latitude - cellLat, 2) + 
                    Math.pow(vector.longitude - cellLng, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    closestMagnitude = vector.magnitude;
                }
            });
            
            grid[i][j] = closestMagnitude;
        }
    }
    
    return grid;
}


// === ZAAWANSOWANA WIZUALIZACJA WIATRU - INTEGRACJA Z DZIAŁAJĄCYM KODEM ===

// Parametry konfiguracyjne wizualizacji
const WIND_VIZ_CONFIG = {
    PARTICLE_COUNT: 6000,
    PARTICLE_SPEED_SCALE: 0.2,
    PARTICLE_LIFESPAN: 1000,
    PARTICLE_LINE_WIDTH: 1.6,
    PARTICLE_COLOR: "rgba(110, 190, 255, 0.8)",
    GLOW_COLOR: "rgba(110, 190, 255, 0.5)",
    GLOW_BLUR: 7
};

// Funkcja mapowania wartości na kolor (skala Viridis)
function getViridisColor(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const r = Math.round(255 * (0.267004 + 1.15172 * t - 2.92336 * t**2 + 1.52013 * t**3));
    const g = Math.round(255 * (0.018623 + 2.75701 * t - 4.49472 * t**2 + 1.77533 * t**3));
    const b = Math.round(255 * (0.354456 - 2.11226 * t + 10.5126 * t**2 - 12.3881 * t**3 + 3.63582 * t**4));
    return `rgba(${r},${g},${b},0.6)`;
}

// Adapter danych - przekształca nasze dane na format oczekiwany przez wizualizację
// NAPRAWIONY adapter danych
function createWindDataAdapter(rawWindData) {
    if (!rawWindData) {
        console.error('Brak danych wiatru!');
        return null;
    }
    
    // Sprawdź czy dane zawierają współrzędne geograficzne
    const hasGeoCoords = rawWindData.vector_field && rawWindData.vector_field.length > 0 
        && rawWindData.vector_field[0].longitude !== undefined;
    
    if (!hasGeoCoords) {
        console.error('Dane symulacji nie zawierają współrzędnych geograficznych!');
        return null;
    }
    
    // Użyj prawdziwych bounds z danych
    const bounds_wgs84 = rawWindData.spatial_reference?.bounds_wgs84;
    if (!bounds_wgs84) {
        console.error('Brak informacji o bounds_wgs84 w danych symulacji!');
        return null;
    }
    
    const bounds = L.latLngBounds(
        [bounds_wgs84.south, bounds_wgs84.west],
        [bounds_wgs84.north, bounds_wgs84.east]
    );
    
    console.log('Używam prawdziwych bounds z danych:', bounds);
    
    const adapter = {
        // NAPRAWIONA struktura danych
        magnitudeGrid: rawWindData.magnitude_grid || [],
        gridWidth: rawWindData.magnitude_grid ? rawWindData.magnitude_grid[0].length : 0,
        gridHeight: rawWindData.magnitude_grid ? rawWindData.magnitude_grid.length : 0,
        bounds: bounds,
        minMagnitude: rawWindData.flow_statistics.min_magnitude,
        maxMagnitude: rawWindData.flow_statistics.max_magnitude,
        
        // NAPRAWIONE mapowanie - użyj magnitude zamiast speed
        streamlines: rawWindData.streamlines.map(streamline => 
            streamline.map(point => ({
                ...point,
                lat: point.latitude,
                lng: point.longitude,
                speed: point.magnitude || point.speed || 0
            }))
        ),
        
        particles: rawWindData.particles.length > 0 
            ? rawWindData.particles.flatMap(path => 
                path.map(particle => ({
                    ...particle,
                    lat: particle.latitude,
                    lng: particle.longitude,
                    speed: particle.magnitude || particle.speed || 0
                }))
            ) : [],
        
        vectorField: rawWindData.vector_field.map(vector => ({
            ...vector,
            lat: vector.latitude,
            lng: vector.longitude,
            speed: vector.magnitude || vector.speed || 0
        })),
        
        metadata: rawWindData.metadata,
        performance: rawWindData.performance,
        spatial_reference: rawWindData.spatial_reference
    };
    
    console.log('Adapter utworzony:', {
        vectorsCount: adapter.vectorField.length,
        particlesCount: adapter.particles.length,
        streamlinesCount: adapter.streamlines.length,
        gridSize: `${adapter.gridWidth}x${adapter.gridHeight}`,
        magnitudeRange: `${adapter.minMagnitude.toFixed(2)} - ${adapter.maxMagnitude.toFixed(2)}`
    });
    
    return adapter;
}

// === VelocityLayer - Warstwa pola prędkości ===
const AdvancedVelocityLayer = L.Layer.extend({
    initialize: function(data, bounds) {
        this._data = data;
        this.bounds = bounds;
    },

    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated velocity-canvas');
        this._canvas.style.position = 'absolute';
        map.getPanes().overlayPane.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
        
        map.on('moveend zoomend resize', this._reset, this);
        this._reset();
    },

    onRemove: function(map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('moveend zoomend resize', this._reset, this);
    },

    _reset: function() {
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);

        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.width = size.x + 'px';
        this._canvas.style.height = size.y + 'px';

        this._draw();
    },

     _draw: function() {
            if (!this._data.magnitudeGrid) return;
    
            const ctx = this._ctx;
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    
            const grid = this._data.magnitudeGrid;
            const w = this._data.gridWidth;
            const h = this._data.gridHeight;
            const { minMagnitude, maxMagnitude } = this._data;
    
            const cellWidth = (this._data.bounds.getEast() - this._data.bounds.getWest()) / w;
            const cellHeight = (this._data.bounds.getNorth() - this._data.bounds.getSouth()) / h;
    
            for (let j = 0; j < h; j++) {
                for (let i = 0; i < w; i++) {
                    const lat = this._data.bounds.getNorth() - ((j + 0.5) * cellHeight);
                    const lon = this._data.bounds.getWest() + ((i + 0.5) * cellWidth);
                    const point = this._map.latLngToContainerPoint([lat, lon]);
    
                    const value = grid[j] && grid[j][i] !== undefined ? grid[j][i] : NaN;
                    if (!isFinite(value)) continue;
    
                    ctx.fillStyle = getViridisColor(value, minMagnitude, maxMagnitude);
                    ctx.fillRect(Math.round(point.x - 2), Math.round(point.y - 2), 4, 4);
            }
        }
    }
});

// === WindAnimationLayer - Warstwa animacji cząstek ===
const AdvancedWindAnimationLayer = L.Layer.extend({
    initialize: function(data, bounds) {
        this._data = data;
        this.bounds = bounds;
        this._particles = [];
        this._animationFrame = null;
    },

    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated wind-canvas');
        this._canvas.id = 'wind-canvas';
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        map.getPanes().overlayPane.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
        
        map.on('moveend zoomend resize', this._reset, this);
        this._reset();
        this._initializeParticles();
        this._animate();
    },

    onRemove: function(map) {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('moveend zoomend resize', this._reset, this);
    },

    _reset: function() {
        const topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);

        const size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        this._canvas.style.width = size.x + 'px';
        this._canvas.style.height = size.y + 'px';

        this._initializeParticles();
    },

    _initializeParticles: function() {
        this._particles = [];
        
        // Użyj rzeczywistych cząstek z danych jeśli są dostępne
        if (this._data.particles && this._data.particles.length > 0) {
            const sourceParticles = this._data.particles.slice(0, Math.min(WIND_VIZ_CONFIG.PARTICLE_COUNT, this._data.particles.length));
            
            sourceParticles.forEach(particle => {
                const point = this._map.latLngToContainerPoint([particle.lat, particle.lng]);
                if (point.x >= 0 && point.x < this._canvas.width && 
                    point.y >= 0 && point.y < this._canvas.height) {
                    this._particles.push({
                        x: point.x,
                        y: point.y,
                        vx: particle.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE,
                        vy: -particle.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE, // odwróć Y
                        age: Math.random() * WIND_VIZ_CONFIG.PARTICLE_LIFESPAN,
                        speed: particle.speed
                    });
                }
            });
        } else {
            // Fallback - generuj losowe cząstki
            for (let i = 0; i < WIND_VIZ_CONFIG.PARTICLE_COUNT; i++) {
                this._particles.push(this._createRandomParticle());
            }
        }
    },

    _createRandomParticle: function() {
        return {
            x: Math.random() * this._canvas.width,
            y: Math.random() * this._canvas.height,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            age: Math.random() * WIND_VIZ_CONFIG.PARTICLE_LIFESPAN,
            speed: Math.random() * 3 + 1
        };
    },

    _animate: function() {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        // Ustawienia canvas dla efektu świecenia
        this._ctx.globalCompositeOperation = 'screen';
        this._ctx.lineWidth = WIND_VIZ_CONFIG.PARTICLE_LINE_WIDTH;
        
        this._particles.forEach((particle, index) => {
            // Aktualizuj pozycję
            const oldX = particle.x;
            const oldY = particle.y;
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.age++;
            
            // Sprawdź granice i resetuj cząstkę jeśli wyszła poza obszar lub jest za stara
            if (particle.x < 0 || particle.x > this._canvas.width || 
                particle.y < 0 || particle.y > this._canvas.height || 
                particle.age > WIND_VIZ_CONFIG.PARTICLE_LIFESPAN) {
                this._particles[index] = this._createRandomParticle();
                return;
            }
            
            // Narysuj ślad cząstki
            const alpha = Math.max(0, 1 - particle.age / WIND_VIZ_CONFIG.PARTICLE_LIFESPAN);
            this._ctx.strokeStyle = WIND_VIZ_CONFIG.PARTICLE_COLOR.replace('0.8', alpha.toString());
            this._ctx.beginPath();
            this._ctx.moveTo(oldX, oldY);
            this._ctx.lineTo(particle.x, particle.y);
            this._ctx.stroke();
        });
        
        this._animationFrame = requestAnimationFrame(() => this._animate());
    }
});

// === LegendControl - Kontrolka legendy ===
const AdvancedLegendControl = L.Control.extend({
    options: {
        position: 'bottomright'
    },

    onAdd: function(map) {
        this._container = L.DomUtil.create('div', 'leaflet-control legend-control');
        this.update();
        return this._container;
    },

    update: function(min = 0, max = 1) {
        const gradientColors = [];
        for (let i = 0; i <= 100; i += 10) {
            gradientColors.push(getViridisColor(min + (i/100)*(max-min), min, max));
        }
        
        this._container.innerHTML = `
            <div class="legend-content">
                <h4>Prędkość wiatru (m/s)</h4>
                <div class="legend-gradient" style="background: linear-gradient(to top, ${gradientColors.join(', ')})"></div>
                <div class="legend-labels">
                    <span>${max.toFixed(1)}</span>
                    <span>${((min + max) / 2).toFixed(1)}</span>
                    <span>${min.toFixed(1)}</span>
                </div>
            </div>
        `;
    }
});

// === Globalne zmienne warstw ===
let currentVelocityLayer = null;
let currentAnimationLayer = null;
let currentLegendControl = null;

// === Dodaj CSS dla zaawansowanej wizualizacji ===
function addAdvancedWindCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .velocity-canvas {
            mix-blend-mode: multiply;
            opacity: 0.7;
        }
        
        .wind-canvas {
            mix-blend-mode: screen;
            opacity: 0.9;
        }
        
        .legend-control {
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            padding: 10px;
            color: white;
            font-family: Arial, sans-serif;
            min-width: 120px;
        }
        
        .legend-content h4 {
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: bold;
        }
        
        .legend-gradient {
            width: 20px;
            height: 100px;
            border: 1px solid #ccc;
            margin: 0 auto 5px auto;
        }
        
        .legend-labels {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100px;
            font-size: 10px;
            text-align: center;
        }
        
        .wind-controls {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 5px;
            padding: 10px;
            margin: 10px;
        }
        
        .wind-controls label {
            display: block;
            margin-bottom: 5px;
            font-size: 12px;
        }
        
        .wind-controls input[type="checkbox"] {
            margin-right: 5px;
        }
    `;
    document.head.appendChild(style);
}

// === Główna funkcja inicjalizacji zaawansowanej wizualizacji ===
function initAdvancedWindVisualization() {
    if (!windSimulationData || !maps.wind) {
        console.log('Brak danych wiatru lub mapy - pomijam zaawansowaną wizualizację');
        return;
    }
    
    console.log('Inicjalizuję zaawansowaną wizualizację wiatru...');
    
    const adapter = createWindDataAdapter(windSimulationData);
    if (!adapter) {
        console.error('Nie można utworzyć adaptera danych wiatru');
        return;
    }
    
    // Usuń istniejące warstwy jeśli istnieją
    if (currentVelocityLayer) {
        maps.wind.removeLayer(currentVelocityLayer);
    }
    if (currentAnimationLayer) {
        maps.wind.removeLayer(currentAnimationLayer);
    }
    if (currentLegendControl) {
        maps.wind.removeControl(currentLegendControl);
    }
    
    // Dodaj nowe warstwy
    currentVelocityLayer = new AdvancedVelocityLayer(adapter, adapter.bounds);
    currentAnimationLayer = new AdvancedWindAnimationLayer(adapter, adapter.bounds);
    currentLegendControl = new AdvancedLegendControl();
    
    // Dodaj warstwy do mapy
    maps.wind.addLayer(currentVelocityLayer);
    maps.wind.addLayer(currentAnimationLayer);
    maps.wind.addControl(currentLegendControl);
    
    // Aktualizuj legendę z prawdziwymi wartościami
    currentLegendControl.update(adapter.minMagnitude, adapter.maxMagnitude);
    
    // Dopasuj widok mapy do obszaru danych
    maps.wind.fitBounds(adapter.bounds);
    
    console.log('✅ Zaawansowana wizualizacja wiatru zainicjalizowana');
}

const sampleData = {
    projects: [
        {
            id: 1,
            title: "Analiza zagrożeń powodziowych",
            category: "flood",
            description: "Modelowanie ryzyka powodziowego z wykorzystaniem danych historycznych i prognoz klimatycznych.",
            image: "images/flood-analysis.jpg",
            results: "Zmniejszenie ryzyka o 30%"
        },
        {
            id: 2,
            title: "Symulacja mikroklimatyczna",
            category: "climate",
            description: "Szczegółowa analiza komfortu termicznego w przestrzeniach miejskich.",
            image: "images/microclimate.jpg",
            results: "Poprawa komfortu o 25%"
        },
        {
            id: 3,
            title: "Analiza przepływu powietrza",
            category: "wind",
            description: "Zaawansowane modelowanie CFD dla optymalizacji wentylacji naturalnej.",
            image: "images/wind-flow.jpg",
            results: "Oszczędności energii 40%"
        }
    ],
    blogPosts: [
        {
            id: 1,
            title: "Przyszłość modelowania klimatu miejskiego",
            excerpt: "Jak nowe technologie zmieniają podejście do planowania miast...",
            date: "2024-03-15",
            category: "technologia"
        },
        {
            id: 2,
            title: "GIS w służbie zrównoważonego rozwoju",
            excerpt: "Zastosowania systemów informacji geograficznej w projektach ekologicznych...",
            date: "2024-03-10",
            category: "środowisko"
        }
    ],
    weatherData: {
        location: "Warszawa",
        temperature: 18,
        humidity: 65,
        pressure: 1013,
        windSpeed: 12
    },
    floodData: {
        scenarios: [
            {
                name: "Powódź 10-letnia",
                coordinates: [
                    {lat: 52.2297, lng: 21.0122, depth: 0.5, time: 30},
                    {lat: 52.2305, lng: 21.0135, depth: 0.8, time: 45},
                    {lat: 52.2312, lng: 21.0118, depth: 1.2, time: 60}
                ]
            },
            {
                name: "Powódź 100-letnia",
                coordinates: [
                    {lat: 52.2297, lng: 21.0122, depth: 1.5, time: 20},
                    {lat: 52.2305, lng: 21.0135, depth: 2.1, time: 30},
                    {lat: 52.2312, lng: 21.0118, depth: 2.8, time: 45}
                ]
            }
        ]
    },
    windData: {
        scenarios: [
            {
                name: "Warunki normalne",
                windSpeed: 3.5,
                direction: 270
            },
            {
                name: "Silny wiatr",
                windSpeed: 8.2,
                direction: 225
            }
        ]
    },
    thermalData: {
        zones: [
            {lat: 52.2297, lng: 21.0122, pmv: -0.5, temperature: 24.5},
            {lat: 52.2305, lng: 21.0135, pmv: 0.2, temperature: 26.1},
            {lat: 52.2312, lng: 21.0118, pmv: -1.1, temperature: 22.8}
        ]
    }
};

// Global variables
let maps = {};
let animationPlaying = false;
let animationInterval = null;
let particles = [];
let windCanvas = null;
let windCtx = null;
let floodMarkers = [];
let thermalMarkers = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Załaduj dane symulacji wiatru na początku
    loadWindSimulationData().then(() => {
        console.log('Aplikacja zainicjalizowana z danymi symulacji wiatru');
    }).catch(error => {
        console.warn('Inicjalizacja z błędami ładowania danych:', error);
    });
    
    initNavigation();
    initWeatherWidget();
    initMaps();
    initControls();
    initPortfolio();
    initBlog();
    initContactForm();
    initParticleSystem();
    initThemeToggle();
});

// Navigation functions
function initNavigation() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    // Mobile menu toggle
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Smooth scrolling for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                const headerHeight = document.getElementById('header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
            // Close mobile menu if open
            navMenu.classList.remove('active');
        });
    });

    // Quick access cards navigation
    const quickCards = document.querySelectorAll('.quick-card');
    quickCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = card.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                const headerHeight = document.getElementById('header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Header scroll effect
    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        if (window.scrollY > 100) {
            header.style.background = 'rgba(15, 23, 42, 0.95)';
        } else {
            header.style.background = 'rgba(15, 23, 42, 0.9)';
        }
    });
}

// Theme toggle
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            if (document.body.classList.contains('light-theme')) {
                themeIcon.className = 'fas fa-sun';
            } else {
                themeIcon.className = 'fas fa-moon';
            }
        });
    }
}

// Weather widget
function initWeatherWidget() {
    const weatherData = sampleData.weatherData;
    document.getElementById('weather-location').textContent = weatherData.location;
    document.getElementById('temperature').textContent = `${weatherData.temperature}°C`;
    document.getElementById('humidity').textContent = `${weatherData.humidity}%`;
    document.getElementById('pressure').textContent = `${weatherData.pressure} hPa`;
    document.getElementById('wind-speed').textContent = `${weatherData.windSpeed} km/h`;
}

// Map initialization
function initMaps() {
    // Main dashboard map
    initMainMap();
    
    // Flood simulation map
    initFloodMap();
    
    // Wind analysis map
    initWindMap();
    
    // Thermal comfort map
    initThermalMap();
    
    // Contact map
    initContactMap();
}

function initMainMap() {
    const mapContainer = document.getElementById('main-map');
    if (!mapContainer) return;

    maps.main = L.map('main-map').setView([52.2297, 21.0122], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(maps.main);

    // Add sample markers for different data layers
    const floodMarker = L.marker([52.2297, 21.0122])
        .bindPopup('<strong>Zagrożenie powodziowe</strong><br>Głębokość: 0.8m')
        .addTo(maps.main);

    const thermalMarker = L.marker([52.2305, 21.0135])
        .bindPopup('<strong>Komfort termiczny</strong><br>PMV: -0.5 (Komfortowo)')
        .addTo(maps.main);

    // Layer control
    const layerControls = {
        'flood-layer': floodMarker,
        'thermal-layer': thermalMarker
    };

    Object.keys(layerControls).forEach(layerId => {
        const checkbox = document.getElementById(layerId);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const layer = layerControls[layerId];
                if (e.target.checked) {
                    maps.main.addLayer(layer);
                } else {
                    maps.main.removeLayer(layer);
                }
            });
        }
    });
}

function initFloodMap() {
    const mapContainer = document.getElementById('flood-map');
    if (!mapContainer) return;

    maps.flood = L.map('flood-map').setView([52.2297, 21.0122], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(maps.flood);

    updateFloodVisualization();
}

function initWindMap() {
    const mapContainer = document.getElementById('wind-map');
    if (!mapContainer) return;

    maps.wind = L.map('wind-map').setView([52.2297, 21.0122], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(maps.wind);

    // Jeśli dane wiatru są już załadowane, zainicjalizuj zaawansowaną wizualizację
    if (windSimulationData) {
        addAdvancedWindCSS();
        initAdvancedWindVisualization();
    }

    updateWindVisualization();
}

function initThermalMap() {
    const mapContainer = document.getElementById('thermal-map');
    if (!mapContainer) return;

    maps.thermal = L.map('thermal-map').setView([52.2297, 21.0122], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(maps.thermal);

    updateThermalVisualization();
}

function initContactMap() {
    const mapContainer = document.getElementById('contact-map');
    if (!mapContainer) return;

    maps.contact = L.map('contact-map').setView([52.2297, 21.0122], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(maps.contact);

    L.marker([52.2297, 21.0122])
        .bindPopup('<strong>Biuro</strong><br>ul. Naukowa 15/20<br>00-001 Warszawa')
        .addTo(maps.contact);
}

// Control initialization
function initControls() {
    // Flood simulation controls
    const floodScenario = document.getElementById('flood-scenario');
    const timeSlider = document.getElementById('time-slider');
    const timeValue = document.getElementById('time-value');
    const playButton = document.getElementById('play-animation');

    if (floodScenario) {
        floodScenario.addEventListener('change', updateFloodVisualization);
    }

    if (timeSlider && timeValue) {
        timeSlider.addEventListener('input', (e) => {
            timeValue.textContent = e.target.value;
            updateFloodVisualization();
        });
    }

    if (playButton) {
        playButton.addEventListener('click', toggleFloodAnimation);
    }

    // Wind analysis controls
    const windScenario = document.getElementById('wind-scenario');
    const windSpeedSlider = document.getElementById('wind-speed-slider');
    const windSpeedDisplay = document.getElementById('wind-speed-display');
    const showParticles = document.getElementById('show-particles');
    const showVectors = document.getElementById('show-vectors');

    if (windScenario) {
        windScenario.addEventListener('change', updateWindVisualization);
    }

    if (windSpeedSlider && windSpeedDisplay) {
        windSpeedSlider.addEventListener('input', (e) => {
            windSpeedDisplay.textContent = e.target.value;
            updateWindVisualization();
        });
    }

    if (showParticles) {
        showParticles.addEventListener('change', updateParticleVisibility);
    }

    if (showVectors) {
        showVectors.addEventListener('change', updateVectorVisibility);
    }

    // Thermal comfort controls
    const comfortIndex = document.getElementById('comfort-index');
    const airTempSlider = document.getElementById('air-temp-slider');
    const airTempDisplay = document.getElementById('air-temp-display');
    const airVelocitySlider = document.getElementById('air-velocity-slider');
    const airVelocityDisplay = document.getElementById('air-velocity-display');

    if (comfortIndex) {
        comfortIndex.addEventListener('change', updateThermalVisualization);
    }

    if (airTempSlider && airTempDisplay) {
        airTempSlider.addEventListener('input', (e) => {
            airTempDisplay.textContent = e.target.value;
            updateThermalVisualization();
        });
    }

    if (airVelocitySlider && airVelocityDisplay) {
        airVelocitySlider.addEventListener('input', (e) => {
            airVelocityDisplay.textContent = e.target.value;
            updateThermalVisualization();
        });
    }
}

// Flood simulation functions
function updateFloodVisualization() {
    if (!maps.flood) return;

    // Clear existing markers
    floodMarkers.forEach(marker => maps.flood.removeLayer(marker));
    floodMarkers = [];

    const scenarioSelect = document.getElementById('flood-scenario');
    const timeSlider = document.getElementById('time-slider');
    
    if (!scenarioSelect || !timeSlider) return;

    const scenarioIndex = parseInt(scenarioSelect.value);
    const currentTime = parseInt(timeSlider.value);
    const scenario = sampleData.floodData.scenarios[scenarioIndex];

    if (scenario) {
        scenario.coordinates.forEach(coord => {
            if (currentTime >= coord.time) {
                const color = getFloodColor(coord.depth);
                const radius = coord.depth * 50;
                
                const marker = L.circle([coord.lat, coord.lng], {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.6,
                    radius: radius
                }).bindPopup(`<strong>Głębokość: ${coord.depth}m</strong><br>Czas: ${coord.time} min`);
                
                marker.addTo(maps.flood);
                floodMarkers.push(marker);
            }
        });
    }
}

function getFloodColor(depth) {
    if (depth < 0.5) return '#3B82F6';
    if (depth < 1) return '#10B981';
    if (depth < 2) return '#F59E0B';
    return '#EF4444';
}

function toggleFloodAnimation() {
    const playButton = document.getElementById('play-animation');
    const timeSlider = document.getElementById('time-slider');
    
    if (!playButton || !timeSlider) return;

    if (animationPlaying) {
        clearInterval(animationInterval);
        animationPlaying = false;
        playButton.innerHTML = '<i class="fas fa-play"></i> Odtwórz';
    } else {
        animationPlaying = true;
        playButton.innerHTML = '<i class="fas fa-pause"></i> Zatrzymaj';
        
        animationInterval = setInterval(() => {
            let currentTime = parseInt(timeSlider.value);
            currentTime += 5;
            if (currentTime > 180) {
                currentTime = 0;
            }
            timeSlider.value = currentTime;
            document.getElementById('time-value').textContent = currentTime;
            updateFloodVisualization();
        }, 500);
    }
}

// Wind analysis functions - poprawione z obsługą błędów ładowania danych
function updateWindVisualization() {
    if (!maps.wind) return;

    // Clear existing markers
    maps.wind.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.icon && 
            layer.options.icon.options.className === 'wind-marker') {
            maps.wind.removeLayer(layer);
        }
    });

    const scenarioSelect = document.getElementById('wind-scenario');
    if (!scenarioSelect) return;

    const scenarioIndex = parseInt(scenarioSelect.value);
    const scenario = sampleData.windData.scenarios[scenarioIndex];

    if (scenario) {
        // Add wind speed markers
        const markers = [
            {lat: 52.2297, lng: 21.0122, speed: scenario.windSpeed * 0.8},
            {lat: 52.2305, lng: 21.0135, speed: scenario.windSpeed * 1.2},
            {lat: 52.2312, lng: 21.0118, speed: scenario.windSpeed * 0.9}
        ];

        markers.forEach(marker => {
            const color = getWindColor(marker.speed);
            L.marker([marker.lat, marker.lng], {
                icon: L.divIcon({
                    className: 'wind-marker',
                    html: `<div style="background-color: ${color}; 
                                   width: 20px; height: 20px; 
                                   border-radius: 50%; border: 2px solid white;"></div>`,
                    iconSize: [24, 24]
                })
            }).bindPopup(`<strong>Prędkość wiatru</strong><br>${marker.speed.toFixed(1)} m/s`)
             .addTo(maps.wind);
        });
    }

    // Jeśli dane symulacji są dostępne, użyj zaawansowanej wizualizacji
    if (windSimulationData && currentVelocityLayer) {
        // Odśwież zaawansowaną wizualizację jeśli jest już zainicjalizowana
        initAdvancedWindVisualization();
    }
}

function getWindColor(speed) {
    if (speed < 2) return '#3B82F6';
    if (speed < 4) return '#10B981';
    if (speed < 6) return '#F59E0B';
    if (speed < 10) return '#F97316';
    return '#EF4444';
}

function updateParticleVisibility() {
    const showParticles = document.getElementById('show-particles');
    if (!showParticles) return;

    if (currentAnimationLayer) {
        if (showParticles.checked) {
            if (!maps.wind.hasLayer(currentAnimationLayer)) {
                maps.wind.addLayer(currentAnimationLayer);
            }
        } else {
            if (maps.wind.hasLayer(currentAnimationLayer)) {
                maps.wind.removeLayer(currentAnimationLayer);
            }
        }
    }
}

function updateVectorVisibility() {
    const showVectors = document.getElementById('show-vectors');
    if (!showVectors) return;

    if (currentVelocityLayer) {
        if (showVectors.checked) {
            if (!maps.wind.hasLayer(currentVelocityLayer)) {
                maps.wind.addLayer(currentVelocityLayer);
            }
        } else {
            if (maps.wind.hasLayer(currentVelocityLayer)) {
                maps.wind.removeLayer(currentVelocityLayer);
            }
        }
    }
}

// Thermal comfort functions
function updateThermalVisualization() {
    if (!maps.thermal) return;

    // Clear existing markers
    thermalMarkers.forEach(marker => maps.thermal.removeLayer(marker));
    thermalMarkers = [];

    const thermalData = sampleData.thermalData.zones;
    const comfortIndex = document.getElementById('comfort-index');
    const airTempSlider = document.getElementById('air-temp-slider');
    const airVelocitySlider = document.getElementById('air-velocity-slider');

    let selectedIndex = 'pmv';
    let airTemp = 25;
    let airVelocity = 0.1;

    if (comfortIndex) selectedIndex = comfortIndex.value;
    if (airTempSlider) airTemp = parseFloat(airTempSlider.value);
    if (airVelocitySlider) airVelocity = parseFloat(airVelocitySlider.value);

    thermalData.forEach(zone => {
        let displayValue = zone.pmv;
        let colorValue = zone.pmv;

        if (selectedIndex === 'temperature') {
            displayValue = zone.temperature;
            colorValue = (zone.temperature - 20) / 10; // Normalize for coloring
        }

        const color = getThermalColor(colorValue);
        const marker = L.circle([zone.lat, zone.lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            radius: 100
        }).bindPopup(`<strong>PMV:</strong> ${zone.pmv}<br>
                     <strong>Temperatura:</strong> ${zone.temperature}°C`);

        marker.addTo(maps.thermal);
        thermalMarkers.push(marker);
    });
}

function getThermalColor(value) {
    // PMV scale coloring
    if (value < -2) return '#0066CC';
    if (value < -1) return '#3399FF';
    if (value < -0.5) return '#66CCFF';
    if (value < 0.5) return '#00FF00';
    if (value < 1) return '#FFCC00';
    if (value < 2) return '#FF6600';
    return '#FF0000';
}

// Particle system
function initParticleSystem() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
            this.size = Math.random() * 2 + 1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
        }
    }

    // Create particles
    const particleCount = 50;
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // Draw connections
        particles.forEach((particle1, i) => {
            particles.slice(i + 1).forEach(particle2 => {
                const distance = Math.sqrt(
                    Math.pow(particle1.x - particle2.x, 2) + 
                    Math.pow(particle1.y - particle2.y, 2)
                );

                if (distance < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particle1.x, particle1.y);
                    ctx.lineTo(particle2.x, particle2.y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - distance/1000})`;
                    ctx.stroke();
                }
            });
        });

        requestAnimationFrame(animate);
    }

    animate();
}

// Portfolio functions
function initPortfolio() {
    renderPortfolio();
    initPortfolioFilters();
    initProjectModal();
}

function renderPortfolio() {
    const portfolioGrid = document.getElementById('portfolio-grid');
    if (!portfolioGrid) return;

    portfolioGrid.innerHTML = sampleData.projects.map(project => `
        <div class="project-card" data-category="${project.category}" data-project-id="${project.id}">
            <div class="project-image">
                <img src="${project.image}" alt="${project.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDMwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUM5Qzk3IiBmb250LXNpemU9IjE0Ij5Qcm9qZWt0PC90ZXh0Pgo8L3N2Zz4='">
                <div class="project-overlay">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <div class="project-results">
                        <strong>${project.results}</strong>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers for project cards
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('click', () => {
            const projectId = card.dataset.projectId;
            openProjectModal(projectId);
        });
    });
}

function initPortfolioFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;

            // Update active filter button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Filter projects
            projectCards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

function initProjectModal() {
    // Modal will be created dynamically when needed
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            closeProjectModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProjectModal();
        }
    });
}

function openProjectModal(projectId) {
    const project = sampleData.projects.find(p => p.id == projectId);
    if (!project) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="project-modal">
            <button class="modal-close" onclick="closeProjectModal()">&times;</button>
            <div class="modal-content">
                <img src="${project.image}" alt="${project.title}" class="modal-image">
                <div class="modal-info">
                    <h2>${project.title}</h2>
                    <p class="project-category">Kategoria: ${project.category}</p>
                    <p class="project-description">${project.description}</p>
                    <div class="project-results">
                        <h3>Wyniki:</h3>
                        <p>${project.results}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
    const modal = document.querySelector('.modal-backdrop');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Blog functions
function initBlog() {
    renderBlogPosts();
}

function renderBlogPosts() {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid) return;

    blogGrid.innerHTML = sampleData.blogPosts.map(post => `
        <article class="blog-card">
            <div class="blog-content">
                <div class="blog-category">${post.category}</div>
                <h3 class="blog-title">${post.title}</h3>
                <p class="blog-excerpt">${post.excerpt}</p>
                <div class="blog-meta">
                    <span class="blog-date">${new Date(post.date).toLocaleDateString('pl-PL')}</span>
                    <a href="#" class="read-more">Czytaj więcej</a>
                </div>
            </div>
        </article>
    `).join('');
}

// Contact form
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);

        // Simulate form submission
        console.log('Dane formularza:', data);
        
        // Show success message
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        submitButton.textContent = 'Wysłano!';
        submitButton.disabled = true;
        
        setTimeout(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            contactForm.reset();
        }, 3000);
    });
}

// Utility functions
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

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Initialize intersection observer for animations
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, observerOptions);

    // Observe elements that should animate on scroll
    const animateElements = document.querySelectorAll('.project-card, .blog-card, .quick-card');
    animateElements.forEach(el => observer.observe(el));
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Czas ładowania strony: ${loadTime}ms`);
    });
}

// Service Worker registration (if available)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker zarejestrowany:', registration);
            })
            .catch(error => {
                console.log('Rejestracja Service Worker nieudana:', error);
            });
    });
}

// Error handling
window.addEventListener('error', (e) => {
    console.error('Błąd aplikacji:', e.error);
    // Here you could send error to logging service
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Nieobsłużone odrzucenie Promise:', e.reason);
    e.preventDefault();
});
