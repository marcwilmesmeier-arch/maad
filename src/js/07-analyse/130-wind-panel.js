// ======================= WIND & RAUCH: BEDIENUNG (Analyse-Reiter „Wind & Rauch“) =======================

const WI_ROSE = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  WI_ROSE16 = [
    'N',
    'NNO',
    'NO',
    'ONO',
    'O',
    'OSO',
    'SO',
    'SSO',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];

/** Ringausschnitt als SVG-Pfad (Winkel in Grad, 0 = oben, im Uhrzeigersinn). */
function wiBogen(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)],
    gr = a1 - a0 > 180 ? 1 : 0,
    [x0, y0] = p(r1, a0),
    [x1, y1] = p(r1, a1),
    [x2, y2] = p(r0, a1),
    [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${gr} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${gr} 0 ${x3} ${y3}Z`;
}
/**
 * Windrose wie in Forma: 16 Sektoren, Länge nach Häufigkeit am Standort (Windklima), gewählter Sektor
 * hervorgehoben, in der Mitte Richtung, Grad und Anteil.
 */
function wiRoseSvg(r) {
  const sel = Math.round(r / 22.5) % 16,
    k = WK.erg,
    mx = k ? Math.max(...k.anteil) : 1;
  let h =
    '<svg viewBox="-8 -8 136 136" width="190" height="190" role="img" aria-label="Windrichtung" style="display:block;margin:0 auto">';
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5,
      an = i === sel;
    const r1 = k ? 23 + (k.anteil[i] / mx) * 31 : an ? 54 : 46,
      tip = k
        ? `, ${(k.anteil[i] * 100).toFixed(1).replace('.', ',')} % der Stunden, Ø ${k.mittel[i].toFixed(1).replace('.', ',')} m/s`
        : '';
    h += `<path d="${wiBogen(60, 60, 22, Math.max(24, r1), a - 11.25 + 0.6, a + 11.25 - 0.6)}" fill="${an ? '#2f6db5' : k ? '#9fb9d6' : '#d9dee3'}" style="cursor:pointer" onclick="wiSet('r',${a})"><title>Wind aus ${WI_ROSE16[i]} (${a}°)${tip}</title></path>`;
  }
  for (const [t, a] of [
    ['N', 0],
    ['O', 90],
    ['S', 180],
    ['W', 270],
  ]) {
    const x = 60 + 62 * Math.sin((a * Math.PI) / 180),
      y = 60 - 62 * Math.cos((a * Math.PI) / 180) + 2.5;
    h += `<text x="${x}" y="${y}" text-anchor="middle" font-size="7" fill="#7a8590">${t}</text>`;
  }
  h += `<circle cx="60" cy="60" r="20" fill="#fff" stroke="#d9dee3"/><text x="60" y="57" text-anchor="middle" font-size="7.5" font-weight="600" fill="#1f2a33">${WI_ROSE16[sel]} ${Math.round(r)}°</text><text x="60" y="67" text-anchor="middle" font-size="7" fill="#2f6db5">${k ? Math.round(k.anteil[sel] * 100) + ' %' : 'Wind aus'}</text></svg>`;
  return h;
}
/** Ringdiagramm der Komfortanteile (wie Forma „Statistics“). */
function wiRingSvg(anteile, titel) {
  let a = 0,
    h = `<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><svg viewBox="0 0 100 100" width="92" height="92">`;
  anteile.forEach((v, i) => {
    if (v <= 0.002) return;
    const b = a + v * 360;
    h += `<path d="${wiBogen(50, 50, 32, 46, a, Math.min(b, a + 359.9))}" fill="${WI_KLASSEN[i][2]}"><title>${WI_KLASSEN[i][1]}: ${Math.round(v * 100)} %</title></path>`;
    a = b;
  });
  h += `<text x="50" y="54" text-anchor="middle" font-size="11" font-weight="600" fill="#1f2a33">${titel}</text></svg><div style="flex:1;font-size:11.5px">`;
  WI_KLASSEN.forEach((k, i) => {
    h += `<div style="display:flex;gap:6px;align-items:center"><span style="width:10px;height:10px;border-radius:50%;background:${k[2]}"></span><span style="flex:1">${k[1]}</span><b>${Math.round(anteile[i] * 100)} %</b></div>`;
  });
  return h + '</div></div>';
}
/** Farbleiste unten im Panel zur aktuellen Darstellung. */
function wiLeiste(art) {
  const p = WI_PAL[art],
    w = p.stufen.map(([g, c], i) => {
      const b = i + 1 < p.stufen.length ? p.stufen[i + 1][0] : p.max;
      return `<span style="flex:${Math.max(0.01, b - g)};background:${c}" title="${g}"></span>`;
    }),
    marken = p.stufen.map(([g]) => `<span>${art === 'turb' ? Math.round(g * 100) + ' %' : g}</span>`);
  return `<div style="display:flex;height:10px;border-radius:3px;overflow:hidden;margin-top:8px">${w.join('')}</div><div style="display:flex;justify-content:space-between;font-size:10px" class="dmu">${marken.join('')}</div><div class="dmu" style="font-size:10.5px">${art === 'komfort' ? 'mittlere Geschwindigkeit in m/s' : art === 'verst' ? 'Verstärkung gegenüber der freien Anströmung (1 = gleich)' : 'Verwirbelung: Schwankung im Verhältnis zur Anströmung, Rückströmung erhöht'}</div>`;
}

/** Inhalt des Reiters. */
function wiPanel() {
  const s = S.wi,
    z = S.wiZ,
    e = WI.erg;
  let h = `<div class="card"><b>Windkomfort</b><div class="dmu" style="margin:4px 0 8px">Wo wird es zugig, wo verwirbelt der Wind? Strömung um Bestand und Planung im Kreis um den platzierten Analysebereich. Planungshilfe – ersetzt kein Windgutachten.</div>`;
  h += `${wiRoseSvg(s.r)}<div style="font-size:12px;margin-top:4px">`;
  h += `<label style="display:block">Wind aus <input type="number" min="0" max="359" step="5" value="${s.r}" style="width:58px" onchange="wiSet('r',+this.value)"> ° <span class="dmu">(Sektor anklicken oder Grad eingeben)</span></label>`;
  h += `<label style="display:block;margin-top:6px">Windstärke in 10 m Höhe <b id="wiV">${s.v} m/s</b><input type="range" min="1" max="15" step="0.5" value="${s.v}" style="width:100%" oninput="$('wiV').textContent=this.value+' m/s'" onchange="wiSet('v',+this.value)"></label>`;
  h += WK.erg
    ? `<div class="dmu" style="margin-top:4px">Häufigkeit der Windgeschwindigkeit aus dieser Richtung:</div>${wkKurveSvg(s.r)}</div>`
    : `<div class="dmu">Mittel in Deutschland meist 3–5 m/s, stürmisch ab 10 m/s.</div></div>`;
  // Windklima des Standorts (Häufigkeit der Richtungen)
  if (WK.st === 'aus') setTimeout(() => wkLaden(), 0);
  h += `<div class="dmu" style="font-size:10.5px;margin-top:2px">${
    WK.st === 'laedt'
      ? 'Winddaten des Standorts werden geladen …'
      : WK.st === 'fehler'
        ? `Winddaten nicht verfügbar (${esc(WK.fehler)}). <a href="#" onclick="wkLaden(true);return false">erneut versuchen</a>`
        : WK.erg
          ? `Häufigkeit ${WK.erg.jahr}, Station ${esc(WK.erg.station || '?')}${WK.erg.distanz != null ? ` (${WK.erg.distanz.toFixed(0)} km)` : ''}, Windstille ${Math.round(WK.erg.still * 100)} %. Daten: Deutscher Wetterdienst (über Bright Sky).${S.wi.selbst ? ' <a href="#" onclick="S.wi.selbst=false;wkVorwahl();rr();return false">Hauptwindrichtung</a>' : ''}`
          : ''
  }</div>`;
  h += `<label style="display:block;margin-top:8px;font-size:12px">Radius des Analysebereichs <b id="wiR">${s.radius} m</b><input type="range" min="40" max="200" step="10" value="${s.radius}" style="width:100%" oninput="$('wiR').textContent=this.value+' m'" onchange="wiSet('radius',+this.value)"></label>`;
  h += `<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><button class="sm ${WI.st === 'wahl' ? 'on' : ''}" onclick="wiWahl()">${WI.st === 'wahl' ? 'Kreis setzen (Klick) …' : WI.p ? 'Bereich verschieben' : 'Bereich platzieren'}</button>${S.sel || S.site ? '<button class="sm" onclick="wiAufAuswahl()">auf Auswahl</button>' : ''}<label style="margin-left:auto;font-size:12px">Raster <select onchange="wiSet('dx',+this.value)">${[3, 4, 5].map((v) => `<option value="${v}" ${v === s.dx ? 'selected' : ''}>${v} m</option>`).join('')}</select></label></div>`;
  if (WI.st === 'rechnet')
    h += `<div style="margin-top:10px"><div style="height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="wiFort" style="height:100%;width:${Math.round(WI.anteil * 100)}%;background:#2f6db5"></div></div><div class="dmu" style="margin-top:4px">Strömung wird berechnet … maad bleibt bedienbar. <a href="#" onclick="wiAbbrechen();rr();return false">Abbrechen</a></div></div>`;
  else
    h += `<button class="pri" style="margin-top:10px;width:100%" ${WI.p ? '' : 'disabled'} onclick="wiStarten()">Wind berechnen</button>`;
  if (WI.st === 'fehler') h += `<div class="dmu" style="color:#b00">Fehler: ${esc(WI.fehler)}</div>`;
  h += '</div>';
  if (e && WI.st !== 'rechnet') {
    h += `<div class="card"><b>Ergebnis</b> <span class="dmu">(${WI.dauer} s, Wind aus ${WI_ROSE16[Math.round(e.r / 22.5) % 16]}, ${e.v10} m/s)</span>`;
    h += `<div style="display:flex;gap:4px;margin:8px 0">${[
      ['komfort', 'Komfort'],
      ['verst', 'Verstärkung'],
      ['turb', 'Verwirbelung'],
    ]
      .map(
        ([k, n]) =>
          `<button class="sm ${z.art === k ? 'on' : ''}" onclick="wiZSet('art','${k}')">${n}</button>`,
      )
      .join('')}</div>`;
    h += `<label class="ck"><input type="checkbox" ${z.flaeche ? 'checked' : ''} onchange="wiZSet('flaeche',this.checked)"> Farbfläche (Boden und Dächer)</label>`;
    h += wiLeiste(z.art);
    h += `<div style="margin-top:10px;font-size:12px"><b>Stromlinien</b></div><label class="ck"><input type="checkbox" ${z.linien3d ? 'checked' : ''} onchange="wiZSet('linien3d',this.checked)"> 3D – nach Wichtigkeit (stärkste Ablenkung)</label>`;
    if (z.linien3d)
      h += `<label style="display:block;font-size:12px">Anzahl <b id="wiA">${z.anzahl}</b><input type="range" min="10" max="200" step="10" value="${z.anzahl}" style="width:100%" oninput="$('wiA').textContent=this.value" onchange="wiZSet('anzahl',+this.value)"></label>`;
    h += `<label class="ck"><input type="checkbox" ${z.linien ? 'checked' : ''} onchange="wiZSet('linien',this.checked)"> bodennah${drReal() ? ' (bewegt)' : ''}</label>`;
    h += `<div style="margin-top:10px;font-size:12px"><b>Statistik im Kreis</b></div>`;
    h += wiRingSvg(e.anteil, 'Boden');
    if (e.anteilDach.some((v) => v > 0)) h += wiRingSvg(e.anteilDach, 'Dächer');
    h += `<div class="dmu" style="margin-top:6px">Boden: mittlere Geschwindigkeit in etwa ${(s.dx / 2).toFixed(1)} m Höhe; Dächer: knapp über Dach. Komfortklassen angelehnt an Lawson. Maus über die Fläche: Windgeschwindigkeit.</div></div>`;
  }
  h += emPanel();
  return h;
}

function wiSet(k, v) {
  if (k === 'r') v = ((Math.round(v) % 360) + 360) % 360;
  if (k === 'r' || k === 'v') S.wi.selbst = true; // eigene Wahl: Vorwahl aus dem Windklima nicht mehr überschreiben
  S.wi[k] = v;
  if (k === 'v') {
    // Strömungsbild hängt bei hohen Reynoldszahlen kaum von der Stärke ab: ohne Neuberechnung umrechnen
    if (WI.roh) WI.erg = wiAuswerten(WI.gitter, WI.roh.u, WI.roh.ti);
    if (EM.erg) emRechnen(); // Ausbreitung hängt von der Windstärke ab
  } else if (WI.erg) {
    // Richtung oder Fenster geändert: altes Ergebnis passt nicht mehr
    WI.erg = WI.roh = null;
    EM.erg = null;
    if (WI.st === 'fertig') WI.st = 'aus';
  }
  if (WI.p) wiZeichnen();
  rr();
}
function wiZSet(k, v) {
  S.wiZ[k] = v;
  wiZeichnen();
  rr();
}
/** Fortschritt aktualisieren, ohne das ganze Panel neu zu zeichnen. */
function wiPanelAuf() {
  const b = $('wiFort');
  if (WI.st === 'rechnet' && b) b.style.width = Math.round(WI.anteil * 100) + '%';
  else if (S.tab === 'Analyse' && S.anT === 'wi') rr();
}

/** Analysebereich platzieren (wie Forma): Kreis folgt der Maus, Klick setzt ihn, Esc bricht ab. */
function wiWahl() {
  WI.st = 'wahl';
  const el = ren.domElement,
    rc = new T.Raycaster(),
    punkt = (ev) => {
      const r = el.getBoundingClientRect();
      rc.setFromCamera(
        new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1),
        act(),
      );
      const hit = rc.intersectObjects([G.terrain, G.buildings], true)[0];
      return hit ? [hit.point.x, hit.point.z] : null;
    };
  let vorschau = null;
  const zeige = (p) => {
      if (vorschau) {
        WI_G.remove(vorschau);
        vorschau.geometry.dispose();
        vorschau.material.dispose();
        vorschau = null;
      }
      if (p) {
        vorschau = wiKreisLinie(p[0], p[1], 0x2f6db5);
        WI_G.add(vorschau);
      }
    },
    ende = () => {
      el.removeEventListener('pointermove', bewegt);
      el.removeEventListener('click', klick, true);
      window.removeEventListener('keydown', taste, true);
      zeige(null);
      WI.st = WI.erg ? 'fertig' : 'aus';
    },
    bewegt = (ev) => zeige(punkt(ev)),
    klick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const p = punkt(ev);
      ende();
      if (p) {
        WI.p = p;
        WI.erg = WI.roh = null;
        EM.erg = null;
        wiZeichnen();
      }
      rr();
    },
    taste = (ev) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      ende();
      rr();
    };
  el.addEventListener('pointermove', bewegt);
  el.addEventListener('click', klick, true);
  window.addEventListener('keydown', taste, true);
  WI_G.visible = true;
  rr();
}
/** Windgeschwindigkeit unter der Maus (wie Forma), solange ein Ergebnis angezeigt wird. */
function wiMausInfo(ev) {
  let d = $('wiTip');
  if (!WI.erg || !WI_G.visible || WI.st === 'wahl') {
    if (d) d.style.display = 'none';
    return;
  }
  const el = ren.domElement,
    r = el.getBoundingClientRect(),
    rc = new T.Raycaster();
  rc.setFromCamera(
    new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1),
    act(),
  );
  const hit = rc.intersectObjects([G.terrain], true)[0],
    f =
      hit &&
      Math.hypot(hit.point.x - WI.p[0], hit.point.z - WI.p[1]) <= S.wi.radius &&
      wiFeld(hit.point.x, hit.point.z);
  if (!d) {
    d = document.createElement('div');
    d.id = 'wiTip';
    d.style.cssText =
      'position:fixed;z-index:50;pointer-events:none;background:rgba(31,42,51,.88);color:#fff;font:12px system-ui,sans-serif;padding:4px 8px;border-radius:6px';
    document.body.appendChild(d);
  }
  if (!f) {
    d.style.display = 'none';
    return;
  }
  d.textContent = 'Windgeschwindigkeit: ' + Math.hypot(f[0], f[1]).toFixed(1).replace('.', ',') + ' m/s';
  d.style.left = ev.clientX + 14 + 'px';
  d.style.top = ev.clientY + 12 + 'px';
  d.style.display = 'block';
}
/** Mittelpunkt auf gewähltes Gebäude oder Grundstück setzen. */
function wiAufAuswahl() {
  const o = (S.sel && S.sel.fp) || (S.site && (S.site.pts || S.site.o));
  if (!o || !o.length) return;
  WI.p = [o.reduce((s, q) => s + q[0], 0) / o.length, o.reduce((s, q) => s + q[1], 0) / o.length];
  WI.erg = null;
  wiZeichnen();
  rr();
}
