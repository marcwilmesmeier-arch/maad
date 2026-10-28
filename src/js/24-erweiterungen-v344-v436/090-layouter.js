/* v436 Layouter: Flächen (zeichnen, Farbe, Deckkraft, Ecken, Kontur), gemeinsame Konturen (Farbe/Stärke) inkl. Bilder, Hintergrund für Textelemente, Metriken-Board */
const LAYGA = [];
const layKd = () => {
  const o = LAY.els.find((x) => x.bc);
  return o ? { c: o.bc, w: +o.bw || 0.25 } : { c: '#1d1d1b', w: 0.25 };
};
function layRgba(c, a) {
  if (a == null || a >= 1 || !/^#[0-9a-f]{6}$/i.test(c)) return c;
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function layRectDiv(q, e, k, d) {
  const x = document.createElement('div'),
    bw = q.s ? Math.max(1, (q.sw || 0.25) * k) : 0;
  x.style.cssText = `position:absolute;left:${(q.x - e.x) * k}px;top:${(q.y - e.y) * k}px;width:${q.w * k}px;height:${q.h * k}px;box-sizing:border-box;${q.nf ? '' : 'background:' + layRgba(q.f, q.fa) + ';'}${q.s ? 'border:' + bw + 'px solid ' + q.s + ';' : ''}${q.rx ? 'border-radius:' + q.rx * k + 'px;' : ''}pointer-events:none`;
  d.appendChild(x);
}
function layRectPdf(o, mm, H, f) {
  const sw = o.s ? o.sw || 0.25 : 0,
    x = o.x + sw / 2,
    y = o.y + sw / 2,
    w = o.w - sw,
    h = o.h - sw;
  if (w <= 0 || h <= 0) return '';
  const r = Math.max(0, Math.min(o.rx || 0, w / 2, h / 2)),
    X = (v) => f(v * mm),
    Y = (v) => f(H - v * mm),
    fill = !o.nf,
    st = !!o.s;
  if (!fill && !st) return '';
  let s = 'q ';
  if (fill && o.fa != null && o.fa < 1) {
    let i = LAYGA.indexOf(+o.fa);
    if (i < 0) i = LAYGA.push(+o.fa) - 1;
    s += `/GA${i} gs `;
  }
  if (fill) s += layHex(o.f) + ' rg ';
  if (st) s += layHex(o.s) + ' RG ' + f(sw * mm) + ' w ';
  if (r <= 0) s += `${X(x)} ${Y(y + h)} ${f(w * mm)} ${f(h * mm)} re `;
  else {
    const c = r * 0.5523;
    s += `${X(x + r)} ${Y(y)} m ${X(x + w - r)} ${Y(y)} l ${X(x + w - r + c)} ${Y(y)} ${X(x + w)} ${Y(y + r - c)} ${X(x + w)} ${Y(y + r)} c ${X(x + w)} ${Y(y + h - r)} l ${X(x + w)} ${Y(y + h - r + c)} ${X(x + w - r + c)} ${Y(y + h)} ${X(x + w - r)} ${Y(y + h)} c ${X(x + r)} ${Y(y + h)} l ${X(x + r - c)} ${Y(y + h)} ${X(x)} ${Y(y + h - r + c)} ${X(x)} ${Y(y + h - r)} c ${X(x)} ${Y(y + r)} l ${X(x)} ${Y(y + r - c)} ${X(x + r - c)} ${Y(y)} ${X(x + r)} ${Y(y)} c h `;
  }
  return s + (fill && st ? 'B' : fill ? 'f' : 'S') + ' Q\n';
}
// ---- Metriken-Board (Aufbau wie die Gebäudemetriken im Hauptfenster)
function layBoard(e) {
  const t = [],
    r = [],
    pt = +e.size || 9,
    sp = Math.max(6, pt - 1),
    bg = +e.big || pt * 2,
    W = e.w,
    MU = '#6b7580',
    BL = S.bld.filter((b) => !b.ex),
    perB = e.perB !== false && BL.length > 1;
  let y = e.y;
  const A = (v) => f1(v, 1) + ' m²',
    V = (v) => f1(v, 0) + ' m³',
    M = (p) => p * LAYC;
  const ln = (L, R, p, o = {}) => {
    const m = M(p);
    if (L != null)
      t.push({ x: e.x + (o.i || 0), y: y + LAYBO * m, s: layTxt(L), pt: p, b: !!o.bl, al: 'l', c: o.cl });
    if (R != null && R !== '')
      t.push({ x: e.x + W, y: y + LAYBO * m, s: layTxt(R), pt: p, b: !!o.bv, al: 'r', c: o.cr });
    y += LAYLH * m;
  };
  const sub = (l, v) => ln(l, v, sp, { i: 3, cl: MU, cr: MU });
  const rule = () => {
    r.push({ x: e.x, y: y + 0.3, w: W, h: 0.2, f: '#d5d9dc' });
    y += 1.4;
  };
  const bar = (sg) => {
    const tot = sg.reduce((s, q) => s + q.v, 0);
    if (!(tot > 0)) return;
    let x = e.x;
    sg.filter((q) => q.v > 0).forEach((q) => {
      const w = (W * q.v) / tot;
      r.push({ x, y, w: Math.max(0.2, w - 0.3), h: 1.4, f: q.c, rx: 0.4 });
      x += w;
    });
    y += 2.6;
  };
  const block = (nm, D, ag, b) => {
    t.push({ x: e.x, y: y + LAYBO * M(pt + 1), s: layTxt(nm), pt: pt + 1, b: true, al: 'l' });
    if (D.gf)
      t.push({
        x: e.x + W,
        y: y + LAYBO * M(sp),
        s: layTxt('GR ' + A(D.gf)),
        pt: sp,
        b: false,
        al: 'r',
        c: MU,
      });
    y += LAYLH * M(pt + 1);
    const bgf = D.bgfoi + D.bgfui;
    t.push({ x: e.x, y: y + LAYBO * M(bg), s: layTxt(A(bgf)), pt: bg, b: true, al: 'l' });
    t.push({ x: e.x + W, y: y + LAYBO * M(sp), s: 'BGF', pt: sp, b: false, al: 'r', c: MU });
    y += LAYLH * M(bg);
    bar(USES.filter((u) => ag[u]).map((u) => ({ c: S.uses[u], v: ag[u].a })));
    sub('BGFoi', A(D.bgfoi));
    if (D.bgfui) sub('BGFui', A(D.bgfui));
    y += 0.8;
    rule();
    ln('BRI', V(D.bri), pt, { bl: 1, bv: 1 });
    bar([
      { c: '#f28e2b', v: D.brioi },
      { c: '#bfa58a', v: D.briui },
    ]);
    sub('BRIoi', V(D.brioi));
    if (D.briui) sub('BRIui', V(D.briui));
    y += 0.8;
    rule();
    ln('Flächen', '', pt, { bl: 1 });
    bar([
      { c: '#8fa9c4', v: D.fas },
      { c: '#c97b63', v: D.dach },
      { c: '#9bbf8a', v: D.terr },
    ]);
    sub('Fassade', A(D.fas));
    sub('Dach', A(D.dach));
    sub('Terrassen', A(D.terr));
    y += 0.8;
    rule();
    ln('Gebäudehöhe', f1(D.hmax, 2) + ' m', pt, { bv: 1 });
    if (D.vg) ln('Vollgeschosse', String(D.vg), pt, { bv: 1 });
  };
  const grB = () => {
    if (e.gr === false || !BL.length) return;
    try {
      const q = kw(BL[0]);
      if (q) {
        y += 1.5;
        rule();
        ln('Grundstück', '', pt, { bl: 1 });
        sub('Grundstücksfläche', A(q.A));
        sub('GRZ', f1(q.grz, 2) + (S.lim && S.lim.grz ? '  (zul. ' + f1(S.lim.grz, 2) + ')' : ''));
        sub('GFZ', f1(q.gfz, 2) + (S.lim && S.lim.gfz ? '  (zul. ' + f1(S.lim.gfz, 2) + ')' : ''));
      }
    } catch (e) {
      logErr(e, 'grB');
    }
  };
  const aggUse = (bs) => {
    const o = {};
    bs.forEach((b) => {
      const a = useAgg(b);
      for (const u in a) {
        o[u] = o[u] || { a: 0, v: 0 };
        o[u].a += a[u].a;
        o[u].v += a[u].v;
      }
    });
    return o;
  };
  if (e.title) {
    t.push({ x: e.x, y: y + LAYBO * M(pt + 2), s: layTxt(e.title), pt: pt + 2, b: true, al: 'l' });
    y += LAYLH * M(pt + 2);
    r.push({ x: e.x, y: y + 0.2, w: W, h: 0.25, f: '#1d1d1b' });
    y += 1.4;
  }
  if (!BL.length) ln('(keine Gebäude)', '', pt, { cl: MU });
  else if (perB) {
    BL.forEach((b, i) => {
      if (i) {
        y += 1.5;
        rule();
        y += 1.5;
      }
      block(b.name || b.id, layData([b]), useAgg(b), b);
    });
    y += 1.5;
    rule();
    const D = layData();
    t.push({ x: e.x, y: y + LAYBO * M(pt + 1), s: 'Gesamt', pt: pt + 1, b: true, al: 'l' });
    y += LAYLH * M(pt + 1);
    ln('BGF', A(D.bgf), pt, { bv: 1 });
    sub('BGFoi', A(D.bgfoi));
    if (D.bgfui) sub('BGFui', A(D.bgfui));
    ln('BRI', V(D.bri), pt, { bv: 1 });
    ln('Grundfläche (GR)', A(D.gf), pt, { bv: 1 });
    grB();
  } else {
    block(BL.length > 1 ? 'Alle Gebäude' : BL[0].name || BL[0].id, layData(), aggUse(BL), BL[0]);
    grB();
  }
  return { t, r, h: y - e.y };
}
{
  const _li = layItems;
  layItems = function (e, noAn) {
    let R;
    if (e.type === 'box') R = { t: [], r: [], h: e.h || 20 };
    else if (e.type === 'board') {
      R = layBoard(e);
      const fo = layFo(e);
      R.t.forEach((q) => (q.f = fo));
    } else R = _li.apply(this, arguments);
    const sc = e.bc || '#1d1d1b',
      sw = +e.bw || 0.25;
    if (e.type === 'pic' || e.type === 'view')
      R.r.forEach((q) => {
        if (q.nf && q.s === '#1d1d1b') {
          q.s = sc;
          q.sw = sw;
        }
      });
    if (e.type === 'box')
      R.r.push({
        x: e.x,
        y: e.y,
        w: e.w,
        h: e.h,
        f: e.fc || '#E9EDEF',
        nf: e.fc === 'none',
        fa: e.fa == null ? 1 : +e.fa,
        s: +e.bw > 0 ? sc : null,
        sw: +e.bw || 0,
        rx: +e.rx || 0,
      });
    else if (e.type !== 'pic' && e.type !== 'view' && (e.bg || e.bo)) {
      const pd = +e.pad || 0;
      R.r.unshift({
        x: e.x - pd,
        y: e.y - pd,
        w: e.w + 2 * pd,
        h: R.h + 2 * pd,
        f: e.bg || '#ffffff',
        nf: !e.bg,
        fa: e.fa == null ? 1 : +e.fa,
        s: e.bo ? sc : null,
        sw: sw,
        rx: +e.rx || 0,
      });
    }
    if (e.tc)
      R.t.forEach((q) => {
        if (!q.c) q.c = e.tc;
      });
    return R;
  };
}
{
  const _a = layAdd;
  layAdd = function (type, v, name) {
    if (type !== 'box' && type !== 'board') return _a.apply(this, arguments);
    const [pw, ph] = layPage(),
      id = 'e' + ++LAY.n,
      kd = layKd(),
      b = { id, type, x: 15 + (LAY.els.length % 6) * 4, y: 15 + (LAY.els.length % 6) * 4 };
    if (type === 'box') Object.assign(b, { w: 60, h: 30, fc: '#E9EDEF', fa: 1, rx: 0, bw: kd.w, bc: kd.c });
    else
      Object.assign(b, {
        w: 80,
        size: 9,
        big: 20,
        perB: true,
        gr: true,
        title: '',
        bg: '#ffffff',
        fa: 1,
        bo: true,
        bw: kd.w,
        bc: kd.c,
        rx: 2,
        pad: 3,
        x: 20,
        y: 20,
      });
    if (type === 'box') LAY.els.unshift(b);
    else LAY.els.push(b);
    LAY.sel = id;
    laySave();
    layRender();
    layProp();
  };
}
// ---- Fläche aufziehen
function layDrawStart() {
  LAY.draw = true;
  LAY.dr = null;
  const sh = $('laySheet');
  sh.style.cursor = 'crosshair';
  LAY.sel = null;
  layRender();
  layProp();
  const el = $('layProp');
  el.innerHTML =
    '<h4>Fläche zeichnen</h4><div style="color:var(--mu)">Auf dem Blatt mit gedrückter Maustaste ein Rechteck aufziehen. Esc bricht ab. Farbe, Ecken und Kontur stellst du danach rechts ein.</div>';
}
function layDrawEnd() {
  LAY.draw = false;
  LAY.dr = null;
  const sh = $('laySheet');
  sh.style.cursor = '';
  const d = $('layDrw');
  if (d) d.remove();
  layProp();
}
function layDrawPt(ev) {
  const r = $('laySheet').getBoundingClientRect(),
    k = layK(),
    [pw, ph] = layPage();
  return [
    Math.max(0, Math.min(pw, Math.round(((ev.clientX - r.left) / k) * 2) / 2)),
    Math.max(0, Math.min(ph, Math.round(((ev.clientY - r.top) / k) * 2) / 2)),
  ];
}
function layDrawDown(ev) {
  if (!LAY.draw) return false;
  const p = layDrawPt(ev),
    sh = $('laySheet');
  LAY.dr = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
  let d = $('layDrw');
  if (!d) {
    d = document.createElement('div');
    d.id = 'layDrw';
    d.style.cssText =
      'position:absolute;border:1.5px dashed #5E7F92;background:#5E7F9222;pointer-events:none;z-index:5';
    sh.appendChild(d);
  }
  try {
    sh.setPointerCapture(ev.pointerId);
  } catch (e) {
    logErr(e, 'layDrawDown');
  }
  layDrawMove(ev);
  return true;
}
function layDrawMove(ev) {
  if (!LAY.draw) return false;
  const g = LAY.dr;
  if (!g) return true;
  const p = layDrawPt(ev),
    k = layK(),
    d = $('layDrw');
  g.x1 = p[0];
  g.y1 = p[1];
  if (d) {
    d.style.left = Math.min(g.x0, g.x1) * k + 'px';
    d.style.top = Math.min(g.y0, g.y1) * k + 'px';
    d.style.width = Math.abs(g.x1 - g.x0) * k + 'px';
    d.style.height = Math.abs(g.y1 - g.y0) * k + 'px';
  }
  return true;
}
function layDrawUp(ev) {
  if (!LAY.draw) return false;
  const g = LAY.dr;
  if (!g) return true;
  layDrawMove(ev);
  const x = Math.min(g.x0, g.x1),
    y = Math.min(g.y0, g.y1);
  let w = Math.abs(g.x1 - g.x0),
    h = Math.abs(g.y1 - g.y0);
  if (w < 2 && h < 2) {
    w = 40;
    h = 25;
  }
  layDrawEnd();
  layAdd('box');
  const e = layEl(LAY.sel);
  if (e) {
    e.x = x;
    e.y = y;
    e.w = Math.max(1, w);
    e.h = Math.max(1, h);
    laySave();
    layRender();
    layProp();
  }
  return true;
}
