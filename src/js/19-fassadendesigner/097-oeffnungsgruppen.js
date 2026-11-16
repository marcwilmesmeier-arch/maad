// ======================= ÖFFNUNGSGRUPPEN (wie in Forma) =======================
// Eine Gruppe ist ein Fassadenabschnitt fester Länge (z. B. 6 m) und Höhe (Geschoss), in dem Öffnungen aus dem Katalog
// sitzen: S.oeg = [{ k, n, l, h, t, oe: [{ id, t, x, v }], xs, ys, fe: [{ p, d, t }] }] (x = linke Kante, v = Unterkante
// über dem Fußboden). Die Wandfläche der Gruppe ist durch Teilungslinien in Felder geteilt (xs senkrecht, ys waagerecht);
// jedes Feld kann eine Tiefe d (m; positiv = Rücksprung, negativ = Vorsprung), einen Verlauf k ('g' gleichmäßig,
// 'l' links tief/rechts bündig, 'r' rechts tief/links bündig – schräger Rücksprung) und ein Material t (Fassadentyp)
// haben – gemerkt über einen Punkt p im Feld wie bei den Fassadenfeldern. t der Gruppe = Material aller übrigen Felder.
// Nebeneinanderliegende Felder mit gleicher Einstellung bilden ein Rechteck (eine durchgehende Schräge).
// Angelegt und bearbeitet im Konfigurator (Reiter „Gruppen“), gespeichert mit dem Projekt.
// An der Fassade stehen nur Verweise: b.fd[Ansicht].gr = [{ id, g, u, v }] (u = linke Kante, v = Geschossboden).
// Die Öffnungen daraus erzeugt oeListe() (q = Kennung des Verweises) – eine geänderte Gruppe ändert alle Stellen.
// Im Fassadendesigner: Werkzeug „Gruppe“ (einzeln setzen, ziehen, tauschen, löschen) und „Feld füllen“ (gewählte
// Felder je Geschoss mit der Gruppe füllen, Rest gleichmäßig an den Enden).

const OEG0 = [
  {
    k: 'g1',
    n: 'Achse 6 m · 2 Fenster',
    l: 6,
    h: 3,
    oe: [
      { id: 'a', t: 'f2', x: 0.62, v: 0.9 },
      { id: 'b', t: 'f2', x: 3.62, v: 0.9 },
    ],
  },
  {
    k: 'g2',
    n: 'Achse 6 m · Fenstertür + Fenster',
    l: 6,
    h: 3,
    oe: [
      { id: 'a', t: 'ft', x: 0.62, v: 0 },
      { id: 'b', t: 'f1', x: 3.995, v: 0.9 },
    ],
  },
  {
    k: 'g3',
    n: 'EG 6 m · Eingang',
    l: 6,
    h: 3,
    oe: [
      { id: 'a', t: 'ht', x: 0.8, v: 0 },
      { id: 'b', t: 'fv', x: 2.9, v: 0 },
    ],
  },
  {
    k: 'g4',
    n: 'Achse 6 m · Fenster mit Rücksprung',
    l: 6,
    h: 3,
    oe: [
      { id: 'a', t: 'f1', x: 0.9, v: 0.9 },
      { id: 'b', t: 'f1', x: 3.6, v: 0.9 },
    ],
    xs: [1.91, 3.11, 4.61, 5.81],
    ys: [0.75, 2.435],
    fe: [
      { p: [2.51, 1.59], d: 0.05, t: '' },
      { p: [5.21, 1.59], d: 0.05, t: '' },
    ],
  },
];
S.oeg = JSON.parse(JSON.stringify(OEG0));
const oegG = (k) => S.oeg.find((g) => g.k === k) || null;

/** Gruppenverweise einer Ansicht (Liste wird bei Bedarf angelegt). */
function oegDaten(b, vk, mk) {
  const d = fdD(b, vk, mk);
  if (!d) return null;
  if (!d.gr) {
    if (!mk) return null;
    d.gr = [];
  }
  return d.gr;
}
/** Öffnungen aller Gruppenverweise einer Ansicht (für oeListe). */
function oegOeffnungen(b, V) {
  const R = [];
  (oegDaten(b, V.key) || []).forEach((I) => {
    const G = oegG(I.g);
    if (!G) return;
    G.oe.forEach((q) => {
      const T = oeT(q.t),
        u0 = I.u + q.x,
        v0 = I.v + q.v;
      R.push({
        o: { id: I.id + ':' + q.id, t: q.t, u: u0 + T.b / 2, v: v0, q: I.id },
        T,
        u0,
        u1: u0 + T.b,
        v0,
        v1: v0 + T.h,
        gi: I,
      });
    });
  });
  return R;
}
/** Teilungen einer Gruppe (sortiert, mit Rändern). */
function oegTeilung(G) {
  const r = (L, m) =>
    [0, m, ...(L || []).filter((x) => x > 0.005 && x < m - 0.005)]
      .sort((a, c) => a - c)
      .filter((x, i, A) => !i || x - A[i - 1] > 0.005);
  return { xs: r(G.xs, G.l), ys: r(G.ys, G.h) };
}
/** Felder der Gruppe (Raster aus den Teilungen) mit Tiefe d und Material t (eigenes, sonst das der Gruppe). */
function oegZellen(G) {
  const { xs, ys } = oegTeilung(G),
    Z = [];
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++)
      Z.push({ i, j, x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], d: 0, k: 'g', t: '' });
  (G.fe || []).forEach((f) => {
    const z = Z.find((c) => f.p[0] > c.x0 && f.p[0] < c.x1 && f.p[1] > c.y0 && f.p[1] < c.y1);
    if (z) {
      z.d = f.d || 0;
      z.k = f.k === 'l' || f.k === 'r' ? f.k : 'g';
      z.t = f.t || '';
    }
  });
  return Z;
}
/**
 * Flächen der Gruppe mit Tiefe oder Material als zusammengefasste Rechtecke (gleiche Tiefe und gleiches Material
 * nebeneinander/übereinander werden zu einem Rechteck – keine Seitenflächen zwischen ihnen).
 */
function oegFlaechenG(G) {
  const Z = oegZellen(G).map((z) => ({ ...z, t: z.t || G.t || '' })),
    key = (z) => z.d + '|' + (z.d ? z.k : 'g') + '|' + z.t,
    zeilen = [];
  // waagerecht zusammenfassen
  const nj = Math.max(-1, ...Z.map((z) => z.j)) + 1;
  for (let j = 0; j < nj; j++) {
    const Zj = Z.filter((z) => z.j === j).sort((a, c) => a.i - c.i);
    let cur = null;
    Zj.forEach((z) => {
      if (cur && key(cur) === key(z) && Math.abs(cur.x1 - z.x0) < 1e-6) cur.x1 = z.x1;
      else {
        cur = { x0: z.x0, x1: z.x1, y0: z.y0, y1: z.y1, d: z.d, k: z.d ? z.k : 'g', t: z.t };
        zeilen.push(cur);
      }
    });
  }
  // senkrecht zusammenfassen (gleiche Spannweite)
  const R = [];
  zeilen
    .sort((a, c) => a.y0 - c.y0)
    .forEach((s) => {
      const o = R.find(
        (r) =>
          key(r) === key(s) &&
          Math.abs(r.x0 - s.x0) < 1e-6 &&
          Math.abs(r.x1 - s.x1) < 1e-6 &&
          Math.abs(r.y1 - s.y0) < 1e-6,
      );
      if (o) o.y1 = s.y1;
      else R.push({ ...s });
    });
  // Tiefe an der linken und rechten Kante (schräg: eine Seite bündig)
  R.forEach((r) => {
    r.dl = r.k === 'r' ? 0 : r.d;
    r.dr = r.k === 'l' ? 0 : r.d;
  });
  return R.filter((r) => r.d || r.t);
}
/** Flächen aller Gruppenverweise einer Ansicht (Tiefe und/oder Material): { u0, u1, v0, v1, d, t, id, gi }. */
function oegFlaechen(b, V) {
  const R = [];
  (oegDaten(b, V.key) || []).forEach((I) => {
    const G = oegG(I.g);
    if (!G) return;
    oegFlaechenG(G).forEach((r, k) =>
      R.push({
        u0: I.u + r.x0,
        u1: I.u + r.x1,
        v0: I.v + r.y0,
        v1: I.v + r.y1,
        d: r.d,
        dl: r.dl,
        dr: r.dr,
        t: r.t,
        id: I.id + ':f' + k,
        gi: I,
      }),
    );
  });
  return R;
}
/** Rücksprünge und Vorsprünge (Flächen mit Tiefe) aller Gruppenverweise einer Ansicht. */
function oegRuecksprunge(b, V) {
  return oegFlaechen(b, V).filter((r) => r.d);
}
/** Rücksprung in der Ansicht zeichnen: zurückspringend dunkler, vorspringend heller, Schattenkante oben/links. */
function oegRueckZeichneEins(g, X, Y, u0, u1, v0, v1, d, an, farbe, k) {
  const x0 = X(u0),
    x1 = X(u1),
    y0 = Y(v1),
    y1 = Y(v0);
  g.save();
  if (farbe) {
    g.fillStyle = farbe;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  if (!d) {
    g.restore();
    return;
  }
  const ton = d > 0 ? 'rgba(30,41,59,0.2)' : 'rgba(255,255,255,0.5)';
  if (k === 'l' || k === 'r') {
    // schräg: Schattierung läuft zur bündigen Seite aus
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(k === 'l' ? 0 : 1, ton);
    gr.addColorStop(k === 'l' ? 1 : 0, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
  } else g.fillStyle = ton;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = d > 0 ? 'rgba(30,41,59,0.55)' : 'rgba(30,41,59,0.35)';
  g.lineWidth = an ? 2 : 1;
  if (an) g.strokeStyle = '#1f6fd1';
  g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  // Schattenkante (Licht von links oben)
  g.strokeStyle = d > 0 ? 'rgba(30,41,59,0.45)' : 'rgba(30,41,59,0.25)';
  g.lineWidth = 3;
  g.beginPath();
  if (d > 0) {
    g.moveTo(x0 + 1.5, y1);
    g.lineTo(x0 + 1.5, y0 + 1.5);
    g.lineTo(x1, y0 + 1.5);
  } else {
    g.moveTo(x1 + 1.5, y0);
    g.lineTo(x1 + 1.5, y1 + 1.5);
    g.lineTo(x0, y1 + 1.5);
  }
  g.stroke();
  g.restore();
}
function oegRueckZeichnen(g, b, V, ox) {
  const X = (u) => fdSX(u + ox);
  oegFlaechen(b, V).forEach((r) =>
    oegRueckZeichneEins(
      g,
      X,
      fdSY,
      r.u0,
      r.u1,
      r.v0,
      r.v1,
      r.d,
      false,
      r.t ? fdT(r.t).c : null,
      r.dl === r.dr ? 'g' : r.dl ? 'l' : 'r',
    ),
  );
}
/** Gruppenverweis unter dem Punkt (Rechteck der Gruppe). */
function oegTreffer(b, V, u, v) {
  const L = oegDaten(b, V.key) || [];
  for (let i = L.length - 1; i >= 0; i--) {
    const I = L[i],
      G = oegG(I.g);
    if (G && u >= I.u && u <= I.u + G.l && v >= I.v && v <= I.v + G.h) return I;
  }
  return null;
}
function oegGewaehlt() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V || !FDS.gi) return null;
  return (oegDaten(b, V.key) || []).find((I) => I.id === FDS.gi) || null;
}
/** Lage eines Verweises: linke Kante im Raster bzw. an Kanten anderer Gruppen, Unterkante = Geschossboden. */
function oegFang(b, V, u, v, G, frei, ohneId) {
  let U = frei ? u : Math.round(u / OE_RASTER) * OE_RASTER;
  const tol = Math.max(0.05, 10 / fdVP().s);
  if (!frei)
    (oegDaten(b, V.key) || []).forEach((I) => {
      const H = oegG(I.g);
      if (!H || I.id === ohneId) return;
      [I.u + H.l, I.u - G.l].forEach((k) => {
        if (Math.abs(k - u) < tol) U = k;
      });
    });
  return { u: U, v: oeGeschossBasis(b, v) };
}
const oegNeuId = () => 'gi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ---- Bearbeiten im Fassadendesigner
function oegSetzen(b, V, p, frei) {
  const G = oegG(FDS.grT);
  if (!G) return;
  const q = oegFang(b, V, p.x - G.l / 2, p.z, G, frei);
  if (fdHitFace(b, V, q.u + G.l / 2, q.v + Math.min(G.h, 2.5) / 2) < 0) {
    fdNote('Gruppen nur auf der Fassade setzen.');
    return;
  }
  const id = oegNeuId();
  fdEdit((b) => oegDaten(b, V.key, true).push({ id, g: G.k, u: q.u, v: q.v }));
  FDS.gi = id;
  FDS.oe = null;
}
/** Gewählte Felder je Geschoss mit der Gruppe füllen (vorhandene Gruppen in diesen Bereichen werden ersetzt). */
function oegFuellen() {
  const b = fdB(),
    V = fdCurV(),
    G = oegG(FDS.grT);
  if (!b || !V || !G) return;
  const F = fdFaces(b, V),
    sel = FDS.sel.map((i) => F[i]).filter(Boolean);
  if (!sel.length) {
    fdNote('Zuerst ein oder mehrere Felder wählen (Werkzeug „Wählen“).');
    return;
  }
  const B = fdStoreys(b);
  let n = 0;
  fdEdit((b) => {
    const L = oegDaten(b, V.key, true);
    sel.forEach((f) => {
      for (let j = 0; j < B.length - 1; j++) {
        const v0 = B[j],
          v1 = B[j + 1],
          r = fdBandU(f, v0 + 0.05, Math.min(v1, v0 + G.h) - 0.05);
        if (!r || !grInFace(f, (r[0] + r[1]) / 2, v0 + 0.5)) continue;
        const [a, c] = r,
          k = Math.floor((c - a + 1e-6) / G.l);
        // bisherige Gruppen in diesem Bereich ersetzen
        for (let i = L.length - 1; i >= 0; i--) {
          const H = oegG(L[i].g),
            m = L[i].u + (H ? H.l : 0) / 2;
          if (Math.abs(L[i].v - v0) < 0.01 && m >= a && m <= c) L.splice(i, 1);
        }
        const au = oegAusr(b, V),
          rest = c - a - k * G.l,
          s = au === 'l' ? a : au === 'r' ? a + rest : a + rest / 2;
        for (let i = 0; i < k; i++) L.push({ id: oegNeuId(), g: G.k, u: s + i * G.l, v: v0 });
        n += k;
      }
    });
  });
  fdNote(n ? `${n}× „${G.n}“ gesetzt.` : `Felder zu schmal für „${G.n}“ (${fdFmt(G.l)} m).`);
}
/** Ausrichtung beim Füllen dieser Seite: Einstellung der Seite im Gebäudekonfigurator, sonst die zuletzt gewählte. */
function oegAusr(b, V) {
  const s = b && V && b.fk && b.fk.auS && b.fk.auS[V.key];
  return s || FDS.grAu || 'm';
}
/** Ausrichtung im Fassadendesigner wählen: gilt fürs Füllen und – bei Gebäudekonfiguration – für diese Seite. */
function oegAusrSetzen(a) {
  const b = fdB(),
    V = fdCurV();
  FDS.grAu = a;
  if (b && V && b.fk) {
    hist();
    b.fk.auS = b.fk.auS || {};
    b.fk.auS[V.key] = a;
  }
  FDS.ps = '';
  fdTick(true);
  try {
    rr();
  } catch (e) {
    logErr(e, 'oegAusrSetzen');
  }
}
/** Gewählten Verweis auf eine andere Gruppe umstellen (alle = alle Verweise dieser Gruppe in der Ansicht). */
function oegTauschen(k, alle) {
  const I = oegGewaehlt(),
    V = fdCurV();
  if (!I || !oegG(k)) return;
  const alt = I.g;
  fdEdit((b) =>
    (oegDaten(b, V.key) || []).forEach((J) => {
      if (J.id === I.id || (alle && J.g === alt)) {
        J.g = k;
        delete J.a; // von Hand getauscht: bleibt beim automatischen Platzieren erhalten
      }
    }),
  );
}
function oegLoeschen() {
  const V = fdCurV(),
    id = FDS.gi;
  if (!V || !id) return;
  fdEdit((b) => {
    const L = oegDaten(b, V.key);
    if (L) L.splice(0, L.length, ...L.filter((I) => I.id !== id));
  });
  FDS.gi = null;
}
/** Werkzeug „Gruppe“: Gruppe zum Setzen wählen. */
function oegWahl(k) {
  FDS.grT = k;
  if (FDS.tool !== 'gr') fdTool('gr');
  FDS.ps = '';
  fdTick(true);
}

// ---- Eingabe (aus 090-oeffnungen.js)
/** Pointerdown für Gruppen; true = verbraucht. x = getroffene Öffnung (oeTreffer) oder null. */
function oegDown(b, V, p, e, x) {
  const I = x && x.gi ? x.gi : FDS.tool === 'gr' ? oegTreffer(b, V, p.x, p.z) : null;
  if (I) {
    FDS.gi = I.id;
    FDS.oe = null;
    FDS.sel = [];
    FDS.selCut = null;
    FDS.grZug = { id: I.id, du: I.u - p.x, px: e.clientX, py: e.clientY, bewegt: false };
    FDS.ps = '';
    FDS.dirty = 1;
    return true;
  }
  if (FDS.tool === 'gr') {
    oegSetzen(b, V, p, e.shiftKey);
    return true;
  }
  if (FDS.gi) {
    FDS.gi = null;
    FDS.ps = '';
  }
  return false;
}
function oegMove(b, V, p, e) {
  const z = FDS.grZug;
  if (z) {
    if (!z.bewegt && Math.hypot(e.clientX - z.px, e.clientY - z.py) < 4) return true;
    const I = (oegDaten(b, V.key) || []).find((J) => J.id === z.id),
      G = I && oegG(I.g);
    if (!G) return true;
    if (!z.bewegt) {
      hist();
      z.bewegt = true;
      delete I.a; // von Hand verschoben: bleibt beim automatischen Platzieren erhalten
    }
    const q = oegFang(b, V, p.x + z.du, p.z, G, e.shiftKey, I.id);
    I.u = q.u;
    I.v = q.v;
    FDS.dirty = 1;
    return true;
  }
  if (FDS.tool === 'gr') {
    const G = oegG(FDS.grT);
    if (G) {
      const q = oegFang(b, V, p.x - G.l / 2, p.z, G, e.shiftKey);
      FDS.grVor = { u: q.u, v: q.v, G };
    }
    e.currentTarget.style.cursor = 'crosshair';
    FDS.dirty = 1;
    return true;
  }
  if (FDS.grVor) {
    FDS.grVor = null;
    FDS.dirty = 1;
  }
  return false;
}
function oegUp() {
  const z = FDS.grZug;
  if (!z) return false;
  FDS.grZug = null;
  if (z.bewegt) {
    FDS.ps = '';
    try {
      rr();
      zoTick(true);
    } catch (e) {
      logErr(e, 'oegUp');
    }
  }
  return true;
}

// ---- Zeichnen (aus 090-oeffnungen.js)
/** Rahmen der Gruppen (gestrichelt, Name), Vorschau beim Setzen. */
function oegZeichnen(g, b, V, ox, o) {
  const X = (u) => fdSX(u + ox),
    Y = fdSY,
    rahmen = (u, v, G, an, alpha) => {
      g.save();
      g.globalAlpha = alpha || 1;
      g.strokeStyle = an ? '#1f6fd1' : '#5E7F92';
      g.lineWidth = an ? 2.2 : 1;
      g.setLineDash(an ? [] : [5, 4]);
      g.strokeRect(X(u), Y(v + G.h), X(u + G.l) - X(u), Y(v) - Y(v + G.h));
      g.setLineDash([]);
      const w = X(u + G.l) - X(u);
      if (w > 60) {
        g.fillStyle = an ? '#1f6fd1' : '#5E7F92';
        g.font = '10px system-ui,sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'top';
        let t = G.n;
        while (t.length > 3 && g.measureText(t).width > w - 8) t = t.slice(0, -1);
        g.fillText(t, X(u) + 4, Y(v + G.h) + 3);
      }
      g.restore();
    };
  // Rahmen nur beim Werkzeug „Gruppe“ oder mit gewählter Gruppe (sonst ruhige Ansicht)
  if (FDS.tool === 'gr' || FDS.gi)
    (oegDaten(b, V.key) || []).forEach((I) => {
      const G = oegG(I.g);
      if (G) rahmen(I.u, I.v, G, o.sel !== undefined && FDS.gi === I.id);
    });
  const p = FDS.grVor;
  if (p && FDS.tool === 'gr' && !FDS.grZug && o.sel !== undefined && !ox) {
    rahmen(p.u, p.v, p.G, true, 0.7);
    p.G.oe.forEach((q) => {
      const T = oeT(q.t);
      oeZeichneEine(g, X, Y, p.u + q.x, p.u + q.x + T.b, p.v + q.v, T, { alpha: 0.5 });
    });
  }
}
/** Kleines Symbol einer Gruppe (Länge × Höhe mit ihren Öffnungen). */
function oegSymbol(G, w = 44, h = 22) {
  const k = Math.min(w / G.l, h / G.h),
    ox = (w - G.l * k) / 2,
    oy = h - (h - G.h * k) / 2;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${ox}" y="${oy - G.h * k}" width="${G.l * k}" height="${G.h * k}" fill="#e4e2dd" stroke="#94a3b8" stroke-width=".8"/>`;
  oegFlaechenG(G).forEach((r) => {
    s += `<rect x="${ox + r.x0 * k}" y="${oy - r.y1 * k}" width="${(r.x1 - r.x0) * k}" height="${(r.y1 - r.y0) * k}" fill="${r.t ? fdT(r.t).c : r.d > 0 ? '#c9c6c0' : '#f4f3f0'}" stroke="#94a3b8" stroke-width=".6"/>`;
  });
  G.oe.forEach((q) => {
    const T = oeT(q.t);
    s += `<rect x="${ox + q.x * k}" y="${oy - (q.v + T.h) * k}" width="${T.b * k}" height="${T.h * k}" fill="${oeTuer(T) ? '#b9a891' : '#fff'}" stroke="${T.rf}" stroke-width="1"/>`;
  });
  return s + '</svg>';
}

// ---- Inspektor und Bibliothek (aus 060-kopf.js)
/** Bibliothek beim Werkzeug „Gruppe“: Gruppe wählen, setzen oder gewählte Felder füllen. */
function oegBibliothekHtml() {
  if (!FDS.grT || !oegG(FDS.grT)) FDS.grT = S.oeg.length ? S.oeg[0].k : null;
  const zahl = {};
  S.bld.forEach((x) =>
    Object.values(x.fd || {}).forEach((d) =>
      ((d && d.gr) || []).forEach((I) => (zahl[I.g] = (zahl[I.g] || 0) + 1)),
    ),
  );
  return (
    `<h4>Gruppen</h4>` +
    (S.oeg.length
      ? S.oeg
          .map(
            (G) =>
              `<div class="li${FDS.grT === G.k ? ' on' : ''}" onclick="oegWahl('${G.k}')" title="Wählen – dann in die Ansicht klicken (Umschalt: ohne Einrasten)">${oegSymbol(G, 48, 26)}<span>${esc(G.n)}<small>${fdFmt(G.l)} m · ${G.oe.length} Öffnung${G.oe.length === 1 ? '' : 'en'}${zahl[G.k] ? ' · ' + zahl[G.k] + '× gesetzt' : ''}</small></span></div>`,
          )
          .join('')
      : '<div class="leer">Noch keine Gruppe – im Konfigurator anlegen.</div>') +
    `<div class="row"><button class="bt" onclick="okOpen(null,'gr')">Konfigurator …</button></div>
<div class="leer" style="margin-top:10px">Einzeln: in die Ansicht klicken.<br>Ganze Felder: mit „Auswählen“ Felder wählen, dann oben „Gewählte Felder füllen“ – je Geschoss, Rest gleichmäßig an den Enden.</div>`
  );
}
/** Inspektor der gewählten Gruppe: tauschen, bearbeiten, entfernen. */
function oegInspektorHtml(b, V) {
  const I = oegGewaehlt(),
    G = I && oegG(I.g);
  if (!G) return '';
  const opt = S.oeg
      .map((x) => `<option value="${x.k}" ${x.k === I.g ? 'selected' : ''}>${esc(x.n)}</option>`)
      .join(''),
    n = (oegDaten(b, V.key) || []).filter((J) => J.g === I.g).length;
  return `<h4>Gruppe</h4><div class="li on" style="cursor:default">${oegSymbol(G, 48, 26)}<span>${esc(G.n)}<small>${fdFmt(G.l)} m · ${n}× in dieser Ansicht</small></span></div>
<h4>Tauschen</h4><select style="width:100%" onchange="oegTauschen(this.value)" title="Nur diese Stelle">${opt}</select>
${n > 1 ? `<select style="width:100%;margin-top:6px" onchange="if(this.value)oegTauschen(this.value,true)" title="Alle ${n} gleichen Gruppen dieser Ansicht"><option value="">Alle ${n} gleichen tauschen gegen …</option>${S.oeg.map((x) => `<option value="${x.k}">${esc(x.n)}</option>`).join('')}</select>` : ''}
<div class="row"><button class="bt" onclick="okOpen(null,'gr');okGrWahl('${G.k}')">Gruppe bearbeiten …</button><button class="bt" onclick="oegLoeschen()">Entfernen <kbd>Entf</kbd></button></div>
<div class="mu" style="margin-top:8px">Ziehen zum Verschieben · Änderungen an der Gruppe gelten an allen Stellen</div>`;
}
/** Gespeicherte Gruppen prüfen (Projekt laden). */
function oegPruefen(L) {
  return L.filter((G) => G && G.k).map((G) => ({
    k: String(G.k),
    n: String(G.n || 'Gruppe').slice(0, 60),
    l: Math.max(0.5, Math.min(40, +G.l || 6)),
    h: Math.max(1, Math.min(10, +G.h || 3)),
    oe: (Array.isArray(G.oe) ? G.oe : [])
      .filter((q) => q && q.t)
      .map((q, i) => ({ id: String(q.id || 'o' + i), t: String(q.t), x: +q.x || 0, v: +q.v || 0 })),
    t: S.ft.some((x) => x.k === G.t) ? G.t : '',
    ...oegFelderPruefen(G),
  }));
}
/** Teilungen und Felder prüfen; frühere Rücksprung-Rechtecke (rs) in Teilungen und Felder übernehmen. */
function oegFelderPruefen(G) {
  const zahl = (L) => (Array.isArray(L) ? L.map(Number).filter((x) => isFinite(x)) : []),
    xs = zahl(G.xs),
    ys = zahl(G.ys),
    fe = (Array.isArray(G.fe) ? G.fe : [])
      .filter((f) => f && Array.isArray(f.p))
      .map((f) => ({
        p: [+f.p[0] || 0, +f.p[1] || 0],
        d: Math.max(-1, Math.min(1, +f.d || 0)),
        k: f.k === 'l' || f.k === 'r' ? f.k : 'g',
        t: String(f.t || ''),
      }));
  (Array.isArray(G.rs) ? G.rs : []).forEach((r) => {
    if (!r || !(+r.b > 0) || !(+r.h > 0)) return;
    xs.push(+r.x, +r.x + +r.b);
    ys.push(+r.v, +r.v + +r.h);
    fe.push({ p: [+r.x + r.b / 2, +r.v + r.h / 2], d: Math.max(-1, Math.min(1, +r.d || 0)), t: '' });
  });
  return { xs, ys, fe };
}
