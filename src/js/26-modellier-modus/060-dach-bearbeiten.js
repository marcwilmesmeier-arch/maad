/* v460 Dach bearbeiten (Modellier-Modus) – echte Geschosse und Innenhöfe
   R Rechteck / Z Polygon: Fläche auf das Dach zeichnen (Dachfläche des obersten Geschosses oder eines Rücksprungs).
   L auf dem Dach: Dachfläche bzw. gezeichnete Fläche mit einer Linie teilen.
   P Ziehen & Schieben auf der gezeichneten Fläche: HOCH = echte Geschosse mit diesem Grundriss (eigene Geschossnummern), RUNTER = Innenhof, aus den Geschossen ausgeschnitten.
   Innenhof: Wandflächen zum Hof greifen und ziehen (Hof wird kleiner/größer), Boden greifen = Tiefe ändern, M verschiebt, Entf füllt wieder.
   Beim Aufstocken des Gebäudes laufen die Höfe nach oben mit. Datenmodell siehe gr_zn.js (b.voids, l.faces). */
var SZ = { d: null, op: null };
SKT.push(['r', 'Rechteck', 'R'], ['z', 'Linie', 'L']);
function szSp(e) {
  return !!e && (e.face != null || e.vd != null);
}
function szObj(e) {
  if (!e || !e.b) return null;
  if (e.face != null) {
    const l = e.b.levels[e.j];
    return (l && l.faces && l.faces[e.face]) || null;
  }
  if (e.vd != null) return (e.b.voids || [])[e.vd] || null;
  return null;
}
function szTop(b, j) {
  return skZ(b, j) + b.levels[j].h;
}
function szMsg(t) {
  try {
    $('hud').textContent = t;
  } catch (e) {
    logErr(e, 'szMsg');
  }
}
function szF(v) {
  return f1(v, 2).replace('.', ',');
}
function szA(poly) {
  return Math.abs(skArea(poly));
}
function szFlat(b, j) {
  return !(j === b.levels.length - 1 && b.roof && b.roof.type && b.roof.type !== 'flat');
}
function szDist(p, poly) {
  let bd = 1e9;
  poly.forEach((a, i) => {
    const c = poly[(i + 1) % poly.length],
      ex = c[0] - a[0],
      ez = c[1] - a[1],
      L2 = ex * ex + ez * ez;
    let t = L2 < 1e-12 ? 0 : ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2;
    t = Math.max(0, Math.min(1, t));
    bd = Math.min(bd, Math.hypot(a[0] + ex * t - p[0], a[1] + ez * t - p[1]));
  });
  return bd;
}
function szNearEdge(p, poly) {
  let bd = 1e9,
    bi = 0;
  poly.forEach((a, i) => {
    const c = poly[(i + 1) % poly.length],
      ex = c[0] - a[0],
      ez = c[1] - a[1],
      L2 = ex * ex + ez * ez;
    let t = L2 < 1e-12 ? 0 : ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(a[0] + ex * t - p[0], a[1] + ez * t - p[1]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi;
}
// Normale zum Hof hin (aus dem Baukörper heraus) einer Hofwand
function szNin(poly, i) {
  const m = poly.length;
  let A = 0;
  for (let q = 0; q < m; q++) {
    const p = poly[q],
      r = poly[(q + 1) % m];
    A += p[0] * r[1] - r[0] * p[1];
  }
  const a = poly[i],
    c = poly[(i + 1) % m],
    dx = c[0] - a[0],
    dz = c[1] - a[1],
    L = Math.hypot(dx, dz) || 1;
  return A > 0 ? [-dz / L, dx / L] : [dz / L, -dx / L];
}
// ---- Einbindung in die Auswahl
{
  const _v = skValid;
  skValid = function (e) {
    if (szSp(e)) {
      const b = e.b;
      return !!b && !b.ex && S.bld.includes(b) && !!szObj(e) && (e.i == null || e.i < szObj(e).poly.length);
    }
    return _v(e);
  };
}
{
  const _k = skKey;
  skKey = function (e) {
    if (e.face != null) return e.b.id + '|' + e.j + '|f' + e.face;
    if (e.vd != null) return e.b.id + '|v' + e.vd + '|' + (e.floor ? 'b' : e.i);
    return _k(e);
  };
}
{
  const _g = skGroup;
  skGroup = function (e) {
    return szSp(e) ? [e] : _g(e);
  };
}
{
  const _i = skInferHover;
  skInferHover = function (e) {
    if (SK.hv && szSp(SK.hv)) {
      try {
        skMkEl().style.display = 'none';
        skTip('', null);
      } catch (e) {
        logErr(e, 'skInferHover');
      }
      return;
    }
    return _i.apply(this, arguments);
  };
}
{
  const _s = skInfo;
  skInfo = function () {
    const sp = SK.sel.filter(szSp);
    if (!sp.length) return _s();
    const all = SK.sel;
    SK.sel = all.filter((x) => !szSp(x));
    const base = SK.sel.length ? _s() + ' · ' : '';
    SK.sel = all;
    const fa = sp.filter((e) => e.face != null),
      vd = sp.filter((e) => e.vd != null);
    let t = [];
    if (fa.length)
      t.push(
        fa.length +
          ' Dachfläche' +
          (fa.length === 1 ? '' : 'n') +
          ' (gezeichnet) · ' +
          fa
            .reduce((s, e) => s + (szObj(e) ? szA(szObj(e).poly) : 0), 0)
            .toFixed(1)
            .replace('.', ',') +
          ' m²',
      );
    if (vd.length) {
      const v = szObj(vd[0]);
      t.push(
        'Innenhof' +
          (vd.length > 1 ? ' (' + vd.length + ' Flächen)' : '') +
          (v
            ? ' · ' +
              szA(v.poly).toFixed(1).replace('.', ',') +
              ' m² · Ebene ' +
              (v.j0 + 1) +
              '–' +
              (v.j1 + 1)
            : ''),
      );
    }
    return base + t.join(' · ') + ' · Entf = löschen';
  };
}
{
  const _h = skHit;
  skHit = function (e) {
    ray(e);
    const h = mdlHit();
    if (h) {
      const o = h.object,
        b = o.userData.b,
        k = o.userData.k;
      if (b && !b.ex && S.bld.includes(b)) {
        if (o.userData.face != null) return { b, j: k, face: o.userData.face };
        const vs = b.voids || [],
          p = [h.point.x, h.point.z],
          ny = h.face.normal.y;
        if (k != null && Math.abs(ny) < 0.3) {
          for (let i = 0; i < vs.length; i++) {
            const v = vs[i];
            if (k >= v.j0 && k <= v.j1 && szDist(p, v.poly) < 0.15)
              return { b, j: v.j1, vd: i, i: szNearEdge(p, v.poly) };
          }
        }
        if (k != null && ny > 0.7) {
          for (let i = 0; i < vs.length; i++) {
            const v = vs[i];
            if (v.j0 > 0 && k === v.j0 - 1 && znInP(p, v.poly)) return { b, j: k, vd: i, floor: 1 };
          }
        }
      }
    }
    return _h.apply(this, arguments);
  };
}
function szQuads(ents, col, op, line) {
  const pos = [],
    lp = [];
  ents.forEach((e) => {
    if (!skValid(e)) return;
    const o = szObj(e),
      b = e.b,
      poly = o.poly,
      m = poly.length;
    if (e.face != null) {
      const y = szTop(b, e.j) + 0.07;
      T.ShapeUtils.triangulateShape(
        poly.map((p) => new T.Vector2(p[0], p[1])),
        [],
      ).forEach((t) => t.forEach((q) => pos.push(poly[q][0], y, poly[q][1])));
      for (let i = 0; i < m; i++) {
        const a = poly[i],
          c = poly[(i + 1) % m];
        lp.push(a[0], y, a[1], c[0], y, c[1]);
      }
      return;
    }
    const y0 = skZ(b, o.j0),
      y1 = szTop(b, o.j1);
    if (e.floor) {
      T.ShapeUtils.triangulateShape(
        poly.map((p) => new T.Vector2(p[0], p[1])),
        [],
      ).forEach((t) => t.forEach((q) => pos.push(poly[q][0], y0 + 0.03, poly[q][1])));
      for (let i = 0; i < m; i++) {
        const a = poly[i],
          c = poly[(i + 1) % m];
        lp.push(a[0], y0 + 0.03, a[1], c[0], y0 + 0.03, c[1]);
      }
      return;
    }
    const a = poly[e.i],
      c = poly[(e.i + 1) % m];
    pos.push(a[0], y0, a[1], c[0], y0, c[1], c[0], y1, c[1], a[0], y0, a[1], c[0], y1, c[1], a[0], y1, a[1]);
    lp.push(
      a[0],
      y0,
      a[1],
      c[0],
      y0,
      c[1],
      c[0],
      y0,
      c[1],
      c[0],
      y1,
      c[1],
      c[0],
      y1,
      c[1],
      a[0],
      y1,
      a[1],
      a[0],
      y1,
      a[1],
      a[0],
      y0,
      a[1],
    );
  });
  const out = [];
  if (pos.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
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
    out.push(me);
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
    out.push(ln);
  }
  return out;
}
{
  const _q = skQuads;
  skQuads = function (ents, col, op, line) {
    const o = _q(
        ents.filter((e) => !szSp(e)),
        col,
        op,
        line,
      ),
      sp = ents.filter(szSp);
    if (sp.length) szQuads(sp, col, op, line).forEach((x) => o.push(x));
    return o;
  };
}
