// ============================================================================
// MODUŁ 0: DATA MANAGER - Inteligentne ładowanie i cache'owanie
// ============================================================================
const DataManager = {
    cache: new Map(),
    checksums: new Map(),
    
    async loadData(dataType = 'wind', forceRefresh = false) {
        const cacheKey = `${dataType}_data`;
        const retryLimit = 3;
        let attempt = 0;
        
        while (attempt < retryLimit) {
            try {
                // OPCJA 1: Pobierz z GitHub Pages (api/data/wind_simulation/current.json)
                let dataUrl = `api/data/${dataType}_simulation/current.json?t=${Date.now()}`;
                let metaUrl = `api/data/${dataType}_simulation/metadata.json?t=${Date.now()}`;
                
                console.log(`📡 Próba ${attempt + 1}/${retryLimit}: Ładowanie z ${dataUrl}`);
                
                // Pobierz metadata
                const metaResponse = await fetch(metaUrl);
                let metadata = null;
                
                if (metaResponse.ok) {
                    metadata = await metaResponse.json();
                    console.log(`✅ Metadane załadowane:`, metadata);
                    
                    // Sprawdź czy dane się zmieniły (checksum)
                    if (!forceRefresh && this.checksums.get(cacheKey) === metadata.checksum) {
                        console.log(`📦 ${dataType} data już w cache (checksum match)`);
                        return this.cache.get(cacheKey);
                    }
                }
                
                // Pobierz pełne dane
                const dataResponse = await fetch(dataUrl);
                if (!dataResponse.ok) {
                    throw new Error(`HTTP ${dataResponse.status}`);
                }
                
                const data = await dataResponse.json();
                console.log(`✅ Dane załadowane:`, data);
                
                // Walidacja struktury danych
                if (!data.vector_field || data.vector_field.length === 0) {
                    throw new Error('Brak vector_field w danych');
                }
                
                // Cache + Checksum
                this.cache.set(cacheKey, data);
                if (metadata) {
                    this.checksums.set(cacheKey, metadata.checksum);
                }
                
                // UI feedback
                this.showDataUpdateNotification({
                    type: dataType,
                    timestamp: metadata ? metadata.last_update : new Date().toISOString(),
                    points: metadata ? metadata.data_points : { vectors: data.vector_field.length }
                });
                
                return data;
                
            } catch (error) {
                console.error(`❌ Próba ${attempt + 1} failed:`, error);
                attempt++;
                
                if (attempt < retryLimit) {
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }
            }
        }
        
        // Fallback: zwróć cached dane
        const cached = this.cache.get(cacheKey);
        if (cached) {
            console.warn(`⚠️ Używam cached danych po ${retryLimit} próbach`);
            return cached;
        }
        
        console.error(`❌ Nie mogę załadować ${dataType} po ${retryLimit} próbach`);
        return null;
    },
    
    showDataUpdateNotification(info) {
        const badge = document.querySelector('.data-update-badge');
        if (badge) {
            const timeStr = new Date(info.timestamp).toLocaleTimeString('pl-PL');
            badge.innerHTML = `
                <span class="pulse-dot"></span>
                <span class="data-type">${info.type.toUpperCase()}</span>
                <span class="update-time">${timeStr}</span>
                <span class="data-points">→ ${info.points.vectors || info.points.streamlines || '?'} pts</span>
            `;
            badge.style.animation = 'slideIn 0.5s ease-out';
        }
    }
};

// ============================================================================
// MODUŁ 1: KONFIGURACJA I DANE
// ============================================================================

// Konfiguracja wizualizacji wiatru
const WIND_VIZ_CONFIG = {
    PARTICLE_COUNT: 1000,
    PARTICLE_SPEED_SCALE: 0.5,
    PARTICLE_LIFESPAN: 500,  // KRÓCEJ - szybko znikają (było 400)
    PARTICLE_LINE_WIDTH: 1.6,
    PARTICLE_COLOR: "rgba(255, 255, 255, 0.35)",
    GLOW_COLOR: "rgba(200, 220, 255, 0.2)",
    GLOW_BLUR: 7,
    STREAMLINE_COUNT: 50,
    STREAMLINE_STEPS: 100,
    STREAMLINE_COLOR: "rgba(80, 100, 130, 0.5)",
    STREAMLINE_WIDTH: 1.5,
    SHOW_VECTORS: false,
    SHOW_STATISTICS: false,
    SHOW_HEATMAP: true,
    SHOW_STREAMLINES: false,
    SHOW_PARTICLES: false
};




let windSimulationData = null;
let windVisualizationState = {
    activeLayer: 'all',
    selectedPoint: null,
    hoveredPoint: null,
    measurementMode: false,
    measurementPoints: []
};

// Sample data dla portfolio, blog, etc.
const sampleData = {
    weatherData: {
        temperature: 22.5,
        humidity: 65,
        pressure: 1013.2,
        windSpeed: 12.8,
        windDirection: 245,
        location: "Warszawa",
        description: "Pochmurno z przelotnymi opadami"
    },
    floodData: {
        scenarios: [
            {
                id: 1,
                name: "Opady 50mm/h",
                duration: 120,
                maxDepth: 1.5,
                affectedArea: 850,
                coordinates: [
                    {lat: 52.2297, lng: 21.0122, depth: 0.8, time: 30},
                    {lat: 52.2305, lng: 21.0135, depth: 1.2, time: 45},
                    {lat: 52.2312, lng: 21.0118, depth: 0.6, time: 60},
                    {lat: 52.2285, lng: 21.0140, depth: 0.9, time: 75},
                    {lat: 52.2320, lng: 21.0100, depth: 1.1, time: 90}
                ]
            }
        ]
    },
    projects: [
        {
            id: 1,
            title: "Analiza Zagrożenia Powodziowego - Centrum Warszawy",
            type: "Symulacja Powodzi",
            date: "2024-08-15",
            location: "Warszawa",
            description: "Kompleksowa analiza ryzyka powodziowego dla śródmieścia Warszawy z uwzględnieniem infrastruktury miejskiej.",
            image: "https://via.placeholder.com/400x300/1e40af/ffffff?text=Analiza+Powodzi",
            tags: ["HEC-RAS", "GIS", "Hydrologia"],
            results: "Zidentyfikowano 5 obszarów krytycznych",
            category: "flood"
        },
        {
            id: 2,
            title: "Optymalizacja Wentylacji Naturalnej - Kompleks Biurowy",
            type: "Analiza Wiatru",
            date: "2024-07-22",
            location: "Kraków",
            description: "Symulacja CFD przepływu powietrza wokół planowanego kompleksu biurowego w celu optymalizacji komfortu.",
            image: "https://via.placeholder.com/400x300/059669/ffffff?text=CFD+Analiza",
            tags: ["CFD", "ANSYS", "Aerodynamika"],
            results: "30% poprawa wentylacji naturalnej",
            category: "wind"
        },
        {
            id: 3,
            title: "Mapa Komfortu Termicznego - Park Miejski",
            type: "Komfort Termiczny",
            date: "2024-06-10",
            location: "Gdańsk",
            description: "Ocena bioklimatyczna przestrzeni publicznych z rekomendacjami zagospodarowania zieleni.",
            image: "https://via.placeholder.com/400x300/dc2626/ffffff?text=Komfort+Termiczny",
            tags: ["UTCI", "PMV", "Bioklimat"],
            results: "Plan nasadzeń zieleni wysokiej",
            category: "thermal"
        }
    ],
    blogPosts: [
        {
            id: 1,
            title: "Nowoczesne Metody Modelowania Powodzi Miejskich",
            excerpt: "Przegląd najnowszych technik symulacji hydraulicznej w środowisku zurbanizowanym, w tym modele 1D/2D i ich zastosowania praktyczne.",
            date: "2024-09-05",
            category: "Hydrologia",
            readTime: "8 min"
        },
        {
            id: 2,
            title: "CFD w Planowaniu Urbanistycznym - Case Study",
            excerpt: "Jak symulacje obliczeniowej mechaniki płynów mogą wspomóc projektowanie przestrzeni miejskich przyjaznych pieszym.",
            date: "2024-08-28",
            category: "Aerodynamika",
            readTime: "12 min"
        },
        {
            id: 3,
            title: "Wskaźniki Komfortu Bioklimatycznego - PMV vs UTCI",
            excerpt: "Porównanie różnych metod oceny komfortu termicznego człowieka w przestrzeniach zewnętrznych.",
            date: "2024-08-15",
            category: "Bioklimat",
            readTime: "6 min"
        }
    ]
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

// ============================================================================
// MODUŁ 2: FUNKCJE POMOCNICZE
// ============================================================================

// Funkcja mapowania wartości na kolor - CIEMNA PALETA
function getViridisColor(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Ciemniejsza paleta kolorów
    const r = Math.round(255 * (0.15 + 0.4 * t));
    const g = Math.round(255 * (0.20 + 0.5 * t));
    const b = Math.round(255 * (0.30 + 0.4 * t));
    
    return `rgba(${r},${g},${b},0.5)`;
}
// Funkcja mapowania wartości na kolor - KLASYCZNA PALETA CFD (jet)
function getCFDColor(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    let r, g, b;
    
    if (t < 0.125) {
        r = 0;
        g = 0;
        b = Math.round(255 * (0.5 + t * 4));
    } else if (t < 0.375) {
        r = 0;
        g = Math.round(255 * ((t - 0.125) * 4));
        b = 255;
    } else if (t < 0.625) {
        r = Math.round(255 * ((t - 0.375) * 4));
        g = 255;
        b = Math.round(255 * (1 - (t - 0.375) * 4));
    } else if (t < 0.875) {
        r = 255;
        g = Math.round(255 * (1 - (t - 0.625) * 4));
        b = 0;
    } else {
        r = Math.round(255 * (1 - (t - 0.875) * 2));
        g = 0;
        b = 0;
    }
    
    return `rgba(${r},${g},${b},0.7)`;
}


// ============================================================================
// MODUŁ 3: GENEROWANIE BRAKUJĄCYCH DANYCH
// ============================================================================

// Generuj magnitude_grid z vector_field
function createMagnitudeGridFromVectorField(vectorField) {
    const maxX = Math.max(...vectorField.map(v => v.pixel_x || v.x));
    const maxY = Math.max(...vectorField.map(v => v.pixel_y || v.y));
    const gridWidth = Math.floor(maxX / 5) + 1;
    const gridHeight = Math.floor(maxY / 5) + 1;
    
    const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));
    
    vectorField.forEach(point => {
        const i = Math.floor((point.pixel_x || point.x) / 5);
        const j = Math.floor((point.pixel_y || point.y) / 5);
        if (i < gridWidth && j < gridHeight && i >= 0 && j >= 0) {
            grid[j][i] = point.magnitude;
        }
    });
    
    return { grid, gridWidth, gridHeight };
}

// Oblicz bounds z vector_field
function calculateBoundsFromVectorField(vectorField) {
    const lons = vectorField.map(v => v.longitude).filter(lon => lon !== undefined);
    const lats = vectorField.map(v => v.latitude).filter(lat => lat !== undefined);
    
    if (lons.length === 0 || lats.length === 0) {
        console.error('Brak współrzędnych geograficznych w vector_field');
        return null;
    }
    
    return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lons),
        west: Math.min(...lons)
    };
}

// Generuj streamlines z vector_field
function generateStreamlines(vectorField, count = 50) {
    const streamlines = [];
    const gridMap = new Map();
    
    // Indeksuj vector_field dla szybkiego dostępu
    vectorField.forEach(v => {
        const x = v.pixel_x || v.x;
        const y = v.pixel_y || v.y;
        const key = `${Math.round(x/5)}_${Math.round(y/5)}`;
        gridMap.set(key, v);
    });
    
    // Generuj streamlines
    for (let i = 0; i < count; i++) {
        const startPoint = vectorField[Math.floor(Math.random() * vectorField.length)];
        const streamline = [];
        let current = { ...startPoint };
        
        for (let step = 0; step < WIND_VIZ_CONFIG.STREAMLINE_STEPS; step++) {
            streamline.push({
                latitude: current.latitude,
                longitude: current.longitude,
                vx: current.vx,
                vy: current.vy,
                magnitude: current.magnitude
            });
            
            // Przesuń punkt wzdłuż wektora
            const px = current.pixel_x || current.x;
            const py = current.pixel_y || current.y;
            const newPx = px + current.vx * 0.5;
            const newPy = py + current.vy * 0.5;
            
            // Znajdź najbliższy punkt w siatce
            const key = `${Math.round(newPx/5)}_${Math.round(newPy/5)}`;
            const nextPoint = gridMap.get(key);
            
            if (!nextPoint || nextPoint.magnitude < 0.1) break;
            
            current = {
                ...nextPoint,
                pixel_x: newPx,
                pixel_y: newPy
            };
        }
        
        if (streamline.length > 10) {
            streamlines.push(streamline);
        }
    }
    
    console.log(`✅ Wygenerowano ${streamlines.length} streamlines`);
    return streamlines;
}

// ============================================================================
// MODUŁ 4: ŁADOWANIE I PRZYGOTOWANIE DANYCH
// ============================================================================

async function loadWindSimulationData() {
    try {
        console.log('🔄 Ładuję dane symulacji wiatru...');
        
        // Użyj nowego DataManager
        windSimulationData = await DataManager.loadData('wind', false);
        
        if (!windSimulationData) {
            console.error('❌ DataManager nie zwrócił danych');
            return null;
        }
        
        console.log('✅ Dane symulacji wiatru załadowane:', windSimulationData.metadata);

        
        // Walidacja danych
        if (windSimulationData.vector_field && windSimulationData.vector_field.length > 0) {
            const firstPoint = windSimulationData.vector_field[0];
            if (firstPoint.longitude !== undefined && firstPoint.latitude !== undefined) {
                console.log('✅ Dane zawierają współrzędne geograficzne');
            } else {
                console.error('❌ Dane NIE zawierają współrzędnych geograficznych!');
            }
        }
        
        // Inicjalizuj wizualizację
        if (maps.wind) {
            addAdvancedWindCSS();
            initAdvancedWindVisualization();
        }
        
        return windSimulationData;
    } catch (error) {
        console.error('❌ Błąd podczas ładowania danych symulacji wiatru:', error);
        return null;
    }
}

// Adapter danych - przekształca dane na format wymagany przez wizualizację
function createWindDataAdapter(rawWindData) {
    if (!rawWindData || !rawWindData.vector_field) {
        console.error('Brak danych wejściowych');
        return null;
    }
    
    // Sprawdź współrzędne geograficzne
    const hasGeoCoords = rawWindData.vector_field.length > 0 && 
                         rawWindData.vector_field[0].longitude !== undefined;
    
    if (!hasGeoCoords) {
        console.error('Dane nie zawierają współrzędnych geograficznych!');
        return null;
    }
    
    // Oblicz lub pobierz bounds
    let bounds_wgs84 = rawWindData.spatial_reference?.bounds_wgs84;
    if (!bounds_wgs84) {
        console.warn('⚠️ Brak bounds_wgs84, obliczam z vector_field...');
        bounds_wgs84 = calculateBoundsFromVectorField(rawWindData.vector_field);
        if (!bounds_wgs84) return null;
    }
    
    const bounds = L.latLngBounds(
        [bounds_wgs84.south, bounds_wgs84.west],
        [bounds_wgs84.north, bounds_wgs84.east]
    );
    
    // Generuj magnitude_grid jeśli brak
    let magnitudeGrid, gridWidth, gridHeight;
    if (rawWindData.magnitude_grid) {
        magnitudeGrid = rawWindData.magnitude_grid;
        gridWidth = magnitudeGrid[0].length;
        gridHeight = magnitudeGrid.length;
    } else {
        console.warn('⚠️ Brak magnitude_grid, generuję z vector_field...');
        const result = createMagnitudeGridFromVectorField(rawWindData.vector_field);
        magnitudeGrid = result.grid;
        gridWidth = result.gridWidth;
        gridHeight = result.gridHeight;
    }
    
    // Generuj streamlines jeśli brak
    let streamlines;
    if (rawWindData.streamlines && rawWindData.streamlines.length > 0) {
        streamlines = rawWindData.streamlines.map(streamline => 
            streamline.map(point => ({
                ...point,
                lat: point.latitude,
                lng: point.longitude
            }))
        );
    } else {
        console.warn('⚠️ Brak streamlines, generuję z vector_field...');
        streamlines = generateStreamlines(
            rawWindData.vector_field, 
            WIND_VIZ_CONFIG.STREAMLINE_COUNT
        ).map(streamline => 
            streamline.map(point => ({
                ...point,
                lat: point.latitude,
                lng: point.longitude
            }))
        );
    }
    
    // Przygotuj vector field z prędkościami
    const vectorField = rawWindData.vector_field.map(vector => ({
        ...vector,
        lat: vector.latitude,
        lng: vector.longitude
    }));
    
    console.log('✅ Adapter danych utworzony:', {
        gridSize: `${gridWidth}x${gridHeight}`,
        streamlines: streamlines.length,
        vectorPoints: vectorField.length
    });
    
    return {
        magnitudeGrid,
        gridWidth,
        gridHeight,
        bounds,
        minMagnitude: rawWindData.flow_statistics.min_magnitude,
        maxMagnitude: rawWindData.flow_statistics.max_magnitude,
        streamlines,
        vectorField,
        metadata: rawWindData.metadata,
        performance: rawWindData.performance,
        spatial_reference: rawWindData.spatial_reference
    };
}

// ============================================================================
// MODUŁ 5: WARSTWY WIZUALIZACJI
// ============================================================================

// === VelocityLayer - Warstwa pola prędkości (NA SPODZIE) ===
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
        
        const cellWidth = (this.bounds.getEast() - this.bounds.getWest()) / w;
        const cellHeight = (this.bounds.getNorth() - this.bounds.getSouth()) / h;
        
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const lat = this.bounds.getNorth() - ((j + 0.5) * cellHeight);
                const lon = this.bounds.getWest() + ((i + 0.5) * cellWidth);
                const point = this._map.latLngToContainerPoint([lat, lon]);
                
                const value = grid[j] && grid[j][i] !== undefined ? grid[j][i] : NaN;
                if (!isFinite(value)) continue;
                
                ctx.fillStyle = getCFDColor(value, minMagnitude, maxMagnitude);
                ctx.fillRect(Math.round(point.x - 2), Math.round(point.y - 2), 4, 4);
            }
        }
    }
});

// === StreamlineLayer - PRZYWRÓCONE ORYGINALNE LINIE PRZEPŁYWU (W ŚRODKU) ===
const StreamlineLayer = L.Layer.extend({
    initialize: function(data, bounds) {
        this._data = data;
        this.bounds = bounds;
    },
    
    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated streamline-canvas');
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
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
        if (!this._data.streamlines || this._data.streamlines.length === 0) return;
        
        const ctx = this._ctx;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 4;
        
        this._data.streamlines.forEach(streamline => {
            if (streamline.length < 2) return;
            
            ctx.beginPath();
            const firstPoint = this._map.latLngToContainerPoint([streamline[0].lat, streamline[0].lng]);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < streamline.length; i++) {
                const point = this._map.latLngToContainerPoint([streamline[i].lat, streamline[i].lng]);
                ctx.lineTo(point.x, point.y);
            }
            
            ctx.stroke();
        });
        
        ctx.shadowBlur = 0;
    }
});

// === WindAnimationLayer - SZYBKO ZANIKAJĄCE I POJAWIAJĄCE SIĘ CZĄSTKI (NA WIERZCHU) ===
const AdvancedWindAnimationLayer = L.Layer.extend({
    initialize: function(data, bounds) {
        this._data = data;
        this.bounds = bounds;
        this._particles = [];
        this._animationFrame = null;
        this._lastFrameTime = 0;
        this._frameInterval = 1000 / 30;
    },
    
    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated wind-canvas');
        this._canvas.id = 'wind-canvas';
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        map.getPanes().overlayPane.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');
        
        this._ctx.imageSmoothingEnabled = false;
        
        map.on('moveend zoomend resize', this._reset, this);
        this._reset();
        this._initializeParticles();
        this._animate(0);
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
        
        if (!this._data.vectorField || this._data.vectorField.length === 0) {
            console.warn('⚠️ Brak vector_field dla cząstek');
            return;
        }
        
        const vectorField = this._data.vectorField;
        const particleCount = Math.min(WIND_VIZ_CONFIG.PARTICLE_COUNT, vectorField.length);
        
        this._vectorMap = new Map();
        vectorField.forEach(v => {
            const key = `${Math.round(v.lat * 1000)}_${Math.round(v.lng * 1000)}`;
            this._vectorMap.set(key, v);
        });
        
        for (let i = 0; i < particleCount; i++) {
            const vectorPoint = vectorField[Math.floor(Math.random() * vectorField.length)];
            const point = this._map.latLngToContainerPoint([vectorPoint.lat, vectorPoint.lng]);
            
            if (point.x >= 0 && point.x < this._canvas.width && 
                point.y >= 0 && point.y < this._canvas.height) {
                this._particles.push({
                    x: point.x,
                    y: point.y,
                    vx: vectorPoint.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE,
                    vy: -vectorPoint.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE,
                    age: Math.random() * WIND_VIZ_CONFIG.PARTICLE_LIFESPAN,
                    lat: vectorPoint.lat,
                    lng: vectorPoint.lng
                });
            }
        }
        
        console.log(`✅ Zainicjalizowano ${this._particles.length} szybko zanikających cząstek`);
    },
    
    _getVectorAtPosition: function(lat, lng) {
        const key = `${Math.round(lat * 1000)}_${Math.round(lng * 1000)}`;
        return this._vectorMap.get(key) || null;
    },
    
    _animate: function(currentTime) {
        this._animationFrame = requestAnimationFrame((time) => this._animate(time));
        
        const elapsed = currentTime - this._lastFrameTime;
        if (elapsed < this._frameInterval) {
            return;
        }
        this._lastFrameTime = currentTime - (elapsed % this._frameInterval);
        
        // SZYBKIE ZANIKANIE - większa wartość = szybsze zanikanie
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
        
        this._particles.forEach((particle, index) => {
            const oldX = particle.x;
            const oldY = particle.y;
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.age++;
            
            if (index % 3 === 0) {
                const latLng = this._map.containerPointToLatLng([particle.x, particle.y]);
                const newVector = this._getVectorAtPosition(latLng.lat, latLng.lng);
                
                if (newVector) {
                    particle.vx = newVector.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
                    particle.vy = -newVector.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
                }
            }
            
            // SZYBSZE POJAWIANIE SIĘ - krótszy lifespan
            if (particle.x < 0 || particle.x > this._canvas.width || 
                particle.y < 0 || particle.y > this._canvas.height || 
                particle.age > WIND_VIZ_CONFIG.PARTICLE_LIFESPAN) {
                
                const vectorPoint = this._data.vectorField[
                    Math.floor(Math.random() * this._data.vectorField.length)
                ];
                const newPoint = this._map.latLngToContainerPoint([vectorPoint.lat, vectorPoint.lng]);
                
                particle.x = newPoint.x;
                particle.y = newPoint.y;
                particle.vx = vectorPoint.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
                particle.vy = -vectorPoint.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
                particle.age = 0;
                return;
            }
            
            // SZYBSZY ZANIK - wykładnicza funkcja
            const ageRatio = particle.age / WIND_VIZ_CONFIG.PARTICLE_LIFESPAN;
            const alpha = Math.max(0.1, Math.pow(1 - ageRatio, 2)); // Wykładnicze zanikanie
            
            this._ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
            this._ctx.lineWidth = 1.0;
            this._ctx.shadowColor = `rgba(200, 220, 255, ${alpha * 0.2})`;
            this._ctx.shadowBlur = 2;
            
            this._ctx.beginPath();
            this._ctx.moveTo(oldX, oldY);
            this._ctx.lineTo(particle.x, particle.y);
            this._ctx.stroke();
        });
        
        this._ctx.shadowBlur = 0;
    }
});

// === Panel sterowania ===
const AdvancedWindControlPanel = L.Control.extend({
    options: {
        position: 'topleft'
    },
    
    onAdd: function(map) {
        this._map = map;
        this._container = L.DomUtil.create('div', 'leaflet-control wind-control-panel');
        this._container.style.background = 'rgba(30, 35, 45, 0.95)';
        this._container.style.padding = '12px';
        this._container.style.borderRadius = '8px';
        this._container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        this._container.style.minWidth = '260px';
        this._container.style.maxWidth = '280px';
        this._container.style.maxHeight = '90vh';
        this._container.style.overflowY = 'auto';
        
        this._render();
        return this._container;
    },
    
    _render: function() {
        this._container.innerHTML = `
            <div style="color: #e0e0e0;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 6px;">🎛️</span>
                        Kontrola Wizualizacji
                    </h3>
                    <button id="collapse-panel" style="background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 0;">
                        ▲
                    </button>
                </div>
                
                <div id="panel-content">
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                            Warstwy
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label class="layer-toggle" style="display: flex; align-items: center; cursor: pointer; padding: 6px; border-radius: 5px; transition: background 0.2s;">
                                <input type="checkbox" id="toggle-heatmap" checked style="margin-right: 8px; width: 14px; height: 14px; cursor: pointer;">
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 500;">Mapa cieplna</div>
                                    <div style="font-size: 10px; color: #9ca3af;">Pole prędkości</div>
                                </div>
                            </label>
                            
                            <label class="layer-toggle" style="display: flex; align-items: center; cursor: pointer; padding: 6px; border-radius: 5px; transition: background 0.2s;">
                                <input type="checkbox" id="toggle-streamlines" checked style="margin-right: 8px; width: 14px; height: 14px; cursor: pointer;">
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 500;">Linie przepływu</div>
                                    <div style="font-size: 10px; color: #9ca3af;">Ścieżki wiatru</div>
                                </div>
                            </label>
                            
                            <label class="layer-toggle" style="display: flex; align-items: center; cursor: pointer; padding: 6px; border-radius: 5px; transition: background 0.2s;">
                                <input type="checkbox" id="toggle-particles" checked style="margin-right: 8px; width: 14px; height: 14px; cursor: pointer;">
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 500;">Animacja cząstek</div>
                                    <div style="font-size: 10px; color: #9ca3af;">Dynamika</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                            Intensywność
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="range" id="opacity-slider" min="0" max="100" value="70" style="flex: 1; cursor: pointer;">
                            <span id="opacity-value" style="min-width: 32px; font-size: 12px;">70%</span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">
                            Gęstość cząstek
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="range" id="particle-density-slider" min="200" max="2000" step="200" value="600" style="flex: 1; cursor: pointer;">
                            <span id="particle-density-value" style="min-width: 38px; font-size: 12px;">600</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 6px;">
                        <button id="tool-export" class="tool-button" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; background: rgba(96, 165, 250, 0.1); color: #e0e0e0; cursor: pointer; transition: all 0.2s; font-size: 12px;">
                            <span style="margin-right: 6px;">💾</span>
                            <span>Eksport</span>
                        </button>
                        
                        <button id="reset-view" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 5px; color: #fca5a5; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                            <span style="margin-right: 6px;">🔄</span>
                            <span>Reset</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this._attachEventListeners();
    },
    
    _attachEventListeners: function() {
        const collapseBtn = this._container.querySelector('#collapse-panel');
        const content = this._container.querySelector('#panel-content');
        collapseBtn.addEventListener('click', () => {
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
            collapseBtn.textContent = content.style.display === 'none' ? '▼' : '▲';
        });
        
        this._container.querySelector('#toggle-heatmap').addEventListener('change', (e) => {
            this._toggleLayer('velocity', e.target.checked);
        });
        
        this._container.querySelector('#toggle-streamlines').addEventListener('change', (e) => {
            this._toggleLayer('streamline', e.target.checked);
        });
        
        this._container.querySelector('#toggle-particles').addEventListener('change', (e) => {
            this._toggleLayer('animation', e.target.checked);
        });
        
        this._container.querySelector('#opacity-slider').addEventListener('input', (e) => {
            const value = e.target.value;
            this._container.querySelector('#opacity-value').textContent = value + '%';
            this._updateOpacity(value / 100);
        });
        
        this._container.querySelector('#particle-density-slider').addEventListener('input', (e) => {
            const value = e.target.value;
            this._container.querySelector('#particle-density-value').textContent = value;
            this._updateParticleDensity(parseInt(value));
        });
        
        this._container.querySelector('#tool-export').addEventListener('click', () => {
            this._exportData();
        });
        
        this._container.querySelector('#reset-view').addEventListener('click', () => {
            this._resetView();
        });
        
        this._container.querySelectorAll('.layer-toggle').forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = 'rgba(96, 165, 250, 0.1)';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
        
        this._container.querySelectorAll('.tool-button').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(96, 165, 250, 0.2)';
                btn.style.borderColor = 'rgba(96, 165, 250, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(96, 165, 250, 0.1)';
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
            });
        });
    },
    
    _toggleLayer: function(layerName, visible) {
        if (window.advancedWindLayers && window.advancedWindLayers[layerName]) {
            const layer = window.advancedWindLayers[layerName];
            if (visible && !this._map.hasLayer(layer)) {
                layer.addTo(this._map);
            } else if (!visible && this._map.hasLayer(layer)) {
                this._map.removeLayer(layer);
            }
        }
    },
    
    _updateOpacity: function(opacity) {
        if (window.advancedWindLayers) {
            const velocity = window.advancedWindLayers.velocity;
            const streamline = window.advancedWindLayers.streamline;
            
            if (velocity && velocity._canvas) {
                velocity._canvas.style.opacity = opacity;
            }
            if (streamline && streamline._canvas) {
                streamline._canvas.style.opacity = opacity * 0.8;
            }
        }
    },
    
    _updateParticleDensity: function(density) {
        WIND_VIZ_CONFIG.PARTICLE_COUNT = density;
        if (window.advancedWindLayers && window.advancedWindLayers.animation) {
            window.advancedWindLayers.animation._initializeParticles();
        }
    },
    
    _exportData: function() {
        if (!windSimulationData) return;
        
        const dataStr = JSON.stringify(windSimulationData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `wind_simulation_${new Date().getTime()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    _resetView: function() {
        if (window.advancedWindLayers && windSimulationData) {
            const windData = createWindDataAdapter(windSimulationData);
            if (windData) {
                this._map.fitBounds(windData.bounds);
            }
        }
    }
});

// === Legenda (bez zmian) ===
const AdvancedLegendControl = L.Control.extend({
    options: {
        position: 'bottomright'
    },
    
    onAdd: function(map) {
        this._container = L.DomUtil.create('div', 'leaflet-control legend-control');
        this.update();
        return this._container;
    },
    
    update: function(min = 0, max = 16) {
        const gradientColors = [];
        for (let i = 0; i <= 100; i += 5) {
            gradientColors.push(getCFDColor(min + (i/100)*(max-min), min, max));
        }
        
        const labels = [max, max*0.75, max*0.5, max*0.25, min];
        
        this._container.innerHTML = `
            <div style="background: rgba(30, 35, 45, 0.95); padding: 15px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 13px; color: #e0e0e0;">
                        <span style="margin-right: 6px;">🌬️</span>
                        Prędkość wiatru
                    </div>
                    <div style="font-size: 11px; color: #9ca3af;">m/s</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 24px; 
                        height: 180px; 
                        background: linear-gradient(to top, ${gradientColors.join(', ')});
                        border-radius: 4px;
                        border: 1px solid rgba(255,255,255,0.2);
                        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 180px; color: #e0e0e0; font-size: 12px; font-weight: 500;">
                        ${labels.map(val => `<span style="line-height: 1;">${val.toFixed(1)}</span>`).join('')}
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 11px; color: #9ca3af; margin-bottom: 6px;">Skala Beauforta</div>
                    <div style="font-size: 11px; color: #e0e0e0; line-height: 1.5;">
                        ${this._getBeaufortDescription(max)}
                    </div>
                </div>
            </div>
        `;
    },
    
    _getBeaufortDescription: function(maxSpeed) {
        if (maxSpeed < 0.5) return '0 - Cisza';
        if (maxSpeed < 1.5) return '1 - Powiew';
        if (maxSpeed < 3.3) return '2 - Lekki wiatr';
        if (maxSpeed < 5.5) return '3 - Słaby wiatr';
        if (maxSpeed < 7.9) return '4 - Umiarkowany';
        if (maxSpeed < 10.7) return '5 - Dość silny';
        if (maxSpeed < 13.8) return '6 - Silny wiatr';
        if (maxSpeed < 17.1) return '7 - Bardzo silny';
        if (maxSpeed < 20.7) return '8 - Wichura';
        if (maxSpeed < 24.4) return '9 - Silna wichura';
        if (maxSpeed < 28.4) return '10 - Sztorm';
        if (maxSpeed < 32.6) return '11 - Gwałtowny sztorm';
        return '12 - Huragan';
    }
});


// ============================================================================
// MODUŁ 6: INICJALIZACJA GŁÓWNEJ WIZUALIZACJI
// ============================================================================

function initAdvancedWindVisualization() {
    if (!windSimulationData || !maps.wind) {
        console.error('❌ Brak danych lub mapy do wizualizacji');
        return;
    }
    
    console.log('🚀 Inicjalizacja zaawansowanej wizualizacji wiatru...');
    
    const windData = createWindDataAdapter(windSimulationData);
    if (!windData) {
        console.error('❌ Nie udało się przygotować danych');
        return;
    }
    
    if (window.advancedWindLayers) {
        Object.values(window.advancedWindLayers).forEach(layer => {
            if (layer && maps.wind.hasLayer(layer)) {
                maps.wind.removeLayer(layer);
            }
        });
    }
    
    const velocityLayer = new AdvancedVelocityLayer(windData, windData.bounds);
    const streamlineLayer = new StreamlineLayer(windData, windData.bounds);
    const animationLayer = new AdvancedWindAnimationLayer(windData, windData.bounds);
    const legendControl = new AdvancedLegendControl();
    const controlPanel = new AdvancedWindControlPanel();
    
    velocityLayer.addTo(maps.wind);
    streamlineLayer.addTo(maps.wind);
    animationLayer.addTo(maps.wind);
    
    legendControl.addTo(maps.wind);
    legendControl.update(windData.minMagnitude, windData.maxMagnitude);
    controlPanel.addTo(maps.wind);
    
    maps.wind.fitBounds(windData.bounds);
    
    window.advancedWindLayers = {
        velocity: velocityLayer,
        streamline: streamlineLayer,
        animation: animationLayer,
        legend: legendControl,
        control: controlPanel
    };
    
    console.log('✅ Wizualizacja wiatru zainicjalizowana (streamlines przywrócone)');
}



// ============================================================================
// MODUŁ 7: STYLE CSS
// ============================================================================

function addAdvancedWindCSS() {
    if (document.getElementById('advanced-wind-css')) return;
    
    const style = document.createElement('style');
    style.id = 'advanced-wind-css';
    style.textContent = `
        .velocity-canvas {
            opacity: 0.6;
            mix-blend-mode: multiply;
        }
        
        .streamline-canvas {
            opacity: 0.7;
            pointer-events: none;
        }
        
        .wind-canvas {
            opacity: 0.8;
            mix-blend-mode: normal;
            pointer-events: none;
        }
        
        .legend-control {
            z-index: 1000;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// MODUŁ 8: POZOSTAŁE FUNKCJE APLIKACJI
// ============================================================================

// Nawigacja
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                    
                    if (maps[targetId]) {
                        setTimeout(() => maps[targetId].invalidateSize(), 300);
                    }
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });
}

// Motyw ciemny/jasny
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (prefersDark) {
        document.body.classList.add('dark-theme');
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
        });
    }
}

// Widget pogodowy
function initWeatherWidget() {
    const weatherData = sampleData.weatherData;
    const tempEl = document.getElementById('temperature');
    const humEl = document.getElementById('humidity');
    const pressEl = document.getElementById('pressure');
    const windEl = document.getElementById('wind-speed');
    const locEl = document.getElementById('weather-location');
    
    if (tempEl) tempEl.textContent = weatherData.temperature + '°C';
    if (humEl) humEl.textContent = weatherData.humidity + '%';
    if (pressEl) pressEl.textContent = weatherData.pressure + ' hPa';
    if (windEl) windEl.textContent = weatherData.windSpeed + ' km/h';
    if (locEl) locEl.textContent = weatherData.location;
}

// Inicjalizacja map
function initMaps() {
    initMainMap();
    initFloodMap();
    initWindMap();
    initThermalMap();
    initContactMap();
}

function initMainMap() {
    const mapEl = document.getElementById('main-map');
    if (!mapEl) return;
    
    maps.main = L.map('main-map', {
        zoomControl: false
    }).setView([52.237049, 21.017532], 6);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
    }).addTo(maps.main);
}

function initFloodMap() {
    const mapEl = document.getElementById('flood-map');
    if (!mapEl) return;
    
    maps.flood = L.map('flood-map').setView([52.237049, 21.017532], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(maps.flood);
}

function initWindMap() {
    const mapEl = document.getElementById('wind-map');
    if (!mapEl) return;
    
    maps.wind = L.map('wind-map').setView([54.1068, 22.9233], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(maps.wind);
    
    loadWindSimulationData();
}

function initThermalMap() {
    const mapEl = document.getElementById('thermal-map');
    if (!mapEl) return;
    
    maps.thermal = L.map('thermal-map').setView([52.237049, 21.017532], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(maps.thermal);
}

function initContactMap() {
    const mapEl = document.getElementById('contact-map');
    if (!mapEl) return;
    
    maps.contact = L.map('contact-map', {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false
    }).setView([52.237049, 21.017532], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(maps.contact);
    L.marker([52.237049, 21.017532]).addTo(maps.contact);
}

// Kontrolki
function initControls() {
    console.log('Inicjalizacja kontrolek');
}

// System cząstek tła
function initParticleSystem() {
    console.log('Inicjalizacja systemu cząstek');
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
        <div class="project-card" data-category="${project.category}" data-id="${project.id}">
            <img src="${project.image}" alt="${project.title}" loading="lazy">
            <div class="project-card__content">
                <div class="project-card__meta">
                    <span>${project.type}</span>
                    <span>${project.date}</span>
                </div>
                <h3>${project.title}</h3>
                <p>${project.description}</p>
                <div class="project-tags">
                    ${project.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
            const projectId = parseInt(card.dataset.id);
            showProjectModal(projectId);
        });
    });
}

function initPortfolioFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;

            // Update active button
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
    const modal = document.getElementById('project-modal');
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    [overlay, closeBtn].forEach(element => {
        if (element) {
            element.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
    });
}

function showProjectModal(projectId) {
    const project = sampleData.projects.find(p => p.id === projectId);
    if (!project) return;

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <img src="${project.image}" alt="${project.title}" style="width: 100%; border-radius: 8px; margin-bottom: 16px;">
        <h2>${project.title}</h2>
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; color: var(--color-text-secondary);">
            <span>${project.type}</span>
            <span>${project.location}</span>
            <span>${project.date}</span>
        </div>
        <p>${project.description}</p>
        <div style="margin: 20px 0;">
            <h4>Wyniki</h4>
            <p>${project.results}</p>
        </div>
        <div>
            <h4>Technologie</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                ${project.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `;

    document.getElementById('project-modal').classList.remove('hidden');
}

// Blog functions
function initBlog() {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid) return;

    blogGrid.innerHTML = sampleData.blogPosts.map(post => `
        <article class="blog-card">
            <div class="blog-card__meta">
                <span class="blog-category">${post.category}</span>
                <span>${post.readTime}</span>
            </div>
            <h3>${post.title}</h3>
            <p>${post.excerpt}</p>
            <div style="margin-top: 16px; font-size: 14px; color: var(--color-text-secondary);">
                ${post.date}
            </div>
        </article>
    `).join('');
}

// Contact form
function initContactForm() {
    const form = document.getElementById('contact-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            console.log('Dane formularza:', data);
            alert('Dziękujemy za wiadomość! Skontaktujemy się wkrótce.');
            form.reset();
        });
    }
}

// ============================================================================
// MODUŁ 9: GŁÓWNA INICJALIZACJA
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicjalizacja aplikacji...');
    
    initNavigation();
    initThemeToggle();
    initWeatherWidget();
    initMaps();
    initControls();
    initParticleSystem();
    initPortfolio();
    initPortfolioFilters();
    initProjectModal();
    initBlog();
    initContactForm();
    
    console.log('✅ Aplikacja zainicjalizowana');
});


// Auto-refresh co godzinę
setInterval(() => {
    console.log('🔄 Auto-refresh: Ładuję nowe dane...');
    DataManager.loadData('wind', true);
}, 3600000);

// Załaduj dane przy starcie
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Portfolio inicjalizacja...');
    loadWindSimulationData();
});
