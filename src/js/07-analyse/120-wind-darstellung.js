// ======================= WIND: DARSTELLUNG (einfache Darstellungen) =======================
// Farbfläche in Fußgängerhöhe (Komfortklassen, Windverstärkung oder Verwirbelung), Stromlinien mit Pfeilen,
// Rahmen des Rechenfensters. Liegt knapp über dem Gelände, wirft und empfängt keine Schatten.

S.wiZ = { art: 'komfort', linien: true, flaeche: true };
const WI_G = new T.Group();
WI_G.name = 'wind';
sc.add(WI_G);

/** Farbe je Zelle für die gewählte Darstellung; null = durchsichtig (Gebäude). */
function wiFarbe(e, c, art) {
  const v = e.v[c];
  if (!(v >= 0)) return null;
  if (art === 'komfort') return WI_KLASSEN.find((k) => v < k[0])[2];
  // Verlauf blau (wenig) -> gelb -> rot (viel)
  const t =
      art === 'verst'
        ? Math.min(1, e.verst[c] / 1.6) // 1,0 = wie freie Anströmung
        : Math.min(1, e.turb[c] / 0.6 + (e.rueck[c] ? 0.35 : 0)),
    stufen = ['#3b6fb6', '#5aa7d6', '#9fd3b0', '#e8d96a', '#f0a04b', '#e05a3c', '#9b1d4a'];
  return stufen[Math.min(stufen.length - 1, Math.floor(t * (stufen.length - 1) + 0.5))];
}

function wiLeeren() {
  while (WI_G.children.length) {
    const o = WI_G.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  }
}

/** Alles neu zeichnen (nach Berechnung oder Wechsel der Darstellung). */
function wiZeichnen() {
  wiLeeren();
  try {
    wiZeichnenInhalt();
  } finally {
    // alle Einblendungen: nur Farbe (nicht ins Normalenbild/die Maske von Realistisch+)
    WI_G.traverse((o) => (o.userData.nurFarbe = true));
  }
}
function wiZeichnenInhalt() {
  if (WI.p) wiRahmen();
  const e = WI.erg;
  if (S.tab !== 'Analyse' || S.anT !== 'wi') return;
  if (e && S.wiZ.flaeche) wiFlaeche(e);
  // Realistisch und Realistisch+: bewegte Strömungsstreifen statt statischer Stromlinien
  WI.zModus = drReal();
  if (e && S.wiZ.linien) (WI.zModus ? wdWind : wiStromlinien)(e);
  emZeichnen();
}

/** Rahmen des Rechenfensters und Mittelpunkt. */
function wiRahmen() {
  const { fenster } = S.wi,
    [fx, fz] = wiRichtung(S.wi.r),
    [px, pz] = WI.p,
    h = fenster / 2,
    ecken = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
      [-h, -h],
    ],
    pts = [];
  for (let s = 0; s < 4; s++) {
    const [a0, b0] = ecken[s],
      [a1, b1] = ecken[s + 1];
    for (let t = 0; t <= 20; t++) {
      const a = a0 + ((a1 - a0) * t) / 20,
        b = b0 + ((b1 - b0) * t) / 20,
        x = px + fx * a - fz * b,
        z = pz + fz * a + fx * b;
      pts.push(new T.Vector3(x, gh(x, z) + 0.6, z));
    }
  }
  const l = new T.Line(
    new T.BufferGeometry().setFromPoints(pts),
    new T.LineDashedMaterial({ color: 0x2f5d7c, dashSize: 4, gapSize: 3 }),
  );
  l.computeLineDistances();
  l.raycast = () => {};
  WI_G.add(l);
  const ring = new T.Mesh(
    new T.RingGeometry(2.2, 3, 32).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: 0x2f5d7c, depthWrite: false }),
  );
  ring.position.set(px, gh(px, pz) + 0.5, pz);
  ring.raycast = () => {};
  WI_G.add(ring);
}

/** Farbfläche: eine Zelle je Bildpunkt einer Textur, Fläche folgt dem Gelände. */
function wiFlaeche(e) {
  const gt = e.gt,
    { nx, ny } = gt,
    data = new Uint8Array(nx * ny * 4),
    col = new T.Color();
  for (let c = 0; c < nx * ny; c++) {
    const f = wiFarbe(e, c, S.wiZ.art);
    if (!f) continue;
    col.set(f);
    data.set([col.r * 255, col.g * 255, col.b * 255, 255], c * 4);
  }
  const tex = new T.DataTexture(data, nx, ny);
  tex.magFilter = T.NearestFilter;
  tex.needsUpdate = true;
  const g = new T.PlaneGeometry(1, 1, nx, ny),
    p = g.attributes.position,
    uv = g.attributes.uv;
  for (let v = 0; v < p.count; v++) {
    // Ecken der Zellen: Gitterkoordinate aus UV
    const i = uv.getX(v) * nx - 0.5,
      j = uv.getY(v) * ny - 0.5,
      [x, z] = gt.welt(i, j);
    p.setXYZ(v, x, gh(x, z) + 0.35, z);
  }
  g.computeVertexNormals();
  const m = new T.Mesh(
    g,
    new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );
  m.raycast = () => {};
  m.renderOrder = 2;
  WI_G.add(m);
}

/** Stromlinien in Fußgängerhöhe (Runge-Kutta 2. Ordnung), Farbe nach Geschwindigkeit, Pfeile in Flussrichtung. */
function wiStromlinien(e) {
  const gt = e.gt,
    abst = 10, // Abstand der Startpunkte, m
    schritt = 1.5,
    pos = [],
    farbe = [],
    col = new T.Color(),
    belegt = new Set(); // grobe Belegung, damit sich Linien nicht stapeln
  const zelle = (x, z) => Math.round(x / 4) + ',' + Math.round(z / 4);
  // flaches Band (≥ 0,4 m breit, mit dem Fenster wachsend) statt 1-Pixel-Linie; dunkel abgesetzt, damit es auf der Farbfläche lesbar bleibt
  const B = Math.max(0.4, S.wi.fenster / 300),
    fuege = (a, b, v, breite = B) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz) || 1,
        ox = (-dz / l) * breite * 0.5,
        oz = (dx / l) * breite * 0.5,
        ya = gh(a[0], a[1]) + 1.6,
        yb = gh(b[0], b[1]) + 1.6;
      col.set(WI_KLASSEN.find((k) => v < k[0])[2]).multiplyScalar(0.45);
      pos.push(
        a[0] - ox,
        ya,
        a[1] - oz,
        a[0] + ox,
        ya,
        a[1] + oz,
        b[0] + ox,
        yb,
        b[1] + oz,
        a[0] - ox,
        ya,
        a[1] - oz,
        b[0] + ox,
        yb,
        b[1] + oz,
        b[0] - ox,
        yb,
        b[1] - oz,
      );
      for (let n = 0; n < 6; n++) farbe.push(col.r, col.g, col.b);
    };
  const h = (gt.nx * gt.dx) / 2 - 2;
  for (let a = -h; a <= h; a += abst)
    for (let b = -h; b <= h; b += abst) {
      let x = WI.p[0] + gt.f[0] * a + gt.q[0] * b,
        z = WI.p[1] + gt.f[1] * a + gt.q[1] * b;
      if (belegt.has(zelle(x, z))) continue;
      let weg = 0;
      const eigen = new Set(); // Zellen dieser Linie (erst am Ende als belegt eintragen)
      for (let n = 0; n < 120; n++) {
        const f1 = wiFeld(x, z);
        if (!f1) break;
        const v1 = [f1[0], f1[1]],
          s1 = Math.hypot(v1[0], v1[1]);
        if (s1 < 0.15) break;
        const mx = x + (v1[0] / s1) * schritt * 0.5,
          mz = z + (v1[1] / s1) * schritt * 0.5,
          v2 = wiFeld(mx, mz);
        if (!v2) break;
        const s2 = Math.hypot(v2[0], v2[1]) || 1,
          nx2 = x + (v2[0] / s2) * schritt,
          nz2 = z + (v2[1] / s2) * schritt,
          k = zelle(nx2, nz2);
        if (belegt.has(k)) break;
        eigen.add(k);
        fuege([x, z], [nx2, nz2], s2);
        weg += schritt;
        // Pfeilspitze alle 12 m
        if (weg % 12 < schritt) {
          const dx = v2[0] / s2,
            dz = v2[1] / s2,
            l = 1.2 + B * 2;
          fuege([nx2 - dx * l - dz * l * 0.55, nz2 - dz * l + dx * l * 0.55], [nx2, nz2], s2, B * 0.8);
          fuege([nx2 - dx * l + dz * l * 0.55, nz2 - dz * l - dx * l * 0.55], [nx2, nz2], s2, B * 0.8);
        }
        x = nx2;
        z = nz2;
      }
      for (const k of eigen) belegt.add(k);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(farbe, 3));
  const l = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }));
  l.raycast = () => {};
  l.renderOrder = 3;
  WI_G.add(l);
}
