// ---- Nachträgliches Bearbeiten gewählter Schnittgruppen (Griffe: Ecke, Kante, Mitte)
function grEdHit(lv, g, p) {
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js
  const r = (() => {
    const grp = grGrp(lv, g);
    if (!grp.sg.length) return null;
    const tol = 9 / GRS.view.s;
    for (const v of grp.vs) if (Math.hypot(v.p[0] - p.x, v.p[1] - p.z) < tol) return { m: 'v', k: v.k, grp };
    if (Math.hypot(grp.cen[0] - p.x, grp.cen[1] - p.z) < tol * 1.1) return { m: 'a', grp };
    for (let i = 0; i < grp.sg.length; i++) {
      const c = grp.sg[i];
      if (grDSeg(p.x, p.z, c[0], c[1], c[2], c[3]) < tol * 0.8) return { m: 'e', i, grp };
    }
    return null;
  })();
  if (r || !l2on()) return r;
  try {
    const grp = grGrp(lv, g),
      tol = 9 / GRS.view.s;
    for (const v of grp.vs) {
      const q = l2Disp(lv, g, v.p);
      if (Math.hypot(q[0] - p.x, q[1] - p.z) < tol) return { m: 'v', k: v.k, grp };
    }
  } catch (e) {
    logErr(e, 'grEdHit');
  }
  return r;
}
function grEdStart(lv, hd, e) {
  const grp = hd.grp,
    others = (lv.obj.cuts || []).filter((c) => c[4] !== grp.g);
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
  GRS.ed = {
    g: grp.g,
    hd,
    lvx: {
      faces: grFaces(
        lv.bs,
        others.map((c) => c.slice(0, 4)),
      ),
    },
    org: org.slice(),
    px: e.clientX,
    py: e.clientY,
    moved: false,
    map: null,
  };
  GRS.pts = [org.slice()];
  GRS.dirty = 1;
}
function grEdUpdate(q) {
  const ed = GRS.ed,
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
function grPickU(i, multi) {
  let m = GRS.msel.slice();
  if (multi) {
    if (!m.length && GRS.sel && GRS.sel.k === 'u') m = [GRS.sel.i];
    const j = m.indexOf(i);
    if (j >= 0) m.splice(j, 1);
    else m.push(i);
    GRS.msel = m;
    GRS.sel = m.length === 1 ? { k: 'u', i: m[0] } : null;
  } else {
    GRS.msel = [];
    GRS.sel = { k: 'u', i };
  }
  GRS.ps = '';
  GRS.dirty = 1;
  grTick();
}
function grFinishLine() {
  const pts = GRS.pts;
  GRS.pts = [];
  GRS.cur = null;
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
        grAddArea(P);
      else grAddLine(segs);
    }
  }
  GRS.dirty = 1;
}
function grFinishRect(c) {
  const b = grB();
  if (!b) return;
  const a = GRS.rect.a;
  GRS.rect = null;
  const R = grRect(a, c, -GRS.rt);
  const u = Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]),
    w = Math.hypot(R[2][0] - R[1][0], R[2][1] - R[1][1]);
  if (u < 0.05 || w < 0.05) {
    GRS.dirty = 1;
    return;
  }
  grAddArea(R);
}
function grDown(e) {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js
  if (MXS.pick && e.button === 0) {
    const p = grPt(e),
      R = S.mx.ras;
    if (MXS.pick === 1) {
      R.ox = gr2(p.x);
      R.oz = gr2(p.z);
      MXS.pick = 2;
    } else {
      R.th = Math.atan2(p.z - R.oz, p.x - R.ox);
      MXS.pick = 0;
    }
    GRS.ps = '';
    GRS.dirty = 1;
    try {
      grTick(true);
    } catch (e) {
      logErr(e, 'grDown');
    }
    return;
  }
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js
  if (l2on() && GRS.tool === 'trim') {
    if (e.button === 2) {
      S.l2.cut = null;
      l2Cap('Schneidkanten: alle Wände');
    } else if (e.button === 0) {
      const b = grB();
      if (b && b._y != null) {
        const lv = grLv(b),
          p = grPt(e),
          w = lv.dg ? null : l2Hit(b, lv, p.x, p.z) || l2HitCut(lv, p);
        if (w) {
          if (e.shiftKey) {
            S.l2.cut = w.id;
            GRS.dirty = 1;
            l2Cap('Schneidkante gewählt – jetzt Wand zum Stutzen/Dehnen anklicken');
          } else l2TrimDo(b, lv, w, p);
        } else if (S.l2.cut) {
          S.l2.cut = null;
          GRS.dirty = 1;
          l2Cap('Schneidkanten: alle Wände');
        }
      }
      return;
    }
  }
  // ── Erweiterung aus 22-lod200-waende/030-aktionen.js
  if (l2on() && GRS.tool === 'sel' && e.button === 0 && !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) {
    const b = grB();
    if (b && b._y != null) {
      const lv = grLv(b),
        p = grPt(e),
        s0 = GRS.sel;
      const hd0 = s0 && s0.k === 'c' ? grEdHit(lv, s0.g, p) : null;
      if (hd0 && hd0.m === 'v') {
        const v = hd0.grp.vs.find((z) => z.k === hd0.k);
        S.l2.pt = v ? { g: s0.g, p: v.p.slice() } : null;
        S.l2.bsig = '';
        GRS.dirty = 1;
      } else S.l2.pt = null;
      if (!hd0 && !lv.dg && l23()) {
        const G0 = l2Els(b),
          tol = 9 / GRS.view.s;
        for (const k in G0.cn || {}) {
          const c = G0.cn[k];
          if (c.li !== lv.i) continue;
          if (Math.hypot(c.P[0] - p.x, c.P[1] - p.z) < tol) {
            const na = c.a[0] === c.t ? c.a[1] : c.a[0];
            grEdit((bb) => {
              bb.l2 = bb.l2 || {};
              const cn = (bb.l2.cn = bb.l2.cn || { m: 'l', o: {} });
              cn.o = cn.o || {};
              cn.o[c.k] = na;
              bb._l2 = null;
            });
            S.l2.bsig = '';
            GRS.dirty = 1;
            l2Cap('Eckanschluss getauscht – die andere Wand läuft jetzt durch');
            return;
          }
        }
      }
      if (!hd0 && !lv.dg) {
        const w = l2Hit(b, lv, p.x, p.z);
        if (w) {
          S.l2.sel = w.id;
          S.l2.pick = 0;
          GRS.msel = [];
          GRS.sel = w.gid && w.kind !== 'AW' ? { k: 'c', g: w.gid } : null;
          GRS.dirty = 1;
          GRS.ps = '';
          S.l2.fl = lv.i;
          L2AN || l2Run();
          return;
        }
      }
    }
    S.l2.sel = null;
    S.l2.pick = 0;
  }
  const b = grB();
  if (!b) return;
  const cv = e.currentTarget;
  try {
    cv.setPointerCapture(e.pointerId);
  } catch (e) {
    logErr(e, 'grDown');
  }
  const lv = grLv(b),
    p = grPt(e);
  if (e.button === 0 && grNorthHit(p)) {
    GR.north();
    return;
  }
  if (e.button === 1 || (e.button === 0 && GRS.space)) {
    GRS.pan = { sx: p.sx, sy: p.sy, x: GRS.view.x, z: GRS.view.z };
    e.preventDefault();
    return;
  }
  if (e.button === 2) {
    if (GRS.tool === 'line' && GRS.pts.length) {
      grFinishLine();
    } else {
      GRS.pts = [];
      GRS.rect = null;
      GRS.pan = { sx: p.sx, sy: p.sy, x: GRS.view.x, z: GRS.view.z };
    }
    e.preventDefault();
    GRS.dirty = 1;
    return;
  }
  if (e.button !== 0) return;
  if (GRS.tool === 'sel') {
    const s0 = GRS.sel;
    if (s0 && s0.k === 'c') {
      const hd = grEdHit(lv, s0.g, p);
      if (hd) {
        grEdStart(lv, hd, e);
        return;
      }
    }
    const h = grHit(p.x, p.z, lv);
    if (h && h.k === 'u' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      grPickU(h.i, true);
      return;
    }
    GRS.msel = [];
    GRS.sel = h;
    if (!h) GRS.pan = { sx: p.sx, sy: p.sy, x: GRS.view.x, z: GRS.view.z, clear: 1 };
    GRS.dirty = 1;
    GRS.ps = '';
    return;
  }
  const q = grSnap(p, e.shiftKey, lv, GRS.tool);
  if (GRS.tool === 'line') {
    const l = GRS.pts[GRS.pts.length - 1],
      f0 = GRS.pts[0];
    if (GRS.pts.length >= 3 && Math.hypot(q.x - f0[0], q.z - f0[1]) < Math.max(0.03, 8 / GRS.view.s)) {
      GRS.pts.push([f0[0], f0[1]]);
      grFinishLine();
      return;
    }
    if (l && Math.hypot(q.x - l[0], q.z - l[1]) < 1e-3) {
      grFinishLine();
      return;
    }
    GRS.pts.push([q.x, q.z]);
    GRS.cur = null;
    GRS.dirty = 1;
  } else if (GRS.tool === 'rect') {
    if (!GRS.rect) {
      GRS.rect = { a: { x: q.x, z: q.z }, cx: e.clientX, cy: e.clientY, drag: true };
    } else {
      grFinishRect(q);
    }
    GRS.dirty = 1;
  }
}
function grFitSoon() {
  const b = grB();
  if (!b) return;
  GRS.fit = null;
  GRS.dirty = 1;
  try {
    grFitAfter();
  } catch (e) {
    logErr(e, 'grFitSoon');
  }
}
function grFitAfter() {
  const w = GRS.w;
  let n = 0;
  const st = () => {
    grFitRot();
    if (++n < 14 && Math.abs(GRS.rt - GRS.r) > 1e-3) w.requestAnimationFrame(st);
  };
  w.requestAnimationFrame(st);
}
function grFitRot() {
  const b = grB(),
    cw = gD('grCw');
  if (!b || !cw) return;
  const lv = grLv(b),
    c = Math.cos(GRS.rt),
    s = Math.sin(GRS.rt),
    L = grData(b);
  let u0 = 1e9,
    u1 = -1e9,
    w0 = 1e9,
    w1 = -1e9;
  L.forEach((l) =>
    l.bs.forEach((q) => {
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
  const W = Math.max(100, cw.clientWidth),
    H = Math.max(100, cw.clientHeight),
    sc = Math.min((W - 110) / Math.max(1, u1 - u0), (H - 110) / Math.max(1, w1 - w0)),
    uc = (u0 + u1) / 2,
    wc = (w0 + w1) / 2;
  GRS.view = { x: uc * c + wc * s, z: -uc * s + wc * c, s: Math.max(0.5, Math.min(400, sc)) };
  GRS.fit = b.id;
}
function grMove(e) {
  // ── Erweiterung aus 22-lod200-waende/030-aktionen.js
  const r = (() => {
    const b = grB();
    if (!b) return;
    const lv = grLv(b),
      p = grPt(e);
    if (GRS.pan) {
      const c = Math.cos(GRS.r),
        s = Math.sin(GRS.r),
        dx = (p.sx - GRS.pan.sx) / GRS.view.s,
        dy = (p.sy - GRS.pan.sy) / GRS.view.s;
      GRS.view.x = GRS.pan.x - (dx * c + dy * s);
      GRS.view.z = GRS.pan.z - (-dx * s + dy * c);
      GRS.dirty = 1;
      return;
    }
    if (GRS.ed) {
      const ed = GRS.ed;
      if (!ed.moved && Math.hypot(e.clientX - ed.px, e.clientY - ed.py) < 4) return;
      ed.moved = true;
      const q = grSnap(p, e.shiftKey, ed.lvx, 'line');
      GRS.cur = q;
      grEdUpdate(q);
      GRS.dirty = 1;
      return;
    }
    const nh = grNorthHit(p);
    if (nh !== GRS.nh) {
      GRS.nh = nh;
      GRS.dirty = 1;
      e.currentTarget.style.cursor = nh ? 'pointer' : '';
    }
    if (nh) return;
    if (GRS.tool === 'sel') {
      const h = grHit(p.x, p.z, lv),
        hd = GRS.sel && GRS.sel.k === 'c' ? grEdHit(lv, GRS.sel.g, p) : null,
        eh = hd ? { m: hd.m, k: hd.k, i: hd.i } : null;
      if (JSON.stringify(h) !== JSON.stringify(GRS.hover) || JSON.stringify(eh) !== JSON.stringify(GRS.eh)) {
        GRS.hover = h;
        GRS.eh = eh;
        GRS.dirty = 1;
      }
      e.currentTarget.style.cursor = hd ? (hd.m === 'v' ? 'crosshair' : 'move') : h ? 'pointer' : 'default';
    } else {
      GRS.cur = grSnap(p, e.shiftKey, lv, GRS.tool);
      GRS.dirty = 1;
      e.currentTarget.style.cursor = 'crosshair';
    }
  })();
  if (l2on()) {
    try {
      const b = grB();
      if (b && !GRS.pan) {
        const lv = grLv(b),
          p = grPt(e),
          w = lv.dg ? null : l2Hit(b, lv, p.x, p.z),
          id = w ? w.id : null;
        S.l2.mx = e.clientX;
        S.l2.my = e.clientY;
        if (id !== S.l2.hv) {
          S.l2.hv = id;
          GRS.dirty = 1;
          L2AN || l2Run();
        }
        l2Tip(w, e);
      }
    } catch (e) {
      logErr(e, 'grMove');
    }
  }
  return r;
}
function grUp(e) {
  const b = grB();
  if (GRS.ed) {
    const ed = GRS.ed;
    GRS.ed = null;
    GRS.pts = [];
    GRS.cur = null;
    GRS.dirty = 1;
    if (ed.moved && ed.map) grEditGrp(ed.g, ed.map);
    return;
  }
  if (GRS.pan) {
    const p = grPt(e);
    if (GRS.pan.clear && Math.hypot(p.sx - GRS.pan.sx, p.sy - GRS.pan.sy) < 4) {
      ((GRS.sel = null), (GRS.msel = []));
      GRS.ps = '';
    }
    GRS.pan = null;
    return;
  }
  if (!b) return;
  if (GRS.tool === 'rect' && GRS.rect && GRS.rect.drag) {
    if (Math.hypot(e.clientX - GRS.rect.cx, e.clientY - GRS.rect.cy) > 6) {
      const lv = grLv(b),
        q = grSnap(grPt(e), e.shiftKey, lv, 'rect');
      grFinishRect(q);
    } else GRS.rect.drag = false;
  }
}
function grWheel(e) {
  e.preventDefault();
  const p = grPt(e),
    f = Math.exp(-e.deltaY * 0.0016),
    ns = Math.max(0.4, Math.min(500, GRS.view.s * f)),
    c = Math.cos(GRS.r),
    sn = Math.sin(GRS.r),
    a = (p.sx - GRS.W / 2) / ns,
    bb = (p.sy - GRS.H / 2) / ns;
  GRS.view.x = p.x - (a * c + bb * sn);
  GRS.view.z = p.z - (-a * sn + bb * c);
  GRS.view.s = ns;
  GRS.dirty = 1;
}
function grStep(d) {
  const b = grB();
  if (!b) return;
  const L = grData(b),
    i = L.findIndex((l) => l.key === GRS.lv),
    j = Math.max(0, Math.min(L.length - 1, i + d));
  if (j !== i) {
    GRS.lv = L[j].key;
    ((GRS.sel = null), (GRS.msel = []));
    GRS.pts = [];
    GRS.rect = null;
    GRS.ps = '';
    GRS.dirty = 1;
    grTick();
  }
}
function grTool(t) {
  GRS.tool = t;
  GRS.pts = [];
  GRS.rect = null;
  GRS.hover = null;
  GRS.cur = null;
  GRS.dirty = 1;
  GRS.ps = '';
  try {
    ['sel', 'line', 'rect'].forEach((k) => {
      const e = gD('grT_' + k);
      e && e.classList.toggle('on', k === t);
    });
  } catch (e) {
    logErr(e, 'grTool');
  }
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js (danach)
  try {
    S.l2.cut = null;
    const e = gD('grT_trim');
    if (e) e.classList.toggle('on', t === 'trim');
    const cv = gD('grCv');
    if (cv) cv.style.cursor = t === 'trim' ? 'crosshair' : '';
    if (t === 'trim')
      l2Cap('Stutzen/Dehnen: Wand anklicken · Umschalt+Klick = einzelne Schneidkante · Esc beendet');
  } catch (e) {
    logErr(e, 'grTool');
  }
}
function grKey(e) {
  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js
  if (l2on() && GRS.tool === 'trim' && e.key === 'Escape') {
    grTool('sel');
    l2Cap('');
    return;
  }
  if (e.key === 'Escape' && !(GRS.ed || GRS.pts.length || GRS.rect)) {
    S.l2.sel = null;
    S.l2.pick = 0;
    S.l2.pt = null;
    S.l2.bsig = '';
    try {
      L2CF.close();
      L2C.ref = null;
    } catch (e) {
      logErr(e, 'grKey');
    }
  }
  const tg = e.target && e.target.tagName;
  if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const k = e.key,
    b = grB();
  if (e.code === 'Space') {
    GRS.space = true;
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
    e.preventDefault();
    GR.undo();
    return;
  }
  if (k === 'Escape') {
    if (GRS.ed) {
      GRS.ed = null;
      GRS.pts = [];
      GRS.cur = null;
    } else if (GRS.pts.length || GRS.rect) {
      GRS.pts = [];
      GRS.rect = null;
    } else if (GRS.sel) ((GRS.sel = null), (GRS.msel = []));
    else grTool('sel');
    GRS.dirty = 1;
    GRS.ps = '';
    return;
  }
  if (k === 'Enter') {
    if (GRS.tool === 'line') grFinishLine();
    return;
  }
  if (k === 'ArrowUp' || k === 'PageUp') {
    e.preventDefault();
    grStep(1);
    return;
  }
  if (k === 'ArrowDown' || k === 'PageDown') {
    e.preventDefault();
    grStep(-1);
    return;
  }
  const kl = k.toLowerCase();
  if (kl === 'v') grTool('sel');
  else if (kl === 'l') grTool('line');
  else if (kl === 'r') grTool('rect');
  else if (kl === 'f') grFit();
  else if (kl === 'n') GR.north();
  else if ((k === 'Delete' || k === 'Backspace') && GRS.sel) {
    e.preventDefault();
    GR.delSel();
  } else if (/^[1-9]$/.test(k) && GRS.sel && GRS.sel.k === 'u' && S.fa[+k - 1]) GR.setFa(S.fa[+k - 1].k);
}
