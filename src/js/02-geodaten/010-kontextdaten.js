// ---- Kontextdaten: MapTiler Vektorkacheln (OpenStreetMap) + Gelände (terrain-rgb) -> lokale Meter
const GEO = {
  key: '0jnOTw9obPwX3gZ4OJSu',
  q: '',
  lon: 0,
  lat: 0,
  kx: 111320,
  size: 1000,
  N: 200,
  grid: null,
  status: '',
  busy: false,
  sel: null,
  ranges: [],
  mesh: null,
  selG: null,
  tex: null,
};
const PW = Math.min(6144, (ren.capabilities && ren.capabilities.maxTextureSize) || 4096),
  PS = PW / 3072,
  PK = { wms: 1, bplan: 1, parcels: 1, roads: 1, paths: 1, cycle: 1, rail: 1, green: 1, water: 1, abst: 1 };
const PL = {};
['parcels', 'bplan', 'green', 'water', 'roads', 'paths', 'cycle', 'rail', 'abst', 'wms'].forEach((k) => {
  const c = document.createElement('canvas');
  c.width = c.height = PW;
  PL[k] = c;
});
GEO.comp = document.createElement('canvas');
GEO.comp.width = GEO.comp.height = PW;
S.geo = false;
S.ctxPts = [];
const ll2xz = (lon, lat) => [(lon - GEO.lon) * GEO.kx, -(lat - GEO.lat) * 110574];
const tX = (lon, z) => ((lon + 180) / 360) * 2 ** z,
  tY = (lat, z) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
  };
const tLon = (x, z) => (x / 2 ** z) * 360 - 180,
  tLat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };
// Gruppe leeren und Geometrien freigeben. Deklaration (nicht const), weil sie beim Laden schon gebraucht wird.
function clr(g) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    if (c.geometry) c.geometry.dispose();
  }
}
function gst(t) {
  GEO.status = t;
  ['gs', 'wzld'].forEach((id) => {
    const e = $(id);
    if (e) e.textContent = t;
  });
}
// Mapbox-Vector-Tile (PBF) Decoder
function mvt(buf) {
  const b = new Uint8Array(buf),
    out = {};
  let p = 0;
  const vi = () => {
    let r = 0,
      m = 1,
      c;
    do {
      c = b[p++];
      r += (c & 127) * m;
      m *= 128;
    } while (c & 128);
    return r;
  };
  const str = (s, e) => new TextDecoder().decode(b.subarray(s, e));
  const skip = (t) => {
    if (t === 0) vi();
    else if (t === 1) p += 8;
    else if (t === 2) {
      const n = vi();
      p += n;
    } else p += 4;
  };
  function val(e) {
    let v = null;
    while (p < e) {
      const k = vi(),
        f = k >>> 3,
        t = k & 7;
      if (f === 1) {
        const n = vi();
        v = str(p, p + n);
        p += n;
      } else if (f === 2) {
        v = new DataView(b.buffer, b.byteOffset + p, 4).getFloat32(0, true);
        p += 4;
      } else if (f === 3) {
        v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true);
        p += 8;
      } else if (f === 4 || f === 5) {
        v = vi();
      } else if (f === 6) {
        const z = vi();
        v = z % 2 ? -(z + 1) / 2 : z / 2;
      } else if (f === 7) {
        v = !!vi();
      } else skip(t);
    }
    return v;
  }
  function geom(g) {
    const rings = [];
    let cur = null,
      x = 0,
      y = 0,
      i = 0;
    while (i < g.length) {
      const c = g[i++],
        cmd = c & 7,
        n = c >>> 3;
      if (cmd === 1) {
        for (let j = 0; j < n; j++) {
          const dx = g[i++],
            dy = g[i++];
          x += (dx >>> 1) ^ -(dx & 1);
          y += (dy >>> 1) ^ -(dy & 1);
          cur = [[x, y]];
          rings.push(cur);
        }
      } else if (cmd === 2) {
        for (let j = 0; j < n; j++) {
          const dx = g[i++],
            dy = g[i++];
          x += (dx >>> 1) ^ -(dx & 1);
          y += (dy >>> 1) ^ -(dy & 1);
          if (cur) cur.push([x, y]);
        }
      }
    }
    return rings;
  }
  function feat(s, e, keys, vals) {
    p = s;
    let type = 0;
    const tags = [],
      g = [];
    while (p < e) {
      const k = vi(),
        f = k >>> 3,
        t = k & 7;
      if (f === 2 && t === 2) {
        const n = vi(),
          te = p + n;
        while (p < te) tags.push(vi());
      } else if (f === 3 && t === 0) type = vi();
      else if (f === 4 && t === 2) {
        const n = vi(),
          ge = p + n;
        while (p < ge) g.push(vi());
      } else skip(t);
    }
    const props = {};
    for (let i = 0; i + 1 < tags.length; i += 2) props[keys[tags[i]]] = vals[tags[i + 1]];
    return { type, props, rings: geom(g) };
  }
  function layer(e) {
    let name = '',
      ext = 4096;
    const keys = [],
      vals = [],
      fs = [];
    while (p < e) {
      const k = vi(),
        f = k >>> 3,
        t = k & 7;
      if (f === 1 && t === 2) {
        const n = vi();
        name = str(p, p + n);
        p += n;
      } else if (f === 2 && t === 2) {
        const n = vi();
        fs.push([p, p + n]);
        p += n;
      } else if (f === 3 && t === 2) {
        const n = vi();
        keys.push(str(p, p + n));
        p += n;
      } else if (f === 4 && t === 2) {
        const n = vi(),
          ve = p + n;
        vals.push(val(ve));
        p = ve;
      } else if (f === 5 && t === 0) ext = vi();
      else skip(t);
    }
    out[name] = { ext, feats: fs.map(([s, en]) => feat(s, en, keys, vals)) };
  }
  while (p < b.length) {
    const k = vi(),
      f = k >>> 3,
      t = k & 7;
    if (f === 3 && t === 2) {
      const n = vi(),
        e = p + n;
      layer(e);
      p = e;
    } else skip(t);
  }
  return out;
}
function polys(rings) {
  const out = [];
  for (const r of rings) {
    let a = 0;
    for (let i = 0, n = r.length; i < n; i++) {
      const q = r[(i + 1) % n];
      a += r[i][0] * q[1] - q[0] * r[i][1];
    }
    if (a > 0 || !out.length) out.push([r]);
    else out.at(-1).push(r);
  }
  return out;
}
// Höhe aus terrain-rgb-Kacheln
function elevAt(E, lon, lat) {
  const z = E.z,
    fx = tX(lon, z),
    fy = tY(lat, z),
    X = Math.floor(fx),
    Y = Math.floor(fy),
    t = E.t[X + '/' + Y];
  if (!t) return 0;
  const u = Math.min(t.w - 1.001, Math.max(0, (fx - X) * t.w - 0.5)),
    v = Math.min(t.h - 1.001, Math.max(0, (fy - Y) * t.h - 0.5)),
    x0 = Math.floor(u),
    y0 = Math.floor(v),
    a = u - x0,
    c = v - y0,
    d = t.d,
    w = t.w;
  return (
    (d[y0 * w + x0] * (1 - a) + d[y0 * w + x0 + 1] * a) * (1 - c) +
    (d[(y0 + 1) * w + x0] * (1 - a) + d[(y0 + 1) * w + x0 + 1] * a) * c
  );
}
async function elevLoad() {
  for (const z of [13, 12]) {
    try {
      const h = GEO.size / 2,
        x0 = tX(GEO.lon - h / GEO.kx, z) | 0,
        x1 = tX(GEO.lon + h / GEO.kx, z) | 0,
        y0 = tY(GEO.lat + h / 110574, z) | 0,
        y1 = tY(GEO.lat - h / 110574, z) | 0,
        jobs = [];
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          jobs.push(
            (async () => {
              const r = await fetch(
                `https://api.maptiler.com/tiles/terrain-rgb-v2/${z}/${x}/${y}.webp?key=${GEO.key}`,
              );
              if (!r.ok) throw new Error('HTTP ' + r.status);
              const bm = await createImageBitmap(await r.blob()),
                c = document.createElement('canvas');
              c.width = bm.width;
              c.height = bm.height;
              const g = c.getContext('2d');
              g.drawImage(bm, 0, 0);
              const d = g.getImageData(0, 0, c.width, c.height).data,
                e = new Float32Array(c.width * c.height);
              for (let i = 0; i < e.length; i++)
                e[i] = -10000 + (d[i * 4] * 65536 + d[i * 4 + 1] * 256 + d[i * 4 + 2]) * 0.1;
              return [x + '/' + y, { w: c.width, h: c.height, d: e }];
            })(),
          );
      return { z, t: Object.fromEntries(await Promise.all(jobs)) };
    } catch (e) {
      logErr(e, 'elevLoad');
    }
  }
  return null;
}
const gridH = (x, z) => {
  const N = GEO.N,
    g = GEO.grid,
    h = GEO.size / 2;
  let u = ((x + h) / GEO.size) * N,
    v = ((z + h) / GEO.size) * N;
  u = Math.min(N - 1e-6, Math.max(0, u));
  v = Math.min(N - 1e-6, Math.max(0, v));
  const i = u | 0,
    j = v | 0,
    a = u - i,
    b = v - j,
    w = N + 1;
  return (
    (g[j * w + i] * (1 - a) + g[j * w + i + 1] * a) * (1 - b) +
    (g[(j + 1) * w + i] * (1 - a) + g[(j + 1) * w + i + 1] * a) * b
  );
};
function gridBuild(E) {
  const N = GEO.N,
    h = GEO.size / 2,
    g = new Float32Array((N + 1) * (N + 1)),
    D = GEO.dgm;
  if (E || D) {
    const mt = E ? new Float32Array(g.length) : null,
      dg = D ? new Float32Array(g.length) : null;
    let sb = 0,
      nb = 0;
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const x = -h + (i * GEO.size) / N,
          z = -h + (j * GEO.size) / N,
          k = j * (N + 1) + i;
        if (E) mt[k] = elevAt(E, GEO.lon + x / GEO.kx, GEO.lat - z / 110574);
        if (D) {
          const v = dgmAt(D, x, z);
          dg[k] = v;
          if (E && v === v) {
            sb += v - mt[k];
            nb++;
          }
        }
      }
    const bias = nb ? sb / nb : 0;
    for (let k = 0; k < g.length; k++) {
      const v = D ? dg[k] : NaN;
      g[k] = v === v ? v : E ? mt[k] + bias : nb ? bias : 0;
    }
  }
  const e0 = g[(N / 2) * (N + 1) + N / 2];
  for (let i = 0; i < g.length; i++) g[i] -= e0;
  GEO.e0 = e0;
  GEO.grid = g;
  GHf = gridH;
}
function skirtBuild() {
  if (S.skirt) {
    G.terrain.remove(S.skirt);
    S.skirt.geometry.dispose();
    S.skirt.material.dispose();
    S.skirt = null;
  }
  const N = GEO.N,
    h = GEO.size / 2,
    st = GEO.size / N;
  let mn = 1e9;
  for (let i = 0; i < GEO.grid.length; i++) mn = Math.min(mn, GEO.grid[i]);
  const yb = mn - (GEO.slab || 30),
    pos = [],
    idx = [];
  const edge = (f) => {
    const b = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const [x, z] = f(i);
      pos.push(x, gh(x, z), z, x, yb, z);
    }
    for (let i = 0; i < N; i++) {
      const a = b + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  edge((i) => [-h + i * st, -h]);
  edge((i) => [-h + i * st, h]);
  edge((i) => [-h, -h + i * st]);
  edge((i) => [h, -h + i * st]);
  const b = pos.length / 3;
  pos.push(-h, yb, -h, h, yb, -h, -h, yb, h, h, yb, h);
  idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new T.Mesh(
    g,
    new T.MeshLambertMaterial({ color: shade(S.lc.terrain, 0.82), side: T.DoubleSide }),
  );
  m.receiveShadow = true;
  G.terrain.add(m);
  S.skirt = m;
}
function rebuildTerrain() {
  const g = new T.PlaneGeometry(GEO.size, GEO.size, GEO.N, GEO.N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gh(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  S.terr.geometry.dispose();
  S.terr.geometry = g;
  S.wf.geometry = g;
  GEO.tex = new T.CanvasTexture(GEO.comp);
  GEO.tex.anisotropy = Math.min(16, ren.capabilities.getMaxAnisotropy());
  S.terr.material.dispose();
  S.terr.material = new T.MeshLambertMaterial({ map: GEO.tex });
  skirtBuild();
}
// Vektorkacheln laden und in lokale Meter umrechnen
async function vecLoad() {
  const z = 14,
    h = GEO.size / 2,
    x0 = tX(GEO.lon - h / GEO.kx, z) | 0,
    x1 = tX(GEO.lon + h / GEO.kx, z) | 0,
    y0 = tY(GEO.lat + h / 110574, z) | 0,
    y1 = tY(GEO.lat - h / 110574, z) | 0,
    jobs = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      jobs.push(
        fetch(`https://api.maptiler.com/tiles/v3/${z}/${x}/${y}.pbf?key=${GEO.key}`).then(async (r) => {
          if (!r.ok) throw new Error('Kartenkacheln HTTP ' + r.status);
          return { x, y, z, t: mvt(await r.arrayBuffer()) };
        }),
      );
  return Promise.all(jobs);
}
function ctxCollect(tiles) {
  const H = GEO.size / 2,
    acc = {
      b: [],
      names: [],
      bridges: [],
      fill: { green: [], water: [], paths: [] },
      line: { roads: [], paths: [], cycle: [], rail: [], water: [] },
    },
    seen = new Set();
  const WR = {
      motorway: 14,
      trunk: 12,
      primary: 10,
      secondary: 8,
      tertiary: 7,
      minor: 6,
      service: 3.5,
      track: 2.5,
      pedestrian: 3,
      busway: 4,
      raceway: 8,
    },
    WW = { river: 8, canal: 6, stream: 2.5, drain: 1.5, ditch: 1.5 },
    GR = { grass: 1, wood: 1, wetland: 1, scrub: 1, farmland: 1 },
    GU = {
      cemetery: 1,
      playground: 1,
      pitch: 1,
      garden: 1,
      allotments: 1,
      recreation_ground: 1,
      village_green: 1,
      park: 1,
    };
  for (const { x: X, y: Y, z, t } of tiles) {
    const cv = (r, ext) => r.map(([a, b]) => ll2xz(tLon(X + a / ext, z), tLat(Y + b / ext, z)));
    const B = t.building;
    if (B)
      for (const f of B.feats) {
        if (f.type !== 3) continue;
        for (const pg of polys(f.rings)) {
          const rs = pg.map((r) => cv(r, B.ext)),
            o0 = rs[0],
            c = cen(o0),
            o = clipRing(o0, H);
          if (o.length < 3 || area(o) < 1) continue;
          const hs = rs
            .slice(1)
            .map((r) => clipRing(r, H))
            .filter((r) => r.length > 2 && area(r) > 0.5);
          const key = c[0].toFixed(1) + ',' + c[1].toFixed(1) + ':' + o.length;
          if (seen.has(key)) continue;
          seen.add(key);
          const rh = +f.props.render_height;
          acc.b.push({
            o,
            holes: hs,
            h: rh > 0 ? rh : 6,
            minh: +f.props.render_min_height || 0,
            est: !(rh > 0) || rh === 5,
            p: f.props,
          });
        }
      }
    const R = t.transportation;
    if (R)
      for (const f of R.feats) {
        const p = f.props,
          c = p.class,
          s = p.subclass;
        if (p.brunnel === 'bridge' && f.type === 2 && c)
          for (const r of f.rings)
            acc.bridges.push({ l: cv(r, R.ext), w: WR[c] || (/^(rail|transit)/.test(c) ? 6 : 3) });
        if (
          f.type === 2 &&
          /^(rail|transit)$/.test(c || '') &&
          p.brunnel !== 'tunnel' &&
          !/^(funicular|monorail|magnetic_levitation)$/.test(s || '')
        ) {
          const rw = s === 'tram' || s === 'light_rail' || s === 'narrow_gauge' ? 2.6 : 3.4;
          for (const r of f.rings) acc.line.rail.push({ l: cv(r, R.ext), w: rw });
          continue;
        }
        if (
          p.brunnel === 'tunnel' ||
          f.type === 1 ||
          !c ||
          /^(rail|transit|ferry|aerialway|bus_guideway)/.test(c)
        )
          continue;
        const k =
          c === 'path'
            ? s === 'cycleway'
              ? 'cycle'
              : 'paths'
            : c === 'pedestrian' || c === 'track'
              ? 'paths'
              : 'roads';
        if (f.type === 2) {
          const w = k === 'cycle' ? 2.2 : c === 'path' ? (s === 'steps' ? 1.5 : 1.8) : WR[c] || 5;
          for (const r of f.rings) acc.line[k].push({ l: cv(r, R.ext), w });
        } else if (f.type === 3 && k === 'paths')
          for (const pg of polys(f.rings)) acc.fill.paths.push(pg.map((r) => cv(r, R.ext)));
      }
    const RN = t.transportation_name;
    if (RN)
      for (const f of RN.feats) {
        const p = f.props;
        if (f.type !== 2 || !p.name || /^(rail|transit|ferry|aerialway|bus_guideway)/.test(p.class || ''))
          continue;
        for (const r of f.rings) acc.names.push({ n: p.name, l: cv(r, RN.ext), w: WR[p.class] || 5 });
      }
    const W = t.water;
    if (W)
      for (const f of W.feats)
        if (f.type === 3) for (const pg of polys(f.rings)) acc.fill.water.push(pg.map((r) => cv(r, W.ext)));
    const WL = t.waterway;
    if (WL)
      for (const f of WL.feats)
        if (f.type === 2 && WW[f.props.class])
          for (const r of f.rings)
            acc.line.water.push({ l: cv(r, WL.ext), w: WW[f.props.class], n: f.props.name || '' });
    const PA = t.park;
    if (PA)
      for (const f of PA.feats)
        if (f.type === 3) for (const pg of polys(f.rings)) acc.fill.green.push(pg.map((r) => cv(r, PA.ext)));
    const LC = t.landcover;
    if (LC)
      for (const f of LC.feats)
        if (f.type === 3 && GR[f.props.class])
          for (const pg of polys(f.rings)) acc.fill.green.push(pg.map((r) => cv(r, LC.ext)));
    const LU = t.landuse;
    if (LU)
      for (const f of LU.feats)
        if (f.type === 3 && GU[f.props.class])
          for (const pg of polys(f.rings)) acc.fill.green.push(pg.map((r) => cv(r, LU.ext)));
  }
  return acc;
}
