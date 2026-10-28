/* v476 Skizze: Endpunkte anfassen. Im Auswahlwerkzeug leuchtet ein Endpunkt auf, wenn die Maus nahe ist; Klick wählt ihn, Ziehen verschiebt ihn.
   Der gezogene Punkt fängt alle Endpunkte und Mittelpunkte der gezeichneten Linien (und sonstige Fangpunkte); angrenzende Kanten und Flächen folgen. */
const SKN = { hv: null, sel: null, drag: null };
function sknTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 28, 0, 7);
  g.fillStyle = '#fff';
  g.fill();
  return new T.CanvasTexture(c);
}
const sknTx = sknTex();
const sknHM = new T.PointsMaterial({
  size: 15,
  sizeAttenuation: false,
  color: 0xffa21a,
  map: sknTx,
  transparent: true,
  alphaTest: 0.3,
  depthTest: false,
});
const sknSM = new T.PointsMaterial({
  size: 15,
  sizeAttenuation: false,
  color: 0x1f6fd1,
  map: sknTx,
  transparent: true,
  alphaTest: 0.3,
  depthTest: false,
});
function sknPts(p, m) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(p), 3));
  const o = new T.Points(g, m);
  o.renderOrder = 12;
  o.frustumCulled = false;
  o.raycast = () => {};
  return o;
}
const sknSame = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 2e-3;
function sknNodeAt(e) {
  if (!SKS.e.length) return null;
  let p;
  try {
    p = ground(e);
  } catch (_) {
    return null;
  }
  if (!p) return null;
  const tol = 9 * mpp();
  let best = null,
    bd = tol;
  SKS.e.forEach((s) => {
    [s.a, s.b].forEach((q) => {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) {
        bd = d;
        best = q;
      }
    });
  });
  return best ? best.slice() : null;
}
// sksRedraw(): Erweiterung zusammengeführt, siehe 27-skizze/020-kantennetz.js
function sknTargets(skip) {
  const T0 = [];
  SKS.e.forEach((s) => {
    if (skip(s)) return;
    T0.push(s.a, s.b, [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]);
  });
  return T0;
}
function sknSnapTo(e, node) {
  const g = ground(e);
  if (!g) return null;
  const tol = 12 * mpp();
  const T0 = sknTargets((s) => sknSame(s.a, node) || sknSame(s.b, node));
  let bd = tol,
    bq = null,
    lab = '';
  T0.forEach((q, i) => {
    const d = Math.hypot(q[0] - g[0], q[1] - g[1]);
    if (d < bd) {
      bd = d;
      bq = q.slice();
      lab = i % 3 === 2 ? 'Mittelpunkt' : 'Endpunkt';
    }
  });
  if (bq) return { p: bq, lab };
  const att = SKS.e.filter((s) => sknSame(s.a, node) || sknSame(s.b, node)),
    oth = SKS.e.filter((s) => !att.includes(s)),
    refs = att.map((s) => (sknSame(s.a, node) ? s.b : s.a));
  const all = SKS.e;
  let best = null;
  try {
    SKS.e = oth;
    SNX.skip = null;
    SNX.on = 1;
    for (const rf of refs.length ? refs : [null]) {
      SNX.ref = rf;
      let r = null;
      try {
        r = snap(g, e, null, rf ? [rf] : []);
      } catch (_) {
        r = null;
      }
      if (r && (!best || (['par', 'perp'].includes(r.t) && !['par', 'perp'].includes(best.t)))) best = r;
      if (best && ['par', 'perp'].includes(best.t)) break;
    }
  } finally {
    SKS.e = all;
    SNX.ref = null;
  }
  try {
    fgUpdate();
  } catch (e) {
    logErr(e, 'sknSnapTo');
  }
  return { p: (best && best.p) || g, lab: best ? (best.t === 'pt' ? 'Punkt' : best.lab || '') : '' };
}
function sknMove(to) {
  const d = SKN.drag;
  SKS.e.forEach((s) => {
    if (sknSame(s.a, d.node)) s.a = to.slice();
    if (sknSame(s.b, d.node)) s.b = to.slice();
  });
  d.node = to.slice();
  SKN.sel = to.slice();
  SKS.fc = null;
  sksChanged();
}
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    if (SK.tool === 's' && !GE.d && !SZ.d && !SZ.op && !OFS.d && !SOF.d && SKS.e.length && !sksEntAt(e)) {
      const n = sknNodeAt(e);
      if (n) {
        SKN.sel = n.slice();
        SKN.drag = {
          node: n.slice(),
          x: e.clientX,
          y: e.clientY,
          mv: 0,
          hist: 0,
          snap: JSON.stringify({ e: SKS.e, hide: SKS.hide }),
        };
        SKS.sel = [];
        SKN.hv = null;
        sksRedraw();
        szMsg('Punkt gewählt · ziehen = verschieben (fängt Endpunkte und Mittelpunkte) · Esc = abwählen');
        return true;
      }
      if (SKN.sel) {
        SKN.sel = null;
        sksRedraw();
      }
    }
    return _d(e);
  };
}
{
  const _m = SK.opMove;
  SK.opMove = function (e) {
    const d = SKN.drag;
    if (!d) return _m(e);
    if (!d.mv && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return true;
    if (!d.mv) {
      d.mv = 1;
      hist();
    }
    const r = sknSnapTo(e, d.node);
    if (r) {
      sknMove(r.p);
      szMsg('Punkt verschieben' + (r.lab ? ' · ' + r.lab : '') + ' · loslassen = fertig');
    }
    return true;
  };
}
{
  const _u = SK.opUp;
  SK.opUp = function (e) {
    const d = SKN.drag;
    if (!d) return _u(e);
    SKN.drag = null;
    SNX.on = 0;
    try {
      S.fg = null;
      fgClear();
    } catch (e) {
      logErr(e, 'opUp');
    }
    if (d.mv) {
      SKS.e = sksNorm(SKS.e);
      SKS.fc = null;
      SKN.sel = d.node.slice();
      sksChanged();
      szMsg('Punkt verschoben · Fläche folgt');
    }
    return true;
  };
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (SKN.drag) {
      SNX.on = 0;
      try {
        S.fg = null;
        fgClear();
      } catch (e) {
        logErr(e, 'opEsc');
      }
      const q = JSON.parse(SKN.drag.snap);
      SKS.e = q.e;
      SKS.hide = q.hide;
      SKN.drag = null;
      SKN.sel = null;
      SKS.fc = null;
      sksChanged();
      return true;
    }
    if (SKN.sel) {
      SKN.sel = null;
      sksRedraw();
      return true;
    }
    return _e();
  };
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (e.buttons || SKN.drag || !SKS.e.length || SK.tool !== 's' || e.target !== cv || GE.d) return;
      const n = sksEntAt(e) ? null : sknNodeAt(e);
      const a = SKN.hv,
        k = (x) => (x ? x[0].toFixed(3) + ',' + x[1].toFixed(3) : '');
      if (k(a) !== k(n)) {
        SKN.hv = n;
        sksRedraw();
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
// ---- weiße Punkte an Endpunkten gewählter Linien/Flächen, Löschen mit Entf, näher heranzoomen beim Zeichnen
function camxSk() {
  return S.tool === 'f' || SKS.e.length > 0 || SK.used;
}
function sknDotTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 26, 0, 7);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#222';
  g.stroke();
  return new T.CanvasTexture(c);
}
const sknDM = new T.PointsMaterial({
  size: 8,
  sizeAttenuation: false,
  color: 0xffffff,
  map: sknDotTex(),
  transparent: true,
  alphaTest: 0.3,
  depthTest: false,
});
// sksRedraw(): Erweiterung zusammengeführt, siehe 27-skizze/020-kantennetz.js
addEventListener(
  'keydown',
  (e) => {
    try {
      if (!SKN.sel || SKS.sel.length) return;
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === 'Delete' || (e.key === 'Backspace' && !GV.buf && !SK.vcb)) {
        const n = SKN.sel,
          keep = SKS.e.filter((s) => !(sknSame(s.a, n) || sknSame(s.b, n)));
        const k = SKS.e.length - keep.length;
        if (k) {
          hist();
          SKS.e = keep;
          SKN.sel = null;
          SKS.sel = [];
          SKS.fc = null;
          sksChanged();
          szMsg(k + ' Linie' + (k === 1 ? '' : 'n') + ' am Punkt gelöscht');
        }
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    } catch (x) {
      console.warn(x);
    }
  },
  true,
);
