// ---- Prüfungen
function szSolid(b, j) {
  return boolDiff(
    [bpP(lf(b, b.levels[j]))],
    (b.voids || []).filter((v) => j >= v.j0 && j <= v.j1).map((v) => bpP(v.poly)),
  );
}
// freie, von oben sichtbare Dachfläche des Geschosses j (ohne Fläche darüber, ohne Höfe, ohne bereits gezeichnete Flächen)
function szExposed(b, j, skip) {
  let r = szSolid(b, j);
  if (j + 1 < b.levels.length) r = boolDiff(r, szSolid(b, j + 1));
  const fs = (b.levels[j].faces || []).filter((f) => f !== skip).map((f) => bpP(f.poly));
  return fs.length ? boolDiff(r, fs) : r;
}
function szExposed0(b, j) {
  let r = szSolid(b, j);
  if (j + 1 < b.levels.length) r = boolDiff(r, szSolid(b, j + 1));
  return r;
}
function szShared(P, Q) {
  let sum = 0;
  P.forEach((a, i) => {
    const c = P[(i + 1) % P.length],
      L = Math.hypot(c[0] - a[0], c[1] - a[1]),
      n = Math.max(2, Math.ceil(L / 0.25));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (szDist([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], Q) < 2e-3) sum += L / n;
    }
  });
  return sum;
}
// Gezeichnete/geteilte Flächen folgen dem Gebäude: auf die freie Dachfläche zurechtgeschnitten, frei gewordene Dachfläche geht an die angrenzende geteilte Fläche
function szFix(b) {
  let any = false;
  b.levels.forEach((l, j) => {
    if (!l.faces || !l.faces.length) return;
    const ex = szExposed0(b, j),
      out = [],
      acc = [];
    l.faces.forEach((f) => {
      const rest = acc.length ? boolDiff(ex, acc) : ex;
      boolInter([bpP(f.poly)], rest).forEach((P) => {
        if (P.h.length) return;
        const poly = P.o.map((q) => [q[0], q[1]]);
        if (szA(poly) < 0.05) return;
        out.push({ poly, part: f.part });
        acc.push(bpP(poly));
      });
    });
    if (out.some((f) => f.part)) {
      boolDiff(ex, acc).forEach((P) => {
        if (P.h.length || szA(P.o) < 0.05) return;
        let best = null,
          bs = 0.05;
        out.forEach((f) => {
          if (!f.part) return;
          const sh = szShared(P.o, f.poly);
          if (sh > bs) {
            bs = sh;
            best = f;
          }
        });
        if (best) {
          const u = boolUnion([bpP(best.poly)], [bpP(P.o)]);
          if (u.length === 1 && !u[0].h.length) best.poly = u[0].o.map((q) => [q[0], q[1]]);
        }
      });
    }
    let same = out.length === l.faces.length;
    if (same)
      for (let i = 0; i < out.length; i++) {
        const A = szA(l.faces[i].poly),
          B = szA(out[i].poly);
        if (
          Math.abs(A - B) > 1e-3 ||
          boolArea(boolInter([bpP(l.faces[i].poly)], [bpP(out[i].poly)])) < A - 1e-3
        ) {
          same = false;
          break;
        }
      }
    if (!same) {
      if (out.length) l.faces = out;
      else delete l.faces;
      any = true;
    }
  });
  if (any) {
    SK.sel = SK.sel.filter((e) => e.b !== b || e.face == null);
    SK.ver++;
  }
  return any;
}
// mesh(): Erweiterung zusammengeführt, siehe 01-modell-3d/020-mehrkoerper.js
function szOkF(b, j, poly, skip) {
  if (poly.length < 3 || szA(poly) < 0.05 || znEdgesX(poly, poly)) return false;
  const I = boolInter([bpP(poly)], szExposed(b, j, skip));
  return szA(poly) - boolArea(I) < Math.max(1e-3, szA(poly) * 1e-4);
}
function szOkV(b, poly, j0, j1, skip) {
  if (
    j0 < 0 ||
    j1 >= b.levels.length ||
    j0 > j1 ||
    poly.length < 3 ||
    szA(poly) < 0.5 ||
    znEdgesX(poly, poly)
  )
    return false;
  for (let j = j0; j <= j1; j++) {
    if (!znInterior(lf(b, b.levels[j]), poly)) return false;
    if ((b.levels[j].faces || []).some((f) => f !== skip && znOverlap(f.poly, poly))) return false;
  }
  if ((b.voids || []).some((v) => v !== skip && v.j0 <= j1 && v.j1 >= j0 && znOverlap(v.poly, poly)))
    return false;
  return !(j1 + 1 < b.levels.length && znOverlap(lf(b, b.levels[j1 + 1]), poly));
}
function szClean(poly) {
  const r = [];
  poly.forEach((p) => {
    if (!r.length || Math.hypot(p[0] - r[r.length - 1][0], p[1] - r[r.length - 1][1]) > 1e-6)
      r.push([p[0], p[1]]);
  });
  while (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-6)
    r.pop();
  return r;
}
function szSnap0(b) {
  return {
    L: JSON.stringify(b.levels),
    V: JSON.stringify(b.voids || []),
    P: JSON.stringify(b.patches || []),
    F: JSON.stringify(b.fp),
  };
}
function szRestore(b, s) {
  b.levels = JSON.parse(s.L);
  b.voids = JSON.parse(s.V);
  b.patches = JSON.parse(s.P);
  if (s.F) b.fp = JSON.parse(s.F);
}
function szSelect(list) {
  SK.sel = list;
  SK.ver++;
  skSync();
}
function szRefresh(b) {
  mesh(b);
  try {
    H();
    hpos();
    rr();
  } catch (e) {
    logErr(e, 'szRefresh');
  }
}
// ---- Fang
function szRings(b, j) {
  const l = b.levels[j],
    R = [lf(b, l)];
  (l.faces || []).forEach((z) => R.push(z.poly));
  (b.voids || []).forEach((v) => {
    if (j >= v.j0 && j <= v.j1) R.push(v.poly);
  });
  if (j + 1 < b.levels.length) R.push(lf(b, b.levels[j + 1]));
  return R;
}
function szSnap(b, j, p, alt, extra) {
  const r5 = (v) => Math.round(v * 20) / 20;
  if (alt) return { p: [r5(p[0]), r5(p[1])], lab: '' };
  const thr = Math.min(0.6, Math.max(0.12, 12 * mpp())),
    R = szRings(b, j);
  if (extra && extra.length) R.push(extra);
  let bd = thr,
    bp = null,
    lab = '';
  R.forEach((r) =>
    r.forEach((v) => {
      const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
      if (d < bd) {
        bd = d;
        bp = v.slice();
        lab = 'Endpunkt';
      }
    }),
  );
  if (bp) return { p: bp, lab };
  bd = thr;
  R.forEach((r) =>
    r.forEach((a, i) => {
      const c = r[(i + 1) % r.length],
        m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
        d = Math.hypot(m[0] - p[0], m[1] - p[1]);
      if (d < bd) {
        bd = d;
        bp = m;
        lab = 'Mittelpunkt';
      }
    }),
  );
  if (bp) return { p: bp, lab };
  bd = thr * 0.7;
  R.forEach((r) =>
    r.forEach((a, i) => {
      const c = r[(i + 1) % r.length],
        ex = c[0] - a[0],
        ez = c[1] - a[1],
        L2 = ex * ex + ez * ez;
      if (L2 < 1e-9) return;
      let t = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2;
      t = Math.max(0, Math.min(1, t));
      const q = [a[0] + ex * t, a[1] + ez * t],
        d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) {
        bd = d;
        bp = q;
        lab = 'Kante';
      }
    }),
  );
  if (bp) return { p: bp, lab };
  return { p: [r5(p[0]), r5(p[1])], lab: '' };
}
// Winkelfang für freie Linien: parallel / rechtwinklig / 45° zu Kanten des Daches, sonst zu den Achsen
function szAngSnap(d, p, alt, sn) {
  if (alt || !d.pts.length) return sn;
  if (sn.lab === 'Endpunkt' || sn.lab === 'Mittelpunkt') return sn;
  const p0 = d.pts[d.pts.length - 1],
    thr = Math.max(0.15, Math.min(0.8, 12 * mpp())),
    R = szRings(d.b, d.j),
    angs = [];
  R.forEach((r) =>
    r.forEach((a, i) => {
      const c = r[(i + 1) % r.length],
        L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 0.3) return;
      let t = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI;
      t = ((t % 180) + 180) % 180;
      if (!angs.some((x) => Math.abs(x - t) < 0.3 || Math.abs(Math.abs(x - t) - 180) < 0.3)) angs.push(t);
    }),
  );
  const C = [];
  angs.forEach((t) => {
    C.push(
      [t, 'Parallel zur Kante', 0],
      [t + 90, 'Rechtwinklig zur Kante', 0],
      [t + 45, '45° zur Kante', 1],
      [t + 135, '45° zur Kante', 1],
    );
  });
  [
    [0, 'Ost/West (Achse)'],
    [90, 'Nord/Süd (Achse)'],
    [45, '45°'],
    [135, '45°'],
  ].forEach((x) => C.push([x[0], x[1], 2]));
  let best = null,
    bd = thr;
  C.forEach((c) => {
    const th = (c[0] * Math.PI) / 180,
      ux = Math.cos(th),
      uz = Math.sin(th),
      t = (p[0] - p0[0]) * ux + (p[1] - p0[1]) * uz,
      q = [p0[0] + ux * t, p0[1] + uz * t],
      dd = Math.hypot(q[0] - p[0], q[1] - p[1]) + c[2] * 0.02;
    if (Math.abs(t) > 0.3 && dd < bd) {
      bd = dd;
      best = { p: q, lab: c[1] };
    }
  });
  if (!best) return sn;
  const q = best.p,
    r5 = (v) => Math.round(v * 20) / 20;
  return { p: [r5(q[0]), r5(q[1])], lab: best.lab };
}
// ---- Vorschau
var SZP = new T.LineSegments(
  new T.BufferGeometry(),
  new T.LineBasicMaterial({ color: 0x2f7fd0, depthTest: false, transparent: true }),
);
var SZPs = SZP.material,
  SZPd = new T.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.6,
    gapSize: 0.35,
    depthTest: false,
    transparent: true,
  });
SZP.renderOrder = 9;
SZP.frustumCulled = false;
SZP.visible = false;
SZP.raycast = () => {};
sc.add(SZP);
function szPrev(pts, close, y, col) {
  if (pts.length < 2) {
    SZP.visible = false;
    return;
  }
  const pos = [],
    n = pts.length;
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const a = pts[i],
      c = pts[(i + 1) % n];
    pos.push(a[0], y + 0.03, a[1], c[0], y + 0.03, c[1]);
  }
  SZP.geometry.dispose();
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  SZP.geometry = g;
  if (col === 0xd63a2f) {
    SZP.material = SZPd;
    SZP.computeLineDistances();
  } else {
    SZP.material = SZPs;
    SZP.material.color.setHex(col || 0x2f7fd0);
  }
  SZP.visible = true;
}
function szReset() {
  SZ.d = null;
  SZP.visible = false;
  try {
    skMkEl().style.display = 'none';
    skTip('', null);
  } catch (e) {
    logErr(e, 'szReset');
  }
}
function szMark(p, y, lab, e) {
  try {
    const mk = skMkEl(),
      sp = skProj(p[0], y, p[1]);
    mk.style.display = 'block';
    mk.style.left = sp[0] + 'px';
    mk.style.top = sp[1] + 'px';
    skTip(lab, e);
  } catch (e) {
    logErr(e, 'szMark');
  }
}
function szEntOf(en) {
  if (!en || en.vd != null) return null;
  if (en.face != null || en.top) return { b: en.b, j: en.j };
  return null;
}
function szRect(d, cur) {
  const p0 = d.pts[0],
    u = d.u,
    v = [-u[1], u[0]],
    dx = cur[0] - p0[0],
    dz = cur[1] - p0[1],
    w = dx * u[0] + dz * u[1],
    h = dx * v[0] + dz * v[1];
  return [
    p0,
    [p0[0] + u[0] * w, p0[1] + u[1] * w],
    [p0[0] + u[0] * w + v[0] * h, p0[1] + u[1] * w + v[1] * h],
    [p0[0] + v[0] * h, p0[1] + v[1] * h],
  ];
}
function szAxis(b, j, p) {
  const f = lf(b, b.levels[j]);
  let bd = 1e9,
    u = [1, 0];
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length],
      L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 0.05) return;
    const d = szDist(p, [a, c]);
    if (d < bd) {
      bd = d;
      u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
    }
  });
  return u;
}
