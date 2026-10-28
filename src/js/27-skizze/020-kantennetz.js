// ---- Kantennetz: alle Kanten an Schnitt- und Berührpunkten teilen, doppelte entfernen
function sksNorm(segs) {
  const L = segs.filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > SKS_TOL);
  const n = L.length;
  const pts = [];
  L.forEach((s) => {
    pts.push(s.a, s.b);
  });
  const cuts = L.map(() => []);
  for (let i = 0; i < n; i++) {
    const s = L[i],
      dx = s.b[0] - s.a[0],
      dz = s.b[1] - s.a[1],
      L2 = dx * dx + dz * dz,
      Lg = Math.sqrt(L2);
    for (const p of pts) {
      const t = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / L2;
      if (t <= SKS_TOL / Lg || t >= 1 - SKS_TOL / Lg) continue;
      if (Math.hypot(s.a[0] + dx * t - p[0], s.a[1] + dz * t - p[1]) < SKS_TOL) cuts[i].push(t);
    }
    for (let j = i + 1; j < n; j++) {
      const u = L[j],
        ex = u.b[0] - u.a[0],
        ez = u.b[1] - u.a[1],
        den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((u.a[0] - s.a[0]) * ez - (u.a[1] - s.a[1]) * ex) / den,
        w = ((u.a[0] - s.a[0]) * dz - (u.a[1] - s.a[1]) * dx) / den;
      if (t > 1e-9 && t < 1 - 1e-9 && w > 1e-9 && w < 1 - 1e-9) {
        cuts[i].push(t);
        cuts[j].push(w);
      }
    }
  }
  const nodes = [];
  const nid = (p) => {
    for (let k = 0; k < nodes.length; k++)
      if (Math.hypot(nodes[k][0] - p[0], nodes[k][1] - p[1]) < 2 * SKS_TOL) return k;
    nodes.push([p[0], p[1]]);
    return nodes.length - 1;
  };
  const seen = new Map(),
    out = [];
  L.forEach((s, i) => {
    const ts = [0].concat(
      cuts[i].sort((a, b) => a - b),
      [1],
    );
    let prev = nid(s.a);
    for (let k = 1; k < ts.length; k++) {
      const t = ts[k],
        cur =
          k === ts.length - 1
            ? nid(s.b)
            : nid([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
      if (cur !== prev) {
        const a = Math.min(prev, cur),
          b = Math.max(prev, cur),
          key = a + '|' + b;
        if (!seen.has(key)) {
          seen.set(key, 1);
          out.push({ a: nodes[prev], b: nodes[cur], c: s.c || 0 });
        }
      }
      prev = cur;
    }
  });
  return out;
}
// ---- Flächen aus dem Kantennetz (geschlossene Linienzüge)
function sksFaces(E) {
  const nodes = [],
    idx = new Map(),
    key = (p) => Math.round(p[0] * 1000) + '|' + Math.round(p[1] * 1000);
  const nid = (p) => {
    const k = key(p);
    let v = idx.get(k);
    if (v == null) {
      v = nodes.length;
      nodes.push([p[0], p[1]]);
      idx.set(k, v);
    }
    return v;
  };
  const ed = E.map((e) => [nid(e.a), nid(e.b)]);
  const N = nodes.length;
  // lose Enden (Grad 1) wiederholt entfernen
  const alive = ed.map(() => true),
    deg = new Array(N).fill(0);
  ed.forEach(([a, b]) => {
    deg[a]++;
    deg[b]++;
  });
  for (let ch = true; ch;) {
    ch = false;
    ed.forEach(([a, b], i) => {
      if (alive[i] && (deg[a] < 2 || deg[b] < 2)) {
        alive[i] = false;
        deg[a]--;
        deg[b]--;
        ch = true;
      }
    });
  }
  const A = Array.from({ length: N }, () => []);
  ed.forEach(([a, b], i) => {
    if (!alive[i]) return;
    A[a].push({ to: b, e: i });
    A[b].push({ to: a, e: i });
  });
  A.forEach((l, v) => {
    l.forEach((h) => {
      h.ang = Math.atan2(nodes[h.to][1] - nodes[v][1], nodes[h.to][0] - nodes[v][0]);
    });
    l.sort((x, y) => x.ang - y.ang);
  });
  const used = new Set(),
    cyc = [];
  const hid = (e, from) => e * 2 + (ed[e][0] === from ? 0 : 1);
  for (let i = 0; i < ed.length; i++) {
    if (!alive[i]) continue;
    for (const dir of [0, 1]) {
      const start = i * 2 + dir;
      if (used.has(start)) continue;
      let e = i,
        u = dir ? ed[i][1] : ed[i][0],
        v = dir ? ed[i][0] : ed[i][1],
        g = 0;
      const ring = [],
        es = [];
      while (g++ < 20000) {
        used.add(hid(e, u));
        ring.push(nodes[u]);
        es.push(e);
        const l = A[v],
          k = l.findIndex((h) => h.e === e);
        const nx = l[(k - 1 + l.length) % l.length];
        u = v;
        v = nx.to;
        e = nx.e;
        if (hid(e, u) === start) break;
      }
      cyc.push({ ring, es });
    }
  }
  const sa = (r) => {
    let s = 0;
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return s / 2;
  };
  const comp = Array.from({ length: N }, (_, i) => i),
    fd = (x) => {
      while (comp[x] !== x) {
        comp[x] = comp[comp[x]];
        x = comp[x];
      }
      return x;
    };
  ed.forEach(([a, b], i) => {
    if (alive[i]) comp[fd(a)] = fd(b);
  });
  const faces = [],
    outers = [];
  cyc.forEach((c) => {
    const a = sa(c.ring);
    if (Math.abs(a) < 1e-6) return;
    const cm = fd(idx.get(key(c.ring[0])));
    if (a > 0)
      faces.push({ o: c.ring.map((q) => [q[0], q[1]]), h: [], es: new Set(c.es), ea: new Set(c.es), cm });
    else outers.push({ ring: c.ring, cm, es: c.es });
  });
  outers.forEach((O) => {
    let best = null,
      ba = 1e18;
    faces.forEach((F) => {
      if (F.cm === O.cm) return;
      if (bpIn(O.ring[0], { o: F.o, h: [] })) {
        const ar = boolArea([{ o: F.o, h: [] }]);
        if (ar < ba) {
          ba = ar;
          best = F;
        }
      }
    });
    if (best) {
      best.h.push(O.ring.map((q) => [q[0], q[1]]));
      O.es.forEach((k) => best.ea.add(k));
    }
  });
  faces.forEach((F) => {
    F.area = boolArea([{ o: F.o, h: F.h }]);
  });
  return faces;
}
function sksChanged() {
  SKS.fc = null;
  if (SKS.hide.length) {
    const all = new Set(sksFaces(SKS.e).map((F) => sksSig(F.o)));
    SKS.hide = SKS.hide.filter((g) => all.has(g));
  }
  SKS.hv = null;
  SKS.sel = SKS.sel.filter((s) => s.k === 'e' && SKS.e[s.i]);
  try {
    sksRedraw();
  } catch (x) {
    console.warn('sksRedraw', x);
  }
}
function sksFacesNow() {
  if (!SKS.fc) SKS.fc = sksFaces(SKS.e).filter((F) => !SKS.hide.includes(sksSig(F.o)));
  return SKS.fc;
}
// ---- Anzeige
const SKSG = new T.Group();
SKSG.renderOrder = 8;
SKSG.visible = true;
sc.add(SKSG);
const sksFM = new T.MeshBasicMaterial({
  color: 0x9cc3e6,
  transparent: true,
  opacity: 0.5,
  side: T.DoubleSide,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const sksLM = new T.LineBasicMaterial({ color: 0x2b2b2b, depthTest: true, transparent: true });
const sksHM = new T.LineBasicMaterial({ color: 0xe08a00, depthTest: false, transparent: true });
const sksSM = new T.LineBasicMaterial({ color: 0x1f6fd1, depthTest: false, transparent: true });
const sksSF = new T.MeshBasicMaterial({
  color: 0x4f9be8,
  transparent: true,
  opacity: 0.55,
  side: T.DoubleSide,
  depthWrite: false,
  depthTest: false,
});
function sksY(p) {
  return gh(p[0], p[1]) + 0.15;
}
function sksLines(list) {
  const pos = [];
  list.forEach((e) => {
    pos.push(e.a[0], sksY(e.a), e.a[1], e.b[0], sksY(e.b), e.b[1]);
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  return g;
}
function sksFaceGeo(F) {
  const c = F.o.map((q) => new T.Vector2(q[0], q[1])),
    hs = F.h.map((h) => h.map((q) => new T.Vector2(q[0], q[1])));
  const all = c.concat(...hs);
  let tr;
  try {
    tr = T.ShapeUtils.triangulateShape(c, hs);
  } catch (_) {
    return null;
  }
  const pos = [];
  tr.forEach((t) =>
    t.forEach((i) => {
      const p = all[i];
      pos.push(p.x, gh(p.x, p.y) + 0.1, p.y);
    }),
  );
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  return g;
}
function sksRedraw() {
  // ── Erweiterung aus 27-skizze/070-skizze.js
  _sksRedraw2.apply(this, arguments);
  try {
    const fs = sksFacesNow(),
      ids = new Set();
    SKS.sel.forEach((s) => {
      if (s.k === 'e') ids.add(s.i);
      else if (s.k === 'f' && fs[s.f]) fs[s.f].es.forEach((k) => ids.add(k));
    });
    if (SKS.hv) {
      if (SKS.hv.k === 'e') ids.add(SKS.hv.i);
      else if (SKS.hv.k === 'f' && fs[SKS.hv.f]) fs[SKS.hv.f].es.forEach((k) => ids.add(k));
    }
    const seen = new Set(),
      pos = [];
    ids.forEach((i) => {
      const s = SKS.e[i];
      if (!s) return;
      [s.a, s.b].forEach((q) => {
        const k = Math.round(q[0] * 500) + ',' + Math.round(q[1] * 500);
        if (seen.has(k)) return;
        seen.add(k);
        pos.push(q[0], sksY(q) + 0.15, q[1]);
      });
    });
    if (pos.length) {
      SKSG.add(sknPts(pos, sknDM));
    }
    rr();
  } catch (e) {
    logErr(e, 'sksRedraw');
  }
}
// sksRedraw() ohne die Erweiterungen darüber – wird von sksRedraw() gezielt aufgerufen
function _sksRedraw2() {
  // ── Erweiterung aus 27-skizze/070-skizze.js
  _sksRedrawOld.apply(this, arguments);
  try {
    [SKN.hv && [SKN.hv, sknHM], SKN.sel && [SKN.sel, sknSM]].forEach((x) => {
      if (x) SKSG.add(sknPts([x[0][0], sksY(x[0]) + 0.2, x[0][1]], x[1]));
    });
    rr();
  } catch (e) {
    logErr(e, 'sksRedraw');
  }
}
// sksRedraw() ohne die Erweiterungen darüber – wird von sksRedraw() gezielt aufgerufen
function _sksRedrawOld() {
  while (SKSG.children.length) {
    const o = SKSG.children.pop();
    o.geometry && o.geometry.dispose();
  }
  if (!SKS.e.length) {
    return;
  }
  const ln = new T.LineSegments(sksLines(SKS.e), sksLM);
  ln.raycast = () => {};
  ln.renderOrder = 8;
  ln.frustumCulled = false;
  SKSG.add(ln);
  const fs = sksFacesNow();
  fs.forEach((F, i) => {
    const g = sksFaceGeo(F);
    if (!g) return;
    const sel = SKS.sel.some((s) => s.k === 'f' && s.f === i),
      m = new T.Mesh(g, sel ? sksSF : sksFM);
    m.raycast = () => {};
    m.renderOrder = 7;
    m.frustumCulled = false;
    SKSG.add(m);
  });
  const se = [],
    he = [];
  const grp = (i) => [i];
  SKS.sel.forEach((s) => {
    if (s.k === 'e') grp(s.i).forEach((k) => se.push(SKS.e[k]));
    else if (s.k === 'f') {
      const F = fs[s.f];
      if (F) F.es.forEach((k) => se.push(SKS.e[k]));
    }
  });
  if (SKS.hv) {
    if (SKS.hv.k === 'e') grp(SKS.hv.i).forEach((k) => he.push(SKS.e[k]));
    else if (SKS.hv.k === 'f' && fs[SKS.hv.f]) fs[SKS.hv.f].es.forEach((k) => he.push(SKS.e[k]));
  }
  if (se.length) {
    const l = new T.LineSegments(sksLines(se), sksSM);
    l.raycast = () => {};
    l.renderOrder = 10;
    l.frustumCulled = false;
    SKSG.add(l);
  }
  if (he.length) {
    const l = new T.LineSegments(sksLines(he), sksHM);
    l.raycast = () => {};
    l.renderOrder = 10;
    l.frustumCulled = false;
    SKSG.add(l);
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'sksRedraw');
  }
}
// ---- Treffer (Gelände): Kante oder Fläche unter dem Zeiger
function sksHit(e) {
  if (!SKS.e.length) return null;
  let p;
  try {
    p = ground(e);
  } catch (_) {
    return null;
  }
  if (!p) return null;
  const tol = 8 * mpp();
  let bi = -1,
    bd = tol;
  SKS.e.forEach((s, i) => {
    const dx = s.b[0] - s.a[0],
      dz = s.b[1] - s.a[1],
      L2 = dx * dx + dz * dz;
    let t = L2 ? ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dz) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(s.a[0] + dx * t - p[0], s.a[1] + dz * t - p[1]);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  if (bi >= 0) return { k: 'e', i: bi, p };
  let bf = -1,
    ba = 1e18;
  sksFacesNow().forEach((F, i) => {
    if (bpIn(p, { o: F.o, h: F.h }) && F.area < ba) {
      ba = F.area;
      bf = i;
    }
  });
  if (bf >= 0) return { k: 'f', f: bf, p };
  return null;
}
// hist(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// undo(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// projExtra(): Erweiterung zusammengeführt, siehe 14-projekt-speicherstand/010-projekt.js
// projApplyPre(): Erweiterung zusammengeführt, siehe 14-projekt-speicherstand/010-projekt.js
