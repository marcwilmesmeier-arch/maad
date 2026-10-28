/* ---------- Umweltdaten (WFS) ---------- */
const envProxyUrl = (u) => (GEO.proxy && typeof viaProxy === 'function' ? viaProxy(u) : u);
function axErr(e, u, viaP) {
  const m = e && e.message ? e.message : 'keine Antwort';
  let h = '';
  try {
    h = new URL(u).hostname;
  } catch (e) {
    logErr(e, 'axErr');
  }
  if (viaP && /HTTP 403/.test(m))
    return (
      'CORS-Proxy lässt den Host ' + h + ' nicht zu – im Worker unter ERLAUBT ergänzen (cors-proxy-worker.js)'
    );
  if (/Failed to fetch|NetworkError|Load failed/i.test(m))
    return 'Abruf von ' + h + ' blockiert (CORS) und kein Proxy-Weg';
  return m;
}
async function envFetch(u) {
  let last = null,
    lu = u;
  const vs = [u];
  if (GEO.proxy && typeof viaProxy === 'function') vs.push(viaProxy(u));
  for (const x of vs) {
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(x, { signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) {
        const e0 = new Error('HTTP ' + r.status);
        e0._http = 1;
        try {
          e0.body = (await r.text()).slice(0, 800);
        } catch (e) {
          logErr(e, 'envFetch');
        }
        throw e0;
      }
      return await r.text();
    } catch (e) {
      last = e;
      lu = x === u ? u : u;
      last._p = x !== u;
      if (e && e._http) break;
    }
  }
  if (last) {
    const er = new Error(axErr(last, u, last._p));
    er.body = last.body;
    throw er;
  }
  throw new Error('keine Antwort');
}
const xz2ll = ([x, z]) => [GEO.lon + x / GEO.kx, GEO.lat - z / 110574];
function envUrl(c, bb) {
  const base = c.url,
    sep = base.includes('?') ? '&' : '?',
    fmt = encodeURIComponent(c.fmt || 'application/json');
  if ((c.crs || '25832') === '4326') {
    const [a, b] = xz2ll([bb[0], bb[3]]),
      [d, e] = xz2ll([bb[2], bb[1]]);
    return (
      base +
      sep +
      'service=WFS&version=2.0.0&request=GetFeature&typeNames=' +
      encodeURIComponent(c.type) +
      '&outputFormat=' +
      fmt +
      '&srsName=' +
      encodeURIComponent('urn:ogc:def:crs:OGC:1.3:CRS84') +
      '&bbox=' +
      [a, b, d, e].map((v) => v.toFixed(6)).join(',') +
      ',urn:ogc:def:crs:OGC:1.3:CRS84'
    );
  }
  const [l0, t0] = xz2ll([bb[0], bb[3]]),
    [l1, t1] = xz2ll([bb[2], bb[1]]),
    [e0, n0] = ll2utm(l0, t1),
    [e1, n1] = ll2utm(l1, t0);
  return (
    base +
    sep +
    'service=WFS&version=2.0.0&request=GetFeature&typeNames=' +
    encodeURIComponent(c.type) +
    '&outputFormat=' +
    fmt +
    '&srsName=EPSG:25832&bbox=' +
    [Math.min(e0, e1), Math.min(n0, n1), Math.max(e0, e1), Math.max(n0, n1)]
      .map((v) => v.toFixed(1))
      .join(',') +
    ',EPSG:25832'
  );
}
function envConv(c, crs) {
  if (crs === '4326') return ll2xz(c[0], c[1]);
  const [lo, la] = utm2ll(c[0], c[1]);
  return ll2xz(lo, la);
}
const CLCN = {
  111: 'Durchgängig städtische Prägung',
  112: 'Nicht durchgängig städtische Prägung',
  121: 'Industrie- und Gewerbeflächen, öffentliche Einrichtungen',
  122: 'Straßen-, Eisenbahnnetze und funktionell zugeordnete Flächen',
  123: 'Hafengebiete',
  124: 'Flughäfen',
  131: 'Abbauflächen',
  132: 'Deponien und Abraumhalden',
  133: 'Baustellen',
  141: 'Städtische Grünflächen',
  142: 'Sport- und Freizeitanlagen',
  211: 'Nicht bewässertes Ackerland',
  221: 'Weinbauflächen',
  222: 'Obst- und Beerenobstbestände',
  231: 'Wiesen und Weiden',
  311: 'Laubwälder',
  312: 'Nadelwälder',
  313: 'Mischwälder',
  321: 'Natürliches Grünland',
  322: 'Heiden und Moorheiden',
  324: 'Wald-Strauch-Übergangsstadien',
  331: 'Strände, Dünen und Sandflächen',
  332: 'Felsen ohne Vegetation',
  333: 'Flächen mit spärlicher Vegetation',
  334: 'Brandflächen',
  335: 'Gletscher und Dauerschneegebiete',
  411: 'Sümpfe',
  412: 'Torfmoore',
  421: 'Salzwiesen',
  423: 'In der Gezeitenzone liegende Flächen',
  511: 'Gewässerläufe',
  512: 'Wasserflächen',
  521: 'Lagunen',
  522: 'Mündungsgebiete',
  523: 'Meere und Ozeane',
};
const clcLbl = (c) => c + ' ' + (CLCN[+c] || '');
const CLCC = {
  111: '#e6004d',
  112: '#ff0000',
  121: '#cc4df2',
  122: '#cc0000',
  123: '#e6cccc',
  124: '#e6cce6',
  131: '#a600cc',
  132: '#a64d00',
  133: '#ff4dff',
  141: '#ffa6ff',
  142: '#ffe6ff',
  211: '#ffffa8',
  212: '#ffff00',
  213: '#e6e600',
  221: '#e68000',
  222: '#f2a64d',
  223: '#e6a600',
  231: '#e6e64d',
  241: '#ffe6a6',
  242: '#ffe64d',
  243: '#e6cc4d',
  244: '#f2cca6',
  311: '#80ff00',
  312: '#00a600',
  313: '#4dff00',
  321: '#ccf24d',
  322: '#a6ff80',
  323: '#a6e64d',
  324: '#a6f200',
  331: '#e6e6e6',
  332: '#cccccc',
  333: '#ccffcc',
  334: '#000000',
  335: '#a6e6cc',
  411: '#a6a6ff',
  412: '#4d4dff',
  421: '#ccccff',
  422: '#e6e6ff',
  423: '#a6a6e6',
  511: '#00ccf2',
  512: '#80f2e6',
  521: '#00ffa6',
  522: '#a6ffe6',
  523: '#e6f2ff',
};
const clcCol = (c) => CLCC[+c] || '#888888';
function clcCode(o) {
  if (!o || typeof o !== 'object') return '';
  let v = null;
  for (const k in o) {
    if (/^(clc_?\d*|code_?\d*|clc_?code|klasse)$/i.test(k)) {
      const t = String(o[k]).trim();
      if (/^[1-5]\d\d$/.test(t)) return t;
    }
  }
  for (const k in o) {
    if (/clc/i.test(k)) {
      const t = String(o[k]).trim();
      if (/^[1-5]\d\d$/.test(t)) {
        v = t;
        break;
      }
    }
  }
  return v || '';
}
function clcTxt(t) {
  t = String(t || '').trim();
  if (t[0] === '{') {
    try {
      for (const f of JSON.parse(t).features || []) {
        const c = clcCode(f.properties);
        if (c) return c;
      }
    } catch (e) {
      logErr(e, 'clcTxt');
    }
    return '';
  }
  const m = t.match(/(?:CLC\w*|CODE_?\d*|KLASSE)\s*[=:]\s*"?([1-5]\d\d)\b/i);
  return m ? m[1] : '';
}
function envHit(feats, polys, crs) {
  const out = [];
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    const pgs = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const rings = pgs.map((pg) => pg[0].map((c) => envConv(c, crs))).filter((r) => r.length > 2);
    if (
      rings.some((o) =>
        polys.some((p) => {
          const c = cen(p);
          return inP(c, o) || p.some((q) => inP(q, o)) || o.some((q) => inP(q, p));
        }),
      )
    )
      out.push(f.properties || {});
  }
  return out;
}
function gmlToFeatures(x) {
  let d;
  try {
    d = new DOMParser().parseFromString(x, 'application/xml');
  } catch (_) {
    return null;
  }
  if (!d || !d.documentElement || d.getElementsByTagName('parsererror').length) return null;
  const ln = (e) => e.localName || String(e.nodeName).split(':').pop(),
    root = d.documentElement;
  if (ln(root) !== 'FeatureCollection') return null;
  const kids = (e) => [...e.children],
    out = [];
  kids(root)
    .filter((m) => /^(member|featureMember|featureMembers)$/.test(ln(m)))
    .forEach((m) =>
      kids(m).forEach((f) => {
        const feat = ln(m) === 'featureMembers' ? f : kids(m)[0];
        if (!feat || feat._d) return;
        feat._d = 1;
        const pr = {};
        kids(feat).forEach((c) => {
          if (!c.children.length) pr[ln(c)] = (c.textContent || '').trim();
        });
        const pgs = [...feat.getElementsByTagName('*')].filter((e) => ln(e) === 'Polygon'),
          co = [];
        pgs.forEach((pg) => {
          const rings = [];
          kids(pg).forEach((w) => {
            const pl = [...w.getElementsByTagName('*')].find((e) => ln(e) === 'posList');
            if (!pl) return;
            const dim =
                parseInt(pl.getAttribute('srsDimension') || pg.getAttribute('srsDimension') || '2', 10) || 2,
              v = (pl.textContent || '').trim().split(/\s+/).map(Number),
              r = [];
            for (let i = 0; i + 1 < v.length; i += dim) r.push([v[i], v[i + 1]]);
            if (r.length > 2) rings.push(r);
          });
          if (rings.length) co.push(rings);
        });
        out.push({ properties: pr, geometry: co.length ? { type: 'MultiPolygon', coordinates: co } : null });
      }),
    );
  return out;
}
const WFST = {};
const WFSC = {};
async function wfsCaps(c) {
  if (WFSC[c.url]) return WFSC[c.url];
  const sep = c.url.includes('?') ? '&' : '?',
    t = await envFetch(c.url + sep + 'service=WFS&version=2.0.0&request=GetCapabilities');
  WFSC[c.url] = t;
  return t;
}
async function wfsFmts(c) {
  try {
    const t = await wfsCaps(c),
      o = [];
    for (const m of t.matchAll(/name="outputFormat"[^>]*>([\s\S]*?)<\/(?:\w+:)?Parameter>/gi))
      for (const v of m[1].matchAll(/<(?:\w+:)?Value[^>]*>([^<]+)</g)) o.push(v[1].trim());
    return [...new Set(o)].sort((a, b) => (/json/i.test(b) ? 1 : 0) - (/json/i.test(a) ? 1 : 0));
  } catch (_) {
    return [];
  }
}
async function wfsTypes(c) {
  if (WFST[c.url]) return WFST[c.url];
  const t = await wfsCaps(c),
    r = [...t.matchAll(/<(?:\w+:)?FeatureType\b[\s\S]*?<(?:\w+:)?Name[^>]*>([^<]+)</g)].map((m) =>
      m[1].trim(),
    );
  if (r.length) WFST[c.url] = r;
  return r;
}
async function wfsFeatures(c, bb) {
  let cc = c;
  if (c.type === 'auto') {
    const ty = await wfsTypes(c),
      pk = ty.find((n) => /clc/i.test(n)) || ty[0];
    if (!pk) throw new Error('Dienst nennt keine Datentypen (GetCapabilities)');
    cc = Object.assign({}, c, { type: pk });
  }
  try {
    return await wfsFeatures0(cc, bb);
  } catch (err) {
    if (c.type === 'auto') throw err;
    let ty = [];
    try {
      ty = await wfsTypes(c);
    } catch (_) {
      throw err;
    }
    if (!ty.length || ty.includes(c.type)) throw err;
    const hit = /clc/i.test(c.url) ? ty.find((n) => /clc/i.test(n)) : ty.length === 1 ? ty[0] : null;
    if (!hit)
      throw new Error(
        ((err && err.message) || 'Fehler') +
          ' – Datentyp nicht im Dienst; vorhanden: ' +
          ty.slice(0, 4).join(', '),
      );
    return await wfsFeatures0(Object.assign({}, c, { type: hit }), bb);
  }
}
async function wfsFeatures0(c, bb) {
  let last = '',
    snip = '';
  const tried = new Set();
  const one = async (f) => {
    tried.add(f);
    let u = envUrl(Object.assign({}, c, { fmt: f }), bb);
    if (f === '-') u = u.replace(/&outputFormat=[^&]*/, '');
    let t;
    try {
      t = await envFetch(u);
    } catch (e) {
      const m = ((e && e.body) || '').match(/<[^>]*ExceptionText[^>]*>([^<]+)/);
      last = m ? m[1].trim().slice(0, 160) : (e && e.message) || 'Fehler';
      return null;
    }
    const tt = t.trim();
    if (tt[0] === '{') {
      try {
        const j = JSON.parse(tt);
        if (j.features) return j.features;
      } catch (e) {
        logErr(e, 'one');
      }
    }
    if (tt[0] === '<') {
      const g = gmlToFeatures(tt);
      if (g) return g;
      const m = tt.match(/<[^>]*ExceptionText[^>]*>([^<]+)/);
      if (m) last = m[1].trim().slice(0, 140);
      snip = tt.slice(0, 110).replace(/\s+/g, ' ');
    } else if (tt) snip = tt.slice(0, 110).replace(/\s+/g, ' ');
    return null;
  };
  const r1 = [c.fmt || 'application/json'];
  ['application/json', 'GEOJSON', 'application/geo+json'].forEach((f) => {
    if (!r1.includes(f)) r1.push(f);
  });
  for (const f of r1) {
    const r = await one(f);
    if (r) return r;
  }
  /* alle Formate des Dienstes (GetCapabilities) und zuletzt ohne Formatangabe (GML) */
  const r2 = (await wfsFmts(c)).filter((f) => !tried.has(f));
  r2.push('-');
  for (const f of r2) {
    const r = await one(f);
    if (r) return r;
  }
  throw new Error(last || 'Dienst lieferte kein GeoJSON' + (snip ? ' (Antwort: ' + snip + ')' : ''));
}
async function envRun(k) {
  const e = ENV.find((x) => x.k === k),
    c = envCfg(k),
    s = axSites();
  if (!e || !c || !c.url || !c.type || !s) return;
  const key = axKey(s);
  ENVR[k] = { site: key, busy: 1 };
  rr();
  try {
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9;
    s.polys.forEach((p) =>
      p.forEach((q) => {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        z0 = Math.min(z0, q[1]);
        z1 = Math.max(z1, q[1]);
      }),
    );
    if (c.kind === 'arcgis') {
      const rings = s.polys.map((p) => {
        let q = p.slice();
        if (q.length > 80) {
          const st = Math.ceil(q.length / 80);
          q = q.filter((_, i) => i % st === 0);
        }
        q = q.map((pt) => {
          const [lo, la] = xz2ll(pt);
          return ll2utm(lo, la).map((v) => Math.round(v * 100) / 100);
        });
        let a2 = 0;
        for (let i = 0; i < q.length; i++) {
          const u = q[i],
            w = q[(i + 1) % q.length];
          a2 += u[0] * w[1] - w[0] * u[1];
        }
        if (a2 > 0) q.reverse();
        q.push(q[0]);
        return q;
      });
      const g = JSON.stringify({ rings, spatialReference: { wkid: 25832 } }),
        xs = rings.flat().map((v) => v[0]),
        ys = rings.flat().map((v) => v[1]),
        env = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].join(',');
      const qs = (base, lid) => {
        const b0 =
            base.replace(/\/+$/, '') +
            (lid != null ? '/' + lid : '') +
            '/query?f=json&where=1%3D1&inSR=25832&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&',
          u2 = b0 + 'geometryType=esriGeometryPolygon&geometry=' + encodeURIComponent(g);
        return u2.length > 7000 ? b0 + 'geometryType=esriGeometryEnvelope&geometry=' + env : u2;
      };
      const jq = async (u) => {
        const j = JSON.parse(await envFetch(u));
        if (j.error)
          throw new Error(
            'Dienst: ' +
              (j.error.message || j.error.code) +
              (j.error.details && j.error.details[0] ? ' – ' + j.error.details[0] : ''),
          );
        return j;
      };
      const bases = (c.url || '').split(/[\s,;]+/).filter(Boolean);
      const tasks = [];
      for (const base of bases) {
        if (/\/\d+\/?$/.test(base)) tasks.push({ base, lid: null, nm: '' });
        else {
          const j = await jq(base.replace(/\/+$/, '') + '?f=json');
          const ly = (j.layers || []).filter((l) => !(l.subLayerIds && l.subLayerIds.length));
          if (!ly.length) throw new Error('Dienst ohne Layer: ' + base.split('/').slice(-2).join('/'));
          ly.forEach((l) =>
            tasks.push({ base, lid: l.id, nm: l.name, sv: base.split('/').slice(-2, -1)[0] }),
          );
        }
      }
      const rs = await Promise.all(
        tasks.map(async (t) => {
          try {
            const j = await jq(qs(t.base, t.lid));
            return { t, fs: j.features || [] };
          } catch (e) {
            return { t, err: (e && e.message) || String(e) };
          }
        }),
      );
      if (rs.every((r) => r.err)) throw new Error(rs[0].err);
      const pt = { T: 'Trinkwasserschutzgebiet', S: 'Heilquellenschutzgebiet' },
        nmRe = /^(name|gebietsname|bezeichnung|poly_name)$/i;
      let n = 0;
      const names = [],
        vals = [];
      rs.forEach((r) => {
        if (!r.fs || !r.fs.length) return;
        n += r.fs.length;
        const lbl = r.t.nm ? r.t.nm.replace(/_/g, ' ') : '';
        if (lbl && !names.includes(lbl)) names.push(lbl);
        r.fs.forEach((f) => {
          const a = f.attributes || {},
            nm = axProp(a, nmRe) || axProp(a, /^(wsg|schutzgeb)/i),
            t =
              pt[
                String(a.PROT_TYPE || '')
                  .trim()
                  .toUpperCase()
              ] || '',
            z = String(a.WSG_ZONE || '').trim(),
            v = t + (z ? (t ? ' ' : '') + (/zone/i.test(z) ? z : 'Zone ' + z) : '');
          if (v && !vals.includes(v)) vals.push(v);
          if (nm && !r.t.nm && !names.includes(nm)) names.push(nm);
        });
      });
      ENVR[k] = {
        site: key,
        res: { hit: n > 0, n, names: names.slice(0, 3), val: vals.slice(0, 3).join(' / ') },
        t: Date.now(),
      };
      rr();
      return;
    }
    if (c.kind === 'wms' && /^\d+:[^,:]+:[TN]/.test(c.type || '')) {
      const cc = s.polys[0],
        ce = cen(cc),
        [lo, la] = xz2ll(ce),
        d = 0.00005,
        ls = c.type
          .split(',')
          .map((x) => x.trim().split(':'))
          .filter((a) => a.length >= 3),
        bs = (u0) =>
          c.url +
          (c.url.includes('?') ? '&' : '?') +
          'service=WMS&version=1.3.0&request=GetFeatureInfo&layers=' +
          u0 +
          '&query_layers=' +
          u0 +
          '&styles=&crs=CRS%3A84&bbox=' +
          [lo - d, la - d, lo + d, la + d].join(',') +
          '&width=101&height=101&i=50&j=50&feature_count=5&info_format=';
      const parse = (tt) => {
        tt = tt.trim();
        if (/ServiceException|ExceptionText/i.test(tt)) throw new Error('Dienst meldet einen Fehler');
        if (tt[0] === '{') {
          return (JSON.parse(tt).features || []).map((f) => f.properties || {});
        }
        const out = [];
        let cur = null;
        tt.split(/\r?\n/).forEach((l) => {
          if (/^\s*Feature\s*\d*\s*:?\s*$/i.test(l)) {
            cur = {};
            out.push(cur);
          } else {
            const m = l.match(/^\s*([^=:\s][^=]*?)\s*=\s*(.*)$/);
            if (m) {
              if (!cur) {
                cur = {};
                out.push(cur);
              }
              cur[m[1]] = m[2].trim();
            }
          }
        });
        return out.filter((o) => Object.keys(o).length);
      };
      const band = (o) => {
        const sk = /^(objectid|fid|shape|area|len|oid|gml_id|esri|id$|shape_)/i,
          pk = /(lden|lnight|l_den|l_night|klasse|class|pegel|range|bereich|isophon|gridcode|wert|value|db)/i;
        let k1 =
          Object.keys(o).find((k) => pk.test(k) && !sk.test(k) && o[k] !== '' && o[k] != null) ||
          Object.keys(o).find(
            (k) =>
              !sk.test(k) &&
              o[k] !== '' &&
              o[k] != null &&
              String(o[k]).length < 20 &&
              /\d/.test(String(o[k])),
          );
        return k1
          ? String(o[k1])
              .replace(/\s*[-–]\s*/, '–')
              .replace(/\s*dB.*$/i, '')
              .trim()
          : '';
      };
      const rs = await Promise.all(
        ls.map(async (a) => {
          for (const f of ['application/geo+json', 'application/json', 'text/plain']) {
            try {
              const t = await envFetch(bs(encodeURIComponent(a[0])) + encodeURIComponent(f));
              const pr = parse(t);
              return { a, pr };
            } catch (e) {
              if (f === 'text/plain') return { a, err: (e && e.message) || String(e) };
            }
          }
        }),
      );
      if (rs.every((r) => r.err)) throw new Error(rs[0].err);
      const grp = { T: {}, N: {} };
      rs.forEach((r) => {
        if (!r.pr || !r.pr.length) return;
        const b = [...new Set(r.pr.map(band).filter(Boolean))].join('/');
        (grp[r.a[2]][r.a[1]] = grp[r.a[2]][r.a[1]] || []).push(b || 'kartiert');
      });
      const fm = (g) =>
        Object.keys(g)
          .map((q) => q + ' ' + [...new Set(g[q])].join('/'))
          .join(', ');
      const parts = [];
      if (Object.keys(grp.T).length) parts.push('Tag: ' + fm(grp.T) + ' dB(A)');
      if (Object.keys(grp.N).length) parts.push('Nacht: ' + fm(grp.N) + ' dB(A)');
      ENVR[k] = {
        site: key,
        res: { hit: parts.length > 0, n: parts.length, names: [], val: parts.join(' · ') },
        t: Date.now(),
      };
      rr();
      return;
    }
    if (c.kind === 'wms') {
      const cc = s.polys[0],
        ce = cen(cc),
        [lo, la] = xz2ll(ce),
        d = 0.00005,
        u0 =
          c.url +
          (c.url.includes('?') ? '&' : '?') +
          'service=WMS&version=1.3.0&request=GetFeatureInfo&layers=' +
          encodeURIComponent(c.type) +
          '&query_layers=' +
          encodeURIComponent(c.type) +
          '&styles=&crs=' +
          encodeURIComponent('CRS:84') +
          '&bbox=' +
          [lo - d, la - d, lo + d, la + d].join(',') +
          '&width=101&height=101&i=50&j=50&feature_count=5&info_format=';
      let t2 = '';
      try {
        t2 = await envFetch(u0 + encodeURIComponent('application/json'));
      } catch (_) {
        t2 = await envFetch(u0 + encodeURIComponent('text/plain'));
      }
      if (e.clc) {
        const cd = clcTxt(t2);
        ENVR[k] = {
          site: key,
          res: { hit: !!cd, n: cd ? 1 : 0, names: [], val: cd ? clcLbl(cd) : '', items: cd ? [[cd, 0]] : [] },
          t: Date.now(),
        };
        rr();
        return;
      }
      let hit = false,
        val = '';
      const tt = t2.trim();
      if (tt[0] === '{') {
        const j = JSON.parse(tt);
        const fs = j.features || [];
        hit = fs.length > 0;
        if (hit && c.attr)
          val = [
            ...new Set(
              fs.map((f) => f.properties && f.properties[c.attr]).filter((v) => v != null && v !== ''),
            ),
          ]
            .slice(0, 3)
            .join(' / ');
        else if (hit) {
          let num = null;
          for (const f of fs) {
            for (const k2 in f.properties || {}) {
              const v2 = f.properties[k2];
              if (/^(id|fid|objectid|gml_id)$/i.test(k2)) continue;
              const n2 =
                typeof v2 === 'number'
                  ? v2
                  : typeof v2 === 'string' && /^-?\d+([.,]\d+)?$/.test(v2.trim())
                    ? parseFloat(v2.replace(',', '.'))
                    : NaN;
              if (isFinite(n2)) {
                num = n2;
                break;
              }
            }
            if (num != null) break;
          }
          if (num != null) {
            hit = num > 0;
            if (hit) val = 'Wert ' + String(Math.round(num * 100) / 100).replace('.', ',');
          }
        }
      } else {
        if (/ExceptionText|ServiceException/i.test(tt)) throw new Error('Dienst meldet einen Fehler');
        const mN = tt.match(/=\s*(-?\d+(?:[.,]\d+)?)\s*$/m);
        if (mN) {
          const n3 = parseFloat(mN[1].replace(',', '.'));
          hit = n3 > 0;
          val = hit ? 'Wert ' + String(Math.round(n3 * 100) / 100).replace('.', ',') : '';
          ENVR[k] = { site: key, res: { hit, n: hit ? 1 : 0, names: [], val }, t: Date.now() };
          rr();
          return;
        }
        hit =
          tt.length > 0 &&
          !/^\s*(no features|keine)/i.test(tt) &&
          !/<FeatureInfoResponse\s*\/>|<FeatureInfoResponse>\s*<\/FeatureInfoResponse>/i.test(tt);
        if (hit && c.attr) {
          const m = tt.match(new RegExp(c.attr + '\\s*[=:]\\s*"?([^"\\n<,;]+)', 'i'));
          if (m) val = m[1].trim();
        }
      }
      ENVR[k] = {
        site: key,
        res: { hit, n: hit ? 1 : 0, names: [], val: val && /^[\d.,\s\/]+$/.test(val) ? val + ' dB(A)' : val },
        t: Date.now(),
      };
      rr();
      return;
    }
    const feats = await wfsFeatures(c, [x0, z0, x1, z1]);
    if (e.clc) {
      const crs0 = c.crs || '25832',
        PL = [];
      feats.forEach((f) => {
        const g = f.geometry;
        if (!g) return;
        const cd = clcCode(f.properties);
        if (!cd) return;
        const pgs = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        pgs.forEach((pg) => {
          const rg = pg.map((r2) => r2.map((q) => envConv(q, crs0)));
          if (rg[0] && rg[0].length > 2) PL.push({ cd, o: rg[0], h: rg.slice(1) });
        });
      });
      const cnt = {};
      let tot = 0;
      s.polys.forEach((p) => {
        let a0 = 1e9,
          a1 = -1e9,
          b0 = 1e9,
          b1 = -1e9;
        p.forEach((q) => {
          a0 = Math.min(a0, q[0]);
          a1 = Math.max(a1, q[0]);
          b0 = Math.min(b0, q[1]);
          b1 = Math.max(b1, q[1]);
        });
        const st = Math.max(1, Math.sqrt(((a1 - a0) * (b1 - b0)) / 1600));
        for (let x = a0 + st / 2; x < a1; x += st)
          for (let z = b0 + st / 2; z < b1; z += st) {
            if (!inP([x, z], p)) continue;
            tot++;
            const m = PL.find((o) => inP([x, z], o.o) && !o.h.some((h2) => inP([x, z], h2)));
            if (m) cnt[m.cd] = (cnt[m.cd] || 0) + 1;
          }
      });
      if (!tot) {
        const m = PL.find((o) => inP(cen(s.polys[0]), o.o));
        if (m) {
          cnt[m.cd] = 1;
          tot = 1;
        }
      }
      const ks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]),
        kk = ks.filter((k2, i) => i === 0 || cnt[k2] / tot >= 0.01).slice(0, 8),
        val = kk
          .map(
            (k2) =>
              clcLbl(k2) +
              (ks.length > 1 || cnt[k2] < tot ? ' (' + Math.round((100 * cnt[k2]) / tot) + ' %)' : ''),
          )
          .join(', ');
      ENVR[k] = {
        site: key,
        res: {
          hit: ks.length > 0,
          n: ks.length,
          names: [],
          val,
          items: kk.map((k2) => [k2, Math.max(1, Math.round((100 * cnt[k2]) / tot))]),
        },
        t: Date.now(),
      };
      rr();
      return;
    }
    const hits = envHit(feats, s.polys, c.crs || '25832'),
      names = [
        ...new Set(
          hits
            .map((p) =>
              axProp(p, /^(name|gebietsname|bezeichnung|titel|ns_name|wsg_name|gebiet|sitename|site_name)/i),
            )
            .filter(Boolean),
        ),
      ].slice(0, 3);
    const val =
      c.attr && hits.length
        ? [...new Set(hits.map((p) => p[c.attr]).filter((v) => v != null && v !== ''))]
            .slice(0, 3)
            .join(' / ')
        : '';
    ENVR[k] = { site: key, res: { hit: hits.length > 0, n: hits.length, names, val }, t: Date.now() };
  } catch (err) {
    ENVR[k] = { site: key, err: err && err.message ? err.message : String(err), t: Date.now() };
  }
  rr();
}
async function envAll() {
  for (const e of ENV) {
    const c = envCfg(e.k);
    if (c && c.url && c.type) await envRun(e.k);
  }
}
async function envCaps(k, land) {
  const c = envCfgFor(k, land);
  if (!c || !c.url) return;
  const ck = 'caps_' + k + (land ? '@' + land : '');
  ENVR[ck] = { busy: 1 };
  rr();
  if (c.kind === 'arcgis') {
    try {
      const j = JSON.parse(await envFetch(c.url.replace(/\/+$/, '') + '?f=pjson'));
      if (j.error) throw new Error('Dienst: ' + (j.error.message || j.error.code));
      ENVR[ck] = {
        info:
          (j.name || 'Layer') +
          ' · ' +
          (j.geometryType || '').replace('esriGeometry', '') +
          ' · Felder: ' +
          (j.fields || [])
            .map((f) => f.name)
            .join(', ')
            .slice(0, 300),
      };
    } catch (err) {
      ENVR[ck] = { err: err.message || String(err) };
    }
    rr();
    return;
  }
  try {
    const w = c.kind === 'wms',
      u =
        c.url +
        (c.url.includes('?') ? '&' : '?') +
        'service=' +
        (w ? 'WMS&version=1.3.0' : 'WFS&version=2.0.0') +
        '&request=GetCapabilities',
      t = await envFetch(u),
      names = (
        w
          ? [...t.matchAll(/<Layer[^>]*queryable="(?:1|true)"[^>]*>\s*<Name>([^<]+)<\/Name>/g)]
          : [...t.matchAll(/<(?:\w+:)?FeatureType[\s>][\s\S]*?<(?:\w+:)?Name[^>]*>([^<]+)<\/(?:\w+:)?Name>/g)]
      ).map((m) => m[1].trim());
    if (!names.length) throw new Error('keine Ebenen gefunden');
    ENVR[ck] = { names: names.slice(0, 200) };
  } catch (err) {
    ENVR[ck] = { err: err.message || String(err) };
  }
  rr();
}
function envTgt(k, land, mk) {
  if (envScope(k) === 'land') {
    const L = land || envLand();
    if (!L) return null;
    if (!ENVL[k]) {
      if (!mk) return null;
      ENVL[k] = {};
    }
    if (!ENVL[k][L] && mk) ENVL[k][L] = {};
    return ENVL[k][L] || null;
  }
  if (!ENVC[k] && mk) ENVC[k] = {};
  return ENVC[k] || null;
}
function envSet(k, f, v, land) {
  const t = envTgt(k, land, 1);
  if (!t) return;
  t[f] = String(v).trim();
  envSave();
  delete ENVR[k];
  rr();
}
function envClear(k, land) {
  if (envScope(k) === 'land') {
    const L = land || envLand();
    if (ENVL[k]) delete ENVL[k][L];
  } else delete ENVC[k];
  delete ENVR[k];
  delete ENVR['caps_' + k + (land ? '@' + land : '')];
  envSave();
  rr();
}
function envPick(k, i, land) {
  const r = ENVR['caps_' + k + (land ? '@' + land : '')];
  if (r && r.names[i]) envSet(k, 'type', r.names[i], land);
}
const envTg = (e) => {
  const c = envCfg(e.k);
  return c && c.url && c.type && typeof OVL !== 'undefined' && OVL[e.k] ? e.k : '';
};
function envRow(e, s) {
  const c = envCfg(e.k),
    r = ENVR[e.k],
    key = axKey(s),
    ok = c && c.url && c.type;
  let v,
    na = 0;
  if (e.opt && !ok) return '';
  if (!ok) {
    v = 'nicht angebunden';
    na = 1;
  } else if (r && r.busy) v = 'wird geprüft …';
  else if (r && r.site === key && r.err) {
    v = 'Fehler';
    na = 1;
  } else if (r && r.site === key && r.res) {
    const q = r.res;
    v = q.hit
      ? (e.yes || '') +
        (q.val ? (e.yes ? ' · ' : '') + esc(q.val) : '') +
        (q.names.filter((n) => !(e.yes && n.toLowerCase().indexOf(e.yes.toLowerCase()) >= 0)).length
          ? ' <span class="mu">(' +
            esc(
              q.names.filter((n) => !(e.yes && n.toLowerCase().indexOf(e.yes.toLowerCase()) >= 0)).join(', '),
            ) +
            ')</span>'
          : '')
      : e.no;
    if (q.hit && !v) v = 'vorhanden';
  } else {
    v = '<button class="axs2" onclick="envRun(\'' + e.k + '\')">prüfen</button>';
  }
  let x = axR(e.n, v, na);
  if (e.clc && r && !r.busy && r.site === key && r.res && r.res.items && r.res.items.length > 1)
    x =
      '<div class="clcl">' +
      r.res.items
        .map(
          ([cd, pc]) =>
            '<div class="clcr"><span>' +
            esc(clcLbl(cd)) +
            '</span>' +
            (pc ? '<b>' + pc + ' %</b>' : '') +
            '</div>',
        )
        .join('') +
      '</div>';
  if (ok && r && r.site === key && r.err)
    x += '<div class="axk" style="color:var(--wa)">' + esc(r.err) + '</div>';
  if (!ok)
    x +=
      '<div class="axk">Quelle einbinden unter <a class="axl" onclick="srcOpen(\'um\')">Datenquellen &amp; Einstellungen</a></div>';
  if (ok && typeof OVL !== 'undefined' && OVL[e.k]) {
    const on = typeof ovVis === 'function' && ovVis(e.k),
      d = typeof OVD !== 'undefined' && OVD[e.k];
    if (on && d && d.st === 'err' && !(r && r.site === key && r.err === d.msg))
      x += '<div class="axk" style="color:var(--wa)">Karten-Ebene: ' + esc(d.msg) + '</div>';
  }
  return x;
}
