// ======================= ÖFFNUNGEN IN LOD 200: WANDAUSSCHNITTE, RAHMEN, GLAS =======================
// Die Öffnungen des Fassadendesigners (oeListe, 19-fassadendesigner/090-oeffnungen.js) werden in Weltkoordinaten
// umgerechnet und den Außenwänden zugeordnet (gleiche Lage, gleiche Höhe). Die Wand wird entlang ihrer Achse in Streifen
// geteilt: neben den Öffnungen voll, im Bereich einer Öffnung nur Brüstung und Sturz – so entstehen echte Laibungen.
// In die Öffnung kommen Rahmen und Einteilung (oeAufteilung, wie in der Ansicht), Glas mit Sprossen bzw. Paneel und
// außen eine Fensterbank.
// Nur in LOD 200 (l2MeshOrig); LOD 100 zeigt keine Öffnungen.

/** Öffnungen eines Gebäudes in Weltkoordinaten (zwischengespeichert, solange sich Form und Öffnungen nicht ändern). */
function oeWelt(b) {
  const sg = JSON.stringify([fdSig(b), b.fd ? Object.keys(b.fd).map((k) => [k, b.fd[k].oe || 0]) : 0, S.oet]);
  if (b._oeW && b._oeW.s === sg) return b._oeW.L;
  const L = [];
  if (b.fd && b._y != null) {
    const u = ugN(b);
    let ugH = 0;
    for (let i = 0; i < u; i++) ugH += b.levels[i].h;
    const base = b._y + ugH;
    fdViews(b).forEach((V) =>
      oeListe(b, V).forEach((x) => {
        const um = (x.u0 + x.u1) / 2,
          vm = (x.v0 + x.v1) / 2,
          pc = V.pcs.find((p) => p.pd != null && p.ring && inP([um, vm], p.ring));
        if (!pc) return;
        const W = (uu) => {
          const s = (uu - pc.ua) / pc.dot;
          return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
        };
        L.push({ p0: W(x.u0), p1: W(x.u1), y0: base + x.v0, y1: base + x.v1, T: x.T, n: V.n, id: x.o.id });
      }),
    );
  }
  b._oeW = { s: sg, L };
  return L;
}
/** Kennung der Öffnungen eines Gebäudes (für den Abgleich in l2Sync). */
function oeGebSig(b) {
  if (!b.fd) return '';
  const L = Object.keys(b.fd).map((k) => (b.fd[k] && b.fd[k].oe) || 0);
  return L.some((x) => x && x.length) ? JSON.stringify([L, S.oet]) : '';
}
/** Gebäude zu einem Bauteil (Kennung beginnt mit der Gebäudekennung). */
function oeBauteilGebaeude(e) {
  return S.bld.find((b) => !b.ex && e.id && e.id.startsWith(b.id + ':')) || null;
}
/** Achse und Außenseite einer Außenwand: Richtung d, Normale nach außen n, Lage der Außen- und Innenfläche. */
function oeWandAchse(e, nAussen) {
  let dx = e.sb[0] - e.sa[0],
    dz = e.sb[1] - e.sa[1];
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  let nx = -dz,
    nz = dx;
  if (nx * nAussen[0] + nz * nAussen[1] < 0) {
    nx = -nx;
    nz = -nz;
  }
  let sMax = -1e9,
    sMin = 1e9;
  e.quads.forEach((q) =>
    q.forEach((p) => {
      const s = p[0] * nx + p[1] * nz;
      sMax = Math.max(sMax, s);
      sMin = Math.min(sMin, s);
    }),
  );
  return { d: [dx, dz], n: [nx, nz], sA: sMax, sI: sMin };
}
/**
 * Öffnungen einer Außenwand (Bauteil e der LOD-200-Ableitung): t0/t1 entlang der Wandachse, y0/y1 über der
 * Wandunterkante (auf die Wandhöhe begrenzt). Leer, wenn die Wand keine Öffnung trägt.
 */
function oeWandOeffnungen(e) {
  if (e.kind !== 'AW' || !e.quads || !e.sa || !e.sb) return [];
  const b = oeBauteilGebaeude(e);
  if (!b || !b.fd) return [];
  const L = oeWelt(b);
  if (!L.length) return [];
  const R = [],
    ax = e.sb[0] - e.sa[0],
    az = e.sb[1] - e.sa[1],
    len = Math.hypot(ax, az) || 1,
    dx = ax / len,
    dz = az / len;
  // jede Öffnung genau einer Wand zuordnen: der nächstgelegenen gleich ausgerichteten im selben Höhenbereich
  const W = l2Els(b).els.filter((w) => w.kind === 'AW' && w.quads && w.sa && w.sb),
    abstand = (w, o) => {
      const ax2 = w.sb[0] - w.sa[0],
        az2 = w.sb[1] - w.sa[1],
        l2 = Math.hypot(ax2, az2) || 1,
        ux = ax2 / l2,
        uz = az2 / l2;
      if (Math.abs(o.n[0] * ux + o.n[1] * uz) > 0.35) return 1e9;
      if (Math.min(w.y0 + w.h, o.y1) - Math.max(w.y0, o.y0) < 0.05) return 1e9;
      const mx = (o.p0[0] + o.p1[0]) / 2,
        mz = (o.p0[1] + o.p1[1]) / 2,
        t = (mx - w.sa[0]) * ux + (mz - w.sa[1]) * uz,
        q = Math.abs((mx - w.sa[0]) * -uz + (mz - w.sa[1]) * ux),
        aus = Math.max(0, -t, t - l2);
      return q + aus * 10;
    };
  L.forEach((o) => {
    const ich = abstand(e, o);
    if (ich >= 1e9 || W.some((w) => w !== e && abstand(w, o) < ich - 1e-6)) return;
    // gleiche Wandrichtung (Normale der Ansicht senkrecht zur Achse), Mitte nahe der Achse und innerhalb der Länge
    if (Math.abs(o.n[0] * dx + o.n[1] * dz) > 0.35) return;
    const mx = (o.p0[0] + o.p1[0]) / 2,
      mz = (o.p0[1] + o.p1[1]) / 2,
      t = (mx - e.sa[0]) * dx + (mz - e.sa[1]) * dz,
      q = Math.abs((mx - e.sa[0]) * -dz + (mz - e.sa[1]) * dx);
    if (t < -0.05 || t > len + 0.05 || q > (e.d || 0.4) + 0.6) return;
    const y0 = Math.max(0, o.y0 - e.y0),
      y1 = Math.min(e.h, o.y1 - e.y0);
    if (y1 - y0 < 0.05) return;
    const A = oeWandAchse(e, o.n),
      t0 = o.p0[0] * A.d[0] + o.p0[1] * A.d[1],
      t1 = o.p1[0] * A.d[0] + o.p1[1] * A.d[1];
    R.push({
      t0: Math.min(t0, t1),
      t1: Math.max(t0, t1),
      y0,
      y1,
      T: o.T,
      A,
      voll: o.y1 - e.y0 <= e.h + 0.01,
    });
  });
  return R;
}
/** Kennung für den Neuaufbau einer Wand in l2Sync (ändert sich mit ihren Öffnungen). */
function oeWandSig(e) {
  const O = oeWandOeffnungen(e);
  return O.length ? O.map((o) => [o.t0, o.t1, o.y0, o.y1, o.T]) : 0;
}
/** Vieleck auf den Achsbereich t ∈ [a, c] beschneiden (Sutherland-Hodgman, zwei Halbebenen). */
function oeSchneide(P, d, a, c) {
  const halb = (Q, f) => {
    const R = [];
    for (let i = 0; i < Q.length; i++) {
      const p = Q[i],
        q = Q[(i + 1) % Q.length],
        fp = f(p),
        fq = f(q);
      if (fp >= 0) R.push(p);
      if (fp * fq < 0) {
        const k = fp / (fp - fq);
        R.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    return R;
  };
  const t = (p) => p[0] * d[0] + p[1] * d[1];
  return halb(
    halb(P, (p) => t(p) - a),
    (p) => c - t(p),
  );
}
/**
 * Wandkörper mit Öffnungen in Stücke teilen: je Achsabschnitt die verbleibenden Höhenbereiche.
 * @returns {[{o:number[][],h:[]}, number, number][]} Grundriss des Stücks, Unter- und Oberkante (über Wandunterkante)
 */
function oeWandTeilen(e, O) {
  const d = O[0].A.d,
    gr = [...new Set(O.flatMap((o) => [o.t0, o.t1]))].sort((a, c) => a - c),
    G = [-1e5, ...gr, 1e5],
    R = [];
  for (let i = 0; i < G.length - 1; i++) {
    const a = G[i],
      c = G[i + 1];
    if (c - a < 1e-4) continue;
    const m = (a + c) / 2,
      L = O.filter((o) => o.t0 < m && o.t1 > m)
        .map((o) => [o.y0, o.y1])
        .sort((p, q) => p[0] - q[0]);
    // verbleibende Höhenbereiche = [0, h] ohne die Öffnungen
    const H = [];
    let y = 0;
    L.forEach(([y0, y1]) => {
      if (y0 > y + 1e-3) H.push([y, y0]);
      y = Math.max(y, y1);
    });
    if (y < e.h - 1e-3) H.push([y, e.h]);
    if (!H.length) continue;
    e.quads.forEach((q) => {
      const P = oeSchneide(q, d, a, c);
      if (P.length < 3) return;
      H.forEach(([y0, y1]) => R.push([{ o: P, h: [] }, y0, y1]));
    });
  }
  return R;
}
/** Rahmen, Glas bzw. Türblatt und Fensterbank der Öffnungen einer Wand (Gruppe relativ zur Wandunterkante). */
function oeKoerper(O) {
  const g = new T.Group(),
    teile = new Map(),
    feld = (farbe) => {
      let a = teile.get(farbe);
      if (!a) teile.set(farbe, (a = []));
      return a;
    };
  // Quader in Wandkoordinaten (t entlang der Achse, y Höhe, s entlang der Außennormale)
  const quader = (arr, A, t0, t1, y0, y1, s0, s1) => {
    const P = (t, y, s) => [A.d[0] * t + A.n[0] * s, y, A.d[1] * t + A.n[1] * s],
      c = [
        P(t0, y0, s0),
        P(t1, y0, s0),
        P(t1, y1, s0),
        P(t0, y1, s0),
        P(t0, y0, s1),
        P(t1, y0, s1),
        P(t1, y1, s1),
        P(t0, y1, s1),
      ];
    [
      [0, 2, 1, 0, 3, 2],
      [4, 5, 6, 4, 6, 7],
      [0, 1, 5, 0, 5, 4],
      [3, 6, 2, 3, 7, 6],
      [0, 4, 7, 0, 7, 3],
      [1, 2, 6, 1, 6, 5],
    ].forEach((f) => f.forEach((i) => arr.push(...c[i])));
  };
  O.forEach((o) => {
    const T_ = o.T,
      A = o.A,
      tief = 0.08,
      sV = A.sA - Math.min(T_.et, Math.max(0, A.sA - A.sI - tief)),
      sH = sV - tief,
      sm = (sH + sV) / 2,
      R = feld(T_.rf),
      L = oeAufteilung(T_),
      // Öffnung oben von der Wand abgeschnitten (über die Geschosshöhe): Einteilung senkrecht stauchen
      ky = Math.min(1, (o.y1 - o.y0) / T_.h),
      Tt = (x) => o.t0 + x * ((o.t1 - o.t0) / T_.b),
      Yy = (y) => o.y0 + y * ky;
    L.stege.forEach(([a, c, d, e]) => quader(R, A, Tt(a), Tt(c), Yy(d), Yy(e), sH, sV));
    L.felder.forEach((f) => {
      const x0 = Tt(f.x0),
        x1 = Tt(f.x1),
        y0 = Yy(f.y0),
        y1 = Yy(f.y1);
      if (T_.a === 'to' || f.fu === 'p')
        quader(feld(T_.a === 'to' ? '#c6cbd0' : '#b9a891'), A, x0, x1, y0, y1, sm - 0.025, sm + 0.025);
      else {
        quader(feld('glas'), A, x0, x1, y0, y1, sm - 0.005, sm + 0.005);
        // Sprossen vor dem Glas
        const sr = f.sr || [0, 0],
          sb = 0.025;
        for (let i = 1; i <= sr[0]; i++) {
          const y = y0 + ((y1 - y0) * i) / (sr[0] + 1);
          quader(R, A, x0, x1, y - sb / 2, y + sb / 2, sm, sV);
        }
        for (let i = 1; i <= sr[1]; i++) {
          const x = x0 + ((x1 - x0) * i) / (sr[1] + 1);
          quader(R, A, x - sb / 2, x + sb / 2, y0, y1, sm, sV);
        }
      }
    });
    // Fensterbank außen
    if (o.y0 > 0.05 && T_.a === 'fe')
      quader(feld('#c9c6bf'), A, o.t0 - 0.02, o.t1 + 0.02, o.y0 - 0.03, o.y0, sV, A.sA + 0.05);
  });
  teile.forEach((pos, farbe) => {
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    ge.computeVertexNormals();
    const glas = farbe === 'glas',
      m = new T.Mesh(
        ge,
        new T.MeshLambertMaterial({
          color: new T.Color(glas ? '#9fc0d8' : farbe),
          transparent: glas,
          opacity: glas ? 0.55 : 1,
          side: T.DoubleSide,
        }),
      );
    m.castShadow = !glas;
    m.receiveShadow = true;
    m.raycast = () => {};
    m.userData.oe = 1;
    g.add(m);
  });
  return g;
}
