// ======================= FASSADENTYPEN IM 3D-MODELL =======================
// Jedes Feld mit Fassadentyp (nicht „ohne Typ“) wird als farbige Fläche 4 cm vor die Fassade gelegt – in LOD 100 auf
// den Baukörper, ab LOD 200 auf die Außenwände; dort mit ausgesparten Öffnungen (sonst lägen die Flächen vor den
// Fenstern). Eigene Ebene „Fassadentypen“ (ein-/ausblendbar, Deckkraft). Abgleich in ftSync() (aus dem Takt der
// LOD-200-Ansicht, 22-lod200-waende/030-aktionen.js): neu gebaut wird nur ein Gebäude, dessen Fassade sich geändert hat.

const FT3 = { g: new T.Group(), bau: new Map() };
FT3.g.name = 'Fassadentypen';
sc.add(FT3.g);
G.fdt = FT3.g;
LY.push(['Fassadentypen', 'fdt', 1, 1]);

/** Farbige Flächen eines Gebäudes (Gruppe) aus seinen Fassadenfeldern. */
function ftBauen(b) {
  const g = new T.Group(),
    farben = new Map(),
    u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const base = b._y + ugH,
    mitOeffnungen = l2on();
  fdViews(b).forEach((V) => {
    const F = fdFaces(b, V).filter((f) => f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t));
    if (!F.length) return;
    const O = mitOeffnungen ? oeListe(b, V) : [];
    F.forEach((f) => {
      const innen = (u, v) => grInFace(f, u, v),
        loecher = O.filter(
          (x) =>
            innen(x.u0 + 0.01, x.v0 + 0.01) &&
            innen(x.u1 - 0.01, x.v0 + 0.01) &&
            innen(x.u1 - 0.01, x.v1 - 0.01) &&
            innen(x.u0 + 0.01, x.v1 - 0.01),
        ).map((x) => [
          [x.u0, x.v0],
          [x.u0, x.v1],
          [x.u1, x.v1],
          [x.u1, x.v0],
        ]),
        aussen = f.o.map((q) => new T.Vector2(q[0], q[1])),
        holes = f.h.concat(loecher).map((h) => h.map((q) => new T.Vector2(q[0], q[1]))),
        alle = aussen.concat(...holes),
        tr = T.ShapeUtils.triangulateShape(
          aussen.map((v) => v.clone()),
          holes.map((h) => h.map((v) => v.clone())),
        ),
        c = fdT(f.t).c;
      let pos = farben.get(c);
      if (!pos) farben.set(c, (pos = []));
      V.pcs.forEach((pc) => {
        for (const [i, j, k] of tr) {
          const poly = fdClip(
            [alle[i], alle[j], alle[k]].map((v) => [v.x, v.y]),
            pc.ring,
          );
          if (poly.length < 3) continue;
          const P3 = poly.map((q) => {
            const s = (q[0] - pc.ua) / pc.dot;
            return [pc.ax + pc.dx * s + V.n[0] * 0.04, base + q[1], pc.az + pc.dz * s + V.n[1] * 0.04];
          });
          for (let m = 1; m < P3.length - 1; m++) pos.push(...P3[0], ...P3[m], ...P3[m + 1]);
        }
      });
    });
  });
  farben.forEach((pos, c) => {
    if (!pos.length) return;
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    ge.computeVertexNormals();
    const m = new T.Mesh(
      ge,
      new T.MeshLambertMaterial({
        color: new T.Color(c),
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    m.receiveShadow = true;
    m.raycast = () => {};
    g.add(m);
  });
  return g;
}
/** Flächen aller Gebäude abgleichen (nur geänderte neu bauen). */
function ftSync() {
  const da = new Set(),
    explodiert = !!(S.expl && S.expl.cur > 0.05),
    einheiten = !!(S.zo && S.zo.m === 'u');
  S.bld.forEach((b) => {
    if (b.ex || !b.fd || b._y == null) return;
    const sg = JSON.stringify([fdSig(b), b.fd, S.ft, l2on() ? 1 : 0, l2on() ? [S.oet, S.oeg] : 0]),
      alt = FT3.bau.get(b.id);
    da.add(b.id);
    if (alt && alt.sg === sg) return;
    if (alt) {
      FT3.g.remove(alt.g);
      l2Dispose(alt.g);
    }
    const g = ftBauen(b);
    FT3.g.add(g);
    FT3.bau.set(b.id, { sg, g });
    try {
      neuZeichnen();
    } catch (e) {
      logErr(e, 'ftSync');
    }
  });
  for (const [id, it] of FT3.bau)
    if (!da.has(id)) {
      FT3.g.remove(it.g);
      l2Dispose(it.g);
      FT3.bau.delete(id);
    }
  // in Explosions- und Einheitenansicht ausblenden (Geschosse verschoben bzw. Baukörper ausgeblendet)
  FT3.bau.forEach((it) => (it.g.visible = !explodiert && !einheiten));
}
