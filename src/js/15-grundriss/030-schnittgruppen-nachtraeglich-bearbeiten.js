// ---- Schnittgruppen nachträglich bearbeiten (v229) und Einheiten zusammenfügen
const gk = (x, z) => Math.round(x * 100) + ',' + Math.round(z * 100);
function grGrp(lv, g) {
  const sg = (lv.obj.cuts || []).filter((c) => c[4] === g),
    vm = new Map();
  sg.forEach((c) =>
    [
      [c[0], c[1]],
      [c[2], c[3]],
    ].forEach((p) => {
      const k = gk(p[0], p[1]),
        e = vm.get(k);
      if (e) e.n++;
      else vm.set(k, { k, p, n: 1 });
    }),
  );
  const vs = [...vm.values()];
  let loop = sg.length >= 3 && vs.length === sg.length && vs.every((v) => v.n === 2),
    ring = null,
    rect = false;
  if (loop) {
    ring = [];
    const used = new Set([0]);
    ring.push([sg[0][0], sg[0][1]]);
    let tip = [sg[0][2], sg[0][3]];
    for (let n = 1; n < sg.length; n++) {
      ring.push(tip);
      const kt = gk(tip[0], tip[1]);
      let nx = -1,
        nt = null;
      sg.forEach((c, i) => {
        if (used.has(i)) return;
        if (gk(c[0], c[1]) === kt) {
          nx = i;
          nt = [c[2], c[3]];
        } else if (gk(c[2], c[3]) === kt) {
          nx = i;
          nt = [c[0], c[1]];
        }
      });
      if (nx < 0) {
        ring = null;
        break;
      }
      used.add(nx);
      tip = nt;
    }
    if (ring && gk(tip[0], tip[1]) !== gk(ring[0][0], ring[0][1])) ring = null;
    loop = !!ring;
  }
  if (loop && ring.length === 4) {
    rect = true;
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4],
        c = ring[(i + 2) % 4],
        u = [b[0] - a[0], b[1] - a[1]],
        w = [c[0] - b[0], c[1] - b[1]],
        dt = u[0] * w[0] + u[1] * w[1];
      if (Math.abs(dt) > 2e-3 * Math.hypot(...u) * Math.hypot(...w)) rect = false;
    }
  }
  let cx = 0,
    cz = 0;
  vs.forEach((v) => {
    cx += v.p[0];
    cz += v.p[1];
  });
  const n = Math.max(1, vs.length);
  return { g, sg, vs, loop, ring, rect, cen: [cx / n, cz / n] };
}
// Verschiebe-Abbildung (Eckschlüssel -> neuer Punkt) für Eck-, Kanten- und Gesamtverschiebung
function grMapV(grp, mode, a) {
  const m = new Map();
  if (mode === 'v') {
    if (grp.rect) {
      const i = grp.ring.findIndex((p) => gk(p[0], p[1]) === a.k);
      if (i >= 0) {
        const o = grp.ring[(i + 2) % 4],
          e = grp.ring[1],
          th = Math.atan2(e[1] - grp.ring[0][1], e[0] - grp.ring[0][0]),
          R = grRect({ x: o[0], z: o[1] }, { x: a.x, z: a.z }, th);
        // R[0] = Gegenecke o, R[2] = bewegte Ecke; Rest in Ringreihenfolge zuordnen
        const mid1 = grp.ring[(i + 1) % 4],
          mid3 = grp.ring[(i + 3) % 4];
        m.set(a.k, R[2]);
        const d1 = R[1],
          d3 = R[3],
          sw =
            Math.hypot(d1[0] - mid1[0], d1[1] - mid1[1]) + Math.hypot(d3[0] - mid3[0], d3[1] - mid3[1]) >
            Math.hypot(d3[0] - mid1[0], d3[1] - mid1[1]) + Math.hypot(d1[0] - mid3[0], d1[1] - mid3[1]);
        m.set(gk(mid1[0], mid1[1]), sw ? d3 : d1);
        m.set(gk(mid3[0], mid3[1]), sw ? d1 : d3);
      }
    } else m.set(a.k, [a.x, a.z]);
  } else if (mode === 'e') {
    const c = grp.sg[a.i],
      L = Math.hypot(c[2] - c[0], c[3] - c[1]) || 1,
      nx = -(c[3] - c[1]) / L,
      nz = (c[2] - c[0]) / L;
    [
      [c[0], c[1]],
      [c[2], c[3]],
    ].forEach((p) => m.set(gk(p[0], p[1]), [p[0] + nx * a.d, p[1] + nz * a.d]));
  } else if (mode === 'a') {
    grp.vs.forEach((v) => m.set(v.k, [v.p[0] + a.dx, v.p[1] + a.dz]));
  }
  return m;
}
const grMapSegs = (grp, m) =>
  grp.sg.map((c) => {
    const A = m.get(gk(c[0], c[1])) || [c[0], c[1]],
      B = m.get(gk(c[2], c[3])) || [c[2], c[3]];
    return [A[0], A[1], B[0], B[1]];
  });
function grEditGrp(g, m) {
  grEdit((b) => {
    const lv = grLv(b),
      grp = grGrp(lv, g);
    if (!grp.sg.length) return;
    const segs = grMapSegs(grp, m).filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.01);
    if (!segs.length) return;
    const others = (lv.obj.cuts || []).filter((c) => c[4] !== g).map((c) => c.slice());
    let ring = null,
      at = null,
      cuts = others;
    if (grp.loop) {
      ring = grp.ring.map((p) => m.get(gk(p[0], p[1])) || p);
      const pl = grPole([grp.ring]),
        f = lv.faces.find((q) => grInFace(q, pl.x, pl.z));
      if (f) at = { fa: f.fa, n: f.n };
      cuts = grClipArea(others, ring);
    }
    segs.forEach((s) => cuts.push([gr2(s[0]), gr2(s[1]), gr2(s[2]), gr2(s[3]), g]));
    grSetCuts(b, lv, cuts, ring);
    if (ring && at) {
      const lv2 = grLv(b),
        pl = grPole([ring]),
        nf = lv2.faces.find((q) => grInFace(q, pl.x, pl.z));
      if (nf) grAttr(b, lv2, nf, at);
    }
    GRS.sel = { k: 'c', g };
  });
}
// Einheiten zusammenfügen: Trennlinien zwischen den gewählten Einheiten entfernen
function grMergeCalc(lv, idx) {
  const cuts = lv.obj.cuts || [],
    pcs = [];
  cuts.forEach((c) => {
    const ts = [],
      L2 = (c[2] - c[0]) ** 2 + (c[3] - c[1]) ** 2;
    cuts.forEach((d) => {
      if (d === c) return;
      const x = grSegT(c, d);
      if (x && x[0] > 0 && x[0] < 1 && x[1] >= -1e-6 && x[1] <= 1 + 1e-6) ts.push(x[0]);
      [
        [d[0], d[1]],
        [d[2], d[3]],
      ].forEach((q) => {
        if (L2 < 1e-9) return;
        const t = ((q[0] - c[0]) * (c[2] - c[0]) + (q[1] - c[1]) * (c[3] - c[1])) / L2;
        if (t > 0 && t < 1 && grDSeg(q[0], q[1], c[0], c[1], c[2], c[3]) < 0.004) ts.push(t);
      });
    });
    grPieces(c, ts).forEach(([a, q]) => pcs.push([a[0], a[1], q[0], q[1], c[4]]));
  });
  const set = new Set(idx);
  let rm = 0;
  const keep = pcs.filter((p) => {
    const dx = p[2] - p[0],
      dz = p[3] - p[1],
      L = Math.hypot(dx, dz);
    if (L < 1e-6) return false;
    const m = [(p[0] + p[2]) / 2, (p[1] + p[3]) / 2],
      nx = (-dz / L) * 0.03,
      nz = (dx / L) * 0.03,
      i1 = lv.faces.findIndex((f) => grInFace(f, m[0] + nx, m[1] + nz)),
      i2 = lv.faces.findIndex((f) => grInFace(f, m[0] - nx, m[1] - nz));
    if (i1 >= 0 && i2 >= 0 && i1 !== i2 && set.has(i1) && set.has(i2)) {
      rm++;
      return false;
    }
    return true;
  });
  if (rm) {
    const anch = (x, z) => lv.bs.some((s) => grDSeg(x, z, s[0], s[1], s[2], s[3]) < 0.012);
    for (let it = 0; it < 60; it++) {
      const deg = new Map();
      keep.forEach((p) => [gk(p[0], p[1]), gk(p[2], p[3])].forEach((k) => deg.set(k, (deg.get(k) || 0) + 1)));
      const n0 = keep.length;
      for (let i = keep.length - 1; i >= 0; i--) {
        const p = keep[i];
        if (
          (deg.get(gk(p[0], p[1])) === 1 && !anch(p[0], p[1])) ||
          (deg.get(gk(p[2], p[3])) === 1 && !anch(p[2], p[3]))
        )
          keep.splice(i, 1);
      }
      if (keep.length === n0) break;
    }
  }
  for (let it = 0; it < 400; it++) {
    let ch = false;
    const m = new Map();
    keep.forEach((p, i) =>
      [gk(p[0], p[1]), gk(p[2], p[3])].forEach((k) => {
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }),
    );
    for (const [k, al] of m) {
      let a = null;
      for (let x = 0; x < al.length && !a; x++)
        for (let y = x + 1; y < al.length; y++)
          if (al[x] !== al[y] && keep[al[x]][4] === keep[al[y]][4]) {
            const P0 = keep[al[x]],
              Q0 = keep[al[y]],
              pe0 = gk(P0[2], P0[3]) === k ? P0 : [P0[2], P0[3], P0[0], P0[1]],
              qs0 = gk(Q0[0], Q0[1]) === k ? Q0 : [Q0[2], Q0[3], Q0[0], Q0[1]],
              e1 = [pe0[2] - pe0[0], pe0[3] - pe0[1]],
              e2 = [qs0[2] - qs0[0], qs0[3] - qs0[1]];
            if (
              Math.abs(e1[0] * e2[1] - e1[1] * e2[0]) < 1e-3 * Math.hypot(...e1) * Math.hypot(...e2) &&
              e1[0] * e2[0] + e1[1] * e2[1] > 0
            ) {
              a = [al[x], al[y]];
              break;
            }
          }
      if (!a) continue;
      const P = keep[a[0]],
        Q = keep[a[1]];
      const pe = gk(P[2], P[3]) === k ? P : [P[2], P[3], P[0], P[1], P[4]],
        qs = gk(Q[0], Q[1]) === k ? Q : [Q[2], Q[3], Q[0], Q[1], Q[4]],
        d1 = [pe[2] - pe[0], pe[3] - pe[1]],
        d2 = [qs[2] - qs[0], qs[3] - qs[1]],
        cr = d1[0] * d2[1] - d1[1] * d2[0],
        dt = d1[0] * d2[0] + d1[1] * d2[1];
      if (Math.abs(cr) < 1e-3 * Math.hypot(...d1) * Math.hypot(...d2) && dt > 0) {
        keep.splice(Math.max(a[0], a[1]), 1);
        keep.splice(Math.min(a[0], a[1]), 1);
        keep.push([pe[0], pe[1], qs[2], qs[3], P[4]]);
        ch = true;
        break;
      }
    }
    if (!ch) break;
  }
  return { cuts: keep.map((c) => [gr2(c[0]), gr2(c[1]), gr2(c[2]), gr2(c[3]), c[4]]), rm };
}
function grMerge(idx) {
  const b = grB();
  if (!b) return;
  const lv = grLv(b),
    F = idx.map((i) => lv.faces[i]).filter(Boolean);
  if (F.length < 2) return;
  const r = grMergeCalc(lv, idx);
  if (!r.rm) {
    grNote('Die gewählten Einheiten grenzen nicht aneinander – nichts zusammengefügt.');
    return;
  }
  const big = F.reduce((a, f) => (f.a > a.a ? f : a)),
    at = { fa: big.fa, n: big.n },
    pt = [big.c[0], big.c[1]];
  grEdit((b) => {
    const lv = grLv(b);
    grSetCuts(b, lv, r.cuts);
    const lv2 = grLv(b),
      nf = lv2.faces.find((f) => grInFace(f, pt[0], pt[1]));
    if (nf) {
      grAttr(b, lv2, nf, at);
      GRS.sel = { k: 'u', i: lv2.faces.indexOf(nf) };
    } else GRS.sel = null;
  });
}
function grNote(t) {
  GRS.note = { t, u: Date.now() + 4500 };
  GRS.dirty = 1;
  try {
    GRS.w.setTimeout(() => {
      GRS.dirty = 1;
    }, 4700);
  } catch (e) {
    logErr(e, 'grNote');
  }
}
function grDelCut(g) {
  grEdit((b) => {
    const lv = grLv(b);
    grSetCuts(
      b,
      lv,
      (lv.obj.cuts || []).filter((c) => c[4] !== g).map((c) => c.slice()),
    );
    GRS.sel = null;
  });
}
// Länge einer Schnittlinie innerhalb der Fläche
function grCutLen(lv, g) {
  const bs = lv.bs.map((s) => [s[0], s[1], s[2], s[3], 1]),
    cs = (lv.obj.cuts || []).filter((c) => c[4] === g).map((c) => [c[0], c[1], c[2], c[3], 2]);
  if (!cs.length) return 0;
  const subs = grSplit(bs.concat(cs));
  let L = 0;
  subs.forEach((s) => {
    if (s[4] === 2 && grEO(bs, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2))
      L += Math.hypot(s[2] - s[0], s[3] - s[1]);
  });
  return L;
}
