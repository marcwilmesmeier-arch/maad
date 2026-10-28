// ---- Panel (Reiter Wände und Mengen) und Werkzeugleiste
GRTABS.push(['w', 'Wände'], ['m', 'Mengen']);
// grPanel(): Erweiterung zusammengeführt, siehe 15-grundriss/100-kopf.js
function l2Opts(grp, cur) {
  return L2T.filter((t) => t.grp === grp)
    .map((t) => `<option value="${t.id}" ${t.id === cur ? 'selected' : ''}>${esc(t.dl)}</option>`)
    .join('');
}
function l2PanelW(b) {
  const lv = grLv(b);
  let h = '';
  if (!l2on())
    return `<button class="full" onclick="GR.l2.demo()">▶ Durchspielen (ca. 25 s)</button><h4>Wände und Decken (LOD 200)</h4><div class="mu" style="margin:6px 0 10px">Wände und Geschossdecken entstehen automatisch aus Umriss, Schnittlinien und Flächenarten: Außenwand am Umriss, Treppenhauswand um Treppenhaus und Schacht, Trennwand zwischen den Einheiten.</div><button class="full" onclick="lodSet(200)">LOD 200 einschalten</button>`;
  const G_ = l2Els(b),
    es = G_.els.filter((e) => e.li === lv.i && e.quads),
    T_ = l2Target();
  h +=
    `<button class="full" onclick="GR.l2.demo()">${S.l2.demo ? '■ Vorführung stoppen' : '▶ Durchspielen (ca. 25 s)'}</button><div class="row"><label>Darstellung im Plan</label><select style="width:200px" onchange="GR.l2.wc(this.value)"><option value="g" ${S.l2.wc !== 'k' ? 'selected' : ''}>Grau mit schwarzem Rand</option><option value="k" ${S.l2.wc === 'k' ? 'selected' : ''}>Schwarz</option></select></div>` +
    (l23()
      ? `<h4>Standardtypen</h4>` +
        [
          ['AW', 'AW'],
          ['TW', 'TW'],
          ['TH', 'TH'],
          ['DE', 'DE'],
          ['BP', 'BP'],
        ]
          .map(
            ([k, g]) =>
              `<div class="row"><label><i class="l2dot" style="background:${L2K[k].c2}"></i>${L2K[k].n}</label><select style="width:200px" onchange="GR.l2.def('${k}',this.value)">${l2Opts(g, S.l2.defs[k])}</select></div>`,
          )
          .join('')
      : `<h4>Standardstärken (cm)</h4>` +
        ['AW', 'TW', 'TH', 'DE', 'BP', 'RD']
          .map((k) => {
            const c = (b.l2 && b.l2.c && b.l2.c[k]) || L2DC[k];
            return `<div class="row"><label><i class="l2dot" style="background:${L2K[k].c2}"></i>${L2K[k].n}</label><input type="number" step="0.5" min="5" max="80" value="${c}" style="width:80px" onchange="GR.l2.dc('${k}',this.value)"></div>`;
          })
          .join(''));
  h +=
    `<h4>${esc(lv.name)} – ${es.length} Wände</h4>` +
    (es.length
      ? es
          .map((e) => {
            const on = T_ && T_.el.id === e.id;
            return `<div class="u ${on ? 'on' : ''}" onclick="GR.l2.pk('${e.id}')"><i style="background:${L2K[e.kind].c}"></i><span>${L2K[e.kind].n} <small class="mu">${l23() ? esc(e.T.nm) + (e.al ? ' · ' + L2AL[e.al] : '') : l2f(e.d * 100, 1) + ' cm'}</small></span><b>${l2f(e.len)} m</b></div>`;
          })
          .join('')
      : '<div class="mu">In diesem Geschoss gibt es noch keine Wände.</div>');
  h += `<div class="mu" style="margin-top:8px">Mit <b>Wand</b> (Linie) oder <b>Raum</b> (Rechteck) neue Wände setzen. Wand anklicken: ${l23() ? 'Typ und Ausrichtung' : 'Stärke'} in der Leiste über der Wand. ${l23() ? '' : 'Aufbau, Schichten und Fassade gibt es erst in LOD 300.'}</div>`;
  return h;
}
function l2Sum(G_, lvI) {
  const M = {};
  G_.els.forEach((e) => {
    if (lvI != null && e.li !== lvI) return;
    const m = M[e.T.id] || (M[e.T.id] = { T: e.T, kind: e.kind, n: 0, len: 0, A: 0, V: 0, fp: 0 });
    m.n++;
    m.len += e.len;
    m.A += e.A;
    m.V += e.V;
    m.fp += e.fp;
  });
  return M;
}
function l2PanelM(b) {
  if (!l2on())
    return `<h4>Mengen</h4><button class="full" onclick="lodSet(200)">LOD 200 einschalten</button>`;
  const G_ = l2Els(b),
    M = l2Sum(G_),
    rows = Object.values(M).sort((a, c) => (a.kind < c.kind ? -1 : 1));
  let h = `<h4>Mengen nach Bauteiltyp</h4><table class="l2t"><tr><th>Typ</th><th>Anz.</th><th>m / m²</th><th>m³</th></tr>`;
  let sw = 0,
    sd = 0,
    vw = 0,
    vd = 0,
    sr = 0,
    vr = 0;
  rows.forEach((r) => {
    const wall = r.kind === 'AW' || r.kind === 'TW' || r.kind === 'TH';
    if (r.kind === 'RD') {
      sr += r.A;
      vr += r.V;
    } else if (wall) {
      sw += r.A;
      vw += r.V;
    } else {
      sd += r.A;
      vd += r.V;
    }
    h += `<tr><td><i class="l2dot" style="background:${L2K[r.kind].c2}"></i>${esc(r.T.nm)}${l23() ? `<br><small class="mu">KG ${r.T.kg} · ${r.T.pre}</small>` : `<br><small class="mu">${l2f(r.T.d * 100, 1)} cm</small>`}</td><td>${r.n}</td><td>${wall ? l2f(r.len, 1) + ' m<br>' + l2f(r.A, 1) + ' m²' : l2f(r.A, 1) + ' m²'}</td><td>${l2f(r.V, 1)}</td></tr>`;
  });
  h += `</table><div class="row" style="margin-top:6px"><label>Wandfläche brutto</label><b>${l2f(sw, 1)} m²</b></div><div class="row"><label>Deckenfläche</label><b>${l2f(sd, 1)} m²</b></div>${sr ? `<div class="row"><label>Dachfläche</label><b>${l2f(sr, 1)} m²</b></div>` : ''}<div class="row"><label>Bauteilvolumen gesamt</label><b>${l2f(vw + vd + vr, 1)} m³</b></div>`;
  if (!l23())
    return (
      h +
      `<div class="mu" style="margin:8px 0">Brutto ohne Öffnungen. Aufbau, Kostengruppen je Schicht und Leistungsbereiche gibt es erst in LOD 300.</div>`
    );
  const KG = {};
  G_.els.forEach((e) =>
    e.T.layers.forEach((l) => {
      const k = KG[l.kg] || (KG[l.kg] = { v: 0, lb: l.lb });
      k.v += (e.kind === 'DE' || e.kind === 'BP' ? e.fp : e.A) * l.d;
    }),
  );
  const KN = {
    322: 'Flachgründung',
    331: 'Tragende Außenwände',
    334: 'Außentüren/-fenster',
    335: 'Außenwandbekleidungen außen',
    336: 'Außenwandbekleidungen innen',
    341: 'Tragende Innenwände',
    342: 'Nichttragende Innenwände',
    351: 'Deckenkonstruktionen',
    361: 'Dachkonstruktionen',
    363: 'Dachbeläge',
    364: 'Dachbekleidungen',
  };
  h += `<h4>Nach Kostengruppe (DIN 276)</h4><table class="l2t"><tr><th>KG</th><th>m³ Schicht</th><th>LB</th></tr>${Object.keys(
    KG,
  )
    .sort()
    .map(
      (k) =>
        `<tr><td>${k} <small class="mu">${KN[k] || ''}</small></td><td>${l2f(KG[k].v, 1)}</td><td>${KG[k].lb}</td></tr>`,
    )
    .join('')}</table>`;
  h += `<div class="mu" style="margin:8px 0">Brutto ohne Öffnungen; Zuordnung KG und Leistungsbereich (LB) als Entwurf, vor Verwendung prüfen. IFC-Abbildung je Typ: IfcWall / IfcSlab mit PredefinedType.</div>`;
  return h;
}
// grChrome(): Erweiterung zusammengeführt, siehe 15-grundriss/100-kopf.js
GR.l2 = {
  cnm: (m) => {
    grEdit((b) => {
      b.l2 = b.l2 || {};
      b.l2.cn = { m: m, o: {} };
      b._l2 = null;
    });
    S.l2.bsig = '';
    GRS.dirty = 1;
  },
  cm: (v) => {
    const T_ = l2Target();
    if (T_)
      l2cSetC(
        T_.b,
        T_.el,
        v,
        S.l2.all && T_.el.kind !== 'DE' && T_.el.kind !== 'BP' && T_.el.kind !== 'RD' ? 'kind' : 'one',
        T_.G,
      );
    S.l2.pick = 0;
    S.l2.bsig = '';
    GRS.dirty = 1;
  },
  dc: (k, v) => l2cSetDefC(k, v),
  pick: () => {
    S.l2.pick = S.l2.pick ? 0 : 1;
    S.l2.bsig = '';
    GRS.dirty = 1;
  },
  set: (id) => {
    const T_ = l2Target();
    if (T_) l2SetType(T_.el, id, S.l2.all);
  },
  tgAll: () => {
    S.l2.all = S.l2.all ? 0 : 1;
    S.l2.bsig = '';
    l2Bar(true);
    const pk = GRS.doc.getElementById('l2pk');
    if (pk) pk.dataset.s = '';
  },
  al: (a) => {
    const T_ = l2Target();
    if (T_ && T_.el.gid) l2SetAl(T_.el.gid, a);
  },
  def: (k, id) => l2SetDef(k, id),
  pk: (id) => {
    const b = grB(),
      e = b && l2Els(b).els.find((x) => x.id === id);
    if (!e) return;
    S.l2.sel = id;
    S.l2.fl = e.li;
    GRS.sel = e.gid && e.kind !== 'AW' ? { k: 'c', g: e.gid } : null;
    GRS.dirty = 1;
    GRS.ps = '';
  },
};
// ---- Durchspielen: kurze geführte Vorführung im echten Modell (stellt am Ende den Ausgangszustand wieder her)
function l2Cap(t) {
  const d = GRS.doc,
    cw = gD('grCw');
  if (!d || !cw) return;
  l2Doc();
  let c = d.getElementById('l2cap');
  if (!t) {
    if (c) c.remove();
    return;
  }
  if (!c) {
    c = d.createElement('div');
    c.id = 'l2cap';
    c.style.cssText =
      'position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:8;padding:9px 18px;border-radius:16px;background:rgba(29,29,27,.86);color:#fff;font:600 13px Manrope,Montserrat,system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.28);transition:opacity .25s;pointer-events:none;max-width:70%;text-align:center';
    cw.appendChild(c);
  }
  c.style.opacity = 0;
  c.textContent = t;
  requestAnimationFrame(() => {
    c.style.opacity = 1;
  });
}
async function l2Demo() {
  if (S.l2.demo) {
    S.l2.demo = 0;
    return;
  }
  const b = grB();
  if (!b || b._y == null) {
    return;
  }
  const id = ++S.l2.dn;
  S.l2.demo = id;
  const W = (ms) => new Promise((r) => setTimeout(r, ms)),
    ok = () => S.l2.demo === id;

  let addedG = null;
  const T0 = l2on();
  try {
    GRS.tab = 'w';
    GRS.tool = 'sel';
    GRS.sel = null;
    S.l2.sel = null;
    GRS.lv = String(ugN(b));
    grTick(true);
    if (T0) lodSet(100);
    await W(300);
    l2Cap('Ausgangslage: Baukörper mit Einheiten – LOD 100');
    await W(1800);
    if (!ok()) throw 0;
    lodSet(200);
    l2Cap('LOD 200 einschalten: Wände und Decken entstehen aus Umriss, Schnitten und Flächenarten');
    await W(2600);
    if (!ok()) throw 0;
    let G_ = l2Els(b),
      lv = grLv(b),
      aw = G_.els.find((e) => e.li === lv.i && e.kind === 'AW');
    if (aw) {
      S.l2.sel = aw.id;
      GRS.sel = null;
      GRS.dirty = 1;
      GRS.ps = '';
      l2Cap('Außenwand: baut sich immer von der Kubatur nach innen auf');
      await W(2400);
      if (!ok()) throw 0;
    }
    let tw = G_.els.find(
      (e) => e.li === lv.i && e.kind !== 'AW' && e.quads && e.gid && !(lv.faces.length < 2),
    );
    if (!tw) {
      const xs = lv.bs.map((q) => q[0]),
        zs = lv.bs.map((q) => q[1]),
        cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        cz = (Math.min(...zs) + Math.max(...zs)) / 2,
        wx = Math.max(...xs) - Math.min(...xs);
      l2Cap('Neue Wand setzen: einfach eine Linie ziehen – Typ „Trennwand“ ist vorbelegt');
      const g0 = grGid(lv.obj.cuts || []);
      GRS.tool = 'line';
      grAddCuts([[cx, Math.min(...zs) - 1, cx, Math.max(...zs) + 1]]);
      addedG = g0;
      await W(2600);
      if (!ok()) throw 0;
      G_ = l2Els(b);
      lv = grLv(b);
      tw = G_.els.find((e) => e.li === lv.i && e.gid === g0 && e.kind !== 'AW');
    }
    if (tw) {
      const g = tw.gid,
        al0 = l2Data(lv).al[g] || 'm';
      GRS.tool = 'sel';
      for (const [a, t] of [
        ['l', 'Ausrichtung links der Zeichenlinie'],
        ['r', 'Ausrichtung rechts der Zeichenlinie'],
        ['m', 'Ausrichtung mittig auf der Zeichenlinie'],
      ]) {
        S.l2.sel = null;
        GRS.sel = { k: 'c', g };
        l2SetAl(g, a);
        l2Cap(t);
        await W(1700);
        if (!ok()) throw 0;
      }
      if (al0 !== 'm') l2SetAl(g, al0);
      G_ = l2Els(b);
      lv = grLv(b);
      tw = G_.els.find((e) => e.li === lv.i && e.gid === g && e.kind !== 'AW') || tw;
      const T1 = tw.T.id,
        alt =
          L2T.find((t) => t.grp === tw.T.grp && t.id !== T1 && !t.std && t.tr) ||
          L2T.find((t) => t.grp === tw.T.grp && t.id !== T1);
      if (alt) {
        l2Cap('Typ ändern: Kategorie ▸ Funktion ▸ Bauweise ▸ Typ – mit KG nach DIN 276');
        l2SetType(tw, alt.id, 0);
        await W(2400);
        if (!ok()) throw 0;
        G_ = l2Els(b);
        tw = G_.els.find((e) => e.li === lv.i && e.gid === g && e.kind !== 'AW') || tw;
        l2SetType(tw, T1, 0);
        await W(900);
      }
    }
    GRS.tab = 'm';
    GRS.ps = '';
    GRS.dirty = 1;
    l2Cap('Mengen je Bauteiltyp und Kostengruppe fallen automatisch an');
    await W(3000);
    if (!ok()) throw 0;
    l2Cap('Fertig – alles bleibt im gemeinsamen Modell');
    await W(1500);
  } catch (e) {
    if (e) console.warn('Demo', e);
  }
  if (addedG != null) {
    try {
      const lv = grLv(grB());
      const has = (lv.obj.cuts || []).some((c) => c[4] === addedG);
      if (has) {
        GRS.sel = { k: 'c', g: addedG };
        GR.delSel();
      }
    } catch (e) {
      logErr(e, 'l2Demo');
    }
  }
  S.l2.sel = null;
  GRS.sel = null;
  GRS.tool = 'sel';
  GRS.tab = 'w';
  GRS.ps = '';
  GRS.dirty = 1;
  l2Cap('');
  if (S.l2.demo === id) S.l2.demo = 0;
  if (!T0) lodSet(100);
  try {
    grTick(true);
  } catch (e) {
    logErr(e, 'l2Demo');
  }
}
S.l2.dn = 0;
GR.l2.demo = l2Demo;

// grEdges(): Erweiterung zusammengeführt, siehe 15-grundriss/110-ausrichtung.js
GR.l2.wc = (v) => {
  S.l2.wc = v;
  GRS.dirty = 1;
  GRS.ps = '';
};
