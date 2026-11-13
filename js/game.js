// game.js — input, physics, the journey through four prints, goals, camera, loop
(function () {
  const H = window.H, A = H.audio;
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const MORTAL = Q.get('mortal') === '1', AUTO = Q.get('autoplay') === '1', FF = parseFloat(Q.get('t') || '0') || 0;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const rnd = (a, b) => a + Math.random() * (b - a);       // cosmetic randomness
  let R = Math.random;                                      // layout randomness (seeded for the Daily Wave)
  const sr = (a, b) => a + R() * (b - a);
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const L = H.STAGE_LEN, NV = H.VIEWS.length, ROMAN = ['I', 'II', 'III', 'IV'];
  const DAY = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 864e5);

  // ---------- renderer / scene ----------
  const canvas = $('gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { document.querySelector('#title .how').textContent = 'This browser cannot draw 3D graphics (WebGL is off). Try Chrome or Safari on a newer phone.'; return; }
  renderer.setClearColor(H.C.cream);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 4000);
  const sky = H.makeSky(), wave = H.makeWave(), surfer = H.makeSurfer();
  const fujis = [0, 1, 2, 3].map((i) => H.makeFuji(i));
  const dragon = H.makeDragon(), rock = H.makeRock();
  dragon.visible = rock.visible = false;
  const spray = H.makeSpray(700);
  scene.add(sky, ...fujis, dragon, wave, rock, surfer, spray.pts);
  scene.fog = new THREE.Fog(H.C.seaFar, 190, 345);

  const pool = (n, make, extra) => { const a = []; for (let i = 0; i < n; i++) { const o = make(); o.visible = false; scene.add(o); a.push(Object.assign({ o, on: false, z: 0, x: 0 }, extra ? extra(i) : null)); } return a; };
  const boats = pool(4, H.makeBoat), bolts = pool(12, H.makeBolt), toriis = pool(2, H.makeTorii);
  const birdMat = new THREE.SpriteMaterial({ map: H.makeChidoriTex(), transparent: true, depthWrite: false });
  const craneMat = new THREE.SpriteMaterial({ map: H.makeCraneTex(), transparent: true, depthWrite: false });
  const birds = pool(72, () => new THREE.Sprite(birdMat), (i) => ({ ph: i * 1.7, crane: false, sc: 2.3 }));
  const paperTex = H.makePaperTex();
  const papers = pool(12, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: paperTex, transparent: true, depthWrite: false, rotation: rnd(-0.6, 0.6) })), (i) => ({ ph: i * 2.1, vx: 0, vy: 0, vz: 0, y: 0 }));
  const nobori = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.makeNoboriTex('BEST'), transparent: true, depthWrite: false }));
  nobori.scale.set(1.7, 6.8, 1); nobori.visible = false; scene.add(nobori);

  // paper grain
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d');
    const d = x.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) {
      const fib = (Math.random() < 0.035 ? -34 : 0), v = 232 + Math.random() * 23 + fib;
      d.data[i] = v; d.data[i + 1] = v - 3; d.data[i + 2] = v - 12; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
  })();

  let portrait = true;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    portrait = h > w;
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- persistent progress ----------
  const load = (k) => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } };
  const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
  let best = load('namiura_best'), bestD = load('namiura_bestd'), seen = clamp(load('namiura_views'), 1, NV);
  let marks = load('namiura_marks'), tut = load('namiura_tut'), dayBest = load('namiura_d' + DAY);
  const GOALS = [
    ['Land a clean spin', (s) => s.spinMax >= 1], ['Ride a tube for 3 seconds', (s) => s.tubeMax >= 3], ['Leap over a boat', (s) => s.leaps >= 1],
    ['Catch 3 cranes in one run', (s) => s.cranes >= 3], ['Build FLOW ×25', (s) => s.comboMax >= 25], ['Land a SPIN ×2', (s) => s.spinMax >= 2],
    ['Thread 6 lightning bolts in one run', (s) => s.threaded >= 6], ['Land a spin in the storm', (s) => s.stormSpin], ['Cross the storm', (s) => s.st >= 3],
    ['Catch 30 birds in the blue print', (s) => s.blueBirds >= 30], ['Land a SPIN ×3', (s) => s.spinMax >= 3], ['Complete the journey', (s) => s.st >= 4],
  ];
  const markCount = () => { let n = 0; for (let i = 0; i < 12; i++) if (marks >> i & 1) n++; return n; };
  function applySkin() { // goals unlock new colours for board and rider
    const n = markCount(), u = surfer.userData;
    u.board.material.color.set(n >= 9 ? 0x1f4e79 : n >= 3 ? 0xb5402c : 0xb98a4e);
    u.torso.material.color.set(n >= 6 ? 0xf4efe0 : 0x1f3a63);
    u.hat.material.color.set(n >= 12 ? 0xd9a441 : 0xd6b46f);
  }
  applySkin();
  function renderSeals(el, fresh) {
    let h = '';
    for (let i = 0; i < NV; i++) {
      let dots = ''; for (let k = 0; k < 3; k++) dots += '<i' + (marks >> (i * 3 + k) & 1 ? ' class="on"' : '') + '></i>';
      h += '<span class="sw"><span class="seal' + (i < seen ? ' got' : '') + (fresh === i ? ' new' : '') + '" data-i="' + i + '" title="' + H.VIEWS[i].name + '">' + ROMAN[i] + '</span><span class="dots">' + dots + '</span></span>';
    }
    const cap = fresh >= 0 ? 'NEW PRINT DISCOVERED · ' + H.VIEWS[fresh].name
      : seen >= NV ? 'ALL FOUR PRINTS DISCOVERED · GOALS ' + markCount() + ' / 12'
      : 'PRINTS DISCOVERED ' + seen + ' / ' + NV + ' · NEXT: ' + H.VIEWS[seen].hook.toUpperCase();
    el.innerHTML = h + '<div class="cap">' + cap + '</div>';
  }
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  function renderTitle() {
    renderSeals($('tSeals'), -1);
    $('tPick').textContent = seen > 1 ? 'Tap a red seal to begin from that print' : '';
    $('tBest').textContent = best > 0 ? 'BEST ' + fmt(best) : '';
    $('tDaily').innerHTML = 'DAILY WAVE #' + DAY + (dayBest ? '<small>today’s best ' + fmt(dayBest) + '</small>' : '<small>the same wave for everyone today</small>');
  }
  renderTitle();

  // ---------- state ----------
  const S = { mode: 'title', ai: true };
  const o = {}, o2 = {};
  let lastFrom = 0, lastDaily = false;
  function reset() {
    Object.assign(S, {
      dist: 0, p: 3, vp: 0, v: 20, base: 20, lean: 0, air: false, ax: 0, ay: 0, avx: 0, avy: 0, airT: 0, spin: 0, spinVis: 0,
      score: 0, combo: 0, comboT: 0, birdsGot: 0, t: 0, nextZ: 70, nPat: 0, deadT: 0, shake: 0, x: 0, y: 0, th: 0,
      tubeT: 0, tubeOut: 0, tubePts: 0, tubeSeen: false, st: 0, mult: 1, va: 0, vb: 0, vk: 0, flash: 0, thT: 0, lipAcc: 0, newSeal: -1,
      warp: false, daily: false, climbT: 0, gustAt: 0, lastKind: '', closing: -1, goalT: 0, passedBest: false, why: '',
      src: { ride: 0, birds: 0, air: 0, tube: 0, bonus: 0 },
      stat: { spinMax: 0, tubeMax: 0, cranes: 0, comboMax: 0, leaps: 0, threaded: 0, stormSpin: false, blueBirds: 0, st: 0 },
    });
    H.haz.length = 0;
    for (const a of [boats, bolts, birds, toriis, papers]) for (const b of a) { b.on = false; b.o.visible = false; }
    spray.clear();
  }
  reset();

  // ---------- input ----------
  let input = 0, pid = null, anchor = 0, kL = false, kR = false;
  const touches = new Map();
  const range = () => clamp(Math.min(window.innerWidth, window.innerHeight) * 0.16, 44, 90);
  const canStart = () => S.mode === 'title' || (S.mode === 'over' && S.deadT > 1.3);
  function tap() { A.init(); if (canStart()) start(S.mode === 'title' ? 0 : lastFrom, S.mode === 'title' ? false : lastDaily); }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); tap();
    touches.set(e.pointerId, e.clientX);
    pid = e.pointerId; anchor = e.clientX + input * range(); // newest thumb takes over without a jump
    try { canvas.setPointerCapture(pid); } catch (err) {}
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, e.clientX);
    if (e.pointerId !== pid) return;
    const r = range(); let dx = e.clientX - anchor;
    if (dx > r) { anchor = e.clientX - r; dx = r; } else if (dx < -r) { anchor = e.clientX + r; dx = -r; } // floating anchor: reversals respond instantly
    input = -dx / r;
  });
  const up = (e) => {
    touches.delete(e.pointerId); if (e.pointerId !== pid) return;
    const rest = [...touches.keys()].pop();
    if (rest === undefined) { pid = null; input = 0; } else { pid = rest; anchor = touches.get(rest); input = 0; }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  const unlock = () => A.init(); // touch only counts as a user gesture on release
  window.addEventListener('pointerup', unlock); window.addEventListener('touchend', unlock); window.addEventListener('click', unlock);
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = true;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = true;
    else if (e.code === 'Space' || e.code === 'Enter') { tap(); e.preventDefault(); }
    else if (e.code === 'KeyM') toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') kL = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') kR = false;
  });
  const muteBtn = $('mute');
  function toggleMute() { A.init(); A.setMuted(!A.muted); muteBtn.style.opacity = A.muted ? 0.45 : 1; muteBtn.textContent = A.muted ? '×' : '♪'; }
  const press = (el, fn) => el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(e); });
  press(muteBtn, toggleMute);
  if (A.muted) { muteBtn.style.opacity = 0.45; muteBtn.textContent = '×'; }
  const pickSeal = (e) => { // begin from any print already discovered
    const t = e.target.closest && e.target.closest('.seal'); if (!t || !canStart()) return;
    const i = parseInt(t.getAttribute('data-i'), 10); if (i < seen) { A.init(); start(i, false); }
  };
  press($('tSeals'), pickSeal); press($('oSeals'), pickSeal);
  press($('tDaily'), () => { if (canStart()) { A.init(); start(0, true); } });
  press($('oShare'), () => {
    const st = Math.floor(S.dist / L), url = location.origin + location.pathname;
    const text = (S.daily ? 'NAMIURA Daily Wave #' + DAY + ' — ' : '') + 'I rode Hokusai’s Great Wave as far as ' + H.VIEWS[st % NV].hook + ' — ' + fmt(S.score) + ' points in NAMIURA. Can you reach the next print? ' + url;
    const done = () => { $('oShare').textContent = 'COPIED'; setTimeout(() => { $('oShare').textContent = 'SHARE'; }, 1600); };
    try {
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
    } catch (err) {}
  });
  const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  // ---------- HUD ----------
  const elScore = $('score'), elSub = $('sub'), elCombo = $('combo'), elPop = $('pop'), elHint = $('hint'), elHud = $('hud');
  const elBanner = $('banner'), elProg = $('progf'), elRain = $('rain'), elProgWrap = $('prog');
  let shown = -1, rainShown = -1, subShown = '';
  if (window.matchMedia && matchMedia('(pointer:fine)').matches) elHint.innerHTML = '<b>←</b>Hold ← or A to climb the wave<span>let go to slide back down</span>';
  function pop(main, sub) {
    elPop.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    elPop.classList.remove('go'); void elPop.offsetWidth; elPop.classList.add('go');
  }
  function cue(bit, main, sub) { if (tut & bit || S.ai) return; tut |= bit; save('namiura_tut', tut); pop(main, sub); }
  function add(pts, kind) { const p = pts * S.mult; S.score += p; S.src[kind || 'bonus'] += p; return p; }
  const speedBonus = () => 1 + clamp((S.v - S.base) / 15, 0, 1) * 0.5; // pumped speed pays
  function viewLabel(st) { const j = Math.floor(st / NV); return (j > 0 ? 'JOURNEY ' + (j + 1) + ' · ' : '') + 'VIEW ' + ROMAN[st % NV]; }
  function banner(st, bonus, fresh) {
    const v = H.VIEWS[st % NV], j = Math.floor(st / NV);
    let sub = j > 0 && st % NV === 0 ? 'the sea runs faster now' : v.sub;
    if (S.mult > 1) sub += ' · score ×' + S.mult;
    if (bonus) sub += ' · +' + fmt(bonus);
    elBanner.innerHTML = '<i>' + (fresh ? 'NEW PRINT DISCOVERED · ' : '') + viewLabel(st) + '</i><b>' + v.name + '</b><small>' + sub + '</small>';
    elBanner.classList.remove('go'); void elBanner.offsetWidth; elBanner.classList.add('go');
  }
  function start(from, daily) {
    reset(); S.mode = 'play'; S.ai = AUTO; lastFrom = from; lastDaily = !!daily; S.daily = !!daily;
    R = daily ? mulberry32(DAY * 7919 + 13) : Math.random;
    if (from > 0) { // open inside the gate tube, so the run begins with the reveal
      S.dist = from * L - 62; S.st = from - 1; S.mult = 1 + (from - 1) * 0.5; S.nextZ = from * L + 150; S.nPat = 5; S.warp = true;
      S.v = S.base = 20 + Math.min(S.dist / 130, 15); S.p = 9;
    }
    S.gustAt = S.dist + 120;
    $('title').classList.remove('on'); $('over').classList.remove('on');
    elHud.style.opacity = 1; elProgWrap.style.opacity = 1;
    elHint.style.opacity = from > 0 ? 0 : 1;
    elCombo.style.opacity = 0; elPop.classList.remove('go'); elBanner.classList.remove('go'); shown = -1; subShown = '';
    applySkin(); save('namiura_runs', load('namiura_runs') + 1);
    A.pluck(0); setTimeout(() => A.pluck(2), 140); setTimeout(() => A.pluck(4), 280);
    if (daily) pop('DAILY WAVE #' + DAY, 'the same sea for every rider today');
  }
  function onStage(st) { // surfacing from the tube into the next print
    S.st = st; S.stat.st = Math.max(S.stat.st, st); S.mult = 1 + st * 0.5;
    if (S.mode !== 'play') return;
    const j = Math.floor(st / NV);
    let bonus = S.warp ? 0 : 500 * st; S.warp = false;
    if (st % NV === 0 && st > 0) { bonus += 2000 * j; pop('JOURNEY COMPLETE', 'four views of Mount Fuji'); }
    S.score += bonus; S.src.bonus += bonus;
    let fresh = false;
    if (!S.ai && Math.min(NV, st + 1) > seen) { seen = Math.min(NV, st + 1); save('namiura_views', seen); S.newSeal = seen - 1; fresh = true; }
    banner(st, bonus, fresh); A.chime(); buzz([20, 40, 20]);
  }
  function checkGoals() {
    for (let i = 0; i < 12; i++) if (!(marks >> i & 1) && GOALS[i][1](S.stat)) {
      marks |= 1 << i; save('namiura_marks', marks);
      pop('GOAL COMPLETE', GOALS[i][0]); A.chime(); applySkin(); return;
    }
  }
  const WHY = {
    boat: ['RAN INTO A BOAT', 'Steer around boats — or launch off the lip and leap them for +500.'],
    bolt: ['STRUCK BY LIGHTNING', 'The glowing ring marks each strike. The lone bird shows the safe side.'],
    claw: ['DRAGGED UNDER BY THE FOAM', 'When white claws reach down the wave, drop low and ride beneath them.'],
  };
  function wipeout(key) {
    if (S.mode !== 'play' || (S.ai && !MORTAL)) return;
    S.mode = 'over'; S.deadT = 0; S.shake = 1; S.why = key;
    A.taiko(0.9); A.splash(0.5); buzz([60, 40, 120]);
    for (let i = 0; i < 70; i++) spray.emit(S.x, S.y + 0.5, -S.dist, rnd(-9, 9), rnd(4, 17), rnd(-16, 4), rnd(0.2, 0.7), rnd(0.8, 1.7), 22);
    surfer.visible = false; checkGoals();
    const sc = Math.floor(S.score), rec = sc > best;
    if (rec) { best = sc; save('namiura_best', best); }
    if (S.dist > bestD) { bestD = Math.floor(S.dist); save('namiura_bestd', bestD); }
    if (S.daily && sc > dayBest) { dayBest = sc; save('namiura_d' + DAY, dayBest); }
    $('oWhy').textContent = WHY[key][0]; $('oTip').textContent = WHY[key][1];
    $('oScore').textContent = fmt(sc);
    $('oBest').innerHTML = rec ? '<span class="rec">NEW BEST</span>' : fmt(best - sc) + ' short of your best';
    const st = Math.floor(S.dist / L), toNext = Math.ceil((st + 1) * L - S.dist), nx = H.VIEWS[(st + 1) % NV].hook;
    $('oReach').textContent = (S.daily ? 'Daily Wave #' + DAY + ' · ' : '') + viewLabel(st) + ' · ' + H.VIEWS[st % NV].name;
    $('oTease').textContent = toNext <= 250 ? 'So close — ' + nx + ' was only ' + toNext + ' m away.' : 'Next print: ' + nx + ', ' + toNext + ' m ahead.';
    const tot = Math.max(1, S.score), parts = [['Birds', S.src.birds], ['Air', S.src.air], ['Tube', S.src.tube], ['Ride', S.src.ride + S.src.bonus]];
    $('oStats').textContent = fmt(S.dist) + ' m ridden · ' + parts.filter((p) => p[1] / tot >= 0.03).map((p) => p[0] + ' ' + Math.round(p[1] / tot * 100) + '%').join(' · ');
    let g = -1; for (let i = 0; i < 12; i++) if (!(marks >> i & 1)) { g = i; break; }
    $('oGoal').textContent = g >= 0 ? 'Next goal: ' + GOALS[g][0] + ' (' + markCount() + ' of 12 done)' : 'All 12 goals complete — Master of the Views';
    renderSeals($('oSeals'), S.newSeal); renderTitle();
    setTimeout(() => { if (S.mode === 'over') $('over').classList.add('on'); }, 650);
  }

  // ---------- spawning ----------
  function addBird(x, y, z, crane) {
    for (const b of birds) if (!b.on) {
      b.on = true; b.x = x; b.y = y; b.z = z; b.crane = !!crane; b.sc = crane ? 4.6 : 2.3;
      b.o.material = crane ? craneMat : birdMat; b.o.scale.set(b.sc, b.sc, 1); b.o.visible = true; b.o.position.set(x, y, z); return;
    }
  }
  function birdOnFace(p, z) { H.surf(p, z, o2); addBird(o2.x + o2.nx * 1.1, o2.y + o2.ny * 1.1, z); }
  const baseSpeed = (d) => 20 + Math.min(d / 130, 15) + Math.min(Math.floor(d / (NV * L)), 4) * 3;
  function spawn() {
    let d0 = S.nextZ;
    const diff = clamp(d0 / 2800, 0, 1), jr = Math.min(Math.floor(d0 / (NV * L)), 4);
    // keep the gates clear: only a line of birds threading the tube
    const gi = Math.round(d0 / L);
    if (gi >= 1 && d0 > gi * L - 115 && d0 < gi * L + 70) {
      for (let i = 0; i < 11; i++) { const z = -(gi * L - 44 + i * 8.8); birdOnFace(1.42 * H.RM(z), z); }
      S.nextZ = gi * L + 150; return;
    }
    const view = Math.floor(d0 / L) % NV, n = S.nPat++;
    let len = 60, kind;
    if (n === 0) kind = 'S'; else if (n === 1) kind = 'air'; else if (n === 2) kind = 'boat';
    else {
      const r = R();
      if (view === 1) kind = r < 0.18 ? 'S' : r < 0.52 ? 'air' : r < 0.78 ? 'boat' : 'claw';
      else if (view === 2) kind = r < 0.12 ? 'S' : r < 0.26 ? 'air' : r < 0.62 ? 'bolt' : r < 0.80 ? 'boat' : 'claw';
      else if (view === 3) kind = r < 0.30 ? 'S' : r < 0.50 ? 'air' : r < 0.68 ? 'boat' : r < 0.80 ? 'torii' : 'claw';
      else kind = r < 0.20 ? 'S' : r < 0.40 ? 'air' : r < 0.64 ? 'boat' : r < 0.74 ? 'torii' : 'claw';
      if (jr > 0 && view !== 2 && R() < 0.1) kind = 'bolt'; // the storm follows you on later journeys
    }
    const toGate = (Math.floor(d0 / L) + 1) * L - d0;
    if (toGate < 215 && kind !== 'air') kind = 'S';                                   // the run-up to every gate is a line of birds
    if (kind === 'bolt' && (S.lastKind === 'bolt' || bolts.filter((b) => !b.on).length < 4)) kind = 'air';
    if (kind === 'torii' && !toriis.some((t) => !t.on)) kind = 'boat';
    if (kind === 'air') { // slide forward to open water rather than under a barrel
      let g = 0; while (H.thMax(-(d0 + 24 + g)) > 2.55 && g < 120) g += 8;
      if (g < 120 && toGate - g > 150) d0 += g; else kind = 'S';
    }
    S.lastKind = kind;
    if (kind === 'S') {
      const ph = sr(0, 6), cnt = view === 3 ? 13 : 9;
      for (let i = 0; i < cnt; i++) birdOnFace(8 + 5 * Math.sin(ph + i * 0.75), -(d0 + i * 7));
      len = cnt * 7;
    } else if (kind === 'air') {
      // guide up the face, then an arc of birds above the lip (a crane at the apex under Red Fuji)
      for (let i = 0; i < 4; i++) birdOnFace(3 + i * 4.2, -(d0 + i * 5));
      const z0 = -(d0 + 24), pl = Math.min(H.thMax(z0) - 0.24, 1.95) * H.RM(z0); H.surf(pl, z0, o2);
      const vx = clamp(o2.tx * 12 + o2.nx * 2.5, -2, 5), vy = Math.max(11, o2.ty * 12 + o2.ny * 2.5 + 5.5), vz = baseSpeed(d0) + 3;
      const crane = view === 1 || (jr > 0 && R() < 0.3);
      for (let i = 1; i <= 5; i++) { const t = i * 0.3; addBird(o2.x + vx * t, o2.y + vy * t - 12 * t * t, z0 - vz * t, crane && i === 3); }
      if (n === 1) S.airCue = d0 - 30;
      len = 75;
    } else if (kind === 'boat') {
      const b = boats.find((b) => !b.on);
      if (b) {
        b.on = true; b.passed = false; b.z = -(d0 + 30); b.x = n > 4 ? sr(1.5, 8.5) : sr(7.6, 12.5); b.o.visible = true; b.o.rotation.y = sr(-0.12, 0.12);
        const pb = H.pAt(b.x, b.z); // the bird line shaves past the hull: a close call is worth taking
        for (let i = 0; i < 5; i++) birdOnFace(pb + 3.8 + 0.5 * Math.abs(i - 2.5), -(d0 + 10 + i * 9));
      }
      if (diff > 0.35 && R() < diff) {
        const b2 = boats.find((b) => !b.on);
        if (b2) { b2.on = true; b2.passed = false; b2.z = -(d0 + 56); b2.x = sr(10.5, 16); b2.o.visible = true; b2.o.rotation.y = sr(-0.12, 0.12); }
      }
      len = 62;
    } else if (kind === 'bolt') {
      // a slalom of lightning strikes; a lone bird marks the safe side of each
      const hi = sr(4.2, 6.6), lo = Math.min(sr(-1, 2.2), hi - 4.6), xs = [hi, lo], side = R() < 0.5 ? 0 : 1;
      const sp = Math.max(30, baseSpeed(d0) * 1.15), cnt = jr > 0 ? 4 : 3;
      for (let i = 0; i < cnt; i++) {
        const b = bolts.find((b) => !b.on); if (!b) break;
        b.on = true; b.heard = false; b.passed = false; b.z = -(d0 + 30 + i * sp); b.x = xs[(i + side) % 2] + sr(-0.4, 0.4); b.o.visible = true;
        const zb = b.z + 6; H.surf(H.pAt(xs[(i + side + 1) % 2], zb), zb, o2); addBird(o2.x + o2.nx * 1.1, o2.y + o2.ny * 1.1, zb);
      }
      len = 40 + cnt * sp;
    } else if (kind === 'torii') {
      const t = toriis.find((t) => !t.on);
      t.on = true; t.passed = false; t.z = -(d0 + 36); t.x = 13; t.o.visible = true;
      for (let i = 0; i < 5; i++) birdOnFace(-(2.5 + i * 1.1), -(d0 + 8 + i * 6));
      len = 60;
    } else {
      const Lc = sr(34, 46) + diff * 24, c = -(d0 + 22 + Lc / 2);
      H.haz.push({ z: c, hl: Lc / 2, d: sr(0.95, 1.25) + 0.9 * diff });
      for (let i = 0; i < 6; i++) birdOnFace(2.2 + 1.5 * Math.sin(i * 0.9), c + Lc / 2 - 4 - i * (Lc - 8) / 5);
      len = Lc + 34;
    }
    S.nextZ = d0 + len + (62 - 34 * diff) * sr(0.8, 1.2) * (view === 3 ? 0.8 : 1) / (1 + 0.15 * jr);
  }

  // ---------- AI (attract mode / autoplay) ----------
  function aiInput() {
    const zw = -S.dist;
    let target = 10 + 9.5 * Math.sin(S.t * 0.8);
    if (H.hazAt(zw - 26) > 0.2 || H.hazAt(zw - 6) > 0.2) target = 3;
    for (const b of boats) if (b.on && b.z < zw + 5 && b.z > zw - 50 && target < 7) target = 9;
    return clamp((target - S.p) * 0.3 - S.vp * 0.06, -1, 1);
  }

  // ---------- simulation ----------
  const G_SLOPE = 10, G_HEIGHT = 9, THRUST = 33, G_AIR = 24;
  function land() {
    const zw = -S.dist;
    S.air = false; S.p = Math.max(-15, H.pAt(S.ax, zw)); H.surf(S.p, zw, o);
    S.vp = clamp((S.avx * o.tx + S.avy * o.ty) * 0.55, -16, 6);
    const turns = Math.round(Math.abs(S.spin) / (Math.PI * 2));
    const off = Math.abs(S.spin - Math.PI * 2 * Math.round(S.spin / (Math.PI * 2)));
    S.shake = 0.55;
    for (let i = 0; i < 26; i++) spray.emit(S.ax + rnd(-1, 1), S.ay + 0.2, zw + rnd(-1, 1), rnd(-7, 7), rnd(3, 11), rnd(-9, 2), rnd(0.12, 0.4), rnd(0.5, 1.1), 20);
    if (S.mode === 'play' && Math.abs(S.spin) > 1.2 && off > 1.05) { // still sideways: no points, lose speed
      S.v *= 0.78; S.combo = 0; S.comboT = 0; elCombo.style.opacity = 0;
      pop('SLOPPY LANDING', 'let go before you land'); A.splash(0.4); buzz(50);
    } else if (S.mode === 'play' && S.airT > 0.45) {
      S.v += 3 + turns * 1.5;
      const pts = add((Math.floor(S.airT * 250) + 500 * turns * turns) * speedBonus(), 'air');
      S.combo += 2 + 2 * turns; S.comboT = 2.4; flow();
      S.stat.spinMax = Math.max(S.stat.spinMax, turns); if (turns > 0 && S.vb === 2) S.stat.stormSpin = true;
      pop((turns > 0 ? 'SPIN ×' + turns : S.airT > 2.1 ? 'BIG AIR' : 'AIR') + '  +' + fmt(pts), turns > 1 ? 'clean landing' : '');
      A.taiko(0.6); A.splash(0.25); buzz(30);
    } else if (S.mode === 'play') A.splash(0.15);
    S.spinVis = S.spin - Math.PI * 2 * Math.round(S.spin / (Math.PI * 2));
    S.spin = 0;
  }
  function flow() { S.stat.comboMax = Math.max(S.stat.comboMax, S.combo); elCombo.textContent = 'FLOW ×' + S.combo; elCombo.style.opacity = S.combo > 1 ? 1 : 0; }
  function update(dt) {
    S.t += dt;
    S.flash = Math.max(0, S.flash - dt * 3.2); S.thT -= dt;
    if (S.mode === 'over') { S.deadT += dt; S.shake = Math.max(0, S.shake - dt * 2); spray.update(dt); return; }
    const playing = S.mode === 'play', mortal = playing && (!S.ai || MORTAL);
    const raw = S.ai ? aiInput() : clamp(input + (kL ? 1 : 0) - (kR ? 1 : 0), -1, 1);
    S.lean += (raw - S.lean) * Math.min(1, dt * 18);
    const zw = -S.dist;
    const base = S.base = baseSpeed(S.dist);

    if (!S.air) {
      H.surf(S.p, zw, o);
      let acc = S.lean * THRUST - (G_SLOPE * o.ty + G_HEIGHT * o.th) - 0.9 * S.vp;
      if (S.p < 0) acc += 5 + Math.max(0, -11 - S.p) * 4;      // the sea draws you back to the wave
      S.vp += acc * dt; S.p += S.vp * dt;
      if (S.p < -16) { S.p = -16; S.vp = Math.max(0, S.vp); }
      const tM = H.thMax(zw), barrel = tM > 2.6 || H.gate(zw - S.v * 2.0) > 0; // under a barrel you ride the tube instead of launching
      const pLip = Math.min(tM - 0.24, barrel ? 1.75 : 1.95) * H.RM(zw);
      if (S.p > pLip) {
        if (S.vp > 4 && !barrel) { // launch off the lip
          H.surf(pLip, zw, o);
          S.air = true; S.airT = 0; S.spin = 0;
          S.ax = o.x; S.ay = o.y; S.avx = clamp(o.tx * S.vp + o.nx * 2.5, -2, 5);
          S.avy = Math.max(11, o.ty * S.vp + o.ny * 2.5 + 5.5) + clamp((S.v - base) * 0.3, 0, 4.5); // pumped speed means bigger air
          if (playing) { A.pluck(5 + (Math.random() * 3 | 0), 0.2); buzz(15); cue(16, 'AIR!', 'drag to spin · let go before you land'); }
          for (let i = 0; i < 18; i++) spray.emit(o.x, o.y, zw, S.avx * 0.5 + rnd(-3, 3), S.avy * 0.6 + rnd(-2, 5), rnd(-8, 0), rnd(0.12, 0.4), rnd(0.6, 1.2), 16);
        } else { S.p = pLip; if (S.vp > 0) S.vp = barrel ? 0 : -0.6 * S.vp - 3; }
      }
      const pump = Math.max(0, -S.vp * o.ty);
      S.v += (base - S.v) * 0.55 * dt + pump * 0.55 * dt;
      S.v = Math.min(S.v, base + 15);
    } else {
      S.airT += dt;
      S.avy -= G_AIR * dt; S.avx += -S.lean * 4 * dt;
      S.ax += S.avx * dt; S.ay += S.avy * dt;
      S.spin += S.lean * 9.5 * dt;
      H.surf(Math.min(H.thMax(zw) - 0.24, 1.95) * H.RM(zw), zw, o2);
      const minX = S.avy < 0 ? o2.x + 0.6 : H.TROUGH - H.R(zw) + 0.5;
      if (S.ax < minX) { S.ax = minX; S.avx = Math.max(0, S.avx); }
      if (S.ax > H.TROUGH + 15) { S.ax = H.TROUGH + 15; S.avx = Math.min(0, S.avx); }
      if (S.avy < 0 && S.ay <= H.heightAt(S.ax, zw)) land();
    }
    S.dist += S.v * dt;
    const z = -S.dist;
    if (S.air) { S.x = S.ax; S.y = S.ay; S.th = 0; }
    else { H.surf(S.p, z, o); S.x = o.x; S.y = o.y; S.th = o.th; }

    // which print are we in? the palette turns over while the tube hides the sky
    const gi = Math.round(S.dist / L);
    if (gi >= 1 && Math.abs(S.dist - gi * L) < 18) { S.va = (gi - 1) % NV; S.vb = gi % NV; S.vk = H.smooth(-18, 18, S.dist - gi * L); }
    else { S.va = S.vb = Math.floor(S.dist / L) % NV; S.vk = 0; }
    const sb = Math.max(0, Math.floor((S.dist - 42) / L));
    if (sb > S.st) onStage(sb);

    if (playing) {
      add(S.v * dt * 0.5, 'ride');
      if (S.lean > 0.4) S.climbT += dt;
      if ((S.climbT > 0.6 || S.t > 9) && elHint.style.opacity !== '0') elHint.style.opacity = 0;
      if (S.airCue && S.dist > S.airCue) { S.airCue = 0; if (!(tut & 16) && !S.ai) pop('CLIMB TO THE LIP', 'drag left and fly off the top'); }
      // tube ride: high on the face under an overhanging lip — the longer you stay, the more it pays
      const tube = !S.air && S.th > 1.25 && H.thMax(z) > 2.62;
      if (tube) {
        if (S.tubeT === 0) { S.tubePts = 0; if (!S.tubeSeen) { S.tubeSeen = true; pop('NAMI-URA', 'beneath the wave'); } }
        S.tubeT += dt; S.tubeOut = 0; S.comboT = Math.max(S.comboT, 1.2);
        S.tubePts += add(S.v * dt * Math.min(8, 1 + 2.5 * S.tubeT), 'tube');
      } else if (S.tubeT > 0) {
        S.tubeOut += dt;
        if (S.tubeOut > 0.3) {
          S.stat.tubeMax = Math.max(S.stat.tubeMax, S.tubeT);
          if (S.tubeT > 0.7) pop('TUBE ' + S.tubeT.toFixed(1) + ' s  +' + fmt(S.tubePts));
          S.tubeT = 0;
        }
      }
      if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; elCombo.style.opacity = 0; } }
      const left = (gi0(S.dist) + 1) * L - S.dist;
      if (left < 100 && S.closing !== gi0(S.dist)) { S.closing = gi0(S.dist); pop('THE WAVE IS CLOSING', 'ride the tube into the next print'); }
      if (!S.passedBest && bestD > 150 && S.dist > bestD) { S.passedBest = true; if (!S.ai) { pop('PAST YOUR BEST', 'every metre is new water'); A.chime(); buzz(25); } }
      S.goalT -= dt; if (S.goalT < 0 && mortal) { S.goalT = 0.5; checkGoals(); }
    }
    while (S.dist + 330 > S.nextZ) spawn();

    // boats
    for (const b of boats) {
      if (!b.on) continue;
      if (b.z > z + 40) { b.on = false; b.o.visible = false; continue; }
      const by = H.heightAt(b.x, b.z);
      b.o.position.set(b.x, by - 0.25 + 0.15 * Math.sin(S.t * 1.6 + b.z), b.z);
      b.o.rotation.z = 0.06 * Math.sin(S.t * 1.3 + b.z); b.o.rotation.x = 0.05 * Math.sin(S.t * 1.1 + b.z * 2);
      if (playing && b.z > z - 75) cue(1, 'BOAT AHEAD', 'steer around it · or jump it');
      if (!mortal) continue;
      const dz = Math.abs(z - b.z), dx = Math.abs(S.x - b.x);
      if (dz < 8.6 && dx < 1.9 && S.y < by + 2.8) { wipeout('boat'); return; }
      if (!b.passed && z < b.z - 8.6) {
        b.passed = true;
        if (dx < 3.8) {
          const leap = S.air && dx < 2.2; if (leap) S.stat.leaps++;
          const pts = add(leap ? 500 : 300); S.combo += 2; S.comboT = 2.4; flow();
          pop((leap ? 'BOAT LEAP  +' : 'CLOSE CALL  +') + fmt(pts)); A.pluck(7, 0.2);
        }
      }
    }
    // lightning
    for (const b of bolts) {
      if (!b.on) continue;
      if (b.z > z + 30) { b.on = false; b.o.visible = false; continue; }
      const by = H.heightAt(b.x, b.z), fl = Math.sin(S.t * 31 + b.z) > -0.2, rs = 1 + 0.25 * Math.sin(S.t * 9 + b.z);
      b.o.position.set(b.x, by, b.z); b.o.scale.set(0.62, 1, 1); b.o.userData.core.visible = fl;
      b.o.userData.ring.scale.set(1.6 * rs, rs, 1);
      if (!b.heard && b.z > z - 120) {
        b.heard = true;
        if (S.thT <= 0) { S.thT = 2.5; S.flash = 1; if (playing) A.thunder(0.5); } else S.flash = Math.max(S.flash, 0.3);
        if (playing) cue(4, 'LIGHTNING', 'the lone bird shows the safe side');
      }
      if (!mortal) continue;
      const dx = Math.abs(S.x - b.x);
      if (Math.abs(z - b.z) < 2.2 && dx < 1.5 && S.y < by + 7) { S.flash = 1; wipeout('bolt'); return; }
      if (!b.passed && z < b.z - 2.2) {
        b.passed = true;
        if (dx < 3.6) { S.stat.threaded++; const pts = add(200); S.combo += 1; S.comboT = 2.4; flow(); pop('THREADED  +' + fmt(pts)); A.pluck(8, 0.2); }
      }
    }
    // torii in the shallows
    for (const t of toriis) {
      if (!t.on) continue;
      if (t.z > z + 30) { t.on = false; t.o.visible = false; continue; }
      t.o.position.set(t.x, H.heightAt(t.x, t.z) - 0.4, t.z);
      if (playing && !t.passed && z < t.z) {
        t.passed = true;
        const dx = Math.abs(S.x - t.x);
        if (S.air && S.y > 9.5 && dx < 6) { const pts = add(800); pop('OVER THE TORII  +' + fmt(pts)); A.chime(); }
        else if (!S.air && dx < 3.3) { const pts = add(400); S.combo += 3; S.comboT = 2.4; flow(); pop('THROUGH THE TORII  +' + fmt(pts)); A.chime(); }
      }
    }
    // foam claws
    for (let i = H.haz.length - 1; i >= 0; i--) {
      const h = H.haz[i];
      if (h.z - h.hl > z + 60) { H.haz.splice(i, 1); continue; }
      if (playing && h.z + h.hl > z - 75) cue(2, 'FOAM CLAWS', 'stay low on the wave');
    }
    if (mortal && !S.air) {
      const hd = H.hazAt(z);
      if (hd > 0.45 && S.th > Math.min(H.thMax(z), 2.19) - 0.12 - hd * 0.52) { wipeout('claw'); return; }
    }
    // birds: plovers and cranes
    for (const b of birds) {
      if (!b.on) continue;
      if (b.z > z + 20) { b.on = false; b.o.visible = false; continue; }
      b.o.position.y = b.y + 0.18 * Math.sin(S.t * 5 + b.ph);
      b.o.scale.y = b.sc * (0.74 + 0.26 * Math.sin(S.t * (b.crane ? 7 : 13) + b.ph));
      if (!playing) continue;
      const dx = S.x - b.x, dy = S.y + 0.9 - b.y, dz = z - b.z, r2 = b.crane ? 22 : (S.air ? 13 : 7.5);
      if (dx * dx + dy * dy < r2 && Math.abs(dz) < 2.8) {
        b.on = false; b.o.visible = false;
        S.combo++; S.comboT = 2.4; S.birdsGot++; flow();
        if (S.vb === 3) S.stat.blueBirds++;
        if (b.crane) { S.stat.cranes++; const pts = add(300 * speedBonus(), 'birds'); pop('CRANE  +' + fmt(pts)); A.chime(); }
        else { add((20 + 10 * Math.min(S.combo, 20)) * speedBonus(), 'birds'); cue(8, 'FLOW', 'catch birds in a row · every trick keeps it alive'); }
        A.pluck((S.combo - 1) % 10, 0.2); buzz(8);
        for (let i = 0; i < 5; i++) spray.emit(b.x, b.y, b.z - 1, rnd(-3, 3), rnd(2, 6), -S.v * 0.8 + rnd(-2, 2), rnd(0.1, 0.22), 0.5, 10);
      }
    }
    // Ejiri: a gust tears papers across the sky under Red Fuji
    if (S.vb === 1 && S.dist > S.gustAt) {
      S.gustAt = S.dist + rnd(220, 300);
      for (const p of papers) {
        p.on = true; p.o.visible = true; p.x = S.x - 26 - rnd(0, 22); p.y = S.y + 14 + rnd(0, 18); p.z = z - 20 - rnd(0, 120);
        p.vx = rnd(10, 16); p.vy = rnd(-2, 1); p.vz = -S.v * 0.55;
      }
    }
    for (const p of papers) {
      if (!p.on) continue;
      p.x += p.vx * dt; p.y += (p.vy + Math.sin(S.t * 5 + p.ph) * 2) * dt; p.z += p.vz * dt;
      p.o.position.set(p.x, p.y, p.z); p.o.scale.set(1.7 * Math.cos(S.t * 7 + p.ph), 2.1, 1);
      if (p.x > S.x + 70 || p.z > z + 20) { p.on = false; p.o.visible = false; }
    }
    // spray: lip dots hanging in the sky + board wake
    S.lipAcc += dt * 200;
    while (S.lipAcc >= 1) {
      S.lipAcc--;
      const pz = z - 3 - Math.pow(Math.random(), 2.0) * 185, th = H.thMax(pz) - 0.04; H.surf(th * H.RM(pz), pz, o2);
      spray.emit(o2.x, o2.y, pz, o2.tx * rnd(2, 7) + rnd(0, 2), o2.ty * rnd(2, 7) + rnd(1, 5), rnd(-2, 2), rnd(0.10, 0.40), rnd(1.1, 2.3), 7);
    }
    if (!S.air) {
      const k = Math.min(1, Math.abs(S.vp) / 9);
      if (Math.random() < (0.35 + k) * dt * 60) {
        H.surf(S.p, z, o);
        const sd = S.vp > 0 ? -1 : 1;
        spray.emit(S.x + o.nx * 0.2, S.y + o.ny * 0.2, z + 1.2, o.tx * sd * rnd(2, 6) * k + o.nx * rnd(1, 4), o.ty * sd * rnd(2, 6) * k + o.ny * rnd(1, 4) + 1.5, rnd(2, 6), rnd(0.08, 0.14 + 0.24 * k), rnd(0.35, 0.8), 16);
      }
    }
    spray.update(dt);
    S.shake = Math.max(0, S.shake - dt * 2.4);
  }
  const gi0 = (d) => Math.floor(d / L);

  // ---------- presentation ----------
  const vF = new THREE.Vector3(), vU = new THREE.Vector3(), vR = new THREE.Vector3(), mB = new THREE.Matrix4(), qT = new THREE.Quaternion(), qS = new THREE.Quaternion();
  const camP = new THREE.Vector3(8, 6, 12), camL = new THREE.Vector3(0, 4, -16), tmp = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let camInit = false;
  function present(dt) {
    const z = -S.dist;
    H.surf(S.p, z, o);
    // surfer orientation: board follows the surface and the carve direction
    if (S.air) { vU.set(0.25, 1, 0).normalize(); vF.set(S.avx * 0.35, S.avy * 0.35, -S.v).normalize(); }
    else { vU.set(o.nx, o.ny, 0).lerp(Y, 0.35 * H.smooth(1.2, 1.9, S.th)).normalize(); vF.set(o.tx * S.vp, o.ty * S.vp, -S.v).normalize(); }
    vR.crossVectors(vF, vU).normalize(); vU.crossVectors(vR, vF).normalize();
    mB.makeBasis(vR, vU, tmp.copy(vF).negate()); qT.setFromRotationMatrix(mB);
    S.spinVis = S.air ? S.spin : S.spinVis * Math.max(0, 1 - dt * 14);
    qS.setFromAxisAngle(Y, S.spinVis); qT.multiply(qS);
    qS.setFromAxisAngle(tmp.set(0, 0, 1), S.lean * 0.42); qT.multiply(qS);
    surfer.quaternion.slerp(qT, Math.min(1, dt * 16));
    surfer.position.set(S.x, S.y + 0.12, z); surfer.scale.setScalar(1.25);
    const ud = surfer.userData;
    ud.body.rotation.z = S.lean * 0.38;
    ud.body.scale.y = S.air ? 0.86 : 1 - 0.14 * Math.abs(S.lean);
    ud.a1.rotation.x = 1.25 + (S.air ? -0.7 : 0) - S.lean * 0.25; ud.a2.rotation.x = -1.25 + (S.air ? 0.7 : 0) - S.lean * 0.25;

    // camera: low behind, on the trough side, lip overhead on the left
    const sp = clamp((S.v - 20) / 30, 0, 1);
    const back = (portrait ? 11.5 : 9.5) + sp * 2.5, side = portrait ? 4.6 : 6.5, upo = portrait ? 3.6 : 3.0;
    tmp.set(S.x + side - S.x * 0.12, S.y * 0.86 + upo + (S.air ? 1.2 : 0), z + back);
    if (!camInit) { camP.copy(tmp); camInit = true; }
    const kx = 1 - Math.exp(-dt * (portrait ? 6.5 : 4.2));
    const ky = 1 - Math.exp(-dt * (S.air && S.avy < 0 ? 9 : 3.4));
    camP.x += (tmp.x - camP.x) * kx; camP.y += (tmp.y - camP.y) * ky; camP.z = tmp.z;
    const lx = portrait ? 1.8 : 4.0; // hard leash: the surfer can never leave the frame
    camP.x = clamp(camP.x, tmp.x - lx, tmp.x + lx); camP.y = clamp(camP.y, tmp.y - 3, tmp.y + 3);
    tmp.set(S.x * 0.75 - 2.2, S.y * 0.8 + 3.4 + (S.air ? clamp(S.avy * 0.12, -3, 0) : 0), z - 20);
    camL.x += (tmp.x - camL.x) * kx; camL.y += (tmp.y - camL.y) * kx; camL.z = tmp.z;
    camL.x = clamp(camL.x, tmp.x - 2.5, tmp.x + 2.5); camL.y = clamp(camL.y, tmp.y - 3, tmp.y + 3);
    camera.position.copy(camP);
    if (S.shake > 0) { camera.position.x += (Math.random() - 0.5) * S.shake * 0.7; camera.position.y += (Math.random() - 0.5) * S.shake * 0.7; }
    camera.lookAt(camL);
    camera.rotateZ(-S.lean * 0.055);
    const gateOut = H.smooth(0, 40, S.dist % L) * (1 - H.smooth(40, 90, S.dist % L)) * (S.dist > L * 0.5 ? 1 : 0); // the frame opens as you surface
    const fov = (portrait ? 74 : 56) + sp * 9 + gateOut * 7;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }

    // the print around us
    H.setView(S.va, S.vb, S.vk);
    scene.fog.color.copy(H.fogColor);
    H.skyMat.uniforms.uFlash.value = S.flash * S.flash;
    sky.position.copy(camera.position);
    const cur = S.vk < 0.5 ? S.va : S.vb, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    let fujiYaw = 0, fujiFs = 1;
    for (let i = 0; i < NV; i++) {
      const f = fujis[i]; f.visible = i === cur; if (!f.visible) continue;
      const big = H.VIEWS[i].fs > 1, fs = (portrait ? (big ? 0.8 : 0.62) : 1.2) * H.VIEWS[i].fs, sy = portrait && big ? 1.55 : 1; // Hokusai steepened Fuji too
      const yaw = Math.atan2(H.TROUGH - cx, 1000) + (portrait ? 0.075 - 0.06 * (H.VIEWS[i].fs - 1) : 0.17 + 0.035 * (H.VIEWS[i].fs - 1)); // just right of where the wave vanishes
      f.scale.set(fs, fs * sy, 1);
      f.position.set(cx + Math.sin(yaw) * 1000, cy + (31 * sy - 3) * fs, cz - Math.cos(yaw) * 1000);
      fujiYaw = yaw; fujiFs = fs;
    }
    const dIn = S.dist % L;
    // the dragon climbs out of the storm beside Fuji
    const dk = cur === 2 ? H.smooth(180, 520, dIn) * (1 - H.smooth(700, 780, dIn)) : 0;
    dragon.visible = dk > 0.01;
    if (dragon.visible) {
      const yaw = fujiYaw + (portrait ? -0.035 : 0.2), ds = fujiFs * (portrait ? 1.25 : 0.95);
      dragon.scale.setScalar(ds); dragon.material.opacity = Math.min(1, dk * 3);
      dragon.position.set(cx + Math.sin(yaw) * 990, cy + (-75 + 135 * dk) * ds, cz - Math.cos(yaw) * 990);
    }
    // the Kajikazawa rock and its fisherman, out over the surf
    rock.visible = false;
    if (cur === 3) {
      const s0 = Math.floor(S.dist / L) * L;
      for (let i = 0; i < 3; i++) { const zr = -(s0 + 170 + 250 * i); if (zr < cz + 20) { rock.visible = true; rock.position.set(portrait ? 37 : 43, 20.5, zr); rock.rotation.y = -0.32; break; } }
    }
    // the banner planted where your best ride ended
    nobori.visible = S.mode === 'play' && !S.ai && bestD > 150 && !S.passedBest && bestD - S.dist < 330;
    if (nobori.visible) { H.surf(9, -bestD, o2); nobori.position.set(o2.x + o2.nx * 3.4, o2.y + o2.ny * 3.4, -bestD); }

    const u = H.waveMat.uniforms; u.uZ.value = z; u.uTime.value = S.t;
    for (let i = 0; i < 4; i++) { const h = H.haz[i]; if (h) u.uHaz.value[i].set(h.z, h.hl, h.d); else u.uHaz.value[i].set(0, 0, 0); }
    spray.mat.uniforms.uMax.value = 44 * renderer.getPixelRatio();
    spray.mat.uniforms.uScale.value = renderer.domElement.height * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    const rn = Math.round(H.rain * 20) / 20; if (rn !== rainShown) { rainShown = rn; elRain.style.opacity = rn * 0.8; }

    if (S.mode === 'play') {
      const sc = Math.floor(S.score);
      if (sc !== shown) { shown = sc; elScore.textContent = fmt(sc); }
      const left = Math.max(10, Math.ceil((L - dIn) / 10) * 10), fast = S.v > S.base + 5;
      const sub = (S.mult > 1 ? 'SCORE ×' + S.mult + ' · ' : '') + (fast ? 'SPEED +' + Math.round((speedBonus() - 1) * 100) + '% · ' : '') + 'NEXT PRINT ' + left + ' m';
      if (sub !== subShown) { subShown = sub; elSub.textContent = sub; }
      elProg.style.transform = 'scaleX(' + (dIn / L).toFixed(3) + ')';
      A.wash(clamp((S.v - 18) / 30, 0, 1), S.air ? 0 : Math.min(1, Math.abs(S.vp) / 14));
    } else A.wash(0.15, 0);
    renderer.render(scene, camera);
  }

  // ---------- loop ----------
  let last = 0, paused = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    const n = dt > 0.02 ? 2 : 1;
    for (let i = 0; i < n; i++) update(dt / n);
    if (S.mode !== 'over') surfer.visible = true;
    present(dt);
  }
  document.addEventListener('visibilitychange', () => { paused = document.hidden; A.suspend(paused); pid = null; input = 0; touches.clear(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); paused = true; A.suspend(true); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  if (AUTO) start(parseInt(Q.get('from') || '0', 10) || 0, Q.get('daily') === '1');
  if (FF > 0) { for (let i = 0; i < FF * 60; i++) update(1 / 60); }
  camInit = false;
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
