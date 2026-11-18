// ======================= KONFIGURATOR: REITER „GRUPPEN“ =======================
// Öffnungsgruppen anlegen: Länge, Höhe und Material festlegen, Öffnungen aus dem Katalog hinzufügen und in der Ansicht
// ziehen (Raster 5 cm, Brüstung rastet ein), gleichmäßig verteilen. Wandfläche zeichnerisch teilen (Werkzeuge
// „Senkrecht“/„Waagerecht“ oder „An Fenstern teilen“), Felder wählen (Umschalt = mehrere) und als Rücksprung/Vorsprung
// (Tiefe) bzw. mit eigenem Material festlegen.
// Aufgerufen aus okRender/okZeichnen/okDown/okMove/okUp (095-konfigurator.js), wenn OK.reiter === 'gr'.

const okGr = () => oegG(OK.g);
// Werkzeug in der Gruppenansicht: 'sel' Auswählen, 'x' senkrecht teilen, 'y' waagerecht teilen
OK.gwz = 'sel';
OK.gzel = []; // gewählte Felder (Mittelpunkte)
OK.glin = null; // gewählte Teilungslinie { a: 'x'|'y', v }
/** Gewählte Felder der aktuellen Gruppe. */
function okGrZellenWahl() {
  const G = okGr();
  if (!G) return [];
  const Z = oegZellen(G);
  return OK.gzel
    .map((p) => Z.find((z) => p[0] > z.x0 && p[0] < z.x1 && p[1] > z.y0 && p[1] < z.y1))
    .filter(Boolean);
}
const okGrOe = () => {
  const G = okGr();
  return G ? G.oe.find((q) => q.id === OK.go) || null : null;
};

/** Eigenschaft der Gruppe ändern (n Name, l Länge, h Höhe). */
function okGrSet(f, v) {
  const G = okGr();
  if (!G) return;
  if (f === 'n') G.n = String(v).slice(0, 60) || G.n;
  else if (f === 'szan') G.sz = { an: !!v };
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
    // Sturz: Fenster bei gleicher Höhe so verschieben, dass darüber s bis zur Gruppenoberkante frei bleibt
    if (f === 's') q.v = Math.max(0, okGr().h - Math.max(0, n) - oeT(q.t).h);
  }
  oeAktualisieren();
}
/** Öffnung des gewählten Typs hinzufügen: in die größte Lücke, Brüstung nach Vorgabe des Typs. */
function okGrOeNeu(t) {
  const G = okGr(),
    T = S.oet.find((x) => x.k === t);
  if (!G || !T) return;
  // größte Lücke zwischen den vorhandenen Öffnungen (einschließlich der Enden)
  const B = G.oe.map((q) => [q.x, q.x + oegTyp(G, q, G.h).b]).sort((a, c) => a[0] - c[0]);
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
/** Werkzeug der Gruppenansicht wählen. */
function okGrWz(w) {
  OK.gwz = w;
  OK.gvor = null;
  okGrRender();
  okGrZeichnen();
}
/** Teilungslinien an allen Fensterkanten (senkrecht) und an Brüstung/Sturz (waagerecht). */
function okGrTeilenFenster() {
  const G = okGr();
  if (!G) return;
  G.xs = G.xs || [];
  G.ys = G.ys || [];
  G.oe.forEach((q) => {
    const T = oegTyp(G, q, G.h);
    G.xs.push(q.x, q.x + T.b);
    if (q.v > 0.005) G.ys.push(q.v);
    G.ys.push(q.v + T.h);
  });
  const t = oegTeilung(G);
  G.xs = t.xs.slice(1, -1);
  G.ys = t.ys.slice(1, -1);
  OK.gzel = [];
  oeAktualisieren();
}
function okGrTeilungZurueck() {
  const G = okGr();
  if (!G) return;
  G.xs = [];
  G.ys = [];
  G.fe = [];
  G.vb = [];
  OK.gzel = [];
  OK.glin = null;
  oeAktualisieren();
}
function okGrLinieLoeschen() {
  const G = okGr(),
    l = OK.glin;
  if (!G || !l) return;
  const k = l.a === 'x' ? 'xs' : 'ys';
  G[k] = (G[k] || []).filter((x) => Math.abs(x - l.v) > 0.004);
  OK.glin = null;
  OK.gzel = [];
  oeAktualisieren();
}
/** Zwei oder mehr Felder zu einem verbinden (Rechteck aus den Feldern); Feldeinstellung des ersten bleibt. */
function okGrVerbinden(Z) {
  const G = okGr();
  if (!G || !Z || Z.length < 2) return false;
  const r = {
      x0: Math.min(...Z.map((z) => z.x0)),
      x1: Math.max(...Z.map((z) => z.x1)),
      y0: Math.min(...Z.map((z) => z.y0)),
      y1: Math.max(...Z.map((z) => z.y1)),
    },
    fl = Z.reduce((s, z) => s + (z.x1 - z.x0) * (z.y1 - z.y0), 0);
  // nur lückenlose Rechtecke (keine L-Formen)
  if (Math.abs(fl - (r.x1 - r.x0) * (r.y1 - r.y0)) > 1e-4) {
    try {
      okE('okHint').textContent = 'Nur Felder, die zusammen ein Rechteck bilden, lassen sich verbinden';
    } catch (e) {
      logErr(e, 'okGrVerbinden');
    }
    return false;
  }
  const innen = (q) =>
    q.x0 >= r.x0 - 0.004 && q.x1 <= r.x1 + 0.004 && q.y0 >= r.y0 - 0.004 && q.y1 <= r.y1 + 0.004;
  G.vb = oegVerbunden(G).filter((q) => !innen(q));
  G.vb.push(r);
  // Tiefe/Material: das erste Feld gibt vor
  const e0 = (G.fe || []).find(
    (f) => f.p[0] > Z[0].x0 && f.p[0] < Z[0].x1 && f.p[1] > Z[0].y0 && f.p[1] < Z[0].y1,
  );
  G.fe = (G.fe || []).filter((f) => !(f.p[0] > r.x0 && f.p[0] < r.x1 && f.p[1] > r.y0 && f.p[1] < r.y1));
  if (e0) G.fe.push({ ...e0, p: [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2] });
  OK.gzel = [[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]];
  OK.glin = null;
  oeAktualisieren();
  return true;
}
/** Teilungslinie nur zwischen den zwei Feldern an der gewählten Stelle entfernen (feldweise). */
function okGrSegmentLoeschen() {
  const l = OK.glin;
  if (!l || !l.A || !l.B) return;
  okGrVerbinden([l.A, l.B]);
}
/** Verbindung des gewählten Feldes lösen (wieder einzelne Felder). */
function okGrVerbindungLoesen() {
  const G = okGr(),
    Z = okGrZellenWahl().filter((z) => z.vb);
  if (!G || !Z.length) return;
  G.vb = oegVerbunden(G).filter(
    (r) =>
      !Z.some(
        (z) =>
          Math.abs(z.x0 - r.x0) < 0.004 &&
          Math.abs(z.x1 - r.x1) < 0.004 &&
          Math.abs(z.y0 - r.y0) < 0.004 &&
          Math.abs(z.y1 - r.y1) < 0.004,
      ),
  );
  OK.gzel = [];
  oeAktualisieren();
}
/** Gewählte Felder ändern: d Tiefe in cm (positiv Rücksprung, negativ Vorsprung), t Material ('' = wie Gruppe). */
function okGrFeldSet(f, v) {
  const G = okGr(),
    Z = okGrZellenWahl();
  if (!G || !Z.length) return;
  G.fe = G.fe || [];
  Z.forEach((z) => {
    let e = G.fe.find((q) => q.p[0] > z.x0 && q.p[0] < z.x1 && q.p[1] > z.y0 && q.p[1] < z.y1);
    if (!e) G.fe.push((e = { p: [(z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2], d: 0, k: 'g', t: '' }));
    if (f === 'k') e.k = v === 'l' || v === 'r' ? v : 'g';
    if (f === 'a') {
      // Loggia: Rücksprung (Standard 1,50 m), Balkon: Auskragung (Standard 1,50 m)
      e.a = v === 'lo' || v === 'ba' ? v : '';
      if (e.a && !(Math.abs(e.d) > 0.05)) e.d = 1.5;
      if (e.a === 'lo' && e.d < 0) e.d = -e.d;
      if (e.a === 'ba') e.d = Math.abs(e.d);
    }
    if (f === 'd') {
      const n = +String(v).replace(',', '.');
      // bis 3 m: Loggien und Balkone sind meist 1,5–2,5 m tief
      if (isFinite(n)) e.d = Math.max(-300, Math.min(300, n)) / 100;
      // Loggia bleibt Rücksprung, Balkon Auskragung (Vorzeichen wie bei der Wahl der Art)
      if (e.a === 'lo') e.d = Math.abs(e.d);
      if (e.a === 'ba') e.d = Math.abs(e.d);
    }
    if (f === 't') e.t = S.ft.some((x) => x.k === v) ? v : '';
  });
  G.fe = G.fe.filter((e) => e.d || e.t || e.a);
  oeAktualisieren();
}
/** Material der ganzen Gruppe. */
function okGrMaterial(v) {
  const G = okGr();
  if (!G) return;
  G.t = S.ft.some((x) => x.k === v) ? v : '';
  oeAktualisieren();
}
/** Entf im Reiter „Gruppen“: Teilung nur an dieser Stelle (feldweise), sonst Öffnung entfernen. */
function okGrEntf() {
  if (OK.glin) {
    if (OK.glin.A && OK.glin.B) okGrSegmentLoeschen();
    else okGrLinieLoeschen();
  } else if (OK.go) okGrOeLoeschen();
}
/** Wie oft ein Öffnungstyp vorkommt: frei gesetzt und über Gruppen (je Verweis). */
function oeTypZahl(k) {
  let n = 0;
  S.bld.forEach((b) =>
    Object.values(b.fd || {}).forEach((d) => {
      ((d && d.oe) || []).forEach((o) => (n += o.t === k ? 1 : 0));
      ((d && d.gr) || []).forEach((I) => {
        const G = oegG(I.g);
        if (G) n += G.oe.filter((q) => q.t === k).length;
      });
    }),
  );
  return n;
}
/** Gewählte Öffnung der Gruppe bekommt eine eigene Kopie ihres Typs (Änderungen wirken nur hier). */
function okGrOeEigen() {
  const G = okGr(),
    q = okGrOe();
  if (!G || !q) return;
  const T = oeT(q.t),
    k = 'u' + Date.now().toString(36);
  S.oet.push({ ...JSON.parse(JSON.stringify(T)), k, n: T.n + ' · ' + G.n });
  q.t = k;
  OK.k = k;
  okGrOeBearbeiten();
}
/** Typ der gewählten Öffnung im Reiter „Fenster & Türen“ öffnen; dort führt „Zurück zur Gruppe“ hierher zurück. */
function okGrOeBearbeiten() {
  const q = okGrOe();
  if (!q) return;
  OK.k = q.t;
  OK.zurueck = OK.g;
  okReiter('oe');
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
    sb = L.reduce((s, q) => s + oegTyp(G, q, G.h).b, 0),
    gap = Math.max(0, (G.l - sb) / (L.length + 1));
  let x = gap;
  L.forEach((q) => {
    q.x = Math.round(x * 1000) / 1000;
    x += oegTyp(G, q, G.h).b + gap;
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
  // ── Erweiterung aus 19-fassadendesigner/130-bibliothek.js
  bibEntfernen('oeg', G.k);
  S.bld.forEach((b) => {
    Object.values(b.fd || {}).forEach((d) => {
      if (d && d.gr) d.gr = d.gr.filter((I) => I.g !== G.k);
    });
    // Gebäudekonfiguration (Stapel, eigene Anordnungen): Gruppe aus Rhythmen entfernen
    const fk = b.fk;
    if (fk) {
      const ohne = (x) => {
        const R = fkReihe(x).filter((k) => k !== G.k);
        return R.length > 1 ? R : R[0] || '';
      };
      fk.st = (fk.st || []).map(ohne);
      Object.keys(fk.ab || {}).forEach((k) => (fk.ab[k] = ohne(fk.ab[k])));
    }
  });
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
            `<div class="okt${x.k === OK.g ? ' on' : ''}" onclick="okGrWahl('${x.k}')">${oegSymbol(x, 48, 30)}<span>${esc(x.n)}<small>${fdFmt(x.l)} m · ${x.oe.length} Öffnung${x.oe.length === 1 ? '' : 'en'}${zahl[x.k] ? ' · ' + zahl[x.k] + '× gesetzt' : ''}</small></span><button class="okx" title="Gruppe löschen" onclick="event.stopPropagation();okGrWahl('${x.k}');okGrLoeschen()">×</button></div>`,
        )
        .join('') +
      `<div class="okt" onclick="okGrNeu()"><span class="mu">+ Gruppe anlegen</span></div>` +
      `<p class="okbib">Eigene Gruppen bleiben in diesem Browser gespeichert und stehen in neuen Projekten bereit.</p>`;
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
<span>Länge (m)</span>${z('l', G.l)}<span title="An der Fassade reicht die Gruppe immer über das ganze Geschoss">Zeichenhöhe (m)</span>${z('h', G.h)}
<span title="In höheren Geschossen: Fenster werden höher und der Sturz bleibt. Ohne Haken bleibt das Fenster und der Sturz wird höher.">Fensterhöhe über festen Sturz</span><input type="checkbox" style="justify-self:end;width:auto" ${G.sz && G.sz.an ? 'checked' : ''} onchange="okGrSet('szan',this.checked)">
<span>Material</span><select onchange="okGrMaterial(this.value)" title="Fassadentyp der ganzen Gruppe (einzelne Felder können abweichen)"><option value="" ${!G.t ? 'selected' : ''}>— wie Fassade —</option>${S.ft
    .filter((x) => !x.df)
    .map((x) => `<option value="${x.k}" ${x.k === G.t ? 'selected' : ''}>${esc(x.n)}</option>`)
    .join('')}</select></div>
<div class="mu" style="margin-top:6px">An der Fassade reicht die Gruppe über das ganze Geschoss. ${G.sz && G.sz.an ? 'Fenster behalten Brüstung und Sturz wie gezeichnet und werden in höheren Geschossen höher.' : 'Fenster bleiben wie gezeichnet, in höheren Geschossen wird der Sturz höher.'}</div>
<h4>Öffnungen</h4><div class="okg"><select onchange="okE('okGrT').dataset.t=this.value">${opt(S.oet[0] && S.oet[0].k)}</select><button id="okGrT" onclick="okGrOeNeu(this.dataset.t||'${S.oet[0] ? S.oet[0].k : ''}')">Hinzufügen</button></div>
<div class="okb">${G.oe.length > 1 ? '<button onclick="okGrVerteilen()" title="Gleiche Abstände zwischen den Öffnungen und zu den Enden">Gleichmäßig verteilen</button>' : ''}</div>`;
  if (q) {
    // gewählte Öffnung: Lage in der Gruppe und der Typ selbst (Maße, Rahmenfarbe, Aufteilung)
    const T = oegTyp(G, q, G.h),
      n = oeTypZahl(T.k);
    OK.k = T.k;
    h += `<h4>Gewählte Öffnung</h4><div class="okg"><span>Typ</span><select onchange="okGrOeSet('t',this.value)">${opt(q.t)}</select>
<span class="mu">Breite (m)</span><input type="number" value="${+T.b.toFixed(3)}" disabled title="Maße über „Bearbeiten“ ändern"><span class="mu">Höhe (m)</span><input type="number" value="${+T.h.toFixed(3)}" disabled title="Maße über „Bearbeiten“ ändern">
<span>Abstand links (m)</span>${z('x', q.x, 'okGrOeSet')}<span>Brüstung (m)</span>${z('v', q.v, 'okGrOeSet')}
${oeTuer(T) ? '' : `<span title="Freiraum über dem Fenster bis zur Oberkante der Gruppe – bleibt in jedem Geschoss gleich">Sturz (m)</span>${z('s', Math.max(0, G.h - q.v - T.h), 'okGrOeSet')}`}</div>
<div class="okb"><button onclick="okGrOeLoeschen()">Entfernen</button></div>
<div class="okb"><button onclick="okGrOeBearbeiten()" title="Typ im Reiter „Fenster & Türen“ öffnen – Maße, Rahmenfarbe, Aufteilung">Bearbeiten</button><button onclick="okGrOeEigen()" title="Kopie des Typs nur für diese Öffnung anlegen und bearbeiten – andere Stellen bleiben unverändert">Als eigenen Typ bearbeiten</button></div>
<div class="mu" style="margin-top:6px">${n > 1 ? `„${esc(T.n)}“ sitzt ${n}× im Projekt – „Bearbeiten“ ändert alle Stellen.` : 'Änderungen am Typ gelten für alle Stellen dieses Typs.'}</div>`;
  }
  // Flächen: Teilung, gewählte Felder (Tiefe, Material), gewählte Linie
  const Z = okGrZellenWahl(),
    mat = (cur, leer) =>
      `<option value="" ${!cur ? 'selected' : ''}>${leer}</option>` +
      S.ft
        .filter((x) => !x.df)
        .map((x) => `<option value="${x.k}" ${x.k === cur ? 'selected' : ''}>${esc(x.n)}</option>`)
        .join('');
  h += `<h4>Flächen</h4><div class="okb"><button onclick="okGrTeilenFenster()" title="Teilungslinien an allen Fensterkanten, an Brüstung und Sturz">An Fenstern teilen</button>${(G.xs && G.xs.length) || (G.ys && G.ys.length) ? '<button onclick="okGrTeilungZurueck()" title="Alle Teilungen und Feldeinstellungen entfernen">Teilung zurücksetzen</button>' : ''}</div>`;
  if (Z.length) {
    const d0 = Z[0].d,
      t0 = Z[0].t,
      gleichD = Z.every((z) => z.d === d0),
      gleichT = Z.every((z) => z.t === t0),
      a = Z.reduce((s, z) => s + (z.x1 - z.x0) * (z.y1 - z.y0), 0);
    h += `<div class="mu" style="margin-top:8px">${Z.length === 1 ? 'Feld' : Z.length + ' Felder'} · ${fdFmt(a)} m²</div><div class="okg" style="margin-top:4px"><span>Art</span><select onchange="okGrFeldSet('a',this.value)" title="Loggia: Rücksprung mit Geländer · Balkon: Platte mit Geländer vor der Wand (Tiefe = Auskragung)">${[
      ['', 'Fläche'],
      ['lo', 'Loggia'],
      ['ba', 'Balkon'],
    ]
      .map(
        ([k, n]) =>
          `<option value="${k}" ${Z.every((z) => (z.a || '') === k) ? 'selected' : ''}>${n}</option>`,
      )
      .join(
        '',
      )}</select><span>${Z.every((z) => z.a === 'ba') ? 'Auskragung (cm)' : 'Tiefe (cm)'}</span><input type="number" step="1" value="${gleichD ? Math.round(d0 * 1000) / 10 : ''}" placeholder="gemischt" onchange="okGrFeldSet('d',this.value)" title="Positiv = Rücksprung, negativ = Vorsprung, 0 = bündig · beim Balkon: Auskragung">
<span>Verlauf</span><select onchange="okGrFeldSet('k',this.value)" title="Schräg: eine Seite springt zurück, die andere bleibt bündig">${[
      ['g', 'gleichmäßig'],
      ['l', 'schräg – links tief'],
      ['r', 'schräg – rechts tief'],
    ]
      .map(([k, n]) => `<option value="${k}" ${Z.every((z) => z.k === k) ? 'selected' : ''}>${n}</option>`)
      .join('')}</select>
<span>Material</span><select onchange="okGrFeldSet('t',this.value)">${gleichT ? mat(t0, '— wie Gruppe —') : '<option value="" selected>gemischt</option>' + mat(null, '— wie Gruppe —').replace(/selected/g, '')}</select></div>
<div class="okb"><button onclick="okGrFeldSet('d',-5)">−5 cm vor</button><button onclick="okGrFeldSet('d',0)">bündig</button><button onclick="okGrFeldSet('d',5)">5 cm zurück</button></div>`;
    if (Z.length > 1 || Z.some((z) => z.vb))
      h += `<div class="okb">${Z.length > 1 ? '<button onclick="okGrVerbinden(okGrZellenWahl())" title="Gewählte Felder zu einem Feld verbinden (müssen ein Rechteck bilden)">Felder verbinden</button>' : ''}${Z.some((z) => z.vb) ? '<button onclick="okGrVerbindungLoesen()" title="Verbundenes Feld wieder in einzelne Felder teilen">Verbindung lösen</button>' : ''}</div>`;
  } else if (OK.glin)
    h += `<div class="mu" style="margin-top:8px">${OK.glin.a === 'x' ? 'Senkrechte' : 'Waagerechte'} Teilung bei ${fdFmt(OK.glin.v)} m</div><div class="okb">${OK.glin.A && OK.glin.B ? '<button onclick="okGrSegmentLoeschen()" title="Nur zwischen diesen beiden Feldern entfernen (Entf)">Hier entfernen</button>' : ''}<button onclick="okGrLinieLoeschen()" title="Teilungslinie über die ganze Gruppe entfernen">Ganze Linie entfernen</button></div>`;
  else
    h += `<div class="mu" style="margin-top:8px">Mit den Werkzeugen über der Ansicht teilen, dann Feld anklicken (Umschalt = mehrere) und Tiefe oder Material festlegen.</div>`;
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
  // Felder: Material (eigenes oder der Gruppe) und Tiefe, Tiefenangabe
  if (G.t) {
    g.fillStyle = fdT(G.t).c;
    g.fillRect(P.X(0), P.Y(G.h), G.l * P.s, G.h * P.s);
  }
  oegFlaechenG(G).forEach((r) => {
    oegRueckZeichneEins(g, P.X, P.Y, r.x0, r.x1, r.y0, r.y1, r.d, false, r.t ? fdT(r.t).c : null, r.k, r.a);
    if (r.d && (r.x1 - r.x0) * P.s > 40) {
      g.fillStyle = '#334155';
      g.font = '10px system-ui,sans-serif';
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillText(
        r.a === 'ba'
          ? 'Balkon ' + Math.round(Math.abs(r.d) * 100) + ' cm'
          : (r.a === 'lo' ? 'Loggia ' : '') + (r.d > 0 ? '−' : '+') + Math.round(Math.abs(r.d) * 100) + ' cm',
        P.X(r.x1) - 4,
        P.Y(r.y1) + 4,
      );
    }
  });
  // Teilungslinien feldweise: rechte und obere Kante jedes Feldes (verbundene Felder ohne innere Linien)
  g.save();
  g.setLineDash([4, 3]);
  g.strokeStyle = '#475569';
  g.lineWidth = 1;
  g.beginPath();
  oegZellen(G).forEach((z) => {
    if (z.x1 < G.l - 0.004) {
      g.moveTo(P.X(z.x1), P.Y(z.y0));
      g.lineTo(P.X(z.x1), P.Y(z.y1));
    }
    if (z.y1 < G.h - 0.004) {
      g.moveTo(P.X(z.x0), P.Y(z.y1));
      g.lineTo(P.X(z.x1), P.Y(z.y1));
    }
  });
  g.stroke();
  // gewählte Teilung: nur das Stück zwischen den zwei Feldern (ganze Linie, wenn keine Felder anliegen)
  const gl = OK.glin;
  if (gl) {
    const s0 = gl.s0 != null ? gl.s0 : 0,
      s1 = gl.s1 != null ? gl.s1 : gl.a === 'x' ? G.h : G.l;
    g.setLineDash([]);
    g.strokeStyle = '#1f6fd1';
    g.lineWidth = 3;
    g.beginPath();
    if (gl.a === 'x') {
      g.moveTo(P.X(gl.v), P.Y(s0));
      g.lineTo(P.X(gl.v), P.Y(s1));
    } else {
      g.moveTo(P.X(s0), P.Y(gl.v));
      g.lineTo(P.X(s1), P.Y(gl.v));
    }
    g.stroke();
  }
  g.restore();
  // gewählte Felder
  okGrZellenWahl().forEach((z) => {
    g.fillStyle = 'rgba(31,111,209,0.18)';
    g.fillRect(P.X(z.x0), P.Y(z.y1), (z.x1 - z.x0) * P.s, (z.y1 - z.y0) * P.s);
    g.strokeStyle = '#1f6fd1';
    g.lineWidth = 2;
    g.strokeRect(P.X(z.x0) + 1, P.Y(z.y1) + 1, (z.x1 - z.x0) * P.s - 2, (z.y1 - z.y0) * P.s - 2);
  });
  // Vorschau der neuen Teilungslinie
  if (OK.gvor) {
    g.strokeStyle = '#1f6fd1';
    g.lineWidth = 1.5;
    g.beginPath();
    if (OK.gvor.a === 'x') {
      g.moveTo(P.X(OK.gvor.v), P.Y(0));
      g.lineTo(P.X(OK.gvor.v), P.Y(G.h));
    } else {
      g.moveTo(P.X(0), P.Y(OK.gvor.v));
      g.lineTo(P.X(G.l), P.Y(OK.gvor.v));
    }
    g.stroke();
    g.fillStyle = '#1f6fd1';
    g.font = '11px system-ui,sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText(
      fdFmt(OK.gvor.v) + ' m',
      OK.gvor.a === 'x' ? P.X(OK.gvor.v) + 4 : P.X(0) + 4,
      OK.gvor.a === 'x' ? P.Y(G.h) - 4 : P.Y(OK.gvor.v) - 3,
    );
  }
  G.oe.forEach((q) => {
    const T = oegTyp(G, q, G.h);
    oeZeichneEine(g, P.X, P.Y, q.x, q.x + T.b, q.v, T, { sel: q.id === OK.go });
  });
  // Maßkette unten: Lücken und Öffnungen
  const L = G.oe.map((q) => [q.x, q.x + oegTyp(G, q, G.h).b]).sort((a, c) => a[0] - c[0]),
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
    hint.textContent =
      OK.gwz === 'x' || OK.gwz === 'y'
        ? 'Klick = Teilungslinie setzen (rastet an Fensterkanten ein, Umschalt = frei) · Esc = zurück zu „Auswählen“'
        : 'Öffnung ziehen · Feld anklicken (Umschalt = mehrere) · Teilung anklicken + Entf = nur an dieser Stelle entfernen · gestrichelt: Länge der Gruppe';
  // Werkzeugleiste über der Ansicht
  let wz = okE('okGwz');
  if (!wz) {
    wz = document.createElement('div');
    wz.id = 'okGwz';
    wz.style.cssText =
      'position:absolute;left:10px;top:10px;display:flex;gap:2px;padding:3px;border-radius:10px;background:color-mix(in srgb,var(--pn,#fff) 92%,transparent);box-shadow:0 2px 10px #0002;z-index:2';
    okE('okCw').appendChild(wz);
  }
  wz.style.display = 'flex';
  const wzh = [
    ['sel', 'Auswählen'],
    ['x', 'Senkrecht teilen'],
    ['y', 'Waagerecht teilen'],
  ]
    .map(([k, n]) => `<button class="${OK.gwz === k ? 'on' : ''}" onclick="okGrWz('${k}')">${n}</button>`)
    .join('');
  if (wz.innerHTML !== wzh) wz.innerHTML = wzh;
}
/** Fangwert für eine Teilungslinie: Fensterkanten (Umschalt = frei), sonst Raster 5 cm. */
function okGrFang(G, a, v, frei) {
  if (frei) return Math.round(v * 1000) / 1000;
  const P = okGrAnsicht(),
    tol = P ? 10 / P.s : 0.12, // 10 Bildpunkte
    K = [];
  G.oe.forEach((q) => {
    const T = oegTyp(G, q, G.h);
    if (a === 'x') K.push(q.x, q.x + T.b);
    else K.push(q.v, q.v + T.h);
  });
  let best = null;
  K.forEach((k) => {
    if (Math.abs(k - v) < tol && (best === null || Math.abs(k - v) < Math.abs(best - v))) best = k;
  });
  return best !== null ? best : Math.round(v / OE_RASTER) * OE_RASTER;
}
function okGrDown(e) {
  const P = okGrAnsicht(),
    G = okGr();
  if (!P || !G) return;
  const [px, py] = okPos(e),
    x = P.iX(px),
    y = P.iY(py);
  // Teilungslinie setzen
  if (OK.gwz === 'x' || OK.gwz === 'y') {
    const a = OK.gwz,
      m = a === 'x' ? G.l : G.h,
      v = okGrFang(G, a, a === 'x' ? x : y, e.shiftKey);
    if (v > 0.005 && v < m - 0.005) {
      const k = a === 'x' ? 'xs' : 'ys';
      G[k] = (G[k] || []).concat(v);
      OK.gzel = [];
      oeAktualisieren();
    }
    return;
  }
  const q = G.oe
    .slice()
    .reverse()
    .find((q) => {
      const T = oegTyp(G, q, G.h);
      return x >= q.x && x <= q.x + T.b && y >= q.v && y <= q.v + T.h;
    });
  OK.go = q ? q.id : null;
  OK.glin = null;
  if (q) {
    OK.gzel = [];
    OK.gzug = { dx: q.x - x, dv: q.v - y };
    okE('okCv').setPointerCapture(e.pointerId);
  } else {
    // Teilungslinie (6 px) zwischen zwei Feldern – gewählt wird nur das Stück an dieser Stelle – oder Feld
    const tol = 6 / P.s,
      ZZ = oegZellen(G),
      lx = ZZ.find((z) => z.x1 < G.l - 0.004 && Math.abs(z.x1 - x) < tol && y > z.y0 && y < z.y1),
      ly = ZZ.find((z) => z.y1 < G.h - 0.004 && Math.abs(z.y1 - y) < tol && x > z.x0 && x < z.x1);
    if (lx) {
      const B = ZZ.find((z) => Math.abs(z.x0 - lx.x1) < 0.004 && y > z.y0 && y < z.y1);
      OK.glin = {
        a: 'x',
        v: lx.x1,
        A: lx,
        B,
        s0: B ? Math.max(lx.y0, B.y0) : lx.y0,
        s1: B ? Math.min(lx.y1, B.y1) : lx.y1,
      };
      OK.gzel = [];
    } else if (ly) {
      const B = ZZ.find((z) => Math.abs(z.y0 - ly.y1) < 0.004 && x > z.x0 && x < z.x1);
      OK.glin = {
        a: 'y',
        v: ly.y1,
        A: ly,
        B,
        s0: B ? Math.max(ly.x0, B.x0) : ly.x0,
        s1: B ? Math.min(ly.x1, B.x1) : ly.x1,
      };
      OK.gzel = [];
    } else if (x > 0 && x < G.l && y > 0 && y < G.h) {
      const z = oegZellen(G).find((c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1),
        p = z && [(z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2];
      if (p) {
        const i = OK.gzel.findIndex((q) => q[0] > z.x0 && q[0] < z.x1 && q[1] > z.y0 && q[1] < z.y1);
        if (e.shiftKey) {
          if (i >= 0) OK.gzel.splice(i, 1);
          else OK.gzel.push(p);
        } else OK.gzel = [p];
      }
    } else OK.gzel = [];
  }
  okGrRender();
  okGrZeichnen();
}
function okGrMove(e) {
  const P = okGrAnsicht(),
    G = okGr(),
    q = okGrOe(),
    z = OK.gzug;
  if (!P || !G) return;
  const [px, py] = okPos(e),
    x = P.iX(px),
    y = P.iY(py);
  if (OK.gwz === 'x' || OK.gwz === 'y') {
    const a = OK.gwz;
    OK.gvor = { a, v: okGrFang(G, a, a === 'x' ? x : y, e.shiftKey) };
    e.currentTarget.style.cursor = a === 'x' ? 'col-resize' : 'row-resize';
    okGrZeichnen();
    return;
  }
  if (!z || !q) {
    const an = G.oe.some(
      (o) => x >= o.x && x <= o.x + oegTyp(G, o, G.h).b && y >= o.v && y <= o.v + oegTyp(G, o, G.h).h,
    );
    e.currentTarget.style.cursor = an ? 'move' : '';
    return;
  }
  const T = oegTyp(G, q, G.h),
    r = (v) => Math.round(v / OE_RASTER) * OE_RASTER;
  let nx = x + z.dx,
    nv = y + z.dv;
  if (!e.shiftKey) {
    // Kanten rasten an den Außenkanten der anderen Öffnungen, an Teilungslinien und Gruppenrändern ein (10 px),
    // sonst Raster; Brüstung auf die Vorgabe des Typs bzw. den Boden
    const tol = 10 / P.s,
      tl = oegTeilung(G),
      kx = tl.xs.slice(),
      kv = tl.ys.slice();
    G.oe.forEach((o) => {
      if (o === q) return;
      const U = oegTyp(G, o, G.h);
      kx.push(o.x, o.x + U.b);
      kv.push(o.v, o.v + U.h);
    });
    const fang = (a, w, K) => {
      let best = null;
      K.forEach((k) =>
        [k - a, k - (a + w)].forEach((dd) => {
          if (Math.abs(dd) < tol && (best === null || Math.abs(dd) < Math.abs(best))) best = dd;
        }),
      );
      return best;
    };
    const fx = fang(nx, T.b, kx),
      fv = fang(nv, T.h, kv);
    nx = fx !== null ? nx + fx : r(nx);
    nv = Math.abs(nv - T.br) < 0.3 ? T.br : Math.abs(nv) < 0.3 ? 0 : fv !== null ? nv + fv : r(nv);
  }
  q.x = Math.round(nx * 1000) / 1000;
  q.v = Math.max(0, Math.round(nv * 1000) / 1000);
  okGrZeichnen();
}
function okGrUp() {
  if (!OK.gzug) return;
  OK.gzug = null;
  oeAktualisieren();
}
