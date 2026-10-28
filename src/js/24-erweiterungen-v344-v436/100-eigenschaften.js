// ---- Eigenschaften
function layZ(to) {
  const e = layEl(LAY.sel);
  if (!e) return;
  LAY.els = LAY.els.filter((x) => x !== e);
  to === 'back' ? LAY.els.unshift(e) : LAY.els.push(e);
  laySave();
  layRender();
}
function layKontAll() {
  const e = layEl(LAY.sel);
  if (!e) return;
  const c = e.bc || '#1d1d1b',
    w = +e.bw || 0.25;
  LAY.els.forEach((o) => {
    o.bc = c;
    if (o.type === 'box') {
      if (+o.bw > 0) o.bw = w;
    } else o.bw = w;
  });
  laySave();
  layRender();
  layProp();
}
function layProp2() {
  const el = $('layProp'),
    e = layEl(LAY.sel);
  if (!e || LAY.draw) return;
  const t = e.type,
    own = t === 'box' || t === 'board',
    txt = t !== 'pic' && t !== 'view' && t !== 'box';
  const N = (k, l, st, d) =>
      `<label class="lp">${l}<input type="number" step="${st || 1}" value="${Math.round((e[k] == null ? d || 0 : +e[k]) * 100) / 100}" onchange="layPut('${k}',+this.value)"></label>`,
    Cc = (k, l, d) =>
      `<label class="lp">${l}<input type="color" value="${e[k] || d}" oninput="layPut('${k}',this.value,1)"></label>`,
    Ck = (k, l, after) =>
      `<label class="lp">${l}<input type="checkbox" ${e[k] ? 'checked' : ''} onchange="layPut('${k}',this.checked);${after || 'layProp()'}"></label>`,
    Rg = (k, l) =>
      `<label class="lp">${l}<input type="range" min="0" max="100" value="${Math.round((e[k] == null ? 1 : e[k]) * 100)}" oninput="layPut('${k}',this.value/100,1)" style="width:90px"></label>`;
  let h = '';
  if (t === 'box') {
    h +=
      `<h4>Fläche</h4><label class="lp">Füllung<input type="checkbox" ${e.fc !== 'none' ? 'checked' : ''} onchange="layPut('fc',this.checked?'#E9EDEF':'none');layProp()"></label>` +
      (e.fc !== 'none' ? Cc('fc', 'Füllfarbe', '#E9EDEF') + Rg('fa', 'Deckkraft') : '') +
      N('rx', 'Ecken abrunden (mm, 0 = eckig)', 0.5) +
      N('bw', 'Kontur Stärke (mm, 0 = keine)', 0.05) +
      Cc('bc', 'Konturfarbe', '#1d1d1b') +
      N('x', 'X (mm)') +
      N('y', 'Y (mm)') +
      N('w', 'Breite (mm)') +
      N('h', 'Höhe (mm)');
  } else if (t === 'board') {
    h += `<h4>Metriken-Board</h4><label class="lp">Titel<input type="text" value="${esc(e.title || '')}" oninput="layPut('title',this.value,1)" style="width:130px"></label>${Ck('perB', 'Je Gebäude aufteilen')}${Ck('gr', 'Grundstück (GRZ/GFZ)')}${N('size', 'Schriftgröße Zeilen (pt)')}${N('big', 'Schriftgröße BGF-Wert (pt)')}${N('x', 'X (mm)')}${N('y', 'Y (mm)')}${N('w', 'Breite (mm)')}<div style="color:var(--mu);font-size:11px;margin-top:4px">Live aus dem Modell, Aufbau wie die Gebäudemetriken im Hauptfenster.</div>`;
  }

  if (txt) {
    h +=
      `<div style="margin-top:8px;border-top:1px solid var(--ln);padding-top:6px"><b>Darstellung</b>` +
      Cc('tc', 'Schriftfarbe', '#1d1d1b') +
      `<label class="lp">Hintergrund<input type="checkbox" ${e.bg ? 'checked' : ''} onchange="layPut('bg',this.checked?'#ffffff':null);layProp()"></label>` +
      (e.bg ? Cc('bg', 'Hintergrundfarbe', '#ffffff') + Rg('fa', 'Deckkraft') : '') +
      Ck('bo', 'Kontur') +
      (e.bo ? N('bw', 'Kontur Stärke (mm)', 0.05, 0.25) + Cc('bc', 'Konturfarbe', '#1d1d1b') : '') +
      (e.bg || e.bo ? N('rx', 'Ecken abrunden (mm)', 0.5) + N('pad', 'Innenabstand (mm)', 0.5) : '') +
      `</div>`;
  } else if (t === 'pic' || t === 'view') {
    if (e.border)
      h +=
        `<div style="margin-top:6px">` +
        N('bw', 'Rahmen Stärke (mm)', 0.05, 0.25) +
        Cc('bc', 'Rahmenfarbe', '#1d1d1b') +
        `</div>`;
  }
  if (t === 'box' || e.bo || e.border || (txt && e.bg))
    h += `<button class="sm" style="margin-top:6px" onclick="layKontAll()" title="Farbe und Stärke dieser Kontur auf alle Elemente mit Kontur/Rahmen anwenden">Kontur auf alle übertragen</button>`;
  h += `<div style="display:flex;gap:6px;margin-top:6px"><button class="sm" onclick="layZ('back')">Nach hinten</button><button class="sm" onclick="layZ('front')">Nach vorne</button></div>`;
  if (own) {
    if (t === 'board')
      h += `<label class="lp" style="margin-top:6px">Schrift<select onchange="layPut('font',this.value||null)" style="max-width:130px">${layFontOpts(null, e.font || '', `wie Layout (${(LFOPT.find((x) => x[0] === LAY.font) || [0, 'Helvetica'])[1]})`)}</select></label>`;
    h += `<div style="display:flex;gap:6px;margin-top:8px"><button class="sm" onclick="layDup()">Duplizieren</button><button class="sm" onclick="layDel()" style="color:var(--wa)">Löschen</button></div>`;
    el.innerHTML = h;
    return;
  }
  el.insertAdjacentHTML('beforeend', h);
}
// layProp(): Erweiterung zusammengeführt, siehe 08-layout-pdf/020-rendern-einer-gespeicherten-ansicht-in.js

// Geschoss einzeln kopieren: Geschosse über Erde nach oben, Untergeschosse nach unten
function lcp(i) {
  const b = S.sel;
  if (!b || b.ex || !b.levels[i]) return;
  hist();
  const l = b.levels[i],
    c = JSON.parse(JSON.stringify(l));
  delete c.name;
  if (l.ug) b.levels.splice(i, 0, c);
  else b.levels.splice(i + 1, 0, c);
  S.selF = null;
  mesh(b);
  H();
  hpos();
  rr();
}

// Geschoss löschen (mindestens ein Geschoss über Erde bleibt; Rückgängig über hist)
function lrm(i) {
  const b = S.sel;
  if (!b || b.ex || !b.levels[i]) return;
  const l = b.levels[i];
  if (!l.ug && b.levels.filter((x) => !x.ug).length <= 1) {
    try {
      $('hud').textContent = 'Das letzte Geschoss über Erde kann nicht gelöscht werden';
    } catch (e) {
      logErr(e, 'lrm');
    }
    return;
  }
  hist();
  b.levels.splice(i, 1);
  if (b.patches)
    b.patches = b.patches
      .filter((p) => p.k !== i)
      .map((p) => (p.k > i ? Object.assign({}, p, { k: p.k - 1 }) : p));
  S.selF = null;
  mesh(b);
  H();
  hpos();
  rr();
}

/* Projekt im Startmenü umbenennen (Inline-Feld) */
function projRen(id, ev) {
  if (ev) ev.stopPropagation();
  const row = ev.target.closest('.hproj');
  if (!row) return;
  const b = row.querySelector('b');
  if (!b || row.querySelector('input')) return;
  const old = b.textContent;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = old;
  inp.style.cssText =
    'width:100%;font:inherit;font-weight:600;padding:2px 6px;border:1px solid #5E7F92;border-radius:6px;background:#E9EDEF;outline:0';
  inp.onclick = (e) => e.stopPropagation();
  let done = 0;
  const fin = async (ok) => {
    if (done) return;
    done = 1;
    const nv = inp.value.trim();
    if (ok && nv && nv !== old) {
      try {
        const rec = await idbGet('proj:' + id);
        if (rec) {
          rec.name = nv;
          await idbSet('proj:' + id, rec);
        }
        const ix = (await idbGet('projIdx')) || [];
        const e = ix.find((x) => x.id === id);
        if (e) {
          e.name = nv;
          await idbSet('projIdx', ix);
        }
        if (S.project && S.project.id === id) {
          S.project.name = nv;
          try {
            updPj();
          } catch (e) {
            logErr(e, 'fin');
          }
        }
      } catch (er) {
        console.error(er);
      }
      b.textContent = nv;
    } else b.textContent = old;
    if (inp.parentNode === b) b.removeChild(inp);
  };
  inp.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') fin(1);
    else if (e.key === 'Escape') fin(0);
  };
  inp.onblur = () => fin(1);
  b.textContent = '';
  b.appendChild(inp);
  inp.focus();
  inp.select();
}

/* Layer „Hausnummern“: Nummer mittig über jedem Gebäude (OSM addr:housenumber, live per Overpass) */
if (!LY.find((l) => l[1] === 'hnr')) LY.push(['Hausnummern', 'hnr', 0, 1]);
if (!S.lc.hnr) S.lc.hnr = '#1d1d1b';
G.hnr = new T.Group();
sc.add(G.hnr);
G.hnr.visible = false;
const HNR = { key: '', data: null, busy: 0, msg: '' };
function hnrOn() {
  const L = LY.find((l) => l[1] === 'hnr');
  return !!(L && L[2]);
}
function hnrTex(t) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const x = c.getContext('2d');
  x.font = '700 64px Arial,Helvetica,sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = 12;
  x.strokeStyle = 'rgba(255,255,255,.92)';
  x.strokeText(t, 128, 50, 240);
  x.fillStyle = S.lc.hnr || '#1d1d1b';
  x.fillText(t, 128, 50, 240);
  const tx = new T.CanvasTexture(c);
  tx.minFilter = T.LinearFilter;
  return tx;
}
function hnrBuild() {
  G.hnr.children.slice().forEach((o) => {
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
    G.hnr.remove(o);
  });
  if (!HNR.data || !GEO.blist) return;
  const used = new Set();
  for (const b of GEO.blist) {
    if (!b.o || b.o.length < 3) continue;
    const hit = HNR.data.filter((d) => !used.has(d) && inP([d.x, d.z], b.o));
    if (!hit.length) continue;
    hit.forEach((d) => used.add(d));
    const txt = [...new Set(hit.map((d) => d.n))].join(', ');
    const c = cen(b.o),
      sp = new T.Mesh(
        new T.PlaneGeometry(26, (26 * 96) / 256),
        new T.MeshBasicMaterial({ map: hnrTex(txt), transparent: true, depthTest: false, depthWrite: false }),
      );
    sp.rotation.x = -Math.PI / 2;
    sp.position.set(c[0], gh(c[0], c[1]) + (b.h || 6) + 3, c[1]);
    sp.renderOrder = 20;
    G.hnr.add(sp);
  }
  G.hnr.visible = hnrOn();
}
async function hnrLoad() {
  if (!S.geo && !GEO.lon) return;
  const key = [GEO.lon, GEO.lat, GEO.size].join(',');
  if (HNR.key === key && HNR.data) {
    hnrBuild();
    return;
  }
  if (HNR.busy) return;
  HNR.busy = 1;
  const h = GEO.size / 2,
    dx = h / GEO.kx,
    dy = h / 110574,
    bb = [GEO.lat - dy, GEO.lon - dx, GEO.lat + dy, GEO.lon + dx].map((v) => v.toFixed(6)).join(','),
    q = `[out:json][timeout:25];nwr["addr:housenumber"](${bb});out center tags;`;
  let err = '';
  for (const ep of [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]) {
    try {
      const ac = new AbortController(),
        to = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(ep + '?data=' + encodeURIComponent(q), { signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(),
        out = [];
      for (const e of j.elements || []) {
        const la = e.lat != null ? e.lat : e.center && e.center.lat,
          lo = e.lon != null ? e.lon : e.center && e.center.lon,
          n = e.tags && e.tags['addr:housenumber'];
        if (la == null || lo == null || !n) continue;
        const p = ll2xz(lo, la);
        const tg = e.tags || {};
        out.push({
          x: p[0],
          z: p[1],
          n: String(n),
          s: tg['addr:street'] || '',
          pc: tg['addr:postcode'] || '',
          c: tg['addr:city'] || '',
        });
      }
      HNR.data = out;
      HNR.key = key;
      HNR.busy = 0;
      HNR.msg = 'OSM: ' + out.length + ' Hausnummern';
      hnrBuild();
      try {
        if (hnrOn()) $('hud').textContent = HNR.msg;
      } catch (e) {
        logErr(e, 'hnrLoad');
      }
      return;
    } catch (e) {
      err = e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e.message || e);
    }
  }
  HNR.busy = 0;
  HNR.msg = 'Hausnummern nicht geladen (' + err + ')';
  try {
    if (hnrOn()) $('hud').textContent = HNR.msg;
  } catch (e) {
    logErr(e, 'hnrLoad');
  }
}
// lvis(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// labVis(): Erweiterung zusammengeführt, siehe 02-geodaten/080-alkis.js
// ctxBuild(): Erweiterung zusammengeführt, siehe 02-geodaten/070-baumkataster.js
/* Maus-Info: Gebäude (Adresse, Hausnummer, Flurstück), Straßen- und Gewässername unter dem Cursor */
function hvLine(g, ls, tolMin) {
  let best = null,
    bd = 1e9;
  for (const o of ls) {
    const l = o.l;
    if (!l || l.length < 2 || !o.n) continue;
    const tol = Math.max(tolMin, (o.w || 4) / 2 + 1);
    for (let k = 0; k < l.length - 1; k++) {
      const d = proj(g, l[k], l[k + 1]).d;
      if (d < tol && d < bd) {
        bd = d;
        best = o;
      }
    }
  }
  return best;
}
function hvExtra(g) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
  return inSite(g)
    ? ''
    : (() => {
        HNR.hvB = 0;
        try {
          let h = '';
          const parOf = (c) => {
            const a = (AL || []).find((x) => !x.cut && x.poly && inP(c, x.poly));
            return a ? 'Flurstück ' + esc(a.id) + '<br>' : '';
          };
          const pb = (S.bld || []).find((b) => b.fp && b.fp.length > 2 && inP(g, b.fp));
          if (pb) {
            HNR.hvB = 1;
            h +=
              '<b>' +
              esc(pb.name || pb.id) +
              '</b><br>' +
              (pb.use ? esc(pb.use) + '<br>' : '') +
              parOf(cen(pb.fp));
          } else {
            const cb = (GEO.blist || []).find((b) => b.o && b.o.length > 2 && inP(g, b.o));
            if (cb) {
              HNR.hvB = 1;
              const ad = HNR.data ? HNR.data.filter((d) => inP([d.x, d.z], cb.o)) : [];
              const p = cb.p || {};
              const st = ad.find((d) => d.s) || {};
              const nr = [...new Set(ad.map((d) => d.n))].join(', ');
              const l1 = ((st.s || p['addr:street'] || '') + (nr ? ' ' + nr : '')).trim(),
                l2 = ((st.pc || '') + ' ' + (st.c || '')).trim();
              h +=
                '<b>' +
                (esc(l1) || 'Bestandsgebäude') +
                '</b><br>' +
                (l2 ? esc(l2) + '<br>' : '') +
                parOf(cen(cb.o));
              if (!HNR.data && !HNR.busy && !HNR.tried) {
                HNR.tried = 1;
                hnrLoad();
              }
            }
          }
          if (!HNR.hvB) {
            const tm = Math.max(2, 6 * mpp());
            const R = hvLine(g, (GEO.acc && GEO.acc.names) || [], tm),
              Wt = hvLine(g, (GEO.acc && GEO.acc.line && GEO.acc.line.water) || [], tm);
            if (R) h += '<b>' + esc(R.n) + '</b><br>Straße<br>';
            else if (Wt) h += '<b>' + esc(Wt.n) + '</b><br>Gewässer<br>';
          }
          return h;
        } catch (e) {
          return '';
        }
      })();
}
