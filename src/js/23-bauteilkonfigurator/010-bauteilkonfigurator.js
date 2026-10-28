/* v340 Bauteilkonfigurator – Attributstruktur für Wand, Decke, Dach.
   Kategorie ist fest (mit dem Bauteil verschmolzen). Alle Eigenschaften hängen als Dropdowns am Bauteil. Aus gleichen Werten entsteht
   automatisch derselbe Typ mit erzeugtem Namen. Arbeitstypen leben nur im Projekt (b.l2.t) und werden gelöscht, sobald nichts sie mehr nutzt. */
const L2CAT = { AW: 'W', TW: 'W', TH: 'W', DE: 'D', BP: 'D', RD: 'R' };
const L2CN = { W: 'Wand', D: 'Decke', R: 'Dach' };
const L2FN = {
  AW: 'Außenwand',
  TW: 'Trennwand',
  TH: 'Treppenhauswand',
  DE: 'Geschossdecke',
  BP: 'Bodenplatte',
  RD: 'Dach',
};
const L2CLS = (k) => (k === 'AW' ? 'AW' : k === 'TW' || k === 'TH' ? 'IW' : k);
const L2BW = {
  W: [
    'Kalksandstein',
    'Hochlochziegel',
    'Stahlbeton',
    'Holzrahmenbau',
    'Leichtbau (Metallständer)',
    'Trockenbau (CW)',
    'Zweischalig (KS + Verblender)',
    'Standard',
  ],
  D: ['Stahlbeton (Ortbeton)', 'Halbfertigteil', 'Holz-Beton-Verbund', 'Brettsperrholz', 'Standard'],
  R: ['Sparrendach', 'Pfettendach'],
};
const L2A = {
  trag: { n: 'Tragwirkung', v: () => ['tragend', 'nichttragend'] },
  bw: { n: 'Bauweise / Material', v: (k) => L2BW[L2CAT[k]] },
  dk: { n: 'Deckung', v: () => ['Tondachziegel', 'Betondachstein', 'Stehfalz Aluminium', 'Zinkblech'] },
  fa: {
    n: 'Fassade (außen)',
    v: () => [
      'Putz (WDVS)',
      'Klinker',
      'Holz',
      'Metall',
      'Kassette',
      'Naturwerkstein',
      'Sichtbeton',
      'Pfosten-Riegel',
    ],
  },
  ib: { n: 'Innenseite', v: () => ['ohne', 'Gipskarton-Vorsatzschale', 'Holzbekleidung'] },
  rei: { n: 'Brandschutz', v: () => ['–', 'REI 30', 'REI 60', 'REI 90', 'REI 120'] },
  rw: { n: 'Schallschutz', v: () => ['–', '≥ 40 dB', '≥ 43 dB', '≥ 53 dB', '≥ 55 dB', '≥ 57 dB'] },
  dt: {
    n: 'Dicke Tragschicht',
    u: 'cm',
    v: (k) =>
      k === 'BP'
        ? [25, 30, 35, 40, 50]
        : L2CAT[k] === 'D'
          ? [16, 18, 20, 22, 24, 26, 28, 30, 35]
          : [10, 11.5, 12.5, 17.5, 18.5, 20, 22, 24, 25, 30, 36.5],
  },
  dd: { n: 'Dämmung / Außenschicht', u: 'cm', v: () => [0, 8, 10, 12, 14, 16, 18, 20, 22, 24] },
  ds: { n: 'Sparrenhöhe mit Dämmung', u: 'cm', v: () => [16, 18, 20, 22, 24, 26, 28] },
};
const L2F = {
  AW: ['trag', 'bw', 'fa', 'ib', 'rei', 'rw'],
  IW: ['trag', 'bw', 'rei', 'rw'],
  DE: ['bw', 'rei'],
  BP: ['bw', 'rei'],
  RD: ['bw', 'dk', 'rei'],
};
const L2G = { AW: ['dt', 'dd'], IW: ['dt'], DE: ['dt'], BP: ['dt'], RD: ['ds'] };
const L2SIGF = {
  AW: ['trag', 'bw', 'dt', 'dd', 'fa', 'ib', 'rei', 'rw'],
  IW: ['trag', 'bw', 'dt', 'rei', 'rw'],
  DE: ['bw', 'dt', 'rei'],
  BP: ['bw', 'dt', 'rei'],
  RD: ['bw', 'dk', 'ds', 'rei'],
};
const L2ST = ['331', '341', '342', '351', '322', '361'];
const l2n1 = (v) => String(Math.round(+v * 10) / 10).replace('.', ',');
function l2Attr(t) {
  if (t.a) return t.a;
  const k = t.grp,
    cat = L2CAT[k],
    st = t.layers.find((l) => L2ST.indexOf(l.kg) >= 0) || t.layers[0],
    a = { rei: t.rei || '–' },
    p3 = t.path[3] || '',
    nm = t.layers.map((l) => l.n).join(' ');
  if (cat === 'W') {
    a.trag = t.tr ? 'tragend' : 'nichttragend';
    a.rw = t.rw || '–';
    a.dt = Math.round(st.d * 1000) / 10;
    a.bw =
      p3 === 'Stahlbeton'
        ? 'Stahlbeton'
        : p3 === 'Holzrahmenbau'
          ? 'Holzrahmenbau'
          : p3 === 'Leichtbau'
            ? 'Leichtbau (Metallständer)'
            : p3 === 'Trockenbau'
              ? 'Trockenbau (CW)'
              : /Zweischalig/.test(t.path[4] || '')
                ? 'Zweischalig (KS + Verblender)'
                : /Hochloch/.test(nm)
                  ? 'Hochlochziegel'
                  : p3 === 'Mauerwerk'
                    ? 'Kalksandstein'
                    : 'Standard';
    if (k === 'AW') {
      a.fa = /Klinker|Verblend/i.test(nm)
        ? 'Klinker'
        : /Holzschalung/.test(nm)
          ? 'Holz'
          : /Metallpaneel/.test(nm)
            ? 'Metall'
            : /Kassette/.test(nm)
              ? 'Kassette'
              : /Werkstein/.test(nm)
                ? 'Naturwerkstein'
                : /Sichtbeton/.test(nm)
                  ? 'Sichtbeton'
                  : /Pfosten/.test(nm)
                    ? 'Pfosten-Riegel'
                    : 'Putz (WDVS)';
      const il = t.layers.find((l) => l.kg === '336');
      a.ib = il
        ? /putz/i.test(il.n)
          ? 'ohne'
          : /Holz/.test(il.n)
            ? 'Holzbekleidung'
            : 'Gipskarton-Vorsatzschale'
        : 'ohne';
    }
    if (k === 'AW')
      a.dd =
        Math.round(
          t.layers
            .filter((l) => l.kg === '335' && /dämm|Dämm|Holzfaser/.test(l.n))
            .reduce((s, l) => s + l.d, 0) * 1000,
        ) / 10;
  } else if (cat === 'D') {
    a.dt = Math.round(t.d * 1000) / 10;
    const p4 = t.path[4] || '';
    a.bw = /Halbfertig/.test(p4)
      ? 'Halbfertigteil'
      : p3 === 'Holz-Beton-Verbund'
        ? 'Holz-Beton-Verbund'
        : p3 === 'Holz'
          ? 'Brettsperrholz'
          : p3 === 'Stahlbeton'
            ? 'Stahlbeton (Ortbeton)'
            : 'Standard';
  } else {
    a.bw = 'Sparrendach';
    a.dk = /Tondach/.test(nm)
      ? 'Tondachziegel'
      : /Beton/.test(nm)
        ? 'Betondachstein'
        : /Stehfalz/.test(nm)
          ? 'Stehfalz Aluminium'
          : 'Zinkblech';
    const sp = t.layers.find((l) => l.kg === '361');
    a.ds = Math.round((sp ? sp.d : 0.24) * 1000) / 10;
  }
  return a;
}
const l2Sig = (k, a) =>
  L2SIGF[L2CLS(k)]
    .map((f) => {
      const v = a[f];
      return typeof v === 'number' ? Math.round(v * 10) / 10 : v == null ? '' : v;
    })
    .join('|');
const l2hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};
const l2RoofLbl = (b) =>
  ({ sattel: 'Satteldach', walm: 'Walmdach', pult: 'Pultdach' })[b && b.roof && b.roof.type] || 'Dach';
function l2Auto(k, a, b) {
  const rr = a.rei && a.rei !== '–' ? a.rei : '',
    rw = a.rw && a.rw !== '–' ? a.rw : '';
  if (k === 'RD')
    return [l2RoofLbl(b), a.bw, a.dk, 'Sparren ' + l2n1(a.ds) + ' cm', rr].filter(Boolean).join(' · ');
  if (k === 'AW')
    return [
      L2FN[k],
      a.trag,
      a.bw,
      l2n1(a.dt) + (a.dd ? ' + ' + l2n1(a.dd) : '') + ' cm',
      a.fa && a.fa !== 'Putz (WDVS)' ? 'Fassade ' + a.fa : '',
      a.ib && a.ib !== 'ohne' && a.ib !== 'Innenputz' && a.ib !== 'Gipskarton-Vorsatzschale' ? a.ib : '',
      rr,
      rw,
    ]
      .filter(Boolean)
      .join(' · ');
  if (L2CAT[k] === 'W')
    return [L2FN[k], a.trag, a.bw, l2n1(a.dt) + ' cm', rr, rw].filter(Boolean).join(' · ');
  return [L2FN[k], a.bw, l2n1(a.dt) + ' cm', rr].filter(Boolean).join(' · ');
}
function l2Build(k, a) {
  const L = [],
    SM = {
      Kalksandstein: ['Kalksandstein-Mauerwerk', '331', '012'],
      Hochlochziegel: ['Hochlochziegel gefüllt', '331', '012'],
      Stahlbeton: ['Stahlbeton', '331', '013'],
      Holzrahmenbau: ['Holzrahmen mit Dämmung', '331', '016'],
      'Leichtbau (Metallständer)': ['Metallständer mit Dämmung', '331', '016'],
      'Trockenbau (CW)': ['Ständerwand beplankt', '331', '039'],
      'Zweischalig (KS + Verblender)': ['Kalksandstein', '331', '012'],
      Standard: ['Tragschicht', '331', '012'],
    };
  const cat = L2CAT[k];
  if (cat === 'W') {
    const sm = SM[a.bw] || SM.Standard,
      light = /Holzrahmen|Leichtbau|Trockenbau/.test(a.bw);
    if (k === 'AW') {
      const ib = a.ib || (light ? 'Gipskarton-Vorsatzschale' : 'ohne');
      if (ib !== 'ohne' && ib !== 'Innenputz')
        L.push(
          ib === 'Holzbekleidung'
            ? L2L('Holzbekleidung', 0.025, '336', '016')
            : L2L(
                light ? 'Innenbekleidung' : 'Gipskarton-Vorsatzschale',
                light ? 0.025 : 0.0625,
                '336',
                '039',
              ),
        );
      L.push(L2L(sm[0], a.dt / 100, '331', sm[2]));
      const fk = {
        Klinker: 'kli',
        Holz: 'hol',
        Metall: 'met',
        Kassette: 'kas',
        Naturwerkstein: 'nws',
        Sichtbeton: 'bet',
        'Pfosten-Riegel': 'pr',
      }[a.fa];
      if (fk) {
        if (a.dd > 0) L.push(L2L('Dämmung (hinterlüftet)', a.dd / 100, '335', '023'));
        L2FAC[fk].forEach((m) => L.push(L2L(m[0], m[1], m[2], m[3])));
      } else if (a.bw.indexOf('Zweischalig') === 0) {
        L.push(L2L('Kerndämmung', (a.dd || 0) / 100, '335', '023'));
        L.push(L2L('Verblendschale', 0.115, '335', '012'));
      } else if (a.dd > 0)
        L.push(
          L2L(
            a.bw === 'Holzrahmenbau'
              ? 'Holzfaser-Putzträger'
              : a.bw === 'Leichtbau (Metallständer)' || a.bw === 'Trockenbau (CW)'
                ? 'Fassadenplatte'
                : 'Wärmedämmverbundsystem',
            a.dd / 100,
            '335',
            '023',
          ),
        );
      else if (!light) L.push(L2L('Außenputz', 0.02, '335', '023'));
    } else L.push(L2L(sm[0], a.dt / 100, a.trag === 'tragend' ? '341' : '342', sm[2]));
  } else if (k === 'BP')
    L.push(L2L(a.bw === 'Standard' ? 'Tragschicht' : 'WU-Beton', a.dt / 100, '322', '013'));
  else if (cat === 'D') {
    const t = a.dt / 100;
    if (a.bw === 'Holz-Beton-Verbund') {
      L.push(L2L('Aufbeton', 0.1, '351', '013'));
      L.push(L2L('Holzbalken / Brettsperrholz', Math.max(0.05, t - 0.1), '351', '016'));
    } else
      L.push(
        a.bw === 'Halbfertigteil'
          ? L2L('Filigranplatte mit Aufbeton', t, '351', '013')
          : a.bw === 'Brettsperrholz'
            ? L2L('Brettsperrholz', t, '351', '016')
            : L2L(a.bw === 'Standard' ? 'Deckenplatte' : 'Stahlbeton', t, '351', '013'),
      );
  } else {
    const DK = {
      Tondachziegel: ['Tondachziegel', 0.045],
      Betondachstein: ['Betondachstein', 0.05],
      'Stehfalz Aluminium': ['Stehfalzdeckung Aluminium', 0.01],
      Zinkblech: ['Zinkblechdeckung', 0.01],
    }[a.dk] || ['Tondachziegel', 0.045];
    L.push(
      L2L(DK[0], DK[1], '363', '020'),
      L2L('Lattung / Konterlattung', 0.06, '363', '020'),
      Object.assign(
        L2L(
          (a.bw === 'Pfettendach' ? 'Pfetten/Sparren' : 'Sparren') + ' mit Zwischensparrendämmung',
          a.ds / 100,
          '361',
          '016',
        ),
        { sp: { w: 8, s: 70 } },
      ),
      L2L('Innenbekleidung', 0.0125, '364', '039'),
    );
  }
  return L;
}
const L2M = {
  W: [
    ['Innenbekleidung', '336', '039'],
    ['Kalksandstein-Mauerwerk', '331', '012'],
    ['Hochlochziegel gefüllt', '331', '012'],
    ['Stahlbeton', '331', '013'],
    ['Holzrahmen mit Dämmung', '331', '016'],
    ['Metallständer mit Dämmung', '331', '016'],
    ['Brettsperrholz', '331', '016'],
    ['Ständerwand beplankt', '331', '039'],
    ['Kerndämmung', '335', '023'],
    ['Wärmedämmverbundsystem', '335', '023'],
    ['Holzfaser-Putzträger', '335', '023'],
    ['Außenputz', '335', '023'],
    ['Verblendschale', '335', '012'],
    ['Fassadenplatte', '335', '023'],
  ],
  I: [
    ['Putz', '345', '023'],
    ['Beplankung', '345', '039'],
    ['Kalksandstein', '341', '012'],
    ['Stahlbeton', '341', '013'],
    ['Ständerwand beplankt', '342', '039'],
    ['Holzrahmen mit Dämmung', '341', '016'],
    ['Dämmung', '342', '039'],
  ],
  D: [
    ['Stahlbeton', '351', '013'],
    ['Filigranplatte mit Aufbeton', '351', '013'],
    ['Aufbeton', '351', '013'],
    ['Brettsperrholz', '351', '016'],
    ['Holzbalken / Brettsperrholz', '351', '016'],
    ['Trittschalldämmung', '353', '025'],
    ['Estrich', '353', '025'],
    ['Deckenbekleidung', '354', '039'],
  ],
  B: [
    ['WU-Beton', '322', '013'],
    ['Stahlbeton', '322', '013'],
    ['Sauberkeitsschicht', '322', '013'],
    ['Dämmung unter Bodenplatte', '322', '018'],
  ],
  R: [
    ['Tondachziegel', '363', '020'],
    ['Betondachstein', '363', '020'],
    ['Stehfalzdeckung Aluminium', '363', '020'],
    ['Zinkblechdeckung', '363', '020'],
    ['Lattung / Konterlattung', '363', '020'],
    ['Unterdeckung', '363', '020'],
    ['Schalung / Trennlage', '363', '016'],
    ['Hinterlüftung', '363', '016'],
    ['Sparren mit Zwischensparrendämmung', '361', '016'],
    ['Aufsparrendämmung', '363', '020'],
    ['Dampfbremse', '364', '039'],
    ['Innenbekleidung', '364', '039'],
  ],
};
const l2mKey = (k) =>
  k === 'AW' ? 'W' : k === 'TW' || k === 'TH' ? 'I' : k === 'DE' ? 'D' : k === 'BP' ? 'B' : 'R';
const L2TH = [
  0.5, 1, 1.25, 1.5, 2, 2.5, 3.5, 4, 4.5, 5, 6, 8, 10, 11.5, 12, 14, 16, 17.5, 18, 20, 22, 24, 25, 26, 30,
  36.5, 40,
];
function l2AttrL(k, A, LY) {
  const a = Object.assign({}, A),
    st = LY.find((l) => L2ST.indexOf(l.kg) >= 0) || LY[0];
  if (k === 'RD') {
    const sp = LY.find((l) => l.kg === '361');
    a.ds = Math.round((sp ? sp.d : 0.24) * 1000) / 10;
  } else {
    a.dt = Math.round(st.d * 1000) / 10;
    if (k === 'AW')
      a.dd =
        Math.round(
          LY.filter((l) => l.kg === '335' && /dämm|Dämm|Holzfaser/.test(l.n)).reduce((s, l) => s + l.d, 0) *
            1000,
        ) / 10;
  }
  return a;
}
function l2MkL(k, A0, LY, b) {
  const A = l2AttrL(k, A0, LY),
    t = l2Mk(k, A, b);
  t.layers = LY.map((l) => ({ n: l.n, d: l.d, kg: l.kg, lb: l.lb, sp: l.sp }));
  t.id =
    'C-' +
    k +
    '-L' +
    l2hash(JSON.stringify(LY.map((l) => [l.n, Math.round(l.d * 1000), l.kg, l.sp || 0])) + l2Sig(k, A));
  t.lay = 1;
  t.nm = t.dl = l2Auto(k, A, b) + ' · eigener Aufbau';
  t.path[2] = t.nm;
  return l2Fin(t, b);
}
function l2Fin(t, b) {
  t.d = t.layers.reduce((s, l) => s + l.d, 0);
  t.kg = (t.layers.find((l) => L2ST.indexOf(l.kg) >= 0) || t.layers[0]).kg;
  t.full = t.path.join(' ▸ ');
  return t;
}
function l2Mk(k, a, b) {
  const cat = L2CAT[k],
    A = JSON.parse(JSON.stringify(a)),
    nm = l2Auto(k, A, b),
    rt = b && b.roof && b.roof.type,
    pre = {
      AW: 'STANDARD',
      TW: 'PARTITIONING',
      TH: 'SHEAR',
      DE: 'FLOOR',
      BP: 'BASESLAB',
      RD: { sattel: 'GABLE_ROOF', walm: 'HIP_ROOF', pult: 'SHED_ROOF' }[rt] || 'GABLE_ROOF',
    }[k];
  const t = {
    id: 'C-' + k + '-' + l2hash(l2Sig(k, A)),
    grp: k,
    path: [L2CN[cat], L2FN[k], nm],
    tr: cat === 'W' ? (A.trag === 'tragend' ? 1 : 0) : 1,
    pre,
    u: '–',
    rei: A.rei || '–',
    rw: A.rw || '–',
    layers: l2Build(k, A),
    a: A,
    cu: 1,
    nm,
    dl: nm,
  };
  return l2Fin(t, b);
}
