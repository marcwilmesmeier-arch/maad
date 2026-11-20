// ======================= GLAS (Darstellung „Realistisch+“) =======================
// Fensterglas der LOD-200-Öffnungen (Meshes mit userData.glas) spiegelt in Realistisch+ wie das Wasser den Himmel
// (Würfeltextur WAS.env, Sonnenglanz) und ist zur Hälfte durchsichtig: Farbe = Spiegelung, Deckkraft 50 % (flach
// betrachtet mehr, Fresnel). Glas wird wie alle Flächen nachbeleuchtet (sonst bliebe auch der Raum dahinter
// unbeleuchtet und überstrahlt): der Shader teilt die gespiegelte Strahldichte durch die geschätzte Beleuchtung
// (Sonne und Himmel an der Glasnormale, wie atmAlbedo) und gibt sie als Grundfarbe aus. Das Normalenbild bekommt die
// Glasnormale. Nur während des Renderns in Realistisch+ getauscht (glasVorher/-Nachher).
// Umgebung (Nachbargebäude, Bäume, Gelände) wie beim Wasser: je Gebäude eine Würfeltextur der Szene ohne das Gebäude
// selbst, aufgenommen aus seiner Mitte mit maads Lichtern wie in Realistisch (wasLicht). Neu nur, wenn sich Modell
// oder Sonne ändern, höchstens ein Gebäude je Bild. Abgefragt mit Kastenkorrektur (Kasten um das Gebäude, Boden auf
// Geländehöhe): so liegt der gespiegelte Boden und die Nachbarschaft auch an Fenstern weit von der Mitte etwa richtig.
// Wo die Würfeltextur leer ist (Alpha 0), spiegelt der Himmel.

const GLAS = { mat: null, n: null, liste: [], t: 0, um: new Map(), mats: new Map() };
/** Größe der Umgebungs-Würfeltextur (Pixel je Seite) und halbe Kastenbreite um das Gebäude (m). */
const GLAS_UM = { px: 256, r: 45 };

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
      tUm: { value: null },
      uUm: { value: 0 },
      uR: { value: 1 },
      uC: { value: new T.Vector3() },
      uBmin: { value: new T.Vector3() },
      uBmax: { value: new T.Vector3() },
    },
    vertexShader: vs,
    fragmentShader:
      'uniform samplerCube tEnv,tUm;uniform vec3 uSonneV,uSonneC,uBoden,uHimmelC,uC,uBmin,uBmax;uniform float uK,uUm,uR;\n' +
      'varying vec3 vW;varying vec3 vN;\n' +
      'void main(){vec3 V=normalize(cameraPosition-vW),N=normalize(vN);if(dot(N,V)<0.)N=-N;vec3 R=reflect(-V,N);\n' +
      // Spiegelung: Himmel aus der Würfeltextur, unter dem Horizont der Boden (warm, dunkel)
      'vec3 sp=mix(uBoden,textureCube(tEnv,R).rgb,smoothstep(-.04,.04,R.y));\n' +
      // Umgebung: Strahl vom Fenster bis an den Kasten, Richtung von der Aufnahmemitte dorthin
      'if(uUm>.5){vec3 t1=(uBmax-vW)/R,t2=(uBmin-vW)/R,tf=max(t1,t2);float t=min(min(tf.x,tf.y),tf.z);\n' +
      'vec4 u=textureCube(tUm,vW+R*t-uC);sp=mix(sp,u.rgb*uR,u.a);}\n' +
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
    for (const it of L2I.values())
      it.g.traverse((o) => o.isMesh && o.userData.glas && GLAS.liste.push({ o, bid: it.el.bid }));
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
  // gleiche Umrechnung wie die Wasserspiegelung: sonnenbeschienene weiße Fläche ≈ Sonnenlicht / π
  u.uR.value = (u.uK.value * atmY(ATM.sonne.color)) / Math.PI;
  const bids = [...new Set(GLAS.liste.map((x) => x.bid))];
  try {
    glasUmgebung(bids);
  } catch (e) {
    logErr(e, 'glasUmgebung');
  }
  bids.forEach((bid) => {
    let mb = GLAS.mats.get(bid);
    if (!mb) GLAS.mats.set(bid, (mb = m.clone()));
    const ub = mb.uniforms,
      um = GLAS.um.get(bid);
    for (const k of ['uHimmelC', 'uSonneV', 'uSonneC', 'uBoden']) ub[k].value.copy(u[k].value);
    ub.tEnv.value = u.tEnv.value;
    ub.uK.value = u.uK.value;
    ub.uR.value = u.uR.value;
    ub.uUm.value = um && um.fertig ? 1 : 0;
    if (um && um.fertig) {
      ub.tUm.value = um.rt.texture;
      ub.uC.value.copy(um.c);
      ub.uBmin.value.copy(um.min);
      ub.uBmax.value.copy(um.max);
    }
  });
  GLAS.liste.forEach(({ o, bid }) => {
    if (!o.userData.glasAlt) o.userData.glasAlt = o.material;
    o.material = GLAS.mats.get(bid) || m;
    // Normalenbild: Glasnormale; Schattenmaske wie das ursprüngliche Glas (Schatten auf dem Fenster)
    o.userData.atmVar = { n: GLAS.n, s: atmVariante(o.userData.glasAlt, 's') };
  });
}

/** Teile eines Gebäudes, die seine eigene Umgebungsaufnahme verdecken würden (Hülle, LOD-200-Bauteile, Balkone). */
function glasEigeneTeile(b) {
  const r = [];
  if (b._g) r.push(b._g);
  for (const it of L2I.values()) if (it.el.bid === b.id) r.push(it.g);
  [L2BK, L2TG].forEach((M) => {
    const o = M.get(b.id);
    if (o && o.g) r.push(o.g);
  });
  return r;
}

/**
 * Umgebungs-Würfeltexturen der Gebäude mit Glas aktuell halten: neu aufnehmen, wenn sich Modell (L2GEN, Hüllen)
 * oder Sonne geändert haben; höchstens ein Gebäude je Bild, das der Kamera nächste zuerst.
 */
function glasUmgebung(bids) {
  const sig =
      L2GEN +
      '|' +
      S.bld.map((b) => (b._g ? b._g.id : 0)).join(',') +
      '|' +
      ATM.sonneW
        .toArray()
        .map((v) => v.toFixed(2))
        .join(','),
    cp = act().position;
  // nicht mehr gebrauchte Aufnahmen freigeben
  GLAS.um.forEach((um, bid) => {
    if (!bids.includes(bid)) {
      um.rt.dispose();
      GLAS.um.delete(bid);
      const mb = GLAS.mats.get(bid);
      if (mb) mb.dispose();
      GLAS.mats.delete(bid);
    }
  });
  const offen = bids
    .map((bid) => S.bld.find((x) => x.id === bid))
    .filter((b) => b && b._y != null && !b.ex && !(GLAS.um.get(b.id) && GLAS.um.get(b.id).sig === sig))
    .sort((a, b) => glasMitte(a).distanceTo(cp) - glasMitte(b).distanceTo(cp));
  if (!offen.length) return;
  const b = offen[0];
  let um = GLAS.um.get(b.id);
  if (!um) {
    const rt = new T.WebGLCubeRenderTarget(GLAS_UM.px, { generateMipmaps: true });
    rt.texture.minFilter = T.LinearMipmapLinearFilter;
    um = {
      rt,
      cam: new T.CubeCamera(0.5, 3000, rt),
      c: new T.Vector3(),
      min: new T.Vector3(),
      max: new T.Vector3(),
    };
    GLAS.um.set(b.id, um);
  }
  const c = glasMitte(b),
    r = GLAS_UM.r + Math.max(...b.fp.map((p) => Math.hypot(p[0] - c.x, p[1] - c.z)));
  um.c.copy(c);
  um.min.set(c.x - r, b._y, c.z - r);
  um.max.set(c.x + r, c.y + 200, c.z + r);
  um.cam.position.copy(c);
  um.cam.updateMatrixWorld();
  // ohne das Gebäude selbst, ohne Glas und Wasser (deren Spiegelmaterialien gehören zur Hauptkamera)
  const aus = glasEigeneTeile(b).concat(
      GLAS.liste.map((x) => x.o),
      WAS.mesh ? [WAS.mesh] : [],
    ),
    vis = aus.map((o) => o.visible);
  aus.forEach((o) => (o.visible = false));
  try {
    wasLicht(() => {
      ren.clippingPlanes = [];
      ren.setClearColor(0x000000, 0);
      um.cam.update(ren, sc);
    });
  } finally {
    aus.forEach((o, i) => (o.visible = vis[i]));
  }
  um.sig = sig;
  um.fertig = true;
}
/** Aufnahmemitte: Grundrissmitte auf halber Gebäudehöhe. */
function glasMitte(b) {
  const c = cen(b.fp);
  return new T.Vector3(c[0], b._y + (b._h || 10) / 2, c[1]);
}
/** Nach dem Rendern: ursprüngliches Material zurück (andere Darstellungen, Bildexport). */
function glasNachher() {
  GLAS.liste.forEach(({ o }) => {
    if (o.userData.glasAlt) o.material = o.userData.glasAlt;
    delete o.userData.glasAlt;
    delete o.userData.atmVar;
  });
}
