// ======================= WASSER (Darstellung „Realistisch+“) =======================
// Ruhige Wasserfläche ohne Wellen, die Umgebung und physikalisch berechneten Himmel spiegelt (wie im
// three.js-Beispiel webgpu_ocean): Umgebung von einer gespiegelten Kamera (halbe Auflösung, feste Spiegelebene auf
// mittlerer Wasserhöhe, maads Lichter wie in Realistisch), Himmel aus einer kleinen Würfeltextur (bei jedem Sonnenstand neu),
// Spiegelanteil nach Fresnel (flach betrachtet mehr Spiegelung), Sonnenglanz. Die Fläche liefert ihre Farbe direkt
// als Strahldichte und ist von der Nachbeleuchtung ausgenommen (Lichtmaske, Kanal r der Schattenmaske);
// Dunst und Wolken wirken trotzdem. Form: Wasserflächen des Kartenbilds (PL.water) ohne Straßen und Wege.

const WAS = {
  mesh: null,
  quelle: null,
  h: 0,
  rt: null,
  cam: new T.PerspectiveCamera(),
  tm: new T.Matrix4(),
  env: null,
  envCam: null,
  envSc: null,
  envM: null,
  envNeu: true,
};

/** Würfeltextur des Himmels (64 px reichen für eine glatte Spiegelung). */
function wasEnvAufbau(L) {
  const rt = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType, generateMipmaps: true });
  rt.texture.minFilter = T.LinearMipmapLinearFilter;
  WAS.env = rt;
  WAS.envCam = new T.CubeCamera(0.1, 10, rt);
  WAS.envSc = new T.Scene();
  const hm = new L.SkyMaterial();
  hm.groundAlbedo.setRGB(0.2, 0.21, 0.17);
  hm.sun = false; // Sonne nicht in der kleinen Textur (wäre dort grob und viel zu groß), Glanz rechnet der Shader
  hm.moon = false;
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
  // mittlere Wasserhöhe = Spiegelebene (Stichproben der Wassermaske auf einem 90er-Raster)
  {
    const d = x.getImageData(0, 0, W, W).data;
    let sh = 0,
      cn = 0;
    for (let i = 0; i < 90; i++)
      for (let j = 0; j < 90; j++) {
        const X = -hs + ((i + 0.5) * GEO.size) / 90,
          Z = -hs + ((j + 0.5) * GEO.size) / 90,
          uu = Math.floor(((X + hs) / GEO.size) * W),
          vv = Math.floor(((Z + hs) / GEO.size) * W);
        if (d[(vv * W + uu) * 4 + 3] > 128) {
          sh += gh(X, Z);
          cn++;
        }
      }
    WAS.h = (cn ? sh / cn : 0) + 0.14;
  }
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
      tR: { value: null },
      uTM: { value: WAS.tm },
      uR: { value: 0 },
      uTief: { value: new T.Vector3() },
      uSonneV: { value: new T.Vector3(0, 1, 0) },
      uSonneC: { value: new T.Vector3() },
    },
    vertexShader: vs,
    fragmentShader:
      maske +
      'uniform samplerCube tEnv;uniform sampler2D tR;uniform mat4 uTM;uniform float uR;uniform vec3 uTief,uSonneV,uSonneC;\n' +
      'void main(){' +
      weg +
      'vec3 V=normalize(cameraPosition-vW),N=vec3(0.,1.,0.),R=reflect(-V,N);\n' +
      'float f=.02+.98*pow(1.-max(dot(N,V),0.),5.);\n' + // Fresnel (Schlick) für Wasser
      // Spiegelbild der Umgebung (gammakodiert, Alpha = getroffen) in Strahldichte umrechnen, leicht weichgezeichnet
      'vec3 sp=textureCube(tEnv,R).rgb;\n' +
      'if(uR>0.){vec4 q=uTM*vec4(vW,1.);vec2 ru=q.xy/q.w;vec4 a=vec4(0.);\n' +
      'for(int i=0;i<5;i++){float t=float(i)*1.2566;a+=texture2D(tR,ru+(i==0?vec2(0.):vec2(cos(t),sin(t))*.003));}a/=5.;\n' +
      'sp=mix(sp,pow(max(a.rgb/max(a.a,1e-3),vec3(0.)),vec3(2.2))*uR,a.a);}\n' +
      'vec3 c=mix(uTief,sp,f);\n' +
      // Sonnenglanz: schmale Keule (etwa 1°, ruhiges Wasser), Energie entspricht dem gespiegelten Sonnenlicht
      'c+=uSonneC*pow(max(dot(R,uSonneV),0.),6000.)*f*955.;\n' +
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

/**
 * Umgebung von der an der Wasserebene gespiegelten Kamera rendern (halbe Auflösung). maads Lichter für diesen
 * Durchgang wie in Realistisch (in Realistisch+ stehen sie sonst auf gleichmäßigem Weiß für die Grundfarbe).
 */
function wasSpiegel(cm, m) {
  const bs = ren.getDrawingBufferSize(new T.Vector2()),
    w = Math.max(64, bs.x >> 1),
    h = Math.max(64, bs.y >> 1);
  if (!WAS.rt || WAS.rt.width !== w || WAS.rt.height !== h) {
    if (WAS.rt) WAS.rt.dispose();
    WAS.rt = new T.WebGLRenderTarget(w, h);
  }
  const vc = WAS.cam,
    h0 = WAS.h,
    p = new T.Vector3().setFromMatrixPosition(cm.matrixWorld),
    d = cm.getWorldDirection(new T.Vector3()),
    e = cm.matrixWorld.elements;
  vc.position.set(p.x, 2 * h0 - p.y, p.z);
  vc.up.set(e[4], -e[5], e[6]);
  vc.lookAt(p.x + d.x, 2 * h0 - (p.y + d.y), p.z + d.z);
  vc.updateMatrixWorld();
  vc.projectionMatrix.copy(cm.projectionMatrix);
  vc.projectionMatrixInverse.copy(cm.projectionMatrixInverse);
  WAS.tm
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(vc.projectionMatrix)
    .multiply(vc.matrixWorldInverse);
  const alt = {
      rt: ren.getRenderTarget(),
      cp: ren.clippingPlanes,
      sa: ren.shadowMap.autoUpdate,
      cc: ren.getClearColor(new T.Color()),
      ca: ren.getClearAlpha(),
      hi: hemi.intensity,
      hc: hemi.color.clone(),
      hg: hemi.groundColor.clone(),
      si: sunL.intensity,
      scol: sunL.color.clone(),
    },
    k = brK();
  try {
    m.visible = false;
    hemi.intensity = 0.5 * k * LICHT;
    hemi.color.set(0xcfe3ff);
    hemi.groundColor.set(0xa49a8c);
    sunL.intensity = (ATM.sonneW.y > 0 ? 1.1 : 0.1) * 0.7 * k * LICHT;
    sunL.color.set(drWarm((Math.asin(Math.max(-1, Math.min(1, ATM.sonneW.y))) * 180) / Math.PI));
    ren.shadowMap.autoUpdate = false;
    ren.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -(h0 - 0.05))];
    ren.setRenderTarget(WAS.rt);
    ren.setClearColor(0x000000, 0);
    ren.clear();
    ren.render(sc, vc);
  } finally {
    ren.setRenderTarget(alt.rt);
    ren.clippingPlanes = alt.cp;
    ren.shadowMap.autoUpdate = alt.sa;
    ren.setClearColor(alt.cc, alt.ca);
    hemi.intensity = alt.hi;
    hemi.color.copy(alt.hc);
    hemi.groundColor.copy(alt.hg);
    sunL.intensity = alt.si;
    sunL.color.copy(alt.scol);
  }
  const u = m.material.uniforms;
  u.tR.value = WAS.rt.texture;
  // gleiche Umrechnung wie die Grundfarbe (atmAlbedo): sonnenbeschienene weiße Fläche ≈ Sonnenlicht / π
  u.uR.value = (ATM.lin.uniforms.get('uK').value * atmY(ATM.sonne.color)) / Math.PI;
}

/** Vor dem Rendern in Realistisch+: Spiegelungen aktualisieren und Wasser einblenden. */
function wasVorher(cm) {
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
  // Umgebung nur spiegeln, wenn Wasser im Bild sein kann (Kamera über der Wasserebene, 3D)
  if (cm.isPerspectiveCamera && cm.position.y > WAS.h) wasSpiegel(cm, m);
  else m.material.uniforms.uR.value = 0;
  m.visible = true;
}
function wasNachher() {
  if (WAS.mesh) WAS.mesh.visible = false;
}
