// ---- Szene
const mid = $('mid'),
  ren = new T.WebGLRenderer({ antialias: true });
ren.setPixelRatio(devicePixelRatio);
ren.setClearColor(0xf8f7f4);
ren.shadowMap.enabled = true;
mid.appendChild(ren.domElement);
const sc = new T.Scene();
const hemi = new T.HemisphereLight(0xffffff, 0x999999, 0.85);
sc.add(hemi);
const sunL = new T.DirectionalLight(0xffffff, 0.8);
sunL.position.set(-120, 200, 160);
sc.add(sunL);
const sh = sunL.shadow;
ren.shadowMap.type = T.PCFSoftShadowMap;
sh.mapSize.set(4096, 4096);
sh.bias = -0.0007;
sh.normalBias = 0.25;
sh.radius = 1.5;
Object.assign(sh.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 1, far: 700 });
const pc = new T.PerspectiveCamera(45, 1, 1, 9000),
  oc = new T.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
const V = { tx: 0, tz: 0, d: 380, az: 0.6, pol: 1.05, rot: 0, rotT: 0 };
const G = {};
[
  'terrain',
  'parcels',
  'bplan',
  'flab',
  'rnam',
  'buildings',
  'roads',
  'green',
  'trees',
  'paths',
  'cycle',
  'rail',
  'water',
  'pv',
  'abst',
  'wms',
].forEach((k) => {
  G[k] = new T.Group();
  sc.add(G[k]);
});
G.bplan.visible = false;
G.ex = new T.Group();
G.nb = new T.Group();
G.buildings.add(G.ex, G.nb);
// Markierung gewählter Flächen (areaSelDraw); hier angelegt, weil demoOff() sie schon beim Laden leert
const GA = new T.Group();
sc.add(GA);
const mat = (c, o = {}) => new T.MeshLambertMaterial(Object.assign({ color: c }, o));
// Terrain
{
  const g = new T.PlaneGeometry(500, 500, 100, 100);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position,
    col = [];
  for (let i = 0; i < p.count; i++) {
    const y = gh(p.getX(i), p.getZ(i));
    p.setY(i, y);
    const t = (y + 8) / 18;
    col.push(0.84 + 0.06 * t, 0.84 + 0.06 * t, 0.84 + 0.06 * t);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  G.terrain.add(m);
  S.terr = m;
  const w = new T.Mesh(
    g,
    new T.MeshBasicMaterial({ color: 0x777777, wireframe: true, transparent: true, opacity: 0.25 }),
  );
  w.position.y = 0.05;
  w.visible = false;
  G.terrain.add(w);
  S.wf = w;
}
function rect(x0, z0, x1, z1, c, off, grp) {
  const g = new T.PlaneGeometry(x1 - x0, z1 - z0, (x1 - x0) / 5, (z1 - z0) / 5);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (x0 + x1) / 2,
      z = p.getZ(i) + (z0 + z1) / 2;
    p.setXYZ(i, x, gh(x, z) + off, z);
  }
  g.computeVertexNormals();
  const m = new T.Mesh(
    g,
    mat(c, { polygonOffset: true, polygonOffsetFactor: -off * 4, polygonOffsetUnits: -4 }),
  );
  m.receiveShadow = true;
  grp.add(m);
}
rect(-250, -5, 250, 5, 0xa8a8a8, 0.2, G.roads);
rect(100, -250, 110, 250, 0xa8a8a8, 0.2, G.roads);
rect(-135, 65, 60, 95, 0xd4d4d4, 0.2, G.green);
rect(-135, -95, 60, -65, 0xd4d4d4, 0.2, G.green);
rect(115, 20, 165, 60, 0xbdbdbd, 0.25, G.green);
// Flurstücke
const P = [];
for (let j = 0; j < 2; j++)
  for (let i = 0; i < 4; i++) {
    const x0 = -130 + i * 60,
      z0 = j ? 10 : -60;
    const pl = [
      [x0, z0],
      [x0 + 55, z0],
      [x0 + 55, z0 + 50],
      [x0, z0 + 50],
    ];
    P.push({ id: 'F' + (P.length + 1), poly: pl });
    rect(x0, z0, x0 + 55, z0 + 50, 0xe9e9e9, 0.15, G.parcels);
    const pts = pl.map((q) => new T.Vector3(q[0], gh(q[0], q[1]) + 0.4, q[1]));
    const ln = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: 0x8a8a8a }),
    );
    G.parcels.add(ln);
  }
// Bestand (Platzhalter-Gebäude): angelegt in start(), 29-start/010-start-projekt-oeffnen.js
// Bäume
{
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const N = 160,
    tr = new T.InstancedMesh(new T.CylinderGeometry(0.3, 0.4, 3, 6), mat(0x9a9a9a), N),
    cr = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), mat(0xc4c4c4), N),
    M = new T.Matrix4();
  for (let i = 0; i < N; i++) {
    const x = -135 + r() * 195,
      z = (r() < 0.5 ? -1 : 1) * (66 + r() * 26),
      y = gh(x, z),
      k = 0.8 + r() * 0.7;
    M.makeTranslation(x, y + 1.5, z);
    tr.setMatrixAt(i, M);
    M.makeScale(2.2 * k, 3 * k, 2.2 * k).setPosition(x, y + 5.5 * k, z);
    cr.setMatrixAt(i, M);
  }
  tr.castShadow = cr.castShadow = true;
  G.trees.add(tr, cr);
}
// ---- Gebäude
const realH = (y) => (GEO.e0 != null ? f1(y + GEO.e0, 2) + ' m ü. NN' : f1(y, 2) + ' m (Demo, relativ)');
function base(b) {
  if (b.ref != null) return b.ref;
  return Math.min(...b.fp.map((q) => gh(q[0], q[1])));
}
// ---- Dachformen: Pult-, Sattel-, Walmdach mit Neigung, Drempel und Ausrichtung
const RT = [
    ['flat', 'Flachdach'],
    ['pult', 'Pultdach'],
    ['sattel', 'Satteldach'],
    ['walm', 'Walmdach'],
  ],
  RD = { flat: {}, pult: { angle: 15 }, sattel: { angle: 35 }, walm: { angle: 30 } };
function autoDir(b, type) {
  const fp = lf(b, b.levels[b.levels.length - 1]);
  let bl = 0,
    ang = 0;
  fp.forEach((a, i) => {
    const c = fp[(i + 1) % fp.length],
      l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l > bl) {
      bl = l;
      ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
    }
  });
  return ((Math.round((ang * 180) / Math.PI + (type === 'pult' ? 90 : 0)) % 360) + 360) % 360;
}
function roofDir(b) {
  const r = b.roof || {};
  return r.dir != null && r.dir !== '' ? +r.dir : autoDir(b, r.type);
}
function splitPoly(poly, f) {
  const A = [],
    B = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      fp = f(p),
      fq = f(q);
    if (fp >= -1e-9) A.push(p);
    if (fp <= 1e-9) B.push(p);
    if ((fp > 1e-9 && fq < -1e-9) || (fp < -1e-9 && fq > 1e-9)) {
      const t = fp / (fp - fq),
        x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      A.push(x);
      B.push(x);
    }
  }
  return [A, B];
}
function roofAreas(b) {
  const r = b.roof;
  if (!r || !r.type || r.type === 'flat') return null;
  const fp = lf(b, b.levels[b.levels.length - 1]);
  if (fp.length < 3) return null;
  const d = Math.max(0, +r.dremp || 0),
    tn = Math.tan((Math.max(1, Math.min(75, +r.angle || 30)) * Math.PI) / 180),
    th = (roofDir(b) * Math.PI) / 180,
    tx = Math.cos(th),
    tz = Math.sin(th),
    sx = -tz,
    sz = tx;
  let t0 = 1e9,
    t1 = -1e9,
    s0 = 1e9,
    s1 = -1e9,
    x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9;
  fp.forEach(([x, z]) => {
    const t = x * tx + z * tz,
      s = x * sx + z * sz;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  });
  const tc = (t0 + t1) / 2,
    sc = (s0 + s1) / 2,
    a = (t1 - t0) / 2,
    bb = (s1 - s0) / 2,
    Cx = tc * tx + sc * sx,
    Cz = tc * tz + sc * sz,
    TT = (p) => (p[0] - Cx) * tx + (p[1] - Cz) * tz,
    SS = (p) => (p[0] - Cx) * sx + (p[1] - Cz) * sz;
  const hf = roofField(r.type, fp, TT, SS, a, bb, tn).hf;
  const st = Math.max(0.1, Math.sqrt(((x1 - x0) * (z1 - z0)) / 40000)),
    cell = st * st;
  let n2 = 0,
    n1 = 0,
    n0 = 0,
    vs = 0;
  for (let x = x0 + st / 2; x < x1; x += st)
    for (let z = z0 + st / 2; z < z1; z += st) {
      const q = [x, z];
      if (!inP(q, fp)) continue;
      const h = d + hf(q);
      vs += h * cell;
      if (h >= 2) n2++;
      else if (h >= 1) n1++;
      else n0++;
    }
  const A2 = n2 * cell,
    A1 = n1 * cell,
    A0 = n0 * cell,
    tot = area(fp),
    k = tot / Math.max(1e-9, A2 + A1 + A0);
  return { a100: A2 * k, a50: A1 * k, a0: A0 * k, tot, wf: (A2 + 0.5 * A1) * k, vol: vs * k };
}
