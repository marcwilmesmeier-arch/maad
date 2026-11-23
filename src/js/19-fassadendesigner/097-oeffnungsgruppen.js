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
  // Raster-Fassade 1,80 m: Fenster wachsen mit dem Geschoss, der Sturz bleibt (sz)
  {
    k: 'g5',
    n: 'Raster 1,8 m · Fenster',
    l: 1.8,
    h: 3.1,
    oe: [{ id: 'a', t: 'r3', x: 0.2, v: 0.2 }],
    sz: { an: true },
    // über dem Fenster in Fensterbreite ein nach hinten versetztes Feld bis zur Oberkante (wandert mit dem Sturz)
    xs: [0.2, 1.6],
    ys: [2.65],
    fe: [{ p: [0.9, 2.9], d: 0.08, t: '' }],
  },
  {
    k: 'g6',
    n: 'Raster 1,8 m · Schaufenster EG',
    l: 1.8,
    h: 4,
    oe: [{ id: 'a', t: 'sf', x: 0.15, v: 0 }],
    sz: { an: true },
  },
  {
    k: 'g7',
    n: 'Raster 1,8 m · Eingang EG',
    l: 1.8,
    h: 4,
    oe: [{ id: 'a', t: 'gt', x: 0.35, v: 0 }],
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
  const R = [],
    B = fdStoreys(b);
  (oegDaten(b, V.key) || []).forEach((I) => {
    let G = oegG(I.g);
    if (!G) return;
    const H = oegHoehe(B, I, G);
    G = oegAngepasst(G, I);
    // ── Erweiterung: Pfosten-Riegel und Einsätze (oegElemente), Randprofile halb an Pfosten-Riegel-Nachbarn
    oegElemente(G, H, oegPr(G) ? oegPrRand(b, V, B, I, G, H) : null).forEach((q) => {
      const T = q.T,
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
/**
 * Höhe eines Gruppenverweises: die Gruppe reicht immer über das ganze Geschoss, in dem sie sitzt (B = fdStoreys);
 * G.h ist nur die Höhe, in der sie im Konfigurator gezeichnet ist.
 */
function oegHoehe(B, I, G) {
  const j = B.findIndex((v, k) => k < B.length - 1 && Math.abs(v - I.v) < 0.05);
  return j >= 0 ? B[j + 1] - B[j] : G.h;
}
/**
 * Wirksamer Typ einer Öffnung in einer Gruppe der Höhe H. Mit „Fensterhöhe über festen Sturz“ (G.sz.an) behalten
 * Fenster Brüstung und Sturz (Abstand der Oberkante zur Gruppenoberkante, wie gezeichnet) und werden um H − G.h
 * höher bzw. niedriger; ohne bleibt das Fenster und der Sturz wächst. Türen und Tore bleiben immer.
 */
function oegTyp(G, q, H) {
  const T = oeT(q.t);
  if (!G.sz || !G.sz.an || oeTuer(T) || H == null || Math.abs(H - G.h) < 1e-4) return T;
  const h = Math.max(0.3, T.h + H - G.h);
  return Math.abs(h - T.h) < 1e-4 ? T : { ...T, h };
}
/**
 * Höhenlage in einer Gruppe der Höhe H. Mit festem Sturz wandern Teilungen ab der niedrigsten Fensteroberkante
 * (Sturzbereich) mit der Oberkante, darunter (Brüstung) bleiben sie; ohne Fenster wandert die obere Hälfte mit.
 * Ohne festen Sturz bleiben alle Teilungen, nur die Oberkante wandert (die oberste Feldreihe wächst).
 */
function oegYAbb(G, H) {
  const dH = H - G.h;
  if (Math.abs(dH) < 1e-4) return (y) => y;
  if (!G.sz || !G.sz.an) return (y) => (y >= G.h - 0.004 ? H : y);
  const ok = G.oe.filter((q) => !oeTuer(oeT(q.t))).map((q) => q.v + oeT(q.t).h),
    grenze = ok.length ? Math.min(...ok) - 0.01 : G.h / 2;
  return (y) => (y >= grenze ? y + dH : y);
}
/** Geländerarten für Loggia und Balkon (Feld: ga Art, gh Höhe in m, gc Farbe). */
const OEG_GEL = {
  st: 'Alu-Stabgeländer',
  ho: 'Alu-Relinggeländer',
  gl: 'Glasgeländer',
  pa: 'Alu-Paneel',
  ma: 'Massive Brüstung',
  ke: 'kein Geländer', // z. B. Loggia im Erdgeschoss
};
const OEG_GEL0 = { ga: 'st', gh: 1.0, gc: '#a9aeb3', gm: 'auf' }; // gm Montage: 'auf' aufgesetzt, 'se' seitlich (Balkon)
/** Geländer eines Felds (mit Vorgaben). */
const oegGel = (f) => ({
  ga: OEG_GEL[f && f.ga] ? f.ga : OEG_GEL0.ga,
  gh: f && +f.gh > 0.3 ? +f.gh : OEG_GEL0.gh,
  gc: f && /^#[0-9a-f]{6}$/i.test(f.gc || '') ? f.gc : OEG_GEL0.gc,
  gm: f && f.gm === 'se' ? 'se' : 'auf',
  eg: !!(f && f.eg), // im Erdgeschoss (Feld auf Fußbodenhöhe) ohne Geländer
});
/** Geländer an einer Stelle: im Erdgeschoss auf Fußbodenhöhe (v0 ≈ 0) mit Haken „eg“ kein Geländer. */
const oegGelBei = (f, v0) => {
  const G = oegGel(f);
  return G.eg && v0 < 0.05 ? { ...G, ga: 'ke' } : G;
};
/**
 * Pfosten-Riegel-Fassade (Material der Gruppe G.t = 'pr', Maße in G.pr): die Gruppe ist eine Glasfassade aus Profilen. Auf jeder senkrechten Teilung steht ein
 * Pfosten, auf jeder waagerechten liegt ein Riegel, am Rand umläuft ein Rahmen; verbundene Felder haben keinen Pfosten
 * bzw. Riegel dazwischen. Felder: Füllung pf 'g' Glas (fest), 'p' Paneel, 'e' Einsatz (Fenster oder Tür pe aus dem
 * Katalog, auf die Feldgröße gebracht). Einstellungen: pb Ansichtsbreite, pt Bautiefe der Pfosten, rt der Riegel,
 * rf Profilfarbe. Grenzt die Gruppe links/rechts/oben/unten an eine andere Pfosten-Riegel-Gruppe, ist das Randprofil
 * dort halb so breit (beide zusammen = ein Profil); an der Wand bleibt es voll (oegPrRand). Als eine Öffnung über die ganze Gruppe (Art 'pr') erzeugt: Wandausschnitt, Ansicht, 3D und Grundriss
 * laufen damit über dieselben Wege wie Fenster (oeAufteilung → oegPrAufteilung).
 */
const OEG_PR0 = { pb: 0.06, pt: 0.16, rt: 0.13, rf: '#3b3f44' };
const OEG_PR_FU = { g: 'Glas fest', p: 'Paneel', e: 'Fenster/Tür einsetzen' };
/**
 * Pfosten-Riegel-Einstellungen einer Gruppe (geprüft) oder null. Eingeschaltet über das Material der Gruppe
 * (Fassadentyp 'pr' „Pfosten-Riegel-Fassade“); G.pr hält nur die Maße und die Farbe.
 */
function oegPr(G) {
  if (!G || G.t !== 'pr') return null;
  const p = G.pr || {};
  return {
    an: true,
    pb: Math.max(0.03, Math.min(0.2, +p.pb || OEG_PR0.pb)),
    pt: Math.max(0.05, Math.min(0.4, +p.pt || OEG_PR0.pt)),
    rt: Math.max(0.05, Math.min(0.4, +p.rt || OEG_PR0.rt)),
    rf: /^#[0-9a-f]{6}$/i.test(p.rf || '') ? p.rf : OEG_PR0.rf,
  };
}
/** Einbautiefe der Pfosten-Riegel-Ebene von der Außenseite der Wand (Profile stehen bündig mit der Außenfläche). */
const OEG_PR_ET = 0.0;
/**
 * Länge eines Gruppenverweises: I.l (angepasstes letztes Element einer Pfosten-Riegel-Reihe, damit die Fassade bis
 * zum Ende der Fläche durchläuft), sonst die Länge der Gruppe.
 */
const oegL = (I, G) => (I && I.l > 0.3 && oegPr(G) ? I.l : G.l);
/**
 * Gruppe in der Länge des Verweises: bei angepasster Länge eine Kopie, in der nur die Randfelder länger (bzw. kürzer)
 * sind – I.lv = Änderung am linken Rand (erstes Feld), der Rest bis I.l am rechten (letztes Feld). Raster, Felder und
 * Öffnungen dazwischen bleiben; Teilungen, die dabei aus der Gruppe fallen, entfallen. Sonst die Gruppe selbst.
 */
function oegAngepasst(G, I) {
  const L = oegL(I, G),
    lv = L !== G.l && isFinite(+I.lv) ? +I.lv : 0;
  if (Math.abs(L - G.l) < 1e-4 && !lv) return G;
  const x = (v) => (v < 0.004 ? 0 : v > G.l - 0.004 ? L : v + lv);
  return {
    ...G,
    l: L,
    xs: (G.xs || []).map((v) => v + lv).filter((v) => v > 0.3 && v < L - 0.3),
    fe: (G.fe || []).map((e) => ({ ...e, p: [Math.max(0.01, Math.min(L - 0.01, e.p[0] + lv)), e.p[1]] })),
    vb: (G.vb || []).map((r) => ({ ...r, x0: x(r.x0), x1: x(r.x1) })).filter((r) => r.x1 - r.x0 > 0.3),
    oe: G.oe.map((q) => ({ ...q, x: q.x + lv })),
  };
}
/**
 * Reihe von Gruppen auf [a, c] verteilen (Füllen, Gebäudekonfigurator): folge = Gruppen in Reihenfolge, u0 = linke
 * Kante der ersten, nx = nächste Gruppe im Rhythmus, au = Ausrichtung ('l', 'r', sonst mittig). Pfosten-Riegel soll
 * bis zum Ende der Fläche durchlaufen: die Reihe füllt [a, c], den Rest nehmen die Randfelder auf – links
 * ausgerichtet das letzte Feld rechts, rechts ausgerichtet das erste Feld links, mittig beide je zur Hälfte (länger
 * oder, wenn keine ganze Gruppe passt, kürzer). Ergebnis: [{ G, u, l?, lv? }]
 */
function oegReihe(folge, u0, a, c, nx, au) {
  const R = [];
  if (folge.some((G) => oegPr(G)) || (!folge.length && nx && oegPr(nx))) {
    if (c - a < 0.3) return R;
    const F = folge.length ? folge : [nx],
      rest = c - a - F.reduce((x, G) => x + G.l, 0),
      links = au === 'l' ? 0 : au === 'r' ? rest : rest / 2; // Anteil am linken Rand
    let u = a;
    F.forEach((G, i) => {
      const o = { G, u },
        dl = i === 0 ? links : 0,
        dr = i === F.length - 1 ? rest - links : 0;
      if (Math.abs(dl) > 0.005 || Math.abs(dr) > 0.005) {
        o.l = G.l + dl + dr;
        if (Math.abs(dl) > 0.005) o.lv = dl;
      }
      R.push(o);
      u += o.l || G.l;
    });
    return R;
  }
  let u = u0;
  folge.forEach((G) => {
    R.push({ G, u });
    u += G.l;
  });
  return R;
}
/** Randprofile ohne Nachbarn: überall voll. */
const OEG_PR_RAND = { l: 1, r: 1, o: 1, u: 1 };
/**
 * Randprofile eines Gruppenverweises I (Höhe H) in der Ansicht V: 0,5 an Seiten, an denen eine andere
 * Pfosten-Riegel-Gruppe derselben Ansicht anschließt (links/rechts mit Höhenüberlappung, oben/unten mit
 * Längenüberlappung), sonst 1.
 */
function oegPrRand(b, V, B, I, G, H) {
  const R = { ...OEG_PR_RAND },
    e = 0.02;
  (oegDaten(b, V.key) || []).forEach((J) => {
    const G2 = J !== I && oegG(J.g);
    if (!G2 || !oegPr(G2)) return;
    const H2 = oegHoehe(B, J, G2),
      l1 = oegL(I, G),
      l2 = oegL(J, G2),
      ueH = Math.min(I.v + H, J.v + H2) - Math.max(I.v, J.v) > 0.05,
      ueL = Math.min(I.u + l1, J.u + l2) - Math.max(I.u, J.u) > 0.05;
    if (ueH && Math.abs(J.u + l2 - I.u) < e) R.l = 0.5;
    if (ueH && Math.abs(I.u + l1 - J.u) < e) R.r = 0.5;
    if (ueL && Math.abs(J.v - (I.v + H)) < 0.05) R.o = 0.5;
    if (ueL && Math.abs(J.v + H2 - I.v) < 0.05) R.u = 0.5;
  });
  return R;
}
/** Öffnungstyp „Pfosten-Riegel“ einer Gruppe in der Höhe H (b = Gruppenlänge, rd Randprofile). */
function oegPrTyp(G, H, rd) {
  const P = oegPr(G);
  return {
    k: 'pr:' + G.k,
    n: 'Pfosten-Riegel',
    a: 'pr',
    b: G.l,
    h: H,
    br: 0,
    rf: P.rf,
    pb: P.pb,
    pp: P.pb,
    pt: P.pt,
    et: OEG_PR_ET,
    _g: G,
    _rd: rd || OEG_PR_RAND,
  };
}
/**
 * Felder der Pfosten-Riegel-Fassade in der Höhe H: Zelle (Achsmaß) und Glasfeld (Lichtmaß zwischen den Profilen).
 * Außen Rahmen pb (an Pfosten-Riegel-Nachbarn halb, rd), innen je Seite pb/2.
 */
function oegPrFelder(G, H, rd) {
  const P = oegPr(G),
    Y = oegYAbb(G, H),
    h2 = P.pb / 2,
    r = rd || OEG_PR_RAND;
  return oegZellen(G).map((z) => {
    const y0 = Y(z.y0),
      y1 = Y(z.y1);
    return {
      z,
      x0: z.x0 + (z.x0 < 0.004 ? P.pb * r.l : h2),
      x1: z.x1 - (z.x1 > G.l - 0.004 ? P.pb * r.r : h2),
      y0: y0 + (z.y0 < 0.004 ? P.pb * r.u : h2),
      y1: y1 - (z.y1 > G.h - 0.004 ? P.pb * r.o : h2),
      pf: z.pf || 'g',
      pe: z.pe || '',
    };
  });
}
/**
 * Einteilung des Typs „Pfosten-Riegel“ (wie oeAufteilung): Rahmen, Pfosten, Riegel (5. Wert: Tiefe relativ zur
 * Pfostentiefe) und Felder. Randprofile nach T._rd (halb an Pfosten-Riegel-Nachbarn).
 */
function oegPrAufteilung(T) {
  // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: Band in Attikahöhe über dem Element (oeAttikaBand)
  if (T._att) return oegPrAttika(T);
  const G = T._g,
    P = oegPr(G),
    r = T._rd || OEG_PR_RAND,
    b = T.b,
    h = T.h,
    pb = P.pb,
    kr = P.rt / P.pt,
    Y = oegYAbb(G, h),
    stege = [
      [0, pb * r.l, 0, h],
      [b - pb * r.r, b, 0, h],
      [pb * r.l, b - pb * r.r, h - pb * r.o, h, kr],
      [pb * r.l, b - pb * r.r, 0, pb * r.u, kr],
    ];
  // je Feld die rechte (Pfosten) und obere (Riegel) Kante, sofern innen
  oegZellen(G).forEach((z) => {
    const y0 = Y(z.y0),
      y1 = Y(z.y1);
    if (z.x1 < G.l - 0.004) stege.push([z.x1 - pb / 2, z.x1 + pb / 2, y0, y1]);
    if (z.y1 < G.h - 0.004) stege.push([z.x0, z.x1, y1 - pb / 2, y1 + pb / 2, kr]);
  });
  const felder = oegPrFelder(G, h, r)
    .filter((f) => f.x1 - f.x0 > 0.01 && f.y1 - f.y0 > 0.01)
    .map((f, i) => ({
      x0: f.x0,
      x1: f.x1,
      y0: f.y0,
      y1: f.y1,
      oa: 'f',
      an: 'l',
      // Einsatz: das Feld bleibt leer, Fenster/Tür sitzt darin (oegElemente)
      fu: f.pf === 'p' ? 'p' : f.pf === 'e' && f.pe ? 'l' : 'g',
      i,
    }));
  // Ende am Eckpfosten (T._ek, aus oeEckenFinden): Profile, Glas und Paneele vor dem Eckpfosten abschneiden
  const ek = T._ek;
  if (ek && (ek.l || ek.r)) {
    const xa = ek.l || 0,
      xb = b - (ek.r || 0),
      k = (v) => Math.max(xa, Math.min(xb, v));
    const st = stege.map(([a, c, d, e, kk]) => [k(a), k(c), d, e, kk]).filter((q) => q[1] - q[0] > 1e-4),
      fe = felder.map((f) => ({ ...f, x0: k(f.x0), x1: k(f.x1) })).filter((f) => f.x1 - f.x0 > 0.01);
    return { pb, pp: pb, stege: st, felder: fe, oben: fe, ns: [] };
  }
  return { pb, pp: pb, stege, felder, oben: felder, ns: [] };
}
/**
 * Einteilung des Attikabands über einer Pfosten-Riegel-Fassade (T._att = Höhe, T._hU = Höhe des Elements darunter):
 * die Pfosten, die oben am Element ankommen, laufen durch, dazwischen Paneele, oben ein Abschlussriegel.
 */
function oegPrAttika(T) {
  const U = oegPrAufteilung(Object.assign({}, T, { _att: 0, h: T._hU })),
    hU = T._hU,
    h = T._att,
    pb = U.pb,
    P = oegPr(T._g),
    kr = P.rt / P.pt,
    // senkrechte Stege, die bis zur Oberkante reichen (Rand- und Zwischenpfosten)
    po = U.stege
      .filter(([a, c, d, e]) => e >= hU - 0.004 && e - d > c - a + 0.01 && e - d > 0.3)
      .map(([a, c]) => [a, c])
      .sort((p, q) => p[0] - q[0]);
  // nur über einem Teil (Terrasse endet im Element, T._attX): Pfosten in dem Bereich, am offenen Ende ein Randprofil
  const X = T._attX;
  if (X) {
    const drin = po.filter(([a, c]) => (a + c) / 2 >= X[0] - 0.01 && (a + c) / 2 <= X[1] + 0.01);
    if (!drin.length || drin[0][0] > X[0] + pb) drin.unshift([X[0], X[0] + pb]);
    if (drin[drin.length - 1][1] < X[1] - pb) drin.push([X[1] - pb, X[1]]);
    po.length = 0;
    po.push(...drin);
  }
  if (!po.length) return { pb, pp: pb, stege: [], felder: [], oben: [], ns: [] };
  const x0 = po[0][0],
    x1 = po[po.length - 1][1],
    stege = po.map(([a, c]) => [a, c, 0, h]).concat([[x0, x1, h - pb, h, kr]]),
    felder = [];
  for (let i = 0; i < po.length - 1; i++)
    if (po[i + 1][0] - po[i][1] > 0.01)
      felder.push({ x0: po[i][1], x1: po[i + 1][0], y0: 0, y1: h - pb, oa: 'f', an: 'l', fu: 'p', i });
  return { pb, pp: pb, stege, felder, oben: felder, ns: [] };
}
/**
 * Alle Elemente einer Gruppe in der Höhe H in Gruppenkoordinaten: { id, x, v, T } – Pfosten-Riegel (über die ganze
 * Gruppe), Einsätze in seinen Feldern und die gezeichneten Öffnungen. rd: Randprofile (oegPrRand), ohne = voll.
 */
function oegElemente(G, H, rd) {
  const R = [];
  if (oegPr(G)) {
    const T = oegPrTyp(G, H, rd);
    R.push({ id: 'pr', t: T.k, x: 0, v: 0, T });
    oegPrFelder(G, H, rd).forEach((f, i) => {
      if (f.pf !== 'e' || !f.pe || !S.oet.some((t) => t.k === f.pe)) return;
      const T0 = oeT(f.pe),
        b = f.x1 - f.x0,
        hh = f.y1 - f.y0;
      if (b < 0.2 || hh < 0.2) return;
      // Fenster/Tür füllt das Feld; Rahmen mittig in der Profiltiefe
      R.push({
        id: 'pe' + i,
        t: f.pe,
        x: f.x0,
        v: f.y0,
        T: { ...T0, b, h: hh, et: OEG_PR_ET }, // Rahmen in der Glasebene (OE_PR_LAGE)
      });
    });
  }
  G.oe.forEach((q) => R.push({ id: q.id, t: q.t, x: q.x, v: q.v, T: oegTyp(G, q, H) }));
  return R;
}
/** Verbundene Felder der Gruppe (geprüft). */
function oegVerbunden(G) {
  return (Array.isArray(G.vb) ? G.vb : []).filter(
    (r) =>
      r && isFinite(r.x0) && isFinite(r.x1) && isFinite(r.y0) && isFinite(r.y1) && r.x1 > r.x0 && r.y1 > r.y0,
  );
}
/** Teilungen einer Gruppe (sortiert, mit Rändern). */
function oegTeilung(G) {
  const r = (L, m) =>
    [0, m, ...(L || []).filter((x) => x > 0.005 && x < m - 0.005)]
      .sort((a, c) => a - c)
      .filter((x, i, A) => !i || x - A[i - 1] > 0.005);
  return { xs: r(G.xs, G.l), ys: r(G.ys, G.h) };
}
/**
 * Felder der Gruppe (Raster aus den Teilungen) mit Tiefe d und Material t (eigenes, sonst das der Gruppe).
 * Verbundene Felder (G.vb: Rechtecke, deren Ränder auf Teilungslinien liegen) sind ein Feld – dort ist die Teilung
 * feldweise entfernt.
 */
function oegZellen(G) {
  const { xs, ys } = oegTeilung(G),
    Z0 = [];
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++)
      Z0.push({ i, j, x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], d: 0, k: 'g', t: '' });
  const auf = (v, L) => L.some((x) => Math.abs(x - v) < 0.004),
    Z = [];
  oegVerbunden(G).forEach((r) => {
    if (![r.x0, r.x1].every((v) => auf(v, xs)) || ![r.y0, r.y1].every((v) => auf(v, ys))) return;
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
    Z.push({
      i: drin[0].i,
      j: drin[0].j,
      x0: r.x0,
      x1: r.x1,
      y0: r.y0,
      y1: r.y1,
      d: 0,
      k: 'g',
      t: '',
      vb: 1,
    });
  });
  Z0.forEach((z) => !z.weg && Z.push(z));
  (G.fe || []).forEach((f) => {
    const z = Z.find((c) => f.p[0] > c.x0 && f.p[0] < c.x1 && f.p[1] > c.y0 && f.p[1] < c.y1);
    if (z) {
      z.d = f.d || 0;
      z.k = f.k === 'l' || f.k === 'r' ? f.k : 'g';
      z.t = f.t || '';
      z.a = ['lo', 'ba', 'bl'].includes(f.a) ? f.a : ''; // Art: Loggia, Balkon, Balkon + Loggia (sonst Fläche)
      if (z.a === 'bl') z.tb = +f.tb > 0 ? +f.tb : 1.2; // Auskragung der Balkonplatte
      if (z.a) Object.assign(z, oegGel(f)); // Geländer
      if (OEG_PR_FU[f.pf]) z.pf = f.pf; // Pfosten-Riegel: Füllung und Einsatz
      if (f.pe) z.pe = String(f.pe);
    }
  });
  return Z;
}
/**
 * Flächen der Gruppe mit Tiefe oder Material als zusammengefasste Rechtecke (gleiche Tiefe und gleiches Material
 * nebeneinander/übereinander werden zu einem Rechteck – keine Seitenflächen zwischen ihnen).
 */
function oegFlaechenG(G) {
  // Pfosten-Riegel: die Felder sind Glas/Paneel in einer Ebene – keine Wandflächen, Rück- oder Vorsprünge
  if (oegPr(G)) return [];
  const Z = oegZellen(G).map((z) => ({ ...z, t: z.t || G.t || '' })),
    key = (z) =>
      z.d +
      '|' +
      (z.d ? z.k : 'g') +
      '|' +
      z.t +
      '|' +
      (z.a || '') +
      (z.a ? '|' + z.ga + z.gh + z.gc + z.gm + z.eg + (z.tb || '') : ''),
    zeilen = [];
  // waagerecht zusammenfassen
  const nj = Math.max(-1, ...Z.map((z) => z.j)) + 1;
  for (let j = 0; j < nj; j++) {
    const Zj = Z.filter((z) => z.j === j).sort((a, c) => a.i - c.i);
    let cur = null;
    Zj.forEach((z) => {
      if (cur && key(cur) === key(z) && Math.abs(cur.x1 - z.x0) < 1e-6) cur.x1 = z.x1;
      else {
        cur = {
          x0: z.x0,
          x1: z.x1,
          y0: z.y0,
          y1: z.y1,
          d: z.d,
          k: z.d ? z.k : 'g',
          t: z.t,
          a: z.a || '',
          ga: z.ga,
          gh: z.gh,
          gc: z.gc,
          gm: z.gm,
          eg: z.eg,
          tb: z.tb,
        };
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
  // Balkon: Tiefe ist die Auskragung vor der Wand (kein Rücksprung, Wand bleibt bündig)
  R.forEach((r) => {
    if (r.a === 'ba') r.dl = r.dr = 0;
  });
  return R.filter((r) => r.d || r.t || r.a);
}
/** Flächen aller Gruppenverweise einer Ansicht (Tiefe und/oder Material): { u0, u1, v0, v1, d, t, id, gi }. */
function oegFlaechen(b, V) {
  const R = [];
  const B = fdStoreys(b);
  (oegDaten(b, V.key) || []).forEach((I) => {
    const G = oegG(I.g);
    if (!G) return;
    const Y = oegYAbb(G, oegHoehe(B, I, G));
    oegFlaechenG(G).forEach((r, k) =>
      R.push({
        u0: I.u + r.x0,
        u1: I.u + r.x1,
        v0: I.v + Y(r.y0),
        v1: I.v + Y(r.y1),
        d: r.a === 'ba' ? 0 : r.d,
        dl: r.dl,
        dr: r.dr,
        t: r.t,
        a: r.a || '',
        tb: r.a === 'ba' ? Math.abs(r.d) || 1.5 : r.a === 'bl' ? r.tb || 1.2 : 0, // Auskragung des Balkons
        ga: r.ga,
        gh: r.gh,
        gc: r.gc,
        gm: r.gm,
        eg: r.eg,
        id: I.id + ':f' + k,
        gi: I,
      }),
    );
  });
  // ── Erweiterung: Fassadenfelder mit Tiefe/Art ohne Gruppe (fdFeldFlaechen)
  fdFeldFlaechen(b, V).forEach((x) => R.push(x));
  return R;
}
/** Eigenschaften eines Fassadenfelds für Tiefe und Art (ohne Gruppe). */
const FD_FE = ['d', 'k', 'a', 'ga', 'gh', 'gc', 'gm', 'eg', 'tb'];
/**
 * Fassadenfelder mit Tiefe oder Art (Rücksprung, Vorsprung, Loggia, Balkon, Balkon + Loggia direkt an der Fassade,
 * ohne Gruppe) als Flächen wie oegFlaechen (umschließendes Rechteck des Felds).
 */
function fdFeldFlaechen(b, V) {
  const R = [];
  fdFaces(b, V).forEach((f) => {
    const e = f.fe;
    if (!e || (!e.d && !e.a)) return;
    const us = f.o.map((p) => p[0]),
      vs = f.o.map((p) => p[1]),
      a = ['lo', 'ba', 'bl'].includes(e.a) ? e.a : '',
      d = +e.d || 0,
      k = e.k === 'l' || e.k === 'r' ? e.k : 'g';
    R.push({
      u0: Math.min(...us),
      u1: Math.max(...us),
      v0: Math.min(...vs),
      v1: Math.max(...vs),
      d: a === 'ba' ? 0 : d,
      dl: a === 'ba' ? 0 : k === 'r' ? 0 : d,
      dr: a === 'ba' ? 0 : k === 'l' ? 0 : d,
      t: '',
      a,
      tb: a === 'ba' ? Math.abs(d) || 1.5 : a === 'bl' ? +e.tb || 1.2 : 0,
      ...(a ? oegGel(e) : {}),
      id: 'ff:' + V.key + ':' + f.idx,
      gi: null,
    });
  });
  return R;
}
/** Rücksprünge und Vorsprünge (Flächen mit Tiefe) aller Gruppenverweise einer Ansicht. */
function oegRuecksprunge(b, V) {
  return oegFlaechen(b, V).filter((r) => r.d);
}
/** Rücksprung in der Ansicht zeichnen: zurückspringend dunkler, vorspringend heller, Schattenkante oben/links. */
function oegRueckZeichneEins(g, X, Y, u0, u1, v0, v1, d, an, farbe, k, art, gel) {
  const x0 = X(u0),
    x1 = X(u1),
    y0 = Y(v1),
    y1 = Y(v0);
  g.save();
  if (farbe) {
    g.fillStyle = farbe;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // Balkon/Loggia: Geländer (und Balkonplatte) als Ansichtssymbol
  if (art) oegArtZeichnen(g, X, Y, u0, u1, v0, art, gel);
  if (!d || art === 'ba') {
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
/** Ansichtssymbol für Balkon (Platte und Geländer vor der Wand) bzw. Loggia (Geländer in der Öffnung) – je Geländerart. */
function oegArtZeichnen(g, X, Y, u0, u1, v0, art, gel) {
  const G = oegGelBei(gel, v0),
    x0 = X(u0),
    x1 = X(u1),
    yb = Y(v0),
    yh = Y(v0 + G.gh),
    n = Math.max(2, Math.round((u1 - u0) / 0.24));
  g.save();
  g.strokeStyle = '#475569';
  g.lineWidth = 1;
  if (G.ga === 'ke') {
    // ohne Geländer: nur die Balkonplatte
    if (art === 'ba' || art === 'bl') {
      g.fillStyle = '#94a3b8';
      g.fillRect(x0 - 2, yb, x1 - x0 + 4, Math.max(3, Y(v0 - 0.2) - yb));
    }
    g.restore();
    return;
  }
  if (G.ga === 'gl') {
    g.fillStyle = 'rgba(160,190,205,.35)';
    g.fillRect(x0, yh, x1 - x0, yb - yh);
  } else if (G.ga === 'ma' || G.ga === 'pa') {
    g.fillStyle = G.ga === 'ma' ? '#e7e5e1' : G.gc;
    g.fillRect(x0, yh, x1 - x0, yb - yh);
    g.strokeRect(x0, yh, x1 - x0, yb - yh);
  } else {
    g.beginPath();
    if (G.ga === 'ho') {
      // Relinggeländer: Pfosten an den Enden, waagerechte Stäbe
      [x0, x1].forEach((x) => {
        g.moveTo(x, yb);
        g.lineTo(x, yh);
      });
      for (let i = 1; i < 5; i++) {
        const y = yb + ((yh - yb) * i) / 5;
        g.moveTo(x0, y);
        g.lineTo(x1, y);
      }
    } else
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        g.moveTo(x, yb);
        g.lineTo(x, yh);
      }
    g.stroke();
  }
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, yh);
  g.lineTo(x1, yh);
  g.stroke();
  if (art === 'ba' || art === 'bl') {
    // Balkonplatte (0,20 m) unter dem Geländer
    g.fillStyle = '#94a3b8';
    g.fillRect(x0 - 2, yb, x1 - x0 + 4, Math.max(3, Y(v0 - 0.2) - yb));
  }
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
      r.a,
      r,
    ),
  );
}
/** Gruppenverweis unter dem Punkt (Rechteck der Gruppe). */
function oegTreffer(b, V, u, v) {
  const L = oegDaten(b, V.key) || [],
    B = fdStoreys(b);
  for (let i = L.length - 1; i >= 0; i--) {
    const I = L[i],
      G = oegG(I.g);
    if (G && u >= I.u && u <= I.u + oegL(I, G) && v >= I.v && v <= I.v + oegHoehe(B, I, G)) return I;
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
      [I.u + oegL(I, H), I.u - G.l].forEach((k) => {
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
        if (!k && !oegPr(G)) continue;
        // bisherige Gruppen in diesem Bereich ersetzen
        for (let i = L.length - 1; i >= 0; i--) {
          const H = oegG(L[i].g),
            m = L[i].u + (H ? oegL(L[i], H) : 0) / 2;
          if (Math.abs(L[i].v - v0) < 0.01 && m >= a && m <= c) L.splice(i, 1);
        }
        const au = oegAusr(b, V),
          rest = c - a - k * G.l,
          s = au === 'l' ? a : au === 'r' ? a + rest : a + rest / 2;
        // Pfosten-Riegel: bis zu den Enden der Fläche, Randfelder je nach Ausrichtung angepasst (oegReihe)
        oegReihe(Array(k).fill(G), s, a, c, G, au).forEach((o) =>
          L.push({ id: oegNeuId(), g: o.G.k, u: o.u, v: v0, ...(o.l ? { l: o.l, lv: o.lv || 0 } : {}) }),
        );
        n += Math.max(k, oegPr(G) ? 1 : 0);
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
    // H: Höhe des Rahmens (Geschosshöhe am Verweis, in der Vorschau die gezeichnete Höhe)
    rahmen = (u, v, G, an, alpha, H = G.h) => {
      g.save();
      g.globalAlpha = alpha || 1;
      g.strokeStyle = an ? '#1f6fd1' : '#5E7F92';
      g.lineWidth = an ? 2.2 : 1;
      g.setLineDash(an ? [] : [5, 4]);
      g.strokeRect(X(u), Y(v + H), X(u + G.l) - X(u), Y(v) - Y(v + H));
      g.setLineDash([]);
      const w = X(u + G.l) - X(u);
      if (w > 60) {
        g.fillStyle = an ? '#1f6fd1' : '#5E7F92';
        g.font = '10px system-ui,sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'top';
        let t = G.n;
        while (t.length > 3 && g.measureText(t).width > w - 8) t = t.slice(0, -1);
        g.fillText(t, X(u) + 4, Y(v + H) + 3);
      }
      g.restore();
    };
  // Rahmen nur beim Werkzeug „Gruppe“ oder mit gewählter Gruppe (sonst ruhige Ansicht)
  if (FDS.tool === 'gr' || FDS.gi) {
    const B = fdStoreys(b);
    (oegDaten(b, V.key) || []).forEach((I) => {
      const G = oegG(I.g);
      if (G)
        rahmen(I.u, I.v, oegAngepasst(G, I), o.sel !== undefined && FDS.gi === I.id, 1, oegHoehe(B, I, G));
    });
  }
  const p = FDS.grVor;
  if (p && FDS.tool === 'gr' && !FDS.grZug && o.sel !== undefined && !ox) {
    rahmen(p.u, p.v, p.G, true, 0.7);
    oegElemente(p.G, p.G.h).forEach((q) => {
      const T = q.T;
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
  // Öffnungen mit Einteilung (Rahmen, Pfosten, Riegel – wie in der Ansicht, Mindeststärke 0,6 px)
  oegElemente(G, G.h).forEach((q) => {
    const T = q.T,
      x0 = ox + q.x * k,
      y0 = oy - (q.v + T.h) * k;
    s += `<rect x="${x0}" y="${y0}" width="${T.b * k}" height="${T.h * k}" fill="${oeTuer(T) ? '#b9a891' : T.a === 'pr' ? '#dce8ee' : '#fff'}"/>`;
    try {
      const A = oeAufteilung(T);
      // Paneele (Pfosten-Riegel)
      A.felder.forEach((f) => {
        if (f.fu === 'p')
          s += `<rect x="${x0 + f.x0 * k}" y="${y0 + (T.h - f.y1) * k}" width="${(f.x1 - f.x0) * k}" height="${(f.y1 - f.y0) * k}" fill="${T.rf}" opacity=".75"/>`;
      });
      A.stege.forEach(([a, c, d, e]) => {
        s += `<rect x="${x0 + a * k}" y="${y0 + (T.h - e) * k}" width="${Math.max(0.6, (c - a) * k)}" height="${Math.max(0.6, (e - d) * k)}" fill="${T.rf}"/>`;
      });
    } catch (e) {
      logErr(e, 'oegSymbol');
      s += `<rect x="${x0}" y="${y0}" width="${T.b * k}" height="${T.h * k}" fill="none" stroke="${T.rf}" stroke-width="1"/>`;
    }
  });
  // Loggia/Balkon: Geländer (je Art) und Balkonplatte
  oegFlaechenG(G).forEach((r) => {
    if (!r.a) return;
    const Gl = oegGel(r),
      x0 = ox + r.x0 * k,
      x1 = ox + r.x1 * k,
      yb = oy - r.y0 * k,
      yh = oy - (r.y0 + Gl.gh) * k,
      lw = 0.7;
    if (r.a === 'ba' || r.a === 'bl')
      s += `<rect x="${x0 - 1}" y="${yb}" width="${x1 - x0 + 2}" height="${Math.max(1.2, 0.2 * k)}" fill="#94a3b8"/>`;
    if (Gl.ga === 'ke') return;
    if (Gl.ga === 'gl')
      s += `<rect x="${x0}" y="${yh}" width="${x1 - x0}" height="${yb - yh}" fill="rgba(150,185,205,.45)"/>`;
    else if (Gl.ga === 'ma' || Gl.ga === 'pa')
      s += `<rect x="${x0}" y="${yh}" width="${x1 - x0}" height="${yb - yh}" fill="${Gl.ga === 'ma' ? '#e7e5e1' : Gl.gc}" stroke="#64748b" stroke-width=".5"/>`;
    else if (Gl.ga === 'ho')
      for (let i = 1; i < 4; i++) {
        const y = yb + ((yh - yb) * i) / 4;
        s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${Gl.gc}" stroke-width="${lw}"/>`;
      }
    else {
      const n = Math.max(2, Math.round((x1 - x0) / 2.2));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        s += `<line x1="${x}" y1="${yb}" x2="${x}" y2="${yh}" stroke="${Gl.gc}" stroke-width="${lw}"/>`;
      }
    }
    s += `<line x1="${x0}" y1="${yh}" x2="${x1}" y2="${yh}" stroke="${Gl.gc}" stroke-width="1.1"/>`;
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
              `<div class="li${FDS.grT === G.k ? ' on' : ''}" onclick="oegWahl('${G.k}')" title="Wählen – dann in die Ansicht klicken (Umschalt: ohne Einrasten)">${oegSymbol(G, 48, 26)}<span>${esc(G.n)}<small>${fdFmt(G.l)} m · ${oegPr(G) ? 'Pfosten-Riegel' : G.oe.length + ' Öffnung' + (G.oe.length === 1 ? '' : 'en')}${zahl[G.k] ? ' · ' + zahl[G.k] + '× gesetzt' : ''}</small></span></div>`,
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
<div class="row"><button class="bt" onclick="oegAufloesen()" title="Öffnungen und Felder dieser Gruppe an dieser Stelle frei bearbeitbar machen (die Gruppe bleibt in der Bibliothek)">Gruppe hier auflösen</button></div>
<div class="mu" style="margin-top:8px">Ziehen zum Verschieben · Änderungen an der Gruppe gelten an allen Stellen</div>`;
}
/** Gespeicherte Gruppen prüfen (Projekt laden). */
function oegPruefen(L) {
  return L.filter((G) => G && G.k).map((G) => ({
    k: String(G.k),
    // Änderungszeitpunkt (Bibliothek: beim Öffnen eines Projekts gilt die jüngere Fassung)
    ...(+G.zt > 0 ? { zt: +G.zt } : {}),
    n: String(G.n || 'Gruppe').slice(0, 60),
    l: Math.max(0.5, Math.min(40, +G.l || 6)),
    h: Math.max(1, Math.min(10, +G.h || 3)),
    oe: (Array.isArray(G.oe) ? G.oe : [])
      .filter((q) => q && q.t)
      .map((q, i) => ({ id: String(q.id || 'o' + i), t: String(q.t), x: +q.x || 0, v: +q.v || 0 })),
    // früher: Schalter G.pr.an statt Material 'pr'
    t: G.pr && G.pr.an ? 'pr' : S.ft.some((x) => x.k === G.t) ? G.t : '',
    sz: G.sz ? { an: !!G.sz.an } : undefined,
    pr: G.pr
      ? {
          pb: +G.pr.pb || OEG_PR0.pb,
          pt: +G.pr.pt || OEG_PR0.pt,
          rt: +G.pr.rt || (+G.pr.pt ? +G.pr.pt * 0.8 : OEG_PR0.rt),
          rf: G.pr.rf || OEG_PR0.rf,
        }
      : undefined,
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
        d: Math.max(-3, Math.min(3, +f.d || 0)),
        k: f.k === 'l' || f.k === 'r' ? f.k : 'g',
        t: String(f.t || ''),
        a: ['lo', 'ba', 'bl'].includes(f.a) ? f.a : '',
        ...(['lo', 'ba', 'bl'].includes(f.a) ? oegGel(f) : {}),
        ...(f.a === 'bl' ? { tb: Math.max(0.2, Math.min(3, +f.tb || 1.2)) } : {}),
        ...(OEG_PR_FU[f.pf] ? { pf: f.pf } : {}),
        ...(f.pe ? { pe: String(f.pe) } : {}),
      }));
  (Array.isArray(G.rs) ? G.rs : []).forEach((r) => {
    if (!r || !(+r.b > 0) || !(+r.h > 0)) return;
    xs.push(+r.x, +r.x + +r.b);
    ys.push(+r.v, +r.v + +r.h);
    fe.push({ p: [+r.x + r.b / 2, +r.v + r.h / 2], d: Math.max(-3, Math.min(3, +r.d || 0)), t: '' });
  });
  const vb = (Array.isArray(G.vb) ? G.vb : [])
    .map((r) => ({ x0: +r.x0, x1: +r.x1, y0: +r.y0, y1: +r.y1 }))
    .filter((r) => [r.x0, r.x1, r.y0, r.y1].every((v) => isFinite(v)) && r.x1 > r.x0 && r.y1 > r.y0);
  return { xs, ys, fe, vb };
}

// ---- Fassadenfelder ohne Gruppe: Tiefe, Art und Geländer wie bei Gruppenfeldern (Inspektor im Fassadendesigner)
/** Einstellungen der gewählten Felder (S_: Flächen aus fdFaces). */
function fdFeldHtml(S_) {
  const E = S_.map((f) => f.fe || {}),
    alle = (fn) => E.every(fn),
    a0 = E[0].a || '',
    gleichA = alle((e) => (e.a || '') === a0),
    d0 = +E[0].d || 0,
    gleichD = alle((e) => (+e.d || 0) === d0),
    G0 = oegGel(E[0]),
    gl = (k) => alle((e) => oegGel(e)[k] === G0[k]);
  let h = `<h4>Tiefe und Art</h4><div class="kv sche" style="display:grid;gap:6px;margin:0;padding:0;background:none">
<label>Art<select onchange="fdFeldSet('a',this.value)">${[
    ['', 'Fläche'],
    ['lo', 'Loggia'],
    ['ba', 'Balkon'],
    ['bl', 'Balkon + Loggia'],
  ]
    .map(([k, n]) => `<option value="${k}" ${gleichA && a0 === k ? 'selected' : ''}>${n}</option>`)
    .join('')}${gleichA ? '' : '<option selected>gemischt</option>'}</select></label>
<label>${gleichA && a0 === 'ba' ? 'Auskragung' : gleichA && a0 === 'bl' ? 'Rücksprung Loggia' : 'Tiefe'} (cm)<input type="number" step="1" value="${gleichD ? Math.round(d0 * 1000) / 10 : ''}" placeholder="gemischt" onchange="fdFeldSet('d',this.value)" title="Positiv = Rücksprung, negativ = Vorsprung, 0 = bündig"></label>`;
  if (gleichA && a0 === 'bl')
    h += `<label>Auskragung Balkon (cm)<input type="number" step="1" value="${Math.round((+E[0].tb || 1.2) * 100)}" onchange="fdFeldSet('tb',this.value)"></label>`;
  if (gleichA && a0)
    h += `<label>Geländer<select onchange="fdFeldSet('ga',this.value)">${Object.entries(OEG_GEL)
      .map(([k, n]) => `<option value="${k}" ${gl('ga') && G0.ga === k ? 'selected' : ''}>${n}</option>`)
      .join(
        '',
      )}</select></label><label>Geländerhöhe (cm)<input type="number" step="5" min="50" max="200" value="${gl('gh') ? Math.round(G0.gh * 100) : ''}" onchange="fdFeldSet('gh',this.value)"></label><label>Geländerfarbe<input type="color" value="${G0.gc}" onchange="fdFeldSet('gc',this.value)"></label>${
      a0 === 'ba' || a0 === 'bl'
        ? `<label>Montage<select onchange="fdFeldSet('gm',this.value)"><option value="auf" ${G0.gm !== 'se' ? 'selected' : ''}>aufgesetzt</option><option value="se" ${G0.gm === 'se' ? 'selected' : ''}>seitlich</option></select></label>`
        : ''
    }<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" ${G0.eg ? 'checked' : ''} onchange="fdFeldSet('eg',this.checked)">im Erdgeschoss ohne Geländer</label>`;
  if (!gleichA || !a0)
    h += `<label>Verlauf<select onchange="fdFeldSet('k',this.value)">${[
      ['g', 'gleichmäßig'],
      ['l', 'schräg – links tief'],
      ['r', 'schräg – rechts tief'],
    ]
      .map(
        ([k, n]) => `<option value="${k}" ${alle((e) => (e.k || 'g') === k) ? 'selected' : ''}>${n}</option>`,
      )
      .join('')}</select></label>`;
  return (
    h +
    `</div><div class="row"><button class="bt" onclick="fdFeldSet('dd',-5)">5 cm vor</button><button class="bt" onclick="fdFeldSet('d',0)">bündig</button><button class="bt" onclick="fdFeldSet('dd',5)">5 cm zurück</button></div>`
  );
}
/** Gewählte Felder ändern (wie okGrFeldSet bei Gruppen): a Art, d Tiefe (cm), tb Auskragung (cm), Geländer, k Verlauf. */
function fdFeldSet(f, v) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  const pts = fdSelFaces().map((x) => [x.c[0], x.c[1]]);
  if (!pts.length) return;
  const zahl = (x) => +String(x).replace(',', '.');
  fdEdit((b) => {
    const V = fdCurV();
    pts.forEach((p) => {
      const fc = fdFaces(b, V).find((q) => grInFace(q, p[0], p[1]));
      if (!fc) return;
      const e = { ...(fc.fe || {}) };
      if (f === 'a') {
        e.a = ['lo', 'ba', 'bl'].includes(v) ? v : '';
        // Vorgaben wie bei Gruppen: Loggia/Balkon 1,50 m, Balkon + Loggia 0,60 m Rücksprung und 1,20 m Auskragung
        if (e.a === 'bl') {
          e.d = Math.abs(e.d) > 0.05 && Math.abs(e.d) < 1.5 ? Math.abs(e.d) : 0.6;
          if (!(e.tb > 0.05)) e.tb = 1.2;
        } else if (e.a && !(Math.abs(e.d) > 0.05)) e.d = 1.5;
        if (e.a) e.d = Math.abs(e.d);
        if (!e.a && f === 'a') delete e.a;
      }
      if (f === 'd' && isFinite(zahl(v))) {
        e.d = Math.max(-300, Math.min(300, zahl(v))) / 100;
        if (e.a) e.d = Math.abs(e.d);
      }
      if (f === 'dd') e.d = Math.round(((+e.d || 0) + v / 100) * 1000) / 1000; // schrittweise vor/zurück
      if (f === 'tb' && isFinite(zahl(v))) e.tb = Math.max(20, Math.min(300, Math.abs(zahl(v)))) / 100;
      if (f === 'ga' && OEG_GEL[v]) e.ga = v;
      if (f === 'gh' && isFinite(zahl(v))) e.gh = Math.max(50, Math.min(200, zahl(v))) / 100;
      if (f === 'gc' && /^#[0-9a-f]{6}$/i.test(v)) e.gc = v;
      if (f === 'gm') e.gm = v === 'se' ? 'se' : 'auf';
      if (f === 'eg') e.eg = !!v;
      if (f === 'k') e.k = v === 'l' || v === 'r' ? v : 'g';
      const patch = {};
      FD_FE.forEach((k) => (patch[k] = e[k] != null && e[k] !== '' ? e[k] : undefined));
      if (!patch.d && !patch.a) FD_FE.forEach((k) => (patch[k] = undefined)); // bündige Fläche: nichts merken
      fdAttr(b, V, fc, patch);
      // undefinierte Einträge entfernen (sauber gespeichert)
      const d = fdD(b, V.key);
      if (d) d.units.forEach((u) => Object.keys(u).forEach((k) => u[k] === undefined && delete u[k]));
    });
  });
}
/**
 * Gruppe an dieser Stelle auflösen: ihre Öffnungen werden freie Öffnungen, ihre Felder mit Tiefe, Art oder Material
 * werden Fassadenfelder (Rechteck geteilt, Eigenschaften am Feld). Die Gruppe selbst bleibt in der Bibliothek.
 */
function oegAufloesen() {
  const b = fdB(),
    V = fdCurV(),
    I = oegGewaehlt(),
    G0 = I && oegG(I.g);
  if (!b || !V || !G0) return;
  if (oegPr(G0)) {
    fdNote('Eine Pfosten-Riegel-Gruppe lässt sich nicht auflösen.');
    return;
  }
  const B = fdStoreys(b),
    H = oegHoehe(B, I, G0),
    G = oegAngepasst(G0, I),
    Y = oegYAbb(G, H),
    oe = oegElemente(G, H, null).map((q) => ({ q, T: q.T })),
    fl = oegFlaechenG(G).map((r) => ({
      u0: I.u + r.x0,
      u1: I.u + r.x1,
      v0: I.v + Y(r.y0),
      v1: I.v + Y(r.y1),
      r,
    }));
  fdEdit((b) => {
    const d = fdD(b, V.key, true);
    // Öffnungen: frei gesetzt; in der Höhe angepasste Fenster (fester Sturz) bekommen einen eigenen Typ
    oe.forEach(({ q, T }) => {
      let k = q.t;
      if (Math.abs(T.h - oeT(q.t).h) > 1e-3) {
        k = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
        S.oet.push({
          ...JSON.parse(JSON.stringify(oeT(q.t))),
          k,
          n: oeT(q.t).n + ' (' + fdFmt(T.h) + ' m)',
          h: T.h,
        });
      }
      oeDaten(b, V.key, true).push({
        id: 'oe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        t: k,
        u: I.u + q.x + T.b / 2,
        v: I.v + q.v,
        q: 'frei',
      });
    });
    // Felder: Teilung wie im Raster (senkrechte und waagerechte Linien, 145-raster.js) an den Rändern der Gruppe und
    // ihrer Felder, Eigenschaften danach am neuen Feld
    const R = fdRaster(b, V, true);
    R.xs.push(I.u, I.u + G.l);
    R.ys.push(I.v, I.v + H);
    fl.forEach((x) => {
      R.xs.push(x.u0, x.u1);
      R.ys.push(x.v0, x.v1);
    });
    fdRasterAnwenden(b, V);
    V._f = null;
    fl.forEach((x) => {
      const fc = fdFaces(b, V).find((q) => grInFace(q, (x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2));
      if (!fc) return;
      const r = x.r,
        patch = { t: r.t || fc.t };
      if (r.d) patch.d = r.d;
      if (r.d && r.k !== 'g') patch.k = r.k;
      if (r.a) {
        patch.a = r.a;
        if (r.a === 'ba') patch.d = Math.abs(r.d) || 1.5;
        if (r.a === 'bl') patch.tb = r.tb || 1.2;
        Object.assign(patch, oegGel(r));
      }
      fdAttr(b, V, fc, patch);
    });
    // Verweis entfernen; die Automatik aus „Planen“ würde die Gruppe sonst wieder setzen
    d.gr = (d.gr || []).filter((J) => J.id !== I.id);
    if (fkDaten(b)) d.fest = 1;
  });
  FDS.gi = null;
  fdNote(
    `„${G0.n}“ aufgelöst: ${oe.length} Öffnung${oe.length === 1 ? '' : 'en'}, ${fl.length} Feld${fl.length === 1 ? '' : 'er'}.${fkDaten(b) ? ' Automatik dieser Seite ist aus.' : ''}`,
  );
}
