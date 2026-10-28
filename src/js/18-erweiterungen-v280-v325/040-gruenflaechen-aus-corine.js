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
// recomp(): Erweiterung zusammengeführt, siehe 02-geodaten/020-flurkarte-als-bild.js
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
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// lop(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// ovSync(): Erweiterung zusammengeführt, siehe 17-erweiterungen-v253-v280/080-karten.js
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
// sunUp(): Erweiterung zusammengeführt, siehe 06-darstellung/010-darstellung.js
// rebuildTerrain(): Erweiterung zusammengeführt, siehe 02-geodaten/010-kontextdaten.js

// newProjectReset(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
