/* v253: Reiter „Analyse“ (rechts) nach dem Vorbild „Standort & Dateninformationen“: Kopf (Flurstück/Grundstück), Schieberegler Übersicht | Restriktionen (Datenquellen: Fenster „Datenquellen & Einstellungen“).
   Übersicht: Bebauungsplan, Höhen & Gelände, Umwelt & Schutz, Lärm, darunter Gebäude-Kennzahlen (bisheriger Inhalt).
   Umwelt & Schutz entsteht aus der Registry ENV (Naturschutz, Wasserschutz, Hochwasser, Lärm): je Eintrag eine Datenquelle (WFS-Adresse + Ebenenname, im Fenster „Datenquellen & Einstellungen“ einzutragen).
   Ohne Quelle steht „nicht angebunden“ – keine erfundenen Werte. Neue Umweltdaten = ein Eintrag in ENV. */
S.anT = S.anT || 'ue';
const ENV = [
  {
    k: 'nsg',
    g: 'env',
    n: 'Naturschutzgebiet',
    ic: 'leaf',
    no: 'Nein',
    yes: 'Ja',
    hint: 'z. B. Schutzgebiete des BfN oder des Landes (WFS, Polygone)',
  },
  {
    k: 'ffh',
    g: 'env',
    n: 'FFH-Gebiet (Natura 2000)',
    ic: 'leaf',
    no: 'Nein',
    yes: 'Ja',
    hint: 'BfN, Fauna-Flora-Habitat-Gebiete (WFS, Polygone)',
  },
  {
    k: 'vsg',
    g: 'env',
    n: 'Vogelschutzgebiet (Natura 2000)',
    ic: 'leaf',
    no: 'Nein',
    yes: 'Ja',
    hint: 'BfN, Vogelschutzgebiete (WFS, Polygone)',
  },
  {
    k: 'wsg',
    g: 'env',
    n: 'Wasserschutzgebiet',
    ic: 'drop',
    no: 'Nein',
    yes: 'Ja',
    hint: 'Wasserschutzgebiete (BfG, ArcGIS REST, Schnitt mit Grundstück)',
  },
  {
    k: 'hq',
    g: 'env',
    rg: 1,
    n: 'Über\u00adschwemmungs\u00adrisiko (Fluss)',
    ic: 'wave',
    no: 'Kein Risikogebiet',
    yes: 'Risikogebiet',
    hint: 'BfG nHWGK-HWRK, Risikogebiete Flüsse (ArcGIS REST)',
  },
  {
    k: 'sr',
    g: 'env',
    rg: 1,
    n: 'Starkregen (100-jährlich)',
    ic: 'drop',
    no: 'Kein Befund im Dienst',
    yes: 'Überflutungsgefahr',
    hint: 'BKG-Hinweiskarte Starkregengefahren (WMS, Überflutungstiefe); Länder ohne Daten bleiben leer',
  },
  {
    k: 'ueg',
    g: 'env',
    rg: 1,
    opt: 1,
    n: 'Überschwemmungsgebiet (HQ100)',
    ic: 'wave',
    no: 'Nicht in einem Überschwemmungsgebiet',
    yes: 'Überschwemmungsgebiet',
    hint: 'Festgesetzte oder ermittelte Überschwemmungsgebiete HQ100 (Länderdienste: WFS, ArcGIS REST oder WMS je Bundesland)',
  },
  {
    k: 'hqx',
    g: 'env',
    rg: 1,
    opt: 1,
    n: 'Extremhochwasser (HQ extrem)',
    ic: 'wave',
    no: 'Nicht überflutet',
    yes: 'Überflutungsgebiet',
    hint: 'Überflutungsfläche bei Extremhochwasser (Länderdienste je Bundesland)',
  },
  {
    k: 'clc',
    g: 'flae',
    clc: 1,
    opt: 0,
    n: 'Flächennutzung (CORINE)',
    ic: 'flae',
    no: 'Keine Daten im Dienst',
    yes: '',
    hint: 'CORINE Land Cover 5 ha (BKG, Dienst Stand 2018): Bodenbedeckung/Landnutzung am Grundstück, Anteil je Klasse (WFS oder WMS)',
  },
  {
    k: 'lae',
    g: 'lae',
    n: 'Lärmpegel (Tag/Nacht)',
    ic: 'noise',
    no: 'Keine Kartierung',
    yes: '',
    hint: 'Lärmkartierung des UBA (WMS, je Quelle Tag/Nacht am Grundstücksmittelpunkt)',
    attr: 1,
  },
];
/* Vorbelegung (Dienst laut GetCapabilities des BfN gelesen, Abruf im Browser ungeprüft): Naturschutzgebiete */
const LAEL =
  '27:Straße:T,30:Straße:T,26:Straße:N,29:Straße:N,20:Schiene:T,23:Schiene:T,19:Schiene:N,22:Schiene:N,13:Luftverkehr:T,16:Luftverkehr:T,12:Luftverkehr:N,15:Luftverkehr:N,9:Industrie:T,8:Industrie:N';
const BFN = 'https://geodienste.bfn.de/ogc/wfs/schutzgebiet';
const ENV0 = {
  clc: {
    url: 'https://sgx.geodatenzentrum.de/wfs_clc5_2018',
    type: 'auto',
    fmt: 'GEOJSON',
    crs: '25832',
    pre: 1,
  },
  ffh: { url: BFN, type: 'schutzgebiet:Fauna_Flora_Habitat_Gebiete', fmt: 'GEOJSON', crs: '25832', pre: 1 },
  vsg: { url: BFN, type: 'schutzgebiet:Vogelschutzgebiete', fmt: 'GEOJSON', crs: '25832', pre: 1 },
  hq: {
    kind: 'arcgis',
    url: 'https://geoportal.bafg.de/arcgis/rest/services/nHWGK-HWRK/Risikogebiete_L_RW/MapServer/0',
    type: 'Layer 0',
    pre: 1,
  },
  lae: {
    kind: 'wms',
    url: 'https://datahub.uba.de/server/services/VeLa/LK/MapServer/WMSServer',
    type: LAEL,
    pre: 1,
  },
  nsg: {
    url: 'https://geodienste.bfn.de/ogc/wfs/schutzgebiet',
    type: 'schutzgebiet:Naturschutzgebiete',
    fmt: 'GEOJSON',
    crs: '25832',
    pre: 1,
  },
  wsg: {
    kind: 'arcgis',
    url: 'https://geoportal.bafg.de/arcgis/rest/services/BFG/Wasserschutzgebiete/MapServer/0',
    type: 'Layer 0',
    pre: 1,
  },
  sr: { kind: 'wms', url: 'https://sgx.geodatenzentrum.de/wms_starkregen', type: 'tiefe_agw', pre: 1 },
};
const ENVC = {};
for (const k in ENV0) ENVC[k] = Object.assign({}, ENV0[k]);
try {
  const z = JSON.parse(localStorage.getItem('lot_env') || '{}');
  for (const k in z) ENVC[k] = z[k] && z[k].off ? z[k] : Object.assign({}, ENV0[k] || {}, z[k]);
  for (const k in ENV0) if (z[k] && z[k].off) delete ENVC[k];
} catch (e) {
  logErr(e, 'init');
}
if (ENVC.clc && /wfs_clc5_2021/.test(ENVC.clc.url || '')) ENVC.clc = Object.assign({}, ENV0.clc);
if (ENVC.hq && /Risikogebiete_L_RW\/MapServer\/?$/.test(ENVC.hq.url || '')) ENVC.hq.url = ENV0.hq.url;
const ENVSRC = {
  clc: {
    by: 'BKG – CORINE Land Cover 5 ha (CLC5), Dienst Stand 2018',
    lic: 'dl-de/by-2-0 · © GeoBasis-DE / BKG',
    note: 'Mindestfläche 5 ha, Klassenfeld CLC18 bzw. CLC21 (3-stellig, Nomenklatur 111–523). Der BKG beschreibt für Stand 2018 einen WFS (https://sgx.geodatenzentrum.de/wfs_clc5_2018) und einen INSPIRE-WMS (…/wms_clc5_2018_inspire, Ebene LC.LandCoverSurfaces); für Stand 2021 ist dort nur der Download dokumentiert (die Adresse …/wfs_clc5_2021 antwortet mit HTTP 400). Datentyp „auto“ = maad liest ihn aus GetCapabilities. Sobald der BKG einen 2021-Dienst nennt, hier Adresse eintragen. Es wird nichts vorgeladen – maad fragt nur das Grundstück ab (die GPKG-Datei mit ca. 1,5 GB wird nicht benötigt).',
  },
  ffh: {
    by: 'Bundesamt für Naturschutz (BfN)',
    lic: 'GeoNutzV (Nutzungsbestimmungen für Geodaten des Bundes)',
    note: 'Natura 2000, Richtlinie 92/43/EWG. Nicht für Planungszwecke geeignet; Grenzen im Maßstab der Landesmeldung.',
  },
  vsg: {
    by: 'Bundesamt für Naturschutz (BfN)',
    lic: 'GeoNutzV (Nutzungsbestimmungen für Geodaten des Bundes)',
    note: 'Natura 2000, Richtlinie 2009/147/EG. Nicht für Planungszwecke geeignet; Grenzen im Maßstab der Landesmeldung.',
  },
  hq: {
    by: 'Bundesanstalt für Gewässerkunde (BfG), nationale Hochwasserkarten',
    lic: 'Lizenz laut Dienst prüfen',
    note: 'Dienst „Risikogebiete_L_RW“ (Flüsse), Layer 0 „Risikogebiet“: Gebiete mit potenziell signifikantem Hochwasserrisiko (Felder u. a. APSFR_CD, POLY_NAME, FL_RECUR), Szenario niedrige Wahrscheinlichkeit; keine Wassertiefen. Layer 1 ist die Übersicht für kleine Maßstäbe. Küste (…_L_CW) oder weitere Adressen per Leerzeichen anfügen.',
  },
  lae: {
    by: 'Umweltbundesamt (UBA), VeLa',
    lic: 'Lizenz laut Dienst prüfen',
    note: 'Strategische Lärmkartierung (Lden/Lnight) nur für Ballungsräume und Hauptlärmquellen: Hauptverkehrsstraßen, Haupteisenbahnstrecken, Großflughäfen. „Keine Kartierung“ heißt nicht „leise“.',
  },
  wsg: {
    by: 'Bundesanstalt für Gewässerkunde (BfG)',
    lic: 'Lizenz laut Dienst prüfen',
    note: 'WasserBLIcK/BfG & zuständige Behörden der Länder; bundesweit vereinheitlicht, Länder-Dienste sind teils genauer. Trinkwasser- und Heilquellenschutzgebiete.',
  },
  sr: {
    by: 'Bundesamt für Kartographie und Geodäsie (BKG)',
    lic: 'Datenlizenz Deutschland – Namensnennung 2.0 (© BKG)',
    note: 'Simulation ohne Kanalnetz und Versickerung (Hinweiskarte, keine Detailplanung). Deckt nicht alle Länder ab.',
  },
  nsg: {
    by: 'Bundesamt für Naturschutz (BfN)',
    lic: 'Nutzungsbestimmungen für Geodaten des Bundes (GeoNutzV)',
    note: 'Hinweis des Anbieters: nicht für Planungszwecke geeignet.',
  },
};
const ENVR = {}; /* Ergebnisse: key → {site, res:{hit,names,val}|err, t} */
