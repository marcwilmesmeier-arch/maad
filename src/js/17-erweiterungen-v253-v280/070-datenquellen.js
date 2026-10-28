/* v271: Datenquellen-Reiter aus „Grundstück und Umgebung“ ins Fenster „Datenquellen & Einstellungen“ (Reiter „Umwelt & Schutz“ und „Datenstand“) */
{
  if (typeof SRT !== 'undefined' && !SRT.some((t) => t[0] === 'um')) {
    SRT.push(['um', 'Umwelt & Schutz'], ['ri', 'Risikogebiete'], ['dv', 'Datenstand']);
  }
  const _sd = srcData;
  srcData = function () {
    const D = _sd.apply(this, arguments);
    try {
      D.um = '<div class="ax">' + axDqEnv() + '</div>';
      D.ri = '<div class="ax">' + axRi() + '</div>';
      D.dv = '<div class="ax">' + axDqUsed() + '</div>';
    } catch (e) {
      D.um = D.dv = '<div class="stn">' + esc(e.message || e) + '</div>';
    }
    return D;
  };
  const _rr = rr;
  rr = function () {
    const r = _rr.apply(this, arguments);
    try {
      const m = document.getElementById('srcm');
      if (
        m &&
        m.style.display === 'flex' &&
        (S.srTab === 'um' || S.srTab === 'ri' || S.srTab === 'dv') &&
        !rr.__in
      ) {
        rr.__in = 1;
        try {
          srcOpen();
        } finally {
          rr.__in = 0;
        }
      }
    } catch (e) {
      logErr(e, 'rr');
    }
    return r;
  };
}
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
