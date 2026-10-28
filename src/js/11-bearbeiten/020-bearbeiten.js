// ---- Bearbeiten: Gebäude verschieben und drehen
function btStart(e) {
  if ((S.tool !== 'mv' && S.tool !== 'ro') || e.button !== 0 || (!S.m3 && false)) return;
  const b = S.sel;
  if (!b || b.ex || !S.bld.includes(b)) return;
  const g = ground(e);
  if (!g) return;
  if (S.tool === 'mv') {
    ray(e);
    if (!b._g || !rc.intersectObjects(b._g.children, true)[0]) return;
  }
  const c = cen(b.fp);
  dr.v = undefined;
  dr.bt = {
    b,
    g0: g,
    c,
    a0: Math.atan2(g[1] - c[1], g[0] - c[0]),
    fp0: b.fp.map((q) => q.slice()),
    lv0: b.levels.map((l) => (l.fp ? l.fp.map((q) => q.slice()) : null)),
    dir0: b.roof && b.roof.dir != null && b.roof.dir !== '' ? +b.roof.dir : null,
    mv: 0,
  };
  hist();
}
function btApply(t, f) {
  const b = t.b;
  b.fp = t.fp0.map(f);
  b.levels.forEach((l, i) => {
    if (t.lv0[i]) l.fp = t.lv0[i].map(f);
  });
}
function btMove(e) {
  const t = dr.bt,
    b = t.b,
    g = ground(e);
  if (!g) return;
  t.mv = 1;
  dr.m = 1;
  if (S.tool === 'mv') {
    let dx = g[0] - t.g0[0],
      dz = g[1] - t.g0[1];
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dz)) dz = 0;
      else dx = 0;
    }
    btApply(t, (q) => [q[0] + dx, q[1] + dz]);
    $('hud').textContent = `Verschieben · ${f1(dx, 2)} m / ${f1(dz, 2)} m`;
  } else {
    let a = Math.atan2(g[1] - t.c[1], g[0] - t.c[0]) - t.a0;
    let deg = (a * 180) / Math.PI;
    deg = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;
    else deg = Math.round(deg * 2) / 2;
    a = (deg * Math.PI) / 180;
    const co = Math.cos(a),
      si = Math.sin(a);
    btApply(t, (q) => {
      const x = q[0] - t.c[0],
        z = q[1] - t.c[1];
      return [t.c[0] + x * co - z * si, t.c[1] + x * si + z * co];
    });
    if (t.dir0 != null) b.roof.dir = ((Math.round(t.dir0 + deg) % 360) + 360) % 360;
    $('hud').textContent = `Drehen · ${f1(deg, 1)}°` + (e.shiftKey ? '' : ' · Shift = 15°-Raster');
  }
  mesh(b);
  H();
  hpos();
  drawOv();
}
function btEnd(d) {
  const t = d.bt;
  if (!t.mv) {
    S.hist.pop();
    return false;
  }
  rr();
  return true;
}
// tool(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js

// ---- Rechtsklick-Menü am Gebäude
const cmEl = document.createElement('div');
cmEl.id = 'cmenu';
document.body.appendChild(cmEl);
// Menüs aus der Registry erzeugen (einzige Stelle)
function baBuild() {
  $('tmE').innerHTML = BA.map(
    (a) =>
      `<button class="tb" id="t${a.k}" data-ba="${a.k}" onclick="baDo('${a.k}')" title="${a.t}"><i>${baIc(a, 19)}</i>${a.n}</button>`,
  ).join('');
  cmEl.innerHTML = BA.map(
    (a) =>
      (a.sep ? '<hr>' : '') +
      `<button data-ba="${a.k}" onclick="baDo('${a.k}')" title="${a.t}"><i>${baIc(a, 17)}</i>${a.n}</button>`,
  ).join('');
  for (const [dm, p, id] of [
    ['area', 'a', 'tmA'],
    ['bld', 'b', 'tmB'],
  ])
    $(id).innerHTML = SHP.map(
      (x) =>
        `<button class="tb" id="${p}${x.l}" data-shp="${x.k}" onclick="setShape('${x.k}'${dm === 'area' ? ",'area'" : ''})" title="${dm === 'area' ? 'Fläche' : 'Gebäude'}: ${x.n}${x.k === 'free' ? (dm === 'area' ? ' (Grünfläche, Platz …)' : ' – Taste F') : ''}"><i>${x.ic}</i>${x.n}</button>`,
    ).join('');
}
baBuild();
// eine Aktion für beide Menüs
function baDo(k) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/030-baeume-setzen.js
  if (TRE.on) trToggle(false);
  // ── Erweiterung aus 27-skizze/080-auswahl.js
  if (k === 'grl') {
    try {
      cmHide();
    } catch (e) {
      logErr(e, 'baDo');
    }
    if (mnStorey()) {
      const s = SK.sel[0];
      if (!grOpenLv(s.b.id, String(s.j)))
        try {
          $('hud').textContent = 'Grundriss konnte nicht geöffnet werden';
        } catch (e) {
          logErr(e, 'baDo');
        }
    }
    return;
  }
  // ── Erweiterung aus 27-skizze/040-skizzenmodus.js
  if (k === 'del' && SKS.sel.length && !S.sel) {
    cmHide();
    sksDelete();
    return;
  }
  // ── Erweiterung aus 26-modellier-modus/120-modellier.js
  if (SKBA[k]) {
    try {
      cmHide();
    } catch (e) {
      logErr(e, 'baDo');
    }
    skUse(SKBA[k], k === 'skc');
    return;
  }
  // ── Erweiterung aus 19-fassadendesigner/060-kopf.js
  // ---- Einstiege: Ansichtsleiste/Kontextmenü, Reiter „Planen“, Gebäudemetrik (Fassadenfläche)
  if (k === 'fd') {
    cmHide();
    fdOpen();
    return;
  }
  cmHide();
  if (k === 'del') {
    del();
    return;
  }
  if (k === 'gr') {
    grOpen();
    return;
  }
  tool(k);
}
function cmDo(a) {
  baDo(a);
}
// Wächter: meldet Menüs, die von der Registry abweichen (z. B. von Hand ergänzte Buttons)
