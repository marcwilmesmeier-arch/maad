// ---- Geländenetz: lokal fein, Gebäude schneiden ihre Grube aus
function plmGeom() {
  try {
    if (!GEO.grid || !S.terr || !GEO.size) return;
    const N = GEO.N,
      h = GEO.size / 2,
      st = GEO.size / N,
      act = PLM.a.filter((a) => a.on !== false),
      flag = new Uint8Array(N * N);
    const bl = plmFoot().map((fp) => {
      let x0 = 1e9,
        z0 = 1e9,
        x1 = -1e9,
        z1 = -1e9;
      fp.forEach((q) => {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        z0 = Math.min(z0, q[1]);
        z1 = Math.max(z1, q[1]);
      });
      return { p: fp, b: [x0, z0, x1, z1] };
    });
    if (!act.length && !bl.length) {
      const g = new T.PlaneGeometry(GEO.size, GEO.size, N, N);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, gh(p.getX(i), p.getZ(i)));
      g.computeVertexNormals();
      S.terr.geometry.dispose();
      S.terr.geometry = g;
      S.wf.geometry = g;
      return;
    }
    const mark = (b, v) => {
      const i0 = plmCl(Math.floor((b[0] + h) / st), 0, N - 1),
        i1 = plmCl(Math.floor((b[2] + h) / st), 0, N - 1),
        j0 = plmCl(Math.floor((b[1] + h) / st), 0, N - 1),
        j1 = plmCl(Math.floor((b[3] + h) / st), 0, N - 1);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) flag[j * N + i] = Math.max(flag[j * N + i], v);
    };
    act.forEach((a) => mark(a.bb, 1));
    bl.forEach((o) => mark([o.b[0] - 0.3, o.b[1] - 0.3, o.b[2] + 0.3, o.b[3] + 0.3], 2));
    let nsp = 0;
    for (let i = 0; i < flag.length; i++) if (flag[i]) nsp++;
    const k1 = nsp > 2500 ? 6 : 10,
      k2 = nsp > 2500 ? 10 : 20;
    const P = [],
      U = [],
      I = [],
      mp = new Map(),
      gw = GEO.size;
    const V = (x, z) => {
      const key = Math.round(x * 100) * 400009 + Math.round(z * 100);
      let i = mp.get(key);
      if (i === undefined) {
        i = P.length / 3;
        P.push(x, gh(x, z), z);
        U.push((x + h) / gw, 1 - (z + h) / gw);
        mp.set(key, i);
      }
      return i;
    };
    const inB = (x, z) => {
      for (const o of bl)
        if (x >= o.b[0] && x <= o.b[2] && z >= o.b[1] && z <= o.b[3] && inP([x, z], o.p)) return true;
      return false;
    };
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const x0 = -h + i * st,
          z0 = -h + j * st,
          f = flag[j * N + i];
        if (!f) {
          const a = V(x0, z0),
            b = V(x0 + st, z0),
            c = V(x0, z0 + st),
            d = V(x0 + st, z0 + st);
          I.push(a, c, b, c, d, b);
          continue;
        }
        const k = f === 2 ? k2 : k1,
          s = st / k,
          id = [];
        for (let q = 0; q <= k; q++) {
          const row = [];
          for (let r = 0; r <= k; r++) row.push(V(x0 + r * s, z0 + q * s));
          id.push(row);
        }
        for (let q = 0; q < k; q++)
          for (let r = 0; r < k; r++) {
            if (
              f === 2 &&
              bl.length &&
              inB(x0 + r * s, z0 + q * s) &&
              inB(x0 + (r + 1) * s, z0 + q * s) &&
              inB(x0 + r * s, z0 + (q + 1) * s) &&
              inB(x0 + (r + 1) * s, z0 + (q + 1) * s)
            )
              continue;
            const a = id[q][r],
              b = id[q][r + 1],
              c = id[q + 1][r],
              d = id[q + 1][r + 1];
            I.push(a, c, b, c, d, b);
          }
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('uv', new T.BufferAttribute(new Float32Array(U), 2));
    g.setIndex(new T.BufferAttribute(P.length / 3 > 65000 ? new Uint32Array(I) : new Uint16Array(I), 1));
    g.computeVertexNormals();
    S.terr.geometry.dispose();
    S.terr.geometry = g;
    S.wf.geometry = g;
  } catch (e) {
    console.error('plmGeom', e);
  }
}
{
  const _rt = rebuildTerrain;
  rebuildTerrain = function () {
    const r = _rt.apply(this, arguments);
    try {
      PLM.gk = '';
      plmTick(1);
    } catch (e) {
      logErr(e, 'rebuildTerrain');
    }
    return r;
  };
}
// Gebäude auf dem Planum neu aufsetzen, Bäume/Kontextgebäude an neue Höhen anpassen
function plmReflow() {
  try {
    for (const b of S.bld || []) {
      if (b.ex || b.ref != null || !b.fp) continue;
      if (
        PLM.a.some((a) =>
          b.fp.some((q) => q[0] >= a.bb[0] && q[0] <= a.bb[2] && q[1] >= a.bb[1] && q[1] <= a.bb[3]),
        )
      )
        mesh(b);
    }
  } catch (e) {
    console.error(e);
  }
  try {
    if (GEO.trees && GEO.trees.length && typeof treesBuild === 'function') treesBuild(GEO.trees);
  } catch (e) {
    console.error(e);
  }
  try {
    if (GEO.blist && GEO.blist.length && typeof ctxBuild === 'function') ctxBuild(GEO.blist.slice());
  } catch (e) {
    console.error(e);
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'plmReflow');
  }
}
function plmTick(force) {
  try {
    if (!GEO.grid) return;
    const gk =
      (GEO.size || 0) +
      '|' +
      GEO.N +
      '|' +
      (GEO.e0 || 0) +
      '|' +
      GEO.grid.length +
      '|' +
      (GEO.grid[(GEO.grid.length / 2) | 0] || 0);
    const ag = JSON.stringify([
        PLM.a.map((a) => [a.id, a.on, a.z, a.n, a.w, a.poly]),
        PLM.hs,
        PLM.hatch,
        PLM.cf,
        PLM.cw,
      ]),
      bs = JSON.stringify(plmFoot()),
      sg = ag + '|' + bs;
    if (
      !force &&
      gk === PLM.gk &&
      sg === PLM.sg &&
      PLM.sel === PLM.ps &&
      PLM.hi === PLM.ph &&
      PLM.open === PLM.po
    )
      return;
    const gch = gk !== PLM.gk,
      ach = ag !== PLM.ag || gch;
    PLM.gk = gk;
    PLM.ps = PLM.sel;
    PLM.ph = PLM.hi;
    PLM.po = PLM.open;
    if (gch) PLM.a.forEach(plmPrep);
    if (ach) {
      PLM.a.forEach(plmPrep);
      plmSync();
    }
    if (sg !== PLM.sg || gch) plmGeom();
    PLM.sg = sg;
    if (ach || force || true) plmPaint();
    if (ach || sg !== PLM.sg0) {
      plmWalls();
      PLM.sg0 = sg;
    }
    if (ach) {
      PLM.ag = ag;
      clearTimeout(PLM.rf);
      PLM.rf = setTimeout(plmReflow, 900);
      if (PLM.open) plmInfo();
    }
  } catch (e) {
    console.error('plmTick', e);
  }
}
setInterval(plmTick, 160);
// ---- Anlegen
function plmNew(poly, name) {
  if (!poly || poly.length < 3) return null;
  const id = 'P' + ++PLM.k0,
    c = plmAvg(poly);
  const a = {
    id,
    name: name || 'Planum ' + PLM.k0,
    poly: poly.map((q) => q.slice()),
    z: Math.round(c.avg * 100) / 100,
    n: poly.map(() => 2),
    on: true,
  };
  plmPrep(a);
  PLM.a.push(a);
  PLM.sel = id;
  plmSync();
  PLM.sg = '';
  plmTick(1);
  plmUi();
  return a;
}
PLM.k0 = 0;
function plmSrc(k) {
  let poly = null,
    nm = '';
  if (k === 'site') {
    if (S.par && S.par.poly) {
      poly = S.par.poly;
      nm = S.par.name || 'Grundstück';
    } else {
      const s = P.find((q) => q.site);
      if (s) {
        poly = s.poly;
        nm = s.name;
      } else if (typeof selPolys === 'function') {
        const l = selPolys().list;
        if (l.length) {
          poly = l[0].poly;
          nm = 'Flurstück';
        }
      }
    }
    if (!poly) {
      gst('Kein Grundstück gewählt – Grundstück oder Flurstück anklicken.');
      plmMsg('Kein Grundstück/Flurstück gewählt.');
      return;
    }
  } else if (k === 'area') {
    if (S.selA && S.selA.poly) {
      poly = S.selA.poly;
      nm = S.selA.name;
    } else {
      plmMsg('Keine Fläche gewählt.');
      return;
    }
  }
  plmNew(poly, nm ? 'Planum ' + nm : null);
}
function plmDraw(sh) {
  PLM.wait = true;
  setShape(sh, 'area');
  plmMsg('Fläche zeichnen: Punkte setzen, Polygon schließen – das Planum entsteht automatisch.');
}
setInterval(() => {
  try {
    if (PLM.wait && S.closed && S.draft && S.draft.length >= 3 && S.tool === 'f') {
      const poly = S.draft.map((q) => q.slice());
      PLM.wait = false;
      cancel();
      tool('v');
      plmNew(poly);
      try {
        rr();
      } catch (e) {
        logErr(e, 'init>anonym');
      }
    } else if (PLM.wait && S.tool !== 'f' && !S.draft.length) PLM.wait = false;
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 200);
