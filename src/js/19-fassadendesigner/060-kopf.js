// ---- Kopf, Ansichtsleiste, Seitenleiste
function fdTick(force) {
  if (!FDS.open) return;
  const b = fdB();
  if (!b) {
    fdClose();
    return;
  }
  const V = fdViews(b);
  if (!V.length) {
    fdClose();
    return;
  }
  if (FDS.vk !== '*' && !V.some((v) => v.key === FDS.vk)) {
    FDS.vk = V[0].key;
    FDS.sel = [];
  }
  const cur = FDS.vk === '*' ? null : fdVw(b, FDS.vk),
    F = cur ? fdFaces(b, cur) : [];
  const ps = JSON.stringify([
    fdSig(b),
    b.fd || 0,
    FDS.vk,
    FDS.sel,
    FDS.selCut,
    FDS.tool,
    FDS.mng,
    S.ft,
    S.oet,
    FDS.oe,
    FDS.oeT,
    S.oeg,
    FDS.gi,
    FDS.grT,
    FDS.grAu,
    b.fk || 0,
    S.bld.map((x) => x.id + x.name),
  ]);
  if (force || ps !== FDS.ps) {
    FDS.ps = ps;
    FDS.dirty = 1;
    fdChrome(b, V, cur, F);
  }
  if (FDS.dirty || (FDS.note && Date.now() < FDS.note.u + 300)) {
    FDS.dirty = 0;
    fdCvDraw();
  }
}
function fdChrome(b, V, cur, F) {
  const d = fdE('fdDock');
  if (!d) return;
  const sel = fdE('fdBld');
  if (sel && document.activeElement !== sel)
    sel.innerHTML = S.bld
      .filter((x) => !x.ex)
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${x.id === FDS.bid ? 'selected' : ''}>${esc(x.name || x.id)}</option>`,
      )
      .join('');
  const teil = FDS.tool === 'line' || FDS.tool === 'rect' || FDS.tool === 'st';
  [
    ['fdTs', FDS.tool === 'sel'],
    ['fdTt', teil],
    ['fdTo', FDS.tool === 'oe'],
    ['fdTu', FDS.tool === 'gr'],
  ].forEach(([id, on]) => {
    const e = fdE(id);
    if (e) e.classList.toggle('on', on);
  });
  // Ansichten als Reiter
  const vs = fdE('fdVs');
  if (vs)
    vs.innerHTML =
      `<button class="${FDS.vk === '*' ? 'on' : ''}" onclick="fdView('*')" title="Alle ${V.length} Seiten nebeneinander">Abwicklung</button>` +
      V.map(
        (v) =>
          `<button class="${FDS.vk === v.key ? 'on' : ''}" onclick="fdView('${v.key}')" title="${esc(v.name)} · ${fdFmt(v.area)} m²">${esc(v.name.replace('Ansicht ', ''))}</button>`,
      ).join('');
  // Optionsleiste über der Zeichnung (je Werkzeug)
  const op = fdE('fdOpt');
  if (op && !(op.contains(document.activeElement) && /SELECT|INPUT/.test(document.activeElement.tagName))) {
    let h = '';
    if (teil)
      h = `<span class="mu">Teilen</span><div class="seg">${[
        ['line', 'Linie', 'L'],
        ['rect', 'Rechteck', 'R'],
        ['st', 'Geschoss', ''],
      ]
        .map(
          ([k, n, kb]) =>
            `<button class="${FDS.tool === k ? 'on' : ''}" onclick="fdTool('${k}')" title="${n}${kb ? ' (' + kb + ')' : ''}">${n}</button>`,
        )
        .join('')}</div>`;
    else if (FDS.tool === 'oe') {
      if (!FDS.oeT || !S.oet.some((x) => x.k === FDS.oeT)) FDS.oeT = S.oet[0].k;
      h = `<span class="mu">Setzen</span><select onchange="oeTypWahl(this.value)">${S.oet.map((x) => `<option value="${x.k}" ${x.k === FDS.oeT ? 'selected' : ''}>${esc(x.n)} · ${fdFmt(x.b)} × ${fdFmt(x.h)}</option>`).join('')}</select><button class="bt" onclick="okOpen(FDS.oeT,'oe')">Konfigurator …</button>`;
    } else if (FDS.tool === 'gr') {
      if (!FDS.grT || !oegG(FDS.grT)) FDS.grT = S.oeg.length ? S.oeg[0].k : null;
      h = `<span class="mu">Setzen</span><select onchange="oegWahl(this.value)">${S.oeg.map((G) => `<option value="${G.k}" ${G.k === FDS.grT ? 'selected' : ''}>${esc(G.n)} · ${fdFmt(G.l)} m</option>`).join('')}</select><div class="seg" title="Ausrichtung der Gruppen auf dieser Seite (Füllen und Gebäudekonfigurator)">${[
        ['l', '⇤ links'],
        ['m', '↔ mittig'],
        ['r', '⇥ rechts'],
      ]
        .map(
          ([k, n]) =>
            `<button class="${oegAusr(b, cur) === k ? 'on' : ''}" onclick="oegAusrSetzen('${k}')">${n}</button>`,
        )
        .join(
          '',
        )}</div>${FDS.sel.length ? '<button class="bt pri" onclick="oegFuellen()">Gewählte Felder füllen</button>' : ''}<button class="bt" onclick="okOpen(null,'gr')">Konfigurator …</button>`;
    }
    if (op.innerHTML !== h) op.innerHTML = h;
  }
  // Fußleiste: Kennwerte der Ansicht
  const inf = fdE('fdInfo');
  if (inf) {
    if (cur) {
      const L = oeListe(b, cur),
        a = L.reduce((s, x) => s + x.T.b * x.T.h, 0);
      inf.textContent = `${cur.name.replace('Ansicht ', '')} · ${fdFmt(cur.area)} m² · ${L.length} Öffnung${L.length === 1 ? '' : 'en'} · Fensteranteil ${Math.round((a / (cur.area || 1)) * 100)} %`;
    } else inf.textContent = (b.name || b.id) + ' · ' + V.length + ' Ansichten';
  }
  const pn = fdE('fdPn');
  if (!pn || (pn.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)))
    return;
  pn.innerHTML = fdInspektor(b, V, cur, F);
}
/** Inhalt des Inspektors: genau das, was gewählt ist bzw. zum aktiven Werkzeug gehört. */
function fdInspektor(b, V, cur, F) {
  const R = fdStats(b);
  if (FDS.mng)
    return (
      `<h4>Fassadentypen bearbeiten</h4>` +
      S.ft
        .map(
          (t, i) =>
            `<div class="fe"><input type="color" value="${t.c}" onchange="fdTypeSet(${i},'c',this.value)"><input type="text" style="flex:1" value="${esc(t.n)}" onchange="fdTypeSet(${i},'n',this.value)">${t.df ? '' : `<button class="ib" onclick="fdTypeDel(${i})" title="Typ löschen (Felder werden zu „ohne Typ“)">${fdIcon('x')}</button>`}</div>`,
        )
        .join('') +
      `<div class="row"><button class="bt" onclick="fdTypeAdd()">+ Neuer Typ</button><button class="bt pri" onclick="FDS.mng=false;FDS.ps='';fdTick(true)">Fertig</button></div>`
    );
  if (cur && FDS.gi) return oegInspektorHtml(b, cur);
  if (cur && FDS.oe) return oeInspektorHtml(b, cur);
  if (cur && FDS.selCut != null)
    return `<h4>Trennlinie</h4><div class="mu">An den blauen Griffen ziehen, um sie zu verschieben.</div><div class="row"><button class="bt" onclick="fdDelSel()">Löschen <kbd>Entf</kbd></button></div>`;
  const swatches = (tf) =>
    `<div class="sws">${S.ft
      .map(
        (t) =>
          `<div class="sw${tf.has(t.k) ? ' on' : ''}" onclick="fdSetType('${t.k}')" title="${esc(t.n)}${R.t[t.k] ? ' · ' + fdFmt(R.t[t.k].a) + ' m²' : ''}"><i style="background:${t.c}"></i><span>${esc(t.n.replace(/ \(.*\)/, ''))}</span></div>`,
      )
      .join(
        '',
      )}</div><div class="row"><button class="bt" onclick="FDS.mng=true;FDS.ps='';fdTick(true)">Typen bearbeiten …</button><button class="bt" onclick="L2CF.fd()" title="Wandaufbau der Außenwand im Bauteilkonfigurator">Wandaufbau …</button></div>`;
  if (FDS.tool === 'oe') return oeBibliothekHtml();
  if (FDS.tool === 'gr') return oegBibliothekHtml();
  if (cur && FDS.sel.length) {
    const S_ = FDS.sel.map((i) => F[i]).filter(Boolean),
      a = S_.reduce((s, f) => s + f.a, 0),
      one = S_.length === 1 ? S_[0] : null;
    let h = `<h4>${S_.length === 1 ? 'Feld ' + esc(one.n || 'F' + one.idx) : S_.length + ' Felder'} · ${fdFmt(a)} m²</h4>`;
    if (one)
      h += `<div class="fe"><input type="text" style="flex:1" value="${esc(one.n)}" placeholder="Name (F${one.idx})" onchange="fdRename(this.value)"></div>`;
    h += `<h4>Fassadentyp</h4>${swatches(new Set(S_.map((f) => f.t)))}`;
    h += `<h4>Aktionen</h4><div class="row">${S_.length > 1 ? '<button class="bt" onclick="fdMerge()">Zusammenlegen</button>' : ''}<button class="bt" onclick="fdTool('gr')" title="Gruppe wählen und die Felder je Geschoss damit füllen">Mit Gruppe füllen …</button></div><div class="mu" style="margin-top:8px">Umschalt + Klick: weitere Felder · <kbd>Esc</kbd> Auswahl aufheben</div>`;
    return h;
  }
  if (FDS.tool === 'line' || FDS.tool === 'rect' || FDS.tool === 'st')
    return `<h4>Teilen</h4><div class="leer">${
      FDS.tool === 'line'
        ? 'Punkte setzen, mit <kbd>Enter</kbd> oder Rechtsklick beenden. Zurück auf den Startpunkt schließt eine Fläche.'
        : FDS.tool === 'rect'
          ? 'Rechteck aufziehen – ergibt ein eigenes Feld, z. B. für Sockel oder Fensterband.'
          : 'Auf eine Fläche klicken: das Geschoss dieser Flucht wird ein eigenes Feld.'
    }<br><br><kbd>Esc</kbd> zurück zu „Auswählen“</div>`;
  // Übersicht (nichts gewählt)
  let h = `<h4>Fassadentypen</h4>${swatches(new Set())}<div class="mu" style="margin-top:6px">Feld anklicken, dann Typ wählen.</div>`;
  h += `<h4>Öffnungen je Ansicht</h4><div class="kv">`;
  V.forEach((v) => {
    const L = oeListe(b, v),
      a = L.reduce((s, x) => s + x.T.b * x.T.h, 0);
    h += `<span>${esc(v.name.replace('Ansicht ', ''))}</span><b>${L.length ? L.length + ' · ' + Math.round((a / (v.area || 1)) * 100) + ' %' : '–'}</b>`;
  });
  h += `</div><h4>Flächen</h4><div class="kv">${S.ft
    .filter((t) => R.t[t.k])
    .map(
      (t) =>
        `<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${t.c};margin-right:6px"></i>${esc(t.n)}</span><b>${fdFmt(R.t[t.k].a)} m²</b>`,
    )
    .join('')}<span>Gesamt</span><b>${fdFmt(R.tot)} m²</b></div>`;
  if (cur)
    h += `<div class="row" style="margin-top:12px"><button class="bt" onclick="fdClearView()" title="Alle Schnittlinien und Typen dieser Ansicht entfernen (Öffnungen bleiben)">Ansicht zurücksetzen</button></div>`;
  return h;
}
function fdSelFace(i, e) {
  FDS.sel =
    e && e.shiftKey ? (FDS.sel.includes(i) ? FDS.sel.filter((q) => q !== i) : FDS.sel.concat(i)) : [i];
  FDS.selCut = null;
  FDS.ps = '';
  FDS.dirty = 1;
  fdTick(true);
}
function fdTypeSet(i, k, v) {
  const t = S.ft[i];
  if (!t) return;
  if (k === 'n' && !String(v).trim()) return;
  t[k] = v;
  FDS.ps = '';
  FDS.dirty = 1;
  try {
    rr();
  } catch (e) {
    logErr(e, 'fdTypeSet');
  }
  try {
    zoTick(true);
  } catch (e) {
    logErr(e, 'fdTypeSet');
  }
  fdTick(true);
}
function fdTypeAdd() {
  let n = 1;
  while (S.ft.some((t) => t.k === 'x' + n)) n++;
  S.ft.push({ k: 'x' + n, n: 'Neuer Fassadentyp', c: '#a3b8a0' });
  FDS.ps = '';
  fdTick(true);
}
function fdTypeDel(i) {
  const t = S.ft[i];
  if (!t || t.df) return;
  hist();
  S.bld.forEach((x) => {
    if (!x.fd) return;
    Object.values(x.fd).forEach((d) => {
      d.units.forEach((u) => {
        if (u.t === t.k) u.t = 'ohne';
      });
      d.units = d.units.filter((u) => u.t !== 'ohne' || u.n);
      x._fv && x._fv.V.forEach((v) => (v._f = null));
    });
  });
  S.ft.splice(i, 1);
  FDS.ps = '';
  fdTick(true);
  try {
    rr();
  } catch (e) {
    logErr(e, 'fdTypeDel');
  }
}

// baDo(): Erweiterung zusammengeführt, siehe 11-bearbeiten/020-bearbeiten.js
function fdRows(b) {
  try {
    const R = fdStats(b);
    if (!R.cust) return '';
    const on = (sp) =>
      ZI.key === JSON.stringify({ t: 'bld', bid: b.id, k: 'fdt', fd: sp, lab: 'Fassade' }) ? ' on' : '';
    let h = '';
    S.ft
      .filter((t) => R.t[t.k])
      .forEach((t) => {
        const sp = { t: t.k };
        h += `<div class="r sub k${on(sp)}" style="cursor:pointer" onclick='fdHl(${JSON.stringify(b.id)},${JSON.stringify(sp)})' title="Anklicken: nur diese Flächen im Modell aufleuchten lassen (nochmal klicken hebt auf)"><i style="background:${t.c}"></i><span>${esc(t.n)}</span><b>${f1(R.t[t.k].a, 1)} m²</b></div>`;
      });
    return h;
  } catch (e) {
    return '';
  }
}

// ---- Aufleuchten in der Gebäudemetrik: nur die Flächen eines Fassadentyps (oder ein einzelnes Feld) im Modell hervorheben
function fdClip(sub, clip) {
  let A = clip.slice();
  let ar = 0;
  for (let i = 0; i < A.length; i++) {
    const a = A[i],
      c = A[(i + 1) % A.length];
    ar += a[0] * c[1] - c[0] * a[1];
  }
  if (ar < 0) A.reverse();
  let out = sub;
  for (let i = 0; i < A.length && out.length; i++) {
    const a = A[i],
      c = A[(i + 1) % A.length],
      inp = out;
    out = [];
    const side = (q) => (c[0] - a[0]) * (q[1] - a[1]) - (c[1] - a[1]) * (q[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j],
        q = inp[(j + 1) % inp.length],
        sp = side(p),
        sq = side(q);
      if (sp >= -1e-9) out.push(p);
      if (sp >= -1e-9 !== sq >= -1e-9) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}
function fdHlMatch(spec, V, f) {
  if (spec.t != null) return f.t === spec.t;
  return V.key === spec.vk && f.idx === spec.idx;
}
function fdHlApply() {
  hlClear();
  const sp = ZI.sp && ZI.sp.fd;
  if (!sp) return;
  const mt = new T.MeshBasicMaterial({
      color: S.hlw ? 0xffffff : 0x5e7f92,
      transparent: true,
      opacity: 0.82,
      side: T.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
    g = new T.Group();
  const b = S.bld.find((x) => x.id === S.hlb && !x.ex);
  if (b && b._y != null) {
    const u = ugN(b);
    let ugH = 0;
    for (let i = 0; i < u; i++) ugH += b.levels[i].h;
    const base = b._y + ugH;
    fdViews(b).forEach((V) => {
      fdFaces(b, V).forEach((f) => {
        if (!fdHlMatch(sp, V, f)) return;
        const outer = f.o.map((q) => new T.Vector2(q[0], q[1])),
          holes = f.h.map((h) => h.map((q) => new T.Vector2(q[0], q[1]))),
          all = outer.concat(...holes),
          tr = T.ShapeUtils.triangulateShape(
            outer.map((v) => v.clone()),
            holes.map((h) => h.map((v) => v.clone())),
          );
        V.pcs.forEach((pc) => {
          const pos = [];
          for (const [i, j, k] of tr) {
            const poly = fdClip(
              [all[i], all[j], all[k]].map((v) => [v.x, v.y]),
              pc.ring,
            );
            if (poly.length < 3) continue;
            const P3 = poly.map((q) => {
              const s = (q[0] - pc.ua) / pc.dot;
              return [pc.ax + pc.dx * s + V.n[0] * 0.06, base + q[1], pc.az + pc.dz * s + V.n[1] * 0.06];
            });
            for (let m = 1; m < P3.length - 1; m++) pos.push(...P3[0], ...P3[m], ...P3[m + 1]);
          }
          if (!pos.length) return;
          const ge = new T.BufferGeometry();
          ge.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
          ge.computeVertexNormals();
          const m = new T.Mesh(ge, mt);
          m.userData.k = pc.lv;
          m.userData.bid = b.id;
          m.userData.y0 = 0;
          g.add(m);
        });
      });
    });
  }
  g.renderOrder = 9;
  g.visible = !(S.zo && S.zo.m === 'u');
  sc.add(g);
  S.hlG = g;
  try {
    exApply();
  } catch (e) {
    logErr(e, 'fdHlApply');
  }
}
// hlApply(): Erweiterung zusammengeführt, siehe 07-analyse/020-flaechen-rauminhalte.js
function fdHl(bid, spec) {
  const sp = { t: 'bld', bid, k: 'fdt', fd: spec, lab: 'Fassade' },
    key = JSON.stringify(sp);
  if (ZI.key === key) {
    zoIsoClear();
    return;
  }
  zoIsoClear(true);
  ZI.sp = sp;
  ZI.key = key;
  S.hlk = 'fdt';
  S.hlb = bid;
  S.hlw = 1;
  hlApply();
  zoIsoApply();
  zoRender();
  zoTick.k = zoSig();
}
