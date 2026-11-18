// ======================= RIEGEL: Gebäude als Mittellinie zeichnen =======================
// Zeichenform „Riegel“ (SHP 'rieg', Menü Gebäude/Fläche): Punkte der Mittellinie klicken wie bei der Freiform (gleiche
// Fänge, auch über Eck), Enter/Doppelklick beendet. Der Umriss entsteht aus der Linie in voller Breite (Gehrung an den
// Ecken); als Gebäude sofort mit Geschossen und Geschosshöhe aus dem Panel – derselbe Körper wie über „Gebäude
// erzeugen“. Als Fläche: Band als Fläche (z. B. Weg).
// Ein Riegel merkt sich seine Linie (b.riegel = { pts, w }): Ist er gewählt, zeigt er Mittellinie und Punkte; End- und
// Eckpunkte lassen sich ziehen (Fang wie beim Zeichnen), Breite und Geschosse in der Karte „Riegel“ ändern.

const RG = { el: null, svg: null, zug: null };
// Eingabefelder des Riegels im Zeichen-Panel (leer = Vorgabe)
Object.assign(S.num, { rb: '', rg: '', rh: '', ra: 'm' });
/** Eingaben des Riegels im Panel (mit Vorgaben). */
function rgWerte() {
  const n = (k, d, a, z) => {
    const v = parseFloat(String(S.num[k] ?? '').replace(',', '.'));
    return isFinite(v) ? Math.max(a, Math.min(z, v)) : d;
  };
  return {
    w: n('rb', 12, 2, 60),
    ng: Math.round(n('rg', 4, 1, 40)),
    gh: n('rh', 3, 2, 8),
    au: ['l', 'r'].includes(S.num.ra) ? S.num.ra : 'm',
  };
}
/**
 * Umriss eines Riegels: Linie pts um w/2 nach beiden Seiten versetzt, Gehrung an den Ecken (bei sehr spitzen Winkeln
 * begrenzt). Ergebnis: geschlossener Umriss oder null.
 */
function rgBand(pts, w, au = 'm') {
  const P = pts.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.05);
  if (P.length < 2 || !(w > 0)) return null;
  // Ausrichtung zur Linie: m mittig, l linksbündig (Linie = linke Kante in Zeichenrichtung), r rechtsbündig
  // (Normale m zeigt in Zeichenrichtung nach rechts, da z nach Süden zeigt: linksbündig = Körper auf der m-Seite)
  const hl = au === 'l' ? w : au === 'r' ? 0 : w / 2,
    hr = w - hl,
    n = P.length,
    L = [],
    R = [],
    nrm = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    };
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? nrm(P[i - 1], P[i]) : null,
      n1 = i < n - 1 ? nrm(P[i], P[i + 1]) : null;
    let m;
    if (!n0) m = n1;
    else if (!n1) m = n0;
    else {
      const s = [n0[0] + n1[0], n0[1] + n1[1]],
        sl = Math.hypot(...s) || 1,
        c = Math.max(0.25, (s[0] * n1[0] + s[1] * n1[1]) / sl);
      m = [s[0] / sl / c, s[1] / sl / c];
    }
    L.push([P[i][0] + m[0] * hl, P[i][1] + m[1] * hl]);
    R.push([P[i][0] - m[0] * hr, P[i][1] - m[1] * hr]);
  }
  return L.concat(R.reverse());
}
/** Zeichnen beenden: aus der Mittellinie Gebäude (bzw. Fläche) erzeugen. */
function rgFertig() {
  const P = S.draft.filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.3);
  const W = rgWerte(),
    fp = rgBand(P, W.w, W.au);
  if (!fp || area(fp) < 1) {
    szMsg('Riegel: mindestens zwei Punkte der Mittellinie klicken');
    return;
  }
  if (S.dm === 'area') {
    finish(fp);
    return;
  }
  hist();
  const b = {
    id: 'building_' + String(S.n).padStart(3, '0'),
    name: 'Riegel ' + S.n,
    use: S.uses && 'Wohnen' in S.uses ? 'Wohnen' : Object.keys(S.uses || { Wohnen: 1 })[0],
    kind: 'riegel',
    type: 'residential',
    fp,
    ref: S.refH != null ? S.refH : gh(P[0][0], P[0][1]),
    levels: Array.from({ length: W.ng }, (_, i) => ({ name: i ? i + '.OG' : 'EG', h: W.gh })),
    roof: mkRoof(),
    riegel: { pts: P.map((q) => q.slice()), w: W.w, au: W.au },
  };
  S.n++;
  S.bld.push(b);
  mesh(b);
  cancel();
  tool('v');
  S.sel = b;
  S.selF = null;
  H();
  hpos();
  drawOv();
  rr();
  szMsg('Riegel erzeugt · Punkte der Mittellinie ziehen = ändern');
}
/** Riegel neu aufbauen (nach Ziehen eines Punkts oder geänderter Breite/Geschosse). */
function rgNeu(b) {
  const fp = rgBand(b.riegel.pts, b.riegel.w, b.riegel.au);
  if (!fp) return;
  b.fp = fp;
  b.levels.forEach((l) => {
    if (l.fp) l.fp = fp.map((q) => q.slice());
  });
  b._rgSig = JSON.stringify(b.fp);
  mesh(b);
  H();
}
/** Karte „Riegel“ im Gebäudepanel: Breite, Geschosse, Geschosshöhe. */
function rgCard(b) {
  if (!b || !rgAbgleich(b)) return '';
  const h = b.levels.length ? b.levels[b.levels.length - 1].h : 3;
  return `<h4>Riegel</h4><div class="card"><div class="okg" style="display:grid;grid-template-columns:1fr 90px;gap:6px;align-items:center"><span>Breite (m)</span><input type="number" step="0.1" value="${+b.riegel.w.toFixed(2)}" onchange="rgSetze('w',this.value)"><span>Geschosse</span><input type="number" step="1" min="1" value="${b.levels.length}" onchange="rgSetze('ng',this.value)"><span>Geschosshöhe (m)</span><input type="number" step="0.05" value="${+(+h).toFixed(2)}" onchange="rgSetze('gh',this.value)"><span>Ausrichtung zur Linie</span>${rgAusrWahl(b.riegel.au || 'm', "rgSetze('au',this.value)")}</div><div class="mu" style="margin-top:6px">Mittellinie im Modell: End- und Eckpunkte ziehen (Fang wie beim Zeichnen, Shift = frei).</div></div>`;
}
/** Auswahl der Ausrichtung (mittig, linksbündig, rechtsbündig). */
function rgAusrWahl(cur, fn) {
  return `<select onchange="${fn}" title="Lage des Körpers zur gezeichneten Linie (links/rechts in Zeichenrichtung)">${[
    ['m', 'mittig'],
    ['l', 'linksbündig'],
    ['r', 'rechtsbündig'],
  ]
    .map(([k, n]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${n}</option>`)
    .join('')}</select>`;
}
function rgSetze(k, v) {
  const b = S.sel;
  if (!b || !b.riegel) return;
  if (k === 'au') {
    hist();
    b.riegel.au = ['l', 'r'].includes(v) ? v : 'm';
    rgNeu(b);
    hpos();
    rr();
    return;
  }
  const n = parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n)) return;
  hist();
  if (k === 'w') b.riegel.w = Math.max(2, Math.min(60, n));
  if (k === 'gh') b.levels.forEach((l) => (l.h = Math.max(2, Math.min(8, n))));
  if (k === 'ng') {
    const z = Math.max(1, Math.min(40, Math.round(n))),
      h0 = b.levels.length ? b.levels[b.levels.length - 1].h : 3;
    while (b.levels.length < z) b.levels.push({ name: b.levels.length + '.OG', h: h0 });
    b.levels.length = z;
  }
  rgNeu(b);
  hpos();
  rr();
}
/**
 * Linie und Umriss abgleichen: wurde der Riegel mit anderen Werkzeugen verschoben oder gedreht, die Linie mitnehmen
 * (Drehung und Verschiebung aus dem Umriss bestimmt); wurde der Umriss anders verändert (Modellieren), löst sich die
 * Linie (b.riegel entfernt) – der Körper bleibt ein normales Gebäude. Rückgabe: true, wenn die Linie gilt.
 */
function rgAbgleich(b) {
  if (!b || !b.riegel) return false;
  const sig = JSON.stringify(b.fp);
  if (b._rgSig === sig) return true;
  const A = rgBand(b.riegel.pts, b.riegel.w, b.riegel.au),
    B = b.fp,
    passt = (X) =>
      X && X.length === B.length && X.every((p, i) => Math.hypot(p[0] - B[i][0], p[1] - B[i][1]) < 0.05);
  if (!A || A.length !== B.length) {
    delete b.riegel;
    return false;
  }
  if (!passt(A)) {
    // Drehung + Verschiebung (kleinste Quadrate) vom berechneten auf den tatsächlichen Umriss
    const c = (P) => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]),
      ca = c(A),
      cb = c(B);
    let sx = 0,
      sy = 0;
    A.forEach((p, i) => {
      const ax = p[0] - ca[0],
        ay = p[1] - ca[1],
        bx = B[i][0] - cb[0],
        by = B[i][1] - cb[1];
      sx += ax * bx + ay * by;
      sy += ax * by - ay * bx;
    });
    const th = Math.atan2(sy, sx),
      co = Math.cos(th),
      si = Math.sin(th),
      tr = (p) => {
        const x = p[0] - ca[0],
          y = p[1] - ca[1];
        return [cb[0] + x * co - y * si, cb[1] + x * si + y * co];
      };
    if (!passt(A.map(tr))) {
      delete b.riegel;
      return false;
    }
    b.riegel.pts = b.riegel.pts.map(tr);
  }
  b._rgSig = sig;
  return true;
}
// ---- Mittellinie und Punkte des gewählten Riegels (Bildschirm-Ebene über der 3D-Ansicht)
function rgInit() {
  const mid = document.getElementById('mid');
  if (!mid || RG.el) return;
  const d = document.createElement('div');
  d.id = 'rgLinie';
  d.innerHTML = '<svg aria-hidden="true"><polyline/></svg>';
  mid.appendChild(d);
  RG.el = d;
  RG.svg = d.querySelector('svg');
  d.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.rgp');
    if (!t) return;
    const b = S.sel;
    if (!b || !rgAbgleich(b)) return;
    e.stopPropagation();
    e.preventDefault();
    hist();
    RG.zug = { b, i: +t.dataset.i, mv: 0 };
    t.setPointerCapture(e.pointerId);
  });
  d.addEventListener('pointermove', (e) => {
    const z = RG.zug;
    if (!z) return;
    const g = ground(e);
    if (!g) return;
    // Fang wie beim Zeichnen (auf die übrigen Punkte der Linie und die Umgebung), Shift = frei
    const andere = z.b.riegel.pts.filter((_, k) => k !== z.i),
      q = e.shiftKey ? g : snap(g, e, null, andere).p;
    z.b.riegel.pts[z.i] = [q[0], q[1]];
    z.mv = 1;
    rgNeu(z.b);
    $('hud').textContent = 'Riegel: Punkt ' + (z.i + 1) + ' verschieben · Shift = frei';
  });
  d.addEventListener('pointerup', () => {
    const z = RG.zug;
    RG.zug = null;
    if (!z) return;
    if (!z.mv) S.hist.pop();
    hpos();
    drawOv();
    rr();
  });
  rgTakt();
}
/** Linie und Griffpunkte nachführen (nur gewählter Riegel, Auswahl-Werkzeug). */
function rgTakt() {
  try {
    const b = S.sel,
      an = !!(
        b &&
        b.riegel &&
        S.bld.includes(b) &&
        S.tool === 'v' &&
        !(typeof HOME !== 'undefined' && HOME.open)
      );
    RG.el.style.display = an ? '' : 'none';
    if (an) {
      const cm = S.m3 ? pc : oc,
        r = ren.domElement.getBoundingClientRect(),
        m = document.getElementById('mid').getBoundingClientRect(),
        y = (b._y != null ? b._y : gh(b.riegel.pts[0][0], b.riegel.pts[0][1])) + (b._h || 0) + 0.2,
        v = new T.Vector3(),
        S2 = b.riegel.pts.map((q) => {
          v.set(q[0], y, q[1]).project(cm);
          return [r.left - m.left + ((v.x + 1) / 2) * r.width, r.top - m.top + ((1 - v.y) / 2) * r.height];
        });
      RG.svg.querySelector('polyline').setAttribute('points', S2.map((p) => p.join(',')).join(' '));
      let pk = RG.el.querySelectorAll('.rgp');
      if (pk.length !== S2.length) {
        RG.el.querySelectorAll('.rgp').forEach((x) => x.remove());
        S2.forEach((_, i) => {
          const p = document.createElement('button');
          p.type = 'button';
          p.className = 'rgp';
          p.dataset.i = i;
          p.title = i === 0 || i === S2.length - 1 ? 'Endpunkt ziehen' : 'Eckpunkt ziehen';
          p.setAttribute('aria-label', p.title);
          RG.el.appendChild(p);
        });
        pk = RG.el.querySelectorAll('.rgp');
      }
      pk.forEach((p, i) => {
        p.style.transform = `translate(${S2[i][0] - 6}px,${S2[i][1] - 6}px)`;
      });
    }
  } catch (e) {
    logErr(e, 'rgTakt');
  }
  requestAnimationFrame(rgTakt);
}
