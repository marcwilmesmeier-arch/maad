// ---- Eingabe
function fdInit() {
  const cv = fdE('fdCv'),
    d = fdE('fdDock');
  cv.addEventListener('pointerdown', fdDown);
  cv.addEventListener('pointermove', fdCvMove);
  cv.addEventListener('pointerup', fdUp);
  cv.addEventListener('pointerleave', () => {
    FDS.cur = null;
    FDS.dirty = 1;
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', fdWheel, { passive: false });
  d.addEventListener('keydown', fdKey);
  try {
    new ResizeObserver(() => {
      FDS.dirty = 1;
    }).observe(fdE('fdCw'));
  } catch (e) {
    logErr(e, 'fdInit');
  }
  // Fenster verschieben
  const hd = fdE('fdHd');
  let dr = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,select,input')) return;
    const q = d.getBoundingClientRect();
    dr = { x: e.clientX - q.left, y: e.clientY - q.top };
    hd.setPointerCapture(e.pointerId);
  });
  hd.addEventListener('pointermove', (e) => {
    if (!dr) return;
    d.style.left = Math.max(0, e.clientX - dr.x) + 'px';
    d.style.top = Math.max(0, e.clientY - dr.y) + 'px';
  });
  hd.addEventListener('pointerup', () => {
    dr = null;
  });
  setInterval(() => {
    try {
      fdTick();
    } catch (e) {
      console.warn('Fassadendesigner', e);
    }
  }, 120);
}
function fdPos(e) {
  const r = fdE('fdCv').getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function fdHitFace(b, V, u, v) {
  const F = fdFaces(b, V);
  let bi = -1,
    ba = 1e18;
  F.forEach((f, i) => {
    if (grInFace(f, u, v) && f.a < ba) {
      ba = f.a;
      bi = i;
    }
  });
  return bi;
}
function fdHitCut(V, x, y) {
  const b = fdB(),
    d = fdD(b, V.key);
  if (!d) return null;
  let bd = 7,
    bg = null;
  d.cuts.forEach((c) => {
    const ax = fdSX(c[0]),
      ay = fdSY(c[1]),
      bx = fdSX(c[2]),
      by = fdSY(c[3]),
      dx = bx - ax,
      dy = by - ay,
      L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return;
    let t = ((x - ax) * dx + (y - ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const dd = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (dd < bd) {
      bd = dd;
      bg = c[4];
    }
  });
  return bg;
}
function fdLvF(V) {
  const b = fdB(),
    d = fdD(b, V.key);
  return { obj: { cuts: d ? d.cuts : [] } };
}
function fdEdHit(V, g, p) {
  const grp = grGrp(fdLvF(V), g);
  if (!grp.sg.length) return null;
  const tol = 9 / fdVP().s;
  for (const v of grp.vs) if (Math.hypot(v.p[0] - p.x, v.p[1] - p.z) < tol) return { m: 'v', k: v.k, grp };
  if (Math.hypot(grp.cen[0] - p.x, grp.cen[1] - p.z) < tol * 1.1) return { m: 'a', grp };
  for (let i = 0; i < grp.sg.length; i++) {
    const c = grp.sg[i];
    if (grDSeg(p.x, p.z, c[0], c[1], c[2], c[3]) < tol * 0.8) return { m: 'e', i, grp };
  }
  return null;
}
function fdEdStart(V, hd, e) {
  const grp = hd.grp,
    d = fdD(fdB(), V.key),
    others = (d ? d.cuts : []).filter((c) => c[4] !== grp.g);
  let org;
  if (hd.m === 'v') {
    if (grp.rect) {
      const i = grp.ring.findIndex((q) => gk(q[0], q[1]) === hd.k);
      org = grp.ring[(i + 2) % 4];
    } else {
      const c = grp.sg.find((c) => gk(c[0], c[1]) === hd.k || gk(c[2], c[3]) === hd.k);
      org = gk(c[0], c[1]) === hd.k ? [c[2], c[3]] : [c[0], c[1]];
    }
  } else if (hd.m === 'a') org = grp.cen;
  else {
    const c = grp.sg[hd.i];
    org = [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2];
  }
  FDS.ed = {
    g: grp.g,
    hd,
    Fx: grFaces(
      V.bs,
      others.map((c) => c.slice(0, 4)),
    ),
    org: org.slice(),
    px: e.clientX,
    py: e.clientY,
    moved: false,
    map: null,
  };
  FDS.pts = [org.slice()];
  FDS.dirty = 1;
}
function fdEdUpdate(q) {
  const ed = FDS.ed,
    hd = ed.hd,
    grp = hd.grp;
  let a;
  if (hd.m === 'v') a = { k: hd.k, x: q.x, z: q.z };
  else if (hd.m === 'a') a = { dx: q.x - grp.cen[0], dz: q.z - grp.cen[1] };
  else {
    const c = grp.sg[hd.i],
      L = Math.hypot(c[2] - c[0], c[3] - c[1]) || 1,
      nx = -(c[3] - c[1]) / L,
      nz = (c[2] - c[0]) / L,
      o = ed.org;
    a = { i: hd.i, d: (q.x - o[0]) * nx + (q.z - o[1]) * nz };
  }
  ed.map = grMapV(grp, hd.m, a);
}
function fdEditGrp(g, m) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  const d0 = fdD(b, V.key);
  if (!d0) return;
  const grp = grGrp(fdLvF(V), g);
  if (!grp.sg.length) return;
  const segs = grMapSegs(grp, m).filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.01);
  if (!segs.length) return;
  let ring = null,
    at = null;
  if (grp.loop) {
    ring = grp.ring.map((p) => m.get(gk(p[0], p[1])) || p);
    const pl = grPole([grp.ring]),
      f = fdFaces(b, V).find((q) => grInFace(q, pl.x, pl.z));
    if (f) at = { t: f.t, n: f.n };
  }
  fdEdit((b) => {
    const V = fdCurV(),
      d = fdD(b, V.key),
      others = (d ? d.cuts : []).filter((c) => c[4] !== g).map((c) => c.slice());
    let cuts = others;
    if (ring) cuts = grClipArea(others, ring).map((c) => [gr2(c[0]), gr2(c[1]), gr2(c[2]), gr2(c[3]), c[4]]);
    segs.forEach((s) => cuts.push([gr2(s[0]), gr2(s[1]), gr2(s[2]), gr2(s[3]), g]));
    fdSetCuts(b, V, cuts);
    if (ring && at) {
      const pl = grPole([ring]),
        nf = fdFaces(b, V).find((q) => grInFace(q, pl.x, pl.z));
      if (nf) fdAttr(b, V, nf, at);
    }
    FDS.selCut = g;
    FDS.sel = [];
  });
}
// Neue Linie: bestehende Linien werden an den Kreuzungen getrennt, jedes Teilstück ist danach eigenständig wählbar/löschbar
function fdAddLine(segs) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V || !segs.length) return;
  let ng = 0;
  fdEdit((b) => {
    const V = fdCurV(),
      d = fdD(b, V.key),
      old = (d ? d.cuts : []).map((c) => c.slice());
    let g = grGid(old);
    const cuts = [];
    old.forEach((c) => {
      const ts = [];
      segs.forEach((s) => {
        const x = grSegT(c, s);
        if (x && x[0] > 0 && x[0] < 1 && x[1] >= -1e-6 && x[1] <= 1 + 1e-6) ts.push(x[0]);
      });
      const ps = grPieces(c, ts);
      if (ps.length < 2) {
        cuts.push(c);
        return;
      }
      ps.forEach(([a, q]) => cuts.push([gr2(a[0]), gr2(a[1]), gr2(q[0]), gr2(q[1]), g++]));
    });
    ng = g;
    segs.forEach((s) => cuts.push([gr2(s[0]), gr2(s[1]), gr2(s[2]), gr2(s[3]), ng]));
    fdSetCuts(b, V, cuts);
    FDS.sel = [];
    FDS.selCut = ng;
  });
}
// Neue geschlossene Fläche P (Rechteck/Polygon): Linien im Inneren entfallen, außen werden sie an der Kontur gekappt
function fdAddArea(P) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  fdEdit((b) => {
    const V = fdCurV(),
      d = fdD(b, V.key),
      old = (d ? d.cuts : []).map((c) => c.slice()),
      cuts = grClipArea(old, P).map((c) => [gr2(c[0]), gr2(c[1]), gr2(c[2]), gr2(c[3]), c[4]]),
      g = grGid(old);
    P.forEach((q, i) => {
      const r = P[(i + 1) % P.length];
      cuts.push([gr2(q[0]), gr2(q[1]), gr2(r[0]), gr2(r[1]), g]);
    });
    fdSetCuts(b, V, cuts);
    FDS.sel = [];
    FDS.selCut = g;
  });
}
function fdFinishLine() {
  const pts = FDS.pts;
  FDS.pts = [];
  FDS.cur = null;
  if (pts.length >= 2) {
    const segs = [];
    for (let i = 0; i + 1 < pts.length; i++)
      if (Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) > 0.02)
        segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
    if (segs.length) {
      const P = pts.slice(0, -1);
      if (
        P.length >= 3 &&
        Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) < 0.03 &&
        Math.abs(grRingA(P)) > 0.01
      )
        fdAddArea(P);
      else fdAddLine(segs);
    }
  }
  FDS.dirty = 1;
}
function fdFinishRect(c) {
  const a = FDS.rect.a;
  FDS.rect = null;
  const u0 = Math.min(a[0], c.x),
    u1 = Math.max(a[0], c.x),
    v0 = Math.min(a[1], c.z),
    v1 = Math.max(a[1], c.z);
  FDS.dirty = 1;
  if (u1 - u0 < 0.05 || v1 - v0 < 0.05) return;
  fdAddArea([
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ]);
}
function fdDown(e) {
  const b = fdB();
  if (!b) return;
  const [x, y] = fdPos(e);
  FDS.shift = e.shiftKey;
  try {
    fdE('fdDock').focus();
  } catch (e) {
    logErr(e, 'fdDown');
  }
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (e) {
    logErr(e, 'fdDown');
  }
  if (e.button === 1 || FDS.space) {
    FDS.pan = { x, y, p: Object.assign({}, fdVP()) };
    return;
  }
  if (e.button === 2) {
    if (FDS.tool === 'line' && FDS.pts.length) fdFinishLine();
    else {
      FDS.pts = [];
      FDS.rect = null;
      FDS.pan = { x, y, p: Object.assign({}, fdVP()) };
    }
    FDS.dirty = 1;
    return;
  }
  if (e.button !== 0) return;
  if (FDS.vk === '*') {
    const L = fdLayout(b);
    for (const l of L) {
      const u = fdWU(x) - l.ox,
        v = fdWV(y);
      if (u >= l.V.u0 && u <= l.V.u1 && v >= l.V.v0 && v <= l.V.v1) {
        const i = fdHitFace(b, l.V, u, v);
        if (i >= 0) {
          fdView(l.V.key);
          FDS.sel = [i];
          FDS.ps = '';
          FDS.dirty = 1;
          return;
        }
      }
    }
    return;
  }
  const V = fdVw(b, FDS.vk);
  if (!V) return;
  const p = { x: fdWU(x), z: fdWV(y) };
  if (FDS.tool === 'sel') {
    if (FDS.selCut != null) {
      const hd = fdEdHit(V, FDS.selCut, p);
      if (hd) {
        fdEdStart(V, hd, e);
        return;
      }
    }
    const g = fdHitCut(V, x, y);
    if (g != null) {
      FDS.selCut = g;
      FDS.sel = [];
      FDS.dirty = 1;
      FDS.ps = '';
      return;
    }
    const i = fdHitFace(b, V, p.x, p.z);
    FDS.selCut = null;
    if (i < 0) {
      if (!e.shiftKey) FDS.sel = [];
    } else if (e.shiftKey || e.ctrlKey || e.metaKey) {
      FDS.sel = FDS.sel.includes(i) ? FDS.sel.filter((q) => q !== i) : FDS.sel.concat(i);
    } else FDS.sel = [i];
    FDS.ps = '';
    FDS.dirty = 1;
    return;
  }
  if (FDS.tool === 'st') {
    fdStorey(b, V, p);
    return;
  }
  const q = fdSnap(V, p, e.shiftKey, FDS.tool);
  if (FDS.tool === 'line') {
    const l = FDS.pts[FDS.pts.length - 1],
      f0 = FDS.pts[0];
    if (FDS.pts.length >= 3 && Math.hypot(q.x - f0[0], q.z - f0[1]) < Math.max(0.03, 8 / fdVP().s)) {
      FDS.pts.push([f0[0], f0[1]]);
      fdFinishLine();
      return;
    }
    if (l && Math.hypot(q.x - l[0], q.z - l[1]) < 1e-3) {
      fdFinishLine();
      return;
    }
    FDS.pts.push([q.x, q.z]);
    FDS.cur = null;
    FDS.dirty = 1;
  } else if (FDS.tool === 'rect') {
    if (!FDS.rect) {
      FDS.rect = { a: [q.x, q.z], cx: e.clientX, cy: e.clientY, drag: true };
    } else fdFinishRect(q);
    FDS.dirty = 1;
  }
}
function fdCvMove(e) {
  const b = fdB();
  if (!b) return;
  const [x, y] = fdPos(e);
  FDS.shift = e.shiftKey;
  if (FDS.pan) {
    const p = FDS.pan.p;
    FDS.vw[FDS.vk] = { cx: p.cx - (x - FDS.pan.x) / p.s, cy: p.cy + (y - FDS.pan.y) / p.s, s: p.s };
    FDS.dirty = 1;
    return;
  }
  const V = FDS.vk === '*' ? null : fdVw(b, FDS.vk);
  if (!V) return;
  const p = { x: fdWU(x), z: fdWV(y) };
  if (FDS.ed) {
    const ed = FDS.ed;
    if (!ed.moved && Math.hypot(e.clientX - ed.px, e.clientY - ed.py) < 4) return;
    ed.moved = true;
    const q = fdSnap(V, p, e.shiftKey, 'line', ed.Fx);
    FDS.cur = q;
    fdEdUpdate(q);
    FDS.dirty = 1;
    return;
  }
  if (FDS.tool === 'sel') {
    FDS.cur = null;
    const hd = FDS.selCut != null ? fdEdHit(V, FDS.selCut, p) : null;
    e.currentTarget.style.cursor = hd ? (hd.m === 'v' ? 'crosshair' : 'move') : '';
    return;
  }
  if (FDS.tool === 'st') {
    FDS.cur = null;
    e.currentTarget.style.cursor = 'pointer';
    const r = fdStoreyRect(b, V, p),
      o = FDS.hv;
    FDS.hv = r;
    if (JSON.stringify(r) !== JSON.stringify(o)) FDS.dirty = 1;
    return;
  }
  e.currentTarget.style.cursor = 'crosshair';
  FDS.cur = fdSnap(V, p, e.shiftKey, FDS.tool);
  FDS.dirty = 1;
}
function fdUp(e) {
  const b = fdB();
  if (FDS.ed) {
    const ed = FDS.ed;
    FDS.ed = null;
    FDS.pts = [];
    FDS.cur = null;
    FDS.dirty = 1;
    if (ed.moved && ed.map) fdEditGrp(ed.g, ed.map);
    return;
  }
  if (FDS.pan) {
    FDS.pan = null;
    return;
  }
  if (!b) return;
  const V = FDS.vk === '*' ? null : fdVw(b, FDS.vk);
  if (V && FDS.tool === 'rect' && FDS.rect && FDS.rect.drag) {
    if (Math.hypot(e.clientX - FDS.rect.cx, e.clientY - FDS.rect.cy) > 6) {
      const [x, y] = fdPos(e);
      fdFinishRect(fdSnap(V, { x: fdWU(x), z: fdWV(y) }, e.shiftKey, 'rect'));
    } else FDS.rect.drag = false;
  }
}
function fdWheel(e) {
  e.preventDefault();
  const [x, y] = fdPos(e),
    p = fdVP(),
    u = fdWU(x),
    v = fdWV(y),
    k = Math.exp(-e.deltaY * 0.0015),
    s = Math.max(1, Math.min(600, p.s * k)),
    z = fdSize();
  FDS.vw[FDS.vk] = { s, cx: u - (x - z.W / 2) / s, cy: v + (y - z.H / 2) / s };
  FDS.dirty = 1;
}
function fdKey(e) {
  if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  const k = e.key;
  if (k === 'Enter') {
    if (FDS.tool === 'line') fdFinishLine();
    e.preventDefault();
  } else if (k === 'Escape') {
    if (FDS.ed) {
      FDS.ed = null;
      FDS.pts = [];
      FDS.cur = null;
    } else if (FDS.pts.length || FDS.rect) {
      FDS.pts = [];
      FDS.rect = null;
    } else if (FDS.sel.length || FDS.selCut != null) {
      FDS.sel = [];
      FDS.selCut = null;
    } else fdClose();
    FDS.dirty = 1;
    FDS.ps = '';
    e.preventDefault();
  } else if (k === 'Delete' || k === 'Backspace') {
    fdDelSel();
    e.preventDefault();
  } else if (k === 'v' || k === 'V') fdTool('sel');
  else if (k === 'l' || k === 'L') fdTool('line');
  else if (k === 'r' || k === 'R') fdTool('rect');
  else if (k === 'g' || k === 'G') fdTool('st');
  else if (k === 'f' || k === 'F') fdFit();
  else if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) {
    e.preventDefault();
    undo();
    FDS.sel = [];
    FDS.selCut = null;
    FDS.ps = '';
    FDS.dirty = 1;
  } else if (k === ' ') {
    FDS.space = true;
    e.preventDefault();
  }
}
document.addEventListener('keyup', (e) => {
  if (e.key === ' ') FDS.space = false;
});
