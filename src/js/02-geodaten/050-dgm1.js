// ---- DGM1 (1 m) NRW via WCS (GeoTIFF); sonst MapTiler-Terrain
const _blc = {};
const bundeslandC = (lon, lat) => {
  const k = lon.toFixed(3) + ',' + lat.toFixed(3);
  return _blc[k] || (_blc[k] = bundesland(lon, lat));
};
async function tiffRead(buf) {
  const dv = new DataView(buf),
    le = dv.getUint16(0) === 0x4949,
    u16 = (o) => dv.getUint16(o, le),
    u32 = (o) => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('kein TIFF (BigTIFF nicht unterstützt)');
  const ifd = u32(4),
    n = u16(ifd),
    tg = {},
    SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12,
      tag = u16(o),
      typ = u16(o + 2),
      cnt = u32(o + 4),
      sz = SZ[typ] || 1,
      vo = cnt * sz <= 4 ? o + 8 : u32(o + 8);
    let v;
    if (typ === 3) v = Array.from({ length: cnt }, (_, k) => u16(vo + k * 2));
    else if (typ === 4) v = Array.from({ length: cnt }, (_, k) => u32(vo + k * 4));
    else if (typ === 2) v = new TextDecoder().decode(new Uint8Array(buf, vo, cnt));
    else if (typ === 12) v = Array.from({ length: cnt }, (_, k) => dv.getFloat64(vo + k * 8, le));
    else v = [];
    tg[tag] = v;
  }
  const W = tg[256][0],
    Hh = tg[257][0],
    bps = (tg[258] || [8])[0],
    comp = (tg[259] || [1])[0],
    spp = (tg[277] || [1])[0],
    sf = (tg[339] || [1])[0],
    pred = (tg[317] || [1])[0],
    planar = (tg[284] || [1])[0];
  if (bps < 16) throw new Error('nur ' + bps + ' Bit');
  if (pred > 3) throw new Error('TIFF-Predictor ' + pred + ' nicht unterstützt');
  if (planar !== 1 && spp > 1) throw new Error('planare Bänder nicht unterstützt');
  if (comp !== 1 && comp !== 5 && comp !== 8 && comp !== 32946)
    throw new Error('TIFF-Kompression ' + comp + ' nicht unterstützt');
  const bp = bps / 8,
    rd = (d, o) =>
      sf === 3
        ? bps === 64
          ? d.getFloat64(o, le)
          : d.getFloat32(o, le)
        : sf === 2
          ? bps === 16
            ? d.getInt16(o, le)
            : d.getInt32(o, le)
          : bps === 16
            ? d.getUint16(o, le)
            : d.getUint32(o, le);
  const out = new Float32Array(W * Hh),
    tiled = !!tg[322],
    tw = tiled ? tg[322][0] : W,
    th = tiled ? tg[323][0] : (tg[278] || [Hh])[0],
    offs = tiled ? tg[324] : tg[273],
    cnts = tiled ? tg[325] : tg[279],
    across = Math.ceil(W / tw);
  const inflate = async (u8) =>
    new Uint8Array(
      await new Response(
        new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate')),
      ).arrayBuffer(),
    );
  const lzw = (src) => {
    let out = new Uint8Array(Math.max(65536, src.length * 4)),
      op = 0;
    const pre = new Int32Array(4096),
      suf = new Uint8Array(4096),
      len = new Int32Array(4096);
    for (let i = 0; i < 256; i++) {
      suf[i] = i;
      len[i] = 1;
      pre[i] = -1;
    }
    let nx = 258,
      bits = 9,
      buf = 0,
      nb = 0,
      ip = 0,
      old = -1;
    const ensure = (k) => {
      if (op + k > out.length) {
        const o2 = new Uint8Array(Math.max(out.length * 2, op + k));
        o2.set(out);
        out = o2;
      }
    };
    const emit = (c) => {
      const l = len[c];
      ensure(l);
      let q = op + l - 1;
      let k = c;
      while (k >= 0 && q >= op) {
        out[q--] = suf[k];
        k = pre[k];
      }
      op += l;
      return out[op - l];
    };
    while (true) {
      while (nb < bits && ip < src.length) {
        buf = (buf << 8) | src[ip++];
        nb += 8;
      }
      if (nb < bits) break;
      const code = (buf >> (nb - bits)) & ((1 << bits) - 1);
      nb -= bits;
      buf &= (1 << nb) - 1;
      if (code === 257) break;
      if (code === 256) {
        nx = 258;
        bits = 9;
        old = -1;
        continue;
      }
      if (old === -1) {
        if (code < 256) emit(code);
        old = code;
        continue;
      }
      let first;
      if (code < nx) {
        first = emit(code);
      } else {
        const l0 = len[old];
        ensure(l0 + 1);
        const st = op;
        emit(old);
        out[op++] = out[st];
        first = out[st];
      }
      if (nx < 4096) {
        pre[nx] = old;
        suf[nx] = first;
        len[nx] = len[old] + 1;
        nx++;
      }
      if (nx + 1 >= 1 << bits && bits < 12) bits++;
      old = code;
    }
    return out.subarray(0, op);
  };
  const unpred = (u8, rb, cw) => {
    if (pred === 1) return u8;
    const rows = Math.floor(u8.length / rb),
      sw = spp;
    for (let r = 0; r < rows; r++) {
      const o = r * rb;
      if (pred === 3) {
        for (let i = sw; i < rb; i++) u8[o + i] = (u8[o + i] + u8[o + i - sw]) & 255;
        const t = u8.slice(o, o + rb),
          cnt = cw * spp;
        for (let i = 0; i < cnt; i++)
          for (let b = 0; b < bp; b++) u8[o + i * bp + (le ? bp - 1 - b : b)] = t[b * cnt + i];
      } else {
        const dd = new DataView(u8.buffer, u8.byteOffset + o, rb);
        for (let i = sw; i < cw * spp; i++) {
          if (bps === 16)
            dd.setUint16(i * 2, (dd.getUint16(i * 2, le) + dd.getUint16((i - sw) * 2, le)) & 65535, le);
          else if (bps === 32)
            dd.setUint32(i * 4, (dd.getUint32(i * 4, le) + dd.getUint32((i - sw) * 4, le)) >>> 0, le);
        }
      }
    }
    return u8;
  };
  for (let c = 0; c < offs.length; c++) {
    let u8 = new Uint8Array(buf, offs[c], cnts[c]);
    if (comp === 5) u8 = lzw(u8);
    else if (comp !== 1) u8 = await inflate(u8);
    if (pred > 1) {
      u8 = u8.slice();
      u8 = unpred(u8, tw * spp * bp, tw);
    }
    const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const x0 = tiled ? (c % across) * tw : 0,
      y0 = tiled ? Math.floor(c / across) * th : c * th,
      cw = tw,
      rows = Math.min(th, Hh - y0);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cw; x++) {
        const X = x0 + x;
        if (X >= W) break;
        out[(y0 + y) * W + X] = rd(d, (y * cw + x) * spp * bp);
      }
  }
  const gt =
    tg[33922] && tg[33922].length >= 6 && tg[33550] && tg[33550].length >= 2
      ? {
          ox: tg[33922][3] - tg[33922][0] * tg[33550][0],
          oy: tg[33922][4] + tg[33922][1] * tg[33550][1],
          sx: tg[33550][0],
          sy: tg[33550][1],
        }
      : {};
  return { w: W, h: Hh, data: out, nodata: tg[42113] ? parseFloat(tg[42113]) : null, ...gt };
}
// Höhenmodelle (WCS, GeoTIFF) je Bundesland. Coverage-Name wird – außer NRW – aus GetCapabilities ermittelt.
const TERR = {
  nrw: {
    name: 'NRW',
    src: 'Geobasis NRW',
    z: [32],
    dgm: { u: 'https://www.wcs.nrw.de/geobasis/wcs_nw_dgm', id: 'nw_dgm' },
    dom: { u: 'https://www.wcs.nrw.de/geobasis/wcs_nw_dom', id: 'nw_dom' },
  },
  mv: {
    name: 'Mecklenburg-Vorpommern',
    src: '© GeoBasis-DE/M-V, CC BY 4.0',
    z: [33, 32],
    dgm: { u: 'https://www.geodaten-mv.de/dienste/dgm_wcs', g: 1 },
    dom: { u: 'https://www.geodaten-mv.de/dienste/dom_wcs' },
  },
  st: {
    name: 'Sachsen-Anhalt',
    src: '© GeoBasis-DE/LVermGeo ST, dl-de/by-2-0',
    z: [32, 33],
    dgm: {
      u: 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DGM1_WCS_OpenData/guest',
      g: 1,
    },
    dom: {
      u: 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DOM1_WCS_OpenData/guest',
    },
  },
  bb: {
    name: 'Brandenburg',
    src: '© GeoBasis-DE/LGB, dl-de/by-2-0',
    z: [33, 32],
    dgm: { u: 'https://isk.geobasis-bb.de/ows/dgm_wcs', g: 1 },
  },
  be: {
    name: 'Berlin',
    src: '© GeoBasis-DE/LGB, © Geoportal Berlin, dl-de/by-2-0',
    z: [33, 32],
    dgm: { u: 'https://isk.geobasis-bb.de/ows/dgm_wcs', g: 1 },
  },
  he: {
    name: 'Hessen',
    src: '© HVBG, dl-de/zero-2-0',
    z: [32],
    dgm: { u: 'https://inspire-hessen.de/raster/dgm1/ows', g: 1 },
  },
  bw: {
    name: 'Baden-Württemberg',
    src: '© LGL-BW (' + new Date().getFullYear() + '), dl-de/by-2-0',
    z: [32],
    dgm: { u: 'https://owsproxy.lgl-bw.de/owsproxy/wcs/WCS_INSP_BW_Hoehe_Coverage_DGM1', g: 1 },
  },
  ni: {
    name: 'Niedersachsen',
    src: '© LGLN, CC BY 4.0',
    z: [32],
    dgm: { u: 'https://opendata.geoservices.lgln.niedersachsen.de/dgm_wcs', g: 1 },
    dom: { u: 'https://opendata.geoservices.lgln.niedersachsen.de/dom_wcs', g: 1 },
  },
  sl: {
    name: 'Saarland',
    src: '© GeoBasis DE/LVGL-SL, dl-de/by-2-0',
    z: [32],
    dgm: { u: 'https://geoportal.saarland.de/gdi-sl/inspireraster/inspirewcsel', g: 1 },
  },
  // Hamburg: DGM1 (dgm1_hh_2022-04-30.zip) und DOM1 (dom1_hh_2022-11-21.zip) nur als Komplett-ZIP – maad liest per Range-Teilabruf (über den CORS-Proxy) Verzeichnis + benötigte 1-km-GeoTIFF-Kacheln
  hh: {
    name: 'Hamburg',
    src: '© FHH, LGV Hamburg, dl-de/by-2-0',
    z: [32],
    page: 'https://daten-hamburg.de/opendata/fernerkundung_hoehenmodelle/dgm/dgm1_hh_2022-04-30.zip',
    dgm: { u: 'tile', tile: (E, N) => ['zip://hh/dgm/' + E + '_' + N] },
    dom: { u: 'tile', tile: (E, N) => ['zip://hh/dom/' + E + '_' + N] },
  },
  // Bayern: DGM1 als 1-km-Kacheln, ZIP mit ASCII-XYZ-Raster, 1 m (Name = Rechts-/Hochwert der linken unteren Ecke in km; am echten Beispiel 692_5337.zip geprüft, Adresse nach dem Muster der LoD2-Kacheln abgeleitet)
  by: {
    name: 'Bayern',
    src: '© Bayerische Vermessungsverwaltung, CC BY 4.0',
    z: [32],
    dgm: {
      u: 'tile',
      tile: (E, N) => [
        `https://download1.bayernwolke.de/a/dgm/dgm1/${E}_${N}.tif`,
        `https://download2.bayernwolke.de/a/dgm/dgm1/${E}_${N}.tif`,
        `https://download1.bayernwolke.de/a/dgm/dgm1/${E}_${N}.zip`,
        `https://download2.bayernwolke.de/a/dgm/dgm1/${E}_${N}.zip`,
      ],
    },
    // DOM 20 cm (1-km-Kacheln, GeoTIFF, Name 32{E}_{N}_20_DOM.tif; Adresse einer echten Kachel entnommen, Spiegel-Server nach dem DGM-Muster; Kacheln sind groß, maad mittelt sie auf 1 m)
    dom: {
      u: 'tile',
      tile: (E, N) => [
        `https://download1.bayernwolke.de/a/dom20/DOM/32${E}_${N}_20_DOM.tif`,
        `https://download2.bayernwolke.de/a/dom20/DOM/32${E}_${N}_20_DOM.tif`,
      ],
    },
  },
};
const _cc = {};
async function wfetch(u, ms, hd) {
  if (/^zip:\/\//.test(u)) return hhZipTile(u);
  let last = null;
  for (const via of viaOrder(u)) {
    if (via && (!GEO.proxy || /^cache:/.test(u))) break;
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), ms);
      try {
        const r =
          (await tcHit(u)) ||
          (await fetch(
            via ? viaProxy(u) : u,
            hd ? { signal: ac.signal, headers: hd } : { signal: ac.signal },
          ));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r;
      } finally {
        clearTimeout(to);
      }
    } catch (e) {
      last = e;
      if (/^HTTP 4\d\d/.test(String(e.message))) break;
    }
  }
  throw last || new Error('nicht erreichbar');
}
async function wcsCov(u, re) {
  const ck = u + '|' + (re ? re.source : '');
  if (_cc[ck]) return _cc[ck];
  let err = '';
  for (const v of ['2.0.1', '1.0.0']) {
    try {
      const r = await wfetch(
          u + (u.includes('?') ? '&' : '?') + 'SERVICE=WCS&REQUEST=GetCapabilities&VERSION=' + v,
          30000,
        ),
        d = new DOMParser().parseFromString(await r.text(), 'text/xml');
      let ids = [...d.getElementsByTagNameNS('*', 'CoverageId')].map((e) => e.textContent.trim());
      if (!ids.length)
        ids = [...d.getElementsByTagNameNS('*', 'CoverageOfferingBrief')]
          .map((e) => {
            const n = e.getElementsByTagNameNS('*', 'name')[0];
            return n && n.textContent.trim();
          })
          .filter(Boolean);
      if (ids.length) return (_cc[ck] = (re && ids.find((i) => re.test(i))) || ids[0]);
      err = 'keine Coverage in der Dienstbeschreibung';
    } catch (e) {
      err = String(e.message || e);
    }
  }
  throw new Error('Coverage-Name nicht ermittelbar (' + err + ')');
}
// ZIP: ersten Eintrag als Bytes entpacken (z. B. Bayern-DGM1: ZIP mit ASCII-XYZ-Raster)
async function zipFirstBytes(buf) {
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
    if (/\/$/.test(name) || /(\.xml|\.txt\.md|readme|\.pdf)$/i.test(name)) continue;
    const lnl = dv.getUint16(lo + 26, true),
      lxl = dv.getUint16(lo + 28, true),
      ds = lo + 30 + lnl + lxl,
      data = u8.subarray(ds, ds + cs);
    if (meth === 0) return data;
    if (meth === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Browser kann ZIP nicht entpacken');
      return new Uint8Array(
        await new Response(
          new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
        ).arrayBuffer(),
      );
    }
    throw new Error('ZIP: Kompressionsart ' + meth + ' nicht unterstützt');
  }
  throw new Error('ZIP ohne Datei');
}
// ASCII-Raster "X Y Z" je Zeile (Zellmitten, regelmäßig) -> {w,h,data} (Zeile 0 = Norden), Kachel deckt den Bereich um die Zellmitten ab
function xyzGrid(u8) {
  const n = u8.length;
  let p = 0,
    cnt = 0;
  const xs = [],
    ys = [],
    zs = [];
  let minx = 1e18,
    maxx = -1e18,
    miny = 1e18,
    maxy = -1e18;
  const num = () => {
    while (
      p < n &&
      (u8[p] === 32 || u8[p] === 9 || u8[p] === 10 || u8[p] === 13 || u8[p] === 59 || u8[p] === 44)
    )
      p++;
    if (p >= n) return NaN;
    let s = 1,
      v = 0,
      fr = 0,
      fd = 0,
      dot = false;
    if (u8[p] === 45) {
      s = -1;
      p++;
    } else if (u8[p] === 43) p++;
    for (; p < n; p++) {
      const c = u8[p];
      if (c >= 48 && c <= 57) {
        if (dot) {
          fr = fr * 10 + (c - 48);
          fd++;
        } else v = v * 10 + (c - 48);
      } else if (c === 46) dot = true;
      else break;
    }
    return s * (v + (fd ? fr / Math.pow(10, fd) : 0));
  };
  while (p < n) {
    const x = num(),
      y = num(),
      z = num();
    if (x !== x || y !== y || z !== z) break;
    xs.push(x);
    ys.push(y);
    zs.push(z);
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
    cnt++;
  }
  if (cnt < 4) throw new Error('Raster-Kachel ohne Daten');
  let res = 0;
  for (let i = 1; i < Math.min(cnt, 2000); i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) {
      res = d;
      break;
    }
  }
  if (!res) {
    for (let i = 1; i < Math.min(cnt, 4000000); i++) {
      const d = Math.abs(ys[i] - ys[i - 1]);
      if (d > 0) {
        res = d;
        break;
      }
    }
  }
  if (!res) throw new Error('Rasterweite nicht erkennbar');
  const w = Math.round((maxx - minx) / res) + 1,
    h = Math.round((maxy - miny) / res) + 1,
    data = new Float32Array(w * h).fill(-9999);
  for (let i = 0; i < cnt; i++)
    data[Math.round((maxy - ys[i]) / res) * w + Math.round((xs[i] - minx) / res)] = zs[i];
  return { w, h, data, res };
}
