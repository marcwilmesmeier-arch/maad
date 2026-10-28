// ---- v491: zusammengefasster Menuepunkt "Umgebung" (Flaechen, Strassen, Baeume)
(function () {
  const a = $('mA'),
    s = $('mS'),
    t = $('mT');
  if (!a || $('mU')) return;
  const ic =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4.5"/><path d="M9 12.5V17M6.5 17h5"/><path d="M14 20c0-5 4-4 4-9"/></svg>';
  const cl = "this.closest('.tg').classList.remove('open');";
  const shp = (typeof SHP !== 'undefined' ? SHP : [])
    .map(
      (x) =>
        `<button class="tb" title="Fläche: ${x.n}" onclick="${cl}setShape('${x.k}','area')"><i>${x.ic}</i>Fläche · ${x.n}</button>`,
    )
    .join('');
  const stI = s ? s.querySelector('i').innerHTML : '',
    trI = t ? t.querySelector('i').innerHTML : '';
  const h = `<div class="tg"><button class="tb tmain" id="mU" onclick="tmToggle(this)" title="Umgebung – Flächen (Grün, Platz, Wasser …), Straßen und Bäume"><i>${ic}</i>Umgebung</button><div class="tm" id="tmU">${shp}<button class="tb" title="Straße zeichnen – Linie mit ausgerundeten Ecken" onclick="${cl}setStreet()"><i>${stI}</i>Straße</button><button class="tb" title="Bäume setzen – Höhe, Krone, Stamm einstellbar" onclick="${cl}trToggle()"><i>${trI}</i>Bäume</button></div></div>`;
  a.parentNode.insertAdjacentHTML('beforebegin', h);
  [a, s, t].forEach((b) => {
    if (b && b.parentNode && b.parentNode.classList.contains('tg')) b.parentNode.style.display = 'none';
  });
})();

// v498: Baum-Modus: der Skizzen-/Modellier-Klick darf den ersten Klick nicht schlucken
{
  const _a = skAct;
  skAct = function () {
    return !TRE.on && _a.apply(this, arguments);
  };
}

// v498: Untermenues gruppieren: "Skizze Gebäude" (Gebäude) und "Skizze Fläche" (Umgebung)
(function () {
  const st = document.createElement('style');
  st.textContent =
    '.tm .tmh{font-size:10px;letter-spacing:.07em;text-transform:uppercase;opacity:.55;padding:6px 10px 2px;white-space:nowrap}.tm .tmh:not(:first-child){margin-top:4px;border-top:1px solid var(--ln,#ddd);padding-top:8px}';
  document.head.appendChild(st);
  const H = (t) => `<div class="tmh">${t}</div>`;
  const b = $('tmB');
  if (b && !b.querySelector('.tmh')) b.insertAdjacentHTML('afterbegin', H('Skizze Gebäude'));
  const u = $('tmU');
  if (u && !u.querySelector('.tmh')) {
    u.insertAdjacentHTML('afterbegin', H('Skizze Fläche'));
    u.querySelectorAll('button').forEach((x) => {
      if (/^<i>.*<\/i>Fläche · /.test(x.innerHTML) || x.textContent.indexOf('Fläche · ') >= 0) {
        x.lastChild.textContent = x.lastChild.textContent.replace('Fläche · ', '');
      }
    });
    const st1 = [...u.querySelectorAll('button')].find((x) => /Straße/.test(x.textContent));
    if (st1) st1.insertAdjacentHTML('beforebegin', H('Straßen & Bäume'));
  }
})();
