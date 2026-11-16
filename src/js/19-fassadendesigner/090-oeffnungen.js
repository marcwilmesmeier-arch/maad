// ======================= ÖFFNUNGEN: FENSTER UND TÜREN (Fassadendesigner) =======================
// 1. Öffnungstypen (S.oet): Katalog mit Art, Maßen, Brüstung, Teilung, Öffnungsart und Rahmen – im Fassadendesigner
//    unter „Öffnungen → Typen bearbeiten“ einstellbar (Konfigurator), mit dem Projekt gespeichert.
// 2. Öffnungen je Gebäude und Ansicht in b.fd[Ansicht].oe = [{ id, t, u, v, q }] (Ansichtskoordinaten wie die Felder):
//    u = Mitte der Öffnung entlang der Ansicht, v = Unterkante über dem Gebäudesockel (oberirdisch), q = Herkunft.
//    Heute nur q = 'frei' (von Hand gesetzt). Später platziert ein Konfigurator Öffnungsgruppen automatisch: deren
//    Öffnungen werden aus der Regel erzeugt (q = Kennung der Gruppe) und nicht gespeichert; oeListe() liefert beide.
//    Alle Verbraucher (Zeichnen, Bilanz, 3D in LOD 200) lesen nur über oeListe().
// 3D erst ab LOD 200: 22-lod200-waende/100-oeffnungen-3d.js.

const OE_ARTEN = { fe: 'Fenster', ft: 'Fenstertür', tu: 'Tür', fv: 'Festverglasung', to: 'Tor' };
const OE_OEFFNUNG = { dk: 'Dreh-Kipp', d: 'Dreh', k: 'Kipp', f: 'Fest', s: 'Schiebe' };
// k Schlüssel, n Name, a Art, b Breite, h Höhe, br Brüstung (Vorgabe beim Setzen), fl Flügel, ol Oberlicht (Höhe, 0 =
// ohne), oa Öffnungsart, rf Rahmenfarbe, pb Profilbreite, et Einbautiefe von der Außenseite (alle Maße in m)
const OET0 = [
  {
    k: 'f1',
    n: 'Fenster 1-flügelig',
    a: 'fe',
    b: 1.01,
    h: 1.385,
    br: 0.9,
    fl: 1,
    ol: 0,
    oa: 'dk',
    rf: '#3b3f44',
    pb: 0.07,
    et: 0.12,
  },
  {
    k: 'f2',
    n: 'Fenster 2-flügelig',
    a: 'fe',
    b: 1.76,
    h: 1.385,
    br: 0.9,
    fl: 2,
    ol: 0,
    oa: 'dk',
    rf: '#3b3f44',
    pb: 0.07,
    et: 0.12,
  },
  {
    k: 'fb',
    n: 'Fenster bodentief',
    a: 'fe',
    b: 1.01,
    h: 2.26,
    br: 0,
    fl: 1,
    ol: 0,
    oa: 'dk',
    rf: '#3b3f44',
    pb: 0.07,
    et: 0.12,
  },
  {
    k: 'ft',
    n: 'Fenstertür 2-flügelig',
    a: 'ft',
    b: 1.76,
    h: 2.26,
    br: 0,
    fl: 2,
    ol: 0.4,
    oa: 'dk',
    rf: '#3b3f44',
    pb: 0.07,
    et: 0.12,
  },
  {
    k: 'ht',
    n: 'Haustür',
    a: 'tu',
    b: 1.135,
    h: 2.26,
    br: 0,
    fl: 1,
    ol: 0,
    oa: 'd',
    rf: '#4a4038',
    pb: 0.08,
    et: 0.12,
  },
  {
    k: 'fv',
    n: 'Festverglasung',
    a: 'fv',
    b: 2.51,
    h: 2.26,
    br: 0,
    fl: 3,
    ol: 0,
    oa: 'f',
    rf: '#3b3f44',
    pb: 0.06,
    et: 0.12,
  },
  {
    k: 'to',
    n: 'Garagentor',
    a: 'to',
    b: 2.5,
    h: 2.125,
    br: 0,
    fl: 1,
    ol: 0,
    oa: 'f',
    rf: '#8a8f94',
    pb: 0.05,
    et: 0.08,
  },
];
S.oet = JSON.parse(JSON.stringify(OET0));
const oeT = (k) => S.oet.find((t) => t.k === k) || S.oet[0];
const OE_RASTER = 0.05; // Fangraster beim Setzen und Verschieben (m)

/** Gespeicherte Öffnungen einer Ansicht (Liste wird bei Bedarf angelegt). */
function oeDaten(b, vk, mk) {
  const d = fdD(b, vk, mk);
  if (!d) return null;
  if (!d.oe) {
    if (!mk) return null;
    d.oe = [];
  }
  return d.oe;
}
/** Alle Öffnungen einer Ansicht mit Typ und Rechteck (u0–u1, v0–v1); heute frei gesetzte, später auch aus Gruppen. */
function oeListe(b, V) {
  const L = oeDaten(b, V.key) || [];
  return L.map((o) => {
    const T = oeT(o.t);
    return { o, T, u0: o.u - T.b / 2, u1: o.u + T.b / 2, v0: o.v, v1: o.v + T.h };
  });
}
/** Unterkante des Geschosses, in dem die Höhe v liegt (Ansichtskoordinate). */
function oeGeschossBasis(b, v) {
  const B = fdStoreys(b);
  for (let i = B.length - 2; i >= 0; i--) if (v >= B[i] - 1e-6) return B[i];
  return 0;
}
/** Öffnung unter dem Punkt (u, v) oder null. */
function oeTreffer(b, V, u, v) {
  const L = oeListe(b, V);
  for (let i = L.length - 1; i >= 0; i--) {
    const x = L[i];
    if (u >= x.u0 && u <= x.u1 && v >= x.v0 && v <= x.v1) return x;
  }
  return null;
}
/**
 * Lage beim Setzen/Verschieben: Raster 5 cm; Brüstung rastet auf die Vorgabe des Typs im jeweiligen Geschoss ein,
 * die Mitte auf die Achsen anderer Öffnungen (Shift: ohne Einrasten).
 */
function oeFang(b, V, u, v, T, frei, ohneId) {
  const r = (x) => Math.round(x / OE_RASTER) * OE_RASTER,
    tol = Math.max(0.05, 10 / fdVP().s);
  let U = u,
    V0 = v - T.h / 2;
  if (!frei) {
    U = r(U);
    // Brüstung des Typs im Geschoss unter dem Mauszeiger (Türen: Fußboden) hat Vorrang
    const bs = oeGeschossBasis(b, v) + T.br,
      fest = Math.abs(V0 - bs) < (T.br ? 0.35 : 0.6);
    V0 = fest ? bs : r(V0);
    let best = tol;
    oeListe(b, V).forEach((x) => {
      if (x.o.id === ohneId) return;
      const d = Math.abs(x.o.u - u);
      if (d < best) {
        best = d;
        U = x.o.u;
      }
      if (!fest && Math.abs(x.v0 - V0) < Math.min(tol, 0.15)) V0 = x.v0;
    });
  }
  return { u: U, v: Math.max(V.v0, V0) };
}
/** Liegt die Öffnung auf einer Ansichtsfläche (Mitte innerhalb eines Feldes)? */
function oeAufFlaeche(b, V, u, v, T) {
  return fdHitFace(b, V, u, v + T.h / 2) >= 0;
}

// ---- Bearbeiten
function oeSetzen(b, V, p, frei) {
  const T = oeT(FDS.oeT),
    q = oeFang(b, V, p.x, p.z, T, frei);
  if (!oeAufFlaeche(b, V, q.u, q.v, T)) {
    fdNote('Öffnungen nur auf der Fassade setzen.');
    return;
  }
  const id = 'oe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  fdEdit((b) => oeDaten(b, V.key, true).push({ id, t: T.k, u: q.u, v: q.v, q: 'frei' }));
  FDS.oe = id;
}
/** Gewählte Öffnung (gespeicherter Eintrag) der aktuellen Ansicht. */
function oeGewaehlt() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V || !FDS.oe) return null;
  return (oeDaten(b, V.key) || []).find((o) => o.id === FDS.oe) || null;
}
/** Eigenschaft der gewählten Öffnung ändern: t Typ, x Abstand vom linken Rand der Ansicht, br Brüstung. */
function oeAendern(k, v) {
  const o = oeGewaehlt(),
    b = fdB(),
    V = fdCurV();
  if (!o) return;
  fdEdit(() => {
    if (k === 't' && S.oet.some((t) => t.k === v)) o.t = v;
    const n = +String(v).replace(',', '.');
    if (k === 'x' && isFinite(n)) o.u = V.u0 + n + oeT(o.t).b / 2;
    if (k === 'br' && isFinite(n)) o.v = oeGeschossBasis(b, o.v + 0.01) + Math.max(0, n);
  });
}
function oeLoeschen() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V || !FDS.oe) return;
  const id = FDS.oe;
  fdEdit((b) => {
    const L = oeDaten(b, V.key);
    if (L) L.splice(0, L.length, ...L.filter((o) => o.id !== id));
  });
  FDS.oe = null;
}
function oeDuplizieren() {
  const o = oeGewaehlt(),
    V = fdCurV();
  if (!o) return;
  const id = 'oe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    T = oeT(o.t);
  fdEdit((b) => oeDaten(b, V.key, true).push({ ...o, id, u: o.u + T.b + 0.5 }));
  FDS.oe = id;
}
/** Werkzeug „Öffnung“: Typ zum Setzen wählen. */
function oeTypWahl(k) {
  FDS.oeT = k;
  if (FDS.tool !== 'oe') fdTool('oe');
  FDS.ps = '';
  fdTick(true);
}
// ---- Konfigurator: Öffnungstypen
function oeTypSet(k, f, v) {
  const T = S.oet.find((t) => t.k === k);
  if (!T) return;
  hist();
  if (f === 'n' || f === 'a' || f === 'oa' || f === 'rf') T[f] = String(v).slice(0, 60);
  else {
    const n = +String(v).replace(',', '.');
    if (!isFinite(n)) return;
    const lim = {
      b: [0.3, 8],
      h: [0.3, 6],
      br: [0, 3],
      fl: [1, 6],
      ol: [0, 1.5],
      pb: [0.03, 0.2],
      et: [0, 0.4],
    }[f];
    if (!lim) return;
    T[f] =
      f === 'fl' ? Math.round(Math.max(lim[0], Math.min(lim[1], n))) : Math.max(lim[0], Math.min(lim[1], n));
    if (f === 'ol' || f === 'h') T.ol = Math.min(T.ol, Math.max(0, T.h - 0.5));
  }
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
}
function oeTypNeu() {
  const v = oeT(FDS.oeT),
    k = 'u' + Date.now().toString(36);
  hist();
  S.oet.push({ ...JSON.parse(JSON.stringify(v)), k, n: v.n + ' (Kopie)' });
  FDS.oeT = k;
  FDS.ps = '';
  fdTick(true);
}
function oeTypLoeschen(k) {
  if (S.oet.length < 2) return;
  const n = S.bld.reduce(
    (s, b) =>
      s +
      Object.values(b.fd || {}).reduce((t, d) => t + ((d && d.oe) || []).filter((o) => o.t === k).length, 0),
    0,
  );
  if (n && !confirm(`${n} Öffnung${n === 1 ? '' : 'en'} dieses Typs ebenfalls löschen?`)) return;
  hist();
  S.oet = S.oet.filter((t) => t.k !== k);
  S.bld.forEach((b) =>
    Object.values(b.fd || {}).forEach((d) => {
      if (d && d.oe) d.oe = d.oe.filter((o) => o.t !== k);
    }),
  );
  if (FDS.oeT === k) FDS.oeT = S.oet[0].k;
  FDS.ps = '';
  fdTick(true);
}

// ---- Eingabe (aus 050-eingabe.js)
/** Pointerdown im Werkzeug „Wählen“ oder „Öffnung“; true = Ereignis verbraucht. */
function oeDown(b, V, p, e) {
  const x = oeTreffer(b, V, p.x, p.z);
  if (x && (FDS.tool === 'sel' || FDS.tool === 'oe')) {
    FDS.oe = x.o.id;
    FDS.sel = [];
    FDS.selCut = null;
    FDS.oeZug = {
      id: x.o.id,
      du: x.o.u - p.x,
      dv: x.v0 + x.T.h / 2 - p.z,
      px: e.clientX,
      py: e.clientY,
      bewegt: false,
    };
    FDS.ps = '';
    FDS.dirty = 1;
    return true;
  }
  if (FDS.tool === 'oe') {
    oeSetzen(b, V, p, e.shiftKey);
    return true;
  }
  if (FDS.oe) {
    FDS.oe = null;
    FDS.ps = '';
  }
  return false;
}
/** Pointermove: Öffnung ziehen bzw. Vorschau im Werkzeug „Öffnung“; true = verbraucht. */
function oeMove(b, V, p, e) {
  const z = FDS.oeZug;
  if (z) {
    if (!z.bewegt && Math.hypot(e.clientX - z.px, e.clientY - z.py) < 4) return true;
    const o = (oeDaten(b, V.key) || []).find((q) => q.id === z.id);
    if (!o) return true;
    if (!z.bewegt) {
      hist();
      z.bewegt = true;
    }
    const q = oeFang(b, V, p.x + z.du, p.z + z.dv, oeT(o.t), e.shiftKey, o.id);
    o.u = q.u;
    o.v = q.v;
    FDS.dirty = 1;
    return true;
  }
  if (FDS.tool === 'oe') {
    const T = oeT(FDS.oeT),
      q = oeFang(b, V, p.x, p.z, T, e.shiftKey);
    FDS.oeVor = { u: q.u, v: q.v, T, ok: oeAufFlaeche(b, V, q.u, q.v, T) };
    e.currentTarget.style.cursor = 'crosshair';
    FDS.dirty = 1;
    return true;
  }
  if (FDS.oeVor) {
    FDS.oeVor = null;
    FDS.dirty = 1;
  }
  if (FDS.tool === 'sel' && oeTreffer(b, V, p.x, p.z)) {
    e.currentTarget.style.cursor = 'move';
    return true;
  }
  return false;
}
/** Pointerup: Ziehen abschließen; true = verbraucht. */
function oeUp() {
  const z = FDS.oeZug;
  if (!z) return false;
  FDS.oeZug = null;
  if (z.bewegt) {
    FDS.ps = '';
    try {
      rr();
      zoTick(true);
    } catch (e) {
      logErr(e, 'oeUp');
    }
  }
  return true;
}

// ---- Zeichnen (aus 040-fang.js)
/** Eine Öffnung in Ansichtsdarstellung: Rahmen, Glas bzw. Türblatt, Flügelteilung, Öffnungssymbole. */
function oeZeichneEine(g, X, Y, u0, u1, v0, T, o) {
  const s = Math.abs(X(1) - X(0)),
    x0 = X(u0),
    x1 = X(u1),
    yb = Y(v0),
    yt = Y(v0 + T.h),
    pb = Math.max(1, T.pb * s);
  g.save();
  g.globalAlpha = o.alpha || 1;
  g.fillStyle = T.rf;
  g.fillRect(x0, yt, x1 - x0, yb - yt);
  const glas = T.a === 'tu' ? '#b9a891' : T.a === 'to' ? '#c6cbd0' : '#cfe1ee',
    oy = T.ol > 0 && T.a !== 'to' ? T.ol * s : 0,
    n = T.a === 'to' ? 1 : Math.max(1, T.fl),
    w = (x1 - x0 - pb * (n + 1)) / n,
    hf = yb - yt - pb * (oy ? 3 : 2) - oy;
  // Oberlicht
  if (oy) {
    g.fillStyle = '#d7e6f1';
    g.fillRect(x0 + pb, yt + pb, x1 - x0 - 2 * pb, oy);
  }
  for (let i = 0; i < n; i++) {
    const fx = x0 + pb + i * (w + pb),
      fy = yt + pb + (oy ? oy + pb : 0);
    g.fillStyle = glas;
    g.fillRect(fx, fy, w, hf);
    if (T.a === 'to') {
      g.strokeStyle = '#8f969d';
      g.lineWidth = 1;
      for (let k = 1; k < Math.floor(T.h / 0.5); k++) {
        const y = fy + (hf * k) / Math.floor(T.h / 0.5);
        g.beginPath();
        g.moveTo(fx, y);
        g.lineTo(fx + w, y);
        g.stroke();
      }
    }
    // Öffnungssymbol: Spitze zur Bandseite (Dreh), zur Unterkante (Kipp)
    if ((T.oa === 'd' || T.oa === 'dk' || T.oa === 'k') && w > 6 && hf > 6) {
      const links = n === 1 ? T.a !== 'tu' : i < n / 2;
      g.strokeStyle = '#3b3f44';
      g.lineWidth = 0.8;
      g.setLineDash([3, 2]);
      g.beginPath();
      if (T.oa !== 'k') {
        const ax = links ? fx : fx + w,
          bx = links ? fx + w : fx;
        g.moveTo(bx, fy);
        g.lineTo(ax, fy + hf / 2);
        g.lineTo(bx, fy + hf);
      }
      if (T.oa !== 'd') {
        g.moveTo(fx, fy);
        g.lineTo(fx + w / 2, fy + hf);
        g.lineTo(fx + w, fy);
      }
      g.stroke();
      g.setLineDash([]);
    } else if (T.oa === 's' && w > 10) {
      g.strokeStyle = '#3b3f44';
      g.lineWidth = 1;
      const y = fy + hf / 2,
        r = i % 2 ? -1 : 1;
      g.beginPath();
      g.moveTo(fx + w * 0.3, y);
      g.lineTo(fx + w * 0.7, y);
      g.lineTo(fx + w * 0.7 - 5 * r, y - 4);
      g.stroke();
    }
  }
  if (o.sel) {
    g.strokeStyle = '#1f6fd1';
    g.lineWidth = 2.5;
    g.strokeRect(x0 - 2, yt - 2, x1 - x0 + 4, yb - yt + 4);
  } else if (o.fehler) {
    g.strokeStyle = '#c2410c';
    g.lineWidth = 2;
    g.strokeRect(x0, yt, x1 - x0, yb - yt);
  }
  g.restore();
}
/** Alle Öffnungen einer Ansicht zeichnen (ox: Versatz in der Abwicklung). */
function oeZeichnen(g, b, V, ox, o) {
  const X = (u) => fdSX(u + ox),
    Y = fdSY;
  oeListe(b, V).forEach((x) =>
    oeZeichneEine(g, X, Y, x.u0, x.u1, x.v0, x.T, { sel: o.sel && FDS.oe === x.o.id }),
  );
}
/** Vorschau beim Setzen und Maße der gewählten Öffnung (nur Einzelansicht). */
function oeVorschau(g, b, V) {
  const X = fdSX,
    Y = fdSY,
    p = FDS.oeVor;
  if (p && FDS.tool === 'oe' && !FDS.oeZug)
    oeZeichneEine(g, X, Y, p.u - p.T.b / 2, p.u + p.T.b / 2, p.v, p.T, { alpha: 0.55, fehler: !p.ok });
  const x = FDS.oe && oeListe(b, V).find((q) => q.o.id === FDS.oe);
  if (!x) return;
  const bs = oeGeschossBasis(b, x.v0 + 0.01);
  g.save();
  g.fillStyle = '#1f6fd1';
  g.strokeStyle = '#1f6fd1';
  g.font = '11px system-ui,sans-serif';
  g.lineWidth = 1;
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.fillText(fdFmt(x.T.b) + ' × ' + fdFmt(x.T.h), (X(x.u0) + X(x.u1)) / 2, Y(x.v1) - 6);
  if (x.v0 - bs > 0.01) {
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(X(x.o.u), Y(bs));
    g.lineTo(X(x.o.u), Y(x.v0));
    g.stroke();
    g.setLineDash([]);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('Br ' + fdFmt(x.v0 - bs), X(x.o.u) + 4, (Y(bs) + Y(x.v0)) / 2);
  }
  g.restore();
}

// ---- Seitenleiste (aus 060-kopf.js)
const OECSS = `#fdDock input[type=number]{border:1px solid var(--ln,#dcdcdc);border-radius:5px;padding:3px 5px;background:var(--pn,#E9EDEF);font:inherit;color:inherit;width:70px;text-align:right}
#fdDock .oeg{display:grid;grid-template-columns:1fr 92px;gap:4px 8px;align-items:center;margin:6px 0}
#fdDock .oeg input[type=number],#fdDock .oeg select,#fdDock .oeg input[type=text]{width:100%}
#fdDock .oeg input[type=color]{width:100%;height:24px;padding:0;border:1px solid var(--ln,#dcdcdc);border-radius:4px;background:none}
#fdDock .ft svg{flex:none}`;
/** Kleines Symbol des Typs für Listen. */
function oeSymbol(T) {
  const w = 22,
    h = 18,
    k = Math.min(w / T.b, h / T.h),
    bw = T.b * k,
    bh = T.h * k,
    x = (w - bw) / 2,
    y = h - bh,
    n = T.a === 'to' ? 1 : Math.max(1, T.fl),
    fill = T.a === 'tu' ? '#b9a891' : T.a === 'to' ? '#c6cbd0' : '#cfe1ee';
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${fill}" stroke="${T.rf}" stroke-width="1.6"/>`;
  for (let i = 1; i < n; i++)
    s += `<line x1="${x + (bw * i) / n}" y1="${y}" x2="${x + (bw * i) / n}" y2="${h}" stroke="${T.rf}" stroke-width="1"/>`;
  return s + '</svg>';
}
/** Abschnitt „Öffnungen“ der Seitenleiste: Typen zum Setzen, Konfigurator, gewählte Öffnung, Bilanz. */
function oePanelHtml(b, V) {
  if (!document.getElementById('oeCss')) {
    const st = document.createElement('style');
    st.id = 'oeCss';
    st.textContent = OECSS;
    document.head.appendChild(st);
  }
  if (!FDS.oeT || !S.oet.some((t) => t.k === FDS.oeT)) FDS.oeT = S.oet[0].k;
  const n = (k, v, f, lim) =>
      `<input type="number" step="${lim || 0.01}" value="${+v.toFixed(3)}" onchange="${f}('${k}',this.value)">`,
    zahl = {};
  S.bld.forEach((x) =>
    Object.values(x.fd || {}).forEach((d) =>
      ((d && d.oe) || []).forEach((o) => (zahl[o.t] = (zahl[o.t] || 0) + 1)),
    ),
  );
  let h = `<h4>Öffnungen ${FDS.tool === 'oe' ? '· Typ wählen, in die Ansicht klicken' : ''}</h4>`;
  if (FDS.oeMng) {
    const T = oeT(FDS.oeT),
      ts = (f, v, lim) =>
        `<input type="number" step="${lim || 0.01}" value="${+(+v).toFixed(3)}" onchange="oeTypSet('${T.k}','${f}',this.value)">`;
    h += `<div class="fe"><select style="flex:1" onchange="FDS.oeT=this.value;FDS.ps='';fdTick(true)">${S.oet.map((t) => `<option value="${t.k}" ${t.k === T.k ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select></div>
<div class="oeg"><span>Name</span><input type="text" value="${esc(T.n)}" onchange="oeTypSet('${T.k}','n',this.value)">
<span>Art</span><select onchange="oeTypSet('${T.k}','a',this.value)">${Object.keys(OE_ARTEN)
      .map((k) => `<option value="${k}" ${T.a === k ? 'selected' : ''}>${OE_ARTEN[k]}</option>`)
      .join('')}</select>
<span>Breite (m)</span>${ts('b', T.b)}<span>Höhe (m)</span>${ts('h', T.h)}<span>Brüstung (m)</span>${ts('br', T.br)}
<span>Flügel</span>${ts('fl', T.fl, 1)}<span>Oberlicht (m, 0 = ohne)</span>${ts('ol', T.ol)}
<span>Öffnungsart</span><select onchange="oeTypSet('${T.k}','oa',this.value)">${Object.keys(OE_OEFFNUNG)
      .map((k) => `<option value="${k}" ${T.oa === k ? 'selected' : ''}>${OE_OEFFNUNG[k]}</option>`)
      .join('')}</select>
<span>Rahmenfarbe</span><input type="color" value="${T.rf}" onchange="oeTypSet('${T.k}','rf',this.value)">
<span>Profilbreite (m)</span>${ts('pb', T.pb)}<span>Einbautiefe von außen (m)</span>${ts('et', T.et)}</div>
<div class="mu">Fläche ${fdFmt(T.b * T.h)} m² · ${zahl[T.k] || 0}× im Projekt. Änderungen gelten für alle Öffnungen dieses Typs.</div>
<div style="margin-top:6px"><button onclick="oeTypNeu()">+ Kopie als neuer Typ</button> ${S.oet.length > 1 ? `<button onclick="oeTypLoeschen('${T.k}')">Typ löschen</button>` : ''} <button onclick="FDS.oeMng=false;FDS.ps='';fdTick(true)">Fertig</button></div>`;
  } else {
    h +=
      S.oet
        .map(
          (t) =>
            `<div class="ft${FDS.tool === 'oe' && FDS.oeT === t.k ? ' on' : ''}" onclick="oeTypWahl('${t.k}')" title="Zum Setzen wählen – dann in die Ansicht klicken (Shift: ohne Einrasten)">${oeSymbol(t)}<span>${esc(t.n)} <span class="mu">${fdFmt(t.b)} × ${fdFmt(t.h)}</span></span><b>${zahl[t.k] ? zahl[t.k] + '×' : ''}</b></div>`,
        )
        .join('') +
      `<button style="margin-top:6px" onclick="FDS.oeMng=true;FDS.ps='';fdTick(true)">Typen bearbeiten …</button>`;
  }
  const o = V && oeGewaehlt();
  if (o) {
    const T = oeT(o.t),
      bs = oeGeschossBasis(b, o.v + 0.01);
    h += `<h4>Gewählte Öffnung</h4><div class="oeg"><span>Typ</span><select onchange="oeAendern('t',this.value)">${S.oet.map((t) => `<option value="${t.k}" ${t.k === o.t ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select>
<span>Abstand vom linken Rand (m)</span>${n('x', o.u - T.b / 2 - V.u0, 'oeAendern')}<span>Brüstung im Geschoss (m)</span>${n('br', o.v - bs, 'oeAendern')}</div>
<div><button onclick="oeDuplizieren()" title="Kopie rechts daneben">Duplizieren</button> <button onclick="oeLoeschen()" title="Öffnung löschen (Entf)">Löschen</button></div>`;
  }
  if (V) {
    const L = oeListe(b, V),
      a = L.reduce((s, x) => s + x.T.b * x.T.h, 0);
    if (L.length)
      h += `<div class="mu" style="margin-top:6px">${esc(V.name)}: ${L.length} Öffnung${L.length === 1 ? '' : 'en'} · ${fdFmt(a)} m² · ${Math.round((a / (V.area || 1)) * 100)} % der Ansichtsfläche. Im 3D-Modell ab LOD 200.</div>`;
  }
  return h;
}
/** Bilanz der Öffnungen eines Gebäudes: je Typ Anzahl und Fläche, gesamt. */
function oeBilanz(b) {
  const R = { t: {}, n: 0, a: 0 };
  fdViews(b).forEach((V) =>
    oeListe(b, V).forEach((x) => {
      const r = R.t[x.T.k] || (R.t[x.T.k] = { n: 0, a: 0 });
      r.n++;
      r.a += x.T.b * x.T.h;
      R.n++;
      R.a += x.T.b * x.T.h;
    }),
  );
  return R;
}
/** Gespeicherte Öffnungstypen prüfen (Projekt laden): fehlende Felder aus der Vorgabe ergänzen. */
function oeTypenPruefen(L) {
  const v = OET0[0];
  return L.filter((t) => t && t.k).map((t) => {
    const o = { ...v, ...t };
    ['b', 'h', 'br', 'fl', 'ol', 'pb', 'et'].forEach((k) => {
      if (!isFinite(+o[k])) o[k] = v[k];
      else o[k] = +o[k];
    });
    if (!OE_ARTEN[o.a]) o.a = 'fe';
    if (!OE_OEFFNUNG[o.oa]) o.oa = 'f';
    if (!/^#[0-9a-f]{6}$/i.test(o.rf)) o.rf = v.rf;
    return o;
  });
}
