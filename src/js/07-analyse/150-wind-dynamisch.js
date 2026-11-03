// ======================= WIND & RAUCH: BEWEGTE DARSTELLUNG (Realistisch, Realistisch+) =======================
// Wind: helle Strömungsstreifen in Fußgängerhöhe, die mit dem berechneten Feld durch die Straßen ziehen.
// Rauch: weiche Teilchen aus der Quelle, im 3D-Windfeld verweht (mit Zufallsanteil nach Turbulenzgrad), werden mit
// dem Alter größer und blasser. Zeitraffer: Bewegung dreifach beschleunigt. Aktualisierung je Bild über
// onBeforeRender (einmal je Bild, auch wenn Realistisch+ mehrfach rendert).

const WD = { zeit: 3 };

/** Wolkige Qualmflocke als Textur: mehrere weiche Flecken übereinander, Rand ausgeblendet. */
function wdFleck() {
  if (WD.fleck) return WD.fleck;
  const c = document.createElement('canvas'),
    N = 128;
  c.width = c.height = N;
  const x = c.getContext('2d');
  let seed = 9;
  const z = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < 26; n++) {
    const a = z() * Math.PI * 2,
      r = Math.sqrt(z()) * N * 0.26,
      px = N / 2 + Math.cos(a) * r,
      py = N / 2 + Math.sin(a) * r,
      rad = N * (0.12 + z() * 0.16),
      g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.35 + z() * 0.3})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, N, N);
  }
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

/**
 * Qualm wie Nebel: viele weiche, sich drehende Flocken, die aus den Straßen aufsteigen, im
 * 3D-Windfeld verweht und zufällig verwirbelt werden, mit dem Alter wachsen und verblassen. Wo sich die Abgase
 * sammeln, überlagern sich die Flocken – der Qualm wird dort dichter. Startpunkte nach Emissionsstärke gewichtet.
 */
function wdQualm() {
  if (!WI.roh || !WI.gitter || !EM.strassen || !EM.strassen.quellen.length) return;
  const gt = WI.gitter,
    { nx, ny, nz } = gt,
    N = 3500,
    leben = 45, // s
    skala = S.wi.v / WI_U10,
    u = WI.roh.u,
    ti = WI.roh.ti,
    Q = EM.strassen.quellen; // Quellen [i, j, k, Gewicht] (Gitterkoordinaten), Startpunkt nach Gewicht
  const nq = Q.length / 4,
    kum = new Float64Array(nq);
  let sum = 0;
  for (let n = 0; n < nq; n++) kum[n] = sum += Q[4 * n + 3];
  const pi = new Float32Array(N),
    pj = new Float32Array(N),
    pk = new Float32Array(N),
    alt = new Float32Array(N),
    pos = new Float32Array(N * 3),
    gr = new Float32Array(N), // Größe in m
    al = new Float32Array(N), // Deckkraft
    rot = new Float32Array(N); // Drehung
  const streu = 0.6; // Fahrbahnbreite (Zellen)
  const neu = (n) => {
    const z = Math.random() * sum;
    let lo = 0,
      hi = nq - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (kum[m] < z) lo = m + 1;
      else hi = m;
    }
    pi[n] = Q[4 * lo] + (Math.random() - 0.5) * 2 * streu;
    pj[n] = Q[4 * lo + 1] + (Math.random() - 0.5) * 2 * streu;
    pk[n] = Q[4 * lo + 2];
    alt[n] = 0;
    rot[n] = Math.random() * Math.PI * 2;
  };
  for (let n = 0; n < N; n++) neu(n);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('aGr', new T.BufferAttribute(gr, 1));
  g.setAttribute('aAl', new T.BufferAttribute(al, 1));
  g.setAttribute('aRot', new T.BufferAttribute(rot, 1));
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tF: { value: wdFleck() },
      uSkala: { value: 400 },
      uFarbe: { value: new T.Color(0.42, 0.42, 0.45) }, // Abgasgrau, auf hellen Flächen sichtbar
    },
    vertexShader:
      'attribute float aGr,aAl,aRot;uniform float uSkala;varying float vAl,vRot;' +
      'void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;' +
      'gl_PointSize=min(512.,aGr*uSkala/max(1.,-mv.z));vAl=aAl;vRot=aRot;}',
    fragmentShader:
      'uniform sampler2D tF;uniform vec3 uFarbe;varying float vAl,vRot;' +
      'void main(){vec2 p=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);p=mat2(c,-s,s,c)*p+.5;' +
      'float a=texture2D(tF,p).a*vAl;if(a<.004)discard;gl_FragColor=vec4(uFarbe,a);}',
  });
  const p = new T.Points(g, mat);
  p.frustumCulled = false;
  p.raycast = () => {};
  p.renderOrder = 5;
  const uhr = {},
    v3 = new T.Vector2();
  let zeit = 0;
  const schritt = (dt) => {
    zeit += dt;
    for (let n = 0; n < N; n++) {
      alt[n] += dt;
      if (alt[n] > leben || pi[n] < 0 || pj[n] < 0 || pi[n] >= nx || pj[n] >= ny || pk[n] >= nz) neu(n);
      const c =
          Math.min(nx - 1, pi[n] | 0) +
          nx * (Math.min(ny - 1, pj[n] | 0) + ny * Math.min(nz - 1, Math.max(0, pk[n] | 0))),
        vx = u[3 * c] * skala,
        vy = u[3 * c + 1] * skala,
        vz = u[3 * c + 2] * skala,
        sig = Math.max(0.15, ti[c] * skala, 0.18 * Math.hypot(vx, vy, vz)),
        s = (sig * Math.sqrt(dt)) / gt.dx,
        ai = pi[n],
        aj = pj[n],
        ak = pk[n];
      // Wirbel, die sich ablösen und durchziehen: divergenzfreies Rauschfeld (Rotation einer Stromfunktion), das
      // sich mit der Zeit verschiebt und dessen Stärke der örtlichen Turbulenz folgt. Zusammen mit den gemittelten
      // Wirbeln des Windfelds kreist der Qualm an Straßenmündungen, Ecken und auf Plätzen.
      const ax = pi[n] * 0.55 - zeit * 0.35,
        ay = pj[n] * 0.55 + zeit * 0.21,
        // psi = sin(ax)·cos(ay) + 0,5·sin(1,7·ay + 0,8·ax)  ->  (∂psi/∂y, −∂psi/∂x)
        wx0 = -Math.sin(ax) * Math.sin(ay) + 0.85 * Math.cos(1.7 * ay + 0.8 * ax),
        wy0 = -(Math.cos(ax) * Math.cos(ay) + 0.4 * Math.cos(1.7 * ay + 0.8 * ax)),
        wirb = sig * 1.4;
      // Transport im Windfeld, Verwirbelung (Wirbel + Zufallsweg), leichter Auftrieb warmer Abgase am Anfang
      pi[n] += ((vx + wx0 * wirb) * dt) / gt.dx + (Math.random() - 0.5) * 2 * s * 0.6;
      pj[n] += ((vy + wy0 * wirb) * dt) / gt.dx + (Math.random() - 0.5) * 2 * s * 0.6;
      pk[n] = Math.abs(pk[n] + ((vz + (alt[n] < 4 ? 0.3 : 0)) * dt) / gt.dx + (Math.random() - 0.5) * 2 * s);
      const [wx, wz] = gt.welt(pi[n] - 0.5, pj[n] - 0.5);
      if (pk[n] * gt.dx < gt.hFein(wx, wz)) {
        // nicht in echte Gebäude hinein
        pi[n] = ai;
        pj[n] = aj;
        pk[n] = ak;
      }
      const [x, z] = gt.welt(pi[n] - 0.5, pj[n] - 0.5),
        t = alt[n] / leben;
      pos[3 * n] = x;
      pos[3 * n + 1] = gh(x, z) + pk[n] * gt.dx;
      pos[3 * n + 2] = z;
      gr[n] = 3 + t * 11; // wächst mit dem Alter
      al[n] = Math.min(1, alt[n] * 1.5) * (1 - t) * 0.22;
      rot[n] += dt * 0.15 * (n % 2 ? 1 : -1); // langsames Drehen: Verwirbelung im Bild
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.aGr.needsUpdate = true;
    g.attributes.aAl.needsUpdate = true;
    g.attributes.aRot.needsUpdate = true;
  };
  // gestaffelt vorrechnen, damit der Qualm sofort ausgebildet ist
  for (let n = 0; n < N; n++) alt[n] = Math.random() * leben;
  for (let t = 0; t < 40; t++) schritt(0.5);
  p.onBeforeRender = (r, scn, cam) => {
    // Punktgröße in Pixeln: Höhe des Bildes / (2·tan(Blickwinkel/2))
    const h = r.getDrawingBufferSize(v3).y;
    mat.uniforms.uSkala.value = cam.isPerspectiveCamera
      ? h / (2 * Math.tan((cam.fov * Math.PI) / 360))
      : h / 2;
    schritt(wdDt(uhr));
  };
  WI_G.add(p);
}
