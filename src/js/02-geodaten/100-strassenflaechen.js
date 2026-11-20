// ======================= STRASSENFLÄCHEN ALS VEKTORFLÄCHE =======================
// Straßen (OSM-Achsen mit Breite, GEO.acc.line.roads) werden nicht mehr ins Kartenbild gemalt (unscharf aus der Nähe),
// sondern als eigene Fläche 15 cm unter dem Gelände angelegt, mit senkrechter Kante („Bordstein“) zum Gelände; das
// Gelände bekommt dort ein Loch (Maske im Geländeshader). Einmündungen werden mit einem Standardradius ausgerundet:
// morphologisches Schließen (Straßenband um r verbreitern, dann um r verschmälern) über ein Distanzfeld, Umriss als
// Vektor (Marching Squares mit Interpolation, vereinfacht). Farbe: Layer-Farbe der Straßen (S.lc.roads).

const STR = {
  r: 4, // Ausrundungsradius an Einmündungen (m)
  ufer: 3, // Brücken: Straßenhöhe so weit hinter der Uferkante abnehmen (Böschung, m)
  tief: 0.15, // Versatz ins Gelände (m)
  sig: '',
  aktiv: false,
  ringe: [], // [{ o: Ring, h: [Ringe] }] Grundriss [x, z]
  mat: null,
  matK: null,
  uM: { value: null }, // Maske: R = 128 + 100 · Abstand zum Rand (m), > 128 = Straße; G > 128 = Brücke
  uG: { value: 1 }, // Kantenlänge des Geländes (m)
  T: 0,
};

/** Quadrierter euklidischer Abstand 1D (Felzenszwalb/Huttenlocher) – f wird überschrieben. */
function strEdt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
/** Abstand (in Zellen) jeder Zelle zur nächsten Zelle mit innen[i] = 0 (Felder N × N). */
function strEdt(innen, N) {
  const INF = 1e20,
    g = new Float32Array(N * N),
    f = new Float64Array(N),
    d = new Float64Array(N),
    v = new Int32Array(N),
    z = new Float64Array(N + 1);
  for (let i = 0; i < N * N; i++) g[i] = innen[i] ? INF : 0;
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) f[y] = g[y * N + x];
    strEdt1(f, N, d, v, z);
    for (let y = 0; y < N; y++) g[y * N + x] = d[y];
  }
  for (let y = 0; y < N; y++) {
    const o = y * N;
    for (let x = 0; x < N; x++) f[x] = g[o + x];
    strEdt1(f, N, d, v, z);
    for (let x = 0; x < N; x++) g[o + x] = Math.sqrt(d[x]);
  }
  return g;
}
/** Ring vereinfachen (Douglas-Peucker, Toleranz e in m). */
function strVereinfachen(r, e) {
  const n = r.length;
  if (n < 8) return r;
  const keep = new Uint8Array(n);
  keep[0] = keep[n >> 1] = 1;
  const st = [
    [0, n >> 1],
    [n >> 1, n],
  ];
  while (st.length) {
    const [a, b] = st.pop(),
      A = r[a],
      B = r[b % n],
      dx = B[0] - A[0],
      dz = B[1] - A[1],
      L = Math.hypot(dx, dz) || 1e-9;
    let im = -1,
      dm = e;
    for (let i = a + 1; i < b; i++) {
      const dd = Math.abs((r[i][0] - A[0]) * dz - (r[i][1] - A[1]) * dx) / L;
      if (dd > dm) {
        dm = dd;
        im = i;
      }
    }
    if (im >= 0) {
      keep[im] = 1;
      st.push([a, im], [im, b]);
    }
  }
  return r.filter((_, i) => keep[i]);
}
/**
 * Straßenfläche aus den Achsen: { ringe: [{ o, h }], F: Abstand zum Rand (m, > 0 innen) je Zelle, N, c }. Raster c ≥ 0,25 m.
 * Schließen: Band um r verbreitert zeichnen, Abstand zum Außenraum messen, Rand bei Abstand = r.
 */
function strFlaechen(roads, G, r) {
  const N = Math.min(4096, Math.ceil(G / 0.25)),
    c = G / N,
    cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const x = cv.getContext('2d', { willReadFrequently: true }),
    X = (v) => (v + G / 2) / c;
  x.fillStyle = '#000';
  x.fillRect(0, 0, N, N);
  x.strokeStyle = '#fff';
  x.lineCap = x.lineJoin = 'round';
  for (const { l, w } of roads) {
    if (!l || l.length < 2) continue;
    x.lineWidth = (w + 2 * r) / c;
    x.beginPath();
    l.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
    x.stroke();
  }
  const px = x.getImageData(0, 0, N, N).data,
    innen = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) innen[i] = px[i * 4] >= 128 ? 1 : 0;
  cv.width = cv.height = 1;
  const D = strEdt(innen, N),
    // Abstand zum Rand der geschlossenen Fläche (m), > 0 innen
    F = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) F[i] = D[i] * c - r;
  return { ringe: strUmriss(F, N, c, G), F, N, c };
}
/** Umriss der Fläche F > 0 (Zellmitten) als Ringe mit Löchern: [{ o, h }]. */
function strUmriss(F, N, c, G) {
  const val = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? -1 : F[j * N + i]),
    W = N + 2,
    OFF = W * W,
    hId = (i, j) => (j + 1) * W + (i + 1),
    vId = (i, j) => OFF + (j + 1) * W + (i + 1),
    P = new Map(),
    segA = [],
    segB = [],
    pos = (i, j) => [-G / 2 + (i + 0.5) * c, -G / 2 + (j + 0.5) * c],
    punkt = (id, i0, j0, i1, j1) => {
      if (P.has(id)) return id;
      const a = val(i0, j0),
        b = val(i1, j1),
        t = a / (a - b),
        A = pos(i0, j0),
        B = pos(i1, j1);
      P.set(id, [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      return id;
    };
  for (let j = -1; j < N; j++)
    for (let i = -1; i < N; i++) {
      const v0 = val(i, j),
        v1 = val(i + 1, j),
        v2 = val(i + 1, j + 1),
        v3 = val(i, j + 1),
        k = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
      if (k === 0 || k === 15) continue;
      const e = [
          () => punkt(hId(i, j), i, j, i + 1, j),
          () => punkt(vId(i + 1, j), i + 1, j, i + 1, j + 1),
          () => punkt(hId(i, j + 1), i, j + 1, i + 1, j + 1),
          () => punkt(vId(i, j), i, j, i, j + 1),
        ],
        seg = (a, b) => {
          segA.push(e[a]());
          segB.push(e[b]());
        },
        m = (v0 + v1 + v2 + v3) / 4;
      if (k === 5) {
        if (m > 0) {
          seg(0, 1);
          seg(2, 3);
        } else {
          seg(3, 0);
          seg(1, 2);
        }
        continue;
      }
      if (k === 10) {
        if (m > 0) {
          seg(3, 0);
          seg(1, 2);
        } else {
          seg(0, 1);
          seg(2, 3);
        }
        continue;
      }
      const s = [];
      if (v0 > 0 !== v1 > 0) s.push(0);
      if (v1 > 0 !== v2 > 0) s.push(1);
      if (v2 > 0 !== v3 > 0) s.push(2);
      if (v3 > 0 !== v0 > 0) s.push(3);
      if (s.length === 2) seg(s[0], s[1]);
    }
  // Segmente zu Ringen verbinden
  const an = new Map();
  const merk = (id, s) => {
    const l = an.get(id);
    if (l) l.push(s);
    else an.set(id, [s]);
  };
  for (let s = 0; s < segA.length; s++) {
    merk(segA[s], s);
    merk(segB[s], s);
  }
  const fertig = new Uint8Array(segA.length),
    ringe = [];
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (fertig[s0]) continue;
    const r = [];
    let s = s0,
      id = segA[s0];
    while (s >= 0 && !fertig[s]) {
      fertig[s] = 1;
      r.push(P.get(id));
      id = segA[s] === id ? segB[s] : segA[s];
      s = (an.get(id) || []).find((q) => !fertig[q]);
      if (s == null) s = -1;
    }
    if (r.length >= 4) ringe.push(strVereinfachen(r, 0.03));
  }
  // Verschachtelung: Außenringe und Löcher (Tiefe gerade = außen)
  const R = ringe
    .map((r) => {
      let a = 0,
        x0 = 1e9,
        x1 = -1e9,
        z0 = 1e9,
        z1 = -1e9;
      r.forEach((p, i) => {
        const q = r[(i + 1) % r.length];
        a += p[0] * q[1] - q[0] * p[1];
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        z0 = Math.min(z0, p[1]);
        z1 = Math.max(z1, p[1]);
      });
      return { r, a: Math.abs(a) / 2, bb: [x0, x1, z0, z1], h: [], eltern: null };
    })
    .filter((o) => o.a > 0.5)
    .sort((a, b) => b.a - a.a);
  R.forEach((o, k) => {
    const p = o.r[0];
    for (let q = k - 1; q >= 0; q--) {
      const u = R[q];
      if (p[0] < u.bb[0] || p[0] > u.bb[1] || p[1] < u.bb[2] || p[1] > u.bb[3]) continue;
      if (inP(p, u.r)) {
        o.eltern = u;
        break;
      }
    }
    let t = 0;
    for (let u = o.eltern; u; u = u.eltern) t++;
    o.tiefe = t;
  });
  const out = [];
  R.forEach((o) => {
    if (o.tiefe % 2 === 0) {
      o.P = { o: o.r, h: [] };
      out.push(o.P);
    } else if (o.eltern && o.eltern.P) o.eltern.P.h.push(o.r);
  });
  return out;
}
/** Geländeshader: Loch, wo die Straßenmaske innen ist, außer unter Brücken (auch in den Hilfsdurchgängen von Realistisch+). */
function strGelaendeShader(m) {
  if (!m || m.userData.strShader) return;
  m.userData.strShader = 1;
  // vorhandene Erweiterungen (Baumscheiben im Gelände, pitPatch) bleiben erhalten
  const vor = m.onBeforeCompile !== T.Material.prototype.onBeforeCompile ? m.onBeforeCompile : null,
    vorKey = vor && m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  if (!STR.uM.value) {
    STR.uM.value = new T.DataTexture(new Uint8Array([0, 0]), 1, 1, T.RGFormat);
    STR.uM.value.needsUpdate = true;
  }
  m.onBeforeCompile = (sh, r) => {
    if (vor) vor(sh, r);
    sh.uniforms.uStrM = STR.uM;
    sh.uniforms.uStrG = STR.uG;
    sh.vertexShader =
      'varying vec2 vStrW;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStrW = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    sh.fragmentShader =
      'uniform sampler2D uStrM;\nuniform float uStrG;\nvarying vec2 vStrW;\n' +
      sh.fragmentShader.replace(
        'void main() {',
        'void main() {\n  vec4 strM = texture2D(uStrM, vStrW / uStrG + 0.5);\n  if (strM.r > 0.502 && strM.g < 0.5) discard;',
      );
  };
  m.customProgramCacheKey = () => 'strGelaende' + vorKey;
  m.needsUpdate = true;
}
/** Nach dem Zeichnen der Kartenebenen (ctxPaint): Straßenfläche bauen bzw. nur umfärben. */
function strAktualisieren(acc) {
  const roads = (acc && acc.line && acc.line.roads) || [];
  if (!roads.length || !GEO.size || !S.terr) {
    strWeg();
    return;
  }
  const sig = roads.length + ':' + GEO.size + ':' + (GEO.e0 || 0) + ':' + STR.r + ':' + STR.tief;
  if (sig === STR.sig) {
    strFarbe();
    return;
  }
  STR.sig = sig;
  clearTimeout(STR.T);
  STR.T = setTimeout(() => {
    try {
      gst('Straßenflächen werden angelegt …');
      strBauen(roads);
      gst('Straßenflächen angelegt.');
    } catch (e) {
      logErr(e, 'strAktualisieren');
    }
  }, 50);
}
function strWeg() {
  G.roads.children.slice().forEach((o) => {
    if (!o.userData.str) return;
    G.roads.remove(o);
    o.geometry.dispose();
  });
  STR.aktiv = false;
  STR.ringe = [];
  STR.sig = '';
}
function strFarbe() {
  if (!STR.mat) return;
  STR.mat.color.set(S.lc.roads || '#a8a8a8');
  STR.matK.color.set(shade(S.lc.roads || '#a8a8a8', 0.82));
}
/** Höhe aus dem Oberflächenmodell (DOM, mit Brücken) an (x, z) in maad-Höhen, sonst null. */
function strDomH(x, z) {
  const D = GEO.dmFull;
  if (!D || D.fail || !D.data || !D.res) return null;
  const [E, N] = ll2utm(GEO.lon + x / GEO.kx, GEO.lat - z / 110574, D.zone || 32),
    i = Math.floor((E - D.minx) / D.res),
    j = Math.floor((D.maxy - N) / (D.resY || D.res));
  if (i < 0 || j < 0 || i >= D.w || j >= D.h) return null;
  const h = D.data[j * D.w + i];
  return h > -400 && h < 4500 ? h - (GEO.e0 || 0) : null;
}
/**
 * Brücken: jede Straßenachse alle 1 m abtasten; Abschnitte über Wasser (Wasserebene des Kartenbilds) bekommen die
 * Höhe linear zwischen den Ufern statt der Geländehöhe (das Geländemodell enthält keine Brücken, die Straße fiele
 * sonst auf das Flussniveau). { proben: Raster 8 m → [{x, z, h}], linien: [{ l, w }], nass(x, z) }
 */
function strBruecken(roads, G) {
  const W = 1024,
    cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const x = cv.getContext('2d', { willReadFrequently: true });
  if (PL.water) x.drawImage(PL.water, 0, 0, W, W);
  const px = x.getImageData(0, 0, W, W).data,
    nass = (a, b) => {
      const i = Math.floor(((a + G / 2) / G) * W),
        j = Math.floor(((b + G / 2) / G) * W);
      return i >= 0 && j >= 0 && i < W && j < W && px[(j * W + i) * 4 + 3] > 100;
    },
    proben = new Map(),
    linien = [],
    zelle = (a, b) => Math.floor(a / 8) + ':' + Math.floor(b / 8);
  for (const { l, w } of roads) {
    if (!l || l.length < 2) continue;
    const P = [];
    for (let k = 0; k + 1 < l.length; k++) {
      const A = l[k],
        B = l[k + 1],
        L = Math.hypot(B[0] - A[0], B[1] - A[1]),
        n = Math.max(1, Math.ceil(L));
      for (let q = 0; q < n; q++) {
        const t = q / n,
          a = A[0] + (B[0] - A[0]) * t,
          b = A[1] + (B[1] - A[1]) * t;
        P.push({ x: a, z: b, h: gh(a, b), n: nass(a, b) });
      }
    }
    const E = l[l.length - 1];
    P.push({ x: E[0], z: E[1], h: gh(E[0], E[1]), n: nass(E[0], E[1]) });
    for (let k = 0; k < P.length; k++) {
      if (!P[k].n) continue;
      let e = k;
      while (e + 1 < P.length && P[e + 1].n) e++;
      // Höhe am Ufer STR.ufer m hinter der Uferkante abnehmen (an der Kante liegt meist eine Böschung, die Straße
      // tiefer); bis dorthin läuft die Fahrbahn schon auf Brückenhöhe
      const ia = k > 0 ? Math.max(0, k - 1 - STR.ufer) : -1,
        ib = e + 1 < P.length ? Math.min(P.length - 1, e + 1 + STR.ufer) : -1,
        a = ia >= 0 ? P[ia] : null,
        b = ib >= 0 ? P[ib] : null;
      // ganz im Wasser (Fähre, Kartenfehler) oder sehr lang: nicht überbrücken
      if ((a || b) && e - k < 400) {
        const ha = a ? a.h : b.h,
          hb = b ? b.h : a.h,
          q0 = a ? ia + 1 : k,
          q1 = b ? ib - 1 : e;
        // Brückenhöhe aus dem Oberflächenmodell (DOM, enthält die Brücke): Median einiger Punkte über dem Wasser,
        // höchstens 2,5 m über dem höheren Ufer (Bäume), nie unter der Linie zwischen den Ufern
        const dh = [];
        for (let q = k; q <= e; q += 2) {
          const h = strDomH(P[q].x, P[q].z);
          if (h != null) dh.push(h);
        }
        dh.sort((x1, x2) => x1 - x2);
        const hd = dh.length ? Math.min(Math.max(ha, hb) + 2.5, dh[dh.length >> 1]) : -1e9;
        for (let q = q0; q <= q1; q++) {
          const t = (q - q0 + 1) / (q1 - q0 + 2);
          P[q].h = Math.max(ha + (hb - ha) * t, hd);
          const z = zelle(P[q].x, P[q].z);
          if (!proben.has(z)) proben.set(z, []);
          proben.get(z).push(P[q]);
        }
        linien.push({ l: P.slice(Math.max(0, q0 - 1), q1 + 2).map((p) => [p.x, p.z]), w });
      }
      k = e;
    }
  }
  return { proben, linien, nass };
}
/** Brückenhöhe an (x, z): nächste Probe über Wasser (bis 12 m), sonst null. */
function strBrueckeH(B, a, b) {
  const i0 = Math.floor(a / 8),
    j0 = Math.floor(b / 8);
  let best = null,
    dm = 144;
  for (let i = i0 - 1; i <= i0 + 1; i++)
    for (let j = j0 - 1; j <= j0 + 1; j++)
      for (const p of B.proben.get(i + ':' + j) || []) {
        const d = (p.x - a) ** 2 + (p.z - b) ** 2;
        if (d < dm) {
          dm = d;
          best = p;
        }
      }
  return best ? best.h : null;
}
function strBauen(roads) {
  strWeg();
  const G0 = GEO.size,
    R = strFlaechen(roads, G0, STR.r),
    t = STR.tief,
    B = strBruecken(roads, G0),
    N = R.N,
    c = R.c;
  STR.ringe = R.ringe;
  // Brückenbereich im Raster der Maske
  const bc = document.createElement('canvas');
  bc.width = bc.height = N;
  const bx = bc.getContext('2d', { willReadFrequently: true });
  bx.strokeStyle = '#fff';
  bx.lineCap = bx.lineJoin = 'round';
  for (const { l, w } of B.linien) {
    bx.lineWidth = (w + 2 * STR.r + 2) / c;
    bx.beginPath();
    l.forEach(([a, b], i) =>
      i ? bx.lineTo((a + G0 / 2) / c, (b + G0 / 2) / c) : bx.moveTo((a + G0 / 2) / c, (b + G0 / 2) / c),
    );
    bx.stroke();
  }
  const bp = B.linien.length ? bx.getImageData(0, 0, N, N).data : null;
  bc.width = bc.height = 1;
  const brueckeBei = (a, b) => {
    if (!bp) return false;
    const i = Math.floor((a + G0 / 2) / c),
      j = Math.floor((b + G0 / 2) / c);
    return i >= 0 && j >= 0 && i < N && j < N && bp[(j * N + i) * 4 + 3] > 128;
  };
  // Maske fürs Gelände und die Straßenfläche: R = Abstand zum Rand, G = Brücke
  const mk2 = new Uint8Array(N * N * 2);
  for (let k = 0; k < N * N; k++) {
    mk2[2 * k] = Math.max(0, Math.min(255, Math.round(128 + R.F[k] * 100)));
    // Gelände bleibt nur unter der Brücke über dem Wasser; am Ufer wird es wie sonst ausgeschnitten
    mk2[2 * k + 1] =
      bp &&
      bp[k * 4 + 3] > 128 &&
      B.nass(-G0 / 2 + ((k % N) + 0.5) * c, -G0 / 2 + (Math.floor(k / N) + 0.5) * c)
        ? 255
        : 0;
  }
  if (STR.uM.value) STR.uM.value.dispose();
  const tx = new T.DataTexture(mk2, N, N, T.RGFormat);
  tx.magFilter = tx.minFilter = T.LinearFilter;
  tx.needsUpdate = true;
  STR.uM.value = tx;
  STR.uG.value = G0;
  strGelaendeShader(S.terr.material);
  if (!STR.mat) {
    // Straßenfläche: Geländenetz, nur innerhalb des Straßenumrisses gezeichnet (Rand scharf aus dem Abstandsfeld)
    STR.mat = new T.MeshLambertMaterial({ side: T.DoubleSide });
    STR.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uStrM = STR.uM;
      sh.uniforms.uStrG = STR.uG;
      sh.vertexShader =
        'varying vec2 vStrW;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvStrW = (modelMatrix * vec4(transformed, 1.0)).xz;',
        );
      sh.fragmentShader =
        'uniform sampler2D uStrM;\nuniform float uStrG;\nvarying vec2 vStrW;\n' +
        sh.fragmentShader.replace(
          'void main() {',
          'void main() {\n  if (texture2D(uStrM, vStrW / uStrG + 0.5).r <= 0.502) discard;',
        );
    };
    STR.mat.customProgramCacheKey = () => 'strFlaeche';
    STR.matK = new T.MeshLambertMaterial({ side: T.DoubleSide });
  }
  strFarbe();
  const mk = (ge, m) => {
    const o = new T.Mesh(ge, m);
    o.receiveShadow = true;
    o.userData.str = 1;
    o.raycast = () => {};
    G.roads.add(o);
    return o;
  };
  // Fläche: 15 cm unter dem Gelände; über Wasser auf Brückenhöhe
  {
    const ge = new T.PlaneGeometry(G0, G0, GEO.N, GEO.N);
    ge.rotateX(-Math.PI / 2);
    const p = ge.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i),
        b = p.getZ(i),
        hb = brueckeBei(a, b) ? strBrueckeH(B, a, b) : null;
      p.setY(i, (hb != null ? hb : gh(a, b)) - t);
    }
    ge.computeVertexNormals();
    mk(ge, STR.mat);
  }
  // Bordstein entlang des Umrisses (alle ≤ 1 m), an Brücken die Stirnseite der Fahrbahnplatte
  const kan = [];
  R.ringe.forEach((P) =>
    [P.o].concat(P.h).forEach((r) =>
      r.forEach((p, i) => {
        const q = r[(i + 1) % r.length],
          L = Math.hypot(q[0] - p[0], q[1] - p[1]),
          n = Math.max(1, Math.ceil(L));
        for (let k = 0; k < n; k++) {
          const A = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n],
            C = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n],
            hbA = brueckeBei(A[0], A[1]) ? strBrueckeH(B, A[0], A[1]) : null,
            hbC = brueckeBei(C[0], C[1]) ? strBrueckeH(B, C[0], C[1]) : null,
            br = hbA != null && hbC != null,
            ya = hbA != null ? hbA : gh(A[0], A[1]),
            yc = hbC != null ? hbC : gh(C[0], C[1]),
            // Bordstein: Straße bis Gelände; Brücke: Plattenstirn 0,8 m unter der Fahrbahn
            u0 = br ? -t - 0.8 : -t,
            u1 = br ? -t : 0.02;
          kan.push(A[0], ya + u0, A[1], C[0], yc + u0, C[1], C[0], yc + u1, C[1]);
          kan.push(A[0], ya + u0, A[1], C[0], yc + u1, C[1], A[0], ya + u1, A[1]);
        }
      }),
    ),
  );
  if (kan.length) {
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(kan), 3));
    ge.computeVertexNormals();
    mk(ge, STR.matK);
  }
  STR.aktiv = true;
  // Kartenbild ohne Straßen (die Fläche liegt jetzt als Vektor im Gelände)
  try {
    recomp();
  } catch (e) {
    logErr(e, 'strBauen');
  }
}
