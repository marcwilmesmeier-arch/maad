// ---- Frankreich: Gelände (MNT) und Oberfläche (MNS) aus LiDAR HD per WMS GetMap, in UTM-Raster umgerechnet
const FRL = {
  dgm: 'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93',
  dom: 'IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93',
};
function frIn(lon, lat) {
  return lon > -5.3 && lon < 8.3 && lat > 42.3 && lat < 51.2;
}
async function frDgm(lon, lat, size, kind, lab) {
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
    maxy = miny + Hh * res;
  const ll = [
      [minx, miny],
      [mx, miny],
      [mx, my],
      [minx, my],
    ]
      .map((c) => utm2ll(c[0], c[1], zone))
      .map((c) => frtM(c[1], c[0])),
    x0 = Math.min(...ll.map((c) => c[0])) - 20,
    x1 = Math.max(...ll.map((c) => c[0])) + 20,
    y0 = Math.min(...ll.map((c) => c[1])) - 20,
    y1 = Math.max(...ll.map((c) => c[1])) + 20,
    n = Math.min(1800, Math.max(64, Math.ceil(Math.max(x1 - x0, y1 - y0) / (res * 1.4)))),
    pw = (x1 - x0) / n,
    ph = (y1 - y0) / n;
  const u =
    'https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=' +
    FRL[kind] +
    '&STYLES=&CRS=EPSG:3857&BBOX=' +
    [x0, y0, x1, y1].map((v) => v.toFixed(2)).join(',') +
    '&WIDTH=' +
    n +
    '&HEIGHT=' +
    n +
    '&FORMAT=' +
    encodeURIComponent('image/x-bil;bits=32');
  const ac = new AbortController(),
    to = setTimeout(() => ac.abort(), 60000);
  let buf;
  try {
    const r = await fetch(u, { signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    buf = await r.arrayBuffer();
  } catch (e) {
    return {
      fail: true,
      msg:
        lab +
        ' Frankreich nicht geladen (' +
        (e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e).slice(0, 120)) +
        ')' +
        (kind === 'dgm' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
    };
  } finally {
    clearTimeout(to);
  }
  if (buf.byteLength !== n * n * 4)
    return {
      fail: true,
      msg:
        lab +
        ' Frankreich: unerwartete Antwort (' +
        buf.byteLength +
        ' Byte)' +
        (kind === 'dgm' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
    };
  const a = new Float32Array(buf),
    data = new Float32Array(W * Hh).fill(-9999);
  let ok = 0;
  for (let j = 0; j < Hh; j++) {
    const y = maxy - (j + 0.5) * res;
    for (let i = 0; i < W; i++) {
      const p = utm2ll(minx + (i + 0.5) * res, y, zone),
        m = frtM(p[1], p[0]),
        px = Math.floor((m[0] - x0) / pw),
        py = Math.floor((y1 - m[1]) / ph);
      if (px < 0 || py < 0 || px >= n || py >= n) continue;
      const v = a[py * n + px];
      if (v > -400 && v < 4500) {
        data[j * W + i] = v;
        ok++;
      }
    }
  }
  if (ok < W * Hh * 0.3)
    return {
      fail: true,
      msg:
        lab +
        ' Frankreich: keine gültigen Höhenwerte' +
        (kind === 'dgm' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
    };
  return {
    w: W,
    h: Hh,
    data,
    minx,
    maxy,
    zone,
    res,
    resY: res,
    plan: 1,
    msg: `Gelände: ${lab} Frankreich (IGN LiDAR HD, ${f1(res, 1)} m Raster).`,
  };
}
{
  const _g = dgmLoad;
  dgmLoad = async function (lon, lat, size, cov, lab) {
    const kind = /dom/i.test(cov || '') ? 'dom' : 'dgm';
    if (frIn(lon, lat)) {
      let st = null;
      try {
        st = await bundeslandC(lon, lat);
      } catch (e) {
        logErr(e, 'dgmLoad');
      }
      if (!(st && st.key) && !((kind === 'dom' ? GEO.wcsDom : GEO.wcsDgm) || '').trim())
        return frDgm(lon, lat, size, kind, lab || (kind === 'dom' ? 'DOM' : 'DGM'));
    }
    return _g.apply(this, arguments);
  };
}

// Prüffunktion Österreich (BEV ALS-Höhenraster 1 m, COG-Kacheln 50 km, EPSG:3035). Testort Wien, Stephansplatz.
const ATT = { lat: 48.2086, lon: 16.3731, busy: 0 };
function attLaea(lat, lon) {
  const a = 6378137,
    f = 1 / 298.257222101,
    e = Math.sqrt(f * (2 - f)),
    p0 = (52 * Math.PI) / 180,
    l0 = (10 * Math.PI) / 180,
    p = (lat * Math.PI) / 180,
    l = (lon * Math.PI) / 180;
  const q = (x) =>
      (1 - e * e) *
      (Math.sin(x) / (1 - e * e * Math.sin(x) ** 2) -
        Math.log((1 - e * Math.sin(x)) / (1 + e * Math.sin(x))) / (2 * e)),
    qp = q(Math.PI / 2),
    q0 = q(p0),
    qq = q(p),
    Rq = a * Math.sqrt(qp / 2),
    b0 = Math.asin(q0 / qp),
    b = Math.asin(qq / qp),
    m0 = Math.cos(p0) / Math.sqrt(1 - e * e * Math.sin(p0) ** 2),
    D = (a * m0) / (Rq * Math.cos(b0)),
    B = Rq * Math.sqrt(2 / (1 + Math.sin(b0) * Math.sin(b) + Math.cos(b0) * Math.cos(b) * Math.cos(l - l0)));
  return [
    4321000 + B * D * Math.cos(b) * Math.sin(l - l0),
    3210000 + (B / D) * (Math.cos(b0) * Math.sin(b) - Math.sin(b0) * Math.cos(b) * Math.cos(l - l0)),
  ];
}
function attHdr(ab) {
  const v = new DataView(ab),
    le = v.getUint16(0) === 0x4949,
    big = v.getUint16(2, le) === 43;
  if (!big && v.getUint16(2, le) !== 42) return 'kein TIFF';
  const u64 = (o) => Number(v.getBigUint64(o, le)),
    out = [];
  let o = big ? u64(8) : v.getUint32(4, le);
  const NM = {
    256: 'Breite',
    257: 'Höhe',
    258: 'Bit',
    259: 'Kompression',
    317: 'Predictor',
    322: 'KachelB',
    323: 'KachelH',
    339: 'Format',
    42113: 'NoData',
    33550: 'Pixelgröße',
    33922: 'Tiepoint',
  };
  for (let k = 0; k < 12 && o > 0 && o < ab.byteLength - 20; k++) {
    const n = big ? u64(o) : v.getUint16(o, le),
      sz = big ? 20 : 12,
      t = {};
    for (let i = 0; i < n; i++) {
      const e = o + (big ? 8 : 2) + i * sz;
      if (e + sz > ab.byteLength) break;
      const tg = v.getUint16(e, le),
        ty = v.getUint16(e + 2, le),
        cn = big ? u64(e + 4) : v.getUint32(e + 4, le),
        vo = big ? e + 12 : e + 8,
        w = { 3: 2, 4: 4, 16: 8, 12: 8, 2: 1 }[ty] || 1;
      if (NM[tg]) {
        let val;
        const off = cn * w <= (big ? 8 : 4) ? vo : big ? u64(vo) : v.getUint32(vo, le);
        try {
          if (ty === 3) val = v.getUint16(off, le);
          else if (ty === 4) val = v.getUint32(off, le);
          else if (ty === 16) val = u64(off);
          else if (ty === 12) val = [...Array(Math.min(cn, 3))].map((_, j) => v.getFloat64(off + 8 * j, le));
          else if (ty === 2) val = new TextDecoder().decode(new Uint8Array(ab, off, Math.min(cn, 40)));
        } catch (_) {
          val = 'außerhalb des gelesenen Bereichs';
        }
        t[NM[tg]] = val;
      }
    }
    out.push(JSON.stringify(t));
    const nx = big ? o + 8 + n * sz : o + 2 + n * sz;
    if (nx + (big ? 8 : 4) > ab.byteLength) break;
    o = big ? u64(nx) : v.getUint32(nx, le);
  }
  return (
    (big ? 'BigTIFF' : 'TIFF') +
    ' · ' +
    (le ? 'LE' : 'BE') +
    ' · ' +
    out.length +
    ' Ebene(n) gelesen\n     ' +
    out.join('\n     ')
  );
}
async function attGet(u, h) {
  const t0 = performance.now();
  const ac = new AbortController(),
    to = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(u, { headers: h || {}, mode: 'cors', signal: ac.signal });
    return { ok: r.ok, st: r.status, ms: Math.round(performance.now() - t0), r };
  } catch (e) {
    return { ok: false, err: e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e) };
  } finally {
    clearTimeout(to);
  }
}
async function attRun() {
  if (ATT.busy) return;
  ATT.busy = 1;
  const P = (m) => {
    ATT.rep = (ATT.rep ? ATT.rep + '\n' : '') + m;
    attShow(ATT.rep);
  };
  ATT.rep = '';
  const proj = !!(S.geo && isFinite(GEO.lat) && isFinite(GEO.lon) && GEO.lat),
    LA = proj ? GEO.lat : ATT.lat,
    LO = proj ? GEO.lon : ATT.lon;
  ATT.where = proj ? 'Projektort' : 'Wien, Stephansplatz';
  const [E, N] = attLaea(LA, LO),
    e0 = Math.floor(E / 50000) * 50000,
    n0 = Math.floor(N / 50000) * 50000;
  P(
    'Prüfung Österreich · BEV ALS-Höhenraster 1 m\nTestort: ' +
      ATT.where +
      ' (' +
      LA.toFixed(4) +
      ', ' +
      LO.toFixed(4) +
      ') · EPSG:3035 E ' +
      Math.round(E) +
      ' N ' +
      Math.round(N) +
      ' · Kachel E' +
      e0 +
      ' N' +
      n0,
  );
  P('\n1) ATOM-Feed (Kachelliste) …');
  let urls = {};
  const fd = await attGet(
    'https://data.bev.gv.at/geonetwork/srv/atom/describe/service?uuid=208cff7a-c8aa-42fe-bf4f-2b8156e37528',
  );
  if (!fd.ok) P('   FEHLER: ' + (fd.err || 'HTTP ' + fd.st));
  else {
    const tx = await fd.r.text();
    P('   OK · ' + tx.length + ' Zeichen · ' + fd.ms + ' ms');
    for (const m of tx.matchAll(/https?:\/\/[^"'<\s]*ALS_D[TO]M[^"'<\s]*?\.tif/g)) urls[m[0]] = 1;
    {
      const L = [...tx.matchAll(/<link[^>]*>/g)].map((m) => m[0]).filter((x) => /DTM|DSM/i.test(x));
      P('   Links mit DTM/DSM im Feed: ' + L.length);
      L.slice(0, 4).forEach((x) => P('     ' + x.slice(0, 260)));
      const E = [...tx.matchAll(/<entry>[\s\S]*?<\/entry>/g)];
      P('   Einträge: ' + E.length + (E[0] ? '\n     ' + E[0][0].replace(/\s+/g, ' ').slice(0, 500) : ''));
    }
    P(
      '   Kachel-Links im Feed: ' +
        Object.keys(urls).length +
        (Object.keys(urls).length
          ? '\n   Beispiel: ' + Object.keys(urls)[0]
          : '\n   Anfang: ' + tx.slice(0, 300).replace(/\s+/g, ' ')),
    );
  }
  for (const kind of ['DTM', 'DSM']) {
    P('\n2) ' + kind + ' · Kachel suchen und Kopf lesen');
    {
      const k = await attGet(
        'https://data.bev.gv.at/download/ALS/' +
          kind +
          '/20240915/ALS_' +
          kind +
          '_CRS3035RES50000mN2650000E4550000.tif',
        { Range: 'bytes=0-0' },
      );
      P(
        '   Direktabruf bekannte Kachel (N2650000 E4550000): ' +
          (k.ok || k.st === 206 ? 'OK HTTP ' + k.st : 'FEHLER ' + (k.err || 'HTTP ' + k.st)) +
          (k.r ? ' · Content-Range ' + k.r.headers.get('content-range') : ''),
      );
    }
    let u = Object.keys(urls).find(
      (x) => x.includes('/' + kind + '/') && x.includes('N' + n0 + 'E' + e0 + '.tif'),
    );
    {
      const ku =
        'https://data.bev.gv.at/download/ALS/' +
        kind +
        '/20240915/ALS_' +
        kind +
        '_CRS3035RES50000mN2650000E4550000.tif';
      try {
        const ac = new AbortController(),
          to = setTimeout(() => ac.abort(), 15000),
          r = await fetch(ku, { signal: ac.signal });
        clearTimeout(to);
        P(
          '   Abruf ohne Range-Kopf: HTTP ' +
            r.status +
            ' · Länge ' +
            r.headers.get('content-length') +
            ' · Accept-Ranges ' +
            r.headers.get('accept-ranges'),
        );
        ac.abort();
      } catch (e) {
        P(
          '   Abruf ohne Range-Kopf: ' +
            (e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e)),
        );
      }
      const px = typeof PROXY_DEFAULT === 'string' ? PROXY_DEFAULT : '';
      if (px) {
        const ac = new AbortController(),
          to = setTimeout(() => ac.abort(), 30000);
        try {
          const r = await fetch(px + encodeURIComponent(ku), {
            headers: { Range: 'bytes=0-262143' },
            signal: ac.signal,
          });
          const H = ['content-range', 'content-length', 'accept-ranges', 'content-type', 'content-encoding']
            .map((k) => k + ': ' + r.headers.get(k))
            .join(' · ');
          P('   Über CORS-Proxy (Range): HTTP ' + r.status + ' · ' + H);
          if (r.ok) {
            const rd = r.body.getReader();
            let got = 0,
              ch = [];
            while (got < 262144) {
              const x = await rd.read();
              if (x.done) break;
              ch.push(x.value);
              got += x.value.length;
            }
            ac.abort();
            const b = new Uint8Array(got);
            let o = 0;
            for (const c of ch) {
              b.set(c, o);
              o += c.length;
            }
            P('   ' + got + ' Byte gelesen (Rest abgebrochen)');
            P('   ' + attHdr(b.buffer.slice(0, Math.min(got, 262144))));
          }
        } catch (e) {
          P(
            '   Über CORS-Proxy: ' +
              (e.name === 'AbortError' ? 'abgebrochen/Zeitüberschreitung' : String(e.message || e)),
          );
        } finally {
          clearTimeout(to);
        }
      }
    }
    if (!u) {
      for (const y of [2025, 2024, 2023, 2022, 2021, 2020, 2019]) {
        const c =
            'https://data.bev.gv.at/download/ALS/' +
            kind +
            '/' +
            y +
            '0915/ALS_' +
            kind +
            '_CRS3035RES50000mN' +
            n0 +
            'E' +
            e0 +
            '.tif',
          h = await attGet(c, { Range: 'bytes=0-0' });
        if (h.ok || h.st === 206) {
          u = c;
          break;
        } else if (y === 2025) P('   Versuch ' + y + ': ' + (h.err || 'HTTP ' + h.st));
      }
    }
    if (!u) {
      P('   Kachel nicht gefunden');
      continue;
    }
    P('   ' + u);
    const h = await attGet(u, { Range: 'bytes=0-262143' });
    if (!h.ok && h.st !== 206) {
      P('   FEHLER: ' + (h.err || 'HTTP ' + h.st) + ' (Hinweis: „Failed to fetch" = meist CORS gesperrt)');
      continue;
    }
    const cr = h.r.headers.get('content-range'),
      ab = await h.r.arrayBuffer();
    P(
      '   Range-Abruf: HTTP ' +
        h.st +
        ' · ' +
        ab.byteLength +
        ' Byte · Content-Range ' +
        cr +
        ' · ' +
        h.ms +
        ' ms',
    );
    P('   ' + attHdr(ab));
  }
  if (typeof atDgm === 'function' && LO > 9.5 && LO < 17.2 && LA > 46.3 && LA < 49.05) {
    P('\n3) Probelauf Ausschnitt 200 m am Testort (wie beim Laden eines Projekts)');
    for (const [kind, lab] of [
      ['DTM', 'DGM'],
      ['DSM', 'DOM'],
    ]) {
      const t0 = performance.now();
      let x;
      try {
        x = await atDgm(LO, LA, 200, kind, lab);
      } catch (e) {
        x = { fail: true, msg: 'Ausnahme: ' + (e.message || e) };
      }
      if (x.fail) P('   ' + kind + ': ' + x.msg);
      else {
        let mn = 1e9,
          mx = -1e9,
          ok = 0;
        for (const v of x.data)
          if (v > -400) {
            ok++;
            mn = Math.min(mn, v);
            mx = Math.max(mx, v);
          }
        P(
          '   ' +
            kind +
            ': OK · ' +
            x.w +
            '×' +
            x.h +
            ' · gültig ' +
            Math.round((ok / x.data.length) * 100) +
            ' % · Höhe ' +
            mn.toFixed(1) +
            ' bis ' +
            mx.toFixed(1) +
            ' m · ' +
            Math.round(performance.now() - t0) +
            ' ms · ' +
            x.msg,
        );
      }
    }
  }
  P('\nFertig. Bitte den Bericht über „Kopieren“ weitergeben.');
  ATT.busy = 0;
}
function attShow(t) {
  let d = document.getElementById('att');
  if (!d) {
    d = document.createElement('div');
    d.id = 'att';
    d.style.cssText =
      'position:fixed;left:50%;top:8%;transform:translateX(-50%);width:min(760px,92vw);height:70vh;z-index:99;background:#E9EDEF;color:#1F2A33;border:1px solid rgba(31,42,51,.25);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:10px;display:none;flex-direction:column;gap:8px;font:12px system-ui,sans-serif';
    d.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">Prüfung Österreich</b><button id="attC">Kopieren</button><button id="attX">Schließen</button></div><textarea id="attT" readonly style="flex:1;font:11px ui-monospace,monospace;resize:none"></textarea>';
    document.body.appendChild(d);
    d.querySelector('#attX').onclick = () => {
      d.style.display = 'none';
    };
    d.querySelector('#attC').onclick = () => {
      const ta = d.querySelector('#attT');
      ta.select();
      try {
        navigator.clipboard.writeText(ta.value);
      } catch (_) {
        document.execCommand('copy');
      }
    };
  }
  d.style.display = 'flex';
  const ta = d.querySelector('#attT');
  ta.value = t;
  ta.scrollTop = ta.scrollHeight;
}
(function () {
  const b = document.createElement('button');
  b.id = 'attB';
  b.textContent = 'AT-Test';
  b.title = 'Prüfung: Höhenraster Österreich (BEV ALS) am Stephansplatz, Wien';
  b.style.cssText =
    'position:fixed;right:84px;bottom:24px;z-index:58;border:1px solid rgba(31,42,51,.2);background:rgba(233,237,239,.95);color:#1F2A33;border-radius:999px;padding:5px 12px;font:600 11px system-ui,sans-serif;cursor:pointer';
  b.onclick = () => {
    attShow('Prüfung läuft …');
    attRun();
  }; /* Knopf entfernt (v402): Prüfung weiter über attRun() in der Konsole */
})();
