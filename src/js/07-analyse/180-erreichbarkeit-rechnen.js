// ======================= ERREICHBARKEIT ZU FUSS: RECHNUNG =======================
// Reine Rechenfunktionen ohne Browser-Bezug (in Node getestet: tests/erreichbarkeit.test.mjs).
// 1. erNetz: Wegenetz aus OSM-Wegen (Knoten-IDs + lokale Koordinaten) als Graph.
// 2. erZeiten: Gehzeit (Minuten) vom Startpunkt zu jedem Knoten (Dijkstra).
// 3. erRaster: Gehzeit je Rasterzelle im Projektausschnitt: von den erreichten Knoten aus abseits der Wege weiter
//    (langsamer, höchstens `abseits` Meter), damit Plätze, Höfe und Gebäudezugänge neben dem Weg mitzählen.

/** Kleiner Binär-Heap (Min) für Dijkstra: Einträge [Schlüssel, Wert]. */
function erHeap() {
  const k = [],
    v = [];
  return {
    get n() {
      return k.length;
    },
    push(key, val) {
      let i = k.length;
      k.push(key);
      v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (k[p] <= key) break;
        k[i] = k[p];
        v[i] = v[p];
        i = p;
      }
      k[i] = key;
      v[i] = val;
    },
    pop() {
      const rk = k[0],
        rv = v[0],
        lk = k.pop(),
        lv = v.pop();
      if (k.length) {
        let i = 0;
        for (;;) {
          const a = 2 * i + 1,
            b = a + 1;
          let m = i,
            mk = lk;
          if (a < k.length && k[a] < mk) {
            m = a;
            mk = k[a];
          }
          if (b < k.length && k[b] < mk) m = b;
          if (m === i) break;
          k[i] = k[m];
          v[i] = v[m];
          i = m;
        }
        k[i] = lk;
        v[i] = lv;
      }
      return [rk, rv];
    },
  };
}

/**
 * @param {{ids:number[], pts:number[][]}[]} wege  je Weg die OSM-Knoten-IDs und die lokalen Punkte [x, z] (gleich lang)
 * @returns {{x:Float64Array, z:Float64Array, nb:number[][], len:number[][]}} Knotenlage und Nachbarn mit Kantenlänge (m)
 */
function erNetz(wege) {
  const idx = new Map(),
    xs = [],
    zs = [],
    nb = [],
    len = [];
  const knoten = (id, p) => {
    let i = idx.get(id);
    if (i === undefined) {
      i = xs.length;
      idx.set(id, i);
      xs.push(p[0]);
      zs.push(p[1]);
      nb.push([]);
      len.push([]);
    }
    return i;
  };
  for (const w of wege) {
    let vor = -1;
    for (let k = 0; k < w.ids.length; k++) {
      const i = knoten(w.ids[k], w.pts[k]);
      if (vor >= 0 && vor !== i) {
        const d = Math.hypot(xs[i] - xs[vor], zs[i] - zs[vor]);
        nb[vor].push(i);
        len[vor].push(d);
        nb[i].push(vor);
        len[i].push(d);
      }
      vor = i;
    }
  }
  return { x: Float64Array.from(xs), z: Float64Array.from(zs), nb, len };
}

/**
 * Gehzeit in Minuten vom Start (über den jeweils nächsten Netzknoten) zu jedem Knoten; Infinity = nicht erreicht.
 * @param {number[]|number[][]} start  ein Punkt [x, z] oder mehrere (z. B. die Ecken des Grundstücks)
 * @param {number} v  Gehgeschwindigkeit in m/min (4,8 km/h = 80 m/min)
 */
function erZeiten(netz, start, v, tMax) {
  const n = netz.x.length,
    t = new Float64Array(n).fill(Infinity),
    starts = Array.isArray(start[0]) ? start : [start];
  if (!n) return { t, zugang: Infinity };
  const h = erHeap();
  let zugang = Infinity;
  for (const p of starts) {
    let s = 0,
      best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(netz.x[i] - p[0], netz.z[i] - p[1]);
      if (d < best) {
        best = d;
        s = i;
      }
    }
    zugang = Math.min(zugang, best);
    if (best / v < t[s]) {
      t[s] = best / v;
      h.push(t[s], s);
    }
  }
  while (h.n) {
    const [ti, i] = h.pop();
    if (ti > t[i] || ti > tMax) continue;
    const N = netz.nb[i],
      L = netz.len[i];
    for (let k = 0; k < N.length; k++) {
      const tj = ti + L[k] / v;
      if (tj < t[N[k]]) {
        t[N[k]] = tj;
        h.push(tj, N[k]);
      }
    }
  }
  return { t, zugang };
}

/**
 * Gehzeit je Rasterzelle (Minuten) im Quadrat [-h, h]²; Zeile j = z, Spalte i = x (Zellmitten).
 * @param {number} zelle    Zellgröße in m
 * @param {number} abseits  größte Strecke abseits der Wege in m (Gehgeschwindigkeit dort 70 %)
 */
function erRaster(netz, zeiten, h, zelle, v, abseits, tMax) {
  const W = Math.ceil((2 * h) / zelle),
    t = new Float32Array(W * W).fill(Infinity),
    rest = new Float32Array(W * W), // noch erlaubte Strecke abseits der Wege (m)
    hp = erHeap(),
    va = v * 0.7;
  for (let i = 0; i < netz.x.length; i++) {
    const ti = zeiten.t[i];
    if (!(ti <= tMax)) continue;
    const ci = Math.floor((netz.x[i] + h) / zelle),
      cj = Math.floor((netz.z[i] + h) / zelle);
    if (ci < 0 || cj < 0 || ci >= W || cj >= W) continue;
    const c = cj * W + ci;
    if (ti < t[c]) {
      t[c] = ti;
      rest[c] = abseits;
      hp.push(ti, c);
    }
  }
  const D = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (hp.n) {
    const [tc, c] = hp.pop();
    if (tc > t[c]) continue;
    const ci = c % W,
      cj = (c - ci) / W;
    for (const [di, dj, f] of D) {
      const ni = ci + di,
        nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= W) continue;
      const m = f * zelle,
        r = rest[c] - m;
      if (r < 0) continue;
      const nc = nj * W + ni,
        tn = tc + m / va;
      if (tn < t[nc] && tn <= tMax) {
        t[nc] = tn;
        rest[nc] = r;
        hp.push(tn, nc);
      }
    }
  }
  return { W, zelle, h, t };
}
