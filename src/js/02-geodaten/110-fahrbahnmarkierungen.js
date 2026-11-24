// ======================= FAHRBAHNMARKIERUNGEN =======================
// Einfache Striche auf den Straßenflächen nach dem OSM-Schema (wiki.openstreetmap.org/wiki/DE:Key:road_marking):
// indirekt über Attribute der Straßenlinie (lanes, lanes:forward/backward, lane_markings, oneway) und direkt als eigene
// Geometrie (road_marking=* als Linie, Überwege mit crossing:markings bzw. crossing=zebra). Die Kartendaten von
// MapTiler enthalten diese Angaben nicht; sie kommen einmal je Ausschnitt über Overpass (overpassAbruf) und werden mit
// dem Ausschnitt gesichert (GEO.snap.fbm). Gezeichnet werden nur einfache Striche (Linien, keine Flächen); Symbole
// (Pfeile, Piktogramme, Schriftzüge) nicht.

const FBM = {
  breite: 0.12, // Strichbreite nach OSM-Regel (m) – gezeichnet wird eine einfache Linie
  spur: 3.25, // Spurbreite ohne Angabe (m)
  laed: '', // Ausschnitt, für den gerade geladen wird
  mat: null,
};

/** Overpass-Abfrage für den Ausschnitt: Straßen mit Spurangaben, Überwege, road_marking. */
function fbmAbfrage() {
  const h = GEO.size / 2,
    s = GEO.lat - h / 110574,
    n = GEO.lat + h / 110574,
    w = GEO.lon - h / GEO.kx,
    o = GEO.lon + h / GEO.kx,
    bb = [s, w, n, o].map((v) => v.toFixed(6)).join(',');
  return (
    '[out:json][timeout:60];(' +
    'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"](' +
    bb +
    ');way["footway"="crossing"](' +
    bb +
    ');way["road_marking"](' +
    bb +
    ');node["highway"="crossing"](' +
    bb +
    '););out geom tags qt;'
  );
}
/** Overpass-Antwort auf das Nötige verkleinern: Wege { t, g: [[x, z]] }, Knoten { t, p: [x, z] } in maad-Koordinaten. */
function fbmDaten(j) {
  const xz = (la, lo) => [(lo - GEO.lon) * GEO.kx, (GEO.lat - la) * 110574],
    wege = [],
    knoten = [];
  (j.elements || []).forEach((e) => {
    const t = e.tags || {};
    if (e.type === 'way' && e.geometry && e.geometry.length > 1)
      wege.push({ t, g: e.geometry.map((p) => xz(p.lat, p.lon)) });
    else if (e.type === 'node' && e.lat != null) knoten.push({ t, p: xz(e.lat, e.lon) });
  });
  return { wege, knoten };
}
/** Nach dem Bau der Straßenflächen: Daten holen (einmal je Ausschnitt) und Markierungen bauen. */
async function fbmAktualisieren() {
  if (!S.geo || !GEO.size || !STR.E.roads.aktiv) return;
  const ort = [GEO.lon, GEO.lat, GEO.size].join(',');
  if (GEO.snap && GEO.snap.fbm && GEO.snap.fbm.ort === ort) return fbmBauen(GEO.snap.fbm);
  if (FBM.laed === ort) return;
  FBM.laed = ort;
  try {
    const j = await overpassAbruf(fbmAbfrage(), 'fbmAktualisieren');
    if (ort !== [GEO.lon, GEO.lat, GEO.size].join(',')) return;
    const D = Object.assign(fbmDaten(j), { ort });
    if (GEO.snap) GEO.snap.fbm = D;
    fbmBauen(D);
  } catch (e) {
    logErr(e, 'fbmAktualisieren');
    gst('Fahrbahnmarkierungen: OSM-Angaben nicht geladen (' + (e.message || e) + ').');
  } finally {
    if (FBM.laed === ort) FBM.laed = '';
  }
}
/** Liegt (x, z) auf der Straßenfläche (Maske der Straßen)? */
function fbmAufStrasse(x, z) {
  const M = STR.E.roads.uM.value && STR.E.roads.uM.value.image;
  if (!M || !M.data) return false;
  const n = M.width,
    G0 = GEO.size,
    i = Math.floor(((x + G0 / 2) / G0) * n),
    j = Math.floor(((z + G0 / 2) / G0) * n);
  return i >= 0 && j >= 0 && i < n && j < n && M.data[2 * (j * n + i)] > 128;
}
/** Höhe der Fahrbahn an (x, z): auf einer Brücke deren Deck, sonst Straßenfläche (15 cm unter dem Gelände); null = keine. */
function fbmHoehe(x, z, bruecke) {
  if (bruecke) {
    let best = null,
      bd = 1e9;
    ((STR.brD && STR.brD.K) || []).forEach((B) => {
      if (B.weg || B.k !== 'roads') return;
      B.P.forEach((q, j) => {
        const d = Math.hypot(q[0] - x, q[1] - z);
        if (d < B.h2 + 0.5 && d < bd) {
          bd = d;
          best = B.Z[j] - STR.E.roads.tief + (B.dz || 0);
        }
      });
    });
    return best;
  }
  return fbmAufStrasse(x, z) ? gh(x, z) - STR.E.roads.tief : null;
}
/** Zahl aus einem OSM-Wert („2“, „2;3“) oder null. */
function fbmZahl(v) {
  const n = parseInt(String(v == null ? '' : v).split(';')[0], 10);
  return isFinite(n) && n > 0 ? n : null;
}
/**
 * Striche eines Straßenwegs: [{ o (Versatz quer, m), str ('voll' | 'strich'), b (Breite) }]. Mittellinie zwischen den
 * Richtungen (ab 4 Spuren durchgezogen, sonst gestrichelt), Spurtrennung gestrichelt, Randlinien an Autobahn und
 * Schnellstraße. Ohne Spurangabe: Haupt- und Bundesstraßen 2 Spuren, sonst nur mit lane_markings=yes.
 */
function fbmStriche(t) {
  if (t.lane_markings === 'no' || t.area === 'yes') return [];
  const k = String(t.highway || '').replace('_link', ''),
    gross = /^(motorway|trunk|primary|secondary)$/.test(k),
    einb =
      t.oneway === 'yes' || t.oneway === '1' || t.oneway === '-1' || (k === 'motorway' && t.oneway !== 'no');
  let n = fbmZahl(t.lanes);
  if (!n) {
    if (!(gross || t.lane_markings === 'yes')) return [];
    n = einb ? 1 : 2;
  }
  if (n < 2 && !/^(motorway|trunk)$/.test(k)) return [];
  const sw = parseFloat(t['width:lanes']) || FBM.spur,
    W = parseFloat(t.width) > 2 ? parseFloat(t.width) : n * sw,
    lw = W / n,
    R = [];
  // Spuren je Richtung (rechts = vorwärts in Zeichenrichtung)
  let rueck = einb ? 0 : fbmZahl(t['lanes:backward']);
  if (!einb && rueck == null) {
    const vor = fbmZahl(t['lanes:forward']);
    rueck = vor != null ? n - vor : Math.floor(n / 2);
  }
  for (let i = 1; i < n; i++) {
    const o = -W / 2 + i * lw,
      mitte = !einb && i === rueck;
    R.push({ o, str: mitte && n >= 4 ? 'voll' : 'strich', b: FBM.breite, mitte });
  }
  if (/^(motorway|trunk)$/.test(k))
    [-1, 1].forEach((sg) => R.push({ o: sg * (W / 2 - 0.25), str: 'voll', b: 0.15 }));
  return R;
}
/** Linie l um o quer versetzen (rechts positiv in Zeichenrichtung – maad: x nach Osten, z nach Süden). */
function fbmVersatz(l, o) {
  return l.map((p, i) => {
    const a = l[Math.max(0, i - 1)],
      c = l[Math.min(l.length - 1, i + 1)],
      L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    return [p[0] - ((c[1] - a[1]) / L) * o, p[1] + ((c[0] - a[0]) / L) * o];
  });
}
/** Markierungen aus den OSM-Daten D bauen (ein Mesh in der Straßenebene; strWeg entfernt es mit den Flächen). */
function fbmBauen(D) {
  const g = G[STR.E.roads.grp];
  g.children
    .filter((o) => o.userData.fbm)
    .forEach((o) => {
      g.remove(o);
      o.geometry.dispose();
    });
  if (!D || !STR.E.roads.aktiv) return;
  const pos = [],
    h = GEO.size / 2,
    drin = (p) => Math.abs(p[0]) < h && Math.abs(p[1]) < h,
    // ein Strich a→c (einfache Linie, keine Fläche; b = Breite nach OSM, für Linien ohne Bedeutung), y aus fbmHoehe
    band = (a, c, b, br) => {
      if (!drin(a) || !drin(c)) return;
      const ya = fbmHoehe(a[0], a[1], br),
        yc = fbmHoehe(c[0], c[1], br);
      if (ya == null || yc == null) return;
      pos.push(a[0], ya + 0.06, a[1], c[0], yc + 0.06, c[1]);
    },
    // Linie mit Strichmuster [an, aus] (aus = 0: durchgezogen), in Stücken von höchstens 2 m (folgt dem Gelände)
    linie = (l, b, an, aus, br) => {
      let s = 0;
      for (let k = 0; k + 1 < l.length; k++) {
        const A = l[k],
          C = l[k + 1],
          L = Math.hypot(C[0] - A[0], C[1] - A[1]);
        let t = 0;
        while (t < L - 1e-6) {
          const per = an + aus,
            ph = aus ? (s + t) % per : 0,
            imStrich = ph < an,
            rest = aus ? (imStrich ? an - ph : per - ph) : L - t,
            d = Math.min(rest, L - t, 2);
          if (imStrich) {
            const p0 = [A[0] + ((C[0] - A[0]) * t) / L, A[1] + ((C[1] - A[1]) * t) / L],
              p1 = [A[0] + ((C[0] - A[0]) * (t + d)) / L, A[1] + ((C[1] - A[1]) * (t + d)) / L];
            band(p0, p1, b, br);
          }
          t += d;
        }
        s += L;
      }
    },
    // Zebrastreifen quer über die Fahrbahn: Mittelpunkt m, Fahrtrichtung u, Fahrbahnbreite W, Länge 4 m
    zebra = (m, u, W, br) => {
      const n = [-u[1], u[0]];
      for (let q = -W / 2 + 0.25; q < W / 2; q += 1) {
        const c = [m[0] + n[0] * (q + 0.25), m[1] + n[1] * (q + 0.25)];
        band([c[0] - u[0] * 2, c[1] - u[1] * 2], [c[0] + u[0] * 2, c[1] + u[1] * 2], 0.5, br);
      }
    },
    querlinien = (m, u, W, br) =>
      [-2, 2].forEach((s) => {
        const c = [m[0] + u[0] * s, m[1] + u[1] * s],
          n = [-u[1], u[0]];
        linie(
          [
            [c[0] - n[0] * (W / 2), c[1] - n[1] * (W / 2)],
            [c[0] + n[0] * (W / 2), c[1] + n[1] * (W / 2)],
          ],
          0.12,
          0.5,
          0.5,
          br,
        );
      }),
    strassen = D.wege.filter((w) => w.t.highway && w.t.footway !== 'crossing' && !w.t.road_marking),
    istZebra = (t) =>
      t.crossing === 'zebra' || t['crossing:markings'] === 'zebra' || t.crossing_ref === 'zebra',
    istMarkiert = (t) =>
      istZebra(t) ||
      (t['crossing:markings'] && t['crossing:markings'] !== 'no') ||
      t.crossing === 'marked' ||
      t.crossing === 'traffic_signals',
    // Fahrtrichtung und Breite der Straße am Punkt p (nächster Straßenweg)
    strasseBei = (p) => {
      let best = null,
        bd = 8;
      strassen.forEach((w) =>
        w.g.forEach((a, i) => {
          if (!i) return;
          const c = w.g[i - 1],
            d = grDSeg(p[0], p[1], a[0], a[1], c[0], c[1]);
          if (d < bd) {
            bd = d;
            const L = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1;
            best = { u: [(a[0] - c[0]) / L, (a[1] - c[1]) / L], w };
          }
        }),
      );
      if (!best) return null;
      const t = best.w.t,
        n = fbmZahl(t.lanes) || (t.oneway === 'yes' ? 1 : 2);
      return {
        u: best.u,
        W: parseFloat(t.width) > 2 ? parseFloat(t.width) : n * FBM.spur,
        br: t.bridge && t.bridge !== 'no',
      };
    };
  // 1) Striche entlang der Straßen
  strassen.forEach((w) => {
    const br = !!(w.t.bridge && w.t.bridge !== 'no');
    fbmStriche(w.t).forEach((s) => {
      const l = fbmVersatz(w.g, s.o);
      if (s.str === 'voll') linie(l, s.b, 1, 0, br);
      else if (s.mitte) linie(l, s.b, 3, 6, br);
      else linie(l, s.b, 3, 6, br);
    });
  });
  // 2) Überwege als Knoten
  D.knoten.forEach((k) => {
    if (!istMarkiert(k.t)) return;
    const s = strasseBei(k.p);
    if (!s) return;
    if (istZebra(k.t)) zebra(k.p, s.u, s.W, s.br);
    else querlinien(k.p, s.u, s.W, s.br);
  });
  // 3) Überwege als Weg (footway=crossing): Streifen parallel zur Straße, entlang des Überwegs
  D.wege.forEach((w) => {
    if (w.t.footway !== 'crossing' || !istMarkiert(w.t)) return;
    const a = w.g[0],
      c = w.g[w.g.length - 1],
      L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (L < 2 || L > 40) return;
    const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
      q = [(c[0] - a[0]) / L, (c[1] - a[1]) / L],
      u = [q[1], -q[0]]; // Fahrtrichtung der Straße: quer zum Überweg
    if (istZebra(w.t)) zebra(m, u, L, false);
    else querlinien(m, u, L, false);
  });
  // 4) road_marking als Linie (Sperrflächen, Haltelinien …), gestrichelt bei stroke=dashed
  D.wege.forEach((w) => {
    if (!w.t.road_marking) return;
    if (w.t.stroke === 'dashed') linie(w.g, FBM.breite, 3, 3, false);
    else linie(w.g, w.t.road_marking === 'stop_line' ? 0.4 : FBM.breite, 1, 0, false);
  });
  if (!pos.length) return;
  if (!FBM.mat) FBM.mat = new T.LineBasicMaterial({ color: new T.Color('#f4f3ee') });
  const ge = new T.BufferGeometry();
  ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  const o = new T.LineSegments(ge, FBM.mat);
  o.raycast = () => {};
  o.userData.str = 1;
  o.userData.fbm = 1;
  g.add(o);
}
