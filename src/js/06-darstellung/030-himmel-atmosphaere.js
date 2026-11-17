// ======================= HIMMEL & ATMOSPHÄRE (Darstellung „Realistisch“) =======================
// Darstellung „Realistisch+“ (DAR 'realp'): wie „Realistisch“, dazu physikalischer Himmel, Sonnen- und Himmelslicht, Dunst in der Ferne und volumetrische Wolken mit
// Bildnachbearbeitung (AgX-Tonwertabbildung, SMAA, Lichtreflexe, Dithering). Bibliotheken: @takram/three-atmosphere,
// @takram/three-clouds, postprocessing – gebündelt in src/vendor/realistisch.js und erst beim ersten Einschalten
// geladen (Skript id="maadRealLib").
//
// Aufbau wie im three.js-Beispiel webgl_loader_3dtiles („post-process lighting“): maad rendert die Szene nur mit
// gleichmäßigem weißem Licht, das Bild ist dann die Grundfarbe (Albedo). Sonne und Himmel beleuchten erst in der
// Nachbearbeitung (AerialPerspectiveEffect mit Normalenbild) – nur so werfen auch die Wolken Schatten.
// maads Gebäudeschatten kommen aus einer Schattenmaske (eigener Durchgang mit ShadowMaterial): im Schatten wird die
// Grundfarbe so abgedunkelt, dass nach der Beleuchtung nur das Himmelslicht übrig bleibt (atmLin).
// Sonnenstand: maads eigene Berechnung (sunPos), damit Schatten, Sonne am Himmel und Lichtfarbe übereinstimmen.
// Ohne Unterstützung (kein WebGL 2/Gleitkomma-Puffer) oder bei Fehlern bleibt die bisherige Darstellung.

const ATM = {
  st: 'aus', // aus · laedt · bereit · fehler
  lib: null, // Promise des Bibliotheksmoduls
  L: null, // geladenes Modul
  comp: null,
  ap: null, // AerialPerspectiveEffect
  himmelM: null, // Himmel mit Boden bis zum Horizont (SkyMaterial)
  cl: null, // CloudsEffect
  lin: null, // Umrechnung in lineare Strahldichte
  tm: null, // ToneMappingEffect
  sonne: null, // SunDirectionalLight (nur zur Berechnung der Sonnenfarbe)
  himmel: null, // SkyLightProbe (nur zur Berechnung des Himmelslichts)
  sonneW: new T.Vector3(0, 1, 0), // Sonnenrichtung in maad-Weltkoordinaten
  maske: null,
  normalRT: null, // Normalenbild (eigener Durchgang, atmDurchgang)
  varianten: { n: new WeakMap(), nf: new WeakMap(), s: new WeakMap() }, // Ersatzmaterialien je Original
  liste: [],
  flach: new WeakSet(), // Gebäude (Normalenbild mit Flächennormalen) // sichtbare Objekte für die Hilfsdurchgänge (alle 1 s neu)
  listeT: 0,
  m: new T.Matrix4(), // Welt (maad: x Ost, y oben, z Süd) -> ECEF
  ll: '', // Ort, für den m berechnet ist
  ref: 1, // Bezugshelligkeit der Sonne (hoher Sonnenstand), Einheit der Bibliothek
  cam: null,
  w: 0,
  h: 0,
  t: 0,
  fehler: '',
  tex: null, // vorberechnete Texturen der Atmosphäre
  dauer: 0, // Dauer der Himmelsberechnung in ms (zur Kontrolle)
  wolkenH: null, // Standardhöhen der Wolkenschichten
};
const ATM_GAMMA = 2.2;
const ATM_QUAL = [
  ['low', 'Niedrig'],
  ['medium', 'Mittel'],
  ['high', 'Hoch'],
];
/** Einstellungen (werden mit Projekt und Ansichten gespeichert). */
function atmDefault() {
  return { wo: true, wd: 0.35, wq: 'low', bel: 10, um: 1, sat: 0.85, wh: 0.6, lf: 0.5 };
}
S.atm = atmDefault();

/** Ist die Atmosphäre für diese Kamera zuständig? Startet beim ersten Bedarf das Laden. */
function atmAktiv(cm) {
  if (S.dar !== 'realp' || !cm || !cm.isPerspectiveCamera) return false; // auch auf der Startseite
  if (ATM.st === 'aus') atmStart();
  return ATM.st === 'bereit';
}

/** Lädt die Bibliotheken (einmal) als ES-Modul aus dem eingebetteten Skript. */
function atmLib() {
  if (!ATM.lib) {
    const src = $('maadRealLib').textContent,
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    ATM.lib = import(url);
  }
  return ATM.lib;
}

async function atmStart() {
  ATM.st = 'laedt';
  atmUi();
  try {
    const L = (ATM.L = await atmLib());
    const gen = new L.PrecomputedTexturesGenerator(ren);
    atmAufbau(L);
    const t0 = performance.now();
    const tex = await gen.update(); // maad pausiert solange das Rendern (loop)
    ATM.dauer = Math.round(performance.now() - t0);
    ATM.tex = tex;
    Object.assign(ATM.ap, tex);
    Object.assign(ATM.cl, tex);
    Object.assign(ATM.himmelM.material, tex);
    ATM.sonne.transmittanceTexture = tex.transmittanceTexture;
    ATM.himmel.irradianceTexture = tex.irradianceTexture;
    atmWolkenTexturen(L);
    ATM.st = 'bereit';
    ATM.ll = '';
    sunUp();
  } catch (e) {
    ATM.st = 'fehler';
    ATM.fehler = String((e && e.message) || e);
    logErr(e, 'atmStart');
  }
  atmUi();
}

/** Nachbearbeitungskette aufbauen. */
function atmAufbau(L) {
  const cm = pc;
  ATM.ap = new L.AerialPerspectiveEffect(cm);
  ATM.ap.sky = false; // Himmel zeichnet himmelM (mit Boden jenseits des Modells)
  ATM.ap.sunLight = true; // Beleuchtung in der Nachbearbeitung (braucht das Normalenbild)
  ATM.ap.skyLight = true;
  ATM.cl = new L.CloudsEffect(cm);
  // Wolkenschatten: Aufteilung wie im Beispiel, Reichweite auf maads Maßstab (Modell ~1 km) statt 100 km,
  // dafür feinere Karte – sonst Streifenmuster auf den Flächen
  Object.assign(ATM.cl.shadow, {
    farScale: 0.25,
    maxFar: 1e4,
    cascadeCount: 2,
    splitMode: 'practical',
    splitLambda: 0.71,
  });
  ATM.cl.shadow.mapSize.set(1024, 1024);
  ATM.cl.events.addEventListener('change', (ev) => {
    if (ev.property === 'atmosphereOverlay') ATM.ap.overlay = ATM.cl.atmosphereOverlay;
    else if (ev.property === 'atmosphereShadow') ATM.ap.shadow = ATM.cl.atmosphereShadow;
    else if (ev.property === 'atmosphereShadowLength') ATM.ap.shadowLength = ATM.cl.atmosphereShadowLength;
  });
  // Himmel als bildschirmfüllendes Rechteck in größter Tiefe; Boden jenseits des Modells mit mittlerer Albedo
  const hm = new L.SkyMaterial();
  hm.groundAlbedo.setRGB(0.2, 0.21, 0.17);
  ATM.himmelM = new T.Mesh(new T.PlaneGeometry(2, 2), hm);
  ATM.himmelM.frustumCulled = false;
  ATM.himmelM.raycast = () => {};
  ATM.himmelM.visible = false;
  ATM.himmelM.userData._ov = 1;
  sc.add(ATM.himmelM);
  // Hilfsbilder (atmDurchgang): Schattenmaske (Alpha = Anteil im Schatten) und Normalenbild
  ATM.maske = new T.WebGLRenderTarget(1, 1, { type: T.UnsignedByteType });
  ATM.normalRT = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  ATM.ap.normalBuffer = ATM.normalRT.texture;
  // Lichtmaske: Kanal r der Schattenmaske (1 = nachbeleuchten, 0 = Farbe ist schon Strahldichte, z. B. Wasser)
  ATM.ap.lightingMask = { map: ATM.maske.texture, channel: 'r' };
  // Grundfarbe: maads Bild (gammakodiert) linear machen und im Schatten abdunkeln; Himmel (Tiefe 1) unverändert
  ATM.lin = new L.Effect(
    'MaadAlbedo',
    'uniform float uK, uSat, uLf;\nuniform vec3 uSonneV, uObenV, uSonneC, uHimmelC, uBodenC;\nuniform sampler2D tMaske, tNormal;\n' +
      'void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {\n' +
      '  if (depth >= 1.0 - 1e-7) { outputColor = inputColor; return; }\n' +
      '  vec4 mk = texture2D(tMaske, uv);\n' +
      '  if (mk.r < 0.5) { outputColor = inputColor; return; }\n' + // nicht nachbeleuchten (Wasser)
      '  vec3 a = pow(max(inputColor.rgb, vec3(0.0)), vec3(' +
      ATM_GAMMA.toFixed(1) +
      ')) * uK;\n' +
      '  a = max(mix(vec3(dot(a, vec3(0.2126, 0.7152, 0.0722))), a, uSat), vec3(0.0));\n' +
      '  float schatten = mk.a;\n' +
      '  vec3 n = normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0);\n' +
      '  float nl = max(dot(n, uSonneV), 0.0), oben = dot(n, uObenV);\n' +
      // Schätzung der Beleuchtung durch die Nachbearbeitung (Sonne + Himmel nach Neigung) …
      '  vec3 himmel = uHimmelC * (0.5 + 0.5 * oben);\n' +
      '  vec3 nach = uSonneC * nl + himmel;\n' +
      // … und gewünschte Beleuchtung: Sonne nur außerhalb von maads Schatten, dazu Licht vom Boden
      // Lichtfarbe von Sonne und Himmel gedämpft (uLf: 1 = physikalisch, 0 = weiß); sonst färben Abendsonne und
      // blauer Himmel maads Flächen zu stark
      '  vec3 Y = vec3(0.2126, 0.7152, 0.0722);\n' +
      '  vec3 sonneSoll = mix(vec3(dot(uSonneC, Y)), uSonneC, uLf);\n' +
      '  vec3 himmelSoll = mix(vec3(dot(himmel, Y)), himmel, uLf);\n' +
      '  vec3 soll = sonneSoll * nl * (1.0 - schatten) + himmelSoll + uBodenC * (0.5 - 0.5 * oben);\n' +
      '  vec3 k = min(soll / max(nach, vec3(1e-4)), vec3(8.0));\n' +
      '  outputColor = vec4(a * k, inputColor.a);\n}\n',
    {
      attributes: L.EffectAttribute.DEPTH,
      blendFunction: L.BlendFunction.SRC,
      uniforms: new Map([
        ['uK', new T.Uniform(0.6)],
        ['uSat', new T.Uniform(0.85)],
        ['uLf', new T.Uniform(0.5)],
        ['uSonneV', new T.Uniform(new T.Vector3(0, 1, 0))],
        ['uObenV', new T.Uniform(new T.Vector3(0, 1, 0))],
        ['uSonneC', new T.Uniform(new T.Vector3(1, 1, 1))],
        ['uHimmelC', new T.Uniform(new T.Vector3(0.2, 0.2, 0.2))],
        ['uBodenC', new T.Uniform(new T.Vector3(0.1, 0.1, 0.1))],
        ['tMaske', new T.Uniform(ATM.maske.texture)],
        ['tNormal', new T.Uniform(ATM.normalRT.texture)],
      ]),
    },
  );
  ATM.tm = new L.ToneMappingEffect({ mode: L.ToneMappingMode.AGX });
  ATM.comp = new L.EffectComposer(ren, { frameBufferType: T.HalfFloatType, multisampling: 0 });
  ATM.comp.addPass(new L.RenderPass(sc, cm));
  ATM.comp.addPass(new L.EffectPass(cm, ATM.lin));
  ATM.comp.addPass(new L.EffectPass(cm, ATM.cl, ATM.ap));
  // Faltungseffekte (Lichtreflexe, SMAA) brauchen je eine eigene Stufe
  ATM.comp.addPass(new L.EffectPass(cm, new L.LensFlareEffect(), ATM.tm));
  ATM.comp.addPass(
    new L.EffectPass(cm, new L.SMAAEffect({ preset: L.SMAAPreset.HIGH }), new L.DitheringEffect()),
  );
  ATM.cam = cm;
  ATM.sonne = new L.SunDirectionalLight();
  ATM.himmel = new L.SkyLightProbe();
  atmWolken();
}

/** Wolkentexturen (Form, Detail, Wetter, Turbulenz, Rauschen) nachladen; ohne sie bleiben die Wolken aus. */
function atmWolkenTexturen(L) {
  const roh = (t, fmt) => {
    t.minFilter = fmt ? T.LinearFilter : T.LinearMipMapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.wrapS = t.wrapT = t.wrapR = T.RepeatWrapping;
    if (fmt) t.format = T.RedFormat;
    t.colorSpace = T.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const fehler = (e) => logErr(e, 'atmWolkenTexturen');
  const bild = new T.TextureLoader();
  bild.load(L.DEFAULT_LOCAL_WEATHER_URL, (t) => (ATM.cl.localWeatherTexture = roh(t)), undefined, fehler);
  bild.load(L.DEFAULT_TURBULENCE_URL, (t) => (ATM.cl.turbulenceTexture = roh(t)), undefined, fehler);
  const vol = (n) =>
    new L.DataTextureLoader(T.Data3DTexture, L.parseUint8Array, { width: n, height: n, depth: n });
  vol(L.CLOUD_SHAPE_TEXTURE_SIZE).load(
    L.DEFAULT_SHAPE_URL,
    (t) => (ATM.cl.shapeTexture = roh(t, 1)),
    undefined,
    fehler,
  );
  vol(L.CLOUD_SHAPE_DETAIL_TEXTURE_SIZE).load(
    L.DEFAULT_SHAPE_DETAIL_URL,
    (t) => (ATM.cl.shapeDetailTexture = roh(t, 1)),
    undefined,
    fehler,
  );
  new L.STBNLoader().load(
    L.DEFAULT_STBN_URL,
    (t) => {
      ATM.ap.stbnTexture = t;
      ATM.cl.stbnTexture = t;
    },
    undefined,
    fehler,
  );
}

/** Wolken-Einstellungen übernehmen. */
function atmWolken() {
  if (!ATM.cl) return;
  const a = S.atm;
  ATM.cl.qualityPreset = ATM_QUAL.some((q) => q[0] === a.wq) ? a.wq : 'low';
  ATM.cl.coverage = a.wo ? +a.wd : 0;
  ATM.cl.localWeatherVelocity.set(a.wo ? 0.001 : 0, 0);
  // Wolkenhöhe: Faktor auf die Standardhöhen der Bibliothek (750 m, 1000 m, 7500 m)
  if (!ATM.wolkenH) ATM.wolkenH = Array.from({ length: 4 }, (_, i) => ATM.cl.cloudLayers[i].altitude);
  for (let i = 0; i < 4; i++) ATM.cl.cloudLayers[i].altitude = ATM.wolkenH[i] * (a.wh ?? 0.6);
}

/** Bezugsrahmen am Projektort: maad-Welt (x Ost, y oben, z Süd, Meter) -> Erdkoordinaten (ECEF). */
function atmOrt() {
  const L = ATM.L,
    [la, lo] = drLL(),
    k = la.toFixed(5) + ',' + lo.toFixed(5);
  if (k === ATM.ll) return;
  ATM.ll = k;
  const p = new L.Geodetic(L.radians(lo), L.radians(la), 0).toECEF(),
    ost = new T.Vector3(),
    nord = new T.Vector3(),
    oben = new T.Vector3();
  L.Ellipsoid.WGS84.getEastNorthUpVectors(p, ost, nord, oben);
  ATM.m.makeBasis(ost, oben, nord.negate()).setPosition(p);
  for (const o of [ATM.ap, ATM.cl, ATM.sonne, ATM.himmel, ATM.himmelM.material])
    o.worldToECEFMatrix.copy(ATM.m);
  // Bezugshelligkeit: Sonnenlicht bei 60° Sonnenhöhe an diesem Ort
  const r = new T.Matrix3().setFromMatrix4(ATM.m),
    d = new T.Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)).applyMatrix3(r).normalize();
  ATM.sonne.sunDirection.copy(d);
  ATM.sonne.update();
  ATM.ref = Math.max(1e-6, atmY(ATM.sonne.color));
}
const atmY = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Sonnenrichtung an Atmosphäre, Wolken und Himmel geben; maads Lichter auf gleichmäßiges Weiß stellen (das Bild ist
 * dann die Grundfarbe, beleuchtet wird in der Nachbearbeitung). Aufruf aus sunUp(); dir = maads Sonnenrichtung.
 */
function atmLicht(dir) {
  if (ATM.st !== 'bereit' || S.dar !== 'realp') return false;
  atmOrt();
  const r = new T.Matrix3().setFromMatrix4(ATM.m),
    d = new T.Vector3(dir[0], dir[1], dir[2]).applyMatrix3(r).normalize();
  for (const o of [ATM.ap, ATM.cl, ATM.sonne, ATM.himmel, ATM.himmelM.material]) o.sunDirection.copy(d);
  ATM.sonne.update();
  ATM.himmel.update();
  ATM.sonneW.set(dir[0], dir[1], dir[2]).normalize();
  WAS.envNeu = true; // Himmelsspiegelung des Wassers neu rendern
  atmUmgebung();
  hemi.color.set(0xffffff);
  hemi.groundColor.set(0xffffff);
  hemi.intensity = LICHT; // Grundfarbe unverändert (r128-Einheit 1)
  sunL.intensity = 0; // wirft weiter Schatten (für die Maske), trägt aber kein Licht bei
  sunL.color.set(0xffffff);
  return true;
}

/**
 * Bestrahlungsstärken für die Grundfarben-Korrektur (atmAlbedo-Shader): Sonne, Himmel (waagerechte Fläche) und
 * Licht vom Boden (Reflexion, warm). Ohne den Boden bekämen Unterseiten und Schattenseiten nur blaues Himmelslicht.
 */
function atmUmgebung() {
  const u = ATM.lin.uniforms,
    sc0 = ATM.sonne.color,
    h = ATM.himmel.sh.coefficients[0].clone().multiplyScalar(Math.sqrt(Math.PI)),
    hoch = Math.max(0, ATM.sonneW.y),
    boden = 0.25 * (S.atm.um ?? 1);
  u.get('uSonneC').value.set(sc0.r, sc0.g, sc0.b);
  u.get('uHimmelC').value.copy(h);
  u.get('uBodenC').value.set(
    boden * (sc0.r * hoch + h.x) * 1.0,
    boden * (sc0.g * hoch + h.y) * 0.95,
    boden * (sc0.b * hoch + h.z) * 0.85,
  );
}

/**
 * Ersatzmaterial für einen Hilfsdurchgang: 'n' = Normalen, 's' = Schattenmaske. Übernimmt Seite und die
 * Shader-Erweiterung (onBeforeCompile) des Originals – so schneiden z. B. Laubschalen ihre Löcher auch hier aus.
 */
function atmVariante(m, art) {
  const map = ATM.varianten[art];
  let v = map.get(m);
  if (v) return v;
  v =
    art === 'n' || art === 'nf'
      ? new T.MeshNormalMaterial({ flatShading: art === 'nf' })
      : new T.ShadowMaterial({ color: 0xffffff, opacity: 1, transparent: false, blending: T.NoBlending });
  v.side = m.side;
  if (
    m.onBeforeCompile &&
    !m.isShaderMaterial &&
    m.onBeforeCompile !== T.Material.prototype.onBeforeCompile
  ) {
    // MeshNormalMaterial hat im Fragment-Shader kein #include <common>, an das maads Erweiterungen anknüpfen
    v.onBeforeCompile = function (sh, r) {
      if (!sh.fragmentShader.includes('#include <common>'))
        sh.fragmentShader = '#include <common>\n' + sh.fragmentShader;
      m.onBeforeCompile.call(this, sh, r);
    };
    v.customProgramCacheKey = () => art + '|' + m.customProgramCacheKey();
  }
  map.set(m, v);
  return v;
}

/**
 * Hilfsbild rendern (vor der Nachbearbeitung, gleiche Kamera): Normalenbild ('n') oder Schattenmaske ('s').
 * Jedes Objekt bekommt sein Ersatzmaterial; Linien, Punkte und Beschriftungen sind dabei ausgeblendet.
 * In der Maske außerdem ausgeblendet: Auflagen ohne Schattenwurf und -empfang (Karte, Straßen, Flurstücke), die
 * sonst das Gelände als sonnig abdecken. Die Seitenwände des Geländes empfangen dort keinen Schatten (sonst Streifen).
 */
function atmDurchgang(art, ziel, cm) {
  const jetzt = performance.now();
  if (jetzt - ATM.listeT > 1000) {
    ATM.listeT = jetzt;
    ATM.liste = [];
    sc.traverseVisible((o) => {
      if (o !== sc && o !== ATM.himmelM && (o.isMesh || o.isLine || o.isPoints || o.isSprite))
        ATM.liste.push(o);
    });
    // Gebäude: exakte Flächennormalen (gemittelte Normalen über First/Kanten ließen Dachseiten gleich hell wirken)
    ATM.flach = new WeakSet();
    G.buildings.traverse((o) => o.isMesh && ATM.flach.add(o));
  }
  const rt = ren.getRenderTarget(),
    cc = ren.getClearColor(new T.Color()),
    ca = ren.getClearAlpha(),
    sh = sunL.shadow,
    bias = [sh.bias, sh.normalBias],
    alt = [];
  try {
    for (const o of ATM.liste) {
      // nurFarbe: Einblendungen (Analyse-Flächen, Strömungsstreifen) gehören nicht in Normalenbild und Maske
      const aus = !o.isMesh || o.userData.nurFarbe || (art === 's' && !o.castShadow && !o.receiveShadow);
      alt.push([o, o.visible, o.material, o.receiveShadow]);
      if (aus) o.visible = false;
      else if (o.userData.atmVar) o.material = o.userData.atmVar[art];
      else
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => atmVariante(m, art === 'n' && ATM.flach.has(o) ? 'nf' : art))
          : atmVariante(o.material, art === 'n' && ATM.flach.has(o) ? 'nf' : art);
      if (art === 's' && o === S.skirt) o.receiveShadow = false; // Seitenwände: ohne Schatten (sonst Streifen)
    }
    ATM.himmelM.visible = false;
    if (art === 's') {
      // mehr Abstand als im normalen Bild: Selbstbeschattung (Streifen) fällt in der Maske stärker auf
      sh.bias = bias[0] * 2;
      sh.normalBias = bias[1] * 2;
    }
    ren.setRenderTarget(ziel);
    if (art === 'n') ren.setClearColor(new T.Color(0.5, 0.5, 1), 1);
    else ren.setClearColor(0x000000, 0);
    ren.clear();
    ren.render(sc, cm);
  } finally {
    for (const [o, v, m, rs] of alt) {
      o.visible = v;
      o.material = m;
      o.receiveShadow = rs;
    }
    ren.setRenderTarget(rt);
    ren.setClearColor(cc, ca);
    sh.bias = bias[0];
    sh.normalBias = bias[1];
  }
}

/** Rendert die Szene über die Atmosphäre. Rückgabe false = nicht zuständig (normal rendern). */
function atmRender(scn, cm) {
  if (scn !== sc || !atmAktiv(cm)) return false;
  try {
    atmOrt();
    if (ATM.cam !== cm) {
      ATM.comp.setMainCamera(cm);
      ATM.cam = cm;
    }
    const sz = ren.getDrawingBufferSize(new T.Vector2());
    if (sz.x !== ATM.w || sz.y !== ATM.h) {
      ATM.w = sz.x;
      ATM.h = sz.y;
      const c = ren.getSize(new T.Vector2());
      ATM.comp.setSize(c.x, c.y, false);
    }
    if (ATM.maske.width !== sz.x || ATM.maske.height !== sz.y) {
      ATM.maske.setSize(sz.x, sz.y);
      ATM.normalRT.setSize(sz.x, sz.y);
    }
    wasVorher(cm);
    atmDurchgang('n', ATM.normalRT, cm);
    atmDurchgang('s', ATM.maske, cm);
    ATM.lin.uniforms.get('uSonneV').value.copy(ATM.sonneW).transformDirection(cm.matrixWorldInverse);
    ATM.lin.uniforms.get('uObenV').value.set(0, 1, 0).transformDirection(cm.matrixWorldInverse);
    ren.toneMappingExposure = S.atm.bel * brK();
    ATM.lin.uniforms.get('uSat').value = S.atm.sat ?? 0.85;
    ATM.lin.uniforms.get('uLf').value = S.atm.lf ?? 0.5;
    const now = performance.now(),
      dt = ATM.t ? Math.min(0.1, (now - ATM.t) / 1000) : 0;
    ATM.t = now;
    const oc = ren.outputColorSpace;
    ren.outputColorSpace = T.SRGBColorSpace; // nur die letzte Stufe (Bildschirm) ist sRGB
    ATM.himmelM.visible = true;
    try {
      ATM.comp.render(dt);
    } finally {
      ren.outputColorSpace = oc;
      ATM.himmelM.visible = false;
      wasNachher();
    }
    return true;
  } catch (e) {
    ATM.st = 'fehler';
    ATM.fehler = String((e && e.message) || e);
    logErr(e, 'atmRender');
    atmUi();
    return false;
  }
}

// ---- Bedienung (Feld „Himmel & Atmosphäre“ in der Darstellung „Realistisch“) ----
function atmSet(k, v) {
  S.atm[k] = v;
  atmWolken();
  if (k === 'um' && ATM.st === 'bereit') atmUmgebung();
  if (k === 'wd' || k === 'bel' || k === 'um' || k === 'sat' || k === 'wh' || k === 'lf') {
    // Regler: nur die Anzeige anpassen (Neuaufbau würde das Ziehen unterbrechen)
    const b = $('atmV_' + k);
    if (b) b.textContent = k === 'bel' ? String(v) : Math.round(v * 100) + ' %';
    return;
  }
  atmUi();
}
function atmUi() {
  const e = $('atmBox');
  if (!e) return;
  e.style.display = S.dar === 'realp' ? '' : 'none';
  if (S.dar !== 'realp') return;
  const a = S.atm,
    st = {
      aus: '',
      laedt: 'Himmel wird berechnet …',
      bereit: '',
      fehler: 'Himmel nicht verfügbar, Darstellung wie Realistisch (' + ATM.fehler + ')',
    }[ATM.st];
  const regler = (k, titel, wert, min, max, step) =>
    `<label style="display:block">${titel} <b id="atmV_${k}">${wert}</b><input type="range" min="${min}" max="${max}" step="${step}" value="${a[k]}" style="width:100%" oninput="atmSet('${k}',+this.value)"></label>`;
  e.innerHTML =
    `<label class="ck"><input type="checkbox" ${a.wo ? 'checked' : ''} onchange="atmSet('wo',this.checked)"> Wolken</label>` +
    (a.wo
      ? regler('wd', 'Bewölkung', Math.round(a.wd * 100) + ' %', 0, 1, 0.05) +
        regler('wh', 'Wolkenhöhe', Math.round((a.wh ?? 0.6) * 100) + ' %', 0.2, 1.5, 0.05) +
        `<label>Wolkenqualität <select onchange="atmSet('wq',this.value)">${ATM_QUAL.map((q) => `<option value="${q[0]}" ${q[0] === a.wq ? 'selected' : ''}>${q[1]}</option>`).join('')}</select></label>`
      : '') +
    regler('bel', 'Belichtung', a.bel, 2, 30, 1) +
    regler('lf', 'Lichtfarbe', Math.round((a.lf ?? 0.5) * 100) + ' %', 0, 1, 0.05) +
    regler('sat', 'Farbsättigung', Math.round((a.sat ?? 0.85) * 100) + ' %', 0, 1.5, 0.05) +
    regler('um', 'Umgebungslicht (vom Boden)', Math.round((a.um ?? 1) * 100) + ' %', 0, 3, 0.1) +
    (st ? `<div class="dmu">${st}</div>` : '');
}
/** Projekt/Ansicht laden: fehlende Werte mit Standard füllen. */
function atmLaden(x) {
  S.atm = Object.assign(atmDefault(), x && typeof x === 'object' ? x : {});
  atmWolken();
  atmUi();
}
