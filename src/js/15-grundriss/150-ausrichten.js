// ---- Ausrichten (wie Revit „Ausrichten“): erst die Bezugslinie, dann die Linie einer Wand anklicken – die Wand wird
// parallel verschoben, bis diese Linie auf dem Bezug liegt. Bezug: Außen- und Innenkante der Außenwände (auch der
// Loggiawände), Kanten und Zeichenlinie der Innenwände, in LOD 100 Umriss und Zeichenlinien. Ziel: Zeichenlinie oder
// Kante einer Innenwand (die Wand wird mit der angeklickten Linie bündig). Angeschlossene Wände folgen (grEditGrp).

const AUS = { ref: null };

/**
 * Fanglinien eines Geschosses: [{ a, b, g, s }] – a, b Endpunkte im Grundriss; g = Kennung der Wandlinie (nur bei
 * Innenwänden, sonst 0); s = Abstand der Linie zur Zeichenlinie der Wand (quer, in Richtung der Liniennormalen).
 */
function grAusLinien(b, lv) {
  const R = [];
  (lv.bs || []).forEach((s) => R.push({ a: [s[0], s[1]], b: [s[2], s[3]], g: 0 }));
  const cuts = lv.obj.cuts || [];
  cuts.forEach((c) => R.push({ a: [c[0], c[1]], b: [c[2], c[3]], g: c[4], s: 0 }));
  if (!l2on() || lv.dg) return R;
  try {
    l2Els(b)
      .els.filter((e) => e.li === lv.i && e.quads && (e.kind === 'AW' || e.kind === 'TW' || e.kind === 'TH'))
      .forEach((e) => {
        const c = e.gid ? cuts.find((q) => q[4] === e.gid) : null;
        e.quads.forEach((q) => {
          // die beiden langen Seiten des Vierecks sind die Wandflächen
          const kanten = [
            [q[0], q[1]],
            [q[1], q[2]],
            [q[2], q[3]],
            [q[3], q[0]],
          ].sort(
            (u, v) =>
              Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) -
              Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]),
          );
          kanten.slice(0, 2).forEach(([a, z]) => {
            const L = { a: a.slice(), b: z.slice(), g: e.kind === 'AW' ? 0 : e.gid || 0 };
            if (c && L.g) L.s = grAusQuer(c, a);
            R.push(L);
          });
        });
      });
  } catch (e) {
    logErr(e, 'grAusLinien');
  }
  return R;
}
/** Abstand des Punkts p quer zur Wandlinie c (positiv zur linken Seite in Zeichenrichtung). */
function grAusQuer(c, p) {
  const L = Math.hypot(c[2] - c[0], c[3] - c[1]) || 1;
  return ((p[0] - c[0]) * -(c[3] - c[1]) + (p[1] - c[1]) * (c[2] - c[0])) / L;
}
/** Nächste Fanglinie am Punkt p (Fangradius in Bildpunkten), nur Linien mit Kennung, wenn nurWand. */
function grAusTreffer(L, p, nurWand) {
  const tol = 8 / GRS.view.s;
  let best = null,
    bd = tol;
  L.forEach((l) => {
    if (nurWand && !l.g) return;
    const d = grDSeg(p.x, p.z, l.a[0], l.a[1], l.b[0], l.b[1]);
    if (d < bd - 1e-9) {
      bd = d;
      best = l;
    }
  });
  return best;
}
function grAusHinweis(t) {
  GRS.note = { t, u: Date.now() + 6000 };
  GRS.dirty = 1;
}
/** Klick im Werkzeug „Ausrichten“: erst Bezug, dann Wandlinie. */
function grAusKlick(e) {
  const b = grB();
  if (!b) return;
  const lv = grLv(b),
    p = grPt(e),
    L = grAusLinien(b, lv);
  if (!AUS.ref) {
    const r = grAusTreffer(L, p, false);
    if (!r)
      return grAusHinweis(
        'Ausrichten: zuerst die Bezugslinie anklicken (Wandkante, Zeichenlinie oder Umriss)',
      );
    AUS.ref = r;
    return grAusHinweis(
      'Ausrichten: jetzt die Kante oder Zeichenlinie der Innenwand anklicken, die ausgerichtet wird',
    );
  }
  const t = grAusTreffer(L, p, true);
  if (!t) return grAusHinweis('Ausrichten: diese Linie gehört zu keiner Innenwand – Innenwand anklicken');
  const c = (lv.obj.cuts || []).find((q) => q[4] === t.g);
  if (!c) return;
  const r = AUS.ref,
    dc = [c[2] - c[0], c[3] - c[1]],
    dr = [r.b[0] - r.a[0], r.b[1] - r.a[1]],
    sin = Math.abs(dc[0] * dr[1] - dc[1] * dr[0]) / ((Math.hypot(...dc) || 1) * (Math.hypot(...dr) || 1));
  if (sin > 0.0175) return grAusHinweis('Ausrichten: Bezug und Wand sind nicht parallel');
  // Verschiebung quer zur Wand: Bezug minus Lage der angeklickten Linie
  const d = grAusQuer(c, r.a) - (t.s || 0);
  if (Math.abs(d) < 0.0005) return grAusHinweis('Ausrichten: liegt bereits bündig');
  const Lc = Math.hypot(...dc) || 1,
    n = [-dc[1] / Lc, dc[0] / Lc],
    m = new Map();
  [
    [c[0], c[1]],
    [c[2], c[3]],
  ].forEach((q) => m.set(gk(q[0], q[1]), [q[0] + n[0] * d, q[1] + n[1] * d]));
  grEditGrp(t.g, m);
  AUS.ref = null;
  grAusHinweis('Ausgerichtet (' + f1(Math.abs(d), 2) + ' m) – nächsten Bezug anklicken · Esc beendet');
}
/** Bezugslinie im Plan hervorheben (Auswahlfarbe). */
function grAusZeichnen(x) {
  if (GRS.tool !== 'ali' || !AUS.ref) return;
  const r = AUS.ref,
    A = grTf(r.a[0], r.a[1]),
    B = grTf(r.b[0], r.b[1]);
  x.save();
  x.strokeStyle = '#f07a12';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(A[0], A[1]);
  x.lineTo(B[0], B[1]);
  x.stroke();
  x.restore();
}
