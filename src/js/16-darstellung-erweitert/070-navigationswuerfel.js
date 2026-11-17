/* Navigationswürfel (wie in Revit) unten rechts in der 3D-Ansicht: heller Würfel mit Seiten Oben/Nord/Ost/Süd/West,
   darunter ein Kompassring (N O S W), der sich mit der Kamera dreht. Klick auf eine Seite = Ansicht von dort,
   Klick auf Kante oder Ecke = Schrägansicht dazwischen, Klick auf einen Kompassbuchstaben = Blick aus dieser
   Himmelsrichtung (Neigung bleibt), Ziehen am Würfel = drehen. Als CSS-3D-Würfel umgesetzt (scharf, ohne eigenes WebGL).
   Kamera (05-…/010-projekt.js camBasis): V.az = Richtung der Kamera um das Ziel (0 = von Süden, π/2 = von Osten),
   V.pol = Winkel zur Senkrechten (0 = von oben). */
const NW = { el: null, cube: null, az: null, pol: null, zug: null };
const NW_S = 40; // Kantenlänge in px
/** Blickrichtung (Kamera-Azimut) für Seiten und Kompass. */
const NW_AZ = { S: 0, O: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };
function nwInit() {
  if (NW.el) return;
  const mid = document.getElementById('mid');
  if (!mid) return;
  const h = NW_S / 2,
    // Seite: Name, Transformation, Ansicht { az, pol }
    seiten = [
      // Beschriftung wie Revit: fette Anfangsbuchstaben (Oben, Vorne = Süd, Rechts = Ost, Hinten = Nord, Links = West)
      ['O', `rotateX(90deg) translateZ(${h}px)`, 'o', 'Oben'],
      ['V', `translateZ(${h}px)`, 'S', 'Vorne (Süd)'],
      ['R', `rotateY(90deg) translateZ(${h}px)`, 'O', 'Rechts (Ost)'],
      ['H', `rotateY(180deg) translateZ(${h}px)`, 'N', 'Hinten (Nord)'],
      ['L', `rotateY(-90deg) translateZ(${h}px)`, 'W', 'Links (West)'],
    ],
    kompass = ['N', 'O', 'S', 'W'];
  const d = document.createElement('div');
  d.id = 'nwuerfel';
  d.setAttribute('role', 'group');
  d.setAttribute('aria-label', 'Navigationswürfel');
  d.innerHTML =
    '<div class="nwb">' +
    `<div class="nwring" style="transform:rotateX(90deg) translateZ(${-h}px)"></div>` +
    seiten
      .map(
        ([n, tr, k, lang]) =>
          `<button type="button" class="nwf" data-k="${k}" style="transform:${tr}" aria-label="Ansicht ${lang}" title="${lang}">${n}</button>`,
      )
      .join('') +
    '</div>' +
    // Kompass: aufrechte Buchstaben an der projizierten Stelle des Rings (nwTakt)
    kompass
      .map(
        (k) =>
          `<button type="button" class="nwk" data-k="${k}" aria-label="Blick von ${{ N: 'Norden', O: 'Osten', S: 'Süden', W: 'Westen' }[k]}">${k}</button>`,
      )
      .join('');
  mid.appendChild(d);
  NW.el = d;
  NW.cube = d.querySelector('.nwb');
  // Ziehen dreht, kurzer Klick wählt (Seite: Rand = Kante/Ecke)
  d.addEventListener('pointerdown', (e) => {
    // Ziel schon beim Drücken merken: mit setPointerCapture zeigt pointerup auf den Rahmen
    NW.zug = { x: e.clientX, y: e.clientY, az: V.az, pol: V.pol, mv: 0, t: e.target.closest('[data-k]') };
    d.setPointerCapture(e.pointerId);
    S.vanim = null;
    e.stopPropagation();
  });
  d.addEventListener('pointermove', (e) => {
    const z = NW.zug;
    if (!z) return;
    const dx = e.clientX - z.x,
      dy = e.clientY - z.y;
    if (Math.hypot(dx, dy) > 3) z.mv = 1;
    if (!z.mv) return;
    V.az = z.az - dx * 0.012;
    V.pol = Math.max(0.02, Math.min(1.55, z.pol - dy * 0.01));
    cam();
  });
  d.addEventListener('pointerup', (e) => {
    const z = NW.zug;
    NW.zug = null;
    if (!z || z.mv) return;
    const t = z.t;
    if (!t) return;
    if (t.classList.contains('nwk')) nwFahrt(NW_AZ[t.dataset.k], V.pol);
    else nwSeite(t, e);
  });
  d.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[data-k]');
    if (!t) return;
    e.preventDefault();
    if (t.classList.contains('nwk')) nwFahrt(NW_AZ[t.dataset.k], V.pol);
    else nwSeite(t, null);
  });
  nwTakt();
}
/** Klick auf eine Seite: Mitte = Ansicht der Seite, Rand (äußeres Viertel) = Kante bzw. Ecke dazu. */
function nwSeite(t, e) {
  const k = t.dataset.k;
  let rx = 0,
    ry = 0;
  if (e) {
    const r = t.getBoundingClientRect(),
      u = (e.clientX - r.left) / r.width,
      v = (e.clientY - r.top) / r.height;
    rx = u < 0.25 ? -1 : u > 0.75 ? 1 : 0;
    ry = v < 0.25 ? -1 : v > 0.75 ? 1 : 0;
  }
  if (k === 'o') {
    // Oben: Rand = Schrägansicht von der Seite (oben im Bild liegt die Seite, auf die der Würfel gerade blickt)
    if (!rx && !ry) return nwFahrt(V.az, 0.02);
    const az = V.az + Math.atan2(rx, ry) + (ry || rx ? 0 : 0);
    return nwFahrt(az, rx && ry ? 0.95 : 0.8);
  }
  const az0 = NW_AZ[k];
  // Seite: oben = Kante zum Dach (schräg von oben), links/rechts = Kante zur Nachbarseite
  const az = az0 - rx * (Math.PI / 4),
    pol = ry < 0 ? 0.95 : Math.PI / 2 - 0.04;
  nwFahrt(az, rx && !ry ? Math.PI / 2 - 0.04 : pol);
}
/** Kamerafahrt zu Azimut az und Neigung pol (kürzester Weg). */
function nwFahrt(az, pol) {
  if (!S.m3) return;
  const d = ((((az - V.az + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: { tx: V.tx, tz: V.tz, d: V.d, az: V.az + d, pol: Math.max(0.02, Math.min(1.55, pol)), rot: V.rot },
    t0: performance.now(),
    dur: 650,
  };
}
/** Würfel der Kamera nachführen (nur bei Änderung) und nur in der 3D-Ansicht zeigen. */
function nwTakt() {
  try {
    const an = !!S.m3 && !(typeof HOME !== 'undefined' && HOME.open);
    if (NW.el) NW.el.style.display = an ? '' : 'none';
    if (an && (V.az !== NW.az || V.pol !== NW.pol)) {
      NW.az = V.az;
      NW.pol = V.pol;
      // Kamera um az gedreht und um (90° − pol) über dem Horizont: Würfel entgegengesetzt drehen
      const al = -(Math.PI / 2 - V.pol),
        be = -V.az;
      NW.cube.style.transform = `rotateX(${(al * 180) / Math.PI}deg) rotateY(${(be * 180) / Math.PI}deg)`;
      // Kompassbuchstaben: Punkt auf dem Ring (Boden des Würfels) wie der Würfel drehen, aufrecht daneben setzen
      const r = NW_S * 0.95,
        y = NW_S / 2,
        P = { N: [0, -r], O: [r, 0], S: [0, r], W: [-r, 0] };
      NW.el.querySelectorAll('.nwk').forEach((b) => {
        const [x, z] = P[b.dataset.k],
          x1 = x * Math.cos(be) + z * Math.sin(be),
          z1 = -x * Math.sin(be) + z * Math.cos(be),
          y2 = y * Math.cos(al) - z1 * Math.sin(al),
          z2 = y * Math.sin(al) + z1 * Math.cos(al);
        b.style.transform = `translate(${x1.toFixed(1)}px,${y2.toFixed(1)}px)`;
        b.style.opacity = z2 < -4 ? '0.45' : '1';
      });
    }
  } catch (e) {
    logErr(e, 'nwTakt');
  }
  requestAnimationFrame(nwTakt);
}
