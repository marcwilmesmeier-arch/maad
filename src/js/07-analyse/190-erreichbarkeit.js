// ======================= ERREICHBARKEIT ZU FUSS UND ÖPNV =======================
// Wegenetz und Haltestellen aus OpenStreetMap (Overpass). Gehzeiten ab dem Grundstück (von jeder Ecke zum nächsten
// Weg; ohne gewähltes Grundstück ab der Projektmitte) werden in hellen Blautönen auf Boden und Gebäude gelegt (Bänder 5/10/15[/20] min, gleiche Mischung wie
// die Kartenflächen). Haltestellen (Bus, Straßenbahn, U-Bahn, S-Bahn, Bahnhof) als kleine runde Symbole an einer
// kurzen Linie; Flughäfen im Umkreis von 60 km mit Entfernung im Panel. Rechnung: 180-erreichbarkeit-rechnen.js.

const ER = {
  st: 'aus',
  fehler: '',
  p: null,
  wahl: false,
  wege: null,
  halte: [],
  flug: [],
  raster: null,
  key: '',
};
S.er = { tMax: 15, v: 80 }; // v: Gehgeschwindigkeit m/min (4,8 km/h)
const ER_BAND = ['#86b6e2', '#a9cbec', '#c9def3', '#e0ecf8']; // ≤5, ≤10, ≤15, ≤20 min (helle Blautöne)
// g: Symbol aus dem Satz „Mobility & Access“ (185-symbole.js), einheitlich in Salbeigrün
const ER_TYP = {
  bf: { g: 'bahn', n: 'Bahnhof' },
  s: { g: 's', n: 'S-Bahn' },
  u: { g: 'u', n: 'U-Bahn' },
  tram: { g: 'tram', n: 'Straßenbahn' },
  bus: { g: 'bus', n: 'Bus' },
  flug: { g: 'flug', n: 'Flughafen' },
};
LY.push(['Erreichbarkeit zu Fuß', 'erg', 1, 1], ['ÖPNV-Haltestellen', 'erh', 1, 1]);
const ER_G = new T.Group();
ER_G.name = 'oepnv';
sc.add(ER_G);
G.erh = ER_G;

/** Start: Ecken des gewählten Grundstücks (zusammengelegt oder Flurstücke), sonst die Projektmitte. */
function erStart() {
  try {
    const s = axSites();
    if (s && !s.project && s.polys && s.polys.length) return s.polys.flat();
  } catch (e) {
    logErr(e, 'erStart');
  }
  return [[0, 0]];
}
const erStartSig = () => JSON.stringify(erStart().map((p) => p.map(Math.round)));
function erBaender() {
  return [5, 10, 15, 20].filter((t) => t <= S.er.tMax);
}

/** Art einer Haltestelle aus den OSM-Merkmalen. */
function erTyp(t) {
  if (t.aeroway === 'aerodrome') return 'flug';
  if (t.station === 'subway' || t.subway === 'yes' || t.railway === 'subway_entrance') return 'u';
  if (t.station === 'light_rail' || t.light_rail === 'yes') return 's';
  if (/^(station|halt)$/.test(t.railway || '') || (t.public_transport === 'station' && t.train === 'yes'))
    return 'bf';
  if (t.railway === 'tram_stop' || t.tram === 'yes') return 'tram';
  if (t.highway === 'bus_stop' || t.bus === 'yes' || t.amenity === 'bus_station') return 'bus';
  return null;
}

/** Wegenetz, Haltestellen und Flughäfen laden und rechnen. */
async function erLaden() {
  if (!S.geo) {
    ER.st = 'fehler';
    ER.fehler = 'Nur mit geladenem Projektstandort (nicht in der Demo).';
    rr();
    return;
  }
  ER.st = 'laedt';
  ER.fehler = '';
  rr();
  const st = cen(erStart()),
    R = S.er.v * S.er.tMax * 1.1, // Reichweite um den Start (m)
    h = GEO.size / 2,
    x0 = Math.min(-h, st[0] - R),
    x1 = Math.max(h, st[0] + R),
    z0 = Math.min(-h, st[1] - R),
    z1 = Math.max(h, st[1] + R),
    ll = (x, z) => [GEO.lat - z / 110574, GEO.lon + x / GEO.kx],
    [la0, lo0] = ll(x0, z1),
    [la1, lo1] = ll(x1, z0),
    bb = [la0, lo0, la1, lo1].map((v) => v.toFixed(6)).join(','),
    q =
      `[out:json][timeout:60];(` +
      `way["highway"]["highway"!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway|bus_guideway|corridor)$"]["foot"!~"^(no|private)$"]["access"!~"^(no|private)$"](${bb});` +
      `);out body geom qt;(` +
      `node["highway"="bus_stop"](${bb});nwr["amenity"="bus_station"](${bb});` +
      `node["railway"~"^(station|halt|tram_stop|subway_entrance)$"](${bb});nwr["public_transport"="station"](${bb});` +
      `);out tags center qt;` +
      `nwr["aeroway"="aerodrome"]["iata"](around:60000,${GEO.lat.toFixed(6)},${GEO.lon.toFixed(6)});out tags center qt;`;
  let j = null;
  try {
    j = await overpassAbruf(q, 'erLaden');
  } catch (e) {
    ER.st = 'fehler';
    ER.fehler = e.message;
    rr();
    return;
  }
  erAuswerten(j.elements || []);
  ER.key = ovKey();
  ER.startSig = erStartSig();
  erRechnen();
}

/** Overpass-Antwort: Wege (für das Netz), Haltestellen (zusammengefasst je Art und Name), Flughäfen. */
function erAuswerten(els) {
  const xz = (la, lo) => [(lo - GEO.lon) * GEO.kx, -(la - GEO.lat) * 110574],
    wege = [],
    gruppen = new Map(),
    flug = [];
  for (const e of els) {
    const t = e.tags || {};
    if (e.type === 'way' && t.highway && e.nodes && e.geometry && e.nodes.length === e.geometry.length) {
      wege.push({ ids: e.nodes, pts: e.geometry.map((g) => xz(g.lat, g.lon)) });
      continue;
    }
    const typ = erTyp(t);
    if (!typ) continue;
    const la = e.lat != null ? e.lat : e.center && e.center.lat,
      lo = e.lon != null ? e.lon : e.center && e.center.lon;
    if (la == null || lo == null) continue;
    const p = xz(la, lo),
      name = t.name || ER_TYP[typ].n;
    if (typ === 'flug') {
      if (!flug.some((f) => f.name === name))
        flug.push({ name, iata: t.iata || '', km: Math.hypot(p[0], p[1]) / 1000 });
      continue;
    }
    // Haltestellen gleicher Art und gleichen Namens (Steige, Gleise, Eingänge) zu einer zusammenfassen
    const k = typ + '|' + name,
      L = gruppen.get(k) || [];
    let g = L.find((q) => Math.hypot(q.sx / q.n - p[0], q.sz / q.n - p[1]) < 250);
    if (!g) {
      g = { typ, name, sx: 0, sz: 0, n: 0 };
      L.push(g);
      gruppen.set(k, L);
    }
    g.sx += p[0];
    g.sz += p[1];
    g.n++;
  }
  ER.wege = wege;
  ER.halte = [...gruppen.values()]
    .flat()
    .map((g) => ({ typ: g.typ, name: g.name, p: [g.sx / g.n, g.sz / g.n] }));
  ER.flug = flug.sort((a, b) => a.km - b.km).slice(0, 3);
}

/** Gehzeiten rechnen (Netz, Raster) und darstellen. */
function erRechnen() {
  if (!ER.wege) return;
  const st = erStart(),
    netz = erNetz(ER.wege),
    z = erZeiten(netz, st, S.er.v, S.er.tMax),
    h = GEO.size / 2,
    zelle = Math.max(2, GEO.size / 500);
  ER.raster = erRaster(netz, z, h, zelle, S.er.v, 120, S.er.tMax); // bis 120 m abseits der Wege (Höfe, Blockinneres)
  ER.zugang = z.zugang;
  // Gehzeit je Haltestelle: nächster Netzknoten + Reststrecke
  for (const s of ER.halte) {
    let best = Infinity,
      bi = -1;
    for (let i = 0; i < netz.x.length; i++) {
      const d = Math.hypot(netz.x[i] - s.p[0], netz.z[i] - s.p[1]);
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    s.t = bi >= 0 && best < 150 ? z.t[bi] + best / S.er.v : Infinity;
  }
  ER.halte.sort((a, b) => a.t - b.t);
  ER.st = 'fertig';
  erZeichnen();
  rr();
}

/** Band (Index in ER_BAND) zu einer Gehzeit, -1 = außerhalb. */
function erBand(t) {
  const B = erBaender();
  for (let i = 0; i < B.length; i++) if (t <= B[i]) return i;
  return -1;
}
/** Gehzeit an einer Stelle aus dem Raster (Infinity außerhalb). */
function erZeitAn(x, z) {
  const r = ER.raster;
  if (!r) return Infinity;
  const i = Math.floor((x + r.h) / r.zelle),
    j = Math.floor((z + r.h) / r.zelle);
  if (i < 0 || j < 0 || i >= r.W || j >= r.W) return Infinity;
  return r.t[j * r.W + i];
}

/** Bodenbild (Karten-Ebene „erg“), Haltestellen-Symbole, Gebäudefarben. */
function erZeichnen() {
  const r = ER.raster;
  if (r) {
    // Bodenbild in voller Auflösung des Geländebilds: Gehzeit zwischen den Rasterzellen bilinear interpolieren und
    // erst dann in Bänder teilen – die Bandgrenzen werden so glatte Linien statt Treppen
    const Wo = Math.min(2048, Math.max(r.W, Math.round(GEO.size / 0.6))),
      cv = document.createElement('canvas');
    cv.width = cv.height = Wo;
    const x = cv.getContext('2d'),
      img = x.createImageData(Wo, Wo),
      C = ER_BAND.map((c) => [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
      ]),
      aus = S.er.tMax + 3, // nicht erreicht: knapp jenseits des letzten Bands (glatter Rand)
      T0 = (i, j) => {
        const v = r.t[Math.min(r.W - 1, Math.max(0, j)) * r.W + Math.min(r.W - 1, Math.max(0, i))];
        return v <= S.er.tMax ? v : aus;
      },
      k = r.W / Wo;
    for (let py = 0; py < Wo; py++) {
      const v = (py + 0.5) * k - 0.5,
        j = Math.floor(v),
        fy = v - j;
      for (let px = 0; px < Wo; px++) {
        const u = (px + 0.5) * k - 0.5,
          i = Math.floor(u),
          fx = u - i,
          t =
            (T0(i, j) * (1 - fx) + T0(i + 1, j) * fx) * (1 - fy) +
            (T0(i, j + 1) * (1 - fx) + T0(i + 1, j + 1) * fx) * fy,
          b = erBand(t);
        if (b < 0) continue;
        const o = (py * Wo + px) * 4;
        img.data[o] = C[b][0];
        img.data[o + 1] = C[b][1];
        img.data[o + 2] = C[b][2];
        img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    const it = [{ t: 'img', cv }];
    it._v = Math.random();
    OVI.erg = it;
  } else OVI.erg = [];
  // Haltestellen
  while (ER_G.children.length) {
    const o = ER_G.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
  const h = GEO.size / 2,
    marker = (x, z, tex, k, farbe = SYM.farbe) => {
      const y0 = gh(x, z),
        y1 = y0 + 7,
        ln = new T.Line(
          new T.BufferGeometry().setFromPoints([new T.Vector3(x, y0, z), new T.Vector3(x, y1, z)]),
          new T.LineBasicMaterial({ color: farbe }),
        );
      ln.raycast = () => {};
      ER_G.add(ln);
      const sp = new T.Sprite(
        new T.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true }),
      );
      sp.position.set(x, y1, z);
      sp.center.set(0.5, 0.2);
      spriteFesteGroesse(sp, k);
      sp.renderOrder = 19;
      sp.raycast = () => {};
      ER_G.add(sp);
    };
  // Start: Ortssymbol (Context & Structure) in der Mitte des Grundstücks
  if (r) {
    const st = cen(erStart());
    marker(st[0], st[1], symbTextur('kon:ort'), 0.026, symbBib('kon:ort').g.farbe);
  }
  for (const s of ER.halte) {
    if (Math.abs(s.p[0]) > h || Math.abs(s.p[1]) > h) continue;
    marker(s.p[0], s.p[1], symTextur(ER_TYP[s.typ].g), 0.022);
  }
  try {
    if (S.geo) recomp();
  } catch (e) {
    logErr(e, 'erZeichnen');
  }
  RFC.sig = '';
  rfUp();
}
/** Gebäude nach Gehzeit einfärben (gleiche Mischung wie der Boden; aus rfUp(), vor den Landmarks). */
function erPaint() {
  const L = LY.find((l) => l[1] === 'erg');
  if (!L || !L[2] || !ER.raster) return;
  const m = GEO.mesh;
  if (!m || !m.geometry.attributes.position) return;
  if (!m.geometry.attributes.color) {
    m.geometry.setAttribute(
      'color',
      new T.BufferAttribute(new Float32Array(m.geometry.attributes.position.count * 3).fill(1), 3),
    );
    m.material.vertexColors = true;
    m.material.needsUpdate = true;
  }
  const a = m.geometry.attributes.color.array,
    b0 = m.material.color,
    G0 = new T.Color(S.lc.terrain || '#f6f5f1'),
    al = ovFuellAlpha('erg'),
    F = ER_BAND.map((c) => {
      const C = new T.Color(c);
      return [
        Math.min(3, (G0.r * (1 - al) + C.r * al) / Math.max(b0.r, 0.05)),
        Math.min(3, (G0.g * (1 - al) + C.g * al) / Math.max(b0.g, 0.05)),
        Math.min(3, (G0.b * (1 - al) + C.b * al) / Math.max(b0.b, 0.05)),
      ];
    });
  for (const r of GEO.ranges || []) {
    const o = r.b && r.b.o;
    if (!o) continue;
    let t = Infinity;
    for (const p of o) t = Math.min(t, erZeitAn(p[0], p[1])); // Zugang von der nächstgelegenen Seite
    const b = erBand(t);
    if (b < 0) continue;
    for (let v = r.s * 3; v < r.e * 3; v++) {
      a[v * 3] = F[b][0];
      a[v * 3 + 1] = F[b][1];
      a[v * 3 + 2] = F[b][2];
    }
  }
  m.geometry.attributes.color.needsUpdate = true;
}
let erNeuT = 0;
/** Nach Änderungen im Ebenen-Menü neu zeichnen (verzögert). */
function erNeu() {
  clearTimeout(erNeuT);
  erNeuT = setTimeout(() => {
    if (ER.raster || ER.halte.length) erZeichnen();
  }, 120);
}
/** Erreichbarkeit und Haltestellen zusammen ein-/ausblenden; ohne Argument: sichtbar? */
function erSichtbar(an) {
  const ix = ['erg', 'erh'].map((k) => LY.findIndex((l) => l[1] === k)).filter((i) => i >= 0);
  if (an === undefined) return ix.some((i) => LY[i][2]);
  ix.forEach((i) => lvis(i, an ? 1 : 0));
  erNeu();
  return an;
}
function erSetzeT(v) {
  S.er.tMax = v;
  if (ER.wege) erRechnen();
  else rr();
}

/** Inhalt des Reiters „Erreichbarkeit“. */
function erPanel() {
  const gs = axSites(),
    grund = gs && !gs.project;
  let h = `<div class="card"><b>Erreichbarkeit zu Fuß</b><div class="dmu" style="margin:4px 0 8px">Wie weit kommt man vom Grundstück aus in 5, 10, 15 Minuten zu Fuß (4,8 km/h, über das Wegenetz aus OpenStreetMap)? Boden und Gebäude in hellen Blautönen, Haltestellen als Symbole.</div>`;
  h += `<div class="kv"><span>Start</span><b>${grund ? esc(gs.label) : 'Projektmitte'}</b></div>`;
  if (!grund)
    h += `<div class="dmu" style="color:#b56a00">Kein Grundstück gewählt – Flurstück anklicken, dann berechnen.</div>`;
  else if (ER.raster && ER.startSig && ER.startSig !== erStartSig())
    h += `<div class="dmu" style="color:#b56a00">Grundstück geändert – neu berechnen.</div>`;
  h += `<div style="display:flex;gap:6px;margin:6px 0;align-items:center"><span style="font-size:12px">Gehzeit bis</span><select onchange="erSetzeT(+this.value)">${[10, 15, 20].map((v) => `<option value="${v}" ${v === S.er.tMax ? 'selected' : ''}>${v} min</option>`).join('')}</select></div>`;
  h += `<button class="pri" style="width:100%" ${ER.st === 'laedt' ? 'disabled' : ''} onclick="erLaden()">${ER.st === 'laedt' ? 'Lädt …' : ER.raster ? 'Neu berechnen' : 'Erreichbarkeit berechnen'}</button>`;
  if (ER.st === 'fehler') h += `<div class="dmu" style="color:#b00;margin-top:6px">${esc(ER.fehler)}</div>`;
  if (ER.zugang != null && isFinite(ER.zugang))
    h += `<div class="dmu" style="margin-top:6px">Nächster Weg ${Math.round(ER.zugang)} m vom Grundstück.</div>`;
  h += '</div>';
  if (!ER.raster) return h;
  // Gebäude je Band
  const B = erBaender(),
    n = B.map(() => 0);
  for (const r of GEO.ranges || []) {
    const o = r.b && r.b.o;
    if (!o) continue;
    let t = Infinity;
    for (const p of o) t = Math.min(t, erZeitAn(p[0], p[1]));
    const b = erBand(t);
    if (b >= 0) n[b]++;
  }
  h += `<div class="card"><b>Gehzeiten</b>${B.map((t, i) => `<div class="kv"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${ER_BAND[i]};vertical-align:-2px;margin-right:6px"></i>bis ${t} min</span><b>${n[i]} Gebäude</b></div>`).join('')}</div>`;
  const nah = ER.halte.filter((s) => s.t <= S.er.tMax);
  h += `<div class="card"><b>ÖPNV in ${S.er.tMax} Minuten</b>`;
  h += nah.length
    ? nah
        .slice(0, 14)
        .map(
          (s) =>
            `<div class="kv"><span style="display:flex;gap:6px;align-items:center">${symSvg(ER_TYP[s.typ].g, 18)}${esc(s.name)}</span><b>${Math.max(1, Math.round(s.t))} min</b></div>`,
        )
        .join('')
    : '<div class="dmu">Keine Haltestelle in Gehweite.</div>';
  if (ER.flug.length)
    h += `<div style="margin-top:8px;font-size:12px"><b>Flughäfen</b></div>${ER.flug.map((f) => `<div class="kv"><span style="display:flex;gap:6px;align-items:center">${symSvg('flug', 18)}${esc(f.name)}${f.iata ? ' (' + esc(f.iata) + ')' : ''}</span><b style="white-space:nowrap;margin-left:8px">${Math.round(f.km)} km Luftlinie</b></div>`).join('')}`;
  h += `<div class="dmu" style="margin-top:6px">Farben und Sichtbarkeit im Ebenen-Menü („Erreichbarkeit zu Fuß“, „ÖPNV-Haltestellen“). Daten © OpenStreetMap-Mitwirkende, ODbL.</div></div>`;
  return h;
}

/** Legendengruppen (eingetragen in LGD, 17-…/110-kleine-dynamische-legende-unten-links.js). */
function erLegendeZeit() {
  if (!ER.raster || !ovVis('erg')) return null;
  const gs = axSites();
  return {
    t: 'Erreichbarkeit zu Fuß',
    r: [
      [
        SYM.farbe,
        'Start (' + (gs && !gs.project ? 'Grundstück' : 'Projektmitte') + ')',
        'svg',
        symbSvg('kon:ort', 16),
      ],
    ].concat(erBaender().map((t, i) => [ER_BAND[i], 'bis ' + t + ' min'])),
  };
}
function erLegendeOepnv() {
  const L = LY.find((l) => l[1] === 'erh'),
    h = GEO.size / 2;
  if (!L || !L[2] || !ER.halte.length) return null;
  const da = new Set(
    ER.halte.filter((s) => Math.abs(s.p[0]) <= h && Math.abs(s.p[1]) <= h).map((s) => s.typ),
  );
  const r = Object.keys(ER_TYP)
    .filter((k) => da.has(k))
    .map((k) => [SYM.farbe, ER_TYP[k].n, 'svg', symSvg(ER_TYP[k].g, 16)]);
  return r.length ? { t: 'ÖPNV', r } : null;
}
