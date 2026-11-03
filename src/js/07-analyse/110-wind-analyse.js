// ======================= WIND: ANALYSE (Gitter, Berechnung, Auswertung) =======================
// Kreisförmiger Analysebereich (Radius, wie in Forma platziert); gerechnet wird in einem quadratischen Fenster
// mit 40 m Rand um den Kreis, in Windrichtung gedreht. Gebäude (Bestand und Planung) werden aus
// Grundriss und Höhe in Zellen übersetzt. Die Berechnung läuft im Hintergrund-Thread (wiLoeser). Ausgewertet wird
// die unterste Zellschicht (Fußgängerhöhe ≈ halbe Rasterweite über Grund).
//
// Windrichtung: meteorologisch, „woher“ in Grad (0 = Nord, 90 = Ost). maad-Welt: x = Ost, z = Süd.

S.wi = { r: 270, v: 5, radius: 100, dx: 4 };
/** Kantenlänge des Rechenfensters: Kreis plus Rand (Ein- und Ausströmung brauchen Abstand). */
const wiFenster = () => Math.max(120, 2 * S.wi.radius + 80);
const WI = {
  p: null, // Mittelpunkt [x, z]
  st: 'aus', // aus · wahl · rechnet · fertig · fehler
  anteil: 0,
  worker: null,
  erg: null, // Ergebnis (s. wiAuswerten)
  roh: null, // Rohdaten des Lösers (für Umrechnung auf andere Windstärke)
  gitter: null,
  dauer: 0,
  fehler: '',
  t0: 0,
  fv: [0, 0], // Rückgabe von wiFeld (wiederverwendet)
};
// Komfortklassen nach mittlerer Windgeschwindigkeit in Fußgängerhöhe (angelehnt an Lawson), m/s
const WI_KLASSEN = [
  [2, 'ruhig – Sitzen im Freien', '#5aa7d6'],
  [4, 'angenehm – Sitzen, Aufenthalt', '#7cc8a4'],
  [6, 'Stehen, kurzer Aufenthalt', '#d9d46a'],
  [8, 'Gehen – spürbar zugig', '#f0a04b'],
  [10, 'unangenehm zugig', '#e05a3c'],
  [Infinity, 'gefährlich (Böen)', '#9b1d4a'],
];
const WI_U10 = 0.1; // Gittergeschwindigkeit in 10 m Höhe (Mach-Zahl klein halten)

/** Strömungsrichtung (wohin) als Einheitsvektor [x, z] in maad-Weltkoordinaten. */
function wiRichtung(grad) {
  const a = (grad * Math.PI) / 180;
  return [-Math.sin(a), Math.cos(a)];
}

/** Gebäude als Liste {o: Grundriss [[x, z] …], h: Höhe über Gelände}. */
function wiGebaeude() {
  const out = [];
  for (const r of GEO.ranges || []) {
    const b = r.b;
    if (b && b.o && b.o.length > 2 && b.h > 0) out.push({ o: b.o, h: b.h });
  }
  for (const b of S.bld || [])
    if (b.fp && b.fp.length > 2 && (b._hTot || 0) > 0) out.push({ o: b.fp, h: b._hTot });
  return out;
}
const wiInnen = (o, x, z) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i],
      [xj, zj] = o[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

/** Gitter aufbauen: Höhe je Säule, feste Zellen, Abbildung Gitter -> Welt. */
function wiGitter() {
  const { dx } = S.wi,
    fenster = wiFenster(),
    [fx, fz] = wiRichtung(S.wi.r),
    qx = -fz,
    qz = fx, // quer zur Strömung
    nx = Math.round(fenster / dx),
    ny = nx,
    [px, pz] = WI.p,
    welt = (i, j) => [
      px + fx * (i + 0.5 - nx / 2) * dx + qx * (j + 0.5 - ny / 2) * dx,
      pz + fz * (i + 0.5 - nx / 2) * dx + qz * (j + 0.5 - ny / 2) * dx,
    ];
  const geb = wiGebaeude(),
    R = (fenster / 2) * Math.SQRT2 + 10,
    nah = geb.filter((b) => b.o.some(([x, z]) => Math.hypot(x - px, z - pz) < R + 60));
  // Hüllrechtecke für schnelle Vorauswahl
  for (const b of nah) {
    b.x0 = Math.min(...b.o.map((q) => q[0]));
    b.x1 = Math.max(...b.o.map((q) => q[0]));
    b.z0 = Math.min(...b.o.map((q) => q[1]));
    b.z1 = Math.max(...b.o.map((q) => q[1]));
  }
  const hoehe = new Float32Array(nx * ny);
  let hmax = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const [x, z] = welt(i, j);
      let h = 0;
      for (const b of nah)
        if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.h > h && wiInnen(b.o, x, z)) h = b.h;
      hoehe[i + nx * j] = h;
      if (h > hmax) hmax = h;
    }
  // Höhe des Rechenraums: 2,5-fache Gebäudehöhe, mindestens 40 m, höchstens 120 m
  const nz = Math.max(10, Math.min(Math.round(120 / dx), Math.ceil(Math.max(40, hmax * 2.5) / dx))),
    fest = new Uint8Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) if ((k + 0.5) * dx < hoehe[i + nx * j]) fest[i + nx * (j + ny * k)] = 1;
  // Einströmrand frei halten (Gebäude dort würden die Einströmung blockieren)
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++) for (let i = 0; i < 2; i++) fest[i + nx * (j + ny * k)] = 0;
  return { nx, ny, nz, dx, fest, hoehe, f: [fx, fz], q: [qx, qz], welt };
}

/** Berechnung starten (Hintergrund-Thread). */
function wiStarten() {
  if (!WI.p) return;
  wiAbbrechen();
  const gt = wiGitter(),
    flussDurch = gt.nx / WI_U10,
    schritte = Math.round(flussDurch * 1.9), // ~1,2 Durchläufe zum Einschwingen, dann mitteln
    mittel = Math.round(flussDurch * 0.7);
  WI.gitter = gt;
  WI.st = 'rechnet';
  WI.anteil = 0;
  WI.t0 = performance.now();
  wiPanelAuf();
  const src = `${wiLoeser.toString()}\n(${wiWorkerHaupt.toString()})();`,
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const wk = new Worker(url);
  URL.revokeObjectURL(url);
  WI.worker = wk;
  wk.onmessage = (e) => {
    const d = e.data;
    if (d.p != null) {
      WI.anteil = d.p;
      wiPanelAuf();
    } else if (d.fertig) {
      WI.worker = null;
      wk.terminate();
      WI.roh = { u: d.u, ti: d.ti };
      WI.erg = wiAuswerten(gt, d.u, d.ti);
      WI.st = 'fertig';
      WI.dauer = Math.round((performance.now() - WI.t0) / 1000);
      wiZeichnen();
      wiPanelAuf();
      // Emissionen warten auf dieses Windfeld (Quelle lag außerhalb des alten Fensters)
      if (EM.nachWind) {
        EM.nachWind = false;
        emRechnen();
      }
    } else if (d.fehler) {
      WI.worker = null;
      wk.terminate();
      WI.st = 'fehler';
      WI.fehler = d.fehler;
      wiPanelAuf();
    }
  };
  wk.onerror = (e) => {
    WI.st = 'fehler';
    WI.fehler = e.message || 'Hintergrundberechnung fehlgeschlagen';
    wiPanelAuf();
  };
  wk.postMessage({
    nx: gt.nx,
    ny: gt.ny,
    nz: gt.nz,
    fest: gt.fest,
    u10: WI_U10,
    z10: 10 / gt.dx,
    alpha: 0.25, // Stadt: Rauigkeitsexponent des Windprofils
    schritte,
    mittel,
  });
}
function wiAbbrechen() {
  if (WI.worker) WI.worker.terminate();
  WI.worker = null;
  if (WI.st === 'rechnet') WI.st = WI.erg ? 'fertig' : 'aus';
}

/**
 * Auswertung in Fußgängerhöhe (unterste Schicht): Geschwindigkeit in m/s (Gitter -> Wirklichkeit über die
 * Bezugsgeschwindigkeit in 10 m Höhe), Windverstärkung gegenüber der freien Anströmung in gleicher Höhe,
 * Turbulenzgrad (Schwankung / Bezug) und Rückströmung (entgegen der Windrichtung).
 */
function wiAuswerten(gt, u, ti) {
  const { nx, ny } = gt,
    m = nx * ny,
    v = new Float32Array(m), // m/s
    verst = new Float32Array(m),
    turb = new Float32Array(m),
    rueck = new Uint8Array(m),
    vx = new Float32Array(m), // Richtung in Welt (Einheitsvektor × Geschwindigkeit, m/s)
    vz = new Float32Array(m),
    skala = S.wi.v / WI_U10,
    frei = WI_U10 * Math.pow(0.5 / (10 / gt.dx), 0.25); // Anströmung in Fußgängerhöhe (Gitter)
  for (let c = 0; c < m; c++) {
    if (gt.fest[c]) {
      v[c] = NaN;
      continue;
    }
    const a = u[3 * c],
      b = u[3 * c + 1],
      sp = Math.hypot(a, b, u[3 * c + 2]);
    v[c] = sp * skala;
    verst[c] = sp / frei;
    turb[c] = ti[c] / Math.max(frei, 1e-6);
    rueck[c] = a < 0 ? 1 : 0;
    vx[c] = (a * gt.f[0] + b * gt.q[0]) * skala;
    vz[c] = (a * gt.f[1] + b * gt.q[1]) * skala;
  }
  // Dächer: Geschwindigkeit in der ersten freien Zelle über dem Dach (Dachterrassen, Aufenthalt auf Dächern)
  const dach = new Float32Array(m).fill(NaN),
    imKreis = new Uint8Array(m),
    R2 = S.wi.radius * S.wi.radius;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const c = i + nx * j,
        [x, z] = gt.welt(i, j);
      if ((x - WI.p[0]) ** 2 + (z - WI.p[1]) ** 2 <= R2) imKreis[c] = 1;
      const h = gt.hoehe[c];
      if (!(h > 0)) continue;
      const k = Math.min(gt.nz - 1, Math.ceil(h / gt.dx - 0.5)),
        cc = c + m * k;
      if (gt.fest[cc]) continue;
      dach[c] = Math.hypot(u[3 * cc], u[3 * cc + 1], u[3 * cc + 2]) * skala;
    }
  // Kennzahlen im Kreis: Anteile der Komfortklassen am Boden und auf Dächern
  const zaehle = (feld) => {
    const a = WI_KLASSEN.map(() => 0);
    let n = 0;
    for (let c = 0; c < m; c++) {
      if (!imKreis[c] || !(feld[c] >= 0)) continue;
      n++;
      a[WI_KLASSEN.findIndex((k) => feld[c] < k[0])]++;
    }
    return a.map((x) => x / Math.max(1, n));
  };
  return {
    v,
    verst,
    turb,
    rueck,
    vx,
    vz,
    dach,
    imKreis,
    anteil: zaehle(v),
    anteilDach: zaehle(dach),
    gt,
    r: S.wi.r,
    v10: S.wi.v,
  };
}

/**
 * Geschwindigkeit (m/s, Weltrichtung) an Weltpunkt in Fußgängerhöhe, bilinear; null außerhalb/Gebäude.
 * Ohne Speicheranlage je Aufruf (wird je Bild für viele Teilchen abgefragt); Ergebnis in WI.fv.
 */
function wiFeld(x, z) {
  const e = WI.erg;
  if (!e) return null;
  const gt = e.gt,
    dx = x - WI.p[0],
    dz = z - WI.p[1],
    i = (dx * gt.f[0] + dz * gt.f[1]) / gt.dx + gt.nx / 2 - 0.5,
    j = (dx * gt.q[0] + dz * gt.q[1]) / gt.dx + gt.ny / 2 - 0.5;
  if (i < 0 || j < 0 || i >= gt.nx - 1 || j >= gt.ny - 1) return null;
  const i0 = i | 0,
    j0 = j | 0,
    a = i - i0,
    b = j - j0,
    c = i0 + gt.nx * j0;
  let sx = 0,
    sz = 0,
    sw = 0;
  for (let k = 0; k < 4; k++) {
    const ci = c + (k & 1) + (k >> 1) * gt.nx;
    if (!(e.v[ci] >= 0)) continue;
    const g = (k & 1 ? a : 1 - a) * (k >> 1 ? b : 1 - b);
    sx += e.vx[ci] * g;
    sz += e.vz[ci] * g;
    sw += g;
  }
  if (sw < 0.5) return null;
  WI.fv[0] = sx / sw;
  WI.fv[1] = sz / sw;
  return WI.fv;
}
