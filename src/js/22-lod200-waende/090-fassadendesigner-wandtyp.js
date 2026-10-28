// ---- Fassadendesigner → Wandtyp: ein belegter Fassadenbereich ergibt für die Außenwand dort einen Wandtyp mit neuem Aufbau
const L2FAC = {
  kli: [
    ['Hinterlüftung', 0.04, '335', '016'],
    ['Klinker-Vorsatzschale', 0.115, '335', '012'],
  ],
  hol: [
    ['Lattung / Hinterlüftung', 0.04, '335', '016'],
    ['Holzschalung', 0.024, '335', '016'],
  ],
  met: [
    ['Unterkonstruktion mit Hinterlüftung', 0.05, '335', '016'],
    ['Metallpaneel', 0.003, '335', '023'],
  ],
  kas: [
    ['Unterkonstruktion mit Hinterlüftung', 0.05, '335', '016'],
    ['Fassadenkassette', 0.004, '335', '023'],
  ],
  nws: [
    ['Hinterlüftung', 0.04, '335', '016'],
    ['Naturwerkstein-Platte', 0.03, '335', '012'],
  ],
  bet: [['Sichtbeton-Vorsatzschale', 0.08, '335', '013']],
  pr: [['Pfosten-Riegel-Konstruktion', 0.1, '335', '016']],
};
function l2FacAt(b, li, lv, e, mx, mz) {
  try {
    if (!b.fd) return '';
    const V = fdViews(b);
    if (!V.length) return '';
    let nx = -(e.q[1] - e.p[1]),
      nz = e.q[0] - e.p[0];
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const f0 = lv.faces[e.f[0]];
    // Normale soll nach außen zeigen: liegt der Prüfpunkt in der Fläche, umdrehen
    if (grInFace(f0, mx + nx * 0.03, mz + nz * 0.03)) {
      nx = -nx;
      nz = -nz;
    }
    const u0 = ugN(b);
    if (li < u0) return '';
    let v0 = 0;
    for (let i = u0; i < li; i++) v0 += b.levels[i].h;
    const bl = b.levels[li];
    if (!bl) return '';
    const vm = v0 + bl.h / 2;
    const best = fdViewAt(b, nx, nz, mx, mz, 0.9);
    if (!best) return '';
    const tx = best.n[1],
      tz = -best.n[0],
      u = mx * tx + mz * tz;
    const F = fdFaces(b, best).find((f) => grInFace(f, u, vm));
    return F && F.t && F.t !== 'ohne' && L2FAC[F.t] ? F.t : '';
  } catch (_) {
    return '';
  }
}
const L2FT = new Map();
function l2FacT(T0, k) {
  if (!k || !L2FAC[k]) return T0;
  const id = 'C-AW-F' + l2hash(T0.id + '|' + k);
  let t = L2T.find((x) => x.id === id);
  if (t) return t;
  const ft = S.ft.find((x) => x.k === k),
    LY = T0.layers.map((l) => ({ n: l.n, d: l.d, kg: l.kg, lb: l.lb }));
  while (
    LY.length > 1 &&
    LY[LY.length - 1].kg === '335' &&
    !/dämm|Dämm|Holzfaser-P/.test(LY[LY.length - 1].n)
  )
    LY.pop();
  LY.forEach((l) => {
    if (l.n === 'Wärmedämmverbundsystem') l.n = 'Dämmung (hinterlüftet)';
  });
  L2FAC[k].forEach((m) => LY.push({ n: m[0], d: m[1], kg: m[2], lb: m[3] }));
  t = JSON.parse(JSON.stringify(T0));
  t.id = id;
  t.layers = LY;
  t.cu = 1;
  t.fac = k;
  t.a = Object.assign({}, l2Attr(T0), {
    fa:
      {
        kli: 'Klinker',
        hol: 'Holz',
        met: 'Metall',
        kas: 'Kassette',
        nws: 'Naturwerkstein',
        bet: 'Sichtbeton',
        pr: 'Pfosten-Riegel',
      }[k] || (((S.mat && S.mat.nf) || []).some((z) => z.k === k) && ft ? ft.n : 'Putz (WDVS)'),
  });
  t.lay = 1;
  t.nm = t.dl = l2Auto('AW', t.a, null) + ' · ' + (ft ? ft.n : k);
  t.path = t.path.slice(0, -1).concat([t.nm]);
  t.d = LY.reduce((s, l) => s + l.d, 0);
  t.kg = T0.kg;
  t.full = t.path.join(' ▸ ');
  L2T.push(t);
  return t;
}

// Sparren in der Sparrenschicht: je Dachfläche Sparren im Achsabstand, Länge bis zur Dachkante
function l2Rafters(g, R_, L, c0, m, lm, cur) {
  const sp = L.sp,
    w = sp.w / 100,
    st = sp.s / 100,
    d = L.d,
    gr = new Map();
  R_.trs.forEach((t) => {
    const A = t[0],
      B = t[1],
      C = t[2],
      u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]],
      v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]],
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
      nl = Math.hypot(n[0], n[1], n[2]);
    if (nl < 1e-9) return;
    let N = n.map((x) => x / nl);
    if (N[1] < 0) N = N.map((x) => -x);
    const k0 = N[0] * A[0] + N[1] * A[1] + N[2] * A[2],
      key =
        Math.round(N[0] * 50) +
        '|' +
        Math.round(N[1] * 50) +
        '|' +
        Math.round(N[2] * 50) +
        '|' +
        Math.round(k0 * 20);
    let G = gr.get(key);
    if (!G) gr.set(key, (G = { N, k0, t: [] }));
    G.t.push(t);
  });
  gr.forEach((G) => {
    const N = G.N;
    if (N[1] > 0.995 || N[1] < 0.05) return;
    const hl = Math.hypot(N[0], N[2]),
      H = [-N[2] / hl, 0, N[0] / hl],
      Sv = [(-N[0] * N[1]) / hl, hl, (-N[2] * N[1]) / hl],
      at = (P) => [P[0] * H[0] + P[2] * H[2], P[0] * Sv[0] + P[1] * Sv[1] + P[2] * Sv[2]],
      T2 = G.t.map((t) => t.map(at));
    let a0 = 1e9,
      a1 = -1e9;
    T2.forEach((t) =>
      t.forEach((p) => {
        a0 = Math.min(a0, p[0]);
        a1 = Math.max(a1, p[0]);
      }),
    );
    const as = [];
    for (let a = a0 + w / 2 + 0.03; a <= a1 - w / 2; a += st) as.push(a);
    if (as.length && a1 - w / 2 - as[as.length - 1] > w) as.push(a1 - w / 2);
    if (!as.length) as.push((a0 + a1) / 2);
    const bas = new T.Matrix4().makeBasis(
      new T.Vector3(...Sv),
      new T.Vector3(...N),
      new T.Vector3(-H[0], -H[1], -H[2]),
    );
    as.forEach((a) => {
      const iv = [];
      T2.forEach((t) => {
        const ts = [];
        for (let i = 0; i < 3; i++) {
          const p = t[i],
            q = t[(i + 1) % 3];
          if ((p[0] - a) * (q[0] - a) <= 0 && Math.abs(q[0] - p[0]) > 1e-9) {
            const f = (a - p[0]) / (q[0] - p[0]);
            ts.push(p[1] + (q[1] - p[1]) * f);
          }
        }
        if (ts.length >= 2) iv.push([Math.min(...ts), Math.max(...ts)]);
      });
      iv.sort((x, y) => x[0] - y[0]);
      const mg = [];
      iv.forEach((x) => {
        const l = mg[mg.length - 1];
        if (l && x[0] <= l[1] + 0.03) l[1] = Math.max(l[1], x[1]);
        else mg.push(x.slice());
      });
      mg.forEach((x) => {
        const len = x[1] - x[0];
        if (len < 0.15) return;
        const tm = (x[0] + x[1]) / 2,
          off = G.k0 - c0 - d / 2,
          ctr = [
            a * H[0] + tm * Sv[0] + off * N[0],
            a * H[1] + tm * Sv[1] + off * N[1] - R_.yr,
            a * H[2] + tm * Sv[2] + off * N[2],
          ],
          geo = new T.BoxGeometry(len, d, w),
          me = new T.Mesh(geo, m);
        me.matrix.copy(bas);
        me.matrix.setPosition(ctr[0], ctr[1], ctr[2]);
        me.matrixAutoUpdate = false;
        me.castShadow = me.receiveShadow = true;
        me.raycast = () => {};
        me.userData.ly = cur;
        g.add(me);
        const ln = new T.LineSegments(new T.EdgesGeometry(geo), lm);
        ln.matrix.copy(me.matrix);
        ln.matrixAutoUpdate = false;
        ln.raycast = () => {};
        ln.userData.ly = cur;
        g.add(ln);
      });
    });
  });
}

// Fassadenwechsel innerhalb einer Wandkante: die Außenwand wird an der Grenze geteilt (Tragschicht läuft in beiden Teilen gleich weiter)
function l2SplitEdge(b, li, lv, e) {
  try {
    const L = Math.hypot(e.q[0] - e.p[0], e.q[1] - e.p[1]);
    if (L < 1.2) return null;
    const pt = (t) => [e.p[0] + (e.q[0] - e.p[0]) * t, e.p[1] + (e.q[1] - e.p[1]) * t],
      ft = (t) => {
        const m = pt(t);
        return l2FacAt(b, li, lv, e, m[0], m[1]);
      };
    const N = Math.max(4, Math.ceil(L / 0.25)),
      ts = [0];
    let prev = ft(0.5 / N);
    for (let i = 1; i < N; i++) {
      const t = (i + 0.5) / N,
        f = ft(t);
      if (f !== prev) {
        let a = (i - 0.5) / N,
          c = t;
        for (let k = 0; k < 6; k++) {
          const m = (a + c) / 2;
          if (ft(m) === prev) a = m;
          else c = m;
        }
        ts.push((a + c) / 2);
        prev = f;
      }
    }
    if (ts.length === 1) return null;
    ts.push(1);
    const out = [];
    for (let i = 0; i + 1 < ts.length; i++) {
      if ((ts[i + 1] - ts[i]) * L < 0.3 && out.length) {
        out[out.length - 1].q = pt(ts[i + 1]);
        continue;
      }
      out.push({ p: pt(ts[i]), q: pt(ts[i + 1]), f: e.f, ek: e.ek, sub: 1 });
    }
    if (out.length > 1 && Math.hypot(out[0].q[0] - out[0].p[0], out[0].q[1] - out[0].p[1]) < 0.3) {
      out[1].p = out[0].p;
      out.shift();
    }
    return out.length > 1 ? out : null;
  } catch (_) {
    return null;
  }
}
