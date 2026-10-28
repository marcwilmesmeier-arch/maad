// ---- v240: einheitliche, einstellbare Auswahlfarben (Flächen + Kontur) für Analyse · Gebäude und Analysebereich · Gebäude
S.hlc = S.hlc || { on: true, oOn: true, fc: '#5E7F92', oc: '#1F2A33' };
function hlcFix() {
  const d = { on: true, oOn: true, fc: '#5E7F92', oc: '#1F2A33' };
  S.hlc = Object.assign(d, S.hlc || {});
  for (const k of ['fc', 'oc']) {
    const m = { '#ff7a1a': '#5E7F92', '#e5560a': '#1F2A33' }[String(S.hlc[k] || '').toLowerCase()];
    if (m) S.hlc[k] = m;
  }
  document.documentElement.style.setProperty('--hlc', S.hlc.fc);
}
function selStyle() {
  hlcFix();
  const g = S.hlG,
    h = S.hlc;
  if (!g) return;
  g.children.slice().forEach((o) => {
    if (o.userData && o.userData._hlo) {
      g.remove(o);
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose();
    }
  });
  const add = [];
  g.children.forEach((m) => {
    if (!m.isMesh) return;
    if (m.material && m.material.color) m.material.color.set(h.fc);
    m.visible = h.on !== false;
    if (h.oOn === false) return;
    let geo = null;
    const ol = m.userData && m.userData.ol;
    try {
      if (ol && ol.length) {
        geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(new Float32Array(ol), 3));
      } else geo = new T.EdgesGeometry(m.geometry, 25);
    } catch (_) {
      geo = null;
    }
    if (!geo) return;
    const mt = new T.LineBasicMaterial({
        color: h.oc,
        transparent: true,
        opacity: 1,
        depthTest: m.material ? m.material.depthTest !== false : true,
        depthWrite: false,
      }),
      ln = new T.LineSegments(geo, mt);
    ln.position.copy(m.position);
    ln.renderOrder = 13;
    ln.raycast = () => {};
    ln.frustumCulled = false;
    ln.userData = {
      _hlo: 1,
      k: m.userData.k,
      bid: m.userData.bid,
      y0: m.userData.y0 != null ? m.userData.y0 : m.position.y,
    };
    add.push(ln);
  });
  add.forEach((l) => g.add(l));
}
{
  const h0 = hlApply;
  hlApply = function () {
    h0.apply(this, arguments);
    try {
      selStyle();
    } catch (e) {
      console.warn('selStyle', e);
    }
  };
}
function hlcUi() {
  hlcFix();
  const q = (id) => document.getElementById(id),
    h = S.hlc,
    oc0 = q('occ'),
    a = q('hlck'),
    b = q('hlcf'),
    c = q('hlok'),
    d = q('hlco');
  if (oc0 && typeof S.oc === 'string') oc0.value = S.oc;
  if (!a) return;
  a.checked = h.on !== false;
  b.value = h.fc;
  b.disabled = h.on === false;
  c.checked = h.oOn !== false;
  d.value = h.oc;
  d.disabled = h.oOn === false;
}
function hlcApply() {
  hlcFix();
  hlcUi();
  try {
    selStyle();
  } catch (e) {
    logErr(e, 'hlcApply');
  }
}
{
  const l0 = lyRender;
  lyRender = function () {
    l0.apply(this, arguments);
    const el = document.getElementById('lyp');
    if (!el || document.getElementById('hlrow')) return;
    const kr = document.getElementById('konrow'),
      gb = [...el.querySelectorAll('.ly label')].find((x) => x.textContent.trim() === 'Gebäude'),
      gr = gb && gb.closest('.ly');
    const cs =
        'width:34px;height:24px;padding:0;border:1px solid var(--ln);border-radius:4px;background:none;cursor:pointer',
      ck = 'width:16px;height:16px;margin:0;flex:none';
    const html =
      '<div id="hlrow" style="margin:2px 0 8px 18px;padding:6px 10px;border-left:2px solid var(--ln);font-size:12px"><b style="font-weight:600;display:block;margin-bottom:6px">Auswahl &amp; Hover</b>' +
      '<div style="display:grid;grid-template-columns:1fr 34px;align-items:center;gap:8px;margin:4px 0"><span>Konturfarbe (Gebäude: Auswahl &amp; Hover)</span><input type="color" id="occ" style="' +
      cs +
      '"></div>' +
      '<b style="font-weight:600;display:block;margin:8px 0 4px">Analyse-Auswahl</b>' +
      '<div style="display:grid;grid-template-columns:1fr 34px;align-items:center;gap:8px;margin:4px 0"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0"><input type="checkbox" id="hlck" style="' +
      ck +
      '">Flächen anzeigen</label><input type="color" id="hlcf" style="' +
      cs +
      '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 34px;align-items:center;gap:8px;margin:4px 0"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0"><input type="checkbox" id="hlok" style="' +
      ck +
      '">Konturen anzeigen</label><input type="color" id="hlco" style="' +
      cs +
      '"></div>' +
      '<button type="button" id="hlrs" style="font-size:11px;border:1px solid var(--ln);background:transparent;border-radius:8px;padding:3px 10px;cursor:pointer;margin-top:4px">Standardfarben</button></div>';
    (kr || gr || el).insertAdjacentHTML(kr || gr ? 'afterend' : 'beforeend', html);
    hlcUi();
  };
}
{
  const lp = document.getElementById('lyp');
  lp.addEventListener('change', (e) => {
    if (e.target.id === 'hlck') {
      S.hlc.on = e.target.checked;
      hlcApply();
    } else if (e.target.id === 'hlok') {
      S.hlc.oOn = e.target.checked;
      hlcApply();
    }
  });
  lp.addEventListener('input', (e) => {
    if (e.target.id === 'occ') {
      S.oc = e.target.value;
      if (typeof ocApply === 'function') ocApply();
    } else if (e.target.id === 'hlcf') {
      S.hlc.fc = e.target.value;
      hlcApply();
    } else if (e.target.id === 'hlco') {
      S.hlc.oc = e.target.value;
      hlcApply();
    }
  });
  lp.addEventListener('click', (e) => {
    if (e.target.id === 'hlrs') {
      S.hlc.fc = '#5E7F92';
      S.hlc.oc = '#1F2A33';
      hlcApply();
    }
  });
}
hlcFix();
