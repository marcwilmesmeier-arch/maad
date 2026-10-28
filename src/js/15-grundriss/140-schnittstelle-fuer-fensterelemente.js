// ---- Schnittstelle für Fensterelemente
const GR = {
  pick: (id) => {
    if (S.bld.find((x) => x.id === id && !x.ex)) {
      GRS.bid = id;
      GRS.lv = null;
      ((GRS.sel = null), (GRS.msel = []));
      GRS.fit = null;
      GRS.pts = [];
      GRS.rect = null;
      const b = grB();
      if (b) b.ub = 1;
      GRS.ps = '';
      GRS.dirty = 1;
      grTick(true);
    }
  },
  tool: grTool,
  step: grStep,
  fit: grFit,
  lv: (k) => {
    GRS.lv = k;
    ((GRS.sel = null), (GRS.msel = []));
    GRS.pts = [];
    GRS.rect = null;
    GRS.ps = '';
    GRS.dirty = 1;
    grTick();
  },
  north: () => {
    S.gro.al = S.gro.al ? 0 : 1;
    const b = grB();
    grAlignSync(b);
    GRS.ps = '';
    grFitSoon();
  },
  undo: () => {
    if (S.hist.length) {
      undo();
      ((GRS.sel = null), (GRS.msel = []));
      GRS.ps = '';
      GRS.dirty = 1;
      grTick(true);
    }
  },
  setSh: (v) => {
    v = Math.max(0.3, Math.min(3, +String(v).replace(',', '.') || 1.2));
    S.gro.sh = Math.round(v * 100) / 100;
    GRS.dirty = 1;
    GRS.ps = '';
    grTick(true);
  },
  tab: (k) => {
    GRS.tab = k;
    GRS.ps = '';
    GRS.dirty = 1;
    const pn = gD('grPnl');
    if (pn && GRS.doc.activeElement && pn.contains(GRS.doc.activeElement)) GRS.doc.activeElement.blur();
    grTick();
  },
  selU: (i, ev) => grPickU(i, !!(ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey))),
  merge: () => grMerge(GRS.msel.slice()),
  rectSz: (k, v) => {
    const b = grB(),
      s = GRS.sel;
    if (!b || !s || s.k !== 'c') return;
    const lv = grLv(b),
      gp = grGrp(lv, s.g);
    if (!gp.rect) return;
    v = Math.max(0.05, +String(v).replace(',', '.') || 0);
    const R = gp.ring,
      e1 = [R[1][0] - R[0][0], R[1][1] - R[0][1]],
      e2 = [R[2][0] - R[1][0], R[2][1] - R[1][1]],
      l1 = Math.hypot(...e1) || 1,
      l2 = Math.hypot(...e2) || 1,
      u = k ? l1 : v,
      w = k ? v : l2,
      A = R[0],
      P1 = [A[0] + (e1[0] / l1) * u, A[1] + (e1[1] / l1) * u],
      P2 = [P1[0] + (e2[0] / l2) * w, P1[1] + (e2[1] / l2) * w],
      P3 = [A[0] + (e2[0] / l2) * w, A[1] + (e2[1] / l2) * w],
      m = new Map();
    [A, P1, P2, P3].forEach((q, i) => m.set(gk(R[i][0], R[i][1]), q));
    grEditGrp(s.g, m);
  },
  segLen: (i, v) => {
    const b = grB(),
      s = GRS.sel;
    if (!b || !s || s.k !== 'c') return;
    const lv = grLv(b),
      gp = grGrp(lv, s.g),
      c = gp.sg[i];
    if (!c) return;
    v = Math.max(0.05, +String(v).replace(',', '.') || 0);
    const L = Math.hypot(c[2] - c[0], c[3] - c[1]) || 1,
      m = new Map();
    m.set(gk(c[2], c[3]), [c[0] + ((c[2] - c[0]) / L) * v, c[1] + ((c[3] - c[1]) / L) * v]);
    grEditGrp(s.g, m);
  },
  setN: (v) => {
    const s = GRS.sel;
    if (!s || s.k !== 'u') return;
    grEdit((b) => {
      const lv = grLv(b),
        f = lv.faces[s.i];
      if (f) grAttr(b, lv, f, { n: String(v).trim() });
    });
  },
  setFa: (k) => {
    const s = GRS.sel;
    if (!s || s.k !== 'u' || !grFA(k)) return;
    grEdit((b) => {
      const lv = grLv(b),
        f = lv.faces[s.i];
      if (f) grAttr(b, lv, f, { fa: k });
    });
  },
  delSel: () => {
    const s = GRS.sel;
    if (s && s.k === 'c') grDelCut(s.g);
    else if (s && s.k === 'u')
      grEdit((b) => {
        const lv = grLv(b),
          f = lv.faces[s.i];
        if (f) grAttr(b, lv, f, { fa: grDefFa(lv.use).k, n: '' });
      });
  },
  copyAll: () =>
    grEdit((b) => {
      const L = grData(b),
        src = grLv(b);
      L.forEach((lv) => {
        if (lv !== src) grCopy(b, src, lv);
      });
    }),
  clearCuts: () =>
    grEdit((b) => {
      const lv = grLv(b);
      lv.obj.cuts = undefined;
      lv.obj.units = undefined;
      b._gr = null;
      ((GRS.sel = null), (GRS.msel = []));
    }),
  png: () => {
    const cv = gD('grCv'),
      b = grB();
    if (!cv || !b) return;
    const lv = grLv(b);
    cv.toBlob((bl) => {
      if (bl)
        grDl('Grundriss_' + (b.name || b.id).replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '_' + lv.sn + '.png', bl);
    }, 'image/png');
  },
  csv: () => {
    const b = grB();
    if (b)
      grDl(
        'Flaechenliste_' + (b.name || b.id).replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '.csv',
        new Blob([grCsv(b)], { type: 'text/csv;charset=utf-8' }),
      );
  },
  useCol: (u, v) => {
    S.uses[u] = v;
    GRS.dirty = 1;
    clearTimeout(GR._ut);
    GR._ut = setTimeout(() => {
      try {
        uc(u, v);
      } catch (e) {
        logErr(e, 'useCol>anonym');
      }
    }, 160);
  },
  dirty: () => {
    GRS.ps = '';
    GRS.dirty = 1;
  },
  faSet: (i, k, v, live) => {
    const f = S.fa[i];
    if (!f) return;
    if (k === 'f') v = Math.max(0, Math.min(100, +v || 0));
    if (k === 'n') v = String(v).trim() || f.n;
    f[k] = v;
    GRS.dirty = 1;
    if (!live) GRS.ps = '';
    if (k === 'u' || k === 'n') GRS.ps = '';
  },
  faDel: (i) => {
    if (S.fa.length <= 1) return;
    S.fa.splice(i, 1);
    GRS.ps = '';
    GRS.dirty = 1;
    grTick(true);
  },
  faAdd: () => {
    S.fa.push({
      k: 'x' + Date.now().toString(36),
      n: 'Neue Flächenart',
      u: 'Wohnen',
      c: '#c8c8c8',
      d: 'NUF',
      f: 100,
    });
    GRS.ps = '';
    GRS.dirty = 1;
    grTick(true);
  },
  dinSet: (k, v, live) => {
    if (!GRDIN[k]) return;
    S.din[k] = v;
    GRS.dirty = 1;
    if (!live) GRS.ps = '';
  },
  dinReset: () => {
    S.din = Object.assign({}, GRDINC0);
    GRS.ps = '';
    GRS.dirty = 1;
  },
  faReset: () => {
    S.fa = JSON.parse(JSON.stringify(GRFA0));
    GRS.ps = '';
    GRS.dirty = 1;
    grTick(true);
  },
  lab: (k, v) => {
    S.gro.lab[k] = v ? 1 : 0;
    GRS.dirty = 1;
    GRS.ps = '';
  },
  opt: (k, v) => {
    S.gro[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
    GRS.dirty = 1;
    GRS.ps = '';
  },
  follow: (v) => {
    GRS.follow = !!v;
  },
  close: grClose,
  popup: grPopup,
};
setInterval(() => {
  try {
    grTick();
  } catch (e) {
    console.warn('Einheiten', e);
  }
}, 400);
