// ---- Demokarte: geladenen Ausschnitt sichern (IndexedDB + Datei) und offline wieder öffnen
const SNAPL = [
  'building',
  'transportation',
  'transportation_name',
  'water',
  'waterway',
  'park',
  'landcover',
  'landuse',
];
function snapTiles(tl) {
  return tl.map((o) => {
    const t = {};
    SNAPL.forEach((k) => {
      if (o.t && o.t[k]) t[k] = o.t[k];
    });
    return { x: o.x, y: o.y, z: o.z, t };
  });
}
const snapB64 = (u) => {
  let s = '';
  for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
  return btoa(s);
};
const snapU8 = (b) => {
  const s = atob(b),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
};
const snapEnc = (k, v) => {
  if (ArrayBuffer.isView(v) && !(v instanceof DataView))
    return { __ta: v.constructor.name, d: snapB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
  if (typeof v === 'number' && isFinite(v) && !Number.isInteger(v)) return +v.toPrecision(9);
  return v;
};
const snapDec = (k, v) => (v && v.__ta && v.d != null ? new globalThis[v.__ta](snapU8(v.d).buffer) : v);
async function snapPack() {
  const s = GEO.snap;
  if (!s) throw new Error('Es sind noch keine Kartendaten geladen.');
  const st = new Blob([JSON.stringify(s, snapEnc)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function snapUnpack(u8) {
  const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(st).text(), snapDec);
}
const idbP = (fn) =>
  new Promise((res, rej) => {
    try {
      const r = indexedDB.open('lot', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result,
          tx = db.transaction('kv', 'readwrite'),
          o = fn(tx.objectStore('kv'));
        tx.oncomplete = () => {
          db.close();
          res(o.result);
        };
        tx.onerror = () => rej(tx.error);
      };
    } catch (e) {
      rej(e);
    }
  });
const idbGet = (k) => idbP((s) => s.get(k)),
  idbSet = (k, v) => idbP((s) => s.put(v, k));
async function demoBytes() {
  const e = document.getElementById('lotDemo');
  if (e && e.textContent.trim().length > 100) return snapU8(e.textContent.trim());
  try {
    return (await idbGet('demo')) || null;
  } catch (_) {
    return null;
  }
}
async function demoProbe() {
  try {
    const u = await demoBytes();
    S.demoOk = !!u;
    if (u && !S.demoLabel) {
      try {
        const e = document.getElementById('lotDemo');
        S.demoLabel = (e && e.dataset.label) || (await idbGet('demoLabel')) || 'Bielefeld';
      } catch (_) {
        S.demoLabel = 'Bielefeld';
      }
    }
  } catch (_) {
    S.demoOk = false;
  }
  if ($('wz') && $('wz').style.display === 'flex' && WZ.step === 1) wzRender();
}
async function demoSave() {
  const btn = $('demoSaveB');
  try {
    if (btn) btn.disabled = true;
    gst('Sichere Demokarte …');
    const u = await snapPack(),
      lab = GEO.snap.label || 'Bielefeld';
    try {
      await idbSet('demo', u);
      await idbSet('demoLabel', lab);
    } catch (e) {
      console.warn(e);
    }
    S.demoOk = true;
    S.demoLabel = lab;
    const fn = 'lot_demokarte_' + (lab.replace(/[^\w\-äöüÄÖÜß]+/g, '_').slice(0, 40) || 'karte') + '.lotdemo',
      blob = new Blob([u], { type: 'application/octet-stream' });
    let dl = null;
    try {
      dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) {
      logErr(e, 'demoSave');
    }
    if (dl) await dl.save({ filename: fn, data: blob });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    }
    gst(
      'Demokarte gesichert (' +
        f1(u.length / 1048576, 1) +
        ' MB) – im Projekt-Assistenten unter „Demokarte öffnen“ verfügbar.',
    );
  } catch (e) {
    if (!(e && e.code === 'declined')) {
      console.error(e);
      gst('Demokarte konnte nicht gesichert werden: ' + ((e && e.message) || e));
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function demoLoad(u8, bg) {
  gst('Öffne Demokarte …');
  const s = await snapUnpack(u8);
  const r = await geoRun(s.lon, s.lat, s.size, s.label, s);
  if (r.ok) {
    if (!bg) {
      newProjectReset();
      S.project = {
        id: projId(),
        name: 'Demokarte ' + (s.label || '').split(',')[0],
        label: s.label,
        size: s.size,
        lon: s.lon,
        lat: s.lat,
      };
      updPj();
    }
    wzClose();
    S.tab = 'Planen';
    nav();
    rr();
  } else {
    alert(r.msg);
  }
}
async function demoOpen() {
  try {
    const u = await demoBytes();
    if (!u) {
      alert('Noch keine Demokarte gesichert.');
      return;
    }
    await demoLoad(u);
  } catch (e) {
    console.error(e);
    alert('Demokarte konnte nicht geöffnet werden: ' + ((e && e.message) || e));
  }
}
async function demoFile(inp) {
  const f = inp.files && inp.files[0];
  inp.value = '';
  if (!f) return;
  try {
    await demoLoad(new Uint8Array(await f.arrayBuffer()));
  } catch (e) {
    console.error(e);
    alert('Datei konnte nicht gelesen werden: ' + ((e && e.message) || e));
  }
}
setTimeout(demoProbe, 50);
// ---- Startseite: Demokarte von oben, Logo -> Zoom auf Grundstück -> Projekt anlegen / öffnen
const HOME = {
  open: false,
  st: 0,
  mx: 0,
  my: 0,
  pmx: 0,
  pmy: 0,
  az0: 0.6,
  tl: 0,
  ready: false,
  cnt: 0,
  hl: null,
  anc: [],
  cp: [],
  saved: null,
  sub: 'main',
  par: null,
  ln: [],
  dt: [],
  rg: [],
};
const idbDel = (k) => idbP((s) => s.delete(k));
const projSig = () =>
  projBld() +
  '|' +
  JSON.stringify(S.lab || []) +
  '|' +
  JSON.stringify(S.areas || []) +
  '|' +
  JSON.stringify(projExtra(false));
const projStrip = (o) =>
  Array.isArray(o)
    ? o.map(projStrip)
    : o && typeof o === 'object'
      ? Object.fromEntries(
          Object.entries(o)
            .filter(([k]) => k[0] !== '_')
            .map(([k, v]) => [k, projStrip(v)]),
        )
      : o;
const projBld = () => JSON.stringify(projStrip(S.bld));
const projId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
async function projSave() {
  const p = S.project;
  if (!p || !p.id || !GEO.snap || !S.geo) return;
  try {
    const js = projBld();
    if (!(await idbGet('snap:' + p.id))) await idbSet('snap:' + p.id, await snapPack());
    const old = await idbGet('proj:' + p.id);
    let thumb = old && old.thumb;
    try {
      thumb = layShot(
        { m3: true, tx: V.tx, tz: V.tz, d: Math.max(V.d, 220), az: V.az, pol: Math.min(V.pol, 1.1) },
        480,
        300,
        0.7,
      );
    } catch (e) {
      logErr(e, 'projSave');
    }
    const rec = {
      id: p.id,
      name: p.name,
      label: p.label || '',
      size: p.size || GEO.size,
      t: Date.now(),
      bld: JSON.parse(js),
      lab: JSON.parse(JSON.stringify(S.lab || [])),
      areas: JSON.parse(JSON.stringify(S.areas || [])),
      x: projExtra(true),
      thumb,
      n: S.bld.length,
      lon: p.lon != null ? p.lon : GEO.lon,
      lat: p.lat != null ? p.lat : GEO.lat,
    };
    await idbSet('proj:' + p.id, rec);
    let ix = (await idbGet('projIdx')) || [];
    ix = ix.filter((x) => x.id !== p.id);
    ix.unshift({
      id: p.id,
      name: p.name,
      label: rec.label,
      t: rec.t,
      n: rec.n,
      thumb,
      lon: rec.lon,
      lat: rec.lat,
    });
    await idbSet('projIdx', ix);
    p._last = projSig();
  } catch (e) {
    console.warn('Projekt speichern:', e);
  }
}

async function planSave() {
  try {
    const pl = {
      v: 1,
      lon: GEO.lon,
      lat: GEO.lat,
      name: (S.project && S.project.name) || 'Planung',
      par: S.par ? { id: S.par.id, poly: S.par.poly } : null,
      bld: JSON.parse(projBld()),
      areas: S.areas || [],
      lab: S.lab || [],
      x: projExtra(true),
      view: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol },
    };
    const blob = new Blob([JSON.stringify(pl)], { type: 'application/json' }),
      fn =
        'maad_planung_' + (pl.name.replace(/[^\w\-äöüÄÖÜß]+/g, '_').slice(0, 40) || 'planung') + '.lotplan';
    let dl = null;
    try {
      dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) {
      logErr(e, 'planSave');
    }
    if (dl) await dl.save({ filename: fn, data: blob });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    }
    gst('Planung gesichert: ' + fn);
  } catch (e) {
    if (!(e && e.code === 'declined')) {
      console.error(e);
      gst('Planung konnte nicht gesichert werden: ' + ((e && e.message) || e));
    }
  }
}
async function projList() {
  try {
    return (await idbGet('projIdx')) || [];
  } catch (_) {
    return [];
  }
}
async function projOpen(id) {
  try {
    homeUndo();
    const rec = await idbGet('proj:' + id),
      sn = await idbGet('snap:' + id);
    if (!rec || !sn) throw new Error('Projekt nicht gefunden.');
    $('hSide').innerHTML =
      '<h2>Öffne „' + esc(rec.name) + '“ …</h2><div class="sub">Karte und Gebäude werden geladen.</div>';
    const s = await snapUnpack(sn);
    S.vanim = null;
    GEO.keepView = rec.x && rec.x.v && rec.x.view ? rec.x : 0;
    HOME.hold = 1;
    bootCur(1);
    await new Promise((r) => setTimeout(r, 60));
    const r = await geoRun(s.lon, s.lat, s.size, s.label, s);
    if (!r.ok) throw new Error(r.msg);
    newProjectReset();
    S.project = { id, name: rec.name, label: rec.label, size: rec.size, lon: s.lon, lat: s.lat };
    projApplyPre(rec.x);
    load(rec.bld);
    lbRebuild(rec.lab);
    S.areas = JSON.parse(JSON.stringify(rec.areas || []));
    S.areaN = S.areas.length;
    areasApply();
    S.n = 1 + Math.max(0, ...S.bld.map((b) => +(/(\d+)$/.exec(b.id) || [0, 0])[1]));
    projApplyPost(rec.x);
    updPj();
    S.project._last = rec.x ? projSig() : '';
    HOME.hold = 0;
    homeClose();
    projApplyView(rec.x);
    S.tab = 'Planen';
    nav();
    tool('v');
    rr();
    GEO.keepView = 0;
    bootCur(0);
  } catch (e) {
    HOME.hold = 0;
    GEO.keepView = 0;
    bootCur(0);
    console.error(e);
    alert('Projekt konnte nicht geöffnet werden: ' + ((e && e.message) || e));
    homePanel('open');
  }
}
async function projDel(id, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm('Projekt endgültig löschen?')) return;
  try {
    await idbDel('proj:' + id);
    await idbDel('snap:' + id);
    await idbSet(
      'projIdx',
      ((await idbGet('projIdx')) || []).filter((x) => x.id !== id),
    );
  } catch (e) {
    logErr(e, 'projDel');
  }
  homePanel('open');
  try {
    hmLoad();
  } catch (e) {
    logErr(e, 'projDel');
  }
}
setInterval(() => {
  const p = S.project;
  if (p && p.id && !HOME.open && S.geo && p._last !== projSig()) projSave();
}, 4000);
const projFlush = () => {
  const p = S.project;
  if (p && p.id && !HOME.open && S.geo) projSave();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) projFlush();
});
addEventListener('pagehide', projFlush);
