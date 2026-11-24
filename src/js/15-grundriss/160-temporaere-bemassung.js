// ---- Temporäre Bemaßung (wie Revit): Bei einer gewählten Innenwand stehen Maße zur nächsten parallelen Wand auf
// beiden Seiten – von der Zeichenlinie der Wand zur Zeichenlinie der Nachbarwand bzw. zur Innenseite der Außenwand
// (LOD 200) oder zum Umriss (LOD 100). Klick auf die Zahl: Wert eintippen, Enter verschiebt die Wand auf diesen
// Abstand (angeschlossene Wände folgen, grEditGrp), Esc bricht ab.

const TBM = { m: [], ed: null };

/**
 * Bezüge für die Maße: Zeichenlinien der anderen Wände, Innenseiten der Außenwände (LOD 200) bzw. Umriss (LOD 100).
 * [{ a, b }]
 */
function grTbBezuege(b, lv, g) {
  const R = [];
  (lv.obj.cuts || []).forEach((c) => {
    if (c[4] !== g) R.push({ a: [c[0], c[1]], b: [c[2], c[3]] });
  });
  if (l2on() && !lv.dg) {
    try {
      // Innenseite der Außenwand: die lange Viereckseite, die nicht auf dem Umriss liegt
      l2Els(b)
        .els.filter((e) => e.li === lv.i && e.kind === 'AW' && e.quads)
        .forEach((e) =>
          e.quads.forEach((q) => {
            const K = [0, 1, 2, 3]
              .map((i) => [q[i], q[(i + 1) % 4]])
              .sort(
                (u, v) =>
                  Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) -
                  Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]),
              )
              .slice(0, 2);
            const innen = K.find(
              ([a, z]) =>
                !(lv.bs || []).some(
                  (s) => grDSeg((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, s[0], s[1], s[2], s[3]) < 0.01,
                ),
            );
            if (innen) R.push({ a: innen[0].slice(), b: innen[1].slice() });
          }),
        );
    } catch (e) {
      logErr(e, 'grTbBezuege');
    }
  } else (lv.bs || []).forEach((s) => R.push({ a: [s[0], s[1]], b: [s[2], s[3]] }));
  return R;
}
/** Maße der gewählten Wand: [{ s (Abstand quer, mit Vorzeichen), P (Fußpunkt auf der Wand), Q (auf dem Bezug) }]. */
function grTbMasse(b, lv, g) {
  const c = (lv.obj.cuts || []).find((q) => q[4] === g);
  if (!c) return [];
  const L = Math.hypot(c[2] - c[0], c[3] - c[1]);
  if (L < 0.05) return [];
  const u = [(c[2] - c[0]) / L, (c[3] - c[1]) / L],
    n = [-u[1], u[0]],
    m = [(c[0] + c[2]) / 2, (c[1] + c[3]) / 2],
    T = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1];
  let plus = null,
    minus = null;
  grTbBezuege(b, lv, g).forEach((r) => {
    const dr = [r.b[0] - r.a[0], r.b[1] - r.a[1]],
      lr = Math.hypot(...dr) || 1;
    if (Math.abs(u[0] * dr[1] - u[1] * dr[0]) / lr > 0.0175) return; // nicht parallel
    // Überdeckung entlang der Wand (der Bezug muss neben der Wand liegen)
    const t0 = Math.min(T(r.a), T(r.b)),
      t1 = Math.max(T(r.a), T(r.b));
    if (t1 < -0.01 || t0 > L + 0.01) return;
    const s = grAusQuer(c, r.a);
    if (Math.abs(s) < 0.005) return;
    const tm = Math.max(t0, Math.min(t1, L / 2));
    if (s > 0 && (!plus || s < plus.s)) plus = { s, tm };
    if (s < 0 && (!minus || s > minus.s)) minus = { s, tm };
  });
  return [plus, minus].filter(Boolean).map((x) => {
    const P = [c[0] + u[0] * x.tm, c[1] + u[1] * x.tm];
    return { s: x.s, P, Q: [P[0] + n[0] * x.s, P[1] + n[1] * x.s], g, n };
  });
}
/** Zeichnen (nach dem Plan): Maßlinie mit Endstrichen, Zahl in der Mitte; Trefferflächen für die Zahlen. */
function grTbZeichnen(x) {
  TBM.m = [];
  const b = grB(),
    sel = GRS.sel;
  if (!b || GRS.tool !== 'sel' || !sel || sel.k !== 'c' || GRS.ed) return;
  const lv = grLv(b);
  grTbMasse(b, lv, sel.g).forEach((M) => {
    const A = grTf(M.P[0], M.P[1]),
      B = grTf(M.Q[0], M.Q[1]),
      dx = B[0] - A[0],
      dy = B[1] - A[1],
      l = Math.hypot(dx, dy);
    if (l < 14) return;
    const ux = dx / l,
      uy = dy / l,
      tick = (P) => {
        x.moveTo(P[0] - uy * 5 - ux * 3, P[1] + ux * 5 - uy * 3);
        x.lineTo(P[0] + uy * 5 + ux * 3, P[1] - ux * 5 + uy * 3);
      };
    x.save();
    x.strokeStyle = '#5E7F92';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(A[0], A[1]);
    x.lineTo(B[0], B[1]);
    tick(A);
    tick(B);
    x.stroke();
    const t = f1(Math.abs(M.s), 2),
      cx = (A[0] + B[0]) / 2,
      cy = (A[1] + B[1]) / 2;
    x.font = '600 12px system-ui, sans-serif';
    const w = x.measureText(t).width + 10,
      h = 18;
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.strokeStyle = '#5E7F92';
    x.beginPath();
    x.roundRect ? x.roundRect(cx - w / 2, cy - h / 2, w, h, 5) : x.rect(cx - w / 2, cy - h / 2, w, h);
    x.fill();
    x.stroke();
    x.fillStyle = '#1d2a33';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(t, cx, cy + 0.5);
    x.restore();
    TBM.m.push({ x: cx - w / 2, y: cy - h / 2, w, h, M });
  });
}
/** Klick auf eine Maßzahl: Eingabefeld darüber; true, wenn getroffen. */
function grTbKlick(e) {
  const cv = gD('grCv');
  if (!cv || !TBM.m.length) return false;
  const r = cv.getBoundingClientRect(),
    sx = e.clientX - r.left,
    sy = e.clientY - r.top,
    hit = TBM.m.find((z) => sx >= z.x && sx <= z.x + z.w && sy >= z.y && sy <= z.y + z.h);
  if (!hit) return false;
  grTbFeld(hit, cv);
  return true;
}
function grTbFeld(hit, cv) {
  const d = GRS.doc,
    cw = cv.parentNode;
  if (!d || !cw) return;
  let i = d.getElementById('grTbIn');
  if (!i) {
    i = d.createElement('input');
    i.id = 'grTbIn';
    i.type = 'text';
    i.inputMode = 'decimal';
    i.setAttribute('aria-label', 'Abstand in Metern');
    i.style.cssText =
      'position:absolute;z-index:20;width:70px;padding:2px 6px;font:600 12px system-ui,sans-serif;font-variant-numeric:tabular-nums;text-align:center;border:1px solid #f07a12;border-radius:5px;background:#fff;color:#1d2a33;outline:none';
    cw.appendChild(i);
  }
  const ro = cv.getBoundingClientRect(),
    rc = cw.getBoundingClientRect();
  i.style.left = ro.left - rc.left + hit.x + hit.w / 2 - 35 + 'px';
  i.style.top = ro.top - rc.top + hit.y - 1 + 'px';
  i.style.display = 'block';
  i.value = f1(Math.abs(hit.M.s), 2);
  TBM.ed = hit.M;
  const zu = () => {
    i.style.display = 'none';
    TBM.ed = null;
    GRS.dirty = 1;
  };
  i.onkeydown = (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Escape') zu();
    if (ev.key !== 'Enter') return;
    const v = parseFloat(i.value.replace(',', '.'));
    const M = TBM.ed;
    zu();
    if (!M || !isFinite(v) || v < 0) return;
    grTbSetzen(M, v);
  };
  i.onblur = zu;
  i.focus();
  i.select();
}
/** Wand so verschieben, dass ihr Abstand zum Bezug v ist. */
function grTbSetzen(M, v) {
  const b = grB();
  if (!b) return;
  const lv = grLv(b),
    c = (lv.obj.cuts || []).find((q) => q[4] === M.g);
  if (!c) return;
  const d = Math.sign(M.s) * (Math.abs(M.s) - v),
    m = new Map();
  [
    [c[0], c[1]],
    [c[2], c[3]],
  ].forEach((q) => m.set(gk(q[0], q[1]), [q[0] + M.n[0] * d, q[1] + M.n[1] * d]));
  grEditGrp(M.g, m);
}
