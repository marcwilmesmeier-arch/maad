// ---- Flächenarten (Registry – Einstellungsmenü „Flächenarten“, Bilanz und Beschriftung lesen nur hieraus)
const GRFA0 = [
  { k: 'wo', n: 'Wohnen', u: 'Wohnen', c: '#a9c7e6', d: 'NUF', f: 100, df: 1 },
  { k: 'wo1', n: '1-Zimmer-Wohnung', u: 'Wohnen', c: '#8fb8e3', d: 'NUF', f: 100 },
  { k: 'wo2', n: '2-Zimmer-Wohnung', u: 'Wohnen', c: '#6fa3d9', d: 'NUF', f: 100 },
  { k: 'wo3', n: '3-Zimmer-Wohnung', u: 'Wohnen', c: '#5390cf', d: 'NUF', f: 100 },
  { k: 'wo4', n: '4-Zimmer-Wohnung', u: 'Wohnen', c: '#3a7bc0', d: 'NUF', f: 100 },
  { k: 'bu', n: 'Büro', u: 'Büro', c: '#9fb4c4', d: 'NUF', f: 100, df: 1 },
  { k: 'ge', n: 'Gewerbe', u: 'Gewerbe', c: '#e0b88f', d: 'NUF', f: 100, df: 1 },
  { k: 'fl', n: 'Flur', u: 'Sonstiges', c: '#d9d9c8', d: 'VF', f: 100 },
  { k: 'th', n: 'Treppenhaus', u: 'Sonstiges', c: '#c2c9a3', d: 'VF', f: 100 },
  { k: 'az', n: 'Aufzug / Schacht', u: 'Sonstiges', c: '#b0b8c0', d: 'VF', f: 100 },
  { k: 'te', n: 'Technik', u: 'Sonstiges', c: '#c9b3d4', d: 'TF', f: 100 },
  { k: 'ab', n: 'Abstellraum', u: 'Sonstiges', c: '#d8cfa8', d: 'NUF', f: 100 },
  { k: 'so', n: 'Sonstiges', u: 'Sonstiges', c: '#cdd5bd', d: 'NUF', f: 100, df: 1 },
];
const GRDIN = { NUF: 'Nutzungsfläche (NUF)', VF: 'Verkehrsfläche (VF)', TF: 'Technikfläche (TF)' };
const GRDINC0 = { NUF: '#4e79a7', VF: '#f28e2b', TF: '#59a14f' };
S.din = Object.assign({}, GRDINC0);
S.fa = JSON.parse(JSON.stringify(GRFA0));
S.gro = {
  sh: 1.2,
  ctx: 1,
  ctxO: 0.22,
  lab: { nr: 0, nm: 1, dn: 1, us: 0, ar: 1 },
  dim: 1,
  below: 0,
  gs: 1,
  fs: 12,
  al: 0,
  trk: 1,
};
const GRS = {
  bid: null,
  lv: null,
  tool: 'sel',
  tab: 'u',
  sel: null,
  pts: [],
  cur: null,
  rect: null,
  pan: null,
  hover: null,
  view: { x: 0, z: 0, s: 8 },
  w: null,
  doc: null,
  mode: '',
  dirty: 1,
  us: '',
  ps: '',
  psel: '',
  fit: null,
  snap: null,
  space: false,
  follow: 1,
  msg: '',
  msel: [],
  ed: null,
  eh: null,
  note: null,
};
const grFA = (k) => S.fa.find((f) => f.k === k) || null;
const grDefFa = (u) => S.fa.find((f) => f.u === u && f.df) || S.fa.find((f) => f.u === u) || S.fa[0];
const grB = () => S.bld.find((x) => x.id === GRS.bid && !x.ex) || null;
const gr2 = (v) => Math.round(v * 1000) / 1000;
// ---- Geschosse mit Schnittfläche
function grDG(b) {
  const rg = roofGeo(b, 0);
  if (!rg) return null;
  const fp = lf(b, b.levels[b.levels.length - 1]);
  const V = fp.map((q) => new T.Vector2(q[0], q[1])),
    tris = T.ShapeUtils.triangulateShape(V, []),
    sh = +S.gro.sh || 1.2,
    pieces = [];
  for (const [i, j, k] of tris) {
    let pcs = [[V[i], V[j], V[k]].map((v) => [v.x, v.y])];
    for (const f of rg.ln) {
      const nx = [];
      for (const pc of pcs) for (const q of splitPoly(pc, f)) if (q.length >= 3 && area(q) > 1e-6) nx.push(q);
      pcs = nx;
    }
    for (const pc of pcs) {
      const A = splitPoly(pc, (q) => rg.d + rg.hf(q) - sh)[0];
      if (A.length >= 3 && area(A) > 1e-6) pieces.push(A);
    }
  }
  if (!pieces.length) return null;
  return { bs: grBoundOf(pieces), h: rg.h };
}
function grLevels(b) {
  const u = ugN(b),
    arr = [];
  b.levels.forEach((l, i) => {
    const fp = lf(b, l);
    arr.push({
      key: String(i),
      i,
      name: lname(b, i),
      sn: lname(b, i),
      ug: i < u,
      h: l.h,
      use: lUse(b, l),
      obj: l,
      bs: grLoopSegs(
        (znPinch(fp) ? znRings(fp) : [fp]).concat(
          (b.voids || []).filter((v) => i >= v.j0 && i <= v.j1).map((v) => v.poly),
        ),
      ),
      fp,
    });
  });
  const r = b.roof;
  if (r && r.type && r.type !== 'flat') {
    try {
      const d = grDG(b);
      if (d)
        arr.push({
          key: 'dg',
          i: b.levels.length,
          name: 'Dachgeschoss',
          sn: 'DG',
          ug: false,
          h: d.h,
          use: roofUse(b),
          obj: r,
          bs: d.bs,
          fp: null,
          dg: 1,
        });
    } catch (e) {
      console.warn('DG', e);
    }
  }
  return arr;
}
function grFill(lv) {
  const cuts = (lv.obj.cuts || []).map((c) => [c[0], c[1], c[2], c[3]]),
    us = lv.obj.units || [],
    df = grDefFa(lv.use);
  lv.faces = grFaces(lv.bs, cuts);
  lv.faces.forEach((f, i) => {
    const u = us.find((q) => q && q.p && grInFace(f, q.p[0], q.p[1]));
    f.u = u || null;
    f.fa = u && grFA(u.fa) ? u.fa : df.k;
    f.n = (u && u.n) || '';
    f.idx = i + 1;
    f.un = lv.faces.length > 1 || !!u;
  });
  lv.area = lv.faces.reduce((s, f) => s + f.a, 0);
}
const grSig = (b) =>
  JSON.stringify([
    b.voids,
    b.fp,
    b.levels.map((l) => [l.h, l.ug, l.fp, l.use, l.cuts, l.units]),
    b.roof,
    b.use,
    +S.gro.sh,
    S.fa.map((f) => f.k + f.u + f.c),
  ]);
function grData(b) {
  const s = grSig(b);
  if (b._gr && b._gr.s === s) return b._gr.L;
  const L = grLevels(b);
  L.forEach(grFill);
  b._gr = { s, L };
  return L;
}
function grLv(b) {
  const L = grData(b);
  let lv = L.find((l) => l.key === GRS.lv);
  if (!lv) {
    lv = L.find((l) => l.key === String(ugN(b))) || L[0];
    GRS.lv = lv && lv.key;
  }
  return lv;
}
// ---- Änderungen (mit Rückgängig über hist())
function grSetCuts(b, lv, cuts, nw) {
  const old = lv.faces.map((f) => ({ o: f.o, h: f.h, fa: f.fa, n: f.n })),
    df = grDefFa(lv.use).k;
  lv.obj.cuts = cuts.length ? cuts : undefined;
  b._gr = null;
  const nf = grFaces(
      lv.bs,
      cuts.map((c) => c.slice(0, 4)),
    ),
    par = nf.map((f) => old.findIndex((o) => grInFace(o, f.c[0], f.c[1]))),
    big = new Map();
  const isNew = (f) => !!nw && grInRing(nw, f.c[0], f.c[1]);
  par.forEach((pi, i) => {
    if (pi < 0 || isNew(nf[i])) return;
    const c = big.get(pi);
    if (c == null || nf[i].a > nf[c].a) big.set(pi, i);
  });
  const units = [];
  nf.forEach((f, i) => {
    const o = par[i] >= 0 ? old[par[i]] : null;
    if (!o) return;
    const n = !isNew(f) && big.get(par[i]) === i ? o.n : '';
    if (o.fa !== df || n) units.push({ p: [gr2(f.c[0]), gr2(f.c[1])], fa: o.fa, n });
  });
  lv.obj.units = units.length ? units : undefined;
  b._gr = null;
}
function grAttr(b, lv, face, patch) {
  let us = lv.obj.units || [];
  const df = grDefFa(lv.use).k;
  let u = us.find((q) => grInFace(face, q.p[0], q.p[1]));
  if (!u) {
    u = { p: [gr2(face.c[0]), gr2(face.c[1])], fa: face.fa, n: face.n };
    us.push(u);
  }
  Object.assign(u, patch);
  us = us.filter((q) => q === u || !grInFace(face, q.p[0], q.p[1]));
  if (u.fa === df && !u.n) us = us.filter((q) => q !== u);
  lv.obj.units = us.length ? us : undefined;
  b._gr = null;
}
function grCopy(b, src, dst) {
  const cuts = (src.obj.cuts || []).map((c) => c.slice()),
    df = grDefFa(dst.use).k;
  dst.obj.cuts = cuts.length ? cuts : undefined;
  const nf = grFaces(
      dst.bs,
      cuts.map((c) => c.slice(0, 4)),
    ),
    units = [];
  nf.forEach((f) => {
    const s = src.faces.find((q) => grInFace(q, f.c[0], f.c[1]));
    if (!s || !s.u) return;
    if (s.fa !== df || s.n) units.push({ p: [gr2(f.c[0]), gr2(f.c[1])], fa: s.fa, n: s.n });
  });
  dst.obj.units = units.length ? units : undefined;
  b._gr = null;
}
function grEdit(fn) {
  const b = grB();
  if (!b) return;
  hist();
  b.ub = 1;
  GRS.msel = [];
  fn(b);
  b._gr = null;
  GRS.dirty = 1;
  GRS.ps = '';
  grTick(true);
}
const grGid = (cuts) => 1 + cuts.reduce((m, c) => Math.max(m, c[4] || 0), 0);
function grAddCuts(segs) {
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js
  return grAddCutsBasis.call(this, l2Fix(segs));
}
// grAddCuts() ohne die Erweiterungen darüber – wird von grAddCuts() gezielt aufgerufen
function grAddCutsBasis(segs) {
  grEdit((b) => {
    const lv = grLv(b),
      cuts = (lv.obj.cuts || []).map((c) => c.slice()),
      g = grGid(cuts);
    segs.forEach((s) => cuts.push([gr2(s[0]), gr2(s[1]), gr2(s[2]), gr2(s[3]), g]));
    grSetCuts(b, lv, cuts);
    GRS.sel = { k: 'c', g };
  });
}
// Schnittpunktparameter zweier Strecken a (t) und b (u): a1+t*(a2-a1)=b1+u*(b2-b1)
function grSegT(a, b) {
  const d1x = a[2] - a[0],
    d1z = a[3] - a[1],
    d2x = b[2] - b[0],
    d2z = b[3] - b[1],
    den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const px = b[0] - a[0],
    pz = b[1] - a[1];
  return [(px * d2z - pz * d2x) / den, (px * d1z - pz * d1x) / den];
}
// Strecke c an den Stellen t (0..1) teilen -> Teilstücke
function grPieces(c, ts) {
  const L = Math.hypot(c[2] - c[0], c[3] - c[1]);
  if (L < 1e-6) return [];
  const e = 0.01 / L,
    a = [0].concat(
      ts.filter((t) => t > e && t < 1 - e).sort((x, y) => x - y),
      [1],
    ),
    out = [];
  for (let i = 0; i + 1 < a.length; i++) {
    if (a[i + 1] - a[i] < 0.004 / L) continue;
    const f = (t) => [c[0] + (c[2] - c[0]) * t, c[1] + (c[3] - c[1]) * t];
    out.push([f(a[i]), f(a[i + 1])]);
  }
  return out;
}
// Neue geschlossene Fläche P: alte Trennlinien im Inneren entfallen, die Linien außen werden an der Kontur gekappt
function grClipArea(cuts, P) {
  const edges = P.map((q, i) => {
      const r = P[(i + 1) % P.length];
      return [q[0], q[1], r[0], r[1]];
    }),
    res = [];
  cuts.forEach((c) => {
    const ts = [];
    edges.forEach((e) => {
      const x = grSegT(c, e);
      if (x && x[0] > 0 && x[0] < 1 && x[1] >= -1e-6 && x[1] <= 1 + 1e-6) ts.push(x[0]);
    });
    const L2 = (c[2] - c[0]) ** 2 + (c[3] - c[1]) ** 2;
    P.forEach((q) => {
      if (L2 < 1e-9) return;
      const t = ((q[0] - c[0]) * (c[2] - c[0]) + (q[1] - c[1]) * (c[3] - c[1])) / L2;
      if (t > 0 && t < 1 && grDSeg(q[0], q[1], c[0], c[1], c[2], c[3]) < 0.004) ts.push(t);
    });
    grPieces(c, ts).forEach(([a, b]) => {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (grInRing(P, m[0], m[1]) || edges.some((e) => grDSeg(m[0], m[1], e[0], e[1], e[2], e[3]) < 0.012))
        return;
      const n = c.slice();
      n[0] = a[0];
      n[1] = a[1];
      n[2] = b[0];
      n[3] = b[1];
      res.push(n);
    });
  });
  return res;
}
function grAddArea(P) {
  grEdit((b) => {
    const lv = grLv(b),
      old = (lv.obj.cuts || []).map((c) => c.slice()),
      cuts = grClipArea(old, P).map((c) => [gr2(c[0]), gr2(c[1]), gr2(c[2]), gr2(c[3]), c[4]]),
      g = grGid(old);
    P.forEach((q, i) => {
      const r = P[(i + 1) % P.length];
      cuts.push([gr2(q[0]), gr2(q[1]), gr2(r[0]), gr2(r[1]), g]);
    });
    grSetCuts(b, lv, cuts, P);
    GRS.sel = { k: 'c', g };
  });
}
// Neue Linie: bestehende Linien werden an den Kreuzungen getrennt, jedes Teilstück ist danach eigenständig wählbar/löschbar
function grAddLine(segs) {
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js
  return grAddLineBasis.call(this, l2Fix(segs));
}
// grAddLine() ohne die Erweiterungen darüber – wird von grAddLine() gezielt aufgerufen
function grAddLineBasis(segs) {
  grEdit((b) => {
    const lv = grLv(b),
      old = (lv.obj.cuts || []).map((c) => c.slice());
    let g = grGid(old);
    const cuts = [];
    old.forEach((c) => {
      const ts = [];
      segs.forEach((s) => {
        const x = grSegT(c, s);
        if (x && x[0] > 0 && x[0] < 1 && x[1] >= -1e-6 && x[1] <= 1 + 1e-6) ts.push(x[0]);
      });
      const ps = grPieces(c, ts);
      if (ps.length < 2) {
        cuts.push(c);
        return;
      }
      ps.forEach(([a, q]) => cuts.push([gr2(a[0]), gr2(a[1]), gr2(q[0]), gr2(q[1]), g++]));
    });
    const ng = g;
    segs.forEach((s) => cuts.push([gr2(s[0]), gr2(s[1]), gr2(s[2]), gr2(s[3]), ng]));
    grSetCuts(b, lv, cuts);
    GRS.sel = { k: 'c', g: ng };
  });
}
