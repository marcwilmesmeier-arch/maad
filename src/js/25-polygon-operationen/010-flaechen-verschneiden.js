/* v460 Flächen verschneiden (Vereinigung · Differenz · Schnitt) für einfache Polygone mit Löchern.
   Verfahren: alle Kanten an Schnittpunkten/Anschlüssen teilen, Knoten zusammenfassen, für jede Kante die Seite links/rechts prüfen –
   Randkanten (innen/außen verschieden) werden zu Ringen verbunden. Robust bei gemeinsamen Kanten. Eingabe: Vielecke als [[x,z],...] (Ring) – Mehrfachflächen: Liste von {o:Ring,h:[Ring]} */
function bpIn(p, P) {
  let c = 0;
  const R = [P.o].concat(P.h || []);
  R.forEach((r) => {
    if (znInP(p, r)) c++;
  });
  return c % 2 === 1;
}
function bpInAny(p, L) {
  return L.some((P) => bpIn(p, P));
}
function bpP(r) {
  return { o: r, h: [] };
}
function boolOp(A, B, op) {
  const TOL = 1e-5,
    EPS = 3e-4,
    segs = [];
  const add = (L) =>
    L.forEach((P) =>
      [P.o].concat(P.h || []).forEach((r) => {
        for (let i = 0; i < r.length; i++) {
          const a = r[i],
            b = r[(i + 1) % r.length];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > TOL) segs.push([a[0], a[1], b[0], b[1]]);
        }
      }),
    );
  add(A);
  add(B);
  const pts = [];
  segs.forEach((s) => {
    pts.push([s[0], s[1]], [s[2], s[3]]);
  });
  const cuts = segs.map(() => []);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i],
      dx = s[2] - s[0],
      dz = s[3] - s[1],
      L2 = dx * dx + dz * dz;
    for (const p of pts) {
      const t = ((p[0] - s[0]) * dx + (p[1] - s[1]) * dz) / L2;
      if (t <= TOL / Math.sqrt(L2) || t >= 1 - TOL / Math.sqrt(L2)) continue;
      if (Math.hypot(s[0] + dx * t - p[0], s[1] + dz * t - p[1]) < TOL) cuts[i].push(t);
    }
    for (let j = i + 1; j < segs.length; j++) {
      const u = segs[j],
        ex = u[2] - u[0],
        ez = u[3] - u[1],
        den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((u[0] - s[0]) * ez - (u[1] - s[1]) * ex) / den,
        w = ((u[0] - s[0]) * dz - (u[1] - s[1]) * dx) / den;
      if (t > 1e-9 && t < 1 - 1e-9 && w > 1e-9 && w < 1 - 1e-9) {
        cuts[i].push(t);
        cuts[j].push(w);
      }
    }
  }
  // Knoten
  const nodes = [],
    key = new Map();
  const nid = (x, z) => {
    const kx = Math.round(x / 1e-4),
      kz = Math.round(z / 1e-4);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const k = kx + a + '|' + (kz + b),
          v = key.get(k);
        if (v != null && Math.hypot(nodes[v][0] - x, nodes[v][1] - z) < 2e-4) return v;
      }
    const id = nodes.length;
    nodes.push([x, z]);
    key.set(kx + '|' + kz, id);
    return id;
  };
  const edges = new Map();
  segs.forEach((s, i) => {
    const ts = [0].concat(
      cuts[i].sort((a, b) => a - b),
      [1],
    );
    let prev = nid(s[0], s[1]);
    for (let k = 1; k < ts.length; k++) {
      const t = ts[k];
      const cur =
        k === ts.length - 1 ? nid(s[2], s[3]) : nid(s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t);
      if (cur !== prev) {
        const a = Math.min(prev, cur),
          b = Math.max(prev, cur);
        edges.set(a + '|' + b, [a, b]);
      }
      prev = cur;
    }
  });
  const pred = (p) => {
    const a = bpInAny(p, A),
      b = bpInAny(p, B);
    return op === 'u' ? a || b : op === 'd' ? a && !b : a && b;
  };
  const out = new Map();
  let cnt = 0;
  edges.forEach(([a, b]) => {
    const p = nodes[a],
      q = nodes[b],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      L = Math.hypot(dx, dz),
      nx = -dz / L,
      nz = dx / L,
      mx = (p[0] + q[0]) / 2,
      mz = (p[1] + q[1]) / 2;
    const l = pred([mx + nx * EPS, mz + nz * EPS]),
      r = pred([mx - nx * EPS, mz - nz * EPS]);
    if (l === r) return;
    const f = l ? [a, b] : [b, a];
    if (!out.has(f[0])) out.set(f[0], []);
    out.get(f[0]).push(f[1]);
    cnt++;
  });
  // Ringe verbinden (Innenseite links)
  const used = new Set(),
    rings = [];
  const ang = (u, v) => Math.atan2(nodes[v][1] - nodes[u][1], nodes[v][0] - nodes[u][0]);
  out.forEach((tos, from) => {
    tos.forEach((to0) => {
      const k0 = from + '>' + to0;
      if (used.has(k0)) return;
      const ring = [];
      let a = from,
        b = to0,
        guard = 0;
      while (guard++ < 5000) {
        used.add(a + '>' + b);
        ring.push(nodes[a]);
        if (b === from && false) break;
        const c = (out.get(b) || []).filter((x) => !used.has(b + '>' + x));
        if (!c.length) {
          if (b === from) break;
          ring.length = 0;
          break;
        }
        let pick = c[0];
        if (c.length > 1) {
          const back = ang(b, a);
          let best = 1e9;
          c.forEach((x) => {
            let d = back - ang(b, x);
            while (d <= 1e-9) d += 2 * Math.PI;
            while (d > 2 * Math.PI + 1e-9) d -= 2 * Math.PI;
            if (d < best) {
              best = d;
              pick = x;
            }
          });
        }
        a = b;
        b = pick;
        if (a === from) {
          break;
        }
      }
      if (ring.length >= 3) rings.push(ring);
    });
  });
  const clean = (r) => {
    let q = r.map((p) => p.slice()),
      ch = true;
    while (ch && q.length > 3) {
      ch = false;
      for (let i = 0; i < q.length; i++) {
        const p = q[(i + q.length - 1) % q.length],
          c = q[i],
          n = q[(i + 1) % q.length],
          cr = (c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]);
        if (Math.abs(cr) < 1e-7 * Math.max(1, Math.hypot(n[0] - p[0], n[1] - p[1]))) {
          q.splice(i, 1);
          ch = true;
          break;
        }
      }
    }
    return q;
  };
  const sa = (r) => {
    let A2 = 0;
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length];
      A2 += p[0] * q[1] - q[0] * p[1];
    }
    return A2 / 2;
  };
  const rs = rings.map(clean).filter((r) => r.length >= 3 && Math.abs(sa(r)) > 1e-6);
  const outers = rs.filter((r) => sa(r) > 0).map((r) => ({ o: r, h: [] })),
    holes = rs.filter((r) => sa(r) < 0);
  holes.forEach((h) => {
    const P = outers
      .filter((o) => znInP(h[0], o.o) || znInP(znCen(h), o.o))
      .sort((x, y) => Math.abs(sa(x.o)) - Math.abs(sa(y.o)))[0];
    if (P) P.h.push(h);
  });
  return outers;
}
function boolUnion(A, B) {
  return boolOp(A, B, 'u');
}
function boolDiff(A, B) {
  return boolOp(A, B, 'd');
}
function boolInter(A, B) {
  return boolOp(A, B, 'i');
}
function boolArea(L) {
  return L.reduce((s, P) => {
    const a = (r) => {
      let A2 = 0;
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length];
        A2 += p[0] * q[1] - q[0] * p[1];
      }
      return Math.abs(A2 / 2);
    };
    return s + a(P.o) - (P.h || []).reduce((x, h) => x + a(h), 0);
  }, 0);
}
