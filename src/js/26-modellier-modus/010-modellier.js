/* v450 Modellier-Modellierung (opt-in, Schalter „Modellier“ in der 3D-Ansicht). Ohne Schalter bleibt die bisherige Bedienung unverändert.
   Stufe 1: Auswahl wie Modellier – Klick = Fläche, Doppelklick = Fläche in einer Flucht über alle Geschosse, Dreifachklick = ganzes Gebäude,
   Shift = umschalten, Strg = hinzufügen, Strg+Shift = abziehen, Shift+Ziehen = Fenster (links→rechts: komplett enthalten, rechts→links: berührt),
   Strg+A = alles, Esc/Klick ins Leere = Auswahl aufheben. */
var SK = {
  on: false,
  tool: 's',
  sel: [],
  hv: null,
  clk: { t: 0, x: 0, y: 0, n: 0 },
  win: null,
  op: null,
  key: '',
  ver: 0,
};
SK.on = true;
function mdlHit() {
  return rc.intersectObjects(
    G.nb.children.flatMap((g) => g.children.filter((o) => o.isMesh)),
    false,
  )[0];
}
function mdlEdge(b, k, pt) {
  const f = lf(b, b.levels[k]);
  let bi = -1,
    bd = 1e9;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05) return;
    const d = proj([pt.x, pt.z], a, c).d;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return bi;
}
function mdlGroup(b, k, i) {
  const L = b.levels,
    f0 = lf(b, L[k]),
    a = f0[i],
    c = f0[(i + 1) % f0.length],
    len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1,
    ex = (c[0] - a[0]) / len,
    ez = (c[1] - a[1]) / len,
    out = [];
  L.forEach((l, j) => {
    const f = lf(b, l),
      m = f.length;
    for (let q = 0; q < m; q++) {
      const p = f[q],
        r = f[(q + 1) % m],
        dx = r[0] - p[0],
        dz = r[1] - p[1],
        dl = Math.hypot(dx, dz);
      if (dl < 0.05) continue;
      if (dx * ex + dz * ez < dl * 0.9998) continue;
      const d1 = Math.abs((p[0] - a[0]) * ez - (p[1] - a[1]) * ex),
        d2 = Math.abs((r[0] - a[0]) * ez - (r[1] - a[1]) * ex);
      if (d1 > 0.1 || d2 > 0.1) continue;
      out.push({ j, i: q });
    }
  });
  if (!out.some((g) => g.j === k && g.i === i)) out.push({ j: k, i });
  return out;
}
const SKT = [
  ['s', 'Auswahl', '␣'],
  ['p', 'Ziehen & Schieben', 'P'],
  ['m', 'Verschieben', 'M'],
  ['l', 'Teilen', 'L'],
];
function skAct() {
  return (
    SK.on &&
    (S.tool === 'v' || S.tool === 'b') &&
    !(typeof HOME !== 'undefined' && HOME.open) &&
    (S.bld.length > 0 || SK.used || (typeof SKS !== 'undefined' && SKS.e.length > 0))
  );
}
function skLs(b) {
  return b.levels.map((l) => lf(b, l));
}
function skZ(b, j) {
  let z = b._y;
  for (let q = 0; q < j; q++) z += b.levels[q].h;
  return z;
}
function skKey(e) {
  return e.b.id + '|' + e.j + '|' + (e.top ? 't' : e.i);
}
function skValid(e) {
  const b = e.b;
  if (!b || b.ex || !S.bld.includes(b) || !b.levels[e.j]) return false;
  if (e.top) return true;
  return e.i < lf(b, b.levels[e.j]).length;
}
// Außennormale einer Wandkante (x,z)
function skN(b, j, i) {
  const f = lf(b, b.levels[j]),
    m = f.length;
  let A = 0;
  for (let q = 0; q < m; q++) {
    const p = f[q],
      r = f[(q + 1) % m];
    A += p[0] * r[1] - r[0] * p[1];
  }
  const a = f[i],
    c = f[(i + 1) % m],
    dx = c[0] - a[0],
    dz = c[1] - a[1],
    L = Math.hypot(dx, dz) || 1;
  return A > 0 ? [dz / L, -dx / L] : [-dz / L, dx / L];
}
function skHit(e) {
  ray(e);
  const hit = mdlHit();
  if (!hit) return null;
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (!b || b.ex || !S.bld.includes(b)) return null;
  const ny = hit.face.normal.y;
  if (k != null && Math.abs(ny) < 0.3) {
    const i = mdlEdge(b, k, hit.point);
    return i < 0 ? null : { b, j: k, i };
  }
  if (o.userData.roof) return { b, j: b.levels.length - 1, top: 1 };
  if (k != null && ny > 0.7) return { b, j: k, top: 1 };
  return null;
}
function skGroup(en) {
  if (en.top) return [en];
  const b = en.b,
    f0 = lf(b, b.levels[en.j]),
    a = f0[en.i],
    c = f0[(en.i + 1) % f0.length],
    len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1,
    ux = (c[0] - a[0]) / len,
    uz = (c[1] - a[1]) / len;
  return mdlGroup(b, en.j, en.i)
    .filter((g) => {
      if (g.j === en.j && g.i === en.i) return true;
      const f = lf(b, b.levels[g.j]),
        p = f[g.i],
        q = f[(g.i + 1) % f.length];
      let t0 = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz,
        t1 = (q[0] - a[0]) * ux + (q[1] - a[1]) * uz;
      if (t0 > t1) {
        const x = t0;
        t0 = t1;
        t1 = x;
      }
      return Math.min(t1, len) - Math.max(t0, 0) > 0.05;
    })
    .map((g) => ({ b, j: g.j, i: g.i }));
}
function skBld(b) {
  const out = [];
  b.levels.forEach((l, j) => {
    const f = lf(b, l),
      m = f.length;
    for (let i = 0; i < m; i++) {
      const p = f[i],
        q = f[(i + 1) % m];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05) out.push({ b, j, i });
    }
  });
  out.push({ b, j: b.levels.length - 1, top: 1 });
  return out;
}
function skAll() {
  return S.bld.filter((b) => !b.ex).flatMap(skBld);
}
function skWhole(b) {
  const have = new Set(SK.sel.map(skKey));
  return skBld(b).every((x) => have.has(skKey(x)));
}
function skHas(e) {
  const k = skKey(e);
  return SK.sel.some((x) => skKey(x) === k);
}
function skSet(list, mode) {
  // mode: 'rep' ersetzen · 'add' · 'rem' · 'tog'
  const have = new Set(SK.sel.map(skKey));
  if (mode === 'rep') {
    SK.sel = list.slice();
  } else if (mode === 'add') {
    list.forEach((e) => {
      if (!have.has(skKey(e))) {
        SK.sel.push(e);
        have.add(skKey(e));
      }
    });
  } else if (mode === 'rem') {
    const k = new Set(list.map(skKey));
    SK.sel = SK.sel.filter((e) => !k.has(skKey(e)));
  } else {
    const all = list.every((e) => have.has(skKey(e)));
    if (all) skSet(list, 'rem');
    else skSet(list, 'add');
  }
  SK.ver++;
  skSync();
}
function skMode(e) {
  return e.shiftKey && e.ctrlKey ? 'rem' : e.ctrlKey ? 'add' : e.shiftKey ? 'tog' : 'rep';
}
function skInfo() {
  const n = SK.sel.length;
  if (!n) return 'Nichts gewählt';
  const bs = new Set(SK.sel.map((e) => e.b));
  let ar = 0,
    nt = 0;
  SK.sel.forEach((e) => {
    if (e.top) {
      nt++;
      return;
    }
    const f = lf(e.b, e.b.levels[e.j]),
      p = f[e.i],
      q = f[(e.i + 1) % f.length];
    ar += Math.hypot(q[0] - p[0], q[1] - p[1]) * e.b.levels[e.j].h;
  });
  return (
    n -
    nt +
    ' Wandfläche' +
    (n - nt === 1 ? '' : 'n') +
    (nt ? ' · ' + nt + ' Dachfläche' + (nt === 1 ? '' : 'n') : '') +
    ' · ' +
    bs.size +
    ' Gebäude · ' +
    ar.toFixed(1).replace('.', ',') +
    ' m² Fassade'
  );
}
function skSync() {
  // Auswahl mit der bisherigen Gebäude-/Geschoss-Auswahl abgleichen
  SK.sel = SK.sel.filter(skValid);
  try {
    const bs = [...new Set(SK.sel.map((e) => e.b))];
    if (bs.length === 1) {
      S.sel = bs[0];
      const js = [...new Set(SK.sel.map((e) => e.j))];
      S.selF = js.length === 1 ? { b: bs[0], k: js[0], i: -1 } : null;
    } else if (bs.length > 1) {
      S.sel = bs[bs.length - 1];
      S.selF = null;
    } else S.selF = null;
    $('hud').textContent = '' + skInfo();
    H();
    hpos();
    rr();
  } catch (e) {
    logErr(e, 'skSync');
  }
}
