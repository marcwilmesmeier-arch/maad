/* Balkone und Loggien aus den Öffnungsgruppen in LOD 200 (dazu die Eckpfosten der Pfosten-Riegel-Fassaden) (Feldart a: 'ba' Balkon, 'lo' Loggia; 097-oeffnungsgruppen).
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
      R.push({
        a: x.a,
        p0: W(x.u0),
        p1: W(x.u1),
        y0: base + x.v0,
        n: V.n,
        d: Math.abs(x.d || 0),
        tb: x.tb || 1.5,
        gel: oegGelBei(x, x.v0),
      });
    }),
  );
  return R;
}
/**
 * Bodenflächen der Balkone und Loggien (für die Terrassen-Hervorhebung der Metriken): je Feld ein Rechteck im
 * Grundriss auf Höhe des Bodens – Balkon vor der Fassade (Auskragung), Loggia dahinter (Rücksprung), beides bei
 * Balkon + Loggia. [{ pts, y, area }]
 */
function lbBoeden(b) {
  const out = [];
  if (!l2on()) return out; // wie lbFlaechen: Balkone und Loggien nur in LOD 200
  try {
    l2BalkonListe(b).forEach((x) => {
      const n = x.n,
        A = x.p0,
        B = x.p1,
        vor = x.a === 'ba' || x.a === 'bl' ? x.tb : 0,
        zur = x.a === 'lo' || x.a === 'bl' ? x.d : 0,
        P = (p, s) => [p[0] + n[0] * s, p[1] + n[1] * s];
      if (vor + zur < 0.05) return;
      const pts = [P(A, -zur), P(B, -zur), P(B, vor), P(A, vor)];
      out.push({ pts, y: x.y0, area: Math.hypot(B[0] - A[0], B[1] - A[1]) * (vor + zur) });
    });
  } catch (e) {
    logErr(e, 'lbBoeden');
  }
  return out;
}
/**
 * Flächen im Sonderfall S nach DIN 277 (nicht allseitig umschlossen): Balkone (vor der Fassade, Auskragung) und Loggien
 * (hinter der Fassade, Rücksprung) – bei Balkon + Loggia beide Teile. Je Teil { art: 'ba'|'lo', pts, y, h, a }:
 * Körper vom Boden bis zur Decke (Loggia, Geschosshöhe) bzw. bis Oberkante Geländer (Balkon). Terrassen (kleine Flächen
 * etwa vor Loggien) folgen, wenn sie eigens modelliert werden; Dachterrassen gehören nicht dazu.
 */
function l2SFlaechen(b) {
  const out = [];
  if (!l2on()) return out;
  try {
    l2BalkonListe(b).forEach((x) => {
      const n = x.n,
        A = x.p0,
        B = x.p1,
        w = Math.hypot(B[0] - A[0], B[1] - A[1]),
        vor = x.a === 'ba' || x.a === 'bl' ? x.tb : 0,
        zur = x.a === 'lo' || x.a === 'bl' ? x.d : 0,
        P = (p, s) => [p[0] + n[0] * s, p[1] + n[1] * s],
        li = lvOfY(b, x.y0 + 0.1),
        // bis Unterkante der Platte darüber (Decke über der Loggia bzw. Balkonplatte darüber, 20 cm): die Platte gehört
        // nicht zum Raum im Sonderfall S
        dP = Math.max(0.2, (l2Els(b).els.find((e) => e.kind === 'DE') || {}).d || 0.22),
        hG = (li === 'roof' ? 2.5 : b.levels[li].h) - dP,
        hB = x.gel && x.gel.ga !== 'ke' ? x.gel.gh || 1 : 1;
      // eine Fläche je Feld (Balkon und Loggia sind dieselbe Flächenart): Balkon + Loggia als ein Körper von der
      // Rückwand der Loggia bis zur Vorderkante des Balkons, Höhe wie die Loggia; lo = Anteil hinter der Fassade
      if (vor + zur > 0.05)
        out.push({
          art: zur > 0.05 ? (vor > 0.05 ? 'bl' : 'lo') : 'ba',
          pts: [P(A, -zur), P(B, -zur), P(B, vor), P(A, vor)],
          y: x.y0,
          h: zur > 0.05 ? hG : hB,
          // brutto (BRI): mit der Platte darunter (Balkonplatte bzw. Decke unter der Loggia)
          dP,
          a: w * (vor + zur),
          lo: w * zur,
          li,
        });
    });
  } catch (e) {
    logErr(e, 'l2SFlaechen');
  }
  return out;
}
/** Summen im Sonderfall S: Fläche (Balkone und Loggien zusammen), davon hinter der Fassade (lo), BRI (S). */
function l2SZahlen(b) {
  const r = { a: 0, lo: 0, bri: 0, nri: 0, loV: 0 };
  l2SFlaechen(b).forEach((s) => {
    r.a += s.a;
    r.lo += s.lo; // liegt im Grundriss und gehört nicht zum Regelfall R
    r.bri += s.a * (s.h + s.dP); // brutto: mit Platte
    r.nri += s.a * s.h; // netto: lichte Höhe
    // Rauminhalt der Loggia im Bruttorauminhalt des Geschosses (volle Geschosshöhe): vom BRI (R) abziehen
    r.loV += s.lo * (s.li === 'roof' ? 0 : b.levels[s.li].h);
  });
  return r;
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
  l2QuaderFlaechen(pos, V);
}
/**
 * Flächen eines Quaders aus 8 Ecken (0–3 unten, 4–7 oben, gleiche Reihenfolge) – alle Dreiecke nach außen gewickelt:
 * ist der Grundriss andersherum umlaufen, werden die Dreiecke umgedreht (sonst zeigen Normalen nach innen, Licht und
 * Schatten der Seitenflächen sind falsch).
 */
function l2QuaderFlaechen(pos, V) {
  const a = V[4],
    b = V[5],
    c = V[6],
    // y-Anteil der Normale der Oberseite (4, 5, 6), mit umgekehrtem Vorzeichen
    ny = (c[2] - a[2]) * (b[0] - a[0]) - (c[0] - a[0]) * (b[2] - a[2]),
    um = ny > 0;
  [
    [0, 2, 1, 0, 3, 2],
    [4, 5, 6, 4, 6, 7],
    [0, 1, 5, 0, 5, 4],
    [1, 2, 6, 1, 6, 5],
    [2, 3, 7, 2, 7, 6],
    [3, 0, 4, 3, 4, 7],
  ].forEach((f) => {
    for (let i = 0; i < 6; i += 3) {
      const t = um ? [f[i], f[i + 2], f[i + 1]] : [f[i], f[i + 1], f[i + 2]];
      t.forEach((k) => pos.push(...V[k]));
    }
  });
}
/** Attikahöhe über der Dachdecke (m). */
const L2_ATTIKA = 0.3;
/**
 * Attika als eigene, durchgehende Wand (LOD 200, Flachdach): entlang des Umrisses des obersten Geschosses (und um
 * Innenhöfe, die bis zum Dach reichen), in Außenwandstärke nach innen, auf der Dachdecke stehend; an jeder Ecke auf
 * Gehrung (Schnittpunkt der versetzten Kanten) – keine Lücken, keine Überschneidungen, kein Überstand aus dem Geschoss
 * darunter. Ergebnis: Vierecke je Kante [{ Q, y0, y1 }].
 */
function l2AttikaRing(b) {
  // ── Terrassen: Attika als eigene Wand an den freien Außenkanten (l2AttikaTerrassen)
  const T_ = l2AttikaTerrassen(b);
  if (b.roof && b.roof.type && b.roof.type !== 'flat') return T_;
  const j = b.levels.length - 1;
  if (j < 0) return T_;
  const f = lf(b, b.levels[j]);
  if (!f || f.length < 3) return [];
  const els = l2Els(b).els,
    aw =
      els.find((e) => e.kind === 'AW' && e.li === j && !e.T.pr) ||
      els.find((e) => e.kind === 'AW' && !e.T.pr),
    d = (aw && aw.d) || 0.36,
    y0 = (b._y || 0) + b.levels.reduce((s, l) => s + l.h, 0),
    hoefe = znVoidsAt(b, j).map((v) => v.poly),
    // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: vor dem Attikaband einer Pfosten-Riegel-Fassade
    // springt die Attika-Wand zurück (oeAttikaPr)
    prA = oeAttikaPr(b).filter((z) => Math.abs(z.y - y0) < 0.05),
    R = [];
  // Dachfläche = Grundriss minus Innenhöfe (ein Hof darf über den Rand hinausreichen); Attika an allen ihren Rändern
  let D = [bpP(f)];
  if (hoefe.length)
    try {
      D = boolOp([bpP(f)], hoefe.map(bpP), 'd').filter((P) => P.o && P.o.length >= 3);
    } catch (e) {
      logErr(e, 'l2AttikaRing');
    }
  const drin = (p) => D.some((P) => inP(p, P.o) && !(P.h || []).some((h) => inP(p, h)));
  D.flatMap((P) => [P.o].concat(P.h || [])).forEach((ring) => {
    const n = ring.length,
      // je Kante: Richtung und Normale zur Gebäudeseite (Prüfpunkt 5 cm daneben)
      K = ring.map((p, i) => {
        const q = ring[(i + 1) % n],
          l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
          u = [(q[0] - p[0]) / l, (q[1] - p[1]) / l],
          m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        let nn = [-u[1], u[0]];
        if (!drin([m[0] + nn[0] * 0.05, m[1] + nn[1] * 0.05])) nn = [u[1], -u[0]];
        return { p, q, u, nn, l };
      }),
      // innere Ecke i: Schnitt der um d versetzten Kanten i−1 und i (Gehrung)
      innen = (i) => {
        const a = K[(i + n - 1) % n],
          c = K[i],
          A = [a.p[0] + a.nn[0] * d, a.p[1] + a.nn[1] * d],
          C = [c.p[0] + c.nn[0] * d, c.p[1] + c.nn[1] * d],
          det = a.u[0] * c.u[1] - a.u[1] * c.u[0];
        if (Math.abs(det) < 1e-6) return C;
        const t = ((C[0] - A[0]) * c.u[1] - (C[1] - A[1]) * c.u[0]) / det;
        return [A[0] + a.u[0] * t, A[1] + a.u[1] * t];
      },
      I = K.map((_, i) => innen(i));
    K.forEach((k, i) => {
      if (k.l < 0.01) return;
      // Fassadentyp entlang der Kante (alle 0,5 m); bei einem Wechsel wird die Attika dort geteilt
      const N = Math.max(1, Math.ceil(k.l / 0.5)),
        typ = (t) => l2AttikaTyp(b, k.p[0] + (k.q[0] - k.p[0]) * t, k.p[1] + (k.q[1] - k.p[1]) * t, k.nn),
        st = [{ t0: 0, ft: typ(0.5 / N) }];
      for (let s = 1; s < N; s++) {
        const ft = typ((s + 0.5) / N);
        if (ft !== st[st.length - 1].ft) st.push({ t0: s / N, ft });
      }
      const A = (t) => [k.p[0] + (k.q[0] - k.p[0]) * t, k.p[1] + (k.q[1] - k.p[1]) * t],
        // innen: an den Kantenenden die Gehrungspunkte, dazwischen senkrecht versetzt
        Ii = (t) =>
          t <= 0 ? I[i] : t >= 1 ? I[(i + 1) % n] : [A(t)[0] + k.nn[0] * d, A(t)[1] + k.nn[1] * d];
      const nb = (e) => Object.assign({}, e, { L: e.l });
      l2AttikaStuecke(k, k.l, A, Ii, st, prA, d, nb(K[(i + n - 1) % n]), nb(K[(i + 1) % n])).forEach(
        ([Q, ft]) => R.push({ Q, y0, y1: y0 + L2_ATTIKA, ft }),
      );
    });
  });
  return R.concat(T_);
}
/**
 * Attika einer Kante k (Länge L, Außenpunkt A(t), Innenpunkt Ii(t)) in Abschnitte nach Fassadentyp (st) teilen; vor
 * Pfosten-Riegel-Bändern (Z aus oeAttikaPr) springt die Außenseite um deren Rücksprung zurück. [[Q, ft]]
 */
function l2AttikaStuecke(k, L, A, Ii, st, Z, d, vor, nach) {
  // Abschnitte mit Pfosten-Riegel-Band davor: [ta, tb, Rücksprung] je Kante; Rücksprung an der Stelle t
  const zrOf = (e, Le) =>
      Z.filter(
        (z) =>
          Math.abs(z.n[0] * e.nn[0] + z.n[1] * e.nn[1]) > 0.99 &&
          Math.abs((z.p0[0] - e.p[0]) * e.nn[0] + (z.p0[1] - e.p[1]) * e.nn[1]) < 0.05,
      )
        .map((z) => {
          // Grenzen bis 5 mm an den Kantenenden auf die Ecke legen (sonst entfiele dort die Gehrung)
          const t = (p) => ((p[0] - e.p[0]) * e.u[0] + (p[1] - e.p[1]) * e.u[1]) / Le,
            snap = (v) => (v < 0.005 / Le ? 0 : v > 1 - 0.005 / Le ? 1 : v),
            a = snap(Math.max(0, Math.min(t(z.p0), t(z.p1)))),
            c = snap(Math.min(1, Math.max(t(z.p0), t(z.p1))));
          return [a, c, Math.min(z.d, d - 0.05)];
        })
        .filter(([a, c]) => c - a > 0.01 / Le),
    offBei = (zr, t) => (zr.find(([a, c]) => a - 1e-3 <= t && c + 1e-3 >= t) || [0, 0, 0])[2],
    R = [],
    zr = zrOf(k, L),
    // Schnitt zweier um o bzw. o2 nach innen versetzter Kanten (Gehrung an der Gebäudeecke)
    schnitt = (o, e, o2) => {
      const P = [k.p[0] + k.nn[0] * o, k.p[1] + k.nn[1] * o],
        Q = [e.p[0] + e.nn[0] * o2, e.p[1] + e.nn[1] * o2],
        det = k.u[0] * e.u[1] - k.u[1] * e.u[0];
      if (Math.abs(det) < 1e-6) return null;
      const t = ((Q[0] - P[0]) * e.u[1] - (Q[1] - P[1]) * e.u[0]) / det;
      return [P[0] + k.u[0] * t, P[1] + k.u[1] * t];
    },
    aussen = (t, o) => {
      // an der Ecke: auf Gehrung mit der Nachbarkante, deren Außenseite ebenfalls zurückspringen kann
      const e = t <= 1e-6 ? vor : t >= 1 - 1e-6 ? nach : null;
      if (e) {
        const o2 = offBei(zrOf(e, e.L), t <= 1e-6 ? 1 : 0);
        if (o > 0 || o2 > 0) {
          const X = schnitt(o, e, o2);
          if (X) return X;
        }
      }
      return [A(t)[0] + k.nn[0] * o, A(t)[1] + k.nn[1] * o];
    };
  st.forEach((x, j) => {
    const t0 = x.t0,
      t1 = j + 1 < st.length ? st[j + 1].t0 : 1,
      gr = [t0, t1, ...zr.flatMap(([a, c]) => [a, c]).filter((v) => v > t0 && v < t1)].sort((p, q) => p - q);
    for (let i = 0; i < gr.length - 1; i++) {
      const a = gr[i],
        c = gr[i + 1];
      if (c - a < 1e-6) continue;
      const z = zr.find(([p, q]) => p <= (a + c) / 2 && q >= (a + c) / 2),
        o = z ? z[2] : 0;
      R.push([[aussen(a, o), aussen(c, o), Ii(c), Ii(a)], x.ft]);
    }
  });
  return R;
}
/** Überstand der Schürze unter der Deckenunterkante (m). */
const L2_SCHUERZE = 0.1;
/**
 * Schürze unter auskragenden Geschossen (LOD 200), wie die Attika nach unten: wo ein Geschoss über das darunter
 * hinausragt, läuft seine Außenwand in derselben Flucht bis 10 cm unter die Deckenunterkante weiter (Außenwandstärke,
 * nach innen versetzt). Nur an den Außenkanten der auskragenden Fläche, nicht an der Fassade darunter.
 * [{ Q, y0, y1, ft, j }]
 */
function l2UeberhangSchuerzen(b) {
  const R = [];
  if (!l2on()) return R;
  try {
    const els = l2Els(b).els,
      aw = els.find((e) => e.kind === 'AW' && !e.T.pr),
      d = (aw && aw.d) || 0.36,
      dDE = (els.find((e) => e.kind === 'DE') || {}).d || 0.22,
      u = ugN(b);
    let z = b._y || 0;
    b.levels.forEach((l, j) => {
      const yj = z;
      z += l.h;
      if (j < 1 || j - 1 < u) return;
      const f = lf(b, l),
        g = lf(b, b.levels[j - 1]);
      if (!f || !g || f.length < 3 || g.length < 3) return;
      let U = [];
      try {
        U = boolOp([bpP(f)], [bpP(g)], 'd').filter((P) => P.o && P.o.length >= 3);
      } catch (e) {
        logErr(e, 'l2UeberhangSchuerzen');
        return;
      }
      // Abstand eines Punktes zum Umriss des auskragenden Geschosses (Außenkante)
      const aufF = (p) =>
        f.some((a, i) => {
          const c = f[(i + 1) % f.length],
            dx = c[0] - a[0],
            dz = c[1] - a[1],
            L2 = dx * dx + dz * dz || 1,
            t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
          return Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]) < 0.01;
        });
      U.forEach((P) => {
        const drin = (p) => inP(p, P.o) && !(P.h || []).some((h) => inP(p, h));
        [P.o].concat(P.h || []).forEach((ring) => {
          ring.forEach((p, i) => {
            const q = ring[(i + 1) % ring.length],
              L = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (L < 0.05) return;
            const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
            if (!aufF(m)) return;
            let nn = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L];
            if (!drin([m[0] + nn[0] * 0.05, m[1] + nn[1] * 0.05])) nn = [-nn[0], -nn[1]];
            // 2 mm vor die Fassadenebene: liegt sonst deckungsgleich mit der Deckenstirn (Flimmern, sichtbare Fuge)
            const dd = Math.min(d, 0.45),
              o = -0.002,
              P0 = [p[0] + nn[0] * o, p[1] + nn[1] * o],
              P1 = [q[0] + nn[0] * o, q[1] + nn[1] * o],
              Q = [P0, P1, [q[0] + nn[0] * dd, q[1] + nn[1] * dd], [p[0] + nn[0] * dd, p[1] + nn[1] * dd]];
            R.push({ Q, y0: yj - dDE - L2_SCHUERZE, y1: yj, ft: l2AttikaTyp(b, m[0], m[1], nn, j), j });
          });
        });
      });
    });
  } catch (e) {
    logErr(e, 'l2UeberhangSchuerzen');
  }
  return R;
}
/**
 * Attika an Terrassen (LOD 200) wie am Dach als eigene Wand: Terrassenfläche = Grundriss des Geschosses minus Grundriss
 * darüber; an jeder ihrer Kanten auf der Gebäudeaußenkante ein Wandstück der Stärke der Außenwand, nach innen versetzt,
 * Gehrung zwischen benachbarten Außenkanten, stumpf an der Wand des Geschosses darüber. Material wie die Wand darunter.
 */
function l2AttikaTerrassen(b) {
  const R = [],
    els = l2Els(b).els,
    aw = els.find((e) => e.kind === 'AW' && !e.T.pr),
    d = (aw && aw.d) || 0.36,
    prA = oeAttikaPr(b);
  let y = b._y || 0;
  b.levels.forEach((l, j) => {
    y += l.h;
    const ob = b.levels[j + 1];
    if (l.ug || !ob) return;
    const f = lf(b, l),
      T2 = l2TerrassenFlaeche(b, j),
      // Gebäudekanten: Umriss und Innenhöfe dieses Geschosses
      kanten = [f].concat(znVoidsAt(b, j).map((v) => v.poly));
    // je Ring der Terrassenfläche (außen und Löcher, z. B. ein Innenhof mitten in der Terrasse)
    const ringe = [];
    T2.forEach((P) => {
      if (!P.o || P.o.length < 3 || Math.abs(l2QA(P.o)) < 1) return;
      const drin = (p) => inP(p, P.o) && !(P.h || []).some((h) => inP(p, h));
      [P.o].concat(P.h || []).forEach((r) => ringe.push({ r, drin }));
    });
    ringe.forEach(({ r, drin }) => {
      const n = r.length,
        K = r.map((p, i) => {
          const q = r[(i + 1) % n],
            L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
            u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L],
            m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          let nn = [-u[1], u[0]];
          if (!drin([m[0] + nn[0] * 0.05, m[1] + nn[1] * 0.05])) nn = [u[1], -u[0]];
          // nur Kanten auf der Gebäudeaußenkante bzw. am Innenhof (nicht entlang der Wand des Geschosses darüber)
          const aussen =
            L > 0.05 && kanten.some((F) => F.some((a, k) => proj(m, a, F[(k + 1) % F.length]).d < 0.05));
          return { p, q, u, nn, L, aussen };
        }),
        // Ecke i (Anfang der Kante i): Gehrung, wenn die Kante davor auch außen liegt, sonst senkrecht versetzt
        ecke = (i) => {
          const a = K[(i + n - 1) % n],
            c = K[i],
            C = [c.p[0] + c.nn[0] * d, c.p[1] + c.nn[1] * d];
          if (!a.aussen) return C;
          const A = [a.p[0] + a.nn[0] * d, a.p[1] + a.nn[1] * d],
            det = a.u[0] * c.u[1] - a.u[1] * c.u[0];
          if (Math.abs(det) < 1e-6) return C;
          const t = ((C[0] - A[0]) * c.u[1] - (C[1] - A[1]) * c.u[0]) / det;
          return [A[0] + a.u[0] * t, A[1] + a.u[1] * t];
        },
        ende = (i) => {
          const c = K[i],
            e = K[(i + 1) % n];
          return e.aussen ? ecke((i + 1) % n) : [c.q[0] + c.nn[0] * d, c.q[1] + c.nn[1] * d];
        };
      K.forEach((k, i) => {
        if (!k.aussen) return;
        const N = Math.max(1, Math.ceil(k.L / 0.5)),
          typ = (t) =>
            l2AttikaTyp(b, k.p[0] + (k.q[0] - k.p[0]) * t, k.p[1] + (k.q[1] - k.p[1]) * t, k.nn, j),
          st = [{ t0: 0, ft: typ(0.5 / N) }];
        for (let s = 1; s < N; s++) {
          const ft = typ((s + 0.5) / N);
          if (ft !== st[st.length - 1].ft) st.push({ t0: s / N, ft });
        }
        const A = (t) => [k.p[0] + (k.q[0] - k.p[0]) * t, k.p[1] + (k.q[1] - k.p[1]) * t],
          I0 = ecke(i),
          I1 = ende(i),
          Ii = (t) => (t <= 0 ? I0 : t >= 1 ? I1 : [A(t)[0] + k.nn[0] * d, A(t)[1] + k.nn[1] * d]);
        // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: vor Pfosten-Riegel-Bändern zurückgesetzt
        l2AttikaStuecke(
          k,
          k.L,
          A,
          Ii,
          st,
          prA.filter((z) => Math.abs(z.y - y) < 0.05),
          d,
          K[(i + n - 1) % n].aussen ? K[(i + n - 1) % n] : null,
          K[(i + 1) % n].aussen ? K[(i + 1) % n] : null,
        ).forEach(([Q, ft]) => R.push({ Q, y0: y, y1: y + L2_ATTIKA, ft, j }));
      });
    });
  });
  return R;
}
/**
 * Fassadentyp der Attika an einer Stelle (x, z) ihrer Außenkante (nn = Normale zur Gebäudeseite): gezielt in der
 * Ansicht gesetzt (Fassadendesigner, d.at; 'ohne' = ohne Typ), sonst der Typ der Fassadenfläche darunter im obersten
 * Geschoss. '' = ohne Typ (Wandfarbe).
 */
function l2AttikaTyp(b, x, z, nn, jo) {
  try {
    if ((!b.fd && !fkHatMt(b)) || !ftFarbig()) return '';
    const V = fdViewAt(b, -nn[0], -nn[1], x, z, 0.7);
    if (!V) return '';
    const d = fdD(b, V.key),
      gilt = (k) => (k && k !== 'ohne' && S.ft.some((t) => t.k === k) ? k : '');
    if (d && d.at) return gilt(d.at);
    const u0 = ugN(b);
    // jo: Geschoss unter der Attika (Terrasse), sonst das oberste
    const bis = jo == null ? b.levels.length - 1 : jo;
    let vTop = 0;
    for (let i = u0; i <= bis; i++) vTop += b.levels[i].h;
    const u = x * V.n[1] - z * V.n[0],
      F = fdFaces(b, V).find((f) => grInFace(f, u, vTop - 0.3));
    // ohne eigenen Typ: Material aus „Planen“ (oberstes Geschoss)
    return gilt(F && F.t) || fkMaterialBeiV(b, vTop - 0.3);
  } catch (e) {
    logErr(e, 'l2AttikaTyp');
    return '';
  }
}
/** Senkrechtes Prisma über dem Viereck Q (Grundriss, beliebige Form) von ya bis yb – alle Seiten, doppelseitig. */
function l2Prisma(pos, Q, ya, yb) {
  l2QuaderFlaechen(pos, [...Q.map((p) => [p[0], ya, p[1]]), ...Q.map((p) => [p[0], yb, p[1]])]);
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
  if (L < 0.1 || gel.ga === 'ke') return; // kein Geländer (z. B. Erdgeschoss)
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
    if (b.ex || b._y == null || !an || l2Einfach(b)) return; // in Bewegung oder Bearbeitung: einfacher Körper
    // auch Fassadentypen und Schraffuren (Attika im Typ der Wand darunter)
    const sig =
      oeGebSig(b) +
      '|' +
      fdSig(b) +
      JSON.stringify([b.fd ? Object.values(b.fd).map((d) => [d.units, d.at]) : 0, S.ft, schSig()]) +
      ftWandSig(b) + // auch Material aus „Planen“ und Weißmodell
      JSON.stringify(b.voids || 0) + // Innenhöfe (Terrassen-Attika)
      JSON.stringify([b.fp, b.levels.map((l) => [l.h, l.fp || 0])]); // Geschossumrisse (Schürzen unter Überhängen)
    da.add(b.id);
    let o = L2BK.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    // Teile je Geschoss (eb = Geschoss, auf dessen Boden sie stehen) und Farbe – je Geschoss eine Gruppe, damit sie
    // in der Explosionsansicht mit dem Geschoss wandern (exApply)
    let eb = 0;
    const L = l2BalkonListe(b),
      teile = new Map(),
      teil = (k) => {
        const kk = eb + '\u0001' + k;
        if (!teile.has(kk)) teile.set(kk, []);
        return teile.get(kk);
      };
    L.forEach((x) => {
      eb = lvOfY(b, x.y0 + 0.1);
      const n = x.n,
        A = x.p0,
        B = x.p1;
      // Balkon und Balkon + Loggia (Rücksprung dahinter kommt aus der Wandableitung): Platte und Geländer vorn
      if (x.a === 'ba' || x.a === 'bl') {
        const t = x.tb,
          Av = [A[0] + n[0] * t, A[1] + n[1] * t],
          Bv = [B[0] + n[0] * t, B[1] + n[1] * t],
          ein = (p, q) => {
            // Geländer 5 cm hinter der Plattenkante
            const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            return [p[0] + ((q[0] - p[0]) / L2) * 0.05, p[1] + ((q[1] - p[1]) / L2) * 0.05];
          };
        // Platte von der Fassade bis zur Vorderkante
        l2Quader(teil('wand'), A, B, n, t / 2, t, x.y0 - 0.2, x.y0);
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
    // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: Eckpfosten der Pfosten-Riegel-Fassaden über Eck
    oeEcken(b).forEach((e) => {
      eb = lvOfY(b, e.y0 + 0.1);
      l2Prisma(teil(e.rf), oeEckQuadrat(e), e.y0, oeEckeBisAttika(b, e));
    });
    // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: Sturz über einer Loggia (die Loggia ist im Grundriss
    // ausgeschnitten, die Außenwand darüber fehlt dort): von der Oberkante der Loggia, spätestens ab Deckenunterkante,
    // bis Oberkante Decke – im obersten Geschoss mit Flachdach weiter bis Oberkante Attika wie die übrigen Außenwände
    {
      const els = l2Els(b).els,
        aw = els.find((e) => e.kind === 'AW' && !e.T.pr),
        dW = (aw && aw.d) || 0.36,
        dDE = (els.find((e) => e.kind === 'DE') || {}).d || 0.22;
      oeLoggiaEinschnitte(b).forEach((z) => {
        const o = z.lg;
        eb = lvOfY(b, o.y0 + 0.1);
        // bis Oberkante Decke; im obersten Geschoss läuft darüber die Attika als eigene Wand (l2AttikaRing)
        const ya = Math.min(o.y1, o.yG - dDE),
          yb = o.yG;
        // im Fassadentyp der Fassade knapp über der Loggia (sonst Wandfarbe)
        const ks = ftSturzTyp(b, o),
          tw = ks ? 'ft:' + ks : 'wand';
        if (yb - ya > 0.03) l2Quader(teil(tw), o.p0, o.p1, o.n, -dW / 2, dW, ya, yb);
        // Gehrung zu den Seitenwänden der Loggia: die Außenwände daneben enden schräg (Dreieck gehört der
        // Seitenwand); da diese unter der Decke endet, das Dreieck im Decken- und Attikabereich ergänzen
        const L = Math.hypot(o.p1[0] - o.p0[0], o.p1[1] - o.p0[1]) || 1,
          u = [(o.p1[0] - o.p0[0]) / L, (o.p1[1] - o.p0[1]) / L],
          Q = (p, a, s2) => [p[0] + u[0] * a - o.n[0] * s2, p[1] + u[1] * a - o.n[1] * s2],
          y0 = o.yG - dDE;
        if (yb - y0 > 0.03) {
          const a = Q(o.p0, -dW, dW),
            c = Q(o.p0, 0, dW),
            d = Q(o.p1, dW, dW),
            e = Q(o.p1, 0, dW);
          l2Prisma(teil(tw), [o.p0, a, c, c], y0, yb);
          l2Prisma(teil(tw), [o.p1, e, d, d], y0, yb);
        }
      });
    }
    // ── Attika als eigene Wand rund um das oberste Geschoss (Flachdach)
    eb = 'roof';
    // je Abschnitt im Fassadentyp der Wand darunter (Farbe und Schraffur, l2AttikaTyp)
    l2AttikaRing(b).forEach((q) => {
      // Terrassen-Attika gehört in der Explosionsansicht zum Geschoss darunter
      eb = q.j != null ? lvOfY(b, q.y0 - 0.1) : 'roof';
      l2Prisma(teil(q.ft ? 'ft:' + q.ft : 'wand'), q.Q, q.y0, q.y1);
    });
    // ── Schürze unter auskragenden Geschossen (gehört in der Explosionsansicht zum auskragenden Geschoss)
    l2UeberhangSchuerzen(b).forEach((q) => {
      eb = q.j;
      l2Prisma(teil(q.ft ? 'ft:' + q.ft : 'wand'), q.Q, q.y0, q.y1);
    });
    // Attika, Stürze und Balkonplatten in der Farbe der Außenwände dieses Gebäudes (kein Farbsprung am Übergang)
    const wandIt = [...L2I.values()].find((it) => it.el.bid === b.id && it.el.kind === 'AW' && it.mat),
      wandFarbe = wandIt ? wandIt.mat.color.clone() : new T.Color(L2K.AW.c);
    const g = new T.Group(),
      mesh = (arr, farbe) => {
        if (!arr.length) return null;
        const ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
        ge.computeVertexNormals();
        const glas = farbe === 'glas',
          // 'ft:<Typ>': Farbe und Schraffur des Fassadentyps (Attika)
          ftT = typeof farbe === 'string' && farbe.startsWith('ft:') ? fdT(farbe.slice(3)) : null,
          m = new T.Mesh(
            ge,
            new T.MeshLambertMaterial({
              color: glas ? 0xd8e6ee : ftT ? ftT.c : farbe === 'wand' ? wandFarbe : farbe,
              transparent: glas,
              opacity: glas ? 0.35 : 1,
              depthWrite: !glas,
              side: T.DoubleSide,
              // geschlossene, nach außen gewickelte Quader: nur die Rückseiten in die Schattenkarte (keine
              // Schattenstreifen auf den Seiten der Platte)
              shadowSide: T.BackSide,
            }),
          );
        if (ftT) schMaterial(m.material, ftT);
        m.castShadow = !glas;
        m.receiveShadow = true;
        m.raycast = () => {};
        return m;
      },
      gs = new Map();
    teile.forEach((arr, kk) => {
      const [e, k] = kk.split('\u0001'),
        m = mesh(arr, k);
      if (!m) return;
      if (!gs.has(e)) {
        const sg = new T.Group();
        sg.userData.k = e === 'roof' ? 'roof' : +e; // Geschoss für die Explosionsansicht
        sg.position.y = S.expl ? exOff(b, sg.userData.k) : 0;
        gs.set(e, sg);
        g.add(sg);
      }
      gs.get(e).add(m);
    });
    G.l2.add(g);
    L2BK.set(b.id, { sig, g });
  });
  L2BK.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2BK.delete(id);
  });
}
/**
 * Balkone und Loggien im Grundriss (LOD 200, aus l2Draw): im Geschoss, dessen Fußboden auf Höhe der Platte liegt,
 * die Balkonplatte mit Geländer bzw. bei der Loggia das Geländer in der Fassadenebene; der Balkon des Geschosses
 * darüber gestrichelt (überdeckt die Fläche davor).
 * @param {CanvasRenderingContext2D} x  Zeichenfläche des Grundrisses (Weltkoordinaten über grTf)
 * @param {object} b  Gebäude
 * @param {object[]} wl  Wände des Geschosses (l2Els)
 */
function l2BalkonGrundriss(x, b, wl) {
  const aw = wl.filter((e) => e.kind === 'AW' && isFinite(e.y0));
  if (!aw.length) return;
  const y0 = Math.min(...aw.map((e) => e.y0)),
    hg = Math.max(...aw.map((e) => e.h || 0)),
    zug = (pts, zu) => {
      x.beginPath();
      pts.forEach((p, i) => {
        const [X, Y] = grTf(p[0], p[1]);
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      });
      if (zu) x.closePath();
    },
    // Geländer im Grundriss: Glas als feine Doppellinie, sonst eine kräftige Linie
    gel = (pts, G) => {
      if (!G || G.ga === 'ke') return;
      x.setLineDash([]);
      x.strokeStyle = G.ga === 'gl' ? '#5b7f95' : '#222';
      x.lineWidth = G.ga === 'ma' ? 2.4 : G.ga === 'gl' ? 0.8 : 1.4;
      zug(pts);
      x.stroke();
    };
  x.save();
  x.globalAlpha = 1;
  // Loggien dieses Geschosses: Fläche freistellen (liegt außerhalb der Räume)
  const sh = y0 + (+S.gro.sh || 1.2);
  x.globalCompositeOperation = 'destination-out';
  oeLoggiaEinschnitte(b).forEach((z) => {
    if (Math.abs(z.y - y0) > 0.3) return;
    // 3 cm kleiner: die Umrisslinien der Loggia-Wände bleiben voll
    zug(oeLgAussen(z.f, -0.03), true);
    x.fill();
  });
  x.globalCompositeOperation = 'source-over';
  // Eckpfosten der Pfosten-Riegel-Fassaden in Schnitthöhe
  oeEcken(b).forEach((e) => {
    if (e.y0 > sh || e.y1 < sh) return;
    x.fillStyle = '#222';
    zug(oeEckQuadrat(e), true);
    x.fill();
  });
  l2BalkonListe(b).forEach((q) => {
    const dy = q.y0 - y0,
      hier = Math.abs(dy) < 0.3,
      oben = Math.abs(dy - hg) < 0.3;
    if (!hier && !oben) return;
    const n = q.n,
      A = q.p0,
      B = q.p1,
      P = (p, s) => [p[0] + n[0] * s, p[1] + n[1] * s],
      L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1,
      u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L],
      E = (p, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
    if (q.a === 'ba' || q.a === 'bl') {
      const t = q.tb,
        platte = [A, B, P(B, t), P(A, t)];
      if (oben) {
        // Balkon darüber: nur gestrichelter Umriss
        x.setLineDash([5, 3]);
        x.strokeStyle = '#555';
        x.lineWidth = 0.9;
        zug([A, P(A, t), P(B, t), B]);
        x.stroke();
        x.setLineDash([]);
        return;
      }
      x.fillStyle = 'rgba(236,235,231,0.95)';
      zug(platte, true);
      x.fill();
      x.strokeStyle = '#111';
      x.lineWidth = 1.2;
      zug([A, P(A, t), P(B, t), B]);
      x.stroke();
      // Geländer: aufgesetzt 5 cm innerhalb der Plattenkante, seitlich außen davor
      const k = q.gel.gm === 'se' ? -0.03 : 0.05;
      gel([E(A, k), E(P(A, t - k), k), E(P(B, t - k), -k), E(B, -k)], q.gel);
    } else if (hier) {
      // Loggia: Geländer knapp hinter der Fassadenebene
      gel([P(A, -0.08), P(B, -0.08)], q.gel);
    }
  });
  x.restore();
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
/**
 * Terrassenfläche über Geschoss j: Grundriss des Geschosses minus Grundriss darüber minus Innenhöfe (des Geschosses und
 * des Geschosses darüber) – als Polygone { o, h }.
 */
function l2TerrassenFlaeche(b, j) {
  const l = b.levels[j],
    ob = b.levels[j + 1];
  if (!l || !ob) return [];
  try {
    let T2 = boolOp([bpP(lf(b, l))], [bpP(lf(b, ob))], 'd');
    const H = znVoidsAt(b, j)
      .concat(znVoidsAt(b, j + 1))
      .map((v) => bpP(v.poly));
    if (H.length && T2.length) T2 = boolOp(T2, H, 'd');
    return T2;
  } catch (e) {
    logErr(e, 'l2TerrassenFlaeche');
    return [];
  }
}
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
      T2 = l2TerrassenFlaeche(b, j),
      kanten = [f].concat(znVoidsAt(b, j).map((v) => v.poly)),
      ringe = [];
    T2.forEach((P) => {
      if (!P.o || P.o.length < 3 || Math.abs(l2QA(P.o)) < 2) return;
      const drin = (p) => inP(p, P.o) && !(P.h || []).some((h) => inP(p, h));
      [P.o].concat(P.h || []).forEach((r) => ringe.push({ r, drin }));
    });
    ringe.forEach(({ r, drin }) => {
      const n = r.length;
      for (let i = 0; i < n; i++) {
        const a = r[i],
          c = r[(i + 1) % n],
          L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (L < 0.5) continue;
        const ux = (c[0] - a[0]) / L,
          uz = (c[1] - a[1]) / L,
          m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
          // nur Kanten auf der Gebäudeaußenkante (nicht entlang der Wand des Geschosses darüber)
          aussen = kanten.some((F) => F.some((p, k) => proj(m, p, F[(k + 1) % F.length]).d < 0.05));
        if (!aussen) continue;
        // Richtung in die Terrasse
        let nx = -uz,
          nz = ux;
        if (!drin([m[0] + nx * 0.2, m[1] + nz * 0.2])) {
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
    if (b.ex || b._y == null || !an || l2Einfach(b)) return; // in Bewegung oder Bearbeitung: einfacher Körper
    const sig = skSig(b) + '|' + JSON.stringify([(b.l2 && b.l2.c) || 0, b.voids || 0]);
    da.add(b.id);
    let o = L2TG.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    // je Geschoss (Terrassenboden = Boden des Geschosses darüber) eine Gruppe für die Explosionsansicht
    const P = new Map();
    l2TerrassenLinien(b).forEach((x) => {
      const e = lvOfY(b, x.y + 0.1);
      if (!P.has(e)) P.set(e, []);
      l2Stabgelaender(P.get(e), x.A, x.B, x.y);
    });
    const g = new T.Group();
    P.forEach((pos, e) => {
      if (!pos.length) return;
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      ge.computeVertexNormals();
      const m = new T.Mesh(ge, new T.MeshLambertMaterial({ color: 0xa9aeb3, side: T.DoubleSide }));
      m.castShadow = m.receiveShadow = true;
      m.raycast = () => {};
      const sg = new T.Group();
      sg.userData.k = e;
      sg.position.y = S.expl ? exOff(b, e) : 0;
      sg.add(m);
      g.add(sg);
    });
    G.l2.add(g);
    L2TG.set(b.id, { sig, g });
  });
  L2TG.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2TG.delete(id);
  });
}
