// ---- Rundflug um das gewählte Grundstück bei Inaktivität (nur 3D-Standardansicht)
const IDLE = {
  t: Date.now(),
  on: false,
  saved: null,
  wait: 60000,
  w2: 60000,
  sp: 0.1,
  tl: 0,
  s2: false,
  cf: 0,
  ct: 0,
  cl: 0,
};
function idleTarget() {
  const p =
    S.par && S.par.poly && S.par.poly.length > 2
      ? S.par
      : P.find((q) => q.site && q.poly && q.poly.length > 2);
  if (!p) return null;
  const c = cen(p.poly),
    ar = area(p.poly);
  return { x: c[0], z: c[1], d: Math.max(110, Math.min(360, Math.sqrt(ar) * 3.2)) };
}
function idleBlocked() {
  if (typeof CAMX !== 'undefined' && CAMX.on) return true;
  const vis = (id) => {
    const e = document.getElementById(id);
    return e && e.style.display && e.style.display !== 'none';
  };
  if (HOME.open || !S.m3 || !S.geo || document.hidden || vis('wz') || vis('lay')) return true;
  try {
    if (camLocked()) return true;
  } catch (e) {
    logErr(e, 'idleBlocked');
  }
  try {
    if (typeof AN !== 'undefined' && (AN.tmp || AN.tool)) return true;
  } catch (e) {
    logErr(e, 'idleBlocked');
  }
  const a = document.activeElement;
  if ((a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || (a && a.isContentEditable)) return true;
  return false;
}
function idleStart() {
  const t = idleTarget();
  if (!t) return;
  IDLE.on = true;
  IDLE.saved = { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot };
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: { tx: t.x, tz: t.z, d: t.d, az: V.az, pol: 0.88, rot: V.rot },
    t0: performance.now(),
    dur: 2800,
  };
  IDLE.tl = 0;
}
function idleStage2() {
  const t = idleTarget();
  if (!t) return;
  IDLE.s2 = true;
  IDLE.ct = 1;
  cloudsInit();
  BIRD.t0 = performance.now();
  BIRD.pass = -1;
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: {
      tx: t.x,
      tz: t.z,
      d: Math.max(430, Math.min(1000, GEO.size * 1.05)),
      az: V.az,
      pol: 0.92,
      rot: V.rot,
    },
    t0: performance.now(),
    dur: 4500,
  };
  IDLE.tl = 0;
}
function idleStop() {
  IDLE.s2 = false;
  IDLE.ct = 0;
  if (!IDLE.on) return;
  IDLE.on = false;
  const sv = IDLE.saved;
  IDLE.saved = null;
  if (!sv) return;
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: sv,
    t0: performance.now(),
    dur: 1500,
  };
}
function idleAct() {
  IDLE.t = Date.now();
  if (IDLE.on) idleStop();
}
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
  addEventListener(ev, idleAct, { passive: true, capture: true }),
);
(function idleLoop(now) {
  try {
    {
      const df = IDLE.cl ? Math.min(250, now - IDLE.cl) : 16;
      IDLE.cl = now;
      IDLE.cf =
        IDLE.cf < IDLE.ct ? Math.min(IDLE.ct, IDLE.cf + df / 3000) : Math.max(IDLE.ct, IDLE.cf - df / 1500);
    }
    if (IDLE.on) {
      if (idleBlocked()) {
        IDLE.on = false;
        IDLE.saved = null;
        IDLE.s2 = false;
        IDLE.ct = 0;
      } else if (!S.vanim) {
        const dt = IDLE.tl ? Math.min(60, now - IDLE.tl) : 16;
        IDLE.tl = now;
        V.az += (IDLE.sp * dt) / 1000;
        V.pol = IDLE.s2 ? 0.92 + Math.sin(now / 5000) * 0.03 : 0.88 + Math.sin(now / 4000) * 0.05;
        if (!IDLE.s2 && Date.now() - IDLE.t > IDLE.wait + IDLE.w2) idleStage2();
      } else IDLE.tl = 0;
    } else if (Date.now() - IDLE.t > IDLE.wait && !S.vanim && !idleBlocked()) idleStart();
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(idleLoop);
})(performance.now());

// ---- Freie Flächen (Grünfläche, Platz, Wasser) und Auswahlkasten
S.areas = [];
S.areaN = 0;
S.selA = null;
S.multi = [];
S.multiA = [];
S.dm = 'bld';
const AT = {
  green: { n: 'Grünfläche', l: 'green', c: () => S.lc.green },
  plaza: { n: 'Platz / Pflaster', l: 'paths', c: () => '#d6d2c6' },
  water: { n: 'Wasserfläche', l: 'water', c: () => S.lc.water },
  road: { n: 'Straße', l: 'roads', c: () => S.lc.roads },
};
function areaPaint() {
  /* Flächen werden in recomp() über uAreas()/uRoads() gezeichnet – immer vor dem Grundstück */
}
function areasApply() {
  if (!GEO.acc || !S.geo) return;
  ctxPaint(GEO.acc);
  recomp();
}
function areaSelDraw() {
  while (GA.children.length) {
    const o = GA.children.pop();
    o.geometry.dispose();
  }
  const L = [...(S.selA ? [S.selA] : []), ...(S.multiA || [])];
  for (const a of L) {
    const pts = [];
    a.poly.forEach((q, i) => {
      const r = a.poly[(i + 1) % a.poly.length],
        n = Math.max(1, Math.ceil(Math.hypot(r[0] - q[0], r[1] - q[1]) / 2));
      for (let k = 0; k < n; k++) {
        const x = q[0] + ((r[0] - q[0]) * k) / n,
          z = q[1] + ((r[1] - q[1]) * k) / n;
        pts.push(new T.Vector3(x, gh(x, z) + 0.7, z));
      }
    });
    const l = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: 0x5e7f92, depthTest: false, transparent: true }),
    );
    l.renderOrder = 20;
    GA.add(l);
  }
  try {
    ueDraw();
  } catch (e) {
    logErr(e, 'areaSelDraw');
  }
}

// ---- Eigene Flächen & Straßen: immer vor dem Grundstück, Kontur nachträglich bearbeitbar; Straßen = Linie mit ausgerundeten Ecken, Breite/Radius änderbar
const UE = { w: 6, r: 10, drag: null, raf: 0 };
const GU = new T.Group();
sc.add(GU);
function ueRound(pts, r) {
  const n = pts.length;
  if (n < 3 || !(r > 0)) return pts.map((p) => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1],
      b = pts[i],
      c = pts[i + 1];
    let u1 = [a[0] - b[0], a[1] - b[1]],
      u2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(u1[0], u1[1]),
      l2 = Math.hypot(u2[0], u2[1]);
    if (l1 < 1e-6 || l2 < 1e-6) {
      out.push([b[0], b[1]]);
      continue;
    }
    u1 = [u1[0] / l1, u1[1] / l1];
    u2 = [u2[0] / l2, u2[1] / l2];
    const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (th > Math.PI - 0.02 || th < 0.02) {
      out.push([b[0], b[1]]);
      continue;
    }
    const tn = Math.tan(th / 2);
    let t = r / tn;
    const tm = Math.min(l1, l2) * 0.5;
    if (t > tm) t = tm;
    const rr_ = t * tn;
    let bs = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(bs[0], bs[1]) || 1;
    bs = [bs[0] / bl, bs[1] / bl];
    const d = rr_ / Math.sin(th / 2),
      C = [b[0] + bs[0] * d, b[1] + bs[1] * d],
      T1 = [b[0] + u1[0] * t, b[1] + u1[1] * t],
      T2 = [b[0] + u2[0] * t, b[1] + u2[1] * t];
    let a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]),
      da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const st = Math.max(2, Math.ceil(Math.abs(da) / (Math.PI / 18)));
    for (let k = 0; k <= st; k++) {
      const an = a1 + (da * k) / st;
      out.push([C[0] + Math.cos(an) * rr_, C[1] + Math.sin(an) * rr_]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}
function ueOutline(L, w) {
  const n = L.length,
    h = w / 2;
  if (n < 2) return [];
  const nm = L.map((p, i) => {
    const a = L[Math.max(0, i - 1)],
      b = L[Math.min(n - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  });
  const lf = L.map((p, i) => [p[0] + nm[i][0] * h, p[1] + nm[i][1] * h]),
    rg = L.map((p, i) => [p[0] - nm[i][0] * h, p[1] - nm[i][1] * h]);
  const cap = (c, a0) => {
    const o = [];
    for (let k = 1; k < 6; k++) {
      const an = a0 - (k * Math.PI) / 6;
      o.push([c[0] + Math.cos(an) * h, c[1] + Math.sin(an) * h]);
    }
    return o;
  };
  const e1 = Math.atan2(nm[n - 1][1], nm[n - 1][0]),
    e0 = Math.atan2(-nm[0][1], -nm[0][0]);
  return lf.concat(cap(L[n - 1], e1), rg.slice().reverse(), cap(L[0], e0));
}
function roadRebuild(a) {
  a.line = ueRound(a.pts, a.r);
  a.poly = ueOutline(a.line, a.w);
}
function ulen(L) {
  let t = 0;
  for (let i = 1; i < L.length; i++) t += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
  return t;
}
function uaCol(c, t) {
  const n = parseInt(c.slice(1), 16),
    m = (r, g, b, k) =>
      '#' +
      [
        [(n >> 16) & 255, r],
        [(n >> 8) & 255, g],
        [n & 255, b],
      ]
        .map(([a, z]) =>
          Math.round(a + (z - a) * k)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
  return t === 'green'
    ? m(150, 220, 100, 0.45)
    : t === 'water'
      ? m(120, 190, 235, 0.3)
      : m(250, 244, 228, 0.35);
}
function uRoads(x, K, X) {
  const L = LY.find((l) => l[1] === 'roads');
  if (L && !L[2]) return;
  x.globalAlpha = L ? L[3] : 1;
  x.lineCap = x.lineJoin = 'round';
  for (const pass of [0, 1])
    for (const a of S.areas || []) {
      if (a.type !== 'road' || !a.line || a.line.length < 2) continue;
      x.strokeStyle = pass ? S.lc.roads : shade(S.lc.roads, 0.78);
      x.lineWidth = Math.max(1, (a.w + (pass ? 0 : 0.9)) * K);
      x.beginPath();
      a.line.forEach(([p, q], i) => (i ? x.lineTo(X(p), X(q)) : x.moveTo(X(p), X(q))));
      x.stroke();
    }
  x.globalAlpha = 1;
}
function stPanel() {
  return `<h4>Straße zeichnen</h4><div class="card">Breite (m)<input type="number" min="1" max="60" step="0.5" value="${UE.w}" oninput="UE.w=Math.max(1,+this.value||6)">Eckenradius (m)<input type="number" min="0" max="100" step="1" value="${UE.r}" oninput="UE.r=Math.max(0,+this.value||0)"><div style="color:var(--mu);margin-top:6px">Punkte klicken wie bei Freiform (Fang auf Punkte, Kanten, rechte Winkel). Enter oder Doppelklick beendet die Linie, Rücktaste nimmt den letzten Punkt zurück. Ecken werden ausgerundet. Breite und Radius lassen sich danach in der Straßenkarte ändern.</div><button class="pri" onclick="streetFinish()">Straße erzeugen</button><button class="sm" style="margin-top:6px" onclick="cancel();tool('v');rr()">Abbrechen</button></div>`;
}
function setStreet() {
  cancel();
  S.dm = 'street';
  S.shape = 'free';
  S.tab = 'Planen';
  S.selA = null;
  S.multi = [];
  S.multiA = [];
  areaSelDraw();
  tool('f');
  try {
    H();
    hpos();
  } catch (e) {
    logErr(e, 'setStreet');
  }
  nav();
  rr();
  document.querySelectorAll('#tbar .tg.open').forEach((x) => x.classList.remove('open'));
}
function streetFinish() {
  const pts = S.draft
    .filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.3)
    .map((q) => [q[0], q[1]]);
  if (pts.length < 2) {
    gst('Straße: mindestens zwei Punkte setzen.');
    return;
  }
  const a = {
    id: 'A' + ++S.areaN,
    name: 'Straße ' + (S.areas.filter((q) => q.type === 'road').length + 1),
    type: 'road',
    pts,
    w: UE.w,
    r: UE.r,
  };
  roadRebuild(a);
  S.areas.push(a);
  cancel();
  S.dm = 'bld';
  S.selA = a;
  S.tab = 'Planen';
  areaSelDraw();
  ueAfter(a);
  tool('v');
  rr();
  gst(
    a.name +
      ' erzeugt (' +
      f1(ulen(a.line)) +
      ' m lang, ' +
      f1(a.w) +
      ' m breit). Punkte ziehen, Breite in der Karte rechts ändern.',
  );
}
function roadCard(a) {
  return `<h4>Straße</h4><div class="card">Name<input type="text" value="${esc(a.name)}" onchange="S.selA.name=this.value">Breite (m)<input id="uw" type="number" min="1" max="60" step="0.5" value="${a.w}" oninput="ueSet('w',this.value,'uwr')"><input id="uwr" type="range" min="1" max="40" step="0.5" value="${a.w}" oninput="ueSet('w',this.value,'uw')" style="width:100%">Eckenradius (m)<input id="ur" type="number" min="0" max="100" step="1" value="${a.r}" oninput="ueSet('r',this.value,'urr')"><input id="urr" type="range" min="0" max="60" step="1" value="${a.r}" oninput="ueSet('r',this.value,'ur')" style="width:100%">${kv('Länge', f1(ulen(a.line || a.pts)) + ' m')}${kv('Fläche', f1(area(a.poly)) + ' m²')}<div style="color:var(--mu);font-size:11px;margin-top:4px">Linie: weiße Punkte ziehen · blauen Mittelpunkt ziehen = neuer Punkt · Doppelklick auf einen Punkt = löschen.</div><button class="sm" style="margin-top:6px" onclick="areaDel('${a.id}')">Straße löschen</button></div>`;
}
function ueSet(k, v, other) {
  const a = S.selA;
  if (!a || a.type !== 'road') return;
  v = parseFloat(v);
  if (!isFinite(v)) return;
  a[k] = k === 'w' ? Math.max(1, Math.min(60, v)) : Math.max(0, Math.min(100, v));
  const o = $(other);
  if (o) o.value = a[k];
  ueAfter(a, 1);
}
function ueScr(x, z) {
  const v = new T.Vector3(x, gh(x, z) + 0.7, z).project(act()),
    r = cv.getBoundingClientRect();
  return [((v.x + 1) / 2) * r.width + r.left, ((1 - v.y) / 2) * r.height + r.top, v.z];
}
function ueVerts(a) {
  return a ? (a.type === 'road' ? a.pts : a.poly) : null;
}
function ueDraw() {
  if (!GU) return;
  while (GU.children.length) {
    const o = GU.children.pop();
    o.geometry.dispose();
    o.material.dispose();
  }
  const a = S.selA;
  if (!a || S.tool !== 'v' || (S.multiA && S.multiA.length > 1) || (S.multi && S.multi.length)) return;
  const V_ = ueVerts(a);
  if (!V_ || !V_.length) return;
  const v3 = (q) => new T.Vector3(q[0], gh(q[0], q[1]) + 0.8, q[1]),
    n = V_.length,
    seg = a.type === 'road' ? n - 1 : n;
  if (a.type === 'road') {
    const ln = new T.Line(
      new T.BufferGeometry().setFromPoints(V_.map(v3)),
      new T.LineBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true }),
    );
    ln.renderOrder = 21;
    GU.add(ln);
  }
  const mids = [];
  for (let i = 0; i < seg; i++) {
    const p = V_[i],
      q = V_[(i + 1) % n];
    mids.push(v3([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]));
  }
  const pt = (arr, size, col, ro) => {
    if (!arr.length) return;
    const m = new T.Points(
      new T.BufferGeometry().setFromPoints(arr),
      new T.ShaderMaterial({
        uniforms: { c: { value: new T.Color(col) }, s: { value: size * (devicePixelRatio || 1) } },
        vertexShader:
          'uniform float s;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=s;}',
        fragmentShader:
          'uniform vec3 c;void main(){vec2 d=gl_PointCoord-.5;if(dot(d,d)>.25)discard;gl_FragColor=vec4(c,1.);}',
        depthTest: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    m.renderOrder = ro;
    m.frustumCulled = false;
    GU.add(m);
  };
  pt(mids, 9, 0x3b82f6, 22);
  pt(V_.map(v3), 14, 0x222222, 23);
  pt(V_.map(v3), 9, 0xffffff, 24);
}
function ueHit(e) {
  const a = S.selA;
  if (!a || S.tool !== 'v' || (S.multiA && S.multiA.length > 1) || (S.multi && S.multi.length)) return null;
  const V_ = ueVerts(a);
  if (!V_) return null;
  const n = V_.length,
    seg = a.type === 'road' ? n - 1 : n;
  let best = null,
    bd = 13;
  V_.forEach((q, i) => {
    const s = ueScr(q[0], q[1]);
    if (s[2] > 1) return;
    const d = Math.hypot(s[0] - e.clientX, s[1] - e.clientY);
    if (d < bd) {
      bd = d;
      best = { k: 'v', i };
    }
  });
  if (best) return best;
  bd = 11;
  for (let i = 0; i < seg; i++) {
    const p = V_[i],
      q = V_[(i + 1) % n],
      s = ueScr((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    if (s[2] > 1) continue;
    const d = Math.hypot(s[0] - e.clientX, s[1] - e.clientY);
    if (d < bd) {
      bd = d;
      best = { k: 'm', i };
    }
  }
  return best;
}
function ueAfter(a, light) {
  if (a.type === 'road') roadRebuild(a);
  areaSelDraw();
  if (light) {
    if (!UE.raf)
      UE.raf = requestAnimationFrame(() => {
        UE.raf = 0;
        try {
          if (GEO.comp) recomp();
        } catch (e) {
          logErr(e, 'ueAfter>anonym');
        }
      });
  } else {
    try {
      if (GEO.comp) recomp();
    } catch (e) {
      logErr(e, 'ueAfter');
    }
  }
}
cv.addEventListener(
  'pointerdown',
  (e) => {
    if (e.button !== 0) return;
    const h = ueHit(e);
    if (!h) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const a = S.selA,
      V_ = ueVerts(a);
    if (h.k === 'm') {
      const p = V_[h.i],
        q = V_[(h.i + 1) % V_.length];
      V_.splice(h.i + 1, 0, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      h.i = h.i + 1;
      ueAfter(a);
    }
    UE.drag = { a, i: h.i };
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
cv.addEventListener(
  'pointermove',
  (e) => {
    const d = UE.drag;
    if (!d) return;
    e.stopImmediatePropagation();
    const g = ground(e);
    if (!g) return;
    ueVerts(d.a)[d.i] = [g[0], g[1]];
    ueAfter(d.a, 1);
  },
  true,
);
cv.addEventListener(
  'pointerup',
  (e) => {
    const d = UE.drag;
    if (!d) return;
    e.stopImmediatePropagation();
    UE.drag = null;
    try {
      cv.releasePointerCapture(e.pointerId);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    ueAfter(d.a);
    rr();
  },
  true,
);
cv.addEventListener(
  'dblclick',
  (e) => {
    const h = ueHit(e);
    if (!h || h.k !== 'v') return;
    const a = S.selA,
      V_ = ueVerts(a);
    if (V_.length <= (a.type === 'road' ? 2 : 3)) return;
    e.stopImmediatePropagation();
    V_.splice(h.i, 1);
    ueAfter(a);
    rr();
  },
  true,
);
