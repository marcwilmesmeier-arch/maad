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
// grTool(): Erweiterung zusammengeführt, siehe 15-grundriss/130-nachtraegliches-bearbeiten-gewaehlter-schnittgruppen.js
// grDown(): Erweiterung zusammengeführt, siehe 15-grundriss/130-nachtraegliches-bearbeiten-gewaehlter-schnittgruppen.js
// grKey(): Erweiterung zusammengeführt, siehe 15-grundriss/130-nachtraegliches-bearbeiten-gewaehlter-schnittgruppen.js
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

// exApply(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
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
// grAddCuts(): Erweiterung zusammengeführt, siehe 15-grundriss/020-flaechenarten.js
// grAddLine(): Erweiterung zusammengeführt, siehe 15-grundriss/020-flaechenarten.js
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
// zuletzt angewendeter Explosionswert (Auswahlkontur nur bei Änderung neu)
let exLastE = -1;
// exApply(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js

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
// grEdHit(): Erweiterung zusammengeführt, siehe 15-grundriss/130-nachtraegliches-bearbeiten-gewaehlter-schnittgruppen.js
