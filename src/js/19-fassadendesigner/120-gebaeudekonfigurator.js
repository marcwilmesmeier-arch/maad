// ======================= GEBÄUDEKONFIGURATOR: FASSADENGRUPPEN JE GESCHOSS (wie in Forma/Spacio) =======================
// Karte „Fassade“ im Gebäudepanel (Planen): Stapel von Öffnungsgruppen ab dem Erdgeschoss (b.fk.st, Index = Geschoss
// über Gelände; die oberste Zeile gilt für alle Geschosse darüber), Abweichungen je Seite (Ansicht), je Geschoss oder
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
.fk select{width:100%}`;

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
/** Gruppe für Ansicht vk und Geschoss j: Abweichung Seite+Geschoss → Seite → Geschoss → Stapel. */
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
        const G = oegG(fkGruppe(fk, V.key, gs.j));
        if (!G) return;
        const r = fdBandU(f, gs.v0 + 0.05, Math.min(gs.v1, gs.v0 + G.h) - 0.05);
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
        const n = Math.floor((c - a + 1e-6) / G.l),
          s = a + (c - a - n * G.l) / 2;
        for (let i = 0; i < n; i++) L.push({ id: oegNeuId(), g: G.k, u: s + i * G.l, v: gs.v0, a: 1 });
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
  FK.wahl = null;
  rr();
}
/** Zeile i des Stapels auf Gruppe k setzen ('' = keine). */
function fkSetze(i, k) {
  fkAendern((fk) => {
    fk.st[i] = oegG(k) ? k : '';
  });
}
/** Zeile über Zeile i einfügen (gleiche Gruppe), bzw. erste Zeile anlegen. */
function fkNeu(i) {
  fkAendern((fk) => {
    const k = fk.st.length ? fk.st[Math.max(0, Math.min(i, fk.st.length - 1))] : S.oeg[0] ? S.oeg[0].k : '';
    fk.st.splice(i + 1, 0, k);
  });
}
function fkLoeschen(i) {
  fkAendern((fk) => fk.st.splice(i, 1));
}
/** Gruppenauswahl für Zeile i öffnen/schließen. */
function fkWahlAuf(i) {
  const b = S.sel;
  FK.wahl = FK.wahl && FK.wahl.i === i && FK.wahl.bid === b.id ? null : { bid: b.id, i };
  rr();
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
    sym = (k) =>
      oegG(k)
        ? oegSymbol(oegG(k), 56, 30)
        : '<svg width="56" height="30"><rect x="1" y="1" width="54" height="28" fill="#f4f3f0" stroke="#cbd5e1"/></svg>',
    zeile = (i) => {
      const bis = i === st.length - 1,
        lab = GS[i]
          ? bis && i < GS.length - 1
            ? 'ab ' + GS[i].name
            : GS[i].name
          : 'ab ' + (GS[GS.length - 1] || {}).name,
        offen = FK.wahl && FK.wahl.bid === b.id && FK.wahl.i === i;
      let h = `<div class="fkz"><span class="fkl">${esc(lab)}</span><button class="fkb${offen ? ' on' : ''}" onclick="fkWahlAuf(${i})" title="Gruppe wählen">${sym(st[i])}</button><span class="fkn">${esc(name(st[i]))}</span><button class="fkx" onclick="fkLoeschen(${i})" title="Zeile löschen">🗑</button></div>`;
      if (offen)
        h += `<div class="fkg">${S.oeg
          .map(
            (G) =>
              `<div class="${G.k === st[i] ? 'on' : ''}" onclick="fkSetze(${i},'${G.k}')">${oegSymbol(G, 56, 30)}${esc(G.n)}</div>`,
          )
          .join(
            '',
          )}<div class="${!st[i] ? 'on' : ''}" onclick="fkSetze(${i},'')">${sym('')}Keine</div><div onclick="okOpen(null,'gr')" title="Gruppen im Konfigurator anlegen">${sym('')}+ Gruppe …</div></div>`;
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
  h += `<div style="display:flex;gap:4px;margin-top:8px"><button class="sm" style="flex:1" onclick="fdOpen('${esc(b.id)}')">▦ Fassadendesigner</button><button class="sm" style="flex:1" onclick="okOpen(null,'gr')">Gruppen …</button></div></div>`;
  return h;
}
