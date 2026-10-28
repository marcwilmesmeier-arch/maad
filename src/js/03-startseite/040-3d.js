// ---- 3D-Beschriftungen: Karte mit Leitlinie und pulsierendem Punkt, immer zur Kamera lesbar
const LB = { on: true, sel: null, n: 0, rr: 0, el: new Map(), S: null, C: null };
function lbInit() {
  if (LB.C) return;
  const c = document.createElement('div');
  c.id = 'lbl';
  c.innerHTML = '<svg id="lblS" xmlns="http://www.w3.org/2000/svg"></svg>';
  mid.appendChild(c);
  LB.C = c;
  LB.S = c.firstChild;
}
function lbObs() {
  const ob = [],
    vis = (o) => {
      for (let p = o; p; p = p.parent) if (p.visible === false) return false;
      return true;
    };
  if (S.terr) ob.push(S.terr);
  G.buildings.children.forEach((x) => x.children.forEach((y) => ob.push(y)));
  if (GEO.mesh) ob.push(GEO.mesh);
  try {
    G.ex && G.ex.children.forEach((y) => ob.push(y));
  } catch (e) {
    logErr(e, 'lbObs');
  }
  return [...new Set(ob)].filter((o) => o && vis(o));
}
function lbHit(e) {
  ray(e);
  const h = rc.intersectObjects(lbObs(), true)[0];
  return h ? h.point : null;
}
function lbMk(l) {
  lbInit();
  const SV = LB.S,
    ns = 'http://www.w3.org/2000/svg',
    g = document.createElementNS(ns, 'g'),
    ln = document.createElementNS(ns, 'line'),
    r = document.createElementNS(ns, 'circle'),
    d = document.createElementNS(ns, 'circle'),
    ht = document.createElementNS(ns, 'circle');
  r.setAttribute('class', 'r');
  r.setAttribute('r', 5);
  d.setAttribute('class', 'd');
  d.setAttribute('r', 3.6);
  ht.setAttribute('class', 'hit');
  ht.setAttribute('r', 11);
  g.append(ln, r, d, ht);
  SV.appendChild(g);
  const c = document.createElement('div');
  c.className = 'lb';
  c.innerHTML = '<b class="lt"></b><span class="ls"></span><button class="lx" title="Löschen">✕</button>';
  c.querySelector('.lt').textContent = l.t || '';
  c.querySelector('.ls').textContent = l.s || '';
  LB.C.appendChild(c);
  const o = { l, g, ln, r, d, c, w: 0, h: 0 };
  LB.el.set(l.id, o);
  c.querySelector('.lx').onclick = (ev) => {
    ev.stopPropagation();
    lbDel(l.id);
  };
  c.addEventListener('pointerdown', (ev) => {
    if (ev.target.isContentEditable || ev.target.classList.contains('lx')) return;
    ev.preventDefault();
    lbSel(l.id);
    const x0 = ev.clientX,
      y0 = ev.clientY,
      o0 = l.o.slice();
    c.setPointerCapture(ev.pointerId);
    c.style.cursor = 'grabbing';
    const mv = (e) => {
        l.o = [o0[0] + e.clientX - x0, o0[1] + e.clientY - y0];
      },
      up = (e2) => {
        c.removeEventListener('pointermove', mv);
        c.removeEventListener('pointerup', up);
        c.style.cursor = '';
        const tt = ev.target.closest && ev.target.closest('.lt,.ls');
        if (tt && e2 && Math.hypot(e2.clientX - x0, e2.clientY - y0) < 4) {
          c.querySelectorAll('.lt,.ls').forEach((n) => (n.contentEditable = 'true'));
          tt.focus();
          const rg = document.createRange();
          rg.selectNodeContents(tt);
          const sl = getSelection();
          sl.removeAllRanges();
          sl.addRange(rg);
        }
      };
    c.addEventListener('pointermove', mv);
    c.addEventListener('pointerup', up);
  });
  c.addEventListener('dblclick', (ev) => {
    let t = ev.target.closest && ev.target.closest('.lt,.ls');
    if (!t) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      t = el && el.closest && el.closest('.lt,.ls');
    }
    if (t && c.contains(t)) lbEdit(l.id, t);
  });
  const ed = (el, k) =>
    el.addEventListener('blur', () => {
      el.contentEditable = 'false';
      l[k] = el.textContent.trim();
    });
  ed(c.querySelector('.lt'), 't');
  ed(c.querySelector('.ls'), 's');
  for (const k of ['.lt', '.ls'])
    c.querySelector(k).addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        const nx = ev.target.classList.contains('lt') ? c.querySelector('.ls') : null;
        ev.target.blur();
        if (nx) {
          nx.contentEditable = 'true';
          nx.focus();
          const rg = document.createRange();
          rg.selectNodeContents(nx);
          const sl = getSelection();
          sl.removeAllRanges();
          sl.addRange(rg);
        }
      }
      if (ev.key === 'Escape') ev.target.blur();
      ev.stopPropagation();
    });
  ht.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    lbSel(l.id);
    ht.setPointerCapture(ev.pointerId);
    const mv = (e) => {
        const q = lbHit(e);
        if (q) {
          l.x = q.x;
          l.y = q.y;
          l.z = q.z;
        }
      },
      up = () => {
        ht.removeEventListener('pointermove', mv);
        ht.removeEventListener('pointerup', up);
      };
    ht.addEventListener('pointermove', mv);
    ht.addEventListener('pointerup', up);
  });
  return o;
}
function lbEdit(id, el) {
  const o = LB.el.get(id);
  if (!o) return;
  el = el || o.c.querySelector('.lt');
  el.contentEditable = 'true';
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
function lbSel(id) {
  LB.sel = id;
  LB.el.forEach((o, k) => o.c.classList.toggle('sel', k === id));
}
function lbDel(id) {
  const o = LB.el.get(id);
  if (!o) return;
  o.g.remove();
  o.c.remove();
  LB.el.delete(id);
  S.lab = (S.lab || []).filter((x) => x.id !== id);
  if (LB.sel === id) LB.sel = null;
}
function lbClear() {
  LB.el.forEach((o) => {
    o.g.remove();
    o.c.remove();
  });
  LB.el.clear();
  S.lab = [];
  LB.sel = null;
}
function lbRebuild(arr) {
  lbClear();
  S.lab = (arr || []).map((x) => ({ ...x }));
  S.lab.forEach((l) => {
    LB.n = Math.max(LB.n, +String(l.id).replace(/\D/g, '') || 0);
    lbMk(l);
  });
}
function lbClick(e) {
  let q = lbHit(e);
  if (!q) {
    try {
      const g = ground(e);
      if (g) q = { x: g[0], y: typeof gh === 'function' ? gh(g[0], g[1]) : 0, z: g[1] };
    } catch (e) {
      logErr(e, 'lbClick');
    }
  }
  if (!q) {
    try {
      $('hud').textContent = 'Beschriften: keinen Punkt getroffen – auf Gebäude oder Gelände klicken';
    } catch (e) {
      logErr(e, 'lbClick');
    }
    return;
  }
  S.lab = S.lab || [];
  const l = { id: 'l' + ++LB.n, x: q.x, y: q.y, z: q.z, t: 'Beschriftung', s: 'Text eingeben', o: [70, -90] };
  S.lab.push(l);
  lbMk(l);
  lbSel(l.id);
  LB.on = true;
  tool('v');
  setTimeout(() => lbEdit(l.id), 60);
}
function lbVis() {
  LB.on = !LB.on;
  if (LB.C) LB.C.style.display = LB.on ? '' : 'none';
}
function lbUpdate() {
  if (!LB.C) return;
  const vis = LB.on && !(typeof LAY !== 'undefined' && LAY.open) && !HOME.open;
  mid.classList.toggle('lbtool', S.tool === 'L');
  if (!vis || !S.lab || !S.lab.length) {
    return;
  }
  const P = anP(),
    cp = act().position;

  const ids = [...LB.el.keys()];
  LB.el.forEach((o, id) => {
    const l = o.l,
      q = P([l.x, l.y, l.z]);
    if (!q) {
      o.c.style.display = 'none';
      o.g.style.display = 'none';
      return;
    }
    o.c.style.display = '';
    o.g.style.display = '';
    if (!o.w) {
      o.w = o.c.offsetWidth;
      o.h = o.c.offsetHeight;
    }
    const W = mid.clientWidth,
      Hh = mid.clientHeight,
      cx = Math.max(6, Math.min(W - o.w - 6, q[0] + l.o[0])),
      cy = Math.max(6, Math.min(Hh - o.h - 6, q[1] + l.o[1])),
      px = Math.max(cx, Math.min(q[0], cx + o.w)),
      py = Math.max(cy, Math.min(q[1], cy + o.h));
    o.c.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)`;
    o.ln.setAttribute('x1', q[0]);
    o.ln.setAttribute('y1', q[1]);
    o.ln.setAttribute('x2', px);
    o.ln.setAttribute('y2', py);
    for (const e of [o.r, o.d, o.g.lastChild]) {
      e.setAttribute('cx', q[0]);
      e.setAttribute('cy', q[1]);
    }
  });
  if (ids.length) {
    const id = ids[LB.rr++ % ids.length],
      o = LB.el.get(id);
    if (o) {
      const v = new T.Vector3(o.l.x, o.l.y, o.l.z),
        dir = v.clone().sub(cp),
        dist = dir.length();
      dir.normalize();
      rc.set(cp, dir);
      rc.far = dist - 1.5;
      const h = rc.intersectObjects(lbObs(), true);
      rc.far = Infinity;
      const oc = h.length > 0;
      o.c.classList.toggle('occ', oc);
      o.g.style.opacity = oc ? 0.35 : 1;
    }
  }
  LB.el.forEach((o) => {
    const w = o.c.offsetWidth,
      h = o.c.offsetHeight;
    if (w !== o.w || h !== o.h) {
      o.w = w;
      o.h = h;
    }
  });
}
lbHook = lbUpdate;

function homeSetup() {
  S.m3 = true;
  V.tx = V.tz = 0;
  V.d = Math.max(430, Math.min(1000, GEO.size * 1.05));
  V.pol = 0.92;
  HOME.az0 = V.az;
  homeChips();
  homePos();
  $('hHint').innerHTML = 'Logo anklicken, um zu starten';
  $('hFoot').textContent = 'Demokarte · ' + ((GEO.snap && GEO.snap.label) || '');
  if (HOME.want) {
    HOME.want = 0;
    homeZoom();
  }
  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js (danach)
  bootCur(0);
  if (HOME.hmLate) {
    HOME.hmLate = 0;
    setTimeout(() => {
      if (HOME.open && !HOME.hold)
        try {
          hmShow();
        } catch (e) {
          console.warn(e);
        }
    }, 1100);
  }
}
function homeOpen(first) {
  if (S.project && S.project.id) projSave();
  HOME.open = true;
  cloudsInit();
  HOME.st = 0;
  HOME.sub = 'main';
  HOME.tl = 0;
  HOME.cd = 0;
  S.vact = null;
  S.sel = null;
  S.vanim = null;
  if (HOME.hl) {
    sc.remove(HOME.hl);
    HOME.hl = null;
  }
  document.body.classList.add('home');
  $('home').classList.remove('z');
  $('home').style.display = 'block';
  if (first) {
    HOME.hmLate = 1;
    bootCur(1);
  } else
    try {
      hmShow();
    } catch (e) {
      console.warn(e);
    }
  if (!HOME.logoSet) {
    $('hLogoSvg').innerHTML = $('logo').innerHTML;
    HOME.logoSet = 1;
  }
  const cont =
    S.project && S.project.id
      ? `<button class="hback" onclick="homeResume()" style="margin-top:14px;font-size:13px">↩ „${esc(S.project.name)}“ fortsetzen</button>`
      : '';
  $('hResume').innerHTML = cont;
  HOME.saved = { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot, m3: S.m3 };
  if (first) {
    $('hHint').innerHTML = '<i></i>Karte wird geladen …';
    HOME.ready = false;
    demoBytes()
      .then((u) => {
        if (u) return demoLoad(u, true);
        homeClose();
        wzOpen();
      })
      .catch((e) => {
        console.error(e);
        homeClose();
        wzOpen();
      });
  } else {
    HOME.ready = true;
    homeSetup();
    $('hHint').innerHTML = 'Logo anklicken, um zu starten';
    const f = { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot };
    S.vanim = {
      f,
      t: { tx: 0, tz: 0, d: Math.max(430, Math.min(1000, GEO.size * 1.05)), az: V.az, pol: 0.92, rot: V.rot },
      t0: performance.now(),
      dur: 1800,
    };
  }
  // ── Erweiterung aus 17-erweiterungen-v253-v280/130-startseite.js (danach)
  try {
    homePreset();
  } catch (e) {
    console.error(e);
  }
}
function homeClose() {
  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js
  const shut = !HOME.resuming;
  if (shut) {
    RPG.until = Date.now() + 2000;
    document.body.classList.add('rpShut', 'rpNoAnim');
  }
  try {
    hmHide();
  } catch (e) {
    logErr(e, 'homeClose');
  }
  homeFlashStop();
  homeXStop(1);
  HOME.open = false;
  document.body.classList.remove('home');
  $('home').style.display = 'none';
  if (HOME.hl) {
    sc.remove(HOME.hl);
    HOME.hl = null;
  }
  S.vanim = null;
  setMode(1, 1);
  $('b3').classList.add('on');
  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js (danach)
  if (!HOME.hold) bootCur(0);

  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js (danach)
  if (shut) {
    try {
      if (S.zo && S.zo.m !== 'b') zoMode('b');
    } catch (e) {
      console.warn(e);
    }
    document.body.classList.add('rpShut');
    setTimeout(() => document.body.classList.remove('rpNoAnim'), 2100);
  }
}
function homeResume() {
  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js
  HOME.resuming = 1;
  try {
    return (() => {
      const s = HOME.saved;
      homeClose();
      if (s) {
        Object.assign(V, { tx: s.tx, tz: s.tz, d: s.d, az: s.az, pol: s.pol, rot: s.rot, rotT: s.rot });
        setMode(s.m3 ? 1 : 0, 1);
      }
      rr();
    })();
  } finally {
    HOME.resuming = 0;
  }
}
function homePar() {
  // ── Erweiterung aus 29-start/010-start-projekt-oeffnen.js
  /* Startmenü-Zoom: ist ein Grundstück gewählt, wird darauf gezoomt (statt auf das Grundstück nahe der Kartenmitte) */
  try {
    const p = S.par;
    if (p && p.poly && p.poly.length > 2) return { a: p, c: cen(p.poly), ar: area(p.poly), poly: p.poly };
  } catch (e) {
    console.warn(e);
  }
  let best = null,
    bd = 1e9;
  for (const a of AL) {
    if (a.cut || !a.poly || a.poly.length < 3) continue;
    const c = cen(a.poly),
      ar = area(a.poly);
    if (ar < 250 || ar > 4500) continue;
    const d = Math.hypot(c[0], c[1]);
    if (d < bd) {
      bd = d;
      best = { a, c, ar, poly: a.poly };
    }
  }
  return (
    best || {
      a: null,
      c: [0, 0],
      ar: 1600,
      poly: [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
    }
  );
}
function homeZoom() {
  if (HOME.st || !HOME.open) return;
  if (!HOME.ready) {
    HOME.want = 1;
    return;
  }
  HOME.st = 1;
  homeFlashStop();
  homeXStop(1);
  HOME.par = homePar();
  const p = HOME.par;
  $('home').classList.add('z');
  if (HOME.hl) {
    sc.remove(HOME.hl);
  }
  const g = new T.Group(),
    pts = p.poly.map((q) => new T.Vector3(q[0], gh(q[0], q[1]) + 0.7, q[1])),
    ln = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(pts),
      new T.LineBasicMaterial({ color: 0x5e7f92, transparent: true, depthTest: false }),
    );
  ln.renderOrder = 20;
  ln.raycast = () => {};
  let tri = [];
  try {
    tri = T.ShapeUtils.triangulateShape(
      p.poly.map((q) => new T.Vector2(q[0], q[1])),
      [],
    );
  } catch (e) {
    logErr(e, 'homeZoom');
  }
  const pa = [];
  for (const [a, b, c] of tri)
    for (const i of [a, b, c]) {
      const q = p.poly[i];
      pa.push(q[0], gh(q[0], q[1]) + 0.6, q[1]);
    }
  const ge = new T.BufferGeometry();
  ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pa), 3));
  const fm = new T.Mesh(
    ge,
    new T.MeshBasicMaterial({
      color: 0x5e7f92,
      transparent: true,
      opacity: 0.3,
      side: T.DoubleSide,
      depthTest: true,
      depthWrite: false,
    }),
  );
  fm.renderOrder = 19;
  fm.raycast = () => {};
  g.add(ln, fm);
  sc.add(g);
  HOME.hl = g;
  const d = Math.max(110, Math.min(230, Math.sqrt(p.ar) * 3.2));
  const canShow = !(S.project && S.project.id) && !HOME.db && typeof HOME_PLAN !== 'undefined',
    DUR = canShow ? 7600 : 2600;
  let ox = 0,
    oz = 0;
  if (innerWidth > 820) {
    const a0 = V.az,
      p0 = V.pol;
    try {
      V.az = a0 + 1.3;
      V.pol = 1.0;
      cam();
      const k = act();
      k.updateMatrixWorld();
      const e = k.matrixWorld.elements,
        w = 2 * d * Math.tan(((k.fov || 45) * Math.PI) / 360) * (innerWidth / innerHeight);
      ox = e[0] * w * 0.17;
      oz = e[2] * w * 0.17;
    } catch (e) {
      logErr(e, 'homeZoom');
    }
    V.az = a0;
    V.pol = p0;
    cam();
  }
  S.vanim = {
    f: { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol, rot: V.rot },
    t: { tx: p.c[0] + ox, tz: p.c[1] + oz, d, az: V.az + 1.3, pol: 1.0, rot: V.rot },
    t0: performance.now(),
    dur: DUR,
  };
  HOME.az0 = V.az + 1.3;
  homePanel('main');
  if (canShow) {
    HOME.t0e = 2400;
    homeDemo(p, DUR);
  }
}
