/* v262: Karten-Ebenen „Naturschutzgebiete“ (BfN, WFS) und „Überschwemmungsrisiko (Fluss)“ (BfG, ArcGIS REST) als Flächen auf dem Gelände.
   Die Flächen werden wie Bebauungspläne in eine eigene Zeichenfläche PL[k] gemalt und über recomp() ins Geländebild gelegt.
   Quelle und Adresse sind dieselben wie in „Grundstück und Umgebung“ (ENVC.nsg / ENVC.hq); geladen wird beim Einschalten der Ebene. */
const OVL = {
  nsg: { n: 'Naturschutzgebiete', col: '#2f9e5b' },
  ffh: { n: 'FFH-Gebiete (Natura 2000)', col: '#1f8f8f' },
  vsg: { n: 'Vogelschutzgebiete (Natura 2000)', col: '#8a5cc2' },
  hq: { n: 'Überschwemmungsrisiko (Fluss)', col: '#2f6fd0' },
  clc: { n: 'Flächennutzung (CORINE)', col: '#888888' },
};
const OVD = {},
  OVI = {};
Object.keys(OVL).forEach((k) => {
  PK[k] = 1;
});
let OVC = document.createElement('canvas');
OVC.width = OVC.height = 1;
let ovSig = '';
const ovW = () => Math.min(PW, 2048);
const ovKey = () => GEO.lon.toFixed(5) + ',' + GEO.lat.toFixed(5) + ',' + GEO.size;
const ovVis = (k) => {
  const L = LY.find((l) => l[1] === k);
  return !!(L && L[2]);
};
function ovClear(k) {
  delete OVI[k];
}
function ovPaint(k, items) {
  OVI[k] = items;
}
/* alle sichtbaren Flächen-Ebenen in EINE Zeichenfläche (Speicher), Deckkraft je Ebene aus dem Layer-Menü */
function ovRepaint() {
  const ks = ['clc', 'hq', 'ffh', 'vsg', 'nsg'].filter((k) => ovVis(k) && OVI[k]),
    sig =
      ks
        .map((k) => {
          const L = LY.find((l) => l[1] === k);
          return k + ':' + L[3] + ':' + OVI[k].length + ':' + (OVI[k]._v || (OVI[k]._v = Math.random()));
        })
        .join('|') +
      '|' +
      ovW();
  if (sig === ovSig && OVC.width === ovW()) return;
  ovSig = sig;
  if (!ks.length) {
    OVC.width = OVC.height = 1;
    return;
  }
  const W = ovW();
  if (OVC.width !== W) OVC.width = OVC.height = W;
  let x = OVC.getContext('2d');
  if (x.isContextLost && x.isContextLost()) {
    OVC = document.createElement('canvas');
    OVC.width = OVC.height = W;
    x = OVC.getContext('2d');
  }
  const K = W / GEO.size,
    X = (v) => (v + GEO.size / 2) * K;
  x.clearRect(0, 0, PW, PW);
  x.lineJoin = 'round';
  x.lineWidth = Math.max(1.5, (2.2 * PS * W) / PW);
  for (const k of ks) {
    const L = LY.find((l) => l[1] === k),
      al = Math.max(0.05, Math.min(1, L[3]));
    x.strokeStyle = x.fillStyle = OVL[k].col;
    for (const it of OVI[k]) {
      if (it.c) x.strokeStyle = x.fillStyle = it.c;
      x.beginPath();
      if (it.t === 'a') {
        for (const r of it.r) {
          r.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
          x.closePath();
        }
        x.globalAlpha = (0.38 * al) / 0.7;
        x.fill('evenodd');
        x.globalAlpha = Math.min(1, (0.95 * al) / 0.7);
        x.stroke();
      } else {
        for (const r of it.r) r.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
        x.globalAlpha = Math.min(1, (0.95 * al) / 0.7);
        x.stroke();
      }
    }
  }
  x.globalAlpha = 1;
}
const ovRings = (g, cv) => {
  const out = [];
  if (!g) return out;
  const pg = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  pg.forEach((p) => out.push({ t: 'a', r: p.map((r) => r.map(cv)) }));
  return out;
};
async function ovFetchWfs(k) {
  const c = envCfg(k);
  if (!c || !c.url || !c.type)
    throw new Error('Keine Quelle für ' + (OVL[k] ? OVL[k].n : 'diese Ebene') + ' eingetragen');
  if (c.kind === 'wms' || c.kind === 'arcgis') throw new Error('Diensttyp nicht darstellbar (WFS nötig)');
  const h = GEO.size / 2,
    feats = await wfsFeatures(c, [-h, -h, h, h]),
    crs = c.crs || '25832',
    cv = (p) => envConv(p, crs),
    items = [];
  feats.forEach((f) => {
    const cd = k === 'clc' ? clcCode(f.properties) : '';
    ovRings(f.geometry, cv).forEach((o) => {
      if (k === 'clc') {
        o.c = clcCol(cd);
        o.cd = cd;
      }
      items.push(o);
    });
  });
  return { items, n: feats.length };
}
async function ovFetchHq() {
  const c = envCfg('hq');
  if (!c || !c.url) throw new Error('Keine Quelle für Überschwemmungsrisiko eingetragen');
  if (c.kind !== 'arcgis') throw new Error('Diensttyp nicht darstellbar (ArcGIS REST nötig)');
  const h = GEO.size / 2,
    cs = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ].map((p) => {
      const [lo, la] = xz2ll(p);
      return ll2utm(lo, la);
    }),
    ex = [
      Math.min(...cs.map((v) => v[0])),
      Math.min(...cs.map((v) => v[1])),
      Math.max(...cs.map((v) => v[0])),
      Math.max(...cs.map((v) => v[1])),
    ]
      .map((v) => Math.round(v))
      .join(',');
  const jq = async (u) => {
    const j = JSON.parse(await envFetch(u));
    if (j.error) throw new Error('Dienst: ' + (j.error.message || j.error.code));
    return j;
  };
  const tasks = [];
  for (const base of c.url.split(/[\s,;]+/).filter(Boolean)) {
    const b0 = base.replace(/\/+$/, '');
    if (/\/\d+$/.test(b0)) tasks.push(b0);
    else {
      const j = await jq(b0 + '?f=json');
      (j.layers || [])
        .filter((l) => !(l.subLayerIds && l.subLayerIds.length))
        .forEach((l) => tasks.push(b0 + '/' + l.id));
    }
  }
  if (!tasks.length) throw new Error('Dienst ohne Layer');
  const rs = await Promise.all(
    tasks.map(async (u) => {
      try {
        return await jq(
          u +
            '/query?f=json&where=1%3D1&geometryType=esriGeometryEnvelope&inSR=25832&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=&returnGeometry=true&geometryPrecision=6&maxAllowableOffset=0.00004&geometry=' +
            ex,
        );
      } catch (e) {
        return { err: e.message };
      }
    }),
  );
  if (rs.every((r) => r.err)) throw new Error(rs[0].err);
  const cv = (p) => ll2xz(p[0], p[1]),
    items = [];
  let n = 0;
  rs.forEach((r) =>
    (r.features || []).forEach((f) => {
      const g = f.geometry || {};
      n++;
      if (g.rings) items.push({ t: 'a', r: g.rings.map((r) => r.map(cv)) });
      else if (g.paths) items.push({ t: 'l', r: g.paths.map((r) => r.map(cv)) });
    }),
  );
  return { items, n };
}
let ovT = 0;
const ovRc = () => {
  clearTimeout(ovT);
  ovT = setTimeout(() => {
    try {
      recomp();
    } catch (e) {
      logErr(e, 'ovRc>anonym');
    }
  }, 150);
};
async function ovLoad(k) {
  if (!OVL[k]) return;
  if (!S.geo) {
    OVD[k] = { key: 'demo', st: 'err', msg: 'Nur mit geladenem Projekt (nicht in der Demo)' };
    return;
  }
  const key = ovKey();
  if (OVD[k] && OVD[k].key === key && OVD[k].st !== 'err') return;
  OVD[k] = { key, st: 'busy' };
  try {
    rr();
  } catch (e) {
    logErr(e, 'ovLoad');
  }
  try {
    const r = await (k === 'hq' ? ovFetchHq() : ovFetchWfs(k));
    if (!OVD[k] || OVD[k].key !== key) return;
    ovPaint(k, r.items);
    OVD[k] = { key, st: 'ok', n: r.n, t: Date.now() };
  } catch (e) {
    ovClear(k);
    OVD[k] = { key, st: 'err', msg: e && e.message ? e.message : String(e) };
  }
  try {
    if (S.geo) ovRc();
  } catch (e) {
    logErr(e, 'ovLoad');
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'ovLoad');
  }
}
function ovSync() {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/040-gruenflaechen-aus-corine.js
  const r = (() => {
    if (!S.geo) return;
    const key = ovKey();
    for (const k in OVL) {
      const d = OVD[k];
      if (d && d.key !== key && d.key !== 'demo') {
        ovClear(k);
        delete OVD[k];
      }
      if (!OVD[k] && ovVis(k)) ovLoad(k);
    }
  })();
  try {
    if (S.geo && clgOn() && !OVD.clc) ovLoad('clc');
  } catch (e) {
    logErr(e, 'ovSync');
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/120-tannen.js (danach)
  try {
    if (S.geo && wldOn() && !OVD.clc) ovLoad('clc');
  } catch (e) {
    logErr(e, 'ovSync');
  }
  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  try {
    if (S.geo && bclOn() && !OVD.clc) ovLoad('clc');
  } catch (e) {
    logErr(e, 'ovSync');
  }
  return r;
}
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// recomp(): Erweiterung zusammengeführt, siehe 02-geodaten/020-flurkarte-als-bild.js
window.ovInfo = function (k) {
  const d = OVD[k],
    c = envCfg(k) || {},
    S0 = ENVSRC[k] || {};
  const base = {
    sh: k === 'hq' ? 'BfG' : k === 'clc' ? 'BKG' : 'BfN',
    lic:
      k === 'hq'
        ? '© BfG / Länder (nHWGK-HWRK)'
        : k === 'clc'
          ? '© GeoBasis-DE / BKG, dl-de/by-2-0'
          : '© Bundesamt für Naturschutz (BfN), GeoNutzV',
    hs: [(c.url || '').split(/\s+/)[0]],
    info: [
      ['Dienst', (c.url || '').split(/\s+/)[0]],
      ['Hinweis', S0.note || ''],
    ],
    probs: [],
  };
  if (k === 'clc' && OVI.clc) {
    const cs = [...new Set(OVI.clc.map((o) => o.cd).filter(Boolean))].sort();
    if (cs.length) base.info.push(['Klassen im Ausschnitt', cs.map(clcLbl).join('; ')]);
  }
  if (!c.url)
    return Object.assign(base, {
      st: 'none',
      src: 'keine Quelle eingetragen (Reiter „Grundstück und Umgebung“ › Datenquellen)',
      n: '',
    });
  if (!d) return Object.assign(base, { st: 'none', src: 'wird beim Einschalten geladen', n: '' });
  if (d.st === 'busy') return Object.assign(base, { st: 'unk', src: 'wird geladen …', n: '' });
  if (d.st === 'err') return Object.assign(base, { st: 'unk', src: d.msg, n: '', probs: [d.msg] });
  return Object.assign(base, {
    st: 'ok',
    src: S0.by || '',
    n: d.n + (d.n === 1 ? ' Fläche' : ' Flächen') + ' im Ausschnitt',
  });
};
window.ovTog = function (k) {
  const i = LY.findIndex((l) => l[1] === k);
  if (i < 0) return;
  lvis(i, !LY[i][2]);
  try {
    lyRender();
  } catch (e) {
    logErr(e, 'ovTog');
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'ovTog');
  }
};
LY.push(
  ['Flächennutzung (CORINE)', 'clc', 0, 0.7],
  ['Naturschutzgebiete', 'nsg', 0, 0.7],
  ['FFH-Gebiete (Natura 2000)', 'ffh', 0, 0.7],
  ['Vogelschutzgebiete (Natura 2000)', 'vsg', 0, 0.7],
  ['Überschwemmungsrisiko (Fluss)', 'hq', 0, 0.7],
);
