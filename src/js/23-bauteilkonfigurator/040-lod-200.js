// ---- v349: LOD 200 = nur Wandart und Stärke (kein Aufbau, keine Fassade); Detail erst in LOD 300
function l2cSetCx(b, e, cm, scope, G) {
  const k = e.kind;
  b.l2 = b.l2 || {};
  if (e.gb) {
    b.l2.rwc = b.l2.rwc || {};
    if (scope === 'kind') {
      b.l2.rwc = {};
      b.l2.c = Object.assign({}, b.l2.c || {});
      b.l2.c.AW = cm;
      (b.levels || []).forEach((l) => {
        if (l.l2 && l.l2.tc) l.l2.tc = l.l2.tc.filter((q) => q.k !== 'AW');
      });
    } else b.l2.rwc[e.gb.gk] = 'G-AW-' + cm;
    return;
  }
  if (k === 'AW' && scope === 'kind') b.l2.rwc = {};
  if (scope === 'kind' || k === 'DE' || k === 'BP' || k === 'RD') {
    b.l2.c = Object.assign({}, b.l2.c || {});
    b.l2.c[k] = cm;
    (b.levels || []).forEach((l) => {
      if (l.l2 && l.l2.tc) l.l2.tc = l.l2.tc.filter((q) => q.k !== k);
    });
    return;
  }
  const L = grData(b).filter((l) => !l.dg),
    lv = L[e.li];
  if (!lv) return;
  const D = (lv.obj.l2 = lv.obj.l2 || { al: {}, ty: [] });
  D.tc = D.tc || [];
  const def = (b.l2.c && b.l2.c[k]) || L2DC[k],
    tg = e.gid ? G.els.filter((x) => x.li === e.li && x.gid === e.gid && x.kind === k) : [e];
  tg.forEach((w) => {
    D.tc = D.tc.filter((q) => !(q.k === w.kind && Math.hypot(q.p[0] - w.p[0], q.p[1] - w.p[1]) < 0.4));
    if (cm !== def) D.tc.push({ k: w.kind, p: [gr2(w.p[0]), gr2(w.p[1])], id: 'G-' + w.kind + '-' + cm });
  });
}
function l2cSetC(b, e, cm, scope, G) {
  cm = Math.round(+cm * 2) / 2;
  if (!(cm >= 5 && cm <= 80)) return;
  l2cEdit(b, (bb) => l2cSetCx(bb, e, cm, scope, G));
  S.l2.flash = e.id;
}
function l2cSetDefC(k, v) {
  const b = grB();
  v = Math.round(+v * 2) / 2;
  if (!b || !(v >= 5 && v <= 80)) return;
  grEdit((bb) => {
    bb.l2 = bb.l2 || {};
    bb.l2.c = Object.assign({}, bb.l2.c || {});
    bb.l2.c[k] = v;
    (bb.levels || []).forEach((l) => {
      if (l.l2 && l.l2.tc) l.l2.tc = l.l2.tc.filter((q) => q.k !== k);
    });
    bb._l2 = null;
  });
}
function l2cHtmlC(c) {
  const { b, e, G } = c,
    k = e.kind,
    cm = Math.round(e.T.d * 1000) / 10,
    wall = k === 'AW' || k === 'TW' || k === 'TH',
    cs = (L2CP[k] || []).slice();
  if (cs.indexOf(cm) < 0) {
    cs.push(cm);
    cs.sort((a, c2) => a - c2);
  }
  const kinds = [...new Set(G.els.map((x) => x.kind))],
    kn = ['AW', 'TW', 'TH', 'DE', 'BP', 'RD'].filter((x) => kinds.indexOf(x) >= 0),
    sc = wall && L2C.sc === 'kind' ? 'kind' : 'one',
    nK = G.els.filter((x) => x.kind === k).length;
  return `<div class="h" id="l2ch"><b>Bauteilkonfigurator</b><span class="mu" style="color:#7b776d">${esc(b.name || b.id)} · LOD 200</span><button class="x" onclick="L2CF.close()" title="Schließen">✕</button></div>
<div class="s"><div class="lk"><i>Bauteil: ${esc(L2K[k].n)}</i><span>Art fest</span></div><div class="ch">${kn.map((x) => `<button class="${x === k ? 'on' : ''}" onclick="L2CF.kind('${x}')">${L2K[x].n}</button>`).join('')}</div></div>
<div class="s"><h5>Stärke</h5><div class="ch">${cs.map((c2) => `<button class="${c2 === cm ? 'on' : ''}" onclick="L2CF.cm(${c2})">${String(c2).replace('.', ',')}</button>`).join('')}</div>
<div class="r" style="margin-top:6px"><label>Stärke (cm)</label><input type="number" step="0.5" min="5" max="80" value="${cm}" style="width:80px" onchange="L2CF.cm(this.value)"></div>
<div class="ft" style="margin:4px 0">${e.len ? `Länge ${l2f(e.len)} m · ` : ''}${e.h ? `Höhe ${l2f(e.h)} m · ` : ''}${wall ? (k === 'AW' ? 'baut sich von außen nach innen auf' : 'mittig auf der Trennlinie') : ''}</div></div>
<div class="s sc"><h5>Gilt für</h5>${wall ? `<label><input type="radio" name="l2sc" ${sc === 'one' ? 'checked' : ''} onchange="L2CF.csc('one')"> Nur ${e.gid ? 'diese Wand' : 'dieses Wandstück'}</label><label><input type="radio" name="l2sc" ${sc === 'kind' ? 'checked' : ''} onchange="L2CF.csc('kind')"> Alle ${L2K[k].n}-Teile (${nK})</label>` : `<div class="ft">${k === 'RD' ? 'Das Dach dieses Gebäudes.' : 'Alle ' + L2K[k].n + 'n (gebäudeweit einheitlich).'}</div>`}</div>
<div class="s"><div class="ft">Aufbau, Schichten, Eigenschaften, Fassade und Kostengruppen je Schicht werden in LOD 300 festgelegt.</div><div class="ft"><button onclick="lodSet(300)">LOD 300 öffnen</button><button onclick="undo()" style="margin-left:auto">↶ Rückgängig</button></div></div>`;
}
{
  const _h = l2cHtml;
  l2cHtml = function (c) {
    return l23() ? _h(c) : l2cHtmlC(c);
  };
}
L2CF.cm = (v) => {
  const c = l2cEl();
  if (!c) return;
  const k = c.e.kind;
  l2cSetC(
    c.b,
    c.e,
    v,
    k === 'DE' || k === 'BP' || k === 'RD' || L2C.sc !== 'kind'
      ? k === 'DE' || k === 'BP' || k === 'RD'
        ? 'kind'
        : 'one'
      : 'kind',
    c.G,
  );
  l2cRender();
};
L2CF.csc = (s) => {
  L2C.sc = s;
  l2cRender();
};
setInterval(() => {
  try {
    if (L2C.open && L2C.lod !== S.lod) {
      L2C.lod = S.lod;
      l2cRender();
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 400);

// ---- v350: Parallelisierung der tragenden Wandschichten (LOD 300): dünnster Fassadenaufbau je Ansicht = Referenz, stärkere Aufbauten stehen über die Kubatur vor
function l2Tout(T) {
  const L = T.layers;
  let i = L.findIndex((l) => L2ST.indexOf(l.kg) >= 0);
  if (i < 0) i = 0;
  let s = 0;
  for (let j = i + 1; j < L.length; j++) s += L[j].d;
  return Math.round(s * 1000) / 1000;
}
function l2View(b, r, lv) {
  try {
    const g = r.es[0],
      e = g.e;
    let nx = -(e.q[1] - e.p[1]),
      nz = e.q[0] - e.p[0];
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const f0 = lv.faces[e.f[0]];
    if (grInFace(f0, g.mx + nx * 0.03, g.mz + nz * 0.03)) {
      nx = -nx;
      nz = -nz;
    }
    const v = fdViewAt(b, nx, nz, g.mx, g.mz, 0.8);
    return v ? v.key : '';
  } catch (_) {
    return '';
  }
}
{
  const _g = l2Geo;
  l2Geo = function (b) {
    let r = _g.apply(this, arguments);
    if (!l23() || !r || !r.probe) return r;
    const m = {};
    r.probe.forEach((p) => {
      if (!p.vk) return;
      m[p.vk] = m[p.vk] == null ? p.t : Math.min(m[p.vk], p.t);
    });
    if (JSON.stringify(m) !== JSON.stringify(b._l2ref || {})) {
      b._l2ref = m;
      b._l2 = null;
      r = _g.apply(this, arguments);
    }
    return r;
  };
}

// ---- v351: Giebel und Drempel wie Geschosswände (Fassade, Einzeltyp, Flucht)
function l2Gc(g) {
  let sx = 0,
    sz = 0,
    n = 0;
  g.t.forEach((t) =>
    t.forEach((P) => {
      sx += P[0];
      sz += P[2];
      n++;
    }),
  );
  return n ? [sx / n, sz / n] : null;
}
function l2ViewN(b, nx, nz, pos) {
  try {
    const v = pos ? fdViewAt(b, nx, nz, pos[0], pos[1], 0.8) : null;
    if (v) return v.key;
    const V = fdViews(b);
    let best = '',
      bd = 0.8;
    V.forEach((v) => {
      const d = v.n[0] * nx + v.n[1] * nz;
      if (d > bd) {
        bd = d;
        best = v.key;
      }
    });
    return best;
  } catch (_) {
    return '';
  }
}
function l2FacGb(b, g, yr) {
  try {
    if (!b.fd) return '';
    const V = fdViews(b);
    let sx = 0,
      sz = 0,
      sy = 0,
      n = 0;
    g.t.forEach((t) =>
      t.forEach((P) => {
        sx += P[0];
        sz += P[2];
        sy += P[1];
        n++;
      }),
    );
    if (!n) return '';
    const mx = sx / n,
      mz = sz / n,
      my = sy / n,
      best = fdViewAt(b, g.nx, g.nz, mx, mz, 0.9);
    if (!best) return '';
    const tx = best.n[1],
      tz = -best.n[0],
      u = mx * tx + mz * tz;
    let yE = b._y || 0;
    for (let i = 0; i < ugN(b); i++) yE += b.levels[i].h;
    const vm = my - yE;
    const F = fdFaces(b, best).find((f) => grInFace(f, u, vm));
    return F && F.t && F.t !== 'ohne' && L2FAC[F.t] ? F.t : '';
  } catch (_) {
    return '';
  }
}

// ---- Esc: Auswahl im Bauteilkonfigurator aufheben
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const t = e.target;
  if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
  try {
    if (L2C.open || L2C.ref) {
      L2CF.close();
      L2C.ref = null;
    }
    S.l2.sel = null;
    S.l2.pick = 0;
    S.l2.pt = null;
  } catch (e) {
    logErr(e, 'init>anonym');
  }
});

// ======================================================================
// Materialkonfigurator (LOD300): Darstellung der Schichtmaterialien im 3D-Modell (Farbe, Muster) und im Schnitt (Schnittfarbe, Schraffur);
// neue Fassadenmaterialien (erscheinen im Fassadendesigner); tragende Schichten mit eigener Darstellung
// Daten: S.mat={o:{<Schichtname>:{c,cs,hs,pt,ps}},nf:[{k,n,d,ud,kg,lb,c}]}
// ======================================================================
S.mat = { o: {}, nf: [] };
const L2HS = [
    ['', 'ohne'],
    ['diag', 'schräg'],
    ['cross', 'kreuz'],
    ['hor', 'waagerecht'],
    ['dots', 'Punkte'],
    ['solid', 'voll'],
  ],
  L2PT = [
    ['', 'glatt'],
    ['brick', 'Ziegelverband'],
    ['plank', 'Bretter (senkrecht)'],
    ['hplank', 'Bretter (waagerecht)'],
    ['panel', 'Platten / Kassetten'],
    ['grid', 'Raster (Pfosten-Riegel)'],
  ];
const l2mBase = l2cCol;
function l2mDef(n) {
  const c = l2mBase(n);
  return {
    c,
    cs: c,
    hs:
      /beton|filigran|deckenplatte/i.test(n) && !/dachstein/i.test(n)
        ? 'dots'
        : /dämm|holzfaser-p|kern/i.test(n)
          ? 'cross'
          : /kalksand|ziegel|verblend|klinker|tragschicht|mauer/i.test(n)
            ? 'diag'
            : /holz|sparren|latt|brettsperr/i.test(n)
              ? 'hor'
              : '',
    pt: /klinker|verblend/i.test(n)
      ? 'brick'
      : /holzschalung/i.test(n)
        ? 'plank'
        : /kassette|metallpaneel|naturwerkstein|fassadenplatte/i.test(n)
          ? 'panel'
          : /pfosten/i.test(n)
            ? 'grid'
            : '',
    ps: /klinker|verblend/i.test(n)
      ? 0.075
      : /holzschalung/i.test(n)
        ? 0.14
        : /naturwerkstein/i.test(n)
          ? 0.6
          : /kassette|metallpaneel/i.test(n)
            ? 0.5
            : /pfosten/i.test(n)
              ? 1.2
              : 0.5,
  };
}
// Eine Darstellungsquelle: Farbe der Fassadenschicht = Farbe des Fassadentyps im Fassadendesigner (S.ft), Änderungen wirken in beide Richtungen
function l2mLink(n) {
  if (n === 'Wärmedämmverbundsystem') return S.ft.find((t) => t.k === 'put') || null;
  for (const k in L2FAC) {
    const a = L2FAC[k];
    if (a.length && a[a.length - 1][0] === n) return S.ft.find((t) => t.k === k) || null;
  }
  return null;
}
function l2mSig() {
  return JSON.stringify([S.mat, S.ft.map((t) => t.k + t.c)]);
}
function l2mGet(n) {
  const d = l2mDef(n),
    o = (S.mat && S.mat.o && S.mat.o[n]) || {},
    ft = l2mLink(n),
    r = Object.assign({}, d, o);
  if (ft) {
    r.c = ft.c;
    if (!o.cs) r.cs = ft.c;
  }
  return r;
}
function l2mSw(n) {
  const g = l2mGet(n),
    lk = l2mLink(n);
  return `<input type="color" value="${g.c}" class="l2sw" title="${lk ? 'Farbe – gleiche Quelle wie im Fassadendesigner (' + esc(lk.n) + ')' : 'Farbe im 3D-Modell'}" onclick="event.stopPropagation()" onchange="L2MF.set(${JSON.stringify(n).replace(/"/g, '&quot;')},'c',this.value)" style="width:16px;height:16px;padding:0;border:1px solid rgba(0,0,0,.25);border-radius:3px;vertical-align:-3px;margin-right:4px;background:none">`;
}
l2cCol = function (n) {
  const ft = l2mLink(n);
  if (ft) return ft.c;
  const o = S.mat && S.mat.o && S.mat.o[n];
  return o && o.c ? o.c : l2mBase(n);
};
// ---- Persistenz
{
  const _p = projExtra;
  projExtra = function () {
    const x = _p.apply(this, arguments);
    try {
      x.mat = JSON.parse(JSON.stringify(S.mat));
    } catch (e) {
      logErr(e, 'projExtra');
    }
    return x;
  };
}
{
  const _a = projApplySet;
  projApplySet = function (x) {
    try {
      if (x && x.mat) {
        S.mat = { o: x.mat.o || {}, nf: x.mat.nf || [] };
        l2mReg();
      }
    } catch (e) {
      logErr(e, 'projApplySet');
    }
    return _a.apply(this, arguments);
  };
}
{
  const _n = newProjectReset;
  newProjectReset = function () {
    try {
      S.mat = { o: {}, nf: [] };
      l2mReg();
    } catch (e) {
      logErr(e, 'newProjectReset');
    }
    return _n.apply(this, arguments);
  };
}
// ---- eigene Fassadenmaterialien als Fassadentyp (Fassadendesigner) mit Aufbau (Unterkonstruktion + Material) registrieren
function l2mReg() {
  try {
    Object.keys(L2FAC).forEach((k) => {
      if (/^m\d+$/.test(k)) delete L2FAC[k];
    });
    S.mat.nf.forEach((m) => {
      L2FAC[m.k] = (m.ud > 0 ? [['Unterkonstruktion mit Hinterlüftung', m.ud, '335', '016']] : []).concat([
        [m.n, m.d, m.kg || '335', m.lb || '016'],
      ]);
      if (!S.ft.some((t) => t.k === m.k)) S.ft.push({ k: m.k, n: m.n, c: m.c });
    });
  } catch (e) {
    logErr(e, 'l2mReg');
  }
}
function l2mNew(n, d, ud, c, pt) {
  n = String(n || '').trim();
  if (!n) return;
  let i = 1;
  while (S.mat.nf.some((m) => m.k === 'm' + i)) i++;
  const k = 'm' + i;
  S.mat.nf.push({ k, n, d: Math.max(0.001, d), ud: Math.max(0, ud), kg: '335', lb: '016', c });
  S.mat.o[n] = Object.assign(S.mat.o[n] || {}, { pt: pt || '', hs: 'solid' });
  l2mReg();
  l2mDirty();
}
function l2mDirty() {
  try {
    S.l2.bsig = '';
    b_l2Reset();
  } catch (e) {
    logErr(e, 'l2mDirty');
  }
  L2MW.ps = '';
  L2MW.dirty = 1;
}
function b_l2Reset() {
  S.bld.forEach((b) => {
    b._l2 = null;
  });
}
