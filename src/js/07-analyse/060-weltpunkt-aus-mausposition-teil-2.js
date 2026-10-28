const LFB = {};
function lfBytes(f, b) {
  const k = f + (b ? 'b' : 'r');
  if (!LFB[k]) {
    const s = atob(LFONT[f][b ? 'b' : 'r'].b64),
      u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    LFB[k] = u;
  }
  return LFB[k];
}
const lfOk = (f) => !!(f && f !== 'helv' && LFONT[f]);
const lfCss = (f) =>
  lfOk(f) ? `lot_${f},Helvetica,Arial,sans-serif` : 'Helvetica,Arial,"Liberation Sans",sans-serif';
// Breite aus der eingebetteten Schrift (1/1000 em, WinAnsi) - identisch fuer Vorschau und PDF
function lfW(f, b, s) {
  const w = LFONT[f][b ? 'b' : 'r'].w;
  let t = 0;
  for (const ch of s) {
    let c = ch.charCodeAt(0);
    if (c > 255) c = PDFM[ch] != null ? PDFM[ch] : 63;
    t += c >= 32 ? w[c - 32] || 0 : 0;
  }
  return t / 1000;
}
let lfT = 0;
function lfRedraw() {
  clearTimeout(lfT);
  lfT = setTimeout(() => {
    try {
      if (LAY.open) layRender();
      AN.rev++;
      AN.key = '';
    } catch (e) {
      logErr(e, 'lfRedraw>anonym');
    }
  }, 60);
}
(function () {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  Object.keys(LFONT).forEach((f) =>
    ['r', 'b'].forEach((k) => {
      try {
        const ff = new FontFace('lot_' + f, lfBytes(f, k === 'b').slice().buffer, {
          weight: k === 'b' ? '700' : '400',
        });
        document.fonts.add(ff);
        ff.load()
          .then(lfRedraw)
          .catch(() => {});
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    }),
  );
})();
const LFOPT = [['helv', 'Helvetica (Standard)'], ...Object.keys(LFONT).map((f) => [f, LFONT[f].n])];
