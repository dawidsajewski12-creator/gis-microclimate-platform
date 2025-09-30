// ============================================================================
// MODUŁ 1: KONFIGURACJA I DANE
// ============================================================================

// Konfiguracja wizualizacji wiatru
const WIND_VIZ_CONFIG = {
    PARTICLE_COUNT: 2000,
    PARTICLE_SPEED_SCALE: 0.3,
    PARTICLE_LIFESPAN: 800,
    PARTICLE_LINE_WIDTH: 1.2,
    PARTICLE_COLOR: "rgba(65, 85, 110, 0.7)",
    GLOW_COLOR: "rgba(65, 85, 110, 0.4)",
    GLOW_BLUR: 5,
    STREAMLINE_COUNT: 50,
    STREAMLINE_STEPS: 100,
    STREAMLINE_COLOR: "rgba(80, 100, 130, 0.5)",
    STREAMLINE_WIDTH: 1.5
};

let windSimulationData = null;

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
        // ZMIENIONA ŚCIEŻKA
        const response = await fetch('api/data/wind_simulation/current.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        windSimulationData = await response.json();
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
        
        const cellWidth = (this.bounds.getEast() - this.bounds.getWest()) / w;
        const cellHeight = (this.bounds.getNorth() - this.bounds.getSouth()) / h;
        
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const lat = this.bounds.getNorth() - ((j + 0.5) * cellHeight);
                const lon = this.bounds.getWest() + ((i + 0.5) * cellWidth);
                const point = this._map.latLngToContainerPoint([lat, lon]);
                
                const value = grid[j] && grid[j][i] !== undefined ? grid[j][i] : NaN;
                if (!isFinite(value)) continue;
                
                ctx.fillStyle = getViridisColor(value, minMagnitude, maxMagnitude);
                ctx.fillRect(Math.round(point.x - 2), Math.round(point.y - 2), 4, 4);
            }
        }
    }
});

// === StreamlineLayer - Warstwa linii przepływu ===
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
        
        ctx.strokeStyle = WIND_VIZ_CONFIG.STREAMLINE_COLOR;
        ctx.lineWidth = WIND_VIZ_CONFIG.STREAMLINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Opcjonalny efekt glow
        ctx.shadowColor = WIND_VIZ_CONFIG.STREAMLINE_COLOR;
        ctx.shadowBlur = 3;
        
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
        
        // Resetuj shadow
        ctx.shadowBlur = 0;
    }
});

// === WindAnimationLayer - Warstwa animacji cząstek (POPRAWIONA) ===
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
        
        if (!this._data.vectorField || this._data.vectorField.length === 0) {
            console.warn('⚠️ Brak vector_field dla cząstek');
            return;
        }
        
        // UŻYJ vector_field do generowania cząstek
        const vectorField = this._data.vectorField;
        const particleCount = Math.min(WIND_VIZ_CONFIG.PARTICLE_COUNT, vectorField.length * 2);
        
        for (let i = 0; i < particleCount; i++) {
            // Wybierz losowy punkt z vector_field
            const vectorPoint = vectorField[Math.floor(Math.random() * vectorField.length)];
            const point = this._map.latLngToContainerPoint([vectorPoint.lat, vectorPoint.lng]);
            
            // Sprawdź czy punkt jest w widoku
            if (point.x >= 0 && point.x < this._canvas.width && 
                point.y >= 0 && point.y < this._canvas.height) {
                this._particles.push({
                    x: point.x,
                    y: point.y,
                    vx: vectorPoint.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE,
                    vy: -vectorPoint.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE,
                    age: Math.random() * WIND_VIZ_CONFIG.PARTICLE_LIFESPAN,
                    vectorLat: vectorPoint.lat,
                    vectorLng: vectorPoint.lng
                });
            }
        }
        
        console.log(`✅ Zainicjalizowano ${this._particles.length} cząstek z vector_field`);
    },
    
    _getVectorAtPosition: function(lat, lng) {
        // Znajdź najbliższy punkt w vector_field
        let closest = null;
        let minDist = Infinity;
        
        this._data.vectorField.forEach(v => {
            const dist = Math.sqrt((v.lat - lat)**2 + (v.lng - lng)**2);
            if (dist < minDist) {
                minDist = dist;
                closest = v;
            }
        });
        
        return closest;
    },
    
    _animate: function() {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        
        this._ctx.globalCompositeOperation = 'source-over';
        this._ctx.lineWidth = WIND_VIZ_CONFIG.PARTICLE_LINE_WIDTH;
        
        this._particles.forEach((particle, index) => {
            const oldX = particle.x;
            const oldY = particle.y;
            
            // Aktualizuj pozycję używając prędkości z vector_field
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.age++;
            
            // Konwertuj pozycję na współrzędne geograficzne
            const latLng = this._map.containerPointToLatLng([particle.x, particle.y]);
            
            // Pobierz nowy wektor w tej pozycji
            const newVector = this._getVectorAtPosition(latLng.lat, latLng.lng);
            if (newVector) {
                particle.vx = newVector.vx * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
                particle.vy = -newVector.vy * WIND_VIZ_CONFIG.PARTICLE_SPEED_SCALE;
            }
            
            // Resetuj cząstkę jeśli wyszła poza obszar lub jest za stara
            if (particle.x < 0 || particle.x > this._canvas.width || 
                particle.y < 0 || particle.y > this._canvas.height || 
                particle.age > WIND_VIZ_CONFIG.PARTICLE_LIFESPAN) {
                
                // Zrestartuj z nowego punktu z vector_field
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
            
            // Narysuj ślad cząstki
            const alpha = Math.max(0, 1 - particle.age / WIND_VIZ_CONFIG.PARTICLE_LIFESPAN);
            this._ctx.strokeStyle = WIND_VIZ_CONFIG.PARTICLE_COLOR.replace('0.7', (alpha * 0.7).toString());
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
    
    update: function(min = 0, max = 16) {
        const gradientColors = [];
        for (let i = 0; i <= 100; i += 10) {
            gradientColors.push(getViridisColor(min + (i/100)*(max-min), min, max));
        }
        
        this._container.innerHTML = `
            <div style="background: rgba(30, 35, 45, 0.9); padding: 10px; border-radius: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                <div style="font-weight: bold; margin-bottom: 5px; color: #e0e0e0;">Prędkość wiatru (m/s)</div>
                <div style="display: flex; align-items: center;">
                    <div style="
                        width: 20px; 
                        height: 150px; 
                        background: linear-gradient(to top, ${gradientColors.join(', ')});
                        margin-right: 10px;
                        border: 1px solid #555;">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 150px; color: #e0e0e0;">
                        <span>${max.toFixed(1)}</span>
                        <span>${((max-min)/2 + min).toFixed(1)}</span>
                        <span>${min.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        `;
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
    
    // Przygotuj dane
    const windData = createWindDataAdapter(windSimulationData);
    if (!windData) {
        console.error('❌ Nie udało się przygotować danych');
        return;
    }
    
    // Usuń poprzednie warstwy jeśli istnieją
    if (window.advancedWindLayers) {
        Object.values(window.advancedWindLayers).forEach(layer => {
            if (layer && maps.wind.hasLayer(layer)) {
                maps.wind.removeLayer(layer);
            }
        });
    }
    
    // Utwórz warstwy
    const velocityLayer = new AdvancedVelocityLayer(windData, windData.bounds);
    const streamlineLayer = new StreamlineLayer(windData, windData.bounds);
    const animationLayer = new AdvancedWindAnimationLayer(windData, windData.bounds);
    const legendControl = new AdvancedLegendControl();
    
    // Dodaj do mapy
    velocityLayer.addTo(maps.wind);
    streamlineLayer.addTo(maps.wind);
    animationLayer.addTo(maps.wind);
    legendControl.addTo(maps.wind);
    legendControl.update(windData.minMagnitude, windData.maxMagnitude);
    
    // Dopasuj widok
    maps.wind.fitBounds(windData.bounds);
    
    // Zapisz referencje
    window.advancedWindLayers = {
        velocity: velocityLayer,
        streamline: streamlineLayer,
        animation: animationLayer,
        legend: legendControl
    };
    
    console.log('✅ Wizualizacja wiatru zainicjalizowana');
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
