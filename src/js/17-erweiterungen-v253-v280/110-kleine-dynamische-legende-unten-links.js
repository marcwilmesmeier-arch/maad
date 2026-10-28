/* v274: kleine dynamische Legende unten links – zeigt nur die gerade eingeblendeten Analyseflächen:
   Einheiten (Färbung nach Flächenart/DIN 277/Nutzung/Geschoss), Abstandsflächen, Umwelt-Flächen (Naturschutz, Natura 2000, Hochwasser, CORINE-Klassen).
   Neue Legendengruppe = Funktion in LGD (liefert null oder {t:Titel, r:[[Farbe,Text],…]}). */
const LGS = { o: true };
try {
  LGS.o = localStorage.getItem('lot_lgd') !== '0';
} catch (e) {
  logErr(e, 'init');
}
const LGD = [
  function () {
    if (typeof G === 'undefined' || !G.un || !G.un.visible || !G.un.children.length) return null;
    const pid = (S.zo && S.zo.m === 'u' && S.zo.pi && S.zo.pi.u) || 'u1',
      m = new Map();
    G.un.traverse((o) => {
      if (!o.isMesh || !o.userData.u || o.userData.u.fa === undefined || !o.material || !o.material.color)
        return;
      const M = o.userData.u,
        d = grFA(M.fa) || grDefFa(M.use);
      const key = pid === 'u2' ? d.d : pid === 'u3' ? d.u : pid === 'u4' ? M.sn : d.k,
        nm =
          pid === 'u2'
            ? d.d + ' ' + String(GRDIN[d.d] || '').replace(/ \(.*/, '')
            : pid === 'u3'
              ? d.u
              : pid === 'u4'
                ? typeof zoLvN === 'function'
                  ? zoLvN(M.sn)
                  : M.sn
                : d.n;
      if (key == null || m.has(key)) return;
      m.set(key, ['#' + o.material.color.getHexString(), String(nm), pid === 'u4' ? zoRank(M.sn) : 0]);
    });
    const r = [...m.values()];
    if (pid === 'u4') r.sort((a, b) => b[2] - a[2]);
    if (!r.length) return null;
    return {
      t:
        'Einheiten · ' +
        ({ u1: 'Flächenart', u2: 'DIN 277', u3: 'Nutzung', u4: 'Geschoss' }[pid] || 'Flächenart'),
      r: r.map((x) => [x[0], x[1]]),
    };
  },
  function () {
    const L = LY.find((l) => l[1] === 'abst');
    if (!L || !L[2] || !S._abst) return null;
    return {
      t: 'Abstandsflächen',
      r: [
        ['#ffe35a', 'Abstandsfläche'],
        ['#e0301e', 'außerhalb Grundstück / überlagert'],
      ],
    };
  },
  function () {
    const r = [];
    for (const k of ['hq', 'nsg', 'ffh', 'vsg']) {
      if (typeof ovVis === 'function' && ovVis(k) && OVI[k] && OVI[k].length) r.push([OVL[k].col, OVL[k].n]);
    }
    return r.length ? { t: 'Umwelt und Schutz', r } : null;
  },
  function () {
    const r = [],
      L = LY.find((l) => l[1] === 'parcels'),
      B = LY.find((l) => l[1] === 'bplan'),
      c = S.lc.parcels || '#5E7F92';
    const hasA = typeof AL !== 'undefined' && AL.length,
      hasS = typeof P !== 'undefined' && P.some((q) => q.site),
      sel = S.parSel && S.parSel.size;
    if (L && L[2] && (hasA || hasS)) {
      r.push([c, 'Flurstücksgrenze', 'ln']);
      if (hasA && AL.length > 1) r.push([c, 'Grenze zwischen Flurstücken', 'dash']);
      if (sel) r.push([c, 'Gewähltes Flurstück', 'bd']);
      if (hasS) r.push([c, 'Grundstück (zusammengelegt)', 'bd']);
    }
    if (B && B[2]) r.push([S.lc.bplan || '#7a6fb0', 'Bebauungsplan']);
    return r.length ? { t: 'Grundstücke und Flurstücke', r } : null;
  },
  function () {
    if (typeof ovVis !== 'function' || !ovVis('clc') || !OVI.clc || !OVI.clc.length) return null;
    const cs = new Map();
    OVI.clc.forEach((o) => {
      if (o.cd && !cs.has(o.cd)) cs.set(o.cd, [o.c, clcLbl(o.cd)]);
    });
    const r = [...cs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]);
    return r.length
      ? {
          t: 'Flächennutzung (CORINE)',
          r: r
            .slice(0, 10)
            .concat(r.length > 10 ? [['transparent', '… +' + (r.length - 10) + ' weitere']] : []),
        }
      : null;
  },
];
function lgdHtml() {
  const gs = [];
  for (const f of LGD) {
    try {
      const g = f();
      if (g) gs.push(g);
    } catch (e) {
      logErr(e, 'lgdHtml');
    }
  }
  if (!gs.length) return '';
  return (
    '<div class="lgh' +
    (LGS.o ? ' o' : '') +
    '" onclick="lgdTog()" title="Legende ein-/ausklappen">Legende<i class="zdc">' +
    gs.length +
    (gs.length === 1 ? ' Ebene' : ' Ebenen') +
    '</i></div>' +
    (LGS.o
      ? '<div class="lgb">' +
        gs
          .map(
            (g) =>
              '<h6>' +
              esc(g.t) +
              '</h6>' +
              g.r
                .map(
                  (x) =>
                    '<div class="lgr"><i' +
                    (x[2]
                      ? ' class="' + x[2] + '" style="--c:' + x[0] + '"'
                      : ' style="background:' + x[0] + '"') +
                    '></i><span>' +
                    esc(x[1]) +
                    '</span></div>',
                )
                .join(''),
          )
          .join('') +
        '</div>'
      : '')
  );
}
let lgdSig = '';
function lgdUpd() {
  let e = document.getElementById('lgd');
  if (!e) {
    const mid = document.getElementById('mid');
    if (!mid) return;
    e = document.createElement('div');
    e.id = 'lgd';
    e.className = 'fl';
    mid.appendChild(e);
  }
  const h = lgdHtml();
  if (h === lgdSig) return;
  lgdSig = h;
  e.innerHTML = h;
  e.style.display = h ? 'block' : 'none';
}
window.lgdTog = function () {
  LGS.o = !LGS.o;
  try {
    localStorage.setItem('lot_lgd', LGS.o ? '1' : '0');
  } catch (e) {
    logErr(e, 'lgdTog');
  }
  lgdSig = '';
  lgdUpd();
};
{
  const c = document.createElement('style');
  c.textContent = `#lgd{position:absolute;left:12px;bottom:16px;z-index:8;width:max-content;min-width:168px;max-width:262px;padding:9px 12px 10px;font-size:12px;line-height:1.3;display:none;color:var(--tx)}
body.hpj #lgd{bottom:36px}
#lgd .lgh{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--tx)}
#lgd .lgh::before{content:'';width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg);transition:transform .15s;flex:none;margin:0 2px 1px 1px}
#lgd .lgh.o::before{transform:rotate(45deg)}
#lgd .lgh .zdc{margin-left:auto;font-style:normal;font-weight:400;font-size:10.5px;letter-spacing:0;text-transform:none;color:var(--mu);white-space:nowrap;padding-left:10px}
#lgd .lgb{border-top:1px solid var(--ln);margin-top:7px;padding-top:2px}
#lgd h6{margin:7px 0 3px;font-size:12px;font-weight:600;color:var(--mu);letter-spacing:0;text-transform:none}
#lgd .lgr{display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px}
#lgd .lgr i{flex:none;width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tx) 22%,transparent)}
#lgd .lgr i.ln,#lgd .lgr i.dash,#lgd .lgr i.bd{height:0;border-radius:0;box-shadow:none;align-self:center}
#lgd .lgr i.ln{border-top:2px solid var(--c)}
#lgd .lgr i.dash{border-top:2px dashed var(--c)}
#lgd .lgr i.bd{border-top:4px solid var(--c)}
#lgd .lgr span{overflow-wrap:anywhere}
body.anOn #lgd{display:none!important}
@media(max-width:800px){#lgd{max-width:178px}}`;
  document.head.appendChild(c);
}
setInterval(() => {
  try {
    lgdUpd();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 500);
