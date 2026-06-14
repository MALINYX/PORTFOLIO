/* ============================================================
   MALINYX · ECS WIREFRAME HERO VIEWER
   Cold technical inspection chamber embedded in the warm
   Studio homepage. EdgesGeometry (NOT WireframeGeometry).
   Drag-rotate 360, slow idle auto-rotate, no pan, no zoom,
   polar clamped, damping, reduced-motion + WebGL fallback.

   NOTE: contains a TEMPORARY azimuth debug readout for tuning
   startAzimuthDeg. Set CFG.debugAzimuth = false (and the value
   is frozen) before shipping.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CFG = {
  lineColor:        0xdce5eb,
  occlusionFill:    0x0b1119,   // near-invisible solid so edges read front-from-back
  opacity:          0.86,       // legibility bump (0.84-0.88 band)
  fillOpacity:      0.74,       // 0.72-0.76 band — lets edges read cleaner
  thresholdDesktop: 25,
  thresholdMobile:  40,
  autoRotateSpeed:  0.30,
  startAzimuthDeg:  130,        // FROZEN — opens on clean front three-quarter (eye-tuned from render sheet)
  framing:          0.88,       // slightly more model presence
  bg:               0x071018,   // cold inspection chamber ground
  debugAzimuth:     false,      // production: no on-screen azimuth readout
};

const el = document.getElementById('ecsViewer');
if (el) {
  const segLabel = document.getElementById('ecsSeg');
  const dbg = document.getElementById('ecsAz');

  const isLowPerf = () =>
    matchMedia('(max-width:760px), (pointer:coarse)').matches ||
    (navigator.connection && navigator.connection.saveData === true);
  const THRESH = isLowPerf() ? CFG.thresholdMobile : CFG.thresholdDesktop;

  const webglOK = () => {
    try { const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
    catch (e) { return false; }
  };

  if (webglOK()) initViewer();
  // else: static fallback image stays visible, nothing else to do.

  function initViewer() {
    let raf = null, running = false;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);   // transparent -> CSS chamber bg shows through
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.30;
    controls.maxPolarAngle = Math.PI * 0.70;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = CFG.autoRotateSpeed;
    controls.rotateSpeed = 0.7;

    renderer.domElement.addEventListener('pointerdown', () => {
      controls.autoRotate = false; el.classList.add('dragging');
    });
    addEventListener('pointerup', () => {
      el.classList.remove('dragging');
      if (!reduceMotion) controls.autoRotate = true;
    });

    function sizeToEl() {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    new GLTFLoader().load(el.dataset.model, (gltf) => {
      const root = new THREE.Group();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry;

        // occlusion fill — makes it a SOLID inspected object, not a see-through scribble
        root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: CFG.occlusionFill, transparent: true, opacity: CFG.fillOpacity,
          polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        })));

        // primary edges
        const edges = new THREE.EdgesGeometry(geo, THRESH);
        const segCount = edges.attributes.position.count / 2;
        root.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: CFG.lineColor, transparent: true, opacity: CFG.opacity,
        })));

        if (segLabel) segLabel.textContent =
          `EDGES / ${THRESH}\u00B0 \u00B7 ${segCount.toLocaleString()} SEGMENTS`;
      });

      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);
      scene.add(root);

      const r = box.getSize(new THREE.Vector3()).length() / 2;
      const az = THREE.MathUtils.degToRad(CFG.startAzimuthDeg);
      const dist = r / Math.sin(THREE.MathUtils.degToRad(34 / 2)) * (1 / CFG.framing) * 0.75;
      camera.position.set(Math.sin(az) * dist, r * 0.18, Math.cos(az) * dist);
      controls.target.set(0, 0, 0);
      controls.update();

      el.classList.add('live');
      sizeToEl(); start();
    }, undefined, (err) => {
      console.warn('[ECS viewer] model load failed; static still retained', err);
    });

    function loop() {
      if (!running) return;
      controls.update();
      renderer.render(scene, camera);
      // TEMPORARY azimuth readout — remove with CFG.debugAzimuth=false once frozen
      if (CFG.debugAzimuth && dbg) {
        let a = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle());
        if (a < 0) a += 360;
        dbg.textContent = `AZ ${a.toFixed(1)}\u00B0`;
      }
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!running) { running = true; loop(); } }
    function stop()  { running = false; if (raf) cancelAnimationFrame(raf); }

    const io = new IntersectionObserver((es) => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: .05 });
    io.observe(el);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    addEventListener('resize', sizeToEl);
    sizeToEl();
  }
}
