/* Innenlicht in LOD 200: Flächen, die ins Gebäudeinnere zeigen (Deckenunterseiten, Böden unter einem Geschoss,
   Innenseiten der Außenwände, Innenwände), bekommen nur einen Teil des Himmelslichts – innen fehlt der freie Himmel.
   Die direkte Sonne bleibt voll und verschattet; so zeichnet sich das Licht, das durch die Fenster fällt, im Raum ab.
   Je Dreieck: einen Schritt entlang der Normalen gehen; liegt der Punkt im Gebäude (Geschoss-Grundriss, nicht im
   Innenhof, mindestens L2IN.rand vom Rand entfernt), ist die Fläche innen. Attribut aInnen (0/1) je Eckpunkt. */
const L2IN = { k: { value: 0.3 }, rand: 0.45, schritt: 0.6 };
/** Liegt der Punkt (x, y, z) im Gebäude b? */
function l2ImGebaeude(b, x, y, z) {
  let z0 = b._y;
  for (let j = 0; j < b.levels.length; j++) {
    const l = b.levels[j],
      z1 = z0 + l.h;
    if (y >= z0 && y < z1) {
      if (l.ug) return true;
      const f = lf(b, l);
      if (!inP([x, z], f)) return false;
      if (znVoidsAt(b, j).some((v) => inP([x, z], v.poly))) return false;
      // Abstand zum Rand (Wandbereich und Laibungen zählen nicht als innen)
      for (let i = 0; i < f.length; i++) {
        const a = f[i],
          c = f[(i + 1) % f.length];
        if (proj([x, z], a, c).d < L2IN.rand) return false;
      }
      return true;
    }
    z0 = z1;
  }
  return false;
}
/** Meshes eines LOD-200-Bauteils markieren und das Material um die Innenabdunklung ergänzen. */
function l2InnenMarkieren(e, g, mat) {
  const b = S.bld.find((x) => x.id === e.bid);
  if (!b || l23()) return;
  const A = new T.Vector3(),
    B = new T.Vector3(),
    C = new T.Vector3(),
    N = new T.Vector3(),
    E = new T.Vector3();
  let innen = 0;
  g.children.forEach((m) => {
    if (!m.isMesh || m.material !== mat || !m.geometry.attributes.position) return;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    if (geo !== m.geometry) m.geometry = geo;
    const P = geo.attributes.position,
      a = new Float32Array(P.count),
      dy = g.position.y + m.position.y;
    for (let t = 0; t + 2 < P.count; t += 3) {
      A.fromBufferAttribute(P, t);
      B.fromBufferAttribute(P, t + 1);
      C.fromBufferAttribute(P, t + 2);
      N.subVectors(B, A).cross(E.subVectors(C, A));
      if (N.lengthSq() < 1e-12) continue;
      N.normalize();
      const mx = (A.x + B.x + C.x) / 3 + N.x * L2IN.schritt,
        my = (A.y + B.y + C.y) / 3 + dy + N.y * L2IN.schritt,
        mz = (A.z + B.z + C.z) / 3 + N.z * L2IN.schritt;
      if (l2ImGebaeude(b, mx, my, mz)) {
        a[t] = a[t + 1] = a[t + 2] = 1;
        innen++;
      }
    }
    geo.setAttribute('aInnen', new T.BufferAttribute(a, 1));
  });
  if (!innen) return;
  // alle Meshes mit diesem Material brauchen das Attribut
  g.children.forEach((m) => {
    if (m.isMesh && m.material === mat && !m.geometry.attributes.aInnen)
      m.geometry.setAttribute(
        'aInnen',
        new T.BufferAttribute(new Float32Array(m.geometry.attributes.position.count), 1),
      );
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uInnenK = L2IN.k;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aInnen;\nvarying float vInnen;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInnen = aInnen;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInnen;\nuniform float uInnenK;')
      .replace(
        '#include <lights_fragment_end>',
        'irradiance *= mix( 1.0, uInnenK, vInnen );\n#include <lights_fragment_end>',
      );
  };
  mat.customProgramCacheKey = () => 'l2innen';
  mat.needsUpdate = true;
}
