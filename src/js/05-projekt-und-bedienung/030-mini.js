// ---- Mini-Menü: exakte Maße für Rechtecke (Entwurf und Gebäude)
function rmTarget() {
  if (S.closed && S.dk === 'rect' && S.tool === 'f') return S.draft;
  const b = S.sel;
  if (b && !b.ex && b.kind === 'rect' && S.bld.includes(b) && cfp(b).length == 4) return cfp(b);
  return null;
}
function rmDims(f) {
  const a = f[0],
    b = f[1],
    d = f[3],
    l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    w = Math.hypot(d[0] - a[0], d[1] - a[1]);
  if (l < 0.01 || w < 0.01) return null;
  const dot = ((b[0] - a[0]) * (d[0] - a[0]) + (b[1] - a[1]) * (d[1] - a[1])) / (l * w),
    c = [f[2][0] - b[0] - d[0] + a[0], f[2][1] - b[1] - d[1] + a[1]];
  if (Math.abs(dot) > 0.01 || Math.hypot(c[0], c[1]) > 0.05) return null;
  return { l, w };
}
function updRM() {
  const f = rmTarget(),
    d = f && f.length == 4 ? rmDims(f) : null,
    m = $('rm');
  m.style.display = d ? 'flex' : 'none';
  if (!d || m.contains(document.activeElement)) return;
  $('rml').value = d.l.toFixed(2);
  $('rmw').value = d.w.toFixed(2);
}
function rmSet(k, v) {
  const f = rmTarget(),
    d = f && rmDims(f),
    x = parseFloat(v);
  if (!d || !(x > 0)) {
    updRM();
    return;
  }
  const isB = f !== S.draft,
    ct = isB ? (hist(), ctBegin(S.sel)) : null;
  const a = f[0],
    p1 = f[1],
    p3 = f[3],
    u = [(p1[0] - a[0]) / d.l, (p1[1] - a[1]) / d.l],
    w = [(p3[0] - a[0]) / d.w, (p3[1] - a[1]) / d.w],
    L = k == 'l' ? x : d.l,
    W = k == 'w' ? x : d.w;
  f[1] = [a[0] + u[0] * L, a[1] + u[1] * L];
  f[3] = [a[0] + w[0] * W, a[1] + w[1] * W];
  f[2] = [f[1][0] + w[0] * W, f[1][1] + w[1] * W];
  if (ct) ctEnd(ct);
  if (isB) {
    mesh(S.sel);
    H();
    hpos();
    rr();
  } else drawOv();
  updRM();
}
function setShape(sh, dm) {
  cancel();
  S.dm = dm === 'area' ? 'area' : 'bld';
  S.shape = sh || 'free';
  S.tab = 'Planen';
  tool('f');
  try {
    H();
    hpos();
  } catch (e) {
    logErr(e, 'setShape');
  }
  nav();
  rr();
}
function shapeGeo(cur) {
  const sh = S.shape,
    A = S.anchor,
    th = ((parseFloat(S.num.a) || 0) * Math.PI) / 180 + drRot(),
    u = [Math.cos(th), Math.sin(th)],
    v = [-u[1], u[0]];
  if (sh == 'rect') {
    const L = parseFloat(S.num.l),
      W = parseFloat(S.num.w),
      nu = !!(L && W),
      P0 = A || cur;
    if (!P0) return null;
    let l, w;
    if (nu) {
      l = L;
      w = W;
    } else {
      if (!A || !cur) return { pts: null };
      const dx = cur[0] - A[0],
        dz = cur[1] - A[1],
        l = dx * u[0] + dz * u[1],
        w = dx * v[0] + dz * v[1];
      if (Math.abs(l) < 0.05 || Math.abs(w) < 0.05)
        return {
          pts: [A, cur],
          txt: 'Rechteck · gegenüberliegende Ecke klicken · oder Länge;Breite tippen + Enter',
        };
      const pp = [
        A,
        [A[0] + u[0] * l, A[1] + u[1] * l],
        [A[0] + u[0] * l + v[0] * w, A[1] + u[1] * l + v[1] * w],
        [A[0] + v[0] * w, A[1] + v[1] * w],
      ];
      return {
        pts: pp,
        txt:
          'Rechteck ' +
          f1(Math.abs(l), 2) +
          ' × ' +
          f1(Math.abs(w), 2) +
          ' m · ' +
          f1(Math.abs(l * w), 1) +
          ' m² · Klick = fertig',
      };
    }
    if (Math.abs(l * w) < 0.01) return { pts: null };
    const pts = [
      P0,
      [P0[0] + u[0] * l, P0[1] + u[1] * l],
      [P0[0] + u[0] * l + v[0] * w, P0[1] + u[1] * l + v[1] * w],
      [P0[0] + v[0] * w, P0[1] + v[1] * w],
    ];
    return {
      pts,
      txt:
        'Rechteck ' +
        f1(Math.abs(l), 2) +
        ' × ' +
        f1(Math.abs(w), 2) +
        ' m · ' +
        f1(Math.abs(l * w), 1) +
        ' m²',
      done: nu,
    };
  }
  if (sh == 'poly') {
    const n = Math.max(3, Math.min(64, Math.round(S.sides || 6))),
      C0 = A || cur;
    if (!C0) return null;
    let r0 = null,
      a0 = 0;
    if (A && cur) {
      r0 = Math.hypot(cur[0] - A[0], cur[1] - A[1]);
      a0 = Math.atan2(cur[1] - A[1], cur[0] - A[0]);
    }
    if (!r0 || r0 < 0.1) return { pts: null, txt: n + '-Eck · Radius ziehen · Seitenzahl tippen (z. B. 8s)' };
    const pp = [];
    for (let i = 0; i < n; i++) {
      const t = a0 + (i / n) * 2 * Math.PI;
      pp.push([C0[0] + r0 * Math.cos(t), C0[1] + r0 * Math.sin(t)]);
    }
    return {
      pts: pp,
      txt:
        n +
        '-Eck r = ' +
        f1(r0, 2) +
        ' m · ' +
        f1((n / 2) * r0 * r0 * Math.sin((2 * Math.PI) / n), 1) +
        ' m² · Klick = fertig',
    };
  }
  const R = parseFloat(S.num.r),
    C = A || cur;
  if (!C) return null;
  let r;
  if (R) r = Math.abs(R);
  else if (A && cur) r = Math.hypot(cur[0] - A[0], cur[1] - A[1]);
  else return { pts: null };
  if (r < 0.1) return { pts: null };
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const t = (i / 36) * 2 * Math.PI;
    pts.push([C[0] + r * Math.cos(t), C[1] + r * Math.sin(t)]);
  }
  return { pts, txt: 'Kreis r = ' + f1(r, 2) + ' m · ' + f1(Math.PI * r * r, 1) + ' m²', done: !!R };
}
function shapeUpd(cur) {
  const g = shapeGeo(cur);
  S.prev = g && g.pts;
  S.hs = (g && g.txt) || '';
  drawOv(cur);
}
function finish(pts) {
  if (area(pts) < 0.5) return;
  if (window.sksFinish && sksFinish(pts)) return;
  S.draft = pts.map((p) => p.slice());
  S.dk = S.shape;
  S.closed = true;
  S.prev = null;
  S.anchor = null;
  S.edge = null;
  S.hs = '';
  S.info = '';
  S.snp = null;
  S.tab = 'Planen';
  drawOv();
  nav();
  rr();
}
function shapeClick(e) {
  const g = ground(e);
  if (!g) return;
  const q = snap(g, e, null, S.shape === 'rect' && S.anchor && !S.edge ? [S.anchor] : []).p;
  S.lastQ = q;
  if (!S.anchor) {
    if (S.refH == null) S.refH = gh(q[0], q[1]);
    const r = shapeGeo(q);
    if (r && r.done && r.pts) finish(r.pts);
    else {
      S.anchor = q;
      shapeUpd(q);
    }
    return;
  }

  const r = shapeGeo(q);
  if (r && r.pts) finish(r.pts);
}
function shapeOk() {
  const q = S.lastQ;
  if (!q) return;
  const g = shapeGeo(q);
  if (g && g.pts) finish(g.pts);
}
function shapePanel() {
  if (S.dm === 'street') return stPanel();
  const sh = S.shape,
    btn = (k, t) =>
      `<button class="sm" style="flex:1;${sh == k ? 'background:var(--ln);font-weight:600' : ''}" onclick="setShape('${k}',S.dm)">${t}</button>`,
    inp = (k, t, ph) =>
      `${t}<input type="number" step="0.1" placeholder="${ph}" value="${S.num[k]}" oninput="S.num.${k}=this.value;if(S.lastQ)shapeUpd(S.lastQ)" onkeydown="if(event.key=='Enter')shapeOk()">`,
    hint =
      sh == 'free'
        ? 'Punkte klicken, Enter oder Doppelklick schließt. Nahe Punkte, Kanten und rechte Winkel rasten ein (Shift = frei).'
        : sh == 'rect'
          ? '1. Klick = erste Ecke, 2. Klick = gegenüberliegende Ecke. Oder nach dem 1. Klick Länge;Breite tippen + Enter.'
          : sh == 'poly'
            ? 'Mittelpunkt klicken, Radius ziehen, Klick = fertig. Seitenzahl tippen, z. B. 8s + Enter.'
            : 'Mittelpunkt klicken, Radius ziehen, Klick = fertig. Oder Radius tippen + Enter.';
  return `<h4>${S.dm === 'area' ? 'Fläche zeichnen' : 'Gebäude zeichnen'}</h4><div class="card"><div style="display:flex;gap:4px;margin-bottom:6px">${SHP.map((x) => btn(x.k, x.n)).join('')}</div>${sh == 'rect' ? inp('l', 'Länge (m)', 'frei') + inp('w', 'Breite (m)', 'frei') + inp('a', 'Drehung (°)', '0') : sh == 'circ' ? inp('r', 'Radius (m)', 'frei') : ''}<div style="color:var(--mu);margin-top:6px">${hint}</div>${sh != 'free' ? '<button class="pri" onclick="shapeOk()">Fläche erzeugen</button>' : ''}</div>`;
}
function cutMove(e) {
  const c = S.cut,
    p = wallPt(e, c);
  if (!p) return;
  const ym = snapY(c.b, p.y);
  c.y0 = Math.min(c.zb, ym);
  c.y1 = Math.max(c.zt, ym);
  drawCut();
}
function roofTopK(b) {
  let L = b.levels.length - 1;
  while (L > 0 && b.levels[L].ug) L--;
  return L;
}
function roofGables(b) {
  if (!b || b.ex || !b._rp || !b._rp.hf || !b.roof || !b.roof.type || b.roof.type === 'flat') return [];
  const L = roofTopK(b),
    f = lf(b, b.levels[L]),
    n = f.length,
    out = [];
  for (let i = 0; i < n; i++) {
    const p = f[i],
      q = f[(i + 1) % n],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 0.5) continue;
    let mn = 1e9,
      mx = -1e9;
    for (let k = 0; k <= 12; k++) {
      const t = Math.min(0.98, Math.max(0.02, k / 12)),
        v = b._rp.hf([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      if (isFinite(v)) {
        mn = Math.min(mn, v);
        mx = Math.max(mx, v);
      }
    }
    if (mx > 0.05 && mn <= 0.6 * mx) out.push(i);
  }
  return out;
}
function cutRange(b, k) {
  const sf = selOk();
  if (sf && sf.b === b) {
    if (k !== sf.k) return null;
    let z = b._y;
    for (let j = 0; j < k; j++) z += b.levels[j].h;
    return [z, z + b.levels[k].h];
  }
  return [b._y, b._y + b._h];
}
function cutPrev(e) {
  const sf = selOk();
  if (!(sf && sf.b === S.sel)) S.hv = null;
  else if (S.hv && S.hv.k !== sf.k) S.hv = null;
  const h = S.hov;
  if (h && h.t == 'wall' && h.b === S.sel && S.bld.includes(h.b)) {
    const R = cutRange(h.b, h.k);
    if (R) {
      const c = edgeInfo(h.b, h.k, h.i);
      Object.assign(c, { b: h.b, k: h.k, i: h.i, y0: R[0], y1: R[1] });
      const p = wallPt(e, c);
      if (p) {
        c.s = snapS(c, h.b, (p.x - c.a[0]) * c.u[0] + (p.z - c.a[1]) * c.u[1]);
        S.cutPrev = c;
        drawCut();
        return;
      }
    }
  }
  if (S.cutPrev) {
    S.cutPrev = null;
    drawCut();
  }
}
function cutClick(e) {
  const b = S.sel;
  if (!b || b.ex || !S.bld.includes(b)) {
    $('hud').textContent = 'Schneiden: zuerst ein Gebäude auswählen';
    return;
  }
  const w = wallHit(e);
  if (!w || w.b !== b) {
    try {
      $('hud').textContent = !w
        ? 'Schneiden: keine Wand getroffen – eine Außenwand des gewählten Gebäudes anklicken (nicht Dach oder Boden)'
        : 'Schneiden: diese Wand gehört zu einem anderen Gebäude – das zu schneidende Gebäude zuerst auswählen';
    } catch (e) {
      logErr(e, 'cutClick');
    }
    return;
  }
  const R = cutRange(b, w.k);
  if (!R) {
    $('hud').textContent = 'Schneiden: Wand des gewählten Geschosses anklicken';
    return;
  }
  const c = edgeInfo(b, w.k, w.i);
  Object.assign(c, { b, k: w.k, i: w.i });
  const p = wallPt(e, c) || w.pt;
  c.s = snapS(c, b, (p.x - c.a[0]) * c.u[0] + (p.z - c.a[1]) * c.u[1]);
  const lo = R[0],
    hi = R[1],
    js = [],
    sf0 = selOk(),
    keepK = sf0 && sf0.b === b ? sf0.k : -1;
  let z = b._y;
  b.levels.forEach((l, j) => {
    if (z >= lo - 0.02 && z + l.h <= hi + 0.02) js.push(j);
    z += l.h;
  });
  S.cut = null;
  S.cutPrev = null;
  if (!js.length) {
    drawCut();
    drawOv();
    return;
  }
  hist();
  const M = [c.a[0] + c.u[0] * c.s, c.a[1] + c.u[1] * c.s];
  let cnt = 0;
  js.forEach((j) => {
    const l = b.levels[j],
      fp = lf(b, l).map((q) => q.slice()),
      m = fp.length;
    for (let q = 0; q < m; q++) {
      const E = fp[q],
        F = fp[(q + 1) % m],
        t0 = (E[0] - c.a[0]) * c.u[0] + (E[1] - c.a[1]) * c.u[1],
        t1 = (F[0] - c.a[0]) * c.u[0] + (F[1] - c.a[1]) * c.u[1],
        d0 = (E[0] - c.a[0]) * c.n[0] + (E[1] - c.a[1]) * c.n[1],
        d1 = (F[0] - c.a[0]) * c.n[0] + (F[1] - c.a[1]) * c.n[1];
      if (Math.abs(d0) < 0.03 && Math.abs(d1) < 0.03 && t0 < c.s - 0.05 && t1 > c.s + 0.05) {
        fp.splice(q + 1, 0, M.slice(), M.slice());
        l.fp = fp;
        cnt++;
        break;
      }
    }
  });
  if (!cnt) S.hist.pop();
  else if (b.kind === 'circ') b.kind = 'free';
  S.sel = b;
  mesh(b);
  tool('v');
  S.sel = b;
  S.selF = keepK >= 0 ? { b, k: keepK, i: -1 } : null;
  H();
  hpos();
  S.tab = 'Planen';
  nav();
  rr();
  drawCut();
  $('hud').textContent = cnt
    ? (keepK >= 0
        ? 'Geschoss an dieser Stelle getrennt'
        : `Fassadenseite in ${cnt} Geschoss${cnt > 1 ? 'en' : ''} getrennt`) +
      (keepK >= 0
        ? ' – Maus über ein Wandstück: Kugel in der Wandmitte ziehen'
        : ' – Geschoss wählen, dann die Kugel in der Wandmitte des Teils ziehen')
    : 'Keine Wand an dieser Stelle';
}
function planePt(e, y) {
  ray(e);
  const p = new T.Vector3();
  return rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -y), p) ? [p.x, p.z] : null;
}
const CUR =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="27" viewBox="-2 -2 44 27"><g fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"><path d="M0 11.7L11.1 4.4V18.9Z"/><rect x="14.4" y="0" width="4.05" height="22.9"/><rect x="21.5" y="0" width="4.05" height="22.9"/><path d="M40 11.7L28.9 4.4V18.9Z"/></g></svg>',
  ) +
  '") 22 13, ew-resize';
function hover(e) {
  hover0(e);
  const sf = selOk();
  if (S.m3 && (S.tool === 'v' || S.tool === 'b') && S.sel && S.bld.includes(S.sel)) {
    if (sf && sf.b === S.sel) {
      S.hb = null;
      const onK = S.hov && hc.visible && S.hov.b === sf.b && S.hov.k === sf.k && rc.intersectObject(hc)[0],
        w = S.hov && S.hov.t === 'wall' && S.hov.b === sf.b && S.hov.k === sf.k ? S.hov : null;
      if (onK) {
        // Zeiger auf dem Knopf: bewusst nichts ändern
      } else if (sf.i < 0) {
        let nt = false;
        try {
          const fi = fInfo({ b: sf.b, k: sf.k, t: 'top' }),
            v = fi.pos.clone().project(act()),
            r = cv.getBoundingClientRect();
          nt =
            Math.hypot(
              r.left + ((v.x + 1) / 2) * r.width - e.clientX,
              r.top + ((1 - v.y) / 2) * r.height - e.clientY,
            ) < 28;
        } catch (e) {
          logErr(e, 'hover');
        }
        if (w && !nt) {
          S.hov = { b: sf.b, k: sf.k, t: 'wall', i: w.i };
          S.hv = { b: sf.b, k: sf.k, i: w.i };
        } else S.hov = { b: sf.b, k: sf.k, t: 'top' };
      } else S.hov = w ? { b: sf.b, k: sf.k, t: 'wall', i: w.i } : { b: sf.b, k: sf.k, t: 'wall', i: sf.i };
    } else if (!sf) {
      const gl = S.roofSel === S.sel ? roofGables(S.sel) : [];
      if (gl.length) {
        S.hb = null;
        const onK = S.hov && S.hov.g && hc.visible && rc.intersectObject(hc)[0];
        if (!onK && !(S.hov && S.hov.g && S.hov.b === S.sel)) {
          const b = S.sel,
            L = roofTopK(b),
            f = lf(b, b.levels[L]),
            cx = pc.position.x,
            cz = pc.position.z;
          let bi = gl[0],
            bs = -1e9;
          gl.forEach((i) => {
            const p = f[i],
              q = f[(i + 1) % f.length],
              e = edgeInfo(b, L, i),
              sc2 = (cx - (p[0] + q[0]) / 2) * e.n[0] + (cz - (p[1] + q[1]) / 2) * e.n[1];
            if (sc2 > bs) {
              bs = sc2;
              bi = i;
            }
          });
          S.hov = { b, k: L, t: 'wall', i: bi, g: 1 };
        }
      } else S.hb = S.sel;
    }
  }
}
function hover0(e) {
  ray(e);
  if (S.hov && hc.visible && rc.intersectObject(hc)[0]) {
    cv.style.cursor = S.hov.t == 'wall' ? CUR : 'ns-resize';
    return;
  }
  if (S.hb && handle.visible && rc.intersectObject(handle)[0]) {
    cv.style.cursor = 'ns-resize';
    return;
  }
  cv.style.cursor = '';
  S.hov = null;
  S.hb = null;
  S.hv = null;
  S.hvB = null;
  S.hvR = null;
  const hit = rc.intersectObjects(
    G.nb.children.flatMap((g) => g.children.filter((o) => o.isMesh)),
    false,
  )[0];
  if (!hit) return;
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (!b || b.ex) return;
  if (k == null && !o.userData.roof) return;
  if (S.tool !== 't' && b !== S.sel) {
    S.hvB = b;
    return;
  }
  if (k == null) {
    S.hvR = b;
    if (S.roofSel === b && !selOk() && Math.abs(hit.face.normal.y) < 0.3) {
      const gl = roofGables(b);
      if (gl.length) {
        const L = roofTopK(b),
          f = lf(b, b.levels[L]);
        let bi = gl[0],
          bd = 1e9;
        gl.forEach((i) => {
          const d = proj([hit.point.x, hit.point.z], f[i], f[(i + 1) % f.length]).d;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        S.hov = { b, k: L, t: 'wall', i: bi, g: 1 };
      }
    }
    return;
  }
  S.hv = { b, k, i: -1 };
  S.hvB = null;
  if (nearOuter(hit)) {
    S.hvB = b;
    S.hv = null;
  }
  const nr = hit.face.normal;
  if (nr.y > 0.7) {
    if (k == b.levels.length - 1) S.hb = b;
    else S.hov = { b, k, t: 'top' };
  } else if (Math.abs(nr.y) < 0.3) {
    const f = b.levels[k].fp || b.fp;
    let bi = 0,
      bd = 1e9;
    f.forEach((a, i) => {
      const c2 = f[(i + 1) % f.length];
      if (Math.hypot(c2[0] - a[0], c2[1] - a[1]) < 0.05) return;
      const d = proj([hit.point.x, hit.point.z], a, c2).d;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    S.hov = { b, k, t: 'wall', i: bi };
    if (S.hv) S.hv.i = -1;
  }
}
function startFace(e) {
  const h = S.hov,
    b = h.b,
    wasF = selOk() && selOk().b === b;
  hist();
  S.sel = b;
  S.tab = 'Planen';
  H();
  hpos();
  nav();
  const fi = fInfo(h);
  dr.f = { h, mv: 0 };
  S.selF = wasF ? { b, k: h.k, i: h.t == 'wall' ? h.i : -1 } : null;
  H();
  cv.style.cursor = h.t == 'wall' ? CUR : 'ns-resize';
  if (h.t == 'top') dr.f.h0 = b.levels[h.k].h;
  else {
    dr.f.n = [fi.n.x, fi.n.z];
    dr.f.y = fi.pos.y;
    dr.f.p0 = planePt(e, fi.pos.y);
    dr.f.i = h.i;
    const m = lf(b, b.levels[h.k]).length;
    const js = (e.shiftKey || !wasF ? b.levels.map((l, j) => j) : [h.k]).filter(
      (j) => lf(b, b.levels[j]).length == m,
    );
    dr.f.tg = js.map((j) => ({ l: b.levels[j], o: lf(b, b.levels[j]).map((q) => q.slice()) }));
    dr.f.bfp =
      js.length === b.levels.length &&
      b.levels.every((l) => JSON.stringify(lf(b, l)) === JSON.stringify(b.fp))
        ? b.fp.map((q) => q.slice())
        : null;
    dr.f.cand = wallCand(b, h.k, h.i, [fi.n.x, fi.n.z], js);
    dr.f.cand.push(0);
  }
  rr();
}
function vhit(g, A) {
  const r = 10 * mpp();
  let bi = -1,
    bd = r;
  A.forEach((q, i) => {
    const d = Math.hypot(q[0] - g[0], q[1] - g[1]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi;
}
// Fang: Punkte > Winkel (rechter Winkel/fortgesetzte Kante) > Grundstücksgrenze; Shift = frei
function snap(p, e, i, A) {
  const r = 10 * mpp(),
    n = A.length,
    open = A === S.draft && !S.closed;
  let q = p.slice(),
    t = '',
    ref = null,
    rp = null,
    sn = null;
  if (i == null) {
    if (n) ref = A[n - 1];
    if (n > 1) rp = A[n - 2];
  } else if (open) {
    if (i > 0) {
      ref = A[i - 1];
      if (i > 1) rp = A[i - 2];
    }
  } else if (n >= 3) {
    ref = A[(i - 1 + n) % n];
    rp = A[(i - 2 + n) % n];
  }
  if (S.ortho && !e.shiftKey && ref) {
    const base = rp ? Math.atan2(ref[1] - rp[1], ref[0] - rp[0]) : drRot(),
      dx = p[0] - ref[0],
      dz = p[1] - ref[1],
      L = Math.hypot(dx, dz);
    if (L > 0.01) {
      const a = Math.atan2(dz, dx);
      let best = null,
        bd = (6 * Math.PI) / 180;
      const bases = S.m3 ? [base, drRot()] : rp ? [V.rot, base] : [V.rot];
      for (const b0 of bases)
        for (let k = 0; k < 4; k++) {
          const c = b0 + (k * Math.PI) / 2,
            df = Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)));
          if (df < bd) {
            bd = df;
            best = c;
          }
        }
      if (best != null) {
        q = [ref[0] + Math.cos(best) * L, ref[1] + Math.sin(best) * L];
        t = 'ang';
      }
    }
  }
  if (!e.shiftKey) {
    const C = [];
    P.concat(AL).forEach((a) => a.poly.forEach((c) => C.push(c)));
    S.ex.forEach((b) => b.fp.forEach((c) => C.push(c)));
    (S.ctxPts || []).forEach((c) => C.push(c));
    S.bld.forEach((b) => {
      const f = b.levels ? cfp(b) : b.fp;
      if (f !== A) f.forEach((c) => C.push(c));
    });
    A.forEach((c, j) => {
      if (j !== i) C.push(c);
    });
    let bd = r,
      bp = null;
    C.forEach((c) => {
      if (c === ref) return;
      const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
      if (d < bd) {
        bd = d;
        bp = c;
      }
    });
    if (bp) {
      q = bp.slice();
      t = 'pt';
    }
    if (!t) {
      let be = r * 0.7,
        bq = null;
      P.concat(AL).forEach((a) =>
        a.poly.forEach((c, k) => {
          const o = proj(p, c, a.poly[(k + 1) % a.poly.length]);
          if (o.d < be) {
            be = o.d;
            bq = o.q;
          }
        }),
      );
      if (bq) {
        q = bq;
        t = 'edge';
      }
    }
    if ((!t || t === 'ang') && S.axis !== false) {
      const R = drRot(),
        rx = [Math.cos(R), Math.sin(R)],
        ux = [Math.sin(R), -Math.cos(R)],
        tol = 8 * mpp(),
        K = [];
      A.forEach((c, j) => {
        if (j !== i) K.push(c);
      });
      if (A !== S.draft) S.draft.forEach((c) => K.push(c));
      S.bld.forEach((b) => {
        const f = b.levels ? cfp(b) : b.fp;
        if (f !== A) f.forEach((c) => K.push(c));
      });
      const U = (v) => v[0] * rx[0] + v[1] * rx[1],
        W = (v) => v[0] * ux[0] + v[1] * ux[1];
      let bv = null,
        bh = null,
        dv = tol,
        dh = tol;
      if (t === 'ang' && ref) {
        const d = [q[0] - ref[0], q[1] - ref[1]],
          L0 = Math.hypot(d[0], d[1]) || 1,
          dn = [d[0] / L0, d[1] / L0];
        let best = null,
          bm = tol * 1.5;
        K.forEach((c) => {
          if (c === ref) return;
          const cU = U(c),
            cW = W(c),
            dr = U(dn),
            du = W(dn);
          if (Math.abs(dr) > 0.3) {
            const L = (cU - U(ref)) / dr,
              m = Math.abs(L - L0);
            if (L > 0.1 && m < bm) {
              bm = m;
              best = { L, c };
            }
          }
          if (Math.abs(du) > 0.3) {
            const L = (cW - W(ref)) / du,
              m = Math.abs(L - L0);
            if (L > 0.1 && m < bm) {
              bm = m;
              best = { L, c };
            }
          }
        });
        if (best) {
          q = [ref[0] + dn[0] * best.L, ref[1] + dn[1] * best.L];
          sn = [best.c];
        }
      } else {
        K.forEach((c) => {
          if (c === ref) return;
          const a = Math.abs(U(q) - U(c)),
            b = Math.abs(W(q) - W(c));
          if (a < dv) {
            dv = a;
            bv = c;
          }
          if (b < dh) {
            dh = b;
            bh = c;
          }
        });
        if (bv || bh) {
          const nU = bv ? U(bv) : U(q),
            nW = bh ? W(bh) : W(q);
          q = [nU * rx[0] + nW * ux[0], nU * rx[1] + nW * ux[1]];
          sn = [bv, bh].filter(Boolean);
          t = 'ax';
        }
      }
    }
  }
  let lab = '';
  if (ref) {
    lab = f1(Math.hypot(q[0] - ref[0], q[1] - ref[1]), 2) + ' m';
    if (rp) {
      const ux = rp[0] - ref[0],
        uz = rp[1] - ref[1],
        vx = q[0] - ref[0],
        vz = q[1] - ref[1],
        m = Math.hypot(ux, uz) * Math.hypot(vx, vz);
      if (m > 0.01) {
        const ang = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / m))) * 180) / Math.PI;
        lab += ' · ' + f1(ang, 1) + '°' + (Math.abs(ang - 90) < 0.3 ? ' ⟂' : '');
      }
    }
  }
  if (t == 'pt') {
    lab += ' · Punkt';
    sn = [q];
  }
  if (t == 'edge') lab += ' · Grenze';
  if (sn && t != 'pt') lab += ' · fluchtet';
  return { p: q, t, lab, sn };
}
const refresh = (A) => {
  if (A !== S.draft) {
    mesh(S.sel);
    H();
    hpos();
    rr();
  }
  drawOv();
};
cv.addEventListener('pointerdown', (e) => {
  if (!camLocked()) S.vanim = null;
  dr = { x: e.clientX, y: e.clientY, m: 0, btn: e.button };
  btStart(e);
  const LT = S.tool === 'L';
  if (!LT && S.hb && handle.visible && e.button == 0) {
    ray(e);
    if (rc.intersectObject(handle)[0]) {
      S.sel = S.hb;
      H();
      dr.h = { n: S.sel.levels.length };
      hist();
    }
  }
  if (!LT && !dr.h && e.button == 0 && hc.visible) {
    ray(e);
    if (rc.intersectObject(hc)[0]) {
      if (S.hcP) startPatch(e);
      else startFace(e);
    }
  }
  if (!dr.h && !dr.f) {
    S.hov = null;
    S.hb = null;
    S.hv = null;
    S.hvB = null;
    S.hvR = null;
  }
  if (!LT && !dr.h && !dr.f && e.button == 0) {
    const A = edv();
    if (A) {
      const g = ground(e);
      if (g) {
        const i = vhit(g, A);
        if (i >= 0) {
          dr.v = i;
          S.vi = i;
        }
      }
    }
  }
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (dr) {
    const dx = e.clientX - dr.x,
      dy = e.clientY - dr.y;
    if (dr.bt) {
      btMove(e);
      return;
    }
    if (dr.p) {
      movePatch(e);
      return;
    }
    if (dr.h) {
      const b = S.sel,
        u = ugN(b),
        n = Math.max(u + 1, Math.round(dr.h.n - dy / 18));
      while (b.levels.length < n) b.levels.push(nl(b));
      while (b.levels.length > n) b.levels.pop();
      mesh(b);
      H();
      hpos();
      rr();
      $('hud').textContent = `${n - u} Geschosse · ${f1(b._hAbove, 2)} m`;
      return;
    }
    if (dr.f) {
      const f = dr.f,
        h = f.h,
        b = h.b;
      f.mv = 1;
      dr.m = 1;
      if (h.t == 'top') {
        const nh = Math.min(8, Math.max(2, Math.round((f.h0 - (e.clientY - dr.y) * mpp() * 1.1) * 20) / 20));
        b.levels[h.k].h = nh;
        mesh(b);
        H();
        hpos();
        $('hud').textContent = `${b.levels[h.k].name} · Höhe ${f1(nh, 2)} m`;
      } else {
        const p = planePt(e, f.y);
        if (p && f.p0) {
          const raw = (p[0] - f.p0[0]) * f.n[0] + (p[1] - f.p0[1]) * f.n[1],
            [d, sn] = e.altKey
              ? [Math.round(raw * 20) / 20, 0]
              : pullH(raw, f.cand, Math.min(0.6, Math.max(0.12, 9 * mpp())));
          f.tg.forEach((t) => {
            t.l.fp = offEdge(t.o, f.i, f.n, d);
          });
          if (d && b.kind === 'circ') b.kind = 'free';
          if (f.bfp) {
            b.fp = offEdge(f.bfp, f.i, f.n, d);
          }
          mesh(b);
          H();
          hpos();
          if (f.bfp) drawOv();
          $('hud').textContent =
            `${b.levels[h.k].name} · ${d >= 0 ? '+' : ''}${f1(d, 2)} m${sn ? (sn === 2 ? ' · Fang: Ausgangsposition' : ' · Fang: Wand/Grenze') : ''}${f.tg.length > 1 ? ' (alle Geschosse)' : ''} · Alt = ohne Fang`;
        }
      }
      return;
    }
    if (dr.v != null) {
      const A = ed(),
        g = A && ground(e);
      if (g) {
        if (!dr.vm) {
          dr.vm = 1;
          dr.ct = null;
          if (isCt(A)) {
            hist();
            dr.ct = ctBegin(S.sel);
          }
        }
        dr.m = 1;
        const r = snap(g, e, dr.v, A);
        A[dr.v] = r.p;
        if (dr.ct) ctEnd(dr.ct);
        S.info = r.lab;
        S.snp = r.sn || null;
        refresh(A);
      }
      return;
    }
    if (S.tool === 'x' && dr.btn == 0 && S.geo) {
      if (Math.hypot(dx, dy) > 4) {
        dr.m = 1;
        mqDraw(dr.x, dr.y, e.clientX, e.clientY);
      }
      return;
    }
    if (Math.hypot(dx, dy) > (S.tool === 'L' ? 10 : 4)) dr.m = 1;
    if (dr.m && !camLocked()) {
      const ddx = e.clientX - (dr.lx ?? dr.x),
        ddy = e.clientY - (dr.ly ?? dr.y);
      if (S.m3 && dr.btn == 0) {
        V.az -= ddx * 0.006;
        V.pol = Math.min(
          typeof camxPolMax === 'function' ? camxPolMax() : 1.5,
          Math.max(0.1, V.pol - ddy * 0.006),
        );
      } else {
        const s = mpp(),
          mx = ddx * s,
          mz = ddy * s;
        if (S.m3) {
          V.tx -= mx * Math.cos(V.az) + mz * Math.sin(V.az);
          V.tz -= -mx * Math.sin(V.az) + mz * Math.cos(V.az);
        } else {
          const c = Math.cos(V.rot),
            n = Math.sin(V.rot);
          V.tx -= mx * c - mz * n;
          V.tz -= mx * n + mz * c;
        }
      }
    }
    dr.lx = e.clientX;
    dr.ly = e.clientY;
  } else if (S.fd) fdMove(e);
  else if (S.tool === 'f' && !S.closed) {
    const g = ground(e);
    if (g) {
      const r = snap(g, e, null, S.shape === 'rect' && S.anchor && !S.edge ? [S.anchor] : S.draft);
      S.info = r.lab;
      S.snp = r.sn || null;
      if (S.shape !== 'free') {
        S.lastQ = r.p;
        shapeUpd(r.p);
      } else drawOv(r.p);
    }
  } else if (S.tool === 't' && S.cut) cutMove(e);
  else if (S.m3 && (S.tool === 'v' || S.tool === 'b' || S.tool === 't')) {
    hover(e);
    if (S.tool === 't') cutPrev(e);
  }
});
cv.addEventListener('pointerup', (e) => {
  const d = dr;
  dr = null;
  if (d && d.btn === 2 && !d.m) {
    try {
      cmShow(e);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  }
  if (!d || d.btn) return;
  if (d.bt) {
    if (btEnd(d)) return;
  }
  if (S.tool === 'x' && d.m && !d.v && !d.h && !d.f && !d.p) {
    mqEnd(d, e);
    return;
  }
  if (d.p) {
    if (!d.p.mv) S.hist.pop();
    rr();
    return;
  }
  if (d.f) {
    if (!d.f.mv) S.hist.pop();
    S.snp = null;
    drawOv();
    rr();
    return;
  }
  if (d.v != null) {
    if (!d.m && S.tool === 'f' && !S.closed && S.dm !== 'street' && d.v === 0 && S.draft.length >= 3) close();
    return;
  }
  if (d.m || d.h) return;
  if (S.tool === 'L') {
    lbClick(e);
    return;
  }
  if (S.tool === 't') {
    cutClick(e);
    return;
  }
  if (S.tool === 'f' && S.m3 && (S.fd || fdStart(e))) {
    fdClick(e);
    return;
  }
  const g = ground(e);
  if (!g) return;
  const A = edv();
  if (S.tool === 'f' && !S.closed && S.shape !== 'free') {
    shapeClick(e);
    return;
  }
  if (S.tool === 'f' && !S.closed) {
    const q = snap(g, e, null, S.draft).p,
      l = S.draft.at(-1);
    if (l && Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.3) return;
    if (!S.draft.length) S.refH = gh(q[0], q[1]);
    S.draft.push(q);
    S.info = '';
    if (window.sksPush) sksPush(q);
    drawOv(q);
    return;
  }
  if (S.tool === 'm') {
    if (S.meas.length >= 2) S.meas = [];
    S.meas.push(g);
    drawOv();
    return;
  }
  if (A && (A !== S.draft || S.closed)) {
    let bi = -1,
      bd = 8 * mpp(),
      bq;
    A.forEach((a, k) => {
      const o = proj(g, a, A[(k + 1) % A.length]);
      if (o.d < bd) {
        bd = o.d;
        bi = k;
        bq = o.q;
      }
    });
    if (bi >= 0) {
      let ct = null;
      if (isCt(A)) {
        hist();
        ct = ctBegin(S.sel);
      }
      A.splice(bi + 1, 0, bq);
      if (ct) ctEnd(ct);
      S.vi = bi + 1;
      refresh(A);
      return;
    }
  }
  S.selP = null;
  ray(e);
  const hb = rc
    .intersectObjects(
      G.buildings.children.flatMap((x) => x.children),
      true,
    )
    .find((h) => h.object.userData.b);
  const hx0 = geoPick(),
    ht = treePick(),
    dmin = Math.min(hb ? hb.distance : 1e9, hx0 ? hx0.distance : 1e9),
    tr = ht && ht.distance < dmin,
    hx = tr ? null : hx0,
    ch = hx && (!hb || hx.distance < hb.distance);
  ctxSelect(ch ? hx : null);
  treeSel(tr ? ht.instanceId : null);
  if (tr) {
    S.sel = null;
    S.selF = null;
    S.par = null;
    S.tab = 'Kontext';
  } else if (ch) {
    S.sel = null;
    S.selF = null;
    S.par = null;
    S.tab = 'Kontext';
  } else if (hb) {
    S.selA = null;
    S.multi = [];
    S.multiA = [];
    areaSelDraw();
    const nb = hb.object.userData.b,
      was = S.sel === nb;
    S.selF = null;
    S.sel = nb;
    S.tab = 'Planen';
    const ppi = was ? patchHit(hb) : null;
    if (ppi != null) S.selP = { b: nb, pi: ppi };
    else S.selF = was ? faceOf(hb) : null;
    S.roofSel = was && ppi == null && hb.object.userData.roof ? nb : null;
    if (S.roofSel) {
      try {
        if (roofGables(nb).length)
          $('hud').textContent =
            'Dachgeschoss: weißen Punkt am Giebel ziehen = Giebelwand verschieben (alle Geschosse)';
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    }
  } else {
    S.sel = null;
    S.selF = null;
    S.roofSel = null;
    S.multi = [];
    S.multiA = [];
    const ar = areaPickAt(g);
    S.selA = ar || null;
    areaSelDraw();
    if (ar) {
      S.tab = 'Planen';
      S.par = null;
    } else if (S.tool === 'f') {
      S.par = hasSite() ? P.find((q) => q.site) : null;
    } else {
      const p = P.find((a) => inP(g, a.poly));
      S.par = p || null;
      if (hasSite()) S.par = P.find((q) => q.site);
      parClick(g, e.shiftKey || e.ctrlKey || e.metaKey);
      if (S.parSel.size || (p && p.site)) S.tab = 'Planen';
    }
  }
  S.vi = null;
  H();
  hpos();
  drawOv();
  nav();
  rr();
});
cv.addEventListener('dblclick', (e) => {
  if (S.fd) {
    fdEnter();
    return;
  }
  const A = edv(),
    g = ground(e);
  if (A && g && (A !== S.draft || S.closed)) {
    const i = vhit(g, A);
    if (i >= 0 && A.length > 3) {
      let ct = null;
      if (isCt(A)) {
        hist();
        ct = ctBegin(S.sel);
      }
      A.splice(i, 1);
      if (ct) ctEnd(ct);
      S.vi = null;
      refresh(A);
      return;
    }
  }
  if (S.tool === 'f' && !S.closed && S.draft.length >= (S.dm === 'street' ? 2 : 3)) close();
});
cv.addEventListener(
  'wheel',
  (e) => {
    if (camLocked()) {
      e.preventDefault();
      return;
    }
    S.vanim = null;
    e.preventDefault();
    V.d = Math.min(
      Math.max(1600, GEO.size * 1.8),
      Math.max(typeof camxMin === 'function' ? camxMin() : 40, V.d * (e.deltaY > 0 ? 1.1 : 0.9)),
    );
  },
  { passive: false },
);
function close() {
  if (S.dm === 'street') {
    streetFinish();
    return;
  }
  S.draft = S.draft.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.3);
  if (S.draft.length > 2 && area(S.draft) > 1) {
    S.closed = true;
    S.dk = 'free';
    S.info = '';
    S.snp = null;
    S.tab = 'Planen';
    drawOv();
    nav();
    rr();
  }
}
// Modell
function hist() {
  S.hist.push(
    JSON.stringify(
      S.bld.map((b) => ({
        id: b.id,
        name: b.name,
        use: b.use,
        kind: b.kind,
        fp: b.fp,
        levels: b.levels,
        type: b.type,
        roof: b.roof,
        ref: b.ref,
        patches: b.patches,
        ub: b.ub,
        fd: b.fd,
        l2: b.l2,
        voids: b.voids,
      })),
    ),
  );
  if (S.hist.length > 50) S.hist.shift();
}
function load(arr) {
  S.bld.forEach((b) => b._g && b._g.parent && b._g.parent.remove(b._g));
  S.bld = arr.map((b) => ({ type: 'residential', roof: { type: 'flat' }, ...JSON.parse(JSON.stringify(b)) }));
  S.bld.forEach(mesh);
  S.sel = null;
  S.selF = null;
  H();
  hpos();
  drawOv();
  rr();
}
function undo() {
  const h = S.hist.pop();
  if (h) load(JSON.parse(h));
}
function mk() {
  const n = +$('ng').value || 4,
    hh = +$('gh').value || 3;
  hist();
  const nu = Math.max(0, Math.min(5, +$('nug').value || 0)),
    lv = [
      ...Array.from({ length: nu }, () => ({ ug: true, h: hh })),
      ...Array.from({ length: n }, (_, i) => ({ name: i ? i + '.OG' : 'EG', h: hh })),
    ];
  const b = {
    id: 'building_' + String(S.n).padStart(3, '0'),
    name: ($('nn').value || '').trim() || 'Gebäude ' + S.n,
    use: $('nu').value,
    kind: S.dk || 'free',
    type: 'residential',
    fp: S.draft.map((q) => q.slice()),
    ref: S.refH != null ? S.refH : gh(S.draft[0][0], S.draft[0][1]),
    levels: lv,
    roof: mkRoof(),
  };
  S.n++;
  S.bld.push(b);
  mesh(b);
  S.sel = b;
  cancel();
  tool('v');
  S.sel = b;
  S.selF = null;
  H();
  hpos();
  setMode(1);
  drawOv();
  rr();
}
function cancel() {
  S.refH = null;
  S.draft = [];
  S.closed = false;
  S.vi = null;
  S.info = '';
  S.snp = null;
  S.cut = null;
  S.cutPrev = null;
  S.anchor = null;
  S.edge = null;
  S.prev = null;
  S.dk = null;
  S.hs = '';
  drawCut();
  drawOv();
}
function tool(t) {
  if (t !== 'f' && S.fd) {
    S.fd = null;
    fdDraw();
  }
  S.tool = t;
  S.snp = null;
  S.info = '';
  if (t !== 'f' && !S.closed) cancel();
  if (t === 'm') S.meas = [];
  document.querySelectorAll('.tb').forEach((x) => x.classList.remove('on'));
  const bt = $(
    t === 'f' ? (S.dm === 'street' ? 'mS' : (S.dm === 'area' ? 'a' : 'b') + SHL[S.shape]) : 't' + t,
  );
  bt && bt.classList.add('on');
  drawOv();
  try {
    ueDraw();
  } catch (e) {
    logErr(e, 'tool');
  }
  rr();
}
function setMode(m, k) {
  if (S.vact != null && !S.vgo && !!S.m3 !== !!m) S.vact = null;
  S.m3 = !!m;
  $('b2').classList.toggle('on', !m);
  $('b3').classList.toggle('on', !!m);
  if (!k) V.d = m ? 380 : 420;
}
S.sunC = '#ffffff';
S.sunK = 0.2;
function tgLight() {
  const c = $('lc'),
    o = c.style.display !== 'flex';
  c.style.display = o ? 'flex' : 'none';
  $('bl').classList.toggle('on', o);
  if (o) {
    lyClose();
    vwClose();
  }
}
function lyClose() {
  $('lyp').style.display = 'none';
  $('bg').classList.remove('on');
}
function lyRender() {
  $('lyp').innerHTML =
    layersHtml() +
    usesHtml() +
    `<div class="ly"><input type="checkbox" id="wirck" ${S.wire ? 'checked' : ''} onchange="tgl('wire')"><label>Gelände-Gitter</label></div>`;
}
function tgLayer() {
  const c = $('lyp'),
    o = c.style.display !== 'block';
  if (o) {
    lyRender();
    $('lc').style.display = 'none';
    $('bl').classList.remove('on');
    vwClose();
  }
  c.style.display = o ? 'block' : 'none';
  $('bg').classList.toggle('on', o);
}
function tgInfo() {}
function tgl(k) {
  S[k] = !S[k];
  if (k == 'wire') S.wf.visible = S.wire;
  if (k == 'wire') {
    const e = $('wirck');
    if (e) e.checked = S.wire;
  }
  if (k == 'sun') {
    $('sunck').checked = S.sun;
    sunUp();
    drUi();
  }
}
