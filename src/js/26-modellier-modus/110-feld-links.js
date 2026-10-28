// ---- Feld links: Innenhof
function szPanelEl() {
  let d = document.getElementById('sznp');
  if (!d) {
    d = document.createElement('div');
    d.id = 'sznp';
    d.className = 'fl';
    d.style.cssText =
      'position:absolute;left:12px;top:100px;z-index:6;padding:6px 8px;display:none;font-size:11px;min-width:170px;max-width:230px';
    mid.appendChild(d);
  }
  return d;
}
function szPanel() {
  const d = szPanelEl(),
    sp = SK.sel.filter((e) => e.vd != null && szObj(e));
  if (!skAct() || !sp.length || SZ.op) {
    d.style.display = 'none';
    d.dataset.sg = '';
    return;
  }
  const en = sp[0],
    v = szObj(en),
    b = en.b,
    sg = skKey(en) + JSON.stringify(v);
  if (d.dataset.sg === sg) {
    d.style.display = 'block';
    return;
  }
  d.dataset.sg = sg;
  d.style.display = 'block';
  const opt = (q) =>
    b.levels
      .map(
        (l, i) =>
          '<option value="' + i + '"' + (i === q ? ' selected' : '') + '>Ebene ' + (i + 1) + '</option>',
      )
      .join('');
  d.innerHTML =
    '<div style="font-weight:600;margin-bottom:4px">Innenhof · ' +
    szA(v.poly).toFixed(1).replace('.', ',') +
    ' m²</div><label>von <select onchange="szPVoid(0,this.value)" style="font-size:11px">' +
    opt(v.j0) +
    '</select></label> <label>bis <select onchange="szPVoid(1,this.value)" style="font-size:11px">' +
    opt(v.j1) +
    '</select></label><br><button class="tb" style="font-size:11px;padding:3px 8px;margin-top:4px" onclick="szDelete()">Auffüllen (Entf)</button>';
}
function szPVoid(w, v) {
  const en = SK.sel.find((e) => e.vd != null && szObj(e));
  if (!en) return;
  const o = szObj(en),
    b = en.b,
    n = parseInt(v, 10),
    j0 = w === 0 ? n : o.j0,
    j1 = w === 1 ? n : o.j1;
  if (!szOkV(b, o.poly, j0, j1, o)) {
    szMsg('So nicht möglich (Fläche liegt dort nicht im Geschoss)');
    const d = szPanelEl();
    d.dataset.sg = '';
    return;
  }
  hist();
  o.j0 = j0;
  o.j1 = j1;
  szRefresh(b);
  szSelect([{ b, j: j1, vd: en.vd, floor: 1 }]);
  szMsg('Innenhof durch Ebene ' + (j0 + 1) + ' bis ' + (j1 + 1));
}
setInterval(() => {
  try {
    szPanel();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 300);
