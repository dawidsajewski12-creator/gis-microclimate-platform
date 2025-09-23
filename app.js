// Sample data from provided JSON 
// === PODSTAWOWE FUNKCJE ŁADOWANIA DANYCH ===

let windSimulationData = null;

async function loadWindSimulationData() {
    const urls = [
        'https://dawidsajewski12-creator.github.io/gis-microclimate-platform/api/data/wind_simulation/current.json',
        'api/data/wind_simulation/current.json',
        'data/wind_simulation_results.json'
    ];

    for (const url of urls) {
        try {
            console.log(`🔄 Próbuję załadować dane z: ${url}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            windSimulationData = await response.json();
            console.log('✅ Dane symulacji wiatru załadowane:', windSimulationData.metadata);
            
            // Walidacja danych
            if (!windSimulationData.spatial_reference) {
                console.warn('⚠️ Brak informacji spatial_reference w danych!');
            } else {
                console.log('📍 CRS danych:', windSimulationData.spatial_reference.crs);
                console.log('🌍 Bounds WGS84:', windSimulationData.spatial_reference.bounds_wgs84);
            }
            
            // Po załadowaniu danych, inicjalizuj zaawansowaną wizualizację
            setTimeout(() => {
                if (maps.wind) {
                    addAdvancedWindCSS();
                    initAdvancedWindVisualization();
                }
            }, 500);
            
            return windSimulationData;
        } catch (error) {
            console.warn(`❌ Nie udało się załadować z ${url}: ${error.message}`);
            continue;
        }
    }
    
    console.error('💥 Nie udało się załadować danych z żadnego źródła');
    return null;
}

// Sample data structure for fallback
const sampleData = {
    weatherData: {
        location: "Warszawa",
        temperature: 22,
        humidity: 65,
        pressure: 1015,
        windSpeed: 12
    },
    floodData: {
        scenarios: [
            {
                name: "Scenario 1 - Moderate Rain",
                coordinates: [
                    {lat: 52.2297, lng: 21.0122, depth: 0.5, time: 30},
                    {lat: 52.2305, lng: 21.0135, depth: 0.8, time: 45},
                    {lat: 52.2312, lng: 21.0118, depth: 1.2, time: 60}
                ]
            },
            {
                name: "Scenario 2 - Heavy Rain",
                coordinates: [
                    {lat: 52.2297, lng: 21.0122, depth: 1.0, time: 15},
                    {lat: 52.2305, lng: 21.0135, depth: 1.5, time: 30},
                    {lat: 52.2312, lng: 21.0118, depth: 2.0, time: 45}
                ]
            }
        ]
    },
    windData: {
        scenarios: [
            {name: "Normal Wind", windSpeed: 5, direction: 180},
            {name: "Strong Wind", windSpeed: 15, direction: 270}
        ]
    },
    thermalData: {
        scenarios: [
            {name: "Summer Day", temperature: 28, comfort: "Hot"},
            {name: "Winter Day", temperature: -5, comfort: "Cold"}
        ]
    },
    portfolioData: {
        projects: [
            {
                id: 1,
                title: "Analiza mikroklimatu obszarów zurbanizowanych",
                category: "microclimate",
                image: "https://via.placeholder.com/400x300/4f46e5/ffffff?text=Mikroklimat",
                description: "Kompleksowa analiza warunków mikroklimatycznych w centrum miasta z wykorzystaniem zaawansowanych modeli CFD.",
                technologies: ["Python", "OpenFOAM", "QGIS", "PostGIS"],
                results: "Wzrost dokładności prognoz o 35%, identyfikacja 12 stref krytycznych."
            },
            {
                id: 2,
                title: "System prognozowania zagrożeń powodziowych",
                category: "flood",
                image: "https://via.placeholder.com/400x300/059669/ffffff?text=Powódź",
                description: "Zaawansowany system wczesnego ostrzegania przed powodziami wykorzystujący uczenie maszynowe.",
                technologies: ["TensorFlow", "Django", "PostgreSQL", "Docker"],
                results: "Redukcja fałszywych alarmów o 60%, zwiększenie czasu ostrzeżenia o 4 godziny."
            },
            {
                id: 3,
                title: "Optymalizacja przepływu wiatru w zespołach budynków",
                category: "wind",
                image: "https://via.placeholder.com/400x300/dc2626/ffffff?text=Wiatr",
                description: "Symulacja i optymalizacja przepływów powietrza wokół nowych inwestycji deweloperskich.",
                technologies: ["ANSYS Fluent", "Rhino", "Grasshopper", "Python"],
                results: "Poprawa komfortu wiatrowego o 45%, redukcja kosztów klimatyzacji o 20%."
            }
        ]
    },
    blogData: {
        posts: [
            {
                id: 1,
                title: "Wprowadzenie do symulacji CFD w urbanistyce",
                excerpt: "Podstawowe zagadnienia związane z wykorzystaniem dynamiki płynów obliczeniowej w planowaniu miast.",
                date: "2024-03-15",
                category: "CFD",
                readTime: 8,
                tags: ["CFD", "urbanistyka", "symulacje"]
            },
            {
                id: 2,
                title: "Analiza wysp ciepła w dużych aglomeracjach",
                excerpt: "Metodologia badania i przeciwdziałania zjawisku miejskich wysp ciepła z wykorzystaniem danych satelitarnych.",
                date: "2024-03-10",
                category: "Klimat",
                readTime: 6,
                tags: ["wyspa ciepła", "satelity", "temperatura"]
            },
            {
                id: 3,
                title: "Nowoczesne podejścia do modelowania powodzi miejskich",
                excerpt: "Przegląd najnowszych technik numerycznego modelowania przepływów w środowisku zurbanizowanym.",
                date: "2024-03-05",
                category: "Hydrologia",
                readTime: 10,
                tags: ["powodzie", "modelowanie", "miasto"]
            }
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
let windLayers = {};
let particleAnimationLayer = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Załaduj dane symulacji wiatru na początku
    loadWindSimulationData();
    
    initNavigation();
    initWeatherWidget();
    
    // Inicjalizacja map z opóźnieniem dla pewności załadowania DOM
    setTimeout(() => {
        initMaps();
    }, 100);
    
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
    if (navToggle && navMenu) {
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
                const header = document.getElementById('header');
                const headerHeight = header ? header.offsetHeight : 60;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                if (navMenu) {
                    navMenu.classList.remove('active');
                }
            }
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
                const header = document.getElementById('header');
                const headerHeight = header ? header.offsetHeight : 60;
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
        if (header) {
            if (window.scrollY > 100) {
                header.style.background = 'rgba(15, 23, 42, 0.95)';
            } else {
                header.style.background = 'rgba(15, 23, 42, 0.9)';
            }
        }
    });
}

// Theme toggle
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    if (themeToggle) {
        const themeIcon = themeToggle.querySelector('i');
        
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            
            if (themeIcon) {
                if (document.body.classList.contains('light-theme')) {
                    themeIcon.className = 'fas fa-sun';
                } else {
                    themeIcon.className = 'fas fa-moon';
                }
            }
        });
    }
}

// Weather widget
function initWeatherWidget() {
    const weatherData = sampleData.weatherData;
    
    const locationEl = document.getElementById('weather-location');
    const tempEl = document.getElementById('temperature');
    const humidityEl = document.getElementById('humidity');
    const pressureEl = document.getElementById('pressure');
    const windSpeedEl = document.getElementById('wind-speed');
    
    if (locationEl) locationEl.textContent = weatherData.location;
    if (tempEl) tempEl.textContent = `${weatherData.temperature}°C`;
    if (humidityEl) humidityEl.textContent = `${weatherData.humidity}%`;
    if (pressureEl) pressureEl.textContent = `${weatherData.pressure} hPa`;
    if (windSpeedEl) windSpeedEl.textContent = `${weatherData.windSpeed} km/h`;
}

// Map initialization
function initMaps() {
    console.log('🗺️ Inicjalizuję mapy...');
    
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
    
    console.log('✅ Mapy zainicjalizowane:', Object.keys(maps));
}

function initMainMap() {
    const mapContainer = document.getElementById('main-map');
    if (!mapContainer) {
        console.warn('⚠️ Nie znaleziono kontenera main-map');
        return;
    }

    try {
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
        
        console.log('✅ Main map initialized');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji main map:', error);
    }
}

function initFloodMap() {
    const mapContainer = document.getElementById('flood-map');
    if (!mapContainer) {
        console.warn('⚠️ Nie znaleziono kontenera flood-map');
        return;
    }

    try {
        maps.flood = L.map('flood-map').setView([52.2297, 21.0122], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(maps.flood);

        setTimeout(() => {
            updateFloodVisualization();
        }, 500);
        
        console.log('✅ Flood map initialized');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji flood map:', error);
    }
}

function initWindMap() {
    const mapContainer = document.getElementById('wind-map');
    if (!mapContainer) {
        console.warn('⚠️ Nie znaleziono kontenera wind-map');
        return;
    }

    try {
        maps.wind = L.map('wind-map').setView([52.2297, 21.0122], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(maps.wind);

        setTimeout(() => {
            updateWindVisualization();
        }, 500);
        
        console.log('✅ Wind map initialized');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji wind map:', error);
    }
}

function initThermalMap() {
    const mapContainer = document.getElementById('thermal-map');
    if (!mapContainer) {
        console.warn('⚠️ Nie znaleziono kontenera thermal-map');
        return;
    }

    try {
        maps.thermal = L.map('thermal-map').setView([52.2297, 21.0122], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(maps.thermal);

        setTimeout(() => {
            updateThermalVisualization();
        }, 500);
        
        console.log('✅ Thermal map initialized');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji thermal map:', error);
    }
}

function initContactMap() {
    const mapContainer = document.getElementById('contact-map');
    if (!mapContainer) {
        console.warn('⚠️ Nie znaleziono kontenera contact-map');
        return;
    }

    try {
        maps.contact = L.map('contact-map').setView([52.2297, 21.0122], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(maps.contact);

        L.marker([52.2297, 21.0122])
            .bindPopup('<strong>Biuro</strong><br>ul. Naukowa 15/20<br>00-001 Warszawa')
            .addTo(maps.contact);
            
        console.log('✅ Contact map initialized');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji contact map:', error);
    }
}
// Controls initialization
function initControls() {
    // Flood scenario selector
    const floodScenario = document.getElementById('flood-scenario');
    if (floodScenario) {
        floodScenario.addEventListener('change', (e) => {
            console.log('Zmiana scenariusza powodzi:', e.target.value);
            updateFloodVisualization(e.target.value);
        });
    }

    // Wind scenario selector
    const windScenario = document.getElementById('wind-scenario');
    if (windScenario) {
        windScenario.addEventListener('change', (e) => {
            console.log('Zmiana scenariusza wiatru:', e.target.value);
            updateWindVisualization(e.target.value);
        });
    }

    // Thermal scenario selector
    const thermalScenario = document.getElementById('thermal-scenario');
    if (thermalScenario) {
        thermalScenario.addEventListener('change', (e) => {
            console.log('Zmiana scenariusza termicznego:', e.target.value);
            updateThermalVisualization(e.target.value);
        });
    }

    // Animation controls
    const animationToggle = document.getElementById('animation-toggle');
    if (animationToggle) {
        animationToggle.addEventListener('click', toggleAnimation);
    }

    const animationSpeed = document.getElementById('animation-speed');
    if (animationSpeed) {
        animationSpeed.addEventListener('input', (e) => {
            updateAnimationSpeed(e.target.value);
        });
    }

    // Tab controls
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-content`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Refresh map when tab becomes active
                setTimeout(() => {
                    if (maps[targetTab]) {
                        maps[targetTab].invalidateSize();
                    }
                }, 100);
            }
        });
    });
}

// Visualization update functions
function updateFloodVisualization(scenarioId = '0') {
    if (!maps.flood) {
        console.warn('⚠️ Mapa powodzi nie jest zainicjalizowana');
        return;
    }

    // Clear existing markers
    floodMarkers.forEach(marker => maps.flood.removeLayer(marker));
    floodMarkers = [];

    const scenario = sampleData.floodData.scenarios[parseInt(scenarioId)];
    if (!scenario) {
        console.warn('⚠️ Nie znaleziono scenariusza powodzi:', scenarioId);
        return;
    }

    scenario.coordinates.forEach(point => {
        const color = point.depth > 1.0 ? '#dc2626' : point.depth > 0.5 ? '#f59e0b' : '#3b82f6';
        
        const marker = L.circleMarker([point.lat, point.lng], {
            radius: Math.min(point.depth * 10, 20),
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            weight: 2
        }).bindPopup(`
            <strong>Zagrożenie powodziowe</strong><br>
            Głębokość: ${point.depth}m<br>
            Czas dotarcia: ${point.time} min
        `);

        marker.addTo(maps.flood);
        floodMarkers.push(marker);
    });

    console.log(`✅ Zaktualizowano wizualizację powodzi dla scenariusza: ${scenario.name}`);
}

function updateWindVisualization(scenarioId = '0') {
    if (!maps.wind) {
        console.warn('⚠️ Mapa wiatru nie jest zainicjalizowana');
        return;
    }

    const scenario = sampleData.windData.scenarios[parseInt(scenarioId)];
    if (!scenario) {
        console.warn('⚠️ Nie znaleziono scenariusza wiatru:', scenarioId);
        return;
    }

    // Clear existing visualization
    Object.values(windLayers).forEach(layer => {
        maps.wind.removeLayer(layer);
    });
    windLayers = {};

    // Add wind arrows based on scenario
    const gridSize = 0.002;
    const centerLat = 52.2297;
    const centerLng = 21.0122;

    for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
            const lat = centerLat + i * gridSize;
            const lng = centerLng + j * gridSize;
            
            const windArrow = createWindArrow([lat, lng], scenario.windSpeed, scenario.direction);
            windArrow.addTo(maps.wind);
            windLayers[`arrow_${i}_${j}`] = windArrow;
        }
    }

    // Add wind particles if data loaded
    if (windSimulationData) {
        addWindParticles();
    }

    console.log(`✅ Zaktualizowano wizualizację wiatru dla scenariusza: ${scenario.name}`);
}

function createWindArrow(position, speed, direction) {
    const arrowIcon = L.divIcon({
        html: `<div class="wind-arrow" style="transform: rotate(${direction}deg); opacity: ${Math.min(speed / 20, 1)}">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
                   </svg>
               </div>`,
        className: 'wind-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return L.marker(position, { icon: arrowIcon })
        .bindPopup(`Prędkość wiatru: ${speed} m/s<br>Kierunek: ${direction}°`);
}

function updateThermalVisualization(scenarioId = '0') {
    if (!maps.thermal) {
        console.warn('⚠️ Mapa komfortu termicznego nie jest zainicjalizowana');
        return;
    }

    // Clear existing markers
    thermalMarkers.forEach(marker => maps.thermal.removeLayer(marker));
    thermalMarkers = [];

    const scenario = sampleData.thermalData.scenarios[parseInt(scenarioId)];
    if (!scenario) {
        console.warn('⚠️ Nie znaleziono scenariusza termicznego:', scenarioId);
        return;
    }

    // Create thermal comfort zones
    const zones = [
        { lat: 52.2297, lng: 21.0122, temp: scenario.temperature, comfort: scenario.comfort },
        { lat: 52.2305, lng: 21.0135, temp: scenario.temperature + 2, comfort: getComfortLevel(scenario.temperature + 2) },
        { lat: 52.2290, lng: 21.0108, temp: scenario.temperature - 1, comfort: getComfortLevel(scenario.temperature - 1) },
        { lat: 52.2310, lng: 21.0140, temp: scenario.temperature + 1, comfort: getComfortLevel(scenario.temperature + 1) }
    ];

    zones.forEach(zone => {
        const color = getThermalColor(zone.temp);
        
        const marker = L.circleMarker([zone.lat, zone.lng], {
            radius: 15,
            color: color,
            fillColor: color,
            fillOpacity: 0.7,
            weight: 3
        }).bindPopup(`
            <strong>Komfort termiczny</strong><br>
            Temperatura: ${zone.temp}°C<br>
            Komfort: ${zone.comfort}
        `);

        marker.addTo(maps.thermal);
        thermalMarkers.push(marker);
    });

    console.log(`✅ Zaktualizowano wizualizację komfortu termicznego dla scenariusza: ${scenario.name}`);
}

function getComfortLevel(temperature) {
    if (temperature < 10) return "Zimno";
    if (temperature < 20) return "Chłodno";
    if (temperature < 26) return "Komfortowo";
    if (temperature < 30) return "Ciepło";
    return "Gorąco";
}

function getThermalColor(temperature) {
    if (temperature < 10) return '#1e3a8a';
    if (temperature < 20) return '#3b82f6';
    if (temperature < 26) return '#10b981';
    if (temperature < 30) return '#f59e0b';
    return '#dc2626';
}

// Animation functions
function toggleAnimation() {
    animationPlaying = !animationPlaying;
    
    const toggleButton = document.getElementById('animation-toggle');
    if (toggleButton) {
        toggleButton.textContent = animationPlaying ? 'Stop Animation' : 'Start Animation';
    }

    if (animationPlaying) {
        startAnimation();
    } else {
        stopAnimation();
    }
}

function startAnimation() {
    if (!animationInterval) {
        animationInterval = setInterval(() => {
            updateParticles();
            animateWindFlow();
        }, 100);
    }
}

function stopAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
}

function updateAnimationSpeed(speed) {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = setInterval(() => {
            updateParticles();
            animateWindFlow();
        }, 200 - speed * 10);
    }
}
// Portfolio functions
function initPortfolio() {
    console.log('🎨 Inicjalizuję portfolio...');
    
    const portfolioContainer = document.getElementById('portfolio-items');
    if (!portfolioContainer) {
        console.warn('⚠️ Nie znaleziono kontenera portfolio');
        return;
    }

    const portfolioData = sampleData.portfolioData;
    
    portfolioData.projects.forEach(project => {
        const projectElement = createProjectElement(project);
        portfolioContainer.appendChild(projectElement);
    });

    // Portfolio filters
    initPortfolioFilters();
    
    console.log('✅ Portfolio zainicjalizowane');
}

function createProjectElement(project) {
    const projectDiv = document.createElement('div');
    projectDiv.className = `portfolio-item ${project.category}`;
    projectDiv.innerHTML = `
        <div class="portfolio-card">
            <div class="portfolio-image">
                <img src="${project.image}" alt="${project.title}" loading="lazy">
                <div class="portfolio-overlay">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <div class="project-tech">
                        ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="portfolio-content">
                <div class="project-results">
                    <strong>Rezultaty:</strong> ${project.results}
                </div>
                <button class="btn-secondary portfolio-details" data-project-id="${project.id}">
                    Zobacz szczegóły
                </button>
            </div>
        </div>
    `;
    
    // Add click handler for details
    const detailsBtn = projectDiv.querySelector('.portfolio-details');
    detailsBtn.addEventListener('click', () => showProjectDetails(project));
    
    return projectDiv;
}

function initPortfolioFilters() {
    const filterButtons = document.querySelectorAll('.portfolio-filter');
    const portfolioItems = document.querySelectorAll('.portfolio-item');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter;
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter items
            portfolioItems.forEach(item => {
                if (filter === 'all' || item.classList.contains(filter)) {
                    item.style.display = 'block';
                    item.style.animation = 'fadeInUp 0.5s ease-out';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

function showProjectDetails(project) {
    // Create modal with project details
    const modal = document.createElement('div');
    modal.className = 'project-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${project.title}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <img src="${project.image}" alt="${project.title}" class="modal-image">
                <div class="modal-details">
                    <h3>Opis projektu</h3>
                    <p>${project.description}</p>
                    
                    <h3>Technologie</h3>
                    <div class="tech-list">
                        ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                    </div>
                    
                    <h3>Osiągnięte rezultaty</h3>
                    <p>${project.results}</p>
                    
                    <div class="modal-actions">
                        <a href="#contact" class="btn-primary">Skontaktuj się</a>
                        <button class="btn-secondary modal-close">Zamknij</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Blog functions
function initBlog() {
    console.log('📝 Inicjalizuję blog...');
    
    const blogContainer = document.getElementById('blog-posts');
    if (!blogContainer) {
        console.warn('⚠️ Nie znaleziono kontenera blog-posts');
        return;
    }

    const blogData = sampleData.blogData;
    
    blogData.posts.forEach(post => {
        const postElement = createBlogPostElement(post);
        blogContainer.appendChild(postElement);
    });
    
    console.log('✅ Blog zainicjalizowany');
}

function createBlogPostElement(post) {
    const postDiv = document.createElement('article');
    postDiv.className = 'blog-post';
    postDiv.innerHTML = `
        <div class="blog-card">
            <div class="blog-header">
                <div class="blog-meta">
                    <span class="blog-date">${formatDate(post.date)}</span>
                    <span class="blog-category">${post.category}</span>
                    <span class="blog-time">${post.readTime} min czytania</span>
                </div>
            </div>
            <div class="blog-content">
                <h3 class="blog-title">
                    <a href="#blog-post-${post.id}" class="blog-link">${post.title}</a>
                </h3>
                <p class="blog-excerpt">${post.excerpt}</p>
                <div class="blog-tags">
                    ${post.tags.map(tag => `<span class="blog-tag">#${tag}</span>`).join('')}
                </div>
                <div class="blog-actions">
                    <a href="#blog-post-${post.id}" class="read-more">Czytaj więcej</a>
                    <div class="blog-social">
                        <button class="social-share" data-platform="twitter" data-post-id="${post.id}">
                            <i class="fab fa-twitter"></i>
                        </button>
                        <button class="social-share" data-platform="linkedin" data-post-id="${post.id}">
                            <i class="fab fa-linkedin"></i>
                        </button>
                        <button class="social-share" data-platform="facebook" data-post-id="${post.id}">
                            <i class="fab fa-facebook"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add click handlers
    const readMoreLink = postDiv.querySelector('.read-more');
    const titleLink = postDiv.querySelector('.blog-link');
    
    [readMoreLink, titleLink].forEach(link => {
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showBlogPost(post);
            });
        }
    });
    
    // Social share handlers
    const socialButtons = postDiv.querySelectorAll('.social-share');
    socialButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = button.dataset.platform;
            sharePost(post, platform);
        });
    });
    
    return postDiv;
}

function showBlogPost(post) {
    // Create full blog post modal/page
    const modal = document.createElement('div');
    modal.className = 'blog-modal';
    modal.innerHTML = `
        <div class="blog-modal-content">
            <div class="blog-modal-header">
                <button class="blog-modal-close">&times;</button>
                <div class="blog-modal-meta">
                    <h1>${post.title}</h1>
                    <div class="blog-modal-info">
                        <span class="modal-date">${formatDate(post.date)}</span>
                        <span class="modal-category">${post.category}</span>
                        <span class="modal-time">${post.readTime} min czytania</span>
                    </div>
                    <div class="modal-tags">
                        ${post.tags.map(tag => `<span class="modal-tag">#${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="blog-modal-body">
                <div class="blog-full-content">
                    <p class="blog-lead">${post.excerpt}</p>
                    
                    <h2>Wprowadzenie</h2>
                    <p>To jest przykładowa treść artykułu. W rzeczywistej aplikacji tutaj byłby pełny tekst artykułu załadowany z bazy danych lub pliku markdown.</p>
                    
                    <h2>Główne zagadnienia</h2>
                    <p>Szczegółowe omówienie tematu z przykładami i ilustracjami.</p>
                    
                    <h2>Podsumowanie</h2>
                    <p>Kluczowe wnioski i dalsze kierunki rozwoju.</p>
                    
                    <div class="blog-author">
                        <h3>O autorze</h3>
                        <p>Specjalista ds. analiz mikroklimatycznych i symulacji środowiskowych.</p>
                    </div>
                    
                    <div class="blog-comments">
                        <h3>Komentarze</h3>
                        <div class="comment-form">
                            <textarea placeholder="Dodaj komentarz..." rows="4"></textarea>
                            <button class="btn-primary">Dodaj komentarz</button>
                        </div>
                        <div class="comments-list">
                            <div class="comment">
                                <strong>Anna K.</strong>
                                <span class="comment-date">2 dni temu</span>
                                <p>Bardzo ciekawy artykuł! Czy są jakieś rekomendacje dotyczące implementacji?</p>
                            </div>
                            <div class="comment">
                                <strong>Marcin P.</strong>
                                <span class="comment-date">1 dzień temu</span>
                                <p>Świetne wyjaśnienie złożonych zagadnień. Dzięki za praktyczne przykłady!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Close modal handler
    const closeButton = modal.querySelector('.blog-modal-close');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.body.style.overflow = '';
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.body.style.overflow = '';
        }
    });
    
    // Prevent modal content click from closing
    const modalContent = modal.querySelector('.blog-modal-content');
    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function sharePost(post, platform) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post.title);
    const text = encodeURIComponent(post.excerpt);
    
    let shareUrl = '';
    
    switch(platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
    }
    
    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
// Contact form
function initContactForm() {
    console.log('📧 Inicjalizuję formularz kontaktowy...');
    
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        console.warn('⚠️ Nie znaleziono formularza kontaktowego');
        return;
    }

    contactForm.addEventListener('submit', handleContactSubmit);
    
    // Real-time validation
    const formInputs = contactForm.querySelectorAll('input, textarea');
    formInputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
    
    console.log('✅ Formularz kontaktowy zainicjalizowany');
}

function handleContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Validate form
    if (!validateContactForm(form)) {
        return;
    }
    
    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Wysyłanie...';
    submitButton.disabled = true;
    
    // Simulate form submission
    setTimeout(() => {
        showContactSuccess();
        form.reset();
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }, 2000);
}

function validateContactForm(form) {
    let isValid = true;
    const fields = form.querySelectorAll('input, textarea');
    
    fields.forEach(field => {
        if (!validateField({ target: field })) {
            isValid = false;
        }
    });
    
    return isValid;
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    const fieldType = field.type;
    const fieldName = field.name;
    
    let isValid = true;
    let errorMessage = '';
    
    // Remove existing error
    clearFieldError({ target: field });
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'To pole jest wymagane';
    }
    
    // Email validation
    else if (fieldType === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Nieprawidłowy format email';
        }
    }
    
    // Phone validation
    else if (fieldName === 'phone' && value) {
        const phoneRegex = /^[+]?[\d\s\-\(\)]{9,15}$/;
        if (!phoneRegex.test(value)) {
            isValid = false;
            errorMessage = 'Nieprawidłowy numer telefonu';
        }
    }
    
    // Message length validation
    else if (fieldName === 'message' && value && value.length < 10) {
        isValid = false;
        errorMessage = 'Wiadomość musi mieć co najmniej 10 znaków';
    }
    
    if (!isValid) {
        showFieldError(field, errorMessage);
    }
    
    return isValid;
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorElement = document.createElement('span');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    field.parentNode.appendChild(errorElement);
}

function clearFieldError(e) {
    const field = e.target;
    field.classList.remove('error');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
}

function showContactSuccess() {
    // Create success modal
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="success-content">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2>Wiadomość wysłana!</h2>
            <p>Dziękujemy za kontakt. Odpowiemy w ciągu 24 godzin.</p>
            <button class="btn-primary success-close">OK</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handler
    const closeButton = modal.querySelector('.success-close');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Auto close after 3 seconds
    setTimeout(() => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    }, 3000);
}

// Particle system
function initParticleSystem() {
    console.log('✨ Inicjalizuję system cząstek...');
    
    const hero = document.getElementById('hero');
    if (!hero) {
        console.warn('⚠️ Nie znaleziono sekcji hero');
        return;
    }

    // Create canvas for particles
    const canvas = document.createElement('canvas');
    canvas.className = 'particles-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    hero.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // Initialize particles
    particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push(createParticle(canvas.width, canvas.height));
    }

    // Animation loop
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach((particle, index) => {
            updateParticle(particle, canvas.width, canvas.height);
            drawParticle(ctx, particle);
        });
        
        requestAnimationFrame(animateParticles);
    }
    
    animateParticles();

    // Handle window resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Reinitialize particles
        particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push(createParticle(canvas.width, canvas.height));
        }
    });
    
    console.log('✅ System cząstek zainicjalizowany');
}

function createParticle(canvasWidth, canvasHeight) {
    return {
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        color: `hsla(${Math.random() * 60 + 200}, 70%, 60%, ${Math.random() * 0.5 + 0.2})`
    };
}

function updateParticle(particle, canvasWidth, canvasHeight) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    
    // Bounce off edges
    if (particle.x <= 0 || particle.x >= canvasWidth) {
        particle.vx *= -1;
    }
    if (particle.y <= 0 || particle.y >= canvasHeight) {
        particle.vy *= -1;
    }
    
    // Keep within bounds
    particle.x = Math.max(0, Math.min(canvasWidth, particle.x));
    particle.y = Math.max(0, Math.min(canvasHeight, particle.y));
}

function drawParticle(ctx, particle) {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particle.color;
    ctx.fill();
}

function updateParticles() {
    // Update particle positions for wind animation
    particles.forEach(particle => {
        updateParticle(particle, window.innerWidth, window.innerHeight);
    });
}

// Advanced wind visualization functions
function addAdvancedWindCSS() {
    if (document.getElementById('advanced-wind-css')) return;
    
    const style = document.createElement('style');
    style.id = 'advanced-wind-css';
    style.textContent = `
        .wind-streamline {
            stroke: #3b82f6;
            stroke-width: 2;
            fill: none;
            opacity: 0.7;
            animation: windFlow 3s ease-in-out infinite;
        }
        
        .wind-vector {
            fill: #1d4ed8;
            stroke: #1e40af;
            stroke-width: 1;
        }
        
        .wind-particle {
            fill: #60a5fa;
            opacity: 0.8;
            animation: particleMove 2s linear infinite;
        }
        
        @keyframes windFlow {
            0%, 100% { stroke-dashoffset: 0; }
            50% { stroke-dashoffset: 10; }
        }
        
        @keyframes particleMove {
            0% { transform: translateX(0) translateY(0); opacity: 1; }
            100% { transform: translateX(20px) translateY(-5px); opacity: 0; }
        }
        
        .wind-legend {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            padding: 10px;
            font-size: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .wind-speed-low { stroke: #10b981; }
        .wind-speed-medium { stroke: #f59e0b; }
        .wind-speed-high { stroke: #ef4444; }
    `;
    document.head.appendChild(style);
}

function initAdvancedWindVisualization() {
    if (!windSimulationData || !maps.wind) {
        console.warn('⚠️ Brak danych wiatru lub mapy');
        return;
    }
    
    console.log('🌪️ Inicjalizuję zaawansowaną wizualizację wiatru...');
    
    try {
        // Add wind legend
        addWindLegend();
        
        // Add streamlines if data available
        if (windSimulationData.streamlines) {
            addWindStreamlines();
        }
        
        // Add vector field
        if (windSimulationData.vector_field) {
            addWindVectorField();
        }
        
        // Add measurement points
        if (windSimulationData.measurement_points) {
            addWindMeasurementPoints();
        }
        
        console.log('✅ Zaawansowana wizualizacja wiatru zainicjalizowana');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji wizualizacji wiatru:', error);
    }
}

function addWindLegend() {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'wind-legend');
        div.innerHTML = `
            <h4>Prędkość wiatru</h4>
            <div><span style="color: #10b981;">●</span> Niska (0-5 m/s)</div>
            <div><span style="color: #f59e0b;">●</span> Średnia (5-10 m/s)</div>
            <div><span style="color: #ef4444;">●</span> Wysoka (>10 m/s)</div>
        `;
        return div;
    };
    
    legend.addTo(maps.wind);
}

function addWindStreamlines() {
    if (!windSimulationData.streamlines) return;
    
    windSimulationData.streamlines.forEach((streamline, index) => {
        const coordinates = streamline.coordinates.map(coord => [coord[1], coord[0]]); // lon,lat to lat,lon
        
        const polyline = L.polyline(coordinates, {
            color: getWindSpeedColor(streamline.avg_speed),
            weight: Math.max(2, Math.min(8, streamline.avg_speed * 0.8)),
            opacity: 0.7,
            className: 'wind-streamline'
        });
        
        polyline.bindPopup(`
            <strong>Streamline ${index + 1}</strong><br>
            Średnia prędkość: ${streamline.avg_speed.toFixed(1)} m/s<br>
            Kierunek: ${streamline.direction}°
        `);
        
        polyline.addTo(maps.wind);
        windLayers[`streamline_${index}`] = polyline;
    });
}

function addWindVectorField() {
    if (!windSimulationData.vector_field) return;
    
    windSimulationData.vector_field.forEach((vector, index) => {
        const position = [vector.lat, vector.lon];
        const speed = Math.sqrt(vector.u * vector.u + vector.v * vector.v);
        const direction = Math.atan2(vector.v, vector.u) * 180 / Math.PI;
        
        const arrowIcon = L.divIcon({
            html: `<div class="wind-vector-arrow" style="
                transform: rotate(${direction}deg);
                color: ${getWindSpeedColor(speed)};
                font-size: ${Math.max(12, Math.min(24, speed * 2))}px;
            ">→</div>`,
            className: 'wind-vector',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker(position, { icon: arrowIcon });
        marker.bindPopup(`
            <strong>Wektor wiatru</strong><br>
            Prędkość: ${speed.toFixed(1)} m/s<br>
            Kierunek: ${direction.toFixed(0)}°<br>
            U: ${vector.u.toFixed(1)} m/s<br>
            V: ${vector.v.toFixed(1)} m/s
        `);
        
        marker.addTo(maps.wind);
        windLayers[`vector_${index}`] = marker;
    });
}

function addWindMeasurementPoints() {
    if (!windSimulationData.measurement_points) return;
    
    windSimulationData.measurement_points.forEach((point, index) => {
        const marker = L.circleMarker([point.lat, point.lon], {
            radius: 8,
            color: getWindSpeedColor(point.wind_speed),
            fillColor: getWindSpeedColor(point.wind_speed),
            fillOpacity: 0.8,
            weight: 2
        });
        
        marker.bindPopup(`
            <strong>Punkt pomiarowy</strong><br>
            Prędkość: ${point.wind_speed.toFixed(1)} m/s<br>
            Kierunek: ${point.wind_direction}°<br>
            Wysokość: ${point.height}m<br>
            Turbulencja: ${point.turbulence ? point.turbulence.toFixed(2) : 'N/A'}
        `);
        
        marker.addTo(maps.wind);
        windLayers[`measurement_${index}`] = marker;
    });
}

function getWindSpeedColor(speed) {
    if (speed <= 5) return '#10b981';
    if (speed <= 10) return '#f59e0b';
    return '#ef4444';
}

function addWindParticles() {
    // Create animated particles following wind flow
    if (!windSimulationData.vector_field) return;
    
    const particleCount = Math.min(20, windSimulationData.vector_field.length);
    
    for (let i = 0; i < particleCount; i++) {
        const vector = windSimulationData.vector_field[i];
        if (!vector) continue;
        
        const startPos = [vector.lat, vector.lon];
        const speed = Math.sqrt(vector.u * vector.u + vector.v * vector.v);
        
        // Create particle marker
        const particle = L.circleMarker(startPos, {
            radius: 3,
            color: '#60a5fa',
            fillColor: '#60a5fa',
            fillOpacity: 0.8,
            weight: 1,
            className: 'wind-particle'
        });
        
        particle.addTo(maps.wind);
        windLayers[`particle_${i}`] = particle;
        
        // Animate particle movement
        animateWindParticle(particle, vector, speed);
    }
}

function animateWindParticle(particle, vector, speed) {
    const duration = 3000 / Math.max(speed, 1); // Faster for higher speeds
    const steps = 30;
    const stepDuration = duration / steps;
    
    let step = 0;
    const startLat = vector.lat;
    const startLng = vector.lon;
    
    const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        
        // Calculate new position based on wind vector
        const deltaLat = (vector.v * progress * 0.001); // Small movement
        const deltaLng = (vector.u * progress * 0.001);
        
        const newPos = [startLat + deltaLat, startLng + deltaLng];
        particle.setLatLng(newPos);
        
        // Update opacity
        particle.setStyle({ fillOpacity: 0.8 * (1 - progress) });
        
        if (step >= steps) {
            clearInterval(interval);
            // Reset particle
            particle.setLatLng([startLat, startLng]);
            particle.setStyle({ fillOpacity: 0.8 });
            
            // Restart animation
            setTimeout(() => animateWindParticle(particle, vector, speed), 1000);
        }
    }, stepDuration);
}

function animateWindFlow() {
    // Update wind visualization
    if (windLayers && Object.keys(windLayers).length > 0) {
        Object.keys(windLayers).forEach(key => {
            if (key.startsWith('particle_')) {
                const particle = windLayers[key];
                // Additional particle animation logic
            }
        });
    }
}
// Utility functions
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
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

// Error handling
window.addEventListener('error', function(e) {
    console.error('🚨 JavaScript Error:', e.error);
    
    // Show user-friendly error message for critical errors
    if (e.error && e.error.message && e.error.message.includes('map')) {
        showNotification('Wystąpił problem z ładowaniem map. Odśwież stronę.', 'error');
    }
});

// Notification system
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, duration);
    
    // Manual close
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    });
}

// Performance monitoring
function logPerformance(operation, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`⏱️ ${operation} wykonane w ${duration.toFixed(2)}ms`);
    
    if (duration > 1000) {
        console.warn(`⚠️ Wolna operacja: ${operation} (${duration.toFixed(2)}ms)`);
    }
}

// Data loading helpers
async function fetchWithRetry(url, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;
        } catch (error) {
            console.warn(`❌ Próba ${attempt}/${maxRetries} nieudana dla ${url}: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        }
    }
}

// Responsive helper
function isMobileDevice() {
    return window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Initialize responsive behavior
function initResponsive() {
    const handleResize = debounce(() => {
        // Resize maps
        Object.values(maps).forEach(map => {
            if (map && map.invalidateSize) {
                map.invalidateSize();
            }
        });
        
        // Update particle canvas
        const particleCanvas = document.querySelector('.particles-canvas');
        if (particleCanvas) {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }
        
        // Adjust mobile navigation
        const navMenu = document.getElementById('nav-menu');
        if (navMenu && window.innerWidth > 768) {
            navMenu.classList.remove('active');
        }
    }, 250);
    
    window.addEventListener('resize', handleResize);
}

// Initialize responsive behavior on load
document.addEventListener('DOMContentLoaded', () => {
    initResponsive();
});

// Cleanup function for page unload
window.addEventListener('beforeunload', () => {
    // Clear intervals
    if (animationInterval) {
        clearInterval(animationInterval);
    }
    
    // Remove event listeners
    particles = [];
    
    console.log('🧹 Wyczyszczono zasoby aplikacji');
});

// Export functions for external access (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initMaps,
        updateFloodVisualization,
        updateWindVisualization,
        updateThermalVisualization,
        showNotification,
        loadWindSimulationData
    };
}

// Development helpers (only in development)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.debugApp = {
        maps,
        windSimulationData,
        particles,
        showAllLayers: () => {
            Object.values(maps).forEach(map => {
                if (map && map.eachLayer) {
                    map.eachLayer(layer => console.log(layer));
                }
            });
        },
        reloadWindData: loadWindSimulationData,
        testNotification: () => showNotification('Test notification', 'success')
    };
    
    console.log('🔧 Debug tools available: window.debugApp');
}

console.log('🎉 Aplikacja GIS Microclimate Platform załadowana pomyślnie!');
