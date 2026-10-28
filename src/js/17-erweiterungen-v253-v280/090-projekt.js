/* v266: Projekt-/Standortkarte im Reiter „Planen“ (vorher oben in „Datenebenen“).
   Ort wird nur noch als Stadt · Kreis · Bundesland gezeigt (ohne Straße), dazu die Ausschnittsgröße.
   Stadt/Kreis/Bundesland kommen aus der MapTiler-Rückwärtssuche (je eine Anfrage pro Verwaltungsebene), werden je Standort in localStorage 'lot_ort' gemerkt. */
const ORTC = (() => {
    try {
      return JSON.parse(localStorage.getItem('lot_ort') || '{}');
    } catch (_) {
      return {};
    }
  })(),
  ORTB = {};
const ortKey = (p) =>
  p && p.lon != null && p.lat != null && isFinite(+p.lon) && isFinite(+p.lat)
    ? (+p.lon).toFixed(4) + ',' + (+p.lat).toFixed(4)
    : '';
const ortSave = () => {
  try {
    const k = Object.keys(ORTC);
    if (k.length > 40) k.slice(0, k.length - 40).forEach((x) => delete ORTC[x]);
    localStorage.setItem('lot_ort', JSON.stringify(ORTC));
  } catch (e) {
    logErr(e, 'ortSave');
  }
};
/* Notlösung ohne Abfrage: aus dem gespeicherten Adresstext (Straße, PLZ Ort, Bundesland, Deutschland) */
function ortParse(l) {
  const a = String(l || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && !/^(Deutschland|Germany)$/i.test(x))
    .map((x) => x.replace(/^\d{5}\s+/, ''));
  if (!a.length) return { stadt: '', kreis: '', land: '' };
  if (a.length === 1) return { stadt: a[0], kreis: '', land: '' };
  return { stadt: a.length > 2 ? a[a.length - 2] : a[0], kreis: '', land: a[a.length - 1] };
}
async function ortFetch(lon, lat) {
  const q = async (t) => {
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(
        'https://api.maptiler.com/geocoding/' +
          lon +
          ',' +
          lat +
          '.json?key=' +
          GEO.key +
          '&language=de&limit=1&types=' +
          t,
        { signal: ac.signal },
      );
      clearTimeout(to);
      if (!r.ok) return '';
      const j = await r.json(),
        f = (j.features || [])[0];
      return f ? f.text_de || f.text || f.place_name_de || f.place_name || '' : '';
    } catch (_) {
      return '';
    }
  };
  let [stadt, kreis, land] = await Promise.all([q('municipality'), q('county'), q('region')]);
  if (!stadt) stadt = await q('locality');
  return { stadt, kreis, land };
}
function ortGet(p) {
  const k = ortKey(p);
  if (!k) return null;
  const o = ORTC[k];
  if (!o && !ORTB[k] && GEO.key) {
    ORTB[k] = 1;
    ortFetch(+p.lon, +p.lat)
      .then((r) => {
        if (r && (r.stadt || r.kreis || r.land)) {
          ORTC[k] = r;
          ortSave();
          try {
            ortRefresh();
          } catch (e) {
            logErr(e, 'ortGet>anonym');
          }
        }
      })
      .catch(() => {});
  }
  return o || null;
}
function ortOf(p) {
  if (!p) return { stadt: '', kreis: '', land: '' };
  const o = ortGet(p) || ortParse(p.label);
  return { stadt: o.stadt || '', kreis: o.kreis || '', land: o.land || (S.geo && GEO.alkBL) || '' };
}
/* kurzer Text für die Kopfzeile: Stadt, Kreis, Bundesland */
function ortText(p) {
  if (!ortKey(p)) return p && p.label ? String(p.label) : '';
  const o = ortOf(p);
  return [o.stadt, o.kreis && o.kreis !== o.stadt ? o.kreis : '', o.land].filter(Boolean).join(', ');
}
function ortRows(p) {
  if (!p) return '';
  if (!ortKey(p)) return p.label ? kv('Ort', esc(p.label)) : '';
  const o = ortOf(p);
  return (
    (o.stadt ? kv('Stadt', esc(o.stadt)) : '') +
    (o.kreis ? kv('Kreis', o.kreis === o.stadt ? 'kreisfreie Stadt' : esc(o.kreis)) : '') +
    (o.land ? kv('Bundesland', esc(o.land)) : '')
  );
}
function ortRefresh() {
  const e = document.getElementById('pjort');
  if (e && S.project) e.innerHTML = ortRows(S.project);
  try {
    updPj();
  } catch (e) {
    logErr(e, 'ortRefresh');
  }
}
function geoPanel() {
  const p = S.project;
  return (
    '<h4>Projekt</h4><div class="card pjc">' +
    (p
      ? kv('Name', esc(p.name)) +
        '<div id="pjort">' +
        ortRows(p) +
        '</div>' +
        (p.size ? kv('Umgebung', f1(p.size) + ' × ' + f1(p.size) + ' m') : '')
      : '<div style="color:var(--mu)">Kein Projekt angelegt</div>') +
    '<button class="pri" onclick="wzOpen(true)">Neues Projekt / Standort wählen</button></div><div id="gs" style="color:var(--mu);margin-top:4px">' +
    esc(GEO.status || 'Demo-Daten aktiv.') +
    '</div>'
  );
}
function updPj() {
  const e = $('pj'),
    p = S.project;
  document.body.classList.toggle('hpj', !!p);
  if (!p) {
    e.style.display = 'none';
    return;
  }
  e.style.display = 'block';
  const t = ortText(p);
  e.innerHTML =
    '<b>' +
    esc(p.name) +
    '</b><span style="color:var(--mu)">' +
    (t ? ' · ' + esc(t) : '') +
    (p.size ? ' · ' + f1(p.size) + ' × ' + f1(p.size) + ' m' : '') +
    '</span>';
  document.title = p.name + ' – maad';
}

/* v270: Hinweis zu den Flurstücken, solange noch kein Grundstück angelegt ist (früher im Reiter „Datenebenen“) */
function parHint() {
  if (typeof hasSite === 'function' && hasSite()) return '';
  return (
    '<div style="color:var(--mu);font-size:11px;margin:8px 0 0">' +
    (AL.length
      ? AL.length +
        ' Flurstücke' +
        (GEO.alkBL ? ' · ' + esc(GEO.alkBL) : '') +
        ' · anklicken, mit Shift mehrere wählen' +
        (GEO.alkSrc ? '<br>' + esc(GEO.alkSrc) : '')
      : esc(
          GEO.alkMsg ||
            'Keine Flurstücke geladen (nach dem Laden einer Umgebung verfügbar, sofern das Bundesland einen freien Dienst anbietet).',
        )) +
    '</div>'
  );
}
