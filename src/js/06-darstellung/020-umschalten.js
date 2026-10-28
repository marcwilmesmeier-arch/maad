// ---- Umschalten ----
function drSet(m) {
  if (!DAR.some((d) => d[0] === m)) m = 'sch';
  const was = S.dar;
  S.dar = m;
  const R = m === 'real';
  hemi.color.set(R ? 0xcfe3ff : 0xffffff);
  hemi.groundColor.set(R ? 0xa49a8c : 0x999999);
  S.noK = R;
  kontUp();
  if (R) drSky();
  if (DR.skyM) DR.skyM.visible = R && !HOME.open;
  wmGroups();
  wmPaint();
  drAA();
  liLoad();
  liUp();
  drUi();
  if (was !== m)
    try {
      $('bl').classList.toggle('sunon', S.sun || R);
    } catch (e) {
      logErr(e, 'drSet');
    }
}
function drUi() {
  const R = S.dar === 'real';
  $('darBtns').innerHTML = DAR.map(
    (d) => `<button class="${d[0] === S.dar ? 'on' : ''}" onclick="drSet('${d[0]}')">${d[1]}</button>`,
  ).join('');
  $('darDesc').textContent = DAR.find((d) => d[0] === S.dar)[2];
  $('darSunL').style.display = R ? 'none' : '';
  $('sunc').style.display = S.sun || R ? 'block' : 'none';
  $('darBase').style.display = R ? 'none' : 'block';
  $('darReal').style.display = R ? 'block' : 'none';
  $('bl').classList.toggle('sunon', S.sun || R);
  $('drAA').value = String(S.aa);
  drSunInfo();
}
function drDate(md) {
  $('dt').value = drDs().slice(0, 4) + '-' + md;
  sunUp();
}
function drTick(cm) {
  if (DR.skyM) {
    const v = S.dar === 'real' && !HOME.open && !!cm.isPerspectiveCamera;
    DR.skyM.visible = v;
    if (v) DR.skyM.position.copy(cm.position);
  }
  if ((S.dar === 'wm' || S.noK) && ++DR.k % 40 === 0) {
    if (S.dar === 'wm') wmPaint();
    if (S.noK) kontUp();
  }
}
function drInit() {
  $('drAA').onchange = (e) => {
    S.aa = +e.target.value;
    drAA();
  };
  drUi();
}
drInit();
