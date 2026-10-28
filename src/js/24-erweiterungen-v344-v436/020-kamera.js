// ---- Kamera (v385): Nahaufnahmen, Blickrichtung, Brennweite, Architekturperspektiven
const CAMX = { on: false, ty: 0, f: 29, vert: false, snap: null, open: false, res: 1 };
const camxFov = (f) => (2 * Math.atan(12 / f) * 180) / Math.PI;
function camxApply(c, v, a, X) {
  X = X || CAMX;
  if (!X.on) return;
  const sp = Math.sin(v.pol);
  let y = X.ty + v.d * Math.cos(v.pol);
  const gx = v.tx + v.d * sp * Math.sin(v.az),
    gz = v.tz + v.d * sp * Math.cos(v.az);
  const gy = gh(gx, gz) + 0.4;
  if (y < gy) y = gy;
  c.position.set(gx, y, gz);
  c.fov = camxFov(X.f);
  c.near = Math.max(0.05, Math.min(1, v.d * 0.03));
  c.aspect = a;
  if (X.vert) c.lookAt(v.tx, y, v.tz);
  else c.lookAt(v.tx, X.ty, v.tz);
  c.updateProjectionMatrix();
  if (X.vert) {
    const dh = Math.hypot(gx - v.tx, gz - v.tz) || 1,
      t = Math.tan((c.fov * Math.PI) / 360),
      y0 = (X.ty - y) / (dh * t);
    c.projectionMatrix.elements[9] = y0;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }
  c.updateMatrixWorld(true);
}
{
  const _c = cam;
  cam = function () {
    _c();
    if (S.m3 && CAMX.on) {
      try {
        camxApply(pc, V, mid.clientWidth / mid.clientHeight);
      } catch (e) {
        logErr(e, 'cam');
      }
    }
  };
}
const camxPolMax = () => (CAMX.on ? 3.0 : 1.5),
  camxMin = () => (CAMX.on ? 3 : window.camxSk && camxSk() ? 1.2 : 40);
function camxSave() {
  return CAMX.on ? { ty: CAMX.ty, f: CAMX.f, vert: CAMX.vert } : null;
}
function camxGo(v) {
  if (v && v.cx) {
    if (!CAMX.on) CAMX.snap = { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol };
    CAMX.on = true;
    CAMX.ty = v.cx.ty;
    CAMX.f = v.cx.f;
    CAMX.vert = !!v.cx.vert;
  } else if (CAMX.on) {
    CAMX.on = false;
    CAMX.snap = null;
  }
  camxUi();
  camxBtn();
}
function camxOn(on) {
  if (on && !CAMX.on) {
    CAMX.snap = { tx: V.tx, tz: V.tz, d: V.d, az: V.az, pol: V.pol };
    CAMX.on = true;
    if (!S.m3) setMode(1);
  } else if (!on && CAMX.on) {
    CAMX.on = false;
    const s = CAMX.snap;
    CAMX.ty = 0;
    CAMX.vert = false;
    CAMX.f = 29;
    if (s) {
      Object.assign(V, s);
    }
    CAMX.snap = null;
  }
  camxUi();
  camxBtn();
}
function camxBld() {
  const b = S.sel;
  if (b && S.bld.includes(b) && !b.ex && b.levels) return b;
  return S.bld.find((q) => !q.ex && q.levels) || null;
}
function camxPose(dh, Cy, ty, az) {
  V.az = az;
  const dv = Cy - ty;
  V.d = Math.max(3, Math.hypot(dh, dv));
  V.pol = Math.max(0.1, Math.min(3, Math.atan2(dh, dv)));
  CAMX.ty = ty;
}
function camxSet(k, val) {
  if (!CAMX.on) camxOn(true);
  val = +val;
  if (!isFinite(val)) return;
  const dh0 = V.d * Math.sin(V.pol),
    gx = V.tx + dh0 * Math.sin(V.az),
    gz = V.tz + dh0 * Math.cos(V.az),
    Cy = CAMX.ty + V.d * Math.cos(V.pol),
    gnd = gh(gx, gz);
  if (k === 'f') CAMX.f = val;
  else if (k === 'ty') {
    camxPose(dh0, Cy, val, V.az);
  } else if (k === 'dh') camxPose(Math.max(1, val), Cy, CAMX.ty, V.az);
  else if (k === 'hc') camxPose(dh0, gnd + val, CAMX.ty, V.az);
  else if (k === 'az') camxPose(dh0, Cy, CAMX.ty, (-val * Math.PI) / 180);
  else if (k === 'vert') CAMX.vert = !!val;
  camxUi(1);
}
function camxPreset(kind) {
  const b = camxBld();
  if (!b) {
    camxMsg('Zuerst ein Gebäude anlegen oder wählen.');
    return;
  }
  const L = b.levels[b.levels.length - 1],
    f = lf(b, L);
  if (!f || f.length < 3) {
    camxMsg('Gebäude hat keinen Grundriss.');
    return;
  }
  let x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9,
    sa = 0;
  f.forEach((p, i) => {
    const q = f[(i + 1) % f.length];
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]);
    z1 = Math.max(z1, p[1]);
    sa += p[0] * q[1] - q[0] * p[1];
  });
  const sg = sa > 0 ? 1 : -1;
  let bl = 0,
    az0 = 0;
  f.forEach((p, i) => {
    const q = f[(i + 1) % f.length],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      l = Math.hypot(dx, dz);
    if (l > bl) {
      bl = l;
      az0 = Math.atan2((sg * dz) / l, (-sg * dx) / l);
    }
  });
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    H = Math.max(3, (b._h || 9) + (b._roofH || 0) * 0.6),
    base = b._y != null ? b._y : gh(cx, cz),
    W = Math.hypot(x1 - x0, z1 - z0),
    a = mid.clientWidth / mid.clientHeight;
  if (!CAMX.on) camxOn(true);
  const P = {
    front: { az: az0, f: 35, vert: true, eye: 1.7 },
    corner: { az: az0 + 0.62, f: 28, vert: true, eye: 1.7 },
    eye: { az: az0 + 0.5, f: 24, vert: false, eye: 1.7 },
    bird: { az: az0 + 0.5, f: 35, vert: false, el: 40 },
    aerial: { az: az0 + 0.62, f: 35, vert: false, el: 26 },
    top: { az: az0, f: 35, vert: false, el: 84 },
  }[kind];
  if (!P) return;
  CAMX.f = P.f;
  CAMX.vert = P.vert;
  const t = Math.tan((camxFov(P.f) * Math.PI) / 360);
  const ty = base + H * (P.el ? 0.45 : 0.5),
    dh = Math.max(
      8,
      P.el
        ? Math.max((H * 0.9 + W * 0.35) / t / 1.6, (W * 0.9) / (t * a))
        : 1.3 * Math.max((H * 0.6) / t, (W * 0.58) / (t * a)),
    );
  V.tx = cx;
  V.tz = cz;
  let Cy;
  if (P.eye) {
    const gx = cx + dh * Math.sin(P.az),
      gz = cz + dh * Math.cos(P.az);
    Cy = gh(gx, gz) + P.eye;
  } else Cy = ty + dh * Math.tan((P.el * Math.PI) / 180);
  camxPose(dh, Cy, ty, P.az);
  S.vanim = null;
  camxMsg('');
  camxUi(1);
}
function camxMsg(t) {
  const e = document.getElementById('camxM');
  if (e) e.textContent = t;
}
function camxPhoto() {
  try {
    const pr = ren.getPixelRatio(),
      r = CAMX.res | 0,
      out = r >= 2 ? 3 : 2,
      ss = r >= 1 ? 2 : 1,
      w = mid.clientWidth,
      h = mid.clientHeight,
      gl = ren.getContext(),
      mx = Math.min(
        8192,
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096,
        gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096,
      );
    let k = out * ss;
    k = Math.min(k, mx / w, mx / h);
    const o = Math.max(1, Math.min(out, k)),
      rk = k;
    ren.setPixelRatio(rk);
    cam();
    mkRender(sc, pc);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * o);
    cv.height = Math.round(h * o);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(ren.domElement, 0, 0, cv.width, cv.height);
    ren.setPixelRatio(pr);
    cam();
    const u = cv.toDataURL('image/png'),
      a = document.createElement('a');
    a.href = u;
    a.download = 'maad-kamera.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    camxMsg('Foto gespeichert (' + cv.width + ' × ' + cv.height + ' px).');
  } catch (e) {
    camxMsg('Foto nicht möglich.');
    console.warn(e);
  }
}
// Schattenkarte folgt dem Blickpunkt (nur Kamera-Modus): ~10× feinere Schatten bei Nahaufnahmen
function shFit(cm, sh) {
  if (!(CAMX.on && S.m3 && cm === pc) || CAMX.sh === false) return null;
  const c = sh.camera,
    tp = sunL.target.position,
    dir = sunL.position.clone().sub(tp),
    D0 = dir.length();
  if (D0 < 1) return null;
  dir.normalize();
  const up = Math.abs(dir.y) > 0.99 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0),
    ax = new T.Vector3().crossVectors(up, dir).normalize(),
    ay = new T.Vector3().crossVectors(dir, ax).normalize();
  const F0 = new T.Vector3(V.tx, CAMX.ty, V.tz),
    R = Math.max(35, Math.min(160, V.d * 1.5)),
    u = F0.dot(ax),
    v = F0.dot(ay),
    s = F0.dot(dir),
    s0 = s - R - 80,
    s1 = s + R + 80;
  if (R > c.right * 0.85) return null;
  const q = (2 * R) / (sh.mapSize.x || 4096),
    cu = Math.round(u / q) * q,
    cv = Math.round(v / q) * q,
    sm = (s0 + s1) / 2,
    F = new T.Vector3().addScaledVector(ax, cu).addScaledVector(ay, cv).addScaledVector(dir, sm),
    Dd = s1 - sm + 10;
  return { F, dir, R, near: 10, far: Dd + (sm - s0) + 10, Dd, q };
}
// Schatten seltener berechnen: die Schattenkarte wird nur neu gerendert, wenn sich Schattenwerfer, Sonne oder Ausschnitt ändern (Sicherheits-Refresh alle 1,5 s)
const SHC = { on: true, sig: null, t: 0, n: 0, skip: 0 };
function shSig() {
  let h = 0;
  const sh = sunL.shadow,
    c = sh.camera,
    p = sunL.position,
    t = sunL.target.position;
  h =
    p.x * 1.1 +
    p.y * 1.3 +
    p.z * 1.7 +
    t.x * 0.7 +
    t.y * 0.9 +
    t.z * 1.9 +
    c.left * 2.1 +
    c.right * 2.3 +
    c.top * 2.9 +
    c.bottom * 3.1 +
    c.near * 0.3 +
    c.far * 0.2 +
    (sunL.castShadow ? 5 : 0) +
    sh.mapSize.x;
  sc.traverseVisible((o) => {
    if (!o.castShadow) return;
    const e = o.matrixWorld.elements,
      g = o.geometry;
    h +=
      e[12] * 1.3 +
      e[13] * 1.7 +
      e[14] * 1.9 +
      e[0] +
      e[5] * 1.1 +
      e[10] * 1.2 +
      e[1] * 0.3 +
      e[4] * 0.4 +
      e[8] * 0.5;
    if (g) {
      h += g.id * 0.7;
      const a = g.attributes && g.attributes.position;
      if (a) h += a.version * 13 + a.count * 0.01;
      if (g.index) h += g.index.version * 7;
    }
    if (o.isInstancedMesh) {
      h += o.count * 0.9;
      if (o.instanceMatrix) h += o.instanceMatrix.version * 11;
    }
  });
  return h;
}
{
  const _mr = mkRender;
  mkRender = function (scn, cm) {
    let st = null;
    try {
      if (scn === sc && sunL.castShadow) {
        const sh = sunL.shadow,
          c = sh.camera,
          tp = sunL.target.position,
          f = S.m3 ? shFit(cm, sh) : null;
        if (f) {
          st = {
            p: sunL.position.clone(),
            t: tp.clone(),
            l: c.left,
            r: c.right,
            tp: c.top,
            b: c.bottom,
            n: c.near,
            f: c.far,
            bi: sh.bias,
            nb: sh.normalBias,
          };
          tp.copy(f.F);
          sunL.position.copy(f.F).addScaledVector(f.dir, f.Dd);
          sunL.target.updateMatrixWorld();
          sunL.updateMatrixWorld();
          Object.assign(c, { left: -f.R, right: f.R, top: f.R, bottom: -f.R, near: f.near, far: f.far });
          c.updateProjectionMatrix();
          sh.bias = -0.0002;
          sh.normalBias = Math.max(0.02, f.q * 1.6);
        }
        if (SHC.on) {
          ren.shadowMap.autoUpdate = false;
          const now = performance.now(),
            g = shSig();
          if (!sh.map || g !== SHC.sig || now - SHC.t > 1500) {
            SHC.sig = g;
            SHC.t = now;
            ren.shadowMap.needsUpdate = true;
            SHC.n++;
          } else SHC.skip++;
        } else ren.shadowMap.autoUpdate = true;
      }
    } catch (e) {
      console.warn(e);
    }
    try {
      return _mr.apply(this, arguments);
    } finally {
      if (st) {
        const c = sunL.shadow.camera,
          sh = sunL.shadow;
        sunL.position.copy(st.p);
        sunL.target.position.copy(st.t);
        sunL.target.updateMatrixWorld();
        sunL.updateMatrixWorld();
        Object.assign(c, { left: st.l, right: st.r, top: st.tp, bottom: st.b, near: st.n, far: st.f });
        c.updateProjectionMatrix();
        sh.bias = st.bi;
        sh.normalBias = st.nb;
      }
    }
  };
}
function camxCompass(b) {
  const n = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return n[Math.round(b / 45) % 8];
}
function camxVals() {
  const dh = V.d * Math.sin(V.pol),
    gx = V.tx + dh * Math.sin(V.az),
    gz = V.tz + dh * Math.cos(V.az),
    Cy = CAMX.ty + V.d * Math.cos(V.pol);
  let az = ((((-V.az * 180) / Math.PI) % 360) + 360) % 360;
  return { dh, hc: Math.max(0, Cy - gh(gx, gz)), ty: CAMX.ty, az, f: CAMX.f };
}
function camxUi(soft) {
  const e = document.getElementById('camxP');
  if (!e || !CAMX.open) return;
  const v = camxVals();
  if (soft && e.dataset.b) {
    const set = (id, x, t) => {
      const i = document.getElementById(id);
      if (i && document.activeElement !== i) i.value = x;
      const s = document.getElementById(id + 'v');
      if (s) s.textContent = t;
    };
    set('camxDh', v.dh, Math.round(v.dh * 10) / 10 + ' m');
    set('camxHc', v.hc, Math.round(v.hc * 10) / 10 + ' m');
    set('camxTy', v.ty, Math.round(v.ty * 10) / 10 + ' m');
    set('camxAz', v.az, Math.round(v.az) + '° ' + camxCompass(v.az));
    set('camxF', v.f, v.f + ' mm · ' + Math.round(camxFov(v.f)) + '°');
    const c = document.getElementById('camxV');
    if (c) c.checked = CAMX.vert;
    const o = document.getElementById('camxOn');
    if (o) o.checked = CAMX.on;
    return;
  }
  const sl = (id, k, lab, min, max, val, txt, st) =>
    `<div style="margin:5px 0"><div style="display:flex;justify-content:space-between"><span>${lab}</span><b id="${id}v">${txt}</b></div><input id="${id}" type="range" min="${min}" max="${max}" step="${st || 0.1}" value="${val}" style="width:100%" oninput="camxSet('${k}',this.value)"></div>`;
  const bt = (k, t, ti) => `<button class="sm" onclick="camxPreset('${k}')" title="${ti}">${t}</button>`;
  e.dataset.b = 1;
  e.innerHTML = `<div style="display:flex;align-items:center;gap:6px"><b style="flex:1">📷 Kamera</b><label style="font-size:11px"><input id="camxOn" type="checkbox" ${CAMX.on ? 'checked' : ''} onchange="camxOn(this.checked)"> Kamera-Modus</label><button class="sm" onclick="camxClose()">✕</button></div>
 <div style="margin:6px 0 4px;font-size:11px;opacity:.75">Perspektive für das gewählte Gebäude:</div>
 <div style="display:flex;flex-wrap:wrap;gap:4px">${bt('front', 'Frontal', 'Eine Fluchtpunkt-Ansicht auf die längste Fassade, Augenhöhe')}${bt('corner', 'Eck (2-Punkt)', 'Zwei Fassaden, senkrechte Kanten bleiben senkrecht')}${bt('eye', 'Fußgänger', 'Blick von unten, Weitwinkel')}${bt('aerial', 'Schrägluftbild', 'Von schräg oben')}${bt('bird', 'Vogel', 'Steiler Blick von oben')}${bt('top', 'Draufsicht', 'Fast senkrecht')}</div>
 <div id="camxM" style="font-size:11px;margin:5px 0;min-height:14px;opacity:.8"></div>
 ${sl('camxDh', 'dh', 'Abstand (waagerecht)', 1, 300, v.dh, Math.round(v.dh * 10) / 10 + ' m')}
 ${sl('camxHc', 'hc', 'Kamerahöhe über Gelände', 0.3, 120, v.hc, Math.round(v.hc * 10) / 10 + ' m')}
 ${sl('camxTy', 'ty', 'Blickpunkt-Höhe', 0, 80, v.ty, Math.round(v.ty * 10) / 10 + ' m')}
 ${sl('camxAz', 'az', 'Blickrichtung (Kompass)', 0, 359, v.az, Math.round(v.az) + '° ' + camxCompass(v.az), 1)}
 ${sl('camxF', 'f', 'Brennweite', 14, 135, v.f, v.f + ' mm · ' + Math.round(camxFov(v.f)) + '°', 1)}
 <label style="display:block;margin:6px 0"><input id="camxV" type="checkbox" ${CAMX.vert ? 'checked' : ''} onchange="camxSet('vert',this.checked?1:0)"> Vertikale ausrichten (keine stürzenden Linien)</label>
 <div style="margin:6px 0 4px">Fotoqualität <select onchange="CAMX.res=+this.value"><option value="0" ${CAMX.res == 0 ? 'selected' : ''}>Standard (2×)</option><option value="1" ${CAMX.res == 1 ? 'selected' : ''}>Hoch (2× + Supersampling)</option><option value="2" ${CAMX.res == 2 ? 'selected' : ''}>Maximal (3× + Supersampling)</option></select></div><div style="display:flex;gap:4px;flex-wrap:wrap"><button class="sm" onclick="camxPhoto()">📸 Foto speichern (PNG)</button><button class="sm" onclick="vwAdd()" title="Legt die Kameraeinstellung als gespeicherte Ansicht ab">Als Ansicht merken</button></div>
 <div style="font-size:10.5px;opacity:.65;margin-top:6px">Maus: ziehen = drehen, Rad = nah/fern, rechts ziehen = verschieben. Nach Auswahl einer Perspektive frei nachjustierbar.</div>`;
}
function camxPlace() {
  const e = document.getElementById('camxP'),
    b = document.getElementById('bcam');
  if (!e) return;
  if (b && innerWidth > 800) {
    const r = b.getBoundingClientRect(),
      w = e.offsetWidth || 300;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    e.style.left = x + 'px';
    e.style.right = 'auto';
    e.style.top = 'auto';
    e.style.bottom = innerHeight - r.top + 12 + 'px';
    e.style.maxHeight = Math.max(240, r.top - 70) + 'px';
  } else {
    e.style.left = 'auto';
    e.style.right = '14px';
    e.style.top = '84px';
    e.style.bottom = 'auto';
    e.style.maxHeight = 'calc(100vh - 120px)';
  }
}
function camxBtn() {
  const b = document.getElementById('bcam');
  if (b) b.classList.toggle('on', !!CAMX.on);
}
function camxOpen() {
  let e = document.getElementById('camxP');
  if (!e) {
    e = document.createElement('div');
    e.id = 'camxP';
    e.className = 'fl';
    e.style.cssText =
      'position:fixed;width:300px;overflow:auto;padding:10px 12px;z-index:30;font-size:12.5px';
    document.body.appendChild(e);
  }
  e.style.display = 'block';
  CAMX.open = true;
  e.dataset.b = '';
  camxUi();
  camxPlace();
  camxBtn();
}
function camxClose() {
  CAMX.open = false;
  const e = document.getElementById('camxP');
  if (e) e.style.display = 'none';
  camxBtn();
}
function camxToggle() {
  CAMX.open ? camxClose() : camxOpen();
}
window.addEventListener('resize', () => {
  if (CAMX.open) camxPlace();
});
// Knopf im unteren Menü: Blickpunkt mit vier Strichen zu den Ecken des Blickfelds
setTimeout(() => {
  try {
    const b = document.getElementById('bcam');
    if (!b) return;
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4.5" cy="12" r="1.5"/><path d="M8 10.8L20 7M8 13.2L20 17M20 7V17"/></svg>';
    b.dataset.th = '1';
    b.dataset.tip = 'Kamera: Nahaufnahme, Blickrichtung, Perspektiven, Foto';
    b.removeAttribute('title');
    b.setAttribute('aria-label', 'Kamera');
    camxBtn();
  } catch (e) {
    console.warn(e);
  }
}, 0);
setInterval(() => {
  if (CAMX.open) camxUi(1);
}, 250);
