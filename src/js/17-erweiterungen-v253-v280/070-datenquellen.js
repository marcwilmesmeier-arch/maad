/* v271: Datenquellen-Reiter aus „Grundstück und Umgebung“ ins Fenster „Datenquellen & Einstellungen“ (Reiter „Umwelt & Schutz“ und „Datenstand“) */
{
  if (typeof SRT !== 'undefined' && !SRT.some((t) => t[0] === 'um')) {
    SRT.push(['um', 'Umwelt & Schutz'], ['ri', 'Risikogebiete'], ['dv', 'Datenstand']);
  }
}
// srcData(): Erweiterung zusammengeführt, siehe 04-datenquellen/020-nur-einen-datensatz.js
// rr(): Erweiterung zusammengeführt, siehe 07-analyse/010-analyse.js
const ANI = {
  ue: '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/>',
  re: '<path d="M12 3l8 3v6c0 4.500-3.200 7.800-8 9-4.800-1.200-8-4.500-8-9V6z"/><path d="M12 8v5M12 16v.5"/>',
  wi: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  em: '<path d="M4 20h16"/><path d="M7 20v-5h4v5"/><path d="M8 11c0-2 2-2 2-4s-2-2-2-4"/><path d="M13 12c0-2 2-2 2-4s-2-2-2-4"/>',
  sc: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/><path d="M3 21h18"/>',
  so: symGlyphe('sonne_glyphe'), // Sonne aus „Landscape & Climate“ (186-symbole-bibliothek.js)
  er: symGlyphe('fuss'), // Fußabdrücke aus dem Symbolsatz „Mobility & Access“ (185-symbole.js)
};
function anPanel(b) {
  const s = axSites(),
    T = [
      ['ue', 'Übersicht'],
      ['re', 'Restriktionen'],
      ['wi', 'Wind'],
      ['em', 'Emissionen'],
    ],
    T2 = [
      ['sc', 'Site & Context'],
      ['er', 'Erreichbarkeit'],
      ['so', 'Sonnenstunden'],
    ]; // zweite Reihe: nur Symbol; erneuter Klick blendet die Darstellung aus/ein
  if (!T.concat(T2).some((t) => t[0] === S.anT)) S.anT = 'ue';
  let h = '<div class="ax">';
  h += s
    ? `<div class="axh">${axI(AXI.pin, 26)}<div><b>${esc((S.project && S.project.name) || s.label)}</b><span>${esc(s.fl || s.label)}</span><span>${esc(s.sub[0] || '')}</span></div></div>`
    : `<div class="axh">${axI(AXI.pin, 26)}<div><b>Standort</b><span>kein Grundstück gewählt</span></div></div>`;
  h +=
    '<div class="axt" role="tablist">' +
    T.map(
      ([k, n]) =>
        `<button class="${S.anT === k ? 'on' : ''}" role="tab" aria-selected="${S.anT === k}" onclick="anTab('${k}')" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ANI[k]}</svg><span>${n}</span></button>`,
    ).join('') +
    '</div>' +
    '<div class="axt axt2" role="tablist">' +
    T2.map(([k, n]) => {
      const da =
          k === 'sc'
            ? SC.lm.length || SC.pl.length
            : k === 'er'
              ? ER.raster || ER.halte.length
              : k === 'so'
                ? SO.erg
                : 0,
        an = da && (k === 'sc' ? scSichtbar() : k === 'er' ? erSichtbar() : soSichtbar());
      return `<button class="${S.anT === k ? 'on' : ''}${da ? (an ? ' an' : ' aus') : ''}" role="tab" aria-selected="${S.anT === k}" onclick="anTab('${k}')" title="${n}${da ? ' – erneut klicken: Darstellung ' + (an ? 'ausblenden' : 'einblenden') : ''}" aria-label="${n}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ANI[k]}</svg></button>`;
    }).join('') +
    '</div>';
  h +=
    S.anT === 're'
      ? axRe(b)
      : S.anT === 'wi'
        ? wiPanel()
        : S.anT === 'em'
          ? emPanel()
          : S.anT === 'sc'
            ? scPanel()
            : S.anT === 'er'
              ? erPanel()
              : S.anT === 'so'
                ? soPanel()
                : axUe(b);
  return h + '</div>';
}
