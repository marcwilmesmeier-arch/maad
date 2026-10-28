const $ = (id) => document.getElementById(id),
  T = THREE;
// Bewusst nicht behandelte Fehler: je Stelle und Meldung einmal protokollieren, statt sie still zu verschlucken.
const logErr = (() => {
  const seen = new Set();
  return (e, wo) => {
    const k = wo + '|' + (e && e.message);
    if (seen.has(k)) return;
    seen.add(k);
    console.warn('[maad] Fehler in ' + wo + ':', e);
  };
})();
// ======================================================================
// REGEL: Gleiche Funktionen stehen NUR hier (eine Quelle). Oberes Menü,
// Rechtsklick-Menü und Planen-Leiste werden daraus erzeugt – nie von Hand
// ergänzen. Neue Gebäude-Aktion = ein Eintrag in BA, neue Zeichenform = ein
// Eintrag in SHP. baCheck() meldet jede handgebaute Abweichung.
// ======================================================================
const SVGI = (p, z) =>
  `<svg viewBox="0 0 24 24" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const BA = [
  {
    k: 'sks',
    n: 'Auswahl',
    t: 'Auswahl (Leertaste) – Klick Fläche · Doppelklick in einer Flucht · Dreifachklick Gebäude · Shift/Strg ergänzen · Shift+Ziehen Fenster',
    p: '<path d="M5 3l14 7-6 2-2 6z"/>',
  },
  {
    k: 'skz',
    n: 'Linie',
    t: 'L – Linie: Punkte klicken, ersten Punkt anklicken = geschlossene Fläche (Gelände: Grundfläche, Dach: Dachfläche)',
    p: '<path d="M4 18L10 6l5 8 5-10"/>',
  },
  {
    k: 'skr',
    n: 'Rechteck',
    t: 'R – Rechteck: zwei gegenüberliegende Ecken klicken oder Länge;Breite tippen + Enter',
    p: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  },
  {
    k: 'skk',
    n: 'Kreis',
    t: 'C – Kreis: Mittelpunkt klicken, Radius ziehen oder tippen + Enter',
    p: '<circle cx="12" cy="12" r="8"/>',
  },
  {
    k: 'mv',
    n: 'Verschieben',
    t: 'M – Verschieben: Gebäude oder Auswahl ziehen · Strg = kopieren',
    p: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  },
  {
    k: 'skc',
    n: 'Gebäude kopieren',
    t: 'Gebäude kopieren – anklicken und an die neue Stelle ziehen (Original bleibt, Strg beim Verschieben macht dasselbe)',
    p: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>',
  },
  {
    k: 'ro',
    n: 'Drehen',
    t: 'Drehen – Maus um das Gebäude ziehen (Shift = 15°-Raster)',
    p: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  },
  {
    k: 'skp',
    n: 'Ziehen & Schieben',
    t: 'P – Fläche ziehen oder schieben: Wand, Oberseite, Dachfläche, Hof · Zahl + Enter = exakt',
    p: '<path d="M4 15l8 4 8-4M4 15V9l8-4 8 4v6M12 13V5M9 8l3-3 3 3"/>',
  },
  {
    k: 'skf',
    n: 'Versatz',
    t: 'F – Versatz: parallele Kopie der Außenkanten einer Fläche (Fläche anklicken, Maus bewegen oder Abstand tippen + Enter)',
    p: '<rect x="3" y="4" width="18" height="16" rx="1"/><rect x="8" y="9" width="8" height="6" rx="0.5"/>',
  },
  {
    k: 'skl',
    n: 'Teilen',
    t: 'T – Wand oder Dachfläche teilen (Fang: Endpunkt, Mitte, parallel, 45°, 90°)',
    x: '✂',
  },
  {
    k: 'ed',
    n: 'Kontur bearbeiten',
    t: 'Kontur des Gebäudes bearbeiten – Punkte und Kanten ziehen, Kante anklicken = Länge eingeben, Doppelklick auf Kante = Punkt einfügen',
    p: '<path d="M5 7l10-3 5 9-6 7-9-3z"/><circle cx="5" cy="7" r="1.6" fill="currentColor"/><circle cx="15" cy="4" r="1.6" fill="currentColor"/><circle cx="20" cy="13" r="1.6" fill="currentColor"/><circle cx="14" cy="20" r="1.6" fill="currentColor"/><circle cx="5" cy="17" r="1.6" fill="currentColor"/>',
  },
  {
    k: 'gr',
    n: 'Grundriss',
    t: 'Grundriss in eigenem Fenster – Geschosse, Einheiten schneiden, Flächenarten (Taste G)',
    p: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 11h8M11 4v9M15 20v-7h6"/>',
  },
  {
    k: 'grl',
    n: 'Grundriss Geschoss',
    t: 'Grundriss des gewählten Geschosses im Grundrisstool öffnen',
    p: '<path d="M4 4h16v16H4z"/><path d="M4 12h8v8"/>',
  },
  {
    k: 'fd',
    n: 'Fassade',
    t: 'Fassadendesigner – Ansichten, Ansichtsflächen trennen und mit Fassadentypen belegen',
    p: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16M10 3v6M14 9v12M8 15v6"/>',
  },
  {
    k: 'del',
    n: 'Löschen',
    t: 'Entf – Gebäude löschen',
    sep: 1,
    p: '<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>',
  },
];
const baIc = (a, z) => (a.p ? SVGI(a.p, z) : a.x);
const SHP = [
  { k: 'free', l: 'f', n: 'Freiform', ic: '◇' },
  { k: 'rect', l: 'r', n: 'Rechteck', ic: '▭' },
  { k: 'circ', l: 'c', n: 'Kreis', ic: '◯' },
  { k: 'poly', l: 'p', n: 'Polygon', ic: '⬡' },
];
const SHL = { free: 'f', rect: 'r', circ: 'c', poly: 'p' };

let GHf = (x, z) => 4 * Math.sin(x / 80) + 3 * Math.cos(z / 60) + x * 0.015;
let PLMH = null;
const gh = (x, z) => {
  const v = GHf(x, z);
  return PLMH ? PLMH(x, z, v) : v;
};
const S = {
  vact: null,
  bld: [],
  draft: [],
  closed: false,
  sel: null,
  tool: 'v',
  m3: true,
  tab: 'Planen',
  variants: [],
  hist: [],
  meas: [],
  lim: { grz: 0.4, gfz: 1.6, vg: null, h: null },
  ex: [],
  sun: false,
  wire: false,
  ortho: true,
  n: 1,
};
const area = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return Math.abs(a) / 2;
};
const cen = (p) => [p.reduce((s, a) => s + a[0], 0) / p.length, p.reduce((s, a) => s + a[1], 0) / p.length];
const lf = (b, l) => l.fp || b.fp,
  bgfOiOf = (b) =>
    b.levels.reduce((s, l) => s + (l.ug ? 0 : larea(b, l)), 0) + (b._roofA ? b._roofA.wf : 0) + pxMet(b).dBo,
  bgfOf = (b) => bgfOiOf(b) + b.levels.reduce((s, l) => s + (l.ug ? larea(b, l) : 0), 0) + pxMet(b).dBu;
const sA = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
};
/* KONTUR = reale Erdgeschossform (REGEL: „Grundriss bearbeiten" arbeitet immer auf cfp(b), nie direkt auf b.fp;
   jede Punktänderung wird per ctBegin/ctEnd auf alle Geschosse/Grundkontur übertragen, die bisher dieselbe Form hatten) */
const egK = (b) => Math.min(b.levels.filter((l) => l.ug).length, b.levels.length - 1),
  cfp = (b) => (b.levels && b.levels.length ? b.levels[egK(b)].fp || b.fp : b.fp),
  isCt = (A) => !!(A && S.sel && !S.sel.ex && S.sel.levels && cfp(S.sel) === A),
  sameFp = (a, c) =>
    !!(
      a &&
      c &&
      a.length === c.length &&
      a.every((q, i) => Math.abs(q[0] - c[i][0]) < 1e-6 && Math.abs(q[1] - c[i][1]) < 1e-6)
    );
function ctBegin(b) {
  const A = cfp(b),
    old = A.map((q) => q.slice()),
    tg = [];
  b.levels.forEach((l) => {
    if (l.fp && l.fp !== A && sameFp(l.fp, old)) tg.push(l);
  });
  return { b, A, tg, bf: b.fp !== A && sameFp(b.fp, old) };
}
function ctEnd(t) {
  t.tg.forEach((l) => {
    l.fp = t.A.map((q) => q.slice());
  });
  if (t.bf) t.b.fp = t.A.map((q) => q.slice());
}
const ugN = (b) => b.levels.filter((l) => l.ug).length,
  lname = (b, i) => {
    const u = ugN(b);
    return i < u ? 'UG' + (u - i) : i === u ? 'EG' : i - u + '.OG';
  };
const nl = (b) => {
  const l = b.levels.at(-1);
  return { name: b.levels.length + '.OG', h: l.h, ...(l.fp ? { fp: l.fp.map((q) => q.slice()) } : {}) };
};
const inP = (pt, p) => {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (
      p[i][1] > pt[1] != p[j][1] > pt[1] &&
      pt[0] < ((p[j][0] - p[i][0]) * (pt[1] - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
    )
      c = !c;
  return c;
};
const f1 = (v, d = 0) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
