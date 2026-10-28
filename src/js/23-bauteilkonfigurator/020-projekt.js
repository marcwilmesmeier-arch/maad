// ---- Projekt: Arbeitstypen im Gebäude (b.l2.t), Standardtypen und Dachtyp (b.l2.d / b.l2.r)
const L2RD = new Map();
function l2Reg(b) {
  if (!b || !b.l2) return;
  (b.l2.t || []).forEach((t) => {
    if (!L2T.some((x) => x.id === t.id)) {
      const c = JSON.parse(JSON.stringify(t));
      c.dl = c.nm;
      l2Fin(c);
      L2T.push(c);
    }
  });
  if (b.l2.d) {
    const s = JSON.stringify(b.l2.d);
    if (L2RD.get(b.id) !== s) {
      L2RD.set(b.id, s);
      Object.assign(S.l2.defs, b.l2.d);
    }
  }
}
// l2Geo(): Erweiterung zusammengeführt, siehe 22-lod200-waende/020-ableitung-der-bauteile-aus-flaechen.js
function l2cUsed(b) {
  const u = new Set(Object.values(S.l2.defs));
  Object.values((b.l2 && b.l2.rw) || {}).forEach((x) => u.add(x));
  if (b.l2 && b.l2.r) u.add(b.l2.r);
  b.levels.forEach((l) => {
    if (l.l2 && l.l2.ty) l.l2.ty.forEach((q) => u.add(q.id));
  });
  return u;
}
const l2cUnused = (b) => {
  const u = l2cUsed(b);
  return ((b.l2 && b.l2.t) || []).filter((t) => !u.has(t.id)).length;
};
function l2cPrune(b) {
  if (!b.l2 || !b.l2.t) return;
  const u = l2cUsed(b);
  b.l2.t = b.l2.t.filter((t) => u.has(t.id));
}
function l2cEdit(b, fn) {
  b.l2 = b.l2 || {};
  b.l2.d = b.l2.d || Object.assign({}, S.l2.defs);
  hist();
  b.ub = 1;
  fn(b);
  b.l2.d = Object.assign({}, S.l2.defs);
  L2RD.set(b.id, JSON.stringify(b.l2.d));
  b._gr = null;
  b._l2 = null;
  GRS.dirty = 1;
  GRS.ps = '';
  try {
    l2Sync();
  } catch (e) {
    logErr(e, 'l2cEdit');
  }
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'l2cEdit');
  }
}
function l2cAssign(b, e, T2, scope, G) {
  const tid = T2.id;
  if (e.gb) {
    b.l2.rw = b.l2.rw || {};
    const gk = e.gb.gk;
    if (scope === 'one') {
      if (tid === S.l2.defs.AW) delete b.l2.rw[gk];
      else b.l2.rw[gk] = tid;
      if (T2.cu) {
        b.l2.t = b.l2.t || [];
        if (!b.l2.t.some((x) => x.id === tid)) b.l2.t.push(JSON.parse(JSON.stringify(T2)));
        if (!L2T.some((x) => x.id === tid)) L2T.push(T2);
      }
      return;
    }
  }
  if (T2.cu) {
    b.l2.t = b.l2.t || [];
    if (!b.l2.t.some((x) => x.id === tid)) {
      const c = JSON.parse(JSON.stringify(T2));
      b.l2.t.push(c);
    }
    if (!L2T.some((x) => x.id === tid)) L2T.push(T2);
  }
  if (e.kind === 'RD') {
    b.l2.r = tid;
    return;
  }
  if (scope === 'type') {
    const old = e.T.id;
    S.bld.forEach((bb) => {
      (bb.levels || []).forEach((l) => {
        if (l.l2 && l.l2.ty)
          l.l2.ty.forEach((q) => {
            if (q.id === old) q.id = tid;
          });
      });
      if (bb.l2 && bb.l2.r === old) bb.l2.r = tid;
      if (bb.l2 && bb.l2.rw)
        Object.keys(bb.l2.rw).forEach((k) => {
          if (bb.l2.rw[k] === old) bb.l2.rw[k] = tid;
        });
      if (
        bb !== b &&
        bb.l2 &&
        T2.cu &&
        (bb.levels || []).some((l) => l.l2 && l.l2.ty && l.l2.ty.some((q) => q.id === tid))
      ) {
        bb.l2.t = bb.l2.t || [];
        if (!bb.l2.t.some((x) => x.id === tid)) bb.l2.t.push(JSON.parse(JSON.stringify(T2)));
      }
    });
    Object.keys(S.l2.defs).forEach((k) => {
      if (S.l2.defs[k] === old) S.l2.defs[k] = tid;
    });
    return;
  }
  if (scope === 'kind' || e.kind === 'DE' || e.kind === 'BP') {
    S.l2.defs[e.kind] = tid;
    if (e.kind === 'AW' && b.l2.rw) b.l2.rw = {};
    S.bld.forEach((bb) =>
      (bb.levels || []).forEach((l) => {
        if (l.l2 && l.l2.ty) l.l2.ty = l.l2.ty.filter((q) => q.k !== e.kind);
      }),
    );
    return;
  }
  const L = grData(b).filter((l) => !l.dg),
    lv = L[e.li],
    D = (lv.obj.l2 = lv.obj.l2 || { al: {}, ty: [] }),
    tg = e.gid ? G.els.filter((x) => x.li === e.li && x.gid === e.gid && x.kind === e.kind) : [e];
  tg.forEach((w) => {
    D.ty = (D.ty || []).filter(
      (q) => !(q.k === w.kind && Math.hypot(q.p[0] - w.p[0], q.p[1] - w.p[1]) < 0.4),
    );
    if (tid !== S.l2.defs[w.kind]) D.ty.push({ k: w.kind, p: [gr2(w.p[0]), gr2(w.p[1])], id: tid });
  });
}
// ---- Fenster
const L2C = {
  tab: 'e',
  LY: null,
  ref: null,
  W: null,
  sc: 'one',
  open: 0,
  last: '',
  tid: '',
  pd: null,
  pv: null,
};
function l2cEl() {
  const r = L2C.ref;
  if (!r) return null;
  const b = S.bld.find((x) => x.id === r.bid && !x.ex && x._y != null);
  if (!b) return null;
  const G_ = l2Els(b);
  let e =
    G_.els.find((x) => x.id === r.id) ||
    G_.els.find((x) => x.kind === r.kind && x.li === r.li && x.gid === r.gid) ||
    G_.els.find((x) => x.kind === r.kind);
  return e ? { b, e, G: G_ } : null;
}
function l2cCss() {
  if (document.getElementById('l2csty')) return;
  const s = document.createElement('style');
  s.id = 'l2csty';
  s.textContent = `#l2c{position:fixed;right:16px;top:64px;width:392px;max-height:calc(100vh - 88px);overflow:auto;background:#E9EDEF;color:#1d1d1b;border:1px solid #cfcac0;border-radius:10px;box-shadow:0 10px 36px rgba(0,0,0,.22);z-index:99990;font:12.5px/1.4 system-ui,sans-serif}
#l2c .h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #e6e2d8;cursor:move;position:sticky;top:0;background:#E9EDEF;z-index:2}#l2c .h b{font-size:13.5px}#l2c .h .x{margin-left:auto;border:0;background:none;font-size:16px;cursor:pointer}
#l2c .s{padding:9px 12px;border-bottom:1px solid #eee9de}#l2c h5{margin:0 0 6px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#7b776d}
#l2c .ch{display:flex;flex-wrap:wrap;gap:4px}#l2c .ch button{border:1px solid #d9d4c8;background:#faf8f3;border-radius:12px;padding:2px 9px;font-size:11.5px;cursor:pointer}#l2c .ch button.on{background:#5E7F92;border-color:#5E7F92;color:#fff}
#l2c .lk{display:flex;gap:6px;align-items:center;color:#5a574f;font-size:11.5px;margin-bottom:6px}#l2c .lk i{font-style:normal;background:#eee9de;border-radius:4px;padding:0 6px}
#l2c .pv{position:relative;height:200px;border-radius:8px;background:radial-gradient(ellipse at 50% 30%,#fbfaf7,#e4e0d4);overflow:hidden}#l2c .pv canvas{width:100%;height:100%;display:block;cursor:grab}
#l2c .tn{font-weight:600;font-size:13px;margin:2px 0 3px}#l2c .bd{display:inline-block;border-radius:9px;padding:0 8px;font-size:11px;background:#e8f1ec;color:#2f6b4a}#l2c .bd.n{background:#fff1d8;color:#8a5a00}
#l2c .r{display:flex;align-items:center;gap:8px;margin:4px 0}#l2c .r label{flex:0 0 150px;color:#4b483f}#l2c select{flex:1;min-width:0;padding:3px 4px;border:1px solid #d3cec2;border-radius:5px;background:#E9EDEF;font:inherit}
#l2c table{width:100%;border-collapse:collapse;font-size:11.5px}#l2c td{padding:2px 4px;border-top:1px solid #eee9de}#l2c td i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px;border:1px solid rgba(0,0,0,.2)}#l2c td.n{text-align:right;white-space:nowrap}
#l2c .sc label{display:block;margin:3px 0;cursor:pointer}#l2c .ft{display:flex;gap:6px;flex-wrap:wrap;color:#6a665c;font-size:11.5px;align-items:center}#l2c .ft button{border:1px solid #d3cec2;background:#faf8f3;border-radius:6px;padding:2px 9px;cursor:pointer}`;
  document.head.appendChild(s);
}
const l2cOpt = (vals, cur) => {
  const v = vals.slice();
  if (cur != null && v.indexOf(cur) < 0) v.push(cur);
  if (typeof v[0] === 'number') v.sort((a, b) => a - b);
  return v
    .map(
      (x) =>
        `<option value="${esc(String(x))}" ${x === cur ? 'selected' : ''}>${typeof x === 'number' ? l2n1(x) : esc(String(x))}</option>`,
    )
    .join('');
};
function l2cCol(n) {
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js
  const ft = l2mLink(n);
  if (ft) return ft.c;
  const o = S.mat && S.mat.o && S.mat.o[n];
  return o && o.c ? o.c : l2mBase(n);
}
// l2cCol() ohne die Erweiterungen darüber – wird von l2cCol() gezielt aufgerufen
function l2mBase(n) {
  return /klinker/i.test(n)
    ? '#b5533c'
    : /naturwerkstein/i.test(n)
      ? '#cbbf9f'
      : /pfosten/i.test(n)
        ? '#8fb8cc'
        : /kassette/i.test(n)
          ? '#5f6b73'
          : /holzschalung/i.test(n)
            ? '#b98a52'
            : /putz|wärmedämmverbund/i.test(n)
              ? '#eee8da'
              : /dämm|holzfaser-p|kern/i.test(n)
                ? '#f0d666'
                : /stahlbeton|beton|filigran|deckenplatte/i.test(n) && !/dachstein/i.test(n)
                  ? '#b8b8b3'
                  : /kalksand/i.test(n)
                    ? '#e3d7c3'
                    : /ziegel|verblend/i.test(n)
                      ? /dachziegel|tondach/i.test(n)
                        ? '#a85a45'
                        : '#c27256'
                      : /betondachstein/i.test(n)
                        ? '#7d7d7a'
                        : /holz|sparren|pfetten|latt|brettsperr/i.test(n)
                          ? '#c89a62'
                          : /gips|bekleidung|ständerwand|beplank/i.test(n)
                            ? '#f3f2ee'
                            : /stehfalz|zink|metall/i.test(n)
                              ? '#9ba7ae'
                              : /fassade/i.test(n)
                                ? '#cfd5d8'
                                : /wu|tragschicht/i.test(n)
                                  ? '#c4c1b8'
                                  : /estrich|trittschall/i.test(n)
                                    ? '#d6d1c4'
                                    : '#d8d3c6';
}
function l2cTypes(c) {
  const M = new Map();
  S.bld
    .filter((x) => !x.ex && x._y != null)
    .forEach((bb) =>
      l2Els(bb).els.forEach((e) => {
        let m = M.get(e.T.id);
        if (!m) M.set(e.T.id, (m = { T: e.T, n: 0, k: e.kind, b: bb }));
        m.n++;
      }),
    );
  const cls = L2CLS(c.e.kind),
    cur = c.e.T.id,
    iso = S.l2.iso && S.l2.iso.m === 'ty' ? S.l2.iso.sel : null,
    G = { W: [], D: [], R: [] };
  M.forEach((m) => G[L2CAT[m.k]].push(m));
  return `<div style="max-height:200px;overflow:auto;margin:4px 0;border:1px solid #e6e2d8;border-radius:6px;padding:2px 6px">${[
    'W',
    'D',
    'R',
  ]
    .map((g) =>
      G[g].length
        ? `<div class="mu" style="color:#7b776d;font-size:10.5px;margin:4px 0 1px">${L2CN[g].toUpperCase()} · ${G[g].length} Typen</div><table>${G[
            g
          ]
            .sort((a, b) => b.n - a.n)
            .map(
              (m) =>
                `<tr><td ${m.T.id === cur ? 'style="font-weight:600"' : ''}>${esc(m.T.cu ? m.T.nm : l2Auto(m.T.grp, l2Attr(m.T), m.b))}</td><td class="n">${m.n}×</td><td class="n"><button onclick="L2CF.show('${m.T.id}')" style="${iso === m.T.id ? 'background:#5E7F92;color:#fff;' : ''}border:1px solid #d3cec2;border-radius:5px;cursor:pointer;font-size:11px">zeigen</button> ${L2CLS(m.k) === cls ? `<button onclick="L2CF.typ('${m.T.id}')" style="border:1px solid #d3cec2;border-radius:5px;cursor:pointer;font-size:11px">wählen</button>` : ''}</td></tr>`,
            )
            .join('')}</table>`
        : '',
    )
    .join('')}</div>`;
}
function l2cLay(c, T) {
  const k = c.e.kind,
    M = L2M[l2mKey(k)],
    LY = L2C.LY || T.layers,
    cap = {
      AW: 'innen → außen',
      TW: 'Seite A → Seite B',
      TH: 'Seite A → Seite B',
      DE: 'oben → unten',
      BP: 'oben → unten',
      RD: 'außen (oben) → innen',
    }[k],
    tot = LY.reduce((s, l) => s + l.d, 0);
  return `<div class="s"><h5>Schichtaufbau · ${cap}</h5><div class="ft" style="margin-bottom:6px">${(() => {
    const g = (f) => Math.round(LY.filter(f).reduce((s, l) => s + l.d, 0) * 1000) / 10;
    return k === 'AW'
      ? `Drei Schichtgruppen (DIN 276): Fassade ${l2n1(g((l) => l.kg === '335'))} cm · Tragschicht ${l2n1(g((l) => l.kg === '331'))} cm · Innenseite ${l2n1(g((l) => l.kg === '336'))} cm – gemeinsam über „Eigenschaften“ steuerbar`
      : '';
  })()}</div><table>${LY.map(
    (l, i) =>
      `<tr><td style="width:44%">${l2mSw(l.n)}<select style="width:calc(100% - 18px)" onchange="L2CF.lay('m',${i},this.value)">${l2cOpt(
        M.map((m) => m[0]),
        l.n,
      )}</select></td><td class="n"><select onchange="L2CF.lay('d',${i},this.value)">${l2cOpt(L2TH, Math.round(l.d * 1000) / 10)}</select> cm</td><td class="n" title="Kostengruppe nach DIN 276, automatisch aus Material und Kategorie">KG ${l.kg}</td><td class="n"><button onclick="L2CF.lay('u',${i})" title="nach oben">↑</button><button onclick="L2CF.lay('v',${i})" title="nach unten">↓</button><button onclick="L2CF.lay('x',${i})" title="Schicht löschen" ${LY.length < 2 ? 'disabled' : ''}>✕</button></td></tr>${k === 'RD' && l.kg === '361' ? `<tr><td colspan="4" style="padding:3px 4px 6px 22px;background:#faf8f3"><label style="cursor:pointer"><input type="checkbox" ${l.sp ? 'checked' : ''} onchange="L2CF.lay('sx',${i})"> Sparren einzeichnen</label>${l.sp ? ` · Breite <select onchange="L2CF.lay('sw',${i},this.value)" style="width:64px">${l2cOpt([6, 8, 10, 12], l.sp.w)}</select> cm · Achsabstand <select onchange="L2CF.lay('ss',${i},this.value)" style="width:64px">${l2cOpt([50, 60, 70, 80, 100], l.sp.s)}</select> cm` : ''}</td></tr>` : ''}`,
  ).join('')}</table>
<div class="ft" style="margin-top:6px"><button onclick="L2CF.lay('a')">＋ Schicht hinzufügen</button><span style="margin-left:auto">Gesamt ${l2n1(tot * 100)} cm</span></div><div class="ft" style="margin-top:4px">Kostengruppe und Leistungsbereich folgen automatisch dem gewählten Material. Jede Änderung legt einen eigenen Typ an, andere Bauteile bleiben unberührt (siehe „Gilt für“).</div></div>`;
}
function l2cHtml(c) {
  // ── Erweiterung aus 23-bauteilkonfigurator/040-lod-200.js
  return l23() ? l2cHtmlBasis(c) : l2cHtmlC(c);
}
// l2cHtml() ohne die Erweiterungen darüber – wird von l2cHtml() gezielt aufgerufen
function l2cHtmlBasis(c) {
  const { b, e, G } = c,
    T_ = e.T,
    W = L2C.W,
    k = e.kind,
    cat = L2CAT[k],
    cls = L2CLS(k),
    sig = l2Sig(k, W),
    same = L2T.filter(
      (t) => (!t.lay || t.id === T_.id) && L2CLS(t.grp) === cls && l2Sig(t.grp, l2Attr(t)) === sig,
    ),
    cur = same.find((t) => t.id === T_.id),
    T2 = cur || same[0],
    n = G.els.filter((x) => x.T.id === (T2 ? T2.id : T_.id)).length,
    nm = T2 ? (T2.cu ? T2.nm : l2Auto(k, W, b)) : l2Auto(k, W, b);
  const kinds = [...new Set(G.els.map((x) => x.kind))],
    kn = ['AW', 'TW', 'TH', 'DE', 'BP', 'RD'].filter((x) => kinds.indexOf(x) >= 0);
  const al =
    k !== 'AW' && e.gid && L2CAT[k] === 'W'
      ? (l2Data(grData(b).filter((l) => !l.dg)[e.li]).al || {})[e.gid] || 'm'
      : null;
  const nT = G.els.filter((x) => x.T.id === T_.id).length,
    sc = k === 'RD' ? 'one' : k === 'DE' || k === 'BP' ? 'kind' : L2C.sc;
  let h = `<div class="h" id="l2ch"><b>Bauteilkonfigurator</b><span class="mu" style="color:#7b776d">${esc(b.name || b.id)}</span><button class="x" onclick="L2CF.close()" title="Schließen">✕</button></div>
<div class="s"><div class="lk"><i>🔒 Kategorie: ${L2CN[cat]}</i><i>Funktion: ${L2FN[k]}</i><span>fest, nicht änderbar</span></div><div class="ch">${kn.map((x) => `<button class="${x === k ? 'on' : ''}" onclick="L2CF.kind('${x}')">${L2FN[x]}</button>`).join('')}</div></div>
<div class="s"><div class="pv"><canvas id="l2cCv"></canvas></div></div>
<div class="s"><h5>Typ</h5><div class="tn" onclick="L2CF.tl()" style="cursor:pointer" title="Alle Typen im Modell anzeigen">${esc(nm)} <span style="color:#7b776d">${L2C.tl ? '▴' : '▾'}</span></div>${L2C.tl ? l2cTypes(c) : ''}<span class="bd ${cur || T2 ? '' : 'n'}">${T2 ? (cur ? 'aktueller Typ · ' : 'bestehender Typ gefunden · ') + (T2 === cur ? nT : n) + ' Bauteil' + ((T2 === cur ? nT : n) === 1 ? '' : 'e') : 'neuer Typ wird angelegt'}</span>
<div class="r" style="margin-top:6px"><label>Vorhandenen Typ wählen</label><select onchange="L2CF.typ(this.value)"><option value="">–</option>${L2T.filter(
    (t) => L2CLS(t.grp) === cls,
  )
    .map(
      (t) =>
        `<option value="${t.id}">${esc(t.cu ? t.nm : l2Auto(t.grp, l2Attr(t), b))}${t.id === T_.id ? '  ✓' : ''}</option>`,
    )
    .join('')}</select></div></div>
<div class="s"><div class="ch"><button class="${L2C.tab !== 'a' ? 'on' : ''}" onclick="L2CF.tab('e')">Eigenschaften</button><button class="${L2C.tab === 'a' ? 'on' : ''}" onclick="L2CF.tab('a')">Schichtaufbau bearbeiten</button></div></div>
${
  L2C.tab === 'a'
    ? l2cLay(c, T2 || T_)
    : `<div class="s"><h5>Eigenschaften</h5>${T_.lay ? '<div class="ft" style="margin-bottom:4px">Eigener Aufbau: eine Änderung der Eigenschaften setzt den Aufbau auf den Standard zurück.</div>' : ''}${L2F[cls].map((f) => `<div class="r"><label>${L2A[f].n}</label><select onchange="L2CF.set('${f}',this.value)">${l2cOpt(L2A[f].v(k), W[f])}</select></div>`).join('')}</div>
<div class="s"><h5>Geometrie und Aufbau</h5>${L2G[cls].map((f) => `<div class="r"><label>${L2A[f].n} (${L2A[f].u})</label><select onchange="L2CF.set('${f}',this.value)">${l2cOpt(L2A[f].v(k), W[f])}</select></div>`).join('')}
${al ? `<div class="r"><label>Lage zur Zeichenlinie</label><select onchange="L2CF.al(this.value)">${['l', 'm', 'r'].map((a) => `<option value="${a}" ${a === al ? 'selected' : ''}>${L2AL[a]}</option>`).join('')}</select></div>` : ''}
<div class="ft" style="margin:4px 0">${e.len ? `Länge ${l2f(e.len)} m · ` : ''}${e.h ? `Höhe ${l2f(e.h)} m · ` : ''}Gesamtdicke ${Math.round((T2 || T_).d * 1000) / 10} cm${k === 'RD' ? ' · Neigung ' + (+b.roof.angle || 30) + '°' : ''}</div>
<table>${(T2 || T_).layers.map((l) => `<tr><td>${l2mSw(l.n)}${esc(l.n)}</td><td class="n">${l2n1(l.d * 100)} cm</td><td class="n">KG ${l.kg}</td></tr>`).join('')}</table></div>`
}
<div class="s sc"><h5>Gilt für</h5>${k === 'RD' ? '<div class="ft">Das Dach dieses Gebäudes (Dachform ist fest).</div>' : k === 'DE' || k === 'BP' ? `<div class="ft">Alle ${L2FN[k]}n (werden gebäudeweit einheitlich geführt).</div>` : `<label><input type="radio" name="l2sc" ${sc === 'one' ? 'checked' : ''} onchange="L2CF.sc('one')"> Nur ${e.gid ? 'diese Wand' : 'dieses Wandstück'}</label><label><input type="radio" name="l2sc" ${sc === 'type' ? 'checked' : ''} onchange="L2CF.sc('type')"> Alle ${nT} Bauteile dieses Typs</label><label><input type="radio" name="l2sc" ${sc === 'kind' ? 'checked' : ''} onchange="L2CF.sc('kind')"> Standard für alle ${L2FN[k]}e</label>`}</div>
<div class="s"><div class="ft"><span>${esc(cat === 'W' ? 'IfcWall' : cat === 'D' ? 'IfcSlab' : 'IfcRoof')} · ${(T2 || T_).pre} · KG ${(T2 || T_).kg}</span><button onclick="undo()" style="margin-left:auto">↶ Rückgängig</button>${l2cUnused(b) ? `<button onclick="L2CF.clean()" title="Arbeitstypen dieses Projekts löschen, die kein Bauteil mehr nutzt">Ungenutzte Typen entfernen (${l2cUnused(b)})</button>` : ''}</div></div>`;
  return h;
}
function l2cRender() {
  const c = l2cEl();
  let d = document.getElementById('l2c');
  if (!c) {
    if (d) d.remove();
    L2C.open = 0;
    return;
  }
  l2cCss();
  if (!d) {
    d = document.createElement('div');
    d.id = 'l2c';
    document.body.appendChild(d);
    const st = d.style;
    L2C.drag = null;
    d.addEventListener('pointerdown', (ev) => {
      const hd = ev.target.closest('#l2ch');
      if (!hd || ev.target.closest('button')) return;
      const r = d.getBoundingClientRect();
      L2C.drag = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      hd.setPointerCapture(ev.pointerId);
    });
    d.addEventListener('pointermove', (ev) => {
      if (!L2C.drag) return;
      d.style.left = Math.max(0, ev.clientX - L2C.drag.x) + 'px';
      d.style.top = Math.max(0, ev.clientY - L2C.drag.y) + 'px';
      d.style.right = 'auto';
    });
    d.addEventListener('pointerup', () => {
      L2C.drag = null;
    });
  }
  const st = d.scrollTop;
  d.innerHTML = l2cHtml(c);
  d.scrollTop = st;
  L2C.open = 1;
  L2C.tid = c.e.T.id;
  L2C.ref.id = c.e.id;
  l2cPv(c);
}
function l2cOpen(e, b) {
  const bid = e.bid || (b && b.id);
  if (!bid) return;
  const nr = { bid, id: e.id, kind: e.kind, li: e.li, gid: e.gid };
  if (!L2C.ref || L2C.ref.id !== nr.id || L2C.ref.bid !== nr.bid) L2C.sc = 'one';
  L2C.ref = nr;
  L2C.W = Object.assign({}, l2Attr(e.T));
  l2cRender();
}
function l2cCommit() {
  const c = l2cEl();
  if (!c) return;
  const { b, e, G } = c,
    k = e.kind,
    sig = l2Sig(k, L2C.W),
    cand = L2T.filter(
      (t) => (!t.lay || t.id === e.T.id) && L2CLS(t.grp) === L2CLS(k) && l2Sig(t.grp, l2Attr(t)) === sig,
    );
  let T2 = cand.find((t) => t.id === e.T.id) || cand.find((t) => t.grp === k) || cand[0];
  if (!T2) T2 = l2Mk(k, L2C.W, b);
  const sc = k === 'RD' ? 'one' : k === 'DE' || k === 'BP' ? 'kind' : L2C.sc;
  if (T2.id !== e.T.id || (sc === 'kind' && S.l2.defs[k] !== T2.id && k !== 'RD'))
    l2cEdit(b, (bb) => l2cAssign(bb, e, T2, sc, G));
  l2cRender();
}
function l2cCommitT(T2) {
  const c = l2cEl();
  if (!c) return;
  const { b, e, G } = c,
    k = e.kind,
    sc = k === 'RD' ? 'one' : k === 'DE' || k === 'BP' ? 'kind' : L2C.sc;
  if (T2.id !== e.T.id || (sc === 'kind' && S.l2.defs[k] !== T2.id && k !== 'RD'))
    l2cEdit(b, (bb) => l2cAssign(bb, e, T2, sc, G));
  L2C.LY = null;
  l2cRender();
}
function l2cLayCommit() {
  const c = l2cEl();
  if (!c || !L2C.LY) return;
  const T2 = l2MkL(c.e.kind, L2C.W, L2C.LY, c.b);
  L2C.W = Object.assign({}, T2.a);
  l2cCommitT(T2);
  L2C.LY = null;
}
const L2CF = {
  tl: () => {
    L2C.tl = !L2C.tl;
    l2cRender();
  },
  show: (id) => {
    L2ISO('ty', '*', id);
    l2cRender();
  },
  tab: (t) => {
    L2C.tab = t;
    L2C.LY = null;
    l2cRender();
  },
  lay: (op, i, v) => {
    const c = l2cEl();
    if (!c) return;
    const k = c.e.kind,
      M = L2M[l2mKey(k)],
      LY = (L2C.LY || c.e.T.layers).map((l) => ({
        n: l.n,
        d: l.d,
        kg: l.kg,
        lb: l.lb,
        sp: l.sp ? Object.assign({}, l.sp) : undefined,
      }));
    if (op === 'm') {
      const m = M.find((x) => x[0] === v);
      if (m) {
        LY[i].n = m[0];
        LY[i].kg = m[1];
        LY[i].lb = m[2];
      }
    } else if (op === 'd') LY[i].d = Math.round(+v * 10) / 1000;
    else if (op === 'sw') {
      LY[i].sp = LY[i].sp || { w: 8, s: 70 };
      LY[i].sp.w = +v;
    } else if (op === 'ss') {
      LY[i].sp = LY[i].sp || { w: 8, s: 70 };
      LY[i].sp.s = +v;
    } else if (op === 'sx') {
      if (LY[i].sp) delete LY[i].sp;
      else LY[i].sp = { w: 8, s: 70 };
    } else if (op === 'u' && i > 0) [LY[i - 1], LY[i]] = [LY[i], LY[i - 1]];
    else if (op === 'v' && i < LY.length - 1) [LY[i + 1], LY[i]] = [LY[i], LY[i + 1]];
    else if (op === 'x' && LY.length > 1) LY.splice(i, 1);
    else if (op === 'a') {
      const m = M[0];
      LY.push({ n: m[0], d: 0.02, kg: m[1], lb: m[2] });
    } else return;
    L2C.LY = LY;
    l2cLayCommit();
  },
  clean: () => {
    const c = l2cEl();
    if (!c) return;
    l2cEdit(c.b, (bb) => l2cPrune(bb));
    l2cRender();
  },
  close: () => {
    const d = document.getElementById('l2c');
    if (d) d.remove();
    L2C.open = 0;
    l2cPvStop();
  },
  set: (f, v) => {
    L2C.W[f] = f === 'dt' || f === 'dd' || f === 'ds' ? +v : v;
    l2cCommit();
  },
  typ: (id) => {
    if (!id) return;
    const t = L2T.find((x) => x.id === id);
    if (!t) return;
    if (t.lay) {
      L2C.W = Object.assign({}, t.a);
      l2cCommitT(t);
      return;
    }
    L2C.W = Object.assign({}, l2Attr(t));
    l2cCommit();
  },
  sc: (v) => {
    L2C.sc = v;
  },
  al: (a) => {
    const c = l2cEl();
    if (!c || !c.e.gid) return;
    const { b, e } = c;
    l2cEdit(b, (bb) => {
      const lv = grData(bb).filter((l) => !l.dg)[e.li],
        D = (lv.obj.l2 = lv.obj.l2 || { al: {}, ty: [] });
      D.al[e.gid] = a;
    });
    l2cRender();
  },
  kind: (k) => {
    const c = l2cEl();
    if (!c) return;
    const e = c.G.els.find((x) => x.kind === k && x.li === c.e.li) || c.G.els.find((x) => x.kind === k);
    if (e) {
      S.l2.sel = e.id;
      L2AN || l2Run();
      l2cOpen(e, c.b);
    }
  },
  fd: () => {
    const b = S.bld.find((x) => x.id === (typeof FDS !== 'undefined' && FDS.bid) && !x.ex && x._y != null);
    if (!b) return;
    const e = l2Els(b).els.find((x) => x.kind === 'AW');
    if (e) l2cOpen(e, b);
  },
};
GR.l2.cfg = () => {
  const T_ = l2Target();
  if (T_) l2cOpen(T_.el, T_.b);
};
