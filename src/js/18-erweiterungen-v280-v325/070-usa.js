/* v300: USA – Gelände (USGS 3DEP, 1 m wo vorhanden, sonst bis 10/30 m) und Gebäude mit echten Höhen (New York: NYC Open Data) */
const USA = {
  dep: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage',
  nyc: {
    name: 'New York City (NYC Open Data, Building Footprints)',
    src: 'City of New York, NYC Open Data',
    bb: [-74.3, 40.47, -73.68, 40.93],
    u: 'https://data.cityofnewyork.us/resource/5zhs-2jue.geojson',
  },
};
function inUSA(lon, lat) {
  return (
    (lon > -125 && lon < -66.5 && lat > 24.4 && lat < 49.6) ||
    (lon > -170 && lon < -129 && lat > 51 && lat < 72) ||
    (lon > -160.6 && lon < -154.7 && lat > 18.8 && lat < 22.4)
  );
}
async function dgmUSA(lon, lat, size, lab) {
  const zone = Math.floor((lon + 180) / 6) + 1,
    hh = (size / 2) * 1.1 + 30,
    cs = [
      [-hh, -hh],
      [hh, -hh],
      [hh, hh],
      [-hh, hh],
    ].map(([x, z]) => ll2utm(lon + x / GEO.kx, lat - z / 110574, zone)),
    minx = Math.floor(Math.min(...cs.map((c) => c[0]))),
    miny = Math.floor(Math.min(...cs.map((c) => c[1]))),
    mx = Math.ceil(Math.max(...cs.map((c) => c[0]))),
    my = Math.ceil(Math.max(...cs.map((c) => c[1]))),
    res = Math.max(1, Math.max(mx - minx, my - miny) / 1500),
    W = Math.ceil((mx - minx) / res),
    Hh = Math.ceil((my - miny) / res),
    maxx = minx + W * res,
    maxy = miny + Hh * res,
    sr = '326' + String(zone).padStart(2, '0');
  const q = new URLSearchParams({
    bbox: [minx, miny, maxx, maxy].join(','),
    bboxSR: sr,
    imageSR: sr,
    size: W + ',' + Hh,
    format: 'tiff',
    pixelType: 'F32',
    interpolation: 'RSP_BilinearInterpolation',
    noData: '-9999',
    adjustAspectRatio: 'false',
    f: 'image',
  });
  try {
    const r = await wfetch(USA.dep + '?' + q, 90000),
      buf = await r.arrayBuffer(),
      b0 = new Uint8Array(buf, 0, 4);
    if (!((b0[0] === 0x49 && b0[1] === 0x49) || (b0[0] === 0x4d && b0[1] === 0x4d)))
      throw new Error(
        'Antwort kein TIFF: ' +
          new TextDecoder()
            .decode(new Uint8Array(buf, 0, Math.min(120, buf.byteLength)))
            .replace(/\s+/g, ' '),
      );
    const t = await tiffRead(buf),
      d = t.data;
    let ok = 0,
      sum = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (v > -420 && v < 9000) {
        ok++;
        sum += v;
      }
    }
    if (ok < d.length * 0.3) throw new Error('keine gültigen Höhenwerte (außerhalb der USA oder Datentyp)');
    const mean = sum / ok;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!(v > -420 && v < 9000)) d[i] = mean;
    }
    return {
      w: t.w,
      h: t.h,
      data: d,
      minx,
      maxy,
      zone,
      res: (maxx - minx) / t.w,
      resY: (maxy - miny) / t.h,
      msg: `Gelände: ${lab} USA (USGS 3DEP, ${f1(res, 1)} m Raster; Auflösung je nach Region 1–30 m).`,
    };
  } catch (e) {
    return {
      fail: true,
      msg:
        lab +
        ' USA (USGS 3DEP) nicht geladen (' +
        (e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e).slice(0, 160)) +
        (/Failed to fetch|NetworkError/i.test(String(e.message)) ? ' – evtl. CORS: Proxy eintragen' : '') +
        ')' +
        (lab === 'DGM1' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
    };
  }
}
// dgmLoad(): Erweiterung zusammengeführt, siehe 02-geodaten/060-hamburg.js
/* Gebäude: New York mit Dachhöhen (ft → m); sonst bleibt MapTiler/OSM (Höhen aus OSM-Tags) */
async function bldUSA(lon, lat, size) {
  const n = USA.nyc,
    b = n.bb;
  if (!(lon > b[0] && lon < b[2] && lat > b[1] && lat < b[3]))
    return {
      list: [],
      msg: 'USA: für diesen Standort ist keine amtliche Gebäudehöhen-Quelle hinterlegt (bisher: New York City).',
    };
  const H = size / 2,
    dLat = (H / 110574) * 1.02,
    dLon = (H / (111320 * Math.cos((lat * Math.PI) / 180))) * 1.02,
    list = [];
  let err = '';
  try {
    const q = new URLSearchParams({
      $where: `within_box(the_geom,${lat + dLat},${lon - dLon},${lat - dLat},${lon + dLon})`,
      $limit: '50000',
    });
    const r = await wfetch(n.u + '?' + q, 60000),
      j = await r.json();
    for (const f of j.features || []) {
      const g = f.geometry;
      if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      const hf = +(f.properties || {}).height_roof,
        h = hf > 0 ? hf * 0.3048 : 0;
      for (const pg of polys) {
        const rs = pg.map((r) => r.map(([x, y]) => ll2xz(x, y)));
        const o = clipRing(rs[0], H);
        if (o.length < 3 || area(o) < 1) continue;
        const hs = rs
          .slice(1)
          .map((r) => clipRing(r, H))
          .filter((r) => r.length > 2 && area(r) > 0.5);
        list.push({ o, holes: hs, h: h > 0 ? h : 6, minh: 0, est: !(h > 0), p: { src: 'NYC-Open-Data' } });
      }
    }
  } catch (e) {
    err = e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e);
  }
  if (!list.length)
    return {
      list: [],
      msg: 'USA-Gebäude (New York) nicht geladen' + (err ? ' (' + err + ')' : ' (keine Treffer)') + '.',
    };
  return {
    list,
    msg: 'USA-Gebäude (' + n.name + ', Dachhöhen amtlich): ' + list.length + ' Gebäude.',
    name: 'New York City',
  };
}
// bldLoad2(): Erweiterung zusammengeführt, siehe 02-geodaten/040-lod3.js
