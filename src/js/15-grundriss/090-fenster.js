// ======================================================================
// ---- Fenster: Grundriss (eigenes Browserfenster; Ersatz: schwebendes Fenster, falls Popups gesperrt sind)
// ======================================================================
const GRCSS = `
.gr.pop{--bg:#f2f2f2;--pn:#E9EDEF;--ln:#dcdcdc;--tx:#2b2b2b;--mu:#7a7a7a;--rd:#5E7F92}
.gr{--gac:#1f6fd1;display:flex;flex-direction:column;width:100%;height:100%;background:var(--bg);color:var(--tx);font:13px/1.4 system-ui,"Segoe UI",sans-serif;box-sizing:border-box}
@media(prefers-color-scheme:dark){.gr.pop{--bg:#1f1f1f;--pn:#2a2a2a;--ln:#444;--tx:#eee;--mu:#aaa;--gac:#6aa8ff}}
.gr *{box-sizing:border-box}.gr button,.gr select,.gr input{font:inherit;color:var(--tx)}
.gr .top{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--pn);border-bottom:1px solid var(--ln);flex-wrap:wrap}
.gr .top b{font-size:14px}.gr .sep{width:1px;height:22px;background:var(--ln);margin:0 4px}.gr .grow{flex:1}
.gr button{border:1px solid var(--ln);background:var(--pn);border-radius:6px;padding:4px 9px;cursor:pointer}.gr button:hover{background:var(--bg)}.gr button.on{background:var(--gac);border-color:var(--gac);color:#fff}
.gr select,.gr input[type=text],.gr input[type=number]{border:1px solid var(--ln);border-radius:5px;padding:3px 6px;background:var(--pn);min-width:0}
.gr .main{flex:1;display:flex;min-height:0}
.gr .lv{width:132px;background:var(--pn);border-right:1px solid var(--ln);overflow:auto;padding:6px;display:flex;flex-direction:column;gap:4px}
.gr .lv button{text-align:left;padding:6px 8px;line-height:1.25}.gr .lv small{display:block;opacity:.75;font-size:10px}
.gr .cvw{flex:1;position:relative;min-width:0;background:var(--bg)}.gr canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
.gr .hint{position:absolute;right:10px;bottom:8px;max-width:60%;font-size:11px;color:var(--mu);pointer-events:none;background:color-mix(in srgb,var(--pn) 80%,transparent);padding:2px 6px;border-radius:5px}
.gr .side{width:380px;background:var(--pn);border-left:1px solid var(--ln);display:flex;flex-direction:column;min-height:0}
.gr .tabs{display:flex;border-bottom:1px solid var(--ln)}.gr .tabs button{flex:1;border:0;border-radius:0;border-bottom:2px solid transparent;background:none}.gr .tabs button.on{color:var(--tx);background:none;border-bottom-color:var(--rd)}
.gr .pnl{flex:1;overflow:auto;padding:10px 12px}.gr h4{margin:10px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mu)}.gr h4:first-child{margin-top:0}
.gr .row{display:flex;align-items:center;gap:6px;margin:3px 0}.gr .row>label{flex:1}.gr .row input[type=color]{width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer}
.gr .u{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:6px;cursor:pointer}.gr .u:hover{background:var(--bg)}.gr .u.on{background:color-mix(in srgb,var(--gac) 18%,transparent);outline:1px solid var(--gac)}
.gr .u i{width:14px;height:14px;border-radius:3px;border:1px solid #0003;flex:none}.gr .u span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gr .u b{font-weight:600}
.gr table{width:100%;border-collapse:collapse}.gr td,.gr th{padding:3px 4px;text-align:right;border-bottom:1px solid var(--ln)}.gr td:first-child,.gr th:first-child{text-align:left}.gr th{font-weight:600;color:var(--mu);font-size:11px}
.gr .chips{display:flex;flex-wrap:wrap;gap:4px}.gr .chip{padding:2px 8px;border-radius:12px;border:1px solid #0003;cursor:pointer;font-size:12px;color:#222}
.gr .fa{display:grid;grid-template-columns:28px minmax(80px,1fr) 88px 58px 46px 24px;gap:4px;align-items:center;margin:3px 0}.gr .fa input[type=color]{width:26px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none}
.gr .fa select,.gr .fa input[type=text],.gr .fa input[type=number]{width:100%;padding:2px 3px}.gr .fa button{padding:0 4px}
.gr .mu{color:var(--mu);font-size:11px}.gr .full{width:100%;margin-top:6px}.gr .dock{display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--pn);border-bottom:1px solid var(--ln);cursor:move;user-select:none}
`;
const grPage = () =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>maad – Grundriss</title><style>html,body{margin:0;height:100%;overflow:hidden}${GRCSS}</style></head><body>${grBody()}</body></html>`;
const GRDOCK =
  '<div class="dock" id="grDk"><b>Grundriss</b><span class="mu">Popups sind hier gesperrt – schwebendes Fenster</span><span style="flex:1"></span><button onclick="GR.popup()" title="Erneut in eigenem Browserfenster öffnen">↗ Eigenes Fenster</button><button onclick="GR.close()">✕</button></div>';
const grBody =
  () => `<div class="gr${GRS.mode === 'win' ? ' pop' : ''}" id="grRoot">${GRS.mode === 'dock' ? GRDOCK : ''}
<div class="top"><b>Grundriss</b><select id="grBld" onchange="GR.pick(this.value)" title="Gebäude"></select><span class="sep"></span>
<button id="grT_sel" onclick="GR.tool('sel')" title="Einheit oder Linie auswählen (V)">Auswahl</button><button id="grT_line" onclick="GR.tool('line')" title="Freie Linie / Linienzug schneiden (L) – Enter, Rechtsklick oder Doppelklick beendet">Linie</button><button id="grT_rect" onclick="GR.tool('rect')" title="Rechteck schneiden (R)">Rechteck</button><span class="sep"></span>
<button onclick="GR.step(1)" title="Geschoss darüber (Bild ↑ / Pfeil ↑)">▲</button><button onclick="GR.step(-1)" title="Geschoss darunter (Bild ↓ / Pfeil ↓)">▼</button><button onclick="GR.fit()" title="Alles zeigen (F)">Alles</button><button id="grT_n" onclick="GR.north()" title="Ausrichtung: Grundriss an der längsten Seite waagerecht ausrichten / wieder nach Norden (N oder Klick auf den Nordpfeil)">⌖ Ausrichten</button><button onclick="GR.undo()" title="Letzte Änderung rückgängig (Strg+Z)">↶ Zurück</button>
<span class="sep"></span><label class="mu">Schnitt in <input id="grSh" type="number" step="0.05" min="0.3" max="3" style="width:60px" onchange="GR.setSh(this.value)"> m</label>
<span class="grow"></span><span id="grInfo" class="mu"></span></div>
<div class="main"><div class="lv" id="grLv"></div><div class="cvw" id="grCw"><canvas id="grCv"></canvas><div class="hint" id="grHint"></div></div>
<div class="side"><div class="tabs" id="grTabs"></div><div class="pnl" id="grPnl"></div></div></div></div>`;
const GRTABS = [
  ['u', 'Einheiten'],
  ['b', 'Bilanz'],
  ['a', 'Anzeige'],
];
const gD = (id) => GRS.doc && GRS.doc.getElementById(id);
function grOpen(bid) {
  const b = bid ? S.bld.find((x) => x.id === bid) : S.sel && !S.sel.ex ? S.sel : S.bld.find((x) => !x.ex);
  if (!b || b.ex) {
    try {
      $('hud').textContent = 'Grundriss: zuerst ein Gebäude anlegen oder auswählen';
    } catch (e) {
      logErr(e, 'grOpen');
    }
    return false;
  }
  if (GRS.bid !== b.id) {
    GRS.bid = b.id;
    GRS.lv = null;
    GRS.sel = null;
    GRS.fit = null;
  }
  if (!b.ub) {
    hist();
    b.ub = 1;
  }
  if (GRS.w && !GRS.w.closed) {
    try {
      GRS.w.focus();
    } catch (e) {
      logErr(e, 'grOpen');
    }
    GRS.dirty = 1;
    grTick(true);
    return true;
  }
  let w = null;
  try {
    w = window.open('', 'lot_grundriss', 'popup=yes,width=1260,height=820,left=60,top=60');
  } catch (e) {
    logErr(e, 'grOpen');
  }
  if (w && w.document && !w.closed) {
    GRS.mode = 'win';
    GRS.w = w;
    GRS.doc = w.document;
    w.document.open();
    w.document.write(grPage());
    w.document.close();
    w.GR = GR;
  } else {
    GRS.mode = 'dock';
    GRS.w = window;
    GRS.doc = document;
    let d = $('grDock');
    if (!d) {
      d = document.createElement('div');
      d.id = 'grDock';
      d.style.cssText =
        'position:fixed;left:70px;top:56px;width:min(1180px,calc(100vw - 90px));height:min(760px,calc(100vh - 80px));z-index:60;resize:both;overflow:hidden;border:1px solid var(--ln);border-radius:10px;box-shadow:0 8px 30px #0005;background:var(--pn);display:flex;flex-direction:column';
      d.innerHTML = '<style>' + GRCSS + '</style>' + grBody();
      document.body.appendChild(d);
      let dr = null;
      const dk = d.querySelector('#grDk');
      dk.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const q = d.getBoundingClientRect();
        dr = { x: e.clientX - q.left, y: e.clientY - q.top };
        dk.setPointerCapture(e.pointerId);
      });
      dk.addEventListener('pointermove', (e) => {
        if (dr) {
          d.style.left = Math.max(0, e.clientX - dr.x) + 'px';
          d.style.top = Math.max(0, e.clientY - dr.y) + 'px';
        }
      });
      dk.addEventListener('pointerup', () => (dr = null));
    }
    d.style.display = 'flex';
  }
  grInit();
  return true;
}
function grInit() {
  const cv = gD('grCv'),
    d = GRS.doc;
  if (!cv) return;
  cv.addEventListener('pointerdown', grDown);
  cv.addEventListener('pointermove', grMove);
  cv.addEventListener('pointerup', grUp);
  cv.addEventListener('pointerleave', () => {
    GRS.cur = null;
    GRS.dirty = 1;
  });
  cv.addEventListener('wheel', grWheel, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  d.addEventListener('keydown', grKey);
  d.addEventListener('keyup', (e) => {
    if (e.code === 'Space') GRS.space = false;
  });
  if (GRS.mode === 'win') {
    GRS.w.addEventListener('pagehide', grClosed);
    GRS.w.addEventListener('beforeunload', grClosed);
  }
  try {
    GRS.ro && GRS.ro.disconnect();
    GRS.ro = new GRS.w.ResizeObserver(() => {
      GRS.dirty = 1;
    });
    GRS.ro.observe(gD('grCw'));
  } catch (_) {
    GRS.w.addEventListener('resize', () => {
      GRS.dirty = 1;
    });
  }
  GRS.tmr && clearInterval(GRS.tmr);
  GRS.tmr = GRS.w.setInterval(() => {
    try {
      grTick();
    } catch (e) {
      console.warn('Grundriss', e);
    }
  }, 120);
  GRS.ps = '';
  GRS.dirty = 1;
  grTool(GRS.tool);
  grTick(true);
  grFit();
}
function grClosed() {
  if (GRS.tmr && GRS.w) {
    try {
      GRS.w.clearInterval(GRS.tmr);
    } catch (e) {
      logErr(e, 'grClosed');
    }
  }
  GRS.tmr = 0;
  GRS.w = null;
  GRS.doc = null;
  GRS.pts = [];
  GRS.rect = null;
  GRS.cur = null;
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'grClosed');
  }
}
function grClose() {
  const m = GRS.mode,
    w = GRS.w;
  if (m === 'win' && w) {
    try {
      w.close();
    } catch (e) {
      logErr(e, 'grClose');
    }
  } else {
    const d = $('grDock');
    if (d) d.remove();
  }
  grClosed();
}
function grPopup() {
  const d = $('grDock');
  if (d) d.remove();
  GRS.w = null;
  GRS.doc = null;
  if (GRS.tmr) {
    try {
      clearInterval(GRS.tmr);
    } catch (e) {
      logErr(e, 'grPopup');
    }
  }
  GRS.tmr = 0;
  grOpen(GRS.bid);
}
// ---- Hauptschleife: hält Fenster und 3D-Körper live mit dem Modell in Einklang
function grTick(force) {
  const us = grUnSig();
  if (force || us !== GRS.us) {
    GRS.us = us;
    try {
      grUnBuild();
    } catch (e) {
      console.warn('Einheitenkörper', e);
    }
  }
  if (!GRS.w || !GRS.doc || (GRS.mode === 'win' && GRS.w.closed)) {
    if (GRS.w && GRS.mode === 'win') grClosed();
    return;
  }
  if (!gD('grCv')) return;
  if (
    GRS.follow &&
    S.sel &&
    !S.sel.ex &&
    S.sel.id !== GRS.bid &&
    S.bld.includes(S.sel) &&
    GRS.sel0 !== S.sel.id
  ) {
    GRS.sel0 = S.sel.id;
    GRS.bid = S.sel.id;
    S.sel.ub = 1;
    GRS.lv = null;
    GRS.sel = null;
    GRS.fit = null;
    GRS.dirty = 1;
  }
  if (S.sel && S.sel.id === GRS.bid) GRS.sel0 = S.sel.id;
  const b = grB();
  let ps = '';
  if (b) {
    grLv(b);
    grAlignSync(b, GRS.fit !== b.id);
    ps =
      grSig(b) +
      '|' +
      GRS.lv +
      '|' +
      JSON.stringify(GRS.sel) +
      JSON.stringify(GRS.msel) +
      '|' +
      GRS.tab +
      '|' +
      JSON.stringify(S.gro) +
      '|' +
      JSON.stringify(S.fa) +
      '|' +
      JSON.stringify(S.uses) +
      '|' +
      S.bld.length +
      S.bld.map((x) => x.id + x.name).join();
  }
  if (ps !== GRS.ps) {
    GRS.ps = ps;
    GRS.dirty = 1;
    grChrome(b);
  }
  if (GRS.dirty) {
    GRS.dirty = 0;
    grDraw();
  }
}
