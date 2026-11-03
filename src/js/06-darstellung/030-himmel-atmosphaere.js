// ======================= HIMMEL & ATMOSPHÄRE (Darstellung „Realistisch“) =======================
// Darstellung „Realistisch+“ (DAR 'realp'): wie „Realistisch“, dazu physikalischer Himmel, Sonnen- und Himmelslicht, Dunst in der Ferne und volumetrische Wolken mit
// Bildnachbearbeitung (AgX-Tonwertabbildung, SMAA, Lichtreflexe, Dithering). Bibliotheken: @takram/three-atmosphere,
// @takram/three-clouds, postprocessing – gebündelt in src/vendor/realistisch.js, beim Start geladen (src/index.html,
// window.MAAD_REAL). Aufgebaut wird die Kette erst beim ersten Einschalten.
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
  maskeM: null,
  geo: null, // GeometryPass
  m: new T.Matrix4(), // Welt (maad: x Ost, y oben, z Süd) -> ECEF
  ll: '', // Ort, für den m berechnet ist
  ref: 1, // Bezugshelligkeit der Sonne (hoher Sonnenstand), Einheit der Bibliothek
  cam: null,
  w: 0,
  h: 0,
  t: 0,
  fehler: '',
};
const ATM_GAMMA = 2.2;
const ATM_QUAL = [
  ['low', 'Niedrig'],
  ['medium', 'Mittel'],
  ['high', 'Hoch'],
];
/** Einstellungen (werden mit Projekt und Ansichten gespeichert). */
function atmDefault() {
  return { wo: true, wd: 0.35, wq: 'medium', bel: 10 };
}
S.atm = atmDefault();

/** Ist die Atmosphäre für diese Kamera zuständig? Startet beim ersten Bedarf das Laden. */
function atmAktiv(cm) {
  if (S.dar !== 'realp' || HOME.open || !cm || !cm.isPerspectiveCamera) return false;
  if (ATM.st === 'aus') atmStart();
  return ATM.st === 'bereit';
}

/** Bibliotheken (beim Start in src/index.html geladen). */
function atmLib() {
  if (!window.MAAD_REAL) return Promise.reject(new Error('Bibliotheken nicht geladen'));
  return Promise.resolve(window.MAAD_REAL);
}

async function atmStart() {
  ATM.st = 'laedt';
  atmUi();
  try {
    const L = (ATM.L = await atmLib());
    const gen = new L.PrecomputedTexturesGenerator(ren);
    atmAufbau(L);
    const tex = await gen.update();
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
  // Wolkenschatten wie im Beispiel
  Object.assign(ATM.cl.shadow, {
    farScale: 0.25,
    maxFar: 1e5,
    cascadeCount: 2,
    splitMode: 'practical',
    splitLambda: 0.71,
  });
  ATM.cl.shadow.mapSize.set(512, 512);
  ATM.cl.events.addEventListener('change', (ev) => {
    if (ev.property === 'atmosphereOverlay') ATM.ap.overlay = ATM.cl.atmosphereOverlay;
    else if (ev.property === 'atmosphereShadow') ATM.ap.shadow = ATM.cl.atmosphereShadow;
    else if (ev.property === 'atmosphereShadowLength') ATM.ap.shadowLength = ATM.cl.atmosphereShadowLength;
  });
  // Himmel als bildschirmfüllendes Rechteck in größter Tiefe; Boden jenseits des Modells mit mittlerer Albedo
  const hm = new L.SkyMaterial();
  hm.groundAlbedo.setRGB(0.12, 0.13, 0.1);
  ATM.himmelM = new T.Mesh(new T.PlaneGeometry(2, 2), hm);
  ATM.himmelM.frustumCulled = false;
  ATM.himmelM.raycast = () => {};
  ATM.himmelM.visible = false;
  ATM.himmelM.userData._ov = 1;
  sc.add(ATM.himmelM);
  // Schattenmaske: Alpha = Anteil im Schatten (three.js ShadowMaterial)
  ATM.maskeM = new T.ShadowMaterial({ color: 0, opacity: 1, transparent: false, blending: T.NoBlending });
  ATM.maske = new T.WebGLRenderTarget(1, 1, { type: T.UnsignedByteType });
  // Grundfarbe: maads Bild (gammakodiert) linear machen und im Schatten abdunkeln; Himmel (Tiefe 1) unverändert
  ATM.lin = new L.Effect(
    'MaadAlbedo',
    'uniform float uK, uSonne, uHimmel;\nuniform vec3 uSonneV;\nuniform sampler2D tMaske, tNormal;\n' +
      // Normalen aus dem GeometryPass (oktaedrisch in zwei Kanälen, wie packNormalToVec2 der Bibliothek)
      'vec3 atmNormal(vec2 e) {\n' +
      '  vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y));\n' +
      '  if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);\n' +
      '  return normalize(v);\n}\n' +
      'void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {\n' +
      '  if (depth >= 1.0 - 1e-7) { outputColor = inputColor; return; }\n' +
      '  vec3 a = pow(max(inputColor.rgb, vec3(0.0)), vec3(' +
      ATM_GAMMA.toFixed(1) +
      ')) * uK;\n' +
      '  float schatten = texture2D(tMaske, uv).a;\n' +
      '  vec3 n = atmNormal(texture2D(tNormal, uv).xy);\n' +
      '  float nl = max(dot(n, uSonneV), 0.0);\n' +
      '  float k = uHimmel / (uSonne * nl + uHimmel + 1e-6);\n' +
      '  outputColor = vec4(a * mix(1.0, k, schatten), inputColor.a);\n}\n',
    {
      attributes: L.EffectAttribute.DEPTH,
      blendFunction: L.BlendFunction.SRC,
      uniforms: new Map([
        ['uK', new T.Uniform(0.6)],
        ['uSonne', new T.Uniform(1)],
        ['uHimmel', new T.Uniform(0.2)],
        ['uSonneV', new T.Uniform(new T.Vector3(0, 1, 0))],
        ['tMaske', new T.Uniform(ATM.maske.texture)],
        ['tNormal', new T.Uniform(null)],
      ]),
    },
  );
  ATM.tm = new L.ToneMappingEffect({ mode: L.ToneMappingMode.AGX });
  ATM.comp = new L.EffectComposer(ren, { frameBufferType: T.HalfFloatType, multisampling: 0 });
  // Farbbild und Normalenbild in einem Durchgang (GeometryPass, Materialien beim Start dafür eingerichtet)
  ATM.geo = new L.GeometryPass(ATM.comp.inputBuffer, sc, cm);
  ATM.comp.addPass(ATM.geo);
  ATM.ap.normalBuffer = ATM.geo.geometryTexture;
  ATM.ap.octEncodedNormal = true;
  ATM.lin.uniforms.get('tNormal').value = ATM.geo.geometryTexture;
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
  ATM.cl.qualityPreset = ATM_QUAL.some((q) => q[0] === a.wq) ? a.wq : 'medium';
  ATM.cl.coverage = a.wo ? +a.wd : 0;
  ATM.cl.localWeatherVelocity.set(a.wo ? 0.001 : 0, 0);
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
  // Verhältnis Sonne : Himmel für die Schattenmaske (Bestrahlungsstärken, Helligkeit)
  const h = ATM.himmel.sh.coefficients[0];
  ATM.lin.uniforms.get('uSonne').value = atmY(ATM.sonne.color);
  ATM.lin.uniforms.get('uHimmel').value = Math.max(
    1e-6,
    (0.2126 * h.x + 0.7152 * h.y + 0.0722 * h.z) * Math.sqrt(Math.PI),
  );
  hemi.color.set(0xffffff);
  hemi.groundColor.set(0xffffff);
  hemi.intensity = LICHT; // Grundfarbe unverändert (r128-Einheit 1)
  sunL.intensity = 0; // wirft weiter Schatten (für die Maske), trägt aber kein Licht bei
  sunL.color.set(0xffffff);
  return true;
}

/** Schattenmaske rendern: Szene mit ShadowMaterial, Alpha = Schatten (vor der Nachbearbeitung, gleiche Kamera). */
function atmMaske(cm) {
  const rt = ren.getRenderTarget(),
    om = sc.overrideMaterial,
    cc = ren.getClearColor(new T.Color()),
    ca = ren.getClearAlpha(),
    hv = ATM.himmelM.visible;
  try {
    ATM.himmelM.visible = false;
    sc.overrideMaterial = ATM.maskeM;
    ren.setRenderTarget(ATM.maske);
    ren.setClearColor(0x000000, 0);
    ren.clear();
    ren.render(sc, cm);
  } finally {
    ren.setRenderTarget(rt);
    ren.setClearColor(cc, ca);
    sc.overrideMaterial = om;
    ATM.himmelM.visible = hv;
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
    if (ATM.maske.width !== sz.x || ATM.maske.height !== sz.y) ATM.maske.setSize(sz.x, sz.y);
    atmMaske(cm);
    ATM.lin.uniforms.get('uSonneV').value.copy(ATM.sonneW).transformDirection(cm.matrixWorldInverse);
    ren.toneMappingExposure = S.atm.bel * brK();
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
  if (k === 'wd' || k === 'bel') {
    // Regler: nur die Anzeige anpassen (Neuaufbau würde das Ziehen unterbrechen)
    const b = $('atmV_' + k);
    if (b) b.textContent = k === 'wd' ? Math.round(v * 100) + ' %' : String(v);
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
        `<label>Wolkenqualität <select onchange="atmSet('wq',this.value)">${ATM_QUAL.map((q) => `<option value="${q[0]}" ${q[0] === a.wq ? 'selected' : ''}>${q[1]}</option>`).join('')}</select></label>`
      : '') +
    regler('bel', 'Belichtung', a.bel, 2, 30, 1) +
    (st ? `<div class="dmu">${st}</div>` : '');
}
/** Projekt/Ansicht laden: fehlende Werte mit Standard füllen. */
function atmLaden(x) {
  S.atm = Object.assign(atmDefault(), x && typeof x === 'object' ? x : {});
  atmWolken();
  atmUi();
}
