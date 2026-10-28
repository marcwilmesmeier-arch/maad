/* ---------- Seiten ---------- */
function axUe(b) {
  const s = axSites();
  if (!s)
    return '<div class="axk">Noch kein Grundstück und keine Umgebung geladen. Flurstück anklicken oder Projekt anlegen.</div>';
  const pl = [];
  const idx = new Set();
  s.polys.forEach((p) => planAt(p).forEach((i) => idx.add(i)));
  idx.forEach((i) => pl.push(BPL[i]));
  let h = '';
  ENV.forEach((e) => {
    const c = envCfg(e.k);
    if ((c && c.url && c.type && c.kind !== 'wms') || (c && c.kind === 'wms' && c.url && c.type)) {
      const r = ENVR[e.k];
      if (!r || (r.site !== axKey(s) && !r.busy))
        setTimeout(() => {
          const r2 = ENVR[e.k];
          if (S.tab === 'Analyse' && (!r2 || (r2.site !== axKey(axSites()) && !r2.busy))) envRun(e.k);
        }, 400);
    }
  });
  /* Bebauungsplan */
  let bp = '';
  if (!BPL.length) bp = axR('Status', S.geo ? 'keine Plandaten geladen' : 'nicht geladen', 1);
  else if (!pl.length)
    bp =
      '<div class="axk">Kein Bebauungsplan für ' +
      (s.project ? 'das Gebiet' : 'die Auswahl') +
      ' – Zulässigkeit ggf. nach § 34 / § 35 BauGB.</div>';
  else {
    const pr = pl[0].props,
      fd = bpFound(pr),
      L = S.lim,
      grz = fd.grz || L.grz,
      gfz = fd.gfz || L.gfz,
      nu = axProp(pr, /nutzung|baugebiet|gebietsart|art.*bauli|baugeb/i),
      bl = axProp(pr, /baulinie|baugrenze|baufenster/i);
    bp =
      `<div class="axb"><i></i>Plan vorhanden${pl.length > 1 ? ' (' + pl.length + ')' : ''}</div>` +
      axR('Nutzung', nu ? esc(nu.slice(0, 60)) : '–', !nu) +
      axR('GRZ / GFZ', (grz ? axD(grz) : '–') + ' / ' + (gfz ? axD(gfz) : '–'), !grz && !gfz) +
      axR('Baulinie / Baugrenze', bl ? esc(bl.slice(0, 40)) : 'nicht in den Plandaten', !bl);
  }
  h += axS('plan', 'Bebauungsplan', bp, 0, BPL.length ? 'bplan' : '', 'Bebauungspläne');
  /* Höhen & Gelände */
  const t = axTerrain(s.polys);
  h += axS(
    'hoe',
    'Höhen &amp; Gelände',
    t
      ? axR(
          'Geländehöhe (min/max)',
          axD(t.min.toFixed(1)) + ' m / ' + axD(t.max.toFixed(1)) + ' m' + (t.abs ? '' : ' (Demo, relativ)'),
        ) + axR('Geländeneigung', axD(Math.round(t.s0)) + ' – ' + axD(Math.round(t.s1)) + ' %')
      : axR('Gelände', 'keine Höhendaten', 1),
  );
  h += axClim(s);
  {
    const ce = ENV.find((e) => e.clc);
    if (ce) h += axS('flae', 'Flächennutzung', envRow(ce, s), 0, envTg(ce), 'Flächennutzung (CORINE)');
  }
  /* Umwelt & Schutz */
  h +=
    '<div class="axs" style="padding-bottom:4px"><div class="axi">' +
    axI(AXI.leaf) +
    '</div><div><div class="axn">Umwelt &amp; Schutz</div></div></div>';
  ENV.filter((e) => e.g === 'env').forEach((e) => {
    h += axS(e.ic, '', envRow(e, s), 1, envTg(e), e.n.replace(/\u00ad/g, ''));
  });
  const tr = (GEO.trees || []).filter((q) => s.polys.some((p) => inP([q.x, q.z], p))),
    src = [
      ...new Set(
        tr.map((q) =>
          q.src === 'kataster'
            ? 'Baumkataster'
            : q.src === 'gpkg'
              ? 'Baumdatei'
              : q.src === 'osm'
                ? 'OSM'
                : 'Kronenmodell',
        ),
      ),
    ];
  h += axS(
    'tree',
    '',
    axR(
      'Baumbestand',
      S.geo
        ? tr.length +
            (tr.length === 1 ? ' Baum' : ' Bäume') +
            (s.project ? ' im Gebiet' : ' im Grundstück') +
            (tr.length && src.length ? ' <span class="mu">(' + esc(src.join(', ')) + ')</span>' : '')
        : 'Demo-Bäume',
      !S.geo,
    ),
    1,
  );
  /* Lärm */
  const le = ENV.find((e) => e.g === 'lae');
  h += axS('noise', 'Lärm', envRow(le, s));
  if (ENV.some((e) => envHas(e.k))) h += '<button class="axp" onclick="envAll()">Umweltdaten prüfen</button>';
  /* Gebäude (bisheriger Inhalt der Analyse) */
  const k = b ? kw(b) : S.bld.length ? kw(S.bld.at(-1)) : null;
  let g = flHtml(b) || '<div class="axk">Noch kein Gebäude.</div>';
  if (!k) g += '<div class="axk">Gebäude auf einem Grundstück erzeugen/auswählen.</div>';
  else {
    const w1 = k.grz > S.lim.grz,
      w2 = k.gfz > S.lim.gfz;
    g +=
      '<h4>Grundstück</h4><div class="card">' +
      kv('Grundstücksfläche', f1(k.A) + ' m²') +
      kv('Überbaute Fläche', f1(k.fp) + ' m²') +
      arKv(k) +
      kv('GRZ', f1(k.grz, 2), w1 ? 'wa' : 'ok') +
      kv('GFZ', f1(k.gfz, 2), w2 ? 'wa' : 'ok') +
      '</div>' +
      (w1 || w2
        ? `<div class="card wa" style="margin-top:8px">⚠ Planungsrecht überschritten${w1 ? ' (GRZ &gt; ' + S.lim.grz + ')' : ''}${w2 ? ' (GFZ &gt; ' + S.lim.gfz + ')' : ''} – Hinweis, keine Sperre.</div>`
        : '');
  }
  h += axS('geb', 'Gebäude', g);
  return h;
}
function axRe(b) {
  const s = axSites();
  let h = '';
  h += axS(
    'plan',
    'Planungsrecht (Grenzwerte)',
    `GRZ max<input type="number" step="0.05" value="${S.lim.grz}" onchange="S.lim.grz=+this.value;rr()">GFZ max<input type="number" step="0.1" value="${S.lim.gfz}" onchange="S.lim.gfz=+this.value;rr()">`,
  );
  if (s) {
    const idx = new Set();
    s.polys.forEach((p) => planAt(p).forEach((i) => idx.add(i)));
    if (idx.size) {
      let c = '';
      idx.forEach((i) => (c += planCard(i)));
      h += axS('plan', 'Festsetzungen aus dem Plan', c);
    }
  }
  const rb = b || (S.bld.length ? S.bld.at(-1) : null);
  if (rb && !rb.ex) {
    try {
      h += axS('geb', 'Prüfung Gebäude', ruleCard(rb).replace(/<h4>[^<]*<\/h4>/, ''));
    } catch (e) {
      logErr(e, 'axRe');
    }
  }
  h += axS('hoe', 'Abstandsflächen', abstCard().replace(/<h4>Abstandsflächen<\/h4>/, ''));
  return h;
}
function axDqUsed() {
  let h =
    '<div class="axk" style="margin:0 0 8px">Quelle | Größe | Stand der Daten, die in der Analyse „Grundstück und Umgebung“ verwendet werden. Alle geladenen Ebenen: Reiter „Datenebenen“.</div>';
  for (const k of ['terrain', 'bplan', 'trees', 'parcels']) {
    const d = datInfo(k);
    if (!d) continue;
    h += axS(
      d.ic.length > 1 && AXI[d.ic]
        ? d.ic
        : k === 'terrain'
          ? 'hoe'
          : k === 'bplan'
            ? 'plan'
            : k === 'trees'
              ? 'tree'
              : 'pin',
      esc(d.n),
      '<div class="axk" style="margin:0">' +
        d.line +
        '</div>' +
        (d.det
          ? '<details style="margin-top:4px"><summary class="axk">Details</summary>' + d.det + '</details>'
          : ''),
    );
  }
  h += axS(
    'sun',
    'Klima',
    '<div class="axk" style="margin:0">Deutscher Wetterdienst (DWD) <i class="zds">|</i> 1-km-Raster <i class="zds">|</i> 1991–2020</div><details style="margin-top:4px"><summary class="axk">Details</summary>' +
      kv(
        'Datensätze',
        'Temperatur, Niederschlag, Sonnenscheindauer, Frosttage, Heiße Tage, Globalstrahlung (Jahreswerte 1991–2020), Windgeschwindigkeit in 10 m (1981–2000)',
      ) +
      kv('Lizenz', 'CC BY 4.0, © Deutscher Wetterdienst') +
      kv('Dienst', 'opendata.dwd.de (ASCII-Raster als .asc.gz, .zip und .asc, Gauß-Krüger Zone 3)') +
      kv('Wert am', 'Grundstücksmittelpunkt (Zelle von 1 km)') +
      '</details>',
  );
  return h;
}
function envFormHtml(e, land, cmp) {
  const L = land || '',
    c = envCfgFor(e.k, L) || {},
    ck = 'caps_' + e.k + (L ? '@' + L : ''),
    cp = ENVR[ck],
    q = L ? ",'" + L + "'" : '',
    ok = !!(c.url && c.type);
  return (
    `<div class="axq"${cmp ? ' style="border:0;padding:0"' : ''}>${cmp ? '' : `<div class="axn" style="display:flex;justify-content:space-between;align-items:center">${axI(AXI[e.ic], 16)}<span style="flex:1;margin-left:8px">${L ? esc(BLN[L]) : e.n}</span>${ok ? '<span class="axb"><i></i>angebunden</span>' : '<span class="axk">nicht angebunden</span>'}</div>`}${L || cmp ? '' : `<div class="axk" style="margin:0 0 6px">${esc(e.hint)}</div>`}` +
    `<label>Diensttyp</label><select onchange="envSet('${e.k}','kind',this.value${q})"><option value="wfs" ${c.kind === 'wms' || c.kind === 'arcgis' ? '' : 'selected'}>WFS (Polygone, Schnitt mit Grundstück)</option><option value="wms" ${c.kind === 'wms' ? 'selected' : ''}>WMS (Abfrage am Grundstücksmittelpunkt)</option><option value="arcgis" ${c.kind === 'arcgis' ? 'selected' : ''}>ArcGIS REST (Layer, Schnitt mit Grundstück)</option></select>` +
    (ENVSRC[e.k] && !L
      ? `<div class="axk" style="margin:0 0 6px"><b>${esc(ENVSRC[e.k].by)}</b> · ${esc(ENVSRC[e.k].lic)}<br>${esc(ENVSRC[e.k].note)}${c.pre ? ' · <i>Adresse vorbelegt, Abruf im Browser noch ungeprüft</i>' : ''}</div>`
      : '') +
    `<label>Dienst-Adresse</label><input type="text" value="${esc(c.url || '')}" placeholder="https://…/wfs" onchange="envSet('${e.k}','url',this.value${q})">` +
    `<label>Ebenenname (WFS: typeName, WMS: Layer, ArcGIS: Layer-Nummer)</label><input type="text" value="${esc(c.type || '')}" placeholder="z. B. ns:Schutzgebiete" onchange="envSet('${e.k}','type',this.value${q})">` +
    `<label>Koordinatensystem (WFS)</label><select onchange="envSet('${e.k}','crs',this.value${q})"><option value="25832" ${(c.crs || '25832') === '25832' ? 'selected' : ''}>EPSG:25832 (ETRS89 / UTM 32)</option><option value="4326" ${c.crs === '4326' ? 'selected' : ''}>CRS84 (Länge/Breite)</option></select>` +
    (e.attr
      ? `<label>Attributfeld für den Pegel (z. B. LDEN)</label><input type="text" value="${esc(c.attr || '')}" onchange="envSet('${e.k}','attr',this.value${q})">`
      : '') +
    `<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="axs2" ${c.url ? '' : 'disabled'} onclick="envCaps('${e.k}'${L ? ",'" + L + "'" : ''})">Ebenen auslesen</button><button class="axs2" ${ok && (!L || L === envLand()) ? '' : 'disabled'} onclick="envRun('${e.k}')" ${L && L !== envLand() ? 'title="Prüfen am Grundstück nur im Projekt in diesem Bundesland möglich"' : ''}>Jetzt prüfen</button><button class="axs2" onclick="envClear('${e.k}'${L ? ",'" + L + "'" : ''})">Entfernen</button></div>` +
    (cp && cp.busy ? '<div class="axk">liest …</div>' : '') +
    (cp && cp.err ? '<div class="axe">' + esc(cp.err) + '</div>' : '') +
    (cp && cp.info ? '<div class="axk">' + esc(cp.info) + '</div>' : '') +
    (cp && cp.names
      ? '<div class="axk" style="margin-top:6px">Ebene wählen:</div><div style="max-height:110px;overflow:auto">' +
        cp.names
          .map(
            (n, i) =>
              `<div><a class="axl" onclick="envPick('${e.k}',${i}${L ? ",'" + L + "'" : ''})">${esc(n)}</a></div>`,
          )
          .join('') +
        '</div>'
      : '') +
    '</div>'
  );
}
function axDqEnv() {
  let h =
    '<div class="axk" style="margin:0 0 8px">Datenquellen für „Umwelt &amp; Schutz“ und die Karten-Ebenen (Naturschutz). Änderungen wirken sofort; „Jetzt prüfen“ testet die Quelle am gewählten Grundstück. Hochwasser, Starkregen und weitere Risikogebiete stehen im Reiter „Risikogebiete“.</div>';
  for (const e of ENV) if (!e.rg) h += envFormHtml(e, '');
  h +=
    '<div class="axk">Hinweis: Der Dienst muss vom Browser erreichbar sein (CORS) und GeoJSON liefern; sonst unter „Projekt“ einen CORS-Proxy eintragen. WFS: Schnitt der Grundstücksfläche mit den Polygonen des Dienstes; WMS: Abfrage (GetFeatureInfo) am Grundstücksmittelpunkt; ArcGIS REST: Adresse bis einschließlich Layer-Nummer (…/MapServer/0), Abfrage mit der Grundstücksfläche.</div>';
  return h;
}
