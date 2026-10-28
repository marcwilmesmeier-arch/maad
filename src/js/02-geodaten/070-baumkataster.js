// ---- Baumkataster (amtliche Einzelbaum-Punkte) je Bundesland, ergänzt/ersetzt OSM-Bäume. Neue Quelle = ein Eintrag in TKAT (WFS, Punkte; Attribute werden nach Namensmuster erkannt).
const TKAT = {
  be: {
    name: 'Berlin',
    src: '© Geoportal Berlin, dl-de/zero-2-0',
    u: 'https://gdi.berlin.de/services/wfs/baumbestand',
    types: ['baumbestand:strassenbaeume', 'baumbestand:anlagenbaeume'],
    zone: 33,
    g: 1,
  },
};
async function kataTrees(lon, lat, size) {
  const st = await bundeslandC(lon, lat),
    R = st && TKAT[st.key];
  if (!R) return { list: [], msg: '', n: 0 };
  const h = size / 2,
    [cx, cy] = ll2utm(lon, lat, R.zone),
    out = [],
    errs = [],
    pf = (o, re) => {
      const k = Object.keys(o).find((k) => re.test(k));
      return k ? o[k] : '';
    },
    num = (v) => {
      const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
      return isFinite(n) ? n : 0;
    };
  const add = (x, y, pr) => {
    let E = x,
      N = y;
    if (Math.abs(E) < 1000 && Math.abs(N) < 1000) [E, N] = ll2utm(E, N, R.zone);
    else if (E > N) [E, N] = [N, E];
    const [lo, la] = utm2ll(E, N, R.zone),
      px = (lo - lon) * GEO.kx,
      pz = -(la - lat) * 110574;
    if (Math.abs(px) > h || Math.abs(pz) > h) return;
    let H = num(pf(pr, /h(oe|ö)he|height/i)),
      cd = num(pf(pr, /kron.*(durch|breit)|crown/i)),
      um = num(pf(pr, /stammumf|umfang/i));
    if (um > 20) um /= 100;
    if (H > 60) H = 0;
    if (!H) H = cd ? Math.max(4, cd * 1.6) : um ? Math.min(30, 6 + um * 8) : 10;
    if (!cd || cd > 40) cd = Math.max(2.5, H * 0.5);
    out.push({
      x: px,
      z: pz,
      h: H,
      r: cd / 2,
      src: 'kataster',
      sp: pf(pr, /art_dtsch|gattung_deutsch|baumart|art_bot|species|gattung/i) || '',
      lv: false,
      yr: pf(pr, /pflanzjahr/i) || '',
    });
  };
  for (const ty of R.types) {
    const u =
      R.u +
      '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=' +
      encodeURIComponent(ty) +
      '&COUNT=6000&SRSNAME=' +
      encodeURIComponent('EPSG:' + (R.zone === 33 ? 25833 : 25832)) +
      '&BBOX=' +
      [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(1)).join(',') +
      ',' +
      'EPSG:' +
      (R.zone === 33 ? 25833 : 25832);
    let done = false;
    for (const fmt of ['&OUTPUTFORMAT=application%2Fjson', '']) {
      if (done) break;
      for (const via of viaOrder(u)) {
        if (via && !GEO.proxy) break;
        try {
          const ac = new AbortController(),
            to = setTimeout(() => ac.abort(), 45000);
          const r = await fetch(via ? viaProxy(u + fmt) : u + fmt, { signal: ac.signal });
          clearTimeout(to);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const txt = await r.text();
          if (fmt) {
            const j = JSON.parse(txt);
            for (const f of j.features || []) {
              const g = f.geometry;
              if (!g) continue;
              const pts = g.type === 'Point' ? [g.coordinates] : g.type === 'MultiPoint' ? g.coordinates : [];
              for (const c of pts) add(c[0], c[1], f.properties || {});
            }
          } else {
            const d = new DOMParser().parseFromString(txt, 'text/xml');
            const ex = d.getElementsByTagNameNS('*', 'ExceptionText')[0];
            if (ex) throw new Error('Dienst meldet: ' + ex.textContent.trim().slice(0, 120));
            for (const m of d.getElementsByTagNameNS('*', 'member')) {
              const f = m.firstElementChild;
              if (!f) continue;
              const pr = {};
              for (const e of f.getElementsByTagName('*')) {
                if (
                  !e.children.length &&
                  e.textContent.trim() &&
                  !/^(pos|posList)$/.test(e.localName) &&
                  !(e.localName in pr)
                )
                  pr[e.localName] = e.textContent.trim();
              }
              const ps = f.getElementsByTagNameNS('*', 'pos')[0];
              if (ps) {
                const t = ps.textContent.trim().split(/\s+/).map(Number);
                add(t[0], t[1], pr);
              }
            }
          }
          done = true;
          break;
        } catch (e) {
          errs.push(e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e));
        }
      }
    }
  }
  if (!out.length)
    return {
      list: [],
      n: 0,
      msg: errs.length
        ? 'Baumkataster ' +
          R.name +
          ' nicht geladen (' +
          [...new Set(errs)].slice(0, 2).join('; ') +
          (R.g ? ' – Adresse/Attribute ungeprüft' : '') +
          (/Failed to fetch|NetworkError/i.test(errs.join()) ? ', evtl. CORS: Proxy eintragen' : '') +
          ').'
        : 'Baumkataster ' + R.name + ': keine Bäume im Ausschnitt.',
    };
  return {
    list: out,
    n: out.length,
    msg: 'Baumkataster ' + R.name + ' (' + R.src + '): ' + out.length + ' Bäume.',
  };
}
async function osmTrees(lon, lat, size) {
  const [o, k, g] = await Promise.all([
    osmTrees0(lon, lat, size).catch((e) => ({ list: [], msg: 'OSM-Bäume: ' + e.message })),
    kataTrees(lon, lat, size).catch((e) => ({ list: [], n: 0, msg: 'Baumkataster: ' + e.message })),
    gpkFileTrees(lon, lat, size).catch((e) => ({ list: [], n: 0, msg: 'Baumdatei: ' + (e.message || e) })),
  ]);
  let r;
  if (!k.list.length) r = { list: o.list, msg: [k.msg, o.msg].filter(Boolean).join(' ') };
  else {
    const keep = o.list.filter((t) => !k.list.some((q) => Math.hypot(q.x - t.x, q.z - t.z) < 3));
    r = {
      list: k.list.concat(keep),
      msg: k.msg + ' OSM ergänzt: ' + keep.length + ' (Doppelte: ' + (o.list.length - keep.length) + ').',
    };
  }
  const det = { o: o.msg || '', k: k.msg || '', g: g.msg || '' };
  if (!g.list.length)
    return g.msg ? { list: r.list, msg: g.msg + ' ' + r.msg, det } : Object.assign(r, { det });
  const keep = r.list.filter((t) => !g.list.some((q) => Math.hypot(q.x - t.x, q.z - t.z) < 3));
  return {
    list: g.list.concat(keep),
    msg:
      g.msg +
      ' Übrige Quellen ergänzt: ' +
      keep.length +
      ' (Doppelte: ' +
      (r.list.length - keep.length) +
      ').',
    det,
  };
}
// ---- GeoPackage-Leser (SQLite im Browser, nur Lesen, ohne Bibliothek): lokale .gpkg-Datei mit Baumpunkten (oder Kronenpolygonen). Liest nur die Tabellenseiten im Ausschnitt-Fenster, die Datei wird nie ganz geladen.
// Neue Datei-Quelle mit Urheberangabe = ein Eintrag in TFILES (Dateiname-Muster).
const TFILES = [
  {
    re: /braunschweig.*(tree|baum)|(tree|baum).*braunschweig/i,
    name: 'Braunschweig (LiDAR 2019)',
    src: '© Münzinger / IÖR (ioerDATA), CC BY 4.0, doi:10.71830/2DZCIA',
  },
  {
    re: /bay.*baeume|\d{5,6}_baeume/i,
    name: 'Bayern Einzelbäume',
    src: '© Bayerische Vermessungsverwaltung (Lizenz bitte prüfen, i. d. R. CC BY 4.0)',
  },
];
const tdec = new TextDecoder(),
  gSc = new Uint8Array(16),
  gScV = new DataView(gSc.buffer);
function gVar(b, o) {
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const c = b[o + i];
    v = v * 128 + (c & 127);
    if (c < 128) return [v, i + 1];
  }
  return [v * 256 + b[o + 8], 9];
}
const gSz = (t) =>
  t <= 4 ? t : t === 5 ? 6 : t === 6 || t === 7 ? 8 : t >= 12 ? (t - 12 - (t % 2 ? 1 : 0)) / 2 : 0;
function gRec(p) {
  let [hs, o] = gVar(p, 0);
  const ty = [],
    off = [];
  while (o < hs) {
    const [t, l] = gVar(p, o);
    o += l;
    ty.push(t);
  }
  let d = hs;
  for (const t of ty) {
    off.push(d);
    d += gSz(t);
  }
  return { p, ty, off, dv: new DataView(p.buffer, p.byteOffset, p.length) };
}
function gVal(r, i) {
  const t = r.ty[i];
  if (t === undefined || t === 0) return null;
  const o = r.off[i];
  if (t === 8) return 0;
  if (t === 9) return 1;
  if (t <= 6) {
    const n = [0, 1, 2, 3, 4, 6, 8][t];
    let v = 0;
    for (let k = 0; k < n; k++) v = v * 256 + r.p[o + k];
    if (r.p[o] & 128) v -= Math.pow(256, n);
    return v;
  }
  if (t === 7) return r.dv.getFloat64(o);
  const n = gSz(t);
  return t % 2 === 0 ? r.p.subarray(o, o + n) : tdec.decode(r.p.subarray(o, o + n));
}
async function gOpen(f) {
  const h = new Uint8Array(await f.slice(0, 100).arrayBuffer());
  if (tdec.decode(h.subarray(0, 15)) !== 'SQLite format 3') throw new Error('keine GeoPackage-/SQLite-Datei');
  let ps = (h[16] << 8) | h[17];
  if (ps === 1) ps = 65536;
  const U = ps - h[20];
  return { f, ps, U, cache: new Map() };
}
async function gPage(db, n) {
  let p = db.cache.get(n);
  if (p) return p;
  const b = new Uint8Array(await db.f.slice((n - 1) * db.ps, n * db.ps).arrayBuffer());
  p = { b, dv: new DataView(b.buffer) };
  if (db.cache.size > 500) db.cache.clear();
  db.cache.set(n, p);
  return p;
}
async function gLeaves(db, root) {
  const out = [],
    st = [root];
  while (st.length) {
    const n = st.pop(),
      p = await gPage(db, n),
      o = n === 1 ? 100 : 0,
      t = p.b[o];
    if (t === 13) out.push(n);
    else if (t === 5) {
      const nc = p.dv.getUint16(o + 3);
      st.push(p.dv.getUint32(o + 8));
      for (let i = 0; i < nc; i++) st.push(p.dv.getUint32(p.dv.getUint16(o + 12 + i * 2)));
    }
  }
  return out;
}
async function gScan(db, leaves, cb, prog) {
  leaves = leaves.slice().sort((a, b) => a - b);
  const U = db.U,
    X = U - 35,
    M = ((((U - 12) * 32) / 255) | 0) - 23;
  let i = 0;
  while (i < leaves.length) {
    let j = i;
    const st = leaves[i];
    while (
      j + 1 < leaves.length &&
      leaves[j + 1] - leaves[j] <= 6 &&
      (leaves[j + 1] - st + 1) * db.ps <= 16e6
    )
      j++;
    const buf = new Uint8Array(await db.f.slice((st - 1) * db.ps, leaves[j] * db.ps).arrayBuffer());
    for (let k = i; k <= j; k++) {
      const n = leaves[k],
        base = (n - st) * db.ps,
        o = n === 1 ? 100 : 0;
      if (buf[base + o] !== 13) continue;
      const dv = new DataView(buf.buffer, base, db.ps),
        nc = dv.getUint16(o + 3);
      for (let c = 0; c < nc; c++) {
        let p = dv.getUint16(o + 8 + c * 2);
        const [P, l1] = gVar(buf, base + p);
        p += l1;
        const [rid, l2] = gVar(buf, base + p);
        p += l2;
        let pay;
        if (P <= X) pay = buf.subarray(base + p, base + p + P);
        else {
          const K = M + ((P - M) % (U - 4)),
            loc = K <= X ? K : M;
          pay = new Uint8Array(P);
          pay.set(buf.subarray(base + p, base + p + loc), 0);
          let ov = dv.getUint32(p + loc),
            got = loc;
          while (ov && got < P) {
            const pg = await gPage(db, ov),
              take = Math.min(U - 4, P - got);
            pay.set(pg.b.subarray(4, 4 + take), got);
            got += take;
            ov = pg.dv.getUint32(0);
          }
        }
        cb(rid, pay);
      }
    }
    i = j + 1;
    if (prog) prog(i / leaves.length);
    await new Promise((r) => setTimeout(r, 0));
  }
}
function gCols(sql) {
  const a = sql.indexOf('('),
    z = sql.lastIndexOf(')'),
    body = sql.slice(a + 1, z),
    parts = [];
  let d = 0,
    cur = '';
  for (const ch of body) {
    if (ch === '(') d++;
    if (ch === ')') d--;
    if (ch === ',' && d === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const cols = [];
  let pk = -1;
  for (const s0 of parts) {
    const s = s0.trim();
    if (!s || /^(primary|unique|constraint|foreign|check)\b/i.test(s)) continue;
    const m = s.match(/^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|(\S+))/),
      nm = m[1] || m[2] || m[3] || m[4];
    if (/integer\s+primary\s+key/i.test(s)) pk = cols.length;
    cols.push(nm);
  }
  return { cols, pk };
}
async function gSchema(db) {
  const out = {};
  await gScan(db, await gLeaves(db, 1), (rid, p) => {
    const r = gRec(p);
    if (gVal(r, 0) === 'table' && gVal(r, 4) && !/virtual/i.test(gVal(r, 4)))
      out[gVal(r, 1)] = { root: gVal(r, 3), ...gCols(gVal(r, 4)) };
  });
  return out;
}
async function gRows(db, sc, name) {
  const t = sc[name];
  if (!t) return [];
  const out = [];
  await gScan(db, await gLeaves(db, t.root), (rid, p) => {
    const r = gRec(p),
      o = {};
    t.cols.forEach((c, i) => {
      o[c] = i === t.pk ? rid : gVal(r, i);
    });
    out.push(o);
  });
  return out;
}
async function gInfo(f) {
  const db = await gOpen(f),
    sc = await gSchema(db),
    gc = await gRows(db, sc, 'gpkg_geometry_columns');
  if (!gc.length) throw new Error('keine GeoPackage-Geometrietabelle gefunden');
  const sr = await gRows(db, sc, 'gpkg_spatial_ref_sys');
  const L = gc
    .map((g) => {
      const s = sr.find((x) => x.srs_id === g.srs_id),
        t = sc[g.table_name];
      return {
        table: g.table_name,
        gcol: g.column_name,
        gtype: String(g.geometry_type_name || '').toUpperCase(),
        epsg: s ? s.organization_coordsys_id : g.srs_id,
        cols: t ? t.cols : [],
        pk: t ? t.pk : -1,
        root: t ? t.root : 0,
      };
    })
    .filter((l) => l.root);
  if (!L.length) throw new Error('keine Merkmalstabelle lesbar');
  const sc2 = (l) =>
    (/POINT/.test(l.gtype) ? 4 : /POLYGON/.test(l.gtype) ? 2 : 0) +
    (/tree|baum|position/i.test(l.table) ? 3 : 0) -
    (/crown|kron/i.test(l.table) && L.some((x) => /POINT/.test(x.gtype)) ? 2 : 0);
  L.sort((a, b) => sc2(b) - sc2(a));
  return { db, sc, L, layer: L[0] };
}
// Spalten nach Namensmuster erkennen (überschreibbar über GEO.tcol)
function gMap(cols, ov) {
  ov = ov || {};
  const pick = (re, ex) => cols.find((c) => re.test(c) && !(ex && ex.test(c)));
  const byName = (n) => n && cols.find((c) => c.toLowerCase() === String(n).toLowerCase());
  const h =
      byName(ov.h) ||
      pick(/^h$|^ht$|^hgt|h(oe|ö)he|height|^z_?max|top/i, /ansatz|base|crown|kron|stamm|trunk|ground|min/i),
    cd =
      byName(ov.cd) ||
      pick(
        /kron.*(durch|breit)|crown.*(diam|width|dia|breit)|(^|_)(cd|cdia|dcrown|crown_?d)($|_)|diam|durchmesser/i,
      ),
    cr = cd ? null : pick(/radius|crown_?r$|(^|_)cr$|kron.*radius/i),
    sp = byName(ov.sp) || pick(/art_dtsch|gattung_deutsch|baumart|art_bot|species|genus|gattung|spec/i);
  return { h, cd, cr, sp };
}
function gPts(b) {
  if (!b || b[0] !== 0x47 || b[1] !== 0x50) return [];
  const fl = b[3];
  if ((fl >> 4) & 1) return [];
  const ei = (fl >> 1) & 7,
    eb = [0, 32, 48, 48, 64][ei] || 0;
  let o = 8 + eb;
  const dv = new DataView(b.buffer, b.byteOffset, b.length);
  const rd = (o) => {
    const le = b[o] === 1,
      raw = dv.getUint32(o + 1, le),
      c = raw & 0xffff,
      iso = Math.floor(c / 1000),
      z = iso === 1 || iso === 3 || raw & 0x80000000 ? 1 : 0,
      mm = iso === 2 || iso === 3 || raw & 0x40000000 ? 1 : 0;
    return { le, ty: c % 1000, dd: 2 + z + mm };
  };
  const h = rd(o);
  o += 5;
  const out = [];
  if (h.ty === 1) {
    out.push([dv.getFloat64(o, h.le), dv.getFloat64(o + 8, h.le), null]);
    return out;
  }
  if (h.ty === 4) {
    const n = dv.getUint32(o, h.le);
    o += 4;
    for (let i = 0; i < n; i++) {
      const s = rd(o);
      out.push([dv.getFloat64(o + 5, s.le), dv.getFloat64(o + 13, s.le), null]);
      o += 5 + 8 * s.dd;
    }
    return out;
  }
  if (h.ty === 3 || h.ty === 6) {
    let nP = 1;
    if (h.ty === 6) {
      nP = dv.getUint32(o, h.le);
      o += 4;
      const s = rd(o);
      o += 5;
      h.dd = s.dd;
      h.le = s.le;
    }
    let x0 = 1e18,
      y0 = 1e18,
      x1 = -1e18,
      y1 = -1e18;
    const nr = dv.getUint32(o, h.le);
    o += 4;
    const np = dv.getUint32(o, h.le);
    o += 4;
    for (let i = 0; i < np; i++) {
      const x = dv.getFloat64(o, h.le),
        y = dv.getFloat64(o + 8, h.le);
      o += 8 * h.dd;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    out.push([(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0 + (y1 - y0)) / 2]);
    return out;
  }
  return out;
}
async function gpkTrees(f, lon, lat, size, prog) {
  const I = await gInfo(f),
    db = I.db,
    L = I.layer,
    t = I.sc[L.table],
    gi = t.cols.indexOf(L.gcol);
  if (gi < 0) throw new Error('Geometriespalte fehlt');
  const ep = L.epsg;
  let zone = 0,
    ll = 0;
  if (ep === 4326 || ep === 4258) ll = 1;
  else if (ep >= 25831 && ep <= 25838) zone = ep - 25800;
  else if (ep >= 32631 && ep <= 32638) zone = ep - 32600;
  else
    throw new Error(
      'Koordinatensystem EPSG:' +
        ep +
        ' wird nicht unterstützt (erwartet ETRS89/UTM, EPSG:25832/25833, oder WGS84)',
    );
  const h = size / 2,
    m = h + 15;
  let w;
  if (ll) {
    const dx = m / GEO.kx,
      dy = m / 110574;
    w = [lon - dx, lat - dy, lon + dx, lat + dy];
  } else {
    const [cx, cy] = ll2utm(lon, lat, zone);
    w = [cx - m, cy - m, cx + m, cy + m];
  }
  const M = gMap(t.cols, GEO.tcol),
    ix = (n) => (n ? t.cols.indexOf(n) : -1),
    iH = ix(M.h),
    iC = ix(M.cd),
    iR = ix(M.cr),
    iS = ix(M.sp),
    iY = t.cols.findIndex((c) => /pflanzjahr|year|jahr/i.test(c)),
    out = [];
  let scanned = 0;
  const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) ? n : 0;
  };
  await gScan(
    db,
    await gLeaves(db, L.root),
    (rid, p) => {
      scanned++;
      let [hs, o] = gVar(p, 0),
        d = hs,
        k = 0,
        gt = 0,
        go = 0;
      while (o < hs) {
        const [tt, l] = gVar(p, o);
        o += l;
        if (k === gi) {
          gt = tt;
          go = d;
          break;
        }
        d += gSz(tt);
        k++;
      }
      if (gt < 12 || gt % 2) return;
      let pts;
      if (
        p[go] === 0x47 &&
        p[go + 1] === 0x50 &&
        p[go + 3] === 1 &&
        p[go + 8] === 1 &&
        p[go + 9] === 1 &&
        p[go + 10] === 0 &&
        p[go + 11] === 0 &&
        p[go + 12] === 0
      ) {
        for (let z = 0; z < 16; z++) gSc[z] = p[go + 13 + z];
        pts = [[gScV.getFloat64(0, true), gScV.getFloat64(8, true), null]];
      } else pts = gPts(p.subarray(go, go + (gt - 12) / 2));
      let r = null;
      for (const q of pts) {
        let X = q[0],
          Y = q[1];
        if (X < w[0] || X > w[2] || Y < w[1] || Y > w[3]) continue;
        if (!r) r = gRec(p);
        let lo = X,
          la = Y;
        if (!ll) [lo, la] = utm2ll(X, Y, zone);
        const px = (lo - lon) * GEO.kx,
          pz = -(la - lat) * 110574;
        if (Math.abs(px) > h || Math.abs(pz) > h) continue;
        let H = iH >= 0 ? num(gVal(r, iH)) : 0,
          cd = iC >= 0 ? num(gVal(r, iC)) : iR >= 0 ? 2 * num(gVal(r, iR)) : 0;
        if (!cd && q[2]) cd = q[2];
        if (H > 60 || H < 0) H = 0;
        if (!H) H = cd ? Math.max(4, cd * 1.6) : 10;
        if (!cd || cd > 40) cd = Math.max(2.5, H * 0.5);
        out.push({
          x: px,
          z: pz,
          h: H,
          r: cd / 2,
          src: 'gpkg',
          sp: iS >= 0 ? String(gVal(r, iS) || '') : '',
          lv: false,
          yr: iY >= 0 ? String(gVal(r, iY) || '') : '',
        });
      }
    },
    prog,
  );
  const mp = [
    M.h ? 'Höhe=' + M.h : 'Höhe nicht erkannt (geschätzt)',
    M.cd
      ? 'Kronendurchmesser=' + M.cd
      : M.cr
        ? 'Kronenradius=' + M.cr
        : 'Kronendurchmesser nicht erkannt (geschätzt)',
    M.sp ? 'Art=' + M.sp : '',
  ]
    .filter(Boolean)
    .join(', ');
  const nm = TFILES.find((x) => x.re.test(f.name)) || {};
  return {
    list: out,
    n: out.length,
    msg:
      'Baumdatei ' +
      f.name +
      (nm.src ? ' (' + nm.src + ')' : '') +
      ': ' +
      out.length +
      ' Bäume im Ausschnitt (Tabelle ' +
      L.table +
      ', EPSG:' +
      ep +
      ', ' +
      scanned +
      ' Zeilen gelesen; ' +
      mp +
      ').' +
      (M.h && M.cd
        ? ''
        : ' Spalten: ' +
          t.cols.filter((c) => c !== L.gcol).join(', ') +
          ' – bei Bedarf unter „Projekt → Baumdatei“ zuordnen.'),
  };
}
async function gpkFileTrees(lon, lat, size) {
  if (!GEO.treeFile) return { list: [], n: 0, msg: '' };
  return gpkTrees(GEO.treeFile, lon, lat, size, (p) => {
    try {
      gst('Lese Baumdatei … ' + Math.round(p * 100) + ' %');
    } catch (e) {
      logErr(e, 'gpkFileTrees>anonym');
    }
  });
}
async function treeFileSet(f) {
  GEO.treeFile = f || null;
  GEO.treeInfo = '';
  if (f) {
    try {
      const I = await gInfo(f),
        L = I.layer,
        M = gMap(L.cols, GEO.tcol);
      GEO.treeInfo =
        'Erkannt: Tabelle ' +
        L.table +
        ' (' +
        L.gtype +
        ', EPSG:' +
        L.epsg +
        '); Spalten: ' +
        L.cols.filter((c) => c !== L.gcol).join(', ') +
        '. Höhe → ' +
        (M.h || '–') +
        ', Kronendurchmesser → ' +
        (M.cd || M.cr || '–') +
        ', Art → ' +
        (M.sp || '–') +
        '.';
    } catch (e) {
      GEO.treeInfo = 'Datei nicht lesbar: ' + (e.message || e);
    }
  }
  rr();
  if ($('srcm') && $('srcm').style.display === 'flex') srcOpen();
}
async function treeFileApply() {
  if (!S.geo || !GEO.treeFile) return;
  const e = $('tfm'),
    say = (t) => {
      if (e) e.textContent = t;
    };
  try {
    say('Lese Baumdatei …');
    const r = await gpkTrees(GEO.treeFile, GEO.lon, GEO.lat, GEO.size, (p) =>
      say('Lese Baumdatei … ' + Math.round(p * 100) + ' %'),
    );
    if (!r.list.length) {
      GEO.treeMsg = r.msg;
      rr();
      return;
    }
    const old = (GEO.trees || []).filter((t) => !r.list.some((q) => Math.hypot(q.x - t.x, q.z - t.z) < 3));
    treesBuild(r.list.concat(old));
    GEO.tdel = [];
    const rg = [];
    ((GEO.acc && GEO.acc.b) || []).forEach((b) => {
      if (b.o) rg.push(b.o);
      if (b.xr) b.xr.forEach((q) => rg.push(q));
    });
    const nDel = treePrune(rg);
    GEO.tdel = [];
    GEO.treeMsg =
      r.msg +
      ' Bestehende Bäume in 3 m Nähe ersetzt, ' +
      nDel +
      ' Bäume in Gebäuden entfernt, ' +
      (GEO.trees ? GEO.trees.length : 0) +
      ' verbleiben.';
    rr();
  } catch (er) {
    GEO.treeMsg = 'Baumdatei: ' + (er.message || er);
    rr();
  }
}

function canopy(DG, DO, bl, skip, ex) {
  // ── Erweiterung aus 20-geodaten-international/030-gebaeudemaske-fuer-das-kronenmodell-aus.js
  if (DG && !DG.fail && DO && !DO.fail && DO.plan && DO.res <= 1.5 && DG.w === DO.w && DG.h === DO.h) {
    try {
      const r = atRoofClean(DG, DO);
      if (r.n) {
        DO = Object.assign({}, DO, { data: r.data });
        const c = canopyBasis.call(this, DG, DO, bl, skip, ex);
        c.msg = (c.msg || '') + ' Dachflächen aus dem Höhenmodell maskiert: ' + r.n + ' Gebäude.';
        return c;
      }
    } catch (e) {
      logErr(e, 'canopy');
    }
  }
  return canopyBasis.apply(this, arguments);
}
// canopy() ohne die Erweiterungen darüber – wird von canopy() gezielt aufgerufen
function canopyBasis(DG, DO, bl, skip, ex) {
  if (!DG || DG.fail || !DO || DO.fail || DG.w !== DO.w || DG.h !== DO.h)
    return {
      list: [],
      msg:
        'Kronenmodell: ' +
        (!DG || !DO
          ? 'kein DOM1/DGM1-Zugang für ' +
            (GEO.alkBL || 'dieses Bundesland') +
            ' hinterlegt (nur OSM-Bäume; eigene WCS-Adressen unter „Projekt → Höhenmodell-Dienste“)'
          : 'DOM1/DGM1 nicht verfügbar') +
        '.',
    };
  const W = DO.w,
    Hh = DO.h,
    res = DO.res,
    n = new Float32Array(W * Hh);
  for (let i = 0; i < n.length; i++) {
    const a = DO.data[i],
      b = DG.data[i];
    n[i] = a > -400 && a < 4500 && b > -400 && b < 4500 ? a - b : 0;
  }
  // Gebäudemaske (Grundrisse + 1,5 m Puffer)
  const mask = new Uint8Array(W * Hh),
    toIJ = (x, z) => {
      const [E, N] = ll2utm(GEO.lon + x / GEO.kx, GEO.lat - z / 110574, DO.zone || 32);
      return [(E - DO.minx) / res, (DO.maxy - N) / DO.resY];
    };
  for (const b of bl) {
    if (!b.o || b.o.length < 3) continue;
    const P = b.o.map((q) => toIJ(q[0], q[1])),
      i0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[0]))) - 2),
      i1 = Math.min(W - 1, Math.ceil(Math.max(...P.map((q) => q[0]))) + 2),
      j0 = Math.max(0, Math.floor(Math.min(...P.map((q) => q[1]))) - 2),
      j1 = Math.min(Hh - 1, Math.ceil(Math.max(...P.map((q) => q[1]))) + 2);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = i + 0.5,
          py = j + 0.5;
        let ins = false;
        for (let a = 0, c = P.length - 1; a < P.length; c = a++) {
          if (
            P[a][1] > py !== P[c][1] > py &&
            px < ((P[c][0] - P[a][0]) * (py - P[a][1])) / (P[c][1] - P[a][1]) + P[a][0]
          )
            ins = !ins;
        }
        if (!ins) {
          let md = 1e9;
          for (let a = 0, c = P.length - 1; a < P.length; c = a++) {
            const ax = P[c][0],
              ay = P[c][1],
              bx = P[a][0],
              by = P[a][1],
              dx = bx - ax,
              dy = by - ay,
              t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))),
              d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
            if (d < md) md = d;
          }
          ins = md * res < 1.5;
        }
        if (ins) mask[j * W + i] = 1;
      }
  }
  const sm = new Float32Array(W * Hh);
  for (let j = 1; j < Hh - 1; j++)
    for (let i = 1; i < W - 1; i++) {
      let t = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) t += n[(j + dj) * W + i + di];
      sm[j * W + i] = t / 9;
    }
  const R = Math.max(2, Math.round(2.5 / res)),
    out = [],
    hx = GEO.size / 2,
    X = { w: 0, b: 0, m: 0 };
  // Ausschluss: Stammposition (Kronenmitte) im Wasser, mehr als 50 cm vom Ufer entfernt (Löcher = Inseln bleiben), Brückenbereiche (OSM brunnel=bridge), Masten (schmal und hoch)
  const rin = (x, z, r) => {
      let c = false;
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
        if (
          r[a][1] > z !== r[b][1] > z &&
          x < ((r[b][0] - r[a][0]) * (z - r[a][1])) / (r[b][1] - r[a][1]) + r[a][0]
        )
          c = !c;
      }
      return c;
    },
    wBB =
      ex && ex.water
        ? ex.water.map((pg) => {
            let x0 = 1e9,
              x1 = -1e9,
              z0 = 1e9,
              z1 = -1e9;
            for (const q of pg[0]) {
              x0 = Math.min(x0, q[0]);
              x1 = Math.max(x1, q[0]);
              z0 = Math.min(z0, q[1]);
              z1 = Math.max(z1, q[1]);
            }
            return { pg, x0, x1, z0, z1 };
          })
        : [],
    dEd = (x, z, r) => {
      let m = 1e9;
      for (let a = 0; a < r.length; a++) {
        const b = (a + r.length - 1) % r.length,
          ax = r[b][0],
          az = r[b][1],
          dx = r[a][0] - ax,
          dz = r[a][1] - az,
          t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))),
          d = Math.hypot(x - ax - t * dx, z - az - t * dz);
        if (d < m) m = d;
      }
      return m;
    },
    wd = (x, z) => {
      for (const o of wBB) {
        if (
          x < o.x0 - 0.5 ||
          x > o.x1 + 0.5 ||
          z < o.z0 - 0.5 ||
          z > o.z1 + 0.5 ||
          !rin(x, z, o.pg[0]) ||
          o.pg.slice(1).some((h) => rin(x, z, h))
        )
          continue;
        let m = 1e9;
        for (const r of o.pg) m = Math.min(m, dEd(x, z, r));
        return m;
      }
      return 0;
    },
    // Stamm (Kronenmitte) im Wasser: Karten-/Uferungenauigkeit und kleine Inseln werden toleriert – erst mehr als 6 m vom Ufer (Schiffe, Stege, Masten mitten im Wasser) fliegt der „Baum“ raus; Inseln (Löcher im Wasser) zählen als Land
    inWater = (x, z) => wd(x, z) > 6,
    nearBr = (x, z) =>
      ex &&
      ex.br &&
      ex.br.some((o) => {
        const L = o.l,
          d = o.w / 2;
        for (let a = 1; a < L.length; a++) {
          const ax = L[a - 1][0],
            az = L[a - 1][1],
            dx = L[a][0] - ax,
            dz = L[a][1] - az,
            t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
          if (Math.hypot(x - ax - t * dx, z - az - t * dz) < d) return true;
        }
        return false;
      });
  for (let j = R; j < Hh - R; j++)
    for (let i = R; i < W - R; i++) {
      const k = j * W + i,
        v = sm[k];
      if (v < 3 || v > 38 || mask[k]) continue;
      let pk = true;
      for (let dj = -R; dj <= R && pk; dj++)
        for (let di = -R; di <= R; di++) {
          if (!dj && !di) continue;
          const w = sm[(j + dj) * W + i + di];
          if (w > v || (w === v && (dj < 0 || (dj === 0 && di < 0)))) {
            pk = false;
            break;
          }
        }
      if (!pk) continue;
      // Rauigkeit: Dächer sind glatt, Kronen nicht
      let m1 = 0,
        m2 = 0,
        c = 0;
      for (let dj = -R; dj <= R; dj++)
        for (let di = -R; di <= R; di++) {
          const w = n[(j + dj) * W + i + di];
          m1 += w;
          m2 += w * w;
          c++;
        }
      const sd = Math.sqrt(Math.max(0, m2 / c - (m1 / c) ** 2));
      if (sd < 0.45) continue;
      // Kronenradius: 8 Richtungen bis Höhe < 50 % des Gipfels
      let rs = 0;
      for (let a = 0; a < 8; a++) {
        const ax = Math.cos((a * Math.PI) / 4),
          ay = Math.sin((a * Math.PI) / 4);
        let d = 1;
        for (; d < 14 / res; d++) {
          const ii = Math.round(i + ax * d),
            jj = Math.round(j + ay * d);
          if (ii < 0 || jj < 0 || ii >= W || jj >= Hh || n[jj * W + ii] < v * 0.5) break;
        }
        rs += d;
      }
      const rm = (rs / 8) * res,
        hh = Math.max(n[k], v);
      if (hh >= 10 && rm * 2 < 0.09 * hh) {
        X.m++;
        continue;
      }
      let mx = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) mx = Math.max(mx, n[(j + dj) * W + i + di]);
      if (mx >= 8) {
        let cn = 0;
        for (let dj = -R; dj <= R; dj++)
          for (let di = -R; di <= R; di++) if (n[(j + dj) * W + i + di] >= mx * 0.4) cn++;
        if (cn < 5) {
          X.m++;
          continue;
        }
      }
      const cr = Math.max(1.2, Math.min(9, rm)),
        x = -hx + (i + 0.5) * res - 0,
        E = DO.minx + (i + 0.5) * res,
        N = DO.maxy - (j + 0.5) * DO.resY,
        ll = utm2ll(E, N, DO.zone || 32),
        xz = ll2xz(ll[0], ll[1]);
      if (Math.abs(xz[0]) > hx || Math.abs(xz[1]) > hx) continue;
      if (ex) {
        if (inWater(xz[0], xz[1])) {
          X.w++;
          continue;
        }
        if (nearBr(xz[0], xz[1])) {
          X.b++;
          continue;
        }
      }
      if (skip.some((o) => Math.hypot(o.x - xz[0], o.z - xz[1]) < Math.max(2, o.r))) continue;
      out.push({ x: xz[0], z: xz[1], h: Math.max(n[k], v), r: cr, src: 'dom' });
    }
  return {
    list: out,
    msg:
      'Kronenmodell (DOM1−DGM1): ' +
      out.length +
      ' Bäume' +
      (X.w + X.b + X.m
        ? ' (' +
          [
            X.w ? X.w + ' über Wasser' : '',
            X.b ? X.b + ' auf Brücken' : '',
            X.m ? X.m + ' Masten/Schmalstrukturen' : '',
          ]
            .filter(Boolean)
            .join(', ') +
          ' aussortiert)'
        : '') +
      '.',
  };
}
function treesBuild(list) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/110-detailbaeume-im-nahbereich-der-kamera.js
  NEAR.cls = {};
  NEAR.orig = null;
  NEAR.base = null;
  NEAR.stem = null;
  NEAR.sorig = null;
  NEAR.c = null;
  NEAR.dir = null;
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js
  // Aufbau: eigene Bäume immer ergänzen, Krone nach oben schieben, Stamm einsetzen
  const all = (list || []).filter((t) => !t.u).concat(UT);
  const r = treesBuildStufe2.call(this, all);
  try {
    if (UT.length && GEO.tmesh) {
      const tm = GEO.tmesh,
        M = new T.Matrix4(),
        Z = new T.Matrix4().makeScale(0, 0, 0),
        idx = [];
      GEO.trees.forEach((t, i) => {
        if (!t.u) return;
        idx.push(i);
        const y = gh(t.x, t.z),
          sh = Math.min(t.sh, t.h - 0.5),
          ch = Math.max(0.5, t.h - sh),
          cr = Math.max(0.5, t.r);
        M.makeScale(cr, ch / 2, cr).setPosition(t.x, y + sh + ch / 2, t.z);
        tm.setMatrixAt(i, M);
      });
      tm.instanceMatrix.needsUpdate = true;
      tm.frustumCulled = false;
      G.trees.children.forEach((c) => {
        if (
          c.isInstancedMesh &&
          c !== tm &&
          c.geometry &&
          c.geometry.type === 'CylinderGeometry' &&
          c.count === GEO.trees.length
        ) {
          idx.forEach((i) => c.setMatrixAt(i, Z));
          c.instanceMatrix.needsUpdate = true;
        }
      });
      const st = new T.InstancedMesh(
        new T.CylinderGeometry(0.5, 0.62, 1, 10).translate(0, 0.5, 0),
        new T.MeshLambertMaterial({ color: new T.Color(S.lc.stem || '#7a6742') }),
        idx.length,
      );
      idx.forEach((i, k) => {
        const t = GEO.trees[i],
          y = gh(t.x, t.z);
        M.makeScale(t.sd, Math.max(0.1, Math.min(t.sh, t.h - 0.5) + 0.45), t.sd).setPosition(
          t.x,
          y - 0.25,
          t.z,
        );
        st.setMatrixAt(k, M);
      });
      st.instanceMatrix.needsUpdate = true;
      st.castShadow = st.receiveShadow = true;
      st.raycast = () => {};
      st.frustumCulled = false;
      G.trees.add(st);
    }
  } catch (x) {
    console.warn('trees user', x);
  }
  return r;
}
// treesBuild() ohne die Erweiterungen darüber – wird von treesBuild() gezielt aufgerufen
function treesBuildStufe2(list) {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/010-gruen-wasser.js
  const r = (() => {
    clr(G.trees);
    GEO.trees = list;
    treeSel(null);
    GEO.tmesh = null;
    if (!list.length) return;
    const crw = new T.InstancedMesh(
        new T.IcosahedronGeometry(1, 2),
        mat(new T.Color(S.lc.trees)),
        list.length,
      ),
      M = new T.Matrix4();
    list.forEach((t, i) => {
      const y = gh(t.x, t.z),
        h = Math.max(1.5, t.h),
        cr = Math.max(1, t.r);
      M.makeScale(cr, h / 2, cr).setPosition(t.x, y + h / 2, t.z);
      crw.setMatrixAt(i, M);
    });
    crw.castShadow = crw.receiveShadow = true;
    crw.userData.tr = 1;
    GEO.tmesh = crw;
    G.trees.add(crw);
    {
      const tc = shade(S.lc.trees, 0.66),
        g2 = new T.Group(),
        pts = [],
        N = 64,
        dm = new T.InstancedMesh(
          new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2),
          new T.MeshBasicMaterial({ color: tc, side: T.DoubleSide }),
          list.length,
        ),
        M2 = new T.Matrix4();
      const mr = Math.max(1, ...list.map((t) => Math.max(1, t.r))),
        cs = mr * 2 + 1,
        gk = (x, z) => Math.floor(x / cs) + ',' + Math.floor(z / cs),
        grid = {};
      list.forEach((t, i) => {
        (grid[gk(t.x, t.z)] = grid[gk(t.x, t.z)] || []).push(i);
      });
      const covered = (i, px, pz) => {
        const cx = Math.floor(px / cs),
          cz = Math.floor(pz / cs);
        for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++) {
            const g = grid[cx + a + ',' + (cz + b)];
            if (g)
              for (const j of g) {
                if (j === i) continue;
                const o = list[j],
                  r = Math.max(1, o.r);
                if ((px - o.x) ** 2 + (pz - o.z) ** 2 < r * r - 1e-4) return true;
              }
          }
        return false;
      };
      list.forEach((t, i) => {
        const y = gh(t.x, t.z) + Math.max(1.5, t.h) + 0.5,
          cr = Math.max(1, t.r);
        for (let q = 0; q < N; q++) {
          const a = (q / N) * 2 * Math.PI,
            c = ((q + 1) / N) * 2 * Math.PI,
            mA = (a + c) / 2;
          if (covered(i, t.x + cr * Math.cos(mA), t.z + cr * Math.sin(mA))) continue;
          pts.push(
            t.x + cr * Math.cos(a),
            y,
            t.z + cr * Math.sin(a),
            t.x + cr * Math.cos(c),
            y,
            t.z + cr * Math.sin(c),
          );
        }
        M2.makeScale(0.45, 1, 0.45).setPosition(t.x, y + 0.05, t.z);
        dm.setMatrixAt(i, M2);
      });
      const lg = new T.BufferGeometry();
      lg.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3));
      const ln = new T.LineSegments(lg, new T.LineBasicMaterial({ color: tc }));
      ln.frustumCulled = false;
      ln.raycast = () => {};
      dm.raycast = () => {};
      dm.frustumCulled = false;
      g2.add(ln, dm);
      g2.visible = !S.m3;
      G.trees.add(g2);
      GEO.t2d = g2;
      GEO.t2m = [ln.material, dm.material];
    }
    const L = LY.find((l) => l[1] === 'trees');
    G.trees.visible = !L || !!L[2];
    if (L && L[3] < 1) op('trees', L[3]);
  })();
  FX.tr = false;
  try {
    if (fxOn('trees') && GEO.tmesh && GEO.trees && GEO.trees.length) {
      fxTrees();
      fxTreeFx();
      FX.tr = true;
      FX.tv = fxTv();
      FX.tc = S.lc.trees;
      if (!FX.opT) {
        const L = LY.find((l) => l[1] === 'trees');
        if (L && L[3] !== 1) {
          L[3] = 1;
          try {
            if ($('lyp').style.display === 'block') lyRender();
          } catch (e) {
            logErr(e, 'treesBuild');
          }
        }
      }
      fxTreeOp();
    }
  } catch (e) {
    console.error(e);
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/120-tannen.js (danach)
  WLD.mod = false;
  WLD.sig = '';
  return r;
}
function dgmAt(D, x, z) {
  const [E, N] = ll2utm(GEO.lon + x / GEO.kx, GEO.lat - z / 110574, D.zone || 32),
    u = (E - D.minx) / D.res - 0.5,
    v = (D.maxy - N) / D.resY - 0.5;
  if (u < 0 || v < 0 || u >= D.w - 1 || v >= D.h - 1) return NaN;
  const i = u | 0,
    j = v | 0,
    a = u - i,
    b = v - j,
    d = D.data,
    w = D.w,
    p = d[j * w + i],
    q = d[j * w + i + 1],
    r = d[(j + 1) * w + i],
    t = d[(j + 1) * w + i + 1];
  const ok = (y) => y > -400 && y < 4500;
  if (!(ok(p) && ok(q) && ok(r) && ok(t))) return NaN;
  return (p * (1 - a) + q * a) * (1 - b) + (r * (1 - a) + t * a) * b;
}
function ctxBuild(list) {
  clr(G.ex);
  GEO.ranges = [];
  GEO.mesh = null;
  S.ctxPts = [];
  ctxSelect(null);
  const pa = [],
    na = [],
    ea = [];
  let tri = 0;
  list.sort((a, b) => Math.hypot(...cen(a.o)) - Math.hypot(...cen(b.o)));
  for (const b of list.slice(0, 6000)) {
    const ge = b.tris ? triGeo(b) : bExtrude(b);
    if (!ge) continue;
    const pos = ge.attributes.position.array,
      nor = ge.attributes.normal.array;
    for (let i = 0; i < pos.length; i++) {
      pa.push(pos[i]);
      na.push(nor[i]);
    }
    try {
      const ep = new T.EdgesGeometry(ge, 35).attributes.position.array;
      for (let i = 0; i < ep.length; i++) ea.push(ep[i]);
    } catch (e) {
      logErr(e, 'ctxBuild');
    }
    const n = pos.length / 9;
    GEO.ranges.push({ s: tri, e: tri + n, b });
    tri += n;
    ge.dispose();
    b.o.forEach((q) => S.ctxPts.push(q));
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
  g.setAttribute('normal', new T.BufferAttribute(new Float32Array(na), 3));
  const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: S.lc.buildings, side: T.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  m.userData.ctx = true;
  G.ex.add(m);
  GEO.mesh = m;
  if (ea.length) {
    const eg = new T.BufferGeometry();
    eg.setAttribute('position', new T.BufferAttribute(new Float32Array(ea), 3));
    const el = new T.LineSegments(
      eg,
      new T.LineBasicMaterial({ color: S.edgeC, transparent: true, opacity: 0.75 }),
    );
    el.userData.kont = 1;
    el.visible = !S.noK;
    el.raycast = () => {};
    el.frustumCulled = false;
    G.ex.add(el);
  }
  const L = LY.find((l) => l[1] === 'buildings');
  if (L && L[3] < 1) op('buildings', L[3]);
  // ── Erweiterung aus 24-erweiterungen-v344-v436/100-eigenschaften.js (danach)
  try {
    if (HNR.data && hnrOn()) hnrBuild();
  } catch (e) {
    logErr(e, 'ctxBuild');
  }
}
function geoPick() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/010-fokus.js
  return ISO3.on
    ? null
    : (() => {
        return GEO.mesh ? rc.intersectObject(GEO.mesh, false)[0] : null;
      })();
}
function ctxSelect(hit) {
  if (GEO.selG) {
    sc.remove(GEO.selG);
    GEO.selG.traverse((o) => o.geometry && o.geometry.dispose());
    GEO.selG = null;
  }
  GEO.sel = null;
  if (!hit) return;
  const r = GEO.ranges.find((r) => hit.faceIndex >= r.s && hit.faceIndex < r.e);
  if (!r) return;
  GEO.sel = r.b;
  const ge = r.b.tris ? triGeo(r.b) : bExtrude(r.b);
  if (!ge) return;
  const g = new T.Group();
  const m = new T.Mesh(
    ge,
    new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.16,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false,
    }),
  );
  m.renderOrder = 5;
  const l = new T.LineSegments(
    new T.EdgesGeometry(ge, 25),
    new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }),
  );
  l.renderOrder = 6;
  g.add(m, l);
  sc.add(g);
  GEO.selG = g;
}
