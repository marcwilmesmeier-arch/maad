// ---- v483: Fang auf Fusspunkt im rechten Winkel zu einem Endpunkt (bei paralleler/achsparalleler Linie), mit Hilfslinie
{
  const _s = snap;
  snap = function (p, e, i, A) {
    let r = _s.apply(this, arguments);
    if (!r) return r;
    try {
      if (
        (SNX.ref ||
          (S.tool === 'f' && S.dm === 'bld' && S.shape === 'free' && A === S.draft && S.draft.length)) &&
        (r.t === 'par' || r.t === 'ang') &&
        !(e && e.shiftKey)
      ) {
        const ref = SNX.ref || S.draft.at(-1),
          vx = r.p[0] - ref[0],
          vz = r.p[1] - ref[1],
          L = Math.hypot(vx, vz);
        if (L > 0.5) {
          const dx = vx / L,
            dz = vz / L,
            tol = 10 * mpp();
          const C = [];
          SKS.e.forEach((s) => {
            C.push(s.a, s.b);
          });
          P.forEach((a) => a.site && a.poly.forEach((c) => C.push(c)));
          S.bld.forEach((b) => {
            const f = b.levels ? cfp(b) : b.fp;
            f.forEach((c) => C.push(c));
          });
          if (!SNX.ref)
            S.draft.forEach((c, j) => {
              if (j < S.draft.length - 1) C.push(c);
            });
          let best = null,
            bd = tol;
          C.forEach((c) => {
            const cx = c[0] - ref[0],
              cz = c[1] - ref[1],
              s = cx * dx + cz * dz,
              off = Math.abs(cx * dz - cz * dx);
            if (off < 0.3 || s < 0.5) return;
            const ex = ref[0] + dx * s,
              ez = ref[1] + dz * s,
              d = Math.hypot(ex - r.p[0], ez - r.p[1]);
            if (d < bd) {
              bd = d;
              best = { c, E: [ex, ez], s };
            }
          });
          if (best) {
            r = Object.assign({}, r, {
              p: best.E,
              t: 'perp',
              sn: [best.c],
              lab: f1(best.s, 2) + ' m · rechtwinklig zu Punkt',
            });
            const a = (Math.atan2(dx, -dz) + Math.PI) % Math.PI; // Richtung senkrecht zur Zeichenrichtung
            S.fg = {
              gd: ((S.fg && S.fg.gd) || []).concat([
                { k: 'perp', a, ox: best.c[0], oz: best.c[1], lab: 'rechtwinklig' },
              ]),
              fa: (S.fg && S.fg.fa) || [],
              arc: null,
              t: 'perp',
              p: best.E.slice(),
            };
          }
        }
      }
    } catch (x) {
      console.warn('perpPt', x);
    }
    return r;
  };
}

// Fanglinien auch beim Ziehen von Skizzenpunkten anzeigen
{
  const _f = fgUpdate;
  fgUpdate = function () {
    if (!SNX.on) return _f.apply(this, arguments);
    const t = S.tool,
      c = S.closed;
    S.tool = 'f';
    S.closed = false;
    try {
      _f.apply(this, arguments);
    } finally {
      S.tool = t;
      S.closed = c;
    }
  };
}
