// ======================= FASSADENTYPEN IM 3D-MODELL =======================
// Jedes Feld mit Fassadentyp (nicht „ohne Typ“) wird ab LOD 200 als farbige Fläche 4 cm vor die Außenwand gelegt
// (in LOD 100 nur Auswertung, keine Farbe im Modell), mit ausgesparten Öffnungen, die Laibungen bis zum Fensterrahmen in derselben Farbe. Eigene Ebene „Fassadentypen“ (ein-/ausblendbar, Deckkraft). Abgleich in ftSync() (aus dem Takt der
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
    mitOeffnungen = true;
  fdViews(b).forEach((V) => {
    const F = fdFaces(b, V).filter((f) => f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t));
    if (!F.length) return;
    const O = mitOeffnungen ? oeListe(b, V) : [];
    F.forEach((f) => {
      const innen = (u, v) => grInFace(f, u, v),
        drin = O.filter(
          (x) =>
            innen(x.u0 + 0.01, x.v0 + 0.01) &&
            innen(x.u1 - 0.01, x.v0 + 0.01) &&
            innen(x.u1 - 0.01, x.v1 - 0.01) &&
            innen(x.u0 + 0.01, x.v1 - 0.01),
        ),
        loecher = drin.map((x) => [
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
      // Laibungen: von der Außenkante bis zum Fensterrahmen (Einbautiefe), 3 mm in die Öffnung gerückt
      drin.forEach((x) => {
        const pc = V.pcs.find((p) => p.ring && inP([(x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2], p.ring));
        if (!pc) return;
        const e = 0.003,
          tief = Math.max(0.05, x.T.et || 0.12) + 0.1, // bis hinter den Rahmen (kein Spalt bei schräg liegenden Wänden)
          // senkrecht zur tatsächlichen Wand (die Ansicht fasst Wände bis 15° Abweichung zusammen)
          nw = (() => {
            let nx = -pc.dz,
              nz = pc.dx;
            if (nx * V.n[0] + nz * V.n[1] < 0) {
              nx = -nx;
              nz = -nz;
            }
            return [nx, nz];
          })(),
          P = (uu, vv, d) => {
            const s = (uu - pc.ua) / pc.dot;
            return [pc.ax + pc.dx * s - nw[0] * d, base + vv, pc.az + pc.dz * s - nw[1] * d];
          },
          viereck = (a, b) => {
            const A0 = P(a[0], a[1], -0.04),
              B0 = P(b[0], b[1], -0.04),
              B1 = P(b[0], b[1], tief),
              A1 = P(a[0], a[1], tief);
            pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
          },
          u0 = x.u0 + e,
          u1 = x.u1 - e,
          v0 = x.v0 + e,
          v1 = x.v1 - e;
        viereck([u0, v0], [u0, v1]);
        viereck([u1, v0], [u1, v1]);
        viereck([u0, v1], [u1, v1]);
        if (!oeTuer(x.T) && x.T.br > 0.05) viereck([u0, v0], [u1, v0]);
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
  // erst ab LOD 200 im Modell; in LOD 100 dienen die Fassadentypen nur der Auswertung
  const an = l2on();
  S.bld.forEach((b) => {
    if (!an || b.ex || !b.fd || b._y == null) return;
    const sg = JSON.stringify([fdSig(b), b.fd, S.ft, S.oet, S.oeg]),
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
