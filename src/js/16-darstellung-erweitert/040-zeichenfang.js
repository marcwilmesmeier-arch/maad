// ---- v243: Zeichenfang – Hauptachse aus der Grundriss-Ausrichtung (auch in 3D), waagerechte/senkrechte Fanglinien,
//      45°/90° zur Kontur, Objektfang (Ecke · Kantenmitte · Kante · Lotfuß · Schnitt), auch beim Verschieben vorhandener Konturpunkte
S.fang = Object.assign({ g: true, d45: true, mid: true }, S.fang || {});
const FGK = { k: '', a: null };
const fgNA = (a) => {
  while (a > Math.PI / 2) a -= Math.PI;
  while (a <= -Math.PI / 2) a += Math.PI;
  return a;
};
const fgPA = (a, b) => {
  let d = (((a - b) % Math.PI) + Math.PI) % Math.PI;
  return Math.min(d, Math.PI - d);
};
function fgEdgeAxis(f) {
  let bl = 0,
    a = 0;
  for (let j = 0; j < f.length; j++) {
    const p = f[j],
      q = f[(j + 1) % f.length],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > bl + 1e-6) {
      bl = l;
      a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
  }
  return fgNA(a);
}
function fgBld() {
  try {
    if (typeof GRS !== 'undefined' && GRS.bid) {
      const b = S.bld.find((x) => x.id === GRS.bid && !x.ex);
      if (b) return b;
    }
  } catch (e) {
    logErr(e, 'fgBld');
  }
  const s = S.sel;
  if (s && !s.ex && s.levels && S.bld.includes(s)) return s;
  return S.bld.find((b) => !b.ex && b.levels && b.levels.length) || null;
}
function fgParcel() {
  const p = (S.par && S.par.poly) || (P.find((a) => a.site) || {}).poly;
  return p && p.length > 2 ? p : null;
}
// Hauptachse: nur wenn der Grundriss an der längsten Seite ausgerichtet ist (Nordpfeil / Layer), sonst wie bisher (2D: Ansicht, 3D: Norden)
function fangAxis() {
  if (!(S.gro && S.gro.al)) return null;
  const sg = (f) => f.map((q) => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(';'),
    b = fgBld();
  let f,
    k,
    a = null;
  if (b) {
    f = cfp(b);
    k = 'b' + b.id + '|' + sg(f);
    if (FGK.k === k) return FGK.a;
    try {
      a = grAxis(b);
    } catch (e) {
      logErr(e, 'fangAxis');
    }
    if (a == null || !isFinite(a)) a = fgEdgeAxis(f);
    FGK.k = k;
    FGK.a = a;
    return a;
  }
  f = fgParcel();
  if (f) {
    k = 'p|' + sg(f);
    if (FGK.k === k) return FGK.a;
    a = fgEdgeAxis(f);
    FGK.k = k;
    FGK.a = a;
    return a;
  }
  return null;
}
const fgBase = () => {
  const a = fangAxis();
  return a != null ? a : drRot();
};
function fgEdges(A, i) {
  const E = [],
    add = (f) => {
      if (!f || f.length < 2) return;
      for (let j = 0; j < f.length; j++) {
        const p = f[j],
          q = f[(j + 1) % f.length];
        if (p && q) E.push([p[0], p[1], q[0], q[1]]);
      }
    };
  P.concat(AL).forEach((a) => add(a.poly));
  S.ex.forEach((b) => add(b.fp));
  S.bld.forEach((b) => {
    const f = b.levels ? cfp(b) : b.fp;
    if (f !== A) add(f);
  });
  if (A && A.length > 1) {
    const open = A === S.draft && !S.closed,
      n = A.length;
    for (let j = 0; j < (open ? n - 1 : n); j++) {
      const k = (j + 1) % n;
      if (i != null && (j === i || k === i)) continue;
      E.push([A[j][0], A[j][1], A[k][0], A[k][1]]);
    }
  }
  return E;
}
const fgDist = (p, g) => Math.abs((p[0] - g.ox) * Math.sin(g.a) - (p[1] - g.oz) * Math.cos(g.a));
const fgIsect = (g, h) => {
  const d = Math.cos(g.a) * Math.sin(h.a) - Math.sin(g.a) * Math.cos(h.a);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((h.ox - g.ox) * Math.sin(h.a) - (h.oz - g.oz) * Math.cos(h.a)) / d;
  return [g.ox + Math.cos(g.a) * t, g.oz + Math.sin(g.a) * t];
};
function fgSnap(p, e, i, A) {
  const rpx = 10 * mpp(),
    tol = 8 * mpp(),
    n = A.length,
    open = A === S.draft && !S.closed;
  let q = p.slice(),
    t = '',
    ref = null,
    rp = null,
    nx = null,
    nn = null,
    sn = null,
    note = '';
  if (i == null) {
    if (n) ref = A[n - 1];
    if (n > 1) rp = A[n - 2];
  } else if (open) {
    if (i > 0) {
      ref = A[i - 1];
      if (i > 1) rp = A[i - 2];
    }
    if (i < n - 1) {
      nx = A[i + 1];
      if (i < n - 2) nn = A[i + 2];
    }
  } else if (n >= 3) {
    ref = A[(i - 1 + n) % n];
    rp = A[(i - 2 + n) % n];
    nx = A[(i + 1) % n];
    nn = A[(i + 2) % n];
  }
  const res = { gd: [], fa: [], arc: null, nx };
  if (!e.shiftKey) {
    const base = fgBase(),
      step = S.fang.d45 ? Math.PI / 4 : Math.PI / 2,
      edges = fgEdges(A, i),
      C = [];
    P.concat(AL).forEach((a) => a.poly.forEach((c) => C.push(c)));
    S.ex.forEach((b) => b.fp.forEach((c) => C.push(c)));
    (S.ctxPts || []).forEach((c) => C.push(c));
    S.bld.forEach((b) => {
      const f = b.levels ? cfp(b) : b.fp;
      if (f !== A) f.forEach((c) => C.push(c));
    });
    A.forEach((c, j) => {
      if (j !== i) C.push(c);
    });
    // 1) Eckpunkt
    let bd = rpx,
      bp = null;
    C.forEach((c) => {
      if (c === ref || c === nx) return;
      const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
      if (d < bd) {
        bd = d;
        bp = c;
      }
    });
    if (bp) {
      q = bp.slice();
      t = 'pt';
      sn = [q];
    } else {
      // 2) Fanglinien
      const gd = [],
        add = (ox, oz, a, k, lab, wa) => {
          a = ((a % Math.PI) + Math.PI) % Math.PI;
          const g = gd.find(
            (h) =>
              fgPA(h.a, a) < 1e-3 && Math.abs((h.ox - ox) * Math.sin(a) - (h.oz - oz) * Math.cos(a)) < 1e-6,
          );
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
      const origins = [];
      if (ref) origins.push({ O: ref, pv: rp });
      if (nx) origins.push({ O: nx, pv: nn });
      if (S.ortho !== false)
        origins.forEach(({ O, pv }) => {
          const L = Math.hypot(p[0] - O[0], p[1] - O[1]);
          if (L < tol * 1.2) return;
          const nk = Math.round(Math.PI / step);
          for (let k = 0; k < nk; k++) {
            const a = base + k * step,
              r90 = Math.abs(k * step - Math.PI / 2) < 1e-6;
            add(O[0], O[1], a, 'ax', k === 0 ? 'waagerecht' : r90 ? 'senkrecht' : '45°');
          }
          const wa = [];
          edges.forEach((ed) => {
            const dx = ed[2] - ed[0],
              dz = ed[3] - ed[1],
              L2 = dx * dx + dz * dz;
            if (L2 < 1e-9) return;
            let tt = ((O[0] - ed[0]) * dx + (O[1] - ed[1]) * dz) / L2;
            if (tt < -1e-6 || tt > 1 + 1e-6) return;
            if (Math.hypot(ed[0] + dx * tt - O[0], ed[1] + dz * tt - O[1]) > 0.02) return;
            const a = Math.atan2(dz, dx);
            if (!wa.some((x) => fgPA(x, a) < 1e-3)) wa.push(a);
          });
          if (pv) {
            const a = Math.atan2(O[1] - pv[1], O[0] - pv[0]);
            if (!wa.some((x) => fgPA(x, a) < 1e-3)) wa.push(a);
          }
          wa.forEach((a) => {
            for (let k = 0; k < nk; k++) {
              const rel = k * step,
                lab =
                  Math.abs(rel) < 1e-6
                    ? 'Verlängerung'
                    : Math.abs(rel - Math.PI / 2) < 1e-6
                      ? '90° zur Kante'
                      : '45° zur Kante';
              add(O[0], O[1], a + rel, 'wal', lab, a);
            }
          });
        });
      const faint = gd.slice();
      if (S.axis !== false) {
        const K = [];
        A.forEach((c, j) => {
          if (j !== i) K.push(c);
        });
        if (A !== S.draft) S.draft.forEach((c) => K.push(c));
        S.bld.forEach((b) => {
          const f = b.levels ? cfp(b) : b.fp;
          if (f !== A) f.forEach((c) => K.push(c));
        });
        for (const c of K) {
          if (c === ref || c === nx) continue;
          for (let k = 0; k < 2; k++) {
            const a = base + (k * Math.PI) / 2,
              dd = Math.abs((p[0] - c[0]) * Math.sin(a) - (p[1] - c[1]) * Math.cos(a));
            if (dd < tol) add(c[0], c[1], a, 'trk', 'fluchtet');
          }
        }
      }
      const act = gd
        .filter((g) => {
          const d = fgDist(p, g);
          if (d >= tol) return false;
          if (g.k === 'trk') return true;
          const L = Math.hypot(p[0] - g.ox, p[1] - g.oz);
          return L > 1e-6 && d / L < Math.sin((11 * Math.PI) / 180);
        })
        .sort((a, b) => fgDist(p, a) - fgDist(p, b));
      const fin = (x, z, tt, gs) => {
        q = [x, z];
        t = tt;
        res.gd = gs;
        sn = gs.filter((g) => g.k === 'trk').map((g) => [g.ox, g.oz]);
        const w = gs.find((g) => g.wa != null);
        if (w) {
          const O =
            ref && Math.hypot(w.ox - ref[0], w.oz - ref[1]) < 1e-6
              ? ref
              : nx && Math.hypot(w.ox - nx[0], w.oz - nx[1]) < 1e-6
                ? nx
                : null;
          if (O && Math.hypot(x - O[0], z - O[1]) > 1e-6) {
            const nm = (a) => {
                while (a > Math.PI) a -= 2 * Math.PI;
                while (a <= -Math.PI) a += 2 * Math.PI;
                return a;
              },
              d = Math.atan2(z - O[1], x - O[0]),
              d1 = nm(d - w.wa),
              d2 = nm(d - w.wa - Math.PI),
              f1_ = Math.abs(d1) <= Math.abs(d2),
              df = f1_ ? d1 : d2,
              pd = (Math.abs(df) * 180) / Math.PI;
            if (Math.abs(pd - 45) < 0.8 || Math.abs(pd - 90) < 0.8)
              res.arc = {
                c: [O[0], O[1]],
                a0: f1_ ? w.wa : w.wa + Math.PI,
                df,
                psi: Math.round(pd / 45) * 45,
              };
          }
        }
        const g0 = gs[0];
        if (g0)
          note =
            g0.k === 'ax'
              ? 'Hauptachse ' + g0.lab
              : g0.k === 'wal'
                ? g0.lab
                : g0.k === 'trk'
                  ? 'fluchtet'
                  : '';
        return true;
      };
      let done = false;
      // 3) zwei Linien → Schnittpunkt
      if (act.length >= 2) {
        let best = null,
          bdd = tol * 1.7;
        for (let a = 0; a < act.length; a++)
          for (let b = a + 1; b < act.length; b++) {
            const x = fgIsect(act[a], act[b]);
            if (!x) continue;
            const d = Math.hypot(x[0] - p[0], x[1] - p[1]);
            if (d < bdd) {
              bdd = d;
              best = { x, g: [act[a], act[b]] };
            }
          }
        if (best) {
          done = fin(best.x[0], best.x[1], 'x', best.g);
          note = (note ? note + ' · ' : '') + 'Schnittpunkt';
        }
      }
      if (!done && act.length) {
        const g = act[0];
        let bx = null,
          bw = tol;
        for (const ed of edges) {
          const h = { ox: ed[0], oz: ed[1], a: Math.atan2(ed[3] - ed[1], ed[2] - ed[0]) },
            x = fgIsect(g, h);
          if (!x) continue;
          const L = Math.hypot(ed[2] - ed[0], ed[3] - ed[1]),
            tt = ((x[0] - ed[0]) * (ed[2] - ed[0]) + (x[1] - ed[1]) * (ed[3] - ed[1])) / (L * L);
          if (tt < -1e-6 || tt > 1 + 1e-6) continue;
          const d = Math.hypot(x[0] - p[0], x[1] - p[1]);
          if (d < bw) {
            bw = d;
            bx = x;
          }
        }
        if (bx) {
          done = fin(bx[0], bx[1], 'x', [g]);
          note = (note ? note + ' · ' : '') + 'trifft Kante';
        }
      }
      // Kantenkandidaten
      let E = null,
        ed_ = rpx * 0.7;
      for (const ed of edges) {
        const dx = ed[2] - ed[0],
          dz = ed[3] - ed[1],
          L2 = dx * dx + dz * dz;
        if (L2 < 1e-9) continue;
        let tt = ((p[0] - ed[0]) * dx + (p[1] - ed[1]) * dz) / L2;
        tt = Math.max(0, Math.min(1, tt));
        const x = ed[0] + dx * tt,
          z = ed[1] + dz * tt,
          d = Math.hypot(x - p[0], z - p[1]);
        if (d < ed_) {
          ed_ = d;
          E = { x, z };
        }
      }
      let M = null;
      if (S.fang.mid) {
        let md = rpx * 0.9;
        for (const ed of edges) {
          const x = (ed[0] + ed[2]) / 2,
            z = (ed[1] + ed[3]) / 2,
            d = Math.hypot(x - p[0], z - p[1]);
          if (d < md && Math.hypot(ed[2] - ed[0], ed[3] - ed[1]) > 0.5) {
            md = d;
            M = { x, z };
          }
        }
      }
      if (!done && act.length && !E && !M) {
        const g = act[0];
        const tt = (p[0] - g.ox) * Math.cos(g.a) + (p[1] - g.oz) * Math.sin(g.a);
        done = fin(g.ox + Math.cos(g.a) * tt, g.oz + Math.sin(g.a) * tt, 'g', [g]);
      }
      // Lotfuß von der Bezugsecke auf eine Kante
      if (!done && ref && S.ortho !== false) {
        let bq = tol,
          bf = null;
        for (const ed of edges) {
          const dx = ed[2] - ed[0],
            dz = ed[3] - ed[1],
            L2 = dx * dx + dz * dz;
          if (L2 < 1e-9) continue;
          const tt = ((ref[0] - ed[0]) * dx + (ref[1] - ed[1]) * dz) / L2;
          if (tt < 0 || tt > 1) continue;
          const x = ed[0] + dx * tt,
            z = ed[1] + dz * tt;
          if (Math.hypot(x - ref[0], z - ref[1]) < 0.02) continue;
          const d = Math.hypot(x - p[0], z - p[1]);
          if (d < bq) {
            bq = d;
            bf = [x, z];
          }
        }
        if (bf) {
          q = bf;
          t = 'perp';
          note = 'Lotfuß auf Kante';
          res.gd = [
            {
              ox: ref[0],
              oz: ref[1],
              a: ((Math.atan2(bf[1] - ref[1], bf[0] - ref[0]) % Math.PI) + Math.PI) % Math.PI,
              k: 'perp',
              lab: '⊥ Kante',
            },
          ];
          done = true;
        }
      }
      if (!done && M) {
        q = [M.x, M.z];
        t = 'mid';
        note = 'Kantenmitte';
        done = true;
      }
      if (!done && E) {
        q = [E.x, E.z];
        t = 'edge';
        note = 'Kante';
        done = true;
      }
      if (!done && act.length) {
        const g = act[0];
        const tt = (p[0] - g.ox) * Math.cos(g.a) + (p[1] - g.oz) * Math.sin(g.a);
        fin(g.ox + Math.cos(g.a) * tt, g.oz + Math.sin(g.a) * tt, 'g', [g]);
      }
      if (S.fang.g) res.fa = faint.filter((g) => g.k === 'ax' || g.k === 'wal');
    }
  }
  let lab = '';
  if (ref) {
    lab = f1(Math.hypot(q[0] - ref[0], q[1] - ref[1]), 2) + ' m';
    if (rp) {
      const ux = rp[0] - ref[0],
        uz = rp[1] - ref[1],
        vx = q[0] - ref[0],
        vz = q[1] - ref[1],
        m = Math.hypot(ux, uz) * Math.hypot(vx, vz);
      if (m > 0.01) {
        const ang = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / m))) * 180) / Math.PI;
        lab +=
          ' · ' +
          f1(ang, 1) +
          '°' +
          (Math.abs(ang - 90) < 0.3
            ? ' ⟂'
            : Math.abs(ang - 45) < 0.3 || Math.abs(ang - 135) < 0.3
              ? ' (45°)'
              : '');
      }
    }
  }
  if (t === 'pt') {
    lab += (lab ? ' · ' : '') + 'Punkt';
  } else if (note) lab += (lab ? ' · ' : '') + note;
  res.p = q;
  res.t = t;
  res.lab = lab;
  res.sn = sn;
  return res;
}
// snap(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
