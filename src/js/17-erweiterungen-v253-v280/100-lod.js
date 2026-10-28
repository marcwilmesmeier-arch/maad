/* v272: LOD-Regler (Level of Development) im oberen Werkzeug-Dock, sehr flach, Bedienung wie der Schieberegler der Gebäudemetrik.
   Registry LODS: je Stufe Schlüssel k, Name n, Beschreibung d und ok() = ist diese Stufe im Modell vorhanden? Nicht vorhandene Stufen sind ausgegraut und nicht wählbar.
   Start: nur LOD 100 (Baukörper). Neue Stufe freischalten = ok() der Stufe auf true setzen bzw. an die Modelldaten koppeln; lodSet() meldet die Wahl per Ereignis 'lotlod' (document) und in S.lod. */
const LODS = [
  {
    k: 100,
    n: 'Baukörper',
    d: 'Gebäude als Volumen mit Geschossen und Dachform – aktueller Modellstand',
    ok: () => true,
  },
  { k: 200, n: 'Bauteile', d: 'Wände, Geschossdecken und Dach als einzelne Bauteile', ok: () => false },
  { k: 300, n: 'Aufbau', d: 'Bauteilaufbauten (Schichten), genaue Maße und Öffnungen', ok: () => false },
  { k: 400, n: 'Ausführung', d: 'Ausführungsplanung mit Detaillierung und Anschlüssen', ok: () => false },
  { k: 500, n: 'Bestand', d: 'Dokumentation des Ausgeführten (As-built)', ok: () => false },
];
S.lod = S.lod || 100;
{
  const c = document.createElement('style');
  c.id = 'lodCss';
  c.textContent = `
#tbar{padding-bottom:36px!important}
#lodbar{position:absolute;left:10px;right:10px;bottom:7px;height:24px;display:flex;align-items:center;gap:2px;padding:2px;border-radius:12px;background:color-mix(in srgb,var(--tx,#1d1d1b) 6%,transparent)}
#lodbar .lodl{flex:none;font-size:9.5px;letter-spacing:.12em;font-weight:700;color:var(--mu);padding:0 8px 0 9px;user-select:none}
#lodbar button{flex:1;min-width:0;height:20px;padding:0 4px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--g7,var(--mu));font:inherit;font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .3s,color .3s,flex .35s cubic-bezier(.2,.8,.2,1),opacity .2s}
#lodbar button.on{flex:2.6;background:var(--pn,#fff);color:var(--pa5,var(--tx));font-weight:600;box-shadow:0 1px 6px #1d1d1b1f;cursor:default}
#lodbar button:disabled{opacity:.38;cursor:not-allowed}
#lodbar button:not(:disabled):not(.on):hover{background:color-mix(in srgb,var(--tx,#1d1d1b) 8%,transparent)}
#lodbar button:focus-visible{outline:2px solid var(--pa4,#888);outline-offset:1px}
#hud{top:122px!important}
`;
  document.head.appendChild(c);
}
function lodRender() {
  const e = document.getElementById('lodbar');
  if (!e) return;
  e.innerHTML =
    '<span class="lodl" title="Level of Development – Detaillierungsgrad des Modells">LOD</span>' +
    LODS.filter((L) => L.k < 400)
      .map((L) => {
        const ok = !!L.ok(),
          on = S.lod === L.k;
        return (
          '<button type="button" role="radio" aria-checked="' +
          on +
          '" class="' +
          (on ? 'on' : '') +
          '"' +
          (ok ? '' : ' disabled') +
          ' onclick="lodSet(' +
          L.k +
          ')" title="LOD ' +
          L.k +
          ' – ' +
          L.n +
          ': ' +
          L.d +
          (ok ? '' : ' (noch nicht im Modell)') +
          '" aria-label="LOD ' +
          L.k +
          ' ' +
          L.n +
          '">' +
          (on ? 'LOD ' + L.k : L.k) +
          '</button>'
        );
      })
      .join('');
}
function lodSet(k) {
  const L = LODS.find((x) => x.k === +k);
  if (!L || !L.ok()) return;
  S.lod = L.k;
  lodRender();
  try {
    document.dispatchEvent(new CustomEvent('lotlod', { detail: { lod: L.k, name: L.n } }));
  } catch (e) {
    logErr(e, 'lodSet');
  }
}
{
  const tb = document.getElementById('tbar');
  if (tb && !document.getElementById('lodbar')) {
    const d = document.createElement('div');
    d.id = 'lodbar';
    d.setAttribute('role', 'radiogroup');
    d.setAttribute('aria-label', 'Detaillierungsgrad (LOD)');
    tb.appendChild(d);
    lodRender();
  }
}
