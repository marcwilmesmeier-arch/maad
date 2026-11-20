/* Metriken: einzelne Körper der Auswertung (Hervorhebung aus den Metriken: Geschosskörper BGF/BRI, Flächen, NGF, BRI,
   Sonderfall S) im Modell anklicken. Der gewählte Körper bekommt einen orangen Rahmen und als Beschriftung die Angaben
   zu seiner Fläche bzw. seinem Rauminhalt (statt Zahlen an allen Körpern). Rahmen und Beschriftung hängen am Körper
   und gehen in der Explosionsansicht mit. Klick aus 05-…/030-mini.js (pointerup), Beschriftung über dimLabels
   (01-…/030-wandflaechen.js). */
const MZ = { sel: null, ln: null };

/** Körper, die gewählt werden können (sichtbar): Hervorhebung der Metriken (S.hlG) und LOD-200-Körper (G.l2n). */
function mzKoerper() {
  const L = [];
  const nimm = (g) =>
    g &&
    g.visible &&
    g.children.forEach((m) => m.isMesh && m.visible && !(m.userData && m.userData._hlo) && L.push(m));
  nimm(S.hlG);
  nimm(G.l2n);
  return L;
}
/** Getroffener Körper der Auswertung unter dem Zeiger (oder null). */
function mzTreffer(e) {
  const K = mzKoerper();
  if (!K.length) return null;
  ray(e);
  const hits = [];
  K.forEach((m) => T.Mesh.prototype.raycast.call(m, rc, hits)); // eigene raycast-Funktionen sind abgeschaltet
  hits.sort((a, c) => a.distance - c.distance);
  return hits.length ? hits[0].object : null;
}
/** Klick ins Modell: Körper der Auswertung treffen und wählen (nochmal = aufheben). true = Klick verbraucht. */
function mzKlick(e) {
  const m = mzTreffer(e);
  if (!m) {
    const war = !!MZ.sel;
    mzWahl(null);
    return war;
  }
  mzWahl(m === MZ.sel ? null : m);
  return true;
}
/** Körper m wählen (null = aufheben): oranger Rahmen als Kind des Körpers (folgt der Explosion). */
function mzWahl(m) {
  if (MZ.ln) {
    MZ.ln.parent && MZ.ln.parent.remove(MZ.ln);
    MZ.ln.geometry.dispose();
    MZ.ln.material.dispose();
    MZ.ln = null;
  }
  MZ.sel = m || null;
  if (m) {
    const ln = new T.LineSegments(
      new T.EdgesGeometry(m.geometry, 25),
      new T.LineBasicMaterial({ color: 0xf07a12, depthTest: false, transparent: true }),
    );
    ln.renderOrder = 15;
    ln.raycast = () => {};
    m.add(ln);
    MZ.ln = ln;
  }
  try {
    neuZeichnen();
  } catch (e) {
    logErr(e, 'mzWahl');
  }
}
/** Liegt der gewählte Körper noch in der Szene (nach einem Neuaufbau der Hervorhebung nicht mehr)? */
function mzGueltig() {
  let o = MZ.sel;
  while (o && o !== sc) o = o.parent;
  if (!o) {
    MZ.sel = null;
    MZ.ln = null;
  }
  return !!MZ.sel;
}
/** Oberfläche eines Körpers (m², Summe der Dreiecke). */
function mzOberflaeche(g) {
  const p = g.getAttribute('position'),
    ix = g.index;
  if (!p) return 0;
  const n = ix ? ix.count : p.count,
    v = (i) => new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i) : i);
  let a = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const A = v(i),
      B = v(i + 1),
      C = v(i + 2);
    a += B.sub(A).cross(C.sub(A)).length() / 2;
  }
  return a;
}
/** Angaben zum gewählten Körper: aus userData.info (LOD-200-Körper) oder aus Geschoss und Auswertung (S.hlk). */
function mzInfo(m) {
  const u = m.userData || {};
  if (u.info) return u.info;
  const b = S.bld.find((x) => x.id === u.bid),
    k = S.hlk;
  if (!b) return '';
  const vol = k === 'brioi' || k === 'briui' || k === 'bri',
    flaeche = k === 'bgfoi' || k === 'bgfui' || k === 'bgf';
  if (u.k === 'roof') {
    const ra = b._roofA || {};
    if (vol) return 'Dachraum · ' + f1(ra.vol || 0, 1) + ' m³';
    if (flaeche) return 'Dachgeschoss · ' + f1(ra.wf || 0, 1) + ' m²';
  } else if (typeof u.k === 'number' && b.levels[u.k] && (vol || flaeche)) {
    const l = b.levels[u.k],
      a = larea(b, l);
    return lname(b, u.k) + ' · ' + (vol ? f1(a * l.h, 1) + ' m³' : f1(a, 1) + ' m²');
  }
  const n = typeof u.k === 'number' ? lname(b, u.k) + ' · ' : '';
  return n + f1(mzOberflaeche(m.geometry), 1) + ' m²';
}
/** Beschriftung des gewählten Körpers (für dimLabels): Mitte des Körpers in Weltkoordinaten. */
function mzLabel() {
  if (!mzGueltig()) return null;
  const m = MZ.sel;
  m.geometry.computeBoundingBox();
  const p = m.geometry.boundingBox.getCenter(new T.Vector3());
  m.updateMatrixWorld();
  p.applyMatrix4(m.matrixWorld);
  return { p, t: mzInfo(m), mz: 1 };
}
// Klick abfangen, bevor Modellieren (26-…/020-darstellung.js) oder Bearbeiten ihn nutzen: nur wenn ein Körper der
// Auswertung getroffen ist (sonst normal weiter, eine bestehende Wahl wird aufgehoben)
addEventListener(
  'pointerdown',
  (e) => {
    try {
      MZ.down = null;
      if (e.target !== cv || e.button !== 0 || ['f', 'L', 't', 'm'].includes(S.tool)) return;
      if (mzTreffer(e)) {
        MZ.down = { x: e.clientX, y: e.clientY };
        e.stopImmediatePropagation();
        return;
      }
      if (MZ.sel) mzWahl(null);
    } catch (x) {
      logErr(x, 'mz down');
    }
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    // Ziehen (Kamera drehen) bleibt erlaubt: erst ab 5 px ist es kein Klick mehr
    if (MZ.down && Math.hypot(e.clientX - MZ.down.x, e.clientY - MZ.down.y) > 5) MZ.down = null;
  },
  true,
);
addEventListener(
  'pointerup',
  (e) => {
    try {
      if (!MZ.down) return;
      MZ.down = null;
      e.stopImmediatePropagation();
      mzKlick(e);
    } catch (x) {
      logErr(x, 'mz up');
    }
  },
  true,
);
