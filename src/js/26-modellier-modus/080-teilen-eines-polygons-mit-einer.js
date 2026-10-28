// ---- Teilen eines Polygons mit einer Geraden
function szSplitPoly(poly, a, c, ref) {
  const n = poly.length,
    D = [c[0] - a[0], c[1] - a[1]],
    hits = [];
  if (Math.hypot(D[0], D[1]) < 1e-6) return null;
  for (let i = 0; i < n; i++) {
    const p = poly[i],
      q = poly[(i + 1) % n],
      E = [q[0] - p[0], q[1] - p[1]],
      den = E[0] * D[1] - E[1] * D[0];
    if (Math.abs(den) < 1e-12) continue;
    const AP = [a[0] - p[0], a[1] - p[1]],
      s = (AP[0] * D[1] - AP[1] * D[0]) / den,
      t = (AP[0] * E[1] - AP[1] * E[0]) / den;
    if (s >= -1e-9 && s < 1 - 1e-9) hits.push({ i, s, t, pt: [p[0] + s * E[0], p[1] + s * E[1]] });
  }
  hits.sort((x, y) => x.t - y.t);
  if (hits.length < 2) return null;
  const tr = ref ? ((ref[0] - a[0]) * D[0] + (ref[1] - a[1]) * D[1]) / (D[0] * D[0] + D[1] * D[1]) : 0.5;
  let best = null,
    bd = 1e9;
  for (let k = 0; k + 1 < hits.length; k++) {
    const h1 = hits[k],
      h2 = hits[k + 1];
    if (h2.t - h1.t < 1e-9) continue;
    const m = [(h1.pt[0] + h2.pt[0]) / 2, (h1.pt[1] + h2.pt[1]) / 2];
    if (!znInP(m, poly)) continue;
    const dd = tr >= h1.t && tr <= h2.t ? 0 : Math.min(Math.abs(tr - h1.t), Math.abs(tr - h2.t));
    if (dd < bd) {
      bd = dd;
      best = [h1, h2];
    }
  }
  if (!best) return null;
  let [h1, h2] = best;
  if (h1.i > h2.i) {
    const x = h1;
    h1 = h2;
    h2 = x;
  }
  if (h1.i === h2.i) return null;
  const p1 = [h1.pt];
  for (let i = h1.i + 1; i <= h2.i; i++) p1.push(poly[i].slice());
  p1.push(h2.pt);
  const p2 = [h2.pt];
  for (let i = h2.i + 1; i < n; i++) p2.push(poly[i].slice());
  for (let i = 0; i <= h1.i; i++) p2.push(poly[i].slice());
  p2.push(h1.pt);
  const A = szClean(p1),
    B = szClean(p2);
  if (A.length < 3 || B.length < 3 || szA(A) < 0.05 || szA(B) < 0.05) return null;
  return [A, B];
}
// ---- Zeichnen (R / Z) und Teilen (L) auf dem Dach
function szNew(d, poly) {
  poly = szClean(poly);
  const b = d.b,
    j = d.j;
  if (poly.length < 3 || szA(poly) < 0.05) {
    szMsg('Form zu klein');
    return false;
  }
  if (znEdgesX(poly, poly)) {
    szMsg('Die Linien überkreuzen sich – Polygon nicht möglich');
    return false;
  }
  if (!szOkF(b, j, poly, null)) {
    szMsg(
      'Die Fläche muss ganz auf der freien Dachfläche liegen (nicht über dem Rand, nicht über einem höheren Geschoss oder Innenhof, nicht auf einer anderen Fläche)',
    );
    return false;
  }
  hist();
  const l = b.levels[j];
  (l.faces = l.faces || []).push({ poly });
  szRefresh(b);
  szSelect([{ b, j, face: l.faces.length - 1 }]);
  szMsg(
    'Fläche gezeichnet · ' +
      szA(poly).toFixed(1).replace('.', ',') +
      ' m² · P = Ziehen & Schieben: nach oben = Geschosse mit diesem Grundriss, nach unten = Innenhof ausschneiden',
  );
  return true;
}
function szSplitRegion(reg, a, c, ref) {
  if (!reg.length) return { err: 'Dort ist keine freie Dachfläche' };
  let pc = reg.find((P) => bpIn(ref, P));
  if (!pc) {
    let bd = 1e9;
    reg.forEach((P) => {
      const d = szDist(ref, P.o);
      if (d < bd) {
        bd = d;
        pc = P;
      }
    });
  }
  const D = [c[0] - a[0], c[1] - a[1]],
    L = Math.hypot(D[0], D[1]);
  if (L < 1e-6) return { err: 'Linie zu kurz' };
  const R = 2000,
    u = [(D[0] / L) * R, (D[1] / L) * R],
    n = [(-D[1] / L) * R, (D[0] / L) * R];
  const half = (s) =>
    bpP([
      [a[0] - u[0], a[1] - u[1]],
      [a[0] + u[0], a[1] + u[1]],
      [a[0] + u[0] + n[0] * s, a[1] + u[1] + n[1] * s],
      [a[0] - u[0] + n[0] * s, a[1] - u[1] + n[1] * s],
    ]);
  const l1 = boolInter([pc], [half(1)]),
    l2 = boolInter([pc], [half(-1)]),
    pcs = l1.concat(l2);
  if (pcs.length < 2) return { err: 'Die Linie teilt die Fläche nicht' };
  if (pcs.some((P) => P.h.length))
    return {
      err: 'Die Linie muss die Fläche ganz durchtrennen (Turm/Hof im Weg) – bitte weiter ziehen oder eine zweite Linie setzen',
    };
  let tmin = 1e9,
    tmax = -1e9;
  [pc.o].concat(pc.h).forEach((r) => {
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length],
        E = [q[0] - p[0], q[1] - p[1]],
        den = E[0] * D[1] - E[1] * D[0];
      if (Math.abs(den) < 1e-12) continue;
      const AP = [a[0] - p[0], a[1] - p[1]],
        s = (AP[0] * D[1] - AP[1] * D[0]) / den,
        t = (AP[0] * E[1] - AP[1] * E[0]) / den;
      if (s >= -1e-9 && s <= 1 + 1e-9) {
        tmin = Math.min(tmin, t);
        tmax = Math.max(tmax, t);
      }
    }
  });
  return {
    pieces: pcs.map((P) => P.o),
    line: [
      [a[0] + D[0] * tmin, a[1] + D[1] * tmin],
      [a[0] + D[0] * tmax, a[1] + D[1] * tmax],
    ],
  };
}
function szRegionOf(d) {
  const l = d.b.levels[d.j];
  return d.fi != null
    ? l.faces && l.faces[d.fi]
      ? [bpP(l.faces[d.fi].poly)]
      : []
    : szExposed(d.b, d.j, null);
}
function szDoSplit(d, a, c) {
  const b = d.b,
    j = d.j,
    l = b.levels[j];
  const r = szSplitRegion(szRegionOf(d), a, c, d.ref || a);
  if (r.err) {
    szMsg('Teilen: ' + r.err);
    return;
  }
  hist();
  const ps = r.pieces.map((p) => p.map((q) => q.slice()));
  if (d.fi != null) {
    l.faces.splice(d.fi, 1);
  }
  l.faces = l.faces || [];
  const i0 = l.faces.length;
  ps.forEach((p) => l.faces.push({ poly: p, part: 1 }));
  szRefresh(b);
  szSelect(ps.map((p, i) => ({ b, j, face: i0 + i })));
  szMsg(
    'Fläche in ' +
      ps.length +
      ' Teile geteilt · ' +
      ps.map((p) => szA(p).toFixed(1).replace('.', ',') + ' m²').join(' + ') +
      ' · jeden Teil einzeln mit P ziehen',
  );
  szReset();
}
function szDDown(e) {
  const t = SK.tool;
  let d = SZ.d;
  if (!d) {
    const en = skHit(e),
      q = szEntOf(en);
    if (!q) return false;
    if (!szFlat(q.b, q.j)) {
      szMsg('Flächen auf dem Dach gibt es nur bei Flachdach – Dachform des Gebäudes auf „Flachdach“ stellen');
      return false;
    }
    d = SZ.d = {
      kind: t === 'l' ? 'l' : t,
      b: q.b,
      j: q.j,
      y: szTop(q.b, q.j),
      pts: [],
      fi: t === 'l' && en.face != null ? en.face : null,
    };
    skVcbShow();
  }
  const p = planePt(e, d.y);
  if (!p) return true;
  let sn = szSnap(d.b, d.j, p, e.altKey, d.kind === 'z' ? d.pts : null);
  if (d.kind === 'l' || d.kind === 'z') sn = szAngSnap(d, p, e.altKey, sn);
  if (d.kind === 'r') {
    if (!d.pts.length) {
      d.pts = [sn.p];
      d.u = szAxis(d.b, d.j, sn.p);
      d.cur = sn.p;
      szMsg('Rechteck · zweiten Eckpunkt klicken · oder Breite;Tiefe tippen + Enter (z. B. 4;6)');
      return true;
    }
    const r = szRect(d, sn.p);
    if (szNew(d, r)) {
      szReset();
    }
    return true;
  }
  if (d.kind === 'z') {
    const n = d.pts.length;
    if (
      n >= 3 &&
      (Math.hypot(sn.p[0] - d.pts[0][0], sn.p[1] - d.pts[0][1]) < 1e-6 ||
        Math.hypot(sn.p[0] - d.pts[n - 1][0], sn.p[1] - d.pts[n - 1][1]) < 1e-6)
    ) {
      if (szNew(d, d.pts)) szReset();
      return true;
    }
    if (n && Math.hypot(sn.p[0] - d.pts[n - 1][0], sn.p[1] - d.pts[n - 1][1]) < 1e-6) return true;
    d.pts.push(sn.p);
    d.cur = sn.p;
    szMsg(
      'Polygon · ' +
        d.pts.length +
        ' Punkte · ersten Punkt anklicken oder Enter = schließen · Zahl + Enter = Strecke · Rücktaste = letzten Punkt zurück',
    );
    return true;
  }
  if (d.kind === 'l') {
    if (!d.pts.length) {
      d.pts = [sn.p];
      d.cur = sn.p;
      d.ref = sn.p;
      szMsg('Teilen · zweiten Punkt der Linie klicken (die Linie wird bis zum Rand verlängert)');
      return true;
    }
    d.ref = [(d.pts[0][0] + sn.p[0]) / 2, (d.pts[0][1] + sn.p[1]) / 2];
    if (Math.hypot(sn.p[0] - d.pts[0][0], sn.p[1] - d.pts[0][1]) < 1e-3) return true;
    szDoSplit(d, d.pts[0], sn.p);
    return true;
  }
  return true;
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      const d = SZ.d;
      if (!d || !skAct()) return;
      const p = planePt(e, d.y);
      if (!p) return;
      let sn = szSnap(d.b, d.j, p, e.altKey, d.kind === 'z' ? d.pts : null);
      if (d.kind === 'l' || d.kind === 'z') sn = szAngSnap(d, p, e.altKey, sn);
      d.cur = sn.p;
      if (d.kind === 'r' && d.pts.length) {
        const r = szRect(d, sn.p),
          w = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]),
          h = Math.hypot(r[3][0] - r[0][0], r[3][1] - r[0][1]);
        szPrev(r, true, d.y);
        if (!SK.vcb)
          szMsg('Rechteck ' + szF(w) + ' × ' + szF(h) + ' m · Klick = fertig · Zahlen: Breite;Tiefe + Enter');
      } else if (d.kind === 'z' && d.pts.length) {
        const pts = d.pts.concat([sn.p]);
        szPrev(pts, false, d.y);
        szMsg(
          'Polygon · ' +
            d.pts.length +
            ' Punkte · Strecke ' +
            szF(Math.hypot(sn.p[0] - d.pts[d.pts.length - 1][0], sn.p[1] - d.pts[d.pts.length - 1][1])) +
            ' m',
        );
      } else if (d.kind === 'l' && d.pts.length) {
        const r =
          Math.hypot(sn.p[0] - d.pts[0][0], sn.p[1] - d.pts[0][1]) > 1e-3
            ? szSplitRegion(szRegionOf(d), d.pts[0], sn.p, [
                (d.pts[0][0] + sn.p[0]) / 2,
                (d.pts[0][1] + sn.p[1]) / 2,
              ])
            : null;
        if (r && r.pieces) {
          szPrev(r.line, false, d.y, 0xd63a2f);
          szMsg(
            'Teilen · Klick = teilen · ' +
              r.pieces.map((p) => szA(p).toFixed(1).replace('.', ',') + ' m²').join(' + '),
          );
        } else {
          szPrev([d.pts[0], sn.p], false, d.y, 0xd63a2f);
          if (r && r.err) szMsg('Teilen · ' + r.err);
        }
      }
      szMark(sn.p, d.y, sn.lab, e);
    } catch (x) {
      console.warn('szm', x);
    }
  },
  true,
);
