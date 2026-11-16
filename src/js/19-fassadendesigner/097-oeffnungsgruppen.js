// ======================= ÖFFNUNGSGRUPPEN (wie in Forma) =======================
// Eine Gruppe ist ein Fassadenabschnitt fester Länge (z. B. 6 m) und Höhe (Geschoss), in dem Öffnungen aus dem Katalog
// sitzen: S.oeg = [{ k, n, l, h, oe: [{ id, t, x, v }], rs: [{ id, x, v, b, h, d }] }] (x = linke Kante, v = Unterkante
// über dem Fußboden). rs = Rücksprünge: Rechtecke mit Tiefe d (m; positiv = Fassade springt zurück, negativ = Vorsprung),
// z. B. ein vertieftes Feld neben dem Fenster oder ein gerader Versprung über die ganze Gruppe.
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
    rs: [
      { id: 'r1', x: 1.91, v: 0.75, b: 1.2, h: 1.685, d: 0.05 },
      { id: 'r2', x: 4.61, v: 0.75, b: 1.2, h: 1.685, d: 0.05 },
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
/** Rücksprünge aller Gruppenverweise einer Ansicht: { u0, u1, v0, v1, d, id, gi }. */
function oegRuecksprunge(b, V) {
  const R = [];
  (oegDaten(b, V.key) || []).forEach((I) => {
    const G = oegG(I.g);
    if (!G || !G.rs) return;
    G.rs.forEach((r) =>
      R.push({
        u0: I.u + r.x,
        u1: I.u + r.x + r.b,
        v0: I.v + r.v,
        v1: I.v + r.v + r.h,
        d: r.d,
        id: I.id + ':' + r.id,
        gi: I,
      }),
    );
  });
  return R;
}
/** Rücksprung in der Ansicht zeichnen: zurückspringend dunkler, vorspringend heller, Schattenkante oben/links. */
function oegRueckZeichneEins(g, X, Y, u0, u1, v0, v1, d, an) {
  const x0 = X(u0),
    x1 = X(u1),
    y0 = Y(v1),
    y1 = Y(v0);
  g.save();
  g.fillStyle = d > 0 ? 'rgba(30,41,59,0.16)' : 'rgba(255,255,255,0.45)';
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
  oegRuecksprunge(b, V).forEach((r) => oegRueckZeichneEins(g, X, fdSY, r.u0, r.u1, r.v0, r.v1, r.d, false));
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
        const s = a + (c - a - k * G.l) / 2;
        for (let i = 0; i < k; i++) L.push({ id: oegNeuId(), g: G.k, u: s + i * G.l, v: v0 });
        n += k;
      }
    });
  });
  fdNote(n ? `${n}× „${G.n}“ gesetzt.` : `Felder zu schmal für „${G.n}“ (${fdFmt(G.l)} m).`);
}
/** Gewählten Verweis auf eine andere Gruppe umstellen (alle = alle Verweise dieser Gruppe in der Ansicht). */
function oegTauschen(k, alle) {
  const I = oegGewaehlt(),
    V = fdCurV();
  if (!I || !oegG(k)) return;
  const alt = I.g;
  fdEdit((b) =>
    (oegDaten(b, V.key) || []).forEach((J) => {
      if (J.id === I.id || (alle && J.g === alt)) J.g = k;
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
  (G.rs || []).forEach((r) => {
    s += `<rect x="${ox + r.x * k}" y="${oy - (r.v + r.h) * k}" width="${r.b * k}" height="${r.h * k}" fill="${r.d > 0 ? '#c9c6c0' : '#f4f3f0'}" stroke="#94a3b8" stroke-width=".6"/>`;
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
    rs: (Array.isArray(G.rs) ? G.rs : [])
      .filter((r) => r && +r.b > 0 && +r.h > 0)
      .map((r, i) => ({
        id: String(r.id || 'r' + i),
        x: +r.x || 0,
        v: +r.v || 0,
        b: +r.b,
        h: +r.h,
        d: Math.max(-1, Math.min(1, +r.d || 0)),
      })),
  }));
}
