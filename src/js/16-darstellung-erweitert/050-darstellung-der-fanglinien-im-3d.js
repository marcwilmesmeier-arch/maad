// ---- Darstellung der Fanglinien im 3D-Overlay
const FG = { g: new T.Group(), m: {} };
FG.g.renderOrder = 8;
sc.add(FG.g);
const FGC = { ax: 0x0a9ea8, wal: 0x5e7f92, trk: 0xe08a00, perp: 0x7b3fc4 };
function fgMat(k, faint) {
  const key = k + (faint ? 'f' : '');
  if (!FG.m[key])
    FG.m[key] = new T.LineDashedMaterial({
      color: FGC[k] || 0x0a9ea8,
      dashSize: 1,
      gapSize: 1,
      transparent: true,
      opacity: faint ? 0.38 : 0.95,
      depthTest: false,
      depthWrite: false,
    });
  return FG.m[key];
}
function fgClear() {
  while (FG.g.children.length) {
    const o = FG.g.children.pop();
    o.geometry && o.geometry.dispose();
  }
  FG.g.visible = false;
}
function fgUpdate() {
  // ── Erweiterung aus 27-skizze/060-fang-auf-fusspunkt-im-rechten.js
  // Fanglinien auch beim Ziehen von Skizzenpunkten anzeigen
  if (!SNX.on) return fgUpdateBasis.apply(this, arguments);
  const t = S.tool,
    c = S.closed;
  S.tool = 'f';
  S.closed = false;
  try {
    fgUpdateBasis.apply(this, arguments);
  } finally {
    S.tool = t;
    S.closed = c;
  }
}
// fgUpdate() ohne die Erweiterungen darüber – wird von fgUpdate() gezielt aufgerufen
function fgUpdateBasis() {
  const f = S.fg,
    live =
      (S.tool === 'f' && !S.closed) || (typeof dr !== 'undefined' && dr && dr.v != null && S.tool === 'ed');
  if (!f || !live || !(S.fang.g || (f.gd && f.gd.length))) {
    fgClear();
    return;
  }
  const A = ed() || [],
    rh = A === S.draft ? S.refH : isCt(A) && S.sel && S.sel.ref != null ? S.sel.ref : null,
    y = (x, z) => (rh != null ? rh + 0.15 : gh(x, z) + 1),
    u = mpp(),
    Hh = Math.min(500, Math.max(40, 1100 * u)),
    st = Math.max(2, 18 * u);
  fgClear();
  const byK = {};
  const put = (g, faint) => {
    const key = g.k + (faint ? 'f' : ''),
      a = byK[key] || (byK[key] = { k: g.k, faint, pos: [] }),
      c = Math.cos(g.a),
      s = Math.sin(g.a);
    let px = null;
    for (let tt = -Hh; tt <= Hh + 1e-6; tt += st) {
      const x = g.ox + c * tt,
        z = g.oz + s * tt,
        yy = y(x, z);
      if (px) a.pos.push(px[0], px[1], px[2], x, yy, z);
      px = [x, yy, z];
    }
  };
  (f.fa || []).forEach((g) => {
    if (
      !(f.gd || []).some(
        (h) =>
          fgPA(h.a, g.a) < 1e-3 &&
          Math.abs((h.ox - g.ox) * Math.sin(g.a) - (h.oz - g.oz) * Math.cos(g.a)) < 1e-6,
      )
    )
      put(g, true);
  });
  (f.gd || []).forEach((g) => put(g, false));
  Object.values(byK).forEach((o) => {
    if (!o.pos.length) return;
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(o.pos), 3));
    const m = fgMat(o.k, o.faint);
    m.dashSize = (o.faint ? 6 : 10) * u;
    m.gapSize = (o.faint ? 6 : 5) * u;
    const ln = new T.LineSegments(ge, m);
    ln.computeLineDistances();
    ln.frustumCulled = false;
    ln.renderOrder = 8;
    ln.raycast = () => {};
    FG.g.add(ln);
  });
  // Winkelbogen (45°/90° zur Kante)
  if (f.arc) {
    const a = f.arc,
      r = 26 * u,
      pos = [],
      N = 18;
    let px = null;
    for (let j = 0; j <= N; j++) {
      const ang = a.a0 + (a.df * j) / N,
        x = a.c[0] + Math.cos(ang) * r,
        z = a.c[1] + Math.sin(ang) * r,
        v = [x, y(x, z), z];
      if (px) pos.push(...px, ...v);
      px = v;
    }
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    const ln = new T.LineSegments(
      ge,
      new T.LineBasicMaterial({ color: 0x5e7f92, depthTest: false, transparent: true }),
    );
    ln.frustumCulled = false;
    ln.renderOrder = 9;
    ln.raycast = () => {};
    FG.g.add(ln);
  }
  // Fangmarke am Fangpunkt
  if (f.t && f.p) {
    const x = f.p[0],
      z = f.p[1],
      m = 6.5 * u,
      yy = y(x, z) + 0.02,
      pos = [],
      L = (a, b, c, d) => pos.push(x + a, yy, z + b, x + c, yy, z + d);
    if (f.t === 'pt') {
      L(-m, -m, m, -m);
      L(m, -m, m, m);
      L(m, m, -m, m);
      L(-m, m, -m, -m);
    } else if (f.t === 'x') {
      L(-m, -m, m, m);
      L(m, -m, -m, m);
    } else if (f.t === 'perp') {
      L(-m, -m, m, -m);
      L(m, -m, m, m);
      L(m, m, -m, m);
      L(-m, m, -m, -m);
      L(-m, 0, 0, 0);
      L(0, 0, 0, m);
    } else if (f.t === 'mid') {
      L(-m, m, m, m);
      L(m, m, 0, -m);
      L(0, -m, -m, m);
    } else if (f.t === 'edge') {
      L(-m, 0, 0, -m);
      L(0, -m, m, 0);
      L(m, 0, 0, m);
      L(0, m, -m, 0);
    } else if (f.t === 'g') {
      for (let j = 0; j < 8; j++) {
        const a0 = (j / 8) * 2 * Math.PI,
          a1 = ((j + 1) / 8) * 2 * Math.PI;
        L(Math.cos(a0) * m * 0.6, Math.sin(a0) * m * 0.6, Math.cos(a1) * m * 0.6, Math.sin(a1) * m * 0.6);
      }
    }
    if (pos.length) {
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      const ln = new T.LineSegments(
        ge,
        new T.LineBasicMaterial({ color: 0x5e7f92, depthTest: false, transparent: true }),
      );
      ln.frustumCulled = false;
      ln.renderOrder = 11;
      ln.raycast = () => {};
      FG.g.add(ln);
    }
  }
  FG.g.visible = FG.g.children.length > 0;
}
// drawOv(): Erweiterung zusammengeführt, siehe 01-modell-3d/030-wandflaechen.js
// ---- Einstellungen im Menü Layer
function fgSetAl(v) {
  S.gro.al = v ? 1 : 0;
  try {
    if (typeof GRS !== 'undefined' && GRS.bid) grAlignSync(grB());
  } catch (e) {
    logErr(e, 'fgSetAl');
  }
  FGK.k = '';
  try {
    drawOv();
  } catch (e) {
    logErr(e, 'fgSetAl');
  }
}
function fgUi() {
  const q = (id) => document.getElementById(id);
  if (!q('fgal')) return;
  q('fgal').checked = !!(S.gro && S.gro.al);
  q('fgg').checked = !!S.fang.g;
  q('fgd').checked = !!S.fang.d45;
  q('fgm').checked = !!S.fang.mid;
  const a = fangAxis(),
    nt = q('fgnt');
  if (nt)
    nt.textContent =
      S.gro && S.gro.al
        ? a != null
          ? 'Achse: ' + (Math.round((a * 1800) / Math.PI) / 10).toString().replace('.', ',') + '° zur x-Achse'
          : 'keine Seite gefunden'
        : 'Achse: Ansicht (2D) / Norden (3D)';
}
// lyRender(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
{
  const lp = document.getElementById('lyp');
  lp.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'fgal') {
      fgSetAl(e.target.checked);
      fgUi();
    } else if (id === 'fgg') {
      S.fang.g = e.target.checked;
      try {
        drawOv();
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    } else if (id === 'fgd') {
      S.fang.d45 = e.target.checked;
    } else if (id === 'fgm') {
      S.fang.mid = e.target.checked;
    }
  });
}

(function () {
  /* v238: Neue Oberfläche (Mockup im Tool) – Farben, Docks, Symbole, Effekte. Reine Darstellungsschicht: alle Funktionen/IDs/Handler bleiben unverändert.
   Startbildschirm (#home, #h*, .hchip, .hbtn) und 3D-Farben bleiben unberührt. Akzent: window.lotAccent('#E9A9A6'), Effekte: window.lotFx(true|false) */
  const thSet = (hex) => {
    const r = document.documentElement.style;
    r.setProperty('--pa4', hex);
    r.setProperty('--pa1', 'color-mix(in srgb,' + hex + ' 16%,#fff)');
    r.setProperty('--pa2', 'color-mix(in srgb,' + hex + ' 34%,#fff)');
    r.setProperty('--pa3', 'color-mix(in srgb,' + hex + ' 62%,#fff)');
    r.setProperty('--pa5', 'color-mix(in srgb,' + hex + ' 58%,#1d2024)');
    try {
      localStorage.setItem('lotAccent', hex);
    } catch (e) {
      logErr(e, 'thSet');
    }
  };
  window.lotAccent = thSet;
  window.lotFx = (on) => {
    document.documentElement.classList.toggle('thNoFx', !on);
    try {
      localStorage.setItem('lotFx', on ? '1' : '0');
    } catch (e) {
      logErr(e, 'lotFx');
    }
  };
  {
    let a = '#9EB2BE',
      f = '1';
    try {
      a = localStorage.getItem('lotAccent') || a;
      f = localStorage.getItem('lotFx') || f;
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    if (/^#e9a9a6$/i.test(a)) a = '#9EB2BE';
    thSet(a);
    if (f === '0') document.documentElement.classList.add('thNoFx');
  }
  const thCss = document.createElement('style');
  thCss.id = 'thCss';
  thCss.textContent = `
:root{--g5:#8c9096;--g7:#5a5e65;--ln:#1d1d1b14}
@keyframes thDrop{from{opacity:0;translate:0 -14px}to{opacity:1;translate:0 0}}
@keyframes thRise{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}
@keyframes thSL{from{opacity:0;translate:-16px 0}to{opacity:1;translate:0 0}}
@keyframes thSR{from{opacity:0;translate:16px 0}to{opacity:1;translate:0 0}}
@keyframes thPop{from{opacity:0;translate:0 8px;scale:.97}to{opacity:1;translate:0 0;scale:1}}
@keyframes thPopD{from{opacity:0;translate:0 -8px;scale:.97}to{opacity:1;translate:0 0;scale:1}}
@keyframes thFade{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}
.thNoFx *,.thNoFx *::before,.thNoFx *::after{animation:none!important;transition:none!important}
.thNoFx .fl,.thNoFx #tabs,.thNoFx #pc,.thNoFx #zol,.thNoFx #logo{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#E9EDEF!important}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* Farben: Grau + Pastell-Akzent */
.tb i,.tab i,.bt,.tmain i{color:var(--g7)}
.tb,.bt,.tab,.tmain,.lr,.srct button{transition:background .25s,color .25s,transform .22s,box-shadow .25s}
.tb:hover,.bt:hover,.tmain:hover{background:#1d1d1b0f;transform:translateY(-1px)}
.tab:hover{background:#1d1d1b0f}
.tb.on,.bt.on,.tg.open>.tmain,.tmain.on{background:linear-gradient(135deg,var(--pa2),var(--pa1));color:var(--pa5);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pa4) 55%,transparent),0 5px 14px color-mix(in srgb,var(--pa4) 35%,transparent)}
.tb.on i,.bt.on,.tmain.on i,.tg.open>.tmain i{color:var(--pa5)}
.tab.on{background:linear-gradient(135deg,var(--pa3),var(--pa2));color:var(--pa5);box-shadow:0 5px 14px color-mix(in srgb,var(--pa4) 40%,transparent),inset 0 0 0 1px #ffffff80}
.tab.on i{color:var(--pa5)}
.lr.on{background:linear-gradient(90deg,var(--pa2),var(--pa1));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pa4) 45%,transparent)}
.lr:hover{background:#1d1d1b0a}
#darBtns button.on{background:var(--pa3);border-color:var(--pa4);color:var(--pa5)}
#anbar .sm.on{background:var(--pa3);color:var(--pa5)}
.srct button.on{background:var(--pa2);color:var(--pa5);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pa4) 50%,transparent)}
.drb .dgo{background:var(--pa3);color:var(--pa5);border-color:var(--pa4)}
#pc .pri,#layTop .pri{background:linear-gradient(135deg,var(--pa3),var(--pa2));color:var(--pa5);box-shadow:0 6px 16px color-mix(in srgb,var(--pa4) 38%,transparent)}
#pc .pri:hover{transform:translateY(-1px)}
#zol .seg button.on{border-color:transparent;background:#fff;color:var(--pa5);box-shadow:0 2px 8px #1d1d1b1a}
input[type=number]:focus:not(#wz *),input[type=text]:focus:not(#wz *),input[type=date]:focus:not(#wz *),select:focus:not(#wz *){border-color:var(--pa4);box-shadow:0 0 0 3px color-mix(in srgb,var(--pa4) 32%,transparent)}
#pc details>summary::before{color:var(--pa5)}
.stb tr.cur td{background:var(--pa1)}
.lel.sel,.lel:hover{outline-color:var(--pa4)}
.lel .lh{background:var(--pa4)}
.lb.sel{border-color:var(--pa4);box-shadow:0 10px 30px #1d1d1b24,0 0 0 2px color-mix(in srgb,var(--pa4) 55%,transparent)}
input[type=range]:not(#wz *),input[type=checkbox]:not(#wz *),input[type=radio]:not(#wz *){accent-color:var(--pa4)}
[data-tip]{position:relative}
[data-tip]:hover::after{content:attr(data-tip);position:absolute;z-index:80;white-space:normal;width:max-content;max-width:230px;padding:5px 9px;border-radius:9px;background:#24262af0;color:#fff;font-size:11px;font-weight:500;line-height:1.35;letter-spacing:0;text-transform:none;font-family:inherit;pointer-events:none;animation:thFade .2s backwards;text-align:left}
#tbar [data-tip]:hover::after{top:calc(100% + 10px);left:50%;translate:-50% 0}
#vc [data-tip]:hover::after,#hb[data-tip]:hover::after{bottom:calc(100% + 10px);left:50%;translate:-50% 0}
#tabs [data-tip]:hover::after{right:calc(100% + 12px);top:50%;translate:0 -50%}
#anbar [data-tip]:hover::after{left:calc(100% + 10px);top:50%;translate:0 -50%}
#hb[data-tip]:hover::after{left:auto;right:0;translate:0 0}
#zol .seg{border-radius:13px;padding:3px;gap:2px;background:#1d1d1b0f}
#zol .seg button{display:flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0;border-radius:10px;color:var(--g7);font-weight:500;transition:background .3s,color .3s,flex .35s cubic-bezier(.2,.8,.2,1)}
#zol .seg button.on{flex:2.2}
#zol .seg button span{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .35s,opacity .25s}
#zol .seg button.on span{max-width:80px;opacity:1}
#zol .seg button svg{flex:none}
#zol .r.k.on{background:linear-gradient(90deg,var(--zh),transparent 140%)}
@media(min-width:801px){
#app{position:relative;grid-template-columns:1fr!important}
/* Marke / Hinweis */
#logo{top:16px!important;left:16px!important;border-radius:18px!important;animation:thSL .6s backwards}
#hud{left:50%!important;top:88px!important}
/* oben: Werkzeug-Dock */
#tbar{top:16px!important;left:50%!important;max-width:calc(100% - 460px)!important;padding:6px 8px!important;border-radius:20px!important;align-items:center;animation:thDrop .6s backwards}
.tcl{flex-direction:row!important;padding:0 0 0 8px!important;margin-left:8px;border-right:0!important;position:relative}
.tcl:first-child{margin-left:0;padding-left:0!important}
.tcl:not(:first-child)::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:1px;background:var(--ln)}
.tcl>small{display:none!important}
.tcr>.tg{padding:0 1px!important}
.tmain{font-size:0!important;display:flex!important;align-items:center;justify-content:center;height:40px;min-width:42px!important;padding:0 10px!important;border-radius:13px!important}
.tmain i{margin:0!important;display:flex;align-items:center}
.tmain.on,.tg.open>.tmain{font-size:11.5px!important;font-weight:600}
.tmain.on i,.tg.open>.tmain i{margin-right:8px!important}
.tmain{transition:background .25s,color .25s,transform .22s,box-shadow .25s,font-size .3s,padding .3s}
.tm{flex-direction:column!important;gap:2px!important;min-width:206px;padding:6px!important;border-radius:18px!important;top:calc(100% + 12px)!important;animation:thPopD .28s cubic-bezier(.2,.8,.2,1) backwards}
.tm .tb{display:flex!important;flex-direction:row!important;align-items:center;justify-content:flex-start!important;gap:11px;width:100%;height:36px;padding:0 12px!important;font-size:12px;border-radius:11px!important;text-align:left}
.tm .tb i{margin:0!important;display:flex}
.tm .tb:hover{transform:translateX(2px)}
/* unten: Ansichtsleiste */
#vc{bottom:16px!important;padding:7px 8px!important;border-radius:20px!important;gap:2px!important;animation:thRise .6s .1s backwards}
body.hpj #vc{bottom:36px!important}
#vc .bt{min-width:40px;height:38px;padding:0 8px!important;border-radius:13px!important;display:inline-flex;align-items:center;justify-content:center;font-size:0}
#vc .bt svg{display:block}
#thSeg{position:relative;display:flex;padding:3px;border-radius:13px;background:#1d1d1b0f;margin:0 5px}
#thSeg .thk{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:10px;background:#fff;box-shadow:0 2px 8px #1d1d1b1f;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
#thSeg:has(#b3.on) .thk{transform:translateX(100%)}
#thSeg .bt{position:relative;z-index:1;min-width:42px;height:32px;padding:0!important;font-size:12px;font-weight:600;color:var(--g5);background:none!important;box-shadow:none!important;border-radius:10px!important}
#thSeg .bt.on{color:var(--pa5)}
#cmp{width:36px;height:36px;line-height:36px;border-radius:50%;margin:0 2px;text-align:center;color:var(--g7)!important;font-weight:600;font-size:11px;box-shadow:inset 0 0 0 1px var(--ln);transition:background .25s,scale .25s}
#cmp:hover{background:var(--pa1);scale:1.08}
#lyp,#vwp,#lc{border-radius:20px!important;padding:14px!important;transform-origin:50% 100%;animation:thPop .3s cubic-bezier(.2,.8,.2,1) backwards}
/* rechts: Symbolleiste + Panel */
#r{position:absolute!important;inset:0;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;overflow:visible!important;pointer-events:none;z-index:21}
#tabs{position:absolute;right:16px;top:16px;width:58px;display:flex!important;flex-direction:column;gap:4px;padding:8px!important;border:1px solid var(--gb)!important;border-radius:20px;background:var(--gl);backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25);box-shadow:var(--sh);pointer-events:auto;animation:thSR .6s backwards}
.tab{width:40px;height:40px;padding:0!important;display:grid!important;place-items:center;font-size:0!important;border-radius:13px!important}
.tab i{margin:0!important;display:flex}
#hb{right:16px!important;bottom:16px!important;width:44px;height:44px;padding:0!important;border-radius:50%!important;background:var(--gl)!important;color:var(--g7)!important;border:1px solid var(--gb)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:grid;place-items:center;font-size:0;z-index:25;transition:background .25s,transform .25s}
#hb:hover{background:var(--pa1)!important;transform:scale(1.06)}
#hc{right:68px!important;bottom:16px!important;border-radius:18px!important}
#rph{position:absolute;right:80px;top:16px;width:318px;height:46px;display:flex;align-items:center;gap:8px;padding:0 12px 0 20px;z-index:2;pointer-events:auto;border-radius:22px 22px 0 0;background:linear-gradient(var(--gl) 72%,transparent);transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .35s;animation:thSR .6s .1s backwards}
#rph b{flex:1;font-size:12px;font-weight:600;letter-spacing:.02em}
#rph button{width:30px;height:30px;border:0;border-radius:10px;background:none;display:grid;place-items:center;color:var(--g7);cursor:pointer;transition:background .2s,transform .3s}
#rph button:hover{background:#1d1d1b12}
#pc{position:absolute;right:80px;top:16px;bottom:16px;width:318px;padding:46px 18px 60px!important;overflow:auto;pointer-events:auto;border:1px solid var(--gb);border-radius:22px;background:var(--gl);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);box-shadow:var(--sh);transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .35s;animation:thSR .6s .1s backwards}
body.rpShut #pc,body.rpShut #rph{transform:translateX(30px);opacity:0;pointer-events:none}
body.rpShut .tab.on:not(#bly){background:none;box-shadow:none;color:var(--g7)}
body.rpShut .tab.on:not(#bly) i{color:var(--g7)}
body.rpShut #rph button{transform:rotate(180deg)}
/* links: Analysebereich */
#zol{left:16px!important;top:88px!important;border-radius:20px!important;animation:thSL .6s .1s backwards}
#anbar{border-radius:20px!important}
body.anOn #anbar{left:16px!important}
body.anOn #anbar .anr:first-child{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;align-items:center}
body.anOn #anbar .anr:first-child>*{grid-column:1/-1}
body.anOn #anbar .anr:first-child>.th-t{grid-column:auto;display:grid;place-items:center;height:36px;padding:0;border-radius:11px}
body.anOn #anbar .anr:first-child>.th-t svg{display:block}
body.anOn #anbar .anr:first-child>.th-done{background:linear-gradient(135deg,var(--pa4),var(--pa3));color:var(--pa5);font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;height:38px;border-radius:13px;border:0;box-shadow:0 6px 16px color-mix(in srgb,var(--pa4) 40%,transparent)}
body.anOn #anbar .anr:first-child>.th-lock{display:flex;align-items:center;gap:8px;height:34px;border-radius:11px}
#exp{left:16px!important;right:auto!important;transform:none!important;bottom:16px!important;top:auto!important;max-width:calc(50vw - 230px);z-index:26;padding:9px 14px!important;border-radius:16px!important;background:var(--gl)!important;border:1px solid var(--gb)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 30px #1d1d1b1c;animation:thRise .4s backwards}
#exp input{width:min(150px,100%)}
#exp,#exp *{white-space:nowrap}
}
`;
  document.head.appendChild(thCss);
  /* ---- Symbole ---- */
  const thSV = (p, n) =>
    '<svg viewBox="0 0 24 24" width="' +
    (n || 20) +
    '" height="' +
    (n || 20) +
    '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    p +
    '</svg>';
  const MV =
      '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    PEN = '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
    CUBE = '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M12 11v10M4 7l8 4 8-4"/>',
    CUR = '<path d="M5 3.5l14 7-6 2-2 6z"/>',
    RECT = '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    PIN = '<path d="M12 21s6-5.5 6-10a6 6 0 10-12 0c0 4.5 6 10 6 10z"/><circle cx="12" cy="11" r="2"/>',
    COPY =
      '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>';
  const TH = {
    Auswahl: CUR,
    Kasten: '<rect x="4" y="5" width="16" height="14" rx="1.5" stroke-dasharray="3 2.5"/>',
    Fläche: '<path d="M4 17l3-10 10-2 3 9-8 6z"/>',
    Gebäude: CUBE,
    Straße:
      '<path d="M4 20C4 12 12 14 12 8S18 4 20 4"/><path d="M8 20c0-5 6-4 6-10" stroke-dasharray="2 2.5"/>',
    Bearbeiten: MV,
    Messen: '<path d="M4 15l11-11 5 5L9 20z"/><path d="M8 11l2 2M11 8l2 2M6 13l1 1"/>',
    Beschriften: PIN,
    Varianten: COPY,
    Freiform: '<path d="M12 4l8 8-8 8-8-8z"/>',
    Rechteck: RECT,
    Kreis: '<circle cx="12" cy="12" r="8"/>',
    Verschieben: MV,
    Drehen: '<path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/>',
    'Grundriss bearbeiten': PEN,
    Schneiden: '<path d="M4 4l16 16M9 4h11v11" stroke-dasharray="3 2.5"/>',
    Grundriss: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h9M13 4v8M13 16v4"/>',
    Löschen: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    Abstand: '<path d="M4 12h16M4 8v8M20 8v8"/>',
    Punkt: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
    'Ein/Aus':
      '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor" fill-opacity=".3"/>',
    Speichern: '<path d="M12 5v14M5 12h14"/>',
    Liste: '<path d="M5 7h14M5 12h14M5 17h14"/>',
    Planen: PEN + '<path d="M14 7l3 3"/>',
    Analyse: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    Export: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    Import: '<path d="M12 20V9M7 13l5-5 5 5M5 4h14"/>',
    Kontext: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    Layout: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    Text: '<path d="M6 6h12M12 6v13"/>',
    Linie: '<path d="M5 19L19 5"/>',
    Pfeil: '<path d="M5 19L19 5M11 5h8v8"/>',
    Ellipse: '<ellipse cx="12" cy="12" rx="8" ry="5.5"/>',
    Symbol: '<path d="M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16l-4.8 2.8 1-5.4-4-3.7 5.4-.7z"/>',
    Nummer: '<circle cx="12" cy="12" r="8"/><path d="M10.5 9.5L12.5 8v8"/>',
  };
  window.thUnmapped = [];
  const thLab = (b) =>
    [...b.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim();
  const thTip = (b, t) => {
    if (!t || b.dataset.tip) return;
    b.dataset.tip = t;
    b.removeAttribute('title');
    if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', t);
  };
  let thBusy = false;
  function thMap() {
    if (thBusy) return;
    thBusy = true;
    try {
      document.querySelectorAll('#tbar .tb').forEach((b) => {
        const i = b.querySelector(':scope>i');
        if (!i || i.dataset.th) return;
        const l = thLab(b),
          p = TH[l];
        if (!p) {
          if (l && !thUnmapped.includes(l)) thUnmapped.push(l);
          return;
        }
        i.innerHTML = thSV(p);
        i.dataset.th = '1';
        if (b.classList.contains('tmain')) {
          if (b.dataset.i) b.dataset.i = i.innerHTML;
          if (!b.dataset.tip) {
            const t = b.getAttribute('title') || l;
            thTip(b, t);
          }
        }
      });
      document.querySelectorAll('#tabs .tab').forEach((b) => {
        const i = b.querySelector(':scope>i');
        if (!i || i.dataset.th) return;
        const l = thLab(b),
          p = TH[l];
        if (!p) return;
        i.innerHTML = thSV(p);
        i.dataset.th = '1';
        thTip(b, b.getAttribute('title') || l);
        b.setAttribute('aria-label', l);
      });
      const vc = {
        bg: [
          '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
          'Layer',
        ],
        bv: [
          '<rect x="3.5" y="6" width="17" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
          'Ansichten',
        ],
        bl: [
          '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 010 15z" fill="currentColor" fill-opacity=".35"/>',
          'Darstellung',
        ],
      };
      Object.keys(vc).forEach((k) => {
        const b = document.getElementById(k);
        if (!b || b.dataset.th) return;
        b.innerHTML = thSV(vc[k][0]);
        b.dataset.th = '1';
        thTip(b, b.getAttribute('title') || vc[k][1]);
        b.setAttribute('aria-label', vc[k][1]);
      });
      document.querySelectorAll('#vc [data-vcx]').forEach((b) => {
        if (!b.dataset.tip) thTip(b, b.getAttribute('title'));
      });
      const c = document.getElementById('cmp');
      if (c && !c.dataset.tip) thTip(c, c.getAttribute('title'));
      const hb = document.getElementById('hb');
      if (hb && !hb.dataset.th) {
        hb.innerHTML = thSV(
          '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.01"/>',
          22,
        );
        hb.dataset.th = '1';
        hb.dataset.tip = 'Hilfe und Tastenkürzel';
        hb.removeAttribute('title');
        hb.setAttribute('aria-label', 'Hilfe und Tastenkürzel');
      }
      /* Annotation-Leiste (Ansicht bearbeiten) */
      document.querySelectorAll('#anbar .anr:first-child>.sm').forEach((b) => {
        if (b.dataset.th) return;
        const l = b.textContent.trim(),
          oc = b.getAttribute('onclick') || '';
        b.dataset.th = '1';
        if (oc.indexOf('anLock') >= 0) {
          const lk = /🔒/.test(l);
          b.classList.add('th-lock');
          b.innerHTML =
            thSV(
              lk
                ? '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/>'
                : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 016.8-1.2"/>',
              18,
            ) +
            '<span>' +
            (lk ? 'fixiert' : 'fixieren') +
            '</span>';
        } else if (oc.indexOf('anClose') >= 0) {
          b.classList.add('th-done');
          b.innerHTML = thSV('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18) + '<span>Fertig</span>';
        } else if (oc.indexOf('anTool') >= 0 && TH[l]) {
          b.classList.add('th-t');
          b.innerHTML = thSV(TH[l], 19);
          thTip(b, l);
          b.setAttribute('aria-label', l);
        }
      });
      /* Seitenpanel: Kopfzeile */
      const nm = document.querySelector('#rph b');
      if (nm && typeof S !== 'undefined')
        nm.textContent =
          S.tab === 'Kontext' ? 'Datenebenen' : S.tab === 'Analyse' ? 'Grundstück und Umgebung' : S.tab || '';
    } finally {
      thBusy = false;
    }
  }
  /* Strukturen einmalig aufbauen */
  (function () {
    const r = document.getElementById('r'),
      pc = document.getElementById('pc');
    if (r && pc && !document.getElementById('rph')) {
      const h = document.createElement('div');
      h.id = 'rph';
      h.innerHTML =
        '<b></b><button type="button" id="rpx" aria-label="Panel ein-/ausklappen" data-tip="Panel ein-/ausklappen">' +
        thSV('<path d="M9 6l6 6-6 6"/>', 18) +
        '</button>';
      r.insertBefore(h, pc);
      document.getElementById('rpx').addEventListener('click', () => {
        document.body.classList.toggle('rpShut');
      });
    }
    const b2 = document.getElementById('b2'),
      b3 = document.getElementById('b3');
    if (b2 && b3 && !document.getElementById('thSeg')) {
      const w = document.createElement('span');
      w.id = 'thSeg';
      w.innerHTML = '<i class="thk"></i>';
      b2.parentNode.insertBefore(w, b2);
      w.appendChild(b2);
      w.appendChild(b3);
    }
    const tabs = document.getElementById('tabs');
    if (tabs)
      tabs.addEventListener(
        'click',
        (e) => {
          const b = e.target.closest && e.target.closest('.tab');
          if (!b || b.id === 'bly') return;
          const sh = document.body.classList.contains('rpShut');
          if (b.classList.contains('on') && !sh) {
            e.stopImmediatePropagation();
            e.preventDefault();
            document.body.classList.add('rpShut');
            return;
          }
          document.body.classList.remove('rpShut');
        },
        true,
      );
    // thMap wird auch von go() und nav() aufgerufen (Erweiterungen unterhalb dieses Moduls)
    window.thMap = thMap;
    const mo = new MutationObserver(() => thMap());
    ['tbar', 'tabs', 'anbar', 'vc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { childList: true, subtree: true });
    });
    thMap();
    /* Ausklapp-Fenster über dem jeweiligen Knopf platzieren */
    const fly = { lyp: 'bg', vwp: 'bv', lc: 'bl' };
    function place(id) {
      const el = document.getElementById(id),
        btn = document.getElementById(fly[id]),
        mid = document.getElementById('mid'),
        vc = document.getElementById('vc');
      if (
        !el ||
        !btn ||
        !mid ||
        !vc ||
        el.style.display === 'none' ||
        (!el.style.display && getComputedStyle(el).display === 'none')
      )
        return;
      if (window.innerWidth <= 800) return;
      const mr = mid.getBoundingClientRect(),
        br = btn.getBoundingClientRect(),
        vr = vc.getBoundingClientRect(),
        w = el.offsetWidth || 300;
      let x = br.left + br.width / 2 - w / 2 - mr.left;
      x = Math.max(8, Math.min(mr.width - w - 8, x));
      el.style.left = x + 'px';
      el.style.right = 'auto';
      el.style.bottom = mr.bottom - vr.top + 12 + 'px';
    }
    Object.keys(fly).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(() => place(id)).observe(el, { attributes: true, attributeFilter: ['style'] });
      new MutationObserver(() => place(id)).observe(el, { childList: true });
    });
    window.addEventListener('resize', () => Object.keys(fly).forEach(place));
  })();
})();
// go(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js
// nav(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js

// ---- Datenebenen (vorher in einer IIFE gekapselt)
/* v251: Datenebenen im Reiter Kontext – geordnete Liste aller geladenen Daten (Name, 2D/3D, Quelle, Lizenz, Anzahl, Ladedatum, Sichtbarkeit).
   Registry DAT: neue Datenebene = ein Eintrag. Lesend: nutzt GEO.rep (Ladeprotokoll), CG/TKAT/TERR/ALQ/WMSK (Quellen), LY (Sichtbarkeit). */
const datCss = document.createElement('style');
datCss.id = 'datCss';
datCss.textContent = `
.dat{margin:0 0 6px}
.dat .zdsum{color:var(--mu);font-size:11px;margin:0 0 8px}
.dat .dseg{display:flex;gap:2px;margin:2px 0 8px;padding:3px;border-radius:13px;background:#1d1d1b0f}
.dat .dseg button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--g7,var(--mu));font:inherit;font-size:12px;font-weight:500;cursor:pointer;min-width:0;transition:background .3s,color .3s,flex .35s cubic-bezier(.2,.8,.2,1)}
.dat .dseg button.on{flex:2.2;border-color:transparent;background:#fff;color:var(--pa5,var(--tx));font-weight:600;box-shadow:0 2px 8px #1d1d1b1a}
.dat .dseg button span{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:max-width .35s,opacity .25s}
.dat .dseg button.on span{max-width:170px;opacity:1}
.dat .dseg button svg{flex:none}
.dat .dsegn{font-size:11px;color:var(--mu);margin:0 0 6px 2px}
.dat details.zdg,.dat details.zdsg{padding:0}
.dat details.zdg{margin:0 0 6px}
.dat details.zdg>summary,.dat details.zdsg>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:7px;user-select:none}
.dat details.zdg>summary::-webkit-details-marker,.dat details.zdsg>summary::-webkit-details-marker{display:none}
.dat details.zdg>summary::before,.dat details.zdsg>summary::before{content:'';width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg);transition:transform .15s;flex:none;margin:0 2px 1px 1px}
.dat details.zdg[open]>summary::before,.dat details.zdsg[open]>summary::before{transform:rotate(45deg)}
.dat details.zdg>summary{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--tx);padding:9px 0 6px;border-bottom:1px solid var(--ln);margin-bottom:6px}
.dat details.zdsg{margin:0 0 3px 2px}
.dat details.zdsg>summary{font-size:12px;font-weight:600;color:var(--mu);padding:6px 2px;letter-spacing:0;text-transform:none}
.dat details.zdsg>summary:hover,.dat details.zdsg[open]>summary:hover{color:var(--tx)}
.dat details.zdsg>summary .zdc{opacity:.75}
.dat summary .zdc{margin-left:auto;font-style:normal;font-weight:400;font-size:10.5px;letter-spacing:0;text-transform:none;color:var(--mu);white-space:nowrap}
.dat .zdsb{padding:2px 0 4px 6px}
.dat .zdr{border:1px solid var(--ln);border-radius:9px;margin:0 0 5px;background:var(--pn);overflow:hidden}
.dat .zdr.off{opacity:.55}
.dat .zdm{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center;padding:6px 8px}
.dat .zdn{font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;min-width:0}
.dat .zdn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dat .zdt{font-size:9.5px;font-weight:700;border:1px solid var(--ln);border-radius:5px;padding:0 5px;color:var(--mu);letter-spacing:.04em}
.dat .zdt.d3{color:#2f6f4f;border-color:#2f6f4f55}
.dat .zdth{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--pa5,var(--g7,#5a5e65));background:linear-gradient(135deg,var(--pa1,#f4f4f4),var(--pa2,#ececec));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pa4,#aaa) 40%,transparent);flex:none}
.dat .zdr.off .zdth{background:#1d1d1b0a;color:var(--g5,#8c9096);box-shadow:inset 0 0 0 1px var(--ln)}
.dat .zdth{border:0;padding:0;margin:0;font:inherit;transition:background .15s,box-shadow .15s,color .15s,transform .1s}
.dat button.zdtg{cursor:pointer}
.dat button.zdtg.on{background:linear-gradient(135deg,var(--pa2,#ececec),var(--pa3,#dcdcdc));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--pa4,#888) 75%,transparent)}
.dat button.zdtg:not(.on){background:#1d1d1b0a;color:var(--g5,#8c9096);box-shadow:inset 0 0 0 1px var(--ln)}
.dat button.zdtg:hover{filter:brightness(.96)}.dat button.zdtg:active{transform:scale(.94)}
.dat button.zdtg:focus-visible{outline:2px solid var(--pa4,#888);outline-offset:1px}
.dat .zdq{grid-column:1/4;font-size:11px;color:var(--mu);line-height:1.35}
.dat .zdl{display:inline-block;min-width:34px;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--g5,#8c9096)}
.dat .zdq b{color:var(--tx);font-weight:600}
.dat details{padding:0 8px 2px}
.dat .zds{font-style:normal;color:var(--ln);margin:0 2px}
.dat details>summary{font-size:10.5px;color:var(--mu);padding:4px 0}
.dat details .kv{font-size:11px}
.dat details .kv b{font-weight:500;text-align:right;word-break:break-word}
.dat .zdp{font-size:11px;color:var(--wa);margin:2px 0 6px}
.dat .zdbt{margin-top:6px;width:100%}
.dat i.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#bbb;flex:none}
.dat i.dot.ok{background:#3c9a62}.dat i.dot.fb{background:#e0a030}.dat i.dot.fail{background:#c0504d}
`;
document.head.appendChild(datCss);
const datIC = {
  terrain: '<path d="M3 18l6-9 4 5 3-4 5 8z"/><path d="M3 18h18"/>',
  buildings: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  trees: '<circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 21h6"/>',
  parcels:
    '<path d="M4 6l9-2 7 4-2 11-10 1z"/><path d="M4 6l7 5 7-3M11 11l-1 9" stroke-dasharray="2.5 2.5"/>',
  wms: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 14l5-4 4 3 7-5M9 4v16" stroke-dasharray="2.5 2.5"/>',
  bplan: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  roads: '<path d="M4 20C4 12 12 14 12 8S18 4 20 4"/><path d="M8 20c0-5 6-4 6-10" stroke-dasharray="2 2.5"/>',
  paths:
    '<path d="M5 20c2-6 5-4 7-9s3-6 7-7" stroke-dasharray="1 3"/><circle cx="5" cy="20" r="1"/><circle cx="19" cy="4" r="1"/>',
  cycle:
    '<circle cx="6.5" cy="16" r="3.5"/><circle cx="17.5" cy="16" r="3.5"/><path d="M6.5 16l4-8h5l2 8M10 8H8"/>',
  green: '<path d="M12 21V11M12 11C8 11 6 8 6 4c4 0 6 2 6 7zM12 14c3 0 6-2 6-6-4 0-6 2-6 6z"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.500 6-11 6-11z"/>',
  abst: '<path d="M4 20V10l5-4v14M20 20V10l-5-4v14"/><path d="M4 20h16M9 15h6M9 15l1.500-1.500M9 15l1.500 1.500M15 15l-1.500-1.500M15 15l-1.500 1.500"/>',
  pb: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/>',
  pa: '<path d="M4 17l3-10 10-2 3 9-8 6z"/>',
  ex: '<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>',
};
datIC.clc = '<path d="M4 6h7v6H4zM13 4h7v8h-7zM4 14h5v6H4zM11 14h9v6h-9z"/>';
datIC.ffh = datIC.nsg = '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z"/><path d="M5 19c3-4 6-6 9-8"/>';
datIC.vsg = datIC.nsg;
datIC.hq = '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 14c3-3 6 3 9 0s6 3 9 0M3 19c3-3 6 3 9 0s6 3 9 0"/>';
const datSv = (p) =>
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  (p || '') +
  '</svg>';

/* Datenstand: Last-Modified-Angaben der Server (CORS-sicher lesbar) je Host merken – nur Lesen, die Anfrage bleibt unverändert */
const datLM = {};
{
  const _f = window.fetch;
  if (typeof _f === 'function' && !_f.__lm) {
    const w = function () {
      const p = _f.apply(this, arguments);
      try {
        const u = String((arguments[0] && arguments[0].url) || arguments[0] || '');
        p.then(
          (r) => {
            try {
              const lm = r && r.headers && r.headers.get('last-modified');
              if (!lm) return;
              const t = Date.parse(lm);
              if (!(t > 0)) return;
              const d = decodeURIComponent(u),
                m = [...d.matchAll(/https?:\/\/([^\/?#&]+)/g)];
              const h = (m.length ? m[m.length - 1][1] : '').toLowerCase();
              if (h && (!datLM[h] || t > datLM[h])) datLM[h] = t;
            } catch (e) {
              logErr(e, 'w>anonym');
            }
          },
          () => {},
        );
      } catch (e) {
        logErr(e, 'w');
      }
      return p;
    };
    w.__lm = 1;
    window.fetch = w;
  }
}
const datHostOf = (u) => {
  const m = String(u || '').match(/https?:\/\/([^\/?#]+)/);
  return m ? m[1].toLowerCase() : u ? String(u).toLowerCase() : '';
};
const datStdOf = (hs) => {
  let best = 0;
  (hs || []).forEach((u) => {
    if (!u) return;
    const h = datHostOf(u);
    for (const k in datLM)
      if (k === h || (h.length > 3 && k.indexOf(h) >= 0) || (!/\./.test(h) && k.indexOf(h) >= 0))
        best = Math.max(best, datLM[k]);
  });
  return best;
};
const datProvOf = (l) => {
  const t = String(l || '')
    .replace(/©/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = t.match(/^(.*?),\s*((?:dl-de|CC|ODbL|Datenlizenz|Open).*)$/i);
  return m ? { p: m[1].trim(), l: m[2].trim() } : { p: t, l: '' };
};
const DATO = {};
const datFmt = (t) => {
  try {
    return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (_) {
    return '';
  }
};
const datLy = (k) => LY.findIndex((l) => l[1] === k);
const OSMQ = 'Vektorkacheln (Straßen, Wege, Grün, Wasser)';
const datRp = () => GEO.rep || null;
const datStand = () => {
  const r = datRp();
  return r && r.t ? 'geladen ' + datFmt(r.t) : '';
};
const datRkey = () => {
  const r = datRp();
  return (r && r.key) || '';
};
/* Registry: g = Gruppe, k = Layer-Schlüssel (oder null), n = Name, d = '2D'|'3D', f = Funktion → {st, src, lic, n, info:[[Label,Wert]…], probs:[]} oder null (nicht anzeigen) */
const DAT = [
  {
    g: 'geo',
    k: 'terrain',
    n: 'Gelände / Höhenmodell',
    d: '3D',
    f() {
      const r = datRp(),
        R = r && r.ge,
        K = datRkey(),
        t = TERR[K];
      if (!S.geo) return { st: 'demo', src: 'Demo-Gelände (künstlich)', n: '', info: [] };
      return {
        st: R ? R.st : 'unk',
        src: R ? R.head : GEO.dgm ? 'Höhenmodell' : 'MapTiler Terrain-RGB',
        lic: (t && t.src) || (R && R.st === 'fb' ? '© MapTiler' : ''),
        hs: [t && t.dgm && (t.dgm.u === 'tile' ? t.dgm.tile('1', '1')[0] : t.dgm.u), 'api.maptiler.com'],
        n: GEO.N ? GEO.N + ' × ' + GEO.N + ' Raster' : '',
        info: [
          ['Meldung', GEO.terrMsg || ''],
          ['DGM1', t && t.dgm ? (t.dgm.u === 'tile' ? 'Kacheln' : String(t.dgm.u)) : ''],
          ['DOM1', t && t.dom ? (t.dom.u === 'tile' ? 'Kacheln' : String(t.dom.u)) : ''],
        ],
        probs: R ? R.probs : [],
      };
    },
  },
  {
    g: 'geo',
    k: 'buildings',
    n: 'Gebäude (Umgebung)',
    d: '3D',
    f() {
      const r = datRp(),
        R = r && r.gb,
        K = datRkey(),
        c = CG[K];
      if (!S.geo) return { st: 'demo', src: 'Demo-Gebäude', n: '', info: [] };
      return {
        st: R ? R.st : 'unk',
        src: R ? R.head : 'MapTiler/OSM-Gebäude',
        lic: (c && c.src) || '',
        hs: [c && c.tile('1', '1')[0], typeof LOD2 !== 'undefined' && LOD2.url],
        n: R && R.n != null ? R.n + ' Gebäude' : GEO.blist ? GEO.blist.length + ' Gebäude' : '',
        info: [
          ['Datensatz', c ? 'LoD2-CityGML ' + c.name : ''],
          ['Meldung', R ? R.msg : ''],
        ],
        probs: R ? R.probs : [],
      };
    },
  },
  {
    g: 'geo',
    k: 'trees',
    n: 'Bäume',
    d: '3D',
    f() {
      const r = datRp(),
        R = r && r.tr,
        K = datRkey(),
        t = TKAT[K];
      if (!S.geo) return { st: 'demo', src: 'Demo-Bäume', n: '', info: [] };
      return {
        st: R ? R.st : 'unk',
        src: R ? R.head : '',
        lic: (t && t.src) || (R && /OSM/.test(R.head) ? '© OpenStreetMap-Mitwirkende, ODbL' : ''),
        sh: t ? '' : 'OpenStreetMap',
        hs: [t && t.u, 'overpass'],
        n: GEO.trees ? GEO.trees.length + ' Bäume' : '',
        info: [
          ['Baumkataster', t ? t.name : 'kein amtliches Kataster hinterlegt'],
          ['Meldung', GEO.treeMsg || ''],
        ],
        probs: R ? R.probs : [],
      };
    },
  },
  {
    g: 'geo',
    k: 'parcels',
    n: 'Flurstücke',
    d: '2D',
    f() {
      const r = datRp(),
        R = r && r.fl,
        K = datRkey();
      if (!S.geo) return { st: 'demo', src: 'Demo-Flurstücke', n: '', info: [] };
      return {
        st: R ? R.st : 'unk',
        src: R ? R.head : '',
        lic: ALQ[K] || '',
        hs: [ALS[K] && ALS[K][0] && ALS[K][0].u],
        n: AL.length ? AL.length + ' Flurstücke' : '',
        info: [
          ['Bundesland', GEO.alkBL || ''],
          ['Meldung', GEO.alkMsg || ''],
        ],
        probs: R ? R.probs : [],
      };
    },
  },
  {
    g: 'geo',
    k: 'wms',
    n: 'Flurkarte (Bild)',
    d: '2D',
    f() {
      if (!S.geo) return null;
      const K = datRkey(),
        w = WMSK[K];
      return {
        st: GEO.wmsImg ? 'ok' : 'none',
        src: GEO.wmsImg && w ? w.name : 'nicht geladen',
        lic: (w && w.src) || '',
        hs: [w && w.u],
        n: '',
        info: [['Meldung', GEO.wmsMsg || '']],
        probs: [],
      };
    },
  },
  {
    g: 'geo',
    k: 'bplan',
    n: 'Bebauungspläne',
    d: '2D',
    f() {
      if (!S.geo) return null;
      return {
        st: BPL.length ? 'ok' : 'none',
        src: BPL.length ? 'Bebauungsplan-Dienst (WFS)' : 'nicht geladen',
        lic: '',
        n: BPL.length ? BPL.length + ' Pläne' : '',
        info: [['Meldung', GEO.bpMsg || '']],
        probs: [],
      };
    },
  },
  {
    g: 'geo',
    k: 'clc',
    n: 'Flächennutzung (CORINE)',
    d: '2D',
    f() {
      return ovInfo('clc');
    },
  },
  {
    g: 'geo',
    k: 'nsg',
    n: 'Naturschutzgebiete',
    d: '2D',
    f() {
      return ovInfo('nsg');
    },
  },
  {
    g: 'geo',
    k: 'ffh',
    n: 'FFH-Gebiete (Natura 2000)',
    d: '2D',
    f() {
      return ovInfo('ffh');
    },
  },
  {
    g: 'geo',
    k: 'vsg',
    n: 'Vogelschutzgebiete (Natura 2000)',
    d: '2D',
    f() {
      return ovInfo('vsg');
    },
  },
  {
    g: 'geo',
    k: 'hq',
    n: 'Überschwemmungsrisiko (Fluss)',
    d: '2D',
    f() {
      return ovInfo('hq');
    },
  },
  {
    g: 'geo',
    k: 'roads',
    n: 'Straßen',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.line.roads.length, ' Abschnitte');
    },
  },
  {
    g: 'geo',
    k: 'paths',
    n: 'Gehwege',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.line.paths.length + a.fill.paths.length, ' Objekte');
    },
  },
  {
    g: 'geo',
    k: 'cycle',
    n: 'Radwege',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.line.cycle.length, ' Abschnitte');
    },
  },
  {
    g: 'geo',
    k: 'rail',
    n: 'Bahngleise',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.line.rail && a.line.rail.length, ' Abschnitte');
    },
  },
  {
    g: 'geo',
    k: 'green',
    n: 'Grünflächen',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.fill.green.length, ' Flächen');
    },
  },
  {
    g: 'geo',
    k: 'water',
    n: 'Gewässer',
    d: '2D',
    f() {
      const a = GEO.acc;
      return datOsmRow(a && a.fill.water.length + a.line.water.length, ' Objekte');
    },
  },
  {
    g: 'pl',
    k: 'abst',
    n: 'Abstandsflächen',
    d: '3D',
    f() {
      return {
        st: 'calc',
        src: 'berechnet aus der Planung',
        lic: '',
        own: 'maad (berechnet)',
        n: '',
        info: [],
        probs: [],
      };
    },
  },
  {
    g: 'pl',
    k: null,
    ic: 'pb',
    n: 'Planungsgebäude',
    d: '3D',
    f() {
      return {
        st: 'own',
        src: 'eigene Eingabe',
        lic: '',
        own: 'eigene Eingabe',
        n: S.bld.length + ' Gebäude',
        info: [],
        probs: [],
      };
    },
  },
  {
    g: 'pl',
    k: null,
    ic: 'pa',
    n: 'Planungsflächen',
    d: '2D',
    f() {
      return {
        st: 'own',
        src: 'eigene Eingabe',
        lic: '',
        own: 'eigene Eingabe',
        n: (S.areas ? S.areas.length : 0) + ' Flächen',
        info: [],
        probs: [],
      };
    },
  },
  {
    g: 'pl',
    k: null,
    ic: 'ex',
    n: 'Bestandsgebäude',
    d: '3D',
    f() {
      return S.ex && S.ex.length
        ? {
            st: 'own',
            src:
              S.ex
                .map((x) => x.src)
                .filter((v, i, a) => v && a.indexOf(v) === i)
                .join(', ') || 'eigene Eingabe',
            lic: '',
            own: 'Bestand (eigene/geladene Daten)',
            n: S.ex.length + ' Gebäude',
            info: [],
            probs: [],
          }
        : null;
    },
  },
];
function datOsmRow(n, unit) {
  if (!S.geo) return { st: 'demo', src: 'Demo-Daten', n: '', info: [], probs: [] };
  return {
    st: n ? 'ok' : 'none',
    src: n ? OSMQ : 'keine Objekte im Ausschnitt',
    lic: '© MapTiler © OpenStreetMap-Mitwirkende, ODbL',
    hs: ['api.maptiler.com'],
    sh: 'MapTiler / OSM',
    n: n ? n + unit : '',
    info: [],
    probs: [],
  };
}
/* Gliederung: Hauptgruppe (g) › Untergruppe (sg) › Ebene. Neue Ebene = Eintrag in DAT + Zuordnung in SGM (Schlüssel k bzw. Icon ic).
   Planung ist für höhere Detaillierung (LOD) vorbereitet: spätere Bauteil-Ebenen (Wände, Geschossdecken, Dächer …) bekommen eine eigene Untergruppe z. B. 'bt' in GS.pl. */
const datGN = { geo: 'Geodaten und Umgebung', pl: 'Planung' };
const SGN = {
  gel: 'Gelände, Gebäude und Bäume',
  gs: 'Grundstücke und Planungsrecht',
  inf: 'Verkehr und Infrastruktur',
  ln: 'Landnutzung',
  gw: 'Grün und Gewässer',
  nat: 'Naturschutz',
  ris: 'Risikogebiete',
  geb: 'Gebäude',
  fl: 'Flächen',
  nw: 'Nachweise',
};
const datGS = { geo: ['gel', 'gs', 'inf', 'ln', 'gw', 'nat', 'ris'], pl: ['geb', 'fl', 'nw'] };
const SGM = {
  terrain: 'gel',
  buildings: 'gel',
  trees: 'gel',
  parcels: 'gs',
  wms: 'gs',
  bplan: 'gs',
  roads: 'inf',
  paths: 'inf',
  cycle: 'inf',
  rail: 'inf',
  clc: 'ln',
  green: 'gw',
  water: 'gw',
  nsg: 'nat',
  ffh: 'nat',
  vsg: 'nat',
  hq: 'ris',
  abst: 'nw',
  pb: 'geb',
  ex: 'geb',
  pa: 'fl',
};
const datSgOf = (e) => e.sg || SGM[e.k || e.ic] || (e.g === 'pl' ? 'geb' : 'gel');
const SGK = { geo: 'Geodaten', pl: 'Planung' };
const SGI = {
  geo: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3.5 3 12.5 0 16M12 4c-3 3.5-3 12.5 0 16"/>',
  pl: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
};
const DSG = { k: 'geo' };
try {
  DSG.k = localStorage.getItem('lot_datseg') || 'geo';
} catch (e) {
  logErr(e, 'init>anonym');
}
function datSeg(k) {
  DSG.k = k;
  try {
    localStorage.setItem('lot_datseg', k);
  } catch (e) {
    logErr(e, 'datSeg');
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'datSeg');
  }
}
const DGO = {};
try {
  Object.assign(DGO, JSON.parse(localStorage.getItem('lot_datg') || '{}'));
} catch (e) {
  logErr(e, 'init>anonym');
}
const datGOpen = (id, def) => (DGO[id] == null ? def : !!DGO[id]);
const datSL = {
  ok: 'geladen',
  fb: 'Fallback aktiv',
  fail: 'nicht geladen',
  unk: 'Quelle unbekannt',
  demo: 'Demo-Daten',
  none: 'nicht geladen',
  calc: 'berechnet',
  own: 'eigene Daten',
};
function dqHtml(r, e) {
  const pv = r.lic ? datProvOf(r.lic) : { p: r.own || '', l: '' },
    sd = datStdOf(r.hs),
    live = ['ok', 'fb'].includes(r.st);
  if (r.st === 'demo') return 'Demo-Daten';
  if (r.st === 'none' || r.st === 'unk') return esc(r.src || 'nicht geladen');
  const q = r.sh || pv.p || r.own || '',
    p = [q, live ? r.n || '' : r.n || '', live ? (sd ? String(new Date(sd).getFullYear()) : '–') : ''].filter(
      Boolean,
    );
  return p.map(esc).join(' <i class="zds">|</i> ');
}
function datDetRows(r) {
  const sd = datStdOf(r.hs),
    ab = datRp() && datRp().t ? datFmt(datRp().t) : '',
    live = ['ok', 'fb'].includes(r.st),
    pv = r.lic ? datProvOf(r.lic) : null;
  let h = '';
  if (r.src && r.st !== 'none') h += kv('Datensatz', esc(r.src));
  if (pv) h += kv('Herausgeber', esc(pv.p)) + (pv.l ? kv('Lizenz', esc(pv.l)) : '');
  if (live) {
    h += kv('Datenstand', sd ? esc(datFmt(sd)) + ' (Angabe des Servers)' : 'nicht vom Dienst mitgeteilt');
    if (ab) h += kv('Abgerufen', esc(ab));
  }
  return h;
}
function datRows() {
  const out = [];
  DAT.forEach((e, j) => {
    let r = null;
    try {
      r = e.f();
    } catch (_) {
      r = { st: 'unk', src: '', info: [], probs: [] };
    }
    if (r) out.push({ e, j, r });
  });
  return out;
}
function datHtml() {
  const rows = datRows(),
    on = rows.filter((o) => ['ok', 'fb', 'calc', 'own'].includes(o.r.st)).length,
    r0 = datRp(),
    dd = r0 && r0.t ? ' · abgerufen ' + datFmt(r0.t) : '';
  let h =
    '<h4>Datenebenen</h4><div class="dat"><div class="zdsum">' +
    (S.geo ? esc((r0 && r0.name) || 'Projekt') + ' · ' : 'Demo-Daten aktiv · ') +
    on +
    ' von ' +
    rows.length +
    ' Ebenen mit Daten' +
    dd +
    '</div>';
  const rowH = ({ e, j, r }) => {
    const i = e.k ? datLy(e.k) : -1,
      has = ['ok', 'fb', 'calc', 'own', 'demo'].includes(r.st),
      dot = r.st === 'demo' || r.st === 'calc' || r.st === 'own' ? 'ok' : r.st === 'none' ? 'fail' : r.st;
    const info = (r.info || []).filter((p) => p[1] && p[0] !== 'Datensatz'),
      dh = datDetRows(r),
      det = dh || info.length || (r.probs && r.probs.length);
    return (
      '<div class="zdr' +
      (has ? '' : ' off') +
      '"><div class="zdm">' +
      (i >= 0
        ? '<button type="button" class="zdth zdtg' +
          (LY[i][2] ? ' on' : '') +
          '" data-i="' +
          i +
          '" aria-pressed="' +
          (LY[i][2] ? 'true' : 'false') +
          '" onclick="datVis(' +
          i +
          ',!LY[' +
          i +
          '][2])" title="' +
          (LY[i][2] ? 'Ebene ausblenden' : 'Ebene einblenden') +
          '">' +
          datSv(datIC[e.ic || e.k]) +
          '</button>'
        : '<div class="zdth">' + datSv(datIC[e.ic || e.k]) + '</div>') +
      '<div class="zdn"><i class="dot ' +
      dot +
      '" title="' +
      esc(datSL[r.st] || '') +
      '"></i><span>' +
      esc(e.n) +
      '</span></div><span class="zdt ' +
      (e.d === '3D' ? 'd3' : '') +
      '">' +
      e.d +
      '</span>' +
      '<div class="zdq">' +
      dqHtml(r, e) +
      '</div></div>' +
      (det
        ? '<details' +
          (DATO[j] ? ' open' : '') +
          ' ontoggle="datTg(' +
          j +
          ',this.open)"><summary>Details</summary>' +
          dh +
          info.map((p) => kv(esc(p[0]), esc(p[1]))).join('') +
          (r.probs && r.probs.length ? '<div class="zdp">' + r.probs.map(esc).join('<br>') + '</div>' : '') +
          '</details>'
        : '') +
      '</div>'
    );
  };
  const gks = ['geo', 'pl'].filter((k) => rows.some((o) => o.e.g === k)),
    gk = gks.includes(DSG.k) ? DSG.k : gks[0];
  h +=
    '<div class="dseg" role="tablist">' +
    gks
      .map(
        (k) =>
          '<button type="button" role="tab" class="' +
          (k === gk ? 'on' : '') +
          '" aria-selected="' +
          (k === gk) +
          '" onclick="datSeg(\'' +
          k +
          '\')" title="' +
          datGN[k] +
          '" aria-label="' +
          datGN[k] +
          '"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          SGI[k] +
          '</svg><span>' +
          SGK[k] +
          '</span></button>',
      )
      .join('') +
    '</div>';
  {
    const rs = rows.filter((o) => o.e.g === gk);
    if (rs.length) {
      const nOn = rs.filter((o) => ['ok', 'fb', 'calc', 'own'].includes(o.r.st)).length;
      h += '<div class="dsegn">' + nOn + ' von ' + rs.length + ' mit Daten</div>';
      const ids = [...datGS[gk]];
      rs.forEach((o) => {
        const q = datSgOf(o.e);
        if (!ids.includes(q)) ids.push(q);
      });
      for (const q of ids) {
        const ss = rs.filter((o) => datSgOf(o.e) === q);
        if (!ss.length) continue;
        const vis = ss.filter((o) => o.e.k && datLy(o.e.k) >= 0 && LY[datLy(o.e.k)][2]).length,
          anyL = ss.some((o) => o.e.k && datLy(o.e.k) >= 0);
        h +=
          '<details class="zdsg"' +
          (datGOpen('s:' + q, false) ? ' open' : '') +
          ' ontoggle="datGt(\'s:' +
          q +
          '\',this.open)"><summary>' +
          esc(SGN[q] || q) +
          '<i class="zdc">' +
          ss.length +
          (ss.length === 1 ? ' Ebene' : ' Ebenen') +
          (anyL ? ' · ' + vis + ' sichtbar' : '') +
          '</i></summary><div class="zdsb">' +
          ss.map(rowH).join('') +
          '</div></details>';
      }
    }
  }
  h +=
    '<button class="sm zdbt" onclick="srcOpen()" title="Quellen je Bundesland testen, ändern und eigene Dateien einbinden">Datenquellen &amp; Einstellungen …</button><div class="zdsum" style="margin:6px 0 0">Testen, Quellen ändern, Optionen, Dateien, CORS-Proxy und Schlüssel.</div></div>';
  return h;
}
function datInfo(k) {
  const e = DAT.find((x) => x.k === k);
  if (!e) return null;
  let r = null;
  try {
    r = e.f();
  } catch (e) {
    logErr(e, 'datInfo');
  }
  if (!r) return null;
  return { n: e.n, d: e.d, st: r.st, line: dqHtml(r, e), det: datDetRows(r), ic: e.ic || e.k };
}
function datTg(j, o) {
  DATO[j] = o;
}
function datCnt() {
  document.querySelectorAll('.dat details.zdsg').forEach((d) => {
    const n = d.querySelectorAll('.zdr').length,
      c = d.querySelectorAll('.zdtg'),
      v = [...c].filter((x) => x.classList.contains('on')).length,
      z = d.querySelector(':scope>summary>.zdc');
    if (z) z.textContent = n + (n === 1 ? ' Ebene' : ' Ebenen') + (c.length ? ' · ' + v + ' sichtbar' : '');
  });
}
function datGt(id, o) {
  DGO[id] = o ? 1 : 0;
  try {
    localStorage.setItem('lot_datg', JSON.stringify(DGO));
  } catch (e) {
    logErr(e, 'datGt');
  }
}
function datVis(i, v) {
  lvis(i, v);
  try {
    lyRender();
  } catch (e) {
    logErr(e, 'datVis');
  }
}

// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
