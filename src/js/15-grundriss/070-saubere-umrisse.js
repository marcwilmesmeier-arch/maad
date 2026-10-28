// ---- v233: saubere Umrisse (Fassade je Ansichtsfläche, Terrassen exakt statt Raster), Beschriftung je Ansichtsfläche
function zoFasOl(f, z0, z1) {
  const o = [],
    n = f.length;
  for (let i = 0; i < n; i++) {
    const p = f[(i + n - 1) % n],
      a = f[i],
      c = f[(i + 1) % n],
      l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l < 0.01) continue;
    o.push(a[0], z0, a[1], c[0], z0, c[1], a[0], z1, a[1], c[0], z1, c[1]);
    const l0 = Math.hypot(a[0] - p[0], a[1] - p[1]),
      cr = l0 > 1e-6 ? ((a[0] - p[0]) * (c[1] - a[1]) - (a[1] - p[1]) * (c[0] - a[0])) / (l0 * l) : 1,
      dt = l0 > 1e-6 ? ((a[0] - p[0]) * (c[0] - a[0]) + (a[1] - p[1]) * (c[1] - a[1])) / (l0 * l) : 0;
    if (Math.abs(cr) > 0.003 || dt < 0) o.push(a[0], z0, a[1], a[0], z1, a[1]);
  }
  return o;
}
function zoFasLab(FA) {
  const cl = [];
  FA.forEach(([f, z0, z1]) => {
    const n = f.length;
    f.forEach((a, j) => {
      const d = f[(j + 1) % n],
        dx = d[0] - a[0],
        dz = d[1] - a[1],
        ln = Math.hypot(dx, dz);
      if (ln < 0.5) return;
      let nx = dz / ln,
        nz = -dx / ln;
      const mx = (a[0] + d[0]) / 2,
        mz = (a[1] + d[1]) / 2;
      if (inP([mx + nx * 0.05, mz + nz * 0.05], f)) {
        nx = -nx;
        nz = -nz;
      }
      const ang = (Math.atan2(nz, nx) * 180) / Math.PI,
        ar = ln * (z1 - z0);
      let c = cl.find((q) => {
        let dd = Math.abs(q.ang - ang) % 360;
        if (dd > 180) dd = 360 - dd;
        return dd < 15;
      });
      if (!c) {
        c = { ang, ar: 0, x: 0, y: 0, z: 0, nx: 0, nz: 0 };
        cl.push(c);
      }
      c.ar += ar;
      c.x += mx * ar;
      c.y += ((z0 + z1) / 2) * ar;
      c.z += mz * ar;
      c.nx += nx * ar;
      c.nz += nz * ar;
    });
  });
  return cl
    .filter((c) => c.ar > 0.05)
    .map((c) => {
      const nl = Math.hypot(c.nx, c.nz) || 1;
      return {
        p: new T.Vector3(c.x / c.ar + (c.nx / nl) * 0.6, c.y / c.ar, c.z / c.ar + (c.nz / nl) * 0.6),
        t: f1(c.ar, 1) + ' m²',
      };
    });
}
// exakte Differenz A\B (Polygone) als Trapezstreifen + echte Randsegmente
function zoTerrGeo(b, L) {
  const A = lf(b, b.levels[L.i]),
    B = lf(b, b.levels[L.i + 1]),
    y = L.y + 0.04,
    xs = new Set();
  A.concat(B).forEach((p) => xs.add(p[0]));
  for (let i = 0; i < A.length; i++) {
    const a = A[i],
      c = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      const d = B[j],
        e = B[(j + 1) % B.length],
        r = [c[0] - a[0], c[1] - a[1]],
        q = [e[0] - d[0], e[1] - d[1]],
        den = r[0] * q[1] - r[1] * q[0];
      if (Math.abs(den) < 1e-12) continue;
      const t = ((d[0] - a[0]) * q[1] - (d[1] - a[1]) * q[0]) / den,
        u = ((d[0] - a[0]) * r[1] - (d[1] - a[1]) * r[0]) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) xs.add(a[0] + t * r[0]);
    }
  }
  const X = [...xs].sort((p, q) => p - q),
    ey = (e, x) => e[0][1] + ((e[1][1] - e[0][1]) * (x - e[0][0])) / (e[1][0] - e[0][0]),
    iv = (P, x) => {
      const c = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i],
          d = P[(i + 1) % P.length];
        if (a[0] <= x !== d[0] <= x) c.push({ e: [a, d], y: ey([a, d], x) });
      }
      c.sort((p, q) => p.y - q.y);
      const o = [];
      for (let i = 0; i + 1 < c.length; i += 2) o.push({ lo: c[i].e, hi: c[i + 1].e });
      return o;
    },
    sl = [];
  for (let k = 0; k + 1 < X.length; k++) {
    const x0 = X[k],
      x1 = X[k + 1];
    if (x1 - x0 < 1e-7) {
      sl.push({ x0, x1, p: [] });
      continue;
    }
    const xm = (x0 + x1) / 2,
      ib = iv(B, xm);
    let out = [];
    for (const pa of iv(A, xm)) {
      let pc = [pa];
      for (const pb of ib) {
        const nx = [];
        for (const q of pc) {
          const ql = ey(q.lo, xm),
            qh = ey(q.hi, xm),
            bl = ey(pb.lo, xm),
            bh = ey(pb.hi, xm);
          if (bh <= ql || bl >= qh) {
            nx.push(q);
            continue;
          }
          if (bl > ql) nx.push({ lo: q.lo, hi: pb.lo });
          if (bh < qh) nx.push({ lo: pb.hi, hi: q.hi });
        }
        pc = nx;
      }
      out = out.concat(pc);
    }
    sl.push({ x0, x1, p: out });
  }
  const sub = (a, b, list) => {
      let r = [[a, b]];
      for (const [l, h] of list) {
        const n = [];
        for (const [p, q] of r) {
          if (h <= p + 1e-7 || l >= q - 1e-7) {
            n.push([p, q]);
            continue;
          }
          if (l > p + 1e-7) n.push([p, l]);
          if (h < q - 1e-7) n.push([h, q]);
        }
        r = n;
      }
      return r.filter((s) => s[1] - s[0] > 1e-5);
    },
    pos = [],
    ol = [];
  sl.forEach((s, k) => {
    const pv = k > 0 ? sl[k - 1] : null,
      nx = k + 1 < sl.length ? sl[k + 1] : null;
    for (const q of s.p) {
      const a0 = ey(q.lo, s.x0),
        a1 = ey(q.lo, s.x1),
        b0 = ey(q.hi, s.x0),
        b1 = ey(q.hi, s.x1);
      pos.push(s.x0, y, a0, s.x1, y, a1, s.x1, y, b1, s.x0, y, a0, s.x1, y, b1, s.x0, y, b0);
      ol.push(s.x0, y, a0, s.x1, y, a1, s.x0, y, b0, s.x1, y, b1);
      const lc = pv && Math.abs(pv.x1 - s.x0) < 1e-9 ? pv.p.map((r) => [ey(r.lo, s.x0), ey(r.hi, s.x0)]) : [],
        rc = nx && Math.abs(nx.x0 - s.x1) < 1e-9 ? nx.p.map((r) => [ey(r.lo, s.x1), ey(r.hi, s.x1)]) : [];
      sub(a0, b0, lc).forEach(([p, r]) => ol.push(s.x0, y, p, s.x0, y, r));
      sub(a1, b1, rc).forEach(([p, r]) => ol.push(s.x1, y, p, s.x1, y, r));
    }
  });
  return { pos, ol };
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  try {
    const t = e.target;
    if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
    if (typeof LAY !== 'undefined' && LAY.open) return;
    if (typeof HOME !== 'undefined' && HOME.open) return;
    if (ZI.sp) zoIsoClear(true);
    if (S.hlk) {
      S.hlk = null;
      S.hlb = null;
      S.hlw = 0;
      hlClear();
    }
    S.anO = {};
    try {
      rr();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    try {
      zoRender();
      zoTick.k = zoSig();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  } catch (err) {
    console.warn(err);
  }
});
function zoNew(b) {
  try {
    if (!b._g || b.ex) return;
    b._g.visible = S.zo.m !== 'u';
    zoPaint(b);
    exOne(b);
    if (ZI.sp) zoIsoApply();
  } catch (e) {
    console.warn('zoNew', e);
  }
}
function zoApply() {
  const m = S.zo.m;
  S.bld.forEach((b) => {
    if (b.ex || !b._g) return;
    try {
      b._g.visible = m !== 'u';
      zoPaint(b);
    } catch (e) {
      console.warn('zoApply', e);
    }
  });
  G.un.visible = zoUnVis();
  try {
    zoUnPaint();
  } catch (e) {
    logErr(e, 'zoApply');
  }
  exApply();
}
const zoSig = () =>
  JSON.stringify([
    S.din,
    S.zo.pi,
    ZI.key,
    S.zo.m,
    S.noK,
    S.dar,
    S.sel && S.sel.id,
    S.uses,
    S.fa.map((f) => f.k + f.n + f.c + f.d + f.f),
    S.bld.map((b) => [
      b.id,
      b._g && b._g.id,
      b.name,
      b.levels.map((l) => [l.use, l.h]),
      b.roof && b.roof.use,
      b.ub && grSig(b),
      b.fd || 0,
      S.ft,
    ]),
  ]);
function zoTick(force) {
  const k = zoSig();
  if (!force && k === zoTick.k) return;
  zoTick.k = k;
  zoApply();
  const e = $('zol');
  if (e && !(e.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)))
    zoRender();
}
setInterval(() => {
  try {
    zoTick();
    faRender();
  } catch (e) {
    console.warn(e);
  }
}, 300);
setTimeout(() => {
  try {
    zoTick(true);
  } catch (e) {
    console.warn(e);
  }
}, 0);
// ---- Abstandsflächen werden ausgeblendet, solange die Explosionsansicht aktiv ist (auch bei angewähltem Gebäude)
{
  const _p = abstPaint;
  abstPaint = function () {
    if (S.expl && S.expl.on) {
      const c = PL.abst.getContext('2d');
      c.clearRect(0, 0, PW, PW);
      S._abst = null;
      return;
    }
    return _p.apply(this, arguments);
  };
}
{
  const _t = tgExp;
  tgExp = function () {
    const r = _t.apply(this, arguments);
    try {
      abstPaint();
      recomp();
    } catch (e) {
      logErr(e, 'tgExp');
    }
    return r;
  };
}
