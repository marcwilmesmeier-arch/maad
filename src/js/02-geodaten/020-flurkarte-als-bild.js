// ---- Flurkarte als Bild (WMS) für Länder ohne Flurstücks-Vektordienst
const WMSK = {
  by: {
    name: 'ALKIS-Parzellarkarte Bayern (WMS)',
    src: '© Bayerische Vermessungsverwaltung, CC BY 4.0',
    u: 'https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte',
    bb: [8.976, 47.18, 14.015, 50.57],
    lay: {
      rot: ['by_alkis_parzellarkarte_umr_schwarz', 'Rot gestrichelt wie die Flurstücke (Standard)'],
      umr_schwarz: ['by_alkis_parzellarkarte_umr_schwarz', 'Umring schwarz (transparent)'],
      umr_gelb: ['by_alkis_parzellarkarte_umr_gelb', 'Umring gelb (transparent)'],
      farbe: ['by_alkis_parzellarkarte_farbe', 'Farbe (deckend)'],
      grau: ['by_alkis_parzellarkarte_grau', 'Graustufen (deckend)'],
    },
    note: 'Reines Kartenbild: ohne Flurstücksnummern und Grenzzeichen, nicht anklickbar, nicht zur Maßentnahme.',
  },
};
S.wmsOn = S.wmsOn !== false;
S.wmsLay = S.wmsLay || 'rot';
function wmsPaint() {
  try {
    const c = PL.wms.getContext('2d');
    c.clearRect(0, 0, PW, PW);
    if (GEO.wmsImg) c.drawImage(GEO.wmsImg, 0, 0, PW, PW);
  } catch (e) {
    logErr(e, 'wmsPaint');
  }
}
// Parzellarkarte -> rot gestrichelte Linien im Stil der Vektor-Flurstücke: kleine freie Teile (Beschriftung, einzelne Gebäude) entfernen, Linien verbreitern, Strichmuster entlang der Linienrichtung
function wmsStyle(bm, px, ppm) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(bm, 0, 0, px, px);
  const id = x.getImageData(0, 0, px, px),
    d = id.data,
    n = px * px,
    m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  const q = new Int32Array(n),
    seen = new Uint8Array(n),
    minD = Math.max(12, Math.round(ppm * 28));
  for (let i = 0; i < n; i++) {
    if (!m[i] || seen[i]) continue;
    let h = 0,
      t = 0,
      x0 = px,
      x1 = 0,
      y0 = px,
      y1 = 0;
    q[t++] = i;
    seen[i] = 1;
    while (h < t) {
      const c = q[h++],
        cx = c % px,
        cy = (c - cx) / px;
      if (cx < x0) x0 = cx;
      if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy;
      if (cy > y1) y1 = cy;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = cy + dy;
        if (yy < 0 || yy >= px) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = cx + dx;
          if (xx < 0 || xx >= px) continue;
          const j = yy * px + xx;
          if (m[j] && !seen[j]) {
            seen[j] = 1;
            q[t++] = j;
          }
        }
      }
    }
    if (Math.max(x1 - x0, y1 - y0) < minD) for (let k = 0; k < t; k++) m[q[k]] = 0;
  }
  const dl = new Uint8Array(n);
  for (let y = 1; y < px - 1; y++)
    for (let xx = 1; xx < px - 1; xx++) {
      const c = y * px + xx;
      if (m[c] || m[c - 1] || m[c + 1] || m[c - px] || m[c + px]) dl[c] = 1;
    }
  const col = (S.lc.parcels || '#5E7F92').replace('#', ''),
    R = parseInt(col.slice(0, 2), 16),
    Gc = parseInt(col.slice(2, 4), 16),
    B = parseInt(col.slice(4, 6), 16),
    per = 2.6 * ppm,
    on = 1.6 * ppm,
    W = 5;
  for (let i = 0; i < n * 4; i += 4) d[i + 3] = 0;
  for (let y = W + 2; y < px - W - 2; y++)
    for (let xx = W + 2; xx < px - W - 2; xx++) {
      const c = y * px + xx;
      if (!dl[c]) continue;
      let jxx = 0,
        jyy = 0,
        jxy = 0;
      for (let dy = -W; dy <= W; dy++)
        for (let dx = -W; dx <= W; dx++) {
          const k = c + dy * px + dx,
            gx = m[k + 1] - m[k - 1],
            gy = m[k + px] - m[k - px];
          jxx += gx * gx;
          jyy += gy * gy;
          jxy += gx * gy;
        }
      let on_ = true;
      if (jxx + jyy > 0) {
        const a = 0.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2,
          tt = xx * Math.cos(a) + y * Math.sin(a),
          f = ((tt % per) + per) % per;
        on_ = Math.abs(f - per / 2) < on / 2;
      }
      if (on_) {
        const o = c * 4;
        d[o] = R;
        d[o + 1] = Gc;
        d[o + 2] = B;
        d[o + 3] = 255;
      }
    }
  x.putImageData(id, 0, 0);
  cv._m = m;
  return cv;
}
async function wmsLoad(k, lon, lat, size) {
  const w = WMSK[k];
  if (!w) return null;
  if (lon < w.bb[0] || lon > w.bb[2] || lat < w.bb[1] || lat > w.bb[3])
    throw new Error('Standort außerhalb des Dienstgebiets');
  const px = Math.min(3072, Math.max(1024, Math.round(size * 3.4))),
    dlo = size / 2 / (111320 * Math.cos((lat * Math.PI) / 180)),
    dla = size / 2 / 110574,
    ln = (w.lay[S.wmsLay] || w.lay.rot)[0],
    tr = /umr_/.test(ln) ? '&TRANSPARENT=TRUE' : '';
  const u = `${w.u}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${ln}&STYLES=&CRS=EPSG:4326&BBOX=${lat - dla},${lon - dlo},${lat + dla},${lon + dlo}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/png${tr}`;
  const r = await wfetch(u, 60000),
    ct = r.headers.get('content-type') || '',
    b = await r.blob();
  if (!/image\//.test(ct || b.type)) {
    const t = await b.text();
    throw new Error(
      'Dienst lieferte kein Bild: ' +
        t
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 160),
    );
  }
  const bm = await createImageBitmap(b);
  return { img: (S.wmsLay || 'rot') === 'rot' ? wmsStyle(bm, px, px / size) : bm, px, url: u };
}

// ---- Parzellarkarte (Linienbild) -> Flurstücke als Vektor: Flächen zwischen den Linien beschriften, Linien den Nachbarflächen zuschlagen, gemeinsame Grenzen nur einmal vereinfachen
function wmsVec(m, px, size, minA) {
  const pw = px >> 1,
    n = pw * pw,
    B = new Uint8Array(n),
    mpp = size / pw;
  for (let y = 0; y < pw; y++)
    for (let x = 0; x < pw; x++) {
      const i = 2 * y * px + 2 * x;
      B[y * pw + x] = m[i] | m[i + 1] | m[i + px] | m[i + px + 1] ? 1 : 0;
    }
  const D = B.slice();
  for (let y = 1; y < pw - 1; y++)
    for (let x = 1; x < pw - 1; x++) {
      const c = y * pw + x;
      if (B[c - 1] | B[c + 1] | B[c - pw] | B[c + pw]) D[c] = 1;
    }
  const lab = new Int32Array(n),
    q = new Int32Array(n);
  let nl = 0;
  const cnt = [0];
  for (let i = 0; i < n; i++) {
    if (D[i] || lab[i]) continue;
    nl++;
    let h = 0,
      t = 0,
      c = 0;
    q[t++] = i;
    lab[i] = nl;
    while (h < t) {
      const k = q[h++],
        x = k % pw,
        y = (k - x) / pw;
      c++;
      if (x > 0 && !D[k - 1] && !lab[k - 1]) {
        lab[k - 1] = nl;
        q[t++] = k - 1;
      }
      if (x < pw - 1 && !D[k + 1] && !lab[k + 1]) {
        lab[k + 1] = nl;
        q[t++] = k + 1;
      }
      if (y > 0 && !D[k - pw] && !lab[k - pw]) {
        lab[k - pw] = nl;
        q[t++] = k - pw;
      }
      if (y < pw - 1 && !D[k + pw] && !lab[k + pw]) {
        lab[k + pw] = nl;
        q[t++] = k + pw;
      }
    }
    cnt.push(c);
  }
  if (!nl) return [];
  // Linien den Nachbarflächen zuschlagen
  let h = 0,
    t = 0;
  for (let i = 0; i < n; i++) {
    if (!lab[i]) continue;
    const x = i % pw,
      y = (i - x) / pw;
    if (
      (x > 0 && !lab[i - 1]) ||
      (x < pw - 1 && !lab[i + 1]) ||
      (y > 0 && !lab[i - pw]) ||
      (y < pw - 1 && !lab[i + pw])
    )
      q[t++] = i;
  }
  while (h < t) {
    const k = q[h++],
      x = k % pw,
      y = (k - x) / pw,
      l = lab[k];
    if (x > 0 && !lab[k - 1]) {
      lab[k - 1] = l;
      q[t++] = k - 1;
    }
    if (x < pw - 1 && !lab[k + 1]) {
      lab[k + 1] = l;
      q[t++] = k + 1;
    }
    if (y > 0 && !lab[k - pw]) {
      lab[k - pw] = l;
      q[t++] = k - pw;
    }
    if (y < pw - 1 && !lab[k + pw]) {
      lab[k + pw] = l;
      q[t++] = k + pw;
    }
  }
  // kleine Flächen (Gebäude, Reste) der Nachbarfläche mit der längsten gemeinsamen Grenze zuschlagen
  const ar = new Float64Array(nl + 1);
  for (let i = 0; i < n; i++) ar[lab[i]]++;
  const par = new Int32Array(nl + 1);
  for (let i = 0; i <= nl; i++) par[i] = i;
  const fd = (a) => {
    while (par[a] !== a) {
      par[a] = par[par[a]];
      a = par[a];
    }
    return a;
  };
  const small = (l) => l > 0 && ar[l] * mpp * mpp < minA;
  for (let pass = 0; pass < 4; pass++) {
    const adj = new Map();
    const add = (a, b) => {
      if (a === b || a <= 0 || b <= 0) return;
      const k = a * (nl + 1) + b;
      adj.set(k, (adj.get(k) || 0) + 1);
    };
    for (let y = 0; y < pw; y++)
      for (let x = 0; x < pw; x++) {
        const i = y * pw + x,
          a = fd(lab[i]);
        if (x < pw - 1) {
          const b = fd(lab[i + 1]);
          add(a, b);
          add(b, a);
        }
        if (y < pw - 1) {
          const b = fd(lab[i + pw]);
          add(a, b);
          add(b, a);
        }
      }
    const best = new Map();
    adj.forEach((v, k) => {
      const a = Math.floor(k / (nl + 1)),
        b = k % (nl + 1);
      if (!small(a) || small(b)) return;
      const o = best.get(a);
      if (!o || v > o[1]) best.set(a, [b, v]);
    });
    if (!best.size) break;
    best.forEach(([b], a) => {
      par[a] = b;
      ar[b] += ar[a];
      ar[a] = 0;
    });
  }
  for (let i = 0; i < n; i++) lab[i] = fd(lab[i]);
  // Kanten auf dem Gitter der Pixelecken
  const NW = pw + 1,
    E = [],
    L = (x, y) => (x < 0 || y < 0 || x >= pw || y >= pw ? -1 : lab[y * pw + x]);
  for (let y = 0; y < pw; y++)
    for (let x = 0; x <= pw; x++) {
      const a = L(x - 1, y),
        b = L(x, y);
      if (a !== b) E.push(x + y * NW, x + (y + 1) * NW, a, b);
    }
  for (let y = 0; y <= pw; y++)
    for (let x = 0; x < pw; x++) {
      const a = L(x, y - 1),
        b = L(x, y);
      if (a !== b) E.push(x + y * NW, x + 1 + y * NW, a, b);
    }
  const ne = E.length / 4;
  if (ne > 1500000) throw new Error('Kartenbild zu fein gegliedert');
  const nodes = new Map();
  for (let e = 0; e < ne; e++) {
    for (let s = 0; s < 2; s++) {
      const k = E[e * 4 + s];
      let o = nodes.get(k);
      if (!o) nodes.set(k, (o = []));
      o.push(e);
    }
  }
  const used = new Uint8Array(ne),
    chains = [],
    tol = Math.max(1.3, 0.8 / mpp),
    px_ = (k) => k % NW,
    py_ = (k) => (k - px_(k)) / NW;
  const other = (e, k) => (E[e * 4] === k ? E[e * 4 + 1] : E[e * 4]);
  const dp = (P, a, b, out) => {
    let dm = 0,
      im = -1;
    const ax = P[a][0],
      ay = P[a][1],
      bx = P[b][0],
      by = P[b][1],
      dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = l
        ? Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / l
        : Math.hypot(P[i][0] - ax, P[i][1] - ay);
      if (d > dm) {
        dm = d;
        im = i;
      }
    }
    if (dm > tol && im > 0) {
      dp(P, a, im, out);
      dp(P, im, b, out);
    } else out.push(P[b]);
  };
  const simp = (P) => {
    if (P.length < 3) return P;
    const o = [P[0]];
    dp(P, 0, P.length - 1, o);
    return o;
  };
  const walk = (e0, k0) => {
    const path = [k0];
    let e = e0,
      k = k0;
    for (;;) {
      used[e] = 1;
      k = other(e, k);
      path.push(k);
      const o = nodes.get(k);
      if (o.length !== 2 || k === k0) break;
      const nx = o[0] === e ? o[1] : o[0];
      if (used[nx]) break;
      e = nx;
    }
    return path;
  };
  const mkc = (path, e0) => {
    const P = path.map((k) => [px_(k), py_(k)]);
    let S_;
    const closed = path[0] === path[path.length - 1];
    if (closed && P.length > 6) {
      let fi = 0,
        fd2 = 0;
      for (let i = 1; i < P.length; i++) {
        const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]);
        if (d > fd2) {
          fd2 = d;
          fi = i;
        }
      }
      const A = simp(P.slice(0, fi + 1)),
        Bq = simp(P.slice(fi));
      S_ = A.concat(Bq.slice(1));
    } else S_ = simp(P);
    chains.push({ pts: S_, a: path[0], b: path[path.length - 1], p: E[e0 * 4 + 2], q: E[e0 * 4 + 3] });
  };
  nodes.forEach((o, k) => {
    if (o.length === 2) return;
    for (const e of o) {
      if (used[e]) continue;
      mkc(walk(e, k), e);
    }
  });
  for (let e = 0; e < ne; e++) {
    if (used[e]) continue;
    mkc(walk(e, E[e * 4]), e);
  }
  // Ringe je Fläche
  const byL = new Map();
  chains.forEach((c, i) => {
    [c.p, c.q].forEach((l) => {
      if (l > 0) {
        let o = byL.get(l);
        if (!o) byL.set(l, (o = []));
        o.push(i);
      }
    });
  });
  const out = [];
  byL.forEach((ids, l) => {
    const left = new Set(ids),
      rings = [];
    while (left.size) {
      const i0 = left.values().next().value;
      left.delete(i0);
      let c = chains[i0],
        ring = c.pts.slice(),
        end = c.b;
      const start = c.a;
      let guard = 0;
      while (end !== start && guard++ < 5000) {
        let f = -1;
        for (const j of left) {
          const d = chains[j];
          if (d.a === end || d.b === end) {
            f = j;
            break;
          }
        }
        if (f < 0) break;
        left.delete(f);
        const d = chains[f];
        if (d.a === end) {
          ring = ring.concat(d.pts.slice(1));
          end = d.b;
        } else {
          ring = ring.concat(d.pts.slice().reverse().slice(1));
          end = d.a;
        }
      }
      if (ring.length > 3) rings.push(ring);
    }
    const R = rings
      .map((r) =>
        r
          .slice(0, -1)
          .map(([x, y]) => [+((x / pw - 0.5) * size).toFixed(2), +((y / pw - 0.5) * size).toFixed(2)]),
      )
      .filter((r) => r.length >= 3 && area(r) > 0.5);
    if (!R.length) return;
    R.sort((a, b) => area(b) - area(a));
    const touch = rings.some((r) => r.some(([x, y]) => x <= 0 || y <= 0 || x >= pw || y >= pw));
    out.push({ rings: R, cut: touch });
  });
  return out;
}
function parFromWms(auto) {
  const W = GEO.wmsMask;
  if (!W) return { ok: false, msg: 'Kein Kartenbild geladen (Darstellung „Rot gestrichelt“ nötig).' };
  const minA = +S.wmsMinA || 30;
  let r;
  try {
    r = wmsVec(W.m, W.px, W.size, minA);
  } catch (e) {
    return { ok: false, msg: 'Vektorisierung fehlgeschlagen: ' + e.message };
  }
  if (!r.length) return { ok: false, msg: 'Im Kartenbild wurden keine geschlossenen Flächen erkannt.' };
  if (r.length > 4000)
    return { ok: false, msg: 'Zu viele Flächen (' + r.length + '). Mindestfläche erhöhen.' };
  if (hasSite()) return { ok: false, msg: 'Ein Grundstück ist aktiv – zuerst löschen.' };
  AL.length = 0;
  S.parSel = new Set();
  r.forEach((o, i) =>
    AL.push({
      id: 'B' + (i + 1),
      kz: 'B' + (i + 1),
      poly: o.rings[0],
      rings: o.rings,
      area: area(o.rings[0]),
      af: 0,
      cut: o.cut,
      props: { quelle: 'aus WMS-Kartenbild abgeleitet' },
    }),
  );
  GEO.alkMsg =
    'Flurstücke aus dem Kartenbild abgeleitet (' +
    AL.length +
    ' Flächen, Mindestfläche ' +
    minA +
    ' m²) – Näherung, nicht zur Maßentnahme.';
  GEO.alkSrc = 'Quelle: ALKIS-Parzellarkarte Bayern (WMS), vektorisiert durch maad';
  LY[0][0] = 'Flurstücke (aus Kartenbild)';
  const Lw = LY.find((l) => l[1] === 'wms');
  if (Lw && auto) Lw[2] = 0;
  if (S.geo && !auto) {
    parRefresh();
    rr();
  }
  return { ok: true, msg: GEO.alkMsg };
}
function parWmsDel() {
  const del = [...S.parSel].sort((a, b) => b - a);
  del.forEach((i) => AL.splice(i, 1));
  S.parSel = new Set();
  parRefresh();
  rr();
}
async function wmsRun(lon, lat, size, snap, nPar) {
  if (!(snap && GEO.partRun)) {
    GEO.wmsImg = null;
    GEO.wmsMsg = '';
    GEO.wmsMask = null;
  }
  const L = LY.find((l) => l[1] === 'wms');
  if (snap || !S.wmsOn) {
    return;
  }
  let st = null;
  try {
    st = await bundeslandC(lon, lat);
  } catch (e) {
    logErr(e, 'wmsRun');
  }
  if (!st || !WMSK[st.key]) return;
  try {
    const r = await wmsLoad(st.key, lon, lat, size);
    GEO.wmsImg = r.img;
    GEO.wmsMask = r.img && r.img._m ? { m: r.img._m, px: r.px, size } : null;
    GEO.wmsMsg = 'Flurkarte als Bild: ' + WMSK[st.key].name + ', ' + r.px + ' px.';
    if (L && !nPar) {
      L[2] = 1;
    }
  } catch (e) {
    GEO.wmsMsg = 'Flurkarte (Bild) nicht geladen: ' + (e && e.message ? e.message : e);
  }
}
function ctxPaint(acc) {
  const K = PW / GEO.size,
    X = (x) => (x + GEO.size / 2) * K;
  for (const k in PL) PL[k].getContext('2d').clearRect(0, 0, PW, PW);
  wmsPaint();
  const path = (c, r) => {
    r.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
  };
  const fill = (k, list, col) => {
    const c = PL[k].getContext('2d');
    c.fillStyle = col;
    for (const rings of list) {
      c.beginPath();
      for (const r of rings) {
        path(c, r);
        c.closePath();
      }
      c.fill('evenodd');
    }
  };
  const line = (k, list, col, add) => {
    const c = PL[k].getContext('2d');
    c.strokeStyle = col;
    c.lineCap = c.lineJoin = 'round';
    for (const { l, w } of list) {
      c.lineWidth = Math.max(1, (w + add) * K);
      c.beginPath();
      path(c, l);
      c.stroke();
    }
  };
  // scharfe Kontur um Flächen (konstante Pixelbreite, dunklerer Ton)
  const edge = (k, list, col) => {
    const c = PL[k].getContext('2d');
    c.strokeStyle = col;
    c.lineWidth = 4.4 * PS;
    c.lineJoin = 'round';
    for (const rings of list) {
      c.beginPath();
      for (const r of rings) {
        path(c, r);
        c.closePath();
      }
      c.stroke();
    }
  };
  edge('green', acc.fill.green, shade(S.lc.green, 0.8));
  fill('green', acc.fill.green, S.lc.green);
  edge('water', acc.fill.water, shade(S.lc.water, 0.78));
  fill('water', acc.fill.water, S.lc.water);
  line('water', acc.line.water, shade(S.lc.water, 0.78), 0.7);
  line('water', acc.line.water, S.lc.water, 0);
  const rl = acc.line.roads.sort((a, b) => b.w - a.w);
  line('roads', rl, shade(S.lc.roads, 0.78), 0.9);
  line('roads', rl, S.lc.roads, 0);
  edge('paths', acc.fill.paths, shade(S.lc.paths, 0.8));
  fill('paths', acc.fill.paths, S.lc.paths);
  line('paths', acc.line.paths, shade(S.lc.paths, 0.8), 0.6);
  line('paths', acc.line.paths, S.lc.paths, 0);
  line('cycle', acc.line.cycle, shade(S.lc.cycle, 0.8), 0.6);
  line('cycle', acc.line.cycle, S.lc.cycle, 0);
  {
    const rc = S.lc.rail || '#9a9893',
      rr = acc.line.rail || [];
    line('rail', rr, shade(rc, 0.75), 0.9);
    line('rail', rr, rc, 0);
    const c = PL.rail.getContext('2d');
    c.save();
    c.strokeStyle = shade(rc, 0.55);
    c.lineCap = 'butt';
    c.lineJoin = 'round';
    c.setLineDash([Math.max(1, 0.5 * K), Math.max(1, 0.9 * K)]);
    for (const { l, w } of rr) {
      c.lineWidth = Math.max(1, w * 0.9 * K);
      c.beginPath();
      path(c, l);
      c.stroke();
    }
    c.restore();
  }
  areaPaint();
  parPaint();
  bpPaint();
  try {
    abstPaint();
  } catch (e) {
    logErr(e, 'ctxPaint');
  }
}
function recomp() {
  const c = GEO.comp,
    x = c.getContext('2d');
  x.globalAlpha = 1;
  x.fillStyle = S.lc.terrain;
  x.fillRect(0, 0, PW, PW);
  if (false) {
    x.fillStyle = '#ececea';
    x.fillRect(0, 0, PW, PW);
    if (S.wmPc !== false)
      try {
        const K = PW / GEO.size;
        uAreas(x, K, (v) => (v + GEO.size / 2) * K);
        uRoads(x, K, (v) => (v + GEO.size / 2) * K);
      } catch (e) {
        console.warn(e);
      }
    if (GEO.tex) GEO.tex.needsUpdate = true;
    return;
  }
  // Grundstück: im Gelände weiß, Straßen/Wege/Grün/Wasser/Radwege werden dort ausgespart (rote Überlagerung bleibt)
  const K = PW / GEO.size,
    X = (v) => (v + GEO.size / 2) * K,
    sites = (typeof P !== 'undefined' ? P : []).filter((q) => q.site && q.poly && q.poly.length > 2);
  const sp = () => {
    for (const q of sites) {
      q.poly.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
      x.closePath();
    }
  };
  if (sites.length) {
    x.fillStyle = '#fff';
    x.beginPath();
    sp();
    x.fill();
  }
  const GR = ['green', 'clg', 'water', 'paths', 'cycle', 'rail', 'roads'];
  for (const k of [
    'green',
    'clg',
    'water',
    'paths',
    'cycle',
    'rail',
    'bplan',
    'parcels',
    'wms',
    'roads',
    'abst',
  ]) {
    if (k === 'bplan') 0;
    if (k === 'abst') {
      uAreas(x, K, X);
      uRoads(x, K, X);
      continue;
    }
    const L = LY.find((l) => l[1] === k);
    if (!L || !L[2]) continue;
    x.globalAlpha = L[3];
    if (sites.length && GR.includes(k)) {
      x.save();
      x.beginPath();
      x.rect(0, 0, PW, PW);
      sp();
      x.clip('evenodd');
      x.drawImage(PL[k], 0, 0);
      x.restore();
    } else x.drawImage(PL[k], 0, 0);
  }
  x.globalAlpha = 1;
  if (GEO.tex) GEO.tex.needsUpdate = true;
}
// Gebäude: ein zusammengefasstes Netz (schnell), Auswahl über Dreiecks-Bereiche
function bExtrude(b) {
  try {
    let z0 = 1e9;
    for (const q of b.o) z0 = Math.min(z0, gh(q[0], q[1]));
    const dep = b.minh > 0 ? b.h - b.minh : b.h + 2,
      y0 = b.minh > 0 ? z0 + b.minh : z0 - 2;
    if (!(dep > 0.3)) return null;
    const sh = new T.Shape(b.o.map((q) => new T.Vector2(q[0], -q[1])));
    b.holes.forEach((r) => sh.holes.push(new T.Path(r.map((q) => new T.Vector2(q[0], -q[1])))));
    const ge = new T.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: false });
    ge.rotateX(-Math.PI / 2);
    ge.translate(0, y0, 0);
    return ge;
  } catch (e) {
    return null;
  }
}
