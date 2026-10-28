// ---- Konfigurations-Dialog (Aufbau wie das Layout-Modul)
function xlOpen() {
  if (!XL.cols.sum) xlInit();
  let el = $('xl');
  if (!el) {
    el = document.createElement('div');
    el.id = 'xl';
    document.body.appendChild(el);
    const st = document.createElement('style');
    st.textContent =
      '#xl{position:fixed;inset:0;z-index:210;display:none;flex-direction:column;background:#e4e3df;color:var(--tx);font:13px system-ui,sans-serif}#xlTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:var(--pn);border-bottom:1px solid var(--ln)}#xlTop select,#xlTop button,#xlTop input{font:inherit}#xlTop .pri{width:auto;margin:0;padding:6px 14px}#xlBody{flex:1;display:flex;min-height:0;gap:0}#xlL{width:300px;background:var(--pn);border-right:1px solid var(--ln);padding:10px 12px;overflow:auto;box-sizing:border-box}#xlR{flex:1;background:var(--pn);padding:10px 16px;overflow:auto}#xl h4{margin:10px 0 6px}#xl .xr{display:flex;align-items:center;gap:8px;margin:3px 0;padding:3px 6px;border-radius:6px}#xl .xr.on{background:#5E7F9222;outline:1px solid #5E7F9266}#xl .xr input[type=text]{flex:1;min-width:0}#xl .xr small{color:var(--mu);white-space:nowrap}#xl .xn{color:var(--mu);font-size:11px;margin:6px 0}@media(max-width:820px){#xlBody{flex-direction:column}#xlL{width:auto;max-height:45%}}';
    document.head.appendChild(st);
  }
  el.innerHTML =
    '<div id="xlTop"><b>Excel-Export</b><select id="xlScope" onchange="xlPut(\'scope\',this.value)" title="Umfang"><option value="total">Gesamt</option><option value="each">Je Gebäude</option><option value="both">Je Gebäude + Gesamt</option></select><span style="flex:1"></span><button class="pri" id="xlGo" onclick="xlExport()">Excel exportieren</button><button class="sm" onclick="xlClose()">Schließen</button></div><div id="xlBody"><div id="xlL"></div><div id="xlR"></div></div>';
  el.style.display = 'flex';
  $('xlScope').value = XL.scope;
  xlRender();
}
function xlClose() {
  const e = $('xl');
  if (e) e.style.display = 'none';
}
function xlPut(k, v) {
  XL[k] = v;
  xlSave0();
  if (k === 'scope') return;
  xlRender();
}
function xlRender() {
  const bl = S.bld.filter((b) => !b.ex);
  let h =
    '<h4>Tabellenblätter</h4>' +
    XLS.map(
      ([k, n]) =>
        `<div class="xr ${XL.sel === k ? 'on' : ''}" onclick="xlSelS('${k}')"><input type="checkbox" ${XL.sh[k] ? 'checked' : ''} onclick="event.stopPropagation()" onchange="XL.sh['${k}']=this.checked?1:0;xlSave0()"><input type="text" value="${esc(XL.shn[k] || n)}" title="Name des Tabellenblatts" onclick="event.stopPropagation()" onchange="XL.shn['${k}']=this.value.trim();xlSave0()"></div>`,
    ).join('') +
    '<div class="xn">Blatt anklicken, um rechts die Spalten und Überschriften festzulegen.</div>';
  h +=
    '<h4>Gebäude</h4>' +
    (bl.length
      ? bl
          .map(
            (b) =>
              `<div class="xr"><input type="checkbox" ${XL.off.includes(b.id) ? '' : 'checked'} onchange="xlBld('${b.id}',this.checked)"><span style="flex:1">${esc(b.name || b.id)}</span></div>`,
          )
          .join('')
      : '<div class="xn">Noch kein Gebäude.</div>');
  h += `<h4>Optionen</h4><div class="xr"><span style="flex:1">Projekttitel</span><input type="text" style="max-width:150px" value="${esc(XL.title)}" placeholder="${esc((S.project && S.project.name) || 'maad')}" onchange="XL.title=this.value.trim();xlSave0()"></div><div class="xr"><input type="checkbox" ${XL.img ? 'checked' : ''} onchange="XL.img=this.checked?1:0;xlSave0()"><span style="flex:1">Bemaßte Zeichnungen einbetten (Abwicklung, Grundrisse, Dach, Terrassen, Lageplan)</span></div><div class="xr"><span style="flex:1">Öffnungsanteil Standard (%)</span><input type="number" min="0" max="90" step="1" style="width:64px" value="${XL.opd}" onchange="XL.opd=Math.max(0,Math.min(90,+this.value||0));xlSave0()"></div>`;
  $('xlL').innerHTML = h;
  const k = XL.sel,
    n = (XLS.find((x) => x[0] === k) || [0, ''])[1];
  let r = `<h4 style="margin-top:2px">Spalten – ${esc(XL.shn[k] || n)}</h4><div style="display:flex;gap:6px;margin-bottom:6px"><button class="sm" onclick="xlAll(1)">Alle</button><button class="sm" onclick="xlAll(0)">Keine</button><button class="sm" onclick="xlReset()">Überschriften zurücksetzen</button></div>`;
  r += XL.cols[k]
    .map(
      (c, i) =>
        `<div class="xr"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="XL.cols['${k}'][${i}].on=this.checked?1:0;xlSave0()"><input type="text" value="${esc(xlLab(c))}" title="Überschrift in der Excel-Tabelle" onchange="XL.cols['${k}'][${i}].l=this.value.trim()===xlDef(XL.cols['${k}'][${i}])?'':this.value.trim();xlSave0()"><small>${c.t === 't' ? 'Text' : 'Zahl'}${c.inp ? ' · Eingabe' : ''}</small></div>`,
    )
    .join('');
  r += `<div class="xn">${XLH[k] || ''}</div>`;
  $('xlR').innerHTML = r;
}
function xlSelS(k) {
  XL.sel = k;
  xlSave0();
  xlRender();
}
function xlBld(id, on) {
  XL.off = XL.off.filter((x) => x !== id);
  if (!on) XL.off.push(id);
  xlSave0();
}
function xlAll(on) {
  XL.cols[XL.sel].forEach((c) => (c.on = on));
  xlSave0();
  xlRender();
}
function xlReset() {
  XL.cols[XL.sel].forEach((c) => (c.l = ''));
  xlSave0();
  xlRender();
}
function areaForm() {
  const a = area(S.draft);
  return `<h4>Neue Fläche</h4><div class="card">${kv('Fläche', f1(a) + ' m²')}Name<input id="an" type="text" value="Fläche ${S.areaN + 1}">Art<select id="at" style="width:100%">${Object.entries(
    AT,
  )
    .filter(([k]) => k !== 'road')
    .map(([k, v]) => `<option value="${k}">${v.n}</option>`)
    .join(
      '',
    )}</select><button class="pri" onclick="areaMk()">Fläche erzeugen</button>${hasSite() ? '' : `<button class="sm" style="margin-top:6px" onclick="areaToSite()" title="Gezeichnete Fläche als Grundstück verwenden (wenn keine Flurstücke verfügbar sind)">Als Grundstück erzeugen</button>`}<button class="sm" style="margin-top:6px" onclick="cancel();rr()">Verwerfen</button></div>`;
}
function areaMk() {
  if (!S.closed || S.draft.length < 3) return;
  const a = {
    id: 'A' + ++S.areaN,
    name: ($('an').value || '').trim() || 'Fläche ' + S.areaN,
    type: $('at').value,
    poly: S.draft.map((q) => q.slice()),
  };
  S.areas.push(a);
  cancel();
  S.selA = a;
  areaSelDraw();
  areasApply();
  tool('v');
  rr();
  gst(a.name + ' erzeugt (' + f1(area(a.poly)) + ' m²).');
}
function areaDel(id) {
  S.areas = S.areas.filter((a) => a.id !== id);
  if (S.selA && S.selA.id === id) S.selA = null;
  areaSelDraw();
  areasApply();
  rr();
}
function areaSet(k, v) {
  if (!S.selA) return;
  S.selA[k] = v;
  if (k === 'type') areasApply();
  rr();
}
function areaCard() {
  const a = S.selA;
  if (!a) return '';
  if (a.type === 'road') return roadCard(a);
  return `<h4>Fläche</h4><div class="card">Name<input type="text" value="${esc(a.name)}" onchange="S.selA.name=this.value">Art<select style="width:100%" onchange="areaSet('type',this.value)">${Object.entries(
    AT,
  )
    .filter(([k]) => k !== 'road')
    .map(([k, v]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${v.n}</option>`)
    .join(
      '',
    )}</select>${kv('Fläche', f1(area(a.poly)) + ' m²')}<div style="color:var(--mu);font-size:11px;margin-top:4px">Kontur: weiße Punkte ziehen · blauen Mittelpunkt ziehen = neuer Punkt · Doppelklick auf einen Punkt = löschen.</div>${hasSite() ? '' : `<button class="sm" style="margin-top:6px" onclick="areaToSite('${a.id}')" title="Diese Fläche als Grundstück verwenden (wenn keine Flurstücke verfügbar sind)">Als Grundstück übernehmen</button> `}<button class="sm" style="margin-top:6px" onclick="areaDel('${a.id}')">Fläche löschen</button></div>`;
}
function multiCard() {
  const nb = (S.multi || []).length,
    na = (S.multiA || []).length;
  if (nb + na < 2) return '';
  return `<h4>Auswahl</h4><div class="card">${kv('Gebäude', nb)}${kv('Flächen', na)}${nb ? kv('BGF gesamt', f1(S.multi.reduce((t, b) => t + bgfOf(b), 0)) + ' m²') : ''}<button class="sm" style="margin-top:6px" onclick="multiDel()">Auswahl löschen</button> <button class="sm" onclick="S.multi=[];S.multiA=[];areaSelDraw();H();rr()">Aufheben</button></div>`;
}
function multiDel() {
  const bs = S.multi || [],
    as = S.multiA || [];
  if (!bs.length && !as.length) return;
  if (bs.length) hist();
  bs.forEach((b) => {
    if (b._g && b._g.parent) b._g.parent.remove(b._g);
  });
  S.bld = S.bld.filter((x) => !bs.includes(x));
  S.areas = S.areas.filter((a) => !as.includes(a));
  S.multi = [];
  S.multiA = [];
  S.sel = null;
  S.selA = null;
  areaSelDraw();
  if (as.length) areasApply();
  H();
  hpos();
  drawOv();
  rr();
}
let mqEl = null;
function mqDraw(x0, y0, x1, y1) {
  if (!mqEl) {
    mqEl = document.createElement('div');
    mqEl.style.cssText =
      'position:fixed;border:1.5px solid #5E7F92;background:rgba(94,127,146,.08);border-radius:3px;pointer-events:none;z-index:30';
    document.body.appendChild(mqEl);
  }
  Object.assign(mqEl.style, {
    display: 'block',
    left: Math.min(x0, x1) + 'px',
    top: Math.min(y0, y1) + 'px',
    width: Math.abs(x1 - x0) + 'px',
    height: Math.abs(y1 - y0) + 'px',
  });
}
function mqEnd(d, e) {
  if (mqEl) mqEl.style.display = 'none';
  const r = cv.getBoundingClientRect(),
    x0 = Math.min(d.x, e.clientX),
    x1 = Math.max(d.x, e.clientX),
    y0 = Math.min(d.y, e.clientY),
    y1 = Math.max(d.y, e.clientY),
    cm = act();
  cm.updateMatrixWorld();
  const inB = (c) => {
    const v = new T.Vector3(c[0], gh(c[0], c[1]) + 4, c[1]).project(cm);
    if (v.z > 1) return false;
    const px = r.left + ((v.x + 1) / 2) * r.width,
      py = r.top + ((1 - v.y) / 2) * r.height;
    return px >= x0 && px <= x1 && py >= y0 && py <= y1;
  };
  const add = e.shiftKey || e.ctrlKey || e.metaKey,
    bs = S.bld.filter((b) => !b.ex && b.fp && inB(cen(b.fp))),
    as = S.areas.filter((a) => inB(cen(a.poly)));
  S.multi = add ? [...new Set([...(S.multi || []), ...bs])] : bs;
  S.multiA = add ? [...new Set([...(S.multiA || []), ...as])] : as;
  S.selA = null;
  S.selF = null;
  S.par = null;
  S.sel = S.multi.length === 1 && !S.multiA.length ? S.multi[0] : null;
  if (S.multi.length + S.multiA.length === 1 && S.multiA.length) {
    S.selA = S.multiA[0];
    S.multiA = [];
  }
  areaSelDraw();
  H();
  hpos();
  S.tab = 'Planen';
  nav();
  rr();
  gst(
    S.multi.length + S.multiA.length + (S.selA ? 1 : 0)
      ? 'Gewählt: ' + S.multi.length + ' Gebäude, ' + (S.multiA.length + (S.selA ? 1 : 0)) + ' Flächen.'
      : 'Nichts im Auswahlkasten.',
  );
}
