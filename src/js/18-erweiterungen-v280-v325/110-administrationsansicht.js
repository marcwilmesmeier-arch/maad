/* v311: Administrationsansicht – Voreinstellungen (Grafik, Metriken, Ansichten, Startansicht, Demokarte) für alle Anwender.
   Anwender sehen die Speichern-Knöpfe nicht mehr, behalten aber alle Farb- und Grafikregler im Projekt. */
const ADM = { cfg: null, msg: '', ro: false };
const admIs = () => !ACC || (ACC.mode === 'full' && ACC.user && ACC.user.role === 'admin');
const ADM_G = [
  ['ly', 'Layer: Sichtbarkeit und Transparenz', ['ly']],
  ['lc', 'Farben der Elemente', ['lc']],
  ['oc', 'Umrissfarbe', ['oc']],
  ['edgeC', 'Kantenfarbe', ['edgeC']],
  ['dar', 'Darstellungsart', ['dar']],
  ['lyM', 'Layer je Darstellung', ['lyM']],
  ['light', 'Licht und Sonne', ['light', 'sun']],
  ['sky', 'Himmel', ['sky']],
  ['kon', 'Konturlinien', ['kon']],
  ['hlc', 'Hervorhebung', ['hlc']],
  ['wire', 'Drahtgitter', ['wire']],
  ['aa', 'Kantenglättung', ['aa']],
  ['fx', 'Effekte', ['fx']],
  ['clg', 'Farbgrading', ['clg']],
];
const ADM_M = [
  ['lim', 'Grenzwerte (GRZ, GFZ …)', ['lim']],
  ['uses', 'Nutzungsfarben', ['uses']],
  ['abst', 'Abstandsflächen', ['abst']],
  ['num', 'Flächen- und Raumnummern', ['showSN', 'showFN']],
  ['mk', 'Maske', ['mkOn', 'mkA']],
];
const ADM_ALL = [].concat(...ADM_G.concat(ADM_M).map((i) => i[2]));
function admLoad() {
  let c = null;
  if (ACC && ACC.server) c = ACC.cfg;
  else {
    try {
      c = JSON.parse(localStorage.getItem('lotAdminCfg') || 'null');
    } catch (e) {
      logErr(e, 'admLoad');
    }
  }
  c = c && typeof c === 'object' ? c : {};
  c.gfx = c.gfx || {};
  c.met = c.met || {};
  c.modes = c.modes || {};
  c.views = Array.isArray(c.views) ? c.views : [];
  c.start = c.start || null;
  ADM.cfg = c;
}
admLoad();
function admCur(keys) {
  const x = projExtra(null),
    o = {};
  keys.forEach((k) => {
    if (x[k] !== undefined) o[k] = x[k];
  });
  return JSON.parse(JSON.stringify(o));
}
function admStartView() {
  const c = ADM.cfg;
  return (c.start && c.views.find((v) => v.id === c.start)) || null;
}
/* Voreinstellung für neue Projekte = einzeln veröffentlichte Werte, darüber die Startansicht */
function gfxDefGet() {
  const c = ADM.cfg;
  if (!c) return null;
  const o = { v: 2 };
  let n = 0;
  for (const id in c.gfx) {
    Object.assign(o, c.gfx[id]);
    n++;
  }
  for (const id in c.met) {
    Object.assign(o, c.met[id]);
    n++;
  }
  if (Object.keys(c.modes || {}).length) {
    const b = admCur(['lyM', 'kon', 'light', 'fx', 'sky', 'aa']);
    o.lyM = Object.assign({}, o.lyM || b.lyM);
    o.kon = Object.assign({}, o.kon || b.kon);
    o.fx = Object.assign({}, o.fx || b.fx);
    o.light = Object.assign({}, o.light || b.light);
    o.light.lt = Object.assign({}, o.light.lt || (b.light && b.light.lt) || {});
    for (const m in c.modes) {
      const d = c.modes[m];
      if (d.lyM) o.lyM[m] = d.lyM;
      if (d.kon) o.kon[m] = d.kon;
      if (d.fx) o.fx[m] = d.fx;
      if (d.lt) o.light.lt[m] = d.lt;
      if (d.sky) o.sky = d.sky;
      if (d.aa != null) o.aa = d.aa;
      if (d.rb != null) o.rb = d.rb;
    }
    n++;
  }
  const sv = admStartView();
  if (sv) {
    Object.assign(o, sv.x);
    n++;
  }
  return n ? o : null;
}
function admApply(part) {
  const base = admCur(ADM_ALL),
    x = Object.assign(base, JSON.parse(JSON.stringify(part)));
  delete x.cam;
  if (x.lc) {
    const ch = Object.keys(x.lc).filter((k) => S.lc[k] !== x.lc[k]);
    Object.assign(S.lc, lcMig(x.lc));
    if (ch.length) lcApplyAll(ch);
  }
  if (x.oc) {
    S.oc = x.oc;
    ocApply();
  }
  if (x.edgeC) S.edgeC = x.edgeC;
  projApplySet(x);
  try {
    if ($('lyp').style.display === 'block') lyRender();
  } catch (e) {
    logErr(e, 'admApply');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js (danach)
  try {
    lyAfterRun();
  } catch (e) {
    logErr(e, 'admApply');
  }
}
function gfxDefApply(quiet) {
  const o = gfxDefGet();
  if (!o) {
    if (!quiet) admMsg('Keine Voreinstellung vorhanden.');
    return false;
  }
  try {
    admApply(o);
    {
      const dm = ADM.cfg.modes && ADM.cfg.modes[S.dar];
      if (dm && dm.lyM) lyMApply(dm.lyM);
    }
    const sv = admStartView(),
      c = sv && sv.x.cam;
    if (c) {
      if (c.m3 === false) {
        setMode(0, 1);
      } else if (c.m3) {
        if (c.az != null) V.az = c.az;
        if (c.pol != null) V.pol = c.pol;
      }
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
async function admSave() {
  const c = ADM.cfg;
  c.v = 1;
  try {
    if (ACC && ACC.server) {
      const r = await fetch('/api/admin/cfg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Maad': '1' },
        body: JSON.stringify({ cfg: c }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Fehler ' + r.status);
      ACC.cfg = JSON.parse(JSON.stringify(c));
      admMsg('Gespeichert – gilt für alle Anwender bei neuen Projekten.');
    } else {
      localStorage.setItem('lotAdminCfg', JSON.stringify(c));
      admMsg('Gespeichert (nur in diesem Browser, kein Server angebunden).');
    }
  } catch (e) {
    admMsg('Speichern nicht möglich: ' + (e.message || e));
  }
  admRender();
}
function admMsg(t) {
  ADM.msg = t;
  const e = $('admm');
  if (e) e.textContent = t;
}
function admModeCap(m) {
  lyMSave();
  const e = S.lyM[m];
  if (!e) return null;
  const d = { lyM: JSON.parse(JSON.stringify(e)) };
  if (m === 'wm' || m === 'sch') {
    d.lt = JSON.parse(JSON.stringify(S.lt[m]));
    d.kon = JSON.parse(JSON.stringify(S.kon[m]));
  }
  if (m === 'sch' || m === 'real') d.fx = JSON.parse(JSON.stringify(S.fx[m]));
  if (m === 'real') {
    d.sky = JSON.parse(JSON.stringify(S.sky));
    d.aa = S.aa;
    d.rb = S.rb;
  }
  return d;
}
function admModePub(m) {
  if (S.dar !== m) {
    admMsg(
      'Bitte zuerst die Darstellung „' +
        (DAR.find((d) => d[0] === m) || [0, m])[1] +
        '“ aufrufen und einstellen.',
    );
    return;
  }
  const d = admModeCap(m);
  if (!d) {
    admMsg('Keine Daten für diese Darstellung.');
    return;
  }
  ADM.cfg.modes[m] = d;
  admSave();
}
function admModeDel(m) {
  delete ADM.cfg.modes[m];
  admSave();
}
function admModeRows() {
  return DAR.map((d) => {
    const m = d[0],
      on = !!ADM.cfg.modes[m],
      cur = S.dar === m;
    return `<div class="lyr" style="gap:6px"><span style="width:14px;color:${on ? 'var(--pa4,#5E7F92)' : 'var(--mu)'}" title="${on ? 'veröffentlicht' : 'nicht veröffentlicht'}">${on ? '●' : '○'}</span><span style="flex:1;font-size:12px">${esc(d[1])}${cur ? ' <b style="color:var(--pa4,#5E7F92)">· aktiv</b>' : ''}</span><button type="button" class="sm" ${cur ? 'disabled' : ''} onclick="drSet('${m}');admRender()" title="Diese Darstellung im Projekt einstellen">Wechseln</button><button type="button" class="sm" ${cur ? '' : 'disabled'} onclick="admModePub('${m}')" title="Aktuelle Einstellungen dieser Darstellung für alle übernehmen">Übernehmen</button><button type="button" class="sm" ${on ? '' : 'disabled'} onclick="admModeDel('${m}')" title="Veröffentlichung zurücknehmen">✕</button></div>`;
  }).join('');
}
function admPub(grp, id) {
  const L = (grp === 'g' ? ADM_G : ADM_M).find((i) => i[0] === id);
  if (!L) return;
  ADM.cfg[grp === 'g' ? 'gfx' : 'met'][id] = admCur(L[2]);
  admSave();
}
function admDel(grp, id) {
  delete ADM.cfg[grp === 'g' ? 'gfx' : 'met'][id];
  admSave();
}
function admPubAll(grp) {
  const L = grp === 'g' ? ADM_G : ADM_M,
    t = ADM.cfg[grp === 'g' ? 'gfx' : 'met'];
  L.forEach((i) => (t[i[0]] = admCur(i[2])));
  admSave();
}
function admDelAll(grp) {
  ADM.cfg[grp === 'g' ? 'gfx' : 'met'] = {};
  admSave();
}
function admViewAdd() {
  const n = ($('admvn').value || '').trim();
  if (!n) {
    admMsg('Bitte einen Namen eingeben.');
    return;
  }
  const x = admCur(ADM_ALL);
  x.cam = { m3: !!S.m3, az: V.az, pol: V.pol };
  const id = 'v' + Date.now().toString(36);
  ADM.cfg.views.push({ id, name: n, x });
  admSave();
}
function admViewStart(id) {
  ADM.cfg.start = id || null;
  admSave();
}
function admViewDel(id) {
  const c = ADM.cfg;
  c.views = c.views.filter((v) => v.id !== id);
  if (c.start === id) c.start = null;
  admSave();
}
function admViewGo(id) {
  const v = ADM.cfg.views.find((q) => q.id === id);
  if (!v) return;
  try {
    admApply(v.x);
    const c = v.x.cam;
    if (c) {
      if (c.m3 === false) setMode(0, 1);
      else {
        if (c.az != null) V.az = c.az;
        if (c.pol != null) V.pol = c.pol;
      }
    }
    admMsg('Ansicht „' + v.name + '“ angewendet.');
  } catch (e) {
    admMsg('Anwenden nicht möglich: ' + e.message);
  }
}
function admExport() {
  const b = new Blob([JSON.stringify(ADM.cfg, null, 1)], { type: 'application/json' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'maad_voreinstellungen.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
function admImport(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  f.text()
    .then((t) => {
      const c = JSON.parse(t);
      if (!c || typeof c !== 'object') throw 0;
      ADM.cfg = c;
      admLoadFix();
      return admSave();
    })
    .catch(() => admMsg('Datei konnte nicht gelesen werden.'))
    .finally(() => {
      inp.value = '';
    });
}
function admLoadFix() {
  const c = ADM.cfg;
  c.modes = c.modes || {};
  c.gfx = c.gfx || {};
  c.met = c.met || {};
  c.views = Array.isArray(c.views) ? c.views : [];
  c.start = c.start || null;
}
function admRows(grp, L) {
  const t = ADM.cfg[grp === 'g' ? 'gfx' : 'met'];
  return L.map((i) => {
    const on = !!t[i[0]];
    return `<div class="lyr" style="gap:6px"><span style="width:14px;color:${on ? 'var(--pa4,#5E7F92)' : 'var(--mu)'}" title="${on ? 'veröffentlicht' : 'nicht veröffentlicht'}">${on ? '●' : '○'}</span><span style="flex:1;font-size:12px">${esc(i[1])}</span><button type="button" class="sm" onclick="admPub('${grp}','${i[0]}')" title="Aktuellen Stand dieses Projekts für alle übernehmen">Übernehmen</button><button type="button" class="sm" ${on ? '' : 'disabled'} onclick="admDel('${grp}','${i[0]}')" title="Veröffentlichung zurücknehmen">✕</button></div>`;
  }).join('');
}
function admRender() {
  const el = $('admp');
  if (!el) return;
  const c = ADM.cfg,
    srv = ACC && ACC.server;
  const vs =
    c.views
      .map(
        (v) =>
          `<div class="lyr" style="gap:6px"><input type="radio" name="admst" ${c.start === v.id ? 'checked' : ''} onclick="admViewStart('${v.id}')" title="Als Startansicht festlegen" style="width:auto"><span style="flex:1;font-size:12px">${esc(v.name)}${c.start === v.id ? ' <b style="color:var(--pa4,#5E7F92)">· Startansicht</b>' : ''}</span><button type="button" class="sm" onclick="admViewGo('${v.id}')">Anwenden</button><button type="button" class="sm" onclick="admViewDel('${v.id}')">✕</button></div>`,
      )
      .join('') || '<div class="dmu">Noch keine Ansicht gespeichert.</div>';
  const can = GEO.snap && S.geo;
  el.innerHTML = `<button type="button" class="lyx" onclick="admClose()" title="Schließen">✕</button><h4 style="margin:2px 0 4px">Administration</h4><div class="dmu" style="margin-bottom:8px">Voreinstellungen für <b>alle Anwender</b> bei neuen Projekten. Gespeichert ${srv ? 'auf dem Server' : 'in diesem Browser'}. Anwender können Farben und Grafik im Projekt weiter frei einstellen; bestehende Projekte behalten ihre eigenen Werte.</div>
<div class="lyg"><h4>Darstellungen</h4><div class="dmu" style="margin-bottom:6px">Je Darstellung (Weißmodell, Schattiert, Realistisch): Layer, Farben, Licht, Konturen und Effekte. Erst „Wechseln“, im Projekt einstellen, dann „Übernehmen“. Gilt in neuen Projekten (Projektvorlage).</div>${admModeRows()}</div>
<div class="lyg"><h4>Grafik</h4>${admRows('g', ADM_G)}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button type="button" class="sm" onclick="admPubAll('g')">Alle übernehmen</button><button type="button" class="sm" onclick="admDelAll('g')">Alle zurücknehmen</button></div></div>
<div class="lyg"><h4>Metriken</h4>${admRows('m', ADM_M)}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button type="button" class="sm" onclick="admPubAll('m')">Alle übernehmen</button><button type="button" class="sm" onclick="admDelAll('m')">Alle zurücknehmen</button></div></div>
<div class="lyg"><h4>Ansichten und Startansicht</h4><div style="display:flex;gap:6px;margin-bottom:6px"><input id="admvn" type="text" placeholder="Name der Ansicht" style="flex:1" onkeydown="if(event.key==='Enter')admViewAdd()"><button type="button" class="sm" onclick="admViewAdd()">Aktuelle speichern</button></div>${vs}<div class="lyr" style="gap:6px"><input type="radio" name="admst" ${c.start ? '' : 'checked'} onclick="admViewStart(null)" style="width:auto"><span style="flex:1;font-size:12px">keine Startansicht</span></div><div class="dmu">Eine Ansicht enthält alle Grafik- und Metrik-Einstellungen sowie Darstellung und Blickwinkel. Die Startansicht gilt für jedes neue Projekt.</div></div>
<div class="lyg"><h4>Demokarte</h4><button type="button" class="sm" style="width:100%" ${can ? '' : 'disabled'} onclick="demoSave()" title="Speichert den geladenen Ausschnitt (Gebäude, Gelände, Flurstücke, Bäume) als Demokarte">Ausschnitt als Demokarte sichern</button>${can ? '' : '<div class="dmu" style="margin-top:4px">Erst ein Projekt mit Kartendaten öffnen.</div>'}</div>
<div class="lyg"><h4>Sicherung</h4><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="sm" onclick="admExport()">Voreinstellungen exportieren</button><label class="sm" style="cursor:pointer">Importieren …<input type="file" accept=".json" style="display:none" onchange="admImport(this)"></label></div></div>
<div id="admm" role="status" style="font-size:11px;margin-top:8px;min-height:14px">${esc(ADM.msg)}</div>`;
}
function admOpen() {
  const p = $('admp');
  if (!p || !admIs()) return;
  admRender();
  p.style.display = 'block';
  const b = $('badm');
  if (b) b.classList.add('on');
}
function admClose() {
  const p = $('admp');
  if (p) p.style.display = 'none';
  const b = $('badm');
  if (b) b.classList.remove('on');
}
function admToggle() {
  const p = $('admp');
  if (p && p.style.display === 'block') admClose();
  else admOpen();
}
function admLyBlock() {
  return admIs()
    ? `<div class="dmu" style="margin-bottom:6px"><b>Voreinstellungen</b><br>Grafik für alle Anwender festlegen:<div style="margin-top:5px"><button type="button" class="sm" onclick="admOpen()">Administration öffnen</button></div></div>`
    : '';
}
{
  const st = document.createElement('style');
  st.textContent =
    '#admp{position:fixed!important;left:0;right:0;top:0;bottom:0;margin:auto!important;width:380px;height:fit-content;max-height:calc(100vh - 90px);overflow:auto;display:none;z-index:95;padding:8px 14px 12px;box-shadow:0 18px 60px #0004}#admp .lyx{position:sticky;top:-6px;float:right;z-index:2;width:28px;height:28px;border:1px solid var(--ln);border-radius:9px;background:var(--pn,#fff);cursor:pointer;font-size:14px;line-height:1}#admp .lyg{margin:0 0 8px}#admp .lyg>h4{margin:12px 0 6px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--mu,#777)}#admp .lyr{display:flex;align-items:center;gap:8px;margin-bottom:5px}#admp input[type=text]{height:30px;border:1px solid var(--ln);border-radius:8px;padding:0 8px;font:inherit;background:var(--pn,#fff)}#admp .sm:disabled{opacity:.45;cursor:default}';
  document.head.appendChild(st);
  const d = document.createElement('div');
  d.id = 'admp';
  d.className = 'fl';
  document.body.appendChild(d);
}
// nav(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js
try {
  nav();
} catch (e) {
  logErr(e, 'init');
}
// drSet(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
/* Startseite: Darstellung mit ihren veröffentlichten Standardeinstellungen anwenden */
function admModeApply(m) {
  const d = ADM.cfg.modes[m];
  if (!d) {
    drSet(m);
    return;
  }
  const b = admCur(['lyM', 'kon', 'light', 'fx', 'sky', 'aa']);
  const x = {
    dar: m,
    lyM: Object.assign({}, b.lyM),
    kon: Object.assign({}, b.kon),
    fx: Object.assign({}, b.fx),
    light: Object.assign({}, b.light),
    sky: d.sky || b.sky,
    aa: d.aa != null ? d.aa : b.aa,
    rb: d.rb != null ? d.rb : b.rb,
  };
  x.light.lt = Object.assign({}, (b.light && b.light.lt) || {});
  if (d.lyM) x.lyM[m] = d.lyM;
  if (d.kon) x.kon[m] = d.kon;
  if (d.fx) x.fx[m] = d.fx;
  if (d.lt) x.light.lt[m] = d.lt;
  admApply(x);
  drSet(m);
  if (d.lyM) lyMApply(d.lyM);
}
try {
  if (typeof HOME !== 'undefined' && HOME.open) homePreset();
} catch (e) {
  console.error(e);
}
