/* v513–v519: Detailbäume im Nahbereich der Kamera (nur Kamera-Modus + Laubschalen). Krone aus einzelnen Laubballen (Lücken, bewegte Silhouette),
   Stamm mit Mittelachse und Ästen, Schalen-Laub entlang der Ballen-Normalen. Ballen werden NICHT einfach skaliert: je Baumgröße eigene Geometrie
   (Größenklassen, Standard = mittelgroßer Baum, Bezugsradius NEAR.REF), kleine Bäume haben weniger, große mehr Ballen bei ähnlicher Ballengröße in Metern. */
const NEAR = {
  R: 500,
  N: 80,
  REF: 4.5,
  dir: null,
  cls: {},
  c: null,
  orig: null,
  base: null,
  stem: null,
  sorig: null,
  key: '',
};
const NFC = [0.55, 0.8, 1, 1.25, 1.5];
function nearClass(cr) {
  const f = cr / NEAR.REF;
  return f < 0.68 ? 0 : f < 0.9 ? 1 : f < 1.12 ? 2 : f < 1.38 ? 3 : 4;
}
const NV = 5;
function nearNCL(f, v) {
  const ncl = [];
  let sd = 5 + Math.round(f * 100) + v * 7919;
  const rnd = () => {
    sd = (sd * 16807) % 2147483647;
    return sd / 2147483647;
  };
  const n = Math.round(66 * Math.pow(f, 2.2)),
    rs = Math.pow(f, -0.7);
  for (let k = 0; k < n; k++) {
    const y = -0.8 + rnd() * 1.8,
      R = 0.88 * Math.sqrt(Math.max(0.02, 1 - y * y)) * (y > 0.4 ? 1 - 0.25 * (y - 0.4) : 1),
      low = y < -0.3,
      rr = low ? R * (0.5 + 0.45 * rnd()) : R * Math.sqrt(rnd()) * 0.92,
      a = rnd() * 6.2832;
    const rh = Math.min(0.62, (0.22 + 0.14 * rnd()) * rs);
    ncl.push([Math.cos(a) * rr, y, Math.sin(a) * rr, rh, rh * 0.92, 0, a]);
  }
  const nb = Math.max(2, Math.round(5 * Math.pow(f, 1.2)));
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * 6.2832 + 0.4,
      rh = Math.min(0.6, 0.3 * rs);
    ncl.push([Math.cos(a) * 0.42, -0.78, Math.sin(a) * 0.42, rh, rh * 0.93, 0, a]);
  }
  return ncl;
}
/* c = [x,y,z,Radius waagrecht,Radius senkrecht,...] */
function nearCrownGeo(ncl, det) {
  const P = [],
    N = [],
    Cc = [];
  ncl.forEach((c, ci) => {
    const g = new T.IcosahedronGeometry(1, det),
      pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const l = Math.hypot(x, y, z);
      x /= l;
      y /= l;
      z /= l;
      const ns =
          fxN(x * 2.2 + ci * 3.1, y * 2.2, z * 2.2 + ci) * 0.6 + fxN(x * 5.5 + ci, y * 5.5, z * 5.5) * 0.4,
        k = 1 + (ns - 0.5) * 0.35;
      const px = c[0] + x * c[3] * k,
        py = c[1] + y * c[4] * k,
        pz = c[2] + z * c[3] * k;
      P.push(px, py, pz);
      N.push(x, y, z);
      const up = (py + 1) / 2,
        sh = Math.max(0.5, Math.min(1, 0.7 + 0.3 * up)) * (0.94 + 0.12 * ns);
      Cc.push(sh, sh, sh);
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute('color', new T.BufferAttribute(new Float32Array(Cc), 3));
  return g;
}
function nearBranchGeo(ncl) {
  const P = [],
    N = [],
    up = new T.Vector3(0, 1, 0);
  const seg = (a, b, r0, r1) => {
    const d = b.clone().sub(a),
      len = d.length(),
      q = new T.Quaternion().setFromUnitVectors(up, d.clone().normalize());
    const g = new T.CylinderGeometry(r1, r0, len, 8, 1, true);
    g.translate(0, len / 2, 0);
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));
    g.translate(a.x, a.y, a.z);
    const p = g.attributes.position,
      n = g.attributes.normal,
      ix = g.index.array;
    for (const k of ix) {
      P.push(p.getX(k), p.getY(k), p.getZ(k));
      N.push(n.getX(k), n.getY(k), n.getZ(k));
    }
  };
  seg(new T.Vector3(0, -0.62, 0), new T.Vector3(0, 0.7, 0), 0.034, 0.01);
  const stp = Math.max(1, Math.round(ncl.length / 10));
  ncl.forEach((c, ci) => {
    if (ci % stp) return;
    const hy = Math.max(-0.6, Math.min(c[1] - 0.35, 0.5)),
      o = new T.Vector3(0, hy, 0),
      E = new T.Vector3(c[0] * 0.9, c[1] - 0.05, c[2] * 0.9),
      M = o.clone().lerp(E, 0.5);
    M.y += 0.12;
    M.x += (fxN(ci, 1, 2) - 0.5) * 0.12;
    M.z += (fxN(ci, 3, 4) - 0.5) * 0.12;
    seg(o, M, 0.016, 0.01);
    seg(M, E, 0.01, 0.004);
    if (ci % 2 === 0) {
      const t1 = new T.Vector3(
        c[0] * 0.6 + (fxN(ci, 5, 6) - 0.5) * 0.25,
        c[1] + 0.08,
        c[2] * 0.6 + (fxN(ci, 7, 8) - 0.5) * 0.25,
      );
      seg(M, t1, 0.01, 0.005);
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3));
  return g;
}
function nearOff() {
  try {
    const b = NEAR.base;
    if (b && NEAR.orig) {
      b.instanceMatrix.array.set(NEAR.orig);
      b.instanceMatrix.needsUpdate = true;
    }
    if (NEAR.stem && NEAR.sorig) {
      NEAR.stem.instanceMatrix.array.set(NEAR.sorig);
      NEAR.stem.instanceMatrix.needsUpdate = true;
    }
  } catch (e) {
    logErr(e, 'nearOff');
  }
  NEAR.orig = null;
  NEAR.base = null;
  NEAR.stem = null;
  NEAR.sorig = null;
  NEAR.c = null;
  NEAR.dir = null;
  if (G.trees) {
    const rm = G.trees.children.filter((o) => o.userData && o.userData.near);
    const gs = new Set();
    rm.forEach((o) => {
      G.trees.remove(o);
      if (o.material) o.material.dispose();
      if (o.geometry) gs.add(o.geometry);
    });
    gs.forEach((g) => g.dispose());
  }
  NEAR.cls = {};
}
function nearMk(ci, sk, v) {
  const f = NFC[ci],
    ncl = nearNCL(f, v),
    z = new T.Matrix4().makeScale(0, 0, 0),
    w = new T.Color(0xffffff);
  const mt = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  mt.userData.near = 1;
  mt.flatShading = !!FXT.flat;
  const m = new T.InstancedMesh(nearCrownGeo(ncl, f > 1.2 ? 1 : 2), mt, NEAR.N);
  m.frustumCulled = false;
  m.castShadow = !!FXT.schatten;
  m.receiveShadow = true;
  m.raycast = () => {};
  m.userData.near = 1;
  for (let k = 0; k < NEAR.N; k++) {
    m.setMatrixAt(k, z);
    m.setColorAt(k, w);
  }
  const bm = new T.MeshLambertMaterial({ color: new T.Color(sk) });
  bm.userData.near = 1;
  const br = new T.InstancedMesh(nearBranchGeo(ncl), bm, NEAR.N);
  br.instanceMatrix = m.instanceMatrix;
  br.frustumCulled = false;
  br.castShadow = !!FXT.schatten;
  br.raycast = () => {};
  br.userData.near = 1;
  const tm = new T.MeshLambertMaterial({ color: new T.Color(sk) });
  tm.userData.near = 1;
  const tr = new T.InstancedMesh(new T.CylinderGeometry(0.8, 1.15, 1, 8).translate(0, 0.5, 0), tm, NEAR.N);
  for (let k = 0; k < NEAR.N; k++) tr.setMatrixAt(k, z);
  tr.frustumCulled = false;
  tr.castShadow = !!FXT.schatten;
  tr.raycast = () => {};
  tr.userData.near = 1;
  G.trees.add(m);
  G.trees.add(br);
  G.trees.add(tr);
  fxTreeFx(m);
  return {
    m,
    br,
    tr,
    all: [m, br, tr].concat(
      G.trees.children.filter((x) => x.userData.near && x.geometry === m.geometry && x !== m),
    ),
  };
}
function nearUpd() {
  const act =
    S.m3 &&
    CAMX.on &&
    typeof pc !== 'undefined' &&
    FX.tr &&
    fxOn('trees') &&
    GEO.tmesh &&
    FX.tl &&
    FX.tl.length &&
    G.trees &&
    G.trees.visible !== false;
  if (!act) {
    if (NEAR.base || Object.keys(NEAR.cls).length) nearOff();
    return;
  }
  const base = GEO.tmesh,
    C = pc.position,
    sk = S.lc.stem || '#7a6742';
  if (NEAR.base && NEAR.base !== base) nearOff();
  if (NEAR.key !== sk) {
    NEAR.key = sk;
    Object.values(NEAR.cls).forEach((o) => {
      o.br.material.color.set(sk);
      o.tr.material.color.set(sk);
    });
  }
  const fw = new T.Vector3();
  pc.getWorldDirection(fw);
  const hd = Math.hypot(fw.x, fw.z) || 1,
    fx = fw.x / hd,
    fz = fw.z / hd;
  if (
    NEAR.c &&
    NEAR.dir &&
    Math.hypot(C.x - NEAR.c[0], C.z - NEAR.c[1]) < 15 &&
    fx * NEAR.dir[0] + fz * NEAR.dir[1] > 0.94
  )
    return;
  const sel = [];
  FX.tl.forEach((t, i) => {
    const dx = t.x - C.x,
      dz = t.z - C.z,
      d = Math.hypot(dx, dz);
    if (d <= NEAR.R && (d < 30 || (dx * fx + dz * fz) / d > 0.35)) sel.push([d, i]);
  });
  sel.sort((a, b) => a[0] - b[0]);
  sel.length = Math.min(sel.length, NEAR.N);
  if (!NEAR.orig) {
    NEAR.orig = new Float32Array(base.instanceMatrix.array);
    NEAR.base = base;
    const st = G.trees.children.find(
      (o) =>
        o.isInstancedMesh &&
        !o.userData.near &&
        o.geometry.type === 'CylinderGeometry' &&
        o.count === base.count,
    );
    if (st) {
      NEAR.stem = st;
      NEAR.sorig = new Float32Array(st.instanceMatrix.array);
    }
  }
  const ba = base.instanceMatrix.array,
    sa = NEAR.stem ? NEAR.stem.instanceMatrix.array : null;
  ba.set(NEAR.orig);
  if (sa) sa.set(NEAR.sorig);
  const grp = [];
  for (let q = 0; q < 5 * NV; q++) grp.push([]);
  const hv = (i) => {
    const t = FX.tl[i];
    return Math.abs(Math.floor(t.x * 7.31 + t.z * 13.17)) % NV;
  };
  sel.forEach((s) => grp[nearClass(FX.tl[s[1]].cr) * NV + hv(s[1])].push(s[1]));
  const Z = new T.Matrix4().makeScale(0, 0, 0).elements,
    M4 = new T.Matrix4(),
    Sc = new T.Vector3(),
    Pp = new T.Vector3(),
    Qi = new T.Quaternion(),
    Ee = new T.Euler();
  for (let gi = 0; gi < 5 * NV; gi++) {
    const list = grp[gi],
      ci = gi;
    if (!list.length && !NEAR.cls[ci]) continue;
    const o =
        NEAR.cls[ci] || (NEAR.cls[ci] = Object.assign(nearMk(Math.floor(gi / NV), sk, gi % NV), { idx: [] })),
      na = o.m.instanceMatrix.array,
      ta = o.tr.instanceMatrix.array;
    for (let k = 0; k < NEAR.N; k++) {
      const i = list[k];
      if (i !== undefined) {
        const q0 = i * 16,
          t = FX.tl[i];
        const jr = Math.sin(t.x * 12.9 + t.z * 78.2) * 43758.5453,
          j1 = jr - Math.floor(jr),
          jr2 = Math.sin(t.x * 39.3 + t.z * 11.1) * 24634.6,
          j2 = jr2 - Math.floor(jr2),
          Sy = ((0.89 * t.ch) / 2) * (0.95 + 0.1 * j1),
          Sx = 1.014 * t.cr * (0.96 + 0.08 * j2),
          yc = t.y + t.b + t.ch / 2,
          yaw = j1 * 6.2832;
        M4.compose(Pp.set(t.x, yc, t.z), Qi.setFromEuler(Ee.set(0, yaw, 0)), Sc.set(Sx, Sy, Sx));
        M4.toArray(na, k * 16);
        o.m.setColorAt(k, t.c);
        for (let q = 0; q < 12; q++) ba[q0 + q] = 0;
        if (sa) for (let q = 0; q < 12; q++) sa[q0 + q] = 0;
        const rad = Math.max(0.08, Math.min(0.5, t.cr * 0.04));
        M4.compose(
          Pp.set(t.x, t.y, t.z),
          Qi.identity(),
          Sc.set(rad, Math.max(0.5, yc - 0.62 * Sy - t.y + 0.1), rad),
        );
        M4.toArray(ta, k * 16);
      } else {
        for (let q = 0; q < 16; q++) {
          na[k * 16 + q] = Z[q];
          ta[k * 16 + q] = Z[q];
        }
      }
    }
    o.idx = list;
    o.all.forEach((x) => (x.count = list.length));
    o.tr.count = list.length;
    o.m.instanceMatrix.needsUpdate = true;
    o.tr.instanceMatrix.needsUpdate = true;
    if (o.m.instanceColor) o.m.instanceColor.needsUpdate = true;
  }
  try {
    fxTreeOp();
  } catch (e) {
    logErr(e, 'nearUpd');
  }
  NEAR.c = [C.x, C.z];
  NEAR.dir = [fx, fz];
  base.instanceMatrix.needsUpdate = true;
  if (NEAR.stem) NEAR.stem.instanceMatrix.needsUpdate = true;
}
/* Stamm der Detailbäume folgt der Transparenz der Detailkrone (gleicher Platz k) */
{
  const _t = tfTick;
  tfTick = function () {
    _t.apply(this, arguments);
    try {
      Object.values(NEAR.cls).forEach((o) => {
        const ca = o.m.geometry.attributes.aHid,
          ta = o.tr.geometry.attributes.aHid;
        if (ca && ta && ca.array.length === ta.array.length) {
          ta.array.set(ca.array);
          ta.needsUpdate = true;
        }
      });
    } catch (e) {
      logErr(e, 'tfTick');
    }
  };
}
{
  const _tb = treesBuild;
  treesBuild = function () {
    NEAR.cls = {};
    NEAR.orig = null;
    NEAR.base = null;
    NEAR.stem = null;
    NEAR.sorig = null;
    NEAR.c = null;
    NEAR.dir = null;
    return _tb.apply(this, arguments);
  };
}
setInterval(() => {
  try {
    nearUpd();
  } catch (e) {
    console.warn('near', e);
  }
}, 250);
