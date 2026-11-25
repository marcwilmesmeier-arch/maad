// ---- Flächen/Rauminhalte (Analyse) + Hervorhebung im Modell
const wallA = (b, l) => {
  const f = lf(b, l);
  let P = 0;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length];
    P += Math.hypot(c[0] - a[0], c[1] - a[1]);
  });
  return P * l.h;
};
/**
 * Terrassen eines Gebäudes: je Geschoss die Fläche, die das Geschoss darüber nicht überdeckt, ohne Innenhöfe.
 * Fläche genau aus den Polygonen (P, wie l2TerrassenFlaeche), q/st = Rasterzellen für den Export-Plan.
 */
function terrOf(b) {
  const u = ugN(b),
    key = JSON.stringify([b.fp, b.levels.map((l) => [l.h, l.fp, l.ug]), b.voids || null]);
  if (b._tk === key && b._tv) return b._tv;
  const out = { area: 0, lv: [] };
  let z = b._y;
  b.levels.forEach((l, i) => {
    const z1 = z + l.h;
    z = z1;
    if (i < u || i >= b.levels.length - 1) return;
    const A = lf(b, l),
      B = lf(b, b.levels[i + 1]);
    if (JSON.stringify(A) === JSON.stringify(B)) return;
    // genaue Terrassenfläche: Geschoss − Geschoss darüber − Innenhöfe (beider Geschosse)
    const P = l2TerrassenFlaeche(b, i),
      H = znVoidsAt(b, i)
        .concat(znVoidsAt(b, i + 1))
        .map((v) => v.poly),
      pa = P.reduce((s2, x) => s2 + area(x.o) - (x.h || []).reduce((s3, h) => s3 + area(h), 0), 0);
    if (pa < 0.01) return;
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    A.forEach(([x, y]) => {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    });
    const st = Math.max(0.25, Math.sqrt(((x1 - x0) * (y1 - y0)) / 20000)),
      q = [];
    let sx = 0,
      sz = 0;
    for (let x = x0 + st / 2; x < x1; x += st)
      for (let y = y0 + st / 2; y < y1; y += st) {
        const pt = [x, y];
        if (inP(pt, A) && !inP(pt, B) && !H.some((h) => inP(pt, h))) {
          q.push([x - st / 2, y - st / 2]);
          sx += x;
          sz += y;
        }
      }
    const c = q.length ? [sx / q.length, sz / q.length] : cen(P[0].o);
    out.lv.push({ i, y: z1, st, q, P, area: pa, cx: c[0], cz: c[1] });
    out.area += pa;
  });
  b._tk = key;
  b._tv = out;
  return out;
}
/**
 * Loggien und Balkone aus den Fassadengruppen (Feldart 'lo'/'ba'): je Feld Breite × Tiefe (Loggia: Rücksprung,
 * Balkon: Auskragung) mit Geschoss. Zählen zur Terrassenfläche. [{ art, j, br, ti, area }]
 */
function lbFlaechen(b) {
  const out = [];
  // nur in der LOD-200-Darstellung: in LOD 100 zählt das einfache Modell ohne Balkone und Loggien
  if (!b.fd || b.ex || !l2on()) return out;
  try {
    const B = fdStoreys(b),
      u = ugN(b),
      gesehen = new Set();
    fdViews(b).forEach((V) =>
      oegFlaechen(b, V).forEach((x) => {
        if (!x.a || gesehen.has(x.id)) return;
        gesehen.add(x.id);
        const br = Math.max(0, x.u1 - x.u0),
          ti =
            x.a === 'ba' ? x.tb || 0 : x.a === 'bl' ? (x.tb || 0) + Math.abs(x.d || 0) : Math.abs(x.d || 0);
        if (br < 0.05 || ti < 0.05) return;
        let k = B.findIndex((v, i) => i < B.length - 1 && x.v0 >= v - 0.05 && x.v0 < B[i + 1] - 0.05);
        if (k < 0) k = 0;
        out.push({ art: x.a === 'lo' ? 'Loggia' : 'Balkon', j: k + u, br, ti, area: br * ti });
      }),
    );
  } catch (e) {
    logErr(e, 'lbFlaechen');
  }
  return out;
}
function bM(b) {
  const u = ugN(b),
    // Terrassenfläche: Absätze der Geschosse und Loggien/Balkone aus den Fassadengruppen
    m = {
      bgfoi: 0,
      bgfui: 0,
      brioi: 0,
      briui: 0,
      fas: 0,
      dach: 0,
      terr: terrOf(b).area + lbFlaechen(b).reduce((s, x) => s + x.area, 0),
    },
    ra = b._roofA;
  b.levels.forEach((l, i) => {
    const a = larea(b, l);
    if (i < u) {
      m.bgfui += a;
      m.briui += a * l.h;
    } else {
      m.bgfoi += a;
      m.brioi += a * l.h;
      m.fas += wallA(b, l);
    }
  });
  if (ra) {
    m.bgfoi += ra.wf;
    m.brioi += ra.vol;
    m.fas += b._rp ? b._rp.aW : 0;
    m.dach += b._rp ? b._rp.aR : 0;
  } else {
    const L = b.levels.length ? b.levels.at(-1) : null;
    if (L) m.dach += larea(b, L);
  }
  const px = pxMet(b);
  m.bgfoi += px.dBo;
  m.bgfui += px.dBu;
  m.brioi += px.dVo;
  m.briui += px.dVu;
  m.fas += px.fas;
  m.dach += px.dach;
  m.terr += px.terr;
  return m;
}
const scopeB = (b) => (b && !b.ex && S.bld.includes(b) ? [b] : S.bld);
// GR (Grundfläche): vertikale Projektion aller oberirdischen Geschosse (inkl. Auskragungen), mind. die größte Geschossfläche
function grOf(b) {
  const u = ugN(b),
    key = JSON.stringify([b.fp, b.levels.map((l) => [l.h, l.fp, l.ug]), b.patches || 0]);
  if (b._grk === key && b._grv != null) return b._grv;
  const og = b.levels
    .map((l, i) => [l, i])
    .filter(([l, i]) => i >= u)
    .map(([l]) => lf(b, l));
  let res = 0;
  if (og.length) {
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    og.forEach((f) =>
      f.forEach(([x, y]) => {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }),
    );
    const st = Math.max(0.1, Math.sqrt(((x1 - x0) * (y1 - y0)) / 60000));
    let n = 0;
    for (let x = x0 + st / 2; x < x1; x += st)
      for (let y = y0 + st / 2; y < y1; y += st) {
        const pt = [x, y];
        if (og.some((f) => inP(pt, f))) n++;
      }
    res = n * st * st;
    const L = bLv(b).filter((r) => !r.ug && r.n !== 'Dachgeschoss');
    L.forEach((r) => {
      if (r.a > res) res = r.a;
    });
  }
  b._grk = key;
  b._grv = res;
  return res;
}
// Geschossweise Aufstellung (Summe = bM): a = BGF, v = BRI
function bLv(b) {
  const u = ugN(b),
    px = pxMet(b),
    ra = b._roofA,
    o = [];
  b.levels.forEach((l, i) => {
    const ug = i < u,
      A = larea(b, l);
    o.push({
      n: l.name || (ug ? `${u - i}. UG` : `${i - u + 1}. OG`),
      ug,
      a: A + (px.lv[i] || 0),
      v: A * l.h + (px.vl[i] || 0),
    });
  });
  if (ra) o.push({ n: 'Dachgeschoss', ug: false, a: ra.wf, v: ra.vol });
  return o;
}
function flCard(x) {
  const m = bM(x),
    L = bLv(x),
    id = x.id,
    nm = esc(x.name || x.id);
  S.anO = S.anO || {};
  const R = (k, n, v, u, tt, ind, nc) =>
    `<div class="kv" ${nc ? '' : `onclick="hlSet('${k}','${id}')"`} title="${tt}" style="cursor:pointer;padding:3px 4px;border-radius:5px;${ind ? 'margin-left:' + ind * 14 + 'px;' : ''}${S.hlk === k && S.hlb === id ? 'background:color-mix(in srgb,var(--hlc,#5E7F92) 20%,transparent);outline:1px solid var(--hlc,#5E7F92)' : ''}"><span>${n}</span><b>${f1(v)} ${u}</b></div>`;
  const D = (did, head, body, k, nest) =>
    `<details ${nest ? 'style="margin-left:14px" ' : ''}${S.anO[id + ':' + did] ? 'open' : ''}><summary onclick="event.preventDefault();anTog('${id}:${did}','${k || ''}','${id}')">${head}</summary>${body}</details>`;
  const stor = (ug, key, u) =>
    L.filter((r) => r.ug === ug)
      .reverse()
      .map((r) => R('', esc(r.n), r[key], u, '', 1, 1))
      .join('');
  const grp = (k, n, tt, ug, key, u) =>
    L.some((r) => r.ug === ug)
      ? D(k, R(k, n, m[k], u, tt, 0, 1), stor(ug, key, u), k, 1)
      : R(k, n, m[k], u, tt, 1);
  const fr = (k, n, u, tt) => R(k, n, m[k], u, tt, 1);
  return (
    `<div class="card" data-bld="${id}"><div style="font-weight:700;font-size:14px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--bd,#8884)">${nm}</div>` +
    D(
      'bgf',
      R('bgf', 'BGF', m.bgfoi + m.bgfui, 'm²', 'BGFoi + BGFui', 0, 1),
      grp('bgfoi', 'BGFoi', 'Geschossflächen über Erdreich (Dach nur anrechenbarer Teil)', false, 'a', 'm²') +
        grp('bgfui', 'BGFui', 'Geschossflächen unter Erdreich', true, 'a', 'm²'),
      'bgf',
    ) +
    D(
      'bri',
      R('bri', 'BRI', m.brioi + m.briui, 'm³', 'BRIoi + BRIui', 0, 1),
      grp('brioi', 'BRIoi', 'Bruttorauminhalt über Erdreich', false, 'v', 'm³') +
        grp('briui', 'BRIui', 'Bruttorauminhalt unter Erdreich', true, 'v', 'm³'),
      'bri',
    ) +
    D(
      'fl',
      '<span style="font-weight:600">Flächen</span>',
      fr('fas', 'Fassadenfläche', 'm²', 'Außenwände über Erdreich inkl. Giebel/Drempel') +
        fr('dach', 'Dachfläche', 'm²', 'Dachfläche (geneigt: Schrägfläche, Flachdach: Grundfläche)') +
        fr(
          'terr',
          'Terrassenfläche',
          'm²',
          'Horizontale Flächen auf Rücksprüngen einzelner Geschosse, Loggien und Balkone',
        ),
    ) +
    kv('Gebäudehöhe', f1(x._hTot || x._hAbove, 2) + ' m') +
    kv('Vollgeschosse', vgN(x)) +
    kv('GR (Grundfläche)', f1(grOf(x)) + ' m²') +
    `</div>`
  );
}
function flHtml(b) {
  const bl = scopeB(b);
  if (!bl.length) return '';
  let h =
    '<div style="color:var(--mu);font-size:11px;margin-bottom:4px">Zeile anklicken = im Modell markieren</div>' +
    bl.map(flCard).join('');
  if (bl.length > 1) {
    const t = { a: 0, v: 0, g: 0 };
    bl.forEach((x) => {
      const m = bM(x);
      t.a += m.bgfoi + m.bgfui;
      t.v += m.brioi + m.briui;
      t.g += grOf(x);
    });
    h +=
      `<div class="card"><div style="font-weight:700;font-size:14px;margin-bottom:6px">Gesamt (${bl.length} Gebäude)</div>` +
      kv('BGF', f1(t.a) + ' m²') +
      kv('BRI', f1(t.v) + ' m³') +
      kv('GR (Grundfläche)', f1(t.g) + ' m²') +
      '</div>';
  }
  return h;
}
function hlClear(restoreOnly) {
  // BGF in LOD 100: ausgeblendete Geschosskörper wieder zeigen
  if (S._hlKoerper) {
    S._hlKoerper.forEach((o) => (o.visible = true));
    S._hlKoerper = null;
  }
  if (S.hlG) {
    S.hlG.parent && S.hlG.parent.remove(S.hlG);
    S.hlG.traverse((o) => {
      o.geometry && o.geometry.dispose();
    });
    S.hlG = null;
  }
  if (S._tm) {
    S._tm.material.transparent = S._tm.t;
    S._tm.material.opacity = S._tm.o;
    S._tm.material.depthWrite = S._tm.d;
    S._tm.material.needsUpdate = true;
    S._tm = null;
  }
  if (restoreOnly) {
    S.hlk = null;
    S.hlb = null;
    rrOnly();
  }
}
function rrOnly() {}
function anTog(id, k, bid) {
  S.hlw = 0;
  S.anO = S.anO || {};
  S.anO[id] = !S.anO[id];
  const same = S.hlk === k && S.hlb === bid;
  if (k && !same && S.anO[id]) {
    S.hlk = k;
    S.hlb = bid;
    // ── Erweiterung aus 22-lod200-waende/080-isolieren-aus-der-gebaeudemetrik-in.js: LOD-200-Auswertung weicht
    if (S.l2 && S.l2.iso) {
      S.l2.iso = null;
      try {
        l2IsoApply(true);
      } catch (e) {
        logErr(e, 'anTog');
      }
    }
    hlApply();
  } else if (k && same && !S.anO[id]) {
    S.hlk = null;
    S.hlb = null;
    hlClear();
  }
  rr();
}
function hlSet(k, bid) {
  S.hlw = 0;
  if (S.hlk === k && S.hlb === bid) {
    S.hlk = null;
    S.hlb = null;
    hlClear();
    rr();
    return;
  }
  S.hlk = k;
  S.hlb = bid;
  // ── Erweiterung aus 22-lod200-waende/080-isolieren-aus-der-gebaeudemetrik-in.js: eine LOD-200-Auswertung (z. B.
  // BRI-Körper) weicht der neuen Hervorhebung, sonst blieben beide sichtbar
  if (S.l2 && S.l2.iso) {
    S.l2.iso = null;
    try {
      l2IsoApply(true);
    } catch (e) {
      logErr(e, 'hlSet');
    }
  }
  hlApply();
  rr();
}
const hlBs = () => (S.hlb ? S.bld.filter((x) => x.id === S.hlb) : scopeB(S.sel));
function hlApply() {
  // ── Erweiterung aus 19-fassadendesigner/060-kopf.js
  if (S.hlk === 'fdt') {
    fdHlApply();
    return;
  }
  // ── Erweiterung aus 16-darstellung-erweitert/020-einheitliche.js
  (() => {
    hlClear();
    const k = S.hlk;
    if (!k) return;
    const g = new T.Group(),
      mtu = new T.MeshBasicMaterial({
        color: S.hlw ? 0xffffff : 0x5e7f92,
        transparent: true,
        opacity: S.hlw ? 0.52 : 0.6,
        side: T.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
      mt = new T.MeshBasicMaterial({
        color: S.hlw ? 0xffffff : 0x5e7f92,
        transparent: true,
        opacity: S.hlw ? 0.74 : 0.82,
        side: T.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
      oi = k === 'bgfoi' || k === 'brioi' || k === 'bgf' || k === 'bri',
      ui = k === 'bgfui' || k === 'briui' || k === 'bgf' || k === 'bri';
    const gm = (pos) => {
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
      ge.computeVertexNormals();
      return ge;
    };
    for (const b of hlBs()) {
      const u = ugN(b),
        n0 = g.children.length;
      let z = b._y;
      b.levels.forEach((l, i) => {
        const z0 = z,
          z1 = z + l.h;
        z = z1;
        const f = lf(b, l),
          ug = i < u;
        // ── Erweiterung aus 25-polygon-operationen/020-innenhoefe-und-dachflaechen-als-echte.js: Innenhöfe dieses
        // Geschosses (wie in der Zahl, larea) – als Loch im Körper und als Hofwände bei der Fassade
        const hoefe = znVoidsAt(b, i).map((v) => v.poly);
        if ((oi && !ug) || (ui && ug)) {
          const sh = new T.Shape(f.map((q) => new T.Vector2(q[0], -q[1])));
          hoefe.forEach((p) => sh.holes.push(znPath(p)));
          // BGF als Fläche (Boden des Geschosses), BRI als Körper
          const flach = k === 'bgf' || k === 'bgfoi' || k === 'bgfui',
            ge = flach
              ? new T.ShapeGeometry(sh)
              : new T.ExtrudeGeometry(sh, {
                  depth: l.h,
                  bevelEnabled: false,
                });
          ge.rotateX(-Math.PI / 2);
          const m = new T.Mesh(ge, ug ? mtu : mt);
          m.position.y = z0 + (flach ? 0.03 : 0);
          m.renderOrder = ug ? 12 : 9;
          g.add(m);
        }
        if ((k === 'fas' || k === 'fasn') && !ug)
          [f].concat(hoefe).forEach((f) => {
            // ── Erweiterung aus 22-lod200-waende/160-loggia-fassade.js: in LOD 200 ohne die Loggia-Öffnungen,
            // 'fasn' zusätzlich ohne Fenster, Türen und Pfosten-Riegel
            const pos = l2FassadenBand(b, f, z0, z1, k === 'fasn');
            const fm = new T.Mesh(gm(pos), mt);
            fm.userData.k = i;
            fm.userData.ol = zoFasOl(f, z0, z1);
            g.add(fm);
          });
        // ── Erweiterung aus 22-lod200-waende/160-loggia-fassade.js: in LOD 200 auch Attika, Terrassenbrüstung und
        // Schürze unter dem Überhang
        if ((k === 'fas' || k === 'fasn') && !ug && l2on()) {
          const zus = l2FassadenZusatz(
            b,
            f,
            i > 0 ? lf(b, b.levels[i - 1]) : null,
            i + 1 < b.levels.length ? lf(b, b.levels[i + 1]) : null,
            z0,
            z1,
            i === b.levels.length - 1,
          );
          if (zus.length) {
            const zm = new T.Mesh(gm(zus), mt);
            zm.userData.k = i;
            g.add(zm);
          }
        }
      });
      // ── Erweiterung aus 22-lod200-waende/160-loggia-fassade.js: Rück- und Seitenwände der Loggien (LOD 200)
      if (k === 'fas' || k === 'fasn')
        l2LoggiaWandFlaechen(b, k === 'fasn').forEach((w) => {
          if (!w.pos.length) return;
          const wm = new T.Mesh(gm(w.pos), mt);
          wm.userData.k = w.li;
          g.add(wm);
        });
      if (k === 'terr')
        terrOf(b).lv.forEach((L) => {
          const o = zoTerrGeo(b, L);
          if (o.pos.length) {
            const tm = new T.Mesh(gm(o.pos), mt);
            // Explosion: in LOD 200 liegt die Terrasse auf der Decke, die mit dem Geschoss darüber wandert
            tm.userData.k = l2on() ? L.i + 1 : L.i;
            tm.userData.ol = o.ol;
            g.add(tm);
          }
        });
      // Böden der Balkone und Loggien (zählen zur Terrassenfläche)
      if (k === 'terr')
        lbBoeden(b).forEach((o) => {
          const [a, c, d, e] = o.pts,
            y = o.y + 0.04,
            pos = [a, c, d, a, d, e].flatMap((p) => [p[0], y, p[1]]);
          g.add(new T.Mesh(gm(pos), mt));
        });
      if (k === 'fas' || k === 'fasn' || k === 'terr')
        pxPolys(b).forEach((o) => {
          const d = +o.p.d || 0;
          if (Math.abs(d) < 0.01) return;
          if (k === 'fas' || k === 'fasn') {
            const out = [];
            pxPrism(o, out);
            if (out.length) g.add(new T.Mesh(gm(out), mt));
          } else if (o.F.top) {
            const tr = T.ShapeUtils.triangulateShape(
                o.poly.map((q) => new T.Vector2(q[0], q[1])),
                [],
              ),
              pa = [];
            for (const [a, c, e] of tr)
              pa.push(
                ...pxW(o.F, o.poly[a][0], o.poly[a][1], d + 0.04),
                ...pxW(o.F, o.poly[c][0], o.poly[c][1], d + 0.04),
                ...pxW(o.F, o.poly[e][0], o.poly[e][1], d + 0.04),
              );
            if (pa.length) g.add(new T.Mesh(gm(pa), mt));
          }
        });
      const rp = b._rp;
      if (rp) {
        if (oi && (k === 'bgf' || k === 'bgfoi')) {
          // BGF als Fläche: Dachgeschoss als Boden über dem obersten Geschoss (nur, wenn es zur BGF zählt)
          if (bLv(b).length > b.levels.length) {
            const L = b.levels.at(-1),
              sh = new T.Shape(lf(b, L).map((q) => new T.Vector2(q[0], -q[1])));
            znVoidsAt(b, b.levels.length - 1).forEach((v) => sh.holes.push(znPath(v.poly)));
            const ge = new T.ShapeGeometry(sh);
            ge.rotateX(-Math.PI / 2);
            const m = new T.Mesh(ge, mt);
            m.position.y = b._y + b.levels.reduce((s2, l) => s2 + l.h, 0) + 0.03;
            m.userData.k = b.levels.length; // Explosion: wie das Dachgeschoss (NGF-Körper li = Geschosszahl)
            g.add(m);
          }
        } else if (oi) g.add(new T.Mesh(gm(rp.pw.concat(rp.pr)), mt));
        if ((k === 'fas' || k === 'fasn') && rp.pw.length) {
          // Giebel und Drempel: Explosion mit den Wänden des Dachgeschosses (wie dessen BGF), nicht mit der Dachfläche
          const pm = new T.Mesh(gm(rp.pw), mt);
          pm.userData.k = b.levels.length;
          g.add(pm);
        }
        if (k === 'dach' && rp.pr.length) g.add(new T.Mesh(gm(rp.pr), mt));
      } else if (k === 'dach' && b.levels.length) {
        const L = b.levels.at(-1),
          sh = new T.Shape(lf(b, L).map((q) => new T.Vector2(q[0], -q[1])));
        // ── Erweiterung aus 25-polygon-operationen/020-innenhoefe-und-dachflaechen-als-echte.js: Innenhöfe, die bis
        // zum Dach reichen, ausschneiden (wie in der Zahl, larea)
        znVoidsAt(b, b.levels.length - 1).forEach((v) => sh.holes.push(znPath(v.poly)));
        const ge = new T.ExtrudeGeometry(sh, {
          depth: 0.08,
          bevelEnabled: false,
        });
        ge.rotateX(-Math.PI / 2);
        const m = new T.Mesh(ge, mt);
        m.position.y = b._y + b._h;
        g.add(m);
      }
      zoHlTag(g, b, n0);
    }
    g.renderOrder = 9;
    g.visible = !(S.zo && S.zo.m === 'u');
    sc.add(g);
    S.hlG = g;
    // BGF in LOD 100: Geschosskörper nur als Kontur, damit die Flächen zu sehen sind
    if ((k === 'bgf' || k === 'bgfoi' || k === 'bgfui') && !l2on()) {
      S._hlKoerper = [];
      for (const b of hlBs())
        if (b._g)
          b._g.traverse((o) => {
            if (o.isMesh && o.visible && !o.userData.kont) {
              o.visible = false;
              S._hlKoerper.push(o);
            }
          });
    }
    try {
      exApply();
    } catch (e) {
      logErr(e, 'hlApply');
    }
  })();
  try {
    selStyle();
  } catch (e) {
    console.warn('selStyle', e);
  }
}
