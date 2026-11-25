// ---- Fassadenauswertung LOD 200: Wände der Loggien
// Loggien sind in LOD 200 in den Grundriss eingeschnitten (oeLoggiaEinschnitte). Die Fassade läuft dort um die
// Loggia herum: in der Fassadenebene fehlt die Öffnung, dafür kommen Rückwand und Seitenwände hinzu. Die Metriken
// zählen und zeigen die Fassade in LOD 200 so (l2FassadeWert, l2FassadenBand), in LOD 100 als ebene Hülle.

/**
 * Wandflächen der Loggien eines Gebäudes: [{ art: 'rueck'|'seite', Q: 4 Punkte [x, y, z], a (m²), li, nm }] und die
 * Öffnung in der Fassadenebene je Loggia ({ art: 'oeff' }, ohne Q).
 */
function l2LoggiaWaende(b) {
  const R = [];
  if (!l2on() || b.ex) return R;
  try {
    oeLoggiaEinschnitte(b).forEach((z) => {
      const o = z.lg,
        h = Math.max(0, o.y1 - o.y0);
      if (h < 0.05) return;
      const P = (p, s) => [p[0] + o.n[0] * s, p[1] + o.n[1] * s],
        A = o.p0,
        B = o.p1,
        Ai = P(o.p0, -o.rl),
        Bi = P(o.p1, -o.rr),
        li = lvOfY(b, o.y0 + 0.1),
        nm = typeof li === 'number' ? lname(b, li) : 'Dach',
        quad = (p, q) => [
          [p[0], o.y0, p[1]],
          [q[0], o.y0, q[1]],
          [q[0], o.y1, q[1]],
          [p[0], o.y1, p[1]],
        ],
        L = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
      R.push({ art: 'oeff', a: L(A, B) * h, li, nm });
      R.push({ art: 'rueck', Q: quad(Ai, Bi), a: L(Ai, Bi) * h, li, nm });
      if (o.rl > 0.01) R.push({ art: 'seite', Q: quad(A, Ai), a: o.rl * h, li, nm });
      if (o.rr > 0.01) R.push({ art: 'seite', Q: quad(B, Bi), a: o.rr * h, li, nm });
    });
  } catch (e) {
    logErr(e, 'l2LoggiaWaende');
  }
  return R;
}
/** Summen: { oeff, rueck, seite } in m². */
function l2LoggiaZahlen(b) {
  const z = { oeff: 0, rueck: 0, seite: 0 };
  l2LoggiaWaende(b).forEach((w) => (z[w.art] += w.a));
  return z;
}
/**
 * Wandstreifen von a nach c (Grundriss) zwischen y0 und y1 als Dreiecke, ohne die Öffnungen O ({ p0, p1, y0, y1 }),
 * die auf dieser Linie liegen (bis 5 cm daneben).
 */
function l2WandOhne(a, c, y0, y1, O) {
  const pos = [],
    L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (L < 1e-4 || y1 - y0 < 1e-4) return pos;
  const d = [(c[0] - a[0]) / L, (c[1] - a[1]) / L],
    t = (p) => (p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1],
    q = (p) => Math.abs((p[0] - a[0]) * -d[1] + (p[1] - a[1]) * d[0]),
    L2 = O.filter((o) => q(o.p0) < 0.05 && q(o.p1) < 0.05)
      .map((o) => ({
        t0: Math.max(0, Math.min(t(o.p0), t(o.p1))),
        t1: Math.min(L, Math.max(t(o.p0), t(o.p1))),
        y0: Math.max(y0, o.y0),
        y1: Math.min(y1, o.y1),
      }))
      .filter((o) => o.t1 - o.t0 > 1e-3 && o.y1 - o.y0 > 1e-3),
    P = (s, y) => [a[0] + d[0] * s, y, a[1] + d[1] * s];
  (L2.length ? oeRechteckOhne(0, L, y0, y1, L2) : [[0, L, y0, y1]]).forEach(([s0, s1, ya, yb]) => {
    const A = P(s0, ya),
      B = P(s1, ya),
      C = P(s1, yb),
      D = P(s0, yb);
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  });
  return pos;
}
/** Öffnungen der Fassade (Fenster, Türen, Pfosten-Riegel; ohne Rücksprünge/Loggien) im Grundriss mit Höhen. */
function l2FassadenOeffnungen(b) {
  try {
    return oeWelt(b)
      .filter((o) => o.T && !o.r)
      .map((o) => ({ p0: o.p0, p1: o.p1, y0: o.y0, y1: o.y1 }));
  } catch (e) {
    logErr(e, 'l2FassadenOeffnungen');
    return [];
  }
}
/** Öffnungen der Loggien in der Fassadenebene. */
function l2LoggiaOeffnungen(b) {
  try {
    return oeLoggiaEinschnitte(b).map((z) => ({ p0: z.lg.p0, p1: z.lg.p1, y0: z.lg.y0, y1: z.lg.y1 }));
  } catch (e) {
    logErr(e, 'l2LoggiaOeffnungen');
    return [];
  }
}
/**
 * Fassadenband eines Geschosses für die Hervorhebung „Fassade“ (Metriken): Ring f von z0 bis z1 als Dreiecke
 * [x, y, z, …]. In LOD 200 ohne die Öffnungen der Loggien in der Fassadenebene (die Rück- und Seitenwände kommen aus
 * l2LoggiaWaende dazu), mit ohneOeff zusätzlich ohne Fenster, Türen und Pfosten-Riegel; in LOD 100 die ebene Fassade.
 */
function l2FassadenBand(b, f, z0, z1, ohneOeff) {
  const O = l2on() ? l2LoggiaOeffnungen(b).concat(ohneOeff ? l2FassadenOeffnungen(b) : []) : [],
    pos = [];
  f.forEach((a, q) => pos.push(...l2WandOhne(a, f[(q + 1) % f.length], z0, z1, O)));
  return pos;
}
/**
 * Zusätzliche Fassadenflächen eines Geschosses in LOD 200 (wie die Außenkontur, 110-aussenkontur): Attika über dem
 * obersten Geschoss bei Flachdach (0,30 m), Brüstung an Terrassen, wo das Geschoss darüber zurückspringt (0,30 m), und
 * Schürze unter Überhängen, wo das Geschoss über das darunter hinausragt (Deckenstärke + L2_SCHUERZE). f Umriss des
 * Geschosses, fu/fo Umriss darunter/darüber (oder null), z0/z1 Unter-/Oberkante. Dreiecke [x, y, z, …].
 */
function l2FassadenZusatz(b, f, fu, fo, z0, z1, oberstes) {
  if (!l2on() || !f || f.length < 3) return [];
  const flach = !b.roof || !b.roof.type || b.roof.type === 'flat',
    schuerze = ((l2Els(b).els.find((e) => e.kind === 'DE') || {}).d || 0.22) + L2_SCHUERZE,
    pos = [],
    band = (A, B, ya, yb) =>
      pos.push(
        A[0],
        ya,
        A[1],
        B[0],
        ya,
        B[1],
        B[0],
        yb,
        B[1],
        A[0],
        ya,
        A[1],
        B[0],
        yb,
        B[1],
        A[0],
        yb,
        A[1],
      );
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length],
      L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 0.01) return;
    const n = Math.max(1, Math.ceil(L / 0.25)),
      nx = -(c[1] - a[1]) / L,
      nz = (c[0] - a[0]) / L;
    for (let k = 0; k < n; k++) {
      const A = [a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n],
        B = [a[0] + ((c[0] - a[0]) * (k + 1)) / n, a[1] + ((c[1] - a[1]) * (k + 1)) / n],
        m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
        // Punkt knapp innen (auf der Seite, die im Umriss liegt)
        q1 = [m[0] + nx * 0.05, m[1] + nz * 0.05],
        q2 = [m[0] - nx * 0.05, m[1] - nz * 0.05],
        innen = l2PIn(f, q1[0], q1[1]) ? q1 : q2;
      // oben: Attika (oberstes Geschoss, Flachdach) bzw. Terrassenbrüstung (nicht unter dem Geschoss darüber)
      if ((oberstes && flach) || (fo && !l2PIn(fo, innen[0], innen[1]))) band(A, B, z1, z1 + 0.3);
      // unten: Schürze unter dem Überhang (nicht über dem Geschoss darunter)
      if (fu && !l2PIn(fu, innen[0], innen[1])) band(A, B, z0 - schuerze, z0);
    }
  });
  return pos;
}
/** Rück- und Seitenwände der Loggien als Dreiecke je Wand ({ li, pos }), mit ohneOeff ohne die Fenster darin. */
function l2LoggiaWandFlaechen(b, ohneOeff) {
  const O = ohneOeff ? l2FassadenOeffnungen(b) : [];
  return l2LoggiaWaende(b)
    .filter((w) => w.Q)
    .map((w) => {
      const [A, B, C] = w.Q;
      return { li: w.li, pos: l2WandOhne([A[0], A[2]], [B[0], B[2]], A[1], C[1], O) };
    });
}
/** Fläche einer Dreiecksliste [x, y, z, …] (m²). */
function l2DreieckFlaeche(p) {
  let s = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    const ax = p[i + 3] - p[i],
      ay = p[i + 4] - p[i + 1],
      az = p[i + 5] - p[i + 2],
      bx = p[i + 6] - p[i],
      by = p[i + 7] - p[i + 1],
      bz = p[i + 8] - p[i + 2];
    s += Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  return s;
}
/**
 * Fläche der Öffnungen (Fenster, Türen, Pfosten-Riegel) in der Fassade, so wie die Hervorhebung sie ausspart:
 * Differenz der Bänder mit und ohne Öffnungen über alle oberirdischen Geschosse und die Loggia-Wände (LOD 200).
 */
function l2FassadenOeffnungsFlaeche(b) {
  if (!l2on()) return 0;
  let s = 0,
    z = b._y || 0;
  const u = ugN(b);
  b.levels.forEach((l, i) => {
    const z0 = z,
      z1 = z + l.h;
    z = z1;
    if (i < u) return;
    [lf(b, l)].concat(znVoidsAt(b, i).map((v) => v.poly)).forEach((f) => {
      s +=
        l2DreieckFlaeche(l2FassadenBand(b, f, z0, z1, false)) -
        l2DreieckFlaeche(l2FassadenBand(b, f, z0, z1, true));
    });
  });
  const mit = l2LoggiaWandFlaechen(b, false),
    ohne = l2LoggiaWandFlaechen(b, true);
  mit.forEach((w, i) => (s += l2DreieckFlaeche(w.pos) - l2DreieckFlaeche(ohne[i].pos)));
  return s;
}
/**
 * Fassade in den Metriken: in LOD 200 abgewickelt (ohne Loggia-Öffnungen, mit Rück- und Seitenwänden, dazu Attika,
 * Terrassenbrüstung und Schürze), sonst fas.
 */
function l2FassadeWert(b, fas) {
  if (!l2on()) return fas;
  const z = l2LoggiaZahlen(b);
  return (z.oeff ? fas - z.oeff + z.rueck + z.seite : fas) + l2FassadenZusatzFlaeche(b);
}
/** Fläche von Attika, Terrassenbrüstung und Schürze aller oberirdischen Geschosse (LOD 200, l2FassadenZusatz). */
function l2FassadenZusatzFlaeche(b) {
  if (!l2on() || !b.levels || !b.levels.length) return 0;
  const u = typeof ugN === 'function' ? ugN(b) : 0;
  let s = 0,
    z = b._y || 0;
  b.levels.forEach((l, i) => {
    const z0 = z,
      z1 = z + l.h;
    z = z1;
    if (i < u) return;
    s += l2DreieckFlaeche(
      l2FassadenZusatz(
        b,
        lf(b, l),
        i > 0 ? lf(b, b.levels[i - 1]) : null,
        i + 1 < b.levels.length ? lf(b, b.levels[i + 1]) : null,
        z0,
        z1,
        i === b.levels.length - 1,
      ),
    );
  });
  return s;
}
