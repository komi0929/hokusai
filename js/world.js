// world.js — 波・空・富士 (wave, sky, Fuji). All art procedural.
(function () {
  const H = (window.H = {});
  H.C = {
    cream: 0xe4d6b2, cream2: 0xd2c097, grey: 0x5a5b57, dark: 0x2f3336,
    deep: 0x0f2747, mid: 0x1f4e79, light: 0x5c86a8, pale: 0xb8c9d0,
    foam: 0xfbf7ec, tan: 0xc9a76b, ink: 0x14213a, seaFar: 0x40566a,
  };
  const TROUGH = 6; // x of the trough bottom
  H.TROUGH = TROUGH;

  // ---- wave profile, shared by JS physics and GLSL (keep in sync!) ----
  H.R = (zw) => 9 * (1 + 0.12 * Math.sin(zw * 0.017 + 2));
  // every STAGE_LEN metres the wave closes into a long tube: the gate between two prints
  H.STAGE_LEN = 800;
  H.gate = (zw) => { const k = Math.round(-zw / 800); return k >= 1 ? 1 - smooth(25, 60, Math.abs(zw + k * 800)) : 0; };
  H.thMax = (zw) => { const t = 2.45 + 0.4 * Math.sin(zw * 0.021) + 0.22 * Math.sin(zw * 0.053 + 1.3); return t + (4.3 - t) * H.gate(zw); };
  H.RM = (zw) => 1.12 * H.R(zw);
  const swell = (x, zw) => 0.35 * Math.sin(x * 0.3 + zw * 0.1) * smooth(10, 30, x);
  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  H.smooth = smooth;

  // p: metres along the profile from the trough (p<0 = flat sea, p>0 = up the face)
  H.surf = function (p, zw, o) {
    o = o || {};
    if (p <= 0) {
      o.x = TROUGH - p; o.y = swell(o.x, zw); o.tx = -1; o.ty = 0; o.th = 0;
    } else {
      const R = H.R(zw), th = p / (1.12 * R);
      const s = Math.sin(th), c = Math.cos(th);
      o.x = TROUGH - R * s; o.y = 1.25 * R * (1 - c);
      let tx = -R * c, ty = 1.25 * R * s; const l = Math.hypot(tx, ty) || 1;
      o.tx = tx / l; o.ty = ty / l; o.th = th;
    }
    o.nx = o.ty; o.ny = -o.tx; // normal toward the open (concave) side
    return o;
  };
  // height of the lower branch of the water surface at lateral x (for landings)
  H.heightAt = function (x, zw) {
    if (x >= TROUGH) return swell(x, zw);
    const R = H.R(zw), s = Math.min(0.999, (TROUGH - x) / R);
    return 1.25 * R * (1 - Math.sqrt(1 - s * s));
  };
  H.pAt = function (x, zw) {
    if (x >= TROUGH) return TROUGH - x;
    const R = H.R(zw), s = Math.min(0.999, (TROUGH - x) / R);
    return Math.asin(s) * 1.12 * R;
  };

  // ---- hazards: giant foam claws reaching down the face ----
  H.haz = []; // {z, hl, d}
  H.hazAt = function (zw) {
    let d = 0;
    for (const h of H.haz) d += h.d * (1 - smooth(h.hl - 6, h.hl, Math.abs(zw - h.z)));
    return d;
  };

  const col = (h) => new THREE.Color(h);

  // ---------------- wave mesh ----------------
  H.makeWave = function () {
    const NA = 104, NZ = 150;
    const pos = new Float32Array((NA + 1) * (NZ + 1) * 3);
    const idx = [];
    let k = 0;
    for (let j = 0; j <= NZ; j++) {
      const zl = 45 - 385 * Math.pow(j / NZ, 1.45);
      for (let i = 0; i <= NA; i++) {
        pos[k++] = i / NA; pos[k++] = 0; pos[k++] = zl;
      }
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NA; i++) {
      const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const haz = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const m = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      extensions: { derivatives: true },
      uniforms: {
        uZ: { value: 0 }, uTime: { value: 0 }, uHaz: { value: haz }, uFinger: { value: 1 },
        cDeep: { value: col(H.C.deep) }, cMid: { value: col(H.C.mid) }, cLight: { value: col(H.C.light) },
        cPale: { value: col(H.C.pale) }, cFoam: { value: col(H.C.foam) }, cInk: { value: col(H.C.ink) },
        cFar: { value: col(H.C.seaFar) },
      },
      vertexShader: `
        uniform float uZ;
        varying float vTh; varying float vThM; varying float vX; varying float vZw; varying float vFlat; varying float vDist; varying float vY;
        void main(){
          float a = position.x;
          float zw = position.z + uZ;
          float R = 9.0*(1.0+0.12*sin(zw*0.017+2.0));
          float thM = 2.45+0.4*sin(zw*0.021)+0.22*sin(zw*0.053+1.3);
          float gk = floor(-zw/800.0 + 0.5);
          if(gk > 0.5){ thM = mix(thM, 4.3, 1.0 - smoothstep(25.0, 60.0, abs(zw + gk*800.0))); }
          float x; float y; float th = 0.0; float fl = 0.0;
          if(a < 0.4){
            float f = 1.0 - a/0.4;
            x = 6.0 + f*10.0 + f*f*f*900.0;
            y = 0.35*sin(x*0.3+zw*0.1)*smoothstep(10.0,30.0,x);
            fl = 1.0;
          } else {
            th = (a-0.4)/0.6*thM;
            x = 6.0 - R*sin(th);
            y = 1.25*R*(1.0-cos(th));
          }
          vTh = th; vThM = thM; vX = x; vZw = zw; vFlat = fl; vY = y;
          vec4 mv = viewMatrix * vec4(x, y, zw, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uHaz[4]; uniform float uTime; uniform float uFinger;
        uniform vec3 cDeep, cMid, cLight, cPale, cFoam, cInk, cFar;
        varying float vTh; varying float vThM; varying float vX; varying float vZw; varying float vFlat; varying float vDist; varying float vY;
        float tri(float x){ return abs(fract(x)-0.5)*2.0; }
        float claw(float x){ float t = tri(x); return t*t*(3.0-2.0*t); }
        float hash(vec2 p){ p = mod(p, 289.0); vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        // hooked, round-tipped foam finger: >0 inside. e = radians beyond the finger root
        float finger(float f, float e, float len){
          float id = floor(f), u = fract(f) - 0.5;
          float L = len*(0.5 + 0.5*hash(vec2(id, 3.0)));
          if(e >= L) return -1.0;
          float t = e/L;
          return 0.43*pow(1.0-t, 0.55) - abs(u + 0.34*t*t);
        }
        vec3 bands(float s, vec3 d, vec3 m, vec3 l, vec3 p, vec3 f, vec3 ink, float aa){
          float b = fract(s), wob = 0.10*sin(floor(s)*12.9898);
          vec3 c = d;
          if(b > 0.42+wob) c = m;
          if(b > 0.74+wob) c = l;
          if(b > 0.93) c = p;
          if(b > 0.975) c = f;
          float bl = min(abs(b-(0.42+wob)), abs(b-(0.74+wob)));
          if(bl < 0.012 + aa) c = mix(c, ink, 0.55);
          return mix(c, m, smoothstep(0.2, 0.6, aa));
        }
        void main(){
          vec3 c;
          float z = vZw;
          if(vFlat > 0.5){
            // open sea: flat woodblock bands
            float w = sin(vX*0.45 + 1.5*sin(z*0.11)) * sin(z*0.31 + vX*0.07);
            float w2 = sin(vX*0.11 - z*0.05 + 2.0*sin(z*0.023));
            c = cDeep;
            if(w2 > 0.1) c = cMid;
            if(w > 0.62) c = cLight;
            float lw = 0.035 + fwidth(w)*1.2;
            if(abs(w-0.62) < lw) c = cPale;
            if(w > 0.93) c = cFoam;
            if(abs(w2-0.1) < 0.02 + fwidth(w2)) c = mix(c, cInk, 0.7);
            float xs = vX - 6.0;
            float s = z*0.22 - xs*0.16 + 0.6*sin(z*0.05 - xs*0.1);
            vec3 st = bands(s, cDeep, cMid, cLight, cPale, cFoam, cInk, fwidth(s));
            st = mix(cDeep, st, 0.72);
            float near = 1.0 - smoothstep(14.0, 70.0, xs);
            c = mix(c, st, near);
            if(w > 0.93 && xs > 9.0) c = cFoam;
            c = mix(c, cMid, smoothstep(120.0, 420.0, vDist + vX)*0.85);
          } else {
            float edge = vThM - vTh;
            float fz = z*0.40 + 1.5*sin(z*0.13);
            float big = 0.6 + 0.4*sin(z*0.07);
            float dfz = fwidth(fz);
            float lod = 1.0 - smoothstep(0.15, 0.5, dfz);
            float aa = fwidth(edge)*1.5, lw = 0.016 + aa;
            float base = 0.40, e = base - edge, fin = 1.0;
            if(e > 0.0){
              float len = base*(0.55 + 0.45*big)*lod*uFinger;
              fin = max(finger(fz, e, len), finger(z*1.13 + 0.37, e, len*0.55));
              if(fin < 0.0) discard;
            }
            float hz = 0.0;
            for(int i=0;i<4;i++){ hz += uHaz[i].z * (1.0 - smoothstep(uHaz[i].y-6.0, uHaz[i].y, abs(z-uHaz[i].x))); }
            float fw = base + 0.05 + 0.22*claw(z*0.27 + 2.0 + 0.3*sin(vTh*4.0))
                     + hz*(0.56 + 0.12*claw(z*0.21+0.5)) + (vThM - min(vThM, 2.19))*clamp(hz, 0.0, 1.0);
            // striped Prussian-blue face: bands flow up the curvature
            float s = z*0.22 + vTh*2.2 + 0.6*sin(vTh*3.0 + z*0.05);
            c = bands(s, cDeep, cMid, cLight, cPale, cFoam, cInk, fwidth(s));
            c = mix(cDeep, c, 0.72 + 0.28*smoothstep(0.15, 1.5, vTh));
            if(edge < fw){
              c = cFoam;
              vec2 q = vec2(z*0.9, vTh*7.0); vec2 cell = floor(q);
              float d = length(fract(q)-0.5);
              if(hash(cell) > 0.62 && d < 0.2 && d > 0.1) c = cPale;       // little curl marks
            }
            if(abs(edge - fw) < lw) c = cInk;
            if(e > 0.0 && fin < 0.05 + dfz) c = cInk;                       // finger outline
            if(e > -lw && e <= 0.0 && (lod < 0.5 || max(0.43-abs(fract(fz)-0.5), 0.43-abs(fract(z*1.13+0.37)-0.5)) < 0.0)) c = cInk;
          }
          float fog = smoothstep(170.0, 335.0, vDist);
          c = mix(c, cFar, fog*0.9);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    H.waveMat = m;
    return mesh;
  };

  // ---------------- sky dome ----------------
  H.makeSky = function () {
    const g = new THREE.SphereGeometry(1500, 48, 24);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: {
        c1: { value: col(H.C.cream) }, c2: { value: col(H.C.cream2) }, cg: { value: col(H.C.grey) },
        cd: { value: col(H.C.dark) }, cs: { value: col(H.C.seaFar) }, cc: { value: col(0xf4ecd6) }, uMack: { value: 0 }, uFlash: { value: 0 },
      },
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 c1,c2,cg,cd,cs,cc; uniform float uMack, uFlash; varying vec3 vD;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec3 d = normalize(vD); float h = d.y;
          if(h < 0.0){ gl_FragColor = vec4(cs, 1.0); return; }
          vec3 col = mix(c2, c1, smoothstep(0.12, 0.6, h));
          col = mix(cg, col, smoothstep(0.03, 0.30, h));
          col = mix(col, cd, (1.0 - smoothstep(0.0, 0.10, h))*0.85);
          float az = atan(d.x, -d.z);
          vec2 q = vec2(az*2.2, h*5.0);
          float bill = 1.0 - abs(noise(q*3.3+7.0)*2.0-1.0);            // scalloped edge
          float n = noise(q*1.1)*0.65 + bill*0.35;
          float m = n * smoothstep(0.20, 0.32, h) * (1.0 - smoothstep(0.58, 0.8, h));
          float cl = smoothstep(0.455, 0.462, m);
          cl *= 1.0 - uMack;
          col = mix(col, cc, cl);                                       // flat pale cloud
          if(uMack > 0.01){                                             // rows of mackerel cloud (Red Fuji)
            float v = 1.0/(h + 0.18);
            vec2 mq = vec2(az*16.0 + 2.0*noise(vec2(v*2.0, 1.0)), v*7.0);
            float rows = noise(mq)*0.6 + noise(mq*2.3 + 5.0)*0.4;
            float mk = smoothstep(0.53, 0.56, rows) * smoothstep(0.10, 0.22, h) * (1.0 - smoothstep(0.75, 0.95, h));
            col = mix(col, cc, mk*uMack);
          }
          col += uFlash*vec3(0.55, 0.5, 0.4);
          col = mix(col, mix(col, cg, 0.5), smoothstep(0.44, 0.447, m) - cl); // hairline
          if(h < 0.0) col = cs;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const s = new THREE.Mesh(g, m);
    H.skyMat = m;
    s.renderOrder = -10; s.frustumCulled = false;
    return s;
  };

  // ---------------- Fuji, four ways ----------------
  // 0 Great Wave (small, blue-grey) · 1 Red Fuji · 2 storm Fuji with lightning · 3 pale aizuri Fuji
  H.makeFuji = function (kind) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const x = cv.getContext('2d');
    const path = () => {
      x.beginPath(); x.moveTo(6, 250);
      x.bezierCurveTo(120, 232, 190, 150, 226, 62);
      x.lineTo(236, 50); x.lineTo(252, 56); x.lineTo(266, 48); x.lineTo(280, 58);
      x.bezierCurveTo(318, 150, 400, 232, 506, 250); x.closePath();
    };
    const streaks = (n, len, col) => { // snow lying in the gullies below the summit
      x.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), px = 222 + t * 62, l = len * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.3)));
        x.beginPath(); x.moveTo(px - 3.2, 52); x.lineTo(px + 3.2, 52); x.lineTo(px + (t - 0.5) * l * 0.9, 52 + l); x.closePath(); x.fill();
      }
    };
    path(); x.save(); x.clip();
    if (kind === 0 || kind === 3) {
      x.fillStyle = kind === 0 ? '#5a7890' : '#86a9c6'; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#fbf7ec'; x.beginPath(); x.moveTo(150, 0);
      x.lineTo(196, 132); x.lineTo(212, 108); x.lineTo(226, 142); x.lineTo(244, 104); x.lineTo(258, 146);
      x.lineTo(274, 106); x.lineTo(290, 140); x.lineTo(304, 112); x.lineTo(318, 136); x.lineTo(360, 0); x.closePath(); x.fill();
    } else if (kind === 1) {
      const g = x.createLinearGradient(0, 40, 0, 250);
      g.addColorStop(0, '#7d2a1b'); g.addColorStop(0.3, '#b8482e'); g.addColorStop(0.75, '#c9603c'); g.addColorStop(1, '#b8482e');
      x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#2f5d49'; x.beginPath(); x.moveTo(0, 256); x.lineTo(0, 236);       // the forest at its foot
      for (let i = 0; i <= 64; i++) x.lineTo(i * 8, 214 + 16 * Math.abs(Math.sin(i * 0.9)) + (i % 2) * 7 + Math.abs(i - 32) * 0.5);
      x.lineTo(512, 256); x.closePath(); x.fill();
      x.fillStyle = '#1f4234'; for (let i = 0; i < 90; i++) { const px = (i * 53) % 512, py = 232 + (i * 17) % 22; x.fillRect(px, py, 3, 5); }
      streaks(11, 78, '#fbf7ec');
    } else {
      const g = x.createLinearGradient(0, 40, 0, 250);
      g.addColorStop(0, '#6e2718'); g.addColorStop(0.38, '#8f3a22'); g.addColorStop(0.62, '#1b1d24'); g.addColorStop(1, '#101217');
      x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      streaks(11, 60, '#efe6cf');
      x.strokeStyle = '#f08a2c'; x.lineWidth = 5; x.lineJoin = 'miter'; x.beginPath();                 // the lightning at its flank
      x.moveTo(322, 168); x.lineTo(352, 186); x.lineTo(336, 196); x.lineTo(378, 214); x.lineTo(360, 224); x.lineTo(410, 246); x.stroke();
      x.lineWidth = 3; x.beginPath(); x.moveTo(352, 186); x.lineTo(372, 180); x.lineTo(366, 192); x.lineTo(392, 190); x.stroke();
    }
    x.restore();
    x.beginPath(); x.moveTo(6, 250); x.bezierCurveTo(120, 232, 190, 150, 226, 62);
    x.lineTo(236, 50); x.lineTo(252, 56); x.lineTo(266, 48); x.lineTo(280, 58); x.bezierCurveTo(318, 150, 400, 232, 506, 250);
    x.lineWidth = 4; x.strokeStyle = '#14213a'; x.lineJoin = 'round'; x.stroke();
    x.globalCompositeOperation = 'destination-out';
    const fg = x.createLinearGradient(0, 232, 0, 256); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = fg; x.fillRect(0, 232, 512, 24); x.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 62),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    m.renderOrder = -5;
    return m;
  };

  // ---------------- the four views of the journey ----------------
  const V = (name, sub, sky, sea, o) => Object.assign({ name, sub, sky: sky.map(col), sea: sea.map(col) }, o);
  H.VIEWS = [
    V('The Great Wave off Kanagawa', 'The sea rises', [0xe4d6b2, 0xd2c097, 0x5a5b57, 0x2f3336, 0xf4ecd6], [0x0f2747, 0x1f4e79, 0x5c86a8, 0xb8c9d0, 0x40566a], { mack: 0, rain: 0, fs: 1, fin: 1, hook: 'The Great Wave', fact: 'c. 1831. Fishermen row their catch toward Edo. Fuji is the small peak beneath the wave.' }),
    V('Fine Wind, Clear Morning', 'Red Fuji · cranes ride the south wind', [0x1d4a7a, 0x6f9dbd, 0xcfdcd2, 0xece7cf, 0xfbf7ec], [0x10355a, 0x236a93, 0x74aac4, 0xd3e4e1, 0x86a8b8], { mack: 1, rain: 0, fs: 3.4, fin: 0.6, hook: 'Red Fuji', fact: 'Known as Red Fuji: the mountain glowing at dawn under a late-summer south wind.' }),
    V('Rainstorm Beneath the Summit', 'Black Fuji · beware the lightning', [0x1b2230, 0x3a4250, 0x8c7b62, 0x16191f, 0xcdbf9f], [0x091829, 0x163557, 0x3d6283, 0x8fa6b6, 0x2a3440], { mack: 0, rain: 1, fs: 3.2, fin: 1.25, hook: 'The Thunderstorm', fact: 'The companion to Red Fuji: lightning breaks below a calm, clear summit.' }),
    V('Kajikazawa in Kai', 'The blue print · a sea of plovers', [0x86abc9, 0xc0d4dc, 0xe9ecdc, 0xbccdd4, 0xf7f6ea], [0x143a6b, 0x2c68a0, 0x7fa9cc, 0xd6e4ea, 0xa9c0cf], { mack: 0, rain: 0, fs: 1.7, fin: 0.85, hook: 'The Blue Print', fact: 'First printed almost entirely in Prussian blue, a pigment newly arrived from Europe.' }),
  ];
  H.rain = 0; H.fogColor = col(H.C.seaFar);
  H.setView = function (a, b, k) {
    const A = H.VIEWS[a], B = H.VIEWS[b], su = H.skyMat.uniforms, wu = H.waveMat.uniforms;
    const L = (u, x, y) => u.value.copy(x).lerp(y, k);
    L(su.c1, A.sky[0], B.sky[0]); L(su.c2, A.sky[1], B.sky[1]); L(su.cg, A.sky[2], B.sky[2]); L(su.cd, A.sky[3], B.sky[3]); L(su.cc, A.sky[4], B.sky[4]);
    L(su.cs, A.sea[4], B.sea[4]);
    L(wu.cDeep, A.sea[0], B.sea[0]); L(wu.cMid, A.sea[1], B.sea[1]); L(wu.cLight, A.sea[2], B.sea[2]); L(wu.cPale, A.sea[3], B.sea[3]); L(wu.cFar, A.sea[4], B.sea[4]);
    su.uMack.value = A.mack + (B.mack - A.mack) * k;
    wu.uFinger.value = A.fin + (B.fin - A.fin) * k;
    H.rain = A.rain + (B.rain - A.rain) * k;
    H.fogColor.copy(A.sea[4]).lerp(B.sea[4], k);
  };
})();
