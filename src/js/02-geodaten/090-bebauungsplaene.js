// ---- Bebauungspläne (WFS, GeoJSON) – Layer, Info & Beschränkungen zum gewählten Flurstück
const BP = {
  url: 'https://geodata.o-sp.de/service/bielefeld.cgi?map=/www/server/pb/map/mapfiles/bielefeld.map',
  type: 'ms:bebauungsplaene',
  custom: false,
};
const BPL = [],
  BPC = ['#7a6fb0', '#4f8fb0', '#c0894f', '#4fb08a', '#b04f7a', '#8fa84f'];
S.plOpen = true;
const inBI = (lon, lat) => lon > 8.3 && lon < 8.75 && lat > 51.88 && lat < 52.17;
async function bplanLoad(lon, lat, size) {
  if (!BP.custom && !inBI(lon, lat))
    return {
      list: [],
      msg: 'Bebauungspläne: Für diesen Ort ist kein Dienst hinterlegt (voreingestellt: Bielefeld). Unter „Projekt → Bebauungsplan-Dienst“ kann ein eigener WFS eingetragen werden.',
    };
  try {
    const [cx, cy] = ll2utm(lon, lat),
      h = size / 2,
      ac = new AbortController(),
      to = setTimeout(() => ac.abort(), 45000);
    const u =
      BP.url +
      (BP.url.includes('?') ? '&' : '?') +
      'service=WFS&version=2.0.0&request=GetFeature&typeNames=' +
      encodeURIComponent(BP.type) +
      '&outputFormat=' +
      encodeURIComponent('application/json; subtype=geojson') +
      '&srsName=EPSG:25832&bbox=' +
      [cx - h, cy - h, cx + h, cy + h].map((v) => v.toFixed(1)).join(',') +
      ',EPSG:25832';
    GEO.bpUrl2 = u;
    const r = await fetch(viaProxy(u), { signal: ac.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    if (t.trim()[0] === '<') {
      const m = t.match(/<[^>]*ExceptionText[^>]*>([^<]+)/);
      throw new Error(m ? m[1].trim().slice(0, 160) : 'Dienst lieferte kein GeoJSON');
    }
    const j = JSON.parse(t),
      cv = (a, b) => {
        const lo = Math.min(a, b),
          hi = Math.max(a, b),
          [lo2, la2] = hi > 1e4 ? utm2ll(lo, hi) : [lo, hi];
        return ll2xz(lo2, la2);
      },
      list = [];
    for (const f of j.features || []) {
      const g = f.geometry;
      if (!g) continue;
      const pgs = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      const polys = pgs
        .map((pg) => ({ rings: pg.map((r) => r.map((c) => cv(c[0], c[1]))) }))
        .filter((pg) => pg.rings[0] && pg.rings[0].length > 2);
      if (polys.length) list.push({ props: f.properties || {}, polys });
    }
    return {
      list,
      msg: list.length ? '' : 'Bebauungspläne: Im gewählten Bereich liegt laut Dienst kein Bebauungsplan.',
    };
  } catch (e) {
    return {
      list: [],
      msg:
        'Bebauungspläne nicht geladen: ' +
        (e && e.message ? e.message : e) +
        ' – evtl. blockiert der Browser den Zugriff (CORS) oder der Dienst ist nicht erreichbar. Lösung: CORS-Proxy unter „Projekt“ eintragen.',
    };
  }
}
function bpPaint() {
  const K = PW / GEO.size,
    X = (x) => (x + GEO.size / 2) * K,
    c = PL.bplan.getContext('2d');
  c.clearRect(0, 0, PW, PW);
  if (!BPL.length) return;
  const hit = new Set();
  targets().forEach((p) => planAt(p).forEach((i) => hit.add(i)));
  BPL.forEach((b, i) => {
    c.fillStyle = S.lc.bplan;
    c.globalAlpha = hit.has(i) ? 0.5 : 0.22;
    for (const pg of b.polys) {
      c.beginPath();
      for (const r of pg.rings) {
        r.forEach(([x, z], k) => (k ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
        c.closePath();
      }
      c.fill('evenodd');
    }
  });
  c.globalAlpha = 1;
}
function bpClip(x0, z0, x1, z1, h) {
  let t0 = 0,
    t1 = 1;
  const dx = x1 - x0,
    dz = z1 - z0;
  for (const [p, q] of [
    [-dx, x0 + h],
    [dx, h - x0],
    [-dz, z0 + h],
    [dz, h - z0],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x0 + dx * t0, z0 + dz * t0, x0 + dx * t1, z0 + dz * t1];
}
function bpLines() {
  clr(G.bplan);
  if (!BPL.length) return;
  const pa = [];
  const bpHalf = S.geo && GEO.size ? GEO.size / 2 : 0;
  BPL.forEach((b) =>
    b.polys.forEach((pg) =>
      pg.rings.forEach((r) => {
        for (let k = 0; k < r.length; k++) {
          const p = r[k],
            q = r[(k + 1) % r.length],
            L = Math.hypot(q[0] - p[0], q[1] - p[1]),
            n = Math.max(1, Math.ceil(L / 3));
          for (let j = 0; j < n; j++) {
            let x0 = p[0] + ((q[0] - p[0]) * j) / n,
              z0 = p[1] + ((q[1] - p[1]) * j) / n,
              x1 = p[0] + ((q[0] - p[0]) * (j + 1)) / n,
              z1 = p[1] + ((q[1] - p[1]) * (j + 1)) / n;
            if (bpHalf > 0) {
              const c = bpClip(x0, z0, x1, z1, bpHalf);
              if (!c) continue;
              [x0, z0, x1, z1] = c;
            }
            pa.push(x0, gh(x0, z0) + 0.35, z0, x1, gh(x1, z1) + 0.35, z1);
          }
        }
      }),
    ),
  );
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
  const l = new T.LineSegments(
    g,
    new T.LineDashedMaterial({ color: S.lc.bplan, dashSize: 1.8, gapSize: 1.2, transparent: true }),
  );
  l.computeLineDistances();
  l.renderOrder = 2;
  G.bplan.add(l);
  const L = LY.find((q) => q[1] === 'bplan');
  G.bplan.visible = !!L[2];
  if (L[3] < 1) op('bplan', L[3]);
}
const targets = () => {
  const t = [...S.parSel].map((i) => AL[i] && AL[i].poly).filter(Boolean);
  if (!t.length && S.par) t.push(S.par.poly);
  return t;
};
const planAt = (poly) => {
  const c = cen(poly),
    r = [];
  BPL.forEach((b, i) => {
    if (
      b.polys.some((pg) => {
        const o = pg.rings[0];
        return inP(c, o) || poly.some((q) => inP(q, o)) || o.some((q) => inP(q, poly));
      })
    )
      r.push(i);
  });
  return r;
};
const LIMK = {
  grz: /^(grz|grundflaechenzahl)/i,
  gfz: /^(gfz|geschossflaechenzahl)/i,
  vg: /(vollgeschoss|geschosszahl|zahl_?der_?geschosse|^z$|^zvoll|^max_?geschoss)/i,
  h: /(gebaeudehoehe|bauhoehe|firsthoehe|^fh|^gh|^max_?hoehe|hoehe_?max|^hoehe$)/i,
};
function bpFound(pr) {
  const o = {};
  for (const n in LIMK)
    for (const k in pr) {
      if (LIMK[n].test(k)) {
        const v = parseFloat(String(pr[k]).replace(',', '.'));
        if (isFinite(v) && v > 0) {
          o[n] = v;
          break;
        }
      }
    }
  return o;
}
function bpApply(i) {
  const f = bpFound(BPL[i].props);
  for (const n in f) S.lim[n] = f[n];
  rr();
}
function setLim(k, v) {
  v = parseFloat(String(v).replace(',', '.'));
  S.lim[k] = isFinite(v) && v > 0 ? v : null;
  rr();
}
let envG = null,
  envK = '';
function envBuild() {
  const t = targets(),
    h = S.lim.h,
    key =
      S.env && h && t.length ? JSON.stringify([t.map((p) => [p.length, ...cen(p).map(Math.round)]), h]) : '';
  if (key === envK) return;
  envK = key;
  if (envG) {
    sc.remove(envG);
    envG.traverse((o) => o.geometry && o.geometry.dispose());
    envG = null;
  }
  if (!key) return;
  const g = new T.Group();
  t.forEach((p) => {
    const y0 = Math.min(...p.map((q) => gh(q[0], q[1]))),
      y = y0 + h,
      pts = p.map((q) => new T.Vector3(q[0], y, q[1]));
    const top = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineDashedMaterial({ color: 0x5a4f9a, dashSize: 1.5, gapSize: 1 }),
    );
    top.computeLineDistances();
    g.add(top);
    const v = [];
    p.forEach((q) => v.push(new T.Vector3(q[0], gh(q[0], q[1]), q[1]), new T.Vector3(q[0], y, q[1])));
    g.add(
      new T.LineSegments(
        new T.BufferGeometry().setFromPoints(v),
        new T.LineBasicMaterial({ color: 0x5a4f9a, transparent: true, opacity: 0.5 }),
      ),
    );
  });
  sc.add(g);
  envG = g;
}
function ruleCard(b) {
  const L = S.lim,
    k = kw(b),
    rows = [];
  if (k) {
    rows.push(['GRZ', f1(k.grz, 2), L.grz ? '≤ ' + f1(L.grz, 2) : '', !L.grz || k.grz <= L.grz + 1e-9]);
    rows.push(['GFZ', f1(k.gfz, 2), L.gfz ? '≤ ' + f1(L.gfz, 2) : '', !L.gfz || k.gfz <= L.gfz + 1e-9]);
  }
  if (L.vg) rows.push(['Vollgeschosse', vgN(b), '≤ ' + L.vg, vgN(b) <= L.vg]);
  if (L.h) {
    const ht = b._hTot || b._h;
    rows.push(['Gebäudehöhe (First)', f1(ht, 2) + ' m', '≤ ' + f1(L.h, 1) + ' m', ht <= L.h + 1e-9]);
  }
  return (
    '<h4>Festsetzungen</h4><div class="card">' +
    rows
      .map(
        (r) =>
          `<div class="kv"><span>${r[0]}</span><b class="${r[3] ? '' : 'wa'}">${r[1]} ${r[2] ? '<span style="font-weight:400;color:var(--mu)">(' + r[2] + ')</span>' : ''} ${r[3] ? '✓' : '✗'}</b></div>`,
      )
      .join('') +
    '<div style="color:var(--mu);font-size:11px">Grenzwerte ändern: Reiter Planen → Grundstück wählen → „Informationen &amp; Beschränkungen“.</div></div>'
  );
}
function planCard(i) {
  const b = BPL[i],
    pr = b.props,
    skip = /^(geom|geometry|the_geom|msgeometry|gml_id|fid|objectid|boundedby)$/i;
  const ents = Object.entries(pr).filter(
    ([k, v]) => !skip.test(k) && v !== null && v !== '' && typeof v !== 'object',
  );
  const idK =
    ents.find(([k]) => /plan_?id|planid|plan_?nr|plan_?nummer|^nr$|^nummer$|^id$|kennung/i.test(k)) ||
    ents.find(([k]) => /bezeichnung|^name$|plan_?name/i.test(k)) ||
    ents[0];
  const idT = idK ? String(idK[1]).slice(0, 60) : 'Bebauungsplan';
  const rows = ents
    .filter((e) => e !== idK)
    .slice(0, 16)
    .map(([k, v]) => {
      v = String(v);
      return kv(
        esc(k.replace(/_/g, ' ')),
        /^https?:\/\//i.test(v)
          ? `<a href="${esc(v)}" target="_blank" rel="noopener">Link öffnen</a>`
          : esc(v.slice(0, 120)),
      );
    })
    .join('');
  const fd = bpFound(pr),
    ap = Object.keys(fd).length > 0;
  return `<details class="card" ${S.bpOpen && S.bpOpen[i] ? 'open' : ''} ontoggle="(S.bpOpen=S.bpOpen||{})[${i}]=this.open"><summary style="cursor:pointer;color:${S.lc.bplan}"><b>${esc(idT)}</b></summary>${rows || '<div style="color:var(--mu)">Keine weiteren Sachdaten.</div>'}${
    ap
      ? `<button class="sm" style="margin-top:6px" onclick="bpApply(${i})">Festsetzungen übernehmen (${Object.entries(
          fd,
        )
          .map(([n, v]) => n.toUpperCase() + ' ' + v)
          .join(', ')})</button>`
      : ''
  }</details>`;
}
function planInfo() {
  const bi = LY.findIndex((l) => l[1] === 'bplan');
  let h = `<details style="margin-top:8px" ${S.plOpen ? 'open' : ''} ontoggle="S.plOpen=this.open"><summary style="cursor:pointer"><b>Informationen &amp; Beschränkungen</b></summary>`;
  h += `<label style="display:block;margin:6px 0"><input type="checkbox" ${LY[bi][2] ? 'checked' : ''} onchange="lvis(${bi},this.checked)"> Bebauungspläne in der Karte zeigen</label>`;
  if (!BPL.length)
    h +=
      '<div style="color:var(--mu)">' +
      esc(GEO.bpMsg || 'Keine Bebauungsplan-Daten geladen (nach dem Laden einer Umgebung verfügbar).') +
      '</div>';
  else {
    const idx = new Set();
    targets().forEach((p) => planAt(p).forEach((i) => idx.add(i)));
    if (!idx.size)
      h +=
        '<div class="card">Für die Auswahl wurde kein Bebauungsplan gefunden. Die Zulässigkeit richtet sich dann ggf. nach §&nbsp;34 bzw. §&nbsp;35 BauGB – bitte bei der Stadt klären.</div>';
    else idx.forEach((i) => (h += planCard(i)));
  }
  const li = (k, l, st) =>
    `<label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">${l}<input type="number" step="${st}" min="0" style="width:90px" value="${S.lim[k] == null ? '' : S.lim[k]}" onchange="setLim('${k}',this.value)"></label>`;
  h +=
    '<div class="card"><b>Festsetzungen für den Baukörper</b><div style="color:var(--mu);font-size:11px;margin-bottom:4px">Aus dem Plan übernehmen oder aus Textteil/Plan-PDF eintragen; leer = keine Beschränkung.</div>' +
    li('grz', 'GRZ', 0.05) +
    li('gfz', 'GFZ', 0.1) +
    li('vg', 'max. Vollgeschosse', 1) +
    li('h', 'max. Gebäudehöhe (m)', 0.5) +
    `<label style="display:block;margin-top:4px"><input type="checkbox" ${S.env ? 'checked' : ''} onchange="S.env=this.checked;envBuild()"> Höhengrenze im Modell zeigen</label></div>`;
  return (
    h +
    '<div style="color:var(--mu);font-size:11px;margin-top:4px">Daten des kommunalen Dienstes, keine Rechtsauskunft.</div></details>'
  );
}
function siteSel(id) {
  S.par = P.find((p) => p.id === id) || null;
  parRefresh();
  rr();
}
function siteDel(id) {
  const i = P.findIndex((p) => p.id === id);
  if (i < 0) return;
  if (S.siteEdit === id) {
    S.siteEdit = null;
    S.parSel = new Set();
  }
  if (S.par === P[i]) S.par = null;
  P.splice(i, 1);
  parRefresh();
  rr();
}
function siteRen(id, v) {
  const p = P.find((q) => q.id === id);
  if (p) {
    p.name = v.trim() || p.id;
    rr();
  }
}
const flNr = (id) => String(id).replace(/^Fl\.?\s*/i, ''),
  flTxt = (ids, n) => {
    n = n || 6;
    const a = ids.slice(0, n).map(flNr).join(', ');
    return a + (ids.length > n ? ' … +' + (ids.length - n) : '');
  };
function siteEditStart(id) {
  const p = P.find((q) => q.id === id);
  if (!p || !AL.length) return;
  S.siteEdit = id;
  const set = new Set();
  (p.fl || []).forEach((f) => {
    const i = AL.findIndex((a) => a.id === f);
    if (i >= 0) set.add(i);
  });
  if (!set.size)
    AL.forEach((a, i) => {
      if (!a.cut && inP(cen(a.poly), p.poly)) set.add(i);
    });
  S.parSel = set;
  parRefresh();
  rr();
  gst(
    'Grundstück bearbeiten: Flurstücke anklicken, um sie hinzuzufügen oder zu entfernen, dann „Übernehmen“.',
  );
}
function siteEditCancel() {
  S.siteEdit = null;
  S.parSel = new Set();
  parRefresh();
  rr();
}
function siteEditApply() {
  const p = P.find((q) => q.id === S.siteEdit);
  if (!p) return siteEditCancel();
  if (!S.parSel.size) {
    alert(
      'Ein Grundstück braucht mindestens ein Flurstück. Zum Entfernen bitte „Grundstück löschen“ verwenden.',
    );
    return;
  }
  const { list } = selPolys();
  if (list.length !== 1) {
    gst('Die gewählten Flurstücke grenzen nicht aneinander.');
    alert('Die gewählten Flurstücke grenzen nicht aneinander. Bitte zusammenhängende Flurstücke wählen.');
    return;
  }
  const o = list[0];
  p.poly = o.poly.map((q) => q.slice());
  p.fl = o.ids;
  S.siteEdit = null;
  S.parSel = new Set();
  const out = S.bld.filter((b) => !b.ex && b.fp && !inP(cen(b.fp), p.poly)).length;
  parRefresh();
  envBuild();
  rr();
  gst(
    'Grundstück aktualisiert: ' +
      p.fl.length +
      ' Flurstück' +
      (p.fl.length > 1 ? 'e' : '') +
      ' · ' +
      f1(area(p.poly)) +
      ' m²' +
      (out ? ' · ' + out + ' Gebäude liegen nun außerhalb (bleiben erhalten).' : ''),
  );
}
function parBar() {
  const e = $('pbar');
  if (!e) return;
  const n = S.parSel.size;
  if (!n && !S.siteEdit) {
    e.style.display = 'none';
    return;
  }
  const ps = [...S.parSel].map((i) => AL[i]).filter(Boolean),
    a = ps.reduce((t, x) => t + (x.af || x.area), 0),
    ids = ps.map((x) => x.id);
  const ok = ps.length < 2 || selPolys().list.length === 1;
  e.style.display = 'flex';
  const info = `<span><b>${n}</b> Flurstück${n === 1 ? '' : 'e'} · ${f1(a)} m²${ids.length ? ' · Fl. ' + esc(flTxt(ids)) : ''}${ok ? '' : ' <b style="color:#d8322f">· nicht zusammenhängend</b>'}</span>`;
  const x = `<button class="sm" onclick="${S.siteEdit ? 'siteEditCancel()' : 'S.parSel=new Set();parRefresh();rr()'}" title="Auswahl aufheben">${S.siteEdit ? 'Abbrechen' : '✕'}</button>`;
  if (S.siteEdit) {
    e.innerHTML =
      '<span style="color:var(--mu)">Grundstück bearbeiten:</span>' +
      info +
      `<button class="pri" style="width:auto;margin:0" ${n && ok ? '' : 'disabled'} onclick="siteEditApply()">Übernehmen</button>` +
      x;
    return;
  }
  e.innerHTML =
    info +
    (n > 1
      ? `<button class="pri" style="width:auto;margin:0" ${ok ? '' : 'disabled'} onclick="siteFromSel()">Als Grundstück zusammenlegen</button>`
      : `<button class="pri" style="width:auto;margin:0" onclick="siteFromSel()">Als Grundstück übernehmen</button>`) +
    `<button class="sm" onclick="parToDraft()">Als Zeichenfläche</button>` +
    (ps.some((x) => x.props && x.props.quelle)
      ? `<button class="sm" onclick="parWmsDel()" title="Gewählte abgeleitete Flächen entfernen (z. B. Gebäude oder Straßenreste)">Entfernen</button>`
      : '') +
    (n === 1 && !hasSite()
      ? '<span style="color:var(--mu);font-size:11px">Shift+Klick: weitere Flurstücke hinzufügen</span>'
      : '') +
    x;
}
function parPanel() {
  let h = '<h4>Flurstücke (ALKIS)</h4>';
  if (!AL.length)
    h +=
      '<div style="color:var(--mu)">' +
      esc(
        GEO.alkMsg ||
          'Keine Flurstücke geladen (nach dem Laden einer Umgebung verfügbar, sofern das Bundesland einen freien Dienst anbietet).',
      ) +
      '</div>';
  else if (hasSite())
    h +=
      '<div style="color:var(--mu)">Ein Grundstück ist aktiv. Mit „Flurstücke hinzufügen/entfernen“ lässt es sich erweitern oder verkleinern; für ein anderes Flurstück zuerst löschen.</div>' +
      (S.siteEdit ? parSelCard() : '');
  else {
    h +=
      `<div style="color:var(--mu)">${AL.length} Flurstücke${GEO.alkBL ? ' · ' + esc(GEO.alkBL) : ''} · anklicken, mit Shift mehrere wählen</div>` +
      (GEO.alkSrc ? `<div style="color:var(--mu);font-size:11px">${esc(GEO.alkSrc)}</div>` : '');
    h += parSelCard();
  }
  const ss = P.filter((p) => p.site);
  if (ss.length)
    h +=
      '<h4>Grundstück</h4>' +
      ss
        .map(
          (p) =>
            `<div class="card">${kv(p.fl.length > 1 ? 'Flurstücke' : p.fl.length ? 'Flurstück' : 'Herkunft', p.fl.length ? esc(p.fl.join(', ')) : 'gezeichnet')}${kv('Fläche', f1(area(p.poly)) + ' m²')}${p.fl.length ? `<button class="sm" onclick="siteEditStart('${p.id}')">Flurstücke hinzufügen/entfernen</button> ` : ''}<button class="sm" onclick="siteDel('${p.id}')">Löschen</button></div>`,
        )
        .join('');
  return h;
}
function demoOff() {
  S.areas = [];
  S.selA = null;
  S.multi = [];
  S.multiA = [];
  try {
    areaSelDraw();
  } catch (e) {
    logErr(e, 'demoOff');
  }
  clr(G.roads);
  clr(G.green);
  clr(G.parcels);
  clr(G.trees);
  clr(G.ex);
  S.ex = [];
  S.par = null;
}
async function geoRun(lon, lat, size, label, snap) {
  if (GEO.busy) return { ok: false, msg: 'Ladevorgang läuft bereits.' };
  GEO.busy = true;
  try {
    GEO.lon = lon;
    GEO.lat = lat;
    GEO.kx = 111320 * Math.cos((lat * Math.PI) / 180);
    GEO.size = size;
    GEO.N = Math.max(100, Math.min(300, Math.round(size / 10) * 2));
    if (!snap) {
      try {
        await mlAuto(lon, lat, size);
      } catch (e) {
        GEO.dlMsg = 'Download-Manager: ' + e.message;
      }
    }
    gst('Lade Kartendaten und Gelände …');
    let tiles, E, AK, BK, LD, DG, OT, DM;
    if (snap) {
      ({ tiles, AK, BK, LD, OT } = snap);
      E = null;
      DG = snap._DG || null;
      DM = snap._DM || null;
    } else
      [tiles, E, AK, BK, LD, DG, OT, DM] = await Promise.all([
        vecLoad(),
        elevLoad(),
        alkisLoad(lon, lat, size),
        bplanLoad(lon, lat, size),
        bldLoad(lon, lat, size),
        dgmLoad(lon, lat, size).catch((e) => ({
          fail: true,
          msg: 'DGM1 nicht geladen (' + e.message + ') – MapTiler-Gelände.',
        })),
        osmTrees(lon, lat, size).catch((e) => ({ list: [], msg: 'OSM-Bäume: ' + e.message })),
        S.canopyOn === false
          ? Promise.resolve({ fail: true, msg: 'Kronenmodell ausgeschaltet.' })
          : dgmLoad(lon, lat, size, 'nw_dom', 'DOM1').catch((e) => ({
              fail: true,
              msg: 'DOM1 nicht geladen (' + e.message + ').',
            })),
      ]);
    await wmsRun(lon, lat, size, snap, AK && AK.list ? AK.list.length : 0);
    const acc = ctxCollect(tiles);
    if (LD.list.length) acc.b = LD.list;
    GEO.lodMsg = LD.msg;
    if (GEO.dlMsg) GEO.lodMsg = GEO.dlMsg + ' ' + (GEO.lodMsg || '');
    if (snap) {
      GEO.dgm = snap.dgm ? (snap._DG && !snap._DG.fail ? snap._DG : { snap: 1 }) : null;
      GEO.terrMsg = snap.terrMsg;
      GEO.N = snap.N;
      if (!GEO.partRun) {
        GEO.dgmFull = null;
        GEO.dmFull = null;
      }
    } else {
      GEO.dgm = DG && !DG.fail ? DG : null;
      GEO.dgmFull = GEO.dgm;
      GEO.dmFull = DM;
      GEO.terrMsg = DG
        ? DG.msg
        : E
          ? 'Gelände: MapTiler-Terrain (kein DGM1 für diesen Standort eingebunden).'
          : 'Gelände: keine Höhendaten.';
      if (GEO.dgm) {
        GEO.N = Math.min(500, Math.max(GEO.N, Math.round(size / 2)));
        GEO.N += GEO.N % 2;
      }
    }
    gst('Erzeuge 3D-Umgebung …');
    await new Promise((r) => setTimeout(r, 30));
    demoOff();
    P.length = 0;
    AL.length = 0;
    S.parSel = new Set();
    if (snap) {
      GEO.grid = snap.grid;
      GEO.e0 = snap.e0;
      GHf = gridH;
    } else gridBuild(E);
    rebuildTerrain();
    clipParcels(AK.list, size / 2).forEach((a) => AL.push(a));
    if ((!snap || GEO.partFl) && !AL.length && S.wmsVec === true && GEO.wmsMask)
      try {
        parFromWms(true);
      } catch (e) {
        logErr(e, 'geoRun');
      }
    GEO.alkMsg = AK.msg;
    GEO.alkSrc = AK.src || '';
    GEO.acc = acc;
    GEO.blist = acc.b;
    GEO.bdel = [];
    GEO.tdel = [];
    rnBuild();
    BPL.length = 0;
    BK.list.forEach((b) => BPL.push(b));
    GEO.bpMsg = BK.msg;
    bpLines();
    LY[0][0] = AL.length ? 'Flurstücke (ALKIS)' : 'Flurstücke';
    parLines();
    ctxPaint(acc);
    recomp();
    ctxBuild(acc.b);
    S.geo = true;
    parBar();
    let cn = { list: [], msg: '' };
    try {
      cn = snap
        ? snap.cn
        : S.canopyOn === false
          ? { list: [], msg: 'Kronenmodell ausgeschaltet.' }
          : canopy(GEO.dgm, DM, acc.b, OT.list, { water: acc.fill.water, br: acc.bridges });
    } catch (e) {
      cn = { list: [], msg: 'Kronenmodell: ' + e.message };
    }
    treesBuild(OT.list.concat(cn.list));
    GEO.tdel = [];
    const rg = [];
    acc.b.forEach((b) => {
      if (b.o) rg.push(b.o);
      if (b.xr) b.xr.forEach((r) => rg.push(r));
    });
    const nDel = treePrune(rg);
    GEO.tdel = [];
    GEO.treeMsg =
      OT.msg +
      ' ' +
      (DM && DM.fail ? DM.msg : cn.msg) +
      ' ' +
      nDel +
      ' Bäume mit Mittelpunkt in Gebäuden entfernt, ' +
      (GEO.trees ? GEO.trees.length : 0) +
      ' verbleiben.';
    LY.find((l) => l[1] === 'trees')[0] = 'Bäume';
    try {
      GEO.rep = await loadReport({ LD, OT, AK, DG, DM, cn, lon, lat });
    } catch (e) {
      GEO.rep = null;
    }
    GEO.snap = snap || {
      v: 1,
      lon,
      lat,
      size,
      label,
      N: GEO.N,
      grid: GEO.grid,
      e0: GEO.e0,
      dgm: !!GEO.dgm,
      terrMsg: GEO.terrMsg,
      tiles: snapTiles(tiles),
      AK,
      BK,
      LD,
      OT,
      cn,
    };
    const hs = (size / 2) * 1.05;
    Object.assign(sh.camera, {
      left: -hs,
      right: hs,
      top: hs,
      bottom: -hs,
      near: 1,
      far: Math.max(900, size * 1.2),
    });
    sh.normalBias = Math.max(0.15, Math.min(1, ((hs * 2) / 4096) * 2));
    sh.camera.updateProjectionMatrix();
    S.bld.forEach(mesh);
    S.sel = null;
    S.selF = null;
    H();
    hpos();
    if (GEO.keepView) bootKeep(GEO.keepView);
    else {
      V.tx = V.tz = 0;
      V.rot = V.rotT = 0;
      V.d = Math.min(900, size * 0.7);
    }
    drawOv();
    const msg =
      GEO.ranges.length +
      ' Gebäude, ' +
      acc.line.roads.length +
      ' Straßenabschnitte' +
      (E || snap ? '' : ' · keine Höhendaten, Gelände flach') +
      '. ' +
      (AL.length ? AL.length + ' Flurstücke (ALKIS).' : AK.msg) +
      ' ' +
      (BPL.length ? BPL.length + ' Bebauungspläne (Layer einblendbar).' : BK.msg);
    const l3w =
      (!snap || (GEO.partRun && GEO.partTab === 'gb' && !GEO.swapRun)) &&
      (GEO.lod3Pick === true || S.lod3On === true) &&
      LOD3S.some((x) => lon >= x.bb[0] && lon <= x.bb[2] && lat >= x.bb[1] && lat <= x.bb[3]);
    gst(msg + (l3w ? ' LoD3 wird im Hintergrund nachgeladen …' : ''));
    if (l3w) setTimeout(() => lod3Bg(), 150);
    return { ok: true, msg };
  } catch (e) {
    const msg =
      'Fehler: ' +
      (e && e.message ? e.message : e) +
      '. Falls die Seite externe Kartendienste blockiert, lokal als Datei öffnen.';
    gst(msg);
    return { ok: false, msg };
  } finally {
    GEO.busy = false;
  }
}
