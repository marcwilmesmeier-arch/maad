// ======================= EMISSIONEN: AUSBREITUNG IM WINDFELD =======================
// Lagrange-Teilchenmodell: Eine Punktquelle (Schornstein oder Kfz-Abgase) gibt laufend Teilchen ab, die mit dem
// berechneten mittleren Windfeld (3D) transportiert werden und sich nach der örtlichen Schwankung (Turbulenzgrad)
// zufällig ausbreiten. Boden: Reflexion, Gebäude: Teilchen bleibt an der alten Stelle, Fensterrand: Teilchen verlässt
// den Rechenraum. Ergebnis: Zusatzbelastung in Fußgängerhöhe (µg/m³ bei konstantem Wind und konstanter Rate) und
// eine Momentaufnahme der Teilchenwolke. Nicht berücksichtigt: Abgasfahnenüberhöhung, Chemie, Ablagerung.
//
// wiAusbreitung() ist eine reine Rechenfunktion (Hintergrund-Thread, Node-Test).

/**
 * @param {{nx:number, ny:number, nz:number, dx:number, fest:Uint8Array, u:Float32Array, ti:Float32Array,
 *          skala:number, quelle?:number[], quellen?:Float32Array, rate:number, streu:number, dauer:number,
 *          dt:number, proSchritt:number, seed:number}} a  u/ti in Gittereinheiten, skala: m/s je Gittereinheit,
 *          quelle: [i, j, k] (Zellen) oder quellen: [i, j, k, Gewicht, …] (z. B. Straßenabschnitte),
 *          rate: g/s, streu: Quellbreite in Zellen, dauer/dt in s
 * @returns {{c:Float32Array, punkte:Float32Array, n:number}} c: µg/m³ je Bodenzelle, punkte: Teilchen [i, j, k] …
 */
function wiAusbreitung(a, fortschritt) {
  const { nx, ny, nz, dx, fest, u, ti, skala } = a,
    schritte = Math.round(a.dauer / a.dt),
    anlauf = Math.round(schritte * 0.4), // erst nach dem Anlauf mitzählen (Fahne muss sich ausbilden)
    max = schritte * a.proSchritt,
    px = new Float32Array(max),
    py = new Float32Array(max),
    pz = new Float32Array(max),
    lebt = new Uint8Array(max),
    c = new Float64Array(nx * ny);
  let seed = a.seed || 1,
    anzahl = 0;
  const zufall = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648,
    normal = () => Math.sqrt(-2 * Math.log(zufall() + 1e-12)) * Math.cos(2 * Math.PI * zufall());
  const zelle = (i, j, k) => {
    const ii = Math.min(nx - 1, Math.max(0, i | 0)),
      jj = Math.min(ny - 1, Math.max(0, j | 0)),
      kk = Math.min(nz - 1, Math.max(0, k | 0));
    return ii + nx * (jj + ny * kk);
  };
  // Mehrere Quellen: a.quellen = [i, j, k, Gewicht, …] (Gesamtrate a.rate wird nach Gewicht verteilt)
  const Q = a.quellen || null,
    nq = Q ? Q.length / 4 : 0,
    kum = new Float64Array(nq);
  let summe = 0;
  for (let n = 0; n < nq; n++) kum[n] = summe += Q[4 * n + 3];
  const masse = (a.rate * a.dt) / a.proSchritt, // g je Teilchen
    dtz = a.dt / dx; // Zeitschritt in Zellen je (m/s)
  for (let t = 0; t < schritte; t++) {
    for (let n = 0; n < a.proSchritt; n++) {
      const p = anzahl++;
      let q = a.quelle;
      if (Q) {
        // mehrere Quellen (Straßenabschnitte): Startpunkt nach Gewicht ziehen
        const z = zufall() * summe;
        let lo = 0,
          hi = nq - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (kum[m] < z) lo = m + 1;
          else hi = m;
        }
        q = [Q[4 * lo], Q[4 * lo + 1], Q[4 * lo + 2]];
      }
      px[p] = q[0] + normal() * a.streu;
      py[p] = q[1] + normal() * a.streu;
      pz[p] = q[2];
      lebt[p] = 1;
    }
    const zaehlen = t >= anlauf;
    for (let p = 0; p < anzahl; p++) {
      if (!lebt[p]) continue;
      const c0 = zelle(px[p], py[p], pz[p]),
        vx = u[3 * c0] * skala,
        vy = u[3 * c0 + 1] * skala,
        vz = u[3 * c0 + 2] * skala,
        sp = Math.hypot(vx, vy, vz),
        // Schwankung m/s: aufgelöste Turbulenz, mindestens der in Städten übliche Anteil (~18 % der Geschwindigkeit),
        // den das grobe Gitter nicht auflöst
        sig = Math.max(0.15, ti[c0] * skala, 0.18 * sp),
        tl = dx / Math.max(sp, 0.5), // Lagrange-Zeitskala ~ Zellweite / Geschwindigkeit
        K = sig * sig * tl + 0.05, // Diffusionskoeffizient m²/s
        s = Math.sqrt(2 * K * a.dt) / dx;
      const ni = px[p] + vx * dtz + normal() * s,
        nj = py[p] + vy * dtz + normal() * s;
      let nk = pz[p] + vz * dtz + normal() * s;
      if (nk < 0) nk = -nk; // Boden: Reflexion
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny || nk >= nz) {
        lebt[p] = 0;
        continue;
      }
      if (!fest[zelle(ni, nj, nk)]) {
        px[p] = ni;
        py[p] = nj;
        pz[p] = nk;
      }
      if (zaehlen && pz[p] < 1) c[zelle(px[p], py[p], 0)] += masse * a.dt;
    }
    if (fortschritt && t % 20 === 0) fortschritt(t / schritte);
  }
  // Konzentration: Masse × Aufenthaltszeit / (Zellvolumen × Mittelungszeit), g/m³ -> µg/m³
  const T = (schritte - anlauf) * a.dt,
    vol = dx * dx * dx,
    out = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) out[i] = (c[i] / (vol * T)) * 1e6;
  const pk = [];
  for (let p = 0; p < anzahl; p++) if (lebt[p]) pk.push(px[p], py[p], pz[p]);
  return { c: out, punkte: Float32Array.from(pk), n: anzahl };
}

function wiAusbreitungHaupt() {
  self.onmessage = (e) => {
    try {
      const r = wiAusbreitung(e.data, (p) => self.postMessage({ p }));
      self.postMessage({ fertig: true, c: r.c, punkte: r.punkte }, [r.c.buffer, r.punkte.buffer]);
    } catch (err) {
      self.postMessage({ fehler: String((err && err.message) || err) });
    }
  };
}

// ---- Bedienung und Ablauf (Analyse-Reiter „Emissionen“: Straßenverkehr im Analysebereich) ----
S.em = {
  flaeche: true,
  punkte: true, // Qualm
  // Kfz je Tag (DTV) nach Straßenart, Emissionsfaktor g NOx je Fahrzeug-km, eigene Werte je Straße
  dtv: { haupt: 25000, sammel: 10000, anlieger: 1500, zufahrt: 200 },
  ef: 0.25,
  dtvStr: {},
};
// Straßenarten (Kartendaten: class der OpenMapTiles-Ebene transportation), ohne Angabe nach Breite
const EM_STRASSEN = [
  ['haupt', 'Hauptverkehrsstraße', ['motorway', 'trunk', 'primary']],
  ['sammel', 'Sammelstraße', ['secondary', 'tertiary']],
  ['anlieger', 'Anliegerstraße', ['minor', 'residential', 'unclassified', 'living_street']],
  ['zufahrt', 'Zufahrt, Parkplatz', ['service', 'busway']],
];
/** Straßenart einer Kartenlinie. */
function emArt(r) {
  for (const [k, , cs] of EM_STRASSEN) if (r.c && cs.includes(r.c)) return k;
  return r.w >= 10 ? 'haupt' : r.w >= 7 ? 'sammel' : r.w >= 5 ? 'anlieger' : 'zufahrt';
}
const emSchl = (r) => r.l[0][0].toFixed(1) + ',' + r.l[0][1].toFixed(1); // Schlüssel je Straße (Startpunkt)
/** Verkehrsaufkommen (Kfz/Tag) einer Straße: eigener Wert oder Vorgabe der Straßenart. */
const emDtv = (r) => S.em.dtvStr[emSchl(r)] ?? S.em.dtv[emArt(r)];

/**
 * Straßen im Rechenfenster als Linienquellen: alle 2 m ein Quellpunkt in 0,5 m Höhe, Gewicht = Kfz/Tag × 2 m.
 * Gesamtrate (g/s) = Σ Kfz/Tag × Länge (km) × Emissionsfaktor (g/km) / 86 400 s.
 */
function emStrassen(gt) {
  const roads = (GEO.acc && GEO.acc.line && GEO.acc.line.roads) || [],
    q = [],
    abschnitte = [];
  let km = 0;
  for (const r of roads) {
    const dtv = emDtv(r);
    if (!(dtv > 0)) continue;
    for (let n = 0; n + 1 < r.l.length; n++) {
      const [x0, z0] = r.l[n],
        [x1, z1] = r.l[n + 1],
        L = Math.hypot(x1 - x0, z1 - z0),
        m = Math.max(1, Math.round(L / 2));
      let drin = false;
      for (let t = 0; t < m; t++) {
        const x = x0 + ((x1 - x0) * (t + 0.5)) / m,
          z = z0 + ((z1 - z0) * (t + 0.5)) / m,
          [i, j] = emGitter(x, z);
        if (i < 1.5 || j < 1.5 || i > gt.nx - 1.5 || j > gt.ny - 1.5 || gt.hFein(x, z) > 0) continue;
        q.push(i, j, 0.5 / gt.dx, dtv * (L / m));
        km += (L / m / 1000) * dtv;
        drin = true;
      }
      if (drin) abschnitte.push([x0, z0, x1, z1, dtv, r]);
    }
  }
  return { quellen: Float32Array.from(q), rate: (km * S.em.ef) / 86400, abschnitte };
}
const EM = {
  st: 'aus',
  anteil: 0,
  erg: null,
  fehler: '',
  worker: null,
  nachWind: false,
  strassen: null,
  hinweis: '',
};
// Klassen der Zusatzbelastung in µg/m³ (zum Vergleich: Jahresgrenzwert NO2 40 µg/m³)
const EM_KLASSEN = [
  [1, '< 1 µg/m³', '#dfe9f0'],
  [5, '1–5', '#b9d7c4'],
  [10, '5–10', '#e8d96a'],
  [20, '10–20', '#f0a04b'],
  [40, '20–40', '#e05a3c'],
  [Infinity, '> 40', '#7a1f4a'],
];

/** Berechnen: zuerst der Wind im Analysebereich (falls noch nicht berechnet), dann die Ausbreitung. */
function emStarten() {
  if (!WI.p) return;
  if (S.dar !== 'wm') drSet('wm'); // Ergebnisse im Weißmodell zeigen (beste Übersicht)
  if (!WI.roh) {
    EM.nachWind = true;
    wiStarten();
    return;
  }
  emRechnen();
}
/** Welt -> Gitter (Zellkoordinaten, kontinuierlich). */
function emGitter(x, z) {
  const gt = WI.gitter,
    dx = x - WI.p[0],
    dz = z - WI.p[1];
  return [
    (dx * gt.f[0] + dz * gt.f[1]) / gt.dx + gt.nx / 2,
    (dx * gt.q[0] + dz * gt.q[1]) / gt.dx + gt.ny / 2,
  ];
}
/** Straßen im Rechenfenster als Quellen sammeln und die Ausbreitung starten. */
function emRechnen() {
  const gt = WI.gitter,
    st = emStrassen(gt);
  EM.strassen = st;
  EM.hinweis = '';
  if (!st.quellen.length) {
    EM.st = 'fehler';
    EM.fehler = 'Im Analysebereich liegen keine Straßen (Kartendaten).';
    rr();
    return;
  }
  EM.hinweis = `${st.abschnitte.length} Straßenabschnitte, zusammen ${(st.rate * 1000).toFixed(1).replace('.', ',')} mg/s.`;
  emWorker(gt, { quellen: st.quellen, rate: st.rate, streu: 0.6, proSchritt: 24 });
}
/** Ausbreitung im Hintergrund-Thread starten (Punkt- oder Linienquellen). */
function emWorker(gt, q) {
  const skala = S.wi.v / WI_U10,
    dauer = Math.min(900, (gt.nx * gt.dx * 2.5) / Math.max(1, S.wi.v * 0.5));
  EM.st = 'rechnet';
  EM.anteil = 0;
  rr();
  const src = `${wiAusbreitung.toString()}\n(${wiAusbreitungHaupt.toString()})();`,
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
    wk = new Worker(url);
  URL.revokeObjectURL(url);
  EM.worker = wk;
  wk.onmessage = (e) => {
    const d = e.data;
    if (d.p != null) {
      EM.anteil = d.p;
      const b = $('emFort');
      if (b) b.style.width = Math.round(d.p * 100) + '%';
    } else if (d.fertig || d.fehler) {
      wk.terminate();
      EM.worker = null;
      if (d.fertig) {
        EM.erg = { c: d.c, punkte: d.punkte, gt };
        EM.st = 'fertig';
      } else {
        EM.st = 'fehler';
        EM.fehler = d.fehler;
      }
      wiZeichnen();
      rr();
    }
  };
  wk.postMessage({
    nx: gt.nx,
    ny: gt.ny,
    nz: gt.nz,
    dx: gt.dx,
    fest: gt.fest,
    u: WI.roh.u,
    ti: WI.roh.ti,
    skala,
    dauer,
    dt: 0.5,
    seed: 7,
    ...q,
  });
}
function emSet(k, v) {
  if (k.startsWith('dtv.')) S.em.dtv[k.slice(4)] = v;
  else S.em[k] = v;
  if (k === 'flaeche' || k === 'punkte') wiZeichnen();
  else if (EM.erg && WI.roh) emRechnen();
  else wiZeichnen();
  rr();
}

/** Straße anklicken und ihr Verkehrsaufkommen (Kfz/Tag) eintragen. */
function emStrasseWahl() {
  EM.st = 'strasse';
  const el = ren.domElement,
    klick = (ev) => {
      el.removeEventListener('click', klick, true);
      ev.stopPropagation();
      ev.preventDefault();
      EM.st = EM.erg ? 'fertig' : 'aus';
      const r = el.getBoundingClientRect(),
        rc = new T.Raycaster();
      rc.setFromCamera(
        new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1),
        act(),
      );
      const hit = rc.intersectObjects([G.terrain], true)[0];
      if (!hit) return rr();
      // nächste Straße (Abstand Punkt–Strecke) innerhalb von 15 m
      const px = hit.point.x,
        pz = hit.point.z;
      let best = null,
        bd = 15;
      for (const rd of (GEO.acc && GEO.acc.line && GEO.acc.line.roads) || [])
        for (let n = 0; n + 1 < rd.l.length; n++) {
          const [x0, z0] = rd.l[n],
            [x1, z1] = rd.l[n + 1],
            dx = x1 - x0,
            dz = z1 - z0,
            t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1))),
            d = Math.hypot(px - x0 - t * dx, pz - z0 - t * dz);
          if (d < bd) {
            bd = d;
            best = rd;
          }
        }
      if (!best) {
        rr();
        return;
      }
      const name = EM_STRASSEN.find((x) => x[0] === emArt(best))[1],
        e = prompt(`Verkehrsaufkommen dieser Straße (${name}) in Kfz pro Tag:`, String(emDtv(best)));
      if (e != null && e.trim() !== '' && +e >= 0) {
        S.em.dtvStr[emSchl(best)] = Math.round(+e);
        if (EM.erg && WI.roh) emRechnen();
        else wiZeichnen();
      }
      rr();
    };
  el.addEventListener('click', klick, true);
  rr();
}

/** Darstellung: Konzentrationsfläche und Teilchenwolke (Punkte). Aufruf aus wiZeichnen(). */
function emZeichnen() {
  const e = EM.erg;
  if (WI.gitter && WI.p) emStrassenZeichnen();
  if (!e) return;
  const gt = e.gt,
    { nx, ny } = gt;
  if (S.em.flaeche) {
    const data = new Uint8Array(nx * ny * 4),
      col = new T.Color();
    for (let c = 0; c < nx * ny; c++) {
      const v = e.c[c];
      if (!(v >= 0.2)) continue; // sehr geringe Werte durchsichtig
      col.set(EM_KLASSEN.find((k) => v < k[0])[2]);
      data.set([col.r * 255, col.g * 255, col.b * 255, 220], c * 4);
    }
    const tex = new T.DataTexture(data, nx, ny);
    tex.needsUpdate = true;
    const g = new T.PlaneGeometry(1, 1, nx, ny),
      p = g.attributes.position,
      uv = g.attributes.uv;
    for (let v = 0; v < p.count; v++) {
      const [x, z] = gt.welt(uv.getX(v) * nx - 0.5, uv.getY(v) * ny - 0.5);
      p.setXYZ(v, x, gh(x, z) + 0.45, z);
    }
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -6,
      }),
    );
    m.raycast = () => {};
    m.renderOrder = 2;
    WI_G.add(m);
  }
  if (S.em.punkte) wdQualm(); // bewegter Qualm (alle Darstellungen)
}

/** Straßen als Quellen: Linien knapp über der Fahrbahn, Farbe nach Verkehrsaufkommen (gelb wenig, rot viel). */
function emStrassenZeichnen() {
  const st = WI.roh ? emStrassen(WI.gitter) : null;
  if (!st || !st.abschnitte.length) return;
  const pos = [],
    farbe = [],
    col = new T.Color(),
    wenig = new T.Color('#e8c547'),
    viel = new T.Color('#b3261e');
  for (const [x0, z0, x1, z1, dtv] of st.abschnitte) {
    col.copy(wenig).lerp(viel, Math.min(1, Math.log10(Math.max(100, dtv) / 100) / 2.6));
    pos.push(x0, gh(x0, z0) + 0.8, z0, x1, gh(x1, z1) + 0.8, z1);
    farbe.push(col.r, col.g, col.b, col.r, col.g, col.b);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(farbe, 3));
  const l = new T.LineSegments(g, new T.LineBasicMaterial({ vertexColors: true }));
  l.raycast = () => {};
  l.renderOrder = 6;
  WI_G.add(l);
}

/** Inhalt des Reiters „Emissionen“. */
function emPanel() {
  const s = S.em,
    e = EM.erg;
  let h = `<div class="card"><b>Emissionen aus dem Straßenverkehr</b><div class="dmu" style="margin:4px 0 8px">Wie verteilen sich die Abgase der Straßen im Analysebereich? Ausbreitung im berechneten Windfeld (konstanter Wind, ohne Chemie).</div>`;
  // Analysebereich und Wind (gemeinsam mit dem Reiter „Wind“); Windklima für die Vorwahl der Richtung laden
  if (WK.st === 'aus') setTimeout(() => wkLaden(), 0);
  h += `<div style="font-size:12px">${
    WI.p
      ? `Analysebereich ${S.wi.radius} m, Wind aus ${WI_ROSE16[Math.round(S.wi.r / 22.5) % 16]} mit ${S.wi.v} m/s${WI.roh ? '' : ' (Wind wird mitberechnet)'}`
      : 'Noch kein Analysebereich platziert.'
  }</div><div style="display:flex;gap:6px;margin:6px 0 8px"><button class="sm ${WI.st === 'wahl' ? 'on' : ''}" onclick="wiWahl()">${WI.st === 'wahl' ? 'Kreis setzen (Klick) …' : WI.p ? 'Bereich verschieben' : 'Bereich platzieren'}</button><button class="sm" onclick="anTab('wi')">Wind einstellen</button></div>`;
  h += `<div style="font-size:12px">Verkehrsaufkommen nach Straßenart (Kfz/Tag):</div>`;
  h += EM_STRASSEN.map(
    ([k, n]) =>
      `<label style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:3px"><span style="flex:1">${n}</span><input type="number" min="0" step="100" value="${s.dtv[k]}" style="width:78px" onchange="emSet('dtv.${k}',+this.value)"></label>`,
  ).join('');
  const eigene = Object.keys(s.dtvStr).length;
  h += `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><button class="sm ${EM.st === 'strasse' ? 'on' : ''}" onclick="emStrasseWahl()">${EM.st === 'strasse' ? 'Straße anklicken …' : 'Straße einzeln festlegen'}</button>${eigene ? `<span class="dmu">${eigene} eigene Werte <a href="#" onclick="S.em.dtvStr={};emSet('ef',S.em.ef);return false">zurücksetzen</a></span>` : ''}</div>`;
  h += `<label style="display:block;font-size:12px;margin-top:6px">Emissionsfaktor <input type="number" min="0.001" step="0.01" value="${s.ef}" style="width:64px" onchange="emSet('ef',+this.value)"> g je Fahrzeug-km</label><div class="dmu">Richtwert NOx, gemischte Flotte innerorts ≈ 0,2–0,3 g/km (genauer: Handbuch für Emissionsfaktoren HBEFA). Straßen werden im Modell nach Verkehrsaufkommen eingefärbt.</div>`;
  if (EM.st === 'rechnet')
    h += `<div style="margin-top:10px;height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="emFort" style="height:100%;width:${Math.round(EM.anteil * 100)}%;background:#5b4636"></div></div><div class="dmu">Ausbreitung wird berechnet …</div>`;
  else if (WI.st === 'rechnet' && EM.nachWind)
    h += `<div style="margin-top:10px;height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="wiFort" style="height:100%;width:${Math.round(WI.anteil * 100)}%;background:#2f6db5"></div></div><div class="dmu">Zuerst wird der Wind im Analysebereich berechnet …</div>`;
  else
    h += `<button class="pri" style="margin-top:10px;width:100%" ${WI.p ? '' : 'disabled'} onclick="emStarten()">${WI.p ? 'Emissionen berechnen' : 'Zuerst Analysebereich platzieren'}</button>`;
  if (EM.st === 'fehler') h += `<div class="dmu" style="color:#b00">Fehler: ${esc(EM.fehler)}</div>`;
  h += '</div>';
  if (e && EM.st === 'fertig') {
    let mx = 0;
    for (const v of e.c) if (v > mx) mx = v;
    h += `<div class="card"><b>Ergebnis</b><div style="margin-top:8px"><label class="ck"><input type="checkbox" ${s.flaeche ? 'checked' : ''} onchange="emSet('flaeche',this.checked)"> Belastung am Boden</label> <label class="ck"><input type="checkbox" ${s.punkte ? 'checked' : ''} onchange="emSet('punkte',this.checked)"> Qualm (bewegt)</label></div>`;
    h += EM_KLASSEN.map(
      (k) =>
        `<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:3px"><span style="width:14px;height:10px;background:${k[2]};border-radius:2px"></span><span>${k[1]}</span></div>`,
    ).join('');
    if (EM.hinweis) h += `<div class="dmu" style="margin-top:6px">${esc(EM.hinweis)}</div>`;
    h += `<div class="dmu" style="margin-top:6px">Zusatzbelastung in ca. ${(e.gt.dx / 2).toFixed(1).replace('.', ',')} m Höhe, höchster Wert ${mx.toFixed(1).replace('.', ',')} µg/m³ – bei konstantem Wind aus ${WI_ROSE16[Math.round(S.wi.r / 22.5) % 16]} mit ${S.wi.v} m/s (ungünstiger Dauerfall, kein Jahresmittel).</div></div>`;
  }
  return h;
}
