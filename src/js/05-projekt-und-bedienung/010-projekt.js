// ---- Projekt-Assistent: Name -> Standort (Weltkugel / Adresse / Koordinaten) -> Quadrat zeichnen -> Umgebung laden
const WZ = {
  step: 1,
  name: '',
  map: null,
  marker: null,
  loc: null,
  sq: null,
  draw: false,
  label: '',
  err: '',
};
const kmx = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
function sqPoly(s) {
  const dx = s.size / 2 / kmx(s.lat),
    dy = s.size / 2 / 110574;
  return [
    [s.lon - dx, s.lat - dy],
    [s.lon + dx, s.lat - dy],
    [s.lon + dx, s.lat + dy],
    [s.lon - dx, s.lat + dy],
    [s.lon - dx, s.lat - dy],
  ];
}
const sqData = () => ({
  type: 'FeatureCollection',
  features: WZ.sq
    ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [sqPoly(WZ.sq)] } }]
    : [],
});
function newProjectReset() {
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js
  try {
    S.mat = { o: {}, nf: [] };
    l2mReg();
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
  // ── Erweiterung aus 19-fassadendesigner/010-fassadendesigner.js
  try {
    S.ft = JSON.parse(JSON.stringify(FT0));
    if (FDS.open) fdClose();
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
  S.areas = [];
  S.selA = null;
  S.multi = [];
  S.multiA = [];
  try {
    areaSelDraw();
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
  try {
    lbClear();
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
  S.bld.forEach((b) => b._g && b._g.parent && b._g.parent.remove(b._g));
  S.bld = [];
  S.variants = [];
  S.hist = [];
  S.sel = null;
  S.selF = null;
  S.par = null;
  S.parSel = new Set();
  for (let i = P.length - 1; i >= 0; i--) if (P[i].site) P.splice(i, 1);
  try {
    if (S.geo) {
      parPaint();
      recomp();
    }
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
  parBar();
  cancel();
  ctxSelect(null);
  try {
    projDefaults();
  } catch (e) {
    console.warn(e);
  }
  H();
  hpos();
  // ── Erweiterung aus 18-erweiterungen-v280-v325/040-gruenflaechen-aus-corine.js (danach)
  try {
    if (gfxDefGet()) gfxDefApply(true);
  } catch (e) {
    console.error(e);
  }

  // ── Erweiterung aus 21-gelaendeplanum/040-kantenbeschriftung-mit-boeschungs.js (danach)
  try {
    plmLoad(null);
    plmTick(1);
  } catch (e) {
    logErr(e, 'newProjectReset');
  }
}
function wzOpen(ask) {
  if (
    ask &&
    S.bld.length &&
    !confirm('Neues Projekt anlegen? Die aktuellen Gebäude und Varianten werden verworfen.')
  )
    return;
  $('wz').style.display = 'flex';
  WZ.step = 1;
  WZ.err = '';
  WZ.draw = false;
  wzRender();
}
function wzClose() {
  $('wz').style.display = 'none';
  if (WZ.map) {
    try {
      WZ.map.remove();
    } catch (e) {
      logErr(e, 'wzClose');
    }
    WZ.map = null;
    WZ.marker = null;
    WZ.btn = null;
  }
}
function wzDemo() {
  newProjectReset();
  S.project = { name: WZ.name.trim() || 'Demo-Projekt', label: 'Demo-Daten' };
  wzClose();
  updPj();
  S.tab = 'Planen';
  nav();
  rr();
}
function wzMsg(t) {
  const e = $('wzmsg');
  if (!e) return;
  e.textContent = t || '';
  e.style.display = t ? 'block' : 'none';
}
function wzInfo() {
  const e = $('wzi');
  if (e)
    e.innerHTML = WZ.loc
      ? `<div class="card"><b>${esc(WZ.label || 'Gewählter Punkt')}</b><br><span style="color:var(--mu)">${WZ.loc.lat.toFixed(5)}, ${WZ.loc.lon.toFixed(5)}</span></div>`
      : '<div style="color:var(--mu)">Noch kein Standort gewählt.</div>';
  const b = $('wzok');
  if (b) b.disabled = !WZ.loc;
}
function wzSet(lon, lat, label, fly) {
  WZ.loc = { lon, lat };
  WZ.label = label || lat.toFixed(5) + ', ' + lon.toFixed(5);
  const m = WZ.map;
  if (m) {
    if (!WZ.marker) {
      const el = document.createElement('div');
      el.style.cssText = 'width:44px;height:44px;pointer-events:none;filter:drop-shadow(0 0 2px #fff)';
      el.innerHTML =
        '<svg viewBox="0 0 512 512" width="44" height="44"><path d="M256 64v64M256 384v64M64 256h64M384 256h64" stroke="#000" stroke-width="32" stroke-linecap="round" fill="none"/><circle cx="256" cy="256" r="69" fill="#ddd" stroke="#000" stroke-width="32"/></svg>';
      WZ.marker = new maplibregl.Marker({ element: el, anchor: 'center' });
    }
    WZ.marker.setLngLat([lon, lat]).addTo(m);
    if (fly) m.flyTo({ center: [lon, lat], zoom: 16, duration: 1800 });
  }
  wzInfo();
  if (!label)
    fetch(
      `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${GEO.key}&language=de&types=address,municipality,locality`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const f = j && j.features && j.features[0];
        if (f && WZ.loc && WZ.loc.lon === lon && WZ.loc.lat === lat) {
          WZ.label = f.place_name;
          wzInfo();
        }
      })
      .catch(() => {});
}
async function wzSearch() {
  const q = (($('wza') || {}).value || '').trim();
  if (!q) return;
  wzMsg('Suche …');
  try {
    const r = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${GEO.key}&limit=1&language=de`,
    );
    if (!r.ok)
      throw new Error(
        'Adresssuche HTTP ' + r.status + (r.status === 403 ? ' (Schlüssel oder Domain prüfen)' : ''),
      );
    const j = await r.json(),
      f = j.features && j.features[0];
    if (!f) throw new Error('Nichts gefunden');
    wzMsg('');
    wzSet(f.center[0], f.center[1], f.place_name || q, true);
  } catch (e) {
    wzMsg('Fehler: ' + (e && e.message ? e.message : e));
  }
}
function wzCoord() {
  const la = parseFloat(($('wzla') || {}).value),
    lo = parseFloat(($('wzlo') || {}).value);
  if (!(la >= -85 && la <= 85 && lo >= -180 && lo <= 180)) {
    wzMsg('Bitte gültige Koordinaten eingeben (Breite −85…85, Länge −180…180).');
    return;
  }
  wzMsg('');
  wzSet(lo, la, '', true);
}
function wzLab() {
  const m = WZ.map,
    s = WZ.sq;
  if (!m || !s) return;
  const dx = s.size / 2 / kmx(s.lat),
    dy = s.size / 2 / 110574,
    t = f1(s.size) + ' m',
    src = m.getSource('sqt');
  if (src)
    src.setData({
      type: 'FeatureCollection',
      features: [
        [s.lon, s.lat + dy, 'bottom'],
        [s.lon, s.lat - dy, 'top'],
        [s.lon - dx, s.lat, 'right'],
        [s.lon + dx, s.lat, 'left'],
      ].map(([x, y, a]) => ({
        type: 'Feature',
        properties: { t, a },
        geometry: { type: 'Point', coordinates: [x, y] },
      })),
    });
  if (WZ.step === 3) {
    if (!WZ.btn) {
      const el = document.createElement('button');
      el.className = 'pri';
      el.style.cssText = 'width:auto;margin:0;padding:7px 16px;box-shadow:0 2px 8px #0003;white-space:nowrap';
      el.textContent = 'Position bestätigen';
      el.onclick = (ev) => {
        ev.stopPropagation();
        wzGo();
      };
      ['pointerdown', 'mousedown', 'dblclick'].forEach((n) =>
        el.addEventListener(n, (e) => e.stopPropagation()),
      );
      WZ.btn = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 34] })
        .setLngLat([s.lon, s.lat - dy])
        .addTo(m);
    } else WZ.btn.setLngLat([s.lon, s.lat - dy]);
  }
}
function wzSqUpd(final) {
  if (WZ.map && WZ.map.getSource('sq')) WZ.map.getSource('sq').setData(sqData());
  wzLab();
  const s = WZ.sq,
    i = $('wzinf');
  if (i && s)
    i.innerHTML = `<div class="card">${kv('Seitenlänge', f1(s.size) + ' m')}${kv('Fläche', f1((s.size * s.size) / 10000, 1) + ' ha')}${s.size > 1200 ? '<div class="wa" style="margin-top:4px">Große Fläche: Laden dauert länger.</div>' : ''}</div>`;
  const z = $('wzsz');
  if (z && final) z.value = Math.round(s.size);
}
function wzSize(v) {
  const s = WZ.sq;
  if (!s) return;
  s.size = Math.max(100, Math.min(2000, +v || 600));
  wzSqUpd(true);
  if (WZ.map)
    WZ.map.fitBounds(
      [
        [sqPoly(s)[0][0], sqPoly(s)[0][1]],
        [sqPoly(s)[2][0], sqPoly(s)[2][1]],
      ],
      { padding: 80, duration: 500, maxZoom: 18 },
    );
}
function wzDrawOn() {
  if (!WZ.map) {
    wzMsg('Karte nicht verfügbar – bitte die Seitenlänge eingeben.');
    return;
  }
  WZ.draw = true;
  WZ.map.dragPan.disable();
  WZ.map.getCanvas().style.cursor = 'crosshair';
  wzMsg('Mit gedrückter Maustaste ein Quadrat aufziehen.');
}
function wzStyle() {
  const k = GEO.key,
    F = ['Noto Sans Regular'],
    FB = ['Noto Sans Bold'],
    nm = ['coalesce', ['get', 'name:de'], ['get', 'name']],
    hl = { 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 };
  const rd = ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'];
  return {
    version: 8,
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${k}`,
    sources: { o: { type: 'vector', url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${k}` } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#ededed' } },
      {
        id: 'lc',
        type: 'fill',
        source: 'o',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#e2e2e2' },
      },
      {
        id: 'lu',
        type: 'fill',
        source: 'o',
        'source-layer': 'landuse',
        filter: [
          'in',
          'class',
          'residential',
          'suburb',
          'neighbourhood',
          'commercial',
          'industrial',
          'retail',
        ],
        paint: { 'fill-color': '#dedede' },
      },
      { id: 'wa', type: 'fill', source: 'o', 'source-layer': 'water', paint: { 'fill-color': '#c8c8c8' } },
      {
        id: 'ww',
        type: 'line',
        source: 'o',
        'source-layer': 'waterway',
        minzoom: 7,
        paint: {
          'line-color': '#c8c8c8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 2],
        },
      },
      {
        id: 'bl',
        type: 'fill',
        source: 'o',
        'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': '#cfcfcf' },
      },
      {
        id: 'rc',
        type: 'line',
        source: 'o',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: rd,
        paint: {
          'line-color': '#bcbcbc',
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.3, 12, 1.6, 17, 9],
        },
      },
      {
        id: 'rf',
        type: 'line',
        source: 'o',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: rd,
        paint: {
          'line-color': '#fafafa',
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.15, 12, 0.9, 17, 6.5],
        },
      },
      {
        id: 'b6',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        minzoom: 7,
        filter: ['==', 'admin_level', 6],
        paint: {
          'line-color': '#808080',
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 13, 1.4],
          'line-dasharray': [5, 2.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 8.5, 1],
        },
      },
      {
        id: 'b8',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        minzoom: 9,
        filter: ['==', 'admin_level', 8],
        paint: {
          'line-color': '#808080',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 15, 1.4],
          'line-dasharray': [2.5, 1.5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10.5, 1],
        },
      },
      {
        id: 'b9',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        minzoom: 11,
        filter: ['in', 'admin_level', 9, 10],
        paint: {
          'line-color': '#808080',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 1.2],
          'line-dasharray': [1, 2],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12.5, 1],
        },
      },
      {
        id: 'b4c',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        minzoom: 5,
        filter: ['==', 'admin_level', 4],
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 5],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6.5, 0.8],
        },
      },
      {
        id: 'b4',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        minzoom: 5,
        filter: ['==', 'admin_level', 4],
        paint: {
          'line-color': '#5f5f5f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 2],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6.5, 1],
        },
      },
      {
        id: 'b2c',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        filter: ['all', ['==', 'admin_level', 2], ['!=', 'maritime', 1]],
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 4, 10, 9],
          'line-opacity': 0.9,
        },
      },
      {
        id: 'b2',
        type: 'line',
        source: 'o',
        'source-layer': 'boundary',
        filter: ['all', ['==', 'admin_level', 2], ['!=', 'maritime', 1]],
        paint: {
          'line-color': '#111111',
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 10, 4],
        },
      },
      {
        id: 'rn',
        type: 'symbol',
        source: 'o',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': nm, 'text-font': F, 'text-size': 11 },
        paint: Object.assign({ 'text-color': '#707070' }, hl),
      },
      {
        id: 'pd',
        type: 'circle',
        source: 'o',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
        paint: {
          'circle-color': '#1f1f1f',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.3,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            ['match', ['get', 'class'], 'city', 2.8, 1.6],
            8,
            ['match', ['get', 'class'], 'city', 5.5, 3],
            12,
            ['match', ['get', 'class'], 'city', 6, 4.5],
          ],
        },
      },
      {
        id: 'pv',
        type: 'symbol',
        source: 'o',
        'source-layer': 'place',
        minzoom: 11,
        filter: ['in', 'class', 'village', 'suburb', 'neighbourhood'],
        layout: { 'text-field': nm, 'text-font': F, 'text-size': 11 },
        paint: Object.assign({ 'text-color': '#555' }, hl),
      },
      {
        id: 'pt',
        type: 'symbol',
        source: 'o',
        'source-layer': 'place',
        minzoom: 6,
        filter: ['==', 'class', 'town'],
        layout: {
          'text-field': nm,
          'text-font': FB,
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 12, 15],
          'text-anchor': 'top',
          'text-offset': [0, 0.55],
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: Object.assign({ 'text-color': '#2a2a2a' }, hl),
      },
      {
        id: 'pc',
        type: 'symbol',
        source: 'o',
        'source-layer': 'place',
        filter: ['==', 'class', 'city'],
        layout: {
          'text-field': nm,
          'text-font': FB,
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 13, 10, 18],
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: Object.assign({ 'text-color': '#111' }, hl),
      },
      {
        id: 'ps',
        type: 'symbol',
        source: 'o',
        'source-layer': 'place',
        minzoom: 5.5,
        maxzoom: 9,
        filter: ['==', 'class', 'state'],
        layout: {
          'text-field': ['upcase', nm],
          'text-font': F,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 13],
          'text-letter-spacing': 0.12,
          'text-max-width': 8,
        },
        paint: { 'text-color': '#7a7a7a', 'text-halo-color': '#ededed', 'text-halo-width': 1.2 },
      },
      {
        id: 'pk',
        type: 'symbol',
        source: 'o',
        'source-layer': 'place',
        maxzoom: 6,
        filter: ['==', 'class', 'country'],
        layout: {
          'text-field': ['upcase', nm],
          'text-font': FB,
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 15],
          'text-letter-spacing': 0.1,
          'text-max-width': 8,
        },
        paint: { 'text-color': '#4d4d4d', 'text-halo-color': '#ededed', 'text-halo-width': 1.4 },
      },
    ],
  };
}
function wzMap() {
  if (WZ.map) return;
  const el = $('wzm');
  el.innerHTML = '';
  if (typeof maplibregl === 'undefined') {
    el.innerHTML =
      '<div class="wzn">Kartenvorschau nicht verfügbar (Bibliothek nicht geladen). Standort bitte per Adresse oder Koordinaten eingeben.</div>';
    return;
  }
  const m = new maplibregl.Map({
    container: el,
    style: wzStyle(),
    center: WZ.loc ? [WZ.loc.lon, WZ.loc.lat] : [10, 30],
    zoom: WZ.loc ? 15 : 1.3,
    attributionControl: { compact: true },
  });
  WZ.map = m;
  m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
  m.on('style.load', () => {
    try {
      m.setProjection({ type: 'globe' });
    } catch (e) {
      logErr(e, 'wzMap>anonym');
    }
    if (!m.getSource('sq')) {
      m.addSource('sq', { type: 'geojson', data: sqData() });
      m.addLayer({
        id: 'sqf',
        type: 'fill',
        source: 'sq',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.25 },
      });
      m.addLayer({
        id: 'sql',
        type: 'line',
        source: 'sq',
        paint: { 'line-color': '#5E7F92', 'line-width': 2.5 },
      });
      m.addSource('sqt', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'sqt',
        type: 'symbol',
        source: 'sqt',
        layout: {
          'text-field': ['get', 't'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
          'text-anchor': ['get', 'a'],
          'text-offset': [
            'match',
            ['get', 'a'],
            'top',
            ['literal', [0, 0.6]],
            'bottom',
            ['literal', [0, -0.6]],
            'left',
            ['literal', [0.6, 0]],
            ['literal', [-0.6, 0]],
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1.8 },
      });
      wzLab();
    }
    if (WZ.loc) wzSet(WZ.loc.lon, WZ.loc.lat, WZ.label, false);
  });
  m.on('error', (e) => {
    wzMsg(
      'Karte konnte nicht geladen werden: ' +
        ((e && e.error && e.error.message) || 'Netzwerk') +
        ' – Standort kann unten per Adresse/Koordinaten gesetzt werden.',
    );
  });
  m.on('click', (e) => {
    if (WZ.step === 2 && !WZ.draw) wzSet(e.lngLat.lng, e.lngLat.lat, '', false);
  });
  const cc = m.getCanvasContainer();
  let a = null;
  const pt = (ev) => {
    const r = cc.getBoundingClientRect();
    return m.unproject([ev.clientX - r.left, ev.clientY - r.top]);
  };
  cc.addEventListener(
    'pointerdown',
    (ev) => {
      if (!WZ.draw) return;
      ev.preventDefault();
      ev.stopPropagation();
      a = pt(ev);
      cc.setPointerCapture(ev.pointerId);
    },
    true,
  );
  cc.addEventListener(
    'pointermove',
    (ev) => {
      if (!WZ.draw || !a) return;
      ev.stopPropagation();
      const b = pt(ev),
        k = kmx(a.lat),
        dx = (b.lng - a.lng) * k,
        dz = (b.lat - a.lat) * 110574,
        side = Math.min(2000, Math.max(10, Math.abs(dx), Math.abs(dz))),
        sx = dx < 0 ? -1 : 1,
        sz = dz < 0 ? -1 : 1;
      WZ.sq = { lon: a.lng + (sx * side) / 2 / k, lat: a.lat + (sz * side) / 2 / 110574, size: side };
      wzSqUpd(false);
    },
    true,
  );
  cc.addEventListener(
    'pointerup',
    (ev) => {
      if (!WZ.draw || !a) return;
      ev.stopPropagation();
      a = null;
      WZ.draw = false;
      m.dragPan.enable();
      m.getCanvas().style.cursor = '';
      if (WZ.sq.size < 100) WZ.sq.size = 100;
      wzMsg('');
      wzSqUpd(true);
    },
    true,
  );
}
function wzNext() {
  if (WZ.step === 1) {
    WZ.name = (WZ.name || '').trim() || 'Neues Projekt';
    WZ.step = 2;
    wzRender();
  } else if (WZ.step === 2) {
    if (!WZ.loc) return;
    WZ.sq = { lon: WZ.loc.lon, lat: WZ.loc.lat, size: WZ.sq ? WZ.sq.size : 600 };
    WZ.step = 3;
    wzRender();
    wzSize(WZ.sq.size);
  }
}

// LoD3 ist optional: Rückfrage nach der Flächenwahl, wenn für den Standort ein LoD3-Modell vorliegt
function lod3Ask(lon, lat) {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js
  if ((S.gbMode || 'auto') !== 'auto') return Promise.resolve(false);
  const src = LOD3S.find((x) => lon >= x.bb[0] && lon <= x.bb[2] && lat >= x.bb[1] && lat <= x.bb[3]);
  if (!src) return Promise.resolve(false);
  if (S.lod3On === true || GEO.lod3File) return Promise.resolve(true);
  return new Promise((res) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
    el.innerHTML = `<div style="background:var(--bg,#fff);color:var(--tx,#222);border:1px solid var(--ln,#ccc);border-radius:10px;max-width:440px;width:100%;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.3);font-size:13px;line-height:1.45"><b style="font-size:14px">LoD3‑Gebäudemodell vorhanden</b><div style="margin:8px 0">Für diesen Standort gibt es ein LoD3‑Modell: <b>${esc(src.name)}</b>. maad lädt zuerst das nächstbeste Modell (LoD2 des Landes, sonst Esri/IOER bzw. OSM) und holt LoD3 im Hintergrund nach (bis ca. 5 Minuten). Sobald es fertig ist, ersetzt es das LoD2-Modell.<div style="margin-top:6px;opacity:.75">Deine Wahl wird als Option „LoD3 im Quellgebiet immer im Hintergrund nachladen“ gespeichert (Datenquellen → Gebäude → Optionen).</div></div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="sm" id="l3n">Nur LoD2</button><button class="pri" style="width:auto;margin:0" id="l3y">LoD3 im Hintergrund nachladen</button></div></div>`;
    document.body.appendChild(el);
    const done = (v) => {
      el.remove();
      res(v);
    };
    el.querySelector('#l3y').onclick = () => {
      S.lod3On = true;
      done(true);
    };
    el.querySelector('#l3n').onclick = () => {
      S.lod3On = false;
      done(false);
    };
  });
}
async function wzGo() {
  const s = WZ.sq;
  if (!s) return;
  GEO.lod3Pick = await lod3Ask(s.lon, s.lat);
  WZ.step = 4;
  wzRender();
  const r = await geoRun(s.lon, s.lat, s.size, WZ.label);
  if (r.ok) {
    newProjectReset();
    S.project = {
      id: projId(),
      name: WZ.name || 'Projekt',
      label: WZ.label,
      size: s.size,
      lon: s.lon,
      lat: s.lat,
    };
    wzClose();
    updPj();
    S.tab = 'Planen';
    nav();
    rr();
  } else {
    WZ.err = r.msg;
    WZ.step = 5;
    wzRender();
  }
}
function wzRender() {
  const w = $('wz'),
    r = $('wzr'),
    st = WZ.step;
  if (st !== 3 && WZ.btn) {
    WZ.btn.remove();
    WZ.btn = null;
  }
  w.dataset.s = st === 1 ? 1 : 2;
  $('wzs').innerHTML = ['Projekt', 'Standort', 'Umgebung']
    .map((t, i) => `<span class="${st === i + 1 || (st > 3 && i === 2) ? 'on' : ''}">${i + 1} ${t}</span>`)
    .join('');
  if (st === 1) {
    r.innerHTML = `<h2>Neues Projekt</h2>Projektname<input id="wzn" type="text" value="${esc(WZ.name)}" placeholder="z. B. Quartier Musterstraße" oninput="WZ.name=this.value" onkeydown="if(event.key=='Enter')wzNext()"><button class="pri" onclick="wzNext()">Weiter</button><button class="sm" style="margin-top:6px;width:100%" onclick="wzDemo()">Leere Szene ohne Kartendaten öffnen</button>`;
    setTimeout(() => {
      const n = $('wzn');
      n && n.focus();
    }, 50);
    return;
  }
  wzMap();
  setTimeout(() => {
    if (WZ.map) WZ.map.resize();
  }, 50);
  if (st === 2) {
    r.innerHTML = `<h2>Standort wählen</h2><div style="color:var(--mu)">Per Hand: Weltkugel drehen, zoomen und auf den Ort klicken. Oder genau eingeben:</div>Adresse<input id="wza" type="text" placeholder="Straße, Ort" onkeydown="if(event.key=='Enter')wzSearch()"><button class="sm" onclick="wzSearch()">Adresse suchen</button>Koordinaten (Breite / Länge)<div style="display:flex;gap:4px"><input id="wzla" type="number" step="any" placeholder="52.0302"><input id="wzlo" type="number" step="any" placeholder="8.5325"></div><button class="sm" onclick="wzCoord()">Koordinaten setzen</button><div id="wzi"></div><button class="pri" id="wzok" onclick="wzNext()">Weiter</button><button class="sm" onclick="WZ.step=1;wzRender()">Zurück</button>`;
    wzInfo();
  } else if (st === 3) {
    r.innerHTML = `<h2>Umgebung festlegen</h2><div style="color:var(--mu)">Nur dieser quadratische Bereich wird geladen (100–2000 m). Danach unter dem Bereich auf „Position bestätigen“ klicken.</div><button class="sm" onclick="wzDrawOn()">▢ Quadrat frei zeichnen</button>Seitenlänge (m)<input id="wzsz" type="number" min="100" max="2000" step="50" value="${Math.round(WZ.sq.size)}" onchange="wzSize(this.value)"><div id="wzinf"></div>${WZ.map ? '' : '<button class="pri" onclick="wzGo()">Position bestätigen</button>'}<button class="sm" onclick="WZ.step=2;wzRender()">Zurück</button>`;
    wzSqUpd(true);
  } else if (st === 4) {
    r.innerHTML = `<h2>Umgebung wird geladen</h2><div id="wzld" style="color:var(--mu)">${esc(GEO.status || 'Bitte warten …')}</div>`;
  } else {
    r.innerHTML = `<h2>Laden fehlgeschlagen</h2><div class="wa">${esc(WZ.err)}</div><button class="pri" onclick="wzGo()">Erneut versuchen</button><button class="sm" onclick="WZ.step=3;wzRender()">Zurück</button><button class="sm" onclick="wzDemo()">Mit Demo-Daten fortfahren</button>`;
  }
}
const _inR = (x, z, o) => {
  let c = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    if (
      o[i][1] > z !== o[j][1] > z &&
      x < ((o[j][0] - o[i][0]) * (z - o[i][1])) / (o[j][1] - o[i][1]) + o[i][0]
    )
      c = !c;
  }
  return c;
};
const _dE = (x, z, o) => {
  let m = 1e9;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const ax = o[j][0],
      ay = o[j][1],
      dx = o[i][0] - ax,
      dy = o[i][1] - ay,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - ay) * dy) / (dx * dx + dy * dy || 1)));
    m = Math.min(m, Math.hypot(x - ax - t * dx, z - ay - t * dy));
  }
  return m;
};
function treeInRings(t, rings, tol) {
  for (const o of rings) {
    if (!o || o.length < 3) continue;
    if (_inR(t.x, t.z, o) || _dE(t.x, t.z, o) < tol) return true;
  }
  return false;
}
function treePrune(rings) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
  let n = (() => {
    if (!GEO.trees || !GEO.trees.length || !rings.length) return 0;
    const rm = GEO.trees.filter((t) => treeInRings(t, rings, 0.6));
    if (!rm.length) return 0;
    GEO.tdel = (GEO.tdel || []).concat(rm);
    treesBuild(GEO.trees.filter((t) => !rm.includes(t)));
    return rm.length;
  })();
  try {
    const rm = railTrees();
    if (rm.length) {
      GEO.tdel = (GEO.tdel || []).concat(rm);
      treesBuild(GEO.trees.filter((t) => !rm.includes(t)));
      n += rm.length;
      GEO.railDel = rm.length;
    }
  } catch (e) {
    console.warn('railTrees', e);
  }
  return n;
}
function treePick() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/010-fokus.js
  return ISO3.on
    ? null
    : (() => {
        if (!GEO.tmesh || !G.trees.visible) return null;
        const h = rc.intersectObject(GEO.tmesh, false)[0];
        return h && h.instanceId != null ? h : null;
      })();
}
function treeSel(i) {
  if (GEO.tselG) {
    sc.remove(GEO.tselG);
    GEO.tselG.geometry.dispose();
    GEO.tselG.material.dispose();
    GEO.tselG = null;
  }
  GEO.tsel = null;
  if (i == null || !GEO.trees || !GEO.trees[i]) return;
  const t = GEO.trees[i];
  GEO.tsel = t;
  const h = Math.max(1.5, t.h),
    m = new T.Mesh(
      new T.IcosahedronGeometry(1, 2),
      new T.MeshBasicMaterial({
        color: 0x5e7f92,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
  m.scale.set(Math.max(1, t.r) * 1.02, (h / 2) * 1.02, Math.max(1, t.r) * 1.02);
  m.position.set(t.x, gh(t.x, t.z) + h / 2, t.z);
  m.renderOrder = 7;
  sc.add(m);
  GEO.tselG = m;
}
function treeDel() {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js
  const t = GEO.tsel;
  if (t && t.u) {
    const i = UT.indexOf(t);
    if (i >= 0) UT.splice(i, 1);
  }
  return (() => {
    const t = GEO.tsel;
    if (!t || !GEO.trees) return;
    GEO.tdel = (GEO.tdel || []).concat([t]);
    treesBuild(GEO.trees.filter((x) => x !== t));
    H();
    rr();
  })();
}
function treeDelOn() {
  const p = S.par;
  if (!p || !GEO.trees) return;
  const rm = GEO.trees.filter((t) => inP([t.x, t.z], p.poly));
  if (!rm.length) return;
  GEO.tdel = (GEO.tdel || []).concat(rm);
  treesBuild(GEO.trees.filter((t) => !rm.includes(t)));
  H();
  rr();
}
function treeRestore() {
  if (!GEO.tdel || !GEO.tdel.length) return;
  const l = GEO.trees.concat(GEO.tdel);
  GEO.tdel = [];
  treesBuild(l);
  H();
  rr();
}
function treeInfo() {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js
  let h = (() => {
    const t = GEO.tsel,
      nd = GEO.tdel ? GEO.tdel.length : 0;
    let h = '';
    if (t)
      h += `<h4>Baum</h4><div class="card">${kv('Höhe', f1(t.h, 1) + ' m')}${kv('Kronendurchmesser', f1(t.r * 2, 1) + ' m')}${kv('Quelle', t.src === 'osm' ? 'OpenStreetMap' : t.src === 'kataster' ? 'Baumkataster' : t.src === 'gpkg' ? 'Baumdatei (GeoPackage)' : 'Kronenmodell DOM1−DGM1')}${t.sp ? kv('Art', esc(t.sp)) : ''}<button class="sm" style="margin-top:6px" onclick="treeDel()">Baum entfernen (Entf)</button></div>`;
    if (nd)
      h += `<div style="margin-top:6px;color:var(--mu)">${nd} Bäume entfernt <button class="sm" onclick="treeRestore()">Alle wiederherstellen</button></div>`;
    return h;
  })();
  const t = GEO.tsel;
  if (t && t.u) {
    h = h.replace(/Kronenmodell DOM1−DGM1/, 'Eigener Baum');
    h = h.replace(
      '<button class="sm"',
      kv('Stammhöhe', f1(t.sh, 1) + ' m') + kv('Stammdurchmesser', f1(t.sd, 2) + ' m') + '<button class="sm"',
    );
  }
  return h;
}
function ctxDel() {
  const b = GEO.sel;
  if (!b || !GEO.blist) return;
  GEO.blist = GEO.blist.filter((x) => x !== b);
  GEO.bdel.push(b);
  ctxBuild(GEO.blist.slice());
  rr();
}
function ctxOn(p) {
  return GEO.blist ? GEO.blist.filter((b) => inP(cen(b.o), p.poly)) : [];
}
function ctxDelOn() {
  const p = S.par;
  if (!p || !GEO.blist) return;
  const rm = ctxOn(p);
  if (!rm.length) return;
  GEO.blist = GEO.blist.filter((b) => !rm.includes(b));
  GEO.bdel.push(...rm);
  ctxBuild(GEO.blist.slice());
  rr();
}
function ctxRestore() {
  if (!GEO.bdel || !GEO.bdel.length) return;
  GEO.blist = GEO.blist.concat(GEO.bdel);
  GEO.bdel = [];
  ctxBuild(GEO.blist.slice());
  rr();
}
function ctxOnBtn(p) {
  const n = ctxOn(p).length,
    nt = GEO.trees ? GEO.trees.filter((t) => inP([t.x, t.z], p.poly)).length : 0;
  return (
    (n
      ? `<button class="sm" style="margin-top:6px" onclick="ctxDelOn()">${n} Bestandsgebäude auf dem Grundstück entfernen</button>`
      : '') +
    (nt
      ? `<button class="sm" style="margin-top:6px" onclick="treeDelOn()">${nt} Bäume auf dem Grundstück entfernen</button>`
      : '')
  );
}
function ctxInfo() {
  const b = GEO.sel,
    nd = GEO.bdel ? GEO.bdel.length : 0;
  let h = '';
  if (b) {
    const nr = Math.max(1, Math.round(b.h / 3));
    h += `<h4>Kontextgebäude</h4><div class="card">${kv('Höhe', f1(b.h, 1) + ' m' + (b.est ? ' (geschätzt)' : ''), b.est ? 'wa' : '')}${b.minh > 0 ? kv('Unterkante', f1(b.minh, 1) + ' m') : ''}${kv('Grundfläche', f1(area(b.o)) + ' m²')}${kv('Geschosse', nr + ' (geschätzt)', 'wa')}<button class="sm" style="margin-top:6px" onclick="ctxDel()">Gebäude entfernen (Entf)</button><div style="color:var(--mu);margin-top:4px">Quelle: OpenStreetMap über MapTiler</div></div>`;
  }
  if (nd)
    h += `<div style="margin-top:6px;color:var(--mu)">${nd} Gebäude entfernt <button class="sm" onclick="ctxRestore()">Alle wiederherstellen</button></div>`;
  return h;
}
function lvis(i, v) {
  LY[i][2] = v;
  const k = LY[i][1];
  if (S.geo && PK[k]) recomp();
  if ((!S.geo || !PK[k] || k === 'parcels' || k === 'bplan') && G[k]) gVis(k, v);
  labVis();
  // ── Erweiterung aus 16-darstellung-erweitert/050-darstellung-der-fanglinien-im-3d.js (danach)
  try {
    document.querySelectorAll('.zdtg[data-i="' + i + '"]').forEach((c) => {
      c.classList.toggle('on', !!v);
      c.setAttribute('aria-pressed', v ? 'true' : 'false');
      c.title = v ? 'Ebene ausblenden' : 'Ebene einblenden';
    });
    datCnt();
  } catch (e) {
    logErr(e, 'lvis');
  }

  // ── Erweiterung aus 17-erweiterungen-v253-v280/080-karten.js (danach)
  try {
    const k = LY[i][1];
    if (v && OVL[k]) {
      if (OVD[k] && OVD[k].st === 'err') delete OVD[k];
      ovLoad(k);
    }
  } catch (e) {
    logErr(e, 'lvis');
  }

  // ── Erweiterung aus 18-erweiterungen-v280-v325/040-gruenflaechen-aus-corine.js (danach)
  try {
    if (LY[i][1] === 'clg') {
      if (v) {
        if (OVD.clc && OVD.clc.st === 'err') delete OVD.clc;
        ovLoad('clc');
      }
      clgSig = '';
      if (S.geo) recomp();
      if (typeof FX !== 'undefined' && FX.grass && FX.flat) fxGrass();
      try {
        lyRender();
      } catch (e) {
        logErr(e, 'lvis');
      }
    }
  } catch (e) {
    console.error(e);
  }

  // ── Erweiterung aus 18-erweiterungen-v280-v325/120-tannen.js (danach)
  try {
    if (LY[i][1] === 'wld') {
      if (v) {
        if (OVD.clc && OVD.clc.st === 'err') delete OVD.clc;
        if (!OVD.clc) ovLoad('clc');
      }
      WLD.sig = '';
      try {
        lyRender();
      } catch (e) {
        logErr(e, 'lvis');
      }
    }
  } catch (e) {
    console.error(e);
  }

  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  try {
    if (LY[i][1] === 'bclc') {
      if (v) {
        if (OVD.clc && OVD.clc.st === 'err') delete OVD.clc;
        if (!OVD.clc) ovLoad('clc');
      }
      RFC.sig = '';
      BCL.sig = '';
    }
  } catch (e) {
    logErr(e, 'lvis');
  }

  // ── Erweiterung aus 24-erweiterungen-v344-v436/100-eigenschaften.js (danach)
  try {
    if (LY[i][1] === 'hnr') {
      G.hnr.visible = !!v;
      if (v) hnrLoad();
    }
  } catch (e) {
    console.error(e);
  }

  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js (danach)
  try {
    const k = LY[i] && LY[i][1];
    if (k === 'ugr' || k === 'ugk') {
      recomp();
      rr();
    }
  } catch (e) {
    logErr(e, 'lvis');
  }

  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js (danach)
  try {
    if (LY[i] && LY[i][1] === 'bkont') bkApply(true);
  } catch (e) {
    logErr(e, 'lvis');
  }
}
function lop(i, v) {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/040-gruenflaechen-aus-corine.js
  if (LY[i][1] === 'clg') {
    LY[i][3] = v;
    if (S.geo) recomp();
    return;
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/010-gruen-wasser.js
  if (LY[i] && LY[i][1] === 'trees') FX.opT = 1;
  return lopBasis.apply(this, arguments);
}
// lop() ohne die Erweiterungen darüber – wird von lop() gezielt aufgerufen
function lopBasis(i, v) {
  v = Math.max(0.05, Math.min(1, +v));
  LY[i][3] = v;
  op(LY[i][1], v);
}
function op(k, v) {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/010-gruen-wasser.js
  if (k === 'trees' && FX.tr) {
    fxTreeOp();
    return;
  }
  G[k].traverse((o) => {
    if (o.material) {
      o.material.transparent = true;
      o.material.opacity = v;
    }
  });
}
// Kamera
function cam() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/020-kamera.js
  camBasis();
  if (S.m3 && CAMX.on) {
    try {
      camxApply(pc, V, mid.clientWidth / mid.clientHeight);
    } catch (e) {
      logErr(e, 'cam');
    }
  }
}
// cam() ohne die Erweiterungen darüber – wird von cam() gezielt aufgerufen
function camBasis() {
  const w = mid.clientWidth,
    h = mid.clientHeight,
    a = w / h;
  ren.setSize(w, h);
  if (S.m3) {
    pc.aspect = a;
    pc.updateProjectionMatrix();
    pc.position.set(
      V.tx + V.d * Math.sin(V.pol) * Math.sin(V.az),
      V.d * Math.cos(V.pol),
      V.tz + V.d * Math.sin(V.pol) * Math.cos(V.az),
    );
    pc.lookAt(V.tx, 0, V.tz);
  } else {
    const hh = V.d * 0.6;
    Object.assign(oc, { left: -hh * a, right: hh * a, top: hh, bottom: -hh });
    oc.updateProjectionMatrix();
    oc.position.set(V.tx, 800, V.tz);
    oc.up.set(Math.sin(V.rot), 0, -Math.cos(V.rot));
    oc.lookAt(V.tx, 0, V.tz);
  }
}
function northTog() {
  if (S.m3 || camLocked()) return;
  if (Math.abs(V.rotT) > 1e-6) {
    V.rotT = 0;
    return;
  }
  const p =
    S.par ||
    P.find((q) => q.site) ||
    P.find((q) => inP([V.tx, V.tz], q.poly)) ||
    AL.find((a) => !a.cut && inP([V.tx, V.tz], a.poly));
  if (!p || !p.poly || p.poly.length < 3) {
    S.info = '';
    alert('Zum Ausrichten zuerst ein Grundstück auswählen.');
    return;
  }
  let bl = 0,
    ang = 0;
  const q = p.poly;
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    if (l > bl) {
      bl = l;
      ang = Math.atan2(dz, dx);
    }
  }
  while (ang > Math.PI / 2) ang -= Math.PI;
  while (ang <= -Math.PI / 2) ang += Math.PI;
  V.rotT = ang;
  const c = cen(q);
  V.tx = c[0];
  V.tz = c[1];
}
const act = () => (S.m3 ? pc : oc);
