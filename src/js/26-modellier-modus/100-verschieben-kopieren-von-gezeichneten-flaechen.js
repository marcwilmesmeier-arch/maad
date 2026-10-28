// ---- Verschieben / Kopieren von gezeichneten Flächen und Höfen
function szMStart(en, e) {
  const b = en.b,
    o = szObj(en);
  hist();
  let ent = en,
    obj = o;
  const wasVd = en.vd != null;
  if (e.ctrlKey) {
    const c = JSON.parse(JSON.stringify(o));
    if (wasVd) {
      b.voids.push(c);
      ent = { b, j: en.j, vd: b.voids.length - 1, floor: 1 };
    } else {
      b.levels[en.j].faces.push(c);
      ent = { b, j: en.j, face: b.levels[en.j].faces.length - 1 };
    }
    obj = c;
  } else if (wasVd) ent = { b, j: en.j, vd: en.vd, floor: 1 };
  const op = {
    kind: 'z',
    z: 'm',
    b,
    ent,
    obj,
    orig: obj.poly.map((q) => q.slice()),
    wy: wasVd ? szTop(b, obj.j1) : szTop(b, en.j),
    x: e.clientX,
    y: e.clientY,
    mv: 0,
    armed: false,
    hl: S.hist.length,
    copy: !!e.ctrlKey,
    ok: [0, 0],
  };
  op.p0 = planePt(e, op.wy);
  op.rings = [];
  szRings(b, wasVd ? obj.j1 : en.j).forEach((r) => {
    if (r !== obj.poly) r.forEach((q) => op.rings.push(q));
  });
  SZ.op = op;
  SK.op = op;
  SK.hv = null;
  SK.ver++;
  skVcbShow();
  return op;
}
function szMMouse(e) {
  const op = SZ.op,
    p = planePt(e, op.wy);
  if (!p || !op.p0) return;
  let dx = p[0] - op.p0[0],
    dz = p[1] - op.p0[1],
    sn = '';
  if (!e.altKey) {
    const r = Math.min(0.6, Math.max(0.12, 10 * mpp()));
    let bd = r,
      bp = null;
    op.orig.forEach((v) => {
      const qx = v[0] + dx,
        qz = v[1] + dz;
      op.rings.forEach((c) => {
        const d = Math.hypot(c[0] - qx, c[1] - qz);
        if (d < bd) {
          bd = d;
          bp = [c[0] - v[0], c[1] - v[1]];
        }
      });
    });
    if (bp) {
      dx = bp[0];
      dz = bp[1];
      sn = ' · Fang: Ecke';
    } else {
      dx = Math.round(dx * 20) / 20;
      dz = Math.round(dz * 20) / 20;
    }
  } else {
    dx = Math.round(dx * 20) / 20;
    dz = Math.round(dz * 20) / 20;
  }
  const poly = op.orig.map((q) => [q[0] + dx, q[1] + dz]),
    b = op.b,
    o = op.obj,
    old = o.poly;
  o.poly = poly;
  const ok = op.ent.vd != null ? szOkV(b, poly, o.j0, o.j1, o) : szOkF(b, op.ent.j, poly, o);
  if (ok) {
    op.ok = [dx, dz];
    mesh(b);
    szMsg(
      (op.copy ? 'Kopieren ' : 'Verschieben ') +
        szF(Math.hypot(dx, dz)) +
        ' m (Ost ' +
        szF(dx) +
        ' · Nord ' +
        szF(-dz) +
        ')' +
        sn +
        ' · Klick = ablegen · Esc',
    );
  } else {
    o.poly = old;
    szMsg('Dort ist kein Platz (Rand des Gebäudes oder andere Fläche/Hof im Weg)');
  }
}
function szOpMove(e) {
  const op = SZ.op;
  op.lastE = e;
  if (Math.hypot(e.clientX - op.x, e.clientY - op.y) > 4) op.mv = 1;
  if (op.mv || op.armed || op.ending) {
    if (op.z === 'm') szMMouse(e);
    else szPMouse(e);
  }
}
function szOpUp(e) {
  const op = SZ.op;
  if (op.ending || op.mv) {
    szOpEnd(true);
    return;
  }
  op.armed = true;
  szMsg(
    (op.z === 'm' ? 'Verschieben' : 'Ziehen & Schieben') +
      ' · Maus bewegen, erneut klicken zum Übernehmen · Zahl + Enter · Esc',
  );
}
function szOpEnd(commit) {
  const op = SZ.op;
  if (!op) return;
  const b = op.b;
  if (op.z === 'm') {
    const moved = Math.hypot(op.ok[0], op.ok[1]) > 1e-6,
      drop = !commit || !moved;
    if (drop) {
      op.obj.poly = op.orig.map((q) => q.slice());
      if (op.copy) {
        const en = op.ent;
        if (en.vd != null) b.voids.splice(en.vd, 1);
        else b.levels[en.j].faces.splice(en.face, 1);
      }
      if (S.hist.length === op.hl) S.hist.pop();
      SZ.op = null;
      SK.op = null;
      szRefresh(b);
      szSelect(op.copy ? [] : [op.ent]);
    } else {
      SZ.op = null;
      SK.op = null;
      szRefresh(b);
      szSelect([op.ent]);
      szMsg((op.copy ? 'Kopie angelegt · ' : 'Verschoben · ') + szF(Math.hypot(op.ok[0], op.ok[1])) + ' m');
    }
  } else {
    const ch = op.last !== 0;
    if (!commit || !ch) {
      szRestore(b, op.s0);
      if (S.hist.length === op.hl) S.hist.pop();
      SZ.op = null;
      SK.op = null;
      szRefresh(b);
      szSelect([
        op.z === 'face'
          ? { b, j: op.j, face: op.fi }
          : op.ent0 || { b, j: op.j, vd: op.vd, floor: op.z === 'floor' ? 1 : undefined, i: op.i },
      ]);
    } else {
      const ent = op.ent,
        hud0 = op.z === 'face' && op.last > 0;
      SZ.op = null;
      SK.op = null;
      szRefresh(b);
      szSelect(hud0 || !ent ? [] : [ent]);
      szMsg(
        op.filled
          ? 'Innenhof wieder aufgefüllt'
          : op.z === 'face'
            ? op.last > 0
              ? 'Aufgestockt um ' +
                op.last +
                ' Geschoss' +
                (op.last === 1 ? '' : 'e') +
                ' – Dach anklicken: Ziehen & Schieben stockt weiter auf'
              : 'Innenhof ausgeschnitten – Wände und Boden lassen sich greifen und ziehen'
            : 'Übernommen',
      );
    }
  }
  SK.vcb = '';
  skVcbShow();
  SK.ver++;
  rr();
}
// ---- Löschen (Fläche entfernen / Innenhof wieder auffüllen)
function szDelete() {
  const sp = SK.sel.filter((e) => szSp(e) && szObj(e));
  if (!sp.length) return false;
  const bs = new Set(sp.map((e) => e.b));
  hist();
  sp.filter((e) => e.face != null)
    .sort((x, y) => y.face - x.face)
    .forEach((e) => {
      const l = e.b.levels[e.j];
      l.faces.splice(e.face, 1);
      if (!l.faces.length) delete l.faces;
    });
  [...new Set(sp.filter((e) => e.vd != null).map((e) => e.b.id + '|' + e.vd))]
    .map((s) => {
      const [id, i] = s.split('|');
      return { b: S.bld.find((x) => x.id === id), i: +i };
    })
    .sort((x, y) => y.i - x.i)
    .forEach((o) => o.b.voids.splice(o.i, 1));
  bs.forEach(szRefresh);
  SK.sel = SK.sel.filter((e) => !szSp(e));
  SK.ver++;
  skSync();
  szMsg('Gelöscht');
  return true;
}
// ---- Einbindung in die Werkzeugkette
{
  const _d = SK.opDown;
  SK.opDown = function (e) {
    const o = SZ.op;
    if (o && o.armed) {
      o.armed = false;
      o.ending = 1;
      if (o.z === 'm') szMMouse(e);
      else szPMouse(e);
      return true;
    }
    const t = SK.tool;
    if (t === 'r' || t === 'z') return szDDown(e);
    if (t === 'l') {
      if (SZ.d) return szDDown(e);
      const en = skHit(e),
        q = szEntOf(en);
      if (q && szFlat(q.b, q.j)) return szDDown(e);
    }
    if (t === 'p' || t === 'm') {
      const en = skHit(e);
      if (szSp(en)) {
        if (t === 'p') {
          szPStart(en, e);
          szMsg(
            en.face != null
              ? 'Ziehen & Schieben · nach oben ziehen = Geschosse, nach unten = Innenhof ausschneiden · Zahl + Enter'
              : en.floor
                ? 'Ziehen & Schieben Hofboden · nach unten = tiefer, nach oben = flacher'
                : 'Ziehen & Schieben Hofwand · Hof vergrößern/verkleinern · Zahl + Enter = Meter',
          );
          return true;
        }
        szMStart(en, e);
        szMsg('Verschieben · Maus ziehen (oder klicken, bewegen, klicken) · Strg beim Start = kopieren');
        return true;
      }
    }
    return _d(e);
  };
}
{
  const _m = SK.opMove;
  SK.opMove = function (e) {
    if (SZ.op) {
      szOpMove(e);
      return true;
    }
    return _m(e);
  };
}
{
  const _u = SK.opUp;
  SK.opUp = function (e) {
    if (SZ.op) {
      szOpUp(e);
      return true;
    }
    return _u(e);
  };
}
{
  const _e = SK.opEsc;
  SK.opEsc = function () {
    if (SZ.op) {
      szOpEnd(false);
      szMsg('Abgebrochen');
      return true;
    }
    if (SZ.d) {
      szReset();
      SK.vcb = '';
      skVcbShow();
      szMsg('Zeichnen abgebrochen');
      return true;
    }
    return _e();
  };
}
// skTool(): Erweiterung zusammengeführt, siehe 26-modellier-modus/030-leiste.js
{
  const _k = SK.keys;
  SK.keys = function (e) {
    const k = e.key,
      d = SZ.d,
      op = SZ.op;
    if ((!op && !d) || (k !== 'Enter' && k !== 'Backspace')) {
      if (k === 'r' || k === 'R') {
        skTool('r');
        szMsg('Rechteck · auf die Dachfläche klicken (Ecke), dann zweite Ecke');
        return true;
      }
      if (k === 'z' || k === 'Z') {
        skTool('z');
        szMsg('Polygon · Punkte auf der Dachfläche klicken, ersten Punkt anklicken = schließen');
        return true;
      }
      if (k === 'Delete' && SK.sel.some(szSp)) return szDelete();
    }
    if (d && (d.kind === 'r' || d.kind === 'z')) {
      if (/^[0-9.,\-xX;]$/.test(k)) {
        SK.vcb += k.toLowerCase();
        skVcbShow();
        return true;
      }
      if (k === 'Backspace') {
        if (SK.vcb) {
          SK.vcb = SK.vcb.slice(0, -1);
          skVcbShow();
          return true;
        }
        if (d.kind === 'z' && d.pts.length) {
          d.pts.pop();
          if (!d.pts.length) {
            SZ.d = null;
            SZP.visible = false;
          }
          return true;
        }
        return false;
      }
      if (k === 'Enter') {
        if (d.kind === 'r' && d.pts.length) {
          const s = (SK.vcb || '').replace(/,/g, '.').split(/[x;]/),
            w = parseFloat(s[0]),
            h = s.length > 1 && s[1] !== '' ? parseFloat(s[1]) : w;
          if (!isFinite(w) || !isFinite(h) || !w || !h) return false;
          const cur = d.cur || d.pts[0],
            r0 = szRect(d, cur),
            sw = (r0[1][0] - r0[0][0]) * d.u[0] + (r0[1][1] - r0[0][1]) * d.u[1] < 0 ? -1 : 1,
            sh = (r0[3][0] - r0[0][0]) * -d.u[1] + (r0[3][1] - r0[0][1]) * d.u[0] < 0 ? -1 : 1,
            p0 = d.pts[0],
            u = d.u,
            v = [-u[1], u[0]],
            W = Math.abs(w) * sw,
            Hh = Math.abs(h) * sh;
          const poly = [
            p0,
            [p0[0] + u[0] * W, p0[1] + u[1] * W],
            [p0[0] + u[0] * W + v[0] * Hh, p0[1] + u[1] * W + v[1] * Hh],
            [p0[0] + v[0] * Hh, p0[1] + v[1] * Hh],
          ];
          SK.vcb = '';
          if (szNew(d, poly)) szReset();
          skVcbShow();
          return true;
        }
        if (d.kind === 'z') {
          const v = skVcbVal();
          if (v != null && d.pts.length && d.cur) {
            const a = d.pts[d.pts.length - 1],
              L = Math.hypot(d.cur[0] - a[0], d.cur[1] - a[1]) || 1,
              q = [a[0] + ((d.cur[0] - a[0]) / L) * v, a[1] + ((d.cur[1] - a[1]) / L) * v];
            d.pts.push(q);
            SK.vcb = '';
            skVcbShow();
            return true;
          }
          if (d.pts.length >= 3) {
            if (szNew(d, d.pts)) szReset();
            return true;
          }
          return false;
        }
      }
    }
    if (
      (op && op.z !== 'm') ||
      (!op && SK.tool === 'p' && SK.sel.some((x) => szSp(x) && (x.face != null || x.vd != null)))
    ) {
      if (op && /^[0-9.,\-gG]$/.test(k)) {
        SK.vcb += k.toLowerCase();
        skVcbShow();
        return true;
      }
      if (op && k === 'Backspace' && SK.vcb) {
        SK.vcb = SK.vcb.slice(0, -1);
        skVcbShow();
        return true;
      }
      if (k === 'Enter') {
        const v = skVcbVal();
        if (v == null) return false;
        const g = /g/.test(SK.vcb || '');
        let p = op;
        if (!p) {
          const en = SK.sel.find(szSp);
          p = szPStart(en, { clientX: 0, clientY: 0 });
        }
        const val =
          p.z === 'wall'
            ? v
            : g
              ? v
              : v /
                (p.z === 'face'
                  ? p.b.levels[p.j].h
                  : p.b.levels[Math.max(0, (p.b.voids[p.vd] || { j0: 0 }).j0)].h || 3);
        if (szPApply(p, val)) {
          szOpEnd(true);
        } else {
          szMsg(p.msg || 'Wert nicht möglich');
          szPApply(p, p.last);
          szOpEnd(false);
        }
        SK.vcb = '';
        skVcbShow();
        return true;
      }
    }
    return _k(e);
  };
}
