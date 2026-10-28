// ---- Kopf, Geschossleiste, Panel
function grChrome(b) {
  // ── Erweiterung aus 22-lod200-waende/050-panel.js
  const r = (() => {
    const d = GRS.doc;
    if (!d) return;
    const sel = gD('grBld');
    if (sel) {
      sel.innerHTML = S.bld
        .filter((x) => !x.ex)
        .map(
          (x) =>
            `<option value="${esc(x.id)}" ${x.id === GRS.bid ? 'selected' : ''}>${esc(x.name || x.id)}</option>`,
        )
        .join('');
    }
    const shE = gD('grSh');
    if (shE && d.activeElement !== shE) shE.value = S.gro.sh;
    ['sel', 'line', 'rect'].forEach((t) => {
      const e = gD('grT_' + t);
      e && e.classList.toggle('on', GRS.tool === t);
    });
    const lvE = gD('grLv');
    if (lvE) {
      if (!b) lvE.innerHTML = '<span class="mu">Kein Gebäude</span>';
      else {
        const L = grData(b);
        lvE.innerHTML = L.slice()
          .reverse()
          .map(
            (lv) =>
              `<button class="${lv.key === GRS.lv ? 'on' : ''}" onclick="GR.lv('${lv.key}')" title="${esc(lv.name)} · ${esc(lv.use)} · Höhe ${f1(lv.h, 2)} m"><b>${esc(lv.name)}</b><small>${f1(lv.area, 0)} m² · ${lv.faces.length} Einh.</small></button>`,
          )
          .join('');
      }
    }
    const tb = gD('grTabs');
    if (tb)
      tb.innerHTML = GRTABS.map(
        ([k, n]) => `<button class="${GRS.tab === k ? 'on' : ''}" onclick="GR.tab('${k}')">${n}</button>`,
      ).join('');
    try {
      d.title = 'maad – Grundriss · ' + (b ? b.name || b.id : '');
    } catch (e) {
      logErr(e, 'grChrome');
    }
    const pn = gD('grPnl');
    if (pn) {
      const ae = d.activeElement;
      if (
        ae &&
        pn.contains(ae) &&
        ((ae.tagName === 'INPUT' && ae.type !== 'checkbox' && ae.type !== 'range') || ae.tagName === 'SELECT')
      )
        return;
      pn.innerHTML = b ? grPanel(b) : '<span class="mu">Kein Gebäude vorhanden.</span>';
    }
  })();
  try {
    const d = GRS.doc;
    if (d) {
      const on = l2on(),
        ln = gD('grT_line'),
        rc = gD('grT_rect');
      if (ln) ln.textContent = on ? 'Wand' : 'Linie';
      if (rc) rc.textContent = on ? 'Raum' : 'Rechteck';
      if (rc && !gD('grT_trim')) {
        const tbn = d.createElement('button');
        tbn.id = 'grT_trim';
        tbn.textContent = 'Stutzen';
        tbn.title = 'Stutzen / Dehnen wie in AutoCAD (Wand anklicken)';
        tbn.onclick = () => GR.tool('trim');
        rc.parentNode.insertBefore(tbn, rc.nextSibling);
      }
      {
        const tb2 = gD('grT_trim');
        if (tb2) tb2.style.display = on ? '' : 'none';
      }
      let sw = d.getElementById('grL2');
      const tb = ln && ln.parentNode;
      if (!sw && tb) {
        l2Doc();
        sw = d.createElement('button');
        sw.id = 'grL2';
        sw.className = 'l2sw';
        sw.onclick = () => {
          lodSet(S.lod === 200 ? 100 : 200);
        };
        const gw = tb.querySelector('.grow');
        gw ? tb.insertBefore(sw, gw) : tb.appendChild(sw);
      }
      let s3 = d.getElementById('grL3');
      if (!s3 && tb) {
        s3 = d.createElement('button');
        s3.id = 'grL3';
        s3.className = 'l2sw';
        s3.onclick = () => {
          lodSet(S.lod === 300 ? 100 : 300);
        };
        sw.parentNode.insertBefore(s3, sw.nextSibling);
      }
      if (s3) {
        s3.className = 'l2sw' + (S.lod === 300 ? ' on' : '');
        s3.textContent = S.lod === 300 ? 'LOD 300 ●' : 'LOD 300';
        s3.title = 'Wandaufbau mit Schichten und Eckanschlüssen im Grundriss';
      }
      if (sw) {
        sw.className = 'l2sw' + (S.lod === 200 ? ' on' : '');
        sw.textContent = S.lod === 200 ? 'LOD 200 ●' : 'LOD 200';
        sw.title = 'Wände und Decken ein-/ausblenden (LOD-Leiste im Hauptfenster)';
      }
    }
  } catch (e) {
    console.warn(e);
  }
  return r;
}
const grFmt = (v) => f1(v, 1);
function grLabelTxt(lv, f) {
  const o = S.gro.lab,
    fa = grFA(f.fa) || grDefFa(lv.use),
    L = [];
  if (o.nr) L.push(lv.sn + '.' + f.idx);
  if (o.nm) L.push(f.n || fa.n);
  if (o.fa && !(o.nm && !f.n)) L.push(fa.n);
  if (o.dn) L.push(fa.d);
  if (o.us) L.push(fa.u);
  if (o.ar) L.push(grFmt(f.a) + ' m²');
  // ── Erweiterung aus 22-lod200-waende/070-nettogeschossflaeche.js (danach)
  if (l2on() && S.gro.lab.ar) {
    try {
      const b = grB(),
        n = l2NetFace(b, lv, f),
        i = L.length - 1;
      if (/m²$/.test(L[i])) L[i] = grFmt(n) + ' m² netto';
    } catch (e) {
      logErr(e, 'grLabelTxt');
    }
  }
  return L;
}
function grPanel(b) {
  // ── Erweiterung aus 24-erweiterungen-v344-v436/110-gebaeudemetriken.js
  const h = (() => {
    // ── Erweiterung aus 22-lod200-waende/050-panel.js
    const t = GRS.tab;
    if (t === 'w') return l2PanelW(b);
    if (t === 'm') return l2PanelM(b);
    return (() => {
      const lv = grLv(b),
        t = GRS.tab;
      let h = '';
      if (t === 'u') {
        const sel = GRS.sel;
        h += `<h4>${esc(lv.name)} – ${lv.faces.length} Einheiten · ${grFmt(lv.area)} m²</h4>`;
        h +=
          lv.faces
            .map((f, i) => {
              const fa = grFA(f.fa) || grDefFa(lv.use),
                on = (sel && sel.k === 'u' && sel.i === i) || GRS.msel.includes(i);
              return `<div class="u ${on ? 'on' : ''}" onclick="GR.selU(${i},event)"><i style="background:${fa.c}"></i><span>${esc(f.n || fa.n)} <small class="mu">${esc(lv.sn)}.${f.idx}</small></span><b>${grFmt(f.a)} m²</b></div>`;
            })
            .join('') || '<div class="mu">Keine Fläche (Schnitthöhe zu hoch?)</div>';
        if (GRS.msel.length >= 2) {
          const ms = GRS.msel.map((i) => lv.faces[i]).filter(Boolean),
            sm = ms.reduce((t, f) => t + f.a, 0);
          h += `<h4>${ms.length} Einheiten gewählt</h4><div class="row"><label>Summe</label><b>${grFmt(sm)} m²</b></div><button class="full" onclick="GR.merge()" title="Entfernt die Trennlinien zwischen den gewählten Einheiten. Die größte Einheit gibt Name und Flächenart vor.">Zusammenfügen</button><div class="mu">Shift/Strg + Klick fügt Einheiten zur Auswahl hinzu oder nimmt sie heraus. Die größte gewählte Einheit behält Name und Flächenart.</div>`;
        } else if (sel && sel.k === 'u' && lv.faces[sel.i]) {
          const f = lv.faces[sel.i],
            fa = grFA(f.fa) || grDefFa(lv.use);
          h += `<h4>Einheit ${esc(lv.sn)}.${f.idx}</h4><div class="row"><label>Name</label><input type="text" style="width:170px" value="${esc(f.n)}" placeholder="${esc(fa.n)}" onchange="GR.setN(this.value)"></div>
<div class="row"><label>Flächenart</label><select style="width:170px" onchange="GR.setFa(this.value)">${grFaOpts(fa.k)}</select></div>
<div class="row mu"><label>Nutzung</label><span>${esc(fa.u)}</span></div><div class="row mu"><label>DIN 277</label><span>${esc(GRDIN[fa.d] || fa.d)}</span></div>
<div class="row"><label>Fläche</label><b>${grFmt(f.a)} m²</b></div><div class="row mu"><label>anrechenbar (${fa.f} %)</label><span>${grFmt((f.a * fa.f) / 100)} m²</span></div>`;
          h += `<div class="chips" style="margin-top:6px">${S.fa.map((x) => `<span class="chip" style="background:${x.c}" onclick="GR.setFa('${x.k}')">${esc(x.n)}</span>`).join('')}</div>`;
        } else if (sel && sel.k === 'c') {
          const cs = (lv.obj.cuts || []).filter((c) => c[4] === sel.g),
            len = grCutLen(lv, sel.g);
          const gp = grGrp(lv, sel.g),
            ln = (c) => Math.hypot(c[2] - c[0], c[3] - c[1]),
            ip = (fn, v) =>
              `<input type="text" inputmode="decimal" style="width:74px;text-align:right" value="${f1(v, 2)}" onchange="${fn}"> m`;
          h += `<h4>${gp.rect ? 'Rechteck' : gp.loop ? 'Geschlossene Fläche' : 'Schnittlinie'}</h4>`;
          if (gp.rect) {
            const u = ln([...gp.ring[0], ...gp.ring[1]]),
              w = ln([...gp.ring[1], ...gp.ring[2]]);
            h += `<div class="row"><label>Länge</label>${ip('GR.rectSz(0,this.value)', u)}</div><div class="row"><label>Breite</label>${ip('GR.rectSz(1,this.value)', w)}</div><div class="row"><label>Fläche</label><b>${f1(u * w, 2)} m²</b></div>`;
          } else if (gp.sg.length <= 10)
            h += gp.sg
              .map(
                (c, i) =>
                  `<div class="row"><label>Segment ${i + 1}</label>${ip('GR.segLen(' + i + ',this.value)', ln(c))}</div>`,
              )
              .join('');
          else h += `<div class="row"><label>${cs.length} Segmente</label><b>${f1(len, 2)} m</b></div>`;
          h += `<div class="mu" style="margin:6px 0">Quadrate = Ecken ziehen · Kante ziehen = parallel verschieben · Kreis = ganze Form verschieben. Fang und Spurlinien wie beim Zeichnen (Shift = Spur festhalten, Esc = abbrechen).</div><button class="full" onclick="GR.delSel()">Löschen (Entf)</button>`;
        } else
          h += `<div class="mu" style="margin-top:8px">Einheit anklicken, um Name und Flächenart zu setzen. Mit <b>Linie</b> und <b>Rechteck</b> die Fläche in Einheiten schneiden.</div>`;
        h += `<h4>Geschosse</h4><button class="full" onclick="GR.copyAll()" title="Alle Linien/Rechtecke dieses Geschosses mit Flächenarten auf jedes andere Geschoss übertragen">Schnitte auf alle Geschosse übertragen</button><button class="full" onclick="GR.clearCuts()">Alle Schnitte dieses Geschosses entfernen</button><button class="full" onclick="GR.png()" title="Zeichenfläche als PNG mit transparentem Hintergrund">Geschoss als PNG speichern</button>`;
      } else if (t === 'b') {
        const R = grBil(b),
          tot = R.tot || 1;
        h += `<h4>Nach Flächenart</h4><table><tr><th>Flächenart</th><th>Anz.</th><th>m²</th><th>anrechenb.</th></tr>${S.fa
          .filter((f) => R.fa[f.k])
          .map(
            (f) =>
              `<tr><td><span class="chip" style="background:${f.c};padding:0 6px">${esc(f.n)}</span></td><td>${R.fa[f.k].n}</td><td>${grFmt(R.fa[f.k].a)}</td><td>${grFmt(R.fa[f.k].r)}</td></tr>`,
          )
          .join('')}<tr><th>Summe</th><th></th><th>${grFmt(R.tot)}</th><th>${grFmt(R.anr)}</th></tr></table>`;
        h += `<h4>Nach Geschoss</h4><table><tr><th>Geschoss</th><th>Einh.</th><th>m²</th></tr>${R.lv
          .slice()
          .reverse()
          .map((l) => `<tr><td>${esc(l.name)}</td><td>${l.n}</td><td>${grFmt(l.a)}</td></tr>`)
          .join('')}</table>`;
        h += `<h4>Nach DIN 277</h4><table>${Object.keys(R.din)
          .map(
            (k) =>
              `<tr><td>${esc(GRDIN[k] || k)}</td><td>${grFmt(R.din[k].a)}</td><td>${f1((R.din[k].a / tot) * 100, 0)} %</td></tr>`,
          )
          .join('')}</table>`;
        h += `<h4>Nach Nutzung</h4><table>${USES.filter((u) => R.use[u])
          .map(
            (u) =>
              `<tr><td><span class="chip" style="background:${S.uses[u]};padding:0 6px">${esc(u)}</span></td><td>${grFmt(R.use[u].a)}</td><td>${f1((R.use[u].a / tot) * 100, 0)} %</td></tr>`,
          )
          .join('')}</table>`;
        h += `<div class="mu" style="margin-top:6px">Flächen = Rohfläche im Schnitt (Wanddicken nicht abgezogen).</div><button class="full" onclick="GR.csv()">Flächenliste als CSV speichern</button>`;
      } else if (t === 'f') {
        h += grFaHtml();
      } else {
        const g = S.gro,
          o = g.lab,
          ck = (k, v, t) =>
            `<div class="row"><input type="checkbox" ${v ? 'checked' : ''} onchange="${k}"><label>${t}</label></div>`;
        h += `<h4>Beschriftung</h4>${ck("GR.lab('nr',this.checked)", o.nr, 'Nummer (z. B. EG.1)')}${ck("GR.lab('nm',this.checked)", o.nm, 'Name / Flächenart')}${ck("GR.lab('fa',this.checked)", o.fa, 'Flächenart (z. B. 3-Zimmer-Wohnung)')}${ck("GR.lab('dn',this.checked)", o.dn, 'DIN 277: NUF / VF / TF')}${ck("GR.lab('us',this.checked)", o.us, 'Nutzung')}${ck("GR.lab('ar',this.checked)", o.ar, 'Fläche in m²')}${ck("GR.opt('dim',this.checked)", g.dim, 'Maße an den Außenkanten')}
<div class="row"><label>Textgröße</label><input type="number" min="8" max="24" step="1" value="${g.fs}" style="width:60px" onchange="GR.opt('fs',+this.value)"> px</div>
<h4>Ansicht</h4>${ck("GR.opt('ctx',this.checked)", g.ctx, 'Umgebung (Grundstück, Nachbarn) durchscheinend')}<div class="row"><label>Deckkraft Umgebung</label><input type="range" min="0.05" max="0.8" step="0.05" value="${g.ctxO}" oninput="GR.opt('ctxO',+this.value)"></div>${ck("GR.opt('below',this.checked)", g.below, 'Geschoss darunter als Umriss zeigen')}
<h4>Zeichnen</h4>${ck('GR.north()', g.al, 'Grundriss an längster Seite ausrichten (Nordpfeil)')}${ck("GR.opt('trk',this.checked)", g.trk, 'Objektfang mit Spurlinien (waagerecht, senkrecht, 45°, rechtwinklig zur Wand)')}${ck("GR.opt('gs',this.checked)", g.gs, 'Raster-Fang 5 cm')}<div class="mu">Shift beim Zeichnen = Linie auf der nächsten Spurlinie festhalten. Rechtecke folgen der ausgerichteten Ansicht.</div>
<h4>3D-Modell</h4><div class="mu">Welche Geometrie das Gebäude zeigt (Flächen / Einheiten) und die Explosionsansicht stehen in der Ansichtsleiste unten: „Analyse ▾“.</div>
<div class="row"><label>Schnitthöhe (Dachgeschoss)</label><input type="number" step="0.05" min="0.3" max="3" value="${g.sh}" style="width:60px" onchange="GR.setSh(this.value)"> m</div>
<div class="row"><input type="checkbox" ${GRS.follow ? 'checked' : ''} onchange="GR.follow(this.checked)"><label>Fenster folgt der Gebäudeauswahl im Modell</label></div>`;
      }
      return h;
    })();
  })();
  if (GRS.tab === 'a') {
    try {
      return h + rasCard();
    } catch (e) {
      logErr(e, 'grPanel');
    }
  }
  return h;
}
function grFaHtml() {
  let h = '';
  h += `<h4>Nutzungen (Gebäude)</h4>${USES.map((u) => {
    let A = 0;
    S.bld.forEach((x) => {
      if (!x.ex) {
        const g = useAgg(x)[u];
        if (g) A += g.a;
      }
    });
    return `<div class="row"><input type="color" value="${S.uses[u]}" oninput="GR.useCol('${u}',this.value)" onchange="GR.dirty()" title="Farbe der Nutzung (auch im 3D-Modell)"><label>${u}</label><span class="mu">${f1(A, 0)} m² aktuell</span></div>`;
  }).join('')}
<h4>DIN 277 (Farben)</h4>${Object.keys(GRDIN)
    .map(
      (k) =>
        `<div class="row"><input type="color" value="${S.din[k]}" oninput="GR.dinSet('${k}',this.value,1)" onchange="GR.dinSet('${k}',this.value)" title="Farbe der DIN-277-Gruppe (Kreisdiagramm und Listen im Analysebereich)"><label>${esc(GRDIN[k])}</label></div>`,
    )
    .join('')}
<h4>Flächenarten</h4><div class="mu" style="margin-bottom:4px">Farbe · Name · Nutzung · DIN 277 · Anrechnung %</div>
${S.fa
  .map(
    (f, i) =>
      `<div class="fa"><input type="color" value="${f.c}" oninput="GR.faSet(${i},'c',this.value,1)" onchange="GR.faSet(${i},'c',this.value)"><input type="text" value="${esc(f.n)}" onchange="GR.faSet(${i},'n',this.value)"><select onchange="GR.faSet(${i},'u',this.value)">${USES.map((u) => `<option ${f.u === u ? 'selected' : ''}>${u}</option>`).join('')}</select><select onchange="GR.faSet(${i},'d',this.value)">${Object.keys(
        GRDIN,
      )
        .map((k) => `<option value="${k}" ${f.d === k ? 'selected' : ''}>${k}</option>`)
        .join(
          '',
        )}</select><input type="number" min="0" max="100" step="5" value="${f.f}" onchange="GR.faSet(${i},'f',this.value)"><button title="Flächenart entfernen" onclick="GR.faDel(${i})">✕</button></div>`,
  )
  .join('')}
<button class="full" onclick="GR.faAdd()">+ Flächenart hinzufügen</button><button class="full" onclick="GR.faReset()">Standardliste wiederherstellen</button>
<div class="mu" style="margin-top:6px">Die Flächenart bestimmt Farbe, Nutzung und Anrechnung der Einheit in Grundriss, Bilanz und 3D.</div>`;
  return h;
}
function grFaOpts(cur) {
  return USES.map(
    (u) =>
      `<optgroup label="${u}">${S.fa
        .filter((f) => f.u === u)
        .map((f) => `<option value="${f.k}" ${f.k === cur ? 'selected' : ''}>${esc(f.n)}</option>`)
        .join('')}</optgroup>`,
  ).join('');
}
