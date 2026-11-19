/* Ansichten: Fluchtlinien und Geländeschnitt (aus fdDrawView, 040-fang.js).
   Fluchtlinien: jede Fassadenebene (Teile gleicher Tiefe, V.pcs[].dp) bekommt ihren Umriss als Linie, zurückliegende
   Ebenen dazu ihren Rücksprung gegenüber der vordersten (z. B. „−2,40“) – so ist erkennbar, welche Fassade vor welcher
   liegt. Geländeschnitt: das Gelände wird in der vordersten Fassadenebene geschnitten; die Schnittfläche darunter ist
   weiß, die Geländelinie kräftig. */

/** Umrisse der Fassadenebenen einer Ansicht (nach Tiefe vereinigt, zwischengespeichert an der Ansicht). */
function fdFluchtUmrisse(V) {
  if (V._fl) return V._fl;
  const P = (V.pcs || []).filter((p) => p.dp != null && p.ring && p.ring.length > 2),
    key = (p) => Math.round(p.dp / 0.05),
    ks = [...new Set(P.map(key))].sort((a, c) => a - c),
    R = [];
  if (ks.length > 1) {
    const vorn = Math.max(...P.map((p) => p.dp));
    ks.forEach((k) => {
      const L = P.filter((p) => key(p) === k);
      let U = [];
      try {
        U = L.reduce((acc, p) => (acc.length ? boolOp(acc, [bpP(p.ring)], 'u') : [bpP(p.ring)]), []);
      } catch (e) {
        logErr(e, 'fdFluchtUmrisse');
        U = L.map((p) => bpP(p.ring));
      }
      R.push({ d: L[0].dp - vorn, U });
    });
  }
  V._fl = R;
  return R;
}
/** Fluchtlinien zeichnen: Umriss je Ebene, Rücksprung der zurückliegenden Ebenen als Maß. */
function fdFluchten(g, V, ox) {
  const R = fdFluchtUmrisse(V);
  if (!R.length) return;
  const X = (u) => fdSX(u + ox),
    Y = fdSY;
  g.save();
  g.lineJoin = 'round';
  R.forEach((e) => {
    const vorn = Math.abs(e.d) < 0.03;
    g.strokeStyle = vorn ? '#1F2A33' : 'rgba(31,42,51,.62)';
    g.lineWidth = vorn ? 1.6 : 1.1;
    g.beginPath();
    e.U.forEach((P) =>
      [P.o].concat(P.h || []).forEach((r) => {
        r.forEach((q, i) => (i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))));
        g.closePath();
      }),
    );
    g.stroke();
    if (vorn) return;
    // Rücksprung an der oberen linken Ecke der größten Fläche der Ebene
    const P0 = e.U.slice().sort((a, c) => Math.abs(fvPA(c.o)) - Math.abs(fvPA(a.o)))[0];
    if (!P0) return;
    const u0 = Math.min(...P0.o.map((q) => q[0])),
      u1 = Math.max(...P0.o.map((q) => q[0])),
      v1 = Math.max(...P0.o.map((q) => q[1]));
    if (X(u1) - X(u0) < 46) return;
    g.font = '11px system-ui,sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillStyle = '#475569';
    g.fillText('−' + fdFmt(Math.abs(e.d)), X(u0) + 4, Y(v1) + 4);
  });
  g.restore();
}
/**
 * Geländelinie einer Ansicht in Ansichtskoordinaten: Gelände entlang der vordersten Fassadenebene (V.cut − 0,5),
 * von etwas links bis etwas rechts der Ansicht; v = Höhe über dem Gebäudesockel (oberirdisch).
 */
function fdGelaendeLinie(b, V) {
  if (b._y == null || !V.n) return null;
  const u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const base = b._y + ugH,
    [nx, nz] = V.n,
    s = V.cut - 0.5,
    rand = Math.max(4, (V.u1 - V.u0) * 0.15),
    a = V.u0 - rand,
    c = V.u1 + rand,
    n = Math.max(24, Math.min(240, Math.round((c - a) / 0.5))),
    L = [];
  for (let i = 0; i <= n; i++) {
    const uu = a + ((c - a) * i) / n,
      x = uu * nz + s * nx,
      z = -uu * nx + s * nz;
    L.push([uu, gh(x, z) - base]);
  }
  return L;
}
/** Geländeschnitt zeichnen: weiße Schnittfläche unter der Geländelinie, Linie kräftig. */
function fdGelaendeSchnitt(g, b, V, ox) {
  const L = fdGelaendeLinie(b, V);
  if (!L || !L.length) return;
  const X = (u) => fdSX(u + ox),
    Y = fdSY,
    unten = Math.min(V.v0, ...L.map((q) => q[1])) - 4;
  g.save();
  g.beginPath();
  L.forEach((q, i) => (i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))));
  g.lineTo(X(L[L.length - 1][0]), Y(unten));
  g.lineTo(X(L[0][0]), Y(unten));
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.beginPath();
  L.forEach((q, i) => (i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))));
  g.strokeStyle = '#1F2A33';
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}
/**
 * Dach in der Ansicht (ganze Gebäudetiefe): die Dachflächen des geneigten Dachs (b._rp.geo, Weltkoordinaten) in die
 * Ansichtsebene projiziert – hinter der Fassade, so dass z. B. von der Traufseite die Dachfläche eines Satteldachs zu
 * sehen ist. Farbe und Schraffur aus dem Dachmaterial (fdDachTyp), Kanten aus der Dachform (roofKanten: First, Grat,
 * Kehle, Traufe, Ortgang).
 */
function fdDachAnsicht(g, b, V, ox) {
  const rp = b._rp;
  if (!rp || !rp.geo || !V.n || b._y == null) return;
  const P = rp.geo.getAttribute('position');
  if (!P || !P.count) return;
  const u0 = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u0; i++) ugH += b.levels[i].h;
  const base = b._y + ugH,
    [nx, nz] = V.n,
    X = (u) => fdSX(u + ox),
    Y = fdSY,
    pu = (x, z) => x * nz - z * nx,
    k = fdDachTyp(b),
    t = k ? fdT(k) : null;
  g.save();
  // Dachflächen: zur Ansicht geneigte heller, abgewandte etwas dunkler (wie eine Ansicht mit Licht von vorn)
  const hell = [],
    dunkel = [];
  for (let i = 0; i + 2 < P.count; i += 3) {
    const A = [P.getX(i), P.getY(i), P.getZ(i)],
      B = [P.getX(i + 1), P.getY(i + 1), P.getZ(i + 1)],
      C = [P.getX(i + 2), P.getY(i + 2), P.getZ(i + 2)],
      // Normale des Dreiecks (y nach oben); zur Ansicht hin, wenn sie in Richtung −n zeigt
      e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]],
      e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]],
      nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
      zuMir = (nn[1] < 0 ? -1 : 1) * (nn[0] * nx + nn[2] * nz) > 0;
    (zuMir ? hell : dunkel).push([A, B, C].map((q) => [X(pu(q[0], q[2])), Y(q[1] - base)]));
  }
  const fl = (L, farbe, kante = true) => {
    if (!L.length) return;
    g.beginPath();
    L.forEach((T3) => {
      g.moveTo(T3[0][0], T3[0][1]);
      g.lineTo(T3[1][0], T3[1][1]);
      g.lineTo(T3[2][0], T3[2][1]);
      g.closePath();
    });
    g.fillStyle = farbe;
    g.fill('nonzero');
    if (!kante) return;
    // kleine Fugen zwischen den Dreiecken schließen
    g.strokeStyle = farbe;
    g.lineWidth = 0.6;
    g.stroke();
  };
  const c0 = t ? t.c : '#c9ced3';
  fl(dunkel, c0);
  fl(hell, c0);
  // abgewandte Flächen leicht abdunkeln
  if (dunkel.length) {
    g.globalAlpha = 0.12;
    fl(dunkel, '#1F2A33', false);
    g.globalAlpha = 1;
  }
  // Schraffur des Dachmaterials über der ganzen Dachfläche
  if (t) {
    g.beginPath();
    hell.concat(dunkel).forEach((T3) => {
      g.moveTo(T3[0][0], T3[0][1]);
      g.lineTo(T3[1][0], T3[1][1]);
      g.lineTo(T3[2][0], T3[2][1]);
      g.closePath();
    });
    schFuellen2D(g, t, X(1) - X(0), X(0), Y(0), 'nonzero');
  }
  // Dachkanten
  try {
    const K = roofKanten(rp, lf(b, b.levels[b.levels.length - 1])).p;
    g.beginPath();
    for (let i = 0; i + 5 < K.length; i += 6) {
      g.moveTo(X(pu(K[i], K[i + 2])), Y(K[i + 1] - base));
      g.lineTo(X(pu(K[i + 3], K[i + 5])), Y(K[i + 4] - base));
    }
    g.strokeStyle = '#475569';
    g.lineWidth = 1.1;
    g.stroke();
  } catch (e) {
    logErr(e, 'fdDachAnsicht');
  }
  g.restore();
}
