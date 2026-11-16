// ======================= GEBÄUDEKONFIGURATOR: FASSADENGRUPPEN JE GESCHOSS (wie in Forma/Spacio) =======================
// Karte „Fassade“ im Gebäudepanel (Planen): Stapel von Öffnungsgruppen ab dem Erdgeschoss (b.fk.st, Index = Geschoss
// über Gelände; die oberste Zeile gilt für alle Geschosse darüber). Eine Zeile kann mehrere Gruppen als Rhythmus
// kombinieren (Liste, z. B. ['g1', 'g2'] = A–B–A–B …; wiederholt über das Feld). Ausrichtung je Zeile in b.fk.au
// ('l' linksbündig, 'm' mittig = Rest gleichmäßig an beiden Enden, 'r' rechtsbündig), je Gebäudeseite in b.fk.auS
// (Vorrang vor der Zeile; auch im Fassadendesigner beim Werkzeug „Gruppe“ einstellbar), Abweichungen je Seite (Ansicht), je Geschoss oder
// je Seite und Geschoss (b.fk.ab = { 'Ansicht|Geschoss': Gruppe, 'Ansicht|*': …, '*|Geschoss': … }; '' = keine).
// fkSync() platziert die Gruppen automatisch in allen Fassadenfeldern aller Ansichten (Verweise mit a: 1 in
// b.fd[Ansicht].gr – gleiche Daten wie im Fassadendesigner, daher in Ansicht, 3D und Grundriss sichtbar). Von Hand
// verschobene oder getauschte Verweise verlieren a und bleiben bei der nächsten Platzierung erhalten.

const FK = { wahl: null }; // geöffnete Gruppenauswahl { bid, i }
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
.fk .fka button.on{background:#5E7F92;color:#fff}`;

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
/** Ausrichtung für Seite vk und Geschoss j: Seite → Zeile des Stapels → mittig. */
function fkAusr(fk, vk, j) {
  const s = fk.auS && fk.auS[vk];
  if (s) return s;
  return (fk.au || [])[Math.min(j, Math.max(0, (fk.st || []).length - 1))] || 'm';
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

/** Automatisch platzierte Verweise neu aufbauen (nur geänderte Gebäude; Takt aus 030-aktionen). */
function fkSync() {
  S.bld.forEach((b) => {
    if (b.ex || !b.fk || b._y == null) return;
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
      hand = L.filter((I) => !I.a);
    // bisherige automatische Verweise entfernen
    L.splice(0, L.length, ...hand);
    fdFaces(b, V).forEach((f) =>
      GS.forEach((gs) => {
        const R = fkReihe(fkGruppe(fk, V.key, gs.j))
          .map(oegG)
          .filter(Boolean);
        if (!R.length) return;
        const hMin = Math.min(...R.map((G) => G.h)),
          r = fdBandU(f, gs.v0 + 0.05, Math.min(gs.v1, gs.v0 + hMin) - 0.05);
        if (!r || !grInFace(f, (r[0] + r[1]) / 2, gs.v0 + 0.5)) return;
        const [a, c] = r;
        // Bereiche mit von Hand gesetzten Gruppen bleiben unberührt
        if (
          hand.some((I) => {
            const H = oegG(I.g),
              m = I.u + (H ? H.l : 0) / 2;
            return Math.abs(I.v - gs.v0) < 0.01 && m >= a && m <= c;
          })
        )
          return;
        // Rhythmus wiederholen, solange die nächste Gruppe noch passt; Rest gleichmäßig an beiden Enden
        const folge = [];
        let lang = 0;
        for (let i = 0; i < 500; i++) {
          const G = R[i % R.length];
          if (lang + G.l > c - a + 1e-6) break;
          folge.push(G);
          lang += G.l;
        }
        const au = fkAusr(fk, V.key, gs.j),
          rest = c - a - lang;
        let u = au === 'l' ? a : au === 'r' ? a + rest : a + rest / 2;
        folge.forEach((G) => {
          L.push({ id: oegNeuId(), g: G.k, u, v: gs.v0, a: 1 });
          u += G.l;
        });
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
  });
}
function fkLoeschen(i) {
  fkAendern((fk) => {
    fk.st.splice(i, 1);
    if (fk.au) fk.au.splice(i, 1);
  });
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
  let w = document.getElementById('fkWahl');
  if (!w) {
    w = document.createElement('div');
    w.id = 'fkWahl';
    document.body.appendChild(w);
    // Klick daneben bzw. Esc schließt
    document.addEventListener(
      'pointerdown',
      (e) => {
        const f = document.getElementById('fkWahl');
        if (f && f.style.display !== 'none' && !f.contains(e.target) && !e.target.closest('.fkb')) fkWahlZu();
      },
      true,
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && FK.wahl) fkWahlZu();
    });
  }
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
function fkWahlZu() {
  const w = document.getElementById('fkWahl');
  if (w) w.style.display = 'none';
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
    if (k === null) delete fk.ab[key];
    else fk.ab[key] = oegG(k) ? k : '';
  });
}
function fkAbweichungAusFormular() {
  const sv = document.getElementById('fkSeite'),
    gv = document.getElementById('fkGesch'),
    kv = document.getElementById('fkGr');
  if (sv && gv && kv) fkAbweichung(sv.value, gv.value, kv.value);
}

// ---- Karte im Gebäudepanel (aus 07-analyse/010-analyse.js)
function fkCard(b) {
  if (!document.getElementById('fkCss')) {
    const s = document.createElement('style');
    s.id = 'fkCss';
    s.textContent = FKCSS;
    document.head.appendChild(s);
  }
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
        )}</span><button class="fkx" onclick="fkLoeschen(${i})" title="Zeile löschen">🗑</button></div>`;
      return h;
    };
  let h = `<h4>Fassade</h4><div class="card fk"><div class="mu" style="font-size:11px;margin-bottom:6px">Öffnungsgruppen je Geschoss, ab Erdgeschoss – die oberste Zeile gilt für alle Geschosse darüber. Wird in allen Ansichten platziert.</div>`;
  if (!st.length)
    h += `<button class="sm" style="width:100%" onclick="fkNeu(-1)">+ Gruppe für alle Geschosse</button>`;
  else {
    for (let i = st.length - 1; i >= 0; i--) {
      if (i < GS.length - 1)
        h += `<div class="fkp"><button onclick="fkNeu(${i})" title="Zeile darüber einfügen">+</button></div>`;
      h += zeile(i);
    }
  }
  // Abweichungen je Seite / Geschoss
  const ab = fk.ab || {},
    seite = (vk) =>
      vk === '*' ? 'alle Seiten' : ((V.find((v) => v.key === vk) || {}).name || vk).replace('Ansicht ', ''),
    gesch = (j) => (j === '*' ? 'alle Geschosse' : (GS[+j] || {}).name || j),
    vorwahl = FDS.open && FDS.vk && FDS.vk !== '*' ? FDS.vk : '*';
  h += `<div class="mu" style="font-size:11px;margin:10px 0 4px">Abweichung je Seite oder Geschoss</div>
<div style="display:flex;gap:4px"><select id="fkSeite" title="Seite (Ansicht)"><option value="*">Alle Seiten</option>${V.map((v) => `<option value="${v.key}" ${v.key === vorwahl ? 'selected' : ''}>${esc(v.name.replace('Ansicht ', ''))}</option>`).join('')}</select><select id="fkGesch" title="Geschoss"><option value="*">Alle Geschosse</option>${GS.map((g) => `<option value="${g.j}">${esc(g.name)}</option>`).join('')}</select></div>
<div style="display:flex;gap:4px;margin-top:4px"><select id="fkGr"><option value="">— keine —</option>${S.oeg.map((G) => `<option value="${G.k}">${esc(G.n)}</option>`).join('')}</select><button class="sm" onclick="fkAbweichungAusFormular()">Festlegen</button></div>`;
  const keys = Object.keys(ab);
  if (keys.length)
    h += keys
      .map((k) => {
        const [vk, j] = k.split('|');
        return `<div class="fkz"><span class="fkn">${esc(seite(vk))} · ${esc(gesch(j))}: <b>${esc(name(ab[k]))}</b></span><button class="fkx" onclick="fkAbweichung('${vk}','${j}',null)" title="Abweichung entfernen">×</button></div>`;
      })
      .join('');
  if (st.length)
    h +=
      `<div class="mu" style="font-size:11px;margin:10px 0 4px">Ausrichtung je Seite</div>` +
      V.map((v) => {
        const cur = (fk.auS || {})[v.key] || '';
        return `<div class="fkz"><span class="fkn">${esc(v.name.replace('Ansicht ', ''))}</span><span class="fka">${[
          ['', 'wie Zeile', 'Ausrichtung der Zeile'],
          ['l', '⇤', 'linksbündig'],
          ['m', '↔', 'mittig'],
          ['r', '⇥', 'rechtsbündig'],
        ]
          .map(
            ([k, z, tt]) =>
              `<button class="${cur === k ? 'on' : ''}" onclick="fkAusrSeite(S.sel,'${v.key}','${k}')" title="${tt}">${z}</button>`,
          )
          .join('')}</span></div>`;
      }).join('');
  h += `<div style="display:flex;gap:4px;margin-top:8px"><button class="sm" style="flex:1" onclick="fdOpen('${esc(b.id)}')">▦ Fassadendesigner</button><button class="sm" style="flex:1" onclick="okOpen(null,'gr')">Gruppen …</button></div></div>`;
  return h;
}
