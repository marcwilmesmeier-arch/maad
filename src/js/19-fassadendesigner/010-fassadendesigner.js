// ======================================================================
// ---- v326: Fassadendesigner (2D, nur Flächen) – Ansichten je Gebäude, Ansichtsflächen trennen/zusammenlegen, Fassadentypen belegen
// ======================================================================
const FT0 = [
  { k: 'ohne', n: 'Ansichtsfläche (ohne Typ)', c: '#d3dae0', df: 1 },
  { k: 'pr', n: 'Pfosten-Riegel-Fassade', c: '#7fb3d5' },
  { k: 'kas', n: 'Kassettenfassade', c: '#9aa5b1' },
  { k: 'nws', n: 'Naturwerkstein', c: '#c9b08f' },
  { k: 'put', n: 'Putzfassade (WDVS)', c: '#e8e2d4' },
  { k: 'kli', n: 'Klinker', c: '#b5654a' },
  { k: 'hol', n: 'Holzfassade', c: '#b98b5a' },
  { k: 'met', n: 'Metallfassade', c: '#8d99a6' },
  { k: 'bet', n: 'Sichtbeton', c: '#b0b0aa' },
  { k: 'loch', n: 'Lochfassade / Fensterband', c: '#8fa8c4' },
];
S.ft = JSON.parse(JSON.stringify(FT0));
const fdT = (k) => S.ft.find((t) => t.k === k) || S.ft[0];
const XLDN = {
  N: 'Nord',
  NO: 'Nordost',
  O: 'Ost',
  SO: 'Südost',
  S: 'Süd',
  SW: 'Südwest',
  W: 'West',
  NW: 'Nordwest',
};
const FDS = {
  bid: null,
  vk: null,
  tool: 'sel',
  sel: [],
  selCut: null,
  pts: [],
  cur: null,
  rect: null,
  pan: null,
  vw: {},
  dirty: 1,
  mng: false,
  note: null,
  ps: '',
  doc: null,
  open: false,
  hover: null,
};
// Projekt: Fassadentypen mitspeichern, bei neuem Projekt zurücksetzen
{
  const _p = projExtra;
  projExtra = function () {
    const x = _p.apply(this, arguments);
    try {
      x.ft = JSON.parse(JSON.stringify(S.ft));
    } catch (e) {
      logErr(e, 'projExtra');
    }
    return x;
  };
}
{
  const _a = projApplySet;
  projApplySet = function (x) {
    try {
      if (x && x.ft && x.ft.length) S.ft = JSON.parse(JSON.stringify(x.ft));
    } catch (e) {
      logErr(e, 'projApplySet');
    }
    return _a.apply(this, arguments);
  };
}
{
  const _n = newProjectReset;
  newProjectReset = function () {
    try {
      S.ft = JSON.parse(JSON.stringify(FT0));
      if (FDS.open) fdClose();
    } catch (e) {
      logErr(e, 'newProjectReset');
    }
    return _n.apply(this, arguments);
  };
}

// ---- Geometrie: Außenwände oberirdisch → Ansichten (Gruppen gleicher Blickrichtung)
const fdAng = (nx, nz) => ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;
const fdAD = (a, c) => {
  let d = Math.abs(a - c) % 360;
  return d > 180 ? 360 - d : d;
};
function fdPieces(b) {
  const u = ugN(b),
    out = [],
    top = lf(b, b.levels[b.levels.length - 1]);
  let v = 0;
  b.levels.forEach((l, i) => {
    if (i < u) return;
    const f = lf(b, l),
      v0 = v,
      v1 = v + l.h;
    v = v1;
    let sa = 0;
    f.forEach((p, j) => {
      const q = f[(j + 1) % f.length];
      sa += p[0] * q[1] - q[0] * p[1];
    });
    const sg = sa > 0 ? 1 : -1;
    f.forEach((a, j) => {
      const c = f[(j + 1) % f.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.05) return;
      out.push({
        lv: i,
        nx: (sg * dz) / len,
        nz: (-sg * dx) / len,
        ar: len * l.h,
        pts: [
          [a[0], a[1], v0],
          [c[0], c[1], v0],
          [c[0], c[1], v1],
          [a[0], a[1], v1],
        ],
      });
    });
  });
  // Giebel, Drempel und Dachwände (aus dem Dachmodell)
  const rp = b._rp;
  if (rp && rp.pw && rp.pw.length && b._y != null) {
    let ugH = 0;
    for (let i = 0; i < u; i++) ugH += b.levels[i].h;
    const base = b._y + ugH,
      p = rp.pw;
    for (let i = 0; i + 8 < p.length; i += 9) {
      const A = [p[i], p[i + 1], p[i + 2]],
        B = [p[i + 3], p[i + 4], p[i + 5]],
        C = [p[i + 6], p[i + 7], p[i + 8]],
        ux = B[0] - A[0],
        uy = B[1] - A[1],
        uz = B[2] - A[2],
        vx = C[0] - A[0],
        vy = C[1] - A[1],
        vz = C[2] - A[2],
        cx = uy * vz - uz * vy,
        cy = uz * vx - ux * vz,
        cz = ux * vy - uy * vx,
        nl = Math.hypot(cx, cy, cz),
        hl = Math.hypot(cx, cz);
      if (nl < 1e-9 || hl < 0.5 * nl) continue;
      let nx = cx / hl,
        nz = cz / hl;
      const mx = (A[0] + B[0] + C[0]) / 3,
        mz = (A[2] + B[2] + C[2]) / 3;
      if (inP([mx + nx * 0.05, mz + nz * 0.05], top)) {
        nx = -nx;
        nz = -nz;
      }
      out.push({ lv: 'roof', nx, nz, ar: nl / 2, pts: [A, B, C].map((q) => [q[0], q[2], q[1] - base]) });
    }
  }
  return out;
}
function fdArea2(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      c = r[(i + 1) % r.length];
    s += a[0] * c[1] - c[0] * a[1];
  }
  return Math.abs(s) / 2;
}
function fdSig(b) {
  return JSON.stringify([
    b.fp,
    b.levels.map((l) => [l.h, l.ug, l.fp]),
    b.roof,
    b._rp ? b._rp.pw.length + ':' + b._rp.aW.toFixed(3) : 0,
    b._y,
  ]);
}
