/* v290: Grünflächen aus CORINE (Wald, Wiese/Weide, Feld, Dauerkulturen, Gebüsch/Heide, Stadtgrün) als eigene Flächen-Ebene
   mit je Klasse einstellbarer Farbe. Reihenfolge im Gelände: Grünflächen → CORINE-Grün → Gewässer → Wege → Straßen. */
const CLGC = [
  ['wald', 'Wald', '#4f7a3f', ['311', '312', '313']],
  ['wiese', 'Wiese &amp; Weide', '#a9c46a', ['231', '321']],
  ['acker', 'Feld (Acker)', '#dccf8a', ['211', '212', '213', '241', '242', '243']],
  ['dauer', 'Dauerkulturen', '#9aa86a', ['221', '222', '223']],
  ['gebuesch', 'Gebüsch, Heide', '#7e9a4e', ['322', '323', '324', '244']],
  ['stadt', 'Stadtgrün &amp; Sport', '#8fbf78', ['141', '142']],
  ['garten', 'Gärten (nicht durchgängig städtisch)', '#b7d19a', ['112']],
];
S.clgc = S.clgc || {};
const CLGM = {};
CLGC.forEach(([id, , , cs]) => cs.forEach((c) => (CLGM[c] = id)));
const clgCol = (id) => S.clgc[id] || (CLGC.find((c) => c[0] === id) || [])[2] || '#88aa66';
PK.clg = 1;
{
  const c = document.createElement('canvas');
  c.width = c.height = PW;
  PL.clg = c;
}
try {
  IC.clg = IC.clc || IC.green;
} catch (e) {
  logErr(e, 'init');
}
LY.push(['Grünflächen CORINE (Wald, Feld, Wiese, Gärten)', 'clg', 0, 0.9]);
const clgOn = () => {
  const L = LY.find((l) => l[1] === 'clg');
  return !!(L && L[2]);
};
let clgSig = '';
function clgPaint() {
  const c = PL.clg;
  if (!c) return 0;
  const x = c.getContext('2d');
  x.clearRect(0, 0, PW, PW);
  const it = typeof OVI !== 'undefined' ? OVI.clc : null;
  if (!it || !GEO.size) return 0;
  const K = PW / GEO.size,
    X = (v) => (v + GEO.size / 2) * K;
  let n = 0;
  x.globalAlpha = 1;
  for (const o of it) {
    const id = CLGM[o.cd];
    if (!id || o.t !== 'a') continue;
    x.fillStyle = clgCol(id);
    x.beginPath();
    for (const r of o.r) {
      r.forEach(([a, b], i) => (i ? x.lineTo(X(a), X(b)) : x.moveTo(X(a), X(b))));
      x.closePath();
    }
    x.fill('evenodd');
    n++;
  }
  return n;
}
{
  const _rc = recomp;
  recomp = function () {
    try {
      if (clgOn()) {
        const n = clgPaint();
        const sg = n + ':' + (typeof OVI !== 'undefined' && OVI.clc ? OVI.clc.length : 0);
        if (sg !== clgSig) {
          clgSig = sg;
          if (typeof FX !== 'undefined' && FX.grass && FX.flat)
            setTimeout(() => {
              try {
                fxGrass();
              } catch (e) {
                logErr(e, 'recomp>anonym');
              }
            }, 0);
        }
      } else if (clgSig) {
        clgSig = '';
        PL.clg.getContext('2d').clearRect(0, 0, PW, PW);
      }
    } catch (e) {
      console.error(e);
    }
    return _rc.apply(this, arguments);
  };
}
/* Rasen-Maske (fxFlat): CORINE-Flächen aussparen, wenn die Ebene sichtbar ist */
window.clgMask = function (x, W) {
  try {
    if (!clgOn()) return;
    if (!clgPaint()) return;
    x.drawImage(PL.clg, 0, 0, W, W);
  } catch (e) {
    console.error(e);
  }
};
{
  const _lv = lvis;
  lvis = function (i, v) {
    const r = _lv.apply(this, arguments);
    try {
      if (LY[i][1] === 'clg') {
        if (v) {
          if (OVD.clc && OVD.clc.st === 'err') delete OVD.clc;
          ovLoad('clc');
        }
        clgSig = '';
        if (S.geo) recomp();
        if (typeof FX !== 'undefined' && FX.grass && FX.flat) fxGrass();
        try {
          lyRender();
        } catch (e) {
          logErr(e, 'lvis');
        }
      }
    } catch (e) {
      console.error(e);
    }
    return r;
  };
}
{
  const _lo = lop;
  lop = function (i, v) {
    if (LY[i][1] === 'clg') {
      LY[i][3] = v;
      if (S.geo) recomp();
      return;
    }
    return _lo.apply(this, arguments);
  };
}
{
  const _os = ovSync;
  ovSync = function () {
    const r = _os.apply(this, arguments);
    try {
      if (S.geo && clgOn() && !OVD.clc) ovLoad('clc');
    } catch (e) {
      logErr(e, 'ovSync');
    }
    return r;
  };
}
let clgT = 0;
window.clgSet = function (id, v) {
  S.clgc[id] = v;
  clearTimeout(clgT);
  clgT = setTimeout(() => {
    try {
      if (S.geo) recomp();
    } catch (e) {
      logErr(e, 'clgSet>anonym');
    }
  }, 80);
};
window.clgReset = function () {
  S.clgc = {};
  clgSig = '';
  try {
    if (S.geo) recomp();
  } catch (e) {
    logErr(e, 'clgReset');
  }
  try {
    lyRender();
  } catch (e) {
    logErr(e, 'clgReset');
  }
};
window.clgLoad = function (o) {
  if (o && typeof o === 'object') Object.assign(S.clgc, o);
};
function clgStat() {
  const d = typeof OVD !== 'undefined' ? OVD.clc : null;
  if (!d) return 'Daten werden beim Einschalten geladen';
  if (d.st === 'busy') return 'wird geladen …';
  if (d.st === 'err') return d.msg || 'Fehler';
  const it = (typeof OVI !== 'undefined' && OVI.clc) || [],
    n = it.filter((o) => CLGM[o.cd]).length;
  return n
    ? n + ' Grünflächen im Ausschnitt (CORINE, ab 5 ha)'
    : 'Keine Wald-/Feld-/Wiesenflächen im Ausschnitt (CORINE, ab 5 ha)';
}
{
  const _lh = layersHtml;
  layersHtml = function () {
    let h = _lh.apply(this, arguments);
    try {
      const i = LY.findIndex((l) => l[1] === 'clg');
      if (i < 0) return h;
      const m = `onchange="lvis(${i},this.checked)"`,
        ix = h.indexOf(m);
      if (ix < 0) return h;
      const rs = h.lastIndexOf('<div class="ly">', ix),
        re = h.indexOf('</div>', ix) + 6;
      let row = h.slice(rs, re).replace(/<input type="color"[^>]*>/, '');
      const st =
        'style="width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"';
      const subs =
        CLGC.map(
          ([id, n]) =>
            `<div class="ly" style="padding-left:22px"><label>${n}</label><input type="color" value="${clgCol(id)}" oninput="clgSet('${id}',this.value)" title="Farbe" ${st}></div>`,
        ).join('') +
        `<div class="ly" style="padding-left:22px"><label>Deckkraft</label><input type="range" min="0.1" max="1" step="0.05" value="${LY[i][3]}" oninput="lop(${i},+this.value)" style="width:90px"></div>` +
        `<div class="ly" style="padding-left:22px"><label style="font-size:11px;opacity:.7;flex:1">${clgStat()}</label><button type="button" onclick="clgReset()" style="font:inherit;font-size:11px;padding:2px 8px;border:1px solid var(--ln);border-radius:6px;background:none;cursor:pointer">Farben zurücksetzen</button></div>`;
      h = h.slice(0, rs) + row + subs + h.slice(re);
    } catch (e) {
      console.error(e);
    }
    return h;
  };
}

/* v292: Schattenkarte deckt den ganzen Ausschnitt ab (vorher fest ±260 m → am Rand/in den Ecken keine Schatten) */
function sunFit() {
  try {
    if (!GEO || !GEO.size) return;
    const hs = GEO.size / 2,
      R = Math.hypot(hs * 1.4143, 90) + 12,
      D = R + 160,
      sh = sunL.shadow,
      c = sh.camera;
    const L = sunL.position.length();
    if (L > 1e-3) sunL.position.multiplyScalar(D / L);
    if (c.right !== R || c.far !== D + R + 60) {
      Object.assign(c, {
        left: -R,
        right: R,
        top: R,
        bottom: -R,
        near: Math.max(1, D - R - 60),
        far: D + R + 60,
      });
      c.updateProjectionMatrix();
      if (sh.map) {
        sh.map.dispose();
        sh.map = null;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
{
  const _su = sunUp;
  sunUp = function () {
    const r = _su.apply(this, arguments);
    if (sunL.castShadow) sunFit();
    return r;
  };
}
{
  const _rt = rebuildTerrain;
  rebuildTerrain = function () {
    const r = _rt.apply(this, arguments);
    try {
      sunUp();
    } catch (e) {
      logErr(e, 'rebuildTerrain');
    }
    return r;
  };
}

/* neue Projekte: Standard zuerst, danach überschreiben gespeicherte Projektwerte */
{
  const _np = newProjectReset;
  newProjectReset = function () {
    const r = _np.apply(this, arguments);
    try {
      if (gfxDefGet()) gfxDefApply(true);
    } catch (e) {
      console.error(e);
    }
    return r;
  };
}
