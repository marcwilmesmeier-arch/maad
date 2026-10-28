/* v460 Innenhöfe und Dachflächen als echte Geometrie
   - Gebäude b.voids=[{poly:[[x,z]],j0,j1}]  Innenhof: Loch durch die Geschosse j0..j1 (einschließlich); Boden = Oberseite von Geschoss j0-1.
   - Geschoss l.faces=[{poly}]  auf das Dach gezeichnete Fläche (Skizze), wird mit Ziehen & Schieben zu Geschossen (hoch) oder Innenhof (runter). */
function znVoidsAt(b, i) {
  return (b.voids || []).filter((v) => v && v.poly && v.poly.length >= 3 && i >= v.j0 && i <= v.j1);
}
function znOri(pts, cw) {
  const c = T.ShapeUtils.isClockWise(pts);
  return c === cw ? pts : pts.slice().reverse();
}
function znPath(poly) {
  return new T.Path(
    znOri(
      poly.map((q) => new T.Vector2(q[0], -q[1])),
      false,
    ),
  );
}
// Berührt sich der Grundriss selbst (zwei gegenläufige, deckungsgleiche Kanten = Wand mit Abstand 0), wird diese Fläche entfernt: der Körper wird in getrennte Ringe zerlegt
function znPinch(fp) {
  const n = fp.length;
  for (let i = 0; i < n; i++) {
    const a = fp[i],
      b = fp[(i + 1) % n],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    for (let j = i + 1; j < n; j++) {
      const c = fp[j],
        d = fp[(j + 1) % n],
        ex = d[0] - c[0],
        ez = d[1] - c[1],
        M = Math.hypot(ex, ez);
      if (M < 1e-6) continue;
      if (dx * ex + dz * ez >= 0 || Math.abs(dx * ez - dz * ex) > 1e-6 * L * M) continue;
      if (Math.abs((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / L > 1e-4) continue;
      const t0 = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / L,
        t1 = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dz) / L;
      if (Math.min(Math.max(t0, t1), L) - Math.max(Math.min(t0, t1), 0) > 1e-3) return true;
    }
  }
  return false;
}
function znRings(fp) {
  try {
    const R = boolOp([bpP(fp)], [bpP(fp)], 'u');
    const out = R.flatMap((P) => [P.o].concat(P.h || []));
    return out.length ? out : [fp];
  } catch (e) {
    return [fp];
  }
}
// Grundriss bereinigen: gegenläufige deckungsgleiche Kanten (Wand mit Abstand 0) werden gelöscht; bleibt ein einzelner Ring übrig, wird er der neue Grundriss
function znCleanFp(b) {
  let ch = false;
  const fix = (fp) => {
    if (!fp || fp.length < 4 || !znPinch(fp)) return null;
    let R;
    try {
      R = boolOp([bpP(fp)], [bpP(fp)], 'u');
    } catch (e) {
      return null;
    }
    if (R.length !== 1 || R[0].h.length) return null;
    let o = R[0].o.map((q) => [q[0], q[1]]);
    const sg = (a) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) {
        const p = a[i],
          q = a[(i + 1) % a.length];
        s += p[0] * q[1] - q[0] * p[1];
      }
      return s;
    };
    if (sg(o) * sg(fp) < 0) o.reverse();
    return o;
  };
  b.levels.forEach((l) => {
    const o = fix(l.fp);
    if (o) {
      l.fp = o;
      ch = true;
    }
  });
  const o = fix(b.fp);
  if (o) {
    b.fp = o;
    ch = true;
  }
  return ch;
}
function znShape(b, l, i) {
  const fp = l.fp || b.fp,
    vs = znVoidsAt(b, i);
  if (fp.length >= 4 && znPinch(fp)) {
    try {
      let R = boolOp([bpP(fp)], [bpP(fp)], 'u');
      if (vs.length)
        R = boolOp(
          R,
          vs.map((v) => bpP(v.poly)),
          'd',
        );
      const out = R.filter((P) => P.o.length >= 3).map((P) => {
        const sh = new T.Shape(
          znOri(
            P.o.map((q) => new T.Vector2(q[0], -q[1])),
            true,
          ),
        );
        P.h.forEach((h) => sh.holes.push(znPath(h)));
        return sh;
      });
      if (out.length) return out.length === 1 ? out[0] : out;
    } catch (e) {
      console.warn('znShape', e);
    }
  }
  const sh = new T.Shape(
    znOri(
      fp.map((q) => new T.Vector2(q[0], -q[1])),
      true,
    ),
  );
  vs.forEach((v) => sh.holes.push(znPath(v.poly)));
  return sh;
}
function znMeshes(b, g, pz) {
  if (!b.levels.some((l) => l.faces && l.faces.length)) return;
  b.levels.forEach((l, i) => {
    (l.faces || []).forEach((f, fi) => {
      if (!f || !f.poly || f.poly.length < 3) return;
      const hi = pz(i) + l.h;
      const ge = new T.ExtrudeGeometry(
        new T.Shape(
          znOri(
            f.poly.map((q) => new T.Vector2(q[0], -q[1])),
            true,
          ),
        ),
        { depth: 0.05, bevelEnabled: false },
      );
      ge.rotateX(-Math.PI / 2);
      const m = new T.Mesh(ge, mat(b.ex ? 0xe6e6e6 : 0x9cc3e6, { emissive: 0x000000 }));
      m.position.y = hi;
      m.castShadow = false;
      m.receiveShadow = true;
      m.userData.b = b;
      m.userData.k = i;
      m.userData.face = fi;
      const e = new T.LineSegments(new T.EdgesGeometry(ge), new T.LineBasicMaterial({ color: 0x2f6fb0 }));
      e.userData.kont = 1;
      e.position.copy(m.position);
      g.add(m, e);
    });
  });
}
function znVoidA(b, i) {
  return znVoidsAt(b, i).reduce((s, v) => s + area(v.poly), 0);
}
function larea(b, l) {
  const i = b.levels.indexOf(l);
  return Math.max(0, area(lf(b, l)) - (b.voids && b.voids.length && i >= 0 ? znVoidA(b, i) : 0));
}
// ---- Geometrie-Hilfen
function znInP(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function znSegX(a, b, c, d) {
  const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(r) < 1e-12) return false;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r,
    u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}
function znEdgesX(P, Q) {
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    for (let j = 0; j < Q.length; j++) if (znSegX(a, b, Q[j], Q[(j + 1) % Q.length])) return true;
  }
  return false;
}
function znOnB(p, poly, tol) {
  tol = tol || 1e-3;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      c = poly[(i + 1) % poly.length],
      ex = c[0] - a[0],
      ez = c[1] - a[1],
      L2 = ex * ex + ez * ez;
    let t = L2 < 1e-12 ? 0 : ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(a[0] + ex * t - p[0], a[1] + ez * t - p[1]) < tol) return true;
  }
  return false;
}
function znStrict(p, poly) {
  return znInP(p, poly) && !znOnB(p, poly);
}
function znCen(poly) {
  let x = 0,
    z = 0;
  poly.forEach((q) => {
    x += q[0];
    z += q[1];
  });
  return [x / poly.length, z / poly.length];
}
function znMids(poly) {
  return poly.map((a, i) => {
    const c = poly[(i + 1) % poly.length];
    return [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  });
}
function znInside(outer, poly) {
  return (
    poly.every((p) => znInP(p, outer) || znOnB(p, outer)) &&
    znMids(poly).every((p) => znInP(p, outer) || znOnB(p, outer)) &&
    !znEdgesX(outer, poly)
  );
}
function znOverlap(P, Q) {
  if (znEdgesX(P, Q)) return true;
  const t = (A, B) =>
    A.some((p) => znStrict(p, B)) || znMids(A).some((p) => znStrict(p, B)) || znStrict(znCen(A), B);
  return t(P, Q) || t(Q, P);
}
function znInterior(outer, poly) {
  return (
    poly.length >= 3 &&
    poly.every((p) => znStrict(p, outer)) &&
    znMids(poly).every((p) => znStrict(p, outer)) &&
    !znEdgesX(outer, poly)
  );
}
function znStats(b) {
  const o = { voidA: 0, voidV: 0, voidF: 0, n: 0 };
  (b.voids || []).forEach((v) => {
    const a = area(v.poly);
    o.voidA += a;
    o.n++;
    let per = 0;
    v.poly.forEach((p, i) => {
      const c = v.poly[(i + 1) % v.poly.length];
      per += Math.hypot(c[0] - p[0], c[1] - p[1]);
    });
    for (let i = v.j0; i <= v.j1 && i < b.levels.length; i++) {
      o.voidV += a * b.levels[i].h;
      o.voidF += per * b.levels[i].h;
    }
  });
  return o;
}
function znRows(b, R, A, zoD) {
  const o = znStats(b);
  if (!o.n) return '';
  const f = (v) => f1(v, 1).replace('.', ',');
  return zoD(
    'zn' + b.id,
    'Innenhöfe',
    '',
    R('#555', 'Innenhöfe (' + o.n + ')', A(o.voidA), '') +
      R('', 'Fassade zu den Höfen', A(o.voidF), '') +
      R('', 'Hofvolumen', f(o.voidV) + ' m³', ''),
    null,
  );
}
