// ======================= RUNDER AUSSCHNITT =======================
// Beim Projektstart kann statt des Quadrats ein Kreis gewählt werden (GEO.rund, Durchmesser = GEO.size). Geladen wird
// wie bisher das Quadrat; danach wird alles außerhalb des Kreises entfernt: Kartendaten (Linien geteilt, Flächen
// zugeschnitten – damit auch Brücken, Gleise, Markierungen), Bebauungspläne (zugeschnitten), Bäume (Stamm außerhalb).
// Gebäudegrundrisse und Flurstücke schneidet clipRing beim Laden wie am Quadrat zusätzlich am Kreis. Das Gelände endet mit
// runder Kante (rebuildTerrain, skirtBuild), die Vektorflächen am Kreis (strFlaechen).

/** Radius des runden Ausschnitts (m) oder null beim Quadrat. */
const geoRundR = () => (GEO.rund && GEO.size ? GEO.size / 2 : null);

/** Kreis als Vieleck (gegen den Uhrzeigersinn, n Ecken) mit Radius r um den Ursprung. */
function geoRundRing(r, n = 128) {
  const o = [];
  for (let i = 0; i < n; i++)
    o.push([r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
  return o;
}

/** Linienzug l am Kreis r teilen: Stücke innerhalb des Kreises (Schnittpunkte genau auf dem Kreis). */
function geoRundLinie(l, r) {
  const out = [],
    innen = (p) => p[0] * p[0] + p[1] * p[1] <= r * r;
  let cur = null;
  // Schnitt-Parameter t ∈ [0, 1] der Strecke a→b mit dem Kreis
  const ts = (a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      A = dx * dx + dz * dz,
      B = 2 * (a[0] * dx + a[1] * dz),
      C = a[0] * a[0] + a[1] * a[1] - r * r,
      D = B * B - 4 * A * C;
    if (A < 1e-12 || D < 0) return [];
    const s = Math.sqrt(D);
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)].filter((t) => t > 0 && t < 1);
  };
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < l.length; i++) {
    const p = l[i];
    if (i === 0) {
      if (innen(p)) cur = [p];
      continue;
    }
    const a = l[i - 1],
      T = ts(a, p);
    if (cur) {
      if (innen(p)) cur.push(p);
      else {
        cur.push(at(a, p, T[0] != null ? T[0] : 1));
        if (cur.length > 1) out.push(cur);
        cur = null;
      }
    } else if (innen(p)) cur = [at(a, p, T.length ? T[T.length - 1] : 0), p];
    else if (T.length === 2) out.push([at(a, p, T[0]), at(a, p, T[1])]);
  }
  if (cur && cur.length > 1) out.push(cur);
  return out;
}

/** Ring am Kreis r zuschneiden (Sutherland-Hodgman am konvexen Kreis-Vieleck); [] wenn nichts übrig bleibt. */
function geoRundRingSchnitt(ring, r) {
  const K = geoRundRing(r);
  let o = ring;
  for (let i = 0; i < K.length && o.length; i++) {
    const a = K[i],
      b = K[(i + 1) % K.length],
      s = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]),
      n = [];
    o.forEach((p, k) => {
      const q = o[(k + 1) % o.length],
        sp = s(p),
        sq = s(q);
      if (sp >= 0) n.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        n.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    });
    o = n;
  }
  return o.length >= 3 && Math.abs(area(o)) > 0.05 ? o : [];
}

/** Flächen [[äußerer Ring, Löcher …]] am Kreis zuschneiden. */
function geoRundFlaechen(L, r) {
  const out = [];
  (L || []).forEach((rings) => {
    const o = geoRundRingSchnitt(rings[0], r);
    if (!o.length) return;
    out.push(
      [o].concat(
        rings
          .slice(1)
          .map((h) => geoRundRingSchnitt(h, r))
          .filter((h) => h.length),
      ),
    );
  });
  return out;
}

/** Kartendaten (ctxCollect) und Gebäude am Kreis zuschneiden (nur beim runden Ausschnitt). */
function geoRundAcc(acc) {
  const r = geoRundR();
  if (!r || !acc) return;
  for (const k in acc.line)
    acc.line[k] = acc.line[k].flatMap((x) => geoRundLinie(x.l || [], r).map((l) => ({ ...x, l })));
  acc.bridges = (acc.bridges || []).flatMap((x) => geoRundLinie(x.l || [], r).map((l) => ({ ...x, l })));
  acc.names = (acc.names || []).flatMap((x) => geoRundLinie(x.l || [], r).map((l) => ({ ...x, l })));
  for (const k in acc.fill) acc.fill[k] = geoRundFlaechen(acc.fill[k], r);
  // Gebäude: Grundrisse schon beim Laden am Kreis geschnitten (clipRing); ohne Rest entfallen sie
  acc.b = (acc.b || []).filter((b) => b.o && b.o.length >= 3);
}

/** Bäume ({ x, z }) mit Stamm außerhalb des Kreises entfernen (wie am Quadrat). */
function geoRundBaeume(list) {
  const r = geoRundR();
  return r ? (list || []).filter((t) => t.x * t.x + t.z * t.z <= r * r) : list;
}
/** Bebauungspläne ({ polys: [{ rings }] }) am Kreis zuschneiden. */
function geoRundPlaene(list) {
  const r = geoRundR();
  if (!r) return list;
  return list
    .map((b) => ({
      ...b,
      polys: (b.polys || [])
        .map((pg) => ({
          ...pg,
          rings: pg.rings.map((x) => geoRundRingSchnitt(x, r)).filter((x) => x.length),
        }))
        .filter((pg) => pg.rings.length),
    }))
    .filter((b) => b.polys.length);
}

/**
 * Geländenetz rund: Punkte außerhalb des Kreises radial auf den Kreis legen (Höhe dort), Texturkoordinaten mitführen –
 * die Kante ist dann ein Kreis aus N·4 Punkten. Innen bleibt das Netz unverändert (strNetzHoehe gilt dort genau).
 */
function geoRundNetz(g) {
  const r = geoRundR();
  if (!r) return;
  const p = g.attributes.position,
    uv = g.attributes.uv,
    S0 = GEO.size;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      d = Math.hypot(x, z);
    if (d <= r) continue;
    const X = (x / d) * r,
      Z = (z / d) * r;
    p.setXYZ(i, X, gh(X, Z), Z);
    if (uv) uv.setXY(i, X / S0 + 0.5, 0.5 - Z / S0);
  }
  p.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
}
