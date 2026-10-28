// ---- LoD3-/Detail-Quellen. REGEL: werden NUR beim Anlegen eines Projekts geladen, wenn der Standort im Quellgebiet liegt.
// Neue Quelle = ein Eintrag in LOD3S (bb = [lonW,latS,lonO,latN]; urls = ZIP-Archive mit CityGML; ohne urls nur über „eigene Datei“).
S.lod3On = false;
const HHB = 'https://daten-hamburg.de/opendata/3d_stadtmodell_lod3/';
const LOD3S = [
  {
    id: 'hh',
    bl: 'hh',
    name: 'LoD3.0-HH Hamburg',
    src: '© FHH, LGV Hamburg, dl-de/by-2-0 (Befliegung 2020, untexturiert)',
    bb: [9.7, 53.39, 10.345, 53.75],
    zone: 32,
    page: 'https://gdk.gdi-de.org/geonetwork/srv/api/records/DE792AB5-B70C-4F92-B5E2-E8AD8704C30E',
    urls: [
      'LoD3-HH_Area1_noTexture_2025_03_13.zip',
      'LoD3-HH_Area2_noTexture_2025_03_19.zip',
      'LoD3-HH_Area3_noTexture_2025_04_28.zip',
      'LoD3-HH_Area4_noTexture_2025_04_28.zip',
      'LoD3-HH_Area5_noTexture_2025_04_28.zip',
    ].map((f) => HHB + f),
  },
  {
    id: 'ing',
    bl: 'by',
    name: 'LoD3 Ingolstadt (TUM)',
    src: 'TUM / SAVe-NOW, CC BY-SA – Straßenraum mit rund 50 Gebäuden',
    bb: [11.4, 48.76, 11.47, 48.79],
    zone: 32,
    page: 'https://catalog.gis.lrg.tum.de/en/dataset/lod3-road-space-models',
    urls: ['https://github.com/savein/lod3-road-space-models/releases/latest/download/citygml-dataset.zip'],
  },
  {
    id: 'tum',
    bl: 'by',
    name: 'TUM2TWIN LoD3 (TUM-Campus München)',
    src: 'TU München',
    bb: [11.553, 48.142, 11.578, 48.157],
    zone: 32,
    page: 'https://gitlab.lrz.de/tum-gis/tum2twin-datasets/-/tree/main/citygml/lod3-building-datasets?ref_type=heads',
  },
];
const zbytes = async (rd, a, b) => new Uint8Array(await new Response(await rd.stream(a, b)).arrayBuffer());
const zBlob = (b) => ({ size: b.size, stream: async (a, e) => b.slice(a, e).stream() });
// Archiv über HTTP: bevorzugt per Range-Abruf (nur Verzeichnis + benötigte Dateien), sonst ganzer Download (max. 1,3 GB)
async function zUrl(u, nm) {
  let last = null;
  for (const via of viaOrder(u)) {
    if (via && !GEO.proxy) break;
    const url = via ? viaProxy(u) : u;
    try {
      let r = null;
      try {
        r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      } catch (_) {
        r = null;
      }
      if (r && r.status === 206) {
        const m = /\/(\d+)\s*$/.exec(r.headers.get('content-range') || '');
        if (m)
          return {
            size: +m[1],
            stream: async (a, e) => {
              const q = await fetch(url, { headers: { Range: `bytes=${a}-${e - 1}` } });
              if (q.status !== 206) throw new Error('Bereichsabruf HTTP ' + q.status);
              return q.body;
            },
          };
      }
      if (r && r.body)
        try {
          r.body.cancel();
        } catch (e) {
          logErr(e, 'zUrl');
        }
      const q = await fetch(url);
      if (!q.ok) throw new Error('HTTP ' + q.status);
      const cl = +q.headers.get('content-length') || 0;
      if (cl > 1.3e9) {
        try {
          q.body.cancel();
        } catch (e) {
          logErr(e, 'zUrl');
        }
        throw new Error(
          'Archiv zu groß für den Browser (' +
            Math.round(cl / 1e6) +
            ' MB) – bitte ZIP lokal laden und als eigene Datei wählen',
        );
      }
      const rdr = q.body.getReader(),
        ch = [];
      let n = 0;
      for (;;) {
        const { done, value } = await rdr.read();
        if (done) break;
        ch.push(value);
        n += value.length;
        gst(`Lade ${nm} … ${Math.round(n / 1e6)} MB`);
      }
      return zBlob(new Blob(ch));
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('nicht erreichbar');
}
async function zCentral(rd) {
  const sz = rd.size,
    tl = await zbytes(rd, Math.max(0, sz - 70000), sz),
    dv = new DataView(tl.buffer),
    dec = new TextDecoder();
  let e = -1;
  for (let i = tl.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error('ZIP: Endkennung fehlt');
  let n = dv.getUint16(e + 10, true),
    cdS = dv.getUint32(e + 12, true),
    cdO = dv.getUint32(e + 16, true);
  if (cdO === 0xffffffff || n === 0xffff || cdS === 0xffffffff) {
    const lo = e - 20;
    if (lo >= 0 && dv.getUint32(lo, true) === 0x07064b50) {
      const z = Number(dv.getBigUint64(lo + 8, true)),
        zv = new DataView((await zbytes(rd, z, z + 56)).buffer);
      n = Number(zv.getBigUint64(24, true));
      cdS = Number(zv.getBigUint64(40, true));
      cdO = Number(zv.getBigUint64(48, true));
    }
  }
  const cd = await zbytes(rd, cdO, cdO + cdS),
    cv = new DataView(cd.buffer),
    out = [];
  let p = 0;
  for (let k = 0; k < n && p + 46 <= cd.length; k++) {
    if (cv.getUint32(p, true) !== 0x02014b50) break;
    const meth = cv.getUint16(p + 10, true);
    let cs = cv.getUint32(p + 20, true),
      us = cv.getUint32(p + 24, true),
      lo = cv.getUint32(p + 42, true);
    const nl = cv.getUint16(p + 28, true),
      xl = cv.getUint16(p + 30, true),
      cl = cv.getUint16(p + 32, true),
      name = dec.decode(cd.subarray(p + 46, p + 46 + nl));
    if (us === 0xffffffff || cs === 0xffffffff || lo === 0xffffffff) {
      let q = p + 46 + nl;
      const qe = q + xl;
      while (q + 4 <= qe) {
        const id = cv.getUint16(q, true),
          ln = cv.getUint16(q + 2, true);
        if (id === 1) {
          let o = q + 4;
          if (us === 0xffffffff) {
            us = Number(cv.getBigUint64(o, true));
            o += 8;
          }
          if (cs === 0xffffffff) {
            cs = Number(cv.getBigUint64(o, true));
            o += 8;
          }
          if (lo === 0xffffffff) lo = Number(cv.getBigUint64(o, true));
        }
        q += 4 + ln;
      }
    }
    out.push({ name, meth, cs, us, lo });
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function zEntry(rd, e) {
  const h = await zbytes(rd, e.lo, e.lo + 30),
    hv = new DataView(h.buffer),
    ds = e.lo + 30 + hv.getUint16(26, true) + hv.getUint16(28, true),
    st = await rd.stream(ds, ds + e.cs);
  if (e.meth === 0) return st;
  if (e.meth !== 8) throw new Error('ZIP-Methode ' + e.meth + ' nicht unterstützt');
  if (typeof DecompressionStream === 'undefined') throw new Error('Browser kann ZIP nicht entpacken');
  return st.pipeThrough(new DecompressionStream('deflate-raw'));
}
// Kachelname → Koordinaten (E/N in km oder m, ggf. mit Zonenpräfix 32…); null = Name enthält keine erkennbaren Koordinaten
function zNameHit(name, bb) {
  const nm = (name.match(/\d+/g) || []).map(Number),
    Es = [],
    Ns = [];
  for (const v of nm) {
    if (v >= 200 && v <= 900) Es.push(v * 1000);
    else if (v >= 5000 && v <= 6300) Ns.push(v * 1000);
    else if (v >= 32200000 && v <= 32900000) Es.push(v - 32000000);
    else if (v >= 200000 && v <= 900000) Es.push(v);
    else if (v >= 5000000 && v <= 6300000) Ns.push(v);
  }
  if (!Es.length || !Ns.length) return null;
  return (
    Es.some((E) => bb[2] >= E - 1000 && bb[0] <= E + 3000) &&
    Ns.some((N) => bb[3] >= N - 1000 && bb[1] <= N + 3000)
  );
}
// Datenstrom (CityGML) in Gebäude-Blöcke zerlegen; nur Gebäude im Ausschnitt werden geparst (speicherschonend, auch bei GB-großen Dateien)
async function gmlScan(stream, bb, ctx, list, errs, st, label) {
  const dec = new TextDecoder(),
    rd = stream.getReader(),
    START = /<([A-Za-z0-9_.-]+:)?cityObjectMember\b[^>]*>/,
    CO = /<[\w.-]*:?(?:posList|pos)\b[^>]*>\s*([-+\d.eE]+)\s+([-+\d.eE]+)/;
  let buf = '',
    ns = '',
    pend = [],
    k = 0;
  const flush = async () => {
    if (!pend.length) return;
    const xml = `<r ${ns}>${pend.join('')}</r>`;
    pend = [];
    await new Promise((r) => setTimeout(r, 0));
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('XML-Fehler im Gebäudeblock');
      for (const el of doc.getElementsByTagNameNS('*', 'Building')) {
        const b = cgBuilding(el, ctx);
        if (b) {
          b.p.src = st.src || 'LoD3-CityGML';
          list.push(b);
        }
      }
    } catch (e) {
      errs.push('Auswertung: ' + e.message);
    }
  };
  for (;;) {
    const { done, value } = await rd.read();
    if (value) {
      buf += dec.decode(value, { stream: true });
      st.mb += value.length / 1e6;
    }
    if (done) buf += dec.decode();
    if (!ns) {
      const r = /<(?![?!\/])[\w:.-]+\s[^>]*>/.exec(buf);
      if (r) ns = [...r[0].matchAll(/xmlns(?::[\w.-]+)?="[^"]*"/g)].map((x) => x[0]).join(' ') || ' ';
    }
    for (;;) {
      const m = START.exec(buf);
      if (!m) {
        buf = buf.length > 400 ? buf.slice(-400) : buf;
        break;
      }
      const close = '</' + (m[1] || '') + 'cityObjectMember>',
        e = buf.indexOf(close, m.index);
      if (e < 0) {
        buf = buf.slice(m.index);
        break;
      }
      const blk = buf.slice(m.index, e + close.length);
      buf = buf.slice(e + close.length);
      st.n++;
      if (blk.includes('Building')) {
        const c = CO.exec(blk);
        if (c) {
          const E = +c[1],
            N = +c[2];
          if (E >= bb[0] && E <= bb[2] && N >= bb[1] && N <= bb[3]) {
            pend.push(blk);
            if (pend.length >= 120) await flush();
          }
        }
      }
    }
    if (++k % 6 === 0) {
      gst(`${label}: ${Math.round(st.mb)} MB gelesen, ${list.length} Gebäude im Ausschnitt …`);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (Date.now() - st.t0 > st.max) {
      st.cut = true;
      try {
        rd.cancel();
      } catch (e) {
        logErr(e, 'gmlScan');
      }
      break;
    }
    if (done) break;
  }
  await flush();
}
async function lod3Archive(rd, label, bb, ctx, list, errs, st, unk) {
  const all = (await zCentral(rd)).filter((e) => /\.(gml|xml)$/i.test(e.name) && e.us > 0),
    det = all.map((e) => ({ e, h: zNameHit(e.name, bb) })),
    named = det.some((d) => d.h !== null);
  if (!named) {
    if (unk) {
      unk.push({ rd, all, label });
      return;
    }
  }
  const use = named ? det.filter((d) => d.h).map((d) => d.e) : all;
  st.files = (st.files || 0) + use.length;
  st.of = (st.of || 0) + all.length;
  for (const e of use) {
    if (st.cut) break;
    await gmlScan(await zEntry(rd, e), bb, ctx, list, errs, st, label + ' · ' + e.name.split('/').pop());
  }
}
async function lod3Load(lon, lat, size) {
  const src = LOD3S.find((s) => lon >= s.bb[0] && lon <= s.bb[2] && lat >= s.bb[1] && lat <= s.bb[3]);
  if (!src) return null;
  const h = size / 2,
    pad = 120,
    zone = src.zone,
    cs = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => ll2utm(lon + (a * (h + pad)) / GEO.kx, lat - (b * (h + pad)) / 110574, zone)),
    bb = [
      Math.min(...cs.map((c) => c[0])),
      Math.min(...cs.map((c) => c[1])),
      Math.max(...cs.map((c) => c[0])),
      Math.max(...cs.map((c) => c[1])),
    ],
    ctx = { H: h, zone },
    list = [],
    errs = [],
    st = { mb: 0, n: 0, t0: Date.now(), max: 12 * 60e3 },
    hd = src.name + ': ',
    f = GEO.lod3File;
  const hint = ` Quelle: ${src.page}`;
  try {
    if (f) {
      gst(`Lese ${src.name} aus Datei ${f.name} …`);
      if (/\.zip$/i.test(f.name)) await lod3Archive(zBlob(f), f.name, bb, ctx, list, errs, st, null);
      else await gmlScan(f.stream(), bb, ctx, list, errs, st, f.name);
    } else if (src.urls) {
      const unk = [];
      for (const u of src.urls) {
        if (st.cut) break;
        const nm = u.split('/').pop();
        try {
          gst(`Öffne ${nm} …`);
          const rd = await zUrl(u, nm);
          await lod3Archive(rd, nm, bb, ctx, list, errs, st, unk);
        } catch (e) {
          errs.push(nm + ': ' + String(e.message || e).slice(0, 140));
        }
      }
      if (!list.length && unk.length) {
        unk.sort((a, b) => a.rd.size - b.rd.size);
        for (const a of unk) {
          if (st.cut || list.length) break;
          const us = a.all.reduce((t, e) => t + e.us, 0);
          if (us > 4e9) {
            errs.push(
              a.label +
                ': keine Koordinaten im Dateinamen und ' +
                (us / 1e9).toFixed(1) +
                ' GB entpackt – zu groß für automatische Suche',
            );
            continue;
          }
          st.files = (st.files || 0) + a.all.length;
          st.of = (st.of || 0) + a.all.length;
          for (const e of a.all) {
            if (st.cut) break;
            await gmlScan(
              await zEntry(a.rd, e),
              bb,
              ctx,
              list,
              errs,
              st,
              a.label + ' · ' + e.name.split('/').pop(),
            );
          }
        }
      }
    } else
      return {
        list: [],
        msg:
          `${hd}für diesen Standort verfügbar, aber ohne automatischen Download – Datei von der Quelle laden und im Reiter „Datenebenen“ als „eigene LoD3-Datei“ wählen, dann Projekt neu anlegen.` +
          hint,
      };
  } catch (e) {
    errs.push(String(e.message || e).slice(0, 160));
  }
  if (!list.length) {
    const ee = [...new Set(errs)].slice(0, 3).join(' | ');
    return {
      list: [],
      msg:
        `${hd}nicht geladen` +
        (ee ? ' (' + ee + ')' : st.mb ? ' (keine Gebäude im Ausschnitt gefunden)' : '') +
        (/Failed to fetch|NetworkError|TypeError/i.test(errs.join())
          ? ' – evtl. CORS: Proxy eintragen oder ZIP lokal laden und als eigene Datei wählen.'
          : '.') +
        hint,
    };
  }
  return {
    list,
    prov: src.name,
    lsrc: src.src,
    msg:
      `${hd}${list.length} Gebäude (${src.src})` +
      (st.of ? `, ${st.files} von ${st.of} Dateien durchsucht` : '') +
      (st.cut ? ' – Suche nach 12 min abgebrochen, evtl. unvollständig' : '') +
      '.',
  };
}
async function bldLoad(lon, lat, size) {
  return bldLoad2(lon, lat, size);
}
async function bldLoad2(lon, lat, size) {
  const st = await bundeslandC(lon, lat);
  let prov = st && CG[st.key];
  let pre = '';
  const tp = (GEO.lod2Tpl || '').trim();
  if (tp)
    prov = {
      key: 'custom',
      name: (st && st.name) || 'eigener Dienst',
      src: 'eigene Vorlage',
      sz: +GEO.lod2Sz || 2,
      zone: +GEO.lod2Zone || 32,
      zip: /\.zip/i.test(tp),
      tile: (E, N) => [
        tp
          .replace(/\{E\}/g, E)
          .replace(/\{N\}/g, N)
          .replace(/\{Z\}/g, +GEO.lod2Zone || 32),
      ],
    };
  if (st) pre = 'Bundesland: ' + st.name + '. ';
  if (S.lod2On && prov) {
    const r = await cityGmlLoad(prov, lon, lat, size);
    if (r.list.length) return { list: r.list, msg: pre + r.msg, via: 'cg', prov: prov.name };
    pre += r.msg + ' Fallback: ';
  } else if (st)
    pre +=
      'Für ' +
      st.name +
      ' ist kein LoD2-Kachelzugang hinterlegt (unter „Projekt → LoD2-Kachel-URL“ eintragbar) – ';
  const r2 = await lod2Load(lon, lat, size);
  r2.msg = pre + r2.msg;
  r2.via = r2.list.length ? 'esri' : 'osm';
  r2.prov = prov ? prov.name : '';
  return r2;
}
