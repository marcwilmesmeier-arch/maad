// ---- Nur einen Datensatz (Gebäude / Bäume / Flurstücke / Gelände) neu laden: übrige Daten kommen aus dem geladenen Ausschnitt
async function geoPart(tab, extra) {
  GEO.partTab = tab;
  const sn = GEO.snap;
  if (!sn || !S.geo) throw new Error('Kein geladener Ausschnitt.');
  const lon = GEO.lon,
    lat = GEO.lat,
    size = GEO.size,
    s2 = Object.assign({}, sn);
  s2._DG = GEO.dgmFull || null;
  s2._DM = GEO.dmFull || null;
  GEO.partRun = true;
  GEO.partFl = true;
  const dom = () =>
    S.canopyOn === false
      ? Promise.resolve({ fail: true, msg: 'Kronenmodell ausgeschaltet.' })
      : dgmLoad(lon, lat, size, 'nw_dom', 'DOM1').catch((e) => ({
          fail: true,
          msg: 'DOM1 nicht geladen (' + e.message + ').',
        }));
  const canopyNew = () => {
    try {
      return S.canopyOn === false
        ? { list: [], msg: 'Kronenmodell ausgeschaltet.' }
        : canopy(
            s2._DG && !s2._DG.fail ? s2._DG : GEO.dgm,
            s2._DM,
            GEO.blist || [],
            s2.OT.list,
            (() => {
              try {
                const a = ctxCollect(s2.tiles);
                return { water: a.fill.water, br: a.bridges };
              } catch (e) {
                return null;
              }
            })(),
          );
    } catch (e) {
      return { list: [], msg: 'Kronenmodell: ' + e.message };
    }
  };
  try {
    if (tab !== 'fl' && !extra) {
      try {
        await mlAuto(lon, lat, size, { gb: ['LoD2'], tr: ['DOM'], ge: ['DGM1', 'DOM'] }[tab]);
      } catch (e) {
        GEO.dlMsg = 'Download-Manager: ' + e.message;
      }
    }
    if (tab === 'gb') {
      s2.LD = extra && extra.LD ? extra.LD : await bldLoad(lon, lat, size);
    } else if (tab === 'fl') {
      s2.AK = await alkisLoad(lon, lat, size);
      s2.BK = await bplanLoad(lon, lat, size);
      await wmsRun(lon, lat, size, null, s2.AK && s2.AK.list ? s2.AK.list.length : 0);
    } else if (tab === 'tr') {
      s2.OT = await osmTrees(lon, lat, size).catch((e) => ({ list: [], msg: 'OSM-Bäume: ' + e.message }));
      s2._DM = await dom();
      s2.cn = canopyNew();
    } else if (tab === 'ge') {
      const E = await elevLoad(),
        DG = await dgmLoad(lon, lat, size).catch((e) => ({
          fail: true,
          msg: 'DGM1 nicht geladen (' + e.message + ') – MapTiler-Gelände.',
        }));
      s2._DM = await dom();
      s2._DG = DG && !DG.fail ? DG : null;
      GEO.dgm = s2._DG;
      GEO.terrMsg = DG
        ? DG.msg
        : E
          ? 'Gelände: MapTiler-Terrain (kein DGM1 für diesen Standort eingebunden).'
          : 'Gelände: keine Höhendaten.';
      GEO.N = Math.max(100, Math.min(300, Math.round(size / 10) * 2));
      if (GEO.dgm) {
        GEO.N = Math.min(500, Math.max(GEO.N, Math.round(size / 2)));
        GEO.N += GEO.N % 2;
      }
      gridBuild(E);
      s2.grid = GEO.grid;
      s2.e0 = GEO.e0;
      s2.dgm = !!GEO.dgm;
      s2.terrMsg = GEO.terrMsg;
      s2.N = GEO.N;
      s2.cn = canopyNew();
      GEO.dgmFull = GEO.dgm;
      GEO.dmFull = s2._DM;
    } else throw new Error('Unbekannter Datensatz');
    const r = await geoRun(lon, lat, size, (S.project && S.project.label) || sn.label || '', s2);
    if (GEO.snap === s2) {
      delete s2._DG;
      delete s2._DM;
    }
    return r;
  } finally {
    GEO.partRun = false;
    GEO.partFl = false;
  }
}

// LoD3 im Hintergrund: erst das nächstbeste Modell (LoD2), LoD3 danach nachladen und LoD2 ersetzen
async function lod3Bg() {
  const lon = GEO.lon,
    lat = GEO.lat,
    size = GEO.size,
    tok = (GEO.l3tok = (GEO.l3tok || 0) + 1);
  if (!GEO.snap || !S.geo) return;
  let r;
  try {
    r = await lod3Load(lon, lat, size);
  } catch (e) {
    r = { list: [], msg: 'LoD3: ' + String(e.message || e).slice(0, 160) };
  }
  if (tok !== GEO.l3tok || GEO.lon !== lon || GEO.lat !== lat || !GEO.snap) return;
  if (!r || !r.list.length) {
    GEO.l3msg = 'LoD3 nicht verfügbar – LoD2 bleibt. ' + ((r && r.msg) || '');
    gst(GEO.l3msg);
    return;
  }
  r.via = 'lod3';
  let n = 0;
  while (GEO.busy && n++ < 600) await new Promise((q) => setTimeout(q, 500));
  if (tok !== GEO.l3tok || GEO.lon !== lon || GEO.lat !== lat) return;
  await geoSwap(r);
}
async function geoSwap(LD) {
  const sv = { tx: V.tx, tz: V.tz, rot: V.rot, rotT: V.rotT, d: V.d },
    Ps = P.slice(),
    par = S.par;
  GEO.swapRun = true;
  try {
    await geoPart('gb', { LD });
  } catch (e) {
    gst('LoD3 konnte nicht eingesetzt werden: ' + ((e && e.message) || e));
    return;
  } finally {
    GEO.swapRun = false;
  }
  Object.assign(V, sv);
  Ps.forEach((q) => {
    if (!P.includes(q)) P.push(q);
  });
  S.par = par;
  try {
    parRefresh();
    rr();
  } catch (e) {
    logErr(e, 'geoSwap');
  }
  GEO.l3msg = 'LoD3 geladen: ' + LD.list.length + ' Gebäude ersetzen das LoD2-Modell.';
  gst(GEO.l3msg);
}
const SRPN = { gb: 'Gebäude', tr: 'Bäume', fl: 'Flurstücke', ge: 'Gelände (DGM1/DOM1)' };
async function srReload(tab) {
  if (!S.geo || GEO.busy || TB.busy) return;
  const one = SRPN[tab] ? tab : null;
  if (
    !confirm(
      one
        ? 'Nur den Datensatz „' +
            SRPN[one] +
            '“ mit den aktuellen Quellen neu laden? Die übrigen Daten bleiben unverändert, geplante Gebäude bleiben erhalten.'
        : 'Umgebung (Gebäude, Bäume, Flurstücke, Gelände) mit den aktuellen Quellen neu laden? Geplante Gebäude bleiben erhalten.',
    )
  )
    return;
  if (!one || one === 'gb') {
    try {
      GEO.lod3Pick = await lod3Ask(GEO.lon, GEO.lat);
    } catch (e) {
      GEO.lod3Pick = false;
    }
  }
  TB.busy = 'reload';
  TB.msg = one ? 'Lade ' + SRPN[one] + ' neu …' : 'Lade Umgebung neu …';
  srcOpen();
  const g0 = gst;
  gst = (m) => {
    TB.msg = m;
    const e = $('srmsg');
    if (e) e.textContent = m;
    g0(m);
  };
  try {
    if (one && GEO.snap) await geoPart(one);
    else await geoRun(GEO.lon, GEO.lat, GEO.size, (S.project && S.project.label) || '');
  } catch (e) {
    TB.msg = 'Fehler: ' + ((e && e.message) || e);
  } finally {
    gst = g0;
    TB.busy = '';
    TB.msg = '';
    srcOpen();
  }
}
function srTools(tab, k) {
  const T = GEO.tests[tab + ':' + k],
    o = OVR[tab][k],
    busy = TB.busy === tab + ':' + k,
    dis = TB.busy || GEO.busy ? ' disabled' : '',
    pt = srPt(k),
    F = (f, def, ph, w) =>
      `<input type="text" style="width:${w || '100%'}" placeholder="${ph || ''}" value="${esc(srGet(tab, k, f, def) || '')}" oninput="srEd('${tab}','${k}','${f}',this.value)">`;
  let res = '';
  if (T)
    res = `<div class="live ${T.st}"><b>${esc(T.lab)}</b> ${esc(T.head)}</div><div class="dk"><span>Testort</span><em>${esc(T.pt.label)} (${T.pt.lat.toFixed(4)}, ${T.pt.lon.toFixed(4)}) · ${((T.ms || 0) / 1000).toFixed(1)} s · ${T.quick ? 'Schnelltest' : 'Probe-Ausschnitt 150 m'}</em></div>${T.n != null ? `<div class="dk"><span>Anzahl</span><em>${T.n}</em></div>` : ''}<div class="dk"><span>Meldung</span><em>${esc(T.msg)}</em></div>${T.tried && T.tried.length ? `<div class="dk"><span>Angefragt</span><em>${T.tried.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.length > 110 ? u.slice(0, 110) + '…' : u)}</a>`).join('<br>')}</em></div>` : ''}${T.probs.length ? '<div class="pr"><b>Hinweise / Probleme</b><ul>' + T.probs.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' : ''}`;
  let ed = '';
  if (tab === 'gb') {
    const c = CG[k],
      cur = c ? c.tile('{E}', '{N}')[0] : '';
    ed = `<div class="dk"><span>Kachel-Adresse</span><em>${F('tpl', cur, 'https://…/LoD2_32_{E}_{N}_1_XX.gml')}</em></div><div class="dk"><span>Kachel / UTM</span><em><select onchange="srEd('gb','${k}','sz',this.value)"><option value="1"${+srGet('gb', k, 'sz', c ? c.sz : 2) === 1 ? ' selected' : ''}>1 km</option><option value="2"${+srGet('gb', k, 'sz', c ? c.sz : 2) !== 1 ? ' selected' : ''}>2 km</option></select> <select onchange="srEd('gb','${k}','zone',this.value)"><option value="32"${+srGet('gb', k, 'zone', c ? c.zone : 32) !== 33 ? ' selected' : ''}>UTM 32</option><option value="33"${+srGet('gb', k, 'zone', c ? c.zone : 32) === 33 ? ' selected' : ''}>UTM 33</option></select></em></div><div class="dk"><span>Quellenangabe</span><em>${F('src', c ? c.src : '', '© Landesamt, Lizenz')}</em></div><div class="stn">{E} und {N} = Südwest-Ecke der Kachel in km. Endet die Adresse auf .zip, wird entpackt.</div>`;
  } else if (tab === 'fl') {
    const a = ALS[k];
    ed = `<div class="dk"><span>WFS-Adresse</span><em>${F('url', a && a[0] ? a[0].u : '', 'https://…/wfs (ALKIS vereinfacht oder INSPIRE-Flurstücke)')}</em></div><div class="stn">Typname und Format werden automatisch ermittelt.</div>`;
  } else if (tab === 'ge') {
    const t = TERR[k],
      dg = t && t.dgm ? (t.dgm.tile ? t.dgm.tile('{E}', '{N}')[0] : t.dgm.u) : '',
      dm = t && t.dom ? (t.dom.tile ? t.dom.tile('{E}', '{N}')[0] : t.dom.u) : '';
    ed = `<div class="dk"><span>DGM1</span><em>${F('dgm', dg, 'WCS-Adresse oder Kachel-Adresse mit {E}_{N}.tif')}</em></div><div class="dk"><span>DOM1 (optional)</span><em>${F('dom', dm, 'WCS-Adresse (für Baumkronen aus DOM1 − DGM1)')}</em></div><div class="dk"><span>UTM-Zone</span><em><select onchange="srEd('ge','${k}','zone',this.value)"><option value="">automatisch</option><option value="32">UTM 32</option><option value="33">UTM 33</option></select></em></div>`;
  } else {
    const t = TKAT[k];
    ed = `<div class="dk"><span>WFS-Adresse</span><em>${F('url', t ? t.u : '', 'https://…/wfs (Baumkataster, Punkte)')}</em></div><div class="dk"><span>Ebenen</span><em>${F('types', t ? t.types.join(', ') : '', 'z. B. baumbestand:strassenbaeume, baumbestand:anlagenbaeume')}</em></div><div class="dk"><span>UTM-Zone</span><em>${F('zone', t ? String(t.zone) : '32', '32', 60)}</em></div><div class="dk"><span>Quellenangabe</span><em>${F('src', t ? t.src : '', '© Stadt, Lizenz')}</em></div><div class="stn">Gelesen werden Punkte; Höhe, Krone und Art werden an den Spaltennamen erkannt.</div>`;
  }
  return `<div class="tst"><div class="dh">Testen &amp; Anpassen${o ? ' <span class="bdg fb">angepasst</span>' : ''}</div><div class="tbar"><button class="sm pri"${dis} onclick="srTest('${tab}','${k}')">${busy ? 'Test läuft …' : 'Testen (Probe-Ausschnitt)'}</button><button class="sm"${dis} onclick="srTest('${tab}','${k}',1)">Nur Erreichbarkeit</button><span class="stn" style="margin:0">Testort: ${esc(pt.label)}</span><span id="srmsg" class="stn" style="margin:0">${busy ? esc(TB.msg) : ''}</span></div>${res || '<div class="stn">Noch nicht getestet.</div>'}<div class="dh" style="margin-top:10px">Quelle ändern</div>${ed}<div class="tbar"><button class="sm pri"${dis} onclick="srApply('${tab}','${k}')">Übernehmen &amp; neu testen</button>${o ? `<button class="sm"${dis} onclick="srReset('${tab}','${k}')">Auf Standard zurücksetzen</button>` : ''}<span class="stn" style="margin:0">Wird im Browser gespeichert und gilt für alle neuen Projekte.</span></div>${mlbBlock(tab, k)}${tab === 'tr' ? krBlock(k) : ''}</div>`;
}
// Kronenmodell (Bäume aus DOM1 − DGM1): Quellen je Bundesland einstellen und testen (nutzt dieselben Overrides wie der Gelände-Reiter)
async function srKrTest(k) {
  if (TB.busy || GEO.busy) return;
  const pt = srPt(k),
    key = 'kr:' + k,
    t0 = Date.now();
  TB.busy = key;
  TB.msg = 'Lade DGM1 und DOM1 (Probe-Ausschnitt 200 m) …';
  if ($('srcm')) srcOpen();
  try {
    const m = [];
    let n = 0,
      st = 'fail',
      head = 'Kronenmodell nicht erzeugt';
    await withGeo(pt, k, async () => {
      const sz0 = GEO.size;
      GEO.size = 200;
      try {
        const DG = await dgmLoad(pt.lon, pt.lat, 200, 'nw_dgm', 'DGM1').catch((e) => ({
            fail: true,
            msg: String(e.message || e),
          })),
          DO = await dgmLoad(pt.lon, pt.lat, 200, 'nw_dom', 'DOM1').catch((e) => ({
            fail: true,
            msg: String(e.message || e),
          }));
        const gd = DG && !DG.fail,
          od = DO && !DO.fail;
        m.push(
          gd
            ? 'DGM1 geladen (' + DG.w + '×' + DG.h + ' Punkte, ' + f1(DG.res, 1) + ' m)'
            : 'DGM1: ' + (DG ? DG.msg : 'keine Quelle hinterlegt'),
        );
        m.push(
          od
            ? 'DOM1 geladen (' + DO.w + '×' + DO.h + ' Punkte)'
            : 'DOM1: ' + (DO ? DO.msg : 'keine Quelle hinterlegt'),
        );
        if (gd && od) {
          const c = canopy(DG, DO, [], []);
          n = c.list.length;
          m.push(c.msg);
          head = 'Kronenmodell: ' + n + ' Bäume im Probe-Ausschnitt';
          st = n > 0 ? 'ok' : 'fb';
        } else if (gd || od) {
          st = 'fb';
          head = gd ? 'DOM1 fehlt – nur OSM-Bäume' : 'DGM1 fehlt – kein Kronenmodell';
        }
      } finally {
        GEO.size = sz0;
      }
    });
    GEO.tests[key] = srRes(
      st,
      st === 'ok' ? '✓ Kronenmodell möglich' : st === 'fb' ? '! unvollständig' : '✕ nicht möglich',
      head,
      n,
      m.join(' | '),
      [],
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
      false,
    );
  } finally {
    TB.busy = '';
    TB.msg = '';
    if ($('srcm') && $('srcm').style.display === 'flex') srcOpen();
  }
}
async function srKrApply(k) {
  const t = TERR[k],
    dg = t && t.dgm ? (t.dgm.tile ? t.dgm.tile('{E}', '{N}')[0] : t.dgm.u) : '',
    dm = t && t.dom ? (t.dom.tile ? t.dom.tile('{E}', '{N}')[0] : t.dom.u) : '',
    g = (f, d) => String(srGet('ge', k, f, d) || '').trim();
  const dgm = g('dgm', dg),
    dom = g('dom', dm);
  if (!dgm && !dom) return;
  OVR.ge[k] = { dgm, dom, zone: g('zone', '') };
  ovrSave();
  ovrApply();
  for (const f of ['dgm', 'dom', 'zone']) delete SRE['ge:' + k + ':' + f];
  delete GEO.tests['ge:' + k];
  await srKrTest(k);
}
function krBlock(k) {
  const t = TERR[k],
    dg = t && t.dgm ? (t.dgm.tile ? t.dgm.tile('{E}', '{N}')[0] : t.dgm.u) : '',
    dm = t && t.dom ? (t.dom.tile ? t.dom.tile('{E}', '{N}')[0] : t.dom.u) : '',
    T = GEO.tests['kr:' + k],
    o = OVR.ge[k],
    busy = TB.busy === 'kr:' + k,
    dis = TB.busy || GEO.busy ? ' disabled' : '',
    F = (f, d, ph) =>
      `<input type="text" style="width:100%" placeholder="${esc(ph)}" value="${esc(srGet('ge', k, f, d) || '')}" oninput="srEd('ge','${k}','${f}',this.value)">`;
  const live = T
    ? `<div class="live ${T.st}" style="margin-top:6px"><b>${esc(T.lab)}</b> ${esc(T.head)}</div><div class="dk"><span>Testort</span><em>${esc(T.pt.label)} · ${((T.ms || 0) / 1000).toFixed(1)} s</em></div><div class="dk"><span>Meldung</span><em>${esc(T.msg)}</em></div>`
    : '';
  return `<div class="dh" style="margin-top:12px">Kronenmodell: Bäume aus DOM1 − DGM1${o ? ' <span class="bdg fb">angepasst</span>' : ''}</div><div class="stn" style="margin:0 0 4px">maad erzeugt zusätzlich zu den OSM-Bäumen Einzelbäume aus der Differenz von Oberflächen- und Geländemodell (Höhe, Kronenradius). Beide Modelle werden je Bundesland geladen; hier stellen Sie die Quellen ein und testen sie. Adresse mit {E} und {N} = 1-km-Kachel (Südwest-Ecke in km, ZIP/XYZ oder GeoTIFF), sonst WCS-Dienst; mit <code>cache://x/{E}_{N}</code> werden im Download-Manager importierte Kacheln genutzt.</div>
<label style="display:block"><input type="checkbox" ${S.canopyOn !== false ? 'checked' : ''} onchange="S.canopyOn=this.checked"> Kronenmodell beim Laden erzeugen (sonst nur OSM-/Kataster-Bäume; spart den DOM1-Abruf)</label>
<div class="dk"><span>DGM1 (Gelände)</span><em>${F('dgm', dg, 'WCS-Adresse oder Kachel-Adresse mit {E}_{N}')}</em></div><div class="dk"><span>DOM1 (Oberfläche)</span><em>${F('dom', dm, 'WCS-Adresse oder Kachel-Adresse mit {E}_{N}')}</em></div>
<div class="dk"><span>UTM-Zone</span><em><select onchange="srEd('ge','${k}','zone',this.value)"><option value="">automatisch</option><option value="32">UTM 32</option><option value="33">UTM 33</option></select></em></div>
<div class="tbar"><button class="sm pri"${dis} onclick="srKrApply('${k}')">${busy ? 'Test läuft …' : 'Übernehmen &amp; Kronenmodell testen'}</button><button class="sm"${dis} onclick="srKrTest('${k}')">Nur testen</button>${o ? `<button class="sm"${dis} onclick="srReset('ge','${k}')">Auf Standard zurücksetzen</button>` : ''}<span class="stn" style="margin:0">Gilt auch im Reiter „Gelände“ (gleiche Quelle). Wirkt beim nächsten Laden.</span></div>${live}`;
}
// Metalink-Adressen je Bundesland und Datenart (im Dropdown der Datenquellen-Tabelle editierbar, im Browser gespeichert)
const MLB = {
  by: {
    ags: '09162000',
    d: {
      ge: {
        n: 'DGM1 (1-m-Kacheln, ZIP/XYZ)',
        tpl: 'https://geodaten.bayern.de/odd/a/dgm/dgm1/meta/metalink/{AGS}.meta4',
        h: 'Adresse aus dem BayernAtlas-Export (Gemeinde München) übernommen.',
      },
      gb: {
        n: 'LoD2-Gebäude (CityGML)',
        tpl: 'https://geodaten.bayern.de/odd/a/lod2/meta/metalink/{AGS}.meta4',
        h: 'Adresse nach dem DGM1-Muster abgeleitet, nicht bestätigt. Alternative: die .meta4 von geodaten.bayern.de speichern und im Download-Manager über „Datei wählen“ laden (z. B. 09.meta4 = ganz Bayern).',
      },
      tr: {
        n: 'Einzelbäume / Baumdaten',
        tpl: '',
        h: 'Für Bayern ist keine Baum-Metalink-Adresse bekannt – eigene .meta4 eintragen. Bäume kommen sonst aus OpenStreetMap.',
      },
      fl: { n: 'Flurstücke', tpl: '', h: 'Keine Metalink-Adresse bekannt – eigene .meta4 eintragen.' },
    },
  },
};
try {
  const q = JSON.parse(localStorage.getItem('lot_mlb') || '{}');
  for (const k in q) {
    if (!MLB[k]) continue;
    if (q[k].ags) MLB[k].ags = q[k].ags;
    for (const t in q[k].d || {})
      if (MLB[k].d[t] && typeof q[k].d[t] === 'string') MLB[k].d[t].tpl = q[k].d[t];
  }
} catch (e) {
  logErr(e, 'init');
}
function mlbSet(k, t, v) {
  const m = MLB[k];
  if (t === 'ags') m.ags = v.trim();
  else m.d[t].tpl = v.trim();
  try {
    const o = {};
    for (const c in MLB) {
      o[c] = { ags: MLB[c].ags, d: {} };
      for (const x in MLB[c].d) o[c].d[x] = MLB[c].d[x].tpl;
    }
    localStorage.setItem('lot_mlb', JSON.stringify(o));
  } catch (e) {
    logErr(e, 'mlbSet');
  }
}
function mlbGo(k, t) {
  const m = MLB[k],
    u = (m.d[t].tpl || '').replace(/\{AGS\}/g, m.ags || '');
  if (!u) {
    return;
  }
  MLK.url = u;
  MLK.mode = MLK.mode === 'save' ? 'cache' : MLK.mode;
  MLK.flt = '';
  MLK.rad = '';
  mlOpen();
  mlLoadUrl().then(() => {
    if (MLK.files.length > 500 && S.geo) {
      MLK.rad = '3';
      MLK.msg =
        'Große Liste (' +
        MLK.files.length.toLocaleString('de') +
        ' Dateien): Filter „Umkreis um Projekt“ auf 3 km gesetzt.';
      mlUi();
    }
  });
}
function mlbBlock(tab, k) {
  const m = MLB[k];
  if (!m || !m.d[tab]) return '';
  const d = m.d[tab];
  return `<div class="dh" style="margin-top:10px">Metalink-Download (${esc(d.n)})</div><div class="dk"><span>Gemeinde-Schlüssel</span><em><input type="text" style="width:130px" value="${esc(m.ags)}" oninput="mlbSet('${k}','ags',this.value)" title="8-stelliger Gemeindeschlüssel (AGS), z. B. 09162000 = München; 09 = ganz Bayern"></em></div><div class="dk"><span>Metalink-Adresse</span><em><input type="text" style="width:100%" placeholder="https://…/{AGS}.meta4" value="${esc(d.tpl)}" oninput="mlbSet('${k}','${tab}',this.value)"></em></div><div class="tbar"><button class="sm pri" onclick="mlbGo('${k}','${tab}')"${d.tpl ? '' : ' disabled'}>Im Download-Manager laden</button><span class="stn" style="margin:0">${esc(d.h)}</span></div>`;
}
const SRN = {
  gb: {
    by: 'Kachel gelesen und getestet; Abruf im Browser evtl. durch CORS blockiert (CORS-Proxy unter Einstellungen)',
    ni: 'Adresse aus dem LGLN-Katalog, Abruf noch nicht im echten Browser bestätigt',
    nrw: 'läuft',
  },
  fb: 'Fallback 1: Esri/IOER „LoD2-DE“ (Grundriss + gemessene Höhe, keine Dachform) · Fallback 2: MapTiler/OSM (extrudiert, Höhe aus Kartendaten oder geschätzt)',
};
const SRB = { ok: '✓ geladen', fb: 'Fallback aktiv', fail: '✕ nicht geladen', unk: 'Quelle unbekannt' };
function repHints(t) {
  const p = [];
  t = String(t || '');
  if (/Failed to fetch|NetworkError|CORS|Browser blockiert/i.test(t))
    p.push(
      'Der Browser blockiert den Abruf (meist CORS). Abhilfe: maad.html lokal öffnen oder einen CORS-Proxy unter Einstellungen eintragen.',
    );
  if (/HTTP 40[34]|\b404\b/.test(t))
    p.push(
      'Der Server meldet „nicht gefunden“ oder „verweigert“. Kachelname oder Dienstadresse passt evtl. nicht.',
    );
  if (/Zeitüberschreitung/.test(t)) p.push('Zeitüberschreitung: Dienst zu langsam oder Kachel sehr groß.');
  if (/ungeprüft/.test(t))
    p.push('Die hinterlegte Adresse wurde noch nicht gegen den echten Dienst bestätigt.');
  if (/zu groß/.test(t) && !/Ausschnitt/.test(t)) p.push('Eine Kachel überschreitet die Größengrenze.');
  if (/Ausschnitt zu groß/.test(t))
    p.push('Der Ausschnitt braucht mehr Kacheln als erlaubt (höchstens 16). Kleineren Ausschnitt wählen.');
  if (/Dienst meldet/.test(t)) p.push('Der Dienst hat eine Fehlermeldung geliefert (siehe Meldung).');
  if (/ausgeschaltet/.test(t)) p.push('LoD2 ist in den Einstellungen ausgeschaltet.');
  return p;
}
// Prüft nach dem Laden, welche Datensätze für das Bundesland des Ausschnitts tatsächlich geliefert wurden (ok / Fallback / nicht geladen)
async function loadReport(o) {
  let st = null;
  try {
    st = await bundeslandC(o.lon, o.lat);
  } catch (e) {
    logErr(e, 'loadReport');
  }
  const key = (st && st.key) || '',
    R = { key, name: (st && st.name) || BLN[key] || '', t: Date.now() },
    cg = CG[key];
  const LD = o.LD || {},
    via = LD.via || '',
    nb = (GEO.blist || []).length;
  let s, h;
  if (via === 'lod3') {
    s = 'ok';
    h = 'LoD3-Gebäude – ' + (LD.prov || '') + (LD.lsrc ? ' (' + LD.lsrc + ')' : '');
  } else if (via === 'cg') {
    s = 'ok';
    h = 'LoD2-CityGML ' + (LD.prov || R.name);
  } else if (via === 'esri') {
    s = cg ? 'fb' : 'ok';
    h = 'Esri/IOER „LoD2-DE“' + (cg ? ' (Fallback, Landesquelle nicht geladen)' : '');
  } else if (via === 'usa') {
    s = 'ok';
    h = 'US-Gebäude – ' + (LD.prov || '');
  } else if (via === 'osm') {
    s = nb ? 'fb' : 'fail';
    h = nb ? 'MapTiler/OSM-Gebäude (Fallback)' : 'keine Gebäude';
  } else {
    s = 'unk';
    h = 'Quelle unbekannt (älterer Ausschnitt)';
  }
  R.gb = { st: s, head: h, n: nb, msg: LD.msg || '', probs: repHints(LD.msg) };
  const OT = o.OT || {},
    l = OT.list || [],
    cn = (k) => l.filter((t) => t.src === k).length,
    nk = cn('kataster'),
    ng = cn('gpkg'),
    no = cn('osm'),
    nc = ((o.cn && o.cn.list) || []).length,
    tp = [];
  if (ng) tp.push('Baumdatei ' + ng);
  if (nk) tp.push('Baumkataster ' + nk);
  if (no) tp.push('OSM ' + no);
  if (nc) tp.push('Kronenmodell ' + nc);
  const d = OT.det,
    tm = (d ? [d.g, d.k, d.o].filter(Boolean).join(' ') : OT.msg || '') + ' ' + ((o.cn && o.cn.msg) || '');
  let ts = ng || nk || nc ? 'ok' : no ? 'fb' : 'fail';
  if (TKAT[key] && !nk && !ng) ts = no || nc ? 'fb' : 'fail';
  R.tr = {
    st: ts,
    head: tp.join(' · ') || 'keine Bäume',
    n: GEO.trees ? GEO.trees.length : 0,
    msg: tm.trim(),
    probs: repHints(tm),
  };
  const AK = o.AK || {},
    na = AL.length,
    fm = AK.msg || '';
  let fs = na ? 'ok' : ALS[key] || GEO.alkCustom ? 'fail' : 'fb';
  R.fl = {
    st: fs,
    head: na
      ? 'ALKIS-Flurstücke' + (GEO.alkSrc ? ' – ' + GEO.alkSrc : '')
      : fs === 'fb'
        ? 'kein Flurstücks-Dienst hinterlegt, Karte ohne Flurstücke'
        : 'Flurstücke nicht geladen',
    n: na,
    msg: fm,
    probs: repHints(fm).concat(BLX[key] && !na ? [BLX[key]] : []),
  };
  if (!na && GEO.wmsImg) {
    R.fl.st = 'fb';
    R.fl.head = 'Flurkarte als Bild (Parzellarkarte, WMS)';
    R.fl.msg = GEO.wmsMsg;
    R.fl.probs = ['Nur Kartenbild: Flurstücke sind nicht anklickbar und haben keine Nummern/Flächen.'];
  } else if (!na && GEO.wmsMsg) {
    R.fl.probs = R.fl.probs.concat([GEO.wmsMsg]);
  }
  const gm = (GEO.terrMsg || '') + ' ' + ((o.DM && o.DM.msg) || '');
  let gs = GEO.dgm ? 'ok' : /keine Höhendaten/.test(gm) ? 'fail' : 'fb';
  R.ge = {
    st: gs,
    head:
      gs === 'ok'
        ? GEO.dgm.snap
          ? 'Höhenmodell (gespeicherter Ausschnitt)'
          : 'DGM1' + (o.DM && !o.DM.fail ? ' + DOM1' : '')
        : gs === 'fb'
          ? 'MapTiler Terrain-RGB (Fallback)'
          : 'keine Höhendaten',
    n: null,
    msg: gm.trim(),
    probs: repHints(gm).concat(TERR[key] && TERR[key].dgm && TERR[key].dgm.g && gs !== 'ok' ? [] : []),
  };
  return R;
}
function srcDetail(tab, k) {
  const rp = GEO.rep,
    R = rp && rp.key === k ? rp[tab] : null,
    dk = (a, b) => (b ? `<div class="dk"><span>${a}</span><em>${b}</em></div>` : ''),
    u = (a) => (a || []).map(esc).join('<br>');
  let s = '';
  if (tab === 'gb') {
    const c = CG[k];
    s = c
      ? dk('Datensatz', 'LoD2-CityGML ' + esc(c.name)) +
        dk('Herausgeber / Lizenz', esc(c.src)) +
        dk(
          'Kacheln',
          c.sz + ' × ' + c.sz + ' km, UTM ' + (c.zone || 32) + ', ' + (c.zip ? 'ZIP mit GML' : 'GML'),
        ) +
        dk('Adresse', u(c.tile('{E}', '{N}'))) +
        dk('Prüfstand', c.g ? 'Adresse ungeprüft' : esc(SRN.gb[k] || 'eingebunden'))
      : dk('Datensatz', 'Esri/IOER „LoD2-DE“ (bundesweit)') +
        dk('Inhalt', 'Grundriss + gemessene Gebäudehöhe aus amtlichen LoD2-Modellen, keine Dachform') +
        dk('Adresse', esc(LOD2.url)) +
        dk(
          'Hinweis',
          'Für dieses Bundesland ist kein Landes-Kachelzugang hinterlegt (eigene URL unter Einstellungen).',
        );
  } else if (tab === 'tr') {
    const t = TKAT[k],
      tt = TERR[k];
    s =
      (t
        ? dk('Baumkataster', esc(t.name)) +
          dk('Lizenz', esc(t.src)) +
          dk('Dienst', esc(t.u)) +
          dk('Ebenen', u(t.types)) +
          (t.g ? dk('Prüfstand', 'Adresse/Attribute ungeprüft') : '')
        : dk('Baumkataster', 'kein amtliches Kataster hinterlegt')) +
      (tt && tt.dgm && tt.dom ? dk('Kronenmodell', 'DOM1 − DGM1 (Höhen aus Laserdaten, ohne Art)') : '') +
      dk('Baumdatei', 'Lokale GeoPackage (.gpkg) wählbar: ' + TFILES.map((x) => esc(x.name)).join(', ')) +
      dk('Fallback', 'OSM-Bäume über Overpass (Höhe/Krone aus Tags oder geschätzt)');
  } else if (tab === 'fl') {
    const a = ALS[k];
    s = a
      ? dk('Dienst', u(a.map((x) => x.u))) +
        dk('Lizenz', esc(ALQ[k] || '')) +
        (a.some((x) => x.g) ? dk('Prüfstand', 'Adresse ungeprüft') : '')
      : (WMSK[k]
          ? dk('Bild-Dienst (WMS)', u([WMSK[k].u])) +
            dk('Lizenz', esc(WMSK[k].src)) +
            dk('Hinweis', esc(WMSK[k].note))
          : dk('Dienst', 'kein freier Dienst hinterlegt')) + dk('Hinweis', esc(BLX[k] || ''));
    if (BLX[k] && a) s += dk('Hinweis', esc(BLX[k]));
  } else {
    const t = TERR[k];
    s = t
      ? dk(
          'Datensatz',
          t.dgm
            ? (t.dgm.u === 'tile' ? 'DGM1-Kacheln (ZIP/XYZ oder GeoTIFF)' : 'DGM1 per WCS') +
                (t.dom ? (t.dom.u === 'tile' ? ' + DOM-Kacheln (20 cm, GeoTIFF)' : ' + DOM1 per WCS') : '')
            : t.dom && t.dom.u === 'tile'
              ? 'nur DOM1 (Gesamtarchiv, über Download-Manager importieren)'
              : '–',
        ) +
        dk('Lizenz', esc(t.src)) +
        dk('Adresse', t.dgm ? (t.dgm.u === 'tile' ? u(t.dgm.tile('{E}', '{N}')) : esc(t.dgm.u)) : '') +
        (t.dom ? dk('DOM1', esc(t.dom.u)) : '') +
        (t.dgm && t.dgm.g ? dk('Prüfstand', 'Adresse ungeprüft') : '')
      : dk('Datensatz', 'kein DGM1-Zugang hinterlegt (eigene WCS-Adresse unter Einstellungen)') +
        dk('Fallback', 'MapTiler Terrain-RGB (grob)');
  }
  let live = '';
  if (R)
    live =
      `<div class="live ${R.st}"><b>${SRB[R.st]}</b> ${esc(R.head)}</div>` +
      dk('Anzahl', R.n != null ? String(R.n) : '') +
      dk('Meldung beim Laden', esc(R.msg)) +
      (R.probs.length
        ? '<div class="pr"><b>Hinweise / Probleme</b><ul>' +
          R.probs.map((p) => '<li>' + esc(p) + '</li>').join('') +
          '</ul></div>'
        : '<div class="stn">Keine Probleme gemeldet.</div>');
  else
    live = `<div class="stn">${rp ? 'Keine Prüfung für dieses Bundesland – das aktuelle Projekt liegt in ' + esc(rp.name || '?') + '.' : 'Kein Ladeprotokoll (Demo-Daten oder noch kein Projekt geladen).'}</div>`;
  if (R && SRPN[tab] && S.geo && GEO.snap)
    live += `<button class="sm" style="margin-top:6px"${TB.busy || GEO.busy ? ' disabled' : ''} onclick="srReload('${tab}')" title="Lädt nur diesen Datensatz neu, die übrigen bleiben unverändert">Nur „${SRPN[tab]}“ neu laden</button>`;
  return (
    `<div class="dgrid"><div><div class="dh">Datensatz</div>${s}</div><div><div class="dh">Ladeergebnis im aktuellen Projekt</div>${live}</div></div>` +
    srTools(tab, k)
  );
}
function srcData() {
  const ks = Object.keys(BLN),
    rp = GEO.rep,
    cur = rp ? rp.key : ks.find((k) => BLN[k] === GEO.alkBL) || '',
    L3 = LOD3S.map((s) => s.name).join(', ');
  const tb = (tab, head, rows) => {
    const R = rp && rp[tab];
    return `<table class="stb"><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr>${rows
      .map((r, i) => {
        const k = ks[i],
          isC = k === cur,
          sel = S.srSel === tab + ':' + k,
          T = GEO.tests[tab + ':' + k],
          use =
            T && !(isC && R && R.st && (rp.t || 0) > T.t)
              ? { st: T.st, lab: T.lab }
              : isC && R
                ? { st: R.st, lab: SRB[R.st] }
                : null,
          bd =
            (use ? `<br><span class="bdg ${use.st}">${esc(use.lab)}</span>` : '') +
            (OVR[tab][k] ? ' <span class="bdg fb">angepasst</span>' : '');
        return `<tr class="${isC ? 'cur ' + (R ? R.st : '') : ''}${sel ? ' sel' : ''}" onclick="srcPick('${tab}','${k}')">${r.map((c, j) => `<td>${j ? c : '<b>' + esc(c) + '</b>' + bd}</td>`).join('')}</tr>${sel ? `<tr class="dt"><td colspan="${head.length}">${srcDetail(tab, k)}</td></tr>` : ''}`;
      })
      .join(
        '',
      )}</table><div class="stn">Zeile anklicken: Datensatz-Informationen, Ladeergebnis, Testen und Quelle ändern. Rot/orange/grün hinterlegt ist das Bundesland des aktuellen Projekts.</div>`;
  };
  const fmt = (c) => c.sz + ' km-Kacheln, ' + (c.zip ? 'ZIP' : 'GML');
  const gb = ks.map((k) => {
    const c = CG[k],
      n = BLN[k];
    return c
      ? [
          n,
          'LoD2-CityGML (' + fmt(c) + ') – ' + esc(c.src),
          'LoD2 mit echten Dachformen',
          c.g ? 'Adresse ungeprüft' : SRN.gb[k] || 'eingebunden',
          'Esri/IOER, dann MapTiler/OSM',
        ]
      : [
          n,
          'Esri/IOER „LoD2-DE“ (bundesweit, ArcGIS-Dienst)',
          'Grundriss + Höhe, keine Dachform',
          'kein Landes-Kachelzugang hinterlegt',
          'MapTiler/OSM (extrudiert, Höhe geschätzt)',
        ];
  });
  gb.forEach((r, i) => {
    const k = ks[i];
    if (SRN.gb[k] && CG[k]) r[3] = SRN.gb[k];
    const l3 = LOD3S.filter((x) => x.bl === k);
    if (l3.length) {
      r[1] =
        '<b>LoD3</b> (zuerst, nur im Quellgebiet): ' +
        l3.map((x) => esc(x.name) + ' – ' + esc(x.src)).join('; ') +
        '<br>' +
        r[1];
      r[2] = 'LoD3 im Quellgebiet, sonst ' + r[2];
    }
  });
  const gbH =
    tb('gb', ['Bundesland', 'Quelle', 'Modell', 'Status', 'Fallback'], gb) +
    `<div class="stn">LoD3 (zuerst versucht, nur in diesen Gebieten): ${esc(L3)}. Eigene Kachel-URL ersetzt die Landesquelle (unter Einstellungen). ${esc(SRN.fb)}</div>`;
  const tr = ks.map((k) => {
    const t = TKAT[k],
      tt = TERR[k],
      kr = tt && tt.dgm && tt.dom;
    const ex = [];
    if (t) ex.push('Baumkataster ' + esc(t.name) + ' (WFS, Einzelbäume mit Höhe/Krone/Art)');
    if (k === 'ni') ex.push('Baumdatei Braunschweig (lokale .gpkg, LiDAR 2019)');
    if (k === 'by') ex.push('Baumdatei Einzelbäume (lokale .gpkg, Bäume 3D)');
    if (kr) ex.push('Kronenmodell aus DOM1 − DGM1');
    return [
      BLN[k],
      ex.length ? ex.join('<br>') : '–',
      t ? 'Einzelbaum mit Höhe, Krone, Art' : kr ? 'Baumkronen aus Höhenmodellen (ohne Art)' : '–',
      'OSM-Bäume (Overpass): Punkte, Höhe/Krone aus Tags oder geschätzt',
    ];
  });
  const trH =
    tb('tr', ['Bundesland', 'Quelle', 'Modell', 'Fallback'], tr) +
    `<div class="stn">Für jedes Bundesland kann zusätzlich eine eigene GeoPackage-Baumdatei gewählt werden (Einstellungen → Baumdatei). Sie hat Vorrang vor Kataster und OSM.</div>`;
  const fl = ks.map((k) => {
    const a = ALS[k],
      h = a && a[0] ? (a[0].u.match(/\/\/([^\/]+)/) || [])[1] : '';
    return [
      BLN[k],
      a
        ? 'WFS ALKIS: ' + esc(h) + (a.some((x) => x.g) ? ' <i>(Adresse ungeprüft)</i>' : '')
        : WMSK[k]
          ? 'Kartenbild (WMS): ' + esc(WMSK[k].name)
          : '–',
      a ? esc(ALQ[k] || '') : '–',
      a ? 'Flurstücke mit Nummer, Fläche' : esc(BLX[k] || 'kein freier Dienst hinterlegt'),
      'Kartenhintergrund MapTiler, ohne Flurstücke',
    ];
  });
  const flH =
    tb('fl', ['Bundesland', 'Quelle', 'Lizenz', 'Modell / Hinweis', 'Fallback'], fl) +
    '<div class="stn">Eigener Flurstücks-Dienst: Einstellungen → Flurstücks-Dienst.</div>';
  const ge = ks.map((k) => {
    const t = TERR[k];
    return [
      BLN[k],
      t
        ? (t.dgm
            ? (t.dgm.u === 'tile' ? 'DGM1-Kacheln (ZIP/XYZ oder GeoTIFF)' : 'DGM1 per WCS') +
              (t.dom ? (t.dom.u === 'tile' ? ', DOM-Kacheln (20 cm, GeoTIFF)' : ', DOM1 per WCS') : '')
            : t.dom && t.dom.u === 'tile'
              ? 'nur DOM1 (Gesamtarchiv, Import über Download-Manager)'
              : '–') + (t.dgm && t.dgm.g ? ' <i>(Adresse ungeprüft)</i>' : '')
        : '–',
      t ? esc(t.src) : '–',
      'MapTiler Terrain-RGB (grob, ca. 10 m)',
    ];
  });
  const geH =
    tb('ge', ['Bundesland', 'Quelle', 'Lizenz', 'Fallback'], ge) +
    '<div class="stn">Eigene WCS-Adressen: Einstellungen → Höhenmodell-Dienste.</div>';
  return { gb: gbH, tr: trH, fl: flH, ge: geH, bp: '', cur, rep: rp };
}
function srOpts(tab) {
  const dis = GEO.busy ? ' disabled' : '';
  if (tab === 'fl') {
    const w = WMSK.by;
    return `<div class="opt"><b>Flurkarte als Bild (WMS) – Bayern</b><div class="stn" style="margin:0">Für Länder ohne Flurstücks-Vektordienst lädt maad ein Kartenbild der Parzellarkarte und legt es als Ebene „Flurkarte (Bild)" auf das Gelände. ${esc(w.note)} Lizenz: ${esc(w.src)}.</div><label><input type="checkbox" ${S.wmsOn ? 'checked' : ''} onchange="S.wmsOn=this.checked"> Beim Laden eines Ausschnitts in Bayern die Parzellarkarte als Bild laden</label><label>Darstellung <select onchange="S.wmsLay=this.value">${Object.entries(
      w.lay,
    )
      .map(([k, v]) => `<option value="${k}"${S.wmsLay === k ? ' selected' : ''}>${esc(v[1])}</option>`)
      .join(
        '',
      )}</select></label><label><input type="checkbox" ${S.wmsVec === true ? 'checked' : ''} onchange="S.wmsVec=this.checked"> Experimentell: Flurstücke beim Laden automatisch als Vektorflächen aus dem Kartenbild ableiten (Standard: aus – es bleibt die Bildebene „Flurkarte (Bild)“ mit den Konturen)</label><div class="tbar" style="margin:0"><label class="stn" style="margin:0">Mindestfläche <input type="number" min="5" max="2000" style="width:70px" value="${S.wmsMinA || 30}" onchange="S.wmsMinA=+this.value||30"> m²</label><button class="sm"${S.geo && GEO.wmsMask && !GEO.busy ? '' : ' disabled'} onclick="const r=parFromWms(false);gst(r.msg);srcOpen()">Jetzt aus Kartenbild ableiten</button></div><div class="stn" style="margin:0">Dienst: ${esc(w.u)} · Wirkt beim nächsten Laden. Status letzter Lauf: ${esc(GEO.wmsMsg || '–')}</div></div>`;
  }
  if (tab === 'gb')
    return `<div class="opt"><b>Optionen</b><label><input type="checkbox" ${S.lod2On ? 'checked' : ''} onchange="S.lod2On=this.checked"> LoD2-Gebäude beim Laden verwenden (Landes-CityGML, sonst Esri/IOER)</label><label><input type="checkbox" ${S.lod3On ? 'checked' : ''} onchange="S.lod3On=this.checked"> LoD3 im Quellgebiet immer im Hintergrund nachladen, ohne Rückfrage (Standard: aus – nach der Flächenwahl wird gefragt; LoD2 erscheint sofort, LoD3 ersetzt es nach bis zu ca. 5 Min.)</label><div class="stn" style="margin:0">Eigene LoD3-Datei (ZIP/CityGML) für das nächste Projekt in einem Quellgebiet: <input type="file" accept=".zip,.gml,.xml" onchange="GEO.lod3File=this.files[0]||null;srcOpen()">${GEO.lod3File ? '<b>' + esc(GEO.lod3File.name) + '</b>' : ''}</div></div>`;
  if (tab === 'tr')
    return `<div class="opt"><b>Eigene Baumdatei (GeoPackage)</b><div class="stn" style="margin:0">Punkte mit Höhe/Kronendurchmesser, z. B. Braunschweig-LiDAR-Bäume oder Bayern-Einzelbäume. Hat Vorrang vor Kataster und OSM; gelesen werden nur die Bäume im Ausschnitt.</div><input type="file" accept=".gpkg" onchange="treeFileSet(this.files[0])">${GEO.treeFile ? '<div class="stn" style="margin:0"><b>' + esc(GEO.treeFile.name) + '</b> (' + (GEO.treeFile.size / 1048576).toFixed(0) + ' MB) – wird beim nächsten Projekt genutzt.</div>' : ''}${GEO.treeInfo ? '<div class="stn" style="margin:0">' + esc(GEO.treeInfo) + '</div>' : ''}<details><summary style="cursor:pointer" class="stn">Spalten selbst zuordnen</summary>Höhe <input type="text" style="width:110px" value="${esc((GEO.tcol || {}).h || '')}" oninput="GEO.tcol=Object.assign(GEO.tcol||{},{h:this.value.trim()})"> Kronendurchm. <input type="text" style="width:110px" value="${esc((GEO.tcol || {}).cd || '')}" oninput="GEO.tcol=Object.assign(GEO.tcol||{},{cd:this.value.trim()})"> Art <input type="text" style="width:110px" value="${esc((GEO.tcol || {}).sp || '')}" oninput="GEO.tcol=Object.assign(GEO.tcol||{},{sp:this.value.trim()})"></details><div class="tbar" style="margin:0"><button class="sm"${S.geo && GEO.treeFile && !GEO.busy ? '' : ' disabled'} onclick="treeFileApply()">Bäume jetzt aus Datei laden (aktuelles Projekt)</button><span id="tfm" class="stn" style="margin:0"></span></div></div>`;
  if (tab === 'bp') {
    const T = S.bpT;
    return `<div class="opt"><b>Bebauungsplan-Dienst (WFS)</b><div class="stn" style="margin:0">Gilt für alle Standorte (kein Länderdienst). WFS-Adresse und Typname, GeoJSON-Ausgabe nötig, wirkt beim nächsten Laden. Voreinstellung: Stadt Bielefeld.</div><div class="dk"><span>WFS-Adresse</span><em><input type="text" style="width:100%" value="${esc(BP.url)}" oninput="BP.url=this.value;BP.custom=true"></em></div><div class="dk"><span>Typname</span><em><input type="text" style="width:100%" value="${esc(BP.type)}" oninput="BP.type=this.value;BP.custom=true"></em></div><div class="tbar" style="margin:0"><button class="sm" onclick="bpTest()">Erreichbarkeit testen</button>${T ? `<span class="bdg ${T.ok ? 'ok' : 'fail'}">${T.ok ? '✓ erreichbar' : '✕ nicht erreichbar'}</span> <span class="stn" style="margin:0">${esc(T.msg)}</span>` : ''}</div>${GEO.bpMsg ? `<div class="stn" style="margin:0">Letztes Laden: ${esc(GEO.bpMsg)}</div>` : ''}</div>`;
  }
  return '';
}
async function bpTest() {
  S.bpT = null;
  const r = await srProbe(srCap(BP.url, 'WFS'));
  S.bpT = {
    ok: r.ok,
    msg: r.ok
      ? 'Server antwortet (HTTP ' + r.status + (r.via ? ', über Proxy' : '') + ').'
      : (r.err || 'HTTP ' + r.status) +
        (/blockiert/.test(r.err || '') ? ' – evtl. CORS: Proxy oben eintragen.' : ''),
  };
  srcOpen();
}
const SRT = [
  ['gb', 'Gebäudemodell'],
  ['tr', 'Bäume'],
  ['fl', 'Flurkarten'],
  ['ge', 'Gelände'],
  ['bp', 'Bebauungspläne'],
];
function srcPick(t, k) {
  S.srSel = S.srSel === t + ':' + k ? '' : t + ':' + k;
  srcOpen();
}
function srcOpen(t) {
  if (t) {
    S.srTab = t;
    S.srSel = '';
  }
  S.srTab = S.srTab || 'gb';
  let el = $('srcm');
  if (!el) {
    el = document.createElement('div');
    el.id = 'srcm';
    document.body.appendChild(el);
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) srcClose();
    });
    addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && $('srcm') && $('srcm').style.display === 'flex') {
          srcClose();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }
  const sb = el.querySelector('.srcb'),
    sc = sb ? sb.scrollTop : 0,
    D = srcData(),
    rp = D.rep;
  el.innerHTML = `<div class="srcw" role="dialog" aria-label="Datenquellen und Einstellungen"><div class="srch"><b>Datenquellen &amp; Einstellungen</b><span style="flex:1"></span><button class="sm" onclick="srcClose()">Schließen ✕</button></div><div class="srct">${SRT.map(([k, n]) => `<button class="${S.srTab === k ? 'on' : ''}" onclick="srcOpen('${k}')">${n}${rp && rp[k] ? ` <i class="dot ${rp[k].st}"></i>` : ''}</button>`).join('')}</div><div class="srcb"><div class="tbar" style="margin:0 0 8px"><label class="stn" style="margin:0">CORS-Proxy <input type="text" style="width:260px" placeholder="https://mein-proxy.workers.dev/?url=" value="${esc(GEO.proxy || '')}" oninput="proxySet(this.value)"></label><label class="stn" style="margin:0">MapTiler-Schlüssel <input type="text" style="width:170px" value="${esc(GEO.key)}" oninput="GEO.key=this.value" title="Im MapTiler-Konto die erlaubten Domains einschränken"></label>${S.srTab !== 'bp' && S.srTab !== 'um' && S.srTab !== 'ri' && S.srTab !== 'dv' ? `<button class="sm"${TB.busy || GEO.busy ? ' disabled' : ''} onclick="srProbeAll(S.srTab)">Erreichbarkeit aller Länder prüfen</button>` : ''}<button class="sm" onclick="mlOpen()" title="Kacheln aus .meta4-Dateien laden (z. B. Bayern DGM1/LoD2)">Metalink-Download …</button>${S.geo ? `<button class="sm"${TB.busy || GEO.busy ? ' disabled' : ''} onclick="srReload()">Umgebung neu laden</button>` : ''}${/^(all|reload)/.test(TB.busy) ? `<span id="srmsg" class="stn" style="margin:0">${esc(TB.msg)}</span>` : ''}</div><div class="stn" style="margin:0 0 6px">${rp ? 'Projekt-Ausschnitt liegt in <b>' + esc(rp.name || BLN[rp.key] || '?') + '</b> – dafür wurde automatisch geprüft, welche Datensätze geladen wurden. ' : 'Noch kein Ladeprotokoll (Demo-Daten oder kein Projekt). '}Ausgewertet wird immer zuerst die Landesquelle, bei einem Fehler der Fallback.</div>${D[S.srTab]}<div style="margin-top:10px">${srOpts(S.srTab)}</div></div></div>`;
  el.style.display = 'flex';
  const nb = el.querySelector('.srcb');
  if (nb) nb.scrollTop = sc;
}
