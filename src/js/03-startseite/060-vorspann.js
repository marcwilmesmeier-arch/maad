// ======================= VORSPANN beim Start =======================
// Einmal je Sitzung vor der Startseite: hellblaue Fläche (maad-Blau), darauf fliegen die Buchstaben als schwarze
// Rechtecke ins Bild und werden zu den Buchstaben von „maad“, der Punkt fällt zuletzt von oben dazu. Dann zieht sich
// die Fläche zur Karte hinter dem Schriftzug zusammen und alles verkleinert sich auf das Logo der Startseite (#hLogo
// über dem Testgebiet). Ist die Karte noch nicht bereit, wartet der Schriftzug in der Mitte mit einer Ladezeile.
// Klick, Taste, Mausrad oder Berührung überspringen; bei „Bewegung reduzieren“ entfällt er.

const VSP = { el: null, fertig: false };

/** Logo (ein Pfad mit Teilpfaden) in Buchstaben zerlegen: [{ d, x0, x1, y0, y1 }], Innenformen beim Buchstaben. */
function vspBuchstaben(d) {
  const teile = d
    .split(/(?=M)/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const zs = t.match(/-?\d+(?:\.\d+)?/g).map(Number),
        xs = zs.filter((_, i) => i % 2 === 0),
        ys = zs.filter((_, i) => i % 2 === 1);
      return { d: t, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    })
    .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0));
  // größte Teilpfade zuerst: Außenformen; kleinere, deren Bereich in einer Außenform liegt, gehören zu ihr
  const B = [];
  teile.forEach((t) => {
    const p = B.find((b) => t.x0 >= b.x0 - 0.5 && t.x1 <= b.x1 + 0.5);
    if (p) p.d += t.d;
    else B.push({ ...t });
  });
  return B.sort((a, b) => a.x0 - b.x0);
}

function vspStart() {
  let gesehen = false;
  try {
    gesehen = sessionStorage.getItem('maad-vorspann') === '1';
  } catch (e) {
    logErr(e, 'vspStart');
  }
  const ruhig = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (gesehen || ruhig || !('animate' in Element.prototype)) return;
  try {
    sessionStorage.setItem('maad-vorspann', '1');
  } catch (e) {
    logErr(e, 'vspStart');
  }
  const svg = $('logo') && $('logo').querySelector('svg');
  if (!svg) return;
  const pf = svg.querySelector('path'),
    pk = svg.querySelector('circle'),
    vb = svg.getAttribute('viewBox'),
    bs = vspBuchstaben(pf.getAttribute('d')),
    el = document.createElement('div');
  el.id = 'vsp';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="vsp-bg"></div>' +
    `<svg class="vsp-logo" viewBox="${vb}" overflow="visible">` +
    bs
      .map(
        (b) =>
          `<rect class="vsp-q" x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}"/>` +
          `<path class="vsp-b" fill-rule="evenodd" d="${b.d}"/>`,
      )
      .join('') +
    (pk
      ? `<circle class="vsp-p" cx="${pk.getAttribute('cx')}" cy="${pk.getAttribute('cy')}" r="${pk.getAttribute('r')}"/>`
      : '') +
    '</svg>' +
    '<div class="vsp-st" data-vsp-st></div>';
  document.body.appendChild(el);
  VSP.el = el;
  VSP.fertig = false;
  const A = [],
    an = (n, k, o) => {
      const a = n.animate(k, Object.assign({ fill: 'both', easing: 'cubic-bezier(.45,0,.55,1)' }, o));
      A.push(a);
      return a;
    },
    qs = [...el.querySelectorAll('.vsp-q')],
    gs = [...el.querySelectorAll('.vsp-b')],
    // Herkunft der Rechtecke: abwechselnd von links, oben, unten, rechts
    her = ['translate(-70vw,0)', 'translate(0,-60vh)', 'translate(0,60vh)', 'translate(70vw,0)'],
    flug = 560,
    takt = 130,
    t1 = 150 + (qs.length - 1) * takt + flug; // alle Rechtecke angekommen
  qs.forEach((q, i) => {
    an(
      q,
      [{ transform: her[i % her.length] + ' rotate(' + (i % 2 ? 8 : -8) + 'deg)' }, { transform: 'none' }],
      {
        duration: flug,
        delay: 150 + i * takt,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      },
    );
    // Rechteck wird zum Buchstaben: es rundet sich, zieht sich etwas zusammen und blendet in die Buchstabenform über
    an(
      q,
      [
        { rx: 0, opacity: 1, transform: 'none' },
        { rx: 40, opacity: 0, transform: 'scale(.86)' },
      ],
      // nur vorwärts füllen: sonst überdeckte sie während der Wartezeit den Anflug
      { duration: 420, delay: t1 + 60 + i * 70, fill: 'forwards' },
    );
  });
  gs.forEach((g, i) =>
    an(
      g,
      [
        { opacity: 0, transform: 'scale(1.12,0.9)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 420,
        delay: t1 + 60 + i * 70,
        easing: 'cubic-bezier(.3,1.25,.5,1)',
      },
    ),
  );
  const p = el.querySelector('.vsp-p'),
    t2 = t1 + 60 + (gs.length - 1) * 70 + 420; // alle Buchstaben fertig
  if (p)
    an(
      p,
      [
        { transform: 'translateY(-75vh)', offset: 0 },
        { transform: 'translateY(0)', offset: 0.62, easing: 'cubic-bezier(.3,0,.5,1)' },
        { transform: 'translateY(-14%) scale(1.05,.92)', offset: 0.8 },
        { transform: 'none', offset: 1 },
      ],
      { duration: 640, delay: t2 + 40, easing: 'cubic-bezier(.55,0,1,.45)' },
    );
  const t0 = performance.now(),
    MIN = t2 + 760,
    st = el.querySelector('[data-vsp-st]');
  const schritt = () => {
    if (VSP.fertig) return;
    const t = performance.now() - t0;
    if (HOME.ready && t >= MIN) {
      vspZusammen(an);
      return;
    }
    // Karte noch nicht bereit: Ladezeile unter dem Schriftzug
    if (t >= MIN) st.textContent = String(GEO.status || 'Karte wird geladen …');
    if (t > 25000) {
      vspEnde();
      return;
    }
    requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
  const weg = () => {
    A.forEach((a) => a.finish());
    vspEnde();
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((n) =>
    addEventListener(n, weg, { capture: true, passive: true, once: true }),
  );
}
/** Fläche zur Karte hinter dem Schriftzug, dann alles auf das Logo der Startseite verkleinern. */
function vspZusammen(an) {
  VSP.fertig = true;
  const el = VSP.el,
    bg = el.querySelector('.vsp-bg'),
    logo = el.querySelector('.vsp-logo'),
    st = el.querySelector('.vsp-st'),
    karte = $('hLogo') && $('hLogo').getBoundingClientRect(),
    ziel = $('hLogoSvg') && $('hLogoSvg').getBoundingClientRect(),
    q = logo.getBoundingClientRect(),
    W = innerWidth,
    H = innerHeight,
    E = 'cubic-bezier(.65,0,.35,1)';
  st.textContent = '';
  if (!karte || !ziel || karte.width < 4) {
    vspEnde();
    return;
  }
  // 1. Fläche zur Karte um den großen Schriftzug (gleiche Ränder im Verhältnis wie auf der Startseite)
  const k = q.width / ziel.width,
    m = {
      w: karte.width * k,
      h: karte.height * k,
    },
    mitte = { x: q.left + q.width / 2, y: q.top + q.height / 2 },
    zx = ziel.left + ziel.width / 2 - (karte.left + karte.width / 2),
    zy = ziel.top + ziel.height / 2 - (karte.top + karte.height / 2),
    gross = {
      left: mitte.x - m.w / 2 - zx * k + 'px',
      top: mitte.y - m.h / 2 - zy * k + 'px',
      width: m.w + 'px',
      height: m.h + 'px',
      borderRadius: 34 * k + 'px',
    };
  an(
    bg,
    [
      {
        left: '0px',
        top: '0px',
        width: W + 'px',
        height: H + 'px',
        borderRadius: '0px',
        background: '#d3e0e8',
      },
      Object.assign({ background: '#e4ebef' }, gross),
    ],
    { duration: 700, easing: E },
  );
  // 2. alles auf das Logo der Startseite
  an(
    bg,
    [
      Object.assign({ background: '#e4ebef' }, gross),
      {
        left: karte.left + 'px',
        top: karte.top + 'px',
        width: karte.width + 'px',
        height: karte.height + 'px',
        borderRadius: '34px',
        background: '#e9edef',
      },
    ],
    { duration: 750, delay: 820, easing: E, fill: 'forwards' },
  );
  an(
    logo,
    [
      { transform: 'none' },
      { transform: `translate(${ziel.left - q.left}px,${ziel.top - q.top}px) scale(${1 / k})` },
    ],
    { duration: 750, delay: 820, easing: E },
  );
  setTimeout(vspEnde, 1600);
}
function vspEnde() {
  VSP.fertig = true;
  const el = VSP.el;
  if (!el) return;
  VSP.el = null;
  el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], {
    duration: 240,
    fill: 'both',
  }).finished.then(
    () => el.remove(),
    () => el.remove(),
  );
}
