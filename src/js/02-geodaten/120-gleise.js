// ======================= GLEISE =======================
// Bahnstrecken (GEO.acc.line.rail, ein Weg je Gleis) als Bauteil im ruhigen Modellstil statt als Strichlinie im
// Kartenbild: Schotterbett als flaches Band mit schrägen Flanken (25 cm hoch) in der Layer-Farbe „Bahn“, darauf
// Schwellen alle 60 cm einen Ton dunkler und zwei helle Schienen (Spurweite 1,435 m). Schwellen und Schienen zeichnet
// der Shader nach Metern entlang des Gleises (Attribut aGl: Bogenlänge, Abstand zur Achse) – scharf aus der Nähe, ohne
// Einzelteile; aus der Ferne gehen die Schwellen weich in die Bettfarbe über. Straßenbahn: kein Schotterbett, nur die
// Schienen auf Straßenhöhe. Gleise auf Brücken liegen auf dem Brückendeck (STR.brD); Tunnel werden nicht gezeichnet.

const GLS = {
  spur: 1.435, // Spurweite (m)
  schwelle: 0.6, // Schwellenabstand (m)
  bett: 0.25, // Höhe des Schotterbetts (m)
  sig: '',
  decks: [], // Bahnbrücken beim Bau (glsHoehe)
  mat: null,
  matT: null,
};

/** Material mit Schwellen und Schienen im Shader; mitSchwellen = false: nur Schienen (Straßenbahn). */
function glsMaterial(mitSchwellen) {
  const m = new T.MeshLambertMaterial({
    side: T.DoubleSide,
    transparent: !mitSchwellen,
    depthWrite: mitSchwellen,
    polygonOffset: !mitSchwellen,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlsSp = { value: GLS.spur / 2 };
    sh.uniforms.uGlsSw = { value: GLS.schwelle };
    sh.vertexShader =
      'attribute vec2 aGl;\nvarying vec2 vGl;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGl = aGl;');
    sh.fragmentShader =
      'uniform float uGlsSp, uGlsSw;\nvarying vec2 vGl;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  {
    float q = abs(vGl.y);
    vec2 fw = max(fwidth(vGl), vec2(1e-4));
    // Schiene: 7 cm Kopf, mindestens ein halber Bildpunkt breit (bleibt aus der Ferne als feiner Faden sichtbar)
    float rb = max(0.035, fw.y * 0.5);
    float schiene = 1.0 - smoothstep(rb, rb + fw.y, abs(q - uGlsSp));
    ${
      mitSchwellen
        ? `// Schotterbett hell wie das Modell (Layer-Farbe aufgehellt), Flanken etwas dunkler
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.3);
    diffuseColor.rgb *= mix(1.0, 0.9, smoothstep(1.3, 1.36, q));
    // Schwelle: 26 cm breit, 2,6 m lang, alle uGlsSw; blendet aus, wenn ein Bildpunkt mehr als ~1/3 Abstand misst
    float ph = abs(fract(vGl.x / uGlsSw) - 0.5) * uGlsSw;
    float schwelle = (1.0 - smoothstep(0.13, 0.13 + fw.x, ph)) * (1.0 - smoothstep(1.25, 1.25 + fw.y, q));
    schwelle *= 1.0 - smoothstep(0.12, 0.25, fw.x);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.84, schwelle);`
        : `diffuseColor.a = schiene;`
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.93, 0.94), schiene * 0.85);
  }`,
      );
  };
  m.customProgramCacheKey = () => 'gleis' + (mitSchwellen ? 'S' : 'T');
  return m;
}
/**
 * Höhe eines Gleispunkts: liegt er auf einer Bahnbrücke (Deck samt Verlängerung und Rampe, STR.brD), auf dem Deck –
 * auch wenn OSM das Gleis dort nicht als Brücke führt; sonst Gelände; Straßenbahn auf Straßenhöhe. Als Brücke
 * gekennzeichnete Gleise suchen etwas weiter (1 m statt 0,5 m über den Deckrand).
 */
function glsHoehe(x, z, br, tram) {
  let best = null,
    bd = 1e9;
  (GLS.decks || []).forEach((B) => {
    if (x < B.bb[0] || x > B.bb[2] || z < B.bb[1] || z > B.bb[3]) return;
    const r = B.h2 + (br ? 1 : 0.5);
    B.P.forEach((q, j) => {
      const d = Math.hypot(q[0] - x, q[1] - z);
      if (d < r && d < bd) {
        bd = d;
        best = B.Z[j] - STR.E.roads.tief + (B.dz || 0);
      }
    });
  });
  if (best != null) return best;
  if (tram && typeof fbmAufStrasse === 'function' && fbmAufStrasse(x, z)) return gh(x, z) - STR.E.roads.tief;
  return glsDom(x, z);
}
/**
 * Gleishöhe am Boden aus dem DOM (Dämme, Rampen, Einschnitte – das grobe Geländeraster zeichnet Böschungen weich):
 * der zweitkleinste von fünf Werten (Achse und je 1 m in den vier Himmelsrichtungen; Masten und Fahrleitung fallen
 * heraus); liegt er mehr als 1,5 m vom Gelände entfernt (stehender Zug, Bahnsteigdach, Brücke über einen Einschnitt),
 * null – glsBauen verbindet dann die gesicherten Höhen davor und dahinter gerade (Gleise laufen eben).
 */
function glsDom(x, z) {
  const g = gh(x, z);
  if (!GEO.dmFull || typeof strDomAbs !== 'function') return g;
  const v = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([a, b]) => strDomAbs(x + a, z + b))
    .filter((h) => h != null)
    .sort((a, b) => a - b);
  if (v.length < 3) return g;
  const h = v[1];
  return Math.abs(h - g) <= 1.5 ? h : null;
}
/**
 * Höhenverlauf eines Gleises beruhigen (Y je Punkt, S0 Bogenlänge, g höchste Neigung): gleitender Median über ±5
 * Punkte (~±10 m), Neigung vorwärts und rückwärts auf g begrenzt (Mittel beider Richtungen), Mittelwert über ±4 Punkte.
 */
function glsGlatt(Y, S0, g) {
  const n = Y.length,
    med = Y.map((_, i) => {
      const v = Y.slice(Math.max(0, i - 5), i + 6).sort((a, b) => a - b);
      return v[v.length >> 1];
    }),
    vor = med.slice(),
    rueck = med.slice();
  for (let i = 1; i < n; i++) {
    const d = (S0[i] - S0[i - 1]) * g;
    vor[i] = Math.max(vor[i - 1] - d, Math.min(vor[i - 1] + d, vor[i]));
  }
  for (let i = n - 2; i >= 0; i--) {
    const d = (S0[i + 1] - S0[i]) * g;
    rueck[i] = Math.max(rueck[i + 1] - d, Math.min(rueck[i + 1] + d, rueck[i]));
  }
  const b = med.map((_, i) => (vor[i] + rueck[i]) / 2);
  return b.map((_, i) => {
    let a = 0,
      c = 0;
    for (let k = Math.max(0, i - 4); k <= Math.min(n - 1, i + 4); k++) {
      a += b[k];
      c++;
    }
    return a / c;
  });
}
/** Gleise bauen (bei neuen Daten) bzw. nur umfärben. */
function glsAktualisieren(acc) {
  const L = (acc && acc.line && acc.line.rail) || [],
    farbe = S.lc.rail || '#9a9893';
  if (GLS.mat) GLS.mat.color.set(farbe);
  if (GLS.matT) GLS.matT.color.set(shade(farbe, 0.9));
  // neu bauen bei neuen Daten, neuen Brücken (auch nach dem Nachladen des DOM: gleiche Anzahl, neue Höhen) und DOM
  const sig = [L.length, GEO.size, GEO.e0, !!STR.E.roads.aktiv].join('|');
  if (sig === GLS.sig && GLS.acc === acc && GLS.brD === STR.brD && GLS.dm === GEO.dmFull) return;
  GLS.sig = sig;
  GLS.acc = acc;
  GLS.brD = STR.brD;
  GLS.dm = GEO.dmFull;
  glsBauen(L);
}
function glsBauen(L) {
  G.rail.children
    .filter((o) => o.userData.gls)
    .forEach((o) => {
      G.rail.remove(o);
      o.geometry.dispose();
    });
  if (!L.length || !GEO.size) return;
  // Bahnbrücken mit Umgrenzung (zum schnellen Ausschluss in glsHoehe)
  GLS.decks = ((STR.brD && STR.brD.K) || [])
    .filter((B) => !B.weg && B.k === 'rail')
    .map((B) => {
      const xs = B.P.map((p) => p[0]),
        zs = B.P.map((p) => p[1]),
        r = B.h2 + 1;
      return Object.assign(Object.create(B), {
        bb: [Math.min(...xs) - r, Math.min(...zs) - r, Math.max(...xs) + r, Math.max(...zs) + r],
      });
    });
  const h = GEO.size / 2,
    B = { pos: [], gl: [] },
    Tr = { pos: [], gl: [] };
  L.forEach((r, ri) => {
    const l = r.l;
    if (!l || l.length < 2) return;
    const tram = r.s === 'tram',
      Z = tram ? Tr : B,
      // auf etwa 2 m verdichten, Bogenlänge s
      P = [];
    for (let k = 0; k + 1 < l.length; k++) {
      const a = l[k],
        c = l[k + 1],
        n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 2));
      for (let q = 0; q < n; q++) P.push([a[0] + ((c[0] - a[0]) * q) / n, a[1] + ((c[1] - a[1]) * q) / n]);
    }
    P.push(l[l.length - 1].slice());
    let s = 0;
    const S0 = P.map((p, i) => (i ? (s += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1])) : 0)),
      Nn = P.map((p, i) => {
        const a = P[Math.max(0, i - 1)],
          c = P[Math.min(P.length - 1, i + 1)],
          d = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        return [-(c[1] - a[1]) / d, (c[0] - a[0]) / d];
      }),
      // je Gleis ein paar Millimeter versetzt: an Weichen überlagern sich Bänder nicht flimmernd
      eps = (ri % 5) * 0.003,
      Yr = P.map((p) => glsHoehe(p[0], p[1], r.br, tram)),
      // unsichere Punkte (null): gerade zwischen den gesicherten Höhen davor und dahinter (bis 60 m), sonst Gelände
      Y0 = Yr.map((y, i) => {
        if (y != null) return y;
        let a = i,
          b = i;
        while (a >= 0 && Yr[a] == null) a--;
        while (b < Yr.length && Yr[b] == null) b++;
        if (a >= 0 && b < Yr.length && S0[b] - S0[a] <= 60)
          return Yr[a] + ((Yr[b] - Yr[a]) * (S0[i] - S0[a])) / (S0[b] - S0[a] || 1);
        return gh(P[i][0], P[i][1]);
      }),
      // Gleise laufen ruhig: Median über ±10 m (Züge, Dächer, Masten fallen heraus), Neigung höchstens 3 %
      // (Straßenbahn 8 %), dann Mittelwert über ±8 m (glsGlatt)
      Y = glsGlatt(Y0, S0, tram ? 0.08 : 0.03).map((y) => y + eps),
      // Flankenfuß bis aufs Gelände nur auf flachem Damm (bis 1 m); höher (über Einschnitt, Unterführung) bleibt das
      // Bett ein dünnes Band – darunter bleibt der Blick frei
      Fu = P.map((p, i) =>
        [-1.7, 1.7].map((o) => {
          const g = gh(p[0] + Nn[i][0] * o, p[1] + Nn[i][1] * o) - 0.05;
          return Y[i] - g <= 1 ? Math.min(Y[i] + 0.02, g) : Y[i] - 0.1;
        }),
      ),
      // Querschnitt: [Abstand zur Achse, Höhe über Grund]; Straßenbahn nur ein flaches Band für die Schienen
      Q = tram
        ? [
            [-1, 0.03],
            [1, 0.03],
          ]
        : [
            [-1.7, 0.02],
            [-1.35, GLS.bett],
            [1.35, GLS.bett],
            [1.7, 0.02],
          ],
      pt = (i, k) => [
        P[i][0] + Nn[i][0] * Q[k][0],
        !tram && (k === 0 || k === Q.length - 1) ? Fu[i][k ? 1 : 0] : Y[i] + Q[k][1],
        P[i][1] + Nn[i][1] * Q[k][0],
      ];
    for (let i = 0; i + 1 < P.length; i++) {
      // ganz draußen: weglassen; über die Kante: strKappen schneidet genau ab
      if (Math.abs(P[i][0]) > h + 3 && Math.abs(P[i + 1][0]) > h + 3) continue;
      if (Math.abs(P[i][1]) > h + 3 && Math.abs(P[i + 1][1]) > h + 3) continue;
      const j = i + 1;
      for (let k = 0; k + 1 < Q.length; k++) {
        const a = pt(i, k),
          b = pt(j, k),
          c = pt(j, k + 1),
          d = pt(i, k + 1);
        Z.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        Z.gl.push(
          S0[i],
          Q[k][0],
          S0[j],
          Q[k][0],
          S0[j],
          Q[k + 1][0],
          S0[i],
          Q[k][0],
          S0[j],
          Q[k + 1][0],
          S0[i],
          Q[k + 1][0],
        );
      }
    }
  });
  const farbe = S.lc.rail || '#9a9893',
    mk = (D, mitSchwellen) => {
      // nichts über den Rand des Ausschnitts hinaus (Schwellen und Schienen laufen über aGl mit)
      const C = strKappen(D.pos, GEO.size / 2, D.gl, 2);
      if (!C.pos.length) return;
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(C.pos), 3));
      ge.setAttribute('aGl', new T.BufferAttribute(new Float32Array(C.attr), 2));
      ge.computeVertexNormals();
      if (mitSchwellen && !GLS.mat) GLS.mat = glsMaterial(true);
      if (!mitSchwellen && !GLS.matT) GLS.matT = glsMaterial(false);
      const m = mitSchwellen ? GLS.mat : GLS.matT;
      m.color.set(mitSchwellen ? farbe : shade(farbe, 0.9));
      const o = new T.Mesh(ge, m);
      o.receiveShadow = true;
      o.castShadow = mitSchwellen;
      o.raycast = () => {};
      o.userData.gls = 1;
      G.rail.add(o);
    };
  mk(B, true);
  mk(Tr, false);
}
