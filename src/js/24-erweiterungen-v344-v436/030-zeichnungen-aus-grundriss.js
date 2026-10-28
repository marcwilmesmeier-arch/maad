// ---- v391: Zeichnungen aus Grundriss- und Ansichtstool im Layout (Element „pic“, live aus den Daten, Vektor → Bild)
const LP = { W: 1000 };
function lpName(b) {
  return b.name || b.id;
}
function lpSources() {
  const o = [];
  S.bld
    .filter((b) => !b.ex)
    .forEach((b) => {
      try {
        grData(b).forEach((l) =>
          o.push({ k: 'g|' + b.id + '|' + l.key, t: 'Grundriss · ' + lpName(b) + ' · ' + l.name }),
        );
      } catch (e) {
        logErr(e, 'lpSources>anonym');
      }
      try {
        fdViews(b).forEach((v) =>
          o.push({ k: 'f|' + b.id + '|' + v.key, t: 'Ansicht · ' + lpName(b) + ' · ' + v.name }),
        );
      } catch (e) {
        logErr(e, 'lpSources>anonym');
      }
    });
  return o;
}
function lpOpts() {
  const s = document.getElementById('layAddP');
  if (!s) return;
  const L = lpSources();
  s.innerHTML =
    '<option value="">+ Grundriss / Ansicht …</option>' +
    L.map((q) => `<option value="${esc(q.k)}">${esc(q.t)}</option>`).join('');
}
function layAddPic(k) {
  const s = document.getElementById('layAddP');
  if (!k) return;
  const q = lpSources().find((x) => x.k === k);
  layAdd('pic', k, q ? q.t : 'Zeichnung');
  if (s) s.selectedIndex = 0;
}
function layPicSrc(k) {
  const e = layEl(LAY.sel);
  if (!e || !k) return;
  const q = lpSources().find((x) => x.k === k);
  e.pk = k;
  if (q) e.name = q.t;
  e._ik = null;
  laySave();
  layRender();
  layProp();
}
function lpSrc(e) {
  const [kind, bid, key] = String(e.pk || '').split('|'),
    b = S.bld.find((x) => x.id === bid && !x.ex);
  if (!b) return null;
  if (kind === 'g') {
    const L = grData(b),
      lv = L.find((l) => l.key === key);
    return lv ? { kind, b, lv } : null;
  }
  if (kind === 'f') {
    const V = fdViews(b).find((v) => v.key === key);
    return V ? { kind, b, V } : null;
  }
  return null;
}
// Geometrie: Ausdehnung und Seitenverhältnis (Breite = LP.W logische Pixel)
function lpGeo(e) {
  const S0 = lpSrc(e);
  if (!S0) return null;
  const W = LP.W;
  if (S0.kind === 'g') {
    const r = GRS.r || 0,
      c = Math.cos(r),
      s = Math.sin(r);
    let u0 = 1e9,
      u1 = -1e9,
      w0 = 1e9,
      w1 = -1e9;
    S0.lv.bs.forEach((q) => {
      for (const [x, z] of [
        [q[0], q[1]],
        [q[2], q[3]],
      ]) {
        const u = x * c - z * s,
          w = x * s + z * c;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
        w0 = Math.min(w0, w);
        w1 = Math.max(w1, w);
      }
    });
    if (!(u1 > u0 && w1 > w0)) return null;
    const m = Math.max(2.2, 0.07 * Math.max(u1 - u0, w1 - w0)),
      sc = W / (u1 - u0 + 2 * m);
    return { ...S0, c, s, u0, w0, m, sc, H: Math.round((w1 - w0 + 2 * m) * sc) };
  }
  const V = S0.V,
    mx = Math.max(1.6, 0.06 * (V.u1 - V.u0)),
    my = 1.8,
    uM = V.u0 - mx,
    uP = V.u1 + mx,
    vM = V.v0 - my,
    vP = V.v1 + 0.8,
    sc = W / (uP - uM);
  const F = fdFaces(S0.b, V),
    ty = [...new Set(F.map((f) => f.t))],
    lg = ty.length ? Math.ceil(ty.length / 2) * 20 + 14 : 0;
  return { ...S0, uM, uP, vM, vP, sc, F, ty, lg, H: Math.round((vP - vM) * sc) + lg };
}
function lpAr(e) {
  try {
    const g = lpGeo(e);
    if (g) return g.H / LP.W;
  } catch (e) {
    logErr(e, 'lpAr');
  }
  return 0.7;
}
function lpDraw(e, wpx, jpg) {
  const g = lpGeo(e);
  if (!g) return null;
  const W = LP.W,
    q = wpx / W,
    cv = document.createElement('canvas');
  cv.width = Math.round(wpx);
  cv.height = Math.round(g.H * q);
  const x = cv.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(q, 0, 0, q, 0, 0);
  if (g.kind === 'g') {
    const lv = g.lv,
      s = g.sc,
      tf = (X, Z) => [(X * g.c - Z * g.s - g.u0 + g.m) * s, (X * g.s + Z * g.c - g.w0 + g.m) * s],
      pl = (f) => {
        [f.o].concat(f.h).forEach((r) => {
          r.forEach((p, i) => {
            const [X, Y] = tf(p[0], p[1]);
            i ? x.lineTo(X, Y) : x.moveTo(X, Y);
          });
          x.closePath();
        });
      };
    lv.faces.forEach((f) => {
      const fa = grFA(f.fa) || grDefFa(lv.use);
      x.beginPath();
      pl(f);
      x.fillStyle = fa.c;
      x.globalAlpha = 0.92;
      x.fill('evenodd');
      x.globalAlpha = 1;
    });
    x.lineJoin = 'round';
    x.strokeStyle = '#3a3a3a';
    x.lineWidth = 1.4;
    lv.faces.forEach((f) => {
      x.beginPath();
      pl(f);
      x.stroke();
    });
    x.lineWidth = 3.2;
    x.strokeStyle = '#1a1a1a';
    if (lv.dg) x.setLineDash([9, 4]);
    lv.bs.forEach((b) => {
      x.beginPath();
      x.moveTo(...tf(b[0], b[1]));
      x.lineTo(...tf(b[2], b[3]));
      x.stroke();
    });
    x.setLineDash([]);
    const go = S.gro,
      fs = go.fs || 12;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    lv.faces.forEach((f) => {
      const T_ = grLabelTxt(lv, f);
      if (!T_.length) return;
      const px = f.r * s;
      if (px < 7) return;
      let lines = T_,
        k = 1;
      x.font = `600 ${fs}px system-ui,sans-serif`;
      let mw = Math.max(...lines.map((t) => x.measureText(t).width));
      if (mw > px * 2 * 1.7) {
        if (lines.length > 1 && go.ar) {
          lines = [lines[lines.length - 1]];
          mw = x.measureText(lines[0]).width;
        }
      }
      if (mw > px * 2 * 1.9) {
        k = (px * 2 * 1.9) / mw;
        if (k < 0.6) return;
      }
      const F = Math.round(fs * k * 10) / 10,
        lh = F * 1.25,
        [X, Yc] = tf(f.c[0], f.c[1]),
        Y0 = Yc - ((lines.length - 1) * lh) / 2;
      lines.forEach((t, i) => {
        const isA = /m²$/.test(t);
        x.font = `${isA ? '500' : '700'} ${F}px system-ui,sans-serif`;
        x.lineWidth = 3;
        x.strokeStyle = 'rgba(255,255,255,.85)';
        x.strokeText(t, X, Y0 + i * lh);
        x.fillStyle = '#161616';
        x.fillText(t, X, Y0 + i * lh);
      });
    });
    if (go.dim !== false) {
      x.font = '11px system-ui';
      grMergeSegs(lv.bs).forEach((b) => {
        const len = Math.hypot(b[2] - b[0], b[3] - b[1]);
        if (len * s < 46) return;
        const mx = (b[0] + b[2]) / 2,
          mz = (b[1] + b[3]) / 2,
          nx = (b[3] - b[1]) / len,
          nz = -(b[2] - b[0]) / len,
          out = lv.faces.some((f) => grInFace(f, mx + nx * 0.15, mz + nz * 0.15)) ? -1 : 1;
        const [A1, B1] = tf(b[0], b[1]),
          [A2, B2] = tf(b[2], b[3]),
          [X0, Y0] = tf(mx, mz),
          [X1, Y1] = tf(mx + nx * out, mz + nz * out),
          dl = Math.hypot(X1 - X0, Y1 - Y0) || 1;
        x.save();
        x.translate(X0 + ((X1 - X0) / dl) * 13, Y0 + ((Y1 - Y0) / dl) * 13);
        let a = Math.atan2(B2 - B1, A2 - A1);
        if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
        x.rotate(a);
        x.fillStyle = '#222';
        x.globalAlpha = 0.85;
        x.fillText(f1(len, 2) + ' m', 0, 0);
        x.restore();
      });
    }
  } else {
    const V = g.V,
      b = g.b,
      hH = (g.vP - g.vM) * g.sc,
      _sz = fdSize,
      _vk = FDS.vk,
      _old = FDS.vw[V.key];
    try {
      fdSize = () => ({ W, H: hH, dpr: 1 });
      FDS.vk = V.key;
      FDS.vw[V.key] = { cx: (g.uM + g.uP) / 2, cy: (g.vM + g.vP) / 2, s: g.sc };
      fdDrawView(x, b, V, 0, { lab: true });
      x.fillStyle = '#334155';
      x.font = '11px system-ui,sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'top';
      x.fillText(fdFmt(V.u1 - V.u0) + ' m', (fdSX(V.u0) + fdSX(V.u1)) / 2, fdSY(V.v0) + 8);
      x.save();
      x.translate(fdSX(V.u0) - 22, (fdSY(V.v0) + fdSY(V.v1)) / 2);
      x.rotate(-Math.PI / 2);
      x.textBaseline = 'bottom';
      x.fillText(fdFmt(V.v1 - V.v0) + ' m', 0, 0);
      x.restore();
    } finally {
      fdSize = _sz;
      FDS.vk = _vk;
      if (_old === undefined) delete FDS.vw[V.key];
      else FDS.vw[V.key] = _old;
    }
    if (g.ty.length) {
      const sums = {};
      g.F.forEach((f) => (sums[f.t] = (sums[f.t] || 0) + f.a));
      x.font = '11px system-ui,sans-serif';
      x.textAlign = 'left';
      x.textBaseline = 'middle';
      g.ty.forEach((t, i) => {
        const ft = fdT(t),
          X = 14 + (i % 2) * (W / 2),
          Y = hH + 14 + Math.floor(i / 2) * 20;
        x.fillStyle = ft.c;
        x.fillRect(X, Y - 6, 14, 12);
        x.strokeStyle = '#1F2A33';
        x.lineWidth = 1;
        x.strokeRect(X, Y - 6, 14, 12);
        x.fillStyle = '#1d1d1b';
        x.fillText(ft.n + ' · ' + fdFmt(sums[t]) + ' m²', X + 20, Y);
      });
    }
  }
  return jpg === false ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
}
function lpKey(e, wpx) {
  const S0 = lpSrc(e);
  if (!S0) return 'x';
  return JSON.stringify([
    e.pk,
    wpx,
    S0.kind === 'g'
      ? [grSig(S0.b), S.gro.lab, S.gro.fs, S.gro.dim, GRS.r || 0]
      : [fdSig(S0.b), S0.b.fd || 0, S.ft.map((t) => t.k + t.c + t.n)],
  ]);
}
function lpGet(e, k) {
  const wpx = Math.min(3000, Math.max(500, Math.ceil((e.w * k * 1.25) / 250) * 250)),
    key = lpKey(e, wpx);
  if (e._ik !== key || !e._img) {
    e._img = lpDraw(e, wpx);
    e._ik = key;
  }
  return e._img;
}
{
  const _lo = layOpen;
  layOpen = function () {
    const r = _lo.apply(this, arguments);
    try {
      lpOpts();
    } catch (e) {
      logErr(e, 'layOpen');
    }
    return r;
  };
}
