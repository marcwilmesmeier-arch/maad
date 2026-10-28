// ---- v486: Menue in Gruppen und Ebenen (Bearbeiten-Leiste + Rechtsklick)
const MNG = [
  ['Auswahl', ['sks']],
  ['Zeichnen', ['skz', 'skr', 'skk']],
  ['Transformieren', ['mv', 'skc', 'ro']],
  ['Form', ['skp', 'skf', 'skl', 'ed']],
  ['Weiter', ['gr', 'fd']],
  ['Löschen', ['del']],
];
const MNL = {
  0: ['sks', 'skz', 'skr', 'skk'],
  1: null,
  2: ['sks', 'skz', 'skr', 'skk', 'skp', 'skf', 'skl', 'ed', 'del'],
  A: ['sks', 'skz', 'skr', 'skk', 'mv', 'ed', 'skf', 'del'],
};
(function () {
  const st = document.createElement('style');
  st.textContent =
    '#tmE .ba-off{opacity:.34;pointer-events:none}#cmenu .ba-hide,#tmE .ba-hide{display:none!important}#tmE .bsep{display:inline-block;width:1px;height:22px;background:var(--ln,#ddd);margin:0 5px;vertical-align:middle}#cmenu .cmh{font-size:10px;letter-spacing:.07em;text-transform:uppercase;opacity:.55;padding:7px 10px 2px}#cmenu .cmh.ba-hide{display:none}';
  document.head.appendChild(st);
})();
function mnLevel() {
  try {
    const b = S.sel;
    if (b && !b.ex && S.bld.includes(b)) {
      if (S.selP || (S.vi != null && S.vi >= 0) || (typeof SKN !== 'undefined' && SKN.sel)) return 2;
      return 1;
    }
    if (S.selA) return 'A';
  } catch (e) {
    logErr(e, 'mnLevel');
  }
  return 0;
}
function mnGroups() {
  const tm = document.getElementById('tmE'),
    cm = document.getElementById('cmenu');
  if (!tm || !cm) return;
  if (!tm.querySelector('.bsep')) {
    MNG.forEach(([n, ks], gi) => {
      const f = tm.querySelector('[data-ba="' + ks[0] + '"]');
      if (f && gi > 0) {
        const s = document.createElement('span');
        s.className = 'bsep';
        s.title = n;
        f.parentNode.insertBefore(s, f);
      }
    });
  }
  cm.querySelectorAll('hr').forEach((h) => h.remove());
  if (!cm.querySelector('.cmh')) {
    MNG.forEach(([n, ks]) => {
      const f = cm.querySelector('[data-ba="' + ks[0] + '"]');
      if (f) {
        const h = document.createElement('div');
        h.className = 'cmh';
        h.textContent = n;
        h.dataset.g = ks.join(',');
        f.parentNode.insertBefore(h, f);
      }
    });
  }
}
let _mnk = '';
function mnSync() {
  try {
    mnGroups();
    const L = mnLevel(),
      ok = MNL[L],
      stg = mnStorey(),
      k = L + '|' + (skModeNow() ? 1 : 0) + '|' + (stg ? 1 : 0);
    if (k === _mnk && !mnSync.f) return;
    _mnk = k;
    mnSync.f = 0;
    const on = (x) => (x === 'grl' ? stg : !ok || ok.includes(x));
    document
      .querySelectorAll('#tmE [data-ba]')
      .forEach((b) => b.classList.toggle('ba-off', !on(b.dataset.ba)));
    const dr0 = ['skz', 'skr', 'skk'],
      onC = (x) => (x === 'grl' ? stg : L === 2 ? true : on(x));
    document
      .querySelectorAll('#cmenu [data-ba]')
      .forEach((b) => b.classList.toggle('ba-hide', !onC(b.dataset.ba) || dr0.includes(b.dataset.ba)));
    document
      .querySelectorAll('#cmenu .cmh')
      .forEach((h) =>
        h.classList.toggle('ba-hide', !h.dataset.g.split(',').some((x) => onC(x) && !dr0.includes(x))),
      );
  } catch (e) {
    logErr(e, 'mnSync');
  }
}
setInterval(mnSync, 200);
// Esc: erst Punkt, dann Teilflaeche abwaehlen, bevor das Gebaeude abgewaehlt wird
addEventListener(
  'keydown',
  (e) => {
    try {
      if (e.key !== 'Escape' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
      if (S.tool !== 'v' || (dr && dr.m)) return;
      if (S.sel && S.vi != null && S.vi >= 0) {
        S.vi = null;
        drawOv();
        rr();
        e.stopImmediatePropagation();
        return;
      }
      if (S.sel && S.selP) {
        S.selP = null;
        H();
        drawOv();
        rr();
        e.stopImmediatePropagation();
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);

// abstTarget(): Erweiterung zusammengeführt, siehe 11-bearbeiten/010-werkzeug.js

// v488: Enter erzeugt das Gebaeude aus der geschlossenen Kontur (wie "Gebaeude erzeugen" im Planen-Panel)
addEventListener(
  'keydown',
  (e) => {
    try {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = (e.target || {}).tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(t) || (e.target || {}).isContentEditable) return;
      if (S.tool === 'f' && S.closed && S.dm !== 'area' && S.draft && S.draft.length > 2) {
        if (!document.getElementById('ng')) {
          S.tab = 'Planen';
          rr();
        }
        if (!document.getElementById('ng')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        mk();
      }
    } catch (x) {
      console.warn('enterMk', x);
    }
  },
  true,
);
