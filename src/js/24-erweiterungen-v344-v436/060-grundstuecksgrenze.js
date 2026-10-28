/* v400 Grundstücksgrenze: rundum geschlossenes Band mit Gehrung an den Ecken, Breite bildschirmabhängig (aus der Ferne kräftig, nah nur etwas stärker als die 1-px-Flurstücksgrenzen). Neuaufbau bei Zoomänderung. */
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
function pbPx(D) {
  return 1.5;
}
function pbBuild(force) {
  try {
    const polys = PBR.polys;
    if (PBR.m) {
      PBR.m.parent && PBR.m.parent.remove(PBR.m);
      PBR.m.geometry.dispose();
      PBR.m = null;
    }
    if (!polys.length) return;
    const { wpp, D } = pbWpp(),
      px = pbPx(D);
    let w = px * wpp;
    if (S.m3) w /= Math.max(0.45, Math.cos(Math.min(1.2, V.pol || 0)));
    PBR.w = w;
    const pos = [],
      idx = [];
    polys.forEach((poly) => {
      const pts = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = Math.max(1, Math.ceil(L / 2));
        for (let j = 0; j < n; j++)
          pts.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
      }
      const N = pts.length;
      if (N < 3) return;
      let ar = 0;
      for (let i = 0; i < N; i++) {
        const p = pts[i],
          q = pts[(i + 1) % N];
        ar += p[0] * q[1] - q[0] * p[1];
      }
      const sg = ar > 0 ? 1 : -1,
        base = pos.length / 3;
      for (let i = 0; i < N; i++) {
        const p0 = pts[(i + N - 1) % N],
          p = pts[i],
          p1 = pts[(i + 1) % N];
        let d0 = [p[0] - p0[0], p[1] - p0[1]],
          d1 = [p1[0] - p[0], p1[1] - p[1]];
        const l0 = Math.hypot(...d0) || 1,
          l1 = Math.hypot(...d1) || 1;
        d0 = [d0[0] / l0, d0[1] / l0];
        d1 = [d1[0] / l1, d1[1] / l1];
        const n0 = [-d0[1] * sg, d0[0] * sg],
          n1 = [-d1[1] * sg, d1[0] * sg];
        let mx = n0[0] + n1[0],
          mz = n0[1] + n1[1];
        const ml = Math.hypot(mx, mz) || 1;
        mx /= ml;
        mz /= ml;
        const cs = Math.max(0.4, mx * n1[0] + mz * n1[1]),
          k = w / 2 / cs,
          y = gh(p[0], p[1]) + 0.8;
        pos.push(p[0] + mx * k, y, p[1] + mz * k, p[0] - mx * k, y, p[1] - mz * k);
      }
      for (let i = 0; i < N; i++) {
        const a = base + i * 2,
          b = base + ((i + 1) % N) * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    });
    if (!pos.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        color: 0x3f6b85,
        side: T.DoubleSide,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    m.renderOrder = 6;
    m.raycast = () => {};
    m.frustumCulled = false;
    G.parcels.add(m);
    PBR.m = m;
  } catch (e) {
    console.warn('Grenze', e);
  }
}
// parLines(): Erweiterung zusammengeführt, siehe 02-geodaten/080-alkis.js
setInterval(() => {
  try {
    if (!PBR.polys.length || !PBR.m) return;
    const { wpp, D } = pbWpp();
    let w = pbPx(D) * wpp;
    if (S.m3) w /= Math.max(0.45, Math.cos(Math.min(1.2, V.pol || 0)));
    if (Math.abs(Math.log(w / PBR.w)) > 0.07) pbBuild();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 160);
