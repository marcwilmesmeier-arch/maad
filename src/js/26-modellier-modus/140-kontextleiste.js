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
  if (f === 'g') return skBld(en.b);
  if (f === 's') return en.top ? [en] : lvl();
  if (f === 'f') return [en];
  if (f === 'r') return skGroup(en);
  if (m !== 'rep') return n >= 3 ? lvl() : [en];
  if (n === 1) {
    const drin = SK.sel.length && SK.sel.every((x) => x.b === en.b);
    return drin ? [en] : skBld(en.b);
  }
  if (n === 2) return [en];
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
  if (s.every((x) => x.face != null)) return 'tf';
  if (s.every((x) => x.vd != null)) return 'hof';
  if (s.some(szSp)) return 'm';
  if (skWhole(b)) return 'g';
  if (s.every((x) => x.top)) return 'd';
  const js = new Set(s.map((x) => x.j));
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
  g: ['mv', 'skc', 'ro', 'ed', 'fd', 'gr', 'bst', 'del'],
  s: ['skp', 'h', 'grl'],
  f: ['skp', 'skl', 'fd'],
  r: ['skp', 'skl', 'fd'],
  d: ['skp', 'skl', 'skf', 'skr'],
  tf: ['mv', 'skp', 'skf', 'del'],
  hof: ['skp', 'del'],
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
      a = f[s[0].i],
      c = f[(s[0].i + 1) % f.length],
      h = s.reduce((t2, x) => t2 + b.levels[x.j].h, 0);
    return (
      (t === 'f' ? 'Wand · ' + gn(s[0].j) : 'Flucht · ' + s.length + ' Geschosse') +
      ' · ' +
      m(Math.hypot(c[0] - a[0], c[1] - a[1])) +
      ' × ' +
      m(h) +
      ' m'
    );
  }
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
  if (k === 'bst') {
    const n = skKlBestand(SK.sel[0].b).length;
    if (!n) return '';
    return `<button title="${n} Bestandsgebäude unter diesem Gebäude ausblenden (wie „Bestand entfernen“ am Grundstück)" onclick="skKlDo('bst')">Bestand ausblenden</button>`;
  }
  const a = BA.find((x) => x.k === k);
  return `<button title="${a ? a.t.replace(/"/g, '&quot;') : ''}" onclick="skKlDo('${k}')"${k === 'del' ? ' class="skkdel"' : ''}>${a ? baIc(a, 16) : ''}<span>${SKKN[k]}</span></button>`;
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
      const n = skN(b, s[0].j, s[0].i),
        V = fdViews(b);
      let best = null,
        bd = -2;
      V.forEach((v) => {
        const d = v.n[0] * n[0] + v.n[1] * n[1];
        if (d > bd) {
          bd = d;
          best = v;
        }
      });
      fdOpen(b.id, best ? best.key : undefined);
      return;
    }
    if (b) S.sel = b;
    baDo(k);
    const hin = {
      skp: 'Ziehen & Schieben · gewählte Fläche anfassen und ziehen · Zahl + Enter = exakt · Esc',
      skl: 'Teilen · auf die Wand klicken, wo geteilt werden soll · Zahl + Enter = Abstand',
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
    d.innerHTML =
      '<span class="skkn">' + skKlName() + '</span>' + (SKKL[t] || SKKL.m).map(skKlKnopf).join('');
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
    if (e.top) f.forEach((q) => pk(q[0], z1, q[1]));
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
    lx = Math.max(8, Math.min(m.width - w - 8, cx - w / 2)),
    ly = Math.max(140, Math.min(m.height - hh - 110, y0 - m.top - hh - 18));
  d.style.left = lx + 'px';
  d.style.top = ly + 'px';
  if (r.width === 0) d.style.display = 'none';
}
