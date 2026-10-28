// ---- Hilfen Geometrie
const ifcRing = (fp) => fp.map((q) => [q[0], -q[1]]); // Szene (x,z) -> IFC (X,Y)
const ifcSA = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
function ifcClean(r) {
  const o = [];
  r.forEach((p) => {
    const q = o[o.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) o.push(p);
  });
  while (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= 0.01)
    o.pop();
  return o;
}
function ifcCCW(r) {
  return ifcSA(r) < 0 ? r.slice().reverse() : r;
}
// Innenring (nach innen versetzt, Gehrung); r gegen den Uhrzeigersinn. null, wenn nicht sinnvoll.
function ifcInset(r, d) {
  const n = r.length;
  if (n < 3) return null;
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = r[(i + n - 1) % n],
      b = r[i],
      c = r[(i + 1) % n];
    const e0 = [b[0] - a[0], b[1] - a[1]],
      e1 = [c[0] - b[0], c[1] - b[1]];
    const l0 = Math.hypot(...e0) || 1,
      l1 = Math.hypot(...e1) || 1;
    const n0 = [-e0[1] / l0, e0[0] / l0],
      n1 = [-e1[1] / l1, e1[0] / l1],
      dt = n0[0] * n1[0] + n0[1] * n1[1];
    const k = d / Math.max(1 + dt, 0.15);
    let vx = (n0[0] + n1[0]) * k,
      vy = (n0[1] + n1[1]) * k;
    const L = Math.hypot(vx, vy);
    if (L > 4 * d) {
      vx *= (4 * d) / L;
      vy *= (4 * d) / L;
    }
    o.push([b[0] + vx, b[1] + vy]);
  }
  const a0 = ifcSA(r),
    a1 = ifcSA(o);
  if (!(a1 > 0) || a1 >= a0 || a1 < a0 * 0.02) return null;
  return o;
}
// Dreiecks-Suppe (Szene, flach x,y,z) -> Dreiecke in IFC-Absolutkoordinaten
function ifcSoup(pos, zOff) {
  const t = [];
  for (let i = 0; i + 8 < pos.length; i += 9)
    t.push([
      [pos[i], -pos[i + 2], pos[i + 1] + zOff],
      [pos[i + 3], -pos[i + 5], pos[i + 4] + zOff],
      [pos[i + 6], -pos[i + 8], pos[i + 7] + zOff],
    ]);
  return t;
}
// Dreiecke -> verschweißte Punktliste + Index (relativ zum Ursprung o)
function ifcWeld(tris, o) {
  const mp = new Map(),
    V = [],
    I = [];
  const key = (p) => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000) + ',' + Math.round(p[2] * 1000);
  for (const t of tris) {
    const ix = t.map((p) => {
      const k = key(p);
      let i = mp.get(k);
      if (i == null) {
        i = V.length;
        V.push([p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
        mp.set(k, i);
      }
      return i;
    });
    if (ix[0] !== ix[1] && ix[1] !== ix[2] && ix[0] !== ix[2]) I.push(ix);
  }
  return { V, I };
}
function ifcTriArea(V, I) {
  let a = 0;
  for (const [i, j, k] of I) {
    const p = V[i],
      q = V[j],
      r = V[k],
      ux = q[0] - p[0],
      uy = q[1] - p[1],
      uz = q[2] - p[2],
      vx = r[0] - p[0],
      vy = r[1] - p[1],
      vz = r[2] - p[2];
    a += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return a;
}
// Polygon triangulieren (Szene x,z) und feiner teilen, damit es dem Gelände folgt
function ifcPolyTris(poly, maxE) {
  const pc = ifcClean(poly.map((q) => [q[0], q[1]]));
  if (pc.length < 3) return [];
  let tr = [];
  try {
    tr = T.ShapeUtils.triangulateShape(
      pc.map((q) => new T.Vector2(q[0], q[1])),
      [],
    );
  } catch (_) {
    return [];
  }
  const out = [],
    mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const sub = (t, k) => {
    const [a, b, c] = t,
      ab = d(a, b),
      bc = d(b, c),
      ca = d(c, a),
      m = Math.max(ab, bc, ca);
    if (m <= maxE || k > 7) {
      out.push(t);
      return;
    }
    if (m === ab) {
      const e = mid(a, b);
      sub([a, e, c], k + 1);
      sub([e, b, c], k + 1);
    } else if (m === bc) {
      const e = mid(b, c);
      sub([a, b, e], k + 1);
      sub([a, e, c], k + 1);
    } else {
      const e = mid(c, a);
      sub([a, b, e], k + 1);
      sub([e, b, c], k + 1);
    }
  };
  tr.forEach((t) => sub([pc[t[0]], pc[t[1]], pc[t[2]]], 0));
  return out;
}
function ifcHex(c) {
  try {
    const k = new T.Color(c);
    return [k.r, k.g, k.b];
  } catch (_) {
    return [0.8, 0.8, 0.8];
  }
}

// ======================================================================
// Hauptfunktion
// ======================================================================
async function ifcBuild(cfg, prog) {
  const t0 = Date.now();
  cfg = ifcCfgFix(cfg);
  prog = prog || (() => {});
  let lastY = performance.now();
  const yld = async () => {
    if (performance.now() - lastY > 80) {
      await new Promise((r) => setTimeout(r, 0));
      lastY = performance.now();
    }
  };
  const src = ifcSrc(cfg),
    warn = [],
    zOff = cfg.hAbs ? GEO.e0 || 0 : 0,
    on = (k) => !!cfg.cat[k].on,
    W = ifcWriter(),
    add = W.add,
    R = ifcR;
  const pj = ((S.project && (S.project.id || S.project.name)) || 'maad') + '';
  const usedK = new Set(),
    guid = (key) => {
      let k = key,
        n = 0;
      while (usedK.has(k)) k = key + '#' + ++n;
      usedK.add(k);
      return ifcS(cfg.stable ? ifcGuid(pj + '|' + k) : ifcGuidRand());
    };
  const projName = cfg.projName || (S.project && S.project.name) || 'maad Projekt';
  const siteName =
    cfg.siteName || 'Standort ' + (((S.project && S.project.label) || GEO.q || projName) + '').slice(0, 80);
  const lat0 = GEO.lat,
    lon0 = GEO.lon,
    hasGeo = isFinite(lat0) && isFinite(lon0) && (lat0 !== 0 || lon0 !== 0);
  const st = {};
  const bump = (k, n) => {
    st[k] = (st[k] || 0) + (n == null ? 1 : n);
  };
  // --- Eigentümer, Anwendung
  let OH = '$';
  if (cfg.ownerHist) {
    const pers = add('IfcPerson', ['$', ifcS(cfg.author || 'maad'), '$', '$', '$', '$', '$', '$']),
      org = add('IfcOrganization', ['$', ifcS(cfg.org || 'maad'), '$', '$', '$']),
      po = add('IfcPersonAndOrganization', [pers, org, '$']),
      app = add('IfcApplication', [org, ifcS(IFCV.ver), ifcS('maad IFC-Export'), ifcS('maad')]);
    OH = add('IfcOwnerHistory', [
      po,
      app,
      '$',
      '.ADDED.',
      '$',
      '$',
      '$',
      String(Math.floor(Date.now() / 1000)),
    ]);
  }
  // --- Einheiten
  const uL = add('IfcSIUnit', ['*', '.LENGTHUNIT.', '$', '.METRE.']),
    uA = add('IfcSIUnit', ['*', '.AREAUNIT.', '$', '.SQUARE_METRE.']),
    uV = add('IfcSIUnit', ['*', '.VOLUMEUNIT.', '$', '.CUBIC_METRE.']),
    uR = add('IfcSIUnit', ['*', '.PLANEANGLEUNIT.', '$', '.RADIAN.']);
  const dex = add('IfcDimensionalExponents', ['0', '0', '0', '0', '0', '0', '0']),
    mwu = add('IfcMeasureWithUnit', ['IFCPLANEANGLEMEASURE(0.0174532925199433)', uR]),
    uD = add('IfcConversionBasedUnit', [dex, '.PLANEANGLEUNIT.', ifcS('DEGREE'), mwu]);
  const units = add('IfcUnitAssignment', ['(' + [uL, uA, uV, uD].join(',') + ')']);
  // --- Grundbausteine
  const P3 = (x, y, z) => add('IfcCartesianPoint', ['(' + R(x) + ',' + R(y) + ',' + R(z) + ')']),
    P2 = (x, y) => add('IfcCartesianPoint', ['(' + R(x) + ',' + R(y) + ')']);
  const D3 = (x, y, z) =>
    W.once('d' + x + ',' + y + ',' + z, 'IfcDirection', ['(' + R(x) + ',' + R(y) + ',' + R(z) + ')']);
  const ax0 = add('IfcAxis2Placement3D', [P3(0, 0, 0), '$', '$']);
  const ctxM = add('IfcGeometricRepresentationContext', [
    '$',
    ifcS('Model'),
    '3',
    R(1e-5),
    ax0,
    add('IfcDirection', ['(0.,1.)']),
  ]);
  const ctxB = add('IfcGeometricRepresentationSubContext', [
    ifcS('Body'),
    ifcS('Model'),
    '*',
    '*',
    '*',
    '*',
    ctxM,
    '$',
    '.MODEL_VIEW.',
    '$',
  ]);
  const ctxF = add('IfcGeometricRepresentationSubContext', [
    ifcS('FootPrint'),
    ifcS('Model'),
    '*',
    '*',
    '*',
    '*',
    ctxM,
    '$',
    '.PLAN_VIEW.',
    '$',
  ]);
  const place = (rel, x, y, z) =>
    add('IfcLocalPlacement', [
      rel || '$',
      x || y || z ? add('IfcAxis2Placement3D', [P3(x, y, z), '$', '$']) : ax0,
    ]);
  const shape = (ctx, ident, type, items) =>
    add('IfcProductDefinitionShape', [
      '$',
      '$',
      '(' + add('IfcShapeRepresentation', [ctx, ifcS(ident), ifcS(type), '(' + items.join(',') + ')']) + ')',
    ]);
  // Stile, Materialien
  const sty = (hex, tr) =>
    W.once('s' + hex + '|' + (tr || 0), 'IfcSurfaceStyle', [
      ifcS('maad ' + hex),
      '.BOTH.',
      '(' +
        add('IfcSurfaceStyleRendering', [
          W.once('c' + hex, 'IfcColourRgb', ['$', ...ifcHex(hex).map(R)]),
          tr ? R(tr) : '$',
          '$',
          '$',
          '$',
          '$',
          '$',
          '$',
          '.NOTDEFINED.',
        ]) +
        ')',
    ]);
  const style = (item, hex, tr) => {
    if (cfg.col && hex) add('IfcStyledItem', [item, '(' + sty(hex, tr) + ')', '$']);
  };
  const mats = new Map(),
    matU = new Map();
  const mat = (nm, el) => {
    if (!cfg.mats || !nm || !el) return;
    if (!mats.has(nm)) {
      mats.set(nm, add('IfcMaterial', [ifcS(nm), '$', '$']));
      matU.set(nm, []);
    }
    matU.get(nm).push(el);
  };
  // Beziehungen sammeln
  const aggs = new Map(),
    conts = new Map();
  const A = (p, c) => {
      if (!aggs.has(p)) aggs.set(p, []);
      aggs.get(p).push(c);
    },
    C = (p, c) => {
      if (!conts.has(p)) conts.set(p, []);
      conts.get(p).push(c);
    };
  // Eigenschaften
  const tv = (k, v) => {
    switch (k) {
      case 'l':
        return 'IFCLABEL(' + ifcS(String(v).slice(0, 255)) + ')';
      case 't':
        return 'IFCTEXT(' + ifcS(v) + ')';
      case 'r':
        return 'IFCREAL(' + R(v) + ')';
      case 'len':
        return 'IFCLENGTHMEASURE(' + R(v) + ')';
      case 'area':
        return 'IFCAREAMEASURE(' + R(v) + ')';
      case 'vol':
        return 'IFCVOLUMEMEASURE(' + R(v) + ')';
      case 'b':
        return 'IFCBOOLEAN(' + ifcB(v) + ')';
      case 'i':
        return 'IFCINTEGER(' + Math.round(v) + ')';
      case 'id':
        return 'IFCIDENTIFIER(' + ifcS(String(v).slice(0, 255)) + ')';
      case 'ratio':
        return 'IFCRATIOMEASURE(' + R(v) + ')';
      case 'pl':
        return 'IFCPLANEANGLEMEASURE(' + R((v * Math.PI) / 180) + ')';
    }
    return 'IFCLABEL(' + ifcS(v) + ')';
  };
  const attach = (el, key, pdef) =>
    add('IfcRelDefinesByProperties', [guid('rp:' + key), OH, '$', '$', '(' + el + ')', pdef]);
  function pset(el, key, name, props) {
    if (!cfg.psets || !el) return;
    const ids = [];
    for (const p of props) {
      const [n, k, v] = p;
      if (v == null || (typeof v === 'number' && !isFinite(v)) || v === '') continue;
      ids.push(add('IfcPropertySingleValue', [ifcS(n), '$', tv(k, v), '$']));
    }
    if (!ids.length) return;
    attach(
      el,
      key + '|' + name,
      add('IfcPropertySet', [guid('ps:' + key + '|' + name), OH, ifcS(name), '$', '(' + ids.join(',') + ')']),
    );
  }
  function qto(el, key, name, items) {
    if (!cfg.qto || !el) return;
    const ids = [];
    const E_ = {
      len: 'IfcQuantityLength',
      area: 'IfcQuantityArea',
      vol: 'IfcQuantityVolume',
      count: 'IfcQuantityCount',
    };
    for (const [n, k, v] of items) {
      if (v == null || !isFinite(v)) continue;
      ids.push(add(E_[k], [ifcS(n), '$', '$', k === 'count' ? String(Math.round(v)) : R(v), '$']));
    }
    if (!ids.length) return;
    attach(
      el,
      key + '|' + name,
      add('IfcElementQuantity', [
        guid('qt:' + key + '|' + name),
        OH,
        ifcS(name),
        '$',
        '$',
        '(' + ids.join(',') + ')',
      ]),
    );
  }
  // Produkt anlegen (Attributliste je Klasse)
  function pre(k, auto) {
    const cc = cfg.cat[k];
    let p = cc.pre;
    if (p === 'AUTO') p = (auto && auto[cc.cls]) || 'NOTDEFINED';
    const l = IFCCLS[cc.cls] && IFCCLS[cc.cls].pre;
    if (l && !l.includes(p)) p = l.includes('NOTDEFINED') ? 'NOTDEFINED' : l[0];
    return p;
  }
  function prod(cls, o) {
    const g = guid(o.key),
      nm = ifcS(o.name || '-'),
      ds = o.desc ? ifcS(o.desc) : '$',
      ot = o.ot ? ifcS(o.ot) : '$',
      pl = o.pl || '$',
      rp = o.rep || '$',
      p = '.' + (o.pre || 'NOTDEFINED') + '.',
      ln = o.ln ? ifcS(o.ln) : '$',
      tag = o.tag ? ifcS(o.tag) : '$';
    switch (cls) {
      case 'IfcSite':
        return add('IfcSite', [
          g,
          OH,
          nm,
          ds,
          ot,
          pl,
          rp,
          ln,
          p,
          o.lat || '$',
          o.lon || '$',
          o.elev != null ? R(o.elev) : '$',
          '$',
          '$',
        ]);
      case 'IfcBuilding':
        return add('IfcBuilding', [
          g,
          OH,
          nm,
          ds,
          ot,
          pl,
          rp,
          ln,
          p,
          o.elev != null ? R(o.elev) : '$',
          o.elevT != null ? R(o.elevT) : '$',
          '$',
        ]);
      case 'IfcBuildingStorey':
        return add('IfcBuildingStorey', [g, OH, nm, ds, ot, pl, rp, ln, p, R(o.elev || 0)]);
      case 'IfcSpace':
        return add('IfcSpace', [g, OH, nm, ds, ot, pl, rp, ln, '.ELEMENT.', p, '$']);
      case 'IfcCivilElement':
        return add('IfcCivilElement', [g, OH, nm, ds, ot, pl, rp, tag]);
      default:
        return add(cls, [g, OH, nm, ds, ot, pl, rp, tag, p]);
    }
  }
  function otOf(k, fb, p) {
    const o = (cfg.cat[k].ot || '').trim();
    return o || (p === 'USERDEFINED' ? fb : '');
  }
  // Geometrie-Bausteine
  function profile(outer, holes) {
    const pl = (r) =>
      add('IfcPolyline', [
        '(' +
          r
            .concat([r[0]])
            .map((q) => P2(q[0], q[1]))
            .join(',') +
          ')',
      ]);
    const o = pl(outer);
    return holes && holes.length
      ? add('IfcArbitraryProfileDefWithVoids', ['.AREA.', '$', o, '(' + holes.map(pl).join(',') + ')'])
      : add('IfcArbitraryClosedProfileDef', ['.AREA.', '$', o]);
  }
  function extrude(prof, z0, h) {
    return add('IfcExtrudedAreaSolid', [
      prof,
      z0 ? add('IfcAxis2Placement3D', [P3(0, 0, z0), '$', '$']) : ax0,
      D3(0, 0, 1),
      R(h),
    ]);
  }
  function tess(tris, o, closed) {
    const w = ifcWeld(tris, o);
    if (!w.I.length) return null;
    const pl = add('IfcCartesianPointList3D', [
      '(' + w.V.map((v) => '(' + R(v[0]) + ',' + R(v[1]) + ',' + R(v[2]) + ')').join(',') + ')',
    ]);
    return {
      item: add('IfcTriangulatedFaceSet', [
        pl,
        '$',
        closed ? '.T.' : '.F.',
        '(' + w.I.map((t) => '(' + (t[0] + 1) + ',' + (t[1] + 1) + ',' + (t[2] + 1) + ')').join(',') + ')',
        '$',
      ]),
      V: w.V,
      I: w.I,
    };
  }
  const footprint = (poly) => {
    const pts = poly.concat([poly[0]]).map((q) => P3(q[0], -q[1], gh(q[0], q[1]) + zOff)),
      cs = add('IfcGeometricCurveSet', ['(' + add('IfcPolyline', ['(' + pts.join(',') + ')']) + ')']);
    return add('IfcProductDefinitionShape', [
      '$',
      '$',
      '(' +
        add('IfcShapeRepresentation', [ctxF, ifcS('FootPrint'), ifcS('GeometricCurveSet'), '(' + cs + ')']) +
        ')',
    ]);
  };
  const lonlat = (x, z) => [lon0 + x / GEO.kx, lat0 - z / 110574];
  // ======================================================================
  // Projekt, Georeferenz, Standort
  // ======================================================================
  const proj = add('IfcProject', [
    guid('project'),
    OH,
    ifcS(projName),
    '$',
    '$',
    ifcS((S.project && S.project.label) || ''),
    ifcS(cfg.phase || ''),
    '(' + ctxM + ')',
    units,
  ]);
  let crsInfo = null;
  if (cfg.georef === 'crs' && hasGeo) {
    try {
      const zone = Math.floor((lon0 + 180) / 6) + 1,
        de = lon0 > 5.5 && lon0 < 15.5,
        epsg = de ? 25800 + zone : 32600 + zone,
        name = 'EPSG:' + epsg,
        [E0, N0] = ll2utm(lon0, lat0, zone);
      const lam = ((lon0 - ((zone - 1) * 6 - 180 + 3)) * Math.PI) / 180,
        ph = (lat0 * Math.PI) / 180,
        gam = Math.atan(Math.tan(lam) * Math.sin(ph)),
        kS = 0.9996 * (1 + Math.pow((E0 - 5e5) / (0.9996 * 6371000), 2) / 2);
      const mLat = 111132.92 - 559.82 * Math.cos(2 * ph) + 1.175 * Math.cos(4 * ph),
        mLon = 111412.84 * Math.cos(ph) - 93.5 * Math.cos(3 * ph) + 0.118 * Math.cos(5 * ph),
        rY = mLat / 110574,
        rX = mLon / GEO.kx,
        rM = Math.sqrt(rX * rY);
      if (isFinite(E0) && isFinite(N0)) {
        const crs = add('IfcProjectedCRS', [
          ifcS(name),
          ifcS((de ? 'ETRS89' : 'WGS 84') + ' / UTM zone ' + zone + 'N'),
          ifcS(de ? 'ETRS89' : 'WGS84'),
          de ? ifcS('DHHN2016') : '$',
          ifcS('UTM'),
          ifcS(zone + 'N'),
          uL,
        ]);
        add('IfcMapConversion', [
          ctxM,
          crs,
          R(E0),
          R(N0),
          R(cfg.hAbs ? 0 : GEO.e0 || 0),
          R(Math.cos(gam)),
          R(Math.sin(gam)),
          R(kS * rM),
        ]);
        crsInfo = {
          name,
          zone,
          E0,
          N0,
          gam: (gam * 180) / Math.PI,
          h: cfg.hAbs ? 0 : GEO.e0 || 0,
          rX,
          rY,
          rM,
        };
        if (Math.abs(rX - 1) > 0.001 || Math.abs(rY - 1) > 0.001)
          warn.push(
            'Hinweis Georeferenz: Die Szenenmeter des Tools weichen von echten Kartenmetern ab (Nord–Süd ' +
              f1((rY - 1) * 100, 2) +
              ' %, Ost–West ' +
              f1((rX - 1) * 100, 2) +
              ' %). IfcMapConversion nutzt den mittleren Maßstab ' +
              f1(rM, 5) +
              '; je 1 km Abstand vom Standort bleiben ca. ' +
              f1((Math.abs(rY - rX) / 2) * 1000, 1) +
              ' m Restabweichung. Die Modellmaße selbst bleiben unverändert.',
          );
      }
    } catch (e) {
      warn.push('Georeferenzierung nicht möglich: ' + e.message);
    }
  } else if (cfg.georef === 'crs' && !hasGeo)
    warn.push('Kein Standort (Lat/Lon) vorhanden – nur lokale Koordinaten.');
  const plS = place(null, 0, 0, 0);
  const site = prod('IfcSite', {
    key: 'site:root',
    name: siteName,
    desc: 'Standort/Planungsausschnitt aus maad',
    pl: plS,
    ln: projName,
    pre:
      (on('site') && src.sites.length) || (on('flst') && src.fl.length && cfg.cat.flst.cls === 'IfcSite')
        ? 'COMPLEX'
        : 'ELEMENT',
    lat: hasGeo ? ifcDms(lat0) : null,
    lon: hasGeo ? ifcDms(lon0) : null,
    elev: GEO.e0 != null ? GEO.e0 : null,
  });
  A(proj, site);
  bump('IfcSite');
  pset(site, 'site:root', 'lot_Standort', [
    ['Breitengrad', 'r', hasGeo ? lat0 : null],
    ['Längengrad', 'r', hasGeo ? lon0 : null],
    ['Höhe Kartenmitte ü. NHN', 'len', GEO.e0 != null ? GEO.e0 : null],
    ['Kantenlänge Ausschnitt', 'len', GEO.grid ? GEO.size : null],
    ['Höhenmodell', 't', GEO.terrMsg || null],
    ['Koordinatensystem', 'l', crsInfo ? crsInfo.name : 'lokal'],
    ['Erzeugt mit', 'l', 'maad IFC-Export ' + IFCV.ver],
  ]);
  await yld();
  // ======================================================================
  // Grundstücke (Flurstücke) -> IfcSite unter dem Standort
  // ======================================================================
  const plotOf = new Map(),
    plotPl = new Map();
  function mkPlot(p, k, cls, kind) {
    const key = (kind === 'flst' ? 'fl:' : 'plot:') + (p.id || p.name);
    const c = cen(p.poly),
      ll = hasGeo ? lonlat(c[0], c[1]) : null,
      A_ = area(p.poly),
      pl = place(plS, 0, 0, 0);
    const inB = src.bld.filter((x) => inP(cen(x.fp), p.poly)),
      fpA = inB.reduce((s, x) => s + larea(x, x.levels[0]), 0);
    let gfa = 0;
    try {
      gfa = inB.reduce((s, x) => s + bgfOiOf(x), 0);
    } catch (e) {
      logErr(e, 'mkPlot');
    }
    const rep = footprint(p.poly);
    let per = 0;
    p.poly.forEach((q, i) => {
      const r = p.poly[(i + 1) % p.poly.length];
      per += Math.hypot(r[0] - q[0], r[1] - q[1]);
    });
    const pr = pre(k),
      el = prod(cls, {
        key,
        name: p.name || 'Grundstück ' + (p.id || ''),
        desc: kind === 'flst' ? 'Flurstück (ALKIS)' : 'Grundstück',
        ot: otOf(k, kind === 'flst' ? 'Flurstück' : 'Grundstück', pr),
        pl,
        rep,
        pre: pr,
        ln: p.id || '',
        lat: ll ? ifcDms(ll[1]) : null,
        lon: ll ? ifcDms(ll[0]) : null,
        elev: gh(c[0], c[1]) + zOff,
      });
    if (cls === 'IfcSite') A(site, el);
    else C(site, el);
    bump(cls);
    plotPl.set(el, pl);
    pset(el, key, 'Pset_SiteCommon', [
      ['Reference', 'id', p.id || ''],
      ['TotalArea', 'area', A_],
      ['SiteCoverageRatio', 'ratio', kind === 'flst' ? null : A_ ? fpA / A_ : null],
      ['FloorAreaRatio', 'ratio', kind === 'flst' ? null : A_ ? gfa / A_ : null],
    ]);
    qto(el, key, 'Qto_SiteBaseQuantities', [
      ['GrossArea', 'area', A_],
      ['GrossPerimeter', 'len', per],
    ]);
    pset(el, key, 'lot_Grundstueck', [
      ['Flurstücke', 't', p.fl && p.fl.length ? p.fl.join(', ') : kind === 'flst' ? p.id || '' : null],
      ['Anzahl Planungsgebäude', 'i', kind === 'flst' ? null : inB.length],
      ['Überbaute Fläche', 'area', kind === 'flst' ? null : fpA],
    ]);
    return el;
  }
  if (on('site')) for (const p of src.sites) plotOf.set(p, mkPlot(p, 'site', cfg.cat.site.cls, 'site'));
  if (on('flst')) for (const p of src.fl) mkPlot(p, 'flst', cfg.cat.flst.cls, 'flst');
  await yld();
  prog(0.1, 'Grundstücke');
  // ======================================================================
  // Planungsgebäude: IfcBuilding > IfcBuildingStorey > Räume/Wände/Decken/Dach
  // ======================================================================
  const tW = Math.max(0.05, +cfg.wallT || 0.3),
    tS = Math.max(0.05, +cfg.slabT || 0.25),
    CB = { wall: '#ebe8e1', slab: '#c8c5bc', roof: '#b3563b' };
  let nB = 0;
  for (const [bi, b] of src.bld.entries()) {
    try {
      const ugH = b.levels.reduce((t, l) => t + (l.ug ? l.h : 0), 0),
        y0 = base(b) - ugH,
        key = 'b:' + (b.id || bi),
        bn = b.name || b.id || 'Gebäude ' + (bi + 1);
      const lo = [],
        hi = [];
      let z = y0 + zOff;
      b.levels.forEach((l, i) => {
        lo[i] = z;
        z += l.h;
        hi[i] = z;
      });
      const iEG = Math.max(
          0,
          b.levels.findIndex((l) => !l.ug),
        ),
        Zb = lo[iEG],
        zTop = hi[hi.length - 1];
      const outer = ifcCCW(ifcClean(ifcRing(b.fp))),
        oc = [
          outer.reduce((s, p) => s + p[0], 0) / outer.length,
          outer.reduce((s, p) => s + p[1], 0) / outer.length,
        ];
      const plot = [...plotOf.keys()].find((p) => inP(cen(b.fp), p.poly));
      const parent = plot ? plotOf.get(plot) : site;
      const bPl = place(plotPl.get(parent) || plS, oc[0], oc[1], Zb);
      const bp = pre('pbld'),
        bEl = prod('IfcBuilding', {
          key,
          name: bn,
          desc: b.use ? 'Nutzung: ' + b.use : '',
          ot: otOf('pbld', 'Gebäude', bp),
          pl: bPl,
          pre: bp,
          ln: b.id || '',
          elev: Zb,
          elevT: base(b) + zOff,
        });
      A(parent, bEl);
      bump('IfcBuilding');
      nB++;
      let bgf = 0,
        bgfO = 0;
      try {
        bgf = bgfOf(b);
        bgfO = bgfOiOf(b);
      } catch (e) {
        logErr(e, 'ifcBuild');
      }
      const fpA = area(lf(b, b.levels[iEG]));
      const hTot = b._hTot != null ? b._hTot : zTop - lo[0];
      pset(bEl, key, 'Pset_BuildingCommon', [
        ['BuildingID', 'id', b.id || ''],
        ['NumberOfStoreys', 'i', b.levels.filter((l) => !l.ug).length],
        ['GrossPlannedArea', 'area', bgf],
      ]);
      pset(bEl, key, 'lot_Gebaeude', [
        ['Nutzung', 'l', b.use || ''],
        ['BGF gesamt', 'area', bgf],
        ['BGF oberirdisch', 'area', bgfO],
        ['Geschosse unterirdisch', 'i', b.levels.filter((l) => l.ug).length],
        ['Gesamthöhe', 'len', hTot],
        ['Dachform', 'l', (b.roof && b.roof.type) || 'flat'],
        ['Gebäudetyp', 'l', b.kind || ''],
      ]);
      qto(bEl, key, 'Qto_BuildingBaseQuantities', [
        ['Height', 'len', hTot],
        ['FootprintArea', 'area', fpA],
        ['GrossFloorArea', 'area', bgf],
        ['GrossVolume', 'vol', b.levels.reduce((t, l) => t + larea(b, l) * l.h, 0)],
      ]);
      const stEls = [];
      for (const [i, l] of b.levels.entries()) {
        const sn = l.name || 'Geschoss ' + i,
          sk = key + '|s' + i,
          use = l.use || b.use || 'Wohnen',
          stPl = place(bPl, 0, 0, lo[i] - Zb),
          sp = pre('pst');
        const stEl = prod('IfcBuildingStorey', {
          key: sk,
          name: sn,
          desc: l.ug ? 'Untergeschoss' : '',
          ot: otOf('pst', 'Geschoss', sp),
          pl: stPl,
          pre: sp,
          ln: use,
          elev: lo[i],
        });
        A(bEl, stEl);
        bump('IfcBuildingStorey');
        stEls.push(stEl);
        const fpO = ifcCCW(ifcClean(ifcRing(lf(b, l)))).map((q) => [q[0] - oc[0], q[1] - oc[1]]),
          fpI = ifcInset(fpO, tW),
          ring = fpI || fpO,
          Ao = ifcSA(fpO),
          Ai = ifcSA(ring);
        let perI = 0;
        ring.forEach((q, j) => {
          const r = ring[(j + 1) % ring.length];
          perI += Math.hypot(r[0] - q[0], r[1] - q[1]);
        });
        pset(stEl, sk, 'Pset_BuildingStoreyCommon', [
          ['Reference', 'id', sn],
          ['AboveGround', 'b', !l.ug],
        ]);
        pset(stEl, sk, 'lot_Geschoss', [
          ['Nutzung', 'l', use],
          ['Geschosshöhe', 'len', l.h],
          ['Unterirdisch', 'b', !!l.ug],
        ]);
        qto(stEl, sk, 'Qto_BuildingStoreyBaseQuantities', [
          ['GrossHeight', 'len', l.h],
          ['NetHeight', 'len', l.h - tS],
          ['GrossFloorArea', 'area', Ao],
          ['NetFloorArea', 'area', Ai],
          ['GrossVolume', 'vol', Ao * l.h],
          ['NetVolume', 'vol', Ai * (l.h - tS)],
        ]);
        const col = S.uses[use] || '#cccccc';
        // Raum (Geschossvolumen)
        if (on('psp')) {
          const hN = Math.max(0.1, l.h - tS),
            cl = cfg.cat.psp.cls,
            p_ = pre('psp'),
            it = extrude(profile(ring), 0, hN);
          style(it, col, 0.55);
          const rep = shape(ctxB, 'Body', 'SweptSolid', [it]),
            el = prod(cl, {
              key: sk + '|sp',
              name: sn + ' – ' + use,
              desc: 'Geschossvolumen (Nutzung ' + use + ')',
              ot: otOf('psp', 'Geschossvolumen', p_),
              pl: place(stPl, 0, 0, 0),
              rep,
              pre: p_,
              ln: use,
              tag: sk,
            });
          if (cl === 'IfcSpace') A(stEl, el);
          else C(stEl, el);
          bump(cl);
          pset(el, sk + '|sp', 'Pset_SpaceCommon', [
            ['Reference', 'id', sn],
            ['IsExternal', 'b', false],
            ['GrossPlannedArea', 'area', Ao],
            ['NetPlannedArea', 'area', Ai],
          ]);
          pset(el, sk + '|sp', 'maad_Nutzung', [['Nutzung', 'l', use]]);
          qto(el, sk + '|sp', 'Qto_SpaceBaseQuantities', [
            ['Height', 'len', hN],
            ['GrossFloorArea', 'area', Ao],
            ['NetFloorArea', 'area', Ai],
            ['GrossVolume', 'vol', Ao * hN],
            ['NetVolume', 'vol', Ai * hN],
            ['NetPerimeter', 'len', perI],
          ]);
          mat('Geschossvolumen ' + use, el);
        }
        // Außenwände
        if (on('pwl')) {
          if (!fpI) warn.push(bn + ' / ' + sn + ': Wandversatz nicht berechenbar – keine Außenwände.');
          else {
            const cl = cfg.cat.pwl.cls,
              p_ = pre('pwl');
            for (let j = 0; j < fpO.length; j++) {
              const a = fpO[j],
                c = fpO[(j + 1) % fpO.length],
                len = Math.hypot(c[0] - a[0], c[1] - a[1]);
              if (len < 0.05) continue;
              let q = [a, c, fpI[(j + 1) % fpO.length], fpI[j]];
              if (ifcSA(q) < 0) q = q.reverse();
              const ar = ifcSA(q);
              if (ar < 1e-4) continue;
              const it = extrude(profile(q), 0, l.h);
              style(it, CB.wall);
              const el = prod(cl, {
                key: sk + '|w' + j,
                name: 'Außenwand ' + sn + ' ' + (j + 1),
                ot: otOf('pwl', 'Außenwand', p_),
                pl: place(stPl, 0, 0, 0),
                rep: shape(ctxB, 'Body', 'SweptSolid', [it]),
                pre: p_,
                tag: sk + '.W' + (j + 1),
              });
              C(stEl, el);
              bump(cl);
              pset(el, sk + '|w' + j, 'Pset_WallCommon', [
                ['IsExternal', 'b', true],
                ['Reference', 'id', 'Außenwand'],
              ]);
              qto(el, sk + '|w' + j, 'Qto_WallBaseQuantities', [
                ['Length', 'len', len],
                ['Width', 'len', tW],
                ['Height', 'len', l.h],
                ['GrossSideArea', 'area', len * l.h],
                ['NetSideArea', 'area', len * l.h],
                ['GrossVolume', 'vol', ar * l.h],
                ['NetVolume', 'vol', ar * l.h],
                ['GrossFootprintArea', 'area', ar],
              ]);
              mat('Außenwand', el);
            }
          }
        }
        // Bodenplatte unter dem untersten Geschoss
        if (on('psl') && i === 0) {
          const cl = cfg.cat.psl.cls,
            p_ = pre('psl', { IfcSlab: 'BASESLAB' }),
            it = extrude(profile(fpO), -tS, tS);
          style(it, CB.slab);
          const el = prod(cl, {
            key: sk + '|base',
            name: 'Bodenplatte',
            ot: otOf('psl', 'Bodenplatte', p_),
            pl: place(stPl, 0, 0, 0),
            rep: shape(ctxB, 'Body', 'SweptSolid', [it]),
            pre: p_,
            tag: sk + '.BP',
          });
          C(stEl, el);
          bump(cl);
          pset(el, sk + '|base', 'Pset_SlabCommon', [
            ['IsExternal', 'b', false],
            ['Reference', 'id', 'Bodenplatte'],
          ]);
          qto(el, sk + '|base', 'Qto_SlabBaseQuantities', [
            ['Width', 'len', tS],
            ['GrossArea', 'area', Ao],
            ['NetArea', 'area', Ao],
            ['GrossVolume', 'vol', Ao * tS],
            ['NetVolume', 'vol', Ao * tS],
          ]);
          mat('Bodenplatte', el);
        }
        // Decke über dem Geschoss (bei Flachdach oben = Dachplatte)
        const last = i === b.levels.length - 1,
          flat = !b.roof || !b.roof.type || b.roof.type === 'flat';
        if (!last || !flat) {
          if (on('psl')) {
            const cl = cfg.cat.psl.cls,
              p_ = pre('psl', { IfcSlab: 'FLOOR' }),
              it = extrude(profile(ring), l.h - tS, tS);
            style(it, CB.slab);
            const el = prod(cl, {
              key: sk + '|top',
              name: 'Decke über ' + sn,
              ot: otOf('psl', 'Geschossdecke', p_),
              pl: place(stPl, 0, 0, 0),
              rep: shape(ctxB, 'Body', 'SweptSolid', [it]),
              pre: p_,
              tag: sk + '.D',
            });
            C(stEl, el);
            bump(cl);
            pset(el, sk + '|top', 'Pset_SlabCommon', [
              ['IsExternal', 'b', false],
              ['Reference', 'id', 'Geschossdecke'],
            ]);
            qto(el, sk + '|top', 'Qto_SlabBaseQuantities', [
              ['Width', 'len', tS],
              ['GrossArea', 'area', Ai],
              ['NetArea', 'area', Ai],
              ['GrossVolume', 'vol', Ai * tS],
              ['NetVolume', 'vol', Ai * tS],
            ]);
            mat('Geschossdecke', el);
          }
        } else if (on('prf')) {
          const cl = cfg.cat.prf.cls,
            p_ = pre('prf', { IfcRoof: 'FLAT_ROOF', IfcSlab: 'ROOF' }),
            it = extrude(profile(ring), l.h - tS, tS);
          style(it, CB.roof);
          const el = prod(cl, {
            key: sk + '|roof',
            name: 'Flachdach',
            ot: otOf('prf', 'Dach', p_),
            pl: place(stPl, 0, 0, 0),
            rep: shape(ctxB, 'Body', 'SweptSolid', [it]),
            pre: p_,
            tag: sk + '.DA',
          });
          C(stEl, el);
          bump(cl);
          pset(el, sk + '|roof', 'Pset_RoofCommon', [
            ['IsExternal', 'b', true],
            ['Reference', 'id', 'Flachdach'],
          ]);
          pset(el, sk + '|roof', 'maad_Dach', [['Dachform', 'l', 'Flachdach']]);
          qto(el, sk + '|roof', 'Qto_RoofBaseQuantities', [
            ['GrossArea', 'area', Ai],
            ['NetArea', 'area', Ai],
            ['ProjectedArea', 'area', Ai],
          ]);
          mat('Dach', el);
        }
      }
      // Geneigtes Dach (Hülle) + Giebelwände aus der Dachgeometrie des Tools
      if (b.roof && b.roof.type && b.roof.type !== 'flat') {
        const rg = roofGeo(b, y0 + b.levels.reduce((t, l) => t + l.h, 0));
        if (rg) {
          const iL = b.levels.length - 1,
            stPl = place(bPl, 0, 0, lo[iL] - Zb);
          const o = [oc[0], oc[1], lo[iL]];
          if (on('prf') && rg.pr.length) {
            const tr = tess(ifcSoup(rg.pr, zOff), o, false);
            if (tr) {
              style(tr.item, CB.roof);
              const cl = cfg.cat.prf.cls,
                RM = { pult: 'SHED_ROOF', sattel: 'GABLE_ROOF', walm: 'HIP_ROOF' },
                p_ = pre('prf', { IfcRoof: RM[b.roof.type] || 'NOTDEFINED', IfcSlab: 'ROOF' });
              const el = prod(cl, {
                key: key + '|roof',
                name: 'Dach ' + bn,
                ot: otOf('prf', 'Dach', p_),
                pl: place(stPl, 0, 0, 0),
                rep: shape(ctxB, 'Body', 'Tessellation', [tr.item]),
                pre: p_,
                tag: key + '.DA',
              });
              C(stEls[iL], el);
              bump(cl);
              const rt = (RT.find((t) => t[0] === b.roof.type) || [0, b.roof.type])[1];
              pset(el, key + '|roof', 'Pset_RoofCommon', [
                ['IsExternal', 'b', true],
                ['Reference', 'id', rt],
              ]);
              pset(el, key + '|roof', 'maad_Dach', [
                ['Dachform', 'l', rt],
                ['Dachneigung', 'pl', b.roof.angle],
                ['Drempelhöhe', 'len', +b.roof.dremp || 0],
                [
                  'Firstrichtung',
                  'pl',
                  (() => {
                    try {
                      return roofDir(b);
                    } catch (_) {
                      return null;
                    }
                  })(),
                ],
                ['Firsthöhe über Oberkante Geschoss', 'len', rg.h],
                ['Dachfläche', 'area', rg.aR],
                ['anrechenbare Wohnfläche im Dach', 'area', b._roofA && b._roofA.wf],
              ]);
              qto(el, key + '|roof', 'Qto_RoofBaseQuantities', [
                ['GrossArea', 'area', rg.aR],
                ['NetArea', 'area', rg.aR],
                ['ProjectedArea', 'area', fpA],
              ]);
              mat('Dach', el);
            }
          }
          if (on('pwl') && rg.pw.length) {
            const tr = tess(ifcSoup(rg.pw, zOff), o, false);
            if (tr) {
              style(tr.item, CB.wall);
              const cl = cfg.cat.pwl.cls,
                p_ = pre('pwl');
              const el = prod(cl, {
                key: key + '|giebel',
                name: 'Giebelwand ' + bn,
                ot: otOf('pwl', 'Giebelwand', p_),
                pl: place(stPl, 0, 0, 0),
                rep: shape(ctxB, 'Body', 'Tessellation', [tr.item]),
                pre: p_,
                tag: key + '.GW',
              });
              C(stEls[iL], el);
              bump(cl);
              pset(el, key + '|giebel', 'Pset_WallCommon', [
                ['IsExternal', 'b', true],
                ['Reference', 'id', 'Giebelwand'],
              ]);
              qto(el, key + '|giebel', 'Qto_WallBaseQuantities', [
                ['GrossSideArea', 'area', rg.aW],
                ['NetSideArea', 'area', rg.aW],
              ]);
              mat('Außenwand', el);
            }
          }
        }
      }
    } catch (e) {
      warn.push('Gebäude ' + (b.name || b.id) + ': ' + (e.message || e));
      console.warn(e);
    }
    await yld();
    prog(0.1 + (0.25 * (bi + 1)) / Math.max(1, src.bld.length), 'Planung');
  }
  prog(0.35, 'Planung fertig');
  // ======================================================================
  // Umgebungsgebäude
  // ======================================================================
  if (on('ctxb')) {
    const cl = cfg.cat.ctxb.cls,
      cc = src.ctx;
    let n = 0;
    const cont = [];
    for (const [ci, b] of cc.entries()) {
      try {
        const o2 = b.o,
          c = cen(o2),
          key = 'c:' + (b.exId || Math.round(c[0] * 10) + '_' + Math.round(c[1] * 10)),
          oi = ifcCCW(ifcClean(ifcRing(o2)));
        let z0 = 1e9;
        for (const q of o2) z0 = Math.min(z0, gh(q[0], q[1]));
        if (!isFinite(z0)) z0 = 0;
        z0 += zOff;
        const oc = [
            oi.reduce((s, p) => s + p[0], 0) / oi.length,
            oi.reduce((s, p) => s + p[1], 0) / oi.length,
          ],
          org = [oc[0], oc[1], z0];
        let it = null,
          vol = 0,
          hh = b.h,
          lod = 'Kubatur';
        const aFp = area(o2);
        if (b.tris && cfg.ctxLod === 'lod2') {
          const geo = triGeo(b),
            tr = tess(ifcSoup(geo.attributes.position.array, zOff), org, false);
          geo.dispose();
          if (tr) {
            it = tr.item;
            lod = 'LoD2';
          }
        }
        if (!it) {
          const dep = b.minh > 0 ? b.h - b.minh : b.h;
          if (!(dep > 0.3)) continue;
          const holes = (b.holes || [])
            .map((r) =>
              ifcCCW(ifcClean(ifcRing(r)))
                .slice()
                .reverse()
                .map((q) => [q[0] - oc[0], q[1] - oc[1]]),
            )
            .filter((r) => r.length > 2);
          const pf = profile(
            oi.map((q) => [q[0] - oc[0], q[1] - oc[1]]),
            holes,
          );
          it = extrude(pf, b.minh > 0 ? b.minh : 0, dep);
          vol = aFp * dep;
          hh = dep;
        }
        style(it, S.lc.buildings);
        const pr_ = pre('ctxb'),
          p = b.p || {},
          nm = String(
            p.name ||
              p.Name ||
              (p['addr:street'] ? p['addr:street'] + ' ' + (p['addr:housenumber'] || '') : '') ||
              'Umgebungsgebäude ' + (ci + 1),
          ).trim();
        const rep = shape(ctxB, 'Body', lod === 'LoD2' ? 'Tessellation' : 'SweptSolid', [it]),
          el = prod(cl, {
            key,
            name: nm,
            desc: 'Umgebungsgebäude (' + lod + ')',
            ot: otOf('ctxb', 'Umgebungsgebäude', pr_),
            pl: place(plS, oc[0], oc[1], z0),
            rep,
            pre: pr_,
            tag: 'C' + (ci + 1),
          });
        if (cl === 'IfcBuilding') A(site, el);
        else cont.push(el);
        bump(cl);
        n++;
        const pp = [
          ['Quelle', 'l', p.src || (b.tris ? 'LoD2 (CityGML)' : '')],
          ['Geometrie', 'l', lod],
          ['Höhe', 'len', b.h],
          ['Höhe geschätzt', 'b', !!b.est],
          ['Grundfläche', 'area', aFp],
          ['Bestandsgebäude (Projekt)', 'b', !!b.ex],
        ];
        for (const k in p) {
          const v = p[k];
          if (k === 'src' || v == null || typeof v === 'object') continue;
          pp.push([k, 'l', v]);
        }
        pset(el, key, 'lot_Umgebung', pp);
        qto(el, key, 'BaseQuantities', [
          ['Height', 'len', hh],
          ['GrossFootprintArea', 'area', aFp],
          ['GrossVolume', 'vol', vol || null],
        ]);
        mat('Umgebungsgebäude', el);
      } catch (e) {
        warn.push('Umgebungsgebäude ' + (ci + 1) + ': ' + (e.message || e));
      }
      if (ci % 200 === 199) {
        await yld();
        prog(0.35 + (0.2 * ci) / cc.length, 'Umgebungsgebäude');
      }
    }
    cont.forEach((e) => C(site, e));
    st.ctxN = n;
  }
  prog(0.55, 'Umgebung');
  // ======================================================================
  // Bäume (eine gemeinsame Kronen-Geometrie, je Baum nur Transformation)
  // ======================================================================
  if (on('tree') && src.trees.length) {
    const cl = cfg.cat.tree.cls,
      ic = new T.IcosahedronGeometry(1, cfg.treeDetail | 0),
      tris = ifcSoup(ic.attributes.position.array, 0);
    ic.dispose();
    const tr = tess(tris, [0, 0, 0], true);
    if (tr) {
      style(tr.item, S.lc.trees);
      const body = add('IfcShapeRepresentation', [
          ctxB,
          ifcS('Body'),
          ifcS('Tessellation'),
          '(' + tr.item + ')',
        ]),
        map = add('IfcRepresentationMap', [ax0, body]),
        cont = [];
      for (const [ti, t] of src.trees.entries()) {
        const h = Math.max(1.5, t.h),
          cr = Math.max(1, t.r),
          gz = gh(t.x, t.z) + zOff,
          key = 't:' + Math.round(t.x * 10) + '_' + Math.round(t.z * 10);
        const op = add('IfcCartesianTransformationOperator3DnonUniform', [
            '$',
            '$',
            P3(0, 0, h / 2),
            R(cr),
            '$',
            R(cr),
            R(h / 2),
          ]),
          mi = add('IfcMappedItem', [map, op]),
          pr_ = pre('tree');
        const el = prod(cl, {
          key,
          name: t.sp ? String(t.sp) : 'Baum ' + (ti + 1),
          desc: 'Baum',
          ot: otOf('tree', 'Baum', pr_),
          pl: place(plS, t.x, -t.z, gz),
          rep: shape(ctxB, 'Body', 'MappedRepresentation', [mi]),
          pre: pr_,
          tag: 'T' + (ti + 1),
        });
        cont.push(el);
        bump(cl);
        pset(el, key, 'lot_Baum', [
          ['Höhe', 'len', h],
          ['Kronenradius', 'len', cr],
          ['Art', 'l', t.sp || null],
          [
            'Quelle',
            'l',
            t.src === 'osm'
              ? 'OpenStreetMap'
              : t.src === 'kataster'
                ? 'Baumkataster'
                : t.src === 'gpkg'
                  ? 'Baumdatei (GeoPackage)'
                  : 'Kronenmodell DOM1−DGM1',
          ],
        ]);
        mat('Baum', el);
        if (ti % 400 === 399) {
          await yld();
          prog(0.55 + (0.1 * ti) / src.trees.length, 'Bäume');
        }
      }
      cont.forEach((e) => C(site, e));
    }
  }
  prog(0.65, 'Bäume');
  // ======================================================================
  // Flächen (Straße, Platz, Grün, Wasser) – dem Gelände aufgelegt
  // ======================================================================
  if (on('area')) {
    const cl = cfg.cat.area.cls;
    for (const [ai, a] of src.areas.entries()) {
      try {
        const ty = AT[a.type] || AT.green,
          tr0 = ifcPolyTris(a.poly, 5);
        if (!tr0.length) continue;
        const tris = tr0.map((t) => {
          const T3 = t.map((q) => [q[0], -q[1], gh(q[0], q[1]) + zOff + 0.02]),
            cr =
              (T3[1][0] - T3[0][0]) * (T3[2][1] - T3[0][1]) - (T3[1][1] - T3[0][1]) * (T3[2][0] - T3[0][0]);
          return cr < 0 ? [T3[0], T3[2], T3[1]] : T3;
        });
        const tr = tess(tris, [0, 0, 0], false);
        if (!tr) continue;
        style(tr.item, ty.c());
        const pr_ = pre('area'),
          key = 'a:' + (a.id || ai);
        const el = prod(cl, {
          key,
          name: a.name || ty.n,
          desc: ty.n,
          ot: otOf('area', ty.n, pr_),
          pl: place(plS, 0, 0, 0),
          rep: shape(ctxB, 'Body', 'Tessellation', [tr.item]),
          pre: pr_,
          tag: a.id || '',
        });
        C(site, el);
        bump(cl);
        pset(el, key, 'lot_Flaeche', [
          ['Art', 'l', ty.n],
          ['Fläche', 'area', area(a.poly)],
          ['Breite', 'len', a.type === 'road' ? a.w : null],
        ]);
        qto(el, key, 'BaseQuantities', [['GrossArea', 'area', area(a.poly)]]);
        mat(ty.n, el);
      } catch (e) {
        warn.push('Fläche ' + (a.name || ai) + ': ' + (e.message || e));
      }
    }
  }
  prog(0.72, 'Flächen');
  await yld();
  // ======================================================================
  // Gelände
  // ======================================================================
  if (on('terrain')) {
    try {
      const size = GEO.grid ? GEO.size : 600,
        N0 = GEO.grid ? GEO.N : 60,
        step0 = size / N0,
        n = Math.max(2, Math.round(size / (step0 * (+cfg.terrStep || 1)))),
        step = size / n,
        h = size / 2;
      let i0 = 0,
        i1 = n,
        j0 = 0,
        j1 = n;
      if (+cfg.terrR > 0 && src.foc.length) {
        let x0 = 1e9,
          x1 = -1e9,
          z0 = 1e9,
          z1 = -1e9;
        src.foc.forEach((p) =>
          p.forEach((q) => {
            x0 = Math.min(x0, q[0]);
            x1 = Math.max(x1, q[0]);
            z0 = Math.min(z0, q[1]);
            z1 = Math.max(z1, q[1]);
          }),
        );
        const Rr = +cfg.terrR;
        i0 = Math.max(0, Math.floor((x0 - Rr + h) / step));
        i1 = Math.min(n, Math.ceil((x1 + Rr + h) / step));
        j0 = Math.max(0, Math.floor((z0 - Rr + h) / step));
        j1 = Math.min(n, Math.ceil((z1 + Rr + h) / step));
      }
      if (i1 - i0 < 1 || j1 - j0 < 1) {
        warn.push('Geländeausschnitt leer – ganzes Modell verwendet.');
        i0 = 0;
        i1 = n;
        j0 = 0;
        j1 = n;
      }
      const w = i1 - i0 + 1,
        V = [];
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = -h + i * step,
            zz = -h + j * step;
          V.push([x, -zz, gh(x, zz) + zOff]);
        }
      const tris = [];
      for (let j = 0; j < j1 - j0; j++)
        for (let i = 0; i < i1 - i0; i++) {
          const a = V[j * w + i],
            b2 = V[j * w + i + 1],
            c = V[(j + 1) * w + i + 1],
            d = V[(j + 1) * w + i];
          if (((i + j) & 1) === 0) tris.push([a, d, c], [a, c, b2]);
          else tris.push([a, d, b2], [b2, d, c]);
        }
      const tr = tess(tris, [0, 0, 0], false);
      if (tr) {
        style(tr.item, S.lc.terrain);
        const cl = cfg.cat.terrain.cls,
          pr_ = pre('terrain');
        const el = prod(cl, {
          key: 'terrain',
          name: 'Gelände',
          desc: 'Geländeoberfläche (Dreiecksnetz)',
          ot: otOf('terrain', 'Gelände', pr_),
          pl: place(plS, 0, 0, 0),
          rep: shape(ctxB, 'Body', 'Tessellation', [tr.item]),
          pre: pr_,
          tag: 'GELAENDE',
        });
        C(site, el);
        bump(cl);
        pset(el, 'terrain', 'lot_Gelaende', [
          ['Netzweite', 'len', step],
          ['Dreiecke', 'i', tr.I.length],
          ['Punkte', 'i', tr.V.length],
          ['Ausdehnung', 'len', (i1 - i0) * step],
          ['Quelle', 't', GEO.terrMsg || 'Demo-Gelände'],
          ['Höhenbezug', 'l', cfg.hAbs ? 'absolut ü. NHN' : 'relativ zur Kartenmitte'],
        ]);
        qto(el, 'terrain', 'BaseQuantities', [['GrossArea', 'area', ifcTriArea(tr.V, tr.I)]]);
        mat('Gelände', el);
        st.terrTris = tr.I.length;
      }
    } catch (e) {
      warn.push('Gelände: ' + (e.message || e));
    }
  }
  prog(0.85, 'Gelände');
  await yld();
  // ======================================================================
  // Beziehungen schreiben
  // ======================================================================
  for (const [p, ch] of aggs)
    add('IfcRelAggregates', [guid('agg:' + p), OH, ifcS('Struktur'), '$', p, '(' + ch.join(',') + ')']);
  for (const [p, ch] of conts) {
    if (!ch.length) continue;
    const CH = 500;
    for (let i = 0; i < ch.length; i += CH)
      add('IfcRelContainedInSpatialStructure', [
        guid('cont:' + p + ':' + i),
        OH,
        ifcS('Enthalten in'),
        '$',
        '(' + ch.slice(i, i + CH).join(',') + ')',
        p,
      ]);
  }
  for (const [nm, els] of matU)
    if (els.length) {
      const CH = 1000;
      for (let i = 0; i < els.length; i += CH)
        add('IfcRelAssociatesMaterial', [
          guid('mat:' + nm + ':' + i),
          OH,
          '$',
          '$',
          '(' + els.slice(i, i + CH).join(',') + ')',
          mats.get(nm),
        ]);
    }
  // Datei
  const now = new Date(),
    pad = (n) => String(n).padStart(2, '0'),
    ts =
      now.getFullYear() +
      '-' +
      pad(now.getMonth() + 1) +
      '-' +
      pad(now.getDate()) +
      'T' +
      pad(now.getHours()) +
      ':' +
      pad(now.getMinutes()) +
      ':' +
      pad(now.getSeconds());
  const fn = (projName.replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim() || 'maad') + '.ifc';
  const head = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView_V1.0]'),'2;1');",
    'FILE_NAME(' +
      [
        ifcS(fn),
        ifcS(ts),
        '(' + ifcS(cfg.author || '') + ')',
        '(' + ifcS(cfg.org || '') + ')',
        ifcS('maad IFC-Export ' + IFCV.ver),
        ifcS('maad'),
        ifcS(''),
      ].join(',') +
      ');',
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
  ];
  const text = head.join('\n') + '\n' + W.L.join('\n') + '\nENDSEC;\nEND-ISO-10303-21;\n';
  prog(0.95, 'Prüfung');
  await yld();
  const chk = ifcCheck(text);
  return { text, fn, n: W.n, bytes: text.length, warn, st, chk, crs: crsInfo, time: Date.now() - t0 };
}
// ======================================================================
// IFC-Export – Dialog (aus den Registries IFCCAT / IFCOPT erzeugt)
// ======================================================================
const IFC = { cfg: null, last: null, busy: false };
const IFCPH = {
  projName: () => (S.project && S.project.name) || 'maad Projekt',
  siteName: () => 'Standort ' + (((S.project && S.project.label) || GEO.q || '') + '').slice(0, 60),
  phase: () => '',
  author: () => 'maad',
  org: () => 'maad',
};
function ifcCfgGet() {
  if (!IFC.cfg) {
    let c = null;
    try {
      c = JSON.parse(localStorage.getItem('lot.ifc.cfg') || 'null');
    } catch (e) {
      logErr(e, 'ifcCfgGet');
    }
    IFC.cfg = ifcCfgFix(c);
  }
  return IFC.cfg;
}
function ifcSave() {
  try {
    localStorage.setItem('lot.ifc.cfg', JSON.stringify(IFC.cfg));
  } catch (e) {
    logErr(e, 'ifcSave');
  }
}
function ifcPut(k, v) {
  const c = ifcCfgGet(),
    o = IFCOPT.find((q) => q.k === k);
  if (!o) return;
  if (o.t === 'chk') v = +!!v;
  else if (typeof o.d === 'number') v = +v;
  c[k] = v;
  ifcSave();
  ifcRender();
}
function ifcCatOn(k, v) {
  const c = ifcCfgGet();
  c.cat[k].on = !!v;
  ifcSave();
  ifcRender();
}
function ifcCatCls(k, cls) {
  const c = ifcCfgGet(),
    d = IFCCAT.find((q) => q.k === k),
    m = c.cat[k];
  m.cls = cls;
  m.pre = cls === d.dc ? d.pre : (ifcPreOpts(k, cls)[0] || ['NOTDEFINED'])[0];
  ifcSave();
  ifcRender();
}
function ifcCatPre(k, v) {
  ifcCfgGet().cat[k].pre = v;
  ifcSave();
  ifcRender();
}
function ifcCatOt(k, v) {
  ifcCfgGet().cat[k].ot = v;
  ifcSave();
}
function ifcReset() {
  IFC.cfg = ifcCfgFix(null);
  ifcSave();
  ifcRender();
}
const IFC_PRE_L = { AUTO: 'automatisch (aus Daten)' };
function ifcPreOpts(k, cls) {
  const d = IFCCAT.find((q) => q.k === k),
    cl = IFCCLS[cls];
  if (!cl || !cl.pre) return [];
  const o = cl.pre.map((v) => [v, v]);
  if (d.pre === 'AUTO' && (cls === 'IfcRoof' || cls === 'IfcSlab')) o.unshift(['AUTO', IFC_PRE_L.AUTO]);
  return o;
}
// Strukturvorschau
function ifcTreeHtml(cfg) {
  const s = ifcSrc(cfg),
    n = cfg.cat,
    on = (k) => n[k].on,
    L = [];
  const pj = cfg.projName || (S.project && S.project.name) || 'maad Projekt',
    sn = cfg.siteName || 'Standort';
  const li = (d, t, c, x) =>
    L.push(
      '<div style="padding-left:' +
        d * 16 +
        'px"><b>' +
        esc(t) +
        '</b>' +
        (c ? ' <span style="color:var(--mu)">' + esc(c) + '</span>' : '') +
        (x ? ' <span style="color:var(--mu)">' + x + '</span>' : '') +
        '</div>',
    );
  li(0, 'IfcProject', pj);
  li(1, 'IfcSite', sn, on('site') && s.sites.length ? 'COMPLEX' : 'ELEMENT');
  const bpl = (b) => {
    const p = on('site') && s.sites.find((p) => inP(cen(b.fp), p.poly));
    return p || null;
  };
  const bInfo = (b, d) => {
    li(d, 'IfcBuilding', b.name || b.id, b.levels.length + ' Geschosse');
    if (d > 9) return;
    const nw = b.levels.reduce((t, l) => t + lf(b, l).length, 0);
    const parts = [];
    if (on('psp')) parts.push(n.psp.cls.replace('Ifc', '') + ' ×' + b.levels.length);
    if (on('pwl'))
      parts.push(
        n.pwl.cls.replace('Ifc', '') +
          ' ×' +
          nw +
          (b.roof && b.roof.type && b.roof.type !== 'flat' ? ' + Giebel' : ''),
      );
    if (on('psl'))
      parts.push(
        n.psl.cls.replace('Ifc', '') +
          ' ×' +
          (b.levels.length + 1 - (!b.roof || !b.roof.type || b.roof.type === 'flat' ? 1 : 0)),
      );
    if (on('prf')) parts.push(n.prf.cls.replace('Ifc', '') + ' ×1');
    li(
      d + 1,
      'IfcBuildingStorey',
      '×' + b.levels.length,
      b.levels
        .map((l) => l.name || '')
        .filter(Boolean)
        .slice(0, 6)
        .join(', ') + (b.levels.length > 6 ? ' …' : ''),
    );
    if (parts.length) li(d + 2, 'enthält', parts.join(' · '));
  };
  const used = new Set();
  if (on('site'))
    s.sites.forEach((p) => {
      li(2, n.site.cls, p.name, 'Grundstück ' + f1(area(p.poly)) + ' m²');
      s.bld
        .filter((b) => bpl(b) === p)
        .forEach((b) => {
          used.add(b);
          bInfo(b, 3);
        });
    });
  if (on('flst') && s.fl.length) li(2, n.flst.cls, 'Flurstücke ×' + s.fl.length, '(ALKIS)');
  s.bld.filter((b) => !used.has(b)).forEach((b) => bInfo(b, 2));
  const el = [];
  if (on('terrain')) el.push(n.terrain.cls.replace('Ifc', '') + ' Gelände');
  if (on('ctxb') && s.ctx.length && n.ctxb.cls !== 'IfcBuilding')
    el.push(n.ctxb.cls.replace('Ifc', '') + ' Umgebungsgebäude ×' + s.ctx.length);
  if (on('tree') && s.trees.length) el.push(n.tree.cls.replace('Ifc', '') + ' Bäume ×' + s.trees.length);
  if (on('area') && s.areas.length) el.push(n.area.cls.replace('Ifc', '') + ' Flächen ×' + s.areas.length);
  if (el.length) li(2, 'im Standort enthalten', el.join(' · '));
  if (on('ctxb') && s.ctx.length && n.ctxb.cls === 'IfcBuilding')
    li(2, 'IfcBuilding', 'Umgebungsgebäude ×' + s.ctx.length);
  return L.join('');
}
function ifcRender() {
  const el = $('ifc');
  if (!el || el.style.display === 'none') return;
  const c = ifcCfgGet(),
    cnt = ifcCounts(c);
  const g = {};
  IFCOPT.forEach((o) => (g[o.g] = g[o.g] || []).push(o));
  const optH = Object.keys(g)
    .map(
      (gn) =>
        '<h4>' +
        esc(gn) +
        '</h4>' +
        g[gn]
          .map((o) => {
            const v = c[o.k];
            let inp = '';
            if (o.t === 'text')
              inp =
                '<input type="text" placeholder="' +
                esc(IFCPH[o.k] ? IFCPH[o.k]() : '') +
                '" value="' +
                esc(v) +
                '" onchange="ifcPut(\'' +
                o.k +
                '\',this.value)">';
            else if (o.t === 'num')
              inp =
                '<input type="number" min="' +
                o.min +
                '" max="' +
                o.max +
                '" step="' +
                o.step +
                '" value="' +
                v +
                '" onchange="ifcPut(\'' +
                o.k +
                '\',this.value)">';
            else if (o.t === 'sel')
              inp =
                '<select onchange="ifcPut(\'' +
                o.k +
                '\',this.value)">' +
                o.o
                  .map(
                    (q) =>
                      '<option value="' +
                      esc(q[0]) +
                      '"' +
                      (String(q[0]) === String(v) ? ' selected' : '') +
                      '>' +
                      esc(q[1]) +
                      '</option>',
                  )
                  .join('') +
                '</select>';
            else if (o.t === 'chk')
              return (
                '<label class="ir"><input type="checkbox"' +
                (v ? ' checked' : '') +
                ' onchange="ifcPut(\'' +
                o.k +
                '\',this.checked)"> ' +
                esc(o.n) +
                '</label>'
              );
            return '<label class="ir2">' + esc(o.n) + inp + '</label>';
          })
          .join(''),
    )
    .join('');
  const gc = {};
  IFCCAT.forEach((k) => (gc[k.g] = gc[k.g] || []).push(k));
  const catH = Object.keys(gc)
    .map(
      (gn) =>
        '<h4>' +
        esc(gn) +
        '</h4><div class="ict head"><span></span><span>Bauteilkategorie</span><span>IFC-Klasse</span><span>PredefinedType / Composition</span><span>ObjectType</span></div>' +
        gc[gn]
          .map((k) => {
            const m = c.cat[k.k],
              po = ifcPreOpts(k.k, m.cls),
              sp = IFCCLS[m.cls] && IFCCLS[m.cls].sp;
            return (
              '<div class="ict' +
              (m.on ? ' on' : '') +
              '"><input type="checkbox"' +
              (m.on ? ' checked' : '') +
              (k.st ? ' disabled title="Strukturelement – wird für Planungsbauteile immer angelegt"' : '') +
              ' onchange="ifcCatOn(\'' +
              k.k +
              '\',this.checked)"><span>' +
              esc(k.n) +
              ' <small>(' +
              (cnt[k.k] || 0) +
              ')</small></span>' +
              '<select ' +
              (k.cls.length < 2 ? 'disabled ' : '') +
              'onchange="ifcCatCls(\'' +
              k.k +
              '\',this.value)">' +
              k.cls
                .map((x) => '<option' + (x === m.cls ? ' selected' : '') + '>' + x + '</option>')
                .join('') +
              '</select>' +
              (po.length
                ? '<select title="' +
                  (sp ? 'CompositionType' : 'PredefinedType') +
                  '" onchange="ifcCatPre(\'' +
                  k.k +
                  '\',this.value)">' +
                  po
                    .map(
                      (q) =>
                        '<option value="' +
                        q[0] +
                        '"' +
                        (q[0] === m.pre ? ' selected' : '') +
                        '>' +
                        esc(q[1]) +
                        '</option>',
                    )
                    .join('') +
                  '</select>'
                : '<span class="mu">–</span>') +
              '<input type="text" value="' +
              esc(m.ot || '') +
              '" placeholder="ObjectType" onchange="ifcCatOt(\'' +
              k.k +
              '\',this.value)"></div>'
            );
          })
          .join(''),
    )
    .join('');
  $('ifcL').innerHTML = optH;
  $('ifcR').innerHTML =
    catH +
    '<h4>Projektstruktur (Vorschau)</h4><div class="itree">' +
    ifcTreeHtml(c) +
    '</div><div id="ifcLog">' +
    ifcLogHtml() +
    '</div>';
}
function ifcLogHtml() {
  const r = IFC.last;
  if (!r) return '';
  const k = r.chk,
    mb = (r.bytes / 1048576).toFixed(1);
  const cl = Object.entries(r.st)
    .filter(([a]) => /^Ifc/.test(a))
    .map(([a, b]) => a + ' ×' + b)
    .join(' · ');
  return (
    '<h4>Protokoll</h4><div class="card"><b>' +
    esc(r.fn) +
    '</b> · ' +
    f1(r.n) +
    ' Entitäten · ' +
    mb +
    ' MB · ' +
    (r.time / 1000).toFixed(1) +
    ' s<br>' +
    (k.ok
      ? '<span style="color:#1f8a3b">Prüfung bestanden</span> (Syntax, Verweise, Attributzahlen, Raumstruktur, GlobalIds)'
      : '<span style="color:#c0392b">Prüfung: ' +
        k.nErr +
        ' Fehler</span><br>' +
        k.err.slice(0, 8).map(esc).join('<br>')) +
    (cl ? '<br><span style="color:var(--mu)">' + esc(cl) + '</span>' : '') +
    (r.crs
      ? '<br><span style="color:var(--mu)">Georeferenz ' +
        r.crs.name +
        ' · E ' +
        f1(r.crs.E0, 1) +
        ' · N ' +
        f1(r.crs.N0, 1) +
        ' · Meridiankonvergenz ' +
        f1(r.crs.gam, 2) +
        '°</span>'
      : '') +
    (r.warn.length ? '<br><b>Hinweise</b><br>' + r.warn.slice(0, 12).map(esc).join('<br>') : '') +
    '</div>'
  );
}
function ifcOpen() {
  let el = $('ifc');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ifc';
    document.body.appendChild(el);
    const st = document.createElement('style');
    st.textContent =
      '#ifc{position:fixed;inset:0;z-index:210;display:none;flex-direction:column;background:#e4e3df;color:var(--tx);font:13px system-ui,sans-serif}#ifcTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:var(--pn);border-bottom:1px solid var(--ln)}#ifcTop button{font:inherit}#ifcTop .pri{width:auto;margin:0;padding:6px 14px}#ifcBody{flex:1;display:flex;min-height:0}#ifcL{width:330px;background:var(--pn);border-right:1px solid var(--ln);padding:10px 12px;overflow:auto;box-sizing:border-box}#ifcR{flex:1;background:var(--pn);padding:10px 16px;overflow:auto}#ifc h4{margin:12px 0 6px}#ifc .ir{display:flex;gap:6px;align-items:flex-start;margin:4px 0}#ifc .ir2{display:block;margin:5px 0}#ifc .ir2 input,#ifc .ir2 select{width:100%;box-sizing:border-box;margin-top:2px}#ifc .ict{display:grid;grid-template-columns:22px minmax(150px,1.3fr) minmax(150px,1fr) minmax(130px,1fr) minmax(90px,.8fr);gap:6px;align-items:center;padding:3px 6px;border-radius:6px;margin:2px 0}#ifc .ict.on{background:#5E7F9214}#ifc .ict.head{color:var(--mu);font-size:11px}#ifc .ict select,#ifc .ict input[type=text]{min-width:0;font:inherit}#ifc .mu,#ifc small{color:var(--mu)}#ifc .itree{font:12px/1.55 ui-monospace,Menlo,monospace;background:#0000000a;border-radius:8px;padding:8px 10px;max-height:260px;overflow:auto}#ifc .card{background:#0000000a;border-radius:8px;padding:8px 10px;line-height:1.5}@media(max-width:900px){#ifcBody{flex-direction:column}#ifcL{width:auto;max-height:40%}#ifc .ict{grid-template-columns:22px 1fr 1fr}}';
    document.head.appendChild(st);
    el.innerHTML =
      '<div id="ifcTop"><b>IFC-Export (IFC4)</b><span style="color:var(--mu)">Bauteilkategorien unabhängig von Sichtbarkeit &amp; Layern</span><span style="flex:1"></span><button class="sm" onclick="ifcReset()">Zurücksetzen</button><button class="pri" id="ifcGo" onclick="ifcExport()">IFC exportieren</button><button class="sm" onclick="ifcClose()">Schließen</button></div><div id="ifcBody"><div id="ifcL"></div><div id="ifcR"></div></div>';
  }
  ifcCfgGet();
  el.style.display = 'flex';
  ifcRender();
}
function ifcClose() {
  const e = $('ifc');
  if (e) e.style.display = 'none';
}
async function ifcExport() {
  const btn = $('ifcGo');
  if (IFC.busy) return;
  IFC.busy = true;
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Erzeuge IFC …';
    }
    await new Promise((r) => setTimeout(r, 30));
    const r = await ifcBuild(ifcCfgGet(), (f, t) => {
      if (btn) btn.textContent = 'IFC … ' + Math.round(f * 100) + ' % ' + t;
    });
    IFC.last = r;
    ifcRender();
    if (
      !r.chk.ok &&
      !confirm('Die interne Prüfung meldet ' + r.chk.nErr + ' Fehler. Datei trotzdem speichern?')
    )
      return;
    const blob = new Blob([r.text], { type: 'application/x-step' });
    let dl = null;
    try {
      dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    } catch (e) {
      logErr(e, 'ifcExport');
    }
    if (dl) await dl.save({ filename: r.fn, data: blob });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = r.fn;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    }
  } catch (err) {
    if (!(err && err.code === 'declined')) {
      console.error(err);
      alert('IFC-Export fehlgeschlagen: ' + ((err && err.message) || err));
    }
  } finally {
    IFC.busy = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'IFC exportieren';
    }
  }
}
// Prüfregister: jede Kategorie braucht erlaubte Klassen mit bekannter Attributzahl
function ifcRegCheck() {
  const bad = [];
  IFCCAT.forEach((k) => {
    if (!k.cls.includes(k.dc)) bad.push(k.k + ': Standardklasse nicht erlaubt');
    k.cls.forEach((c) => {
      if (!IFCCLS[c]) bad.push(k.k + ': Klasse ' + c + ' unbekannt');
      if (IFCAR[c] == null) bad.push(k.k + ': Attributzahl für ' + c + ' fehlt');
    });
  });
  return bad;
}

function baCheck() {
  const bad = [],
    want = BA.map((a) => a.k).join(),
    got = (el) => [...el.querySelectorAll('[data-ba]')].map((b) => b.dataset.ba).join(),
    gs = (el) => [...el.querySelectorAll('[data-shp]')].map((b) => b.dataset.shp).join(),
    ws = SHP.map((x) => x.k).join();
  if (got($('tmE')) !== want) bad.push('Oberes Menü Bearbeiten');
  if (got(cmEl) !== want) bad.push('Rechtsklick-Menü');
  if (gs($('tmA')) !== ws) bad.push('Menü Fläche');
  if (gs($('tmB')) !== ws) bad.push('Menü Gebäude');
  document
    .querySelectorAll(
      '[onclick*="tool(\'mv\')"],[onclick*="tool(\'ro\')"],[onclick*="tool(\'ed\')"],[onclick*="tool(\'t\')"],[onclick*="cmDo("]',
    )
    .forEach((e) => {
      if (!e.dataset.ba) bad.push('Handgebauter Button: ' + (e.textContent || '').trim().slice(0, 30));
    });
  try {
    bad.push(...ifcRegCheck());
  } catch (e) {
    bad.push('IFC-Register');
  }
  try {
    if (
      [...document.querySelectorAll('[data-vcx]')].map((b) => b.dataset.vcx).join() !==
      VCX.map((a) => a.k).join()
    )
      bad.push('Ansichtsleiste (VCX)');
  } catch (e) {
    if (!(e instanceof ReferenceError)) bad.push('Ansichtsleiste');
  }
  if (bad.length) {
    console.error('Menü-Abweichung von der Registry BA/SHP:', bad.join(' · '));
    try {
      $('hud').textContent = 'Menü-Abweichung: ' + bad.join(' · ');
    } catch (e) {
      logErr(e, 'baCheck');
    }
  }
  return !bad.length;
}
baCheck();
setInterval(() => {
  try {
    baCheck.n = (baCheck.n || 0) + 1;
    if (baCheck.n % 20 === 0 && !baCheck()) baCheck.n = -1e9;
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 3000);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
function cmHide() {
  cmEl.classList.remove('on');
}
function cmShow(e) {
  // ── Erweiterung aus 27-skizze/050-skizzenmodus.js
  cmHide();
  if (_cmBase == null) _cmBase = cmEl.innerHTML;
  cmEl.innerHTML = _cmBase;
  _skm = null;
  skMenuSync();
  try {
    if (SKS.e.length && !sksEntAt(e)) {
      const h = sksHit(e);
      if (h) {
        SKS.sel = [{ k: h.k, i: h.i, f: h.f }];
        sksRedraw();
        const it = (k, t, d) => '<button onclick="skCm(\'' + k + '\')" title="' + d + '">' + t + '</button>';
        cmEl.innerHTML =
          h.k === 'f'
            ? it('make', 'Gebäude erzeugen', 'Fläche nach oben ziehen: Geschosse wählen, Klick = Gebäude') +
              it('ofs', 'Versatz', 'F – parallele Kopie der Außenkanten') +
              '<hr>' +
              it('del', 'Löschen', 'Entf – Fläche mit ihren Kanten löschen')
            : it('split', 'Teilen', 'T – Kante an einem Punkt teilen') +
              it('ofs', 'Versatz', 'F – Versatz') +
              '<hr>' +
              it('del', 'Löschen', 'Entf – Kante löschen');
        cmEl.classList.add('on');
        const w = cmEl.offsetWidth,
          hh = cmEl.offsetHeight;
        cmEl.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px';
        cmEl.style.top = Math.min(e.clientY, innerHeight - hh - 8) + 'px';
        return;
      }
    }
  } catch (x) {
    console.warn('cmsk', x);
  }
  // ── Erweiterung aus 27-skizze/040-skizzenmodus.js
  // ---- Rechtsklick im Skizzenmodus
  (() => {
    cmHide();
    if (S.tool === 'f' || S.tool === 'm' || S.tool === 'L') return;
    ray(e);
    const hb = rc
      .intersectObjects(
        G.buildings.children.flatMap((x) => x.children),
        true,
      )
      .find((h) => h.object.userData.b && !h.object.userData.b.ex);
    if (!hb) return;
    const b = hb.object.userData.b;
    if (S.sel !== b) {
      S.sel = b;
      S.selF = null;
      S.selP = null;
      S.selA = null;
      S.multi = [];
      S.multiA = [];
      S.par = null;
      try {
        ctxSelect(null);
        treeSel(null);
      } catch (e) {
        logErr(e, 'cmShow');
      }
      S.tab = 'Planen';
      H();
      hpos();
      drawOv();
      nav();
      rr();
    }
    cmEl.classList.add('on');
    const w = cmEl.offsetWidth,
      h = cmEl.offsetHeight;
    cmEl.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px';
    cmEl.style.top = Math.min(e.clientY, innerHeight - h - 8) + 'px';
  })();
  try {
    if (cmEl.classList.contains('on')) return;
    if (!((S.tool === 'f' && S.dm === 'bld') || ((SK.used || SKS.e.length) && S.tool === 'v'))) return;
    const w = cmEl.offsetWidth,
      h = cmEl.offsetHeight;
    cmEl.classList.add('on');
    cmEl.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px';
    cmEl.style.top = Math.min(e.clientY, innerHeight - h - 8) + 'px';
  } catch (x) {
    console.warn('cm', x);
  }
}
addEventListener(
  'pointerdown',
  (e) => {
    if (!(e.target.closest && e.target.closest('#cmenu'))) cmHide();
  },
  true,
);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cmHide();
});
addEventListener('wheel', cmHide, { passive: true });

// ---- Nutzung je Geschoss
const lUse = (b, l) => l.use || b.use || 'Wohnen';
function useAgg(b) {
  const L = bLv(b),
    o = {},
    add = (u, a, v) => {
      const x = o[u] || (o[u] = { a: 0, v: 0 });
      x.a += a;
      x.v += v;
    };
  b.levels.forEach((l, i) => {
    if (L[i]) add(lUse(b, l), L[i].a, L[i].v);
  });
  if (L.length > b.levels.length) add(roofUse(b), L[b.levels.length].a, L[b.levels.length].v);
  return o;
}
function lUseSet(i, v) {
  const b = S.sel;
  if (!b || b.ex || !b.levels[i]) return;
  hist();
  b.levels[i].use = v;
  mesh(b);
  H();
  hpos();
  rr();
}
let hvK = '';
setInterval(() => {
  try {
    const k =
      (S.hv ? S.hv.b.id + ':' + S.hv.k : '') +
      '|' +
      (selOk() ? selOk().k : '') +
      '|' +
      (S.hvR ? S.hvR.id : '') +
      '|' +
      (S.roofSel ? S.roofSel.id : '');
    if (k !== hvK) {
      hvK = k;
      H();
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 90);
