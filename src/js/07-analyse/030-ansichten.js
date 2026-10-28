// ---- Ansichten: Beschriftung, Linien, Formen, Symbole (weltverankert) + Fixieren (Schloss) mit Maßstab
const AN = {
  tool: null,
  cur: { fn: 'helv', c: '#5E7F92', w: 0.35, d: 'solid', f: 0, ts: 10, ss: 8, a0: 0, a1: 0 },
  sel: null,
  tmp: null,
  drag: null,
  rev: 0,
  sym: 'north',
  n: 1,
  key: '',
};
const ANSC = [100, 200, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000],
  ANW = [0.1, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4],
  ANC = ['#5E7F92', '#1d1d1b', '#2b7cff', '#2e9e5b', '#f5a623', '#ffffff', '#7a7a7a'],
  ANU = 3.78;
const ANST = [
  ['solid', 'Durchgezogen'],
  ['dash', 'Gestrichelt'],
  ['dashdot', 'Strich-Punkt'],
  ['dot', 'Gepunktet'],
];
const ANSY = [
  ['north', 'Nordpfeil'],
  ['entry', 'Eingang'],
  ['park', 'Parken'],
  ['tree', 'Baum'],
  ['pin', 'Markierung'],
  ['info', 'Info'],
  ['warn', 'Achtung'],
  ['star', 'Stern'],
  ['cross', 'Kreuz'],
  ['check', 'Haken'],
  ['stop', 'Haltestelle'],
];
const anDash = (d) =>
  d === 'dash' ? [2.5, 1.2] : d === 'dashdot' ? [2.5, 1, 0.4, 1] : d === 'dot' ? [0.4, 1] : [];
function anOk() {
  const v = anView();
  return v && v.anns ? v.anns : v ? (v.anns = []) : [];
}
// Symbole als Polygone/Linien/Text (Einheitskreis r), alles in Ausgabeeinheiten
function anSym(name, cx, cy, S, c, w, u, txt) {
  const r = S / 2,
    o = [],
    ring = (rr, fill, st) => {
      const q = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * 2 * Math.PI;
        q.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      o.push({
        t: 'path',
        pts: q,
        closed: true,
        stroke: st === undefined ? c : st,
        w,
        dash: [],
        fill: fill || null,
        fa: 1,
      });
    },
    poly = (pts, fill, cl) =>
      o.push({
        t: 'path',
        pts: pts.map((p) => [cx + p[0] * r, cy + p[1] * r]),
        closed: cl !== false,
        stroke: fill ? null : c,
        w,
        dash: [],
        fill: fill || null,
        fa: 1,
      }),
    tx = (s, k, col, b, dy) =>
      o.push({
        t: 'text',
        x: cx,
        y: cy + (dy || 0) * r + 0.36 * r * k * 2,
        s,
        pt: ((r / u) * k) / LAYC,
        size: r * k,
        c: col || c,
        b: !!b,
        al: 'c',
      });
  if (name === 'north') {
    ring(r);
    poly(
      [
        [0, -0.8],
        [0.38, 0.62],
        [0, 0.3],
        [-0.38, 0.62],
      ],
      c,
    );
    o.push({
      t: 'text',
      x: cx,
      y: cy - r - 0.5 * u,
      s: 'N',
      pt: ((r / u) * 1.1) / LAYC,
      size: r * 1.1,
      c,
      b: true,
      al: 'c',
    });
  } else if (name === 'entry')
    poly(
      [
        [-0.9, -0.4],
        [0.05, -0.4],
        [0.05, -0.85],
        [0.95, 0],
        [0.05, 0.85],
        [0.05, 0.4],
        [-0.9, 0.4],
      ],
      c,
    );
  else if (name === 'park') {
    poly(
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      null,
      true,
    );
    tx('P', 1.3, c, true, 0);
  } else if (name === 'tree') {
    ring(r);
    ring(r * 0.16, c, c);
  } else if (name === 'pin') {
    ring(r * 0.85, c, '#ffffff');
  } else if (name === 'info') {
    ring(r);
    tx('i', 1.4, c, true, 0);
  } else if (name === 'warn') {
    poly(
      [
        [0, -1],
        [1, 0.85],
        [-1, 0.85],
      ],
      null,
      true,
    );
    tx('!', 1.1, c, true, 0.2);
  } else if (name === 'star') {
    const q = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        rr = i % 2 ? 0.42 : 1;
      q.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
    poly(q, c);
  } else if (name === 'cross') {
    o.push(
      {
        t: 'path',
        pts: [
          [cx - 0.7 * r, cy - 0.7 * r],
          [cx + 0.7 * r, cy + 0.7 * r],
        ],
        closed: false,
        stroke: c,
        w: w * 1.6,
        dash: [],
      },
      {
        t: 'path',
        pts: [
          [cx - 0.7 * r, cy + 0.7 * r],
          [cx + 0.7 * r, cy - 0.7 * r],
        ],
        closed: false,
        stroke: c,
        w: w * 1.6,
        dash: [],
      },
    );
  } else if (name === 'check')
    o.push({
      t: 'path',
      pts: [
        [cx - 0.7 * r, cy],
        [cx - 0.2 * r, cy + 0.55 * r],
        [cx + 0.8 * r, cy - 0.6 * r],
      ],
      closed: false,
      stroke: c,
      w: w * 1.8,
      dash: [],
    });
  else if (name === 'stop') {
    ring(r, c, c);
    tx('H', 1.3, '#ffffff', true, 0);
  } else if (name === 'num') {
    ring(r, c, c);
    tx(String(txt == null ? '' : txt), String(txt).length > 1 ? 1 : 1.3, '#ffffff', true, 0);
  }
  return o;
}
// Anmerkungen -> Zeichenprimitive. P: Weltpunkt -> [x,y] (Ausgabeeinheit), u: Einheiten pro mm
function anPrims(list, P, u) {
  const out = [];
  (list || []).forEach((a) => {
    const c = a.c || '#5E7F92',
      w = (a.w || 0.35) * u,
      dash = anDash(a.d).map((x) => x * u),
      pp = (a.p || []).map(P);
    if (!pp.length || pp.some((q) => !q)) return;
    const path = (pts, closed, fill) =>
        out.push({ t: 'path', pts, closed, stroke: c, w, dash, fill: fill ? c : null, fa: 0.25 }),
      head = (tip, from) => {
        const dx = tip[0] - from[0],
          dy = tip[1] - from[1],
          L = Math.hypot(dx, dy) || 1,
          hl = Math.max(2.8, (a.w || 0.35) * 8) * u,
          hw = hl * 0.34,
          ux = dx / L,
          uy = dy / L,
          bx = tip[0] - ux * hl,
          by = tip[1] - uy * hl;
        out.push({
          t: 'path',
          pts: [tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]],
          closed: true,
          stroke: c,
          w: w * 0.4,
          dash: [],
          fill: c,
          fa: 1,
        });
      };
    if (a.k === 'line') {
      if (pp.length < 2) return;
      path(pp, false, false);
      if (a.a1) head(pp[pp.length - 1], pp[pp.length - 2]);
      if (a.a0) head(pp[0], pp[1]);
    } else if (a.k === 'rect' && pp.length > 1) {
      const [x0, y0] = pp[0],
        [x1, y1] = pp[1];
      path(
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
        true,
        a.f,
      );
    } else if (a.k === 'ell' && pp.length > 1) {
      const cx = (pp[0][0] + pp[1][0]) / 2,
        cy = (pp[0][1] + pp[1][1]) / 2,
        rx = Math.abs(pp[1][0] - pp[0][0]) / 2,
        ry = Math.abs(pp[1][1] - pp[0][1]) / 2,
        q = [];
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * 2 * Math.PI;
        q.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
      path(q, true, a.f);
    } else if (a.k === 'poly' && pp.length > 2) path(pp, true, a.f);
    else if (a.k === 'text') {
      const pt = a.s || 10,
        sz = pt * LAYC * u,
        L = String(a.t == null ? '' : a.t)
          .split('\n')
          .map(layTxt),
        [x, y] = pp[0];
      let mw = 0;
      L.forEach((s) => {
        mw = Math.max(mw, layW(s, pt, !!a.b, a.fn) * u);
      });
      if (a.bg) {
        const pd = 0.8 * u;
        out.push({
          t: 'path',
          pts: [
            [x - pd, y - pd],
            [x + mw + pd, y - pd],
            [x + mw + pd, y + L.length * 1.2 * sz + pd],
            [x - pd, y + L.length * 1.2 * sz + pd],
          ],
          closed: true,
          stroke: null,
          w: 0,
          dash: [],
          fill: '#ffffff',
          fa: 1,
        });
      }
      L.forEach((s, i) =>
        out.push({
          t: 'text',
          x,
          y: y + (i * 1.2 + 0.9) * sz,
          s,
          pt,
          size: sz,
          c,
          b: !!a.b,
          al: 'l',
          f: a.fn,
        }),
      );
    } else if (a.k === 'sym')
      anSym(a.sy || 'pin', pp[0][0], pp[0][1], (a.s || 8) * u, c, w, u).forEach((p) => out.push(p));
    else if (a.k === 'num')
      anSym('num', pp[0][0], pp[0][1], (a.s || 8) * u, c, w, u, a.t).forEach((p) => out.push(p));
  });
  return out;
}
function anSvg(prims) {
  return prims
    .map((p) => {
      if (p.t === 'text')
        return `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-size="${p.size.toFixed(2)}" font-family="${lfCss(p.f)}" style="font-kerning:none" font-weight="${p.b ? 700 : 400}" fill="${p.c}" text-anchor="${p.al === 'c' ? 'middle' : p.al === 'r' ? 'end' : 'start'}">${esc(p.s)}</text>`;
      const pts = p.pts.map((q) => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
      return `<${p.closed ? 'polygon' : 'polyline'} points="${pts}" fill="${p.fill || 'none'}"${p.fill && p.fa < 1 ? ` fill-opacity="${p.fa}"` : ''} stroke="${p.stroke || 'none'}" stroke-width="${p.w}"${p.dash && p.dash.length ? ` stroke-dasharray="${p.dash.map((x) => x.toFixed(2)).join(' ')}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join('');
}
// ---- Overlay im Hauptfenster
function anP() {
  const cm = act(),
    w = mid.clientWidth,
    h = mid.clientHeight;
  cm.updateMatrixWorld();
  const q = new T.Vector3();
  return (p) => {
    q.set(p[0], p[1], p[2]);
    q.project(cm);
    if (q.z > 1 || q.z < -1) return null;
    return [((q.x + 1) / 2) * w, ((1 - q.y) / 2) * h];
  };
}
function anDraw() {
  const sv = $('anSvg');
  if (!sv) return;
  if (AN.barV !== S.vact) {
    AN.barV = S.vact;
    if (AN.tool && S.vact == null) AN.tool = null;
    anBarUpd();
  }
  const v = anView();
  if (!v) {
    if (sv.style.display !== 'none') {
      sv.style.display = 'none';
      sv.innerHTML = '';
    }
    return;
  }
  const w = mid.clientWidth,
    h = mid.clientHeight,
    key = [V.tx, V.tz, V.d, V.az, V.pol, V.rot, S.m3, w, h, AN.rev, AN.sel, AN.tool, S.vact].join('|');
  if (key === AN.key && sv.style.display === 'block') return;
  AN.key = key;
  sv.style.display = 'block';
  sv.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const P = anP(),
    list = (v.anns || []).slice();
  if (AN.tmp) list.push({ ...AN.tmp, p: AN.tmp.p.concat(AN.tmp.cur ? [AN.tmp.cur] : []) });
  let s = anSvg(anPrims(list, P, ANU));
  const a = AN.sel && (v.anns || []).find((x) => x.id === AN.sel);
  if (a && AN.tool === 'sel')
    a.p.forEach((p) => {
      const q = P(p);
      if (q)
        s += `<rect x="${q[0] - 4}" y="${q[1] - 4}" width="8" height="8" fill="#fff" stroke="#2b7cff" stroke-width="1.5"/>`;
    });
  sv.innerHTML = s;
}
anHook = anDraw;
// ---- Treffertest (Pixel)
const anSeg = (x, y, a, b) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy,
    t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
function anHit(x, y) {
  const v = anView();
  if (!v) return null;
  const P = anP(),
    L = v.anns || [];
  for (let i = L.length - 1; i >= 0; i--) {
    const a = L[i],
      pr = anPrims([a], P, ANU),
      pp = a.p.map(P);
    if (pp.some((q) => !q)) continue;
    if (a.k === 'sym' || a.k === 'num') {
      if (Math.hypot(x - pp[0][0], y - pp[0][1]) <= ((a.s || 8) * ANU) / 2 + 4) return a;
      continue;
    }
    for (const p of pr) {
      if (p.t === 'text') {
        const wd = layW(p.s, p.pt, p.b, p.f) * ANU;
        if (x >= p.x - 3 && x <= p.x + wd + 3 && y >= p.y - p.size - 3 && y <= p.y + p.size * 0.4 + 3)
          return a;
      } else {
        const tol = Math.max(6, p.w / 2 + 4),
          n = p.pts.length;
        for (let j = 0; j < (p.closed ? n : n - 1); j++)
          if (anSeg(x, y, p.pts[j], p.pts[(j + 1) % n]) < tol) return a;
        if (p.closed && p.fill && a.f && inP([x, y], p.pts)) return a;
      }
    }
  }
  return null;
}
function anHandle(x, y) {
  const v = anView(),
    a = v && AN.sel && (v.anns || []).find((q) => q.id === AN.sel);
  if (!a) return -1;
  const P = anP();
  for (let i = 0; i < a.p.length; i++) {
    const q = P(a.p[i]);
    if (q && Math.hypot(x - q[0], y - q[1]) < 8) return i;
  }
  return -1;
}
