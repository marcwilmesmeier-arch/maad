// ---- Explosionsansicht
function tgExp() {
  S.expl.on = S.expl.on ? 0 : 1;
  $('bex').classList.toggle('on', !!S.expl.on);
  const e = $('exp');
  e.style.display = S.expl.on ? 'flex' : 'none';
  e.innerHTML = `<span>Explosion</span><input type="range" min="1" max="15" step="0.5" value="${S.expl.gap}" oninput="exGap(+this.value)"><b id="exv">${f1(S.expl.gap, 1)} m</b>`;
  exAnim();
  // ── Erweiterung aus 15-grundriss/070-saubere-umrisse.js (danach)
  try {
    abstPaint();
    recomp();
  } catch (e) {
    logErr(e, 'tgExp');
  }

  // ── Erweiterung aus 18-erweiterungen-v280-v325/150-explosionsansicht.js (danach)
  try {
    const r = document.querySelector('#exp input[type=range]');
    if (r)
      r.title = 'Bei Einheiten (Gebäudemetriken): die letzten 20 % ziehen die Einheiten seitlich auseinander';
  } catch (e) {
    logErr(e, 'tgExp');
  }
}
function exGap(v) {
  S.expl.gap = v;
  $('exv').textContent = f1(v, 1) + ' m';
  if (S.expl.on) exAnim();
  // ── Erweiterung aus 18-erweiterungen-v280-v325/150-explosionsansicht.js (danach)
  try {
    const e = $('exv');
    if (e && S.zo.m === 'u' && exSpreadKRaw(v) > EXS.a) e.textContent += ' · Einheiten auseinander';
  } catch (e) {
    logErr(e, 'exGap');
  }
}
let exRaf = 0;
function exAnim() {
  if (exRaf) return;
  let t0 = performance.now();
  const st = () => {
    const now = performance.now(),
      dt = Math.min(0.25, (now - t0) / 1000);
    t0 = now;
    const t = S.expl.on ? S.expl.gap : 0,
      d = t - S.expl.cur;
    if (Math.abs(d) < 0.01) {
      S.expl.cur = t;
      exRaf = 0;
      exApply();
      return;
    }
    S.expl.cur += d * (1 - Math.exp(-dt * 9));
    exApply();
    exRaf = requestAnimationFrame(st);
  };
  exRaf = requestAnimationFrame(st);
}
const exP = () => {
  const g = S.expl.gap || 1,
    p = Math.max(0, Math.min(1, S.expl.cur / g));
  return {
    v: typeof l23 === 'function' && l23() ? Math.min(1, p / 0.7) : 1,
    h: typeof l23 === 'function' && l23() ? Math.max(0, (p - 0.7) / 0.3) : 0,
  };
};
const exOff = (b, k) => ((k === 'dg' || k === 'roof' ? b.levels.length : +k) - ugN(b)) * S.expl.cur * exP().v;
// Teile des Gebäudes den Geschossen zuordnen (Meshes tragen userData.k; Konturlinien folgen ihrem Mesh)
function exTag(b) {
  if (!b._g) return [];
  if (b._gt && b._gt.id === b._g.id) return b._gt.l;
  const l = [];
  let cur = 0;
  b._g.children.forEach((o) => {
    if (o.isMesh && o.userData.k != null && !o.userData.roof) cur = o.userData.k;
    else if (o.userData.roof) cur = 'roof';
    l.push({ o, k: cur, y: o.position.y, e: !!o.userData.kont, p: o.userData.pi != null });
  });
  b._gt = { id: b._g.id, l };
  return l;
}
function exApply() {
  S.bld.forEach((b) => {
    if (b.ex || !b._g) return;
    try {
      exTag(b).forEach((t) => {
        t.o.position.y = t.y + exOff(b, t.k);
      });
    } catch (e) {
      logErr(e, 'exApply>anonym');
    }
  });
  G.un.children.forEach((g) => {
    const b = S.bld.find((x) => x.id === g.userData.bid);
    if (!b) return;
    g.children.forEach((lg) => {
      if (lg.userData.k != null) lg.position.y = exOff(b, lg.userData.k);
    });
  });
  if (S.hlG) {
    S.hlG.visible = S.zo.m !== 'u';
    S.hlG.children.forEach((m) => {
      if (m.userData.k == null) return;
      const b = S.bld.find((x) => x.id === m.userData.bid);
      if (b) m.position.y = m.userData.y0 + exOff(b, m.userData.k);
    });
  }
  try {
    zoIsoApply();
  } catch (e) {
    logErr(e, 'exApply');
  }
  // ── Erweiterung aus 18-erweiterungen-v280-v325/150-explosionsansicht.js (danach)
  try {
    exSpread();
  } catch (e) {
    console.warn('Einheiten auseinander', e);
  }

  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js (danach)
  try {
    for (const it of L2I.values()) {
      const b = S.bld.find((z) => z.id === it.el.bid);
      if (b)
        it.g.position.y =
          it.el.y0 +
          exOff(b, it.el.kind === 'DE' ? it.el.li + 1 : it.el.li) +
          (it.el.kind === 'RD' ? S.expl.cur * exP().v : 0);
      /* LOD300: letzte 30 % der Explosion – Außenwände (und Giebel) rücken nach außen von der Geschossdecke weg */
      let ox = 0,
        oz = 0;
      const hh = exP().h;
      if (hh > 0 && it.el.kind === 'AW' && l23()) {
        const e = it.el;
        let n = null,
          pt = null;
        if (e.gb) {
          n = [e.gb.nx, e.gb.nz];
          pt = e.gb.t && e.gb.t[0] && [e.gb.t[0][0][0], e.gb.t[0][0][2]];
        } else if (e.es && e.es[0].n) {
          n = [-e.es[0].n[0], -e.es[0].n[1]];
          pt = e.p;
        }
        if (n && pt) {
          const GE = l2Els(b),
            cc =
              GE._exC ||
              (GE._exC = (() => {
                let sx = 0,
                  sz = 0,
                  c = 0;
                GE.els.forEach((q) => {
                  if (q.kind === 'AW' && q.p) {
                    sx += q.p[0];
                    sz += q.p[1];
                    c++;
                  }
                });
                return c ? [sx / c, sz / c] : [0, 0];
              })());
          if (n[0] * (pt[0] - cc[0]) + n[1] * (pt[1] - cc[1]) < 0) {
            n = [-n[0], -n[1]];
          }
          const nl = it.el.T.layers.length,
            u = hh * Math.max(0.5, S.expl.gap * 0.12);
          it.g.children.forEach((ch) => {
            const ly = ch.userData.ly;
            if (ly == null || ly < 0) return;
            const d = u * (ly + 1) * (nl > 1 ? 1 : 1);
            ch.position.x = n[0] * d;
            ch.position.z = n[1] * d;
          });
          ox = null;
        }
      }
      if (ox === 0)
        it.g.children.forEach((ch) => {
          if (ch.userData.ly != null) {
            ch.position.x = 0;
            ch.position.z = 0;
          }
        });
    }
  } catch (e) {
    logErr(e, 'exApply');
  }

  // ── Erweiterung aus 22-lod200-waende/060-stutzen-dehnen.js (danach)
  try {
    const c = S.expl ? +S.expl.cur.toFixed(2) : 0;
    if (c !== exLastE) {
      exLastE = c;
      updSel2();
    }
  } catch (e) {
    logErr(e, 'exApply');
  }

  // ── Erweiterung aus 22-lod200-waende/080-isolieren-aus-der-gebaeudemetrik-in.js (danach)
  try {
    G.l2n.children.forEach((m) => {
      const b = S.bld.find((z) => z.id === m.userData.bid);
      if (b) m.position.y = m.userData.y0 + exOff(b, m.userData.li);
    });
  } catch (e) {
    logErr(e, 'exApply');
  }
}
// Hervorhebung (hlG) folgt der Explosion und bekommt bei weißer Auswahl eine weiße Kontur
function lvOfY(b, y) {
  let z = b._y;
  for (let i = 0; i < b.levels.length; i++) {
    z += b.levels[i].h;
    if (y < z + 1e-6) return i;
  }
  return 'roof';
}
function zoHlTag(g, b, n0) {
  const ch = g.children.slice(n0),
    top = b._y + b._h;
  ch.forEach((m) => {
    if (!m.isMesh) return;
    let k = m.userData.k;
    if (k == null) {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox,
        yc = (bb.min.y + bb.max.y) / 2 + m.position.y;
      k = yc >= top - 0.02 ? 'roof' : lvOfY(b, yc);
    }
    m.userData.k = k;
    m.userData.bid = b.id;
    m.userData.y0 = m.position.y;
  });
}

// ---- Darstellung je Analysebereich: Gebäude = eine Farbe · Flächen = Geschosse mit Nutzungsfarben · Einheiten = nur Einheitenkörper
function zoCl(b, t) {
  const k = t.k;
  if (k === 'roof') return S.uses[roofUse(b)];
  if (t.p) return S.uses[b.use || 'Wohnen'];
  const l = b.levels[k];
  return S.uses[(l && l.use) || b.use || 'Wohnen'];
}
function zoPaint(b) {
  if (S.zo.m === 'u') return;
  const m = S.zo.m;
  exTag(b).forEach((t) => {
    if (t.e || !t.o.material || !t.o.material.color) return;
    const c = m === 'b' ? S.zo.bc : zoCl(b, t),
      cc = new T.Color(c);
    if (!t.o.material.color.equals(cc)) {
      t.o.material.color.copy(cc);
      t.cc = c;
    }
  });
}
function exOne(b) {
  exTag(b).forEach((t) => {
    t.o.position.y = t.y + exOff(b, t.k);
  });
}
// wird von mesh(b) sofort nach dem Neuaufbau gerufen – kein Moment, in dem Hülle und Einheitenkörper gleichzeitig sichtbar sind
