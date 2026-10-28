/* ---------- Klima (DWD Open Data, Rasterwerte 1991–2020, 1 km) ---------- */
const DWDB = 'https://opendata.dwd.de/climate_environment/CDC/grids_germany/multi_annual/';
const CLIM = [
  {
    k: 't',
    n: 'Jahresmitteltemperatur',
    u: '°C',
    dir: 'air_temperature_mean',
    f: 'air_temp_mean_1991_2020_17',
    tn: 1,
    d: 1,
  },
  { k: 'n', n: 'Jahresniederschlag', u: 'mm', dir: 'precipitation', f: 'precipitation_1991-2020_17', d: 0 },
  {
    k: 's',
    n: 'Sonnenscheindauer',
    u: 'h/Jahr',
    dir: 'sunshine_duration',
    f: 'sunshine_duration_1991-2020_17',
    d: 0,
  },
  { k: 'fr', n: 'Frosttage', u: 'Tage/Jahr', dir: 'frost_days', f: 'frost_days_1991-2020_17', d: 0 },
  { k: 'hh', n: 'Heiße Tage (≥ 30 °C)', u: 'Tage/Jahr', dir: 'hot_days', f: 'hot_days_1991-2020_17', d: 0 },
  {
    k: 'rg',
    n: 'Globalstrahlung',
    u: 'kWh/m² pro Jahr',
    zip: 'radiation_global/grids_germany_multi_annual_radiation_global_1991_2020.zip',
    d: 0,
  },
  {
    k: 'wi',
    n: 'Wind in 10 m (1981–2000)',
    u: 'm/s',
    file: 'wind_parameters/resol_1000x1000/Wind1981-2000_10m_BRD.asc',
    sc: 0.1,
    zero: 1,
    hi: 999,
    d: 1,
  },
];
const CLMC = {};
try {
  Object.assign(CLMC, JSON.parse(localStorage.getItem('lot_clim') || '{}'));
} catch (e) {
  logErr(e, 'init');
}
const CLMR = {}; /* key → {busy}|{v:{k:val},err} */
/* Gauss-Krüger Zone 3 (EPSG:31467, Bessel) aus Länge/Breite – Datumsunterschied zu DHDN (~100 m) bei 1-km-Zellen vernachlässigt */
function gk3(lon, lat) {
  const a = 6377397.155,
    f = 1 / 299.1528128,
    n = f / (2 - f),
    A = (a / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64),
    al = [
      n / 2 - (2 * n * n) / 3 + (5 * n ** 3) / 16,
      (13 * n * n) / 48 - (3 * n ** 3) / 5,
      (61 * n ** 3) / 240,
    ],
    r = Math.PI / 180,
    ph = lat * r,
    dl = (lon - 9) * r,
    k = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(ph)) - k * Math.atanh(k * Math.sin(ph))),
    xi0 = Math.atan2(t, Math.cos(dl)),
    et0 = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let xi = xi0,
    et = et0;
  al.forEach((c, j) => {
    const m = 2 * (j + 1);
    xi += c * Math.sin(m * xi0) * Math.cosh(m * et0);
    et += c * Math.cos(m * xi0) * Math.sinh(m * et0);
  });
  return [3500000 + A * et, A * xi];
}
async function dwdBuf(u) {
  let last = null;
  const vs = [u];
  if (GEO.proxy && typeof viaProxy === 'function') vs.push(viaProxy(u));
  for (const x of vs) {
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 60000);
      const r = await fetch(x, { signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.arrayBuffer();
    } catch (e) {
      last = e;
      last._p = x !== u;
    }
  }
  throw new Error(last ? axErr(last, u, last._p) : 'keine Antwort');
}
async function unzipText(buf) {
  const u = new Uint8Array(buf),
    dv = new DataView(buf);
  let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error('ZIP-Datei nicht lesbar');
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true),
    best = null;
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const meth = dv.getUint16(p + 10, true),
      csz = dv.getUint32(p + 20, true),
      nl = dv.getUint16(p + 28, true),
      xl = dv.getUint16(p + 30, true),
      cl = dv.getUint16(p + 32, true),
      lo = dv.getUint32(p + 42, true),
      name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    if (!best || (/\.asc$/i.test(name) && !/\.asc$/i.test(best.name))) best = { meth, csz, lo, name };
    p += 46 + nl + xl + cl;
  }
  if (!best) throw new Error('ZIP ohne Dateien');
  const ln = dv.getUint16(best.lo + 26, true),
    lx = dv.getUint16(best.lo + 28, true),
    ds = best.lo + 30 + ln + lx,
    data = u.subarray(ds, ds + best.csz);
  if (best.meth === 0) return new TextDecoder().decode(data);
  if (best.meth !== 8) throw new Error('ZIP-Kompression nicht unterstützt');
  return await new Response(
    new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
  ).text();
}
function ascCell(txt, E, N, c) {
  const ls = txt.split(/\r?\n/),
    H = {};
  let last = -1;
  for (let i = 0; i < Math.min(ls.length, 80); i++) {
    const m = ls[i]
      .trim()
      .match(
        /^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|nodata_value)\s+(-?[\d.eE+-]+)/i,
      );
    if (m) {
      H[m[1].toLowerCase()] = parseFloat(m[2]);
      last = i;
    }
  }
  if (!(H.ncols && H.nrows)) throw new Error('Rasterkopf nicht lesbar');
  const cs = H.cellsize || 1000,
    x0 = H.xllcorner != null ? H.xllcorner : H.xllcenter - cs / 2,
    y0 = H.yllcorner != null ? H.yllcorner : H.yllcenter - cs / 2,
    col = Math.floor((E - x0) / cs),
    row = Math.floor((y0 + H.nrows * cs - N) / cs);
  if (col < 0 || row < 0 || col >= H.ncols || row >= H.nrows)
    throw new Error('Standort außerhalb des DWD-Rasters');
  let r = -1,
    i = last + 1;
  for (; i < ls.length; i++) {
    if (/^\s*-?\d/.test(ls[i])) {
      r++;
      if (r === row) break;
    }
  }
  if (r !== row) throw new Error('Rasterzeile fehlt');
  let v = parseFloat(ls[i].trim().split(/\s+/)[col]);
  const nd = H.nodata_value != null ? H.nodata_value : -999;
  if (!isFinite(v) || v === nd || v <= -998 || (c.zero && v === 0) || (c.hi && v >= c.hi)) return null;
  if (c.tn && Math.abs(v) > 60) v /= 10;
  if (c.sc) v *= c.sc;
  return v;
}
async function dwdCell(c, E, N) {
  let txt;
  if (c.zip) {
    const buf = await dwdBuf(DWDB + c.zip);
    txt = await unzipText(buf);
  } else if (c.file) {
    const buf = await dwdBuf(DWDB + c.file);
    txt = new TextDecoder().decode(buf);
  } else {
    const buf = await dwdBuf(DWDB + c.dir + '/grids_germany_multi_annual_' + c.f + '.asc.gz');
    if (typeof DecompressionStream === 'undefined') throw new Error('Browser kann .gz nicht entpacken');
    txt = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return ascCell(txt, E, N, c);
}
function clmSite(s) {
  const ce = cen(s.polys[0]),
    [lo, la] = xz2ll(ce),
    [E, N] = gk3(lo, la);
  return { lo, la, E, N, key: Math.round(E / 1000) + '_' + Math.round(N / 1000) };
}
async function clmRun() {
  const s = axSites();
  if (!s) return;
  const q = clmSite(s),
    have = CLMC[q.key] || {},
    need = CLIM.filter((c) => !(c.k in have));
  if (CLMC[q.key] && !need.length) {
    CLMR[q.key] = { v: CLMC[q.key] };
    rr();
    return;
  }
  CLMR[q.key] = { busy: 1 };
  rr();
  try {
    const v = Object.assign({}, have),
      res = await Promise.all(need.map(async (c) => [c.k, await dwdCell(c, q.E, q.N)]));
    res.forEach(([k2, x]) => {
      v[k2] = x;
    });
    CLMC[q.key] = v;
    try {
      localStorage.setItem('lot_clim', JSON.stringify(CLMC));
    } catch (e) {
      logErr(e, 'clmRun');
    }
    CLMR[q.key] = { v };
  } catch (e) {
    CLMR[q.key] = { err: e && e.message ? e.message : String(e) };
  }
  rr();
}
function axClim(s) {
  const q = clmSite(s),
    r = CLMR[q.key] || (CLMC[q.key] ? { v: CLMC[q.key] } : null);
  if (!r && S.tab === 'Analyse' && S.anT === 'ue')
    setTimeout(() => {
      if (!CLMR[q.key] && S.tab === 'Analyse') clmRun();
    }, 500);
  let b = '';
  if (!r || r.busy) b = axR('Status', 'Klimadaten werden geladen …', 1);
  else if (r.err)
    b =
      axR('Status', 'nicht geladen', 1) +
      '<div class="axk" style="color:var(--wa)">' +
      esc(r.err) +
      '</div><button class="axs2" style="margin-top:4px" onclick="delete CLMR[\'' +
      q.key +
      '\'];clmRun()">erneut versuchen</button>';
  else {
    b =
      CLIM.map((c) => {
        const v = r.v[c.k];
        return axR(
          c.n,
          v == null
            ? 'keine Daten'
            : v.toLocaleString('de-DE', { minimumFractionDigits: c.d, maximumFractionDigits: c.d }) +
                ' ' +
                c.u,
          v == null,
        );
      }).join('') +
      '<div class="axk">Deutscher Wetterdienst (DWD) | 1-km-Raster | 1991–2020 (Wind 1981–2000) · CC BY 4.0</div>';
  }
  return axS('sun', 'Klima', b);
}
