/* Umgebungsverdeckung (Ambient Occlusion, Darstellungen außer „Realistisch+“): Ecken, Laibungen, Raumtiefen und der
   Fuß von Gebäuden werden aus der Geometrie heraus dunkler – Räume wirken tief, ohne künstliche Abdunklung.
   Ablauf je Bild (nur 3D-Perspektive): Normalen- und Tiefenbild der Szene in halber Auflösung (MeshNormalMaterial),
   daraus die Verdeckung je Bildpunkt (Abtastung einer Halbkugel im Bildraum, Radius in Metern, SAO-Verfahren), dann
   tiefenabhängig geglättet und multiplikativ über das fertige Bild gelegt. Schalter unter Darstellung (S.ao). */
const AO = {
  rt: null, // Normalen + Tiefe
  ao: null, // Verdeckung (halbe Auflösung)
  w: 0,
  h: 0,
  nm: new T.MeshNormalMaterial({ flatShading: true }),
  quad: null,
  kam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
  matAo: null,
  matMix: null,
  liste: [],
  listeT: 0,
  radius: 2.0, // m
  staerke: 1.1,
};
S.ao = true;
function aoMaterialien() {
  if (AO.matAo) return;
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  AO.matAo = new T.ShaderMaterial({
    uniforms: {
      tN: { value: null },
      tD: { value: null },
      uPi: { value: new T.Matrix4() },
      uP11: { value: 1 },
      uRes: { value: new T.Vector2(1, 1) },
      uR: { value: AO.radius },
      uK: { value: AO.staerke },
    },
    vertexShader: vs,
    fragmentShader: `
varying vec2 vUv;
uniform sampler2D tN; uniform sampler2D tD; uniform mat4 uPi; uniform float uP11; uniform vec2 uRes; uniform float uR; uniform float uK;
vec3 vpos(vec2 uv){ float d = texture2D(tD, uv).x; vec4 p = uPi * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float d = texture2D(tD, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv);
  vec3 N = normalize(texture2D(tN, vUv).xyz * 2.0 - 1.0);
  float rpx = uR * uP11 * 0.5 * uRes.y / max(0.1, -P.z);
  rpx = min(rpx, 120.0);
  if (rpx < 1.5) { gl_FragColor = vec4(1.0); return; }
  float rot = hash(gl_FragCoord.xy) * 6.2831853, occ = 0.0;
  const int K = 14;
  for (int i = 0; i < K; i++) {
    float t = (float(i) + 0.5) / float(K);
    float a = rot + t * 6.2831853 * 7.0 / float(K) * 2.0;
    vec2 o = vec2(cos(a), sin(a)) * rpx * t / uRes;
    vec3 S = vpos(vUv + o);
    vec3 v = S - P;
    float vv = dot(v, v);
    float f = max(0.0, 1.0 - vv / (uR * uR));
    occ += f * max(0.0, dot(N, v) / sqrt(vv + 1e-4) - 0.2);
  }
  float ao = clamp(1.0 - uK * occ * 2.5 / float(K), 0.0, 1.0);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`,
    depthTest: false,
    depthWrite: false,
  });
  AO.matMix = new T.ShaderMaterial({
    uniforms: {
      tA: { value: null },
      tD: { value: null },
      uPx: { value: new T.Vector2(1, 1) },
      uN: { value: 1 },
      uF: { value: 1000 },
    },
    vertexShader: vs,
    fragmentShader: `
varying vec2 vUv; uniform sampler2D tA; uniform sampler2D tD; uniform vec2 uPx; uniform float uN; uniform float uF;
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uN * uF / (uF + uN - z * (uF - uN)); }
void main(){
  float z0 = lin(texture2D(tD, vUv).x), s = 0.0, w = 0.0;
  for (int x = -3; x <= 3; x++) for (int y = -3; y <= 3; y++) {
    vec2 q = vUv + vec2(float(x), float(y)) * uPx;
    float g = 1.0 / (1.0 + abs(lin(texture2D(tD, q).x) - z0) / (0.02 * z0) * 4.0);
    s += texture2D(tA, q).x * g; w += g;
  }
  gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.0);
}`,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.ZeroFactor,
    blendDst: T.SrcColorFactor,
  });
  AO.quad = new T.Mesh(new T.PlaneGeometry(2, 2), AO.matAo);
  AO.quad.frustumCulled = false;
}
function aoZiele(w, h) {
  if (AO.rt && AO.w === w && AO.h === h) return;
  if (AO.rt) {
    AO.rt.depthTexture.dispose();
    AO.rt.dispose();
    AO.ao.dispose();
  }
  AO.w = w;
  AO.h = h;
  AO.rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true });
  AO.rt.depthTexture = new T.DepthTexture(w, h, T.UnsignedIntType);
  AO.ao = new T.WebGLRenderTarget(w, h, { depthBuffer: false });
}
/** Nach dem Rendern der Szene (aus mkRender): Verdeckung berechnen und über das Bild legen. */
function aoNach(scn, cm) {
  if (!S.ao || scn !== sc || !cm || !cm.isPerspectiveCamera || !S.m3 || S.dar === 'realp') return;
  aoMaterialien();
  const v = new T.Vector2();
  ren.getDrawingBufferSize(v);
  const w = Math.max(1, Math.round(v.x / 2)),
    h = Math.max(1, Math.round(v.y / 2));
  aoZiele(w, h);
  // sichtbare Objekte (alle 1 s neu): nur undurchsichtige Flächen, keine Linien, Punkte, Einblendungen
  const jetzt = performance.now();
  if (jetzt - AO.listeT > 1000) {
    AO.listeT = jetzt;
    AO.liste = [];
    scn.traverseVisible((o) => {
      if (o !== scn && (o.isLine || o.isPoints || o.isSprite)) AO.liste.push(o);
      else if (o.isMesh) {
        const m = o.material;
        if (
          Array.isArray(m) ||
          !m ||
          m.transparent ||
          m.depthWrite === false ||
          o.userData.nurFarbe ||
          o.userData._ov ||
          m.isShaderMaterial
        )
          AO.liste.push(o);
      }
    });
  }
  const alt = AO.liste.map((o) => [o, o.visible]),
    rt0 = ren.getRenderTarget(),
    ac = ren.autoClear,
    bg = scn.background,
    om = scn.overrideMaterial,
    sm = ren.shadowMap.autoUpdate,
    cc = ren.getClearColor(new T.Color()),
    ca = ren.getClearAlpha();
  try {
    AO.liste.forEach((o) => (o.visible = false));
    scn.overrideMaterial = AO.nm;
    scn.background = null;
    ren.shadowMap.autoUpdate = false;
    ren.setRenderTarget(AO.rt);
    ren.setClearColor(0x8080ff, 1);
    ren.autoClear = true;
    ren.render(scn, cm);
    // Verdeckung
    const u = AO.matAo.uniforms;
    u.tN.value = AO.rt.texture;
    u.tD.value = AO.rt.depthTexture;
    u.uPi.value.copy(cm.projectionMatrixInverse);
    u.uP11.value = cm.projectionMatrix.elements[5];
    u.uRes.value.set(w, h);
    AO.quad.material = AO.matAo;
    ren.setRenderTarget(AO.ao);
    ren.render(AO.quad, AO.kam);
    // geglättet multiplikativ auf das Bild
    const mu = AO.matMix.uniforms;
    mu.tA.value = AO.ao.texture;
    mu.tD.value = AO.rt.depthTexture;
    mu.uPx.value.set(1 / w, 1 / h);
    mu.uN.value = cm.near;
    mu.uF.value = cm.far;
    AO.quad.material = AO.matMix;
    ren.setRenderTarget(rt0);
    ren.autoClear = false;
    ren.render(AO.quad, AO.kam);
  } catch (e) {
    logErr(e, 'aoNach');
  } finally {
    alt.forEach(([o, vis]) => (o.visible = vis));
    scn.overrideMaterial = om;
    scn.background = bg;
    ren.shadowMap.autoUpdate = sm;
    ren.setClearColor(cc, ca);
    ren.autoClear = ac;
    ren.setRenderTarget(rt0);
  }
}
/** Schalter unter Darstellung (aus start()). */
function aoUi() {
  try {
    const s = localStorage.getItem('maad.ao');
    if (s != null) S.ao = s === '1';
  } catch (e) {
    logErr(e, 'aoUi');
  }
  const d = $('darBase');
  if (!d || $('aock')) return;
  d.insertAdjacentHTML(
    'beforeend',
    `<label title="Ecken, Laibungen und Raumtiefen werden aus der Geometrie heraus dunkler (Umgebungsverdeckung)">Raumtiefe <input type="checkbox" id="aock" ${S.ao ? 'checked' : ''}></label>`,
  );
  $('aock').addEventListener('change', (e) => {
    S.ao = e.target.checked;
    try {
      localStorage.setItem('maad.ao', S.ao ? '1' : '0');
    } catch (x) {
      logErr(x, 'aoUi');
    }
  });
}
