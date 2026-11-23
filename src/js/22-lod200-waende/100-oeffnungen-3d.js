// ======================= ÖFFNUNGEN IN LOD 200: WANDAUSSCHNITTE, RAHMEN, GLAS =======================
// Die Öffnungen des Fassadendesigners (oeListe, 19-fassadendesigner/090-oeffnungen.js) werden in Weltkoordinaten
// umgerechnet und den Außenwänden zugeordnet (gleiche Lage, gleiche Höhe). Die Wand wird entlang ihrer Achse in Streifen
// geteilt: neben den Öffnungen voll, im Bereich einer Öffnung nur Brüstung und Sturz – so entstehen echte Laibungen.
// In die Öffnung kommen Rahmen und Einteilung (oeAufteilung, wie in der Ansicht), Glas mit Sprossen bzw. Paneel
// (noch ohne Fensterbank).
// Rücksprünge der Öffnungsgruppen (r = Tiefe): die Wand wird dort ausgespart und dahinter um die Tiefe zurückversetzt
// wieder geschlossen (Vorsprung: zusätzlicher Körper vor der Wand); Fenster im Rücksprung sitzen um dessen Tiefe weiter
// hinten. Nur in LOD 200 (l2MeshOrig); LOD 100 zeigt keine Öffnungen.

/** Öffnungen eines Gebäudes in Weltkoordinaten (zwischengespeichert, solange sich Form und Öffnungen nicht ändern). */
function oeWelt(b) {
  const sg = JSON.stringify([
    fdSig(b),
    b.fd ? Object.keys(b.fd).map((k) => [k, b.fd[k].oe || 0, b.fd[k].gr || 0]) : 0,
    S.oet,
    S.oeg,
  ]);
  if (b._oeW && b._oeW.s === sg) return b._oeW.L;
  const L = [],
    LG = [];
  if (b.fd && b._y != null) {
    const u = ugN(b);
    let ugH = 0;
    for (let i = 0; i < u; i++) ugH += b.levels[i].h;
    const base = b._y + ugH,
      B = fdStoreys(b);
    // Loggien (Rücksprung ab Geschossboden: Art Loggia bzw. Balkon + Loggia oder tiefer als 0,5 m) werden Teil des
    // Grundrisses (oeLoggiaEinschnitte → Wandableitung): echte Außenwände entlang der Loggia statt eines
    // Rücksprungkörpers; Fenster darin sitzen auf der Rückwand
    fdViews(b).forEach((V) =>
      oegRuecksprunge(b, V).forEach((x) => {
        if (!x.d || x.d < 0) return;
        if (!(x.a === 'lo' || x.a === 'bl' || Math.max(x.dl, x.dr) > 0.5)) return;
        if (!B.some((v) => Math.abs(v - x.v0) < 0.05)) return;
        const pc = V.pcs.find(
          (p) => p.pd != null && p.ring && inP([(x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2], p.ring),
        );
        if (!pc) return;
        const W = (uu) => {
          const s = (uu - pc.ua) / pc.dot;
          return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
        };
        const top = B.find((v) => v > x.v0 + 0.05);
        LG.push({
          vk: V.key,
          u0: x.u0,
          u1: x.u1,
          v0: x.v0,
          v1: x.v1,
          p0: W(x.u0),
          p1: W(x.u1),
          n: V.n,
          rl: x.dl,
          rr: x.dr,
          y0: base + x.v0,
          y1: base + x.v1,
          yG: top != null ? base + top : base + x.v1, // Oberkante des Geschosses (Sturz über niedrigerer Loggia)
          vG: top != null ? top : x.v1,
          t: x.t || '', // Material des Gruppenfelds (Rück- und Seitenwände)
          id: x.id,
        });
      }),
    );
    fdViews(b).forEach((V) =>
      oeListe(b, V).forEach((x) => {
        const um = (x.u0 + x.u1) / 2,
          vm = (x.v0 + x.v1) / 2,
          pc = V.pcs.find((p) => p.pd != null && p.ring && inP([um, vm], p.ring));
        if (!pc) return;
        const W = (uu) => {
          const s = (uu - pc.ua) / pc.dot;
          return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
        };
        // in einer Loggia: auf die Rückwand versetzen (Tiefe an der Mitte des Fensters)
        const lg = LG.find((o) => o.vk === V.key && um > o.u0 && um < o.u1 && vm > o.v0 && vm < o.v1),
          t = lg ? lg.rl + (lg.rr - lg.rl) * ((um - lg.u0) / (lg.u1 - lg.u0 || 1)) : 0,
          Z = (p) => [p[0] - V.n[0] * t, p[1] - V.n[1] * t];
        L.push({
          p0: Z(W(x.u0)),
          p1: Z(W(x.u1)),
          y0: base + x.v0,
          y1: base + x.v1,
          T: x.T,
          n: V.n,
          id: x.o.id,
        });
      }),
    );
    // Rücksprünge (aus Öffnungsgruppen), gleiche Umrechnung
    fdViews(b).forEach((V) =>
      oegRuecksprunge(b, V).forEach((x) => {
        if (!x.d || LG.some((o) => o.id === x.id)) return; // Loggien: im Grundriss (siehe oben)
        const pc = V.pcs.find(
          (p) => p.pd != null && p.ring && inP([(x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2], p.ring),
        );
        if (!pc) return;
        const W = (uu) => {
          const s = (uu - pc.ua) / pc.dot;
          return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
        };
        // rl/rr = Tiefe an der Kante bei p0 bzw. p1 (schräger Rücksprung: eine Seite 0)
        L.push({
          p0: W(x.u0),
          p1: W(x.u1),
          y0: base + x.v0,
          y1: base + x.v1,
          r: x.d,
          rl: x.dl,
          rr: x.dr,
          n: V.n,
          id: x.id,
        });
      }),
    );
  }
  b._oeW = { s: sg, L, LG, E: oeEckenFinden(L) };
  return L;
}
/**
 * Einschnitte der Loggien in den Grundriss je Geschoss (für die Wandableitung in LOD 200): { y = Geschossboden,
 * r = Grundriss der Loggia (Fassadenlinie bis Rücksprungtiefe, nach außen 5 cm verlängert), f = ohne Verlängerung,
 * lg = Loggia }.
 */
function oeLoggiaEinschnitte(b) {
  oeWelt(b);
  return ((b._oeW && b._oeW.LG) || []).map((o) => {
    const P = (p, s) => [p[0] + o.n[0] * s, p[1] + o.n[1] * s];
    return {
      y: o.y0,
      r: [P(o.p0, 0.05), P(o.p1, 0.05), P(o.p1, -o.rr), P(o.p0, -o.rl)],
      f: [o.p0, o.p1, P(o.p1, -o.rr), P(o.p0, -o.rl)],
      lg: o,
    };
  });
}
/** Kürzester Abstand eines Punkts m zum Rand des Vielecks P (Grundriss). */
function oeAbstandZuRing(m, P) {
  return Math.min(
    ...P.map((p, i) => {
      const q = P[(i + 1) % P.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        l2 = dx * dx + dz * dz || 1,
        t = Math.max(0, Math.min(1, ((m[0] - p[0]) * dx + (m[1] - p[1]) * dz) / l2));
      return Math.hypot(m[0] - p[0] - dx * t, m[1] - p[1] - dz * t);
    }),
  );
}
/** Vieleck P um k nach außen aufgeweitet (Punkte vom Schwerpunkt weg) – für Lage-Prüfungen am Rand. */
function oeLgAussen(P, k) {
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length,
    cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  return P.map((p) => {
    const dx = p[0] - cx,
      dz = p[1] - cz,
      l = Math.hypot(dx, dz) || 1;
    return [p[0] + (dx / l) * k, p[1] + (dz / l) * k];
  });
}
/** Raumflächen eines Geschosses ohne die Loggia-Einschnitte Z (Flächen wie aus grFill, Eigenschaften bleiben). */
function oeFlaechenKappen(faces, Z) {
  const V = Z.map((z) => bpP(z.r));
  const R = [];
  faces.forEach((f) => {
    try {
      boolOp([{ o: f.o, h: f.h || [] }], V, 'd')
        .filter((p) => p.o && p.o.length >= 3)
        .forEach((p) =>
          R.push({ ...f, o: p.o, h: p.h || [], a: l2QA(p.o) - (p.h || []).reduce((x, h) => x + l2QA(h), 0) }),
        );
    } catch (e) {
      logErr(e, 'oeFlaechenKappen');
      R.push(f);
    }
  });
  return R;
}
/**
 * Pfosten-Riegel über Eck: stoßen zwei Pfosten-Riegel-Öffnungen an einer Außenecke zusammen (gemeinsamer Eckpunkt,
 * Höhen überlappen, andere Richtung, die andere Fassade liegt hinter der Ebene der ersten), entfällt dort das
 * Randprofil beider (T._rd = 0) und ein Eckpfosten verbindet sie. Ergebnis: [{ c, n1, n2, y0, y1, s, rf }]
 */
function oeEckenFinden(L) {
  const E = [],
    P = L.filter((o) => o.T && o.T.a === 'pr'),
    nah = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05;
  P.forEach((o1) =>
    P.forEach((o2) => {
      if (o1 === o2 || o1.n[0] * o2.n[0] + o1.n[1] * o2.n[1] > 0.7) return;
      if (Math.min(o1.y1, o2.y1) - Math.max(o1.y0, o2.y0) < 0.1) return;
      // Ende von o1 (p1) trifft Anfang von o2 (p0) – jede Ecke so genau einmal
      if (!nah(o1.p1, o2.p0)) return;
      const c = o1.p1,
        m2 = [(o2.p0[0] + o2.p1[0]) / 2, (o2.p0[1] + o2.p1[1]) / 2];
      if ((m2[0] - c[0]) * o1.n[0] + (m2[1] - c[1]) * o1.n[1] > -0.01) return; // Innenecke: Profile bleiben
      // Richtungen entlang der Fassaden weg von der Ecke; Eckpfosten = Parallelogramm zwischen beiden Ebenen mit
      // Ansichtsbreite s je Seite (k = s / sin Winkel, auch für spitze und stumpfe Ecken)
      const ein = (p) => {
          const d = [p[0] - c[0], p[1] - c[1]],
            l = Math.hypot(d[0], d[1]) || 1;
          return [d[0] / l, d[1] / l];
        },
        e1 = ein(o1.p0),
        e2 = ein(o2.p1),
        sn = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]),
        s = Math.max(0.1, 2 * o1.T.pb),
        k = s / Math.max(0.25, sn);
      // beide Fassaden enden am Eckpfosten: Randprofil entfällt, Profile und Glas um k gekürzt (T._ek)
      o1.T = { ...o1.T, _rd: { ...o1.T._rd, r: 0 }, _ek: { ...(o1.T._ek || {}), r: k } };
      o2.T = { ...o2.T, _rd: { ...o2.T._rd, l: 0 }, _ek: { ...(o2.T._ek || {}), l: k } };
      E.push({
        c,
        n1: o1.n,
        n2: o2.n,
        e1,
        e2,
        k,
        y0: Math.max(o1.y0, o2.y0),
        y1: Math.min(o1.y1, o2.y1),
        s,
        rf: o1.T.rf,
      });
    }),
  );
  return E;
}
/** Abstand der zurückgesetzten Deckenstirn hinter der Bautiefe der Pfosten-Riegel-Profile (m). */
const OE_PR_DECKE = 0.1;
/**
 * Aussparungen der Geschossdecken hinter durchgehenden Pfosten-Riegel-Fassaden: wo ein Pfosten-Riegel-Abschnitt im
 * Geschoss darüber weiterläuft (gleiche Fassadenebene, Unterkante = Oberkante des unteren), springt die Decke um
 * Bautiefe + OE_PR_DECKE hinter die Außenfläche zurück – die Fassaden beider Geschosse treffen sich vor der
 * Deckenstirn. Ergebnis: [{ y, r }] (y = Höhe der Geschossgrenze, r = Rechteck im Grundriss, nach außen verlängert).
 */
function oeDeckenZonen(b) {
  const P = oeWelt(b).filter((o) => o.T && o.T.a === 'pr'),
    R = [];
  P.forEach((u) =>
    P.forEach((o) => {
      if (u === o || Math.abs(u.y1 - o.y0) > 0.05 || u.n[0] * o.n[0] + u.n[1] * o.n[1] < 0.99) return;
      const d = [u.p1[0] - u.p0[0], u.p1[1] - u.p0[1]],
        l = Math.hypot(d[0], d[1]) || 1,
        e = [d[0] / l, d[1] / l],
        t = (p) => (p[0] - u.p0[0]) * e[0] + (p[1] - u.p0[1]) * e[1],
        q = (o.p0[0] - u.p0[0]) * u.n[0] + (o.p0[1] - u.p0[1]) * u.n[1];
      if (Math.abs(q) > 0.05) return; // nicht in derselben Ebene
      let a = Math.max(0, Math.min(t(o.p0), t(o.p1))),
        c = Math.min(l, Math.max(t(o.p0), t(o.p1)));
      if (c - a < 0.05) return;
      const D = (u.T.pt || 0.16) + OE_PR_DECKE,
        X = (k, s) => [u.p0[0] + e[0] * k + u.n[0] * s, u.p0[1] + e[1] * k + u.n[1] * s],
        // an einer Außenecke des Gebäudes endet das Element am Eckpfosten: die Aussparung reicht dort um die
        // Rücksprungtiefe weiter, sonst bliebe die Deckenecke in der Fassadenebene stehen und stäche durch
        aussen = (k) => !inP(X(k, -0.05), b.fp);
      if (aussen(a - D)) a -= D + 0.05;
      if (aussen(c + D)) c += D + 0.05;
      R.push({ y: u.y1, r: [X(a, 0.5), X(c, 0.5), X(c, -D), X(a, -D)] });
    }),
  );
  return R;
}
/** Deckenflächen (faces) auf Höhe der Geschossgrenze y ohne die Aussparungen hinter Pfosten-Riegel-Fassaden. */
function oeDeckeAussparen(faces, y, Z) {
  const V = Z.filter((z) => Math.abs(z.y - y) < 0.05).map((z) => bpP(z.r));
  if (!V.length) return faces;
  try {
    return boolOp(
      faces.map((f) => ({ o: f.o, h: f.h || [] })),
      V,
      'd',
    )
      .filter((r) => r.o && r.o.length >= 3)
      .map((r) => ({
        o: r.o,
        h: r.h || [],
        a: l2QA(r.o) - (r.h || []).reduce((x, h) => x + l2QA(h), 0),
        fa: 'ge',
      }));
  } catch (e) {
    logErr(e, 'oeDeckeAussparen');
    return faces;
  }
}
/** Eckpfosten der Pfosten-Riegel-Fassaden eines Gebäudes (oeEckenFinden). */
function oeEcken(b) {
  oeWelt(b);
  return (b._oeW && b._oeW.E) || [];
}
/** Grundriss eines Eckpfostens: Parallelogramm von der Außenecke entlang beider Fassaden (je k), passt zu jedem Winkel. */
function oeEckQuadrat(e) {
  const P = (a, b) => [e.c[0] + e.e1[0] * a + e.e2[0] * b, e.c[1] + e.e1[1] * a + e.e2[1] * b];
  return [P(0, 0), P(e.k, 0), P(e.k, e.k), P(0, e.k)];
}
/**
 * Lage der Schichten einer Pfosten-Riegel-Fassade (Abstand von der Außenfläche): außen Deckleiste, dahinter das
 * Glas, dann das tiefe Profil bis zur Bautiefe (wie im Feld: Pressleiste – Verglasung – Pfosten).
 */
const OE_PR_LAGE = { dl: 0.02, g0: 0.023, g1: 0.047, p0: 0.05 };
/** Kennung der Öffnungen eines Gebäudes (für den Abgleich in l2Sync). */
function oeGebSig(b) {
  if (!b.fd) return '';
  const L = Object.keys(b.fd).map((k) => [(b.fd[k] && b.fd[k].oe) || 0, (b.fd[k] && b.fd[k].gr) || 0]);
  return L.some((x) => (x[0] && x[0].length) || (x[1] && x[1].length))
    ? JSON.stringify([L, S.oet, S.oeg])
    : '';
}
/** Gebäude zu einem Bauteil (Kennung beginnt mit der Gebäudekennung). */
function oeBauteilGebaeude(e) {
  return S.bld.find((b) => !b.ex && e.id && e.id.startsWith(b.id + ':')) || null;
}
/** Achse und Außenseite einer Außenwand: Richtung d, Normale nach außen n, Lage der Außen- und Innenfläche. */
function oeWandAchse(e, nAussen) {
  let dx = e.sb[0] - e.sa[0],
    dz = e.sb[1] - e.sa[1];
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  let nx = -dz,
    nz = dx;
  if (nx * nAussen[0] + nz * nAussen[1] < 0) {
    nx = -nx;
    nz = -nz;
  }
  let sMax = -1e9,
    sMin = 1e9;
  e.quads.forEach((q) =>
    q.forEach((p) => {
      const s = p[0] * nx + p[1] * nz;
      sMax = Math.max(sMax, s);
      sMin = Math.min(sMin, s);
    }),
  );
  return { d: [dx, dz], n: [nx, nz], sA: sMax, sI: sMin };
}
/**
 * Öffnungen einer Außenwand (Bauteil e der LOD-200-Ableitung): t0/t1 entlang der Wandachse, y0/y1 über der
 * Wandunterkante (auf die Wandhöhe begrenzt). Leer, wenn die Wand keine Öffnung trägt.
 */
function oeWandOeffnungen(e) {
  if (e.kind !== 'AW' || !e.quads || !e.sa || !e.sb) return [];
  const b = oeBauteilGebaeude(e);
  if (!b || !b.fd) return [];
  const L = oeWelt(b);
  if (!L.length) return [];
  const R = [],
    ax = e.sb[0] - e.sa[0],
    az = e.sb[1] - e.sa[1],
    len = Math.hypot(ax, az) || 1,
    dx = ax / len,
    dz = az / len;
  // jede Öffnung genau einer Wand zuordnen: der nächstgelegenen gleich ausgerichteten im selben Höhenbereich
  const W = l2Els(b).els.filter((w) => w.kind === 'AW' && w.quads && w.sa && w.sb),
    abstand = (w, o) => {
      const ax2 = w.sb[0] - w.sa[0],
        az2 = w.sb[1] - w.sa[1],
        l2 = Math.hypot(ax2, az2) || 1,
        ux = ax2 / l2,
        uz = az2 / l2;
      if (Math.abs(o.n[0] * ux + o.n[1] * uz) > 0.35) return 1e9;
      if (Math.min(w.y0 + w.h, o.y1) - Math.max(w.y0, o.y0) < 0.05) return 1e9;
      const mx = (o.p0[0] + o.p1[0]) / 2,
        mz = (o.p0[1] + o.p1[1]) / 2,
        t = (mx - w.sa[0]) * ux + (mz - w.sa[1]) * uz,
        q = Math.abs((mx - w.sa[0]) * -uz + (mz - w.sa[1]) * ux),
        aus = Math.max(0, -t, t - l2);
      return q + aus * 10;
    };
  // Loggia-Räume des ganzen Gebäudes (Grundriss, Höhe relativ zu dieser Wand): Rück- und Seitenwände einer Loggia
  // werden daran beschnitten, damit sie an Ecken nicht in die Loggia der Nachbarseite ragen
  const lraeume = L.filter((o) => o.r > 0.3).map((o) => ({
    o: [
      o.p0,
      o.p1,
      [o.p1[0] - o.n[0] * (o.rr ?? o.r), o.p1[1] - o.n[1] * (o.rr ?? o.r)],
      [o.p0[0] - o.n[0] * (o.rl ?? o.r), o.p0[1] - o.n[1] * (o.rl ?? o.r)],
    ],
    y0: o.y0 - e.y0,
    y1: o.y1 - e.y0,
  }));
  L.forEach((o) => {
    const ich = abstand(e, o);
    if (ich >= 1e9 || W.some((w) => w !== e && abstand(w, o) < ich - 1e-6)) return;
    // gleiche Wandrichtung (Normale der Ansicht senkrecht zur Achse), Mitte nahe der Achse und innerhalb der Länge
    if (Math.abs(o.n[0] * dx + o.n[1] * dz) > 0.35) return;
    const mx = (o.p0[0] + o.p1[0]) / 2,
      mz = (o.p0[1] + o.p1[1]) / 2,
      t = (mx - e.sa[0]) * dx + (mz - e.sa[1]) * dz,
      q = Math.abs((mx - e.sa[0]) * -dz + (mz - e.sa[1]) * dx);
    if (t < -0.05 || t > len + 0.05 || q > (e.d || 0.4) + 0.6) return;
    // Pfosten-Riegel läuft bis zu seiner Oberkante (Geschossgrenze) vor der Decke weiter – die Wand endet unter der
    // Decke, sonst bliebe zwischen den Riegeln zweier Geschosse die Deckenstärke frei (Decke springt dort zurück,
    // oeDeckenZonen)
    const pr = !!(o.T && o.T.a === 'pr'),
      y0 = Math.max(0, o.y0 - e.y0),
      y1 = pr ? o.y1 - e.y0 : Math.min(e.h, o.y1 - e.y0);
    if (y1 - y0 < 0.05) return;
    const A = oeWandAchse(e, o.n),
      t0 = o.p0[0] * A.d[0] + o.p0[1] * A.d[1],
      t1 = o.p1[0] * A.d[0] + o.p1[1] * A.d[1],
      dreh = t1 < t0;
    R.push({
      t0: Math.min(t0, t1),
      t1: Math.max(t0, t1),
      // Tiefe am Anfang/Ende der Wandachse (bei umgekehrter Richtung getauscht)
      ra: o.r ? (dreh ? o.rr : o.rl) : 0,
      re: o.r ? (dreh ? o.rl : o.rr) : 0,
      y0,
      y1,
      T: o.T,
      r: o.r,
      A,
      voll: o.y1 - e.y0 <= e.h + 0.01,
      lv: o.r ? lraeume : null,
    });
  });
  // Fenster in einem Rücksprung: Tiefe des Rücksprungs merken (Rahmen sitzt entsprechend weiter innen bzw. außen)
  R.forEach((o) => {
    if (o.r) return;
    const tm = (o.t0 + o.t1) / 2,
      ym = (o.y0 + o.y1) / 2,
      rs = R.find((q) => q.r && q.t0 <= tm && q.t1 >= tm && q.y0 <= ym && q.y1 >= ym);
    o.rk = rs ? oeTiefeBei(rs, tm) : 0;
  });
  return R;
}
/** Kennung für den Neuaufbau einer Wand in l2Sync (ändert sich mit ihren Öffnungen). */
function oeWandSig(e) {
  const O = oeWandOeffnungen(e);
  return O.length ? O.map((o) => [o.t0, o.t1, o.y0, o.y1, o.T || [o.ra, o.re], o.rk || 0]) : 0;
}
/** Vieleck auf den Achsbereich t ∈ [a, c] beschneiden (Sutherland-Hodgman, zwei Halbebenen). */
function oeSchneide(P, d, a, c) {
  const halb = (Q, f) => {
    const R = [];
    for (let i = 0; i < Q.length; i++) {
      const p = Q[i],
        q = Q[(i + 1) % Q.length],
        fp = f(p),
        fq = f(q);
      if (fp >= 0) R.push(p);
      if (fp * fq < 0) {
        const k = fp / (fp - fq);
        R.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    return R;
  };
  const t = (p) => p[0] * d[0] + p[1] * d[1];
  return halb(
    halb(P, (p) => t(p) - a),
    (p) => c - t(p),
  );
}
/**
 * Wandkörper mit Öffnungen in Stücke teilen: je Achsabschnitt die verbleibenden Höhenbereiche.
 * @returns {[{o:number[][],h:[]}, number, number][]} Grundriss des Stücks, Unter- und Oberkante (über Wandunterkante)
 */
function oeWandTeilen(e, O) {
  const d = O[0].A.d,
    gr = [...new Set(O.flatMap((o) => [o.t0, o.t1]))].sort((a, c) => a - c),
    G = [-1e5, ...gr, 1e5],
    R = [];
  for (let i = 0; i < G.length - 1; i++) {
    const a = G[i],
      c = G[i + 1];
    if (c - a < 1e-4) continue;
    const m = (a + c) / 2,
      L = O.filter((o) => o.t0 < m && o.t1 > m)
        .map((o) => [o.y0, o.y1])
        .sort((p, q) => p[0] - q[0]);
    // verbleibende Höhenbereiche = [0, h] ohne die Öffnungen
    const H = [];
    let y = 0;
    L.forEach(([y0, y1]) => {
      if (y0 > y + 1e-3) H.push([y, y0]);
      y = Math.max(y, y1);
    });
    if (y < e.h - 1e-3) H.push([y, e.h]);
    if (!H.length) continue;
    e.quads.forEach((q) => {
      const P = oeSchneide(q, d, a, c);
      if (P.length < 3) return;
      H.forEach(([y0, y1]) => R.push([{ o: P, h: [] }, y0, y1]));
    });
  }
  return R;
}
/**
 * Wandstück vor der Deckenstirn (quads2, Höhe hTop über der Wand) in Stücken wie oeWandTeilen: wo eine
 * Pfosten-Riegel-Fassade über die Wandoberkante bis zur Geschossgrenze läuft, entfällt es – dort steht das Element vor
 * der zurückgesetzten Decke (oeDeckenZonen).
 */
function oeDeckenband(e) {
  const voll = () => e.quads2.map((q) => [{ o: q, h: [] }, 0, e.hTop]);
  let O = [];
  try {
    O = oeWandOeffnungen(e)
      .filter((o) => !o.r && o.T && o.T.a === 'pr' && o.y1 > e.h + 0.01)
      .map((o) => Object.assign({}, o, { y0: Math.max(0, o.y0 - e.h), y1: o.y1 - e.h }));
  } catch (er) {
    logErr(er, 'oeDeckenband');
  }
  return O.length ? oeWandTeilen({ quads: e.quads2, h: e.hTop }, O) : voll();
}
/** Rechteck [t0,t1]×[y0,y1] ohne die Rechtecke L (in Teilrechtecke zerlegt). */
function oeRechteckOhne(t0, t1, y0, y1, L) {
  const gr = [t0, t1, ...L.flatMap((o) => [o.t0, o.t1]).filter((x) => x > t0 && x < t1)].sort(
      (a, c) => a - c,
    ),
    R = [];
  for (let i = 0; i < gr.length - 1; i++) {
    const a = gr[i],
      c = gr[i + 1];
    if (c - a < 1e-4) continue;
    const m = (a + c) / 2,
      H = L.filter((o) => o.t0 < m && o.t1 > m)
        .map((o) => [Math.max(y0, o.y0), Math.min(y1, o.y1)])
        .filter(([p, q]) => q > p)
        .sort((p, q) => p[0] - q[0]);
    let y = y0;
    H.forEach(([p, q]) => {
      if (p > y + 1e-3) R.push([a, c, y, p]);
      y = Math.max(y, q);
    });
    if (y < y1 - 1e-3) R.push([a, c, y, y1]);
  }
  return R;
}
/**
 * Wandkörper der Rücksprünge: zurückversetzte Rückwand (Tiefe > 0) bzw. Vorsprung vor der Wand (Tiefe < 0), jeweils
 * ohne die Öffnungen darin. Ergebnis wie oeWandTeilen: [Grundriss, Unterkante, Oberkante].
 */
function oeRuecksprungKoerper(O) {
  const R = [];
  O.filter((o) => o.r).forEach((rs) => {
    const A = rs.A,
      zurueck = Math.max(rs.ra, rs.re) > 0,
      P = (t, s) => [A.d[0] * t + A.n[0] * s, A.d[1] * t + A.n[1] * s],
      L = O.filter((o) => !o.r && o.t1 > rs.t0 && o.t0 < rs.t1 && o.y1 > rs.y0 && o.y0 < rs.y1);
    const tw = A.sA - A.sI;
    if (zurueck && oeLoggia(rs, A)) {
      // Loggia (Rücksprung tiefer als die Wand): Rückwand in Wandstärke hinter der zurückversetzten Fläche (mit den
      // Öffnungen) und zwei Seitenwände neben dem Rücksprung, von der Wandinnenseite bis hinter die Rückwand
      oeRechteckOhne(rs.t0, rs.t1, rs.y0, rs.y1, L).forEach(([a, c, ya, yb]) => {
        const da = oeTiefeBei(rs, a),
          dc = oeTiefeBei(rs, c);
        oeLoggiaBeschnitt(
          [P(a, A.sA - da - tw), P(c, A.sA - dc - tw), P(c, A.sA - dc), P(a, A.sA - da)],
          rs,
          ya,
          yb,
        ).forEach((f) => R.push([f, ya, yb]));
      });
      [
        [rs.t0 - tw, rs.t0, rs.ra],
        [rs.t1, rs.t1 + tw, rs.re],
      ].forEach(([a, c, d]) => {
        if (d > tw + 0.01)
          oeLoggiaBeschnitt(
            [P(a, A.sI), P(c, A.sI), P(c, A.sA - d - tw), P(a, A.sA - d - tw)],
            rs,
            rs.y0,
            rs.y1,
          ).forEach((f) => R.push([f, rs.y0, rs.y1]));
      });
      return;
    }
    oeRechteckOhne(rs.t0, rs.t1, rs.y0, rs.y1, L).forEach(([a, c, ya, yb]) => {
      // Rücksprung: von der Wandinnenseite bis zur (ggf. schrägen) zurückversetzten Fläche; Vorsprung: von der
      // Außenfläche bis zur vorstehenden Fläche
      const da = oeTiefeBei(rs, a),
        dc = oeTiefeBei(rs, c),
        s0 = zurueck ? A.sI : A.sA,
        Q = [P(a, s0), P(c, s0), P(c, A.sA - dc), P(a, A.sA - da)].filter(
          (q, i, X) =>
            Math.hypot(
              q[0] - X[(i + X.length - 1) % X.length][0],
              q[1] - X[(i + X.length - 1) % X.length][1],
            ) > 1e-4,
        );
      if (Q.length >= 3) R.push([{ o: Q, h: [] }, ya, yb]);
    });
  });
  return R;
}
/**
 * Wandstück Q (Grundriss) einer Loggia ohne die Loggia-Räume des Gebäudes in gleicher Höhe (rs.lv). Ergebnis: Flächen
 * { o, h } für die Extrusion bzw. den Grundriss.
 */
function oeLoggiaBeschnitt(Q, rs, ya, yb) {
  const V = (rs.lv || []).filter((v) => v.y0 < yb - 0.01 && v.y1 > ya + 0.01).map((v) => bpP(v.o));
  if (!V.length) return [bpP(Q)];
  try {
    return boolOp([bpP(Q)], V, 'd').filter((r) => r.o && r.o.length >= 3);
  } catch (e) {
    logErr(e, 'oeLoggiaBeschnitt');
    return [bpP(Q)];
  }
}
/** Loggia: Rücksprung tiefer als die Wand – bekommt Rück- und Seitenwände in Wandstärke statt eines vollen Körpers. */
function oeLoggia(rs, A) {
  return Math.max(rs.ra, rs.re) > A.sA - A.sI + 0.01;
}
/**
 * Innenseite der Wand, in der eine Öffnung sitzt: in einer Loggia die Innenseite der Rückwand (Wandstärke hinter der
 * zurückversetzten Fläche), sonst die der Außenwand.
 */
function oeInnenseite(o, A) {
  const tw = A.sA - A.sI,
    rk = o.rk || 0;
  return rk > tw + 0.01 ? A.sA - rk - tw : A.sI;
}
/** Tiefe eines (ggf. schrägen) Rücksprungs an der Achsstelle t. */
function oeTiefeBei(rs, t) {
  const k = rs.t1 - rs.t0 > 1e-6 ? Math.max(0, Math.min(1, (t - rs.t0) / (rs.t1 - rs.t0))) : 0;
  return rs.ra + (rs.re - rs.ra) * k;
}
/** Rahmen, Glas bzw. Türblatt der Öffnungen einer Wand (Gruppe relativ zur Wandunterkante). */
function oeKoerper(O) {
  const g = new T.Group(),
    teile = new Map(),
    feld = (farbe) => {
      let a = teile.get(farbe);
      if (!a) teile.set(farbe, (a = []));
      return a;
    };
  // Quader in Wandkoordinaten (t entlang der Achse, y Höhe, s entlang der Außennormale)
  const quader = (arr, A, t0, t1, y0, y1, s0, s1) => {
    const P = (t, y, s) => [A.d[0] * t + A.n[0] * s, y, A.d[1] * t + A.n[1] * s],
      c = [
        P(t0, y0, s0),
        P(t1, y0, s0),
        P(t1, y1, s0),
        P(t0, y1, s0),
        P(t0, y0, s1),
        P(t1, y0, s1),
        P(t1, y1, s1),
        P(t0, y1, s1),
      ];
    [
      [0, 2, 1, 0, 3, 2],
      [4, 5, 6, 4, 6, 7],
      [0, 1, 5, 0, 5, 4],
      [3, 6, 2, 3, 7, 6],
      [0, 4, 7, 0, 7, 3],
      [1, 2, 6, 1, 6, 5],
    ].forEach((f) => f.forEach((i) => arr.push(...c[i])));
  };
  O.forEach((o) => {
    const T_ = o.T,
      A = o.A,
      tief = T_.pt || 0.08, // Pfosten-Riegel: Bautiefe der Profile
      sAo = A.sA - (o.rk || 0), // Außenfläche am Fenster (im Rücksprung zurückversetzt)
      sV = sAo - Math.min(T_.et, Math.max(0, sAo - oeInnenseite(o, A) - tief)),
      sH = sV - tief,
      sm = (sH + sV) / 2,
      R = feld(T_.rf),
      L = oeAufteilung(T_),
      // Öffnung oben von der Wand abgeschnitten (über die Geschosshöhe): Einteilung senkrecht stauchen
      ky = Math.min(1, (o.y1 - o.y0) / T_.h),
      Tt = (x) => o.t0 + x * ((o.t1 - o.t0) / T_.b),
      Yy = (y) => o.y0 + y * ky;
    const pr = T_.a === 'pr',
      Q = OE_PR_LAGE;
    // 5. Wert eines Stegs: Anteil der Tiefe (Riegel der Pfosten-Riegel-Fassade, außen bündig mit den Pfosten)
    L.stege.forEach(([a, c, d, e, k]) => {
      if (c - a < 1e-4 || e - d < 1e-4) return; // Randprofil entfällt (Eckpfosten)
      if (pr) {
        // Deckleiste vor dem Glas, Profil dahinter bis zur Bautiefe
        quader(R, A, Tt(a), Tt(c), Yy(d), Yy(e), sV - Q.dl, sV);
        quader(R, A, Tt(a), Tt(c), Yy(d), Yy(e), sV - tief * (k || 1), sV - Q.p0);
      } else quader(R, A, Tt(a), Tt(c), Yy(d), Yy(e), k ? sV - tief * k : sH, sV);
    });
    L.felder.forEach((f) => {
      if (f.fu === 'l') return; // Feld mit Einsatz (eigene Öffnung)
      const x0 = Tt(f.x0),
        x1 = Tt(f.x1),
        y0 = Yy(f.y0),
        y1 = Yy(f.y1);
      // Pfosten-Riegel: Glas bzw. Paneel in der Glasebene hinter der Deckleiste (bis unter die Profile)
      const fx0 = pr ? Tt(Math.max(0, f.x0 - L.pb / 2)) : x0,
        fx1 = pr ? Tt(Math.min(T_.b, f.x1 + L.pb / 2)) : x1,
        fy0 = pr ? Yy(Math.max(0, f.y0 - L.pb / 2)) : y0,
        fy1 = pr ? Yy(Math.min(T_.h, f.y1 + L.pb / 2)) : y1,
        g0 = pr ? sV - Q.g1 : sm - 0.005,
        g1 = pr ? sV - Q.g0 : sm + 0.005;
      if (T_.a === 'to' || f.fu === 'p')
        // Paneel in Rahmenfarbe
        quader(
          feld(T_.a === 'to' ? '#c6cbd0' : T_.rf),
          A,
          fx0,
          fx1,
          fy0,
          fy1,
          pr ? g0 : sm - 0.025,
          pr ? g1 : sm + 0.025,
        );
      else {
        quader(feld('glas'), A, fx0, fx1, fy0, fy1, g0, g1);
        // Sprossen vor dem Glas
        const sr = f.sr || [0, 0],
          sb = 0.025;
        for (let i = 1; i <= sr[0]; i++) {
          const y = y0 + ((y1 - y0) * i) / (sr[0] + 1);
          quader(R, A, x0, x1, y - sb / 2, y + sb / 2, sm, sV);
        }
        for (let i = 1; i <= sr[1]; i++) {
          const x = x0 + ((x1 - x0) * i) / (sr[1] + 1);
          quader(R, A, x - sb / 2, x + sb / 2, y0, y1, sm, sV);
        }
      }
    });
  });
  teile.forEach((pos, farbe) => {
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    ge.computeVertexNormals();
    const glas = farbe === 'glas',
      m = new T.Mesh(
        ge,
        new T.MeshLambertMaterial({
          color: new T.Color(glas ? '#ffffff' : farbe),
          transparent: glas,
          opacity: glas ? 0.2 : 1, // Glas weiß, 80 % durchsichtig
          side: T.DoubleSide,
        }),
      );
    m.castShadow = !glas;
    m.receiveShadow = true;
    m.raycast = () => {};
    m.userData.oe = 1;
    // Glas: in Realistisch+ spiegelndes Glas (06-darstellung/050-glas-realistisch-plus.js)
    if (glas) m.userData.glas = 1;
    g.add(m);
  });
  return g;
}

// ---- Grundriss (LOD 200): Öffnungen und Rück-/Vorsprünge im Schnitt
/**
 * Öffnungen der Außenwände im Grundriss zeichnen – gleiche Zuordnung wie im 3D-Modell (oeWandOeffnungen).
 * Geschnittene Öffnungen (Schnitthöhe des Grundrisses S.gro.sh über dem Fußboden innerhalb): Wand ausgespart, Laibungen, Rahmen mit Glas bzw. Türblatt mit
 * Aufschlag; höher liegende Öffnungen gestrichelt. Rück-/Vorsprünge in Schnitthöhe ändern die Wandkontur.
 * @param {CanvasRenderingContext2D} x  Zeichenfläche des Grundrisses (Weltkoordinaten über grTf)
 * @param {object[]} wl  Wände des Geschosses (l2Els)
 * @param {string} wandFarbe  Füllfarbe der Wände (für Vorsprünge)
 */
function oeGrundriss(x, wl, wandFarbe) {
  const zug = (pts) => {
    x.beginPath();
    pts.forEach((p, i) => {
      const [X, Y] = grTf(p[0], p[1]);
      i ? x.lineTo(X, Y) : x.moveTo(X, Y);
    });
  };
  wl.forEach((e) => {
    if (e.kind !== 'AW') return;
    const O = oeWandOeffnungen(e);
    if (!O.length) return;
    const A = O[0].A,
      P = (t, s) => [A.d[0] * t + A.n[0] * s, A.d[1] * t + A.n[1] * s],
      sh = +S.gro.sh || 1.2,
      imSchnitt = (o) => o.y0 <= sh && o.y1 >= sh;
    x.save();
    x.globalAlpha = 1;
    x.setLineDash([]);
    // Rück-/Vorsprünge in Schnitthöhe: Außenkontur versetzen
    O.filter((o) => o.r && imSchnitt(o)).forEach((o) => {
      const a = [o.t0, A.sA - oeTiefeBei(o, o.t0)],
        c = [o.t1, A.sA - oeTiefeBei(o, o.t1)],
        flaeche = [P(o.t0, A.sA), P(o.t1, A.sA), P(c[0], c[1]), P(a[0], a[1])];
      if (oeLoggia(o, A)) {
        // Loggia: Fläche frei (draußen), Rück- und Seitenwände in Wandstärke als Wand gezeichnet
        const tw = A.sA - A.sI,
          wand = [
            [P(o.t0 - tw, A.sI), P(o.t0, A.sI), P(a[0], a[1]), P(a[0], a[1] - tw), P(o.t0 - tw, a[1] - tw)],
            [P(o.t1, A.sI), P(o.t1 + tw, A.sI), P(o.t1 + tw, c[1] - tw), P(c[0], c[1] - tw), P(c[0], c[1])],
            [P(a[0], a[1]), P(c[0], c[1]), P(c[0], c[1] - tw), P(a[0], a[1] - tw)],
          ];
        x.globalCompositeOperation = 'destination-out';
        zug(flaeche);
        x.closePath();
        x.fill();
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = wandFarbe;
        wand.forEach((w) =>
          oeLoggiaBeschnitt(w, o, o.y0, o.y1).forEach((f) => {
            [f.o].concat(f.h || []).forEach((ring) => {
              zug(ring);
              x.closePath();
              x.fill();
            });
          }),
        );
        x.strokeStyle = '#111';
        x.lineWidth = 1.6;
        // Außenkontur um die Loggia und Innenkontur der Wände dahinter
        zug([P(o.t0, A.sA), P(a[0], a[1]), P(c[0], c[1]), P(o.t1, A.sA)]);
        x.stroke();
        // Innenkontur nur außerhalb der Loggia-Räume (an Ecken liegt die Nachbarloggia darüber)
        x.save();
        x.beginPath();
        x.rect(-1e5, -1e5, 2e5, 2e5);
        (o.lv || [])
          .filter((v) => v.y0 < o.y1 - 0.01 && v.y1 > o.y0 + 0.01)
          .forEach((v) =>
            v.o.forEach((p, i) => {
              const [X, Y] = grTf(p[0], p[1]);
              i ? x.lineTo(X, Y) : x.moveTo(X, Y);
            }),
          );
        x.clip('evenodd');
        zug([P(o.t0 - tw, A.sI), P(o.t0 - tw, a[1] - tw), P(c[0] + tw, c[1] - tw), P(o.t1 + tw, A.sI)]);
        x.stroke();
        x.restore();
        return;
      }
      if (Math.max(o.ra, o.re) > 0) {
        x.globalCompositeOperation = 'destination-out';
        zug(flaeche);
        x.closePath();
        x.fill();
        x.globalCompositeOperation = 'source-over';
      } else {
        x.fillStyle = wandFarbe;
        zug(flaeche);
        x.closePath();
        x.fill();
      }
      x.strokeStyle = '#111';
      x.lineWidth = 1.6;
      zug([P(o.t0, A.sA), P(a[0], a[1]), P(c[0], c[1]), P(o.t1, A.sA)]);
      x.stroke();
    });
    O.filter((o) => !o.r).forEach((o) => {
      const T = o.T,
        sAo = A.sA - (o.rk || 0),
        sIo = oeInnenseite(o, A),
        tief = T.pt || 0.08, // Pfosten-Riegel: Bautiefe der Profile
        sV = sAo - Math.min(T.et, Math.max(0, sAo - sIo - tief)),
        sH = sV - tief,
        t0 = o.t0,
        t1 = o.t1;
      if (!imSchnitt(o)) {
        // über der Schnittebene: gestrichelter Umriss
        x.strokeStyle = '#333';
        x.lineWidth = 1;
        x.setLineDash([4, 3]);
        zug([P(t0, sIo), P(t1, sIo), P(t1, sAo), P(t0, sAo)]);
        x.closePath();
        x.stroke();
        x.setLineDash([]);
        return;
      }
      // Wand aussparen (von innen bis zur ggf. versetzten Außenfläche)
      x.globalCompositeOperation = 'destination-out';
      zug([P(t0, sIo - 0.01), P(t1, sIo - 0.01), P(t1, sAo + 0.01), P(t0, sAo + 0.01)]);
      x.closePath();
      x.fill();
      x.globalCompositeOperation = 'source-over';
      // Laibungen
      x.strokeStyle = '#111';
      x.lineWidth = 1.6;
      zug([P(t0, sIo), P(t0, sAo)]);
      x.stroke();
      zug([P(t1, sIo), P(t1, sAo)]);
      x.stroke();
      // Rahmen (Pfosten-Riegel: Profile einzeln, siehe unten)
      x.strokeStyle = '#222';
      x.lineWidth = 1;
      if (T.a !== 'pr') {
        zug([P(t0, sH), P(t1, sH), P(t1, sV), P(t0, sV)]);
        x.closePath();
        x.stroke();
      }
      if (oeTuer(T)) {
        // Türblatt nach innen mit Aufschlag (Viertelkreis)
        const b = t1 - t0,
          h0 = P(t0, sH),
          [HX, HY] = grTf(h0[0], h0[1]),
          e1 = P(t0, sH - b),
          [EX, EY] = grTf(e1[0], e1[1]),
          z1 = P(t1, sH),
          [ZX, ZY] = grTf(z1[0], z1[1]),
          r = Math.hypot(EX - HX, EY - HY);
        x.lineWidth = 1.2;
        x.beginPath();
        x.moveTo(HX, HY);
        x.lineTo(EX, EY);
        x.stroke();
        x.lineWidth = 0.8;
        x.setLineDash([3, 2]);
        x.beginPath();
        const w0 = Math.atan2(EY - HY, EX - HX),
          w1 = Math.atan2(ZY - HY, ZX - HX);
        let dw = w1 - w0;
        while (dw > Math.PI) dw -= 2 * Math.PI;
        while (dw < -Math.PI) dw += 2 * Math.PI;
        x.arc(HX, HY, r, w0, w1, dw < 0);
        x.stroke();
        x.setLineDash([]);
      } else {
        if (T.a === 'pr') {
          // Pfosten-Riegel im Schnitt: Deckleiste außen, Glas, Pfostenprofil dahinter
          const ys = sh - o.y0,
            k = (o.t1 - o.t0) / T.b,
            Q = OE_PR_LAGE;
          x.fillStyle = '#222';
          oeAufteilung(T).stege.forEach(([a, c, d, e2, kk]) => {
            if (kk || ys < d || ys > e2 || c - a < 1e-4) return;
            [
              [sV - Q.dl, sV],
              [sH, sV - Q.p0],
            ].forEach(([s0, s1]) => {
              zug([P(t0 + a * k, s0), P(t0 + c * k, s0), P(t0 + c * k, s1), P(t0 + a * k, s1)]);
              x.closePath();
              x.fill();
            });
          });
          x.lineWidth = 0.7;
          zug([P(t0, sV - Q.g0), P(t1, sV - Q.g0)]);
          x.stroke();
          zug([P(t0, sV - Q.g1), P(t1, sV - Q.g1)]);
          x.stroke();
          return;
        }
        // Glas: zwei feine Linien in der Rahmenmitte
        const sm = (sH + sV) / 2;
        x.lineWidth = 0.7;
        zug([P(t0, sm - 0.012), P(t1, sm - 0.012)]);
        x.stroke();
        zug([P(t0, sm + 0.012), P(t1, sm + 0.012)]);
        x.stroke();
      }
    });
    x.restore();
  });
}
