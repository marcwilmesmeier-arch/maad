/* v301: Oberflächenmodell (DOM) aus USGS-3DEP-Lidar (AWS-Bucket usgs-lidar-public, EPT/LAZ). Pro Ausschnitt: Projekt finden → EPT-Knoten im Ausschnitt laden → LAZ entpacken (laz-perf/WASM) → höchster Punkt je Rasterzelle. */
Object.assign(USA, {
  res: 'https://usgs.entwine.io/boundaries/resources.geojson',
  eptRoot: 'https://usgs-lidar-public.s3.amazonaws.com/',
  lazBase: 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.6/lib/web/',
  cache: {},
});
const mercLL = (x, y) => [
    ((x / 6378137) * 180) / Math.PI,
    ((2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180) / Math.PI,
  ],
  llMerc = (lon, lat) => [
    ((lon * Math.PI) / 180) * 6378137,
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 6378137,
  ];
let _laz = null;
async function lazInit() {
  if (_laz) return _laz;
  const base = (GEO.lazBase || USA.lazBase).replace(/\/?$/, '/');
  let fac = null,
    err = '';
  try {
    const m = await import(base + 'laz-perf.js');
    fac = m.createLazPerf || m.default || null;
  } catch (e) {
    err = String(e.message || e);
  }
  if (!fac) {
    await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = base + 'laz-perf.js';
      s.onload = ok;
      s.onerror = () => no(new Error('laz-perf nicht ladbar (' + base + ')' + (err ? ': ' + err : '')));
      document.head.appendChild(s);
    });
    fac = window.createLazPerf || window.Module || null;
  }
  if (!fac) throw new Error('laz-perf: keine Initialisierungsfunktion gefunden');
  _laz = await (typeof fac === 'function' ? fac({ locateFile: (f) => base + f }) : fac);
  return _laz;
}
/* ein LAZ-Knoten → ruft cb(x,y,z,klasse) je Punkt (x,y in EPT-Koordinaten) */
async function lazEach(buf, cb) {
  const L = await lazInit(),
    dv = new DataView(buf),
    off = dv.getUint32(96, true),
    fmt = dv.getUint8(104) & 63,
    rl = dv.getUint16(105, true);
  let n = dv.getUint32(107, true);
  if (!n && buf.byteLength > 247 + 8) n = Number(dv.getBigUint64(247, true));
  const sx = dv.getFloat64(131, true),
    sy = dv.getFloat64(139, true),
    sz = dv.getFloat64(147, true),
    ox = dv.getFloat64(155, true),
    oy = dv.getFloat64(163, true),
    oz = dv.getFloat64(171, true),
    co = fmt >= 6 ? 16 : 15;
  const lz = new L.LASZip(),
    fp = L._malloc(buf.byteLength);
  L.HEAPU8.set(new Uint8Array(buf), fp);
  lz.open(fp, buf.byteLength);
  const cnt = lz.getCount ? lz.getCount() : n,
    pl = lz.getPointLength ? lz.getPointLength() : rl,
    dp = L._malloc(pl);
  try {
    for (let i = 0; i < cnt; i++) {
      lz.getPoint(dp);
      const p = new DataView(L.HEAPU8.buffer, dp, pl);
      cb(
        p.getInt32(0, true) * sx + ox,
        p.getInt32(4, true) * sy + oy,
        p.getInt32(8, true) * sz + oz,
        fmt >= 6 ? p.getUint8(co) : p.getUint8(co) & 31,
      );
    }
  } finally {
    L._free(dp);
    L._free(fp);
    try {
      lz.delete();
    } catch (e) {
      logErr(e, 'lazEach');
    }
  }
  return cnt;
}
function ringsHit(g, lon, lat) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const inr = (r, x, y) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  return polys.some((pg) => {
    const m = Math.abs(pg[0][0][0]) > 400,
      xy = m ? llMerc(lon, lat) : [lon, lat];
    return inr(pg[0], xy[0], xy[1]) && !pg.slice(1).some((h) => inr(h, xy[0], xy[1]));
  });
}
async function eptFind(lon, lat) {
  const cu = (GEO.eptUrl || '').trim();
  if (cu) return { url: cu.replace(/ept\.json.*$/, ''), name: 'eigenes Projekt' };
  const r = await wfetch(USA.res, 60000),
    j = await r.json();
  let best = null;
  for (const f of j.features || []) {
    if (!f.geometry || !ringsHit(f.geometry, lon, lat)) continue;
    const pr = f.properties || {},
      nm = pr.name || pr.Name || '',
      u = pr.url || pr.URL || '',
      yr = +(pr.year || (/(20\d\d|19\d\d)/.exec(nm) || [])[1] || 0);
    if (!best || yr > best.yr) best = { url: u || USA.eptRoot + nm + '/', name: nm || u, yr };
  }
  if (!best) throw new Error('kein USGS-Lidar-Projekt für diesen Standort gefunden');
  best.url = best.url.replace(/ept\.json.*$/, '').replace(/\/?$/, '/');
  return best;
}
async function eptNodes(base, bb, res, cos) {
  const ept = await (await wfetch(base + 'ept.json', 60000)).json(),
    B = ept.bounds,
    hz = String((ept.srs || {}).horizontal || '');
  if (hz && hz !== '3857')
    throw new Error('EPT-Koordinatensystem ' + hz + ' nicht unterstützt (erwartet 3857)');
  if (ept.dataType && ept.dataType !== 'laszip')
    throw new Error('EPT-Datentyp ' + ept.dataType + ' nicht unterstützt');
  const W = B[3] - B[0],
    sp = (d) => W / ept.span / 2 ** d,
    hit = (k) => {
      const [d, x, y] = k.split('-').map(Number),
        s = W / 2 ** d;
      return (
        B[0] + x * s <= bb[2] &&
        B[0] + (x + 1) * s >= bb[0] &&
        B[1] + y * s <= bb[3] &&
        B[1] + (y + 1) * s >= bb[1]
      );
    };
  const hier = {},
    pages = new Set(),
    getPage = async (k) => {
      pages.add(k);
      Object.assign(hier, await (await wfetch(base + 'ept-hierarchy/' + k + '.json', 60000)).json());
    };
  await getPage('0-0-0-0');
  const out = [];
  let dep = 0;
  for (let d = 0; d <= 16; d++) {
    let again = true;
    while (again) {
      again = false;
      for (const k of Object.keys(hier)) {
        if (hier[k] === -1 && !pages.has(k) && +k.split('-')[0] <= d && hit(k)) {
          await getPage(k);
          again = true;
        }
      }
    }
    const lvl = Object.keys(hier).filter((k) => hier[k] > 0 && +k.split('-')[0] === d && hit(k));
    if (d > 0 && out.length + lvl.length > 90) break;
    out.push(...lvl);
    dep = d;
    if (sp(d) * cos <= res) break;
  }
  return { nodes: out, depth: dep, spacing: sp(dep) * cos };
}
async function domUSA(lon, lat, size, lab) {
  const key = [lon.toFixed(5), lat.toFixed(5), size].join(','),
    ck = USA.cache[key];
  if (ck) return ck;
  try {
    const DG = await dgmUSA(lon, lat, size, 'DGM1');
    if (!DG || DG.fail) throw new Error('DGM der Rasterbasis nicht verfügbar: ' + ((DG && DG.msg) || ''));
    const pj = await eptFind(lon, lat),
      zone = DG.zone,
      W = DG.w,
      Hh = DG.h,
      res = DG.res,
      cos = Math.cos((lat * Math.PI) / 180);
    const c4 = [
        [DG.minx, DG.maxy],
        [DG.minx + W * res, DG.maxy - Hh * DG.resY],
      ],
      ll = [0, 1].map((i) => utm2ll(c4[i][0], c4[i][1], zone)),
      pad = 0.0004,
      m0 = llMerc(Math.min(ll[0][0], ll[1][0]) - pad, Math.min(ll[0][1], ll[1][1]) - pad),
      m1 = llMerc(Math.max(ll[0][0], ll[1][0]) + pad, Math.max(ll[0][1], ll[1][1]) + pad),
      bb = [m0[0], m0[1], m1[0], m1[1]];
    /* Tiefe wählen: Punktabstand (in m) ≤ Rasterweite, höchstens ~90 Knoten */
    const tr = await eptNodes(pj.url, bb, res, cos),
      nodes = tr.nodes,
      dom = new Float32Array(W * Hh).fill(-1e9);
    let np = 0,
      done = 0;
    const one = async (k) => {
      const r = await wfetch(pj.url + 'ept-data/' + k + '.laz', 120000),
        buf = await r.arrayBuffer();
      np += await lazEach(buf, (x, y, z, c) => {
        if (c === 7 || c === 18) return;
        const [lo, la] = mercLL(x, y),
          [E, N] = ll2utm(lo, la, zone),
          i = ((E - DG.minx) / res) | 0,
          j = ((DG.maxy - N) / DG.resY) | 0;
        if (i < 0 || j < 0 || i >= W || j >= Hh) return;
        const q = j * W + i;
        if (z > dom[q]) dom[q] = z;
      });
      done++;
      gst(`Lade USGS-Lidar – Knoten ${done}/${nodes.length} …`);
    };
    for (let i = 0; i < nodes.length; i += 5) await Promise.all(nodes.slice(i, i + 5).map(one));
    let hole = 0;
    for (let q = 0; q < dom.length; q++) {
      if (dom[q] < -1e8 || dom[q] < DG.data[q]) {
        if (dom[q] < -1e8) hole++;
        dom[q] = DG.data[q];
      }
    }
    if (np < 50) throw new Error('zu wenige Lidar-Punkte im Ausschnitt (' + np + ')');
    const r = {
      w: W,
      h: Hh,
      data: dom,
      minx: DG.minx,
      maxy: DG.maxy,
      zone,
      res,
      resY: DG.resY,
      msg: `Oberflächenmodell: USGS-Lidar ${pj.name} (${(np / 1e6).toFixed(2)} Mio. Punkte, ${nodes.length} Knoten, ${f1(res, 1)} m Raster${hole ? '; ' + Math.round((hole / dom.length) * 100) + ' % ohne Punkte, dort Gelände' : ''}).`,
    };
    return (USA.cache[key] = r);
  } catch (e) {
    return {
      fail: true,
      msg:
        lab +
        ' USA (Lidar) nicht geladen (' +
        (e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e).slice(0, 200)) +
        (/Failed to fetch|NetworkError/i.test(String(e.message)) ? ' – evtl. CORS: Proxy eintragen' : '') +
        ').',
    };
  }
}
/* v302: New York City LoD2-CityGML (TUM / 3DCityDB) als Quelle im LoD3-Nachladeweg (Range-Abruf aus dem ZIP, nur benötigte Dateien) */
LOD3S.push({
  id: 'nyc',
  bl: 'ny',
  name: 'LoD2 New York City (CityGML, TUM / 3DCityDB)',
  src: 'TUM Lehrstuhl für Geoinformatik, NYC Open Data',
  bb: [-74.27, 40.48, -73.68, 40.93],
  zone: 18,
  page: 'https://www.asg.ed.tum.de/gis/projekte/new-york-city-3d/',
  urls: [
    'https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_buildings_CityGML_LoD2/NYC_Buildings_LoD2_CityGML.zip',
  ],
});
