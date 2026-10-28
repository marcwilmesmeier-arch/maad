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
};
function anPanel(b) {
  const s = axSites(),
    T = [
      ['ue', 'Übersicht'],
      ['re', 'Restriktionen'],
    ];
  if (S.anT !== 'ue' && S.anT !== 're') S.anT = 'ue';
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
    '</div>';
  h += S.anT === 're' ? axRe(b) : axUe(b);
  return h + '</div>';
}
