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
/** Terrassenfläche eines Geschosses als Dreiecke (pos) und Umriss (ol), genau aus den Polygonen (terrOf: P). */
function zoTerrGeo(b, L) {
  const y = L.y + 0.04,
    pos = [],
    ol = [];
  (L.P || []).forEach((x) => {
    const H = x.h || [],
      v2 = (r) => r.map((p) => new T.Vector2(p[0], p[1])),
      alle = [x.o].concat(H);
    T.ShapeUtils.triangulateShape(v2(x.o), H.map(v2)).forEach((t) =>
      t.forEach((k) => {
        let n = k;
        for (const r of alle) {
          if (n < r.length) {
            pos.push(r[n][0], y, r[n][1]);
            break;
          }
          n -= r.length;
        }
      }),
    );
    alle.forEach((r) =>
      r.forEach((a, k) => {
        const c = r[(k + 1) % r.length];
        ol.push(a[0], y, a[1], c[0], y, c[1]);
      }),
    );
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
// abstPaint(): Erweiterung zusammengeführt, siehe 11-bearbeiten/010-werkzeug.js
// tgExp(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
