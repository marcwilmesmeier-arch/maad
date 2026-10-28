/* v344 Fokus-Ansicht: zeigt nur noch das Gebäude und sein Grundstück auf weißem Hintergrund. Kein Körper, keine Größeneinstellung. Ein/Aus im oberen Menü. */
const ISO3 = { on: 0, g: new T.Group(), bid: '', sig: '', saved: new Map(), clr: null };
sc.add(ISO3.g);
function iso3Target() {
  return S.sel && S.bld.includes(S.sel) && !S.sel.ex && S.sel._g
    ? S.sel
    : S.bld.find((x) => !x.ex && x._g && x._y != null) || null;
}
const iso3Ctx = () => {
  const L = [];
  [
    'terrain',
    'parcels',
    'bplan',
    'flab',
    'rnam',
    'roads',
    'green',
    'trees',
    'paths',
    'cycle',
    'water',
    'abst',
    'wms',
    'ex',
    'nb',
    'wld',
  ].forEach((k) => G[k] && L.push(G[k]));
  ['grass', 'water'].forEach((k) => FX[k] && L.push(FX[k]));
  if (typeof DR !== 'undefined' && DR.skyM) L.push(DR.skyM);
  return L;
};
function iso3Hide(o, keep) {
  if (keep) {
    let c = keep,
      anc = false;
    while (c) {
      if (c === o) {
        anc = true;
        break;
      }
      c = c.parent;
    }
    if (anc) {
      if (o === keep) return;
      o.children.forEach((ch) => iso3Hide(ch, keep));
      return;
    }
  }
  if (!ISO3.saved.has(o)) ISO3.saved.set(o, o.visible);
  o.visible = false;
}
function iso3PIP(p, x, z) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function iso3Site(bx) {
  const cx = (bx.min.x + bx.max.x) / 2,
    cz = (bx.min.z + bx.max.z) / 2,
    L = P.filter((q) => q.poly && q.poly.length > 2);
  return L.find((q) => q.site && iso3PIP(q.poly, cx, cz)) || L.find((q) => iso3PIP(q.poly, cx, cz)) || null;
}
function iso3Draw(poly) {
  while (ISO3.g.children.length) {
    const o = ISO3.g.children.pop();
    o.geometry && o.geometry.dispose();
    o.material && o.material.dispose();
  }
  if (!poly) return;
  const pts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      pts.push(new T.Vector3(x, gh(x, z) + 0.15, z));
    }
  }
  const ln = new T.LineLoop(
    new T.BufferGeometry().setFromPoints(pts),
    new T.LineBasicMaterial({ color: 0x222222 }),
  );
  ln.raycast = () => {};
  ln.frustumCulled = false;
  ISO3.g.add(ln);
  try {
    const sh = new T.Shape(poly.map((q) => new T.Vector2(q[0], -q[1]))),
      g = new T.ShapeGeometry(sh);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i),
        z = -pa.getY(i);
      pa.setXYZ(i, x, gh(x, z) + 0.05, z);
    }
    g.computeVertexNormals();
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        color: 0x9aa0a6,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
    );
    m.raycast = () => {};
    m.frustumCulled = false;
    m.renderOrder = -5;
    ISO3.g.add(m);
  } catch (e) {
    console.warn('Fokus Fläche', e);
  }
}
function iso3Clip(b) {
  // Fokus: der 3 m tiefe Gründungs-Fortsatz des EG liegt sonst durch die transparente Grundstücksfläche sichtbar wie ein Untergeschoss
  try {
    ren.localClippingEnabled = true;
    const y = b._y;
    if (y == null || !isFinite(y)) return;
    const pl = new T.Plane(new T.Vector3(0, 1, 0), -(y + 0.01));
    ISO3.cl = ISO3.cl || new Map();
    const f = (o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (!ISO3.cl.has(m)) {
          ISO3.cl.set(m, m.clippingPlanes);
        }
        m.clippingPlanes = [pl];
      });
    };
    if (b._g) b._g.traverse(f);
    if (G.un)
      G.un.children.forEach((g) => {
        if (g.userData.bid === b.id) g.traverse(f);
      });
  } catch (e) {
    console.warn('Fokus Clip', e);
  }
}
function iso3Apply(force) {
  if (!ISO3.on) return;
  const b = iso3Target();
  if (!b) return;
  iso3Clip(b);
  iso3Ctx().forEach((o) => iso3Hide(o, b._g));
  if (G.un)
    G.un.children.forEach((g) => {
      if (g.userData.bid !== b.id) iso3Hide(g);
      else if (ISO3.saved.has(g)) {
        g.visible = ISO3.saved.get(g);
        ISO3.saved.delete(g);
      }
    });
  S.bld.forEach((x) => {
    if (x._g && x !== b) {
      if (!ISO3.saved.has(x._g)) ISO3.saved.set(x._g, x._g.visible);
      x._g.visible = false;
    }
  });
  ISO3.lk = ISO3.lk || new Map();
  S.bld.forEach((x) => {
    if (x._g && x !== b)
      x._g.traverse((o) => {
        if (!ISO3.lk.has(o)) ISO3.lk.set(o, o.layers.mask);
        o.layers.set(1);
      });
  });
  if (b._g)
    b._g.traverse((o) => {
      if (ISO3.lk.has(o)) {
        o.layers.mask = ISO3.lk.get(o);
        ISO3.lk.delete(o);
      }
    });
  if (b._g && ISO3.saved.has(b._g)) {
    b._g.visible = ISO3.saved.get(b._g);
    ISO3.saved.delete(b._g);
  }
  if (ISO3.clr !== 'w') {
    ren.setClearColor(0xffffff);
    ISO3.clr = 'w';
  }
  const bx = new T.Box3().setFromObject(b._g);
  if (bx.isEmpty()) return;
  const s = iso3Site(bx),
    key = b.id + '|' + (s ? s.id + JSON.stringify(s.poly) : '-');
  if (force || key !== ISO3.sig) {
    ISO3.sig = key;
    ISO3.bid = b.id;
    iso3Draw(s ? s.poly : null);
  }
  iso3Ui();
}
function iso3Off() {
  if (ISO3.cl) {
    ISO3.cl.forEach((v, m) => {
      m.clippingPlanes = v || null;
    });
    ISO3.cl.clear();
  }
  if (ISO3.lk) {
    ISO3.lk.forEach((m, o) => {
      o.layers.mask = m;
    });
    ISO3.lk.clear();
  }
  ISO3.saved.forEach((v, o) => {
    o.visible = v;
  });
  ISO3.saved.clear();
  ISO3.clr = null;
  try {
    ren.setClearColor(new T.Color(KONsky.c || '#f8f7f4'));
  } catch (_) {
    ren.setClearColor(0xf8f7f4);
  }
  while (ISO3.g.children.length) {
    const o = ISO3.g.children.pop();
    o.geometry && o.geometry.dispose();
    o.material && o.material.dispose();
  }
  ISO3.sig = '';
  iso3Ui();
}
function iso3Ui() {
  const b = document.getElementById('isoB');
  if (!b) return;
  b.classList.toggle('on', !!ISO3.on);
}
function iso3Fly() {
  const b = iso3Target();
  if (!b || !b._g) return;
  const bx = new T.Box3().setFromObject(b._g);
  if (bx.isEmpty()) return;
  const s = iso3Site(bx);
  let x0 = bx.min.x,
    x1 = bx.max.x,
    z0 = bx.min.z,
    z1 = bx.max.z;
  if (s) {
    s.poly.forEach((q) => {
      x0 = Math.min(x0, q[0]);
      x1 = Math.max(x1, q[0]);
      z0 = Math.min(z0, q[1]);
      z1 = Math.max(z1, q[1]);
    });
  }
  const tx = (x0 + x1) / 2,
    tz = (z0 + z1) / 2,
    ext = Math.max(x1 - x0, z1 - z0),
    td = Math.max(60, ext * 1.5),
    f = { tx: V.tx, tz: V.tz, d: V.d },
    t0 = performance.now(),
    id = ++ISO3.fly;
  S.vanim = null;
  if (!S.m3) {
    V.tx = tx;
    V.tz = tz;
    return;
  }
  const st = () => {
    if (id !== ISO3.fly) return;
    const k = Math.min(1, (performance.now() - t0) / 800),
      e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    V.tx = f.tx + (tx - f.tx) * e;
    V.tz = f.tz + (tz - f.tz) * e;
    V.d = Math.exp(Math.log(f.d) + (Math.log(td) - Math.log(f.d)) * e);
    if (k < 1) requestAnimationFrame(st);
  };
  requestAnimationFrame(st);
}
ISO3.fly = 0;
const ISO3F = {
  set: (v) => {
    v = v ? 1 : 0;
    if (v === ISO3.on) return;
    ISO3.on = v;
    if (v) {
      iso3Apply(true);
      iso3Fly();
    } else iso3Off();
    iso3Ui();
  },
  main: () => ISO3F.set(ISO3.on ? 0 : 1),
};
{
  const vc = document.getElementById('vc');
  if (vc && !document.getElementById('isoB')) {
    const b = document.createElement('button');
    b.className = 'bt';
    b.id = 'isoB';
    b.setAttribute('onclick', 'ISO3F.main()');
    b.setAttribute('aria-label', 'Fokus');
    b.dataset.th = '1';
    b.dataset.tip = 'Fokus-Ansicht: nur Gebäude und Grundstück auf weißem Hintergrund';
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="3"/></svg>';
    const c = document.getElementById('bcam');
    vc.insertBefore(b, c || null);
  }
}
setInterval(() => {
  try {
    if (ISO3.on) iso3Apply(false);
  } catch (e) {
    console.warn('Fokus', e);
  }
}, 400);
{
  const _gp = geoPick;
  geoPick = function () {
    return ISO3.on ? null : _gp.apply(this, arguments);
  };
  const _tp = treePick;
  treePick = function () {
    return ISO3.on ? null : _tp.apply(this, arguments);
  };
}
