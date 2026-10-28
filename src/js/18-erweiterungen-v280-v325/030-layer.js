/* ===== v284 Layer-Einstellungen je Darstellung (Weißmodell · Schattiert · Realistisch) ===== */
const LYD = { skip: 0, col: {} };
S.lyM = {};
const lyMSnap = () => ({
  ly: LY.map((l) => [l[1], l[2] ? 1 : 0, l[3]]),
  lc: JSON.parse(JSON.stringify(S.lc)),
  sn: !!S.showSN,
  fn: !!S.showFN,
  pc: S.wmPc !== false,
  wv: S.dar === 'wm' && S.wmPalDone ? 2 : 0,
});
function lyMApply(st) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
  const r = (() => {
    if (!st || !st.ly) return;
    const ch = Object.keys(st.lc || {}).filter((k) => S.lc[k] !== st.lc[k]);
    Object.assign(S.lc, lcMig(st.lc || {}));
    if (ch.length) lcApplyAll(ch);
    st.ly.forEach(([k, v, o]) => {
      if (['clc', 'nsg', 'ffh', 'vsg', 'hq'].includes(k)) v = 0;
      const i = LY.findIndex((l) => l[1] === k);
      if (i < 0) return;
      LY[i][2] = v;
      LY[i][3] = o;
      if (!S.geo || !PK[k] || k === 'parcels' || k === 'bplan') {
        if (G[k]) {
          gVis(k, !!v);
          op(k, o);
        }
      }
    });
    S.showSN = !!st.sn;
    S.showFN = !!st.fn;
    if (st.pc != null && (st.pc !== false) !== (S.wmPc !== false)) wmPcSet(st.pc);
    labVis();
    if (S.geo) recomp();
    try {
      if ($('lyp').style.display === 'block') lyRender();
    } catch (e) {
      logErr(e, 'lyMApply');
    }
  })();
  try {
    lyAfterRun();
  } catch (e) {
    logErr(e, 'lyMApply');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/060-darstellung.js (danach)
  try {
    if (S.dar === 'sw' && st && st.ly) {
      LY.forEach((l) => {
        if (l[1] !== 'buildings' && !st.ly.some((x) => x[0] === l[1]) && l[2]) {
          l[2] = 0;
          if (G[l[1]]) gVis(l[1], false);
        }
      });
      labVis();
      if (S.geo) recomp();
    }
  } catch (e) {
    logErr(e, 'lyMApply');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js (danach)
  try {
    bkApply(true);
  } catch (e) {
    logErr(e, 'lyMApply');
  }
  return r;
}
function lyMSave() {
  S.lyM[S.dar] = lyMSnap();
  return JSON.parse(JSON.stringify(S.lyM));
}
function lyMLoad(o) {
  S.lyM = o && typeof o === 'object' ? JSON.parse(JSON.stringify(o)) : {};
  LYD.skip = 1;
  // ── Erweiterung aus 18-erweiterungen-v280-v325/130-weissmodell.js (danach)
  S.wmPalDone = !!(S.lyM.wm && S.lyM.wm.wv === 2);
}
// drSet(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
// vwApplyDs(): Erweiterung zusammengeführt, siehe 15-grundriss/080-ansichten-speichern-auch-alle-anzeige.js
/* Button „Layer“ im Darstellungs-Panel (statt in der unteren Leiste) */
function lyDOpen(open) {
  const p = $('lyp'),
    b = $('lyBtn');
  if (!p) return;
  const o = open == null ? p.style.display !== 'block' : open;
  if (o) {
    lyRender();
    p.style.display = 'block';
  } else p.style.display = 'none';
  if (b) b.classList.toggle('on', o);
}
function lyDUi() {
  const b = $('lyBtn');
  if (b)
    b.innerHTML =
      'Layer &amp; Sichtbarkeit · ' +
      DAR.find((d) => d[0] === S.dar)[1] +
      ' <span style="opacity:.6">▸</span>';
}
{
  const d = $('darDesc');
  if (d && !$('lyBtn')) {
    d.insertAdjacentHTML(
      'afterend',
      '<button class="bt" id="lyBtn" onclick="lyDOpen()" title="Sichtbarkeit, Farben und Transparenz der Elemente – gilt nur für die gewählte Darstellung" style="display:flex;justify-content:space-between;align-items:center;width:100%;border:1px solid var(--ln);padding:7px 11px;margin:2px 0"></button>',
    );
    lyDUi();
  }
  const bg = $('bg');
  if (bg) bg.style.display = 'none';
}
// tgLight(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js

/* ---- Panel: Gruppen, Klick-Symbole, Grafikeffekte; Nutzungen entfallen ---- */
function usesHtml() {
  return '';
}
const LYI = {
  buildings:
    '<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-3h4v3"/>',
  rfs: '<path d="M3 12l9-7 9 7"/><path d="M6 11v8h12v-8"/>',
  rff: '<rect x="4" y="10" width="16" height="9"/><path d="M3 10h18M7 6.5h10"/>',
  un: '<path d="M12 3l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
  abst: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2.5"/>',
  green:
    '<path d="M6 20c0-5 0-9-2-12 3 1 4 5 4 12M12 20c0-6 0-11-1-15 3 2 4 8 3 15M18 20c0-4-1-7-3-9 3 0 5 3 5 9"/>',
  trees: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21M9 21h6"/>',
  water:
    '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  terrain: '<path d="M3 19l6-10 4 6 3-4 5 8z"/>',
  roads: '<path d="M9 3L6 21M15 3l3 18M12 5v3M12 11v3M12 17v3"/>',
  paths: '<path d="M5 20c0-6 6-4 6-9s5-4 8-8" stroke-dasharray="1 3"/>',
  rail: '<path d="M8 3l-3 18M16 3l3 18M6.5 9h11M5.7 15h12.6"/>',
  cycle:
    '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8"/>',
  parcels: '<path d="M4 7l8-3 8 4-2 11-9 2z"/>',
  wms: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  bplan: '<rect x="4" y="6" width="16" height="12" stroke-dasharray="3 2"/><path d="M8 10h8M8 14h5"/>',
  mask: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/>',
  fang: '<path d="M5 19V5M5 19h14M5 12h7v7"/>',
  wire: '<path d="M3 8h18M3 12h18M3 16h18M8 4v16M12 4v16M16 4v16"/>',
  wmpc: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  gen: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  grass: '<path d="M5 20V9M9 20V5M13 20V8M17 20V4M21 20V10" stroke-dasharray="0"/>',
};
const lyIco = (k) => '<svg viewBox="0 0 24 24">' + (LYI[k] || LYI.gen) + '</svg>';
const LYG = [
  ['Gebäude &amp; Dächer', ['buildings', 'rfs', 'rff', 'un', 'abst']],
  ['Freiraum', ['green', 'clg', 'trees', 'water', 'terrain']],
  ['Verkehr', ['roads', 'paths', 'cycle', 'rail']],
  ['Grundstücke &amp; Planung', ['parcels', 'wms', 'bplan']],
  ['Umwelt &amp; Schutzgebiete', null],
  ['Grafikeffekte', 'fx'],
  ['Ansicht &amp; Zeichnen', ['mask', 'wire', 'fang']],
];
function wmPcSet(v) {
  S.wmPc = !!v;
  try {
    wmPaint();
    if (S.geo) recomp();
  } catch (e) {
    console.error(e);
  }
}
function lyDBtn(k, on, act) {
  return `<button type="button" class="lyi ${on ? 'on' : 'off'}" data-k="${k}" ${act ? `data-act="${act}"` : ''} title="Ein-/Ausblenden">${lyIco(k)}</button>`;
}
function lyDGroup() {
  const el = $('lyp');
  if (!el) return;
  const kids = [...el.children],
    names = new Map(LY.map((l) => [l[0], l[1]])),
    units = [];
  let cur = null;
  for (const n of kids) {
    if (n.tagName === 'H4' || n.classList.contains('dmu')) {
      continue;
    }
    const t = n.textContent.trim(),
      pad = /padding-left/.test(n.getAttribute('style') || '');
    if (n.classList.contains('ly') && !pad) {
      const cb = n.querySelector('input[type=checkbox]');
      let k = names.get(t);
      if (!k && n.querySelector('#wirck')) k = 'wire';
      if (!k && /^Umgebung/.test(t)) k = 'mask';
      if (!k) k = 'gen_' + units.length;
      cur = { key: k, node: n, cb, subs: [] };
      units.push(cur);
    } else if (n.tagName === 'LABEL' && n.querySelector('input[type=checkbox]')) {
      cur = { key: 'fang', node: n, cb: n.querySelector('input[type=checkbox]'), subs: [], wrap: true };
      units.push(cur);
    } else if (cur) cur.subs.push(n);
  }
  const byK = new Map(units.map((u) => [u.key, u])),
    used = new Set(),
    mode = (DAR.find((d) => d[0] === S.dar) || [0, ''])[1];
  el.innerHTML = '';
  el.insertAdjacentHTML(
    'beforeend',
    `<button type="button" class="lyx" onclick="lyDOpen(false)" title="Schließen">✕</button><div class="dmu" style="margin-bottom:4px"><b>Layer · ${mode}</b><br>Gilt nur für diese Darstellung. Symbol anklicken = ein-/ausblenden.</div>${typeof admLyBlock === 'function' ? admLyBlock() : ''}`,
  );
  const mkRow = (u) => {
    let row = u.node;
    if (u.wrap) {
      row = document.createElement('div');
      row.className = 'ly lyr';
      row.appendChild(u.node);
      u.node.style.flex = '1';
    } else row.classList.add('lyr');
    const b = document.createElement('span');
    b.innerHTML = lyDBtn(u.key.replace(/^gen_.*/, 'gen'), u.cb ? u.cb.checked : true, 'cb');
    row.insertBefore(b.firstChild, row.firstChild);
    return row;
  };
  const add = (g, u) => {
    used.add(u.key);
    g.appendChild(mkRow(u));
    u.subs.forEach((x) => g.appendChild(x));
  };
  const o = S.fx[S.dar] || {};

  for (const [title, list] of LYG) {
    const g = document.createElement('div');
    g.className = 'lyg' + (LYD.col[title] ? ' col' : '');
    g.innerHTML = `<h4 data-g="${title}">${title}<span>▾</span></h4>`;
    if (list === 'fx') {
      if (S.dar === 'wm') continue;
      const fr = (k, l, ik) =>
        `<div class="ly lyr">${lyDBtn(ik, !!o[k], 'fx:' + k)}<label>${l}</label></div>`;
      g.insertAdjacentHTML(
        'beforeend',
        fr('trees', 'Bäume · Laubschalen', 'trees') +
          (o.trees
            ? `<div class="ly lyr" style="padding-left:38px"><label>Variante</label><select onchange="fxSet('tv',+this.value)"><option value="8" ${o.tv !== 7 ? 'selected' : ''}>8 · Laubschalen</option><option value="7" ${o.tv === 7 ? 'selected' : ''}>7 · Laubschalen fein</option></select></div>`
            : '') +
          fr('nadel', 'Bäume · Nadelschalen', 'trees') +
          (S.dar === 'real' ? fr('water', 'Wasser · Shader mit Spiegelung', 'water') : ''),
      );
      el.appendChild(g);
      continue;
    }
    const ks =
      list ||
      units
        .filter((u) => !used.has(u.key) && !LYG.some(([, l]) => Array.isArray(l) && l.includes(u.key)))
        .map((u) => u.key);
    let n = 0;
    for (const k of ks) {
      const u = byK.get(k);
      if (u && !used.has(k)) {
        add(g, u);
        n++;
      }
    }
    if (n) el.appendChild(g);
  }
  units.forEach((u) => {
    if (!used.has(u.key)) {
      el.appendChild(mkRow(u));
      u.subs.forEach((x) => el.appendChild(x));
    }
  });
}
// lyRender(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
{
  const lp = $('lyp');
  if (lp)
    lp.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.lyi');
      if (!b) return;
      const row = b.closest('.lyr'),
        a = b.dataset.act || '';
      if (a === 'wmpc') {
        wmPcSet(S.wmPc === false);
        lyRender();
        return;
      }
      if (a.startsWith('fx:')) {
        const k = a.slice(3),
          o = S.fx[S.dar] || {};
        fxSet(k, !o[k]);
        lyRender();
        return;
      }
      const cb = row && row.querySelector('input[type=checkbox]');
      if (cb) {
        cb.click();
        b.classList.toggle('on', cb.checked);
        b.classList.toggle('off', !cb.checked);
      }
    });
  lp.addEventListener('click', (e) => {
    const l = e.target.closest && e.target.closest('.lyr>label');
    if (!l || l.querySelector('input')) return;
    const b = l.parentNode.querySelector('.lyi');
    if (b) b.click();
  });
}
{
  const lp = $('lyp');
  if (lp)
    lp.addEventListener('click', (e) => {
      const h = e.target.closest && e.target.closest('.lyg>h4');
      if (!h) return;
      const g = h.parentNode,
        t = h.dataset.g;
      g.classList.toggle('col');
      LYD.col[t] = g.classList.contains('col');
    });
}
// Grafikeffekt-Optionen stehen im Layer-Panel (früher eigener Block im Panel „Darstellung“)
function fxUi() {
  // ── Erweiterung aus 18-erweiterungen-v280-v325/120-tannen.js
  /* Grafikeffekt „Bäume · Nadelschalen“ im Panel „Darstellung“ (neben Laubschalen) */
  const r = (() => {
    try {
      const e = document.getElementById('fxo');
      if (e) e.remove();
      if ($('lyp').style.display === 'block') lyRender();
    } catch (e) {
      logErr(e, 'fxUi');
    }
  })();
  try {
    const e = document.getElementById('fxo');
    if (!e || S.dar === 'wm' || e.querySelector('[data-nd]')) return r;
    const o = S.fx[S.dar] || {},
      ix = e.innerHTML.indexOf('<div class="dmu">');
    if (ix < 0) return r;
    e.innerHTML =
      e.innerHTML.slice(0, ix) +
      `<label data-nd="1">Bäume: Nadelschalen <input type="checkbox" ${o.nadel ? 'checked' : ''} onchange="fxSet('nadel',this.checked)"></label>` +
      e.innerHTML.slice(ix);
  } catch (e2) {
    console.error(e2);
  }
  return r;
}
{
  const c = document.createElement('style');
  c.textContent = `#lyp .lyg{margin:0 0 6px}#lyp{position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;margin:auto!important;width:350px!important;height:fit-content!important;max-height:calc(100vh - 110px)!important;z-index:90!important;box-shadow:0 18px 60px #0004!important}#lyp .lyx{position:sticky;top:-14px;float:right;z-index:2;width:28px;height:28px;border:1px solid var(--ln);border-radius:9px;background:var(--pn,#fff);cursor:pointer;font-size:14px;line-height:1;margin:-4px -4px 0 0}#lyp .lyg.col>:not(h4){display:none}#lyp .lyg>h4{cursor:pointer;display:flex;justify-content:space-between;margin:12px 0 6px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--mu,#777)}
#lyp .lyr{display:flex;align-items:center;gap:8px;margin-bottom:5px}#lyp .lyr>input[type=checkbox]{display:none}#lyp .lyr>label{flex:1;cursor:pointer}#lyp .lyr>label input[type=checkbox]{display:none}
#lyp .lyi{flex:none;width:30px;height:28px;padding:0;border:1px solid var(--ln);border-radius:9px;background:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--rd)}
#lyp .lyi svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#lyp .lyi.on{background:#5E7F9214;border-color:#5E7F9255}#lyp .lyi.off{color:var(--mu,#999);opacity:.55}#lyp .lyr select{font:inherit;font-size:12px}`;
  document.head.appendChild(c);
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const p = $('lyp');
    if (p && p.style.display === 'block') lyDOpen(false);
  }
});
