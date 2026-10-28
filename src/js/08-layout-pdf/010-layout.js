// ---- Layout-Modul: Seitenlayout (A4–A0, 16:9) mit Ansichten, Kennzahlen, Legende, Texten -> PDF
const LAYF = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
  'Folie 16:9': [190.5, 338.67],
};
const LAYK = [
  ['bgf', 'BGF', 'm²', 0],
  ['bgfoi', 'BGFoi', 'm²', 0],
  ['bgfui', 'BGFui', 'm²', 0],
  ['bri', 'BRI', 'm³', 0],
  ['brioi', 'BRIoi', 'm³', 0],
  ['briui', 'BRIui', 'm³', 0],
  ['fas', 'Fassadenfläche', 'm²', 0],
  ['dach', 'Dachfläche', 'm²', 0],
  ['terr', 'Terrassenfläche', 'm²', 0],
  ['gf', 'Grundfläche (EG)', 'm²', 0],
  ['n', 'Anzahl Gebäude', '', 0],
  ['vg', 'Vollgeschosse (max.)', '', 0],
  ['hmax', 'Gebäudehöhe (max.)', 'm', 2],
  ['grz', 'GRZ', '', 2],
  ['gfz', 'GFZ', '', 2],
];
const LAY = { font: 'helv', open: false, fmt: 'A3', ori: 'q', els: [], sel: null, zoom: 1, n: 0, drag: null };
const LAYC = 25.4 / 72,
  LAYLH = 1.3,
  LAYBO = 0.996;
function laySave() {
  try {
    localStorage.setItem(
      'lot_layout',
      JSON.stringify({
        font: LAY.font,
        fmt: LAY.fmt,
        ori: LAY.ori,
        n: LAY.n,
        els: LAY.els.map((e) => {
          const c = { ...e };
          delete c._img;
          delete c._ik;
          return c;
        }),
      }),
    );
  } catch (e) {
    logErr(e, 'laySave');
  }
}
try {
  const o = JSON.parse(localStorage.getItem('lot_layout') || 'null');
  if (o && Array.isArray(o.els)) {
    LAY.fmt = LAYF[o.fmt] ? o.fmt : 'A3';
    LAY.font = LFONT[o.font] ? o.font : 'helv';
    LAY.ori = o.ori === 'h' ? 'h' : 'q';
    LAY.els = o.els;
    LAY.n = o.n || o.els.length;
  }
} catch (e) {
  logErr(e, 'init');
}
const layPage = () => {
  const b = LAYF[LAY.fmt] || LAYF.A3;
  return LAY.ori === 'q' ? [b[1], b[0]] : [b[0], b[1]];
};
const layEl = (id) => LAY.els.find((e) => e.id === id);
// Text -> WinAnsi-tauglich (PDF-Standardschrift Helvetica)
const PDFM = {
  '€': 128,
  '‚': 130,
  '„': 132,
  '…': 133,
  '‘': 145,
  '’': 146,
  '“': 147,
  '”': 148,
  '•': 149,
  '–': 150,
  '—': 151,
};
function layTxt(s) {
  return String(s == null ? '' : s)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[−‐‑]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[^\u0000-ÿ]/g, (c) => (PDFM[c] != null ? c : '?'));
}
const layCx = document.createElement('canvas').getContext('2d');
function layW(s, pt, b, f) {
  if (lfOk(f)) return lfW(f, b, s) * pt * LAYC;
  layCx.font = (b ? 'bold ' : '') + '100px Helvetica,Arial,"Liberation Sans",sans-serif';
  return (layCx.measureText(s).width / 100) * pt * LAYC;
}
function layWrap(text, w, pt, b, f) {
  const out = [],
    put = (x) => {
      let p = '';
      for (const ch of x) {
        if (p && layW(p + ch, pt, b, f) > w) {
          out.push(p);
          p = ch;
        } else p += ch;
      }
      return p;
    };
  String(text)
    .split('\n')
    .forEach((par) => {
      let cur = '';
      par.split(' ').forEach((x) => {
        const t = cur ? cur + ' ' + x : x;
        if (layW(t, pt, b, f) <= w) cur = t;
        else {
          if (cur) out.push(cur);
          cur = layW(x, pt, b, f) <= w ? x : put(x);
        }
      });
      out.push(cur);
    });
  return out;
}
function layData(bl0) {
  const bl = bl0 || S.bld.filter((b) => !b.ex),
    t = { bgfoi: 0, bgfui: 0, brioi: 0, briui: 0, fas: 0, dach: 0, terr: 0 };
  let hmax = 0,
    vg = 0,
    gf = 0,
    grz = 0,
    gfz = 0,
    kk = false;
  bl.forEach((b) => {
    const m = bM(b);
    for (const k in t) t[k] += m[k];
    hmax = Math.max(hmax, b._hTot || b._h || 0);
    vg = Math.max(vg, vgN(b));
    if (b.levels[0]) gf += larea(b, b.levels[0]) + ((pxMet(b).lv || [])[0] || 0);
    try {
      const k = kw(b);
      if (k) {
        grz += k.grz;
        gfz += k.gfz;
        kk = true;
      }
    } catch (e) {
      logErr(e, 'layData>anonym');
    }
  });
  const d = { bgf: t.bgfoi + t.bgfui, bri: t.brioi + t.briui, n: bl.length, vg, hmax, gf, ...t };
  if (kk) {
    d.grz = grz;
    d.gfz = gfz;
  }
  return d;
}
function layLegend() {
  return USES.filter((u) => S.bld.some((b) => useAgg(b)[u])).map((u) => ({
    n: u,
    c: S.uses[u],
    g: S.bld.reduce((t, b) => t + (useAgg(b)[u] ? useAgg(b)[u].a : 0), 0),
  }));
}
// Zeichenelemente eines Layout-Elements in mm: t = Text, r = Rechtecke, h = Höhe
const layFo = (e) => e.font || LAY.font || 'helv';
function layItems(e, noAn) {
  const R = layItems0(e, noAn),
    fo = layFo(e);
  R.t.forEach((q) => (q.f = fo));
  return R;
}
function layItems0(e, noAn) {
  const t = [],
    r = [],
    pt = +e.size || 10,
    mm = pt * LAYC;
  if (e.type === 'head' || e.type === 'text') {
    const b = e.type === 'head' || !!e.bold,
      L = layWrap(layTxt(e.text), e.w, pt, b, layFo(e)),
      ax = e.align === 'c' ? e.x + e.w / 2 : e.align === 'r' ? e.x + e.w : e.x;
    L.forEach((s, i) =>
      t.push({ x: ax, y: e.y + i * LAYLH * mm + LAYBO * mm, s, pt, b, al: e.align || 'l' }),
    );
    return { t, r, h: Math.max(1, L.length) * LAYLH * mm };
  }
  if (e.type === 'info') {
    const D = layData(),
      rows = (e.keys || []).map((k) => LAYK.find((x) => x[0] === k)).filter((x) => x && D[x[0]] != null),
      bl = S.bld.filter((b) => !b.ex),
      pb = !!e.perB && bl.length > 1,
      DB = bl.map((b) => ({ b, d: layData([b]), L: bLv(b) })),
      sp = Math.max(6, pt - 1),
      sm = sp * LAYC,
      FLK = {
        bgfoi: ['a', false, 'm²'],
        bgfui: ['a', true, 'm²'],
        brioi: ['v', false, 'm³'],
        briui: ['v', true, 'm³'],
      };
    let y = e.y;
    if (e.title) {
      const tp = pt + 1,
        tm = tp * LAYC;
      t.push({ x: e.x, y: y + LAYBO * tm, s: layTxt(e.title), pt: tp, b: true, al: 'l' });
      y += LAYLH * tm;
      r.push({ x: e.x, y: y + 0.2, w: e.w, h: 0.25, f: '#1d1d1b' });
      y += 1.4;
    }
    const sub = (ind, s, v, u) => {
      t.push({ x: e.x + ind, y: y + LAYBO * sm, s: layTxt(s), pt: sp, b: false, al: 'l' });
      t.push({
        x: e.x + e.w,
        y: y + LAYBO * sm,
        s: layTxt(f1(v, u[1]) + (u[0] ? ' ' + u[0] : '')),
        pt: sp,
        b: false,
        al: 'r',
      });
      y += LAYLH * sm;
    };
    if (e.fln !== false)
      P.filter((q) => q.site && q.fl && q.fl.length).forEach((q) => {
        t.push({ x: e.x, y: y + LAYBO * mm, s: layTxt(q.name || q.id), pt, b: false, al: 'l' });
        t.push({
          x: e.x + e.w,
          y: y + LAYBO * mm,
          s: layTxt(f1(area(q.poly)) + ' m²'),
          pt,
          b: true,
          al: 'r',
        });
        y += LAYLH * mm;
        if (q.fl.length > 1)
          q.fl.forEach((id) => {
            const a = AL.find((z) => z.id === id);
            sub(3, 'Flurstück ' + flNr(id), a ? a.af || a.area : 0, ['m²', 0]);
          });
        else {
          t.push({
            x: e.x + 3,
            y: y + LAYBO * sm,
            s: layTxt('Flurstück ' + flNr(q.fl[0])),
            pt: sp,
            b: false,
            al: 'l',
          });
          y += LAYLH * sm;
        }
        y += 1;
      });
    rows.forEach((x) => {
      const v = D[x[0]],
        k = x[0],
        fl = e.flr && FLK[k];
      t.push({ x: e.x, y: y + LAYBO * mm, s: layTxt(x[1]), pt, b: false, al: 'l' });
      t.push({
        x: e.x + e.w,
        y: y + LAYBO * mm,
        s: layTxt(f1(v, x[3]) + (x[2] ? ' ' + x[2] : '')),
        pt,
        b: true,
        al: 'r',
      });
      y += LAYLH * mm;
      if (pb && !['n', 'grz', 'gfz'].includes(k))
        DB.forEach((o) => {
          const vv = o.d[k];
          if (vv == null) return;
          sub(3, o.b.name || o.b.id, vv, [x[2], x[3]]);
          if (fl)
            o.L.filter((q) => q.ug === FLK[k][1])
              .reverse()
              .forEach((q) => sub(6, q.n, q[FLK[k][0]], [FLK[k][2], 0]));
        });
      else if (fl) {
        const mp = new Map();
        DB.forEach((o) =>
          o.L.filter((q) => q.ug === FLK[k][1])
            .reverse()
            .forEach((q) => mp.set(q.n, (mp.get(q.n) || 0) + q[FLK[k][0]])),
        );
        mp.forEach((val, n) => sub(3, n, val, [FLK[k][2], 0]));
      }
    });
    if (!rows.length)
      (t.push({ x: e.x, y: y + LAYBO * mm, s: '(keine Werte gewählt)', pt, b: false, al: 'l' }),
        (y += LAYLH * mm));
    return { t, r, h: y - e.y };
  }
  if (e.type === 'legend') {
    const L = layLegend(),
      bl = S.bld.filter((b) => !b.ex),
      sp = Math.max(6, pt - 1),
      sm = sp * LAYC;
    let y = e.y;
    if (e.title) {
      const tp = pt + 1,
        tm = tp * LAYC;
      t.push({ x: e.x, y: y + LAYBO * tm, s: layTxt(e.title), pt: tp, b: true, al: 'l' });
      y += LAYLH * tm;
      r.push({ x: e.x, y: y + 0.2, w: e.w, h: 0.25, f: '#1d1d1b' });
      y += 1.4;
    }
    const sw = mm * 0.95,
      val = (g, v) =>
        [e.bgf ? f1(g) + ' m² BGF' : '', e.bri ? f1(v) + ' m³ BRI' : ''].filter(Boolean).join(' · ');
    if (e.perB && bl.length) {
      bl.forEach((b) => {
        const A = useAgg(b),
          us = USES.filter((u) => A[u]);
        if (!us.length) return;
        const lh = LAYLH * mm,
          a = us.reduce((q, u) => q + A[u].a, 0),
          v = us.reduce((q, u) => q + A[u].v, 0);
        t.push({ x: e.x, y: y + LAYBO * mm, s: layTxt(b.name || b.id), pt: pt + 1, b: true, al: 'l' });
        const s0 = val(a, v);
        if (s0) t.push({ x: e.x + e.w, y: y + LAYBO * mm, s: layTxt(s0), pt, b: true, al: 'r' });
        y += lh;
        us.forEach((u) => {
          r.push({
            x: e.x + sw * 0.8,
            y: y + (LAYLH * sm - sw * 0.8) / 2,
            w: sw * 1.3,
            h: sw * 0.8,
            f: S.uses[u],
            s: '#555555',
          });
          t.push({ x: e.x + sw * 2.4 + 2, y: y + LAYBO * sm, s: layTxt(u), pt: sp, b: false, al: 'l' });
          const s1 = val(A[u].a, A[u].v);
          if (s1) t.push({ x: e.x + e.w, y: y + LAYBO * sm, s: layTxt(s1), pt: sp, b: false, al: 'r' });
          y += LAYLH * sm;
        });
        y += 0.8;
      });
    } else
      L.forEach((u) => {
        const lh = LAYLH * mm,
          bu = bl.filter((b) => useAgg(b)[u.n]),
          vv = bu.reduce((s, b) => s + useAgg(b)[u.n].v, 0);
        r.push({ x: e.x, y: y + (lh - sw) / 2, w: sw * 1.6, h: sw, f: u.c, s: '#555555' });
        t.push({ x: e.x + sw * 1.6 + 2, y: y + LAYBO * mm, s: layTxt(u.n), pt, b: false, al: 'l' });
        const s0 = val(u.g, vv);
        if (s0) t.push({ x: e.x + e.w, y: y + LAYBO * mm, s: layTxt(s0), pt, b: true, al: 'r' });
        y += lh;
      });
    if (!L.length)
      (t.push({ x: e.x, y: y + LAYBO * mm, s: '(keine Gebäude)', pt, b: false, al: 'l' }), (y += LAYLH * mm));
    return { t, r, h: y - e.y };
  }
  if (e.type === 'pic') {
    const cm = e.cap ? (+e.size || 9) * LAYC * LAYLH : 0,
      ih = e.w * lpAr(e);
    if (e.border) r.push({ x: e.x, y: e.y, w: e.w, h: ih, s: '#1d1d1b', nf: 1 });
    if (e.cap)
      t.push({
        x: e.x,
        y: e.y + ih + LAYBO * (+e.size || 9) * LAYC + 0.6,
        s: layTxt(e.name || ''),
        pt: +e.size || 9,
        b: false,
        al: 'l',
      });
    return { t, r, h: ih + cm, ih };
  }
  if (e.type === 'view') {
    const cm = e.cap || e.capSc ? (+e.size || 9) * LAYC * LAYLH : 0,
      ih = e.h - cm;
    let an = [];
    if (!noAn && e.v && (e.v.locked || (e.v.anns && e.v.anns.length))) {
      const ev = layV(e, ih);
      try {
        an = anPrims(ev.anns, layProj(ev, e.w, ih), 1);
      } catch (err) {
        console.warn(err);
      }
    }
    if (e.border) r.push({ x: e.x, y: e.y, w: e.w, h: e.h - cm, s: '#1d1d1b', nf: 1 });
    if (e.cap)
      t.push({
        x: e.x,
        y: e.y + e.h - cm + LAYBO * (+e.size || 9) * LAYC + 0.6,
        s: layTxt(e.name || ''),
        pt: +e.size || 9,
        b: false,
        al: 'l',
      });
    if (e.capSc) {
      const sv = layV(e, ih);
      if (sv.locked && !sv.m3 && sv.sc)
        t.push({
          x: e.x + e.w,
          y: e.y + e.h - cm + LAYBO * (+e.size || 9) * LAYC + 0.6,
          s: 'M 1:' + sv.sc,
          pt: +e.size || 9,
          b: false,
          al: 'r',
        });
    }
    return { t, r, h: e.h, ih, an };
  }
  return { t, r, h: e.h || 10 };
}
