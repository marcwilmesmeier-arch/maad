// ======================= GLAS (Darstellung „Realistisch+“) =======================
// Fensterglas der LOD-200-Öffnungen (Meshes mit userData.glas) spiegelt in Realistisch+ wie das Wasser den Himmel
// (Würfeltextur WAS.env, Sonnenglanz) und ist zur Hälfte durchsichtig: Farbe = Spiegelung, Deckkraft 50 % (flach
// betrachtet mehr, Fresnel). Glas wird wie alle Flächen nachbeleuchtet (sonst bliebe auch der Raum dahinter
// unbeleuchtet und überstrahlt): der Shader teilt die gespiegelte Strahldichte durch die geschätzte Beleuchtung
// (Sonne und Himmel an der Glasnormale, wie atmAlbedo) und gibt sie als Grundfarbe aus. Das Normalenbild bekommt die
// Glasnormale. Nur während des Renderns in Realistisch+ getauscht (glasVorher/-Nachher).

const GLAS = { mat: null, n: null, liste: [], t: 0 };

/** Glasmaterial (einmal) – Uniforms wie beim Wasser. */
function glasMaterial() {
  if (GLAS.mat) return GLAS.mat;
  const vs =
    'varying vec3 vW;varying vec3 vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;' +
    'vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}';
  GLAS.mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    toneMapped: false,
    uniforms: {
      tEnv: { value: null },
      uSonneV: { value: new T.Vector3(0, 1, 0) },
      uSonneC: { value: new T.Vector3() },
      uBoden: { value: new T.Vector3() },
      uHimmelC: { value: new T.Vector3() },
      uK: { value: 0.6 },
    },
    vertexShader: vs,
    fragmentShader:
      'uniform samplerCube tEnv;uniform vec3 uSonneV,uSonneC,uBoden,uHimmelC;uniform float uK;varying vec3 vW;varying vec3 vN;\n' +
      'void main(){vec3 V=normalize(cameraPosition-vW),N=normalize(vN);if(dot(N,V)<0.)N=-N;vec3 R=reflect(-V,N);\n' +
      // Spiegelung: Himmel aus der Würfeltextur, unter dem Horizont der Boden (warm, dunkel)
      'vec3 sp=mix(uBoden,textureCube(tEnv,R).rgb,smoothstep(-.04,.04,R.y));\n' +
      // Sonnenglanz (schmale Keule, glattes Glas)
      'sp+=uSonneC*pow(max(dot(R,uSonneV),0.),3000.)*400.;\n' +
      // 50 % Spiegelung / 50 % durchsichtig, flach betrachtet spiegelt Glas mehr (Fresnel); Glas schluckt einen Teil
      // des Lichts (leicht grünblau getönt) – sonst überstrahlt der gespiegelte Himmel die Fenster
      'float f=.5+.45*pow(1.-max(dot(N,V),0.),5.);\n' +
      'vec3 L=sp*vec3(.30,.34,.36);\n' +
      // Beleuchtung an der Glasnormale wie in der Nachbearbeitung geschätzt; Grundfarbe = L·π/E, gammakodiert
      'vec3 E=uSonneC*max(dot(N,uSonneV),0.)+uHimmelC*(.5+.5*N.y);\n' +
      'vec3 a=L*3.14159/max(E,vec3(1e-4))/uK;\n' +
      'gl_FragColor=vec4(pow(max(a,vec3(0.)),vec3(1./2.2)),f);}',
  });
  GLAS.n = new T.ShaderMaterial({
    side: T.DoubleSide,
    vertexShader: vs,
    fragmentShader:
      'varying vec3 vW;varying vec3 vN;void main(){vec3 N=normalize(vN);if(dot(N,normalize(cameraPosition-vW))<0.)N=-N;' +
      'gl_FragColor=vec4(normalize((viewMatrix*vec4(N,0.)).xyz)*.5+.5,1.);}',
  });
  return GLAS.mat;
}

/** Vor dem Rendern in Realistisch+: Glas-Meshes (alle 1 s neu gesucht) auf das spiegelnde Material umstellen. */
function glasVorher() {
  if (!WAS.env) return;
  const jetzt = performance.now();
  if (jetzt - GLAS.t > 1000) {
    GLAS.t = jetzt;
    GLAS.liste = [];
    if (G.l2) G.l2.traverse((o) => o.isMesh && o.userData.glas && GLAS.liste.push(o));
  }
  if (!GLAS.liste.length) return;
  const m = glasMaterial(),
    u = m.uniforms,
    s = ATM.sonne.color,
    h = ATM.lin.uniforms.get('uHimmelC').value,
    hoch = Math.max(0, ATM.sonneW.y);
  u.tEnv.value = WAS.env.texture;
  u.uHimmelC.value.copy(h);
  u.uK.value = ATM.lin.uniforms.get('uK').value || 0.6;
  u.uSonneV.value.copy(ATM.sonneW);
  u.uSonneC.value.set(s.r, s.g, s.b);
  // gespiegelter Boden: Albedo etwa 0,15 × Bestrahlung / π
  u.uBoden.value
    .set(s.r * hoch + h.x, s.g * hoch + h.y, s.b * hoch + h.z)
    .multiplyScalar((0.15 * (ATM.lin.uniforms.get('uK').value || 0.6)) / Math.PI);
  GLAS.liste.forEach((o) => {
    if (!o.userData.glasAlt) o.userData.glasAlt = o.material;
    o.material = m;
    // Normalenbild: Glasnormale; Schattenmaske wie das ursprüngliche Glas (Schatten auf dem Fenster)
    o.userData.atmVar = { n: GLAS.n, s: atmVariante(o.userData.glasAlt, 's') };
  });
}
/** Nach dem Rendern: ursprüngliches Material zurück (andere Darstellungen, Bildexport). */
function glasNachher() {
  GLAS.liste.forEach((o) => {
    if (o.userData.glasAlt) o.material = o.userData.glasAlt;
    delete o.userData.glasAlt;
    delete o.userData.atmVar;
  });
}
