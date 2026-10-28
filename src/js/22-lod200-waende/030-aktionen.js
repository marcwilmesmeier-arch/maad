// ---- Aktionen (mit Rückgängig über grEdit)
function l2SetType(el, id, all) {
  const T0 = l2T(id);
  if (!el) return;
  grEdit((b) => {
    if (all) {
      S.l2.defs[el.kind] = id;
      b.levels.forEach((l) => {
        if (l.l2 && l.l2.ty) l.l2.ty = l.l2.ty.filter((q) => q.k !== el.kind);
      });
    } else {
      const lv = grLv(b),
        D = (lv.obj.l2 = lv.obj.l2 || { al: {}, ty: [] });
      const tg = el.gid
        ? l2Els(b).els.filter((x) => x.li === el.li && x.gid === el.gid && x.kind === el.kind)
        : [el];
      tg.forEach((w) => {
        D.ty = (D.ty || []).filter(
          (q) => !(q.k === w.kind && Math.hypot(q.p[0] - w.p[0], q.p[1] - w.p[1]) < 0.4),
        );
        if (T0.id !== S.l2.defs[w.kind]) D.ty.push({ k: w.kind, p: [gr2(w.p[0]), gr2(w.p[1])], id });
      });
    }
    b._l2 = null;
  });
  S.l2.pick = 0;
  S.l2.flash = el.id;
  l2Bar(true);
}
function l2SetDef(kind, id) {
  grEdit((b) => {
    S.l2.defs[kind] = id;
    b.levels.forEach((l) => {
      if (l.l2 && l.l2.ty) l.l2.ty = l.l2.ty.filter((q) => q.k !== kind);
    });
    b._l2 = null;
  });
}
function l2SetAl(g, al) {
  grEdit((b) => {
    const lv = grLv(b),
      D = (lv.obj.l2 = lv.obj.l2 || { al: {}, ty: [] });
    D.al[g] = al;
    b._l2 = null;
  });
  S.l2.flashG = g;
}
function l2Target() {
  const b = grB();
  if (!b || b._y == null) return null;
  const G_ = l2Els(b),
    lv = grLv(b);
  if (!lv || lv.dg) return null;
  const li = G_.lv.findIndex((l) => l.li === lv.i);
  let el = S.l2.sel && G_.els.find((x) => x.id === S.l2.sel);
  if (!el && GRS.sel && GRS.sel.k === 'c') {
    el = G_.els.find((x) => x.li === lv.i && x.gid === GRS.sel.g && x.kind !== 'AW');
  }
  return el ? { el, b, G: G_, lv } : null;
}
function l2Hit(b, lv, x, z) {
  const G_ = l2Els(b),
    tol = 7 / GRS.view.s;
  let best = null,
    bd = 1e9;
  for (const e of G_.els) {
    if (e.li !== lv.i || !e.quads) continue;
    let d = 1e9;
    for (const q of e.quads) {
      if (l2PIn(q, x, z)) {
        d = 0;
        break;
      }
      for (let i = 0; i < 4; i++) {
        const a = q[i],
          c = q[(i + 1) % 4];
        d = Math.min(d, l2Seg(x, z, [a[0], a[1], c[0], c[1]]));
      }
    }
    if (d <= tol && (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && best && e.len < best.len))) {
      bd = d;
      best = e;
    }
  }
  return best;
}
// ---- 3D
G.l2 = new T.Group();
sc.add(G.l2);
const L2I = new Map();
let L2SIG = '',
  L2AN = 0,
  L2VIS = false,
  L2GEN = 0;
function l2Dispose(g) {
  g.traverse((o) => {
    o.geometry && o.geometry.dispose();
    o.material && o.material.dispose && o.material.dispose();
  });
}
function l2Mesh(e) {
  const g = new T.Group();
  g.position.y = e.y0;
  const K = L2K[e.kind],
    mat = new T.MeshLambertMaterial({
      color: new T.Color(K.c),
      side: T.DoubleSide,
      emissive: new T.Color(0x000000),
    }),
    add = (f, hh) => {
      const P = grPrism(f, 0, hh || e.h),
        m = new T.Mesh(P.g, mat);
      m.castShadow = m.receiveShadow = true;
      m.raycast = () => {};
      g.add(m);
      const lg = new T.BufferGeometry();
      lg.setAttribute('position', new T.BufferAttribute(new Float32Array(P.ln), 3));
      const ln = new T.LineSegments(
        lg,
        new T.LineBasicMaterial({ color: new T.Color(K.c2), transparent: true, opacity: 0.55 }),
      );
      ln.raycast = () => {};
      g.add(ln);
    };
  if (e.tri) {
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.BufferAttribute(new Float32Array(e.tri), 3));
    gg.computeVertexNormals();
    if (e.kind === 'RD') {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
    }
    const m = new T.Mesh(gg, mat);
    m.castShadow = m.receiveShadow = true;
    m.raycast = () => {};
    g.add(m);
    const go = new T.BufferGeometry();
    go.setAttribute('position', new T.BufferAttribute(new Float32Array(e.tro), 3));
    const eg = new T.EdgesGeometry(go, 25);
    go.dispose();
    const ln = new T.LineSegments(
      eg,
      new T.LineBasicMaterial({ color: new T.Color(K.c2), transparent: true, opacity: 0.6 }),
    );
    ln.raycast = () => {};
    g.add(ln);
  } else if (e.quads) e.quads.forEach((q) => add({ o: q, h: [] }));
  else e.faces.forEach((f) => add(f));
  if (e.quads2) {
    const n0 = g.children.length;
    e.quads2.forEach((q) => add({ o: q, h: [] }, e.hTop));
    for (let i = n0; i < g.children.length; i++) g.children[i].position.y = e.h;
  }
  if (e.hAt) {
    const n1 = g.children.length;
    e.quads.forEach((q) => add({ o: q, h: [] }, e.hAt));
    for (let i = n1; i < g.children.length; i++) g.children[i].position.y = e.h + e.hTop;
  }
  return { g, mat };
}
function l2Sync() {
  const bs = S.bld.filter((b) => !b.ex && b._y != null),
    sig = bs.map((b) => b.id + '|' + l2Els(b).k).join('#') + (l23() ? l2mSig() : '');
  if (sig !== L2SIG) {
    L2SIG = sig;
    const seen = new Set(),
      now = performance.now();
    let n = 0;
    bs.forEach((b) =>
      l2Els(b).els.forEach((e) => {
        const h = JSON.stringify([
            e.tri ? e.tri.length + ':' + e.tri.reduce((s, v) => s + v, 0).toFixed(2) : 0,
            e.quads || e.faces.map((f) => f.o),
            e.quads2 || 0,
            e.hAt || 0,
            e.y0,
            e.h,
            e.T.id,
            S.lod,
            l23() ? l2mSig() : 0,
          ]).replace(/(\d+\.\d{3})\d+/g, '$1'),
          old = L2I.get(e.id);
        seen.add(e.id);
        if (old && old.h === h) return;
        if (old) {
          G.l2.remove(old.g);
          l2Dispose(old.g);
        }
        L2GEN++;
        const m = l2Mesh(e);
        G.l2.add(m.g);
        L2I.set(e.id, {
          g: m.g,
          mat: m.mat,
          ms: m.ms,
          h,
          el: e,
          t0: now + (old ? 0 : e.li * 160 + (n++ % 40) * 18),
          pop: old ? 1 : 0,
          dur: old ? 380 : 620,
        });
        m.g.scale.y = 0.001;
        m.mat.transparent = true;
        m.mat.opacity = 0;
      }),
    );
    for (const [id, it] of L2I)
      if (!seen.has(id)) {
        G.l2.remove(it.g);
        l2Dispose(it.g);
        L2I.delete(id);
      }
    try {
      exApply();
    } catch (e) {
      logErr(e, 'l2Sync');
    }
    l2Run();
  }
}
function l2Run() {
  if (L2AN) return;
  L2AN = 1;
  const st = () => {
    const now = performance.now();
    let live = 0;
    for (const it of L2I.values()) {
      let k = (now - it.t0) / it.dur;
      const sel =
        S.l2.sel === it.el.id ||
        (it.el.gid && S.l2.flashG && S.l2.flashG === it.el.gid && it.el.li === S.l2.fl);
      if (k < 1) {
        live = 1;
        const kk = Math.max(0, k),
          e = it.pop ? 1 - Math.pow(1 - kk, 3) : 1 + 2.7 * Math.pow(kk - 1, 3) + 1.7 * Math.pow(kk - 1, 2);
        it.g.scale.y = Math.max(0.001, it.pop ? 0.7 + 0.3 * e : e);
        it.mat.opacity = Math.min(1, kk * 2.2);
        it.mat.transparent = true;
        it.mat.emissive.setRGB(0.12 * (1 - kk), 0.3 * (1 - kk), 0.6 * (1 - kk));
      } else if (it.mat.transparent && !sel) {
        it.g.scale.y = 1;
        it.mat.opacity = 1;
        it.mat.transparent = false;
        it.mat.emissive.setRGB(0, 0, 0);
        it.mat.needsUpdate = true;
      }
      if (k >= 1) {
        const on = S.l2.sel === it.el.id,
          hv = S.l2.hv === it.el.id,
          pul = on ? 0.5 + 0.5 * Math.sin(now / 260) : 0;
        it.mat.emissive.setRGB(
          on ? 0.08 + 0.1 * pul : hv ? 0.05 : 0,
          on ? 0.22 + 0.16 * pul : hv ? 0.12 : 0,
          on ? 0.5 + 0.2 * pul : hv ? 0.25 : 0,
        );
        if (on) live = 1;
      }
      if (it.ms)
        for (const m of it.ms)
          if (m !== it.mat) {
            m.opacity = it.mat.opacity;
            if (m.transparent !== it.mat.transparent) {
              m.transparent = it.mat.transparent;
              m.needsUpdate = true;
            }
            m.emissive.copy(it.mat.emissive);
          }
    }
    if (live) requestAnimationFrame(st);
    else L2AN = 0;
  };
  requestAnimationFrame(st);
}
function l2Vis() {
  const on = l2on();
  G.l2.visible = on;
  if (on) {
    const ex = !!(S.expl && S.expl.cur > 0.05) || l23();
    for (const it of L2I.values())
      it.g.children.forEach((o) => {
        if (o.userData.off) return;
        if (o.isLineSegments && o.visible !== ex) o.visible = ex;
        if (o.isMesh && o.receiveShadow !== ex) {
          o.receiveShadow = ex;
          o.material.needsUpdate = true;
        }
      });
  }
  if (on) {
    S.bld.forEach((b) => {
      if (b.ex || !b._g) return;
      b._g.visible = true;
      try {
        exTag(b).forEach((t) => {
          t.o.visible =
            t.k === 'roof' &&
            !(b._rp && b._rp.pr && b._rp.pr.length && b.roof && b.roof.type && b.roof.type !== 'flat');
        });
      } catch (_) {
        b._g.visible = false;
      }
    });
    G.un.visible = false;
    L2VIS = true;
  } else if (L2VIS) {
    L2VIS = false;
    S.bld.forEach((b) => {
      if (b._g) {
        b._g.visible = true;
        b._g.children.forEach((o) => {
          o.visible = true;
        });
      }
    });
    try {
      G.un.visible = zoUnVis();
    } catch (_) {
      G.un.visible = true;
    }
  }
}
setInterval(() => {
  try {
    l2Vis();
    if (l2on()) l2Sync();
  } catch (e) {
    console.warn('LOD200', e);
  }
}, 140);
document.addEventListener('lotlod', () => {
  L2SIG = '';
  S.bld.forEach((b) => {
    b._gr = null;
  });
  S.l2.sel = null;
  l2Vis();
  if (l2on()) {
    l2Sync();
    l2Run();
  }
  GRS.ps = '';
  GRS.dirty = 1;
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'init>anonym');
  }
});
// ---- Grundriss: Darstellung, Treffer, Hover
{
  const _d = grDraw;
  grDraw = function () {
    const r = _d.apply(this, arguments);
    if (l2on())
      try {
        l2Draw();
      } catch (e) {
        console.warn('LOD200 Plan', e);
      }
    else l2BarHide();
    return r;
  };
}
function l2Draw() {
  const cv = gD('grCv'),
    b = grB();
  if (!cv || !b || b._y == null) return;
  const lv = grLv(b);
  if (!lv || lv.dg) return;
  const x = cv.getContext('2d'),
    dpr = (GRS.w && GRS.w.devicePixelRatio) || 1,
    G_ = l2Els(b),
    now = performance.now();
  x.save();
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  let anim = 0;
  const path = (q) => {
    x.beginPath();
    q.forEach((p, i) => {
      const [X, Y] = grTf(p[0], p[1]);
      i ? x.lineTo(X, Y) : x.moveTo(X, Y);
    });
    x.closePath();
  };
  const wl = G_.els.filter((e) => e.li === lv.i && e.quads),
    blk = S.l2.wc === 'k';
  x.save();
  x.setLineDash([6, 4]);
  x.strokeStyle = 'rgba(90,106,116,.8)';
  x.lineWidth = 1;
  (lv.obj.cuts || []).forEach((c) => {
    const a = grTf(c[0], c[1]),
      z = grTf(c[2], c[3]);
    x.beginPath();
    x.moveTo(a[0], a[1]);
    x.lineTo(z[0], z[1]);
    x.stroke();
  });
  x.restore();
  wl.forEach((e) => {
    let born = L2B.get(e.id);
    if (born == null) {
      born = now;
      L2B.set(e.id, born);
    }
    e._k = Math.min(1, (now - born) / 380);
    if (e._k < 1) anim = 1;
  });
  // 1) Umrisse (dick, schwarz), 2) Füllung deckt innere Fugen ab -> verbundene Wände ohne Trennlinie
  x.lineJoin = 'miter';
  x.strokeStyle = '#111';
  x.lineWidth = 2.4;
  wl.forEach((e) => {
    x.globalAlpha = 0.25 + 0.75 * e._k;
    e.quads.forEach((q) => {
      path(q);
      x.stroke();
    });
  });
  const isSel = (e) => S.l2.sel === e.id || (GRS.sel && GRS.sel.k === 'c' && e.gid && e.gid === GRS.sel.g);
  wl.forEach((e) => {
    const sel = isSel(e),
      hv = S.l2.hv === e.id || S.l2.cut === e.id,
      col = sel ? '#dce8fb' : blk ? (hv ? '#333' : '#111') : hv ? '#e4e4e4' : '#bdbdbd';
    x.globalAlpha = 0.25 + 0.75 * e._k;
    x.fillStyle = col;
    x.strokeStyle = col;
    x.lineWidth = 1.2;
    e.quads.forEach((q) => {
      path(q);
      x.fill();
      x.stroke();
    });
  });
  if (l23()) {
    x.lineJoin = 'miter';
    wl.forEach((e) => {
      if (!e.T || !e.T.layers || e.kind === 'DE' || e.kind === 'BP') return;
      x.globalAlpha = 0.25 + 0.75 * e._k;
      try {
        l2LayerQs(e).forEach((z) => {
          path(z.o);
          x.fillStyle = l2cCol(z.L.n);
          x.fill();
          x.strokeStyle = 'rgba(30,30,30,.7)';
          x.lineWidth = 0.7;
          x.stroke();
        });
      } catch (e) {
        logErr(e, 'l2Draw>anonym');
      }
    });
    x.globalAlpha = 1;
    x.strokeStyle = '#111';
    x.lineWidth = 1.6;
    wl.forEach((e) =>
      e.quads.forEach((q) => {
        path(q);
        x.stroke();
      }),
    );
    const cn = G_.cn || {};
    for (const k in cn) {
      const c = cn[k];
      if (c.li !== lv.i) continue;
      const [X, Y] = grTf(c.P[0], c.P[1]);
      x.beginPath();
      x.arc(X, Y, 4, 0, 7);
      x.fillStyle = '#fff';
      x.fill();
      x.strokeStyle = '#3b7bd8';
      x.lineWidth = 1.3;
      x.stroke();
    }
  }
  x.globalAlpha = 1;
  wl.forEach((e) => {
    if (!isSel(e)) return;
    x.strokeStyle = '#3b7bd8';
    x.lineWidth = 1.4;
    x.setLineDash([]);
    e.quads.forEach((q) => {
      path(q);
      x.stroke();
    });
    if (e.kind !== 'AW') {
      e.quads.forEach((q) => {
        const a = [(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2],
          b = [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2],
          A = grTf(a[0], a[1]),
          B = grTf(b[0], b[1]);
        x.save();
        x.setLineDash([3, 3]);
        x.strokeStyle = '#3b7bd8';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(A[0], A[1]);
        x.lineTo(B[0], B[1]);
        x.stroke();
        x.restore();
      });
    }
  });
  // weiße Kugeln an Endpunkten und Verbindungspunkten der gewählten Wand (Endpunkte ziehbar wie die Griffe der Schnittgruppe)
  {
    const T0 = l2Target();
    if (T0 && T0.el.gid && T0.el.kind !== 'AW') {
      const gp = grGrp(lv, T0.el.gid),
        eh = GRS.eh,
        ball = (X, Y, r, hot) => {
          x.beginPath();
          x.arc(X, Y, r, 0, 7);
          x.fillStyle = hot ? '#3b7bd8' : '#fff';
          x.fill();
          x.lineWidth = 1.3;
          x.strokeStyle = hot ? '#fff' : '#5a6a74';
          x.stroke();
        };
      const seen = new Set();
      gp.vs.forEach((v) => {
        const [X, Y] = grTf(...l2Disp(lv, T0.el.gid, v.p));
        seen.add(l2k(v.p));
        ball(
          X,
          Y,
          6.5,
          (eh && eh.m === 'v' && eh.k === v.k) ||
            (S.l2.pt && Math.hypot(S.l2.pt.p[0] - v.p[0], S.l2.pt.p[1] - v.p[1]) < 0.02),
        );
      });
      G_.els.filter((e) => e.li === lv.i && e.gid === T0.el.gid).forEach((e) => {});
      const cs = (lv.obj.cuts || []).filter((c) => c[4] === T0.el.gid);
      G_.els
        .filter((e) => e.li === lv.i && e.kind !== 'AW' && e.quads && e.gid !== T0.el.gid)
        .forEach((o) => {
          cs.forEach((c) => {
            [
              [c[0], c[1]],
              [c[2], c[3]],
            ].forEach((p) => {});
          });
        });
      // Verbindungspunkte: Knoten der Kantenzerlegung auf der gewählten Linie
      const ends = new Set();
      cs.forEach((c) => {
        ends.add(l2k([c[0], c[1]]));
        ends.add(l2k([c[2], c[3]]));
      });
      lv.faces.forEach((f) =>
        [f.o].concat(f.h).forEach((r) =>
          r.forEach((p) => {
            const k = l2k(p);
            if (seen.has(k)) return;
            if (cs.some((c) => l2Seg(p[0], p[1], c) < 0.02)) {
              seen.add(k);
              const [X, Y] = grTf(p[0], p[1]);
              ball(X, Y, 4.5, false);
            }
          }),
        ),
      );
    }
  }
  // Ausrichtungsmarke an gewählter Schnittgruppe
  const T_ = l2Target();
  if (T_ && T_.el.gid && T_.el.kind !== 'AW') {
    const D = l2Data(T_.lv),
      al = D.al[T_.el.gid] || 'm',
      c = (T_.lv.obj.cuts || []).filter((c) => c[4] === T_.el.gid);
    x.save();
    x.setLineDash([5, 4]);
    x.strokeStyle = '#1f6fd1';
    x.lineWidth = 1.3;
    c.forEach((c) => {
      const a = grTf(...l2Disp(T_.lv, c[4], [c[0], c[1]])),
        z = grTf(...l2Disp(T_.lv, c[4], [c[2], c[3]]));
      x.beginPath();
      x.moveTo(a[0], a[1]);
      x.lineTo(z[0], z[1]);
      x.stroke();
    });
    x.restore();
  }
  x.restore();
  if (anim) GRS.dirty = 1;
  l2Bar();
}
const L2B = new Map();
{
  const _m = grMove;
  grMove = function (e) {
    const r = _m.apply(this, arguments);
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
  };
}
{
  const _g = grDown;
  grDown = function (e) {
    if (
      l2on() &&
      GRS.tool === 'sel' &&
      e.button === 0 &&
      !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
    ) {
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
    return _g.apply(this, arguments);
  };
}
