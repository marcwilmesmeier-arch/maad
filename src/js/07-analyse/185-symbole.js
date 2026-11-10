// ======================= SYMBOLE „MOBILITY & ACCESS“ =======================
// Vektorsymbole im Stil der Symboltafel (runder Rahmen, helle Füllung, feine runde Linien, Salbeigrün): als SVG für
// Panel, Legende und Reiter, als Canvas-Textur für die 3D-Marker. Glyphen im 24er-Raster, Kreis r = 10,6.

const SYM = {
  farbe: '#6b8b67', // Linie und Glyphe (Grün der Gruppe „Mobility & Access“)
  hell: '#dde7d8', // Füllung des Kreises: leichtes Salbeigrün wie in der Vorlage
  glyph: {
    // zwei Fußabdrücke (Sohle + Ferse), versetzt
    fuss: 'M9.4 5.9c.9 0 1.5 1.1 1.5 2.5s-.6 2.6-1.5 2.6-1.5-1.2-1.5-2.6.6-2.5 1.5-2.5zM9.6 12.3c.7 0 1.1.6 1.1 1.3s-.4 1.3-1.1 1.3-1.1-.6-1.1-1.3.4-1.3 1.1-1.3zM14.4 9.3c.9 0 1.5 1.1 1.5 2.5s-.6 2.6-1.5 2.6-1.5-1.2-1.5-2.6.6-2.5 1.5-2.5zM14.6 15.7c.7 0 1.1.6 1.1 1.3s-.4 1.3-1.1 1.3-1.1-.6-1.1-1.3.4-1.3 1.1-1.3z',
    // Bus von vorn: Aufbau, Frontscheibe, Scheinwerfer, Räder
    bus: 'M8 6.4h8a1.5 1.5 0 0 1 1.5 1.5v8.6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7.9A1.5 1.5 0 0 1 8 6.4zM6.5 12.6h11M8.6 8.9h6.8M9.1 15.1h.01M14.9 15.1h.01M8.7 17.5v1.4M15.3 17.5v1.4',
    // Straßenbahn: Wagen mit Fensterband, Stromabnehmer, Schiene darunter
    tram: 'M7 9.2h10a1 1 0 0 1 1 1v5.8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-5.8a1 1 0 0 1 1-1zM8.4 11.2h7.2v2.4H8.4zM10.8 11.2v2.4M13.2 11.2v2.4M12 9.2V7.4M9.6 5.8L12 7.4l2.4-1.6M6.6 18.6h10.8',
    // Bahn: Gleis mit Schwellen
    bahn: 'M10 5.4v13.2M14 5.4v13.2M8.4 7.4h7.2M8.4 10.4h7.2M8.4 13.4h7.2M8.4 16.4h7.2',
    // U-Bahn und S-Bahn: Buchstabe im gleichen Strich
    u: 'M9.4 7.2v5.9a2.6 2.6 0 0 0 5.2 0V7.2',
    s: 'M14.6 8.4c-.6-.9-1.6-1.3-2.6-1.3-1.6 0-2.7.9-2.7 2.2 0 2.9 5.6 1.9 5.6 5 0 1.4-1.2 2.5-2.9 2.5-1.2 0-2.3-.5-2.9-1.4',
    // Flugzeug von oben
    flug: 'M12 5.4c.6 0 1 .5 1 1.2v3.9l5 2.8v1.4l-5-1.3v3l1.6 1.2v1.1L12 18l-2.6.7v-1.1l1.6-1.2v-3l-5 1.3v-1.4l5-2.8V6.6c0-.7.4-1.2 1-1.2z',
  },
};

/** Symbol als SVG (Kreis + Glyphe), Größe px. */
function symSvg(name, px = 18) {
  return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" style="flex:none;vertical-align:middle" aria-hidden="true"><circle cx="12" cy="12" r="10.6" fill="${SYM.hell}" stroke="${SYM.farbe}" stroke-width="0.85"/><path d="${SYM.glyph[name] || ''}" fill="none" stroke="${SYM.farbe}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/** Nur die Glyphe (ohne Kreis) für Reiterknöpfe; Farbe über currentColor. Ohne den Rahmen wirkt die Glyphe klein:
 *  um den Faktor k vergrößert, Strichstärke ausgeglichen. */
function symGlyphe(name, k = 1.5) {
  return `<g transform="translate(12 12) scale(${k}) translate(-12 -12)" stroke-width="${(1.6 / k).toFixed(2)}"><path d="${SYM.glyph[name] || ''}"/></g>`;
}
const SYM_TEX = {};
/** Symbol als Canvas-Textur für 3D-Marker (etwas kräftigere Linien, damit es klein lesbar bleibt). */
function symTextur(name) {
  if (SYM_TEX[name]) return SYM_TEX[name];
  const N = 128,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  x.scale(N / 24, N / 24);
  x.beginPath();
  x.arc(12, 12, 10.6, 0, Math.PI * 2);
  x.fillStyle = SYM.hell;
  x.fill();
  x.lineWidth = 1.1;
  x.strokeStyle = SYM.farbe;
  x.stroke();
  x.lineWidth = 1.6;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.stroke(new Path2D(SYM.glyph[name] || ''));
  const t = new T.CanvasTexture(c);
  t.anisotropy = 4;
  SYM_TEX[name] = t;
  return t;
}
