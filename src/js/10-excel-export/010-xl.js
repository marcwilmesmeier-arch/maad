// ---- XL: Excel-Export der Analysedaten (Konfiguration wie im Layout-Modul)
// Blätter: Kennwerte, Geschosse, Abwicklungen (mit bemaßter Grafik), Dachflächen, Terrassen, Nutzungen, Grundstück
const XLD = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const xlDir = (nx, nz) => XLD[Math.round((((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360) / 45) % 8];
const xlPer = (f) => {
  let P = 0;
  f.forEach((a, i) => {
    const c = f[(i + 1) % f.length];
    P += Math.hypot(c[0] - a[0], c[1] - a[1]);
  });
  return P;
};
const xlCol = (n) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const xlX = (s) =>
  String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const xlC = (k, n, u, d, t, w, on, x) => ({ k, n, u, d, t, w, on: on ? 1 : 0, ...(x || {}) });
const XLV = [
  xlC('name', 'Gebäude', '', 0, 't', 24, 1),
  xlC('use', 'Nutzung', '', 0, 't', 14, 1),
  xlC('lev', 'Geschosse', '', 0, 's', 11, 1),
  xlC('ug', 'davon Untergeschosse', '', 0, 's', 13, 0),
  xlC('vg', 'Vollgeschosse', '', 0, 'm', 12, 0),
  xlC('h', 'Gebäudehöhe inkl. Dach', 'm', 2, 'm', 13, 1),
  xlC('gf', 'Grundfläche EG', 'm²', 1, 's', 12, 1),
  xlC('gr', 'GR (Projektion oberirdisch)', 'm²', 1, 's', 14, 0),
  xlC('umf', 'Umfang EG', 'm', 1, 's', 11, 0),
  xlC('bgf', 'BGF gesamt', 'm²', 1, 's', 12, 1),
  xlC('bgfoi', 'BGF oberirdisch', 'm²', 1, 's', 12, 0),
  xlC('bgfui', 'BGF unterirdisch', 'm²', 1, 's', 12, 0),
  xlC('bri', 'BRI gesamt', 'm³', 1, 's', 12, 1),
  xlC('brioi', 'BRI oberirdisch', 'm³', 1, 's', 12, 0),
  xlC('briui', 'BRI unterirdisch', 'm³', 1, 's', 12, 0),
  xlC('fas', 'Fassadenfläche (oberirdisch, brutto)', 'm²', 1, 's', 16, 1),
  xlC('dach', 'Dachfläche', 'm²', 1, 's', 12, 1),
  xlC('terr', 'Terrassenfläche', 'm²', 1, 's', 12, 1),
  xlC('fasb', 'Fassade / BGF', '', 2, 'q', 11, 0),
  xlC('roof', 'Dachform', '', 0, 't', 12, 0),
  xlC('ang', 'Dachneigung', '°', 0, 'm', 11, 0),
  xlC('grz', 'GRZ (Grundstück)', '', 2, 'r', 11, 0),
  xlC('gfz', 'GFZ (Grundstück)', '', 2, 'r', 11, 0),
];
const XLS = [
  ['sum', 'Kennwerte'],
  ['lev', 'Geschosse'],
  ['abw', 'Abwicklungen'],
  ['roof', 'Dachflächen'],
  ['terr', 'Terrassen'],
  ['use', 'Nutzungen'],
  ['plot', 'Grundstück'],
];
const XLC0 = {
  sum: XLV,
  lev: [
    xlC('bld', 'Gebäude', '', 0, 't', 22, 1),
    xlC('n', 'Geschoss', '', 0, 't', 16, 1),
    xlC('use', 'Nutzung', '', 0, 't', 14, 1),
    xlC('uk', 'Unterkante (m ü. ±0)', 'm', 2, 'n', 13, 0),
    xlC('h', 'Geschosshöhe', 'm', 2, 'n', 11, 1),
    xlC('bgf', 'BGF', 'm²', 1, 'n', 11, 1),
    xlC('bri', 'BRI', 'm³', 1, 'n', 11, 1),
    xlC('umf', 'Umfang', 'm', 2, 'n', 11, 0),
    xlC('wand', 'Außenwandfläche brutto', 'm²', 1, 'n', 14, 1),
  ],
  abw: [
    xlC('bld', 'Gebäude', '', 0, 't', 20, 1),
    xlC('lv', 'Geschoss', '', 0, 't', 16, 1),
    xlC('nr', 'Seite', '', 0, 't', 8, 1),
    xlC('dir', 'Himmelsrichtung', '', 0, 't', 12, 1),
    xlC('len', 'Länge', 'm', 2, 'n', 10, 1),
    xlC('h', 'Höhe', 'm', 2, 'n', 10, 1),
    xlC('area', 'Fläche brutto', 'm²', 2, 'n', 12, 1),
    xlC('op', 'Öffnungsanteil (Eingabe)', '%', 0, 'n', 13, 1, { inp: 1 }),
    xlC('net', 'Fläche netto', 'm²', 2, 'n', 12, 1),
  ],
  roof: [
    xlC('bld', 'Gebäude', '', 0, 't', 20, 1),
    xlC('nr', 'Fläche', '', 0, 't', 9, 1),
    xlC('typ', 'Dachform', '', 0, 't', 22, 1),
    xlC('ang', 'Neigung', '°', 0, 'n', 10, 1),
    xlC('dir', 'Ausrichtung', '', 0, 't', 12, 1),
    xlC('azi', 'Azimut', '°', 0, 'n', 10, 0),
    xlC('area', 'Dachfläche (geneigt)', 'm²', 2, 'n', 14, 1),
    xlC('proj', 'Grundrissprojektion', 'm²', 2, 'n', 14, 1),
  ],
  terr: [
    xlC('bld', 'Gebäude', '', 0, 't', 20, 1),
    xlC('lv', 'Terrasse auf Geschoss', '', 0, 't', 18, 1),
    xlC('z', 'Höhe (m ü. ±0)', 'm', 2, 'n', 13, 1),
    xlC('bx', 'Breite (Umgrenzung)', 'm', 1, 'n', 13, 1),
    xlC('by', 'Tiefe (Umgrenzung)', 'm', 1, 'n', 13, 1),
    xlC('area', 'Terrassenfläche', 'm²', 2, 'n', 14, 1),
  ],
  use: [
    xlC('bld', 'Gebäude', '', 0, 't', 20, 1),
    xlC('use', 'Nutzung', '', 0, 't', 16, 1),
    xlC('bgf', 'BGF', 'm²', 1, 'n', 12, 1),
    xlC('bri', 'BRI', 'm³', 1, 'n', 12, 1),
  ],
  plot: [
    xlC('g', 'Größe', '', 0, 't', 34, 1),
    xlC('v', 'Wert', '', 2, 'n', 14, 1),
    xlC('u', 'Einheit', '', 0, 't', 10, 1),
  ],
};
const XLH = {
  sum: 'Summenzeile mit Excel-Formeln (SUMME/MAX). Kennwerte entsprechen der Analyse.',
  lev: 'Je Geschoss: Höhe, BGF, BRI, Umfang, Außenwandfläche.',
  abw: 'Je Fassadenseite und Geschoss: Länge × Höhe (als Formel), Himmelsrichtung, Öffnungsanteil als Eingabespalte für die Nettofläche – dazu die bemaßte Abwicklungsgrafik.',
  roof: 'Dachflächen nach Neigung und Ausrichtung, geneigte Fläche und Grundrissprojektion, Traufumfang.',
  terr: 'Terrassenflächen je Absatz mit Höhe und umschreibendem Rechteck.',
  use: 'BGF und BRI je Nutzung.',
  plot: 'Grundstücksfläche, GRZ/GFZ mit Grenzwerten, freie Flächen.',
};
const XL = {
  scope: 'both',
  sel: 'sum',
  sh: { sum: 1, lev: 1, abw: 1, roof: 1, terr: 1, use: 0, plot: 1 },
  shn: {},
  img: 1,
  opd: 0,
  title: '',
  off: [],
  cols: {},
};
function xlInit() {
  for (const k in XLC0) XL.cols[k] = XLC0[k].map((c) => ({ ...c }));
  try {
    const j = JSON.parse(localStorage.getItem('lot_xl') || 'null');
    if (j) {
      for (const f of ['scope', 'sel', 'img', 'opd', 'title']) if (j[f] != null) XL[f] = j[f];
      Object.assign(XL.sh, j.sh || {});
      Object.assign(XL.shn, j.shn || {});
      XL.off = j.off || [];
      for (const k in j.cols || {})
        (XL.cols[k] || []).forEach((c) => {
          const o = j.cols[k][c.k];
          if (o) {
            c.on = o[0];
            if (o[1]) c.l = o[1];
          }
        });
    }
  } catch (e) {
    logErr(e, 'xlInit');
  }
  XL.sel = XLS.some((x) => x[0] === XL.sel) ? XL.sel : 'sum';
}
function xlSave0() {
  try {
    const cols = {};
    for (const k in XL.cols) {
      cols[k] = {};
      XL.cols[k].forEach((c) => {
        cols[k][c.k] = [c.on, c.l && c.l !== xlDef(c) ? c.l : ''];
      });
    }
    localStorage.setItem(
      'lot_xl',
      JSON.stringify({
        scope: XL.scope,
        sel: XL.sel,
        img: XL.img,
        opd: XL.opd,
        title: XL.title,
        sh: XL.sh,
        shn: XL.shn,
        off: XL.off,
        cols,
      }),
    );
  } catch (e) {
    logErr(e, 'xlSave0');
  }
}
const xlDef = (c) => c.n + (c.u ? ` [${c.u}]` : '');
const xlLab = (c) => c.l || xlDef(c);
// ---- Zip (ohne Kompression) + CRC32
const XZ = (() => {
  let T = null;
  const crc = (u) => {
    if (!T) {
      T = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        T[n] = c >>> 0;
      }
    }
    let c = -1;
    for (let i = 0; i < u.length; i++) c = T[(c ^ u[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  return (files) => {
    const enc = new TextEncoder(),
      parts = [],
      cd = [];
    let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.n),
        d = typeof f.d === 'string' ? enc.encode(f.d) : f.d,
        cr = crc(d),
        sz = d.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 0x0800, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, 0x21, true);
      h.setUint32(14, cr, true);
      h.setUint32(18, sz, true);
      h.setUint32(22, sz, true);
      h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, d);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(14, 0x21, true);
      c.setUint32(16, cr, true);
      c.setUint32(20, sz, true);
      c.setUint32(24, sz, true);
      c.setUint16(28, nm.length, true);
      c.setUint32(42, off, true);
      cd.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + sz;
    }
    let cs = 0;
    cd.forEach((x) => (cs += x.length));
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cs, true);
    e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  };
})();
// ---- Tabellenblatt
function xlSheet(name) {
  const s = { name, rows: {}, ht: {}, w: [], mg: [], img: [], frz: 0 };
  s.set = (r, c, v, st, f) => {
    (s.rows[r] = s.rows[r] || {})[c] = { v, st: st || 0, f: f || null };
  };
  s.xml = (dr) => {
    const rs = Object.keys(s.rows)
      .map(Number)
      .sort((a, b) => a - b);
    let x =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0">' +
      (s.frz
        ? `<pane ySplit="${s.frz}" topLeftCell="A${s.frz + 1}" activePane="bottomLeft" state="frozen"/>`
        : '') +
      '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15" customHeight="1"/>';
    if (s.w.length)
      x +=
        '<cols>' +
        s.w
          .map((w, i) => (w ? `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>` : ''))
          .join('') +
        '</cols>';
    x += '<sheetData>';
    const allr = new Set(rs.concat(Object.keys(s.ht).map(Number)));
    [...allr]
      .sort((a, b) => a - b)
      .forEach((r) => {
        const row = s.rows[r] || {};
        x += `<row r="${r}"${s.ht[r] ? ` ht="${s.ht[r]}" customHeight="1"` : ''}>`;
        Object.keys(row)
          .map(Number)
          .sort((a, b) => a - b)
          .forEach((c) => {
            const q = row[c],
              ref = xlCol(c) + r;
            if (q.v == null || q.v === '' || (typeof q.v === 'number' && !isFinite(q.v)))
              x += `<c r="${ref}" s="${q.st}"/>`;
            else if (typeof q.v === 'number')
              x += `<c r="${ref}" s="${q.st}">${q.f ? `<f>${xlX(q.f)}</f>` : ''}<v>${+q.v.toFixed(6)}</v></c>`;
            else
              x += `<c r="${ref}" s="${q.st}" t="inlineStr"><is><t xml:space="preserve">${xlX(q.v)}</t></is></c>`;
          });
        x += '</row>';
      });
    x += '</sheetData>';
    if (s.mg.length)
      x +=
        `<mergeCells count="${s.mg.length}">` +
        s.mg.map((m) => `<mergeCell ref="${m}"/>`).join('') +
        '</mergeCells>';
    x +=
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
    if (dr) x += '<drawing r:id="rId1"/>';
    return x + '</worksheet>';
  };
  return s;
}
// Zellformate: 0 Standard, 1 Kopf, 2 fett, 3 #,##0.0, 4 #,##0.00, 5 ganzzahlig, 6 Summe 0.0, 7 Titel, 8 Summe Text, 9 Summe 0.00, 10 Summe ganzzahlig, 11 Eingabe, 12 Umbruch, 13 Hinweis, 14 Zwischenüberschrift
const XST = (() => {
  const f = (n, c) =>
    `<xf numFmtId="${n}" fontId="${c.f || 0}" fillId="${c.fi || 0}" borderId="${c.b || 0}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${c.al ? ` applyAlignment="1"><alignment ${c.al}/></xf>` : '/>'}`;
  const xfs = [
    f(0, {}),
    f(0, { f: 2, fi: 2, b: 1, al: 'horizontal="center" vertical="center" wrapText="1"' }),
    f(0, { f: 1 }),
    f(164, {}),
    f(165, {}),
    f(1, {}),
    f(164, { f: 1, fi: 3, b: 2 }),
    f(0, { f: 3 }),
    f(0, { f: 1, fi: 3, b: 2 }),
    f(165, { f: 1, fi: 3, b: 2 }),
    f(1, { f: 1, fi: 3, b: 2 }),
    f(166, { fi: 4, b: 1 }),
    f(0, { al: 'wrapText="1" vertical="top"' }),
    f(0, { f: 4 }),
    f(0, { f: 1, fi: 5 }),
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.0"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="0"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF777777"/><name val="Arial"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3A3A3A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECEBE6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D1"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCDAD2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
})();
function xlSt(c, v, rs) {
  if (rs === 'sum') return typeof v === 'number' ? (c.d === 2 ? 9 : c.d === 0 ? 10 : 6) : 8;
  if (rs === 'sub') return 14;
  if (c.inp) return 11;
  return typeof v === 'number' ? (c.d === 2 ? 4 : c.d === 0 ? 5 : 3) : 0;
}
// Tabelle schreiben: Kopf + Zeilen (Wert | {f:(L,r)=>Formel,v}); gibt Zeilenbereich zurück
function xlTbl(s, r, cols, rows) {
  const L = {};
  cols.forEach((c, i) => (L[c.k] = xlCol(i + 1)));
  cols.forEach((c, i) => s.set(r, i + 1, xlLab(c), 1));
  s.ht[r] = 32;
  let q = r + 1;
  const r0 = q;
  rows.forEach((row) => {
    cols.forEach((c, i) => {
      let v = row[c.k],
        f = null;
      if (v && typeof v === 'object') {
        f = typeof v.f === 'function' ? v.f(L, q) : v.f;
        v = v.v;
      }
      if ((v == null || v === '') && !c.inp) return;
      s.set(q, i + 1, v, xlSt(c, v, row._st), f);
    });
    q++;
  });
  return { L, r0, r1: q - 1, next: q };
}
function xlSumRow(s, r, cols, T, label, keys, vals, r0, r1) {
  cols.forEach((c, i) => {
    if (i === 0) {
      s.set(r, 1, label, 8);
      return;
    }
    if (keys.includes(c.k) && vals[c.k] != null)
      s.set(
        r,
        i + 1,
        vals[c.k],
        xlSt(c, vals[c.k], 'sum'),
        r1 >= r0 ? `SUM(${T.L[c.k]}${r0}:${T.L[c.k]}${r1})` : null,
      );
    else s.set(r, i + 1, null, 8);
  });
}
const xlNum = (v) => (v && typeof v === 'object' ? v.v : v);
