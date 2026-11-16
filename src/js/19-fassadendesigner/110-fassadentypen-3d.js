// ======================= FASSADENTYPEN IM 3D-MODELL =======================
// Jedes Feld mit Fassadentyp (nicht „ohne Typ“) wird ab LOD 200 als farbige Fläche 4 cm vor die Außenwand gelegt
// (in LOD 100 nur Auswertung, keine Farbe im Modell), mit ausgesparten Öffnungen, die Laibungen bis zum Fensterrahmen in
// derselben Farbe; Rücksprünge/Vorsprünge der Öffnungsgruppen mit Fläche in ihrer Tiefe und umlaufenden Seiten. Eigene Ebene „Fassadentypen“ (ein-/ausblendbar, Deckkraft). Abgleich in ftSync() (aus dem Takt der
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
    VOR = 0.04, // Abstand der Farbfläche vor der Wand
    e = 0.003; // Seitenflächen leicht in die Öffnung gerückt
  fdViews(b).forEach((V) => {
    const F = fdFaces(b, V).filter((f) => f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t));
    if (!F.length) return;
    const O = oeListe(b, V),
      RS = oegRuecksprunge(b, V).filter((r) => r.d),
      // Umrechnung Ansicht → Welt je Wandstück, senkrecht zur tatsächlichen Wand (d = Tiefe nach innen)
      stueck = (uu, vv) => V.pcs.find((p) => p.ring && inP([uu, vv], p.ring)),
      nw = (pc) => {
        let nx = -pc.dz,
          nz = pc.dx;
        if (nx * V.n[0] + nz * V.n[1] < 0) {
          nx = -nx;
          nz = -nz;
        }
        return [nx, nz];
      },
      P = (pc, uu, vv, d) => {
        const s = (uu - pc.ua) / pc.dot,
          n = nw(pc);
        return [pc.ax + pc.dx * s - n[0] * d, base + vv, pc.az + pc.dz * s - n[1] * d];
      },
      // Rechteck als Ring, um k nach innen gerückt (aneinanderstoßende Aussparungen brächen die Zerlegung)
      ring = (x, k = 0) => [
        [x.u0 + k, x.v0 + k],
        [x.u0 + k, x.v1 - k],
        [x.u1 - k, x.v1 - k],
        [x.u1 - k, x.v0 + k],
      ];
    F.forEach((f) => {
      let pos = farben.get(fdT(f.t).c);
      if (!pos) farben.set(fdT(f.t).c, (pos = []));
      const innen = (uu, vv) => grInFace(f, uu, vv),
        drinnen = (x) =>
          innen(x.u0 + 0.01, x.v0 + 0.01) &&
          innen(x.u1 - 0.01, x.v0 + 0.01) &&
          innen(x.u1 - 0.01, x.v1 - 0.01) &&
          innen(x.u0 + 0.01, x.v1 - 0.01),
        R = RS.filter(drinnen),
        inR = (x) =>
          R.find(
            (r) => x.u0 >= r.u0 - 1e-3 && x.u1 <= r.u1 + 1e-3 && x.v0 >= r.v0 - 1e-3 && x.v1 <= r.v1 + 1e-3,
          ),
        Od = O.filter(drinnen),
        // Fläche (Außenring mit Löchern) in Tiefe d auf alle Wandstücke legen
        flaeche = (aussenR, lochR, d) => {
          const aussen = aussenR.map((q) => new T.Vector2(q[0], q[1])),
            holes = lochR.map((h) => h.map((q) => new T.Vector2(q[0], q[1]))),
            alle = aussen.concat(...holes),
            tr = T.ShapeUtils.triangulateShape(
              aussen.map((v) => v.clone()),
              holes.map((h) => h.map((v) => v.clone())),
            );
          V.pcs.forEach((pc) => {
            for (const [i, j, k] of tr) {
              const poly = fdClip(
                [alle[i], alle[j], alle[k]].map((v) => [v.x, v.y]),
                pc.ring,
              );
              if (poly.length < 3) continue;
              const P3 = poly.map((q) => P(pc, q[0], q[1], d));
              for (let m = 1; m < P3.length - 1; m++) pos.push(...P3[0], ...P3[m], ...P3[m + 1]);
            }
          });
        },
        // Seitenfläche entlang der Kante a–b von Tiefe d0 bis d1
        seite = (a, c, d0, d1) => {
          const pc = stueck((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) || stueck(a[0], a[1]);
          if (!pc) return;
          const A0 = P(pc, a[0], a[1], d0),
            B0 = P(pc, c[0], c[1], d0),
            B1 = P(pc, c[0], c[1], d1),
            A1 = P(pc, a[0], a[1], d1);
          pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
        },
        rahmen = (x, d0, d1, k, unten) => {
          const u0 = x.u0 + k,
            u1 = x.u1 - k,
            v0 = x.v0 + k,
            v1 = x.v1 - k;
          seite([u0, v0], [u0, v1], d0, d1);
          seite([u1, v0], [u1, v1], d0, d1);
          seite([u0, v1], [u1, v1], d0, d1);
          if (unten) seite([u0, v0], [u1, v0], d0, d1);
        };
      // Hauptfläche: ohne Fenster außerhalb von Rücksprüngen und ohne die Rücksprünge selbst
      flaeche(
        f.o,
        f.h.concat(
          Od.filter((x) => !inR(x)).map((x) => ring(x)),
          R.map((r) => ring(r, 0.002)),
        ),
        -VOR,
      );
      // Rücksprünge: Fläche in ihrer Tiefe (ohne die Fenster darin) und umlaufende Seitenflächen
      R.forEach((r) => {
        flaeche(
          ring(r),
          Od.filter((x) => inR(x) === r).map((x) => ring(x, 0.002)),
          r.d - (r.d > 0 ? 0.01 : VOR),
        );
        rahmen(r, r.d > 0 ? -VOR : 0, r.d > 0 ? r.d : r.d - VOR, r.d > 0 ? e : -e, true);
      });
      // Laibungen der Fenster: von der (ggf. versetzten) Außenfläche bis hinter den Rahmen
      Od.forEach((x) => {
        const rs = inR(x),
          d0 = (rs ? rs.d : 0) - VOR,
          tief = (rs ? rs.d : 0) + Math.max(0.05, x.T.et || 0.12) + 0.1;
        rahmen(x, d0, tief, e, !oeTuer(x.T) && x.T.br > 0.05);
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
