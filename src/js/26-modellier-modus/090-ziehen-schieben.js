// ---- Ziehen & Schieben: Fläche (hoch = Geschosse, runter = Innenhof), Hofwand (Hof verkleinern/vergrößern), Hofboden (Tiefe)
// op.val: Fläche/Boden = Anzahl Geschosse (ganzzahlig, vorzeichenbehaftet), Wand = Meter
function szFaceApply(op, n) {
  const b = op.b;
  szRestore(b, op.s0);
  const j = op.j,
    l = b.levels[j],
    f = l.faces[op.fi];
  op.msg = '';
  op.ent = { b, j, face: op.fi };
  n = Math.max(-(j + 1), Math.min(40, Math.round(n)));
  op.n = n;
  if (n === 0) return true;
  const poly = f.poly.map((q) => q.slice());
  if (n > 0) {
    const last = b.levels.length - 1;
    for (let k = 1; k <= n; k++) {
      const lev = j + k;
      if (lev <= last && (b.voids || []).some((v) => lev >= v.j0 && lev <= v.j1 && znOverlap(v.poly, poly))) {
        op.msg = 'Dort liegt im Geschoss darüber ein Innenhof – Hof über den Hofboden auffüllen';
        return false;
      }
    }
    l.faces.splice(op.fi, 1);
    if (!l.faces.length) delete l.faces;
    const tmpl = JSON.parse(JSON.stringify(b.levels[last]));
    delete tmpl.name;
    delete tmpl.units;
    delete tmpl.cuts;
    delete tmpl.faces;
    for (let k = 1; k <= n; k++) {
      const lev = j + k;
      if (lev <= last) {
        const L = b.levels[lev];
        if ((L.faces || []).some((f) => znOverlap(f.poly, poly))) {
          op.msg = 'Auf dem Geschoss darüber liegt schon eine gezeichnete Fläche';
          return false;
        }
        const u = boolUnion([bpP(lf(b, L))], [bpP(poly)]);
        if (u.length !== 1) {
          op.msg =
            'Die Fläche muss an das Geschoss darüber anschließen (gemeinsame Kante), damit sie dort Teil des Grundrisses wird';
          return false;
        }
        L.fp = u[0].o.map((r) => [r[0], r[1]]);
        u[0].h.forEach((h) =>
          szAddHole(
            b,
            h.map((r) => [r[0], r[1]]),
            lev,
          ),
        );
      } else {
        const c = JSON.parse(JSON.stringify(tmpl));
        c.fp = poly.map((r) => r.slice());
        b.levels.push(c);
      }
    }
    op.ent = null;
    return true;
  }
  const m = -n,
    v = { poly, j0: j - m + 1, j1: j };
  l.faces.splice(op.fi, 1);
  if (!l.faces.length) delete l.faces;
  (b.voids = b.voids || []).push(v);
  if (!szOkV(b, poly, v.j0, v.j1, v)) {
    szRestore(b, op.s0);
    const msg = szNotch(b, j, m, poly, op.fi);
    if (msg) {
      szRestore(b, op.s0);
      op.msg = msg;
      return false;
    }
    op.ent = j - m + 1 > 0 ? { b, j: j - m, face: (b.levels[j - m].faces || []).length - 1 } : null;
    op.cut = 1;
    return true;
  }
  op.ent = { b, j, vd: b.voids.length - 1, floor: 1 };
  return true;
}
// Einschnitt: Teilfläche am Gebäuderand nach unten = Riegel wird niedriger, die Seiten folgen (Grundriss der Geschosse wird abgeschnitten)
function szAddHole(b, ring, lev) {
  b.voids = b.voids || [];
  const same = (p, q) =>
    boolArea(boolDiff([bpP(p)], [bpP(q)])) < 0.05 && boolArea(boolDiff([bpP(q)], [bpP(p)])) < 0.05;
  const v = b.voids.find((x) => x.j1 === lev - 1 && same(x.poly, ring));
  if (v) v.j1 = lev;
  else b.voids.push({ poly: ring, j0: lev, j1: lev });
}
function szNotch(b, j, m, poly, fi) {
  const old = b.fp.map((q) => q.slice());
  b.levels.forEach((L) => {
    if (!L.fp) L.fp = old.map((q) => q.slice());
  });
  const lo = Math.max(0, j - m + 1),
    vs = b.voids || [],
    hit = vs.filter(
      (v) => v.j1 >= lo && v.j0 <= j && (znOverlap(v.poly, poly) || szShared(v.poly, poly) > 0.05),
    );
  if (hit.some((v) => v.j1 > j)) return 'Der Innenhof reicht über die Fläche hinaus nach oben';
  for (let i = lo; i <= j; i++) {
    let R = boolDiff([bpP(b.levels[i].fp)], [bpP(poly)]);
    const cut = hit.filter((v) => v.j0 <= i && v.j1 >= i);
    if (cut.length)
      R = boolDiff(
        R,
        cut.map((v) => bpP(v.poly)),
      );
    R = R.filter((P) => boolArea([P]) > 0.05);
    if (!R.length) return 'Das würde das ganze Geschoss entfernen';
    if (R.length !== 1 || R[0].h.length)
      return 'Der Einschnitt würde das Gebäude teilen oder einen Hof ergeben';
    b.levels[i].fp = R[0].o.map((q) => [q[0], q[1]]);
  }
  hit.forEach((v) => {
    if (v.j0 < lo) v.j1 = lo - 1;
    else vs.splice(vs.indexOf(v), 1);
  });
  if (
    vs.some((v) =>
      b.levels.slice(Math.max(lo, v.j0), Math.min(j, v.j1) + 1).some((L) => !znInterior(L.fp, v.poly)),
    )
  )
    return 'Ein Innenhof würde den Gebäuderand berühren';
  const L = b.levels[j];
  L.faces.splice(fi, 1);
  if (!L.faces.length) delete L.faces;
  if (lo > 0) {
    const L2 = b.levels[lo - 1];
    (L2.faces = L2.faces || []).push({ poly: poly.map((q) => q.slice()), part: 1 });
  }
  if (lo === 0) b.fp = b.levels[0].fp.map((q) => q.slice());
  return '';
}
function szWallApply(op, d) {
  const b = op.b;
  szRestore(b, op.s0);
  const v = b.voids[op.vd],
    m = op.orig.length;
  op.msg = '';
  op.ent = { b, j: v.j1, vd: op.vd, i: op.i };
  const q = offEdge(op.orig, op.i, op.nin, d),
    r = op.orig.map((p) => p.slice());
  r[op.i] = q[op.i];
  r[(op.i + 1) % m] = q[(op.i + 1) % m];
  if (r.some((p) => !isFinite(p[0]) || !isFinite(p[1])) || skArea(r) * skArea(op.orig) <= 0) {
    op.msg = 'Wert nicht möglich';
    return false;
  }
  v.poly = r;
  if (!szOkV(b, r, v.j0, v.j1, v)) {
    op.msg = 'Der Hof würde den Gebäuderand berühren oder sich selbst überschneiden';
    return false;
  }
  return true;
}
function szFloorApply(op, n) {
  const b = op.b;
  szRestore(b, op.s0);
  const v = b.voids[op.vd];
  op.msg = '';
  op.ent = { b, j: v.j0 - 1, vd: op.vd, floor: 1 };
  n = Math.round(n);
  op.n = n;
  if (n === 0) return true;
  const j0 = Math.max(0, Math.min(v.j1 + 1, v.j0 + n));
  if (j0 > v.j1) {
    b.voids.splice(op.vd, 1);
    op.ent = null;
    op.filled = 1;
    return true;
  }
  v.j0 = j0;
  if (!szOkV(b, v.poly, v.j0, v.j1, v)) {
    op.msg = 'So tief/hoch nicht möglich';
    return false;
  }
  op.ent = v.j0 > 0 ? { b, j: v.j0 - 1, vd: op.vd, floor: 1 } : { b, j: v.j1, vd: op.vd, i: 0 };
  return true;
}
function szPApply(op, val) {
  op.filled = 0;
  const ok =
    op.z === 'face' ? szFaceApply(op, val) : op.z === 'wall' ? szWallApply(op, val) : szFloorApply(op, val);
  if (!ok) return false;
  op.last = val;
  mesh(op.b);
  return true;
}
function szPHud(op) {
  const v = op.last;
  if (op.z === 'face') {
    const hs = op.b.levels[op.j].h;
    szMsg(
      v > 0
        ? '+' +
            v +
            ' Geschoss' +
            (v === 1 ? '' : 'e') +
            ' (+' +
            szF(v * hs) +
            ' m) mit dem Grundriss dieser Fläche · Zahl + Enter = Meter, Zahl + g = Geschosse · Esc'
        : v < 0
          ? 'Innenhof durch ' +
            -v +
            ' Geschoss' +
            (v === -1 ? '' : 'e') +
            ' (' +
            szF(-v * hs) +
            ' m tief) ausgeschnitten · Zahl + Enter · Esc'
          : 'Ziehen & Schieben · nach oben = Geschosse, nach unten = Innenhof',
    );
  } else if (op.z === 'wall')
    szMsg(
      'Hofwand ' +
        (v >= 0 ? '+' : '') +
        szF(v) +
        ' m (' +
        (v >= 0 ? 'Hof wird kleiner' : 'Hof wird größer') +
        ') · Zahl + Enter = exakt · Esc',
    );
  else
    szMsg(
      op.filled
        ? 'Innenhof wieder aufgefüllt'
        : 'Hofboden ' +
            (v > 0
              ? '+' + v + ' Geschoss' + (v === 1 ? '' : 'e') + ' höher'
              : v < 0
                ? -v + ' Geschoss' + (v === -1 ? '' : 'e') + ' tiefer'
                : 'unverändert') +
            ' · Zahl + Enter · Esc',
    );
}
function szPStart(en, e) {
  const b = en.b,
    op = {
      kind: 'z',
      z: en.face != null ? 'face' : en.floor ? 'floor' : 'wall',
      b,
      j: en.j,
      fi: en.face,
      vd: en.vd,
      i: en.i,
      x: e.clientX,
      y: e.clientY,
      mv: 0,
      armed: false,
      s0: szSnap0(b),
      last: 0,
      ent: en,
      n: 0,
      msg: '',
    };
  hist();
  op.hl = S.hist.length;
  if (op.z === 'wall') {
    const v = b.voids[en.vd];
    op.orig = v.poly.map((q) => q.slice());
    op.nin = szNin(op.orig, en.i);
    op.wy = (skZ(b, v.j0) + szTop(b, v.j1)) / 2;
    op.p0 = planePt(e, op.wy);
    op.cand = null;
  }
  SZ.op = op;
  SK.op = op;
  SK.hv = null;
  SK.ver++;
  skVcbShow();
  return op;
}
function szPMouse(e) {
  const op = SZ.op;
  let val;
  if (op.z === 'wall') {
    const p = planePt(e, op.wy);
    if (!p || !op.p0) return;
    val = Math.round(((p[0] - op.p0[0]) * op.nin[0] + (p[1] - op.p0[1]) * op.nin[1]) * 20) / 20;
  } else val = Math.round(-(e.clientY - op.y) / 18);
  if (!szPApply(op, val)) {
    szMsg(op.msg || 'Nicht möglich');
    szPApply(op, op.last);
    return;
  }
  szPHud(op);
}
