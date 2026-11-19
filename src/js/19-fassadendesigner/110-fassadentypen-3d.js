// ======================= FASSADENTYPEN IM 3D-MODELL =======================
// Jedes Feld mit Fassadentyp (nicht „ohne Typ“) wird ab LOD 200 als farbige Fläche 4 cm vor die Außenwand gelegt
// (in LOD 100 nur Auswertung, keine Farbe im Modell), mit ausgesparten Öffnungen, die Laibungen bis zum Fensterrahmen in
// derselben Farbe. Felder der Öffnungsgruppen mit eigenem Material und/oder Tiefe (auch schräg): Fläche in ihrer Tiefe,
// Seitenflächen nur an Kanten mit Tiefenunterschied (gestuft, L-förmig, schräg). Eigene Ebene „Fassadentypen“ (ein-/ausblendbar, Deckkraft). Abgleich in ftSync() (aus dem Takt der
// LOD-200-Ansicht, 22-lod200-waende/030-aktionen.js): neu gebaut wird nur ein Gebäude, dessen Fassade sich geändert hat.

// Eingeschaltet: Farbe und Schraffur der Fassadentypen liegen als dünne Schicht über den LOD-200-Wänden (die Wände selbst
// bleiben ungeteilt); Schraffur aus 150-schraffuren.js (schMaterial).
const FT3 = { aktiv: true, g: new T.Group(), bau: new Map() };
FT3.g.name = 'Fassadentypen';
sc.add(FT3.g);
G.fdt = FT3.g;
if (FT3.aktiv) LY.push(['Fassadentypen', 'fdt', 1, 1]);

/**
 * Vereinigung achsparalleler Rechtecke {u0,u1,v0,v1} als Ringe (Umrisse). Aneinanderstoßende Aussparungen werden so zu
 * einer – sonst bricht die Zerlegung der Fassadenfläche (Löcher dürfen sich nicht berühren).
 */
function ftVereinigung(R) {
  if (!R.length) return [];
  const xs = [...new Set(R.flatMap((r) => [r.u0, r.u1]))].sort((a, c) => a - c),
    ys = [...new Set(R.flatMap((r) => [r.v0, r.v1]))].sort((a, c) => a - c),
    nx = xs.length - 1,
    ny = ys.length - 1,
    voll = (i, j) =>
      i >= 0 &&
      j >= 0 &&
      i < nx &&
      j < ny &&
      R.some((r) => {
        const cu = (xs[i] + xs[i + 1]) / 2,
          cv = (ys[j] + ys[j + 1]) / 2;
        return cu > r.u0 && cu < r.u1 && cv > r.v0 && cv < r.v1;
      }),
    V = [];
  for (let j = 0; j < ny; j++) {
    const z = [];
    for (let i = 0; i < nx; i++) z.push(voll(i, j));
    V.push(z);
  }
  const an = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && V[j][i],
    K = new Map(),
    kante = (a, b) => K.set(a[0] + ',' + a[1], { a, b });
  // gerichtete Randkanten (gegen den Uhrzeigersinn um die belegte Fläche)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (!V[j][i]) continue;
      const x0 = xs[i],
        x1 = xs[i + 1],
        y0 = ys[j],
        y1 = ys[j + 1];
      if (!an(i, j - 1)) kante([x0, y0], [x1, y0]);
      if (!an(i + 1, j)) kante([x1, y0], [x1, y1]);
      if (!an(i, j + 1)) kante([x1, y1], [x0, y1]);
      if (!an(i - 1, j)) kante([x0, y1], [x0, y0]);
    }
  const ringe = [];
  while (K.size) {
    const [k0, e0] = K.entries().next().value;
    K.delete(k0);
    const ring = [e0.a];
    let e = e0,
      n = 0;
    while (n++ < 10000) {
      const k = e.b[0] + ',' + e.b[1],
        f = K.get(k);
      if (!f) break;
      K.delete(k);
      ring.push(e.b);
      e = f;
    }
    // gerade Zwischenpunkte entfernen
    const R2 = ring.filter((p, i) => {
      const a = ring[(i + ring.length - 1) % ring.length],
        c = ring[(i + 1) % ring.length];
      return Math.abs((p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0])) > 1e-9;
    });
    if (R2.length >= 3) ringe.push(R2);
  }
  return ringe;
}
/** Farbige Flächen eines Gebäudes (Gruppe) aus seinen Fassadenfeldern und den Feldern der Öffnungsgruppen. */
function ftBauen(b) {
  const g = new T.Group(),
    farben = new Map(),
    u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const base = b._y + ugH,
    VOR = 0.01, // Abstand der Farbfläche vor der Wand (knapp davor: wirkt wie eingefärbt, bündig mit der Attika)
    e = 0.003, // Seitenflächen leicht zur offenen Seite gerückt
    ov = (d) => (d > 0 ? d - 0.01 : d - VOR), // Lage der Farbfläche zu einer Wandfläche in Tiefe d
    farbePos = (c) => {
      let pos = farben.get(c);
      if (!pos) farben.set(c, (pos = []));
      return pos;
    };
  fdViews(b).forEach((V) => {
    const O = oeListe(b, V),
      M = oegFlaechen(b, V),
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
      stueck = (uu, vv) => V.pcs.find((p) => p.ring && inP([uu, vv], p.ring)),
      dAt = (m, uu) => (m ? m.dl + ((m.dr - m.dl) * (uu - m.u0)) / (m.u1 - m.u0 || 1) : 0),
      innerhalb = (m, uu, vv) => uu > m.u0 && uu < m.u1 && vv > m.v0 && vv < m.v1,
      // Fläche (Außenring mit Löchern) auf alle Wandstücke legen; Tiefe je Punkt aus tiefe(u)
      flaeche = (pos, aussenR, lochR, tiefe) => {
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
            const P3 = poly.map((q) => P(pc, q[0], q[1], tiefe(q[0])));
            for (let m = 1; m < P3.length - 1; m++) pos.push(...P3[0], ...P3[m], ...P3[m + 1]);
          }
        });
      },
      // senkrechte Fläche entlang der Kante a–c, je Endpunkt von Tiefe d0 bis d1, um (du, dv) verschoben
      seite = (pos, a, c, d0a, d1a, d0c, d1c, du, dv) => {
        const pc = stueck((a[0] + c[0]) / 2 - du * 2, (a[1] + c[1]) / 2 - dv * 2) || stueck(a[0], a[1]);
        if (!pc) return;
        const A0 = P(pc, a[0] + du, a[1] + dv, d0a),
          C0 = P(pc, c[0] + du, c[1] + dv, d0c),
          C1 = P(pc, c[0] + du, c[1] + dv, d1c),
          A1 = P(pc, a[0] + du, a[1] + dv, d1a);
        pos.push(...A0, ...C0, ...C1, ...A0, ...C1, ...A1);
      };
    fdFaces(b, V).forEach((f) => {
      const fc = f.t && f.t !== 'ohne' && S.ft.some((x) => x.k === f.t) ? 'l:' + f.t : null, // nur Schraffur (Wand trägt die Farbe)
        imFeld = (x) => grInFace(f, (x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2),
        Mf = M.filter(imFeld),
        Of = O.filter(imFeld),
        inR = (x) => Mf.find((m) => innerhalb(m, (x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2)),
        // Gruppenfelder mit eigenem Material: Farbe und Schraffur (die Wand dahinter hat die Farbe der Fläche)
        farbeVon = (m) => (m && m.t ? 'g:' + m.t : fc);
      if (!fc && !Mf.some((m) => m.t)) return;
      // Hauptfläche ohne Gruppenfelder und ohne Fenster außerhalb davon (Aussparungen vereinigt)
      if (fc)
        flaeche(
          farbePos(fc),
          f.o,
          f.h.concat(ftVereinigung(Mf.concat(Of.filter((x) => !inR(x))))),
          () => -VOR,
        );
      Mf.forEach((m) => {
        const col = farbeVon(m);
        // Feldfläche in ihrer (ggf. schrägen) Tiefe, ohne die Fenster darin
        if (col) {
          const L = Of.filter((x) => inR(x) === m).map((x) => ({ t0: x.u0, t1: x.u1, y0: x.v0, y1: x.v1 }));
          oeRechteckOhne(m.u0, m.u1, m.v0, m.v1, L).forEach(([a, c, ya, yb]) =>
            flaeche(
              farbePos(col),
              [
                [a, ya],
                [c, ya],
                [c, yb],
                [a, yb],
              ],
              [],
              (uu) => ov(dAt(m, uu)),
            ),
          );
        }
        if (!m.dl && !m.dr) return;
        // Seitenflächen an den Kanten mit Tiefenunterschied (auch gestuft und schräg); Teilstücke an allen
        // Feldgrenzen, damit wechselnde Nachbarn richtig erfasst werden
        const kanten = [
          [[m.u0, m.v0], [m.u0, m.v1], -1, 0],
          [[m.u1, m.v0], [m.u1, m.v1], 1, 0],
          [[m.u0, m.v0], [m.u1, m.v0], 0, -1],
          [[m.u0, m.v1], [m.u1, m.v1], 0, 1],
        ];
        kanten.forEach(([A, C, nu, nv]) => {
          const senk = nu !== 0,
            stellen = [
              ...new Set(
                [senk ? A[1] : A[0], senk ? C[1] : C[0]].concat(
                  Mf.concat(Of).flatMap((x) => (senk ? [x.v0, x.v1] : [x.u0, x.u1])),
                ),
              ),
            ]
              .filter((s) => s >= (senk ? A[1] : A[0]) - 1e-9 && s <= (senk ? C[1] : C[0]) + 1e-9)
              .sort((p, q) => p - q);
          for (let i = 0; i < stellen.length - 1; i++) {
            const s0 = stellen[i],
              s1 = stellen[i + 1];
            if (s1 - s0 < 1e-4) continue;
            const pa = senk ? [A[0], s0] : [s0, A[1]],
              pc2 = senk ? [A[0], s1] : [s1, A[1]],
              mu = (pa[0] + pc2[0]) / 2 + nu * 0.002,
              mv = (pa[1] + pc2[1]) / 2 + nv * 0.002;
            // außen liegt ein Fenster: dessen Laibung deckt die Kante ab
            if (Of.some((x) => mu > x.u0 && mu < x.u1 && mv > x.v0 && mv < x.v1)) continue;
            const n = Mf.find((q) => q !== m && innerhalb(q, mu, mv)) || null,
              dInA = dAt(m, pa[0]),
              dInC = dAt(m, pc2[0]),
              dOutA = dAt(n, pa[0]),
              dOutC = dAt(n, pc2[0]),
              mIn = (dInA + dInC) / 2,
              mOut = (dOutA + dOutC) / 2;
            if (Math.abs(dInA - dOutA) < 0.002 && Math.abs(dInC - dOutC) < 0.002) continue;
            // nur einmal je Kante: das tiefer liegende Feld zeichnet (außen kein Gruppenfeld: dieses Feld)
            if (n && mOut > mIn) continue;
            const col = mIn < mOut ? farbeVon(m) : farbeVon(n);
            if (!col) continue;
            // zur offenen (tieferen) Seite rücken
            const r = mIn > mOut ? -1 : 1;
            seite(
              farbePos(col),
              pa,
              pc2,
              ov(Math.min(dInA, dOutA)),
              Math.max(dInA, dOutA),
              ov(Math.min(dInC, dOutC)),
              Math.max(dInC, dOutC),
              nu * e * r,
              nv * e * r,
            );
          }
        });
      });
      // Laibungen der Fenster: von der (ggf. versetzten) Außenfläche bis hinter den Rahmen
      Of.forEach((x) => {
        const m = inR(x),
          col = farbeVon(m);
        if (!col) return;
        const um = (x.u0 + x.u1) / 2,
          dm = dAt(m, um),
          d0 = ov(dm),
          tief = dm + Math.max(0.05, x.T.et || 0.12) + 0.1,
          pos = farbePos(col),
          u0 = x.u0 + e,
          u1 = x.u1 - e,
          v0 = x.v0 + e,
          v1 = x.v1 - e;
        seite(pos, [u0, v0], [u0, v1], d0, tief, d0, tief, 0, 0);
        seite(pos, [u1, v0], [u1, v1], d0, tief, d0, tief, 0, 0);
        seite(pos, [u0, v1], [u1, v1], d0, tief, d0, tief, 0, 0);
        if (!oeTuer(x.T) && x.T.br > 0.05) seite(pos, [u0, v0], [u1, v0], d0, tief, d0, tief, 0, 0);
      });
    });
  });
  farben.forEach((pos, c) => {
    if (!pos.length) return;
    // 'l:<Typ>': nur die Schraffurlinien (ohne Schraffur entfällt die Schicht); 'g:<Typ>': Farbe und Schraffur
    const nur = c.startsWith('l:'),
      t = fdT(c.slice(2));
    if (nur && !schVonTyp(t)) return;
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    ge.computeVertexNormals();
    const m = new T.Mesh(
      ge,
      schMaterial(
        new T.MeshLambertMaterial({
          color: new T.Color(t.c),
          side: T.DoubleSide,
          transparent: nur,
          depthWrite: !nur,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
        t,
        nur,
      ),
    );
    m.receiveShadow = true;
    m.raycast = () => {};
    g.add(m);
  });
  return g;
}
/**
 * Fassadentypen entlang einer Außenwand (LOD 200, Bauteil e): Abschnitte [{ t0, t1, k }] entlang der Wandachse d
 * (t = Punkt · d), Typ k der Fassadenfläche in Geschossmitte ('' = ohne Typ). Damit wird die Wand selbst eingefärbt
 * (nur in der Darstellung in Stücke geschnitten, l2MeshOrig); leer, wenn die Wand keinen Typ trägt.
 */
function ftWandAbschnitte(e) {
  try {
    const b = oeBauteilGebaeude(e);
    if (!b || !b.fd || e.kind !== 'AW' || !e.sa || !e.sb) return { d: null, A: [] };
    const u0 = ugN(b);
    if (e.li < u0) return { d: null, A: [] };
    const L = Math.hypot(e.sb[0] - e.sa[0], e.sb[1] - e.sa[1]) || 1,
      d = [(e.sb[0] - e.sa[0]) / L, (e.sb[1] - e.sa[1]) / L],
      fp = lf(b, b.levels[e.li]),
      m = [(e.sa[0] + e.sb[0]) / 2, (e.sa[1] + e.sb[1]) / 2];
    // Rück- und Seitenwände einer Loggia: ganz im Typ der Loggia, eingefärbt zur Loggia hin
    if (e.lg) {
      // Loggia, an deren Kontur die Wandmitte liegt (Abstand bis eine Wandstärke)
      const z = oeLoggiaEinschnitte(b).find(
        (q) => Math.abs(q.y - e.y0) < 0.3 && oeAbstandZuRing(m, q.f) < (e.d || 0.36) + 0.05,
      );
      const k = z ? ftLoggiaTyp(b, z.lg) : '';
      if (!k) return { d, A: [] };
      let n = [-d[1], d[0]];
      if (!inP([m[0] + n[0] * 0.2, m[1] + n[1] * 0.2], z.f)) n = [d[1], -d[0]];
      // Außenfläche: die Seite zur Loggia (die Wand liegt dahinter)
      const sA = Math.max(...e.quads.flat().map((p) => p[0] * n[0] + p[1] * n[1]));
      return { d, n, sA, A: [{ t0: -1e5, t1: 1e5, k }] };
    }
    let n = [-d[1], d[0]];
    if (fp && inP([m[0] + n[0] * 0.2, m[1] + n[1] * 0.2], fp)) n = [d[1], -d[0]]; // Normale nach außen
    let vm = 0;
    for (let i = u0; i < e.li; i++) vm += b.levels[i].h;
    vm += b.levels[e.li].h / 2;
    const V = fdViewAt(b, n[0], n[1], m[0], m[1], 0.7);
    if (!V) return { d, A: [] };
    const F = fdFaces(b, V),
      typ = (s) => {
        const x = e.sa[0] + d[0] * s,
          z = e.sa[1] + d[1] * s,
          f = F.find((q) => grInFace(q, x * V.n[1] - z * V.n[0], vm));
        return f && f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t) ? f.t : '';
      },
      ta = e.sa[0] * d[0] + e.sa[1] * d[1],
      N = Math.max(1, Math.ceil(L / 0.25)),
      A = [];
    for (let i = 0; i < N; i++) {
      const k = typ(((i + 0.5) / N) * L),
        t0 = ta + (i / N) * L,
        t1 = ta + ((i + 1) / N) * L;
      if (A.length && A[A.length - 1].k === k) A[A.length - 1].t1 = t1;
      else A.push({ t0, t1, k });
    }
    // Wandenden (Gehrung) gehören zum ersten bzw. letzten Abschnitt
    A[0].t0 = -1e5;
    A[A.length - 1].t1 = 1e5;
    // n, sA: Normale nach außen und Lage der Außenfläche (für die Einfärbung nur bis zur Fensterebene)
    return { d, n, sA: e.sa[0] * n[0] + e.sa[1] * n[1], A: A.some((a) => a.k) ? A : [] };
  } catch (err) {
    logErr(err, 'ftWandAbschnitte');
    return { d: null, A: [] };
  }
}
/**
 * Fassadentyp an einer Stelle einer Giebel- oder Drempelwand (LOD 200, Bauteil e mit e.gb): Punkt (x, y, z) in
 * Weltkoordinaten, Außennormale aus e.gb. Gezielt gesetzter Typ der Fläche, sonst wie bei der Attika der Typ der Wand
 * darunter im obersten Geschoss. '' = ohne Typ.
 */
function ftGiebelTyp(e, x, y, z) {
  try {
    const b = oeBauteilGebaeude(e);
    if (!b || !b.fd || !e.gb) return '';
    const V = fdViewAt(b, e.gb.nx, e.gb.nz, x, z, 0.7);
    if (!V) return '';
    const u0 = ugN(b);
    let ugH = 0;
    for (let i = 0; i < u0; i++) ugH += b.levels[i].h;
    const u = x * V.n[1] - z * V.n[0],
      v = y - (b._y + ugH),
      F = fdFaces(b, V),
      typ = (vv) => {
        const f = F.find((q) => grInFace(q, u, vv));
        return f && f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t) ? f.t : '';
      };
    // gezielt gesetzt gilt; sonst wie die Attika der Typ der Wand darunter (oberstes Vollgeschoss, Mitte der Kante u)
    let vTop = 0;
    for (let i = u0; i < b.levels.length; i++) vTop += b.levels[i].h;
    return typ(v) || typ(vTop - 0.3);
  } catch (err) {
    logErr(err, 'ftGiebelTyp');
    return '';
  }
}
/** Fassadentyp der Fassadenfläche an der Stelle (u, v) der Ansicht vk ('' = ohne Typ). */
function ftFassadeBei(b, vk, u, v) {
  const V = fdViews(b).find((x) => x.key === vk);
  if (!V) return '';
  const f = fdFaces(b, V).find((q) => grInFace(q, u, v));
  return f && f.t && f.t !== 'ohne' && S.ft.some((t) => t.k === f.t) ? f.t : '';
}
/** Typ einer Loggia (Rück- und Seitenwände): Material des Gruppenfelds, sonst der Fassadentyp an der Loggia. */
function ftLoggiaTyp(b, o) {
  if (o.t && S.ft.some((t) => t.k === o.t)) return o.t;
  return ftFassadeBei(b, o.vk, (o.u0 + o.u1) / 2, (o.v0 + o.v1) / 2);
}
/** Typ des Sturzes über einer Loggia: Fassadentyp knapp über der Loggia. */
function ftSturzTyp(b, o) {
  return ftFassadeBei(b, o.vk, (o.u0 + o.u1) / 2, Math.min(o.v1 + 0.05, o.vG - 0.05));
}
/** Kennung der Fassadentypen eines Gebäudes (Neuaufbau der eingefärbten Wände). */
function ftWandSig(b) {
  return b && b.fd
    ? JSON.stringify([Object.values(b.fd).map((d) => d && d.units), S.ft.map((t) => [t.k, t.c]), fdSig(b)])
    : '';
}
/** Flächen aller Gebäude abgleichen (nur geänderte neu bauen). */
function ftSync() {
  const da = new Set(),
    explodiert = !!(S.expl && S.expl.cur > 0.05),
    einheiten = !!(S.zo && S.zo.m === 'u');
  // erst ab LOD 200 im Modell; in LOD 100 dienen die Fassadentypen nur der Auswertung
  const an = FT3.aktiv && l2on();
  S.bld.forEach((b) => {
    if (!an || b.ex || !b.fd || b._y == null) return;
    const sg = JSON.stringify([fdSig(b), b.fd, S.ft, S.oet, S.oeg, schSig()]),
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
