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
{
  const _h = skHit;
  skHit = function (e) {
    if (!S.m3) {
      const q = sk2Hit(e);
      if (q) return q;
    }
    return _h.apply(this, arguments);
  };
}
{
  const _s = setMode;
  setMode = function () {
    const r = _s.apply(this, arguments);
    try {
      SK.hv = null;
      SK.ver++;
      skBar();
      skDraw();
    } catch (e) {
      logErr(e, 'setMode');
    }
    return r;
  };
}

// ---- Menü (oberes Menü „Bearbeiten“ und Rechtsklick-Menü): Werkzeuge aus der einen Registry BA
const SKBA = { sks: 's', skp: 'p', mv: 'm', skc: 'm', skl: 'l', skf: 'f', skr: 'r', skz: 'z' };
SK.cp = false;
SK.used = false;
function skUse(t, cp) {
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
  document.querySelectorAll('[data-ba]').forEach((b) => {
    const m = SKBA[b.dataset.ba];
    if (m)
      b.classList.toggle('on', !!skAct() && SK.used && SK.tool === m && (b.dataset.ba === 'skc') === !!SK.cp);
  });
}
{
  const _b = baDo;
  baDo = function (k) {
    if (SKBA[k]) {
      try {
        cmHide();
      } catch (e) {
        logErr(e, 'baDo');
      }
      skUse(SKBA[k], k === 'skc');
      return;
    }
    return _b.apply(this, arguments);
  };
}
{
  const _t = tool;
  tool = function () {
    if (!SK._u) SK.used = false;
    const r = _t.apply(this, arguments);
    try {
      skBaSync();
    } catch (e) {
      logErr(e, 'tool');
    }
    return r;
  };
}
{
  const _k = skTool;
  skTool = function () {
    SK.cp = false;
    const r = _k.apply(this, arguments);
    try {
      skBaSync();
    } catch (e) {
      logErr(e, 'skTool');
    }
    return r;
  };
}
{
  const _m = skMStart;
  skMStart = function (e, ent) {
    if (SK.cp)
      e = {
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: !!e.altKey,
        shiftKey: !!e.shiftKey,
        ctrlKey: true,
        button: e.button || 0,
      };
    return _m.call(this, e, ent);
  };
}
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
{
  const _e = skOpEnd;
  skOpEnd = function (ok) {
    const op = SK.op;
    const r = _e.apply(this, arguments);
    try {
      if (ok && op && op.b && !op.top && !op.kind && znCleanFp(op.b)) {
        op.b._gr = null;
        mesh(op.b);
        H();
        hpos();
        rr();
      }
    } catch (e) {
      console.warn('Grundriss bereinigen', e);
    }
    return r;
  };
}
