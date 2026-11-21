// ======================= VORSPANN beim Start =======================
// Einmal je Sitzung vor der Startseite: Fläche in Schiefernacht, darauf kurze Zeilen oben und unten und das Logo groß
// in der Mitte, Buchstabe für Buchstabe von unten eingeblendet. Unten rechts der echte Ladestand der Karte (GEO.status,
// Prozent). Ist die Karte bereit, öffnet sich die Fläche in zwei Flügeln, das Logo fliegt an seinen Platz auf der
// Startseite (#hLogoSvg). Klick, Taste, Mausrad oder Berührung überspringen; bei „Bewegung reduzieren“ entfällt er.

const VSP = { el: null, fertig: false };

/** Logo (ein Pfad mit Teilpfaden) in Buchstaben zerlegen: [{ d, x0 }] von links nach rechts, Innenformen beim Buchstaben. */
function vspBuchstaben(d) {
  const teile = d
    .split(/(?=M)/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const zs = t.match(/-?\d+(?:\.\d+)?/g).map(Number),
        xs = zs.filter((_, i) => i % 2 === 0);
      return { d: t, x0: Math.min(...xs), x1: Math.max(...xs) };
    })
    .sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0));
  // größte Teilpfade zuerst: Außenformen; kleinere, deren Bereich in einer Außenform liegt, gehören zu ihr
  const B = [];
  teile.forEach((t) => {
    const p = B.find((b) => t.x0 >= b.x0 - 0.5 && t.x1 <= b.x1 + 0.5);
    if (p) p.d += t.d;
    else B.push({ d: t.d, x0: t.x0, x1: t.x1 });
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
    bs = vspBuchstaben(pf.getAttribute('d'));
  const el = document.createElement('div');
  el.id = 'vsp';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="vsp-fl vsp-fl-l"></div><div class="vsp-fl vsp-fl-r"></div>' +
    '<div class="vsp-z vsp-z-o">' +
    '<span>maad<br><i>Planung im Stadtraum</i></span>' +
    '<span>Grundstück, Gebäude, Fassade<br><i>in einem Modell</i></span>' +
    '<span>Sonne, Wind und Abstandsflächen<br><i>direkt am Entwurf geprüft</i></span>' +
    '<span class="vsp-r">Daten<br><i>amtliche Geodaten der Länder</i></span>' +
    '</div>' +
    `<svg class="vsp-logo" viewBox="${vb}">` +
    bs.map((b) => `<path class="vsp-b" fill-rule="evenodd" d="${b.d}"/>`).join('') +
    (pk
      ? `<circle class="vsp-p" cx="${pk.getAttribute('cx')}" cy="${pk.getAttribute('cy')}" r="${pk.getAttribute('r')}"/>`
      : '') +
    '</svg>' +
    '<div class="vsp-z vsp-z-u">' +
    '<span>Vom Flurstück zum Baukörper,<br>von der Fläche zur Fassade.</span>' +
    '<span class="vsp-r"><b data-vsp-st>Karte wird geladen</b><br><i><b data-vsp-pz>000</b> / 100</i></span>' +
    '</div>';
  document.body.appendChild(el);
  VSP.el = el;
  const E = 'cubic-bezier(.45,0,.55,1)',
    A = [],
    an = (n, k, o) => {
      const a = n.animate(k, Object.assign({ fill: 'both', easing: E }, o));
      A.push(a);
      return a;
    },
    zeilen = [...el.querySelectorAll('.vsp-z')],
    logo = el.querySelector('.vsp-logo');
  zeilen.forEach((z) => an(z, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }));
  el.querySelectorAll('.vsp-b').forEach((b, i) =>
    an(
      b,
      [
        { transform: 'translateY(46px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: 420,
        delay: 120 + i * 110,
      },
    ),
  );
  const p = el.querySelector('.vsp-p');
  if (p)
    an(p, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
      duration: 360,
      delay: 120 + bs.length * 110 + 80,
      easing: 'cubic-bezier(.3,1.5,.6,1)',
    });
  const t0 = performance.now(),
    MIN = 2200,
    st = el.querySelector('[data-vsp-st]'),
    pz = el.querySelector('[data-vsp-pz]');
  const takt = () => {
    if (VSP.fertig) return;
    const t = performance.now() - t0,
      bereit = !!HOME.ready,
      // Prozent: Zeit und Ladestand; erst bei bereiter Karte 100
      k = bereit ? Math.min(1, t / MIN) : Math.min(0.92, (t / (MIN * 3)) * 0.92 + (S.geo ? 0.3 : 0));
    pz.textContent = String(Math.round(100 * k)).padStart(3, '0');
    st.textContent = bereit
      ? 'Karte bereit'
      : String(GEO.status || 'Karte wird geladen').replace(/\s*…$/, ' …');
    if (bereit && t >= MIN) {
      vspOeffnen(logo, an, zeilen);
      return;
    }
    if (t > 20000) {
      vspEnde();
      return;
    }
    requestAnimationFrame(takt);
  };
  requestAnimationFrame(takt);
  // überspringen
  const weg = () => {
    A.forEach((a) => a.finish());
    vspEnde();
  };
  VSP.weg = weg;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((n) =>
    addEventListener(n, weg, { capture: true, passive: true, once: true }),
  );
}
/** Karte bereit: Flügel auf, Logo an seinen Platz auf der Startseite, Fläche aus. */
function vspOeffnen(logo, an, zeilen) {
  VSP.fertig = true;
  const el = VSP.el,
    ziel = $('hLogoSvg') && $('hLogoSvg').getBoundingClientRect(),
    q = logo.getBoundingClientRect();
  an(el.querySelector('.vsp-fl-l'), [{ transform: 'none' }, { transform: 'translateX(-100%)' }], {
    duration: 650,
  });
  an(el.querySelector('.vsp-fl-r'), [{ transform: 'none' }, { transform: 'translateX(100%)' }], {
    duration: 650,
  });
  zeilen.forEach((z) => an(z, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }));
  if (ziel && ziel.width > 4) {
    const s = ziel.width / q.width,
      dx = ziel.left - q.left,
      dy = ziel.top - q.top;
    an(logo, [{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0.0 }], {
      duration: 700,
      delay: 250,
      easing: 'cubic-bezier(.65,0,.35,1)',
    });
  } else an(logo, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 250 });
  setTimeout(vspEnde, 980);
}
function vspEnde() {
  VSP.fertig = true;
  const el = VSP.el;
  if (!el) return;
  VSP.el = null;
  el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], {
    duration: 200,
    fill: 'both',
  }).finished.then(
    () => el.remove(),
    () => el.remove(),
  );
}
