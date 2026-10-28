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
function terrOf(b) {
  const u = ugN(b),
    key = JSON.stringify([b.fp, b.levels.map((l) => [l.h, l.fp, l.ug])]);
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
        if (inP(pt, A) && !inP(pt, B)) {
          q.push([x - st / 2, y - st / 2]);
          sx += x;
          sz += y;
        }
      }
    if (q.length > 3) {
      const ar = q.length * st * st;
      out.lv.push({ i, y: z1, st, q, area: ar, cx: sx / q.length, cz: sz / q.length });
      out.area += ar;
    }
  });
  b._tk = key;
  b._tv = out;
  return out;
}
function bM(b) {
  const u = ugN(b),
    m = { bgfoi: 0, bgfui: 0, brioi: 0, briui: 0, fas: 0, dach: 0, terr: terrOf(b).area },
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
        fr('terr', 'Terrassenfläche', 'm²', 'Horizontale Flächen auf Rücksprüngen einzelner Geschosse'),
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
        if ((oi && !ug) || (ui && ug)) {
          const ge = new T.ExtrudeGeometry(new T.Shape(f.map((q) => new T.Vector2(q[0], -q[1]))), {
            depth: l.h,
            bevelEnabled: false,
          });
          ge.rotateX(-Math.PI / 2);
          const m = new T.Mesh(ge, ug ? mtu : mt);
          m.position.y = z0;
          m.renderOrder = ug ? 12 : 9;
          g.add(m);
        }
        if (k === 'fas' && !ug) {
          const pos = [];
          f.forEach((a, q) => {
            const c = f[(q + 1) % f.length];
            pos.push(
              a[0],
              z0,
              a[1],
              c[0],
              z0,
              c[1],
              c[0],
              z1,
              c[1],
              a[0],
              z0,
              a[1],
              c[0],
              z1,
              c[1],
              a[0],
              z1,
              a[1],
            );
          });
          const fm = new T.Mesh(gm(pos), mt);
          fm.userData.k = i;
          fm.userData.ol = zoFasOl(f, z0, z1);
          g.add(fm);
        }
      });
      if (k === 'terr')
        terrOf(b).lv.forEach((L) => {
          const o = zoTerrGeo(b, L);
          if (o.pos.length) {
            const tm = new T.Mesh(gm(o.pos), mt);
            tm.userData.k = L.i;
            tm.userData.ol = o.ol;
            g.add(tm);
          }
        });
      if (k === 'fas' || k === 'terr')
        pxPolys(b).forEach((o) => {
          const d = +o.p.d || 0;
          if (Math.abs(d) < 0.01) return;
          if (k === 'fas') {
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
        if (oi) g.add(new T.Mesh(gm(rp.pw.concat(rp.pr)), mt));
        if (k === 'fas' && rp.pw.length) g.add(new T.Mesh(gm(rp.pw), mt));
        if (k === 'dach' && rp.pr.length) g.add(new T.Mesh(gm(rp.pr), mt));
      } else if (k === 'dach' && b.levels.length) {
        const L = b.levels.at(-1),
          ge = new T.ExtrudeGeometry(new T.Shape(lf(b, L).map((q) => new T.Vector2(q[0], -q[1]))), {
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
