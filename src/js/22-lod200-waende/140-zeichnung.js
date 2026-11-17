/* LOD 200 als Zeichnung (nur das geplante Gebäude): dunkle, feine Linien an allen echten Kanten – Umriss, Geschoss-
   und Dachkanten, Laibungen, Rahmen, Pfosten. Die Linien entstehen im Bild (Kantenerkennung aus Normalen und Tiefe der
   LOD-200-Bauteile), nicht aus der Geometrie: Wände sind um Öffnungen in Stücke geteilt, deren Stoßstellen sonst als
   Linien mitten auf der Wand erschienen. Eine Linie entsteht nur, wo die Fläche abknickt oder springt.
   Ablauf je Bild (aus mkRender, 09-…/020-maske.js): G.l2 allein mit Normalenmaterial in ein Ziel mit Tiefentextur
   rendern, dann ein bildschirmfüllendes Rechteck über das fertige Bild legen, das die Kanten zeichnet und seine Tiefe
   schreibt (gl_FragDepth) – so verdecken Umgebung und Gelände die Linien wie das Gebäude selbst.
   Schalter: S.l2zs (LOD-Leiste, 17-…/100-lod.js), mit dem Projekt gespeichert. Nicht in Realistisch+ (eigene Kette). */
S.l2zs = false;
const L2Z = { rt: null, nm: null, q: null, qs: null, qc: null };
function l2ZInit() {
  if (L2Z.rt) return;
  L2Z.rt = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthTexture: new T.DepthTexture(1, 1),
  });
  L2Z.rt.depthTexture.type = T.UnsignedIntType;
  L2Z.nm = new T.MeshNormalMaterial({ flatShading: true, side: T.DoubleSide });
  L2Z.q = new T.ShaderMaterial({
    glslVersion: T.GLSL3,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    depthFunc: T.LessEqualDepth,
    uniforms: {
      tN: { value: L2Z.rt.texture },
      tD: { value: L2Z.rt.depthTexture },
      uPx: { value: new T.Vector2(1, 1) },
      uNF: { value: new T.Vector2(1, 1000) },
      uOrtho: { value: 0 },
      uC: { value: new T.Color(0x1f2225) },
    },
    vertexShader: 'out vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `precision highp float;
in vec2 vUv;
uniform sampler2D tN, tD;
uniform vec2 uPx, uNF;
uniform float uOrtho;
uniform vec3 uC;
out vec4 fc;
float lin(float d) {
  if (uOrtho > 0.5) return uNF.x + d * (uNF.y - uNF.x);
  float z = d * 2.0 - 1.0;
  return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x));
}
void main() {
  float d0 = texture(tD, vUv).r;
  if (d0 >= 1.0) discard; // kein Gebäude an diesem Bildpunkt
  vec3 n0 = texture(tN, vUv).xyz * 2.0 - 1.0;
  float z0 = lin(d0), e = 0.0;
  vec2 o[4] = vec2[4](vec2(uPx.x, 0.0), vec2(0.0, -uPx.y), vec2(-uPx.x, 0.0), vec2(0.0, uPx.y));
  for (int i = 0; i < 4; i++) {
    // je Richtung zwei Nachbarn (1 und 2 Bildpunkte): nur was über beide reicht, ist eine Kante – 1 Bildpunkt breite
    // Risse an den Stoßstellen der Wandstücke fallen so weg
    float da = texture(tD, vUv + o[i]).r, db = texture(tD, vUv + 2.0 * o[i]).r;
    float za = da >= 1.0 ? 1e9 : lin(da), zb = db >= 1.0 ? 1e9 : lin(db), th = 0.004 * z0 + 0.04;
    // Sprung in der Tiefe: nur auf der vorderen Seite zeichnen (Linie 1 Bildpunkt breit)
    if (za > z0 + th && zb > z0 + th) e = 1.0;
    // Knick: nur nach rechts und unten (sonst doppelt breit)
    if (i < 2 && da < 1.0 && db < 1.0) {
      vec3 na = texture(tN, vUv + o[i]).xyz * 2.0 - 1.0, nb = texture(tN, vUv + 2.0 * o[i]).xyz * 2.0 - 1.0;
      if (dot(n0, na) < 0.9 && dot(n0, nb) < 0.9 && abs(za - z0) < 4.0 * th) e = 1.0;
    }
  }
  if (e < 0.01) discard;
  fc = vec4(uC, e);
  gl_FragDepth = d0 - 1e-6;
}`,
  });
  L2Z.qs = new T.Scene();
  const m = new T.Mesh(new T.PlaneGeometry(2, 2), L2Z.q);
  m.frustumCulled = false;
  L2Z.qs.add(m);
  L2Z.qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
/** Kantenlinien über das fertige Bild legen (nur LOD 200/300 mit Schalter, nur das geplante Gebäude). */
function l2Zeichnung(cm) {
  if (!S.l2zs || !l2on() || !G.l2 || !G.l2.visible || S.dar === 'realp' || !cm) return;
  try {
    l2ZInit();
    const sz = ren.getDrawingBufferSize(new T.Vector2());
    if (L2Z.rt.width !== sz.x || L2Z.rt.height !== sz.y) L2Z.rt.setSize(sz.x, sz.y);
    // 1. nur die LOD-200-Flächen ins Normalenbild (andere Teile der Szene und Linien kurz ausgeblendet)
    const aus = [];
    sc.children.forEach((o) => {
      if (o !== G.l2 && o.visible) {
        aus.push(o);
        o.visible = false;
      }
    });
    G.l2.traverse((o) => {
      if (o.visible && !o.isMesh && (o.isLine || o.isLineSegments || o.isPoints || o.isSprite)) {
        aus.push(o);
        o.visible = false;
      }
    });
    const rt0 = ren.getRenderTarget(),
      om = sc.overrideMaterial,
      bg = sc.background,
      ac = ren.autoClear,
      su = ren.shadowMap.autoUpdate,
      sn = ren.shadowMap.needsUpdate,
      cc = ren.getClearColor(new T.Color()),
      ca = ren.getClearAlpha();
    try {
      ren.shadowMap.autoUpdate = false;
      ren.shadowMap.needsUpdate = false;
      sc.overrideMaterial = L2Z.nm;
      sc.background = null;
      ren.setRenderTarget(L2Z.rt);
      ren.setClearColor(0x8080ff, 1);
      ren.clear();
      ren.render(sc, cm);
    } finally {
      sc.overrideMaterial = om;
      sc.background = bg;
      ren.setRenderTarget(rt0);
      ren.setClearColor(cc, ca);
      ren.shadowMap.autoUpdate = su;
      ren.shadowMap.needsUpdate = sn;
      aus.forEach((o) => (o.visible = true));
    }
    // 2. Kanten über das Bild, Tiefentest gegen das fertige Bild
    const u = L2Z.q.uniforms;
    u.uPx.value.set(1 / sz.x, 1 / sz.y);
    u.uNF.value.set(cm.near, cm.far);
    u.uOrtho.value = cm.isOrthographicCamera ? 1 : 0;
    ren.autoClear = false;
    ren.render(L2Z.qs, L2Z.qc);
    ren.autoClear = ac;
  } catch (e) {
    logErr(e, 'l2Zeichnung');
  }
}
/** Schalter in der LOD-Leiste. */
function l2ZSet(v) {
  S.l2zs = !!v;
  try {
    lodRender();
  } catch (e) {
    logErr(e, 'l2ZSet');
  }
}
