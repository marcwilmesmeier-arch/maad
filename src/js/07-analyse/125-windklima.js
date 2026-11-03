// ======================= WIND: WINDKLIMA AM STANDORT =======================
// Häufigkeit der Windrichtungen und Verteilung der Windgeschwindigkeit aus stündlichen Messwerten der nächsten
// DWD-Station (über Bright Sky, api.brightsky.dev; Daten: Deutscher Wetterdienst, frei nutzbar mit Quellenangabe).
// Abgerufen wird das letzte vollständige Jahr, monatsweise. Ergebnis je Standort im Browser zwischengespeichert.

const WK = { st: 'aus', k: '', erg: null, fehler: '' };
const WK_SEKTOREN = 16;

/** Winddaten laden (einmal je Standort); wählt danach die Hauptwindrichtung und deren mittlere Stärke vor. */
async function wkLaden(erzwingen) {
  const [la, lo] = drLL(),
    jahr = new Date().getFullYear() - 1,
    k = `${la.toFixed(2)},${lo.toFixed(2)},${jahr}`;
  if (!erzwingen && (WK.k === k || WK.st === 'laedt')) return;
  WK.k = k;
  WK.fehler = '';
  try {
    const c = localStorage.getItem('maad.windklima.' + k);
    if (c && !erzwingen) {
      WK.erg = JSON.parse(c);
      WK.st = 'fertig';
      wkVorwahl();
      return;
    }
  } catch (e) {
    logErr(e, 'wkLaden');
  }
  WK.st = 'laedt';
  wiPanelAuf();
  try {
    const monate = Array.from({ length: 12 }, (_, m) => {
      const von = `${jahr}-${String(m + 1).padStart(2, '0')}-01`,
        bis = m === 11 ? `${jahr + 1}-01-01` : `${jahr}-${String(m + 2).padStart(2, '0')}-01`;
      return fetch(`https://api.brightsky.dev/weather?lat=${la}&lon=${lo}&date=${von}&last_date=${bis}`).then(
        (r) => {
          if (!r.ok) throw new Error('Bright Sky: HTTP ' + r.status);
          return r.json();
        },
      );
    });
    const teile = await Promise.all(monate);
    WK.erg = wkAuswerten(teile, jahr);
    WK.st = 'fertig';
    try {
      localStorage.setItem('maad.windklima.' + k, JSON.stringify(WK.erg));
    } catch (e) {
      logErr(e, 'wkLaden');
    }
    wkVorwahl();
  } catch (e) {
    WK.st = 'fehler';
    WK.fehler = String((e && e.message) || e);
    logErr(e, 'wkLaden');
  }
  wiPanelAuf();
}

/** Häufigkeiten je Sektor, Windstille, Geschwindigkeitsverteilung je Sektor (1-m/s-Klassen bis 20 m/s). */
function wkAuswerten(teile, jahr) {
  const n = WK_SEKTOREN,
    anz = new Array(n).fill(0),
    summeV = new Array(n).fill(0),
    vert = Array.from({ length: n }, () => new Array(21).fill(0));
  let still = 0,
    gesamt = 0,
    quelle = null;
  for (const t of teile) {
    if (!quelle && t.sources && t.sources.length) quelle = t.sources[0];
    for (const w of t.weather || []) {
      if (w.wind_speed == null) continue;
      const v = w.wind_speed / 3.6; // km/h -> m/s
      gesamt++;
      if (v < 0.5 || w.wind_direction == null) {
        still++;
        continue;
      }
      const s = Math.round(w.wind_direction / (360 / n)) % n;
      anz[s]++;
      summeV[s] += v;
      vert[s][Math.min(20, Math.floor(v))]++;
    }
  }
  if (!gesamt) throw new Error('keine Winddaten für diesen Standort');
  return {
    jahr,
    stunden: gesamt,
    still: still / gesamt,
    anteil: anz.map((a) => a / gesamt),
    mittel: summeV.map((s, i) => (anz[i] ? s / anz[i] : 0)),
    vert: vert.map((v, i) => v.map((x) => (anz[i] ? x / anz[i] : 0))),
    station: quelle ? quelle.station_name : '',
    distanz: quelle && quelle.distance != null ? quelle.distance / 1000 : null,
  };
}

/** Hauptwindrichtung und deren mittlere Stärke vorwählen (nur solange der Nutzer nichts selbst gewählt hat). */
function wkVorwahl() {
  const e = WK.erg;
  if (!e || S.wi.selbst) return;
  const s = e.anteil.indexOf(Math.max(...e.anteil));
  S.wi.r = s * (360 / WK_SEKTOREN);
  S.wi.v = Math.max(1, Math.round(e.mittel[s] * 2) / 2);
  if (WI.erg) {
    WI.erg = WI.roh = null;
    EM.erg = null;
    WI.st = 'aus';
    wiZeichnen();
  }
}

/** Verteilung der Geschwindigkeit für die gewählte Richtung als kleine Kurve (wie Forma). */
function wkKurveSvg(r) {
  const e = WK.erg;
  if (!e) return '';
  const s = Math.round(r / (360 / WK_SEKTOREN)) % WK_SEKTOREN,
    v = e.vert[s],
    mx = Math.max(...v, 0.01),
    pkt = v.map((y, i) => `${8 + i * 6},${46 - (y / mx) * 36}`).join(' '),
    xv = 8 + Math.min(20, S.wi.v) * 6;
  return `<svg viewBox="0 0 136 58" width="100%" height="64" role="img" aria-label="Verteilung der Windgeschwindigkeit"><polyline points="${pkt}" fill="none" stroke="#2f6db5" stroke-width="1.6"/><line x1="${xv}" y1="8" x2="${xv}" y2="46" stroke="#1f2a33" stroke-dasharray="2 2"/><line x1="8" y1="46" x2="128" y2="46" stroke="#c9d0d6"/>${[0, 5, 10, 15, 20].map((x) => `<text x="${8 + x * 6}" y="55" font-size="6" text-anchor="middle" fill="#7a8590">${x}</text>`).join('')}<text x="130" y="55" font-size="6" text-anchor="end" fill="#7a8590">m/s</text></svg>`;
}
