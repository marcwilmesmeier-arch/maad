/* v505: Layer „Gebäudekontur“ (dünne Kantenlinien der Gebäude) – Ein/Aus und Farbe; übernimmt bisherige Werte (an, Farbe S.edgeC) */
{
  const i = LY.findIndex((l) => l[1] === 'buildings');
  if (!LY.some((l) => l[1] === 'bkont'))
    LY.splice(i < 0 ? LY.length : i + 1, 0, ['Gebäudekontur', 'bkont', 1, 1]);
  S.lc.bkont = S.edgeC || '#9b9b97';
}
const BK = { sig: '' };
function bkApply(force) {
  const L = LY.find((l) => l[1] === 'bkont');
  if (!L) return;
  const on = !!L[2],
    col = S.lc.bkont || '#9b9b97',
    sg = konSig() + '|' + on + col + S.noK + KON.g.visible;
  if (!force && sg === BK.sig) return;
  BK.sig = sg;
  S.edgeC = col;
  sc.traverse((o) => {
    if (!(o.isLineSegments && o.userData && o.userData.kont)) return;
    o.visible = on && !S.noK;
    const m = o.material;
    if (!m) return;
    o.userData._kc = new T.Color(col).getHex();
    if (!KON.g.visible) m.color.set(col);
  });
}
setInterval(() => {
  try {
    bkApply();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 350);
// kontUp(): Erweiterung zusammengeführt, siehe 06-darstellung/010-darstellung.js
// lcol(): Erweiterung zusammengeführt, siehe 01-modell-3d/030-wandflaechen.js
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// vwApplyDs(): Erweiterung zusammengeführt, siehe 15-grundriss/080-ansichten-speichern-auch-alle-anzeige.js
// lyMApply(): Erweiterung zusammengeführt, siehe 18-erweiterungen-v280-v325/030-layer.js
/* Layer-Panel: Zeile in die Gruppe „Gebäude & Dächer“, direkt unter „Gebäude“ (vor die Unter-Einstellungen) */
LYI.bkont = '<rect x="6" y="4" width="12" height="16" rx="1" stroke-width="2.6"/>';
{
  const g = LYG.find((x) => Array.isArray(x[1]) && x[1].includes('buildings'));
  if (g && !g[1].includes('bkont')) g[1].splice(g[1].indexOf('buildings') + 1, 0, 'bkont');
}
// lyRender(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js

LYAFTER.push(() => bkApply(true));
/* v512: Start-Standard – „Sonnenstand simulieren“ ist in der Darstellung „Schattiert“ beim Start und beim Laden eines Projekts eingeschaltet (danach frei abschaltbar) */
function sunDefault() {
  try {
    if (S.dar === 'sch' && !S.sun) {
      S.sun = true;
      const c = $('sunck');
      if (c) c.checked = true;
      try {
        $('bl').classList.add('sunon');
        $('sunc').style.display = 'block';
      } catch (e) {
        logErr(e, 'sunDefault');
      }
      sunUp();
      drUi();
    }
  } catch (e) {
    console.warn('sunDefault', e);
  }
}
// projApplySet(): Erweiterung zusammengeführt, siehe 14-projekt-speicherstand/010-projekt.js
// Aufruf beim Programmstart: start() in 29-start/010-start-projekt-oeffnen.js
