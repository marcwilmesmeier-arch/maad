/* v317: Weißmodell – alle Ebenen sichtbar (nichts wird mehr ausgeblendet oder neutralisiert), Farben der Elemente sind frei einstellbar.
   Beim ersten Wechsel in das Weißmodell gilt eine helle Standardpalette; Wasser bleibt als helles Blau sichtbar. */
WM_HIDE.length = 0;
const WMPAL = {
  buildings: '#ffffff',
  terrain: '#f0f0ee',
  roads: '#ffffff',
  paths: '#f6f6f4',
  cycle: '#f1f1ef',
  rail: '#dcdcd8',
  green: '#e7e9e2',
  water: '#d3e2ea',
  trees: '#e3e3e0',
  rfs: '#f4f4f2',
  rff: '#ececea',
};
function wmPaint() {
  if (DR.wm && DR.wm.size) {
    DR.wm.forEach((v, m) => {
      m.color.setHex(v.c);
      if (v.map && m.map == null) m.map = v.map;
      m.vertexColors = v.vc;
      m.needsUpdate = true;
    });
    DR.wm.clear();
  }
}
S.wmPalDone = false;
function wmDefApply() {
  S.wmPalDone = true;
  const b = lyMSnap();
  Object.assign(b.lc, WMPAL);
  b.wv = 2;
  S.lyM.wm = b;
  lyMApply(b);
}
{
  const _d = drSet;
  drSet = function () {
    const r = _d.apply(this, arguments);
    try {
      if (S.dar === 'wm' && !(S.lyM.wm && S.lyM.wm.wv === 2)) wmDefApply();
    } catch (e) {
      console.error(e);
    }
    return r;
  };
}
{
  const _l = lyMLoad;
  lyMLoad = function () {
    const r = _l.apply(this, arguments);
    S.wmPalDone = !!(S.lyM.wm && S.lyM.wm.wv === 2);
    return r;
  };
}
