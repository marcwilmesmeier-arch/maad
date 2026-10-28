/* v470 Grundflächen zeichnen nach dem Vorbild der Hilfe: Linie (geschlossener Zug = Fläche), Rechteck (2 Klicks gegenüberliegende Ecken, Länge;Breite tippen),
   Kreis (Mittelpunkt, Radius), Polygon (Mittelpunkt, Radius, Seitenzahl tippen, z. B. 8s). Die Fanglinien/Einrastungen sind die bisherigen.
   Die gezeichnete Fläche wird mit Ziehen & Schieben (P) nach oben zum Gebäude (Anzahl Geschosse). */
S.sides = 6;
const GDM = { r: 'rect', z: 'free', c: 'circ', o: 'poly' };
SKT.push(['c', 'Kreis', 'C'], ['o', 'Polygon', 'O']);
function gdEnter(t) {
  try {
    setShape(GDM[t], 'bld');
  } catch (e) {
    console.warn('gdEnter', e);
  }
}
// ---- getippte Werte beim Zeichnen
const GV = { buf: '', cur: null };
function gdShow() {
  try {
    const s = GV.buf;
    let t = '';
    if (S.shape === 'rect') t = 'Länge;Breite: ' + (s || '…');
    else if (S.shape === 'circ') t = 'Radius: ' + (s || '…');
    else if (S.shape === 'poly')
      t = 'Radius oder Seiten (z. B. 8s): ' + (s || '…') + ' · ' + S.sides + ' Seiten';
    else t = 'Länge: ' + (s || '…');
    $('hud').textContent = 'Eingabe · ' + t + ' · Enter = übernehmen · Esc = abbrechen';
  } catch (e) {
    logErr(e, 'gdShow');
  }
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (S.tool === 'f' && S.dm === 'bld' && !S.closed) {
        const g = ground(e);
        if (g) GV.cur = g;
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
function gdNum(s) {
  return parseFloat(String(s).replace(',', '.'));
}
function gdEnterVal() {
  const s = GV.buf.trim();
  if (!s) return false;
  const A = S.anchor,
    cur = GV.cur;
  if (S.shape === 'poly' && /s$/i.test(s)) {
    const n = Math.round(gdNum(s));
    if (n >= 3 && n <= 64) {
      S.sides = n;
      GV.buf = '';
      if (cur) shapeUpd(cur);
      $('hud').textContent = n + ' Seiten';
      return true;
    }
    return false;
  }
  if (S.shape === 'rect') {
    if (!A || !cur) return false;
    const parts = s.split(/[;x]/),
      th = ((parseFloat(S.num.a) || 0) * Math.PI) / 180 + drRot(),
      u = [Math.cos(th), Math.sin(th)],
      v = [-u[1], u[0]];
    let l = (cur[0] - A[0]) * u[0] + (cur[1] - A[1]) * u[1],
      w = (cur[0] - A[0]) * v[0] + (cur[1] - A[1]) * v[1];
    const a = gdNum(parts[0]),
      b = parts.length > 1 && parts[1] !== '' ? gdNum(parts[1]) : NaN;
    if (isFinite(a) && a !== 0) l = (a < 0 ? -1 : l < 0 ? -1 : 1) * Math.abs(a) * (a < 0 ? 1 : 1);
    if (isFinite(b) && b !== 0) w = (b < 0 ? -1 : w < 0 ? -1 : 1) * Math.abs(b);
    if (!isFinite(a) && !isFinite(b)) return false;
    if (Math.abs(l) < 0.05 || Math.abs(w) < 0.05) return false;
    if (isFinite(a) && a < 0) l = -Math.abs(a);
    if (isFinite(b) && b < 0) w = -Math.abs(b);
    finish([
      A,
      [A[0] + u[0] * l, A[1] + u[1] * l],
      [A[0] + u[0] * l + v[0] * w, A[1] + u[1] * l + v[1] * w],
      [A[0] + v[0] * w, A[1] + v[1] * w],
    ]);
    GV.buf = '';
    return true;
  }
  if (S.shape === 'circ' || S.shape === 'poly') {
    if (!A) return false;
    const r = Math.abs(gdNum(s));
    if (!isFinite(r) || r < 0.1) return false;
    let a0 = 0;
    if (cur) a0 = Math.atan2(cur[1] - A[1], cur[0] - A[0]);
    const n = S.shape === 'circ' ? 36 : S.sides,
      pts = [];
    for (let i = 0; i < n; i++) {
      const t = (S.shape === 'circ' ? 0 : a0) + (i / n) * 2 * Math.PI;
      pts.push([A[0] + r * Math.cos(t), A[1] + r * Math.sin(t)]);
    }
    finish(pts);
    GV.buf = '';
    return true;
  }
  if (S.shape === 'free') {
    const L = S.draft.at(-1);
    if (!L || !cur) return false;
    const d = gdNum(s);
    if (!isFinite(d) || !d) return false;
    const dx = cur[0] - L[0],
      dz = cur[1] - L[1],
      n = Math.hypot(dx, dz) || 1,
      q = [L[0] + (dx / n) * d, L[1] + (dz / n) * d];
    S.draft.push(q);
    GV.buf = '';
    try {
      sksPush(q);
    } catch (e) {
      logErr(e, 'gdEnterVal');
    }
    drawOv(q);
    return true;
  }
  return false;
}
addEventListener(
  'keydown',
  (e) => {
    try {
      if (S.tool !== 'f' || S.dm !== 'bld' || S.closed || S.shape === 'free') return;
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const drawing = !!(S.anchor || S.draft.length),
        k = e.key;
      const poly = S.shape === 'poly';
      if (/^[0-9.,;\-]$/.test(k) || (k === 'x' && S.shape === 'rect') || ((k === 's' || k === 'S') && poly)) {
        if (!drawing && !poly) return;
        GV.buf += k.toLowerCase();
        gdShow();
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      if (k === 'Backspace' && GV.buf) {
        GV.buf = GV.buf.slice(0, -1);
        gdShow();
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      if (k === 'Enter' && GV.buf) {
        if (gdEnterVal()) {
          e.stopImmediatePropagation();
          e.preventDefault();
        } else {
          GV.buf = '';
          $('hud').textContent = 'Eingabe nicht möglich';
        }
        return;
      }
      if (k === 'Escape' && GV.buf) {
        GV.buf = '';
        e.stopImmediatePropagation();
        $('hud').textContent = 'Eingabe verworfen';
      }
    } catch (x) {
      console.warn('gdkey', x);
    }
  },
  true,
);
// ---- Fläche zum Gebäude ziehen (Ziehen & Schieben auf der gezeichneten Grundfläche)
const GE = { d: null };
function gdPrevBox(n) {
  const hh = +($('gh') || {}).value || 3,
    P = S.draft,
    y0 = S.refH != null ? S.refH : gh(P[0][0], P[0][1]),
    y1 = y0 + n * hh,
    pos = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      c = P[(i + 1) % P.length];
    pos.push(
      a[0],
      y0 + 0.05,
      a[1],
      c[0],
      y0 + 0.05,
      c[1],
      a[0],
      y1,
      a[1],
      c[0],
      y1,
      c[1],
      a[0],
      y0 + 0.05,
      a[1],
      a[0],
      y1,
      a[1],
    );
  }
  SZP.geometry.dispose();
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  SZP.geometry = g;
  SZP.material = SZPs;
  SZP.material.color.setHex(0x2f7fd0);
  SZP.visible = true;
}
function gdExDown(e) {
  if (GE.d && GE.d.armed) {
    gdExCommit(GE.d.n);
    return true;
  }
  if (SK.tool !== 'p' || !S.closed || S.draft.length < 3) return false;
  const en = skHit(e);
  if (en) return false;
  const g = ground(e);
  if (!g || !znInP(g, S.draft)) return false;
  GE.d = { y0: e.clientY, mv: 0, armed: false, n: 1, typed: false };
  gdPrevBox(1);
  skVcbShow();
  szMsg(
    'Ziehen & Schieben · nach oben ziehen = Geschosse · Zahl + Enter = Anzahl Geschosse · Esc = abbrechen',
  );
  return true;
}
function gdExMove(e) {
  const d = GE.d;
  if (!d) return false;
  d.mv = Math.max(d.mv, Math.abs(e.clientY - d.y0));
  if (!d.typed) {
    d.n = Math.max(1, Math.min(60, Math.round((d.y0 - e.clientY) / 18)));
  }
  gdPrevBox(d.n);
  szMsg(
    'Ziehen & Schieben · ' +
      d.n +
      ' Geschoss' +
      (d.n === 1 ? '' : 'e') +
      ' · ' +
      ((+($('gh') || {}).value || 3) * d.n).toFixed(1).replace('.', ',') +
      ' m · Klick = Gebäude erzeugen · Zahl + Enter = Anzahl',
  );
  return true;
}
function gdExUp(e) {
  const d = GE.d;
  if (!d) return false;
  if (d.mv < 5 && !d.armed) {
    d.armed = true;
    return true;
  }
  gdExCommit(d.n);
  return true;
}
function gdExCommit(n) {
  // ── Erweiterung aus 27-skizze/030-zeichnen.js
  const F = SKS.pend;
  SKS.pend = null;
  gdExCommitBasis(n);
  if (F) sksConsume(F);
}
// gdExCommit() ohne die Erweiterungen darüber – wird von gdExCommit() gezielt aufgerufen
function gdExCommitBasis(n) {
  GE.d = null;
  SZP.visible = false;
  SK.vcb = '';
  const sh = document.createElement('div');
  sh.style.display = 'none';
  try {
    [
      ['ng', ''],
      ['gh', '3'],
      ['nu', 'Wohnen'],
      ['nn', ''],
      ['nug', '0'],
    ].forEach(([i, v]) => {
      if (!$(i)) sh.insertAdjacentHTML('beforeend', '<input id="' + i + '" value="' + v + '">');
    });
    document.body.appendChild(sh);
    $('ng').value = n;
    mk();
  } catch (e) {
    console.warn('Gebäude erzeugen', e);
  } finally {
    sh.remove();
  }
}
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    const t = SK.tool;
    if (t === 'r' || t === 'z' || t === 'c' || t === 'o') {
      if (!SZ.d) {
        const en = skHit(e),
          q = szEntOf(en),
          roof = q && szFlat(q.b, q.j);
        if (roof && (t === 'c' || t === 'o')) {
          szMsg('Kreis und Polygon zeichnest du auf dem Gelände – auf dem Dach: Rechteck oder Linie');
          return true;
        }
        if (!roof) {
          gdEnter(t);
          return false;
        }
      }
    }
    if (gdExDown(e)) return true;
    return _d(e);
  };
}
{
  const _m = SK.opMove;
  SK.opMove = function (e) {
    if (GE.d) {
      gdExMove(e);
      return true;
    }
    return _m(e);
  };
}
{
  const _u = SK.opUp;
  SK.opUp = function (e) {
    if (GE.d) {
      gdExUp(e);
      return true;
    }
    return _u(e);
  };
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (GE.d) {
      GE.d = null;
      SZP.visible = false;
      SK.vcb = '';
      szMsg('Abgebrochen');
      return true;
    }
    return _e();
  };
}
{
  const _k = SK.keys;
  SK.keys = function (e) {
    const k = e.key;
    if (GE.d) {
      if (/^[0-9]$/.test(k)) {
        SK.vcb += k;
        GE.d.typed = true;
        GE.d.n = Math.max(1, Math.min(60, parseInt(SK.vcb, 10) || 1));
        gdPrevBox(GE.d.n);
        skVcbShow();
        return true;
      }
      if (k === 'Backspace' && SK.vcb) {
        SK.vcb = SK.vcb.slice(0, -1);
        GE.d.n = Math.max(1, parseInt(SK.vcb, 10) || 1);
        gdPrevBox(GE.d.n);
        skVcbShow();
        return true;
      }
      if (k === 'Enter') {
        gdExCommit(GE.d.n);
        return true;
      }
    }
    if (!SZ.d && !SZ.op && !OFS.d) {
      if (k === 'l' || k === 'L') {
        skUse('z');
        szMsg('Linie · Punkte klicken, ersten Punkt anklicken = Fläche schließt sich');
        return true;
      }
      if (k === 'c' || k === 'C') {
        skUse('c');
        szMsg('Kreis · Mittelpunkt klicken, Radius ziehen oder tippen');
        return true;
      }
      if (k === 'o' || k === 'O') {
        skUse('o');
        szMsg('Polygon · Mittelpunkt klicken, Radius ziehen · Seitenzahl tippen, z. B. 8s');
        return true;
      }
      if (k === 't' || k === 'T') {
        skUse('l');
        return true;
      }
    }
    return _k(e);
  };
}
// skBaSync(): Erweiterung zusammengeführt, siehe 26-modellier-modus/120-modellier.js
SKBA.skk = 'c';
SKBA.sko = 'o';

/* v471 Skizze (wie in der Hilfe des Vorbilds): gezeichnete Linien bleiben als Kanten auf dem Gelände stehen.
   Linie, Rechteck, Kreis, Polygon lassen sich frei kombinieren; Kanten schneiden sich gegenseitig (Schnittpunkte werden Fangpunkte);
   jede geschlossene Form wird automatisch zur Fläche (sichtbar gefüllt). Kanten/Flächen wählen und mit Entf löschen.
   Ziehen & Schieben auf einer Fläche = Geschosse (Vorschau vor dem Erzeugen). Flächen mit innenliegender geschlossener Form bekommen ein Loch (Innenhof). */
const SKS = { e: [], sel: [], hv: null, d: null, cv: 0, fc: null, h: [], hide: [] };
function sksSig(r) {
  return r
    .map((q) => Math.round(q[0] * 100) + ',' + Math.round(q[1] * 100))
    .sort()
    .join(';');
}
const SKS_TOL = 1e-3;
