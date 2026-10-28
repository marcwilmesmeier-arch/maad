// ---- v386: Ansichten nach Himmelsrichtung mit Schnittebene 0,5 m vor der äußersten Wand; sichtbare Flächen (inkl. schräger) mit Verdeckung
function fwClip(poly, a, b, c, keep) {
  const o = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      dp = (a * p[0] + b * p[1] + c) * keep,
      dq = (a * q[0] + b * q[1] + c) * keep;
    if (dp >= 0) o.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
      const t = dp / (dp - dq);
      o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return o;
}
function fvPA(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      c = r[(i + 1) % r.length];
    s += a[0] * c[1] - c[0] * a[1];
  }
  return s / 2;
}
function fvCCW(r) {
  return fvPA(r) < 0 ? r.slice().reverse() : r;
}
function fvInter(B, A) {
  let r = B;
  for (let i = 0; i < A.length && r.length > 2; i++) {
    const p = A[i],
      q = A[(i + 1) % A.length];
    r = fwClip(r, -(q[1] - p[1]), q[0] - p[0], (q[1] - p[1]) * p[0] - (q[0] - p[0]) * p[1], 1);
  }
  return r;
}
function fvSubt(B, A) {
  const out = [];
  let r = B;
  for (let i = 0; i < A.length && r.length > 2; i++) {
    const p = A[i],
      q = A[(i + 1) % A.length],
      a = -(q[1] - p[1]),
      b = q[0] - p[0],
      c = (q[1] - p[1]) * p[0] - (q[0] - p[0]) * p[1];
    const o = fwClip(r, a, b, c, -1);
    if (o.length > 2 && Math.abs(fvPA(o)) > 1e-4) out.push(o);
    r = fwClip(r, a, b, c, 1);
  }
  return out;
}
function fdViews(b) {
  const sg = fdSig(b);
  if (b._fv && b._fv.s === sg) return b._fv.V;
  const P = fdPieces(b),
    cl = [];
  P.slice()
    .sort((a, c) => c.ar - a.ar)
    .forEach((p) => {
      p.ang = fdAng(p.nx, p.nz);
      let c = cl.find((q) => fdAD(q.ang, p.ang) <= 15);
      if (!c) {
        c = { ang: p.ang, sx: 0, sz: 0, ps: [] };
        cl.push(c);
      }
      c.ps.push(p);
      c.sx += p.nx * p.ar;
      c.sz += p.nz * p.ar;
      c.ang = fdAng(c.sx, c.sz);
    });
  while (cl.length > 10) {
    let bi = 0,
      bj = 1,
      bd = 1e9;
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++) {
        const d = fdAD(cl[i].ang, cl[j].ang);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
    const a = cl[bi],
      c = cl[bj];
    a.ps = a.ps.concat(c.ps);
    a.sx += c.sx;
    a.sz += c.sz;
    a.ang = fdAng(a.sx, a.sz);
    cl.splice(bj, 1);
  }
  // sehr kleine Gruppen (z. B. schräge Dachwände) der nächstliegenden Richtung zuschlagen
  {
    cl.forEach((c) => {
      c.ar = c.ps.reduce((t, p) => t + p.ar, 0);
    });
    const T = cl.reduce((s, c) => s + c.ar, 0);
    for (let k = 0; k < cl.length && cl.length > 1;) {
      const c = cl[k];
      if (c.ar < Math.max(3, T * 0.02)) {
        let bi = -1,
          bd = 35;
        cl.forEach((o, j) => {
          if (j === k || o.ar < c.ar) return;
          const d = fdAD(o.ang, c.ang);
          if (d < bd) {
            bd = d;
            bi = j;
          }
        });
        if (bi >= 0) {
          const o = cl[bi];
          o.ps = o.ps.concat(c.ps);
          o.sx += c.sx;
          o.sz += c.sz;
          o.ar += c.ar;
          o.ang = fdAng(o.sx, o.sz);
          cl.splice(k, 1);
          continue;
        }
      }
      k++;
    }
  }
  cl.sort((a, c) => a.ang - c.ang);
  const V = cl
    .map((c) => {
      const L = Math.hypot(c.sx, c.sz) || 1,
        nx = c.sx / L,
        nz = c.sz / L,
        tx = nz,
        tz = -nx,
        dir = xlDir(nx, nz);
      const own = new Set(c.ps);
      // alle von dieser Richtung sichtbaren (zugewandten) Teilflächen, in Ansichtskoordinaten (u,v) mit Tiefenebene s=a·u+b·v+c0
      const C = [];
      P.forEach((p) => {
        const dt = p.nx * nx + p.nz * nz;
        if (dt <= 0.05 && !own.has(p)) return;
        const ring = p.pts.map((q) => [q[0] * tx + q[1] * tz, q[2]]),
          ss = p.pts.map((q) => q[0] * nx + q[1] * nz);
        let bi = 1,
          bj = 2,
          ba = 0;
        for (let x = 1; x < ring.length; x++)
          for (let y = x + 1; y < ring.length; y++) {
            const ar = Math.abs(
              (ring[x][0] - ring[0][0]) * (ring[y][1] - ring[0][1]) -
                (ring[y][0] - ring[0][0]) * (ring[x][1] - ring[0][1]),
            );
            if (ar > ba) {
              ba = ar;
              bi = x;
              bj = y;
            }
          }
        let a = 0,
          bb = 0;
        if (ba > 1e-9) {
          const du1 = ring[bi][0] - ring[0][0],
            dv1 = ring[bi][1] - ring[0][1],
            du2 = ring[bj][0] - ring[0][0],
            dv2 = ring[bj][1] - ring[0][1],
            ds1 = ss[bi] - ss[0],
            ds2 = ss[bj] - ss[0],
            de = du1 * dv2 - du2 * dv1;
          a = (ds1 * dv2 - ds2 * dv1) / de;
          bb = (du1 * ds2 - du2 * ds1) / de;
        }
        const c0 = ss[0] - a * ring[0][0] - bb * ring[0][1];
        C.push({ p, own: own.has(p), ring: fvCCW(ring), a, b: bb, c0, frag: null });
      });
      const sAt = (q, u, v) => q.a * u + q.b * v + q.c0;
      C.forEach((B) => {
        let fr = [B.ring];
        C.forEach((A) => {
          if (A === B || !fr.length) return;
          const O = fvInter(B.ring, A.ring);
          if (O.length < 3 || Math.abs(fvPA(O)) < 1e-4) return;
          let cu = 0,
            cv = 0;
          O.forEach((q) => {
            cu += q[0] / O.length;
            cv += q[1] / O.length;
          });
          if (sAt(A, cu, cv) <= sAt(B, cu, cv) + 0.02) return;
          const nf = [];
          fr.forEach((f) => {
            const I = fvInter(f, A.ring);
            if (I.length < 3 || Math.abs(fvPA(I)) < 1e-5) nf.push(f);
            else fvSubt(f, A.ring).forEach((x) => nf.push(x));
          });
          fr = nf;
        });
        B.frag = fr;
      });
      const O = C.filter((q) => q.own),
        X = C.filter((q) => !q.own);
      if (!O.some((q) => q.frag.length)) return null;
      const pcs = [],
        rings = [];
      O.forEach((q) => {
        const p = q.p;
        let bi = 0,
          bj = 1,
          bd = -1;
        for (let x = 0; x < p.pts.length; x++)
          for (let y = x + 1; y < p.pts.length; y++) {
            const dd = Math.hypot(p.pts[y][0] - p.pts[x][0], p.pts[y][1] - p.pts[x][1]);
            if (dd > bd) {
              bd = dd;
              bi = x;
              bj = y;
            }
          }
        const A = p.pts[bi],
          B = p.pts[bj],
          dl = bd || 1,
          dx = (B[0] - A[0]) / dl,
          dz = (B[1] - A[1]) / dl,
          pd = p.pts.reduce((s, r) => s + r[0] * nx + r[1] * nz, 0) / p.pts.length;
        q.frag.forEach((f) => {
          rings.push(f);
          pcs.push({
            ring: f,
            ax: A[0],
            az: A[1],
            dx,
            dz,
            ua: A[0] * tx + A[1] * tz,
            dot: dx * tx + dz * tz || 1,
            lv: p.lv,
            dp: p.lv === 'roof' ? null : pd,
            pd: pd,
          });
        });
      });
      const ctx = [];
      X.forEach((q) => q.frag.forEach((f) => ctx.push(f)));
      let u0 = 1e9,
        u1 = -1e9,
        v0 = 1e9,
        v1 = -1e9;
      rings.forEach((r) =>
        r.forEach((q) => {
          u0 = Math.min(u0, q[0]);
          u1 = Math.max(u1, q[0]);
          v0 = Math.min(v0, q[1]);
          v1 = Math.max(v1, q[1]);
        }),
      );
      const sMax = Math.max(...c.ps.map((p) => Math.max(...p.pts.map((q) => q[0] * nx + q[1] * nz))));
      return {
        dir,
        ang: c.ang,
        n: [nx, nz],
        pcs,
        ctx,
        cut: sMax + 0.5,
        bs: grBoundOf(rings),
        rings,
        u0,
        u1,
        v0,
        v1,
        area: rings.reduce((s, r) => s + fdArea2(r), 0),
      };
    })
    .filter(Boolean);
  const cnt = {};
  V.forEach((v) => (cnt[v.dir] = (cnt[v.dir] || 0) + 1));
  const seen = {};
  V.forEach((v) => {
    if (cnt[v.dir] > 1) {
      seen[v.dir] = (seen[v.dir] || 0) + 1;
      v.key = v.dir + seen[v.dir];
      v.name = (XLDN[v.dir] || v.dir) + ' ' + seen[v.dir] + ' (' + Math.round(v.ang) + '°)';
    } else {
      v.key = v.dir;
      v.name = 'Ansicht ' + (XLDN[v.dir] || v.dir);
    }
  });
  b._fv = { s: sg, V };
  return V;
}
function fdViewAt(b, nx, nz, x, z, md) {
  const V = fdViews(b);
  let best = null,
    sc = 1e9;
  for (const v of V) {
    const d = v.n[0] * nx + v.n[1] * nz;
    if (d <= md) continue;
    const u = x * v.n[1] + z * -v.n[0];
    if (u < v.u0 - 0.1 || u > v.u1 + 0.1) continue;
    let dp = 1e9;
    for (const p of v.pcs) {
      if (p.pd == null) continue;
      dp = Math.min(dp, Math.abs(p.pd - (x * v.n[0] + z * v.n[1])));
    }
    const q = dp + (1 - d) * 10;
    if (q < sc) {
      sc = q;
      best = v;
    }
  }
  if (best) return best;
  let bd = md;
  V.forEach((v) => {
    const d = v.n[0] * nx + v.n[1] * nz;
    if (d > bd) {
      bd = d;
      best = v;
    }
  });
  return best;
}
const fdB = () => S.bld.find((x) => x.id === FDS.bid && !x.ex) || null;
const fdVw = (b, k) => fdViews(b).find((v) => v.key === k) || null;
const fdD = (b, k, mk) => {
  if (!b.fd) {
    if (!mk) return null;
    b.fd = {};
  }
  let d = b.fd[k];
  if (!d) {
    if (!mk) return null;
    d = b.fd[k] = { cuts: [], units: [] };
  }
  return d;
};
// Felder (Ansichtsflächen) einer Ansicht: Schnittlinien teilen die Fläche, Einheiten tragen den Fassadentyp
// Automatische Flächen: zusammenhängende Teile der Ansicht, die in einer Ebene liegen (gleiche Tiefe, ca. 10 cm), sind je eine Fläche und lassen sich weiter unterteilen
function fdGroups(V) {
  if (V._g !== undefined) return V._g;
  let r = null;
  try {
    const P = (V.pcs || []).filter((p) => p.ring && p.ring.length > 2 && p.pd != null);
    if (P.length > 1) {
      const ks = [...new Set(P.map((p) => Math.round(p.pd / 0.05)))].sort((a, c) => a - c),
        gk = new Map();
      let gi = 0;
      ks.forEach((k, i) => {
        if (i && k - ks[i - 1] > 1) gi++;
        gk.set(k, gi);
      });
      if (gi > 0) {
        const G = [];
        P.forEach((p) => {
          const g = gk.get(Math.round(p.pd / 0.05));
          (G[g] = G[g] || []).push(p.ring);
        });
        r = G.filter(Boolean)
          .map((rs) => ({ rings: rs, bs: grBoundOf(rs) }))
          .filter((g) => g.bs.length > 2);
      }
    }
  } catch (e) {
    console.warn('fdGroups', e);
  }
  V._g = r && r.length > 1 ? r : null;
  return V._g;
}
function fdFaces(b, V) {
  const d = fdD(b, V.key),
    sg = JSON.stringify(d ? [d.cuts, d.units] : 0);
  if (V._f && V._f.s === sg) return V._f.F;
  const cuts = d ? d.cuts.map((c) => c.slice(0, 4)) : [],
    gs = fdGroups(V);
  let F;
  if (!gs) F = grFaces(V.bs, cuts);
  else {
    F = [];
    gs.forEach((g) => grFaces(g.bs, cuts).forEach((f) => F.push(f)));
    F.sort((p, q) => p.c[1] - q.c[1] || p.c[0] - q.c[0]);
  }
  F.forEach((f, i) => {
    const un = d && d.units.find((q) => q && q.p && grInFace(f, q.p[0], q.p[1]));
    f.t = un && un.t && S.ft.some((t) => t.k === un.t) ? un.t : 'ohne';
    f.n = (un && un.n) || '';
    f.idx = i + 1;
  });
  V._f = { s: sg, F };
  return F;
}
function fdStats(b) {
  const R = { t: {}, tot: 0, rows: [], cust: false };
  fdViews(b).forEach((V) => {
    const d = fdD(b, V.key);
    if (d && (d.cuts.length || d.units.length)) R.cust = true;
    fdFaces(b, V).forEach((f) => {
      const r = R.t[f.t] || (R.t[f.t] = { a: 0, n: 0 });
      r.a += f.a;
      r.n++;
      R.tot += f.a;
      R.rows.push({ vk: V.key, vn: V.name, idx: f.idx, t: f.t, n: f.n, a: f.a });
    });
  });
  return R;
}
