// ======================= WIND & EMISSIONEN: BEDIENUNG (Analyse-Reiter „Wind & Emissionen“) =======================

const WI_ROSE = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

/** Inhalt des Reiters. */
function wiPanel() {
  const s = S.wi,
    z = S.wiZ,
    e = WI.erg,
    pkt = WI.p
      ? `Mittelpunkt gesetzt (${WI.p[0].toFixed(0)} / ${WI.p[1].toFixed(0)} m)`
      : 'Noch kein Punkt gewählt',
    rose = WI_ROSE.map((n, i) => {
      const a = (i * 45 * Math.PI) / 180,
        x = 50 + Math.sin(a) * 36,
        y = 50 - Math.cos(a) * 36,
        an = Math.round(s.r / 45) % 8 === i;
      return `<g onclick="wiSet('r',${i * 45})" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="9" fill="${an ? '#2f5d7c' : 'transparent'}" stroke="#2f5d7c"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="9" fill="${an ? '#fff' : '#2f5d7c'}">${n}</text></g>`;
    }).join(''),
    pfeil = `<g transform="rotate(${s.r + 180} 50 50)"><path d="M50 30 L50 66 M50 70 L44 60 L56 60 Z" stroke="#2f5d7c" stroke-width="2.5" fill="#2f5d7c"/></g>`;
  let h = `<div class="card"><b>Windkomfort</b><div class="dmu" style="margin:4px 0 8px">Wo wird es zugig, wo verwirbelt der Wind? Strömung um Bestand und Planung in einem Fenster um den gewählten Punkt. Planungshilfe – ersetzt kein Windgutachten.</div>`;
  h += `<div style="display:flex;gap:10px;align-items:center"><svg viewBox="0 0 100 100" width="110" height="110" role="img" aria-label="Windrichtung">${rose}${pfeil}</svg><div style="flex:1;font-size:12px">`;
  h += `<label style="display:block">Wind aus <input type="number" min="0" max="359" step="5" value="${s.r}" style="width:60px" onchange="wiSet('r',+this.value)"> ° (${WI_ROSE[Math.round(s.r / 45) % 8]})</label>`;
  h += `<label style="display:block;margin-top:6px">Windstärke in 10 m Höhe <b id="wiV">${s.v} m/s</b><input type="range" min="1" max="15" step="0.5" value="${s.v}" style="width:100%" oninput="$('wiV').textContent=this.value+' m/s'" onchange="wiSet('v',+this.value)"></label>`;
  h += `<div class="dmu">Mittel in Deutschland meist 3–5 m/s, stürmisch ab 10 m/s.</div></div></div>`;
  h += `<div style="margin-top:8px;font-size:12px">${esc(pkt)}</div><div style="display:flex;gap:6px;margin-top:6px"><button class="sm" onclick="wiWahl()">${WI.st === 'wahl' ? 'Punkt im Modell anklicken …' : 'Punkt wählen'}</button>${S.sel || S.site ? '<button class="sm" onclick="wiAufAuswahl()">Auswahl als Mitte</button>' : ''}</div>`;
  h += `<div style="display:flex;gap:10px;margin-top:8px;font-size:12px"><label>Fenster <select onchange="wiSet('fenster',+this.value)">${[160, 240, 320].map((v) => `<option value="${v}" ${v === s.fenster ? 'selected' : ''}>${v} m</option>`).join('')}</select></label><label>Raster <select onchange="wiSet('dx',+this.value)">${[3, 4, 5].map((v) => `<option value="${v}" ${v === s.dx ? 'selected' : ''}>${v} m</option>`).join('')}</select></label></div>`;
  if (WI.st === 'rechnet')
    h += `<div style="margin-top:10px"><div style="height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="wiFort" style="height:100%;width:${Math.round(WI.anteil * 100)}%;background:#2f5d7c"></div></div><div class="dmu" style="margin-top:4px">Strömung wird berechnet … maad bleibt bedienbar. <a href="#" onclick="wiAbbrechen();rr();return false">Abbrechen</a></div></div>`;
  else
    h += `<button class="pri" style="margin-top:10px;width:100%" ${WI.p ? '' : 'disabled'} onclick="wiStarten()">Wind berechnen</button>`;
  if (WI.st === 'fehler') h += `<div class="dmu" style="color:#b00">Fehler: ${esc(WI.fehler)}</div>`;
  h += '</div>';
  if (e && WI.st !== 'rechnet') {
    h += `<div class="card"><b>Ergebnis</b> <span class="dmu">(${WI.dauer} s, Wind aus ${WI_ROSE[Math.round(e.r / 45) % 8]}, ${e.v10} m/s)</span>`;
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
    h += `<label class="ck"><input type="checkbox" ${z.flaeche ? 'checked' : ''} onchange="wiZSet('flaeche',this.checked)"> Farbfläche</label> <label class="ck"><input type="checkbox" ${z.linien ? 'checked' : ''} onchange="wiZSet('linien',this.checked)"> Stromlinien</label>`;
    if (z.art === 'komfort')
      h += WI_KLASSEN.map(
        (k, i) =>
          `<div style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:3px"><span style="width:14px;height:10px;background:${k[2]};border-radius:2px"></span><span style="flex:1">${k[1]}</span><b>${Math.round(e.anteil[i] * 100)} %</b></div>`,
      ).join('');
    else
      h += `<div style="height:10px;margin-top:8px;border-radius:3px;background:linear-gradient(90deg,#3b6fb6,#5aa7d6,#9fd3b0,#e8d96a,#f0a04b,#e05a3c,#9b1d4a)"></div><div style="display:flex;justify-content:space-between;font-size:11px" class="dmu"><span>${z.art === 'verst' ? 'windstill' : 'gleichmäßig'}</span><span>${z.art === 'verst' ? 'wie Anströmung' : ''}</span><span>${z.art === 'verst' ? '1,6-fach' : 'stark verwirbelt / Rückströmung'}</span></div>`;
    h += `<div class="dmu" style="margin-top:6px">Mittlere Geschwindigkeit in etwa ${(s.dx / 2).toFixed(1)} m Höhe. Komfortklassen angelehnt an Lawson.</div></div>`;
  }
  return h;
}

function wiSet(k, v) {
  if (k === 'r') v = ((Math.round(v) % 360) + 360) % 360;
  S.wi[k] = v;
  if (k === 'v') {
    // Strömungsbild hängt bei hohen Reynoldszahlen kaum von der Stärke ab: ohne Neuberechnung umrechnen
    if (WI.roh) WI.erg = wiAuswerten(WI.gitter, WI.roh.u, WI.roh.ti);
  } else if (WI.erg) {
    // Richtung oder Fenster geändert: altes Ergebnis passt nicht mehr
    WI.erg = WI.roh = null;
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

/** Punkt im Modell wählen: nächster Klick in die 3D-Ansicht setzt den Mittelpunkt. */
function wiWahl() {
  WI.st = 'wahl';
  const el = ren.domElement,
    klick = (ev) => {
      el.removeEventListener('click', klick, true);
      ev.stopPropagation();
      ev.preventDefault();
      const r = el.getBoundingClientRect(),
        m = new T.Vector2(
          ((ev.clientX - r.left) / r.width) * 2 - 1,
          -((ev.clientY - r.top) / r.height) * 2 + 1,
        ),
        rc = new T.Raycaster();
      rc.setFromCamera(m, act());
      const hit = rc.intersectObjects([G.terrain, G.buildings], true)[0];
      WI.st = WI.erg ? 'fertig' : 'aus';
      if (hit) {
        WI.p = [hit.point.x, hit.point.z];
        WI.erg = null;
        wiZeichnen();
      }
      rr();
    };
  el.addEventListener('click', klick, true);
  rr();
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
