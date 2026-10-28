// ---- v240: Himmelfarbe je Darstellung (Weißmodell · Schattiert · Realistisch) – Menü "Darstellung"
S.sky = Object.assign({ wm: '#f8f7f4', sch: '#f8f7f4', real: '#1560db' }, S.sky || {});
const SKY0 = { wm: '#f8f7f4', sch: '#f8f7f4', real: '#1560db' };
const skyMode = () => (S.dar === 'real' ? 'real' : S.dar === 'wm' ? 'wm' : 'sch');
const skyNm = { wm: 'Weißmodell', sch: 'Schattiert', real: 'Realistisch' };
function skyPre() {
  const m = skyMode();
  S.sky = Object.assign({}, SKY0, S.sky || {});
  if (m === 'real' && DR.skyM && DR.skyM.material.uniforms && DR.skyM.material.uniforms.uZ) {
    const z = DR.skyM.material.uniforms.uZ.value;
    if (KONsky.r !== S.sky.real) {
      KONsky.r = S.sky.real;
      z.set(S.sky.real);
    }
  }
  const c = S.m3 && m !== 'real' ? S.sky[m] : '#f8f7f4';
  if (KONsky.c !== c) {
    KONsky.c = c;
    ren.setClearColor(new T.Color(c));
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/060-darstellung.js (danach)
  try {
    if (S.dar === 'sw' && KONsky.c !== '#ffffff') {
      KONsky.c = '#ffffff';
      ren.setClearColor(new T.Color('#ffffff'));
    }
  } catch (e) {
    logErr(e, 'skyPre');
  }
}
const KONsky = { c: null, r: null };
function skyUi() {
  const q = (id) => document.getElementById(id),
    m = skyMode(),
    a = q('skyc'),
    n = q('skynm');
  if (!a) return;
  a.value = S.sky[m] || SKY0[m];
  n.textContent = '(' + skyNm[m] + ')';
}
{
  const lc = document.getElementById('darDesc');
  if (lc && !document.getElementById('skyrow')) {
    lc.insertAdjacentHTML(
      'afterend',
      '<div id="skyrow" style="display:flex;align-items:center;gap:8px;margin:8px 0 4px;font-size:12px"><span>Himmelfarbe</span><small id="skynm" style="color:var(--mu)"></small><input type="color" id="skyc" style="width:34px;height:24px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer;margin-left:auto"><button type="button" id="skyrs" style="font-size:11px;border:1px solid var(--ln);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer">Standard</button></div>',
    );
    document.getElementById('skyc').addEventListener('input', (e) => {
      S.sky[skyMode()] = e.target.value;
    });
    document.getElementById('skyrs').addEventListener('click', () => {
      S.sky[skyMode()] = SKY0[skyMode()];
      skyUi();
    });
  }
}
// drUi(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
skyUi();
