// ---- Datenquellen (unabhängig von Sichtbarkeit/Layern)
function ifcDPoly(pt, poly) {
  if (inP(pt, poly)) return 0;
  let m = 1e18;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l2 = dx * dx + dz * dz;
    let t = l2 ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    m = Math.min(m, Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dz));
  }
  return m;
}
function ifcSrc(cfg) {
  cfg = cfg || IFC.cfg || ifcDef();
  const s = {};
  s.bld = S.bld.filter((b) => b.levels && b.levels.length && b.fp && b.fp.length > 2);
  s.sites = P.filter((p) => p.site && p.poly && p.poly.length > 2);
  s.fl = AL.filter((a) => a.poly && a.poly.length > 2);
  s.areas = (S.areas || []).filter((a) => a.poly && a.poly.length > 2);
  let ctx = (GEO.blist || []).filter((b) => b.o && b.o.length > 2);
  if (+cfg.delCtx) ctx = ctx.concat((GEO.bdel || []).filter((b) => b.o && b.o.length > 2));
  (S.ex || []).forEach((x) => {
    if (x.fp && x.fp.length > 2)
      ctx.push({
        o: x.fp,
        holes: [],
        h: x.levels.reduce((t, l) => t + l.h, 0),
        minh: 0,
        p: { src: x.src || 'Bestand', Nutzung: x.use },
        ex: x,
        exId: x.id,
      });
  });
  let trees = (GEO.trees || []).slice();
  if (+cfg.delCtx) trees = trees.concat(GEO.tdel || []);
  // Umkreisfilter um Grundstücke bzw. Planung
  const foc = s.sites.length ? s.sites.map((p) => p.poly) : s.bld.map((b) => b.fp);
  s.foc = foc;
  const R = +cfg.rad || 0;
  if (R > 0 && foc.length) {
    const near = (x, z) => foc.some((p) => ifcDPoly([x, z], p) <= R);
    ctx = ctx.filter((b) => near(...cen(b.o)));
    trees = trees.filter((t) => near(t.x, t.z));
    s.areas = s.areas.filter((a) => near(...cen(a.poly)));
  }
  s.ctx = ctx;
  s.trees = trees;
  return s;
}
function ifcCounts(cfg) {
  const s = ifcSrc(cfg),
    o = {};
  IFCCAT.forEach((k) => {
    try {
      o[k.k] = k.cnt(s);
    } catch (_) {
      o[k.k] = 0;
    }
  });
  return o;
}
