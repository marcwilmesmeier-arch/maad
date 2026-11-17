/* Außenkontur in LOD 200: nur die wirklichen Außenkanten des Baukörpers (echte Ecken über 20° Knick, Fuß, Dachrand,
   Auskragungen und Rücksprünge zwischen Geschossen, Dachkanten geneigter Dächer) – keine Unterteilungen der Wände,
   Decken oder Öffnungen. Sichtbar mit „Kontur“ (S.noK aus), in der Explosionsansicht ausgeblendet (dort zeigen die
   Bauteile ihre eigenen Kanten). Mit der fetten Kontur (16-darstellung-erweitert/010) werden dieselben Kanten zusätzlich als breite
   Bildschirmlinie gezeichnet (wie die Fußlinie) – eine Hülle wie bei Umgebungsgebäuden schiene durch die Fensterlöcher. */
const L2KO = new Map(); // Gebäude-ID → { sig, ln }
/** Kantenpunkte [x, y, z, x, y, z, …] der Außenkontur von Gebäude b. */
function l2KonturPunkte(b) {
  const out = [],
    L = b.levels
      .map((l, j) => ({ l, j, f: lf(b, l), z0: skZ(b, j), z1: skZ(b, j) + l.h }))
      .filter((x) => !x.l.ug);
  if (!L.length) return out;
  const seg = (a, c, y) => out.push(a[0], y, a[1], c[0], y, c[1]),
    flaeche = (f) => {
      let A = 0;
      for (let i = 0; i < f.length; i++) {
        const p = f[i],
          q = f[(i + 1) % f.length];
        A += p[0] * q[1] - q[0] * p[1];
      }
      return A;
    },
    // Ring f auf Höhe y abgehen; Stücke, an denen die Wand gerade weiterläuft (Nachbargeschoss g), auslassen
    rand = (f, y, g) => {
      const n = f.length,
        sg = flaeche(f) > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = f[i],
          c = f[(i + 1) % n],
          len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 0.05) continue;
        const ux = (c[0] - a[0]) / len,
          uz = (c[1] - a[1]) / len,
          nx = sg > 0 ? uz : -uz,
          nz = sg > 0 ? -ux : ux,
          k = Math.max(1, Math.ceil(len / 0.5));
        let start = null;
        for (let s = 0; s <= k; s++) {
          let kante = false;
          if (s < k) {
            const t = ((s + 0.5) / k) * len,
              m = [a[0] + ux * t, a[1] + uz * t];
            kante =
              !g ||
              !(
                inP([m[0] - nx * 0.05, m[1] - nz * 0.05], g) && !inP([m[0] + nx * 0.05, m[1] + nz * 0.05], g)
              );
          }
          const t0 = (s / k) * len,
            P = [a[0] + ux * t0, a[1] + uz * t0];
          if (kante && !start) start = P;
          else if (!kante && start) {
            seg(start, P, y);
            start = null;
          }
        }
      }
    };
  L.forEach((x, q) => {
    const unten = L[q - 1] && L[q - 1].j === x.j - 1 ? L[q - 1].f : null,
      oben = L[q + 1] && L[q + 1].j === x.j + 1 ? L[q + 1].f : null;
    // senkrechte Kanten nur an echten Ecken
    x.f.forEach((v, i) => {
      if (skEckeEcht(x.f, i)) out.push(v[0], x.z0, v[1], v[0], x.z1, v[1]);
    });
    rand(x.f, x.z0, unten);
    rand(x.f, x.z1, oben);
  });
  // geneigte Dächer: Kanten der Dachfläche
  if (b._rp && b._rp.geo && b.roof && b.roof.type && b.roof.type !== 'flat') {
    const eg = new T.EdgesGeometry(b._rp.geo, 15),
      a = eg.attributes.position.array;
    for (let i = 0; i < a.length; i++) out.push(a[i]);
    eg.dispose();
  }
  return out;
}
/** Konturen der geplanten Gebäude aktuell halten (Takt aus 030-aktionen). */
function l2Kontur() {
  const an = l2on(),
    ex = !!(S.expl && S.expl.cur > 0.05) || l23(),
    da = new Set();
  S.bld.forEach((b) => {
    if (b.ex || b._y == null || !an) return;
    da.add(b.id);
    const sig = skSig(b) + '|' + JSON.stringify(b.roof || {}) + '|' + (b._rp ? b._rp.h : 0);
    let o = L2KO.get(b.id);
    if (!o || o.sig !== sig) {
      if (o) l2KonturWeg(o);
      const ge = new T.BufferGeometry();
      ge.setAttribute('position', new T.BufferAttribute(new Float32Array(l2KonturPunkte(b)), 3));
      const ln = new T.LineSegments(ge, new T.LineBasicMaterial({ color: 0x4a4a4a }));
      ln.userData.kont = 1;
      ln.raycast = () => {};
      G.l2.add(ln);
      // fette Kontur: gleiche Kanten als breite Linie in der Gruppe der fetten Kontur
      const fg = konQuads(Array.from(ge.attributes.position.array)),
        fett = fg ? new T.Mesh(fg, KON.lm) : null;
      if (fett) {
        fett.frustumCulled = false;
        fett.raycast = () => {};
        KON.g.add(fett);
      }
      o = { sig, ln, fett };
      L2KO.set(b.id, o);
    }
    o.ln.visible = !S.noK && !ex;
    if (o.fett) o.fett.visible = !ex;
  });
  L2KO.forEach((o, id) => {
    if (da.has(id)) return;
    l2KonturWeg(o);
    L2KO.delete(id);
  });
}
function l2KonturWeg(o) {
  G.l2.remove(o.ln);
  o.ln.geometry.dispose();
  if (o.fett) {
    KON.g.remove(o.fett);
    o.fett.geometry.dispose();
  }
}
