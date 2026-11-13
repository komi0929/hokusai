// actors.js — 波乗り人・押送船・千鳥・飛沫 (surfer, boats, plovers, spray)
(function () {
  const H = window.H, C = H.C;
  const INK = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });
  const flat = (c) => new THREE.MeshBasicMaterial({ color: c });
  // flat colour mesh + inverted-hull ink outline
  function part(geo, color, s) {
    const m = new THREE.Mesh(geo, flat(color));
    const o = new THREE.Mesh(geo, INK);
    o.scale.setScalar(s || 1.09);
    m.add(o);
    return m;
  }
  H.part = part;

  // ---------------- surfer ----------------
  H.makeSurfer = function () {
    const root = new THREE.Group();
    const board = part(new THREE.SphereGeometry(1, 14, 8), 0xb98a4e, 1.06);
    board.scale.set(0.34, 0.055, 1.45);
    board.children[0].scale.set(1.08, 1.9, 1.03);
    root.add(board);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 2.2), flat(0x7a5529));
    stripe.position.y = 0.06; root.add(stripe);

    const body = new THREE.Group(); body.position.y = 0.06; root.add(body);
    const skin = 0xe2b98c, indigo = 0x1f3a63;
    const legG = new THREE.CylinderGeometry(0.075, 0.065, 0.62, 8);
    const l1 = part(legG, skin, 1.18); l1.position.set(0, 0.3, 0.38); l1.rotation.x = 0.28;
    const l2 = part(legG, skin, 1.18); l2.position.set(0, 0.3, -0.38); l2.rotation.x = -0.28;
    const torso = part(new THREE.CylinderGeometry(0.2, 0.27, 0.68, 10), indigo, 1.1);
    torso.position.set(0, 0.88, 0);
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.09, 10), flat(C.foam));
    sash.position.set(0, 0.66, 0);
    const armG = new THREE.CylinderGeometry(0.05, 0.045, 0.6, 6);
    const a1 = part(armG, skin, 1.22); a1.position.set(0, 1.02, 0.42); a1.rotation.x = 1.25;
    const a2 = part(armG, skin, 1.22); a2.position.set(0, 1.02, -0.42); a2.rotation.x = -1.25;
    const head = part(new THREE.SphereGeometry(0.16, 12, 10), skin, 1.12); head.position.set(0, 1.38, 0);
    const hat = part(new THREE.ConeGeometry(0.4, 0.2, 14), 0xd6b46f, 1.08); hat.position.set(0, 1.56, 0);
    body.add(l1, l2, torso, sash, a1, a2, head, hat);
    root.userData = { body, a1, a2, board, torso, hat };
    return root;
  };

  // ---------------- oshiokuri boat ----------------
  H.makeBoat = function () {
    const g = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0, -7); sh.quadraticCurveTo(1.25, -3.5, 1.2, 0); sh.quadraticCurveTo(1.1, 4.5, 0.75, 6.2);
    sh.lineTo(-0.75, 6.2); sh.quadraticCurveTo(-1.1, 4.5, -1.2, 0); sh.quadraticCurveTo(-1.25, -3.5, 0, -7);
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false, curveSegments: 8 });
    hg.rotateX(Math.PI / 2); hg.translate(0, 0.75, 0); // x width, z length, y up
    const sheer = (z) => (z < 0 ? 0.048 * z * z : 0.012 * z * z); // upswept prow
    const P = hg.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, P.getY(i) + sheer(P.getZ(i)));
    const hull = new THREE.Mesh(hg, flat(C.tan));
    const out = new THREE.Mesh(hg, INK); out.scale.set(1.1, 1.25, 1.02); out.position.y = -0.1;
    hull.add(out);
    const deck = new THREE.Mesh(new THREE.ShapeGeometry(sh, 8), flat(0xa98649));
    deck.rotation.x = Math.PI / 2; deck.position.y = 0.76; deck.scale.set(0.8, 0.62, 1); deck.material.color.set(0x6f5a35);
    g.add(hull, deck); g.scale.setScalar(1.3);
    const bg = new THREE.SphereGeometry(0.46, 8, 6), hd = new THREE.SphereGeometry(0.21, 8, 6);
    for (let i = 0; i < 4; i++) for (let s = -1; s <= 1; s += 2) {
      const b = part(bg, 0x1f3a63, 1.13); b.scale.set(1, 0.8, 1.4); b.position.set(s * 0.52, 1.0 + sheer(-2.6 + i * 1.7), -2.6 + i * 1.7);
      const h = part(hd, 0xe2b98c, 1.15); h.position.set(s * 0.52, 1.3 + sheer(-3.1 + i * 1.7), -3.1 + i * 1.7); h.scale.set(1, 1, 0.8 / 1.0);
      g.add(b, h);
    }
    const stern = part(new THREE.BoxGeometry(1.4, 0.5, 0.25), 0xb3915a, 1.12); stern.position.set(0, 0.95 + sheer(6.1), 6.1); g.add(stern);
    return g;
  };

  // ---------------- chidori (plover) sprite ----------------
  H.makeChidoriTex = function () {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    x.translate(66, 72); x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(42, -6); x.lineTo(24, -12); x.quadraticCurveTo(16, -26, 2, -20);   // beak, head
    x.quadraticCurveTo(-6, -48, -34, -54); x.quadraticCurveTo(-26, -30, -30, -12); // swept wing
    x.quadraticCurveTo(-48, -8, -58, 6); x.quadraticCurveTo(-34, 8, -22, 18);      // tail
    x.quadraticCurveTo(0, 32, 20, 16); x.quadraticCurveTo(30, 8, 24, -2); x.closePath();
    x.fillStyle = '#fbf7ec'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#14213a'; x.stroke();
    x.beginPath(); x.moveTo(-2, -14); x.quadraticCurveTo(-14, -8, -24, -12); x.stroke();
    x.fillStyle = '#14213a'; x.beginPath(); x.arc(15, -11, 3.2, 0, 7); x.fill();
    return new THREE.CanvasTexture(cv);
  };

  // ---------------- crane (Red Fuji) ----------------
  H.makeCraneTex = function () {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'); x.translate(64, 64); x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(58, -14); x.lineTo(40, -12); x.quadraticCurveTo(22, -10, 12, 0);          // bill, long neck
    x.quadraticCurveTo(10, -30, -10, -56); x.quadraticCurveTo(-14, -26, -22, -6);      // raised wing
    x.quadraticCurveTo(-44, -2, -60, 14); x.quadraticCurveTo(-36, 12, -20, 16);        // tail and legs
    x.quadraticCurveTo(-8, 46, 10, 54); x.quadraticCurveTo(6, 26, 14, 12);             // lower wing
    x.quadraticCurveTo(26, 2, 40, -4); x.closePath();
    x.fillStyle = '#fbf7ec'; x.fill(); x.lineWidth = 4.5; x.strokeStyle = '#14213a'; x.stroke();
    x.fillStyle = '#14213a'; x.beginPath(); x.moveTo(-10, -56); x.quadraticCurveTo(-13, -40, -15, -30); x.lineTo(-4, -40); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(10, 54); x.quadraticCurveTo(4, 42, 0, 34); x.lineTo(10, 38); x.closePath(); x.fill();
    x.fillStyle = '#c0392b'; x.beginPath(); x.arc(41, -13, 4.2, 0, 7); x.fill();
    return new THREE.CanvasTexture(cv);
  };

  // ---------------- lightning bolt (Rainstorm) ----------------
  H.makeBolt = function () {
    const zig = (w) => {
      const sh = new THREE.Shape(), pts = [[0, 0], [2.6, 9], [0.4, 12], [3.4, 22], [1.0, 25], [4.4, 37], [2.0, 40], [5.2, 54], [3.4, 70]];
      sh.moveTo(pts[0][0] - w * 0.2, pts[0][1]);
      for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0] - w, pts[i][1]);
      for (let i = pts.length - 1; i >= 1; i--) sh.lineTo(pts[i][0] + w, pts[i][1] + (i % 2 ? 1.5 : -1.5));
      sh.lineTo(pts[0][0] + w * 0.2, pts[0][1]);
      return new THREE.ShapeGeometry(sh);
    };
    const g = new THREE.Group();
    const ink = new THREE.Mesh(zig(1.25), new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.DoubleSide, fog: false })); ink.position.z = -0.05;
    const core = new THREE.Mesh(zig(0.8), new THREE.MeshBasicMaterial({ color: 0xf08a2c, side: THREE.DoubleSide, fog: false }));
    const hot = new THREE.Mesh(zig(0.3), new THREE.MeshBasicMaterial({ color: 0xfbe9b0, side: THREE.DoubleSide, fog: false })); hot.position.z = 0.05;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 20), new THREE.MeshBasicMaterial({ color: 0xf08a2c, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; ring.scale.set(1.6, 1, 1);
    g.add(ink, core, hot, ring); g.userData.ring = ring; g.userData.core = core;
    return g;
  };

  // ---------------- spray dots ----------------
  H.makeSpray = function (N) {
    const pos = new Float32Array(N * 3), size = new Float32Array(N);
    const vel = new Float32Array(N * 3), life = new Float32Array(N), grav = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uMax: { value: 64 }, cFoam: { value: new THREE.Color(C.foam) }, cInk: { value: new THREE.Color(C.ink) } },
      vertexShader: `attribute float aSize; uniform float uScale; uniform float uMax; varying float vS; varying float vPx;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vS = aSize;
          gl_PointSize = aSize>0.0 ? clamp(aSize*uScale/-mv.z, 2.0, uMax) : 0.0; vPx = gl_PointSize; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 cFoam, cInk; varying float vS; varying float vPx;
        void main(){ if(vS<=0.0) discard; float r = length(gl_PointCoord-0.5);
          if(r>0.5) discard; float k = 0.5 - 1.3/vPx;
          gl_FragColor = vec4((vPx>7.0 && r>k) ? cInk : cFoam, 1.0); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    let cur = 0;
    return {
      pts, mat: m,
      emit(x, y, z, vx, vy, vz, s, l, gv) {
        const i = cur; cur = (cur + 1) % N;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
        size[i] = s; life[i] = l; grav[i] = gv === undefined ? 14 : gv;
      },
      update(dt) {
        for (let i = 0; i < N; i++) {
          if (size[i] <= 0) continue;
          life[i] -= dt;
          if (life[i] <= 0) { size[i] = 0; continue; }
          vel[i * 3 + 1] -= grav[i] * dt;
          pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (life[i] < 0.25) size[i] *= Math.pow(0.9, dt * 60);
        }
        g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
      },
      clear() { size.fill(0); },
    };
  };
})();
