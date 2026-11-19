// ---- Bearbeiten
function fdEdit(fn) {
  const b = fdB();
  if (!b) return;
  hist();
  fn(b);
  FDS.dirty = 1;
  FDS.ps = '';
  try {
    rr();
  } catch (e) {
    logErr(e, 'fdEdit');
  }
  try {
    zoTick(true);
  } catch (e) {
    logErr(e, 'fdEdit');
  }
}
function fdSetCuts(b, V, cuts) {
  const old = fdFaces(b, V).map((f) => ({ o: f.o, h: f.h, t: f.t, n: f.n, fe: f.fe })),
    d = fdD(b, V.key, true);
  d.cuts = cuts;
  const nf = grFaces(
      V.bs,
      cuts.map((c) => c.slice(0, 4)),
    ),
    par = nf.map((f) => old.findIndex((o) => grInFace(o, f.c[0], f.c[1]))),
    big = new Map();
  par.forEach((pi, i) => {
    if (pi < 0) return;
    const c = big.get(pi);
    if (c == null || nf[i].a > nf[c].a) big.set(pi, i);
  });
  const units = [];
  nf.forEach((f, i) => {
    const o = par[i] >= 0 ? old[par[i]] : null;
    if (!o) return;
    const gr_ = big.get(par[i]) === i,
      n = gr_ ? o.n : '',
      // Tiefe/Art (Loggia usw.) bleibt beim größten Teil, wie der Name
      fe = gr_ && o.fe ? o.fe : null;
    if (o.t !== 'ohne' || n || fe) units.push({ p: [gr2(f.c[0]), gr2(f.c[1])], t: o.t, n, ...(fe || {}) });
  });
  d.units = units;
  if (fdAnsichtLeer(d)) {
    delete b.fd[V.key];
    if (!Object.keys(b.fd).length) delete b.fd;
  }
  V._f = null;
}
/** Ansicht ohne eigene Angaben (keine Linien, Felder, Öffnungen, Gruppen, Raster, Attika-Typ) – darf entfallen. */
const fdAnsichtLeer = (d) =>
  !d.cuts.length &&
  !d.units.length &&
  !(d.oe && d.oe.length) &&
  !(d.gr && d.gr.length) &&
  !d.rs &&
  !d.at &&
  !d.fest;
function fdAttr(b, V, face, patch) {
  const d = fdD(b, V.key, true);
  let u = d.units.find((q) => grInFace(face, q.p[0], q.p[1]));
  if (!u) {
    u = { p: [gr2(face.c[0]), gr2(face.c[1])], t: face.t, n: face.n };
    d.units.push(u);
  }
  Object.assign(u, patch);
  d.units = d.units.filter((q) => q === u || !grInFace(face, q.p[0], q.p[1]));
  if (u.t === 'ohne' && !u.n && !u.d && !u.a) d.units = d.units.filter((q) => q !== u);
  if (fdAnsichtLeer(d)) {
    delete b.fd[V.key];
    if (!Object.keys(b.fd).length) delete b.fd;
  }
  V._f = null;
}
function fdCurV() {
  const b = fdB();
  return b && FDS.vk && FDS.vk !== '*' ? fdVw(b, FDS.vk) : null;
}
function fdSelFaces() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return [];
  const F = fdFaces(b, V);
  return FDS.sel.map((i) => F[i]).filter(Boolean);
}
function fdSetType(k) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  let F = fdSelFaces();
  if (!F.length) {
    const all = fdFaces(b, V);
    if (all.length === 1) {
      F = [all[0]];
      FDS.sel = [0];
    }
  }
  if (!F.length) {
    fdNote('Zuerst ein oder mehrere Felder wählen (Klick, Umschalt = mehrere).');
    return;
  }
  const pts = F.map((f) => [f.c[0], f.c[1]]);
  fdEdit((b) => {
    const V = fdCurV();
    pts.forEach((p) => {
      const fc = fdFaces(b, V).find((f) => grInFace(f, p[0], p[1]));
      if (fc) fdAttr(b, V, fc, { t: k });
    });
  });
}
function fdRename(v) {
  const b = fdB(),
    V = fdCurV(),
    F = fdSelFaces();
  if (!b || !V || F.length !== 1) return;
  const p = [F[0].c[0], F[0].c[1]];
  fdEdit((b) => {
    const V = fdCurV(),
      fc = fdFaces(b, V).find((f) => grInFace(f, p[0], p[1]));
    if (fc) fdAttr(b, V, fc, { n: String(v).trim() });
  });
}
function fdMerge() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  const F = fdFaces(b, V),
    idx = FDS.sel.filter((i) => F[i]);
  if (idx.length < 2) {
    fdNote('Zum Zusammenlegen mindestens zwei benachbarte Felder wählen.');
    return;
  }
  // ── Erweiterung aus 19-fassadendesigner/145-raster.js: Rasterfelder wie in der Gruppe verbinden
  const W = fdRsWahlZellen(b, V);
  if (W) {
    fdRsVerbinden(W);
    return;
  }
  const d = fdD(b, V.key),
    lv = { obj: { cuts: d ? d.cuts : [] }, faces: F, bs: V.bs },
    r = grMergeCalc(lv, idx);
  if (!r.rm) {
    fdNote('Die gewählten Felder grenzen nicht aneinander – nichts zusammengelegt.');
    return;
  }
  const big = idx.map((i) => F[i]).reduce((a, f) => (f.a > a.a ? f : a)),
    at = { t: big.t, n: big.n },
    pt = [big.c[0], big.c[1]];
  fdEdit((b) => {
    const V = fdCurV();
    fdSetCuts(b, V, r.cuts);
    const nf = fdFaces(b, V).find((f) => grInFace(f, pt[0], pt[1]));
    if (nf) {
      fdAttr(b, V, nf, at);
      FDS.sel = [fdFaces(b, V).indexOf(nf)];
    } else FDS.sel = [];
  });
}
function fdDelCut(g) {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  fdEdit((b) => {
    const V = fdCurV(),
      d = fdD(b, V.key);
    if (!d) return;
    fdSetCuts(
      b,
      V,
      d.cuts.filter((c) => c[4] !== g).map((c) => c.slice()),
    );
    FDS.selCut = null;
    FDS.sel = [];
  });
}
function fdClearView() {
  const b = fdB(),
    V = fdCurV();
  if (!b || !V) return;
  fdEdit((b) => {
    if (b.fd) {
      // Öffnungen bleiben erhalten (eigene Liste, siehe 090-oeffnungen.js)
      const d0 = b.fd[V.key] || {},
        oe = d0.oe,
        gr = d0.gr;
      if ((oe && oe.length) || (gr && gr.length))
        b.fd[V.key] = { cuts: [], units: [], oe: oe || [], gr: gr || [] };
      else delete b.fd[V.key];
      if (!Object.keys(b.fd).length) delete b.fd;
    }
    V._f = null;
    FDS.sel = [];
    FDS.selCut = null;
  });
}
function fdNote(t) {
  FDS.note = { t, u: Date.now() + 4500 };
  FDS.dirty = 1;
  setTimeout(() => {
    FDS.dirty = 1;
  }, 4700);
}

// ---- Fenster (schwebend im Hauptfenster)
const fdE = (id) => document.getElementById(id);
// Fassadendesigner unten angedockt (Höhe am oberen Rand ziehen, einklappbar), damit das 3D-Modell sichtbar bleibt.
// Aufbau: Kopf (Gebäude, Ansichten als Reiter, Rückgängig, Einpassen, Einklappen, Schließen) · Werkzeugleiste links
// (Auswählen, Teilen, Öffnung, Gruppe) mit Optionsleiste über der Zeichnung · Inspektor rechts (zeigt, was gewählt ist)
// · Fußleiste (nächster Schritt, Tasten, Kennwerte).
const FDCSS = `#fdDock{position:fixed;left:10px;right:84px;bottom:10px;height:var(--fdH,46vh);min-height:220px;max-height:calc(100vh - 90px);z-index:61;display:none;flex-direction:column;background:var(--bg,#f2f2f2);color:var(--tx,#2b2b2b);border:1px solid var(--ln,#dcdcdc);border-radius:14px;box-shadow:0 -6px 40px #0003;font:13px/1.4 system-ui,"Segoe UI",sans-serif;overflow:hidden;outline:none}
#fdDock.zu{height:46px!important;min-height:0}#fdDock.zu .fm,#fdDock.zu .ff{display:none}
#fdDock *{box-sizing:border-box}
#fdDock .fgr{position:absolute;left:50%;top:0;width:60px;height:8px;margin-left:-30px;cursor:ns-resize;z-index:2}
#fdDock .fgr::after{content:'';position:absolute;left:18px;right:18px;top:3px;height:3px;border-radius:2px;background:#0003}
#fdDock .fh{display:flex;align-items:center;gap:10px;padding:8px 10px 6px;border-bottom:1px solid var(--ln,#dcdcdc);background:var(--pn,#E9EDEF)}
#fdDock .fh b{font-size:14px;letter-spacing:.01em}#fdDock .fh .gr{flex:1}
#fdDock button,#fdDock select,#fdDock input{font:inherit;color:inherit}
#fdDock select,#fdDock input[type=text]{border:1px solid var(--ln,#dcdcdc);border-radius:7px;padding:4px 8px;background:var(--bg,#fff);min-width:0}
#fdDock .ib{width:30px;height:30px;display:grid;place-items:center;border:0;background:transparent;border-radius:8px;cursor:pointer;color:inherit;padding:0}
#fdDock .ib:hover{background:#0000000f}#fdDock .ib:disabled{opacity:.35;cursor:default}
#fdDock .seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:#0000000d;flex-wrap:nowrap;overflow:auto;max-width:60%}
#fdDock .seg button{border:0;background:transparent;border-radius:7px;padding:4px 10px;cursor:pointer;white-space:nowrap;color:var(--mu,#6b7280)}
#fdDock .seg button:hover{color:var(--tx,#222)}#fdDock .seg button.on{background:var(--pn,#fff);color:var(--tx,#222);font-weight:600;box-shadow:0 1px 3px #0002}
#fdDock .fm{flex:1;display:flex;min-height:0}
#fdDock .fw{width:50px;flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-right:1px solid var(--ln,#dcdcdc);background:var(--pn,#E9EDEF)}
#fdDock .fw button{width:38px;height:38px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;cursor:pointer;color:var(--tx,#333)}
#fdDock .fw button:hover{background:#0000000f}#fdDock .fw button.on{background:#5E7F92;color:#fff;box-shadow:0 2px 8px #5E7F9266}
#fdDock .fw hr{width:24px;border:0;border-top:1px solid var(--ln,#dcdcdc);margin:4px 0}
#fdDock .fc{flex:1;position:relative;min-width:0;background:var(--bg,#f2f2f2)}
#fdDock canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#fdDock .fo{position:absolute;left:10px;top:10px;z-index:2;display:flex;gap:8px;align-items:center;padding:5px 6px;border-radius:12px;background:color-mix(in srgb,var(--pn,#fff) 92%,transparent);box-shadow:0 2px 12px #0002;font-size:12px}
#fdDock .fo:empty{display:none}#fdDock .fo button{white-space:nowrap}#fdDock .fo .seg{max-width:none}#fdDock .fo select{max-width:230px}
#fdDock .fs{width:300px;flex:none;background:var(--pn,#E9EDEF);border-left:1px solid var(--ln,#dcdcdc);overflow:auto;padding:10px 12px}
#fdDock h4{margin:14px 0 6px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mu,#7a7a7a);font-weight:600}#fdDock h4:first-child{margin-top:0}
#fdDock .ff{display:flex;align-items:center;gap:12px;padding:5px 12px;border-top:1px solid var(--ln,#dcdcdc);font-size:11.5px;color:var(--mu,#7a7a7a);background:var(--pn,#E9EDEF)}
#fdDock .ff span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fdDock kbd{font:inherit;font-size:10.5px;padding:0 4px;border:1px solid var(--ln,#ccc);border-bottom-width:2px;border-radius:4px;background:var(--bg,#fff);color:var(--tx,#333)}
#fdDock .bt{border:1px solid var(--ln,#dcdcdc);background:var(--bg,#fff);border-radius:8px;padding:5px 10px;cursor:pointer}
#fdDock .bt:hover{border-color:#5E7F92}#fdDock .bt.pri{background:#5E7F92;border-color:#5E7F92;color:#fff}
#fdDock .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
#fdDock .fe{display:flex;gap:6px;align-items:center;margin:4px 0}#fdDock .fe input[type=color]{width:28px;height:26px;padding:0;border:1px solid var(--ln,#dcdcdc);border-radius:6px;background:none}
#fdDock .kv{display:grid;grid-template-columns:1fr auto;gap:5px 10px;align-items:center}
#fdDock .kv>span{color:var(--mu,#6b7280)}#fdDock .kv>b{font-weight:600;text-align:right}
#fdDock .fz{display:flex;align-items:center;border:1px solid var(--ln,#dcdcdc);border-radius:7px;background:var(--bg,#fff);padding:0 7px 0 0;width:110px}
#fdDock .fz:focus-within{border-color:#5E7F92;box-shadow:0 0 0 3px #5E7F9233}
#fdDock .fz input{border:0;background:transparent;width:100%;padding:4px 4px 4px 8px;text-align:right;outline:none}
#fdDock .fz span{color:var(--mu,#7a7a7a);font-size:11.5px}
#fdDock .sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px}
#fdDock .sw{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:9px;cursor:pointer;border:1px solid transparent;font-size:10.5px;line-height:1.15;text-align:center;min-width:0}
#fdDock .sw span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;max-width:100%}
#fdDock .sw i{width:34px;height:26px;border-radius:6px;box-shadow:inset 0 0 0 1px #0002}
#fdDock .sw:hover{background:#0000000a}#fdDock .sw.on{border-color:#5E7F92;background:#5E7F921f}
#fdDock .li{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px;cursor:pointer}
#fdDock .li:hover{background:#0000000a}#fdDock .li.on{background:#5E7F9226}
#fdDock .li span{flex:1;min-width:0;line-height:1.25}#fdDock .li small{display:block;color:var(--mu,#7a7a7a);font-size:11px}#fdDock .li svg{flex:none}
#fdDock .mu{color:var(--mu,#7a7a7a);font-size:11.5px}
#fdDock .leer{padding:10px;border:1px dashed var(--ln,#ccc);border-radius:10px;color:var(--mu,#7a7a7a);font-size:12px;line-height:1.45}`;
// Symbole (Linien, 20 × 20)
const FDI = {
  sel: '<path d="M5 3l11 6-4.6 1.3L9.6 15z"/>',
  teil: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M10 2.5v15" stroke-dasharray="2 2"/>',
  oe: '<rect x="4" y="3" width="12" height="14" rx="1"/><path d="M10 3v14M4 10h12"/>',
  gr: '<rect x="2.5" y="4" width="15" height="12" rx="1" stroke-dasharray="2.5 2"/><rect x="5" y="7" width="4" height="6"/><rect x="11" y="7" width="4" height="6"/>',
  undo: '<path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 010 9H9"/>',
  fit: '<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/>',
  zu: '<path d="M5 8l5 5 5-5"/>',
  auf: '<path d="M5 12l5-5 5 5"/>',
  x: '<path d="M5 5l10 10M15 5L5 15"/>',
};
const fdIcon = (k) =>
  `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${FDI[k]}</svg>`;
function fdBody() {
  const wz = (id, t, k, tt) =>
    `<button id="${id}" onclick="fdTool('${t}')" title="${tt}">${fdIcon(k)}</button>`;
  return `<div class="fgr" id="fdGr" title="Höhe ziehen"></div><div class="fh" id="fdHd"><b>Fassade</b><select id="fdBld" onchange="fdPick(this.value)" title="Gebäude"></select>
<div class="seg" id="fdVs"></div><span class="gr"></span>
<button class="ib" onclick="fdUndo()" title="Rückgängig (Strg+Z)">${fdIcon('undo')}</button><button class="ib" onclick="fdFit()" title="Ansicht einpassen (F)">${fdIcon('fit')}</button><button class="ib" id="fdZu" onclick="fdEinklappen()" title="Einklappen">${fdIcon('zu')}</button><button class="ib" onclick="fdClose()" title="Schließen">${fdIcon('x')}</button></div>
<div class="fm"><div class="fw">${wz('fdTs', 'sel', 'sel', 'Auswählen (V) – Felder, Linien, Öffnungen, Gruppen; ziehen zum Verschieben')}${wz('fdTt', 'teil', 'teil', 'Teilen (T) – senkrecht oder waagerecht wie in der Gruppe')}<hr>${wz('fdTo', 'oe', 'oe', 'Öffnung (O) – Fenster oder Tür setzen')}${wz('fdTu', 'gr', 'gr', 'Gruppe (G) – Öffnungsgruppe setzen oder Felder füllen')}</div>
<div class="fc" id="fdCw"><canvas id="fdCv"></canvas><div class="fo" id="fdOpt"></div></div><div class="fs" id="fdPn"></div></div>
<div class="ff"><span id="fdHint"></span><span id="fdInfo"></span></div>`;
}
function fdOpen(bid, vk, idx) {
  const b = bid ? S.bld.find((x) => x.id === bid) : S.sel && !S.sel.ex ? S.sel : S.bld.find((x) => !x.ex);
  if (!b || b.ex) {
    try {
      $('hud').textContent = 'Fassadendesigner: zuerst ein Gebäude anlegen oder auswählen';
    } catch (e) {
      logErr(e, 'fdOpen');
    }
    return false;
  }
  const V = fdViews(b);
  if (!V.length) {
    try {
      $('hud').textContent = 'Fassadendesigner: Gebäude hat keine Außenwände über Erdreich';
    } catch (e) {
      logErr(e, 'fdOpen');
    }
    return false;
  }
  if (!document.getElementById('fdCss')) {
    const s = document.createElement('style');
    s.id = 'fdCss';
    s.textContent = FDCSS;
    document.head.appendChild(s);
  }
  let d = fdE('fdDock');
  if (!d) {
    d = document.createElement('div');
    d.id = 'fdDock';
    d.tabIndex = 0;
    document.body.appendChild(d);
    d.innerHTML = fdBody();
    fdInit();
  }
  FDS.bid = b.id;
  FDS.sel = [];
  FDS.selCut = null;
  FDS.pts = [];
  FDS.rect = null;
  const want =
    vk && V.some((v) => v.key === vk)
      ? vk
      : V.some((v) => v.key === FDS.vk) && FDS.bid === b.id
        ? FDS.vk
        : V[0].key;
  FDS.vk = want;
  if (idx != null && idx > 0) {
    FDS.sel = [idx - 1];
  }
  d.style.display = 'flex';
  FDS.open = true;
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
  fdFit();
  try {
    d.focus();
  } catch (e) {
    logErr(e, 'fdOpen');
  }
  return true;
}
function fdClose() {
  const d = fdE('fdDock');
  if (d) d.style.display = 'none';
  FDS.open = false;
  FDS.pts = [];
  FDS.rect = null;
}
function fdUndo() {
  undo();
  FDS.sel = [];
  FDS.selCut = null;
  FDS.oe = null;
  FDS.gi = null;
  FDS.ps = '';
  FDS.dirty = 1;
}
/** Angedockten Bereich ein-/ausklappen (nur Kopfzeile sichtbar). */
function fdEinklappen() {
  const d = fdE('fdDock'),
    b = fdE('fdZu');
  if (!d) return;
  const zu = d.classList.toggle('zu');
  if (b) {
    b.innerHTML = fdIcon(zu ? 'auf' : 'zu');
    b.title = zu ? 'Aufklappen' : 'Einklappen';
  }
  FDS.dirty = 1;
}
/**
 * Kompaktes Zahlenfeld mit Einheit (Komma erlaubt; Pfeiltasten ändern um schritt, mit Umschalt × 10).
 * @param {string} aufruf  Ausdruck für onchange, z. B. "oeAendern('x',this.value)"
 */
function fdZahl(v, einheit, aufruf, schritt = 0.01, tt = '') {
  const s = String(+(+v).toFixed(3)).replace('.', ',');
  return `<label class="fz" ${tt ? `title="${tt}"` : ''}><input type="text" inputmode="decimal" value="${s}" data-schritt="${schritt}" onchange="${aufruf}" onkeydown="fdZahlKey(event)"><span>${einheit}</span></label>`;
}
function fdZahlKey(e) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
    if (e.key === 'Enter') e.target.blur();
    return;
  }
  e.preventDefault();
  const el = e.target,
    st = (+el.dataset.schritt || 0.01) * (e.shiftKey ? 10 : 1),
    v = +String(el.value).replace(',', '.') || 0,
    n = Math.round((v + (e.key === 'ArrowUp' ? st : -st)) * 1000) / 1000;
  el.value = String(n).replace('.', ',');
  el.dispatchEvent(new Event('change'));
}
function fdPick(id) {
  FDS.bid = id;
  const b = fdB();
  const V = b ? fdViews(b) : [];
  FDS.vk = V.length ? V[0].key : null;
  FDS.sel = [];
  FDS.selCut = null;
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
  fdFit();
}
/** Detaillierungsgrad der Ansicht (100 oder 200, Vorgabe 200). */
const fdLod = () => (FDS.lod === 100 ? 100 : 200);
function fdLodSet(k) {
  FDS.lod = k === 100 ? 100 : 200;
  // in LOD 100 gibt es nichts zu setzen: Öffnungs- und Gruppenwerkzeug zurück auf „Auswählen“
  if (FDS.lod === 100 && (FDS.tool === 'oe' || FDS.tool === 'gr')) fdTool('sel');
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
}
function fdTool(t) {
  // „Teilen“ ist ein Werkzeug mit drei Arten (Linie, Rechteck, Geschoss); die zuletzt genutzte bleibt gewählt
  if (t === 'teil') t = FDS.teil || 'rx';
  // Öffnungen und Gruppen setzen braucht die LOD-200-Ansicht
  if (t === 'oe' || t === 'gr') FDS.lod = 200;
  if (t === 'rx' || t === 'ry') FDS.teil = t;
  FDS.rl = null;
  FDS.rvor = null;
  FDS.tool = t;
  FDS.oeVor = null;
  FDS.grVor = null;
  FDS.pts = [];
  FDS.rect = null;
  FDS.dirty = 1;
  FDS.ps = '';
  fdTick(true);
}
function fdView(k) {
  FDS.vk = k;
  FDS.rl = null;
  FDS.sel = [];
  FDS.selCut = null;
  FDS.pts = [];
  FDS.rect = null;
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
  fdFit();
}
function fdDelSel() {
  // ── Erweiterung aus 19-fassadendesigner/090-oeffnungen.js
  if (FDS.rl) {
    // ── Erweiterung aus 19-fassadendesigner/145-raster.js: Teilung an dieser Stelle (sonst ganz) entfernen
    if (FDS.rl.A && FDS.rl.B) fdRsHierEntfernen();
    else fdRsLinieEntfernen();
  } else if (FDS.gi) oegLoeschen();
  else if (FDS.oe) oeLoeschen();
  else if (FDS.selCut != null) fdDelCut(FDS.selCut);
  else fdNote('Zuerst eine Schnittlinie wählen (Werkzeug „Wählen“, auf die Linie klicken).');
}
// Bildschirm ↔ Welt
function fdSize() {
  const cv = fdE('fdCv'),
    cw = fdE('fdCw');
  if (!cv || !cw) return { W: 100, H: 100, dpr: 1 };
  const dpr = window.devicePixelRatio || 1,
    W = cw.clientWidth,
    H = cw.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    FDS.dirty = 1;
  }
  return { W, H, dpr };
}
function fdLayout(b) {
  const V = fdViews(b),
    L = [];
  let ox = 0;
  V.forEach((v) => {
    L.push({ V: v, ox: ox - v.u0 });
    ox += v.u1 - v.u0 + Math.max(3, (v.u1 - v.u0) * 0.12);
  });
  return L;
}
function fdBox(b) {
  // ── Erweiterung aus 19-fassadendesigner/140-fluchten-gelaende.js: das Dach in ganzer Tiefe passt mit ins Bild
  let dach = 0;
  if (b._rp && b._roofH) {
    for (let i = ugN(b); i < b.levels.length; i++) dach += b.levels[i].h;
    dach += b._roofH;
  }
  if (FDS.vk === '*') {
    const L = fdLayout(b);
    let u0 = 1e9,
      u1 = -1e9,
      v0 = 1e9,
      v1 = -1e9;
    L.forEach((l) => {
      u0 = Math.min(u0, l.V.u0 + l.ox);
      u1 = Math.max(u1, l.V.u1 + l.ox);
      v0 = Math.min(v0, l.V.v0);
      v1 = Math.max(v1, l.V.v1, dach);
    });
    return { u0, u1, v0, v1 };
  }
  const V = fdVw(b, FDS.vk);
  return V ? { u0: V.u0, u1: V.u1, v0: V.v0, v1: Math.max(V.v1, dach) } : { u0: 0, u1: 10, v0: 0, v1: 10 };
}
function fdFit() {
  const b = fdB();
  if (!b) return;
  const { W, H } = fdSize(),
    B = fdBox(b),
    w = Math.max(1, B.u1 - B.u0),
    h = Math.max(1, B.v1 - B.v0),
    s = Math.min((W - 90) / w, (H - 90) / h);
  FDS.vw[FDS.vk] = { cx: (B.u0 + B.u1) / 2, cy: (B.v0 + B.v1) / 2, s: Math.max(2, s) };
  FDS.dirty = 1;
}
const fdVP = () => FDS.vw[FDS.vk] || (FDS.vw[FDS.vk] = { cx: 0, cy: 0, s: 20 });
const fdSX = (u) => {
    const p = fdVP(),
      z = fdSize();
    return (u - p.cx) * p.s + z.W / 2;
  },
  fdSY = (v) => {
    const p = fdVP(),
      z = fdSize();
    return z.H / 2 - (v - p.cy) * p.s;
  };
const fdWU = (x) => {
    const p = fdVP(),
      z = fdSize();
    return (x - z.W / 2) / p.s + p.cx;
  },
  fdWV = (y) => {
    const p = fdVP(),
      z = fdSize();
    return (z.H / 2 - y) / p.s + p.cy;
  };
