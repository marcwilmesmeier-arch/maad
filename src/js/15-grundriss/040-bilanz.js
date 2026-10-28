// ---- Bilanz
function grBil(b) {
  const L = grData(b),
    R = { fa: {}, lv: [], din: {}, use: {}, tot: 0, anr: 0 };
  L.forEach((lv) => {
    let a = 0;
    lv.faces.forEach((f) => {
      const fa = grFA(f.fa) || grDefFa(lv.use),
        r = R.fa[fa.k] || (R.fa[fa.k] = { n: 0, a: 0, r: 0 });
      r.n++;
      r.a += f.a;
      r.r += (f.a * fa.f) / 100;
      const d = R.din[fa.d] || (R.din[fa.d] = { a: 0, r: 0 });
      d.a += f.a;
      d.r += (f.a * fa.f) / 100;
      const u = R.use[fa.u] || (R.use[fa.u] = { a: 0, r: 0 });
      u.a += f.a;
      u.r += (f.a * fa.f) / 100;
      a += f.a;
      R.tot += f.a;
      R.anr += (f.a * fa.f) / 100;
    });
    R.lv.push({ name: lv.name, a, n: lv.faces.length, dg: !!lv.dg });
  });
  return R;
}
function grCsv(b) {
  const L = grData(b),
    rows = [
      [
        'Gebäude',
        'Geschoss',
        'Nr.',
        'Name',
        'Flächenart',
        'Nutzung',
        'DIN 277',
        'Fläche m²',
        'Anrechnung %',
        'Anrechenbar m²',
      ],
    ],
    n = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
  for (const lv of L.slice().reverse())
    lv.faces.forEach((f) => {
      const fa = grFA(f.fa) || grDefFa(lv.use);
      rows.push([
        b.name || b.id,
        lv.name,
        lv.sn + '.' + f.idx,
        f.n || fa.n,
        fa.n,
        fa.u,
        fa.d,
        n(f.a),
        n(fa.f),
        n((f.a * fa.f) / 100),
      ]);
    });
  return (
    '﻿' +
    rows
      .map((r) => r.map((c) => (/[;"\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(';'))
      .join('\r\n')
  );
}
async function grDl(fn, blob) {
  let d = null;
  try {
    d = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  } catch (e) {
    logErr(e, 'grDl');
  }
  if (d) await d.save({ filename: fn, data: blob });
  else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  }
}

// ======================================================================
// ---- Analysebereich (Gebäude / Flächen / Einheiten) als feste Leiste links + Explosionsansicht
//      VCX erzeugt die Knöpfe der Ansichtsleiste unten (aktuell: Explosion)
// ======================================================================
const VCX = [
  {
    k: 'exp',
    id: 'bex',
    n: '',
    t: 'Explosionsansicht: Geschosse auseinanderziehen',
    f: 'tgExp()',
    p: '<path d="M12 3.5l8.5 4.2-8.5 4.2-8.5-4.2z"/><path d="M3.5 12.2l8.5 4.2 8.5-4.2"/><path d="M3.5 16.7l8.5 4.2 8.5-4.2"/>',
  },
];
S.zo = { m: 'b', bc: '#9db4cc', o: {} };
S.expl = { on: 0, gap: 5, cur: 0 };
document
  .getElementById('cmp')
  .insertAdjacentHTML(
    'beforebegin',
    VCX.map(
      (a) =>
        `<button class="bt" id="${a.id}" data-vcx="${a.k}" onclick="${a.f}" title="${a.t}">${a.p ? SVGI(a.p, 18) : a.n}</button>`,
    ).join(''),
  );
document
  .getElementById('lyp')
  .insertAdjacentHTML(
    'afterend',
    '<div id="zol" class="fl"></div><div id="fap" class="fl"></div><div id="exp" class="fl"></div>',
  );
const zoCss = document.createElement('style');
zoCss.textContent = `#zol{position:absolute;left:10px;top:78px;width:272px;max-height:calc(100% - 270px);overflow:auto;padding:12px 14px 14px;z-index:19;font-size:12px;line-height:1.3;font-variant-numeric:tabular-nums}
#zol{--zl:#e4e6e8;--zm:#7d8287;--zh:#e9f1f9}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) #zol{--zl:#ffffff1f;--zm:#a5a299;--zh:#ffffff12}}
#zol>b:first-child{display:block;font-size:14px;font-weight:600;letter-spacing:0}
#zol .seg{display:flex;gap:2px;margin:10px 0 8px;padding:3px;border-radius:8px;background:color-mix(in srgb,var(--zm) 16%,transparent)}#zol .seg button{flex:1;border:1px solid transparent;background:transparent;border-radius:6px;padding:6px 4px;font:inherit;font-size:12px;cursor:pointer;color:var(--zm)}#zol .seg button.on{background:var(--pn,#fff);border-color:#5E7F92;color:var(--tx);font-weight:600;box-shadow:0 1px 3px #0002}
#zol h5,#zol .bd{margin:12px 0 4px;padding-top:11px;border-top:1px solid var(--zl);font-size:13px;font-weight:600;color:var(--tx);text-transform:none;letter-spacing:0}
#zol .r{display:flex;align-items:center;gap:8px;padding:5px 4px;min-height:18px}#zol .r i{width:12px;height:12px;border-radius:3px;border:1px solid #0003;flex:none}#zol .r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#zol .r b{font-weight:400;white-space:nowrap}
#zol .r.t{background:var(--zh);border-radius:4px;padding:6px 4px;font-weight:500}#zol .r.t b{font-weight:500}#zol .r.s{padding-left:22px;color:var(--zm);font-size:11.5px}
#zol .mu{color:var(--zm);font-size:11px;line-height:1.35}#zol .bd .gr{font-weight:400;margin-left:4px}#zol abbr{text-decoration:none;cursor:help}#zol .r.ind{padding-left:26px}#zol details details>summary{padding-left:26px;color:var(--zm);font-size:11.5px}#zol .bd{color:var(--tx);letter-spacing:0;text-transform:none}#zol .big{font-size:15px;font-weight:600;letter-spacing:0;padding:3px 4px}
#zol details{margin:0}#zol summary{display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;padding:5px 4px;font-size:12px;font-weight:400;color:var(--tx);border-radius:4px}#zol summary:hover{background:color-mix(in srgb,var(--zm) 10%,transparent)}#zol details[open]>summary{background:var(--zh)}#zol summary::before{content:'';flex:none;width:6px;height:6px;margin:0 6px 0 2px;border-right:1.4px solid var(--zm);border-bottom:1.4px solid var(--zm);transform:rotate(-45deg);transition:transform .15s;font-size:0}#zol details[open]>summary::before{transform:rotate(45deg)}#zol summary span{flex:1}#zol summary b{font-weight:400;font-size:12px}
#zol button.ac{margin-top:10px;width:100%;border:1px solid var(--zl);background:transparent;border-radius:6px;padding:7px;font:inherit;font-size:12px;cursor:pointer;color:inherit}
#zol .cl{display:flex;align-items:center;gap:8px;margin:2px 0 2px}#zol .cl input{width:30px;height:20px;padding:0;border:0;background:none}#zol .cl b{font-weight:400;font-size:12px}
#exp{position:absolute;left:50%;transform:translateX(-50%);bottom:58px;padding:6px 12px;display:none;align-items:center;gap:8px;font-size:12px;z-index:5}body.hpj #exp{bottom:76px}#exp input{width:150px}
@media(max-width:800px){#zol{width:230px;max-height:36vh}}
body.anOn #zol,body.anOn #fap{display:none!important}
body.anOn #anbar{left:10px;top:50%;transform:translateY(-50%);width:206px;max-width:none;max-height:calc(100% - 200px);overflow:auto;padding:10px 12px}
body.anOn #anbar .anr{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:5px;margin:0 0 8px}
body.anOn #anbar .anr:last-child{margin-bottom:0}
body.anOn #anbar .anr>b{font-size:13px;padding:0 2px 2px;word-break:break-word}
body.anOn #anbar .anr .sm,body.anOn #anbar .anr select{width:100%;text-align:left}
body.anOn #anbar .anr .anv{flex:0 0 1px;width:100%;height:1px}
body.anOn #anbar .anr label{display:flex;justify-content:space-between;align-items:center;width:100%}
body.anOn #anbar .anr label select,body.anOn #anbar .anr label input[type=number]{width:96px}
body.anOn #anbar .anr:has(.ans){flex-direction:row;flex-wrap:wrap}
body.anOn #anbar .anr:has(.ans) label{flex:1 1 100%}
body.anOn #anbar .anr textarea{min-width:0;width:100%;box-sizing:border-box}
@media (max-width:760px){body.anOn #anbar{width:170px}}
`;
zoCss.textContent += `
#zol .pie{display:flex;align-items:center;gap:12px}#zol .pie svg{flex:none}#zol .pl{flex:1;min-width:0;font-size:11.5px}#zol .pl>div{display:flex;align-items:center;gap:6px;padding:1.5px 0}#zol .pl i{width:9px;height:9px;border-radius:2px;flex:none}#zol .pl span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#zol .pl b{font-weight:500;color:var(--zm)}

#zol .r.k{cursor:pointer;border-radius:4px}#zol .r.k:hover{background:color-mix(in srgb,var(--zm) 10%,transparent)}#zol .r.k.on{background:var(--zh);box-shadow:inset 0 0 0 1px var(--zm)}
#zol .iso{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;padding:5px 8px;border-radius:6px;background:var(--zh);font-size:11.5px}#zol .iso span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#zol .iso button{border:0;background:transparent;font-size:15px;line-height:1;cursor:pointer;color:var(--zm);padding:0 4px}

#zol .zg{position:absolute;right:11px;top:10px;width:26px;height:26px;border:0;background:transparent;border-radius:6px;color:var(--zm);cursor:pointer;display:grid;place-items:center;padding:0}#zol .zg:hover,#zol .zg.on{background:color-mix(in srgb,var(--zm) 16%,transparent);color:var(--tx)}
#fap{position:absolute;left:296px;top:78px;width:400px;max-width:calc(100% - 310px);max-height:calc(100% - 175px);overflow:auto;padding:12px 14px 14px;z-index:20;font-size:12.5px;line-height:1.4;display:none;--mu:#7a7a7a;--bg:#f2f2f2}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) #fap{--mu:#aaa;--bg:#ffffff14}}
#fap .fah{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}#fap .fah b{font-size:14px;font-weight:600}
#fap button{border:1px solid var(--ln);background:transparent;border-radius:6px;padding:4px 9px;cursor:pointer;font:inherit;color:var(--tx)}#fap button:hover{background:var(--bg)}#fap .fah button{border:0;padding:2px 8px;font-size:16px;line-height:1}
#fap select,#fap input[type=text],#fap input[type=number]{border:1px solid var(--ln);border-radius:5px;padding:3px 6px;background:var(--pn);min-width:0;font:inherit;color:var(--tx)}
#fap h4{margin:10px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mu)}#fap h4:first-of-type{margin-top:0}
#fap .row{display:flex;align-items:center;gap:6px;margin:3px 0}#fap .row>label{flex:1}#fap .row input[type=color]{width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer}
#fap .fa{display:grid;grid-template-columns:28px minmax(80px,1fr) 88px 58px 46px 24px;gap:4px;align-items:center;margin:3px 0}#fap .fa input[type=color]{width:26px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none}
#fap .fa select,#fap .fa input[type=text],#fap .fa input[type=number]{width:100%;padding:2px 3px}#fap .fa button{padding:0 4px}
#fap .mu{color:var(--mu);font-size:11px}#fap .full{width:100%;margin-top:6px}
@media(max-width:800px){#fap{left:10px;top:auto;bottom:70px;max-width:calc(100% - 20px)}}`;
document.head.appendChild(zoCss);
// ---- Daten (gleiche Rechenfunktionen wie der Analyse-Reiter rechts: bM, bLv, grOf)
const zoScope = () => {
  const s = S.sel;
  return s && !s.ex && S.bld.includes(s) ? [s] : S.bld.filter((b) => !b.ex);
};
const zoRank = (n) =>
  n === 'DG' ? 100 : n === 'EG' ? 0 : /^UG/.test(n) ? -parseInt(n.slice(2) || 1) : parseInt(n) || 0;
const zoUses = (b) => {
  const s = new Set(b.levels.map((l) => lUse(b, l)));
  if (bLv(b).length > b.levels.length) s.add(roofUse(b));
  return USES.filter((u) => s.has(u));
};
let zoPies = {};
const zoD = (id, t, tot, body, pie) => {
  if (pie) zoPies[id] = { t, r: pie };
  return `<details ${S.zo.o[id] ? 'open' : ''} ontoggle="zoOpen('${id}',this.open)"><summary data-pie="${pie ? id : ''}" ${pie ? `onclick="zoPie('${id}')" title="Aufklappen und Anteile im Kreisdiagramm unten zeigen"` : ''}><span>${t}</span><b>${tot}</b></summary>${body}</details>`;
};
function zoOpen(id, v) {
  S.zo.o[id] = v ? 1 : 0;
}
const zoLvN = (n) => (n === 'DG' ? 'Dachgeschoss' : n);
function zoUnVis() {
  const L = LY.find((l) => l[1] === 'un');
  return (!L || !!L[2]) && S.zo.m === 'u';
}

// ---- Flächenarten: eigenständiges Modul (Inhalt = grFaHtml, unverändert), geöffnet über das Optionen-Symbol im Analysebereich
const FAP = { open: false, h: '' };
function faRender(force) {
  const e = $('fap');
  if (!e) return;
  e.style.display = FAP.open ? 'block' : 'none';
  if (!FAP.open) return;
  const ae = document.activeElement;
  if (!force && e.contains(ae) && /INPUT|SELECT/.test(ae.tagName)) return;
  const h = grFaHtml();
  if (!force && h === FAP.h) return;
  FAP.h = h;
  const st = e.scrollTop;
  e.innerHTML =
    '<div class="fah"><b>Flächenarten</b><button title="Schließen" onclick="faToggle(false)">×</button></div>' +
    h;
  e.scrollTop = st;
}
function faToggle(v) {
  FAP.open = v == null ? !FAP.open : !!v;
  FAP.h = '';
  faRender(true);
  const g = document.querySelector('#zol .zg');
  if (g) g.classList.toggle('on', FAP.open);
}
