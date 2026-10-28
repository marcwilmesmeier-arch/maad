// ---- v236: Ansichten speichern auch alle Anzeige-Einstellungen (Layer, Farben, Darstellung, Maske, Analyse-Färbung)
// Snapshot ds wird beim Speichern bzw. „Überschreiben“ aus dem aktuellen Zustand erzeugt; spätere Änderungen wirken nicht auf gespeicherte Ansichten.
function vwDs() {
  const cl = (o) => (o == null ? o : JSON.parse(JSON.stringify(o))),
    d = {};
  d.ly = LY.map((l) => [l[1], l[2] ? 1 : 0, l[3]]);
  d.lc = cl(S.lc);
  d.oc = S.oc;
  d.edgeC = S.edgeC;
  d.uses = cl(S.uses);
  d.din = cl(S.din);
  d.fac = {};
  S.fa.forEach((f) => {
    d.fac[f.k] = f.c;
  });
  d.mkOn = !!S.mkOn;
  d.mkA = S.mkA;
  d.showSN = !!S.showSN;
  d.showFN = !!S.showFN;
  d.sd = !!S.sd;
  d.sa = !!S.sa;
  d.dar = S.dar;
  d.aa = S.aa;
  d.rb = S.rb;
  d.sun = !!S.sun;
  d.wire = !!S.wire;
  d.noK = !!S.noK;
  d.lt = cl(S.lt);
  d.hr = $('hr').value;
  d.dt = $('dt').value;
  d.zo = { m: S.zo.m, bc: S.zo.bc, pi: cl(S.zo.pi) || {} };
  d.iso = ZI.sp ? cl(ZI.sp) : null;
  d.hl = !ZI.sp && S.hlk ? { k: S.hlk, b: S.hlb } : null;
  d.expl = { on: S.expl.on ? 1 : 0, gap: S.expl.gap };
  d.kon = cl(S.kon);
  d.hlc = cl(S.hlc);
  d.sky = cl(S.sky);
  return d;
}
function vwApplyDs(d, quiet) {
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js
  // Layer-Nachlauf nach jeder Stelle, die gespeicherte Layer-Zustände anwendet
  const r = (() => {
    // ── Erweiterung aus 18-erweiterungen-v280-v325/030-layer.js
    LYD.skip = 1;
    try {
      return (() => {
        if (!d) return;
        const cl = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
        if (d.kon) {
          S.kon = cl(d.kon);
          konUi();
        }
        if (d.hlc) {
          S.hlc = cl(d.hlc);
          hlcApply();
        }
        if (d.sky) {
          S.sky = Object.assign({}, S.sky, cl(d.sky));
          skyUi();
        }
        if (ZI.sp || S.hlk) {
          try {
            zoIsoClear(true);
          } catch (e) {
            logErr(e, 'vwApplyDs');
          }
          if (S.hlk) {
            S.hlk = null;
            S.hlb = null;
            S.hlw = 0;
            hlClear();
          }
        }
        if (d.lc) {
          const ch = Object.keys(d.lc).filter((k) => S.lc[k] !== d.lc[k]);
          Object.assign(S.lc, lcMig(d.lc));
          if (ch.length) lcApplyAll(ch);
        }
        if (d.oc && d.oc !== S.oc) {
          S.oc = d.oc;
          ocApply();
        }
        if (d.edgeC) S.edgeC = d.edgeC;
        if (d.fac)
          S.fa.forEach((f) => {
            if (d.fac[f.k]) f.c = d.fac[f.k];
          });
        if (d.din) Object.assign(S.din, cl(d.din));
        if (d.uses && Object.keys(d.uses).some((k) => S.uses[k] !== d.uses[k])) {
          Object.assign(S.uses, cl(d.uses));
          S.bld.forEach(mesh);
          H();
          hpos();
        }
        ['mkOn', 'mkA', 'showSN', 'showFN', 'sd', 'sa'].forEach((k) => {
          if (d[k] != null) S[k] = d[k];
        });
        if (d.ly) {
          d.ly.forEach(([k, v, o]) => {
            if (['clc', 'nsg', 'ffh', 'vsg', 'hq'].includes(k)) v = 0;
            const i = LY.findIndex((l) => l[1] === k);
            if (i < 0) return;
            LY[i][2] = v;
            LY[i][3] = o;
            if (!S.geo || !PK[k] || k === 'parcels' || k === 'bplan') {
              if (G[k]) {
                gVis(k, !!v);
                op(k, o);
              }
            }
          });
          labVis();
          if (S.geo) recomp();
        }
        if (d.lt)
          S.lt = {
            wm: Object.assign({ b: 0.85, k: 0.2 }, d.lt.wm),
            sch: Object.assign({ b: 0.85, k: 0.2 }, d.lt.sch),
          };
        if (d.hr != null) $('hr').value = d.hr;
        if (d.dt) $('dt').value = d.dt;
        if (d.sun != null) {
          S.sun = !!d.sun;
          $('sunck').checked = S.sun;
          $('bl').classList.toggle('sunon', S.sun);
          $('sunc').style.display = S.sun ? 'block' : 'none';
        }
        if (d.aa != null) S.aa = +d.aa;
        if (d.rb != null) S.rb = +d.rb;
        if (d.dar) drSet(d.dar);
        if (d.noK != null) {
          S.noK = !!d.noK;
          kontUp();
        }
        if (d.wire != null) {
          S.wire = !!d.wire;
          S.wf.visible = S.wire;
          const e = $('wirck');
          if (e) e.checked = S.wire;
        }
        if (d.zo) {
          if (['b', 'f', 'u'].includes(d.zo.m) && S.zo.m !== d.zo.m) {
            try {
              zoMode(d.zo.m);
            } catch (e) {
              logErr(e, 'vwApplyDs');
            }
          }
          S.zo.bc = d.zo.bc || S.zo.bc;
          S.zo.pi = cl(d.zo.pi) || {};
          try {
            zoApply();
          } catch (e) {
            logErr(e, 'vwApplyDs');
          }
        }
        if (d.iso) {
          ZI.sp = cl(d.iso);
          ZI.key = JSON.stringify(d.iso);
          if (ZI.sp.k) {
            S.hlk = ZI.sp.k;
            S.hlb = ZI.sp.bid;
            S.hlw = 1;
            try {
              hlApply();
            } catch (e) {
              logErr(e, 'vwApplyDs');
            }
          }
          try {
            zoIsoApply();
          } catch (e) {
            logErr(e, 'vwApplyDs');
          }
        } else if (d.hl && d.hl.k) {
          S.hlk = d.hl.k;
          S.hlb = d.hl.b;
          S.hlw = 0;
          try {
            hlApply();
          } catch (e) {
            logErr(e, 'vwApplyDs');
          }
        }
        if (d.expl) {
          S.expl.on = d.expl.on ? 1 : 0;
          S.expl.gap = d.expl.gap;
          S.expl.cur = S.expl.on ? S.expl.gap : 0;
          try {
            exApply();
          } catch (e) {
            logErr(e, 'vwApplyDs');
          }
        }
        try {
          liUp();
        } catch (e) {
          logErr(e, 'vwApplyDs');
        }
        try {
          sunUp();
        } catch (e) {
          logErr(e, 'vwApplyDs');
        }
        if (!quiet) vwDsUi();
      })();
    } finally {
      LYD.skip = 0;
    }
  })();
  try {
    lyAfterRun();
  } catch (e) {
    logErr(e, 'vwApplyDs');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/040-eigene-gruenflaechen-als-eigener-layer.js (danach)
  try {
    if (d && d.ly) {
      ['rail', 'ugr', 'ugk'].forEach((k) => {
        const s = d.ly.find((x) => x[0] === k),
          L = LY.find((l) => l[1] === k);
        if (s && L) {
          L[2] = s[1];
          L[3] = s[2];
        }
      });
    }
    if (d && d.lc) {
      ['ugr', 'ugk', 'rail', 'trees'].forEach((k) => {
        if (d.lc[k]) S.lc[k] = d.lc[k];
      });
    }
    recomp();
    rr();
    if ($('lyp') && $('lyp').style.display === 'block') lyRender();
  } catch (e) {
    logErr(e, 'vwApplyDs');
  }
  // ── Erweiterung aus 28-erweiterungen-v486-v519/090-layer.js (danach)
  try {
    bkApply(true);
  } catch (e) {
    logErr(e, 'vwApplyDs');
  }
  return r;
}
function vwDsUi() {
  try {
    drUi();
  } catch (e) {
    logErr(e, 'vwDsUi');
  }
  try {
    if ($('lyp').style.display === 'block') lyRender();
  } catch (e) {
    logErr(e, 'vwDsUi');
  }
  try {
    const b = $('bex');
    if (b) b.classList.toggle('on', !!S.expl.on);
    const e = $('exp');
    if (e) {
      e.style.display = S.expl.on ? 'flex' : 'none';
      if (S.expl.on)
        e.innerHTML = `<span>Explosion</span><input type="range" min="1" max="15" step="0.5" value="${S.expl.gap}" oninput="exGap(+this.value)"><b id="exv">${f1(S.expl.gap, 1)} m</b>`;
    }
  } catch (e) {
    logErr(e, 'vwDsUi');
  }
  try {
    zoRender();
    zoTick.k = zoSig();
  } catch (e) {
    logErr(e, 'vwDsUi');
  }
  try {
    rr();
  } catch (e) {
    logErr(e, 'vwDsUi');
  }
}
// für Layout/PDF: Ansicht mit ihren eigenen Einstellungen rendern, danach den aktuellen Zustand wiederherstellen
function vwDsSwap(ds) {
  const cur = vwDs();
  if (JSON.stringify(cur) === JSON.stringify(ds)) return null;
  vwApplyDs(ds, true);
  return cur;
}

// ---- Einheitenkörper in 3D (Layer „Einheitenkörper“): je Geschoss und Einheit ein durchscheinender Körper
G.un = new T.Group();
sc.add(G.un);
function grPrism(f, ya, yb) {
  const V = f.o.map((p) => new T.Vector2(p[0], p[1])),
    HV = f.h.map((h) => h.map((p) => new T.Vector2(p[0], p[1]))),
    AV = V.concat(...HV),
    tris = T.ShapeUtils.triangulateShape(
      V.map((v) => v.clone()),
      HV.map((h) => h.map((v) => v.clone())),
    ),
    pos = [],
    ln = [];
  // Windungen so, dass alle Flächen nach außen zeigen (nur Vorderseiten werden gezeichnet; der Schattenwurf nutzt dann die Rückseiten – kein Schattenmuster auf den Oberseiten)
  for (const [i, j, k] of tris) {
    const A = AV[i],
      B = AV[j],
      C = AV[k],
      up = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y) > 0;
    if (up) pos.push(A.x, yb, A.y, B.x, yb, B.y, C.x, yb, C.y, A.x, ya, A.y, C.x, ya, C.y, B.x, ya, B.y);
    else pos.push(A.x, yb, A.y, C.x, yb, C.y, B.x, yb, B.y, A.x, ya, A.y, B.x, ya, B.y, C.x, ya, C.y);
  }
  for (const r of [f.o].concat(f.h))
    for (let i = 0; i < r.length; i++) {
      const p = r[i],
        q = r[(i + 1) % r.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        L = Math.hypot(dx, dz) || 1,
        inw = grInFace(f, (p[0] + q[0]) / 2 - (dz / L) * 0.02, (p[1] + q[1]) / 2 + (dx / L) * 0.02);
      if (!inw)
        pos.push(
          p[0],
          ya,
          p[1],
          q[0],
          ya,
          q[1],
          q[0],
          yb,
          q[1],
          p[0],
          ya,
          p[1],
          q[0],
          yb,
          q[1],
          p[0],
          yb,
          p[1],
        );
      else
        pos.push(
          p[0],
          ya,
          p[1],
          q[0],
          yb,
          q[1],
          q[0],
          ya,
          q[1],
          p[0],
          ya,
          p[1],
          p[0],
          yb,
          p[1],
          q[0],
          yb,
          q[1],
        );
      ln.push(p[0], ya, p[1], q[0], ya, q[1], p[0], yb, p[1], q[0], yb, q[1], p[0], ya, p[1], p[0], yb, p[1]);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return { g, ln };
}
function grFloor(f, y) {
  const V = f.o.map((p) => new T.Vector2(p[0], p[1])),
    HV = f.h.map((h) => h.map((p) => new T.Vector2(p[0], p[1]))),
    AV = V.concat(...HV),
    tris = T.ShapeUtils.triangulateShape(
      V.map((v) => v.clone()),
      HV.map((h) => h.map((v) => v.clone())),
    ),
    pos = [];
  for (const [i, j, k] of tris) {
    const A = AV[i],
      B = AV[j],
      C = AV[k];
    pos.push(A.x, y, A.y, B.x, y, B.y, C.x, y, C.y);
  }
  return pos;
}
function grUnB(b) {
  const g = new T.Group(),
    L = grData(b);
  g.userData.bid = b.id;
  let y = b._y;
  for (const lv of L) {
    const y0 = lv.dg ? b._y + b._h : y,
      lg = new T.Group();
    lg.userData.k = lv.dg ? 'dg' : lv.i;
    let MU = {};
    const mk = (geo, c, lines, dg) => {
      const m = new T.Mesh(
        geo,
        new T.MeshLambertMaterial({ color: c, side: dg ? T.DoubleSide : T.FrontSide }),
      );
      m.raycast = () => {};
      m.castShadow = true;
      m.receiveShadow = !dg;
      m.userData.u = MU;
      lg.add(m);
      if (lines) {
        const e = new T.LineSegments(
          lines,
          new T.LineBasicMaterial({ color: new T.Color(S.lc.un || '#555555') }),
        );
        e.raycast = () => {};
        e.userData.u = MU;
        lg.add(e);
      }
    };

    for (const f of lv.faces) {
      if (!f.un) continue;
      const c = new T.Color((grFA(f.fa) || grDefFa(lv.use)).c);
      MU = { fa: f.fa, fi: f.idx, sn: lv.sn, use: lv.use };
      if (!lv.dg) {
        const P = grPrism(f, y0, y0 + lv.h),
          lg2 = new T.BufferGeometry();
        lg2.setAttribute('position', new T.BufferAttribute(new Float32Array(P.ln), 3));
        mk(P.g, c, lg2);
      } else {
        const fl = grFloor(f, y0),
          fg = new T.BufferGeometry();
        fg.setAttribute('position', new T.BufferAttribute(new Float32Array(fl), 3));
        fg.computeVertexNormals();
        mk(fg, c, null, 1);
        const rg = roofGeo(b, y0, { o: f.o, h: f.h });
        if (rg) mk(rg.geo, c, new T.EdgesGeometry(rg.geo, 15), 1);
      }
    }
    g.add(lg);
    if (!lv.dg) y += lv.h;
  }
  return g;
}
const grUnSig = () => {
  const L = LY.find((l) => l[1] === 'un') || [0, 0, 1, 0.7];
  return JSON.stringify([
    L[2],
    S.dar,
    S.lc.un,
    S.bld.filter((b) => !b.ex && b.ub).map((b) => [b.id, b._y, b._h, b._g && b._g.id, grSig(b)]),
  ]);
};
function grUnBuild() {
  G.un.children.slice().forEach((c) => {
    G.un.remove(c);
    c.traverse((o) => {
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose && o.material.dispose();
    });
  });
  const L = LY.find((l) => l[1] === 'un');
  G.un.visible = zoUnVis();
  S.bld.forEach((b) => {
    if (b.ex || !b.ub || b._y == null) return;
    try {
      G.un.add(grUnB(b));
    } catch (e) {
      console.warn('Einheitenkörper', b.id, e);
    }
  });
  try {
    zoUnPaint();
  } catch (e) {
    logErr(e, 'grUnBuild');
  }
  try {
    exApply();
  } catch (e) {
    logErr(e, 'grUnBuild');
  }
}
