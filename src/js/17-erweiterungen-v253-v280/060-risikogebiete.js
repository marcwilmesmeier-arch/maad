/* v272: Risikogebiete – je Quelle bundesweit oder je Bundesland, mit Matrix „was fehlt“ */
S.riO = S.riO || {};
function axRi() {
  const R = ENV.filter((e) => e.rg),
    LD = envLands(),
    cur = envLand();
  const SH = { hq: 'Fluss-Risiko', sr: 'Starkregen', ueg: 'HQ100', hqx: 'HQ extrem' };
  let h =
    '<div class="axk" style="margin:0 0 8px">Je Quelle wählen: <b>bundesweit</b> (eine Adresse gilt für alle Länder) oder <b>je Bundesland</b> pflegen. Die Übersicht zeigt, für welche Länder noch Daten fehlen. Antippen öffnet den Eintrag.</div>';
  h +=
    '<table class="rim"><thead><tr><th>Bundesland</th>' +
    R.map(
      (e) =>
        '<th title="' +
        esc(e.n) +
        '">' +
        esc(SH[e.k] || e.n) +
        (envScope(e.k) === 'de' ? '<i>bundesweit</i>' : '<i>je Land</i>') +
        '</th>',
    ).join('') +
    '</tr></thead><tbody>' +
    LD.map(
      (L) =>
        '<tr' +
        (L === cur ? ' class="cur"' : '') +
        '><td>' +
        esc(BLN[L]) +
        (L === cur ? ' <i>Projekt</i>' : '') +
        '</td>' +
        R.map((e) => {
          const ok = envHas(e.k, L);
          return (
            '<td><a class="rid ' +
            (ok ? 'ok' : 'no') +
            '" onclick="riGo(\'' +
            e.k +
            "','" +
            L +
            '\')" title="' +
            esc(e.n + ' · ' + BLN[L] + ': ' + (ok ? 'angebunden' : 'fehlt')) +
            '">' +
            (ok ? '●' : '○') +
            '</a></td>'
          );
        }).join('') +
        '</tr>',
    ).join('') +
    '</tbody></table>';
  for (const e of R) {
    const sc = envScope(e.k),
      n = LD.filter((L) => envHas(e.k, L)).length;
    h +=
      '<div class="rib"><div class="axn" style="display:flex;align-items:center;gap:8px">' +
      axI(AXI[e.ic], 16) +
      '<span style="flex:1">' +
      esc(e.n) +
      '</span><span class="axk" style="margin:0">' +
      (sc === 'de'
        ? envHas(e.k)
          ? 'bundesweit angebunden'
          : 'nicht angebunden'
        : n + ' von ' + LD.length + ' Ländern') +
      '</span></div>' +
      '<div class="axk" style="margin:0 0 6px">' +
      esc(e.hint) +
      '</div>' +
      '<div class="ris"><button type="button" class="' +
      (sc === 'de' ? 'on' : '') +
      '" onclick="riScope(\'' +
      e.k +
      '\',\'de\')">bundesweit</button><button type="button" class="' +
      (sc === 'land' ? 'on' : '') +
      '" onclick="riScope(\'' +
      e.k +
      "','land')\">je Bundesland</button></div>";
    if (sc === 'de') h += envFormHtml(e, '', 1);
    else {
      h +=
        (envHas(e.k, '') ? '' : '') +
        (ENVC[e.k] && ENVC[e.k].url
          ? '<button class="axs2" style="margin:0 0 8px" onclick="riCopy(\'' +
            e.k +
            '\')">Bundesweite Quelle für alle Länder übernehmen</button>'
          : '');
      h += LD.map((L) => {
        const ok = envHas(e.k, L),
          o = S.riO[e.k + ':' + L];
        return (
          '<details class="rid2" id="ri_' +
          e.k +
          '_' +
          L +
          '"' +
          (o ? ' open' : '') +
          ' ontoggle="S.riO[\'' +
          e.k +
          ':' +
          L +
          '\']=this.open?1:0"><summary><i class="dot ' +
          (ok ? 'ok' : 'fail') +
          '"></i><span>' +
          esc(BLN[L]) +
          (L === cur ? ' <em>Projekt</em>' : '') +
          '</span><span class="axk" style="margin:0">' +
          (ok ? 'angebunden' : 'fehlt') +
          '</span></summary>' +
          envFormHtml(e, L) +
          '</details>'
        );
      }).join('');
    }
    h += '</div>';
  }
  return h;
}
function riScope(k, sc) {
  ENVS[k] = sc;
  envSave();
  delete ENVR[k];
  rr();
}
function riCopy(k) {
  if (!ENVC[k]) return;
  ENVL[k] = ENVL[k] || {};
  envLands().forEach((L) => {
    if (!ENVL[k][L] || !ENVL[k][L].url) ENVL[k][L] = Object.assign({}, ENVC[k]);
  });
  envSave();
  rr();
}
function riGo(k, L) {
  if (envScope(k) !== 'de') S.riO[k + ':' + L] = 1;
  srcOpen('ri');
  setTimeout(() => {
    const el = document.getElementById('ri_' + k + '_' + L);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }, 60);
}
{
  const c = document.createElement('style');
  c.id = 'riCss';
  c.textContent = `
#srcm .rim{border-collapse:collapse;width:100%;margin:0 0 12px;font-size:11.5px}
#srcm .rim th{font-weight:600;text-align:center;padding:4px 6px;border-bottom:1px solid var(--ln);vertical-align:bottom}
#srcm .rim th:first-child,#srcm .rim td:first-child{text-align:left}
#srcm .rim th i{display:block;font-style:normal;font-weight:400;font-size:10px;color:var(--mu)}
#srcm .rim td{padding:3px 6px;border-bottom:1px solid color-mix(in srgb,var(--ln) 60%,transparent);text-align:center}
#srcm .rim tr.cur td{background:color-mix(in srgb,var(--pa1,#f4e4e2) 55%,transparent)}
#srcm .rim td i,#srcm .rid2 em{font-style:normal;font-size:10px;color:var(--mu);border:1px solid var(--ln);border-radius:5px;padding:0 4px;margin-left:4px}
#srcm a.rid{cursor:pointer;text-decoration:none;font-size:13px}#srcm a.rid.ok{color:#3c9a62}#srcm a.rid.no{color:#b6b8bc}
#srcm .rib{border:1px solid var(--ln);border-radius:12px;padding:10px 12px;margin:0 0 10px}
#srcm .ris{display:inline-flex;gap:2px;padding:2px;border-radius:11px;background:color-mix(in srgb,var(--tx,#1d1d1b) 6%,transparent);margin:0 0 8px}
#srcm .ris button{border:1px solid transparent;border-radius:9px;background:transparent;padding:3px 12px;font:inherit;font-size:11.5px;cursor:pointer;color:var(--mu)}
#srcm .ris button.on{background:var(--pn,#fff);color:var(--tx);font-weight:600;box-shadow:0 1px 5px #1d1d1b1f;cursor:default}
#srcm details.rid2{border-top:1px solid var(--ln);padding:0}
#srcm details.rid2>summary{display:flex;align-items:center;gap:8px;padding:6px 2px;cursor:pointer;font-size:12px}
#srcm details.rid2>summary span:nth-of-type(1){flex:1}
#srcm details.rid2>.axq{margin:2px 0 8px}
#srcm i.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#bbb}#srcm i.dot.ok{background:#3c9a62}#srcm i.dot.fail{background:#c0504d}
`;
  document.head.appendChild(c);
}
function axDq() {
  return axDqUsed() + axDqEnv();
}
function anTab(t) {
  S.anT = t;
  rr();
}
