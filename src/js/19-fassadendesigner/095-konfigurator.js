// ======================= KONFIGURATOR: FENSTER UND TÜREN =======================
// Eigenes Fenster (über dem Fassadendesigner): Katalog der Öffnungstypen links, große Ansicht in der Mitte, Eigenschaften
// rechts – bewusst nur das Nötigste (Name, Maße, Brüstung, Rahmenfarbe, Aufteilung). Aufteilung direkt in der Ansicht:
// Pfosten und Riegel ziehen (Flügelbreiten, Oberlicht, Unterlicht). Der Katalog (S.oet) gilt für das ganze Projekt; der
// Fassadendesigner setzt die Typen nur. Reiter „Gruppen“ (Öffnungsgruppen): 098-konfigurator-gruppen.js.

const OK = { open: false, reiter: 'oe', k: null, feld: null, zug: null, hover: null };
const OKCSS = `#okDock{position:fixed;left:110px;top:70px;width:min(1120px,calc(100vw - 140px));height:min(720px,calc(100vh - 100px));z-index:62;display:none;flex-direction:column;background:var(--bg,#f2f2f2);color:var(--tx,#2b2b2b);border:1px solid var(--ln,#dcdcdc);border-radius:12px;box-shadow:0 18px 60px #0004;font:13px/1.4 system-ui,"Segoe UI",sans-serif;overflow:hidden}
#okDock *{box-sizing:border-box}
#okDock .okh{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--pn,#E9EDEF);border-bottom:1px solid var(--ln,#dcdcdc);cursor:move}
#okDock .okh b{font-size:14px}#okDock .okh .gr{flex:1}
#okDock button,#okDock select,#okDock input{font:inherit;color:inherit}
#okDock button{border:1px solid var(--ln,#dcdcdc);background:var(--pn,#E9EDEF);border-radius:6px;padding:4px 9px;cursor:pointer}
#okDock button:hover{filter:brightness(.97)}#okDock button.on{background:#5E7F92;border-color:#5E7F92;color:#fff}
#okDock select,#okDock input[type=text],#okDock input[type=number]{border:1px solid var(--ln,#dcdcdc);border-radius:5px;padding:3px 6px;background:var(--pn,#E9EDEF);min-width:0;width:100%}
#okDock input[type=number]{text-align:right}
#okDock input[type=color]{width:100%;height:26px;padding:0;border:1px solid var(--ln,#dcdcdc);border-radius:4px;background:none}
#okDock .okm{flex:1;display:flex;min-height:0}
#okDock .okl{width:230px;background:var(--pn,#E9EDEF);border-right:1px solid var(--ln,#dcdcdc);overflow:auto;padding:6px}
#okDock .okl h5{margin:8px 4px 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mu,#7a7a7a)}
#okDock .okt{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer}
#okDock .okt:hover{background:#0000000d}#okDock .okt.on{background:#5E7F9233}
#okDock .okt span{flex:1;min-width:0;line-height:1.25}#okDock .okt small{display:block;color:var(--mu,#7a7a7a);font-size:11px}
#okDock .okc{flex:1;position:relative;min-width:0}
#okDock canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#okDock .okhint{position:absolute;left:10px;bottom:8px;right:10px;font-size:11px;color:var(--mu,#7a7a7a);pointer-events:none}
#okDock .okr{width:300px;background:var(--pn,#E9EDEF);border-left:1px solid var(--ln,#dcdcdc);overflow:auto;padding:8px 10px}
#okDock h4{margin:12px 0 5px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mu,#7a7a7a)}#okDock h4:first-child{margin-top:2px}
#okDock .okg{display:grid;grid-template-columns:1fr 104px;gap:4px 8px;align-items:center}
#okDock .okb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
#okDock .mu{color:var(--mu,#7a7a7a);font-size:11.5px}`;

const okE = (id) => document.getElementById(id);
const okTyp = () => S.oet.find((t) => t.k === OK.k) || null;

/** Konfigurator öffnen (Typ k vorwählen, sonst den im Fassadendesigner gewählten; reiter 'oe' oder 'gr'). */
function okOpen(k, reiter) {
  if (!okE('okCss')) {
    const s = document.createElement('style');
    s.id = 'okCss';
    s.textContent = OKCSS;
    document.head.appendChild(s);
  }
  let d = okE('okDock');
  if (!d) {
    d = document.createElement('div');
    d.id = 'okDock';
    d.tabIndex = 0;
    d.innerHTML = `<div class="okh" id="okHd"><b>Konfigurator</b><button id="okRoe" onclick="okReiter('oe')" title="Fenster und Türen anlegen und einteilen">Fenster &amp; Türen</button><button id="okRgr" onclick="okReiter('gr')" title="Öffnungsgruppen: Abschnitte fester Länge mit Öffnungen">Gruppen</button><span class="gr"></span><button onclick="okClose()" title="Schließen">✕</button></div>
<div class="okm"><div class="okl" id="okL"></div><div class="okc" id="okCw"><canvas id="okCv"></canvas><div class="okhint" id="okHint"></div></div><div class="okr" id="okR"></div></div>`;
    document.body.appendChild(d);
    okInit();
  }
  OK.k = k || (S.oet.some((t) => t.k === FDS.oeT) ? FDS.oeT : S.oet[0].k);
  OK.feld = null;
  if (reiter) OK.reiter = reiter;
  if (!OK.g || !oegG(OK.g)) OK.g = FDS.grT && oegG(FDS.grT) ? FDS.grT : S.oeg.length ? S.oeg[0].k : null;
  OK.open = true;
  d.style.display = 'flex';
  okRender();
  try {
    d.focus();
  } catch (e) {
    logErr(e, 'okOpen');
  }
}
function okReiter(r) {
  OK.reiter = r;
  OK.go = null;
  okRender();
}
function okClose() {
  const d = okE('okDock');
  if (d) d.style.display = 'none';
  OK.open = false;
}
function okInit() {
  const cv = okE('okCv'),
    hd = okE('okHd'),
    d = okE('okDock');
  cv.addEventListener('pointerdown', okDown);
  cv.addEventListener('pointermove', okMove);
  cv.addEventListener('pointerup', okUp);
  d.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') {
      if (OK.feld != null) {
        OK.feld = null;
        okRender();
      } else okClose();
      e.preventDefault();
    }
  });
  // Fenster am Kopf verschieben
  let zug = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    const r = d.getBoundingClientRect();
    zug = { x: e.clientX - r.left, y: e.clientY - r.top };
    hd.setPointerCapture(e.pointerId);
  });
  hd.addEventListener('pointermove', (e) => {
    if (!zug) return;
    d.style.left = Math.max(0, e.clientX - zug.x) + 'px';
    d.style.top = Math.max(0, e.clientY - zug.y) + 'px';
  });
  hd.addEventListener('pointerup', () => (zug = null));
  new ResizeObserver(() => OK.open && okZeichnen()).observe(okE('okCw'));
}

// ---- Bearbeiten
/** Ältere Typen: Flügel als Liste anlegen, bevor die Einteilung bearbeitet wird. */
function okSpSicher(T) {
  if (!Array.isArray(T.sp) || !T.sp.length) T.sp = oeSpalten(T).map((c) => ({ ...c }));
  return T.sp;
}
/** Allgemeine Eigenschaft des gewählten Typs ändern. */
function okSet(f, v) {
  const T = okTyp();
  if (!T) return;
  if (f === 'n') T.n = String(v).slice(0, 60) || T.n;
  else if (f === 'a' && OE_ARTEN[v]) {
    T.a = v;
    if (v === 'tu' || v === 'to') T.br = 0;
  } else if (f === 'rf' && /^#[0-9a-f]{6}$/i.test(v)) T.rf = v;
  else if (f === 'olOa' && OE_OEFFNUNG[v]) T.olOa = v;
  else if (f === 'ulFu' && OE_FUELL[v]) T.ulFu = v;
  else {
    const n = +String(v).replace(',', '.'),
      lim = {
        b: [0.3, 8],
        h: [0.3, 6],
        br: [0, 3],
        ol: [0, 1.5],
        ul: [0, 1.5],
        pb: [0.03, 0.2],
        et: [0, 0.4],
        sr0: [0, 6],
        sr1: [0, 6],
      }[f];
    if (!lim || !isFinite(n)) return;
    const w = Math.max(lim[0], Math.min(lim[1], n));
    if (f === 'sr0' || f === 'sr1') {
      T.sr = Array.isArray(T.sr) ? T.sr : [0, 0];
      T.sr[f === 'sr0' ? 0 : 1] = Math.round(w);
    } else T[f] = w;
  }
  oeAktualisieren();
}
/** Breite des Flügels i (m) setzen; der rechte Nachbar (beim letzten der linke) gleicht aus. */
function okBreite(T, i, w) {
  const L = oeAufteilung(T),
    F = L.felder.filter((f) => typeof f.i === 'number'),
    SP = okSpSicher(T);
  if (!isFinite(w) || F.length < 2) return;
  const j = i < F.length - 1 ? i + 1 : i - 1,
    sum = F[i].x1 - F[i].x0 + (F[j].x1 - F[j].x0),
    neu = Math.max(0.15, Math.min(sum - 0.15, w));
  F.forEach((f, k) => (SP[k].w = f.x1 - f.x0));
  SP[i].w = neu;
  SP[j].w = sum - neu;
}
/** Flügel hinzufügen (+1) oder entfernen (−1); neue Flügel übernehmen die Eigenschaften des letzten. */
function okFluegel(d) {
  const T = okTyp();
  if (!T) return;
  const SP = okSpSicher(T);
  if (d > 0 && SP.length < 8) SP.push({ ...SP[SP.length - 1], an: SP.length % 2 ? 'r' : 'l' });
  if (d < 0 && SP.length > 1) SP.pop();
  SP.forEach((c) => (c.w = 1));
  T.fl = SP.length;
  if (typeof OK.feld === 'number' && OK.feld >= SP.length) OK.feld = null;
  oeAktualisieren();
}
function okGleich() {
  const T = okTyp();
  if (!T) return;
  okSpSicher(T).forEach((c) => (c.w = 1));
  oeAktualisieren();
}
function okNeu(art) {
  const v = OET0.find((t) => t.a === art) || OET0[0],
    k = 'u' + Date.now().toString(36);
  S.oet.push({ ...JSON.parse(JSON.stringify(v)), k, n: 'Neu: ' + OE_ARTEN[art] });
  OK.k = k;
  OK.feld = null;
  FDS.oeT = k;
  oeAktualisieren();
}
function okKopie() {
  FDS.oeT = OK.k;
  oeTypNeu();
  OK.k = FDS.oeT;
  oeAktualisieren();
}
function okLoeschen() {
  const k = OK.k;
  oeTypLoeschen(k);
  if (!S.oet.some((t) => t.k === k)) OK.k = S.oet[0].k;
  OK.feld = null;
  oeAktualisieren();
}
function okWahl(k) {
  OK.k = k;
  OK.feld = null;
  FDS.oeT = k;
  oeAktualisieren();
}
/** Gewählten Typ im Fassadendesigner zum Setzen übernehmen. */
function okSetzen() {
  if (!FDS.open && !fdOpen()) return;
  oeTypWahl(OK.k);
  okClose();
}

// ---- Darstellung
function okRender() {
  if (!OK.open) return;
  ['oe', 'gr'].forEach((r) => {
    const e = okE(r === 'oe' ? 'okRoe' : 'okRgr');
    if (e) e.classList.toggle('on', OK.reiter === r);
  });
  // ── Erweiterung aus 19-fassadendesigner/098-konfigurator-gruppen.js
  if (OK.reiter === 'gr') {
    okGrRender();
    okGrZeichnen();
    return;
  }
  if (!okTyp()) OK.k = S.oet[0].k;
  const T = okTyp(),
    zahl = {};
  S.bld.forEach((x) =>
    Object.values(x.fd || {}).forEach((d) =>
      ((d && d.oe) || []).forEach((o) => (zahl[o.t] = (zahl[o.t] || 0) + 1)),
    ),
  );
  // Liste nach Art
  const L = okE('okL');
  if (L)
    L.innerHTML = Object.keys(OE_ARTEN)
      .map((a) => {
        const ts = S.oet.filter((t) => t.a === a);
        return `<h5>${OE_ARTEN[a]}</h5>${ts
          .map(
            (t) =>
              `<div class="okt${t.k === OK.k ? ' on' : ''}" onclick="okWahl('${t.k}')">${oeSymbol(t, 30, 30)}<span>${esc(t.n)}<small>${fdFmt(t.b)} × ${fdFmt(t.h)} m${zahl[t.k] ? ' · ' + zahl[t.k] + '× gesetzt' : ''}</small></span></div>`,
          )
          .join(
            '',
          )}<div class="okt" onclick="okNeu('${a}')" title="Neuen Typ dieser Art anlegen"><span class="mu">+ ${OE_ARTEN[a]} anlegen</span></div>`;
      })
      .join('');
  const R = okE('okR');
  if (
    R &&
    T &&
    !(R.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName))
  ) {
    // bewusst schlicht: Name, Maße, Brüstung, Rahmenfarbe und die Aufteilung
    const z = (f, v, st, tt) =>
        `<input type="number" step="${st || 0.01}" value="${+(+v).toFixed(3)}" ${tt ? `title="${tt}"` : ''} onchange="okSet('${f}',this.value)">`,
      SP = oeSpalten(T),
      tuer = oeTuer(T);
    let h = `<h4>Typ</h4><div class="okg"><span>Name</span><input type="text" value="${esc(T.n)}" onchange="okSet('n',this.value)">
<span>Breite (m)</span>${z('b', T.b)}<span>Höhe (m)</span>${z('h', T.h)}
${tuer ? '' : `<span>Brüstung (m)</span>${z('br', T.br, 0.01, 'Abstand Unterkante zum Fußboden des Geschosses beim Setzen')}`}
<span>Rahmenfarbe</span><input type="color" value="${T.rf}" onchange="okSet('rf',this.value)"></div>`;
    if (T.a !== 'to')
      h += `<h4>Aufteilung</h4><div class="okg"><span>Flügel</span><span style="display:flex;gap:4px;align-items:center"><button onclick="okFluegel(-1)" title="Flügel entfernen">−</button><b style="flex:1;text-align:center">${SP.length}</b><button onclick="okFluegel(1)" title="Flügel hinzufügen">+</button></span>
<span>Oberlicht (m, 0 = ohne)</span>${z('ol', T.ol || 0)}${tuer ? '' : `<span>Unterlicht (m, 0 = ohne)</span>${z('ul', T.ul || 0)}`}</div>
<div class="okb">${SP.length > 1 ? '<button onclick="okGleich()" title="Alle Flügel gleich breit">Gleich verteilen</button>' : ''}</div>
<div class="mu" style="margin-top:6px">Flügelbreiten, Oberlicht und Unterlicht in der Ansicht an den blauen Linien ziehen.</div>`;
    h += `<div class="okb" style="margin-top:14px"><button onclick="okSetzen()" title="Typ im Fassadendesigner setzen">Im Fassadendesigner setzen</button><button onclick="okKopie()">Kopie</button>${S.oet.length > 1 ? '<button onclick="okLoeschen()">Löschen</button>' : ''}</div>
<div class="mu" style="margin-top:6px">${zahl[T.k] ? zahl[T.k] + '× gesetzt – ' : ''}Änderungen gelten für alle gesetzten Öffnungen dieses Typs.</div>`;
    R.innerHTML = h;
  }
  okZeichnen();
}
/** Maßstab der Ansicht: Typ mittig mit Rand für Maßketten. */
function okAnsicht() {
  const cw = okE('okCw'),
    cv = okE('okCv'),
    T = okTyp();
  if (!cw || !cv || !T) return null;
  const dpr = window.devicePixelRatio || 1,
    W = cw.clientWidth,
    H = cw.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const s = Math.min((W - 170) / T.b, (H - 150) / T.h),
    ox = (W - T.b * s) / 2,
    oy = (H + T.h * s) / 2 - 10;
  return {
    W,
    H,
    dpr,
    s,
    X: (x) => ox + x * s,
    Y: (y) => oy - y * s,
    iX: (px) => (px - ox) / s,
    iY: (py) => (oy - py) / s,
  };
}
function okZeichnen() {
  if (OK.reiter === 'gr') return okGrZeichnen();
  const P = okAnsicht(),
    cv = okE('okCv'),
    T = okTyp();
  if (!P || !T) return;
  const g = cv.getContext('2d');
  g.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  g.clearRect(0, 0, P.W, P.H);
  // Wandausschnitt angedeutet
  g.fillStyle = '#e4e2dd';
  g.fillRect(P.X(-0.4), P.Y(T.h + 0.4), (T.b + 0.8) * P.s, (T.h + (T.br > 0 ? 0.8 : 0.4)) * P.s);
  g.fillStyle = '#f2f2f2';
  if (T.br === 0) g.fillRect(P.X(-0.5), P.Y(0), (T.b + 1) * P.s, 0.5 * P.s);
  oeZeichneEine(g, P.X, P.Y, 0, T.b, 0, T, { feld: OK.feld });
  // Griffe: Pfosten und Riegel (ziehbar)
  okGriffe(T).forEach((q) => {
    const an = OK.hover === q.id || (OK.zug && OK.zug.id === q.id);
    g.fillStyle = an ? '#1f6fd1' : '#1f6fd166';
    if (q.art === 'x')
      g.fillRect(P.X(q.a) - 1, P.Y(q.y1), Math.max(3, (q.b - q.a) * P.s) + 2, (q.y1 - q.y0) * P.s);
    else g.fillRect(P.X(q.x0), P.Y(q.b) - 1, (q.x1 - q.x0) * P.s, Math.max(3, (q.b - q.a) * P.s) + 2);
  });
  // Maßketten
  const A = oeAufteilung(T),
    kette = (pos, waag, lab) => {
      g.strokeStyle = '#475569';
      g.fillStyle = '#334155';
      g.lineWidth = 1;
      g.font = '11px system-ui,sans-serif';
      g.beginPath();
      if (waag) {
        const [x0, x1, y] = pos;
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        [x0, x1].forEach((x) => {
          g.moveTo(x, y - 5);
          g.lineTo(x, y + 5);
        });
        g.stroke();
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText(lab, (x0 + x1) / 2, y + 4);
      } else {
        const [y0, y1, x] = pos;
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        [y0, y1].forEach((y) => {
          g.moveTo(x - 5, y);
          g.lineTo(x + 5, y);
        });
        g.stroke();
        g.save();
        g.translate(x + 14, (y0 + y1) / 2);
        g.rotate(-Math.PI / 2);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(lab, 0, 0);
        g.restore();
      }
    };
  kette([P.X(0), P.X(T.b), P.Y(0) + 46], true, fdFmt(T.b) + ' m');
  const SPf = A.felder.filter((f) => typeof f.i === 'number');
  if (SPf.length > 1)
    SPf.forEach((f) => kette([P.X(f.x0), P.X(f.x1), P.Y(0) + 22], true, fdFmt(f.x1 - f.x0)));
  kette([P.Y(0), P.Y(T.h), P.X(T.b) + 44], false, fdFmt(T.h) + ' m');
  A.felder
    .filter((f) => f.i === 'ol' || f.i === 'ul')
    .forEach((f) => kette([P.Y(f.y0), P.Y(f.y1), P.X(T.b) + 18], false, fdFmt(f.y1 - f.y0)));
  if (T.br > 0) {
    g.fillStyle = '#64748b';
    g.font = '11px system-ui,sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('Brüstung beim Setzen ' + fdFmt(T.br) + ' m', P.X(0), P.Y(0) + 66);
  }
  const hint = okE('okHint');
  if (hint) hint.textContent = 'Blaue Linien ziehen: Flügelbreite, Oberlicht, Unterlicht · Ansicht von außen';
}
/** Ziehbare Stege: Pfosten zwischen Flügeln (art 'x') und Riegel von Oberlicht/Unterlicht (art 'y'). */
function okGriffe(T) {
  const A = oeAufteilung(T),
    F = A.felder.filter((f) => typeof f.i === 'number'),
    G = [];
  for (let i = 0; i < F.length - 1; i++)
    G.push({ id: 'p' + i, art: 'x', i, a: F[i].x1, b: F[i + 1].x0, y0: F[i].y0, y1: F[i].y1 });
  A.felder.forEach((f) => {
    if (f.i === 'ol') G.push({ id: 'ol', art: 'y', a: f.y0 - A.pb, b: f.y0, x0: f.x0, x1: f.x1 });
    if (f.i === 'ul') G.push({ id: 'ul', art: 'y', a: f.y1, b: f.y1 + A.pb, x0: f.x0, x1: f.x1 });
  });
  return G;
}
function okPos(e) {
  const r = okE('okCv').getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function okGriffAn(T, P, px, py) {
  const x = P.iX(px),
    y = P.iY(py),
    tol = 6 / P.s;
  return (
    okGriffe(T).find((q) =>
      q.art === 'x'
        ? x >= q.a - tol && x <= q.b + tol && y >= q.y0 && y <= q.y1
        : y >= q.a - tol && y <= q.b + tol && x >= q.x0 && x <= q.x1,
    ) || null
  );
}
function okDown(e) {
  if (OK.reiter === 'gr') return okGrDown(e);
  const T = okTyp(),
    P = okAnsicht();
  if (!T || !P) return;
  const [px, py] = okPos(e),
    q = okGriffAn(T, P, px, py);
  if (q) {
    OK.zug = q;
    okE('okCv').setPointerCapture(e.pointerId);
    return;
  }
}
function okMove(e) {
  if (OK.reiter === 'gr') return okGrMove(e);
  const T = okTyp(),
    P = okAnsicht();
  if (!T || !P) return;
  const [px, py] = okPos(e),
    z = OK.zug;
  if (!z) {
    const q = okGriffAn(T, P, px, py),
      id = q ? q.id : null;
    e.currentTarget.style.cursor = q ? (q.art === 'x' ? 'ew-resize' : 'ns-resize') : '';
    if (id !== OK.hover) {
      OK.hover = id;
      okZeichnen();
    }
    return;
  }
  const r = (v) => Math.round(v * 100) / 100;
  if (z.art === 'x') {
    const A = oeAufteilung(T),
      F = A.felder.filter((f) => typeof f.i === 'number'),
      f0 = F[z.i],
      x = r(P.iX(px)) - A.pb / 2;
    okBreite(T, z.i, x - f0.x0);
  } else if (z.id === 'ol') T.ol = Math.max(0.15, r(T.h - okPb(T) - P.iY(py)));
  else if (z.id === 'ul') T.ul = Math.max(0.15, r(P.iY(py) - (oeTuer(T) ? 0 : okPb(T))));
  okZeichnen();
}
/** Profilbreite wie in oeAufteilung (begrenzt). */
function okPb(T) {
  return oeAufteilung(T).pb;
}
function okUp() {
  if (OK.reiter === 'gr') return okGrUp();
  if (!OK.zug) return;
  OK.zug = null;
  oeAktualisieren();
}
