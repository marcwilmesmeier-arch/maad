// ---- Gebäudedaten
function xlVal(b) {
  const m = bM(b),
    u = ugN(b),
    f0 = lf(b, b.levels[0]),
    px = pxMet(b);
  let k = null;
  try {
    k = kw(b);
  } catch (e) {
    logErr(e, 'xlVal');
  }
  const rf = b.roof && b.roof.type && b.roof.type !== 'flat';
  const o = {
    name: b.name || b.id,
    use: lUse(b, b.levels[0]),
    lev: b.levels.length,
    ug: u,
    vg: vgN(b),
    h: (b._h || 0) + (b._roofH || 0),
    gf: area(f0) + ((px.lv || [])[0] || 0),
    gr: grOf(b),
    umf: xlPer(f0),
    bgfoi: m.bgfoi,
    bgfui: m.bgfui,
    bgf: m.bgfoi + m.bgfui,
    brioi: m.brioi,
    briui: m.briui,
    bri: m.brioi + m.briui,
    fas: m.fas,
    dach: m.dach,
    terr: m.terr,
    roof: rf ? (RT.find((x) => x[0] === b.roof.type) || [0, b.roof.type])[1] : 'Flachdach',
    ang: rf ? +b.roof.angle || 0 : 0,
    grz: k ? k.grz : null,
    gfz: k ? k.gfz : null,
  };
  // ── Erweiterung aus 22-lod200-waende: LOD 200 – dieselben Zahlen wie die Metriken in LOD 200 (zoBldHtml):
  // BRI mit Sonderfall S, Fassade abgewickelt (Loggien, Attika, Schürze), NGF, NRI, KF, BGF (R)/(S)
  if (l2on())
    try {
      const sz = l2SZahlen(b),
        S2 = sz && sz.a > 0,
        n = l2Ngf(b),
        nr = l2Nri(b);
      o.bgfs = S2 ? sz.a : 0;
      o.bgfr = o.bgf - (S2 ? sz.lo : 0);
      if (S2) {
        o.brioi = m.brioi - sz.loV + sz.bri;
        o.bri = o.brioi + o.briui;
      }
      o.ngfoi = n.o + n.so;
      o.ngfui = n.u + n.su;
      o.ngf = o.ngfoi + o.ngfui;
      o.ngfr = n.o + n.u;
      o.ngfs = n.so + n.su;
      o.brir = m.brioi - (S2 ? sz.loV : 0) + m.briui;
      o.bris = S2 ? sz.bri : 0;
      o.nrioi = nr.o + (S2 ? sz.nri : 0);
      o.nriui = nr.u;
      o.nrir = nr.o + nr.u;
      o.nris = S2 ? sz.nri : 0;
      o.nri = o.nrioi + o.nriui;
      o.kf = n.wo + n.wu;
      o.fas = l2FassadeWert(b, m.fas);
      o.fasn = o.fas - l2FassadenOeffnungsFlaeche(b);
      o._lv = n.lv; // je Geschoss: ngf, w (KF)
    } catch (e) {
      logErr(e, 'xlVal');
    }
  o.fasb = o.bgf > 0 ? o.fas / o.bgf : 0;
  return o;
}
/**
 * Öffnungen (LOD 200) auf der Seite a→c eines Geschosses (z0…z1): Lage entlang der Seite (t0, t1 ab a) und Höhe über
 * der Geschossunterkante (y0, y1), auf das Geschoss zugeschnitten (Pfosten-Riegel über mehrere Geschosse). Zugeordnete
 * Flächen werden von x.rest abgezogen. [{ t0, t1, y0, y1, a }]
 */
function xlOeSeite(OE, a, c, len, z0, z1) {
  const u = [(c[0] - a[0]) / len, (c[1] - a[1]) / len],
    ab = (p) => Math.abs((p[0] - a[0]) * -u[1] + (p[1] - a[1]) * u[0]),
    t = (p) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1],
    R = [];
  OE.forEach((x) => {
    if (ab(x.p0) > 0.4 || ab(x.p1) > 0.4) return;
    const t0 = Math.max(0, Math.min(t(x.p0), t(x.p1))),
      t1 = Math.min(len, Math.max(t(x.p0), t(x.p1))),
      y0 = Math.max(x.y0, z0),
      y1 = Math.min(x.y1, z1);
    if (t1 - t0 < 0.01 || y1 - y0 < 0.01) return;
    const ar = (t1 - t0) * (y1 - y0);
    x.rest -= ar;
    R.push({ t0, t1, y0: y0 - z0, y1: y1 - z0, a: ar });
  });
  return R;
}
function xlWalls(b) {
  const L = bLv(b),
    px = pxMet(b),
    o = [],
    l2 = l2on(),
    // LOD 200: Fenster, Türen, Pfosten-Riegel (wie „Fassade ohne Öffnungen“), je Seite zugeordnet; Rest gesammelt
    OE = l2
      ? l2FassadenOeffnungen(b).map((x) => ({
          ...x,
          rest: Math.hypot(x.p1[0] - x.p0[0], x.p1[1] - x.p0[1]) * (x.y1 - x.y0),
        }))
      : [];
  let zz = b._y || 0;
  b.levels.forEach((l, i) => {
    const f = lf(b, l),
      z0 = zz,
      z1 = zz + l.h;
    zz = z1;
    let sa = 0;
    f.forEach((p, j) => {
      const q = f[(j + 1) % f.length];
      sa += p[0] * q[1] - q[0] * p[1];
    });
    const sg = sa > 0 ? 1 : -1;
    let n = 0;
    f.forEach((a, j) => {
      const c = f[(j + 1) % f.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.05) return;
      // ── Erweiterung aus 22-lod200-waende/160-loggia-fassade.js: LOD 200 – Attika, Terrassenbrüstung und Schürze
      // dieser Seite (wie die Fassadenfläche in den Metriken)
      const zus =
        l2 && !l.ug
          ? l2DreieckFlaeche(
              l2FassadenZusatz(
                b,
                f,
                i > 0 ? lf(b, b.levels[i - 1]) : null,
                i + 1 < b.levels.length ? lf(b, b.levels[i + 1]) : null,
                z0,
                z1,
                i === b.levels.length - 1,
                j,
              ),
            )
          : 0;
      o.push({
        lv: L[i].n,
        lvi: i,
        ug: !!l.ug,
        nr: 'S' + ++n,
        dir: xlDir((sg * dz) / len, (-sg * dx) / len),
        len,
        h: l.h,
        zus: l2 ? zus : null,
        area: len * l.h + zus,
        oe: l2 && !l.ug ? xlOeSeite(OE, a, c, len, z0, z1) : null,
      });
    });
  });
  if (b._rp && b._rp.aW > 0.01)
    o.push({
      lv: 'Dach',
      lvi: 99,
      ug: false,
      nr: 'Giebel',
      dir: 'versch.',
      len: null,
      h: null,
      area: b._rp.aW,
      x: 1,
    });
  // LOD 200: Loggien – Rück- und Seitenwände statt der Öffnung in der Fassadenebene (l2FassadeWert)
  if (l2) {
    const z = l2LoggiaZahlen(b);
    if (z.oeff)
      o.push({
        lv: 'Loggien',
        lvi: 98,
        ug: false,
        nr: 'Rück-/Seitenwände − Öffnung',
        dir: 'versch.',
        len: null,
        h: null,
        area: z.rueck + z.seite - z.oeff,
        x: 1,
      });
  }
  // nicht zugeordnete Öffnungen (z. B. in Loggia-Rückwänden): Fläche für die Nettotabelle
  o.oeRest = OE.reduce((s, x) => s + Math.max(0, x.rest), 0);
  if (px.fas > 0.01)
    o.push({
      lv: 'Flächenpatches',
      lvi: 99,
      ug: false,
      nr: 'Patch',
      dir: 'versch.',
      len: null,
      h: null,
      area: px.fas,
      x: 1,
    });
  return o;
}
function xlRoof(b, m) {
  const rp = b._rp,
    rf = b.roof && b.roof.type && b.roof.type !== 'flat',
    o = [];
  if (!rf || !rp || !rp.pr || !rp.pr.length) {
    if (m.dach > 0.001)
      o.push({ nr: 'D1', typ: 'Flachdach', ang: 0, dir: '–', azi: null, area: m.dach, proj: m.dach });
    return o;
  }
  const g = {},
    p = rp.pr,
    tn = (RT.find((x) => x[0] === b.roof.type) || [0, b.roof.type])[1];
  for (let i = 0; i + 8 < p.length; i += 9) {
    const ux = p[i + 3] - p[i],
      uy = p[i + 4] - p[i + 1],
      uz = p[i + 5] - p[i + 2],
      vx = p[i + 6] - p[i],
      vy = p[i + 7] - p[i + 1],
      vz = p[i + 8] - p[i + 2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const ar = 0.5 * Math.hypot(nx, ny, nz);
    if (ar < 1e-9) continue;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const nl = Math.hypot(nx, ny, nz),
      sl = (Math.acos(Math.min(1, ny / nl)) * 180) / Math.PI,
      flat = sl < 0.5,
      dr = flat ? '–' : xlDir(nx, nz),
      key = Math.round(sl) + '|' + dr,
      q = g[key] || (g[key] = { ang: Math.round(sl), dir: dr, area: 0, proj: 0, sx: 0, sz: 0, t: [] });
    q.t.push([p[i], p[i + 2], p[i + 3], p[i + 5], p[i + 6], p[i + 8]]);
    q.area += ar;
    q.proj += (ar * ny) / nl;
    q.sx += (nx / nl) * ar;
    q.sz += (nz / nl) * ar;
  }
  Object.values(g)
    .sort((a, c) => XLD.indexOf(a.dir) - XLD.indexOf(c.dir) || a.ang - c.ang)
    .forEach((q, i) =>
      o.push({
        nr: 'D' + (i + 1),
        typ: tn,
        ang: q.ang,
        dir: q.dir,
        azi: q.dir === '–' ? null : Math.round(((Math.atan2(q.sx, -q.sz) * 180) / Math.PI + 360) % 360),
        area: q.area,
        proj: q.proj,
        t: q.t,
      }),
    );
  const sm = o.reduce((s, q) => s + q.area, 0),
    pj = o.reduce((s, q) => s + q.proj, 0);
  if (Math.abs(m.dach - sm) > 0.01)
    o.push({
      nr: 'D' + (o.length + 1),
      typ: 'Änderung durch Flächenpatches/Terrassen',
      ang: null,
      dir: '–',
      azi: null,
      area: m.dach - sm,
      proj: m.dach - sm,
    });
  return o;
}
function xlTerr(b) {
  const t = terrOf(b),
    u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const px = pxMet(b),
    o = [];
  t.lv.forEach((L) => {
    let z = b._y,
      nm = '',
      ia = -1;
    b.levels.forEach((l, i) => {
      z += l.h;
      if (Math.abs(z - L.y) < 1e-6) {
        nm = l.name || lname(b, i);
        ia = i;
      }
    });
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    L.q.forEach(([x, y]) => {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + L.st);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + L.st);
    });
    o.push({
      lv: nm,
      z: L.y - b._y - ugH,
      bx: x1 - x0,
      by: y1 - y0,
      area: L.area,
      pa: ia >= 0 ? lf(b, b.levels[ia]) : null,
      pb: ia >= 0 ? lf(b, b.levels[ia + 1]) : null,
      q: L.q,
      st: L.st,
    });
  });
  if (px.terr > 0.01)
    o.push({ lv: 'Flächenpatches (Dachterrasse/Rücksprung)', z: null, bx: null, by: null, area: px.terr });
  // Loggien und Balkone (Fassadengruppen): je Geschoss und Art zusammengefasst
  const lb = new Map();
  lbFlaechen(b).forEach((x) => {
    const k = x.art + '|' + x.j;
    const r = lb.get(k) || { art: x.art, j: x.j, n: 0, area: 0 };
    r.n++;
    r.area += x.area;
    lb.set(k, r);
  });
  lb.forEach((r) => {
    let z = 0;
    for (let i = u; i < r.j; i++) z += b.levels[i].h;
    o.push({
      lv:
        (r.n > 1 ? { Loggia: 'Loggien', Balkon: 'Balkone' }[r.art] + ' ' + r.n + '×' : r.art) +
        ' – ' +
        (b.levels[r.j].name || lname(b, r.j)),
      z,
      bx: null,
      by: null,
      area: r.area,
    });
  });
  return o;
}
function xlSel() {
  return S.bld.filter((b) => !b.ex && !XL.off.includes(b.id));
}
// ---- bemaßte Abwicklung als PNG
const XLFC = ['#d6e4f0', '#cfe8d8', '#f3e3c3', '#f0d2c2', '#f6d6d6', '#e0d2ee', '#d4d4ef', '#d2e8ec'];
function xlPng(b, W0, opt) {
  const netto = !!(opt && opt.netto);
  const fz = (v, d) => v.toFixed(d).replace('.', ','),
    lv = [];
  W0.filter((w) => !w.x).forEach((w) => {
    let q = lv.find((x) => x.i === w.lvi);
    if (!q) lv.push((q = { i: w.lvi, n: w.lv, ug: w.ug, h: w.h, e: [] }));
    q.e.push(w);
  });
  if (!lv.length) return null;
  lv.sort((a, c) => c.i - a.i);
  const maxP = Math.max(1, ...lv.map((x) => x.e.reduce((s, e) => s + e.len, 0))),
    totH = lv.reduce((s, x) => s + x.h, 0),
    mL = 150,
    mR = 150,
    mT = 46,
    gap = 44,
    mB = 70;
  let sc = Math.min(1000 / maxP, 420 / totH, 40);
  sc = Math.max(sc, 2.5);
  const W = Math.ceil(mL + maxP * sc + mR),
    H = Math.ceil(mT + totH * sc + gap * lv.length + mB),
    K = 2,
    cv = document.createElement('canvas');
  cv.width = W * K;
  cv.height = H * K;
  const g = cv.getContext('2d');
  g.scale(K, K);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.fillStyle = '#1d1d1b';
  g.font = 'bold 15px Arial';
  g.textAlign = 'left';
  g.fillText(
    netto
      ? 'Fassade ' + (b.name || b.id) + ' – abzüglich Öffnungen (Fenster, Türen, Pfosten-Riegel), Maße in m'
      : 'Abwicklung ' + (b.name || b.id) + ' – Fassaden, brutto, Maße in m',
    12,
    20,
  );
  let y = mT;
  lv.forEach((L) => {
    y += gap;
    const hh = L.h * sc;
    let x = mL;
    L.e.forEach((e) => {
      const w = e.len * sc;
      g.fillStyle = L.ug ? '#ddd' : XLFC[Math.max(0, XLD.indexOf(e.dir))];
      g.fillRect(x, y, w, hh);
      g.strokeStyle = '#333';
      g.lineWidth = 1;
      g.strokeRect(x, y, w, hh);
      // LOD 200: Attika / Terrassenbrüstung / Schürze dieser Seite als Streifen über der Fläche
      if (e.zus > 0.01) {
        g.fillStyle = '#b9a77a';
        g.fillRect(x, y - 4, w, 4);
      }
      // Fassade abzüglich Öffnungen: Aussparungen, nummeriert
      if (netto && e.oe)
        e.oe.forEach((oo, k) => {
          const ox = x + oo.t0 * sc,
            ow = (oo.t1 - oo.t0) * sc,
            oy = y + hh - oo.y1 * sc,
            oh = (oo.y1 - oo.y0) * sc;
          g.fillStyle = '#ffffff';
          g.fillRect(ox, oy, ow, oh);
          g.strokeStyle = '#333';
          g.strokeRect(ox, oy, ow, oh);
          if (ow > 16 && oh > 10) {
            g.fillStyle = '#333';
            g.font = '8px Arial';
            g.textAlign = 'center';
            g.fillText(String(k + 1), ox + ow / 2, oy + oh / 2);
          }
        });
      if (L.ug) {
        g.strokeStyle = '#aaa';
        g.beginPath();
        for (let q = -hh; q < w; q += 7) {
          g.moveTo(x + Math.max(0, q), y + Math.max(0, -q));
          g.lineTo(x + Math.min(w, q + hh), y + Math.min(hh, w - q));
        }
        g.stroke();
      }
      g.fillStyle = '#444';
      g.textAlign = 'center';
      if (w >= 20 && hh >= 14) {
        g.font = 'bold 11px Arial';
        g.fillText(e.dir, x + w / 2, y + hh / 2 - (w > 56 && hh > 34 ? 7 : 0));
        if (w > 56 && hh > 34) {
          g.font = '10px Arial';
          g.fillText(fz(e.area, 1) + ' m²', x + w / 2, y + hh / 2 + 7);
        }
      }
      g.strokeStyle = '#666';
      g.beginPath();
      g.moveTo(x, y - 9);
      g.lineTo(x + w, y - 9);
      g.moveTo(x, y - 13);
      g.lineTo(x, y - 5);
      g.moveTo(x + w, y - 13);
      g.lineTo(x + w, y - 5);
      g.stroke();
      g.font = '11px Arial';
      g.fillStyle = '#111';
      if (w >= 40) {
        g.fillText(fz(e.len, 2), x + w / 2, y - 18);
      } else {
        g.save();
        g.translate(x + w / 2, y - 14);
        g.rotate(-Math.PI / 2);
        g.textAlign = 'left';
        g.fillText(fz(e.len, 2), 0, 0);
        g.restore();
      }
      x += w;
    });
    g.strokeStyle = '#666';
    g.beginPath();
    g.moveTo(mL - 14, y);
    g.lineTo(mL - 14, y + hh);
    g.moveTo(mL - 18, y);
    g.lineTo(mL - 10, y);
    g.moveTo(mL - 18, y + hh);
    g.lineTo(mL - 10, y + hh);
    g.stroke();
    g.textAlign = 'right';
    g.fillStyle = '#111';
    g.font = 'bold 12px Arial';
    g.fillText(L.n, mL - 22, y + hh / 2 - 7);
    g.font = '11px Arial';
    g.fillText('h = ' + fz(L.h, 2) + ' m', mL - 22, y + hh / 2 + 7);
    const P = L.e.reduce((s, e) => s + e.len, 0),
      A = L.e.reduce((s, e) => s + e.area, 0);
    g.textAlign = 'left';
    g.font = '11px Arial';
    g.fillText('Σ L = ' + fz(P, 2) + ' m', x + 10, y + hh / 2 - 7);
    g.font = 'bold 11px Arial';
    g.fillText('Σ A = ' + fz(A, 1) + ' m²', x + 10, y + hh / 2 + 7);
    y += hh;
  });
  y += 26;
  let lx = mL;
  g.font = '11px Arial';
  g.textAlign = 'left';
  XLD.forEach((d, i) => {
    g.fillStyle = XLFC[i];
    g.fillRect(lx, y - 6, 14, 12);
    g.strokeStyle = '#333';
    g.strokeRect(lx, y - 6, 14, 12);
    g.fillStyle = '#111';
    g.fillText(d, lx + 18, y);
    lx += 44;
  });
  const sb = Math.max(1, Math.pow(10, Math.floor(Math.log10(maxP / 3)))),
    sx = Math.max(mL, lx + 30);
  g.strokeStyle = '#111';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(sx, y);
  g.lineTo(sx + sb * sc, y);
  g.stroke();
  g.fillStyle = '#111';
  g.fillText(sb + ' m', sx + sb * sc + 8, y);
  g.fillStyle = '#777';
  g.font = '10px Arial';
  g.fillText(
    'Ausrichtung = Himmelsrichtung der Außennormalen (Norden = −Y der Karte). UG schraffiert. Giebel-/Patch-Flächen siehe Tabelle.',
    mL,
    y + 22,
  );
  return { png: layB64(cv.toDataURL('image/png')), w: W, h: H };
}
/** Loggia-Wände als bemaßte Rechtecke nebeneinander (LOD 200; L: [{ x, len, h, nr }]). */
function xlLoggiaBild(bn, L) {
  if (!L.length) return null;
  const fz = (v, d) => v.toFixed(d).replace('.', ','),
    tw = L.reduce((s, w) => Math.max(s, w.x + w.len), 0),
    th = Math.max(...L.map((w) => w.h)),
    sc = Math.max(8, Math.min(60, 900 / tw, 260 / th)),
    W = Math.ceil(tw * sc + 80),
    H = Math.ceil(th * sc + 110),
    K = 2,
    cv = document.createElement('canvas');
  cv.width = W * K;
  cv.height = H * K;
  const g = cv.getContext('2d');
  g.scale(K, K);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d1d1b';
  g.font = 'bold 15px Arial';
  g.textBaseline = 'middle';
  g.fillText('Loggien ' + bn + ' – Rück- und Seitenwände, Maße in m', 12, 20);
  const y0 = 60;
  L.forEach((w) => {
    const x = 40 + w.x * sc,
      ww = w.len * sc,
      hh = w.h * sc,
      y = y0 + (th - w.h) * sc;
    g.fillStyle = '#e6d8b8';
    g.fillRect(x, y, ww, hh);
    g.strokeStyle = '#333';
    g.strokeRect(x, y, ww, hh);
    g.fillStyle = '#222';
    g.font = 'bold 11px Arial';
    g.textAlign = 'center';
    g.fillText(w.nr, x + ww / 2, y + hh / 2 - 7);
    g.font = '10px Arial';
    g.fillText(fz(w.len, 2) + ' × ' + fz(w.h, 2), x + ww / 2, y + hh / 2 + 7);
  });
  return { png: layB64(cv.toDataURL('image/png')), w: W, h: H };
}
// ---- bemaßte Draufsichten (Grundriss, Dach, Terrasse, Lageplan): Kantenmaße im Maßkettenstil + Rechteckzerlegung
function xlDecomp(add, sub, ang) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang),
    R = (p) => [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca],
    B = (q) => [q[0] * ca - q[1] * sa, q[0] * sa + q[1] * ca],
    ad = add.map((P) => P.map(R)),
    sb = (sub || []).map((P) => P.map(R));
  const xs = [];
  ad.concat(sb).forEach((P) => P.forEach((p) => xs.push(p[0])));
  xs.sort((a, b) => a - b);
  const ux = [];
  xs.forEach((v) => {
    if (!ux.length || v - ux[ux.length - 1] > 0.02) ux.push(v);
  });
  const iv = (P, x) => {
    const ys = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i],
        b = P[(i + 1) % P.length];
      if (a[0] <= x !== b[0] <= x) ys.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
    ys.sort((p, q) => p - q);
    const o = [];
    for (let i = 0; i + 1 < ys.length; i += 2) o.push([ys[i], ys[i + 1]]);
    return o;
  };
  const mg = (a) => {
    a.sort((p, q) => p[0] - q[0]);
    const o = [];
    a.forEach((v) => {
      if (o.length && v[0] <= o[o.length - 1][1] + 0.01)
        o[o.length - 1][1] = Math.max(o[o.length - 1][1], v[1]);
      else o.push([v[0], v[1]]);
    });
    return o;
  };
  const sbt = (A, Bs) => {
    let o = A;
    Bs.forEach((b) => {
      const n = [];
      o.forEach((a) => {
        let s = a[0];
        b.forEach((c) => {
          if (c[1] <= s || c[0] >= a[1]) return;
          if (c[0] > s) n.push([s, c[0]]);
          s = Math.max(s, c[1]);
        });
        if (s < a[1]) n.push([s, a[1]]);
      });
      o = n;
    });
    return o;
  };
  const at = (x) =>
    sbt(
      mg([].concat(...ad.map((P) => iv(P, x)))),
      [mg([].concat(...sb.map((P) => iv(P, x))))].filter((z) => z.length),
    ).filter((v) => v[1] - v[0] > 0.005);
  const it = [];
  for (let k = 0; k + 1 < ux.length; k++) {
    const xa = ux[k],
      xb = ux[k + 1],
      w = xb - xa;
    if (w < 0.02) continue;
    const e = Math.min(w / 20, 0.002),
      L = at(xa + e),
      M = at((xa + xb) / 2),
      Rr = at(xb - e);
    if (L.length === M.length && Rr.length === M.length) {
      M.forEach((m, i) => {
        const l = L[i],
          r = Rr[i];
        if (
          Math.abs(l[1] - l[0] - (m[1] - m[0])) < 0.03 &&
          Math.abs(r[1] - r[0] - (m[1] - m[0])) < 0.03 &&
          Math.abs(l[0] - r[0]) < 0.03
        )
          it.push({ k: 'R', xa, xb, ya: m[0], yb: m[1] });
        else it.push({ k: 'T', xa, xb, a1: l[0], b1: l[1], a2: r[0], b2: r[1] });
      });
    } else M.forEach((m) => it.push({ k: 'R', xa, xb, ya: m[0], yb: m[1], x: 1 }));
  }
  const out = [];
  it.forEach((r) => {
    if (r.k === 'R') {
      const p = out.find(
        (q) =>
          q.k === 'R' &&
          Math.abs(q.xb - r.xa) < 0.021 &&
          Math.abs(q.ya - r.ya) < 0.03 &&
          Math.abs(q.yb - r.yb) < 0.03,
      );
      if (p) p.xb = r.xb;
      else out.push({ ...r });
    } else out.push(r);
  });
  return out.map((r, i) => {
    let pts,
      w = r.xb - r.xa,
      h,
      a;
    if (r.k === 'R') {
      h = r.yb - r.ya;
      pts = [
        [r.xa, r.ya],
        [r.xb, r.ya],
        [r.xb, r.yb],
        [r.xa, r.yb],
      ];
      a = w * h;
    } else {
      h = (r.b1 - r.a1 + (r.b2 - r.a2)) / 2;
      pts = [
        [r.xa, r.a1],
        [r.xb, r.a2],
        [r.xb, r.b2],
        [r.xa, r.b1],
      ];
      a = w * h;
    }
    return {
      n: 'R' + (i + 1),
      form: r.k === 'R' ? 'Rechteck' : 'Trapez/Dreieck',
      len: Math.max(w, h),
      br: Math.min(w, h),
      a,
      pts: pts.map(B),
    };
  });
}
function xlAng(f) {
  let bl = 0,
    an = 0;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length],
      l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l > bl) {
      bl = l;
      an = Math.atan2(c[1] - a[1], c[0] - a[0]);
    }
  });
  return an;
}
function xlPlan(title, Ls, o) {
  o = o || {};
  const fz = (v, d) => v.toFixed(d).replace('.', ',');
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  Ls.forEach((l) => {
    if (l.poly)
      l.poly.forEach(([x, y]) => {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      });
  });
  if (x0 > x1) return null;
  const w = Math.max(0.5, x1 - x0),
    h = Math.max(0.5, y1 - y0),
    mx = 64,
    mt = 64,
    mb = 70,
    sc = Math.min((o.w || 820) / w, (o.h || 560) / h),
    W = Math.max(480, Math.ceil(w * sc + 2 * mx)),
    H = Math.ceil(h * sc + mt + mb),
    K = 2,
    cv = document.createElement('canvas');
  cv.width = W * K;
  cv.height = H * K;
  const g = cv.getContext('2d');
  g.scale(K, K);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  const ox = (W - w * sc) / 2,
    X = (x) => ox + (x - x0) * sc,
    Y = (y) => mt + (y - y0) * sc;
  const path = (p) => {
    g.beginPath();
    p.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.closePath();
  };
  const halo = (t, x, y) => {
    g.lineWidth = 3;
    g.strokeStyle = '#fff';
    g.strokeText(t, x, y);
    g.fillText(t, x, y);
  };
  g.textBaseline = 'middle';
  g.fillStyle = '#1d1d1b';
  g.font = 'bold 14px Arial';
  g.textAlign = 'left';
  g.fillText(title, 12, 18);
  Ls.forEach((l) => {
    if (l.fill && l.poly) {
      path(l.poly);
      g.fillStyle = l.fill;
      g.globalAlpha = l.alpha || 1;
      g.fill();
      g.globalAlpha = 1;
    }
    if (l.tris) {
      g.fillStyle = l.fill;
      l.tris.forEach((t) => {
        g.beginPath();
        g.moveTo(X(t[0]), Y(t[1]));
        g.lineTo(X(t[2]), Y(t[3]));
        g.lineTo(X(t[4]), Y(t[5]));
        g.closePath();
        g.fill();
        g.strokeStyle = l.fill;
        g.lineWidth = 1;
        g.stroke();
      });
    }
    if (l.cells) {
      g.fillStyle = l.fill;
      const s = l.st * sc + 0.6;
      l.cells.forEach(([x, y]) => g.fillRect(X(x) - 0.3, Y(y) - 0.3, s, s));
    }
    if (l.stroke && l.poly) {
      path(l.poly);
      g.strokeStyle = l.stroke;
      g.lineWidth = l.lw || 1.5;
      g.setLineDash(l.dash || []);
      g.stroke();
      g.setLineDash([]);
    }
    if (l.rects) {
      g.strokeStyle = '#555';
      g.lineWidth = 1;
      g.setLineDash([5, 3]);
      l.rects.forEach((r) => {
        path(r.pts);
        g.stroke();
      });
      g.setLineDash([]);
    }
  });
  // Kantenmaße im Maßkettenstil
  Ls.forEach((l) => {
    if (!l.dim || !l.poly) return;
    const p = l.poly;
    let sa = 0;
    p.forEach((a, i) => {
      const c = p[(i + 1) % p.length];
      sa += a[0] * c[1] - c[0] * a[1];
    });
    const sg = sa > 0 ? 1 : -1;
    g.font = '10px Arial';
    g.textAlign = 'center';
    p.forEach((a, i) => {
      const c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dy = c[1] - a[1],
        len = Math.hypot(dx, dy);
      if (len < 0.4 || len * sc < 30) return;
      const ux = dx / len,
        uy = dy / len,
        nx = sg * uy,
        ny = -sg * ux,
        off = 18,
        ax = X(a[0]),
        ay = Y(a[1]),
        cx = X(c[0]),
        cy = Y(c[1]);
      g.strokeStyle = '#111';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(ax + nx * 4, ay + ny * 4);
      g.lineTo(ax + nx * (off + 5), ay + ny * (off + 5));
      g.moveTo(cx + nx * 4, cy + ny * 4);
      g.lineTo(cx + nx * (off + 5), cy + ny * (off + 5));
      g.moveTo(ax + nx * off, ay + ny * off);
      g.lineTo(cx + nx * off, cy + ny * off);
      const tx = (ux + nx) * 3.5,
        ty = (uy + ny) * 3.5;
      g.moveTo(ax + nx * off - tx, ay + ny * off - ty);
      g.lineTo(ax + nx * off + tx, ay + ny * off + ty);
      g.moveTo(cx + nx * off - tx, cy + ny * off - ty);
      g.lineTo(cx + nx * off + tx, cy + ny * off + ty);
      g.stroke();
      let an = Math.atan2(dy, dx),
        fl = 1;
      if (an > Math.PI / 2 || an < -Math.PI / 2) {
        an += Math.PI;
        fl = -1;
      }
      g.save();
      g.translate((ax + cx) / 2 + nx * (off + 7), (ay + cy) / 2 + ny * (off + 7));
      g.rotate(an);
      g.fillStyle = '#111';
      g.fillText(fz(len, 2), 0, 0);
      g.restore();
    });
  });
  // Beschriftung
  Ls.forEach((l) => {
    if (l.rects) {
      l.rects.forEach((r) => {
        const c = r.pts.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
        let ex0 = 1e9,
          ex1 = -1e9,
          ey0 = 1e9,
          ey1 = -1e9;
        r.pts.forEach((q) => {
          ex0 = Math.min(ex0, X(q[0]));
          ex1 = Math.max(ex1, X(q[0]));
          ey0 = Math.min(ey0, Y(q[1]));
          ey1 = Math.max(ey1, Y(q[1]));
        });
        const big = ex1 - ex0 > 86 && ey1 - ey0 > 40,
          lines = big
            ? [r.n, fz(r.len, 2) + ' × ' + fz(r.br, 2), fz(r.a, 1) + ' m²']
            : ex1 - ex0 > 30 && ey1 - ey0 > 14
              ? [r.n]
              : [];
        g.textAlign = 'center';
        g.fillStyle = '#1d1d1b';
        lines.forEach((t, i) => {
          g.font = (i ? '10px' : 'bold 11px') + ' Arial';
          halo(t, X(c[0]), Y(c[1]) + (i - (lines.length - 1) / 2) * 13);
        });
      });
    }
    if (!l.lab) return;
    let cx, cy;
    if (l.tris && l.tris.length) {
      cx = cy = 0;
      l.tris.forEach((t) => {
        cx += (t[0] + t[2] + t[4]) / 3;
        cy += (t[1] + t[3] + t[5]) / 3;
      });
      cx /= l.tris.length;
      cy /= l.tris.length;
    } else if (l.cells && l.cells.length) {
      cx = l.cells.reduce((a, q) => a + q[0], 0) / l.cells.length + l.st / 2;
      cy = l.cells.reduce((a, q) => a + q[1], 0) / l.cells.length + l.st / 2;
    } else if (l.poly) {
      [cx, cy] = cen(l.poly);
    } else return;
    g.textAlign = 'center';
    g.fillStyle = '#1d1d1b';
    l.lab.forEach((t, i) => {
      g.font = (i ? '11px' : 'bold 12px') + ' Arial';
      halo(t, X(cx), Y(cy) + (i - (l.lab.length - 1) / 2) * 14);
    });
  });
  g.strokeStyle = '#111';
  g.fillStyle = '#111';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(W - 30, 52);
  g.lineTo(W - 30, 24);
  g.stroke();
  g.beginPath();
  g.moveTo(W - 30, 20);
  g.lineTo(W - 35, 30);
  g.lineTo(W - 25, 30);
  g.closePath();
  g.fill();
  g.font = 'bold 11px Arial';
  g.textAlign = 'center';
  g.fillText('N', W - 30, 60);
  let sb = 1;
  for (const c of [1, 2, 5, 10, 20, 50, 100, 200]) if (c <= w / 2.5) sb = c;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(mx, H - 34);
  g.lineTo(mx + sb * sc, H - 34);
  g.stroke();
  g.font = '11px Arial';
  g.textAlign = 'left';
  g.fillText(sb + ' m', mx + sb * sc + 8, H - 34);
  g.fillStyle = '#777';
  g.font = '10px Arial';
  g.fillText(
    'Maße in m · Norden oben · gestrichelt = Zerlegung in Rechtecke (R1, R2 … siehe Tabelle)',
    mx,
    H - 14,
  );
  return { png: layB64(cv.toDataURL('image/png')), w: W, h: H };
}
function xlAddImg(s, q, im, media) {
  media.push(im.png);
  s.img.push({ row: q, col: 0, w: im.w, h: im.h, mi: media.length });
  return q + Math.ceil(im.h / 20) + 1;
}
// Zeichnung + Rechtecktabelle platzieren
function xlPlace(s, q, items, media) {
  items.forEach((it) => {
    q = xlAddImg(s, q, it.im, media);
    if (it.rows && it.rows.length) {
      const cols = it.cols,
        T = xlTbl(s, q, cols, it.rows);
      q = T.next;
      const vs = { a: it.rows.reduce((a, r) => a + r.a.v, 0) };
      if (it.rows[0].g) vs.g = it.rows.reduce((a, r) => a + r.g.v, 0);
      xlSumRow(s, q, cols, T, 'Σ ' + it.sum, it.rows[0].g ? ['a', 'g'] : ['a'], vs, T.r0, T.r1);
      q++;
      if (it.ref != null) {
        const d = vs[it.rows[0].g ? 'g' : 'a'] - it.ref;
        s.set(
          q,
          1,
          Math.abs(d) < 0.05
            ? 'Summe stimmt mit dem Kennwert überein (' + f1(it.ref, 2) + ' m²).'
            : 'Differenz zum Kennwert (' +
                f1(it.ref, 2) +
                ' m²): ' +
                f1(d, 2) +
                ' m² (Rasterung/Flächenpatches).',
          13,
        );
        q++;
      }
      q++;
    }
    if (it.note) {
      s.set(q, 1, it.note, 13);
      q += 2;
    }
  });
  return q;
}
function xlRows(rs, ang0, tt) {
  return rs.map((r) => ({
    nr: r.n,
    bz: r.bz || '',
    form: r.form,
    ang: ang0,
    len: r.len,
    br: r.br,
    a: { f: (L, q) => (L.len && L.br ? `${L.len}${q}*${L.br}${q}` : null), v: r.a },
    ...(ang0 != null
      ? {
          g: {
            f: (L, q) => (L.a && L.ang ? `${L.a}${q}/COS(RADIANS(${L.ang}${q}))` : null),
            v: r.a / Math.cos((ang0 * Math.PI) / 180),
          },
        }
      : {}),
  }));
}
const XLRC = (g) => [
  xlC('nr', 'Nr.', '', 0, 't', 9, 1),
  xlC('bz', 'Bezug', '', 0, 't', 22, 1),
  xlC('form', 'Form', '', 0, 't', 16, 1),
  ...(g ? [xlC('ang', 'Neigung', '°', 0, 'n', 10, 1)] : []),
  xlC('len', 'Länge', 'm', 2, 'n', 10, 1),
  xlC('br', 'Breite (mittl.)', 'm', 2, 'n', 12, 1),
  xlC('a', g ? 'Fläche Grundriss' : 'Fläche', 'm²', 2, 'n', 14, 1),
  ...(g ? [xlC('g', 'Fläche geneigt', 'm²', 2, 'n', 14, 1)] : []),
];
function xlPlans(kind, d) {
  const b = d.b,
    bn = b.name || b.id,
    o = [];
  if (kind === 'lev' && l2on()) {
    // LOD 200: je Geschoss Wände (Bauteile) und Räume mit Nettofläche – die Flächen der Metriken (NGF, KF)
    const R = l2NetKoerper(b, 'all', true),
      N = l2Ngf(b),
      E = l2Els(b).els;
    bLv(b).forEach((lr, i) => {
      const l = b.levels[i],
        f = l ? lf(b, l) : lf(b, b.levels[b.levels.length - 1]),
        rs = R.filter((k) => k.li === i),
        an = xlAng(f),
        L = [{ poly: f, fill: '#f7f6f2', stroke: '#222', lw: 1.6, dim: 1 }],
        rects = [];
      E.filter((e) => e.li === i && e.quads && /^(AW|TW|IN|TH)$/.test(e.kind)).forEach((e) =>
        e.quads.forEach((qd) => L.push({ poly: qd, fill: e.kind === 'AW' ? '#4a4844' : '#7d8790' })),
      );
      rs.forEach((k, ri) => {
        L.push({ poly: k.p, fill: '#dde8f2', stroke: '#5E7F92', lw: 0.8 });
        (k.hs || []).forEach((h) => L.push({ poly: h, fill: '#f7f6f2', stroke: '#5E7F92', lw: 0.8 }));
        const rc = xlDecomp([k.p], k.hs || [], an),
          nm = (k.f && (k.f.n || k.f.name)) || 'Raum ' + (ri + 1);
        rc.forEach((q, j) => {
          q.n = 'R' + (ri + 1) + '.' + (j + 1);
          q.bz = nm + ' – ' + lr.n;
        });
        rects.push(...rc);
      });
      L.push({ rects });
      const im = xlPlan(`Grundriss ${bn} – ${lr.n} (LOD 200: Wände und Nettoflächen)`, L, { w: 760, h: 500 }),
        lvN = N.lv[i] || {};
      if (im)
        o.push({
          im,
          cols: XLRC(0),
          rows: xlRows(rects, null),
          sum: 'NGF (R) ' + lr.n + ' – Räume',
          ref: lvN.ngf != null ? lvN.ngf : null,
          note:
            'BGF ' +
            lr.n +
            ' = ' +
            f1(lr.a, 2) +
            ' m² · NGF (R) = ' +
            f1(lvN.ngf || 0, 2) +
            ' m²' +
            (lvN.s ? ' · NGF (S) Balkone/Loggien = ' + f1(lvN.s, 2) + ' m²' : '') +
            ' · KF (Wände) = BGF − NGF = ' +
            f1(lvN.w || 0, 2) +
            ' m² (dunkel: Außenwände, grau: Innenwände)',
        });
    });
  } else if (kind === 'logg') {
    // LOD 200: Loggien – Rück- und Seitenwände statt der Öffnung in der Fassadenebene (wie l2FassadeWert)
    const W = l2LoggiaWaende(b);
    if (!W.some((w) => w.art !== 'oeff')) return o;
    const rows = [],
      L = [];
    let n = 0,
      x = 0;
    W.forEach((w) => {
      const h = w.Q ? w.Q[2][1] - w.Q[0][1] : 0,
        len = w.Q ? Math.hypot(w.Q[1][0] - w.Q[0][0], w.Q[1][2] - w.Q[0][2]) : 0;
      if (w.art === 'oeff') {
        n++;
        rows.push({
          nr: 'L' + n + '.0',
          bz: 'Öffnung Loggia ' + n + ' – ' + w.nm + ' (abzüglich)',
          form: 'Rechteck',
          len: null,
          br: null,
          a: { f: () => null, v: -w.a },
        });
        return;
      }
      const nr =
        'L' +
        n +
        '.' +
        (w.art === 'rueck' ? 'R' : 'S' + (rows.filter((r) => r.nr.startsWith('L' + n + '.S')).length + 1));
      rows.push({
        nr,
        bz: (w.art === 'rueck' ? 'Rückwand' : 'Seitenwand') + ' Loggia ' + n + ' – ' + w.nm,
        form: 'Rechteck',
        len,
        br: h,
        a: { f: (C, q) => (C.len && C.br ? `${C.len}${q}*${C.br}${q}` : null), v: w.a },
      });
      L.push({ x, len, h, nr });
      x += len + 0.8;
    });
    const im = xlLoggiaBild(bn, L);
    o.push({
      im,
      cols: XLRC(0),
      rows,
      sum: 'Loggien (Rück- und Seitenwände abzüglich Öffnungen)',
      ref: W.reduce((s, w) => s + (w.art === 'oeff' ? -w.a : w.a), 0),
    });
  } else if (kind === 'netto') {
    // LOD 200: Fassade abzüglich Öffnungen – je Seite brutto, darunter jede Öffnung als Abzug
    const im = xlPng(b, d.W, { netto: 1 }),
      rows = [];
    d.W.filter((w) => !w.ug).forEach((w) => {
      const id = w.lv + ' ' + w.nr;
      if (w.len != null)
        rows.push({
          nr: id,
          bz: w.dir + ' brutto' + (w.zus ? ' + Attika/Brüstung/Schürze' : ''),
          form: 'Rechteck',
          len: w.len,
          br: w.h,
          a: {
            f: (C, q) =>
              C.len && C.br ? `${C.len}${q}*${C.br}${q}` + (w.zus ? `+${w.zus.toFixed(3)}` : '') : null,
            v: w.area,
          },
        });
      else rows.push({ nr: id, bz: w.lv, form: '–', len: null, br: null, a: { f: () => null, v: w.area } });
      (w.oe || []).forEach((oo, k) =>
        rows.push({
          nr: id + '.' + (k + 1),
          bz: 'Öffnung (abzüglich)',
          form: 'Rechteck',
          len: oo.t1 - oo.t0,
          br: oo.y1 - oo.y0,
          a: { f: (C, q) => (C.len && C.br ? `-${C.len}${q}*${C.br}${q}` : null), v: -oo.a },
        }),
      );
    });
    if (d.W.oeRest > 0.01)
      rows.push({
        nr: '–',
        bz: 'weitere Öffnungen (in Loggia-Rückwänden u. Ä., abzüglich)',
        form: '–',
        len: null,
        br: null,
        a: { f: () => null, v: -d.W.oeRest },
      });
    if (im)
      o.push({
        im,
        cols: XLRC(0),
        rows,
        sum: 'Fassade ohne Öffnungen ' + bn,
        ref: l2FassadeWert(b, d.m.fas) - l2FassadenOeffnungsFlaeche(b),
      });
  } else if (kind === 'lev') {
    const g = new Map();
    b.levels.forEach((l, i) => {
      const f = lf(b, l),
        k = JSON.stringify(f.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]));
      if (!g.has(k)) g.set(k, { f, n: [] });
      g.get(k).n.push(d.L[i].n);
    });
    g.forEach((x) => {
      const nm = x.n.join(', '),
        rc = xlDecomp([x.f], [], xlAng(x.f));
      rc.forEach((r) => (r.bz = nm));
      const im = xlPlan(
        `Grundriss ${bn} – ${nm}`,
        [{ poly: x.f, fill: '#ece9e1', stroke: '#222', lw: 1.8, dim: 1, rects: rc }],
        { w: 700, h: 460 },
      );
      if (im)
        o.push({
          im,
          cols: XLRC(0),
          rows: xlRows(rc, null),
          sum: 'Grundfläche ' + nm + ' (ein Geschoss)',
          ref: area(x.f),
        });
    });
  } else if (kind === 'roof') {
    const f = lf(b, b.levels.at(-1)),
      an = xlAng(f),
      tr = d.R.filter((r) => r.t),
      L = [{ poly: f, fill: '#eeeeee' }];
    let rows = [],
      rcs = [];
    if (tr.length) {
      tr.forEach((r) => {
        const rc = xlDecomp(
          r.t.map((t) => [
            [t[0], t[1]],
            [t[2], t[3]],
            [t[4], t[5]],
          ]),
          [],
          an,
        );
        rc.forEach((q, i) => {
          q.n = r.nr + '.' + (i + 1);
          q.bz = `${r.nr} ${r.dir} ${r.ang}°`;
        });
        L.push({ tris: r.t, fill: XLFC[Math.max(0, XLD.indexOf(r.dir))], rects: rc });
        rcs.push(...rc);
        rows.push(...xlRows(rc, r.ang));
      });
    } else {
      const rc = xlDecomp([f], [], an);
      rc.forEach((q) => (q.bz = 'Flachdach'));
      L.push({ rects: rc });
      rows = xlRows(rc, 0);
    }
    L.push({ poly: f, stroke: '#222', lw: 1.8, dim: 1 });
    const im = xlPlan(`Dachdraufsicht ${bn}`, L, { w: 760, h: 500 });
    if (im)
      o.push({
        im,
        cols: XLRC(1),
        rows,
        sum: 'Dachfläche ' + bn,
        ref:
          d.m.dach -
          (d.R.find((r) => !r.t && r.typ.startsWith('Änderung'))
            ? d.R.find((r) => !r.t && r.typ.startsWith('Änderung')).area
            : 0),
      });
  } else if (kind === 'terr') {
    d.T.forEach((r) => {
      if (!r.pa) return;
      const rc = xlDecomp([r.pa], [r.pb], xlAng(r.pa));
      rc.forEach((q) => (q.bz = 'auf ' + r.lv));
      const im = xlPlan(
        `Terrasse ${bn} – auf ${r.lv}`,
        [
          { poly: r.pa, fill: '#f4f2ec', stroke: '#222', lw: 1.6, dim: 1 },
          { cells: r.q, st: r.st, fill: '#bfe3c4' },
          {
            poly: r.pb,
            fill: '#d7d7d7',
            stroke: '#222',
            lw: 1.6,
            dim: 1,
            rects: rc.length ? undefined : undefined,
          },
          { rects: rc },
        ],
        { w: 700, h: 460 },
      );
      if (im) o.push({ im, cols: XLRC(0), rows: xlRows(rc, null), sum: 'Terrasse auf ' + r.lv, ref: r.area });
    });
  }
  return o;
}
function xlTail(s, q, kind, D, media) {
  D.forEach((d) => {
    const it = xlPlans(kind, d);
    if (!it.length) return;
    s.set(q, 1, d.b.name || d.b.id, 14);
    q++;
    q = xlPlace(s, q, it, media);
  });
  return q;
}
function xlSitePlan(k, Ds) {
  const pl = k.p.poly,
    L = [{ poly: pl, fill: '#f7f5ee', stroke: '#222', lw: 2, dim: 1, ch: 1, lab: null }];
  (S.areas || []).forEach((a) => {
    if (!inP(cen(a.poly), pl)) return;
    let c = '#cfe3c8';
    try {
      c = AT[a.type].c() || c;
    } catch (e) {
      logErr(e, 'xlSitePlan>anonym');
    }
    L.push({
      poly: a.poly,
      fill: c,
      alpha: 0.65,
      stroke: '#555',
      lw: 1,
      dim: 1,
      lab: [a.name || a.id, area(a.poly).toFixed(1).replace('.', ',') + ' m²'],
    });
  });
  Ds.forEach((d) => {
    const f = lf(d.b, d.b.levels[0]);
    L.push({
      poly: f,
      fill: '#cfcfcf',
      stroke: '#111',
      lw: 1.6,
      dim: 1,
      ch: 1,
      lab: [d.b.name || d.b.id, area(f).toFixed(1).replace('.', ',') + ' m²'],
    });
  });
  return xlPlan('Lageplan – Grundstück ' + k.A.toFixed(1).replace('.', ',') + ' m²', L, { w: 820, h: 560 });
}
