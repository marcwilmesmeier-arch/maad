// ======================= STRASSENFLÄCHEN ALS VEKTORFLÄCHE =======================
// Straßen (OSM-Achsen mit Breite, GEO.acc.line.roads) werden nicht mehr ins Kartenbild gemalt (unscharf aus der Nähe),
// sondern als eigene Fläche 15 cm unter dem Gelände angelegt, mit senkrechter Kante („Bordstein“) zum Gelände; das
// Gelände bekommt dort ein Loch (Maske im Geländeshader). Einmündungen werden mit einem Standardradius ausgerundet:
// morphologisches Schließen (Straßenband um r verbreitern, dann um r verschmälern) über ein Distanzfeld, Umriss als
// Vektor (Marching Squares mit Interpolation, vereinfacht). Farbe: Layer-Farbe der Straßen (S.lc.roads).

const STR = {
  ufer: 3, // Brücken: Höhe so weit hinter der Uferkante abnehmen (Böschung, m)
  uG: { value: 1 }, // Kantenlänge des Geländes (m)
  T: 0,
  // Ebenen: Straßen (15 cm tief, Einmündungen 4 m ausgerundet) und Fuß-/Radwege (5 cm, 1,5 m); Maske je Ebene:
  // R = 128 + 100 · Abstand zum Rand (m), > 128 = innen; G > 128 = Brücke über Wasser (dort bleibt das Gelände)
  E: {
    roads: {
      lc: 'roads',
      grp: 'roads',
      tief: 0.15,
      r: 4,
      uM: { value: null },
      sig: '',
      aktiv: false,
      ringe: [],
    },
    paths: {
      lc: 'paths',
      grp: 'paths',
      tief: 0.05,
      r: 1.5,
      uM: { value: null },
      sig: '',
      aktiv: false,
      ringe: [],
    },
  },
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
/** Feld F (N × N) mit gleitendem Mittel (Radius r Zellen) glätten, getrennt nach Zeilen und Spalten. */
function strGlaetten(F, N, r) {
  const t = new Float32Array(N),
    n = 2 * r + 1;
  for (let y = 0; y < N; y++) {
    const o = y * N;
    let s = 0;
    for (let x = -r; x <= r; x++) s += F[o + Math.min(N - 1, Math.max(0, x))];
    for (let x = 0; x < N; x++) {
      t[x] = s / n;
      s += F[o + Math.min(N - 1, x + r + 1)] - F[o + Math.max(0, x - r)];
    }
    F.set(t, o);
  }
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += F[Math.min(N - 1, Math.max(0, y)) * N + x];
    for (let y = 0; y < N; y++) {
      t[y] = s / n;
      s += F[Math.min(N - 1, y + r + 1) * N + x] - F[Math.max(0, y - r) * N + x];
    }
    for (let y = 0; y < N; y++) F[y * N + x] = t[y];
  }
}
/**
 * Exaktes Abstandsfeld der Achsen (m, > 0 innen): je Zelle das größte w/2 − Abstand zur Achse, nur im Band bis 1 m
 * außerhalb des Randes (sonst −1e9). Je Segment nur die Zellen seiner Kapsel (Zeile für Zeile).
 */
function strExakt(roads, N, c, G) {
  const Fx = new Float32Array(N * N).fill(-1e9),
    h0 = G / 2;
  for (const { l, w } of roads) {
    if (!l || l.length < 2) continue;
    const hw = w / 2,
      R = hw + 1;
    for (let k = 0; k + 1 < l.length; k++) {
      const ax = l[k][0],
        az = l[k][1],
        bx = l[k + 1][0],
        bz = l[k + 1][1],
        dx = bx - ax,
        dz = bz - az,
        L2 = dx * dx + dz * dz || 1e-12,
        j0 = Math.max(0, Math.floor((Math.min(az, bz) - R + h0) / c)),
        j1 = Math.min(N - 1, Math.ceil((Math.max(az, bz) + R + h0) / c)),
        i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R + h0) / c)),
        i1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + R + h0) / c)),
        L = Math.sqrt(L2),
        // Zeilenweise: x-Bereich der Kapsel über die Senkrechte zur Achse eingrenzen
        nx = -dz / L,
        nz = dx / L;
      for (let j = j0; j <= j1; j++) {
        const z = -h0 + (j + 0.5) * c;
        let xa = -h0 + (i0 + 0.5) * c,
          xb = -h0 + (i1 + 0.5) * c;
        if (Math.abs(nx) > 0.2) {
          // Band |n·(p − a)| ≤ R → x-Intervall, erweitert um die Endkappen (Bounding der Kapsel)
          const m = (nx * ax + nz * az - nz * z) / nx,
            hb = R / Math.abs(nx);
          xa = Math.max(xa, m - hb);
          xb = Math.min(xb, m + hb);
        }
        const ia = Math.max(i0, Math.floor((xa + h0) / c)),
          ib = Math.min(i1, Math.ceil((xb + h0) / c)),
          o = j * N;
        for (let i = ia; i <= ib; i++) {
          const x = -h0 + (i + 0.5) * c,
            t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)),
            ex = ax + dx * t - x,
            ez = az + dz * t - z,
            v = hw - Math.sqrt(ex * ex + ez * ez);
          if (v > Fx[o + i]) Fx[o + i] = v;
        }
      }
    }
  }
  return Fx;
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
function strFlaechen(roads, G, r, fills) {
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
  // Flächen (z. B. Fußgängerbereiche): gefüllt und um r verbreitert
  x.fillStyle = '#fff';
  x.lineWidth = (2 * r) / c;
  for (const rings of fills || []) {
    x.beginPath();
    for (const ring of rings) {
      ring.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
      x.closePath();
    }
    x.fill('evenodd');
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
  // Treppenstufen des Rasters glätten: zweimal Mittelwert über 5 × 5 Zellen (≈ ±0,5 m)
  strGlaetten(F, N, 2);
  strGlaetten(F, N, 2);
  // Gerade Ränder exakt: Abstand zur Achse minus halbe Breite; das Raster bleibt nur dort, wo das Schließen die
  // Fläche erweitert (Ausrundungen an Einmündungen) – sanft übergeblendet
  const Fx = strExakt(roads, N, c, G);
  for (let i = 0; i < N * N; i++) {
    const d = F[i] - Fx[i],
      t = Math.max(0, Math.min(1, (d - 0.12) / 0.25));
    F[i] = Fx[i] + d * t * t * (3 - 2 * t);
  }
  strOhneGrundstueck(F, N, c, G);
  return { ringe: strUmriss(F, N, c, G), F, N, c };
}
/** Grundstücke (als Grundstück gewählte Flurstücke) im Grundriss: [Ring]. */
function strGrundstuecke() {
  return (typeof P !== 'undefined' ? P : [])
    .filter((q) => q.site && q.poly && q.poly.length > 2)
    .map((q) => q.poly);
}
/**
 * Auf dem Grundstück keine Straßen und Wege: dort ist F „außen“ (Abstand ins Grundstück hinein, negativ) – keine
 * Fläche, keine Absenkung im Gelände; am Grundstücksrand endet die Fläche gerade.
 */
function strOhneGrundstueck(F, N, c, G) {
  const S2 = strGrundstuecke();
  if (!S2.length) return;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const x = cv.getContext('2d', { willReadFrequently: true }),
    X = (v) => (v + G / 2) / c;
  x.fillStyle = '#fff';
  S2.forEach((r) => {
    x.beginPath();
    r.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
    x.closePath();
    x.fill();
  });
  const px = x.getImageData(0, 0, N, N).data,
    innen = new Uint8Array(N * N);
  let n = 0;
  for (let i = 0; i < N * N; i++) if ((innen[i] = px[i * 4] >= 128 ? 1 : 0)) n++;
  cv.width = cv.height = 1;
  if (!n) return;
  const D = strEdt(innen, N);
  for (let i = 0; i < N * N; i++) if (innen[i]) F[i] = Math.min(F[i], c * 0.5 - D[i] * c);
}
/** Kennung der Grundstücke (Neuaufbau der Flächen, wenn sich das Grundstück ändert). */
function strGrundstueckSig() {
  return strGrundstuecke()
    .map((r) => r.length + ':' + r.reduce((s, p) => s + p[0] * 1.3 + p[1] * 0.7, 0).toFixed(1))
    .join(',');
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
/** Leere Maske (1 × 1) als Platzhalter, bis die Ebene gebaut ist. */
function strLeer() {
  const t = new T.DataTexture(new Uint8Array([0, 0]), 1, 1, T.RGFormat);
  t.needsUpdate = true;
  return t;
}
/**
 * Geländeshader: Loch, wo eine Straßen- oder Wegmaske innen ist, außer unter Brücken über Wasser (auch in den
 * Hilfsdurchgängen von Realistisch+).
 */
function strGelaendeShader(m) {
  if (!m || m.userData.strShader) return;
  m.userData.strShader = 1;
  // vorhandene Erweiterungen (Baumscheiben im Gelände, pitPatch) bleiben erhalten
  const vor = m.onBeforeCompile !== T.Material.prototype.onBeforeCompile ? m.onBeforeCompile : null,
    vorKey = vor && m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  for (const E of Object.values(STR.E)) if (!E.uM.value) E.uM.value = strLeer();
  m.onBeforeCompile = (sh, r) => {
    if (vor) vor(sh, r);
    sh.uniforms.uStrM = STR.E.roads.uM;
    sh.uniforms.uStrP = STR.E.paths.uM;
    sh.uniforms.uStrG = STR.uG;
    sh.vertexShader =
      'varying vec2 vStrW;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStrW = (modelMatrix * vec4(transformed, 1.0)).xz;',
      );
    sh.fragmentShader =
      'uniform sampler2D uStrM, uStrP;\nuniform float uStrG;\nvarying vec2 vStrW;\n' +
      sh.fragmentShader.replace(
        'void main() {',
        'void main() {\n  vec2 strU = vStrW / uStrG + 0.5;\n  vec4 strM = texture2D(uStrM, strU), strP = texture2D(uStrP, strU);\n' +
          '  if ((strM.r > 0.502 && strM.g < 0.5) || (strP.r > 0.502 && strP.g < 0.5)) discard;',
      );
  };
  m.customProgramCacheKey = () => 'strGelaende2' + vorKey;
  m.needsUpdate = true;
}
/** Nach dem Zeichnen der Kartenebenen (ctxPaint): Straßen- und Wegflächen bauen bzw. nur umfärben. */
function strAktualisieren(acc) {
  const L = (acc && acc.line) || {},
    quellen = {
      roads: { lines: L.roads || [], fills: [] },
      paths: {
        lines: (L.paths || []).concat(L.cycle || []),
        fills: (acc && acc.fill && acc.fill.paths) || [],
      },
    },
    neu = [];
  for (const k in STR.E) {
    const E = STR.E[k],
      q = quellen[k];
    if (!GEO.size || !S.terr || (!q.lines.length && !q.fills.length)) {
      strWeg(E);
      continue;
    }
    const sig =
      q.lines.length +
      ':' +
      q.fills.length +
      ':' +
      GEO.size +
      ':' +
      (GEO.e0 || 0) +
      ':' +
      E.r +
      ':' +
      E.tief +
      '|' +
      strGrundstueckSig();
    if (sig === E.sig) strFarbe(E);
    else {
      E.sig = sig;
      neu.push([E, q]);
    }
  }
  if (!neu.length) return;
  clearTimeout(STR.T);
  STR.T = setTimeout(() => {
    try {
      gst('Straßen- und Wegflächen werden angelegt …');
      neu.forEach(([E, q]) => strBauen(E, q.lines, q.fills));
      gst('Straßen- und Wegflächen angelegt.');
      // ── Erweiterung aus 02-geodaten/110-fahrbahnmarkierungen.js: Markierungen auf den neuen Flächen
      fbmAktualisieren();
      // ── Erweiterung aus 02-geodaten/120-gleise.js: Gleise auf Bahnbrücken brauchen die Brückenhöhen
      glsAktualisieren(GEO.acc);
      recomp();
    } catch (e) {
      logErr(e, 'strAktualisieren');
    }
  }, 50);
}
/** Ebene entfernen (alle Ebenen ohne E). */
function strWeg(E) {
  if (!E) {
    Object.values(STR.E).forEach((x) => strWeg(x));
    return;
  }
  const g = G[E.grp];
  g.children.slice().forEach((o) => {
    if (!o.userData.str) return;
    g.remove(o);
    o.geometry.dispose();
  });
  E.aktiv = false;
  E.ringe = [];
  E.sig = '';
}
function strFarbe(E) {
  if (!E.mat) return;
  const f = S.lc[E.lc] || '#a8a8a8';
  E.mat.color.set(f);
  E.matK.color.set(shade(f, 0.82));
  // Brückenfahrbahn wie die Straße, Brüstung und Tragwerk in Geländefarbe
  if (E.matB) E.matB.color.set(f);
  if (E.matBW) E.matBW.color.set(S.lc.terrain || '#d4d2cc');
  if (E.matR) E.matR.color.set(S.lc.rail || '#9a9893');
}
/** Höhe aus dem Oberflächenmodell (DOM, mit Brücken) am Bildpunkt (x, z) in maad-Höhen (wie das Gelände: − e0). */
function strDomAbs(x, z) {
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
          const h = strDomAbs(P[q].x, P[q].z);
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
/**
 * Brückenachsen vorbereiten: am Ausschnitt (±H) abschneiden und aneinanderstoßende Stücke zu durchgehenden Ketten
 * verbinden (OSM teilt Brücken oft in mehrere Wege; jedes Stück für sich hätte seine Enden mitten auf der Brücke).
 */
function strBrueckenKetten(L, H) {
  let K = [];
  L.forEach((r) => clipLine(r.l, H).forEach((l) => l.length > 1 && K.push({ l, w: r.w, ly: r.ly || 0 })));
  const nah = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5;
  let neu = true;
  while (neu) {
    neu = false;
    for (let i = 0; i < K.length && !neu; i++)
      for (let k = i + 1; k < K.length && !neu; k++) {
        const A = K[i].l,
          B = K[k].l;
        let m = null;
        if (nah(A[A.length - 1], B[0])) m = A.concat(B.slice(1));
        else if (nah(A[A.length - 1], B[B.length - 1])) m = A.concat(B.slice(0, -1).reverse());
        else if (nah(A[0], B[B.length - 1])) m = B.concat(A.slice(1));
        else if (nah(A[0], B[0])) m = B.slice().reverse().concat(A.slice(1));
        if (m) {
          K[i] = { l: m, w: Math.max(K[i].w, K[k].w), ly: Math.max(K[i].ly, K[k].ly) };
          K.splice(k, 1);
          neu = true;
        }
      }
  }
  return K;
}
/**
 * Brückenachse für den Bau aufbereiten: auf etwa 2 m verdichten (P), Bogenlänge S0, Gelände G0, Fahrbahnhöhe Z
 * (strBrueckeZ), Querrichtung Nn, halbe Breite h2; je Seite (0 = −Nn, 1 = +Nn) Randabstand o und Nachbar nb.
 */
function strBrueckeLinie(l, w, a0, b0) {
  if (!l || l.length < 2) return null;
  const P = [];
  for (let k = 0; k + 1 < l.length; k++) {
    const A = l[k],
      B = l[k + 1],
      n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 2));
    for (let q = 0; q < n; q++) P.push([A[0] + ((B[0] - A[0]) * q) / n, A[1] + ((B[1] - A[1]) * q) / n]);
  }
  P.push(l[l.length - 1].slice());
  const S0 = [0];
  for (let i = 1; i < P.length; i++)
    S0.push(S0[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const G0 = P.map((p) => gh(p[0], p[1])),
    Nn = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)],
        c = P[Math.min(P.length - 1, i + 1)],
        L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      return [-(c[1] - a[1]) / L, (c[0] - a[0]) / L];
    }),
    h2 = w / 2,
    // Anschlusshöhe: Gelände 8 m außerhalb auf der anschließenden Straße – am Brückenende selbst liegt das grobe
    // Gelände oft auf einer Böschung oder Grabenkante zwischen oben und unten
    raus = (i, k) => {
      const d = [P[i][0] - P[k][0], P[i][1] - P[k][1]],
        L = Math.hypot(d[0], d[1]) || 1;
      return gh(P[i][0] + (d[0] / L) * 8, P[i][1] + (d[1] / L) * 8);
    },
    ha = raus(0, 1),
    hb = raus(P.length - 1, P.length - 2);
  const d = {
    P,
    S0,
    G0,
    Nn,
    w,
    h2,
    ha,
    hb,
    Z: strBrueckeZ(P, S0, G0, w, ha, hb),
    o: [P.map(() => h2), P.map(() => h2)],
    nb: [P.map(() => false), P.map(() => false)],
  };
  return strBrueckeGerade(a0 != null ? strBrueckeKuerzen(d, a0, b0) : d);
}
/**
 * Fehlt an einem Ende die Verlängerung (keine anschließende Straße gefunden, kein DOM, Gelände nicht erreicht), läuft
 * das Deck gerade als Rampe weiter (höchstens 10 % Gefälle, 20 bis 60 m) und senkt sich auf das Gelände ab – so
 * endet es nie über der Straße. Erkennt die schon verlängerten
 * Enden daran, dass sie auf dem Gelände liegen.
 */
function strBrueckeGerade(d) {
  if (!d) return d;
  [0, 1].forEach((e) => {
    const n = d.P.length,
      i = e ? n - 1 : 0,
      k = e ? n - 2 : 1;
    if (Math.abs(d.Z[i] - d.G0[i]) < 0.05) return;
    const u = [d.P[i][0] - d.P[k][0], d.P[i][1] - d.P[k][1]],
      L = Math.hypot(u[0], u[1]) || 1,
      z0 = d.Z[i],
      // Rampenlänge: höchstens 10 % Gefälle, 20 bis 60 m
      lg = Math.min(60, Math.max(20, Math.ceil(Math.abs(z0 - d.G0[i]) / 0.1 / 2) * 2)),
      neu = [];
    for (let m = 2; m <= lg; m += 2) neu.push([d.P[i][0] + (u[0] / L) * m, d.P[i][1] + (u[1] / L) * m]);
    const g = neu.map((p) => gh(p[0], p[1])),
      z = neu.map((p, q) => z0 + ((g[neu.length - 1] - z0) * (q + 1)) / neu.length);
    const dazu = (a, v) => (e ? a.push(...v) : a.unshift(...v.slice().reverse()));
    dazu(d.P, neu);
    dazu(d.G0, g);
    dazu(d.Z, z);
    dazu(
      d.Nn,
      neu.map(() => d.Nn[i].slice()),
    );
    [0, 1].forEach((sd) => {
      dazu(
        d.o[sd],
        neu.map(() => d.o[sd][i]),
      );
      dazu(
        d.nb[sd],
        neu.map(() => d.nb[sd][i]),
      );
    });
  });
  d.S0 = [0];
  for (let i = 1; i < d.P.length; i++)
    d.S0.push(d.S0[i - 1] + Math.hypot(d.P[i][0] - d.P[i - 1][0], d.P[i][1] - d.P[i - 1][1]));
  return d;
}
/**
 * Verlängerte Brücke (siehe strBrueckeVerlaengern) zurückschneiden: Mit DOM läuft das Deck in die anschließende Straße
 * hinein, bis es das Gelände erreicht (weniger als 0,3 m darüber) – dort endet es, auf Geländehöhe. Ohne DOM endet es
 * am Brückenende aus OSM (a0 … b0: Bogenlänge des eigentlichen Brückenstücks).
 */
function strBrueckeKuerzen(d, a0, b0) {
  const n = d.P.length,
    mitDom = !!GEO.dmFull;
  let i0 = 0,
    i1 = n - 1;
  while (i0 < n - 1 && d.S0[i0] < a0 - 0.01) i0++;
  while (i1 > 0 && d.S0[i1] > b0 + 0.01) i1--;
  const j0 = i0,
    j1 = i1;
  if (mitDom) {
    while (i0 > 0 && d.Z[i0] - d.G0[i0] > 0.3) i0--;
    while (i1 < n - 1 && d.Z[i1] - d.G0[i1] > 0.3) i1++;
  }
  if (i1 - i0 < 1) return null;
  // Gelände erreicht? Dann genau auf Geländehöhe und noch 20 m weiter in die Straße (sonst baut strBrueckeGerade
  // eine Rampe)
  const da = d.Z[i0] - d.G0[i0] <= 0.3,
    db = d.Z[i1] - d.G0[i1] <= 0.3;
  if (da && i0 < j0) d.Z[i0] = d.G0[i0];
  if (db && i1 > j1) d.Z[i1] = d.G0[i1];
  const k0 = i0,
    k1 = i1;
  while (da && i0 > 0 && d.S0[k0] - d.S0[i0] < 20) i0--;
  while (db && i1 < n - 1 && d.S0[i1] - d.S0[k1] < 20) i1++;
  const senken = (k, i) => {
    const L = Math.abs(d.S0[i] - d.S0[k]) || 1;
    for (let m = Math.min(k, i); m <= Math.max(k, i); m++)
      d.Z[m] = d.Z[k] + ((d.G0[i] - d.Z[k]) * Math.abs(d.S0[m] - d.S0[k])) / L;
  };
  if (i0 < k0) senken(k0, i0);
  if (i1 > k1) senken(k1, i1);
  const sl = (a) => a.slice(i0, i1 + 1);
  ['P', 'G0', 'Nn', 'Z'].forEach((k) => (d[k] = sl(d[k])));
  d.S0 = sl(d.S0).map((s) => s - d.S0[i0]);
  d.o = d.o.map(sl);
  d.nb = d.nb.map(sl);
  return d;
}
/**
 * Brückenachse um die anschließenden Straßen verlängern (je Ende die erste Straße, deren Ende dort liegt, bis 60 m):
 * Das Deck soll in die Straße hineinlaufen, bis es das Gelände erreicht (strBrueckeKuerzen). { l, a0, b0 }
 */
function strBrueckeVerlaengern(l, strassen) {
  const weiter = (p, q) => {
    for (const r of strassen) {
      const L = r.l;
      if (!L || L.length < 2) continue;
      // Stützpunkt der Straße am Brückenende (Anfang, Ende oder durchlaufend)
      const k0 = L.findIndex((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) < 1.5);
      if (k0 < 0) continue;
      const d1 = [p[0] - q[0], p[1] - q[1]],
        // in Fortsetzung der Brücke weiter (nicht zurück über sie): vorwärts oder rückwärts entlang der Straße
        rw = [L.slice(k0), L.slice(0, k0 + 1).reverse()].filter((v) => v.length > 1),
        w = rw.find((v) => d1[0] * (v[1][0] - v[0][0]) + d1[1] * (v[1][1] - v[0][1]) > 0);
      if (!w) continue;
      const R = [];
      let s = 0;
      for (let k = 1; k < w.length && s < 60; k++) {
        const g = Math.hypot(w[k][0] - w[k - 1][0], w[k][1] - w[k - 1][1]);
        if (s + g > 60) {
          const t = (60 - s) / g;
          R.push([w[k - 1][0] + (w[k][0] - w[k - 1][0]) * t, w[k - 1][1] + (w[k][1] - w[k - 1][1]) * t]);
          break;
        }
        R.push(w[k].slice());
        s += g;
      }
      return R;
    }
    return [];
  };
  const vorn = weiter(l[0], l[1]).reverse(),
    hinten = weiter(l[l.length - 1], l[l.length - 2]),
    lang = (L) => L.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) : 0), 0),
    a0 = vorn.length ? lang(vorn.concat([l[0]])) : 0;
  return { l: vorn.concat(l, hinten), a0, b0: a0 + lang(l) };
}
/**
 * Nebeneinanderliegende Brücken (Richtungsfahrbahnen, Geh- und Radwege neben der Straße, auch über Straßen und Wege
 * hinweg) zu einer Fahrbahn verbinden: liegt neben einem Punkt eine Brücke (bis ~40° Winkel) mit höchstens 6 m Lücke,
 * reicht das Deck auf dieser Seite bis 0,8 m in den Nachbarn hinein (nie schmaler als die eigene Fahrbahn – so bleiben
 * auch bei schrägem Verlauf keine Löcher), dort entfällt die Brüstung, und die Fahrbahnhöhe wird mit der des Nachbarn
 * gemittelt. In der Überlappung liegt das schmalere Deck 3 cm tiefer (dz), damit nichts flimmert. Danach: Brüstung nur
 * am freien Rand, keine kurzen Brüstungsreste, keine Stirnplatte an Enden auf einer anderen Brücke (kappe), Brücken
 * fast ganz auf einer anderen entfallen (weg).
 */
function strBrueckenNachbarn(K) {
  const Zn = K.map((A) => A.Z.map((z) => [z])),
    bb = K.map((B) => {
      const xs = B.P.map((p) => p[0]),
        zs = B.P.map((p) => p[1]),
        r = B.h2 + 8;
      return [Math.min(...xs) - r, Math.min(...zs) - r, Math.max(...xs) + r, Math.max(...zs) + r];
    }),
    imBB = (ib, x, z) => x >= bb[ib][0] && x <= bb[ib][2] && z >= bb[ib][1] && z <= bb[ib][3],
    // liegt (x, z) auf dem Deck von B (Abstand zur Achse kleiner als die halbe Breite + r)?
    auf = (B, x, z, r) => B.P.some((q) => Math.hypot(q[0] - x, q[1] - z) < B.h2 + r);
  K.forEach((A) => (A.dz = 0));
  K.forEach((A, ia) =>
    A.P.forEach((p, i) => {
      const u = [A.Nn[i][1], -A.Nn[i][0]];
      K.forEach((B, ib) => {
        // Bahn- und Straßenbrücken sind getrennte Bauwerke
        if (ib === ia || (A.k === 'rail') !== (B.k === 'rail') || !imBB(ib, p[0], p[1])) return;
        let bj = -1,
          bd = 1e9;
        B.P.forEach((q, j) => {
          const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
          if (d < bd) {
            bd = d;
            bj = j;
          }
        });
        const q = B.P[bj],
          v = [q[0] - p[0], q[1] - p[1]],
          d = v[0] * A.Nn[i][0] + v[1] * A.Nn[i][1],
          laengs = v[0] * u[0] + v[1] * u[1],
          cw = Math.abs(A.Nn[i][0] * B.Nn[bj][0] + A.Nn[i][1] * B.Nn[bj][1]);
        if (Math.abs(laengs) > 2.5 + Math.abs(d) * 0.8 || Math.abs(d) > A.h2 + B.h2 + 6) return;
        if (cw < 0.75) return; // über ~40° auseinander
        const sd = d > 0 ? 1 : 0,
          o = Math.max(A.h2, Math.abs(d) - B.h2 / cw + 0.8);
        A.o[sd][i] = A.nb[sd][i] ? Math.max(A.o[sd][i], o) : o;
        A.nb[sd][i] = true;
        Zn[ia][i].push(B.Z[bj]);
        if (A.w < B.w || (A.w === B.w && ia > ib)) A.dz = -0.03;
      });
    }),
  );
  K.forEach((A, ia) => (A.Z = Zn[ia].map((a) => a.reduce((s, z) => s + z, 0) / a.length)));
  K.forEach((A, ia) => {
    const n = A.P.length;
    // fast ganz auf einer anderen (breiteren) Brücke: entfällt
    const drauf = A.P.filter((p) =>
      K.some(
        (B, ib) =>
          ib !== ia &&
          (A.k === 'rail') === (B.k === 'rail') &&
          B.w >= A.w &&
          imBB(ib, p[0], p[1]) &&
          auf(B, p[0], p[1], -0.3),
      ),
    ).length;
    A.weg = drauf >= n * 0.8;
    // Enden auf einer anderen Brücke: keine Stirnplatte
    A.kappe = [0, n - 1].map(
      (i) =>
        !K.some(
          (B, ib) =>
            ib !== ia &&
            (A.k === 'rail') === (B.k === 'rail') &&
            imBB(ib, A.P[i][0], A.P[i][1]) &&
            auf(B, A.P[i][0], A.P[i][1], 0.5),
        ),
    );
    // Brüstung nur am freien Rand: liegt direkt außerhalb des Rands (0,5 m) eine andere Brücke – in beliebigem
    // Winkel, etwa eine abzweigende Rampe oder ein querendes Stück –, entfällt sie dort
    A.P.forEach((p, i) =>
      [0, 1].forEach((sd) => {
        if (A.nb[sd][i]) return;
        const g = (sd ? 1 : -1) * (A.o[sd][i] + 0.5),
          x = p[0] + A.Nn[i][0] * g,
          z = p[1] + A.Nn[i][1] * g;
        A.nb[sd][i] = K.some(
          (B, ib) =>
            ib !== ia && (A.k === 'rail') === (B.k === 'rail') && imBB(ib, x, z) && auf(B, x, z, 0.3),
        );
      }),
    );
    // keine Brüstung, wo das Deck auf dem Gelände liegt (Verlängerung in die Straße)
    A.P.forEach((p, i) =>
      [0, 1].forEach((sd) => {
        if (A.Z[i] - A.G0[i] < 0.5) A.nb[sd][i] = true;
      }),
    );
    // keine kurzen Brüstungsreste (bis 10 m) neben verbundenen Abschnitten
    [0, 1].forEach((sd) => {
      const f = A.nb[sd];
      for (let i = 0; i < n;) {
        if (f[i]) {
          i++;
          continue;
        }
        let j = i;
        while (j < n && !f[j]) j++;
        if ((i > 0 || j < n) && A.S0[j - 1] - A.S0[i] <= 10) for (let k = i; k < j; k++) f[k] = true;
        i = j;
      }
    });
  });
}
/**
 * Brückenenden, die auf einer anderen Brücke liegen (Rampen, Abzweige, Wege, die auf eine Brücke münden), übernehmen
 * deren Fahrbahnhöhe als Anschluss statt des Geländes darunter.
 */
function strBrueckenAuflager(K) {
  K.forEach((A) => {
    let neu = false;
    [0, A.P.length - 1].forEach((i) => {
      const p = A.P[i];
      let best = null,
        bd = 1e9;
      K.forEach((B) => {
        if (
          B === A ||
          (A.k === 'rail') !== (B.k === 'rail') ||
          B.S0[B.S0.length - 1] < A.S0[A.S0.length - 1] * 0.5
        )
          return;
        B.P.forEach((q, j) => {
          const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d < B.h2 + 1.5 && d < bd) {
            bd = d;
            best = B.Z[j];
          }
        });
      });
      if (best == null) return;
      if (i) A.hb = best;
      else A.ha = best;
      neu = true;
    });
    if (neu) A.Z = strBrueckeZ(A.P, A.S0, A.G0, A.w, A.ha, A.hb);
  });
}
/**
 * DOM für Brücken nachladen: Ein aus dem Speicherstand geöffnetes Projekt hat kein DOM (GEO.dmFull), die Brücken
 * fielen auf die Schätzung ohne Messung zurück. Gibt es Brücken im Ausschnitt, wird das DOM im Hintergrund geholt und
 * die Straßen- und Brückenflächen neu gebaut.
 */
async function strBrueckenDomNachladen() {
  const L = (GEO.acc && GEO.acc.line) || {},
    hat = ['roads', 'paths', 'cycle'].some((k) => (L[k] || []).some((r) => r.br));
  if (!hat || GEO.dmFull || !GEO.size) return;
  const ort = [GEO.lon, GEO.lat, GEO.size].join(',');
  try {
    const DM = await dgmLoad(GEO.lon, GEO.lat, GEO.size, 'nw_dom', 'DOM1');
    if (!DM || DM.fail || ort !== [GEO.lon, GEO.lat, GEO.size].join(',') || GEO.dmFull) return;
    GEO.dmFull = DM;
    STR.brD = null;
    Object.values(STR.E).forEach((E) => (E.sig = ''));
    strAktualisieren(GEO.acc);
  } catch (e) {
    logErr(e, 'strBrueckenDomNachladen');
  }
}
/**
 * Alle Brücken des Ausschnitts (Straßen und Wege) mit Höhen und Nachbarn, zwischengespeichert, bis sich Daten oder
 * Gelände ändern. [{ k: 'roads' | 'paths', P, Z, … }]
 */
function strBrueckenAlle() {
  const acc = GEO.acc,
    L = (acc && acc.line) || {},
    quellen = { roads: L.roads || [], paths: (L.paths || []).concat(L.cycle || []), rail: L.rail || [] },
    sig = [
      GEO.size,
      GEO.e0,
      !!GEO.dmFull,
      quellen.roads.length,
      quellen.paths.length,
      quellen.rail.length,
    ].join('|');
  if (STR.brD && STR.brD.acc === acc && STR.brD.sig === sig) return STR.brD.K;
  const K = [],
    strassen = quellen.roads.concat(quellen.paths).filter((r) => !r.br),
    gleise = quellen.rail.filter((r) => !r.br);
  for (const k in quellen)
    strBrueckenKetten(
      quellen[k].filter((r) => r.br),
      GEO.size / 2,
    ).forEach((c) => {
      // verlängert nur mit DOM (ohne Messung ist nicht bekannt, wo das Deck das Gelände erreicht)
      // (Bahnbrücken entlang der anschließenden Gleise)
      const v = GEO.dmFull ? strBrueckeVerlaengern(c.l, k === 'rail' ? gleise : strassen) : { l: c.l },
        d = strBrueckeLinie(v.l, c.w, v.a0, v.b0);
      if (d) K.push(Object.assign(d, { k }));
    });
  strBrueckenAuflager(K);
  strBrueckenNachbarn(K);
  STR.brD = { acc, sig, K };
  return K;
}
/** Stärke der Fahrbahnplatte einer Brücke (m), Höhe der Brüstung (m), Abstand der Pfeiler (m). */
const STR_BR = { platte: 1, bruestung: 1, pfeiler: 25, pfeilerAb: 3.5 };
/**
 * Brückenbauwerke aus gekennzeichneten Achsen (OSM brunnel=bridge), Vorbild Planimetric: Fahrbahndeck in Straßen-
 * bzw. Wegfarbe, Plattenstirn (1 m) und Unterseite, Brüstung 1 m hoch (0,25 m stark, außen an der Fahrbahn; nicht
 * zwischen verbundenen Nachbarbrücken), Pfeiler etwa alle 25 m, wo die Brücke mehr als 3,5 m über dem Gelände liegt.
 * Höhe aus strBrueckeZ, Nachbarn aus strBrueckenNachbarn; gebaut werden die Brücken der Ebene E.
 */
function strBrueckenBau(E, mk) {
  const k = Object.keys(STR.E).find((q) => STR.E[q] === E),
    // die Straßenebene baut auch die Bahnbrücken (Gleise haben keine eigene Flächenebene)
    bruecken = strBrueckenAlle().filter((d) => d.k === k || (k === 'roads' && d.k === 'rail'));
  if (!bruecken.length) return;
  if (!E.matB) {
    E.matB = new T.MeshLambertMaterial({ side: T.DoubleSide });
    E.matBW = new T.MeshLambertMaterial({ side: T.DoubleSide });
    E.matR = new T.MeshLambertMaterial({ side: T.DoubleSide });
  }
  strFarbe(E);
  const t = E.tief,
    oben = [],
    obenR = [],
    bau = [],
    quad = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d),
    pl = STR_BR.platte,
    br = STR_BR.bruestung,
    bw = 0.25;
  bruecken.forEach(({ P, S0, Nn, Z, o, nb, w, dz, weg, kappe, k: art }) => {
    if (weg) return;
    const deck = art === 'rail' ? obenR : oben;
    const at = (i, x, dy) => [P[i][0] + Nn[i][0] * x, Z[i] - t + (dz || 0) + dy, P[i][1] + Nn[i][1] * x],
      // Randabstände je Seite: Fahrbahnrand und Außenkante (mit Brüstung)
      rand = (i, sd) => (sd ? 1 : -1) * o[sd][i],
      aussen = (i, sd) => (sd ? 1 : -1) * (o[sd][i] + (nb[sd][i] ? 0 : bw));
    let seit = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const j = i + 1;
      // Fahrbahn
      quad(deck, at(i, rand(i, 1), 0), at(j, rand(j, 1), 0), at(j, rand(j, 0), 0), at(i, rand(i, 0), 0));
      // Unterseite der Platte
      quad(
        bau,
        at(i, aussen(i, 0), -pl),
        at(j, aussen(j, 0), -pl),
        at(j, aussen(j, 1), -pl),
        at(i, aussen(i, 1), -pl),
      );
      // Brüstung (außen bis Unterkante Platte, innen ab Fahrbahn) und Abdeckung – nicht zum Nachbarn hin
      for (const sd of [0, 1]) {
        if (nb[sd][i] || nb[sd][j]) continue;
        const ai = rand(i, sd),
          aj = rand(j, sd),
          oi = aussen(i, sd),
          oj = aussen(j, sd);
        quad(bau, at(i, oi, -pl), at(j, oj, -pl), at(j, oj, br), at(i, oi, br));
        quad(bau, at(i, ai, 0), at(j, aj, 0), at(j, aj, br), at(i, ai, br));
        quad(bau, at(i, ai, br), at(j, aj, br), at(j, oj, br), at(i, oi, br));
      }
      // Pfeiler (achtkantig, Durchmesser nach Breite) unter der Achse
      seit += S0[j] - S0[i];
      const ug = gh(P[j][0], P[j][1]),
        zj = Z[j] - t;
      if (seit >= STR_BR.pfeiler && j < P.length - 3 && zj - pl - ug > STR_BR.pfeilerAb) {
        seit = 0;
        const r = Math.max(0.6, w * 0.06),
          y0 = ug - 0.5,
          y1 = zj - pl;
        for (let q = 0; q < 8; q++) {
          const a0 = (q / 8) * Math.PI * 2,
            a1 = ((q + 1) / 8) * Math.PI * 2,
            p0 = [P[j][0] + Math.cos(a0) * r, P[j][1] + Math.sin(a0) * r],
            p1 = [P[j][0] + Math.cos(a1) * r, P[j][1] + Math.sin(a1) * r];
          quad(bau, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]);
        }
      }
    }
    // Stirnseiten an den Enden (Platte) – nicht, wo das Ende auf einer anderen Brücke liegt
    [0, P.length - 1].forEach(
      (i, e) =>
        (!kappe || kappe[e]) &&
        quad(
          bau,
          at(i, aussen(i, 0), -pl),
          at(i, aussen(i, 1), -pl),
          at(i, aussen(i, 1), 0),
          at(i, aussen(i, 0), 0),
        ),
    );
  });
  const geo = (pos) => {
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    ge.computeVertexNormals();
    return ge;
  };
  // Fahrbahn (Straße) und Gleisbett (Bahn) empfangen Schatten wie die Straßenflächen; den Schatten wirft die Platte
  if (oben.length) mk(geo(oben), E.matB);
  if (obenR.length) mk(geo(obenR), E.matR);
  if (bau.length) mk(geo(bau), E.matBW).castShadow = true;
}
/**
 * Fahrbahnhöhe einer Brücke je Punkt (P alle ~2 m, S0 Bogenlänge, G0 Gelände, w Breite). Wo das DOM die Fahrbahn
 * zeigt, gilt seine Höhe (DOM − e0, derselbe Bezug wie das Gelände; das maad-Gelände selbst ist ein gröberes Raster und
 * liegt an Grabenkanten und Böschungen zwischen oben und unten): je Punkt der Median quer über die Fahrbahn (die
 * OSM-Achse liegt oft neben dem Deck), längs der gleitende Median über ±10 m (Bäume, Fahrzeuge fallen heraus), Lücken
 * linear überbrückt, geglättet. Auch die Enden kommen aus dem DOM; nur wo es dort fast mit dem Gelände übereinstimmt
 * (< 1,5 m), wird auf den letzten 6 m auf das Gelände übergeblendet, damit die Straße nahtlos anschließt. Ohne DOM wie
 * bei Planimetric: linear zwischen den Höhen an den Enden (ha0, hb0: Anschlussstraße bzw. tragende Brücke, sonst
 * Gelände am Ende), mindestens 0,5 m über Gelände.
 */
function strBrueckeZ(P, S0, G0, w, ha0, hb0) {
  const n = P.length,
    Lg = S0[n - 1] || 1,
    Nn = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)],
        c = P[Math.min(n - 1, i + 1)],
        L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      return [-(c[1] - a[1]) / L, (c[0] - a[0]) / L];
    }),
    med = (a) => {
      const b = a.slice().sort((u, v) => u - v);
      return b[b.length >> 1];
    },
    q = Math.min(w / 3, 4),
    roh = P.map((p, i) => {
      const v = [-q, 0, q]
        .map((o) => strDomAbs(p[0] + Nn[i][0] * o, p[1] + Nn[i][1] * o))
        .filter((h) => h != null && h > G0[i] - 12 && h < G0[i] + 40);
      return v.length >= 2 ? med(v) : null;
    }),
    dom = roh.map((_, i) => {
      const v = [];
      for (let k = Math.max(0, i - 5); k <= Math.min(n - 1, i + 5); k++) if (roh[k] != null) v.push(roh[k]);
      return v.length >= 3 ? med(v) : null;
    }),
    gut = dom.map((h, i) => (h != null ? i : -1)).filter((i) => i >= 0);
  let Z0;
  if (gut.length < Math.max(2, n * 0.3)) {
    const ha = ha0 != null ? ha0 : G0[0],
      hb = hb0 != null ? hb0 : G0[n - 1];
    Z0 = S0.map((s, i) => Math.max(ha + ((hb - ha) * s) / Lg, i && i < n - 1 ? G0[i] + 0.5 : -1e9));
  } else {
    // Lücken linear zwischen den nächsten DOM-Werten, vor dem ersten / nach dem letzten konstant
    Z0 = dom.map((h, i) => {
      if (h != null) return h;
      let a = -1,
        b = -1;
      for (const k of gut) {
        if (k < i) a = k;
        else if (b < 0) b = k;
      }
      if (a < 0) return dom[b];
      if (b < 0) return dom[a];
      return dom[a] + ((dom[b] - dom[a]) * (S0[i] - S0[a])) / (S0[b] - S0[a] || 1);
    });
  }
  // schmale Senken bis ~30 m schließen (das DOM sieht dort durch einen Spalt auf den Grund): Schließen = Erosion der
  // Dilatation; Rampen und der Gesamtverlauf bleiben erhalten
  if (gut.length >= Math.max(2, n * 0.3)) {
    const r = 7,
      dil = Z0.map((_, i) => Math.max(...Z0.slice(Math.max(0, i - r), i + r + 1))),
      ero = dil.map((_, i) => Math.min(...dil.slice(Math.max(0, i - r), i + r + 1)));
    for (let i = 0; i < n; i++) Z0[i] = Math.max(Z0[i], ero[i]);
  }
  const Z = Z0.map((_, i) => {
    let s = 0,
      c = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) {
      s += Z0[k];
      c++;
    }
    return s / c;
  });
  // Anschluss an die Straße: nur überblenden, wo Brückenende und Gelände fast gleich hoch sind
  const anschluss = [0, n - 1].map((i) => Math.abs(Z[i] - G0[i]) < 1.5);
  return Z.map((z, i) => {
    const vorn = S0[i] <= Lg - S0[i],
      e = vorn ? S0[i] : Lg - S0[i],
      k = vorn ? 0 : n - 1;
    if (!anschluss[vorn ? 0 : 1] || e >= 6) return z;
    const a = e / 6;
    return z * a + G0[k] * (1 - a);
  });
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
/** Ebene E (Straßen oder Wege) aus Achsen und Flächen bauen. */
function strBauen(E, alle, fills) {
  strWeg(E);
  // als Brücke gekennzeichnete Achsen (OSM brunnel=bridge) werden als eigenes Bauwerk gebaut (strBrueckenBau), nicht
  // als Fläche im Gelände – darunter bleiben Gelände, Wasser und kreuzende Straßen unverändert
  const roads = alle.filter((r) => !r.br);
  const G0 = GEO.size,
    R = strFlaechen(roads, G0, E.r, fills),
    t = E.tief,
    B = strBruecken(roads, G0),
    N = R.N,
    c = R.c;
  E.ringe = R.ringe;
  // Brückenbereich im Raster der Maske
  const bc = document.createElement('canvas');
  bc.width = bc.height = N;
  const bx = bc.getContext('2d', { willReadFrequently: true });
  bx.strokeStyle = '#fff';
  bx.lineCap = bx.lineJoin = 'round';
  for (const { l, w } of B.linien) {
    bx.lineWidth = (w + 2 * E.r + 2) / c;
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
  if (E.uM.value) E.uM.value.dispose();
  const tx = new T.DataTexture(mk2, N, N, T.RGFormat);
  tx.magFilter = tx.minFilter = T.LinearFilter;
  tx.needsUpdate = true;
  E.uM.value = tx;
  STR.uG.value = G0;
  strGelaendeShader(S.terr.material);
  if (!E.mat) {
    // Fläche: Geländenetz, nur innerhalb des Umrisses gezeichnet (Rand scharf aus dem Abstandsfeld); Wege nicht
    // dort, wo eine Straße liegt (die Straße hat Vorrang)
    const weg = E === STR.E.paths;
    for (const x of Object.values(STR.E)) if (!x.uM.value) x.uM.value = strLeer();
    E.mat = new T.MeshLambertMaterial({ side: T.DoubleSide });
    E.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uStrM = E.uM;
      sh.uniforms.uStrR = STR.E.roads.uM;
      sh.uniforms.uStrG = STR.uG;
      sh.vertexShader =
        'varying vec2 vStrW;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvStrW = (modelMatrix * vec4(transformed, 1.0)).xz;',
        );
      sh.fragmentShader =
        'uniform sampler2D uStrM, uStrR;\nuniform float uStrG;\nvarying vec2 vStrW;\n' +
        sh.fragmentShader.replace(
          'void main() {',
          'void main() {\n  if (texture2D(uStrM, vStrW / uStrG + 0.5).r <= 0.502) discard;' +
            (weg ? '\n  if (texture2D(uStrR, vStrW / uStrG + 0.5).r > 0.502) discard;' : ''),
        );
    };
    E.mat.customProgramCacheKey = () => 'strFlaeche' + (weg ? 'W' : 'S');
    E.matK = new T.MeshLambertMaterial({ side: T.DoubleSide });
  }
  strFarbe(E);
  const roadM = E === STR.E.paths && STR.E.roads.aktiv ? STR.E.roads.uM.value.image : null,
    aufStrasse = (a, b2) => {
      if (!roadM) return false;
      const n2 = roadM.width,
        i = Math.floor(((a + G0 / 2) / G0) * n2),
        j = Math.floor(((b2 + G0 / 2) / G0) * n2);
      return i >= 0 && j >= 0 && i < n2 && j < n2 && roadM.data[2 * (j * n2 + i)] > 128;
    };
  const mk = (ge, m) => {
    const o = new T.Mesh(ge, m);
    o.receiveShadow = true;
    o.userData.str = 1;
    o.raycast = () => {};
    G[E.grp].add(o);
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
    mk(ge, E.mat);
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
            C = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
          // Weg an einer Straße: keine Kante (die Straße liegt tiefer und hat ihren eigenen Bordstein)
          if (aufStrasse((A[0] + C[0]) / 2, (A[1] + C[1]) / 2)) continue;
          const hbA = brueckeBei(A[0], A[1]) ? strBrueckeH(B, A[0], A[1]) : null,
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
    mk(ge, E.matK);
  }
  // ── Brückenbauwerke (Deck, Plattenstirn, Brüstung, Pfeiler) aus den gekennzeichneten Achsen
  try {
    strBrueckenBau(E, mk);
  } catch (er) {
    logErr(er, 'strBauen');
  }
  E.aktiv = true;
}
