// ======================= WIND: DARSTELLUNG (einfache Darstellungen) =======================
// Kreisförmiger Analysebereich mit Farbbändern am Boden und auf Dächern (Komfort, Windverstärkung,
// Verwirbelung), 3D-Stromlinien nach Wichtigkeit, bodennahe Stromlinien mit Pfeilen. Liegt knapp über dem Gelände, wirft und empfängt keine Schatten.

S.wiZ = { art: 'komfort', linien: true, flaeche: true, linien3d: true, anzahl: 60, bewegt: true };
const WI_G = new T.Group();
WI_G.name = 'wind';
sc.add(WI_G);

// Farbverläufe je Darstellung (Stützstellen [Wert, Farbe]); daraus entsteht eine Palettentextur mit Bändern.
// Komfort: Geschwindigkeit in m/s, Klassengrenzen wie WI_KLASSEN.
const WI_PAL = {
  komfort: { max: 12, stufen: WI_KLASSEN.map((k, i) => [i ? WI_KLASSEN[i - 1][0] : 0, k[2]]) },
  verst: {
    max: 1.8,
    stufen: [
      [0, '#e8eef6'],
      [0.3, '#bcd3ec'],
      [0.6, '#86b1df'],
      [0.9, '#4f86cc'],
      [1.15, '#2f5fb8'],
      [1.4, '#5a3fb0'],
      [1.65, '#b0309a'],
    ],
  },
  turb: {
    max: 1,
    stufen: [
      [0, '#e8eef6'],
      [0.15, '#bcd3ec'],
      [0.3, '#86b1df'],
      [0.45, '#e8d96a'],
      [0.6, '#f0a04b'],
      [0.8, '#e05a3c'],
    ],
  },
};
/** Wert je Zelle für die gewählte Darstellung (NaN = Gebäude/kein Wert). */
function wiWert(e, c, art, feld) {
  const v = feld ? feld[c] : e.v[c];
  if (!(v >= 0)) return NaN;
  if (art === 'komfort') return v;
  if (art === 'verst') return feld ? v / (S.wi.v || 1) : e.verst[c];
  return feld ? NaN : Math.min(1, e.turb[c] + (e.rueck[c] ? 0.35 : 0));
}
/** Farbe (THREE.Color) zu einem Wert, Bänder nach den Stützstellen. */
function wiFarbeWert(art, v, col) {
  const st = WI_PAL[art].stufen;
  let f = st[0][1];
  for (const [g, c] of st) if (v >= g) f = c;
  return col.set(f);
}
/** Palettentextur (256 × 1) für den Flächen-Shader. */
function wiPalette(art) {
  const d = new Uint8Array(256 * 4),
    col = new T.Color();
  for (let i = 0; i < 256; i++) {
    wiFarbeWert(art, (i / 255) * WI_PAL[art].max, col);
    d.set([col.r * 255, col.g * 255, col.b * 255, 255], i * 4);
  }
  const t = new T.DataTexture(d, 256, 1);
  t.needsUpdate = true;
  return t;
}

function wiLeeren() {
  while (WI_G.children.length) {
    const o = WI_G.children.pop();
    if (o.geometry && !o.userData.fremdGeo) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
}

/** Alles neu zeichnen (nach Berechnung oder Wechsel der Darstellung). */
function wiZeichnen() {
  wiLeeren();
  if (!WI.maus) {
    WI.maus = true; // Windgeschwindigkeit unter der Maus (wiMausInfo), einmal angemeldet
    ren.domElement.addEventListener('pointermove', wiMausInfo);
  }
  try {
    wiZeichnenInhalt();
  } finally {
    // alle Einblendungen: nur Farbe (nicht ins Normalenbild/die Maske von Realistisch+)
    WI_G.traverse((o) => (o.userData.nurFarbe = true));
  }
}
function wiZeichnenInhalt() {
  if (WI.p) wiRahmen();
  const e = WI.erg;
  WI.zReiter = S.anT;
  if (S.tab !== 'Analyse') return;
  if (S.anT === 'em') {
    // Reiter „Emissionen“: Straßen, Belastung und Qualm (keine Windflächen/-linien)
    WI.zModus = drReal();
    emZeichnen();
    return;
  }
  if (S.anT !== 'wi') return;
  if (e && S.wiZ.flaeche) wiFlaeche(e);
  // Realistisch und Realistisch+: bewegte Strömungsstreifen statt statischer Stromlinien
  WI.zModus = drReal();
  if (e && S.wiZ.linien) (WI.zModus ? wdWind : (x) => wiStromlinien3D(x, true))(e);
  if (e && S.wiZ.linien3d) wiStromlinien3D(e);
}

/** Kreisrand des Analysebereichs (auch als Vorschau beim Platzieren). */
function wiKreisLinie(px, pz, farbe = 0x2f5d7c) {
  const pts = [],
    R = S.wi.radius;
  for (let t = 0; t <= 128; t++) {
    const a = (t / 128) * Math.PI * 2,
      x = px + Math.cos(a) * R,
      z = pz + Math.sin(a) * R;
    pts.push(new T.Vector3(x, gh(x, z) + 0.7, z));
  }
  const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: farbe }));
  l.raycast = () => {};
  l.renderOrder = 6;
  return l;
}
function wiRahmen() {
  WI_G.add(wiKreisLinie(WI.p[0], WI.p[1]));
}

/**
 * Farbfläche im Kreis (wie Forma): Werte je Zelle als Textur, zwischen den Zellen interpoliert, über eine
 * Palettentextur in Farbbänder umgesetzt. Am Boden der Fußgängerbereich, auf den Dächern der Wind knapp über Dach.
 */
function wiFlaeche(e) {
  const gt = e.gt,
    { nx, ny } = gt,
    art = S.wiZ.art,
    max = WI_PAL[art].max,
    boden = new Float32Array(nx * ny * 2), // Wert (0..1), gültig (0/1)
    dach = new Float32Array(nx * ny * 2);
  for (let c = 0; c < nx * ny; c++) {
    const a = wiWert(e, c, art),
      b = wiWert(e, c, art, e.dach);
    if (a >= 0) boden.set([Math.min(1, a / max), 1], c * 2);
    if (b >= 0) dach.set([Math.min(1, b / max), 1], c * 2);
  }
  const tex = (d) => {
    const t = new T.DataTexture(d, nx, ny, T.RGFormat, T.FloatType);
    t.magFilter = t.minFilter = T.LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const pal = wiPalette(art),
    mat = (werte) =>
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
        uniforms: {
          tW: { value: werte },
          tP: { value: pal },
          uM: { value: new T.Vector3(WI.p[0], WI.p[1], S.wi.radius) },
        },
        vertexShader:
          'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
        // gültige Zellen gewichtet mitteln (an Gebäudekanten nicht zur 0 hin verwischen), Kreis ausschneiden
        fragmentShader:
          'uniform sampler2D tW,tP;uniform vec3 uM;varying vec2 vUv;varying vec3 vW;' +
          'void main(){if(length(vW.xz-uM.xy)>uM.z)discard;vec2 w=texture2D(tW,vUv).rg;if(w.g<.35)discard;' +
          'vec3 c=texture2D(tP,vec2(clamp(w.r/w.g,0.,1.),.5)).rgb;gl_FragColor=vec4(c,.82);}',
      });
  // Boden: Fläche folgt dem Gelände
  const g = new T.PlaneGeometry(1, 1, nx, ny),
    p = g.attributes.position,
    uv = g.attributes.uv;
  for (let v = 0; v < p.count; v++) {
    const [x, z] = gt.welt(uv.getX(v) * nx - 0.5, uv.getY(v) * ny - 0.5);
    p.setXYZ(v, x, gh(x, z) + 0.35, z);
  }
  const m = new T.Mesh(g, mat(tex(boden)));
  m.raycast = () => {};
  m.renderOrder = 2;
  WI_G.add(m);
  // Dächer: Werte auf die echten Dachflächen projiziert (Gebäudegeometrie, nur nach oben zeigende Flächen).
  // Damit Dachränder keine Lücken haben, werden die Werte um eine Zelle nach außen fortgesetzt.
  const dachW = new Float32Array(dach);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const c = i + nx * j;
      if (dach[c * 2 + 1]) continue;
      let sw = 0,
        sv = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di,
            jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const cc = ii + nx * jj;
          if (dach[cc * 2 + 1]) {
            sv += dach[cc * 2];
            sw++;
          }
        }
      if (sw) dachW.set([sv / sw, 1], c * 2);
    }
  wiDachFlaechen(gt, tex(dachW), pal);
}

/**
 * Einblendung auf den Dächern: dieselbe Geometrie wie die Gebäude (Bestand und Planung), Shader färbt nur Flächen
 * mit nach oben zeigender Normale (auch bei falsch orientierten LOD2-Flächen) und rechnet die Weltposition in
 * Gitterkoordinaten um – so liegen die Farben exakt auf den Dachflächen, auch bei geneigten Dächern.
 */
function wiDachFlaechen(gt, werte, pal) {
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
    uniforms: {
      tW: { value: werte },
      tP: { value: pal },
      uM: { value: new T.Vector3(WI.p[0], WI.p[1], S.wi.radius) },
      // Gitter: Mittelpunkt, Achsen (Strömung f, quer q), Zellweite, Zellenzahl
      uF: { value: new T.Vector2(gt.f[0], gt.f[1]) },
      uQ: { value: new T.Vector2(gt.q[0], gt.q[1]) },
      uN: { value: new T.Vector3(gt.nx, gt.ny, gt.dx) },
    },
    vertexShader:
      'varying vec3 vW,vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:
      'uniform sampler2D tW,tP;uniform vec3 uM,uN;uniform vec2 uF,uQ;varying vec3 vW,vN;' +
      'void main(){if(abs(vN.y)<.3)discard;vec2 d=vW.xz-uM.xy;if(length(d)>uM.z)discard;' +
      'vec2 uv=vec2(dot(d,uF)/uN.z+uN.x*.5,dot(d,uQ)/uN.z+uN.y*.5)/uN.xy;' +
      'vec2 w=texture2D(tW,uv).rg;if(w.g<.35)discard;' +
      'gl_FragColor=vec4(texture2D(tP,vec2(clamp(w.r/w.g,0.,1.),.5)).rgb,.85);}',
  });
  G.buildings.updateMatrixWorld(true);
  G.buildings.traverseVisible((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.normal) return;
    if (o.material && (o.material.transparent || o.material.wireframe)) return;
    const m = new T.Mesh(o.geometry, mat);
    m.matrixAutoUpdate = false;
    m.matrix.copy(o.matrixWorld);
    m.matrixWorld.copy(o.matrixWorld);
    m.raycast = () => {};
    m.renderOrder = 2;
    m.userData.fremdGeo = true; // Geometrie gehört dem Gebäude: beim Leeren nicht freigeben
    WI_G.add(m);
  });
}

/**
 * 3D-Stromlinien (wie Forma, Ansicht „Wichtigkeit“): viele Linien von der Einströmseite in verschiedenen Höhen
 * durch das mittlere Feld verfolgen und die mit der stärksten Ablenkung zeigen. Farbe nach Geschwindigkeit.
 */
// Ebenen für die Stromlinien (Farbe, Sichtbarkeit, Deckkraft im Ebenen-Menü)
// Deckkraft „Windlinien“ 0,3: animiert nur angedeutet (0,3 × 0,27 ≈ 0,08), ohne Animation kräftig (× 2,8 ≈ 0,85)
LY.push(['Windlinien', 'wind', 1, 0.3], ['Windlinien – Pulse', 'windp', 1, 1]);
S.lc.wind = '#1f338c';
S.lc.windp = '#73bfff';
const wiEbene = (k) => LY.find((l) => l[1] === k) || [0, k, 1, 1];
let wiNeuT = 0;
/** Stromlinien nach Änderung im Ebenen-Menü neu zeichnen (verzögert, Regler feuern laufend). */
function wiEbeneNeu() {
  clearTimeout(wiNeuT);
  wiNeuT = setTimeout(() => {
    if (WI.p) wiZeichnen();
  }, 120);
}

// Bewegte Stromlinien: Lichtpulse laufen mit der berechneten Geschwindigkeit die Linie entlang (Kopf hell, Schweif
// verblasst). Schnelle Stellen: Pulse eilen und ziehen sich auseinander; Stau und Wirbel: Pulse werden langsam.
// periode: Abstand der Pulse in Laufzeit (s) – kurz, damit die Folge selbst den Verlauf als Linie zeichnet;
// raffer: Zeitraffer der Bewegung; schweif: Anteil des Abstands, über den ein Puls ausläuft
const WI_PULS = { periode: 1.4, raffer: 1.5, schweif: 0.7 };

/**
 * Linienmaterial um die Pulse erweitern: Attribut „zeit“ (Laufzeit in s), Uniform uZeit (Uhr, Zeitraffer).
 * grund: Deckkraft der Linie, pulsA: Deckkraft der Pulse (aus den Ebenen „Windlinien“ und „Windlinien – Pulse“).
 */
function wiPulsMaterial(m, grund, pulsA) {
  m.userData.grund = grund;
  m.userData.pulsA = pulsA;
  m.customProgramCacheKey = () => 'wiPuls';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uZeit = { value: 0 };
    sh.uniforms.uPeriode = { value: WI_PULS.periode };
    sh.uniforms.uSchweif = { value: WI_PULS.schweif };
    sh.uniforms.uGrund = { value: m.userData.grund };
    sh.uniforms.uPulsA = { value: m.userData.pulsA };
    sh.uniforms.uPulsC = { value: new T.Color(S.lc.windp || '#73bfff') };
    m.userData.u = sh.uniforms;
    sh.vertexShader = sh.vertexShader.replace(
      'void main() {',
      'attribute float zeit;\nvarying float vZeit;\nvoid main() {\n  vZeit = zeit;',
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        'void main() {',
        'uniform float uZeit;\nuniform float uPeriode;\nuniform float uSchweif;\nuniform float uGrund;\nuniform float uPulsA;\nuniform vec3 uPulsC;\nvarying float vZeit;\nvoid main() {',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  // Abstand hinter dem nächsten Pulskopf (0 = Kopf, wächst entlang des Schweifs gegen die Strömung)
  float x = fract((uZeit - vZeit) / uPeriode) / uSchweif;
  float k = x < 1.0 ? (1.0 - x) * (1.0 - x) : 0.0;
  float p = k * uPulsA;
  diffuseColor.rgb = mix(diffuseColor.rgb, uPulsC, p > 0.0 ? k : 0.0);
  diffuseColor.a = max(uGrund * (1.0 - k), p);`,
      );
  };
  return m;
}

function wiStromlinien3D(e, nah) {
  if (!WI.roh) return;
  const gt = e.gt,
    { nx, ny, nz } = gt,
    u = WI.roh.u,
    skala = S.wi.v / WI_U10,
    zMax = Math.min(nz - 1.5, Math.max(3, (Math.max(...gt.hoehe) * 1.3) / gt.dx)),
    kand = [];
  let seed = 11;
  const zufall = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const feld = (i, j, k, out) => {
    // trilinear
    const i0 = Math.max(0, Math.min(nx - 2, Math.floor(i - 0.5))),
      j0 = Math.max(0, Math.min(ny - 2, Math.floor(j - 0.5))),
      k0 = Math.max(0, Math.min(nz - 2, Math.floor(k - 0.5))),
      a = Math.min(1, Math.max(0, i - 0.5 - i0)),
      b = Math.min(1, Math.max(0, j - 0.5 - j0)),
      c = Math.min(1, Math.max(0, k - 0.5 - k0));
    out[0] = out[1] = out[2] = 0;
    for (let n = 0; n < 8; n++) {
      const di = n & 1,
        dj = (n >> 1) & 1,
        dk = n >> 2,
        w = (di ? a : 1 - a) * (dj ? b : 1 - b) * (dk ? c : 1 - c),
        q = 3 * (i0 + di + nx * (j0 + dj + ny * (k0 + dk)));
      out[0] += u[q] * w;
      out[1] += u[q + 1] * w;
      out[2] += u[q + 2] * w;
    }
    return out;
  };
  const v = [0, 0, 0],
    anzahl = nah ? 400 : S.wiZ.anzahl || 60,
    belegt = new Set(), // bodennah: Startpunkte gleichmäßig über die Fläche, Linien nicht stapeln
    R0 = S.wi.radius / gt.dx;
  for (let s = 0; s < anzahl * (nah ? 2 : 5); s++) {
    // Hoch: Start an der Einströmseite in allen Höhen. Bodennah: Start im Kreis in 1,5–3,5 m Höhe.
    let i = 1.5,
      j = 2 + zufall() * (ny - 4),
      k = 0.6 + zufall() * zMax;
    if (nah) {
      const a = zufall() * Math.PI * 2,
        rr = Math.sqrt(zufall()) * R0;
      i = nx / 2 + Math.cos(a) * rr;
      j = ny / 2 + Math.sin(a) * rr;
      k = (1.5 + zufall() * 2) / gt.dx;
      const z0 = (i | 0) + nx * ((j | 0) + ny * (k | 0));
      if (gt.fest[z0] || belegt.has(((i / 2) | 0) + ',' + ((j / 2) | 0))) continue;
    }
    const pfad = [],
      R = S.wi.radius / gt.dx;
    let ablenkung = 0,
      imKreis = 0,
      vor = null;
    for (let n = 0; n < (nah ? 260 : 900); n++) {
      feld(i, j, k, v);
      const sp = Math.hypot(v[0], v[1], v[2]);
      if (sp < 0.004) break;
      const st = 0.4 / sp;
      pfad.push(i, j, k, sp * skala); // jeder Schritt (½ Zelle): Strecken schneiden keine Gebäudeecken
      if (vor) ablenkung += Math.hypot(v[0] / sp - vor[0], v[1] / sp - vor[1], v[2] / sp - vor[2]);
      vor = [v[0] / sp, v[1] / sp, v[2] / sp];
      i += v[0] * st;
      j += v[1] * st;
      k += v[2] * st;
      if (Math.hypot(i - nx / 2, j - ny / 2) < R) imKreis++;
      if (nah) belegt.add(((i / 2) | 0) + ',' + ((j / 2) | 0));
      if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1 || k < 0.1 || k >= nz - 1) break;
      const z = (i | 0) + nx * ((j | 0) + ny * (k | 0));
      if (gt.fest[z]) break;
      // gegen die echten Gebäude prüfen (das Gitter bildet sie nur in 3–5-m-Klötzen ab)
      const [wx, wz] = gt.welt(i - 0.5, j - 0.5);
      if (k * gt.dx < gt.hFein(wx, wz) + 0.5) break; // Punkt im Gebäude wird nicht mehr eingetragen
    }
    if (imKreis > 10 && pfad.length > 20) kand.push({ pfad, w: ablenkung });
  }
  if (!nah) kand.sort((a, b) => b.w - a.w); // „Wichtigkeit“: stärkste Ablenkung zuerst
  const pos = [],
    farbe = [],
    zeit = [], // Laufzeit des Windes bis zu diesem Punkt (s) – für die bewegten Lichtpulse
    col = new T.Color(),
    vmax = WI_PAL.komfort.max,
    eL = wiEbene('wind'),
    eP = wiEbene('windp'),
    bewegt = S.wiZ.bewegt !== false && !!eP[2],
    cL = new T.Color(S.lc.wind || '#1f338c'),
    cS = new T.Color(shade(S.lc.wind || '#1f338c', 0.7)); // schneller = dunkler/kräftiger
  if (!eL[2] && !bewegt) return;
  for (const { pfad } of kand.slice(0, anzahl)) {
    // Laufzeit je Pfadpunkt: Schrittweite ½ Zelle durch örtliche Geschwindigkeit; Startversatz zufällig, damit die
    // Pulse benachbarter Linien nicht im Gleichtakt laufen
    const tp = [];
    let t = zufall() * WI_PULS.periode;
    for (let n = 0; n < pfad.length; n += 4) {
      tp.push(t);
      t += (0.4 * gt.dx) / Math.max(0.3, pfad[n + 3]);
    }
    if (nah && !bewegt) {
      // ein kleiner Pfeil in der Mitte der Linie (Flussrichtung)
      const m = (((pfad.length / 4) >> 1) - 1) * 4;
      if (m > 0) {
        const [x0, z0] = gt.welt(pfad[m] - 0.5, pfad[m + 1] - 0.5),
          [x1, z1] = gt.welt(pfad[m + 4] - 0.5, pfad[m + 5] - 0.5),
          y = gh(x1, z1) + pfad[m + 6] * gt.dx,
          l = Math.hypot(x1 - x0, z1 - z0) || 1,
          dx = (x1 - x0) / l,
          dz = (z1 - z0) / l,
          L = 1.6;
        col.copy(cL);
        for (const sgn of [1, -1]) {
          pos.push(x1 - dx * L - sgn * dz * L * 0.5, y, z1 - dz * L + sgn * dx * L * 0.5, x1, y, z1);
          farbe.push(col.r, col.g, col.b, col.r, col.g, col.b);
          zeit.push(0, 0);
        }
      }
    }
    for (let n = 0; n + 7 < pfad.length; n += 4) {
      for (const o of [0, 4]) {
        const [x, z] = gt.welt(pfad[n + o] - 0.5, pfad[n + o + 1] - 0.5);
        pos.push(x, gh(x, z) + pfad[n + o + 2] * gt.dx, z);
        // Ebenenfarbe, schneller = kräftiger
        col.copy(cL).lerp(cS, Math.min(1, pfad[n + o + 3] / vmax));
        farbe.push(col.r, col.g, col.b);
        zeit.push(tp[(n + o) / 4]);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(farbe, 3));
  g.setAttribute('zeit', new T.Float32BufferAttribute(zeit, 1));
  const m = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: bewegt ? 1 : Math.min(1, 2.8 * eL[3]),
  });
  if (bewegt) wiPulsMaterial(m, eL[2] ? 0.27 * eL[3] : 0, eP[3]);
  const l = new T.LineSegments(g, m);
  if (bewegt)
    l.onBeforeRender = () => {
      if (m.userData.u)
        m.userData.u.uZeit.value = ((performance.now() / 1000) * WI_PULS.raffer) % WI_PULS.periode; // klein halten (float-Genauigkeit)
    };
  l.raycast = () => {};
  l.renderOrder = 3;
  WI_G.add(l);
}
