// ---- Optionen
const IFCOPT = [
  { k: 'projName', g: 'Projekt', n: 'Projektname', t: 'text', d: '' },
  { k: 'siteName', g: 'Projekt', n: 'Standort (IfcSite)', t: 'text', d: '' },
  { k: 'phase', g: 'Projekt', n: 'Phase', t: 'text', d: 'Entwurf' },
  { k: 'author', g: 'Projekt', n: 'Autor', t: 'text', d: '' },
  { k: 'org', g: 'Projekt', n: 'Organisation', t: 'text', d: '' },
  {
    k: 'georef',
    g: 'Koordinaten & Höhen',
    n: 'Georeferenzierung',
    t: 'sel',
    d: 'crs',
    o: [
      ['crs', 'IfcMapConversion + ETRS89/UTM (EPSG, automatisch)'],
      ['none', 'nur lokal (Ursprung = Kartenmitte)'],
    ],
  },
  {
    k: 'hAbs',
    g: 'Koordinaten & Höhen',
    n: 'Höhenbezug',
    t: 'sel',
    d: 0,
    o: [
      [0, 'relativ (Z = 0 in Kartenmitte; ü. NHN in Georeferenz)'],
      [1, 'absolut ü. NHN in Z'],
    ],
  },
  {
    k: 'terrStep',
    g: 'Gelände',
    n: 'Netzweite Gelände',
    t: 'sel',
    d: 2,
    o: [
      [1, 'fein (wie Geländemodell)'],
      [2, 'mittel (2×)'],
      [4, 'grob (4×)'],
      [8, 'sehr grob (8×)'],
    ],
  },
  {
    k: 'terrR',
    g: 'Gelände',
    n: 'Ausschnitt um Planung/Grundstück (m, 0 = ganzes Modell)',
    t: 'num',
    d: 0,
    min: 0,
    max: 5000,
    step: 50,
  },
  { k: 'wallT', g: 'Planung', n: 'Wanddicke Außenwand (m)', t: 'num', d: 0.3, min: 0.05, max: 2, step: 0.01 },
  { k: 'slabT', g: 'Planung', n: 'Deckendicke (m)', t: 'num', d: 0.25, min: 0.05, max: 2, step: 0.01 },
  {
    k: 'ctxLod',
    g: 'Umgebung',
    n: 'Umgebungsgebäude',
    t: 'sel',
    d: 'lod2',
    o: [
      ['lod2', 'mit LoD2-Dachformen, wo vorhanden'],
      ['block', 'nur Kubatur (Grundriss × Höhe)'],
    ],
  },
  {
    k: 'rad',
    g: 'Umgebung',
    n: 'Umkreis um Planung/Grundstück für Gebäude, Bäume, Flächen (m, 0 = alles)',
    t: 'num',
    d: 0,
    min: 0,
    max: 5000,
    step: 50,
  },
  {
    k: 'treeDetail',
    g: 'Umgebung',
    n: 'Baumkrone',
    t: 'sel',
    d: 1,
    o: [
      [0, 'grob (20 Flächen)'],
      [1, 'mittel (80 Flächen)'],
      [2, 'fein (180 Flächen)'],
    ],
  },
  { k: 'delCtx', g: 'Umgebung', n: 'Im Projekt entfernten Bestand/Bäume mit exportieren', t: 'chk', d: 0 },
  { k: 'psets', g: 'Inhalt', n: 'Property-Sets (Pset_…, maad_…)', t: 'chk', d: 1 },
  { k: 'qto', g: 'Inhalt', n: 'Mengen (Qto_…)', t: 'chk', d: 1 },
  { k: 'col', g: 'Inhalt', n: 'Farben / Oberflächenstile', t: 'chk', d: 1 },
  { k: 'mats', g: 'Inhalt', n: 'Materialien', t: 'chk', d: 1 },
  {
    k: 'stable',
    g: 'Inhalt',
    n: 'Stabile GlobalIds (gleiche Objekte = gleiche ID bei erneutem Export)',
    t: 'chk',
    d: 1,
  },
  { k: 'ownerHist', g: 'Inhalt', n: 'IfcOwnerHistory schreiben (für ältere Programme)', t: 'chk', d: 1 },
];
function ifcDef() {
  const c = {};
  IFCOPT.forEach((o) => (c[o.k] = o.d));
  c.cat = {};
  IFCCAT.forEach((k) => (c.cat[k.k] = { on: !!k.on, cls: k.dc, pre: k.pre, ot: k.ot }));
  return c;
}
function ifcCfgFix(c) {
  const d = ifcDef(),
    o = Object.assign({}, d, c || {});
  IFCOPT.forEach((q) => {
    if (typeof q.d === 'number' || q.t === 'chk') {
      const v = +o[q.k];
      o[q.k] = isFinite(v) ? v : q.d;
    }
  });
  o.cat = {};
  IFCCAT.forEach((k) => {
    const q = (c && c.cat && c.cat[k.k]) || {},
      m = Object.assign({}, d.cat[k.k], q);
    if (!k.cls.includes(m.cls)) {
      m.cls = k.dc;
      m.pre = k.pre;
    }
    o.cat[k.k] = m;
  });
  return o;
}

// ---- Textformate (STEP / ISO 10303-21)
function ifcS(s) {
  s = String(s == null ? '' : s);
  let o = "'";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === "'") o += "''";
    else if (ch === '\\') o += '\\\\';
    else if (c >= 32 && c < 127) o += ch;
    else if (c <= 0xffff) o += '\\X2\\' + c.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
    else o += '\\X4\\' + c.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\';
  }
  return o + "'";
}
function ifcR(x) {
  x = +x;
  if (!isFinite(x)) x = 0;
  let r = Math.round(x * 1e6) / 1e6;
  if (r === 0) r = 0;
  let s = String(r);
  if (/e/i.test(s)) s = r.toFixed(6);
  if (s.indexOf('.') < 0) s += '.';
  return s;
}
const ifcB = (v) => (v ? '.T.' : '.F.');
function ifcDms(deg) {
  const sg = deg < 0 ? -1 : 1;
  let a = Math.abs(deg),
    d = Math.floor(a),
    m = Math.floor((a - d) * 60),
    s = Math.floor(((a - d) * 60 - m) * 60),
    u = Math.round((((a - d) * 60 - m) * 60 - s) * 1e6);
  if (u >= 1e6) {
    u -= 1e6;
    s++;
  }
  if (s >= 60) {
    s -= 60;
    m++;
  }
  if (m >= 60) {
    m -= 60;
    d++;
  }
  return '(' + [d, m, s, u].map((v) => sg * v).join(',') + ')';
}
// IfcGloballyUniqueId: 128 Bit -> 22 Zeichen
const IFC64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function ifcH128(s) {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0, k; i < s.length; i++) {
    k = s.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function ifcGuidBytes(b) {
  let o = '';
  const bit = (i) => (b[i >> 3] >> (7 - (i & 7))) & 1;
  let p = 0;
  for (let c = 0; c < 22; c++) {
    const n = c ? 6 : 2;
    let v = 0;
    for (let j = 0; j < n; j++) v = (v << 1) | bit(p++);
    o += IFC64[v];
  }
  return o;
}
function ifcGuid(key) {
  const w = ifcH128(key),
    b = [];
  w.forEach((x) => b.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return ifcGuidBytes(b);
}
function ifcGuidRand() {
  const b = new Uint8Array(16);
  try {
    crypto.getRandomValues(b);
  } catch (_) {
    for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  }
  return ifcGuidBytes(b);
}
// ---- Schreiber
function ifcWriter() {
  const L = [],
    mem = new Map();
  let n = 0;
  const w = {
    L,
    get n() {
      return n;
    },
    add(nm, a) {
      const ar = IFCAR[nm];
      if (ar != null && a.length !== ar)
        throw new Error('IFC-Attributzahl ' + nm + ': ' + a.length + ' statt ' + ar);
      L.push('#' + ++n + '= ' + nm.toUpperCase() + '(' + a.join(',') + ');');
      return '#' + n;
    },
    once(key, nm, a) {
      let v = mem.get(key);
      if (!v) {
        v = w.add(nm, a);
        mem.set(key, v);
      }
      return v;
    },
  };
  return w;
}

// ---- Prüfer: Syntax, Verweise, Attributzahl, Struktur
function ifcSplit(s) {
  const o = [];
  let d = 0,
    q = false,
    cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      cur += c;
      if (c === "'") {
        if (s[i + 1] === "'") {
          cur += "'";
          i++;
        } else q = false;
      }
      continue;
    }
    if (c === "'") {
      q = true;
      cur += c;
    } else if (c === '(') {
      d++;
      cur += c;
    } else if (c === ')') {
      d--;
      cur += c;
    } else if (c === ',' && d === 0) {
      o.push(cur);
      cur = '';
    } else cur += c;
  }
  o.push(cur);
  return o;
}
function ifcCheck(txt) {
  const err = [],
    warn = [],
    E = new Map(),
    cnt = {};
  const i0 = txt.indexOf('DATA;'),
    i1 = txt.lastIndexOf('ENDSEC;');
  if (!/^ISO-10303-21;/.test(txt)) err.push('Kopfzeile ISO-10303-21 fehlt');
  if (!/FILE_SCHEMA\(\('IFC4'\)\)/.test(txt)) err.push('FILE_SCHEMA(IFC4) fehlt');
  if (i0 < 0 || i1 < i0) err.push('DATA-Abschnitt fehlt');
  const body = txt.slice(i0 + 5, i1);
  const re = /^#(\d+)= ([A-Z0-9]+)\((.*)\);$/;
  let ln = 0;
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    ln++;
    const m = re.exec(line);
    if (!m) {
      err.push('Zeile ' + ln + ' nicht lesbar: ' + line.slice(0, 80));
      continue;
    }
    const id = +m[1];
    if (E.has(id)) err.push('doppelte ID #' + id);
    const args = ifcSplit(m[3]);
    E.set(id, { t: m[2], a: args, line: ln });
    cnt[m[2]] = (cnt[m[2]] || 0) + 1;
  }
  const arT = {};
  for (const k in IFCAR) arT[k.toUpperCase()] = IFCAR[k];
  const refs = (a) => {
    const out = [],
      s = a.replace(/'(?:[^']|'')*'/g, "''");
    const r = /#(\d+)/g;
    let m;
    while ((m = r.exec(s))) out.push(+m[1]);
    return out;
  };
  const T_ = (id) => E.get(id) && E.get(id).t;
  for (const [id, e] of E) {
    const ar = arT[e.t];
    if (ar != null && e.a.length !== ar)
      err.push('#' + id + ' ' + e.t + ': ' + e.a.length + ' statt ' + ar + ' Attribute');
    for (const r of refs(e.a.join(',')))
      if (!E.has(r)) err.push('#' + id + ' ' + e.t + ' verweist auf fehlende #' + r);
  }
  for (const [id, e] of E) {
    if (e.t === 'IFCTRIANGULATEDFACESET') {
      const pl = E.get(+e.a[0].slice(1));
      if (!pl || pl.t !== 'IFCCARTESIANPOINTLIST3D') {
        err.push('#' + id + ' Punktliste fehlt');
        continue;
      }
      const np = ifcSplit(pl.a[0].slice(1, -1)).length,
        ix = e.a[3].match(/\d+/g) || [];
      let mx = 0,
        mn = 1e12;
      for (const s of ix) {
        const v = +s;
        if (v > mx) mx = v;
        if (v < mn) mn = v;
      }
      if (mx > np || mn < 1) err.push('#' + id + ' IfcTriangulatedFaceSet: Index außerhalb der Punktliste');
    }
  }
  // Struktur
  const prod = [],
    contained = new Set(),
    aggd = new Set();
  const lst = (a) => refs(a);
  for (const [id, e] of E) {
    const t = e.t;
    if (t === 'IFCRELAGGREGATES') {
      const par = lst(e.a[4])[0],
        ch = lst(e.a[5]);
      const pt = T_(par);
      ch.forEach((c) => {
        aggd.add(c);
        const ct = T_(c);
        const okc = {
          IFCPROJECT: ['IFCSITE'],
          IFCSITE: ['IFCSITE', 'IFCBUILDING'],
          IFCBUILDING: ['IFCBUILDINGSTOREY'],
          IFCBUILDINGSTOREY: ['IFCSPACE'],
          IFCSPACE: ['IFCSPACE'],
          IFCROOF: ['IFCSLAB', 'IFCWALL'],
        }[pt];
        if (okc && !okc.includes(ct))
          err.push('#' + id + ' IfcRelAggregates: ' + ct + ' darf nicht unter ' + pt + ' hängen');
      });
    }
    if (t === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
      const st = lst(e.a[5])[0],
        el = lst(e.a[4]);
      if (!['IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE'].includes(T_(st)))
        err.push('#' + id + ' enthält in ' + T_(st));
      el.forEach((c) => {
        if (contained.has(c)) err.push('#' + c + ' ist mehrfach räumlich enthalten');
        contained.add(c);
        if (['IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY'].includes(T_(c)))
          err.push('#' + c + ' Raumstruktur darf nicht per Containment zugeordnet werden');
      });
    }
    if (t === 'IFCRELDEFINESBYPROPERTIES' || t === 'IFCRELASSOCIATESMATERIAL') {
      lst(e.a[4]).forEach((c) => {
        const ct = T_(c);
        if (!(IFC_SPATIAL.has(pc(ct)) || IFC_ELEM.has(pc(ct))))
          err.push('#' + id + ' bezieht sich auf ' + ct);
      });
    }
    if (t === 'IFCPROJECT' && !lst(e.a[7]).length) err.push('IfcProject ohne Kontext');
  }
  function pc(t) {
    return Object.keys(IFCAR).find((k) => k.toUpperCase() === t) || t;
  }
  for (const [id, e] of E) {
    const t = pc(e.t);
    if (
      IFC_ELEM.has(t) ||
      t === 'IfcSpace' ||
      t === 'IfcBuilding' ||
      t === 'IfcBuildingStorey' ||
      t === 'IfcSite'
    ) {
      prod.push(id);
      if (e.a[5] === '$') err.push('#' + id + ' ' + e.t + ' ohne ObjectPlacement');
      if (IFC_ELEM.has(t) && !contained.has(id) && !aggd.has(id))
        err.push('#' + id + ' ' + e.t + ' (' + (e.a[2] || '') + ') hängt in keiner Raumstruktur');
      if (!IFC_ELEM.has(t) && t !== 'IfcSpace' && !aggd.has(id))
        err.push('#' + id + ' ' + e.t + ' (' + (e.a[2] || '') + ') ist keinem Elternobjekt zugeordnet');
      if (t === 'IfcSpace' && !aggd.has(id) && !contained.has(id))
        err.push('#' + id + ' IfcSpace ohne Geschoss');
      if (e.a[6] !== '$') {
        const pd = E.get(lst(e.a[6])[0]);
        if (!pd || pd.t !== 'IFCPRODUCTDEFINITIONSHAPE')
          err.push('#' + id + ' Representation ist keine IfcProductDefinitionShape');
      }
    }
  }
  const gu = new Set();
  for (const [id, e] of E) {
    const t = pc(e.t);
    if (
      IFC_ELEM.has(t) ||
      IFC_SPATIAL.has(t) ||
      /^IFCREL/.test(e.t) ||
      e.t === 'IFCPROPERTYSET' ||
      e.t === 'IFCELEMENTQUANTITY'
    ) {
      const g = e.a[0];
      if (!/^'[0-9A-Za-z_$]{22}'$/.test(g)) err.push('#' + id + ' ' + e.t + ' GlobalId ungültig ' + g);
      else if (gu.has(g)) err.push('#' + id + ' doppelte GlobalId ' + g);
      gu.add(g);
    }
  }
  if (!(cnt.IFCPROJECT === 1)) err.push('es muss genau ein IfcProject geben (' + (cnt.IFCPROJECT || 0) + ')');
  return { ok: !err.length, err: err.slice(0, 60), nErr: err.length, warn, cnt, n: E.size };
}
