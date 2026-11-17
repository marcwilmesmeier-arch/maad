/* Innenlicht in LOD 200: Flächen, die ins Gebäudeinnere zeigen (Deckenunterseiten, Böden unter einem Geschoss,
   Innenseiten der Außenwände, Innenwände), bekommen nur einen Teil des Himmelslichts – innen fehlt der freie Himmel.
   Die direkte Sonne bleibt voll und verschattet; so zeichnet sich das Licht, das durch die Fenster fällt, im Raum ab.
   Die Prüfung läuft je Bildpunkt im Shader: Punkt 0,6 m entlang der Flächennormale versetzen, Geschoss nach der Höhe
   bestimmen, liegt er im Geschossgrundriss (gerade/ungerade Kantenzählung, Innenhöfe als Löcher) und mindestens
   0,45 m vom Rand entfernt, ist die Fläche innen. Grundrisskanten je Gebäude in einer Datentextur. Beim Aufklappen
   (Explosionsansicht) aus, weil die Geschosse dann verschoben sind. */
const L2IN = { k: { value: 0.3 }, rand: 0.45, schritt: 0.6, geb: new Map() };
/** Uniforms eines Gebäudes (Kanten, Geschosshöhen), bei Formänderung neu aufgebaut. */
function l2InnenDaten(b) {
  const sig = skSig(b) + JSON.stringify(b.voids || []);
  let d = L2IN.geb.get(b.id);
  if (d && d.sig === sig) return d.u;
  const kan = [],
    lz = [];
  let z0 = b._y;
  b.levels.slice(0, 48).forEach((l, j) => {
    lz.push(new T.Vector2(z0, z0 + l.h));
    z0 += l.h;
    const ringe = [lf(b, l)].concat(znVoidsAt(b, j).map((v) => v.poly));
    ringe.forEach((f) =>
      f.forEach((a, i) => {
        const c = f[(i + 1) % f.length];
        if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 1e-3) kan.push([a[0], a[1], c[0], c[1], j]);
      }),
    );
  });
  while (lz.length < 48) lz.push(new T.Vector2(1e9, -1e9));
  const n = Math.min(kan.length, 1024),
    arr = new Float32Array(Math.max(1, n) * 2 * 4);
  for (let i = 0; i < n; i++) {
    arr.set(kan[i].slice(0, 4), i * 4);
    arr[(Math.max(1, n) + i) * 4] = kan[i][4];
  }
  const tex = new T.DataTexture(arr, Math.max(1, n), 2, T.RGBAFormat, T.FloatType);
  tex.needsUpdate = true;
  if (d) {
    d.u.uInT.value.dispose();
    d.u.uInT.value = tex;
    d.u.uInN.value = n;
    d.u.uInZ.value = lz;
    d.sig = sig;
    return d.u;
  }
  const u = {
    uInT: { value: tex },
    uInN: { value: n },
    uInZ: { value: lz },
    uInK: L2IN.k,
    uInAn: { value: 1 },
  };
  L2IN.geb.set(b.id, { sig, u });
  return u;
}
/** Material eines LOD-200-Bauteils um die Innenabdunklung ergänzen (aus l2MeshOrig). */
function l2InnenMarkieren(e, g, mat) {
  const b = S.bld.find((x) => x.id === e.bid);
  if (!b || l23()) return;
  const u = l2InnenDaten(b);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInP;\nvarying vec3 vInN;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvInP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvInN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vInP;
varying vec3 vInN;
uniform sampler2D uInT;
uniform int uInN;
uniform vec2 uInZ[48];
uniform float uInK;
uniform float uInAn;
float l2Innen() {
  if (uInAn < 0.5 || uInN == 0) return 0.0;
  vec3 n = normalize(vInN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 q = vInP + n * ${L2IN.schritt.toFixed(2)};
  int lv = -1;
  for (int j = 0; j < 48; j++) { if (q.y >= uInZ[j].x && q.y < uInZ[j].y) { lv = j; break; } }
  if (lv < 0) return 0.0;
  bool drin = false;
  float dmin = 1e9;
  for (int i = 0; i < 1024; i++) {
    if (i >= uInN) break;
    if (int(texelFetch(uInT, ivec2(i, 1), 0).r + 0.5) != lv) continue;
    vec4 e = texelFetch(uInT, ivec2(i, 0), 0);
    if ((e.y > q.z) != (e.w > q.z) && q.x < (e.z - e.x) * (q.z - e.y) / (e.w - e.y) + e.x) drin = !drin;
    vec2 a = e.xy, ab = e.zw - e.xy, p = q.xz - a;
    float t = clamp(dot(p, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    dmin = min(dmin, length(p - ab * t));
  }
  return drin && dmin > ${L2IN.rand.toFixed(2)} ? 1.0 : 0.0;
}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        'irradiance *= mix( 1.0, uInK, l2Innen() );\n#include <lights_fragment_end>',
      );
  };
  mat.customProgramCacheKey = () => 'l2innen2';
  mat.needsUpdate = true;
}
/** Takt (aus 030-aktionen): beim Aufklappen aus, Daten verschwundener Gebäude freigeben. */
function l2InnenTakt() {
  const an = !(S.expl && S.expl.cur > 0.05) ? 1 : 0;
  L2IN.geb.forEach((d, id) => {
    d.u.uInAn.value = an;
    if (!S.bld.some((b) => b.id === id)) {
      d.u.uInT.value.dispose();
      L2IN.geb.delete(id);
    }
  });
}
