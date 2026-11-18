/* Balkone und Loggien aus den Öffnungsgruppen in LOD 200 (Feldart a: 'ba' Balkon, 'lo' Loggia; 097-oeffnungsgruppen).
   Balkon: Platte 0,20 m an der Feldunterkante, kragt um tb vor die Fassade aus, Stabgeländer an den drei freien Seiten.
   Loggia: der Rücksprung selbst kommt aus der Wandableitung (oeWelt/oeRuecksprungKoerper); hier nur das Geländer in der
   Fassadenebene. Geländer je Feld (oegGel: Art, Höhe, Farbe): Alu-Stäbe, Relinggeländer, Glas, Paneel oder massive
   Brüstung, mit Handlauf. */
const L2BK = new Map(); // Gebäude-ID → { sig, g }
/** Balkone und Loggien eines Gebäudes in Weltkoordinaten: { a, p0, p1, y0, n, tb }. */
function l2BalkonListe(b) {
  const R = [];
  if (!b.fd || b._y == null) return R;
  const u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const base = b._y + ugH;
  fdViews(b).forEach((V) =>
    oegFlaechen(b, V).forEach((x) => {
      if (!x.a) return;
      const pc = V.pcs.find(
        (p) => p.pd != null && p.ring && inP([(x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2], p.ring),
      );
      if (!pc) return;
      const W = (uu) => {
        const s = (uu - pc.ua) / pc.dot;
        return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
      };
      R.push({ a: x.a, p0: W(x.u0), p1: W(x.u1), y0: base + x.v0, n: V.n, tb: x.tb || 1.5, gel: oegGel(x) });
    }),
  );
  return R;
}
/** Quader zwischen den Grundrisspunkten (Strecke A–B, Breite w quer, versetzt um o nach n) von ya bis yb. */
function l2Quader(pos, A, B, n, o, w, ya, yb) {
  const P = (p, s) => [p[0] + n[0] * (o + s), p[1] + n[1] * (o + s)],
    a0 = P(A, -w / 2),
    a1 = P(A, w / 2),
    b0 = P(B, -w / 2),
    b1 = P(B, w / 2),
    V = [
      [a0, ya],
      [b0, ya],
      [b1, ya],
      [a1, ya],
      [a0, yb],
      [b0, yb],
      [b1, yb],
      [a1, yb],
    ].map(([p, y]) => [p[0], y, p[1]]);
  [
    [0, 2, 1, 0, 3, 2],
    [4, 5, 6, 4, 6, 7],
    [0, 1, 5, 0, 5, 4],
    [1, 2, 6, 1, 6, 5],
    [2, 3, 7, 2, 7, 6],
    [3, 0, 4, 3, 4, 7],
  ].forEach((f) => f.forEach((i) => pos.push(...V[i])));
}
/** Stabgeländer entlang A–B (Grundriss), Fuß bei yb, 1,00 m hoch. */
function l2Stabgelaender(pos, A, B, yb) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 0.1) return;
  const ux = (B[0] - A[0]) / L,
    uz = (B[1] - A[1]) / L,
    q = [-uz, ux],
    k = Math.max(1, Math.round(L / 0.24)),
    yt = yb + 1.0;
  for (let i = 0; i <= k; i++) {
    const t = Math.min(L - 0.01, Math.max(0.01, (i / k) * L)),
      M0 = [A[0] + ux * (t - 0.01), A[1] + uz * (t - 0.01)],
      M1 = [A[0] + ux * (t + 0.01), A[1] + uz * (t + 0.01)];
    l2Quader(pos, M0, M1, q, 0, 0.03, yb + 0.05, yt - 0.04);
  }
  l2Quader(pos, A, B, q, 0, 0.06, yt - 0.04, yt); // Handlauf
  l2Quader(pos, A, B, q, 0, 0.04, yb + 0.05, yb + 0.09); // Fußleiste
}
/**
 * Geländer entlang A–B (Grundriss), Fuß bei yb, je Art (gel.ga): 'st' Stäbe, 'ho' waagerechte Stäbe zwischen Pfosten,
 * 'gl' Glasscheibe mit Handlauf, 'pa' Paneel mit Pfosten, 'ma' massive Brüstung. teil(farbe) liefert das Positionsfeld
 * je Farbe ('glas' = Glas, 'wand' = Brüstung in Wandfarbe).
 */
function l2Gelaender(teil, A, B, yb, gel) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 0.1) return;
  const ux = (B[0] - A[0]) / L,
    uz = (B[1] - A[1]) / L,
    q = [-uz, ux],
    h = gel.gh,
    yt = yb + h,
    F = teil(gel.gc),
    bei = (t) => [A[0] + ux * t, A[1] + uz * t],
    pfosten = (t, w) =>
      l2Quader(F, bei(Math.max(0, t - w / 2)), bei(Math.min(L, t + w / 2)), q, 0, w, yb + 0.02, yt - 0.04),
    pfostenReihe = (abst, w) => {
      const k = Math.max(1, Math.round(L / abst));
      for (let i = 0; i <= k; i++) pfosten(Math.min(L - w / 2, Math.max(w / 2, (i / k) * L)), w);
    };
  if (gel.ga === 'ma') {
    // Brüstung 0,20 m stark in Wandfarbe
    l2Quader(teil('wand'), A, B, q, 0, 0.2, yb, yt);
    return;
  }
  if (gel.ga === 'gl') {
    // Glas 2 cm in Haltern, oben Handlauf
    l2Quader(teil('glas'), A, B, q, 0, 0.02, yb + 0.06, yt - 0.04);
    l2Quader(F, A, B, q, 0, 0.06, yb, yb + 0.06); // Bodenprofil
  } else if (gel.ga === 'pa') {
    pfostenReihe(1.2, 0.04);
    l2Quader(F, A, B, q, 0, 0.02, yb + 0.1, yt - 0.08);
  } else if (gel.ga === 'ho') {
    pfostenReihe(1.2, 0.04);
    for (let i = 1; i <= 5; i++) {
      const y = yb + 0.08 + ((yt - 0.12 - (yb + 0.08)) * i) / 5;
      l2Quader(F, A, B, q, 0, 0.015, y - 0.0075, y + 0.0075);
    }
  } else {
    pfostenReihe(0.12, 0.02);
    l2Quader(F, A, B, q, 0, 0.04, yb + 0.05, yb + 0.09); // Fußleiste
  }
  l2Quader(F, A, B, q, 0, 0.06, yt - 0.04, yt); // Handlauf
}
/** Balkone/Loggien der geplanten Gebäude aktuell halten (Takt aus 030-aktionen, nur LOD 200). */
function l2Balkone() {
  const an = l2on() && !l23(),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an) return;
    const sig = oeGebSig(b) + '|' + fdSig(b);
    da.add(b.id);
    let o = L2BK.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    const L = l2BalkonListe(b),
      pl = [],
      teile = new Map(),
      teil = (k) => {
        if (!teile.has(k)) teile.set(k, []);
        return teile.get(k);
      };
    L.forEach((x) => {
      const n = x.n,
        A = x.p0,
        B = x.p1;
      if (x.a === 'ba') {
        const t = x.tb,
          Av = [A[0] + n[0] * t, A[1] + n[1] * t],
          Bv = [B[0] + n[0] * t, B[1] + n[1] * t],
          ein = (p, q) => {
            // Geländer 5 cm hinter der Plattenkante
            const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            return [p[0] + ((q[0] - p[0]) / L2) * 0.05, p[1] + ((q[1] - p[1]) / L2) * 0.05];
          };
        // Platte von der Fassade bis zur Vorderkante
        l2Quader(pl, A, B, n, t / 2, t, x.y0 - 0.2, x.y0);
        if (x.gel.gm === 'se') {
          // seitlich: außen vor der Plattenstirn, ab Plattenunterkante (Höhe über der Platte bleibt gleich)
          const aus = (p, q) => {
              const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
              return [p[0] - ((q[0] - p[0]) / L2) * 0.03, p[1] - ((q[1] - p[1]) / L2) * 0.03];
            },
            seite = (P, Q, nn) => [
              [P[0] + nn[0] * 0.03, P[1] + nn[1] * 0.03],
              [Q[0] + nn[0] * 0.03, Q[1] + nn[1] * 0.03],
            ],
            gs = { ...x.gel, gh: x.gel.gh + 0.2 },
            d = [B[0] - A[0], B[1] - A[1]],
            dl = Math.hypot(...d) || 1,
            u = [d[0] / dl, d[1] / dl];
          // vorn (in Plattenrichtung n), links und rechts (quer)
          const [f0, f1] = seite(aus(Av, Bv), aus(Bv, Av), n);
          l2Gelaender(teil, f0, f1, x.y0 - 0.2, gs);
          const [l0, l1] = seite(A, Av, [-u[0], -u[1]]);
          l2Gelaender(teil, l0, [l1[0] + n[0] * 0.03, l1[1] + n[1] * 0.03], x.y0 - 0.2, gs);
          const [r0, r1] = seite(B, Bv, u);
          l2Gelaender(teil, r0, [r1[0] + n[0] * 0.03, r1[1] + n[1] * 0.03], x.y0 - 0.2, gs);
        } else {
          l2Gelaender(teil, ein(Av, A), ein(Bv, B), x.y0, x.gel);
          l2Gelaender(teil, ein(A, B), ein(Av, Bv), x.y0, x.gel);
          l2Gelaender(teil, ein(B, A), ein(Bv, Av), x.y0, x.gel);
        }
      } else {
        // Loggia: Geländer knapp hinter der Fassadenebene
        const ri = [A[0] - n[0] * 0.08, A[1] - n[1] * 0.08],
          rj = [B[0] - n[0] * 0.08, B[1] - n[1] * 0.08];
        l2Gelaender(teil, ri, rj, x.y0, x.gel);
      }
    });
    const g = new T.Group(),
      mesh = (arr, farbe) => {
        if (!arr.length) return;
        const ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
        ge.computeVertexNormals();
        const glas = farbe === 'glas',
          m = new T.Mesh(
            ge,
            new T.MeshLambertMaterial({
              color: glas ? 0xd8e6ee : farbe === 'wand' ? 0xf4f4f2 : farbe,
              transparent: glas,
              opacity: glas ? 0.35 : 1,
              depthWrite: !glas,
              side: T.DoubleSide,
            }),
          );
        m.castShadow = !glas;
        m.receiveShadow = true;
        m.raycast = () => {};
        g.add(m);
      };
    mesh(pl, 0xf4f4f2);
    teile.forEach((arr, k) => mesh(arr, k));
    G.l2.add(g);
    L2BK.set(b.id, { sig, g });
  });
  L2BK.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2BK.delete(id);
  });
}
function l2BalkoneWeg(o) {
  G.l2.remove(o.g);
  o.g.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
}
// ---- Terrassen: Stabgeländer auf der Terrassenfläche (Geschoss ohne Geschoss darüber an dieser Stelle), entlang
// der Außenkante mit Abstand zur Attika. Terrassenfläche = Grundriss des Geschosses minus Grundriss darüber.
const L2TG = new Map(); // Gebäude-ID → { sig, g }
/** Geländerlinien der Terrassen eines Gebäudes: [{ A, B, y }] (y = Terrassenboden). */
function l2TerrassenLinien(b) {
  const R = [],
    aw = ((b.l2 && b.l2.c && b.l2.c.AW) || L2DC.AW) / 100,
    ein = aw + 0.12; // Abstand von der Außenkante: Wand/Attika plus Luft
  let z = b._y;
  b.levels.forEach((l, j) => {
    const z1 = z + l.h;
    z = z1;
    const ob = b.levels[j + 1];
    if (l.ug || !ob) return;
    const f = lf(b, l),
      g = lf(b, ob);
    let T2 = [];
    try {
      T2 = boolOp([bpP(f)], [bpP(g)], 'd');
    } catch (e) {
      logErr(e, 'l2TerrassenLinien');
      return;
    }
    T2.forEach((P) => {
      if (!P.o || P.o.length < 3 || Math.abs(l2QA(P.o)) < 2) return;
      const r = P.o,
        n = r.length;
      for (let i = 0; i < n; i++) {
        const a = r[i],
          c = r[(i + 1) % n],
          L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (L < 0.5) continue;
        const ux = (c[0] - a[0]) / L,
          uz = (c[1] - a[1]) / L,
          m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
          // nur Kanten auf der Gebäudeaußenkante (nicht entlang der Wand des Geschosses darüber)
          aussen = f.some((p, k) => {
            const q = f[(k + 1) % f.length];
            return proj(m, p, q).d < 0.05;
          });
        if (!aussen) continue;
        // Richtung in die Terrasse
        let nx = -uz,
          nz = ux;
        if (!inP([m[0] + nx * 0.2, m[1] + nz * 0.2], r)) {
          nx = -nx;
          nz = -nz;
        }
        const A = [a[0] + nx * ein + ux * ein, a[1] + nz * ein + uz * ein],
          B = [c[0] + nx * ein - ux * ein, c[1] + nz * ein - uz * ein];
        if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 0.3) R.push({ A, B, y: z1 });
      }
    });
  });
  return R;
}
/** Terrassengeländer der geplanten Gebäude aktuell halten (Takt aus 030-aktionen, nur LOD 200). */
function l2Terrassen() {
  const an = l2on() && !l23() && !(S.expl && S.expl.cur > 0.05),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an) return;
    const sig = skSig(b) + '|' + JSON.stringify((b.l2 && b.l2.c) || 0);
    da.add(b.id);
    let o = L2TG.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    const pos = [];
    l2TerrassenLinien(b).forEach((x) => l2Stabgelaender(pos, x.A, x.B, x.y));
    const g = new T.Group();
    if (pos.length) {
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      ge.computeVertexNormals();
      const m = new T.Mesh(ge, new T.MeshLambertMaterial({ color: 0xa9aeb3, side: T.DoubleSide }));
      m.castShadow = m.receiveShadow = true;
      m.raycast = () => {};
      g.add(m);
    }
    G.l2.add(g);
    L2TG.set(b.id, { sig, g });
  });
  L2TG.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2TG.delete(id);
  });
}
