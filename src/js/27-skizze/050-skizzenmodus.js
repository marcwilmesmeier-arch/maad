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
// cmShow(): Erweiterung zusammengeführt, siehe 13-geometrie-und-nutzung/010-hilfen-geometrie.js
// „+ Gebäude“ mit gewählter Skizzenfläche = Gebäude aus dieser Fläche erzeugen (nicht wieder in den Zeichenwerkzeugen landen)
function plusBld() {
  const s = SKS.sel[0];
  if (s && s.k === 'f' && sksFacesNow()[s.f]) {
    skCm('make');
    return;
  }
  setShape(S.shape, 'bld');
}

// mk(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// cancel(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
