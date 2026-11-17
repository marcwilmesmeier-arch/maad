// ======================= WOHNUNGSMIX (Gebäudemetrik → Einheiten) =======================
// Wohnungstypen = die angelegten Flächenarten mit Nutzung „Wohnen“ (ohne die allgemeine Flächenart „Wohnen“, df).
// Einstellung (Soll-Anteil und Zielgröße je Flächenart) im Fenster „Flächenarten“ (Optionen der Gebäudemetrik),
// Auswertung Ist/Soll unter Gebäudemetrik → Einheiten. Ist: im Grundriss angelegte Einheiten dieser Flächenarten;
// solange keine angelegt sind, Schätzung aus der BGF Wohnen (Wohnfläche ≈ 75 % der BGF).
// Zurückgeholt aus maad v545 (dort: Einstellung unter Planen → Generator, feste Typen A–E).

// Vorlagen für die Standard-Flächenarten 1- bis 5-Zimmer-Wohnung (weitere Wohnungstypen erhalten 0 %)
const WMX_VORLAGEN = {
  std: ['Standard', { wo1: 10, wo2: 25, wo3: 35, wo4: 25, wo5: 5 }],
  kmp: ['Urban kompakt', { wo1: 20, wo2: 35, wo3: 30, wo4: 12, wo5: 3 }],
  fam: ['Familien', { wo1: 5, wo2: 15, wo3: 35, wo4: 35, wo5: 10 }],
  ind: ['Individuell', null],
};
const WMX_GROESSE = { wo1: 35, wo2: 50, wo3: 70, wo4: 88, wo5: 108 }; // Zielwohnfläche m² (Vorgabe)
const WMX_WF_ANTEIL = 0.75; // Wohnfläche / BGF für die Schätzung ohne Grundriss
S.wmx = { p: 'std', m: {}, s: {} };

/** Wohnungstypen: Flächenarten mit Nutzung Wohnen außer der allgemeinen. */
function wmxTypen() {
  return (S.fa || []).filter((f) => f.u === 'Wohnen' && !f.df);
}
/** Gespeicherte Einstellung prüfen (Projekt laden); Listen (frühere Typen A–E) auf wo1–wo5 abbilden. */
function wmxNorm(x) {
  const w = { p: x && WMX_VORLAGEN[x.p] ? x.p : 'std', m: {}, s: {} },
    alt = ['wo1', 'wo2', 'wo3', 'wo4', 'wo5'],
    lies = (q, z, mn, mx) => {
      if (!q) return;
      Object.keys(q).forEach((k) => {
        const n = +q[k],
          key = Array.isArray(q) ? alt[+k] : k;
        if (key && isFinite(n)) z[key] = Math.max(mn, Math.min(mx, n));
      });
    };
  lies(x && x.m, w.m, 0, 100);
  lies(x && x.s, w.s, 15, 250);
  return w;
}
/** Ältere Projekte (bis v545): Einstellungen des Generators übernehmen. */
function wmxAusGenerator(gen) {
  const c = gen && gen.cat && gen.cat.Wohnen;
  if (!c) return null;
  const v = (k) => (c[k] != null ? +c[k] : undefined);
  return wmxNorm({
    p: WMX_VORLAGEN[c.mixp] ? c.mixp : 'std',
    m: ['mA', 'mB', 'mC', 'mD', 'mE'].map(v),
    s: ['sA', 'sB', 'sC', 'sD', 'sE'].map(v),
  });
}
/** Soll-Anteil (%) einer Flächenart nach Vorlage bzw. eigener Eingabe. */
function wmxAnteil(k) {
  const v = WMX_VORLAGEN[S.wmx.p][1];
  return v ? v[k] || 0 : S.wmx.m[k] || 0;
}
/** Zielgröße (m²) einer Flächenart. */
function wmxGroesse(k) {
  return S.wmx.s[k] != null ? S.wmx.s[k] : WMX_GROESSE[k] || 60;
}
/** Soll-Anteile der Typen (Summe 1; alle 0 → gleich verteilt). */
function wmxSoll(T) {
  const m = T.map((f) => wmxAnteil(f.k)),
    s = m.reduce((a, b) => a + b, 0);
  return s ? m.map((x) => x / s) : m.map(() => 1 / (T.length || 1));
}
/** Ganze Wohnungszahl je Typ, Summe = total (größte Reste zuerst). */
function wmxVerteilen(total, anteile) {
  const r = anteile.map((x) => x * total),
    c = r.map(Math.floor),
    rest = Math.round(total) - c.reduce((a, b) => a + b, 0),
    o = r.map((x, i) => [x - c[i], i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < rest && o.length; i++) c[o[i % o.length][1]]++;
  return c;
}
/** Einstellung ändern: k = 'p' (Vorlage), 'm' (Anteil der Flächenart fk in %), 's' (Zielgröße in m²). */
function wmxSet(k, fk, v) {
  if (k === 'p') {
    if (!WMX_VORLAGEN[v]) return;
    // beim Wechsel auf „Individuell“ mit den bisherigen Werten weiterarbeiten
    if (v === 'ind' && S.wmx.p !== 'ind') wmxTypen().forEach((f) => (S.wmx.m[f.k] = wmxAnteil(f.k)));
    S.wmx.p = v;
  } else {
    const n = +String(v).replace(',', '.');
    if (!isFinite(n)) return;
    if (k === 'm') {
      if (S.wmx.p !== 'ind') {
        wmxTypen().forEach((f) => (S.wmx.m[f.k] = wmxAnteil(f.k)));
        S.wmx.p = 'ind';
      }
      S.wmx.m[fk] = Math.max(0, Math.min(100, n));
    } else if (k === 's') S.wmx.s[fk] = Math.max(15, Math.min(250, n));
  }
  zoRender();
  faRender(true);
}

/** Einstellungen im Fenster „Flächenarten“: Vorlage, Anteil und Zielgröße je Wohnungs-Flächenart. */
function wmxEinstellungHtml() {
  const T = wmxTypen(),
    summe = T.reduce((s, f) => s + wmxAnteil(f.k), 0);
  let h = `<h4>Wohnungsmix (Soll)</h4><div class="mu" style="margin-bottom:4px">Alle Flächenarten mit Nutzung „Wohnen“ (außer der allgemeinen) gelten als Wohnungstyp. Auswertung unter Gebäudemetrik → Einheiten.</div>`;
  h += `<div class="row"><label>Verteilung</label><select onchange="wmxSet('p',0,this.value)">${Object.keys(
    WMX_VORLAGEN,
  )
    .map(
      (k) =>
        `<option value="${k}" ${S.wmx.p === k ? 'selected' : ''}>${WMX_VORLAGEN[k][0]}${WMX_VORLAGEN[k][1] ? ' ' + Object.values(WMX_VORLAGEN[k][1]).join('/') : ''}</option>`,
    )
    .join('')}</select></div>`;
  if (!T.length)
    return (
      h +
      '<div class="mu">Noch keine Wohnungs-Flächenart – oben eine Flächenart mit Nutzung „Wohnen“ anlegen.</div>'
    );
  h += `<div class="wmx"><span></span><span class="mu">Flächenart</span><span class="mu">Anteil %</span><span class="mu">Größe m²</span>${T.map(
    (f) =>
      `<i style="background:${f.c}"></i><label>${esc(f.n)}</label><input type="number" min="0" max="100" step="1" value="${wmxAnteil(f.k)}" onchange="wmxSet('m','${f.k}',this.value)"><input type="number" min="15" max="250" step="1" value="${wmxGroesse(f.k)}" title="Zielwohnfläche je Wohnung" onchange="wmxSet('s','${f.k}',this.value)">`,
  ).join('')}</div>`;
  h += `<div class="mu" style="margin-top:4px">Summe ${summe} %${summe !== 100 ? ' – Anteile werden auf 100 % umgerechnet' : ''}. Eigene Anteile stellen die Verteilung auf „Individuell“; die Vorlagen gelten für die 1- bis 5-Zimmer-Wohnung.</div>`;
  return h;
}

/** Abschnitt „Wohnungsmix“ für die Gebäudemetrik (Modus Einheiten); '' ohne Wohnnutzung. R, A aus zoRender. */
function wmxHtml(P, R, A) {
  const T = wmxTypen(),
    idx = new Map(T.map((f, i) => [f.k, i])),
    ist = T.map(() => 0),
    fl = T.map(() => 0);
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
        const k = idx.get(f.fa);
        if (k !== undefined) {
          ist[k]++;
          fl[k] += f.a;
        } else {
          const d = grFA(f.fa);
          if (d && d.u === 'Wohnen') {
            ohne++;
            ohneA += f.a;
          }
        }
      }),
    );
  });
  const nIst = ist.reduce((a, b) => a + b, 0) + ohne;
  if ((!nIst && !bgf) || !T.length) return '';
  const so = wmxSoll(T),
    sz = T.map((f) => wmxGroesse(f.k)),
    mittel = sz.reduce((s, x, i) => s + x * so[i], 0) || 1,
    pc = (x, t) => (t ? Math.round((x / t) * 100) : 0),
    balken = (arr) =>
      `<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin:3px 0">${arr.map((c, i) => `<div title="${esc(T[i].n)}: ${c}" style="flex:${c} 0 0;background:${T[i].c}"></div>`).join('')}</div>`,
    vorlage = WMX_VORLAGEN[S.wmx.p][0],
    einst = `<div class="mu" style="margin:6px 0 2px"><a href="#" onclick="faToggle(true);return false" title="Soll-Anteile und Zielgrößen im Fenster „Flächenarten“ einstellen">Wohnungsmix einstellen …</a></div>`;
  let body = '',
    tot,
    pie;
  if (nIst) {
    const soN = wmxVerteilen(nIst, so),
      wf = fl.reduce((a, b) => a + b, 0) + ohneA,
      abw = so.reduce((s, x, i) => s + Math.abs(x * 100 - pc(ist[i], nIst)), 0) / 2;
    body += `<div class="mu" style="margin-top:4px">Ist (im Grundriss angelegt)</div>${balken(ist)}<div class="mu" style="margin-top:6px">Soll (${esc(vorlage)})</div>${balken(soN)}<div style="height:6px"></div>`;
    T.forEach((f, i) => {
      const p = pc(ist[i], nIst),
        d = p - Math.round(so[i] * 100);
      if (!ist[i] && !so[i]) return;
      body += R(
        f.c,
        `${esc(f.n)} <span class="mu">Ziel ${f1(sz[i], 0)} m²${ist[i] ? ' · Ø ' + f1(fl[i] / ist[i], 0) + ' m²' : ''}</span>`,
        `${ist[i]} · ${p} % <span class="mu">Soll ${Math.round(so[i] * 100)} %</span> <span style="color:${Math.abs(d) <= 5 ? '#3f7d4e' : '#a35a00'}">${d > 0 ? '+' : ''}${d}</span>`,
        '',
        { t: 'fa', k: f.k, lab: f.n },
      );
    });
    if (ohne) {
      const g = S.fa.find((f) => f.u === 'Wohnen' && f.df);
      body += R(g ? g.c : '', 'Wohnen ohne Typ', ohne + ' <span class="mu">' + A(ohneA) + '</span>', '', {
        t: 'fa',
        k: g ? g.k : 'wo',
        lab: 'Wohnen',
      });
    }
    body +=
      R('', 'Wohnungen gesamt', nIst, 't') +
      R('', 'Wohnfläche gesamt', A(wf), 's') +
      R('', 'Ø Wohnungsgröße', A(wf / nIst), 's') +
      R('', 'Abweichung zum Soll', f1(abw, 1) + ' Pkt.', 's');
    tot = nIst + ' WE';
    pie = ist.map((v, i) => ({ n: T[i].n, c: T[i].c, v })).filter((x) => x.v);
  } else {
    const wf = bgf * WMX_WF_ANTEIL,
      n = Math.max(0, Math.round(wf / mittel)),
      soN = wmxVerteilen(n, so);
    body += `<div class="mu" style="margin-top:4px">Schätzung aus BGF Wohnen ${A(bgf)} × ${Math.round(WMX_WF_ANTEIL * 100)} % Wohnfläche – genaue Werte, sobald im Grundriss Wohnungen angelegt sind.</div><div class="mu" style="margin-top:6px">Soll (${esc(vorlage)})</div>${balken(soN)}<div style="height:6px"></div>`;
    T.forEach((f, i) => {
      if (!so[i]) return;
      body += R(
        f.c,
        `${esc(f.n)} <span class="mu">Ziel ${f1(sz[i], 0)} m²</span>`,
        `≈ ${soN[i]} <span class="mu">${Math.round(so[i] * 100)} %</span>`,
      );
    });
    body +=
      R('', 'Wohnungen (geschätzt)', '≈ ' + n, 't') +
      R('', 'Wohnfläche (geschätzt)', A(wf), 's') +
      R('', 'Ø Wohnungsgröße (Soll)', A(mittel), 's');
    tot = '≈ ' + n + ' WE';
    pie = soN.map((v, i) => ({ n: T[i].n, c: T[i].c, v })).filter((x) => x.v);
  }
  if (S.zo.o.mix === undefined) S.zo.o.mix = 1;
  return zoD('mix', 'Wohnungsmix', tot, body + einst, pie);
}
