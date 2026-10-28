// ---- ALKIS-Flurstücke (NRW, WFS "ALKIS vereinfacht") als Vektorlinien, auswählbar -> Grundstück
const AL = [];
S.parSel = new Set();
S.siteN = 0;
const ll2utm = (lon, lat, zone = 32) => {
  const a = 6378137,
    f = 1 / 298.257222101,
    k0 = 0.9996,
    e2 = f * (2 - f),
    ep2 = e2 / (1 - e2),
    lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180,
    phi = (lat * Math.PI) / 180,
    lam = (lon * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2),
    T = Math.tan(phi) ** 2,
    C = ep2 * Math.cos(phi) ** 2,
    A = Math.cos(phi) * (lam - lam0);
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const x =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000;
  const y =
    k0 *
    (M +
      N *
        Math.tan(phi) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  return [x, y];
};
const utm2ll = (x, y, zone = 32) => {
  const a = 6378137,
    f = 1 / 298.257222101,
    k0 = 0.9996,
    e2 = f * (2 - f),
    ep2 = e2 / (1 - e2),
    e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2)),
    lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const M = y / k0,
    mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256)),
    phi1 =
      mu +
      ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
      ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2),
    T1 = Math.tan(phi1) ** 2,
    C1 = ep2 * Math.cos(phi1) ** 2,
    R1 = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi1) ** 2, 1.5),
    D = (x - 500000) / (N1 * k0);
  const phi =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lam =
    lam0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) /
      Math.cos(phi1);
  return [(lam * 180) / Math.PI, (phi * 180) / Math.PI];
};
const PROXY_DEFAULT = 'https://lot-cors.marc-wilmesmeier.workers.dev/?url=',
  PXF = /bayernwolke\.de|(geoservices|geodaten)\.bayern\.de|daten-hamburg\.de/,
  viaOrder = (u) => (GEO.proxy && PXF.test(String(u)) ? [true, false] : [false, true]);
function proxySet(v) {
  GEO.proxy = (v || '').trim();
  try {
    localStorage.setItem('lot_proxy', GEO.proxy);
  } catch (e) {
    logErr(e, 'proxySet');
  }
}
try {
  const q = localStorage.getItem('lot_proxy');
  GEO.proxy = q === null ? PROXY_DEFAULT : q;
} catch (e) {
  GEO.proxy = PROXY_DEFAULT;
}
const proxyBase = () => {
    let p = (GEO.proxy || '').trim();
    if (!p) return '';
    if (!/[?&]\w+=$/.test(p) && !p.includes('?')) p = p.replace(/\/+$/, '') + '/?url=';
    return p;
  },
  viaProxy = (u) => (GEO.proxy ? proxyBase() + encodeURIComponent(u) : u);
const ALK = 'https://www.wfs.nrw.de/geobasis/wfs_nw_alkis_vereinfacht';
const inNRW = (lon, lat) => lon > 5.6 && lon < 9.6 && lat > 50.2 && lat < 52.6;
function gmlParse(txt, local) {
  local = local || 'Flurstueck';
  const d = new DOMParser().parseFromString(txt, 'text/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('Antwort ist kein lesbares GML');
  const ex = d.getElementsByTagNameNS('*', 'ExceptionText')[0];
  if (ex) throw new Error('Dienst meldet: ' + ex.textContent.trim().slice(0, 200));
  const out = [];
  for (const f of d.getElementsByTagNameNS('*', local)) {
    const props = {};
    for (const e of f.getElementsByTagName('*')) {
      if (e.children.length || !e.textContent.trim()) continue;
      const n = e.localName;
      if (/^(pos|posList|coordinates|lowerCorner|upperCorner)$/.test(n)) continue;
      if (!(n in props)) props[n] = e.textContent.trim().slice(0, 80);
    }
    const rings = [];
    for (const xe of f.getElementsByTagNameNS('*', 'exterior')) {
      let nums = [],
        dim = 2;
      const pl = xe.getElementsByTagNameNS('*', 'posList')[0];
      if (pl) {
        dim = +(pl.getAttribute('srsDimension') || (xe.closest ? 2 : 2)) || 2;
        nums = pl.textContent.trim().split(/\s+/).map(Number);
      } else
        for (const q of xe.getElementsByTagNameNS('*', 'pos')) {
          const t = q.textContent.trim().split(/\s+/).map(Number);
          dim = t.length;
          nums.push(...t);
        }
      if (dim !== 3) dim = 2;
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += dim) {
        const a = nums[i],
          b = nums[i + 1];
        if (!isFinite(a) || !isFinite(b)) continue;
        const lo = Math.min(a, b),
          hi = Math.max(a, b);
        const [lon, lat] = hi > 1e4 ? utm2ll(lo, hi) : [lo, hi];
        pts.push(ll2xz(lon, lat));
      }
      if (pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01)
        pts.pop();
      if (pts.length > 2) rings.push(pts);
    }
    if (!rings.length) continue;
    rings.sort((a, b) => area(b) - area(a));
    const pk = (re) => {
      const k = Object.keys(props).find((k) => re.test(k));
      return k ? props[k] : '';
    };
    const z = props.zaehler || props.flurstueckszaehler || pk(/z(ae|ä)hl|zae$/i),
      nn = props.nenner || props.flurstuecksnenner || pk(/nenn|nen$/i),
      kz =
        props.flurstueckskennzeichen || props.nationalCadastralReference || props.kennzeichen || pk(/kennz/i);
    const id = z
      ? z + (nn && nn !== '0' ? '/' + nn : '')
      : props.label || props.flurstuecksnummer || props.nummer || kz || 'Fl. ' + (out.length + 1);
    out.push({
      id,
      kz,
      poly: rings[0],
      rings,
      area: area(rings[0]),
      af: +props.amtlicheFlaeche || +props.areaValue || +pk(/^(amtl\w*)?fl(ae|ä)che$/i) || 0,
      props,
    });
  }
  return out;
}
// Flurstücks-Dienste je Bundesland (WFS). Typname + Namespace werden – außer NRW – aus GetCapabilities ermittelt (ALKIS vereinfacht oder INSPIRE CadastralParcel).
const AVE = 'http://repository.gdi-de.org/schemas/adv/produkt/alkis-vereinfacht/2.0';
const ALS = {
  nrw: [{ u: ALK, t: 'ave:Flurstueck', ns: AVE }],
  bb: [{ u: 'https://isk.geobasis-bb.de/ows/alkis_vereinf_wfs' }],
  sn: [{ u: 'https://geodienste.sachsen.de/aaa/public_alkis/vereinf/wfs' }],
  hh: [{ u: 'https://geodienste.hamburg.de/WFS_HH_ALKIS_vereinfacht' }],
  mv: [{ u: 'https://www.geodaten-mv.de/dienste/inspire_cp_alkis_download' }],
  st: [{ u: 'https://geodatenportal.sachsen-anhalt.de/ows_INSPIRE_LVermGeo_ALKIS_CP_WFS' }],
  be: [
    { u: 'https://gdi.berlin.de/services/wfs/alkis_flurstuecke', g: 1 },
    { u: 'https://gdi.berlin.de/services/wfs/liegenschaftsplan' },
  ],
  ni: [{ u: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wfs_einfach', g: 1 }],
  he: [{ u: 'https://www.gds.hessen.de/wfs2/aaa-suite/cgi-bin/alkis/vereinf/wfs', g: 1 }],
  bw: [{ u: 'https://owsproxy.lgl-bw.de/owsproxy/wfs/WFS_LGL-BW_ALKIS', g: 1 }],
};
const ALQ = {
  nrw: '© Geobasis NRW, dl-de/zero-2-0',
  bb: '© GeoBasis-DE/LGB, dl-de/by-2-0',
  sn: '© Geodaten Sachsen (GeoSN), dl-de/by-2-0',
  hh: '© FHH, LGV Hamburg, dl-de/by-2-0',
  mv: '© GeoBasis-DE/M-V, CC BY 4.0',
  st: '© GeoBasis-DE/LVermGeo ST, dl-de/by-2-0',
  be: '© Geoportal Berlin, dl-de/zero-2-0',
  ni: '© LGLN, CC BY 4.0',
  he: '© HVBG, dl-de/zero-2-0',
  bw: '© LGL-BW (' + new Date().getFullYear() + '), dl-de/by-2-0',
};
const BLN = {
  nrw: 'Nordrhein-Westfalen',
  by: 'Bayern',
  bw: 'Baden-Württemberg',
  ni: 'Niedersachsen',
  he: 'Hessen',
  st: 'Sachsen-Anhalt',
  sn: 'Sachsen',
  th: 'Thüringen',
  bb: 'Brandenburg',
  mv: 'Mecklenburg-Vorpommern',
  sh: 'Schleswig-Holstein',
  hh: 'Hamburg',
  hb: 'Bremen',
  be: 'Berlin',
  sl: 'Saarland',
  rp: 'Rheinland-Pfalz',
};
const BLX = {
  by: 'Bayern gibt Flurstücke nur an Vertragskunden (Entgelt/Rahmenvertrag) ab, frei nur als Karte (WMS). Mit Zugang: WFS https://geoservices.bayern.de/wfs/v1/ogc_alkis_ave.cgi (Typ ave:Flurstueck) unter „Projekt → Flurstücks-Dienst“ eintragen (Anmeldung ggf. über CORS-Proxy).',
  hb: 'Für Bremen wurde kein freier Flurstücks-Dienst gefunden.',
  th: 'Thüringen: freier WFS vorhanden, Adresse noch nicht hinterlegt.',
  sh: 'Schleswig-Holstein: Download vorhanden, freier WFS-Zugang noch nicht hinterlegt.',
  sl: 'Saarland: Download-Portal vorhanden, WFS-Adresse noch nicht hinterlegt.',
  rp: 'Rheinland-Pfalz: WFS ALKIS vereinfacht vorhanden, Lizenz/Adresse noch nicht geprüft.',
};
const BLB = {
  nrw: [5.8, 50.3, 9.5, 52.55],
  ni: [6.6, 51.28, 11.6, 53.9],
  hh: [9.7, 53.39, 10.35, 53.75],
  hb: [8.45, 53, 8.99, 53.65],
  sh: [7.8, 53.35, 11.35, 55.1],
  mv: [10.55, 53.1, 14.45, 54.7],
  bb: [11.25, 51.35, 14.8, 53.6],
  be: [13.08, 52.33, 13.77, 52.68],
  st: [10.55, 50.9, 13.2, 53.05],
  sn: [11.85, 50.15, 15.05, 51.7],
  th: [9.85, 50.2, 12.7, 51.65],
  he: [7.75, 49.38, 10.25, 51.7],
  rp: [6.1, 48.95, 8.55, 50.95],
  sl: [6.3, 49.1, 7.42, 49.65],
  bw: [7.5, 47.5, 10.5, 49.8],
  by: [8.95, 47.25, 13.85, 50.6],
};
const _wc = {};
async function wfsType(base) {
  if (_wc[base]) return _wc[base];
  const ac = new AbortController(),
    to = setTimeout(() => ac.abort(), 30000);
  try {
    const u = base + (base.includes('?') ? '&' : '?') + 'SERVICE=WFS&REQUEST=GetCapabilities&VERSION=2.0.0';
    const r = await fetch(viaProxy(u), { signal: ac.signal });
    if (!r.ok) throw new Error('GetCapabilities HTTP ' + r.status);
    const d = new DOMParser().parseFromString(await r.text(), 'text/xml');
    const ex = d.getElementsByTagNameNS('*', 'ExceptionText')[0];
    if (ex) throw new Error('Dienst meldet: ' + ex.textContent.trim().slice(0, 160));
    const fts = [...d.getElementsByTagNameNS('*', 'FeatureType')]
      .map((f) => {
        const n = f.getElementsByTagNameNS('*', 'Name')[0];
        if (!n) return null;
        const nm = n.textContent.trim(),
          i = nm.indexOf(':'),
          pre = i > 0 ? nm.slice(0, i) : '';
        return { nm, pre, loc: i > 0 ? nm.slice(i + 1) : nm, ns: n.lookupNamespaceURI(pre || null) || '' };
      })
      .filter(Boolean);
    if (!fts.length) throw new Error('keine Objektarten in der Dienstbeschreibung');
    const bad = /punkt|historisch|eigent|nutzung|gebaeude|gebäude|bezirk|verwalt|grenz|zoning|boundary/i;
    const tests = [
      (x) => /^Flurstueck$/i.test(x.loc),
      (x) => /^CadastralParcel$/i.test(x.loc),
      (x) => /^flurst(ue|ü)ck(e)?$/i.test(x.loc),
      (x) => /flurst(ue|ü)ck/i.test(x.loc) && !bad.test(x.loc),
      (x) => /cadastralparcel/i.test(x.loc) && !bad.test(x.loc),
    ];
    let ft = null;
    for (const t of tests) {
      ft = fts.find(t);
      if (ft) break;
    }
    if (!ft)
      throw new Error(
        'keine Flurstücks-Objektart gefunden (vorhanden: ' +
          fts
            .slice(0, 4)
            .map((x) => x.loc)
            .join(', ') +
          ')',
      );
    return (_wc[base] = { t: ft.nm, pre: ft.pre || 'x', loc: ft.loc, ns: ft.ns });
  } finally {
    clearTimeout(to);
  }
}
async function wfsParcels(sv, cx, cy, h) {
  const base = sv.u,
    ty = sv.t
      ? { t: sv.t, pre: sv.t.split(':')[0], loc: sv.t.split(':')[1], ns: sv.ns }
      : await wfsType(base);
  const tn = ty.ns ? ty.pre + ':' + ty.loc : ty.t;
  const u =
    base +
    (base.includes('?') ? '&' : '?') +
    'SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=' +
    encodeURIComponent(tn) +
    '&TYPENAME=' +
    encodeURIComponent(tn) +
    (ty.ns ? '&NAMESPACES=' + encodeURIComponent('xmlns(' + ty.pre + ',' + ty.ns + ')') : '') +
    '&SRSNAME=EPSG:25832&BBOX=' +
    [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(1)).join(',') +
    ',EPSG:25832';
  GEO.alkUrl = u;
  const ac = new AbortController(),
    to = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(viaProxy(u), { signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return gmlParse(await r.text(), ty.loc);
  } finally {
    clearTimeout(to);
  }
}
async function alkisLoad(lon, lat, size) {
  const [cx, cy] = ll2utm(lon, lat),
    h = size / 2,
    cu = (GEO.alkCustom || '').trim();
  let key = '',
    nm = '';
  try {
    const bl = await bundeslandC(lon, lat);
    if (bl) {
      key = bl.key || '';
      nm = bl.name || '';
    }
  } catch (e) {
    logErr(e, 'alkisLoad');
  }
  let keys = key
    ? [key]
    : Object.keys(BLB).filter((k) => {
        const b = BLB[k];
        return lon > b[0] && lon < b[2] && lat > b[1] && lat < b[3];
      });
  if (!key && keys.length === 1) {
    key = keys[0];
    nm = BLN[key];
  }
  GEO.alkBL = BLN[key] || nm || '';
  const tryList = [];
  if (cu) tryList.push({ k: key || 'custom', sv: { u: cu }, q: '' });
  else keys.forEach((k) => (ALS[k] || []).forEach((sv) => tryList.push({ k, sv, q: ALQ[k] || '' })));
  if (!tryList.length) {
    if (!keys.length)
      return {
        list: [],
        msg: 'Flurstücke: Bundesland für diesen Standort nicht erkannt (außerhalb Deutschlands?).',
      };
    const k0 = keys[0];
    return {
      list: [],
      msg:
        'Flurstücke: Für ' +
        (BLN[k0] || GEO.alkBL || 'dieses Bundesland') +
        ' ist noch kein freier Landesdienst hinterlegt. ' +
        (BLX[k0] || '') +
        ' Eigenen WFS unter „Projekt → Flurstücks-Dienst“ eintragen.',
    };
  }
  const errs = [];
  for (const t of tryList) {
    try {
      const list = await wfsParcels(t.sv, cx, cy, h);
      if (list.length) {
        GEO.alkBL = BLN[t.k] || GEO.alkBL;
        return { list, src: t.q, bl: GEO.alkBL, msg: '' };
      }
      errs.push((BLN[t.k] || t.k) + ': keine Flurstücke im Ausschnitt');
    } catch (e) {
      errs.push(
        (BLN[t.k] || t.k) +
          (t.sv.g ? ' (Adresse ungeprüft)' : '') +
          ': ' +
          (e && e.name === 'AbortError' ? 'Zeitüberschreitung' : e && e.message ? e.message : e),
      );
    }
  }
  return {
    list: [],
    msg:
      'Flurstücke (' +
      (GEO.alkBL || '?') +
      ') nicht geladen: ' +
      [...new Set(errs)].slice(0, 3).join(' | ') +
      ' – evtl. blockiert der Browser den Zugriff (CORS) oder der Dienst ist nicht erreichbar. Lösung: CORS-Proxy bzw. Flurstücks-Dienst unter „Projekt“ eintragen.',
  };
}
function parLabel(txt) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 40px Arial,Helvetica,sans-serif';
  const w = Math.min(250, x.measureText(txt).width);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = S.lc.parcels;
  x.fillText(txt, 128, 34, 250);
  const t = new T.CanvasTexture(c);
  t.anisotropy = 8;
  return { t, asp: w / 40 };
}
S.showSN = true;
S.showFN = true;
S.lc.rnames = '#6f6f6f';
function labVis() {
  const v = (k) => {
    const L = LY.find((l) => l[1] === k);
    return !L || !!L[2];
  };
  G.flab.visible = v('parcels') && S.showFN;
  G.rnam.visible = v('roads') && S.showSN;
  // ── Erweiterung aus 24-erweiterungen-v344-v436/100-eigenschaften.js (danach)
  try {
    G.hnr.visible = hnrOn();
  } catch (e) {
    logErr(e, 'labVis');
  }
}
function rnLabel(txt) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 44px Arial,Helvetica,sans-serif';
  if ('letterSpacing' in x) x.letterSpacing = '4px';
  const t = txt.toUpperCase(),
    tw = Math.min(1000, x.measureText(t).width);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = S.lc.rnames;
  x.fillText(t, 512, 34, 1000);
  const tx = new T.CanvasTexture(c);
  tx.anisotropy = 8;
  return { tx, asp: tw / 64 };
}
function clipLine(l, H) {
  const out = [];
  let cur = null;
  for (let i = 1; i < l.length; i++) {
    let [x0, z0] = l[i - 1],
      [x1, z1] = l[i],
      dx = x1 - x0,
      dz = z1 - z0,
      t0 = 0,
      t1 = 1,
      ok = true;
    for (const [pp, qq] of [
      [-dx, x0 + H],
      [dx, H - x0],
      [-dz, z0 + H],
      [dz, H - z0],
    ]) {
      if (pp === 0) {
        if (qq < 0) {
          ok = false;
          break;
        }
      } else {
        const r = qq / pp;
        if (pp < 0) {
          if (r > t1) {
            ok = false;
            break;
          }
          if (r > t0) t0 = r;
        } else {
          if (r < t0) {
            ok = false;
            break;
          }
          if (r < t1) t1 = r;
        }
      }
    }
    if (!ok) {
      cur = null;
      continue;
    }
    const a = [x0 + dx * t0, z0 + dz * t0],
      b = [x0 + dx * t1, z0 + dz * t1];
    if (!cur || Math.hypot(cur[cur.length - 1][0] - a[0], cur[cur.length - 1][1] - a[1]) > 0.5) {
      cur = [a];
      out.push(cur);
    }
    cur.push(b);
  }
  return out;
}
const plen = (l) => {
  let L = 0;
  for (let i = 1; i < l.length; i++) L += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
  return L;
};
function rnBuild() {
  G.rnam.traverse((o) => o.material && o.material.map && o.material.map.dispose());
  clr(G.rnam);
  const names = (GEO.acc && GEO.acc.names) || [];
  if (!names.length) {
    labVis();
    return;
  }
  const H = GEO.size / 2,
    groups = {};
  // 1) an Kartenausschnitt beschneiden, 2) gleichnamige, aneinanderstoßende Teilstücke zu Ketten verbinden
  for (const a of names) {
    for (const pc of clipLine(a.l, H)) {
      if (pc.length > 1) (groups[a.n] = groups[a.n] || []).push({ l: pc, w: a.w });
    }
  }
  const items = [];
  for (const n in groups) {
    let ps = groups[n].filter((q) => plen(q.l) > 0.3),
      ch = true;
    while (ch) {
      ch = false;
      outer: for (let i = 0; i < ps.length; i++)
        for (let k = i + 1; k < ps.length; k++) {
          const A = ps[i].l,
            B = ps[k].l,
            e = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 2.5;
          let m = null;
          if (e(A[A.length - 1], B[0])) m = A.concat(B.slice(1));
          else if (e(A[A.length - 1], B[B.length - 1])) m = A.concat(B.slice().reverse().slice(1));
          else if (e(A[0], B[B.length - 1])) m = B.concat(A.slice(1));
          else if (e(A[0], B[0])) m = B.slice().reverse().concat(A.slice(1));
          if (m) {
            ps[i] = { l: m, w: Math.max(ps[i].w, ps[k].w) };
            ps.splice(k, 1);
            ch = true;
            break outer;
          }
        }
    }
    for (const q of ps) items.push({ n, l: q.l, w: q.w, L: plen(q.l) });
  }
  items.sort((a, b) => b.w - a.w || b.L - a.L);
  const done = [];
  let cnt = 0;
  for (const a of items) {
    if (cnt > 450) break;
    if (a.L < 8) continue;
    let t = a.L / 2,
      px = 0,
      pz = 0,
      dx = 1,
      dz = 0;
    for (let i = 1; i < a.l.length; i++) {
      const d = Math.hypot(a.l[i][0] - a.l[i - 1][0], a.l[i][1] - a.l[i - 1][1]);
      if (t <= d || i === a.l.length - 1) {
        const f = Math.min(1, t / (d || 1));
        px = a.l[i - 1][0] + (a.l[i][0] - a.l[i - 1][0]) * f;
        pz = a.l[i - 1][1] + (a.l[i][1] - a.l[i - 1][1]) * f;
        dx = a.l[i][0] - a.l[i - 1][0];
        dz = a.l[i][1] - a.l[i - 1][1];
        break;
      }
      t -= d;
    }
    if (done.some((q) => q.n === a.n && Math.hypot(q.x - px, q.z - pz) < 60)) continue;
    if (dx < 0) {
      dx = -dx;
      dz = -dz;
    }
    // Schriftgröße folgt der Straßenbreite (Versalhöhe ≈ 0,5·Texthöhe -> bleibt innerhalb der Ränder)
    const lb = rnLabel(a.n);
    let hgt = Math.min(14, Math.max(2, a.w * 1.15));
    if (hgt * lb.asp > a.L * 0.95) {
      hgt = (a.L * 0.95) / lb.asp;
      if (hgt < Math.max(1.6, a.w * 0.6)) {
        lb.tx.dispose();
        continue;
      }
    }
    const m = new T.Mesh(
      new T.PlaneGeometry(hgt * 8, hgt * 0.5),
      new T.MeshBasicMaterial({
        map: lb.tx,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    m.rotation.order = 'YXZ';
    m.rotation.x = -Math.PI / 2;
    m.rotation.y = -Math.atan2(dz, dx);
    m.position.set(px, gh(px, pz) + 0.55, pz);
    m.renderOrder = 8;
    G.rnam.add(m);
    done.push({ n: a.n, x: px, z: pz });
    cnt++;
  }
  labVis();
}
function clipRing(r, H) {
  let out = r;
  for (const [ax, sg] of [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
  ]) {
    const inp = out;
    out = [];
    if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i],
        b = inp[(i + 1) % inp.length],
        da = sg * a[ax] - H,
        db = sg * b[ax] - H;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return out;
}
function clipParcels(list, H) {
  const res = [];
  for (const a of list) {
    let cut = false;
    const rings = [];
    for (const r of a.rings) {
      const c = clipRing(r, H);
      if (c.length < 3 || area(c) < 0.5) {
        cut = true;
        continue;
      }
      if (area(c) < area(r) * 0.999) cut = true;
      rings.push(c);
    }
    if (!rings.length) continue;
    rings.sort((x, y) => area(y) - area(x));
    res.push(Object.assign({}, a, { rings, poly: rings[0], area: area(rings[0]), cut }));
  }
  return res;
}
function parLines() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/060-grundstuecksgrenze.js
  const r = (() => {
    [G.parcels, G.flab].forEach((g) =>
      g.traverse((o) => {
        if (o.material && o.material.map) o.material.map.dispose();
      }),
    );
    clr(G.parcels);
    clr(G.flab);
    if (!AL.length && !P.some((q) => q.site)) return;
    const key = (q) => Math.round(q[0] * 20) + ',' + Math.round(q[1] * 20),
      ed = new Map();
    AL.forEach((a, i) =>
      a.rings.forEach((r) => {
        for (let k = 0; k < r.length; k++) {
          const p = r[k],
            q = r[(k + 1) % r.length],
            a1 = key(p),
            b1 = key(q),
            kk = a1 < b1 ? a1 + '|' + b1 : b1 + '|' + a1,
            e = ed.get(kk);
          if (e) e.n++;
          else ed.set(kk, { p, q, n: 1 });
        }
      }),
    );
    const sub = (p, q, y, fn) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
        n = Math.max(1, Math.ceil(L / 2));
      for (let j = 0; j < n; j++) {
        const x0 = p[0] + ((q[0] - p[0]) * j) / n,
          z0 = p[1] + ((q[1] - p[1]) * j) / n,
          x1 = p[0] + ((q[0] - p[0]) * (j + 1)) / n,
          z1 = p[1] + ((q[1] - p[1]) * (j + 1)) / n;
        fn(x0, gh(x0, z0) + y, z0, x1, gh(x1, z1) + y, z1);
      }
    };
    const sol = [],
      dsh = [];
    ed.forEach((e) => sub(e.p, e.q, 0.45, (...v) => (e.n > 1 ? dsh : sol).push(...v)));
    const mk = (arr, mat, ro) => {
      if (!arr.length) return null;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
      const l = new T.LineSegments(g, mat);
      if (mat.isLineDashedMaterial) l.computeLineDistances();
      l.renderOrder = ro;
      G.parcels.add(l);
      return l;
    };
    mk(sol, new T.LineBasicMaterial({ color: S.lc.parcels, transparent: true }), 3);
    mk(
      dsh,
      new T.LineDashedMaterial({ color: S.lc.parcels, dashSize: 0.9, gapSize: 0.6, transparent: true }),
      3,
    );
    // Bänder (scharfe, im Raum feste Breite) für Grundstücke und gewählte Flurstücke
    const ribbon = (rings, col, w, y, ro) => {
      const pa = [];
      rings.forEach((r) => {
        for (let k = 0; k < r.length; k++) {
          const p = r[k],
            q = r[(k + 1) % r.length],
            L = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (L < 1e-3) continue;
          const nx = ((-(q[1] - p[1]) / L) * w) / 2,
            nz = (((q[0] - p[0]) / L) * w) / 2;
          sub(p, q, y, (x0, y0, z0, x1, y1, z1) =>
            pa.push(
              x0 + nx,
              y0,
              z0 + nz,
              x0 - nx,
              y0,
              z0 - nz,
              x1 + nx,
              y1,
              z1 + nz,
              x0 - nx,
              y0,
              z0 - nz,
              x1 - nx,
              y1,
              z1 - nz,
              x1 + nx,
              y1,
              z1 + nz,
            ),
          );
        }
      });
      if (!pa.length) return;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
      const m = new T.Mesh(
        g,
        new T.MeshBasicMaterial({
          color: col,
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      m.renderOrder = ro;
      G.parcels.add(m);
    };
    const sr = [];
    S.parSel.forEach((i) => AL[i] && sr.push(...AL[i].rings));
    ribbon(sr, 0x5e7f92, 0.7, 0.7, 5);
    PBR.polys = P.filter((q) => q.site).map((q) => q.poly);
    // Flurstücksnummern, flach auf dem Gelände
    let nl = 0;
    const sorted = AL.map((a, i) => a).sort((a, b) => b.area - a.area);
    for (const a of sorted) {
      if (nl > 900 || a.area < 25 || a.cut) continue;
      let c = cen(a.poly);
      const xs = a.poly.map((q) => q[0]),
        zs = a.poly.map((q) => q[1]),
        bw = Math.max(...xs) - Math.min(...xs),
        bh = Math.max(...zs) - Math.min(...zs);
      if (!inP(c, a.poly))
        c = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2];
      const hgt = Math.min(3, Math.max(1.4, Math.sqrt(a.area) / 8)),
        lb = parLabel(a.id),
        w = hgt * lb.asp;
      if (w > bw * 1.05 && hgt * 2 > bh) continue;
      const m = new T.Mesh(
        new T.PlaneGeometry(hgt * 4, hgt),
        new T.MeshBasicMaterial({
          map: lb.t,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(c[0], gh(c[0], c[1]) + 0.6, c[1]);
      m.renderOrder = 7;
      G.flab.add(m);
      nl++;
    }
    const L = LY.find((l) => l[1] === 'parcels');
    if (L && L[3] < 1) op('parcels', L[3]);
    labVis();
  })();
  PBR.m = null;
  try {
    pbBuild(true);
  } catch (e) {
    logErr(e, 'parLines');
  }
  return r;
}
function parPaint() {
  const K = PW / GEO.size,
    X = (x) => (x + GEO.size / 2) * K,
    c = PL.parcels.getContext('2d');
  c.clearRect(0, 0, PW, PW);
  const path = (r) => r.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
  for (const p of P) {
    c.beginPath();
    path(p.poly);
    c.closePath();
    if (p.site) {
      c.fillStyle = 'rgba(94,127,146,.12)';
      c.fill();
    } else {
      c.fillStyle = 'rgba(244,244,244,.6)';
      c.fill();
      c.strokeStyle = '#7d7d7d';
      c.lineWidth = 1.5 * PS;
      c.stroke();
    }
  }
  S.parSel.forEach((i) => {
    const a = AL[i];
    if (!a) return;
    c.fillStyle = 'rgba(94,127,146,.22)';
    for (const r of a.rings) {
      c.beginPath();
      path(r);
      c.closePath();
      c.fill();
    }
  });
}
function parRefresh() {
  parLines();
  if (S.geo) {
    parPaint();
    bpPaint();
    recomp();
  }
  parBar();
}
function pickPar(g) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
  return inSite(g)
    ? -1
    : (() => {
        let bi = -1,
          ba = 1e18;
        AL.forEach((a, i) => {
          if (!a.cut && a.area < ba && a.rings.some((r) => inP(g, r))) {
            bi = i;
            ba = a.area;
          }
        });
        return bi;
      })();
}
const hasSite = () => P.some((q) => q.site);
function parClick(g, sh) {
  if (!AL.length) return;
  if (hasSite() && !S.siteEdit) return;
  const i = pickPar(g);
  if (S.siteEdit) {
    if (i >= 0) {
      S.parSel.has(i) ? S.parSel.delete(i) : S.parSel.add(i);
      parRefresh();
    }
    return;
  }
  if (i < 0) {
    if (!sh) S.parSel.clear();
  } else if (sh) {
    S.parSel.has(i) ? S.parSel.delete(i) : S.parSel.add(i);
  } else S.parSel = new Set([i]);
  parRefresh();
}
function mergeRings(rs) {
  const key = (p) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20);
  const orient = (r) => {
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      const q = r[(i + 1) % r.length];
      a += r[i][0] * q[1] - q[0] * r[i][1];
    }
    return a > 0 ? r : r.slice().reverse();
  };
  const edges = [];
  rs.forEach((r) => {
    const o = orient(r);
    o.forEach((p, i) => edges.push([p, o[(i + 1) % o.length]]));
  });
  const has = new Set(edges.map((e) => key(e[0]) + '>' + key(e[1]))),
    keep = edges.filter((e) => !has.has(key(e[1]) + '>' + key(e[0])));
  const nx = new Map();
  keep.forEach((e) => {
    const k = key(e[0]);
    if (!nx.has(k)) nx.set(k, []);
    nx.get(k).push(e);
  });
  const used = new Set(),
    loops = [];
  for (const e of keep) {
    if (used.has(e)) continue;
    const loop = [];
    let cur = e,
      g = 0;
    while (cur && !used.has(cur) && g++ < 100000) {
      used.add(cur);
      loop.push(cur[0]);
      const nl = nx.get(key(cur[1]));
      cur = nl && nl.find((x) => !used.has(x));
    }
    if (loop.length > 2) loops.push(loop);
  }
  loops.sort((a, b) => area(b) - area(a));
  return loops;
}
function selPolys() {
  const ps = [...S.parSel].map((i) => AL[i]).filter(Boolean);
  if (!ps.length) return { list: [], note: '' };
  if (ps.length > 1) {
    const L = mergeRings(ps.map((a) => a.poly)),
      sum = ps.reduce((t, a) => t + a.area, 0);
    if (L.length && Math.abs(area(L[0]) - sum) < 0.03 * sum)
      return { list: [{ poly: L[0], ids: ps.map((a) => a.id) }], note: '' };
    return {
      list: ps.map((a) => ({ poly: a.poly, ids: [a.id] })),
      note: 'Die Flurstücke grenzen nicht lückenlos aneinander – es wurde je Flurstück ein Grundstück angelegt.',
    };
  }
  return { list: [{ poly: ps[0].poly, ids: [ps[0].id] }], note: '' };
}
function siteFromSel() {
  if (S.siteEdit) return siteEditApply();
  if (hasSite()) {
    gst('Es ist bereits ein Grundstück gewählt – zuerst löschen.');
    return;
  }
  const { list, note } = selPolys();
  if (!list.length) return;
  if (list.length > 1) {
    gst('Die gewählten Flurstücke grenzen nicht aneinander – bitte zusammenhängende Flurstücke wählen.');
    alert('Die gewählten Flurstücke grenzen nicht aneinander. Bitte zusammenhängende Flurstücke wählen.');
    return;
  }
  let last;
  list.forEach((o) => {
    S.siteN++;
    last = {
      id: 'G' + S.siteN,
      name: 'Grundstück ' + S.siteN,
      poly: o.poly.map((q) => q.slice()),
      site: true,
      fl: o.ids,
    };
    P.push(last);
  });
  S.par = last;
  S.parSel = new Set();
  parRefresh();
  gst(
    note ||
      'Grundstück angelegt: ' +
        last.name +
        ' (' +
        (last.fl.length > 1 ? last.fl.length + ' Flurstücke zusammengelegt, ' : '') +
        f1(area(last.poly)) +
        ' m²).',
  );
  S.tab = 'Planen';
  nav();
  rr();
}
function parToDraft() {
  const { list } = selPolys();
  if (!list.length) return;
  cancel();
  S.dm = 'bld';
  S.draft = list[0].poly.map((q) => q.slice());
  S.closed = true;
  S.dk = 'free';
  S.tab = 'Planen';
  S.parSel = new Set();
  parRefresh();
  drawOv();
  nav();
  rr();
}
function parSelCard() {
  const sel = [...S.parSel].map((i) => AL[i]).filter(Boolean);
  if (!sel.length) return '';
  let h =
    '<div class="card">' +
    sel
      .slice(0, 8)
      .map((a) => kv('Flurstück ' + esc(a.id), f1(a.af || a.area) + ' m²'))
      .join('') +
    (sel.length > 8 ? '<div style="color:var(--mu)">… und ' + (sel.length - 8) + ' weitere</div>' : '');
  if (sel.length > 1) h += kv('Summe', f1(sel.reduce((t, a) => t + (a.af || a.area), 0)) + ' m²');
  if (S.siteEdit)
    return (
      h +
      '<button class="pri" onclick="siteEditApply()">Änderung übernehmen</button><button class="sm" style="margin-top:6px" onclick="siteEditCancel()">Abbrechen</button></div>'
    );
  return (
    h +
    '<button class="pri" onclick="siteFromSel()">' +
    (sel.length > 1 ? 'Als Grundstück zusammenlegen' : 'Als Grundstück übernehmen') +
    '</button><button class="sm" style="margin-top:6px" onclick="parToDraft()">Als Zeichenfläche übernehmen</button></div>'
  );
}
function plotInfo() {
  let h = '';
  const sc2 = parSelCard();
  if (sc2) h += '<h4>Gewählte Flurstücke</h4>' + sc2;
  const p = S.par;
  if (p) {
    h +=
      '<h4>Grundstück</h4><div class="card">' +
      kv(
        p.fl && p.fl.length > 1 ? 'Flurstücke' : p.fl && p.fl.length ? 'Flurstück' : 'Herkunft',
        p.fl && p.fl.length ? esc(p.fl.join(', ')) : p.site ? 'gezeichnet' : esc(p.id),
      ) +
      kv('Fläche', f1(area(p.poly)) + ' m²') +
      (p.site
        ? `<button class="sm" style="margin-top:6px" onclick="siteZ('${p.id}')">Als Zeichenfläche</button> ${p.fl && p.fl.length ? `<button class="sm" onclick="siteEditStart('${p.id}')">Flurstücke hinzufügen/entfernen</button> ` : ''}<button class="sm" onclick="siteDel('${p.id}')">Grundstück löschen</button><div style="color:var(--mu);font-size:11px;margin-top:4px">${p.fl && p.fl.length ? 'Ein Grundstück ist aktiv. Mit „Flurstücke hinzufügen/entfernen“ lässt es sich erweitern oder verkleinern; für ein anderes Flurstück zuerst löschen.' : 'Dieses Grundstück wurde gezeichnet. Mit „Als Zeichenfläche“ lässt sich die Kontur ändern; für ein anderes Grundstück zuerst löschen.'}</div>` +
          ctxOnBtn(p)
        : '') +
      '</div>';
  }
  return multiCard() + areaCard() + (h ? h + planInfo() : h);
}
function siteZ(id) {
  const q = P.find((a) => a.id === id);
  if (!q) return;
  cancel();
  S.dm = 'bld';
  S.draft = q.poly.map((c) => c.slice());
  S.closed = true;
  S.dk = 'free';
  S.tab = 'Planen';
  drawOv();
  nav();
  rr();
}
