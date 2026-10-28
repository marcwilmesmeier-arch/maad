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
{
  const _d = drSet;
  drSet = function (m) {
    if (m === 'sw' && S.m3) return;
    if (m === 'sw' && !S.lyM.sw) S.lyM.sw = swDefault();
    const was = S.dar;
    if (m !== 'sw' && was !== 'sw' && DAR.some((d) => d[0] === was)) SW.prev = was;
    if (m === 'sw' && was !== 'sw') SW.prev = was;
    const r = _d.apply(this, arguments);
    try {
      swPaint();
      if (S.dar === 'sw') {
        S.sun = false;
        const c = $('sunck');
        if (c) c.checked = false;
      }
      rr();
    } catch (e) {
      console.warn('sw', e);
    }
    return r;
  };
}
{
  const _u = drUi;
  drUi = function () {
    const r = _u.apply(this, arguments);
    try {
      const bs = $('darBtns').children;
      DAR.forEach((d, i) => {
        const b = bs[i];
        if (!b) return;
        const off = S.m3 && d[3] === '2d';
        b.disabled = off;
        b.style.opacity = off ? 0.4 : '';
        b.style.cursor = off ? 'not-allowed' : '';
        b.title = off ? 'Nur in der 2D-Ansicht verfügbar' : '';
      });
      if (swOnly(S.dar)) $('darDesc').textContent = DAR.find((d) => d[0] === S.dar)[2];
    } catch (e) {
      logErr(e, 'drUi');
    }
    return r;
  };
}
{
  const _m = setMode;
  setMode = function (m, k) {
    const r = _m.apply(this, arguments);
    try {
      if (m && swOnly(S.dar)) drSet(SW.prev && SW.prev !== 'sw' ? SW.prev : 'sch');
      else drUi();
    } catch (e) {
      console.warn('sw', e);
    }
    return r;
  };
}
{
  const _s = skyPre;
  skyPre = function () {
    const r = _s.apply(this, arguments);
    try {
      if (S.dar === 'sw' && KONsky.c !== '#ffffff') {
        KONsky.c = '#ffffff';
        ren.setClearColor(new T.Color('#ffffff'));
      }
    } catch (e) {
      logErr(e, 'skyPre');
    }
    return r;
  };
}
/* Schwarzplan: Layer, die in einem gespeicherten Schwarzplan-Zustand fehlen (später hinzugekommen), bleiben aus – nur „Gebäude“ ist an */
{
  const _m = lyMApply;
  lyMApply = function (st) {
    const r = _m.apply(this, arguments);
    try {
      if (S.dar === 'sw' && st && st.ly) {
        LY.forEach((l) => {
          if (l[1] !== 'buildings' && !st.ly.some((x) => x[0] === l[1]) && l[2]) {
            l[2] = 0;
            if (G[l[1]]) gVis(l[1], false);
          }
        });
        labVis();
        if (S.geo) recomp();
      }
    } catch (e) {
      logErr(e, 'lyMApply');
    }
    return r;
  };
}
