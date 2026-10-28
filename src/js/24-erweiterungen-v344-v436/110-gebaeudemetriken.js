/* ---- Gebäudemetriken: bei mehr als einem Gebäude eine Übersichtszeile „Alle Gebäude" (Anzahl, Gesamt-BGF, GR gesamt); Anklicken wählt alle Gebäude an */
(function () {
  const st = document.createElement('style');
  st.textContent =
    '#zoAll{margin:6px 0 8px;padding:6px 8px;border:1px solid rgba(0,0,0,.12);border-radius:8px;cursor:pointer}#zoAll:hover{background:rgba(94,127,146,.08)}#zoAll.on{border-color:#5E7F92;box-shadow:0 0 0 2px rgba(94,127,146,.25);background:rgba(94,127,146,.1)}#zoAll .zt{font-size:13px;font-weight:600;margin-bottom:3px}#zoAll .zr{display:flex;justify-content:space-between;gap:8px;font-size:12px}';
  document.head.appendChild(st);
})();
function zoSelAll() {
  const bs = S.bld.filter((b) => !b.ex && b.fp);
  if (bs.length < 2) return;
  S.multi = bs;
  S.multiA = [];
  S.selA = null;
  S.selF = null;
  S.par = null;
  S.sel = null;
  try {
    areaSelDraw();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    H();
    hpos();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    zoIsoClear();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  rr();
  try {
    zoRender();
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
  try {
    gst('Alle ' + bs.length + ' Gebäude gewählt.');
  } catch (e) {
    logErr(e, 'zoSelAll');
  }
}
{
  const _z = zoRender;
  zoRender = function () {
    const r = _z.apply(this, arguments);
    try {
      const e = document.getElementById('zol');
      if (!e) return r;
      const o = document.getElementById('zoAll');
      if (o) o.remove();
      const bs = S.bld.filter((b) => !b.ex && b.fp);
      if (bs.length < 2) return r;
      let tg = 0,
        tr = 0;
      bs.forEach((b) => {
        const k = bM(b);
        tg += k.bgfoi + k.bgfui;
        tr += grOf(b);
      });
      const on = !S.sel && S.multi && S.multi.length === bs.length && bs.every((b) => S.multi.includes(b)),
        A = (v) => f1(v, 1) + ' m²',
        ng = bs.reduce((n, b) => n + b.levels.length, 0),
        h = `<div id="zoAll" class="${on ? 'on' : ''}" onclick="zoSelAll()" title="Anklicken: alle Gebäude auswählen"><div class="zt">${bs.length} Gebäude<span style="font-weight:400;color:var(--zm);font-size:11px;margin-left:6px">${ng} Geschosse</span></div><div class="zr"><span>BGF gesamt</span><span style="white-space:nowrap">${A(tg)}</span></div><div class="zr" style="font-size:11.5px;color:var(--zm)"><span>GR gesamt</span><span style="white-space:nowrap">${A(tr)}</span></div></div>`;
      const m = e.querySelector('.mu');
      if (m) m.insertAdjacentHTML('afterend', h);
      else e.insertAdjacentHTML('afterbegin', h);
    } catch (err) {
      console.warn('Gesamtzeile', err);
    }
    return r;
  };
}

// Flächenart 5-Zimmer-Wohnung bleibt für bestehende Projekte verfügbar
{
  const _e = () => {
    try {
      if (typeof grFA === 'function' && !grFA('wo5') && S.fa)
        S.fa.push({ k: 'wo5', n: '5-Zimmer-Wohnung', u: 'Wohnen', c: '#2f68a8', d: 'NUF', f: 100 });
    } catch (e) {
      logErr(e, '_e');
    }
  };
  _e();
}

// ---- Basis der Zeichenhilfe (Raster): Zustand, Drehung, Rasterrahmen, Ursprung/Richtung wählen, Rasterlinien im Plan
S.mx = S.mx || {};
S.mx.ras = Object.assign(
  { draw: 0, dsnap: 1, mod: 1.25, ax: 0, th: null, ox: null, oz: null },
  S.mx.ras || {},
);
const MXS = { pick: 0 };
const mxRot = (p, t) => {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
};
const mxBack = (p, t) => {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};
function mxMainTh(fp) {
  let best = 0,
    th = 0;
  fp.forEach((p, i) => {
    const q = fp[(i + 1) % fp.length],
      l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > best) {
      best = l;
      th = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
  });
  return th;
}
function mxFrame(b, lv) {
  const fp = (lv && lv.fp) || b.fp,
    R = S.mx.ras,
    th = R.th != null ? R.th : mxMainTh(fp);
  let ru, rv;
  if (R.ox != null) {
    const q = mxRot([R.ox, R.oz], th);
    ru = q[0];
    rv = q[1];
  } else {
    const P = fp.map((p) => mxRot(p, th));
    ru = Math.min(...P.map((p) => p[0]));
    rv = Math.min(...P.map((p) => p[1]));
  }
  return { th, r: [ru, rv] };
}
function mxRefresh() {
  GRS.ps = '';
  GRS.dirty = 1;
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'mxRefresh');
  }
}
GR.mxRas = (k, v, num) => {
  S.mx.ras[k] = num ? +String(v).replace(',', '.') || 0 : v;
  mxRefresh();
};
GR.mxPick = () => {
  MXS.pick = MXS.pick ? 0 : 1;
  mxRefresh();
};
GR.mxRasAuto = () => {
  S.mx.ras.th = null;
  S.mx.ras.ox = null;
  S.mx.ras.oz = null;
  MXS.pick = 0;
  mxRefresh();
};
{
  const _d = grDown;
  grDown = function (e) {
    if (MXS.pick && e.button === 0) {
      const p = grPt(e),
        R = S.mx.ras;
      if (MXS.pick === 1) {
        R.ox = gr2(p.x);
        R.oz = gr2(p.z);
        MXS.pick = 2;
      } else {
        R.th = Math.atan2(p.z - R.oz, p.x - R.ox);
        MXS.pick = 0;
      }
      GRS.ps = '';
      GRS.dirty = 1;
      try {
        grTick(true);
      } catch (e) {
        logErr(e, 'grDown');
      }
      return;
    }
    return _d.apply(this, arguments);
  };
}
{
  const _g = grDraw;
  grDraw = function () {
    const r = _g.apply(this, arguments);
    try {
      if (!S.mx.ras.draw) return r;
      const b = grB(),
        cv = gD('grCv');
      if (!b || !cv) return r;
      const lv = grLv(b),
        fr = mxFrame(b, lv),
        R = S.mx.ras,
        m = R.mod || 1.25,
        x = cv.getContext('2d'),
        P = (lv.fp || b.fp).map((p) => mxRot(p, fr.th)),
        u0 = Math.min(...P.map((p) => p[0])) - 6,
        u1 = Math.max(...P.map((p) => p[0])) + 6,
        v0 = Math.min(...P.map((p) => p[1])) - 6,
        v1 = Math.max(...P.map((p) => p[1])) + 6,
        ln = (a, c, col, w) => {
          const A = grTf(...mxBack(a, fr.th)),
            B = grTf(...mxBack(c, fr.th));
          x.strokeStyle = col;
          x.lineWidth = w;
          x.beginPath();
          x.moveTo(A[0], A[1]);
          x.lineTo(B[0], B[1]);
          x.stroke();
        },
        px = m * GRS.view.s;
      x.save();
      if (px >= 7) {
        for (let u = fr.r[0] + Math.ceil((u0 - fr.r[0]) / m) * m; u <= u1; u += m)
          ln([u, v0], [u, v1], 'rgba(94,127,146,.18)', 1);
        for (let v = fr.r[1] + Math.ceil((v0 - fr.r[1]) / m) * m; v <= v1; v += m)
          ln([u0, v], [u1, v], 'rgba(94,127,146,.18)', 1);
      }
      if (R.ax > 0) {
        x.font = '11px system-ui';
        x.fillStyle = '#b5651d';
        let i = 0;
        for (let u = fr.r[0]; u <= u1; u += R.ax, i++) {
          if (u < u0) continue;
          ln([u, v0], [u, v1], 'rgba(181,101,29,.55)', 1.2);
          const A = grTf(...mxBack([u, v0], fr.th));
          x.fillText(String(i + 1), A[0] + 3, A[1] - 3);
        }
      }
      const O = grTf(...mxBack(fr.r, fr.th));
      x.fillStyle = '#5E7F92';
      x.beginPath();
      x.arc(O[0], O[1], 4, 0, 7);
      x.fill();
      x.restore();
    } catch (e) {
      logErr(e, 'grDraw');
    }
    return r;
  };
}
// ---- Raster als Zeichenhilfe in der normalen Grundrissbearbeitung (Reiter Anzeige): Modul, Tragachsen, Ursprung/Richtung, Einrasten
{
  const _s = grSnap;
  grSnap = function (p, shift, lv, mode) {
    const r = _s.apply(this, arguments);
    try {
      const R = S.mx.ras;
      if (R.draw && R.dsnap !== 0 && !r.t && !shift) {
        const b = grB(),
          fr = mxFrame(b, lv),
          m = R.mod || 1.25,
          q = mxRot([p.x, p.z], fr.th),
          u = fr.r[0] + Math.round((q[0] - fr.r[0]) / m) * m,
          v = fr.r[1] + Math.round((q[1] - fr.r[1]) / m) * m,
          tol = (GRPX / GRS.view.s) * 1.2,
          du = Math.abs(q[0] - u),
          dv = Math.abs(q[1] - v),
          nu = du < tol,
          nv = dv < tol;
        if (nu || nv) {
          const w = mxBack([nu ? u : q[0], nv ? v : q[1]], fr.th);
          r.x = w[0];
          r.z = w[1];
          r.t = nu && nv ? 'p' : 'g';
          if (!(nu && nv)) r.gd = [];
        }
      }
    } catch (e) {
      logErr(e, 'grSnap');
    }
    return r;
  };
}
function rasCard() {
  const R = S.mx.ras,
    ni = (k, l, u, mn, mx, sp) =>
      `<div class="row"><label>${l}</label><span><input type="number" style="width:64px" min="${mn}" max="${mx}" step="${sp}" value="${R[k] || 0}" onchange="GR.mxRas('${k}',this.value,1)"> ${u}</span></div>`,
    ck = (k, l, d) =>
      `<label style="display:flex;gap:6px;align-items:center;margin:3px 0"><input type="checkbox" ${(R[k] === undefined ? d : R[k]) ? 'checked' : ''} onchange="GR.mxRas('${k}',this.checked?1:0,1)">${l}</label>`;
  return (
    `<h4>Raster (Zeichenhilfe)</h4><div class="card">` +
    ck('draw', 'Raster im Plan anzeigen', 0) +
    ck('dsnap', 'Beim Zeichnen auf Raster einrasten', 1) +
    ni('mod', 'Modulraster', 'm', 0.05, 10, 0.05) +
    ni('ax', 'Tragachsabstand (0 = aus)', 'm', 0, 30, 0.25) +
    `<button class="full" onclick="GR.mxPick()" title="Im Plan zuerst den Ursprung, danach einen zweiten Punkt für die Richtung anklicken">${MXS.pick === 1 ? 'Ursprung anklicken …' : MXS.pick === 2 ? 'Richtung anklicken …' : 'Ursprung und Richtung im Plan wählen'}</button><button class="full" onclick="GR.mxRasAuto()">Automatisch (Hauptachse, linke untere Ecke)</button><div class="mu" style="margin-top:4px">Nur Zeichenhilfe: Linien, Rechtecke und Punkte rasten auf Rasterlinien ein (Shift = ohne Einrasten). </div></div>`
  );
}
{
  const _g = grPanel;
  grPanel = function (b) {
    const h = _g.apply(this, arguments);
    if (GRS.tab === 'a') {
      try {
        return h + rasCard();
      } catch (e) {
        logErr(e, 'grPanel');
      }
    }
    return h;
  };
}

// ---- Gebäudemodell-Quelle im Projekt umstellbar (Datenquellen & Einstellungen): Automatisch / LoD2 / LoD1 / OSM
S.gbMode = S.gbMode || 'auto';
const GBM = [
  ['auto', 'Automatisch (LoD3 im Quellgebiet → LoD2 Land → LoD1 Esri/IOER → OSM)'],
  ['lod2', 'LoD2 Landesquelle (echte Dachformen), ohne LoD3'],
  ['lod1', 'LoD1 (Grundriss + gemessene Höhe, Esri/IOER, keine Dachform)'],
  ['osm', 'OSM-Gebäude (extrudiert, Höhe geschätzt)'],
];
{
  const _b = bldLoad2;
  bldLoad2 = async function (lon, lat, size) {
    const m = S.gbMode || 'auto';
    if (m === 'osm')
      return {
        list: [],
        msg: 'Gebäudemodell: OSM-Gebäude gewählt (Datenquellen & Einstellungen).',
        via: 'osm',
        prov: '',
      };
    if (m === 'lod1') {
      const o = S.lod2On;
      S.lod2On = true;
      let r;
      try {
        r = await lod2Load(lon, lat, size);
      } finally {
        S.lod2On = o;
      }
      r.msg = 'Gebäudemodell: LoD1 gewählt (Grundriss + gemessene Höhe). ' + r.msg;
      r.via = r.list.length ? 'esri' : 'osm';
      r.prov = '';
      return r;
    }
    return _b.apply(this, arguments);
  };
}
{
  const _l = lod3Ask;
  lod3Ask = function () {
    if ((S.gbMode || 'auto') !== 'auto') return Promise.resolve(false);
    return _l.apply(this, arguments);
  };
}
function gbModeSet(v) {
  S.gbMode = v;
  srcOpen();
}
{
  const _s = srcDetail;
  srcDetail = function (tab, k) {
    const h = _s.apply(this, arguments);
    if (tab !== 'gb') return h;
    const m = S.gbMode || 'auto',
      can = S.geo && GEO.snap && !TB.busy && !GEO.busy;
    return (
      `<div class="opt" style="margin:0 0 8px;padding:6px 8px"><b>Gebäudemodell im Projekt</b><div style="margin:4px 0"><select onchange="gbModeSet(this.value)" style="max-width:100%">${GBM.map(([v, n]) => `<option value="${v}"${v === m ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select> <button class="sm"${can ? '' : ' disabled'} onclick="srReload('gb')" title="Lädt nur die Gebäude mit der gewählten Quelle neu, geplante Gebäude bleiben erhalten">Gebäudemodell jetzt neu laden</button></div><div class="stn" style="margin:0">Ist das geladene Modell nicht aktuell genug, z. B. LoD2 aus einem älteren Kachelstand, hier auf LoD1 oder OSM umstellen und neu laden. Die Wahl wird mit dem Projekt gespeichert${can ? '' : ' (Neu laden: erst ein Projekt mit Umgebung öffnen)'}.</div></div>` +
      h
    );
  };
}
