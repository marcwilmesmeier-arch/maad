// ======================= SONNENSTUNDEN (wie Forma „Sun hours“) =======================
// Für einen Stichtag wird der Sonnenlauf in Zeitschritten durchgerechnet: je Schritt rendert die Grafikkarte ein
// Tiefenbild aus Sicht der Sonne (Gebäude, Bäume, Gelände werfen Schatten). Für jeden Messpunkt wird geprüft, ob er
// vor dem gespeicherten Tiefenwert liegt (besonnt), und die Zeit aufsummiert.
// Messpunkte: Fassaden und Dächer der Planungsgebäude (fein unterteilt, als farbige Haut darübergelegt) und der Boden
// im einstellbaren Umkreis um das Grundstück (Heatmap im Geländebild). Umgebungsgebäude werfen nur Schatten.
// Farbskala wie in Forma: dunkles Violett (keine Sonne) über Rot/Orange zu hellem Gelb (ganztags).

const SO = { st: 'aus', fehler: '', anteil: 0, erg: null, punkte: [], wahl: false };
S.so = { tag: 'm03', radius: 150, schritt: 15 };
const SO_FARBEN = ['#2b1250', '#55207a', '#86307f', '#b8477a', '#e2685f', '#f6944a', '#fbc55a', '#fbf0a3'];
const SO_TAGE = [
  ['m03', '21. März (Tagundnachtgleiche)', '-03-21'],
  ['m06', '21. Juni (längster Tag)', '-06-21'],
  ['m12', '21. Dezember (kürzester Tag)', '-12-21'],
  ['dar', 'Datum der Darstellung', ''],
];
LY.push(['Sonnenstunden', 'son', 1, 1]);
const SO_G = new T.Group();
SO_G.name = 'sonnenstunden';
sc.add(SO_G);
G.son = SO_G;

/** Stichtag als JJJJ-MM-TT. */
function soDatum() {
  const t = SO_TAGE.find((x) => x[0] === S.so.tag) || SO_TAGE[0];
  return t[2] ? drDs().slice(0, 4) + t[2] : drDs();
}
/** Farbe zu Sonnenstunden h bei Tageslänge max (linear über die Skala). */
function soFarbe(h, max) {
  const f = Math.max(0, Math.min(1, h / Math.max(0.5, max))) * (SO_FARBEN.length - 1),
    i = Math.min(SO_FARBEN.length - 2, Math.floor(f)),
    a = new T.Color(SO_FARBEN[i]),
    b = new T.Color(SO_FARBEN[i + 1]);
  return a.lerp(b, f - i);
}
/** Mittelpunkt (Grundstück, sonst Projektmitte) und Grundstücksflächen. */
function soBereich() {
  let polys = [];
  try {
    const s = axSites();
    if (s && !s.project && s.polys) polys = s.polys;
  } catch (e) {
    logErr(e, 'soBereich');
  }
  return { c: polys.length ? cen(polys.flat()) : [0, 0], polys };
}

/**
 * Messpunkte auf den Planungsgebäuden: nur Außenflächen (innenliegende Decken/Wände und Unterseiten entfallen),
 * Dreiecke fein unterteilt (Kanten ≤ 1 m).
 */
function soGebaeudePunkte() {
  const tri = [],
    roh = [],
    a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    rc = new T.Raycaster(),
    hoch = new T.Vector3(0, 1, 0);
  rc.far = 300;
  for (const bl of S.bld) {
    if (bl.ex || !bl._g) continue;
    bl._g.updateMatrixWorld(true);
    const koerper = [];
    bl._g.traverse((o) => o.isMesh && !o.isSprite && o.visible && koerper.push(o));
    // für den Innen-Test beide Seiten treffen (sonst wird die Oberseite des nächsten Geschosses von unten übersehen)
    const seiten = koerper.map((o) => o.material && o.material.side);
    koerper.forEach((o) => o.material && (o.material.side = T.DoubleSide));
    bl._g.traverse((o) => {
      if (!o.isMesh || o.isSprite || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
      if (o.material && (o.material.transparent || o.material.opacity < 1)) return; // Glas, Hilfsflächen
      const p = o.geometry.attributes.position,
        ix = o.geometry.index,
        n = ix ? ix.count : p.count;
      for (let k = 0; k + 2 < n; k += 3) {
        const i0 = ix ? ix.getX(k) : k,
          i1 = ix ? ix.getX(k + 1) : k + 1,
          i2 = ix ? ix.getX(k + 2) : k + 2;
        a.fromBufferAttribute(p, i0).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(p, i1).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(p, i2).applyMatrix4(o.matrixWorld);
        const n = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(c, a));
        if (n.lengthSq() < 1e-8) continue;
        n.normalize();
        // Außenseite: Normale vom Gebäude weg (Flächen sind teils falsch herum angelegt) – Test über den Grundriss
        const m = new T.Vector3().addVectors(a, b).add(c).divideScalar(3);
        if (Math.abs(n.y) < 0.7 && bl.fp && bclIn([bl.fp], m.x + n.x * 0.3, m.z + n.z * 0.3)) n.negate();
        if (n.y < -0.5) continue; // Unterseiten bekommen nie Sonne
        // innenliegend, wenn über dem Punkt vor der Fläche noch Teile des Gebäudes liegen (Geschossdecken, Innenwände)
        rc.set(new T.Vector3().copy(m).addScaledVector(n, 0.05), hoch); // knapp über der Fläche: auch dicht übereinanderliegende Schichten
        if (rc.intersectObjects(koerper, false).length) continue;
        soTeilen(a.toArray(), b.toArray(), c.toArray(), roh, 0);
      }
    });
    koerper.forEach((o, i) => o.material && (o.material.side = seiten[i]));
  }
  // deckungsgleiche Flächen (z. B. Dach und oberste Decke an derselben Stelle) nur einmal: Mittelpunkt auf 0,2 m;
  // Teile unter der Geländeoberfläche (Untergeschosse) entfallen
  const gesehen = new Set();
  for (let t = 0; t < roh.length; t += 3) {
    const [p, q, r] = [roh[t], roh[t + 1], roh[t + 2]],
      k = [0, 1, 2].map((i) => Math.round(((p[i] + q[i] + r[i]) / 3) * 5)).join(',');
    if (gesehen.has(k)) continue;
    const my = (p[1] + q[1] + r[1]) / 3;
    if (my < gh((p[0] + q[0] + r[0]) / 3, (p[2] + q[2] + r[2]) / 3) - 0.05) continue;
    gesehen.add(k);
    tri.push(p, q, r);
  }
  return tri;
}
function soTeilen(a, b, c, out, tiefe) {
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]),
    ab = d(a, b),
    bc = d(b, c),
    ca = d(c, a),
    m = Math.max(ab, bc, ca);
  if (m <= 1 || tiefe > 16) {
    out.push(a, b, c);
    return;
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
  if (m === ab) {
    const e = mid(a, b);
    soTeilen(a, e, c, out, tiefe + 1);
    soTeilen(e, b, c, out, tiefe + 1);
  } else if (m === bc) {
    const e = mid(b, c);
    soTeilen(a, b, e, out, tiefe + 1);
    soTeilen(a, e, c, out, tiefe + 1);
  } else {
    const e = mid(c, a);
    soTeilen(a, b, e, out, tiefe + 1);
    soTeilen(e, b, c, out, tiefe + 1);
  }
}

/** Rechnen (schrittweise, damit maad bedienbar bleibt). */
async function soRechnen() {
  if (SO.st === 'rechnet') return;
  SO.st = 'rechnet';
  SO.anteil = 0;
  SO.fehler = '';
  rr();
  const t0 = performance.now();
  try {
    const { c, polys } = soBereich(),
      R = S.so.radius,
      zelle = Math.max(0.5, R / 200),
      W = Math.ceil((2 * R) / zelle),
      ds = soDatum(),
      [la, lo] = drLL(),
      dt = S.so.schritt / 60;
    // Messpunkte Boden: Zellmitten im Kreis, Höhe Gelände + 0,3 m; Gebäudegrundrisse ausmaskiert
    const maske = soGrundrissMaske(c, R, W, zelle),
      bp = new Float32Array(W * W * 3),
      bh = new Float32Array(W * W).fill(-1);
    for (let j = 0; j < W; j++)
      for (let i = 0; i < W; i++) {
        const x = c[0] - R + (i + 0.5) * zelle,
          z = c[1] - R + (j + 0.5) * zelle,
          k = j * W + i;
        if (Math.hypot(x - c[0], z - c[1]) > R || maske[k]) continue; // unter Gebäuden: nicht gezählt
        bp.set([x, gh(x, z) + 0.3, z], k * 3);
        bh[k] = 0;
      }
    // Messpunkte Planungsgebäude (je Dreiecksecke, um 0,15 m entlang der Normalen nach außen versetzt)
    const tri = soGebaeudePunkte(),
      gp = new Float32Array(tri.length * 3),
      gn = new Float32Array(tri.length * 3),
      gh2 = new Float32Array(tri.length);
    for (let t = 0; t < tri.length; t += 3) {
      const [a, b, cc] = [tri[t], tri[t + 1], tri[t + 2]],
        u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        v = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]],
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
        l = Math.hypot(...n) || 1;
      n[0] /= l;
      n[1] /= l;
      n[2] /= l;
      const mx = (a[0] + b[0] + cc[0]) / 3,
        mz = (a[2] + b[2] + cc[2]) / 3;
      if (
        Math.abs(n[1]) < 0.7 &&
        S.bld.some((x) => !x.ex && x.fp && bclIn([x.fp], mx + n[0] * 0.3, mz + n[2] * 0.3))
      ) {
        n[0] = -n[0];
        n[1] = -n[1];
        n[2] = -n[2];
      }
      if (n[1] < -0.5) {
        n[0] = -n[0];
        n[1] = -n[1];
        n[2] = -n[2];
      }
      for (let q = 0; q < 3; q++) {
        const p = tri[t + q],
          o = (t + q) * 3;
        gp.set([p[0] + n[0] * 0.15, p[1] + n[1] * 0.15, p[2] + n[2] * 0.15], o);
        gn.set(n, o);
      }
    }
    // Zeitschritte mit Sonne über dem Horizont
    const zeiten = [];
    for (let m = 0; m < 1440; m += S.so.schritt) {
      const sp = sunPos(ds, (m + S.so.schritt / 2) / 60, la, lo);
      sp.min = m;
      if (sp.el > (1 * Math.PI) / 180) zeiten.push(sp);
    }
    const tag = zeiten.length * dt,
      pp = soPunkteVorbereiten(zeiten.length);
    let k = 0;
    for (const sp of zeiten) {
      const tief = soTiefenbild(sp.dir, c, R);
      soZaehlen(tief, bp, bh, null, dt);
      soZaehlen(tief, gp, gh2, gn, dt, sp.dir);
      soPunkteZaehlen(tief, pp, k, sp.dir);
      SO.anteil = ++k / zeiten.length;
      wiPanelAufAllg();
      await new Promise((r) => setTimeout(r, 0));
    }
    SO.erg = {
      c,
      R,
      W,
      zelle,
      bh,
      tri,
      gh: gh2,
      tag,
      polys,
      ds,
      schritt: S.so.schritt,
      zeiten: zeiten.map((z) => z.min),
      dauer: Math.round((performance.now() - t0) / 1000),
    };
    soPunkteAbschliessen(pp, dt);
    SO.st = 'fertig';
    soZeichnen();
  } catch (e) {
    SO.st = 'fehler';
    SO.fehler = String((e && e.message) || e);
    logErr(e, 'soRechnen');
  }
  rr();
}
/** Fortschrittsbalken ohne ganzes Panel neu zu zeichnen. */
function wiPanelAufAllg() {
  const b = $('soFort');
  if (b) b.style.width = Math.round(SO.anteil * 100) + '%';
}

/** Grundrisse aller Gebäude (Umgebung + Planung) im Raster: 1 = unter einem Gebäude. */
function soGrundrissMaske(c, R, W, zelle) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const x = cv.getContext('2d'),
    X = (p) => (p[0] - (c[0] - R)) / zelle,
    Z = (p) => (p[1] - (c[1] - R)) / zelle,
    zeichne = (o) => {
      if (!o || o.length < 3) return;
      x.beginPath();
      o.forEach((p, i) => (i ? x.lineTo(X(p), Z(p)) : x.moveTo(X(p), Z(p))));
      x.closePath();
      x.fill();
    };
  x.fillStyle = '#000';
  for (const r of GEO.ranges || []) zeichne(r.b && r.b.o);
  for (const b of S.bld) if (!b.ex && b.fp) zeichne(b.fp);
  const d = x.getImageData(0, 0, W, W).data,
    m = new Uint8Array(W * W);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 128 ? 1 : 0;
  return m;
}

const SO_RT = { rt: null, mat: null, buf: null, N: 2048 };
/**
 * Tiefenbild aus Sonnenrichtung (Parallelprojektion) über dem Analysebereich samt Rand für lange Schatten.
 * Liefert Kamera und Tiefenwerte (0 = nah, 1 = fern).
 */
function soTiefenbild(dir, c, R) {
  const N = SO_RT.N;
  if (!SO_RT.rt) {
    SO_RT.rt = new T.WebGLRenderTarget(N, N, { type: T.FloatType, format: T.RGBAFormat, depthBuffer: true });
    SO_RT.mat = new T.MeshDepthMaterial({ depthPacking: T.BasicDepthPacking, side: T.DoubleSide });
    SO_RT.buf = new Float32Array(N * N * 4);
  }
  const el = Math.asin(Math.max(0.02, dir[1])),
    rand = Math.min(250, 60 / Math.tan(el)), // lange Schatten von außerhalb (Gebäude bis 60 m hoch), begrenzt
    S2 = R + rand,
    y0 = gh(c[0], c[1]),
    cam = new T.OrthographicCamera(-S2, S2, S2, -S2, 1, 1600),
    ziel = new T.Vector3(c[0], y0, c[1]);
  cam.position.set(c[0] + dir[0] * 800, y0 + dir[1] * 800, c[1] + dir[2] * 800);
  cam.up.set(0, 1, 0);
  if (Math.abs(dir[1]) > 0.999) cam.up.set(0, 0, 1);
  cam.lookAt(ziel);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  // nur Schattenwerfer: Einblendungen (Analysen, Marker, Himmel) ausblenden
  const aus = [WI_G, SC_G, ER_G, SO_G, DR && DR.skyM].filter((o) => o && o.visible);
  aus.forEach((o) => (o.visible = false));
  const bg = sc.background,
    om = sc.overrideMaterial,
    fog = sc.fog,
    alt = ren.getRenderTarget(),
    ac = ren.autoClear,
    cc = ren.getClearColor(new T.Color()),
    ca = ren.getClearAlpha();
  try {
    sc.background = null;
    sc.fog = null;
    sc.overrideMaterial = SO_RT.mat;
    ren.setRenderTarget(SO_RT.rt);
    ren.setClearColor(0xffffff, 1);
    ren.autoClear = true;
    ren.clear();
    ren.render(sc, cam);
    ren.readRenderTargetPixels(SO_RT.rt, 0, 0, N, N, SO_RT.buf);
  } finally {
    ren.setRenderTarget(alt);
    ren.setClearColor(cc, ca);
    ren.autoClear = ac;
    sc.background = bg;
    sc.fog = fog;
    sc.overrideMaterial = om;
    aus.forEach((o) => (o.visible = true));
  }
  return { cam, buf: SO_RT.buf, N };
}
/** Für Punkte (x,y,z) prüfen, ob sie besonnt sind, und dt aufaddieren. Mit Normalen: nur der Sonne zugewandt. */
function soZaehlen(tief, P, H, Nn, dt, dir) {
  const { cam, buf, N } = tief,
    m = new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements,
    bias = 0.00025; // etwa 0,4 m bei 1600 m Tiefe
  for (let k = 0; k < H.length; k++) {
    if (H[k] < 0) continue;
    if (Nn && Nn[k * 3] * dir[0] + Nn[k * 3 + 1] * dir[1] + Nn[k * 3 + 2] * dir[2] <= 0.02) continue;
    const x = P[k * 3],
      y = P[k * 3 + 1],
      z = P[k * 3 + 2],
      nx = m[0] * x + m[4] * y + m[8] * z + m[12],
      ny = m[1] * x + m[5] * y + m[9] * z + m[13],
      nz = m[2] * x + m[6] * y + m[10] * z + m[14],
      u = Math.floor((nx * 0.5 + 0.5) * N),
      v = Math.floor((ny * 0.5 + 0.5) * N);
    if (u < 0 || v < 0 || u >= N || v >= N) continue;
    const d = 1 - buf[(v * N + u) * 4]; // BasicDepthPacking speichert 1 − Tiefe
    if (nz * 0.5 + 0.5 <= d + bias) H[k] += dt;
  }
}

/** Heatmap am Boden (Karten-Ebene „son“) und Haut auf den Planungsgebäuden. */
function soZeichnen() {
  while (SO_G.children.length) {
    const o = SO_G.children.pop();
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
  const e = SO.erg;
  if (!e) {
    OVI.son = [];
    return;
  }
  const max = e.tag || 1;
  // Boden: Bild über dem Quadrat um den Kreis (Bereich it.b), Kreisrand angedeutet
  const cv = document.createElement('canvas');
  cv.width = cv.height = e.W;
  const x = cv.getContext('2d'),
    img = x.createImageData(e.W, e.W),
    wert = soAuffuellen(e);
  for (let k = 0; k < wert.length; k++) {
    if (wert[k] < 0) continue;
    const f = soFarbe(wert[k], max);
    img.data.set([f.r * 255, f.g * 255, f.b * 255, 255], k * 4);
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = '#55207a';
  x.lineWidth = Math.max(1, e.W / 300);
  x.beginPath();
  x.arc(e.W / 2, e.W / 2, e.W / 2 - x.lineWidth, 0, Math.PI * 2);
  x.stroke();
  const it = [{ t: 'img', cv, b: [e.c[0] - e.R, e.c[1] - e.R, e.c[0] + e.R, e.c[1] + e.R] }];
  it._v = Math.random();
  OVI.son = it;
  // Planungsgebäude: Haut aus den unterteilten Dreiecken, Farbe je Ecke
  if (e.tri.length) {
    const pos = new Float32Array(e.tri.length * 3),
      col = new Float32Array(e.tri.length * 3);
    e.tri.forEach((p, i) => {
      pos.set(p, i * 3);
      const f = soFarbe(e.gh[i], max);
      col.set([f.r, f.g, f.b], i * 3);
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        side: T.DoubleSide,
      }),
    );
    m.raycast = () => {};
    m.userData.nurFarbe = true;
    SO_G.add(m);
  }
  // Analysepunkte: kleiner Punkt auf der Fläche und Schild mit Sonnenscheindauer
  for (const q of SO.punkte) {
    const pt = new T.Mesh(
      new T.SphereGeometry(0.35, 12, 8),
      new T.MeshBasicMaterial({ color: 0x2b1250, depthTest: false }),
    );
    pt.position.set(q.p[0], q.p[1], q.p[2]);
    pt.renderOrder = 20;
    pt.raycast = () => {};
    SO_G.add(pt, soPunktSprite(q));
  }
  try {
    if (S.geo) recomp();
  } catch (err) {
    logErr(err, 'soZeichnen');
  }
  neuZeichnen();
}
/**
 * Für die Darstellung: Zellen unter Gebäuden (nicht gerechnet) mit dem Wert der Nachbarzellen füllen, damit an den
 * Hauskanten weder weiße Spalten noch dunkle Säume entstehen (die Gebäude verdecken diese Zellen ohnehin).
 */
function soAuffuellen(e) {
  const W = e.W,
    v = Float32Array.from(e.bh),
    innen = (i, j) => Math.hypot((i + 0.5) * e.zelle - e.R, (j + 0.5) * e.zelle - e.R) <= e.R;
  for (let runde = 0; runde < 6; runde++) {
    const neu = Float32Array.from(v);
    let offen = 0;
    for (let j = 0; j < W; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (v[k] >= 0 || !innen(i, j)) continue;
        let s = 0,
          n = 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= W || b >= W) continue;
          const q = v[b * W + a];
          if (q >= 0) {
            s += q;
            n++;
          }
        }
        if (n) neu[k] = s / n;
        else offen++;
      }
    v.set(neu);
    if (!offen) break;
  }
  return v;
}
/** Ein-/Ausblenden (zweiter Klick auf den Reiterknopf); ohne Argument: sichtbar? */
function soSichtbar(an) {
  const i = LY.findIndex((l) => l[1] === 'son');
  if (an === undefined) return i >= 0 && !!LY[i][2];
  if (i >= 0) lvis(i, an ? 1 : 0);
  if (S.geo) recomp();
  return an;
}

/** Kennzahlen: Grundstück (Freifläche) und je Planungsgebäude Fassaden/Dach (flächengewichtet). */
function soKennzahlen() {
  const e = SO.erg;
  if (!e) return null;
  const inPoly = (x, z) => e.polys.some((p) => bclIn([p], x, z));
  let gs = 0,
    gn = 0,
    g4 = 0;
  for (let j = 0; j < e.W; j++)
    for (let i = 0; i < e.W; i++) {
      const k = j * e.W + i;
      if (e.bh[k] < 0) continue;
      const x = e.c[0] - e.R + (i + 0.5) * e.zelle,
        z = e.c[1] - e.R + (j + 0.5) * e.zelle;
      if (e.polys.length && !inPoly(x, z)) continue;
      gs += e.bh[k];
      gn++;
      if (e.bh[k] >= 4) g4++;
    }
  // Gebäudeflächen: Dreiecksfläche × mittlere Stunden, getrennt nach Fassade (steil) und Dach (flach)
  let fa = 0,
    fh = 0,
    da = 0,
    dh = 0,
    f2 = 0;
  for (let t = 0; t < e.tri.length; t += 3) {
    const [a, b, c] = [e.tri[t], e.tri[t + 1], e.tri[t + 2]],
      u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
      A = Math.hypot(...n) / 2,
      ny = Math.abs(n[1]) / (2 * A || 1),
      h = (e.gh[t] + e.gh[t + 1] + e.gh[t + 2]) / 3;
    if (ny > 0.7) {
      // Unterseiten sind bereits ausgeschlossen: jede flache Fläche ist Dach (Ausrichtung im Modell teils gedreht)
      da += A;
      dh += A * h;
    } else {
      fa += A;
      fh += A * h;
      if (h >= 2) f2 += A;
    }
  }
  return {
    grund: gn ? { mittel: gs / gn, ab4: g4 / gn } : null,
    fassade: fa ? { mittel: fh / fa, ab2: f2 / fa, flaeche: fa } : null,
    dach: da ? { mittel: dh / da, flaeche: da } : null,
  };
}

/** Inhalt des Reiters „Sonne“. */
function soPanel() {
  const gs = axSites(),
    grund = gs && !gs.project;
  let h = `<div class="card"><b>Sonnenstunden</b><div class="dmu" style="margin:4px 0 8px">Direkte Sonne am Stichtag auf Fassaden und Dächern der Planung und auf dem Boden im Umkreis um das Grundstück. Bestand, Bäume und Gelände werfen Schatten.</div>`;
  h += `<div class="kv"><span>Mittelpunkt</span><b>${grund ? esc(gs.label) : 'Projektmitte'}</b></div>`;
  h += `<label style="display:block;font-size:12px;margin-top:6px">Stichtag <select onchange="S.so.tag=this.value;rr()" style="width:100%">${SO_TAGE.map(([k, n]) => `<option value="${k}" ${k === S.so.tag ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  h += `<label style="display:block;font-size:12px;margin-top:6px">Umkreis <b id="soR">${S.so.radius} m</b><input type="range" min="50" max="400" step="10" value="${S.so.radius}" style="width:100%" oninput="$('soR').textContent=this.value+' m'" onchange="S.so.radius=+this.value;rr()"></label>`;
  h += `<label style="display:block;font-size:12px;margin-top:4px">Zeitschritt <select onchange="S.so.schritt=+this.value">${[15, 30].map((v) => `<option value="${v}" ${v === S.so.schritt ? 'selected' : ''}>${v} min</option>`).join('')}</select></label>`;
  if (SO.st === 'rechnet')
    h += `<div style="margin-top:10px"><div style="height:6px;background:var(--ln);border-radius:3px;overflow:hidden"><div id="soFort" style="height:100%;width:${Math.round(SO.anteil * 100)}%;background:#86307f"></div></div><div class="dmu" style="margin-top:4px">Sonnenlauf wird berechnet …</div></div>`;
  else
    h += `<button class="pri" style="margin-top:10px;width:100%" onclick="soRechnen()">${SO.erg ? 'Neu berechnen' : 'Sonnenstunden berechnen'}</button>`;
  if (SO.st === 'fehler') h += `<div class="dmu" style="color:#b00">Fehler: ${esc(SO.fehler)}</div>`;
  h += '</div>';
  const k = soKennzahlen();
  if (!k || SO.st === 'rechnet') return h;
  const e = SO.erg,
    std = (v) => f1(v, 1) + ' h',
    pr = (v) => Math.round(v * 100) + ' %';
  h += `<div class="card"><b>Ergebnis</b> <span class="dmu">(${e.ds.split('-').reverse().join('.')}, Sonne über dem Horizont ${std(e.tag)}, ${e.dauer} s)</span>`;
  if (k.fassade)
    h += `<div class="kv"><span>Fassaden Planung, Mittel</span><b>${std(k.fassade.mittel)}</b></div><div class="kv"><span>Fassadenfläche ≥ 2 h</span><b>${pr(k.fassade.ab2)}</b></div>`;
  if (k.dach) h += `<div class="kv"><span>Dächer Planung, Mittel</span><b>${std(k.dach.mittel)}</b></div>`;
  if (k.grund)
    h += `<div class="kv"><span>${grund ? 'Grundstück (Freifläche)' : 'Freifläche im Umkreis'}, Mittel</span><b>${std(k.grund.mittel)}</b></div><div class="kv"><span>Freifläche ≥ 4 h</span><b>${pr(k.grund.ab4)}</b></div>`;
  if (!k.fassade && !k.dach)
    h += `<div class="dmu">Noch kein Planungsgebäude – nur der Boden wurde ausgewertet.</div>`;
  h += `<div class="dmu" style="margin-top:6px">Planungshilfe ohne Atmosphäre und Bewölkung (astronomisch mögliche Besonnung). Richtwerte: DIN EN 17037 empfiehlt mindestens 1,5 h am 21. März für einen Aufenthaltsraum.</div></div>`;
  h += `<div class="card"><b>Analysepunkte</b><div class="dmu" style="margin:4px 0 6px">Punkt auf Fassade, Dach oder Boden setzen: genaue Sonnenscheindauer und Zeitfenster am Stichtag.</div><button class="sm ${SO.wahl ? 'on' : ''}" onclick="soWahl()">${SO.wahl ? 'Klick ins Modell … (Esc beendet)' : 'Analysepunkt setzen'}</button>`;
  h += SO.punkte
    .map(
      (q) =>
        `<div style="margin-top:8px;font-size:12px"><div style="display:flex;gap:6px;align-items:center"><b style="flex:1">${q.nr} · ${q.art}</b><b>${q.h == null ? '…' : std(q.h)}</b><button class="sm" title="Punkt entfernen" onclick="soPunktWeg('${q.id}')">×</button></div><div class="dmu">${q.h == null ? 'wird berechnet' : q.fenster.length ? 'besonnt ' + q.fenster.join(', ') : 'keine direkte Sonne'}</div></div>`,
    )
    .join('');
  h += '</div>';
  return h;
}

/** Legende (unten links): Farbskala in Stunden. */
function soLegende() {
  if (!SO.erg || !soSichtbar()) return null;
  const max = SO.erg.tag,
    st = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return {
    t: 'Sonnenstunden (' + SO.erg.ds.split('-').reverse().slice(0, 2).join('.') + '.)',
    r: st.map((v) => ['#' + soFarbe(v, max).getHexString(), f1(v, 1) + ' h']),
  };
}

// ---- Analysepunkte: per Klick auf Fassade, Dach oder Boden; genaue Sonnenscheindauer und besonnte Zeitfenster
function soPunkteVorbereiten(n) {
  return SO.punkte.map((q) => ({ q, an: new Uint8Array(n) }));
}
function soPunkteZaehlen(tief, pp, k, dir) {
  for (const o of pp) {
    const P = Float32Array.from(o.q.p),
      N = o.q.n ? Float32Array.from(o.q.n) : null,
      H = new Float32Array(1);
    soZaehlen(tief, P, H, N, 1, dir);
    o.an[k] = H[0] > 0 ? 1 : 0;
  }
}
function soPunkteAbschliessen(pp, dt) {
  const z = SO.erg.zeiten,
    hm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  for (const o of pp) {
    let h = 0,
      von = -1;
    const fe = [];
    for (let k = 0; k <= o.an.length; k++) {
      if (k < o.an.length && o.an[k]) {
        h += dt;
        if (von < 0) von = z[k];
      } else if (von >= 0) {
        fe.push(hm(von) + '–' + hm(z[k - 1] + SO.erg.schritt));
        von = -1;
      }
    }
    o.q.h = h;
    o.q.fenster = fe;
  }
}
/** Nur die Analysepunkte rechnen (nach dem Setzen eines Punktes), mit den Einstellungen der letzten Berechnung. */
async function soPunkteRechnen() {
  const e = SO.erg;
  if (!e) return;
  const [la, lo] = drLL(),
    zeiten = e.zeiten.map((m) => sunPos(e.ds, (m + e.schritt / 2) / 60, la, lo)),
    pp = soPunkteVorbereiten(zeiten.length);
  for (let k = 0; k < zeiten.length; k++)
    soPunkteZaehlen(soTiefenbild(zeiten[k].dir, e.c, e.R), pp, k, zeiten[k].dir);
  soPunkteAbschliessen(pp, e.schritt / 60);
  soZeichnen();
  rr();
}
/** Klick ins Modell setzt einen Analysepunkt (Treffer auf Planung, Bestand oder Gelände; Normale der Fläche). */
function soWahl() {
  if (!SO.erg) return;
  SO.wahl = !SO.wahl;
  rr();
  if (!SO.wahl) return;
  const el = ren.domElement,
    rc = new T.Raycaster(),
    ende = () => {
      el.removeEventListener('click', klick, true);
      window.removeEventListener('keydown', taste, true);
      SO.wahl = false;
      rr();
    },
    klick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      rc.setFromCamera(
        new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1),
        act(),
      );
      const ziele = [G.terrain, G.ex, ...S.bld.filter((b) => !b.ex && b._g).map((b) => b._g)].filter(Boolean),
        hit = rc.intersectObjects(ziele, true).find((h) => h.object.isMesh && h.face);
      if (!hit) return;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      if (n.dot(rc.ray.direction) > 0) n.negate(); // Normale zur Kamera hin (Innen-/Außenseite)
      const boden =
        n.y > 0.7 && hit.object !== GEO.mesh && !S.bld.some((b) => b._g && hit.object.parent === b._g);
      SO.punkte.push({
        id: 'p' + Date.now().toString(36),
        nr: (SO.punkte.reduce((m, q) => Math.max(m, q.nr), 0) || 0) + 1,
        p: [hit.point.x + n.x * 0.15, hit.point.y + n.y * 0.15, hit.point.z + n.z * 0.15],
        n: boden ? null : [n.x, n.y, n.z],
        art: boden ? 'Boden' : Math.abs(n.y) > 0.7 ? 'Dach' : 'Fassade',
        h: null,
        fenster: [],
      });
      soPunkteRechnen();
    },
    taste = (ev) => {
      if (ev.key === 'Escape') ende();
    };
  el.addEventListener('click', klick, true);
  window.addEventListener('keydown', taste, true);
  SO.wahlEnde = ende;
}
function soPunktWeg(id) {
  SO.punkte = SO.punkte.filter((q) => q.id !== id);
  soZeichnen();
  rr();
}
/** Beschriftung eines Analysepunkts: weißes Schild „Nr · 3,5 h“ (Canvas-Sprite). */
function soPunktSprite(q) {
  const c = document.createElement('canvas'),
    x = c.getContext('2d'),
    t = q.nr + ' · ' + (q.h == null ? '…' : f1(q.h, 1) + ' h');
  x.font = '600 40px system-ui, sans-serif';
  const w = Math.ceil(x.measureText(t).width) + 44;
  c.width = w;
  c.height = 64;
  x.font = '600 40px system-ui, sans-serif';
  x.fillStyle = '#ffffff';
  x.strokeStyle = '#55207a';
  x.lineWidth = 4;
  x.beginPath();
  x.roundRect(2, 2, w - 4, 60, 14);
  x.fill();
  x.stroke();
  x.fillStyle = '#2b1250';
  x.textBaseline = 'middle';
  x.fillText(t, 22, 34);
  const tex = new T.CanvasTexture(c),
    sp = new T.Sprite(
      new T.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false, transparent: true }),
    );
  sp.position.set(q.p[0], q.p[1], q.p[2]);
  sp.center.set(-0.05, -0.2);
  spriteFesteGroesse(sp, 0.03);
  sp.scale.x *= w / 64;
  const k0 = sp.onBeforeRender;
  sp.onBeforeRender = (r, s, cam) => {
    k0(r, s, cam);
    sp.scale.x = sp.scale.y * (w / 64);
  };
  sp.renderOrder = 21;
  sp.raycast = () => {};
  return sp;
}
