// ======================= GEBÄUDEKONFIGURATOR: FASSADENGRUPPEN JE GESCHOSS (wie in Forma/Spacio) =======================
// Karte „Fassade“ im Gebäudepanel (Planen): Stapel von Öffnungsgruppen ab dem Erdgeschoss (b.fk.st, Index = Geschoss
// über Gelände; die oberste Zeile gilt für alle Geschosse darüber). Eine Zeile kann mehrere Gruppen als Rhythmus
// kombinieren (Liste, z. B. ['g1', 'g2'] = A–B–A–B …; wiederholt über das Feld). Ausrichtung je Zeile in b.fk.au
// ('l' linksbündig, 'm' mittig = Rest gleichmäßig an beiden Enden, 'r' rechtsbündig), je Gebäudeseite in b.fk.auS
// (Vorrang vor der Zeile; im Fassadendesigner beim Werkzeug „Gruppe“ einstellbar). Abweichungen je Geschoss, Wand oder
// Flucht werden im Modell gesetzt (Auswahl → Kontextleiste „Gruppen“, 26-modellier-modus/140): b.fk.ab =
// { 'Ansicht|Geschoss': Gruppe oder Rhythmus, 'Ansicht|*': …, '*|Geschoss': … }, '' = keine; Ausrichtung in b.fk.auA mit
// demselben Schlüssel. Die Karte zeigt davon nur die Anzahl und „alle entfernen“.
// fkSync() platziert die Gruppen automatisch in allen Fassadenfeldern aller Ansichten (Verweise mit a: 1 in
// b.fd[Ansicht].gr – gleiche Daten wie im Fassadendesigner, daher in Ansicht, 3D und Grundriss sichtbar). Von Hand
// verschobene oder getauschte Verweise verlieren a und bleiben bei der nächsten Platzierung erhalten.

const FK = { wahl: null, kl: null }; // geöffnete Gruppenauswahl { bid, i } bzw. aus der Kontextleiste
const FKCSS = `.fk .fkz{display:flex;align-items:center;gap:8px;padding:4px 0}
.fk .fkz .fkl{width:52px;flex:none;font-size:11px;color:var(--mu)}
.fk .fkz .fkb{flex:none;border:1px solid var(--ln);border-radius:6px;background:var(--bg,#fff);padding:2px;cursor:pointer;line-height:0}
.fk .fkz .fkb:hover{border-color:#5E7F92}.fk .fkz .fkb.on{border-color:#1f6fd1;box-shadow:0 0 0 2px #1f6fd133}
.fk .fkz .fkn{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fk .fkz .fkx{border:0;background:none;color:#c0392b;cursor:pointer;font-size:14px;padding:2px 4px}
.fk .fkp{display:flex;justify-content:center;margin:-6px 0 -6px 52px;position:relative;z-index:1}
.fk .fkp button{width:20px;height:20px;border-radius:50%;border:1px solid var(--ln);background:var(--pn,#fff);cursor:pointer;font-size:13px;line-height:16px;padding:0}
.fk .fkp button:hover{border-color:#5E7F92}
.fk .fkg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:6px 0;padding:8px;border:1px solid var(--ln);border-radius:10px;background:var(--pn,#fff);box-shadow:0 6px 20px #0002}
.fk .fkg div{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border:1px solid var(--ln);border-radius:8px;cursor:pointer;font-size:10.5px;text-align:center;line-height:1.2}
.fk .fkg div:hover{border-color:#5E7F92}.fk .fkg div.on{border-color:#1f6fd1;background:#1f6fd114}
.fk select{width:100%}
#fkWahl{position:fixed;z-index:70;width:300px;max-height:min(520px,calc(100vh - 40px));overflow:auto;padding:10px;border:1px solid var(--ln);border-radius:12px;background:var(--pn,#fff);color:var(--tx);box-shadow:0 12px 40px #0003;font:12px/1.35 system-ui,'Segoe UI',sans-serif}
#fkWahl .fkwh{display:flex;align-items:center;gap:6px;margin-bottom:8px}#fkWahl .fkwh b{flex:1;font-size:13px}
#fkWahl .fkwh button{border:0;background:none;cursor:pointer;font-size:16px;color:var(--mu)}
#fkWahl .fkg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
#fkWahl .fkg div{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border:1px solid var(--ln);border-radius:8px;cursor:pointer;font-size:10.5px;text-align:center;line-height:1.2}
#fkWahl .fkg div:hover{border-color:#5E7F92}#fkWahl .fkg div.on{border-color:#1f6fd1;background:#1f6fd114}
.fk .fka{display:flex;flex:none;border:1px solid var(--ln);border-radius:6px;overflow:hidden}
.fk .fka button{border:0;background:transparent;padding:2px 5px;cursor:pointer;font-size:11px;color:var(--mu)}
.fk .fka button.on{background:#5E7F92;color:#fff}
.fk .fkvs{width:52px;flex:none;font-size:11px;padding:2px 4px;border:1px solid var(--ln);border-radius:6px}
#fkWahl .skgvs{width:60px;font-size:12px;padding:2px 4px;border:1px solid var(--ln);border-radius:6px}`;

/** Konfiguration eines Gebäudes (wird bei Bedarf angelegt). */
function fkDaten(b, mk) {
  if (!b.fk && mk) b.fk = { st: [], ab: {} };
  return b.fk || null;
}
/** Oberirdische Geschosse des Gebäudes: [{ j, name, v0, v1 }] (Ansichtskoordinaten). */
function fkGeschosse(b) {
  const B = fdStoreys(b),
    u = ugN(b);
  return B.slice(0, -1).map((v0, j) => ({ j, name: lname(b, u + j), v0, v1: B[j + 1] }));
}
/** Ausrichtung für Seite vk und Geschoss j: eigene Anordnung → Seite → Zeile des Stapels → mittig. */
function fkAusr(fk, vk, j) {
  // eigene Anordnung (Abweichung) mit Ausrichtung: Seite+Geschoss → Seite → Geschoss
  const A = fk.auA || {},
    ka = [vk + '|' + j, vk + '|*', '*|' + j].find((q) => fk.ab && q in fk.ab && q in A);
  if (ka) return A[ka];
  const s = fk.auS && fk.auS[vk];
  if (s) return s;
  return (fk.au || [])[Math.min(j, Math.max(0, (fk.st || []).length - 1))] || 'm';
}
/**
 * Versatz (m) zur Ausrichtung für Seite vk und Geschoss j: eigene Anordnung (b.fk.vsA) → Zeile des Stapels (b.fk.vs).
 * Links: Abstand vom linken Rand, rechts: vom rechten Rand (positiv = nach innen), mittig: positiv = nach rechts.
 */
function fkVersatz(fk, vk, j) {
  const A = fk.vsA || {},
    ka = [vk + '|' + j, vk + '|*', '*|' + j].find((q) => fk.ab && q in fk.ab && q in A);
  if (ka) return +A[ka] || 0;
  return +(fk.vs || [])[Math.min(j, Math.max(0, (fk.st || []).length - 1))] || 0;
}
/** Versatz der Zeile i setzen (Eingabefeld der Karte). */
function fkVersatzSetzen(i, v) {
  const n = parseFloat(String(v).replace(',', '.'));
  fkAendern((fk) => {
    fk.vs = fk.vs || [];
    fk.vs[i] = isFinite(n) ? Math.max(-50, Math.min(50, Math.round(n * 1000) / 1000)) : 0;
  });
}
/** Ausrichtung je Gebäudeseite setzen ('' = wie Zeile). */
function fkAusrSeite(b, vk, a) {
  hist();
  const fk = fkDaten(b, true);
  fk.auS = fk.auS || {};
  if (a === 'l' || a === 'm' || a === 'r') fk.auS[vk] = a;
  else delete fk.auS[vk];
  rr();
}
/** Eintrag als Liste von Gruppenschlüsseln (eine Gruppe oder Rhythmus mehrerer). */
const fkReihe = (x) => (Array.isArray(x) ? x.filter(Boolean) : x ? [x] : []);
/** Gruppe(n) für Ansicht vk und Geschoss j: Abweichung Seite+Geschoss → Seite → Geschoss → Stapel. */
function fkGruppe(fk, vk, j) {
  const ab = fk.ab || {},
    k = [vk + '|' + j, vk + '|*', '*|' + j].find((q) => q in ab);
  if (k) return ab[k] || null;
  const st = fk.st || [];
  return st.length ? st[Math.min(j, st.length - 1)] || null : null;
}

/**
 * Abweichungen je Abschnitt einer Seite (Fläche oder Flucht, z. B. nach dem Schneiden): b.fk.abU['Seite|Geschoss'] =
 * [{ u0, u1, R, au, vs }] mit u0–u1 entlang der Ansicht; Geschoss '*' = Flucht über alle Geschosse. Geschossbezogene
 * Einträge gehen vor.
 */
function fkAbschnitte(fk, vk, j) {
  const U = fk.abU || {};
  return (U[vk + '|' + j] || []).concat(U[vk + '|*'] || []);
}
/** Automatisch platzierte Verweise neu aufbauen (nur geänderte Gebäude; Takt aus 030-aktionen). */
function fkSync() {
  S.bld.forEach((b) => {
    if (b.ex || !b.fk || b._y == null) return;
    // in Bewegung (LOD 200): Gruppen erst nach der Ruhe neu setzen
    if (l2on() && l2Unruhig(b)) return;
    const sg = JSON.stringify([
      fdSig(b),
      b.fk,
      S.oeg.map((G) => [G.k, G.l, G.h]),
      b.fd ? Object.keys(b.fd).map((k) => b.fd[k].cuts) : 0,
    ]);
    if (b._fkSig === sg) return;
    b._fkSig = sg;
    fkAnwenden(b);
  });
}
/** Gruppen gemäß Konfiguration in alle Fassadenfelder setzen (je Feld und Geschoss, Rest gleichmäßig an den Enden). */
function fkAnwenden(b) {
  const fk = fkDaten(b);
  if (!fk) return;
  const GS = fkGeschosse(b);
  fdViews(b).forEach((V) => {
    const L = oegDaten(b, V.key, true),
      hand = L.filter((I) => !I.a),
      F0 = fdFaces(b, V),
      feld = (I) => {
        const H = oegG(I.g);
        return F0.findIndex((f) => grInFace(f, I.u + (H ? oegL(I, H) : 0) / 2, I.v + 0.5));
      },
      // Reihen (Ansichtsfläche + Höhe), in denen von Hand getauscht/verschoben wurde, bleiben komplett so wie sie
      // sind – auch die automatisch gesetzten Gruppen daneben (sonst verschwänden sie beim nächsten Platzieren)
      fest = hand.map((I) => [feld(I), I.v]),
      inFest = (I) => fest.some(([fi, v]) => Math.abs(v - I.v) < 0.01 && fi === feld(I)),
      bleibt = L.filter((I) => !I.a || inFest(I));
    // übrige automatische Verweise entfernen (werden neu platziert)
    L.splice(0, L.length, ...bleibt);
    // Rhythmus wiederholen, solange die nächste Gruppe noch passt; Rest gleichmäßig an beiden Enden
    // Ausrichtung mit Versatz: links/rechts verkürzt ein positiver Versatz den verfügbaren Platz am Rand
    const setze = (a, c, R, au, vs, v0) => {
      const rand = au === 'm' ? 0 : Math.max(0, vs),
        folge = [];
      let lang = 0;
      for (let i = 0; i < 500; i++) {
        const G = R[i % R.length];
        if (lang + G.l > c - a - rand + 1e-6) break;
        folge.push(G);
        lang += G.l;
      }
      const rest = c - a - lang;
      let u = au === 'l' ? a + vs : au === 'r' ? a + rest - vs : a + rest / 2 + vs;
      // im Feld halten
      u = Math.max(a, Math.min(a + rest, u));
      // Pfosten-Riegel: bis zu den Enden der Fläche, Randfelder je nach Ausrichtung angepasst (oegReihe)
      oegReihe(folge, u, a, c, R[folge.length % R.length], au).forEach((o) =>
        L.push({ id: oegNeuId(), g: o.G.k, u: o.u, v: v0, a: 1, ...(o.l ? { l: o.l, lv: o.lv || 0 } : {}) }),
      );
    };
    const reihe = (x) => fkReihe(x).map(oegG).filter(Boolean);
    fdFaces(b, V).forEach((f) =>
      GS.forEach((gs) => {
        const Rd = reihe(fkGruppe(fk, V.key, gs.j)),
          Ov = fkAbschnitte(fk, V.key, gs.j),
          alle = Rd.concat(...Ov.map((o) => reihe(o.R)));
        if (!alle.length) return;
        const hMin = Math.min(...alle.map((G) => G.h)),
          r = fdBandU(f, gs.v0 + 0.05, Math.min(gs.v1, gs.v0 + hMin) - 0.05);
        if (!r || !grInFace(f, (r[0] + r[1]) / 2, gs.v0 + 0.5)) return;
        const [a, c] = r;
        // Bereiche mit von Hand gesetzten Gruppen bleiben unberührt
        if (
          hand.some((I) => {
            const H = oegG(I.g),
              m = I.u + (H ? oegL(I, H) : 0) / 2;
            return Math.abs(I.v - gs.v0) < 0.01 && m >= a && m <= c;
          })
        )
          return;
        // an den Grenzen der Abschnitte teilen; jeder Teil mit eigener Anordnung (Abschnitt) oder der der Seite
        const P = [a, c];
        Ov.forEach((o) => [o.u0, o.u1].forEach((x) => x > a + 0.05 && x < c - 0.05 && P.push(x)));
        P.sort((x, y) => x - y);
        for (let k = 0; k + 1 < P.length; k++) {
          const s0 = P[k],
            s1 = P[k + 1];
          if (s1 - s0 < 0.05) continue;
          const m = (s0 + s1) / 2,
            o = Ov.find((x) => m > x.u0 && m < x.u1);
          if (o) {
            const R = reihe(o.R);
            if (R.length) setze(s0, s1, R, o.au || 'm', +o.vs || 0, gs.v0);
          } else if (Rd.length) setze(s0, s1, Rd, fkAusr(fk, V.key, gs.j), fkVersatz(fk, V.key, gs.j), gs.v0);
        }
      }),
    );
    if (!L.length) {
      const d = fdD(b, V.key);
      if (d) delete d.gr;
    }
  });
  FDS.ps = '';
  FDS.dirty = 1;
  try {
    neuZeichnen();
  } catch (e) {
    logErr(e, 'fkAnwenden');
  }
}

// ---- Bearbeiten (Karte)
function fkAendern(fn) {
  const b = S.sel && !S.sel.ex ? S.sel : null;
  if (!b) return;
  hist();
  fn(fkDaten(b, true), b);
  const w = document.getElementById('fkWahl');
  if (w) w.style.display = 'none';
  FK.wahl = null;
  rr();
}
/** Platz s (Rhythmus) der Zeile i auf Gruppe k setzen; '' entfernt den Platz (bzw. „keine“, wenn es der letzte ist). */
function fkSetze(i, k, s = 0) {
  fkAendern((fk) => {
    const R = fkReihe(fk.st[i]);
    if (oegG(k)) R[s] = k;
    else R.splice(s, 1);
    fk.st[i] = R.length > 1 ? R : R[0] || '';
  });
}
/** Zeile über Zeile i einfügen (gleiche Gruppe), bzw. erste Zeile anlegen. */
function fkNeu(i) {
  fkAendern((fk) => {
    const k = fk.st.length ? fk.st[Math.max(0, Math.min(i, fk.st.length - 1))] : S.oeg[0] ? S.oeg[0].k : '';
    fk.st.splice(i + 1, 0, Array.isArray(k) ? k.slice() : k);
    fk.au = fk.au || [];
    fk.au.splice(i + 1, 0, fk.au[i] || 'm');
    fk.vs = fk.vs || [];
    fk.vs.splice(i + 1, 0, fk.vs[i] || 0);
  });
}
function fkLoeschen(i) {
  fkAendern((fk) => {
    fk.st.splice(i, 1);
    if (fk.au) fk.au.splice(i, 1);
    if (fk.vs) fk.vs.splice(i, 1);
  });
}
// ---- Fassadenmaterial je Geschoss (b.fk.mt, Stapel wie die Gruppen; oberste Zeile gilt für alle darüber).
// Voreinstellung für Ansichtsflächen ohne eigenen Fassadentyp – Ansicht (040-fang) und Flächen nach Typ (fdStats).
/** Material (Fassadentyp-Schlüssel) für das oberirdische Geschoss j, '' = keins. */
function fkMaterial(b, j) {
  const mt = (b && b.fk && b.fk.mt) || [];
  if (!mt.length) return '';
  const k = mt[Math.max(0, Math.min(j, mt.length - 1))];
  return S.ft.some((t) => t.k === k && !t.df) ? k : '';
}
/** Fläche f einer Ansicht nach Geschossen der Voreinstellung aufteilen: [{ t, a }] (nur bei f.t === 'ohne'). */
function fkMaterialAnteile(b, f) {
  if (!b.fk || !b.fk.mt || !b.fk.mt.length || f.t !== 'ohne') return null;
  const flaeche = (r, v0, v1) => Math.abs(fvPA(fwClip(fwClip(r, 0, 1, -v0, 1), 0, -1, v1, 1))),
    out = [];
  fkGeschosse(b).forEach((g, j) => {
    const v1 = j === fkGeschosse(b).length - 1 ? 1e4 : g.v1,
      a = flaeche(f.o, g.v0, v1) - (f.h || []).reduce((s, h) => s + flaeche(h, g.v0, v1), 0),
      t = fkMaterial(b, j) || 'ohne';
    if (a > 1e-4) out.push({ t, a, v0: g.v0, v1 });
  });
  return out;
}
function fkMtSetze(i, k) {
  fkAendern((fk) => {
    fk.mt = fk.mt || [];
    fk.mt[i] = S.ft.some((t) => t.k === k) ? k : '';
  });
  FDS.dirty = 1;
}
function fkMtNeu(i) {
  fkAendern((fk) => {
    fk.mt = fk.mt || [];
    const k = fk.mt.length
      ? fk.mt[Math.max(0, Math.min(i, fk.mt.length - 1))]
      : (S.ft.find((t) => !t.df) || {}).k || '';
    fk.mt.splice(i + 1, 0, k);
  });
  FDS.dirty = 1;
}
function fkMtLoeschen(i) {
  fkAendern((fk) => {
    (fk.mt = fk.mt || []).splice(i, 1);
  });
  FDS.dirty = 1;
}
/**
 * Außenwandstärke des Gebäudes (cm) für LOD 200 – gleiche Daten wie die Standardstärke im Bauteilkonfigurator
 * (b.l2.c.AW); Einzelwerte einzelner Außenwände werden dabei zurückgesetzt.
 */
function fkWandstaerke(v) {
  const b = S.sel && !S.sel.ex ? S.sel : null,
    cm = Math.round(parseFloat(String(v).replace(',', '.')) * 2) / 2;
  if (!b || !(cm >= 5 && cm <= 80)) return;
  hist();
  b.l2 = b.l2 || {};
  b.l2.c = Object.assign({}, b.l2.c || {}, { AW: cm });
  b.l2.rwc = {};
  (b.levels || []).forEach((l) => {
    if (l.l2 && l.l2.tc) l.l2.tc = l.l2.tc.filter((q) => q.k !== 'AW');
  });
  b._l2 = null;
  rr();
}
/** Abschnitt „Fassadenmaterial“ der Karte. */
function fkMtHtml(fk, GS) {
  const mt = fk.mt || [],
    ft = S.ft.filter((t) => !t.df);
  let h = `<div class="mu" style="font-size:11px;margin:12px 0 6px">Fassadenmaterial je Geschoss – Voreinstellung für alle Flächen ohne eigenen Fassadentyp (auch in der Fassadenansicht).</div>`;
  if (!mt.length)
    return (
      h + `<button class="sm" style="width:100%" onclick="fkMtNeu(-1)">+ Material für alle Geschosse</button>`
    );
  for (let i = mt.length - 1; i >= 0; i--) {
    if (i < GS.length - 1)
      h += `<div class="fkp"><button onclick="fkMtNeu(${i})" title="Zeile darüber einfügen">+</button></div>`;
    const lab = GS[i]
        ? i === mt.length - 1 && i < GS.length - 1
          ? 'ab ' + GS[i].name
          : GS[i].name
        : 'ab ' + (GS[GS.length - 1] || {}).name,
      c = mt[i] ? fdT(mt[i]).c : '#f4f3f0';
    h += `<div class="fkz"><span class="fkl">${esc(lab)}</span><span style="flex:none;width:56px;height:30px;border:1px solid var(--ln);border-radius:6px;background:${c}"></span><select class="fkn" style="flex:1;min-width:0" onchange="fkMtSetze(${i},this.value)"><option value="" ${!mt[i] ? 'selected' : ''}>— keins —</option>${ft.map((t) => `<option value="${t.k}" ${t.k === mt[i] ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select><button class="fkx" onclick="fkMtLoeschen(${i})" title="Zeile löschen">🗑</button></div>`;
  }
  return h;
}
/** Ausrichtung der Zeile i: 'l' links, 'm' mittig, 'r' rechts. */
function fkAusrichtung(i, a) {
  fkAendern((fk) => {
    fk.au = fk.au || [];
    fk.au[i] = a === 'l' || a === 'r' ? a : 'm';
  });
}
/**
 * Gruppenauswahl für Platz s der Zeile i als eigenes Fenster neben der angeklickten Vorschau öffnen bzw. schließen
 * (s = Länge der Folge: neue Gruppe anhängen). Schließt mit ×, Esc oder Klick daneben.
 */
function fkWahlAuf(i, s = 0, el) {
  const b = S.sel;
  if (!b) return;
  if (FK.wahl && FK.wahl.i === i && FK.wahl.s === s && FK.wahl.bid === b.id) {
    fkWahlZu();
    return;
  }
  FK.wahl = { bid: b.id, i, s };
  const fk = fkDaten(b) || { st: [] },
    R = fkReihe(fk.st[i]),
    cur = R[s],
    GS = fkGeschosse(b),
    leer =
      '<svg width="56" height="30"><rect x="1" y="1" width="54" height="28" fill="#f4f3f0" stroke="#cbd5e1"/></svg>';
  const w = fkWahlEl();
  const zeile = GS[i] ? GS[i].name : 'oberste Zeile';
  w.innerHTML = `<div class="fkwh"><b>Gruppe wählen</b><span class="mu">${esc(zeile)}${R.length > 1 || s >= R.length ? ' · Rhythmus ' + (s + 1) : ''}</span><button onclick="fkWahlZu()" title="Schließen (Esc)">×</button></div><div class="fkg">${S.oeg
    .map(
      (G) =>
        `<div class="${G.k === cur ? 'on' : ''}" onclick="fkSetze(${i},'${G.k}',${s})">${oegSymbol(G, 56, 30)}${esc(G.n)}</div>`,
    )
    .join(
      '',
    )}${s < R.length ? `<div onclick="fkSetze(${i},'',${s})">${leer}${R.length > 1 ? 'Aus Rhythmus entfernen' : 'Keine'}</div>` : ''}<div onclick="fkWahlZu();okOpen(null,'gr')" title="Gruppen im Konfigurator anlegen">${leer}+ Gruppe …</div></div>`;
  w.style.display = 'block';
  // links neben der Vorschau (Panel liegt rechts), im Bildschirm halten
  const r = el ? el.getBoundingClientRect() : { left: window.innerWidth - 360, top: 120, bottom: 150 },
    bw = 300,
    bh = Math.min(w.scrollHeight, window.innerHeight - 40);
  w.style.left = Math.max(10, r.left - bw - 12) + 'px';
  w.style.top = Math.max(10, Math.min(window.innerHeight - bh - 10, r.top - 20)) + 'px';
  rr();
}
/** Fenster der Gruppenauswahl (einmal angelegt; Klick daneben bzw. Esc schließt). Auch für die Kontextleiste. */
function fkWahlEl() {
  fkCssSicher();
  let w = document.getElementById('fkWahl');
  if (!w) {
    w = document.createElement('div');
    w.id = 'fkWahl';
    document.body.appendChild(w);
    document.addEventListener(
      'pointerdown',
      (e) => {
        const f = document.getElementById('fkWahl');
        if (f && f.style.display !== 'none' && !f.contains(e.target) && !e.target.closest('.fkb')) fkWahlZu();
      },
      true,
    );
    document.addEventListener('keydown', (e) => {
      const f = document.getElementById('fkWahl');
      if (e.key === 'Escape' && f && f.style.display !== 'none') fkWahlZu();
    });
  }
  return w;
}
function fkCssSicher() {
  if (document.getElementById('fkCss')) return;
  const s = document.createElement('style');
  s.id = 'fkCss';
  s.textContent = FKCSS;
  document.head.appendChild(s);
}
function fkWahlZu() {
  const w = document.getElementById('fkWahl');
  if (w) w.style.display = 'none';
  // ── Erweiterung aus 26-modellier-modus/140-kontextleiste.js
  if (FK.kl) {
    FK.kl = null;
    SK.ver++;
  }
  if (FK.wahl) {
    FK.wahl = null;
    rr();
  }
}
/** Abweichung festlegen (Seite vk oder '*', Geschoss j oder '*'; k Gruppe, '' keine, null = Abweichung entfernen). */
function fkAbweichung(vk, j, k) {
  if (vk === '*' && j === '*') return;
  fkAendern((fk) => {
    fk.ab = fk.ab || {};
    const key = vk + '|' + j;
    if (k === null) {
      delete fk.ab[key];
      if (fk.auA) delete fk.auA[key];
      if (fk.vsA) delete fk.vsA[key];
    } else fk.ab[key] = oegG(k) ? k : '';
  });
}
/** Alle eigenen Anordnungen (Abweichungen je Geschoss, Wand, Flucht) des gewählten Gebäudes entfernen. */
function fkAbweichungenWeg() {
  fkAendern((fk) => {
    fk.ab = {};
    fk.auA = {};
    fk.vsA = {};
  });
}

// ---- Karte im Gebäudepanel (aus 07-analyse/010-analyse.js)
function fkCard(b) {
  fkCssSicher();
  let V = [],
    GS = [];
  try {
    V = fdViews(b);
    GS = fkGeschosse(b);
  } catch (e) {
    logErr(e, 'fkCard');
  }
  if (!V.length || !GS.length) return '';
  const fk = fkDaten(b) || { st: [], ab: {} },
    st = fk.st,
    name = (k) => (oegG(k) ? oegG(k).n : '— keine —'),
    sym = (k, w = 56, hh = 30) =>
      oegG(k)
        ? oegSymbol(oegG(k), w, hh)
        : `<svg width="${w}" height="${hh}"><rect x="1" y="1" width="${w - 2}" height="${hh - 2}" fill="#f4f3f0" stroke="#cbd5e1"/></svg>`,
    zeile = (i) => {
      const bis = i === st.length - 1,
        R = fkReihe(st[i]),
        lab = GS[i]
          ? bis && i < GS.length - 1
            ? 'ab ' + GS[i].name
            : GS[i].name
          : 'ab ' + (GS[GS.length - 1] || {}).name,
        w = FK.wahl && FK.wahl.bid === b.id && FK.wahl.i === i ? FK.wahl : null,
        // im Rhythmus kleinere Vorschau, damit mehrere Gruppen in eine Zeile passen
        bild = (k, s) =>
          `<button class="fkb${w && w.s === s ? ' on' : ''}" onclick="fkWahlAuf(${i},${s},this)" title="${s === 0 ? 'Gruppe wählen' : 'Gruppe im Rhythmus wählen'}">${R.length > 1 ? sym(k, 34, 20) : sym(k)}</button>`;
      let h = `<div class="fkz"><span class="fkl">${esc(lab)}</span><span style="display:flex;gap:3px;align-items:center;flex:none">${(R.length ? R : ['']).map((k, s) => bild(k, s)).join('')}${R.length ? `<button class="fkb" style="padding:4px 7px;line-height:1" onclick="fkWahlAuf(${i},${R.length},this)" title="Weitere Gruppe kombinieren (Rhythmus)">+</button>` : ''}</span><span class="fkn" title="${esc(R.map(name).join(' – '))}">${esc(R.length > 1 ? R.length + ' Gruppen im Wechsel' : name(R[0]))}</span><span class="fka">${[
        ['l', '⇤', 'linksbündig'],
        ['m', '↔', 'mittig (Rest an beiden Enden)'],
        ['r', '⇥', 'rechtsbündig'],
      ]
        .map(
          ([k, z, tt]) =>
            `<button class="${((fk.au || [])[i] || 'm') === k ? 'on' : ''}" onclick="fkAusrichtung(${i},'${k}')" title="${tt}">${z}</button>`,
        )
        .join(
          '',
        )}</span><input type="number" step="0.05" class="fkvs" value="${+(+((fk.vs || [])[i] || 0)).toFixed(3)}" title="Versatz in m zur Ausrichtung: links/rechts = Abstand vom Rand (positiv nach innen), mittig = positiv nach rechts" onchange="fkVersatzSetzen(${i},this.value)"><button class="fkx" onclick="fkLoeschen(${i})" title="Zeile löschen">🗑</button></div>`;
      return h;
    };
  const aw = (b.l2 && b.l2.c && b.l2.c.AW) || L2DC.AW;
  let h = `<h4>Fassade</h4><div class="card fk"><div class="fkz"><span class="fkn" title="Stärke der Außenwände in LOD 200 (gleich der Standardstärke im Bauteilkonfigurator)">Außenwandstärke</span><input type="number" step="0.5" min="5" max="80" value="${aw}" style="width:64px" onchange="fkWandstaerke(this.value)"><span class="mu" style="font-size:11px">cm</span></div><div class="mu" style="font-size:11px;margin:8px 0 6px">Öffnungsgruppen je Geschoss, ab Erdgeschoss – die oberste Zeile gilt für alle Geschosse darüber. Wird in allen Ansichten platziert.</div>`;
  if (!st.length)
    h += `<button class="sm" style="width:100%" onclick="fkNeu(-1)">+ Gruppe für alle Geschosse</button>`;
  else {
    for (let i = st.length - 1; i >= 0; i--) {
      if (i < GS.length - 1)
        h += `<div class="fkp"><button onclick="fkNeu(${i})" title="Zeile darüber einfügen">+</button></div>`;
      h += zeile(i);
    }
  }
  // Abweichungen je Geschoss, Wand oder Flucht werden im Modell gesetzt (Auswahl → Kontextleiste „Gruppen“);
  // hier nur die Anzahl und „alle entfernen“
  const nAb = Object.keys(fk.ab || {}).length;
  h += `<div class="mu" style="font-size:11px;margin:10px 0 4px">${nAb ? nAb + ' eigene Anordnung' + (nAb === 1 ? '' : 'en') + ' im Modell gesetzt · ' : ''}Abweichungen je Geschoss oder Fläche: im Modell wählen → „Gruppen“${nAb ? ` · <a href="#" onclick="fkAbweichungenWeg();return false">alle entfernen</a>` : ''}</div>`;
  h += fkMtHtml(fk, GS);
  h += `<div style="display:flex;gap:4px;margin-top:8px"><button class="sm" style="flex:1" onclick="fdOpen('${esc(b.id)}')">▦ Fassadendesigner</button><button class="sm" style="flex:1" onclick="okOpen(null,'gr')">Gruppen …</button></div></div>`;
  return h;
}
