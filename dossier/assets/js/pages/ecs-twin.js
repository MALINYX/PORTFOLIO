/* MALINYX — ECS twin · assets/js/pages/ecs-twin.js · Rev A 2026-10-02 (DESIGN-SPEC §7.6 ECS, P11)
   LAB: ECS.glb as a matte clay solid (#2B3239).
   INVESTIGATION: the same model, camera and rotation as EdgesGeometry lines, with a live segment
   counter. N = edges.attributes.position.count / 2 is READ AT RUNTIME — never hard-coded.
   The poster still is the LCP and the fallback. The model loads on idle after `load`, only when
   the stage is within 200 px of the viewport. The render loop pauses off-screen and on hidden tabs.
   Callouts are pinned in 3D: anchors are projected every frame; a feature facing away from the
   camera gets an outlined anchor and a dashed leader (hidden-line convention). Captions never move. */
const stage = document.getElementById('ecs-stage');
const host = stage && stage.querySelector('[data-twin]');
if (host) init();

function init() {
  const root = document.documentElement;
  const fig = stage.closest('figure');
  const motionOK = () => root.classList.contains('motion-ok');
  const modeNow = () => (fig && fig.dataset.viewOverride) || root.dataset.reality || 'lab';
  const lowPerf = matchMedia('(max-width:760px), (pointer:coarse)').matches ||
    !!(navigator.connection && navigator.connection.saveData === true);
  const THR = lowPerf ? 40 : 25;
  document.querySelectorAll('[data-ecs-thr]').forEach(e => { e.textContent = THR + '°'; });

  const webgl = () => {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  };
  if (!webgl()) { stage.classList.add('twin-off'); return; }

  let started = false;
  const go = () => {
    if (started) return; started = true;
    boot().catch(err => { console.warn('[ECS twin] model not loaded; the still stays.', err); stage.classList.add('twin-off'); });
  };
  const whenNear = () => {
    if (!('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '200px' });
    io.observe(stage);
  };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(whenNear, { timeout: 2500 }) : setTimeout(whenNear, 400));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });

  async function boot() {
    const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
    ]);
    const gltf = await new GLTFLoader().loadAsync(host.dataset.model);
    let geo = null;
    gltf.scene.traverse(o => { if (o.isMesh && !geo) geo = o.geometry; });
    if (!geo) throw new Error('no mesh in model');
    if (!geo.attributes.normal) geo.computeVertexNormals(); // the GLB ships without normals

    /* renderer: alpha so the sheet's paper shows through; DPR ≤ 1.5; sRGB out; no tone mapping */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = 'twin-canvas';
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', host.dataset.label || 'ECS model');
    if (host.dataset.describedby) canvas.setAttribute('aria-describedby', host.dataset.describedby);
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.01, 100);
    scene.add(camera);
    /* lights travel with the camera, so the clay reads like a turntable under fixed studio lights */
    const hemi = new THREE.HemisphereLight(0xF4EEE4, 0xA89F91, 2.2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-2, 2.5, 1.5); key.target.position.set(0, 0, -5);
    camera.add(key); camera.add(key.target);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(3, 1, -4); rim.target.position.set(0, 0, -5);
    camera.add(rim); camera.add(rim.target);

    const clay = new THREE.MeshStandardMaterial({ color: 0x2B3239, roughness: 0.85, metalness: 0 });
    const fill = new THREE.MeshBasicMaterial({ color: 0x12110F, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(geo, clay);
    model.add(mesh);
    const edgesGeo = new THREE.EdgesGeometry(geo, THR);
    const N = edgesGeo.attributes.position.count / 2; // read at runtime
    const lineMat = new THREE.LineBasicMaterial({ color: 0xE8E0D2, transparent: true, opacity: 0.86 });
    const lines = new THREE.LineSegments(edgesGeo, lineMat);
    lines.visible = false;
    model.add(lines);

    const box = new THREE.Box3().setFromObject(model);
    const ctr = box.getCenter(new THREE.Vector3());
    model.position.sub(ctr);
    scene.add(model);
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const FRAMING = 0.88, AZ = THREE.MathUtils.degToRad(130);
    const dist = r / Math.sin(THREE.MathUtils.degToRad(34 / 2)) * (1 / FRAMING) * 0.75;
    camera.position.set(Math.sin(AZ) * dist, r * 0.18, Math.cos(AZ) * dist);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;
    controls.minPolarAngle = Math.PI * 0.30;
    controls.maxPolarAngle = Math.PI * 0.70;
    controls.autoRotateSpeed = 0.30; // the live viewer's owner-tuned value
    controls.autoRotate = motionOK();
    controls.update();
    canvas.style.touchAction = 'pan-y'; // a vertical swipe still scrolls the page on phones

    /* ---------- size ---------- */
    let W = 0, H = 0;
    const size = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (w === W && h === H)) return false;
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      return true;
    };
    size();
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (size()) kick(); }).observe(host);
    else addEventListener('resize', () => { if (size()) kick(); });

    /* ---------- 3D-pinned callouts ---------- */
    const anchors = JSON.parse(host.dataset.anchors || '[]').map(a => ({
      ...a,
      wp: new THREE.Vector3(a.p[0] - ctr.x, a.p[1] - ctr.y, a.p[2] - ctr.z),
      n: new THREE.Vector3(...a.n).normalize(),
      ancs: [...stage.querySelectorAll(`.anc[data-k="${a.k}"]`)],
      leads: [...stage.querySelectorAll(`.leader[data-k="${a.k}"]`)],
      hides: [...stage.querySelectorAll(`.leader-h[data-k="${a.k}"]`)],
    }));
    const v = new THREE.Vector3(), toCam = new THREE.Vector3();
    const route = (ax, ay, cx, cy) => { // one 45° elbow, or one 90° elbow when steep
      const dx = ax - cx, dy = ay - cy;
      if (Math.abs(dx) >= Math.abs(dy)) return `${ax.toFixed(1)},${ay.toFixed(1)} ${(cx + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy))).toFixed(1)},${cy} ${cx},${cy}`;
      return `${ax.toFixed(1)},${ay.toFixed(1)} ${ax.toFixed(1)},${cy} ${cx},${cy}`;
    };
    const placeAnchors = () => {
      for (const a of anchors) {
        v.copy(a.wp).project(camera);
        const x = (v.x + 1) / 2, y = (1 - v.y) / 2;
        toCam.copy(camera.position).sub(a.wp);
        const back = a.n.dot(toCam) < 0;
        const ax = x * 1000, ay = y * 750; // overlay viewBox 0 0 1000 750 (the stage is 4:3)
        a.ancs.forEach(el => {
          el.style.setProperty('--ax', (x * 100).toFixed(2) + '%');
          el.style.setProperty('--ay', (y * 100).toFixed(2) + '%');
          el.classList.toggle('is-back', back);
        });
        const pl = (el) => { const [cx, cy] = el.dataset.c.split(',').map(Number); el.setAttribute('points', route(ax, ay, cx, cy)); };
        a.leads.forEach(el => { pl(el); el.classList.toggle('is-off', back); });
        a.hides.forEach(el => { pl(el); el.classList.toggle('is-off', !back); });
      }
    };

    /* ---------- realities ---------- */
    const counters = [...document.querySelectorAll('[data-ecs-count]')];
    const fmt = (n) => Math.round(n).toLocaleString('en-GB');
    let mode = null, reveal = null;
    const setCount = (n) => counters.forEach(c => { c.textContent = fmt(n); });
    const startReveal = (delay) => {
      if (!motionOK()) { edgesGeo.setDrawRange(0, Infinity); setCount(N); reveal = null; return; }
      edgesGeo.setDrawRange(0, 0); setCount(0);
      reveal = { t0: performance.now() + delay, dur: 900 };
      kick();
    };
    const stepReveal = (now) => {
      if (!reveal) return;
      const p = Math.max(0, Math.min(1, (now - reveal.t0) / reveal.dur));
      const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const segs = Math.round(N * e);
      edgesGeo.setDrawRange(0, segs * 2);
      setCount(segs);
      if (p >= 1) { edgesGeo.setDrawRange(0, Infinity); setCount(N); reveal = null; }
    };
    const setMode = (m, delay = 0) => {
      if (m !== 'investigation') m = 'lab';
      if (m === mode) return;
      mode = m;
      const inv = m === 'investigation';
      mesh.material = inv ? fill : clay;
      lines.visible = inv;
      stage.dataset.twinMode = m;
      if (inv) startReveal(delay);
      renderNow();
    };

    /* ---------- loop: runs only while visible and something moves ---------- */
    let raf = 0, visible = true, interacting = false, settleUntil = 0, resumeAt = 0;
    const renderNow = () => { controls.update(); renderer.render(scene, camera); placeAnchors(); };
    const busy = (now) => controls.autoRotate || interacting || reveal || now < settleUntil;
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (!controls.autoRotate && motionOK() && !interacting && resumeAt && now > resumeAt) { controls.autoRotate = true; resumeAt = 0; }
      stepReveal(now);
      renderNow();
      updateAz();
      if (busy(now) || resumeAt) raf = requestAnimationFrame(loop);
    }
    function kick(ms = 0) {
      settleUntil = Math.max(settleUntil, performance.now() + ms);
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    }
    controls.addEventListener('start', () => { interacting = true; controls.autoRotate = false; resumeAt = 0; stage.classList.add('is-dragging'); kick(); });
    controls.addEventListener('end', () => {
      interacting = false; stage.classList.remove('is-dragging');
      if (motionOK()) resumeAt = performance.now() + 2500;
      kick(1500);
    });
    controls.addEventListener('change', () => kick(400));

    /* azimuth readout (the real camera azimuth, degrees) */
    const azEls = [...document.querySelectorAll('[data-ecs-az]')];
    let lastAz = null;
    const updateAz = () => {
      if (!azEls.length) return;
      let d = THREE.MathUtils.radToDeg(Math.atan2(camera.position.x, camera.position.z));
      d = Math.round((d + 360) % 360);
      if (d !== lastAz) { lastAz = d; azEls.forEach(e => { e.textContent = String(d).padStart(3, '0'); }); }
    };

    /* keyboard: ← / → rotate 15° */
    const sph = new THREE.Spherical(), off = new THREE.Vector3();
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      controls.autoRotate = false;
      if (motionOK()) resumeAt = performance.now() + 4000;
      off.copy(camera.position).sub(controls.target);
      sph.setFromVector3(off);
      sph.theta += THREE.MathUtils.degToRad(e.key === 'ArrowLeft' ? -15 : 15);
      off.setFromSpherical(sph);
      camera.position.copy(controls.target).add(off);
      camera.lookAt(controls.target);
      renderNow(); updateAz();
      kick(600);
    });

    /* pause off-screen and on hidden tabs */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) kick(); }), { threshold: 0 }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

    /* motion switch (footer) flips auto-rotate live */
    new MutationObserver(() => {
      const ok = motionOK();
      if (!ok) { controls.autoRotate = false; resumeAt = 0; if (reveal) { edgesGeo.setDrawRange(0, Infinity); setCount(N); reveal = null; } }
      else if (!interacting) controls.autoRotate = true;
      kick(200);
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    /* reality: fired inside the View Transition callback, so the new material renders synchronously;
       the edge reveal starts after the 680 ms cut */
    document.addEventListener('reality:change', () => setMode(modeNow(), 700));
    if (fig) new MutationObserver(() => setMode(modeNow(), 0)).observe(fig, { attributes: true, attributeFilter: ['data-view-override'] });

    window.ecsTwin = {
      setReality: (rl) => setMode(rl, 700),
      get segments() { return N; },
      get threshold() { return THR; },
    };

    setMode(modeNow(), 250);
    renderNow();
    stage.classList.add('twin-live');
    // re-plot the leaders now that their anchors exist
    stage.classList.remove('is-plotted'); void stage.offsetWidth;
    requestAnimationFrame(() => stage.classList.add('is-plotted'));
    kick(300);
  }
}
