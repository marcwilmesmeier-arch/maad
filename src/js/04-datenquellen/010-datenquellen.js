// ---- Datenquellen-Übersicht je Bundesland (Kontext-Tab, ausklappbar). Wird aus den Registries CG, TKAT, TERR, ALS/ALQ/BLX, LOD3S, TFILES erzeugt – neue Einträge dort erscheinen hier automatisch.
// ---- Datenquellen testen & anpassen (aus der Übersicht): Erreichbarkeit prüfen, kleinen Probe-Ausschnitt laden, Adresse ändern, speichern, neu prüfen
const STP = {
  nrw: [6.9603, 50.9375, 'Köln'],
  by: [11.5755, 48.1374, 'München'],
  bw: [9.1829, 48.7758, 'Stuttgart'],
  ni: [9.732, 52.3759, 'Hannover'],
  he: [8.6821, 50.1109, 'Frankfurt'],
  st: [11.6276, 52.1205, 'Magdeburg'],
  sn: [13.7373, 51.0504, 'Dresden'],
  th: [11.0299, 50.9848, 'Erfurt'],
  bb: [13.0645, 52.3906, 'Potsdam'],
  mv: [11.4125, 53.6355, 'Schwerin'],
  sh: [10.1228, 54.3233, 'Kiel'],
  hh: [9.9937, 53.5511, 'Hamburg'],
  hb: [8.8017, 53.0793, 'Bremen'],
  be: [13.405, 52.52, 'Berlin'],
  sl: [6.9969, 49.2402, 'Saarbrücken'],
  rp: [8.2711, 50.0, 'Mainz'],
};
const TB = { busy: '', msg: '' },
  OVR = { gb: {}, fl: {}, ge: {}, tr: {} },
  SRE = {};
const O0 = {
  CG: Object.assign({}, CG),
  ALS: Object.assign({}, ALS),
  TERR: Object.assign({}, TERR),
  TKAT: Object.assign({}, TKAT),
};
function ovrSave() {
  try {
    localStorage.setItem('lot_ovr', JSON.stringify(OVR));
  } catch (e) {
    logErr(e, 'ovrSave');
  }
}
function ovrApply() {
  const ks = Object.keys(BLN),
    rs = (R, O, k) => {
      if (O[k] === undefined) delete R[k];
      else R[k] = O[k];
    };
  for (const k of ks) {
    rs(CG, O0.CG, k);
    rs(ALS, O0.ALS, k);
    rs(TERR, O0.TERR, k);
    rs(TKAT, O0.TKAT, k);
  }
  for (const k in OVR.gb) {
    const o = OVR.gb[k];
    if (!o.tpl) continue;
    CG[k] = {
      key: k,
      name: BLN[k],
      src: o.src || 'eigene Quelle',
      sz: +o.sz || 2,
      zone: +o.zone || 32,
      zip: /\.zip/i.test(o.tpl),
      custom: 1,
      tile: (E, N) => [o.tpl.replace(/\{E\}/g, E).replace(/\{N\}/g, N)],
    };
  }
  for (const k in OVR.fl) {
    const o = OVR.fl[k];
    if (o.url) ALS[k] = [{ u: o.url }];
  }
  const mkv = (u) =>
    u.includes('{E}') ? { u: 'tile', tile: (E, N) => [u.replace(/\{E\}/g, E).replace(/\{N\}/g, N)] } : { u };
  for (const k in OVR.ge) {
    const o = OVR.ge[k],
      b = O0.TERR[k] || { name: BLN[k], src: 'eigene Quelle', z: [32] };
    if (!o.dgm && !o.dom) continue;
    const t = Object.assign({}, b, { custom: 1, z: o.zone ? [+o.zone] : b.z });
    if (o.dgm) t.dgm = mkv(o.dgm);
    if (o.dom) t.dom = mkv(o.dom);
    TERR[k] = t;
  }
  for (const k in OVR.tr) {
    const o = OVR.tr[k];
    if (o.url)
      TKAT[k] = {
        name: BLN[k],
        src: o.src || 'eigene Quelle',
        u: o.url,
        types: String(o.types || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        zone: +o.zone || 32,
        g: 1,
        custom: 1,
      };
  }
}
try {
  Object.assign(OVR, JSON.parse(localStorage.getItem('lot_ovr') || '{}'));
  for (const t of ['gb', 'fl', 'ge', 'tr']) OVR[t] = OVR[t] || {};
} catch (e) {
  logErr(e, 'init');
}
ovrApply();
GEO.tests = {};
function srPt(k) {
  const rp = GEO.rep;
  if (rp && rp.key === k && GEO.lon && S.geo)
    return { lon: GEO.lon, lat: GEO.lat, label: 'Projektstandort', proj: 1 };
  const p = STP[k];
  return { lon: p[0], lat: p[1], label: p[2] + ' (Teststandort)' };
}
async function withGeo(pt, k, fn) {
  const s = {
    lon: GEO.lon,
    lat: GEO.lat,
    kx: GEO.kx,
    a: GEO.alkCustom,
    w1: GEO.wcsDgm,
    w2: GEO.wcsDom,
    l2: GEO.lod2Tpl,
    l2on: S.lod2On,
    g: gst,
    p3: GEO.lod3Pick,
    o3: S.lod3On,
  };
  GEO.lod3Pick = false;
  S.lod3On = false;
  GEO.lon = pt.lon;
  GEO.lat = pt.lat;
  GEO.kx = 111320 * Math.cos((pt.lat * Math.PI) / 180);
  GEO.alkCustom = '';
  GEO.wcsDgm = '';
  GEO.wcsDom = '';
  GEO.lod2Tpl = '';
  S.lod2On = true;
  _blc[pt.lon.toFixed(3) + ',' + pt.lat.toFixed(3)] = Promise.resolve({ key: k, name: BLN[k] });
  gst = (m) => {
    TB.msg = m;
    const e = $('srmsg');
    if (e) e.textContent = m;
  };
  try {
    return await fn();
  } finally {
    GEO.lon = s.lon;
    GEO.lat = s.lat;
    GEO.kx = s.kx;
    GEO.alkCustom = s.a;
    GEO.wcsDgm = s.w1;
    GEO.wcsDom = s.w2;
    GEO.lod2Tpl = s.l2;
    S.lod2On = s.l2on;
    GEO.lod3Pick = s.p3;
    S.lod3On = s.o3;
    gst = s.g;
  }
}
async function srProbe(u) {
  let err = '';
  for (const via of viaOrder(u)) {
    if (via && !GEO.proxy) break;
    const ac = new AbortController(),
      to = setTimeout(() => ac.abort(), 25000);
    try {
      const r = await fetch(via ? viaProxy(u) : u, { signal: ac.signal });
      clearTimeout(to);
      const o = {
        url: u,
        ok: r.ok,
        status: r.status,
        ct: r.headers.get('content-type') || '',
        len: +r.headers.get('content-length') || 0,
        via: via ? 'Proxy' : '',
      };
      ac.abort();
      if (r.ok || via || !GEO.proxy) return o;
      err = 'HTTP ' + r.status;
    } catch (e) {
      clearTimeout(to);
      err =
        e.name === 'AbortError'
          ? 'Zeitüberschreitung'
          : 'Browser blockiert den Abruf oder Netzwerkfehler (' + (e.message || e) + ')';
    }
  }
  return { url: u, ok: false, status: 0, err };
}
const srCap = (u, sv) => u + (u.includes('?') ? '&' : '?') + 'SERVICE=' + sv + '&REQUEST=GetCapabilities';
function srTile(c, pt) {
  const zone = c.zone || 32,
    [cx, cy] = ll2utm(pt.lon, pt.lat, zone),
    sz = c.sz || 1,
    st = 1000 * sz;
  return [Math.floor(cx / st) * sz, Math.floor(cy / st) * sz];
}
function srUrls(tab, k, pt) {
  if (tab === 'gb') {
    const c = CG[k];
    if (c) {
      const [E, N] = srTile(c, pt);
      return c.tile(E, N);
    }
    return [LOD2.url + '?f=json'];
  }
  if (tab === 'fl') return (ALS[k] || []).map((s) => srCap(s.u, 'WFS'));
  if (tab === 'ge') {
    const t = TERR[k];
    if (!t || !t.dgm) return [];
    if (t.dgm.tile) {
      const [E, N] = srTile({ zone: t.z[0], sz: 1 }, pt);
      return t.dgm.tile(E, N);
    }
    return [srCap(t.dgm.u, 'WCS')];
  }
  const t = TKAT[k];
  return t ? [srCap(t.u, 'WFS')] : ['https://overpass-api.de/api/status'];
}
function srRes(st, lab, head, n, msg, tried, ms, pt, quick) {
  return { st, lab, head, n, msg, probs: repHints(msg), tried, ms, pt, quick: !!quick, t: Date.now() };
}
async function srTest(tab, k, quick) {
  if (TB.busy || GEO.busy) return;
  const pt = srPt(k),
    t0 = Date.now(),
    key = tab + ':' + k;
  if (quick) {
    TB.pq = (TB.pq || 0) + 1;
  } else {
    TB.busy = key;
    TB.msg = 'Prüfe Erreichbarkeit …';
    if ($('srcm')) srcOpen();
  }
  try {
    const urls = srUrls(tab, k, pt);
    let ok = null,
      fails = [];
    if (!urls.length) {
      GEO.tests[key] = srRes(
        'fail',
        '✕ keine Quelle',
        'Keine Quelle hinterlegt',
        0,
        'Für dieses Bundesland ist hier keine Quelle hinterlegt. Unten eine Adresse eintragen.',
        [],
        0,
        pt,
        quick,
      );
      return;
    }
    for (const u of urls) {
      const r = await srProbe(u);
      if (r.ok) {
        ok = r;
        break;
      }
      fails.push(r);
    }
    const tried = urls;
    if (!ok) {
      const f = fails[0] || {};
      const ms =
        f.err ||
        'HTTP ' +
          f.status +
          (f.status === 404 ? ' – nicht gefunden' : f.status === 403 ? ' – verweigert' : '');
      GEO.tests[key] = srRes(
        'fail',
        '✕ nicht erreichbar',
        'Nicht erreichbar',
        0,
        'Abruf fehlgeschlagen: ' + ms + ' (' + fails.map((x) => (x.url || '').slice(0, 90)).join(' | ') + ')',
        tried,
        Date.now() - t0,
        pt,
        quick,
      );
      return;
    }
    if (quick) {
      GEO.tests[key] = srRes(
        'ok',
        '✓ erreichbar',
        'Erreichbar (Schnelltest)',
        null,
        'Server antwortet: HTTP ' +
          ok.status +
          (ok.ct ? ', ' + ok.ct.split(';')[0] : '') +
          (ok.len ? ', ' + (ok.len / 1048576).toFixed(1) + ' MB' : '') +
          (ok.via ? ' (über Proxy)' : '') +
          '. Daten selbst noch nicht geladen – „Testen“ lädt einen kleinen Probe-Ausschnitt.',
        tried,
        Date.now() - t0,
        pt,
        true,
      );
      return;
    }
    TB.msg = 'Lade Probe-Ausschnitt (150 m) …';
    let n = 0,
      msg = '',
      head = '';
    await withGeo(pt, k, async () => {
      if (tab === 'gb') {
        const c = CG[k],
          r = c ? await cityGmlLoad(c, pt.lon, pt.lat, 150) : await lod2Load(pt.lon, pt.lat, 150);
        n = r.list.length;
        msg = r.msg;
        head = (c ? 'LoD2-CityGML ' + c.name : 'Esri/IOER „LoD2-DE“') + ': ' + n + ' Gebäude';
      } else if (tab === 'fl') {
        const [cx, cy] = ll2utm(pt.lon, pt.lat),
          out = [];
        for (const sv of ALS[k] || []) {
          try {
            const l = await wfsParcels(sv, cx, cy, 75);
            out.push((sv.u.match(/\/\/([^\/]+)/) || [])[1] + ': ' + l.length + ' Flurstücke');
            n += l.length;
          } catch (e) {
            out.push((sv.u.match(/\/\/([^\/]+)/) || [])[1] + ': ' + (e && e.message ? e.message : e));
          }
        }
        msg = out.join(' | ');
        head = 'Flurstücke: ' + n;
      } else if (tab === 'ge') {
        const a = await dgmLoad(pt.lon, pt.lat, 150, 'nw_dgm', 'DGM1').catch((e) => ({
          fail: true,
          msg: String(e.message || e),
        }));
        let m = [];
        if (!a) m.push('kein DGM1-Zugang hinterlegt');
        else if (a.fail) m.push(a.msg);
        else {
          n = a.w * a.h;
          m.push(a.msg);
        }
        if (TERR[k] && TERR[k].dom) {
          const b = await dgmLoad(pt.lon, pt.lat, 150, 'nw_dom', 'DOM1').catch((e) => ({
            fail: true,
            msg: String(e.message || e),
          }));
          m.push(!b || b.fail ? (b ? b.msg : 'DOM1 nicht hinterlegt') : 'DOM1 geladen');
        }
        msg = m.join(' | ');
        head = n ? 'DGM1 geladen (' + n + ' Rasterpunkte)' : 'DGM1 nicht geladen';
      } else {
        const r = TKAT[k] ? await kataTrees(pt.lon, pt.lat, 200) : await osmTrees0(pt.lon, pt.lat, 200);
        n = r.list.length;
        msg = r.msg || '';
        head = (TKAT[k] ? 'Baumkataster ' + TKAT[k].name : 'OSM-Bäume') + ': ' + n + ' Bäume';
      }
    });
    const good = n > 0;
    GEO.tests[key] = srRes(
      good ? 'ok' : 'fb',
      good ? '✓ Test bestanden' : '! erreichbar, keine Daten',
      head,
      n,
      good
        ? msg
        : (msg || 'Server antwortet, im Probe-Ausschnitt wurden aber keine Daten geliefert.') +
            (pt.proj ? '' : ' (Teststandort liegt evtl. außerhalb der Abdeckung)'),
      tried,
      Date.now() - t0,
      pt,
      false,
    );
  } catch (e) {
    GEO.tests[key] = srRes(
      'fail',
      '✕ Test fehlgeschlagen',
      'Test abgebrochen',
      0,
      String((e && e.message) || e),
      [],
      Date.now() - t0,
      pt,
      quick,
    );
  } finally {
    if (quick) TB.pq--;
    else TB.busy = '';
    TB.msg = '';
    if ($('srcm') && $('srcm').style.display === 'flex') srcOpen();
  }
}
async function srProbeAll(tab) {
  if (TB.busy || GEO.busy) return;
  TB.busy = 'all:' + tab;
  TB.msg = 'Prüfe Erreichbarkeit aller Länder …';
  srcOpen();
  const ks = Object.keys(BLN);
  let i = 0;
  await Promise.all(
    [0, 1, 2, 3].map(async () => {
      while (i < ks.length) {
        const k = ks[i++];
        await srTest(tab, k, true);
      }
    }),
  );
  TB.busy = '';
  TB.msg = '';
  srcOpen();
}
function srEd(tab, k, f, v) {
  SRE[tab + ':' + k + ':' + f] = v;
}
function srGet(tab, k, f, def) {
  const v = SRE[tab + ':' + k + ':' + f];
  return v === undefined ? def : v;
}
async function srApply(tab, k) {
  const g = (f) => String(srGet(tab, k, f, '') || '').trim();
  if (tab === 'gb') {
    const tpl = g('tpl');
    if (!tpl) return;
    OVR.gb[k] = { tpl, sz: +g('sz') || 2, zone: +g('zone') || 32, src: g('src') };
  } else if (tab === 'fl') {
    const url = g('url');
    if (!url) return;
    OVR.fl[k] = { url };
  } else if (tab === 'ge') {
    if (!g('dgm') && !g('dom')) return;
    OVR.ge[k] = { dgm: g('dgm'), dom: g('dom'), zone: g('zone') };
  } else {
    const url = g('url');
    if (!url) return;
    OVR.tr[k] = { url, types: g('types'), zone: g('zone'), src: g('src') };
  }
  ovrSave();
  ovrApply();
  delete GEO.tests[tab + ':' + k];
  for (const f of ['tpl', 'sz', 'zone', 'src', 'url', 'dgm', 'dom', 'types'])
    delete SRE[tab + ':' + k + ':' + f];
  await srTest(tab, k);
}
function srReset(tab, k) {
  delete OVR[tab][k];
  ovrSave();
  ovrApply();
  delete GEO.tests[tab + ':' + k];
  for (const f of ['tpl', 'sz', 'zone', 'src', 'url', 'dgm', 'dom', 'types'])
    delete SRE[tab + ':' + k + ':' + f];
  srcOpen();
}
