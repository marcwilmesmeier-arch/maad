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
const tool0 = tool;
tool = function (t) {
  if (t === 't' && S.sel && !S.sel.ex && !S.m3) {
    try {
      setMode(1);
    } catch (e) {
      logErr(e, 'tool');
    }
  }
  if (t === 't' && !(S.sel && !S.sel.ex && S.bld.includes(S.sel))) {
    tool0('v');
    try {
      $('hud').textContent = 'Schneiden: zuerst ein Gebäude auswählen';
    } catch (e) {
      logErr(e, 'tool');
    }
    return;
  }
  if (t === 'L') {
    S.hov = S.hb = S.hv = S.hvB = S.hvR = null;
    S.selP = null;
    S.vi = null;
    try {
      handle.visible = false;
      hc.visible = false;
    } catch (e) {
      logErr(e, 'tool');
    }
  }
  tool0(t);
  try {
    if (t === 'L')
      $('hud').textContent =
        'Beschriften: Klick setzt einen Punkt auf Gebäude, Dach oder Gelände – Auswahl und Bearbeiten sind gesperrt · Esc beendet';
  } catch (e) {
    logErr(e, 'tool');
  }
  try {
    if (t === 't') {
      const sf = selOk();
      $('hud').textContent =
        sf && sf.b === S.sel
          ? 'Schneiden: Wand des gewählten Geschosses anklicken – nur dieses Geschoss wird getrennt'
          : 'Schneiden: Wand anklicken – die ganze Fassadenseite (alle Geschosse) wird getrennt · Geschoss wählen = nur ein Geschoss';
    }
    if (t === 'mv' || t === 'ro') {
      $('hud').textContent =
        t === 'mv'
          ? 'Verschieben: Gebäude ziehen · Shift = nur eine Achse'
          : 'Drehen: Maus um das Gebäude ziehen · Shift = 15°-Raster';
      cv.style.cursor = t === 'mv' ? 'move' : 'alias';
    } else cv.style.cursor = '';
  } catch (e) {
    logErr(e, 'tool');
  }
};

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
