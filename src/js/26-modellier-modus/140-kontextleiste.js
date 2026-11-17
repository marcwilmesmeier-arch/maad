/* Auswahlmatrix (Mischung aus Forma und Spacio):
   – Auswahlfilter unten in der 3D-Ansicht: Auto · Gebäude · Geschoss · Fläche · Flucht (was ein Klick trifft)
   – Kontextleiste schwebt über der Auswahl und zeigt nur die Aktionen, die für diese Auswahl möglich sind
   – Farben der Hervorhebung unabhängig von der Nutzungsfarbe (Orange) */
const SKC = { sel: 0xf07a12, hv: 0xffa64d };
const SKF = [
  [
    'a',
    'Auto',
    'Klick = Gebäude, weiterer Klick = Fläche · Doppelklick Fläche · Dreifach Geschoss · Vierfach Flucht',
  ],
  ['g', 'Gebäude', 'Klick wählt das ganze Gebäude'],
  ['s', 'Geschoss', 'Klick wählt alle Wände und die Decke eines Geschosses'],
  ['f', 'Fläche', 'Klick wählt genau eine Fläche (Wand eines Geschosses, Dach)'],
  ['r', 'Flucht', 'Klick wählt die Wand in einer Flucht über alle Geschosse'],
];
SK.flt = 'a';
// Was ein Klick (Anzahl n, Modus m) mit dem aktuellen Filter wählt – auch für die Hover-Vorschau
function skKlickListe(en, n, m) {
  const lvl = () => skBld(en.b).filter((x) => x.j === en.j && !szSp(x)),
    f = SK.flt;
  if (szSp(en)) return f === 'g' ? skBld(en.b) : [en];
  // ── Erweiterung aus 150-ecken.js: Seitenecke als Konturflucht über alle Geschosse (Filter Fläche = nur dieses Geschoss)
  if (en.ek != null) {
    if (f === 'g') return skBld(en.b);
    if (f === 'f' || m !== 'rep') return [en];
    if (n === 1 && !(SK.sel.length && SK.sel.every((x) => x.b === en.b))) return skBld(en.b);
    return skEckGruppe(en);
  }
  // eine Fläche: bei Ausrundungen die ganze gerundete Fläche (150-ecken.js)
  const eins = () => skGlattKette(en);
  if (f === 'g') return skBld(en.b);
  if (f === 's') return en.top ? [en] : lvl();
  if (f === 'f') return eins();
  if (f === 'r') return skGroup(en);
  if (m !== 'rep') return n >= 3 ? lvl() : eins();
  if (n === 1) {
    const drin = SK.sel.length && SK.sel.every((x) => x.b === en.b);
    return drin ? eins() : skBld(en.b);
  }
  if (n === 2) return eins();
  if (n === 3) return en.top ? [en] : lvl();
  return skGroup(en);
}
// Hover-Vorschau: genau das, was ein Klick bzw. das Werkzeug trifft
function skHoverListe(en) {
  if (SK.tool === 's') return skKlickListe(en, 1, 'rep');
  if (SK.tool === 'p') return szSp(en) ? [en] : skTargets(en, null);
  if (SK.tool === 'm') return szSp(en) ? [en] : skBld(en.b);
  return [en];
}
function skFilter(k) {
  SK.flt = k;
  SK.ver++;
  skFilterLeiste(true);
  try {
    $('hud').textContent = 'Auswahlfilter: ' + SKF.find((x) => x[0] === k)[1];
  } catch (e) {
    logErr(e, 'skFilter');
  }
}
function skFilterLeiste(neu) {
  let d = document.getElementById('skflt');
  const zeigen =
    skAct() && S.m3 && !(typeof FDS !== 'undefined' && FDS.open) && (SK.used || SK.sel.length > 0);
  if (!d) {
    if (!zeigen) return;
    d = document.createElement('div');
    d.id = 'skflt';
    mid.appendChild(d);
    neu = true;
  }
  d.style.display = zeigen ? 'flex' : 'none';
  if (!zeigen || (!neu && d.dataset.f === SK.flt)) return;
  d.dataset.f = SK.flt;
  d.innerHTML =
    '<span class="skfl">Auswahl</span>' +
    SKF.map(
      (x) =>
        `<button class="${SK.flt === x[0] ? 'on' : ''}" title="${x[2]}" onclick="skFilter('${x[0]}')">${x[1]}</button>`,
    ).join('');
}
// ---- Art der Auswahl (Zeile der Matrix)
function skAuswTyp() {
  const s = SK.sel;
  if (!s.length) return null;
  const bs = new Set(s.map((x) => x.b));
  if (bs.size > 1) return 'm';
  const b = s[0].b;
  if (s.every((x) => x.ek != null)) return 'k';
  if (s.every((x) => x.face != null)) return 'tf';
  if (s.every((x) => x.vd != null)) return 'hof';
  if (s.some(szSp)) return 'm';
  if (skWhole(b)) return 'g';
  if (s.every((x) => x.top)) return 'd';
  const js = new Set(s.map((x) => x.j));
  // Ausrundung als eine Fläche
  if (js.size === 1 && s.length > 1 && s.every((x) => x.i != null && !x.top)) {
    const kk = skGlattKette(s[0]).map(skKey);
    if (kk.length === s.length && s.every((x) => kk.includes(skKey(x)))) return 'f';
  }
  if (js.size === 1) {
    const j = s[0].j,
      lv = skBld(b).filter((x) => x.j === j && !x.top);
    if (s.length > 1 && lv.every((x) => skHas(x))) return 's';
    if (s.length === 1) return 'f';
  }
  if (s.every((x) => !x.top)) {
    const g = skGroup(s[0]).map(skKey),
      k = s.map(skKey);
    if (g.length === k.length && g.every((x) => k.includes(x))) return 'r';
  }
  return 'm';
}
const SKKL = {
  g: ['mv', 'skc', 'ro', 'skx', 'ed', 'oeg', 'fd', 'gr', 'bst', 'del'],
  s: ['skp', 'h', 'oeg', 'grl'],
  f: ['skp', 'skl', 'oeg', 'fd'],
  r: ['skp', 'skl', 'oeg', 'fd'],
  d: ['skp', 'skl', 'skf', 'skr'],
  tf: ['mv', 'skp', 'skf', 'del'],
  hof: ['skp', 'del'],
  k: ['ekh', 'rund'],
  m: ['skp', 'mv'],
};
const SKKN = {
  mv: 'Verschieben',
  skc: 'Kopieren',
  ro: 'Drehen',
  ed: 'Kontur',
  fd: 'Fassade',
  gr: 'Grundriss',
  grl: 'Grundriss',
  skp: 'Ziehen',
  skl: 'Teilen',
  skx: 'Schneiden',
  skf: 'Versatz',
  skr: 'Rechteck',
  del: 'Löschen',
  bst: 'Bestand ausblenden',
};
// Bestandsgebäude, deren Mitte im Grundriss des geplanten Gebäudes liegt
function skKlBestand(b) {
  try {
    if (!GEO.blist || !b) return [];
    const fp = lf(b, b.levels[0]),
      c = cen(fp),
      r = Math.max(...fp.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
    // überlappend: Ecke des einen im anderen oder Mitte des Bestands im Grundriss
    return GEO.blist.filter((x) => {
      const o = x.o,
        m = cen(o);
      if (!o || Math.hypot(m[0] - c[0], m[1] - c[1]) > r + 200) return false;
      return inP(m, fp) || o.some((p) => inP(p, fp)) || fp.some((p) => inP(p, o));
    });
  } catch (e) {
    logErr(e, 'skKlBestand');
    return [];
  }
}
function skKlName() {
  const t = skAuswTyp(),
    s = SK.sel,
    b = s[0].b,
    gn = (j) => lname(b, j),
    m = (v) => f1(v, 1).replace('.', ',');
  if (t === 'g') return (b.name || 'Gebäude') + ' · ' + b.levels.length + ' Geschosse';
  if (t === 's') return gn(s[0].j) + ' · ' + m(b.levels[s[0].j].h) + ' m hoch';
  if (t === 'f' || t === 'r') {
    const f = lf(b, b.levels[s[0].j]),
      lg = (x) => Math.hypot(f[(x.i + 1) % f.length][0] - f[x.i][0], f[(x.i + 1) % f.length][1] - f[x.i][1]),
      rund = t === 'f' && s.length > 1,
      h = t === 'f' ? b.levels[s[0].j].h : s.reduce((t2, x) => t2 + b.levels[x.j].h, 0);
    return (
      (t === 'f' ? (rund ? 'Rundung · ' : 'Wand · ') + gn(s[0].j) : 'Flucht · ' + s.length + ' Geschosse') +
      ' · ' +
      m(rund ? s.reduce((t2, x) => t2 + lg(x), 0) : lg(s[0])) +
      ' × ' +
      m(h) +
      ' m'
    );
  }
  if (t === 'k') return 'Seitenecke · ' + s.length + ' Geschoss' + (s.length === 1 ? '' : 'e');
  if (t === 'd') return 'Dach / Oberseite';
  if (t === 'tf') return 'Dachfläche (gezeichnet)';
  if (t === 'hof') return 'Innenhof';
  return s.length + ' Flächen';
}
function skKlKnopf(k) {
  if (k === 'h') {
    const s = SK.sel[0];
    return `<label class="skkh" title="Geschosshöhe">H <input type="number" step="0.05" min="2" max="12" value="${(+s.b.levels[s.j].h).toFixed(2)}" onchange="skKlHoehe(this.value)"> m</label>`;
  }
  if (k === 'ekh') return '<span class="skkh">anfassen und ziehen = verschieben</span>';
  if (k === 'rund')
    return `<label class="skkh" title="Radius der Ausrundung">R <input id="skkr" type="number" step="0.5" min="0.1" value="${skEckRadiusVorgabe()}" onkeydown="if(event.key==='Enter')skEckRunden(this.value)"> m</label><button onclick="skEckRunden(document.getElementById('skkr').value)" title="Ecke mit diesem Radius ausrunden (alle gewählten Geschosse)">${SVGI('<path d="M5 20V12a7 7 0 0 1 7-7h7"/>', 16)}<span>Ausrunden</span></button>`;
  if (k === 'oeg') {
    const z = skKlGruppenZiel();
    if (!z) return '';
    const nm = z.R.length > 1 ? z.R.length + ' im Wechsel' : oegG(z.R[0]) ? oegG(z.R[0]).n : 'keine';
    return `<button class="fkb${FK.kl ? ' skkon' : ''}" title="Fassadengruppen für ${esc(z.name)} anordnen (Öffnungen sichtbar ab LOD 200)" onclick="skKlGruppen(this)">${SVGI('<rect x="3" y="4" width="18" height="16" rx="1"/><rect x="6" y="8" width="3" height="5"/><rect x="10.5" y="8" width="3" height="5"/><rect x="15" y="8" width="3" height="5"/>', 16)}<span>Gruppen: ${esc(nm)}${z.t !== 'g' && z.eig ? ' ●' : ''}</span></button>`;
  }
  if (k === 'bst') {
    const n = skKlBestand(SK.sel[0].b).length;
    if (!n) return '';
    return `<button title="Bestand ausblenden – ${n} Bestandsgebäude unter diesem Gebäude (wie „Bestand entfernen“ am Grundstück)" onclick="skKlDo('bst')">${SVGI('<path d="M4 20V10l6-4 6 4v10z"/><path d="M3 3l18 18"/>', 16)}<span>Bestand ausblenden</span></button>`;
  }
  const a = BA.find((x) => x.k === k);
  return `<button title="${a ? a.t.replace(/"/g, '&quot;') : ''}" onclick="skKlDo('${k}')"${k === 'del' ? ' class="skkdel"' : ''}>${a ? baIc(a, 16) : ''}<span>${SKKN[k]}</span></button>`;
}
// ---- Fassadengruppen je Auswahl (Gebäude, Geschoss, Wand, Flucht) – Daten wie im Gebäudekonfigurator (b.fk)
// Gebäude = Grundeinstellung (b.fk.st, eine Zeile für alle Geschosse; Abweichungen bleiben bestehen).
// Geschoss / Wand / Flucht = eigene Anordnung als Abweichung (b.fk.ab['Seite|Geschoss'], Rhythmus als Liste,
// Ausrichtung in b.fk.auA mit demselben Schlüssel).
/** Ansicht (Seite), auf der die Wand j/i liegt: größte Übereinstimmung der Normalen. */
function skKlAnsicht(b, j, i) {
  const n = skN(b, j, i);
  let best = null,
    bd = -2;
  fdViews(b).forEach((v) => {
    const d = v.n[0] * n[0] + v.n[1] * n[1];
    if (d > bd) {
      bd = d;
      best = v;
    }
  });
  return best;
}
/** Ziel der Gruppenwahl: { t, b, vk, j, key, name, eig, R (Rhythmus), au (Ausrichtung) }. */
function skKlGruppenZiel() {
  try {
    const t = skAuswTyp(),
      s = SK.sel;
    if (!'gsfr'.includes(t || '-')) return null;
    const b = s[0].b,
      u = ugN(b),
      fk = fkDaten(b) || { st: [], ab: {} };
    if (t === 'g') {
      const st = fk.st || [];
      return {
        t,
        b,
        vk: '*',
        j: '*',
        key: '',
        name: 'das ganze Gebäude',
        eig: true,
        R: fkReihe(st[0]),
        au: (fk.au || [])[0] || 'm',
        stapel: st.length > 1,
      };
    }
    const j = t === 'r' ? '*' : s[0].j - u;
    if (j !== '*' && j < 0) return null;
    const V = t === 's' ? null : skKlAnsicht(b, s[0].j, s[0].i);
    if (t !== 's' && !V) return null;
    const vk = V ? V.key : '*',
      key = vk + '|' + j,
      jj = j === '*' ? 0 : j,
      eig = !!(fk.ab && key in fk.ab);
    return {
      t,
      b,
      vk,
      j,
      key,
      eig,
      name:
        t === 's'
          ? 'Geschoss ' + lname(b, s[0].j)
          : 'Seite ' +
            V.name.replace('Ansicht ', '') +
            ' · ' +
            (j === '*' ? 'alle Geschosse' : lname(b, s[0].j)),
      R: fkReihe(eig ? fk.ab[key] : fkGruppe(fk, vk, jj)),
      au: fkAusr(fk, vk, jj),
    };
  } catch (e) {
    logErr(e, 'skKlGruppenZiel');
    return null;
  }
}
/** Gruppenauswahl aus der Kontextleiste öffnen bzw. schließen (Fenster des Gebäudekonfigurators). */
function skKlGruppen(el) {
  if (FK.kl) {
    fkWahlZu();
    return;
  }
  if (!skKlGruppenZiel()) return;
  FK.wahl = null;
  const r = el.getBoundingClientRect();
  FK.kl = { platz: 0, x: r.left, y0: r.top, y1: r.bottom, sel: SK.sel.map(skKey).join() };
  SK.ver++;
  skKlGruppenZeichnen();
}
function skKlGruppenZeichnen() {
  const z = skKlGruppenZiel(),
    o = FK.kl;
  if (!z || !o) return;
  const w = fkWahlEl(),
    leer = (t) =>
      `<svg width="56" height="30"><rect x="1" y="1" width="54" height="28" fill="#f4f3f0" stroke="#cbd5e1"/>${t ? `<text x="28" y="20" text-anchor="middle" font-size="13" fill="#94a3b8">${t}</text>` : ''}</svg>`,
    R = z.R,
    platz = Math.min(o.platz, R.length),
    cur = R[platz],
    hin =
      z.t === 'g'
        ? 'Grundeinstellung für alle Geschosse und Seiten' +
          (z.stapel ? ' · ersetzt die Zeilen je Geschoss' : '') +
          ' · eigene Anordnungen von Geschossen und Flächen bleiben'
        : z.eig
          ? 'eigene Anordnung – überschreibt das Gebäude'
          : 'erbt vom Gebäude – eine Änderung legt eine eigene Anordnung an',
    // Anordnung: Plätze des Rhythmus (anklicken = Platz wählen) und + für weitere Gruppe
    reihe =
      (R.length ? R : [''])
        .map(
          (k, i) =>
            `<button class="fkb skgp${i === platz ? ' on' : ''}" onclick="skKlPlatz(${i})" title="Platz ${i + 1} im Rhythmus">${oegG(k) ? oegSymbol(oegG(k), R.length > 1 ? 40 : 56, R.length > 1 ? 22 : 30) : leer('')}</button>`,
        )
        .join('') +
      (R.length
        ? `<button class="fkb skgp${platz === R.length ? ' on' : ''}" onclick="skKlPlatz(${R.length})" title="Weitere Gruppe im Wechsel (Rhythmus)">+</button>`
        : ''),
    ausr = [
      ['l', '⇤', 'linksbündig'],
      ['m', '↔', 'mittig (Rest an beiden Enden)'],
      ['r', '⇥', 'rechtsbündig'],
    ]
      .map(
        ([k, zz, tt]) =>
          `<button class="${z.au === k ? 'on' : ''}" onclick="skKlAusr('${k}')" title="${tt}">${zz}</button>`,
      )
      .join('');
  w.innerHTML = `<div class="fkwh"><b>Fassadengruppen · ${esc(z.name)}</b><button onclick="fkWahlZu()" title="Schließen (Esc)">×</button></div>
<div class="mu" style="margin:-4px 0 8px">${hin}</div>
<div class="skga"><span class="skgr">${reihe}</span><span class="fka skgau">${ausr}</span></div>
<div class="mu" style="margin:8px 0 4px">${platz >= R.length && R.length ? 'Gruppe anhängen' : R.length > 1 ? 'Gruppe für Platz ' + (platz + 1) : 'Gruppe'}</div>
<div class="fkg">${S.oeg
    .map(
      (G) =>
        `<div class="${G.k === cur ? 'on' : ''}" onclick="skKlGruppeSetzen('${G.k}')">${oegSymbol(G, 56, 30)}${esc(G.n)}</div>`,
    )
    .join(
      '',
    )}${platz < R.length || !R.length ? `<div class="${!R.length ? 'on' : ''}" onclick="skKlGruppeSetzen('')">${leer('')}${R.length > 1 ? 'Aus Rhythmus entfernen' : 'Keine Öffnungen'}</div>` : ''}${z.t !== 'g' && z.eig ? `<div onclick="skKlGruppeSetzen(null)" title="Eigene Anordnung entfernen – wieder wie das Gebäude">${leer('↺')}Wie Gebäude</div>` : ''}<div onclick="fkWahlZu();okOpen(null,'gr')" title="Gruppen im Konfigurator anlegen und bearbeiten">${leer('+')}Neue Gruppe …</div></div>`;
  w.style.display = 'block';
  const bw = 300,
    bh = Math.min(w.scrollHeight, window.innerHeight - 40);
  w.style.left = Math.max(10, Math.min(window.innerWidth - bw - 10, o.x)) + 'px';
  w.style.top = (o.y1 + 8 + bh < window.innerHeight ? o.y1 + 8 : Math.max(10, o.y0 - bh - 8)) + 'px';
}
function skKlPlatz(i) {
  if (!FK.kl) return;
  FK.kl.platz = i;
  skKlGruppenZeichnen();
}
/** Anordnung des Ziels schreiben (R Liste der Gruppen, au Ausrichtung; R null = eigene Anordnung entfernen). */
function skKlSchreiben(z, R, au) {
  S.sel = z.b;
  const offen = FK.kl;
  fkAendern((fk) => {
    const wert = R && R.length > 1 ? R : (R && R[0]) || '';
    if (z.t === 'g') {
      fk.st = R && R.length ? [wert] : [];
      fk.au = [au || 'm'];
      return;
    }
    fk.ab = fk.ab || {};
    fk.auA = fk.auA || {};
    if (R === null) {
      delete fk.ab[z.key];
      delete fk.auA[z.key];
    } else {
      fk.ab[z.key] = wert;
      fk.auA[z.key] = au || 'm';
    }
  });
  // fkAendern schließt das Fenster – geöffnet lassen und neu zeichnen
  FK.kl = offen;
  SK.ver++;
  skKlGruppenZeichnen();
}
/** Gruppe k auf den gewählten Platz setzen ('' Platz entfernen bzw. keine, null = wie Gebäude). */
function skKlGruppeSetzen(k) {
  const z = skKlGruppenZiel();
  if (!z || !FK.kl) return;
  let R = z.R.slice();
  const p = Math.min(FK.kl.platz, R.length);
  if (k === null) R = null;
  else if (oegG(k)) R[p] = k;
  else if (R.length > 1 && p < R.length) R.splice(p, 1);
  else R = [];
  if (R) FK.kl.platz = Math.min(p, Math.max(0, R.length - 1));
  skKlSchreiben(z, R, z.au);
  try {
    $('hud').textContent =
      'Fassadengruppen ' +
      (R === null ? 'wie Gebäude' : R.length ? R.map((x) => oegG(x).n).join(' – ') : 'entfernt') +
      ' · ' +
      z.name +
      (l2on() ? '' : ' · Öffnungen sichtbar ab LOD 200');
  } catch (e) {
    logErr(e, 'skKlGruppeSetzen');
  }
}
function skKlAusr(a) {
  const z = skKlGruppenZiel();
  if (!z) return;
  skKlSchreiben(z, z.R.slice(), a);
}
function skKlDo(k) {
  try {
    const s = SK.sel,
      b = s.length ? s[0].b : null;
    if (k === 'bst') {
      const rm = skKlBestand(b);
      if (!rm.length) return;
      GEO.blist = GEO.blist.filter((x) => !rm.includes(x));
      GEO.bdel.push(...rm);
      ctxBuild(GEO.blist.slice());
      rr();
      $('hud').textContent = rm.length + ' Bestandsgebäude ausgeblendet · am Grundstück wiederherstellbar';
      SK.ver++;
      return;
    }
    if (k === 'del' && s.some(szSp)) {
      szDelete();
      return;
    }
    if (k === 'fd' && b && s[0].i != null) {
      const best = skKlAnsicht(b, s[0].j, s[0].i);
      fdOpen(b.id, best ? best.key : undefined);
      return;
    }
    if (b) S.sel = b;
    baDo(k);
    const hin = {
      skp: 'Ziehen & Schieben · gewählte Fläche anfassen und ziehen · Zahl + Enter = exakt · Esc',
      skl: 'Teilen · auf die Wand klicken, wo geteilt werden soll · Zahl + Enter = Abstand',
      skx: 'Schneiden · Wand anklicken – Schnitt läuft über Fassade, Dach und Gegenfassade · Zahl + Enter = Abstand',
      skf: 'Versatz · Fläche anklicken, Maus bewegen · Zahl + Enter',
    }[k];
    if (hin) $('hud').textContent = hin;
  } catch (e) {
    logErr(e, 'skKlDo');
  }
}
function skKlHoehe(v) {
  const s = SK.sel[0],
    h = parseFloat(String(v).replace(',', '.'));
  if (!s || !isFinite(h) || h < 2 || h > 12) return;
  hist();
  SK.sel
    .map((x) => x.j)
    .filter((j, q, a) => a.indexOf(j) === q)
    .forEach((j) => {
      s.b.levels[j].h = h;
    });
  mesh(s.b);
  H();
  hpos();
  rr();
  SK.ver++;
}
// Kontextleiste: Inhalt nur bei geänderter Auswahl neu, Lage jedes Bild (aus placeHc)
function skKontext() {
  let d = document.getElementById('skkl');
  skFilterLeiste(false);
  const busy =
    SK.op ||
    SK.win ||
    (typeof SZ !== 'undefined' && (SZ.op || SZ.d)) ||
    (typeof OFS !== 'undefined' && OFS.d) ||
    (typeof FDS !== 'undefined' && FDS.open) ||
    (typeof dr !== 'undefined' && dr && dr.m);
  const zeigen = skAct() && SK.sel.length > 0 && !busy;
  // Gruppenauswahl gehört zur Auswahl: schließt, wenn sich diese ändert
  if (FK.kl && (!zeigen || FK.kl.sel !== SK.sel.map(skKey).join())) fkWahlZu();
  if (!d) {
    if (!zeigen) return;
    d = document.createElement('div');
    d.id = 'skkl';
    mid.appendChild(d);
  }
  if (!zeigen) {
    d.style.display = 'none';
    return;
  }
  const t = skAuswTyp(),
    sg =
      SK.ver +
      '|' +
      t +
      '|' +
      SK.sel.length +
      '|' +
      skSig(SK.sel[0].b) +
      '|' +
      (GEO.blist ? GEO.blist.length : 0);
  if (d.dataset.sg !== sg) {
    d.dataset.sg = sg;
    const ak = SKKL[t] || SKKL.m;
    // viele Aktionen: nur Symbole, Name im Tooltip
    d.classList.toggle('kompakt', ak.length > 6);
    d.innerHTML = '<span class="skkn">' + skKlName() + '</span>' + ak.map(skKlKnopf).join('');
  }
  // Lage: über dem höchsten Punkt der Auswahl, mittig
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    n = 0;
  const r = cv.getBoundingClientRect(),
    m = mid.getBoundingClientRect(),
    pk = (x, y, z) => {
      const p = skProj(x, y, z);
      if (p[2] > 1) return;
      n++;
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
    };
  SK.sel.slice(0, 60).forEach((e) => {
    if (szSp(e)) {
      const o = szObj(e);
      if (o) o.poly.forEach((q) => pk(q[0], skZ(e.b, e.j) + e.b.levels[e.j].h, q[1]));
      return;
    }
    const f = lf(e.b, e.b.levels[e.j]),
      z1 = skZ(e.b, e.j) + e.b.levels[e.j].h;
    if (e.ek != null) pk(f[e.ek][0], z1, f[e.ek][1]);
    else if (e.top) f.forEach((q) => pk(q[0], z1, q[1]));
    else {
      const a = f[e.i],
        c = f[(e.i + 1) % f.length];
      pk(a[0], z1, a[1]);
      pk(c[0], z1, c[1]);
      pk(a[0], z1 - e.b.levels[e.j].h, a[1]);
    }
  });
  if (!n) {
    d.style.display = 'none';
    return;
  }
  d.style.display = 'flex';
  const w = d.offsetWidth,
    hh = d.offsetHeight,
    cx = (x0 + x1) / 2 - m.left,
    // nicht unter die Panels links (Gebäudemetrik) und rechts (Symbolleiste)
    lx = Math.max(m.width > 1000 ? 300 : 8, Math.min(m.width - w - (m.width > 1000 ? 76 : 8), cx - w / 2)),
    ly = Math.max(172, Math.min(m.height - hh - 110, y0 - m.top - hh - 18));
  d.style.left = lx + 'px';
  d.style.top = ly + 'px';
  if (r.width === 0) d.style.display = 'none';
}

// ---- Schneiden: Gebäude rund herum (Fassade – Dach – Fassade) senkrecht zur angeklickten Wand in zwei Baukörper teilen
/** Je Geschoss die zwei Teile [Plusseite, Minusseite] (eines davon null, wenn der Schnitt das Geschoss verfehlt). */
function skSchnittTeile(lh) {
  const b = lh.en.b,
    n = skN(b, lh.en.j, lh.en.i),
    P = lh.P,
    C = [P[0] + n[0], P[1] + n[1]],
    u = lh.u,
    seite = (q) => {
      const m = cen(q);
      return (m[0] - P[0]) * u[0] + (m[1] - P[1]) * u[1] > 0 ? 0 : 1;
    };
  return b.levels.map((l) => {
    const f = lf(b, l),
      r = szSplitPoly(f, P, C, P),
      o = [null, null];
    if (r) {
      o[seite(r[0])] = r[0];
      o[1 - seite(r[0])] = r[1];
    } else o[seite(f)] = f.map((q) => q.slice());
    return o;
  });
}
function skSchnittVorschau(lh) {
  const b = lh.en.b,
    pos = [];
  skSchnittTeile(lh).forEach((o, j) => {
    if (!o[0] || !o[1]) return;
    const z0 = skZ(b, j),
      z1 = z0 + b.levels[j].h,
      A = o[0],
      E1 = A[0],
      E2 = A[A.length - 1];
    // Fassade hoch, über die Decke, Gegenfassade hinunter
    pos.push(
      E1[0],
      z0,
      E1[1],
      E1[0],
      z1,
      E1[1],
      E1[0],
      z1,
      E1[1],
      E2[0],
      z1,
      E2[1],
      E2[0],
      z1,
      E2[1],
      E2[0],
      z0,
      E2[1],
    );
  });
  if (!pos.length) {
    SKLN.visible = false;
    return;
  }
  SKLN.geometry.dispose();
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  SKLN.geometry = geo;
  SKLN.computeLineDistances();
  SKLN.visible = true;
  try {
    $('hud').textContent =
      'Schneiden · ' +
      f1(lh.dist, 2).replace('.', ',') +
      ' m von der ' +
      (lh.fromEnd ? 'rechten' : 'linken') +
      ' Ecke' +
      (lh.lab ? ' · Fang: ' + lh.lab : '') +
      ' · Klick = in zwei Baukörper schneiden · Zahl + Enter = Abstand';
  } catch (e) {
    logErr(e, 'skSchnittVorschau');
  }
}
function skSchnittDo(lh) {
  const b = lh.en.b,
    T2 = skSchnittTeile(lh),
    hat = (k) => T2.map((o) => !!o[k]);
  // jeder Teil muss vom untersten Geschoss an durchgehend sein (keine schwebenden Geschosse)
  const ok = (k) => {
    const h = hat(k),
      last = h.lastIndexOf(true);
    return h[0] && h.slice(0, last + 1).every(Boolean);
  };
  if (!T2.some((o) => o[0] && o[1]) || !ok(0) || !ok(1)) {
    $('hud').textContent = 'Schneiden: hier entstehen keine zwei durchgehenden Baukörper';
    return false;
  }
  hist();
  const b2 = skCloneB(b),
    teil = (bb, k) => {
      const lv = [];
      b.levels.forEach((l, j) => {
        if (!T2[j][k]) return;
        const c = JSON.parse(JSON.stringify(l));
        c.fp = T2[j][k];
        lv.push(c);
      });
      bb.levels = lv;
      bb.fp = lv[0].fp.map((q) => q.slice());
      bb.kind = 'free';
      // Wandflächen-Teile und Hand-Öffnungen hängen an Kanten/Ansichten – beim Schneiden verworfen
      bb.patches = [];
      const m = cen(bb.fp);
      bb.voids = (bb.voids || []).filter((v) => inP(cen(v.poly), bb.fp) || inP(m, v.poly));
      bb._fv = null;
      bb._fkSig = null;
    };
  teil(b2, 1);
  teil(b, 0);
  delete b2.fd;
  b2.name = (b.name || 'Gebäude') + ' · Teil 2';
  S.bld.push(b2);
  mesh(b);
  mesh(b2);
  SK.lh = null;
  SKLN.visible = false;
  SK.sel = [];
  SK.hv = null;
  SK.ver++;
  S.sel = b;
  H();
  hpos();
  skSync();
  rr();
  skNachAktion(
    b,
    'Gebäude geschnitten · „' +
      b2.name +
      '“ angelegt – jeden Teil einzeln wählen, ziehen oder in der Höhe ändern',
  );
  return true;
}

/** Nach einer abgeschlossenen Aktion (Ziehen, Teilen, Schneiden, Verschieben): zurück ins Auswahl-Werkzeug,
    das Gebäude bleibt gewählt – der nächste Klick wählt wieder eine einzelne Fläche. */
function skNachAktion(b, hud) {
  try {
    if (SK.tool !== 's') skTool('s');
    SK.lh = null;
    SKLN.visible = false;
    if (b && S.bld.includes(b)) SK.sel = skBld(b);
    SK.hv = null;
    SK.ver++;
    skSync();
    skBaSync();
    if (hud) $('hud').textContent = hud;
  } catch (e) {
    logErr(e, 'skNachAktion');
  }
}
