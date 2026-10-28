/* v333 PROTOTYP LOD 200 – Wände und Geschossdecken im Grundrisstool.
   Wände entstehen aus den vorhandenen Schnittlinien und Flächenarten (kein zusätzliches Zeichnen):
   Außenwand = Gebäudeumriss (baut sich von der Kubatur nach innen auf), Treppenhauswand = Kanten um Treppenhaus/Schacht,
   Trennwand = übrige Kanten zwischen Einheiten. Ausrichtung links/Mitte/rechts je Schnittgruppe, Typ je Wand oder je Art.
   Sichtbar nur bei LOD 200 (LOD-Leiste). Katalog: Kategorie ▸ Funktion ▸ Zweck ▸ Bauweise ▸ Typ mit KG nach DIN 276 je Schicht. */
const L2L = (n, d, kg, lb) => ({ n, d, kg, lb });
const L2T = [
  {
    id: 'AW-STD',
    grp: 'AW',
    path: ['Wand', 'Außenwand'],
    std: 1,
    tr: 1,
    pre: 'STANDARD',
    u: '0,21',
    rei: '–',
    rw: '–',
    layers: [
      L2L('Innenputz', 0.015, '336', '023'),
      L2L('Tragschicht', 0.185, '331', '012'),
      L2L('Wärmedämmverbundsystem', 0.16, '335', '023'),
    ],
  },
  {
    id: 'AW-KS',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Tragend', 'Mauerwerk', 'Kalksandstein 17,5 + WDVS 16'],
    tr: 1,
    pre: 'STANDARD',
    u: '0,20',
    rei: 'REI 90',
    rw: '–',
    layers: [
      L2L('Innenputz', 0.015, '336', '023'),
      L2L('Kalksandstein-Mauerwerk', 0.175, '331', '012'),
      L2L('Wärmedämmverbundsystem', 0.16, '335', '023'),
    ],
  },
  {
    id: 'AW-STB',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Tragend', 'Stahlbeton', 'Stahlbeton 20 + WDVS 16'],
    tr: 1,
    pre: 'STANDARD',
    u: '0,20',
    rei: 'REI 90',
    rw: '–',
    layers: [L2L('Stahlbeton', 0.2, '331', '013'), L2L('Wärmedämmverbundsystem', 0.16, '335', '023')],
  },
  {
    id: 'AW-HRB',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Tragend', 'Holzrahmenbau', 'Holzrahmen 24 + Holzfaser 8'],
    tr: 1,
    pre: 'STANDARD',
    u: '0,15',
    rei: 'REI 60',
    rw: '–',
    layers: [
      L2L('Innenbekleidung', 0.025, '336', '039'),
      L2L('Holzrahmen mit Dämmung', 0.24, '331', '016'),
      L2L('Holzfaser-Putzträger', 0.08, '335', '023'),
    ],
  },
  {
    id: 'AW-HLZ',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Tragend', 'Mauerwerk', 'Hochlochziegel 36,5 monolithisch'],
    tr: 1,
    pre: 'STANDARD',
    u: '0,18',
    rei: 'REI 90',
    rw: '–',
    layers: [
      L2L('Innenputz', 0.015, '336', '023'),
      L2L('Hochlochziegel gefüllt', 0.365, '331', '012'),
      L2L('Außenputz', 0.02, '335', '023'),
    ],
  },
  {
    id: 'AW-STB2',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Tragend', 'Stahlbeton', 'Stahlbeton 25 + WDVS 22'],
    tr: 1,
    pre: 'STANDARD',
    u: '0,14',
    rei: 'REI 120',
    rw: '–',
    layers: [
      L2L('Innenputz', 0.01, '336', '023'),
      L2L('Stahlbeton', 0.25, '331', '013'),
      L2L('Wärmedämmverbundsystem', 0.22, '335', '023'),
    ],
  },
  {
    id: 'AW-ZS',
    grp: 'AW',
    path: [
      'Wand',
      'Außenwand',
      'Tragend',
      'Mauerwerk',
      'Zweischalig KS 17,5 + Kerndämmung 16 + Verblender 11,5',
    ],
    tr: 1,
    pre: 'STANDARD',
    u: '0,16',
    rei: 'REI 90',
    rw: '–',
    layers: [
      L2L('Innenputz', 0.015, '336', '023'),
      L2L('Kalksandstein', 0.175, '331', '012'),
      L2L('Kerndämmung', 0.16, '335', '023'),
      L2L('Verblendschale', 0.115, '335', '012'),
    ],
  },
  {
    id: 'AW-LW',
    grp: 'AW',
    path: ['Wand', 'Außenwand', 'Nichttragend', 'Leichtbau', 'Metallständer 10 + Fassadenplatte'],
    tr: 0,
    pre: 'STANDARD',
    u: '0,25',
    rei: '–',
    rw: '–',
    layers: [
      L2L('Gipskarton', 0.025, '336', '039'),
      L2L('Metallständer mit Dämmung', 0.1, '331', '016'),
      L2L('Fassadenplatte', 0.02, '335', '023'),
    ],
  },
  {
    id: 'RD-SA',
    grp: 'RD',
    path: ['Dach', 'Schrägdach', 'Satteldach', 'Sparrendach mit Tondachziegeln'],
    std: 1,
    tr: 1,
    pre: 'GABLE_ROOF',
    u: '0,14',
    rei: '–',
    rw: '–',
    layers: [
      L2L('Tondachziegel', 0.045, '363', '020'),
      L2L('Lattung / Konterlattung', 0.06, '363', '020'),
      L2L('Sparren mit Zwischensparrendämmung', 0.24, '361', '016'),
      L2L('Innenbekleidung', 0.0125, '364', '039'),
    ],
  },
  {
    id: 'RD-WA',
    grp: 'RD',
    path: ['Dach', 'Schrägdach', 'Walmdach', 'Sparrendach mit Betondachsteinen'],
    std: 1,
    tr: 1,
    pre: 'HIP_ROOF',
    u: '0,14',
    rei: '–',
    rw: '–',
    layers: [
      L2L('Betondachstein', 0.05, '363', '020'),
      L2L('Lattung / Konterlattung', 0.06, '363', '020'),
      L2L('Holzfaser-Unterdeckung', 0.035, '363', '020'),
      L2L('Sparren mit Zwischensparrendämmung', 0.24, '361', '016'),
    ],
  },
  {
    id: 'RD-PU',
    grp: 'RD',
    path: ['Dach', 'Schrägdach', 'Pultdach', 'Sparrendach mit Stehfalzdeckung'],
    std: 1,
    tr: 1,
    pre: 'SHED_ROOF',
    u: '0,15',
    rei: '–',
    rw: '–',
    layers: [
      L2L('Stehfalzdeckung Aluminium', 0.01, '363', '020'),
      L2L('Schalung / Trennlage', 0.024, '363', '016'),
      L2L('Hinterlüftung', 0.06, '363', '016'),
      L2L('Sparren mit Zwischensparrendämmung', 0.22, '361', '016'),
    ],
  },
  {
    id: 'TW-STD',
    grp: 'TW',
    path: ['Wand', 'Innenwand', 'Trennwand'],
    std: 1,
    tr: 1,
    pre: 'PARTITIONING',
    rei: 'REI 90',
    rw: '≥ 53 dB',
    layers: [L2L('Tragschicht', 0.24, '341', '012')],
  },
  {
    id: 'TW-KS',
    grp: 'TW',
    path: ['Wand', 'Innenwand', 'Trennwand', 'Mauerwerk', 'Kalksandstein', '2DF 24 cm'],
    tr: 1,
    pre: 'PARTITIONING',
    rei: 'REI 90',
    rw: '≥ 53 dB',
    layers: [L2L('Kalksandstein 2DF', 0.24, '341', '012')],
  },
  {
    id: 'TW-STB',
    grp: 'TW',
    path: ['Wand', 'Innenwand', 'Trennwand', 'Stahlbeton', 'Stahlbeton 22'],
    tr: 1,
    pre: 'PARTITIONING',
    rei: 'REI 90',
    rw: '≥ 57 dB',
    layers: [L2L('Stahlbeton', 0.22, '341', '013')],
  },
  {
    id: 'TH-STD',
    grp: 'TH',
    path: ['Wand', 'Innenwand', 'Treppenhauswand'],
    std: 1,
    tr: 1,
    pre: 'SHEAR',
    rei: 'REI 90',
    rw: '≥ 55 dB',
    layers: [L2L('Tragschicht', 0.2, '341', '013')],
  },
  {
    id: 'TH-STB',
    grp: 'TH',
    path: ['Wand', 'Innenwand', 'Treppenhauswand', 'Stahlbeton', 'Stahlbeton 20'],
    tr: 1,
    pre: 'SHEAR',
    rei: 'REI 90',
    rw: '≥ 55 dB',
    layers: [L2L('Stahlbeton', 0.2, '341', '013')],
  },
  {
    id: 'TH-KS',
    grp: 'TH',
    path: ['Wand', 'Innenwand', 'Treppenhauswand', 'Mauerwerk', 'Kalksandstein 2DF 24 cm'],
    tr: 1,
    pre: 'SHEAR',
    rei: 'REI 90',
    rw: '≥ 55 dB',
    layers: [L2L('Kalksandstein 2DF', 0.24, '341', '012')],
  },
  {
    id: 'NT-GK',
    grp: 'TW',
    path: ['Wand', 'Innenwand', 'Nichttragend', 'Trockenbau', 'CW 100, 2 × 12,5'],
    tr: 0,
    pre: 'PARTITIONING',
    rei: '–',
    rw: '≥ 40 dB',
    layers: [L2L('Ständerwand CW 100, beplankt', 0.125, '342', '039')],
  },
  {
    id: 'NT-KS',
    grp: 'TW',
    path: ['Wand', 'Innenwand', 'Nichttragend', 'Mauerwerk', 'Kalksandstein 11,5'],
    tr: 0,
    pre: 'PARTITIONING',
    rei: '–',
    rw: '≥ 43 dB',
    layers: [L2L('Kalksandstein', 0.115, '342', '012')],
  },
  {
    id: 'DE-STD',
    grp: 'DE',
    path: ['Decke', 'Geschossdecke'],
    std: 1,
    tr: 1,
    pre: 'FLOOR',
    rei: 'REI 90',
    rw: '–',
    layers: [L2L('Deckenplatte', 0.22, '351', '013')],
  },
  {
    id: 'DE-STB',
    grp: 'DE',
    path: ['Decke', 'Geschossdecke', 'Stahlbeton', 'Stahlbeton 22 (Ortbeton)'],
    tr: 1,
    pre: 'FLOOR',
    rei: 'REI 90',
    rw: '–',
    layers: [L2L('Stahlbeton', 0.22, '351', '013')],
  },
  {
    id: 'DE-FT',
    grp: 'DE',
    path: ['Decke', 'Geschossdecke', 'Stahlbeton', 'Halbfertigteil 20'],
    tr: 1,
    pre: 'FLOOR',
    rei: 'REI 90',
    rw: '–',
    layers: [L2L('Filigranplatte mit Aufbeton', 0.2, '351', '013')],
  },
  {
    id: 'DE-HBV',
    grp: 'DE',
    path: ['Decke', 'Geschossdecke', 'Holz-Beton-Verbund', 'Holz-Beton-Verbund 26'],
    tr: 1,
    pre: 'FLOOR',
    rei: 'REI 60',
    rw: '–',
    layers: [L2L('Aufbeton', 0.1, '351', '013'), L2L('Holzbalken / Brettsperrholz', 0.16, '351', '016')],
  },
  {
    id: 'DE-BSP',
    grp: 'DE',
    path: ['Decke', 'Geschossdecke', 'Holz', 'Brettsperrholz 20'],
    tr: 1,
    pre: 'FLOOR',
    rei: 'REI 60',
    rw: '–',
    layers: [L2L('Brettsperrholz', 0.2, '351', '016')],
  },
  {
    id: 'BP-STD',
    grp: 'BP',
    path: ['Bodenplatte'],
    std: 1,
    tr: 1,
    pre: 'BASESLAB',
    rei: '–',
    rw: '–',
    layers: [L2L('Stahlbeton', 0.3, '322', '013')],
  },
  {
    id: 'BP-35',
    grp: 'BP',
    path: ['Bodenplatte', 'Stahlbeton', 'WU-Beton 35'],
    tr: 1,
    pre: 'BASESLAB',
    rei: '–',
    rw: '–',
    layers: [L2L('WU-Beton', 0.35, '322', '013')],
  },
];
L2T.forEach((t) => {
  t.d = t.layers.reduce((s, l) => s + l.d, 0);
  t.kg = (
    t.layers.find((l) => ['331', '341', '342', '351', '322', '361'].indexOf(l.kg) >= 0) || t.layers[0]
  ).kg;
  {
    const a = t.path[t.path.length - 1],
      p = t.path[t.path.length - 2];
    t.nm = t.path.length >= 4 && /^\d/.test(a) ? p + ' ' + a : a;
    t.dl = /cm/.test(t.nm) ? t.nm : t.nm + ' · ' + Math.round(t.d * 100) + ' cm';
  }
  t.full = t.path.join(' ▸ ');
});
const L2CO = new Map(),
  L2DC = { AW: 36, TW: 24, TH: 20, DE: 22, BP: 30, RD: 36 },
  L2CKG = { AW: '331', TW: '341', TH: '341', DE: '351', BP: '322', RD: '361' },
  L2CPRE = { AW: 'STANDARD', TW: 'PARTITIONING', TH: 'SHEAR', DE: 'FLOOR', BP: 'BASESLAB', RD: 'ROOF' };
const L2CP = {
  AW: [24, 30, 36, 36.5, 42, 48],
  TW: [11.5, 17.5, 24, 30],
  TH: [20, 24, 25, 30],
  DE: [18, 20, 22, 25, 28],
  BP: [25, 30, 35, 40],
  RD: [30, 36, 42],
};
function l2Co(id) {
  let t = L2CO.get(id);
  if (t) return t;
  const m = /^G-([A-Z]{2})-([\d.]+)$/.exec(id);
  if (!m || !L2K[m[1]]) return null;
  const k = m[1],
    cm = +m[2],
    d = cm / 100,
    n = L2K[k].n;
  t = {
    id,
    grp: k,
    path: [k === 'AW' || k === 'TW' || k === 'TH' ? 'Wand' : n, n],
    co: 1,
    tr: 1,
    pre: L2CPRE[k],
    rei: '–',
    rw: '–',
    layers: [L2L(n, d, L2CKG[k], '')],
    d,
    kg: L2CKG[k],
    nm: n,
    dl: n + ' · ' + String(cm).replace('.', ',') + ' cm',
    full: n,
  };
  L2CO.set(id, t);
  return t;
}
/* kein Innenputz in den Wandaufbauten: Schicht aus allen Typen (auch aus gespeicherten Projekten) entfernen */
const l2np = (t) => {
  if (t && !t._np) {
    t._np = 1;
    if (t.layers && t.layers.length > 1 && t.layers.some((l) => l.n === 'Innenputz')) {
      t.layers = t.layers.filter((l) => l.n !== 'Innenputz');
      t.d = t.layers.reduce((s, l) => s + l.d, 0);
    }
  }
  return t;
};
const l2T = (id) =>
  l2np(
    L2T.find((t) => t.id === id) ||
      (typeof id === 'string' && id.slice(0, 2) === 'G-' ? l2Co(id) : null) ||
      L2T[0],
  );
L2T.forEach(l2np);
const l2DefC = (b) => {
  const c = (b && b.l2 && b.l2.c) || {},
    o = {};
  for (const k in L2DC) o[k] = 'G-' + k + '-' + (+c[k] || L2DC[k]);
  return o;
};
const L2K = {
  AW: { n: 'Außenwand', c: '#ffffff', c2: '#8a7f66', p: '#46433c' },
  TW: { n: 'Innenwand', c: '#ffffff', c2: '#5e7f92', p: '#5E7F92' },
  TH: { n: 'Treppenhauswand', c: '#ffffff', c2: '#3f6277', p: '#2e4d5f' },
  RD: { n: 'Dach', c: '#ffffff', c2: '#6f6f6f', p: '#6f6f6f' },
  DE: { n: 'Geschossdecke', c: '#ffffff', c2: '#6b665c', p: '#6b665c' },
  BP: { n: 'Bodenplatte', c: '#ffffff', c2: '#4c483f', p: '#4c483f' },
};
const L2AL = { l: 'links', m: 'Mitte', r: 'rechts' };
S.l2 = {
  defs: { AW: 'AW-STD', TW: 'TW-STD', TH: 'TH-STD', DE: 'DE-STD', BP: 'BP-STD' },
  sel: null,
  hv: null,
  all: 0,
  pick: 0,
};
const l2on = () => S.lod === 200 || S.lod === 300;
const l23 = () => S.lod === 300;
LODS[1].ok = () => true;
LODS[2].ok = () => true;
LODS[2].d = 'Alle Schichten der Wände, Geschossdecken und Dächer in 3D – Aufbau aus dem Bauteilkonfigurator';
LODS[1].d = 'Wände und Geschossdecken als Bauteile mit Typ, Ausrichtung, DIN-276-Zuordnung und Mengen';
try {
  lodRender();
} catch (e) {
  logErr(e, 'init');
}
const l2k = (p) => Math.round(p[0] * 200 + 0.37) + ',' + Math.round(p[1] * 200 + 0.37);
const l2f = (v, n) => (+v).toFixed(n == null ? 2 : n).replace('.', ',');
function l2PIn(q, x, z) {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i],
      b = q[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function l2Seg(px, pz, c) {
  const dx = c[2] - c[0],
    dz = c[3] - c[1],
    L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - c[0]) * dx + (pz - c[1]) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (c[0] + t * dx), pz - (c[1] + t * dz));
}
const l2Data = (lv) => lv.obj.l2 || { al: {}, ty: [] };
