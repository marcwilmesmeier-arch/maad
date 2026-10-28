// ---- v325: Explosionsansicht – bei „Einheiten“ ziehen die letzten 20 % des Reglers die einzelnen Einheiten seitlich auseinander
const EXS = { a: 0.8 };
function exSpreadK() {
  const t = Math.max(0, Math.min(1, (S.expl.cur - 1) / 14));
  return S.zo && S.zo.m === 'u' ? Math.max(0, Math.min(1, (t - EXS.a) / (1 - EXS.a))) : 0;
}
function exSpread() {
  const s = exSpreadK();
  G.un.children.forEach((g) => {
    const U = new Map();
    g.children.forEach((lg) =>
      lg.children.forEach((o) => {
        const u = o.userData.u;
        if (!u) return;
        let e = U.get(u);
        if (!e) {
          e = { u, os: [] };
          U.set(u, e);
        }
        e.os.push(o);
      }),
    );
    if (!U.size) return;
    if (!g.userData.bc || g.userData.bcN !== U.size) {
      let sx = 0,
        sz = 0,
        n = 0;
      U.forEach((e) => {
        const m = e.os.find((o) => o.isMesh);
        if (!m) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox;
        e.u._c = [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2];
        sx += e.u._c[0];
        sz += e.u._c[1];
        n++;
      });
      g.userData.bc = n ? [sx / n, sz / n] : [0, 0];
      g.userData.bcN = U.size;
    }
    const bc = g.userData.bc;
    let i = 0;
    U.forEach((e) => {
      i++;
      const c = e.u._c;
      if (!c) return;
      let dx = c[0] - bc[0],
        dz = c[1] - bc[1],
        L = Math.hypot(dx, dz);
      if (L < 0.4) {
        const a = (i * 2.399963) % (Math.PI * 2);
        dx = Math.cos(a);
        dz = Math.sin(a);
        L = 1;
      }
      const off = s * (L * 0.5 + 3.2),
        ox = (dx / L) * off,
        oz = (dz / L) * off;
      e.os.forEach((o) => {
        o.position.x = ox;
        o.position.z = oz;
      });
    });
  });
}
// exApply(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
// zoMode(): Erweiterung zusammengeführt, siehe 15-grundriss/050-isolieren.js
// exGap(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
function exSpreadKRaw(v) {
  return Math.max(0, Math.min(1, (v - 1) / 14));
}
// tgExp(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
