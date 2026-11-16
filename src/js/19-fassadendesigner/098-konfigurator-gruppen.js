// ======================= KONFIGURATOR: REITER „GRUPPEN“ =======================
// Öffnungsgruppen anlegen: Länge und Höhe festlegen, Öffnungen aus dem Katalog hinzufügen und in der Ansicht ziehen
// (Raster 5 cm, Brüstung rastet auf die Vorgabe des Typs bzw. den Fußboden ein), gleichmäßig verteilen.
// Aufgerufen aus okRender/okZeichnen/okDown/okMove/okUp (095-konfigurator.js), wenn OK.reiter === 'gr'.

const okGr = () => oegG(OK.g);
const okGrOe = () => {
  const G = okGr();
  return G ? G.oe.find((q) => q.id === OK.go) || null : null;
};

/** Eigenschaft der Gruppe ändern (n Name, l Länge, h Höhe). */
function okGrSet(f, v) {
  const G = okGr();
  if (!G) return;
  if (f === 'n') G.n = String(v).slice(0, 60) || G.n;
  else {
    const n = +String(v).replace(',', '.');
    if (!isFinite(n)) return;
    if (f === 'l') G.l = Math.max(0.5, Math.min(40, n));
    if (f === 'h') G.h = Math.max(1, Math.min(10, n));
  }
  oeAktualisieren();
}
/** Gewählte Öffnung der Gruppe ändern (t Typ, x Abstand links, v Brüstung). */
function okGrOeSet(f, v) {
  const q = okGrOe();
  if (!q) return;
  if (f === 't' && S.oet.some((t) => t.k === v)) q.t = v;
  else {
    const n = +String(v).replace(',', '.');
    if (!isFinite(n)) return;
    if (f === 'x') q.x = n;
    if (f === 'v') q.v = Math.max(0, n);
  }
  oeAktualisieren();
}
/** Öffnung des gewählten Typs hinzufügen: in die größte Lücke, Brüstung nach Vorgabe des Typs. */
function okGrOeNeu(t) {
  const G = okGr(),
    T = S.oet.find((x) => x.k === t);
  if (!G || !T) return;
  // größte Lücke zwischen den vorhandenen Öffnungen (einschließlich der Enden)
  const B = G.oe.map((q) => [q.x, q.x + oeT(q.t).b]).sort((a, c) => a[0] - c[0]);
  let best = [0, 0],
    p = 0;
  B.concat([[G.l, G.l]]).forEach(([a, c]) => {
    if (a - p > best[1] - best[0]) best = [p, a];
    p = Math.max(p, c);
  });
  const id = 'o' + Date.now().toString(36);
  G.oe.push({ id, t, x: Math.round(((best[0] + best[1]) / 2 - T.b / 2) / OE_RASTER) * OE_RASTER, v: T.br });
  OK.go = id;
  oeAktualisieren();
}
function okGrOeLoeschen() {
  const G = okGr();
  if (!G) return;
  G.oe = G.oe.filter((q) => q.id !== OK.go);
  OK.go = null;
  oeAktualisieren();
}
/** Öffnungen gleichmäßig über die Länge verteilen (gleiche Abstände, auch zu den Enden). */
function okGrVerteilen() {
  const G = okGr();
  if (!G || !G.oe.length) return;
  const L = G.oe.slice().sort((a, c) => a.x - c.x),
    sb = L.reduce((s, q) => s + oeT(q.t).b, 0),
    gap = Math.max(0, (G.l - sb) / (L.length + 1));
  let x = gap;
  L.forEach((q) => {
    q.x = Math.round(x * 1000) / 1000;
    x += oeT(q.t).b + gap;
  });
  oeAktualisieren();
}
function okGrNeu() {
  const k = 'gu' + Date.now().toString(36);
  S.oeg.push({ k, n: 'Neue Gruppe', l: 6, h: 3, oe: [] });
  OK.g = k;
  OK.go = null;
  oeAktualisieren();
}
function okGrKopie() {
  const G = okGr();
  if (!G) return;
  const k = 'gu' + Date.now().toString(36);
  S.oeg.push({ ...JSON.parse(JSON.stringify(G)), k, n: G.n + ' (Kopie)' });
  OK.g = k;
  oeAktualisieren();
}
function okGrLoeschen() {
  const G = okGr();
  if (!G) return;
  const n = S.bld.reduce(
    (s, b) =>
      s +
      Object.values(b.fd || {}).reduce(
        (t, d) => t + ((d && d.gr) || []).filter((I) => I.g === G.k).length,
        0,
      ),
    0,
  );
  if (n && !confirm(`„${G.n}“ ist ${n}× an Fassaden gesetzt. Gruppe und diese Stellen löschen?`)) return;
  hist();
  S.oeg = S.oeg.filter((x) => x !== G);
  S.bld.forEach((b) =>
    Object.values(b.fd || {}).forEach((d) => {
      if (d && d.gr) d.gr = d.gr.filter((I) => I.g !== G.k);
    }),
  );
  OK.g = S.oeg.length ? S.oeg[0].k : null;
  OK.go = null;
  oeAktualisieren();
}
function okGrWahl(k) {
  OK.g = k;
  OK.go = null;
  FDS.grT = k;
  oeAktualisieren();
}
function okGrSetzen() {
  if (!FDS.open && !fdOpen()) return;
  oegWahl(OK.g);
  okClose();
}

// ---- Darstellung
function okGrRender() {
  if (!okGr()) OK.g = S.oeg.length ? S.oeg[0].k : null;
  const G = okGr(),
    zahl = {};
  S.bld.forEach((x) =>
    Object.values(x.fd || {}).forEach((d) =>
      ((d && d.gr) || []).forEach((I) => (zahl[I.g] = (zahl[I.g] || 0) + 1)),
    ),
  );
  const L = okE('okL');
  if (L)
    L.innerHTML =
      `<h5>Gruppen</h5>` +
      S.oeg
        .map(
          (x) =>
            `<div class="okt${x.k === OK.g ? ' on' : ''}" onclick="okGrWahl('${x.k}')">${oegSymbol(x, 48, 30)}<span>${esc(x.n)}<small>${fdFmt(x.l)} m · ${x.oe.length} Öffnung${x.oe.length === 1 ? '' : 'en'}${zahl[x.k] ? ' · ' + zahl[x.k] + '× gesetzt' : ''}</small></span></div>`,
        )
        .join('') +
      `<div class="okt" onclick="okGrNeu()"><span class="mu">+ Gruppe anlegen</span></div>`;
  const R = okE('okR');
  if (!R || (R.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)))
    return;
  if (!G) {
    R.innerHTML = '<div class="mu">Noch keine Gruppe – links „+ Gruppe anlegen“.</div>';
    return;
  }
  const z = (f, v, fn) =>
      `<input type="number" step="0.01" value="${+(+v).toFixed(3)}" onchange="${fn || 'okGrSet'}('${f}',this.value)">`,
    opt = (cur) =>
      S.oet
        .map((t) => `<option value="${t.k}" ${t.k === cur ? 'selected' : ''}>${esc(t.n)}</option>`)
        .join(''),
    q = okGrOe();
  let h = `<h4>Gruppe</h4><div class="okg"><span>Name</span><input type="text" value="${esc(G.n)}" onchange="okGrSet('n',this.value)">
<span>Länge (m)</span>${z('l', G.l)}<span>Höhe (m)</span>${z('h', G.h)}</div>
<h4>Öffnungen</h4><div class="okg"><select onchange="okE('okGrT').dataset.t=this.value">${opt(S.oet[0] && S.oet[0].k)}</select><button id="okGrT" onclick="okGrOeNeu(this.dataset.t||'${S.oet[0] ? S.oet[0].k : ''}')">Hinzufügen</button></div>
<div class="okb">${G.oe.length > 1 ? '<button onclick="okGrVerteilen()" title="Gleiche Abstände zwischen den Öffnungen und zu den Enden">Gleichmäßig verteilen</button>' : ''}</div>`;
  if (q)
    h += `<h4>Gewählte Öffnung</h4><div class="okg"><span>Typ</span><select onchange="okGrOeSet('t',this.value)">${opt(q.t)}</select>
<span>Abstand links (m)</span>${z('x', q.x, 'okGrOeSet')}<span>Brüstung (m)</span>${z('v', q.v, 'okGrOeSet')}</div>
<div class="okb"><button onclick="okGrOeLoeschen()">Entfernen</button></div>`;
  else h += `<div class="mu" style="margin-top:6px">Öffnung in der Ansicht anklicken und ziehen.</div>`;
  h += `<div class="okb" style="margin-top:14px"><button onclick="okGrSetzen()">Im Fassadendesigner setzen</button><button onclick="okGrKopie()">Kopie</button><button onclick="okGrLoeschen()">Löschen</button></div>
<div class="mu" style="margin-top:6px">${zahl[G.k] ? zahl[G.k] + '× gesetzt – ' : ''}Änderungen gelten für alle Stellen, an denen die Gruppe sitzt.</div>`;
  R.innerHTML = h;
}
function okGrAnsicht() {
  const cw = okE('okCw'),
    cv = okE('okCv'),
    G = okGr();
  if (!cw || !cv || !G) return null;
  const dpr = window.devicePixelRatio || 1,
    W = cw.clientWidth,
    H = cw.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const s = Math.min((W - 120) / G.l, (H - 170) / G.h),
    ox = (W - G.l * s) / 2,
    oy = (H + G.h * s) / 2 - 20;
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
function okGrZeichnen() {
  const P = okGrAnsicht(),
    cv = okE('okCv'),
    G = okGr();
  const g = cv && cv.getContext('2d');
  if (g) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
  }
  if (!P || !G) return;
  g.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  // Wand der Gruppe, Nachbarn angedeutet, Fußboden
  g.fillStyle = '#eceae6';
  g.fillRect(P.X(-0.6), P.Y(G.h), (G.l + 1.2) * P.s, G.h * P.s);
  g.fillStyle = '#e4e2dd';
  g.fillRect(P.X(0), P.Y(G.h), G.l * P.s, G.h * P.s);
  g.strokeStyle = '#5E7F92';
  g.setLineDash([5, 4]);
  g.strokeRect(P.X(0), P.Y(G.h), G.l * P.s, G.h * P.s);
  g.setLineDash([]);
  g.strokeStyle = '#334155';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(P.X(-0.6), P.Y(0));
  g.lineTo(P.X(G.l + 0.6), P.Y(0));
  g.stroke();
  G.oe.forEach((q) => {
    const T = oeT(q.t);
    oeZeichneEine(g, P.X, P.Y, q.x, q.x + T.b, q.v, T, { sel: q.id === OK.go });
  });
  // Maßkette unten: Lücken und Öffnungen
  const L = G.oe.map((q) => [q.x, q.x + oeT(q.t).b]).sort((a, c) => a[0] - c[0]),
    pk = [0];
  L.forEach(([a, c]) => pk.push(a, c));
  pk.push(G.l);
  g.strokeStyle = '#475569';
  g.fillStyle = '#334155';
  g.font = '11px system-ui,sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.lineWidth = 1;
  const y1 = P.Y(0) + 22,
    y2 = P.Y(0) + 46;
  g.beginPath();
  pk.forEach((x) => {
    g.moveTo(P.X(x), y1 - 5);
    g.lineTo(P.X(x), y1 + 5);
  });
  g.moveTo(P.X(0), y1);
  g.lineTo(P.X(G.l), y1);
  g.moveTo(P.X(0), y2);
  g.lineTo(P.X(G.l), y2);
  g.moveTo(P.X(0), y2 - 5);
  g.lineTo(P.X(0), y2 + 5);
  g.moveTo(P.X(G.l), y2 - 5);
  g.lineTo(P.X(G.l), y2 + 5);
  g.stroke();
  for (let i = 0; i < pk.length - 1; i++)
    if (pk[i + 1] - pk[i] > 0.01 && (pk[i + 1] - pk[i]) * P.s > 26)
      g.fillText(fdFmt(pk[i + 1] - pk[i]), P.X((pk[i] + pk[i + 1]) / 2), y1 + 4);
  g.fillText(fdFmt(G.l) + ' m', P.X(G.l / 2), y2 + 4);
  const hint = okE('okHint');
  if (hint)
    hint.textContent = 'Öffnung anklicken und ziehen (Shift: ohne Einrasten) · gestrichelt: Länge der Gruppe';
}
function okGrDown(e) {
  const P = okGrAnsicht(),
    G = okGr();
  if (!P || !G) return;
  const [px, py] = okPos(e),
    x = P.iX(px),
    y = P.iY(py),
    q = G.oe
      .slice()
      .reverse()
      .find((q) => {
        const T = oeT(q.t);
        return x >= q.x && x <= q.x + T.b && y >= q.v && y <= q.v + T.h;
      });
  OK.go = q ? q.id : null;
  if (q) {
    OK.gzug = { dx: q.x - x, dv: q.v - y };
    okE('okCv').setPointerCapture(e.pointerId);
  }
  okGrRender();
  okGrZeichnen();
}
function okGrMove(e) {
  const P = okGrAnsicht(),
    q = okGrOe(),
    z = OK.gzug;
  if (!P) return;
  const [px, py] = okPos(e);
  if (!z || !q) {
    const G = okGr(),
      x = P.iX(px),
      y = P.iY(py),
      an = G && G.oe.some((o) => x >= o.x && x <= o.x + oeT(o.t).b && y >= o.v && y <= o.v + oeT(o.t).h);
    e.currentTarget.style.cursor = an ? 'move' : '';
    return;
  }
  const T = oeT(q.t),
    r = (v) => Math.round(v / OE_RASTER) * OE_RASTER;
  let x = P.iX(px) + z.dx,
    v = P.iY(py) + z.dv;
  if (!e.shiftKey) {
    x = r(x);
    v = Math.abs(v - T.br) < 0.3 ? T.br : Math.abs(v) < 0.3 ? 0 : r(v);
  }
  q.x = Math.round(x * 1000) / 1000;
  q.v = Math.max(0, Math.round(v * 1000) / 1000);
  okGrZeichnen();
}
function okGrUp() {
  if (!OK.gzug) return;
  OK.gzug = null;
  oeAktualisieren();
}
