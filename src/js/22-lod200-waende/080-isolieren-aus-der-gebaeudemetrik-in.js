// ---- Isolieren aus der Gebäudemetrik in LOD 200: Volumenkörper wie LOD 100; NGF = Körper ohne Wände; KF = nur Wände
const ISOC = { kf: '#e08a2c', ngf: '#4f9d77', tr: '#3f6f9f' };
let L2IK = '';
G.l2n = new T.Group();
sc.add(G.l2n);
function l2HP(poly, A, B, inside) {
  const sd = (P) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]),
    f = inside ? 1 : -1,
    out = [];
  poly.forEach((P, i) => {
    const Q = poly[(i + 1) % poly.length],
      sp = sd(P) * f,
      sq = sd(Q) * f,
      pi = sp >= 0,
      qi = sq >= 0;
    if (pi) {
      out.push(P);
      if (!qi) {
        const t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    } else if (qi) {
      const t = sp / (sp - sq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  });
  return out.length > 2 ? out : [];
}
function l2Diff(poly, quad) {
  let q = quad;
  {
    let a = 0;
    for (let i = 0; i < 4; i++) {
      const p = q[i],
        n = q[(i + 1) % 4];
      a += p[0] * n[1] - n[0] * p[1];
    }
    if (a < 0) q = q.slice().reverse();
  }
  const bb = (r) => {
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      r.forEach((p) => {
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      });
      return [x0, x1, y0, y1];
    },
    a = bb(poly),
    c = bb(q);
  if (c[0] > a[1] || c[1] < a[0] || c[2] > a[3] || c[3] < a[2]) return [poly];
  let rem = poly;
  const res = [];
  for (let i = 0; i < 4 && rem.length; i++) {
    const A = q[i],
      B = q[(i + 1) % 4],
      o = l2HP(rem, A, B, false);
    if (o.length && l2Ar(o) > 1e-4) res.push(o);
    rem = l2HP(rem, A, B, true);
  }
  return res;
}
function l2LvMatch(b, i, sel) {
  const u = ugN(b);
  if (sel === 'all') return true;
  if (sel === 'o') return i >= u;
  if (sel === 'u') return i < u;
  if (sel.slice(0, 2) === 'n:') {
    const L = bLv(b)[i];
    return !!L && L.n === sel.slice(2);
  }
  return false;
}
function l2NetShow(iso) {
  while (G.l2n.children.length) {
    const o = G.l2n.children.pop();
    o.geometry && o.geometry.dispose();
    o.material && o.material.dispose && o.material.dispose();
  }
  if (!iso) return;
  const mat = new T.MeshLambertMaterial({ color: new T.Color(ISOC.ngf), side: T.DoubleSide }),
    dDE = l2T(S.l2.defs.DE).d;
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(iso.bid === '*' || iso.bid === b.id)) return;
    const G_ = l2Els(b),
      L = grData(b).filter((l) => !l.dg);
    L.forEach((lv, i) => {
      if (!l2LvMatch(b, i, iso.sel) || !G_.lv[i]) return;
      const qs = G_.els
          .filter((e) => e.li === i && e.quads && (e.kind === 'AW' || e.kind === 'TW' || e.kind === 'TH'))
          .reduce((r, e) => r.concat(e.quads), []),
        y0 = G_.lv[i].y0,
        hh = Math.max(0.1, lv.h - dDE);
      lv.faces.forEach((f) => {
        let ps = [f.o];
        qs.forEach((q) => {
          ps = ps.reduce((r, p) => r.concat(l2Diff(p, q)), []);
        });
        ps.forEach((p) => {
          if (l2Ar(p) < 2e-3) return;
          try {
            const P = grPrism({ o: p, h: [] }, 0, hh),
              m = new T.Mesh(P.g, mat);
            m.position.y = y0;
            m.userData = { bid: b.id, li: i, y0 };
            m.castShadow = false;
            m.raycast = () => {};
            G.l2n.add(m);
          } catch (e) {
            logErr(e, 'l2NetShow>anonym');
          }
        });
      });
    });
  });
  try {
    exApply();
  } catch (e) {
    logErr(e, 'l2NetShow');
  }
}
function l2IsoApply(force) {
  const iso = S.l2.iso,
    sp = typeof ZI !== 'undefined' && ZI.sp,
    on = l2on(),
    key = on ? JSON.stringify([iso && iso.key, sp && ZI.key, L2I.size, L2GEN]) : 'off';
  if (!force && key === L2IK) return;
  L2IK = key;
  if (!on) {
    if (S.l2.iso) S.l2.iso = null;
    l2NetShow(null);
    return;
  }
  l2NetShow(iso && iso.m === 'ngf' ? iso : null);
  for (const it of L2I.values()) {
    const e = it.el,
      b = S.bld.find((z) => z.id === e.bid);
    let vis = true,
      col = null;
    if (iso) {
      const lvOk = b && (iso.bid === '*' || iso.bid === e.bid) && l2LvMatch(b, e.li, iso.sel);
      if (iso.m === 'kf') {
        vis = !!lvOk && (e.kind === 'AW' || e.kind === 'TW' || e.kind === 'TH');
        col = ISOC.kf;
      } else if (iso.m === 'ty') {
        vis = e.T.id === iso.sel;
        col = null;
      } else if (iso.m === 'tr') {
        vis = !!b && l23() && (iso.bid === '*' || iso.bid === e.bid) && !!e.T.tr;
        col = null;
      } else vis = false;
    } else if (sp && b) {
      try {
        vis = !!zoIsoHit(sp, b, { hull: 1, k: e.li === b.levels.length ? 'roof' : e.li });
      } catch (_) {
        vis = true;
      }
    }
    it.g.visible = vis;
    if (it.ms) {
      const trm = !!(iso && iso.m === 'tr' && vis);
      it.ms.forEach((m) => m.color.set(col || m.userData.c0 || '#ffffff'));
      it.g.children.forEach((o) => {
        if (o.userData.ly == null) return;
        const off = trm && (!l2IsTr(e.T.layers[o.userData.ly]) || !!o.userData.ins);
        o.userData.off = off ? 1 : 0;
        o.visible = !off;
      });
    } else it.mat.color.set(col || L2K[e.kind].c);
  }
}
const l2IsTr = (L) => !!L && ['331', '341', '351', '322', '361'].indexOf(L.kg) >= 0;
function l2Tr(b) {
  let v = 0,
    n = 0;
  l2Els(b).els.forEach((e) => {
    if (!e.T.tr || !e.V) return;
    const D = e.T.layers.reduce((s, l) => s + l.d, 0) || 1,
      st = e.T.layers.filter(l2IsTr).reduce((s, l) => s + l.d, 0);
    v += (e.V * st) / D;
    n++;
  });
  return { v, n };
}
function L2ISO(m, bid, sel) {
  const k = m + '|' + bid + '|' + sel;
  if (S.l2.iso && S.l2.iso.key === k) S.l2.iso = null;
  else {
    S.l2.iso = { m, bid, sel, key: k };
    try {
      zoIsoClear(true);
    } catch (e) {
      logErr(e, 'L2ISO');
    }
  }
  l2IsoApply(true);
  try {
    zoRender();
    zoTick.k = undefined;
  } catch (e) {
    logErr(e, 'L2ISO');
  }
}
{
  const _p = zoPick;
  zoPick = function (i) {
    if (S.l2.iso) {
      S.l2.iso = null;
      l2IsoApply(true);
    }
    return _p.apply(this, arguments);
  };
}
{
  const _x3 = exApply;
  exApply = function () {
    const r = _x3.apply(this, arguments);
    try {
      G.l2n.children.forEach((m) => {
        const b = S.bld.find((z) => z.id === m.userData.bid);
        if (b) m.position.y = m.userData.y0 + exOff(b, m.userData.li);
      });
    } catch (e) {
      logErr(e, 'exApply');
    }
    return r;
  };
}
setInterval(() => {
  try {
    l2IsoApply();
  } catch (e) {
    console.warn('LOD200 Iso', e);
  }
}, 200);

// ---- LOD 300: alle Schichten der Bauteile in 3D (Aufbau aus dem Bauteilkonfigurator)
const L2CLIP = new T.Plane(new T.Vector3(0, -1, 0), 1e5);
try {
  ren.localClippingEnabled = true;
} catch (e) {
  logErr(e, 'init');
}
function l2SolidF(tris, off, yr) {
  const all = [],
    out = [],
    cnt = new Map(),
    kk = (P) => Math.round(P[0] * 1000) + ',' + Math.round(P[1] * 1000) + ',' + Math.round(P[2] * 1000),
    R_ = (P) => [P[0], P[1] - yr, P[2]],
    ek = (P, Q) => {
      const a = kk(P),
        c = kk(Q);
      return a < c ? a + '|' + c : c + '|' + a;
    };
  tris.forEach((t) => {
    const [A, B, C] = t.map(R_),
      [a, bb, c] = t.map((P) => off(R_(P)));
    out.push(...A, ...B, ...C);
    all.push(...A, ...B, ...C, ...a, ...c, ...bb);
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ].forEach(([i, j]) => {
      const k = ek(t[i], t[j]);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    });
  });
  tris.forEach((t) => {
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ].forEach(([i, j]) => {
      if (cnt.get(ek(t[i], t[j])) !== 1) return;
      const P = R_(t[i]),
        Q = R_(t[j]),
        P2 = off(P),
        Q2 = off(Q);
      all.push(...P, ...Q, ...Q2, ...P, ...Q2, ...P2);
    });
  });
  return { all, out };
}
function l2MeshL(e) {
  const g = new T.Group();
  g.position.y = e.y0;
  const Ls = e.T.layers,
    D = Ls.reduce((s, l) => s + l.d, 0) || 1,
    ms = [],
    K = e.kind,
    lm = new T.LineBasicMaterial({
      color: 0x33322e,
      transparent: true,
      opacity: 0.45,
      clippingPlanes: [L2CLIP],
    });
  const col = (n) => {
    try {
      return l2cCol(n);
    } catch (_) {
      return '#dddddd';
    }
  };
  const mat = (L, ro) => {
    const m = new T.MeshLambertMaterial({
      color: new T.Color(col(L.n)),
      side: T.DoubleSide,
      emissive: new T.Color(0x000000),
      clippingPlanes: [L2CLIP],
    });
    m.userData.c0 = col(L.n);
    try {
      l2MatFx(m, L.n);
    } catch (e) {
      logErr(e, 'mat');
    }
    if (ro) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -2;
    }
    ms.push(m);
    return m;
  };
  const prism = (f, hh, m, y) => {
    const P = grPrism(f, 0, hh),
      me = new T.Mesh(P.g, m);
    me.castShadow = me.receiveShadow = true;
    me.raycast = () => {};
    me.userData.ly = cur;
    me.position.y = y;
    g.add(me);
    {
      const bm = l2BackMesh(P.g, m, y);
      if (bm) {
        bm.userData.ly = cur;
        g.add(bm);
      }
    }
  };
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    sl = (q, t0, t1) => [lp(q[0], q[3], t0), lp(q[1], q[2], t0), lp(q[1], q[2], t1), lp(q[0], q[3], t1)];
  const tri = (all, out, m) => {
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.BufferAttribute(new Float32Array(all), 3));
    gg.computeVertexNormals();
    const me = new T.Mesh(gg, m);
    me.castShadow = me.receiveShadow = true;
    me.raycast = () => {};
    me.userData.ly = cur;
    g.add(me);
    {
      const bm = l2BackMesh(gg, m, 0);
      if (bm) {
        bm.userData.ly = cur;
        g.add(bm);
      }
    }
    const go = new T.BufferGeometry();
    go.setAttribute('position', new T.BufferAttribute(new Float32Array(out), 3));
    const eg = new T.EdgesGeometry(go, 25);
    go.dispose();
    if (!e.rt) {
      eg.dispose();
      return;
    }
    const ln = new T.LineSegments(eg, lm);
    ln.raycast = () => {};
    ln.userData.ly = cur;
    g.add(ln);
  };
  let c = 0,
    cur = -1;
  if (e.gb) {
    const G = e.gb,
      dd = 0.004;
    Ls.forEach((L, ix) => {
      cur = ix;
      const so = D - (c + L.d),
        si = D - c;
      c += L.d;
      const t0 = G.t.map((t) =>
          t.map((P) => [P[0] + G.nx * (dd + (G.sh || 0) - so), P[1], P[2] + G.nz * (dd + (G.sh || 0) - so)]),
        ),
        S_ = l2SolidF(t0, (P) => [P[0] - G.nx * (si - so), P[1], P[2] - G.nz * (si - so)], G.yr);
      tri(S_.all, S_.out, mat(L));
    });
  } else if (e.rt) {
    const R_ = e.rt;
    Ls.forEach((L, ix) => {
      cur = ix;
      const c0 = c,
        v0 = c / R_.cs,
        v1 = (c + L.d) / R_.cs;
      c += L.d;
      const t0 = R_.trs.map((t) => t.map((P) => [P[0], P[1] - v0, P[2]])),
        S_ = l2SolidF(t0, (P) => [P[0], Math.max(P[1] - (v1 - v0), 0), P[2]], R_.yr),
        n0 = g.children.length;
      tri(S_.all, S_.out, mat(L.sp ? { n: 'Dämmung' } : L, 1));
      if (L.sp) {
        for (let q = n0; q < g.children.length; q++) g.children[q].userData.ins = 1;
        l2Rafters(g, R_, L, c0, mat({ n: 'Sparren' }), lm, cur);
      }
    });
  } else if (e.quads) {
    const AW = K === 'AW',
      bi = AW
        ? Math.max(
            0,
            Ls.findIndex((l) => L2ST.indexOf(l.kg) >= 0),
          )
        : -1;
    Ls.forEach((L, ix) => {
      cur = ix;
      const t0 = AW ? (D - (c + L.d)) / D : c / D,
        t1 = AW ? (D - c) / D : (c + L.d) / D;
      c += L.d;
      const m = mat(L),
        fz = AW && ix > bi && e.hTop != null;
      /* Fassadenschichten (außerhalb der Tragschicht) laufen vor der Geschossdecke durch bis Oberkante Decke; Tragschicht und Innenschichten enden unter der Decke */
      const QS = e.gq
        ? (() => {
            const da = t0 * D,
              db = t1 * D,
              G = Object.values(e.gq).find((g) => da >= g.a - 1e-6 && db <= g.b + 1e-6);
            if (!G) return [];
            const w = G.b - G.a || 1;
            return [sl(G.q, (da - G.a) / w, (db - G.a) / w)];
          })()
        : e.quads.map((q) => sl(q, t0, t1));
      const ovr =
        AW &&
        e.ovh &&
        !fz &&
        e.hTop >
          0; /* Überhang: nur die Fassadenschichten reichen bis zur Unterkante der Geschossdecke, Tragschicht und Innenschichten stehen auf der Decke */
      QS.forEach((o) =>
        prism(
          { o, h: [] },
          ovr ? e.h - e.hTop : e.h + (fz ? (e.hTop || 0) + (e.hAt || 0) : 0),
          m,
          ovr ? e.hTop : 0,
        ),
      );
      if (e.hAt && !fz) QS.forEach((o) => prism({ o, h: [] }, e.hAt, m, e.h + (e.hTop || 0)));
    });
  } else if (e.faces) {
    Ls.forEach((L, ix) => {
      cur = ix;
      const yb = e.h - (c + L.d);
      c += L.d;
      const m = mat(L);
      e.faces.forEach((f) => prism(f, L.d, m, yb));
    });
  }
  if (!ms.length) return l2MeshOrig(e);
  return { g, mat: ms[0], ms };
}
function l2LayerQs(e) {
  const Ls = e.T.layers,
    D = Ls.reduce((s, l) => s + l.d, 0) || 1,
    AW = e.kind === 'AW',
    bi = AW
      ? Math.max(
          0,
          Ls.findIndex((l) => L2ST.indexOf(l.kg) >= 0),
        )
      : -1,
    out = [];
  let c = 0;
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    sl = (q, t0, t1) => [lp(q[0], q[3], t0), lp(q[1], q[2], t0), lp(q[1], q[2], t1), lp(q[0], q[3], t1)];
  Ls.forEach((L, ix) => {
    const t0 = AW ? (D - (c + L.d)) / D : c / D,
      t1 = AW ? (D - c) / D : (c + L.d) / D;
    c += L.d;
    if (e.gq) {
      const da = t0 * D,
        db = t1 * D,
        G = Object.values(e.gq).find((g) => da >= g.a - 1e-6 && db <= g.b + 1e-6);
      if (G) {
        const w = G.b - G.a || 1;
        out.push({ L, o: sl(G.q, (da - G.a) / w, (db - G.a) / w) });
      }
    } else e.quads.forEach((q) => out.push({ L, o: sl(q, t0, t1) }));
  });
  return out;
}
const l2MeshOrig = l2Mesh;
{
  const _m = l2Mesh;
  l2Mesh = function (e) {
    if (!l23()) return _m(e);
    try {
      return l2MeshL(e);
    } catch (err) {
      console.warn('LOD300', err);
      return _m(e);
    }
  };
}
