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
  const old = fdFaces(b, V).map((f) => ({ o: f.o, h: f.h, t: f.t, n: f.n })),
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
    const n = big.get(par[i]) === i ? o.n : '';
    if (o.t !== 'ohne' || n) units.push({ p: [gr2(f.c[0]), gr2(f.c[1])], t: o.t, n });
  });
  d.units = units;
  if (!d.cuts.length && !d.units.length) {
    delete b.fd[V.key];
    if (!Object.keys(b.fd).length) delete b.fd;
  }
  V._f = null;
}
function fdAttr(b, V, face, patch) {
  const d = fdD(b, V.key, true);
  let u = d.units.find((q) => grInFace(face, q.p[0], q.p[1]));
  if (!u) {
    u = { p: [gr2(face.c[0]), gr2(face.c[1])], t: face.t, n: face.n };
    d.units.push(u);
  }
  Object.assign(u, patch);
  d.units = d.units.filter((q) => q === u || !grInFace(face, q.p[0], q.p[1]));
  if (u.t === 'ohne' && !u.n) d.units = d.units.filter((q) => q !== u);
  if (!d.cuts.length && !d.units.length) {
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
      delete b.fd[V.key];
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
const FDCSS = `#fdDock{position:fixed;left:70px;top:56px;width:min(1240px,calc(100vw - 90px));height:min(780px,calc(100vh - 80px));z-index:61;display:none;flex-direction:column;background:var(--bg,#f2f2f2);color:var(--tx,#2b2b2b);border:1px solid var(--ln,#dcdcdc);border-radius:12px;box-shadow:0 18px 60px #0004;font:13px/1.4 system-ui,"Segoe UI",sans-serif;overflow:hidden;outline:none}
#fdDock *{box-sizing:border-box}
#fdDock .fh{display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--pn,#E9EDEF);border-bottom:1px solid var(--ln,#dcdcdc);flex-wrap:wrap;cursor:move}
#fdDock .fh b{font-size:14px}#fdDock .fh .gr{flex:1}
#fdDock button,#fdDock select,#fdDock input[type=text]{font:inherit;color:inherit}
#fdDock button{border:1px solid var(--ln,#dcdcdc);background:var(--pn,#E9EDEF);border-radius:6px;padding:4px 9px;cursor:pointer}
#fdDock button:hover{filter:brightness(.97)}#fdDock button.on{background:#5E7F92;border-color:#5E7F92;color:#fff}
#fdDock select,#fdDock input[type=text]{border:1px solid var(--ln,#dcdcdc);border-radius:5px;padding:3px 6px;background:var(--pn,#E9EDEF);min-width:0}
#fdDock .fm{flex:1;display:flex;min-height:0}
#fdDock .fv{width:150px;background:var(--pn,#E9EDEF);border-right:1px solid var(--ln,#dcdcdc);overflow:auto;padding:6px;display:flex;flex-direction:column;gap:4px}
#fdDock .fv button{text-align:left;line-height:1.25}#fdDock .fv small{display:block;opacity:.7;font-size:10.5px}
#fdDock .fc{flex:1;position:relative;min-width:0;background:var(--bg,#f2f2f2)}
#fdDock canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#fdDock .fhint{position:absolute;right:10px;bottom:8px;max-width:70%;font-size:11px;color:var(--mu,#7a7a7a);pointer-events:none;background:color-mix(in srgb,var(--pn,#E9EDEF) 85%,transparent);padding:2px 6px;border-radius:5px}
#fdDock .fs{width:340px;background:var(--pn,#E9EDEF);border-left:1px solid var(--ln,#dcdcdc);overflow:auto;padding:8px 10px}
#fdDock h4{margin:10px 0 5px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mu,#7a7a7a)}
#fdDock .ft{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:6px;cursor:pointer}
#fdDock .ft:hover{background:#0000000d}#fdDock .ft i{flex:none;width:16px;height:16px;border-radius:4px;box-shadow:inset 0 0 0 1px #0003}
#fdDock .ft span{flex:1;overflow-wrap:anywhere}#fdDock .ft b{font-weight:600;white-space:nowrap}
#fdDock .ft.on{background:#5E7F9233}#fdDock .mu{color:var(--mu,#7a7a7a);font-size:11.5px}
#fdDock .fe{display:flex;gap:5px;align-items:center;margin:3px 0}#fdDock .fe input[type=color]{width:26px;height:24px;padding:0;border:1px solid var(--ln,#dcdcdc);border-radius:4px;background:none}
#fdDock .sum{border-top:1px solid var(--ln,#dcdcdc);margin-top:6px;padding-top:4px;font-weight:600}`;
function fdBody() {
  return `<div class="fh" id="fdHd"><b>Fassadendesigner</b><select id="fdBld" onchange="fdPick(this.value)" title="Gebäude"></select>
<button id="fdTs" onclick="fdTool('sel')" title="Felder und Schnittlinien wählen (V)">Wählen</button><button id="fdTl" onclick="fdTool('line')" title="Linie: Ansichtsfläche trennen – Endpunkte rasten an Rand und Schnittlinien ein (L)">Linie trennen</button><button id="fdTr" onclick="fdTool('rect')" title="Rechteck: Feld herausschneiden, z. B. für Fensterband oder Sockel (R)">Rechteck</button><button id="fdTg" onclick="fdTool('st')" title="Geschoss: Fläche einer Flucht über ein Geschoss direkt wählen – ohne Trennlinie zu zeichnen (G)">Geschoss</button>
<button onclick="fdMerge()" title="Gewählte, aneinandergrenzende Felder zusammenlegen">Zusammenlegen</button><button onclick="fdDelSel()" title="Gewählte Schnittlinie löschen (Entf)">Linie löschen</button><button onclick="fdFit()" title="Ansicht einpassen (F)">⤢</button><button onclick="L2CF.fd()" title="Bauteilkonfigurator für die Außenwand dieses Gebäudes">⚙ Außenwand</button>
<span class="gr"></span><span class="mu" id="fdInfo"></span><button onclick="fdClose()" title="Schließen">✕</button></div>
<div class="fm"><div class="fv" id="fdVs"></div><div class="fc" id="fdCw"><canvas id="fdCv"></canvas><div class="fhint" id="fdHint"></div></div><div class="fs" id="fdPn"></div></div>`;
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
function fdTool(t) {
  FDS.tool = t;
  FDS.pts = [];
  FDS.rect = null;
  FDS.dirty = 1;
  FDS.ps = '';
  fdTick(true);
}
function fdView(k) {
  FDS.vk = k;
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
  if (FDS.selCut != null) fdDelCut(FDS.selCut);
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
      v1 = Math.max(v1, l.V.v1);
    });
    return { u0, u1, v0, v1 };
  }
  const V = fdVw(b, FDS.vk);
  return V ? { u0: V.u0, u1: V.u1, v0: V.v0, v1: V.v1 } : { u0: 0, u1: 10, v0: 0, v1: 10 };
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
