// ======================= WASSER (Darstellung „Realistisch+“) =======================
// Ruhige Wasserfläche ohne Wellen, die den physikalisch berechneten Himmel spiegelt (wie die Spiegelung im
// three.js-Beispiel webgpu_ocean): Himmel in eine kleine Würfeltextur gerendert (bei jedem Sonnenstand neu),
// Spiegelanteil nach Fresnel (flach betrachtet mehr Spiegelung), Sonnenglanz. Die Fläche liefert ihre Farbe direkt
// als Strahldichte und ist von der Nachbeleuchtung ausgenommen (Lichtmaske, Kanal r der Schattenmaske);
// Dunst und Wolken wirken trotzdem. Form: Wasserflächen des Kartenbilds (PL.water) ohne Straßen und Wege.

const WAS = { mesh: null, quelle: null, env: null, envCam: null, envSc: null, envM: null, envNeu: true };

/** Würfeltextur des Himmels (64 px reichen für eine glatte Spiegelung). */
function wasEnvAufbau(L) {
  const rt = new T.WebGLCubeRenderTarget(64, { type: T.HalfFloatType, generateMipmaps: true });
  rt.texture.minFilter = T.LinearMipmapLinearFilter;
  WAS.env = rt;
  WAS.envCam = new T.CubeCamera(0.1, 10, rt);
  WAS.envSc = new T.Scene();
  const hm = new L.SkyMaterial();
  hm.groundAlbedo.setRGB(0.2, 0.21, 0.17);
  hm.sunAngularRadius = 0.1; // größere Sonnenscheibe: kein Flackern in der kleinen Textur (Strahlung bleibt gleich)
  const m = new T.Mesh(new T.PlaneGeometry(2, 2), hm);
  m.frustumCulled = false;
  WAS.envSc.add(m);
  WAS.envM = hm;
}

/** Wasserfläche aus der Wassermaske des Kartenbilds bauen (nur wenn sich Karte oder Gelände geändert haben). */
function wasBauen() {
  // neu bauen, wenn Wassermaske, Gelände (neue Seitenwände = neues Gelände) oder Größe wechseln
  const q = WAS.quelle;
  if (q && q[0] === PL.water && q[1] === S.skirt && q[2] === GEO.size) return WAS.mesh;
  WAS.quelle = [PL.water, S.skirt, GEO.size];
  if (WAS.mesh) {
    sc.remove(WAS.mesh);
    WAS.mesh.geometry.dispose();
    WAS.mesh.material.uniforms.tM.value.dispose();
    WAS.mesh = null;
  }
  if (!GEO.size || !PL.water) return null;
  const hs = GEO.size / 2,
    W = 2048,
    mc = document.createElement('canvas');
  mc.width = mc.height = W;
  const x = mc.getContext('2d');
  x.drawImage(PL.water, 0, 0, W, W);
  x.globalCompositeOperation = 'destination-out';
  for (const q of ['roads', 'paths', 'cycle']) if (PL[q]) x.drawImage(PL[q], 0, 0, W, W);
  const tex = new T.CanvasTexture(mc);
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = T.LinearFilter;
  const geo = new T.PlaneGeometry(GEO.size, GEO.size, 300, 300);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gh(p.getX(i), p.getZ(i)) + 0.14);
  const maske = 'uniform sampler2D tM;uniform float uS,uHs;varying vec3 vW;\n',
    weg = 'if(texture2D(tM,(vW.xz+uHs)/uS).a<.5)discard;\n',
    vs =
      'varying vec3 vW;void main(){vW=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}',
    u = { tM: { value: tex }, uS: { value: GEO.size }, uHs: { value: hs } };
  const mat = new T.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      ...u,
      tEnv: { value: WAS.env.texture },
      uTief: { value: new T.Vector3() },
      uSonneV: { value: new T.Vector3(0, 1, 0) },
      uSonneC: { value: new T.Vector3() },
    },
    vertexShader: vs,
    fragmentShader:
      maske +
      'uniform samplerCube tEnv;uniform vec3 uTief,uSonneV,uSonneC;\n' +
      'void main(){' +
      weg +
      'vec3 V=normalize(cameraPosition-vW),N=vec3(0.,1.,0.),R=reflect(-V,N);\n' +
      'float f=.02+.98*pow(1.-max(dot(N,V),0.),5.);\n' + // Fresnel (Schlick) für Wasser
      'vec3 c=mix(uTief,textureCube(tEnv,R).rgb,f);\n' +
      'c+=uSonneC*pow(max(dot(R,uSonneV),0.),900.)*f*40.;\n' + // Sonnenglanz
      'gl_FragColor=vec4(c,1.);}',
  });
  const m = new T.Mesh(geo, mat);
  m.frustumCulled = false;
  m.raycast = () => {};
  m.visible = false;
  m.receiveShadow = true;
  m.userData._ov = 1;
  // Ersatzmaterialien für die Hilfsdurchgänge (atmDurchgang): gleiche Form, nach oben zeigende Normale,
  // in der Maske r = 0 (nicht nachbeleuchten) und kein Schatten
  m.userData.atmVar = {
    n: new T.ShaderMaterial({
      uniforms: u,
      vertexShader: vs,
      fragmentShader:
        maske +
        'void main(){' +
        weg +
        'gl_FragColor=vec4(normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz)*.5+.5,1.);}',
    }),
    s: new T.ShaderMaterial({
      uniforms: u,
      blending: T.NoBlending,
      vertexShader: vs,
      fragmentShader: maske + 'void main(){' + weg + 'gl_FragColor=vec4(0.);}',
    }),
  };
  sc.add(m);
  WAS.mesh = m;
  return m;
}

/** Vor dem Rendern in Realistisch+: Himmelsspiegelung aktualisieren und Wasser einblenden. */
function wasVorher() {
  if (!WAS.env) wasEnvAufbau(ATM.L);
  const m = wasBauen();
  if (!m) return;
  const hm = WAS.envM;
  if (WAS.envNeu) {
    WAS.envNeu = false;
    Object.assign(hm, ATM.tex);
    hm.worldToECEFMatrix.copy(ATM.m);
    hm.sunDirection.copy(ATM.ap.sunDirection);
    WAS.envCam.update(ren, WAS.envSc);
  }
  const u = m.material.uniforms,
    s = ATM.sonne.color,
    h = ATM.lin.uniforms.get('uHimmelC').value,
    hoch = Math.max(0, ATM.sonneW.y);
  u.uSonneV.value.copy(ATM.sonneW);
  u.uSonneC.value.set(s.r, s.g, s.b);
  // Eigenfarbe des Wassers (dunkel, leicht grünblau): Albedo × Bestrahlung / π
  u.uTief.value
    .set(s.r * hoch + h.x, s.g * hoch + h.y, s.b * hoch + h.z)
    .multiply(new T.Vector3(0.02, 0.03, 0.035))
    .multiplyScalar(1 / Math.PI);
  m.visible = true;
}
function wasNachher() {
  if (WAS.mesh) WAS.mesh.visible = false;
}
