// ---- v320: Grundrisse je Gebäude unter „Planen“ und Doppelklick auf ein Geschoss in 3D öffnet den Geschoss-Grundriss
function grOpenLv(bid, key) {
  const b = S.bld.find((x) => x.id === bid);
  if (!b || b.ex) return false;
  if (S.sel !== b) {
    S.sel = b;
    S.selF = null;
    S.roofSel = null;
    try {
      H();
      hpos();
      nav();
    } catch (e) {
      logErr(e, 'grOpenLv');
    }
  }
  if (!grOpen(bid)) return false;
  try {
    if (grData(b).some((l) => l.key === String(key))) {
      GRS.lv = String(key);
      GRS.sel = null;
      GRS.fit = null;
    }
    GRS.dirty = 1;
    grTick(true);
    try {
      rr();
    } catch (e) {
      logErr(e, 'grOpenLv');
    }
  } catch (e) {
    console.warn('Grundriss öffnen', e);
  }
  return true;
}
// Doppelklick links wählt das Geschoss (Dach = Dachgeschoss) im 3D-Fenster aus und öffnet den Grundriss; der Knopf „Grundriss öffnen“ im Panel öffnet ihn ebenfalls
cv.addEventListener(
  'dblclick',
  (e) => {
    try {
      if (e.button !== 0 || S.fd || S.tool !== 'v' || !S.m3 || (S.draft && S.draft.length)) return;
      const A = typeof edv === 'function' ? edv() : null,
        g = ground(e);
      if (A && g && vhit(g, A) >= 0 && A.length > 3) return;
      ray(e);
      const hit = rc.intersectObjects(
        G.nb.children.flatMap((q) => q.children.filter((o) => o.isMesh)),
        false,
      )[0];
      if (!hit) return;
      const o = hit.object,
        b = o.userData.b;
      if (!b || b.ex || !S.bld.includes(b)) return;
      let key = o.userData.k;
      if (key == null) {
        if (b.roof && b.roof.type && b.roof.type !== 'flat') key = 'dg';
        else key = b.levels.length - 1;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      if (S.sel !== b) {
        S.sel = b;
        S.selP = null;
        S.selA = null;
        S.multi = [];
        S.multiA = [];
      }
      S.tab = 'Planen';
      if (key === 'dg') selRoof();
      else selL(+key);
      try {
        nav();
      } catch (e) {
        logErr(e, 'init>anonym');
      }
      rr();
      grOpenLv(b.id, String(key));
      $('hud').textContent =
        b.name +
        ' · ' +
        ((grData(b).find((l) => l.key === String(key)) || {}).name || '') +
        ' ausgewählt und im Grundriss geöffnet';
    } catch (er) {
      console.warn('Doppelklick Geschoss', er);
    }
  },
  true,
);
