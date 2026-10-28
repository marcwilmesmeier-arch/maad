/* ---- Gebäudemetriken: bei mehr als einem Gebäude eine Übersichtszeile „Alle Gebäude" (Anzahl, Gesamt-BGF, GR gesamt); Anklicken wählt alle Gebäude an */
(function () {
  const st = document.createElement('style');
  st.textContent =
    '#zoAll{margin:6px 0 8px;padding:6px 8px;border:1px solid rgba(0,0,0,.12);border-radius:8px;cursor:pointer}#zoAll:hover{background:rgba(94,127,146,.08)}#zoAll.on{border-color:#5E7F92;box-shadow:0 0 0 2px rgba(94,127,146,.25);background:rgba(94,127,146,.1)}#zoAll .zt{font-size:13px;font-weight:600;margin-bottom:3px}#zoAll .zr{display:flex;justify-content:space-between;gap:8px;font-size:12px}';
  document.head.appendChild(st);
})();
function zoSelAll() {
  const bs = S.bld.filter((b) => !b.ex && b.fp);
  if (bs.length < 2) return;
  S.multi = bs;
  S.multiA = [];
  S.selA = null;
  S.selF = null;
  S.par = null;
  S.sel = null;
  try {
    areaSelDraw();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    H();
    hpos();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    zoIsoClear();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  rr();
  try {
    zoRender();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    gst('Alle ' + bs.length + ' Gebäude gewählt.');
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
}
// zoRender(): Erweiterung zusammengeführt, siehe 15-grundriss/050-isolieren.js

// Flächenart 5-Zimmer-Wohnung bleibt für bestehende Projekte verfügbar
{
  const _e = () => {
    try {
      if (typeof grFA === 'function' && !grFA('wo5') && S.fa)
        S.fa.push({ k: 'wo5', n: '5-Zimmer-Wohnung', u: 'Wohnen', c: '#2f68a8', d: 'NUF', f: 100 });
    } catch (e) {
      logErr(e, '_e');
    }
  };
  _e();
}

// ---- Basis der Zeichenhilfe (Raster): Zustand, Drehung, Rasterrahmen, Ursprung/Richtung wählen, Rasterlinien im Plan
S.mx = S.mx || {};
S.mx.ras = Object.assign(
  { draw: 0, dsnap: 1, mod: 1.25, ax: 0, th: null, ox: null, oz: null },
  S.mx.ras || {},
);
const MXS = { pick: 0 };
const mxRot = (p, t) => {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
};
const mxBack = (p, t) => {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
function mxMainTh(fp) {
  let best = 0,
    th = 0;
  fp.forEach((p, i) => {
    const q = fp[(i + 1) % fp.length],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > best) {
      best = l;
      th = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
  });
  return th;
}
function mxFrame(b, lv) {
  const fp = (lv && lv.fp) || b.fp,
    R = S.mx.ras,
    th = R.th != null ? R.th : mxMainTh(fp);
  let ru, rv;
  if (R.ox != null) {
    const q = mxRot([R.ox, R.oz], th);
    ru = q[0];
    rv = q[1];
  } else {
    const P = fp.map((p) => mxRot(p, th));
    ru = Math.min(...P.map((p) => p[0]));
    rv = Math.min(...P.map((p) => p[1]));
  }
  return { th, r: [ru, rv] };
}
function mxRefresh() {
  GRS.ps = '';
  GRS.dirty = 1;
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'mxRefresh');
  }
}
GR.mxRas = (k, v, num) => {
  S.mx.ras[k] = num ? +String(v).replace(',', '.') || 0 : v;
  mxRefresh();
};
GR.mxPick = () => {
  MXS.pick = MXS.pick ? 0 : 1;
  mxRefresh();
};
GR.mxRasAuto = () => {
  S.mx.ras.th = null;
  S.mx.ras.ox = null;
  S.mx.ras.oz = null;
  MXS.pick = 0;
  mxRefresh();
};
// grDown(): Erweiterung zusammengeführt, siehe 15-grundriss/130-nachtraegliches-bearbeiten-gewaehlter-schnittgruppen.js
// grDraw(): Erweiterung zusammengeführt, siehe 15-grundriss/120-zeichnen.js
// grSnap(): Erweiterung zusammengeführt, siehe 15-grundriss/110-ausrichtung.js
function rasCard() {
  const R = S.mx.ras,
    ni = (k, l, u, mn, mx, sp) =>
      `<div class="row"><label>${l}</label><span><input type="number" style="width:64px" min="${mn}" max="${mx}" step="${sp}" value="${R[k] || 0}" onchange="GR.mxRas('${k}',this.value,1)"> ${u}</span></div>`,
    ck = (k, l, d) =>
      `<label style="display:flex;gap:6px;align-items:center;margin:3px 0"><input type="checkbox" ${(R[k] === undefined ? d : R[k]) ? 'checked' : ''} onchange="GR.mxRas('${k}',this.checked?1:0,1)">${l}</label>`;
  return (
    `<h4>Raster (Zeichenhilfe)</h4><div class="card">` +
    ck('draw', 'Raster im Plan anzeigen', 0) +
    ck('dsnap', 'Beim Zeichnen auf Raster einrasten', 1) +
    ni('mod', 'Modulraster', 'm', 0.05, 10, 0.05) +
    ni('ax', 'Tragachsabstand (0 = aus)', 'm', 0, 30, 0.25) +
    `<button class="full" onclick="GR.mxPick()" title="Im Plan zuerst den Ursprung, danach einen zweiten Punkt für die Richtung anklicken">${MXS.pick === 1 ? 'Ursprung anklicken …' : MXS.pick === 2 ? 'Richtung anklicken …' : 'Ursprung und Richtung im Plan wählen'}</button><button class="full" onclick="GR.mxRasAuto()">Automatisch (Hauptachse, linke untere Ecke)</button><div class="mu" style="margin-top:4px">Nur Zeichenhilfe: Linien, Rechtecke und Punkte rasten auf Rasterlinien ein (Shift = ohne Einrasten). </div></div>`
  );
}
// grPanel(): Erweiterung zusammengeführt, siehe 15-grundriss/100-kopf.js

// ---- Gebäudemodell-Quelle im Projekt umstellbar (Datenquellen & Einstellungen): Automatisch / LoD2 / LoD1 / OSM
S.gbMode = S.gbMode || 'auto';
const GBM = [
  ['auto', 'Automatisch (LoD3 im Quellgebiet → LoD2 Land → LoD1 Esri/IOER → OSM)'],
  ['lod2', 'LoD2 Landesquelle (echte Dachformen), ohne LoD3'],
  ['lod1', 'LoD1 (Grundriss + gemessene Höhe, Esri/IOER, keine Dachform)'],
  ['osm', 'OSM-Gebäude (extrudiert, Höhe geschätzt)'],
];
// bldLoad2(): Erweiterung zusammengeführt, siehe 02-geodaten/040-lod3.js
// lod3Ask(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
function gbModeSet(v) {
  S.gbMode = v;
  srcOpen();
}
// srcDetail(): Erweiterung zusammengeführt, siehe 04-datenquellen/020-nur-einen-datensatz.js
