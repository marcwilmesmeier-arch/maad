// ================= Stufe 4: Teilen (L) =================
// Wandfläche mit einer senkrechten Linie teilen (Klick auf die Fläche; Fang auf Mitte und auf Fluchten anderer Geschosse; Zahl + Enter = Abstand von der nächsten Ecke).
// Gilt für alle Geschosse der Fläche, Alt = nur dieses Geschoss. Danach lassen sich die Teile einzeln mit Ziehen & Schieben ziehen (Erker, Loggia, Rücksprung).
// var bewusst: 020-darstellung und 030-leiste fragen SKLN vorher mit typeof ab
// eslint-disable-next-line no-var
var SKLN = new T.LineSegments(
  new T.BufferGeometry(),
  new T.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.6,
    gapSize: 0.35,
    depthTest: false,
    transparent: true,
  }),
);
SKLN.renderOrder = 9;
SKLN.frustumCulled = false;
SKLN.visible = false;
SKLN.raycast = () => {};
sc.add(SKLN);
function skSplitPos(e, alt) {
  const en = skHit(e);
  if (!en || en.top) return null;
  const h = mdlHit();
  if (!h) return null;
  const b = en.b,
    f = lf(b, b.levels[en.j]),
    a = f[en.i],
    c = f[(en.i + 1) % f.length],
    len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (len < 0.3) return null;
  const ux = (c[0] - a[0]) / len,
    uz = (c[1] - a[1]) / len;
  let t = (h.point.x - a[0]) * ux + (h.point.z - a[1]) * uz;
  t = Math.max(0.1, Math.min(len - 0.1, t));
  const thr = Math.min(0.6, Math.max(0.12, 12 * mpp()));
  let best = null,
    bd = thr,
    lab = '';
  const cand = [[len / 2, 'Mitte']];
  if (!alt)
    skGroup(en).forEach((g) => {
      const f2 = lf(b, b.levels[g.j]),
        p = f2[g.i],
        q = f2[(g.i + 1) % f2.length];
      [p, q].forEach((v) => {
        const tt = (v[0] - a[0]) * ux + (v[1] - a[1]) * uz;
        cand.push([tt, 'Flucht Geschoss ' + (g.j + 1)]);
      });
    });
  b.levels.forEach((l, j) =>
    lf(b, l).forEach((v) => {
      const tt = (v[0] - a[0]) * ux + (v[1] - a[1]) * uz,
        dd = Math.abs((v[0] - a[0]) * uz - (v[1] - a[1]) * ux);
      if (dd < 0.05) cand.push([tt, 'Flucht']);
    }),
  );
  cand.forEach((q) => {
    const d = Math.abs(q[0] - t);
    if (d < bd && q[0] > 0.1 && q[0] < len - 0.1) {
      bd = d;
      best = q[0];
      lab = q[1];
    }
  });
  if (best != null) t = best;
  else t = Math.round(t * 20) / 20;
  const fromEnd = t <= len / 2 ? 0 : 1,
    dist = fromEnd ? len - t : t;
  return { en, t, len, u: [ux, uz], a, P: [a[0] + ux * t, a[1] + uz * t], lab, fromEnd, dist, alt: !!alt };
}
function skSplitTargets(lh) {
  const b = lh.en.b,
    out = [];
  const ents = lh.alt ? [{ b, j: lh.en.j, i: lh.en.i }] : skGroup(lh.en);
  ents.forEach((g) => {
    const f = lf(b, b.levels[g.j]),
      m = f.length,
      p = f[g.i],
      q = f[(g.i + 1) % m],
      L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 0.2) return;
    const vx = (q[0] - p[0]) / L,
      vz = (q[1] - p[1]) / L,
      tt = (lh.P[0] - p[0]) * vx + (lh.P[1] - p[1]) * vz,
      dd = Math.abs((lh.P[0] - p[0]) * vz - (lh.P[1] - p[1]) * vx);
    if (tt > 0.05 && tt < L - 0.05 && dd < 0.1)
      out.push({ j: g.j, i: g.i, M: [p[0] + vx * tt, p[1] + vz * tt] });
  });
  return out;
}
function skLnDraw() {
  const lh = SK.lh;
  if (!lh || SK.tool !== 'l' || !skAct()) {
    SKLN.visible = false;
    return;
  }
  const b = lh.en.b,
    tg = skSplitTargets(lh),
    pos = [];
  tg.forEach((g) => {
    const z0 = skZ(b, g.j),
      z1 = z0 + b.levels[g.j].h;
    pos.push(g.M[0], z0, g.M[1], g.M[0], z1, g.M[1]);
  });
  if (!pos.length) {
    SKLN.visible = false;
    return;
  }
  SKLN.geometry.dispose();
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  SKLN.geometry = geo;
  SKLN.computeLineDistances();
  SKLN.visible = true;
  try {
    $('hud').textContent =
      'Teilen · ' +
      f1(lh.dist, 2).replace('.', ',') +
      ' m von der ' +
      (lh.fromEnd ? 'rechten' : 'linken') +
      ' Ecke' +
      (lh.lab ? ' · Fang: ' + lh.lab : '') +
      ' · ' +
      tg.length +
      ' Geschoss' +
      (tg.length === 1 ? '' : 'e') +
      ' · Klick = teilen · Zahl + Enter = Abstand · Alt = nur dieses Geschoss';
  } catch (e) {
    logErr(e, 'skLnDraw');
  }
}
function skSplitDo(lh) {
  const tg = skSplitTargets(lh),
    b = lh.en.b;
  if (!tg.length) {
    $('hud').textContent = 'Teilen: keine Wandkante an dieser Stelle';
    return false;
  }
  hist();
  const per = {};
  tg.forEach((g) => {
    (per[g.j] = per[g.j] || []).push(g);
  });
  for (const j in per) {
    const l = b.levels[j],
      fp = lf(b, l).map((q) => q.slice());
    per[j]
      .sort((x, y) => y.i - x.i)
      .forEach((g) => {
        fp.splice(g.i + 1, 0, g.M.slice(), g.M.slice());
      });
    l.fp = fp;
  }
  if (b.kind === 'circ') b.kind = 'free';
  SK.sel = [];
  SK.hv = null;
  SK.ver++;
  mesh(b);
  S.sel = b;
  H();
  hpos();
  skSync();
  SK.lh = null;
  SKLN.visible = false;
  $('hud').textContent =
    'Fläche in ' +
    tg.length +
    ' Geschoss' +
    (tg.length === 1 ? '' : 'en') +
    ' geteilt – mit Ziehen & Schieben (P) einzelne Teile ziehen';
  return true;
}
function skLDown(e) {
  if (SK.tool !== 'l') return false;
  const lh = skSplitPos(e, e.altKey);
  if (!lh) return false;
  SK.lh = lh;
  skSplitDo(lh);
  return true;
}
function skLKeys(e) {
  const k = e.key;
  if (k === 'l' || k === 'L') {
    skTool('l');
    return true;
  }
  if (SK.tool !== 'l') return false;
  if (/^[0-9.,\-]$/.test(k)) {
    SK.vcb += k;
    skVcbShow();
    return true;
  }
  if (k === 'Backspace' && SK.vcb) {
    SK.vcb = SK.vcb.slice(0, -1);
    skVcbShow();
    return true;
  }
  if (k === 'Enter') {
    const v = skVcbVal(),
      lh = SK.lh;
    if (v == null || !lh || v <= 0.05 || v >= lh.len - 0.05) return false;
    const t = lh.fromEnd ? lh.len - v : v,
      l2 = Object.assign({}, lh, { t, P: [lh.a[0] + lh.u[0] * t, lh.a[1] + lh.u[1] * t] });
    SK.vcb = '';
    skVcbShow();
    skSplitDo(l2);
    return true;
  }
  return false;
}
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    return SK.tool === 'l' ? skLDown(e) : _d(e);
  };
}
{
  const _k = SK.keys;
  SK.keys = function (e) {
    return skLKeys(e) || _k(e);
  };
}

// ================= Stufe 5: Inferenz-Anzeige =================
// Marker (kleiner weißer Punkt mit grauem Rand wie die Stützpunkte der Modellierung) + Hinweistext; Hilfslinien: rot = Ost/West, grün = Nord/Süd, blau = senkrecht, magenta = Fang auf parallele Wand/Ausgangsposition.
const SKI = new T.Group();
SKI.renderOrder = 9;
sc.add(SKI);
function skIfClear() {
  while (SKI.children.length) {
    const c = SKI.children.pop();
    c.geometry && c.geometry.dispose();
    c.material && c.material.dispose();
  }
}
function skIf(list) {
  skIfClear();
  list.forEach((o) => {
    if (!o.p.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(o.p), 3));
    const l = new T.LineSegments(
      g,
      new T.LineBasicMaterial({ color: o.c, depthTest: false, transparent: true }),
    );
    l.renderOrder = 9;
    l.frustumCulled = false;
    l.raycast = () => {};
    SKI.add(l);
  });
}
function skTipEl() {
  let d = document.getElementById('sktip');
  if (!d) {
    d = document.createElement('div');
    d.id = 'sktip';
    d.style.cssText =
      'position:fixed;z-index:9;pointer-events:none;display:none;padding:2px 7px;border-radius:6px;font-size:11px;background:#fffd;color:#222;border:1px solid #0003;white-space:nowrap';
    document.body.appendChild(d);
  }
  return d;
}
function skTip(t, e) {
  const d = skTipEl();
  if (!t || !e) {
    d.style.display = 'none';
    return;
  }
  d.textContent = t;
  d.style.display = 'block';
  d.style.left = e.clientX + 14 + 'px';
  d.style.top = e.clientY + 18 + 'px';
}
function skMkEl() {
  let d = document.getElementById('skmk');
  if (!d) {
    d = document.createElement('div');
    d.id = 'skmk';
    d.style.cssText =
      'position:fixed;z-index:9;pointer-events:none;display:none;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#E9EDEF;box-sizing:content-box;border:1px solid #777';
    document.body.appendChild(d);
  }
  return d;
}
function skInferHover(e) {
  // ── Erweiterung aus 26-modellier-modus/060-dach-bearbeiten.js
  if (SK.hv && szSp(SK.hv)) {
    try {
      skMkEl().style.display = 'none';
      skTip('', null);
    } catch (e) {
      logErr(e, 'skInferHover');
    }
    return;
  }
  const mk = skMkEl();
  mk.style.display = 'none';
  skTip('', null);
  const en = SK.hv;
  if (!en || !skAct() || SK.op) return;
  const b = en.b,
    l = b.levels[en.j],
    f = lf(b, l),
    z0 = skZ(b, en.j),
    z1 = z0 + l.h,
    pts = [];
  if (en.top) {
    f.forEach((a, i) => {
      const c = f[(i + 1) % f.length];
      pts.push([a[0], z1, a[1], 'Endpunkt'], [(a[0] + c[0]) / 2, z1, (a[1] + c[1]) / 2, 'Mittelpunkt']);
    });
  } else {
    const a = f[en.i],
      c = f[(en.i + 1) % f.length],
      mx = (a[0] + c[0]) / 2,
      mz = (a[1] + c[1]) / 2,
      zm = (z0 + z1) / 2;
    pts.push(
      [a[0], z0, a[1], 'Endpunkt'],
      [c[0], z0, c[1], 'Endpunkt'],
      [a[0], z1, a[1], 'Endpunkt'],
      [c[0], z1, c[1], 'Endpunkt'],
      [mx, z0, mz, 'Mittelpunkt'],
      [mx, z1, mz, 'Mittelpunkt'],
      [a[0], zm, a[1], 'Mittelpunkt'],
      [c[0], zm, c[1], 'Mittelpunkt'],
      [mx, zm, mz, 'Mittelpunkt'],
    );
  }
  let best = null,
    bd = 14;
  pts.forEach((q) => {
    const sp = skProj(q[0], q[1], q[2]);
    if (sp[2] > 1) return;
    const d = Math.hypot(sp[0] - e.clientX, sp[1] - e.clientY);
    if (d < bd) {
      bd = d;
      best = [sp, q[3]];
    }
  });
  if (best) {
    mk.style.display = 'block';
    mk.style.left = best[0][0] + 'px';
    mk.style.top = best[0][1] + 'px';
    skTip(best[1], e);
  }
}
function skIfOff() {
  skIfClear();
  skTip('', null);
  try {
    skMkEl().style.display = 'none';
  } catch (e) {
    logErr(e, 'skIfOff');
  }
}
// hover(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// skOpMouse(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
// skMMouse(): Erweiterung zusammengeführt, siehe 26-modellier-modus/040-stufe-3.js
// skOpEnd(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
// skMEnd(): Erweiterung zusammengeführt, siehe 26-modellier-modus/040-stufe-3.js
// skTool(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
setInterval(() => {
  try {
    skBar();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 500);
