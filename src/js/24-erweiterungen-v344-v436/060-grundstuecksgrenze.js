/* v400 Grundstücksgrenze: normale Linie (1 px) in der Farbe der Grundstücksgrenze, knapp über den Flurstückslinien.
   pbWpp (Bildschirmmaßstab) nutzen auch andere Bereiche. */
const PBR = { polys: [], m: null, w: 0, px: 0 };
function pbWpp() {
  const mid = document.getElementById('mid') || ren.domElement,
    H = Math.max(200, mid.clientHeight || ren.domElement.clientHeight || 600);
  if (S.m3) {
    const D = Math.max(1, pc.position.distanceTo(new T.Vector3(V.tx, 0, V.tz)));
    return { wpp: (2 * D * Math.tan((pc.fov * Math.PI) / 360)) / H, D };
  }
  return { wpp: (oc.top - oc.bottom) / H / Math.max(0.001, oc.zoom || 1), D: V.d || 100 };
}
/** Punkte entlang eines Rings (alle 2 m) auf dem Gelände, dy über dem Boden – für Linien, die dem Gelände folgen. */
function pbLinienPunkte(poly, dy, closed = true) {
  const out = [],
    M = poly.length,
    nSeg = closed ? M : M - 1;
  for (let i = 0; i < nSeg; i++) {
    const a = poly[i],
      b = poly[(i + 1) % M],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L / 2));
    for (let j = 0; j < n; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / n,
        z = a[1] + ((b[1] - a[1]) * j) / n;
      out.push(new T.Vector3(x, gh(x, z) + dy, z));
    }
  }
  if (!closed && M)
    out.push(new T.Vector3(poly[M - 1][0], gh(poly[M - 1][0], poly[M - 1][1]) + dy, poly[M - 1][1]));
  return out;
}
// Grundstücksgrenze als normale Linie (1 px), knapp über den Flurstückslinien
function pbBuild() {
  try {
    const polys = PBR.polys;
    if (PBR.m) {
      PBR.m.parent && PBR.m.parent.remove(PBR.m);
      PBR.m.traverse((o) => o.geometry && o.geometry.dispose());
      PBR.m = null;
    }
    if (!polys.length) return;
    const g = new T.Group(),
      mt = new T.LineBasicMaterial({ color: 0x3f6b85 });
    polys.forEach((poly) => {
      if (poly.length < 3) return;
      const l = new T.LineLoop(new T.BufferGeometry().setFromPoints(pbLinienPunkte(poly, 0.5)), mt);
      l.renderOrder = 6;
      l.raycast = () => {};
      l.frustumCulled = false;
      g.add(l);
    });
    G.parcels.add(g);
    PBR.m = g;
  } catch (e) {
    console.warn('Grenze', e);
  }
}
// parLines(): Erweiterung zusammengeführt, siehe 02-geodaten/080-alkis.js
