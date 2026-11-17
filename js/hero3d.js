/* ============================================================
   3D HERO  (optional)
   A Three.js scene behind the hero text: two turning gears (teamwork),
   a few floating shapes and soft particles. GSAP ScrollTrigger links
   the scene to scrolling.

   How the pieces fit (web3d-integration-patterns, pattern 1):
     3D layer         Three.js scene in a decorative <canvas> inside .hero-bg
     Animation layer  GSAP ScrollTrigger scrubs a plain `state` object.
                      The render loop only reads it, so two libraries
                      never animate the same property.
     UI layer         the existing hero HTML, unchanged, above the canvas

   Rules it follows:
     - Loads only on capable tablet and desktop screens, after the page has loaded
     - Skips reduced-motion users, Save-Data, slow networks and low-memory devices
     - Renders only while the hero is on screen and the tab is visible
     - Cleans up fully (GSAP, observers, GPU memory) when it stops

   Turn it off: add ?3d=off to the address, or set `enabled` to false below.
   Force it on for testing: ?3d=on (still respects reduced motion and WebGL).
   ============================================================ */
(function () {
  'use strict';

  var HERO3D = {
    enabled: true,
    minWidth: 768,          // phones and portrait windows keep the light CSS hero
    maxPixelRatio: 1.5,     // caps GPU work on high-DPI screens
    libs: {
      three:         'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js',
      gsap:          'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
      scrollTrigger: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js'
    }
  };

  /* LAYOUT-START  (plain maths, no Three.js: positions scale with the hero so it looks right on any screen) */
  var FOV = 40;
  var CAM_Z = 16;
  // nx / ny are -1..1 across the visible area; s is the size in "units" (1 unit = 10% of the visible height)
  var FLOATERS = [
    { nx: -0.90, ny:  0.55, z: -1.0, s: 0.55, type: 'ico', tint: 0 },
    { nx: -0.74, ny: -0.15, z:  0.5, s: 0.38, type: 'oct', tint: 1 },
    { nx: -0.93, ny: -0.62, z: -0.5, s: 0.62, type: 'tor', tint: 0 },
    { nx: -0.62, ny:  0.86, z:  0.0, s: 0.30, type: 'oct', tint: 1 },
    { nx:  0.60, ny:  0.84, z: -0.5, s: 0.36, type: 'ico', tint: 1 },
    { nx:  0.12, ny: -0.93, z: -1.0, s: 0.30, type: 'tor', tint: 1 }
  ];
  function viewSize(aspect) {
    var h = 2 * Math.tan(FOV * Math.PI / 360) * CAM_Z;
    return { w: h * aspect, h: h };
  }
  function gearPoints(teeth, rOuter, rInner) {
    var pts = [], pitch = Math.PI * 2 / teeth;
    var steps = [[0, 0], [0.18, 1], [0.42, 1], [0.6, 0]];   // [share of the pitch, 1 = tooth top / 0 = root]
    for (var i = 0; i < teeth; i++) {
      for (var s = 0; s < steps.length; s++) {
        var a = (i + steps[s][0]) * pitch;
        var r = steps[s][1] ? rOuter : rInner;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    return pts;
  }
  function layout(aspect) {
    var v = viewSize(aspect);
    var u = Math.min(v.h, v.w / 1.6) / 10;     // shapes shrink on narrow windows instead of crowding the text
    // big gear peeks in from the right edge; the small one sits under it (centre distance = 2.6 + 1.3 = 3.9 units)
    var big = { teeth: 24, outer: 2.85, inner: 2.35, hole: 0.9, x: v.w / 2 * 0.97, y: v.h / 2 * 0.16 };
    var ang = 262 * Math.PI / 180;
    var small = { teeth: 12, outer: 1.55, inner: 1.05, hole: 0.5, x: big.x + Math.cos(ang) * 3.9 * u, y: big.y + Math.sin(ang) * 3.9 * u };
    var floaters = FLOATERS.map(function (f) {
      return { x: f.nx * v.w / 2, y: f.ny * v.h / 2, z: f.z, s: f.s, type: f.type, tint: f.tint };
    });
    return { v: v, u: u, big: big, small: small, floaters: floaters };
  }
  /* LAYOUT-END */

  /* ---------- Should it run on this device? ---------- */
  function supportsWebGL() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }
  function canRun() {
    if (!HERO3D.enabled) return false;
    var q = location.search;
    if (/[?&]3d=off\b/.test(q)) return false;
    if (!document.getElementById('home')) return false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!supportsWebGL()) return false;
    if (/[?&]3d=on\b/.test(q)) return true;
    if (window.innerWidth < HERO3D.minWidth) return false;
    if (window.innerWidth / window.innerHeight < 1) return false;     // portrait windows keep the light CSS hero
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)[23]g$/.test(c.effectiveType || ''))) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
    return true;
  }

  /* ---------- Load the libraries after the page is done ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureGsap() {
    if (window.gsap && window.ScrollTrigger) return Promise.resolve();
    return loadScript(HERO3D.libs.gsap).then(function () { return loadScript(HERO3D.libs.scrollTrigger); });
  }

  /* ---------- The scene ---------- */
  function init(THREE, hero, bg) {
    var destroyed = false, running = false, inView = false, readyShown = false;
    var raf = 0, lastT = 0, tween = null, io = null, ro = null, mo = null, mq = null;
    var renderer = null, canvas = null;
    var disposables = [];
    function track() { for (var i = 0; i < arguments.length; i++) disposables.push(arguments[i]); }

    var state = { scroll: 0 };                       // 0..1, scrubbed by GSAP while the hero scrolls away
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };      // mouse parallax, eased every frame

    function destroy() {
      if (destroyed) return;
      destroyed = true; running = false;
      cancelAnimationFrame(raf);
      try { if (tween) { if (tween.scrollTrigger) tween.scrollTrigger.kill(); tween.kill(); } } catch (e) { /* ignore */ }
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange); else if (mq.removeListener) mq.removeListener(onMotionChange); }
      for (var i = 0; i < disposables.length; i++) { try { disposables[i].dispose(); } catch (e) { /* ignore */ } }
      try { if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } } catch (e) { /* ignore */ }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      hero.classList.remove('has-3d');
    }

    try {
      canvas = document.createElement('canvas');
      canvas.id = 'hero-3d'; canvas.className = 'hero-3d';
      canvas.setAttribute('aria-hidden', 'true');
      bg.appendChild(canvas);
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); destroy(); });

      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HERO3D.maxPixelRatio));
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(FOV, 1.6, 0.1, 100);
      camera.position.set(0, 0, CAM_Z);
      var world = new THREE.Group();
      scene.add(world);
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      var key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(4, 6, 10);
      scene.add(key);

      /* colours follow the site theme (--accent changes in dark mode) */
      var white = new THREE.Color(0xffffff);
      var accent = new THREE.Color(), tint = new THREE.Color();
      var accentMats = [], tintMats = [];
      var readTheme = function () {
        var raw = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim();
        if (!/^(#|rgb|hsl)/i.test(raw)) raw = '#D41367';
        accent.set(raw);
        tint.copy(accent).lerp(white, 0.5);
      };
      readTheme();

      var solid = function (useTint, opacity, rough, metal) {
        var m = new THREE.MeshStandardMaterial({ color: useTint ? tint : accent, roughness: rough, metalness: metal, flatShading: true, transparent: true, opacity: opacity });
        track(m); (useTint ? tintMats : accentMats).push(m);
        return m;
      };
      var addEdges = function (mesh, geo, threshold) {
        var eg = new THREE.EdgesGeometry(geo, threshold), em = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.75 });
        mesh.add(new THREE.LineSegments(eg, em));
        track(eg, em); tintMats.push(em);
      };

      /* gears */
      var makeGear = function (spec) {
        var pts = gearPoints(spec.teeth, spec.outer, spec.inner);
        var shape = new THREE.Shape();
        shape.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
        shape.closePath();
        var hole = new THREE.Path();
        hole.absarc(0, 0, spec.hole, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        var geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false, curveSegments: 16 });
        geo.center();
        track(geo);
        var mesh = new THREE.Mesh(geo, solid(false, 0.5, 0.55, 0.2));
        addEdges(mesh, geo, 25);
        var pivot = new THREE.Group();            // the pivot holds the tilt, the mesh spins inside it
        pivot.rotation.set(-0.35, -0.5, 0);
        pivot.add(mesh);
        world.add(pivot);
        return { pivot: pivot, mesh: mesh };
      };
      var L = layout(1.6);
      var gearBig = makeGear(L.big), gearSmall = makeGear(L.small);

      /* floating shapes (one shared geometry per type) */
      var geos = {
        ico: new THREE.IcosahedronGeometry(1, 0),
        oct: new THREE.OctahedronGeometry(1, 0),
        tor: new THREE.TorusGeometry(1, 0.32, 10, 28)
      };
      track(geos.ico, geos.oct, geos.tor);
      var floaters = L.floaters.map(function (f) {
        var mesh = new THREE.Mesh(geos[f.type], solid(!!f.tint, 0.65, 0.4, 0.1));
        addEdges(mesh, geos[f.type], 1);
        world.add(mesh);
        return { mesh: mesh, baseY: 0 };
      });

      /* soft particles (positions stored as -1..1 and scaled to the view) */
      var seed = 7;
      var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      var pos = new Float32Array(120 * 3);
      for (var p = 0; p < pos.length; p++) pos[p] = rnd() * 2 - 1;
      var pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var pMat = new THREE.PointsMaterial({ color: tint, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false });
      track(pGeo, pMat); tintMats.push(pMat);
      var points = new THREE.Points(pGeo, pMat);
      world.add(points);

      var applyLayout = function (aspect) {
        L = layout(aspect);
        var u = L.u;
        gearBig.pivot.position.set(L.big.x, L.big.y, -1);       gearBig.pivot.scale.setScalar(u);
        gearSmall.pivot.position.set(L.small.x, L.small.y, -1); gearSmall.pivot.scale.setScalar(u);
        for (var i = 0; i < floaters.length; i++) {
          var s = L.floaters[i];
          floaters[i].baseY = s.y;
          floaters[i].mesh.position.set(s.x, s.y, s.z * u);
          floaters[i].mesh.scale.setScalar(s.s * u);
        }
        points.scale.set(L.v.w / 2, L.v.h / 2, 3);
      };

      /* one frame: reads `state` (GSAP) and `pointer`, never writes to them */
      var draw = function (t) {
        lastT = t;
        var spin = t * 0.15 + state.scroll * 2.2;
        gearBig.mesh.rotation.z = spin;
        gearSmall.mesh.rotation.z = -spin * 2 + Math.PI / 12;   // 24 teeth : 12 teeth turns twice as fast, opposite way
        for (var i = 0; i < floaters.length; i++) {
          var f = floaters[i].mesh, dir = i % 2 ? 1 : -1;
          f.rotation.x = t * 0.20 * dir + i;
          f.rotation.y = t * 0.27 + i * 0.7;
          f.position.y = floaters[i].baseY + Math.sin(t * 0.6 + i * 1.3) * L.u * 0.15;
        }
        points.rotation.y = t * 0.02;
        world.rotation.y = pointer.x * 0.18 + state.scroll * 0.5;
        world.rotation.x = pointer.y * 0.10 + state.scroll * 0.15;
        world.position.y = state.scroll * L.v.h * 0.10;
        renderer.render(scene, camera);
        if (!readyShown) {                                       // fade in after the first real frame
          readyShown = true;
          canvas.classList.add('is-ready');
          hero.classList.add('has-3d');
        }
      };
      var frame = function (now) {
        if (!running || destroyed) return;
        raf = requestAnimationFrame(frame);
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        try { draw(now / 1000); } catch (e) { console.warn('3D hero stopped:', e); destroy(); }
      };
      var renderOnce = function () { if (!running && !destroyed) draw(lastT); };
      var setRunning = function () {
        var on = inView && !document.hidden && !destroyed;
        if (on === running) return;
        running = on;
        if (on) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf);
      };

      /* size follows the hero, not the window */
      var resize = function () {
        if (destroyed) return;
        var w = hero.clientWidth, h = hero.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        applyLayout(w / h);
        renderOnce();
      };
      var onPointer = function (e) {
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      var onVisibility = function () { setRunning(); };
      var onMotionChange = function (e) { if (e.matches) destroy(); };
      var recolor = function () {
        readTheme();
        accentMats.forEach(function (m) { m.color.copy(accent); });
        tintMats.forEach(function (m) { m.color.copy(tint); });
        renderOnce();
      };

      /* animation layer: GSAP scrubs `state.scroll` from 0 to 1 while the hero scrolls out of view */
      if (window.gsap && window.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        tween = window.gsap.to(state, {
          scroll: 1, ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 }
        });
      }

      resize();
      if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(hero); }
      else window.addEventListener('resize', resize);

      io = new IntersectionObserver(function (entries) { inView = entries[entries.length - 1].isIntersecting; setRunning(); });
      io.observe(hero);
      document.addEventListener('visibilitychange', onVisibility);

      if (window.matchMedia) {
        if (window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onPointer, { passive: true });
        mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq.addEventListener) mq.addEventListener('change', onMotionChange); else if (mq.addListener) mq.addListener(onMotionChange);
      }
      mo = new MutationObserver(recolor);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      window.addEventListener('pagehide', function (e) { if (!e.persisted) destroy(); });
    } catch (err) {
      console.warn('3D hero skipped:', err && err.message ? err.message : err);
      destroy();
    }
  }

  function start() {
    if (!canRun()) return;
    var hero = document.getElementById('home');
    var bg = hero && hero.querySelector('.hero-bg');
    if (!bg) return;
    ensureGsap()
      .catch(function () { /* the scene still works without the scroll link */ })
      .then(function () { return import(HERO3D.libs.three); })
      .then(function (THREE) { init(THREE, hero, bg); })
      .catch(function (e) { console.warn('3D hero skipped:', e && e.message ? e.message : e); });
  }

  function schedule() {
    var go = function () { (window.requestIdleCallback || function (fn) { setTimeout(fn, 1200); })(start, { timeout: 4000 }); };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }
  schedule();
})();
