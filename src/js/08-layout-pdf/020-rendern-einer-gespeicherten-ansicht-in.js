// ---- Rendern einer gespeicherten Ansicht in beliebiger Pixelgröße
function layCam(v, w, h) {
  let cm;
  if (v.m3) {
    pc.aspect = w / h;
    pc.updateProjectionMatrix();
    pc.position.set(
      v.tx + v.d * Math.sin(v.pol) * Math.sin(v.az),
      v.d * Math.cos(v.pol),
      v.tz + v.d * Math.sin(v.pol) * Math.cos(v.az),
    );
    pc.lookAt(v.tx, 0, v.tz);
    if (v.cx)
      try {
        camxApply(pc, v, w / h, Object.assign({ on: true }, v.cx));
      } catch (e) {
        logErr(e, 'layCam');
      }
    cm = pc;
  } else {
    const a = w / h,
      hh = v.d * 0.6;
    Object.assign(oc, { left: -hh * a, right: hh * a, top: hh, bottom: -hh });
    oc.updateProjectionMatrix();
    oc.position.set(v.tx, 800, v.tz);
    oc.up.set(Math.sin(v.rot), 0, -Math.cos(v.rot));
    oc.lookAt(v.tx, 0, v.tz);
    cm = oc;
  }
  cm.updateMatrixWorld(true);
  return cm;
}
function layProj(v, w, h) {
  const cm = layCam(v, w, h),
    q = new T.Vector3();
  return (p) => {
    q.set(p[0], p[1], p[2]);
    q.project(cm);
    if (q.z > 1 || q.z < -1) return null;
    return [((q.x + 1) / 2) * w, ((1 - q.y) / 2) * h];
  };
}
// wirksame Ansicht im Layout: fixierte 2D-Ansicht -> Ausschnitt aus Maßstab und Rahmenhöhe
function layV(e, ih) {
  const v = e.v || {};
  if (v.locked && !v.m3) {
    const sc = +e.sc || v.sc || 1000;
    return { ...v, d: (sc * ih) / 1200, sc };
  }
  return v;
}
function layScale(v, w, ih, e) {
  const o = [];
  if (!(v.locked && !v.m3 && v.sc) || w < 40 || ih < 24) return o;
  const sc = v.sc,
    mmPerM = 1000 / sc;
  let L = 1;
  for (const c of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) {
    if (c * mmPerM <= 45) L = c;
  }
  const bw = L * mmPerM,
    x0 = 3,
    y1 = ih - 3,
    bgH = e.sbar !== false ? 10 : 5,
    bgW = e.sbar !== false ? Math.max(bw + 12, 26) : 22;
  o.push({
    t: 'path',
    pts: [
      [x0, y1 - bgH],
      [x0 + bgW, y1 - bgH],
      [x0 + bgW, y1],
      [x0, y1],
    ],
    closed: true,
    stroke: null,
    w: 0,
    dash: [],
    fill: '#ffffff',
    fa: 1,
  });
  if (e.scl !== false)
    o.push({
      t: 'text',
      x: x0 + 2,
      y: y1 - bgH + 3.7,
      s: 'M 1:' + sc,
      pt: 3 / LAYC,
      size: 3,
      c: '#1d1d1b',
      b: true,
      al: 'l',
    });
  if (e.sbar !== false) {
    const bx = x0 + 2,
      by = y1 - 4.3,
      bh = 1.3,
      n = 4;
    for (let i = 0; i < n; i++)
      o.push({
        t: 'path',
        pts: [
          [bx + (bw * i) / n, by],
          [bx + (bw * (i + 1)) / n, by],
          [bx + (bw * (i + 1)) / n, by + bh],
          [bx + (bw * i) / n, by + bh],
        ],
        closed: true,
        stroke: '#1d1d1b',
        w: 0.18,
        dash: [],
        fill: i % 2 ? '#ffffff' : '#1d1d1b',
        fa: 1,
      });
    [
      [0, '0'],
      [0.5, String(L / 2).replace('.', ',')],
      [1, L + ' m'],
    ].forEach(([f, s]) =>
      o.push({
        t: 'text',
        x: bx + bw * f,
        y: y1 - 0.7,
        s,
        pt: 2.2 / LAYC,
        size: 2.2,
        c: '#1d1d1b',
        b: false,
        al: 'c',
      }),
    );
  }
  return o;
}
function layShot(v, w, h, q) {
  const ds = v && v.ds;
  let back = null;
  try {
    if (ds) back = vwDsSwap(ds);
    return layShot0(v, w, h, q);
  } finally {
    if (back) {
      vwApplyDs(back, true);
      vwDsUi();
    }
  }
}
function layShot0(v, w, h, q) {
  const hid = [so, hl, hlB, sl, sq, hc, handle, vg, dl, dlH, fdL, G.pv].filter(Boolean),
    vs = hid.map((o) => o.visible);
  hid.forEach((o) => (o.visible = false));
  const t2 = GEO.t2d ? GEO.t2d.visible : null;
  if (GEO.t2d) GEO.t2d.visible = !v.m3;
  const ps = ren.getSize(new T.Vector2()),
    pr = ren.getPixelRatio();
  let url = '';
  try {
    ren.setPixelRatio(1);
    ren.setSize(w, h, false);
    const cm = layCam(v, w, h);
    mkRender(sc, cm);
    url = ren.domElement.toDataURL('image/jpeg', q);
  } finally {
    ren.setPixelRatio(pr);
    ren.setSize(ps.x, ps.y);
    hid.forEach((o, i) => (o.visible = vs[i]));
    if (GEO.t2d && t2 != null) GEO.t2d.visible = t2;
  }
  return url;
}
// ---- Vorschau
let layQ = [],
  layBusy = false;
const layK = () => {
  const [pw, ph] = layPage(),
    st = $('layStage');
  return Math.max(0.2, Math.min((st.clientWidth - 48) / pw, (st.clientHeight - 48) / ph) * LAY.zoom);
};
function layPx(e, k) {
  const it = layItems(e, 1),
    ev = layV(e, it.ih),
    wpx = Math.min(2048, Math.max(256, Math.ceil((e.w * k * 1.25) / 256) * 256));
  return {
    wpx,
    hpx: Math.max(64, Math.round((wpx * it.ih) / e.w)),
    key: JSON.stringify({ ...ev, anns: 0 }) + '|' + wpx + 'x' + Math.round((it.ih / e.w) * 1000),
  };
}
function layShootReq(e) {
  if (!layQ.includes(e)) layQ.push(e);
  if (!layBusy) {
    layBusy = true;
    setTimeout(layPump, 30);
  }
}
function layPump() {
  const e = layQ.shift();
  if (!e) {
    layBusy = false;
    return;
  }
  if (!LAY.open || !LAY.els.includes(e)) {
    setTimeout(layPump, 5);
    return;
  }
  try {
    const p = layPx(e, layK());
    if (e._ik !== p.key) {
      e._img = layShot(layV(e, layItems(e, 1).ih), p.wpx, p.hpx, 0.85);
      e._ik = p.key;
      const im = document.querySelector('#laySheet [data-id="' + e.id + '"] img');
      if (im) {
        im.src = e._img;
        im.style.opacity = 1;
      }
    }
  } catch (err) {
    console.warn(err);
  }
  setTimeout(layPump, 30);
}
function layRender() {
  const sh = $('laySheet');
  if (!sh) return;
  const [pw, ph] = layPage(),
    k = layK();
  sh.style.width = pw * k + 'px';
  sh.style.height = ph * k + 'px';
  sh.innerHTML = '';
  const mg = document.createElement('div');
  mg.style.cssText = `position:absolute;left:${10 * k}px;top:${10 * k}px;right:${10 * k}px;bottom:${10 * k}px;border:1px dashed #0000001f;pointer-events:none`;
  sh.appendChild(mg);
  LAY.els.forEach((e) => {
    const it = layItems(e);
    if (e.type !== 'view' && e.type !== 'box') e.h = it.h;
    const d = document.createElement('div');
    d.className = 'lel' + (LAY.sel === e.id ? ' sel' : '');
    d.dataset.id = e.id;
    d.style.cssText = `left:${e.x * k}px;top:${e.y * k}px;width:${e.w * k}px;height:${Math.max(e.h, 2) * k}px`;
    if (e.type === 'pic') {
      const im = document.createElement('img');
      im.draggable = false;
      im.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${it.ih * k}px;object-fit:fill;background:#E9EDEF`;
      try {
        const u = lpGet(e, k);
        if (u) im.src = u;
      } catch (x) {
        console.warn(x);
      }
      d.appendChild(im);
    }
    if (e.type === 'view') {
      const im = document.createElement('img');
      im.draggable = false;
      im.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${it.ih * k}px;object-fit:fill;background:#e9e8e4;opacity:${e._img ? 1 : 0.4}`;
      if (e._img) im.src = e._img;
      d.appendChild(im);
      if (it.an && it.an.length) {
        const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        sv.setAttribute('viewBox', `0 0 ${e.w} ${it.ih}`);
        sv.setAttribute('preserveAspectRatio', 'none');
        sv.style.cssText = `position:absolute;left:0;top:0;width:100%;height:${it.ih * k}px;pointer-events:none;overflow:hidden`;
        sv.innerHTML = anSvg(it.an);
        d.appendChild(sv);
      }
      const p = layPx(e, k);
      if (e._ik !== p.key) layShootReq(e);
    }
    it.r.forEach((q) => layRectDiv(q, e, k, d));
    it.t.forEach((q) => {
      const x = document.createElement('div');
      x.textContent = q.s;
      const tr = q.al === 'r' ? 'translateX(-100%)' : q.al === 'c' ? 'translateX(-50%)' : 'none';
      x.style.cssText = `position:absolute;left:${(q.x - e.x) * k}px;top:${(q.y - e.y - LAYBO * q.pt * LAYC) * k}px;white-space:pre;transform:${tr};font:${q.b ? 'bold ' : ''}${q.pt * LAYC * k}px/${LAYLH * q.pt * LAYC * k}px ${lfCss(q.f)};font-kerning:none;color:${q.c || '#1d1d1b'};pointer-events:none`;
      d.appendChild(x);
    });
    if (LAY.sel === e.id) {
      const h = document.createElement('div');
      h.className = 'lh' + (e.type === 'view' || e.type === 'box' ? '' : ' r');
      d.appendChild(h);
    }
    sh.appendChild(d);
  });
}
function layProp() {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/100-eigenschaften.js
  (() => {
    const el = $('layProp'),
      e = layEl(LAY.sel);
    if (!e) {
      el.innerHTML =
        '<h4>Layout</h4><div style="color:var(--mu)">Element anklicken zum Bearbeiten, ziehen zum Verschieben. Elemente oben in der Leiste hinzufügen.<br><br>Ansichten speicherst du im Hauptfenster unter „Ansichten“.</div>';
      return;
    }
    const N = (k, l, st) =>
        `<label class="lp">${l}<input type="number" step="${st || 1}" value="${Math.round(e[k] * 10) / 10}" onchange="layPut('${k}',+this.value)"></label>`,
      S2 = (k, l, o) =>
        `<label class="lp">${l}<select onchange="layPut('${k}',this.value)">${o.map(([v, t]) => `<option value="${v}" ${e[k] == v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`,
      C = (k, l) =>
        `<label class="lp">${l}<input type="checkbox" ${e[k] ? 'checked' : ''} onchange="layPut('${k}',this.checked)"></label>`;
    let h = `<h4>${{ view: 'Ansicht', pic: 'Zeichnung', head: 'Überschrift', text: 'Fließtext', info: 'Kennzahlen', legend: 'Legende' }[e.type]}</h4>`;
    if (e.type === 'view') {
      h +=
        `<label class="lp">Ansicht<select onchange="layView(this.value)"><option value="">${esc(e.name || 'Aktuelle Kamera')}</option>${S.views.map((v, i) => `<option value="${i}">${esc(v.name)} (${v.m3 ? '3D' : '2D'})</option>`).join('')}</select></label>${C('border', 'Rahmen')}${C('cap', 'Beschriftung')}` +
        (e.cap ? N('size', 'Schriftgröße (pt)') : '') +
        `${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}${N('h', 'Höhe (mm)')}<button class="sm" style="margin-top:6px" onclick="layRefresh()">Bild neu rendern</button>` +
        layLockProp(e);
    } else if (e.type === 'pic') {
      h +=
        `<label class='lp'>Quelle<select onchange='layPicSrc(this.value)' style='max-width:150px'><option value=''>${esc(e.name || 'Zeichnung')}</option>${lpSources()
          .map((q) => `<option value='${esc(q.k)}' ${q.k === e.pk ? 'selected' : ''}>${esc(q.t)}</option>`)
          .join('')}</select></label>${C('border', 'Rahmen')}${C('cap', 'Beschriftung')}` +
        (e.cap ? N('size', 'Schriftgröße (pt)') : '') +
        `${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}<div style='color:var(--mu);font-size:11px;margin-top:4px'>Live aus dem Grundriss- bzw. Ansichtstool; Änderungen dort erscheinen hier automatisch.</div>`;
    } else if (e.type === 'head' || e.type === 'text') {
      h += `<textarea oninput="layPut('text',this.value,1)" rows="${e.type === 'head' ? 3 : 8}" style="width:100%;box-sizing:border-box">${esc(e.text || '')}</textarea>${N('size', 'Schriftgröße (pt)')}${e.type === 'text' ? C('bold', 'Fett') : ''}${S2(
        'align',
        'Ausrichtung',
        [
          ['l', 'Links'],
          ['c', 'Mitte'],
          ['r', 'Rechts'],
        ],
      )}${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}`;
    } else if (e.type === 'info') {
      h += `<label class="lp">Titel<input type="text" value="${esc(e.title || '')}" oninput="layPut('title',this.value,1)" style="width:130px"></label>${C('perB', 'Je Gebäude aufteilen')}${C('flr', 'Geschosse auflisten')}<label class="lp">Flurstücke zeigen<input type="checkbox" ${e.fln !== false ? 'checked' : ''} onchange="layPut('fln',this.checked)"></label>${LAYK.map(([k, l]) => `<label class="lp" style="margin:1px 0">${l}<input type="checkbox" ${(e.keys || []).includes(k) ? 'checked' : ''} onchange="layKey('${k}',this.checked)"></label>`).join('')}${N('size', 'Schriftgröße (pt)')}${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}<div style="color:var(--mu);font-size:11px;margin-top:4px">Werte aller Gebäude im Projekt (live aus der Analyse).</div>`;
    } else if (e.type === 'legend') {
      h += `<label class="lp">Titel<input type="text" value="${esc(e.title || '')}" oninput="layPut('title',this.value,1)" style="width:130px"></label>${C('bgf', 'BGF anzeigen')}${C('bri', 'BRI anzeigen')}${C('perB', 'Je Gebäude aufteilen')}${N('size', 'Schriftgröße (pt)')}${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}`;
    }
    if (e.type !== 'view' || e.cap || e.capSc) {
      h += `<label class="lp">Schrift<select onchange="layPut('font',this.value||null)" style="max-width:130px">${layFontOpts(null, e.font || '', `wie Layout (${(LFOPT.find((x) => x[0] === LAY.font) || [0, 'Helvetica'])[1]})`)}</select></label>`;
      const fo = layFo(e);
      if (lfOk(fo) && LFONT[fo].s && LFONT[fo].s !== LFONT[fo].n)
        h += `<div style="color:var(--mu);font-size:11px">${LFONT[fo].n} ist lizenzpflichtig; verwendet wird die freie Ersatzschrift ${LFONT[fo].s}.</div>`;
    }
    h += `<div style="display:flex;gap:6px;margin-top:8px"><button class="sm" onclick="layDup()">Duplizieren</button><button class="sm" onclick="layDel()" style="color:var(--wa)">Löschen</button></div>`;
    el.innerHTML = h;
  })();
  try {
    layProp2();
  } catch (err) {
    console.warn('layProp2', err);
  }
}
function layLockProp(e) {
  const v = e.v || {};
  if (!v.locked)
    return '<div style="color:var(--mu);font-size:11px;margin-top:6px">Ansicht ist nicht fixiert: kein Maßstab, keine Anmerkungen. Im Hauptfenster die gespeicherte Ansicht aufrufen und mit 🔒 fixieren.</div>';
  const ck = (k, l) =>
    `<label class="lp">${l}<input type="checkbox" ${e[k] !== false ? 'checked' : ''} onchange="layPut('${k}',this.checked)"></label>`;
  return (
    `<div style="margin-top:6px;border-top:1px solid var(--ln);padding-top:6px">🔒 fixierte Ansicht` +
    (v.m3
      ? '<div style="color:var(--mu);font-size:11px">Perspektivisch: kein Maßstab.</div>'
      : `<label class="lp">Maßstab<select onchange="layPut('sc',this.value?+this.value:null)"><option value="">wie Ansicht (1:${v.sc})</option>${ANSC.map((n) => `<option value="${n}" ${+e.sc === n ? 'selected' : ''}>1:${n}</option>`).join('')}</select></label><label class="lp">Maßstab als Text (rechts)<input type="checkbox" ${e.capSc ? 'checked' : ''} onchange="layPut('capSc',this.checked)"></label>`) +
    `<div style="color:var(--mu);font-size:11px;margin-top:4px">${(v.anns || []).length} Anmerkungen · live aus dem Modell; Änderungen beim nächsten Öffnen des Layouts.</div></div>`
  );
}
function laySync() {
  LAY.els.forEach((e) => {
    if (e.type !== 'view') return;
    const nm = e.vn || e.name,
      v = nm && S.views.find((x) => x.name === nm);
    if (!v) return;
    e.vn = nm;
    e.v = JSON.parse(JSON.stringify(v));
    delete e.v.name;
    e.name = v.name;
    e._ik = null;
  });
  laySave();
}
function layPut(k, v, noPanel) {
  const e = layEl(LAY.sel);
  if (!e) return;
  const mn = e.type === 'box' ? 1 : 10;
  if (k === 'w') v = Math.max(mn, v);
  if (k === 'h') v = Math.max(mn, v);
  e[k] = v;
  if ((k === 'sc' || k === 'font') && !v) delete e[k];
  laySave();
  layRender();
  if (!noPanel && (k === 'cap' || k === 'align')) layProp();
}
function layKey(k, on) {
  const e = layEl(LAY.sel);
  if (!e) return;
  const s = new Set(e.keys || []);
  on ? s.add(k) : s.delete(k);
  e.keys = LAYK.map((x) => x[0]).filter((x) => s.has(x));
  laySave();
  layRender();
}
function layView(i) {
  const e = layEl(LAY.sel);
  if (!e || i === '') return;
  const v = S.views[+i];
  if (!v) return;
  e.v = JSON.parse(JSON.stringify(v));
  delete e.v.name;
  e.name = v.name;
  e.vn = v.name;
  delete e.sc;
  e._ik = null;
  laySave();
  layRender();
  layProp();
}
function layRefresh() {
  const e = layEl(LAY.sel);
  if (!e) return;
  e._ik = null;
  layRender();
}
function layAdd(type, v, name) {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/090-layouter.js
  if (type !== 'box' && type !== 'board')
    return (() => {
      const [pw, ph] = layPage(),
        id = 'e' + ++LAY.n,
        b = { id, type, x: 15 + (LAY.els.length % 6) * 4, y: 15 + (LAY.els.length % 6) * 4 };
      if (type === 'head')
        Object.assign(b, {
          text: (S.project && S.project.name) || 'Überschrift',
          size: 28,
          w: Math.min(pw - 30, 200),
          align: 'l',
        });
      else if (type === 'text')
        Object.assign(b, {
          text: 'Fließtext eingeben …',
          size: 10,
          w: Math.min(90, pw - 30),
          align: 'l',
          bold: false,
        });
      else if (type === 'info')
        Object.assign(b, {
          title: 'Kennzahlen',
          keys: ['bgf', 'bri', 'fas', 'dach', 'hmax'],
          perB: true,
          flr: false,
          size: 10,
          w: 70,
        });
      else if (type === 'legend')
        Object.assign(b, { title: 'Legende', bgf: true, bri: false, perB: false, size: 10, w: 70 });
      else if (type === 'pic')
        Object.assign(b, {
          pk: v,
          name: name || 'Zeichnung',
          w: Math.round(Math.min(pw * 0.5, 180)),
          border: false,
          cap: true,
          size: 9,
        });
      else if (type === 'view')
        Object.assign(b, {
          v: v || vwState(),
          name: name || 'Aktuelle Ansicht',
          w: Math.round(pw * 0.5),
          h: Math.round(ph * 0.5),
          border: true,
          cap: false,
          size: 9,
        });
      LAY.els.push(b);
      LAY.sel = id;
      laySave();
      layRender();
      layProp();
    })();
  const [pw, ph] = layPage(),
    id = 'e' + ++LAY.n,
    kd = layKd(),
    b = { id, type, x: 15 + (LAY.els.length % 6) * 4, y: 15 + (LAY.els.length % 6) * 4 };
  if (type === 'box') Object.assign(b, { w: 60, h: 30, fc: '#E9EDEF', fa: 1, rx: 0, bw: kd.w, bc: kd.c });
  else
    Object.assign(b, {
      w: 80,
      size: 9,
      big: 20,
      perB: true,
      gr: true,
      title: '',
      bg: '#ffffff',
      fa: 1,
      bo: true,
      bw: kd.w,
      bc: kd.c,
      rx: 2,
      pad: 3,
      x: 20,
      y: 20,
    });
  if (type === 'box') LAY.els.unshift(b);
  else LAY.els.push(b);
  LAY.sel = id;
  laySave();
  layRender();
  layProp();
}
function layAddView(i) {
  const sel = $('layAddV');
  if (i === '') return;
  if (i === 'cur') layAdd('view', vwState(), 'Aktuelle Ansicht');
  else {
    const v = S.views[+i];
    if (v) {
      const c = JSON.parse(JSON.stringify(v));
      delete c.name;
      layAdd('view', c, v.name);
      layEl(LAY.sel).vn = v.name;
    }
  }
  sel.selectedIndex = 0;
}
function layDel() {
  const e = layEl(LAY.sel);
  if (!e) return;
  LAY.els = LAY.els.filter((x) => x !== e);
  LAY.sel = null;
  laySave();
  layRender();
  layProp();
}
function layDup() {
  const e = layEl(LAY.sel);
  if (!e) return;
  const c = { ...e, id: 'e' + ++LAY.n, x: e.x + 6, y: e.y + 6 };
  delete c._img;
  delete c._ik;
  LAY.els.push(c);
  LAY.sel = c.id;
  laySave();
  layRender();
  layProp();
}
function layFmt(v) {
  LAY.fmt = v;
  laySave();
  layRender();
}
function layOri(v) {
  LAY.ori = v;
  laySave();
  layRender();
}
function layZoom(d) {
  LAY.zoom = d === 0 ? 1 : Math.max(0.3, Math.min(3, LAY.zoom * (d > 0 ? 1.2 : 1 / 1.2)));
  layRender();
}
function layFontOpts(sel, cur, first) {
  return (
    (first ? `<option value=>${first}</option>` : '') +
    LFOPT.map(
      ([k, n]) =>
        `<option value="${k}" ${cur === k ? 'selected' : ''} style="font-family:${lfCss(k)}">${n}</option>`,
    ).join('')
  );
}
function layFontSet(v) {
  LAY.font = v;
  laySave();
  layRender();
  layProp();
}
function layOpen() {
  LAY.open = true;
  laySync();
  $('layFontS').innerHTML = layFontOpts($('layFontS'), LAY.font);
  $('lay').style.display = 'flex';
  const fs = $('layFmt');
  if (!fs.options.length)
    fs.innerHTML = Object.keys(LAYF)
      .map((k) => `<option>${k}</option>`)
      .join('');
  fs.value = LAY.fmt;
  $('layOriS').value = LAY.ori;
  $('layAddV').innerHTML =
    '<option value="">+ Ansicht …</option><option value="cur">Aktuelle Kameraposition</option>' +
    S.views.map((v, i) => `<option value="${i}">${esc(v.name)} (${v.m3 ? '3D' : '2D'})</option>`).join('');
  if (!LAY.els.length && !LAY.init) {
    LAY.init = 1;
    const [pw, ph] = layPage();
    layAdd('head');
    const h = layEl(LAY.sel);
    h.x = 15;
    h.y = 12;
    h.w = pw - 30;
    if (S.views.length) {
      const v = S.views[0],
        c = JSON.parse(JSON.stringify(v));
      delete c.name;
      layAdd('view', c, v.name);
      layEl(LAY.sel).vn = v.name;
      const e = layEl(LAY.sel);
      e.x = 15;
      e.y = 34;
      e.w = Math.round(pw * 0.64);
      e.h = Math.round(ph - 34 - 15);
    }
    layAdd('legend');
    let e = layEl(LAY.sel);
    e.x = Math.round(pw * 0.64) + 25;
    e.y = 34;
    e.w = pw - e.x - 15;
    layAdd('info');
    e = layEl(LAY.sel);
    e.x = Math.round(pw * 0.64) + 25;
    e.y = 80;
    e.w = pw - e.x - 15;
    LAY.sel = null;
  }
  setTimeout(() => {
    layRender();
    layProp();
  }, 30);
  // ── Erweiterung aus 24-erweiterungen-v344-v436/030-zeichnungen-aus-grundriss.js (danach)
  try {
    lpOpts();
  } catch (e) {
    logErr(e, 'layOpen');
  }
}
function layClose() {
  LAY.open = false;
  $('lay').style.display = 'none';
}
