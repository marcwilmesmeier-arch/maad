// ---- Interaktion auf dem Blatt
(function () {
  const sh = $('laySheet');
  if (!sh) return;
  function snapV(vals, c, tol) {
    let b = 0,
      bd = 1e9;
    vals.forEach((v) =>
      c.forEach((x) => {
        const d = x - v;
        if (Math.abs(d) < tol && Math.abs(d) < bd) {
          bd = Math.abs(d);
          b = d;
        }
      }),
    );
    return b;
  }
  sh.addEventListener('pointerdown', (ev) => {
    if (layDrawDown(ev)) return;
    const d = ev.target.closest('.lel');
    if (!d) {
      LAY.sel = null;
      layRender();
      layProp();
      return;
    }
    const e = layEl(d.dataset.id);
    if (!e) return;
    LAY.sel = e.id;
    LAY.drag = {
      e,
      rs: ev.target.classList.contains('lh'),
      x: ev.clientX,
      y: ev.clientY,
      ex: e.x,
      ey: e.y,
      ew: e.w,
      eh: e.h,
      mv: 0,
    };
    try {
      sh.setPointerCapture(ev.pointerId);
    } catch (e) {
      logErr(e, 'init>anonym');
    }
    layRender();
    layProp();
  });
  sh.addEventListener('pointermove', (ev) => {
    if (layDrawMove(ev)) return;
    const g = LAY.drag;
    if (!g) return;
    const k = layK(),
      [pw, ph] = layPage(),
      dx = (ev.clientX - g.x) / k,
      dy = (ev.clientY - g.y) / k,
      e = g.e,
      tol = 6 / k;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) g.mv = 1;
    if (!g.mv) return;
    const oth = LAY.els.filter((o) => o !== e),
      cx = [10, pw / 2, pw - 10, ...oth.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])],
      cy = [10, ph / 2, ph - 10, ...oth.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
    if (g.rs) {
      const mn = e.type === 'box' ? 1 : 10;
      let w = Math.max(mn, g.ew + dx),
        h = Math.max(mn, g.eh + dy);
      if (!ev.altKey) w += snapV([e.x + w], cx, tol);
      e.w = Math.round(w * 2) / 2;
      if (e.type === 'view' || e.type === 'box') {
        if (!ev.altKey) h += snapV([e.y + h], cy, tol);
        e.h = Math.round(h * 2) / 2;
      }
    } else {
      let x = g.ex + dx,
        y = g.ey + dy;
      if (!ev.altKey) {
        x += snapV([x, x + e.w / 2, x + e.w], cx, tol);
        y += snapV([y, y + e.h / 2, y + e.h], cy, tol);
      }
      e.x = Math.round(x * 2) / 2;
      e.y = Math.round(y * 2) / 2;
    }
    const n = sh.querySelector('[data-id="' + e.id + '"]');
    if (n) {
      n.style.left = e.x * k + 'px';
      n.style.top = e.y * k + 'px';
      n.style.width = e.w * k + 'px';
      if (e.type === 'view' || e.type === 'box') {
        n.style.height = e.h * k + 'px';
        const im = n.querySelector('img');
        if (im) im.style.height = layItems(e, 1).ih * k + 'px';
      }
    }
  });
  sh.addEventListener('pointerup', (ev) => {
    if (layDrawUp(ev)) return;
    const g = LAY.drag;
    LAY.drag = null;
    if (g && g.mv) {
      laySave();
      layRender();
      layProp();
    }
  });
  addEventListener(
    'keydown',
    (e) => {
      if (!LAY.open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        layDel();
      } else if (e.key === 'Escape') {
        if (LAY.draw) {
          layDrawEnd();
          return;
        }
        LAY.sel ? ((LAY.sel = null), layRender(), layProp()) : layClose();
      }
    },
    true,
  );
  addEventListener('resize', () => {
    if (LAY.open) layRender();
  });
})();
// ---- PDF-Export (eigener Minimal-Writer: Vektortext in Helvetica + JPEG-Bilder)
const layHex = (h) => {
  const n = parseInt(String(h).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    .map((x) => x.toFixed(3))
    .join(' ');
};
function layEnc(s) {
  let o = '';
  for (const ch of s) {
    let c = ch.charCodeAt(0);
    if (c > 255) c = PDFM[ch] != null ? PDFM[ch] : 63;
    if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
    else o += String.fromCharCode(c);
  }
  return o;
}
function layPdf(pw, ph, ops, imgs, title) {
  const mm = 72 / 25.4,
    W = pw * mm,
    H = ph * mm,
    P = [],
    A = (s) => {
      const u = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
      return u;
    },
    len = () => P.reduce((s, c) => s + c.length, 0),
    offs = [],
    f = (n) => (+n).toFixed(2);
  const obj = (n, parts) => {
    offs[n] = len();
    P.push(A(n + ' 0 obj\n'));
    parts.forEach((p) => P.push(typeof p === 'string' ? A(p) : p));
    P.push(A('\nendobj\n'));
  };
  const fk = [];
  ops.forEach((o) => {
    (o.k === 'an' ? o.prims : [o]).forEach((q) => {
      if ((q.t === 'text' || o.k === 'txt') && lfOk(q.f)) {
        const k = q.f + '|' + (q.b ? 1 : 0);
        if (!fk.includes(k)) fk.push(k);
      }
    });
  });
  const FN = (q) => (lfOk(q.f) ? '/F' + (3 + fk.indexOf(q.f + '|' + (q.b ? 1 : 0))) : '/F' + (q.b ? 2 : 1));
  LAYGA.length = 0;
  let cs = '';
  ops.forEach((o) => {
    if (o.k === 'an') {
      const X = (x) => f((o.ox + x) * mm),
        Y = (y) => f(H - (o.oy + y) * mm);
      cs += `q ${f(o.clip[0] * mm)} ${f(H - (o.clip[1] + o.clip[3]) * mm)} ${f(o.clip[2] * mm)} ${f(o.clip[3] * mm)} re W n 1 J 1 j\n`;
      o.prims.forEach((p) => {
        if (p.t === 'text') {
          const tw = layW(p.s, p.pt, p.b, p.f) * mm;
          let x = (o.ox + p.x) * mm;
          if (p.al === 'r') x -= tw;
          else if (p.al === 'c') x -= tw / 2;
          cs += `BT ${layHex(p.c)} rg ${FN(p)} ${f(p.pt)} Tf ${f(x)} ${Y(p.y)} Td (${layEnc(p.s)}) Tj ET\n`;
          return;
        }
        const st = !!p.stroke && p.w > 0,
          fl = !!p.fill;
        if (!st && !fl) return;
        let s = '';
        if (fl) s += `${layHex(p.fill)} rg `;
        if (st)
          s += `${layHex(p.stroke)} RG ${f(p.w * mm)} w [${(p.dash || []).map((x) => f(x * mm)).join(' ')}] 0 d `;
        p.pts.forEach((q, i) => {
          s += `${X(q[0])} ${Y(q[1])} ${i ? 'l' : 'm'} `;
        });
        if (p.closed) s += 'h ';
        s += st && fl ? 'B' : fl ? 'f' : 'S';
        cs += (fl && p.fa < 1 ? '/GS2 gs ' : '') + s + (fl && p.fa < 1 ? ' /GS1 gs' : '') + '\n';
      });
      cs += 'Q\n';
      return;
    }
    if (o.k === 'img')
      cs += `q ${f(o.w * mm)} 0 0 ${f(o.h * mm)} ${f(o.x * mm)} ${f(H - (o.y + o.h) * mm)} cm /Im${o.i} Do Q\n`;
    else if (o.k === 'rect') {
      cs += layRectPdf(o, mm, H, f);
    } else if (o.k === 'txt') {
      const tw = layW(o.s, o.pt, o.b, o.f) * mm;
      let x = o.x * mm;
      if (o.al === 'r') x -= tw;
      else if (o.al === 'c') x -= tw / 2;
      cs += `BT ${o.c ? layHex(o.c) : '0.114 0.114 0.106'} rg ${FN(o)} ${f(o.pt)} Tf ${f(x)} ${f(H - o.y * mm)} Td (${layEnc(o.s)}) Tj ET\n`;
    }
  });
  const FB = 7 + imgs.length,
    N = 6 + imgs.length + 3 * fk.length;
  P.push(A('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  obj(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(W)} ${f(H)}] /Resources << /ExtGState << /GS1 << /ca 1 /CA 1 >> /GS2 << /ca 0.25 /CA 1 >>${LAYGA.map((a, i) => ` /GA${i} << /ca ${a} /CA 1 >>`).join('')} >> /Font << /F1 5 0 R /F2 6 0 R ${fk.map((_, i) => `/F${3 + i} ${FB + 3 * i} 0 R`).join(' ')} >> /XObject << ${imgs.map((_, i) => `/Im${i + 1} ${7 + i} 0 R`).join(' ')} >> >> /Contents 4 0 R >>`,
  ]);
  const cb = A(cs);
  obj(4, [`<< /Length ${cb.length} >>\nstream\n`, cb, '\nendstream']);
  obj(5, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  obj(6, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  imgs.forEach((m, i) =>
    obj(7 + i, [
      `<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.bytes.length} >>\nstream\n`,
      m.bytes,
      '\nendstream',
    ]),
  );
  fk.forEach((k, i) => {
    const [fid, bb] = k.split('|'),
      F = LFONT[fid][bb === '1' ? 'b' : 'r'],
      by = lfBytes(fid, bb === '1'),
      nm =
        'LOT' +
        String(i).padStart(2, 'A') +
        '+' +
        LFONT[fid].n.replace(/\s+/g, '') +
        (bb === '1' ? '-Bold' : '-Regular'),
      n0 = FB + 3 * i;
    obj(n0, [
      `<< /Type /Font /Subtype /TrueType /BaseFont /${nm} /FirstChar 32 /LastChar 255 /Widths [${F.w.join(' ')}] /FontDescriptor ${n0 + 1} 0 R /Encoding /WinAnsiEncoding >>`,
    ]);
    obj(n0 + 1, [
      `<< /Type /FontDescriptor /FontName /${nm} /Flags 32 /FontBBox [${F.m.slice(0, 4).join(' ')}] /ItalicAngle 0 /Ascent ${F.m[4]} /Descent ${F.m[5]} /CapHeight ${F.m[6]} /StemV ${bb === '1' ? 140 : 80} /FontFile2 ${n0 + 2} 0 R >>`,
    ]);
    obj(n0 + 2, [`<< /Length ${by.length} /Length1 ${by.length} >>\nstream\n`, by, '\nendstream']);
  });
  obj(N + 1, [`<< /Title (${layEnc(title || 'Layout')}) /Producer (maad) >>`]);
  const xo = len();
  let x = 'xref\n0 ' + (N + 2) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= N + 1; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x +=
    'trailer\n<< /Size ' +
    (N + 2) +
    ' /Root 1 0 R /Info ' +
    (N + 1) +
    ' 0 R >>\nstartxref\n' +
    xo +
    '\n%%EOF';
  P.push(A(x));
  const out = new Uint8Array(len());
  let p = 0;
  P.forEach((c) => {
    out.set(c, p);
    p += c.length;
  });
  return out;
}
function layB64(url) {
  const b = atob(url.split(',')[1]),
    u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
function layExport() {
  const btn = $('layExp'),
    dpi = +$('layDpi').value || 150,
    [pw, ph] = layPage(),
    ops = [],
    imgs = [];
  btn.disabled = true;
  btn.textContent = 'Erzeuge PDF …';
  setTimeout(async () => {
    try {
      LAY.els.forEach((e) => {
        const it = layItems(e);
        if (e.type === 'pic') {
          const wpx = Math.min(4096, Math.max(64, Math.round((e.w / 25.4) * dpi))),
            url = lpDraw(e, wpx);
          if (url) {
            const g = lpGeo(e),
              hpx = Math.round((wpx * g.H) / LP.W);
            imgs.push({ w: wpx, h: hpx, bytes: layB64(url) });
            ops.push({ k: 'img', i: imgs.length, x: e.x, y: e.y, w: e.w, h: it.ih });
          }
        }
        if (e.type === 'view') {
          let wpx = Math.round((e.w / 25.4) * dpi),
            hpx = Math.round((it.ih / 25.4) * dpi);
          const m = Math.max(wpx, hpx);
          if (m > 4096) {
            wpx = Math.round((wpx * 4096) / m);
            hpx = Math.round((hpx * 4096) / m);
          }
          const url = layShot(layV(e, it.ih), Math.max(32, wpx), Math.max(32, hpx), 0.9);
          imgs.push({ w: Math.max(32, wpx), h: Math.max(32, hpx), bytes: layB64(url) });
          ops.push({ k: 'img', i: imgs.length, x: e.x, y: e.y, w: e.w, h: it.ih });
          if (it.an && it.an.length)
            ops.push({ k: 'an', clip: [e.x, e.y, e.w, it.ih], prims: it.an, ox: e.x, oy: e.y });
        }
        it.r.forEach((r) => ops.push({ k: 'rect', ...r }));
        it.t.forEach((t) => ops.push({ k: 'txt', ...t }));
      });
      const bytes = layPdf(pw, ph, ops, imgs, (S.project && S.project.name) || 'Layout'),
        fn =
          (((S.project && S.project.name) || 'layout').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim() || 'layout') +
          '_' +
          LAY.fmt.replace(/\W+/g, '') +
          '.pdf',
        blob = new Blob([bytes], { type: 'application/pdf' });
      let dl = null;
      try {
        dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      } catch (e) {
        logErr(e, 'layExport>anonym');
      }
      if (dl) await dl.save({ filename: fn, data: blob });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fn;
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
        alert('PDF-Export fehlgeschlagen: ' + ((err && err.message) || err));
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'PDF exportieren';
    }
  }, 60);
}

try {
  op('trees', LY.find((l) => l[1] === 'trees')[3]);
} catch (e) {
  logErr(e, 'init');
}
try {
  tgl('sun');
} catch (e) {
  console.warn(e);
}
