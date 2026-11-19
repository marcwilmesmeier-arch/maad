/* Fassade teilen wie in der Gruppe (Raster je Ansicht): senkrechte und waagerechte Teilungslinien über die ganze
   Ansicht (d.rs.xs, d.rs.ys in Ansichtskoordinaten), verbundene Felder d.rs.vb [{ x0, x1, y0, y1 }]. Daraus entstehen
   die Schnittlinien der Fassade (cuts mit Kennung FD_RS = −1, fdRasterAnwenden) – Felder, Typen, Tiefe, Loggien usw.
   arbeiten unverändert über fdFaces. Werkzeuge „Senkrecht“ (rx) und „Waagerecht“ (ry); im Werkzeug „Auswählen“ wird eine
   Linie stückweise gewählt (zwischen zwei Feldern), gezogen, an dieser Stelle oder ganz entfernt. Aufgerufen aus
   fdDown/fdCvMove/fdUp (050-eingabe.js), Zeichnung aus fdDrawView (040-fang.js), Inspektor aus 060-kopf.js. */
const FD_RS = -1; // Kennung der Schnittlinien aus dem Raster
const fdRs = (d) => (d && d.rs ? d.rs : null);
/** Raster einer Ansicht (mk: anlegen). */
function fdRaster(b, V, mk) {
  const d = fdD(b, V.key, mk);
  if (!d) return null;
  if (!d.rs && mk) d.rs = { xs: [], ys: [], vb: [] };
  if (d.rs) {
    d.rs.xs = d.rs.xs || [];
    d.rs.ys = d.rs.ys || [];
    d.rs.vb = d.rs.vb || [];
  }
  return d.rs || null;
}
/** Alle Teilungen einer Achse einschließlich der Ränder der Ansicht, sortiert. */
function fdRsAchse(V, R, a) {
  const L = a === 'x' ? [V.u0, V.u1] : [V.v0, V.v1];
  return [
    ...new Set(L.concat(R ? R[a === 'x' ? 'xs' : 'ys'] : []).map((v) => Math.round(v * 1000) / 1000)),
  ].sort((p, q) => p - q);
}
/** Felder des Rasters (Rechtecke), verbundene Felder zusammengefasst (wie oegZellen). */
function fdRsZellen(V, R) {
  const X = fdRsAchse(V, R, 'x'),
    Y = fdRsAchse(V, R, 'y'),
    auf = (v, L) => L.some((x) => Math.abs(x - v) < 0.004),
    Z0 = [],
    Z = [];
  for (let j = 0; j < Y.length - 1; j++)
    for (let i = 0; i < X.length - 1; i++) Z0.push({ x0: X[i], x1: X[i + 1], y0: Y[j], y1: Y[j + 1] });
  ((R && R.vb) || []).forEach((r) => {
    if (![r.x0, r.x1].every((v) => auf(v, X)) || ![r.y0, r.y1].every((v) => auf(v, Y))) return;
    const drin = Z0.filter(
      (z) =>
        !z.weg &&
        z.x0 >= r.x0 - 0.004 &&
        z.x1 <= r.x1 + 0.004 &&
        z.y0 >= r.y0 - 0.004 &&
        z.y1 <= r.y1 + 0.004,
    );
    if (drin.length < 2) return;
    drin.forEach((z) => (z.weg = 1));
    Z.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, vb: 1 });
  });
  Z0.forEach((z) => !z.weg && Z.push(z));
  return Z;
}
/** Schnittlinien aus dem Raster: Feldgrenzen, die keine verbundenen Felder trennen (gleiche Linien zusammengefasst). */
function fdRsCuts(V, R) {
  if (!R || (!R.xs.length && !R.ys.length)) return [];
  const Z = fdRsZellen(V, R),
    X = fdRsAchse(V, R, 'x'),
    Y = fdRsAchse(V, R, 'y'),
    out = [],
    bei = (u, v) => Z.find((z) => u > z.x0 && u < z.x1 && v > z.y0 && v < z.y1),
    zug = (s) => {
      const l = out[out.length - 1];
      if (l && l.a === s.a && Math.abs(l.k - s.k) < 1e-6 && Math.abs(l.e - s.s) < 1e-6) l.e = s.e;
      else out.push(s);
    };
  R.xs.forEach((x) => {
    for (let j = 0; j < Y.length - 1; j++) {
      const m = (Y[j] + Y[j + 1]) / 2;
      if (bei(x - 0.002, m) !== bei(x + 0.002, m)) zug({ a: 'x', k: x, s: Y[j], e: Y[j + 1] });
    }
  });
  R.ys.forEach((y) => {
    for (let i = 0; i < X.length - 1; i++) {
      const m = (X[i] + X[i + 1]) / 2;
      if (bei(m, y - 0.002) !== bei(m, y + 0.002)) zug({ a: 'y', k: y, s: X[i], e: X[i + 1] });
    }
  });
  return out.map((s) =>
    s.a === 'x'
      ? [gr2(s.k), gr2(s.s), gr2(s.k), gr2(s.e), FD_RS]
      : [gr2(s.s), gr2(s.k), gr2(s.e), gr2(s.k), FD_RS],
  );
}
/** Raster in die Schnittlinien der Ansicht übernehmen (Feldeigenschaften wandern mit, fdSetCuts). In fdEdit aufrufen. */
function fdRasterAnwenden(b, V) {
  const d = fdD(b, V.key, true),
    R = fdRaster(b, V);
  if (R) {
    // Linien außerhalb der Ansicht und doppelte entfallen
    const ein = (L, a0, a1) =>
      [...new Set(L.map((v) => Math.round(v * 1000) / 1000))].filter((v) => v > a0 + 0.005 && v < a1 - 0.005);
    R.xs = ein(R.xs, V.u0, V.u1);
    R.ys = ein(R.ys, V.v0, V.v1);
    if (!R.xs.length && !R.ys.length) delete d.rs;
  }
  fdSetCuts(b, V, d.cuts.filter((c) => c[4] !== FD_RS).concat(fdRsCuts(V, fdRaster(b, V))));
}
/** Fangen einer Teilungslinie: Öffnungs- und Gruppenkanten, Geschosse, Ecken der Fassade, andere Linien (10 px). */
function fdRsFang(b, V, a, v, frei) {
  if (frei) return Math.round(v * 1000) / 1000;
  const tol = 10 / fdVP().s,
    K = [],
    R = fdRaster(b, V);
  oeListe(b, V).forEach((x) => (a === 'x' ? K.push(x.u0, x.u1) : K.push(x.v0, x.v1)));
  ((fdD(b, V.key) || {}).gr || []).forEach((I) => {
    const G = oegG(I.g);
    if (G && a === 'x') K.push(I.u, I.u + (I.l || G.l));
  });
  if (a === 'y') fdStoreys(b).forEach((s) => K.push(s));
  else (V.pcs || []).forEach((p) => (p.ring || []).forEach((q) => K.push(q[0])));
  if (R) K.push(...R[a === 'x' ? 'xs' : 'ys']);
  let best = null;
  K.forEach((k) => {
    if (Math.abs(k - v) < tol && (best === null || Math.abs(k - v) < Math.abs(best - v))) best = k;
  });
  return best !== null ? best : Math.round(v / OE_RASTER) * OE_RASTER;
}
/** Teilungslinie setzen (Werkzeug Senkrecht/Waagerecht). */
function fdRsSetzen(b, V, a, v) {
  const lo = a === 'x' ? V.u0 : V.v0,
    hi = a === 'x' ? V.u1 : V.v1;
  if (!(v > lo + 0.005 && v < hi - 0.005)) return;
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V, true);
    R[a === 'x' ? 'xs' : 'ys'].push(v);
    fdRasterAnwenden(b, V);
    FDS.sel = [];
    FDS.rl = null;
  });
}
/**
 * Teilungslinie an der Stelle p (6 px) im Werkzeug „Auswählen“: gewählt wird nur das Stück zwischen zwei Feldern
 * { a, v, A, B, s0, s1 }; null, wenn keine Rasterlinie getroffen ist.
 */
function fdRsTreffer(b, V, p) {
  const R = fdRaster(b, V);
  if (!R) return null;
  const tol = 6 / fdVP().s,
    Z = fdRsZellen(V, R),
    istX = (v) => R.xs.some((w) => Math.abs(w - v) < 0.004),
    istY = (v) => R.ys.some((w) => Math.abs(w - v) < 0.004),
    lx = Z.find((z) => istX(z.x1) && Math.abs(z.x1 - p.x) < tol && p.z > z.y0 && p.z < z.y1),
    ly = Z.find((z) => istY(z.y1) && Math.abs(z.y1 - p.z) < tol && p.x > z.x0 && p.x < z.x1);
  if (lx) {
    const B = Z.find((z) => Math.abs(z.x0 - lx.x1) < 0.004 && p.z > z.y0 && p.z < z.y1);
    if (!B) return null; // dort kein Schnitt (verbunden)
    return { a: 'x', v: lx.x1, A: lx, B, s0: Math.max(lx.y0, B.y0), s1: Math.min(lx.y1, B.y1) };
  }
  if (ly) {
    const B = Z.find((z) => Math.abs(z.y0 - ly.y1) < 0.004 && p.x > z.x0 && p.x < z.x1);
    if (!B) return null;
    return { a: 'y', v: ly.y1, A: ly, B, s0: Math.max(ly.x0, B.x0), s1: Math.min(ly.x1, B.x1) };
  }
  return null;
}
/** Gewählte Linie anfassen: Ziehen verschiebt die ganze Linie zwischen den Nachbarlinien. */
function fdRsGreifen(b, V, l, e) {
  const R = fdRaster(b, V),
    k = l.a === 'x' ? 'xs' : 'ys',
    T = fdRsAchse(V, R, l.a).filter((w) => Math.abs(w - l.v) >= 0.004);
  FDS.rzug = {
    a: l.a,
    v0: l.v,
    v: l.v,
    k,
    lo: Math.max(...T.filter((w) => w < l.v)),
    hi: Math.min(...T.filter((w) => w > l.v)),
    px: e.clientX,
    py: e.clientY,
    mv: 0,
  };
}
/** Linie von v0 nach v1 verschieben (Raster und verbundene Felder; Feldeigenschaften wandern über fdSetCuts mit). */
function fdRsSchieben(b, V, a, v0, v1) {
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V),
      k = a === 'x' ? 'xs' : 'ys',
      [a0, a1] = a === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];
    if (!R) return;
    // Feldeigenschaften hängen an Punkten im Feld: im Bereich zwischen den Nachbarlinien mitdehnen
    const T = fdRsAchse(V, R, a).filter((w) => Math.abs(w - v0) >= 0.004),
      lo = Math.max(...T.filter((w) => w < v0)),
      hi = Math.min(...T.filter((w) => w > v0)),
      ax = a === 'x' ? 0 : 1,
      abb = (p) =>
        p > lo && p < v0
          ? lo + ((p - lo) * (v1 - lo)) / (v0 - lo)
          : p > v0 && p < hi
            ? v1 + ((p - v0) * (hi - v1)) / (hi - v0)
            : p;
    const d = fdD(b, V.key);
    R[k] = R[k].map((w) => (Math.abs(w - v0) < 0.004 ? v1 : w));
    R.vb.forEach((r) => {
      if (Math.abs(r[a0] - v0) < 0.004) r[a0] = v1;
      if (Math.abs(r[a1] - v0) < 0.004) r[a1] = v1;
    });
    // Schnittlinien des Rasters direkt neu, Feldeigenschaften über ihre Punkte mitnehmen
    d.units.forEach((u) => (u.p[ax] = gr2(abb(u.p[ax]))));
    d.cuts = d.cuts.filter((c) => c[4] !== FD_RS).concat(fdRsCuts(V, R));
    V._f = null;
    if (FDS.rl) FDS.rl = null;
    FDS.sel = [];
  });
}
/** Zwei oder mehr Rasterfelder zu einem verbinden (müssen ein Rechteck bilden). Z: Rechtecke { x0, x1, y0, y1 }. */
function fdRsVerbinden(Z) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V || !Z || Z.length < 2) return false;
  const r = {
      x0: Math.min(...Z.map((z) => z.x0)),
      x1: Math.max(...Z.map((z) => z.x1)),
      y0: Math.min(...Z.map((z) => z.y0)),
      y1: Math.max(...Z.map((z) => z.y1)),
    },
    fl = Z.reduce((s, z) => s + (z.x1 - z.x0) * (z.y1 - z.y0), 0);
  if (Math.abs(fl - (r.x1 - r.x0) * (r.y1 - r.y0)) > 1e-3) {
    fdNote('Nur Felder, die zusammen ein Rechteck bilden, lassen sich verbinden.');
    return false;
  }
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V, true),
      innen = (q) =>
        q.x0 >= r.x0 - 0.004 && q.x1 <= r.x1 + 0.004 && q.y0 >= r.y0 - 0.004 && q.y1 <= r.y1 + 0.004;
    R.vb = R.vb.filter((q) => !innen(q));
    R.vb.push(r);
    fdRasterAnwenden(b, V);
    const F = fdFaces(b, V),
      i = F.findIndex((f) => grInFace(f, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2));
    FDS.sel = i >= 0 ? [i] : [];
    FDS.rl = null;
  });
  return true;
}
/** Rasterfelder zu den gewählten Fassadenfeldern (nur wenn jedes Feld genau ein Rasterfeld ist), sonst null. */
function fdRsWahlZellen(b, V) {
  const R = fdRaster(b, V);
  if (!R) return null;
  const Z = fdRsZellen(V, R),
    S_ = fdSelFaces(),
    W = S_.map((f) => Z.find((z) => grInFace(f, (z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2)));
  return S_.length && W.every(Boolean) ? W : null;
}
/** Verbindung der gewählten Felder lösen. */
function fdRsVerbindungLoesen() {
  const b = fdB(),
    V = fdCurV(),
    W = b && V && fdRsWahlZellen(b, V);
  if (!W || !W.some((z) => z.vb)) return;
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V),
      gl = (z, r) => ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(z[k] - r[k]) < 0.004);
    R.vb = R.vb.filter((r) => !W.some((z) => z.vb && gl(z, r)));
    fdRasterAnwenden(b, V);
    FDS.sel = [];
  });
}
/** Gewählte Linie nur an dieser Stelle entfernen (die beiden Felder verbinden). */
function fdRsHierEntfernen() {
  const l = FDS.rl;
  if (l && l.A && l.B) fdRsVerbinden([l.A, l.B]);
}
/** Gewählte Linie über die ganze Ansicht entfernen. */
function fdRsLinieEntfernen() {
  const l = FDS.rl;
  if (!l) return;
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V);
    if (!R) return;
    const k = l.a === 'x' ? 'xs' : 'ys';
    R[k] = R[k].filter((w) => Math.abs(w - l.v) > 0.004);
    fdRasterAnwenden(b, V);
    FDS.rl = null;
    FDS.sel = [];
  });
}
/** Lage der gewählten Linie eingeben (m ab linkem Rand bzw. ab Unterkante der Ansicht). */
function fdRsLageSet(val) {
  const b = fdB(),
    V = fdCurV(),
    l = FDS.rl,
    n = +String(val).replace(',', '.');
  if (!b || !V || !l || !isFinite(n)) return;
  const R = fdRaster(b, V),
    T = fdRsAchse(V, R, l.a).filter((w) => Math.abs(w - l.v) >= 0.004),
    lo = Math.max(...T.filter((w) => w < l.v)),
    hi = Math.min(...T.filter((w) => w > l.v)),
    v1 = Math.round(Math.max(lo + 0.05, Math.min(hi - 0.05, (l.a === 'x' ? V.u0 : V.v0) + n)) * 1000) / 1000;
  fdRsSchieben(b, V, l.a, l.v, v1);
  FDS.rl = { ...l, v: v1, A: null, B: null };
}
/**
 * Automatisch teilen: Linien an allen Öffnungskanten (senkrecht), an Brüstung und Sturz (waagerecht), an den Rändern der
 * gesetzten Gruppen und an ihren Feldern (Rücksprung, Loggia, Balkon, Material).
 */
function fdRsAnFenstern() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  const L = oeListe(b, V).map((x) => [x.u0, x.u1, x.v0, x.v1]),
    B = fdStoreys(b);
  ((fdD(b, V.key) || {}).gr || []).forEach((I) => {
    const G = oegG(I.g);
    if (G) L.push([I.u, I.u + oegAngepasst(G, I).l, I.v, I.v + oegHoehe(B, I, G)]);
  });
  oegFlaechen(b, V)
    .filter((x) => x.gi)
    .forEach((x) => L.push([x.u0, x.u1, x.v0, x.v1]));
  if (!L.length) {
    fdNote('Auf dieser Seite gibt es noch keine Öffnungen oder Gruppen.');
    return;
  }
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V, true);
    L.forEach((x) => {
      R.xs.push(x[0], x[1]);
      R.ys.push(x[2], x[3]);
    });
    fdRasterAnwenden(b, V);
    FDS.sel = [];
  });
}
/** Waagerechte Teilungen an allen Geschossdecken. */
function fdRsAnGeschossen() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  fdEdit((b) => {
    const V = fdCurV(),
      R = fdRaster(b, V, true);
    fdStoreys(b).forEach((s) => R.ys.push(s));
    fdRasterAnwenden(b, V);
    FDS.sel = [];
  });
}
/** Alle Teilungen dieser Ansicht entfernen (Feldeigenschaften der größten Felder bleiben). */
function fdRsZurueck() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  fdEdit((b) => {
    const V = fdCurV(),
      d = fdD(b, V.key);
    if (!d) return;
    delete d.rs;
    fdRasterAnwenden(b, V);
    FDS.rl = null;
    FDS.sel = [];
  });
}
/** Zeichnung: gewählte Linie (orange), gezogene Linie und Vorschau des Werkzeugs (gestrichelt über die Ansicht). */
function fdRsZeichnen(g, V, ox) {
  const X = (u) => fdSX(u + ox),
    Y = fdSY,
    l = FDS.rl,
    z = FDS.rzug,
    vor = FDS.rvor;
  g.save();
  if (l && !z) {
    g.strokeStyle = '#f07a12';
    g.lineWidth = 3.2;
    g.beginPath();
    if (l.a === 'x') {
      g.moveTo(X(l.v), Y(l.s0));
      g.lineTo(X(l.v), Y(l.s1));
    } else {
      g.moveTo(X(l.s0), Y(l.v));
      g.lineTo(X(l.s1), Y(l.v));
    }
    g.stroke();
  }
  const ganz = (a, v, farbe) => {
    g.strokeStyle = farbe;
    g.lineWidth = 1.6;
    g.setLineDash([6, 4]);
    g.beginPath();
    if (a === 'x') {
      g.moveTo(X(v), Y(V.v0) + 12);
      g.lineTo(X(v), Y(V.v1) - 12);
    } else {
      g.moveTo(X(V.u0) - 12, Y(v));
      g.lineTo(X(V.u1) + 12, Y(v));
    }
    g.stroke();
    g.setLineDash([]);
    // Maß zur nächsten Linie links bzw. darunter
    const R = fdRaster(fdB(), V),
      T = fdRsAchse(V, R, a).filter((w) => w < v - 0.004),
      vo = T.length ? T[T.length - 1] : a === 'x' ? V.u0 : V.v0;
    g.fillStyle = farbe;
    g.font = '600 12px system-ui,sans-serif';
    g.textBaseline = 'middle';
    if (a === 'x') {
      g.textAlign = 'left';
      g.fillText(fdFmt(v - vo) + ' m', X(v) + 6, Y(V.v1) - 4);
    } else {
      g.textAlign = 'right';
      g.fillText(fdFmt(v - vo) + ' m', X(V.u0) - 16, Y(v));
    }
  };
  if (z && z.mv) ganz(z.a, z.v, '#f07a12');
  if (vor && (FDS.tool === 'rx' || FDS.tool === 'ry')) ganz(vor.a, vor.v, '#5E7F92');
  g.restore();
}
/** Inspektor: gewählte Linie bzw. Hinweise und Aktionen im Werkzeug „Teilen“. */
function fdRsInspektor(b, V) {
  const l = FDS.rl;
  if (l)
    return `<h4>${l.a === 'x' ? 'Senkrechte' : 'Waagerechte'} Teilung</h4><div class="kv sche" style="display:grid;gap:6px;margin:0;padding:0;background:none"><label>${l.a === 'x' ? 'Abstand vom linken Rand' : 'Höhe über Unterkante'} (m)<input type="number" step="0.05" value="${+(l.v - (l.a === 'x' ? V.u0 : V.v0)).toFixed(3)}" onchange="fdRsLageSet(this.value)"></label></div><div class="row">${l.A && l.B ? '<button class="bt" onclick="fdRsHierEntfernen()" title="Nur zwischen diesen beiden Feldern entfernen (Entf)">Hier entfernen <kbd>Entf</kbd></button>' : ''}<button class="bt" onclick="fdRsLinieEntfernen()" title="Teilungslinie über die ganze Ansicht entfernen">Ganze Linie entfernen</button></div><div class="mu" style="margin-top:8px">Linie ziehen = verschieben (rastet an Fenstern, Geschossen und Ecken ein, Umschalt = frei).</div>`;
  const R = fdRaster(b, V);
  return `<h4>Teilen</h4><div class="leer">${
    FDS.tool === 'ry'
      ? 'Klick setzt eine waagerechte Teilung über die ganze Seite – rastet an Geschossdecken, Brüstungen und Stürzen ein (Umschalt = frei).'
      : 'Klick setzt eine senkrechte Teilung über die ganze Seite – rastet an Fensterkanten und Ecken ein (Umschalt = frei).'
  }<br><br>Danach mit „Auswählen“: Linie anklicken zum Verschieben oder Entfernen, Felder anklicken für Material, Rücksprung, Loggia oder Balkon.</div><div class="row"><button class="bt" onclick="fdRsAnFenstern()" title="Teilungslinien an allen Öffnungskanten, an Brüstung und Sturz sowie an den gesetzten Gruppen und ihren Feldern">Automatisch teilen</button><button class="bt" onclick="fdRsAnGeschossen()" title="Waagerechte Teilungen an allen Geschossdecken">An Geschossen teilen</button>${R ? '<button class="bt" onclick="fdRsZurueck()" title="Alle Teilungen dieser Seite entfernen">Teilung zurücksetzen</button>' : ''}</div>`;
}
