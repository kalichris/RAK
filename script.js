
AOS.init({
    duration: 1000,
    once: true,
    offset: 100
});

let scene, camera, renderer, controls, composer;
let earthGroup, cloudGroup, earth, clouds;
let uaeBorders, uaeHighlight;
let isEarthRotating = true;
let uaeGeoJsonCache = null;

let isZoomedToUAE = false;

function toggleZoom() {
    const button = document.getElementById('zoom-uae-btn');
    if (isZoomedToUAE) {
        focusInitialViewOnUAE();
        button.textContent = 'اسألني فين رأس الخيمة';

        document.getElementById('uae-box').classList.remove('visible');
        document.getElementById('rak-box').classList.remove('visible');
    } else {
        zoomToUAE();
        button.textContent = 'رجعني';
    }
    isZoomedToUAE = !isZoomedToUAE;
}

let miniMapUAE = null;
let miniMapRAK = null;
let miniMapUAEGeoLayer = null;
let miniMapRAKGeoLayer = null;

const UAE_CENTER = { lat: 24.8293, lon: 54.823 };
const RAK_POINT = { lat: 25.8, lon: 55.98 };

window.addEventListener('load', () => {
    initializeRenderer();
    createEarthScene();
    createSatellite();
    // createPulsingMarker(); // Removed to prioritize logo view
    animate();
    loadUAEGeoJsonAndInitMiniMaps();


    const leaderImg = document.querySelector('.leader-img');
    const overlay = document.querySelector('.image-overlay');

    if (leaderImg && overlay) {

        leaderImg.addEventListener('click', (e) => {
            if (leaderImg.classList.contains('enlarged')) {
                closeLeaderImage();
            } else {
                leaderImg.classList.add('enlarged');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
            e.stopPropagation();
        });


        overlay.addEventListener('click', () => {
            closeLeaderImage();
        });


        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && leaderImg.classList.contains('enlarged')) {
                closeLeaderImage();
            }
        });

        function closeLeaderImage() {
            leaderImg.classList.add('closing');
            overlay.classList.remove('active');

            setTimeout(() => {
                leaderImg.classList.remove('enlarged', 'closing');
                document.body.style.overflow = '';
            }, 400);
        }
    }

});

function focusInitialViewOnUAE() {
    const uaeVec = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1);
    const startPos = uaeVec.clone().multiplyScalar(10);
    const endPos = uaeVec.clone().multiplyScalar(2.8);

    camera.position.copy(startPos);
    camera.lookAt(uaeVec);
    controls.target.copy(uaeVec);

    const startFOV = 25;
    const endFOV = 45;
    camera.fov = startFOV;
    camera.updateProjectionMatrix();


    const startTime = Date.now();
    const duration = 4000;
    function introStep() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 5);

        camera.position.lerpVectors(startPos, endPos, ease);
        camera.fov = startFOV + (endFOV - startFOV) * ease;
        camera.updateProjectionMatrix();

        camera.lookAt(uaeVec);
        controls.update();

        if (t < 1) requestAnimationFrame(introStep);
    }
    setTimeout(introStep, 1000);
}

function initializeRenderer() {
    const container = document.getElementById('globe-container');
    const canvas = document.getElementById('globe-canvas');
    if (!container || !canvas) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.001, 1000);
    camera.position.set(0, 0, 3.6);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        1.0,
        0.4,
        0.85
    );
    composer.addPass(bloomPass);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = true;
    controls.minDistance = 0.3;
    controls.maxDistance = 12;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;


    if (window.innerWidth < 768) {
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false;
    }
}

function createEarthScene() {
    earthGroup = new THREE.Group();
    earthGroup.rotation.z = -23.4 * Math.PI / 180;
    cloudGroup = new THREE.Group();
    earthGroup.add(cloudGroup);
    scene.add(earthGroup);

    const geometry = new THREE.SphereGeometry(1, 256, 256);
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';


    const dayMap = loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const nightMap = loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
    const normalMap = loader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
    const cloudsMap = loader.load('https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images/earthcloudmap.jpg');

    const earthMaterial = new THREE.MeshStandardMaterial({
        map: dayMap,
        normalMap: normalMap,
        emissiveMap: nightMap,
        emissive: new THREE.Color(0xffffcc),
        emissiveIntensity: 1.2,
        roughness: 0.7,
        metalness: 0.1
    });


    earth = new THREE.Mesh(geometry, earthMaterial);
    earthGroup.add(earth);


    const cloudsMaterial = new THREE.MeshPhongMaterial({
        map: cloudsMap,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    clouds = new THREE.Mesh(geometry, cloudsMaterial);
    clouds.scale.setScalar(1.015);
    cloudGroup.add(clouds);


    const atmosphereGeometry = new THREE.SphereGeometry(1.03, 96, 96);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            coeficient: { value: 0.8 },
            power: { value: 3.5 },
            glowColor: { value: new THREE.Color(0x00ccff) }
        },
        vertexShader: `
            varying vec3 vNormal;
            void main(){
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float coeficient;
            uniform float power;
            uniform vec3 glowColor;
            varying vec3 vNormal;
            void main(){
                float intensity = pow(coeficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power);
                gl_FragColor = vec4(glowColor, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphere);


    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);


    const galaxyGeometry = new THREE.SphereGeometry(90, 64, 64);
    const galaxyMaterial = new THREE.MeshBasicMaterial({
        map: loader.load('https://unpkg.com/three-globe/example/img/night-sky.png'),
        side: THREE.BackSide
    });
    const galaxy = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
    scene.add(galaxy);

    uaeBorders = new THREE.Group();
    uaeHighlight = new THREE.Group();
    earthGroup.add(uaeHighlight);

    // Create logo first so it's ready
    // createProjectedLogo() is called by createSatellite()

    drawUAEBorders3D();
    // createPulsingMarker(); // Removing red pulsing marker to clear view for logo
    createUAELabel();
}

function createUAELabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');


    ctx.clearRect(0, 0, 512, 128);
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('دولة الإمارات', 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });
    const sprite = new THREE.Sprite(material);

    const pos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1.04);
    sprite.position.copy(pos);
    sprite.scale.set(0.06, 0.015, 1);

    uaeHighlight.add(sprite);
}

let pulsingMarker = null;

let satellite = null;
let satelliteBeam = null;
let satelliteAngle = 0;

const UAE_LOGO_URL = ''; // Not used anymore

// ... present code ...

function createProjectedLogo() {
    // Instead of an image logo, use a subtle circular marker (holographic style)
    const logoSize = 0.05;
    const geometry = new THREE.CircleGeometry(logoSize, 32);

    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, // White/Holographic
        transparent: true,
        opacity: 0.3, // Very subtle transparency
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending // Glowy effect
    });

    const logoMesh = new THREE.Mesh(geometry, material);

    // Position exactly at UAE center but slightly higher than the highlight fill
    const pos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1.015);
    logoMesh.position.copy(pos);
    logoMesh.lookAt(new THREE.Vector3(0, 0, 0));

    // Add a ring around it for detail
    const ringGeo = new THREE.RingGeometry(logoSize * 0.8, logoSize, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = 0.001; // Slightly above circle
    logoMesh.add(ring);

    logoMesh.userData.isLogo = true;
    earthGroup.add(logoMesh);
}

// Navigation: Scroll to the 3D Globe section when button is clicked
function startExperience() {
    const globeSection = document.querySelector('.globe-section');
    if (globeSection) {
        globeSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function createSatellite() {
    // === High-Detail Realistic Satellite Construction ===
    satellite = new THREE.Group();

    // 1. Main Bus Body (Octagonal Prism approximation using Box + angled sides)
    const bodyLength = 0.14;
    const bodyWidth = 0.07;

    // Core structure (Gold foil mlil)
    const coreGeo = new THREE.BoxGeometry(bodyWidth, bodyWidth, bodyLength);
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700, // Gold foil
        metalness: 0.9,
        roughness: 0.4,
        envMapIntensity: 1.5
    });
    const core = new THREE.Mesh(coreGeo, goldMat);
    satellite.add(core);

    // 2. Solar Arrays (Large, articulated panels)
    const panelLength = 0.45;
    const panelWidth = 0.12;
    const panelThick = 0.005;

    const panelGeo = new THREE.BoxGeometry(panelLength, panelWidth, panelThick);
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x102040, // Dark photovoltaic blue
        emissive: 0x051025,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    });

    // Panel Supports (truss structure)
    const trussGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.25, 8);
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.3 });

    // Left Wing
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.35, 0, 0);
    satellite.add(leftPanel);

    const leftTruss = new THREE.Mesh(trussGeo, silverMat);
    leftTruss.rotation.z = Math.PI / 2;
    leftTruss.position.set(-0.16, 0, 0);
    satellite.add(leftTruss);

    // Right Wing
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.35, 0, 0);
    satellite.add(rightPanel);

    const rightTruss = new THREE.Mesh(trussGeo, silverMat);
    rightTruss.rotation.z = Math.PI / 2;
    rightTruss.position.set(0.16, 0, 0);
    satellite.add(rightTruss);

    // 3. Communications Payload (Dishes)
    // Main High-Gain Antenna (Large Dish)
    const dishGeo = new THREE.ConeGeometry(0.06, 0.02, 32, 1, true);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
    const mainDish = new THREE.Mesh(dishGeo, whiteMat);
    mainDish.rotation.x = Math.PI / 2;
    mainDish.position.set(0, 0, bodyLength / 2 + 0.02);
    satellite.add(mainDish);

    // Feed horn inside dish
    const feedGeo = new THREE.CylinderGeometry(0.005, 0.002, 0.04, 8);
    const feed = new THREE.Mesh(feedGeo, silverMat);
    feed.rotation.x = Math.PI / 2;
    feed.position.set(0, 0, bodyLength / 2 + 0.04);
    satellite.add(feed);

    // Secondary Telemetry Antennas (Small helix/whips)
    const rodGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.15, 8);
    const antenna1 = new THREE.Mesh(rodGeo, silverMat);
    antenna1.position.set(0.03, 0.04, -bodyLength / 2);
    antenna1.rotation.x = -Math.PI / 4;
    satellite.add(antenna1);

    const antenna2 = new THREE.Mesh(rodGeo, silverMat);
    antenna2.position.set(-0.03, -0.04, -bodyLength / 2);
    antenna2.rotation.x = Math.PI / 4;
    satellite.add(antenna2);

    // 4. Propulsion / Thrusters (Small cones on sides)
    const thrusterGeo = new THREE.ConeGeometry(0.01, 0.015, 8, 1, true);
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    const thruster1 = new THREE.Mesh(thrusterGeo, darkMat);
    thruster1.position.set(0, bodyWidth / 2 + 0.005, 0);
    satellite.add(thruster1);

    const thruster2 = new THREE.Mesh(thrusterGeo, darkMat);
    thruster2.position.set(0, -bodyWidth / 2 - 0.005, 0);
    thruster2.rotation.z = Math.PI;
    satellite.add(thruster2);

    // 5. Sensor Instruments (Camera / Star Tracker)
    const sensorBox = new THREE.BoxGeometry(0.02, 0.02, 0.04);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    const sensor = new THREE.Mesh(sensorBox, silverMat);
    sensor.position.set(0.02, -0.02, bodyLength / 2);
    satellite.add(sensor);

    // Lens geometry
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 16), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.02, -0.02, bodyLength / 2 + 0.02);
    satellite.add(lens);


    // Position Satellite (Geostationary relative to Earth group)
    const satelliteRadius = 1.65;
    const satellitePos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, satelliteRadius);
    satellite.position.copy(satellitePos);
    satellite.lookAt(new THREE.Vector3(0, 0, 0)); // Look at Earth center

    // Add to EARTH group so it rotates WITH the earth
    earthGroup.add(satellite);

    // === Connection Beam (Enhanced Visibility) ===
    const beamGeometry = new THREE.CylinderGeometry(0.004, 0.12, satelliteRadius - 1, 32, 1, true); // Smooth cylinder
    const beamMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: 0.55 },
            color: { value: new THREE.Color(0x4fc3f7) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float opacity;
            uniform vec3 color;
            varying vec2 vUv;
            void main() {
                // Complex interference pattern for "data stream" look
                float flow = sin(vUv.y * 20.0 - time * 8.0) * 0.5 + 0.5;
                float pulse = sin(time * 3.0) * 0.2 + 0.8;
                
                // Focused core beam
                float core = 1.0 - smoothstep(0.0, 0.4, abs(vUv.x - 0.5));
                
                // Soft edges
                float edges = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
                
                float combined = (core * 0.8 + flow * 0.4) * pulse * edges;
                
                gl_FragColor = vec4(color, opacity * combined);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    satelliteBeam = new THREE.Mesh(beamGeometry, beamMaterial);

    // Position beam halfway
    const uaePos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1);
    const midPoint = new THREE.Vector3().addVectors(satellitePos, uaePos).multiplyScalar(0.5);
    satelliteBeam.position.copy(midPoint);
    satelliteBeam.lookAt(uaePos); // Point towards UAE
    satelliteBeam.rotateX(-Math.PI / 2); // Align cylinder

    earthGroup.add(satelliteBeam);

    createProjectedLogo();
}

function createProjectedLogo() {
    const logoSize = 0.08; // Much smaller to fit inside UAE shading
    const geometry = new THREE.PlaneGeometry(logoSize, logoSize);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    loader.load(UAE_LOGO_URL, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // 1. The Logo Mesh (True Colors, blended nicely)
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending
        });

        const logoMesh = new THREE.Mesh(geometry, material);

        // Position exactly at UAE center but slightly higher than the highlight fill (1.009)
        // Set to 1.012 so it sits nicely on top of the red fill
        const pos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1.012);
        logoMesh.position.copy(pos);
        logoMesh.lookAt(new THREE.Vector3(0, 0, 0));
        logoMesh.rotateX(Math.PI);
        logoMesh.rotateZ(Math.PI);
        logoMesh.userData.isLogo = true;

        earthGroup.add(logoMesh);

    }, undefined, (err) => {
        console.error("Error loading logo texture", err);
    });
}

function updateSatellite() {
    if (!satelliteBeam) return;

    // Just update beam animation since position is now fixed to earthGroup
    // Handle ShaderMaterial uniforms
    if (satelliteBeam.material.uniforms) {
        satelliteBeam.material.uniforms.time.value = Date.now() * 0.001;
    }
}

function createPulsingMarker() {

    const pos = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1.03);

    const geometry = new THREE.RingGeometry(0.008, 0.016, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xff2b2b,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false
    });

    pulsingMarker = new THREE.Mesh(geometry, material);
    pulsingMarker.position.copy(pos);
    pulsingMarker.lookAt(new THREE.Vector3(0, 0, 0));


    const glowGeo = new THREE.RingGeometry(0.012, 0.024, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff2b2b,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthTest: false
    });
    const glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.position.z = -0.001;
    pulsingMarker.add(glowRing);

    earthGroup.add(pulsingMarker);


    window.addEventListener('click', onGlobeClick, false);
}

function onGlobeClick(event) {
    if (!pulsingMarker) return;
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);


    const intersects = raycaster.intersectObjects([pulsingMarker, ...pulsingMarker.children]);

    if (intersects.length > 0) {
        zoomToUAE();
    }
}


function createStars() { }

function latLonToVector3(lat, lon, radius = 1) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

function createFillMesh(points3D, radius = 1.01) {
    if (!points3D || points3D.length < 3) return null;

    const center = new THREE.Vector3();
    for (const p of points3D) center.add(p);
    center.divideScalar(points3D.length).normalize().multiplyScalar(radius);

    const positions = [];
    for (let i = 0; i < points3D.length; i++) {
        const next = (i + 1) % points3D.length;
        positions.push(center.x, center.y, center.z);
        positions.push(points3D[i].x, points3D[i].y, points3D[i].z);
        positions.push(points3D[next].x, points3D[next].y, points3D[next].z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();


    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xff2222) },
            glowColor: { value: new THREE.Color(0xffcc00) },
            opacity: { value: 0.7 },
            time: { value: 0 }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vScanUv;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                vScanUv = uv; 
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform vec3 glowColor;
            uniform float opacity;
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vec3 viewDir = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);

                
                float scanline = sin(vPosition.y * 100.0 + time * 10.0) * 0.15 + 0.85;
                
                vec3 finalColor = mix(color, glowColor, fresnel);
                float finalAlpha = (opacity + fresnel * 0.5) * scanline;

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isFillMesh = true;
    return mesh;
}

function drawUAEBorders3D() {
    const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/ARE.geo.json';

    fetch(url)
        .then(res => res.json())
        .then(data => {
            uaeGeoJsonCache = data;
            const features = data.features || [];
            console.log('UAE GeoJSON loaded, features:', features.length);

            for (const feature of features) {
                const coords = feature?.geometry?.coordinates;
                const type = feature?.geometry?.type;
                if (!coords || !type) continue;

                const processRing = (ring) => {
                    const points3D = ring.map(([lon, lat]) => latLonToVector3(lat, lon, 1.008));
                    console.log('Drawing ring with', points3D.length, 'points');

                    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points3D);

                    const lineMaterial = new THREE.LineBasicMaterial({
                        color: 0xff3333,
                        transparent: true,
                        opacity: 0,
                        linewidth: 2
                    });
                    uaeBorders.add(new THREE.Line(lineGeometry, lineMaterial));

                    const fill = createFillMesh(points3D, 1.009);
                    if (fill) uaeHighlight.add(fill);
                };

                if (type === 'Polygon') {
                    coords.forEach(ring => processRing(ring));
                } else if (type === 'MultiPolygon') {
                    coords.forEach(poly => poly.forEach(ring => processRing(ring)));
                }
            }
            console.log('UAE borders created:', uaeBorders.children.length, 'lines');
            console.log('UAE highlight created:', uaeHighlight.children.length, 'fills');
        })
        .catch(err => console.error('Error loading UAE GeoJSON:', err));
}

function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    if (earthGroup && isEarthRotating) {
        earthGroup.rotation.y += 0.00045;
        clouds.rotation.y += 0.0003;
    }

    if (earth) {
        const breathe = 1.0 + Math.sin(time * 0.5) * 0.003;
        earth.scale.set(breathe, breathe, breathe);
    }
    if (clouds) {
        const cloudBreathe = 1.02 + Math.sin(time * 0.4) * 0.005;
        clouds.scale.set(cloudBreathe, cloudBreathe, cloudBreathe);
    }

    updateSatellite();


    uaeHighlight.children.forEach(mesh => {
        if (mesh.material && mesh.material.uniforms && mesh.material.uniforms.time) {
            mesh.material.uniforms.time.value = time;

            if (mesh.material.uniforms.glowIntensity) {
                mesh.material.uniforms.glowIntensity.value = 1.0 + Math.sin(time * 2) * 0.5;
            }
        }
    });

    // Animate Logo
    if (earthGroup) {
        earthGroup.children.forEach(child => {
            if (child.userData.isLogo) {
                // Gentle floating/breathing effect
                const scale = 1.0 + Math.sin(time * 2.0) * 0.05;
                child.scale.set(scale, scale, scale);
            }
        });
    }


    if (pulsingMarker) {
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.3;
        pulsingMarker.scale.setScalar(scale);
    }

    controls.update();
    composer.render();
}

function showMiniMaps() {

    const uaeMap = document.getElementById('uae-mini-map');
    const rakMap = document.getElementById('rak-mini-map');
    if (uaeMap) uaeMap.classList.add('loading');
    if (rakMap) rakMap.classList.add('loading');

    const uaeBox = document.getElementById('uae-box');
    const rakBox = document.getElementById('rak-box');
    if (uaeBox) {
        uaeBox.classList.remove('hidden');
        uaeBox.classList.add('visible', 'loading');
    }
    if (rakBox) {
        rakBox.classList.remove('hidden');
        rakBox.classList.add('visible', 'loading');
    }


    setTimeout(() => {
        if (miniMapUAE) {
            miniMapUAE.invalidateSize();

            if (miniMapUAEGeoLayer) miniMapUAE.fitBounds(miniMapUAEGeoLayer.getBounds().pad(0.1));
            if (uaeMap) uaeMap.classList.remove('loading');
        }
        if (miniMapRAK) {
            miniMapRAK.invalidateSize();
            miniMapRAK.setView([RAK_POINT.lat, RAK_POINT.lon], 9);
            if (rakMap) rakMap.classList.remove('loading');
        }
    }, 100);
}

function hideMiniMaps() {
    const uaeBox = document.getElementById('uae-box');
    const rakBox = document.getElementById('rak-box');
    if (uaeBox) {
        uaeBox.classList.remove('visible');
        uaeBox.classList.add('hidden');
    }
    if (rakBox) {
        rakBox.classList.remove('visible');
        rakBox.classList.add('hidden');
    }
}

function zoomToUAE() {
    earthGroup.updateMatrixWorld();


    const uaeLocalVec = latLonToVector3(UAE_CENTER.lat, UAE_CENTER.lon, 1);
    const uaeWorldPoint = uaeLocalVec.clone().applyMatrix4(earthGroup.matrixWorld);

    controls.autoRotate = false;
    isEarthRotating = false;


    const endPos = uaeWorldPoint.clone().multiplyScalar(1.05);
    const endTarget = uaeWorldPoint;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const startTime = Date.now();
    const duration = 2500;

    function step() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        camera.lookAt(controls.target);
        controls.update();

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            uaeBorders.children.forEach(obj => obj.material && (obj.material.opacity = 1.0));
            uaeHighlight.children.forEach(obj => {
                if (obj.material.uniforms) {
                    obj.material.uniforms.opacity.value = 0.95;
                } else {
                    obj.material.opacity = 0.95;
                }
            });
            showMiniMaps();
        }
    }
    step();
}

function switchToEarth() {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(0, 0, 3.6);
    const endTarget = new THREE.Vector3(0, 0, 0);

    animateCamera(startPos, endPos, startTarget, endTarget, 1400, () => {
        controls.autoRotate = true;
        isEarthRotating = true;
        uaeBorders.children.forEach(obj => obj.material && (obj.material.opacity = 0));
        uaeHighlight.children.forEach(obj => obj.material && (obj.material.opacity = 0));
        hideMiniMaps();
    });
}

function toggle3D() {
    controls.autoRotate = !controls.autoRotate;
}

function zoomIn() {
    const minDistance = controls.minDistance;
    const targetDistance = Math.max(minDistance, camera.position.length() * 0.8);
    animateZoomDistance(targetDistance);
}

function zoomOut() {
    const maxDistance = controls.maxDistance;
    const targetDistance = Math.min(maxDistance, camera.position.length() * 1.25);
    animateZoomDistance(targetDistance);
}

function animateZoomDistance(targetDistance) {
    const startPos = camera.position.clone();
    const startDist = startPos.length();
    const startTime = Date.now();
    const duration = 650;

    function step() {
        const t = Math.min((Date.now() - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const dist = startDist + (targetDistance - startDist) * ease;
        camera.position.copy(startPos).normalize().multiplyScalar(dist);
        controls.update();
        if (t < 1) requestAnimationFrame(step);
    }
    step();
}

function animateCamera(startPos, endPos, startTarget, endTarget, durationMs, onDone) {
    const startTime = Date.now();
    function step() {
        const t = Math.min((Date.now() - startTime) / durationMs, 1);


        const ease = 1 - Math.pow(1 - t, 3);

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        controls.update();

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            if (typeof onDone === 'function') onDone();
        }
    }
    step();
}

function scrollToOfferSection() {
    const el = document.querySelector('.offer-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

window.addEventListener('resize', () => {
    const container = document.getElementById('globe-container');
    if (!container || !camera || !renderer || !composer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);

    if (miniMapUAE) miniMapUAE.invalidateSize();
    if (miniMapRAK) miniMapRAK.invalidateSize();
});

function loadUAEGeoJsonAndInitMiniMaps() {
    if (uaeGeoJsonCache) {
        initMiniMaps(uaeGeoJsonCache);
        return;
    }

    const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/ARE.geo.json';
    fetch(url)
        .then(res => res.json())
        .then(data => {
            uaeGeoJsonCache = data;
            initMiniMaps(data);
        })
        .catch(() => { /* ignore */ });
}

function initMiniMaps(uaeGeo) {
    const uaeEl = document.getElementById('uae-mini-map');
    const rakEl = document.getElementById('rak-mini-map');
    if (!uaeEl || !rakEl) return;

    if (typeof L === 'undefined') return;

    if (!miniMapUAE) {
        miniMapUAE = L.map(uaeEl, {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false
        });

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(miniMapUAE);
    }

    let rakMapLayer = null;
    let rakMapStyle = 'satellite';

    if (!miniMapRAK) {
        miniMapRAK = L.map(rakEl, {
            zoomControl: true,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            boxZoom: true,
            keyboard: true,
            tap: true
        });


        rakMapLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(miniMapRAK);
    }


    const rakToggleBtn = document.getElementById('rak-map-toggle');
    if (rakToggleBtn) {
        rakToggleBtn.addEventListener('click', () => {
            if (miniMapRAK && rakMapLayer) {
                miniMapRAK.removeLayer(rakMapLayer);
                if (rakMapStyle === 'satellite') {
                    rakMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(miniMapRAK);
                    rakMapStyle = 'streets';
                    rakToggleBtn.textContent = 'خريطة الأقمار';
                } else {
                    rakMapLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    }).addTo(miniMapRAK);
                    rakMapStyle = 'satellite';
                    rakToggleBtn.textContent = 'خريطة الشوارع';
                }
            }
        });
    }

    if (miniMapUAEGeoLayer) {
        miniMapUAE.removeLayer(miniMapUAEGeoLayer);
        miniMapUAEGeoLayer = null;
    }
    if (miniMapRAKGeoLayer) {
        miniMapRAK.removeLayer(miniMapRAKGeoLayer);
        miniMapRAKGeoLayer = null;
    }

    const geoStyle = {
        color: '#ff2b2b',
        weight: 2,
        fillColor: '#ff2b2b',
        fillOpacity: 0.25
    };

    const uaeLayerUAE = L.geoJSON(uaeGeo, { style: geoStyle }).addTo(miniMapUAE);
    const uaeLayerRAK = L.geoJSON(uaeGeo, { style: geoStyle }).addTo(miniMapRAK);
    miniMapUAEGeoLayer = uaeLayerUAE;
    miniMapRAKGeoLayer = uaeLayerRAK;


    miniMapUAE.fitBounds(uaeLayerUAE.getBounds().pad(0.1));


    miniMapRAK.setView([RAK_POINT.lat, RAK_POINT.lon], 9);

    addLandmarks(miniMapUAE, true);
    addLandmarks(miniMapRAK, false);
}

function addLandmarks(mapInstance, showAll) {
    if (!mapInstance) return;


    if (mapInstance.__landmarkLayer) {
        mapInstance.removeLayer(mapInstance.__landmarkLayer);
        mapInstance.__landmarkLayer = null;
    }

    const layer = L.layerGroup();

    const landmarks = [
        { name: 'أبوظبي', lat: 24.4539, lon: 54.3773, color: '#ff2b2b' },
        { name: 'دبي', lat: 25.2048, lon: 55.2708, color: '#ff2b2b' },
        { name: 'الشارقة', lat: 25.3463, lon: 55.4209, color: '#ff2b2b' },
        { name: 'عجمان', lat: 25.4052, lon: 55.5136, color: '#ff2b2b' },
        { name: 'أم القيوين', lat: 25.5647, lon: 55.5552, color: '#ff2b2b' },
        { name: 'الفجيرة', lat: 25.1288, lon: 56.3265, color: '#ff2b2b' },
        { name: 'رأس الخيمة', lat: RAK_POINT.lat, lon: RAK_POINT.lon, color: '#4fc3f7' }
    ];

    for (const lm of landmarks) {
        if (!showAll && lm.name !== 'رأس الخيمة') continue;

        let html;
        if (lm.name === 'رأس الخيمة') {

            html = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="background: rgba(79, 195, 247, 0.9); color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: bold; text-shadow: none; border: 1px solid rgba(255,255,255,0.3); margin-bottom: 2px;">رأس الخيمة</div>
                    <div style="width:12px;height:12px;border-radius:50%;background:${lm.color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>
                </div>
            `;
        } else {

            html = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div style="background: rgba(255, 43, 43, 0.9); color: white; padding: 1px 4px; border-radius: 6px; font-size: 7px; font-weight: bold; text-shadow: none; border: 1px solid rgba(255,255,255,0.3); margin-bottom: 1px; position: relative;">
                        ${lm.name}
                        <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-top: 4px solid rgba(255, 43, 43, 0.9);"></div>
                    </div>
                    <div style="width:8px;height:8px;border-radius:50%;background:${lm.color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>
                </div>
            `;
        }

        const iconSize = lm.name === 'رأس الخيمة' ? [60, 30] : [10, 10];
        const iconAnchor = lm.name === 'رأس الخيمة' ? [30, 25] : [5, 5];

        const icon = L.divIcon({ className: '', html, iconSize, iconAnchor });

        const m = L.marker([lm.lat, lm.lon], { icon }).addTo(layer);
    }

    layer.addTo(mapInstance);
    mapInstance.__landmarkLayer = layer;
}