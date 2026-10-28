/* v383: LOD 300 – Attikaabdeckung (nur Flachdach): Blechabdeckung mit leichtem Gefälle zum Gebäude, Gehrung an den Ecken, Tropfkanten */
const CAPS = new Map();
function capGeo(b) {
  const R = l2Els(b);
  if (!R || !R.els) return null;
  const flat = !b.roof || !b.roof.type || b.roof.type === 'flat';
  if (!flat) return null;
  const L = grData(b).filter((l) => !l.dg);
  if (!L.length) return null;
  const li = L.length - 1,
    lv = L[li],
    outer = lv.fp && lv.fp.length >= 3 ? lv.fp : lv.faces && lv.faces[0] && lv.faces[0].o;
  if (!outer || outer.length < 3) return null;
  const W = R.els.filter((e) => e.kind === 'AW' && e.li === li && e.hAt && e.quads);
  if (!W.length) return null;
  const Y = W[0].y0 + W[0].h + (W[0].hTop || 0) + W[0].hAt,
    n = outer.length;
  const wall = (p, q) => {
    const mx = (p[0] + q[0]) / 2,
      mz = (p[1] + q[1]) / 2;
    for (const e of W)
      for (const g of e.es || []) {
        if (l2Seg(mx, mz, [g.e.p[0], g.e.p[1], g.e.q[0], g.e.q[1]]) < 0.03) return { d: e.d, sh: e.sh || 0 };
      }
    return { d: W[0].d, sh: W[0].sh || 0 };
  };
  const lnI = (a, da, c, dc) => {
    const det = da[0] * dc[1] - da[1] * dc[0];
    if (Math.abs(det) < 1e-9) return null;
    const t = ((c[0] - a[0]) * dc[1] - (c[1] - a[1]) * dc[0]) / det;
    return [a[0] + da[0] * t, a[1] + da[1] * t];
  };
  const offR = (rg, dd) => {
    let A = 0;
    rg.forEach((p, i) => {
      const q = rg[(i + 1) % n];
      A += p[0] * q[1] - q[0] * p[1];
    });
    const sg = A > 0 ? 1 : -1,
      Ls = rg.map((p, i) => {
        const q = rg[(i + 1) % n],
          dx = q[0] - p[0],
          dz = q[1] - p[1],
          ln = Math.hypot(dx, dz) || 1,
          d1 = dd(p, q);
        return { p: [p[0] + (-dz / ln) * sg * d1, p[1] + (dx / ln) * sg * d1], d: [dx, dz] };
      });
    return rg.map((p, i) => {
      const a = Ls[(i + n - 1) % n],
        c = Ls[i],
        r = lnI(a.p, a.d, c.p, c.d);
      return r || c.p;
    });
  };
  const OUT = offR(outer, (p, q) => -(wall(p, q).sh + 0.03)),
    INN = offR(outer, (p, q) => wall(p, q).d - wall(p, q).sh + 0.02);
  return { Y, O: OUT, I: INN };
}
function capMesh(c) {
  const n = c.O.length,
    t = 0.006,
    ap = 0.05,
    ap2 = 0.035,
    tn = Math.tan((2.2 * Math.PI) / 180),
    P = [],
    Ix = [];
  const prof = (w) => {
    const tw = w * tn;
    return [
      [0, -ap],
      [0, 0],
      [w, -tw],
      [w, -tw - ap2],
      [w - t, -tw - ap2],
      [w - t, -tw - t],
      [t, -t],
      [t, -ap],
    ];
  };
  const rows = c.O.map((o, i) => {
    const e = c.I[i],
      w = Math.hypot(e[0] - o[0], e[1] - o[1]) || 0.1,
      ux = (e[0] - o[0]) / w,
      uz = (e[1] - o[1]) / w,
      pf = prof(w),
      tw = w * tn;
    return pf.map(([x, y]) => [o[0] + ux * x, c.Y + t + tw + y, o[1] + uz * x]);
  });
  for (let i = 0; i < n; i++) {
    const a = rows[i],
      b = rows[(i + 1) % n];
    for (let j = 0; j < 8; j++) {
      const j2 = (j + 1) % 8,
        k = P.length / 3;
      P.push(...a[j], ...a[j2], ...b[j], ...b[j2]);
      Ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
  g.setIndex(Ix);
  g.computeVertexNormals();
  const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x9aa1a8, side: T.DoubleSide }));
  m.castShadow = true;
  m.receiveShadow = true;
  m.raycast = () => {};
  m.userData.cap = 1;
  return m;
}
function capSync() {
  try {
    const on = l23() && l2on();
    if (!on) {
      for (const it of CAPS.values()) {
        G.l2.remove(it.m);
        it.m.geometry.dispose();
        it.m.material.dispose();
      }
      CAPS.clear();
      return;
    }
    const seen = new Set();
    for (const b of S.bld) {
      if (b.ex || b._y == null) continue;
      const R = l2Els(b),
        sig =
          R && R.k + '|' + ((b.roof && b.roof.type) || 'flat') + '|' + (S.l2 && JSON.stringify(S.l2.defs));
      seen.add(b.id);
      const old = CAPS.get(b.id);
      if (old && old.sig === sig) continue;
      if (old) {
        G.l2.remove(old.m);
        old.m.geometry.dispose();
        old.m.material.dispose();
        CAPS.delete(b.id);
      }
      const c = capGeo(b);
      if (!c) continue;
      const m = capMesh(c);
      G.l2.add(m);
      CAPS.set(b.id, { m, sig });
    }
    for (const [id, it] of CAPS)
      if (!seen.has(id)) {
        G.l2.remove(it.m);
        it.m.geometry.dispose();
        it.m.material.dispose();
        CAPS.delete(id);
      }
  } catch (e) {
    console.warn('Attika', e);
  }
}
setInterval(capSync, 300);
