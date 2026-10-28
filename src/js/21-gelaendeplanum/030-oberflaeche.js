// ---- Oberfläche
function plmMsg(t) {
  const e = document.getElementById('plmMsg');
  if (e) e.textContent = t || '';
}
const plmCur = () => PLM.a.find((a) => a.id === PLM.sel);
const plmNHN = (z) => z + (GEO.e0 != null ? GEO.e0 : 0);
function plmInfo() {
  const e = document.getElementById('plmInfo'),
    a = plmCur();
  if (!e || !a) return;
  const s = plmStats(a),
    A = area(a.poly);
  e.innerHTML = `Fläche ${f1(A)} m² · Bestand ${f1(plmNHN(s.tn), 2)} … ${f1(plmNHN(s.tx), 2)} m (Ø ${f1(plmNHN(s.avg), 2)})<br>Auftrag <b style="color:#7d3c12">${f1(s.fill)} m³</b> · Aushub <b style="color:#17537d">${f1(s.cut)} m³</b> · Saldo ${f1(s.fill - s.cut)} m³`;
  const r = document.getElementById('plmZr');
  if (r) {
    r.min = Math.floor((s.tn - 4) * 10) / 10;
    r.max = Math.ceil((s.tx + 4) * 10) / 10;
  }
}
function plmUi() {
  const e = document.getElementById('plmP');
  if (!e) return;
  const a = plmCur();
  let h = `<div style="display:flex;align-items:center;gap:6px"><b style="flex:1">Geländeplanum</b><button class="sm" onclick="plmClose()">✕</button></div>
 <div style="margin:6px 0 4px;font-size:11px;opacity:.75">Neue Planumsfläche aus:</div>
 <div style="display:flex;flex-wrap:wrap;gap:4px"><button class="sm" onclick="plmDraw('rect')">▭ Rechteck zeichnen</button><button class="sm" onclick="plmDraw('free')">⬠ Polygon zeichnen</button><button class="sm" onclick="plmSrc('site')">Grundstück</button><button class="sm" onclick="plmSrc('area')">gewählte Fläche</button></div>
 <div id="plmMsg" style="font-size:11px;margin:5px 0;min-height:14px;opacity:.8"></div>`;
  if (PLM.a.length)
    h += `<div style="display:flex;flex-direction:column;gap:3px;margin:4px 0">${PLM.a.map((q) => `<div style="display:flex;gap:6px;align-items:center;padding:3px 6px;border:1px solid var(--ln);border-radius:6px;cursor:pointer;${q.id === PLM.sel ? 'background:#5E7F9222;border-color:#5E7F92' : ''}" onclick="plmSel('${q.id}')"><input type="checkbox" ${q.on !== false ? 'checked' : ''} onclick="event.stopPropagation();plmOn('${q.id}',this.checked)" title="ein/aus"><span style="flex:1">${esc(q.name)}</span><small>${plmNHN(q.z).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</small></div>`).join('')}</div>`;
  if (a) {
    const s = plmStats(a);
    h += `<hr style="border:0;border-top:1px solid var(--ln);margin:6px 0">Name <input type="text" value="${esc(a.name)}" style="width:100%" onchange="plmSet('name',this.value)">
  <div style="margin-top:6px"><b>Höhe Planum</b> (m${GEO.e0 != null ? ' ü. NHN' : ' relativ'})</div>
  <div style="display:flex;gap:6px;align-items:center"><input type="number" id="plmZ" step="0.05" value="${Math.round(plmNHN(a.z) * 100) / 100}" style="width:92px" onchange="plmSetZ(+this.value-${GEO.e0 != null ? GEO.e0 : 0},1)"><input type="range" id="plmZr" step="0.05" min="${Math.floor((s.tn - 4) * 10) / 10}" max="${Math.ceil((s.tx + 4) * 10) / 10}" value="${a.z}" style="flex:1" oninput="plmSetZ(+this.value,0)"></div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"><button class="sm" onclick="plmAvgZ()">Ø Bestand</button><button class="sm" onclick="plmBal()" title="Höhe so wählen, dass Aushub = Auftrag">Massenausgleich</button><button class="sm" onclick="plmZd(-.1)">−10 cm</button><button class="sm" onclick="plmZd(.1)">+10 cm</button></div>
  <div id="plmInfo" style="font-size:11.5px;margin:6px 0"></div>
  <div style="font-size:11px;opacity:.75">Böschungsneigung und Stützmauer je Seite: Beschriftung an der jeweiligen Kante der Fläche anklicken.</div>
  <div style="margin-top:8px"><b>Darstellung</b></div>
  <label style="display:block"><input type="checkbox" ${PLM.hatch ? 'checked' : ''} onchange="PLM.hatch=this.checked"> Böschungsschraffur</label>
  <label style="display:flex;align-items:center;gap:6px">Schraffurfarbe <input type="color" value="${PLM.cf}" oninput="PLM.cf=this.value"></label>
  <label style="display:flex;align-items:center;gap:6px">Mauerfarbe <input type="color" value="${PLM.cw}" oninput="PLM.cw=this.value"></label>
  <label style="display:block">Schraffurabstand <input type="number" step="0.25" min="0.25" max="5" value="${PLM.hs}" style="width:56px" onchange="PLM.hs=Math.max(.25,+this.value||1)"> m</label>
  <div style="margin-top:8px"><button class="sm" onclick="plmDel()">Planum löschen</button></div>`;
  }
  e.innerHTML = h;
  if (a) plmInfo();
}
function plmOpen() {
  let e = document.getElementById('plmP');
  if (!e) {
    e = document.createElement('div');
    e.id = 'plmP';
    e.className = 'fl';
    e.style.cssText =
      'position:fixed;right:14px;top:84px;width:330px;max-height:calc(100vh - 120px);overflow:auto;padding:10px 12px;z-index:30;font-size:12.5px';
    document.body.appendChild(e);
  }
  e.style.display = 'block';
  PLM.open = true;
  plmUi();
  plmTick(1);
}
function plmClose() {
  const e = document.getElementById('plmP');
  if (e) e.style.display = 'none';
  PLM.open = false;
  PLM.wait = false;
}
function plmSel(id) {
  PLM.sel = id;
  plmPopClose();
  plmUi();
  plmTick(1);
}
function plmOn(id, v) {
  const a = PLM.a.find((q) => q.id === id);
  if (a) {
    a.on = v;
    plmSync();
    PLM.sg = '';
  }
}
function plmSet(k, v) {
  const a = plmCur();
  if (a) {
    a[k] = v;
  }
}
function plmSetZ(v, ui) {
  const a = plmCur();
  if (!a || !isFinite(v)) return;
  a.z = Math.round(v * 1000) / 1000;
  const z = document.getElementById('plmZ');
  if (z && !ui) z.value = Math.round(plmNHN(a.z) * 100) / 100;
  const r = document.getElementById('plmZr');
  if (r && ui) r.value = a.z;
}
function plmZd(d) {
  const a = plmCur();
  if (!a) return;
  plmSetZ(a.z + d, 1);
  plmUi();
}
function plmAvgZ() {
  const a = plmCur();
  if (!a) return;
  a.z = Math.round(plmAvg(a.poly).avg * 100) / 100;
  plmUi();
}
function plmBal() {
  const a = plmCur();
  if (!a) return;
  plmMsg('Berechne Massenausgleich …');
  setTimeout(() => {
    plmBalance(a);
    plmUi();
    plmMsg('Höhe für Massenausgleich gesetzt.');
  }, 20);
}
function plmDel() {
  const a = plmCur();
  if (!a) return;
  PLM.a = PLM.a.filter((q) => q !== a);
  PLM.sel = PLM.a.length ? PLM.a[PLM.a.length - 1].id : null;
  plmSync();
  PLM.sg = '';
  plmTick(1);
  plmUi();
}

// ---- Mauern (3D): zusammenhängende Mauerzüge mit Gehrung an den Ecken (wie LOD200-Außenwände)
function plmWalls() {
  try {
    if (PLM.wg) {
      G.terrain.remove(PLM.wg);
      PLM.wg.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      PLM.wg = null;
    }
    const P = [],
      I = [],
      quad = (a, b, c, d) => {
        const n = P.length / 3;
        P.push(...a, ...b, ...c, ...d);
        I.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      },
      th = 0.6;
    for (const a of PLM.a) {
      if (a.on === false) continue;
      const L = a.poly.length,
        all = a.w.every(Boolean);
      if (!a.w.some(Boolean)) continue;
      const miter = (i0, i1) => {
        const Pt = a.poly[i1],
          N1 = a.nr[i0],
          N2 = a.nr[i1],
          d = Math.max(0.3, 1 + N1[0] * N2[0] + N1[1] * N2[1]);
        return [Pt[0] + ((N1[0] + N2[0]) / d) * th, Pt[1] + ((N1[1] + N2[1]) / d) * th];
      };
      const H = (ix, iz, ox, oz) => {
        const dx = ox - ix,
          dz = oz - iz,
          l = Math.hypot(dx, dz) || 1,
          T = GHf(ox + (dx / l) * 0.7, oz + (dz / l) * 0.7);
        return { top: Math.max(a.z, T), bot: Math.min(a.z, T) - 1, ok: Math.abs(a.z - T) > 0.04 };
      };
      const starts = [];
      if (all) starts.push(0);
      else for (let i = 0; i < L; i++) if (a.w[i] && !a.w[(i + L - 1) % L]) starts.push(i);
      for (const s0 of starts) {
        const chain = [];
        let i = s0;
        do {
          chain.push(i);
          i = (i + 1) % L;
        } while (a.w[i] && i !== s0 && chain.length < L);
        const closed = all;
        // Eckpunkte des Mauerzugs: Innen = Polygonpunkt, Außen = Gehrung bzw. senkrechter Abschluss
        const nodes = [];
        for (let k = 0; k <= chain.length; k++) {
          const vi = (chain[0] + k) % L,
            Pt = a.poly[vi];
          let o;
          if (k === 0)
            o = closed ? miter((vi + L - 1) % L, vi) : [Pt[0] + a.nr[vi][0] * th, Pt[1] + a.nr[vi][1] * th];
          else if (k === chain.length)
            o = closed
              ? nodes[0].o
              : [Pt[0] + a.nr[(vi + L - 1) % L][0] * th, Pt[1] + a.nr[(vi + L - 1) % L][1] * th];
          else o = miter((vi + L - 1) % L, vi);
          nodes.push({ i: [Pt[0], Pt[1]], o });
        }
        for (let k = 0; k < chain.length; k++) {
          const e = chain[k],
            N = a.nr[e],
            n0 = nodes[k],
            n1 = nodes[k + 1],
            len = Math.hypot(n1.i[0] - n0.i[0], n1.i[1] - n0.i[1]),
            ns = Math.max(1, Math.ceil(len / 0.5)),
            rows = [];
          for (let q = 0; q <= ns; q++) {
            const t = q / ns,
              ix = n0.i[0] + (n1.i[0] - n0.i[0]) * t,
              iz = n0.i[1] + (n1.i[1] - n0.i[1]) * t,
              o = q === 0 ? n0.o : q === ns ? n1.o : [ix + N[0] * th, iz + N[1] * th],
              h = H(ix, iz, o[0], o[1]);
            rows.push({ i: [ix, iz], o, top: h.top, bot: h.bot, ok: h.ok });
          }
          for (let q = 0; q < ns; q++) {
            const r0 = rows[q],
              r1 = rows[q + 1];
            if (!r0.ok && !r1.ok) continue;
            quad(
              [r0.o[0], r0.top, r0.o[1]],
              [r0.o[0], r0.bot, r0.o[1]],
              [r1.o[0], r1.top, r1.o[1]],
              [r1.o[0], r1.bot, r1.o[1]],
            );
            quad(
              [r0.i[0], r0.top, r0.i[1]],
              [r0.i[0], r0.bot, r0.i[1]],
              [r1.i[0], r1.top, r1.i[1]],
              [r1.i[0], r1.bot, r1.i[1]],
            );
            quad(
              [r0.i[0], r0.top, r0.i[1]],
              [r0.o[0], r0.top, r0.o[1]],
              [r1.i[0], r1.top, r1.i[1]],
              [r1.o[0], r1.top, r1.o[1]],
            );
          }
          if (!closed) {
            const cap = (r) => {
              if (r.ok)
                quad(
                  [r.i[0], r.top, r.i[1]],
                  [r.i[0], r.bot, r.i[1]],
                  [r.o[0], r.top, r.o[1]],
                  [r.o[0], r.bot, r.o[1]],
                );
            };
            if (k === 0) cap(rows[0]);
            if (k === chain.length - 1) cap(rows[ns]);
          }
        }
      }
    }
    if (!P.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
    g.setIndex(I);
    g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshLambertMaterial({ color: PLM.cw, side: T.DoubleSide }));
    m.castShadow = true;
    m.receiveShadow = true;
    m.raycast = () => {};
    PLM.wg = new T.Group();
    PLM.wg.add(m);
    G.terrain.add(PLM.wg);
  } catch (e) {
    console.error('plmWalls', e);
  }
}
