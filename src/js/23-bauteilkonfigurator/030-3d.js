// ---- 3D-Vorschau (eigene kleine Szene)
function l2cPvStop() {
  if (L2C.pv && L2C.pv.raf) {
    cancelAnimationFrame(L2C.pv.raf);
    L2C.pv.raf = 0;
  }
}
function l2cPv(c) {
  const cv = document.getElementById('l2cCv');
  if (!cv) return;
  const T_ = L2T.find((t) => L2CLS(t.grp) === L2CLS(c.e.kind) && t.id === c.e.T.id) || c.e.T;
  let P = L2C.pv;
  if (!P || P.cv !== cv) {
    l2cPvStop();
    const w = cv.clientWidth || 360,
      h = cv.clientHeight || 200,
      r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    r.setSize(w, h, false);
    r.shadowMap.enabled = true;
    r.setClearColor(0, 0);
    const sc = new T.Scene(),
      cam = new T.PerspectiveCamera(30, w / h, 0.1, 50);
    cam.position.set(2.5, 1.5, 2.9);
    cam.lookAt(0, 0.4, 0);
    sc.add(new T.HemisphereLight(0xffffff, 0xb9b4a6, 0.75));
    const dl = new T.DirectionalLight(0xffffff, 0.8);
    dl.position.set(2.5, 4, 2);
    dl.castShadow = true;
    dl.shadow.mapSize.set(1024, 1024);
    Object.assign(dl.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 10 });
    sc.add(dl);
    const fl = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: 0.22 }));
    fl.rotation.x = -Math.PI / 2;
    fl.receiveShadow = true;
    sc.add(fl);
    P = L2C.pv = { cv, r, sc, cam, g: null, id: '', ry: 0.6, drag: null, raf: 0 };
    cv.onpointerdown = (ev) => {
      P.drag = ev.clientX;
      cv.setPointerCapture(ev.pointerId);
      cv.style.cursor = 'grabbing';
    };
    cv.onpointermove = (ev) => {
      if (P.drag != null) {
        P.ry += (ev.clientX - P.drag) * 0.01;
        P.drag = ev.clientX;
      }
    };
    cv.onpointerup = () => {
      P.drag = null;
      cv.style.cursor = 'grab';
    };
  }
  const sig = T_.id + '|' + c.e.kind + '|' + JSON.stringify(T_.layers.map((l) => l.d));
  if (P.id !== sig) {
    P.id = sig;
    if (P.g) {
      P.sc.remove(P.g);
      P.g.traverse((o) => {
        o.geometry && o.geometry.dispose();
        o.material && o.material.dispose();
      });
    }
    const g = new T.Group(),
      Ls = T_.layers,
      k = c.e.kind,
      cat = L2CAT[k],
      X = cat === 'W' ? 2.6 : 2.2,
      box = (w, h, d, col, x, y, z) => {
        const m = new T.Mesh(
          new T.BoxGeometry(w, h, d),
          new T.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0 }),
        );
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        const ed = new T.LineSegments(
          new T.EdgesGeometry(m.geometry),
          new T.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
        );
        m.add(ed);
        g.add(m);
      };
    const tot = Ls.reduce((s, l) => s + l.d, 0) * X;
    if (cat === 'W') {
      let x = -tot / 2;
      const n = Ls.length;
      Ls.forEach((l, i) => {
        const w = l.d * X,
          H = 1.0 - i * 0.07;
        box(w, H, 1.6, l2cCol(l.n), x + w / 2, H / 2, 0);
        x += w;
      });
    } else {
      const n = Ls.length;
      let y = 0;
      const tt = tot;
      for (let i = n - 1; i >= 0; i--) {
        const l = Ls[i],
          hh = l.d * X,
          s = 1 - (n - 1 - i) * 0.1;
        box(1.9 * s * (k === 'RD' ? 1 : 1), hh, 1.3 * s, l2cCol(l.n), 0, y + hh / 2, 0);
        y += hh;
      }
      if (k === 'RD') {
        g.rotation.z =
          -((Math.min(40, Math.max(12, +(c.b.roof && c.b.roof.angle) || 30)) * Math.PI) / 180) * 0.6;
      }
    }
    g.position.y = cat === 'W' ? 0 : 0.3;
    P.g = g;
    P.sc.add(g);
  }
  if (!P.raf) {
    const loop = () => {
      if (!document.getElementById('l2cCv') || P.cv !== document.getElementById('l2cCv')) {
        P.raf = 0;
        return;
      }
      if (P.drag == null) P.ry += 0.004;
      if (P.g) P.g.rotation.y = P.ry;
      P.r.render(P.sc, P.cam);
      P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }
}
// ---- Auswahl: Grundriss (Abfrage), Fassade (Schaltfläche). Die Wandauswahl per Klick im 3D-Modell ist seit v396 abgeschaltet (nur noch im Grundrisstool).
setInterval(() => {
  try {
    if (!l2on()) {
      if (L2C.open) L2CF.close();
      return;
    }
    const T_ = l2Target(),
      id = T_ ? T_.el.id : '';
    if (id !== L2C.last) {
      L2C.last = id;
      if (T_) l2cOpen(T_.el, T_.b);
    }
    if (L2C.open) {
      const c = l2cEl();
      if (!c) {
        L2CF.close();
      } else if (c.e.T.id !== L2C.tid) {
        L2C.W = Object.assign({}, l2Attr(c.e.T));
        l2cRender();
      }
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 200);
{
  const cv = ren.domElement;
  cv.addEventListener(
    'pointerdown',
    (e) => {
      L2C.pd = [e.clientX, e.clientY];
    },
    true,
  );
  cv.addEventListener(
    'pointerup',
    (e) => {
      try {
        const p = L2C.pd;
        L2C.pd = null;
        if (true || !p || !l2on() || e.button !== 0 || e.altKey || S.tool !== 'v' || S.fd || !G.l2.visible)
          return;
        if (Math.hypot(e.clientX - p[0], e.clientY - p[1]) > 5) return;
        ray(e);
        let best = null;
        L2I.forEach((it) => {
          if (!it.g.visible) return;
          it.g.traverse((o) => {
            if (!o.isMesh) return;
            const hh = [];
            T.Mesh.prototype.raycast.call(o, rc, hh);
            hh.forEach((h) => {
              if (!best || h.distance < best.d) best = { d: h.distance, it };
            });
          });
        });
        if (!best) return;
        const el = best.it.el,
          b = S.bld.find((x) => x.id === el.bid);
        if (!b) return;
        S.l2.sel = el.id;
        L2AN || l2Run();
        L2C.last = el.id;
        l2cOpen(el, b);
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    },
    true,
  );
}

// ---- Schnittebene in LOD 300 (damit die Schichten sichtbar werden)
const L2CUT = { m: 'off', v: 0.5, f: 1, init: 0, open: 0 };
function l2CutBox() {
  const bx = new T.Box3(),
    sel = S.sel && S.bld.includes(S.sel) ? S.sel.id : null;
  let any = false;
  L2I.forEach((it) => {
    if (sel && it.el.bid !== sel) return;
    const q = new T.Box3().setFromObject(it.g);
    if (!q.isEmpty()) {
      bx.union(q);
      any = true;
    }
  });
  return any ? bx : null;
}
function l2CutApply() {
  // ── Erweiterung aus 23-bauteilkonfigurator/050-shader.js
  // Schnitt-Zustand auf Rückseiten-Meshes übertragen (nur bei aktivem Schnitt sichtbar; Vorderseiten dann einseitig)
  const r = (() => {
    const P = L2CLIP;
    if (!l23() || L2CUT.m === 'off') {
      P.normal.set(0, -1, 0);
      P.constant = 1e5;
      return;
    }
    const bx = l2CutBox();
    if (!bx) {
      P.normal.set(0, -1, 0);
      P.constant = 1e5;
      return;
    }
    const ax = L2CUT.m === 'x' ? 0 : L2CUT.m === 'z' ? 2 : 1,
      mn = bx.min.getComponent(ax),
      mx = bx.max.getComponent(ax),
      val = mn + (mx - mn) * L2CUT.v,
      n = [0, 0, 0];
    n[ax] = -L2CUT.f;
    P.normal.set(n[0], n[1], n[2]);
    P.constant = L2CUT.f * val;
  })();
  try {
    const on = l23() && L2CUT.m !== 'off';
    L2CU.c.value = L2CLIP.constant;
    L2CU.ax.value = L2CUT.m === 'x' ? 0 : L2CUT.m === 'z' ? 2 : 1;
    for (const it of L2I.values())
      it.g.traverse((o) => {
        if (o.userData && o.userData.cutB) o.visible = on;
        else if (
          o.isMesh &&
          o.material &&
          o.userData.ly != null &&
          o.material.userData &&
          o.material.userData.ln != null
        ) {
          const sd = on ? T.FrontSide : T.DoubleSide;
          if (o.material.side !== sd) {
            o.material.side = sd;
            o.material.needsUpdate = true;
          }
        }
      });
  } catch (e) {
    logErr(e, 'l2CutApply');
  }
  return r;
}
function l2CutUi() {
  let d = document.getElementById('l2cut'),
    bt = document.getElementById('bcut');
  if (!bt) {
    const cm = document.getElementById('cmp');
    if (cm) {
      bt = document.createElement('button');
      bt.className = 'bt';
      bt.id = 'bcut';
      bt.title = 'Schnitt durch das LOD300-Modell';
      bt.innerHTML = SVGI(
        '<path d="M4 6h16M4 18h16M7 6v12M17 6v12" stroke-dasharray="2 2"/><path d="M12 3v18"/>',
        18,
      );
      bt.onclick = () => {
        L2CUT.open = !L2CUT.open;
        l2CutUi();
      };
      cm.parentNode.insertBefore(bt, cm);
    }
  }
  if (bt) {
    bt.style.display = l23() ? '' : 'none';
    bt.classList.toggle('on', !!L2CUT.open || L2CUT.m !== 'off');
  }
  if (!l23() || !L2CUT.open) {
    if (d) d.style.display = 'none';
    return;
  }
  l2cCss();
  if (!d) {
    d = document.createElement('div');
    d.id = 'l2cut';
    d.style.cssText =
      'position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:60;background:rgba(255,255,255,.94);border:1px solid #cfcac0;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);padding:6px 10px;font:12px system-ui,sans-serif;color:#1d1d1b;display:flex;gap:6px;align-items:center';
    document.body.appendChild(d);
  }
  d.style.display = 'flex';
  const sg = L2CUT.m + '|' + L2CUT.f;
  if (d.dataset.s !== sg) {
    d.dataset.s = sg;
    const b = (m, t) =>
      `<button class="${L2CUT.m === m ? 'on' : ''}" onclick="L2CUTF.m('${m}')" style="border:1px solid #d3cec2;background:${L2CUT.m === m ? '#5E7F92' : '#faf8f3'};color:${L2CUT.m === m ? '#fff' : 'inherit'};border-radius:8px;padding:2px 9px;cursor:pointer">${t}</button>`;
    d.innerHTML = `<b style="font-weight:600">Schnitt</b>${b('off', 'Aus')}${b('x', 'Längs')}${b('z', 'Quer')}${b('y', 'Grundriss')}<input type="range" min="0" max="1000" value="${Math.round(L2CUT.v * 1000)}" oninput="L2CUTF.v(this.value)" style="width:150px" ${L2CUT.m === 'off' ? 'disabled' : ''}><button onclick="L2CUTF.f()" title="Schnittseite wechseln" style="border:1px solid #d3cec2;background:#faf8f3;border-radius:8px;padding:2px 8px;cursor:pointer">⇄</button>`;
  }
}
const L2CUTF = {
  m: (m) => {
    L2CUT.m = m;
    l2CutApply();
    l2CutUi();
  },
  v: (x) => {
    L2CUT.v = +x / 1000;
    l2CutApply();
  },
  f: () => {
    L2CUT.f = -L2CUT.f;
    l2CutApply();
  },
};
setInterval(() => {
  try {
    l2CutUi();
    if (l23()) {
      if (!L2CUT.init && L2I.size) {
        L2CUT.init = 1;
        l2CutApply();
      } else if (L2CUT.m !== 'off' && L2CUT.n !== L2I.size) {
        L2CUT.n = L2I.size;
        l2CutApply();
      }
    } else {
      if (L2CUT.init) {
        L2CUT.init = 0;
        L2CLIP.constant = 1e5;
      }
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 250);

L2T.filter((t) => t.grp === 'RD').forEach((t) =>
  t.layers.forEach((l) => {
    if (l.kg === '361' && !l.sp) l.sp = { w: 8, s: 70 };
  }),
);
