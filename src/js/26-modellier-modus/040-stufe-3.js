// ================= Stufe 3: Verschieben / Kopieren (M) =================
// Gebäude (Auswahl oder angeklicktes) in der Ebene verschieben: ziehen oder klicken – bewegen – klicken. Strg beim Start = Kopie.
// Pfeiltasten sperren die Achse (→ Ost/West · ← Nord/Süd · ↑ senkrecht · ↓ frei). Zahl + Enter = Strecke in Bewegungsrichtung. Fang auf Ecken anderer Körper und Grundstücke (Alt = ohne Fang).
function skCloneB(b) {
  const c = JSON.parse(
    JSON.stringify({
      name: b.name,
      use: b.use,
      kind: b.kind,
      fp: b.fp,
      levels: b.levels,
      type: b.type,
      roof: b.roof,
      ref: b.ref,
      patches: b.patches,
      ub: b.ub,
      fd: b.fd,
      l2: b.l2,
      voids: b.voids,
    }),
  );
  do {
    c.id = 'building_' + String(S.n).padStart(3, '0');
    S.n++;
  } while (S.bld.some((q) => q.id === c.id));
  c.name = (b.name || 'Gebäude') + ' (Kopie)';
  return c;
}
function skMCap(b) {
  const T = (q) => q.slice();
  return {
    b,
    fp: b.fp.map(T),
    ref: b.ref,
    c0: cen(b.fp),
    lv: b.levels.map((l) => ({
      fp: l.fp && l.fp.map(T),
      cuts: l.cuts && l.cuts.map((c) => c.slice()),
      units: l.units && l.units.map((u) => ({ p: u.p.slice() })),
    })),
    pat: (b.patches || []).map((p) => (p.i === -1 ? p.poly.map(T) : null)),
    vd: (b.voids || []).map((v) => v.poly.map(T)),
    fc: b.levels.map((l) => (l.faces || []).map((f) => f.poly.map(T))),
  };
}
function skMApply(op, dx, dz, dy) {
  op.bs.forEach((o) => {
    const b = o.b,
      T2 = (q) => [q[0] + dx, q[1] + dz];
    b.fp = o.fp.map(T2);
    b.levels.forEach((l, j) => {
      const ol = o.lv[j];
      if (!ol) return;
      if (ol.fp) l.fp = ol.fp.map(T2);
      if (ol.cuts) l.cuts = ol.cuts.map((c) => [c[0] + dx, c[1] + dz, c[2] + dx, c[3] + dz]);
      if (ol.units)
        l.units.forEach((u, q) => {
          u.p = [ol.units[q].p[0] + dx, ol.units[q].p[1] + dz];
        });
    });
    (b.patches || []).forEach((p, i) => {
      if (p.i === -1 && o.pat[i]) p.poly = o.pat[i].map(T2);
    });
    (b.voids || []).forEach((v, i) => {
      if (o.vd && o.vd[i]) v.poly = o.vd[i].map(T2);
    });
    b.levels.forEach((l, j) =>
      (l.faces || []).forEach((f, i) => {
        if (o.fc && o.fc[j] && o.fc[j][i]) f.poly = o.fc[j][i].map(T2);
      }),
    );
    if (o.follow && !dy) {
      const c = cen(b.fp);
      b.ref = gh(c[0], c[1]);
    } else b.ref = o.ref + dy;
    b._gr = null;
    mesh(b);
  });
  op.dx = dx;
  op.dz = dz;
  op.dy = dy;
  H();
  hpos();
  try {
    drawOv();
  } catch (e) {
    logErr(e, 'skMApply');
  }
}
function skMVerts(op) {
  const mine = new Set(op.bs.map((o) => o.b)),
    C = [];
  S.bld.forEach((b) => {
    if (mine.has(b)) return;
    C.push(...b.fp);
    b.levels.forEach((l) => {
      if (l.fp) C.push(...l.fp);
    });
  });
  S.ex.forEach((b) => C.push(...b.fp));
  P.concat(AL).forEach((a) => a.poly.forEach((c) => C.push(c)));
  return C;
}
function skMStart(e, ent) {
  const sel =
    SK.sel.length && SK.sel.some((x) => x.b === ent.b) ? [...new Set(SK.sel.map((x) => x.b))] : [ent.b];
  hist();
  let bs = sel.slice(),
    copy = !!e.ctrlKey;
  if (copy) {
    bs = sel.map((b) => {
      const c = skCloneB(b);
      S.bld.push(c);
      mesh(c);
      return c;
    });
  }
  const op = {
    kind: 'm',
    bs: bs.map(skMCap),
    copy,
    x: e.clientX,
    y: e.clientY,
    mv: 0,
    armed: false,
    lock: null,
    dx: 0,
    dz: 0,
    dy: 0,
    hl: JSON.stringify(S.hist.length),
    clones: copy ? bs : [],
  };
  op.bs.forEach((o) => {
    o.follow = Math.abs((o.ref || 0) - gh(o.c0[0], o.c0[1])) < 0.02;
  });
  const h = (() => {
    ray(e);
    return mdlHit();
  })();
  op.wy = h ? h.point.y : bs[0]._y;
  op.p0 = planePt(e, op.wy);
  op.C = skMVerts(op);
  op.V = op.bs.flatMap((o) => o.fp);
  S.sel = bs[0];
  SK.op = op;
  SK.hv = null;
  SK.ver++;
  return op;
}
function skMMouse(e) {
  const op = SK.op;
  let dx = 0,
    dz = 0,
    dy = 0,
    sn = '';
  if (op.lock === 'y') {
    dy = Math.round(-(e.clientY - op.y) * mpp() * 1.1 * 20) / 20;
  } else {
    const p = planePt(e, op.wy);
    if (!p || !op.p0) return;
    dx = p[0] - op.p0[0];
    dz = p[1] - op.p0[1];
    if (op.lock === 'x') dz = 0;
    if (op.lock === 'z') dx = 0;
    op.snapPt = null;
    if (!e.altKey) {
      const r = Math.min(0.6, Math.max(0.12, 10 * mpp()));
      let bd = r,
        bp = null;
      op.V.forEach((v) => {
        const qx = v[0] + dx,
          qz = v[1] + dz;
        op.C.forEach((c) => {
          const d = Math.hypot(c[0] - qx, c[1] - qz);
          if (d < bd) {
            bd = d;
            bp = [c[0] - v[0], c[1] - v[1]];
          }
        });
      });
      if (bp) {
        if (op.lock === 'x') dx = bp[0];
        else if (op.lock === 'z') dz = bp[1];
        else {
          dx = bp[0];
          dz = bp[1];
        }
        sn = ' · Fang: Ecke';
        op.snapPt = [op.p0[0] + dx, op.p0[1] + dz];
      } else {
        dx = Math.round(dx * 20) / 20;
        dz = Math.round(dz * 20) / 20;
      }
    } else {
      dx = Math.round(dx * 20) / 20;
      dz = Math.round(dz * 20) / 20;
    }
  }
  skMApply(op, dx, dz, dy);
  const L = Math.hypot(dx, dz);
  $('hud').textContent =
    (op.copy ? 'Kopieren ' : 'Verschieben ') +
    (op.lock === 'y'
      ? 'senkrecht ' + (dy >= 0 ? '+' : '') + f1(dy, 2).replace('.', ',') + ' m'
      : f1(L, 2).replace('.', ',') +
        ' m (Ost ' +
        f1(dx, 2).replace('.', ',') +
        ' · Nord ' +
        f1(-dz, 2).replace('.', ',') +
        ')') +
    sn +
    (op.lock ? ' · Achse gesperrt (↓ = frei)' : ' · Pfeile = Achse sperren') +
    ' · Zahl + Enter · Esc';
}
function skMEnd(commit) {
  const op = SK.op;
  if (!op || op.kind !== 'm') return;
  const moved = Math.hypot(op.dx, op.dz, op.dy) > 1e-6;
  if (!commit || !moved) {
    skMApply(op, 0, 0, 0);
    if (op.copy) {
      op.clones.forEach((c) => {
        const i = S.bld.indexOf(c);
        if (i >= 0) S.bld.splice(i, 1);
        if (c._g && c._g.parent) c._g.parent.remove(c._g);
      });
      S.n = Math.max(1, S.n - op.clones.length);
    }
    if (S.hist.length && JSON.stringify(S.hist.length) === op.hl) S.hist.pop();
  } else {
    SK.lastM = [op.dx, op.dz, op.dy];
    if (op.bs.some((o) => o.b.ub))
      try {
        $('hud').textContent += ' ';
      } catch (e) {
        logErr(e, 'skMEnd');
      }
  }
  SK.op = null;
  SK.vcb = '';
  SK.ver++;
  skVcbShow();
  try {
    S.sel = op.bs[0].b;
    H();
    hpos();
    rr();
  } catch (e) {
    logErr(e, 'skMEnd');
  }
  if (commit && moved)
    try {
      $('hud').textContent =
        (op.copy ? 'Kopie angelegt · ' : 'Verschoben · ') +
        f1(Math.hypot(op.dx, op.dz, op.dy), 2).replace('.', ',') +
        ' m';
    } catch (e) {
      logErr(e, 'skMEnd');
    }
}
function skMDown(e) {
  if (SK.tool !== 'm') return false;
  if (SK.op && SK.op.kind === 'm' && SK.op.armed) {
    SK.op.armed = false;
    SK.op.ending = 1;
    skMMouse(e);
    return true;
  }
  const en = skHit(e);
  if (!en) return false;
  skMStart(e, en);
  skVcbShow();
  $('hud').textContent =
    'Verschieben · Maus ziehen (oder klicken, bewegen, klicken) · Strg beim Start = kopieren';
  return true;
}
function skMMove(e) {
  const op = SK.op;
  if (Math.hypot(e.clientX - op.x, e.clientY - op.y) > 4) op.mv = 1;
  if (op.mv || op.armed || op.ending) skMMouse(e);
  op.lastE = e;
  return true;
}
function skMUp(e) {
  const op = SK.op;
  if (op.ending || op.mv) {
    skMEnd(true);
    return true;
  }
  op.armed = true;
  try {
    $('hud').textContent =
      'Verschieben · Maus bewegen, erneut klicken zum Übernehmen · Pfeile = Achse · Zahl + Enter · Esc';
  } catch (e) {
    logErr(e, 'skMUp');
  }
  return true;
}
function skMKeys(e) {
  const k = e.key;
  if (k === 'm' || k === 'M') {
    skTool('m');
    return true;
  }
  const op = SK.op;
  if (!op || op.kind !== 'm') {
    return false;
  }
  const L = { ArrowRight: 'x', ArrowLeft: 'z', ArrowUp: 'y', ArrowDown: null };
  if (k in L) {
    op.lock = L[k];
    if (op.lastE) skMMouse(op.lastE);
    else $('hud').textContent = 'Achse: ' + (op.lock || 'frei');
    return true;
  }
  if (/^[0-9.,\-]$/.test(k)) {
    SK.vcb += k;
    skVcbShow();
    return true;
  }
  if (k === 'Backspace' && SK.vcb) {
    SK.vcb = SK.vcb.slice(0, -1);
    skVcbShow();
    return true;
  }
  if (k === 'Enter') {
    const v = skVcbVal();
    if (v == null) return false;
    let dx = op.dx,
      dz = op.dz,
      dy = op.dy;
    if (op.lock === 'y' || (Math.abs(dy) > 0 && !dx && !dz)) {
      dy = v;
      dx = 0;
      dz = 0;
    } else {
      let ux = dx,
        uz = dz;
      if (op.lock === 'x') {
        ux = 1;
        uz = 0;
      } else if (op.lock === 'z') {
        ux = 0;
        uz = 1;
      }
      const L2 = Math.hypot(ux, uz);
      if (L2 < 1e-9) {
        ux = 1;
        uz = 0;
      } else {
        ux /= L2;
        uz /= L2;
      }
      dx = ux * v;
      dz = uz * v;
      dy = 0;
    }
    skMApply(op, dx, dz, dy);
    skMEnd(true);
    return true;
  }
  return false;
}
SK.opDown = function (e) {
  return SK.tool === 'm' ? skMDown(e) : SK.tool === 'p' ? SK.opDownP(e) : false;
};
SK.opMove = function (e) {
  return SK.op && SK.op.kind === 'm' ? skMMove(e) : SK.opMoveP(e);
};
SK.opUp = function (e) {
  return SK.op && SK.op.kind === 'm' ? skMUp(e) : SK.opUpP(e);
};
SK.opEsc = function () {
  if (SK.op && SK.op.kind === 'm') {
    skMEnd(false);
    try {
      $('hud').textContent = 'Verschieben abgebrochen';
    } catch (e) {
      logErr(e, 'opEsc');
    }
    return true;
  }
  return SK.opEscP();
};
SK.keys = function (e) {
  return skMKeys(e) || SK.keysP(e);
};
