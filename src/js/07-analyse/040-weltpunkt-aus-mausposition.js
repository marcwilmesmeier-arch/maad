// ---- Weltpunkt aus Mausposition
function anPt(e, py) {
  if (S.m3 && py == null) {
    ray(e);
    const objs = [S.terr, G.nb, G.ex].filter(Boolean),
      h = rc.intersectObjects(objs, true)[0];
    if (h) return [h.point.x, h.point.y, h.point.z];
  }
  const y0 = py != null ? py : S.m3 ? gh(V.tx, V.tz) : 0,
    q = planePt(e, y0);
  return q ? [q[0], y0, q[1]] : null;
}
const anXY = (e) => {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};
function anTouch() {
  AN.rev++;
  vwSave();
  AN.key = '';
}
function anNew(k, p, x) {
  const o = {
    id: 'a' + Math.random().toString(36).slice(2, 8),
    k,
    p,
    c: AN.cur.c,
    w: AN.cur.w,
    d: AN.cur.d,
    f: AN.cur.f,
    ...x,
  };
  anOk().push(o);
  AN.sel = o.id;
  return o;
}
function anFinish() {
  const t = AN.tmp;
  AN.tmp = null;
  if (!t) return;
  const need = t.k === 'poly' ? 3 : 2;
  if (t.p.length >= need) {
    const o = anNew(t.k, t.p, { a0: t.a0 || 0, a1: t.a1 || 0 });
    anTouch();
    AN.tool = 'sel';
    anBarUpd();
  } else {
    AN.rev++;
  }
}
function anDelSel() {
  const v = anView();
  if (!v || !AN.sel) return;
  v.anns = (v.anns || []).filter((a) => a.id !== AN.sel);
  AN.sel = null;
  anTouch();
  anBarUpd();
}
(function () {
  const el = cv;
  const on = () => anOn() && AN.tool;
  el.addEventListener(
    'pointerdown',
    (e) => {
      if (!on() || e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const [x, y] = anXY(e),
        v = anView(),
        t = AN.tool;
      if (t === 'sel') {
        const hi = anHandle(x, y);
        if (hi >= 0) {
          const a = anOk().find((q) => q.id === AN.sel);
          AN.drag = { t: 'pt', a, i: hi, py: a.p[hi][1] };
          try {
            el.setPointerCapture(e.pointerId);
          } catch (e) {
            logErr(e, 'init>anonym');
          }
          return;
        }
        const a = anHit(x, y);
        AN.sel = a ? a.id : null;
        if (a) {
          const py = a.p[0][1],
            q = anPt(e, S.m3 ? py : 0);
          AN.drag = { t: 'mv', a, last: q, py: S.m3 ? py : 0, mv: 0 };
          try {
            el.setPointerCapture(e.pointerId);
          } catch (e) {
            logErr(e, 'init>anonym');
          }
        }
        AN.rev++;
        anBarUpd();
        return;
      }
      const q = anPt(e);
      if (!q) return;
      if (t === 'text') {
        const o = anNew('text', [q], { t: 'Text', s: AN.cur.ts, b: 0, bg: 0, fn: AN.cur.fn });
        anTouch();
        AN.tool = 'sel';
        anBarUpd();
        setTimeout(() => {
          const i = $('anTxt');
          if (i) {
            i.focus();
            i.select();
          }
        }, 30);
        return;
      }
      if (t === 'sym') {
        anNew('sym', [q], { sy: AN.sym, s: AN.cur.ss });
        anTouch();
        anBarUpd();
        return;
      }
      if (t === 'num') {
        anNew('num', [q], { t: String(AN.n++), s: AN.cur.ss });
        anTouch();
        anBarUpd();
        return;
      }
      if (t === 'rect' || t === 'ell') {
        if (!AN.tmp) AN.tmp = { k: t, p: [q], cur: q, f: AN.cur.f, c: AN.cur.c, w: AN.cur.w, d: AN.cur.d };
        else {
          AN.tmp.p.push(q);
          anFinish();
        }
        AN.rev++;
        return;
      }
      if (t === 'line' || t === 'arrow' || t === 'poly') {
        const k = t === 'poly' ? 'poly' : 'line';
        if (!AN.tmp)
          AN.tmp = {
            k,
            p: [q],
            cur: q,
            f: AN.cur.f,
            c: AN.cur.c,
            w: AN.cur.w,
            d: AN.cur.d,
            a0: AN.cur.a0,
            a1: t === 'arrow' ? 1 : AN.cur.a1,
          };
        else {
          const l = AN.tmp.p.at(-1);
          if (Math.hypot(l[0] - q[0], l[2] - q[2]) > 1e-6) AN.tmp.p.push(q);
          if (t === 'arrow' && AN.tmp.p.length >= 2) anFinish();
        }
        AN.rev++;
      }
    },
    true,
  );
  el.addEventListener(
    'pointermove',
    (e) => {
      if (!on()) return;
      const g = AN.drag;
      if (g) {
        e.stopImmediatePropagation();
        const q = anPt(e, g.py);
        if (!q) return;
        if (g.t === 'pt') {
          g.a.p[g.i] = [q[0], g.a.p[g.i][1], q[2]];
        } else if (g.last) {
          g.mv = 1;
          const dx = q[0] - g.last[0],
            dz = q[2] - g.last[2];
          g.a.p = g.a.p.map((p) => [p[0] + dx, p[1], p[2] + dz]);
          g.last = q;
        }
        AN.rev++;
        return;
      }
      if (AN.tmp) {
        e.stopImmediatePropagation();
        const q = anPt(e);
        if (q) {
          AN.tmp.cur = q;
          AN.rev++;
        }
      }
    },
    true,
  );
  el.addEventListener(
    'pointerup',
    (e) => {
      const g = AN.drag;
      if (!g) return;
      e.stopImmediatePropagation();
      AN.drag = null;
      anTouch();
      anBarUpd();
    },
    true,
  );
  el.addEventListener(
    'dblclick',
    (e) => {
      if (!on()) return;
      e.stopImmediatePropagation();
      if (AN.tmp) anFinish();
    },
    true,
  );
  el.addEventListener(
    'wheel',
    (e) => {
      if (camLocked()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    { capture: true, passive: false },
  );
  addEventListener(
    'keydown',
    (e) => {
      if (!on() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        if (AN.tmp) {
          AN.tmp = null;
          AN.rev++;
        } else if (AN.sel) {
          AN.sel = null;
          AN.rev++;
          anBarUpd();
        } else if (AN.tool !== 'sel') {
          AN.tool = 'sel';
          anBarUpd();
        } else {
          AN.tool = null;
          anBarUpd();
        }
      } else if (e.key === 'Enter') anFinish();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (AN.tmp && AN.tmp.p.length > 1) {
          AN.tmp.p.pop();
          AN.rev++;
        } else anDelSel();
      }
    },
    true,
  );
})();
// ---- Schloss / Maßstab
function anLock() {
  const v = anView();
  if (!v) return;
  if (!v.locked) {
    Object.assign(v, vwState());
    if (!v.m3) {
      const s0 = (1200 * V.d) / 180;
      v.sc = ANSC.reduce(
        (b, x) => (Math.abs(Math.log(x / s0)) < Math.abs(Math.log(b / s0)) ? x : b),
        ANSC[0],
      );
      v.d = (v.sc * 180) / 1200;
      V.d = v.d;
    } else v.sc = null;
    v.locked = true;
  } else v.locked = false;
  vwSave();
  anBarUpd();
  vwRenderIf();
  $('hud').textContent = v.locked
    ? `Ansicht „${v.name}“ fixiert` + (v.sc ? ` · Maßstab 1:${v.sc}` : ' · perspektivisch, kein Maßstab')
    : 'Ansicht gelöst';
}
function anScale(n) {
  const v = anView();
  if (!v || !v.locked || v.m3) return;
  v.sc = +n;
  v.d = (v.sc * 180) / 1200;
  V.d = v.d;
  vwSave();
  anBarUpd();
  vwRenderIf();
}
function vwRenderIf() {
  if ($('vwp').style.display === 'block') vwRender();
}
function anTool(t) {
  const v = anView();
  if (!v) return;
  if (!v.locked) anLock();
  AN.tool = t;
  AN.tmp = null;
  if (t !== 'sel') AN.sel = null;
  AN.rev++;
  anBarUpd();
}
function anClose() {
  S.vact = null;
  AN.tool = null;
  AN.sel = null;
  AN.tmp = null;
  AN.rev++;
  anBarUpd();
  $('hud').textContent = '';
}
function anSet(k, val) {
  const v = anView();
  if (!v) return;
  const a = AN.sel && anOk().find((q) => q.id === AN.sel);
  if (k === 'ts' || k === 'ss') {
    AN.cur[k] = val;
    if (a && ((k === 'ts' && a.k === 'text') || (k === 'ss' && (a.k === 'sym' || a.k === 'num')))) a.s = val;
  } else if (k === 'a0' || k === 'a1') {
    AN.cur[k] = val;
    if (a && a.k === 'line') a[k] = val;
  } else if (k === 'fn') {
    AN.cur.fn = val;
    if (a && a.k === 'text') a.fn = val;
  } else {
    AN.cur[k] = val;
    if (a) a[k] = val;
  }
  anTouch();
  anBarUpd();
}
function anProp(k, val) {
  const a = AN.sel && anOk().find((q) => q.id === AN.sel);
  if (!a) return;
  a[k] = val;
  anTouch();
}
function anSymSel(s) {
  AN.sym = s;
  const a = AN.sel && anOk().find((q) => q.id === AN.sel);
  if (a && a.k === 'sym') {
    a.sy = s;
    anTouch();
  }
  AN.tool = 'sym';
  anBarUpd();
}
function anBarUpd() {
  const b = $('anbar'),
    v = anView();
  document.body.classList.toggle('anOn', !!v);
  if (!v) {
    b.style.display = 'none';
    return;
  }
  b.style.display = 'block';
  const a = AN.sel && (v.anns || []).find((q) => q.id === AN.sel),
    cur = a ? { c: a.c, w: a.w, d: a.d, f: a.f, a0: a.a0, a1: a.a1 } : AN.cur,
    tl = [
      ['sel', 'Auswahl'],
      ['text', 'Text'],
      ['line', 'Linie'],
      ['arrow', 'Pfeil'],
      ['rect', 'Rechteck'],
      ['ell', 'Ellipse'],
      ['poly', 'Fläche'],
      ['sym', 'Symbol'],
      ['num', 'Nummer'],
    ];
  let h =
    `<div class="anr"><b>${esc(v.name)}</b><button class="sm" onclick="anLock()" title="Fixiert Ausschnitt und Ausrichtung (Maßstab bei 2D)">${v.locked ? '🔒 fixiert' : '🔓 fixieren'}</button>` +
    (v.locked && !v.m3
      ? `<select onchange="anScale(this.value)" title="Maßstab">${ANSC.map((n) => `<option value="${n}" ${v.sc === n ? 'selected' : ''}>1:${n}</option>`).join('')}</select>`
      : v.locked
        ? '<small>perspektivisch</small>'
        : '') +
    `<span class="anv"></span>` +
    tl
      .map(
        ([k, l]) => `<button class="sm${AN.tool === k ? ' on' : ''}" onclick="anTool('${k}')">${l}</button>`,
      )
      .join('') +
    `<button class="sm" onclick="anClose()" title="Ansicht verlassen">Fertig ✕</button></div>`;
  if (AN.tool || a) {
    h +=
      `<div class="anr">` +
      ANC.map(
        (c) =>
          `<i class="ans${cur.c === c ? ' on' : ''}" style="background:${c}" onclick="anSet('c','${c}')"></i>`,
      ).join('') +
      `<input type="color" value="${cur.c}" oninput="anSet('c',this.value)" title="Farbe" style="width:26px;height:22px;padding:0;border:0;background:none">` +
      `<label>Stärke <select onchange="anSet('w',+this.value)">${ANW.map((x) => `<option value="${x}" ${Math.abs(cur.w - x) < 1e-6 ? 'selected' : ''}>${String(x).replace('.', ',')} mm</option>`).join('')}</select></label>` +
      `<label>Stil <select onchange="anSet('d',this.value)">${ANST.map(([k, l]) => `<option value="${k}" ${cur.d === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` +
      `<label><input type="checkbox" ${cur.f ? 'checked' : ''} onchange="anSet('f',this.checked?1:0)"> Füllung</label>` +
      (AN.tool === 'line' || (a && a.k === 'line')
        ? `<label><input type="checkbox" ${cur.a0 ? 'checked' : ''} onchange="anSet('a0',this.checked?1:0)"> Pfeil Anfang</label><label><input type="checkbox" ${cur.a1 ? 'checked' : ''} onchange="anSet('a1',this.checked?1:0)"> Pfeil Ende</label>`
        : '') +
      (AN.tool === 'text' || (a && a.k === 'text')
        ? `<label>Schrift <input type="number" min="4" max="72" value="${a && a.k === 'text' ? a.s : AN.cur.ts}" onchange="anSet('ts',+this.value)" style="width:52px"> pt</label><label>Schrift <select onchange="anSet('fn',this.value)">${LFOPT.map(([k, n]) => `<option value="${k}" ${(a && a.k === 'text' ? a.fn || 'helv' : AN.cur.fn) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
        : '') +
      (AN.tool === 'sym' || AN.tool === 'num' || (a && (a.k === 'sym' || a.k === 'num'))
        ? `<label>Größe <input type="number" min="2" max="40" value="${a && (a.k === 'sym' || a.k === 'num') ? a.s : AN.cur.ss}" onchange="anSet('ss',+this.value)" style="width:52px"> mm</label>`
        : '') +
      `</div>`;
  }
  if (a && (a.k === 'text' || a.k === 'num'))
    h +=
      `<div class="anr"><textarea id="anTxt" rows="${a.k === 'text' ? 2 : 1}" oninput="anProp('t',this.value)" style="flex:1;min-width:200px">${esc(a.t || '')}</textarea>` +
      (a.k === 'text'
        ? `<label><input type="checkbox" ${a.b ? 'checked' : ''} onchange="anProp('b',this.checked?1:0)"> fett</label><label><input type="checkbox" ${a.bg ? 'checked' : ''} onchange="anProp('bg',this.checked?1:0)"> weißer Grund</label>`
        : '') +
      `</div>`;
  if (AN.tool === 'sym' || (a && a.k === 'sym'))
    h +=
      `<div class="anr">` +
      ANSY.map(
        ([k, l]) =>
          `<button class="sm${(a && a.k === 'sym' ? a.sy : AN.sym) === k ? ' on' : ''}" onclick="anSymSel('${k}')">${l}</button>`,
      ).join('') +
      `</div>`;
  if (a)
    h += `<div class="anr"><button class="sm" style="color:var(--wa)" onclick="anDelSel()">Auswahl löschen (Entf)</button><small>${v.anns.length} Anmerkungen · bleibt mit dem Modell verankert</small></div>`;
  b.innerHTML = h;
}
