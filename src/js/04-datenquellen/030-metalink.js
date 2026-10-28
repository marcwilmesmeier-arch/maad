// ---- Metalink-Download-Manager (.meta4): Kacheln laden, SHA-256 prüfen, in Ordner oder Browser-Cache ablegen
const TCD = { db: null };
function tcOpen() {
  return (
    TCD.db ||
    (TCD.db = new Promise((ok, no) => {
      try {
        const q = indexedDB.open('lot_tiles', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('f');
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      } catch (e) {
        no(e);
      }
    }))
  );
}
async function tcOp(m, fn) {
  const d = await tcOpen();
  return new Promise((ok, no) => {
    const t = d.transaction('f', m),
      r = fn(t.objectStore('f'));
    t.oncomplete = () => ok(r && r.result);
    t.onerror = () => no(t.error);
    t.onabort = () => no(t.error);
  });
}
const tcName = (u) => decodeURIComponent(String(u).split(/[?#]/)[0].split('/').pop());
async function tcFind(E, N, pref) {
  const ks = await tcOp('readonly', (s) => s.getAllKeys()),
    re = new RegExp('(^|\\D)' + E + '_' + N + '(\\D|$)'),
    c = (ks || []).filter((k) => re.test(String(k)));
  return c.find((k) => pref.test(String(k))) || c[0] || null;
}
async function tcHit(u) {
  if (/^cache:\/\//.test(u)) {
    const m = /^cache:\/\/(\w+)\/(\d+)_(\d+)/.exec(u);
    let k = null;
    try {
      k = m && (await tcFind(m[2], m[3], m[1] === 'hh' ? /dom/i : /./));
    } catch (e) {
      logErr(e, 'tcHit');
    }
    if (!k)
      throw new Error(
        'HTTP 404 (nicht im Browser-Cache – Archiv unter „Metalink-Download → Kacheln importieren“ einspielen)',
      );
    return new Response(await tcOp('readonly', (s) => s.get(k)), { status: 200 });
  }
  try {
    if (!/bayernwolke\.de|geodaten\.bayern\.de/.test(u)) return null;
    const b = await tcOp('readonly', (s) => s.get(tcName(u)));
    return b ? new Response(b, { status: 200 }) : null;
  } catch (e) {
    return null;
  }
}
const tcCount = async () => {
  try {
    return await tcOp('readonly', (s) => s.count());
  } catch (e) {
    return 0;
  }
};
const MLK = {
  files: [],
  run: false,
  stop: false,
  done: 0,
  skip: 0,
  fail: 0,
  bytes: 0,
  tot: 0,
  errs: [],
  dir: null,
  mode: 'cache',
  conc: 3,
  flt: '',
  rad: '',
  verify: true,
  msg: '',
  src: '',
  url: '',
  cache: 0,
  t0: 0,
  show: false,
};
function mlParse(txt, src) {
  const x = new DOMParser().parseFromString(txt, 'application/xml');
  if (x.querySelector('parsererror')) throw new Error('keine gültige Metalink-Datei (XML-Fehler)');
  const F = [...x.getElementsByTagName('file')]
    .map((f) => {
      const g = (t) => f.getElementsByTagName(t),
        h = [...g('hash')].find((e) => /sha-?256/i.test(e.getAttribute('type') || '')),
        us = [...g('url')]
          .sort((a, b) => (+a.getAttribute('priority') || 50) - (+b.getAttribute('priority') || 50))
          .map((e) => e.textContent.trim())
          .filter(Boolean);
      return {
        name: f.getAttribute('name'),
        size: +(g('size')[0] || {}).textContent || 0,
        hash: h ? h.textContent.trim().toLowerCase() : '',
        urls: us,
        st: '',
        err: '',
      };
    })
    .filter((f) => f.name && f.urls.length);
  if (!F.length) throw new Error('Metalink enthält keine Dateien mit URL');
  MLK.files = F;
  MLK.src = src;
  MLK.done = MLK.skip = MLK.fail = MLK.bytes = 0;
  MLK.errs = [];
}
function mlSel() {
  const q = MLK.flt.trim().toLowerCase(),
    rad = parseFloat(MLK.rad),
    ok = (f) => {
      if (
        q &&
        !q
          .split(/[\s,]+/)
          .filter(Boolean)
          .some((t) => f.name.toLowerCase().includes(t))
      )
        return false;
      if (rad >= 0 && MLK.rad !== '') {
        if (!S.geo) return false;
        const m = /^(\d+)_(\d+)/.exec(f.name);
        if (!m) return false;
        const [px, py] = ll2utm(GEO.lon, GEO.lat, GEO.zone || 32),
          dx = +m[1] + 0.5 - px / 1000,
          dy = +m[2] + 0.5 - py / 1000;
        return Math.hypot(dx, dy) <= rad + 0.71;
      }
      return true;
    };
  return MLK.files.filter(ok);
}
async function mlLoadUrl() {
  MLK.msg = 'Lade Metalink …';
  mlUi();
  try {
    const u = MLK.url.trim();
    if (!u) throw new Error('URL fehlt');
    const r = await wfetch(u, 60000);
    mlParse(await r.text(), u);
    MLK.msg = '';
  } catch (e) {
    MLK.msg =
      'Fehler: ' +
      e.message +
      ' – Metalink-Server evtl. durch CORS gesperrt: CORS-Proxy eintragen oder die .meta4-Datei per „Datei wählen“ laden.';
  }
  mlUi();
}
function mlFile(inp) {
  const f = inp.files[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      mlParse(t, f.name);
      MLK.msg = '';
    } catch (e) {
      MLK.msg = 'Fehler: ' + e.message;
    }
    mlUi();
  });
  inp.value = '';
}
async function mlDir() {
  try {
    MLK.dir = await showDirectoryPicker({ mode: 'readwrite' });
    MLK.mode = 'dir';
  } catch (e) {
    if (e.name !== 'AbortError') MLK.msg = 'Ordner nicht wählbar: ' + e.message;
  }
  mlUi();
}
async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function mlHave(f) {
  try {
    if (MLK.mode === 'dir' && MLK.dir) {
      const fh = await MLK.dir.getFileHandle(f.name),
        fi = await fh.getFile();
      return fi.size === f.size || !f.size;
    }
    if (MLK.mode === 'cache') {
      const b = await tcOp('readonly', (s) => s.get(f.name));
      return !!b && (!f.size || b.size === f.size);
    }
  } catch (e) {
    logErr(e, 'mlHave');
  }
  return false;
}
async function mlPut(f, buf) {
  if (MLK.mode === 'dir') {
    const fh = await MLK.dir.getFileHandle(f.name, { create: true }),
      w = await fh.createWritable();
    await w.write(buf);
    await w.close();
  } else if (MLK.mode === 'cache') {
    await tcOp('readwrite', (s) => s.put(new Blob([buf]), f.name));
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf]));
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4e4);
  }
}
async function mlOne(f) {
  f.st = 'lädt';
  f.err = '';
  if (await mlHave(f)) {
    f.st = 'vorhanden';
    MLK.skip++;
    return;
  }
  for (let round = 0; round < 2 && !MLK.stop; round++) {
    for (const u of f.urls) {
      if (MLK.stop) break;
      for (const via of viaOrder(u)) {
        if (via && !GEO.proxy) break;
        try {
          const ac = new AbortController(),
            to = setTimeout(() => ac.abort(), 600000);
          let r;
          try {
            r = await fetch(via ? viaProxy(u) : u, { signal: ac.signal });
          } finally {
            clearTimeout(to);
          }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const buf = await r.arrayBuffer();
          if (f.size && buf.byteLength !== f.size)
            throw new Error('Größe ' + buf.byteLength + ' ≠ ' + f.size);
          if (MLK.verify && f.hash) {
            const h = await sha256(buf);
            if (h !== f.hash) throw new Error('SHA-256 stimmt nicht');
          }
          await mlPut(f, buf);
          f.st = 'ok';
          f.err = '';
          MLK.done++;
          MLK.bytes += buf.byteLength;
          return;
        } catch (e) {
          f.err = (via ? 'Proxy: ' : '') + e.message;
          if (/^HTTP 4\d\d/.test(e.message)) break;
        }
      }
    }
  }
  if (MLK.stop) {
    f.st = '';
    return;
  }
  f.st = 'Fehler';
  MLK.fail++;
  MLK.errs.push(f.name + ': ' + f.err);
}
async function mlStart(L0) {
  if (MLK.run) return;
  const L = L0 || mlSel().filter((f) => f.st !== 'ok' && f.st !== 'vorhanden');
  if (!L.length) {
    MLK.msg = 'Nichts zu laden (alles vorhanden oder Filter leer).';
    mlUi();
    return;
  }
  if (MLK.mode === 'dir' && !MLK.dir) {
    MLK.msg = 'Bitte zuerst einen Zielordner wählen.';
    mlUi();
    return;
  }
  if (
    MLK.mode === 'save' &&
    L.length > 40 &&
    !confirm(L.length + ' Einzel-Downloads auslösen? Besser Ordner oder Browser-Cache nutzen.')
  )
    return;
  MLK.run = true;
  MLK.stop = false;
  MLK.fail = 0;
  MLK.errs = [];
  L.forEach((f) => {
    if (f.st === 'Fehler') f.st = '';
  });
  MLK.tot = L.length;
  MLK.t0 = Date.now();
  let i = 0;
  const tick = setInterval(mlUi, 700);
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(8, MLK.conc | 0)) }, async () => {
      while (!MLK.stop && i < L.length) {
        const f = L[i++];
        await mlOne(f);
      }
    }),
  );
  clearInterval(tick);
  MLK.run = false;
  MLK.cache = await tcCount();
  MLK.msg = MLK.stop ? 'Abgebrochen.' : 'Fertig.';
  mlUi();
}
function mlStop() {
  MLK.stop = true;
}
async function mlClearCache() {
  if (!confirm('Alle im Browser-Cache gespeicherten Kacheln löschen?')) return;
  try {
    await tcOp('readwrite', (s) => s.clear());
  } catch (e) {
    logErr(e, 'mlClearCache');
  }
  MLK.cache = 0;
  MLK.files.forEach((f) => {
    if (MLK.mode === 'cache' && (f.st === 'ok' || f.st === 'vorhanden')) f.st = '';
  });
  mlUi();
}
function mlBytes(n) {
  return n >= 1e9
    ? (n / 1e9).toFixed(2) + ' GB'
    : n >= 1e6
      ? (n / 1e6).toFixed(1) + ' MB'
      : Math.round(n / 1e3) + ' kB';
}
const MLP = [
  [
    'DGM1 München (Gemeinde 09162000)',
    'https://geodaten.bayern.de/odd/a/dgm/dgm1/meta/metalink/09162000.meta4',
  ],
  ['LoD2 Bayern gesamt (09)', 'https://geodaten.bayern.de/odd/a/lod2/meta/metalink/09.meta4'],
];
function mlUi() {
  let el = $('mlm');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mlm';
    document.body.appendChild(el);
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) mlClose();
    });
    addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && $('mlm') && $('mlm').style.display === 'flex') {
          mlClose();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }
  if (!MLK.show) {
    el.style.display = 'none';
    return;
  }
  const sel = mlSel(),
    tot = sel.reduce((a, f) => a + f.size, 0),
    ok = sel.filter((f) => f.st === 'ok' || f.st === 'vorhanden').length,
    pr = MLK.run
      ? Math.min(100, Math.round(((MLK.done + MLK.skip + MLK.fail) / Math.max(1, MLK.tot)) * 100))
      : 0,
    el_ = MLK.run ? (Date.now() - MLK.t0) / 1000 : 0,
    fsa = typeof showDirectoryPicker === 'function';
  const keep = el.querySelector('.srcb'),
    sc = keep ? keep.scrollTop : 0,
    sh = sel.slice(0, 200);
  el.innerHTML = `<div class="srcw" role="dialog" aria-label="Metalink-Download-Manager"><div class="srch"><b>Metalink-Download-Manager</b><span style="flex:1"></span><button class="sm" onclick="mlClose()">Schließen ✕</button></div><div class="srcb">
<div class="stn" style="margin:0 0 8px">Lädt die in einer <code>.meta4</code>-Datei aufgeführten Kacheln (z. B. Bayern DGM1/LoD2 je Gemeinde von <i>geodaten.bayern.de</i>), wechselt bei Fehlern automatisch zwischen den Spiegelservern, prüft die SHA-256-Summe und überspringt bereits vorhandene Dateien (Abbruch und Fortsetzen möglich). Im <b>Browser-Cache</b> abgelegte Kacheln werden von „Gebäude“ und „Gelände“ automatisch vor dem Online-Abruf verwendet.</div>
<div class="opt"><div class="tbar" style="margin:0"><label class="stn" style="margin:0">Metalink-URL <input type="text" style="width:380px" list="mlp" placeholder="https://geodaten.bayern.de/odd/a/dgm/dgm1/meta/metalink/09162000.meta4" value="${esc(MLK.url)}" oninput="MLK.url=this.value"></label><datalist id="mlp">${MLP.map((p) => `<option value="${esc(p[1])}">${esc(p[0])}</option>`).join('')}</datalist><button class="sm"${MLK.run ? ' disabled' : ''} onclick="mlLoadUrl()">URL laden</button><label class="sm" style="cursor:pointer;border:1px solid var(--ln);border-radius:6px;padding:4px 8px">Datei wählen …<input type="file" accept=".meta4,.metalink,.xml" style="display:none" onchange="mlFile(this)"></label><label class="sm" style="cursor:pointer;border:1px solid var(--ln);border-radius:6px;padding:4px 8px" title="Bereits heruntergeladene Kacheln (.zip/.gml/.gpkg) in den Browser-Cache übernehmen">Kacheln importieren …<input type="file" multiple style="display:none" onchange="mlImport(this)"></label></div><div class="stn" style="margin:0">Für Bayern bestimmt maad die benötigten LoD2- und DGM1-Kacheln beim Laden eines Ausschnitts <b>automatisch</b> und lädt sie über diesen Manager in den Browser-Cache (Projekt-Status zeigt das Ergebnis).</div>
<div class="stn" style="margin:0">Der Abruf der URL kann im Browser an CORS scheitern (dann CORS-Proxy in der Datenquellen-Leiste eintragen oder die Datei herunterladen und hier wählen).</div></div>
${
  MLK.files.length
    ? `<div class="opt"><div><b>${esc(MLK.src)}</b>: ${MLK.files.length.toLocaleString('de')} Dateien, ${mlBytes(MLK.files.reduce((a, f) => a + f.size, 0))}</div>
<div class="tbar" style="margin:0"><label class="stn" style="margin:0">Filter (Teile des Namens, mit Komma) <input type="text" style="width:170px" placeholder="z. B. 692_5337, 693_" value="${esc(MLK.flt)}" onchange="MLK.flt=this.value;mlUi()"></label><label class="stn" style="margin:0">Umkreis um Projekt (km) <input type="text" style="width:60px" placeholder="alle" value="${esc(MLK.rad)}" ${S.geo ? '' : 'disabled title="erst Projekt laden"'} onchange="MLK.rad=this.value;mlUi()"></label><label class="stn" style="margin:0">parallel <select onchange="MLK.conc=+this.value">${[1, 2, 3, 4, 6, 8].map((n) => `<option${MLK.conc === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label><label class="stn" style="margin:0"><input type="checkbox"${MLK.verify ? ' checked' : ''} onchange="MLK.verify=this.checked"> SHA-256 prüfen</label></div>
<div class="tbar" style="margin:0"><span class="stn" style="margin:0">Ziel:</span><label><input type="radio" name="mlm"${MLK.mode === 'cache' ? ' checked' : ''} onchange="MLK.mode='cache';mlUi()"> Browser-Cache (von maad genutzt${MLK.cache ? ', ' + MLK.cache + ' Dateien' : ''})</label><label><input type="radio" name="mlm"${MLK.mode === 'dir' ? ' checked' : ''}${fsa ? '' : ' disabled'} onchange="MLK.mode='dir';if(!MLK.dir)mlDir();else mlUi()"> Ordner${MLK.dir ? ' „' + esc(MLK.dir.name) + '“' : ''}${fsa ? '' : ' (nur Chrome/Edge)'}</label>${MLK.mode === 'dir' ? `<button class="sm" onclick="mlDir()">Ordner wählen …</button>` : ''}<label><input type="radio" name="mlm"${MLK.mode === 'save' ? ' checked' : ''} onchange="MLK.mode='save';mlUi()"> Einzeldownloads</label><button class="sm" onclick="mlClearCache()"${MLK.cache ? '' : ' disabled'}>Cache leeren</button></div>
<div class="tbar" style="margin:0"><b>${sel.length.toLocaleString('de')} ausgewählt (${mlBytes(tot)})</b> · ${ok} schon geladen<button class="pri" style="width:auto"${MLK.run || !sel.length ? ' disabled' : ''} onclick="mlStart()">Download starten</button><button class="sm"${MLK.run ? '' : ' disabled'} onclick="mlStop()">Stopp</button></div>
${MLK.run || MLK.done || MLK.fail || MLK.skip ? `<div style="height:8px;background:var(--ln);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pr}%;background:#2e7d32"></div></div><div class="stn" style="margin:0">${MLK.done} geladen (${mlBytes(MLK.bytes)}${el_ > 2 ? ', ' + mlBytes(MLK.bytes / el_) + '/s' : ''}), ${MLK.skip} übersprungen, ${MLK.fail} Fehler</div>` : ''}</div>
<table class="stb"><thead><tr><th style="width:200px">Datei</th><th style="width:90px">Größe</th><th style="width:100px">Status</th><th>Meldung</th></tr></thead><tbody>${sh.map((f) => `<tr style="cursor:default"><td>${esc(f.name)}</td><td>${mlBytes(f.size)}</td><td>${f.st === 'ok' ? '<i class="dot ok"></i> geladen' : f.st === 'vorhanden' ? '<i class="dot ok"></i> vorhanden' : f.st === 'Fehler' ? '<i class="dot fail"></i> Fehler' : f.st || '–'}</td><td>${esc(f.err)}</td></tr>`).join('')}</tbody></table>${sel.length > sh.length ? `<div class="stn">… und ${(sel.length - sh.length).toLocaleString('de')} weitere (Anzeige auf 200 begrenzt)</div>` : ''}`
    : ''
}
${MLK.msg ? `<div class="stn" style="margin-top:8px;color:var(--tx)">${esc(MLK.msg)}</div>` : ''}</div></div>`;
  el.style.display = 'flex';
  const nb = el.querySelector('.srcb');
  if (nb) nb.scrollTop = sc;
}

// Automatik für Bayern: passende LoD2-/DGM1-Kacheln für den gewählten Ausschnitt bestimmen und über den Download-Manager in den Browser-Cache laden
function mlTiles(lon, lat, size) {
  const out = [],
    cv = (zone, sz, fn, ext, marg, kk) => {
      const h = size / 2 + marg,
        [cx, cy] = ll2utm(lon, lat, zone),
        st = 1000 * sz;
      for (let E = Math.floor((cx - h) / st) * sz; E <= Math.floor((cx + h) / st) * sz; E += sz)
        for (let N = Math.floor((cy - h) / st) * sz; N <= Math.floor((cy + h) / st) * sz; N += sz)
          out.push({
            name: ext === '.tif' ? tcName(fn(E, N)[0]) : E + '_' + N + ext,
            size: 0,
            hash: '',
            urls: fn(E, N).filter((u) => u.endsWith(ext)),
            st: '',
            err: '',
            k: kk || (ext === '.gml' ? 'LoD2' : ext === '.tif' ? 'DOM' : 'DGM1'),
          });
    };
  cv(32, CG.by.sz, CG.by.tile, '.gml', 0);
  cv(32, 1, TERR.by.dgm.tile, '.tif', size * 0.05 + 30, 'DGM1');
  if (S.canopyOn !== false && TERR.by.dom && TERR.by.dom.tile)
    cv(32, 1, TERR.by.dom.tile, '.tif', size * 0.05 + 30);
  return out;
}
async function mlAuto(lon, lat, size, kinds) {
  GEO.dlMsg = '';
  if (MLK.run) return;
  const st = await bundeslandC(lon, lat);
  if (!st || st.key !== 'by') return;
  const L = mlTiles(lon, lat, size).filter((f) => !kinds || kinds.includes(f.k));
  if (!L.length || L.length > 40) return;
  const pm = MLK.mode,
    pd = MLK.dir,
    pf = MLK.files,
    ps = MLK.src;
  MLK.mode = 'cache';
  MLK.files = L;
  MLK.src = 'Automatisch für den Ausschnitt';
  const t = setInterval(
    () =>
      gst(
        `Bayern: Download-Manager lädt Kacheln ${MLK.done + MLK.skip + MLK.fail}/${L.length} (${mlBytes(MLK.bytes)}) …`,
      ),
    500,
  );
  try {
    await mlStart(L);
  } finally {
    clearInterval(t);
  }
  const bad = L.filter((f) => f.st === 'Fehler');
  MLK.mode = pm;
  MLK.dir = pd;
  MLK.cache = await tcCount();
  GEO.dlMsg =
    `Download-Manager (Bayern): ${L.length - bad.length} von ${L.length} Kacheln im Cache` +
    (bad.length
      ? `, ${bad.length} fehlgeschlagen (${bad[0].name}: ${bad[0].err}) – CORS-Proxy eintragen oder Kacheln im Download-Manager importieren.`
      : '.');
  if (!MLK.show) {
    MLK.files = pf;
    MLK.src = ps;
  }
}
async function zipEntries(f) {
  const rd = async (a, b) => new DataView(await f.slice(a, b).arrayBuffer()),
    sz = f.size,
    tl = Math.min(sz, 70000),
    t = await rd(sz - tl, sz);
  let e = -1;
  for (let i = tl - 22; i >= 0; i--)
    if (t.getUint32(i, true) === 0x06054b50) {
      e = i;
      break;
    }
  if (e < 0) throw new Error('kein ZIP');
  let n = t.getUint16(e + 10, true),
    cs = t.getUint32(e + 12, true),
    co = t.getUint32(e + 16, true);
  if (co === 0xffffffff || n === 0xffff) {
    const lo = await rd(sz - tl + e - 20, sz - tl + e);
    if (lo.getUint32(0, true) === 0x07064b50) {
      const z = await rd(Number(lo.getBigUint64(8, true)), Number(lo.getBigUint64(8, true)) + 56);
      n = Number(z.getBigUint64(32, true));
      cs = Number(z.getBigUint64(40, true));
      co = Number(z.getBigUint64(48, true));
    }
  }
  const cd = await f.slice(co, co + cs).arrayBuffer(),
    dv = new DataView(cd),
    u8 = new Uint8Array(cd),
    out = [],
    dec = new TextDecoder();
  let p = 0;
  while (p + 46 <= cd.byteLength && dv.getUint32(p, true) === 0x02014b50) {
    const meth = dv.getUint16(p + 10, true);
    let c = dv.getUint32(p + 20, true),
      u = dv.getUint32(p + 24, true),
      nl = dv.getUint16(p + 28, true),
      xl = dv.getUint16(p + 30, true),
      cl = dv.getUint16(p + 32, true),
      lh = dv.getUint32(p + 42, true),
      name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    for (let q = p + 46 + nl, qe = q + xl; q + 4 <= qe;) {
      const id = dv.getUint16(q, true),
        l = dv.getUint16(q + 2, true);
      if (id === 1) {
        let r = q + 4;
        if (u === 0xffffffff) {
          u = Number(dv.getBigUint64(r, true));
          r += 8;
        }
        if (c === 0xffffffff) {
          c = Number(dv.getBigUint64(r, true));
          r += 8;
        }
        if (lh === 0xffffffff) lh = Number(dv.getBigUint64(r, true));
      }
      q += 4 + l;
    }
    out.push({ name, meth, c, u, lh });
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function zipEntryBlob(f, e) {
  const h = await f.slice(e.lh, e.lh + 30).arrayBuffer(),
    d = new DataView(h),
    o = e.lh + 30 + d.getUint16(26, true) + d.getUint16(28, true),
    raw = f.slice(o, o + e.c);
  if (e.meth === 0) return raw;
  if (e.meth !== 8) throw new Error('ZIP-Methode ' + e.meth);
  return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
}
async function mlImport(inp) {
  const fs = [...inp.files];
  let n = 0,
    bad = 0;
  for (const f of fs) {
    try {
      let es = null;
      if (/\.zip$/i.test(f.name)) {
        try {
          es = (await zipEntries(f)).filter((e) => !/\/$/.test(e.name));
        } catch (x) {
          es = null;
        }
      }
      if (es && es.length > 1) {
        const T = es.filter((e) => /\.(tiff?|txt|xyz|gml|gpkg|zip|csv)$/i.test(e.name));
        let i = 0;
        for (const e of T) {
          i++;
          if (i % 10 === 1) {
            MLK.msg = `Archiv ${f.name}: Datei ${i}/${T.length} wird in den Cache übernommen …`;
            mlUi();
            await new Promise((r) => setTimeout(r, 0));
          }
          try {
            const b = await zipEntryBlob(f, e),
              nm = e.name.split('/').pop();
            await tcOp('readwrite', (s) => s.put(b, nm));
            n++;
          } catch (x) {
            bad++;
          }
        }
      } else {
        await tcOp('readwrite', (s) => s.put(f, f.name));
        n++;
      }
    } catch (e) {
      bad++;
    }
  }
  inp.value = '';
  MLK.cache = await tcCount();
  MLK.msg =
    n +
    ' Dateien in den Browser-Cache übernommen' +
    (bad ? ', ' + bad + ' fehlgeschlagen' : '') +
    '. Beim nächsten Laden werden sie automatisch genutzt (Archive mit mehreren Dateien werden einzeln entpackt).';
  mlUi();
}
function mlOpen() {
  MLK.show = true;
  mlUi();
  tcCount().then((n) => {
    MLK.cache = n;
    if (MLK.show) mlUi();
  });
}
function mlClose() {
  MLK.show = false;
  mlUi();
}
function srcClose() {
  const el = $('srcm');
  if (el) el.style.display = 'none';
}
function setPanel() {
  const r = GEO.rep,
    dots = r
      ? ['gb', 'tr', 'fl', 'ge']
          .map((t) => `<i class="dot ${r[t].st}" title="${esc(r[t].head)}"></i>`)
          .join(' ')
      : '';
  return `<div class="setd"><button class="sm" style="width:100%" onclick="srcOpen()">Einstellungen &amp; Datenquellen nach Bundesland …</button><div class="stn">Testen, Quellen ändern, Optionen, Dateien, CORS-Proxy und Schlüssel – alles in dieser Übersicht.${dots ? ' Letzte Prüfung: ' + dots : ''}</div></div>`;
}
