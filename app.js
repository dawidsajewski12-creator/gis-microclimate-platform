// =================================================================
// === CZĘŚĆ 1: ZMIENNE GLOBALNE, KONFIGURACJA I ŁADOWANIE DANYCH ===
// =================================================================

// --- Zmienne globalne ---
let windSimulationData = null;
let maps = {};
let animationPlaying = false;
let animationInterval = null;
let floodMarkers = [];
let thermalMarkers = [];

// Globalne referencje do zaawansowanych warstw, aby można było je kontrolować
window.advancedLayers = [];
window.advancedLayerControl = null;
window.advancedInfoPanel = null;

// Konfiguracja zaawansowanej wizualizacji wiatru
const WIND_VIZ_CONFIG = {
    PARTICLE_COUNT: 6000,
    PARTICLE_SPEED_SCALE: 0.2,
    PARTICLE_LIFESPAN: 1000,
    PARTICLE_LINE_WIDTH: 1.6,
    PARTICLE_COLOR: "rgba(110, 190, 255, 0.8)",
};

// Przykładowe dane (sampleData) dla portfolio i bloga
const sampleData = {
    weatherData: { temperature: 22.5, humidity: 65, pressure: 1013.2, windSpeed: 12.8, windDirection: 245, location: "Warszawa", description: "Pochmurno" },
    projects: [ { id: 1, title: "Analiza Zagrożenia Powodziowego", type: "Symulacja Powodzi", date: "2024-08-15", location: "Warszawa", description: "Kompleksowa analiza ryzyka powodziowego dla śródmieścia.", image: "https://via.placeholder.com/400x300/1e40af/ffffff?text=Analiza+Powodzi", tags: ["HEC-RAS", "GIS"], category: "flood" }, { id: 2, title: "Optymalizacja Wentylacji Naturalnej", type: "Analiza Wiatru", date: "2024-07-22", location: "Kraków", description: "Symulacja CFD przepływu powietrza wokół biurowca.", image: "https://via.placeholder.com/400x300/059669/ffffff?text=CFD+Analiza", tags: ["CFD", "ANSYS"], category: "wind" }, { id: 3, title: "Mapa Komfortu Termicznego", type: "Komfort Termiczny", date: "2024-06-10", location: "Gdańsk", description: "Ocena bioklimatyczna przestrzeni publicznych.", image: "https://via.placeholder.com/400x300/dc2626/ffffff?text=Komfort+Termiczny", tags: ["UTCI", "PMV"], category: "thermal" } ],
    blogPosts: [ { id: 1, title: "Nowoczesne Metody Modelowania Powodzi", excerpt: "Przegląd najnowszych technik symulacji.", date: "2024-09-05", category: "Hydrologia", readTime: "8 min" }, { id: 2, title: "CFD w Planowaniu Urbanistycznym", excerpt: "Jak symulacje CFD mogą wspomóc projektowanie.", date: "2024-08-28", category: "Aerodynamika", readTime: "12 min" } ]
};

// --- Główna funkcja inicjalizująca ---
/**
 * POPRAWKA: Używamy `async` dla funkcji i `await` dla loadWindSimulationData().
 * To jest kluczowa zmiana, która gwarantuje, że dane zostaną pobrane
 * PRZED próbą inicjalizacji map i innych komponentów, co zapobiega ich "znikaniu".
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Aplikacja startuje. Oczekiwanie na dane...");
        await loadWindSimulationData(); // Czekaj na ukończenie pobierania danych

        console.log("Dane załadowane. Inicjalizacja komponentów interfejsu...");
        initNavigation();
        initWeatherWidget();
        initMaps();
        initControls();
        initPortfolio();
        initBlog();
        initContactForm();
        initThemeToggle();

        console.log('Wszystkie moduły zostały pomyślnie zainicjalizowane.');
    } catch (error) {
        console.error('Krytyczny błąd podczas startu aplikacji:', error);
    }
});

// --- Funkcje ładowania i adaptacji danych ---
async function loadWindSimulationData() {
    const urls = [
        'https://dawidsajewski12-creator.github.io/gis-microclimate-platform/api/data/wind_simulation/current.json',
        'api/data/wind_simulation/current.json',
        'data/wind_simulation_results.json'
    ];
    for (const url of urls) {
        try {
            console.log(`Próbuję załadować dane symulacji z: ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP status: ${response.status}`);
            windSimulationData = await response.json();
            console.log('Dane symulacji wiatru załadowane pomyślnie.', windSimulationData.metadata);
            return windSimulationData;
        } catch (error) {
            console.warn(`Nie udało się załadować danych z ${url}. Próbuję następnego źródła...`);
        }
    }
    console.error('Nie udało się załadować danych symulacji wiatru z żadnego ze źródeł. Zaawansowana wizualizacja nie będzie dostępna.');
    return null;
}

function createWindDataAdapter(rawWindData) {
    if (!rawWindData) return null;
    const hasGeoCoords = rawWindData.vector_field?.[0]?.longitude !== undefined;
    if (!hasGeoCoords) {
        console.error('Błąd adaptera: Dane nie zawierają współrzędnych geograficznych.');
        return null;
    }
    const bounds_wgs84 = rawWindData.spatial_reference?.bounds_wgs84;
    if (!bounds_wgs84) {
        console.error('Błąd adaptera: Brak informacji o granicach (bounds_wgs84) w danych.');
        return null;
    }
    return {
        bounds: L.latLngBounds([bounds_wgs84.south, bounds_wgs84.west], [bounds_wgs84.north, bounds_wgs84.east]),
        magnitudeGrid: rawWindData.magnitude_grid,
        gridWidth: rawWindData.magnitude_grid[0].length,
        gridHeight: rawWindData.magnitude_grid.length,
        minMagnitude: rawWindData.flow_statistics.min_magnitude,
        maxMagnitude: rawWindData.flow_statistics.max_magnitude,
        streamlines: rawWindData.streamlines || [],
        metadata: rawWindData.metadata,
    };
}
// =================================================================
// === CZĘŚĆ 2: ZAAWANSOWANA WIZUALIZACJA WIATRU ===
// =================================================================

function getViridisColor(value, min, max) {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const r = Math.round(255 * (0.267004 + 1.15172 * t - 2.92336 * t**2 + 1.52013 * t**3));
    const g = Math.round(255 * (0.018623 + 2.75701 * t - 4.49472 * t**2 + 1.77533 * t**3));
    const b = Math.round(255 * (0.354456 - 2.11226 * t + 10.5126 * t**2 - 12.3881 * t**3 + 3.63582 * t**4));
    return `rgba(${r},${g},${b},0.7)`;
}

const AdvancedVelocityLayer = L.Layer.extend({
    // Implementacja warstwy siatki prędkości (heatmap)...
    // Kod pozostaje bez zmian, ponieważ jego logika jest poprawna.
});

const AdvancedWindAnimationLayer = L.Layer.extend({
    // Implementacja warstwy animacji i linii przepływu...
    // Kod pozostaje bez zmian, z dodaną logiką rysowania streamlines.
    _draw: function() {
        if (!this._ctx || !this._data.streamlines) return;
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        this._ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
        this._ctx.lineWidth = 1.2;

        this._data.streamlines.forEach(streamline => {
            this._ctx.beginPath();
            let first = true;
            streamline.forEach(point => {
                const screenPoint = this._map.latLngToContainerPoint([point.latitude, point.longitude]);
                if (first) {
                    this._ctx.moveTo(screenPoint.x, screenPoint.y);
                    first = false;
                } else {
                    this._ctx.lineTo(screenPoint.x, screenPoint.y);
                }
            });
            this._ctx.stroke();
        });
    }
});

const AdvancedLegendControl = L.Control.extend({
    // Implementacja legendy...
    // Kod pozostaje bez zmian.
});

async function initAdvancedWindVisualization() {
    if (!maps.wind || !windSimulationData) return;

    console.log("Inicjalizacja zaawansowanej wizualizacji wiatru...");

    const adaptedData = createWindDataAdapter(windSimulationData);
    if (!adaptedData) return;

    // POPRAWKA: Precyzyjnie usuwamy tylko te warstwy, które sami dodaliśmy.
    window.advancedLayers.forEach(layer => maps.wind.hasLayer(layer) && maps.wind.removeLayer(layer));
    window.advancedLayers = [];

    if (window.advancedLayerControl) {
        maps.wind.removeControl(window.advancedLayerControl);
        window.advancedLayerControl = null;
    }
    if (window.advancedInfoPanel) {
        maps.wind.removeControl(window.advancedInfoPanel);
        window.advancedInfoPanel = null;
    }
    
    // Usuwamy też stare, podstawowe warstwy, aby uniknąć nakładania
    maps.wind.eachLayer(layer => {
        if (layer.options.pane === 'markerPane' || layer instanceof L.CircleMarker || layer instanceof L.HeatLayer) {
             maps.wind.removeLayer(layer);
        }
    });

    addAdvancedWindCSS();

    let buildingsLayer = null;
    try {
        const response = await fetch('https://dawidsajewski12-creator.github.io/gis-microclimate-platform/api/data/wind_simulation/buildings.geojson');
        if (response.ok) {
            const geojson = await response.json();
            buildingsLayer = L.geoJSON(geojson, {
                style: { color: '#663300', weight: 1.5, opacity: 0.7, fillColor: '#8B4513', fillOpacity: 0.4 },
                onEachFeature: (f, l) => l.bindPopup(`<b>Budynek</b>`)
            }).addTo(maps.wind);
        }
    } catch (e) {
        console.warn('Nie udało się załadować warstwy budynków:', e);
    }
    
    const velocityLayer = new AdvancedVelocityLayer(adaptedData, adaptedData.bounds);
    const windAnimLayer = new AdvancedWindAnimationLayer(adaptedData, adaptedData.bounds);
    const legend = new AdvancedLegendControl();

    velocityLayer.addTo(maps.wind);
    windAnimLayer.addTo(maps.wind);
    legend.addTo(maps.wind);
    legend.update(adaptedData.minMagnitude, adaptedData.maxMagnitude);

    // Zapisujemy referencje do nowo utworzonych warstw
    window.advancedLayers.push(velocityLayer, windAnimLayer, legend);
    if (buildingsLayer) window.advancedLayers.push(buildingsLayer);

    window.advancedLayerControl = L.control.layers(null, {
        'Pola prędkości': velocityLayer,
        'Linie przepływu': windAnimLayer,
        ...(buildingsLayer && { 'Budynki': buildingsLayer })
    }, { collapsed: false }).addTo(maps.wind);
    
    maps.wind.fitBounds(adaptedData.bounds, { padding: [20, 20] });
    addAdvancedInfoPanel(adaptedData);
}

function addAdvancedInfoPanel(data) { /* Implementacja bez zmian */ }
function addAdvancedWindCSS() { /* Implementacja bez zmian */ }

// =================================================================
// === CZĘŚĆ 3: PODSTAWOWE FUNKCJE UI I INICJALIZACJA MAP ===
// =================================================================

function initNavigation() { /* Twoja implementacja bez zmian */ }
function initWeatherWidget() { /* Twoja implementacja bez zmian */ }
function initControls() { /* Twoja implementacja bez zmian */ }
function initContactForm() { /* Twoja implementacja bez zmian */ }
function initThemeToggle() { /* Twoja implementacja bez zmian */ }

function initMaps() {
    console.log("Inicjalizacja map...");
    initMainMap();
    initFloodMap();
    initWindMap();
    initThermalMap();
    initContactMap();
}

function initMainMap() {
    if (document.getElementById('main-map') && !maps.main) {
        maps.main = L.map('main-map').setView([52.2297, 21.0122], 11);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(maps.main);
    }
}
function initFloodMap() {
    if (document.getElementById('flood-map') && !maps.flood) {
        maps.flood = L.map('flood-map').setView([52.2297, 21.0122], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(maps.flood);
        // ...logika dla mapy powodzi
    }
}
function initWindMap() {
    if (document.getElementById('wind-map') && !maps.wind) {
        maps.wind = L.map('wind-map').setView([52.2297, 21.0122], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(maps.wind);
        // POPRAWKA: Jeśli dane zaawansowane są dostępne, użyj nowej wizualizacji.
        if (windSimulationData) {
            initAdvancedWindVisualization();
        } else {
            console.warn("Brak danych do zaawansowanej wizualizacji. Uruchamiam tryb awaryjny (jeśli istnieje).");
            // updateWindVisualization(); // Twoja stara, podstawowa funkcja
        }
    }
}
function initThermalMap() {
    if (document.getElementById('thermal-map') && !maps.thermal) {
        maps.thermal = L.map('thermal-map').setView([52.2297, 21.0122], 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(maps.thermal);
        // ...logika dla mapy komfortu
    }
}
function initContactMap() {
    if (document.getElementById('contact-map') && !maps.contact) {
        maps.contact = L.map('contact-map').setView([52.2297, 21.0122], 15);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(maps.contact);
        L.marker([52.2297, 21.0122]).bindPopup("Biuro").addTo(maps.contact);
    }
}

function initPortfolio() {
    const portfolioGrid = document.getElementById('portfolio-grid');
    if (!portfolioGrid) return;
    if (!sampleData || !sampleData.projects) {
        console.error("Brak danych `sampleData.projects` do wyświetlenia portfolio.");
        return;
    }
    // ... reszta Twojej implementacji bez zmian
    renderPortfolio();
    initPortfolioFilters();
}
function renderPortfolio() { /* Twoja implementacja bez zmian */ }
function initPortfolioFilters() { /* Twoja implementacja bez zmian */ }

function initBlog() {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid) return;
    if (!sampleData || !sampleData.blogPosts) {
        console.error("Brak danych `sampleData.blogPosts` do wyświetlenia bloga.");
        return;
    }
    // ... reszta Twojej implementacji bez zmian
}

console.log("Plik app.js został w pełni załadowany.");

