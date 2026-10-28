// ---- Zeichnen
const grPoly = (x, f) => {
  [f.o].concat(f.h).forEach((r) => {
    r.forEach((p, i) => {
      const [X, Y] = grTf(p[0], p[1]);
      i ? x.lineTo(X, Y) : x.moveTo(X, Y);
    });
    x.closePath();
  });
};
function grMergeSegs(bs) {
  let segs = bs.map((s) => s.slice(0, 4)),
    ch = true;
  const key = (x, z) => GRK(x) + ',' + GRK(z);
  while (ch) {
    ch = false;
    const m = new Map();
    segs.forEach((s, i) => {
      [
        [s[0], s[1]],
        [s[2], s[3]],
      ].forEach(([x, z]) => {
        const k = key(x, z);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      });
    });
    for (const [k, a] of m) {
      if (a.length !== 2 || a[0] === a[1]) continue;
      const s = segs[a[0]],
        t = segs[a[1]],
        sp = key(s[0], s[1]) === k,
        tp = key(t[0], t[1]) === k,
        p = sp ? [s[0], s[1]] : [s[2], s[3]],
        u = sp ? [s[2], s[3]] : [s[0], s[1]],
        w = tp ? [t[2], t[3]] : [t[0], t[1]];
      const ax = u[0] - p[0],
        az = u[1] - p[1],
        bx = w[0] - p[0],
        bz = w[1] - p[1];
      if (
        Math.abs(ax * bz - az * bx) < 1e-6 * Math.hypot(ax, az) * Math.hypot(bx, bz) &&
        ax * bx + az * bz < 0
      ) {
        segs[a[0]] = [u[0], u[1], w[0], w[1]];
        segs.splice(a[1], 1);
        ch = true;
        break;
      }
    }
  }
  return segs;
}
function grDraw() {
  // ── Erweiterung aus 22-lod200-waende/030-aktionen.js
  // ---- Grundriss: Darstellung, Treffer, Hover
  const r = (() => {
    const cv = gD('grCv'),
      cw = gD('grCw');
    if (!cv || !cw) return;
    const dpr = (GRS.w && GRS.w.devicePixelRatio) || 1,
      W = Math.max(10, cw.clientWidth),
      H = Math.max(10, cw.clientHeight);
    GRS.W = W;
    GRS.H = H;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    const b = grB();
    const cs = GRS.w.getComputedStyle(gD('grRoot')),
      ink = cs.color || '#222',
      v = GRS.view,
      s = v.s;
    if (!b) {
      x.fillStyle = ink;
      x.font = '14px system-ui';
      x.fillText('Kein Gebäude – im 3D-Modell ein Gebäude anlegen und auswählen.', 20, 30);
      return;
    }
    if (GRS.fit !== b.id) grFit();
    const lv = grLv(b),
      L = grData(b),
      g = S.gro,
      mv = (x_, z_) => {
        const [X, Y] = grTf(x_, z_);
        return [X, Y];
      };
    // Umgebung (durchscheinend)
    if (g.ctx) {
      x.save();
      x.globalAlpha = g.ctxO;
      x.strokeStyle = ink;
      x.fillStyle = ink;
      x.lineWidth = 1;
      const poly = (p, fill, dash) => {
        if (!p || p.length < 2) return;
        x.beginPath();
        p.forEach((q, i) => {
          const [X, Y] = mv(q[0], q[1]);
          i ? x.lineTo(X, Y) : x.moveTo(X, Y);
        });
        x.closePath();
        if (fill) {
          x.globalAlpha = g.ctxO * 0.25;
          x.fill();
          x.globalAlpha = g.ctxO;
        }
        x.setLineDash(dash || []);
        x.stroke();
      };
      try {
        P.forEach((q) => poly(q.poly, false, [6, 4]));
      } catch (e) {
        logErr(e, 'grDraw');
      }
      try {
        if (S.par) poly(S.par.poly, false, [2, 3]);
      } catch (e) {
        logErr(e, 'grDraw');
      }
      try {
        S.ex.forEach((e) => poly(e.fp, true));
      } catch (e) {
        logErr(e, 'grDraw');
      }
      try {
        S.bld.forEach((o) => {
          if (o !== b) poly(o.fp, true);
        });
      } catch (e) {
        logErr(e, 'grDraw');
      }
      try {
        (GEO.blist || []).forEach((e) => {
          if (e.o && Math.abs(e.o[0][0] - v.x) < 400) poly(e.o, true);
        });
      } catch (e) {
        logErr(e, 'grDraw');
      }
      x.restore();
    }
    if (g.below) {
      const i = L.indexOf(lv),
        lo = L[i - 1];
      if (lo) {
        x.save();
        x.globalAlpha = 0.35;
        x.strokeStyle = ink;
        x.setLineDash([5, 4]);
        x.lineWidth = 1;
        lo.bs.forEach((q) => {
          x.beginPath();
          x.moveTo(...mv(q[0], q[1]));
          x.lineTo(...mv(q[2], q[3]));
          x.stroke();
        });
        x.restore();
      }
    }
    // Einheiten
    const sel = GRS.sel,
      hv = GRS.hover;
    lv.faces.forEach((f, i) => {
      const fa = grFA(f.fa) || grDefFa(lv.use);
      x.beginPath();
      grPoly(x, f);
      x.fillStyle = fa.c;
      x.globalAlpha = 0.92;
      x.fill('evenodd');
      x.globalAlpha = 1;
      if ((sel && sel.k === 'u' && sel.i === i) || (GRS.msel.length > 1 && GRS.msel.includes(i))) {
        x.fillStyle = 'rgba(31,111,209,.28)';
        x.fill('evenodd');
      } else if (hv && hv.k === 'u' && hv.i === i) {
        x.fillStyle = 'rgba(255,255,255,.25)';
        x.fill('evenodd');
      }
    });
    x.lineJoin = 'round';
    x.strokeStyle = '#3a3a3a';
    x.lineWidth = 1.4;
    lv.faces.forEach((f) => {
      x.beginPath();
      grPoly(x, f);
      x.stroke();
    });
    x.lineWidth = 3.2;
    x.strokeStyle = '#1a1a1a';
    if (lv.dg) x.setLineDash([9, 4]);
    lv.bs.forEach((q) => {
      x.beginPath();
      x.moveTo(...mv(q[0], q[1]));
      x.lineTo(...mv(q[2], q[3]));
      x.stroke();
    });
    x.setLineDash([]);
    const cutDraw = (gid, col, w) => {
      x.save();
      x.beginPath();
      lv.faces.forEach((f) => grPoly(x, f));
      x.clip();
      x.strokeStyle = col;
      x.lineWidth = w;
      (lv.obj.cuts || []).forEach((c) => {
        if (c[4] !== gid) return;
        x.beginPath();
        x.moveTo(...mv(c[0], c[1]));
        x.lineTo(...mv(c[2], c[3]));
        x.stroke();
      });
      x.restore();
    };
    if (hv && hv.k === 'c') cutDraw(hv.g, 'rgba(31,111,209,.45)', 5);
    if (sel && sel.k === 'c') cutDraw(sel.g, '#1f6fd1', 4);
    // Griffe der gewählten Schnittgruppe und Vorschau beim Bearbeiten
    if (sel && sel.k === 'c' && GRS.tool === 'sel') {
      const gp = grGrp(lv, sel.g),
        eh = GRS.eh;
      gp.vs.forEach((v) => {
        const [X, Y] = mv(v.p[0], v.p[1]),
          hot = eh && eh.m === 'v' && eh.k === v.k;
        x.fillStyle = hot ? '#1f6fd1' : '#fff';
        x.strokeStyle = '#1f6fd1';
        x.lineWidth = 1.8;
        x.beginPath();
        x.rect(X - 5, Y - 5, 10, 10);
        x.fill();
        x.stroke();
      });
      if (gp.sg.length) {
        const [X, Y] = mv(gp.cen[0], gp.cen[1]);
        x.fillStyle = eh && eh.m === 'a' ? '#1f6fd1' : '#fff';
        x.strokeStyle = '#1f6fd1';
        x.lineWidth = 1.8;
        x.beginPath();
        x.arc(X, Y, 7, 0, 7);
        x.fill();
        x.stroke();
        x.strokeStyle = eh && eh.m === 'a' ? '#fff' : '#1f6fd1';
        x.lineWidth = 1.4;
        x.beginPath();
        x.moveTo(X - 4, Y);
        x.lineTo(X + 4, Y);
        x.moveTo(X, Y - 4);
        x.lineTo(X, Y + 4);
        x.stroke();
      }
    }
    if (GRS.ed && GRS.ed.map) {
      const ed = GRS.ed,
        gp = ed.hd.grp,
        sg = grMapSegs(gp, ed.map);
      x.save();
      x.strokeStyle = '#5E7F92';
      x.lineWidth = 2;
      x.setLineDash([6, 4]);
      sg.forEach((c) => {
        x.beginPath();
        x.moveTo(...mv(c[0], c[1]));
        x.lineTo(...mv(c[2], c[3]));
        x.stroke();
      });
      x.setLineDash([]);
      x.fillStyle = '#5E7F92';
      x.font = '600 12px system-ui';
      x.textAlign = 'center';
      sg.forEach((c) => {
        const L = Math.hypot(c[2] - c[0], c[3] - c[1]);
        if (L * s < 38) return;
        const [X, Y] = mv((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
        x.strokeStyle = 'rgba(255,255,255,.9)';
        x.lineWidth = 3;
        x.strokeText(f1(L, 2) + ' m', X, Y - 8);
        x.fillText(f1(L, 2) + ' m', X, Y - 8);
      });
      if (gp.loop) {
        let A = 0;
        const r = gp.ring.map((q) => ed.map.get(gk(q[0], q[1])) || q);
        for (let i = 0; i < r.length; i++) {
          const q = r[(i + 1) % r.length];
          A += r[i][0] * q[1] - q[0] * r[i][1];
        }
        const cx = r.reduce((t, q) => t + q[0], 0) / r.length,
          cz = r.reduce((t, q) => t + q[1], 0) / r.length,
          [X, Y] = mv(cx, cz);
        x.strokeStyle = 'rgba(255,255,255,.9)';
        x.lineWidth = 3;
        x.strokeText(f1(Math.abs(A / 2), 1) + ' m²', X, Y);
        x.fillText(f1(Math.abs(A / 2), 1) + ' m²', X, Y);
      }
      x.restore();
    }
    // Beschriftung (bleibt immer waagerecht lesbar)
    const fs = g.fs || 12;
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
        if (lines.length > 1 && g.ar) {
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
        [X, Yc] = mv(f.c[0], f.c[1]),
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
    // Maße der Außenkanten (entlang der Kante, aber immer lesbar)
    if (g.dim) {
      x.font = '11px system-ui';
      (lv._dm || (lv._dm = grMergeSegs(lv.bs))).forEach((q) => {
        const len = Math.hypot(q[2] - q[0], q[3] - q[1]);
        if (len * s < 46) return;
        const mx = (q[0] + q[2]) / 2,
          mz = (q[1] + q[3]) / 2,
          nx = (q[3] - q[1]) / len,
          nz = -(q[2] - q[0]) / len,
          out = lv.faces.some((f) => grInFace(f, mx + nx * 0.15, mz + nz * 0.15)) ? -1 : 1;
        const [A1, B1] = mv(q[0], q[1]),
          [A2, B2] = mv(q[2], q[3]),
          [X0, Y0] = mv(mx, mz),
          [X1, Y1] = mv(mx + nx * out, mz + nz * out),
          dl = Math.hypot(X1 - X0, Y1 - Y0) || 1;
        x.save();
        x.translate(X0 + ((X1 - X0) / dl) * 13, Y0 + ((Y1 - Y0) / dl) * 13);
        let a = Math.atan2(B2 - B1, A2 - A1);
        if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
        x.rotate(a);
        x.fillStyle = ink;
        x.globalAlpha = 0.8;
        x.fillText(f1(len, 2) + ' m', 0, 0);
        x.restore();
      });
    }
    // Zeichenvorschau, Fangspuren
    const cur = GRS.cur;
    if (cur) {
      const R_ = ((GRS.W + GRS.H) / s) * 1.6;
      (cur.gd || []).forEach((q) => {
        x.save();
        x.lineWidth = 1.2;
        x.strokeStyle =
          q.k === 'trk' ? '#e08a00' : q.k === 'wal' ? '#5E7F92' : q.k === 'perp' ? '#7b3fc4' : '#0a9ea8';
        x.setLineDash(q.k === 'trk' ? [2, 4] : [10, 5]);
        x.beginPath();
        x.moveTo(...mv(q.ox - Math.cos(q.a) * R_, q.oz - Math.sin(q.a) * R_));
        x.lineTo(...mv(q.ox + Math.cos(q.a) * R_, q.oz + Math.sin(q.a) * R_));
        x.stroke();
        x.setLineDash([]);
        if (q.k === 'trk') {
          const [X, Y] = mv(q.ox, q.oz);
          x.beginPath();
          x.moveTo(X - 4, Y - 4);
          x.lineTo(X + 4, Y + 4);
          x.moveTo(X + 4, Y - 4);
          x.lineTo(X - 4, Y + 4);
          x.stroke();
        }
        if (q.lab) {
          const [X, Y] = mv(cur.x, cur.z);
          x.fillStyle = x.strokeStyle;
          x.font = '11px system-ui';
          x.textAlign = 'left';
          x.fillText(q.lab, X + 12, Y + 16);
        }
        x.restore();
      });
      if (cur.arc) {
        const a = cur.arc,
          [X, Y] = mv(a.c[0], a.c[1]),
          ra = GRS.r;
        let a0 = a.a0 + ra,
          d = a.df;
        x.save();
        x.fillStyle = 'rgba(94,127,146,.18)';
        x.strokeStyle = '#5E7F92';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(X, Y);
        x.arc(X, Y, 30, a0, a0 + d, d < 0);
        x.closePath();
        x.fill();
        x.stroke();
        const am = a0 + d / 2;
        x.fillStyle = '#5E7F92';
        x.font = '600 12px system-ui';
        x.textAlign = 'center';
        x.fillText(a.psi + '°', X + Math.cos(am) * 46, Y + Math.sin(am) * 46);
        x.restore();
      }
    }
    if (GRS.tool === 'line' && GRS.pts.length) {
      x.strokeStyle = '#5E7F92';
      x.lineWidth = 2;
      x.setLineDash([6, 4]);
      x.beginPath();
      GRS.pts.forEach((p, i) => {
        const [X, Y] = mv(p[0], p[1]);
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      });
      if (cur) x.lineTo(...mv(cur.x, cur.z));
      x.stroke();
      x.setLineDash([]);
      if (cur) {
        const l = GRS.pts[GRS.pts.length - 1],
          d = Math.hypot(cur.x - l[0], cur.z - l[1]),
          [X, Y] = mv(cur.x, cur.z);
        x.fillStyle = '#5E7F92';
        x.font = '600 12px system-ui';
        x.textAlign = 'left';
        x.fillText(f1(d, 2) + ' m', X + 12, Y - 10);
      }
    }
    if (GRS.tool === 'rect' && GRS.rect && cur) {
      const R = grRect(GRS.rect.a, { x: cur.x, z: cur.z }, -GRS.r);
      x.strokeStyle = '#5E7F92';
      x.lineWidth = 2;
      x.setLineDash([6, 4]);
      x.beginPath();
      R.forEach((p, i) => {
        const [X, Y] = mv(p[0], p[1]);
        i ? x.lineTo(X, Y) : x.moveTo(X, Y);
      });
      x.closePath();
      x.stroke();
      x.setLineDash([]);
      const u = Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]),
        w = Math.hypot(R[2][0] - R[1][0], R[2][1] - R[1][1]),
        [X, Y] = mv(cur.x, cur.z);
      x.fillStyle = '#5E7F92';
      x.font = '600 12px system-ui';
      x.textAlign = 'left';
      x.fillText(f1(u, 2) + ' × ' + f1(w, 2) + ' m = ' + f1(u * w, 1) + ' m²', X + 12, Y - 10);
    }
    if (cur && (GRS.tool === 'line' || GRS.tool === 'rect' || GRS.ed)) {
      const [X, Y] = mv(cur.x, cur.z);
      x.strokeStyle = cur.t ? '#5E7F92' : '#888';
      x.lineWidth = 1.5;
      x.beginPath();
      if (cur.t === 'p') {
        x.rect(X - 5, Y - 5, 10, 10);
      } else if (cur.t === 'x') {
        x.moveTo(X - 6, Y - 6);
        x.lineTo(X + 6, Y + 6);
        x.moveTo(X + 6, Y - 6);
        x.lineTo(X - 6, Y + 6);
      } else if (cur.t === 'perp') {
        x.rect(X - 5, Y - 5, 10, 10);
        x.moveTo(X - 5, Y);
        x.lineTo(X, Y);
        x.lineTo(X, Y + 5);
      } else if (cur.t === 'e') {
        x.moveTo(X - 6, Y);
        x.lineTo(X, Y - 6);
        x.lineTo(X + 6, Y);
        x.lineTo(X, Y + 6);
        x.closePath();
      } else if (cur.t === 'g') {
        x.arc(X, Y, 4, 0, 7);
      } else {
        x.moveTo(X - 6, Y);
        x.lineTo(X + 6, Y);
        x.moveTo(X, Y - 6);
        x.lineTo(X, Y + 6);
      }
      x.stroke();
    }
    // Nordpfeil (Klick: an der längsten Seite ausrichten / wieder nach Norden), Maßstab, Titel
    x.setLineDash([]);
    const nx_ = W - 38,
      ny_ = 46,
      al = g.al;
    x.save();
    x.globalAlpha = GRS.nh ? 1 : 0.85;
    x.fillStyle = al ? '#5E7F92' : ink;
    x.strokeStyle = ink;
    x.lineWidth = 1.4;
    x.beginPath();
    x.arc(nx_, ny_, 25, 0, 7);
    x.globalAlpha = 0.1;
    x.fill();
    x.globalAlpha = GRS.nh ? 1 : 0.85;
    x.stroke();
    x.translate(nx_, ny_);
    x.rotate(GRS.r);
    x.beginPath();
    x.moveTo(0, -19);
    x.lineTo(-7, 6);
    x.lineTo(0, 1);
    x.lineTo(7, 6);
    x.closePath();
    x.fillStyle = ink;
    x.fill();
    x.restore();
    x.fillStyle = ink;
    x.font = '700 11px system-ui';
    x.textAlign = 'center';
    x.fillText('N', nx_ + Math.sin(GRS.r) * 34, ny_ - Math.cos(GRS.r) * 34);
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100].find((n) => n * s >= 90) || 100,
      sx0 = 18,
      sy0 = H - 24;
    x.fillStyle = ink;
    x.globalAlpha = 0.85;
    x.textAlign = 'left';
    x.fillRect(sx0, sy0, nice * s, 3);
    x.fillRect(sx0, sy0 - 4, 1.5, 8);
    x.fillRect(sx0 + nice * s - 1.5, sy0 - 4, 1.5, 8);
    x.font = '11px system-ui';
    x.fillText(nice + ' m', sx0 + nice * s + 6, sy0 + 4);
    x.font = '600 13px system-ui';
    x.fillText(
      lv.name + ' – Schnitt in ' + f1(+S.gro.sh, 2) + ' m Höhe' + (lv.dg ? ' über Fußboden' : ''),
      18,
      24,
    );
    x.font = '11px system-ui';
    x.globalAlpha = 0.6;
    x.fillText(
      'Maßstab ca. 1 : ' +
        Math.round(3779.5 / s / 10) * 10 +
        ' (bei 96 dpi)' +
        (g.al ? ' · an längster Seite ausgerichtet' : ' · Norden oben'),
      18,
      40,
    );
    x.globalAlpha = 1;
    const inf = gD('grInfo');
    if (inf) inf.textContent = lv.name + ' · ' + lv.faces.length + ' Einheiten · ' + f1(lv.area, 1) + ' m²';
    const ht = gD('grHint');
    if (ht)
      ht.textContent =
        GRS.note && Date.now() < GRS.note.u
          ? GRS.note.t
          : GRS.ed
            ? 'Ziehen – Fang wie beim Zeichnen · Shift = Spur festhalten · Esc = abbrechen'
            : GRS.nh
              ? 'Klick auf den Nordpfeil: Grundriss an der längsten Seite waagerecht ausrichten bzw. wieder nach Norden'
              : GRS.tool === 'line'
                ? 'Klick = Punkt · zurück auf den Startpunkt = Fläche schließen (ersetzt Linien darin) · Enter / Rechtsklick = beenden · Shift = Winkel fest · Esc = abbrechen'
                : GRS.tool === 'rect'
                  ? 'Aufziehen oder zwei Ecken anklicken – ersetzt alle Linien und Einheiten darin durch eine Fläche · Esc = abbrechen'
                  : 'Einheit anklicken (Shift/Strg+Klick = mehrere wählen, zusammenfügen) · Linie/Rechteck gewählt: Griffe ziehen · Zifferntasten 1–9 = Flächenart · ▲▼ / Bild↑↓ = Geschoss wechseln · F = alles zeigen';
  })();
  if (l2on())
    try {
      l2Draw();
    } catch (e) {
      console.warn('LOD200 Plan', e);
    }
  else l2BarHide();
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js (danach)
  try {
    if (!S.mx.ras.draw) return r;
    const b = grB(),
      cv = gD('grCv');
    if (!b || !cv) return r;
    const lv = grLv(b),
      fr = mxFrame(b, lv),
      R = S.mx.ras,
      m = R.mod || 1.25,
      x = cv.getContext('2d'),
      P = (lv.fp || b.fp).map((p) => mxRot(p, fr.th)),
      u0 = Math.min(...P.map((p) => p[0])) - 6,
      u1 = Math.max(...P.map((p) => p[0])) + 6,
      v0 = Math.min(...P.map((p) => p[1])) - 6,
      v1 = Math.max(...P.map((p) => p[1])) + 6,
      ln = (a, c, col, w) => {
        const A = grTf(...mxBack(a, fr.th)),
          B = grTf(...mxBack(c, fr.th));
        x.strokeStyle = col;
        x.lineWidth = w;
        x.beginPath();
        x.moveTo(A[0], A[1]);
        x.lineTo(B[0], B[1]);
        x.stroke();
      },
      px = m * GRS.view.s;
    x.save();
    if (px >= 7) {
      for (let u = fr.r[0] + Math.ceil((u0 - fr.r[0]) / m) * m; u <= u1; u += m)
        ln([u, v0], [u, v1], 'rgba(94,127,146,.18)', 1);
      for (let v = fr.r[1] + Math.ceil((v0 - fr.r[1]) / m) * m; v <= v1; v += m)
        ln([u0, v], [u1, v], 'rgba(94,127,146,.18)', 1);
    }
    if (R.ax > 0) {
      x.font = '11px system-ui';
      x.fillStyle = '#b5651d';
      let i = 0;
      for (let u = fr.r[0]; u <= u1; u += R.ax, i++) {
        if (u < u0) continue;
        ln([u, v0], [u, v1], 'rgba(181,101,29,.55)', 1.2);
        const A = grTf(...mxBack([u, v0], fr.th));
        x.fillText(String(i + 1), A[0] + 3, A[1] - 3);
      }
    }
    const O = grTf(...mxBack(fr.r, fr.th));
    x.fillStyle = '#5E7F92';
    x.beginPath();
    x.arc(O[0], O[1], 4, 0, 7);
    x.fill();
    x.restore();
  } catch (e) {
    logErr(e, 'grDraw');
  }
  return r;
}
// ---- Eingaben
function grRect(a, c, th) {
  const co = Math.cos(th),
    si = Math.sin(th),
    u = (x, z) => x * co + z * si,
    v = (x, z) => -x * si + z * co,
    u1 = u(a.x, a.z),
    v1 = v(a.x, a.z),
    u2 = u(c.x, c.z),
    v2 = v(c.x, c.z),
    w = (uu, vv) => [uu * co - vv * si, uu * si + vv * co];
  return [w(u1, v1), w(u2, v1), w(u2, v2), w(u1, v2)];
}
function grPt(e) {
  const cv = gD('grCv'),
    r = cv.getBoundingClientRect();
  GRS.W = r.width;
  GRS.H = r.height;
  const sx = e.clientX - r.left,
    sy = e.clientY - r.top,
    [x, z] = grInv(sx, sy);
  return { sx, sy, x, z };
}
const grNorthHit = (p) => Math.hypot(p.sx - (GRS.W - 38), p.sy - 46) < 27;
function grHit(wx, wz, lv) {
  const tol = 7 / GRS.view.s;
  for (const c of lv.obj.cuts || []) {
    if (
      grDSeg(wx, wz, c[0], c[1], c[2], c[3]) < tol &&
      lv.faces.some(
        (f) =>
          grInFace(f, wx, wz) ||
          [f.o]
            .concat(f.h)
            .some((r) =>
              r.some(
                (q, i) =>
                  grDSeg(wx, wz, q[0], q[1], r[(i + 1) % r.length][0], r[(i + 1) % r.length][1]) < tol,
              ),
            ),
      )
    )
      return { k: 'c', g: c[4] };
  }
  const i = lv.faces.findIndex((f) => grInFace(f, wx, wz));
  return i >= 0 ? { k: 'u', i } : null;
}
