/* v431 Geländeplanum: Kontur und Wandkanten als Vektorband (scharf in jeder Zoomstufe) – liegt über der Grundstücksgrenze; Schraffur/Füllung bleiben in der Geländetextur */
const PLV = { g: new T.Group(), sig: '', w: 0 };
PLV.g.renderOrder = 8;
sc.add(PLV.g);
function plvClear() {
  PLV.g.children.slice().forEach((m) => {
    PLV.g.remove(m);
    m.geometry && m.geometry.dispose();
    m.material && m.material.dispose();
  });
}
function plvBandGeo(pts0, w, closed, dy) {
  const pts = [];
  const M = pts0.length;
  const segN = closed ? M : M - 1;
  for (let i = 0; i < segN; i++) {
    const a = pts0[i],
      b = pts0[(i + 1) % M],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L / 2));
    for (let j = 0; j < n; j++) pts.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  if (!closed) pts.push(pts0[M - 1]);
  const N = pts.length;
  if (N < 2) return null;
  let ar = 0;
  if (closed)
    for (let i = 0; i < N; i++) {
      const p = pts[i],
        q = pts[(i + 1) % N];
      ar += p[0] * q[1] - q[0] * p[1];
    }
  const sg = ar > 0 ? 1 : -1,
    pos = [],
    idx = [];
  for (let i = 0; i < N; i++) {
    const p = pts[i],
      p0 = closed ? pts[(i + N - 1) % N] : pts[Math.max(0, i - 1)],
      p1 = closed ? pts[(i + 1) % N] : pts[Math.min(N - 1, i + 1)];
    let d0 = [p[0] - p0[0], p[1] - p0[1]],
      d1 = [p1[0] - p[0], p1[1] - p[1]];
    const l0 = Math.hypot(...d0),
      l1 = Math.hypot(...d1);
    d0 = l0 ? [d0[0] / l0, d0[1] / l0] : d1;
    d1 = l1 ? [d1[0] / l1, d1[1] / l1] : d0;
    const n0 = [-d0[1] * sg, d0[0] * sg],
      n1 = [-d1[1] * sg, d1[0] * sg];
    let mx = n0[0] + n1[0],
      mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cs = Math.max(0.4, mx * n1[0] + mz * n1[1]),
      k = w / 2 / cs,
      y = gh(p[0], p[1]) + dy;
    pos.push(p[0] + mx * k, y, p[1] + mz * k, p[0] - mx * k, y, p[1] - mz * k);
  }
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const a = i * 2,
      b = ((i + 1) % N) * 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}
function plvMesh(geo, col, ro) {
  if (!geo) return;
  const m = new T.Mesh(
    geo,
    new T.MeshBasicMaterial({
      color: col,
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    }),
  );
  m.renderOrder = ro;
  m.raycast = () => {};
  m.frustumCulled = false;
  PLV.g.add(m);
}
function plvSig() {
  try {
    return JSON.stringify([PLM.sel, PLM.a.map((a) => [a.id, a.on !== false, a.poly, a.w])]);
  } catch (_) {
    return '';
  }
}
function plvBuild() {
  try {
    plvClear();
    PLV.sig = plvSig();
    if (!PLM.a.some((a) => a.on !== false)) return;
    const { wpp, D } = pbWpp();
    let u = wpp;
    if (S.m3) u /= Math.max(0.45, Math.cos(Math.min(1.2, V.pol || 0)));
    PLV.w = u;
    for (const a of PLM.a) {
      if (a.on === false || !a.poly || a.poly.length < 3) continue;
      const sel = a.id === PLM.sel;
      plvMesh(plvBandGeo(a.poly, u * (sel ? 2.8 : 2), true, 1.1), sel ? 0x5e7f92 : 0x222222, sel ? 10 : 9);
      const L = a.poly.length;
      for (let i = 0; i < L; i++)
        if (a.w && a.w[i]) {
          plvMesh(plvBandGeo([a.poly[i], a.poly[(i + 1) % L]], u * 4, false, 1.15), 0x4a4a4a, 9);
        }
    }
  } catch (e) {
    console.warn('Planum-Vektor', e);
  }
}
{
  const _pp = plmPaint;
  plmPaint = function () {
    const r = _pp.apply(this, arguments);
    try {
      plvBuild();
    } catch (e) {
      logErr(e, 'plmPaint');
    }
    return r;
  };
}
setInterval(() => {
  try {
    const s = plvSig();
    if (s !== PLV.sig) {
      plvBuild();
      return;
    }
    if (!PLM.a.some((a) => a.on !== false)) return;
    const { wpp } = pbWpp();
    let u = wpp;
    if (S.m3) u /= Math.max(0.45, Math.cos(Math.min(1.2, V.pol || 0)));
    if (Math.abs(Math.log(u / PLV.w)) > 0.07) plvBuild();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 160);

/* v433/v435 Geländeausschnitt NUR unter Gebäuden mit Untergeschoss (sonst wird der 3 m tiefe EG-Sockel durch das Loch sichtbar = 'Ebene unter dem EG'): aus den tatsächlichen Geschoss-Grundrissen (Untergeschosse + EG) statt nur aus b.fp, und sofort nach jeder Änderung am Körper (Ziehen/Schieben) neu berechnet */
function plmFoot() {
  const out = [],
    seen = new Set();
  for (const b of S.bld || []) {
    if (b.ex) continue;
    const u = typeof ugN === 'function' ? ugN(b) : 0;
    if (u < 1) continue;
    const add = (p) => {
      if (!p || p.length < 3) return;
      const k = JSON.stringify(p);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(p);
    };
    try {
      (b.levels || []).forEach((l, i) => {
        if (i < u) {
          let r = null;
          try {
            r = lf(b, l);
          } catch (e) {
            logErr(e, 'plmFoot>anonym');
          }
          add(r);
        }
      });
    } catch (e) {
      logErr(e, 'plmFoot');
    }
  }
  return out;
}
{
  const _mesh = mesh;
  mesh = function () {
    const r = _mesh.apply(this, arguments);
    try {
      if (typeof PLM !== 'undefined' && typeof plmTick === 'function') {
        clearTimeout(PLM._ft);
        PLM._ft = setTimeout(() => plmTick(), 30);
      }
    } catch (e) {
      logErr(e, 'mesh');
    }
    return r;
  };
}
/* v435 Geländeausschnitt pixelgenau: Gebäudekubatur (Grundrisse UG..EG) wird zusätzlich im Gelände-Shader ausgeschnitten (discard), nicht nur über das Netz */
function plmCut() {
  try {
    const U = PIT.u,
      E = U.uC.value,
      G = U.uCG.value;
    let n = 0;
    plmFoot().forEach((p, gi) => {
      for (let i = 0; i < p.length; i++) {
        if (n >= 96) return;
        const q = p[(i + 1) % p.length];
        E[n].set(p[i][0], p[i][1], q[0], q[1]);
        G[n] = gi % 4;
        n++;
      }
    });
    U.uCn.value = n;
  } catch (e) {
    console.warn('plmCut', e);
  }
}
{
  const _g = plmGeom;
  plmGeom = function () {
    const r = _g.apply(this, arguments);
    plmCut();
    return r;
  };
}
