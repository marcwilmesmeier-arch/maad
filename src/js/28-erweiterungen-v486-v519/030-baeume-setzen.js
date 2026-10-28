/* v479 Bäume setzen: eigenes Menü neben Fläche/Gebäude/Straße. Höhe (gesamt), Kronendurchmesser, Stammhöhe, Stammdurchmesser einstellbar.
   Die Bäume sind dieselben wie bisher (GEO.trees, Krone als Ellipsoid, im Modus Realistisch mit denselben Effekten); eigene Bäume tragen u:1, sh, sd und bekommen einen Stamm. */
const TRE = { on: false, h: 12, kd: 7, sh: 3, sd: 0.4, ghost: null, down: null };
const UT = [];
function trCol(k) {
  try {
    const c = new T.Color(S.lc.trees || '#6fae45');
    if (k) c.multiplyScalar(k);
    return '#' + c.getHexString();
  } catch (_) {
    return k ? '#4d8a2f' : '#6fae45';
  }
}
function trSvg() {
  const H = TRE.h,
    K = TRE.kd,
    sh = Math.min(TRE.sh, H - 0.5),
    ch = Math.max(0.5, H - sh),
    W = 96,
    Hh = 118,
    pad = 8,
    k = Math.min((Hh - 2 * pad) / H, (W - 2 * pad - 14) / Math.max(K, TRE.sd)),
    cx = W / 2 - 4,
    gy = Hh - pad,
    cw = K * k,
    chh = ch * k,
    shh = sh * k,
    sw = Math.max(2, TRE.sd * k);
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" style="flex:none;background:linear-gradient(#eef5fb,#fff);border-radius:10px;border:1px solid var(--ln,#ddd)"><line x1="4" y1="${gy}" x2="${W - 4}" y2="${gy}" stroke="#9a8a6a" stroke-width="1.5"/><rect x="${cx - sw / 2}" y="${gy - shh - 2}" width="${sw}" height="${shh + 2}" rx="1" fill="${S.lc.stem || '#7a6742'}"/><ellipse cx="${cx}" cy="${gy - shh - chh / 2}" rx="${cw / 2}" ry="${chh / 2}" fill="${trCol()}" fill-opacity=".92" stroke="${trCol(0.72)}" stroke-width="1"/><ellipse cx="${cx - cw * 0.14}" cy="${gy - shh - chh * 0.62}" rx="${cw * 0.22}" ry="${chh * 0.16}" fill="#fff" fill-opacity=".22"/><line x1="${W - 8}" y1="${gy}" x2="${W - 8}" y2="${gy - shh - chh}" stroke="#555" stroke-width=".8"/><text x="${W - 11}" y="${gy - (shh + chh) / 2}" font-size="8" fill="#555" text-anchor="middle" transform="rotate(-90 ${W - 11} ${gy - (shh + chh) / 2})">${H.toFixed(1)} m</text></svg>`;
}
function trPanel() {
  let p = $('trPanel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'trPanel';
  p.style.cssText =
    'position:fixed;z-index:55;top:84px;left:50%;transform:translateX(-50%);display:none;padding:8px 10px;border-radius:14px;background:var(--pn);border:1px solid var(--gb);box-shadow:var(--sh);font-size:12px;width:292px';
  const f = (id, l, v, st, mn, mx) =>
    '<label style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin:2px 0;font-size:11px">' +
    l +
    '<input id="' +
    id +
    '" type="number" step="' +
    st +
    '" min="' +
    mn +
    '" max="' +
    mx +
    '" value="' +
    v +
    '" style="width:60px;padding:2px 4px" oninput="trSet()"></label>';
  p.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center"><b>Bäume setzen</b><button class="sm" onclick="trToggle(false)">Fertig</button></div><div style="display:flex;gap:10px;margin-top:6px"><div id="trImg">' +
    trSvg() +
    '</div><div style="flex:1">' +
    f('tr_h', 'Höhe (m)', TRE.h, 0.5, 2, 60) +
    f('tr_kd', 'Krone Ø (m)', TRE.kd, 0.5, 1, 40) +
    f('tr_sh', 'Stammhöhe (m)', TRE.sh, 0.25, 0, 30) +
    f('tr_sd', 'Stamm Ø (m)', TRE.sd, 0.05, 0.05, 3) +
    '<label style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin:2px 0;font-size:11px">Stammfarbe<input id="tr_stem" type="color" value="' +
    (S.lc.stem || '#7a6742') +
    '" style="width:60px;height:22px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer" oninput="lcol(\'stem\',this.value)"></label></div></div>' +
    '<div style="color:var(--mu);margin-top:6px;font-size:11px;line-height:1.3">Klick ins Gelände setzt einen Baum. Gesetzte Bäume: anklicken, Entf löscht. In „Realistisch“ mit Laubschalen, sonst als einfacher Kugelbaum.</div>';
  document.body.appendChild(p);
  return p;
}
function trSet() {
  const g = (i) => parseFloat(String(($(i) || {}).value).replace(',', '.'));
  const h = g('tr_h'),
    kd = g('tr_kd'),
    sh = g('tr_sh'),
    sd = g('tr_sd');
  if (isFinite(h)) TRE.h = Math.max(2, Math.min(60, h));
  if (isFinite(kd)) TRE.kd = Math.max(1, Math.min(40, kd));
  if (isFinite(sh)) TRE.sh = Math.max(0, Math.min(30, sh));
  if (isFinite(sd)) TRE.sd = Math.max(0.05, Math.min(3, sd));
  if (TRE.sh > TRE.h - 0.5) TRE.sh = Math.max(0, TRE.h - 0.5);
  const im = $('trImg');
  if (im) im.innerHTML = trSvg();
  trGhost();
}
function trToggle(on) {
  TRE.on = on == null ? !TRE.on : !!on;
  trPanel().style.display = TRE.on ? 'block' : 'none';
  const b = $('mT');
  if (b) b.classList.toggle('on', TRE.on);
  if (TRE.on) {
    try {
      cancel();
      tool('v');
      SK.used = false;
      TRE.on = true;
      S.dm = 'bld';
    } catch (e) {
      logErr(e, 'trToggle');
    }
    try {
      const im = $('trImg');
      if (im) im.innerHTML = trSvg();
    } catch (e) {
      logErr(e, 'trToggle');
    }
    try {
      $('hud').textContent = 'Bäume setzen · Werte im Fenster einstellen, ins Gelände klicken';
    } catch (e) {
      logErr(e, 'trToggle');
    }
    trPanel().style.display = 'block';
    if (b) b.classList.add('on');
  } else trGhost(true);
  rr();
}
function trGhost(off) {
  if (TRE.ghost) {
    sc.remove(TRE.ghost);
    TRE.ghost.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose && o.material.dispose();
    });
    TRE.ghost = null;
  }
  if (off || !TRE.on || !TRE.at) return;
  const g = new T.Group(),
    ch = Math.max(0.5, TRE.h - TRE.sh),
    y = gh(TRE.at[0], TRE.at[1]);
  const cr = new T.Mesh(
    new T.SphereGeometry(1, 24, 16),
    new T.MeshLambertMaterial({
      color: new T.Color(S.lc.trees || '#6fae45'),
      transparent: true,
      opacity: 0.82,
    }),
  );
  cr.scale.set(TRE.kd / 2, ch / 2, TRE.kd / 2);
  cr.position.set(0, TRE.sh + ch / 2, 0);
  const st = new T.Mesh(
    new T.CylinderGeometry(0.5, 0.62, 1, 10),
    new T.MeshLambertMaterial({
      color: new T.Color(S.lc.stem || '#7a6742'),
      transparent: true,
      opacity: 0.9,
    }),
  );
  st.scale.set(TRE.sd, Math.max(0.1, TRE.sh + 0.45), TRE.sd);
  st.position.set(0, (TRE.sh + 0.45) / 2 - 0.25, 0);
  g.add(cr, st);
  g.position.set(TRE.at[0], y, TRE.at[1]);
  g.traverse((o) => {
    o.raycast = () => {};
  });
  sc.add(g);
  TRE.ghost = g;
}
function trPlace(p) {
  try {
    const L = LY.find((l) => l[1] === 'trees');
    if (L) {
      L[2] = 1;
      if (!L[3]) L[3] = 1;
    }
    G.trees.visible = true;
  } catch (e) {
    logErr(e, 'trPlace');
  }
  const t = {
    x: p[0],
    z: p[1],
    h: TRE.h,
    r: TRE.kd / 2,
    sp: 'Eigener Baum',
    src: 'user',
    u: 1,
    sh: TRE.sh,
    sd: TRE.sd,
  };
  UT.push(t);
  trRebuild();
  try {
    rr();
  } catch (e) {
    logErr(e, 'trPlace');
  }
}
function trRebuild() {
  treesBuild((GEO.trees || []).filter((t) => !t.u));
}
// Aufbau: eigene Bäume immer ergänzen, Krone nach oben schieben, Stamm einsetzen
{
  const _tb = treesBuild;
  treesBuild = function (list) {
    const all = (list || []).filter((t) => !t.u).concat(UT);
    const r = _tb.call(this, all);
    try {
      if (UT.length && GEO.tmesh) {
        const tm = GEO.tmesh,
          M = new T.Matrix4(),
          Z = new T.Matrix4().makeScale(0, 0, 0),
          idx = [];
        GEO.trees.forEach((t, i) => {
          if (!t.u) return;
          idx.push(i);
          const y = gh(t.x, t.z),
            sh = Math.min(t.sh, t.h - 0.5),
            ch = Math.max(0.5, t.h - sh),
            cr = Math.max(0.5, t.r);
          M.makeScale(cr, ch / 2, cr).setPosition(t.x, y + sh + ch / 2, t.z);
          tm.setMatrixAt(i, M);
        });
        tm.instanceMatrix.needsUpdate = true;
        tm.frustumCulled = false;
        G.trees.children.forEach((c) => {
          if (
            c.isInstancedMesh &&
            c !== tm &&
            c.geometry &&
            c.geometry.type === 'CylinderGeometry' &&
            c.count === GEO.trees.length
          ) {
            idx.forEach((i) => c.setMatrixAt(i, Z));
            c.instanceMatrix.needsUpdate = true;
          }
        });
        const st = new T.InstancedMesh(
          new T.CylinderGeometry(0.5, 0.62, 1, 10).translate(0, 0.5, 0),
          new T.MeshLambertMaterial({ color: new T.Color(S.lc.stem || '#7a6742') }),
          idx.length,
        );
        idx.forEach((i, k) => {
          const t = GEO.trees[i],
            y = gh(t.x, t.z);
          M.makeScale(t.sd, Math.max(0.1, Math.min(t.sh, t.h - 0.5) + 0.45), t.sd).setPosition(
            t.x,
            y - 0.25,
            t.z,
          );
          st.setMatrixAt(k, M);
        });
        st.instanceMatrix.needsUpdate = true;
        st.castShadow = st.receiveShadow = true;
        st.raycast = () => {};
        st.frustumCulled = false;
        G.trees.add(st);
      }
    } catch (x) {
      console.warn('trees user', x);
    }
    return r;
  };
}
{
  const _td = treeDel;
  treeDel = function () {
    const t = GEO.tsel;
    if (t && t.u) {
      const i = UT.indexOf(t);
      if (i >= 0) UT.splice(i, 1);
    }
    return _td.apply(this, arguments);
  };
}
{
  const _ti = treeInfo;
  treeInfo = function () {
    let h = _ti.apply(this, arguments);
    const t = GEO.tsel;
    if (t && t.u) {
      h = h.replace(/Kronenmodell DOM1−DGM1/, 'Eigener Baum');
      h = h.replace(
        '<button class="sm"',
        kv('Stammhöhe', f1(t.sh, 1) + ' m') +
          kv('Stammdurchmesser', f1(t.sd, 2) + ' m') +
          '<button class="sm"',
      );
    }
    return h;
  };
}
// Platzieren per Klick
addEventListener(
  'pointerdown',
  (e) => {
    if (TRE.on && e.target === cv && e.button === 0) TRE.down = { x: e.clientX, y: e.clientY };
  },
  true,
);
addEventListener(
  'pointerup',
  (e) => {
    try {
      if (!TRE.on || e.target !== cv || e.button !== 0 || !TRE.down) return;
      const d = TRE.down;
      TRE.down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      const g = ground(e);
      if (!g) return;
      const q = snap(g, e, null, []).p;
      trPlace(q);
      e.stopImmediatePropagation();
      try {
        dr = null;
      } catch (e) {
        logErr(e, 'init>anonym');
      }
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch (e) {
        logErr(e, 'init>anonym');
      }
      try {
        TRE.down = null;
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    } catch (x) {
      console.warn('trPlace', x);
    }
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (!TRE.on || e.target !== cv) return;
      const g = ground(e);
      if (!g) return;
      TRE.at = snap(g, e, null, []).p;
      trGhost();
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
{
  const _g = trGhost;
  trGhost = function (off) {
    const sg = [TRE.h, TRE.kd, TRE.sh, TRE.sd, S.lc.trees].join('|');
    if (!off && TRE.on && TRE.at && TRE.ghost && TRE.gsig === sg) {
      const y = gh(TRE.at[0], TRE.at[1]);
      TRE.ghost.position.set(TRE.at[0], y, TRE.at[1]);
      return;
    }
    const r = _g.apply(this, arguments);
    TRE.gsig = TRE.ghost ? sg : null;
    return r;
  };
}
addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && TRE.on) {
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      trToggle(false);
      e.stopImmediatePropagation();
    }
  },
  true,
);
{
  const _t = tool;
  tool = function (t) {
    if (TRE.on && t !== 'v' && !TRE._s) {
      TRE.on = false;
      trPanel().style.display = 'none';
      const b = $('mT');
      if (b) b.classList.remove('on');
      trGhost(true);
    }
    return _t.apply(this, arguments);
  };
}
// Menüknopf
(function () {
  const s = $('mS');
  if (!s || $('mT')) return;
  s.parentNode.insertAdjacentHTML(
    'afterend',
    '<div class="tg"><button class="tb tmain" id="mT" onclick="trToggle()" title="Bäume setzen – Höhe, Kronendurchmesser, Stammhöhe und Stammdurchmesser einstellbar"><i><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M12 15v6M9 21h6"/></svg></i>Bäume</button></div>',
  );
})();
// Speichern / Laden
{
  const _x = projExtra;
  projExtra = function () {
    const x = _x.apply(this, arguments);
    try {
      if (UT.length) x.utr = UT.map((t) => ({ x: t.x, z: t.z, h: t.h, r: t.r, sh: t.sh, sd: t.sd }));
    } catch (e) {
      logErr(e, 'projExtra');
    }
    return x;
  };
}
{
  const _a = projApplyPre;
  projApplyPre = function (x) {
    const r = _a.apply(this, arguments);
    try {
      const had = UT.length;
      UT.length = 0;
      ((x && x.utr) || []).forEach((t) =>
        UT.push({
          x: t.x,
          z: t.z,
          h: t.h,
          r: t.r,
          sp: 'Eigener Baum',
          src: 'user',
          u: 1,
          sh: t.sh,
          sd: t.sd,
        }),
      );
      if (had || UT.length) trRebuild();
    } catch (e) {
      logErr(e, 'projApplyPre');
    }
    return r;
  };
}
{
  const _b = baDo;
  baDo = function (k) {
    if (TRE.on) trToggle(false);
    return _b.apply(this, arguments);
  };
}
// Gebäude kopieren/verschieben/ändern löscht keine Bäume mehr (kein Abgleich zwischen den Geometrien)
function treePruneB() {}
// Eigene Flächen: Klick in die Fläche oder auf den Rand wählt sie (neueste, kleinste zuerst)
function areaPickAt(g) {
  const tol = 6 * mpp();
  let best = null,
    ba = 1e18;
  for (const a of S.areas || []) {
    const P_ = a.poly;
    if (!P_ || P_.length < 3) continue;
    const hit = inP(g, P_) || szDist(g, P_) < tol;
    if (!hit) continue;
    const ar = area(P_);
    if (ar <= ba) {
      ba = ar;
      best = a;
    }
  }
  return best;
}
