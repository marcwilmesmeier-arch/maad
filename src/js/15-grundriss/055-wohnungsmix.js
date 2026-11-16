// ======================= WOHNUNGSMIX (Gebäudemetrik → Einheiten) =======================
// Soll-Verteilung der Wohnungstypen A–E (1–5 Zimmer) mit Zielgrößen, einstellbar direkt in der Gebäudemetrik.
// Ist: im Grundriss angelegte Wohneinheiten (Flächenarten wo1–wo5, „Wohnen“ ohne Typ getrennt). Solange keine
// Einheiten angelegt sind, schätzt maad die Wohnungszahl aus der BGF Wohnen (Wohnfläche ≈ 75 % der BGF).
// Zurückgeholt aus maad v545 (dort: Einstellung unter Planen → Generator, Auswertung unter Einheiten).

const WMX_VORLAGEN = {
  std: ['Standard', [10, 25, 35, 25, 5]],
  kmp: ['Urban kompakt', [20, 35, 30, 12, 3]],
  fam: ['Familien', [5, 15, 35, 35, 10]],
  ind: ['Individuell', null],
};
const WMX_FA = ['wo1', 'wo2', 'wo3', 'wo4', 'wo5'];
const WMX_FARBEN = ['#a9c0cc', '#86a6b8', '#5E7F92', '#456578', '#2f4757'];
const WMX_SPANNE = ['30–40', '45–55', '65–75', '80–95', '100–115'];
const WMX_WF_ANTEIL = 0.75; // Wohnfläche / BGF für die Schätzung ohne Grundriss
S.wmx = { p: 'std', m: [10, 25, 35, 25, 5], s: [35, 50, 70, 88, 108] };

/** Gespeicherte Einstellung prüfen (Projekt laden). */
function wmxNorm(x) {
  const zahl = (a, d, mn, mx) =>
    d.map((v, i) => {
      const n = Array.isArray(a) ? +a[i] : NaN;
      return isFinite(n) ? Math.max(mn, Math.min(mx, n)) : v;
    });
  return {
    p: x && WMX_VORLAGEN[x.p] ? x.p : 'std',
    m: zahl(x && x.m, [10, 25, 35, 25, 5], 0, 100),
    s: zahl(x && x.s, [35, 50, 70, 88, 108], 15, 250),
  };
}
/** Ältere Projekte (bis v545): Einstellungen des Generators übernehmen. */
function wmxAusGenerator(gen) {
  const c = gen && gen.cat && gen.cat.Wohnen;
  if (!c) return null;
  const w = wmxNorm(null);
  if (WMX_VORLAGEN[c.mixp]) w.p = c.mixp;
  w.m =
    w.p === 'ind'
      ? ['mA', 'mB', 'mC', 'mD', 'mE'].map((k, i) => (c[k] != null ? +c[k] : w.m[i]))
      : WMX_VORLAGEN[w.p][1].slice();
  w.s = ['sA', 'sB', 'sC', 'sD', 'sE'].map((k, i) => (c[k] != null ? +c[k] : w.s[i]));
  return wmxNorm(w);
}

/** Soll-Anteile (Summe 1). */
function wmxSoll() {
  const m = S.wmx.p === 'ind' ? S.wmx.m : WMX_VORLAGEN[S.wmx.p][1],
    s = m.reduce((a, b) => a + b, 0) || 1;
  return m.map((x) => x / s);
}
/** Ganze Wohnungszahl je Typ, Summe = total (größte Reste zuerst). */
function wmxVerteilen(total, anteile) {
  const r = anteile.map((x) => x * total),
    c = r.map(Math.floor),
    rest = Math.round(total) - c.reduce((a, b) => a + b, 0),
    o = r.map((x, i) => [x - c[i], i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < rest; i++) c[o[i % o.length][1]]++;
  return c;
}
/** Einstellung ändern: k = 'p' (Vorlage), 'm' (Anteil Typ i in %), 's' (Zielgröße Typ i in m²). */
function wmxSet(k, i, v) {
  if (k === 'p') {
    if (!WMX_VORLAGEN[v]) return;
    S.wmx.p = v;
    if (v !== 'ind') S.wmx.m = WMX_VORLAGEN[v][1].slice();
  } else {
    const n = +String(v).replace(',', '.');
    if (!isFinite(n)) return;
    if (k === 'm') {
      if (S.wmx.p !== 'ind') S.wmx.m = WMX_VORLAGEN[S.wmx.p][1].slice();
      S.wmx.p = 'ind';
      S.wmx.m[i] = Math.max(0, Math.min(100, n));
    } else if (k === 's') S.wmx.s[i] = Math.max(15, Math.min(250, n));
  }
  zoRender();
}

/** Abschnitt „Wohnungsmix“ für die Gebäudemetrik (Modus Einheiten); '' ohne Wohnnutzung. R, A aus zoRender. */
function wmxHtml(P, R, A) {
  const ist = [0, 0, 0, 0, 0],
    fl = [0, 0, 0, 0, 0];
  let ohne = 0,
    ohneA = 0,
    bgf = 0;
  P.forEach((b) => {
    bLv(b).forEach((r, i) => {
      if ((i >= b.levels.length ? roofUse(b) : lUse(b, b.levels[i])) === 'Wohnen') bgf += r.a;
    });
    if (!b.ub) return;
    grData(b).forEach((g) =>
      g.faces.forEach((f) => {
        if (!f.un) return;
        const k = WMX_FA.indexOf(f.fa);
        if (k >= 0) {
          ist[k]++;
          fl[k] += f.a;
        } else if (f.fa === 'wo') {
          ohne++;
          ohneA += f.a;
        }
      }),
    );
  });
  const nIst = ist.reduce((a, b) => a + b, 0) + ohne;
  if (!nIst && !bgf) return '';
  const so = wmxSoll(),
    sz = S.wmx.s,
    mittel = sz.reduce((s, x, i) => s + x * so[i], 0) || 1,
    pc = (x, t) => (t ? Math.round((x / t) * 100) : 0),
    typ = (i) => 'Typ ' + 'ABCDE'[i],
    balken = (arr) =>
      `<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin:3px 0">${arr.map((c, i) => `<div style="flex:${c} 0 0;background:${WMX_FARBEN[i]}"></div>`).join('')}</div>`,
    legende = (arr) => `<div class="mu">${arr.map((c, i) => 'ABCDE'[i] + ' ' + c).join(' · ')}</div>`,
    vorlage = WMX_VORLAGEN[S.wmx.p][0];
  let body = '',
    tot,
    pie;
  if (nIst) {
    const soN = wmxVerteilen(nIst, so),
      wf = fl.reduce((a, b) => a + b, 0) + ohneA,
      abw = so.reduce((s, x, i) => s + Math.abs(x * 100 - pc(ist[i], nIst)), 0) / 2;
    body += `<div class="mu" style="margin-top:4px">Ist (im Grundriss angelegt)</div>${balken(ist)}${legende(ist)}<div class="mu" style="margin-top:6px">Soll (${esc(vorlage)})</div>${balken(soN)}${legende(soN)}<div style="height:6px"></div>`;
    WMX_FA.forEach((id, i) => {
      const fa = grFA(id),
        p = pc(ist[i], nIst),
        d = p - Math.round(so[i] * 100);
      body += R(
        fa ? fa.c : WMX_FARBEN[i],
        `${typ(i)} · ${i + 1} Zi. <span class="mu">Ziel ${f1(sz[i], 0)} m²${ist[i] ? ' · Ø ' + f1(fl[i] / ist[i], 0) + ' m²' : ''}</span>`,
        `${ist[i]} · ${p} % <span class="mu">Soll ${Math.round(so[i] * 100)} %</span> <span style="color:${Math.abs(d) <= 5 ? '#3f7d4e' : '#a35a00'}">${d > 0 ? '+' : ''}${d}</span>`,
        '',
        { t: 'fa', k: id, lab: fa ? fa.n : id },
      );
    });
    if (ohne)
      body += R(
        grFA('wo') ? grFA('wo').c : '',
        'Wohnen ohne Typ',
        ohne + ' <span class="mu">' + A(ohneA) + '</span>',
        '',
        {
          t: 'fa',
          k: 'wo',
          lab: 'Wohnen',
        },
      );
    body +=
      R('', 'Wohnungen gesamt', nIst, 't') +
      R('', 'Wohnfläche gesamt', A(wf), 's') +
      R('', 'Ø Wohnungsgröße', A(wf / nIst), 's') +
      R('', 'Abweichung zum Soll', f1(abw, 1) + ' Pkt.', 's');
    tot = nIst + ' WE';
    pie = ist.map((v, i) => ({ n: typ(i), c: WMX_FARBEN[i], v })).filter((x) => x.v);
  } else {
    const wf = bgf * WMX_WF_ANTEIL,
      n = Math.max(0, Math.round(wf / mittel)),
      soN = wmxVerteilen(n, so);
    body += `<div class="mu" style="margin-top:4px">Schätzung aus BGF Wohnen ${A(bgf)} × ${Math.round(WMX_WF_ANTEIL * 100)} % Wohnfläche – genaue Werte, sobald im Grundriss Wohnungen angelegt sind.</div><div class="mu" style="margin-top:6px">Soll (${esc(vorlage)})</div>${balken(soN)}${legende(soN)}<div style="height:6px"></div>`;
    soN.forEach((c, i) => {
      body += R(
        WMX_FARBEN[i],
        `${typ(i)} · ${i + 1} Zi. <span class="mu">Ziel ${f1(sz[i], 0)} m²</span>`,
        `≈ ${c} <span class="mu">${Math.round(so[i] * 100)} %</span>`,
      );
    });
    body +=
      R('', 'Wohnungen (geschätzt)', '≈ ' + n, 't') +
      R('', 'Wohnfläche (geschätzt)', A(wf), 's') +
      R('', 'Ø Wohnungsgröße (Soll)', A(mittel), 's');
    tot = '≈ ' + n + ' WE';
    pie = soN.map((v, i) => ({ n: typ(i), c: WMX_FARBEN[i], v })).filter((x) => x.v);
  }
  // Einstellungen: Vorlage, Anteile und Zielgrößen je Typ
  const summe = (S.wmx.p === 'ind' ? S.wmx.m : WMX_VORLAGEN[S.wmx.p][1]).reduce((a, b) => a + b, 0),
    anteile = S.wmx.p === 'ind' ? S.wmx.m : WMX_VORLAGEN[S.wmx.p][1];
  body += `<details class="wmxE" ${S.zo.o.mixE ? 'open' : ''} ontoggle="zoOpen('mixE',this.open)"><summary><span>Einstellungen</span><b>${esc(vorlage)}</b></summary><div class="wmx"><label>Verteilung <select onchange="wmxSet('p',0,this.value)">${Object.keys(
    WMX_VORLAGEN,
  )
    .map(
      (k) =>
        `<option value="${k}" ${S.wmx.p === k ? 'selected' : ''}>${WMX_VORLAGEN[k][0]}${WMX_VORLAGEN[k][1] ? ' ' + WMX_VORLAGEN[k][1].join('/') : ''}</option>`,
    )
    .join('')}</select></label><table><tr><th></th><th>Anteil</th><th>Wohnfläche</th></tr>${WMX_FA.map(
    (id, i) =>
      `<tr><td><i style="background:${WMX_FARBEN[i]}"></i>${'ABCDE'[i]} · ${i + 1} Zi.</td><td><input type="number" min="0" max="100" step="1" value="${anteile[i]}" onchange="wmxSet('m',${i},this.value)"> %</td><td><input type="number" min="15" max="250" step="1" value="${sz[i]}" title="Üblich ${WMX_SPANNE[i]} m²" onchange="wmxSet('s',${i},this.value)"> m²</td></tr>`,
  ).join(
    '',
  )}</table><div class="mu">Summe ${summe} %${summe !== 100 ? ' – Anteile werden auf 100 % umgerechnet' : ''}. Eigene Anteile stellen die Verteilung auf „Individuell“.</div></div></details>`;
  if (S.zo.o.mix === undefined) S.zo.o.mix = 1;
  return zoD('mix', 'Wohnungsmix', tot, body, pie);
}
