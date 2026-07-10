/* Portail - un lapin géant en réalité augmentée se promène dans ta pièce.
   Caméra réelle en fond + lapin 3D animé (construit en code, 100% local). */
(function () {
  'use strict';

  const canvas = document.getElementById('scene');
  const video = document.getElementById('cam');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);            // transparent : on voit la caméra derrière
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
  const camHolder = new THREE.Object3D();          // on tourne la tête, pas la position
  camHolder.add(camera);
  scene.add(camHolder);

  const FLOOR_Y = -1.4;                            // le sol, ~1,4 m sous le téléphone tenu à la main

  // ---------- Lumières ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- Sol invisible qui reçoit l'ombre (ancre le lapin au sol réel) ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({ opacity: 0.34 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // ================= LE LAPIN =================
  function mat(color, rough) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: 0.0, flatShading: true });
  }
  const furMat = mat(0xece8f2, 0.9);
  const furShade = mat(0xd7d1e4, 0.9);
  const pinkMat = mat(0xff9bb0, 0.7);
  const noseMat = mat(0xff6f91, 0.6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1526, roughness: 0.25, metalness: 0.1 });

  const rabbit = new THREE.Group();

  function part(geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Corps (ovoïde)
  const body = part(new THREE.SphereGeometry(0.55, 20, 16), furMat, 0, 0.72, 0);
  body.scale.set(1.0, 0.9, 1.35);
  rabbit.add(body);

  // Poitrail relevé (assis façon lapin)
  const chest = part(new THREE.SphereGeometry(0.42, 18, 14), furMat, 0, 1.05, 0.42);
  chest.scale.set(1, 1.1, 1);
  rabbit.add(chest);

  // Tête
  const headGrp = new THREE.Group();
  headGrp.position.set(0, 1.5, 0.52);
  const head = part(new THREE.SphereGeometry(0.36, 20, 16), furMat, 0, 0, 0);
  head.scale.set(1, 0.95, 1.02);
  headGrp.add(head);
  // Museau
  const muzzle = part(new THREE.SphereGeometry(0.22, 16, 12), furMat, 0, -0.08, 0.28);
  muzzle.scale.set(1, 0.85, 1.05);
  headGrp.add(muzzle);
  // Nez
  const nose = part(new THREE.SphereGeometry(0.055, 10, 8), noseMat, 0, -0.05, 0.5);
  headGrp.add(nose);
  // Joues
  headGrp.add(part(new THREE.SphereGeometry(0.13, 12, 10), furShade, 0.17, -0.06, 0.34));
  headGrp.add(part(new THREE.SphereGeometry(0.13, 12, 10), furShade, -0.17, -0.06, 0.34));
  // Yeux
  const eyeL = part(new THREE.SphereGeometry(0.07, 12, 10), eyeMat, 0.19, 0.05, 0.28);
  const eyeR = part(new THREE.SphereGeometry(0.07, 12, 10), eyeMat, -0.19, 0.05, 0.28);
  headGrp.add(eyeL, eyeR);
  // reflets
  headGrp.add(part(new THREE.SphereGeometry(0.022, 8, 6), eyeMat.clone(), 0.21, 0.09, 0.34));
  // Oreilles (pivotent à la base)
  function makeEar(side) {
    const g = new THREE.Group();
    const outer = part(new THREE.SphereGeometry(0.13, 12, 12), furMat, 0, 0.45, 0);
    outer.scale.set(1, 3.4, 0.55);
    const inner = part(new THREE.SphereGeometry(0.09, 12, 12), pinkMat, 0, 0.45, 0.05);
    inner.scale.set(1, 3.2, 0.4);
    g.add(outer, inner);
    g.position.set(side * 0.16, 0.28, -0.02);
    g.rotation.z = side * 0.14;
    g.rotation.x = -0.12;
    return g;
  }
  const earL = makeEar(1), earR = makeEar(-1);
  headGrp.add(earL, earR);
  rabbit.add(headGrp);

  // Pattes (groupes pivotant à la hanche) : 2 avant, 2 arrière
  function makeLeg(hipX, hipY, hipZ, len, thick, back) {
    const g = new THREE.Group();
    g.position.set(hipX, hipY, hipZ);
    const upper = part(new THREE.SphereGeometry(thick, 12, 10), furMat, 0, -len * 0.35, back ? -0.05 : 0);
    upper.scale.set(1, 1.6, 1);
    const foot = part(new THREE.SphereGeometry(thick * 0.9, 12, 10), furShade, 0, -len * 0.85, back ? 0.12 : 0.06);
    foot.scale.set(1, 0.6, 1.7);
    g.add(upper, foot);
    return g;
  }
  const legFL = makeLeg(0.24, 0.62, 0.42, 0.6, 0.15, false);
  const legFR = makeLeg(-0.24, 0.62, 0.42, 0.6, 0.15, false);
  const legBL = makeLeg(0.32, 0.7, -0.28, 0.7, 0.2, true);
  const legBR = makeLeg(-0.32, 0.7, -0.28, 0.7, 0.2, true);
  rabbit.add(legFL, legFR, legBL, legBR);

  // Queue pompon
  const tail = part(new THREE.SphereGeometry(0.19, 14, 12), furMat, 0, 0.78, -0.72);
  rabbit.add(tail);

  // Échelle "géant" et pose au sol
  const SCALE = 1.25;
  rabbit.scale.setScalar(SCALE);
  rabbit.position.set(0, FLOOR_Y, -4);
  scene.add(rabbit);

  // ================= DÉPLACEMENT (il erre dans la pièce) =================
  const anchor = new THREE.Vector3(0, FLOOR_Y, -4);   // centre de sa zone de balade
  let target = pickTarget();
  let facing = Math.PI;                 // orientation courante (regarde vers la caméra au départ)
  let speed = 0;                        // vitesse actuelle (m/s monde)
  let hopT = 0, nextHop = 3 + Math.random() * 4;
  let pauseT = 0;

  function pickTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = 1 + Math.random() * 2.6;
    return new THREE.Vector3(anchor.x + Math.cos(a) * r, FLOOR_Y, anchor.z + Math.sin(a) * r);
  }

  // ================= CONTRÔLES (gyroscope + repli glisser) =================
  let mode = 'drag';
  const deviceEuler = new THREE.Euler();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const zee = new THREE.Vector3(0, 0, 1);
  const qOrient = new THREE.Quaternion();
  let orientation = 0, devData = null;

  function onDeviceOrientation(e) { if (e.alpha != null) devData = e; }
  function onScreenOrientation() { orientation = THREE.MathUtils.degToRad(window.orientation || 0); }
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

  let dragYaw = 0, dragPitch = -0.15, targetYaw = 0, targetPitch = -0.15;
  let dragging = false, lastX = 0, lastY = 0;
  function pDown(x, y) { dragging = true; lastX = x; lastY = y; hideHint(); }
  function pMove(x, y) {
    if (!dragging) return;
    targetYaw -= (x - lastX) * 0.005;
    targetPitch -= (y - lastY) * 0.005;
    targetPitch = Math.max(-1.3, Math.min(1.0, targetPitch));
    lastX = x; lastY = y;
  }
  function pUp() { dragging = false; }
  canvas.addEventListener('mousedown', e => pDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => pMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', pUp);
  canvas.addEventListener('touchstart', e => { const t = e.touches[0]; pDown(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchmove', e => { const t = e.touches[0]; pMove(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchend', pUp);

  // ================= BOUCLE =================
  const clock = new THREE.Clock();
  const fpsEl = document.getElementById('fps');
  const tmpDir = new THREE.Vector3();
  let frames = 0, fpsTime = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // --- déplacement du lapin ---
    tmpDir.subVectors(target, rabbit.position); tmpDir.y = 0;
    const dist = tmpDir.length();
    if (pauseT > 0) {
      pauseT -= dt; speed += (0 - speed) * Math.min(1, dt * 6);
    } else if (dist < 0.25) {
      target = pickTarget();
      pauseT = 0.6 + Math.random() * 2.2;   // il s'arrête, renifle, repart
    } else {
      speed += (0.85 - speed) * Math.min(1, dt * 3);
      tmpDir.normalize();
      rabbit.position.addScaledVector(tmpDir, speed * dt);
      // s'oriente vers sa direction de marche (lissé)
      const want = Math.atan2(tmpDir.x, tmpDir.z);
      let d = want - facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      facing += d * Math.min(1, dt * 5);
    }
    rabbit.rotation.y = facing;

    // --- saut occasionnel ---
    nextHop -= dt;
    if (nextHop <= 0 && pauseT <= 0 && hopT <= 0) { hopT = 0.55; nextHop = 4 + Math.random() * 5; }
    let hopY = 0, hopSquash = 0;
    if (hopT > 0) {
      hopT -= dt;
      const p = 1 - hopT / 0.55;              // 0..1
      hopY = Math.sin(p * Math.PI) * 0.7;      // arc
      hopSquash = Math.sin(p * Math.PI) * 0.12;
    }

    // --- animation de marche ---
    const moving = speed > 0.08 ? 1 : 0;
    const gait = t * 9;
    const sw = Math.sin(gait) * 0.5 * moving;
    const swAlt = Math.sin(gait + Math.PI) * 0.5 * moving;
    legFL.rotation.x = sw; legBR.rotation.x = sw * 0.9;
    legFR.rotation.x = swAlt; legBL.rotation.x = swAlt * 0.9;
    // corps qui ondule + respiration
    const bob = Math.abs(Math.sin(gait)) * 0.06 * moving + Math.sin(t * 2) * 0.015;
    rabbit.position.y = FLOOR_Y + bob + hopY;
    body.scale.y = 0.9 - hopSquash + Math.sin(t * 2) * 0.01;
    body.scale.x = 1.0 + hopSquash * 0.5;

    // oreilles qui ballottent
    const ear = Math.sin(t * 3) * 0.12 + moving * Math.sin(gait * 0.5) * 0.1;
    earL.rotation.x = -0.12 + ear;
    earR.rotation.x = -0.12 + Math.sin(t * 3 + 0.6) * 0.12 + moving * Math.sin(gait * 0.5 + 0.4) * 0.1;
    // pendant le saut, oreilles vers l'arrière
    if (hopT > 0) { earL.rotation.x -= 0.5; earR.rotation.x -= 0.5; }

    // tête qui bouge un peu + reniflement du nez
    headGrp.rotation.x = Math.sin(t * 0.8) * 0.05 + (pauseT > 0 ? Math.sin(t * 6) * 0.06 : 0);
    headGrp.rotation.y = Math.sin(t * 0.5) * 0.12;
    const twitch = pauseT > 0 ? (Math.sin(t * 22) * 0.5 + 0.5) : 0;
    nose.scale.setScalar(1 + twitch * 0.25);

    // clignement des yeux
    const blink = (Math.sin(t * 1.7) > 0.985) ? 0.1 : 1;
    eyeL.scale.y = blink; eyeR.scale.y = blink;

    // queue frétille
    tail.position.x = Math.sin(t * 5) * 0.03 * moving;

    // --- l'ombre suit le lapin ---
    sun.target.position.copy(rabbit.position);
    sun.position.set(rabbit.position.x + 3, rabbit.position.y + 9, rabbit.position.z + 2);

    // --- caméra ---
    if (mode === 'gyro') {
      applyDeviceQuaternion();
    } else {
      dragYaw += (targetYaw - dragYaw) * Math.min(1, dt * 8);
      dragPitch += (targetPitch - dragPitch) * Math.min(1, dt * 8);
      camHolder.rotation.set(dragPitch, dragYaw, 0, 'YXZ');
    }

    renderer.render(scene, camera);
    frames++; fpsTime += dt;
    if (fpsTime >= 0.5) { fpsEl.textContent = Math.round(frames / fpsTime) + ' fps'; frames = 0; fpsTime = 0; }
  }
  animate();

  // ================= RESIZE =================
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
  const statusLine = document.getElementById('statusLine');
  let hintHidden = false;
  function hideHint() { if (!hintHidden) { hintHidden = true; hintEl.classList.remove('show'); } }

  const hasOrientation = 'DeviceOrientationEvent' in window;
  const needsPermission = hasOrientation && typeof DeviceOrientationEvent.requestPermission === 'function';
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  function startGyro() { window.addEventListener('deviceorientation', onDeviceOrientation, true); mode = 'gyro'; }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      document.body.classList.add('has-cam');
      return true;
    } catch (e) { return false; }
  }

  async function enter() {
    enterBtn.disabled = true;
    const camOk = await startCamera();
    if (needsPermission) {
      try { const s = await DeviceOrientationEvent.requestPermission(); if (s === 'granted') startGyro(); } catch (_) {}
    } else if (hasOrientation && isMobile) {
      startGyro();
    }
    if (!camOk) statusLine.textContent = 'Mode démo (sans caméra)';
    startEl.classList.add('hidden');
    hudTop.classList.add('show');
    hintEl.classList.add('show');
    setTimeout(() => hintEl.classList.remove('show'), 5500);
  }
  enterBtn.addEventListener('click', enter);

  document.addEventListener('keydown', e => { if (e.key === 'f') fpsEl.style.display = fpsEl.style.display === 'block' ? 'none' : 'block'; });
})();
