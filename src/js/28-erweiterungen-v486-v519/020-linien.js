// ---- v490: Linien-Eingabe (Laenge/Winkel), blaue Skizzenlinien, Endpunkt-Aufleuchten, blaue Eckwinkel mit 90°/45°-Symbol
const LNB = 0x1f6fd1,
  LN = { raw: null, last: null, touch: null, ovr: null, n: -1, grp: new T.Group(), spr: [] };
LN.grp.renderOrder = 12;
sc.add(LN.grp);
const lnGlowMat = new T.MeshBasicMaterial({ color: 0xffd23f, depthTest: false });
const lnDotMat = new T.PointsMaterial({
  color: 0xffffff,
  map: spT,
  alphaTest: 0.05,
  size: 9,
  sizeAttenuation: false,
  depthTest: false,
  transparent: true,
});
const lnHaloMat = new T.PointsMaterial({
  color: 0xffd23f,
  map: spT,
  alphaTest: 0.02,
  size: 26,
  sizeAttenuation: false,
  depthTest: false,
  transparent: true,
  opacity: 0.7,
});
const lnOn = () =>
  S.tool === 'f' && S.dm === 'bld' && !S.closed && S.shape === 'free' && S.draft && S.draft.length >= 1;
const lnY = (x, z) => (S.refH != null ? S.refH + 0.15 : gh(x, z) + 1) + 0.06;
function drRot() {
  return S.m3 ? S.rot2 || 0 : V.rot;
}
setInterval(() => {
  try {
    if (!S.m3 && isFinite(V.rotT)) S.rot2 = V.rotT;
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 100);
const lnRotD = () => (drRot() * 180) / Math.PI;
function lnDeg(ref, q) {
  let a = (Math.atan2(-(q[1] - ref[1]), q[0] - ref[0]) * 180) / Math.PI + lnRotD();
  return ((a % 360) + 360) % 360;
}
function lnIn(ref, b) {
  const prev = S.draft.length >= 2 ? S.draft.at(-2) : null;
  if (!prev) return null;
  const vx = prev[0] - ref[0],
    vz = prev[1] - ref[1],
    cx = b[0] - ref[0],
    cz = b[1] - ref[1];
  const s = Math.atan2(vx * cz - vz * cx, vx * cx + vz * cz);
  return { deg: (Math.abs(s) * 180) / Math.PI, side: s < 0 ? -1 : 1, th0: Math.atan2(vz, vx) };
}
function lnShow(ref, b) {
  const i = lnIn(ref, b);
  return i ? i.deg : lnDeg(ref, b);
}
function lnPoint() {
  const ref = S.draft.at(-1),
    b = LN.raw || LN.last;
  if (!ref || !b) return null;
  const o = LN.ovr || {};
  let len = Math.hypot(b[0] - ref[0], b[1] - ref[1]);
  if (o.len > 0) len = o.len;
  const i = lnIn(ref, b);
  if (i) {
    const ang = o.ang != null ? Math.max(0, Math.min(180, o.ang)) : i.deg,
      th = i.th0 + (i.side * ang * Math.PI) / 180;
    return [ref[0] + len * Math.cos(th), ref[1] + len * Math.sin(th)];
  }
  let ang = lnDeg(ref, b);
  if (o.ang != null) ang = o.ang;
  const r = ((ang - lnRotD()) * Math.PI) / 180;
  return [ref[0] + len * Math.cos(r), ref[1] - len * Math.sin(r)];
}
// Box
(function () {
  const m = document.getElementById('mid');
  if (!m) return;
  const d = document.createElement('div');
  d.id = 'lnBox';
  d.className = 'fl';
  d.style.cssText =
    'position:absolute;left:10px;top:46px;padding:8px 10px;display:none;flex-direction:column;gap:4px;width:160px;font-size:12px;z-index:5';
  d.innerHTML =
    '<b style="color:#1f6fd1">Linie – Maße</b><label>Länge (m)<input id="lnL" type="text" inputmode="decimal" autocomplete="off"></label><label>Winkel (°)<input id="lnA" type="text" inputmode="decimal" autocomplete="off"></label><small style="color:var(--mu)">Zahl tippen · Tab = Feld · Enter = Punkt setzen · Winkel = Innenwinkel zur letzten Linie (erste Linie: Richtung, 0° = rechts)</small>';
  m.appendChild(d);
  const num = (v) => {
    v = parseFloat(String(v).replace(',', '.'));
    return isFinite(v) ? v : null;
  };
  // verschiebbar (Kopfzeile ziehen), Position bleibt erhalten
  const hd = d.querySelector('b');
  hd.style.cssText += ';cursor:move;user-select:none;touch-action:none';
  hd.title = 'Ziehen = Fenster verschieben';
  const clamp = (x, y) => {
    const w = m.clientWidth,
      h = m.clientHeight;
    return [Math.max(0, Math.min(w - d.offsetWidth - 4, x)), Math.max(0, Math.min(h - 40, y))];
  };
  const place = (x, y) => {
    [x, y] = clamp(x, y);
    d.style.left = x + 'px';
    d.style.top = y + 'px';
  };
  try {
    const sv = JSON.parse(localStorage.getItem('maad.lnBox') || 'null');
    if (sv && isFinite(sv.x) && isFinite(sv.y)) d.dataset.pos = JSON.stringify(sv);
  } catch (e) {
    logErr(e, 'init>anonym');
  }
  d.applyPos = () => {
    try {
      const sv = d.dataset.pos ? JSON.parse(d.dataset.pos) : null;
      if (sv) place(sv.x, sv.y);
    } catch (e) {
      logErr(e, 'applyPos');
    }
  };
  let dg = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dg = { x: e.clientX, y: e.clientY, l: d.offsetLeft, t: d.offsetTop };
    try {
      hd.setPointerCapture(e.pointerId);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  });
  hd.addEventListener('pointermove', (e) => {
    if (!dg) return;
    e.stopPropagation();
    place(dg.l + e.clientX - dg.x, dg.t + e.clientY - dg.y);
  });
  const end = (e) => {
    if (!dg) return;
    dg = null;
    e.stopPropagation();
    try {
      const pos = { x: d.offsetLeft, y: d.offsetTop };
      d.dataset.pos = JSON.stringify(pos);
      localStorage.setItem('maad.lnBox', JSON.stringify(pos));
    } catch (e) {
      logErr(e, 'end');
    }
  };
  hd.addEventListener('pointerup', end);
  hd.addEventListener('pointercancel', end);

  ['lnL', 'lnA'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      el.dataset.t = '1';
      // nur das geaenderte Feld ueberschreibt; das andere folgt der Maus
      const l = num(document.getElementById('lnL').value),
        a = num(document.getElementById('lnA').value);
      const fl = document.getElementById('lnL').dataset.t === '1',
        fa = document.getElementById('lnA').dataset.t === '1';
      LN.ovr =
        (fl && l > 0) || (fa && a != null)
          ? { len: fl && l > 0 ? l : null, ang: fa && a != null ? a : null }
          : null;
      const q = lnPoint();
      if (q) {
        LN.last = q;
        drawOv(q);
      }
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        lnCommit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        lnReset();
        el.blur();
      }
    });
  });
  // Ziffern ausserhalb des Feldes landen im Laengenfeld
  addEventListener(
    'keydown',
    (e) => {
      try {
        if (!lnOn() || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target || {};
        if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
        if (/^[0-9.,]$/.test(e.key)) {
          const el = document.getElementById('lnL');
          el.focus();
          el.value = '';
          el.dataset.t = '1';
        }
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    },
    true,
  );
})();
function lnReset() {
  LN.ovr = null;
  ['lnL', 'lnA'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.dataset.t = '';
      if ((id === 'lnL' && document.activeElement !== el) || true) el.value = '';
    }
  });
  try {
    drawOv();
  } catch (e) {
    logErr(e, 'lnReset');
  }
}
function lnCommit() {
  if (!lnOn()) return;
  const q = lnPoint(),
    ref = S.draft.at(-1);
  if (!q || Math.hypot(q[0] - ref[0], q[1] - ref[1]) < 0.05) return;
  S.draft.push(q);
  LN.ovr = null;
  LN.raw = null;
  ['lnL', 'lnA'].forEach((id) => {
    const el = document.getElementById(id);
    el.dataset.t = '';
    el.value = '';
  });
  S.info = '';
  drawOv(q);
  const el = document.getElementById('lnL');
  if (el) el.focus();
}
// snap(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
// Zeichnen: Farben, Endpunkte, Winkel
const lnTex = (t) => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const x = c.getContext('2d');
  x.font = 'bold 30px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 7;
  x.strokeStyle = '#fff';
  x.strokeText(t, 64, 26);
  x.fillStyle = '#1f6fd1';
  x.fillText(t, 64, 26);
  const tx = new T.CanvasTexture(c);
  return tx;
};
function lnDraw() {
  try {
    {
      const c = S.tool === 'f' && S.closed && S.draft && S.draft.length > 2;
      if (c && !LN.wasC) document.body.classList.remove('rpShut');
      LN.wasC = c;
    }
    while (LN.grp.children.length) {
      const o = LN.grp.children.pop();
      o.geometry && o.geometry.dispose();
      if (o.material && o.material.map && o.material !== lnDotMat && o.material !== lnHaloMat) {
        o.material.map.dispose();
        o.material.dispose();
      }
    }
    LN.spr = [];
    const drawing = S.tool === 'f' && S.dm === 'bld';
    const col = drawing ? LNB : 0xf08a8a;
    dl.material.color.setHex(col);
    dlH.material.color.setHex(col);
    const box = document.getElementById('lnBox');
    if (box) {
      const on = lnOn();
      const was = box.style.display;
      box.style.display = on ? 'flex' : 'none';
      if (on && was !== 'flex' && box.applyPos) box.applyPos();
      if (!on) {
        LN.ovr = null;
      }
    }
    if (S.draft.length !== LN.n) {
      LN.n = S.draft.length;
      LN.ovr = null;
      ['lnL', 'lnA'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.dataset.t = '';
          if (document.activeElement !== el) el.value = '';
        }
      });
    }
    if (!drawing || !S.draft.length) return;
    const u = mpp(),
      D = S.draft,
      cl = S.closed,
      P0 = D.slice();
    if (
      !cl &&
      LN.last &&
      D.length >= 1 &&
      Math.hypot(LN.last[0] - D.at(-1)[0], LN.last[1] - D.at(-1)[1]) > 0.05
    )
      P0.push(LN.last);
    const n = P0.length;
    if (n < 3 && !cl) return;
    const corners = [];
    for (let i = 1; i < n - 1; i++) corners.push(i);
    if (cl && n >= 3) {
      corners.push(0, n - 1);
    }
    const mat = new T.LineBasicMaterial({ color: LNB, depthTest: false, transparent: true });
    const add = (pts) => {
      const ge = new T.BufferGeometry().setFromPoints(pts);
      const l = new T.Line(ge, mat);
      l.renderOrder = 12;
      l.frustumCulled = false;
      l.raycast = () => {};
      LN.grp.add(l);
    };
    corners.forEach((i) => {
      const O = P0[i],
        A = P0[(i - 1 + n) % n],
        B = P0[(i + 1) % n];
      let d1 = [A[0] - O[0], A[1] - O[1]],
        d2 = [B[0] - O[0], B[1] - O[1]];
      const l1 = Math.hypot(...d1),
        l2 = Math.hypot(...d2);
      if (l1 < 0.2 || l2 < 0.2) return;
      d1 = [d1[0] / l1, d1[1] / l1];
      d2 = [d2[0] / l2, d2[1] / l2];
      let ang = (Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]))) * 180) / Math.PI;
      const r = Math.min(20 * u, l1 * 0.4, l2 * 0.4);
      const y = lnY(O[0], O[1]),
        V3 = (x, z) => new T.Vector3(x, y, z);
      const a1 = Math.atan2(d1[1], d1[0]);
      let da = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]);
      const right = Math.abs(ang - 90) < 0.6,
        half = Math.abs(ang - 45) < 0.6 || Math.abs(ang - 135) < 0.6;
      if (right) {
        const s = r * 0.62;
        add([
          V3(O[0] + d1[0] * s, O[1] + d1[1] * s),
          V3(O[0] + (d1[0] + d2[0]) * s, O[1] + (d1[1] + d2[1]) * s),
          V3(O[0] + d2[0] * s, O[1] + d2[1] * s),
        ]);
      } else {
        const arc = (rr) => {
          const pts = [];
          for (let k = 0; k <= 16; k++) {
            const t = a1 + (da * k) / 16;
            pts.push(V3(O[0] + Math.cos(t) * rr, O[1] + Math.sin(t) * rr));
          }
          add(pts);
        };
        arc(r);
        if (half) arc(r * 0.7);
      }
      const bis = a1 + da / 2,
        lr = r * (right ? 1.5 : 1.8) + 8 * u,
        tx = lnTex(ang.toFixed(ang % 1 < 0.05 || ang % 1 > 0.95 ? 0 : 1) + '°'),
        sp = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
      sp.position.set(O[0] + Math.cos(bis) * lr, y + 0.05, O[1] + Math.sin(bis) * lr);
      sp.renderOrder = 13;
      sp.userData.k = right || half ? 1.2 : 1;
      sp.raycast = () => {};
      LN.grp.add(sp);
      LN.spr.push(sp);
    });
    // Endpunkte: Leuchten bei Kontakt, Punkt am freien Ende
    const T0 = LN.touch;
    if (T0 && !cl) {
      vg.children.forEach((m) => {
        if (Math.hypot(m.position.x - T0[0], m.position.z - T0[1]) < 0.06) {
          m.material = lnGlowMat;
        }
      });
      const ge = new T.BufferGeometry().setFromPoints([new T.Vector3(T0[0], lnY(T0[0], T0[1]) + 0.1, T0[1])]);
      const h = new T.Points(ge, lnHaloMat);
      h.renderOrder = 11;
      h.frustumCulled = false;
      h.raycast = () => {};
      LN.grp.add(h);
    }
    if (!cl && LN.last) {
      const ge = new T.BufferGeometry().setFromPoints([
        new T.Vector3(LN.last[0], lnY(LN.last[0], LN.last[1]) + 0.1, LN.last[1]),
      ]);
      const p = new T.Points(
        ge,
        T0
          ? new T.PointsMaterial({
              color: 0xffd23f,
              map: spT,
              alphaTest: 0.05,
              size: 13,
              sizeAttenuation: false,
              depthTest: false,
              transparent: true,
            })
          : lnDotMat,
      );
      p.renderOrder = 12;
      p.frustumCulled = false;
      p.raycast = () => {};
      LN.grp.add(p);
    }
    lnScale();
  } catch (x) {
    console.warn('lnDraw', x);
  }
}
function lnScale() {
  const u = mpp();
  LN.spr.forEach((sp) => {
    const k = sp.userData.k || 1;
    sp.scale.set(52 * u * k, 19.5 * u * k, 1);
  });
}
// drawOv(): Erweiterung zusammengeführt, siehe 01-modell-3d/030-wandflaechen.js
// placeHc(): Erweiterung zusammengeführt, siehe 01-modell-3d/030-wandflaechen.js
setInterval(() => {
  try {
    if (!lnOn()) return;
    const ref = S.draft.at(-1),
      b = LN.last;
    if (!ref || !b) return;
    const L = document.getElementById('lnL'),
      A = document.getElementById('lnA');
    {
      const lb = A && A.parentNode && A.parentNode.firstChild;
      if (lb && lb.nodeType === 3) {
        const t = S.draft.length >= 2 ? 'Innenwinkel (°)' : 'Richtung (°)';
        if (lb.textContent !== t) lb.textContent = t;
      }
    }
    if (L && document.activeElement !== L && L.dataset.t !== '1')
      L.value = Math.hypot(b[0] - ref[0], b[1] - ref[1]).toFixed(2);
    if (A && document.activeElement !== A && A.dataset.t !== '1') A.value = lnShow(ref, b).toFixed(1);
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 90);
