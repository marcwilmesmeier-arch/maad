// ---- Start & Projekt öffnen: ohne Ruckeln / Zwischenzustände (v403)
(function () {
  const st = document.createElement('style');
  st.textContent =
    '#mid>canvas{transition:opacity .45s ease}body.cur #mid>canvas{opacity:0;transition:none}body.home #r,body.home #rph,body.home #tbar,body.home #pc{display:none!important}';
  document.head.appendChild(st);
})();
var _curT = 0;
function bootCur(on) {
  clearTimeout(_curT);
  if (on) {
    document.body.classList.add('cur');
    return;
  }
  // erst nach zwei gezeichneten Frames einblenden, damit nie ein Zwischenzustand sichtbar wird
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      _curT = setTimeout(() => document.body.classList.remove('cur'), 60);
    }),
  );
}
// gespeicerte Ansicht direkt beim Tausch des Geländes setzen (kein Zoom zur Mitte)
function bootKeep(x) {
  try {
    const v = x.view;
    V.tx = v.tx;
    V.tz = v.tz;
    V.d = v.d;
    if (v.az != null) V.az = v.az;
    if (v.pol != null) V.pol = v.pol;
    V.rot = V.rotT = v.rot != null ? v.rot : 0;
    S.vanim = null;
  } catch (e) {
    V.tx = V.tz = 0;
    V.rot = V.rotT = 0;
  }
}
// homeSetup(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js
// homeClose(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js

// recomp(): Erweiterung zusammengeführt, siehe 02-geodaten/020-flurkarte-als-bild.js
/* Planen-Menü nach Start / Projekt öffnen / neues Projekt eingeklappt */
/* Planen-Panel: nach Start/Öffnen/Neu eingeklappt, ohne Animation; automatische Aufklapp-Versuche (go/nav) werden 2 s lang zurückgenommen, ein Klick des Nutzers beendet das */
document.body.classList.add('rpShut');
{
  const st = document.createElement('style');
  st.textContent =
    'body.rpNoAnim #pc,body.rpNoAnim #rph,body.rpNoAnim #r{transition:none!important;animation:none!important}';
  document.head.appendChild(st);
}
const RPG = { until: 0 };
new MutationObserver(() => {
  const b = document.body;
  if (Date.now() < RPG.until && !b.classList.contains('rpShut')) b.classList.add('rpShut');
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener(
  'pointerdown',
  (e) => {
    if (Date.now() < RPG.until && e.isTrusted) RPG.until = 0;
  },
  true,
);
// homeClose(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js
// homeResume(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js
// homePar(): Erweiterung zusammengeführt, siehe 03-startseite/040-3d.js

// ---- Programmstart
// Läuft erst, wenn alle Dateien geladen sind. Vorher standen diese Aufrufe verteilt in
// 01-modell-3d, 06-darstellung, 07-analyse und 08-layout-pdf und liefen, bevor spätere
// Dateien ihre Daten angelegt hatten.
function start() {
  // Platzhalter-Bestand (wird von demoOff() unten wieder entfernt)
  [
    [0, 3, 'Wohnen'],
    [2, 2, 'Wohnen'],
    [4, 3, 'Gewerbe'],
    [5, 2, 'Wohnen'],
    [7, 4, 'Wohnen'],
  ].forEach(([pi, n, use]) => {
    const q = P[pi].poly,
      x = q[0][0],
      z = q[0][1];
    const fp = [
      [x + 12, z + 12],
      [x + 43, z + 12],
      [x + 43, z + 38],
      [x + 12, z + 38],
    ];
    const b = {
      id: 'bestand_' + pi,
      ex: true,
      use,
      fp,
      levels: Array.from({ length: n }, (_, i) => ({ name: i ? i + '.OG' : 'EG', h: 3 })),
      est: true,
      src: 'Demo',
    };
    S.ex.push(b);
    mesh(b);
  });
  drInit();
  nav();
  setMode(1);
  $('b3').classList.add('on');
  H();
  tool('v');
  S.tab = 'Planen';
  rr();
  demoOff();
  P.length = 0;
  rr();
  homeOpen(1);
  try {
    op('trees', LY.find((l) => l[1] === 'trees')[3]);
  } catch (e) {
    logErr(e, 'start');
  }
  try {
    tgl('sun');
  } catch (e) {
    console.warn(e);
  }
  sunDefault();
}
start();
