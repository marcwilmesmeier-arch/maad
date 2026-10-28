// ---- Österreich: DGM/DOM aus BEV ALS-Höhenraster (1 m, 50-km-Kacheln als BigTIFF, 256er-Blöcke LZW), Teilabruf über den CORS-Proxy
/* LZW-Entpacker (TIFF, MSB, Early Change) */
const atLzw = (src) => {
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
const ATB = { idx: null, hd: {}, bk: {} };
function atIn(lon, lat) {
  return lon > 9.5 && lon < 17.2 && lat > 46.3 && lat < 49.05;
}
function atPx() {
  return GEO.proxy || PROXY_DEFAULT;
}
async function atRange(url, a, b, tries) {
  const pu = atPx() + encodeURIComponent(url);
  let err = '';
  for (let k = 0; k < (tries || 6); k++) {
    const ac = new AbortController(),
      to = setTimeout(() => ac.abort(), 60000);
    try {
      const r = await fetch(pu, { headers: { Range: 'bytes=' + a + '-' + b }, signal: ac.signal });
      if (r.status === 206) return new Uint8Array(await r.arrayBuffer());
      if (r.status === 200 && a === 0) {
        const rd = r.body.getReader(),
          n = b + 1;
        let g = 0;
        const ch = [];
        while (g < n) {
          const x = await rd.read();
          if (x.done) break;
          ch.push(x.value);
          g += x.value.length;
        }
        ac.abort();
        const o = new Uint8Array(Math.min(g, n));
        let p = 0;
        for (const c of ch) {
          const m = Math.min(c.length, o.length - p);
          o.set(c.subarray(0, m), p);
          p += m;
          if (p >= o.length) break;
        }
        return o;
      }
      err =
        r.status === 200
          ? 'Server liefert keinen Teilabruf'
          : r.status === 403
            ? 'CORS-Proxy lässt data.bev.gv.at nicht zu – im Worker unter ERLAUBT ergänzen'
            : 'HTTP ' + r.status;
      ac.abort();
    } catch (e) {
      err = e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e);
    } finally {
      clearTimeout(to);
    }
    await new Promise((s) => setTimeout(s, 500));
  }
  throw new Error(err + ' (nach ' + (tries || 6) + ' Versuchen)');
}
async function atIndex() {
  if (ATB.idx) return ATB.idx;
  let d = null;
  try {
    const j = JSON.parse(localStorage.getItem('maad_at_idx') || 'null');
    if (j && Date.now() - j.t < 2592e6) d = j.d;
  } catch (e) {
    logErr(e, 'atIndex');
  }
  if (!d) {
    const ac = new AbortController(),
      to = setTimeout(() => ac.abort(), 90000);
    try {
      const r = await fetch(
        'https://data.bev.gv.at/geonetwork/srv/atom/describe/service?uuid=208cff7a-c8aa-42fe-bf4f-2b8156e37528',
        { signal: ac.signal },
      );
      if (!r.ok) throw new Error('Kachelliste HTTP ' + r.status);
      const tx = await r.text();
      d = {};
      for (const m of tx.matchAll(
        /ALS (DTM|DSM) CRS3035RES50000mN(\d+)E(\d+)[^"<]*?Stichtag (\d\d)\.(\d\d)\.(\d{4})/g,
      )) {
        const k = m[1] + ':' + m[2] + ':' + m[3],
          v = m[6] + m[5] + m[4];
        if (!d[k] || d[k] < v) d[k] = v;
      }
      if (!Object.keys(d).length) throw new Error('Kachelliste leer');
      try {
        localStorage.setItem('maad_at_idx', JSON.stringify({ t: Date.now(), d }));
      } catch (e) {
        logErr(e, 'atIndex');
      }
    } finally {
      clearTimeout(to);
    }
  }
  return (ATB.idx = d);
}
async function atHead(kind, N, E, date) {
  const k = kind + N + E;
  if (ATB.hd[k]) return ATB.hd[k];
  const url =
    'https://data.bev.gv.at/download/ALS/' +
    kind +
    '/' +
    date +
    '/ALS_' +
    kind +
    '_CRS3035RES50000mN' +
    N +
    'E' +
    E +
    '.tif';
  const head = await atRange(url, 0, 2097151),
    dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (dv.getUint16(0, true) !== 0x4949 || dv.getUint16(2, true) !== 43)
    throw new Error('Kachel ist kein BigTIFF');
  const ifd = Number(dv.getBigUint64(8, true));
  let ib = ifd + 2048 <= head.length ? head.slice(ifd, ifd + 2048) : await atRange(url, ifd, ifd + 2047);
  ib = new Uint8Array(ib);
  const d2 = new DataView(ib.buffer),
    u64 = (o) => Number(d2.getBigUint64(o, true)),
    n = u64(0),
    T = {};
  for (let i = 0; i < n && 8 + i * 20 + 20 <= ib.length; i++) {
    const e = 8 + i * 20,
      ty = d2.getUint16(e + 2, true),
      cn = u64(e + 4),
      w = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8, 16: 8 }[ty] || 1,
      inl = cn * w <= 8;
    T[d2.getUint16(e, true)] = {
      ty,
      cn,
      w,
      off: inl ? -1 : u64(e + 12),
      inl,
      raw: inl ? ib.slice(e + 12, e + 20) : null,
    };
  }
  const vals = async (t) => {
    if (!t) return null;
    const len = t.cn * t.w;
    let by = t.inl
      ? t.raw.subarray(0, len)
      : t.off + len <= head.length
        ? head.subarray(t.off, t.off + len)
        : await atRange(url, t.off, t.off + len - 1);
    by = new Uint8Array(by);
    const d = new DataView(by.buffer);
    if (t.ty === 2) return new TextDecoder().decode(by);
    const o = t.ty === 16 ? new Float64Array(t.cn) : [];
    for (let i = 0; i < t.cn; i++)
      o[i] =
        t.ty === 3
          ? d.getUint16(i * 2, true)
          : t.ty === 4
            ? d.getUint32(i * 4, true)
            : t.ty === 16
              ? Number(d.getBigUint64(i * 8, true))
              : t.ty === 12
                ? d.getFloat64(i * 8, true)
                : by[i];
    return o;
  };
  const g = async (k) => {
    const v = await vals(T[k]);
    return v && v.length !== undefined && typeof v !== 'string' && v.length === 1 ? v[0] : v;
  };
  const W = await g(256),
    H = await g(257),
    comp = await g(259),
    pred = (await g(317)) || 1,
    bps = await g(258),
    sf = await g(339),
    tw = await g(322),
    th = await g(323);
  if (comp !== 5 || pred > 3 || bps !== 32 || sf !== 3 || !tw || !th)
    throw new Error(
      'Kachelformat unerwartet (Kompression ' + comp + ', Predictor ' + pred + ', ' + bps + ' Bit)',
    );
  const offs = await vals(T[324]),
    cnts = await vals(T[325]),
    sc = await vals(T[33550]),
    tp = await vals(T[33922]),
    gk = await vals(T[34735]);
  let pt = false;
  if (gk) for (let i = 0; i < gk[3]; i++) if (gk[4 + i * 4] === 1025) pt = gk[7 + i * 4] === 2;
  const ndv = T[42113] ? parseFloat(await vals(T[42113])) : -9999;
  return (ATB.hd[k] = {
    url,
    pred,
    W,
    H,
    tw,
    th,
    across: Math.ceil(W / tw),
    offs,
    cnts,
    X: tp[3],
    Y: tp[4],
    ci: tp[0],
    cj: tp[1],
    sx: sc[0],
    sy: sc[1],
    pt,
    nd: isFinite(ndv) ? ndv : -9999,
  });
}
async function atBlock(h, bx, by) {
  const kk = h.url + ':' + bx + ':' + by;
  if (ATB.bk[kk] !== undefined) return ATB.bk[kk];
  const ix = by * h.across + bx,
    off = h.offs[ix],
    cn = h.cnts[ix];
  let f = null;
  if (cn > 0) {
    const u8 = atLzw(await atRange(h.url, off, off + cn - 1));
    f = new Float32Array(h.tw * h.th);
    const rb = h.tw * 4,
      u = new Uint8Array(f.buffer);
    u.set(u8.subarray(0, Math.min(u8.length, f.byteLength)));
    if (h.pred === 3) {
      const rows = h.th,
        cnt = h.tw;
      for (let r = 0; r < rows; r++) {
        const o = r * rb;
        for (let i = 1; i < rb; i++) u[o + i] = (u[o + i] + u[o + i - 1]) & 255;
        const t = u.slice(o, o + rb);
        for (let i = 0; i < cnt; i++) for (let b = 0; b < 4; b++) u[o + i * 4 + (3 - b)] = t[b * cnt + i];
      }
    } else if (h.pred === 2) {
      const dv = new DataView(f.buffer);
      for (let r = 0; r < h.th; r++)
        for (let i = 1; i < h.tw; i++) {
          const q = (r * h.tw + i) * 4;
          dv.setUint32(q, (dv.getUint32(q, true) + dv.getUint32(q - 4, true)) >>> 0, true);
        }
    }
  }
  if (Object.keys(ATB.bk).length > 300) ATB.bk = {};
  return (ATB.bk[kk] = f);
}
async function atDgm(lon, lat, size, kind, lab) {
  const fail = (m) => ({
    fail: true,
    msg:
      lab +
      ' Österreich nicht geladen (' +
      m +
      ')' +
      (kind === 'DTM' ? ' – MapTiler-Gelände wird verwendet.' : '.'),
  });
  try {
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
    const idx = await atIndex(),
      S = 16,
      gw = Math.ceil(W / S) + 1,
      gh = Math.ceil(Hh / S) + 1,
      CE = new Float64Array(gw * gh),
      CN = new Float64Array(gw * gh),
      tl = {},
      TS = [];
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const p = utm2ll(minx + i * S * res, maxy - j * S * res, zone),
          q = attLaea(p[1], p[0]);
        CE[j * gw + i] = q[0];
        CN[j * gw + i] = q[1];
        const e0 = Math.floor(q[0] / 5e4) * 5e4,
          n0 = Math.floor(q[1] / 5e4) * 5e4,
          k = n0 + '_' + e0;
        if (tl[k] === undefined) {
          const d = idx[kind + ':' + n0 + ':' + e0];
          tl[k] = -1;
          if (d) {
            TS.push({ n0, e0, d });
            tl[k] = TS.length - 1;
          }
        }
      }
    if (!TS.length) return fail('keine BEV-Kachel für diesen Ort');
    gst('Lade Gelände Österreich (BEV) … Kachelkopf');
    for (const t of TS) t.h = await atHead(kind, t.n0, t.e0, t.d);
    const cT = new Int16Array(W * Hh).fill(-1),
      cC = new Int32Array(W * Hh),
      cR = new Int32Array(W * Hh),
      need = new Map();
    for (let j = 0; j < Hh; j++) {
      const gj = Math.min(gh - 2, Math.floor(j / S)),
        fy = j / S - gj;
      for (let i = 0; i < W; i++) {
        const gi = Math.min(gw - 2, Math.floor(i / S)),
          fx = i / S - gi,
          a = gj * gw + gi,
          b = a + gw,
          E = (CE[a] * (1 - fx) + CE[a + 1] * fx) * (1 - fy) + (CE[b] * (1 - fx) + CE[b + 1] * fx) * fy,
          N = (CN[a] * (1 - fx) + CN[a + 1] * fx) * (1 - fy) + (CN[b] * (1 - fx) + CN[b + 1] * fx) * fy,
          ti = tl[Math.floor(N / 5e4) * 5e4 + '_' + Math.floor(E / 5e4) * 5e4];
        if (ti === undefined || ti < 0) continue;
        const h = TS[ti].h,
          c = Math.round((E - h.X) / h.sx + h.ci - (h.pt ? 0 : 0.5)),
          r = Math.round((h.Y - N) / h.sy + h.cj - (h.pt ? 0 : 0.5));
        if (c < 0 || r < 0 || c >= h.W || r >= h.H) continue;
        const o = j * W + i;
        cT[o] = ti;
        cC[o] = c;
        cR[o] = r;
        const bx = Math.floor(c / h.tw),
          by = Math.floor(r / h.th),
          k = ti + '_' + bx + '_' + by;
        if (!need.has(k)) need.set(k, [h, bx, by]);
      }
    }
    if (need.size > 600) return fail('zu viele Blöcke (' + need.size + ') – Ausschnitt verkleinern');
    const L = [...need.values()];
    let done = 0;
    const q = L.slice(),
      wk = async () => {
        while (q.length) {
          const [h, bx, by] = q.shift();
          await atBlock(h, bx, by);
          done++;
          if (done % 4 === 0) gst('Lade Gelände Österreich (BEV) … ' + done + '/' + L.length + ' Blöcke');
        }
      };
    await Promise.all([wk(), wk(), wk(), wk(), wk(), wk()]);
    const data = new Float32Array(W * Hh).fill(-9999);
    let ok = 0;
    for (let o = 0; o < W * Hh; o++) {
      const ti = cT[o];
      if (ti < 0) continue;
      const h = TS[ti].h,
        c = cC[o],
        r = cR[o],
        bl = ATB.bk[h.url + ':' + Math.floor(c / h.tw) + ':' + Math.floor(r / h.th)];
      if (!bl) continue;
      const v = bl[(r % h.th) * h.tw + (c % h.tw)];
      if (v > -400 && v < 4500 && v !== h.nd) {
        data[o] = v;
        ok++;
      }
    }
    if (ok < W * Hh * 0.3) return fail('keine gültigen Höhenwerte');
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
      msg: `Gelände: ${lab} Österreich (BEV ALS ${TS[0].d.slice(0, 4)}, ${f1(res, 1)} m Raster, ${L.length} Blöcke).`,
    };
  } catch (e) {
    return fail(String(e.message || e).slice(0, 160));
  }
}
{
  const _g2 = dgmLoad;
  dgmLoad = async function (lon, lat, size, cov, lab) {
    const kind = /dom/i.test(cov || '') ? 'DSM' : 'DTM';
    if (atIn(lon, lat)) {
      let st = null;
      try {
        st = await bundeslandC(lon, lat);
      } catch (e) {
        logErr(e, 'dgmLoad');
      }
      if (!(st && st.key) && !((kind === 'DSM' ? GEO.wcsDom : GEO.wcsDgm) || '').trim())
        return atDgm(lon, lat, size, kind, lab || (kind === 'DSM' ? 'DOM' : 'DGM'));
    }
    return _g2.apply(this, arguments);
  };
}
