/* ---------- Panel ---------- */
function impHtml() {
  const s = impSel(),
    row = (x) =>
      `<div class="lyr" style="gap:6px;align-items:center;${x.id === IMP.sel ? 'background:rgba(94,127,146,.14);border-radius:8px;' : ''}padding:3px 4px"><button class="sm" style="width:26px;padding:2px 0;opacity:${x.vis ? 1 : 0.4}" title="${x.vis ? 'Ausblenden' : 'Einblenden'}" onclick="IMF.vis(${x.id})">${x.vis ? '◉' : '○'}</button><span style="flex:1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="IMF.sel(${x.id})" title="${impEsc(x.name)}">${impEsc(x.name)}</span><small style="color:var(--mu)">${f1(x.w, 1)} × ${f1(x.h, 1)} m</small></div>`;
  let h = `<h4>Import</h4><div class="card"><input type="file" id="impFile" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" multiple style="display:none" onchange="impFiles(Array.from(this.files));this.value=''"><button class="pri" onclick="IMF.pick()">Datei wählen (JPG · PNG · PDF)</button><div class="dmu" style="margin-top:6px">Bilder und PDF-Seiten werden als Draufsicht auf das Gelände gelegt. Danach Breite eingeben oder den Maßstab am Plan messen.</div>${IMP.busy ? `<div style="margin-top:6px;color:#b4531f">${impEsc(IMP.busy)}</div>` : ''}</div>`;
  h +=
    `<h4>Importierte Pläne (${IMP.sh.length})</h4>` +
    (IMP.sh.length
      ? `<div class="card" style="padding:6px">${IMP.sh.map(row).join('')}</div>`
      : '<div style="color:var(--mu)">Noch nichts importiert.</div>');
  if (s) {
    const id = s.id,
      L = IMP.m.length === 2 ? Math.hypot(IMP.m[1][0] - IMP.m[0][0], IMP.m[1][1] - IMP.m[0][1]) : 0;
    h += `<h4>Plan bearbeiten</h4><div class="card">Name<input type="text" value="${impEsc(s.name)}" onchange="IMF.name(${id},this.value)">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px"><label>Breite (m)<input type="number" step="0.1" min="0.1" value="${+s.w.toFixed(2)}" onchange="IMF.w(${id},this.value,'w')"></label><label>Höhe (m)<input type="number" step="0.1" min="0.1" value="${+s.h.toFixed(2)}" onchange="IMF.w(${id},this.value,'h')"></label></div>
<label style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" ${s.lock ? 'checked' : ''} onchange="IMF.lock(${id},this.checked)">Seitenverhältnis sperren</label>
<label style="margin-top:6px;display:block">Drehung (°)<input type="number" step="0.5" value="${s.rot}" onchange="IMF.rot(${id},this.value)"></label>
<label style="margin-top:6px;display:block">Transparenz · Deckkraft <b id="impOpV">${Math.round(s.op * 100)} %</b><input type="range" min="0" max="100" value="${Math.round(s.op * 100)}" oninput="IMF.op(${id},+this.value)"></label>
<div class="dmu" style="margin-top:6px">1 Pixel = ${f1((s.w / s.pw) * 100, 1)} cm · Bild ${s.pw} × ${s.ph} px</div>
<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><button class="sm${IMP.mode === 'measure' ? ' on' : ''}" style="width:100%" onclick="IMF.mode('measure')">Maßstab messen</button><button class="sm${IMP.mode === 'move' ? ' on' : ''}" style="width:100%" onclick="IMF.mode('move')">Verschieben</button><button class="sm" style="width:100%" onclick="IMF.here(${id})" title="Auf die Bildschirmmitte setzen">Zur Ansicht</button><button class="sm" style="width:100%" onclick="IMF.del(${id})">Löschen</button></div>`;
    if (IMP.mode === 'measure')
      h += `<div class="dmu" style="margin-top:8px">${IMP.m.length < 2 ? 'Zwei Punkte auf dem Plan anklicken, deren Abstand bekannt ist (z. B. eine bemaßte Strecke).' : ''}</div>`;
    if (IMP.m.length === 2)
      h += `<div style="margin-top:6px;padding:8px;border:1px solid var(--ln);border-radius:8px">Gemessen im Plan: <b>${f1(L, 2)} m</b><br>Tatsächliche Länge (m)<input type="number" id="impLen" step="0.01" min="0.01" placeholder="z. B. 12,50" onkeydown="if(event.key==='Enter')IMF.apply(${id})"><button class="pri" style="margin-top:6px" onclick="IMF.apply(${id})">Maßstab übernehmen</button></div>`;
    h += '</div>';
  }
  return h;
}
function impRender() {
  const R = $('pc');
  if (!R) return;
  const a = document.activeElement;
  if (a && R.contains(a) && a.id === 'impLen') return;
  R.innerHTML = impHtml();
  R.dataset.imp = '1';
  IMP.dirty = false;
}
// rr(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js
// rebuildTerrain(): Erweiterung zusammengeführt, siehe 02-geodaten/010-kontextdaten.js
// projExtra(): Erweiterung zusammengeführt, siehe 14-projekt-speicherstand/010-projekt.js
// projApplyPre(): Erweiterung zusammengeführt, siehe 14-projekt-speicherstand/010-projekt.js
