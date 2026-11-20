// ---- Fassadenauswertung LOD 200: Wände der Loggien
// Loggien sind in LOD 200 in den Grundriss eingeschnitten (oeLoggiaEinschnitte). Die Fassade läuft dort um die
// Loggia herum: in der Fassadenebene fehlt die Öffnung, dafür kommen Rückwand und Seitenwände hinzu. Die Metriken
// zeigen das unter „Fassadenfläche“ getrennt (nur LOD 200) und heben die Wände auf Klick hervor (Modus 'lgw').

const ISOC_LGW = '#8fa9c4';

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
/** Zeilen unter „Fassadenfläche“ (Gebäudemetrik, nur LOD 200 mit Loggien). fas = Fassadenfläche der Hülle. */
function l2LoggiaZeilen(b, fas) {
  if (!l2on()) return '';
  const z = l2LoggiaZahlen(b);
  if (!z.oeff) return '';
  const A = (v) => f1(v, 1) + ' m²',
    ab = zoAb;
  return (
    l2R(
      ab('Loggien: Öffnungen', 'Öffnungen der Loggien in der Fassadenebene (entfallen)'),
      '− ' + A(z.oeff),
      's',
    ) +
    l2R(ab('Loggien: Rückwände', 'Rückwände der Loggien'), A(z.rueck), 's', ['lgw', b.id, 'rueck']) +
    l2R(ab('Loggien: Seitenwände', 'Seitenwände der Loggien'), A(z.seite), 's', ['lgw', b.id, 'seite']) +
    l2R(
      ab('Fassade abgewickelt', 'Fassadenfläche ohne Loggia-Öffnungen, mit Rück- und Seitenwänden'),
      A(fas - z.oeff + z.rueck + z.seite),
      's',
    )
  );
}
/** Hervorhebung der Loggia-Wände (Modus 'lgw', sel: 'rueck' | 'seite' | 'all'); jede Wand einzeln anwählbar. */
function l2LgwShow(iso) {
  const mat = new T.MeshLambertMaterial({ color: new T.Color(ISOC_LGW), side: T.DoubleSide });
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(iso.bid === '*' || iso.bid === b.id)) return;
    l2LoggiaWaende(b).forEach((w) => {
      if (!w.Q || (iso.sel !== 'all' && iso.sel !== w.art)) return;
      const Q = w.Q,
        ge = new T.BufferGeometry();
      ge.setAttribute(
        'position',
        new T.BufferAttribute(new Float32Array([...Q[0], ...Q[1], ...Q[2], ...Q[0], ...Q[2], ...Q[3]]), 3),
      );
      ge.computeVertexNormals();
      const m = new T.Mesh(ge, mat);
      // vor der Wand zeichnen (sonst deckungsgleich mit ihr)
      m.material.polygonOffset = true;
      m.material.polygonOffsetFactor = -2;
      m.material.polygonOffsetUnits = -2;
      m.userData = {
        bid: b.id,
        li: w.li,
        y0: 0,
        info:
          'Loggia · ' +
          w.nm +
          ' · ' +
          (w.art === 'rueck' ? 'Rückwand' : 'Seitenwand') +
          ' · ' +
          f1(w.a, 1) +
          ' m²',
      };
      m.castShadow = false;
      m.raycast = () => {};
      G.l2n.add(m);
    });
  });
}
