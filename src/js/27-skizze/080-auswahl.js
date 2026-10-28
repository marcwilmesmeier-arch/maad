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
  const lvl = () => skBld(en.b).filter((x) => x.j === en.j);
  const list =
    m === 'rep'
      ? n === 1
        ? skBld(en.b)
        : n === 2
          ? [en]
          : n === 3
            ? lvl()
            : skGroup(en)
      : n >= 3
        ? lvl()
        : [en];
  skSet(list, m === 'rep' ? 'rep' : m);
  $('hud').textContent =
    '' +
    skInfo() +
    (n === 1
      ? ' · P = Ziehen & Schieben ganzer Flächen · Doppelklick = Fläche dieses Geschosses bzw. Dachfläche'
      : n === 2
        ? ' · Rechtsklick = Ziehen & Schieben oder Versatz (oder mit gedrückter linker Maustaste ziehen) · Dreifachklick = ganzes Geschoss'
        : n === 3
          ? ' · Rechtsklick = Grundriss des Geschosses öffnen · Vierfachklick = Flucht über alle Geschosse'
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
{
  const _e = skOpEnd;
  skOpEnd = function () {
    const r = _e.apply(this, arguments);
    if (SKX.back && !SK.op) {
      SKX.back = 0;
      SK.tool = 's';
      try {
        skBar();
      } catch (e) {
        logErr(e, 'skOpEnd');
      }
    }
    return r;
  };
}
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
{
  const _b = baDo;
  baDo = function (k) {
    if (k === 'grl') {
      try {
        cmHide();
      } catch (e) {
        logErr(e, 'baDo');
      }
      if (mnStorey()) {
        const s = SK.sel[0];
        if (!grOpenLv(s.b.id, String(s.j)))
          try {
            $('hud').textContent = 'Grundriss konnte nicht geöffnet werden';
          } catch (e) {
            logErr(e, 'baDo');
          }
      }
      return;
    }
    return _b.apply(this, arguments);
  };
}
