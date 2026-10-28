// Kennwerte
function kw(b) {
  const c = cen(b.fp),
    p = P.find((a) => inP(c, a.poly)) || AL.find((a) => !a.cut && inP(c, a.poly));
  if (!p) return null;
  const inP2 = S.bld.filter((x) => inP(cen(x.fp), p.poly)).concat(S.ex.filter((x) => inP(cen(x.fp), p.poly)));
  const A = area(p.poly),
    fp = inP2.reduce((s, x) => s + larea(x, x.levels[0]), 0),
    bgf = inP2.reduce((s, x) => s + bgfOf(x), 0);
  return { p, A, fp, bgf, grz: fp / A, gfz: inP2.reduce((s, x) => s + bgfOiOf(x), 0) / A };
}
// Schnittfläche zweier beliebiger Polygone (exakt, Streifenverfahren)
function polyInter(A, B) {
  const xs = new Set();
  A.forEach((p) => xs.add(p[0]));
  B.forEach((p) => xs.add(p[0]));
  for (let i = 0; i < A.length; i++) {
    const a = A[i],
      b = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      const c = B[j],
        d = B[(j + 1) % B.length],
        r = [b[0] - a[0], b[1] - a[1]],
        q = [d[0] - c[0], d[1] - c[1]],
        den = r[0] * q[1] - r[1] * q[0];
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den,
        u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) xs.add(a[0] + t * r[0]);
    }
  }
  const X = [...xs].sort((p, q) => p - q),
    iv = (P, x) => {
      const ys = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i],
          b = P[(i + 1) % P.length];
        if (a[0] <= x !== b[0] <= x) ys.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      }
      ys.sort((p, q) => p - q);
      const o = [];
      for (let i = 0; i + 1 < ys.length; i += 2) o.push([ys[i], ys[i + 1]]);
      return o;
    };
  let tot = 0;
  for (let k = 0; k + 1 < X.length; k++) {
    const w = X[k + 1] - X[k];
    if (w < 1e-9) continue;
    const xm = (X[k] + X[k + 1]) / 2,
      ia = iv(A, xm),
      ib = iv(B, xm);
    let l = 0;
    for (const p of ia)
      for (const q of ib) {
        const o = Math.min(p[1], q[1]) - Math.max(p[0], q[0]);
        if (o > 0) l += o;
      }
    tot += l * w;
  }
  return tot;
}
// Freie Flächen (Grün, Platz, Wasser) auf dem Grundstück, je Art
function areaOnPlot(poly) {
  const o = {};
  for (const a of S.areas || []) {
    const m = polyInter(a.poly, poly);
    if (m < 0.05) continue;
    const t = AT[a.type] ? a.type : 'green';
    o[t] = (o[t] || 0) + m;
  }
  return Object.keys(AT)
    .filter((t) => o[t])
    .map((t) => ({ t, n: AT[t].n, c: AT[t].c(), a: o[t] }));
}
function arKv(k) {
  try {
    return areaOnPlot(k.p.poly)
      .map((x) =>
        kv(
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${x.c}"></span>${x.n}`,
          f1(x.a) + ' m² · ' + f1((x.a / k.A) * 100, 1) + ' %',
        ),
      )
      .join('');
  } catch (_) {
    return '';
  }
}
// Panels
const USES = ['Wohnen', 'Büro', 'Gewerbe', 'Sonstiges'];
S.uses = { Wohnen: '#bfd4e8', Büro: '#bccbd6', Gewerbe: '#dcc6b0', Sonstiges: '#cdd5bd' };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function rn(v) {
  hist();
  S.sel.name = v.trim() || S.sel.id;
  rr();
}
function ru(v, id) {
  const b = id ? S.bld.find((x) => x.id === id) : S.sel;
  if (!b || b.ex) return;
  hist();
  b.use = v;
  b.levels.forEach((l) => {
    delete l.use;
  });
  if (b.roof) delete b.roof.use;
  mesh(b);
  H();
  hpos();
  rr();
}
function useSel(b, cls) {
  const m = new Set(b.levels.map((l) => lUse(b, l)));
  if (b.roof && b.roof.type && b.roof.type !== 'flat') m.add(roofUse(b));
  const one = m.size === 1 ? [...m][0] : null;
  return `<select style="width:100%" onchange="ru(this.value,'${b.id}')">${one ? '' : '<option value="" selected disabled>gemischt – Nutzung wählen …</option>'}${USES.map((u) => `<option ${u === one ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
}
function lgSel(id) {
  const b = S.bld.find((x) => x.id === id);
  if (!b || b.ex) return;
  S.sel = b;
  S.selF = null;
  S.selP = null;
  S.roofSel = null;
  S.selA = null;
  S.multi = [];
  S.multiA = [];
  S.tab = 'Planen';
  H();
  hpos();
  nav();
  rr();
}
function uc(k, v) {
  S.uses[k] = v;
  S.bld.forEach(mesh);
  H();
  hpos();
}
function lgUpd() {
  const e = $('lg');
  if (!e) return;
  const h = legend();
  e.innerHTML = h;
  e.style.display = h ? '' : 'none';
}
function legend() {
  const bl = S.bld.filter((b) => !b.ex),
    used = USES.filter((u) => bl.some((b) => useAgg(b)[u]));
  if (!used.length) return '';
  return (
    '<h4>Legende</h4><div class="card">' +
    used
      .map((u) => {
        const g = bl.reduce((t, b) => t + (useAgg(b)[u] ? useAgg(b)[u].a : 0), 0);
        return `<div class="kv" style="align-items:center"><span><input type="color" value="${S.uses[u]}" oninput="uc('${u}',this.value)" title="Farbe der Nutzung" style="width:26px;height:20px;padding:0;border:0;vertical-align:middle;background:none;cursor:pointer"> ${u}</span><b>${f1(g)} m² BGF</b></div>`;
      })
      .join('') +
    '</div>'
  );
}
const TABS = ['Planen', 'Analyse', 'Varianten', 'Export', 'Kontext'];
const IC = { Kontext: '◧', Planen: '✎', Analyse: '▥', Varianten: '⧉', Export: '⇩' };
function nav() {
  $('tabs').innerHTML =
    TABS.map(
      (t) =>
        `<button class="tab ${S.tab == t ? 'on' : ''}" onclick="go('${t}')"><i>${IC[t]}</i>${t === 'Kontext' ? 'Datenebenen' : t === 'Analyse' ? 'Grundstück und Umgebung' : t}</button>`,
    ).join('') +
    '<button class="tab" id="bly" onclick="layOpen()" title="Seitenlayout mit Ansichten, Kennzahlen, Legende und Texten als PDF"><i>▤</i>Layout</button>';
  // ── Erweiterung aus 16-darstellung-erweitert/050-darstellung-der-fanglinien-im-3d.js (danach)
  thMap();

  // ── Erweiterung aus 18-erweiterungen-v280-v325/110-administrationsansicht.js (danach)
  try {
    if (admIs()) {
      const t = $('tabs');
      if (t && !$('badm'))
        t.insertAdjacentHTML(
          'beforeend',
          '<button class="tab' +
            ($('admp') && $('admp').style.display === 'block' ? ' on' : '') +
            '" id="badm" onclick="admToggle()" title="Voreinstellungen für alle Anwender, Startansicht, Demokarte"><i>⚙</i>Admin</button>',
        );
    }
  } catch (e) {
    logErr(e, 'nav');
  }
}
function go(t) {
  // ── Erweiterung aus 16-darstellung-erweitert/050-darstellung-der-fanglinien-im-3d.js
  // Reiter-/Seitenwechsel: Panel-Zustand und Symbolbeschriftungen nachführen
  document.body.classList.remove('rpShut');
  S.tab = t;
  nav();
  rr();
  // ── Erweiterung aus 16-darstellung-erweitert/050-darstellung-der-fanglinien-im-3d.js (danach)
  thMap();
}
const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
function rr() {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/080-panel.js
  const R = $('pc');
  if (S.tab === 'Import') {
    if (!R.dataset.imp || IMP.dirty) impRender();
    return;
  }
  if (R && R.dataset.imp) delete R.dataset.imp;
  return (() => {
    if (S.hlk && S.tab !== 'Analyse' && !S.hlw) hlClear(1);
    envBuild();
    const R = $('pc'),
      b = S.sel;
    let h = '';
    if (S.tab == 'Kontext') {
      h =
        `${ocHtml()}` +
        (AL.length
          ? ''
          : '<h4>Parzelle</h4>' +
            (S.par
              ? kv('Flurstück', S.par.id) + kv('Fläche', f1(area(S.par.poly)) + ' m²')
              : '<div style="color:var(--mu)">Grundstück anklicken</div>')) +
        ctxInfo() +
        treeInfo() +
        (S.ex.length ? `<h4>Bestand</h4>` : '') +
        S.ex
          .map(
            (x) =>
              `<div class="card">${x.use} · ${x.levels.length} Geschosse<br>Höhe ${f1(x.levels.length * 3, 1)} m <span class="wa">(geschätzt)</span><br><span style="color:var(--mu)">Quelle: ${x.src}</span></div>`,
          )
          .join('');
    } else if (S.tab == 'Planen') {
      if (S.tool === 'f' && !S.closed) h = shapePanel();
      else if (S.closed && S.dm === 'area') h = areaForm();
      else if (S.closed)
        h = `<h4>Neues Gebäude</h4><div class="card">${kv('Grundfläche', f1(area(S.draft)) + ' m²')}${S.refH != null ? kv('Bezugshöhe ±0', realH(S.refH)) : ''}Name<input id="nn" type="text" value="Gebäude ${S.n}">Nutzung<select id="nu" style="width:100%">${USES.map((u) => `<option>${u}</option>`).join('')}</select>Geschosse<input id="ng" type="number" min="1" max="30" value="4">Untergeschosse<input id="nug" type="number" min="0" max="5" value="0">Geschosshöhe (m)<input id="gh" type="number" step="0.1" value="3.0">Dach<select id="nd" style="width:100%" onchange="roofUi()">${RT.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><div id="ndw" style="display:none">Neigung (°)<input id="na" type="number" min="1" max="75" value="35">Drempelhöhe (m)<input id="ndr" type="number" min="0" max="3" step="0.05" value="0"></div><button class="pri" onclick="mk()">Gebäude erzeugen</button><button class="sm" style="margin-top:6px" onclick="cancel();rr()">Verwerfen</button></div>`;
      else if (b && !b.ex) {
        const PXM = pxMet(b);
        let z = -(b._ug || 0);
        const sf = selOk(),
          sk = sf && sf.b === b ? sf.k : -1;
        h =
          `<h4>Gebäude</h4>${refInp(b)}Name<input type="text" value="${esc(b.name || b.id)}" onchange="rn(this.value)"><h4>Auswertung</h4><div class="card">${kv('Grundfläche (EG)', f1(larea(b, b.levels[0]) + (PXM.lv[0] || 0)) + ' m²')}${kv('BGF', f1(bgfOf(b)) + ' m²')}${kv('Höhe (inkl. Dach)', f1(b._h + (b._roofH || 0), 2) + ' m')}${kv('Geschosse', b.levels.length)}</div>${ruleCard(b)}${roofCard(b)}${patchCard()}<h4>Nutzung</h4><div class="card" style="padding:8px 10px"><div style="color:var(--mu);font-size:11px;margin-bottom:4px">Für alle Geschosse und das Dach setzen (überschreibt einzelne Nutzungen)</div>${useSel(b)}</div><h4>Geschosse</h4>` +
          roofRow(b) +
          b.levels
            .map((l, i) => {
              const r = `<div class="lr${sk === i ? ' on' : ''}" data-k="${i}" onfocusin="selL(${i})" onclick="selL(${i})" style="display:grid;grid-template-columns:44px minmax(58px,1fr) 58px 24px 24px 24px;gap:4px;align-items:center;margin-bottom:4px;padding:2px 4px;border-radius:6px"><b><span title="${esc(l.use || b.use || 'Wohnen')}" style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;background:${S.uses[l.use || b.use || 'Wohnen']}"></span>${l.name}</b><input type="number" step="0.1" min="2" value="${l.h}" onchange="lh(${i},this.value)"><span style="color:var(--mu);font-size:11px;line-height:1.2">${z < 0 ? '' : '+'}${f1(z, 2)}<br>${f1(larea(b, l) + (PXM.lv[i] || 0))} m²</span>${l.fp ? `<button class="sm" title="Grundriss zurücksetzen" onclick="lr(${i})">↺</button>` : '<span></span>'}<button class="sm" title="${l.ug ? 'Geschoss nach unten kopieren' : 'Geschoss nach oben kopieren'}" aria-label="Geschoss kopieren" onclick="event.stopPropagation();lcp(${i})">${l.ug ? '⇣' : '⇡'}</button><button class="sm" title="Geschoss löschen" aria-label="Geschoss löschen" onclick="event.stopPropagation();lrm(${i})">✕</button><button class="pri lrx" style="grid-column:1/-1;margin:2px 0;${sk === i ? '' : 'display:none'}" onclick="event.stopPropagation();grOpenLv('${esc(b.id)}','${i}')">▦ Grundriss öffnen</button><label class="lrx" style="grid-column:1/-1;display:${sk === i ? 'flex' : 'none'};gap:6px;align-items:center;font-size:11px;color:var(--mu)">Nutzung<select style="flex:1" onchange="lUseSet(${i},this.value)">${USES.map((u) => `<option ${u == (l.use || b.use || 'Wohnen') ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>`;
              z += l.h;
              return r;
            })
            .reverse()
            .join('') +
          hSum(b) +
          `<button class="sm" onclick="la(1)">+ Geschoss</button> <button class="sm" onclick="la(-1)">− Geschoss</button> <button class="sm" onclick="lu(1)">+ Untergeschoss</button> <button class="sm" onclick="lu(-1)">− UG</button><button class="pri" style="background:var(--wa)" onclick="del()">Gebäude löschen</button><div style="color:var(--mu);margin-top:6px">Geschoss in 3D überfahren: rote Kontur zeigt Geschoss bzw. Seitenfläche, weiße Kugel ziehen = Wand/Decke schieben (Shift = alle Geschosse). Kugel auf der Oberseite = Geschosszahl.</div>`;
      } else
        h =
          geoPanel() +
          plotInfo() +
          `<h4>Planen</h4><div class="card">1. Grundstück anklicken<br>2. <b>Gebäude</b> (F) zeichnen<br>3. Enter → Geschosse eingeben<br>4. Freie <b>Flächen</b> (Grün, Platz, Wasser) ergänzen<br>5. In 3D betrachten, Variante speichern</div><button class="pri" onclick="plusBld()">+ Gebäude</button><button class="sm" style="margin-top:6px" onclick="setShape(S.shape,'area')">+ Fläche</button>` +
          parHint();
    } else if (S.tab == 'Analyse') {
      h = anPanel(b);
    } else if (S.tab == 'Varianten') {
      h =
        `<h4>Varianten</h4><button class="pri" onclick="sv()">Aktuellen Stand speichern</button>` +
          S.variants.map(vCard).join('') || '';
    } else
      h = `<h4>Excel-Export</h4><div class="card">Analysedaten (Kennwerte, Geschosse, bemaßte Abwicklungen, Dach- und Terrassenflächen) als Excel – Spalten und Überschriften frei wählbar, je Gebäude oder gesamt.<button class="pri" style="margin-top:8px" onclick="xlOpen()">Analysedaten als Excel …</button></div><h4>IFC-Export</h4><div class="card">IFC4 mit Projektstruktur (Projekt › Standort › Grundstück › Gebäude › Geschoss), Klassen-Mapping je Bauteilkategorie (Gelände, Umgebungsgebäude, Bäume, Flächen, Grundstücke, Planungsgebäude), Georeferenz, Property-Sets, Mengen und Farben – unabhängig von den Sichtbarkeiten im Projekt.<button class="pri" style="margin-top:8px" onclick="ifcOpen()">IFC exportieren …</button></div><h4>GeoJSON-Export</h4><textarea readonly>${JSON.stringify({ type: 'FeatureCollection', project: (S.project && S.project.name) || 'maad Demo', features: S.bld.map((x) => ({ type: 'Feature', properties: { id: x.id, name: x.name, use: x.use, levels: x.levels, roof: x.roof }, geometry: { type: 'Polygon', coordinates: [x.fp.concat([x.fp[0]])] } })) }, null, 1)}</textarea><button class="pri" style="margin:8px 0" onclick="planSave()">Planung als Datei sichern (.lotplan)</button><div style="color:var(--mu)">Koordinaten lokal in Metern. PNG/PDF/DXF/GLB: Exportmodul vorgesehen.</div>`;
    R.innerHTML = h;
    lgUpd();
    const lon = R.querySelector('.lr.on');
    if (lon) lon.scrollIntoView({ block: 'nearest' });
    updRM();
    // ── Erweiterung aus 17-erweiterungen-v253-v280/070-datenquellen.js (danach)
    try {
      const m = document.getElementById('srcm');
      if (
        m &&
        m.style.display === 'flex' &&
        (S.srTab === 'um' || S.srTab === 'ri' || S.srTab === 'dv') &&
        !rr.__in
      ) {
        rr.__in = 1;
        try {
          srcOpen();
        } finally {
          rr.__in = 0;
        }
      }
    } catch (e) {
      logErr(e, 'rr');
    }

    // ── Erweiterung aus 24-erweiterungen-v344-v436/120-kontur-bearbeiten.js (danach)
    try {
      const pc = $('pc');
      if (pc && S.tab === 'Planen' && ktB() && !S.closed && !(S.tool === 'f' && S.draft.length)) {
        const old = $('ktCard');
        if (old) old.remove();
        const hs = [...pc.querySelectorAll('h4')].find((x) => /Auswertung/.test(x.textContent));
        if (hs) hs.insertAdjacentHTML('beforebegin', ktCard());
      }
    } catch (e) {
      console.warn('ktCard', e);
    }
  })();
}
function selL(i) {
  const b = S.sel;
  if (!b || b.ex) return;
  S.roofSel = null;
  const ri = document.getElementById('rinfo');
  if (ri) ri.style.display = 'none';
  const f = S.selF;
  if (f && f.b === b && f.k === i && f.i < 0) return;
  S.selF = { b, k: i, i: -1 };
  H();
  document.querySelectorAll('.lr').forEach((r) => {
    const on = +r.dataset.k === i;
    r.classList.toggle('on', on);
    r.querySelectorAll('.lrx').forEach(
      (x) => (x.style.display = on ? (x.tagName === 'LABEL' ? 'flex' : '') : 'none'),
    );
  });
}
function lh(i, v) {
  hist();
  S.sel.levels[i].h = Math.max(2, +v || 3);
  mesh(S.sel);
  H();
  hpos();
  rr();
}
function lr(i) {
  hist();
  delete S.sel.levels[i].fp;
  mesh(S.sel);
  H();
  hpos();
  rr();
}
function refInp(b) {
  const e = GEO.e0 != null ? GEO.e0 : 0;
  return `Bezugshöhe ±0 (${GEO.e0 != null ? 'm ü. NN' : 'm, Demo relativ'})<input type="number" step="0.01" value="${(base(b) + e).toFixed(2)}" onchange="refSet(this.value)" title="Höhe des Erdgeschoss-Fußbodens (±0). Änderung verschiebt das Gebäude vertikal."><button class="sm" style="margin:4px 0 8px" onclick="refTerr()" title="auf Geländehöhe am Schwerpunkt setzen">↺ auf Gelände</button>`;
}
function refSet(v) {
  const b = S.sel;
  if (!b || b.ex || !isFinite(+v) || v === '') return;
  hist();
  b.ref = +v - (GEO.e0 != null ? GEO.e0 : 0);
  mesh(b);
  H();
  drawOv();
  rr();
}
function refTerr() {
  const b = S.sel;
  if (!b || b.ex) return;
  hist();
  const c = cen(b.fp);
  b.ref = gh(c[0], c[1]);
  mesh(b);
  H();
  drawOv();
  rr();
}
function hSum(b) {
  const a = b._hAbove || 0,
    r = b._roofH || 0,
    rt = b.roof && b.roof.type && b.roof.type !== 'flat';
  return `<div class="card" style="margin:6px 0"><div class="kv"><span>Geschosse über Erde</span><b>${f1(a, 2)} m</b></div>${rt ? `<div class="kv"><span>Dachgeschoss bis First</span><b>${f1(r, 2)} m</b></div>` : ''}<div class="kv"><span><b>Gesamthöhe über ±0</b></span><b>${f1(a + r, 2)} m</b></div>${b._ug ? `<div class="kv"><span>Untergeschosse (unter ±0)</span><b>−${f1(b._ug, 2)} m</b></div>` : ''}</div>`;
}
function lu(d) {
  const b = S.sel;
  if (!b || b.ex) return;
  hist();
  if (d > 0) {
    const l0 = b.levels[0];
    b.levels.unshift({ ug: true, h: l0.h, ...(l0.fp ? { fp: l0.fp.map((q) => q.slice()) } : {}) });
  } else if (b.levels[0].ug) b.levels.shift();
  else return;
  S.selF = null;
  mesh(b);
  H();
  hpos();
  rr();
}
function la(d) {
  const b = S.sel;
  hist();
  if (d > 0) b.levels.push(nl(b));
  else if (b.levels.length > ugN(b) + 1) b.levels.pop();
  mesh(b);
  H();
  hpos();
  rr();
}
function del() {
  if ((S.multi && S.multi.length) || (S.multiA && S.multiA.length)) {
    multiDel();
    return;
  }
  if (S.selA) {
    areaDel(S.selA.id);
    return;
  }
  if (S.sel && !S.sel.ex) {
    hist();
    const b = S.sel;
    b._g.parent.remove(b._g);
    S.bld = S.bld.filter((x) => x !== b);
    S.sel = null;
    S.selF = null;
    hpos();
    drawOv();
    rr();
  }
}
const snapB = () =>
  S.bld.map((b) => ({
    id: b.id,
    name: b.name,
    use: b.use,
    kind: b.kind,
    type: b.type,
    fp: b.fp,
    levels: b.levels,
    roof: b.roof,
    ref: b.ref,
    patches: b.patches,
    fd: b.fd,
    l2: b.l2,
    voids: b.voids,
  }));
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (typeof LAY !== 'undefined' && LAY.open) return;
  if (typeof HOME !== 'undefined' && HOME.open) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k == 'z') {
    e.preventDefault();
    undo();
  } else if (k == 'v') tool('v');
  else if (k == 'x') tool('x');
  else if (k == 'f') {
    if (S.tool !== 'f') setShape(S.shape);
  } else if (k == 'b') {
    tool('b');
  } else if (k == 'm') tool('m');
  else if (k == 'l') tool('L');
  else if (k == 't') tool('t');
  else if (k == 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) grOpen();
  else if (k == '2') setMode(0, 1);
  else if (k == '3') setMode(1, 1);
  else if (k == 'escape') {
    if (S.tool === 'L') {
      tool('v');
      return;
    }
    S.fd = null;
    fdDraw();
    S.selP = null;
    cancel();
    tool('v');
    H();
  } else if (k == 'delete' && S.tool === 'L') {
    if (LB.sel) lbDel(LB.sel);
  } else if (k == 'delete' && LB.sel && !S.sel) {
    lbDel(LB.sel);
  } else if (k == 'delete') {
    const a = ed();
    if (patchSel()) patchDel();
    else if (a && S.vi != null && a.length > 3 && (a !== S.draft || S.closed)) {
      let ct = null;
      if (isCt(a)) {
        hist();
        ct = ctBegin(S.sel);
      }
      a.splice(S.vi, 1);
      if (ct) ctEnd(ct);
      S.vi = null;
      refresh(a);
    } else if (GEO.tsel && !S.sel) treeDel();
    else if (GEO.sel && !S.sel) ctxDel();
    else del();
  } else if (k == 'backspace' && S.fd && S.fd.pts.length) {
    S.fd.pts.pop();
    fdDraw(S.fd.cur);
  } else if (k == 'backspace' && S.draft.length && !S.closed) {
    S.draft.pop();
    drawOv();
  } else if (k == 'enter' && S.tool == 'f') {
    S.fd ? fdEnter() : S.shape == 'free' ? draftClose() : shapeOk();
  }
});
// Startaufruf verschoben nach start() in 29-start/010-start-projekt-oeffnen.js

// Hover-Info Flurstück (ohne Klick)
(function () {
  const tip = document.getElementById('ptip');
  let busy = false,
    ev0 = null;
  const hide = () => {
    tip.style.display = 'none';
  };
  cv.addEventListener('pointerleave', hide);
  cv.addEventListener('pointerdown', hide);
  cv.addEventListener('pointermove', (e) => {
    ev0 = e;
    if (busy) return;
    busy = true;
    requestAnimationFrame(() => {
      busy = false;
      const e = ev0;
      try {
        const L = LY.find((l) => l[1] === 'parcels');
        if (dr || skEditing() || !AL.length || !S.geo || (L && !L[2]) || (e.buttons && e.buttons !== 0)) {
          hide();
          return;
        }
        const g = ground(e);
        if (!g) {
          hide();
          return;
        }
        const i = pickPar(g),
          ex = hvExtra(g);
        if (i < 0 && !ex) {
          hide();
          return;
        }
        const a = i >= 0 ? AL[i] : null;
        tip.innerHTML =
          (ex || '') +
          (a && !HNR.hvB ? '<b>Flurstück ' + esc(a.id) + '</b><br>' + f1(a.af || a.area) + ' m²' : '');
        const r = cv.getBoundingClientRect();
        tip.style.left = Math.min(innerWidth - 150, e.clientX + 14) + 'px';
        tip.style.top = e.clientY + 16 + 'px';
        tip.style.display = 'block';
      } catch (_) {
        hide();
      }
    });
  });
})();
