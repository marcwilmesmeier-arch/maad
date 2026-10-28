/* ===== v280 Grafikeffekte: Bäume (Laubschalen, Taste 8 im Grafiktest), Gras (Voxel, Taste 1), Wasser-Shader mit Spiegelung =====
   Schaltbar je Darstellung (Schattiert / Realistisch) im Panel „Darstellung“. Weißmodell: immer Original.
   Texturfarben der Grünflächen/Gewässer (ctxPaint) bleiben unverändert. */
S.fx = { sch: { trees: 0, tv: 8, grass: 0, gv: 1 }, real: { trees: 1, tv: 8, grass: 1, gv: 1, water: 1 } };
const FX = {};
const FXT = {
  ansatz: 30,
  gr: 100,
  hoehe: 100,
  spitze: 25,
  rauh: 36,
  verl: 30,
  var: 10,
  flat: 0,
  stamm: 1,
  stdick: 100,
  schatten: 1,
  drehen: 1,
  opak: null,
};
const fxOn = (k) => {
  const m = S.dar;
  if (k === 'grass' || m === 'wm' || !S.fx) return false;
  const o = S.fx[m];
  return !!(o && o[k] && (k !== 'water' || m === 'real'));
};
const fxGv = () => {
  if (S.dar !== 'real') return 1;
  const o = S.fx && S.fx[S.dar],
    v = o && o.gv | 0;
  return v === 2 ? 2 : 1;
};
const fxR = (i, k) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const fxN = (x, y, z) => {
  const a = Math.sin(x * 3.1 + y * 2.3 + 1.7) * Math.cos(z * 2.7 + x * 1.3),
    b = Math.sin(y * 4.1 + z * 1.9) * Math.cos(x * 3.7 - z * 2.2 + 0.6),
    c = Math.sin((x + y + z) * 5.3) * 0.5;
  return Math.max(0, Math.min(1, 0.5 + 0.3 * a + 0.3 * b + 0.12 * c));
};
function fxCrownGeo(p) {
  const g = new T.IcosahedronGeometry(1, window.FXD || 3),
    pos = g.attributes.position,
    nor = g.attributes.normal,
    n = pos.count,
    col = new Float32Array(n * 3),
    R = p.rauh / 100,
    sp = p.spitze / 100,
    vv = p.verl / 100,
    tn = S.dar === 'real' ? [0.04, 0.03, 0.08][(S.fx.real && S.fx.real.pre) | 0] || 0 : 0;
  for (let i = 0; i < n; i++) {
    let x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const l = Math.hypot(x, y, z);
    x /= l;
    y /= l;
    z /= l;
    const ns =
        fxN(x * 1.4 + 9, y * 1.4, z * 1.4) * 0.45 +
        fxN(x * 2.6, y * 2.6, z * 2.6) * 0.33 +
        fxN(x * 6.5, y * 6.5, z * 6.5) * 0.22 +
        (window.FXD ? (fxN(x * 13 + 3, y * 13, z * 13) - 0.5) * 0.2 : 0),
      r = 1 + (ns - 0.5) * R,
      tp = 1 - sp * 0.55 * Math.max(0, (y + 1) / 2);
    pos.setXYZ(i, x * r * tp, y * r, z * r * tp);
    nor.setXYZ(i, x, y, z);
    const sh = Math.max(0.25, 1 - vv * (1 - (y + 1) / 2) * 0.85 - R * 0.55 * (1 - ns));
    const up = (y + 1) / 2;
    col[i * 3] = sh * (1 + 0.9 * tn * up - 0.4 * tn * (1 - up));
    col[i * 3 + 1] = sh * (1 + 0.4 * tn * up + 0.2 * tn * (1 - up));
    col[i * 3 + 2] = sh * (1 - 1.1 * tn * up + 0.5 * tn * (1 - up));
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  return g;
}
function fxTrees() {
  const list = GEO.trees;
  if (!list || !list.length) return;
  const L0 = GEO.tmesh;
  FX.tl = [];
  const p = FXT;
  if (!L0) return;
  const m = L0;
  m.geometry.dispose();
  m.geometry = fxCrownGeo(p);
  const mt = m.material;
  mt.color.set('#ffffff');
  mt.vertexColors = true;
  mt.flatShading = !!p.flat;
  if (p.opak != null) {
    mt.transparent = p.opak < 100;
    mt.opacity = p.opak / 100;
    mt.depthWrite = true;
  }
  mt.needsUpdate = true;
  m.castShadow = !!p.schatten;
  const TB = new T.Color(),
    M = new T.Matrix4(),
    Q = new T.Quaternion(),
    E = new T.Euler(),
    V = new T.Vector3(),
    Sc = new T.Vector3(),
    base = new T.Color(S.lc.trees),
    C = new T.Color(),
    j = p.var / 100;
  const tg = p.stamm ? new T.CylinderGeometry(0.6, 1, 1, 8).translate(0, 0.5, 0) : null,
    tm = tg
      ? new T.InstancedMesh(tg, new T.MeshLambertMaterial({ color: new T.Color('#ffffff') }), list.length)
      : null;
  list.forEach((t, i) => {
    const y = gh(t.x, t.z),
      h = (Math.max(1.5, t.h) * p.hoehe) / 100,
      cr = (Math.max(1, t.r) * p.gr) / 100,
      b0 = Math.max(0, Math.min(h - 1.5, (h * p.ansatz) / 100)),
      ch = Math.max(1.5, h - b0),
      b = b0 * 0.5,
      r1 = fxR(i, 1),
      r2 = fxR(i, 2),
      r3 = fxR(i, 3);
    E.set(0, p.drehen ? r1 * Math.PI * 2 : 0, 0);
    Q.setFromEuler(E);
    Sc.set(cr * (1 + (r2 - 0.5) * 0.4), (ch / 2) * (1 + (r1 - 0.5) * 0.3), cr * (1 + (r3 - 0.5) * 0.4));
    V.set(t.x + (r3 - 0.5) * cr * 0.2, y + b + ch / 2, t.z + (r2 - 0.5) * cr * 0.2);
    M.compose(V, Q, Sc);
    m.setMatrixAt(i, M);
    C.copy(base).offsetHSL((r2 - 0.5) * 0.12 * j, (r3 - 0.5) * 0.5 * j, (r1 - 0.5) * 0.36 * j);
    m.setColorAt(i, C);
    FX.tl.push({ x: t.x, y, z: t.z, cr, ch, b, c: C.clone(), s: i });
    if (tm) {
      const rad = (Math.max(0.12, Math.min(0.55, cr * 0.07)) * p.stdick) / 100;
      M.compose(V.set(t.x, y, t.z), Q.identity(), Sc.set(rad, b + 0.12, rad));
      tm.setMatrixAt(i, M);
      tm.setColorAt(i, TB.set(S.lc.stem || '#7a6742').offsetHSL((r2 - 0.5) * 0.02, 0, (r1 - 0.5) * 0.07));
    }
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  if (tm) {
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    tm.castShadow = !!p.schatten;
    tm.raycast = () => {};
    tm.frustumCulled = false;
    G.trees.add(tm);
  }
}
