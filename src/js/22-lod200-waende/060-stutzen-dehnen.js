// ---- Stutzen / Dehnen (wie AutoCAD): Wand anklicken – kreuzt sie eine andere Wand, wird der angeklickte Teil gestutzt, sonst wird das nähere Ende bis zur nächsten Wand gedehnt.
// Umschalt+Klick wählt eine einzelne Schneidkante (Standard: alle Wände und der Umriss), Rechtsklick/Esc setzt zurück bzw. beendet.
function l2HitCut(lv, p) {
  const tol = 8 / GRS.view.s;
  let best = null,
    bd = tol;
  (lv.obj.cuts || []).forEach((c) => {
    const d = l2Seg(p.x, p.z, c);
    if (d < bd) {
      bd = d;
      best = { kind: 'TW', gid: c[4], id: 'cut' + c[4] };
    }
  });
  return best;
}
function l2TrimDo(b, lv, w, P) {
  if (w.kind === 'AW' || !w.gid) {
    l2Cap('Außenwände folgen der Kubatur – Innenwand anklicken');
    setTimeout(() => l2Cap(''), 1800);
    return;
  }
  const cuts = lv.obj.cuts || [];
  let idx = -1,
    bd = 1e9;
  cuts.forEach((c, i) => {
    if (c[4] !== w.gid) return;
    const d = l2Seg(P.x, P.z, c);
    if (d < bd) {
      bd = d;
      idx = i;
    }
  });
  if (idx < 0) return;
  const c = cuts[idx],
    A = [c[0], c[1]],
    B = [c[2], c[3]],
    d = [B[0] - A[0], B[1] - A[1]],
    LL = d[0] * d[0] + d[1] * d[1];
  if (LL < 1e-6) return;
  const sP = ((P.x - A[0]) * d[0] + (P.z - A[1]) * d[1]) / LL,
    K = [];
  l2Els(b).els.forEach((e) => {
    if (e.li !== lv.i || !e.quads || !e.sa) return;
    if (e.gid && e.gid === w.gid && e.kind !== 'AW') return;
    if (S.l2.cut && e.id !== S.l2.cut) return;
    const E0 = e.sa,
      ed = [e.sb[0] - E0[0], e.sb[1] - E0[1]],
      el = Math.hypot(ed[0], ed[1]) || 1,
      det = -d[0] * ed[1] + ed[0] * d[1];
    if (Math.abs(det) < 1e-6) return;
    const r0 = [E0[0] - A[0], E0[1] - A[1]],
      s_ = (r0[0] * -ed[1] + ed[0] * r0[1]) / det,
      u = (d[0] * r0[1] - d[1] * r0[0]) / det,
      tu = 0.05 / el;
    if (u < -tu || u > 1 + tu) return;
    K.push({ s: s_, X: [A[0] + s_ * d[0], A[1] + s_ * d[1]] });
  });
  const cr = K.filter((k) => k.s > 0.002 && k.s < 0.998).sort(
    (p, q) => Math.abs(p.s - sP) - Math.abs(q.s - sP),
  )[0];
  let pick = null,
    nA = A,
    nB = B,
    msg = '';
  if (cr) {
    pick = cr;
    if (sP < cr.s) nA = cr.X;
    else nB = cr.X;
    msg = 'Gestutzt';
  } else {
    const endA = sP < 0.5,
      ex = K.filter((k) => (endA ? k.s < -0.002 : k.s > 1.002)).sort((p, q) =>
        endA ? q.s - p.s : p.s - q.s,
      )[0];
    if (ex) {
      pick = ex;
      if (endA) nA = ex.X;
      else nB = ex.X;
      msg = 'Gedehnt';
    }
  }
  if (!pick) {
    l2Cap('Keine Wand zum Stutzen oder Dehnen gefunden');
    setTimeout(() => l2Cap(''), 1800);
    return;
  }
  if (Math.hypot(nB[0] - nA[0], nB[1] - nA[1]) < 0.05) return;
  grEdit((b2) => {
    const lv2 = grLv(b2),
      cs = (lv2.obj.cuts || []).map((q) => q.slice());
    cs[idx] = [gr2(nA[0]), gr2(nA[1]), gr2(nB[0]), gr2(nB[1]), c[4]];
    grSetCuts(b2, lv2, cs);
    GRS.sel = { k: 'c', g: c[4] };
    b2._l2 = null;
  });
  S.l2.sel = null;
  l2Cap(msg);
  setTimeout(() => l2Cap(''), 1200);
}
{
  const _t = grTool;
  grTool = function (t) {
    const r = _t.apply(this, arguments);
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
    return r;
  };
}
{
  const _g = grDown;
  grDown = function (e) {
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
    return _g.apply(this, arguments);
  };
}
{
  const _k = grKey;
  grKey = function (e) {
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
    return _k.apply(this, arguments);
  };
}
GR.tool = grTool;

GR.l2.ptExt = () => {
  const b = grB(),
    pt = S.l2.pt;
  if (!b || !pt) return;
  const lv = grLv(b);
  let best = null,
    bd = 0.3;
  (lv.obj.cuts || []).forEach((c) => {
    if (c[4] !== pt.g) return;
    [
      [c[0], c[1], c[2], c[3]],
      [c[2], c[3], c[0], c[1]],
    ].forEach((q) => {
      const d = Math.hypot(q[0] - pt.p[0], q[1] - pt.p[1]);
      if (d < bd) {
        bd = d;
        best = q;
      }
    });
  });
  if (!best) return;
  l2TrimDo(
    b,
    lv,
    { kind: 'TW', gid: pt.g },
    { x: best[0] + (best[2] - best[0]) * 0.03, z: best[1] + (best[3] - best[1]) * 0.03 },
  );
  S.l2.pt = null;
  S.l2.bsig = '';
};

// ---- Explosionsansicht auch für LOD 200: Wände und Decken wandern mit ihrem Geschoss
{
  const _x = exApply;
  exApply = function () {
    const r = _x.apply(this, arguments);
    try {
      for (const it of L2I.values()) {
        const b = S.bld.find((z) => z.id === it.el.bid);
        if (b)
          it.g.position.y =
            it.el.y0 +
            exOff(b, it.el.kind === 'DE' ? it.el.li + 1 : it.el.li) +
            (it.el.kind === 'RD' ? S.expl.cur * exP().v : 0);
        /* LOD300: letzte 30 % der Explosion – Außenwände (und Giebel) rücken nach außen von der Geschossdecke weg */
        let ox = 0,
          oz = 0;
        const hh = exP().h;
        if (hh > 0 && it.el.kind === 'AW' && l23()) {
          const e = it.el;
          let n = null,
            pt = null;
          if (e.gb) {
            n = [e.gb.nx, e.gb.nz];
            pt = e.gb.t && e.gb.t[0] && [e.gb.t[0][0][0], e.gb.t[0][0][2]];
          } else if (e.es && e.es[0].n) {
            n = [-e.es[0].n[0], -e.es[0].n[1]];
            pt = e.p;
          }
          if (n && pt) {
            const GE = l2Els(b),
              cc =
                GE._exC ||
                (GE._exC = (() => {
                  let sx = 0,
                    sz = 0,
                    c = 0;
                  GE.els.forEach((q) => {
                    if (q.kind === 'AW' && q.p) {
                      sx += q.p[0];
                      sz += q.p[1];
                      c++;
                    }
                  });
                  return c ? [sx / c, sz / c] : [0, 0];
                })());
            if (n[0] * (pt[0] - cc[0]) + n[1] * (pt[1] - cc[1]) < 0) {
              n = [-n[0], -n[1]];
            }
            const nl = it.el.T.layers.length,
              u = hh * Math.max(0.5, S.expl.gap * 0.12);
            it.g.children.forEach((ch) => {
              const ly = ch.userData.ly;
              if (ly == null || ly < 0) return;
              const d = u * (ly + 1) * (nl > 1 ? 1 : 1);
              ch.position.x = n[0] * d;
              ch.position.z = n[1] * d;
            });
            ox = null;
          }
        }
        if (ox === 0)
          it.g.children.forEach((ch) => {
            if (ch.userData.ly != null) {
              ch.position.x = 0;
              ch.position.z = 0;
            }
          });
      }
    } catch (e) {
      logErr(e, 'exApply');
    }
    return r;
  };
}
// ---- Wände schneiden Räume wie die Trennlinien in LOD 100: Enden, die an der Innenseite einer Außenwand oder an der Wandkante einer anderen Wand gefangen wurden, werden entlang der Linie bis zur Mittellinie bzw. zum Umriss verlängert
function l2Fix(segs) {
  if (l2on()) {
    try {
      const b = grB();
      if (b) {
        const lv = grLv(b),
          cuts = lv.obj.cuts || [],
          cand = lv.bs.map((q) => q.slice(0, 4)).concat(cuts.map((c) => c.slice(0, 4))),
          LIM = 0.55,
          key = (p) => Math.round(p[0] * 500) + ',' + Math.round(p[1] * 500),
          cnt = new Map();
        segs.forEach((s) => {
          [
            [s[0], s[1]],
            [s[2], s[3]],
          ].forEach((p) => {
            const k = key(p);
            cnt.set(k, (cnt.get(k) || 0) + 1);
          });
        });
        const inP = (x, z) => {
          let c = 0;
          lv.bs.forEach((q) => {
            if (q[1] > z !== q[3] > z && x < ((q[2] - q[0]) * (z - q[1])) / (q[3] - q[1]) + q[0]) c++;
          });
          return c % 2 === 1;
        };
        segs = segs.map((s) => {
          s = s.slice();
          const sx = s[2] - s[0],
            sz = s[3] - s[1];
          [1, 0].forEach((end) => {
            const E = end ? [s[2], s[3]] : [s[0], s[1]],
              F = end ? [s[0], s[1]] : [s[2], s[3]];
            if (inP(E[0], E[1])) return;
            let bt = -1;
            lv.bs.forEach((q) => {
              const ex = q[2] - q[0],
                ez = q[3] - q[1],
                det = (E[0] - F[0]) * -ez + ex * (E[1] - F[1]);
              if (Math.abs(det) < 1e-9) return;
              const rx = q[0] - F[0],
                rz = q[1] - F[1],
                t = (rx * -ez + ex * rz) / det,
                u = ((E[0] - F[0]) * rz - (E[1] - F[1]) * rx) / det;
              if (u >= -1e-6 && u <= 1 + 1e-6 && t >= 0 && t <= 1 && t > bt) bt = t;
            });
            if (bt > 0) {
              const x = F[0] + (E[0] - F[0]) * bt,
                z = F[1] + (E[1] - F[1]) * bt;
              if (end) {
                s[2] = x;
                s[3] = z;
              } else {
                s[0] = x;
                s[1] = z;
              }
            }
          });
          return s;
        });
        segs = segs.map((s) => {
          const o = s.slice(),
            dx = s[2] - s[0],
            dz = s[3] - s[1],
            L = Math.hypot(dx, dz);
          if (L < 1e-6) return o;
          [1, 0].forEach((end) => {
            const E = end ? [s[2], s[3]] : [s[0], s[1]];
            if (cnt.get(key(E)) > 1) return;
            const dir = end ? [dx / L, dz / L] : [-dx / L, -dz / L];
            let best = null,
              bd = LIM;
            cand.forEach((c) => {
              const ex = c[2] - c[0],
                ez = c[3] - c[1],
                det = dir[0] * -ez + ex * dir[1];
              if (Math.abs(det) < 1e-6) return;
              const rx = c[0] - E[0],
                rz = c[1] - E[1],
                t = (rx * -ez + ex * rz) / det,
                u = (dir[0] * rz - dir[1] * rx) / det;
              if (u < -0.02 || u > 1.02) return;
              const d = Math.abs(t);
              if (d < bd && d > 0.003) {
                bd = d;
                best = [E[0] + dir[0] * t, E[1] + dir[1] * t];
              }
            });
            if (best) {
              if (end) {
                o[2] = best[0];
                o[3] = best[1];
              } else {
                o[0] = best[0];
                o[1] = best[1];
              }
            }
          });
          return o;
        });
      }
    } catch (e) {
      console.warn('LOD200 Schnitt', e);
    }
  }
  return segs;
}
{
  const _a = grAddCuts;
  grAddCuts = function (segs) {
    return _a.call(this, l2Fix(segs));
  };
}
{
  const _a = grAddLine;
  grAddLine = function (segs) {
    return _a.call(this, l2Fix(segs));
  };
}
// ---- Explosion: weiße Kontur (Auswahl/Hover) geht mit den Geschossen mit
function outPts(b, k, i) {
  const pts = [],
    v3 = (q, z) => new T.Vector3(q[0], z, q[1]),
    ex = !!(S.expl && S.expl.cur > 0.001);
  let z = b._y;
  b.levels.forEach((l, j) => {
    const o = ex ? exOff(b, j) : 0,
      z0 = z + o,
      z1 = z + l.h + o;
    z += l.h;
    if (k >= 0 && j !== k) return;
    const f = lf(b, l),
      n = f.length,
      sg = (x) => JSON.stringify(lf(b, x)),
      rb = ex || k >= 0 || j === 0 || sg(l) !== sg(b.levels[j - 1]),
      rt = ex || k >= 0 || j === b.levels.length - 1 || sg(l) !== sg(b.levels[j + 1]);
    (i >= 0 ? [i] : f.map((_, q) => q)).forEach((q) => {
      const a = f[q],
        c = f[(q + 1) % n];
      if (rb) pts.push(v3(a, z0), v3(c, z0));
      if (rt) pts.push(v3(a, z1), v3(c, z1));
      pts.push(v3(a, z0), v3(a, z1));
      if (i >= 0) pts.push(v3(c, z0), v3(c, z1));
    });
  });
  if (k < 0 && i < 0 && b.patches && b.patches.length) pxMeshOutline(b, pts);
  if (k < 0 && i < 0 && b._rp && b._rp.geo) {
    const eg = new T.EdgesGeometry(b._rp.geo, 15),
      pa = eg.attributes.position,
      ro = ex ? exOff(b, b.levels.length) : 0;
    for (let q = 0; q < pa.count; q++) pts.push(new T.Vector3(pa.getX(q), pa.getY(q) + ro, pa.getZ(q)));
    eg.dispose();
  }
  return pts;
}
function setLines(o, b, k, i) {
  const ex = S.expl && S.expl.cur > 0.001 ? +S.expl.cur.toFixed(2) : 0,
    key = JSON.stringify([
      b.id,
      k,
      i,
      b._y,
      b.fp,
      b.patches,
      b.levels.map((l) => [l.h, l.fp]),
      b.roof,
      b._roofH,
      ex,
    ]);
  if (o.userData.key !== key) {
    o.userData.key = key;
    o.geometry.dispose();
    o.geometry = new T.BufferGeometry().setFromPoints(outPts(b, k, i));
  }
}
{
  const _x2 = exApply;
  let lastE = -1;
  exApply = function () {
    const r = _x2.apply(this, arguments);
    try {
      const c = S.expl ? +S.expl.cur.toFixed(2) : 0;
      if (c !== lastE) {
        lastE = c;
        updSel2();
      }
    } catch (e) {
      logErr(e, 'exApply');
    }
    return r;
  };
}

// ---- Enden/Verbindungspunkte einer Wand an der Außenwand werden an der Innenseite der Außenwand angezeigt (Daten bleiben am Umriss, damit die Trennlinie den Raum schneidet)
function l2Disp(lv, gid, p) {
  try {
    const els = l2Els(grB()).els;
    let best = null,
      bd = 0.7;
    els.forEach((e) => {
      if (e.li !== lv.i || e.gid !== gid || !e.quads || e.kind === 'AW') return;
      e.quads.forEach((q) => {
        [
          [(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2],
          [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2],
        ].forEach((m) => {
          const d = Math.hypot(m[0] - p[0], m[1] - p[1]);
          if (d < bd && d > 0.02) {
            bd = d;
            best = m;
          }
        });
      });
    });
    return best || p;
  } catch (_) {
    return p;
  }
}
{
  const _h = grEdHit;
  grEdHit = function (lv, g, p) {
    const r = _h.apply(this, arguments);
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
  };
}
