// ---- Gebäude Deutschland (IOER/Esri "3D Building Metrics Germany", abgeleitet aus amtlichen LoD2-Modellen): Grundrisse + gemessene Höhe
const LOD2 = {
  url:
    'https://services2.arcgis.com/jUpNdisbWqRpMo35/arcgis/rest/services/' +
    encodeURIComponent('Gebäude_Deutschland_2023') +
    '/FeatureServer/0/query',
};
S.lod2On = true;
async function lod2Load(lon, lat, size) {
  if (!S.lod2On) return { list: [], msg: 'LoD2-Gebäude: ausgeschaltet.' };
  if (!(lon > 5.8 && lon < 15.1 && lat > 47.2 && lat < 55.1))
    return {
      list: [],
      msg: 'LoD2-Gebäude: Standort liegt außerhalb Deutschlands – OSM/MapTiler-Gebäude werden verwendet.',
    };
  const H = size / 2,
    dLat = (H / 110574) * 1.02,
    dLon = (H / (111320 * Math.cos((lat * Math.PI) / 180))) * 1.02,
    list = [],
    seen = new Set();
  let pages = 0,
    err = '';
  try {
    for (let off = 0; off < 24000; off += 2000) {
      const q = new URLSearchParams({
        where: '1=1',
        geometry: [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(','),
        geometryType: 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'OBJECTID,bldg_function,bldg_max_measured_height,bldg_volume,footprint_area',
        returnGeometry: 'true',
        outSR: '4326',
        geometryPrecision: '7',
        resultOffset: String(off),
        resultRecordCount: '2000',
        f: 'geojson',
      });
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(LOD2.url + '?' + q, { signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'Dienstfehler');
      const fs = j.features || [];
      pages++;
      for (const f of fs) {
        const g = f.geometry;
        if (!g) continue;
        const id = f.properties && f.properties.OBJECTID;
        if (id != null) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const pg of polys) {
          const rs = pg.map((r) => r.map(([x, y]) => ll2xz(x, y)));
          const o = clipRing(rs[0], H);
          if (o.length < 3 || area(o) < 1) continue;
          const hs = rs
            .slice(1)
            .map((r) => clipRing(r, H))
            .filter((r) => r.length > 2 && area(r) > 0.5);
          const h = +f.properties.bldg_max_measured_height;
          list.push({
            o,
            holes: hs,
            h: h > 0 ? h : 6,
            minh: 0,
            est: !(h > 0),
            p: {
              bldg_function: f.properties.bldg_function,
              src: 'LoD2-DE',
              vol: +f.properties.bldg_volume,
              fa: +f.properties.footprint_area,
            },
          });
        }
      }
      if (fs.length < 2000 && !j.exceededTransferLimit) break;
    }
  } catch (e) {
    err = e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e);
  }
  if (!list.length)
    return {
      list: [],
      msg:
        'LoD2-Gebäude nicht geladen' +
        (err ? ' (' + err + ')' : ' (keine Treffer)') +
        ' – OSM/MapTiler-Gebäude werden verwendet.',
    };
  return {
    list,
    msg:
      'LoD2-Gebäude (IOER/Esri, Höhen aus amtlichen LoD2-Modellen): ' +
      list.length +
      ' Gebäude' +
      (err ? ' – teilweise geladen (' + err + ')' : '') +
      '.',
  };
}

// ---- Bundesland-Erkennung + LoD2-CityGML (echte Dachformen) je Bundesland; sonst Fallback IOER/Esri bzw. MapTiler
const CG = {
  nrw: {
    key: 'nrw',
    name: 'Nordrhein-Westfalen',
    src: 'Geobasis NRW',
    sz: 1,
    zone: 32,
    tile: (E, N) => [
      `https://www.opengeodata.nrw.de/produkte/geobasis/3dg/lod2_gml/lod2_gml/LoD2_32_${E}_${N}_1_NW.gml`,
    ],
  },
  // weitere Länder: 2-km-Kacheln als ZIP (CityGML). Dateinamen nach den veröffentlichten Mustern der Landesämter – ungeprüft, bei 404 greift der Fallback.
  th: {
    key: 'th',
    name: 'Thüringen',
    src: '© GDI-Th, dl-de/by-2-0',
    sz: 2,
    zone: 32,
    zip: 1,
    g: 1,
    tile: (E, N) => [`https://geoportal.geoportal-th.de/3dgebaeude/LoD2/LoD2_32_${E}_${N}_2_TH.zip`],
  },
  bb: {
    key: 'bb',
    name: 'Brandenburg',
    src: '© GeoBasis-DE/LGB, dl-de/by-2-0',
    sz: 2,
    zone: 33,
    zip: 1,
    g: 1,
    tile: (E, N) => [
      `https://data.geobasis-bb.de/geobasis/daten/3d_gebaeude/lod2_gml/lod2_33${E}-${N}_2_bb.zip`,
    ],
  },
  sn: {
    key: 'sn',
    name: 'Sachsen',
    src: '© GeoSN, dl-de/by-2-0',
    sz: 2,
    zone: 33,
    zip: 1,
    g: 1,
    tile: (E, N) => [
      `https://geocloud.landesvermessung.sachsen.de/index.php/s/3XKFZqznzR2PrFk/download?path=%2F&files=lod2_33_${E}_${N}_2_sn_citygml.zip`,
      `https://geocloud.landesvermessung.sachsen.de/index.php/s/3XKFZqznzR2PrFk/download?path=%2F&files=lod2_33${E}_${N}_2_sn_citygml.zip`,
    ],
  },
  // Hessen: LoD2 über OGC API Features (INSPIRE-Dienst, GeoJSON mit 3D-Flächen, Abfrage nach Ausschnitt) – geprüft
  he: {
    key: 'he',
    name: 'Hessen',
    src: '© HVBG, dl-de/by-2-0',
    ogc: 'https://inspire-hessen.de/ows/datasets/org.2.eb6e9422-58e6-4867-942c-ba378d804481_ogcapi',
  },
  be: {
    key: 'be',
    name: 'Berlin',
    src: '© Geoportal Berlin, dl-de/zero-2-0',
    sz: 1,
    zone: 33,
    zip: 1,
    tile: (E, N) => [`https://gdi.berlin.de/data/a_lod2/atom/LoD2_${E}_${N}.zip`],
  },
  ni: {
    key: 'ni',
    name: 'Niedersachsen',
    src: '© LGLN, CC BY 4.0',
    sz: 1,
    zone: 32,
    tile: (E, N) => [`https://lod2.s3.eu-de.cloud-object-storage.appdomain.cloud/LoD2_32_${E}_${N}_1_ni.gml`],
  },
  // Rheinland-Pfalz: 2-km-Kacheln (linke untere Ecke in km, gerade Werte), CityGML unkomprimiert, CORS offen
  rp: {
    key: 'rp',
    name: 'Rheinland-Pfalz',
    src: '© GeoBasis-DE / LVermGeoRP, dl-de/by-2-0',
    sz: 2,
    zone: 32,
    tile: (E, N) => [`https://geobasis-rlp.de/data/geb3dlo/current/gml/LoD2_32_${E}_${N}_2_RP.gml`],
  },
  by: {
    key: 'by',
    name: 'Bayern',
    src: '© Bayerische Vermessungsverwaltung, CC BY 4.0',
    sz: 2,
    zone: 32,
    g: 1,
    tile: (E, N) => [
      `https://download1.bayernwolke.de/a/lod2/citygml/${E}_${N}.gml`,
      `https://download2.bayernwolke.de/a/lod2/citygml/${E}_${N}.gml`,
    ],
  },
};
const BL_KEYS = [
  [/nordrhein/i, 'nrw'],
  [/bayern/i, 'by'],
  [/baden/i, 'bw'],
  [/niedersachsen/i, 'ni'],
  [/hessen/i, 'he'],
  [/sachsen-anhalt/i, 'st'],
  [/sachsen/i, 'sn'],
  [/th[üu]ringen/i, 'th'],
  [/brandenburg/i, 'bb'],
  [/mecklenburg/i, 'mv'],
  [/schleswig/i, 'sh'],
  [/hamburg/i, 'hh'],
  [/bremen/i, 'hb'],
  [/berlin/i, 'be'],
  [/saarland/i, 'sl'],
  [/rheinland-pfalz|rhineland/i, 'rp'],
];
async function bundesland(lon, lat) {
  let nm = '';
  try {
    const ac = new AbortController(),
      to = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(
      `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${GEO.key}&language=de&types=region`,
      { signal: ac.signal },
    );
    clearTimeout(to);
    if (r.ok) {
      const j = await r.json();
      const f = (j.features || [])[0];
      if (f) nm = f.text_de || f.text || f.place_name_de || f.place_name || '';
    }
  } catch (e) {
    logErr(e, 'bundesland');
  }
  if (nm) {
    const k = (BL_KEYS.find(([re]) => re.test(nm)) || [])[1];
    return { key: k || '', name: nm };
  }
  if (inNRW(lon, lat)) return { key: 'nrw', name: 'Nordrhein-Westfalen (Näherung)' };
  return null;
}
function clip3(poly, H) {
  let out = poly;
  for (const [ax, sg] of [
    [0, 1],
    [0, -1],
    [2, 1],
    [2, -1],
  ]) {
    const inp = out;
    out = [];
    if (!inp.length) break;

    for (let i = 0; i < inp.length; i++) {
      const a = inp[i],
        b = inp[(i + 1) % inp.length],
        da = H - sg * a[ax],
        db = H - sg * b[ax];
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
  }
  return out;
}
function triBase(b) {
  let t = 1e9;
  for (const q of b.gp) t = Math.min(t, gh(q[0], q[1]));
  if (!isFinite(t)) t = 0;
  if (GEO.dgm && GEO.e0 != null && b.zmin != null) {
    const a = b.zmin - GEO.e0;
    if (Math.abs(a - t) < 6) return a;
  }
  return t;
}
function triGeo(b) {
  const g = new T.BufferGeometry();
  const o = triBase(b),
    p0 = b.tris.pos,
    pp = new Float32Array(p0.length);
  for (let i = 0; i < p0.length; i += 3) {
    pp[i] = p0[i];
    pp[i + 1] = p0[i + 1] + o;
    pp[i + 2] = p0[i + 2];
  }
  const nn = Float32Array.from(b.tris.nor),
    nt = pp.length / 9;
  let bx = 0,
    by = 0,
    bz = 0;
  for (let i = 0; i < pp.length; i += 3) {
    bx += pp[i];
    by += pp[i + 1];
    bz += pp[i + 2];
  }
  bx /= pp.length / 3;
  by /= pp.length / 3;
  bz /= pp.length / 3;
  const W = [],
    okn = [];
  let vote = 0;
  for (let t = 0; t < nt; t++) {
    const a = t * 9,
      ux = pp[a + 3] - pp[a],
      uy = pp[a + 4] - pp[a + 1],
      uz = pp[a + 5] - pp[a + 2],
      vx = pp[a + 6] - pp[a],
      vy = pp[a + 7] - pp[a + 1],
      vz = pp[a + 8] - pp[a + 2];
    let wx = uy * vz - uz * vy,
      wy = uz * vx - ux * vz,
      wz = ux * vy - uy * vx;
    const wl = Math.hypot(wx, wy, wz);
    if (wl > 1e-9) {
      wx /= wl;
      wy /= wl;
      wz /= wl;
    }
    W.push([wx, wy, wz, wl]);
    const nl = Math.hypot(nn[a], nn[a + 1], nn[a + 2]);
    okn.push(nl > 0.5 && nl < 1.5);
    if (wl > 1e-9) {
      const cx = (pp[a] + pp[a + 3] + pp[a + 6]) / 3 - bx,
        cy = (pp[a + 1] + pp[a + 4] + pp[a + 7]) / 3 - by,
        cz = (pp[a + 2] + pp[a + 5] + pp[a + 8]) / 3 - bz;
      if (okn[t]) {
        const d = wx * nn[a] + wy * nn[a + 1] + wz * nn[a + 2];
        vote += (wx * cx + wy * cy + wz * cz) * (d < 0 ? -1 : 1) > 0 ? 1 : -1;
      } else vote += wx * cx + wy * cy + wz * cz > 0 ? 1 : -1;
    }
  }
  for (let t = 0; t < nt; t++) {
    const a = t * 9,
      w = W[t];
    if (w[3] <= 1e-9) continue;
    if (!okn[t]) {
      const sg = vote >= 0 ? 1 : -1;
      for (let j = 0; j < 3; j++) {
        nn[a + j * 3] = w[0] * sg;
        nn[a + j * 3 + 1] = w[1] * sg;
        nn[a + j * 3 + 2] = w[2] * sg;
      }
    }
    if (w[0] * nn[a] + w[1] * nn[a + 1] + w[2] * nn[a + 2] < 0) {
      for (let j = 0; j < 3; j++) {
        const x = pp[a + 3 + j];
        pp[a + 3 + j] = pp[a + 6 + j];
        pp[a + 6 + j] = x;
        const y = nn[a + 3 + j];
        nn[a + 3 + j] = nn[a + 6 + j];
        nn[a + 6 + j] = y;
      }
    }
  }
  g.setAttribute('position', new T.BufferAttribute(pp, 3));
  g.setAttribute('normal', new T.BufferAttribute(nn, 3));
  return g;
}
function cgBuilding(el, ctx) {
  const GM = '*',
    surfs = [];
  for (const bd of [
    ...el.getElementsByTagNameNS(GM, 'boundedBy'),
    ...el.getElementsByTagNameNS(GM, 'boundary'),
  ]) {
    const c = [...bd.children].find((x) => /Surface$/.test(x.localName));
    if (c) surfs.push(c);
  }
  if (!surfs.length) return null;
  const polys = [];
  let sx = 0,
    sy = 0,
    n = 0,
    ok = false;
  for (const sf of surfs) {
    const typ = /Ground/.test(sf.localName) ? 'g' : /Roof/.test(sf.localName) ? 'r' : 'w';
    for (const pg of sf.getElementsByTagNameNS(GM, 'Polygon')) {
      const rings = [];
      for (const tag of ['exterior', 'interior'])
        for (const rg of pg.getElementsByTagNameNS(GM, tag)) {
          const pl = rg.getElementsByTagNameNS(GM, 'posList')[0];
          if (!pl) continue;
          const v = pl.textContent.trim().split(/\s+/).map(Number),
            dim = +pl.getAttribute('srsDimension') || 3,
            pts = [];
          for (let i = 0; i + 2 < v.length; i += dim) {
            const [lo, la] = utm2ll(v[i], v[i + 1], ctx.zone || 32),
              xz = ll2xz(lo, la);
            pts.push([xz[0], v[i + 2], xz[1]]);
          }
          if (pts.length > 1) {
            const a = pts[0],
              b = pts.at(-1);
            if (Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[2] - b[2]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4)
              pts.pop();
          }
          if (pts.length >= 3) rings.push({ t: tag, pts });
        }
      const ext = rings.find((r) => r.t === 'exterior');
      if (!ext) continue;
      polys.push({ typ, ext: ext.pts, holes: rings.filter((r) => r.t === 'interior').map((r) => r.pts) });
      ext.pts.forEach((q) => {
        sx += q[0];
        sy += q[2];
        n++;
      });
      ok = true;
    }
  }
  if (!ok) return null;
  const m = el.getElementsByTagNameNS(GM, 'measuredHeight')[0],
    fnn = el.getElementsByTagNameNS(GM, 'function')[0];
  return cgBau(polys, sx / n, sy / n, ctx, { mh: m ? +m.textContent : 0, fn: fnn ? fnn.textContent : '' });
}
/**
 * Gebäude aus 3D-Flächen aufbauen (gemeinsam für CityGML und GeoJSON/OGC API): Zuschnitt auf den Ausschnitt,
 * Dreiecke, Grundriss, Höhe. polys: [{typ: 'g'|'r'|'w', ext: [[x, Höhe, z] …], holes}], cxm/czm: Mittelpunkt,
 * extra: { mh: gemessene Höhe, fn: Gebäudefunktion, src: Quelle }.
 */
function cgBau(polys, cxm, czm, ctx, extra) {
  const H = ctx.H;
  if (Math.abs(cxm) > H + 60 || Math.abs(czm) > H + 60) return null;
  // auf Kartenausschnitt zuschneiden
  const cl = [];
  for (const pl of polys) {
    const e = clip3(pl.ext, H);
    if (e.length < 3) continue;
    cl.push({ typ: pl.typ, ext: e, holes: pl.holes.map((h) => clip3(h, H)).filter((h) => h.length >= 3) });
  }
  if (!cl.length) return null;
  let zmin = 1e9,
    zmax = -1e9,
    bx = 0,
    bz = 0,
    bn = 0;
  const gnd = cl.filter((p) => p.typ === 'g'),
    base = gnd.length ? gnd : cl;
  base.forEach((p) =>
    p.ext.forEach((q) => {
      zmin = Math.min(zmin, q[1]);
    }),
  );
  cl.forEach((p) =>
    p.ext.forEach((q) => {
      zmax = Math.max(zmax, q[1]);
      bx += q[0];
      bz += q[2];
      bn++;
    }),
  );
  bx /= bn;
  bz /= bn;
  const gp = [];
  base.forEach((p) => p.ext.forEach((q) => gp.push([q[0], q[2]])));
  const by = (zmin + zmax) / 2,
    pos = [],
    nor = [];
  for (const pl of cl) {
    const P = pl.ext;
    let nx = 0,
      ny = 0,
      nz = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i],
        b = P[(i + 1) % P.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-9) continue;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const ce = [0, 1, 2].map((k) => P.reduce((t, q) => t + q[k], 0) / P.length);
    let sg = 1;
    if (pl.typ === 'g') sg = ny > 0 ? -1 : 1;
    else sg = (ce[0] - bx) * nx + (ce[1] - by) * ny + (ce[2] - bz) * nz < 0 ? -1 : 1;
    const fn = [nx * sg, ny * sg, nz * sg];
    const drop =
      Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz) ? 1 : Math.abs(nx) >= Math.abs(nz) ? 0 : 2;
    const pj = (q) =>
      drop === 1
        ? new T.Vector2(q[0], q[2])
        : drop === 0
          ? new T.Vector2(q[1], q[2])
          : new T.Vector2(q[0], q[1]);
    const all = P.concat(...pl.holes);
    let faces;
    try {
      faces = T.ShapeUtils.triangulateShape(
        P.map(pj),
        pl.holes.map((h) => h.map(pj)),
      );
    } catch (_) {
      continue;
    }
    for (const [i, j, k] of faces) {
      let A = all[i],
        B = all[j],
        C = all[k];
      const ux = B[0] - A[0],
        uy = B[1] - A[1],
        uz = B[2] - A[2],
        vx = C[0] - A[0],
        vy = C[1] - A[1],
        vz = C[2] - A[2],
        tx = uy * vz - uz * vy,
        ty = uz * vx - ux * vz,
        tz = ux * vy - uy * vx;
      if (tx * tx + ty * ty + tz * tz < 1e-10) continue;
      if (tx * fn[0] + ty * fn[1] + tz * fn[2] < 0) {
        const t = B;
        B = C;
        C = t;
      }
      for (const q of [A, B, C]) {
        pos.push(q[0], q[1] - zmin, q[2]);
        nor.push(fn[0], fn[1], fn[2]);
      }
    }
  }
  // Schnittflächen an den Kartenrändern schließen (Deckel je Schnittebene)
  for (const [ax, sg] of [
    [0, 1],
    [0, -1],
    [2, 1],
    [2, -1],
  ]) {
    const o = ax === 0 ? 2 : 0,
      key = (q) => Math.round(q[o] * 1000) + ',' + Math.round(q[1] * 1000),
      segs = [];
    for (const pl of cl) {
      const P = pl.ext,
        on = P.map((q) => Math.abs(H - sg * q[ax]) < 1e-4);
      if (on.every(Boolean)) continue;
      for (let i = 0; i < P.length; i++) {
        const j = (i + 1) % P.length;
        if (on[i] && on[j] && key(P[i]) !== key(P[j])) segs.push([P[i], P[j]]);
      }
    }
    if (segs.length < 3) continue;
    const adj = new Map(),
      add = (k, i) => {
        if (!adj.has(k)) adj.set(k, []);
        adj.get(k).push(i);
      };
    segs.forEach((s, i) => {
      add(key(s[0]), i);
      add(key(s[1]), i);
    });
    const used = new Array(segs.length).fill(false),
      loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const lp = [segs[i][0]],
        k0 = key(segs[i][0]);
      let end = segs[i][1],
        gd = 0;
      while (key(end) !== k0 && gd++ < 5000) {
        lp.push(end);
        const c = (adj.get(key(end)) || []).find((j) => !used[j]);
        if (c == null) break;
        used[c] = true;
        end = key(segs[c][0]) === key(end) ? segs[c][1] : segs[c][0];
      }
      if (key(end) === k0 && lp.length >= 3) loops.push(lp);
    }
    const L2 = loops.map((lp) => lp.map((q) => new T.Vector2(q[o], q[1]))),
      ar = L2.map((l) => Math.abs(T.ShapeUtils.area(l))),
      P2 = (l) => l.map((p) => [p.x, p.y]),
      cnt = L2.map(
        (l, i) => L2.filter((m, j) => j !== i && ar[j] > ar[i] && inP([l[0].x, l[0].y], P2(m))).length,
      ),
      fn = [ax === 0 ? sg : 0, 0, ax === 2 ? sg : 0];
    L2.forEach((l, i) => {
      if (cnt[i] % 2) return;
      const hs = L2.map((m, j) => j).filter(
          (j) => cnt[j] === cnt[i] + 1 && inP([L2[j][0].x, L2[j][0].y], P2(l)),
        ),
        pts3 = loops[i].concat(...hs.map((j) => loops[j]));
      let faces;
      try {
        faces = T.ShapeUtils.triangulateShape(
          l,
          hs.map((j) => L2[j]),
        );
      } catch (_) {
        return;
      }
      for (const [a, b, c] of faces) {
        let A = pts3[a],
          B = pts3[b],
          C = pts3[c];
        const ux = B[0] - A[0],
          uy = B[1] - A[1],
          uz = B[2] - A[2],
          vx = C[0] - A[0],
          vy = C[1] - A[1],
          vz = C[2] - A[2],
          tx = uy * vz - uz * vy,
          ty = uz * vx - ux * vz,
          tz = ux * vy - uy * vx;
        if (tx * tx + ty * ty + tz * tz < 1e-10) continue;
        if (tx * fn[0] + ty * fn[1] + tz * fn[2] < 0) {
          const t = B;
          B = C;
          C = t;
        }
        for (const q of [A, B, C]) {
          pos.push(q[0], q[1] - zmin, q[2]);
          nor.push(fn[0], fn[1], fn[2]);
        }
      }
    });
  }
  if (!pos.length) return null;
  let mh = extra.mh || 0;
  if (!(mh > 0)) mh = zmax - zmin;
  const fo = (gnd.length ? gnd : cl).reduce(
      (a, p) => {
        const ar = Math.abs(area(p.ext.map((q) => [q[0], q[2]])));
        return ar > a.ar ? { ar, p } : a;
      },
      { ar: -1 },
    ).p,
    o = fo.ext.map((q) => [q[0], q[2]]);
  return {
    o,
    holes: [],
    h: mh,
    minh: 0,
    est: false,
    zmin,
    gp,
    xr: cl.filter((p) => p.typ !== 'w').map((p) => p.ext.map((q) => [q[0], q[2]])),
    tris: { pos: new Float32Array(pos), nor: new Float32Array(nor) },
    p: { bldg_function: extra.fn || '', src: extra.src || 'LoD2-CityGML' },
  };
}
/**
 * LoD2 über OGC API Features (z. B. Hessen): Gebäude und Gebäudeteile im Ausschnitt als GeoJSON mit 3D-Flächen
 * (WGS84, Höhen über NHN). Flächen werden nach Neigung und Höhe als Boden, Dach oder Wand eingeordnet, Flächen, die
 * in Gebäude und Gebäudeteil doppelt vorkommen, nur einmal übernommen; der Aufbau folgt dem CityGML-Weg (cgBau).
 */
async function ogcLod2Load(prov, lon, lat, size) {
  const H = size / 2,
    dLat = (H + 40) / 110574,
    dLon = (H + 40) / (111320 * Math.cos((lat * Math.PI) / 180)),
    bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => v.toFixed(6)).join(','),
    ctx = { H, zone: 32 },
    list = [],
    errs = [],
    gesehen = new Set(), // Flächen (gerundete Eckpunkte), um Doppelte zu überspringen
    schl = (r) =>
      r
        .map((q) => q[0].toFixed(6) + ',' + q[1].toFixed(6) + ',' + q[2].toFixed(1))
        .sort()
        .join(';');
  // Gebäude und Gebäudeteile gleichzeitig laden (je Sammlung seitenweise, bis 50 × 1000), dann in fester
  // Reihenfolge auswerten: erst Gebäude, dann Teile (deren doppelte Flächen werden übersprungen)
  let geladen = 0;
  const lade = async (coll) => {
    const seiten = [];
    let url = `${prov.ogc}/collections/${coll}/items?f=json&limit=1000&bbox=${bbox}`;
    while (url && seiten.length < 50) {
      try {
        const r = await wfetch(url, 120000);
        const j = await r.json();
        seiten.push(j);
        geladen += (j.features || []).length;
        gst(`Lade LoD2 ${prov.name} – ${geladen} Gebäude und Gebäudeteile …`);
        const next = (j.links || []).find((l) => l.rel === 'next');
        url = next ? next.href : null;
      } catch (e) {
        errs.push(String(e.message || e));
        break;
      }
    }
    return seiten;
  };
  const alle = await Promise.all(['Building', 'BuildingPart'].map(lade));
  for (const seiten of alle)
    for (const j of seiten) {
      gst(`Verarbeite LoD2 ${prov.name} – ${list.length} Gebäude …`);
      await new Promise((r) => setTimeout(r, 0));
      for (const f of j.features || []) {
        const g = f.geometry;
        if (!g) continue;
        const pgs = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
        let zmin = Infinity;
        for (const pg of pgs) for (const q of pg[0]) zmin = Math.min(zmin, q[2]);
        const polys = [];
        let sx = 0,
          sz = 0,
          n = 0;
        for (const pg of pgs) {
          const k = schl(pg[0]);
          if (gesehen.has(k)) continue;
          gesehen.add(k);
          const ringe = pg.map((r) => {
            const pts = r.map(([lo, la, h]) => {
              const xz = ll2xz(lo, la);
              return [xz[0], h, xz[1]];
            });
            const a = pts[0],
              b = pts.at(-1);
            if (pts.length > 1 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) pts.pop();
            return pts;
          });
          if (ringe[0].length < 3) continue;
          // Neigung aus der Flächennormalen (Newell): waagerecht unten = Boden, sonst geneigt/waagerecht = Dach
          let nx = 0,
            ny = 0,
            nz = 0,
            hm = 0;
          const e = ringe[0];
          for (let i = 0; i < e.length; i++) {
            const p = e[i],
              q = e[(i + 1) % e.length];
            nx += (p[1] - q[1]) * (p[2] + q[2]);
            ny += (p[2] - q[2]) * (p[0] + q[0]);
            nz += (p[0] - q[0]) * (p[1] + q[1]);
            hm += p[1];
          }
          hm /= e.length;
          const neig = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1),
            typ = neig > 0.95 && hm < zmin + 0.5 ? 'g' : neig > 0.15 ? 'r' : 'w';
          polys.push({ typ, ext: e, holes: ringe.slice(1).filter((r) => r.length >= 3) });
          for (const q of e) {
            sx += q[0];
            sz += q[2];
            n++;
          }
        }
        if (!polys.length) continue;
        const pr = f.properties || {},
          hag = pr.heightAboveGround && pr.heightAboveGround.HeightAboveGround,
          cu = pr.currentUse && pr.currentUse.CurrentUse && pr.currentUse.CurrentUse.currentUse;
        try {
          const b = cgBau(polys, sx / n, sz / n, ctx, {
            mh: hag && hag.value ? +hag.value.value : 0,
            fn: cu && cu.href ? cu.href.split('/').pop() : '',
            src: 'LoD2 ' + prov.name,
          });
          if (b) list.push(b);
        } catch (e) {
          errs.push('Auswertung: ' + e.message);
        }
      }
    }
  if (!list.length)
    return {
      list: [],
      msg:
        `LoD2 ${prov.name} nicht geladen` +
        (errs.length
          ? ' (' + [...new Set(errs)].slice(0, 2).join('; ') + ')'
          : ' (keine Gebäude in diesem Ausschnitt)') +
        '.',
    };
  return {
    list,
    msg:
      `LoD2 ${prov.name} (${prov.src}): ${list.length} Gebäude mit Dachformen` +
      (errs.length ? ' – teilweise geladen' : '') +
      '.',
  };
}
async function unzipGml(buf) {
  const dv = new DataView(buf),
    u8 = new Uint8Array(buf),
    dec = new TextDecoder();
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error('ZIP: Endkennung fehlt');
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const outs = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const meth = dv.getUint16(p + 10, true),
      cs = dv.getUint32(p + 20, true),
      nl = dv.getUint16(p + 28, true),
      xl = dv.getUint16(p + 30, true),
      cl = dv.getUint16(p + 32, true),
      lo = dv.getUint32(p + 42, true),
      name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!/\.(gml|xml)$/i.test(name)) continue;
    const lnl = dv.getUint16(lo + 26, true),
      lxl = dv.getUint16(lo + 28, true),
      ds = lo + 30 + lnl + lxl,
      data = u8.subarray(ds, ds + cs);
    if (meth === 0) outs.push(dec.decode(data));
    else if (meth === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Browser kann ZIP nicht entpacken');
      outs.push(
        await new Response(
          new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
        ).text(),
      );
    }
  }
  return outs;
}
async function cityGmlLoad(prov, lon, lat, size) {
  if (prov.ogc) return ogcLod2Load(prov, lon, lat, size);
  const sz = prov.sz || 1,
    zone = prov.zone || 32,
    [cx, cy] = ll2utm(lon, lat, zone),
    h = size / 2,
    st = 1000 * sz,
    e0 = Math.floor((cx - h) / st) * sz,
    e1 = Math.floor((cx + h) / st) * sz,
    n0 = Math.floor((cy - h) / st) * sz,
    n1 = Math.floor((cy + h) / st) * sz,
    tiles = [];
  for (let E = e0; E <= e1; E += sz) for (let N = n0; N <= n1; N += sz) tiles.push([E, N]);
  if (tiles.length > 16)
    return { list: [], msg: 'LoD2-CityGML: Ausschnitt zu groß (' + tiles.length + ' Kacheln).' };
  const list = [],
    ctx = { H: h, zone },
    errs = [];
  let k = 0,
    miss = 0;
  for (const [E, N] of tiles) {
    k++;
    gst(`Lade LoD2-CityGML (${prov.name}) – Kachel ${k}/${tiles.length} …`);
    let docs = null;
    for (const u of prov.tile(E, N)) {
      if (docs) break;
      for (const via of viaOrder(u)) {
        if (via && !GEO.proxy) break;
        try {
          const ac = new AbortController(),
            to = setTimeout(() => ac.abort(), 180000);
          const r = (await tcHit(u)) || (await fetch(via ? viaProxy(u) : u, { signal: ac.signal }));
          clearTimeout(to);
          if (r.status === 404) {
            miss++;
            break;
          }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const cl = +r.headers.get('content-length') || 0;
          if (cl > (prov.zip ? 150e6 : 400e6)) {
            errs.push('Kachel zu groß (' + Math.round(cl / 1e6) + ' MB)');
            break;
          }
          if (prov.zip) {
            const bf = await r.arrayBuffer();
            if (bf.byteLength > 150e6) {
              errs.push('Kachel zu groß');
              break;
            }
            docs = await unzipGml(bf);
          } else if (r.body && (!cl || cl > 6e6)) {
            /* große Kachel (z. B. Bayern 10–100 MB): Datenstrom lesen, nur Gebäude im Ausschnitt auswerten */ const bb =
                [cx - h - 40, cy - h - 40, cx + h + 40, cy + h + 40],
              sc = { mb: 0, n: 0, t0: Date.now(), max: 5 * 60e3, src: 'LoD2-CityGML' };
            await gmlScan(r.body, bb, ctx, list, errs, sc, `LoD2 ${prov.name} · Kachel ${k}/${tiles.length}`);
            docs = [];
          } else docs = [await r.text()];
          break;
        } catch (e) {
          errs.push(e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e));
        }
      }
    }
    if (!docs) continue;
    for (const txt of docs) {
      if (txt.length < 4000) continue;
      gst(`Verarbeite LoD2-CityGML – Kachel ${k}/${tiles.length} …`);
      await new Promise((r) => setTimeout(r, 20));
      try {
        const doc = new DOMParser().parseFromString(txt, 'application/xml');
        for (const el of doc.getElementsByTagNameNS('*', 'Building')) {
          const b = cgBuilding(el, ctx);
          if (b) list.push(b);
        }
      } catch (e) {
        errs.push('Auswertung: ' + e.message);
      }
    }
  }
  if (!list.length)
    return {
      list: [],
      msg:
        `LoD2-CityGML ${prov.name} nicht geladen` +
        (errs.length
          ? ' (' +
            [...new Set(errs)].slice(0, 2).join('; ') +
            (/Failed to fetch|NetworkError/i.test(errs.join())
              ? ' – evtl. CORS: Proxy eintragen, Host des Landesdienstes im Worker erlauben'
              : '') +
            ')'
          : miss
            ? ` (Kacheldatei nicht gefunden${prov.g ? ' – Dateiname/Adresse ungeprüft' : ''})`
            : ' (keine Gebäude in diesem Ausschnitt)') +
        '.',
    };
  return {
    list,
    msg:
      `LoD2-CityGML ${prov.name} (${prov.src}): ${list.length} Gebäude mit Dachformen` +
      (errs.length ? ' – teilweise geladen' : '') +
      '.',
  };
}
