/* v378: Geländeplanum – Fläche auf Zielhöhe planieren, Böschung je Seite (1:n), Böschungsschraffur, Baugruben unter Gebäuden */
const PLM = {
  a: [],
  sel: null,
  hs: 1,
  holes: true,
  hatch: true,
  cf: '#6b4423',
  cw: '#b9b7b0',
  pe: -1,
  wait: false,
  hi: -1,
  open: false,
  sg: '',
  ag: '',
  gk: '',
  t: 0,
  rf: 0,
};
PL.plm = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = PW;
  return c;
})();
const plmCl = (v, a, b) => (v < a ? a : v > b ? b : v);
function plmPrep(a) {
  const p = a.poly,
    L = p.length;
  a.nr = [];
  for (let i = 0; i < L; i++) {
    const q = p[(i + 1) % L],
      dx = q[0] - p[i][0],
      dz = q[1] - p[i][1],
      l = Math.hypot(dx, dz) || 1e-9;
    let nx = dz / l,
      nz = -dx / l;
    if (inP([(p[i][0] + q[0]) / 2 + nx * 0.05, (p[i][1] + q[1]) / 2 + nz * 0.05], p)) {
      nx = -nx;
      nz = -nz;
    }
    a.nr.push([nx, nz]);
  }
  a.n = Array.isArray(a.n) ? a.n : [];
  while (a.n.length < L) a.n.push(a.n.length ? a.n[a.n.length - 1] : 2);
  a.n.length = L;
  a.n = a.n.map((v) => plmCl(+v || 2, 0.3, 20));
  a.w = Array.isArray(a.w) ? a.w : [];
  while (a.w.length < L) a.w.push(false);
  a.w.length = L;
  a.ne = a.n.map((v, i) => (a.w[i] ? 0.02 : v));
  let x0 = 1e9,
    z0 = 1e9,
    x1 = -1e9,
    z1 = -1e9;
  p.forEach((q) => {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    z0 = Math.min(z0, q[1]);
    z1 = Math.max(z1, q[1]);
  });
  const cap = 110,
    st = Math.max(6, Math.max(x1 - x0, z1 - z0) / 30 + (cap * 2) / 40);
  let tn = 1e9,
    tx = -1e9;
  for (let x = x0 - cap; x <= x1 + cap; x += st)
    for (let z = z0 - cap; z <= z1 + cap; z += st) {
      const v = GHf(x, z);
      if (v === v) {
        tn = Math.min(tn, v);
        tx = Math.max(tx, v);
      }
    }
  if (tn > tx) {
    tn = tx = a.z;
  }
  const R = Math.min(cap * 1.1, Math.max(Math.abs(a.z - tn), Math.abs(tx - a.z)) * Math.max(...a.ne) + 3);
  a.R = R;
  a.bb = [x0 - R, z0 - R, x1 + R, z1 + R];
  a.pb = [x0, z0, x1, z1];
  return a;
}
function plmM(a, x, z, o) {
  const p = a.poly,
    L = p.length;
  let bd = 1e18,
    bk = 0,
    bt = 0;
  for (let i = 0; i < L; i++) {
    const A = p[i],
      B = p[(i + 1) % L],
      ex = B[0] - A[0],
      ez = B[1] - A[1],
      l2 = ex * ex + ez * ez || 1e-12,
      t = ((x - A[0]) * ex + (z - A[1]) * ez) / l2,
      tc = t < 0 ? 0 : t > 1 ? 1 : t,
      px = A[0] + tc * ex - x,
      pz_ = A[1] + tc * ez - z,
      d = px * px + pz_ * pz_;
    if (d < bd) {
      bd = d;
      bk = i;
      bt = t;
    }
  }
  const d = Math.sqrt(bd);
  let n, id;
  if (bt > 0 && bt < 1) {
    n = a.ne[bk];
    id = bk;
  } else {
    const vi = bt <= 0 ? bk : (bk + 1) % L,
      e1 = (vi + L - 1) % L,
      N1 = a.nr[e1],
      N2 = a.nr[vi],
      ux = (x - p[vi][0]) / (d || 1),
      uz = (z - p[vi][1]) / (d || 1),
      a1 = Math.atan2(N1[1], N1[0]);
    let arc = Math.atan2(N2[1], N2[0]) - a1,
      du = Math.atan2(uz, ux) - a1;
    while (arc > Math.PI) arc -= 6.283185307;
    while (arc < -Math.PI) arc += 6.283185307;
    while (du > Math.PI) du -= 6.283185307;
    while (du < -Math.PI) du += 6.283185307;
    const f = Math.abs(arc) < 1e-6 ? 0 : plmCl(du / arc, 0, 1);
    n = a.ne[e1] * (1 - f) + a.ne[vi] * f;
    id = -1 - vi;
  }
  if (o) {
    o.d = d;
    o.n = n;
    o.id = id;
  }
  return d / n;
}
function plmEval(a, x, z, v) {
  if (x < a.bb[0] || x > a.bb[2] || z < a.bb[1] || z > a.bb[3]) return v;
  if (inP([x, z], a.poly)) return a.z;
  const m = plmM(a, x, z),
    F = a.z - m,
    C = a.z + m;
  return v < F ? F : v > C ? C : v;
}
function plmSync() {
  const act = PLM.a.filter((a) => a.on !== false);
  PLMH = act.length
    ? (x, z, v) => {
        for (const a of act) v = plmEval(a, x, z, v);
        return v;
      }
    : null;
}
// ---- Statistik / Massen
function plmStats(a, step) {
  const b = a.bb,
    w = b[2] - b[0],
    h = b[3] - b[1],
    sp = step || Math.max(1, Math.sqrt((w * h) / 45000));
  let fill = 0,
    cut = 0,
    tn = 1e9,
    tx = -1e9,
    ts = 0,
    tc = 0;
  for (let x = b[0] + sp / 2; x < b[2]; x += sp)
    for (let z = b[1] + sp / 2; z < b[3]; z += sp) {
      const T = GHf(x, z),
        f = plmEval(a, x, z, T),
        d = f - T;
      if (d > 0) fill += d * sp * sp;
      else cut -= d * sp * sp;
      if (x >= a.pb[0] && x <= a.pb[2] && z >= a.pb[1] && z <= a.pb[3] && inP([x, z], a.poly)) {
        tn = Math.min(tn, T);
        tx = Math.max(tx, T);
        ts += T;
        tc++;
      }
    }
  return { fill, cut, tn: tc ? tn : a.z, tx: tc ? tx : a.z, avg: tc ? ts / tc : a.z };
}
function plmAvg(poly) {
  let x0 = 1e9,
    z0 = 1e9,
    x1 = -1e9,
    z1 = -1e9;
  poly.forEach((q) => {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    z0 = Math.min(z0, q[1]);
    z1 = Math.max(z1, q[1]);
  });
  const sp = Math.max(0.7, Math.sqrt(((x1 - x0) * (z1 - z0)) / 20000));
  let s = 0,
    c = 0,
    tn = 1e9,
    tx = -1e9;
  for (let x = x0 + sp / 2; x < x1; x += sp)
    for (let z = z0 + sp / 2; z < z1; z += sp)
      if (inP([x, z], poly)) {
        const v = GHf(x, z);
        s += v;
        c++;
        tn = Math.min(tn, v);
        tx = Math.max(tx, v);
      }
  return c ? { avg: s / c, tn, tx } : { avg: GHf(...cen(poly)), tn: 0, tx: 0 };
}
function plmBalance(a) {
  const z0 = a.z;
  let lo = -1e9,
    hi = 1e9;
  const s0 = plmStats(a, 3);
  lo = s0.tn - 6;
  hi = s0.tx + 6;
  for (let k = 0; k < 26; k++) {
    a.z = (lo + hi) / 2;
    plmPrep(a);
    const s = plmStats(a, 2.5);
    if (s.fill > s.cut) hi = a.z;
    else lo = a.z;
  }
  a.z = Math.round(((lo + hi) / 2) * 100) / 100;
  plmPrep(a);
}
// ---- Schraffur
function plmHatch(a) {
  const p = a.poly,
    L = p.length,
    s = Math.max(0.25, PLM.hs),
    segs = [],
    toe = [],
    o = {};
  let k = 0;
  const trace = (sx, sz, dx, dz, id0) => {
    const stp = 0.2;
    let last = 0,
      d = 0;
    while (d < a.R) {
      d += stp;
      const x = sx + dx * d,
        z = sz + dz * d;
      if (inP([x, z], p)) break;
      const m = plmM(a, x, z, o);
      if (o.id !== id0 || Math.abs(o.d - d) > 0.3) break;
      const T = GHf(x, z);
      if (T < a.z - m || T > a.z + m) last = d;
      else break;
    }
    if (last > 0) {
      let lo = last,
        hi = last + stp;
      for (let i = 0; i < 4; i++) {
        const md = (lo + hi) / 2,
          x = sx + dx * md,
          z = sz + dz * md,
          m = plmM(a, x, z, o);
        if (!inP([x, z], p) && o.id === id0 && (GHf(x, z) < a.z - m || GHf(x, z) > a.z + m)) lo = md;
        else hi = md;
      }
      last = lo;
    }
    return last;
  };
  const add = (sx, sz, dx, dz, id0) => {
    const Lh = trace(sx, sz, dx, dz, id0);
    if (Lh < 0.3) {
      toe.push(null);
      k++;
      return;
    }
    const full = k++ % 2 === 0,
      mx = sx + dx * Lh * 0.5,
      mz = sz + dz * Lh * 0.5,
      T = GHf(mx, mz);
    segs.push([sx, sz, sx + dx * Lh * (full ? 1 : 0.5), sz + dz * Lh * (full ? 1 : 0.5), T < a.z ? 0 : 1]);
    toe.push([sx + dx * Lh, sz + dz * Lh]);
  };
  let ar = 0;
  for (let i = 0; i < L; i++) {
    const q = p[(i + 1) % L];
    ar += p[i][0] * q[1] - q[0] * p[i][1];
  }
  const sg = ar >= 0 ? 1 : -1;
  for (let i = 0; i < L; i++) {
    const e1 = (i + L - 1) % L,
      P0 = p[e1],
      P1 = p[i],
      P2 = p[(i + 1) % L],
      cr = ((P1[0] - P0[0]) * (P2[1] - P1[1]) - (P1[1] - P0[1]) * (P2[0] - P1[0])) * sg;
    if (cr > 1e-9 && !a.w[e1] && !a.w[i]) {
      const N1 = a.nr[e1],
        N2 = a.nr[i],
        a1 = Math.atan2(N1[1], N1[0]);
      let arc = Math.atan2(N2[1], N2[0]) - a1;
      while (arc > Math.PI) arc -= 6.283185307;
      while (arc < -Math.PI) arc += 6.283185307;
      const l1 = trace(P1[0], P1[1], N1[0], N1[1], -1 - i),
        l2 = trace(P1[0], P1[1], N2[0], N2[1], -1 - i),
        Le = (l1 + l2) / 2,
        nf = Math.floor((Math.abs(arc) * Le) / (1.4 * s));
      for (let q = 0; q < nf; q++) {
        const an = a1 + (arc * (q + 1)) / (nf + 1);
        add(P1[0], P1[1], Math.cos(an), Math.sin(an), -1 - i);
      }
    }
    if (a.w[i]) continue;
    const Q = P2,
      l = Math.hypot(Q[0] - P1[0], Q[1] - P1[1]),
      nS = Math.max(1, Math.round(l / s)),
      N = a.nr[i];
    for (let j = 0; j < nS; j++) {
      const t = (j + 0.5) / nS;
      add(P1[0] + (Q[0] - P1[0]) * t, P1[1] + (Q[1] - P1[1]) * t, N[0], N[1], i);
    }
  }
  return { segs, toe };
}
function plmPaint() {
  const c = PL.plm.getContext('2d');
  c.clearRect(0, 0, PW, PW);
  if (!GEO.size) return;
  const K = PW / GEO.size,
    X = (v) => (v + GEO.size / 2) * K,
    lw = Math.max(1.1, 0.13 * K);
  for (const a of PLM.a) {
    if (a.on === false) continue;
    const sel = a.id === PLM.sel;
    c.beginPath();
    a.poly.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
    c.closePath();
    c.fillStyle = 'rgba(236,232,220,.6)';
    c.fill();
    if (PLM.hatch) {
      const H = plmHatch(a);
      c.lineCap = 'butt';
      c.lineWidth = lw;
      c.strokeStyle = PLM.cf;
      c.beginPath();
      for (const g of H.segs) {
        c.moveTo(X(g[0]), X(g[1]));
        c.lineTo(X(g[2]), X(g[3]));
      }
      c.stroke();
      c.strokeStyle = PLM.cf;
      c.lineWidth = lw * 0.9;
      c.beginPath();
      let pen = false;
      for (const q of H.toe) {
        if (!q) {
          pen = false;
          continue;
        }
        pen ? c.lineTo(X(q[0]), X(q[1])) : c.moveTo(X(q[0]), X(q[1]));
        pen = true;
      }
      c.stroke();
    }
  }
  try {
    recomp();
  } catch (e) {
    console.error(e);
  }
}
{
  const _rc = recomp;
  recomp = function () {
    const r = _rc.apply(this, arguments);
    try {
      if (PLM.a.some((a) => a.on !== false)) {
        GEO.comp.getContext('2d').drawImage(PL.plm, 0, 0);
        if (GEO.tex) GEO.tex.needsUpdate = true;
      }
    } catch (e) {
      logErr(e, 'recomp');
    }
    return r;
  };
}
