/* v332: Straßenwahl nach Länge, große Straßen (Breite ab 10 m) zählen 1,5-fach; Fahrzeuge verschwinden am Straßenende und erscheinen nach kurzer Pause an anderer Stelle */
function carsPick() {
  const cl = CARS.cl,
    r = Math.random() * CARS.acc;
  let k = cl.findIndex((v) => v >= r);
  return k < 0 ? 0 : k;
}
function carsVanish(c) {
  c.hid = 0.6 + Math.random() * 2.4;
  c.h = null;
}
function carsInit() {
  const N = carsNet();
  CARS.net = N;
  if (CARS.m) {
    sc.remove(CARS.m);
    CARS.m.geometry.dispose();
    CARS.m.material.dispose();
    CARS.m = null;
  }
  CARS.c = [];
  if (!N) return;
  const n = Math.max(30, Math.min(330, Math.round(N.tot / 28)));
  const m = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshLambertMaterial({ color: 0xffffff }),
    n,
  );
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = false;
  m.raycast = () => {};
  m.renderOrder = 3;
  const col = new T.Color();
  for (let i = 0; i < n; i++) {
    col.set(CARCOL[(Math.random() * CARCOL.length) | 0]);
    m.setColorAt(i, col);
  }
  m.instanceColor.needsUpdate = true;
  // Start: nach Länge gewichtet auf Straßen verteilen
  const cl = [];
  let acc = 0;
  N.P.forEach((p, i) => {
    acc += p.len * (p.w >= 10 ? 1.5 : 1);
    cl.push(acc);
  });
  CARS.cl = cl;
  CARS.acc = acc;
  for (let i = 0; i < n; i++) {
    const k = carsPick(),
      p = N.P[k];
    CARS.c.push({
      pi: k,
      s: Math.random() * p.len,
      dir: Math.random() < 0.5 ? 1 : -1,
      v: 7 + Math.random() * 7,
      h: null,
      hid: 0,
      L: ((7.6 + Math.random() * 3) / 4) * 1.5,
      W: ((3.6 + Math.random() * 0.7) / 4) * 1.5,
      H: ((2.8 + Math.random() * 1.1) / 4) * 1.5,
    });
  }
  m.visible = false;
  sc.add(m);
  CARS.m = m;
}
const _m4 = new T.Matrix4(),
  _q = new T.Quaternion(),
  _p = new T.Vector3(),
  _s = new T.Vector3(),
  _yA = new T.Vector3(0, 1, 0);
function carsUp(now) {
  const home = !!(HOME.open && GEO.acc && GEO.size),
    on = home || !!(IDLE.on && IDLE.s2 && IDLE.cf > 0.02 && S.m3 && GEO.acc);
  if (!on) {
    if (CARS.m && CARS.m.visible) CARS.m.visible = false;
    CARS.last = 0;
    return;
  }
  const sig = GEO.acc ? GEO.acc.line.roads.length + ':' + GEO.size : '';
  if (sig !== CARS.sig || !CARS.m) {
    CARS.sig = sig;
    carsInit();
  }
  if (!CARS.m) return;
  const N = CARS.net,
    dt = CARS.last ? Math.min(0.1, (now - CARS.last) / 1000) : 0.016;
  CARS.last = now;
  let cd = V.d || 500;
  try {
    const k = act();
    k.updateMatrixWorld();
    const e = k.matrixWorld.elements;
    cd = Math.hypot(e[12], e[13], e[14]);
  } catch (e) {
    logErr(e, 'carsUp');
  }
  const grow = home ? 1 : Math.max(0, Math.min(1, (IDLE.cf - 0.15) / 0.5)),
    zf = Math.max(1, Math.min(2.2, cd / 520)) * grow;
  CARS.m.visible = grow > 0.01;
  if (!CARS.m.visible) return;
  for (let i = 0; i < CARS.c.length; i++) {
    const c = CARS.c[i];
    let p = N.P[c.pi];
    c.s += c.dir * c.v * dt;
    if (c.hid > 0) {
      c.hid -= dt;
      if (c.hid <= 0) {
        c.hid = 0;
        const k = carsPick();
        c.pi = k;
        p = N.P[k];
        c.dir = Math.random() < 0.5 ? 1 : -1;
        c.s = Math.random() * p.len;
      } else {
        _p.set(0, -50, 0);
        _s.set(0, 0, 0);
        _m4.compose(_p, _q, _s);
        CARS.m.setMatrixAt(i, _m4);
        continue;
      }
    }
    if (c.s > p.len || c.s < 0) {
      carsVanish(c);
      _p.set(0, -50, 0);
      _s.set(0, 0, 0);
      _m4.compose(_p, _q, _s);
      CARS.m.setMatrixAt(i, _m4);
      continue;
    }
    let q = carsPos(p, c.s, c.dir);
    const hs = GEO.size / 2 - 3;
    if (Math.abs(q.x) > hs || Math.abs(q.z) > hs) {
      carsVanish(c);
      _p.set(0, -50, 0);
      _s.set(0, 0, 0);
      _m4.compose(_p, _q, _s);
      CARS.m.setMatrixAt(i, _m4);
      continue;
    }
    const a = Math.atan2(q.dz, q.dx);
    if (c.h == null) c.h = a;
    else {
      let d = a - c.h;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      c.h += d * Math.min(1, dt * 6);
    }
    const y = (typeof gh === 'function' ? gh(q.x, q.z) : 0) + (c.H * zf) / 2 + 0.15;
    _q.setFromAxisAngle(_yA, -c.h);
    _p.set(q.x, y, q.z);
    _s.set(c.L * zf, c.H * zf, c.W * zf);
    _m4.compose(_p, _q, _s);
    CARS.m.setMatrixAt(i, _m4);
  }
  CARS.m.instanceMatrix.needsUpdate = true;
}
{
  const _ht = homeHook;
  homeHook = function () {
    const r = _ht.apply(this, arguments);
    try {
      carsUp(performance.now());
    } catch (e) {
      console.error(e);
    }
    return r;
  };
}
