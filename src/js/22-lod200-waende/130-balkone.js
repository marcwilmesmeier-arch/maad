/* Balkone und Loggien aus den Öffnungsgruppen in LOD 200 (Feldart a: 'ba' Balkon, 'lo' Loggia; 097-oeffnungsgruppen).
   Balkon: Platte 0,20 m an der Feldunterkante, kragt um tb vor die Fassade aus, Stabgeländer an den drei freien Seiten.
   Loggia: der Rücksprung selbst kommt aus der Wandableitung (oeWelt/oeRuecksprungKoerper); hier nur das Geländer in der
   Fassadenebene. Geländer: Stäbe alle 0,24 m, Handlauf und Fußleiste, 1,00 m über der Feldunterkante. */
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
      R.push({ a: x.a, p0: W(x.u0), p1: W(x.u1), y0: base + x.v0, n: V.n, tb: x.tb || 1.5 });
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
      gel = [],
      pl = [];
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
        l2Stabgelaender(gel, ein(Av, A), ein(Bv, B), x.y0);
        l2Stabgelaender(gel, ein(A, B), ein(Av, Bv), x.y0);
        l2Stabgelaender(gel, ein(B, A), ein(Bv, Av), x.y0);
      } else {
        // Loggia: Geländer knapp hinter der Fassadenebene
        const ri = [A[0] - n[0] * 0.08, A[1] - n[1] * 0.08],
          rj = [B[0] - n[0] * 0.08, B[1] - n[1] * 0.08];
        l2Stabgelaender(gel, ri, rj, x.y0);
      }
    });
    const g = new T.Group(),
      mesh = (arr, farbe) => {
        if (!arr.length) return;
        const ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
        ge.computeVertexNormals();
        const m = new T.Mesh(ge, new T.MeshLambertMaterial({ color: farbe, side: T.DoubleSide }));
        m.castShadow = m.receiveShadow = true;
        m.raycast = () => {};
        g.add(m);
      };
    mesh(pl, 0xf4f4f2);
    mesh(gel, 0xa9aeb3);
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
