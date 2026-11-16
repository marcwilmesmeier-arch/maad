// ---- v494: Auswahl-Staffelung: 1 Klick = Gebäude · 2 Klicks = Fläche des Geschosses / Dachfläche · 3 Klicks = Flucht ueber alle Geschosse.
// Eine so gewaehlte Einzelfläche loest bei gedrueckter linker Maus (Ziehen) Ziehen & Schieben aus.
function skSelClick(e) {
  const en = skHit(e),
    n = skClickN(e),
    m = skMode(e);
  if (!en) {
    if (m === 'rep' && SK.sel.length) {
      SK.sel = [];
      SK.ver++;
      skSync();
      $('hud').textContent = 'Auswahl aufgehoben';
    }
    return;
  }
  // Auswahlfilter und Klickstufen: 140-kontextleiste.js (skKlickListe)
  const list = skKlickListe(en, n, m);
  skSet(list, m === 'rep' ? 'rep' : m);
  $('hud').textContent =
    '' +
    skInfo() +
    (SK.flt === 'a' && m === 'rep' && list.length > 1 && skWhole(en.b)
      ? ' · Klick auf eine Fläche wählt die Fläche'
      : list.length === 1 && !en.top
        ? ' · Fläche anfassen und ziehen = Ziehen & Schieben'
        : '');
}
const SKX = { pend: null, back: 0 };
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    SKX.pend = null;
    try {
      if (
        SK.tool === 's' &&
        e.button === 0 &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        SK.sel.length &&
        !SK.op
      ) {
        const en = skHit(e);
        if (en && skHas(en) && !skWhole(en.b) && SK.sel.length <= 6)
          SKX.pend = { x: e.clientX, y: e.clientY, en, id: e.pointerId };
      }
    } catch (e) {
      logErr(e, 'opDown');
    }
    return _d.apply(this, arguments);
  };
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      const p = SKX.pend;
      if (!p || !skAct() || SK.tool !== 's' || SK.op) return;
      if (!(e.buttons & 1)) {
        SKX.pend = null;
        return;
      }
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
      SKX.pend = null;
      try {
        dr = null;
      } catch (e) {
        logErr(e, 'init>anonym');
      }
      SK.tool = 'p';
      SKX.back = 1;
      const fake = {
        clientX: p.x,
        clientY: p.y,
        altKey: false,
        shiftKey: false,
        ctrlKey: false,
        button: 0,
        pointerId: p.id,
      };
      const ok = SK.opDownP(fake);
      if (!ok) {
        SK.tool = 's';
        SKX.back = 0;
        return;
      }
      try {
        cv.setPointerCapture(p.id);
      } catch (e) {
        logErr(e, 'init>anonym');
      }
      e.stopImmediatePropagation();
      SK.opMove && SK.opMove(e);
    } catch (x) {
      console.warn('skx', x);
    }
  },
  true,
);
addEventListener(
  'pointerup',
  () => {
    SKX.pend = null;
  },
  true,
);
// skOpEnd(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
// Doppelklick im Modellier-Modus waehlt nur die Flaeche – der Grundriss oeffnet sich nicht mehr von selbst (Knopf "Grundriss öffnen" im Planen-Panel bleibt)
addEventListener(
  'dblclick',
  (e) => {
    try {
      if (e.target === cv && skAct()) e.stopImmediatePropagation();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);

function mnStorey() {
  try {
    const s = SK.sel;
    if (!SK.on || s.length < 2) return false;
    const b = s[0].b,
      j = s[0].j;
    return s.every((x) => x.b === b && x.j === j) && S.bld.includes(b);
  } catch (_) {
    return false;
  }
}
// baDo(): Erweiterung zusammengeführt, siehe 11-bearbeiten/020-bearbeiten.js
