// ---- v328: Fang- und Zeichenmechanik wie im Grundrissdesigner (Objektfang, Spurlinien, Winkel zur Außenlinie, Lotfuß)
function fdEdg(F) {
  if (F._ed) return F;
  const e = [],
    vt = [],
    seen = new Set();
  F.forEach((f) =>
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
  F._ed = e;
  F._vt = vt;
  return F;
}
// Geschossebenen (Höhenlinien über EG-Fußboden) als Fangkanten
function fdLevEdges(b, V) {
  const u = ugN(b),
    r = [];
  let v = 0;
  r.push([V.u0, 0, V.u1, 0]);
  b.levels.forEach((l, i) => {
    if (i < u) return;
    v += l.h;
    r.push([V.u0, v, V.u1, v]);
  });
  return r.filter((e) => e[1] >= V.v0 - 1e-6 && e[1] <= V.v1 + 1e-6);
}
function fdSnap(V, p, shift, mode, Fx) {
  const b = fdB(),
    F = fdEdg(Fx || fdFaces(b, V)),
    s = fdVP().s,
    tol = 12 / s,
    tg = 9 / s,
    LE = fdLevEdges(b, V),
    ed = F._ed.concat(LE),
    vt = F._vt.concat(LE.map((e) => [e[0], e[1]]).concat(LE.map((e) => [e[2], e[3]]))),
    res = { x: p.x, z: p.z, t: null, gd: [], arc: null },
    trk = S.gro.trk,
    gs = S.gro.gs;
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
  const lp = FDS.pts.length ? FDS.pts[FDS.pts.length - 1] : null,
    O =
      mode === 'line'
        ? lp
          ? { x: lp[0], z: lp[1] }
          : null
        : mode === 'rect' && FDS.rect
          ? { x: FDS.rect.a[0], z: FDS.rect.a[1] }
          : null;
  const gd = [],
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
  if (O && trk) {
    const lab = ['waagerecht', '45°', 'senkrecht', '45°'];
    for (let k = 0; k < 4; k++) {
      if (mode === 'rect' && k % 2 === 0) continue;
      add(O.x, O.z, (k * Math.PI) / 4, 'pol', lab[k]);
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
  if (trk)
    for (const q of vt) {
      if (O && Math.hypot(q[0] - O.x, q[1] - O.z) < 1e-6) continue;
      for (let k = 0; k < 2; k++) {
        const a = (k * Math.PI) / 2,
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
  const fin = (x, z, t, gs_) => {
    res.x = x;
    res.z = z;
    res.t = t;
    res.gd = gs_;
    const w = O && mode === 'line' ? gs_.find((g) => g.wa != null) : null;
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
      if (gs && g.k !== 'trk' && O) t = Math.round(t * 20) / 20;
      return fin(g.ox + Math.cos(g.a) * t, g.oz + Math.sin(g.a) * t, 'g', [g]);
    }
  }
  if (O && mode === 'line' && trk) {
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
          lab: '⊥ Linie',
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
  if (gs) {
    res.x = Math.round(p.x * 20) / 20;
    res.z = Math.round(p.z * 20) / 20;
  }
  return res;
}
// ---- Zeichnen
const fdFmt = (v) => f1(v, 2).replace('.', ',');
function fdDrawView(g, b, V, ox, o) {
  const F = fdFaces(b, V),
    d = fdD(b, V.key),
    X = (u) => fdSX(u + ox),
    Y = fdSY;
  if (o.sel && V.ctx && V.ctx.length) {
    g.save();
    g.fillStyle = '#64748b14';
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 1;
    g.setLineDash([5, 4]);
    V.ctx.forEach((r) => {
      g.beginPath();
      r.forEach((p, k) => (k ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.closePath();
      g.fill();
      g.stroke();
    });
    g.restore();
  }
  F.forEach((f, i) => {
    const t = fdT(f.t);
    g.beginPath();
    [f.o].concat(f.h).forEach((r) => {
      r.forEach((p, k) => (k ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.closePath();
    });
    g.fillStyle = t.c;
    g.fill('evenodd');
    if (o.sel && o.sel.includes(i)) {
      g.fillStyle = '#1F2A3333';
      g.fill('evenodd');
      g.lineWidth = 2.5;
      g.strokeStyle = '#1F2A33';
      g.stroke();
    }
  });
  // Raster der Geschosse (Höhenlinien)
  const b0 = b;
  let v = 0;
  const u = ugN(b0);
  b0.levels.forEach((l, i) => {
    if (i < u) return;
    v += l.h;
    g.strokeStyle = '#00000026';
    g.setLineDash([4, 4]);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X(V.u0) - 14, Y(v));
    g.lineTo(X(V.u1) + 14, Y(v));
    g.stroke();
    g.setLineDash([]);
  });
  let vv = 0;
  b0.levels.forEach((l, i) => {
    if (i < u) return;
    if (o.lab && o.sel) {
      g.fillStyle = '#64748b';
      g.font = '11px system-ui,sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(lname(b0, i), X(V.u1) + 18, Y(vv + l.h / 2));
    }
    vv += l.h;
  });
  // Ränder
  g.lineWidth = 2;
  g.strokeStyle = '#1F2A33';
  g.beginPath();
  V.bs.forEach((s) => {
    g.moveTo(X(s[0]), Y(s[1]));
    g.lineTo(X(s[2]), Y(s[3]));
  });
  g.stroke();
  if (d) {
    d.cuts.forEach((c) => {
      const on = o.selCut != null && c[4] === o.selCut;
      g.lineWidth = on ? 3.2 : 1.6;
      g.strokeStyle = on ? '#c2410c' : '#334155';
      g.setLineDash(on ? [] : [7, 3]);
      g.beginPath();
      g.moveTo(X(c[0]), Y(c[1]));
      g.lineTo(X(c[2]), Y(c[3]));
      g.stroke();
      g.setLineDash([]);
    });
  }
  if (o.lab) {
    const s = fdVP().s;
    F.forEach((f, i) => {
      const w = f.a * s * s;
      if (w < 2200) return;
      const t = fdT(f.t),
        L = [(f.n || 'F' + f.idx) + (f.t !== 'ohne' ? ' · ' + t.n : ''), fdFmt(f.a) + ' m²'];
      g.fillStyle = '#1d1d1b';
      g.font = '600 12px system-ui,Segoe UI,sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const cx = X(f.c[0]),
        cy = Y(f.c[1]);
      L.forEach((tx, k) => {
        const mw = Math.sqrt(w) * 1.5;
        let q = tx;
        if (g.measureText(q).width > mw) {
          while (q.length > 4 && g.measureText(q + '…').width > mw) q = q.slice(0, -1);
          q += '…';
        }
        g.fillText(q, cx, cy + (k - 0.5) * 15);
      });
    });
  }
  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  try {
    fdDepthFx(g, b, V, ox, o);
    g.save();
    g.lineWidth = 2.8;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = '#1F2A33';
    g.beginPath();
    V.bs.forEach((s) => {
      g.moveTo(fdSX(s[0] + ox), fdSY(s[1]));
      g.lineTo(fdSX(s[2] + ox), fdSY(s[3]));
    });
    g.stroke();
    g.restore();
  } catch (e) {
    console.warn('FD-Tiefe', e);
  }
}
function fdCvDraw() {
  const cv = fdE('fdCv');
  if (!cv) return;
  const z = fdSize(),
    g = cv.getContext('2d'),
    b = fdB();
  g.setTransform(z.dpr, 0, 0, z.dpr, 0, 0);
  g.clearRect(0, 0, z.W, z.H);
  if (!b) return;
  const st = getComputedStyle(fdE('fdDock'));
  g.fillStyle = st.getPropertyValue('--bg') || '#f2f2f2';
  g.fillRect(0, 0, z.W, z.H);
  if (FDS.vk === '*') {
    const lr = [-1e9, -1e9, -1e9, -1e9];
    fdLayout(b).forEach((l) => {
      fdDrawView(g, b, l.V, l.ox, { lab: true });
      const X = fdSX(l.V.u0 + l.ox),
        X1 = fdSX(l.V.u1 + l.ox);
      g.fillStyle = '#1d1d1b';
      g.font = '700 13px system-ui,sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      const w = g.measureText(l.V.name).width,
        cx = (X + X1) / 2;
      let r = 0;
      while (r < 3 && cx - w / 2 < lr[r] + 8) r++;
      if (r > 3) r = 3;
      lr[r] = cx + w / 2;
      g.fillText(l.V.name, cx, fdSY(l.V.v1) - 10 - r * 17);
    });
    fdHintSet('Gesamtübersicht – Ansicht anklicken, um sie zu bearbeiten');
    return;
  }
  const V = fdVw(b, FDS.vk);
  if (!V) return;
  fdDrawView(g, b, V, 0, { lab: true, sel: FDS.sel, selCut: FDS.selCut });
  // Maße
  g.fillStyle = '#334155';
  g.font = '11px system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(fdFmt(V.u1 - V.u0) + ' m', (fdSX(V.u0) + fdSX(V.u1)) / 2, fdSY(V.v0) + 8);
  g.fillStyle = '#64748b';
  g.fillText(
    'Schnittebene 0,50 m vor der äußersten Wand · sichtbare Flächen, schräge Flächen verkürzt',
    (fdSX(V.u0) + fdSX(V.u1)) / 2,
    fdSY(V.v0) + 24,
  );
  g.fillStyle = '#334155';
  g.save();
  g.translate(fdSX(V.u0) - 22, (fdSY(V.v0) + fdSY(V.v1)) / 2);
  g.rotate(-Math.PI / 2);
  g.textBaseline = 'bottom';
  g.fillText(fdFmt(V.v1 - V.v0) + ' m', 0, 0);
  g.restore();
  // Griffe der gewählten Schnittgruppe, Zeichenvorschau, Fangspuren
  const mv = (u, v) => [fdSX(u), fdSY(v)],
    cur = FDS.cur,
    sc = fdVP().s;
  if (FDS.selCut != null && FDS.tool === 'sel') {
    const gp = grGrp(fdLvF(V), FDS.selCut),
      eh = FDS.ed ? FDS.ed.hd : null;
    gp.vs.forEach((q) => {
      const [X, Y] = mv(q.p[0], q.p[1]),
        hot = eh && eh.m === 'v' && eh.k === q.k;
      g.fillStyle = hot ? '#1f6fd1' : '#fff';
      g.strokeStyle = '#1f6fd1';
      g.lineWidth = 1.8;
      g.beginPath();
      g.rect(X - 5, Y - 5, 10, 10);
      g.fill();
      g.stroke();
    });
    if (gp.sg.length) {
      const [X, Y] = mv(gp.cen[0], gp.cen[1]),
        hot = eh && eh.m === 'a';
      g.fillStyle = hot ? '#1f6fd1' : '#fff';
      g.strokeStyle = '#1f6fd1';
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(X, Y, 7, 0, 7);
      g.fill();
      g.stroke();
      g.strokeStyle = hot ? '#fff' : '#1f6fd1';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(X - 4, Y);
      g.lineTo(X + 4, Y);
      g.moveTo(X, Y - 4);
      g.lineTo(X, Y + 4);
      g.stroke();
    }
  }
  if (FDS.ed && FDS.ed.map) {
    const ed = FDS.ed,
      gp = ed.hd.grp,
      sg = grMapSegs(gp, ed.map);
    g.save();
    g.strokeStyle = '#5E7F92';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    sg.forEach((c) => {
      g.beginPath();
      g.moveTo(...mv(c[0], c[1]));
      g.lineTo(...mv(c[2], c[3]));
      g.stroke();
    });
    g.setLineDash([]);
    g.fillStyle = '#5E7F92';
    g.font = '600 12px system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    sg.forEach((c) => {
      const L = Math.hypot(c[2] - c[0], c[3] - c[1]);
      if (L * sc < 38) return;
      const [X, Y] = mv((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
      g.strokeStyle = 'rgba(255,255,255,.9)';
      g.lineWidth = 3;
      g.strokeText(fdFmt(L) + ' m', X, Y - 8);
      g.fillText(fdFmt(L) + ' m', X, Y - 8);
    });
    if (gp.loop) {
      let A = 0;
      const r = gp.ring.map((q) => ed.map.get(gk(q[0], q[1])) || q);
      for (let i = 0; i < r.length; i++) {
        const q = r[(i + 1) % r.length];
        A += r[i][0] * q[1] - q[0] * r[i][1];
      }
      const cx = r.reduce((t, q) => t + q[0], 0) / r.length,
        cz = r.reduce((t, q) => t + q[1], 0) / r.length,
        [X, Y] = mv(cx, cz);
      g.strokeStyle = 'rgba(255,255,255,.9)';
      g.lineWidth = 3;
      g.strokeText(fdFmt(Math.abs(A / 2)) + ' m²', X, Y);
      g.fillText(fdFmt(Math.abs(A / 2)) + ' m²', X, Y);
    }
    g.restore();
  }
  if (cur) {
    const R_ = ((z.W + z.H) / sc) * 1.6;
    (cur.gd || []).forEach((q) => {
      g.save();
      g.lineWidth = 1.2;
      g.strokeStyle =
        q.k === 'trk' ? '#e08a00' : q.k === 'wal' ? '#5E7F92' : q.k === 'perp' ? '#7b3fc4' : '#0a9ea8';
      g.setLineDash(q.k === 'trk' ? [2, 4] : [10, 5]);
      g.beginPath();
      g.moveTo(...mv(q.ox - Math.cos(q.a) * R_, q.oz - Math.sin(q.a) * R_));
      g.lineTo(...mv(q.ox + Math.cos(q.a) * R_, q.oz + Math.sin(q.a) * R_));
      g.stroke();
      g.setLineDash([]);
      if (q.k === 'trk') {
        const [X, Y] = mv(q.ox, q.oz);
        g.beginPath();
        g.moveTo(X - 4, Y - 4);
        g.lineTo(X + 4, Y + 4);
        g.moveTo(X + 4, Y - 4);
        g.lineTo(X - 4, Y + 4);
        g.stroke();
      }
      if (q.lab) {
        const [X, Y] = mv(cur.x, cur.z);
        g.fillStyle = g.strokeStyle;
        g.font = '11px system-ui,sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        g.fillText(q.lab, X + 12, Y + 16);
      }
      g.restore();
    });
    if (cur.arc) {
      const a = cur.arc,
        [X, Y] = mv(a.c[0], a.c[1]);
      g.save();
      g.fillStyle = 'rgba(94,127,146,.18)';
      g.strokeStyle = '#5E7F92';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(X, Y);
      g.arc(X, Y, 30, -a.a0, -(a.a0 + a.df), a.df > 0);
      g.closePath();
      g.fill();
      g.stroke();
      const am = -(a.a0 + a.df / 2);
      g.fillStyle = '#5E7F92';
      g.font = '600 12px system-ui,sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(a.psi + '°', X + Math.cos(am) * 46, Y + Math.sin(am) * 46);
      g.restore();
    }
  }
  if (FDS.tool === 'line' && FDS.pts.length) {
    g.strokeStyle = '#5E7F92';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.beginPath();
    FDS.pts.forEach((p, i) => {
      const [X, Y] = mv(p[0], p[1]);
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    });
    if (cur) g.lineTo(...mv(cur.x, cur.z));
    g.stroke();
    g.setLineDash([]);
    if (cur) {
      const l = FDS.pts[FDS.pts.length - 1],
        d = Math.hypot(cur.x - l[0], cur.z - l[1]),
        [X, Y] = mv(cur.x, cur.z);
      g.fillStyle = '#5E7F92';
      g.font = '600 12px system-ui,sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(fdFmt(d) + ' m', X + 12, Y - 10);
    }
  }
  if (FDS.tool === 'rect' && FDS.rect && cur) {
    const a = FDS.rect.a,
      u = Math.abs(cur.x - a[0]),
      w = Math.abs(cur.z - a[1]),
      [X0, Y0] = mv(a[0], a[1]),
      [X1, Y1] = mv(cur.x, cur.z);
    g.strokeStyle = '#5E7F92';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.setLineDash([]);
    g.fillStyle = '#5E7F92';
    g.font = '600 12px system-ui,sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(fdFmt(u) + ' × ' + fdFmt(w) + ' m = ' + fdFmt(u * w) + ' m²', X1 + 12, Y1 - 10);
  }
  if (FDS.tool === 'st' && FDS.hv) {
    const h = FDS.hv,
      [X0, Y0] = mv(h.u0, h.v0),
      [X1, Y1] = mv(h.u1, h.v1);
    g.fillStyle = 'rgba(94,127,146,.28)';
    g.strokeStyle = '#5E7F92';
    g.lineWidth = 1.5;
    g.fillRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0));
    g.strokeRect(Math.min(X0, X1), Math.min(Y0, Y1), Math.abs(X1 - X0), Math.abs(Y1 - Y0));
  }
  if (cur && (FDS.tool === 'line' || FDS.tool === 'rect' || FDS.ed)) {
    const [X, Y] = mv(cur.x, cur.z);
    g.strokeStyle = cur.t ? '#5E7F92' : '#888';
    g.lineWidth = 1.5;
    g.beginPath();
    if (cur.t === 'p') {
      g.rect(X - 5, Y - 5, 10, 10);
    } else if (cur.t === 'x') {
      g.moveTo(X - 6, Y - 6);
      g.lineTo(X + 6, Y + 6);
      g.moveTo(X + 6, Y - 6);
      g.lineTo(X - 6, Y + 6);
    } else if (cur.t === 'perp') {
      g.rect(X - 5, Y - 5, 10, 10);
      g.moveTo(X - 5, Y);
      g.lineTo(X, Y);
      g.lineTo(X, Y + 5);
    } else if (cur.t === 'e') {
      g.moveTo(X - 6, Y);
      g.lineTo(X, Y - 6);
      g.lineTo(X + 6, Y);
      g.lineTo(X, Y + 6);
      g.closePath();
    } else if (cur.t === 'g') {
      g.arc(X, Y, 4, 0, 7);
    } else {
      g.moveTo(X - 6, Y);
      g.lineTo(X + 6, Y);
      g.moveTo(X, Y - 6);
      g.lineTo(X, Y + 6);
    }
    g.stroke();
  }
  const ht =
    FDS.note && Date.now() < FDS.note.u
      ? FDS.note.t
      : FDS.ed
        ? 'Ziehen – Fang wie beim Zeichnen · Shift = Spur festhalten · Esc = abbrechen'
        : FDS.tool === 'line'
          ? 'Klick = Punkt · zurück auf den Startpunkt = Fläche schließen (ersetzt Linien darin) · Enter / Rechtsklick = beenden · Shift = Winkel fest · Esc = abbrechen'
          : FDS.tool === 'st'
            ? 'Klick auf eine Fläche = diese Fläche im Geschoss wählen (nur die Flucht, in der sie liegt) · danach Fassadentyp rechts wählen · Umschalt = weitere Geschosse'
            : FDS.tool === 'rect'
              ? 'Aufziehen oder zwei Ecken anklicken – ersetzt alle Linien und Felder darin durch eine Fläche · Esc = abbrechen'
              : 'Feld klicken (Umschalt = mehrere) · Fassadentyp rechts wählen · Linie anklicken: Griffe ziehen, Entf = löschen';
  fdHintSet(ht);
}
function fdHintSet(t) {
  const e = fdE('fdHint');
  if (e && e.textContent !== t) e.textContent = t;
}
