// ---- Shader: Muster im 3D-Modell, Schraffur im Schnitt
const L2CU = { n: { value: L2CLIP.normal }, c: { value: 1e5 }, ax: { value: 1 } };
const L2GLSL = `float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`;
function l2mPatCode(pt, ps) {
  ps = (+ps || 0.5).toFixed(4);
  const uv = `vec3 wn=normalize(cross(dFdx(vWP),dFdy(vWP)));vec2 uv;if(abs(wn.y)>.7){uv=vWP.xz;}else{vec2 tt=normalize(vec2(-wn.z,wn.x));uv=vec2(dot(vWP.xz,tt),vWP.y);}vec3 c0=diffuseColor.rgb;float h=${ps};float fw=max(fwidth(uv.x),fwidth(uv.y));float aa=1.-smoothstep(h*.05,h*.18,fw);`;
  let b = '';
  if (pt === 'brick')
    b = `float row=floor(uv.y/h);float lx=uv.x/(h*3.)+mod(row,2.)*.5;vec2 f=vec2(fract(lx),fract(uv.y/h));float m=max(step(f.x,.035),step(f.y,.12));float j=.88+.24*h21(vec2(floor(lx),row));diffuseColor.rgb=mix(diffuseColor.rgb*j,vec3(.78,.76,.72),m);`;
  else if (pt === 'plank')
    b = `float cx=floor(uv.x/h);float f=fract(uv.x/h);float m=step(f,.05);diffuseColor.rgb=mix(diffuseColor.rgb*(.92+.16*h21(vec2(cx,3.))),diffuseColor.rgb*.55,m);`;
  else if (pt === 'hplank')
    b = `float cy=floor(uv.y/h);float f=fract(uv.y/h);float m=step(f,.06);diffuseColor.rgb=mix(diffuseColor.rgb*(.92+.16*h21(vec2(cy,5.))),diffuseColor.rgb*.55,m);`;
  else if (pt === 'panel')
    b = `vec2 f=vec2(fract(uv.x/h),fract(uv.y/(h*.6)));float m=max(step(f.x,.02),step(f.y,.03));diffuseColor.rgb=mix(diffuseColor.rgb*(.95+.1*h21(floor(vec2(uv.x/h,uv.y/(h*.6))))),diffuseColor.rgb*.45,m);`;
  else if (pt === 'grid')
    b = `vec2 f=vec2(fract(uv.x/h),fract(uv.y/(h*1.4)));float m=max(step(f.x,.03),step(f.y,.025));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.2,.22),m);`;
  else return '';
  return uv + b + `diffuseColor.rgb=mix(c0,diffuseColor.rgb,aa);`;
}
function l2mHatchCode(hs, sc) {
  if (!hs || hs === 'solid') return '';
  const s = (+sc || 0.05).toFixed(4);
  return (
    `vec3 dir=normalize(vWP-cameraPosition);float den=dot(uCN,dir);vec3 cp=cameraPosition+dir*(-(dot(uCN,cameraPosition)+uCC)/(abs(den)<1e-5?1e-5:den));vec2 q=uAx<.5?vec2(cp.z,cp.y):uAx>1.5?vec2(cp.x,cp.y):vec2(cp.x,cp.z);float s=${s};float a=fract((q.x+q.y)/s),b=fract((q.x-q.y)/s);float m=0.;` +
    (hs === 'diag'
      ? 'm=step(a,.1);'
      : hs === 'cross'
        ? 'm=max(step(a,.08),step(b,.08));'
        : hs === 'hor'
          ? 'm=step(fract(q.y/s),.1);'
          : hs === 'dots'
            ? 'vec2 g=fract(q/s)-.5;m=step(length(g),.12);'
            : '') +
    `diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.45,m);`
  );
}
function l2mPatch(m, body, uni) {
  m.extensions = Object.assign({}, m.extensions, { derivatives: true });
  m.onBeforeCompile = (sh) => {
    if (uni) Object.assign(sh.uniforms, uni);
    sh.vertexShader =
      'varying vec3 vWP;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;',
      );
    sh.fragmentShader =
      'varying vec3 vWP;\n' +
      (uni ? 'uniform vec3 uCN;uniform float uCC;uniform float uAx;\n' : '') +
      L2GLSL +
      '\n' +
      sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + body);
  };
  m.customProgramCacheKey = () => body;
}
function l2MatFx(m, n) {
  const g = l2mGet(n);
  m.userData.ln = n;
  const c = l2mPatCode(g.pt, g.ps);
  if (c) l2mPatch(m, c);
}
function l2BackMesh(geo, fm, y) {
  try {
    const n = fm.userData.ln;
    if (n == null) return null;
    const g = l2mGet(n),
      bm = new T.MeshBasicMaterial({
        color: new T.Color(g.cs || g.c),
        side: T.BackSide,
        clippingPlanes: [L2CLIP],
      });
    bm.userData.c0 = g.cs || g.c;
    bm.userData.back = 1;
    const uni = { uCN: L2CU.n, uCC: { value: 0 }, uAx: L2CU.ax };
    uni.uCC = L2CU.c;
    l2mPatch(bm, l2mHatchCode(g.hs, 0.04) || '', uni);
    const me = new T.Mesh(geo, bm);
    me.raycast = () => {};
    me.userData.cutB = 1;
    me.visible = false;
    me.position.y = y || 0;
    return me;
  } catch (e) {
    console.warn(e);
    return null;
  }
}
// l2CutApply(): Erweiterung zusammengeführt, siehe 23-bauteilkonfigurator/030-3d.js
// ---- Fenster
const L2MW = { ps: '', dirty: 0, all: 0, open: 0 };
function l2mCss() {
  if (document.getElementById('l2msty')) return;
  const s = document.createElement('style');
  s.id = 'l2msty';
  s.textContent = `#l2m{position:fixed;left:16px;top:64px;width:420px;max-height:calc(100vh - 150px);overflow:auto;z-index:62;background:rgba(255,255,255,.97);border:1px solid #cfcac0;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.2);padding:10px 12px;font:12px system-ui,sans-serif;color:#1d1d1b}
#l2m h4{margin:10px 0 4px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#7b776d}#l2m .hd{display:flex;align-items:center;gap:8px}#l2m .hd b{flex:1;font-size:13px}#l2m button{border:1px solid #d3cec2;background:#faf8f3;border-radius:7px;padding:2px 9px;cursor:pointer;font:inherit}
#l2m .mr{display:grid;grid-template-columns:1fr 34px 34px 78px 108px 46px;gap:4px;align-items:center;margin:3px 0}#l2m .mr.h{color:#7b776d;font-size:10.5px}#l2m input[type=color]{width:32px;height:22px;padding:0;border:1px solid #cfcac0;border-radius:4px;background:none}#l2m select,#l2m input[type=text],#l2m input[type=number]{min-width:0;padding:2px 3px;border:1px solid #d3cec2;border-radius:5px;background:#E9EDEF;font:inherit;width:100%;box-sizing:border-box}
#l2m .nw{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}#l2m .mu{color:#7b776d;font-size:11px}`;
  document.head.appendChild(s);
}
function l2mList() {
  const M = new Map();
  const add = (n, kg) => {
    if (!M.has(n)) M.set(n, { n, kg, u: 0 });
  };
  L2T.forEach((t) => (t.layers || []).forEach((l) => add(l.n, l.kg)));
  Object.keys(L2FAC).forEach((k) => L2FAC[k].forEach((m) => add(m[0], m[2])));
  const used = new Set();
  S.bld
    .filter((b) => !b.ex && b._y != null)
    .forEach((b) => {
      try {
        l2Els(b).els.forEach((e) => (e.T.layers || []).forEach((l) => used.add(l.n)));
      } catch (e) {
        logErr(e, 'l2mList>anonym');
      }
    });
  const G = { f: [], t: [], d: [], i: [], o: [] };
  M.forEach((m) => {
    m.u = used.has(m.n) ? 1 : 0;
    if (!L2MW.all && !m.u && !S.mat.o[m.n]) return;
    const g =
      /^33[56]$/.test(m.kg) && m.kg === '335'
        ? 'f'
        : L2ST.indexOf(m.kg) >= 0
          ? 't'
          : /dämm|holzfaser-p|kern/i.test(m.n)
            ? 'd'
            : m.kg === '336'
              ? 'i'
              : 'o';
    G[g].push(m);
  });
  return G;
}
function l2mRow(m) {
  const g = l2mGet(m.n),
    q = JSON.stringify(m.n).replace(/"/g, '&quot;');
  return `<div class="mr"><span title="${esc(m.n)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.n)}</span><input type="color" value="${g.c}" title="${l2mLink(m.n) ? 'Farbe = Fassadentyp im Fassadendesigner (' + esc(l2mLink(m.n).n) + ')' : 'Farbe im 3D-Modell'}" onchange="L2MF.set(${q},'c',this.value)"><input type="color" value="${g.cs || g.c}" title="Schnittfarbe" onchange="L2MF.set(${q},'cs',this.value)"><select title="Schraffur im Schnitt" onchange="L2MF.set(${q},'hs',this.value)">${L2HS.map((h) => `<option value="${h[0]}" ${h[0] === (g.hs || '') ? 'selected' : ''}>${h[1]}</option>`).join('')}</select><select title="Muster im 3D-Modell" onchange="L2MF.set(${q},'pt',this.value)">${L2PT.map((h) => `<option value="${h[0]}" ${h[0] === (g.pt || '') ? 'selected' : ''}>${h[1]}</option>`).join('')}</select><input type="number" step="0.01" min="0.01" max="3" value="${g.ps}" title="Mustergröße in m" onchange="L2MF.set(${q},'ps',+this.value)" ${g.pt ? '' : 'disabled'}></div>`;
}
function l2mHtml() {
  const G = l2mList(),
    NM = {
      f: 'Fassade (KG 335)',
      t: 'Tragende Schichten',
      d: 'Dämmung',
      i: 'Innenseite (KG 336)',
      o: 'Sonstige',
    };
  let h = `<div class="hd"><b>Materialkonfigurator · LOD 300</b><label class="mu"><input type="checkbox" ${L2MW.all ? 'checked' : ''} onchange="L2MF.all(this.checked)"> alle</label><button onclick="L2MF.close()">✕</button></div><div class="mu" style="margin:4px 0">Farbe und Muster gelten im 3D-Modell, Schnittfarbe und Schraffur im Schnitt. Änderungen wirken auf alle Wandtypen mit diesem Material.</div>
 <div class="mr h"><span>Material</span><span>3D</span><span>Schnitt</span><span>Schraffur</span><span>Muster</span><span>Größe</span></div>`;
  ['f', 't', 'd', 'i', 'o'].forEach((k) => {
    if (G[k].length)
      h +=
        `<h4>${NM[k]}</h4>` +
        G[k]
          .sort((a, b) => a.n.localeCompare(b.n, 'de'))
          .map(l2mRow)
          .join('');
  });
  h += `<h4>Neues Fassadenmaterial</h4><div class="nw"><input type="text" id="l2mN" placeholder="Name, z. B. Faserzement-Platte"><input type="color" id="l2mC" value="#9aa59f" style="width:100%"><input type="number" id="l2mD" step="0.1" min="0.1" value="2" placeholder="Dicke cm"><input type="number" id="l2mU" step="0.5" min="0" value="4" placeholder="Unterkonstruktion cm"></div><div class="nw"><select id="l2mP">${L2PT.map((h) => `<option value="${h[0]}">${h[1]}</option>`).join('')}</select><button onclick="L2MF.add()">+ als Fassadentyp anlegen</button></div><div class="mu" style="margin-top:4px">Dicke (cm) und Unterkonstruktion/Hinterlüftung (cm). Das Material erscheint im Fassadendesigner als eigener Fassadentyp.</div>`;
  if (S.mat.nf.length)
    h +=
      `<h4>Eigene Fassadenmaterialien</h4>` +
      S.mat.nf
        .map(
          (m, i) =>
            `<div class="mr" style="grid-template-columns:1fr 70px 30px"><span>${esc(m.n)}</span><span class="mu">${Math.round(m.d * 1000) / 10} + ${Math.round(m.ud * 1000) / 10} cm</span><button onclick="L2MF.del(${i})" title="Entfernen">✕</button></div>`,
        )
        .join('');
  return h;
}
function l2mUi() {
  let d = document.getElementById('l2m'),
    bt = document.getElementById('bmat');
  if (!bt) {
    const cm = document.getElementById('cmp');
    if (cm) {
      bt = document.createElement('button');
      bt.className = 'bt';
      bt.id = 'bmat';
      bt.title = 'Materialkonfigurator: Darstellung der Materialien in 3D und Schnitt';
      bt.innerHTML = SVGI(
        '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="12.5" cy="7.8" r="1.3"/><circle cx="15.8" cy="11.3" r="1.3"/><path d="M12 20.5c-1.6 0-2-1.6-1-2.6.8-.8.4-2-.8-2.2"/>',
        18,
      );
      bt.onclick = () => {
        L2MW.open = !L2MW.open;
        l2mUi();
      };
      cm.parentNode.insertBefore(bt, cm);
    }
  }
  if (bt) {
    bt.style.display = l23() ? '' : 'none';
    bt.classList.toggle('on', !!L2MW.open);
  }
  if (!l23() || !L2MW.open) {
    if (d) d.style.display = 'none';
    return;
  }
  l2mCss();
  if (!d) {
    d = document.createElement('div');
    d.id = 'l2m';
    document.body.appendChild(d);
  }
  d.style.display = '';
  const ps = JSON.stringify([S.mat, L2MW.all, S.bld.map((b) => b.id + (b._l2 ? b._l2.k.length : 0))]);
  if (
    d.dataset.s !== ps &&
    !(
      d.contains(document.activeElement) &&
      /INPUT|SELECT/.test(document.activeElement.tagName) &&
      !L2MW.dirty
    )
  ) {
    d.dataset.s = ps;
    L2MW.dirty = 0;
    const sc = d.scrollTop;
    d.innerHTML = l2mHtml();
    d.scrollTop = sc;
  }
}
const L2MF = {
  set: (n, k, v) => {
    const ft = k === 'c' ? l2mLink(n) : null;
    if (ft) {
      ft.c = v;
      try {
        FDS.ps = '';
        FDS.dirty = 1;
        if (FDS.open) fdTick(true);
      } catch (e) {
        logErr(e, 'set');
      }
      try {
        zoTick(true);
      } catch (e) {
        logErr(e, 'set');
      }
      try {
        rr();
      } catch (e) {
        logErr(e, 'set');
      }
      l2mDirty();
      return;
    }
    S.mat.o[n] = Object.assign(S.mat.o[n] || {}, { [k]: v });
    if (k === 'c' && !S.mat.o[n].cs) S.mat.o[n].cs = v;
    if (k === 'pt' && v && !S.mat.o[n].ps) S.mat.o[n].ps = l2mDef(n).ps;
    l2mDirty();
  },
  all: (v) => {
    L2MW.all = v ? 1 : 0;
    L2MW.dirty = 1;
    l2mUi();
  },
  close: () => {
    L2MW.open = 0;
    l2mUi();
  },
  add: () => {
    const g = (id) => document.getElementById(id);
    l2mNew(
      g('l2mN').value,
      (+g('l2mD').value || 2) / 100,
      (+g('l2mU').value || 0) / 100,
      g('l2mC').value,
      g('l2mP').value,
    );
  },
  del: (i) => {
    const m = S.mat.nf[i];
    if (!m) return;
    S.mat.nf.splice(i, 1);
    S.ft = S.ft.filter((t) => t.k !== m.k);
    delete L2FAC[m.k];
    S.bld.forEach((b) => {
      if (b.fd)
        Object.values(b.fd).forEach((v) =>
          (v.units || []).forEach((u) => {
            if (u && u.t === m.k) u.t = 'ohne';
          }),
        );
    });
    l2mDirty();
  },
};
setInterval(() => {
  try {
    l2mUi();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 400);
