// ---- Darstellung
const SKG = new T.Group();
SKG.renderOrder = 7;
sc.add(SKG);
function skQuads(ents, col, op, line) {
  const pos = [],
    lp = [],
    tp = [];
  ents.forEach((e) => {
    if (!skValid(e)) return;
    const b = e.b,
      l = b.levels[e.j],
      f = lf(b, l),
      z0 = skZ(b, e.j),
      z1 = z0 + l.h;
    if (e.top) {
      const pts = f.map((p) => new T.Vector2(p[0], p[1])),
        tr = T.ShapeUtils.triangulateShape(pts, []);
      tr.forEach((t) => t.forEach((q) => tp.push(f[q][0], z1 + 0.02, f[q][1])));
      if (line)
        f.forEach((a, i) => {
          const c = f[(i + 1) % f.length];
          lp.push(a[0], z1 + 0.02, a[1], c[0], z1 + 0.02, c[1]);
        });
      return;
    }
    const a = f[e.i],
      c = f[(e.i + 1) % f.length];
    pos.push(a[0], z0, a[1], c[0], z0, c[1], c[0], z1, c[1], a[0], z0, a[1], c[0], z1, c[1], a[0], z1, a[1]);
    if (line)
      lp.push(
        a[0],
        z0,
        a[1],
        c[0],
        z0,
        c[1],
        c[0],
        z0,
        c[1],
        c[0],
        z1,
        c[1],
        c[0],
        z1,
        c[1],
        a[0],
        z1,
        a[1],
        a[0],
        z1,
        a[1],
        a[0],
        z0,
        a[1],
      );
  });
  const o = [],
    P = pos.concat(tp);
  if (P.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    const me = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: op,
        side: T.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    me.renderOrder = 7;
    me.raycast = () => {};
    o.push(me);
  }
  if (line && lp.length) {
    const g2 = new T.BufferGeometry();
    g2.setAttribute('position', new T.BufferAttribute(new Float32Array(lp), 3));
    const ln = new T.LineSegments(
      g2,
      new T.LineBasicMaterial({ color: 0x1f5fa8, depthTest: false, transparent: true }),
    );
    ln.renderOrder = 8;
    ln.raycast = () => {};
    o.push(ln);
  }
  return o;
}
function skSig(b) {
  let s = b._y + '|' + b._h;
  b.levels.forEach((l) => {
    const f = lf(b, l);
    let h = 0;
    f.forEach((p) => {
      h += p[0] * 1.3 + p[1] * 0.7;
    });
    s += ',' + l.h + ':' + f.length + ':' + h.toFixed(3);
  });
  return s;
}
function skDraw() {
  const on = skAct();
  SKG.visible = on;
  if (!on) {
    SK.key = '';
    if (typeof SKLN !== 'undefined') SKLN.visible = false;
    return;
  }
  SK.sel = SK.sel.filter(skValid);
  if (SK.hv && !skValid(SK.hv)) SK.hv = null;
  const bs = new Set(SK.sel.map((e) => e.b));
  if (SK.hv) bs.add(SK.hv.b);
  if (SK.ghost) SK.ghost.forEach((e) => bs.add(e.b));
  const key = [
    SK.ver,
    SK.sel.length,
    SK.hv ? skKey(SK.hv) : '',
    ...[...bs].map((b) => b.id + ':' + skSig(b)),
  ].join('#');
  if (key === SK.key) return;
  SK.key = key;
  while (SKG.children.length) {
    const c = SKG.children.pop();
    c.geometry && c.geometry.dispose();
    c.material && c.material.dispose();
  }
  if (SK.hv && !skHas(SK.hv))
    skQuads(SK.tool === 's' ? [SK.hv] : skGroupHv(SK.hv), 0x6aa6d6, 0.4, false).forEach((x) => SKG.add(x));
  if (SK.sel.length) skQuads(SK.sel, 0x2f7fd0, 0.55, true).forEach((x) => SKG.add(x));
}
function skGroupHv(en) {
  return SK.tool === 'p' && !SK.sel.length && !en.top ? skGroup(en) : [en];
}
{
  const _p = placeHc;
  placeHc = function () {
    _p.apply(this, arguments);
    try {
      skDraw();
    } catch (x) {
      console.warn('sk', x);
    }
  };
}
// ---- alte Hover-Logik (Kugeln) im Modellier-Modus abschalten
{
  const _h = hover;
  hover = function (e) {
    if (!skAct()) {
      SK.hv = null;
      return _h.apply(this, arguments);
    }
    if (dr && (dr.m || dr.f || dr.h || dr.p)) return;
    S.hov = null;
    S.hb = null;
    S.hv = null;
    S.hvB = null;
    S.hvR = null;
    cv.style.cursor = '';
    if (SK.win || SK.op) {
      return;
    }
    try {
      SK.hv = skHit(e);
      if (SK.tool === 'l') {
        SK.lh = skSplitPos(e, e.altKey);
        skLnDraw();
      } else if (SKLN.visible) {
        SK.lh = null;
        skLnDraw();
      }
    } catch (_) {
      SK.hv = null;
    }
  };
}
// ---- Maus
function skProj(x, y, z) {
  const v = new T.Vector3(x, y, z).project(act()),
    r = cv.getBoundingClientRect();
  return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height, v.z];
}
function skWinSel(x0, y0, x1, y1, e) {
  const L = Math.min(x0, x1),
    R = Math.max(x0, x1),
    Tp = Math.min(y0, y1),
    B = Math.max(y0, y1),
    touch = x1 < x0,
    cam = act().position,
    out = [];
  skAll().forEach((en) => {
    const b = en.b,
      l = b.levels[en.j],
      f = lf(b, l),
      z0 = skZ(b, en.j),
      z1 = z0 + l.h;
    let pts;
    if (en.top) pts = f.map((p) => skProj(p[0], z1, p[1]));
    else {
      const a = f[en.i],
        c = f[(en.i + 1) % f.length],
        n = skN(b, en.j, en.i),
        mx = (a[0] + c[0]) / 2,
        mz = (a[1] + c[1]) / 2;
      if ((cam.x - mx) * n[0] + (cam.z - mz) * n[1] <= 0) return;
      pts = [skProj(a[0], z0, a[1]), skProj(c[0], z0, c[1]), skProj(c[0], z1, c[1]), skProj(a[0], z1, a[1])];
    }
    if (pts.some((p) => p[2] > 1)) return;
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]),
      bx0 = Math.min(...xs),
      bx1 = Math.max(...xs),
      by0 = Math.min(...ys),
      by1 = Math.max(...ys);
    const inside = bx0 >= L && bx1 <= R && by0 >= Tp && by1 <= B,
      hit = !(bx1 < L || bx0 > R || by1 < Tp || by0 > B);
    if (touch ? hit : inside) out.push(en);
  });
  return out;
}
function skWinDiv() {
  let d = document.getElementById('skwin');
  if (!d) {
    d = document.createElement('div');
    d.id = 'skwin';
    d.style.cssText =
      'position:fixed;pointer-events:none;z-index:9;border:1.5px solid #2f7fd0;background:#2f7fd01f;display:none';
    document.body.appendChild(d);
  }
  return d;
}
function skWinDraw(x0, y0, x1, y1) {
  const d = skWinDiv();
  d.style.display = 'block';
  d.style.left = Math.min(x0, x1) + 'px';
  d.style.top = Math.min(y0, y1) + 'px';
  d.style.width = Math.abs(x1 - x0) + 'px';
  d.style.height = Math.abs(y1 - y0) + 'px';
  d.style.borderStyle = x1 < x0 ? 'dashed' : 'solid';
}
function skClickN(e) {
  const t = Date.now(),
    c = SK.clk,
    n = t - c.t < 450 && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 7 ? c.n + 1 : 1;
  SK.clk = { t, x: e.clientX, y: e.clientY, n };
  return n;
}
addEventListener(
  'pointerdown',
  (e) => {
    try {
      if (!skAct() || e.target !== cv || e.button !== 0) return;
      if (SK.tool === 's' && (e.shiftKey || e.ctrlKey)) {
        SK.win = { x: e.clientX, y: e.clientY, mv: 0, e0: e };
        e.stopImmediatePropagation();
        e.preventDefault();
        try {
          cv.setPointerCapture(e.pointerId);
        } catch (e) {
          logErr(e, 'init>anonym');
        }
        return;
      }
      if (SK.opDown && SK.opDown(e)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        try {
          cv.setPointerCapture(e.pointerId);
        } catch (e) {
          logErr(e, 'init>anonym');
        }
      }
    } catch (x) {
      console.warn('sk down', x);
    }
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (!skAct()) return;
      if (SK.win) {
        const w = SK.win;
        if (Math.hypot(e.clientX - w.x, e.clientY - w.y) > 4) w.mv = 1;
        if (w.mv) skWinDraw(w.x, w.y, e.clientX, e.clientY);
        e.stopImmediatePropagation();
        return;
      }
      if (SK.opMove && SK.opMove(e)) {
        e.stopImmediatePropagation();
      }
    } catch (x) {
      console.warn('sk move', x);
    }
  },
  true,
);
addEventListener(
  'pointerup',
  (e) => {
    try {
      if (SK.win) {
        const w = SK.win;
        SK.win = null;
        skWinDiv().style.display = 'none';
        try {
          cv.releasePointerCapture(e.pointerId);
        } catch (e) {
          logErr(e, 'init>anonym');
        }
        dr = null;
        e.stopImmediatePropagation();
        if (!w.mv) {
          skSelClick(e);
        } else {
          const l = skWinSel(w.x, w.y, e.clientX, e.clientY, e);
          skSet(l, skMode(e) === 'rem' ? 'rem' : 'add');
          $('hud').textContent =
            'Fenster ' + (e.clientX < w.x ? '(berührt)' : '(enthalten)') + ' · ' + skInfo();
        }
        return;
      }
      if (!skAct() || e.target !== cv || e.button !== 0) return;
      if (SK.opUp && SK.opUp(e)) {
        e.stopImmediatePropagation();
        dr = null;
        try {
          cv.releasePointerCapture(e.pointerId);
        } catch (e) {
          logErr(e, 'init>anonym');
        }
        return;
      }
      if (
        SK.tool === 's' &&
        dr &&
        !dr.m &&
        dr.btn === 0 &&
        !dr.f &&
        !dr.h &&
        !dr.p &&
        dr.v == null &&
        !dr.bt
      ) {
        if (skHit(e) || SK.sel.length) {
          skSelClick(e);
          dr = null;
          e.stopImmediatePropagation();
        }
      }
    } catch (x) {
      console.warn('sk up', x);
    }
  },
  true,
);
// ---- Tasten
addEventListener(
  'keydown',
  (e) => {
    try {
      if (!skAct()) return;
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === 'Escape') {
        if (SK.opEsc && SK.opEsc()) {
          e.stopImmediatePropagation();
          return;
        }
        if (SK.sel.length) {
          SK.sel = [];
          SK.ver++;
          skSync();
          e.stopImmediatePropagation();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopImmediatePropagation();
        skSet(skAll(), 'rep');
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        skTool('s');
        return;
      }
      if (SK.keys && SK.keys(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    } catch (x) {
      console.warn('sk key', x);
    }
  },
  true,
);
