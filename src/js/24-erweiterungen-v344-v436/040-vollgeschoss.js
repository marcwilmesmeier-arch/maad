/* v397 Vollgeschoss-Regel: ein Geschoss zählt nur, wenn (1) lichte Raumhöhe >= Mindesthöhe, (2) diese Höhe über mehr als den Flächenanteil der Grundfläche des darunterliegenden Geschosses erreicht wird
   (Staffelgeschosse mit kleinerer Fläche und Dachgeschosse mit Schrägen fallen heraus) und (3) die Deckenoberkante im Mittel mindestens X m über dem Gelände liegt (trennt Keller). Parameter in S.lim.vgh/vga/vgd/vgc, werden mit dem Projekt gespeichert. */
const vgP = () => ({
  h: S.lim.vgh > 0 ? S.lim.vgh : 2.3,
  a: S.lim.vga > 0 ? S.lim.vga : 66.67,
  d: S.lim.vgd >= 0 && S.lim.vgd != null ? S.lim.vgd : 1.4,
  c: S.lim.vgc >= 0 && S.lim.vgc != null ? S.lim.vgc : 0.3,
});
function vgInside(p, x, z) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function vgInfo(b) {
  if (!b || !b.levels || !b.levels.length) return { n: 0, rows: [], P: vgP() };
  const P = vgP(),
    u = ugN(b),
    rows = [];
  let tm = 0;
  try {
    const f = b.fp;
    tm = f.reduce((s, q) => s + gh(q[0], q[1]), 0) / f.length - base(b);
  } catch (e) {
    logErr(e, 'vgInfo');
  }
  let z = -b.levels.reduce((t, l) => t + (l.ug ? l.h : 0), 0),
    prevA = null;
  b.levels.forEach((l, i) => {
    const A = area(lf(b, l)),
      ref = prevA == null ? A : prevA,
      top = z + l.h,
      clear = l.h - P.c,
      share = clear >= P.h ? Math.min(100, (A / ref) * 100) : 0,
      above = top - tm,
      why = [];
    if (clear < P.h) why.push('lichte Höhe ' + f1(clear, 2) + ' m < ' + f1(P.h, 2) + ' m');
    if (clear >= P.h && share <= P.a)
      why.push('Fläche ' + f1(share, 0) + ' % ≤ ' + f1(P.a, 1) + ' % des Geschosses darunter');
    if (above < P.d) why.push('Decke ' + f1(above, 2) + ' m über Gelände < ' + f1(P.d, 2) + ' m');
    rows.push({ n: lname(b, i), ok: !why.length, why: why.join('; '), s: share, above });
    z = top;
    prevA = A;
  });
  const dach = !!(b._rp && b.roof && b.roof.type && b.roof.type !== 'flat');
  rows.forEach((r) => {
    r.st = !r.ok && /Fläche/.test(r.why) && !/Decke/.test(r.why) && !/lichte Höhe \d/.test(r.why);
  });
  return { n: rows.filter((r) => r.ok).length, st: rows.filter((r) => r.st).length, dach, rows, P };
}
const vgN = (b) => vgInfo(b).n;
function vgSet(k, v) {
  v = parseFloat(String(v).replace(',', '.'));
  S.lim[k] = isFinite(v) && v >= 0 ? v : null;
  try {
    rr();
  } catch (e) {
    logErr(e, 'vgSet');
  }
  try {
    zoRender();
  } catch (e) {
    logErr(e, 'vgSet');
  }
  vgRender();
}
function vgLabel(I) {
  return I.n + (I.st ? '+' + (I.st > 1 ? I.st : '') + 'ST' : '') + (I.dach ? '+DG' : '');
}
function vgHtml(b, R, ab) {
  const I = vgInfo(b);
  return `<div class="r ind"><span title="Vollgeschosse + Staffelgeschoss (ST) bzw. Dachgeschoss (DG)">Vollgeschosse</span><b>${vgLabel(I)}</b><button class="vgb" title="Regeln für Vollgeschosse und Staffelgeschosse" aria-label="Regeln" onclick="vgOpen('${esc(b.id)}')">⚙</button></div>`;
}
const VGW = { id: null };
function vgOpen(id) {
  VGW.id = id;
  let e = document.getElementById('vgW');
  if (!e) {
    e = document.createElement('div');
    e.id = 'vgW';
    e.className = 'fl';
    e.style.cssText =
      'position:fixed;left:312px;top:150px;width:300px;max-height:70vh;overflow:auto;padding:12px 14px;z-index:40;font-size:12.5px;line-height:1.35';
    document.body.appendChild(e);
  }
  e.style.display = 'block';
  vgRender();
}
function vgClose() {
  VGW.id = null;
  const e = document.getElementById('vgW');
  if (e) e.style.display = 'none';
}
function vgRender() {
  const e = document.getElementById('vgW');
  if (!e || !VGW.id) return;
  const b = S.bld.find((x) => x.id === VGW.id);
  if (!b) {
    vgClose();
    return;
  }
  const I = vgInfo(b),
    P = I.P,
    inp = (k, l, v, st) =>
      `<label class="vgi"><span>${l}</span><input type="number" step="${st}" min="0" value="${v}" onchange="vgSet('${k}',this.value)"></label>`;
  const st = I.rows.filter((r) => r.st).reverse();
  e.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><b style="flex:1">Vollgeschoss-Regeln</b><button class="sm" onclick="vgClose()">✕</button></div><div class="mu" style="margin:6px 0 8px">Ein Geschoss zählt als Vollgeschoss, wenn die lichte Höhe über mehr als den Flächenanteil des Geschosses darunter erreicht wird und die Decke im Mittel hoch genug über dem Gelände liegt. Reicht nur die Fläche nicht, ist es ein Staffelgeschoss (ST). Dachgeschosse (DG) werden über die Dachform erkannt.</div><div class="vgp0">${inp('vgh', 'Lichte Höhe mind. (m)', P.h, 0.05)}${inp('vga', 'Flächenanteil über (%)', P.a, 1)}${inp('vgd', 'Decke über Gelände mind. (m)', P.d, 0.05)}${inp('vgc', 'Deckenstärke (m)', P.c, 0.05)}</div>
 <div class="bd" style="margin-top:10px">${esc(b.name || b.id)} · ${vgLabel(I)}</div>${st.length ? st.map((r) => `<div class="vgr"><b>${esc(r.n)}</b> Staffelgeschoss<div class="mu">${esc(r.why)}</div></div>`).join('') : '<div class="mu" style="margin-top:4px">Kein Staffelgeschoss.</div>'}${I.dach ? '<div class="vgr"><b>Dachgeschoss</b> über die Dachform erkannt</div>' : ''}`;
}
setInterval(() => {
  try {
    if (
      VGW.id &&
      !(document.activeElement && document.getElementById('vgW').contains(document.activeElement))
    )
      vgRender();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 1200);
{
  const c = document.createElement('style');
  c.textContent = `#zol .vgb{margin-left:4px;border:0;background:transparent;color:var(--zm);cursor:pointer;font-size:13px;padding:0 3px;border-radius:5px}#zol .vgb:hover{background:var(--zh)}#vgW .vgp0{display:grid;gap:4px}#vgW .vgr{margin-top:6px}#vgW .vgi{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px}#vgW .vgi input{width:70px;font:inherit;padding:2px 4px}#zol .vgi{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;color:var(--zm)}#zol .vgi input{width:62px;font:inherit;font-size:11px;padding:2px 4px}`;
  document.head.appendChild(c);
}
