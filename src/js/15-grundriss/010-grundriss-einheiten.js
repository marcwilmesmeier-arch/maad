// ======================================================================
// ======== Grundriss / Einheiten – Kern (reine Geometrie) ==============
// Ein Geschoss wird in 1,2 m Höhe geschnitten. Seine Fläche (Ring aus Gebäudeumriss
// bzw. Dachkontur) wird mit freien Linien/Rechtecken zerlegt: planare Zerlegung
// (Schnittpunkte, Sackgassen entfernen, Flächen aus Halbkanten, Inseln = Löcher).
// ======================================================================
const GRK = (v) => Math.round(v * 1000);
function grSplit(segs) {
  const EPS = 0.003,
    out = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i],
      ax = s[0],
      az = s[1],
      dx = s[2] - ax,
      dz = s[3] - az,
      L2 = dx * dx + dz * dz;
    if (L2 < 1e-10) continue;
    const ts = [
      { t: 0, x: s[0], z: s[1] },
      { t: 1, x: s[2], z: s[3] },
    ];
    for (let j = 0; j < segs.length; j++) {
      if (j === i) continue;
      const c = segs[j],
        cx = c[0],
        cz = c[1],
        fx = c[2] - cx,
        fz = c[3] - cz,
        den = dx * fz - dz * fx;
      if (Math.abs(den) > 1e-12) {
        const t = ((cx - ax) * fz - (cz - az) * fx) / den,
          u = ((cx - ax) * dz - (cz - az) * dx) / den;
        if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9)
          ts.push({ t, x: ax + dx * t, z: az + dz * t });
      }
      for (const q of [
        [c[0], c[1]],
        [c[2], c[3]],
      ]) {
        const t = ((q[0] - ax) * dx + (q[1] - az) * dz) / L2;
        if (t > 1e-9 && t < 1 - 1e-9) {
          const px = ax + dx * t,
            pz = az + dz * t;
          if (Math.hypot(q[0] - px, q[1] - pz) < EPS) ts.push({ t, x: q[0], z: q[1] });
        }
      }
    }
    ts.sort((p, q) => p.t - q.t);
    for (let k = 0; k < ts.length - 1; k++) out.push([ts[k].x, ts[k].z, ts[k + 1].x, ts[k + 1].z, s[4]]);
  }
  return out;
}
function grEO(segs, x, z) {
  let c = false;
  for (const s of segs) {
    if (s[1] > z !== s[3] > z && x < ((s[2] - s[0]) * (z - s[1])) / (s[3] - s[1]) + s[0]) c = !c;
  }
  return c;
}
const grRingA = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const q = r[(i + 1) % r.length];
    a += r[i][0] * q[1] - q[0] * r[i][1];
  }
  return a / 2;
};
function grInRing(r, x, z) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > z !== r[j][1] > z &&
      x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      c = !c;
  return c;
}
const grInFace = (f, x, z) => grInRing(f.o, x, z) && !f.h.some((h) => grInRing(h, x, z));
const grDSeg = (x, z, a, b, c, d) => {
  const dx = c - a,
    dz = d - b,
    L = dx * dx + dz * dz;
  let t = L > 0 ? ((x - a) * dx + (z - b) * dz) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a + dx * t), z - (b + dz * t));
};
// „Pol der Unzugänglichkeit“ (Beschriftungspunkt) einer Fläche mit Löchern
function grPole(rings) {
  const o = rings[0];
  let x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9;
  o.forEach((p) => {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]);
    z1 = Math.max(z1, p[1]);
  });
  const inside = (x, z) => grInRing(o, x, z) && !rings.slice(1).some((h) => grInRing(h, x, z));
  const dist = (x, z) => {
    let m = 1e9;
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const q = r[(i + 1) % r.length],
          d = grDSeg(x, z, r[i][0], r[i][1], q[0], q[1]);
        if (d < m) m = d;
      }
    return m;
  };
  let best = null,
    bd = -1;
  const N = 22,
    cx = (x1 - x0) / N,
    cz = (z1 - z0) / N;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = x0 + (i + 0.5) * cx,
        z = z0 + (j + 0.5) * cz;
      if (!inside(x, z)) continue;
      const d = dist(x, z);
      if (d > bd) {
        bd = d;
        best = [x, z];
      }
    }
  if (best) {
    let st = Math.max(cx, cz) / 2;
    for (let it = 0; it < 9; it++) {
      let moved = false;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const x = best[0] + a * st,
          z = best[1] + b * st;
        if (!inside(x, z)) continue;
        const d = dist(x, z);
        if (d > bd + 1e-9) {
          bd = d;
          best = [x, z];
          moved = true;
        }
      }
      if (!moved) st /= 2;
    }
  } else {
    // dünne Fläche: Mitte der längsten Spanne auf mittlerer Rasterlinie
    for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const z = z0 + (z1 - z0) * f,
        xs = [];
      for (const r of rings)
        for (let i = 0; i < r.length; i++) {
          const p = r[i],
            q = r[(i + 1) % r.length];
          if (p[1] > z !== q[1] > z) xs.push(p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]));
        }
      xs.sort((a, b) => a - b);
      let bl = 0;
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (xs[i + 1] - xs[i] > bl) {
          bl = xs[i + 1] - xs[i];
          best = [(xs[i] + xs[i + 1]) / 2, z];
        }
      }
      if (best) {
        bd = dist(best[0], best[1]);
        break;
      }
    }
    if (!best) {
      best = [(x0 + x1) / 2, (z0 + z1) / 2];
      bd = 0;
    }
  }
  return { x: best[0], z: best[1], r: bd };
}
// bs: Randsegmente [ax,az,bx,bz] (Gebäudeumriss / Dachkontur), cuts: Schnitte [ax,az,bx,bz]
// Schnitt-Endpunkte nahe am Rand werden auf den Rand gelegt (der Rand selbst bleibt unverändert)
function grSnapEnd(bs, x, z) {
  let bd = 0.003,
    bp = null;
  for (const s of bs) {
    const dx = s[2] - s[0],
      dz = s[3] - s[1],
      L = dx * dx + dz * dz;
    let t = L > 0 ? ((x - s[0]) * dx + (z - s[1]) * dz) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const px = s[0] + dx * t,
      pz = s[1] + dz * t,
      d = Math.hypot(x - px, z - pz);
    if (d <= bd) {
      bd = d;
      bp = [px, pz];
    }
  }
  return bp || [x, z];
}
function grFaces(bs, cuts) {
  const segs = bs.map((s) => [s[0], s[1], s[2], s[3], 1]),
    nb = segs.length;
  cuts.forEach((c) => {
    const a = grSnapEnd(bs, c[0], c[1]),
      b = grSnapEnd(bs, c[2], c[3]);
    segs.push([a[0], a[1], b[0], b[1], 2]);
  });
  const subs = grSplit(segs),
    bnd = segs.slice(0, nb);
  const nodes = new Map(),
    edges = new Map(),
    node = (x, z) => {
      const k = GRK(x) + ',' + GRK(z);
      let n = nodes.get(k);
      if (!n) {
        n = { k, x: GRK(x) / 1000, z: GRK(z) / 1000, e: [], out: [] };
        nodes.set(k, n);
      }
      return n;
    };
  for (const s of subs) {
    const A = node(s[0], s[1]),
      B = node(s[2], s[3]);
    if (A === B) continue;
    const ek = A.k < B.k ? A.k + '|' + B.k : B.k + '|' + A.k;
    let e = edges.get(ek);
    if (!e) {
      if (s[4] === 2 && !grEO(bnd, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) continue;
      e = { a: A, b: B, kind: s[4] };
      edges.set(ek, e);
      A.e.push(e);
      B.e.push(e);
    } else e.kind |= s[4];
  }
  // Sackgassen entfernen
  let ch = true;
  while (ch) {
    ch = false;
    for (const n of nodes.values()) {
      if (n.e.length === 1) {
        const e = n.e[0],
          o = e.a === n ? e.b : e.a;
        o.e = o.e.filter((x) => x !== e);
        n.e = [];
        edges.delete([...edges].find(([k, v]) => v === e)[0]);
        ch = true;
      }
    }
  }
  // Halbkanten
  const he = [];
  for (const e of edges.values()) {
    const h1 = { f: e.a, t: e.b, k: e.kind },
      h2 = { f: e.b, t: e.a, k: e.kind };
    h1.tw = h2;
    h2.tw = h1;
    he.push(h1, h2);
    e.a.out.push(h1);
    e.b.out.push(h2);
  }
  for (const n of nodes.values()) {
    n.out.sort((p, q) => Math.atan2(p.t.z - n.z, p.t.x - n.x) - Math.atan2(q.t.z - n.z, q.t.x - n.x));
    n.out.forEach((h, i) => (h.pos = i));
  }
  // Komponenten
  const par = new Map();
  const fd = (k) => {
    while (par.get(k) !== k) {
      par.set(k, par.get(par.get(k)));
      k = par.get(k);
    }
    return k;
  };
  nodes.forEach((n, k) => par.set(k, k));
  for (const e of edges.values()) {
    const a = fd(e.a.k),
      b = fd(e.b.k);
    if (a !== b) par.set(a, b);
  }
  const cyc = [];
  for (const h0 of he) {
    if (h0.u) continue;
    const ring = [];
    let h = h0,
      g = 0;
    do {
      h.u = 1;
      ring.push([h.f.x, h.f.z]);
      const n = h.t,
        L = n.out;
      h = L[(h.tw.pos - 1 + L.length) % L.length];
      g++;
    } while (h !== h0 && g < 100000);
    cyc.push({ ring, a: grRingA(ring), comp: fd(h0.f.k) });
  }
  const faces = cyc.filter((c) => c.a > 1e-6).map((c) => ({ o: c.ring, h: [], a0: c.a, comp: c.comp }));
  for (const c of cyc) {
    if (c.a >= -1e-6) continue;
    let best = null;
    for (const f of faces) {
      if (f.comp === c.comp) continue;
      if (grInRing(f.o, c.ring[0][0], c.ring[0][1]) && (!best || f.a0 < best.a0)) best = f;
    }
    if (best) best.h.push(c.ring.slice().reverse());
  }
  const out = [];
  for (const f of faces) {
    const pl = grPole([f.o].concat(f.h));
    if (!grEO(bnd, pl.x, pl.z)) continue;
    const A = f.a0 - f.h.reduce((s, h) => s + Math.abs(grRingA(h)), 0);
    if (A < 1e-4) continue;
    out.push({ o: f.o, h: f.h, a: A, c: [pl.x, pl.z], r: pl.r });
  }
  out.sort((p, q) => p.c[1] - q.c[1] || p.c[0] - q.c[0]);
  return out;
}
// Randsegmente aus Teilflächen (ein Segment, das nur eine Teilfläche begrenzt, ist Rand)
function grBoundOf(pieces) {
  const segs = [];
  pieces.forEach((P) => {
    for (let i = 0; i < P.length; i++) {
      const q = P[(i + 1) % P.length];
      segs.push([P[i][0], P[i][1], q[0], q[1], 1]);
    }
  });
  const sub = grSplit(segs),
    m = new Map();
  sub.forEach((s) => {
    const a = GRK(s[0]) + ',' + GRK(s[1]),
      b = GRK(s[2]) + ',' + GRK(s[3]);
    if (a === b) return;
    const k = a < b ? a + '|' + b : b + '|' + a,
      e = m.get(k);
    if (e) e.n++;
    else m.set(k, { s: [s[0], s[1], s[2], s[3]], n: 1 });
  });
  return [...m.values()].filter((e) => e.n === 1).map((e) => e.s);
}
const grLoopSegs = (loops) =>
  loops.flatMap((L) =>
    L.map((p, i) => {
      const q = L[(i + 1) % L.length];
      return [p[0], p[1], q[0], q[1]];
    }),
  );
