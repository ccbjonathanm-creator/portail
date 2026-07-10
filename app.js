/* Portail - univers 3D immersif exploré au gyroscope. 100% local. */
(function () {
  'use strict';

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05010f, 0.018);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  // La caméra reste à l'origine, on ne fait que tourner la tête.
  const camHolder = new THREE.Object3D();
  camHolder.add(camera);
  scene.add(camHolder);

  // ---------- Génération d'une texture "glow" radiale (bloom pas cher) ----------
  function glowTexture(inner, outer) {
    const s = 128;
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0.0, inner);
    grad.addColorStop(0.25, outer);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(180,200,255,0.5)');
  const softTex = glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');

  // ---------- Champ d'étoiles profond ----------
  function makeStars(count, radius, size, colorA, colorB) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cA = new THREE.Color(colorA), cB = new THREE.Color(colorB), tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // distribution sur une sphère
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
      const r = radius * (0.6 + Math.random() * 0.4);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      tmp.copy(cA).lerp(cB, Math.random());
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: size, map: starTex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    return new THREE.Points(geo, mat);
  }

  const starsFar = makeStars(2600, 260, 1.4, 0x9fb4ff, 0xffffff);
  const starsNear = makeStars(900, 120, 2.6, 0x7f5cff, 0x22d3ee);
  scene.add(starsFar, starsNear);

  // ---------- Nuages de nébuleuse (sprites additifs colorés) ----------
  const nebula = new THREE.Group();
  const nebColors = [0x7f5cff, 0x22d3ee, 0xff5ca8, 0x4f46e5, 0x14b8a6];
  for (let i = 0; i < 26; i++) {
    const color = nebColors[i % nebColors.length];
    const mat = new THREE.SpriteMaterial({
      map: softTex, color: color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.20
    });
    const sp = new THREE.Sprite(mat);
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u, phi = Math.acos(2 * v - 1);
    const r = 60 + Math.random() * 120;
    sp.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi)
    );
    const s = 40 + Math.random() * 90;
    sp.scale.set(s, s, 1);
    sp.userData.spin = (Math.random() - 0.5) * 0.02;
    nebula.add(sp);
  }
  scene.add(nebula);

  // ---------- Portails lumineux flottants ----------
  const portals = new THREE.Group();
  const zones = [
    { name: 'Nebula Prime', color: 0x7f5cff },
    { name: 'Cyan Drift', color: 0x22d3ee },
    { name: 'Rose Halo', color: 0xff5ca8 },
    { name: 'Verdant Gate', color: 0x14b8a6 },
    { name: 'Indigo Deep', color: 0x4f46e5 }
  ];
  const portalMeshes = [];
  zones.forEach((z, i) => {
    const grp = new THREE.Object3D();
    const ang = (i / zones.length) * Math.PI * 2;
    const dist = 34 + (i % 2) * 10;
    grp.position.set(Math.cos(ang) * dist, (Math.random() - 0.5) * 18, Math.sin(ang) * dist);
    grp.lookAt(0, 0, 0);

    // anneau principal
    const ringGeo = new THREE.TorusGeometry(7, 0.35, 16, 80);
    const ringMat = new THREE.MeshBasicMaterial({ color: z.color });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    grp.add(ring);

    // halo (sprite glow derrière)
    const haloMat = new THREE.SpriteMaterial({ map: softTex, color: z.color,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(26, 26, 1);
    grp.add(halo);

    // "surface" du portail : disque semi-transparent scintillant
    const discGeo = new THREE.CircleGeometry(6.7, 48);
    const discMat = new THREE.MeshBasicMaterial({ color: z.color, transparent: true,
      opacity: 0.14, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const disc = new THREE.Mesh(discGeo, discMat);
    grp.add(disc);

    grp.userData = { zone: z, baseY: grp.position.y, phase: Math.random() * Math.PI * 2, ring: ring, disc: disc };
    portalMeshes.push(grp);
    portals.add(grp);
  });
  scene.add(portals);

  // Poussière proche qui donne la sensation de mouvement / profondeur
  const dust = makeStars(400, 40, 1.8, 0xffffff, 0x9fb4ff);
  scene.add(dust);

  // ================= CONTRÔLES =================
  // Mode gyroscope (mobile) OU glisser (desktop/fallback)
  let mode = 'drag';
  const deviceEuler = new THREE.Euler();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 sur X
  const zee = new THREE.Vector3(0, 0, 1);
  const qOrient = new THREE.Quaternion();
  let orientation = 0;
  let devData = null;

  function onDeviceOrientation(e) {
    if (e.alpha == null) return;
    devData = e;
  }
  function onScreenOrientation() {
    orientation = THREE.MathUtils.degToRad(window.orientation || 0);
  }

  function applyDeviceQuaternion() {
    if (!devData) return;
    const alpha = THREE.MathUtils.degToRad(devData.alpha);
    const beta = THREE.MathUtils.degToRad(devData.beta);
    const gamma = THREE.MathUtils.degToRad(devData.gamma);
    deviceEuler.set(beta, alpha, -gamma, 'YXZ');
    camHolder.quaternion.setFromEuler(deviceEuler);
    camHolder.quaternion.multiply(q1);
    qOrient.setFromAxisAngle(zee, -orientation);
    camHolder.quaternion.multiply(qOrient);
  }

  // Drag (souris + tactile) -> yaw/pitch
  let dragYaw = 0, dragPitch = 0, targetYaw = 0, targetPitch = 0;
  let dragging = false, lastX = 0, lastY = 0;
  function pointerDown(x, y) { dragging = true; lastX = x; lastY = y; hideHints(); }
  function pointerMove(x, y) {
    if (!dragging) return;
    targetYaw -= (x - lastX) * 0.0045;
    targetPitch -= (y - lastY) * 0.0045;
    targetPitch = Math.max(-1.2, Math.min(1.2, targetPitch));
    lastX = x; lastY = y;
  }
  function pointerUp() { dragging = false; }

  canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('touchstart', e => { const t = e.touches[0]; pointerDown(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchmove', e => { const t = e.touches[0]; pointerMove(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchend', pointerUp);

  // ================= BOUCLE =================
  const clock = new THREE.Clock();
  const forward = new THREE.Vector3();
  const fpsEl = document.getElementById('fps');
  const zoneNameEl = document.getElementById('zoneName');
  let frames = 0, fpsTime = 0, currentZone = '';

  function pickZone() {
    // Quelle direction regarde-t-on ? -> nom de zone du portail le plus aligné
    camera.getWorldDirection(forward);
    let best = -Infinity, bestZone = null;
    portalMeshes.forEach(p => {
      const dir = p.position.clone().normalize();
      const d = dir.dot(forward);
      if (d > best) { best = d; bestZone = p.userData.zone; }
    });
    if (bestZone && bestZone.name !== currentZone && best > 0.55) {
      currentZone = bestZone.name;
      zoneNameEl.textContent = currentZone;
      zoneNameEl.classList.remove('fade-in'); void zoneNameEl.offsetWidth; zoneNameEl.classList.add('fade-in');
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // rotation lente de l'univers pour la vie
    starsFar.rotation.y += dt * 0.006;
    starsNear.rotation.y += dt * 0.012;
    nebula.rotation.y += dt * 0.004;
    nebula.children.forEach(sp => { sp.material.rotation += sp.userData.spin * dt; });
    dust.rotation.y -= dt * 0.03;
    dust.rotation.x += dt * 0.01;

    // portails : flottement + pulsation + rotation d'anneau
    portalMeshes.forEach(p => {
      p.position.y = p.userData.baseY + Math.sin(t * 0.6 + p.userData.phase) * 2.2;
      p.userData.ring.rotation.z += dt * 0.4;
      const pulse = 0.12 + (Math.sin(t * 1.5 + p.userData.phase) * 0.5 + 0.5) * 0.14;
      p.userData.disc.material.opacity = pulse;
      p.lookAt(0, p.position.y, 0);
    });

    // caméra
    if (mode === 'gyro') {
      applyDeviceQuaternion();
    } else {
      dragYaw += (targetYaw - dragYaw) * Math.min(1, dt * 8);
      dragPitch += (targetPitch - dragPitch) * Math.min(1, dt * 8);
      // dérive douce automatique quand on ne touche pas
      if (!dragging) targetYaw += dt * 0.02;
      camHolder.rotation.set(dragPitch, dragYaw, 0, 'YXZ');
    }

    pickZone();
    renderer.render(scene, camera);

    frames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fpsEl.textContent = Math.round(frames / fpsTime) + ' fps'; frames = 0; fpsTime = 0; }
  }
  animate();

  // ================= REDIMENSIONNEMENT =================
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('orientationchange', onScreenOrientation);
  onScreenOrientation();

  // ================= DÉMARRAGE / PERMISSIONS =================
  const startEl = document.getElementById('start');
  const enterBtn = document.getElementById('enterBtn');
  const startNote = document.getElementById('startNote');
  const hudTop = document.getElementById('hudTop');
  const hintEl = document.getElementById('hint');
  let hintsHidden = false;

  function hideHints() {
    if (hintsHidden) return;
    hintsHidden = true;
    hintEl.classList.remove('show');
  }

  const hasOrientation = 'DeviceOrientationEvent' in window;
  const needsPermission = hasOrientation && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (hasOrientation && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    startNote.textContent = needsPermission
      ? "L'app va demander l'accès aux capteurs de mouvement (rien n'est enregistré ni envoyé)."
      : "Bouge ton téléphone dans tous les sens pour regarder autour de toi.";
  }

  function startGyro() {
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
    mode = 'gyro';
  }

  function enter() {
    const finish = () => {
      startEl.classList.add('hidden');
      hudTop.classList.add('show');
      hintEl.classList.add('show');
      setTimeout(() => hintEl.classList.remove('show'), 5000);
    };
    if (needsPermission) {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') startGyro();
        finish();
      }).catch(finish);
    } else {
      if (hasOrientation && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) startGyro();
      finish();
    }
  }
  enterBtn.addEventListener('click', enter);

  // Double-tap discret sur le coin haut-gauche pour afficher les fps
  let taps = 0;
  document.addEventListener('keydown', e => { if (e.key === 'f') fpsEl.style.display = fpsEl.style.display === 'block' ? 'none' : 'block'; });
})();
