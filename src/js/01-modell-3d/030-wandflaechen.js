// ---- Wandflächen: auf Geschosswänden zeichnen, einzeln vor-/zurückziehen (b.patches = [{k,i,poly:[[u,v]],d}])
const PXW = new T.Color(0xffffff);
function pxFrame(b, k, i, z0) {
  const L = b.levels;
  if (!L[k]) return null;
  const f = lf(b, L[k]),
    n = f.length;
  if (i < -1 || i >= n) return null;
  if (i === -1) {
    if (z0 == null) {
      z0 = b._y;
      for (let j = 0; j < k; j++) z0 += L[j].h;
    }
    return {
      top: 1,
      a: [0, 0],
      t: [1, 0],
      n: [0, 0],
      n3: [0, 1, 0],
      len: 0,
      h: L[k].h,
      z0: z0 + L[k].h,
      fp: f,
    };
  }
  const a = f[i],
    c = f[(i + 1) % n],
    dx = c[0] - a[0],
    dz = c[1] - a[1],
    len = Math.hypot(dx, dz);
  if (len < 0.05) return null;
  const sg = sA(f) > 0 ? 1 : -1;
  if (z0 == null) {
    z0 = b._y;
    for (let j = 0; j < k; j++) z0 += L[j].h;
  }
  return {
    a,
    t: [dx / len, dz / len],
    n: [(dz / len) * sg, (-dx / len) * sg],
    n3: [(dz / len) * sg, 0, (-dx / len) * sg],
    len,
    h: L[k].h,
    z0,
  };
}
const pxW = (F, u, v, d) =>
  F.top
    ? [u, F.z0 + (d || 0), v]
    : [F.a[0] + F.t[0] * u + F.n[0] * (d || 0), F.z0 + v, F.a[1] + F.t[1] * u + F.n[1] * (d || 0)];
function pxArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      c = p[(i + 1) % p.length];
    s += a[0] * c[1] - c[0] * a[1];
  }
  return s / 2;
}
function pxPolys(b, z0fn) {
  const out = [];
  (b.patches || []).forEach((p, pi) => {
    const F = pxFrame(b, p.k, p.i, z0fn ? z0fn(p.k) : null);
    if (!F || !p.poly || p.poly.length < 3) return;
    if (F.top && p.k === b.levels.length - 1 && b.roof && b.roof.type && b.roof.type !== 'flat') return;
    let poly = F.top
      ? p.poly.map((q) => q.slice())
      : p.poly.map((q) => [Math.max(0, Math.min(F.len, q[0])), Math.max(0, Math.min(F.h, q[1]))]);
    if (pxArea(poly) < 0) poly = poly.slice().reverse();
    if (Math.abs(pxArea(poly)) < 0.01) return;
    out.push({ p, pi, F, poly });
  });
  return out;
}
function pxTri(arr, A, B, C, dir) {
  const ux = B[0] - A[0],
    uy = B[1] - A[1],
    uz = B[2] - A[2],
    vx = C[0] - A[0],
    vy = C[1] - A[1],
    vz = C[2] - A[2],
    cx = uy * vz - uz * vy,
    cy = uz * vx - ux * vz,
    cz = ux * vy - uy * vx;
  if (cx * cx + cy * cy + cz * cz < 1e-12) return;
  if (cx * dir[0] + cy * dir[1] + cz * dir[2] < 0) {
    const t = B;
    B = C;
    C = t;
  }
  arr.push(...A, ...B, ...C);
}
function pxPrism(o, out) {
  const { F, poly, p } = o,
    d = +p.d || 0;
  if (Math.abs(d) < 0.01) return;
  const n3 = F.n3,
    R = Math.abs(d),
    rec = d < 0,
    tr = T.ShapeUtils.triangulateShape(
      poly.map((q) => new T.Vector2(q[0], q[1])),
      [],
    );
  for (const [i, j, k] of tr)
    pxTri(
      out,
      pxW(F, poly[i][0], poly[i][1], d),
      pxW(F, poly[j][0], poly[j][1], d),
      pxW(F, poly[k][0], poly[k][1], d),
      n3,
    );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      c = poly[(i + 1) % poly.length],
      dx = c[0] - a[0],
      dy = c[1] - a[1],
      s = rec ? -1 : 1,
      du = dy * s,
      dv = -dx * s,
      dir = F.top ? [du, 0, dv] : [F.t[0] * du, dv, F.t[1] * du],
      A0 = pxW(F, a[0], a[1], 0),
      B0 = pxW(F, c[0], c[1], 0),
      A1 = pxW(F, a[0], a[1], d),
      B1 = pxW(F, c[0], c[1], d);
    pxTri(out, A0, B0, B1, dir);
    pxTri(out, A0, B1, A1, dir);
  }
}
function pxWall(F, k, holes, posY, out) {
  const vb = k === 0 ? -3 : 0,
    ct = [
      [0, vb],
      [F.len, vb],
      [F.len, F.h],
      [0, F.h],
    ],
    ho = holes.map((h) =>
      h.poly.map((q) => [
        Math.max(0.02, Math.min(F.len - 0.02, q[0])),
        Math.max(0.02, Math.min(F.h - 0.02, q[1])),
      ]),
    ),
    tr = T.ShapeUtils.triangulateShape(
      ct.map((q) => new T.Vector2(q[0], q[1])),
      ho.map((h) => h.map((q) => new T.Vector2(q[0], q[1]))),
    ),
    all = ct.concat(...ho),
    n3 = F.n3;
  for (const [i, j, k2] of tr) {
    const W = (q) => {
      const w = pxW(F, q[0], q[1], 0);
      w[1] -= posY;
      return w;
    };
    pxTri(out, W(all[i]), W(all[j]), W(all[k2]), n3);
  }
}
function pxCut(ge, b, k, rec, posY) {
  if (ge.index) ge = ge.toNonIndexed();
  const pa = ge.attributes.position.array,
    out = [],
    byEdge = {};
  rec.forEach((o) => (byEdge[o.p.i] = byEdge[o.p.i] || []).push(o));
  const segs = Object.keys(byEdge).map((i) => ({ i: +i, F: byEdge[i][0].F, hs: byEdge[i] }));
  for (let t = 0; t < pa.length; t += 9) {
    const A = [pa[t], pa[t + 1], pa[t + 2]],
      B = [pa[t + 3], pa[t + 4], pa[t + 5]],
      C = [pa[t + 6], pa[t + 7], pa[t + 8]],
      ux = B[0] - A[0],
      uy = B[1] - A[1],
      uz = B[2] - A[2],
      vx = C[0] - A[0],
      vy = C[1] - A[1],
      vz = C[2] - A[2],
      cx = uy * vz - uz * vy,
      cy = uz * vx - ux * vz,
      cz = ux * vy - uy * vx,
      l = Math.hypot(cx, cy, cz) || 1;
    let drop = false;
    if (Math.abs(cy / l) < 0.3) {
      for (const s of segs) {
        const F = s.F,
          n3 = [F.n[0], F.n[1]];
        if (Math.abs((cx / l) * n3[0] + (cz / l) * n3[1]) < 0.9) continue;
        const m = [(A[0] + B[0] + C[0]) / 3, (A[2] + B[2] + C[2]) / 3],
          r = [m[0] - F.a[0], m[1] - F.a[1]],
          uu = r[0] * F.t[0] + r[1] * F.t[1],
          dd = Math.abs(r[0] * n3[0] + r[1] * n3[1]);
        if (dd < 0.02 && uu > -0.02 && uu < F.len + 0.02) {
          drop = true;
          break;
        }
      }
    }
    if (!drop) out.push(...A, ...B, ...C);
  }
  segs.forEach((s) => pxWall(s.F, k, s.hs, posY, out));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(out), 3));
  g.computeVertexNormals();
  return g;
}
function pxCutCap(ge, fp, holes, y, up) {
  if (ge.index) ge = ge.toNonIndexed();
  const pa = ge.attributes.position.array,
    out = [];
  for (let t = 0; t < pa.length; t += 9) {
    const A = [pa[t], pa[t + 1], pa[t + 2]],
      B = [pa[t + 3], pa[t + 4], pa[t + 5]],
      C = [pa[t + 6], pa[t + 7], pa[t + 8]];
    if (Math.abs(A[1] - y) < 1e-4 && Math.abs(B[1] - y) < 1e-4 && Math.abs(C[1] - y) < 1e-4) continue;
    out.push(...A, ...B, ...C);
  }
  const ct = fp.map((q) => new T.Vector2(q[0], q[1])),
    ho = holes.map((o) => o.poly.map((q) => new T.Vector2(q[0], q[1]))),
    tr = T.ShapeUtils.triangulateShape(ct, ho),
    all = ct.concat(...ho);
  for (const [i, j, k] of tr)
    pxTri(
      out,
      [all[i].x, y, all[i].y],
      [all[j].x, y, all[j].y],
      [all[k].x, y, all[k].y],
      [0, up ? 1 : -1, 0],
    );
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(out), 3));
  g.computeVertexNormals();
  return g;
}
function pxSnaps(b, p) {
  const r = [];
  let top = 0;
  for (let j = 0; j <= p.k; j++) top += b.levels[j].h;
  let z = 0;
  for (let j = 0; j <= p.k; j++) {
    r.push({ d: -(top - z), n: 'Boden ' + (b.levels[j].name || 'Geschoss ' + (j + 1)) });
    z += b.levels[j].h;
  }
  return r;
}
function pxLo(b, p) {
  return -Math.max(
    0.1,
    b.levels.slice(0, p.k + 1).reduce((s, l) => s + l.h, 0),
  );
}
function pxMet(b) {
  const r = { dBo: 0, dBu: 0, dVo: 0, dVu: 0, fas: 0, dach: 0, terr: 0, lv: [], vl: [] };
  if (!b) return r;
  b.levels.forEach(() => {
    r.lv.push(0);
    r.vl.push(0);
  });
  if (b.ex || !b.patches || !b.patches.length) return r;
  const u = ugN(b);
  pxPolys(b).forEach((o) => {
    const d = +o.p.d || 0;
    if (Math.abs(d) < 0.01) return;
    const q = o.poly,
      A = Math.abs(pxArea(q)),
      dV = A * d,
      h = b.levels[o.p.k].h || 3;
    let P = 0;
    q.forEach((a, i) => {
      const c = q[(i + 1) % q.length];
      P += Math.hypot(c[0] - a[0], c[1] - a[1]);
    });
    if (o.F.top && d < 0) {
      let rem = -d;
      for (let j = o.p.k; j >= 0 && rem > 1e-6; j--) {
        const hj = b.levels[j].h || 3,
          tk = Math.min(rem, hj);
        rem -= tk;
        r.vl[j] -= A * tk;
        if (j < u) r.dVu -= A * tk;
        else {
          r.dVo -= A * tk;
          r.fas += P * tk;
        }
        if (tk > hj / 3 + 1e-6) r.lv[j] -= A;
      }
    } else {
      if (o.F.top) {
        if (d > h / 3 + 1e-6) r.lv[o.p.k] += A;
      } else {
        let v0 = 1e9,
          v1 = -1e9;
        q.forEach((p) => {
          v0 = Math.min(v0, p[1]);
          v1 = Math.max(v1, p[1]);
        });
        const ve = v1 - v0;
        if (ve > h / 3 + 1e-6) r.lv[o.p.k] += ((Math.sign(d) * A) / ve) * Math.abs(d);
      }
      r.vl[o.p.k] += dV;
      if (o.p.k < u) r.dVu += dV;
      else {
        r.dVo += dV;
        r.fas += P * Math.abs(d);
      }
    }
    if (o.F.top && o.p.k === b.levels.length - 1) {
      r.dach -= A;
      r.terr += A;
    }
  });
  r.lv.forEach((x, j) => {
    if (j < u) r.dBu += x;
    else r.dBo += x;
  });
  return r;
}
function pxMeshes(b, g, z0fn, colHex) {
  pxPolys(b, z0fn).forEach((o) => {
    const out = [];
    pxPrism(o, out);
    if (!out.length) return;
    const ge = new T.BufferGeometry();
    ge.setAttribute('position', new T.BufferAttribute(new Float32Array(out), 3));
    ge.computeVertexNormals();
    const m = new T.Mesh(ge, mat(colHex, { emissive: 0x000000, side: T.DoubleSide }));
    m.castShadow = m.receiveShadow = true;
    m.userData.b = b;
    m.userData.k = o.p.k;
    m.userData.pi = o.pi;
    const e = new T.LineSegments(new T.EdgesGeometry(ge, 30), new T.LineBasicMaterial({ color: 0x4a4a4a }));
    e.userData.kont = 1;
    e.visible = !S.noK;
    g.add(m, e);
  });
}
// Treffer -> Fläche?
function patchHit(hit) {
  const o = hit.object,
    b = o.userData.b;
  if (!b || !b.patches || !b.patches.length) return null;
  if (o.userData.pi != null) return o.userData.pi;
  const k = o.userData.k;
  if (k == null) return null;
  if (hit.face.normal.y > 0.9) {
    for (const q of pxPolys(b)) {
      if (q.p.k === k && q.p.i < 0 && inP([hit.point.x, hit.point.z], q.poly)) return q.pi;
    }
    return null;
  }
  if (Math.abs(hit.face.normal.y) > 0.3) return null;
  const f = lf(b, b.levels[k]);
  let bi = -1,
    bd = 1e9;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05) return;
    const d = proj([hit.point.x, hit.point.z], a, c).d;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  if (bi < 0 || bd > 0.3) return null;
  for (const q of pxPolys(b)) {
    if (q.p.k !== k || q.p.i !== bi) continue;
    const F = q.F,
      r = [hit.point.x - F.a[0], hit.point.z - F.a[1]],
      u = r[0] * F.t[0] + r[1] * F.t[1],
      v = hit.point.y - F.z0;
    if (inP([u, v], q.poly)) return q.pi;
  }
  return null;
}
function patchSel() {
  const s = S.selP;
  if (!s || s.b !== S.sel || S.sel.ex || !S.bld.includes(S.sel)) return null;
  return pxPolys(s.b).find((o) => o.pi === s.pi) || null;
}
function patchCenter(o) {
  const q = o.poly;
  let u0 = 1e9,
    u1 = -1e9,
    v0 = 1e9,
    v1 = -1e9;
  q.forEach(([u, v]) => {
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  });
  const c = [(u0 + u1) / 2, (v0 + v1) / 2];
  if (inP(c, q)) return c;
  let sx = 0,
    sy = 0;
  q.forEach((a) => {
    sx += a[0];
    sy += a[1];
  });
  return [sx / q.length, sy / q.length];
}
function patchViz() {
  clr(G.pv);
  const b = S.sel;
  if (!b || b.ex || !S.bld.includes(b) || !b.patches || !b.patches.length) return;
  const sel = patchSel();
  pxPolys(b).forEach((o) => {
    const F = o.F,
      d = +o.p.d || 0,
      pts = [];
    o.poly.forEach((a, i) => {
      const c = o.poly[(i + 1) % o.poly.length];
      pts.push(
        new T.Vector3(...pxW(F, a[0], a[1], d + 0.02)),
        new T.Vector3(...pxW(F, c[0], c[1], d + 0.02)),
      );
    });
    const l = new T.LineSegments(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: S.oc, transparent: true, opacity: 0.95, depthTest: false }),
    );
    l.renderOrder = 6;
    l.raycast = () => {};
    G.pv.add(l);
    if (sel && sel.pi === o.pi) {
      const tr = T.ShapeUtils.triangulateShape(
          o.poly.map((q) => new T.Vector2(q[0], q[1])),
          [],
        ),
        pa = [];
      for (const [i, j, k] of tr)
        pa.push(
          ...pxW(F, o.poly[i][0], o.poly[i][1], d + 0.03),
          ...pxW(F, o.poly[j][0], o.poly[j][1], d + 0.03),
          ...pxW(F, o.poly[k][0], o.poly[k][1], d + 0.03),
        );
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
      const m = new T.Mesh(
        ge,
        new T.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.16,
          side: T.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      m.renderOrder = 5;
      m.raycast = () => {};
      G.pv.add(m);
    }
  });
}
// Knopf auf der gewählten Fläche
function patchKnob() {
  const o = patchSel();
  if (!o || !S.m3 || !(S.tool === 'v' || S.tool === 'b') || S.fd) {
    S.hcP = false;
    return false;
  }
  const c = patchCenter(o),
    F = o.F,
    p = pxW(F, c[0], c[1], (+o.p.d || 0) + 0.05);
  hc.position.set(p[0], p[1], p[2]);
  hc.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(...F.n3));
  hc.scale.setScalar(
    ((pc.position.distanceTo(hc.position) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight) * 4,
  );
  hc.visible = true;
  S.hcP = true;
  return true;
}
function lineS(e, P0, dir) {
  ray(e);
  const r = rc.ray,
    o = r.origin,
    d2 = r.direction,
    w = [P0[0] - o.x, P0[1] - o.y, P0[2] - o.z],
    b = dir[0] * d2.x + dir[1] * d2.y + dir[2] * d2.z,
    d = dir[0] * w[0] + dir[1] * w[1] + dir[2] * w[2],
    ee = d2.x * w[0] + d2.y * w[1] + d2.z * w[2],
    den = 1 - b * b;
  return Math.abs(den) < 1e-6 ? 0 : (b * ee - d) / den;
}
function startPatch(e) {
  const o = patchSel();
  if (!o) return;
  hist();
  const c = patchCenter(o),
    P0 = pxW(o.F, c[0], c[1], 0),
    n3 = o.F.n3;
  dr.p = {
    b: S.sel,
    pi: o.pi,
    P0,
    n3,
    s0: lineS(e, P0, n3),
    d0: +o.p.d || 0,
    mv: 0,
    lo: o.F.top ? pxLo(S.sel, o.p) : -8,
    sn: o.F.top ? pxSnaps(S.sel, o.p) : null,
  };
  cv.style.cursor = CUR;
}
function movePatch(e) {
  const q = dr.p,
    p = q.b.patches[q.pi];
  if (!p) return;
  q.mv = 1;
  dr.m = 1;
  let d = q.d0 + (lineS(e, q.P0, q.n3) - q.s0);
  d = Math.round(d * 20) / 20;
  if (Math.abs(d) < 0.08) d = 0;
  let sn = '';
  if (q.sn && d < 0) {
    let bd = Math.min(0.4, Math.max(0.15, 10 * mpp()));
    q.sn.forEach((c) => {
      if (Math.abs(d - c.d) < bd) {
        bd = Math.abs(d - c.d);
        d = c.d;
        sn = ' · Fang: ' + c.n;
      }
    });
  }
  d = Math.max(q.lo, Math.min(10, d));
  p.d = d;
  mesh(q.b);
  H();
  $('hud').textContent =
    `Fläche · ${d >= 0 ? '+' : ''}${f1(d, 2)} m ${d < 0 ? '(Rücksprung)' : d > 0 ? '(Vorsprung)' : ''}${sn}`;
}
function patchSetD(v) {
  const o = patchSel();
  if (!o || !isFinite(+v) || v === '') return;
  hist();
  o.p.d = Math.max(o.F.top ? pxLo(S.sel, o.p) : -8, Math.min(10, +v));
  mesh(S.sel);
  H();
  rr();
}
function patchDel() {
  const o = patchSel();
  if (!o) return;
  hist();
  S.sel.patches.splice(o.pi, 1);
  S.selP = null;
  mesh(S.sel);
  H();
  rr();
}
function patchCard() {
  const o = patchSel();
  if (!o) return '';
  const ar = Math.abs(pxArea(o.poly));
  return `<h4>Wandfläche</h4><div class="card">${S.sel.levels[o.p.k].name || ''} · ${o.F.top ? 'Dachfläche' : 'Seite ' + (o.p.i + 1)}${kv('Fläche', f1(ar) + ' m²')}Vor- (+) / Rücksprung (−) in m<input type="number" step="0.05" value="${(+o.p.d || 0).toFixed(2)}" onchange="patchSetD(this.value)"><button class="sm" style="margin-top:6px" onclick="patchDel()">Fläche entfernen (Entf)</button><div style="color:var(--mu);margin-top:4px">Kugel in der Flächenmitte ziehen oder Wert eingeben.${o.F.top ? ' Vorsprung nach oben, Rücksprung nach unten (Terrasse).' : ''}</div></div>`;
}
// Zeichnen auf der Wand
const fdL = new T.Line(
  new T.BufferGeometry(),
  new T.LineBasicMaterial({ color: 0xf08a8a, depthTest: false }),
);
fdL.renderOrder = 8;
fdL.frustumCulled = false;
fdL.raycast = () => {};
sc.add(fdL);
function fdF() {
  const f = S.fd;
  return f ? pxFrame(f.b, f.k, f.i) : null;
}
function fdPt(e, raw) {
  const f = S.fd,
    F = fdF();
  if (!F) return null;
  ray(e);
  const P0 = new T.Vector3(...pxW(F, 0, 0, 0)),
    pl = new T.Plane().setFromNormalAndCoplanarPoint(new T.Vector3(...F.n3), P0),
    t = new T.Vector3();
  if (!rc.ray.intersectPlane(pl, t)) return null;
  if (F.top) return fdPtTop(f, F, t, e, raw);
  let u = (t.x - F.a[0]) * F.t[0] + (t.z - F.a[1]) * F.t[1],
    v = t.y - F.z0;
  u = Math.max(0, Math.min(F.len, u));
  v = Math.max(0, Math.min(F.h, v));
  if (raw || e.shiftKey) return [u, v];
  const tol = Math.max(0.04, 7 * mpp()),
    last = f.mode === 'free' && f.pts.length ? f.pts[f.pts.length - 1] : f.anchor;
  if (u < tol) u = 0;
  if (F.len - u < tol) u = F.len;
  if (v < tol) v = 0;
  if (F.h - v < tol) v = F.h;
  const al = [];
  (f.pts || []).forEach((q) => al.push(q));
  (f.b.patches || []).forEach((p) => {
    if (p.k === f.k && p.i === f.i) p.poly.forEach((q) => al.push(q));
  });
  if (f.anchor) al.push(f.anchor);
  if (last && S.ortho) {
    if (Math.abs(u - last[0]) < tol) u = last[0];
    if (Math.abs(v - last[1]) < tol) v = last[1];
  }
  let bu = null,
    bv = null;
  al.forEach((q) => {
    if (Math.abs(u - q[0]) < tol && bu == null) bu = q[0];
    if (Math.abs(v - q[1]) < tol && bv == null) bv = q[1];
  });
  if (bu != null) u = bu;
  if (bv != null) v = bv;
  return [Math.round(u * 100) / 100, Math.round(v * 100) / 100];
}
function fdPtTop(f, F, t, e, raw) {
  let u = t.x,
    v = t.z;
  const fp = F.fp,
    tol = Math.max(0.04, 7 * mpp());
  if (!raw && !e.shiftKey) {
    let best = null,
      bd = tol;
    fp.forEach((q) => {
      const d = Math.hypot(q[0] - u, q[1] - v);
      if (d < bd) {
        bd = d;
        best = q;
      }
    });
    if (best) {
      u = best[0];
      v = best[1];
    } else {
      fp.forEach((a, i) => {
        const o = proj([u, v], a, fp[(i + 1) % fp.length]);
        if (o.d < bd) {
          bd = o.d;
          best = o.q;
        }
      });
      if (best) {
        u = best[0];
        v = best[1];
      }
    }
    const al = [];
    (f.pts || []).forEach((q) => al.push(q));
    (f.b.patches || []).forEach((p) => {
      if (p.k === f.k && p.i === -1) p.poly.forEach((q) => al.push(q));
    });
    if (f.anchor) al.push(f.anchor);
    const last = f.mode === 'free' && f.pts.length ? f.pts[f.pts.length - 1] : f.anchor;
    if (!best) {
      if (last && S.ortho) {
        if (Math.abs(u - last[0]) < tol) u = last[0];
        if (Math.abs(v - last[1]) < tol) v = last[1];
      }
      let bu = null,
        bv = null;
      al.forEach((q) => {
        if (Math.abs(u - q[0]) < tol && bu == null) bu = q[0];
        if (Math.abs(v - q[1]) < tol && bv == null) bv = q[1];
      });
      if (bu != null) u = bu;
      if (bv != null) v = bv;
    }
  }
  if (!inP([u, v], fp)) {
    let bi = null,
      bd = 1e9;
    fp.forEach((a, i) => {
      const o = proj([u, v], a, fp[(i + 1) % fp.length]);
      if (o.d < bd) {
        bd = o.d;
        bi = o.q;
      }
    });
    if (bi) {
      u = bi[0];
      v = bi[1];
    }
  }
  return [Math.round(u * 100) / 100, Math.round(v * 100) / 100];
}
function pxInside(F, poly) {
  const fp = F.fp,
    ok = (q) => inP(q, fp) || fp.some((a, i) => proj(q, a, fp[(i + 1) % fp.length]).d < 0.03);
  return poly.every(
    (q, i) =>
      ok(q) && ok([(q[0] + poly[(i + 1) % poly.length][0]) / 2, (q[1] + poly[(i + 1) % poly.length][1]) / 2]),
  );
}
function topHit(e) {
  ray(e);
  const hit = rc.intersectObjects(
    G.nb.children.flatMap((g) => g.children.filter((o) => o.isMesh)),
    false,
  )[0];
  if (!hit) return null;
  const o = hit.object,
    b = o.userData.b,
    k = o.userData.k;
  if (!b || b.ex || k == null || o.userData.pi != null || hit.face.normal.y < 0.9) return null;
  return { b, k, i: -1 };
}
function fdPoly(cur) {
  const f = S.fd;
  if (!f) return [];
  if (f.mode === 'rect') {
    if (!f.anchor || !cur) return [];
    const a = f.anchor;
    return [
      [a[0], a[1]],
      [cur[0], a[1]],
      [cur[0], cur[1]],
      [a[0], cur[1]],
    ];
  }
  if (f.mode === 'circ') {
    if (!f.anchor || !cur) return [];
    const r = Math.hypot(cur[0] - f.anchor[0], cur[1] - f.anchor[1]),
      F = fdF();
    return Array.from({ length: 36 }, (_, i) => {
      const t = (i / 36) * 2 * Math.PI,
        x = f.anchor[0] + r * Math.cos(t),
        y = f.anchor[1] + r * Math.sin(t);
      return F.top ? [x, y] : [Math.max(0, Math.min(F.len, x)), Math.max(0, Math.min(F.h, y))];
    });
  }
  return f.pts.concat(cur ? [cur] : []);
}
function fdDraw(cur) {
  const f = S.fd,
    F = fdF();
  if (!f || !F) {
    fdL.visible = false;
    return;
  }
  const poly = fdPoly(cur || f.cur);
  if (!poly.length) {
    fdL.visible = false;
    return;
  }
  const pts = poly.map((q) => new T.Vector3(...pxW(F, q[0], q[1], 0.04)));
  if (f.mode !== 'free' || false) pts.push(pts[0].clone());
  fdL.geometry.dispose();
  fdL.geometry = new T.BufferGeometry().setFromPoints(pts);
  fdL.visible = true;
}
function fdStart(e) {
  if (!e.altKey) return false;
  if (
    S.tool !== 'f' ||
    !S.m3 ||
    S.draft.length ||
    S.anchor ||
    S.closed ||
    S.fd ||
    !S.sel ||
    S.sel.ex ||
    !S.bld.includes(S.sel)
  )
    return false;
  const w = wallHit(e) || (selOk() ? null : topHit(e));
  if (!w || w.b !== S.sel) return false;
  S.fd = { b: w.b, k: w.k, i: w.i, mode: S.shape, pts: [], anchor: null, cur: null };
  S.selP = null;
  S.selF = null;
  return true;
}
function fdClick(e) {
  const f = S.fd,
    q = fdPt(e);
  if (!q) return;
  if (f.mode === 'rect' || f.mode === 'circ') {
    if (!f.anchor) {
      f.anchor = q;
      f.cur = q;
      $('hud').textContent =
        f.mode === 'rect' ? 'Fläche auf Wand: zweite Ecke klicken' : 'Fläche auf Wand: Radius klicken';
      fdDraw(q);
      return;
    }
    const poly = fdPoly(q);
    if (poly.length && Math.abs(pxArea(poly)) > 0.02) fdFinish(poly);
    else {
      S.fd = null;
      fdDraw();
    }
    return;
  }
  const tol = Math.max(0.15, 10 * mpp());
  if (f.pts.length >= 3 && Math.hypot(q[0] - f.pts[0][0], q[1] - f.pts[0][1]) < tol) {
    fdFinish(f.pts);
    return;
  }
  const l = f.pts.at(-1);
  if (l && Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.05) return;
  f.pts.push(q);
  f.cur = q;
  $('hud').textContent = 'Fläche auf Wand: Punkte klicken · ersten Punkt, Enter oder Doppelklick schließt';
  fdDraw(q);
}
function fdMove(e) {
  const f = S.fd,
    q = fdPt(e);
  if (!q) return;
  f.cur = q;
  fdDraw(q);
}
function fdFinish(poly) {
  const f = S.fd;
  if (!f || poly.length < 3 || Math.abs(pxArea(poly)) < 0.02) {
    S.fd = null;
    fdDraw();
    return;
  }
  const F0 = fdF();
  if (F0 && F0.top && !pxInside(F0, poly)) {
    $('hud').textContent = 'Fläche muss innerhalb des Dachumrisses liegen';
    S.fd.pts = [];
    S.fd.anchor = null;
    fdDraw();
    return;
  }
  hist();
  const b = f.b;
  (b.patches = b.patches || []).push({ k: f.k, i: f.i, poly: poly.map((q) => q.slice()), d: 0 });
  S.selP = { b, pi: b.patches.length - 1 };
  S.fd = null;
  fdDraw();
  mesh(b);
  tool('v');
  H();
  S.tab = 'Planen';
  nav();
  rr();
  $('hud').textContent = 'Fläche erzeugt – Kugel in der Mitte ziehen (Werkzeug Auswählen)';
}
function fdEnter() {
  const f = S.fd;
  if (f && f.mode === 'free' && f.pts.length >= 3) fdFinish(f.pts);
}
const H = (hex) => {
  S.bld.forEach((b) =>
    b._g.traverse((o) => {
      if (o.isMesh) {
        const m = o.material,
          c0 = m.userData.c0 || (m.userData.c0 = m.color.clone()),
          sf = selOk(),
          fl = sf && sf.b === b && sf.i < 0 && o.userData.k === sf.k;
        m.color.copy(c0);
        if ((S.sel === b || (S.multi && S.multi.includes(b))) && !b.ex && o.userData.pi == null)
          m.color.lerp(PXW, 0.38);
        if (
          !b.ex &&
          o.userData.pi == null &&
          o.userData.k != null &&
          (fl || (S.hv && S.hv.b === b && S.hv.k === o.userData.k))
        )
          m.color.lerp(PXW, 0.5);
        if (!b.ex && o.userData.roof && ((S.roofSel === b && !sf) || S.hvR === b)) m.color.lerp(PXW, 0.5);
        m.emissive.setHex(0);
      }
    }),
  );
  patchViz();
};
const hc = new T.Mesh(
  new T.SphereGeometry(1, 16, 12),
  new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
);
hc.renderOrder = 10;
hc.visible = false;
hc.add(
  Object.assign(
    new T.Mesh(
      new T.SphereGeometry(1.18, 16, 12),
      new T.MeshBasicMaterial({ color: 0x777777, side: T.BackSide, depthTest: false }),
    ),
    { renderOrder: 9 },
  ),
);
sc.add(hc);
const hl = new T.LineSegments(
  new T.BufferGeometry(),
  new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }),
);
hl.renderOrder = 7;
hl.visible = false;
hl.frustumCulled = false;
sc.add(hl);
// Auswahl von Flächen/Geschossen: Aufhellung, Bemaßung, m²
S.sa = S.sd = true;
S.shape = 'free';
S.num = { l: '', w: '', a: 0, r: '' };
const sq = new T.Mesh(
  new T.BufferGeometry(),
  new T.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.16,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    depthWrite: false,
  }),
);
sq.renderOrder = 6;
sq.visible = false;
sq.frustumCulled = false;
sc.add(sq);
const sl = new T.LineSegments(
  new T.BufferGeometry(),
  new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }),
);
sl.renderOrder = 6;
sl.visible = false;
sl.frustumCulled = false;
sc.add(sl);
sq.material.visible = false;
function selOk() {
  const f = S.selF;
  return f && S.bld.includes(f.b) && f.b.levels[f.k] && (f.i < 0 || f.i < lf(f.b, f.b.levels[f.k]).length)
    ? f
    : null;
}
function updSel() {
  const f = selOk();
  sq.visible = sl.visible = !!f && f.i >= 0;
  if (!sq.visible) return;
  const b = f.b,
    L = b.levels,
    fp = lf(b, L[f.k]),
    n = fp.length;
  let z0 = b._y;
  for (let j = 0; j < f.k; j++) z0 += L[j].h;
  const z1 = z0 + L[f.k].h,
    a = fp[f.i],
    c = fp[(f.i + 1) % n],
    l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1,
    sg = sA(fp) > 0 ? 1 : -1,
    nx = ((c[1] - a[1]) / l) * sg * 0.04,
    nz = (-(c[0] - a[0]) / l) * sg * 0.04,
    key = [a, c, z0, z1].join();
  if (sq.userData.key == key) return;
  sq.userData.key = key;
  const V3 = (p, z) => new T.Vector3(p[0] + nx, z, p[1] + nz);
  sq.geometry.dispose();
  sq.geometry = new T.BufferGeometry().setFromPoints([
    V3(a, z0),
    V3(c, z0),
    V3(c, z1),
    V3(a, z0),
    V3(c, z1),
    V3(a, z1),
  ]);
  sl.geometry.dispose();
  sl.geometry = new T.BufferGeometry().setFromPoints([
    V3(a, z0),
    V3(c, z0),
    V3(c, z0),
    V3(c, z1),
    V3(c, z1),
    V3(a, z1),
    V3(a, z1),
    V3(a, z0),
  ]);
}
function dimLabels() {
  if (!S.hlk) return [];
  const out = [],
    k = S.hlk,
    oi = k === 'bgfoi' || k === 'brioi' || k === 'bgf' || k === 'bri',
    ui = k === 'bgfui' || k === 'briui' || k === 'bgf' || k === 'bri',
    vol = k === 'brioi' || k === 'briui' || k === 'bri';
  for (const b of hlBs()) {
    const u = ugN(b),
      FA = [];
    let z = b._y;
    b.levels.forEach((l, i) => {
      const z0 = z,
        z1 = z + l.h;
      z = z1;
      const f = lf(b, l),
        ug = i < u,
        c = cen(f);
      if ((oi && !ug) || (ui && ug)) {
        out.push({
          p: new T.Vector3(c[0], (z0 + z1) / 2, c[1]),
          t: vol ? f1(area(f) * l.h, 1) + ' m³' : f1(area(f), 1) + ' m²',
        });
      }
      if (k === 'fas' && !ug) FA.push([f, z0, z1]);
    });
    if (k === 'fas') zoFasLab(FA).forEach((o) => out.push(o));
    if (k === 'terr')
      terrOf(b).lv.forEach((L2) =>
        out.push({ p: new T.Vector3(L2.cx, L2.y, L2.cz), t: f1(L2.area, 1) + ' m²' }),
      );
    const L = b.levels.at(-1),
      c = L ? cen(lf(b, L)) : [0, 0],
      top = b._y + b._h,
      ra = b._roofA,
      rp = b._rp;
    if (ra && oi)
      out.push({
        p: new T.Vector3(c[0], top + (b._roofH || 0) * 0.5, c[1]),
        t: vol ? f1(ra.vol, 1) + ' m³' : f1(ra.wf, 1) + ' m²',
      });
    if (rp && k === 'fas')
      out.push({
        p: new T.Vector3(c[0], top + (b._roofH || 0) * 0.3, c[1]),
        t: f1(rp.aW, 1) + ' m² (Giebel/Drempel)',
      });
    if (k === 'dach')
      out.push({
        p: new T.Vector3(c[0], top + (b._roofH || 0) * 0.6, c[1]),
        t: f1(rp ? rp.aR : L ? larea(b, L) : 0, 1) + ' m²',
      });
  }
  return out;
}
function dimLabelsOld() {
  const out = [],
    sf = selOk();
  let b, k, i;
  const fl = !!sf;
  if (sf) {
    b = sf.b;
    k = sf.k;
    i = sf.i;
  } else if (S.sel && !S.sel.ex && S.bld.includes(S.sel)) {
    b = S.sel;
    k = 0;
    i = -1;
  } else return out;
  const L = b.levels,
    f = lf(b, L[k]),
    n = f.length,
    sg = sA(f) > 0 ? 1 : -1;
  let z0 = b._y;
  for (let j = 0; j < k; j++) z0 += L[j].h;
  const z1 = z0 + L[k].h,
    zm = (z0 + z1) / 2,
    V3 = (x, y, z) => new T.Vector3(x, y, z);
  const nrm = (j) => {
    const a = f[j],
      c = f[(j + 1) % n],
      l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    return l < 0.05 ? null : { a, c, l, nx: ((c[1] - a[1]) / l) * sg, nz: (-(c[0] - a[0]) / l) * sg };
  };
  const edge = (j, y) => {
    const e = nrm(j);
    if (e)
      out.push({
        p: V3((e.a[0] + e.c[0]) / 2 + e.nx * 0.7, y, (e.a[1] + e.c[1]) / 2 + e.nz * 0.7),
        t: f1(e.l, 2) + ' m',
      });
  };
  if (i >= 0 && i < n) {
    const e = nrm(i);
    if (e) {
      edge(i, z1);
      out.push({ p: V3(e.a[0] + e.nx * 0.7, zm, e.a[1] + e.nz * 0.7), t: f1(L[k].h, 2) + ' m' });
      out.push({
        p: V3((e.a[0] + e.c[0]) / 2 + e.nx * 0.7, zm, (e.a[1] + e.c[1]) / 2 + e.nz * 0.7),
        t: f1(e.l * L[k].h, 1) + ' m²',
      });
    }
  } else {
    const y = fl ? z1 : z0,
      c = cen(f);
    f.forEach((_, j) => edge(j, y));
    out.push({
      p: V3(f[0][0], fl ? zm : b._y + b._h / 2, f[0][1]),
      t: f1(fl ? L[k].h : b._h + (b._roofH || 0), 2) + ' m',
    });
    out.push({ p: V3(c[0], y, c[1]), t: f1(area(f), 1) + ' m²' });
  }
  return out;
}
const dimEl = $('dim'),
  dpool = [];
function updDim() {
  const labs =
      S.tool === 'f' && !S.closed ? [] : dimLabels().filter((l) => (l.t.endsWith('m²') ? S.sa : S.sd)),
    w = mid.clientWidth,
    h = mid.clientHeight,
    cm = act();
  cm.updateMatrixWorld();
  while (dpool.length < labs.length) {
    const d = document.createElement('div');
    d.className = 'dm';
    dimEl.appendChild(d);
    dpool.push(d);
  }
  dpool.forEach((d, j) => {
    const l = labs[j];
    if (!l) {
      d.style.display = 'none';
      return;
    }
    const v = l.p.clone().project(cm);
    if (v.z > 1 || v.z < -1) {
      d.style.display = 'none';
      return;
    }
    d.style.display = 'block';
    if (d.textContent !== l.t) d.textContent = l.t;
    d.style.left = ((v.x + 1) / 2) * w + 'px';
    d.style.top = ((1 - v.y) / 2) * h + 'px';
  });
}
// Konturen: Gebäude / Geschoss (Hover und Auswahl)
const mkL = (o, rn) => {
  const l = new T.LineSegments(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }),
  );
  l.renderOrder = rn;
  l.visible = false;
  l.frustumCulled = false;
  sc.add(l);
  return l;
};
const so = mkL(0, 6),
  hlB = mkL(0, 7);
S.oc = '#ffffff';
function ocApply() {
  [so, hl, hlB, sl].forEach((l) => l.material.color.set(S.oc));
  try {
    patchViz();
  } catch (e) {
    logErr(e, 'ocApply');
  }
}
ocApply();

function pxMeshOutline(b, pts) {
  pxPolys(b).forEach((o) => {
    const d = +o.p.d || 0;
    if (Math.abs(d) < 0.01) return;
    const n = o.poly.length,
      P0 = o.poly.map((q) => pxW(o.F, q[0], q[1], 0)),
      P1 = o.poly.map((q) => pxW(o.F, q[0], q[1], d)),
      V = (a) => new T.Vector3(...a);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pts.push(V(P0[i]), V(P0[j]), V(P1[i]), V(P1[j]), V(P0[i]), V(P1[i]));
    }
  });
}
function updSel2() {
  const f = selOk();
  let t = null;
  if (f && f.i < 0) t = { b: f.b, k: f.k };
  else if (!f && S.sel && !S.sel.ex && S.bld.includes(S.sel)) t = { b: S.sel, k: -1 };
  so.visible = !!t && !(S.tool === 'f' && !S.closed);
  if (so.visible) setLines(so, t.b, t.k, -1);
  const hb = S.hvB,
    ok = hb && S.m3 && S.bld.includes(hb) && (S.tool === 'v' || S.tool === 'b' || S.tool === 't');
  hlB.visible = !!ok;
  if (ok) setLines(hlB, hb, -1, -1);
}
function nearOuter(hit) {
  if (!S.m3) return false;
  const o = hit.object,
    b = o.userData.b;
  if (!b || b.ex || o.userData.k == null) return false;
  const p = hit.point,
    r = 7 * ((pc.position.distanceTo(p) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight),
    L = b.levels;
  const dseg = (a, c, za, zc) => {
    const A = new T.Vector3(a[0], za, a[1]),
      C = new T.Vector3(c[0], zc, c[1]),
      ac = C.clone().sub(A),
      t = Math.max(0, Math.min(1, p.clone().sub(A).dot(ac) / (ac.lengthSq() || 1e-9)));
    return A.add(ac.multiplyScalar(t)).distanceTo(p);
  };
  let z = b._y,
    mn = 1e9;
  L.forEach((l, j) => {
    const f = lf(b, l),
      n = f.length,
      z0 = z,
      z1 = z + l.h;
    z = z1;
    f.forEach((a, q) => {
      const c = f[(q + 1) % n];
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05) return;
      if (j === 0) mn = Math.min(mn, dseg(a, c, z0, z0));
      if (j === L.length - 1) mn = Math.min(mn, dseg(a, c, z1, z1));
      mn = Math.min(mn, dseg(a, a, z0, z1));
    });
  });
  return mn < r;
}
function fInfo(h) {
  const b = h.b,
    L = b.levels,
    f = lf(b, L[h.k]);
  let z = b._y;
  for (let j = 0; j < h.k; j++) z += L[j].h;
  if (h.t == 'top') {
    const c = cen(f);
    return { pos: new T.Vector3(c[0], z + L[h.k].h + 0.05, c[1]), n: new T.Vector3(0, 1, 0) };
  }
  const a = f[h.i],
    q = f[(h.i + 1) % f.length],
    dx = q[0] - a[0],
    dz = q[1] - a[1],
    l = Math.hypot(dx, dz) || 1,
    sg = sA(f) > 0 ? 1 : -1,
    nx = (dz / l) * sg,
    nz = (-dx / l) * sg;
  return {
    pos: new T.Vector3((a[0] + q[0]) / 2 + nx * 0.05, z + L[h.k].h / 2, (a[1] + q[1]) / 2 + nz * 0.05),
    n: new T.Vector3(nx, 0, nz),
  };
}
function placeHc() {
  // ── Erweiterung aus 26-modellier-modus/020-darstellung.js
  (() => {
    vg.children.forEach((m) =>
      m.scale.setScalar(
        S.m3
          ? ((pc.position.distanceTo(m.position) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight) * 4
          : 4 * mpp(),
      ),
    );
    const hv = S.hv,
      okv =
        hv &&
        S.m3 &&
        S.bld.includes(hv.b) &&
        hv.b.levels[hv.k] &&
        (S.tool === 'v' || S.tool === 'b' || S.tool === 't');
    hl.visible = !!okv;
    if (okv) {
      const b = hv.b,
        L = b.levels,
        f = lf(b, L[hv.k]);
      let z0 = b._y;
      for (let j = 0; j < hv.k; j++) z0 += L[j].h;
      const z1 = z0 + L[hv.k].h,
        key = [b.id, hv.k, hv.i, z0, z1, f.map((q) => q[0] + ',' + q[1]).join(';')].join('|');
      if (hl.userData.key != key) {
        hl.userData.key = key;
        const pts = [],
          v3 = (q, z) => new T.Vector3(q[0], z, q[1]),
          n = f.length;
        (hv.i >= 0 ? [hv.i] : f.map((_, i) => i)).forEach((i) => {
          const a = f[i],
            c = f[(i + 1) % n];
          pts.push(v3(a, z0), v3(c, z0), v3(a, z1), v3(c, z1), v3(a, z0), v3(a, z1));
          if (hv.i >= 0) pts.push(v3(c, z0), v3(c, z1));
        });
        hl.geometry.dispose();
        hl.geometry = new T.BufferGeometry().setFromPoints(pts);
      }
    }
    const hb = S.hb,
      okb = hb && S.m3 && S.bld.includes(hb) && (S.tool === 'v' || S.tool === 'b');
    handle.visible = !!okb;
    if (okb) {
      const fi = fInfo({ b: hb, k: hb.levels.length - 1, t: 'top' });
      handle.position.copy(fi.pos).y += 1.3;
      handle.scale.setScalar(
        ((pc.position.distanceTo(fi.pos) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight) * 4,
      );
    }
    const h = S.hov,
      ok = h && S.m3 && S.bld.includes(h.b) && h.b.levels[h.k] && (S.tool === 'v' || S.tool === 'b');
    hc.visible = !!ok;
    if (patchKnob()) return;
    if (!ok) return;
    const fi = fInfo(h);
    if (h.t == 'wall') {
      const sf = selOk();
      if (h.g) fi.pos.y = h.b._y + h.b._h + (h.b._roofH || 0) * 0.35;
      else if (!(sf && sf.b === h.b)) fi.pos.y = h.b._y + (h.b._ug || 0) + (h.b._h - (h.b._ug || 0)) / 2;
    }
    hc.position.copy(fi.pos);
    hc.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), fi.n);
    hc.scale.setScalar(((pc.position.distanceTo(fi.pos) * 2 * Math.tan(Math.PI / 8)) / mid.clientHeight) * 4);
  })();
  try {
    skDraw();
  } catch (x) {
    console.warn('sk', x);
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/020-linien.js (danach)
  try {
    lnScale();
  } catch (e) {
    logErr(e, 'placeHc');
  }
}
const handle = new T.Mesh(
  new T.SphereGeometry(1, 16, 12),
  new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
);
handle.renderOrder = 9;
handle.visible = false;
handle.add(
  Object.assign(
    new T.Mesh(
      new T.SphereGeometry(1.18, 16, 12),
      new T.MeshBasicMaterial({ color: 0x777777, side: T.BackSide, depthTest: false }),
    ),
    { renderOrder: 8 },
  ),
);
sc.add(handle);
function hpos() {}
// Entwurf-Overlay
const dl = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xf08a8a }));
dl.renderOrder = 8;
sc.add(dl);
const dlH = new T.Line(
  new T.BufferGeometry(),
  new T.LineDashedMaterial({
    color: 0xf08a8a,
    dashSize: 0.8,
    gapSize: 0.55,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  }),
);
dlH.renderOrder = 7;
dlH.frustumCulled = false;
sc.add(dlH);
const sg1 = new T.SphereGeometry(1, 16, 12),
  sg2 = new T.SphereGeometry(1.18, 16, 12),
  sm1 = new T.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
  sm2 = new T.MeshBasicMaterial({ color: 0x777777, side: T.BackSide, depthTest: false });
const vg = new T.Group();
sc.add(vg);
const spT = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(32, 32, 30, 0, 7);
    x.fill();
    return new T.CanvasTexture(c);
  })(),
  sp = new T.Points(
    new T.BufferGeometry(),
    new T.PointsMaterial({
      color: 0x5e7f92,
      map: spT,
      alphaTest: 0.05,
      size: 20,
      sizeAttenuation: false,
      depthTest: false,
      transparent: true,
      opacity: 0,
    }),
  );
sp.renderOrder = 7;
sc.add(sp);
const ed = () =>
  S.tool === 'f' && S.draft.length ? S.draft : S.tool === 'ed' && S.sel && !S.sel.ex ? cfp(S.sel) : null;
const mpp = () => (V.d * (S.m3 ? 0.83 : 1.2)) / mid.clientHeight;
const edv = () => {
  const a = ed();
  return a && ((a === S.draft && S.dk === 'circ') || (S.sel && S.sel.kind === 'circ' && isCt(a))) ? null : a;
};
function drawOv(cur) {
  drawOv0(cur);
  updRM();
  if (S.tool === 'f' && S.shape !== 'free' && !S.closed)
    $('hud').textContent =
      S.hs ||
      (S.shape == 'rect'
        ? 'Rechteck: 1. Klick erste Ecke, 2. Klick Kante/Ausrichtung, 3. Klick Breite'
        : 'Kreis: Mittelpunkt klicken, Radius ziehen, erneut klicken – oder Radius rechts eingeben');
  if (S.tool === 't')
    $('hud').textContent = S.cut
      ? 'Trennlinie (immer lotrecht): Maus nach oben/unten erweitert sie über weitere Geschosse, zweiter Klick trennt · Esc bricht ab'
      : 'Trennen: Seitenfläche eines Geschosses anklicken – gestrichelte Linien zeigen die Trennposition';
  // ── Erweiterung aus 16-darstellung-erweitert/050-darstellung-der-fanglinien-im-3d.js (danach)
  try {
    fgUpdate();
  } catch (err) {
    console.warn('fgUpdate', err);
  }

  // ── Erweiterung aus 28-erweiterungen-v486-v519/020-linien.js (danach)
  lnDraw();
}
function drawOv0(cur) {
  const A = ed() || [],
    cl = A === S.draft ? S.closed : true,
    rh = A === S.draft ? S.refH : isCt(A) && S.sel.ref != null ? S.sel.ref : null,
    v3 = (q) =>
      new T.Vector3(
        q[0],
        rh != null
          ? rh + 0.15
          : S.tool === 'ed' && S.sel && S.sel._y != null
            ? S.sel._y + (S.sel._ug || 0) + 0.15
            : gh(q[0], q[1]) + 1,
        q[1],
      ),
    a = A.map(v3),
    l = a.slice();
  if (cur && !cl) l.push(v3(cur));
  if (cl && a.length) l.push(a[0]);
  if (S.prev && !S.closed) {
    l.length = 0;
    S.prev.forEach((q) => l.push(v3(q)));
    l.push(v3(S.prev[0]));
  }
  dl.geometry.dispose();
  dl.geometry = new T.BufferGeometry().setFromPoints(l);
  dlH.geometry = dl.geometry;
  dlH.computeLineDistances();
  vg.clear();
  if (!(A === S.draft ? S.dk === 'circ' : S.sel && S.sel.kind === 'circ'))
    a.forEach((p) => {
      const m = new T.Mesh(sg1, sm1);
      m.renderOrder = 10;
      m.position.copy(p);
      const r = new T.Mesh(sg2, sm2);
      r.renderOrder = 9;
      m.add(r);
      vg.add(m);
    });
  {
    const k = S.snp ? S.snp.map((q) => q.map((v) => Math.round(v * 20)).join(',')).join('|') : '';
    if (k !== sp.userData.k) {
      sp.userData.k = k;
      if (k) sp.userData.t0 = performance.now();
    }
  }
  sp.geometry.dispose();
  sp.geometry = new T.BufferGeometry().setFromPoints(
    S.snp ? S.snp.map((q) => (q.length > 2 ? new T.Vector3(q[0], q[2], q[1]) : v3(q))) : [],
  );
  const inf = (S.info ? ' · ' + S.info : '') + (rh != null ? ' · Bezug ±0 = ' + realH(rh) : '');
  $('hud').textContent =
    S.tool === 'f'
      ? A.length
        ? `${A.length} Punkte · ${f1(area(A))} m²${inf}${cl ? ' · Kante anklicken = Punkt einfügen · Punkt ziehen · Doppelklick = löschen' : ''}`
        : 'Fläche zeichnen: Punkte klicken · Punkte/Kanten rasten ein · rechter Winkel rastet ein · Shift = frei'
      : S.tool === 'm'
        ? 'Messen: zwei Punkte klicken' +
          (S.meas.length == 2
            ? ` → ${f1(Math.hypot(S.meas[0][0] - S.meas[1][0], S.meas[0][1] - S.meas[1][1]), 2)} m`
            : '')
        : S.tool === 'b'
          ? 'Gebäude: Fläche mit F zeichnen oder Gebäude wählen'
          : A.length
            ? 'Eckpunkte ziehen · Kante anklicken = Länge eingeben · Doppelklick = Punkt einfügen · Entf löscht gewählten Punkt' +
              inf
            : 'Auswahl: Grundstück oder Gebäude anklicken';
}
let ctK = '';
setInterval(() => {
  try {
    if (
      S.tool !== 'ed' ||
      !S.sel ||
      S.sel.ex ||
      !S.sel.levels ||
      (typeof dr !== 'undefined' && dr && dr.v != null)
    ) {
      ctK = '';
      return;
    }
    const k = JSON.stringify([S.sel.id, cfp(S.sel), S.sel.ref, S.sel.kind]);
    if (k !== ctK) {
      const had = ctK;
      ctK = k;
      if (had) drawOv();
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 150);
// Layer
const LY = [
  ['Flurstücke (Demo)', 'parcels', 1, 1],
  ['Flurkarte (Bild)', 'wms', 0, 0.9],
  ['Bebauungspläne', 'bplan', 0, 0.8],
  ['Gebäude', 'buildings', 1, 1],
  ['Straßen', 'roads', 1, 1],
  ['Gehwege', 'paths', 1, 1],
  ['Radwege', 'cycle', 1, 1],
  ['Bahngleise', 'rail', 1, 1],
  ['Grünflächen', 'green', 1, 1],
  ['Gewässer', 'water', 1, 1],
  ['Bäume (Demo)', 'trees', 1, 0.6],
  ['Gelände', 'terrain', 1, 1],
  ['Abstandsflächen', 'abst', 1, 0.7],
];
S.lc = {
  parcels: '#5E7F92',
  bplan: '#7a6fb0',
  buildings: '#ffffff',
  roads: '#f1f0ec',
  paths: '#e8e7e2',
  cycle: '#e1dfd8',
  rail: '#9a9893',
  green: '#dfe3b8',
  water: '#d3e2ea',
  trees: '#dfe3b8',
  terrain: '#f6f5f1',
};
S.edgeC = '#9b9b97';
function lcMig(o) {
  if (!o) return o;
  const r = Object.assign({}, o);
  if (/^#cf5a64$/i.test(r.parcels || '')) r.parcels = '#5E7F92';
  return r;
}
const shade = (h, f) => {
  const n = parseInt(h.slice(1), 16);
  return (
    '#' +
    [16, 8, 0]
      .map((q) =>
        Math.round(((n >> q) & 255) * f)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
};
let lcT = 0;
const setCol = (g, v) =>
  g && g.traverse((o) => o.material && o.material.color && !o.isLine && o.material.color.set(v));
function lcol(k, v) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js
  const r = (() => {
    // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
    if (k === 'stem') {
      S.lc.stem = v;
      clearTimeout(window._stT);
      window._stT = setTimeout(() => stemApply(), 80);
      return;
    }
    if (k === 'ugr' || k === 'ugk') {
      S.lc[k] = v;
      clearTimeout(window._ugT);
      window._ugT = setTimeout(() => {
        try {
          recomp();
          rr();
        } catch (e) {
          logErr(e, 'lcol>anonym');
        }
      }, 100);
      return;
    }
    S.lc[k] = v;
    clearTimeout(lcT);
    lcT = setTimeout(() => {
      if (k === 'un') {
        // Nutzungsfarben ('un') werden hier bewusst nicht angewendet
      } else if (k === 'buildings') setCol(G.ex, v);
      else if (k === 'terrain') {
        if (S.skirt) S.skirt.material.color.set(shade(v, 0.82));
        if (S.geo) recomp();
        else if (S.terr) S.terr.material.color.set(v);
      } else if (k === 'parcels') {
        if (AL.length) parRefresh();
        else setCol(G.parcels, v);
      } else if (k === 'rnames') rnBuild();
      else if (k === 'trees') {
        setCol(G[k], v);
        if (GEO.t2m) GEO.t2m.forEach((m) => m.color.set(shade(v, 0.66)));
      } else if (k === 'bplan') {
        bpLines();
        if (S.geo) {
          bpPaint();
          recomp();
        }
      } else if (PK[k]) {
        if (S.geo && GEO.acc) {
          ctxPaint(GEO.acc);
          recomp();
        } else setCol(G[k], v);
      } else setCol(G[k], v);
    }, 100);
  })();
  if (k === 'bkont') {
    S.lc.bkont = v;
    try {
      bkApply(true);
    } catch (e) {
      logErr(e, 'lcol');
    }
  }
  return r;
}
const ocHtml = () => datHtml();
let layersHtml = () =>
  maskHtml() +
  '<h4>Layer</h4>' +
  LY.map(
    ([n, k, v, o], i) =>
      `<div class="ly"><input type="checkbox" ${v ? 'checked' : ''} onchange="lvis(${i},this.checked)"><label>${n}</label><input type="color" value="${S.lc[k] || '#cccccc'}" oninput="lcol('${k}',this.value)" title="Farbe" style="width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"></div>` +
      (k === 'roads'
        ? `<div class="ly" style="padding-left:22px"><input type="checkbox" ${S.showSN ? 'checked' : ''} onchange="S.showSN=this.checked;labVis()"><label>Straßennamen</label><input type="color" value="${S.lc.rnames}" oninput="lcol('rnames',this.value)" title="Farbe" style="width:30px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer"></div>`
        : '') +
      (k === 'parcels'
        ? `<div class="ly" style="padding-left:22px"><input type="checkbox" ${S.showFN ? 'checked' : ''} onchange="S.showFN=this.checked;labVis()"><label>Flurnummern</label></div>`
        : '') +
      (k === 'trees'
        ? `<div class="ly" style="padding-left:22px"><label>Transparenz</label><input type="range" min="0" max="0.9" step="0.05" value="${1 - o}" oninput="lop(${i},1-this.value)" style="width:90px" title="Deckkraft der Bäume"></div>`
        : ''),
  ).join('') +
  `<label><input type="checkbox" ${S.ortho ? 'checked' : ''} onchange="S.ortho=this.checked"> Rechtwinkel- &amp; Punktfang</label>`;
