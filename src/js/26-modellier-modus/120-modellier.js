/* v463 Modellier-Modellierung auch in der 2D-Draufsicht: Wände/Hofwände werden über den Abstand zur Kante gegriffen (von oben sind sie nur eine Linie),
   Flächen (Dach, Teilfläche, Hofboden) wie in 3D über den Strahl der Orthokamera */
function sk2Seg(p, a, c) {
  const dx = c[0] - a[0],
    dy = c[1] - a[1],
    L2 = dx * dx + dy * dy;
  let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}
function sk2Hit(e) {
  if (S.m3) return null;
  const m = [e.clientX, e.clientY];
  let best = null,
    bd = 7;
  const px = (b, j, q) => skProj(q[0], skZ(b, j), q[1]);
  S.bld.forEach((b) => {
    if (b.ex || !S.bld.includes(b)) return;
    (b.voids || []).forEach((v, vi) => {
      const n = v.poly.length;
      for (let i = 0; i < n; i++) {
        const a = px(b, v.j1, v.poly[i]),
          c = px(b, v.j1, v.poly[(i + 1) % n]),
          d = sk2Seg(m, a, c);
        if (d < bd) {
          bd = d;
          best = { b, j: v.j1, vd: vi, i };
        }
      }
    });
    b.levels.forEach((l, j) => {
      const f = lf(b, l),
        n = f.length;
      for (let i = 0; i < n; i++) {
        const p = f[i],
          q = f[(i + 1) % n];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) continue;
        const d = sk2Seg(m, px(b, j, p), px(b, j, q)) - j * 0.001;
        if (d < bd) {
          bd = d;
          best = { b, j, i };
        }
      }
    });
  });
  return best;
}
// skHit(): Erweiterung zusammengeführt, siehe 26-modellier-modus/010-modellier.js
// setMode(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js

// ---- Menü (oberes Menü „Bearbeiten“ und Rechtsklick-Menü): Werkzeuge aus der einen Registry BA
const SKBA = { sks: 's', skp: 'p', mv: 'm', skc: 'm', skl: 'l', skf: 'f', skr: 'r', skz: 'z' };
SK.cp = false;
SK.used = false;
function skUse(t, cp) {
  // ── Erweiterung aus 27-skizze/030-zeichnen.js
  // Vor dem Ausschalten der Ebene: Skizze zeigen, solange man im Bearbeiten-Modus ist
  if ('rzco'.includes(t) && !cp && !S.bld.length) {
    SK.skUseBasis = 1;
    try {
      SK.on = true;
      gdEnter(t);
      SK.tool = t;
    } catch (x) {
      console.warn(x);
    }
    SK.skUseBasis = 0;
    SK.used = true;
    try {
      skBaSync();
    } catch (e) {
      logErr(e, 'skUse');
    }
    szMsg(
      {
        r: 'Rechteck · zwei Ecken klicken, Länge;Breite tippen',
        z: 'Linie · Punkte klicken · bleibt als Kante stehen, geschlossener Zug = Fläche',
        c: 'Kreis · Mittelpunkt klicken, Radius ziehen oder tippen',
        o: 'Polygon · Mittelpunkt klicken, Radius ziehen · Seitenzahl tippen, z. B. 8s',
      }[t],
    );
    return;
  }
  if (!S.bld.length && 'splf'.includes(t)) {
    SK.skUseBasis = 1;
    try {
      SK.on = true;
      if (S.tool !== 'v' && S.tool !== 'b') tool('v');
      skTool(t);
      SK.cp = false;
    } catch (x) {
      console.warn(x);
    }
    SK.skUseBasis = 0;
    SK.used = true;
    try {
      skBaSync();
    } catch (e) {
      logErr(e, 'skUse');
    }
    szMsg(
      t === 'p'
        ? 'Ziehen & Schieben · Fläche anklicken, nach oben ziehen = Geschosse'
        : t === 's'
          ? 'Auswahl · Kante oder Fläche anklicken · Entf = löschen'
          : 'Teilen · Kante anklicken',
    );
    return;
  }
  return skUseBasis.apply(this, arguments);
}
// skUse() ohne die Erweiterungen darüber – wird von skUse() gezielt aufgerufen
function skUseBasis(t, cp) {
  SK._u = 1;
  try {
    if (!S.bld.length) {
      $('hud').textContent = 'Zuerst ein Gebäude anlegen';
      return;
    }
    SK.on = true;
    if (S.tool !== 'v' && S.tool !== 'b') tool('v');
    skTool(t);
    SK.cp = !!cp;
    if (cp)
      $('hud').textContent =
        'Gebäude kopieren · Gebäude anklicken und ziehen – das Original bleibt stehen · Esc bricht ab';
  } catch (e) {
    console.warn('Werkzeug', e);
  }
  SK._u = 0;
  SK.used = true;
  try {
    skBaSync();
  } catch (e) {
    logErr(e, 'skUse');
  }
}
function skBaSync() {
  // ── Erweiterung aus 27-skizze/010-grundflaechen-zeichnen-nach-dem-vorbild.js
  skBaSyncBasis();
  try {
    if (S.tool === 'f' && S.dm === 'bld') {
      const m = { free: 'skz', rect: 'skr', circ: 'skk', poly: 'sko' }[S.shape];
      document.querySelectorAll('[data-ba]').forEach((b) => {
        if (b.dataset.ba === m) b.classList.add('on');
      });
    }
  } catch (e) {
    logErr(e, 'skBaSync');
  }
}
// skBaSync() ohne die Erweiterungen darüber – wird von skBaSync() gezielt aufgerufen
function skBaSyncBasis() {
  document.querySelectorAll('[data-ba]').forEach((b) => {
    const m = SKBA[b.dataset.ba];
    if (m)
      b.classList.toggle('on', !!skAct() && SK.used && SK.tool === m && (b.dataset.ba === 'skc') === !!SK.cp);
  });
}
// baDo(): Erweiterung zusammengeführt, siehe 11-bearbeiten/020-bearbeiten.js
// tool(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// skTool(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
// skMStart(): Erweiterung zusammengeführt, siehe 26-modellier-modus/040-stufe-3.js
// Bearbeitungsmodus: keine Hover-Infos zu Flurstücken, Straßen, Gebäuden – nur die Werkzeug-Infos
function skEditing() {
  return !!(SK.used || SK.op || (typeof SZ !== 'undefined' && (SZ.d || SZ.op)) || S.tool !== 'v');
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    const r = _e.apply(this, arguments);
    if (r === true) SK._eh = Date.now();
    return r;
  };
}
addEventListener('keydown', (e) => {
  if (
    e.key === 'Escape' &&
    SK.used &&
    Date.now() - (SK._eh || 0) > 250 &&
    !SK.op &&
    !(typeof SZ !== 'undefined' && (SZ.d || SZ.op))
  ) {
    SK.used = false;
    try {
      skBaSync();
      $('hud').textContent = 'Bearbeiten beendet';
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  }
});
// skOpEnd(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
