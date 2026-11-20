// ---- Isolieren aus der Gebäudemetrik in LOD 200: Volumenkörper wie LOD 100; NGF = Körper ohne Wände; KF = nur Wände
// s: Sonderfall S (Balkone, Loggien) – dunkleres Grün als die Nettofläche im Regelfall R
// bri/bris: Bruttorauminhalt Regelfall R und Sonderfall S (dunkler)
const ISOC = { kf: '#e08a2c', ngf: '#4f9d77', tr: '#3f6f9f', s: '#2f6e50', bri: '#7fa6cc', bris: '#46709a' };
let L2IK = '';
G.l2n = new T.Group();
sc.add(G.l2n);
function l2HP(poly, A, B, inside) {
  const sd = (P) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]),
    f = inside ? 1 : -1,
    out = [];
  poly.forEach((P, i) => {
    const Q = poly[(i + 1) % poly.length],
      sp = sd(P) * f,
      sq = sd(Q) * f,
      pi = sp >= 0,
      qi = sq >= 0;
    if (pi) {
      out.push(P);
      if (!qi) {
        const t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    } else if (qi) {
      const t = sp / (sp - sq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  });
  return out.length > 2 ? out : [];
}
function l2Diff(poly, quad) {
  let q = quad;
  {
    let a = 0;
    for (let i = 0; i < 4; i++) {
      const p = q[i],
        n = q[(i + 1) % 4];
      a += p[0] * n[1] - n[0] * p[1];
    }
    if (a < 0) q = q.slice().reverse();
  }
  const bb = (r) => {
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      r.forEach((p) => {
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      });
      return [x0, x1, y0, y1];
    },
    a = bb(poly),
    c = bb(q);
  if (c[0] > a[1] || c[1] < a[0] || c[2] > a[3] || c[3] < a[2]) return [poly];
  let rem = poly;
  const res = [];
  for (let i = 0; i < 4 && rem.length; i++) {
    const A = q[i],
      B = q[(i + 1) % 4],
      o = l2HP(rem, A, B, false);
    if (o.length && l2Ar(o) > 1e-4) res.push(o);
    rem = l2HP(rem, A, B, true);
  }
  return res;
}
function l2LvMatch(b, i, sel) {
  const u = ugN(b);
  if (sel === 'all') return true;
  if (sel === 'o') return i >= u;
  if (sel === 'u') return i < u;
  if (sel.slice(0, 2) === 'n:') {
    const L = bLv(b)[i];
    return !!L && L.n === sel.slice(2);
  }
  return false;
}
function l2NetShow(iso) {
  while (G.l2n.children.length) {
    const o = G.l2n.children.pop();
    o.geometry && o.geometry.dispose();
    o.material && o.material.dispose && o.material.dispose();
  }
  if (!iso) return;
  const mat = new T.MeshLambertMaterial({ color: new T.Color(ISOC.ngf), side: T.DoubleSide }),
    nri = iso.m === 'nri' || iso.m === 'nrir';
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(iso.bid === '*' || iso.bid === b.id)) return;
    // NGF als Fläche (Boden des Raumkörpers), NRI als Körper
    l2NetKoerper(b, iso.sel, !nri).forEach((k) => {
      const m = new T.Mesh(nri ? k.g : l2FlachGeo(k.p, k.hs), mat),
        y0 = nri ? k.y0 : k.yb + 0.03;
      m.position.y = y0;
      m.userData = {
        bid: b.id,
        li: k.li,
        y0,
        info: nri ? k.nm + ' · NRI (R) · ' + f1(k.v, 1) + ' m³' : k.nm + ' · NGF (R) · ' + f1(k.a, 1) + ' m²',
      };
      m.castShadow = false;
      m.raycast = () => {};
      G.l2n.add(m);
    });
  });
  try {
    exApply();
  } catch (e) {
    logErr(e, 'l2NetShow');
  }
}
/**
 * Netto-Raumkörper (Regelfall R) eines Gebäudes in LOD 200: je Geschoss die Nettofläche (ohne Wände, Innenhöfe und
 * Loggien) bis unter die Decke, im Dachgeschoss der Raum unter der Dachfläche.
 * [{ g, y0, li, f, a (m²), v (m³), nm, ug }] – Grundlage für NGF- und NRI-Darstellung und beider Zahlen
 * (l2NetFlaechen). nurFlaeche: ohne Körper und Rauminhalt (schnell, für die Flächenzahlen).
 */
function l2NetKoerper(b, sel, nurFlaeche) {
  const r = [],
    dDE = l2T(S.l2.defs.DE).d,
    G_ = l2Els(b),
    L = grData(b),
    oben = b._y + b.levels.reduce((s2, l) => s2 + l.h, 0);
  L.forEach((lv, i) => {
    // Dachgeschoss (geneigtes Dach): Fläche wie in der Zahl, als Körper bis zur Drempelhöhe (mind. 30 cm) – ein
    // voller Körper stäche an den Dachschrägen durch das Dach
    const dg = !!lv.dg;
    if (!l2LvMatch(b, i, sel) || (!dg && !G_.lv[i])) return;
    // Dachgeschoss: Drempel- und Giebelwände stehen auf den Außenwänden des obersten Geschosses – deren Grundfläche abziehen
    const liW = dg ? b.levels.length - 1 : i,
      qs = G_.els
        .filter(
          (e) =>
            !dg &&
            e.li === liW &&
            e.quads &&
            (dg ? e.kind === 'AW' : e.kind === 'AW' || e.kind === 'TW' || e.kind === 'TH'),
        )
        .reduce((r, e) => r.concat(e.quads), []),
      y0 = dg ? oben : G_.lv[i].y0,
      hh = dg ? Math.max(0.3, (+(b.roof && b.roof.dremp) || 0) - 0.05) : Math.max(0.1, lv.h - dDE),
      // keine Nettofläche in Innenhöfen und Loggien (Einschnitte dieses Geschosses)
      jB = b.levels.indexOf(lv.obj),
      aus = (jB >= 0 ? znVoidsAt(b, jB).map((v) => v.poly) : []).concat(
        oeLoggiaEinschnitte(b)
          .filter((z) => z.y > y0 - 0.1 && z.y < y0 + lv.h - 0.1)
          .map((z) => z.f),
      );
    // Dachgeschoss: ein Raumkörper über dem Grundriss des obersten Geschosses, um die Außenwand nach innen versetzt
    // (die Raumaufteilung ergäbe Spalten und Grate unter den Dachflächen)
    const flaechen = dg ? [{ o: l2Innen(lf(b, b.levels[b.levels.length - 1]), l2DickeAW(G_)) }] : lv.faces;
    flaechen.forEach((f) => {
      let ps = [f.o];
      qs.forEach((q) => {
        ps = ps.reduce((r, p) => r.concat(l2Diff(p, q)), []);
      });
      let PP = ps.map((p) => ({ o: p, h: [] }));
      if (aus.length)
        try {
          PP = boolOp(PP, aus.map(bpP), 'd').filter((P) => P.o && P.o.length >= 3);
        } catch (e) {
          logErr(e, 'l2NetShow Höfe');
        }
      PP.forEach(({ o: p, h: hs }) => {
        if (l2Ar(p) < 2e-3) return;
        // schmale Reste (z. B. zwischen Loggia-Einschnitt und Wand) nicht zeigen: mittlere Breite unter 15 cm
        const U = p.reduce(
          (s2, q, k) => s2 + Math.hypot(p[(k + 1) % p.length][0] - q[0], p[(k + 1) % p.length][1] - q[1]),
          0,
        );
        if ((2 * l2Ar(p)) / Math.max(U, 1e-6) < 0.15) return;
        const aN = l2Ar(p) - (hs || []).reduce((s2, h) => s2 + l2Ar(h), 0),
          ug = !dg && i < ugN(b);
        if (nurFlaeche) {
          r.push({
            li: i,
            f,
            a: aN,
            ug,
            p,
            hs: hs || [],
            yb: y0,
            nm: dg ? 'Dachgeschoss' : (bLv(b)[i] || {}).n || lname(b, i),
          });
          return;
        }
        try {
          // Dachgeschoss: Raumkörper unter der Dachfläche (Dachaufbau etwa 30 cm), sonst Prisma bis unter die Decke
          const gDg = dg ? l2DgKoerper(b, p, y0, 0.3) : null,
            g = gDg || grPrism({ o: p, h: hs || [] }, 0, hh).g;
          r.push({
            g,
            y0: gDg ? 0 : y0,
            li: i,
            f,
            a: aN,
            v: gDg ? l2Volumen(gDg) : aN * hh,
            nm: dg ? 'Dachgeschoss' : (bLv(b)[i] || {}).n || lname(b, i),
            ug,
          });
        } catch (e) {
          logErr(e, 'l2NetKoerper');
        }
      });
    });
  });
  return r;
}
/**
 * Nettoflächen (Regelfall R) je Geschoss und je Grundrissfläche, genau aus den Netto-Polygonen von l2NetKoerper –
 * dieselben Flächen wie die angezeigten Körper. Zwischengespeichert, solange Bauteile, Grundriss und Loggien gleich
 * bleiben. { lv: [m² je Geschoss], f: Map(Grundrissfläche → m²) }
 */
function l2NetFlaechen(b) {
  const G_ = l2Els(b),
    s =
      G_.k +
      '|' +
      grSig(b) +
      '|' +
      JSON.stringify(oeLoggiaEinschnitte(b).map((z) => [z.y, z.f])) +
      '|' +
      JSON.stringify(b.voids || null);
  if (b._ngf && b._ngf.s === s) return b._ngf.r;
  const r = { lv: [], f: new Map() };
  l2NetKoerper(b, 'all', true).forEach((k) => {
    r.lv[k.li] = (r.lv[k.li] || 0) + k.a;
    r.f.set(k.f, (r.f.get(k.f) || 0) + k.a);
  });
  b._ngf = { s, r };
  return r;
}
/** Waagerechte Fläche (Polygon p mit Löchern hs, Grundriss [x, z]) auf Höhe 0 – für Flächen-Darstellungen der Metriken. */
function l2FlachGeo(p, hs) {
  const sh = new T.Shape(p.map((q) => new T.Vector2(q[0], -q[1])));
  (hs || []).forEach((h) => sh.holes.push(new T.Path(h.map((q) => new T.Vector2(q[0], -q[1])))));
  const g = new T.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return g;
}
/** Rauminhalt eines geschlossenen Körpers (m³, Summe der Tetraeder über die Dreiecke). */
function l2Volumen(g) {
  if (g.index) g = g.toNonIndexed();
  const p = g.getAttribute('position');
  if (!p) return 0;
  let v = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const ax = p.getX(i),
      ay = p.getY(i),
      az = p.getZ(i),
      bx = p.getX(i + 1),
      by = p.getY(i + 1),
      bz = p.getZ(i + 1),
      cx = p.getX(i + 2),
      cy = p.getY(i + 2),
      cz = p.getZ(i + 2);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}
/** Netto-Rauminhalt (LOD 200, Regelfall R) als Summe der Netto-Raumkörper: { o, u } in m³. */
function l2Nri(b) {
  const r = { o: 0, u: 0 };
  l2NetKoerper(b, 'all').forEach((k) => {
    r[k.ug ? 'u' : 'o'] += k.v;
    k.g.dispose();
  });
  return r;
}
/** Stärke der Außenwand (m) aus den LOD-200-Bauteilen. */
const l2DickeAW = (G_) => (G_.els.find((e) => e.kind === 'AW') || {}).d || 0.36;
/** Vieleck r um d nach innen versetzen (Schnitt der versetzten Kanten). */
function l2Innen(r, d) {
  const n = r.length,
    A = r.reduce((s2, p, i) => s2 + p[0] * r[(i + 1) % n][1] - r[(i + 1) % n][0] * p[1], 0),
    sg = A > 0 ? 1 : -1,
    L = r.map((p, i) => {
      const q = r[(i + 1) % n],
        l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
        nx = (-(q[1] - p[1]) / l) * sg,
        nz = ((q[0] - p[0]) / l) * sg;
      return { p: [p[0] + nx * d, p[1] + nz * d], u: [(q[0] - p[0]) / l, (q[1] - p[1]) / l] };
    });
  return L.map((c, i) => {
    const a = L[(i + n - 1) % n],
      det = a.u[0] * c.u[1] - a.u[1] * c.u[0];
    if (Math.abs(det) < 1e-9) return c.p;
    const t = ((c.p[0] - a.p[0]) * c.u[1] - (c.p[1] - a.p[1]) * c.u[0]) / det;
    return [a.p[0] + a.u[0] * t, a.p[1] + a.u[1] * t];
  });
}
/**
 * Raumkörper des Dachgeschosses über der Fläche poly (Grundriss) ab Fußboden y0 bis unter die Dachfläche: die Fläche
 * wird an den Dreiecken der Dachfläche (b._rp.pr) geteilt, jedes Stück endet oben auf seiner Dachebene (abzüglich
 * Dachaufbau d). Ergebnis: BufferGeometry (Weltkoordinaten) oder null.
 */
function l2DgKoerper(b, poly, y0, d) {
  const P = b._rp && b._rp.pr;
  if (!P || !P.length || poly.length < 3) return null;
  const pos = [],
    // Sutherland-Hodgman: Vieleck p an einem konvexen Dreieck (gegen den Uhrzeigersinn) schneiden
    schneide = (p, T3) => {
      let out = p;
      for (let i = 0; i < 3 && out.length; i++) {
        const A = T3[i],
          B = T3[(i + 1) % 3],
          s = (q) => (B[0] - A[0]) * (q[1] - A[1]) - (B[1] - A[1]) * (q[0] - A[0]),
          inp = out;
        out = [];
        inp.forEach((q, j) => {
          const r = inp[(j + 1) % inp.length],
            sq = s(q),
            sr = s(r);
          if (sq >= -1e-9) out.push(q);
          if (sq >= -1e-9 !== sr >= -1e-9) {
            const t = sq / (sq - sr);
            out.push([q[0] + (r[0] - q[0]) * t, q[1] + (r[1] - q[1]) * t]);
          }
        });
      }
      return out;
    },
    flaeche = (p) =>
      p.reduce((a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0) / 2,
    // Randkante von poly? (Mittelpunkt der Kante liegt auf einer Kante von poly)
    aufRand = (a, c) => {
      const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      return poly.some((q, i) => proj(m, q, poly[(i + 1) % poly.length]).d < 1e-3);
    };
  for (let i = 0; i + 8 < P.length; i += 9) {
    const A = [P[i], P[i + 1], P[i + 2]],
      B = [P[i + 3], P[i + 4], P[i + 5]],
      C = [P[i + 6], P[i + 7], P[i + 8]],
      // Ebene des Dreiecks: y(x, z)
      ux = B[0] - A[0],
      uy = B[1] - A[1],
      uz = B[2] - A[2],
      vx = C[0] - A[0],
      vy = C[1] - A[1],
      vz = C[2] - A[2],
      nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    if (Math.abs(ny) < 1e-6) continue; // senkrechte Flächen (Giebel) begrenzen nicht nach oben
    const yAn = (x, z) => A[1] - (nx * (x - A[0]) + nz * (z - A[2])) / ny - d;
    let T3 = [
      [A[0], A[2]],
      [B[0], B[2]],
      [C[0], C[2]],
    ];
    if (flaeche(T3) < 0) T3 = [T3[0], T3[2], T3[1]];
    let p = poly.slice();
    if (flaeche(p) < 0) p = p.slice().reverse();
    const s = schneide(p, T3);
    if (s.length < 3 || Math.abs(flaeche(s)) < 1e-4) continue;
    const top = s.map((q) => [q[0], Math.max(y0 + 0.05, yAn(q[0], q[1])), q[1]]);
    // Boden und Deckel (Fächer, das Stück ist konvex)
    for (let k = 1; k + 1 < s.length; k++) {
      pos.push(s[0][0], y0, s[0][1], s[k + 1][0], y0, s[k + 1][1], s[k][0], y0, s[k][1]);
      pos.push(...top[0], ...top[k], ...top[k + 1]);
    }
    // Seitenwände nur am Rand der Fläche (innere Schnittkanten zwischen den Stücken bleiben offen)
    s.forEach((q, k) => {
      const r = s[(k + 1) % s.length];
      if (!aufRand(q, r)) return;
      const tq = top[k],
        tr = top[(k + 1) % s.length];
      pos.push(q[0], y0, q[1], r[0], y0, r[1], ...tr, q[0], y0, q[1], ...tr, ...tq);
    });
  }
  if (!pos.length) return null;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}
/**
 * Bruttorauminhalt im Regelfall R (LOD 200, oberirdisch): je Geschoss der Grundriss ohne Innenhöfe und Loggien über die
 * volle Geschosshöhe, beim geneigten Dach der Dachraum bis zur Dachfläche.
 */
function l2BriShow(iso) {
  const mat = new T.MeshLambertMaterial({ color: new T.Color(ISOC.bri), side: T.DoubleSide });
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(iso.bid === '*' || iso.bid === b.id)) return;
    const u = ugN(b),
      LG = oeLoggiaEinschnitte(b),
      add = (g, y0, li, info) => {
        const m = new T.Mesh(g, mat);
        m.position.y = y0;
        m.userData = { bid: b.id, li, y0, info };
        m.castShadow = false;
        m.raycast = () => {};
        G.l2n.add(m);
      };
    let y = b._y;
    b.levels.forEach((l, j) => {
      const y0 = y;
      y += l.h;
      if (j < u) return;
      const aus = znVoidsAt(b, j)
        .map((v) => v.poly)
        .concat(LG.filter((z) => z.y > y0 - 0.1 && z.y < y0 + l.h - 0.1).map((z) => z.f));
      let PP = [bpP(lf(b, l))];
      if (aus.length)
        try {
          PP = boolOp(PP, aus.map(bpP), 'd').filter((P) => P.o && P.o.length >= 3);
        } catch (e) {
          logErr(e, 'l2BriShow');
        }
      PP.forEach((P) => {
        try {
          const aP = l2Ar(P.o) - (P.h || []).reduce((s2, h) => s2 + l2Ar(h), 0);
          add(
            grPrism({ o: P.o, h: P.h || [] }, 0, l.h).g,
            y0,
            j,
            lname(b, j) + ' · BRI (R) · ' + f1(aP * l.h, 1) + ' m³',
          );
        } catch (e) {
          logErr(e, 'l2BriShow');
        }
      });
    });
    // Dachraum (geneigtes Dach) bis zur Dachfläche
    if (b.roof && b.roof.type && b.roof.type !== 'flat') {
      const g = l2DgKoerper(b, lf(b, b.levels[b.levels.length - 1]), y, 0);
      if (g) add(g, 0, 'roof', 'Dachraum · BRI (R) · ' + f1((b._roofA && b._roofA.vol) || 0, 1) + ' m³');
    }
  });
  try {
    exApply();
  } catch (e) {
    logErr(e, 'l2BriShow');
  }
}
/** Körper der Flächen im Sonderfall S (DIN 277) zeigen: iso.sel 'all', 'ba' (Balkone) oder 'lo' (Loggien). */
/**
 * lvSel: nur Flächen dieser Geschosse (wie l2LvMatch; für NGF/NRI nach Geschoss), sonst alle. Als Körper nur bei
 * Rauminhalten (BRI, NRI); bei Flächen (BGF/NGF (S)) nur der Boden.
 */
function l2SShow(iso, farbe, lvSel) {
  const flach = !['bri', 'bris', 'nri', 'nris'].includes(iso.m);
  const mat = new T.MeshLambertMaterial({ color: new T.Color(farbe || ISOC.s), side: T.DoubleSide });
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !(iso.bid === '*' || iso.bid === b.id)) return;
    l2SFlaechen(b).forEach((s) => {
      if (iso.sel !== 'all' && iso.sel !== s.art) return;
      if (lvSel && !l2LvMatch(b, s.li === 'roof' ? b.levels.length : s.li, lvSel)) return;
      try {
        const m = new T.Mesh(flach ? l2FlachGeo(s.pts) : grPrism({ o: s.pts, h: [] }, 0, s.h).g, mat);
        m.position.y = s.y + (flach ? 0.03 : 0);
        m.userData = {
          bid: b.id,
          li: s.li,
          y0: m.position.y,
          info:
            ({ ba: 'Balkon', lo: 'Loggia', bl: 'Balkon + Loggia' }[s.art] || 'Sonderfall S') +
            (s.li === 'roof' ? '' : ' · ' + lname(b, s.li)) +
            ' · S · ' +
            (flach ? f1(s.a, 1) + ' m²' : f1(s.a * s.h, 1) + ' m³'),
        };
        m.castShadow = false;
        m.raycast = () => {};
        G.l2n.add(m);
      } catch (e) {
        logErr(e, 'l2SShow');
      }
    });
  });
  try {
    exApply();
  } catch (e) {
    logErr(e, 'l2SShow');
  }
}
/**
 * Balkone/Loggia-Geländer (L2BK), Terrassengeländer (L2TG) und Außenkontur (L2KO) je Gebäude mit der Isolierung
 * ein- und ausblenden: beim Isolieren aus der Gebäudemetrik (iso) ausgeblendet, bei einer Auswertung (sp) nur bei
 * Gebäuden sichtbar, von denen etwas angezeigt wird. Jeden Takt, da diese Gruppen neu entstehen können.
 */
/**
 * Ist das Gebäude id beim Isolieren (Bauteil-Isolieren S.l2.iso bzw. Auswahl aus den Metriken ZI.sp) sichtbar? Für alles,
 * was nicht Teil der Bauteilliste L2I ist: Balkone, Attika, Terrassengeländer, Konturen, Fassadentyp-Schichten.
 */
function l2IsoSicht(id) {
  return l2IsoSichtMit(S.l2 && S.l2.iso, typeof ZI !== 'undefined' && ZI.sp, id);
}
function l2IsoAnbauten(iso, sp) {
  const sicht = (id) => l2IsoSichtMit(iso, sp, id);
  [L2BK, L2TG].forEach((M) =>
    M.forEach((o, id) => {
      if (o && o.g) o.g.visible = sicht(id);
    }),
  );
  L2KO.forEach((o, id) => {
    if (o && o.ln) o.ln.visible = o.ln.visible && sicht(id);
    if (o && o.fett) o.fett.visible = o.fett.visible && sicht(id);
  });
  // Fassadentyp-Schichten (Farbe, Schraffur) des Gebäudes
  FT3.bau.forEach((it, id) => {
    if (it && it.g && !sicht(id)) it.g.visible = false;
  });
}
function l2IsoSichtMit(iso, sp, id) {
  if (iso) return false;
  if (!sp) return true;
  const b = S.bld.find((z) => z.id === id);
  if (!b) return true;
  try {
    return (
      b.levels.some((l, i) => zoIsoHit(sp, b, { hull: 1, k: i })) || zoIsoHit(sp, b, { hull: 1, k: 'roof' })
    );
  } catch (e) {
    logErr(e, 'l2IsoSicht');
    return true;
  }
}
function l2IsoApply(force) {
  const iso = S.l2.iso,
    sp = typeof ZI !== 'undefined' && ZI.sp,
    on = l2on();
  // ── Erweiterung aus 22-lod200-waende/130-balkone.js und 110-aussenkontur.js: Anbauten und Kontur mit isolieren
  if (on) l2IsoAnbauten(iso, sp);
  const key = on ? JSON.stringify([iso && iso.key, sp && ZI.key, L2I.size, L2GEN]) : 'off';
  if (!force && key === L2IK) return;
  L2IK = key;
  if (!on) {
    if (S.l2.iso) S.l2.iso = null;
    l2NetShow(null);
    return;
  }
  // NGF: Regelfall R und Sonderfall S zusammen; 'ngfr' nur R; 's' nur S (DIN 277)
  l2NetShow(iso && ['ngf', 'ngfr', 'nri', 'nrir'].includes(iso.m) ? iso : null);
  // ── Erweiterung aus 22-lod200-waende/130-balkone.js: Sonderfall S (Balkone, Loggien) als eigener Körper
  if (iso && (iso.m === 's' || iso.m === 'nris')) l2SShow(iso);
  // NRI: dieselben Körper wie die NGF, Angaben als Rauminhalt
  if (iso && (iso.m === 'ngf' || iso.m === 'nri') && iso.sel !== 'u')
    l2SShow({ ...iso, sel: 'all' }, null, iso.sel);
  // BRI: 'bri' R und S, 'brir' nur R, 'bris' nur S
  if (iso && (iso.m === 'bri' || iso.m === 'brir')) l2BriShow(iso);
  if (iso && (iso.m === 'bri' || iso.m === 'bris')) l2SShow({ ...iso, sel: 'all' }, ISOC.bris);
  for (const it of L2I.values()) {
    const e = it.el,
      b = S.bld.find((z) => z.id === e.bid);
    let vis = true,
      col = null;
    if (iso) {
      const lvOk = b && (iso.bid === '*' || iso.bid === e.bid) && l2LvMatch(b, e.li, iso.sel);
      if (iso.m === 'kf') {
        vis = !!lvOk && (e.kind === 'AW' || e.kind === 'TW' || e.kind === 'TH');
        col = ISOC.kf;
      } else if (iso.m === 'ty') {
        vis = e.T.id === iso.sel;
        col = null;
      } else if (iso.m === 'tr') {
        vis = !!b && l23() && (iso.bid === '*' || iso.bid === e.bid) && !!e.T.tr;
        col = null;
      } else vis = false;
    } else if (sp && b) {
      try {
        vis = !!zoIsoHit(sp, b, { hull: 1, k: e.li === b.levels.length ? 'roof' : e.li });
      } catch (_) {
        vis = true;
      }
    }
    it.g.visible = vis;
    if (it.ms) {
      const trm = !!(iso && iso.m === 'tr' && vis);
      it.ms.forEach((m) => m.color.set(col || m.userData.c0 || '#ffffff'));
      it.g.children.forEach((o) => {
        if (o.userData.ly == null) return;
        const off = trm && (!l2IsTr(e.T.layers[o.userData.ly]) || !!o.userData.ins);
        o.userData.off = off ? 1 : 0;
        o.visible = !off;
      });
    } else it.mat.color.set(col || (it.mat.userData && it.mat.userData.c0) || L2K[e.kind].c); // c0: Dachmaterial
  }
}
const l2IsTr = (L) => !!L && ['331', '341', '351', '322', '361'].indexOf(L.kg) >= 0;
function l2Tr(b) {
  let v = 0,
    n = 0;
  l2Els(b).els.forEach((e) => {
    if (!e.T.tr || !e.V) return;
    const D = e.T.layers.reduce((s, l) => s + l.d, 0) || 1,
      st = e.T.layers.filter(l2IsTr).reduce((s, l) => s + l.d, 0);
    v += (e.V * st) / D;
    n++;
  });
  return { v, n };
}
function L2ISO(m, bid, sel) {
  const k = m + '|' + bid + '|' + sel;
  if (S.l2.iso && S.l2.iso.key === k) S.l2.iso = null;
  else {
    S.l2.iso = { m, bid, sel, key: k };
    try {
      zoIsoClear(true);
    } catch (e) {
      logErr(e, 'L2ISO');
    }
  }
  l2IsoApply(true);
  try {
    zoRender();
    zoTick.k = undefined;
  } catch (e) {
    logErr(e, 'L2ISO');
  }
}
// zoPick(): Erweiterung zusammengeführt, siehe 15-grundriss/050-isolieren.js
// exApply(): Erweiterung zusammengeführt, siehe 15-grundriss/060-explosionsansicht.js
setInterval(() => {
  try {
    l2IsoApply();
  } catch (e) {
    console.warn('LOD200 Iso', e);
  }
}, 200);

// ---- LOD 300: alle Schichten der Bauteile in 3D (Aufbau aus dem Bauteilkonfigurator)
const L2CLIP = new T.Plane(new T.Vector3(0, -1, 0), 1e5);
try {
  ren.localClippingEnabled = true;
} catch (e) {
  logErr(e, 'init');
}
function l2SolidF(tris, off, yr) {
  const all = [],
    out = [],
    cnt = new Map(),
    kk = (P) => Math.round(P[0] * 1000) + ',' + Math.round(P[1] * 1000) + ',' + Math.round(P[2] * 1000),
    R_ = (P) => [P[0], P[1] - yr, P[2]],
    ek = (P, Q) => {
      const a = kk(P),
        c = kk(Q);
      return a < c ? a + '|' + c : c + '|' + a;
    };
  tris.forEach((t) => {
    const [A, B, C] = t.map(R_),
      [a, bb, c] = t.map((P) => off(R_(P)));
    out.push(...A, ...B, ...C);
    all.push(...A, ...B, ...C, ...a, ...c, ...bb);
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ].forEach(([i, j]) => {
      const k = ek(t[i], t[j]);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    });
  });
  tris.forEach((t) => {
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ].forEach(([i, j]) => {
      if (cnt.get(ek(t[i], t[j])) !== 1) return;
      const P = R_(t[i]),
        Q = R_(t[j]),
        P2 = off(P),
        Q2 = off(Q);
      all.push(...P, ...Q, ...Q2, ...P, ...Q2, ...P2);
    });
  });
  return { all, out };
}
function l2MeshL(e) {
  const g = new T.Group();
  g.position.y = e.y0;
  const Ls = e.T.layers,
    D = Ls.reduce((s, l) => s + l.d, 0) || 1,
    ms = [],
    K = e.kind,
    lm = new T.LineBasicMaterial({
      color: 0x33322e,
      transparent: true,
      opacity: 0.45,
      clippingPlanes: [L2CLIP],
    });
  const col = (n) => {
    try {
      return l2cCol(n);
    } catch (_) {
      return '#dddddd';
    }
  };
  const mat = (L, ro) => {
    const m = new T.MeshLambertMaterial({
      color: new T.Color(col(L.n)),
      side: T.DoubleSide,
      emissive: new T.Color(0x000000),
      clippingPlanes: [L2CLIP],
    });
    m.userData.c0 = col(L.n);
    try {
      l2MatFx(m, L.n);
    } catch (e) {
      logErr(e, 'mat');
    }
    if (ro) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -2;
    }
    ms.push(m);
    return m;
  };
  const prism = (f, hh, m, y) => {
    const P = grPrism(f, 0, hh),
      me = new T.Mesh(P.g, m);
    me.castShadow = me.receiveShadow = true;
    me.raycast = () => {};
    me.userData.ly = cur;
    me.position.y = y;
    g.add(me);
    {
      const bm = l2BackMesh(P.g, m, y);
      if (bm) {
        bm.userData.ly = cur;
        g.add(bm);
      }
    }
  };
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    sl = (q, t0, t1) => [lp(q[0], q[3], t0), lp(q[1], q[2], t0), lp(q[1], q[2], t1), lp(q[0], q[3], t1)];
  const tri = (all, out, m) => {
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.BufferAttribute(new Float32Array(all), 3));
    gg.computeVertexNormals();
    const me = new T.Mesh(gg, m);
    me.castShadow = me.receiveShadow = true;
    me.raycast = () => {};
    me.userData.ly = cur;
    g.add(me);
    {
      const bm = l2BackMesh(gg, m, 0);
      if (bm) {
        bm.userData.ly = cur;
        g.add(bm);
      }
    }
    const go = new T.BufferGeometry();
    go.setAttribute('position', new T.BufferAttribute(new Float32Array(out), 3));
    const eg = new T.EdgesGeometry(go, 25);
    go.dispose();
    if (!e.rt) {
      eg.dispose();
      return;
    }
    const ln = new T.LineSegments(eg, lm);
    ln.raycast = () => {};
    ln.userData.ly = cur;
    g.add(ln);
  };
  let c = 0,
    cur = -1;
  if (e.gb) {
    const G = e.gb,
      dd = 0.004;
    Ls.forEach((L, ix) => {
      cur = ix;
      const so = D - (c + L.d),
        si = D - c;
      c += L.d;
      const t0 = G.t.map((t) =>
          t.map((P) => [P[0] + G.nx * (dd + (G.sh || 0) - so), P[1], P[2] + G.nz * (dd + (G.sh || 0) - so)]),
        ),
        S_ = l2SolidF(t0, (P) => [P[0] - G.nx * (si - so), P[1], P[2] - G.nz * (si - so)], G.yr);
      tri(S_.all, S_.out, mat(L));
    });
  } else if (e.rt) {
    const R_ = e.rt;
    Ls.forEach((L, ix) => {
      cur = ix;
      const c0 = c,
        v0 = c / R_.cs,
        v1 = (c + L.d) / R_.cs;
      c += L.d;
      const t0 = R_.trs.map((t) => t.map((P) => [P[0], P[1] - v0, P[2]])),
        S_ = l2SolidF(t0, (P) => [P[0], Math.max(P[1] - (v1 - v0), 0), P[2]], R_.yr),
        n0 = g.children.length;
      tri(S_.all, S_.out, mat(L.sp ? { n: 'Dämmung' } : L, 1));
      if (L.sp) {
        for (let q = n0; q < g.children.length; q++) g.children[q].userData.ins = 1;
        l2Rafters(g, R_, L, c0, mat({ n: 'Sparren' }), lm, cur);
      }
    });
  } else if (e.quads) {
    const AW = K === 'AW',
      bi = AW
        ? Math.max(
            0,
            Ls.findIndex((l) => L2ST.indexOf(l.kg) >= 0),
          )
        : -1;
    Ls.forEach((L, ix) => {
      cur = ix;
      const t0 = AW ? (D - (c + L.d)) / D : c / D,
        t1 = AW ? (D - c) / D : (c + L.d) / D;
      c += L.d;
      const m = mat(L),
        fz = AW && ix > bi && e.hTop != null;
      /* Fassadenschichten (außerhalb der Tragschicht) laufen vor der Geschossdecke durch bis Oberkante Decke; Tragschicht und Innenschichten enden unter der Decke */
      const QS = e.gq
        ? (() => {
            const da = t0 * D,
              db = t1 * D,
              G = Object.values(e.gq).find((g) => da >= g.a - 1e-6 && db <= g.b + 1e-6);
            if (!G) return [];
            const w = G.b - G.a || 1;
            return [sl(G.q, (da - G.a) / w, (db - G.a) / w)];
          })()
        : e.quads.map((q) => sl(q, t0, t1));
      const ovr =
        AW &&
        e.ovh &&
        !fz &&
        e.hTop >
          0; /* Überhang: nur die Fassadenschichten reichen bis zur Unterkante der Geschossdecke, Tragschicht und Innenschichten stehen auf der Decke */
      QS.forEach((o) =>
        prism(
          { o, h: [] },
          ovr ? e.h - e.hTop : e.h + (fz ? (e.hTop || 0) + (e.atT ? 0 : e.hAt || 0) : 0),
          m,
          ovr ? e.hTop : 0,
        ),
      );
      // Attika: ganze Wand bei Fassadenschichten schon oben mitgeführt; nur freie Abschnitte (e.atT) einzeln
      if (e.hAt && (!fz || e.atT))
        l2AtQuads(e, QS).forEach((o) => prism({ o, h: [] }, e.hAt, m, e.h + (e.hTop || 0)));
    });
  } else if (e.faces) {
    Ls.forEach((L, ix) => {
      cur = ix;
      const yb = e.h - (c + L.d);
      c += L.d;
      const m = mat(L);
      e.faces.forEach((f) => prism(f, L.d, m, yb));
    });
  }
  if (!ms.length) return l2MeshOrig(e);
  return { g, mat: ms[0], ms };
}
function l2LayerQs(e) {
  const Ls = e.T.layers,
    D = Ls.reduce((s, l) => s + l.d, 0) || 1,
    AW = e.kind === 'AW',
    bi = AW
      ? Math.max(
          0,
          Ls.findIndex((l) => L2ST.indexOf(l.kg) >= 0),
        )
      : -1,
    out = [];
  let c = 0;
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    sl = (q, t0, t1) => [lp(q[0], q[3], t0), lp(q[1], q[2], t0), lp(q[1], q[2], t1), lp(q[0], q[3], t1)];
  Ls.forEach((L, ix) => {
    const t0 = AW ? (D - (c + L.d)) / D : c / D,
      t1 = AW ? (D - c) / D : (c + L.d) / D;
    c += L.d;
    if (e.gq) {
      const da = t0 * D,
        db = t1 * D,
        G = Object.values(e.gq).find((g) => da >= g.a - 1e-6 && db <= g.b + 1e-6);
      if (G) {
        const w = G.b - G.a || 1;
        out.push({ L, o: sl(G.q, (da - G.a) / w, (db - G.a) / w) });
      }
    } else e.quads.forEach((q) => out.push({ L, o: sl(q, t0, t1) }));
  });
  return out;
}
// l2Mesh(): Erweiterung zusammengeführt, siehe 22-lod200-waende/030-aktionen.js
