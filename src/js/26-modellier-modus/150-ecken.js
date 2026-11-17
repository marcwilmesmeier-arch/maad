/* Seitenecken als Konturfluchten (wie Spacio): im Auswahl-Werkzeug ist ein Klick nahe einer senkrechten Gebäudeecke
   die Ecke – über alle Geschosse, deren Grundriss an dieser Stelle eine Ecke hat. Eine gewählte Ecke anfassen und
   ziehen verschiebt sie im Grundriss; Fang auf die Richtungen der beiden angrenzenden Wände (Alt = frei).
   Eintrag in der Auswahl: { b, j, ek } (ek = Index der Ecke im Grundriss des Geschosses j). */
/** Ecke der Wand i im Geschoss j, wenn der Treffer nah genug an deren Anfang oder Ende liegt (sonst null). */
function skEckeBei(b, j, i, pt) {
  const f = lf(b, b.levels[j]),
    n = f.length,
    a = f[i],
    c = f[(i + 1) % n],
    thr = Math.max(0.25, Math.min(0.9, 10 * mpp())),
    da = Math.hypot(pt.x - a[0], pt.z - a[1]),
    dc = Math.hypot(pt.x - c[0], pt.z - c[1]);
  if (Math.min(da, dc) > thr) return null;
  const v = da <= dc ? a : c;
  // gleiche Stelle kann mehrfach vorkommen (Teilen legt doppelte Punkte an): ersten echten Eckpunkt nehmen;
  // eine Schnittlinie (Punkt auf gerader Wand) ist ebenso greifbar
  for (let q = 0; q < n; q++)
    if (Math.hypot(f[q][0] - v[0], f[q][1] - v[1]) < 0.05 && (skEckeEcht(f, q) || skSchnittPunkt(f, q)))
      return q;
  return null;
}
/** true, wenn Punkt q eine Schnittlinie ist: die Wand läuft dort gerade weiter (Knick unter 0,5°). */
function skSchnittPunkt(f, q) {
  const N = skEckeNachbarn(f, q);
  if (!N) return false;
  const [p, r] = N,
    v = f[q],
    u1 = [v[0] - p[0], v[1] - p[1]],
    u2 = [r[0] - v[0], r[1] - v[1]],
    l = Math.hypot(...u1) * Math.hypot(...u2) || 1,
    cr = (u1[0] * u2[1] - u1[1] * u2[0]) / l,
    dt = (u1[0] * u2[0] + u1[1] * u2[1]) / l;
  return dt > 0 && Math.abs(Math.atan2(cr, dt)) < (0.5 * Math.PI) / 180;
}
/** Auswahl besteht nur aus Schnittlinien (gerade weiterlaufende Fassade) – dann kann der Schnitt entfernt werden. */
function skSchnittAuswahl() {
  const s = SK.sel;
  return s.length > 0 && s.every((x) => x.ek != null && skSchnittPunkt(lf(x.b, x.b.levels[x.j]), x.ek));
}
/** Gewählte Schnittlinie(n) entfernen: Punkt aus den Grundrissen der gewählten Geschosse nehmen. */
function skSchnittWeg() {
  if (!skSchnittAuswahl()) return;
  const b = SK.sel[0].b;
  hist();
  const pts = SK.sel.map((x) => lf(b, b.levels[x.j])[x.ek].slice()),
    fertig = new Set();
  SK.sel.forEach((x, k) => {
    const l = b.levels[x.j],
      f = lf(b, l);
    if (fertig.has(f)) return; // gemeinsamer Grundriss (b.fp) nur einmal
    fertig.add(f);
    const v = pts[k],
      q = f.findIndex((P, i) => Math.hypot(P[0] - v[0], P[1] - v[1]) < 0.05 && skSchnittPunkt(f, i));
    if (q < 0 || f.length <= 3) return;
    const neu = f.filter((_, i) => i !== q).map((P) => P.slice());
    if (l.fp) l.fp = neu;
    else b.fp = neu;
  });
  mesh(b);
  H();
  hpos();
  rr();
  skNachAktion(b, 'Schnitt entfernt · ' + SK.sel.length + ' Geschoss' + (SK.sel.length === 1 ? '' : 'e'));
}
/** true, wenn an Punkt q die Kontur deutlich abknickt (über 20° – flache Knicke einer Ausrundung zählen nicht). */
function skEckeEcht(f, q) {
  const N = skEckeNachbarn(f, q);
  if (!N) return false;
  const [p, r] = N,
    v = f[q],
    u1 = [v[0] - p[0], v[1] - p[1]],
    u2 = [r[0] - v[0], r[1] - v[1]],
    cr = (u1[0] * u2[1] - u1[1] * u2[0]) / (Math.hypot(...u1) * Math.hypot(...u2) || 1);
  const dt = (u1[0] * u2[0] + u1[1] * u2[1]) / (Math.hypot(...u1) * Math.hypot(...u2) || 1);
  return Math.abs(Math.atan2(cr, dt)) > (20 * Math.PI) / 180;
}
/** Nächste vom Punkt q verschiedene Nachbarpunkte davor und danach. */
function skEckeNachbarn(f, q) {
  const n = f.length,
    v = f[q];
  let p = null,
    r = null;
  for (let k = 1; k < n && !p; k++) {
    const x = f[(q - k + n) % n];
    if (Math.hypot(x[0] - v[0], x[1] - v[1]) > 0.05) p = x;
  }
  for (let k = 1; k < n && !r; k++) {
    const x = f[(q + k) % n];
    if (Math.hypot(x[0] - v[0], x[1] - v[1]) > 0.05) r = x;
  }
  return p && r ? [p, r] : null;
}
/** Konturflucht: dieselbe Ecke in allen Geschossen. */
function skEckGruppe(en) {
  const b = en.b,
    v = lf(b, b.levels[en.j])[en.ek],
    out = [];
  b.levels.forEach((l, j) => {
    const f = lf(b, l);
    for (let q = 0; q < f.length; q++)
      if (Math.hypot(f[q][0] - v[0], f[q][1] - v[1]) < 0.05 && (skEckeEcht(f, q) || skSchnittPunkt(f, q))) {
        out.push({ b, j, ek: q });
        return;
      }
  });
  return out.length ? out : [en];
}
/** Hervorhebung einer Ecke: zwei schmale Streifen entlang der angrenzenden Wände (aus skQuadsBasis). */
function skEckeQuads(f, q, z0, z1, pos, lp, line) {
  const N = skEckeNachbarn(f, q);
  if (!N) return;
  const v = f[q];
  N.forEach((p) => {
    const L = Math.hypot(p[0] - v[0], p[1] - v[1]) || 1,
      w = Math.min(0.45, L / 3),
      a = [v[0] + ((p[0] - v[0]) / L) * w, v[1] + ((p[1] - v[1]) / L) * w];
    pos.push(v[0], z0, v[1], a[0], z0, a[1], a[0], z1, a[1], v[0], z0, v[1], a[0], z1, a[1], v[0], z1, v[1]);
  });
  if (line) lp.push(v[0], z0, v[1], v[0], z1, v[1]);
}
// ---- Ziehen
function skEckDown(e) {
  if (e.altKey && !SK.sel.some((x) => x.ek != null)) return false;
  const en = skHit(e);
  if (!en || en.ek == null || !skHas(en)) return false;
  const b = en.b,
    tg = SK.sel.filter((x) => x.ek != null && x.b === b),
    f = lf(b, b.levels[en.j]),
    v = f[en.ek].slice(),
    N = skEckeNachbarn(f, en.ek),
    wy = skZ(b, en.j) + b.levels[en.j].h / 2,
    orig = {};
  tg.forEach((x) => {
    orig[x.j] = lf(b, b.levels[x.j]).map((q) => q.slice());
  });
  hist();
  SK.op = {
    kind: 'e',
    b,
    tg,
    v,
    orig,
    wy,
    p0: planePt(e, wy),
    dirs: N ? N.map((p) => [v[0] - p[0], v[1] - p[1]]) : [],
    bfp: b.levels.every((l) => !l.fp) || JSON.stringify(b.fp) === JSON.stringify(orig[tg[0].j]),
    hl: JSON.stringify(S.hist.length),
    x: e.clientX,
    y: e.clientY,
    mv: 0,
  };
  SK.hv = null;
  SK.ver++;
  return true;
}
function skEckSetzen(op, P) {
  const b = op.b;
  op.tg.forEach((x) => {
    const fp = op.orig[x.j].map((q) => q.slice());
    fp.forEach((q, k) => {
      if (Math.hypot(q[0] - op.v[0], q[1] - op.v[1]) < 0.05) fp[k] = P.slice();
    });
    b.levels[x.j].fp = fp;
  });
  if (op.bfp && b.levels[0].fp) b.fp = b.levels[0].fp.map((q) => q.slice());
  mesh(b);
}
function skEckMove(e) {
  const op = SK.op;
  if (Math.hypot(e.clientX - op.x, e.clientY - op.y) > 4) op.mv = 1;
  if (!op.mv) return true;
  const p = planePt(e, op.wy);
  if (!p || !op.p0) return true;
  let P = [op.v[0] + p[0] - op.p0[0], op.v[1] + p[1] - op.p0[1]],
    lab = '';
  if (!e.altKey) {
    // Fang: auf der Verlängerung einer angrenzenden Wand bleiben (Wand wird länger/kürzer, Nachbarwand verschiebt sich parallel)
    const thr = Math.max(0.15, 12 * mpp());
    let bd = thr;
    op.dirs.forEach((d, k) => {
      const L = Math.hypot(d[0], d[1]) || 1,
        u = [d[0] / L, d[1] / L],
        t = (P[0] - op.v[0]) * u[0] + (P[1] - op.v[1]) * u[1],
        Q = [op.v[0] + u[0] * t, op.v[1] + u[1] * t],
        dd = Math.hypot(P[0] - Q[0], P[1] - Q[1]);
      if (dd < bd) {
        bd = dd;
        P = [op.v[0] + (u[0] * Math.round(t * 20)) / 20, op.v[1] + (u[1] * Math.round(t * 20)) / 20];
        lab = k ? 'in Richtung der folgenden Wand' : 'in Richtung der vorigen Wand';
      }
    });
    if (!lab) P = [Math.round(P[0] * 20) / 20, Math.round(P[1] * 20) / 20];
  }
  op.P = P;
  skEckSetzen(op, P);
  SK.ver++;
  try {
    $('hud').textContent =
      'Ecke verschieben ' +
      f1(Math.hypot(P[0] - op.v[0], P[1] - op.v[1]), 2).replace('.', ',') +
      ' m' +
      (lab ? ' · Fang: ' + lab : '') +
      ' · ' +
      op.tg.length +
      ' Geschoss' +
      (op.tg.length === 1 ? '' : 'e') +
      ' · Alt = frei · Esc = abbrechen';
  } catch (x) {
    logErr(x, 'skEckMove');
  }
  return true;
}
function skEckUp() {
  skEckEnde(!!(SK.op && SK.op.mv && SK.op.P));
  return true;
}
function skEckEnde(commit) {
  const op = SK.op;
  if (!op || op.kind !== 'e') return;
  SK.op = null;
  const b = op.b;
  if (!commit) {
    op.tg.forEach((x) => {
      b.levels[x.j].fp = op.orig[x.j].map((q) => q.slice());
    });
    if (op.bfp && b.levels[0].fp) b.fp = b.levels[0].fp.map((q) => q.slice());
    mesh(b);
    if (S.hist.length && JSON.stringify(S.hist.length) === op.hl) S.hist.pop();
    SK.ver++;
    $('hud').textContent = op.mv ? 'Ecke verschieben abgebrochen' : skInfo();
    return;
  }
  try {
    if (znCleanFp(b)) mesh(b);
  } catch (e) {
    logErr(e, 'skEckEnde');
  }
  H();
  hpos();
  rr();
  skNachAktion(
    b,
    'Ecke verschoben · ' + f1(Math.hypot(op.P[0] - op.v[0], op.P[1] - op.v[1]), 2).replace('.', ',') + ' m',
  );
}
// ---- Ausrunden: gewählte Ecke(n) durch einen Bogen mit Radius r ersetzen (in allen gewählten Geschossen)
/** Bogenpunkte für die Ecke q im Grundriss f (oder null, wenn der Radius nicht passt). */
function skEckBogen(f, q, r) {
  const N = skEckeNachbarn(f, q);
  if (!N) return null;
  const v = f[q],
    [p, n] = N,
    L1 = Math.hypot(p[0] - v[0], p[1] - v[1]),
    L2 = Math.hypot(n[0] - v[0], n[1] - v[1]),
    u1 = [(p[0] - v[0]) / L1, (p[1] - v[1]) / L1],
    u2 = [(n[0] - v[0]) / L2, (n[1] - v[1]) / L2],
    th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
  if (th < 0.05 || th > Math.PI - 0.05) return null;
  const t = r / Math.tan(th / 2);
  if (t > Math.min(L1, L2) - 0.01) return null;
  const T1 = [v[0] + u1[0] * t, v[1] + u1[1] * t],
    T2 = [v[0] + u2[0] * t, v[1] + u2[1] * t],
    bi = [u1[0] + u2[0], u1[1] + u2[1]],
    bl = Math.hypot(bi[0], bi[1]) || 1,
    dc = r / Math.sin(th / 2),
    C = [v[0] + (bi[0] / bl) * dc, v[1] + (bi[1] / bl) * dc],
    a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
  let sw = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
  while (sw > Math.PI) sw -= 2 * Math.PI;
  while (sw < -Math.PI) sw += 2 * Math.PI;
  const k = Math.max(3, Math.ceil(Math.abs(sw) / (Math.PI / 16))),
    out = [];
  for (let s = 0; s <= k; s++) {
    const a = a1 + (sw * s) / k;
    out.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]);
  }
  return out;
}
function skEckRunden(rv) {
  const r = parseFloat(String(rv).replace(',', '.')),
    tg = SK.sel.filter((x) => x.ek != null);
  if (!tg.length || !isFinite(r) || r < 0.1) {
    $('hud').textContent = 'Ausrunden: Radius in m eingeben (ab 0,1)';
    return;
  }
  const b = tg[0].b,
    neu = {};
  for (const x of tg) {
    const f = lf(b, b.levels[x.j]),
      B = skEckBogen(f, x.ek, r);
    if (!B) {
      $('hud').textContent =
        'Ausrunden: Radius ' + f1(r, 2).replace('.', ',') + ' m passt nicht an diese Ecke (Wände zu kurz)';
      return;
    }
    const v = f[x.ek],
      fp = [];
    let drin = false;
    f.forEach((q) => {
      if (Math.hypot(q[0] - v[0], q[1] - v[1]) < 0.05) {
        if (!drin) B.forEach((p) => fp.push(p));
        drin = true;
      } else fp.push(q.slice());
    });
    neu[x.j] = fp;
  }
  hist();
  const bfp =
    b.levels.every((l) => !l.fp) || JSON.stringify(b.fp) === JSON.stringify(lf(b, b.levels[tg[0].j]));
  for (const j in neu) b.levels[j].fp = neu[j];
  if (bfp && b.levels[0].fp) b.fp = b.levels[0].fp.map((q) => q.slice());
  if (b.kind === 'rect' || b.kind === 'circ') b.kind = 'free';
  mesh(b);
  H();
  hpos();
  rr();
  try {
    localStorage.setItem('maad.eckR', String(r));
  } catch (e) {
    logErr(e, 'skEckRunden');
  }
  skNachAktion(
    b,
    'Ecke ausgerundet · Radius ' +
      f1(r, 2).replace('.', ',') +
      ' m · ' +
      tg.length +
      ' Geschoss' +
      (tg.length === 1 ? '' : 'e'),
  );
}
function skEckRadiusVorgabe() {
  try {
    return localStorage.getItem('maad.eckR') || '2';
  } catch (e) {
    logErr(e, 'skEckRadiusVorgabe');
    return '2';
  }
}
/** Alle Wandstücke eines Geschosses, die über flache Knicke (Ausrundung) mit der Wand en verbunden sind. */
function skGlattKette(en) {
  if (en.i == null || en.top || szSp(en)) return [en];
  const b = en.b,
    f = lf(b, b.levels[en.j]),
    n = f.length,
    lg = (i) => Math.hypot(f[(i + 1) % n][0] - f[i][0], f[(i + 1) % n][1] - f[i][1]),
    // Knick an Punkt q in Grad
    knick = (q) => {
      const N = skEckeNachbarn(f, q);
      if (!N) return 0;
      const v = f[q],
        u1 = [v[0] - N[0][0], v[1] - N[0][1]],
        u2 = [N[1][0] - v[0], N[1][1] - v[1]];
      return Math.abs(
        (Math.atan2(u1[0] * u2[1] - u1[1] * u2[0], u1[0] * u2[0] + u1[1] * u2[1]) * 180) / Math.PI,
      );
    },
    L0 = lg(en.i),
    // Bogensegment: etwa gleich lang wie die angeklickte Wand, Übergang mit leichtem Knick (1°–20°)
    passt = (i, q) => {
      const k = knick(q);
      return k > 1 && k <= 20 && Math.abs(lg(i) - L0) <= 0.25 * L0;
    },
    out = [{ b, j: en.j, i: en.i }];
  for (let i = en.i, k = 1; k < n; k++) {
    const pv = (i - 1 + n) % n;
    if (pv === en.i || lg(pv) < 0.05 || !passt(pv, i)) break;
    out.unshift({ b, j: en.j, i: pv });
    i = pv;
  }
  for (let i = en.i, k = 1; k < n; k++) {
    const nx = (i + 1) % n;
    if (nx === en.i || out.some((x) => x.i === nx) || lg(nx) < 0.05 || !passt(nx, nx)) break;
    out.push({ b, j: en.j, i: nx });
    i = nx;
  }
  return out;
}
