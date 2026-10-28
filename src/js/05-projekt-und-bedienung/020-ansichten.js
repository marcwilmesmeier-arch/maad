// ---- Ansichten (Blickwinkel speichern / anfahren)
S.views = [];
try {
  S.views = JSON.parse(localStorage.getItem('lot_views') || '[]');
} catch (e) {
  logErr(e, 'init');
}
const vwSave = () => {
  try {
    localStorage.setItem('lot_views', JSON.stringify(S.views));
  } catch (e) {
    logErr(e, 'vwSave');
  }
};
function vwClose() {
  $('vwp').style.display = 'none';
  $('bv').classList.remove('on');
}
function tgViews() {
  const c = $('vwp'),
    o = c.style.display !== 'block';
  if (o) {
    $('lc').style.display = 'none';
    $('bl').classList.remove('on');
    lyClose();
    vwRender();
  }
  c.style.display = o ? 'block' : 'none';
  $('bv').classList.toggle('on', o);
}
function vwRender() {
  const el = $('vwp');
  el.innerHTML =
    '<h4>Ansichten</h4><div style="display:flex;gap:4px"><input id="vwn" type="text" placeholder="Name der Ansicht" style="flex:1" onkeydown="if(event.key===\'Enter\')vwAdd()"><button class="sm" onclick="vwAdd()">Speichern</button></div><div style="color:var(--mu);font-size:11px;margin:4px 0">Speichert den aktuellen Ausschnitt (2D oder 3D) mit allen Anzeige-Einstellungen (Layer, Farben, Darstellung, Maske, Analyse-Färbung). Spätere Änderungen wirken nicht auf gespeicherte Ansichten, erst ⟳ überschreibt. Klick auf einen Eintrag ruft Kamera und Einstellungen auf.</div>' +
    (S.views.length
      ? S.views
          .map(
            (v, i) =>
              `<div class="vr" onclick="vwGo(${i})"><span title="${esc(v.name)}">${esc(v.name)}</span><small>${v.locked ? '🔒 ' : ''}${v.locked && v.sc ? '1:' + v.sc + ' · ' : ''}${v.m3 ? '3D' : '2D'}</small><button class="sm" title="Umbenennen" onclick="event.stopPropagation();vwRen(${i})">✎</button><button class="sm" title="Mit aktuellem Ausschnitt und aktuellen Anzeige-Einstellungen überschreiben" onclick="event.stopPropagation();vwUpd(${i})">⟳</button><button class="sm" title="Löschen" onclick="event.stopPropagation();vwDel(${i})">✕</button></div>`,
          )
          .join('')
      : '<div style="color:var(--mu)">Noch keine Ansicht gespeichert.</div>');
}
const vwState = () => ({
  cx: typeof camxSave === 'function' ? camxSave() : null,
  m3: !!S.m3,
  tx: V.tx,
  tz: V.tz,
  d: V.d,
  az: V.az,
  pol: V.pol,
  rot: V.rotT,
  ds: vwDs(),
});
function vwAdd() {
  const n = ($('vwn').value || '').trim() || 'Ansicht ' + (S.views.length + 1);
  S.views.push({ name: n, ...vwState() });
  vwSave();
  vwRender();
}
function vwUpd(i) {
  const o = S.views[i];
  if (o.locked) {
    alert('Die Ansicht ist fixiert. Zum Ändern des Ausschnitts erst im Anmerkungsmenü entsperren (🔒).');
    return;
  }
  S.views[i] = { ...vwState(), name: o.name, anns: o.anns };
  vwSave();
  vwRender();
}
function vwRen(i) {
  const n = prompt('Neuer Name der Ansicht', S.views[i].name);
  if (n && n.trim()) {
    S.views[i].name = n.trim();
    vwSave();
    vwRender();
  }
}
function vwDel(i) {
  S.views.splice(i, 1);
  if (S.vact === i) S.vact = null;
  else if (S.vact != null && S.vact > i) S.vact--;
  vwSave();
  vwRender();
}
function vwGo(i) {
  const v = S.views[i];
  if (!v) return;
  try {
    camxGo(v);
  } catch (e) {
    logErr(e, 'vwGo');
  }
  S.vact = null;
  if (!!S.m3 !== v.m3) {
    S.vgo = 1;
    const d0 = V.d;
    setMode(v.m3 ? 1 : 0, 1);
    S.vgo = 0;
    V.d = v.d * 1.6;
    if (!v.m3) V.rot = V.rotT = v.rot;
  }
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: v,
    t0: performance.now(),
    dur: Math.min(
      2200,
      Math.max(700, 500 + Math.hypot(v.tx - V.tx, v.tz - V.tz) * 1.2 + Math.abs(Math.log(v.d / V.d)) * 400),
    ),
  };
  S.vact = i;
  AN.sel = null;
  AN.tool = null;
  AN.tmp = null;
  AN.rev++;
  AN.barV = -9;
  if (v.ds)
    try {
      vwApplyDs(v.ds);
    } catch (e) {
      console.warn('vwApplyDs', e);
    }
}
function vwStep() {
  const a = S.vanim;
  if (!a) return;
  let t = (performance.now() - a.t0) / a.dur;
  if (t >= 1) t = 1;
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    L = (x, y) => x + (y - x) * e,
    ang = (x, y) => {
      let d = ((((y - x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
      return x + d * e;
    };
  V.tx = L(a.f.tx, a.t.tx);
  V.tz = L(a.f.tz, a.t.tz);
  V.d = Math.exp(L(Math.log(a.f.d), Math.log(a.t.d)));
  if (S.m3) {
    V.az = ang(a.f.az, a.t.az);
    V.pol = L(a.f.pol, a.t.pol);
  } else {
    V.rot = V.rotT = ang(a.f.rot, a.t.rot);
  }
  if (t >= 1) {
    if (S.m3) {
      V.az = a.t.az;
      V.pol = a.t.pol;
    } else V.rot = V.rotT = a.t.rot;
    S.vanim = null;
  }
}
var anHook, homeHook, lbHook;
function anView() {
  return S.vact != null ? S.views[S.vact] || null : null;
}
function anOn() {
  return !!anView();
}
function camLocked() {
  const v = anView();
  return !!(v && v.locked);
}
function loop() {
  vwStep();
  if (GEO.t2d) GEO.t2d.visible = !S.m3;
  if (V.rot !== V.rotT) {
    const d = V.rotT - V.rot;
    V.rot = Math.abs(d) < 0.002 ? V.rotT : V.rot + d * 0.3;
  }
  $('cmp').style.transform = `rotate(${S.m3 ? V.az : -V.rot}rad)`;
  cam();
  placeHc();
  updSel();
  updSel2();
  updDim();
  try {
    if (anHook) anHook();
  } catch (e) {
    console.error(e);
  }
  try {
    if (homeHook) homeHook();
  } catch (e) {
    console.error(e);
  }
  try {
    if (lbHook) lbHook();
  } catch (e) {
    console.error(e);
  }
  mkRender(sc, act());
  requestAnimationFrame(loop);
}
// Erster Frame erst nach dem Laden des ganzen Skripts: loop() liest Zustände späterer Dateien (DR, IDLE …)
requestAnimationFrame(loop);
// Interaktion
const rc = new T.Raycaster(),
  cv = ren.domElement;
let dr = null;
function ray(e) {
  const r = cv.getBoundingClientRect();
  rc.setFromCamera(
    new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1),
    act(),
  );
}
function ground(e) {
  if (S.tool === 'f' && S.refH != null && (S.draft.length || S.anchor)) {
    const q = planePt(e, S.refH);
    if (q) return q;
  }
  if (dr && dr.v != null && S.sel && !S.sel.ex && S.sel.ref != null && isCt(ed())) {
    const q = planePt(e, S.sel.ref);
    if (q) return q;
  }
  ray(e);
  const h = rc.intersectObject(S.terr)[0];
  return h ? [h.point.x, h.point.z] : null;
}
function proj(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L2 = dx * dx + dz * dz || 1e-9;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  const q = [a[0] + t * dx, a[1] + t * dz];
  return { q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}
// Wand verschieben: Nachbarwände behalten ihre Richtung (bleiben parallel zu den Wänden darüber/darunter)
function offEdge(o, i, n, d) {
  const m = o.length,
    a = o[i],
    c = o[(i + 1) % m],
    p = o[(i - 1 + m) % m],
    q = o[(i + 2) % m],
    u = [c[0] - a[0], c[1] - a[1]];
  const X = (P1, D1, P2, D2) => {
    const cr = D1[0] * D2[1] - D1[1] * D2[0];
    if (Math.abs(cr) <= 1e-6 * Math.hypot(D1[0], D1[1]) * Math.hypot(D2[0], D2[1])) return null;
    const t = ((P2[0] - P1[0]) * D2[1] - (P2[1] - P1[1]) * D2[0]) / cr;
    return [P1[0] + D1[0] * t, P1[1] + D1[1] * t];
  };
  const A0 = [a[0] + n[0] * d, a[1] + n[1] * d],
    C0 = [c[0] + n[0] * d, c[1] + n[1] * d],
    r = o.map((v) => v.slice());
  r[i] = X(A0, u, p, [a[0] - p[0], a[1] - p[1]]) || A0;
  r[(i + 1) % m] = X(C0, u, q, [c[0] - q[0], c[1] - q[1]]) || C0;
  return r;
}
// Fangebenen: parallele Wände aller Geschosse/Gebäude und Grundstücksgrenzen (Abstand entlang der Normalen)
function wallCand(b, k, i, n, js) {
  const o = lf(b, b.levels[k]),
    a0 = o[i],
    c0 = o[(i + 1) % o.length],
    u = [c0[0] - a0[0], c0[1] - a0[1]],
    cand = [];
  const add = (fp, skip) => {
    const mm = fp.length;
    fp.forEach((E, j) => {
      if (skip && j === i) return;
      const F = fp[(j + 1) % mm],
        v = [F[0] - E[0], F[1] - E[1]],
        cr = Math.abs(u[0] * v[1] - u[1] * v[0]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
      if (cr < 0.0175 && Math.hypot(v[0], v[1]) > 0.05)
        cand.push((E[0] - a0[0]) * n[0] + (E[1] - a0[1]) * n[1]);
    });
  };
  S.bld.concat(S.ex).forEach((bb) => bb.levels.forEach((l, j) => add(lf(bb, l), bb === b && js.includes(j))));
  P.concat(AL).forEach((pp) => add(pp.poly, false));
  return cand;
}
// sehr leichter Fang: Einrasten nur direkt an der Ebene, sonst sanfter Zug
function pullH(d, cand, thr) {
  let bt = null,
    bd = thr;
  cand.forEach((t) => {
    const x = Math.abs(d - t);
    if (x < bd - 1e-9 || (Math.abs(x - bd) < 1e-9 && bt != null && t === 0)) {
      bd = x;
      bt = t;
    }
  });
  if (bt == null) return [Math.round(d * 20) / 20, 0];
  return [bt, Math.abs(bt) < 1e-6 ? 2 : 1];
}
function pull(d, cand, thr) {
  let bt = null,
    bd = thr;
  cand.forEach((t) => {
    const x = Math.abs(d - t);
    if (x < bd) {
      bd = x;
      bt = t;
    }
  });
  if (bt == null) return [Math.round(d * 20) / 20, false];
  const r = bd / thr;
  if (r < 0.2) return [bt, true];
  return [d - (d - bt) * (1 - r) * 0.6, false];
}
// ---- Vertikal trennen: Seitenfläche entlang lotrechter Linie über ein oder mehrere Geschosse teilen
const cutL = new T.Line(
  new T.BufferGeometry(),
  new T.LineBasicMaterial({ color: 0xffffff, depthTest: false }),
);
cutL.renderOrder = 12;
cutL.visible = false;
cutL.frustumCulled = false;
sc.add(cutL);
const cutP = new T.LineSegments(
  new T.BufferGeometry(),
  new T.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.35,
    gapSize: 0.25,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  }),
);
cutP.renderOrder = 12;
cutP.visible = false;
cutP.frustumCulled = false;
sc.add(cutP);
const cutD = new T.Group(),
  cutDG = new T.BoxGeometry(1, 1, 1),
  cutDM = new T.MeshBasicMaterial({
    color: 0x5e7f92,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
  }),
  cutDW = new T.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
cutD.renderOrder = 13;
cutD.visible = false;
sc.add(cutD);
function drawCut() {
  const c = S.cut || S.cutPrev;
  cutL.visible = false;
  cutP.visible = false;
  cutD.clear();
  cutD.visible = !!c;
  if (!c || c.y0 == null) return;
  const X = c.a[0] + c.u[0] * c.s + c.n[0] * 0.1,
    Z = c.a[1] + c.u[1] * c.s + c.n[1] * 0.1,
    ym = (c.y0 + c.y1) / 2,
    dist = pc.position.distanceTo(new T.Vector3(X, ym, Z)),
    th = Math.max(0.05, dist * 0.0042),
    dl = Math.max(0.45, dist * 0.012),
    gp = dl * 0.6;
  for (let y = c.y0; y < c.y1 - 0.02; y += dl + gp) {
    const l = Math.min(dl, c.y1 - y);
    {
      const e = new T.Mesh(cutDG, cutDW);
      e.scale.set(th * 1.4, l, th * 1.4);
      e.position.set(X, y + l / 2, Z);
      e.renderOrder = 13;
      e.raycast = () => {};
      cutD.add(e);
    }
  }
}
function edgeInfo(b, k, i) {
  const f = lf(b, b.levels[k]),
    a = f[i],
    c = f[(i + 1) % f.length],
    dx = c[0] - a[0],
    dz = c[1] - a[1],
    len = Math.hypot(dx, dz),
    sg = sA(f) > 0 ? 1 : -1;
  return { a: a.slice(), u: [dx / len, dz / len], n: [(dz / len) * sg, (-dx / len) * sg], len };
}
// Maus auf dem Rand der markierten Seitenfläche -> zugehöriges Geschoss
function onBorder(hit) {
  const f = selOk();
  if (!f || f.i < 0) return false;
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (b !== f.b || k !== f.k || Math.abs(hit.face.normal.y) > 0.3) return false;
  const fp = lf(b, b.levels[k]),
    a = fp[f.i],
    c = fp[(f.i + 1) % fp.length],
    l = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (l < 0.05) return false;
  const ux = (c[0] - a[0]) / l,
    uz = (c[1] - a[1]) / l,
    p = hit.point;
  if (Math.abs((p.x - a[0]) * uz - (p.z - a[1]) * ux) > 0.3) return false;
  const s = (p.x - a[0]) * ux + (p.z - a[1]) * uz;
  let z0 = b._y;
  for (let j = 0; j < k; j++) z0 += b.levels[j].h;
  const z1 = z0 + b.levels[k].h,
    r = 7 * ((pc.position.distanceTo(p) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight);
  return Math.min(s, l - s, p.y - z0, z1 - p.y) < r;
}
function faceOf(hit) {
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (b.ex || k == null || !hit.face || S.sel !== b) return null;
  if (nearOuter(hit)) return null;
  return { b, k, i: -1 };
}
function wallHit(e) {
  ray(e);
  const hit = rc.intersectObjects(
    G.nb.children.flatMap((g) => g.children.filter((o) => o.isMesh)),
    false,
  )[0];
  if (!hit) return null;
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (!b || b.ex || k == null || Math.abs(hit.face.normal.y) > 0.3) return null;
  const f = lf(b, b.levels[k]);
  let bi = -1,
    bd = 1e9;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05) return;
    const d = proj([hit.point.x, hit.point.z], a, c).d;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi < 0 ? null : { b, k, i: bi, pt: hit.point };
}
function wallPt(e, c) {
  ray(e);
  const p = new T.Vector3();
  return rc.ray.intersectPlane(
    new T.Plane(new T.Vector3(c.n[0], 0, c.n[1]), -(c.n[0] * c.a[0] + c.n[1] * c.a[1])),
    p,
  )
    ? p
    : null;
}
function snapY(b, y) {
  let z = b._y;
  const zs = [z];
  b.levels.forEach((l) => {
    z += l.h;
    zs.push(z);
  });
  return zs.reduce((p, q) => (Math.abs(q - y) < Math.abs(p - y) ? q : p));
}
function snapS(c, b, s) {
  const r = 10 * mpp();
  let best = null,
    bd = r;
  const cand = [c.len / 2, c.len / 3, (2 * c.len) / 3];
  b.levels.forEach((l) =>
    lf(b, l).forEach((v) => cand.push((v[0] - c.a[0]) * c.u[0] + (v[1] - c.a[1]) * c.u[1])),
  );
  cand.forEach((t) => {
    if (t < 0.3 || t > c.len - 0.3) return;
    const d = Math.abs(t - s);
    if (d < bd) {
      bd = d;
      best = t;
    }
  });
  return best != null ? best : Math.max(0.3, Math.min(c.len - 0.3, Math.round(s * 20) / 20));
}
// ---- Zeichenformen: Freiform, Rechteck, Kreis (mit Maßeingabe)
