/* MALINYX V2 — AXON ring dial (D-037). The one level-3 interaction registered for AXON (data.py INTERACTIONS).
   The lamp in the ECS wireframe language (EdgesGeometry over an occluding fill, OrbitControls), driven by ONE ring dial:
   θ 0–270°, snapping at the three detents read from the pose table (STOWED, TASK, AMBIENT).
   Geometry: RING-LAMP's step-4 parts joined per motion group and decimated (axon.glb, positions only).
   Motion: RING-LAMP's pose table (axon-poses.json: per group, per degree, a quaternion and a translation, glTF frame).
   Opening as ECS: the poster is the first paint; the model loads on idle once the stage is near the viewport; the canvas fades
   in and the edges draw in; a slow turn follows and stops at the first touch.
   Reduced motion: no turn, no draw-in, the dial changes state without a tween. No WebGL or no model: the poster stays and the
   sweep video shows (.axon-off). Keyboard on the dial: ← → turn the ring 5° (Shift 15°), Page Up / Page Down jump between
   detents, Home / End go to the end stops. */
const stage = document.querySelector('[data-axon]');
if (stage) init();

function init() {
  const root = document.documentElement;
  const host = stage.querySelector('[data-host]');
  const dial = document.querySelector('[data-axon-dial]');
  const knob = dial && dial.querySelector('[role="slider"]');
  const index = dial && dial.querySelector('[data-index]');
  const readout = document.querySelectorAll('[data-axon-read]');
  const chips = [...document.querySelectorAll('[data-axon-go]')];
  const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !RMQ.matches && !root.classList.contains('qa') && !/[?&]motion=off/.test(location.search);
  const low = matchMedia('(max-width:760px), (pointer:coarse)').matches || !!(navigator.connection && navigator.connection.saveData);
  const THR = low ? 40 : 25;
  const SPAN = [Number(stage.dataset.min || 0), Number(stage.dataset.max || 270)];
  const DET = JSON.parse(stage.dataset.detents || '{}');  // name -> θ, from the pose table
  const detents = Object.entries(DET).sort((a, b) => a[1] - b[1]);
  const A0 = -135, SWEEP = 270;                            // the dial's face: θ 0 at −135°, θ 270 at +135° (clockwise)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let theta = clamp(Number(stage.dataset.start || 0), SPAN[0], SPAN[1]);
  let apply = () => {};                                    // set by boot() once the model is in
  let tween = null;

  const off = () => { stage.classList.add('axon-off'); if (dial) dial.classList.add('axon-off'); };
  const webgl = () => {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  };
  if (!webgl()) { off(); return; }

  /* ---------- the dial: state, ARIA, readout ---------- */
  const near = (t) => detents.reduce((b, d) => (Math.abs(d[1] - t) < Math.abs(b[1] - t) ? d : b), detents[0]);
  const label = (t) => {
    const d = near(t);
    if (Math.abs(d[1] - t) < 0.5) return d[0];
    const lo = [...detents].reverse().find(x => x[1] < t), hi = detents.find(x => x[1] > t);
    return lo && hi ? `between ${lo[0]} and ${hi[0]}` : d[0];
  };
  const show = () => {
    const t = Math.round(theta);
    const txt = `${label(theta)} · ring at ${t}°`;
    if (knob) { knob.setAttribute('aria-valuenow', String(t)); knob.setAttribute('aria-valuetext', txt); }
    if (index) index.setAttribute('transform', `rotate(${A0 + SWEEP * (theta - SPAN[0]) / (SPAN[1] - SPAN[0])} 100 100)`);
    readout.forEach(el => { el.textContent = txt; });
    chips.forEach(c => c.setAttribute('aria-pressed', String(Math.abs(DET[c.dataset.axonGo] - theta) < 0.5)));
  };
  const set = (t) => { theta = clamp(t, SPAN[0], SPAN[1]); show(); apply(theta); };
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const go = (t) => {                                       // a jump: tweened through every pose in between, unless reduced
    t = clamp(t, SPAN[0], SPAN[1]);
    if (!motionOK() || Math.abs(t - theta) < 0.5) { tween = null; set(t); return; }
    tween = { a: theta, b: t, t0: performance.now(), dur: clamp(Math.abs(t - theta) * 6, 250, 1100) };
    kickTween();
  };
  let tr = 0;
  const kickTween = () => { if (!tr) tr = requestAnimationFrame(stepTween); };
  function stepTween(now) {
    tr = 0;
    if (!tween) return;
    const p = clamp((now - tween.t0) / tween.dur, 0, 1);
    set(tween.a + (tween.b - tween.a) * ease(p));
    if (p < 1) kickTween(); else tween = null;
  }
  const snap = () => { const d = near(theta); if (Math.abs(d[1] - theta) <= 12) go(d[1]); };
  show();

  if (knob) {
    knob.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 15 : 5;
      let t = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = theta + step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = theta - step;
      else if (e.key === 'PageUp') { const d = detents.find(x => x[1] > theta + 0.5); t = d ? d[1] : SPAN[1]; }
      else if (e.key === 'PageDown') { const d = [...detents].reverse().find(x => x[1] < theta - 0.5); t = d ? d[1] : SPAN[0]; }
      else if (e.key === 'Home') t = SPAN[0];
      else if (e.key === 'End') t = SPAN[1];
      if (t === null) return;
      e.preventDefault();
      stopTurn();
      if (e.key.startsWith('Arrow')) { tween = null; set(t); const d = near(theta); if (Math.abs(d[1] - theta) <= 2) set(d[1]); }
      else go(t);
    });
    /* drag round the dial: the change of the pointer's angle about the dial's centre turns the ring */
    let last = null;
    const ang = (e) => { const r = dial.querySelector('svg').getBoundingClientRect();
      return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; };
    knob.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      knob.setPointerCapture(e.pointerId); last = ang(e); tween = null; stopTurn(); dial.classList.add('is-turning'); e.preventDefault();
    });
    knob.addEventListener('pointermove', (e) => {
      if (last === null) return;
      const a = ang(e); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = a;
      let t = clamp(theta + d * (SPAN[1] - SPAN[0]) / SWEEP, SPAN[0], SPAN[1]);
      const n = near(t); if (Math.abs(n[1] - t) < 3) t = n[1];     // the detent's click, felt while turning
      set(t);
    });
    const up = () => { if (last === null) return; last = null; dial.classList.remove('is-turning'); snap(); resumeLater(4000); };
    knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
  }
  chips.forEach(c => c.addEventListener('click', () => { stopTurn(); go(DET[c.dataset.axonGo]); resumeLater(4000); }));

  /* ---------- the model: loaded on idle once the stage is near ---------- */
  let started = false, stopTurn = () => {}, resumeLater = () => {};
  const start = () => { if (started) return; started = true; boot().catch(err => { console.warn('[AXON] model not loaded; the still stays.', err); off(); }); };
  const whenNear = () => {
    if (!('IntersectionObserver' in window)) return start();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '200px' });
    io.observe(stage);
    setTimeout(() => {   // an observer that never reports (some embedded or background views): measure the stage directly
      const r = stage.getBoundingClientRect();
      if (r.top < innerHeight + 200 && r.bottom > -200) { io.disconnect(); start(); }
    }, 3000);
  };
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(whenNear, { timeout: 2500 }) : setTimeout(whenNear, 400));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });

  async function boot() {
    const [THREE, { GLTFLoader }, { OrbitControls }, poses] = await Promise.all([
      import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'),
      fetch(stage.dataset.poses).then(r => { if (!r.ok) throw new Error('poses ' + r.status); return r.json(); }),
    ]);
    const gltf = await new GLTFLoader().loadAsync(stage.dataset.model);
    const key = (s) => String(s).replace(/\s+/g, '_');
    const P = {};
    for (const [g, arr] of Object.entries(poses.groups)) P[key(g)] = arr;
    const n0 = poses.theta[0], n1 = poses.theta[1], S = poses.stride;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = 'axon-canvas';
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', stage.dataset.label || 'The lamp as a wireframe');
    if (stage.dataset.describedby) canvas.setAttribute('aria-describedby', stage.dataset.describedby);
    host.appendChild(canvas);

    const css = getComputedStyle(stage);
    const col = (v, f) => new THREE.Color((css.getPropertyValue(v) || f).trim());
    const fill = new THREE.MeshBasicMaterial({ color: col('--axon-fill', '#0e0a09'), transparent: true, opacity: 0.92,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const lineMat = new THREE.LineBasicMaterial({ color: col('--axon-line', '#f3ebe0'), transparent: true, opacity: 0.86 });

    let raf = 0, visible = true, interacting = false, settleUntil = 0, ready = false;   // the loop's state; nothing draws until ready
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.005, 50);
    const model = new THREE.Group();
    const nodes = [], edges = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = key(o.name in P ? o.name : (o.parent && o.parent.name) || o.name);
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const node = new THREE.Group();
      node.add(new THREE.Mesh(geo, fill));
      const eg = new THREE.EdgesGeometry(geo, THR);
      node.add(new THREE.LineSegments(eg, lineMat));
      edges.push(eg);
      node.userData.g = P[g] ? g : null;
      model.add(node); nodes.push(node);
    });
    if (!nodes.length) throw new Error('no mesh in the model');
    const segs = edges.reduce((s, e) => s + e.attributes.position.count / 2, 0);   // read at runtime
    document.querySelectorAll('[data-axon-segs]').forEach(e => { e.textContent = Math.round(segs).toLocaleString('en-GB'); });

    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    apply = (t) => {
      const x = clamp(t, n0, n1) - n0, i = Math.min(Math.floor(x), n1 - n0 - 1), f = x - i;
      for (const nd of nodes) {
        const a = nd.userData.g && P[nd.userData.g]; if (!a) continue;
        const o0 = i * S, o1 = (i + 1) * S;
        qa.set(a[o0], a[o0 + 1], a[o0 + 2], a[o0 + 3]); qb.set(a[o1], a[o1 + 1], a[o1 + 2], a[o1 + 3]);
        nd.quaternion.copy(qa).slerp(qb, f);
        nd.position.set(a[o0 + 4] + (a[o1 + 4] - a[o0 + 4]) * f, a[o0 + 5] + (a[o1 + 5] - a[o0 + 5]) * f, a[o0 + 6] + (a[o1 + 6] - a[o0 + 6]) * f);
      }
      kick();
    };

    /* framing: the box over the three detents' poses, so the camera never re-frames while the ring turns */
    const box = new THREE.Box3();
    for (const [, t] of detents) { apply(t); model.updateMatrixWorld(true); box.union(new THREE.Box3().setFromObject(model)); }
    const ctr = box.getCenter(new THREE.Vector3());
    model.position.sub(ctr);
    scene.add(model);
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const AZ = THREE.MathUtils.degToRad(Number(stage.dataset.az || 30)), FRAMING = 0.88;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(34 / 2)) * (1 / FRAMING) * 0.95;   // ECS used 0.75; the lamp is taller than it is wide
    camera.position.set(Math.sin(AZ) * dist, r * 0.18, Math.cos(AZ) * dist);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0, 0);
    controls.enablePan = false; controls.enableZoom = false;
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.7;
    controls.minPolarAngle = Math.PI * 0.30; controls.maxPolarAngle = Math.PI * 0.70;
    controls.update();
    canvas.style.touchAction = 'pan-y';

    let W = 0, H = 0;
    const size = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (w === W && h === H)) return false;
      W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); return true;
    };
    size();
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (size()) kick(); }).observe(host);
    else addEventListener('resize', () => { if (size()) kick(); });

    /* the slow turn: 0.05 rad/s, frame-rate independent; stopped by any touch, resumed after a pause */
    let turning = motionOK(), resumeAt = 0, lastT = 0;
    stopTurn = () => { turning = false; resumeAt = 0; };
    resumeLater = (ms) => { if (motionOK()) { resumeAt = performance.now() + ms; kick(); } };
    const sph = new THREE.Spherical(), v = new THREE.Vector3();
    const orbit = (rad) => {
      v.copy(camera.position).sub(controls.target); sph.setFromVector3(v); sph.theta += rad;
      v.setFromSpherical(sph); camera.position.copy(controls.target).add(v); camera.lookAt(controls.target);
    };

    /* the edges draw in, as ECS's twin did (900 ms, after 250 ms); at once under reduced motion */
    let reveal = motionOK() && !document.hidden ? { t0: performance.now() + 250, dur: 900 } : null;   // a background tab gets them whole
    const drawn = (p) => edges.forEach(e => e.setDrawRange(0, p >= 1 ? Infinity : Math.round(e.attributes.position.count / 2 * p) * 2));
    drawn(reveal ? 0 : 1);

    const busy =(now) => turning || interacting || reveal || tween || now < settleUntil || (resumeAt && now < resumeAt + 50);
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
      if (!turning && resumeAt && now > resumeAt && motionOK() && !interacting) { turning = true; resumeAt = 0; }
      if (turning && !interacting) orbit(0.05 * dt);
      if (reveal) { const p = clamp((now - reveal.t0) / reveal.dur, 0, 1); drawn(ease(p)); if (p >= 1) reveal = null; }
      controls.update();
      renderer.render(scene, camera);
      if (busy(now)) raf = requestAnimationFrame(loop); else lastT = 0;
    }
    function kick(ms = 0) {
      settleUntil = Math.max(settleUntil, performance.now() + ms);
      if (!ready) return;
      if (document.hidden) { controls.update(); renderer.render(scene, camera); return; }   // a background tab: one frame, no loop
      if (!raf && visible) raf = requestAnimationFrame(loop);
    }
    controls.addEventListener('start', () => { interacting = true; stopTurn(); stage.classList.add('is-dragging'); kick(); });
    controls.addEventListener('end', () => { interacting = false; stage.classList.remove('is-dragging'); resumeLater(4000); kick(1500); });
    controls.addEventListener('change', () => kick(400));
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); stopTurn(); orbit(THREE.MathUtils.degToRad(e.key === 'ArrowLeft' ? -15 : 15)); kick(600); resumeLater(4000);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) kick(); }), { threshold: 0 }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    RMQ.addEventListener && RMQ.addEventListener('change', () => {
      if (!motionOK()) { stopTurn(); tween = null; if (reveal) { reveal = null; drawn(1); } }
      else turning = true;
      kick(200);
    });

    window.axonViewer = { get segments() { return segs; }, get theta() { return theta; }, get threshold() { return THR; },
      get turning() { return turning; }, get azimuth() { return Math.round(THREE.MathUtils.radToDeg(Math.atan2(camera.position.x, camera.position.z)) * 10) / 10; } };
    ready = true;
    apply(theta);
    stage.classList.add('axon-live');
    kick(300);
  }
}
