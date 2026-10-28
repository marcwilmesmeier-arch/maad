/* v503: Darstellung „Schwarzplan“ – nur Gebäude, schwarz auf weiß, nur in 2D. DAR-Eintrag Position 4 = Verfügbarkeit ('2d' | 'both') */
DAR.push([
  'sw',
  'Schwarzplan',
  'Nur Gebäude in Schwarz auf weißem Grund, nur in der 2D-Ansicht verfügbar. Ebenen und Farben bleiben frei einstellbar.',
  '2d',
]);
const SW = { bg: new Map(), prev: 'sch' };
const swOnly = (m) => {
  const d = DAR.find((x) => x[0] === m);
  return !!d && d[3] === '2d';
};
function swDefault() {
  const b = lyMSnap();
  b.ly = b.ly.map(([k, v, o]) => [k, k === 'buildings' ? 1 : 0, k === 'buildings' ? 1 : o]);
  b.lc.buildings = '#000000';
  b.lc.terrain = '#ffffff';
  b.sn = false;
  b.fn = false;
  return b;
}
function swPaint() {
  const on = S.dar === 'sw',
    pl = new Set();
  if (on)
    S.bld.forEach((b) => {
      if (!b.ex && b._g)
        b._g.traverse((q) => {
          if (q.isMesh && !q.userData._ov) pl.add(q);
        });
    });
  pl.forEach((o) => {
    const m = o.material;
    if (!m || Array.isArray(m) || m.type !== 'MeshLambertMaterial' || SW.bg.has(m)) return;
    SW.bg.set(m, { c: m.color.getHex(), map: m.map, vc: m.vertexColors });
    m.color.setHex(0);
    m.map = null;
    m.vertexColors = false;
    m.needsUpdate = true;
  });
  if (!on) {
    SW.bg.forEach((v, m) => {
      m.color.setHex(v.c);
      if (v.map && m.map == null) m.map = v.map;
      m.vertexColors = v.vc;
      m.needsUpdate = true;
    });
    SW.bg.clear();
  }
}
// drSet(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
// drUi(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
// setMode(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// skyPre(): Erweiterung zusammengeführt, siehe 16-darstellung-erweitert/030-himmelfarbe-je-darstellung.js
// lyMApply(): Erweiterung zusammengeführt, siehe 18-erweiterungen-v280-v325/030-layer.js
