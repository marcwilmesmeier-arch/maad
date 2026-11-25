// ======================= SITE & CONTEXT: LANDMARKS UND PLÄTZE =======================
// Wichtige Orte der Umgebung aus OpenStreetMap (Overpass): Sehenswürdigkeiten, Kirchen, Rathaus, Museen, Denkmäler,
// Türme sowie Plätze und Fußgängerflächen im Projektausschnitt. Landmarks werden nach Bedeutung gewichtet
// (Wikidata/Wikipedia-Verweis, Denkmalschutz, Art) und nummeriert; die zugehörigen Umgebungsgebäude werden in der
// Akzentfarbe eingefärbt, darüber ein Nummernmarker an einer Führungslinie (Ebene „Landmarks“). Plätze liegen als
// Fläche im Geländebild (Ebene „Plätze“). Liste in der dynamischen Legende, Kennzahlen im Reiter „Site & Context“.

const SC = { st: 'aus', fehler: '', lm: [], pl: [], key: '' };
S.sc = { anzahl: 9, aus: {} }; // aus: abgewählte Landmarks (id -> true)
S.lc.scl = '#d9774b';
S.lc.scp = '#e8a17c';
LY.push(['Landmarks (Site & Context)', 'scl', 1, 1], ['Plätze (Site & Context)', 'scp', 1, 1]);
const SC_G = new T.Group();
SC_G.name = 'landmarks';
sc.add(SC_G);
G.scl = SC_G;
// Plätze als eigene Fläche knapp über Gelände, Straßen- und Wegeflächen (im Kartenbild lagen sie darunter verdeckt)
const SCP_G = new T.Group();
SCP_G.name = 'plaetze';
sc.add(SCP_G);
G.scp = SCP_G;

/** Gewicht eines OSM-Objekts als Landmark (0 = kein Landmark). */
function scGewicht(t) {
  let g = 0;
  if (t.wikidata) g += 3;
  if (t.wikipedia) g += 2;
  if (t.heritage || t['heritage:operator'] || t['denkmal']) g += 2;
  if (/attraction|museum|gallery|viewpoint/.test(t.tourism || '')) g += 2;
  if (/place_of_worship|townhall|theatre|courthouse|library|arts_centre|university/.test(t.amenity || ''))
    g += 2;
  if (
    /cathedral|church|chapel|mosque|synagogue|temple|castle|palace|train_station|government|civic/.test(
      t.building || '',
    )
  )
    g += 2;
  if (t.historic) g += 1;
  if (/tower|lighthouse|obelisk/.test(t.man_made || '')) g += 1;
  if (t.tourism === 'artwork' && !t.wikidata) g -= 1; // kleine Kunstwerke nur mit Verweis
  return g;
}
/** Baujahr bzw. Zeitraum lesbar machen („1296..1436“ -> „1296–1436“, „C14“ -> „14. Jh.“). */
function scJahr(t) {
  const v = String(t.start_date || t.construction_date || t['year_of_construction'] || '').trim();
  if (!v) return '';
  const jh = /^C(\d{1,2})$/i.exec(v);
  if (jh) return jh[1] + '. Jh.';
  const z = /^(\d{3,4})\D*\.\.\D*(\d{3,4})/.exec(v);
  if (z) return z[1] + '–' + z[2];
  const j = /(\d{3,4})/.exec(v);
  return j ? j[1] : '';
}

/** OSM-Geometrie in lokale Ringe [[x,z],…] bzw. Punkt umrechnen. */
function scGeom(e, lon0, lat0) {
  const p = (la, lo) => [(lo - lon0) * GEO.kx, -(la - lat0) * 110574];
  if (e.type === 'node') return { pt: p(e.lat, e.lon), r: [] };
  const r = [];
  if (e.type === 'way' && e.geometry) r.push(e.geometry.map((g) => p(g.lat, g.lon)));
  if (e.type === 'relation' && e.members)
    for (const m of e.members)
      if (m.geometry && m.role !== 'inner') r.push(m.geometry.map((g) => p(g.lat, g.lon)));
  const ring = r.filter((x) => x.length > 2);
  if (!ring.length) return null;
  return { pt: cen(ring[0]), r: ring };
}
function scFlaeche(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/**
 * Overpass-Abfrage mit gestaffelten Servern: antwortet der erste nicht binnen 8 s, wird zusätzlich der nächste
 * gefragt (nach 16 s der dritte); die erste gültige Antwort gilt, die übrigen werden abgebrochen.
 */
async function overpassAbruf(q, ort) {
  const EP = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ],
    acs = EP.map(() => new AbortController()),
    fehler = [];
  let fertig = false;
  const eins = async (i) => {
    const to = setTimeout(() => acs[i].abort(), 60000);
    try {
      const r = await fetch(EP[i] + '?data=' + encodeURIComponent(q), { signal: acs[i].signal });
      if (!r.ok)
        throw new Error(
          'HTTP ' +
            r.status +
            (r.status === 429 ? ' (überlastet)' : r.status === 504 ? ' (Zeitüberschreitung)' : ''),
        );
      const j = await r.json();
      if (j.remark && /runtime error/i.test(j.remark) && !(j.elements || []).length)
        throw new Error(j.remark);
      return j;
    } catch (e) {
      if (!fertig) {
        fehler.push(e.name === 'AbortError' ? 'keine Antwort nach 60 s' : e.message);
        logErr(e, ort);
      }
      throw e;
    } finally {
      clearTimeout(to);
    }
  };
  return new Promise((ok, nein) => {
    let naechster = 0,
      offen = 0;
    const uhren = [],
      ende = () => uhren.forEach(clearTimeout),
      start = () => {
        if (fertig || naechster >= EP.length) return;
        const i = naechster++;
        offen++;
        if (naechster < EP.length) uhren.push(setTimeout(start, 8000)); // keine Antwort binnen 8 s: nächster dazu
        eins(i).then(
          (j) => {
            if (fertig) return;
            fertig = true;
            ende();
            acs.forEach((a, k) => k !== i && a.abort());
            ok(j);
          },
          () => {
            offen--;
            if (fertig) return;
            if (naechster < EP.length)
              start(); // gescheitert: sofort den nächsten
            else if (!offen) {
              ende();
              nein(
                new Error(
                  'OpenStreetMap (Overpass) nicht erreichbar: ' +
                    (fehler[fehler.length - 1] || 'keine Antwort') +
                    '. Die Server sind zeitweise überlastet – bitte in einer Minute erneut versuchen.',
                ),
              );
            }
          },
        );
      };
    start();
  });
}

/** Landmarks und Plätze im Projektausschnitt laden (Overpass, im Browser); gespeichertes Ergebnis zuerst. */
async function scLaden(neu) {
  const sk = 'maad.sc.v1.' + ovKey();
  if (!neu && S.geo) {
    try {
      const t = localStorage.getItem(sk);
      if (t) {
        const d = JSON.parse(t);
        SC.lm = d.lm || [];
        SC.pl = d.pl || [];
        SC.key = ovKey();
        SC.st = 'fertig';
        scZeichnen();
        rr();
        return;
      }
    } catch (e) {
      logErr(e, 'scLaden');
    }
  }
  if (!S.geo) {
    SC.st = 'fehler';
    SC.fehler = 'Nur mit geladenem Projektstandort (nicht in der Demo).';
    rr();
    return;
  }
  SC.st = 'laedt';
  SC.fehler = '';
  rr();
  const h = GEO.size / 2,
    dx = h / GEO.kx,
    dy = h / 110574,
    lon0 = GEO.lon,
    lat0 = GEO.lat,
    bb = [lat0 - dy, lon0 - dx, lat0 + dy, lon0 + dx].map((v) => v.toFixed(6)).join(','),
    q =
      `[out:json][timeout:40];(` +
      `nwr["name"]["tourism"~"attraction|museum|gallery|viewpoint|artwork"](${bb});` +
      `nwr["name"]["historic"](${bb});` +
      `nwr["name"]["amenity"~"place_of_worship|townhall|theatre|courthouse|library|arts_centre|university"](${bb});` +
      `nwr["name"]["building"~"cathedral|church|chapel|mosque|synagogue|temple|castle|palace|train_station"](${bb});` +
      `nwr["name"]["man_made"~"tower|lighthouse|obelisk"](${bb});` +
      `nwr["name"]["heritage"](${bb});` +
      `nwr["name"]["place"="square"](${bb});` +
      `way["name"]["highway"="pedestrian"]["area"="yes"](${bb});` +
      `);out tags geom;`;
  let j = null;
  try {
    j = await overpassAbruf(q, 'scLaden');
  } catch (e) {
    SC.st = 'fehler';
    SC.fehler = e.message;
    rr();
    return;
  }
  scAuswerten(j.elements || [], lon0, lat0);
  SC.key = ovKey();
  try {
    const t = JSON.stringify({ lm: SC.lm, pl: SC.pl }),
      idx = JSON.parse(localStorage.getItem('maad.sc.v1.liste') || '[]').filter((x) => x !== sk);
    if (t.length < 1.5e6) {
      idx.push(sk);
      while (idx.length > 8) localStorage.removeItem(idx.shift()); // höchstens 8 Standorte
      localStorage.setItem(sk, t);
      localStorage.setItem('maad.sc.v1.liste', JSON.stringify(idx));
    }
  } catch (e) {
    logErr(e, 'scLaden');
  }
  SC.st = 'fertig';
  scZeichnen();
  rr();
}

/** Overpass-Antwort in Landmarks (gewichtet, ohne Doppelte) und Plätze aufteilen. */
function scAuswerten(els, lon0, lat0) {
  const h = GEO.size / 2,
    innen = (p) => Math.abs(p[0]) <= h && Math.abs(p[1]) <= h,
    lm = new Map(),
    pl = new Map();
  for (const e of els) {
    const t = e.tags || {};
    if (!t.name) continue;
    const g = scGeom(e, lon0, lat0);
    if (!g || !innen(g.pt)) continue;
    if (t.place === 'square' || (t.highway === 'pedestrian' && t.area === 'yes')) {
      if (!g.r.length) continue; // Platz nur als Fläche
      const a = g.r.reduce((s, r) => s + scFlaeche(r), 0),
        alt = pl.get(t.name);
      if (!alt || alt.a < a) pl.set(t.name, { id: e.type[0] + e.id, name: t.name, r: g.r, a });
      continue;
    }
    const w = scGewicht(t);
    if (w < 2) continue;
    const a = g.r.length ? scFlaeche(g.r[0]) : 0;
    if (a > 60000) continue; // ganze Areale (Parks, Friedhöfe) sind kein Landmark-Gebäude
    const alt = lm.get(t.name),
      x = {
        id: e.type[0] + e.id,
        name: t.name,
        w: w + Math.min(2, a / 2000),
        jahr: scJahr(t),
        pt: g.pt,
        r: g.r,
      };
    if (!alt || alt.w < x.w || (alt.w === x.w && !alt.r.length && x.r.length))
      lm.set(t.name, Object.assign(x, { jahr: x.jahr || (alt && alt.jahr) || '' }));
  }
  SC.lm = [...lm.values()].sort((a, b) => b.w - a.w);
  SC.pl = [...pl.values()].sort((a, b) => b.a - a.a);
}

/** Die angezeigten Landmarks (nach Gewicht, ohne abgewählte, höchstens S.sc.anzahl). */
function scAuswahl() {
  return SC.lm.filter((l) => !S.sc.aus[l.id]).slice(0, S.sc.anzahl);
}
/**
 * Umgebungsgebäude (Index in GEO.ranges) eines Landmarks. Fläche: das Gebäude gehört dazu, wenn sein Mittelpunkt in
 * der Fläche liegt, mindestens ein Drittel seiner Ecken darin liegen oder der Mittelpunkt der Fläche im Gebäude liegt
 * (OSM- und Gebäudeumriss weichen oft etwas ab; verwinkelte Gebäude, Gebäudeteile). Punkt: das Gebäude, in dem er
 * liegt, sonst das nächste im Umkreis von 8 m.
 */
function scGebaeude(l) {
  const R = GEO.ranges || [],
    out = [];
  if (l.r.length) {
    const lc = cen(l.r[0]);
    R.forEach((r, i) => {
      const o = r.b && r.b.o;
      if (!o || o.length < 3) return;
      const c = cen(o),
        drin = o.filter((q) => bclIn(l.r, q[0], q[1])).length;
      if (bclIn(l.r, c[0], c[1]) || drin >= o.length / 3 || bclIn([o], lc[0], lc[1])) out.push(i);
    });
    return out;
  }
  let best = -1,
    bd = 8;
  R.forEach((r, i) => {
    const o = r.b && r.b.o;
    if (!o || o.length < 3) return;
    if (bclIn([o], l.pt[0], l.pt[1])) {
      out.push(i);
      return;
    }
    for (let k = 0; k < o.length; k++) {
      const a = o[k],
        b = o[(k + 1) % o.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((l.pt[0] - a[0]) * dx + (l.pt[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
        ),
        d = Math.hypot(l.pt[0] - a[0] - t * dx, l.pt[1] - a[1] - t * dz);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  });
  if (!out.length && best >= 0) out.push(best);
  return out;
}
/**
 * Plätze als Fläche bauen: Umriss in Dreiecke zerlegen (ShapeUtils), auf höchstens 3 m Kantenlänge teilen und 8 cm über
 * das Gelände legen – über Straßen- (−15 cm) und Wegeflächen (−5 cm); am Rand des Ausschnitts gekappt.
 */
function scPlaetzeBauen() {
  while (SCP_G.children.length) {
    const o = SCP_G.children.pop();
    o.geometry.dispose();
  }
  if (!SC.pl.length || !S.geo) return;
  const pos = [],
    y = (x, z) => gh(x, z) + 0.08,
    teile = (a, b, c) => {
      const L = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]),
        m = Math.max(L(a, b), L(b, c), L(c, a));
      if (m <= 3) {
        for (const p of [a, b, c]) pos.push(p[0], y(p[0], p[1]), p[1]);
        return;
      }
      const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2],
        ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
      teile(a, ab, ca);
      teile(ab, b, bc);
      teile(ca, bc, c);
      teile(ab, bc, ca);
    };
  SC.pl.forEach((p) =>
    (p.r || []).forEach((ring) => {
      const r =
        ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring;
      if (r.length < 3) return;
      const v = r.map((q) => new T.Vector2(q[0], q[1]));
      // Dreiecke nach oben orientiert (Normale +y)
      const ccw = T.ShapeUtils.isClockWise(v);
      T.ShapeUtils.triangulateShape(v, []).forEach(([i, j, k]) =>
        ccw ? teile(r[i], r[j], r[k]) : teile(r[i], r[k], r[j]),
      );
    }),
  );
  if (!pos.length) return;
  const K = typeof strKappen === 'function' ? strKappen(pos, GEO.size / 2).pos : pos,
    ge = new T.BufferGeometry();
  ge.setAttribute('position', new T.BufferAttribute(new Float32Array(K), 3));
  ge.computeVertexNormals();
  const m = new T.Mesh(
    ge,
    new T.MeshLambertMaterial({
      color: new T.Color(S.lc.scp || '#e8a17c'),
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  m.receiveShadow = true;
  m.raycast = () => {};
  SCP_G.add(m);
}
/** Marker und Führungslinien neu aufbauen; Gebäudefarben und Platzflächen auffrischen. */
function scZeichnen() {
  while (SC_G.children.length) {
    const o = SC_G.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
  const pos = GEO.mesh && GEO.mesh.geometry.attributes.position,
    R = GEO.ranges || [];
  SC.mesh = GEO.mesh && GEO.mesh.uuid; // Gebäudezuordnung gilt für dieses Umgebungsmodell
  scAuswahl().forEach((l, n) => {
    const ix = scGebaeude(l);
    l.geb = ix;
    // Oberkante: höchster Punkt der zugehörigen Gebäude (sonst Gelände + 3 m)
    let top = -Infinity,
      sx = 0,
      sz = 0,
      k = 0;
    if (pos)
      for (const i of ix) {
        const r = R[i];
        for (let v = r.s * 3; v < r.e * 3; v++) {
          const y = pos.getY(v);
          if (y > top) {
            top = y;
            sx = pos.getX(v);
            sz = pos.getZ(v);
          }
          k++;
        }
      }
    const [x, z] = k ? [sx, sz] : l.pt,
      y0 = k ? top : gh(x, z) + 3,
      y1 = y0 + 14;
    const ln = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(x, y0, z), new T.Vector3(x, y1, z)]),
      new T.LineBasicMaterial({ color: 0x1f2a33 }),
    );
    ln.raycast = () => {};
    SC_G.add(ln);
    const sp = new T.Sprite(
      new T.SpriteMaterial({
        map: scNummer(n + 1),
        depthTest: false,
        sizeAttenuation: false,
        transparent: true,
      }),
    );
    sp.position.set(x, y1, z);
    sp.scale.set(0.034, 0.034, 1);
    sp.center.set(0.5, 0.15);
    spriteFesteGroesse(sp, 0.0227); // ein Drittel kleiner als früher (0,034)
    sp.renderOrder = 20;
    sp.raycast = () => {};
    SC_G.add(sp);
  });
  // Plätze als eigene Fläche über Straßen und Wegen (nicht mehr im Geländebild, dort waren sie verdeckt)
  OVL.scp.col = S.lc.scp;
  OVI.scp = [];
  try {
    scPlaetzeBauen();
  } catch (e) {
    logErr(e, 'scPlaetzeBauen');
  }
  try {
    if (S.geo) recomp();
  } catch (e) {
    logErr(e, 'scZeichnen');
  }
  RFC.sig = '';
  rfUp();
}
/**
 * Sprite mit fester Bildschirmgröße (Anteil k): wirkt in three.js nur mit der Perspektivkamera; in 2D
 * (Parallelprojektion) wird die Größe aus dem sichtbaren Ausschnitt bestimmt, damit sie gleich groß erscheint.
 */
function spriteFesteGroesse(sp, k) {
  sp.scale.set(k, k, 1);
  sp.onBeforeRender = (r, s, cam) => {
    if (cam.isOrthographicCamera) {
      const w = k * (pc.projectionMatrix.elements[5] || 2.4) * 0.5 * ((cam.top - cam.bottom) / cam.zoom);
      sp.scale.set(w, w, 1);
    } else sp.scale.set(k, k, 1);
  };
}
/** Nummernmarker: dunkler Kreis mit weißer Zahl (Canvas-Textur). */
function scNummer(n) {
  const c = document.createElement('canvas'),
    N = 128;
  c.width = c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = '#1f2a33';
  x.beginPath();
  x.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = 6;
  x.strokeStyle = '#ffffff';
  x.stroke();
  x.fillStyle = '#ffffff';
  x.font = '700 64px system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(String(n), N / 2, N / 2 + 3);
  const t = new T.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
/** Landmark-Gebäude in der Akzentfarbe einfärben (nach Dach- und CORINE-Farben, aus rfUp()). */
function scPaint() {
  const L = LY.find((l) => l[1] === 'scl');
  if (!L || !L[2] || !SC.lm.length) return;
  const m = GEO.mesh;
  if (!m || !m.geometry.attributes.position) return;
  if (!m.geometry.attributes.color) {
    // ohne Dach-/CORINE-Farben gibt es noch keine Vertexfarben: weiß anlegen (Faktor 1 = Materialfarbe)
    m.geometry.setAttribute(
      'color',
      new T.BufferAttribute(new Float32Array(m.geometry.attributes.position.count * 3).fill(1), 3),
    );
    m.material.vertexColors = true;
    m.material.needsUpdate = true;
  }
  if (SC.mesh !== m.uuid) {
    // Umgebung neu aufgebaut: Zuordnung und Marker neu bestimmen (färbt danach erneut)
    scNeu();
    return;
  }
  const a = m.geometry.attributes.color.array,
    b0 = m.material.color,
    C = new T.Color(S.lc.scl || '#d9774b'),
    q = [C.r / Math.max(b0.r, 0.05), C.g / Math.max(b0.g, 0.05), C.b / Math.max(b0.b, 0.05)],
    R = GEO.ranges || [];
  for (const l of scAuswahl())
    for (const i of l.geb || []) {
      const r = R[i];
      for (let v = r.s * 3; v < r.e * 3; v++) {
        a[v * 3] = q[0];
        a[v * 3 + 1] = q[1];
        a[v * 3 + 2] = q[2];
      }
    }
  m.geometry.attributes.color.needsUpdate = true;
}
/** Nach Änderungen im Ebenen-Menü oder an der Auswahl neu zeichnen (verzögert). */
let scNeuT = 0;
function scNeu() {
  clearTimeout(scNeuT);
  scNeuT = setTimeout(() => {
    if (SC.lm.length || SC.pl.length) scZeichnen();
  }, 120);
}
function scWahl(id, an) {
  if (an) delete S.sc.aus[id];
  else S.sc.aus[id] = true;
  scNeu();
  rr();
}
function scAnzahl(v) {
  S.sc.anzahl = v;
  scNeu();
  rr();
}

/** Kennzahlen: Gebäude im Ausschnitt, höchstes Gebäude, Fläche der Plätze. */
function scKennzahlen() {
  // Gebäudehöhe aus den Daten (LoD2/Gebäude Deutschland), nicht aus der Geometrie: am Hang zählte sonst das Gelände mit
  const R = GEO.ranges || [];
  let hMax = 0,
    hName = '';
  R.forEach((r, i) => {
    const hb = r.b && +r.b.h;
    if (hb > hMax && hb < 400) {
      hMax = hb;
      const l = scAuswahl().find((x) => (x.geb || []).includes(i));
      hName = l ? l.name : '';
    }
  });
  return { n: R.length, hMax, hName, flaeche: SC.pl.reduce((s, p) => s + p.a, 0) };
}

/** Inhalt des Reiters „Site & Context“. */
function scPanel() {
  let h = `<div class="card"><b>Site &amp; Context</b><div class="dmu" style="margin:4px 0 8px">Landmarks, Plätze und wichtige Gebäude im Projektausschnitt aus OpenStreetMap. Landmarks werden im Modell eingefärbt und nummeriert, die Liste steht in der Legende.</div>`;
  h += `<button class="pri" style="width:100%" ${SC.st === 'laedt' ? 'disabled' : ''} onclick="scLaden(${SC.lm.length || SC.pl.length ? 'true' : ''})">${SC.st === 'laedt' ? 'Lädt …' : SC.lm.length ? 'Neu laden' : 'Landmarks laden'}</button>`;
  if (SC.st === 'fehler') h += `<div class="dmu" style="color:#b00;margin-top:6px">${esc(SC.fehler)}</div>`;
  if (SC.lm.length && SC.key && SC.key !== ovKey())
    h += `<div class="dmu" style="color:#b56a00;margin-top:6px">Ausschnitt geändert – neu laden.</div>`;
  h += '</div>';
  if (!SC.lm.length && !SC.pl.length) return h;
  const k = scKennzahlen(),
    sel = scAuswahl();
  h += `<div class="card"><b>Kennzahlen</b>`;
  h += `<div class="kv"><span>Gebäude im Ausschnitt</span><b>${k.n.toLocaleString('de-DE')}</b></div>`;
  if (k.hMax)
    h += `<div class="kv"><span>Höchstes Gebäude${k.hName ? ' (' + esc(k.hName) + ')' : ''}</span><b>${f1(k.hMax)} m</b></div>`;
  if (SC.pl.length)
    h += `<div class="kv"><span>Plätze (${SC.pl.length})</span><b>${Math.round(k.flaeche).toLocaleString('de-DE')} m²</b></div>`;
  h += '</div>';
  h += `<div class="card"><b>Landmarks</b><label style="display:block;font-size:12px;margin:6px 0">Anzahl <b id="scA">${S.sc.anzahl}</b><input type="range" min="1" max="15" step="1" value="${S.sc.anzahl}" style="width:100%" oninput="$('scA').textContent=this.value" onchange="scAnzahl(+this.value)"></label>`;
  h += SC.lm
    .slice(0, 25)
    .map((l) => {
      const nr = sel.indexOf(l);
      return `<label class="ck" style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${S.sc.aus[l.id] ? '' : 'checked'} onchange="scWahl('${l.id}',this.checked)"><span style="flex:1">${nr >= 0 ? '<b>' + (nr + 1) + '</b> ' : ''}${esc(l.name)}${l.jahr ? ' <span class="dmu">' + esc(l.jahr) + '</span>' : ''}</span></label>`;
    })
    .join('');
  h += `<div class="dmu" style="margin-top:6px">Farben und Sichtbarkeit im Ebenen-Menü („Landmarks“, „Plätze“). Daten © OpenStreetMap-Mitwirkende, ODbL.</div></div>`;
  if (SC.pl.length)
    h += `<div class="card"><b>Plätze</b>${SC.pl
      .map(
        (p) =>
          `<div class="kv"><span>${esc(p.name)}</span><b>${Math.round(p.a).toLocaleString('de-DE')} m²</b></div>`,
      )
      .join('')}</div>`;
  return h;
}

/** Legendengruppe „Landmarks“ (nummeriert) – eingetragen in LGD (17-…/110-kleine-dynamische-legende-unten-links.js). */
function scLegendeLm() {
  const L = LY.find((l) => l[1] === 'scl');
  if (!L || !L[2] || !SC.lm.length) return null;
  return {
    t: 'Landmarks',
    r: scAuswahl().map((l, i) => [
      '#1f2a33',
      l.name + (l.jahr ? ' · ' + l.jahr : ''),
      'nr',
      String(i + 1),
      `scFlug('lm','${l.id}')`,
    ]),
  };
}
/** Legendengruppe „Plätze“. */
function scLegendePl() {
  if (!ovVis('scp') || !SC.pl.length) return null;
  return {
    t: 'Plätze',
    r: SC.pl.slice(0, 8).map((p) => [S.lc.scp, p.name, '', '', `scFlug('pl','${p.id}')`]),
  };
}

/**
 * Kamerafahrt zu einem Landmark ('lm') oder Platz ('pl'): hinfliegen (Abstand nach Größe und Höhe), dann einmal mit
 * Blick auf das Objekt herum. Jede Maus-/Radeingabe bricht ab. Läuft in 3D (wechselt bei Bedarf).
 */
const SCF = { an: false, az0: 0, t0: 0, dur: 16000, raf: 0 };
function scFlug(art, id) {
  const o = (art === 'lm' ? SC.lm : SC.pl).find((x) => x.id === id);
  if (!o) return;
  const ring = o.r && o.r.length ? o.r[0] : null,
    c = ring ? cen(ring) : o.pt;
  let ext = 20,
    h = 0;
  if (ring) {
    const xs = ring.map((p) => p[0]),
      zs = ring.map((p) => p[1]);
    ext = Math.max(10, Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)));
  }
  if (art === 'lm')
    scGebaeude(o).forEach((i) => {
      const b = GEO.ranges[i] && GEO.ranges[i].b;
      if (b && b.h > h) h = b.h;
    });
  if (!S.m3) setMode(1);
  const d = Math.max(70, Math.min(700, ext * 1.5 + h * 2.2)),
    az = V.az;
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: { tx: c[0], tz: c[1], d, az, pol: 1.0, rot: V.rot },
    t0: performance.now(),
    dur: Math.min(2400, Math.max(900, 600 + Math.hypot(c[0] - V.tx, c[1] - V.tz) * 1.2)),
  };
  SCF.an = true;
  SCF.az0 = az;
  SCF.t0 = 0;
  cancelAnimationFrame(SCF.raf);
  SCF.raf = requestAnimationFrame(scFlugTakt);
}
function scFlugTakt(now) {
  if (!SCF.an) return;
  if (S.vanim) {
    SCF.raf = requestAnimationFrame(scFlugTakt);
    return;
  }
  if (!SCF.t0) SCF.t0 = now;
  const t = Math.min(1, (now - SCF.t0) / SCF.dur),
    e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  V.az = SCF.az0 + e * Math.PI * 2;
  if (t >= 1) {
    SCF.an = false;
    return;
  }
  SCF.raf = requestAnimationFrame(scFlugTakt);
}
/** Kamerafahrt abbrechen (Nutzereingabe). */
function scFlugStopp(e) {
  if (!SCF.an || (e && e.target && e.target.closest && e.target.closest('#lgd'))) return;
  SCF.an = false;
  cancelAnimationFrame(SCF.raf);
}

/** Gespeicherte Landmarks eines Projekts übernehmen (ohne erneuten Abruf). */
function scLadenAusProjekt(d) {
  SC.lm = (d && d.lm) || [];
  SC.pl = (d && d.pl) || [];
  SC.key = (d && d.key) || '';
  SC.st = SC.lm.length || SC.pl.length ? 'fertig' : 'aus';
  S.sc = Object.assign({ anzahl: 9, aus: {} }, (d && d.wahl) || {});
  OVI.scp = [];
  // Gebäude und Gelände sind beim Laden evtl. noch nicht da: zeichnen, sobald GEO.mesh steht
  setTimeout(function warte(n = 0) {
    if (!SC.lm.length && !SC.pl.length) return scZeichnen();
    if (GEO.mesh || n > 60) scZeichnen();
    else setTimeout(() => warte(n + 1), 1000);
  }, 0);
}

/** Landmarks und Plätze zusammen ein-/ausblenden (Ebenen „Landmarks“, „Plätze“); ohne Argument: sichtbar? */
function scSichtbar(an) {
  const ix = ['scl', 'scp'].map((k) => LY.findIndex((l) => l[1] === k)).filter((i) => i >= 0);
  if (an === undefined) return ix.some((i) => LY[i][2]);
  ix.forEach((i) => lvis(i, an ? 1 : 0));
  scNeu();
  return an;
}
