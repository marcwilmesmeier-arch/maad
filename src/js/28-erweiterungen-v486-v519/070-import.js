/* v504: Import-Tab – Plan-Bilder (JPG/PNG/PDF) als Draufsicht auf dem Gelände; Skalieren (Seitenverhältnis fest), Maßstab per Messlinie, Ein-/Ausblenden, Transparenz, Benennen */
const IMP = { sh: [], sel: null, mode: null, m: [], drag: null, id: 0, busy: '', dirty: true, down: null };
G.imp = new T.Group();
sc.add(G.imp);
{
  const i = TABS.indexOf('Export');
  TABS.splice(i < 0 ? TABS.length : i + 1, 0, 'Import');
}
IC.Import = '⇧';
const impEsc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
const impSel = () => IMP.sh.find((s) => s.id === IMP.sel) || null;
function impMesh(s) {
  if (s.mesh) {
    G.imp.remove(s.mesh);
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
    s.mesh = null;
  }
  if (!s.tex) return;
  const W = s.w,
    Hh = s.h,
    nx = Math.max(2, Math.min(64, Math.ceil(W / 4))),
    nz = Math.max(2, Math.min(64, Math.ceil(Hh / 4))),
    c = Math.cos((s.rot * Math.PI) / 180),
    sn = Math.sin((s.rot * Math.PI) / 180),
    pos = [],
    uv = [],
    ix = [],
    ord = IMP.sh.indexOf(s);
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const lx = (i / nx - 0.5) * W,
        lz = (j / nz - 0.5) * Hh,
        x = s.x + lx * c - lz * sn,
        z = s.z + lx * sn + lz * c;
      let y = 0;
      try {
        y = gh(x, z);
      } catch (e) {
        logErr(e, 'impMesh');
      }
      pos.push(x, y + 0.1 + ord * 0.01, z);
      uv.push(i / nx, 1 - j / nz);
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b = a + 1,
        d = a + nx + 1,
        e = d + 1;
      ix.push(a, d, b, b, d, e);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new T.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(ix);
  const m = new T.Mesh(
    g,
    new T.MeshBasicMaterial({
      map: s.tex,
      transparent: true,
      opacity: s.op,
      side: T.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  m.renderOrder = 4 + ord;
  m.frustumCulled = false;
  m.raycast = () => {};
  m.userData._ov = 1;
  m.visible = !!s.vis;
  s.mesh = m;
  G.imp.add(m);
}
function impAll() {
  IMP.sh.forEach(impMesh);
  try {
    rr();
  } catch (e) {
    logErr(e, 'impAll');
  }
}
function impTex(s, im) {
  const t = new T.Texture(im);
  t.needsUpdate = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  try {
    t.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy());
  } catch (e) {
    logErr(e, 'impTex');
  }
  s.tex = t;
}
function impAdd(o) {
  const s = Object.assign(
    {
      id: ++IMP.id,
      name: 'Plan',
      url: '',
      pw: 1,
      ph: 1,
      w: 100,
      h: 100,
      x: V.tx || 0,
      z: V.tz || 0,
      rot: 0,
      op: 0.7,
      vis: 1,
      lock: 1,
    },
    o,
  );
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      impTex(s, im);
      IMP.sh.push(s);
      IMP.sel = s.id;
      impMesh(s);
      IMP.dirty = true;
      try {
        rr();
      } catch (e) {
        logErr(e, 'onload');
      }
      ok(s);
    };
    im.onerror = () => {
      IMP.busy = 'Bild „' + s.name + '“ konnte nicht gelesen werden.';
      IMP.dirty = true;
      ok(null);
    };
    im.src = s.url;
  });
}
function impPack(src, w, h, png) {
  const mx = png ? 2560 : 3072,
    k = Math.min(1, mx / Math.max(w, h)),
    pw = Math.max(1, Math.round(w * k)),
    ph = Math.max(1, Math.round(h * k)),
    c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const x = c.getContext('2d');
  if (!png) {
    x.fillStyle = '#fff';
    x.fillRect(0, 0, pw, ph);
  }
  x.drawImage(src, 0, 0, pw, ph);
  return { url: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88), pw, ph };
}
function impDefW(pw, ph) {
  const w = Math.min(120, Math.max(20, (GEO.size || 300) * 0.4));
  return { w, h: (w * ph) / pw };
}
function impImg(f, name) {
  return new Promise((ok) => {
    const u = URL.createObjectURL(f),
      im = new Image();
    im.onload = () => {
      const p = impPack(im, im.naturalWidth, im.naturalHeight, /png/i.test(f.type || f.name));
      URL.revokeObjectURL(u);
      impAdd(Object.assign({ name }, p, impDefW(p.pw, p.ph))).then(ok);
    };
    im.onerror = () => {
      URL.revokeObjectURL(u);
      IMP.busy = 'Bild „' + name + '“ konnte nicht gelesen werden.';
      ok(null);
    };
    im.src = u;
  });
}
function impLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } catch (e) {
        logErr(e, 'onload');
      }
      ok(window.pdfjsLib);
    };
    s.onerror = () =>
      no(new Error('PDF-Bibliothek (pdf.js) konnte nicht geladen werden – Internetverbindung prüfen.'));
    document.head.appendChild(s);
  });
}
async function impPdf(f, name) {
  const lib = await impLib(),
    doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise,
    n = Math.min(doc.numPages, 12);
  for (let p = 1; p <= n; p++) {
    const pg = await doc.getPage(p),
      v0 = pg.getViewport({ scale: 1 }),
      k = Math.min(4, 3072 / Math.max(v0.width, v0.height)),
      vp = pg.getViewport({ scale: k }),
      c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    await impAdd(
      Object.assign(
        {
          name: n > 1 ? name + ' – Seite ' + p : name,
          url: c.toDataURL('image/jpeg', 0.88),
          pw: c.width,
          ph: c.height,
        },
        impDefW(c.width, c.height),
      ),
    );
  }
  if (doc.numPages > n)
    IMP.busy = 'PDF hat ' + doc.numPages + ' Seiten – die ersten ' + n + ' wurden importiert.';
}
async function impFiles(list) {
  IMP.busy = 'Lade …';
  IMP.dirty = true;
  try {
    rr();
  } catch (e) {
    logErr(e, 'impFiles');
  }
  for (const f of Array.from(list || [])) {
    const name = f.name.replace(/\.[^.]+$/, ''),
      isPdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
    try {
      if (isPdf) await impPdf(f, name);
      else if (/^image\/(png|jpe?g)$/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)) await impImg(f, name);
      else IMP.busy = '„' + f.name + '“: nur JPG, PNG und PDF.';
    } catch (e) {
      IMP.busy = 'Fehler bei „' + f.name + '“: ' + ((e && e.message) || e);
    }
  }
  if (IMP.busy === 'Lade …') IMP.busy = '';
  IMP.dirty = true;
  try {
    rr();
  } catch (e) {
    logErr(e, 'impFiles');
  }
}
/* ---------- Bedienung ---------- */
const IMF = {
  pick() {
    $('impFile').click();
  },
  sel(id) {
    IMP.sel = IMP.sel === id ? null : id;
    IMP.mode = null;
    IMP.m = [];
    impMk();
    IMP.dirty = true;
    rr();
  },
  vis(id) {
    const s = IMP.sh.find((x) => x.id === id);
    if (!s) return;
    s.vis = s.vis ? 0 : 1;
    if (s.mesh) s.mesh.visible = !!s.vis;
    IMP.dirty = true;
    rr();
  },
  name(id, v) {
    const s = IMP.sh.find((x) => x.id === id);
    if (s) s.name = v.trim() || 'Plan';
    IMP.dirty = true;
    rr();
  },
  del(id) {
    const i = IMP.sh.findIndex((x) => x.id === id);
    if (i < 0) return;
    const s = IMP.sh[i];
    if (s.mesh) {
      G.imp.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    if (s.tex) s.tex.dispose();
    IMP.sh.splice(i, 1);
    if (IMP.sel === id) IMP.sel = null;
    IMP.mode = null;
    IMP.m = [];
    impMk();
    IMP.sh.forEach(impMesh);
    IMP.dirty = true;
    rr();
  },
  op(id, v) {
    const s = IMP.sh.find((x) => x.id === id);
    if (!s) return;
    s.op = Math.max(0, Math.min(1, v / 100));
    if (s.mesh) s.mesh.material.opacity = s.op;
    const l = $('impOpV');
    if (l) l.textContent = Math.round(s.op * 100) + ' %';
  },
  w(id, v, dim) {
    const s = IMP.sh.find((x) => x.id === id);
    v = parseFloat(String(v).replace(',', '.'));
    if (!s || !(v > 0)) return;
    const ar = s.ph / s.pw;
    if (dim === 'h') {
      if (s.lock) {
        s.h = v;
        s.w = v / ar;
      } else s.h = v;
    } else {
      if (s.lock) {
        s.w = v;
        s.h = v * ar;
      } else s.w = v;
    }
    impMesh(s);
    IMP.dirty = true;
    rr();
  },
  lock(id, v) {
    const s = IMP.sh.find((x) => x.id === id);
    if (!s) return;
    s.lock = v ? 1 : 0;
    if (s.lock) s.h = (s.w * s.ph) / s.pw;
    impMesh(s);
    IMP.dirty = true;
    rr();
  },
  rot(id, v) {
    const s = IMP.sh.find((x) => x.id === id);
    v = parseFloat(String(v).replace(',', '.'));
    if (!s || isNaN(v)) return;
    s.rot = v;
    impMesh(s);
  },
  mode(m) {
    IMP.mode = IMP.mode === m ? null : m;
    IMP.m = [];
    impMk();
    impBox(false);
    IMP.dirty = true;
    try {
      cv.style.cursor = IMP.mode === 'measure' ? 'crosshair' : '';
    } catch (e) {
      logErr(e, 'mode');
    }
    if (IMP.mode === 'measure') {
      impFit(impSel());
    }
    try {
      $('hud').textContent =
        IMP.mode === 'measure'
          ? 'Maßstab messen · Linie auf dem Plan ziehen (oder Anfangs- und Endpunkt anklicken), dann die echte Länge eingeben'
          : IMP.mode === 'move'
            ? 'Plan verschieben · mit gedrückter linker Maustaste ziehen'
            : '';
    } catch (e) {
      logErr(e, 'mode');
    }
    rr();
  },
  here(id) {
    const s = IMP.sh.find((x) => x.id === id);
    if (!s) return;
    s.x = V.tx || 0;
    s.z = V.tz || 0;
    impMesh(s);
  },
  apply(id, val) {
    const s = IMP.sh.find((x) => x.id === id),
      L = parseFloat(String(val != null ? val : ($('impLen') || {}).value).replace(',', '.'));
    if (!s || IMP.m.length < 2 || !(L > 0)) return;
    const a = IMP.m[0],
      b = IMP.m[1],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 1e-6) return;
    const k = L / d;
    s.w *= k;
    s.h *= k;
    s.x = a[0] + (s.x - a[0]) * k;
    s.z = a[1] + (s.z - a[1]) * k;
    IMP.m = [];
    IMP.mode = null;
    impMk();
    impBox(false);
    try {
      cv.style.cursor = '';
      $('hud').textContent = 'Maßstab übernommen: Plan ' + f1(s.w, 1) + ' × ' + f1(s.h, 1) + ' m';
      impFit(s);
    } catch (e) {
      logErr(e, 'apply');
    }
    impMesh(s);
    IMP.dirty = true;
    rr();
  },
};
function impIn(s, p) {
  if (!s) return false;
  const c = Math.cos((-s.rot * Math.PI) / 180),
    n = Math.sin((-s.rot * Math.PI) / 180),
    dx = p[0] - s.x,
    dz = p[1] - s.z,
    lx = dx * c - dz * n,
    lz = dx * n + dz * c;
  return Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.h / 2;
}
function impFit(s) {
  if (!s) return;
  try {
    if (S.m3) setMode(0);
    V.tx = s.x;
    V.tz = s.z;
    const vh = Math.max(s.h, (s.w * mid.clientHeight) / Math.max(1, mid.clientWidth)) * 1.2;
    V.d = vh / 1.2;
  } catch (e) {
    logErr(e, 'impFit');
  }
}
function impBox(show, x, y, txt) {
  let b = document.getElementById('impBox');
  if (!show) {
    if (b) b.style.display = 'none';
    return;
  }
  if (!b) {
    b = document.createElement('div');
    b.id = 'impBox';
    b.style.cssText =
      'position:fixed;z-index:9999;background:#E9EDEF;color:#1F2A33;border:1px solid #5E7F92;border-radius:10px;padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:13px system-ui,sans-serif;width:230px';
    b.innerHTML =
      '<div id="impBoxT" style="margin-bottom:6px"></div><div style="display:flex;gap:6px"><input id="impBoxV" type="text" inputmode="decimal" placeholder="Länge in m" style="flex:1;min-width:0;padding:5px 7px;border:1px solid #9bb;border-radius:6px;font:inherit"><button id="impBoxOk" style="padding:5px 10px;border:0;border-radius:6px;background:#5E7F92;color:#fff;font:inherit;cursor:pointer">OK</button></div>';
    document.body.appendChild(b);
    const go = () => {
      const s = impSel();
      if (s) IMF.apply(s.id, document.getElementById('impBoxV').value);
    };
    b.querySelector('#impBoxOk').onclick = go;
    b.querySelector('#impBoxV').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
      else if (e.key === 'Escape') {
        IMP.m = [];
        IMP.cur = null;
        impMk();
        impBox(false);
      }
    });
  }
  b.querySelector('#impBoxT').innerHTML = txt || '';
  b.style.display = 'block';
  b.style.left = Math.max(8, Math.min(innerWidth - 246, x + 14)) + 'px';
  b.style.top = Math.max(8, Math.min(innerHeight - 110, y + 14)) + 'px';
  const i = b.querySelector('#impBoxV');
  i.value = '';
  setTimeout(() => {
    i.focus();
  }, 30);
}
function impMk() {
  if (IMP.mk) {
    sc.remove(IMP.mk);
    IMP.mk.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose && o.material.dispose();
    });
    IMP.mk = null;
  }
  const pts = IMP.m.slice();
  if (IMP.cur && pts.length === 1) pts.push(IMP.cur);
  if (!pts.length || !IMP.mode) return;
  const g = new T.Group(),
    y = (p) => {
      let h = 0;
      try {
        h = gh(p[0], p[1]);
      } catch (e) {
        logErr(e, 'y');
      }
      return h + 0.6;
    },
    k = (() => {
      try {
        return S.m3
          ? ((pc.position.distanceTo(new T.Vector3(pts[0][0], 0, pts[0][1])) * 2 * Math.tan(Math.PI / 8)) /
              mid.clientHeight) *
              5
          : 5 * mpp();
      } catch (_) {
        return 1;
      }
    })();
  pts.forEach((p) => {
    const m = new T.Mesh(
      new T.SphereGeometry(1, 12, 8),
      new T.MeshBasicMaterial({ color: 0xd8342c, depthTest: false, transparent: true }),
    );
    m.scale.setScalar(k);
    m.position.set(p[0], y(p), p[1]);
    m.renderOrder = 60;
    m.raycast = () => {};
    g.add(m);
  });
  if (pts.length === 2) {
    const l = new T.Line(
      new T.BufferGeometry().setFromPoints(pts.map((p) => new T.Vector3(p[0], y(p), p[1]))),
      new T.LineBasicMaterial({ color: 0xd8342c, depthTest: false, transparent: true }),
    );
    l.renderOrder = 59;
    l.raycast = () => {};
    g.add(l);
  }
  g.userData._ov = 1;
  sc.add(g);
  IMP.mk = g;
}
addEventListener(
  'pointerdown',
  (e) => {
    try {
      if (!IMP.mode || e.target !== cv || e.button !== 0) return;
      IMP.down = { x: e.clientX, y: e.clientY };
      IMP.g0 = null;
      if (IMP.mode === 'move') {
        const s = impSel(),
          g = ground(e);
        if (s && g) {
          IMP.drag = { g: g, x: s.x, z: s.z };
          e.stopImmediatePropagation();
        }
      } else if (IMP.mode === 'measure') {
        IMP.g0 = ground(e);
        e.stopImmediatePropagation();
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
addEventListener(
  'pointermove',
  (e) => {
    try {
      if (!IMP.mode || (e.target !== cv && !IMP.drag)) return;
      const g = ground(e);
      if (!g) return;
      if (IMP.mode === 'move' && IMP.drag) {
        const s = impSel();
        if (s) {
          s.x = IMP.drag.x + g[0] - IMP.drag.g[0];
          s.z = IMP.drag.z + g[1] - IMP.drag.g[1];
          impMesh(s);
        }
        return;
      }
      if (IMP.mode === 'measure') {
        const sh = impSel(),
          p1 =
            IMP.m.length === 1
              ? IMP.m[0]
              : IMP.down &&
                  IMP.g0 &&
                  impIn(sh, IMP.g0) &&
                  Math.hypot(e.clientX - IMP.down.x, e.clientY - IMP.down.y) > 5
                ? IMP.g0
                : null;
        if (!p1 || IMP.m.length >= 2) return;
        if (!impIn(sh, g)) {
          IMP.cur = null;
          if (IMP.m.length === 1) impMk();
          return;
        }
        IMP.cur = g;
        if (IMP.m.length === 0) ((IMP.m = [p1.slice()]), (IMP.drg = 1));
        impMk();
        $('hud').textContent =
          'Länge im Plan: ' + f1(Math.hypot(g[0] - p1[0], g[1] - p1[1]), 2) + ' m (aktueller Maßstab)';
      }
    } catch (e) {
      logErr(e, 'init>anonym');
    }
  },
  true,
);
addEventListener(
  'pointerup',
  (e) => {
    try {
      if (IMP.drag) {
        IMP.drag = null;
        IMP.down = null;
        return;
      }
      if (IMP.mode !== 'measure' || e.target !== cv || e.button !== 0 || !IMP.down) return;
      const d = IMP.down;
      IMP.down = null;
      e.stopImmediatePropagation();
      const sh = impSel(),
        g = ground(e),
        moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5;
      const warn = () => {
        try {
          $('hud').textContent = 'Messpunkte nur innerhalb des ausgewählten Plans setzen';
        } catch (e) {
          logErr(e, 'warn');
        }
      };
      if (!sh || !sh.vis) {
        warn();
        return;
      }
      if (IMP.drg) {
        IMP.drg = 0;
        if (g && impIn(sh, g) && Math.hypot(g[0] - IMP.m[0][0], g[1] - IMP.m[0][1]) > 0.01) {
          IMP.m.push(g);
        } else {
          IMP.m = [];
          impMk();
          if (g) warn();
          return;
        }
      } else {
        if (!g || !impIn(sh, g)) {
          warn();
          return;
        }
        if (IMP.m.length >= 2) IMP.m = [];
        IMP.m.push(g);
      }
      IMP.cur = null;
      impMk();
      if (IMP.m.length === 2) {
        const L = Math.hypot(IMP.m[1][0] - IMP.m[0][0], IMP.m[1][1] - IMP.m[0][1]);
        IMP.dirty = true;
        rr();
        impBox(
          true,
          e.clientX,
          e.clientY,
          'Gemessen im Plan: <b>' + f1(L, 2) + ' m</b><br>Tatsächliche Länge dieser Linie:',
        );
        try {
          $('hud').textContent = 'Echte Länge eingeben und mit Enter bestätigen';
        } catch (e) {
          logErr(e, 'init>anonym');
        }
      } else
        try {
          $('hud').textContent = 'Zweiten Punkt anklicken';
        } catch (e) {
          logErr(e, 'init>anonym');
        }
    } catch (x) {
      console.warn('imp', x);
    }
  },
  true,
);
addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && IMP.mode) {
      const t = e.target || {};
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      IMF.mode(IMP.mode);
      e.stopImmediatePropagation();
    }
  },
  true,
);
// skAct(): Erweiterung zusammengeführt, siehe 26-modellier-modus/010-modellier.js
// tool(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/030-mini.js
