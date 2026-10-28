// ---- Gebäudemaske für das Kronenmodell aus dem Höhenmodell selbst (Frankreich/Österreich): Dächer sind ebene Flächen, Kronen nicht
function atMorph(m, W, H, r, dil) {
  const t = new Uint8Array(W * H),
    o = new Uint8Array(W * H),
    v = dil ? 1 : 0;
  for (let j = 0; j < H; j++) {
    const b = j * W;
    for (let i = 0; i < W; i++) {
      let hit = dil ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const x = i + d;
        const u = x < 0 || x >= W ? (dil ? 0 : 1) : m[b + x];
        if (dil) {
          if (u) {
            hit = 1;
            break;
          }
        } else if (!u) {
          hit = 0;
          break;
        }
      }
      t[b + i] = hit;
    }
  }
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      let hit = dil ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const y = j + d;
        const u = y < 0 || y >= H ? (dil ? 0 : 1) : t[y * W + i];
        if (dil) {
          if (u) {
            hit = 1;
            break;
          }
        } else if (!u) {
          hit = 0;
          break;
        }
      }
      o[j * W + i] = hit;
    }
  return o;
}
function atRoofClean(DG, DO) {
  const W = DO.w,
    H = DO.h,
    res = DO.res,
    z = DO.data,
    g = DG.data,
    N = W * H,
    n = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = z[i],
      b = g[i];
    n[i] = a > -400 && a < 4500 && b > -400 && b < 4500 ? a - b : 0;
  }
  const pl = new Uint8Array(N),
    tall = new Uint8Array(N),
    vv = new Float32Array(25);
  for (let j = 2; j < H - 2; j++)
    for (let i = 2; i < W - 2; i++) {
      const k = j * W + i;
      if (n[k] < 2.5) continue;
      tall[k] = 1;
      let s = 0,
        sx = 0,
        sy = 0,
        q = 0,
        bad = 0;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const v = z[(j + dj) * W + i + di];
          if (!(v > -400 && v < 4500)) {
            bad = 1;
            break;
          }
          vv[q++] = v;
          s += v;
          sx += di * v;
          sy += dj * v;
        }
      if (bad) continue;
      const m = s / 25,
        a = sx / 50,
        b = sy / 50;
      let rs = 0;
      q = 0;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const e = vv[q++] - m - a * di - b * dj;
          rs += e * e;
        }
      if (Math.sqrt(rs / 25) < 0.12) pl[k] = 1;
    }
  const cl = atMorph(atMorph(pl, W, H, 2, 1), W, H, 2, 0),
    B = new Uint8Array(N);
  for (let i = 0; i < N; i++) B[i] = cl[i] && tall[i] ? 1 : 0;
  const lab = new Int32Array(N),
    keep = new Uint8Array(N),
    st = new Int32Array(N);
  let cnt = 0;
  for (let s0 = 0; s0 < N; s0++) {
    if (!B[s0] || lab[s0]) continue;
    let sp = 0,
      ar = 0,
      pc = 0;
    const mem = [];
    st[sp++] = s0;
    lab[s0] = 1;
    while (sp) {
      const k = st[--sp];
      mem.push(k);
      ar++;
      if (pl[k]) pc++;
      const i = k % W,
        j = (k - i) / W;
      if (i > 0 && B[k - 1] && !lab[k - 1]) {
        lab[k - 1] = 1;
        st[sp++] = k - 1;
      }
      if (i < W - 1 && B[k + 1] && !lab[k + 1]) {
        lab[k + 1] = 1;
        st[sp++] = k + 1;
      }
      if (j > 0 && B[k - W] && !lab[k - W]) {
        lab[k - W] = 1;
        st[sp++] = k - W;
      }
      if (j < H - 1 && B[k + W] && !lab[k + W]) {
        lab[k + W] = 1;
        st[sp++] = k + W;
      }
    }
    if (ar * res * res >= 12 && pc / ar >= 0.6) {
      for (const k of mem) keep[k] = 1;
      cnt++;
    }
  }
  if (!cnt) return { data: z, n: 0 };
  const dk = atMorph(keep, W, H, 2 + Math.max(1, Math.round(0.8 / res)), 1),
    o = new Float32Array(z);
  let px = 0;
  for (let i = 0; i < N; i++)
    if (dk[i] && g[i] > -400 && g[i] < 4500) {
      o[i] = g[i];
      px++;
    }
  return { data: o, n: cnt, px };
}
{
  const _c = canopy;
  canopy = function (DG, DO, bl, skip, ex) {
    if (DG && !DG.fail && DO && !DO.fail && DO.plan && DO.res <= 1.5 && DG.w === DO.w && DG.h === DO.h) {
      try {
        const r = atRoofClean(DG, DO);
        if (r.n) {
          DO = Object.assign({}, DO, { data: r.data });
          const c = _c.call(this, DG, DO, bl, skip, ex);
          c.msg = (c.msg || '') + ' Dachflächen aus dem Höhenmodell maskiert: ' + r.n + ' Gebäude.';
          return c;
        }
      } catch (e) {
        logErr(e, 'canopy');
      }
    }
    return _c.apply(this, arguments);
  };
}

// ---- Datenquellen & Einstellungen: nach Ländern gegliedert (Deutschland mit Bundesland-Auswahl, weitere Länder als Zeilen)
const CTT = {},
  CTY = [
    {
      k: 'fr',
      n: 'Frankreich',
      box: [-5.3, 8.3, 42.3, 51.2],
      ok: 1,
      ge: [
        'IGN LiDAR HD: MNT (Gelände) und MNS (Oberfläche), 1 m, WMS GetMap über data.geopf.fr',
        'Licence Ouverte 2.0 (IGN)',
      ],
      tr: [
        'Kronenmodell aus MNS − MNT mit Dachflächen-Maske (aus dem Höhenmodell) und Gebäudegrundrissen; OSM-Bäume',
        'Baumkronen aus Höhenmodellen (ohne Art)',
      ],
      info: 'Direkter Browser-Abruf funktioniert (CORS offen). Gelände und Oberfläche werden auf das UTM-Raster des Projekts umgerechnet.',
      probe: 'https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetCapabilities',
    },
    {
      k: 'at',
      n: 'Österreich',
      box: [9.5, 17.2, 46.3, 49.05],
      ok: 1,
      ge: [
        'BEV ALS-Höhenraster DTM/DSM, 1 m, 50-km-Kacheln (BigTIFF, LZW), nur benötigte Blöcke per Teilabruf über den CORS-Proxy (Host data.bev.gv.at im Worker freigeben)',
        'CC BY 4.0 (BEV)',
      ],
      tr: [
        'Kronenmodell aus DSM − DTM mit Dachflächen-Maske und Gebäudegrundrissen; OSM-Bäume',
        'Baumkronen aus Höhenmodellen (ohne Art)',
      ],
      info: 'Kachelliste aus dem ATOM-Dienst des BEV (neuester Stichtag je Kachel, 30 Tage zwischengespeichert).',
      probe:
        'https://data.bev.gv.at/geonetwork/srv/atom/describe/service?uuid=208cff7a-c8aa-42fe-bf4f-2b8156e37528',
    },
    {
      k: 'ch',
      n: 'Schweiz',
      src: 'swisstopo swissALTI3D (Gelände, 0,5 m) und swissSURFACE3D (Oberfläche) über STAC-Katalog',
      lic: 'Open Government Data (swisstopo)',
      probe: 'https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d',
    },
    {
      k: 'nl',
      n: 'Niederlande',
      src: 'AHN (Actueel Hoogtebestand Nederland) DTM/DSM über PDOK-WCS',
      lic: 'CC0',
      probe: 'https://service.pdok.nl/rws/ahn/wcs/v1_0?SERVICE=WCS&REQUEST=GetCapabilities',
    },
    {
      k: 'be',
      n: 'Belgien',
      src: 'Flandern: Digitaal Hoogtemodel (DHMV); Wallonien: LiDAR-Modelle (Service Public de Wallonie)',
      lic: 'regional unterschiedlich',
    },
    {
      k: 'lu',
      n: 'Luxemburg',
      src: 'Administration du cadastre et de la topographie: MNT/MNS (data.public.lu)',
      lic: 'CC0',
    },
    {
      k: 'es',
      n: 'Spanien',
      src: 'IGN España: MDT (Gelände) und MDS (Oberfläche) über WCS',
      lic: 'CC BY 4.0 (IGN)',
      probe: 'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&REQUEST=GetCapabilities',
    },
    {
      k: 'it',
      n: 'Italien',
      src: 'regional: TINITALY (10 m) bzw. Regionen mit LiDAR-Modellen',
      lic: 'unterschiedlich',
    },
    {
      k: 'uk',
      n: 'Großbritannien (England)',
      src: 'Environment Agency LIDAR Composite DTM/DSM, 1 m, über WCS',
      lic: 'Open Government Licence',
      probe:
        'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m-2022/wcs?SERVICE=WCS&REQUEST=GetCapabilities',
    },
    {
      k: 'dk',
      n: 'Dänemark',
      src: 'Dataforsyningen: Danmarks Højdemodel (DHM) Terræn/Overflade (Zugangs-Token nötig)',
      lic: 'frei, Anmeldung',
    },
    {
      k: 'no',
      n: 'Norwegen',
      src: 'Kartverket Høydedata: DTM/DOM aus LiDAR (hoydedata.no)',
      lic: 'CC BY 4.0',
    },
    {
      k: 'pl',
      n: 'Polen',
      src: 'GUGiK: NMT und NMPT (1 m) über WCS',
      lic: 'offene Daten (GUGiK)',
      probe:
        'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF?SERVICE=WCS&REQUEST=GetCapabilities',
    },
    {
      k: 'cz',
      n: 'Tschechien',
      src: 'ČÚZK: DMR 5G (Gelände) und DMP 1G (Oberfläche)',
      lic: 'CC BY 4.0',
      probe: 'https://ags.cuzk.cz/arcgis1/rest/services/DMR5G/ImageServer?f=json',
    },
    {
      k: 'us',
      n: 'USA',
      box: [-125, -66, 24, 50],
      src: 'USGS 3D Elevation Program (3DEP): Gelände 1 m bis 1/3 Bogensekunde über ImageServer; Oberfläche nur teilweise (LiDAR-Punktwolken)',
      lic: 'Public Domain (USGS)',
      probe: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer?f=json',
    },
  ];
const ctyRows = (tab) =>
  CTY.map((c) => {
    const sel = S.ctySel === tab + ':' + c.k,
      cur =
        S.geo &&
        c.box &&
        GEO.lon > c.box[0] &&
        GEO.lon < c.box[1] &&
        GEO.lat > c.box[2] &&
        GEO.lat < c.box[3],
      bd = c.ok
        ? '<br><span class="bdg ok">eingebunden</span>'
        : '<br><span class="bdg fb">Kandidat, nicht eingebunden</span>',
      T = CTT[c.k],
      tb = T
        ? ` <span class="bdg ${T.ok ? 'ok' : 'fail'}">${T.ok ? '✓ erreichbar' : '✕ nicht erreichbar'}</span>`
        : '';
    const cand = c.src ? esc(c.src) + ' <i>(Adresse aus Recherche, ungeprüft)</i>' : '';
    let cells;
    if (tab === 'ge')
      cells = c.ok
        ? [c.ge[0], c.ge[1], 'MapTiler Terrain-RGB (grob, ca. 10 m)']
        : [cand, esc(c.lic || '–'), 'MapTiler Terrain-RGB (grob, ca. 10 m)'];
    else if (tab === 'tr')
      cells = c.ok
        ? [c.tr[0], c.tr[1], 'OSM-Bäume (Overpass)']
        : ['–', '–', 'OSM-Bäume (Overpass): Punkte, Höhe/Krone aus Tags oder geschätzt'];
    else if (tab === 'gb')
      cells = [
        'OSM-Gebäude über MapTiler (extrudiert)',
        'Grundriss + geschätzte Höhe, keine Dachform',
        'kein Landesdienst eingebunden',
        '–',
      ];
    else
      cells = ['–', '–', 'kein Flurstücksdienst hinterlegt', 'Kartenhintergrund MapTiler, ohne Flurstücke'];
    const n = tab === 'ge' || tab === 'tr' ? 4 : 5;
    const det = sel
      ? `<tr class="dt"><td colspan="${n}"><div class="stn" style="margin:0 0 6px">${c.ok ? esc(c.info) : 'Noch nicht eingebunden. Die Quelle ist ein Kandidat aus der Recherche; Adresse, Format und Abdeckung sind nicht im Browser geprüft.'}</div>${c.probe ? `<div class="dk"><span>Prüfadresse</span><em style="word-break:break-all">${esc(c.probe)}</em></div><div class="tbar" style="margin:4px 0 0"><button class="sm" onclick="event.stopPropagation();ctyProbe('${c.k}')">Erreichbarkeit prüfen</button>${T ? `<span class="stn" style="margin:0">${esc(T.msg)}</span>` : ''}</div>` : '<div class="stn" style="margin:0">Keine Prüfadresse hinterlegt.</div>'}</td></tr>`
      : '';
    return `<tr class="${cur ? 'cur ok' : ''}${sel ? ' sel' : ''}" onclick="ctyPick('${tab}','${c.k}')"><td><b>${esc(c.n)}</b>${bd}${tb}</td>${cells.map((x) => `<td>${x}</td>`).join('')}</tr>${det}`;
  }).join('');
function ctyPick(tab, k) {
  S.ctySel = S.ctySel === tab + ':' + k ? '' : tab + ':' + k;
  S.srSel = '';
  srcOpen();
}
async function ctyProbe(k) {
  const c = CTY.find((x) => x.k === k);
  if (!c || !c.probe) return;
  CTT[k] = { ok: 0, msg: 'prüfe …' };
  srcOpen();
  try {
    const r = await srProbe(c.probe);
    CTT[k] = {
      ok: !!r.ok,
      msg: r.ok
        ? 'Server antwortet (HTTP ' + r.status + (r.via ? ', über Proxy' : '') + ').'
        : (r.err || 'HTTP ' + r.status) +
          (/blockiert|Netzwerk/.test(r.err || '') ? ' – evtl. CORS: CORS-Proxy oben eintragen.' : ''),
    };
  } catch (e) {
    CTT[k] = { ok: 0, msg: String(e.message || e) };
  }
  srcOpen();
}
async function ctyProbeAll() {
  for (const c of CTY) if (c.probe) await ctyProbe(c.k);
}
{
  const _p = srcPick;
  srcPick = function (t, k) {
    S.ctySel = '';
    return _p.apply(this, arguments);
  };
}
{
  const _s = srcData;
  srcData = function () {
    const keys = Object.keys(BLN),
      saved = Object.assign({}, BLN),
      rp = GEO.rep;
    let sel =
      S.srDe && saved[S.srDe]
        ? S.srDe
        : rp && saved[rp.key]
          ? rp.key
          : keys.find((k) => saved[k] === GEO.alkBL) || 'nrw';
    keys.forEach((k) => {
      if (k !== sel) delete BLN[k];
    });
    let D;
    try {
      D = _s.apply(this, arguments);
    } finally {
      delete BLN[sel];
      keys.forEach((k) => {
        BLN[k] = saved[k];
      });
    }
    const bar = `<div class="tbar" style="margin:0 0 6px"><label class="stn" style="margin:0"><b>Deutschland</b> – Bundesland <select onchange="S.srDe=this.value;S.srSel='';srcOpen()">${keys.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(saved[k])}</option>`).join('')}</select></label><button class="sm" onclick="ctyProbeAll()" title="Alle hinterlegten Prüfadressen der Länder abfragen">Erreichbarkeit der weiteren Länder prüfen</button></div>`;
    for (const t of ['gb', 'tr', 'fl', 'ge']) {
      let h = D[t];
      if (!h) continue;
      h = h
        .replace('<th>Bundesland</th>', '<th>Land</th>')
        .replace('<td><b>', '<td><b>Deutschland · ')
        .replace('</table>', ctyRows(t) + '</table>');
      D[t] = bar + h;
    }
    return D;
  };
}
