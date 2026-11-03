// ======================= HIMMEL & ATMOSPHÄRE (Darstellung „Realistisch“) =======================
// Physikalischer Himmel, Sonnen- und Himmelslicht, Dunst in der Ferne und volumetrische Wolken mit
// Bildnachbearbeitung (AgX-Tonwertabbildung, SMAA, Lichtreflexe, Dithering). Bibliotheken: @takram/three-atmosphere,
// @takram/three-clouds, postprocessing – gebündelt in src/vendor/realistisch.js und erst beim ersten Einschalten
// geladen (Skript id="maadRealLib").
//
// Aufbau: maad rendert die Szene wie bisher mit eigenen Lichtern und Schatten. Das Ergebnis wird in lineare
// Strahldichte umgerechnet (atmLinear), dann legen Atmosphäre und Wolken Himmel, Dunst und Wolken darüber.
// Sonnenstand: maads eigene Berechnung (sunPos), damit Schatten, Sonne am Himmel und Lichtfarbe übereinstimmen.
// Ohne Unterstützung (kein WebGL 2/Gleitkomma-Puffer) oder bei Fehlern bleibt die bisherige Darstellung.

const ATM = {
  st: 'aus', // aus · laedt · bereit · fehler
  lib: null, // Promise des Bibliotheksmoduls
  L: null, // geladenes Modul
  comp: null,
  ap: null, // AerialPerspectiveEffect
  cl: null, // CloudsEffect
  lin: null, // Umrechnung in lineare Strahldichte
  tm: null, // ToneMappingEffect
  sonne: null, // SunDirectionalLight (nur zur Berechnung der Sonnenfarbe)
  himmel: null, // SkyLightProbe (nur zur Berechnung des Himmelslichts)
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
  return { an: true, wo: true, wd: 0.35, wq: 'medium', bel: 10 };
}
S.atm = atmDefault();

/** Ist die Atmosphäre für diese Kamera zuständig? Startet beim ersten Bedarf das Laden. */
function atmAktiv(cm) {
  if (S.dar !== 'real' || !S.atm.an || HOME.open || !cm || !cm.isPerspectiveCamera) return false;
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
    const tex = await gen.update();
    Object.assign(ATM.ap, tex);
    Object.assign(ATM.cl, tex);
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
  ATM.ap.sky = true; // Himmel dort, wo nichts gezeichnet ist
  ATM.ap.sunLight = false; // Licht kommt von maads Lichtern (s. atmLicht)
  ATM.ap.skyLight = false;
  ATM.cl = new L.CloudsEffect(cm);
  ATM.cl.events.addEventListener('change', (ev) => {
    if (ev.property === 'atmosphereOverlay') ATM.ap.overlay = ATM.cl.atmosphereOverlay;
    else if (ev.property === 'atmosphereShadow') ATM.ap.shadow = ATM.cl.atmosphereShadow;
    else if (ev.property === 'atmosphereShadowLength') ATM.ap.shadowLength = ATM.cl.atmosphereShadowLength;
  });
  ATM.lin = new L.Effect(
    'MaadLinear',
    'uniform float uK;\nvoid mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {\n' +
      '  outputColor = vec4(pow(max(inputColor.rgb, vec3(0.0)), vec3(' +
      ATM_GAMMA.toFixed(1) +
      ')) * uK, inputColor.a);\n}\n',
    { blendFunction: L.BlendFunction.SRC, uniforms: new Map([['uK', new T.Uniform(1)]]) },
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
  ATM.cl.qualityPreset = ATM_QUAL.some((q) => q[0] === a.wq) ? a.wq : 'medium';
  ATM.cl.coverage = a.wo ? +a.wd : 0;
  ATM.cl.localWeatherVelocity.set(a.wo ? 0.00005 : 0, 0);
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
  for (const o of [ATM.ap, ATM.cl, ATM.sonne, ATM.himmel]) o.worldToECEFMatrix.copy(ATM.m);
  // Bezugshelligkeit: Sonnenlicht bei 60° Sonnenhöhe an diesem Ort
  const r = new T.Matrix3().setFromMatrix4(ATM.m),
    d = new T.Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)).applyMatrix3(r).normalize();
  ATM.sonne.sunDirection.copy(d);
  ATM.sonne.update();
  ATM.ref = Math.max(1e-6, atmY(ATM.sonne.color));
}
const atmY = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Sonnenrichtung an Atmosphäre und Wolken geben und maads Lichter einfärben (Sonnenfarbe nach Sonnenstand,
 * Himmelslicht). Aufruf aus sunUp(); dir = maads Sonnenrichtung (Einheitsvektor).
 */
function atmLicht(dir) {
  if (ATM.st !== 'bereit' || S.dar !== 'real' || !S.atm.an) return false;
  atmOrt();
  const r = new T.Matrix3().setFromMatrix4(ATM.m),
    d = new T.Vector3(dir[0], dir[1], dir[2]).applyMatrix3(r).normalize();
  for (const o of [ATM.ap, ATM.cl, ATM.sonne, ATM.himmel]) o.sunDirection.copy(d);
  ATM.sonne.update();
  ATM.himmel.update();
  // Farben relativ zur Bezugshelligkeit, mit Gamma vorverzerrt (atmLinear hebt das wieder auf)
  const g = 1 / ATM_GAMMA,
    s = ATM.sonne.color.clone().multiplyScalar(1 / ATM.ref),
    h = ATM.himmel.sh.coefficients[0].clone().multiplyScalar(Math.sqrt(Math.PI) / ATM.ref);
  const norm = (c, k) => new T.Color(Math.pow(c.r * k, g), Math.pow(c.g * k, g), Math.pow(c.b * k, g));
  sunL.color.copy(norm(s, 1));
  hemi.color.copy(
    norm(new T.Color(h.x, h.y, h.z), 1 / Math.max(1e-6, atmY({ r: h.x, g: h.y, b: h.z }) * 1.2)),
  );
  hemi.groundColor.copy(hemi.color).multiplyScalar(0.55);
  return true;
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
    // Helligkeit: Szene in Einheiten der Atmosphäre (Bezugshelligkeit / π), Belichtung für die Tonwertabbildung
    ATM.lin.uniforms.get('uK').value = ATM.ref / Math.PI;
    ren.toneMappingExposure = S.atm.bel * brK();
    const now = performance.now(),
      dt = ATM.t ? Math.min(0.1, (now - ATM.t) / 1000) : 0;
    ATM.t = now;
    const oc = ren.outputColorSpace;
    ren.outputColorSpace = T.SRGBColorSpace; // nur die letzte Stufe (Bildschirm) ist sRGB
    try {
      ATM.comp.render(dt);
    } finally {
      ren.outputColorSpace = oc;
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
  if (k === 'an') {
    drSet(S.dar); // Lichter und Himmel neu setzen
    return;
  }
  atmUi();
}
function atmUi() {
  const e = $('atmBox');
  if (!e) return;
  const a = S.atm,
    st = {
      aus: '',
      laedt: 'Himmel wird berechnet …',
      bereit: '',
      fehler: 'Nicht verfügbar – bisherige Darstellung (' + ATM.fehler + ')',
    }[ATM.st];
  e.innerHTML =
    `<label class="ck"><input type="checkbox" ${a.an ? 'checked' : ''} onchange="atmSet('an',this.checked)"> Physikalischer Himmel &amp; Atmosphäre</label>` +
    (a.an
      ? `<label class="ck"><input type="checkbox" ${a.wo ? 'checked' : ''} onchange="atmSet('wo',this.checked)"> Wolken</label>` +
        (a.wo
          ? `<label style="display:block">Bewölkung <b>${Math.round(a.wd * 100)} %</b><input type="range" min="0" max="1" step="0.05" value="${a.wd}" style="width:100%" oninput="atmSet('wd',+this.value)"></label>` +
            `<label>Wolkenqualität <select onchange="atmSet('wq',this.value)">${ATM_QUAL.map((q) => `<option value="${q[0]}" ${q[0] === a.wq ? 'selected' : ''}>${q[1]}</option>`).join('')}</select></label>`
          : '') +
        `<label style="display:block">Belichtung <b>${a.bel}</b><input type="range" min="2" max="30" step="1" value="${a.bel}" style="width:100%" oninput="atmSet('bel',+this.value)"></label>`
      : '') +
    (st ? `<div class="dmu">${st}</div>` : '');
}
/** Projekt/Ansicht laden: fehlende Werte mit Standard füllen. */
function atmLaden(x) {
  S.atm = Object.assign(atmDefault(), x && typeof x === 'object' ? x : {});
  atmWolken();
  atmUi();
}
