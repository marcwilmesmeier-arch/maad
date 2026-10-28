// ---- Kantenbeschriftung mit Böschungs-Einstellung direkt an der Fläche
const plmLb = (() => {
  const d = document.createElement('div');
  d.id = 'plmLb';
  d.style.cssText =
    'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;overflow:hidden;z-index:7';
  mid.appendChild(d);
  return d;
})();
const plmPop = (() => {
  const d = document.createElement('div');
  d.id = 'plmPop';
  d.className = 'fl';
  d.style.cssText =
    'position:fixed;display:none;z-index:40;padding:8px 10px;width:230px;font-size:12px;pointer-events:auto';
  ['pointerdown', 'mousedown', 'click', 'wheel', 'dblclick'].forEach((ev) =>
    d.addEventListener(ev, (e) => e.stopPropagation()),
  );
  document.body.appendChild(d);
  return d;
})();
const plmPills = [];
function plmFmt(n) {
  return (
    '1:' +
    (Math.round(n * 100) / 100).toLocaleString('de-DE') +
    ' · ' +
    (Math.atan(1 / n) * 57.29578).toLocaleString('de-DE', { maximumFractionDigits: 1 }) +
    '° · ' +
    (100 / n).toLocaleString('de-DE', { maximumFractionDigits: 0 }) +
    ' %'
  );
}
function plmPopUi() {
  const a = plmCur(),
    i = PLM.pe;
  if (!a || i < 0 || i >= a.poly.length) {
    plmPop.style.display = 'none';
    return;
  }
  const w = a.w[i];
  plmPop.innerHTML = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><b style="flex:1">Seite · ${f1(Math.hypot(a.poly[(i + 1) % a.poly.length][0] - a.poly[i][0], a.poly[(i + 1) % a.poly.length][1] - a.poly[i][1]), 1)} m</b><button class="sm" onclick="plmPopClose()">✕</button></div>
 <div style="display:flex;gap:4px;margin-bottom:6px"><button class="sm" style="flex:1;${w ? '' : 'background:#5E7F9233;border-color:#5E7F92'}" onclick="plmWall(${i},false)">Böschung</button><button class="sm" style="flex:1;${w ? 'background:#5E7F9233;border-color:#5E7F92' : ''}" onclick="plmWall(${i},true)">Stützmauer</button></div>
 ${
   w
     ? '<div style="opacity:.75">Senkrechte Wand bis zum Bestandsgelände.</div>'
     : `<div style="display:flex;gap:6px;align-items:center">Neigung 1:<input type="number" id="plmPn" step="0.25" min="0.3" max="20" value="${Math.round(a.n[i] * 100) / 100}" style="width:58px" onchange="plmN(${i},+this.value,1)"></div>
 <input type="range" id="plmPr" min="0.5" max="6" step="0.05" value="${Math.min(6, a.n[i])}" style="width:100%" oninput="plmN(${i},+this.value,0)"><div id="plmPf" style="text-align:right;opacity:.8">${plmFmt(a.n[i])}</div>`
 }
 <button class="sm" style="margin-top:6px;width:100%" onclick="plmToAll(${i})">Auf alle Seiten übertragen</button>`;
}
function plmPopClose() {
  PLM.pe = -1;
  plmPop.style.display = 'none';
}
function plmPillClick(i) {
  PLM.pe = i;
  plmPopUi();
  plmPop.style.display = 'block';
}
function plmN(i, v, ui) {
  const a = plmCur();
  if (!a || !(v > 0)) return;
  a.n[i] = plmCl(v, 0.3, 20);
  if (ui) plmPopUi();
  else {
    const f = document.getElementById('plmPf');
    if (f) f.textContent = plmFmt(a.n[i]);
    const n = document.getElementById('plmPn');
    if (n) n.value = Math.round(a.n[i] * 100) / 100;
  }
}
function plmWall(i, v) {
  const a = plmCur();
  if (!a) return;
  a.w[i] = v;
  plmPopUi();
}
function plmToAll(i) {
  const a = plmCur();
  if (!a) return;
  const n = a.n[i],
    w = a.w[i];
  a.n = a.n.map(() => n);
  a.w = a.w.map(() => w);
  plmPopUi();
}
function plmLabels() {
  try {
    const a = plmCur(),
      show = a && a.on !== false && GEO.size && (PLM.open || PLM.pe >= 0);
    if (!show) {
      plmPills.forEach((d) => (d.style.display = 'none'));
      if (PLM.pe >= 0 && !a) plmPopClose();
      return;
    }
    const cm = act(),
      W = mid.clientWidth,
      H = mid.clientHeight,
      L = a.poly.length;
    cm.updateMatrixWorld();
    while (plmPills.length < L) {
      const d = document.createElement('div'),
        k = plmPills.length;
      d.style.cssText =
        'position:absolute;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;background:#E9EDEF;color:#111;border:1.5px solid #5E7F92;border-radius:11px;padding:1px 7px;font:600 11px sans-serif;white-space:nowrap;box-shadow:0 1px 4px #0004;user-select:none';
      ['pointerdown', 'mousedown', 'dblclick', 'wheel'].forEach((ev) =>
        d.addEventListener(ev, (e) => e.stopPropagation()),
      );
      d.addEventListener('click', (e) => {
        e.stopPropagation();
        plmPillClick(+d.dataset.i);
      });
      plmLb.appendChild(d);
      plmPills.push(d);
    }
    for (let k = 0; k < plmPills.length; k++) {
      const d = plmPills[k];
      if (k >= L) {
        d.style.display = 'none';
        continue;
      }
      const P0 = a.poly[k],
        P1 = a.poly[(k + 1) % L],
        N = a.nr[k],
        mx = (P0[0] + P1[0]) / 2,
        mz = (P0[1] + P1[1]) / 2,
        v = new T.Vector3(mx, gh(mx, mz) + 0.4, mz).project(cm);
      if (v.z > 1 || v.z < -1) {
        d.style.display = 'none';
        continue;
      }
      d.dataset.i = k;
      d.style.display = 'block';
      const t = a.w[k] ? 'Mauer' : '1:' + (Math.round(a.n[k] * 100) / 100).toLocaleString('de-DE');
      if (d.textContent !== t) d.textContent = t;
      d.style.left = ((v.x + 1) / 2) * W + 'px';
      d.style.top = ((1 - v.y) / 2) * H + 'px';
      d.style.background = PLM.pe === k ? '#5E7F92' : '#fff';
      d.style.color = PLM.pe === k ? '#fff' : '#111';
    }
    if (PLM.pe >= 0 && PLM.pe < L && plmPop.style.display === 'block') {
      const d = plmPills[PLM.pe],
        r = d.getBoundingClientRect();
      plmPop.style.left = Math.min(innerWidth - 246, Math.max(6, r.left + r.width / 2 - 115)) + 'px';
      plmPop.style.top = Math.min(innerHeight - plmPop.offsetHeight - 8, r.bottom + 8) + 'px';
    }
  } catch (e) {
    logErr(e, 'plmLabels');
  }
}
(function lp() {
  plmLabels();
  requestAnimationFrame(lp);
})();
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && PLM.pe >= 0) plmPopClose();
});
// Toolbar-Eintrag
try {
  const tb = document.getElementById('tbar');
  if (tb) {
    const d = document.createElement('div');
    d.className = 'tcl';
    d.innerHTML =
      '<small>Gelände</small><div class="tcr"><div class="tg"><button class="tb tmain" onclick="plmOpen()" title="Geländeplanum: Fläche planieren, Böschungen"><i>⛰</i>Planum</button></div></div>';
    tb.appendChild(d);
  }
} catch (e) {
  logErr(e, 'init');
}
// Projekt speichern/laden
function plmSave() {
  return {
    a: PLM.a.map((a) => ({
      id: a.id,
      name: a.name,
      poly: a.poly,
      z: a.z,
      n: a.n,
      w: a.w,
      on: a.on !== false,
    })),
    hs: PLM.hs,
    hatch: PLM.hatch,
    cf: PLM.cf,
    cw: PLM.cw,
    k0: PLM.k0,
  };
}
function plmLoad(x) {
  PLM.a = [];
  PLM.sel = null;
  if (x && x.a) {
    PLM.hs = x.hs || 1;
    PLM.hatch = x.hatch !== false;
    PLM.cf = x.cf || PLM.cf;
    PLM.cw = x.cw || PLM.cw;
    PLM.k0 = x.k0 || x.a.length;
    PLM.a = x.a.map((a) => ({
      id: a.id,
      name: a.name,
      poly: a.poly.map((q) => q.slice()),
      z: a.z,
      n: a.n,
      w: a.w,
      on: a.on !== false,
    }));
    PLM.a.forEach(plmPrep);
    PLM.sel = PLM.a.length ? PLM.a[0].id : null;
  }
  plmSync();
  PLM.sg = '';
  PLM.gk = '';
  PLM.ag = '';
  if (PLM.open) plmUi();
}
{
  const _np = newProjectReset;
  newProjectReset = function () {
    const r = _np.apply(this, arguments);
    try {
      plmLoad(null);
      plmTick(1);
    } catch (e) {
      logErr(e, 'newProjectReset');
    }
    return r;
  };
}
