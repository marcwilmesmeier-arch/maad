/* v303: gezeichnete Fläche als Grundstück übernehmen (wenn keine Flurstücke verfügbar sind) */
function siteMake(poly, why) {
  if (hasSite()) {
    gst('Es ist bereits ein Grundstück gewählt – zuerst löschen.');
    return null;
  }
  S.siteN++;
  const s = {
    id: 'G' + S.siteN,
    name: 'Grundstück ' + S.siteN,
    poly: poly.map((q) => q.slice()),
    site: true,
    fl: [],
  };
  P.push(s);
  S.par = s;
  S.parSel = new Set();
  try {
    parRefresh();
  } catch (e) {
    logErr(e, 'siteMake');
  }
  S.tab = 'Planen';
  nav();
  rr();
  gst('Grundstück angelegt: ' + s.name + ' (' + f1(area(s.poly)) + ' m²' + (why ? ', ' + why : '') + ').');
  return s;
}
function areaToSite(id) {
  if (hasSite()) {
    gst('Es ist bereits ein Grundstück gewählt – zuerst löschen.');
    alert('Es ist bereits ein Grundstück gewählt. Bitte zuerst das vorhandene Grundstück löschen.');
    return;
  }
  if (id) {
    const a = S.areas.find((q) => q.id === id);
    if (!a || !a.poly || a.poly.length < 3) return;
    const s = siteMake(a.poly, 'aus Fläche „' + a.name + '“');
    if (!s) return;
    S.areas = S.areas.filter((q) => q.id !== id);
    S.selA = null;
    S.multiA = (S.multiA || []).filter((q) => q.id !== id);
    try {
      areaSelDraw();
      areasApply();
    } catch (e) {
      logErr(e, 'areaToSite');
    }
    rr();
    return;
  }
  if (!S.closed || S.draft.length < 3) return;
  const poly = S.draft.map((q) => q.slice());
  cancel();
  siteMake(poly, 'gezeichnet');
  tool('v');
  rr();
}

/* v304: Zugang zur Demokarte auf der Startseite (Panel „Grundstück“: Demo öffnen / Demokarte aus Datei), nicht mehr unter „Projekt öffnen“ und im Neues-Projekt-Assistenten */
async function homeDemoOpen() {
  try {
    homeUndo();
    homeClose();
  } catch (e) {
    logErr(e, 'homeDemoOpen');
  }
  await demoOpen();
}
async function homeDemoFile(inp) {
  const p = demoFile(inp);
  try {
    homeUndo();
    homeClose();
  } catch (e) {
    logErr(e, 'homeDemoFile');
  }
  await p;
}
const homeDemoBtn = () =>
  S.demoOk
    ? `<button class="hbtn" onclick="homeDemoOpen()"><i>◎</i><span>Demo „${esc(S.demoLabel || 'Bielefeld')}“ öffnen<small>Beispielgrundstück – für alle offen</small></span></button>`
    : '';
const homeDemoFileBtn = () =>
  `<label class="hbtn ghost" style="margin-top:8px;cursor:pointer"><i>⇪</i><span>Demokarte aus Datei …</span><input type="file" accept=".lotdemo" style="display:none" onchange="homeDemoFile(this)"></label>`;
