/* v469 Versatz (Taste F) – wie in der Hilfe beschrieben:
   Fläche anklicken (oder Linien/Fläche gewählt), Maus bewegen = Abstand (Anzeige im Wertefeld), Klick = fertig,
   Zahl + Enter = genauer Abstand (beliebig oft neu eingeben, bis etwas anderes getan wird), Doppelklick auf eine weitere Fläche = gleicher Abstand.
   Ergebnis: eine parallele Kopie der Außenkanten der Fläche; die innere/äußere Fläche ist eine eigene Fläche (anwählbar, ziehbar). */
const OFS = { d: null, re: null, last: null };
SKT.push(['f', 'Versatz', 'F']);
function ofPoly(ring, v) {
  const n = ring.length;
  if (n < 3 || !isFinite(v) || Math.abs(v) < 1e-4) return null;
  const s = skArea(ring) > 0 ? 1 : -1;
  const E = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      c = ring[(i + 1) % n],
      dx = c[0] - a[0],
      dz = c[1] - a[1],
      L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    const nx = (-dz / L) * s,
      nz = (dx / L) * s;
    E.push({ p: [a[0] + nx * v, a[1] + nz * v], d: [dx / L, dz / L] });
  }
  const m = E.length;
  if (m < 3) return null;
  const out = [];
  for (let i = 0; i < m; i++) {
    const A = E[(i + m - 1) % m],
      B = E[i],
      den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) {
      out.push(B.p.slice());
      continue;
    }
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    out.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]);
  }
  if (out.some((p) => !isFinite(p[0]) || !isFinite(p[1]))) return null;
  if (skArea(out) * skArea(ring) <= 0 || szA(out) < 0.05) return null;
  for (let i = 0; i < m; i++) {
    const a = out[i],
      c = out[(i + 1) % m],
      E0 = E[i];
    if ((c[0] - a[0]) * E0.d[0] + (c[1] - a[1]) * E0.d[1] <= 1e-6) return null;
  }
  if (znEdgesX(out, out)) return null;
  if (v > 0) {
    if (!out.every((p) => znStrict(p, ring))) return null;
  } else {
    if (!ring.every((p) => znStrict(p, out))) return null;
  }
  return out;
}
function ofSource(e) {
  const en = skHit(e);
  if (!en || en.vd != null)
    return { err: 'Versatz: eine Fläche auf dem Dach anklicken (Dachfläche oder gezeichnete Fläche)' };
  const b = en.b,
    j = en.j;
  if (!(en.top || en.face != null))
    return { err: 'Versatz: eine Fläche auf dem Dach anklicken (Dachfläche oder gezeichnete Fläche)' };
  if (!szFlat(b, j))
    return { err: 'Versatz: nur auf Flachdach – Dachform des Gebäudes auf „Flachdach“ stellen' };
  const y = szTop(b, j);
  if (en.face != null) {
    const f = b.levels[j].faces && b.levels[j].faces[en.face];
    if (!f) return { err: 'Fläche nicht gefunden' };
    return { b, j, y, fi: en.face, ring: f.poly.map((q) => q.slice()) };
  }
  const p = planePt(e, y);
  if (!p) return { err: 'Versatz: Fläche nicht getroffen' };
  const reg = szExposed(b, j, null),
    P = reg.find((q) => bpIn(p, q)) || reg[0];
  if (!P) return { err: 'Versatz: hier ist keine freie Dachfläche' };
  if (P.h.length)
    return {
      err: 'Versatz: die Dachfläche hat einen Innenhof oder Aufbau – bitte zuerst mit Teilen/Rechteck eine Fläche ohne Loch anlegen',
    };
  return { b, j, y, fi: null, ring: P.o.map((q) => [q[0], q[1]]) };
}
function ofApply(src, v, keepSnap) {
  const { b, j, fi } = src;
  const ring = src.ring;
  if (fi == null && v < 0)
    return {
      err: 'Versatz nach außen ist bei der ganzen Dachfläche nicht möglich (nur nach innen oder bei gezeichneten Flächen)',
    };
  const out = ofPoly(ring, v);
  if (!out)
    return { err: 'Der Versatz ist so nicht möglich (Fläche würde verschwinden oder sich überschneiden)' };
  if (!szOkF(b, j, out, fi != null ? b.levels[j].faces[fi] : null)) {
    return { err: 'Der Versatz liegt nicht ganz auf der freien Dachfläche' };
  }
  const l = b.levels[j];
  if (fi != null) {
    l.faces[fi] = { poly: out, part: l.faces[fi].part };
  } else {
    (l.faces = l.faces || []).push({ poly: out });
  }
  return { out, idx: fi != null ? fi : l.faces.length - 1 };
}
function ofSigned(d, p) {
  const ins = znInP(p, d.ring);
  const r = szDist(p, d.ring);
  const v = Math.round(r * 100) / 100;
  return ins ? v : -v;
}
function ofSnap(b) {
  return szSnap0(b);
}
function ofDown(e) {
  let d = OFS.d;
  if (!d) {
    const src = ofSource(e);
    if (src.err) {
      szMsg(src.err);
      return true;
    }
    if (e.detail >= 2 && OFS.last) {
      const r = OFS.last,
        s0 = ofSnap(src.b);
      hist();
      const res = ofApply(src, r.v);
      if (res.err) {
        szMsg(res.err);
        S.hist.pop();
        return true;
      }
      szRefresh(src.b);
      szSelect([{ b: src.b, j: src.j, face: res.idx }]);
      OFS.re = { src, s0, v: r.v, idx: res.idx };
      szMsg('Versatz ' + szF(r.v) + ' m (gleicher Abstand)');
      return true;
    }
    OFS.re = null;
    d = OFS.d = { ...src, v: 0, s0: ofSnap(src.b) };
    skVcbShow();
    szMsg(
      'Versatz · Maus bewegen = Abstand (nach innen oder außen), Klick = fertig · Zahl + Enter = genauer Abstand',
    );
    return true;
  }
  return ofFinish(d.v);
}
function ofFinish(v) {
  const d = OFS.d;
  if (!d) return true;
  if (!isFinite(v) || Math.abs(v) < 1e-4) {
    szMsg('Versatz: Abstand 0 – nichts geändert');
    ofReset();
    return true;
  }
  hist();
  const res = ofApply(d, v);
  if (res.err) {
    S.hist.pop();
    szMsg(res.err);
    return true;
  }
  szRefresh(d.b);
  szSelect([{ b: d.b, j: d.j, face: res.idx }]);
  OFS.last = { v };
  OFS.re = { src: { b: d.b, j: d.j, y: d.y, fi: d.fi, ring: d.ring }, s0: d.s0, v, idx: res.idx };
  SZP.visible = false;
  OFS.d = null;
  SK.vcb = '';
  skVcbShow();
  szMsg(
    'Versatz ' +
      szF(v) +
      ' m · Zahl + Enter = anderen Abstand, Doppelklick auf eine weitere Fläche = gleicher Abstand',
  );
  return true;
}
function ofReset() {
  OFS.d = null;
  SK.vcb = '';
  try {
    SZP.visible = false;
    skMkEl().style.display = 'none';
    skTip('', null);
  } catch (e) {
    logErr(e, 'ofReset');
  }
}
addEventListener(
  'pointermove',
  (e) => {
    try {
      const d = OFS.d;
      if (!d || !skAct() || SK.tool !== 'f') return;
      const p = planePt(e, d.y);
      if (!p) return;
      let v = ofSigned(d, p);
      if (SK.vcb) {
        const t = parseFloat(SK.vcb.replace(',', '.'));
        if (isFinite(t)) v = (v < 0 ? -1 : 1) * Math.abs(t);
      }
      d.v = v;
      const o = ofPoly(d.ring, v);
      if (o) szPrev(o, true, d.y);
      else SZP.visible = false;
      szMsg(
        'Versatz ' +
          szF(v) +
          ' m' +
          (o ? '' : ' · so nicht möglich') +
          ' · Klick = fertig · Zahl + Enter = genau',
      );
    } catch (x) {
      console.warn('ofm', x);
    }
  },
  true,
);
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    if (SK.tool === 'f') return ofDown(e);
    return _d(e);
  };
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (OFS.d) {
      ofReset();
      szMsg('Versatz abgebrochen');
      return true;
    }
    return _e();
  };
}
// skTool(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
{
  const _k = SK.keys;
  SK.keys = function (e) {
    const k = e.key;
    if ((k === 'f' || k === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && (SK.used || SK.tool === 'f')) {
      skUse('f');
      szMsg('Versatz · Fläche anklicken, Maus bewegen, Klick = fertig · Zahl + Enter = genauer Abstand');
      return true;
    }
    if (SK.tool === 'f' && (OFS.d || OFS.re)) {
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
        if (OFS.d) {
          const side = OFS.d.v < 0 ? -1 : 1;
          return ofFinish(side * t);
        }
        if (OFS.re) {
          const r = OFS.re,
            side = r.v < 0 ? -1 : 1,
            v = side * t;
          szRestore(r.src.b, r.s0);
          const res = ofApply(r.src, v);
          if (res.err) {
            szMsg(res.err);
            szRestore(r.src.b, r.s0);
            const q = ofApply(r.src, r.v);
            szRefresh(r.src.b);
            SK.vcb = '';
            skVcbShow();
            return true;
          }
          szRefresh(r.src.b);
          szSelect([{ b: r.src.b, j: r.src.j, face: res.idx }]);
          r.v = v;
          OFS.last = { v };
          SK.vcb = '';
          skVcbShow();
          szMsg('Versatz ' + szF(v) + ' m');
          return true;
        }
      }
    }
    return _k(e);
  };
}
