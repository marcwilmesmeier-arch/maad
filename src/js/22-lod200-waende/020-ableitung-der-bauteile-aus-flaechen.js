// ---- Ableitung der Bauteile aus Flächen und Schnittlinien
function l2Geo(b) {
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js
  let r = l2GeoStufe1.apply(this, arguments);
  if (!l23() || !r || !r.probe) return r;
  const m = {};
  r.probe.forEach((p) => {
    if (!p.vk) return;
    m[p.vk] = m[p.vk] == null ? p.t : Math.min(m[p.vk], p.t);
  });
  if (JSON.stringify(m) !== JSON.stringify(b._l2ref || {})) {
    b._l2ref = m;
    b._l2 = null;
    r = l2GeoStufe1.apply(this, arguments);
  }
  return r;
}
// l2Geo() ohne die Erweiterungen darüber – wird von l2Geo() gezielt aufgerufen
function l2GeoStufe1(b) {
  // ── Erweiterung aus 23-bauteilkonfigurator/020-projekt.js
  try {
    l2Reg(b);
  } catch (e) {
    logErr(e, 'l2Geo');
  }
  const key =
    grSig(b) +
    '|' +
    JSON.stringify(b.levels.map((l) => l.l2 || 0)) +
    JSON.stringify(S.l2.defs) +
    '|' +
    b._y +
    '|' +
    ((b.l2 && b.l2.r) || '') +
    '|' +
    JSON.stringify(b.fd || 0) +
    JSON.stringify(S.ft.map((t) => t.k + t.n)) +
    (l23()
      ? '|d' + JSON.stringify([b._l2ref || 0, (b.l2 && b.l2.rw) || 0, (b.l2 && b.l2.cn) || 0])
      : '|c' + JSON.stringify([(b.l2 && b.l2.c) || 0, (b.l2 && b.l2.rwc) || 0]));
  if (b._l2 && b._l2.k === key) return b._l2;
  const L = grData(b).filter((l) => !l.dg),
    R = { k: key, els: [], lv: [], b, probe: [] };
  const C = !l23(),
    DF = C ? l2DefC(b) : S.l2.defs,
    dDE = l2T(DF.DE).d;
  let y = b._y || 0;
  let prevOuter = null;
  L.forEach((lv, li) => {
    const D = l2Data(lv),
      cuts = lv.obj.cuts || [],
      E = new Map(),
      hW = lv.h - dDE,
      tyOf = (kind, p) => {
        const o = ((C ? D.tc : D.ty) || []).find(
          (q) => q.k === kind && Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < 0.4,
        );
        return l2T(o ? o.id : DF[kind]);
      };
    lv.faces.forEach((f, fi) =>
      [f.o].concat(f.h).forEach((r) =>
        r.forEach((p, i) => {
          const q = r[(i + 1) % r.length],
            a = l2k(p),
            c = l2k(q);
          if (a === c) return;
          const ek = a < c ? a + '|' + c : c + '|' + a;
          let e = E.get(ek);
          if (!e) E.set(ek, (e = { p, q, f: [], ek }));
          e.f.push(fi);
        }),
      ),
    );
    const edges = [];
    const EL = [];
    for (const e0 of E.values()) {
      if (e0.f.length === 1 && b.fd && !C) {
        const sp = l2SplitEdge(b, li, lv, e0);
        if (sp) {
          sp.forEach((x) => EL.push(x));
          continue;
        }
      }
      EL.push(e0);
    }
    for (const e of EL) {
      let kind,
        gid = 0;
      if (e.f.length === 1) kind = 'AW';
      else {
        if (e.f[0] === e.f[1]) continue;
        const fa = e.f.map((i) => lv.faces[i].fa);
        kind = fa.includes('th') || fa.includes('az') ? 'TH' : 'TW';
      }
      const mx = (e.p[0] + e.q[0]) / 2,
        mz = (e.p[1] + e.q[1]) / 2;
      let cd = null;
      if (kind !== 'AW')
        for (const c of cuts) {
          if (l2Seg(mx, mz, c) < 0.02) {
            gid = c[4];
            cd = [c[2] - c[0], c[3] - c[1]];
            break;
          }
        }
      let dx = e.q[0] - e.p[0],
        dz = e.q[1] - e.p[1];
      const Ln = Math.hypot(dx, dz);
      dx /= Ln;
      dz /= Ln;
      const ref = cd || [dx, dz],
        sg = dx * ref[0] + dz * ref[1] < 0 ? -1 : 1,
        ux = dx * sg,
        uz = dz * sg,
        A = sg > 0 ? e.p : e.q,
        B = sg > 0 ? e.q : e.p,
        cl = Math.hypot(ref[0], ref[1]) || 1;
      const uc = cd ? [cd[0] / cl, cd[1] / cl] : [ux, uz];
      let kx = ux,
        kz = uz;
      if (kx < -1e-9 || (Math.abs(kx) < 1e-9 && kz < 0)) {
        kx = -kx;
        kz = -kz;
      }
      const ang = Math.round(Math.atan2(kz, kx) * 1000),
        off = Math.round((-kz * mx + kx * mz) * 100),
        t0 = kx * A[0] + kz * A[1],
        t1 = kx * B[0] + kz * B[1];
      const ftk = kind === 'AW' && !C ? l2FacAt(b, li, lv, e, mx, mz) : '';
      edges.push({
        e,
        kind,
        gid,
        mx,
        mz,
        ftk,
        ux: uc[0],
        uz: uc[1],
        kx,
        kz,
        A,
        B,
        ta: Math.min(t0, t1),
        tb: Math.max(t0, t1),
        key: kind + '|' + gid + '|' + ang + '|' + off + '|' + ftk,
        L: Ln,
      });
    }
    // Läufe (kollineare Kanten gleicher Art und Schnittgruppe)
    const grp = new Map();
    edges.forEach((g) => {
      let a = grp.get(g.key);
      if (!a) grp.set(g.key, (a = []));
      a.push(g);
    });
    const runs = [];
    for (const a of grp.values()) {
      a.sort((p, q) => p.ta - q.ta);
      let cur = null;
      for (const g of a) {
        if (cur && g.ta <= cur.tb + 0.02) {
          cur.es.push(g);
          cur.tb = Math.max(cur.tb, g.tb);
        } else {
          cur = {
            kind: g.kind,
            gid: g.gid,
            ftk: g.ftk,
            es: [g],
            ta: g.ta,
            tb: g.tb,
            kx: g.kx,
            kz: g.kz,
            ux: g.ux,
            uz: g.uz,
          };
          runs.push(cur);
        }
      }
    }
    const nodeD = new Map(),
      ext = [];
    runs.forEach((r) => {
      const g = r.es[0],
        tm = (r.ta + r.tb) / 2,
        pm = [
          g.kx * tm + -g.kz * (-g.kz * g.mx + g.kx * g.mz),
          g.kz * tm + g.kx * (-g.kz * g.mx + g.kx * g.mz),
        ];
      r.p = pm;
      r.len = r.tb - r.ta;
      {
        const o0 = -g.kz * g.mx + g.kx * g.mz;
        r.sa = [g.kx * r.ta - g.kz * o0, g.kz * r.ta + g.kx * o0];
        r.sb = [g.kx * r.tb - g.kz * o0, g.kz * r.tb + g.kx * o0];
      }
      r.T = r.kind === 'AW' && r.ftk ? l2FacT(tyOf(r.kind, pm), r.ftk) : tyOf(r.kind, pm);
      r.d = r.T.d;
      if (r.kind === 'AW' && !C) {
        r.tOut = l2Tout(r.T);
        r.vk = l2View(b, r, lv);
        R.probe.push({ vk: r.vk, t: r.tOut });
        const rf = b._l2ref && r.vk ? b._l2ref[r.vk] : null;
        r.sh = rf != null ? Math.max(0, Math.round((r.tOut - rf) * 1000) / 1000) : 0;
      }
      r.h = hW;
      r.y0 = y;
      r.li = li;
      r.id =
        b.id +
        ':' +
        li +
        ':' +
        r.kind +
        ':' +
        r.gid +
        ':' +
        Math.round(pm[0] * 10) +
        ',' +
        Math.round(pm[1] * 10);
      if (r.kind === 'AW') {
        ext.push(r);
        r.es.forEach((g) => {
          [g.e.p, g.e.q].forEach((p) => {
            const k = l2k(p);
            if (!nodeD.has(k)) nodeD.set(k, r.d);
          });
        });
      }
    });
    // Außenwand: Band nach innen mit Gehrung
    const exn = new Map();
    ext.forEach((r) =>
      r.es.forEach((g) => {
        const f = lv.faces[g.e.f[0]],
          mx = g.mx,
          mz = g.mz;
        let nx = -g.kz,
          nz = g.kx;
        if (!grInFace(f, mx + nx * 0.03, mz + nz * 0.03)) {
          nx = -nx;
          nz = -nz;
        }
        g.n = [nx, nz];
        g.r = r;
        g.d = r.d;
        g.sh = r.sh || 0;
        [g.e.p, g.e.q].forEach((p, ix) => {
          const k = l2k(p);
          let a = exn.get(k);
          if (!a) exn.set(k, (a = []));
          a.push({ g, ix });
        });
      }),
    );
    const kq = (g, fc, o) => (o ? 0 : g.d * fc) - (g.sh || 0),
      inner = (g, ix, fc, ou) => {
        fc = fc || 1;
        const P = ix ? g.e.q : g.e.p,
          k = l2k(P),
          o = (exn.get(k) || []).find((z) => z.g !== g);
        const kg = kq(g, fc, ou),
          base = [P[0] + g.n[0] * kg, P[1] + g.n[1] * kg];
        if (!o) return base;
        const h = o.g,
          c1 = g.kx * h.kz - g.kz * h.kx;
        if (Math.abs(c1) < 1e-3) return base;
        const kh = kq(h, fc, ou),
          q1 = base,
          q2 = [P[0] + h.n[0] * kh, P[1] + h.n[1] * kh],
          t = ((q2[0] - q1[0]) * h.kz - (q2[1] - q1[1]) * h.kx) / c1;
        return [q1[0] + g.kx * t, q1[1] + g.kz * t];
      };
    /* LOD300 Eckverbindung ohne Gehrung: eine Außenwand läuft je Schichtgruppe (Fassade / Tragschicht / Innenschichten) bis zur Außenkante der anderen durch, die andere endet an der Innenfläche der durchlaufenden */
    /* Schichtgruppen von außen: c = Fassade (äußerste Schicht und alles nicht Dämmende dahinter, z. B. Klinker + Hinterlüftung), d = Dämmung vor der Tragschicht, b = Tragschicht, i = Innenschichten. Die Außenseite ist so an jeder Ecke immer von einer Fassadenschicht bedeckt. */
    const GP = (T0) => {
      const Ls = T0.layers,
        bi = Math.max(
          0,
          Ls.findIndex((l) => L2ST.indexOf(l.kg) >= 0),
        ),
        n = Ls.length,
        ins = (l) => /dämm|holzfaser-p/i.test(l.n);
      let F = 0,
        Fc = 0,
        B = Ls[bi] ? Ls[bi].d : 0,
        D = 0,
        st = false;
      Ls.forEach((l, i) => {
        D += l.d;
        if (i > bi) F += l.d;
      });
      for (let i = n - 1; i > bi; i--) {
        if (i < n - 1 && ins(Ls[i])) st = true;
        if (!st) Fc += Ls[i].d;
      }
      return [
        ['c', 0, Fc],
        ['d', Fc, F],
        ['b', F, F + B],
        ['i', F + B, D],
      ].filter((x) => x[2] - x[1] > 1e-4);
    };
    const cnD = b.l2 && b.l2.cn,
      cnM = (cnD && cnD.m) || 'l',
      cnO = (cnD && cnD.o) || {},
      angOf = (g) => Math.round(Math.atan2(g.kz, g.kx) * 1000);
    const isThru = (g, ix, h) => {
      const P = ix ? g.e.q : g.e.p,
        ov = cnO[l2k(P)];
      if (ov != null) return ov === angOf(g);
      const aw = (w, i) => {
        const Q = i ? w.e.p : w.e.q,
          P2 = i ? w.e.q : w.e.p;
        const dx = Q[0] - P2[0],
          dz = Q[1] - P2[1],
          n = Math.hypot(dx, dz) || 1;
        return [dx / n, dz / n];
      };
      const hx = exn.get(l2k(P)).find((z) => z.g === h),
        hi = hx ? hx.ix : 0;
      if (cnM === 'w') {
        const a = aw(g, ix),
          c = aw(h, hi);
        return a[0] * c[1] - a[1] * c[0] > 0;
      }
      const lg = g.r.len,
        lh = h.r.len;
      if (Math.abs(lg - lh) < 1e-6) return angOf(g) < angOf(h);
      return cnM === 'k' ? lg < lh : lg > lh;
    };
    const cPt = (g, ix, kg, h, kh) => {
      const P = ix ? g.e.q : g.e.p,
        q1 = [P[0] + g.n[0] * kg, P[1] + g.n[1] * kg];
      if (!h) return q1;
      const c1 = g.kx * h.kz - g.kz * h.kx;
      if (Math.abs(c1) < 1e-3) return q1;
      const q2 = [P[0] + h.n[0] * kh, P[1] + h.n[1] * kh],
        t = ((q2[0] - q1[0]) * h.kz - (q2[1] - q1[1]) * h.kx) / c1;
      return [q1[0] + g.kx * t, q1[1] + g.kz * t];
    };
    const gEnd = (g, ix, G) => {
      const P = ix ? g.e.q : g.e.p,
        o = (exn.get(l2k(P)) || []).find((z) => z.g !== g),
        h = o && o.g,
        sh = g.sh || 0;
      let hr = null;
      if (h) {
        const PG = GP(h.r.T),
          ord = 'cdbi',
          hg0 = PG.find((x) => x[0] === G[0]);
        let hg = hg0;
        if (!hg) {
          const gi = ord.indexOf(G[0]);
          let nx = PG.find((x) => ord.indexOf(x[0]) > gi),
            pv = PG.filter((x) => ord.indexOf(x[0]) < gi).pop();
          hg = [G[0], nx ? nx[1] : pv ? pv[2] : 0, pv ? pv[2] : nx ? nx[1] : 0];
        }
        hr = hg;
        var th = isThru(g, ix, h);
        const ck = l2k(P);
        (R.cn = R.cn || {})[li + '|' + ck] = {
          k: ck,
          P,
          li,
          a: [angOf(g), angOf(h)],
          t: th ? angOf(g) : angOf(h),
        };
      }
      const kh = hr ? (th ? hr[1] : hr[2]) - (h.sh || 0) : 0;
      return [cPt(g, ix, G[1] - sh, h, kh), cPt(g, ix, G[2] - sh, h, kh)];
    };
    ext.forEach((r) => {
      const mq = (fc) => {
        const sd = (g) => (g.kx * g.e.p[0] + g.kz * g.e.p[1] <= g.kx * g.e.q[0] + g.kz * g.e.q[1] ? 0 : 1),
          f0 = r.es[0],
          f1 = r.es[r.es.length - 1],
          i0 = sd(f0),
          i1 = 1 - sd(f1),
          P0 = i0 ? f0.e.q : f0.e.p,
          P1 = i1 ? f1.e.q : f1.e.p;
        return [[inner(f0, i0, fc, 1), inner(f1, i1, fc, 1), inner(f1, i1, fc), inner(f0, i0, fc)]];
      };
      r.quads = mq();
      r.quads2 = mq(0.5);
      r.hTop = dDE;
      if (!C && r.T && r.T.layers) {
        try {
          const sd = (g) => (g.kx * g.e.p[0] + g.kz * g.e.p[1] <= g.kx * g.e.q[0] + g.kz * g.e.q[1] ? 0 : 1),
            f0 = r.es[0],
            f1 = r.es[r.es.length - 1],
            i0 = sd(f0),
            i1 = 1 - sd(f1),
            gq = {};
          GP(r.T).forEach((G) => {
            const A = gEnd(f0, i0, G),
              Z = gEnd(f1, i1, G);
            gq[G[0]] = { a: G[1], b: G[2], q: [A[0], Z[0], Z[1], A[1]] };
          });
          if (Object.keys(gq).length) {
            r.gq = gq;
            r.quads = Object.values(gq).map((x) => x.q);
          }
        } catch (er) {
          console.warn('Ecke', er);
        }
      }
      if (li === L.length - 1 && (!b.roof || !b.roof.type || b.roof.type === 'flat')) r.hAt = 0.3;
    });
    const extI = new Map();
    ext.forEach((r) =>
      r.es.forEach((g) =>
        extI.set(g.e.ek, { n: g.n, d: r.d, sh: r.sh || 0, tO: (r.tOut || 0) - (r.sh || 0) }),
      ),
    );
    // Innenwände: Ausrichtung zur Zeichenlinie; Anschlüsse: Gehrung (Ecke), T-Anschluss an die nächste Außenkante der durchgehenden Wand, Außenwand an ihrer Innenseite
    const IW = runs.filter((r) => r.kind !== 'AW');
    IW.forEach((r) => {
      const al = C ? 'm' : D.al[r.gid] || 'm',
        s_ = al === 'l' ? 1 : al === 'r' ? -1 : 0,
        nl = [r.uz, -r.ux];
      r.nx = -r.kz;
      r.nz = r.kx;
      r.off = -r.kz * r.es[0].mx + r.kx * r.es[0].mz;
      r.c = r.off + ((s_ * r.d) / 2) * (nl[0] * r.nx + nl[1] * r.nz);
      r.al = al;
      r.h2 = r.d / 2;
    });
    const PT = (r, t, k) => [r.kx * t + r.nx * k, r.kz * t + r.nz * k],
      TT = (r, p) => r.kx * p[0] + r.kz * p[1],
      CO = (r, p) => r.nx * p[0] + r.nz * p[1];
    const LX = (r1, k1, r2, k2) => {
      const det = -r1.kx * r2.kz + r2.kx * r1.kz;
      if (Math.abs(det) < 0.05) return null;
      const R0 = r2.nx * k2 - r1.nx * k1,
        R1 = r2.nz * k2 - r1.nz * k1,
        t = (-R0 * r2.kz + r2.kx * R1) / det;
      return PT(r1, t, k1);
    };
    const TL = (r, k, q0, w) => {
      const det = -r.kx * w[1] + w[0] * r.kz;
      if (Math.abs(det) < 0.05) return null;
      const R0 = q0[0] - k * r.nx,
        R1 = q0[1] - k * r.nz,
        t = (-R0 * w[1] + w[0] * R1) / det;
      return PT(r, t, k);
    };
    const endsAt = new Map();
    IW.forEach((r) => {
      [0, 1].forEach((e) => {
        const t = e ? r.tb : r.ta,
          k = l2k(PT(r, t, r.off));
        let x = endsAt.get(k);
        if (!x) endsAt.set(k, (x = []));
        x.push({ r, e });
      });
    });
    const endV = (r, e) => {
      const t = e ? r.tb : r.ta,
        N = PT(r, t, r.off),
        k = l2k(N),
        sgn = e ? 1 : -1,
        def = () => [PT(r, t + sgn * r.h2, r.c + r.h2), PT(r, t + sgn * r.h2, r.c - r.h2)];
      const exA = [];
      ext.forEach((r) =>
        r.es.forEach((g) => {
          if (l2Seg(N[0], N[1], [g.e.p[0], g.e.p[1], g.e.q[0], g.e.q[1]]) < 0.012) exA.push({ g });
        }),
      );
      const ex = exA.length ? exA : exn.get(k);
      if (ex && ex.length) {
        const g = ex[0].g,
          q0 = [N[0] + g.n[0] * (g.d - (g.sh || 0)), N[1] + g.n[1] * (g.d - (g.sh || 0))],
          w = [g.kx, g.kz],
          p = TL(r, r.c + r.h2, q0, w),
          m = TL(r, r.c - r.h2, q0, w);
        if (p && m) return [p, m];
        return def();
      }
      const far = PT(r, e ? r.ta : r.tb, r.off);
      for (const r2 of IW) {
        if (r2 === r) continue;
        const t2 = TT(r2, N);
        if (Math.abs(CO(r2, N) - r2.off) < 0.02 && t2 > r2.ta + 0.02 && t2 < r2.tb - 0.02) {
          const sg = CO(r2, far) - r2.c >= 0 ? 1 : -1,
            kc = r2.c + sg * r2.h2,
            q0 = PT(r2, 0, kc),
            w = [r2.kx, r2.kz],
            p = TL(r, r.c + r.h2, q0, w),
            m = TL(r, r.c - r.h2, q0, w);
          if (p && m) return [p, m];
          return def();
        }
      }
      const oth = (endsAt.get(k) || []).filter((z) => z.r !== r);
      if (oth.length === 1) {
        const o = oth[0],
          ad = [sgn > 0 ? -r.kx : r.kx, 0],
          bd = [o.e ? -o.r.kx : o.r.kx, o.e ? -o.r.kz : o.r.kz];
        ad[0] = e ? -r.kx : r.kx;
        ad[1] = e ? -r.kz : r.kz;
        const sA = r.nx * bd[0] + r.nz * bd[1] >= 0 ? 1 : -1,
          sB = o.r.nx * ad[0] + o.r.nz * ad[1] >= 0 ? 1 : -1,
          inn = LX(r, r.c + sA * r.h2, o.r, o.r.c + sB * o.r.h2),
          out = LX(r, r.c - sA * r.h2, o.r, o.r.c - sB * o.r.h2);
        if (inn && out) return sA > 0 ? [inn, out] : [out, inn];
      }
      return def();
    };
    IW.forEach((r) => {
      const a = endV(r, 0),
        b = endV(r, 1);
      r.quads = [[a[0], b[0], b[1], a[1]]];
    });
    runs.forEach((r) => {
      r.bid = b.id;
      const fp = r.quads.reduce((s, q) => s + l2QA(q), 0),
        fp2 = r.quads2 ? r.quads2.reduce((s, q) => s + l2QA(q), 0) : 0;
      r.A = r.len * ((r.quads2 ? lv.h : r.h) + (r.hAt || 0));
      r.V = fp * (r.h + (r.hAt || 0)) + fp2 * (r.hTop || 0);
      r.fp = fp;
      R.els.push(r);
    });
    // Geschossdecke über diesem Geschoss, Bodenplatte unter dem untersten
    const sl = (kind, faces, y0, T) => {
      const e = {
        bid: b.id,
        kind,
        li,
        id: b.id + ':' + li + ':' + kind,
        T,
        d: T.d,
        y0,
        faces,
        quads: null,
        h: T.d,
        fp: faces.reduce((s, f) => s + f.a, 0),
        gid: 0,
        len: 0,
        p: null,
      };
      e.A = e.fp;
      e.V = e.fp * T.d;
      R.els.push(e);
    };
    // Decke liegt mittig auf der Außenwand auf: Deckenrand liegt auf der Wandmittellinie, die Außenwand läuft durch und ist nur im Auflager (innere Hälfte) ausgespart
    const lnI = (a, da, b, db) => {
      const det = da[0] * db[1] - da[1] * db[0];
      if (Math.abs(det) < 1e-9) return null;
      const t = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / det;
      return [a[0] + da[0] * t, a[1] + da[1] * t];
    };
    const inset = (f) => {
      const rg = f.o,
        n = rg.length,
        ed = rg.map((p, i) => {
          const q = rg[(i + 1) % n],
            a = l2k(p),
            c = l2k(q),
            x = extI.get(a < c ? a + '|' + c : c + '|' + a),
            dd = [q[0] - p[0], q[1] - p[1]];
          return {
            p: x
              ? [
                  p[0] + x.n[0] * (C ? x.d / 2 - (x.sh || 0) : x.tO || 0),
                  p[1] + x.n[1] * (C ? x.d / 2 - (x.sh || 0) : x.tO || 0),
                ]
              : p,
            d: dd,
            fl: !!x,
            sh: x
              ? [
                  x.n[0] * (C ? x.d / 2 - (x.sh || 0) : x.tO || 0),
                  x.n[1] * (C ? x.d / 2 - (x.sh || 0) : x.tO || 0),
                ]
              : [0, 0],
          };
        });
      const o = rg.map((p, i) => {
        const A = ed[(i + n - 1) % n],
          B = ed[i];
        if (!A.fl && !B.fl) return p;
        const r = lnI(A.p, A.d, B.p, B.d);
        return r || [p[0] + (A.fl ? A.sh[0] : B.sh[0]), p[1] + (A.fl ? A.sh[1] : B.sh[1])];
      });
      const ar = l2QA(o) - f.h.reduce((s, h) => s + l2QA(h), 0);
      return { o, h: f.h, a: ar, fa: f.fa, c: f.c };
    };
    // Decke: eine durchgehende Platte über das ganze Geschoss (nicht über Wänden geteilt), Öffnungen nur für Treppenhaus/Schacht
    const offR = (rg, dd) => {
      const n = rg.length;
      let A = 0;
      rg.forEach((p, i) => {
        const q = rg[(i + 1) % n];
        A += p[0] * q[1] - q[0] * p[1];
      });
      const sg = A > 0 ? 1 : -1,
        L_ = rg.map((p, i) => {
          const q = rg[(i + 1) % n],
            dx = q[0] - p[0],
            dz = q[1] - p[1],
            ln = Math.hypot(dx, dz) || 1,
            nx = (-dz / ln) * sg,
            nz = (dx / ln) * sg,
            d1 = typeof dd === 'function' ? dd(p, q) : dd;
          return { p: [p[0] + nx * d1, p[1] + nz * d1], d: [dx, dz] };
        });
      return rg.map((p, i) => {
        const a = L_[(i + n - 1) % n],
          c = L_[i],
          r = lnI(a.p, a.d, c.p, c.d);
        return r || c.p;
      });
    };
    const dAW = (ext[0] && ext[0].d) || l2T(DF.AW).d,
      flat = !b.roof || !b.roof.type || b.roof.type === 'flat';
    const shaft = lv.faces.filter((f) => f.fa === 'th' || f.fa === 'az'),
      mk1 = (ring, hs) => ({ o: ring, h: hs, a: l2QA(ring) - hs.reduce((s, h) => s + l2QA(h), 0), fa: 'ge' });
    const outer = lv.fp && lv.fp.length >= 3 ? lv.fp : lv.faces[0].o;
    // Überhang: die Außenwand über einem auskragenden Bereich reicht nach unten bis zur Unterkante der Geschossdecke
    if (prevOuter && li > 0) {
      const inR = (pt, rg) => {
        let c = 0;
        rg.forEach((p, i) => {
          const q = rg[(i + 1) % rg.length];
          if (
            p[1] > pt[1] !== q[1] > pt[1] &&
            pt[0] < ((q[0] - p[0]) * (pt[1] - p[1])) / (q[1] - p[1]) + p[0]
          )
            c++;
        });
        return c % 2 === 1;
      };
      ext.forEach((r) => {
        const g0 = r.es[0];
        let n = 0;
        [0.1, 0.3, 0.5, 0.7, 0.9].forEach((t) => {
          const pt = [
            r.sa[0] + (r.sb[0] - r.sa[0]) * t + g0.n[0] * 0.05,
            r.sa[1] + (r.sb[1] - r.sa[1]) * t + g0.n[1] * 0.05,
          ];
          if (!inR(pt, prevOuter)) n++;
        });
        if (n >= 4) {
          r.y0 = y - dDE;
          r.h = hW + dDE;
          r.ovh = 1;
        }
      });
    }
    const holes = []; /* Treppenhaus/Schacht: Decke läuft durch (Öffnungen folgen mit dem Treppenelement) */
    const eS = (kind, fc, y0, T) => {
      sl(kind, [fc], y0, T);
      const e = R.els[R.els.length - 1];
      e.flatTop = kind === 'DE' && li === L.length - 1 && flat;
    };
    // Überhang/Rücksprung: die Decke deckt die Kontur dieses Geschosses UND die des Geschosses darüber ab (kein Loch im Boden des Überhangs)
    const upFp = L[li + 1] && L[li + 1].fp && L[li + 1].fp.length >= 3 ? L[li + 1].fp : null,
      outerD = upFp ? l2Union(outer, upFp) || outer : outer;
    /* LOD300: Deckenkontur endet exakt an der Außenfläche der tragenden Schicht der jeweiligen Wand */
    const slOff = C
      ? dAW / 2
      : (p, q) => {
          const mx = (p[0] + q[0]) / 2,
            mz = (p[1] + q[1]) / 2;
          for (const r of ext) {
            if (!r.T || !r.T.layers) continue;
            for (const g of r.es) {
              if (l2Seg(mx, mz, [g.e.p[0], g.e.p[1], g.e.q[0], g.e.q[1]]) < 0.02) {
                const bg = GP(r.T).find((x) => x[0] === 'b');
                if (bg) return bg[1] - (r.sh || 0);
              }
            }
          }
          return dAW / 2;
        };
    eS('DE', mk1(offR(outerD, slOff), holes), y + lv.h - dDE, l2T(DF.DE));
    if (li === 0) eS('BP', mk1(outer.slice(), []), y - l2T(DF.BP).d, l2T(DF.BP));
    R.lv.push({ li, name: lv.name, y0: y, h: lv.h, area: lv.area });
    prevOuter = outer;
    y += lv.h;
  });

  // Dachgeschoss: Giebel und Drempel als Außenwände, Dach als eigenes Bauteil je Dachform (unter Oberkante des obersten Geschosses abgeschnitten)
  try {
    const rp = b._rp,
      rt = b.roof && b.roof.type;
    if (rp && rp.pr && rp.pr.length && rt && rt !== 'flat' && prevOuter) {
      const yr = y,
        li = L.length,
        tAW = l2T(DF.AW),
        TR = l2T(
          C ? DF.RD : (b.l2 && b.l2.r) || { sattel: 'RD-SA', walm: 'RD-WA', pult: 'RD-PU' }[rt] || 'RD-SA',
        ),
        pw = rp.pw || [],
        pr = rp.pr;
      const inR = (pt, rg) => {
        let c = 0;
        rg.forEach((p, i) => {
          const q = rg[(i + 1) % rg.length];
          if (
            p[1] > pt[1] !== q[1] > pt[1] &&
            pt[0] < ((q[0] - p[0]) * (pt[1] - p[1])) / (q[1] - p[1]) + p[0]
          )
            c++;
        });
        return c % 2 === 1;
      };
      const solid = (tris, off) => {
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
      };
      const tw = new Map();
      for (let i = 0; i + 8 < pw.length; i += 9) {
        const A = [pw[i], pw[i + 1], pw[i + 2]],
          B = [pw[i + 3], pw[i + 4], pw[i + 5]],
          C = [pw[i + 6], pw[i + 7], pw[i + 8]],
          ux = B[0] - A[0],
          uy = B[1] - A[1],
          uz = B[2] - A[2],
          vx = C[0] - A[0],
          vy = C[1] - A[1],
          vz = C[2] - A[2],
          cx = uy * vz - uz * vy,
          cy = uz * vx - ux * vz,
          cz = ux * vy - uy * vx,
          nl = Math.hypot(cx, cy, cz),
          hl = Math.hypot(cx, cz);
        if (nl < 1e-9 || hl < 0.5 * nl) continue;
        let nx = cx / hl,
          nz = cz / hl;
        const mx = (A[0] + B[0] + C[0]) / 3,
          mz = (A[2] + B[2] + C[2]) / 3;
        if (inR([mx + nx * 0.05, mz + nz * 0.05], prevOuter)) {
          nx = -nx;
          nz = -nz;
        }
        const k = Math.round(Math.atan2(nz, nx) * 100) + '|' + Math.round((nx * mx + nz * mz) * 20);
        let g = tw.get(k);
        if (!g) tw.set(k, (g = { nx, nz, t: [], ar: 0, t0: 1e9, t1: -1e9, hm: 0 }));
        g.t.push([A, B, C]);
        g.ar += nl / 2;
        [A, B, C].forEach((P) => {
          const t = -nz * P[0] + nx * P[2];
          g.t0 = Math.min(g.t0, t);
          g.t1 = Math.max(g.t1, t);
          g.hm = Math.max(g.hm, P[1] - yr);
        });
      }
      let wi = 0;
      for (const g of tw.values()) {
        const gk = Math.round(g.nx * 100) + ',' + Math.round(g.nz * 100),
          ov = (C ? b.l2 && b.l2.rwc : b.l2 && b.l2.rw) || {};
        let Tg = l2T(ov[gk] || DF.AW);
        if (!C) {
          const fk = l2FacGb(b, g, yr);
          if (fk) Tg = l2FacT(Tg, fk);
        }
        const d = Tg.d,
          gvk = C ? '' : l2ViewN(b, g.nx, g.nz, l2Gc(g)),
          tOut = C ? 0 : l2Tout(Tg),
          rf = !C && b._l2ref && gvk ? b._l2ref[gvk] : null,
          sh = rf != null ? Math.max(0, Math.round((tOut - rf) * 1000) / 1000) : 0;
        if (!C) R.probe.push({ vk: gvk, t: tOut });
        const S_ = solid(
            g.t.map((tri) => tri.map((P) => [P[0] + g.nx * (0.004 + sh), P[1], P[2] + g.nz * (0.004 + sh)])),
            (P) => [P[0] - g.nx * (d - sh + 0.004), P[1], P[2] - g.nz * (d - sh + 0.004)],
          ),
          len = g.t1 - g.t0;
        wi++;
        R.els.push({
          bid: b.id,
          kind: 'AW',
          li,
          id: b.id + ':' + li + ':AW:rw' + wi + ':' + Math.round(g.nx * 100) + ',' + Math.round(g.nz * 100),
          T: Tg,
          d,
          y0: yr,
          faces: [],
          quads: null,
          tri: S_.all,
          tro: S_.out,
          gb: { t: g.t, nx: g.nx, nz: g.nz, yr, sh, gk },
          vk: gvk,
          tOut,
          sh,
          h: g.hm,
          fp: len * d,
          gid: 0,
          len,
          p: null,
          A: g.ar,
          V: g.ar * d,
          sub: 'Giebel / Drempel',
        });
      }
      const ang = (Math.max(1, Math.min(75, +b.roof.angle || 30)) * Math.PI) / 180,
        tv = TR.d / Math.cos(ang),
        trs = [];
      for (let i = 0; i + 8 < pr.length; i += 9)
        trs.push([
          [pr[i], pr[i + 1], pr[i + 2]],
          [pr[i + 3], pr[i + 4], pr[i + 5]],
          [pr[i + 6], pr[i + 7], pr[i + 8]],
        ]);
      const S2 = solid(trs, (P) => [P[0], Math.max(P[1] - tv, 0), P[2]]);
      R.els.push({
        bid: b.id,
        kind: 'RD',
        li,
        id: b.id + ':' + li + ':RD',
        T: TR,
        d: TR.d,
        y0: yr,
        faces: [],
        quads: null,
        tri: S2.all,
        tro: S2.out,
        rt: { trs, cs: Math.cos(ang), yr },
        h: rp.h,
        fp: 0,
        gid: 0,
        len: 0,
        p: null,
        A: rp.aR,
        V: rp.aR * TR.d,
        sub: XRT[rt] || rt,
      });
    }
  } catch (e) {
    console.warn('LOD200 Dach', e);
  }
  const fp = R.els.filter((e) => e.kind !== 'DE' && e.kind !== 'BP').reduce((s, e) => s + e.fp, 0);
  R.wfp = fp;
  b._l2 = R;
  return R;
}
const XRT = { sattel: 'Satteldach', walm: 'Walmdach', pult: 'Pultdach' };
function l2QA(q) {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i],
      n = q[(i + 1) % q.length];
    a += p[0] * n[1] - n[0] * p[1];
  }
  return Math.abs(a) / 2;
}
const l2Els = (b) => {
  try {
    return l2Geo(b);
  } catch (e) {
    console.warn('LOD200', e);
    return { els: [], lv: [], k: '', wfp: 0 };
  }
};
function l2Find(id) {
  for (const b of S.bld) {
    if (b.ex || b._y == null) continue;
    const e = l2Els(b).els.find((x) => x.id === id);
    if (e) return e;
  }
  return null;
}
