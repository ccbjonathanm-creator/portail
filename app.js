/* Portail - blague AR : un lapin GÉANT réaliste mange dans une poubelle,
   un homme le montre du doigt, et une voix s'exclame.
   Caméra réelle en fond + modèles 3D réalistes (GLB générés, embarqués en local). */
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
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
  sun.position.set(3, 10, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- Sol invisible qui reçoit l'ombre (ancre les modèles au sol réel) ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.34 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  // ================= LA POUBELLE (construite en code) =================
  function buildBin() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4750, roughness: 0.55, metalness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.7, metalness: 0.2 });
    const H = 1.15, R = 0.62;
    // corps (cône tronqué, ouvert en haut)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.82, H, 32, 1, true), bodyMat);
    body.position.y = H / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // intérieur sombre (double paroi)
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.78, H * 0.98, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x10140a, roughness: 0.95, side: THREE.BackSide }));
    inner.position.y = H / 2;
    g.add(inner);
    // fond
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.82, 32), darkMat);
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.02;
    g.add(bottom);
    // rebord (anneau)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 12, 32), darkMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = H;
    rim.castShadow = true;
    g.add(rim);
    // couvercle ouvert, incliné en arrière
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.06, 32), bodyMat);
    lid.castShadow = true;
    lid.position.set(0, H + 0.42, -R - 0.32);
    lid.rotation.x = -1.15;
    g.add(lid);
    // ordures qui débordent (formes simples colorées)
    const trashColors = [0xcaa46a, 0x9fae7a, 0x6a7d94, 0xb35a4a, 0xd8cdb2, 0x7a8a55];
    for (let i = 0; i < 9; i++) {
      const c = trashColors[i % trashColors.length];
      const geo = i % 2 === 0
        ? new THREE.BoxGeometry(0.16 + Math.random() * 0.14, 0.12 + Math.random() * 0.12, 0.16 + Math.random() * 0.14)
        : new THREE.IcosahedronGeometry(0.09 + Math.random() * 0.08, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.6;
      m.position.set(Math.cos(a) * r, H - 0.05 + Math.random() * 0.22, Math.sin(a) * r);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }
  // (Poubelle retirée : le lapin se tient juste là, énorme.)

  // ================= CHARGEMENT DES MODÈLES RÉALISTES (GLB) =================
  const loader = new THREE.GLTFLoader();

  // Pose un modèle : pieds au sol, hauteur cible, position, rotation. Renvoie un groupe wrapper.
  function placeModel(root, opts) {
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.side = THREE.FrontSide; } });
    // mesure la boîte englobante
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const s = opts.targetHeight / (size.y || 1);
    root.scale.setScalar(s);
    // recentre en x/z et pose les pieds à y=0 dans le wrapper
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const g = new THREE.Group();
    g.add(root);
    g.position.copy(opts.pos);
    g.rotation.y = opts.rotY || 0;
    scene.add(g);
    return g;
  }

  // Réglages faciles à ajuster
  const RAB = { targetHeight: 2.4, pos: new THREE.Vector3(0, FLOOR_Y, -5.6), rotY: 0 };
  const MAN = { targetHeight: 1.75, pos: new THREE.Vector3(-2.9, FLOOR_Y, -4.4), rotY: 0.6 };

  // --- état de déplacement du lapin (sauts + approche, corps entier) ---
  const rabPos = RAB.pos.clone();
  let rabTarget = new THREE.Vector3(0, FLOOR_Y, -5.2);
  let rabFacing = 0, hopPhase = 0, chargeCd = 3 + Math.random() * 3;
  const _tmp = new THREE.Vector3();
  function pickRabTarget(charge) {
    if (charge) return new THREE.Vector3((Math.random() - 0.5) * 1.4, FLOOR_Y, -2.9); // fonce vers la caméra
    return new THREE.Vector3(-1 + Math.random() * 3, FLOOR_Y, -6.4 + Math.random() * 2.6);
  }

  let rabbit = null, man = null;
  const status = { rabbit: false, man: false };

  // Chargement SÉQUENTIEL (lapin puis homme) : deux gros GLB en parallèle
  // saturent certains serveurs. On enchaîne, avec un petit réessai par sécurité.
  function loadModel(url, tries, done) {
    loader.load(url, done, undefined, (e) => {
      console.error('Erreur chargement ' + url, e);
      if (tries > 0) setTimeout(() => loadModel(url, tries - 1, done), 400);
    });
  }

  loadModel('models/lapin.glb', 3, (gltf) => {
    rabbit = placeModel(gltf.scene, RAB);
    status.rabbit = true;
    setStatus();
    loadModel('models/homme.glb', 3, (gltf2) => {
      man = placeModel(gltf2.scene, MAN);
      status.man = true;
      setStatus();
    });
  });

  // ================= VOIX OFF =================
  const PHRASE = "Oh putain les gars, il y a un lapin énorme !";
  let voicesReady = false;
  // repère une voix d'HOMME française (par son nom), sinon une voix fr quelconque
  function pickMaleFrenchVoice() {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const fr = vs.filter(v => /^fr/i.test(v.lang));
    const male = fr.find(v => /(paul|thomas|henri|nicolas|mathieu|guillaume|daniel|male|homme|man)/i.test(v.name));
    return { voice: male || fr[0] || null, isMale: !!male };
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => { voicesReady = true; };
    speechSynthesis.getVoices();
  }
  function speak() {
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(PHRASE);
      u.lang = 'fr-FR';
      const pick = pickMaleFrenchVoice();
      if (pick.voice) u.voice = pick.voice;
      // pas de voix d'homme trouvée -> on baisse la tonalité pour masculiniser
      u.pitch = pick.isMale ? 0.9 : 0.6;
      u.rate = 1.45; u.volume = 1.0;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (_) {}
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

  let dragYaw = 0, dragPitch = -0.1, targetYaw = 0, targetPitch = -0.1;
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
  // taper l'écran rejoue la phrase
  canvas.addEventListener('click', () => speak());

  // ================= BOUCLE =================
  const clock = new THREE.Clock();
  const fpsEl = document.getElementById('fps');

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // --- lapin géant : il sautille dans la pièce et fonce parfois vers toi ---
    if (rabbit) {
      chargeCd -= dt;
      _tmp.subVectors(rabTarget, rabPos); _tmp.y = 0;
      const dist = _tmp.length();
      const charging = rabTarget.z > -3.6;
      if (dist < 0.4) {
        if (charging) { chargeCd = 5 + Math.random() * 5; rabTarget = pickRabTarget(false); }
        else { rabTarget = pickRabTarget(chargeCd <= 0); }
      } else {
        _tmp.normalize();
        const v = charging ? 2.7 : 1.1;                 // vitesse (m/s), plus vif en charge
        rabPos.addScaledVector(_tmp, v * dt);
        const want = Math.atan2(_tmp.x, _tmp.z);        // oriente le nez (+Z) vers la cible
        let d = want - rabFacing;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rabFacing += d * Math.min(1, dt * 7);
      }
      const moving = dist > 0.4 ? 1 : 0;
      hopPhase += dt * (moving ? 7.5 : 2.5) * (charging ? 1.35 : 1);
      const air = Math.abs(Math.sin(hopPhase));          // 0 (au sol) .. 1 (en l'air)
      rabbit.position.set(rabPos.x, FLOOR_Y + air * (charging ? 0.5 : 0.32), rabPos.z);
      rabbit.rotation.set(0, rabFacing, 0);
      // écrasement à l'atterrissage / étirement en l'air (squash & stretch)
      const sy = 1 + (air - 0.5) * 0.18 * moving;
      const sxz = 1 - (air - 0.5) * 0.09 * moving;
      rabbit.scale.set(sxz, sy, sxz);
    }

    // --- homme : il montre du doigt, petite agitation d'excitation ---
    if (man) {
      man.position.y = FLOOR_Y + Math.abs(Math.sin(t * 3.2)) * 0.03;  // sautille un peu
      man.rotation.y = MAN.rotY + Math.sin(t * 2.1) * 0.04;           // s'agite
    }

    // --- caméra ---
    if (mode === 'gyro') {
      applyDeviceQuaternion();
    } else {
      dragYaw += (targetYaw - dragYaw) * Math.min(1, dt * 8);
      dragPitch += (targetPitch - dragPitch) * Math.min(1, dt * 8);
      camHolder.rotation.set(dragPitch, dragYaw, 0, 'YXZ');
    }

    renderer.render(scene, camera);
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
  const hudTop = document.getElementById('hudTop');
  const hintEl = document.getElementById('hint');
  const statusLine = document.getElementById('statusLine');
  let hintHidden = false;
  function hideHint() { if (!hintHidden) { hintHidden = true; hintEl.classList.remove('show'); } }
  function setStatus() {
    if (status.rabbit && status.man && statusLine) statusLine.textContent = 'Attention au lapin';
  }

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

  let voiceTimer = null;
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
    // la voix (le geste "Ouvrir" débloque l'audio) : une fois puis en boucle lente
    setTimeout(speak, 900);
    voiceTimer = setInterval(speak, 9000);
  }
  enterBtn.addEventListener('click', enter);

  document.addEventListener('keydown', e => { if (e.key === 'f') fpsEl.style.display = fpsEl.style.display === 'block' ? 'none' : 'block'; });
})();
