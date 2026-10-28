// ---- Skizzenmodus: nur passende Werkzeuge im Menü; Rechtsklick auf geschlossene Fläche = Gebäude erzeugen
function skModeNow() {
  return (S.tool === 'f' && S.dm === 'bld') || SKS.sel.length > 0 || !S.bld.length;
}
let _skm = null;
const SKHID = ['mv', 'skc', 'ro', 'gr', 'fd', 'ed'];
function skMenuSync() {
  try {
    const m = skModeNow();
    if (m === _skm) return;
    _skm = m;
    document.querySelectorAll('#tmE [data-ba],#cmenu [data-ba]').forEach((b) => {
      b.style.display = m && SKHID.includes(b.dataset.ba) ? 'none' : '';
    });
  } catch (e) {
    logErr(e, 'skMenuSync');
  }
}
setInterval(skMenuSync, 250);
let _cmBase = null;
const skLast = { x: 0, y: 0 };
addEventListener(
  'pointermove',
  (e) => {
    skLast.x = e.clientX;
    skLast.y = e.clientY;
  },
  true,
);
function skCm(k) {
  cmHide();
  try {
    if (k === 'make') {
      const s = SKS.sel[0];
      if (!s || s.k !== 'f') return;
      const F = sksFacesNow()[s.f];
      if (!F) return;
      S.dm = 'bld';
      S.draft = F.o.map((q) => q.slice());
      S.closed = true;
      S.dk = 'free';
      S.refH = gh(F.o[0][0], F.o[0][1]);
      S.anchor = null;
      S.prev = null;
      SKS.pend = F;
      S.tab = 'Planen';
      tool('f');
      S.draft = F.o.map((q) => q.slice());
      S.closed = true;
      SKS.pend = F;
      S.tab = 'Planen';
      try {
        nav();
      } catch (e) {
        logErr(e, 'skCm');
      }
      drawOv();
      rr();
      szMsg(
        'Gebäude erzeugen · Geschosse, Höhe und Nutzung im Fenster einstellen und „Erzeugen“ wählen · Esc = abbrechen',
      );
      return;
    }
    if (k === 'del') {
      sksDelete();
      return;
    }
    if (k === 'ofs') {
      skUse('f');
      return;
    }
    if (k === 'split') {
      skUse('l');
      return;
    }
  } catch (x) {
    console.warn('skCm', x);
  }
}
{
  const _c = cmShow;
  cmShow = function (e) {
    cmHide();
    if (_cmBase == null) _cmBase = cmEl.innerHTML;
    cmEl.innerHTML = _cmBase;
    _skm = null;
    skMenuSync();
    try {
      if (SKS.e.length && !sksEntAt(e)) {
        const h = sksHit(e);
        if (h) {
          SKS.sel = [{ k: h.k, i: h.i, f: h.f }];
          sksRedraw();
          const it = (k, t, d) =>
            '<button onclick="skCm(\'' + k + '\')" title="' + d + '">' + t + '</button>';
          cmEl.innerHTML =
            h.k === 'f'
              ? it('make', 'Gebäude erzeugen', 'Fläche nach oben ziehen: Geschosse wählen, Klick = Gebäude') +
                it('ofs', 'Versatz', 'F – parallele Kopie der Außenkanten') +
                '<hr>' +
                it('del', 'Löschen', 'Entf – Fläche mit ihren Kanten löschen')
              : it('split', 'Teilen', 'T – Kante an einem Punkt teilen') +
                it('ofs', 'Versatz', 'F – Versatz') +
                '<hr>' +
                it('del', 'Löschen', 'Entf – Kante löschen');
          cmEl.classList.add('on');
          const w = cmEl.offsetWidth,
            hh = cmEl.offsetHeight;
          cmEl.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px';
          cmEl.style.top = Math.min(e.clientY, innerHeight - hh - 8) + 'px';
          return;
        }
      }
    } catch (x) {
      console.warn('cmsk', x);
    }
    return _c.apply(this, arguments);
  };
}
// „+ Gebäude“ mit gewählter Skizzenfläche = Gebäude aus dieser Fläche erzeugen (nicht wieder in den Zeichenwerkzeugen landen)
function plusBld() {
  const s = SKS.sel[0];
  if (s && s.k === 'f' && sksFacesNow()[s.f]) {
    skCm('make');
    return;
  }
  setShape(S.shape, 'bld');
}

{
  const _m = mk;
  mk = function () {
    const F = SKS.pend;
    SKS.pend = null;
    _m.apply(this, arguments);
    if (F) sksConsume(F);
  };
}
{
  const _c = cancel;
  cancel = function () {
    SKS.pend = null;
    return _c.apply(this, arguments);
  };
}
