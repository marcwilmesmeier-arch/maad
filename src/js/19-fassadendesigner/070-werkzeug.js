// ---- Werkzeug „Geschoss“: Fläche einer Flucht über ein Geschoss direkt wählbar (Trennung wird automatisch an den Geschossgrenzen angelegt)
function fdStoreys(b) {
  const u = ugN(b),
    r = [0];
  let z = 0;
  for (let i = u; i < b.levels.length; i++) {
    z += b.levels[i].h;
    r.push(z);
  }
  return r;
}
function fdBandU(f, v0, v1) {
  let a = 1e9,
    c = -1e9;
  const R = f.o,
    n = R.length,
    add = (u) => {
      a = Math.min(a, u);
      c = Math.max(c, u);
    };
  R.forEach((p, i) => {
    const q = R[(i + 1) % n];
    if (p[1] >= v0 - 1e-6 && p[1] <= v1 + 1e-6) add(p[0]);
    [v0, v1].forEach((y) => {
      if ((p[1] - y) * (q[1] - y) < 0) add(p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]));
    });
  });
  return c > a ? [a, c] : null;
}
function fdStoreyRect(b, V, p) {
  try {
    const i = fdHitFace(b, V, p.x, p.z);
    if (i < 0) return null;
    const f = fdFaces(b, V)[i],
      B = fdStoreys(b);
    let k = -1;
    for (let j = 0; j < B.length - 1; j++)
      if (p.z >= B[j] && p.z <= B[j + 1]) {
        k = j;
        break;
      }
    if (k < 0) return null;
    const v0 = B[k],
      v1 = B[k + 1],
      u = fdBandU(f, v0, v1);
    if (!u) return null;
    let fv0 = 1e9,
      fv1 = -1e9;
    f.o.forEach((q) => {
      fv0 = Math.min(fv0, q[1]);
      fv1 = Math.max(fv1, q[1]);
    });
    const single = fv0 >= v0 - 0.02 && fv1 <= v1 + 0.02;
    return { i, u0: u[0], u1: u[1], v0: single ? fv0 : v0, v1: single ? fv1 : Math.min(v1, fv1), single };
  } catch (e) {
    return null;
  }
}
function fdStorey(b, V, p) {
  const r = fdStoreyRect(b, V, p);
  if (!r) {
    fdNote('Hier liegt kein Geschoss mit Fläche (Dach/Giebel: Rechteck nutzen).');
    return;
  }
  const add = FDS.shift || false;
  if (r.single) {
    FDS.selCut = null;
    FDS.sel = add && FDS.sel.indexOf(r.i) < 0 ? FDS.sel.concat(r.i) : add ? FDS.sel : [r.i];
    FDS.ps = '';
    FDS.dirty = 1;
    return;
  }
  const um = (r.u0 + r.u1) / 2,
    vm = (r.v0 + r.v1) / 2,
    keep = add ? fdSelFaces().map((f) => [f.c[0], f.c[1]]) : [];
  fdAddArea([
    [r.u0, r.v0],
    [r.u1, r.v0],
    [r.u1, r.v1],
    [r.u0, r.v1],
  ]);
  const b2 = fdB(),
    V2 = fdCurV();
  if (!b2 || !V2) return;
  const F = fdFaces(b2, V2),
    idx = [];
  keep.concat([[um, vm]]).forEach((q) => {
    const j = F.findIndex((f) => grInFace(f, q[0], q[1]));
    if (j >= 0 && idx.indexOf(j) < 0) idx.push(j);
  });
  FDS.selCut = null;
  FDS.sel = idx;
  FDS.ps = '';
  FDS.dirty = 1;
}
