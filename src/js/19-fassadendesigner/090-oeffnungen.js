// ======================= ÖFFNUNGEN: FENSTER UND TÜREN (Fassadendesigner) =======================
// 1. Öffnungstypen (S.oet): Katalog mit Art, Maßen, Brüstung, Einteilung (Flügel mit Breite, Öffnungsart, Anschlag und
//    Füllung; Oberlicht, Unterlicht, Sprossen) und Rahmen – bearbeitet im Konfigurator (095-konfigurator.js), mit dem
//    Projekt gespeichert. oeAufteilung() rechnet die Einteilung für Ansicht, Symbol und 3D einheitlich aus.
// 2. Öffnungen je Gebäude und Ansicht in b.fd[Ansicht].oe = [{ id, t, u, v, q }] (Ansichtskoordinaten wie die Felder):
//    u = Mitte der Öffnung entlang der Ansicht, v = Unterkante über dem Gebäudesockel (oberirdisch), q = Herkunft.
//    Heute nur q = 'frei' (von Hand gesetzt). Später platziert ein Konfigurator Öffnungsgruppen automatisch: deren
//    Öffnungen werden aus der Regel erzeugt (q = Kennung der Gruppe) und nicht gespeichert; oeListe() liefert beide.
//    Alle Verbraucher (Zeichnen, Bilanz, 3D in LOD 200) lesen nur über oeListe().
// 3D erst ab LOD 200: 22-lod200-waende/100-oeffnungen-3d.js.

const OE_ARTEN = { fe: 'Fenster', ft: 'Fenstertür', tu: 'Tür', fv: 'Festverglasung', to: 'Tor' };
const OE_OEFFNUNG = { dk: 'Dreh-Kipp', d: 'Dreh', k: 'Kipp', f: 'Fest', s: 'Schiebe' };
// k Schlüssel, n Name, a Art, b Breite, h Höhe, br Brüstung (Vorgabe beim Setzen), rf Rahmenfarbe, pb Rahmenbreite,
// pp Breite von Pfosten und Riegel (ohne Angabe wie pb),
// et Einbautiefe von der Außenseite (alle Maße in m). Einteilung: sp Flügel [{ w Anteil, oa Öffnungsart, an Anschlag
// 'l'/'r', fu Füllung 'g' Glas / 'p' Paneel }], ol Oberlicht (Höhe, 0 = ohne) mit olOa, ul Unterlicht mit ulFu,
// sr Sprossen [waagerecht, senkrecht] je Flügel. Ältere Typen ohne sp: fl (Anzahl) und oa (für alle Flügel).
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
const OE_FUELL = { g: 'Flügel', p: 'Paneel' }; // Unterteilung: verglaster Flügel oder Paneel in Rahmenfarbe
const oeTuer = (T) => T.a === 'tu' || T.a === 'to';

/** Flügel eines Typs (aus sp oder, bei älteren Typen, aus Anzahl fl und Öffnungsart oa). */
function oeSpalten(T) {
  if (Array.isArray(T.sp) && T.sp.length) return T.sp;
  const n = T.a === 'to' ? 1 : Math.max(1, Math.round(T.fl || 1));
  return Array.from({ length: n }, (_, i) => ({
    w: 1,
    oa: T.oa || 'f',
    an: n === 1 ? (T.a === 'tu' ? 'r' : 'l') : i < n / 2 ? 'l' : 'r',
    fu: oeTuer(T) ? 'p' : 'g',
  }));
}
/**
 * Einteilung eines Typs in lokalen Maßen (m, Ursprung unten links): Stege (Rahmen, Pfosten, Riegel) und Felder.
 * Felder: { x0, x1, y0, y1, oa, an, fu, i (Flügelnummer oder 'ol'/'ul'), sr (Sprossen) }.
 */
function oeAufteilung(T) {
  const b = T.b,
    h = T.h,
    pb = Math.max(0.02, Math.min(T.pb || 0.07, b / 6, h / 6)),
    pp = Math.max(0.02, Math.min(T.pp > 0 ? T.pp : pb, b / 6, h / 6)),
    stege = [],
    felder = [],
    tuer = oeTuer(T);
  stege.push([0, pb, 0, h], [b - pb, b, 0, h], [pb, b - pb, h - pb, h]);
  if (!tuer) stege.push([pb, b - pb, 0, pb]);
  let yb = tuer ? 0 : pb,
    yt = h - pb;
  const ul = T.ul > 0 && T.a !== 'to' ? Math.min(T.ul, yt - yb - 0.3 - pp) : 0;
  if (ul > 0.05) {
    felder.push({ x0: pb, x1: b - pb, y0: yb, y1: yb + ul, oa: 'f', an: 'l', fu: T.ulFu || 'p', i: 'ul' });
    stege.push([pb, b - pb, yb + ul, yb + ul + pp]);
    yb += ul + pp;
  }
  const ol = T.ol > 0 && T.a !== 'to' ? Math.min(T.ol, yt - yb - 0.3 - pp) : 0;
  if (ol > 0.05) {
    felder.push({
      x0: pb,
      x1: b - pb,
      y0: yt - ol,
      y1: yt,
      oa: T.olOa || 'f',
      an: 'l',
      fu: T.olFu || 'g',
      i: 'ol',
    });
    stege.push([pb, b - pb, yt - ol - pp, yt - ol]);
    yt -= ol + pp;
  }
  const SP = oeSpalten(T),
    n = SP.length,
    innen = b - 2 * pb - (n - 1) * pp,
    sw = SP.reduce((s, c) => s + (c.w > 0 ? c.w : 1), 0) || 1;
  let x = pb;
  SP.forEach((c, i) => {
    const w = (innen * (c.w > 0 ? c.w : 1)) / sw;
    felder.push({ x0: x, x1: x + w, y0: yb, y1: yt, oa: c.oa, an: c.an, fu: c.fu || 'g', i, sr: T.sr });
    x += w;
    if (i < n - 1) {
      stege.push([x, x + pp, yb, yt]);
      x += pp;
    }
  });
  // Unterteilungen einzelner Felder (T.ut, je Feld ein Baum aus Teilungen): Teilfelder, Stege, ziehbare Stege
  const aus = [],
    ns = [];
  felder.forEach((f) => oeTeilBaum(f, (T.ut || {})[String(f.i)], f.i, '', pp, aus, stege, ns));
  return { pb, pp, stege, felder: aus, oben: felder, ns };
}
/**
 * Feld f nach dem Teilungsbaum knoten aufteilen. Knoten: { a: 'x'|'y', r: Lage 0–1, k: [Kind, Kind] }, Blatt: { fu }.
 * Teilfelder heißen „oben.pfad“ (pfad aus 0/1 je Ebene, z. B. „0.10“), ziehbare Stege „n:oben:pfad“.
 */
function oeTeilBaum(f, knoten, oben, pfad, pb, aus, stege, ns) {
  if (!knoten || !knoten.a) {
    const fu = knoten && OE_FUELL[knoten.fu] ? knoten.fu : f.fu;
    aus.push(pfad ? { ...f, i: oben + '.' + pfad, fu, oben } : { ...f, fu });
    return;
  }
  const r = Math.max(0.05, Math.min(0.95, +knoten.r || 0.5)),
    k = knoten.k || [],
    gr = {
      id: 'n:' + oben + ':' + pfad,
      art: knoten.a,
      oben,
      pfad,
      px0: f.x0,
      px1: f.x1,
      py0: f.y0,
      py1: f.y1,
    };
  if (knoten.a === 'x') {
    const m = f.x0 + (f.x1 - f.x0) * r;
    stege.push([m - pb / 2, m + pb / 2, f.y0, f.y1]);
    ns.push({ ...gr, a: m - pb / 2, b: m + pb / 2, y0: f.y0, y1: f.y1 });
    oeTeilBaum({ ...f, x1: m - pb / 2 }, k[0], oben, pfad + '0', pb, aus, stege, ns);
    oeTeilBaum({ ...f, x0: m + pb / 2 }, k[1], oben, pfad + '1', pb, aus, stege, ns);
  } else {
    const m = f.y0 + (f.y1 - f.y0) * r;
    stege.push([f.x0, f.x1, m - pb / 2, m + pb / 2]);
    ns.push({ ...gr, a: m - pb / 2, b: m + pb / 2, x0: f.x0, x1: f.x1 });
    oeTeilBaum({ ...f, y1: m - pb / 2 }, k[0], oben, pfad + '0', pb, aus, stege, ns);
    oeTeilBaum({ ...f, y0: m + pb / 2 }, k[1], oben, pfad + '1', pb, aus, stege, ns);
  }
}
/** Teilungsbaum prüfen (Laden): nur gültige Knoten und Blätter, Tiefe begrenzt. */
function oeBaumPruefen(n, tiefe) {
  if (!n || typeof n !== 'object' || tiefe > 8) return null;
  if (n.a === 'x' || n.a === 'y')
    return {
      a: n.a,
      r: Math.max(0.05, Math.min(0.95, +n.r || 0.5)),
      k: [oeBaumPruefen((n.k || [])[0], tiefe + 1), oeBaumPruefen((n.k || [])[1], tiefe + 1)],
    };
  return OE_FUELL[n.fu] ? { fu: n.fu } : null;
}
/** Füllfarbe eines Feldes in der Ansicht. */
// Glas weiß, 80 % durchsichtig (wie im 3D-Modell); Paneel in der Rahmenfarbe
const oeFeldFarbe = (T, f) => (T.a === 'to' ? '#c6cbd0' : f.fu === 'p' ? T.rf : 'rgba(255,255,255,0.2)');

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
  }).concat(
    // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js: Öffnungen der gesetzten Gruppen
    oegOeffnungen(b, V),
  );
}
/** Außenkanten aller Öffnungen einer Ansicht als Strecken [u0, v0, u1, v1] (Fang beim Teilen). */
function oeFangKanten(b, V) {
  const R = [];
  oeListe(b, V).forEach((x) =>
    R.push(
      [x.u0, x.v0, x.u1, x.v0],
      [x.u1, x.v0, x.u1, x.v1],
      [x.u1, x.v1, x.u0, x.v1],
      [x.u0, x.v1, x.u0, x.v0],
    ),
  );
  return R;
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
/** Fassadendesigner und Konfigurator nach einer Änderung am Katalog neu zeichnen. */
function oeAktualisieren() {
  FDS.ps = '';
  FDS.dirty = 1;
  try {
    if (FDS.open) fdTick(true);
    okRender();
  } catch (e) {
    logErr(e, 'oeAktualisieren');
  }
}
function oeTypNeu() {
  const v = oeT(FDS.oeT),
    k = 'u' + Date.now().toString(36);
  hist();
  S.oet.push({ ...JSON.parse(JSON.stringify(v)), k, n: v.n + ' (Kopie)' });
  FDS.oeT = k;
  oeAktualisieren();
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
  S.oeg.forEach((G) => (G.oe = G.oe.filter((q) => q.t !== k)));
  if (FDS.oeT === k) FDS.oeT = S.oet[0].k;
  oeAktualisieren();
}

// ---- Eingabe (aus 050-eingabe.js)
/** Pointerdown im Werkzeug „Wählen“ oder „Öffnung“; true = Ereignis verbraucht. */
function oeDown(b, V, p, e) {
  const x = oeTreffer(b, V, p.x, p.z);
  // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js: Gruppen wählen, ziehen, setzen
  if ((x && x.gi) || FDS.tool === 'gr') return oegDown(b, V, p, e, x);
  if (FDS.gi) {
    FDS.gi = null;
    FDS.ps = '';
  }
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
  // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js
  if ((FDS.grZug || FDS.tool === 'gr' || FDS.grVor) && oegMove(b, V, p, e)) return true;
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
  // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js
  if (oegUp()) return true;
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
/** Eine Öffnung in Ansichtsdarstellung: Rahmen, Glas bzw. Paneel, Einteilung, Sprossen (ohne Öffnungssymbole). */
function oeZeichneEine(g, X, Y, u0, u1, v0, T, o) {
  const A = oeAufteilung(T),
    x0 = X(u0),
    x1 = X(u1),
    yb = Y(v0),
    yt = Y(v0 + T.h),
    PX = (x) => X(u0 + x),
    PY = (y) => Y(v0 + y);
  g.save();
  g.globalAlpha = o.alpha || 1;
  g.fillStyle = T.rf;
  A.stege.forEach(([a, c, d, e]) => g.fillRect(PX(a), PY(e), PX(c) - PX(a), PY(d) - PY(e)));
  A.felder.forEach((f) => {
    const fx = PX(f.x0),
      fy = PY(f.y1),
      w = PX(f.x1) - fx,
      hf = PY(f.y0) - fy;
    g.fillStyle = oeFeldFarbe(T, f);
    g.fillRect(fx, fy, w, hf);
    g.strokeStyle = T.rf;
    g.lineWidth = 0.6;
    g.strokeRect(fx, fy, w, hf);
    if (T.a === 'to') {
      const k = Math.max(2, Math.floor(T.h / 0.5));
      g.strokeStyle = '#8f969d';
      g.lineWidth = 1;
      for (let i = 1; i < k; i++) {
        g.beginPath();
        g.moveTo(fx, fy + (hf * i) / k);
        g.lineTo(fx + w, fy + (hf * i) / k);
        g.stroke();
      }
    }
    // Sprossen
    if (f.sr && f.fu === 'g' && (f.sr[0] > 0 || f.sr[1] > 0)) {
      g.strokeStyle = T.rf;
      g.lineWidth = Math.max(1, Math.abs(X(0.025) - X(0)));
      g.beginPath();
      for (let i = 1; i <= f.sr[0]; i++) {
        const y = fy + (hf * i) / (f.sr[0] + 1);
        g.moveTo(fx, y);
        g.lineTo(fx + w, y);
      }
      for (let i = 1; i <= f.sr[1]; i++) {
        const xx = fx + (w * i) / (f.sr[1] + 1);
        g.moveTo(xx, fy);
        g.lineTo(xx, fy + hf);
      }
      g.stroke();
    }
    if (o.feld === f.i) {
      g.strokeStyle = '#1f6fd1';
      g.lineWidth = 2.5;
      g.strokeRect(fx + 1, fy + 1, w - 2, hf - 2);
    }
  });
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
  // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js: Rücksprünge unter den Öffnungen
  oegRueckZeichnen(g, b, V, ox);
  oeListe(b, V).forEach((x) =>
    oeZeichneEine(g, X, Y, x.u0, x.u1, x.v0, x.T, { sel: o.sel && FDS.oe === x.o.id }),
  );
  // ── Erweiterung aus 19-fassadendesigner/097-oeffnungsgruppen.js
  oegZeichnen(g, b, V, ox, o);
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

// ---- Inspektor und Bibliothek (aus 060-kopf.js)
/** Kleines Symbol des Typs für Listen (Einteilung wie in der Ansicht). */
function oeSymbol(T, w = 22, h = 18) {
  const A = oeAufteilung(T),
    k = Math.min(w / T.b, h / T.h),
    ox = (w - T.b * k) / 2,
    X = (x) => ox + x * k,
    Y = (y) => h - y * k;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  A.felder.forEach((f) => {
    s += `<rect x="${X(f.x0)}" y="${Y(f.y1)}" width="${(f.x1 - f.x0) * k}" height="${(f.y1 - f.y0) * k}" fill="${oeFeldFarbe(T, f)}"/>`;
  });
  A.stege.forEach(([a, c, d, e]) => {
    s += `<rect x="${X(a)}" y="${Y(e)}" width="${Math.max(0.8, (c - a) * k)}" height="${Math.max(0.8, (e - d) * k)}" fill="${T.rf}"/>`;
  });
  return s + '</svg>';
}
/** Bibliothek beim Werkzeug „Öffnung“: Typ wählen, dann in die Ansicht klicken. */
function oeBibliothekHtml() {
  if (!FDS.oeT || !S.oet.some((t) => t.k === FDS.oeT)) FDS.oeT = S.oet[0].k;
  const zahl = {};
  S.bld.forEach((x) =>
    Object.values(x.fd || {}).forEach((d) =>
      ((d && d.oe) || []).forEach((o) => (zahl[o.t] = (zahl[o.t] || 0) + 1)),
    ),
  );
  return (
    `<h4>Fenster und Türen</h4>` +
    S.oet
      .map(
        (t) =>
          `<div class="li${FDS.oeT === t.k ? ' on' : ''}" onclick="oeTypWahl('${t.k}')" title="Wählen – dann in die Ansicht klicken (Umschalt: ohne Einrasten)">${oeSymbol(t, 28, 26)}<span>${esc(t.n)}<small>${fdFmt(t.b)} × ${fdFmt(t.h)} m${zahl[t.k] ? ' · ' + zahl[t.k] + '× gesetzt' : ''}</small></span></div>`,
      )
      .join('') +
    `<div class="row"><button class="bt" onclick="okOpen(FDS.oeT,'oe')">Konfigurator …</button></div><div class="mu" style="margin-top:8px">In die Ansicht klicken zum Setzen · <kbd>Esc</kbd> zurück zu „Auswählen“</div>`
  );
}
/** Inspektor der gewählten Öffnung: Typ, Lage, Brüstung, Aktionen. */
function oeInspektorHtml(b, V) {
  const o = oeGewaehlt();
  if (!o) return '';
  const T = oeT(o.t),
    bs = oeGeschossBasis(b, o.v + 0.01);
  return `<h4>Öffnung</h4><div class="li on" style="cursor:default">${oeSymbol(T, 28, 26)}<span>${esc(T.n)}<small>${fdFmt(T.b)} × ${fdFmt(T.h)} m</small></span></div>
<h4>Typ</h4><select style="width:100%" onchange="oeAendern('t',this.value)">${S.oet.map((t) => `<option value="${t.k}" ${t.k === o.t ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select>
<h4>Lage</h4><div class="kv"><span>Abstand links</span>${fdZahl(o.u - T.b / 2 - V.u0, 'm', "oeAendern('x',this.value)", 0.05, 'Abstand vom linken Rand der Ansicht')}<span>Brüstung</span>${fdZahl(o.v - bs, 'm', "oeAendern('br',this.value)", 0.05, 'Abstand vom Fußboden des Geschosses')}</div>
<div class="row"><button class="bt" onclick="oeDuplizieren()">Duplizieren</button><button class="bt" onclick="okOpen('${T.k}','oe')">Typ bearbeiten …</button><button class="bt" onclick="oeLoeschen()">Löschen <kbd>Entf</kbd></button></div>
<div class="mu" style="margin-top:8px">Ziehen zum Verschieben · Pfeiltasten in den Feldern ändern um 5 cm</div>`;
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
    if (isFinite(+o.pp) && +o.pp > 0) o.pp = Math.max(0.02, Math.min(0.2, +o.pp));
    else delete o.pp;
    o.sp = Array.isArray(o.sp)
      ? o.sp.slice(0, 8).map((c) => ({
          w: isFinite(+c.w) && +c.w > 0 ? +c.w : 1,
          oa: OE_OEFFNUNG[c.oa] ? c.oa : 'f',
          an: c.an === 'r' ? 'r' : 'l',
          fu: c.fu === 'p' ? 'p' : 'g',
        }))
      : undefined;
    ['ul'].forEach((k) => (o[k] = isFinite(+o[k]) ? +o[k] : 0));
    o.sr = Array.isArray(o.sr)
      ? [Math.max(0, Math.min(6, +o.sr[0] || 0)), Math.max(0, Math.min(6, +o.sr[1] || 0))]
      : [0, 0];
    if (o.ut && typeof o.ut === 'object') {
      const ut = {};
      Object.keys(o.ut).forEach((k) => {
        const n = oeBaumPruefen(o.ut[k], 0);
        if (n) ut[k] = n;
      });
      o.ut = ut;
    } else delete o.ut;
    return o;
  });
}
