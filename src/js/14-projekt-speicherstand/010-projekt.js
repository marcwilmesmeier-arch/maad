// ---- Projekt: vollständiger Speicherstand (alles, was im Projekt verändert wird)
const bKey = (b) => {
  const o = b && b.o && b.o[0];
  return o ? Math.round(o[0] * 10) + ',' + Math.round(o[1] * 10) + ',' + b.o.length : null;
};
const tKey = (t) => Math.round(t.x * 10) + ',' + Math.round(t.z * 10);
function projExtra(cam) {
  const x = { v: 2 };
  try {
    x.sites = P.filter((q) => q.site).map((q) => ({
      id: q.id,
      name: q.name,
      poly: q.poly.map((c) => c.slice()),
      fl: q.fl,
    }));
    x.siteN = S.siteN;
    x.par = S.par ? S.par.id : null;
    x.parSel = [...S.parSel].map((i) => AL[i] && AL[i].id).filter(Boolean);
    x.lim = S.lim;
    x.gen = S.gen;
    x.uses = S.uses;
    x.abst = S.abst;
    x.showSN = S.showSN;
    x.mkOn = S.mkOn;
    x.mkA = S.mkA;
    x.showFN = S.showFN;
    x.plOpen = S.plOpen;
    x.ly = LY.map((l) => [l[1], l[2], l[3]]);
    x.lc = S.lc;
    x.oc = S.oc;
    x.edgeC = S.edgeC;
    x.sun = S.sun;
    x.light = { lt: S.lt, lb: $('lb').value, lk: $('lk').value, dt: $('dt').value, hr: $('hr').value };
    x.wire = S.wire;
    x.gbMode = S.gbMode;
    x.dar = S.dar;
    x.kon = S.kon;
    x.hlc = S.hlc;
    x.sky = S.sky;
    x.fang = S.fang;
    x.aa = S.aa;
    x.fx = S.fx;
    x.lyM = lyMSave();
    x.clg = S.clgc;
    x.plm = typeof plmSave === 'function' ? plmSave() : null;
    x.rb = S.rb;
    x.ifc = IFC.cfg || null;
    x.ortho = S.ortho;
    x.sd = S.sd;
    x.sa = S.sa;
    x.lod2On = S.lod2On;
    x.lod3On = S.lod3On;
    x.views = S.views;
    x.variants = S.variants;
    x.meas = S.meas;
    x.areaN = S.areaN;
    x.fa = S.fa;
    x.din = S.din;
    x.gro = S.gro;
    x.zo = S.zo;
    x.layout = {
      font: LAY.font,
      fmt: LAY.fmt,
      ori: LAY.ori,
      n: LAY.n,
      els: LAY.els.map((e) => {
        const c = { ...e };
        delete c._img;
        delete c._ik;
        return c;
      }),
    };
    x.bdel = (GEO.bdel || []).map(bKey).filter(Boolean);
    x.tdel = (GEO.tdel || []).map(tKey);
    if (cam) x.view = { m3: !!S.m3, tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rotT };
  } catch (e) {
    console.warn('projExtra', e);
  }
  // ── Erweiterung aus 19-fassadendesigner/010-fassadendesigner.js (danach)
  try {
    x.ft = JSON.parse(JSON.stringify(S.ft));
  } catch (e) {
    logErr(e, 'projExtra');
  }
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js (danach)
  try {
    x.mat = JSON.parse(JSON.stringify(S.mat));
  } catch (e) {
    logErr(e, 'projExtra');
  }
  // ── Erweiterung aus 27-skizze/020-kantennetz.js (danach)
  try {
    if (SKS.e.length) x.sk = { e: SKS.e, cv: SKS.cv, hide: SKS.hide };
  } catch (e) {
    logErr(e, 'projExtra');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js (danach)
  try {
    if (UT.length) x.utr = UT.map((t) => ({ x: t.x, z: t.z, h: t.h, r: t.r, sh: t.sh, sd: t.sd }));
  } catch (e) {
    logErr(e, 'projExtra');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/080-panel.js (danach)
  try {
    if (IMP.sh.length)
      x.imp = IMP.sh.map((s) => ({
        name: s.name,
        url: s.url,
        pw: s.pw,
        ph: s.ph,
        w: s.w,
        h: s.h,
        x: s.x,
        z: s.z,
        rot: s.rot,
        op: s.op,
        vis: s.vis,
        lock: s.lock,
      }));
  } catch (e) {
    logErr(e, 'projExtra');
  }
  return x;
}
const cp = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
// vor dem Laden der Gebäude: Farben, entfernter Bestand/Bäume
function projApplyPre(x) {
  // ── Erweiterung aus 27-skizze/020-kantennetz.js
  const r = (() => {
    if (!x || !x.v) return;
    try {
      if (x.edgeC) S.edgeC = x.edgeC;
      if (x.oc) {
        S.oc = x.oc;
        ocApply();
      }
      if (x.lc) {
        const ch = Object.keys(x.lc).filter((k) => S.lc[k] !== x.lc[k]);
        Object.assign(S.lc, lcMig(x.lc));
        if (ch.length) lcApplyAll(ch);
      }
      if (x.bdel && x.bdel.length && GEO.blist) {
        const ks = new Set(x.bdel),
          rm = GEO.blist.filter((b) => ks.has(bKey(b)));
        if (rm.length) {
          GEO.blist = GEO.blist.filter((b) => !rm.includes(b));
          GEO.bdel = (GEO.bdel || []).concat(rm);
          ctxBuild(GEO.blist.slice());
        }
      }
      if (x.tdel && x.tdel.length && GEO.trees) {
        const ks = new Set(x.tdel),
          rm = GEO.trees.filter((t) => ks.has(tKey(t)));
        if (rm.length) {
          GEO.tdel = (GEO.tdel || []).concat(rm);
          treesBuild(GEO.trees.filter((t) => !rm.includes(t)));
        }
      }
    } catch (e) {
      console.warn('projApplyPre', e);
    }
  })();
  try {
    SKS.e = x && x.sk && x.sk.e ? JSON.parse(JSON.stringify(x.sk.e)) : [];
    SKS.cv = (x && x.sk && x.sk.cv) || 0;
    SKS.hide = x && x.sk && x.sk.hide ? x.sk.hide.slice() : [];
    SKS.sel = [];
    sksChanged();
  } catch (e) {
    logErr(e, 'projApplyPre');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js (danach)
  try {
    const had = UT.length;
    UT.length = 0;
    ((x && x.utr) || []).forEach((t) =>
      UT.push({
        x: t.x,
        z: t.z,
        h: t.h,
        r: t.r,
        sp: 'Eigener Baum',
        src: 'user',
        u: 1,
        sh: t.sh,
        sd: t.sd,
      }),
    );
    if (had || UT.length) trRebuild();
  } catch (e) {
    logErr(e, 'projApplyPre');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/080-panel.js (danach)
  try {
    if (x && x.imp && x.imp.length && !IMP.sh.length) x.imp.forEach((o) => impAdd(o));
  } catch (e) {
    console.warn('imp load', e);
  }
  return r;
}
function lcApplyAll(keys) {
  for (const k of keys) {
    const v = S.lc[k];
    if (k === 'un') {
      // Nutzungsfarben ('un') werden hier bewusst nicht angewendet
    } else if (k === 'buildings') setCol(G.ex, v);
    else if (k === 'terrain') {
      if (S.skirt) S.skirt.material.color.set(shade(v, 0.82));
      if (!S.geo && S.terr) S.terr.material.color.set(v);
    } else if (k === 'parcels') {
      if (!AL.length) setCol(G.parcels, v);
    } else if (k === 'rnames') rnBuild();
    else if (k === 'trees') {
      setCol(G[k], v);
      if (GEO.t2m) GEO.t2m.forEach((m) => m.color.set(shade(v, 0.66)));
    } else if (k === 'bplan') {
      // Bebauungsplan ('bplan') wird hier bewusst nicht eingefärbt
    } else if (PK[k]) {
      if (!(S.geo && GEO.acc)) setCol(G[k], v);
    } else setCol(G[k], v);
  }
  if (S.geo) {
    if (GEO.acc) ctxPaint(GEO.acc);
    if (keys.includes('parcels') && AL.length) parRefresh();
    if (keys.includes('bplan')) {
      bpLines();
      bpPaint();
    }
    recomp();
  }
}
// nach dem Laden: Grundstück, Grenzwerte, Nutzungen, Layer, Licht, Ansichten, Layout, Varianten …
function projApplyPost(x) {
  if (!x || !x.v) return;
  try {
    if (typeof plmLoad === 'function') plmLoad(x.plm);
  } catch (e) {
    logErr(e, 'projApplyPost');
  }
  try {
    if (x.sites) {
      for (let i = P.length - 1; i >= 0; i--) if (P[i].site) P.splice(i, 1);
      x.sites.forEach((q) =>
        P.push({ id: q.id, name: q.name, poly: q.poly.map((c) => c.slice()), site: true, fl: q.fl }),
      );
      S.siteN = Math.max(S.siteN || 0, x.siteN || 0);
      S.par =
        P.find((q) => q.id === x.par) ||
        AL.find((a) => a.id === x.par) ||
        (x.sites.length ? P.find((q) => q.site) : null) ||
        null;
      S.parSel = new Set(
        (x.parSel || []).map((id) => AL.findIndex((a) => a.id === id)).filter((i) => i >= 0),
      );
      parRefresh();
    }
    projApplySet(x);
    if (x.areaN != null) S.areaN = Math.max(S.areas.length, x.areaN);
    S.bld.forEach(mesh);
    H();
    hpos();
  } catch (e) {
    console.warn('projApplyPost', e);
  }
}
function projApplySet(x) {
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js
  try {
    if (x && x.mat) {
      S.mat = { o: x.mat.o || {}, nf: x.mat.nf || [] };
      l2mReg();
    }
  } catch (e) {
    logErr(e, 'projApplySet');
  }
  // ── Erweiterung aus 19-fassadendesigner/010-fassadendesigner.js
  try {
    if (x && x.ft && x.ft.length) S.ft = JSON.parse(JSON.stringify(x.ft));
  } catch (e) {
    logErr(e, 'projApplySet');
  }
  if (x.ifc)
    try {
      IFC.cfg = ifcCfgFix(x.ifc);
    } catch (e) {
      logErr(e, 'projApplySet');
    }
  if (x.kon && x.kon.wm && x.kon.sch) {
    S.kon = {
      wm: Object.assign({ on: false, w: 3, c: '#000000' }, x.kon.wm),
      sch: Object.assign({ on: false, w: 3, c: '#000000' }, x.kon.sch),
    };
    if (typeof konUi === 'function') konUi();
  }
  if (x.hlc) {
    S.hlc = Object.assign({}, x.hlc);
    if (typeof hlcApply === 'function') hlcApply();
  }
  if (x.sky) {
    S.sky = Object.assign({}, S.sky, x.sky);
    if (typeof skyUi === 'function') skyUi();
  }
  if (x.fang) S.fang = Object.assign({}, S.fang, x.fang);
  if (x.lim) Object.assign(S.lim, cp(x.lim));
  if (x.gen) S.gen = cp(x.gen);
  if (x.uses) Object.assign(S.uses, cp(x.uses));
  if (x.abst) S.abst = cp(x.abst);
  ['showSN', 'showFN', 'plOpen', 'ortho', 'sd', 'sa', 'lod2On', 'gbMode', 'mkOn', 'mkA'].forEach((k) => {
    if (x[k] != null) S[k] = x[k];
  });
  if (x.ly) {
    x.ly.forEach(([k, v, o]) => {
      if (['clc', 'nsg', 'ffh', 'vsg', 'hq'].includes(k)) v = 0;
      const i = LY.findIndex((l) => l[1] === k);
      if (i < 0) return;
      LY[i][2] = v;
      LY[i][3] = o;
      if (!S.geo || !PK[k] || k === 'parcels' || k === 'bplan') {
        if (G[k]) {
          gVis(k, !!v);
          op(k, o);
        }
      }
    });
    labVis();
    if (S.geo) recomp();
  }
  if (x.light) {
    const L = x.light;
    if (L.lb != null) $('lb').value = L.lb;
    if (L.lk != null) $('lk').value = L.lk;
    if (L.dt) $('dt').value = L.dt;
    if (L.hr != null) $('hr').value = L.hr;
    if (L.lt)
      S.lt = {
        wm: Object.assign({ b: 0.85, k: 0.2 }, L.lt.wm),
        sch: Object.assign({ b: 0.85, k: 0.2 }, L.lt.sch),
      };
    else if (L.lb != null) {
      const t = { b: +L.lb, k: L.lk != null ? +L.lk : 0.2 };
      S.lt = { wm: Object.assign({}, t), sch: Object.assign({}, t) };
    }
    if (x.sun != null) {
      S.sun = !!x.sun;
      $('sunck').checked = S.sun;
      $('bl').classList.toggle('sunon', S.sun);
      $('sunc').style.display = S.sun ? 'block' : 'none';
    }
    liUp();
  }
  if (x.aa != null) S.aa = +x.aa;
  if (x.rb != null) S.rb = +x.rb;
  try {
    fxLoad(x.fx);
    lyMLoad(x.lyM);
    clgLoad(x.clg);
  } catch (e) {
    logErr(e, 'projApplySet');
  }
  drSet(x.dar || 'sch');
  if (x.wire != null) {
    S.wire = !!x.wire;
    S.wf.visible = S.wire;
    const e = $('wirck');
    if (e) e.checked = S.wire;
  }
  if (x.views) {
    S.views = cp(x.views);
    S.vact = null;
    vwSave();
    vwRenderIf();
  }
  if (x.variants) S.variants = cp(x.variants);
  if (x.fa && x.fa.length) S.fa = cp(x.fa);
  if (x.din) Object.assign(S.din, cp(x.din));
  if (x.gro) {
    const l0 = S.gro.lab;
    Object.assign(S.gro, cp(x.gro));
    S.gro.lab = Object.assign({}, l0, S.gro.lab);
  }
  if (x.zo && ['b', 'f', 'u'].includes(x.zo.m))
    S.zo = { o: S.zo.o || {}, m: x.zo.m, bc: /^#[0-9a-f]{6}$/i.test(x.zo.bc) ? x.zo.bc : '#9db4cc' };
  if (x.meas) S.meas = cp(x.meas);
  if (x.layout) {
    const o = x.layout;
    LAY.fmt = LAYF[o.fmt] ? o.fmt : 'A3';
    LAY.font = LFONT[o.font] ? o.font : 'helv';
    LAY.ori = o.ori === 'h' ? 'h' : 'q';
    LAY.els = cp(o.els) || [];
    LAY.n = o.n || LAY.els.length;
    LAY.sel = null;
    laySave();
    if (LAY.open) {
      try {
        layRender();
      } catch (e) {
        logErr(e, 'projApplySet');
      }
    }
  }
  try {
    AN.rev++;
    AN.key = '';
  } catch (e) {
    logErr(e, 'projApplySet');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js (danach)
  try {
    lyAfterRun();
  } catch (e) {
    logErr(e, 'projApplySet');
  }

  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js (danach)
  sunDefault();
}
function projApplyView(x) {
  if (!x || !x.v || !x.view) return;
  try {
    const v = x.view;
    if (!v.m3) setMode(0, 1);
    V.tx = v.tx;
    V.tz = v.tz;
    V.d = v.d;
    if (v.az != null) V.az = v.az;
    if (v.pol != null) V.pol = v.pol;
    if (v.rot != null) V.rot = V.rotT = v.rot;
    S.vanim = null;
  } catch (e) {
    console.warn(e);
  }
}
// Standardwerte (für neue Projekte)
let PDEF = null;
setTimeout(() => {
  try {
    const x = projExtra(false);
    ['sites', 'par', 'parSel', 'bdel', 'tdel', 'siteN'].forEach((k) => delete x[k]);
    PDEF = JSON.stringify(x);
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 2500);
function projDefaults() {
  if (!PDEF) return;
  const x = JSON.parse(PDEF);
  x.views = [];
  x.variants = [];
  x.meas = [];
  x.layout = { font: LAY.font, fmt: 'A3', ori: 'q', n: 0, els: [] };
  if (x.lc) {
    const ch = Object.keys(x.lc).filter((k) => S.lc[k] !== x.lc[k]);
    Object.assign(S.lc, lcMig(x.lc));
    if (ch.length) lcApplyAll(ch);
  }
  if (x.oc) {
    S.oc = x.oc;
    ocApply();
  }
  if (x.edgeC) S.edgeC = x.edgeC;
  projApplySet(x);
}

LY.push(['Einheitenkörper', 'un', 1, 0.7]);
S.lc.un = '#555555';
