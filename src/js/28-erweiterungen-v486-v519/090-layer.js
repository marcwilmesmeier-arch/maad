/* v505: Layer „Gebäudekontur“ (dünne Kantenlinien der Gebäude) – Ein/Aus und Farbe; übernimmt bisherige Werte (an, Farbe S.edgeC) */
{
  const i = LY.findIndex((l) => l[1] === 'buildings');
  if (!LY.some((l) => l[1] === 'bkont'))
    LY.splice(i < 0 ? LY.length : i + 1, 0, ['Gebäudekontur', 'bkont', 1, 1]);
  S.lc.bkont = S.edgeC || '#9b9b97';
}
const BK = { sig: '' };
function bkApply(force) {
  const L = LY.find((l) => l[1] === 'bkont');
  if (!L) return;
  const on = !!L[2],
    col = S.lc.bkont || '#9b9b97',
    sg = konSig() + '|' + on + col + S.noK + KON.g.visible;
  if (!force && sg === BK.sig) return;
  BK.sig = sg;
  S.edgeC = col;
  sc.traverse((o) => {
    if (!(o.isLineSegments && o.userData && o.userData.kont)) return;
    o.visible = on && !S.noK;
    const m = o.material;
    if (!m) return;
    o.userData._kc = new T.Color(col).getHex();
    if (!KON.g.visible) m.color.set(col);
  });
}
setInterval(() => {
  try {
    bkApply();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 350);
{
  const _k = kontUp;
  kontUp = function () {
    const r = _k.apply(this, arguments);
    try {
      bkApply(true);
    } catch (e) {
      logErr(e, 'kontUp');
    }
    return r;
  };
}
{
  const _l = lcol;
  lcol = function (k, v) {
    const r = _l.apply(this, arguments);
    if (k === 'bkont') {
      S.lc.bkont = v;
      try {
        bkApply(true);
      } catch (e) {
        logErr(e, 'lcol');
      }
    }
    return r;
  };
}
{
  const _v = lvis;
  lvis = function (i, v) {
    const r = _v.apply(this, arguments);
    try {
      if (LY[i] && LY[i][1] === 'bkont') bkApply(true);
    } catch (e) {
      logErr(e, 'lvis');
    }
    return r;
  };
}
{
  const _a = vwApplyDs;
  vwApplyDs = function () {
    const r = _a.apply(this, arguments);
    try {
      bkApply(true);
    } catch (e) {
      logErr(e, 'vwApplyDs');
    }
    return r;
  };
}
{
  const _m = lyMApply;
  lyMApply = function () {
    const r = _m.apply(this, arguments);
    try {
      bkApply(true);
    } catch (e) {
      logErr(e, 'lyMApply');
    }
    return r;
  };
}
/* Layer-Panel: Zeile in die Gruppe „Gebäude & Dächer“, direkt unter „Gebäude“ (vor die Unter-Einstellungen) */
LYI.bkont = '<rect x="6" y="4" width="12" height="16" rx="1" stroke-width="2.6"/>';
{
  const g = LYG.find((x) => Array.isArray(x[1]) && x[1].includes('buildings'));
  if (g && !g[1].includes('bkont')) g[1].splice(g[1].indexOf('buildings') + 1, 0, 'bkont');
}
{
  const l0 = lyRender;
  lyRender = function () {
    const r = l0.apply(this, arguments);
    try {
      const el = $('lyp');
      if (!el) return r;
      const rows = [...el.querySelectorAll('.lyr')],
        kr = (k) =>
          rows.find((x) => {
            const b = x.querySelector('button[data-k]');
            return b && b.dataset.k === k;
          });
      const bk = kr('bkont'),
        bd = kr('buildings');
      if (bk && bd && bd.nextSibling !== bk) bd.parentNode.insertBefore(bk, bd.nextSibling);
    } catch (e) {
      console.warn('bk', e);
    }
    return r;
  };
}

LYAFTER.push(() => bkApply(true));
/* v512: Start-Standard – „Sonnenstand simulieren“ ist in der Darstellung „Schattiert“ beim Start und beim Laden eines Projekts eingeschaltet (danach frei abschaltbar) */
function sunDefault() {
  try {
    if (S.dar === 'sch' && !S.sun) {
      S.sun = true;
      const c = $('sunck');
      if (c) c.checked = true;
      try {
        $('bl').classList.add('sunon');
        $('sunc').style.display = 'block';
      } catch (e) {
        logErr(e, 'sunDefault');
      }
      sunUp();
      drUi();
    }
  } catch (e) {
    console.warn('sunDefault', e);
  }
}
{
  const _p = projApplySet;
  projApplySet = function () {
    const r = _p.apply(this, arguments);
    sunDefault();
    return r;
  };
}
sunDefault();
