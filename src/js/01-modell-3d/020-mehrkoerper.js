// ---- Mehrkörper-Dächer (Satteldach/Walmdach): größte Geometrie bestimmt die Hauptfirstrichtung, kleinere Anbauten erhalten eigene Giebel
function roofRects(fp, TT, SS) {
  const pts = fp.map((p) => [TT(p), SS(p)]),
    n = pts.length;
  if (n < 4) return null;
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[(i + 1) % n],
      dt = Math.abs(b[0] - a[0]),
      ds = Math.abs(b[1] - a[1]),
      l = Math.hypot(dt, ds);
    if (l > 0.02 && Math.min(dt, ds) > 0.03 + 0.004 * l) return null;
  }
  const uq = (k) => {
    const v = pts.map((p) => p[k]).sort((x, y) => x - y),
      o = [];
    v.forEach((x) => {
      if (!o.length || x - o[o.length - 1].m > 0.05) o.push({ m: x, s: x, c: 1 });
      else {
        const q = o[o.length - 1];
        q.s += x;
        q.c++;
      }
    });
    return o.map((q) => q.s / q.c);
  };
  const Ts = uq(0),
    Ss = uq(1),
    nT = Ts.length - 1,
    nS = Ss.length - 1;
  if (nT < 1 || nS < 1 || nT * nS > 400) return null;
  const fill = [];
  for (let i = 0; i < nT; i++) {
    fill.push([]);
    for (let j = 0; j < nS; j++) {
      const c = [(Ts[i] + Ts[i + 1]) / 2, (Ss[j] + Ss[j + 1]) / 2];
      fill[i].push(inP(c, pts));
    }
  }
  const full = (i0, i1, j0, j1) => {
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!fill[i][j]) return false;
    return true;
  };
  const cand = [];
  for (let i0 = 0; i0 < nT; i0++)
    for (let i1 = i0; i1 < nT; i1++)
      for (let j0 = 0; j0 < nS; j0++)
        for (let j1 = j0; j1 < nS; j1++)
          if (full(i0, i1, j0, j1)) {
            const te = Ts[i1 + 1] - Ts[i0],
              se = Ss[j1 + 1] - Ss[j0];
            cand.push({ i0, i1, j0, j1, te, se, ar: te * se });
          }
  if (!cand.length) return null;
  const cov = fill.map((r) => r.map(() => false));
  let m0 = cand[0];
  cand.forEach((c) => {
    if (c.ar > m0.ar + 1e-6 || (Math.abs(c.ar - m0.ar) <= 1e-6 && c.te > m0.te)) m0 = c;
  });
  const rects = [m0],
    mark = (c) => {
      for (let i = c.i0; i <= c.i1; i++) for (let j = c.j0; j <= c.j1; j++) cov[i][j] = true;
    };
  mark(m0);
  const unc = (c) => {
    let k = 0;
    for (let i = c.i0; i <= c.i1; i++)
      for (let j = c.j0; j <= c.j1; j++) if (!cov[i][j]) k += (Ts[i + 1] - Ts[i]) * (Ss[j + 1] - Ss[j]);
    return k;
  };
  for (let it = 0; it < 8; it++) {
    let best = null,
      bu = 1e-4,
      ba = 1e9;
    cand.forEach((c) => {
      const u = unc(c);
      if (u > bu + 1e-6 || (u > 1e-4 && Math.abs(u - bu) <= 1e-6 && c.ar < ba)) {
        bu = u;
        ba = c.ar;
        best = c;
      }
    });
    if (!best) break;
    rects.push(best);
    mark(best);
  }
  const R = rects.map((c, k) => {
    const t0 = Ts[c.i0],
      t1 = Ts[c.i1 + 1],
      s0 = Ss[c.j0],
      s1 = Ss[c.j1 + 1],
      te = t1 - t0,
      se = s1 - s0;
    let ax = te >= se ? 't' : 's';
    if (k === 0) ax = 't';
    else if (Math.abs(te - se) < 0.05) ax = 's';
    return { k, t0, t1, s0, s1, ax };
  });
  return R.length > 1 ? R : null;
}
function roofField(type, fp, TT, SS, a, bb, tn) {
  let hf,
    lines = [],
    vl = [];
  if (type === 'sattel' || type === 'walm') {
    const RR = roofRects(fp, TT, SS);
    if (RR && RR.length > 1) {
      const Q = RR.map((q) => {
        const al = q.ax === 't' ? q.t0 : q.s0,
          ah = q.ax === 't' ? q.t1 : q.s1,
          c0 = q.ax === 't' ? q.s0 : q.t0,
          c1 = q.ax === 't' ? q.s1 : q.t1;
        return { ax: q.ax, a0: al, a1: ah, c0, c1, a0e: al, a1e: ah, f0: true, f1: true };
      });
      Q.forEach((q, k) => {
        if (!k) return;
        const cc = (q.c0 + q.c1) / 2;
        [0, 1].forEach((e) => {
          const ae = e ? q.a1 + 0.05 : q.a0 - 0.05;
          const pt = q.ax === 't' ? [ae, cc] : [cc, ae];
          for (let j = 0; j < k; j++) {
            const o = Q[j],
              ot = o.ax === 't',
              tc = pt[0],
              sc2 = pt[1],
              inT = ot
                ? tc >= o.a0 - 1e-6 && tc <= o.a1 + 1e-6 && sc2 >= o.c0 - 1e-6 && sc2 <= o.c1 + 1e-6
                : sc2 >= o.a0 - 1e-6 && sc2 <= o.a1 + 1e-6 && tc >= o.c0 - 1e-6 && tc <= o.c1 + 1e-6;
            if (inT) {
              q['f' + e] = false;
              if (o.ax !== q.ax) {
                const mid = (o.c0 + o.c1) / 2;
                if (e) q.a1e = Math.max(q.a1, mid);
                else q.a0e = Math.min(q.a0, mid);
              }
              break;
            }
          }
        });
      });
      const F = Q.map((q) => {
        const A = q.ax === 't' ? TT : SS,
          C = q.ax === 't' ? SS : TT,
          w = q.c1 - q.c0,
          cc = (q.c0 + q.c1) / 2,
          hip = type === 'walm';
        return {
          q,
          A,
          C,
          cc,
          f: (p) => {
            const x = A(p),
              c = C(p);
            if (x < q.a0e - 1e-6 || x > q.a1e + 1e-6 || c < q.c0 - 1e-6 || c > q.c1 + 1e-6) return 0;
            let h = w / 2 - Math.abs(c - cc);
            if (hip) {
              if (q.f0) h = Math.min(h, x - q.a0);
              if (q.f1) h = Math.min(h, q.a1 - x);
            }
            return tn * Math.max(0, h);
          },
        };
      });
      hf = (p) => {
        let m = 0;
        for (const o of F) {
          const v = o.f(p);
          if (v > m) m = v;
        }
        return m;
      };
      F.forEach((o) => {
        const q = o.q,
          w = q.c1 - q.c0;
        lines.push(
          (p) => o.C(p) - o.cc,
          (p) => o.C(p) - q.c0,
          (p) => o.C(p) - q.c1,
          (p) => o.A(p) - q.a0e,
          (p) => o.A(p) - q.a1e,
        );
        if (type === 'walm')
          [
            [q.f0, 0],
            [q.f1, 1],
          ].forEach(([fr, e]) => {
            if (!fr) return;
            for (const sg of [1, -1])
              lines.push((p) => w / 2 - sg * (o.C(p) - o.cc) - (e ? q.a1 - o.A(p) : o.A(p) - q.a0));
          });
      });
      for (let i = 0; i < F.length; i++)
        for (let j = i + 1; j < F.length; j++) vl.push((p) => F[i].f(p) - F[j].f(p));
      return { hf, lines, vl };
    }
  }
  if (type === 'sattel') {
    hf = (p) => tn * Math.max(0, bb - Math.abs(SS(p)));
    lines = [(p) => SS(p)];
  } else if (type === 'walm') {
    hf = (p) => tn * Math.max(0, Math.min(bb - Math.abs(SS(p)), a - Math.abs(TT(p))));
    lines = [(p) => SS(p), (p) => TT(p)];
    for (const k1 of [1, -1])
      for (const k2 of [1, -1]) lines.push((p) => TT(p) - k1 * k2 * SS(p) - k1 * (a - bb));
  } else hf = (p) => tn * Math.max(0, TT(p) + a);
  return { hf, lines, vl };
}
function roofGeo(b, yr, clip) {
  const r = b.roof;
  if (!r || !r.type || r.type === 'flat') return null;
  const fp = lf(b, b.levels[b.levels.length - 1]);
  if (fp.length < 3) return null;
  const d = Math.max(0, +r.dremp || 0),
    tn = Math.tan((Math.max(1, Math.min(75, +r.angle || 30)) * Math.PI) / 180),
    th = (roofDir(b) * Math.PI) / 180,
    tx = Math.cos(th),
    tz = Math.sin(th),
    sx = -tz,
    sz = tx;
  let t0 = 1e9,
    t1 = -1e9,
    s0 = 1e9,
    s1 = -1e9;
  fp.forEach(([x, z]) => {
    const t = x * tx + z * tz,
      s = x * sx + z * sz;
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
    s0 = Math.min(s0, s);
    s1 = Math.max(s1, s);
  });
  const tc = (t0 + t1) / 2,
    sc = (s0 + s1) / 2,
    a = (t1 - t0) / 2,
    bb = (s1 - s0) / 2,
    Cx = tc * tx + sc * sx,
    Cz = tc * tz + sc * sz,
    TT = (p) => (p[0] - Cx) * tx + (p[1] - Cz) * tz,
    SS = (p) => (p[0] - Cx) * sx + (p[1] - Cz) * sz;
  const RF = roofField(r.type, fp, TT, SS, a, bb, tn),
    hf = RF.hf,
    lines = RF.lines.concat(RF.vl),
    vl = RF.vl,
    nl = RF.lines.length;
  const pos = [],
    pw = [],
    pr = [];
  let hmax = 0,
    aR = 0,
    aW = 0;
  const tri3 = (A, B, C, up) => {
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    if (Math.abs(ny) < 1e-9 && up) return;
    if (up && ny < 0) {
      const t = B;
      B = C;
      C = t;
    }
    pos.push(...A, ...B, ...C);
    (up ? pr : pw).push(...A, ...B, ...C);
    {
      const ux = B[0] - A[0],
        uy = B[1] - A[1],
        uz = B[2] - A[2],
        vx = C[0] - A[0],
        vy = C[1] - A[1],
        vz = C[2] - A[2],
        ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      if (up) aR += ar;
      else aW += ar;
    }
  };
  const cO = clip ? clip.o : fp,
    cH = clip ? clip.h : [],
    V = cO.map((q) => new T.Vector2(q[0], q[1])),
    HV = cH.map((h) => h.map((q) => new T.Vector2(q[0], q[1]))),
    AV = V.concat(...HV),
    tris = T.ShapeUtils.triangulateShape(
      V.map((v) => v.clone()),
      HV.map((h) => h.map((v) => v.clone())),
    );
  for (const [i, j, k] of tris) {
    let pieces = [[AV[i], AV[j], AV[k]].map((v) => [v.x, v.y])];
    for (const f of lines) {
      const nx = [];
      for (const pc of pieces)
        for (const q of splitPoly(pc, f)) if (q.length >= 3 && area(q) > 1e-6) nx.push(q);
      pieces = nx;
    }
    for (const pc of pieces) {
      const v3 = pc.map((q) => {
        const h = d + hf(q);
        hmax = Math.max(hmax, h);
        return [q[0], yr + h, q[1]];
      });
      for (let m = 1; m < v3.length - 1; m++) tri3(v3[0], v3[m], v3[m + 1], true);
    }
  }
  (clip ? [cO].concat(cH) : [fp]).forEach((fp) =>
    fp.forEach((p, i) => {
      const q = fp[(i + 1) % fp.length],
        ts = [0, 1];
      for (const f of lines.slice(0, nl)) {
        const f0 = f(p),
          f1 = f(q);
        if ((f0 > 1e-9 && f1 < -1e-9) || (f0 < -1e-9 && f1 > 1e-9)) ts.push(f0 / (f0 - f1));
      }
      ts.sort((x, y) => x - y);
      if (vl.length) {
        const ex = [],
          at = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        for (let m = 0; m < ts.length - 1; m++) {
          const A0 = at(ts[m]),
            B0 = at(ts[m + 1]);
          for (const f of vl) {
            const f0 = f(A0),
              f1 = f(B0);
            if ((f0 > 1e-9 && f1 < -1e-9) || (f0 < -1e-9 && f1 > 1e-9))
              ex.push(ts[m] + ((ts[m + 1] - ts[m]) * f0) / (f0 - f1));
          }
        }
        ts.push(...ex);
        ts.sort((x, y) => x - y);
      }
      for (let m = 0; m < ts.length - 1; m++) {
        if (ts[m + 1] - ts[m] < 1e-6) continue;
        const P = [p[0] + (q[0] - p[0]) * ts[m], p[1] + (q[1] - p[1]) * ts[m]],
          Q = [p[0] + (q[0] - p[0]) * ts[m + 1], p[1] + (q[1] - p[1]) * ts[m + 1]],
          yP = yr + d + hf(P),
          yQ = yr + d + hf(Q);
        if (yP - yr < 1e-4 && yQ - yr < 1e-4) continue;
        tri3([P[0], yr, P[1]], [Q[0], yr, Q[1]], [Q[0], yQ, Q[1]], false);
        tri3([P[0], yr, P[1]], [Q[0], yQ, Q[1]], [P[0], yP, P[1]], false);
      }
    }),
  );
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return { geo: g, h: hmax, pw, pr, aR, aW, hf, d, ln: lines };
}
function roofSet(k, v) {
  const b = S.sel;
  if (!b || b.ex) return;
  hist();
  const r = (b.roof = b.roof || { type: 'flat' });
  if (k === 'type') {
    r.type = v;
    if (v !== 'flat') {
      r.angle = RD[v].angle;
      if (r.dremp == null) r.dremp = 0;
      r.dir = null;
    }
  } else if (k === 'dir') r.dir = v === '' || v == null ? null : +v;
  else r[k] = +v;
  mesh(b);
  H();
  hpos();
  rr();
}
function roofUse(b) {
  return (
    (b.roof && b.roof.use) || (b.levels.length && b.levels[b.levels.length - 1].use) || b.use || 'Wohnen'
  );
}
function rUseSet(v) {
  const b = S.sel;
  if (!b || b.ex || !b.roof) return;
  hist();
  b.roof.use = v;
  mesh(b);
  H();
  hpos();
  rr();
}
function roofRow(b) {
  const r = b.roof;
  if (!r || !r.type || r.type === 'flat') return '';
  const nm = (RT.find((t) => t[0] === r.type) || [0, r.type])[1],
    short = nm.replace('dach', ''),
    A = b._roofA || {},
    sel = S.roofSel === b && !selOk(),
    z = b._h - (b._ug || 0);
  let h = `<div class="lr${sel ? ' on' : ''}" data-k="roof" onclick="selRoof()" style="display:grid;grid-template-columns:40px 1fr 62px 24px 24px;gap:4px;align-items:center;margin-bottom:4px;padding:2px 4px;border-radius:6px"><b><span title="${roofUse(b)}" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;background:${S.uses[roofUse(b)]}"></span>DG<br><span style="font-weight:400;font-size:10px;color:var(--mu)">${short}</span></b><input type="text" value="${f1(b._roofH || 0, 2)}" disabled title="Höhe des Dachgeschosses inkl. Drempel bis First – wird aus den Dachspezifikationen errechnet"><span style="color:var(--mu);font-size:11px;line-height:1.2">${z < 0 ? '' : '+'}${f1(z, 2)}<br>${f1(A.wf || 0)} m²</span><button class="sm" title="Dachgeschoss-Grundriss im Grundrisstool öffnen" onclick="event.stopPropagation();grOpenLv('${esc(b.id)}','dg')">▦</button><span></span></div>`;
  if (sel)
    h += `<div class="card" style="margin:0 0 6px 0"><button class="pri" style="margin:0 0 6px" onclick="grOpenLv('${esc(b.id)}','dg')">▦ Grundriss öffnen</button>Nutzung<select style="width:100%" onchange="rUseSet(this.value)">${USES.map((u) => `<option ${u == roofUse(b) ? 'selected' : ''}>${u}</option>`).join('')}</select>${roofCtl(b)}</div><div id="rinfo" style="color:var(--mu);font-size:11px;margin:-2px 0 8px 44px;line-height:1.5">${nm} · Neigung ${r.angle != null ? r.angle : '–'}° · Drempel ${f1(+r.dremp || 0, 2)} m · Firsthöhe ${f1(b._roofH || 0, 2)} m<br>Grundfläche ${f1(A.tot || 0)} m²<br>Raumhöhe ≥ 2 m: ${f1(A.a100 || 0)} m² × 100 %<br>Raumhöhe 1–2 m: ${f1(A.a50 || 0)} m² × 50 %<br>Raumhöhe &lt; 1 m: ${f1(A.a0 || 0)} m² × 0 %<br><b style="color:var(--tx)">anrechenbar ${f1(A.wf || 0)} m²</b></div>`;
  return h;
}
function selRoof() {
  const b = S.sel;
  if (!b || b.ex) return;
  S.roofSel = b;
  S.selF = null;
  H();
  rr();
  try {
    if (roofGables(b).length)
      $('hud').textContent =
        'Dachgeschoss: weißen Punkt am Giebel ziehen = Giebelwand verschieben (alle Geschosse)';
  } catch (e) {
    logErr(e, 'selRoof');
  }
}
function roofCtl(b) {
  const r = b.roof || { type: 'flat' };
  let h =
    'Dachform<select style="width:100%" onchange="roofSet(\'type\',this.value)">' +
    RT.map(([k, n]) => `<option value="${k}" ${k === r.type ? 'selected' : ''}>${n}</option>`).join('') +
    '</select>';
  if (r.type !== 'flat')
    h += `Neigung (°)<input type="number" min="1" max="75" step="1" value="${r.angle}" onchange="roofSet('angle',this.value)">Drempelhöhe (m)<input type="number" min="0" max="3" step="0.05" value="${r.dremp || 0}" onchange="roofSet('dremp',this.value)">${r.type === 'pult' ? 'Richtung der Dachneigung' : 'Firstrichtung'} (°)<div style="display:flex;gap:4px"><input type="number" step="5" value="${roofDir(b)}" onchange="roofSet('dir',this.value)"><button class="sm" onclick="roofSet('dir',null)">Auto</button></div>${kv('Höhe Dachgeschoss', f1(b._roofH || 0, 2) + ' m')}`;
  h += `<button class="sm" style="margin-top:8px;width:100%" onclick="fdOpen('${esc(b.id)}')">▦ Fassadendesigner öffnen</button>`;
  return h;
}
function roofCard(b) {
  if (S.roofSel === b && !selOk() && b.roof && b.roof.type && b.roof.type !== 'flat') return '';
  return '<h4>Dach</h4><div class="card">' + roofCtl(b) + '</div>';
}
function roofUi() {
  const t = $('nd').value;
  $('ndw').style.display = t === 'flat' ? 'none' : 'block';
  if (t !== 'flat') $('na').value = RD[t].angle;
}
function mkRoof() {
  const t = ($('nd') || {}).value || 'flat';
  return t === 'flat'
    ? { type: 'flat' }
    : { type: t, angle: +$('na').value || RD[t].angle, dremp: Math.max(0, +$('ndr').value || 0), dir: null };
}
function mesh(b) {
  // ── Erweiterung aus 26-modellier-modus/070-pruefungen.js
  try {
    if (b && b.levels && b.levels.some((l) => l.faces && l.faces.length)) szFix(b);
  } catch (x) {
    console.warn('szFix', x);
  }
  if (b._g) b._g.parent.remove(b._g);
  const g = new T.Group(),
    sh0 = new T.Shape(b.fp.map((q) => new T.Vector2(q[0], -q[1]))),
    ugH = b.levels.reduce((t, l) => t + (l.ug ? l.h : 0), 0),
    y0 = base(b) - ugH;
  let cum = 0;
  b.levels.forEach((l, i) => (l.name = lname(b, i)));
  const pz = (k) => {
      let z = y0;
      for (let j = 0; j < k; j++) z += b.levels[j].h;
      return z;
    },
    PP = b.ex ? [] : pxPolys(b, pz);
  b.levels.forEach((l, i) => {
    const lo_ = pz(i),
      hi_ = lo_ + l.h,
      sh_ = PP.filter((o) => o.p.i < 0 && (+o.p.d || 0) < -0.01 && o.p.k >= i),
      okF = (o) => pxInside({ fp: lf(b, l) }, o.poly),
      rec = PP.filter((o) => o.p.k === i && o.p.i >= 0 && (+o.p.d || 0) < -0.01),
      recT = sh_.filter((o) => (o.p.k === i || o.F.z0 + o.p.d < hi_ - 0.01) && okF(o)),
      recB = i > 0 ? sh_.filter((o) => o.F.z0 + o.p.d < lo_ - 0.01 && okF(o)) : [],
      recA = { length: rec.length + recT.length + recB.length },
      dpt = l.h + (recA.length && !i ? 3 : 0);
    let ge = new T.ExtrudeGeometry(znShape(b, l, i), { depth: dpt, bevelEnabled: false });
    ge.rotateX(-Math.PI / 2);
    if (rec.length) ge = pxCut(ge, b, i, rec, y0 - (i ? 0 : 3) + cum);
    if (recT.length) ge = pxCutCap(ge, lf(b, l), recT, dpt, true);
    if (recB.length) ge = pxCutCap(ge, lf(b, l), recB, 0, false);
    const m = new T.Mesh(
      ge,
      mat(b.ex ? 0xe6e6e6 : new T.Color(S.uses[l.use || b.use || 'Wohnen']), { emissive: 0x000000 }),
    );
    m.position.y = y0 - (i ? 0 : 3) + cum;
    if (!i && !recA.length) {
      m.scale.y = (l.h + 3) / l.h;
    }
    m.castShadow = m.receiveShadow = true;
    m.userData.b = b;
    m.userData.k = i;
    const e = new T.LineSegments(new T.EdgesGeometry(ge), new T.LineBasicMaterial({ color: 0x4a4a4a }));
    e.userData.kont = 1;
    e.visible = !S.noK;
    e.position.copy(m.position);
    e.scale.copy(m.scale);
    g.add(m, e);
    cum += l.h;
  });
  if (PP.length) pxMeshes(b, g, pz, new T.Color(S.uses[b.use || 'Wohnen']));
  try {
    znMeshes(b, g, pz);
  } catch (e) {
    console.warn('zn', e);
  }
  const rr0 = roofGeo(b, y0 + cum);
  b._rp = rr0;
  b._roofA = roofAreas(b);
  b._roofH = 0;
  if (rr0) {
    b._roofH = rr0.h;
    const rm = new T.Mesh(
      rr0.geo,
      mat(new T.Color(b.ex ? 0xe6e6e6 : S.uses[roofUse(b)]), { emissive: 0x000000, side: T.DoubleSide }),
    );
    rm.castShadow = rm.receiveShadow = true;
    rm.userData.b = b;
    rm.userData.k = null;
    rm.userData.roof = true;
    const re = new T.LineSegments(
      new T.EdgesGeometry(rr0.geo, 15),
      new T.LineBasicMaterial({ color: 0x4a4a4a }),
    );
    re.userData.kont = 1;
    re.visible = !S.noK;
    g.add(rm, re);
  }
  b._hTot = cum - ugH + b._roofH;
  b._hAbove = cum - ugH;
  b._ug = ugH;
  b._g = g;
  b._h = cum;
  b._y = y0;
  (b.ex ? G.ex : G.nb).add(g);
  if (!b.ex && S.zo) zoNew(b);
  if (S.hlk && !b.ex) hlApply();
  if (!b.ex)
    try {
      treePruneB(b);
    } catch (e) {
      logErr(e, 'mesh');
    }
  // ── Erweiterung aus 24-erweiterungen-v344-v436/070-gelaendeplanum.js (danach)
  try {
    if (typeof PLM !== 'undefined') {
      clearTimeout(PLM._ft);
      PLM._ft = setTimeout(() => plmTick(), 30);
    }
  } catch (e) {
    logErr(e, 'mesh');
  }
}
