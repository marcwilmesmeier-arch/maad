// ---- Hamburg: DGM1/DOM1 liegen als Komplett-ZIP (1,3 GB) vor – maad liest per Teilabruf (Range) nur Verzeichnis und benötigte 1-km-Kacheln
const HZ = {
  dgm: {
    u: 'https://daten-hamburg.de/opendata/fernerkundung_hoehenmodelle/dgm/dgm1_hh_2022-04-30.zip',
    pre: 'dgm1',
  },
  dom: {
    u: 'https://daten-hamburg.de/opendata/Digitales_Hoehenmodell_bDOM/dom1_hh_2022-11-21.zip',
    pre: 'dom1',
  },
  idx: {},
};
async function hhRange(u, a, z) {
  let last;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await wfetch(u, 300000, { Range: 'bytes=' + a + '-' + z });
      if (r.status !== 206)
        throw new Error(
          'Server unterstützt keine Teilabrufe (Status ' +
            r.status +
            ') – CORS-Proxy mit Range-Unterstützung nötig',
        );
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      last = e;
      if (/unterstützt keine|HTTP 4\d\d/.test(String(e.message))) break;
      await new Promise((k) => setTimeout(k, 700 * (t + 1)));
    }
  }
  throw last;
}
async function hhHead(u) {
  let last;
  for (let t = 0; t < 3; t++) {
    try {
      return await wfetch(u, 300000, { Range: 'bytes=0-0' });
    } catch (e) {
      last = e;
      if (/HTTP 4\d\d/.test(String(e.message))) break;
      await new Promise((k) => setTimeout(k, 700 * (t + 1)));
    }
  }
  throw last;
}
function hhIndex(k) {
  return (
    HZ.idx[k] ||
    (HZ.idx[k] = (async () => {
      const u = HZ[k].u,
        h = await hhHead(u),
        tot = +String(h.headers.get('content-range') || '').split('/')[1];
      if (!tot) throw new Error('Hamburg-ZIP: Gesamtgröße unbekannt (Range/Proxy)');
      const tail = await hhRange(u, Math.max(0, tot - 65557), tot - 1),
        dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
      let i = tail.length - 22;
      while (i >= 0 && !(tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6))
        i--;
      if (i < 0) throw new Error('Hamburg-ZIP: Verzeichnis nicht gefunden');
      const cs = dv.getUint32(i + 12, true),
        co = dv.getUint32(i + 16, true);
      if (cs === 0xffffffff || co === 0xffffffff) throw new Error('Hamburg-ZIP: ZIP64 nicht unterstützt');
      const cd = await hhRange(u, co, co + cs - 1),
        d = new DataView(cd.buffer, cd.byteOffset, cd.byteLength),
        td = new TextDecoder(),
        M = {};
      let q = 0;
      while (q + 46 <= cd.length && d.getUint32(q, true) === 0x02014b50) {
        const m = d.getUint16(q + 10, true),
          c = d.getUint32(q + 20, true),
          sz = d.getUint32(q + 24, true),
          nl = d.getUint16(q + 28, true),
          el = d.getUint16(q + 30, true),
          cl = d.getUint16(q + 32, true),
          lo = d.getUint32(q + 42, true),
          nm = td.decode(cd.subarray(q + 46, q + 46 + nl));
        q += 46 + nl + el + cl;
        if (!/\.tif$/i.test(nm)) continue;
        M[nm.split('/').pop().toLowerCase()] = { m, c, sz, lo };
      }
      return M;
    })().catch((e) => {
      delete HZ.idx[k];
      throw e;
    }))
  );
}
async function hhZipTile(u) {
  const m = /^zip:\/\/hh\/(dgm|dom)\/(\d+)_(\d+)/.exec(u);
  if (!m) throw new Error('HTTP 400 ungültige Kachel-Adresse');
  const k = m[1],
    nm = HZ[k].pre + '_32_' + m[2] + '_' + m[3] + '_1_hh_2022.tif',
    key = 'hhz/' + nm;
  try {
    const b = await tcOp('readonly', (s) => s.get(key));
    if (b) return new Response(b, { status: 200 });
  } catch (e) {
    logErr(e, 'hhZipTile');
  }
  const M = await hhIndex(k),
    e = M[nm];
  if (!e) throw new Error('HTTP 404 Kachel ' + nm + ' nicht im Hamburger Datensatz');
  const lh = await hhRange(HZ[k].u, e.lo, e.lo + 29),
    ld = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
  if (ld.getUint32(0, true) !== 0x04034b50) throw new Error('Hamburg-ZIP: ungültiger Eintrag');
  const st = e.lo + 30 + ld.getUint16(26, true) + ld.getUint16(28, true);
  let raw = await hhRange(HZ[k].u, st, st + e.c - 1),
    buf;
  if (e.m === 0) buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  else if (e.m === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Browser kann ZIP nicht entpacken');
    buf = await new Response(
      new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
    ).arrayBuffer();
  } else throw new Error('Hamburg-ZIP: Methode ' + e.m + ' nicht unterstützt');
  try {
    await tcOp('readwrite', (s) => s.put(buf, key));
  } catch (e) {
    logErr(e, 'hhZipTile');
  }
  return new Response(buf, { status: 200 });
}
async function tileDgm(pv, zone, minx, miny, maxx, maxy, W, Hh, res, lab, errs) {
  const ts = 1000,
    E0 = Math.floor(minx / ts),
    E1 = Math.floor((maxx - 1e-6) / ts),
    N0 = Math.floor(miny / ts),
    N1 = Math.floor((maxy - 1e-6) / ts),
    L = [];
  for (let E = E0; E <= E1; E++) for (let N = N0; N <= N1; N++) L.push([E, N]);
  if (L.length > 16) {
    errs.push('zu viele Kacheln (' + L.length + ')');
    return null;
  }
  const T = {};
  let miss = 0;
  const shr = (t) => {
    const f = Math.floor(t.w / 1200);
    if (f < 2) return t;
    const w = Math.floor(t.w / f),
      h = Math.floor(t.h / f),
      o = new Float32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let a = 0,
          c = 0;
        for (let dj = 0; dj < f; dj++) {
          const r = (j * f + dj) * t.w + i * f;
          for (let di = 0; di < f; di++) {
            const v = t.data[r + di];
            if (v > -400 && v < 4500) {
              a += v;
              c++;
            }
          }
        }
        o[j * w + i] = c ? a / c : -9999;
      }
    return {
      w,
      h,
      data: o,
      nodata: t.nodata,
      ox: t.ox,
      oy: t.oy,
      sx: t.sx && t.sx * f,
      sy: t.sy && t.sy * f,
    };
  };
  await Promise.all(
    L.map(async ([E, N]) => {
      for (const u of pv.sv.tile(E, N)) {
        try {
          const r = await wfetch(u, 900000);
          let buf = await r.arrayBuffer(),
            b0 = new Uint8Array(buf, 0, 4);
          if (b0[0] === 0x50 && b0[1] === 0x4b) {
            const z = await zipFirstBytes(buf);
            buf = z.buffer.slice(z.byteOffset, z.byteOffset + z.length);
            b0 = new Uint8Array(buf, 0, 4);
          }
          const isT = (b0[0] === 0x49 && b0[1] === 0x49) || (b0[0] === 0x4d && b0[1] === 0x4d);
          if (isT) T[E + '_' + N] = shr(await tiffRead(buf));
          else if ((b0[0] >= 48 && b0[0] <= 57) || b0[0] === 45 || b0[0] === 32)
            T[E + '_' + N] = xyzGrid(new Uint8Array(buf));
          else {
            errs.push('Kachel hat ein unbekanntes Format (weder TIFF noch ZIP/XYZ)');
            continue;
          }
          return;
        } catch (e) {
          errs.push(
            /HTTP 404/.test(String(e.message))
              ? 'Kachel ' + E + '_' + N + ' nicht vorhanden'
              : String(e.message || e).slice(0, 120),
          );
        }
      }
      miss++;
    }),
  );
  if (!Object.keys(T).length) return null;
  const data = new Float32Array(W * Hh).fill(-9999);
  for (let j = 0; j < Hh; j++) {
    const y = maxy - (j + 0.5) * res,
      N = Math.floor(y / ts);
    for (let i = 0; i < W; i++) {
      const x = minx + (i + 0.5) * res,
        E = Math.floor(x / ts),
        t = T[E + '_' + N];
      if (!t) continue;
      let px, py;
      if (t.sx && (Math.abs(t.w * t.sx - ts) > 1 || Math.abs(t.h * t.sy - ts) > 1)) {
        px = Math.floor((x - t.ox) / t.sx);
        py = Math.floor((t.oy - y) / t.sy);
        if (px < 0 || py < 0 || px >= t.w || py >= t.h) continue;
      } else {
        px = Math.min(t.w - 1, Math.floor(((x - E * ts) / ts) * t.w));
        py = Math.min(t.h - 1, Math.floor((((N + 1) * ts - y) / ts) * t.h));
      }
      const v = t.data[py * t.w + px];
      if (v > -400 && v < 4500) data[j * W + i] = v;
    }
  }
  return {
    w: W,
    h: Hh,
    data,
    minx,
    maxy,
    zone,
    res,
    resY: res,
    msg: `Gelände: ${lab} ${pv.name} (${pv.src}, ${f1(res, 1)} m Raster${miss ? ', ' + miss + ' Kachel(n) fehlen' : ''}).`,
  };
}
async function dgmLoad(lon, lat, size, cov = 'nw_dgm', lab = 'DGM1') {
  const kind = /dom/i.test(cov) ? 'dom' : 'dgm',
    st = await bundeslandC(lon, lat),
    cu = ((kind === 'dom' ? GEO.wcsDom : GEO.wcsDgm) || '').trim();
  let pv = null;
  if (cu)
    pv = {
      name: (st && st.name) || 'eigener Dienst',
      src: 'eigener Dienst',
      z: [+GEO.wcsZone || 32],
      sv: { u: cu },
    };
  else {
    const t = st && TERR[st.key];
    if (t && t[kind]) pv = { name: t.name, src: t.src, z: t.z, sv: t[kind] };
  }
  if (!pv) return null;
  const hh = (size / 2) * 1.1 + 30,
    errs = [];
  for (const zone of pv.z) {
    const cs = [
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
      ep = 'EPSG:258' + zone;
    if (pv.sv.tile) {
      const r = await tileDgm(pv, zone, minx, miny, maxx, maxy, W, Hh, res, lab, errs);
      if (r) return r;
      continue;
    }
    let id = pv.sv.id;
    if (!id) {
      try {
        id = await wcsCov(pv.sv.u, kind === 'dom' ? /dom|dsm|oberfl/i : /dgm|dtm|gel|hoehe|elev/i);
      } catch (e) {
        errs.push(e.message);
        break;
      }
    }
    const B = pv.sv.u + (pv.sv.u.includes('?') ? '&' : '?'),
      bb = [minx, miny, maxx, maxy].join(',');
    const tries = [
      'SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=' +
        id +
        '&CRS=' +
        ep +
        '&BBOX=' +
        bb +
        '&WIDTH=' +
        W +
        '&HEIGHT=' +
        Hh +
        '&FORMAT=image/tiff',
      'SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=' +
        id +
        '&CRS=' +
        ep +
        '&BBOX=' +
        bb +
        '&WIDTH=' +
        W +
        '&HEIGHT=' +
        Hh +
        '&FORMAT=GTiff',
      'SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=' +
        id +
        '&FORMAT=image/tiff&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/258' +
        zone +
        '&SUBSET=x(' +
        minx +
        ',' +
        maxx +
        ')&SUBSET=y(' +
        miny +
        ',' +
        maxy +
        ')&SCALESIZE=x(' +
        W +
        '),y(' +
        Hh +
        ')',
    ];
    for (const q of tries) {
      try {
        const r = await wfetch(B + q, 90000),
          buf = await r.arrayBuffer(),
          b0 = new Uint8Array(buf, 0, 4);
        if (!((b0[0] === 0x49 && b0[1] === 0x49) || (b0[0] === 0x4d && b0[1] === 0x4d))) {
          errs.push(
            'Antwort kein TIFF: ' +
              new TextDecoder()
                .decode(new Uint8Array(buf, 0, Math.min(120, buf.byteLength)))
                .replace(/\s+/g, ' '),
          );
          continue;
        }
        const t = await tiffRead(buf);
        if (t.w !== W || t.h !== Hh) errs.push('Größe ' + t.w + '×' + t.h);
        let ok = 0;
        for (let i = 0; i < t.data.length; i += 97) {
          const v = t.data[i];
          if (v > -400 && v < 4500) ok++;
        }
        if (ok < (t.data.length / 97) * 0.3) {
          errs.push('keine gültigen Höhenwerte (außerhalb des Landes oder Datentyp)');
          continue;
        }
        return {
          w: t.w,
          h: t.h,
          data: t.data,
          minx,
          maxy,
          zone,
          res: (maxx - minx) / t.w,
          resY: (maxy - miny) / t.h,
          msg: `Gelände: ${lab} ${pv.name} (${pv.src}, ${f1(res, 1)} m Raster).`,
        };
      } catch (e) {
        errs.push(e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e).slice(0, 160));
      }
    }
  }
  return {
    fail: true,
    msg:
      lab +
      ' ' +
      pv.name +
      ' nicht geladen (' +
      [...new Set(errs)].slice(0, 3).join(' | ') +
      (pv.sv.g ? ' – Adresse ungeprüft' : '') +
      (/Failed to fetch|NetworkError/i.test(errs.join()) ? ' – evtl. CORS: Proxy eintragen' : '') +
      ')' +
      (kind === 'dgm' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
  };
}

// ---- Bäume: OpenStreetMap (natural=tree) + Kronenmodell aus DOM1−DGM1 (Länder mit offenem WCS); ein-/ausblendbar über Layer 'Bäume'
async function osmTrees0(lon, lat, size) {
  const h = size / 2,
    dx = h / GEO.kx,
    dy = h / 110574,
    bb = [lat - dy, lon - dx, lat + dy, lon + dx].map((v) => v.toFixed(6)).join(','),
    q = `[out:json][timeout:25];(node["natural"="tree"](${bb});way["natural"="tree_row"](${bb}););out geom;`,
    errs = [];
  for (const ep of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]) {
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(ep + '?data=' + encodeURIComponent(q), { signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(),
        out = [];
      const num = (v) => {
        const n = parseFloat(String(v || '').replace(',', '.'));
        return isFinite(n) ? n : 0;
      };
      const mk = (la, lo, t, row) => {
        const x = (lo - lon) * GEO.kx,
          z = -(la - lat) * 110574;
        if (Math.abs(x) > h || Math.abs(z) > h) return;
        let H = num(t.height),
          cd = num(t.diameter_crown);
        if (!H)
          H = cd
            ? Math.max(4, cd * 1.6)
            : num(t.circumference)
              ? Math.min(30, 6 + num(t.circumference) * 8)
              : 8;
        if (!cd) cd = Math.max(2.5, H * 0.5);
        out.push({
          x,
          z,
          h: H,
          r: cd / 2,
          src: 'osm',
          sp: t.species || t.genus || '',
          lv: /needleleaved/.test(t.leaf_type || ''),
        });
      };
      for (const e of j.elements || []) {
        if (e.type === 'node') mk(e.lat, e.lon, e.tags || {});
        else if (e.type === 'way' && e.geometry && e.geometry.length > 1) {
          const g = e.geometry.map((p) => [(p.lon - lon) * GEO.kx, -(p.lat - lat) * 110574]);
          let acc = 0;
          for (let i = 0; i < g.length - 1; i++) {
            const [a, b] = [g[i], g[i + 1]],
              L = Math.hypot(b[0] - a[0], b[1] - a[1]),
              st = 7;
            let t = -acc;
            if (t < 0) t = st - acc;
            t = Math.max(0, st - acc);
            for (let d = t; d <= L; d += st) {
              const f = d / L;
              mk(
                lat - (a[1] + (b[1] - a[1]) * f) / 110574,
                lon + (a[0] + (b[0] - a[0]) * f) / GEO.kx,
                e.tags || {},
              );
            }
            acc = (L - t) % st;
          }
        }
      }
      return { list: out, msg: 'OSM: ' + out.length + ' Bäume.' };
    } catch (e) {
      errs.push(e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e));
    }
  }
  return { list: [], msg: 'OSM-Bäume nicht geladen (' + [...new Set(errs)].slice(0, 2).join('; ') + ').' };
}
