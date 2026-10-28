/* v296/297: Bildschirmschoner + Startseiten-Flugansicht (Maad-Logo) (Stufe 2, Kamera über den Wolken): kleine bunte Klötze fahren als „Autos“ auf den Straßen */
const CARS = { m: null, sig: '', net: null, c: [], last: 0, vis: false };
const CARCOL = ['#ffffff'];
function carsNet() {
  const acc = GEO.acc;
  if (!acc || !acc.line || !acc.line.roads || !GEO.size) return null;
  const P = [],
    ends = new Map(),
    key = (p) => Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);
  let tot = 0;
  for (const r of acc.line.roads) {
    const l = r.l;
    if (!l || l.length < 2) continue;
    const cum = [0];
    for (let i = 1; i < l.length; i++)
      cum.push(cum[i - 1] + Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]));
    const len = cum[cum.length - 1];
    if (len < 6) continue;
    const id = P.length;
    P.push({ l, cum, len, w: Math.min(14, r.w || 6) });
    tot += len * ((r.w || 6) >= 10 ? 1.5 : 1);
    [
      [key(l[0]), 0],
      [key(l[l.length - 1]), 1],
    ].forEach(([k, e]) => {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push([id, e]);
    });
  }
  if (!P.length) return null;
  return { P, ends, key, tot };
}
function carsPos(p, s, dir) {
  const l = p.l,
    c = p.cum;
  let i = 1;
  while (i < c.length - 1 && c[i] < s) i++;
  const t = (s - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]),
    a = l[i - 1],
    b = l[i];
  let dx = b[0] - a[0],
    dz = b[1] - a[1];
  const L = Math.hypot(dx, dz) || 1;
  dx /= L;
  dz /= L;
  if (dir < 0) {
    dx = -dx;
    dz = -dz;
  }
  const off = Math.min(3, p.w * 0.22);
  return { x: a[0] + (b[0] - a[0]) * t - dz * off, z: a[1] + (b[1] - a[1]) * t + dx * off, dx, dz };
}
