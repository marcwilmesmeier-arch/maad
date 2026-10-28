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
  [
    ['fdTs', 'sel'],
    ['fdTl', 'line'],
    ['fdTr', 'rect'],
    ['fdTg', 'st'],
  ].forEach(([id, t]) => {
    const e = fdE(id);
    if (e) e.classList.toggle('on', FDS.tool === t);
  });
  const R = fdStats(b),
    vs = fdE('fdVs');
  if (vs) {
    vs.innerHTML =
      `<button class="${FDS.vk === '*' ? 'on' : ''}" onclick="fdView('*')">Abwicklung<small>alle ${V.length} Seiten</small></button>` +
      V.map((v) => {
        const fa = fdFaces(b, v),
          n = fa.length;
        return `<button class="${FDS.vk === v.key ? 'on' : ''}" onclick="fdView('${v.key}')">${esc(v.name.replace('Ansicht ', ''))}<small>${fdFmt(v.area)} m² · ${n} ${n === 1 ? 'Feld' : 'Felder'}</small></button>`;
      }).join('');
  }
  const inf = fdE('fdInfo');
  if (inf) inf.textContent = (b.name || b.id) + (cur ? ' · ' + cur.name : '');
  const pn = fdE('fdPn');
  if (!pn || (pn.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)))
    return;
  const tf = new Set(FDS.sel.map((i) => F[i] && F[i].t).filter(Boolean)),
    one = FDS.sel.length === 1 && F[FDS.sel[0]] ? F[FDS.sel[0]] : null;
  let h = '';
  h += `<h4>Fassadentyp ${cur ? (FDS.sel.length ? 'für ' + FDS.sel.length + (FDS.sel.length === 1 ? ' Feld' : ' Felder') : '(Feld wählen)') : ''}</h4>`;
  if (FDS.mng) {
    h +=
      S.ft
        .map(
          (t, i) =>
            `<div class="fe"><input type="color" value="${t.c}" onchange="fdTypeSet(${i},'c',this.value)"><input type="text" style="flex:1" value="${esc(t.n)}" onchange="fdTypeSet(${i},'n',this.value)">${t.df ? '' : `<button onclick="fdTypeDel(${i})" title="Typ löschen (Felder werden zu „ohne Typ“)">×</button>`}</div>`,
        )
        .join('') +
      `<button onclick="fdTypeAdd()">+ Neuer Typ</button> <button onclick="FDS.mng=false;FDS.ps='';fdTick(true)">Fertig</button>`;
  } else {
    h +=
      S.ft
        .map((t) => {
          const a = R.t[t.k];
          return `<div class="ft${tf.has(t.k) ? ' on' : ''}" onclick="fdSetType('${t.k}')" title="Auf gewählte Felder anwenden"><i style="background:${t.c}"></i><span>${esc(t.n)}</span><b>${a ? fdFmt(a.a) + ' m²' : ''}</b></div>`;
        })
        .join('') +
      `<button style="margin-top:6px" onclick="FDS.mng=true;FDS.ps='';fdTick(true)">Typen bearbeiten …</button>`;
  }
  if (cur) {
    h +=
      `<h4>Felder · ${esc(cur.name)}</h4>` +
      F.map(
        (f, i) =>
          `<div class="ft${FDS.sel.includes(i) ? ' on' : ''}" onclick="fdSelFace(${i},event)"><i style="background:${fdT(f.t).c}"></i><span>${esc(f.n || 'F' + f.idx)} <span class="mu">${esc(fdT(f.t).n)}</span></span><b>${fdFmt(f.a)} m²</b></div>`,
      ).join('');
    if (one)
      h += `<div class="fe" style="margin-top:6px"><span class="mu">Name</span><input type="text" style="flex:1" value="${esc(one.n)}" placeholder="F${one.idx}" onchange="fdRename(this.value)"></div>`;
    h += `<div style="margin-top:6px"><button onclick="fdClearView()" title="Alle Schnittlinien und Typen dieser Ansicht entfernen">Ansicht zurücksetzen</button></div>`;
  }
  h +=
    `<h4>Bilanz Fassade · ${esc(b.name || b.id)}</h4>` +
    S.ft
      .filter((t) => R.t[t.k])
      .map(
        (t) =>
          `<div class="ft" style="cursor:default"><i style="background:${t.c}"></i><span>${esc(t.n)} <span class="mu">${R.t[t.k].n}×</span></span><b>${fdFmt(R.t[t.k].a)} m²</b></div>`,
      )
      .join('') +
    `<div class="ft sum" style="cursor:default"><span>Ansichtsflächen gesamt</span><b>${fdFmt(R.tot)} m²</b></div>`;
  try {
    const k = bM(b);
    h += `<div class="mu" style="margin-top:4px">Fassadenfläche laut Modell: ${fdFmt(k.fas)} m²${Math.abs(k.fas - R.tot) > 0.5 ? ' (Abweichung durch verdeckte Flächen, Flächenpatches/schräge Wände)' : ''}</div>`;
  } catch (e) {
    logErr(e, 'fdChrome');
  }
  pn.innerHTML = h;
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
  const b = fdB();
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
