// ---- Maske: weißer Schleier (einstellbare Transparenz) über allem außer Grundstück und selbst Erzeugtem (Flächen, Straßen, Gebäudekörper) – 2D und 3D (Stencil)
S.mkOn = false;
S.mkA = 0.75;
const MK = { keep: new T.Group(), sig: '', vs: null, vc: null, vm: null, sm: null };
sc.add(MK.keep);
function mkInit() {
  if (MK.vs) return;
  const sm = new T.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: true,
    depthFunc: T.LessEqualDepth,
    side: T.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  sm.stencilWrite = true;
  sm.stencilFunc = T.AlwaysStencilFunc;
  sm.stencilRef = 1;
  sm.stencilZPass = T.ReplaceStencilOp;
  MK.sm = sm;
  const vm = new T.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  vm.stencilWrite = true;
  vm.stencilFunc = T.NotEqualStencilFunc;
  vm.stencilRef = 1;
  vm.stencilFail = vm.stencilZFail = vm.stencilZPass = T.KeepStencilOp;
  MK.vs = new T.Scene();
  MK.vc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  MK.vm = new T.Mesh(new T.PlaneGeometry(2, 2), vm);
  MK.vm.frustumCulled = false;
  MK.vs.add(MK.vm);
}
function mkDrape(poly) {
  try {
    const tr = T.ShapeUtils.triangulateShape(
        poly.map((q) => new T.Vector2(q[0], q[1])),
        [],
      ),
      pos = [];
    const sub = (a, b, c, d) => {
      const l = Math.max(
        Math.hypot(a[0] - b[0], a[1] - b[1]),
        Math.hypot(b[0] - c[0], b[1] - c[1]),
        Math.hypot(c[0] - a[0], c[1] - a[1]),
      );
      if (l <= 4 || d > 6) {
        for (const p of [a, b, c]) pos.push(p[0], gh(p[0], p[1]) + 0.08, p[1]);
        return;
      }
      const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2],
        ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
      sub(a, ab, ca, d + 1);
      sub(ab, b, bc, d + 1);
      sub(ca, bc, c, d + 1);
      sub(ab, bc, ca, d + 1);
    };
    for (const f of tr) sub(poly[f[0]], poly[f[1]], poly[f[2]], 0);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    return g;
  } catch (_) {
    return null;
  }
}
function mkRibbon(L, w) {
  if (!L || L.length < 2) return null;
  const n = L.length,
    h = w / 2,
    pos = [],
    lf = [],
    rg = [];
  for (let i = 0; i < n; i++) {
    const a = L[Math.max(0, i - 1)],
      b = L[Math.min(n - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz) || 1,
      nx = (-dz / l) * h,
      nz = (dx / l) * h;
    lf.push([L[i][0] + nx, L[i][1] + nz]);
    rg.push([L[i][0] - nx, L[i][1] - nz]);
  }
  const v = (p) => pos.push(p[0], gh(p[0], p[1]) + 0.08, p[1]);
  for (let i = 0; i < n - 1; i++) {
    v(lf[i]);
    v(rg[i]);
    v(lf[i + 1]);
    v(rg[i]);
    v(rg[i + 1]);
    v(lf[i + 1]);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  return g;
}
function mkKeep() {
  const sg = (q) => q.length + ':' + q.reduce((t, p) => t + p[0] * 1.3 + p[1] * 0.7, 0).toFixed(2),
    sig =
      (S.terr ? S.terr.uuid : '') +
      '|' +
      P.filter((q) => q.site && q.poly)
        .map((q) => q.id + sg(q.poly))
        .join(',') +
      '|' +
      (S.areas || []).map((a) => a.id + a.type + (a.w || '') + (a.r || '') + sg(a.poly || [])).join(',');
  if (sig === MK.sig) return;
  MK.sig = sig;
  while (MK.keep.children.length) {
    const o = MK.keep.children.pop();
    o.geometry.dispose();
  }
  const add = (g) => {
    if (!g) return;
    const m = new T.Mesh(g, MK.sm);
    m.layers.set(2);
    m.frustumCulled = false;
    MK.keep.add(m);
  };
  for (const q of P) if (q.site && q.poly && q.poly.length > 2) add(mkDrape(q.poly));
  for (const a of S.areas || []) {
    if (a.type === 'road') add(mkRibbon(a.line, a.w));
    else if (a.poly && a.poly.length > 2) add(mkDrape(a.poly));
  }
}
function mkRender(scn, cm) {
  if (scn === sc)
    try {
      drTick(cm);
    } catch (e) {
      logErr(e, 'mkRender');
    }
  if (!S.mkOn || !(S.mkA > 0) || scn !== sc) {
    ren.render(scn, cm);
    return;
  }
  try {
    mkInit();
    mkKeep();
    for (const b of S.bld) {
      if (b.ex || !b._g) continue;
      b._g.traverse((o) => {
        if (!o.userData._mk) {
          o.layers.enable(2);
          o.userData._mk = 1;
        }
      });
    }
  } catch (e) {
    ren.render(scn, cm);
    return;
  }
  ren.render(scn, cm);
  const ac = ren.autoClear,
    lm = cm.layers.mask,
    om = scn.overrideMaterial,
    bg = scn.background;
  try {
    ren.autoClear = false;
    scn.overrideMaterial = MK.sm;
    scn.background = null;
    cm.layers.set(2);
    ren.render(scn, cm);
  } finally {
    cm.layers.mask = lm;
    scn.overrideMaterial = om;
    scn.background = bg;
  }
  MK.vm.material.opacity = S.mkA;
  ren.render(MK.vs, MK.vc);
  ren.autoClear = ac;
}
function mkSet(k, v) {
  if (k === 'on') S.mkOn = !!v;
  else S.mkA = Math.max(0, Math.min(1, +v));
}
const maskHtml = () =>
  `<h4>Maske</h4><div class="ly"><input type="checkbox" ${S.mkOn ? 'checked' : ''} onchange="mkSet('on',this.checked)"><label>Umgebung ausblenden (weiße Maske)</label></div><div class="ly" style="padding-left:22px"><label>Transparenz</label><input type="range" min="0" max="0.95" step="0.05" value="${+(1 - S.mkA).toFixed(2)}" oninput="mkSet('a',1-this.value)" style="width:110px" title="rechts = Maske durchsichtiger, links = Umgebung fast weiß"></div>`;
