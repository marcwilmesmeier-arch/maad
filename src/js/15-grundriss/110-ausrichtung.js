// ---- Ausrichtung (Nordpfeil-Klick richtet den Grundriss an der längsten Seite waagerecht aus) und Abbildung
const grNorm = (a) => {
  while (a > Math.PI / 2) a -= Math.PI;
  while (a <= -Math.PI / 2) a += Math.PI;
  return a;
};
function grAxis(b) {
  const L = grData(b);
  if (L._ax != null) return L._ax;
  let bl = 0,
    a = 0;
  L.forEach((lv) => {
    if (lv.dg) return;
    lv.bs.forEach((s) => {
      const l = Math.hypot(s[2] - s[0], s[3] - s[1]);
      if (l > bl + 1e-6) {
        bl = l;
        a = Math.atan2(s[3] - s[1], s[2] - s[0]);
      }
    });
  });
  return (L._ax = grNorm(a));
}
GRS.r = 0;
GRS.rt = 0;
GRS.W = 800;
GRS.H = 600;
function grTf(x, z) {
  const v = GRS.view,
    c = Math.cos(GRS.r),
    s = Math.sin(GRS.r),
    dx = x - v.x,
    dz = z - v.z;
  return [(dx * c - dz * s) * v.s + GRS.W / 2, (dx * s + dz * c) * v.s + GRS.H / 2];
}
function grInv(sx, sy) {
  const v = GRS.view,
    c = Math.cos(GRS.r),
    s = Math.sin(GRS.r),
    a = (sx - GRS.W / 2) / v.s,
    b = (sy - GRS.H / 2) / v.s;
  return [v.x + a * c + b * s, v.z - a * s + b * c];
}
function grRotGo() {
  if (GRS.ra || !GRS.w) return;
  const w = GRS.w;
  let t0 = w.performance.now();
  const st = () => {
    const n_ = w.performance.now(),
      dt = Math.min(0.25, (n_ - t0) / 1000);
    t0 = n_;
    let d = GRS.rt - GRS.r;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < 2e-3) {
      GRS.r = GRS.rt;
      GRS.ra = 0;
      GRS.dirty = 1;
      try {
        grDraw();
      } catch (e) {
        logErr(e, 'st');
      }
      return;
    }
    GRS.r += d * (1 - Math.exp(-dt * 11));
    try {
      grDraw();
    } catch (e) {
      logErr(e, 'st');
    }
    GRS.ra = w.requestAnimationFrame(st);
  };
  GRS.ra = w.requestAnimationFrame(st);
}
function grAlignSync(b, now) {
  const t = S.gro.al && b ? -grAxis(b) : 0;
  if (Math.abs(t - GRS.rt) > 1e-6) {
    GRS.rt = t;
    if (now) {
      GRS.r = t;
      GRS.dirty = 1;
    } else grRotGo();
  }
}
function grFit() {
  const b = grB(),
    cw = gD('grCw');
  if (!b || !cw) return;
  const L = grData(b),
    c = Math.cos(GRS.rt),
    s = Math.sin(GRS.rt);
  let u0 = 1e9,
    u1 = -1e9,
    w0 = 1e9,
    w1 = -1e9;
  L.forEach((lv) =>
    lv.bs.forEach((q) => {
      for (const [x, z] of [
        [q[0], q[1]],
        [q[2], q[3]],
      ]) {
        const u = x * c - z * s,
          w = x * s + z * c;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        w0 = Math.min(w0, w);
        w1 = Math.max(w1, w);
      }
    }),
  );
  if (u0 > u1) return;
  const W = Math.max(100, cw.clientWidth),
    H = Math.max(100, cw.clientHeight),
    sc = Math.min((W - 110) / Math.max(1, u1 - u0), (H - 110) / Math.max(1, w1 - w0)),
    uc = (u0 + u1) / 2,
    wc = (w0 + w1) / 2;
  GRS.view = { x: uc * c + wc * s, z: -uc * s + wc * c, s: Math.max(0.5, Math.min(400, sc)) };
  GRS.fit = b.id;
  GRS.dirty = 1;
}
// Kanten/Ecken der Zerlegung (Fangziele)
function grEdges(lv) {
  // ── Erweiterung aus 22-lod200-waende/050-panel.js
  // ---- Fangpunkte in LOD 200: an beiden Außenkanten der Wände (Ecken und Kanten statt Mittellinien)
  const on = l2on();
  if (lv._ed && lv._l2s !== on) {
    lv._ed = null;
    lv._vt = null;
  }
  const had = !!lv._ed,
    r = grEdgesBasis.call(this, lv);
  if (!had) {
    lv._l2s = on;
    if (on && !lv.dg) {
      try {
        const b = grB();
        if (b && b._y != null) {
          const w = l2Els(b).els.filter((e) => e.li === lv.i && e.quads);
          if (w.length) {
            const ed = [],
              vt = [],
              seen = new Set();
            w.forEach((e) =>
              e.quads.forEach((q) =>
                q.forEach((p, i) => {
                  const n = q[(i + 1) % q.length];
                  ed.push([p[0], p[1], n[0], n[1]]);
                  const k = l2k(p);
                  if (!seen.has(k)) {
                    seen.add(k);
                    vt.push([p[0], p[1]]);
                  }
                }),
              ),
            );
            const vs2 = r.length ? lv._vt : [];
            const sv = new Set(lv._vt.map(l2k));
            vt.forEach((v) => {
              if (!sv.has(l2k(v))) lv._vt.push(v);
            });
            lv._ed = r.concat(ed);
            return lv._ed;
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }
  return r;
}
// grEdges() ohne die Erweiterungen darüber – wird von grEdges() gezielt aufgerufen
function grEdgesBasis(lv) {
  if (lv._ed) return lv._ed;
  const e = [],
    vt = [],
    seen = new Set();
  lv.faces.forEach((f) =>
    [f.o].concat(f.h).forEach((r) =>
      r.forEach((p, i) => {
        const q = r[(i + 1) % r.length];
        e.push([p[0], p[1], q[0], q[1]]);
        const k = GRK(p[0]) + ',' + GRK(p[1]);
        if (!seen.has(k)) {
          seen.add(k);
          vt.push(p);
        }
      }),
    ),
  );
  lv._vt = vt;
  return (lv._ed = e);
}
// ---- Objektfang: Ecken, Spurlinien (waagerecht/senkrecht/45° der Ansicht), Spur von Ecken, rechtwinklig/45° zur Wand, Lotfuß, Kante, Raster
const GRPX = 12;
function grSnap(p, shift, lv, mode) {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js
  // ---- Raster als Zeichenhilfe in der normalen Grundrissbearbeitung (Reiter Anzeige): Modul, Tragachsen, Ursprung/Richtung, Einrasten
  const r = (() => {
    const s = GRS.view.s,
      tol = GRPX / s,
      tg = 9 / s,
      ed = grEdges(lv),
      vt = lv._vt,
      res = { x: p.x, z: p.z, t: null, gd: [], arc: null };
    let bd = tol,
      bv = null;
    vt.forEach((q) => {
      const d = Math.hypot(q[0] - p.x, q[1] - p.z);
      if (d < bd) {
        bd = d;
        bv = q;
      }
    });
    if (bv) {
      res.x = bv[0];
      res.z = bv[1];
      res.t = 'p';
      return res;
    }
    const O =
      mode === 'line'
        ? GRS.pts.length
          ? { x: GRS.pts[GRS.pts.length - 1][0], z: GRS.pts[GRS.pts.length - 1][1] }
          : null
        : mode === 'rect' && GRS.rect
          ? GRS.rect.a
          : null;
    const th0 = -GRS.r,
      gd = [],
      add = (ox, oz, a, k, lab, wa) => {
        a = ((a % Math.PI) + Math.PI) % Math.PI;
        const g = gd.find((q) => {
          const dd = (((q.a - a) % Math.PI) + Math.PI) % Math.PI;
          return (
            (dd < 1e-3 || Math.PI - dd < 1e-3) &&
            Math.abs((q.ox - ox) * Math.sin(a) - (q.oz - oz) * Math.cos(a)) < 1e-6
          );
        });
        if (g) {
          if (wa != null && g.wa == null) {
            g.wa = wa;
            g.k = k;
            g.lab = lab;
          }
          return;
        }
        gd.push({ ox, oz, a, k, lab, wa });
      };
    if (O && S.gro.trk) {
      const lab = ['waagerecht', '45°', 'senkrecht', '45°'];
      for (let k = 0; k < 4; k++) {
        if (mode === 'rect' && k % 2 === 0) continue;
        add(O.x, O.z, th0 + (k * Math.PI) / 4, 'pol', lab[k]);
      }
      if (mode === 'line') {
        const wa = [];
        for (const e of ed) {
          if (grDSeg(O.x, O.z, e[0], e[1], e[2], e[3]) < 0.01) {
            const a = Math.atan2(e[3] - e[1], e[2] - e[0]);
            if (
              !wa.some(
                (q) =>
                  Math.abs((((q - a) % Math.PI) + Math.PI) % Math.PI) < 1e-3 ||
                  Math.abs(((((q - a) % Math.PI) + Math.PI) % Math.PI) - Math.PI) < 1e-3,
              )
            )
              wa.push(a);
          }
        }
        wa.forEach((a) => {
          for (let k = 0; k < 4; k++) add(O.x, O.z, a + (k * Math.PI) / 4, 'wal', '', a);
        });
      }
    }
    if (S.gro.trk)
      for (const q of vt) {
        if (O && Math.hypot(q[0] - O.x, q[1] - O.z) < 1e-6) continue;
        for (let k = 0; k < 2; k++) {
          const a = th0 + (k * Math.PI) / 2,
            dx = Math.cos(a),
            dz = Math.sin(a),
            dist = Math.abs((p.x - q[0]) * dz - (p.z - q[1]) * dx);
          if (dist < tg) add(q[0], q[1], a, 'trk', 'Spur');
        }
      }
    const dist = (g) => Math.abs((p.x - g.ox) * Math.sin(g.a) - (p.z - g.oz) * Math.cos(g.a)),
      act = gd.filter((g) => dist(g) < tg).sort((a, b) => dist(a) - dist(b));
    const isect = (g, h) => {
      const d = Math.cos(g.a) * Math.sin(h.a) - Math.sin(g.a) * Math.cos(h.a);
      if (Math.abs(d) < 1e-6) return null;
      const t = ((h.ox - g.ox) * Math.sin(h.a) - (h.oz - g.oz) * Math.cos(h.a)) / d;
      return [g.ox + Math.cos(g.a) * t, g.oz + Math.sin(g.a) * t];
    };
    const nm = (a) => {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a <= -Math.PI) a += 2 * Math.PI;
      return a;
    };
    const fin = (x, z, t, gs) => {
      res.x = x;
      res.z = z;
      res.t = t;
      res.gd = gs;
      const w = O && mode === 'line' ? gs.find((g) => g.wa != null) : null;
      if (w && Math.hypot(x - O.x, z - O.z) > 1e-6) {
        const d = Math.atan2(z - O.z, x - O.x),
          d1 = nm(d - w.wa),
          d2 = nm(d - w.wa - Math.PI),
          f1_ = Math.abs(d1) <= Math.abs(d2),
          df = f1_ ? d1 : d2,
          pd = (Math.abs(df) * 180) / Math.PI;
        if (Math.abs(pd - 45) < 0.6 || Math.abs(pd - 90) < 0.6)
          res.arc = { c: [O.x, O.z], a0: f1_ ? w.wa : w.wa + Math.PI, df, psi: Math.round(pd / 45) * 45 };
      }
      return res;
    };
    // Kantenfang-Kandidat
    let E = null,
      ed_ = tol;
    for (const e of ed) {
      const dx = e[2] - e[0],
        dz = e[3] - e[1],
        L2 = dx * dx + dz * dz;
      if (L2 < 1e-9) continue;
      let t = ((p.x - e[0]) * dx + (p.z - e[1]) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const x = e[0] + dx * t,
        z = e[1] + dz * t,
        d = Math.hypot(x - p.x, z - p.z);
      if (d < ed_) {
        ed_ = d;
        E = { x, z };
      }
    }
    if (shift && O && mode === 'line' && gd.length) {
      const d = Math.atan2(p.z - O.z, p.x - O.x);
      let g0 = null,
        bb = 9;
      gd.forEach((g) => {
        if (g.k === 'trk') return;
        let df = (((d - g.a) % Math.PI) + Math.PI) % Math.PI;
        df = Math.min(df, Math.PI - df);
        if (df < bb) {
          bb = df;
          g0 = g;
        }
      });
      if (g0) {
        const t = (p.x - O.x) * Math.cos(g0.a) + (p.z - O.z) * Math.sin(g0.a);
        return fin(O.x + Math.cos(g0.a) * t, O.z + Math.sin(g0.a) * t, 'g', [g0]);
      }
    }
    // zwei Spuren: Schnittpunkt
    if (act.length >= 2) {
      let best = null,
        bdd = tol * 1.7;
      for (let i = 0; i < act.length; i++)
        for (let j = i + 1; j < act.length; j++) {
          const q = isect(act[i], act[j]);
          if (!q) continue;
          const d = Math.hypot(q[0] - p.x, q[1] - p.z);
          if (d < bdd) {
            bdd = d;
            best = { q, g: [act[i], act[j]] };
          }
        }
      if (best) return fin(best.q[0], best.q[1], 'x', best.g);
    }
    if (act.length) {
      const g = act[0];
      let bx = null,
        bw = tol;
      for (const e of ed) {
        const h = { ox: e[0], oz: e[1], a: Math.atan2(e[3] - e[1], e[2] - e[0]) },
          q = isect(g, h);
        if (!q) continue;
        const L = Math.hypot(e[2] - e[0], e[3] - e[1]),
          t = ((q[0] - e[0]) * (e[2] - e[0]) + (q[1] - e[1]) * (e[3] - e[1])) / (L * L);
        if (t < -1e-6 || t > 1 + 1e-6) continue;
        const d = Math.hypot(q[0] - p.x, q[1] - p.z);
        if (d < bw) {
          bw = d;
          bx = q;
        }
      }
      if (bx) return fin(bx[0], bx[1], 'x', [g]);
      if (!E) {
        let t = (p.x - g.ox) * Math.cos(g.a) + (p.z - g.oz) * Math.sin(g.a);
        if (S.gro.gs && g.k !== 'trk' && O) t = Math.round(t * 20) / 20;
        return fin(g.ox + Math.cos(g.a) * t, g.oz + Math.sin(g.a) * t, 'g', [g]);
      }
    }
    // Lotfuß von der Startecke auf eine Wand
    if (O && mode === 'line' && S.gro.trk) {
      let bp = null,
        bq = tol;
      for (const e of ed) {
        const dx = e[2] - e[0],
          dz = e[3] - e[1],
          L2 = dx * dx + dz * dz;
        if (L2 < 1e-9) continue;
        const t = ((O.x - e[0]) * dx + (O.z - e[1]) * dz) / L2;
        if (t < 0 || t > 1) continue;
        const x = e[0] + dx * t,
          z = e[1] + dz * t;
        if (Math.hypot(x - O.x, z - O.z) < 0.02) continue;
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bq) {
          bq = d;
          bp = [x, z];
        }
      }
      if (bp) {
        res.x = bp[0];
        res.z = bp[1];
        res.t = 'perp';
        res.gd = [
          {
            ox: O.x,
            oz: O.z,
            a: ((Math.atan2(bp[1] - O.z, bp[0] - O.x) % Math.PI) + Math.PI) % Math.PI,
            k: 'perp',
            lab: '⊥ Wand',
          },
        ];
        return res;
      }
    }
    if (E) {
      res.x = E.x;
      res.z = E.z;
      res.t = 'e';
      return res;
    }
    if (S.gro.gs) {
      res.x = Math.round(p.x * 20) / 20;
      res.z = Math.round(p.z * 20) / 20;
    }
    return res;
  })();
  try {
    const R = S.mx.ras;
    if (R.draw && R.dsnap !== 0 && !r.t && !shift) {
      const b = grB(),
        fr = mxFrame(b, lv),
        m = R.mod || 1.25,
        q = mxRot([p.x, p.z], fr.th),
        u = fr.r[0] + Math.round((q[0] - fr.r[0]) / m) * m,
        v = fr.r[1] + Math.round((q[1] - fr.r[1]) / m) * m,
        tol = (GRPX / GRS.view.s) * 1.2,
        du = Math.abs(q[0] - u),
        dv = Math.abs(q[1] - v),
        nu = du < tol,
        nv = dv < tol;
      if (nu || nv) {
        const w = mxBack([nu ? u : q[0], nv ? v : q[1]], fr.th);
        r.x = w[0];
        r.z = w[1];
        r.t = nu && nv ? 'p' : 'g';
        if (!(nu && nv)) r.gd = [];
      }
    }
  } catch (e) {
    logErr(e, 'grSnap');
  }
  return r;
}
