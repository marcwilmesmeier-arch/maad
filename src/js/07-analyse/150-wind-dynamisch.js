// ======================= WIND & RAUCH: BEWEGTE DARSTELLUNG (Realistisch, Realistisch+) =======================
// Wind: helle Strömungsstreifen in Fußgängerhöhe, die mit dem berechneten Feld durch die Straßen ziehen.
// Rauch: weiche Teilchen aus der Quelle, im 3D-Windfeld verweht (mit Zufallsanteil nach Turbulenzgrad), werden mit
// dem Alter größer und blasser. Zeitraffer: Bewegung dreifach beschleunigt. Aktualisierung je Bild über
// onBeforeRender (einmal je Bild, auch wenn Realistisch+ mehrfach rendert).

const WD = { zeit: 3 };

/** Weicher, runder Fleck als Textur für Rauchteilchen. */
function wdFleck() {
  if (WD.fleck) return WD.fleck;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  WD.fleck = new T.CanvasTexture(c);
  return WD.fleck;
}
/** Zeitschritt je Bild (Sekunden Simulationszeit), je Objekt höchstens einmal je Bild. */
function wdDt(st) {
  const t = performance.now();
  if (t - (st.letzt || 0) < 8) return 0;
  const dt = st.letzt ? Math.min(0.1, (t - st.letzt) / 1000) : 0;
  st.letzt = t;
  return dt * WD.zeit;
}

/** Strömungsstreifen in Fußgängerhöhe. */
function wdWind(e) {
  const gt = e.gt,
    N = 1000,
    h = (gt.nx * gt.dx) / 2 - 2,
    px = new Float32Array(N),
    pz = new Float32Array(N),
    alt = new Float32Array(N),
    py = new Float32Array(N), // Höhe (Gelände + 1,8 m), nur gelegentlich neu bestimmt
    pos = new Float32Array(N * 18), // je Teilchen ein Band aus zwei Dreiecken
    col = new Float32Array(N * 24);
  const neu = (n) => {
    for (let v = 0; v < 20; v++) {
      const a = (Math.random() * 2 - 1) * h,
        b = (Math.random() * 2 - 1) * h,
        x = WI.p[0] + gt.f[0] * a + gt.q[0] * b,
        z = WI.p[1] + gt.f[1] * a + gt.q[1] * b;
      if (wiFeld(x, z)) {
        px[n] = x;
        pz[n] = z;
        py[n] = gh(x, z) + 1.8;
        alt[n] = Math.random() * 6;
        return;
      }
    }
    alt[n] = 99;
  };
  for (let n = 0; n < N; n++) neu(n);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 4));
  const l = new T.Mesh(
    g,
    new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide }),
  );
  l.frustumCulled = false;
  l.raycast = () => {};
  l.renderOrder = 4;
  const uhr = {};
  let bild = 0;
  l.onBeforeRender = () => {
    const dt = wdDt(uhr);
    if (!dt) return;
    bild++;
    for (let n = 0; n < N; n++) {
      const v = alt[n] < 8 ? wiFeld(px[n], pz[n]) : null;
      if (!v || Math.hypot(v[0], v[1]) < 0.2 || gt.hFein(px[n], pz[n]) > 0) {
        neu(n); // kein Wind, außerhalb oder in einem Gebäude (echter Grundriss): neu starten
        continue;
      }
      const sp = Math.hypot(v[0], v[1]),
        lang = Math.min(4, sp * 0.45); // Streifenlänge wächst mit der Geschwindigkeit
      px[n] += v[0] * dt;
      pz[n] += v[1] * dt;
      alt[n] += dt;
      if ((n + bild) % 10 === 0) py[n] = gh(px[n], pz[n]) + 1.8;
      const y = py[n],
        ex = (v[0] / sp) * lang,
        ez = (v[1] / sp) * lang,
        a = Math.min(1, alt[n] * 2, (8 - alt[n]) * 2) * Math.min(0.9, 0.25 + sp / 8);
      // Band 0,35 m breit: hinten durchsichtig, vorne deckend
      const bx = (-ez / lang) * 0.18,
        bz = (ex / lang) * 0.18,
        hx = px[n] - ex,
        hz = pz[n] - ez;
      pos.set(
        [
          hx,
          y,
          hz,
          px[n] - bx,
          y,
          pz[n] - bz,
          px[n] + bx,
          y,
          pz[n] + bz,
          hx,
          y,
          hz,
          px[n] + bx,
          y,
          pz[n] + bz,
          hx,
          y,
          hz,
        ],
        n * 18,
      );
      col.set(
        [
          0.78,
          0.9,
          1,
          0,
          0.78,
          0.9,
          1,
          a,
          0.78,
          0.9,
          1,
          a,
          0.78,
          0.9,
          1,
          0,
          0.78,
          0.9,
          1,
          a,
          0.78,
          0.9,
          1,
          0,
        ],
        n * 24,
      ); // hell bläulich
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  };
  WI_G.add(l);
}

/** Rauchteilchen aus der Quelle im 3D-Feld. */
function wdRauch() {
  if (!EM.q || !WI.roh || !WI.gitter) return;
  const gt = WI.gitter,
    N = 600,
    leben = 40, // s
    skala = S.wi.v / WI_U10,
    [qi, qj] = emGitter(EM.q[0], EM.q[1]),
    qk = (EM.hoehe || (S.em.art === 'kfz' ? 0.5 : S.em.hoehe)) / gt.dx,
    pi = new Float32Array(N),
    pj = new Float32Array(N),
    pk = new Float32Array(N),
    alt = new Float32Array(N),
    pos = new Float32Array(N * 3),
    col = new Float32Array(N * 4);
  const neu = (n) => {
    pi[n] = qi + (Math.random() - 0.5) * (S.em.art === 'kfz' ? 2 : 0.3);
    pj[n] = qj + (Math.random() - 0.5) * (S.em.art === 'kfz' ? 2 : 0.3);
    pk[n] = qk;
    alt[n] = 0;
  };
  for (let n = 0; n < N; n++) {
    neu(n);
    alt[n] = -Math.random() * leben; // gestaffelter Start
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 4));
  const p = new T.Points(
    g,
    new T.PointsMaterial({
      map: wdFleck(),
      size: 6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    }),
  );
  p.frustumCulled = false;
  p.raycast = () => {};
  p.renderOrder = 5;
  const u = WI.roh.u,
    ti = WI.roh.ti,
    { nx, ny, nz } = gt;
  const uhr = {};
  let vorlauf = Math.ceil(leben / 0.5); // Fahne beim Aufbau einmal vollständig vorrechnen
  p.onBeforeRender = () => {
    if (vorlauf > 0) {
      const dt0 = 0.5;
      while (vorlauf-- > 0) schritt(dt0);
      return;
    }
    schritt(wdDt(uhr));
  };
  const schritt = (dt) => {
    for (let n = 0; n < N; n++) {
      alt[n] += dt;
      if (alt[n] < 0) {
        col[n * 4 + 3] = 0;
        continue;
      }
      if (alt[n] > leben || pi[n] < 0 || pj[n] < 0 || pi[n] >= nx || pj[n] >= ny || pk[n] >= nz) neu(n);
      const c =
          Math.min(nx - 1, pi[n] | 0) +
          nx * (Math.min(ny - 1, pj[n] | 0) + ny * Math.min(nz - 1, Math.max(0, pk[n] | 0))),
        vx = u[3 * c] * skala,
        vy = u[3 * c + 1] * skala,
        vz = u[3 * c + 2] * skala,
        sig = Math.max(0.15, ti[c] * skala, 0.18 * Math.hypot(vx, vy, vz)),
        s = (sig * Math.sqrt(dt)) / gt.dx;
      const ai = pi[n],
        aj = pj[n],
        ak = pk[n];
      pi[n] += (vx * dt) / gt.dx + (Math.random() - 0.5) * 2 * s;
      pj[n] += (vy * dt) / gt.dx + (Math.random() - 0.5) * 2 * s;
      pk[n] = Math.abs(pk[n] + (vz * dt) / gt.dx + (Math.random() - 0.5) * 2 * s);
      {
        // nicht in echte Gebäude hinein (Grundriss 1 m): Schritt verwerfen
        const [wx, wz] = gt.welt(pi[n] - 0.5, pj[n] - 0.5);
        if (pk[n] * gt.dx < gt.hFein(wx, wz)) {
          pi[n] = ai;
          pj[n] = aj;
          pk[n] = ak;
        }
      }
      const [x, z] = gt.welt(pi[n] - 0.5, pj[n] - 0.5),
        a = Math.min(1, alt[n]) * (1 - alt[n] / leben) * 0.55;
      pos.set([x, gh(x, z) + pk[n] * gt.dx, z], n * 3);
      col.set([0.42, 0.4, 0.38, a], n * 4);
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  };
  WI_G.add(p);
}
