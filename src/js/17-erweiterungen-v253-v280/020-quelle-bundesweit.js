/* v272: Quelle bundesweit ('de': eine Adresse für alle Länder) oder je Bundesland ('land': ENVL[k][Landeskürzel]) */
const ENVSD = { ueg: 'land', hqx: 'land' },
  ENVS = {},
  ENVL = {};
try {
  Object.assign(ENVS, JSON.parse(localStorage.getItem('lot_envs') || '{}'));
  Object.assign(ENVL, JSON.parse(localStorage.getItem('lot_envl') || '{}'));
} catch (e) {
  logErr(e, 'init');
}
const envScope = (k) => ENVS[k] || ENVSD[k] || 'de';
const envLand = () => {
  const r = GEO.rep;
  if (r && r.key && BLN[r.key]) return r.key;
  return Object.keys(BLN).find((k) => BLN[k] === GEO.alkBL) || '';
};
const envLands = () => Object.keys(BLN).sort((a, b) => BLN[a].localeCompare(BLN[b], 'de'));
function envCfgFor(k, land) {
  if (envScope(k) === 'land') {
    const L = land || envLand();
    return (L && ENVL[k] && ENVL[k][L]) || null;
  }
  return ENVC[k];
}
const envCfg = (k) => envCfgFor(k, '');
const envHas = (k, land) => {
  const c = envCfgFor(k, land);
  return !!(c && c.url && c.type);
};
const envSave = () => {
  try {
    const o = {};
    for (const k in ENVC) o[k] = ENVC[k];
    for (const k in ENV0) if (!ENVC[k]) o[k] = { off: 1 };
    localStorage.setItem('lot_env', JSON.stringify(o));
    localStorage.setItem('lot_envs', JSON.stringify(ENVS));
    localStorage.setItem('lot_envl', JSON.stringify(ENVL));
  } catch (e) {
    logErr(e, 'envSave');
  }
};
{
  const c = document.createElement('style');
  c.id = 'axCss';
  c.textContent = `
.ax{font-size:12px}
.ax .axh{display:flex;gap:10px;align-items:flex-start;padding:2px 0 10px}
.ax .axh svg{flex:none;margin-top:2px;color:var(--g7,#5a5e65)}
.ax .axh b{display:block;font-size:16px;font-weight:600;line-height:1.25}
.ax .axh span{display:block;color:var(--mu);font-size:11.5px;line-height:1.35}
.ax .axt{display:flex;gap:2px;margin:2px 0 10px;padding:3px;border-radius:13px;background:#1d1d1b0f}
.ax .axt button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--g7,var(--mu));font:inherit;font-size:12px;font-weight:500;cursor:pointer;min-width:0;transition:background .3s,color .3s,flex .35s cubic-bezier(.2,.8,.2,1)}
.ax .axt button.on{flex:2.2;background:#fff;color:var(--pa5,var(--tx));font-weight:600;box-shadow:0 2px 8px #1d1d1b1a}
.ax .axt button span{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .35s,opacity .25s}
.ax .axt button.on span{max-width:120px;opacity:1}
.ax .axt button svg{flex:none}
.ax .axs{display:grid;grid-template-columns:34px 1fr;gap:0 4px;padding:12px 0;border-top:1px solid var(--ln)}
.ax .axs:first-of-type{border-top:0}
.ax .axs.cp{padding:6px 0;border-top:0}
.ax .axi{color:var(--g7,#5a5e65);padding-top:1px}
.ax .clcl{margin:2px 0 0}.ax .clcr{display:flex;align-items:flex-start;gap:8px;padding:3px 0;line-height:1.3}.ax .clcr i{flex:none;width:12px;height:12px;border-radius:3px;margin-top:2px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tx) 22%,transparent)}.ax .clcr span{flex:1;min-width:0;overflow-wrap:normal;hyphens:auto}.ax .clcr b{flex:none;font-weight:500;white-space:nowrap}
.ax button.axtg{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:0;padding:0;margin:-4px 0 0;font:inherit;cursor:pointer;flex:none;transition:background .15s,box-shadow .15s,color .15s,transform .1s;background:#1d1d1b0a;color:var(--g5,#8c9096);box-shadow:inset 0 0 0 1px var(--ln)}
.ax button.axtg:hover{box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--pa4,#888) 55%,transparent)}
.ax button.axtg:active{transform:scale(.94)}
.ax button.axtg.on{background:linear-gradient(135deg,var(--pa2,#ececec),var(--pa3,#dcdcdc));color:var(--pa5,var(--g7,#5a5e65));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--pa4,#888) 75%,transparent)}
.ax button.axtg.bz{animation:axtgp 1s ease-in-out infinite}
.ax button.axtg.er{box-shadow:inset 0 0 0 1.5px var(--wa,#c0392b)}
@keyframes axtgp{50%{opacity:.45}}
.ax .axn{font-weight:600;font-size:13px;margin:0 0 4px}
.ax .axr{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
.ax .axr span{color:var(--mu);flex:0 1 auto;max-width:58%;overflow-wrap:anywhere;hyphens:manual}
.ax .axr b{font-weight:500;text-align:right;flex:1 1 0;min-width:0;word-break:break-word}
.ax .axr.na b{color:var(--mu);font-weight:400}
.ax .axb{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--tx);margin:0 0 6px}
.ax .axb i{width:8px;height:8px;border-radius:50%;background:#3c9a62}
.ax .axk{font-size:11px;color:var(--mu);margin:2px 0 0}
.ax .axk a,.ax a.axl{color:inherit;text-decoration:underline;cursor:pointer}
.ax button.axp{width:100%;margin-top:10px;padding:9px;border:1px solid var(--ln);border-radius:12px;background:none;font:inherit;font-size:12px;cursor:pointer;color:inherit}
.ax button.axs2{border:1px solid var(--ln);border-radius:8px;background:none;font:inherit;font-size:11px;padding:3px 8px;cursor:pointer;color:inherit}
.ax .axq{border:1px solid var(--ln);border-radius:12px;padding:8px 10px;margin:0 0 8px}
.ax .axq input[type=text]{width:100%;margin:2px 0 6px;box-sizing:border-box}
.ax .axq label{display:block;font-size:11px;color:var(--mu)}
.ax .zds{font-style:normal;color:#b9bcc0;margin:0 3px}
.ax .axq select,.ax .axq input[type=text]{width:100%;max-width:100%;box-sizing:border-box;margin:2px 0 6px}
.ax .axq .axe{color:var(--wa);font-size:11px;margin-top:4px}
`;
  document.head.appendChild(c);
}
const axI = (p, n) =>
  '<svg viewBox="0 0 24 24" width="' +
  (n || 22) +
  '" height="' +
  (n || 22) +
  '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  p +
  '</svg>';
const AXI = {
  flae: '<path d="M4 6l7-2 9 3-2 11-8 3-6-4z"/><path d="M4 6l8 4 8-3M12 10v10"/>',
  pin: '<path d="M12 21s-6-5.500-6-10.500a6 6 0 0112 0C18 15.500 12 21 12 21z"/><circle cx="12" cy="10.500" r="2.200"/>',
  plan: '<rect x="5" y="3" width="14" height="18" rx="1.500"/><path d="M9 8l2 2 4-4M9 14h6M9 17.500h4"/>',
  hoe: '<path d="M3 18l6-9 4 5 3-4 5 8z"/><path d="M3 18h18"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z"/><path d="M5 19c3-4 6-6 9-8"/>',
  drop: '<path d="M12 3s6 6.500 6 11a6 6 0 01-12 0c0-4.500 6-11 6-11z"/>',
  wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 14c3-3 6 3 9 0s6 3 9 0M3 19c3-3 6 3 9 0s6 3 9 0"/>',
  tree: '<circle cx="12" cy="9" r="5.500"/><path d="M12 14.500V21M9 21h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>',
  noise: '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 010 6M18.500 6.500a8 8 0 010 11"/>',
  geb: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M4 7.500l8 4.500 8-4.500M12 12v9"/>',
};
const axD = (v) => String(v).replace('.', ',');
const axFmt = (v) => v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
function axSites() {
  let sel = [...S.parSel].map((i) => AL[i]).filter(Boolean);
  if (!sel.length && S.par) sel = [S.par];
  let items = sel.map((a) => ({
    id: a.id,
    poly: a.poly,
    fl: a.fl && a.fl.length ? a.fl : null,
    site: a.site ? 1 : 0,
  }));
  if (!items.length)
    items = P.filter((p) => p.site).map((p) => ({
      id: p.name || p.id,
      poly: p.poly,
      fl: p.fl && p.fl.length ? p.fl : null,
      site: 1,
    }));
  const ort = (S.project && S.project.label) || '';
  if (items.length) {
    const ar = items.reduce((s, o) => s + area(o.poly), 0),
      ids = items.flatMap((o) => o.fl || [o.id]);
    return {
      label: items.some((o) => o.site)
        ? 'Grundstück'
        : items.length > 1
          ? items.length + ' Flurstücke'
          : 'Flurstück ' + ids[0],
      sub: [axFmt(ar) + ' m²', ort].filter(Boolean),
      fl: (() => {
        const q = ids.filter(Boolean);
        return (
          (q.length > 1 ? 'Flurstücke ' : 'Flurstück ') +
          (q.length > 4 ? q.slice(0, 3).join(', ') + ' + ' + (q.length - 3) + ' weitere' : q.join(', '))
        );
      })(),
      polys: items.map((o) => o.poly),
      area: ar,
      project: false,
    };
  }
  if (S.geo) {
    const h = GEO.size / 2;
    return {
      label: 'Projektgebiet',
      sub: [axFmt(GEO.size * GEO.size) + ' m²', ort].filter(Boolean),
      fl: 'Projektgebiet (kein Flurstück gewählt)',
      polys: [
        [
          [-h, -h],
          [h, -h],
          [h, h],
          [-h, h],
        ],
      ],
      area: GEO.size * GEO.size,
      project: true,
    };
  }
  return null;
}
const axKey = (s) =>
  s
    ? s.label +
      '|' +
      Math.round(s.area) +
      '|' +
      Math.round(s.polys[0][0][0]) +
      ',' +
      Math.round(s.polys[0][0][1])
    : '';
function axTerrain(polys) {
  let x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9;
  polys.forEach((p) =>
    p.forEach((q) => {
      x0 = Math.min(x0, q[0]);
      x1 = Math.max(x1, q[0]);
      z0 = Math.min(z0, q[1]);
      z1 = Math.max(z1, q[1]);
    }),
  );
  const st = Math.max(1, Math.sqrt(((x1 - x0) * (z1 - z0)) / 1600)),
    hs = [],
    sl = [];
  for (let x = x0 + st / 2; x < x1; x += st)
    for (let z = z0 + st / 2; z < z1; z += st) {
      if (!polys.some((p) => inP([x, z], p))) continue;
      hs.push(gh(x, z));
      const gx = (gh(x + st, z) - gh(x - st, z)) / (2 * st),
        gz = (gh(x, z + st) - gh(x, z - st)) / (2 * st);
      sl.push(Math.hypot(gx, gz) * 100);
    }
  if (!hs.length) return null;
  sl.sort((a, b) => a - b);
  const pc = (q) => sl[Math.min(sl.length - 1, Math.floor(q * (sl.length - 1)))],
    off = S.geo && GEO.e0 != null ? GEO.e0 : 0;
  return {
    min: Math.min(...hs) + off,
    max: Math.max(...hs) + off,
    s0: pc(0.05),
    s1: pc(0.95),
    abs: S.geo && GEO.e0 != null,
  };
}
function axProp(pr, re) {
  for (const k in pr) {
    if (re.test(k)) {
      const v = pr[k];
      if (v !== null && v !== '' && typeof v !== 'object') return String(v);
    }
  }
  return '';
}
const axR = (n, v, na) => `<div class="axr${na ? ' na' : ''}"><span>${n}</span><b>${v}</b></div>`;
/* v275: Symbol als Schalter für die Karten-Ebene (Rahmen wie bei den Datenebenen). tg = Layer-Schlüssel. Hinweis im Mouseover. */
const axTgOn = (k) => {
  const L = LY.find((l) => l[1] === k);
  return !!(L && L[2]);
};
function axTgBtn(ic, k, nm) {
  const on = axTgOn(k),
    d = typeof OVD !== 'undefined' && OVD[k],
    st = on && d ? d.st : '',
    tip =
      (nm ? nm + ': ' : '') +
      (on ? 'Auf der Karte ausblenden' : 'Auf der Karte zeigen') +
      (st === 'busy' ? ' (lädt …)' : st === 'err' ? ' – Fehler: ' + (d.msg || '') : '');
  return (
    '<button class="axtg' +
    (on ? ' on' : '') +
    (st === 'busy' ? ' bz' : '') +
    (st === 'err' ? ' er' : '') +
    '" aria-pressed="' +
    on +
    '" title="' +
    esc(tip) +
    '" aria-label="' +
    esc(tip) +
    '" onclick="ovTog(\'' +
    k +
    '\')">' +
    axI(AXI[ic], 18) +
    '</button>'
  );
}
const axS = (ic, t, body, sm, tg, tn) =>
  `<div class="axs${sm ? ' cp' : ''}"><div class="axi">${tg ? axTgBtn(ic, tg, tn) : axI(AXI[ic])}</div><div>${t ? '<div class="axn">' + t + '</div>' : ''}${body}</div></div>`;
