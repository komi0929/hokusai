// extras.js — more of Hokusai's world: the Kajikazawa rock and fisherman, the dragon over Fuji,
// the wind-blown papers of Ejiri, a torii in the shallows, and the banner that marks your best ride.
(function () {
  const H = window.H, C = H.C;
  const INK = '#14213a';
  const billboard = (cv, w, h, fog) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: !!fog }));
    return m;
  };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---- Kajikazawa in Kai: the rock over the surf, the fisherman and his fanned lines ----
  H.makeRock = function () {
    const cv = canvas(512, 512), x = cv.getContext('2d');
    const rock = () => {
      x.beginPath(); x.moveTo(512, 512); x.lineTo(140, 512); x.quadraticCurveTo(185, 430, 120, 400); x.lineTo(58, 332);
      x.quadraticCurveTo(170, 300, 230, 250); x.lineTo(330, 215); x.quadraticCurveTo(430, 200, 512, 170); x.closePath();
    };
    rock(); const g = x.createLinearGradient(0, 170, 0, 512); g.addColorStop(0, '#2c68a0'); g.addColorStop(1, '#143a6b'); x.fillStyle = g; x.fill();
    x.save(); rock(); x.clip();
    x.strokeStyle = '#7fa9cc'; x.lineWidth = 3;
    for (let i = 1; i <= 7; i++) { x.beginPath(); x.moveTo(58 + i * 4, 332 + i * 16); x.quadraticCurveTo(170, 300 + i * 17, 230, 250 + i * 18); x.lineTo(330, 215 + i * 20); x.quadraticCurveTo(430, 200 + i * 21, 512, 170 + i * 22); x.stroke(); }
    x.strokeStyle = '#3f7f86'; x.lineWidth = 9; x.beginPath(); x.moveTo(62, 334); x.quadraticCurveTo(170, 303, 230, 254); x.lineTo(330, 219); x.quadraticCurveTo(430, 204, 512, 174); x.stroke();
    x.restore();
    rock(); x.lineWidth = 4; x.strokeStyle = INK; x.lineJoin = 'round'; x.stroke();
    // fisherman bent over his lines, the child with the basket behind him
    x.strokeStyle = INK; x.lineWidth = 1.4;
    [[18, 500], [36, 505], [54, 508], [70, 512]].forEach((p) => { x.beginPath(); x.moveTo(76, 322); x.lineTo(p[0], p[1]); x.stroke(); });
    x.fillStyle = '#1f3a63'; x.lineWidth = 2.5;
    x.beginPath(); x.ellipse(94, 314, 17, 10, -0.9, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#e2b98c'; x.beginPath(); x.arc(80, 302, 5.5, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#d6b46f'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(98 + i * 3, 322); x.lineTo(104 + i * 4, 334); x.stroke(); }
    x.strokeStyle = INK; x.lineWidth = 2.5; x.fillStyle = '#2c68a0'; x.beginPath(); x.ellipse(140, 296, 8, 7, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#d6b46f'; x.fillRect(150, 292, 10, 9); x.strokeRect(150, 292, 10, 9);
    // surf at the foot
    x.fillStyle = '#fbf7ec'; x.lineWidth = 3;
    for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(150 + i * 38, 502 - 6 * Math.abs(Math.sin(i * 1.7)), 12 + 6 * Math.abs(Math.sin(i * 2.3)), 0, 7); x.fill(); x.stroke(); }
    x.globalCompositeOperation = 'destination-out'; // the far end of the headland dissolves into mist
    const fg = x.createLinearGradient(330, 0, 512, 0); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = fg; x.fillRect(330, 0, 182, 512); x.globalCompositeOperation = 'source-over';
    return billboard(cv, 46, 46, true);
  };

  // ---- the dragon rising in black smoke beside Fuji (after Hokusai's last painting) ----
  H.makeDragon = function () {
    const cv = canvas(256, 512), x = cv.getContext('2d');
    x.fillStyle = '#0d0f14';
    x.beginPath(); x.moveTo(40, 512); x.bezierCurveTo(60, 380, 150, 360, 120, 250); x.bezierCurveTo(95, 160, 190, 120, 170, 0); x.lineTo(256, 0);
    x.bezierCurveTo(250, 140, 170, 180, 200, 270); x.bezierCurveTo(230, 370, 140, 400, 150, 512); x.closePath(); x.fill();
    for (let i = 0; i < 26; i++) { // curled edges of the smoke
      const t = i / 25, y = 500 - t * 490, w = 40 + 26 * Math.sin(t * 7), cx = 110 + 55 * Math.sin(t * 5.2 + 0.6) + t * 60;
      x.beginPath(); x.arc(cx - w * 0.8, y, 11 + 6 * Math.abs(Math.sin(i * 1.3)), 0, 7); x.fill();
      x.beginPath(); x.arc(cx + w * 0.8, y, 11 + 6 * Math.abs(Math.cos(i * 1.7)), 0, 7); x.fill();
    }
    const P = (t) => [150 + 40 * Math.sin(t * 9.5) * (1 - 0.4 * t), 430 - 330 * t, 10 * (1 - 0.55 * t)];
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= 70; i++) {
      const p = P(i / 70); x.fillStyle = pass ? '#b9b3a0' : INK; x.beginPath(); x.arc(p[0], p[1], p[2] + (pass ? 0 : 2.5), 0, 7); x.fill();
    }
    x.strokeStyle = '#3a3a40'; x.lineWidth = 1.5;
    for (let i = 2; i <= 68; i += 3) { const p = P(i / 70); x.beginPath(); x.arc(p[0], p[1] + 2, p[2] * 0.8, 0.2, 2.9); x.stroke(); }
    x.strokeStyle = INK; x.lineWidth = 3;
    [0.3, 0.65].forEach((t) => { const p = P(t); for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(p[0] + 8, p[1]); x.lineTo(p[0] + 24, p[1] + 6 + k * 7); x.stroke(); } });
    const h = P(1);
    x.fillStyle = '#b9b3a0'; x.beginPath(); x.moveTo(h[0] - 9, h[1] + 6); x.lineTo(h[0] + 4, h[1] - 24); x.lineTo(h[0] + 13, h[1] + 4); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(h[0] - 4, h[1] - 2); x.lineTo(h[0] - 18, h[1] + 12); x.moveTo(h[0] + 8, h[1] - 2); x.lineTo(h[0] + 24, h[1] + 10); x.stroke();
    x.lineWidth = 1.6; x.beginPath(); x.moveTo(h[0] + 2, h[1] - 20); x.bezierCurveTo(h[0] - 26, h[1] - 34, h[0] - 30, h[1] - 6, h[0] - 40, h[1] - 16);
    x.moveTo(h[0] + 6, h[1] - 20); x.bezierCurveTo(h[0] + 30, h[1] - 38, h[0] + 36, h[1] - 8, h[0] + 48, h[1] - 20); x.stroke();
    x.fillStyle = '#fbf7ec'; x.beginPath(); x.arc(h[0] + 3, h[1] - 8, 3, 0, 7); x.fill(); x.fillStyle = INK; x.beginPath(); x.arc(h[0] + 3, h[1] - 8, 1.3, 0, 7); x.fill();
    const m = billboard(cv, 70, 140, false); m.renderOrder = -4;
    return m;
  };

  // ---- Ejiri in Suruga: papers torn away by a gust ----
  H.makePaperTex = function () {
    const cv = canvas(32, 40), x = cv.getContext('2d');
    x.beginPath(); x.moveTo(4, 6); x.lineTo(28, 2); x.lineTo(26, 36); x.lineTo(6, 38); x.closePath();
    x.fillStyle = '#fbf7ec'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = INK; x.stroke();
    x.lineWidth = 1; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(11, 10); x.lineTo(11, 30); x.moveTo(18, 9); x.lineTo(18, 26); x.stroke();
    return new THREE.CanvasTexture(cv);
  };

  // ---- a torii standing in the shallows ----
  H.makeTorii = function () {
    const g = new THREE.Group(), red = 0xb5402c, part = H.part;
    for (const s of [-1, 1]) {
      const p = part(new THREE.CylinderGeometry(0.42, 0.55, 9.6, 8), red, 1.12); p.position.set(s * 4, 4.4, 0); p.rotation.z = -s * 0.04;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.25, 16), new THREE.MeshBasicMaterial({ color: C.foam, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s * 4, 0.2, 0);
      g.add(p, ring);
    }
    const top = part(new THREE.BoxGeometry(11.8, 0.75, 1.0), 0x14213a, 1.03); top.position.y = 9.5;
    const top2 = part(new THREE.BoxGeometry(11.0, 0.5, 0.9), red, 1.06); top2.position.y = 8.9;
    const tie = part(new THREE.BoxGeometry(9.2, 0.45, 0.5), red, 1.1); tie.position.y = 6.7;
    const mid = part(new THREE.BoxGeometry(0.5, 1.7, 0.3), red, 1.15); mid.position.y = 7.8;
    for (const s of [-1, 1]) { const e = part(new THREE.BoxGeometry(1.7, 0.75, 1.0), 0x14213a, 1.05); e.position.set(s * 5.9, 9.68, 0); e.rotation.z = s * 0.2; g.add(e); }
    g.add(top, top2, tie, mid);
    return g;
  };

  // ---- a red banner planted on the wave where your best ride ended ----
  H.makeNoboriTex = function (label) {
    const cv = canvas(64, 256), x = cv.getContext('2d');
    x.strokeStyle = INK; x.lineWidth = 5; x.beginPath(); x.moveTo(10, 4); x.lineTo(10, 254); x.stroke();
    x.fillStyle = '#b5402c'; x.fillRect(13, 10, 42, 170); x.lineWidth = 3; x.strokeRect(13, 10, 42, 170);
    x.fillStyle = '#fbf7ec'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    label.split('').forEach((ch, i) => x.fillText(ch, 34, 36 + i * 36));
    return new THREE.CanvasTexture(cv);
  };
})();
