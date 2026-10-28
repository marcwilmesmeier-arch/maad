// ---- Umschalten ----
function drSet(m) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/060-darstellung.js
  if (m === 'sw' && S.m3) return;
  if (m === 'sw' && !S.lyM.sw) S.lyM.sw = swDefault();
  const was = S.dar;
  if (m !== 'sw' && was !== 'sw' && DAR.some((d) => d[0] === was)) SW.prev = was;
  if (m === 'sw' && was !== 'sw') SW.prev = was;
  // ── Erweiterung aus 18-erweiterungen-v280-v325/110-administrationsansicht.js
  const r = (() => {
    // ── Erweiterung aus 18-erweiterungen-v280-v325/030-layer.js
    const was = S.dar,
      ok = DAR.some((d) => d[0] === m),
      nm = ok ? m : 'sch';
    if (LYD.skip) {
      LYD.skip = 0;
      const r = drSetStufe2.apply(this, arguments);
      S.lyM[S.dar] = lyMSnap();
      return r;
    }
    if (nm === was) return drSetStufe2.apply(this, arguments);
    S.lyM[was] = lyMSnap();
    const r = drSetStufe2.apply(this, arguments);
    try {
      if (S.lyM[S.dar]) lyMApply(S.lyM[S.dar]);
      else S.lyM[S.dar] = lyMSnap();
    } catch (e) {
      console.error(e);
    }
    try {
      lyDUi();
    } catch (e) {
      logErr(e, 'drSet');
    }
    return r;
  })();
  try {
    const p = $('admp');
    if (p && p.style.display === 'block') admRender();
  } catch (e) {
    logErr(e, 'drSet');
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/130-weissmodell.js (danach)
  try {
    if (S.dar === 'wm' && !(S.lyM.wm && S.lyM.wm.wv === 2)) wmDefApply();
  } catch (e) {
    console.error(e);
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/060-darstellung.js (danach)
  try {
    swPaint();
    if (S.dar === 'sw') {
      S.sun = false;
      const c = $('sunck');
      if (c) c.checked = false;
    }
    rr();
  } catch (e) {
    console.warn('sw', e);
  }
  return r;
}
// drSet() ohne die Erweiterungen darüber – wird von drSet() gezielt aufgerufen
function drSetStufe2(m) {
  // ── Erweiterung aus 17-erweiterungen-v253-v280/130-startseite.js
  const r = drSetBasis.apply(this, arguments);
  try {
    if (HOME.open) rfBtn();
  } catch (e) {
    console.error(e);
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/010-gruen-wasser.js (danach)
  try {
    fxUi();
    fxSync();
  } catch (e) {
    console.error(e);
  }
  return r;
}
// drSet() ohne die Erweiterungen darüber – wird von drSet() gezielt aufgerufen
function drSetBasis(m) {
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
  // ── Erweiterung aus 16-darstellung-erweitert/010-starke-schwarze-aussenkontur.js (danach)
  konUi();

  // ── Erweiterung aus 16-darstellung-erweitert/030-himmelfarbe-je-darstellung.js (danach)
  skyUi();

  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  brUi();

  // ── Erweiterung aus 28-erweiterungen-v486-v519/060-darstellung.js (danach)
  try {
    const bs = $('darBtns').children;
    DAR.forEach((d, i) => {
      const b = bs[i];
      if (!b) return;
      const off = S.m3 && d[3] === '2d';
      b.disabled = off;
      b.style.opacity = off ? 0.4 : '';
      b.style.cursor = off ? 'not-allowed' : '';
      b.title = off ? 'Nur in der 2D-Ansicht verfügbar' : '';
    });
    if (swOnly(S.dar)) $('darDesc').textContent = DAR.find((d) => d[0] === S.dar)[2];
  } catch (e) {
    logErr(e, 'drUi');
  }
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
  // ── Erweiterung aus 19-fassadendesigner/080-helligkeit-in-der-darstellung.js (danach)
  if (S.dar === 'real' && ++brTickN % 20 === 0) brPatch();
}
function drInit() {
  $('drAA').onchange = (e) => {
    S.aa = +e.target.value;
    drAA();
  };
  drUi();
}
// Startaufruf verschoben nach start() in 29-start/010-start-projekt-oeffnen.js
