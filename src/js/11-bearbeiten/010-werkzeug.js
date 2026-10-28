// ---- Werkzeug-Gruppen: Hauptsymbol, Einzelfunktionen im Ausklapp-Menü
function tmToggle(b, dm) {
  if (b.disabled) return;
  const g = b.parentNode,
    o = g.classList.contains('open');
  if (dm && !o && (dm === 'area' || P.some((q) => q.site))) setShape(S.shape, dm);
  document.querySelectorAll('#tbar .tg.open').forEach((x) => x.classList.remove('open'));
  if (!o) g.classList.add('open');
}
document.addEventListener(
  'pointerdown',
  (e) => {
    const t = e.target;
    if (t.closest && t.closest('#tbar .tm')) return;
    if (!(t.closest && t.closest('#tbar .tg')))
      document.querySelectorAll('#tbar .tg.open').forEach((x) => x.classList.remove('open'));
  },
  true,
);
// Untermenü erst nach dem Klick schließen (nicht schon beim Drücken – sonst geht der Klick verloren)
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest && t.closest('#tbar .tm'))
    setTimeout(
      () => document.querySelectorAll('#tbar .tg.open').forEach((x) => x.classList.remove('open')),
      0,
    );
});
function tmDis() {
  const site = P.some((q) => q.site),
    has = S.bld.some((b) => !b.ex);
  ['bf', 'br', 'bc'].forEach((i) => {
    const e = $(i);
    if (e) e.disabled = !site;
  });
  const m = $('mB');
  if (m) {
    m.disabled = !(site || has);
    m.title = site ? 'Gebäude' : 'Gebäude – zuerst ein Grundstück wählen';
  }
}
setInterval(() => {
  tmDis();
  const g = $('tgE'),
    ok = !!(S.sel && !S.sel.ex && S.bld.includes(S.sel));
  if (g && (g.style.display === 'none') === ok) g.style.display = ok ? '' : 'none';
  if (!ok && (S.tool === 'mv' || S.tool === 'ro' || S.tool === 'ed' || S.tool === 't')) tool('v');
}, 120);
function tmSync() {
  document.querySelectorAll('#tbar .tg').forEach((g) => {
    const m = g.querySelector('.tmain'),
      on = g.querySelector('.tm .tb.on');
    if (!m) return;
    if (!!on !== m.classList.contains('on')) m.classList.toggle('on', !!on);
    const ic = m.querySelector('i'),
      t = on ? on.querySelector('i').innerHTML : null;
    if (t && ic.innerHTML !== t) ic.innerHTML = t;
    if (!on && m.dataset.i && ic.innerHTML !== m.dataset.i) ic.innerHTML = m.dataset.i;
    if (!m.dataset.i) m.dataset.i = ic.innerHTML;
  });
}
document.querySelectorAll('#tbar .tmain i').forEach((i) => (i.parentNode.dataset.i = i.innerHTML));
new MutationObserver(tmSync).observe($('tbar'), {
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});
tmSync();

(function spBlink() {
  try {
    const m = sp.material,
      t = (performance.now() - (sp.userData.t0 || 0)) / 520;
    m.opacity = t < 1 ? Math.sin(Math.PI * t) : 0;
  } catch (e) {
    logErr(e, 'spBlink');
  }
  requestAnimationFrame(spBlink);
})();

// ---- Abstandsflächen (nur für das gezeichnete bzw. gewählte Gebäude)
const ABR = {
  nw: ['Nordrhein-Westfalen', 0.4, 3, 'A'],
  bw: ['Baden-Württemberg', 0.4, 2.5, 'A'],
  by: ['Bayern', 0.4, 3, 'A'],
  be: ['Berlin', 0.4, 3, 'A'],
  bb: ['Brandenburg', 0.4, 3, 'A'],
  hb: ['Bremen', 0.4, 3, 'A'],
  hh: ['Hamburg', 0.4, 2.5, 'B'],
  he: ['Hessen', 0.4, 2.5, 'A'],
  mv: ['Mecklenburg-Vorpommern', 0.4, 3, 'A'],
  ni: ['Niedersachsen', 0.4, 3, 'C'],
  rp: ['Rheinland-Pfalz', 0.4, 3, 'A'],
  sl: ['Saarland', 0.4, 3, 'A'],
  sn: ['Sachsen', 0.4, 3, 'A'],
  st: ['Sachsen-Anhalt', 0.4, 3, 'A'],
  sh: ['Schleswig-Holstein', 0.4, 3, 'A'],
  th: ['Thüringen', 0.4, 3, 'A'],
};
S.abst = { st: null, f: null, m: null };
function abstState() {
  if (S.abst.st) return S.abst.st;
  const lo = GEO.lon,
    la = GEO.lat;
  if (lo == null) return 'nw';
  if (lo > 8.3 && lo < 8.75 && la > 51.88 && la < 52.17) return 'nw';
  if (lo > 13.08 && lo < 13.76 && la > 52.34 && la < 52.68) return 'be';
  const C = {
    nw: [7.55, 51.45],
    bw: [9, 48.55],
    by: [11.4, 48.95],
    bb: [13.1, 52.4],
    hb: [8.8, 53.08],
    hh: [9.99, 53.55],
    he: [9, 50.6],
    mv: [12.5, 53.8],
    ni: [9.4, 52.8],
    rp: [7.4, 49.9],
    sl: [6.95, 49.4],
    sn: [13.3, 51],
    st: [11.7, 51.9],
    sh: [9.8, 54.2],
    th: [11, 50.9],
  };
  let b = 'nw',
    bd = 1e9;
  for (const k in C) {
    const d = Math.hypot((lo - C[k][0]) * Math.cos((la * Math.PI) / 180), la - C[k][1]);
    if (d < bd) {
      bd = d;
      b = k;
    }
  }
  return b;
}
function abstRule() {
  const k = abstState(),
    r = ABR[k];
  return {
    k,
    n: r[0],
    f: S.abst.f != null ? S.abst.f : r[1],
    m: S.abst.m != null ? S.abst.m : r[2],
    mode: r[3],
  };
}
function abstTarget() {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/010-menue-in-gruppen-und-ebenen.js
  // v487: keine Abstandsflaechen-Vorschau, solange das Gebaeude noch nicht erzeugt ist
  if (S.tool === 'f' && S.dm !== 'area' && S.draft && S.draft.length > 2 && S.closed) return null;
  if (!S.geo && !GEO.size) return null;
  if (S.tool === 'f' && S.closed && S.dm !== 'area' && S.draft.length > 2) {
    const t = ($('nd') || {}).value || 'flat',
      ng = Math.max(1, +($('ng') || {}).value || 4),
      g = +($('gh') || {}).value || 3,
      ug = Math.max(0, +($('nug') || {}).value || 0),
      fp = S.draft,
      base0 = S.refH != null ? S.refH : Math.min(...fp.map((q) => gh(q[0], q[1])));
    const roof =
      t === 'flat'
        ? { type: 'flat' }
        : {
            type: t,
            angle: +($('na') || {}).value || RD[t].angle,
            dremp: Math.max(0, +($('ndr') || {}).value || 0),
            dir: null,
          };
    let rg = null;
    try {
      rg = roof.type === 'flat' ? null : roofGeo({ fp, levels: [{ h: g }], roof }, 0);
    } catch (e) {
      logErr(e, 'abstTarget');
    }
    return {
      name: 'Neues Gebäude',
      fp,
      base: base0,
      H0: ng * g,
      hf: rg ? rg.hf : null,
      d: rg ? rg.d : 0,
      roof,
      draft: true,
    };
  }
  const b = S.sel;
  if (b && !b.ex && S.bld.includes(b) && b.fp && b.fp.length > 2) {
    const rp = b._rp;
    return {
      name: b.name || b.id,
      fp: b.fp,
      base: base(b),
      H0: b._hAbove || 0,
      hf: rp ? rp.hf : null,
      d: rp ? rp.d : 0,
      roof: b.roof || { type: 'flat' },
      b,
    };
  }
  return null;
}
function abstOthers(prim, site) {
  if (!site) return [];
  return S.bld
    .filter((b) => !b.ex && b.fp && b.fp.length > 2 && b !== prim.b && inP(cen(b.fp), site.poly))
    .map((b) => ({
      name: b.name || b.id,
      fp: b.fp,
      base: base(b),
      H0: b._hAbove || 0,
      hf: b._rp ? b._rp.hf : null,
      d: b._rp ? b._rp.d : 0,
      roof: b.roof || { type: 'flat' },
      b,
    }));
}
function abstEdgesFp(T0, R, fp) {
  const n = fp.length,
    E = [];
  let top = 0;
  if (T0.hf) {
    const xs = fp.map((q) => q[0]),
      zs = fp.map((q) => q[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    for (let i = 0; i <= 8; i++)
      for (let j = 0; j <= 8; j++) {
        const p = [x0 + ((x1 - x0) * i) / 8, z0 + ((z1 - z0) * j) / 8];
        if (inP(p, fp)) {
          const v = T0.hf(p);
          if (isFinite(v)) top = Math.max(top, v);
        }
      }
  }
  const ang = +(T0.roof && T0.roof.angle) || 0;
  for (let i = 0; i < n; i++) {
    const p = fp[i],
      q = fp[(i + 1) % n],
      L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 0.3) continue;
    const ux = (q[0] - p[0]) / L,
      uz = (q[1] - p[1]) / L;
    let nx = uz,
      nz = -ux;
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (inP([mid[0] + nx * 0.05, mid[1] + nz * 0.05], fp)) {
      nx = -nx;
      nz = -nz;
    }
    let gm = 0;
    const ks = 24;
    let mn = 1e9,
      mx = -1e9,
      sm = 0;
    for (let k = 0; k <= ks; k++) {
      const t = k / ks,
        x = p[0] + (q[0] - p[0]) * t,
        z = p[1] + (q[1] - p[1]) * t;
      gm += gh(x, z) / (ks + 1);
      if (T0.hf) {
        const tt = Math.min(0.98, Math.max(0.02, t)),
          v = T0.hf([p[0] + (q[0] - p[0]) * tt, p[1] + (q[1] - p[1]) * tt]);
        if (isFinite(v)) {
          mn = Math.min(mn, v);
          mx = Math.max(mx, v);
          sm += v;
        }
      }
    }
    let add = 0,
      kind = 'Traufwand';
    const mean = sm / (ks + 1);
    if (T0.hf && T0.roof.type !== 'flat') {
      if (mx > 0.05 && mn > 0.6 * mx) {
        kind = 'Wand bis Dach';
        add = mean;
      } else if (mx > 0.05) {
        kind = 'Giebel';
        add = R.mode === 'C' ? (L <= 6 ? 0 : mean) : ang > 70 ? mx : mx / 3;
      } else {
        add =
          R.mode === 'C'
            ? 0
            : R.mode === 'B'
              ? ang >= 70
                ? top
                : top / 3
              : ang > 70
                ? top
                : ang > 45
                  ? top / 3
                  : 0;
      }
    }
    E.push({ p, q, L, nx, nz, kind, H: Math.max(0, T0.base + T0.H0 - gm) + (T0.d || 0) + add });
  }
  return E;
}
// Wandflächen aus dem tatsächlichen Modell (Staffelgeschosse, Rück-/Vorsprünge): senkrechte Dreiecke → Wandstücke mit Oberkante
function abstMeshEdges(T0, R) {
  const b = T0.b,
    raw = [],
    A = new T.Vector3(),
    B = new T.Vector3(),
    C = new T.Vector3();
  b._g.updateMatrixWorld(true);
  b._g.traverse((o) => {
    if (!o.isMesh || o.userData.roof || !o.geometry || !o.geometry.attributes.position) return;
    const pa = o.geometry.attributes.position,
      ix = o.geometry.index,
      N = ix ? ix.count : pa.count;
    for (let t = 0; t + 2 < N; t += 3) {
      A.fromBufferAttribute(pa, ix ? ix.getX(t) : t).applyMatrix4(o.matrixWorld);
      B.fromBufferAttribute(pa, ix ? ix.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld);
      C.fromBufferAttribute(pa, ix ? ix.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
      const ux = B.x - A.x,
        uy = B.y - A.y,
        uz = B.z - A.z,
        vx = C.x - A.x,
        vy = C.y - A.y,
        vz = C.z - A.z,
        cx = uy * vz - uz * vy,
        cy = uz * vx - ux * vz,
        cz = ux * vy - uy * vx,
        cl = Math.hypot(cx, cy, cz);
      if (cl < 1e-6) continue;
      const hl = Math.hypot(cx, cz);
      if (hl / cl < 0.97) continue;
      const ymax = Math.max(A.y, B.y, C.y),
        ymin = Math.min(A.y, B.y, C.y);
      if (ymax - ymin < 0.05) continue;
      const nx = cx / hl,
        nz = cz / hl,
        tx = -nz,
        tz = nx,
        us = [A, B, C].map((P) => P.x * tx + P.z * tz),
        u0 = Math.min(...us),
        u1 = Math.max(...us);
      if (u1 - u0 < 0.05) continue;
      raw.push({ nx, nz, tx, tz, u0, u1, v: A.x * nx + A.z * nz, top: ymax });
    }
  });
  const G2 = new Map();
  raw.forEach((r) => {
    const k = Math.round(((Math.atan2(r.nz, r.nx) * 180) / Math.PI) * 2) + '|' + Math.round(r.v * 20);
    let g = G2.get(k);
    if (!g) {
      g = { nx: r.nx, nz: r.nz, tx: r.tx, tz: r.tz, v: 0, c: 0, it: [] };
      G2.set(k, g);
    }
    g.v += r.v;
    g.c++;
    g.it.push(r);
  });
  const out = [],
    fp = b.fp;
  G2.forEach((g) => {
    const v = g.v / g.c;
    let bp = [...new Set(g.it.flatMap((r) => [r.u0, r.u1]).map((x) => Math.round(x * 50) / 50))].sort(
      (x, y) => x - y,
    );
    let prev = null;
    for (let i = 0; i + 1 < bp.length; i++) {
      const a0 = bp[i],
        a1 = bp[i + 1];
      if (a1 - a0 < 0.02) continue;
      const mid = (a0 + a1) / 2;
      let top = -1e9;
      g.it.forEach((r) => {
        if (r.u0 <= mid && r.u1 >= mid && r.top > top) top = r.top;
      });
      if (top < -1e8) {
        prev = null;
        continue;
      }
      if (prev && Math.abs(prev.top - top) < 0.05 && Math.abs(prev.a1 - a0) < 0.03) {
        prev.a1 = a1;
        continue;
      }
      prev = { a0, a1, top };
      out.push({ g, v, seg: prev });
    }
  });
  let E = [];
  out.forEach((o) => {
    const { g, v, seg } = o,
      P = [seg.a0 * g.tx + v * g.nx, seg.a0 * g.tz + v * g.nz],
      Q = [seg.a1 * g.tx + v * g.nx, seg.a1 * g.tz + v * g.nz],
      L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    if (L < 0.3) return;
    const M = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2],
      gm = (gh(P[0], P[1]) + gh(M[0], M[1]) + gh(Q[0], Q[1])) / 3,
      H = seg.top - gm;
    if (H < 0.3) return;
    let nx = g.nx,
      nz = g.nz,
      on = false;
    for (let i = 0; i < fp.length; i++) {
      const p = fp[i],
        q = fp[(i + 1) % fp.length],
        l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (l < 0.05) continue;
      const dd = (P0) => Math.abs((P0[0] - p[0]) * (q[1] - p[1]) - (P0[1] - p[1]) * (q[0] - p[0])) / l;
      if (dd(P) < 0.06 && dd(Q) < 0.06) {
        on = true;
        break;
      }
    }
    if (on && inP([M[0] + nx * 0.05, M[1] + nz * 0.05], fp)) {
      nx = -nx;
      nz = -nz;
    }
    E.push({
      p: P,
      q: Q,
      L,
      nx,
      nz,
      H,
      kind: on ? 'Traufwand' : 'Rücksprung/Staffel',
      mesh: 1,
      top: seg.top,
    });
  });
  if (T0.hf && T0.roof && T0.roof.type !== 'flat') {
    let li = b.levels.length - 1;
    while (li > 0 && b.levels[li].ug) li--;
    const fpT = lf(b, b.levels[li]),
      RE = abstEdgesFp(T0, R, fpT);
    E = E.filter(
      (w) =>
        !RE.some((r) => {
          if (r.nx * w.nx + r.nz * w.nz < 0.98) return false;
          const tx = -r.nz,
            tz = r.nx,
            dd = (P0) => Math.abs((P0[0] - r.p[0]) * r.nx + (P0[1] - r.p[1]) * r.nz),
            uu = (P0) => P0[0] * tx + P0[1] * tz,
            ua = uu(r.p),
            ub = uu(r.q),
            lo = Math.min(ua, ub) - 0.06,
            hi = Math.max(ua, ub) + 0.06;
          return (
            dd(w.p) < 0.06 &&
            dd(w.q) < 0.06 &&
            uu(w.p) >= lo &&
            uu(w.p) <= hi &&
            uu(w.q) >= lo &&
            uu(w.q) <= hi &&
            w.H <= r.H + 0.01
          );
        }),
    );
    E = E.concat(RE);
  }
  return E;
}
function abstFinish(E, R, site) {
  const walls = [];
  E.forEach((e, i) => {
    const { p, q, L, nx, nz, H, kind } = e,
      d = Math.max(R.f * H, R.m),
      rect = [p, q, [q[0] + nx * d, q[1] + nz * d], [p[0] + nx * d, p[1] + nz * d]];
    let tot = 0,
      out = 0;
    if (site) {
      const na = Math.max(2, Math.ceil(L / 0.5)),
        nb = Math.max(2, Math.ceil(d / 0.5)),
        cell = ((L / na) * d) / nb;
      for (let a = 0; a < na; a++)
        for (let c = 0; c < nb; c++) {
          const t = (a + 0.5) / na,
            r = (c + 0.5) / nb,
            pt = [p[0] + (q[0] - p[0]) * t + nx * d * r, p[1] + (q[1] - p[1]) * t + nz * d * r];
          tot += cell;
          if (!inP(pt, site.poly)) out += cell;
        }
    }
    walls.push({ i, p, q, L, H, d, kind, rect, out, tot, nx, nz });
  });
  return walls;
}
function abstWalls(T0, R, site) {
  const fp = T0.fp;
  if (area(fp) < 1) return null;
  let E = null;
  if (T0.b && T0.b._g && T0.b.levels && T0.b.levels.length) {
    try {
      E = abstMeshEdges(T0, R);
    } catch (err) {
      console.warn('abst mesh', err);
      E = null;
    }
  }
  if (!E || !E.length) E = abstEdgesFp(T0, R, fp);
  E.sort((x, y) => (x.kind === 'Rücksprung/Staffel') - (y.kind === 'Rücksprung/Staffel'));
  return abstFinish(E, R, site);
}
function abstCalc() {
  const T0 = abstTarget();
  if (!T0) return null;
  const R = abstRule(),
    cc = cen(T0.fp),
    site = P.find((q) => q.site && inP(cc, q.poly)) || (S.par && S.par.site && S.par) || null;
  const w0 = abstWalls(T0, R, site);
  if (!w0) return null;
  const all = [{ T: T0, walls: w0 }];
  abstOthers(T0, site).forEach((o) => {
    const w = abstWalls(o, R, site);
    if (w) all.push({ T: o, walls: w });
  });
  // Überschneidungen zwischen den Abstandsflächen verschiedener Gebäude (und Abstandsfläche auf fremdem Gebäude)
  const ov = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const A = all[i],
        B = all[j];
      let aa = 0,
        af = 0;
      for (const [X, Y] of [
        [A, B],
        [B, A],
      ])
        for (const w of X.walls) {
          const na = Math.max(2, Math.ceil(w.L / 0.5)),
            nb = Math.max(2, Math.ceil(w.d / 0.5)),
            cell = ((w.L / na) * w.d) / nb;
          let cnt = 0,
            cf = 0;
          for (let a = 0; a < na; a++)
            for (let c = 0; c < nb; c++) {
              const t = (a + 0.5) / na,
                r = (c + 0.5) / nb,
                pt = [
                  w.p[0] + (w.q[0] - w.p[0]) * t + w.nx * w.d * r,
                  w.p[1] + (w.q[1] - w.p[1]) * t + w.nz * w.d * r,
                ];
              if (inP(pt, Y.T.fp)) cf++;
              else if (X === A && Y.walls.some((v) => inP(pt, v.rect))) cnt++;
            }
          aa += cnt * cell;
          af += cf * cell;
        }
      if (aa > 0.05 || af > 0.05) ov.push({ a: A.T.name, b: B.T.name, aa, af, i, j });
    }
  return {
    T: T0,
    R,
    site,
    walls: w0,
    all,
    ov,
    over: w0.filter((w) => w.out > 0.05),
    overAll: all.filter((o) => o.walls.some((w) => w.out > 0.05)),
  };
}
function abstPaint() {
  // ── Erweiterung aus 15-grundriss/070-saubere-umrisse.js
  // ---- Abstandsflächen werden ausgeblendet, solange die Explosionsansicht aktiv ist (auch bei angewähltem Gebäude)
  if (S.expl && S.expl.on) {
    const c = PL.abst.getContext('2d');
    c.clearRect(0, 0, PW, PW);
    S._abst = null;
    return;
  }
  const c = PL.abst.getContext('2d');
  c.clearRect(0, 0, PW, PW);
  const L = LY.find((l) => l[1] === 'abst');
  if (!GEO.size || !L || !L[2]) return;
  const A = abstCalc();
  S._abst = A;
  if (!A) return;
  const K = PW / GEO.size,
    X = (x) => (x + GEO.size / 2) * K,
    path = (r) => {
      r.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
      c.closePath();
    };
  const rects = A.all.flatMap((o) => o.walls.map((w) => w.rect)),
    draw = (col) => {
      c.fillStyle = col;
      for (const r of rects) {
        c.beginPath();
        path(r);
        c.fill();
      }
    };
  if (A.site) {
    c.save();
    c.beginPath();
    path(A.site.poly);
    c.clip();
    draw('#ffe35a');
    c.restore();
    c.save();
    c.beginPath();
    c.rect(0, 0, PW, PW);
    path(A.site.poly);
    c.clip('evenodd');
    draw('#e0301e');
    c.restore();
  } else draw('#ffe35a');
  c.fillStyle = '#e0301e';
  for (let i = 0; i < A.all.length; i++)
    for (let j = i + 1; j < A.all.length; j++) {
      const P1 = A.all[i],
        P2 = A.all[j];
      for (const ra of P1.walls)
        for (const rb of P2.walls) {
          c.save();
          c.beginPath();
          path(ra.rect);
          c.clip();
          c.beginPath();
          path(rb.rect);
          c.clip();
          c.fillRect(0, 0, PW, PW);
          c.restore();
        }
      for (const [X0, Y0] of [
        [P1, P2],
        [P2, P1],
      ])
        for (const w of X0.walls) {
          c.save();
          c.beginPath();
          path(w.rect);
          c.clip();
          c.beginPath();
          path(Y0.T.fp);
          c.clip();
          c.fillRect(0, 0, PW, PW);
          c.restore();
        }
    }
}
function abstSig() {
  const t = abstTarget();
  if (!t) return '';
  const L = LY.find((l) => l[1] === 'abst');
  return JSON.stringify([
    t.fp,
    t.base,
    t.H0,
    t.d,
    t.roof,
    t.b && [t.b.levels.map((l) => [l.h, l.ug, l.fp]), t.b.patches],
    S.abst,
    L && L[2],
    P.filter((q) => q.site).map((q) => q.poly.length + ',' + Math.round(q.poly[0][0])),
    S.par && S.par.id,
    GEO.lon,
    S.bld
      .filter((b) => !b.ex && b !== t.b)
      .map((b) => [b.fp, b._hAbove, b.roof, b.levels.map((l) => [l.h, l.ug, l.fp]), b.patches]),
  ]);
}
let abstK = '';
setInterval(() => {
  try {
    if (!S.geo || HOME.open) return;
    const k = abstSig();
    if (k !== abstK) {
      const had = !!abstK;
      abstK = k;
      if (!k && !had) return;
      abstPaint();
      recomp();
      if (S.tab === 'Analyse' && !document.activeElement.closest?.('#pc input,#pc select')) rr();
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 400);
function abstSet(k, v) {
  if (k === 'st') {
    S.abst.st = v || null;
    S.abst.f = null;
    S.abst.m = null;
  } else {
    v = parseFloat(String(v).replace(',', '.'));
    S.abst[k] = isFinite(v) && v > 0 ? v : null;
  }
  abstK = '';
  rr();
}
function abstCard() {
  const A = abstCalc();
  let h = '<h4>Abstandsflächen</h4><div class="card">';
  const R = abstRule();
  h += `Bundesland<select style="width:100%" onchange="abstSet('st',this.value)">${Object.entries(ABR)
    .map(([k, v]) => `<option value="${k}" ${k === R.k ? 'selected' : ''}>${v[0]}</option>`)
    .join('')}</select>`;
  h += `<label style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">Faktor × H<input type="number" step="0.05" min="0.05" style="width:80px" value="${R.f}" onchange="abstSet('f',this.value)"></label><label style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">Mindesttiefe (m)<input type="number" step="0.5" min="0" style="width:80px" value="${R.m}" onchange="abstSet('m',this.value)"></label>`;
  if (!A) {
    return (
      h +
      '<div style="color:var(--mu);margin-top:6px">Ein Gebäude zeichnen oder auswählen – die Abstandsflächen aller geplanten Gebäude auf dem Grundstück werden berechnet.</div></div>'
    );
  }
  h +=
    kv('Gebäude', esc(A.T.name) + (A.all.length > 1 ? ' (+' + (A.all.length - 1) + ')' : '')) +
    kv('Regel', R.k.toUpperCase() + ': ' + f1(R.f, 2) + ' H, mind. ' + f1(R.m, 1) + ' m');
  const red = 'color:#5E7F92;font-weight:600',
    nOut = A.overAll.length,
    nOv = A.ov.length;
  const bad = nOut || nOv,
    sum = bad
      ? `<span style="${red}">${nOut ? nOut + ' Gebäude über der Grenze' : ''}${nOut && nOv ? ' · ' : ''}${nOv ? nOv + ' Überschneidung' + (nOv > 1 ? 'en' : '') : ''}</span>`
      : A.site
        ? '<span style="color:#2e7d32">alles eingehalten</span>'
        : '<span style="color:var(--mu)">kein Grundstück gewählt</span>';
  h += `<details style="margin-top:6px" ${S.abOpen ? 'open' : ''} ontoggle="S.abOpen=this.open"><summary style="cursor:pointer"><b>Details</b> · ${sum}</summary>`;
  if (!A.site)
    h +=
      '<div style="color:var(--mu);margin:4px 0">Kein Grundstück gewählt – die Lage zur Grenze wird nicht geprüft.</div>';
  A.all.forEach((o, gi) => {
    h +=
      `<div style="margin-top:8px"><b>${esc(o.T.name)}</b></div><table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="color:var(--mu);text-align:left"><th>Wand</th><th>Länge</th><th>H</th><th>Tiefe</th><th>Grenze</th></tr>` +
      o.walls
        .map(
          (w, i) =>
            `<tr title="${w.kind}"><td>${i + 1}${w.kind === 'Traufwand' ? '' : ' · ' + w.kind.replace('Wand bis Dach', 'Dach')}</td><td>${f1(w.L, 1)} m</td><td>${f1(w.H, 1)} m</td><td>${f1(w.d, 2)} m</td><td style="${w.out > 0.05 ? red : ''}">${A.site ? (w.out > 0.05 ? '✗ ' + f1(w.out, 1) + ' m² außen' : '✓') : '–'}</td></tr>`,
        )
        .join('') +
      '</table>';
  });
  if (A.all.length > 1)
    h += nOv
      ? '<div style="margin-top:8px"><b>Überschneidungen</b></div>' +
        A.ov
          .map(
            (o) =>
              `<div style="${red}">${esc(o.a)} ↔ ${esc(o.b)}: ${o.aa > 0.05 ? f1(o.aa, 1) + ' m² Abstandsflächen überlagern sich' : ''}${o.aa > 0.05 && o.af > 0.05 ? '; ' : ''}${o.af > 0.05 ? f1(o.af, 1) + ' m² Abstandsfläche liegt auf dem anderen Gebäude' : ''}</div>`,
          )
          .join('')
      : '<div style="color:#2e7d32;margin-top:8px">Keine Überschneidungen zwischen den geplanten Gebäuden.</div>';
  if (A.site)
    h += nOut
      ? `<div style="${red};margin-top:6px">Überschreitung der Grundstücksgrenze: ${A.overAll.map((o) => esc(o.T.name)).join(', ')}.</div>`
      : '<div style="color:#2e7d32;margin-top:6px">Alle Abstandsflächen liegen auf dem Grundstück.</div>';
  h +=
    '<div style="color:var(--mu);font-size:11px;margin-top:6px">Näherung nach Landesbauordnung, ohne Privilegierungen, Bebauungsplan und Baulasten; Flächen bis zur Mitte öffentlicher Straßen werden nicht berücksichtigt. Gelb = auf dem Grundstück, rot = außerhalb der Grenze oder Überschneidung. Keine Rechtsauskunft.</div></details></div>';
  return h;
}

// ---- Esc: alle Auswahlen aufheben, Menüs schließen
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  try {
    if (typeof LAY !== 'undefined' && LAY.open) return;
    if (typeof HOME !== 'undefined' && HOME.open) return;
    {
      const w = $('wz');
      if (w && getComputedStyle(w).display !== 'none') return;
    }
    const t = e.target;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) {
      t.blur();
      return;
    }
    document.querySelectorAll('#tbar .tg.open').forEach((x) => x.classList.remove('open'));
    const lp = $('lyp');
    if (lp && lp.style.display === 'block') tgLayer();
    const lc = $('lc');
    if (lc) lc.style.display = 'none';
    const bl = $('bl');
    if (bl) bl.classList.remove('on');
    try {
      vwClose();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    if (S.siteEdit) {
      S.siteEdit = null;
    }
    S.sel = null;
    S.selF = null;
    S.selP = null;
    S.selA = null;
    S.multi = [];
    S.multiA = [];
    S.roofSel = null;
    S.par = null;
    S.parSel = new Set();
    S.hov = null;
    S.hb = null;
    S.hv = null;
    S.hvB = null;
    S.vi = null;
    try {
      ctxSelect(null);
      treeSel(null);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    try {
      if (LB.sel) LB.sel = null;
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    try {
      areaSelDraw();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    try {
      mqEl && (mqEl.style.display = 'none');
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    try {
      parRefresh();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    H();
    hpos();
    drawOv();
    rr();
  } catch (err) {
    console.warn(err);
  }
});
