/* Balkone und Loggien aus den Öffnungsgruppen in LOD 200 (dazu die Eckpfosten der Pfosten-Riegel-Fassaden) (Feldart a: 'ba' Balkon, 'lo' Loggia; 097-oeffnungsgruppen).
   Balkon: Platte 0,20 m an der Feldunterkante, kragt um tb vor die Fassade aus, Stabgeländer an den drei freien Seiten.
   Loggia: der Rücksprung selbst kommt aus der Wandableitung (oeWelt/oeRuecksprungKoerper); hier nur das Geländer in der
   Fassadenebene. Geländer je Feld (oegGel: Art, Höhe, Farbe): Alu-Stäbe, Relinggeländer, Glas, Paneel oder massive
   Brüstung, mit Handlauf. */
const L2BK = new Map(); // Gebäude-ID → { sig, g }
/** Balkone und Loggien eines Gebäudes in Weltkoordinaten: { a, p0, p1, y0, n, tb }. */
function l2BalkonListe(b) {
  const R = [];
  if (!b.fd || b._y == null) return R;
  const u = ugN(b);
  let ugH = 0;
  for (let i = 0; i < u; i++) ugH += b.levels[i].h;
  const base = b._y + ugH;
  fdViews(b).forEach((V) =>
    oegFlaechen(b, V).forEach((x) => {
      if (!x.a) return;
      const pc = V.pcs.find(
        (p) => p.pd != null && p.ring && inP([(x.u0 + x.u1) / 2, (x.v0 + x.v1) / 2], p.ring),
      );
      if (!pc) return;
      const W = (uu) => {
        const s = (uu - pc.ua) / pc.dot;
        return [pc.ax + pc.dx * s, pc.az + pc.dz * s];
      };
      R.push({
        a: x.a,
        p0: W(x.u0),
        p1: W(x.u1),
        y0: base + x.v0,
        n: V.n,
        d: Math.abs(x.d || 0),
        tb: x.tb || 1.5,
        gel: oegGelBei(x, x.v0),
      });
    }),
  );
  return R;
}
/**
 * Bodenflächen der Balkone und Loggien (für die Terrassen-Hervorhebung der Metriken): je Feld ein Rechteck im
 * Grundriss auf Höhe des Bodens – Balkon vor der Fassade (Auskragung), Loggia dahinter (Rücksprung), beides bei
 * Balkon + Loggia. [{ pts, y, area }]
 */
function lbBoeden(b) {
  const out = [];
  if (!l2on()) return out; // wie lbFlaechen: Balkone und Loggien nur in LOD 200
  try {
    l2BalkonListe(b).forEach((x) => {
      const n = x.n,
        A = x.p0,
        B = x.p1,
        vor = x.a === 'ba' || x.a === 'bl' ? x.tb : 0,
        zur = x.a === 'lo' || x.a === 'bl' ? x.d : 0,
        P = (p, s) => [p[0] + n[0] * s, p[1] + n[1] * s];
      if (vor + zur < 0.05) return;
      const pts = [P(A, -zur), P(B, -zur), P(B, vor), P(A, vor)];
      out.push({ pts, y: x.y0, area: Math.hypot(B[0] - A[0], B[1] - A[1]) * (vor + zur) });
    });
  } catch (e) {
    logErr(e, 'lbBoeden');
  }
  return out;
}
/** Quader zwischen den Grundrisspunkten (Strecke A–B, Breite w quer, versetzt um o nach n) von ya bis yb. */
function l2Quader(pos, A, B, n, o, w, ya, yb) {
  const P = (p, s) => [p[0] + n[0] * (o + s), p[1] + n[1] * (o + s)],
    a0 = P(A, -w / 2),
    a1 = P(A, w / 2),
    b0 = P(B, -w / 2),
    b1 = P(B, w / 2),
    V = [
      [a0, ya],
      [b0, ya],
      [b1, ya],
      [a1, ya],
      [a0, yb],
      [b0, yb],
      [b1, yb],
      [a1, yb],
    ].map(([p, y]) => [p[0], y, p[1]]);
  l2QuaderFlaechen(pos, V);
}
/**
 * Flächen eines Quaders aus 8 Ecken (0–3 unten, 4–7 oben, gleiche Reihenfolge) – alle Dreiecke nach außen gewickelt:
 * ist der Grundriss andersherum umlaufen, werden die Dreiecke umgedreht (sonst zeigen Normalen nach innen, Licht und
 * Schatten der Seitenflächen sind falsch).
 */
function l2QuaderFlaechen(pos, V) {
  const a = V[4],
    b = V[5],
    c = V[6],
    // y-Anteil der Normale der Oberseite (4, 5, 6), mit umgekehrtem Vorzeichen
    ny = (c[2] - a[2]) * (b[0] - a[0]) - (c[0] - a[0]) * (b[2] - a[2]),
    um = ny > 0;
  [
    [0, 2, 1, 0, 3, 2],
    [4, 5, 6, 4, 6, 7],
    [0, 1, 5, 0, 5, 4],
    [1, 2, 6, 1, 6, 5],
    [2, 3, 7, 2, 7, 6],
    [3, 0, 4, 3, 4, 7],
  ].forEach((f) => {
    for (let i = 0; i < 6; i += 3) {
      const t = um ? [f[i], f[i + 2], f[i + 1]] : [f[i], f[i + 1], f[i + 2]];
      t.forEach((k) => pos.push(...V[k]));
    }
  });
}
/** Senkrechtes Prisma über dem Viereck Q (Grundriss, beliebige Form) von ya bis yb – alle Seiten, doppelseitig. */
function l2Prisma(pos, Q, ya, yb) {
  l2QuaderFlaechen(pos, [...Q.map((p) => [p[0], ya, p[1]]), ...Q.map((p) => [p[0], yb, p[1]])]);
}
/** Stabgeländer entlang A–B (Grundriss), Fuß bei yb, 1,00 m hoch. */
function l2Stabgelaender(pos, A, B, yb) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 0.1) return;
  const ux = (B[0] - A[0]) / L,
    uz = (B[1] - A[1]) / L,
    q = [-uz, ux],
    k = Math.max(1, Math.round(L / 0.24)),
    yt = yb + 1.0;
  for (let i = 0; i <= k; i++) {
    const t = Math.min(L - 0.01, Math.max(0.01, (i / k) * L)),
      M0 = [A[0] + ux * (t - 0.01), A[1] + uz * (t - 0.01)],
      M1 = [A[0] + ux * (t + 0.01), A[1] + uz * (t + 0.01)];
    l2Quader(pos, M0, M1, q, 0, 0.03, yb + 0.05, yt - 0.04);
  }
  l2Quader(pos, A, B, q, 0, 0.06, yt - 0.04, yt); // Handlauf
  l2Quader(pos, A, B, q, 0, 0.04, yb + 0.05, yb + 0.09); // Fußleiste
}
/**
 * Geländer entlang A–B (Grundriss), Fuß bei yb, je Art (gel.ga): 'st' Stäbe, 'ho' waagerechte Stäbe zwischen Pfosten,
 * 'gl' Glasscheibe mit Handlauf, 'pa' Paneel mit Pfosten, 'ma' massive Brüstung. teil(farbe) liefert das Positionsfeld
 * je Farbe ('glas' = Glas, 'wand' = Brüstung in Wandfarbe).
 */
function l2Gelaender(teil, A, B, yb, gel) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 0.1 || gel.ga === 'ke') return; // kein Geländer (z. B. Erdgeschoss)
  const ux = (B[0] - A[0]) / L,
    uz = (B[1] - A[1]) / L,
    q = [-uz, ux],
    h = gel.gh,
    yt = yb + h,
    F = teil(gel.gc),
    bei = (t) => [A[0] + ux * t, A[1] + uz * t],
    pfosten = (t, w) =>
      l2Quader(F, bei(Math.max(0, t - w / 2)), bei(Math.min(L, t + w / 2)), q, 0, w, yb + 0.02, yt - 0.04),
    pfostenReihe = (abst, w) => {
      const k = Math.max(1, Math.round(L / abst));
      for (let i = 0; i <= k; i++) pfosten(Math.min(L - w / 2, Math.max(w / 2, (i / k) * L)), w);
    };
  if (gel.ga === 'ma') {
    // Brüstung 0,20 m stark in Wandfarbe
    l2Quader(teil('wand'), A, B, q, 0, 0.2, yb, yt);
    return;
  }
  if (gel.ga === 'gl') {
    // Glas 2 cm in Haltern, oben Handlauf
    l2Quader(teil('glas'), A, B, q, 0, 0.02, yb + 0.06, yt - 0.04);
    l2Quader(F, A, B, q, 0, 0.06, yb, yb + 0.06); // Bodenprofil
  } else if (gel.ga === 'pa') {
    pfostenReihe(1.2, 0.04);
    l2Quader(F, A, B, q, 0, 0.02, yb + 0.1, yt - 0.08);
  } else if (gel.ga === 'ho') {
    pfostenReihe(1.2, 0.04);
    for (let i = 1; i <= 5; i++) {
      const y = yb + 0.08 + ((yt - 0.12 - (yb + 0.08)) * i) / 5;
      l2Quader(F, A, B, q, 0, 0.015, y - 0.0075, y + 0.0075);
    }
  } else {
    pfostenReihe(0.12, 0.02);
    l2Quader(F, A, B, q, 0, 0.04, yb + 0.05, yb + 0.09); // Fußleiste
  }
  l2Quader(F, A, B, q, 0, 0.06, yt - 0.04, yt); // Handlauf
}
/** Balkone/Loggien der geplanten Gebäude aktuell halten (Takt aus 030-aktionen, nur LOD 200). */
function l2Balkone() {
  const an = l2on() && !l23(),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an || l2Einfach(b)) return; // in Bewegung oder Bearbeitung: einfacher Körper
    const sig = oeGebSig(b) + '|' + fdSig(b);
    da.add(b.id);
    let o = L2BK.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    // Teile je Geschoss (eb = Geschoss, auf dessen Boden sie stehen) und Farbe – je Geschoss eine Gruppe, damit sie
    // in der Explosionsansicht mit dem Geschoss wandern (exApply)
    let eb = 0;
    const L = l2BalkonListe(b),
      teile = new Map(),
      teil = (k) => {
        const kk = eb + '\u0001' + k;
        if (!teile.has(kk)) teile.set(kk, []);
        return teile.get(kk);
      };
    L.forEach((x) => {
      eb = lvOfY(b, x.y0 + 0.1);
      const n = x.n,
        A = x.p0,
        B = x.p1;
      // Balkon und Balkon + Loggia (Rücksprung dahinter kommt aus der Wandableitung): Platte und Geländer vorn
      if (x.a === 'ba' || x.a === 'bl') {
        const t = x.tb,
          Av = [A[0] + n[0] * t, A[1] + n[1] * t],
          Bv = [B[0] + n[0] * t, B[1] + n[1] * t],
          ein = (p, q) => {
            // Geländer 5 cm hinter der Plattenkante
            const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            return [p[0] + ((q[0] - p[0]) / L2) * 0.05, p[1] + ((q[1] - p[1]) / L2) * 0.05];
          };
        // Platte von der Fassade bis zur Vorderkante
        l2Quader(teil('wand'), A, B, n, t / 2, t, x.y0 - 0.2, x.y0);
        if (x.gel.gm === 'se') {
          // seitlich: außen vor der Plattenstirn, ab Plattenunterkante (Höhe über der Platte bleibt gleich)
          const aus = (p, q) => {
              const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
              return [p[0] - ((q[0] - p[0]) / L2) * 0.03, p[1] - ((q[1] - p[1]) / L2) * 0.03];
            },
            seite = (P, Q, nn) => [
              [P[0] + nn[0] * 0.03, P[1] + nn[1] * 0.03],
              [Q[0] + nn[0] * 0.03, Q[1] + nn[1] * 0.03],
            ],
            gs = { ...x.gel, gh: x.gel.gh + 0.2 },
            d = [B[0] - A[0], B[1] - A[1]],
            dl = Math.hypot(...d) || 1,
            u = [d[0] / dl, d[1] / dl];
          // vorn (in Plattenrichtung n), links und rechts (quer)
          const [f0, f1] = seite(aus(Av, Bv), aus(Bv, Av), n);
          l2Gelaender(teil, f0, f1, x.y0 - 0.2, gs);
          const [l0, l1] = seite(A, Av, [-u[0], -u[1]]);
          l2Gelaender(teil, l0, [l1[0] + n[0] * 0.03, l1[1] + n[1] * 0.03], x.y0 - 0.2, gs);
          const [r0, r1] = seite(B, Bv, u);
          l2Gelaender(teil, r0, [r1[0] + n[0] * 0.03, r1[1] + n[1] * 0.03], x.y0 - 0.2, gs);
        } else {
          l2Gelaender(teil, ein(Av, A), ein(Bv, B), x.y0, x.gel);
          l2Gelaender(teil, ein(A, B), ein(Av, Bv), x.y0, x.gel);
          l2Gelaender(teil, ein(B, A), ein(Bv, Av), x.y0, x.gel);
        }
      } else {
        // Loggia: Geländer knapp hinter der Fassadenebene
        const ri = [A[0] - n[0] * 0.08, A[1] - n[1] * 0.08],
          rj = [B[0] - n[0] * 0.08, B[1] - n[1] * 0.08];
        l2Gelaender(teil, ri, rj, x.y0, x.gel);
      }
    });
    // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: Eckpfosten der Pfosten-Riegel-Fassaden über Eck
    oeEcken(b).forEach((e) => {
      eb = lvOfY(b, e.y0 + 0.1);
      l2Prisma(teil(e.rf), oeEckQuadrat(e), e.y0, e.y1);
    });
    // ── Erweiterung aus 22-lod200-waende/100-oeffnungen-3d.js: Sturz über einer Loggia, die nicht bis unter die
    // Decke reicht (die Loggia ist im Grundriss ausgeschnitten, die Außenwand darüber fehlt dort)
    {
      const els = l2Els(b).els,
        aw = els.find((e) => e.kind === 'AW'),
        dW = (aw && aw.d) || 0.36,
        dDE = ((els.find((e) => e.kind === 'DE') || {}).d || 0.22) + 0.002;
      oeLoggiaEinschnitte(b).forEach((z) => {
        const o = z.lg,
          ob = o.yG - dDE;
        eb = lvOfY(b, o.y0 + 0.1);
        if (ob - o.y1 > 0.03) l2Quader(teil('wand'), o.p0, o.p1, o.n, -dW / 2, dW, o.y1, ob);
      });
    }
    const g = new T.Group(),
      mesh = (arr, farbe) => {
        if (!arr.length) return null;
        const ge = new T.BufferGeometry();
        ge.setAttribute('position', new T.BufferAttribute(new Float32Array(arr), 3));
        ge.computeVertexNormals();
        const glas = farbe === 'glas',
          m = new T.Mesh(
            ge,
            new T.MeshLambertMaterial({
              color: glas ? 0xd8e6ee : farbe === 'wand' ? 0xf4f4f2 : farbe,
              transparent: glas,
              opacity: glas ? 0.35 : 1,
              depthWrite: !glas,
              side: T.DoubleSide,
              // geschlossene, nach außen gewickelte Quader: nur die Rückseiten in die Schattenkarte (keine
              // Schattenstreifen auf den Seiten der Platte)
              shadowSide: T.BackSide,
            }),
          );
        m.castShadow = !glas;
        m.receiveShadow = true;
        m.raycast = () => {};
        return m;
      },
      gs = new Map();
    teile.forEach((arr, kk) => {
      const [e, k] = kk.split('\u0001'),
        m = mesh(arr, k);
      if (!m) return;
      if (!gs.has(e)) {
        const sg = new T.Group();
        sg.userData.k = e === 'roof' ? 'roof' : +e; // Geschoss für die Explosionsansicht
        sg.position.y = S.expl ? exOff(b, sg.userData.k) : 0;
        gs.set(e, sg);
        g.add(sg);
      }
      gs.get(e).add(m);
    });
    G.l2.add(g);
    L2BK.set(b.id, { sig, g });
  });
  L2BK.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2BK.delete(id);
  });
}
/**
 * Balkone und Loggien im Grundriss (LOD 200, aus l2Draw): im Geschoss, dessen Fußboden auf Höhe der Platte liegt,
 * die Balkonplatte mit Geländer bzw. bei der Loggia das Geländer in der Fassadenebene; der Balkon des Geschosses
 * darüber gestrichelt (überdeckt die Fläche davor).
 * @param {CanvasRenderingContext2D} x  Zeichenfläche des Grundrisses (Weltkoordinaten über grTf)
 * @param {object} b  Gebäude
 * @param {object[]} wl  Wände des Geschosses (l2Els)
 */
function l2BalkonGrundriss(x, b, wl) {
  const aw = wl.filter((e) => e.kind === 'AW' && isFinite(e.y0));
  if (!aw.length) return;
  const y0 = Math.min(...aw.map((e) => e.y0)),
    hg = Math.max(...aw.map((e) => e.h || 0)),
    zug = (pts, zu) => {
      x.beginPath();
      pts.forEach((p, i) => {
        const [X, Y] = grTf(p[0], p[1]);
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      });
      if (zu) x.closePath();
    },
    // Geländer im Grundriss: Glas als feine Doppellinie, sonst eine kräftige Linie
    gel = (pts, G) => {
      if (!G || G.ga === 'ke') return;
      x.setLineDash([]);
      x.strokeStyle = G.ga === 'gl' ? '#5b7f95' : '#222';
      x.lineWidth = G.ga === 'ma' ? 2.4 : G.ga === 'gl' ? 0.8 : 1.4;
      zug(pts);
      x.stroke();
    };
  x.save();
  x.globalAlpha = 1;
  // Loggien dieses Geschosses: Fläche freistellen (liegt außerhalb der Räume)
  const sh = y0 + (+S.gro.sh || 1.2);
  x.globalCompositeOperation = 'destination-out';
  oeLoggiaEinschnitte(b).forEach((z) => {
    if (Math.abs(z.y - y0) > 0.3) return;
    // 3 cm kleiner: die Umrisslinien der Loggia-Wände bleiben voll
    zug(oeLgAussen(z.f, -0.03), true);
    x.fill();
  });
  x.globalCompositeOperation = 'source-over';
  // Eckpfosten der Pfosten-Riegel-Fassaden in Schnitthöhe
  oeEcken(b).forEach((e) => {
    if (e.y0 > sh || e.y1 < sh) return;
    x.fillStyle = '#222';
    zug(oeEckQuadrat(e), true);
    x.fill();
  });
  l2BalkonListe(b).forEach((q) => {
    const dy = q.y0 - y0,
      hier = Math.abs(dy) < 0.3,
      oben = Math.abs(dy - hg) < 0.3;
    if (!hier && !oben) return;
    const n = q.n,
      A = q.p0,
      B = q.p1,
      P = (p, s) => [p[0] + n[0] * s, p[1] + n[1] * s],
      L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1,
      u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L],
      E = (p, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
    if (q.a === 'ba' || q.a === 'bl') {
      const t = q.tb,
        platte = [A, B, P(B, t), P(A, t)];
      if (oben) {
        // Balkon darüber: nur gestrichelter Umriss
        x.setLineDash([5, 3]);
        x.strokeStyle = '#555';
        x.lineWidth = 0.9;
        zug([A, P(A, t), P(B, t), B]);
        x.stroke();
        x.setLineDash([]);
        return;
      }
      x.fillStyle = 'rgba(236,235,231,0.95)';
      zug(platte, true);
      x.fill();
      x.strokeStyle = '#111';
      x.lineWidth = 1.2;
      zug([A, P(A, t), P(B, t), B]);
      x.stroke();
      // Geländer: aufgesetzt 5 cm innerhalb der Plattenkante, seitlich außen davor
      const k = q.gel.gm === 'se' ? -0.03 : 0.05;
      gel([E(A, k), E(P(A, t - k), k), E(P(B, t - k), -k), E(B, -k)], q.gel);
    } else if (hier) {
      // Loggia: Geländer knapp hinter der Fassadenebene
      gel([P(A, -0.08), P(B, -0.08)], q.gel);
    }
  });
  x.restore();
}
function l2BalkoneWeg(o) {
  G.l2.remove(o.g);
  o.g.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
}
// ---- Terrassen: Stabgeländer auf der Terrassenfläche (Geschoss ohne Geschoss darüber an dieser Stelle), entlang
// der Außenkante mit Abstand zur Attika. Terrassenfläche = Grundriss des Geschosses minus Grundriss darüber.
const L2TG = new Map(); // Gebäude-ID → { sig, g }
/** Geländerlinien der Terrassen eines Gebäudes: [{ A, B, y }] (y = Terrassenboden). */
function l2TerrassenLinien(b) {
  const R = [],
    aw = ((b.l2 && b.l2.c && b.l2.c.AW) || L2DC.AW) / 100,
    ein = aw + 0.12; // Abstand von der Außenkante: Wand/Attika plus Luft
  let z = b._y;
  b.levels.forEach((l, j) => {
    const z1 = z + l.h;
    z = z1;
    const ob = b.levels[j + 1];
    if (l.ug || !ob) return;
    const f = lf(b, l),
      g = lf(b, ob);
    let T2 = [];
    try {
      T2 = boolOp([bpP(f)], [bpP(g)], 'd');
    } catch (e) {
      logErr(e, 'l2TerrassenLinien');
      return;
    }
    T2.forEach((P) => {
      if (!P.o || P.o.length < 3 || Math.abs(l2QA(P.o)) < 2) return;
      const r = P.o,
        n = r.length;
      for (let i = 0; i < n; i++) {
        const a = r[i],
          c = r[(i + 1) % n],
          L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (L < 0.5) continue;
        const ux = (c[0] - a[0]) / L,
          uz = (c[1] - a[1]) / L,
          m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
          // nur Kanten auf der Gebäudeaußenkante (nicht entlang der Wand des Geschosses darüber)
          aussen = f.some((p, k) => {
            const q = f[(k + 1) % f.length];
            return proj(m, p, q).d < 0.05;
          });
        if (!aussen) continue;
        // Richtung in die Terrasse
        let nx = -uz,
          nz = ux;
        if (!inP([m[0] + nx * 0.2, m[1] + nz * 0.2], r)) {
          nx = -nx;
          nz = -nz;
        }
        const A = [a[0] + nx * ein + ux * ein, a[1] + nz * ein + uz * ein],
          B = [c[0] + nx * ein - ux * ein, c[1] + nz * ein - uz * ein];
        if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 0.3) R.push({ A, B, y: z1 });
      }
    });
  });
  return R;
}
/** Terrassengeländer der geplanten Gebäude aktuell halten (Takt aus 030-aktionen, nur LOD 200). */
function l2Terrassen() {
  const an = l2on() && !l23() && !(S.expl && S.expl.cur > 0.05),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an || l2Einfach(b)) return; // in Bewegung oder Bearbeitung: einfacher Körper
    const sig = skSig(b) + '|' + JSON.stringify((b.l2 && b.l2.c) || 0);
    da.add(b.id);
    let o = L2TG.get(b.id);
    if (o && o.sig === sig) return;
    if (o) l2BalkoneWeg(o);
    // je Geschoss (Terrassenboden = Boden des Geschosses darüber) eine Gruppe für die Explosionsansicht
    const P = new Map();
    l2TerrassenLinien(b).forEach((x) => {
      const e = lvOfY(b, x.y + 0.1);
      if (!P.has(e)) P.set(e, []);
      l2Stabgelaender(P.get(e), x.A, x.B, x.y);
    });
    const g = new T.Group();
    P.forEach((pos, e) => {
      if (!pos.length) return;
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      ge.computeVertexNormals();
      const m = new T.Mesh(ge, new T.MeshLambertMaterial({ color: 0xa9aeb3, side: T.DoubleSide }));
      m.castShadow = m.receiveShadow = true;
      m.raycast = () => {};
      const sg = new T.Group();
      sg.userData.k = e;
      sg.position.y = S.expl ? exOff(b, e) : 0;
      sg.add(m);
      g.add(sg);
    });
    G.l2.add(g);
    L2TG.set(b.id, { sig, g });
  });
  L2TG.forEach((o, id) => {
    if (da.has(id)) return;
    l2BalkoneWeg(o);
    L2TG.delete(id);
  });
}
