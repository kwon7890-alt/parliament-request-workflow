const canvas = document.querySelector("#aiScene");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function markFallback() { canvas.dataset.renderer = "css-fallback"; canvas.dataset.motion = "static"; }
async function start() {
  try {
    const THREE = await import("./lib/three.module.js");
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    camera.position.set(0, .1, 7.1);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setClearColor(0x000000, 0);
    const group = new THREE.Group(); group.position.set(.6, .25, 0); scene.add(group);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 2), new THREE.MeshPhysicalMaterial({ color: 0x2abdc2, emissive: 0x0d3f67, emissiveIntensity: 1.3, metalness: .28, roughness: .22, transparent: true, opacity: .72, clearcoat: 1 }));
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.56, 1), new THREE.MeshBasicMaterial({ color: 0x78e4e0, wireframe: true, transparent: true, opacity: .24 }));
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.05, .012, 8, 140), new THREE.MeshBasicMaterial({ color: 0x89aaff, transparent: true, opacity: .48 })), ringB = ringA.clone(); ringA.rotation.x = 1.1; ringA.rotation.y = .28; ringB.rotation.x = .4; ringB.rotation.y = 1.25; group.add(core, shell, ringA, ringB);
    const count = 680, positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) { const radius = 2.2 + Math.random() * 2.1, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1); positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta); positions[index * 3 + 1] = radius * Math.cos(phi); positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta); }
    const particlesGeometry = new THREE.BufferGeometry(); particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3)); const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0xb8d8ff, size: .025, transparent: true, opacity: .7, sizeAttenuation: true })); group.add(particles);
    scene.add(new THREE.AmbientLight(0x6e8dff, 1.7)); const light = new THREE.PointLight(0x5ee7d8, 8, 16); light.position.set(2.5, 2.4, 3.2); scene.add(light);
    const pointer = { x: 0, y: 0 }, neutralScale = new THREE.Vector3(1, 1, 1);
    canvas.addEventListener("pointermove", (event) => { const rect = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width - .5) * .55; pointer.y = ((event.clientY - rect.top) / rect.height - .5) * .35; });
    canvas.addEventListener("pointerleave", () => { pointer.x = 0; pointer.y = 0; }); canvas.addEventListener("answer-pulse", () => { core.scale.setScalar(1.22); shell.material.opacity = .52; });
    function resize() { const width = canvas.clientWidth || 1, height = canvas.clientHeight || 1; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(canvas); resize(); const clock = new THREE.Clock();
    function render() { const elapsed = clock.getElapsedTime(); if (!reducedMotion) { group.rotation.y += .0017; shell.rotation.x -= .0011; ringA.rotation.z += .0021; ringB.rotation.z -= .0015; group.rotation.x += (pointer.y - group.rotation.x) * .025; group.position.x += (.6 + pointer.x - group.position.x) * .025; core.position.y = Math.sin(elapsed * .75) * .07; core.scale.lerp(neutralScale, .055); shell.material.opacity += (.24 - shell.material.opacity) * .05; } renderer.render(scene, camera); canvas.dataset.frame = String((Number(canvas.dataset.frame) || 0) + 1); if (!reducedMotion) requestAnimationFrame(render); }
    canvas.dataset.renderer = "three-webgl"; canvas.dataset.library = "three@0.187.0"; canvas.dataset.motion = reducedMotion ? "static" : "animated"; render();
  } catch (error) { markFallback(); console.warn("Three.js 장면을 시작하지 못해 정적 배경으로 표시합니다.", error); }
}
start();

