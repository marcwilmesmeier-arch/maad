// ======================= WIND: STRÖMUNGSLÖSER =======================
// Gitter-Boltzmann-Verfahren (D3Q19, BGK-Stoßoperator mit Smagorinsky-Turbulenzmodell) auf einem Würfelgitter um
// den gewählten Punkt. Das Gitter ist in Windrichtung gedreht: x = Strömungsrichtung, y = quer, z = Höhe.
// Ränder: Einströmung (x = 0) mit Höhenprofil, Ausströmung (x = Ende) ohne Gradient, Seiten, Decke und Boden
// reibungsfrei, Gebäude haftend (Rückprall). Ergebnis: zeitlich gemittelte Geschwindigkeit je Zelle und
// Schwankungsstärke (Turbulenzgrad) – Grundlage für Windkomfort und Verwirbelung.
//
// wiLoeser() ist eine reine Rechenfunktion ohne Browser-Bezug: Sie läuft im Hintergrund-Thread (wiWorker) und lässt
// sich in Node testen (tests/wind.test.mjs). Einheiten im Gitter: Zellweite 1, Zeitschritt 1.

/**
 * @param {{nx:number, ny:number, nz:number, fest:Uint8Array, u10:number, z10:number, alpha:number,
 *          schritte:number, mittel:number, tau0?:number, cs?:number}} a
 *   fest: 1 = Gebäude (Index i + nx*(j + ny*k)), u10: Gittergeschwindigkeit in 10 m Höhe, z10: 10 m in Zellen,
 *   alpha: Exponent des Höhenprofils, schritte: Zeitschritte gesamt, mittel: davon für Mittelwerte (am Ende)
 * @param {(anteil:number)=>void} [fortschritt]
 * @returns {{u:Float32Array, ti:Float32Array, n:number}} u = mittlere Geschwindigkeit (3 je Zelle), ti = Schwankung
 */
function wiLoeser(a, fortschritt) {
  const { nx, ny, nz, fest } = a,
    n = nx * ny * nz,
    Q = 19;
  // Richtungen und Gewichte D3Q19
  const ex = [0, 1, -1, 0, 0, 0, 0, 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0],
    ey = [0, 0, 0, 1, -1, 0, 0, 1, -1, -1, 1, 0, 0, 0, 0, 1, -1, 1, -1],
    ez = [0, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0, 1, -1, -1, 1, 1, -1, -1, 1],
    w = [1 / 3, ...Array(6).fill(1 / 18), ...Array(12).fill(1 / 36)];
  const gegen = ex.map((_, q) =>
      ex.findIndex((_, p) => ex[p] === -ex[q] && ey[p] === -ey[q] && ez[p] === -ez[q]),
    ),
    spiegelY = ex.map((_, q) =>
      ex.findIndex((_, p) => ex[p] === ex[q] && ey[p] === -ey[q] && ez[p] === ez[q]),
    ),
    spiegelZ = ex.map((_, q) =>
      ex.findIndex((_, p) => ex[p] === ex[q] && ey[p] === ey[q] && ez[p] === -ez[q]),
    );
  const tau0 = a.tau0 || 0.51,
    cs2 = (a.cs || 0.18) ** 2;
  // Einströmprofil (Potenzgesetz über Grund), Geschwindigkeit je Höhe k
  const ein = new Float32Array(nz);
  for (let k = 0; k < nz; k++) ein[k] = a.u10 * Math.pow(Math.max(0.5, k + 0.5) / a.z10, a.alpha);
  const feq = (q, r, ux, uy, uz) => {
    const eu = ex[q] * ux + ey[q] * uy + ez[q] * uz,
      uu = ux * ux + uy * uy + uz * uz;
    return w[q] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu);
  };
  let f = new Float32Array(Q * n),
    g = new Float32Array(Q * n);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const c = i + nx * (j + ny * k),
          u0 = fest[c] ? 0 : ein[k];
        for (let q = 0; q < Q; q++) f[c * Q + q] = feq(q, 1, u0, 0, 0);
      }
  const su = new Float32Array(3 * n),
    sq = new Float32Array(n),
    fi = new Float64Array(Q),
    fq = new Float64Array(Q),
    EX = Int8Array.from(ex),
    EY = Int8Array.from(ey),
    EZ = Int8Array.from(ez),
    W = Float64Array.from(w),
    off = Int32Array.from(ex.map((_, q) => ex[q] + nx * (ey[q] + ny * ez[q])));
  let gemittelt = 0;
  const start = a.schritte - a.mittel;
  const schritt = (f, g, sammeln) => {
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++) {
        const rand = k === 0 || k === nz - 1 || j === 0 || j === ny - 1;
        for (let i = 0; i < nx; i++) {
          const c = i + nx * (j + ny * k);
          if (fest[c]) continue;
          if (i === 0) {
            // Einströmung: Gleichgewicht mit Profil
            for (let q = 0; q < Q; q++) g[c * Q + q] = feq(q, 1, ein[k], 0, 0);
            continue;
          }
          if (!rand && i < nx - 1) {
            // innere Zelle: Nachbar über festen Abstand, Gebäude -> Rückprall
            for (let q = 0; q < Q; q++) {
              const s = c - off[q];
              fi[q] = fest[s] ? f[c * Q + gegen[q]] : f[s * Q + q];
            }
          } else
            for (let q = 0; q < Q; q++) {
              // Randzelle: Ziehen mit Randbehandlung
              let si = i - EX[q],
                sj = j - EY[q],
                sk = k - EZ[q],
                qq = q;
              if (sk < 0) {
                // Boden reibungsfrei (Spiegelung): Die Grenzschicht ist bei 3–5 m Raster nicht auflösbar, das
                // Höhenprofil der Anströmung bestimmt die Geschwindigkeit in Bodennähe. Gebäude haften.
                fi[q] = f[c * Q + spiegelZ[q]];
                continue;
              }
              if (sk >= nz) {
                sk = k; // Decke: reibungsfrei (Spiegelung)
                qq = spiegelZ[q];
                si = i;
                sj = j;
              }
              if (sj < 0 || sj >= ny) {
                sj = j; // Seiten: reibungsfrei
                qq = spiegelY[qq];
                si = i;
              }
              if (si >= nx) si = i; // Ausströmung: ohne Gradient
              const s = si + nx * (sj + ny * sk);
              fi[q] = fest[s] ? f[c * Q + gegen[q]] : f[s * Q + qq];
            }
          // Makrogrößen
          let r = 0,
            ux = 0,
            uy = 0,
            uz = 0;
          for (let q = 0; q < Q; q++) {
            const v = fi[q];
            r += v;
            ux += EX[q] * v;
            uy += EY[q] * v;
            uz += EZ[q] * v;
          }
          if (!(r > 0.2 && r < 5)) r = 1; // Notbremse gegen Instabilität
          ux /= r;
          uy /= r;
          uz /= r;
          const um = Math.sqrt(ux * ux + uy * uy + uz * uz);
          if (um > 0.3) {
            ux *= 0.3 / um;
            uy *= 0.3 / um;
            uz *= 0.3 / um;
          }
          // Gleichgewicht und Smagorinsky (Nichtgleichgewichts-Impulsfluss -> lokale Relaxationszeit)
          const uu = 1.5 * (ux * ux + uy * uy + uz * uz);
          let pxx = 0,
            pyy = 0,
            pzz = 0,
            pxy = 0,
            pxz = 0,
            pyz = 0;
          for (let q = 0; q < Q; q++) {
            const x = EX[q],
              y = EY[q],
              z = EZ[q],
              eu = x * ux + y * uy + z * uz,
              e = W[q] * r * (1 + 3 * eu + 4.5 * eu * eu - uu),
              d = fi[q] - e;
            fq[q] = e;
            pxx += x * x * d;
            pyy += y * y * d;
            pzz += z * z * d;
            pxy += x * y * d;
            pxz += x * z * d;
            pyz += y * z * d;
          }
          const P = Math.sqrt(pxx * pxx + pyy * pyy + pzz * pzz + 2 * (pxy * pxy + pxz * pxz + pyz * pyz)),
            om = 1 / (0.5 * (tau0 + Math.sqrt(tau0 * tau0 + (18 * Math.SQRT2 * cs2 * P) / r)));
          for (let q = 0; q < Q; q++) g[c * Q + q] = fi[q] + om * (fq[q] - fi[q]);
          if (sammeln) {
            su[3 * c] += ux;
            su[3 * c + 1] += uy;
            su[3 * c + 2] += uz;
            sq[c] += ux * ux + uy * uy + uz * uz;
          }
        }
      }
  };
  for (let t = 0; t < a.schritte; t++) {
    const sammeln = t >= start;
    schritt(f, g, sammeln);
    if (sammeln) gemittelt++;
    const h = f;
    f = g;
    g = h;
    if (fortschritt && t % 50 === 0) fortschritt(t / a.schritte);
  }
  // Mittelwerte und Schwankung (Wurzel der mittleren quadratischen Abweichung vom Mittel)
  const u = new Float32Array(3 * n),
    ti = new Float32Array(n),
    m = Math.max(1, gemittelt);
  for (let c = 0; c < n; c++) {
    const x = su[3 * c] / m,
      y = su[3 * c + 1] / m,
      z = su[3 * c + 2] / m;
    u[3 * c] = x;
    u[3 * c + 1] = y;
    u[3 * c + 2] = z;
    ti[c] = Math.sqrt(Math.max(0, sq[c] / m - (x * x + y * y + z * z)));
  }
  return { u, ti, n: gemittelt };
}

/** Hintergrund-Thread: rechnet wiLoeser() und meldet Fortschritt. Quelltext wird als Blob gestartet (wiStarten). */
function wiWorkerHaupt() {
  self.onmessage = (e) => {
    try {
      const r = wiLoeser(e.data, (p) => self.postMessage({ p }));
      self.postMessage({ fertig: true, u: r.u, ti: r.ti }, [r.u.buffer, r.ti.buffer]);
    } catch (err) {
      self.postMessage({ fehler: String((err && err.message) || err) });
    }
  };
}
