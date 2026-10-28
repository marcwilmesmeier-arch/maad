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
{
  const _s = homeSetup;
  homeSetup = function () {
    _s.apply(this, arguments);
    bootCur(0);
    if (HOME.hmLate) {
      HOME.hmLate = 0;
      setTimeout(() => {
        if (HOME.open && !HOME.hold)
          try {
            hmShow();
          } catch (e) {
            console.warn(e);
          }
      }, 1100);
    }
  };
}
{
  const _c = homeClose;
  homeClose = function () {
    const r = _c.apply(this, arguments);
    if (!HOME.hold) bootCur(0);
    return r;
  };
}

// Abstandsflächen immer ganz oben auf der Geländetextur (über Planum, Schutzgebiets-/CLC-Überlagerungen)
{
  const _r = recomp;
  recomp = function () {
    const r = _r.apply(this, arguments);
    try {
      const LA = LY.find((l) => l[1] === 'abst');
      if (LA && LA[2] && GEO.comp) {
        const cx = GEO.comp.getContext('2d');
        cx.globalAlpha = LA[3];
        cx.drawImage(PL.abst, 0, 0);
        cx.globalAlpha = 1;
        if (GEO.tex) GEO.tex.needsUpdate = true;
      }
    } catch (e) {
      logErr(e, 'recomp');
    }
    return r;
  };
}
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
{
  const _hc = homeClose;
  homeClose = function () {
    const shut = !HOME.resuming;
    if (shut) {
      RPG.until = Date.now() + 2000;
      document.body.classList.add('rpShut', 'rpNoAnim');
    }
    const r = _hc.apply(this, arguments);
    if (shut) {
      try {
        if (S.zo && S.zo.m !== 'b') zoMode('b');
      } catch (e) {
        console.warn(e);
      }
      document.body.classList.add('rpShut');
      setTimeout(() => document.body.classList.remove('rpNoAnim'), 2100);
    }
    return r;
  };
}
{
  const _hr = homeResume;
  homeResume = function () {
    HOME.resuming = 1;
    try {
      return _hr.apply(this, arguments);
    } finally {
      HOME.resuming = 0;
    }
  };
}
/* Startmenü-Zoom: ist ein Grundstück gewählt, wird darauf gezoomt (statt auf das Grundstück nahe der Kartenmitte) */
{
  const _hp = homePar;
  homePar = function () {
    try {
      const p = S.par;
      if (p && p.poly && p.poly.length > 2) return { a: p, c: cen(p.poly), ar: area(p.poly), poly: p.poly };
    } catch (e) {
      console.warn(e);
    }
    return _hp.apply(this, arguments);
  };
}
