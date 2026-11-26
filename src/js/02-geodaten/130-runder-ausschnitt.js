// ======================= RUNDER AUSSCHNITT =======================
// Beim Projektstart kann statt des Quadrats ein Kreis gewählt werden (GEO.rund, Durchmesser = GEO.size). Geladen wird
// wie bisher das Quadrat; danach wird alles außerhalb des Kreises entfernt: Kartendaten (Linien geteilt, Flächen
// zugeschnitten – damit auch Brücken, Gleise, Markierungen), Bebauungspläne (zugeschnitten), Bäume (Stamm außerhalb).
// Gebäudegrundrisse und Flurstücke schneidet clipRing beim Laden wie am Quadrat zusätzlich am Kreis. Das Gelände endet mit
// runder Kante (rebuildTerrain, skirtBuild), die Vektorflächen am Kreis (strFlaechen).

/** Radius des runden Ausschnitts (m) oder null beim Quadrat. */
const geoRundR = () => (GEO.rund && GEO.size ? GEO.size / 2 : null);

/** Kreis als Vieleck (gegen den Uhrzeigersinn, n Ecken) mit Radius r um den Ursprung. */
function geoRundRing(r, n = 256) {
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

/** Grundriss eines Gebäudes ({ o, holes }) am Kreis gekappt (Kopie) – unverändert, wenn er ganz innen liegt; null ohne Rest. */
function geoRundGrundriss(b) {
  const r = geoRundR();
  if (!r || !b.o || b.o.every((p) => p[0] * p[0] + p[1] * p[1] <= r * r * 1.000001)) return b;
  const o = geoRundRingSchnitt(b.o, r);
  if (!o.length) return null;
  return { ...b, o, holes: (b.holes || []).map((h) => geoRundRingSchnitt(h, r)).filter((h) => h.length > 2) };
}

/**
 * Gebäude aus Dreiecken (LoD2 mit Dach, nicht indiziert, position + normal) am Kreis schneiden wie die Grundrisse:
 * jedes Dreieck an den Kreiskanten nahe dem Gebäude gekappt; die offene Schnittseite wird mit einer Wand entlang des
 * Kreises geschlossen, die oben dem Dach folgt (höchster Punkt des Gebäudes über der Stelle) und unten am Fuß endet.
 */
function geoRundGebaeude(ge, b) {
  const r = geoRundR();
  if (!r || !ge) return ge;
  const P = ge.attributes.position.array,
    Nn = ge.attributes.normal.array,
    r2 = r * r;
  let raus = false;
  for (let i = 0; i < P.length; i += 3)
    if (P[i] * P[i] + P[i + 2] * P[i + 2] > r2 * 1.000001) {
      raus = true;
      break;
    }
  if (!raus) return ge;
  // Kreiskanten (Vieleck wie geoRundRingSchnitt) im Winkelbereich des Gebäudes
  const K = geoRundRing(r),
    n = K.length,
    wink = [];
  for (let i = 0; i < P.length; i += 3) wink.push(Math.atan2(P[i + 2], P[i]));
  const ebenen = K.map((a, i) => [a, K[(i + 1) % n], (2 * Math.PI * (i + 0.5)) / n]).filter(([, , w]) =>
    wink.some((v) => Math.abs(Math.atan2(Math.sin(v - w), Math.cos(v - w))) < 0.2),
  );
  const pos = [],
    nor = [],
    oben = [];
  for (let t = 0; t < P.length; t += 9) {
    let poly = [0, 1, 2].map((k) => [P[t + 3 * k], P[t + 3 * k + 1], P[t + 3 * k + 2]]);
    for (const [a, c] of ebenen) {
      if (poly.length < 3) break;
      const s = (p) => (c[0] - a[0]) * (p[2] - a[1]) - (c[1] - a[1]) * (p[0] - a[0]),
        q2 = [];
      poly.forEach((p, k) => {
        const q = poly[(k + 1) % poly.length],
          sp = s(p),
          sq = s(q);
        if (sp >= 0) q2.push(p);
        if (sp >= 0 !== sq >= 0) {
          const u = sp / (sp - sq);
          q2.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u]);
        }
      });
      poly = q2;
    }
    if (poly.length < 3) continue;
    const nx = Nn[t],
      ny = Nn[t + 1],
      nz = Nn[t + 2];
    for (let k = 1; k + 1 < poly.length; k++)
      [poly[0], poly[k], poly[k + 1]].forEach((p) => {
        pos.push(p[0], p[1], p[2]);
        nor.push(nx, ny, nz);
      });
    oben.push(poly);
  }
  // Schnittwand: Grundriss am Kreis, Abschnitte des Rands auf dem Kreis, alle 0,5 m eine Stütze
  const g = geoRundGrundriss(b);
  if (g && g.o) {
    let y0 = 1e9;
    for (let i = 1; i < pos.length; i += 3) y0 = Math.min(y0, pos[i]);
    // höchster Punkt der Gebäudeflächen senkrecht über (x, z)
    const hoch = (x, z) => {
      let best = null;
      oben.forEach((pl) => {
        for (let k = 1; k + 1 < pl.length; k++) {
          const A = pl[0],
            B = pl[k],
            C = pl[k + 1],
            d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
          if (Math.abs(d) < 1e-9) continue;
          const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d,
            l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d,
            l3 = 1 - l1 - l2;
          if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
          const y = l1 * A[1] + l2 * B[1] + l3 * C[1];
          if (best == null || y > best) best = y;
        }
      });
      return best;
    };
    // auf dem Kreis-Vieleck: zwischen Sehnenmitte (r · cos(π/n)) und Ecke (r)
    const tol = r * (1 - Math.cos(Math.PI / geoRundRing(1).length)) + 0.01,
      aufKreis = (p) => Math.abs(Math.hypot(p[0], p[1]) - r) < tol;
    g.o.forEach((p, i) => {
      const q = g.o[(i + 1) % g.o.length];
      if (!aufKreis(p) || !aufKreis(q)) return;
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
        m = Math.max(1, Math.ceil(L / 0.5)),
        st = [];
      for (let k = 0; k <= m; k++) {
        const x = p[0] + ((q[0] - p[0]) * k) / m,
          z = p[1] + ((q[1] - p[1]) * k) / m,
          // 3 cm nach innen: sicher innerhalb der geschnittenen Flächen
          f = (Math.hypot(x, z) - 0.03) / Math.hypot(x, z),
          y = hoch(x * f, z * f);
        st.push([x, z, y]);
      }
      for (let k = 0; k < m; k++) {
        const A = st[k],
          C = st[k + 1];
        if (A[2] == null || C[2] == null || A[2] <= y0 + 0.01 || C[2] <= y0 + 0.01) continue;
        const nl = Math.hypot(A[0] + C[0], A[1] + C[1]) || 1,
          nx = (A[0] + C[0]) / nl,
          nz = (A[1] + C[1]) / nl;
        [
          [A[0], y0, A[1]],
          [C[0], y0, C[1]],
          [C[0], C[2], C[1]],
          [A[0], y0, A[1]],
          [C[0], C[2], C[1]],
          [A[0], A[2], A[1]],
        ].forEach((v) => {
          pos.push(v[0], v[1], v[2]);
          nor.push(nx, 0, nz);
        });
      }
    });
  }
  ge.dispose();
  if (!pos.length) return null;
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('normal', new T.BufferAttribute(new Float32Array(nor), 3));
  return out;
}

/** Randpunkte des runden Geländes in Umlaufreihenfolge: Rand des Rasters radial auf den Kreis (wie geoRundNetz). */
function geoRundRand() {
  const r = geoRundR(),
    N = GEO.N,
    h = GEO.size / 2,
    st = GEO.size / N,
    P = [],
    auf = (x, z) => {
      const d = Math.hypot(x, z);
      return d > r ? [(x / d) * r, (z / d) * r] : [x, z];
    };
  for (let i = 0; i < N; i++) P.push(auf(-h + i * st, -h));
  for (let i = 0; i < N; i++) P.push(auf(h, -h + i * st));
  for (let i = 0; i < N; i++) P.push(auf(h - i * st, h));
  for (let i = 0; i < N; i++) P.push(auf(-h, h - i * st));
  P.push(P[0]);
  return P;
}
