/* v471b Skizzenmodus: starker Parallelfang (zu gezeichneten Linien, Grundstücksgrenzen und Gebäudekanten, immer aktiv),
   Grundstücksecken dezent (kein Marker, keine Fluchtlinien), Versatz auf gezeichneten Flächen und Grundstücksgrenzen (nach innen/außen),
   Rechtsklick-Menü im Skizzenmodus (dieselben Werkzeuge wie bei der Gebäudebearbeitung). */
const PAR = { tol: (7 * Math.PI) / 180, tolSk: (11 * Math.PI) / 180 };
const SNX = { ref: null, skip: null, on: 0 };
function parDirs() {
  const D = [],
    seen = new Map();
  const add = (a, b, sk) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    if (L < 0.3) return;
    let x = dx / L,
      z = dz / L;
    if (x < 0 || (Math.abs(x) < 1e-9 && z < 0)) {
      x = -x;
      z = -z;
    }
    const k = Math.round((Math.atan2(z, x) * 360) / Math.PI);
    const o = seen.get(k);
    if (o) {
      if (sk) o.sk = 1;
      return;
    }
    const d = [x, z];
    d.sk = sk ? 1 : 0;
    seen.set(k, d);
    D.push(d);
  };
  SKS.e.forEach((s) => {
    if (SNX.skip && SNX.skip(s)) return;
    add(s.a, s.b, 1);
  });
  P.forEach((a) => a.site && a.poly.forEach((c, i) => add(c, a.poly[(i + 1) % a.poly.length], 0)));
  S.bld.forEach((b) => {
    const f = b.levels ? cfp(b) : b.fp;
    f.forEach((c, i) => add(c, f[(i + 1) % f.length], 0));
  });
  return D;
}
const siteCorner = (q) =>
  P.some((a) => a.site && a.poly.some((c) => Math.hypot(c[0] - q[0], c[1] - q[1]) < 0.05));
// snap(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// ---- Versatz in der Skizze
const SOF = { d: null, re: null, last: null };
function sofSource(e) {
  const g = ground(e);
  if (!g) return null;
  const h = sksHit(e);
  if (h && h.k === 'f') {
    const F = sksFacesNow()[h.f];
    return { ring: F.o.map((q) => q.slice()), what: 'Fläche' };
  }
  const tol = 10 * mpp();
  let best = null,
    bd = tol;
  P.forEach((a) => {
    if (!a.site) return;
    const d = szDist(g, a.poly);
    if (d < bd) {
      bd = d;
      best = { ring: a.poly.map((q) => q.slice()), what: 'Grundstück' };
    }
  });
  if (best) return best;
  const S0 = P.find((a) => a.site && znInP(g, a.poly));
  if (S0) return { ring: S0.poly.map((q) => q.slice()), what: 'Grundstück' };
  return null;
}
function sofSigned(d, p) {
  const ins = znInP(p, d.ring),
    r = szDist(p, d.ring),
    v = Math.round(r * 100) / 100;
  return ins ? v : -v;
}
function sofApply(ring, v) {
  const out = ofPoly(ring, v);
  if (!out) return null;
  const L = out.map((p, i) => ({ a: p, b: out[(i + 1) % out.length] }));
  return { out, L };
}
function sofFinish(v) {
  const d = SOF.d;
  if (!d) return true;
  if (!isFinite(v) || Math.abs(v) < 1e-3) {
    szMsg('Versatz: Abstand 0 – nichts geändert');
    sofReset();
    return true;
  }
  const s0 = JSON.stringify(SKS.e),
    res = sofApply(d.ring, v);
  if (!res) {
    szMsg('Der Versatz ist so nicht möglich (Form würde verschwinden oder sich überschneiden)');
    return true;
  }
  const n = sksAdd(res.L, ++SKS.cv);
  SOF.last = { v };
  SOF.re = { ring: d.ring, s0, v };
  SOF.d = null;
  SK.vcb = '';
  SZP.visible = false;
  try {
    skVcbShow();
  } catch (e) {
    logErr(e, 'sofFinish');
  }
  szMsg(
    'Versatz ' +
      szF(v) +
      ' m' +
      (n > 0 ? ' · neue Fläche' : '') +
      ' · Zahl + Enter = anderer Abstand, Doppelklick auf weitere Fläche/Grenze = gleicher Abstand',
  );
  return true;
}
function sofReset() {
  SOF.d = null;
  SK.vcb = '';
  try {
    SZP.visible = false;
    skVcbShow();
  } catch (e) {
    logErr(e, 'sofReset');
  }
}
function sofDown(e) {
  let d = SOF.d;
  if (!d) {
    const src = sofSource(e);
    if (!src) return false;
    if (e.detail >= 2 && SOF.last) {
      const v = SOF.last.v,
        s0 = JSON.stringify(SKS.e),
        res = sofApply(src.ring, v);
      if (!res) {
        szMsg('Versatz so nicht möglich');
        return true;
      }
      sksAdd(res.L, ++SKS.cv);
      SOF.re = { ring: src.ring, s0, v };
      szMsg('Versatz ' + szF(v) + ' m (gleicher Abstand)');
      return true;
    }
    SOF.re = null;
    SOF.d = d = { ring: src.ring, v: 0, y: gh(src.ring[0][0], src.ring[0][1]) };
    skVcbShow();
    szMsg(
      'Versatz · ' +
        src.what +
        ' · Maus bewegen = Abstand (nach innen oder außen), Klick = fertig · Zahl + Enter = genauer Abstand',
    );
    return true;
  }
  return sofFinish(d.v);
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      const d = SOF.d;
      if (!d || SK.tool !== 'f') return;
      const p = ground(e);
      if (!p) return;
      let v = sofSigned(d, p);
      if (SK.vcb) {
        const t = parseFloat(SK.vcb.replace(',', '.'));
        if (isFinite(t)) v = (v < 0 ? -1 : 1) * Math.abs(t);
      }
      d.v = v;
      const r = sofApply(d.ring, v);
      if (r) szPrev(r.out, true, d.y);
      else SZP.visible = false;
      szMsg(
        'Versatz ' +
          szF(v) +
          ' m' +
          (r ? '' : ' · so nicht möglich') +
          ' · Klick = fertig · Zahl + Enter = genau',
      );
    } catch (x) {
      console.warn('sofm', x);
    }
  },
  true,
);
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    if (SK.tool === 'f' && !SK.op && !OFS.d && !SZ.d) {
      if (SOF.d) return sofDown(e);
      const en = sksEntAt(e);
      if (!en) {
        if (sofDown(e)) return true;
      }
    }
    return _d(e);
  };
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (SOF.d) {
      sofReset();
      szMsg('Versatz abgebrochen');
      return true;
    }
    return _e();
  };
}
{
  const _k = SK.keys;
  SK.keys = function (e) {
    const k = e.key;
    if (SK.tool === 'f' && (SOF.d || SOF.re) && !OFS.d && !OFS.re) {
      if (/^[0-9.,]$/.test(k)) {
        SK.vcb += k;
        skVcbShow();
        return true;
      }
      if (k === 'Backspace' && SK.vcb) {
        SK.vcb = SK.vcb.slice(0, -1);
        skVcbShow();
        return true;
      }
      if (k === 'Enter' && SK.vcb) {
        const t = parseFloat(SK.vcb.replace(',', '.'));
        if (!isFinite(t) || t <= 0) {
          SK.vcb = '';
          skVcbShow();
          return true;
        }
        if (SOF.d) {
          const side = SOF.d.v < 0 ? -1 : 1;
          return sofFinish(side * t);
        }
        const r = SOF.re,
          v = (r.v < 0 ? -1 : 1) * t,
          cur = JSON.stringify(SKS.e);
        SKS.e = JSON.parse(r.s0);
        const res = sofApply(r.ring, v);
        if (!res) {
          SKS.e = JSON.parse(cur);
          szMsg('Versatz so nicht möglich');
          SK.vcb = '';
          skVcbShow();
          return true;
        }
        SKS.e = sksNorm(SKS.e.concat(res.L.map((s) => ({ a: s.a, b: s.b, c: ++SKS.cv }))));
        SKS.fc = null;
        sksChanged();
        r.v = v;
        SOF.last = { v };
        SK.vcb = '';
        skVcbShow();
        szMsg('Versatz ' + szF(v) + ' m');
        return true;
      }
    }
    return _k(e);
  };
}
// skTool(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
// cmShow(): Erweiterung zusammengeführt, siehe 13-geometrie-und-nutzung/010-hilfen-geometrie.js
// baDo(): Erweiterung zusammengeführt, siehe 11-bearbeiten/020-bearbeiten.js
// ---- Esc geht stufenweise zurück: 1× laufende Eingabe/Zeichnung abbrechen, 2× Werkzeug verlassen (oberste Ebene: Gebäude, Grundstücke … wählen)
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (SOF.re || OFS.re) {
      SOF.re = null;
      OFS.re = null;
      SK.vcb = '';
      try {
        skVcbShow();
      } catch (e) {
        logErr(e, 'opEsc');
      }
      szMsg('Versatz beendet · Esc nochmal = Werkzeug verlassen');
      return true;
    }
    return _e();
  };
}
addEventListener(
  'keydown',
  (e) => {
    try {
      if (e.key !== 'Escape') return;
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      if (typeof HOME !== 'undefined' && HOME.open) return;
      if (S.tool === 'f' && S.dm === 'bld') {
        if (GV.buf) return;
        if (S.draft.length || S.anchor || S.prev) {
          SKS.pend = null;
          S.draft = [];
          S.anchor = null;
          S.prev = null;
          S.edge = null;
          S.snp = null;
          S.refH = null;
          S.closed = false;
          GV.buf = '';
          drawOv();
          rr();
          szMsg('Abgebrochen · Esc nochmal = Werkzeug verlassen');
          e.stopImmediatePropagation();
          return;
        }
        tool('v');
        SK.used = false;
        SKS.sel = [];
        SKS.hv = null;
        try {
          sksRedraw();
          skTool('s');
          skBaSync();
        } catch (e) {
          logErr(e, 'init>anonym');
        }
        szMsg('Zeichnen beendet · Gebäude, Grundstücke … wieder wählbar');
        e.stopImmediatePropagation();
        return;
      }
      if (SKS.sel.length && !SK.op && !SZ.d && !SZ.op && !OFS.d && !SOF.d && !GE.d) {
        SKS.sel = [];
        sksRedraw();
        e.stopImmediatePropagation();
        return;
      }
      if (S.tool === 'v' || S.tool === 'b') {
        setTimeout(() => {
          try {
            if (!SK.used && SK.tool !== 's') {
              skTool('s');
              skBaSync();
            }
          } catch (e) {
            logErr(e, 'init>anonym');
          }
        }, 320);
      }
    } catch (x) {
      console.warn('esc', x);
    }
  },
  true,
);
