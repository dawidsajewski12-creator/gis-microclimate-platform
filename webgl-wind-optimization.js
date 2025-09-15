/**
 * WebGL Wind Particle System - Zaawansowany kod optymalizacyjny
 * Autor: GIS Microclimate Platform
 * Opis: Implementacja wydajnej wizualizacji wiatru z użyciem WebGL
 */

// =====================================
// WEBGL PARTICLE RENDERER
// =====================================

class WebGLWindRenderer {
    constructor(canvas, windData) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        this.windData = windData;
        this.particles = [];
        this.particleCount = 2000;
        this.animationSpeed = 1.0;
        
        if (!this.gl) {
            throw new Error('WebGL nie jest wspierany przez tę przeglądarkę');
        }
        
        this.init();
    }
    
    init() {
        this.setupWebGL();
        this.createShaders();
        this.createBuffers();
        this.initParticles();
        this.setupTextures();
    }
    
    setupWebGL() {
        const gl = this.gl;
        
        // Konfiguracja WebGL
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    createShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_velocity;
            attribute float a_age;
            attribute float a_speed;
            
            uniform mat3 u_matrix;
            uniform float u_particle_size;
            uniform float u_time;
            
            varying float v_age;
            varying float v_speed;
            varying vec2 v_velocity;
            
            void main() {
                vec2 position = a_position + a_velocity * u_time * 0.1;
                vec3 clipSpace = u_matrix * vec3(position, 1.0);
                
                gl_Position = vec4(clipSpace.xy, 0.0, 1.0);
                gl_PointSize = u_particle_size * (1.0 - a_age * 0.5);
                
                v_age = a_age;
                v_speed = a_speed;
                v_velocity = a_velocity;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            
            uniform sampler2D u_color_ramp;
            uniform float u_opacity;
            
            varying float v_age;
            varying float v_speed;
            varying vec2 v_velocity;
            
            void main() {
                // Oblicz kolor na podstawie prędkości
                float speedNormalized = clamp(v_speed / 10.0, 0.0, 1.0);
                vec4 color = texture2D(u_color_ramp, vec2(speedNormalized, 0.5));
                
                // Alpha fade na podstawie wieku
                float alpha = (1.0 - v_age) * u_opacity;
                
                // Circular particle shape
                vec2 coord = gl_PointCoord - 0.5;
                float dist = length(coord);
                if (dist > 0.5) discard;
                
                alpha *= 1.0 - smoothstep(0.3, 0.5, dist);
                
                gl_FragColor = vec4(color.rgb, alpha);
            }
        `;
        
        this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.program);
        
        // Pobierz lokalizacje atrybutów i uniformów
        this.attributes = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            velocity: this.gl.getAttribLocation(this.program, 'a_velocity'),
            age: this.gl.getAttribLocation(this.program, 'a_age'),
            speed: this.gl.getAttribLocation(this.program, 'a_speed')
        };
        
        this.uniforms = {
            matrix: this.gl.getUniformLocation(this.program, 'u_matrix'),
            particleSize: this.gl.getUniformLocation(this.program, 'u_particle_size'),
            time: this.gl.getUniformLocation(this.program, 'u_time'),
            colorRamp: this.gl.getUniformLocation(this.program, 'u_color_ramp'),
            opacity: this.gl.getUniformLocation(this.program, 'u_opacity')
        };
    }
    
    createShaderProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Błąd linkowania shader program: ' + gl.getProgramInfoLog(program));
        }
        
        return program;
    }
    
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Błąd kompilacji shadera: ' + gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }
    
    createBuffers() {
        const gl = this.gl;
        
        // Bufory dla danych cząsteczek
        this.positionBuffer = gl.createBuffer();
        this.velocityBuffer = gl.createBuffer();
        this.ageBuffer = gl.createBuffer();
        this.speedBuffer = gl.createBuffer();
    }
    
    initParticles() {
        this.particles = [];
        
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: 0,
                vy: 0,
                age: Math.random(),
                life: 1.0,
                speed: 0
            });
        }
        
        this.updateBuffers();
    }
    
    setupTextures() {
        const gl = this.gl;
        
        // Tworzy teksturę kolorów dla prędkości wiatru
        this.colorRampTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture);
        
        const colorData = this.createColorRamp();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorData);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    createColorRamp() {
        // Gradient kolorów: niebieski -> zielony -> żółty -> czerwony
        const colors = [
            [0, 0, 255, 255],      // Niebieski (wolno)
            [0, 255, 255, 255],    // Cyan
            [0, 255, 0, 255],      // Zielony
            [255, 255, 0, 255],    // Żółty
            [255, 0, 0, 255]       // Czerwony (szybko)
        ];
        
        const colorData = new Uint8Array(256 * 4);
        
        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            const colorIndex = Math.floor(t * (colors.length - 1));
            const localT = (t * (colors.length - 1)) % 1;
            
            const color1 = colors[colorIndex];
            const color2 = colors[Math.min(colorIndex + 1, colors.length - 1)];
            
            colorData[i * 4 + 0] = Math.floor(color1[0] * (1 - localT) + color2[0] * localT);
            colorData[i * 4 + 1] = Math.floor(color1[1] * (1 - localT) + color2[1] * localT);
            colorData[i * 4 + 2] = Math.floor(color1[2] * (1 - localT) + color2[2] * localT);
            colorData[i * 4 + 3] = 255;
        }
        
        return colorData;
    }
    
    interpolateWindAt(x, y) {
        if (!this.windData) return { u: 0, v: 0, speed: 0 };
        
        const { width, height, u, v } = this.windData;
        
        // Normalizuj współrzędne do siatki wiatru
        const gridX = (x / this.canvas.width) * width;
        const gridY = (y / this.canvas.height) * height;
        
        const ix = Math.floor(gridX);
        const iy = Math.floor(gridY);
        
        // Sprawdź granice
        if (ix < 0 || ix >= width - 1 || iy < 0 || iy >= height - 1) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Interpolacja bilinearna
        const fx = gridX - ix;
        const fy = gridY - iy;
        
        const idx00 = iy * width + ix;
        const idx01 = iy * width + (ix + 1);
        const idx10 = (iy + 1) * width + ix;
        const idx11 = (iy + 1) * width + (ix + 1);
        
        const u00 = u[idx00] || 0;
        const u01 = u[idx01] || 0;
        const u10 = u[idx10] || 0;
        const u11 = u[idx11] || 0;
        
        const v00 = v[idx00] || 0;
        const v01 = v[idx01] || 0;
        const v10 = v[idx10] || 0;
        const v11 = v[idx11] || 0;
        
        const uInterp = u00 * (1 - fx) * (1 - fy) +
                       u01 * fx * (1 - fy) +
                       u10 * (1 - fx) * fy +
                       u11 * fx * fy;
                       
        const vInterp = v00 * (1 - fx) * (1 - fy) +
                       v01 * fx * (1 - fy) +
                       v10 * (1 - fx) * fy +
                       v11 * fx * fy;
        
        const speed = Math.sqrt(uInterp * uInterp + vInterp * vInterp);
        
        return { u: uInterp, v: vInterp, speed };
    }
    
    updateParticles(deltaTime) {
        const dt = deltaTime * this.animationSpeed * 0.001;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Pobierz wiatr w aktualnej pozycji
            const wind = this.interpolateWindAt(particle.x, particle.y);
            
            // Aktualizuj prędkość z wiatrem
            particle.vx = wind.u * 5; // Skaluj prędkość dla wizualizacji
            particle.vy = wind.v * 5;
            particle.speed = wind.speed;
            
            // Aktualizuj pozycję
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            
            // Aktualizuj wiek
            particle.age += dt * 0.01;
            
            // Reset cząsteczki jeśli stara lub poza granicami
            if (particle.age > 1.0 || 
                particle.x < 0 || particle.x > this.canvas.width ||
                particle.y < 0 || particle.y > this.canvas.height) {
                
                particle.x = Math.random() * this.canvas.width;
                particle.y = Math.random() * this.canvas.height;
                particle.age = 0;
            }
        }
        
        this.updateBuffers();
    }
    
    updateBuffers() {
        const gl = this.gl;
        
        // Przygotuj dane do przesłania do GPU
        const positions = new Float32Array(this.particles.length * 2);
        const velocities = new Float32Array(this.particles.length * 2);
        const ages = new Float32Array(this.particles.length);
        const speeds = new Float32Array(this.particles.length);
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            positions[i * 2] = particle.x;
            positions[i * 2 + 1] = particle.y;
            
            velocities[i * 2] = particle.vx;
            velocities[i * 2 + 1] = particle.vy;
            
            ages[i] = particle.age;
            speeds[i] = particle.speed;
        }
        
        // Aktualizuj bufory
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, ages, gl.DYNAMIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.speedBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, speeds, gl.DYNAMIC_DRAW);
    }
    
    render(projectionMatrix, opacity = 0.8) {
        const gl = this.gl;
        
        gl.useProgram(this.program);
        
        // Ustaw uniformy
        gl.uniformMatrix3fv(this.uniforms.matrix, false, projectionMatrix);
        gl.uniform1f(this.uniforms.particleSize, 3.0);
        gl.uniform1f(this.uniforms.time, performance.now() * 0.001);
        gl.uniform1f(this.uniforms.opacity, opacity);
        
        // Aktywuj teksturę kolorów
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture);
        gl.uniform1i(this.uniforms.colorRamp, 0);
        
        // Ustaw atrybuty wierzchołków
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.attributes.position);
        gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
        gl.enableVertexAttribArray(this.attributes.velocity);
        gl.vertexAttribPointer(this.attributes.velocity, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ageBuffer);
        gl.enableVertexAttribArray(this.attributes.age);
        gl.vertexAttribPointer(this.attributes.age, 1, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.speedBuffer);
        gl.enableVertexAttribArray(this.attributes.speed);
        gl.vertexAttribPointer(this.attributes.speed, 1, gl.FLOAT, false, 0, 0);
        
        // Rysuj cząsteczki
        gl.drawArrays(gl.POINTS, 0, this.particles.length);
    }
    
    setParticleCount(count) {
        this.particleCount = Math.max(100, Math.min(8000, count));
        this.initParticles();
    }
    
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed));
    }
    
    destroy() {
        const gl = this.gl;
        
        // Wyczyść zasoby WebGL
        gl.deleteProgram(this.program);
        gl.deleteBuffer(this.positionBuffer);
        gl.deleteBuffer(this.velocityBuffer);
        gl.deleteBuffer(this.ageBuffer);
        gl.deleteBuffer(this.speedBuffer);
        gl.deleteTexture(this.colorRampTexture);
    }
}

// =====================================
// PERFORMANCE PROFILER
// =====================================

class PerformanceProfiler {
    constructor() {
        this.metrics = {
            fps: 0,
            frameTime: 0,
            particlesPerSecond: 0,
            memoryUsage: 0
        };
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.frameTimeHistory = [];
    }
    
    startFrame() {
        this.frameStart = performance.now();
    }
    
    endFrame(particleCount) {
        const now = performance.now();
        const frameTime = now - this.frameStart;
        
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > 60) {
            this.frameTimeHistory.shift();
        }
        
        this.frameCount++;
        
        // Aktualizuj FPS co sekundę
        if (now - this.lastTime >= 1000) {
            this.metrics.fps = this.frameCount;
            this.metrics.frameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
            this.metrics.particlesPerSecond = this.metrics.fps * particleCount;
            
            if (performance.memory) {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1048576; // MB
            }
            
            this.frameCount = 0;
            this.lastTime = now;
        }
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
    
    logPerformance() {
        console.log('🚀 Performance Metrics:', {
            fps: `${this.metrics.fps} FPS`,
            frameTime: `${this.metrics.frameTime.toFixed(2)} ms`,
            particlesPerSecond: `${Math.round(this.metrics.particlesPerSecond)} particles/sec`,
            memoryUsage: `${this.metrics.memoryUsage.toFixed(1)} MB`
        });
    }
}

// =====================================
// STREAMLINE GENERATOR
// =====================================

class StreamlineGenerator {
    constructor(windData) {
        this.windData = windData;
        this.streamlines = [];
    }
    
    generateStreamlines(seedPoints, maxLength = 50, stepSize = 2) {
        this.streamlines = [];
        
        for (const seed of seedPoints) {
            const streamline = this.traceStreamline(seed.x, seed.y, maxLength, stepSize);
            if (streamline.length > 5) { // Tylko długie streamlines
                this.streamlines.push(streamline);
            }
        }
        
        return this.streamlines;
    }
    
    traceStreamline(startX, startY, maxLength, stepSize) {
        const points = [{ x: startX, y: startY }];
        let currentX = startX;
        let currentY = startY;
        
        for (let step = 0; step < maxLength; step++) {
            const wind = this.interpolateWindAt(currentX, currentY);
            
            if (wind.speed < 0.1) break; // Za słaby wiatr
            
            const stepX = (wind.u / wind.speed) * stepSize;
            const stepY = (wind.v / wind.speed) * stepSize;
            
            currentX += stepX;
            currentY += stepY;
            
            // Sprawdź granice
            if (currentX < 0 || currentX >= this.windData.width ||
                currentY < 0 || currentY >= this.windData.height) {
                break;
            }
            
            points.push({ x: currentX, y: currentY });
        }
        
        return points;
    }
    
    interpolateWindAt(x, y) {
        // Kopiowane z WebGLWindRenderer - można wydzielić do wspólnej klasy
        if (!this.windData) return { u: 0, v: 0, speed: 0 };
        
        const { width, height, u, v } = this.windData;
        
        const gridX = x / width * width;
        const gridY = y / height * height;
        
        const ix = Math.floor(gridX);
        const iy = Math.floor(gridY);
        
        if (ix < 0 || ix >= width - 1 || iy < 0 || iy >= height - 1) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Interpolacja bilinearna (uproszczona)
        const idx = iy * width + ix;
        const uVal = u[idx] || 0;
        const vVal = v[idx] || 0;
        const speed = Math.sqrt(uVal * uVal + vVal * vVal);
        
        return { u: uVal, v: vVal, speed };
    }
    
    renderStreamlines(ctx, transform) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        
        for (const streamline of this.streamlines) {
            if (streamline.length < 2) continue;
            
            ctx.beginPath();
            const firstPoint = transform(streamline[0].x, streamline[0].y);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            
            for (let i = 1; i < streamline.length; i++) {
                const point = transform(streamline[i].x, streamline[i].y);
                ctx.lineTo(point.x, point.y);
            }
            
            ctx.stroke();
        }
    }
}

// Eksport klas dla użycia w aplikacji
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WebGLWindRenderer,
        PerformanceProfiler,
        StreamlineGenerator
    };
}