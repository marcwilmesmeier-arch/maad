// ======================= SYMBOLBIBLIOTHEK FÜR DIE BESCHRIFTUNG =======================
// Vier Gruppen wie auf der Symboltafel: Mobility & Access, Landscape & Climate, Uses & Community, Context & Structure –
// je 24 Symbole (runder Rahmen, helle Füllung, feine Linien in der Gruppenfarbe) und 6 Flächenfüllungen (voll,
// schräg, kreuz, quer, Punkte, gestrichelt). Glyphen als SVG-Pfad im 24er-Raster (Kreis r = 10,6). Für Ansicht, Layout
// und PDF werden die Pfade in Linienzüge zerlegt (symPfadLinien). Schlüssel in Anmerkungen: „gruppe:name“.

const SYMB = [
  {
    k: 'mob',
    n: 'Mobility & Access',
    farbe: '#6b8b67',
    hell: '#dde7d8',
    voll: '#a7bca0',
    s: [
      ['fuss', 'Zu Fuß', SYM.glyph.fuss],
      [
        'rad',
        'Fahrrad',
        'M8.6 15.2m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0M15.4 15.2m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0M8.6 15.2l2.2-4.4h3.4l1.2 4.4M10.8 10.8l1.8 4.4h-4M10.2 9.4h1.6M13.6 10.8l.4-1.6h1.2',
      ],
      [
        'radfuss',
        'Rad und Fuß',
        'M9.8 9.6m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M14.2 9.6m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M9.8 9.6l1.3-2.6h2l.9 2.6M11.1 7l1.1 2.6h-2.4M10.8 13.2c.6 0 .9.7.9 1.5s-.3 1.5-.9 1.5-.9-.7-.9-1.5.3-1.5.9-1.5zM11 17.4h.01M13.4 14.6c.6 0 .9.7.9 1.5s-.3 1.5-.9 1.5-.9-.7-.9-1.5.3-1.5.9-1.5zM13.6 18.8h.01',
      ],
      [
        'radstation',
        'Radverleih',
        'M8.6 15.6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M15.4 15.6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M8.6 15.6l2-4h3.2l1.6 4M10.6 11.6l1.8 4H8.6M12 9.8s-2-1.9-2-3.3a2 2 0 0 1 4 0c0 1.4-2 3.3-2 3.3zM12 6.5h.01',
      ],
      [
        'radparken',
        'Rad sicher abstellen',
        'M8 15.6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M14.4 15.6m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M8 15.6l2-4h3.2l1.2 4M10 11.6l1.8 4H8M15 8.6h3v2.6h-3zM15.6 8.6V7.6a.9.9 0 0 1 1.8 0v1',
      ],
      ['bus', 'Bus', SYM.glyph.bus],
      ['tram', 'Straßenbahn', SYM.glyph.tram],
      ['bahn', 'Bahn', SYM.glyph.bahn],
      [
        'carsharing',
        'Carsharing',
        'M7.4 15.4v-2.2l1.2-2.6h6.8l1.2 2.6v2.2zM7.4 15.4v1.2M16.6 15.4v1.2M9 13.6h.01M15 13.6h.01M12 9.2s-1.6-1.5-1.6-2.6a1.6 1.6 0 0 1 3.2 0c0 1.1-1.6 2.6-1.6 2.6z',
      ],
      [
        'taxi',
        'Taxi',
        'M7 15.8v-2.4l1.3-2.8h7.4l1.3 2.8v2.4zM7 15.8v1.2M17 15.8v1.2M8.8 13.8h.01M15.2 13.8h.01M10.8 10.6V9h2.4v1.6',
      ],
      [
        'lieferwagen',
        'Lieferverkehr',
        'M6.4 15.6V9.4h7.8v6.2zM14.2 11.4h2.4l1.2 2v2.2h-3.6M8.6 15.6m-1.1 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0M15.6 15.6m-1.1 0a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0',
      ],
      ['parken', 'Parken', 'M10 17V7.4h2.6a2.6 2.6 0 0 1 0 5.2H10'],
      [
        'parkhaus',
        'Parkhaus',
        'M8.2 6.4v11.2M8.2 6.4h1.6M8.2 17.6h1.6M10.8 8.2h3.4a.8.8 0 0 1 .8.8v6a.8.8 0 0 1-.8.8h-3.4a.8.8 0 0 1-.8-.8V9a.8.8 0 0 1 .8-.8zM10.6 10.4h4M10.6 13.6h4',
      ],
      [
        'laden',
        'E-Laden',
        'M8.4 17.4V7.6a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v9.8M7.6 17.4h7.2M9.4 8.8h3.6v2.4H9.4zM11.6 12.4l-1 1.6h1.6l-1 1.6M14 10.6h1.2a.8.8 0 0 1 .8.8v3a.7.7 0 0 0 1.4 0V12.4M16.6 11.6v-1.2M17.6 11.6v-1.2',
      ],
      [
        'knoten',
        'Knotenpunkt',
        'M12 12m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M12 10.6V6.4M12 13.4v4.2M10.6 12H6.4M13.4 12h4.2M11 7.4l1-1 1 1M11 16.6l1 1 1-1M7.4 11l-1 1 1 1M16.6 11l1 1-1 1',
      ],
      ['strasse', 'Straße', 'M9.6 6.2v11.6M14.4 6.2v11.6M12 6.8v1.4M12 10.2v1.4M12 13.6v1.4M12 17v.6'],
      ['einbahn', 'Einbahnstraße', 'M9 6.2v11.6M15 6.2v11.6M12 16.6V8M10.6 9.4L12 8l1.4 1.4'],
      [
        'radbuegel',
        'Fahrradbügel',
        'M6.6 9.2h10.8v5.6H6.6zM8.4 9.2v5.6M10.2 9.2v5.6M12 9.2v5.6M13.8 9.2v5.6M15.6 9.2v5.6',
      ],
      ['schwelle', 'Aufpflasterung', 'M6.2 14.4h3.2c.8 0 1.2-2 2.6-2s1.8 2 2.6 2h3.2M7.4 16.2h9.2'],
      [
        'bruecke',
        'Brücke',
        'M6.4 10.4h11.2M7.4 10.4v6.4M16.6 10.4v6.4M7.4 13.6c1.2-.8 3-1.4 4.6-1.4s3.4.6 4.6 1.4M9.4 10.4V8.8M14.6 10.4V8.8',
      ],
      ['treppe', 'Treppe', 'M6.6 16.6h2.2v-2.2H11v-2.2h2.2V10h2.2V7.8h2'],
      ['durchfahrt', 'Durchfahrt', 'M6.4 12h5.2M10.2 10.6l1.4 1.4-1.4 1.4M13 17V10a2.4 2.4 0 0 1 4.8 0v7'],
      [
        'barrierefrei',
        'Barrierefrei',
        'M10.6 6.6h.01M10.6 8.6v4.6h3.4l1.4 3.4M10.6 10.8h2.6M9.4 11.2a3.6 3.6 0 1 0 5 4.4',
      ],
      [
        'roller',
        'E-Roller',
        'M8 16.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M16.4 16.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M9.4 16.4h5.6l1.4-9.6M15.4 6.8h2.2',
      ],
      ['u', 'U-Bahn', SYM.glyph.u],
      ['s', 'S-Bahn', SYM.glyph.s],
      ['flug', 'Flughafen', SYM.glyph.flug],
    ],
  },
  {
    k: 'lan',
    n: 'Landscape & Climate',
    farbe: '#5f8297',
    hell: '#dde8ee',
    voll: '#a2b8c4',
    s: [
      ['baum', 'Baum', 'M12 12.6a3.4 3.4 0 1 0 0-6.8a3.4 3.4 0 1 0 0 6.8zM12 12.6v4.8M10.4 17.4h3.2'],
      [
        'baumgruppe',
        'Baumgruppe',
        'M9.8 12a2.8 2.8 0 1 0 0-5.6a2.8 2.8 0 1 0 0 5.6zM9.8 12v5.2M14.8 14a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM14.8 14v3.2M7.6 17.2h9.2',
      ],
      [
        'hecke',
        'Hecke',
        'M6.6 15.4v-2.2a1.8 1.8 0 0 1 3.6 0a1.8 1.8 0 0 1 3.6 0a1.8 1.8 0 0 1 3.6 0v2.2zM6 15.4h12',
      ],
      [
        'blume',
        'Blühfläche',
        'M12 12m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M12 10.7c-1-1.6-.8-3.4 0-3.4s1 1.8 0 3.4zM12 13.3c-1 1.6-.8 3.4 0 3.4s1-1.8 0-3.4zM10.7 12c-1.6-1-3.4-.8-3.4 0s1.8 1 3.4 0zM13.3 12c1.6-1 3.4-.8 3.4 0s-1.8 1-3.4 0z',
      ],
      [
        'dachgruen',
        'Dachbegrünung',
        'M7.6 11.4h8.8v5.8H7.6zM9.8 13.4h1.4v1.4H9.8zM12.8 13.4h1.4v1.4h-1.4zM8.4 11.4V9.6M8.4 10l-.8-.8M8.4 10.4l.8-.8M12 11.4V9.2M12 9.8l-.9-.9M12 10.2l.9-.9M15.6 11.4V9.6M15.6 10l-.8-.8M15.6 10.4l.8-.8',
      ],
      [
        'hochbeet',
        'Pflanzbeet',
        'M7.2 12.4h9.6v4.4H7.2zM7.2 14.4h9.6M9 12.4v-2.2M9 10.8l-.9-.9M9 11.2l.9-.9M12 12.4V9.8M12 10.4l-.9-.9M12 10.8l.9-.9M15 12.4v-2.2M15 10.8l-.9-.9M15 11.2l.9-.9',
      ],
      [
        'setzling',
        'Pflanzung',
        'M12 16.8v-5.4M12 13c-1.8 0-3-1.2-3-3 1.8 0 3 1.2 3 3zM12 11.4c0-1.8 1.2-3 3-3 0 1.8-1.2 3-3 3zM8.4 16.8h7.2',
      ],
      ['blatt', 'Blatt / Grün', 'M8 16c0-5 3.4-8.4 8.4-8.4 0 5-3.4 8.4-8.4 8.4zM8 16l5.2-5.2'],
      [
        'wasser',
        'Wasser',
        'M7 10c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M7 12.6c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M7 15.2c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0',
      ],
      [
        'becken',
        'Wasserfläche',
        'M6.8 8.8h10.4M8.6 8.8V10M12 8.8V10M15.4 8.8V10M7 12.6c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M7 15.2c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0',
      ],
      [
        'versickerung',
        'Versickerung',
        'M9.4 6.6v6M12 6.6v6M14.6 6.6v6M8.6 7.6h1.6M11.2 7.6h1.6M13.8 7.6h1.6M7 14.6c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M7 17c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0',
      ],
      [
        'regen',
        'Regen',
        'M9 13.2a2.4 2.4 0 0 1-.2-4.8 3.2 3.2 0 0 1 6.2.6 2.1 2.1 0 0 1 0 4.2zM10 15l-.6 1.4M12.4 15l-.6 1.4M14.8 15l-.6 1.4',
      ],
      [
        'starkregen',
        'Starkregen',
        'M9 11.4a2.2 2.2 0 0 1-.2-4.4 3 3 0 0 1 5.8.6 1.9 1.9 0 0 1 0 3.8zM10 12.8l-.5 1.2M12.2 12.8l-.5 1.2M14.4 12.8l-.5 1.2M7.2 15.2v1.8h9.6v-1.8M7.2 16.2c1.6-.8 3.2.8 4.8 0s3.2.8 4.8 0',
      ],
      [
        'sonne',
        'Sonne',
        'M12 12m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0M12 6.4v1.4M12 16.2v1.4M6.4 12h1.4M16.2 12h1.4M8 8l1 1M15 15l1 1M8 16l1-1M15 9l1-1',
      ],
      [
        'schatten',
        'Sonnenschutz',
        'M9.4 9.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M9.4 6.6v.8M6.6 9.4h.8M7.4 7.4l.6.6M11.4 7.4l-.6.6M10 14.2a4.4 4.4 0 0 1 8.4 0zM14.2 14.2v3.4a.8.8 0 0 1-1.6 0',
      ],
      [
        'temperatur',
        'Temperatur',
        'M11 13.6V7.6a1 1 0 0 1 2 0v6a2.2 2.2 0 1 1-2 0zM12 14.4v-3.4M13.8 8.4h1M13.8 10h1M13.8 11.6h1',
      ],
      ['wind', 'Wind', 'M6.6 9.8h7.4a1.6 1.6 0 1 0-1.6-1.6M6.6 12.4h9.8a1.6 1.6 0 1 1-1.6 1.6M6.6 15h5'],
      [
        'laermschutz',
        'Lärmschutz',
        'M15.6 6.8v10.4M17.2 6.8v10.4M13.2 9.8a3.2 3.2 0 0 1 0 4.4M11.4 10.8a1.6 1.6 0 0 1 0 2.4M8 12h.01M9.6 12h.01',
      ],
      [
        'laerm',
        'Lärm',
        'M7.2 10.4h2l2.6-2.2v7.6l-2.6-2.2h-2zM13.6 10.2a2.6 2.6 0 0 1 0 3.6M15.2 8.6a5 5 0 0 1 0 6.8',
      ],
      ['topografie', 'Topografie', 'M6.6 17L12 6.8 17.4 17zM9 13.2h6M10.4 10.6h3.2'],
      ['neigung', 'Gefälle', 'M6.8 16.8h10.4M6.8 16.8L16 9.6M11.6 16.8a4.8 4.8 0 0 0-.9-2.9'],
      [
        'boden',
        'Boden',
        'M6.8 9.6h10.4M6.8 12h10.4M7 14.6c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M9 16.8h.01M12 16.8h.01M15 16.8h.01',
      ],
      [
        'spiel',
        'Spielplatz',
        'M8 17.2L10.4 7h3.2L16 17.2M10.4 7h3.2M10.6 9.6v4.2M13.4 9.6v4.2M10.2 13.8h3.6',
      ],
      [
        'solar',
        'Photovoltaik',
        'M7.6 9.2h10l-1.6 6.4H6zM7 12.4h10M10.8 9.2l-1.6 6.4M14.4 9.2l-1.6 6.4M11 15.6v1.6M9 17.2h4',
      ],
    ],
  },
  {
    k: 'nut',
    n: 'Uses & Community',
    farbe: '#a25d5c',
    hell: '#f1e2e0',
    voll: '#c28f8d',
    s: [
      ['wohnen', 'Wohnen', 'M6.8 11.6L12 7.2l5.2 4.4M8.2 10.4v6.8h7.6v-6.8M12.6 13.4h2v2h-2z'],
      [
        'buero',
        'Büro',
        'M8.4 6.6h7.2v10.8H8.4zM10 8.6h1.2M12.8 8.6H14M10 11h1.2M12.8 11H14M10 13.4h1.2M12.8 13.4H14M11.2 17.4v-1.8h1.6v1.8',
      ],
      ['hotel', 'Übernachten', 'M6.6 16.4V9.4M6.6 12.8h10.8v3.6M6.6 15h10.8M8.4 12.8v-1.6a1 1 0 0 1 1-1h2.4'],
      [
        'einkauf',
        'Einkauf',
        'M7 10.4h10l-1.2 6.4H8.2zM9.4 10.4l1.6-3.2M14.6 10.4L13 7.2M10 12.6v2.2M12 12.6v2.2M14 12.6v2.2',
      ],
      ['geschaeft', 'Geschäft', 'M7.4 10.4L8.4 7h7.2l1 3.4zM8 10.4v6.8h8v-6.8M10.6 17.2v-3.8h2.8v3.8'],
      [
        'markt',
        'Markt',
        'M6.6 10.4L12 7.4l5.4 3zM7.8 10.4v6.4M16.2 10.4v6.4M6.6 13.4h10.8M9.8 13.4v-1.6M14.2 13.4v-1.6',
      ],
      [
        'cafe',
        'Café',
        'M7.8 11h7.4v3.2a3 3 0 0 1-3 3H10.8a3 3 0 0 1-3-3zM15.2 11.8h.8a1.4 1.4 0 0 1 0 2.8h-.9M9.6 9.4c-.4-.8.4-1.2 0-2M11.6 9.4c-.4-.8.4-1.2 0-2M13.6 9.4c-.4-.8.4-1.2 0-2',
      ],
      [
        'essen',
        'Gastronomie',
        'M9.2 6.8v3.4a1.4 1.4 0 0 0 2.8 0V6.8M10.6 6.8v10.4M14.6 17.2V6.8c-1.2.6-1.8 2.2-1.8 4.2h1.8',
      ],
      [
        'verleih',
        'Gemeinschaftsraum',
        'M8.6 9.6h6.8a1.4 1.4 0 0 1 1.4 1.4v2a1.4 1.4 0 0 1-1.4 1.4H8.6A1.4 1.4 0 0 1 7.2 13v-2a1.4 1.4 0 0 1 1.4-1.4zM10 7.8h.01M14 7.8h.01M10 16.2h.01M14 16.2h.01',
      ],
      [
        'werkstatt',
        'Werkstatt',
        'M14.2 7.2a2.8 2.8 0 0 0-3.4 3.6l-3.6 3.6a1.2 1.2 0 0 0 1.7 1.7l3.6-3.6a2.8 2.8 0 0 0 3.6-3.4l-1.6 1.6-1.6-.4-.4-1.6z',
      ],
      [
        'gewerbe',
        'Gewerbe / Industrie',
        'M6.6 16.8v-5l3 -1.8v1.8l3-1.8v6.8zM12.6 16.8V8.4h1.6v8.4M15.2 16.8V6.8h1.6v10',
      ],
      [
        'lager',
        'Lager / Logistik',
        'M7.2 12.6h4.6v4.6H7.2zM12.2 12.6h4.6v4.6h-4.6zM9.6 8h4.6v4.6H9.6zM9.5 12.6v1.2M14.5 12.6v1.2M11.9 8v1.2',
      ],
      [
        'kunst',
        'Kunst / Kultur',
        'M12 6.8a5.2 5.2 0 0 0 0 10.4c.9 0 1.2-.7.8-1.4-.5-.8.1-1.8 1-1.8h1.4a2 2 0 0 0 2-2c0-2.9-2.3-5.2-5.2-5.2zM9.4 11.2h.01M10.8 8.8h.01M13.6 8.8h.01',
      ],
      [
        'fest',
        'Feste / Events',
        'M6.6 9.4c3.6 1.6 7.2 1.6 10.8 0M8 10l.8 1.8.8-1.4M11.2 10.6l.8 1.8.8-1.8M14.4 10.4l.8 1.4.8-1.8',
      ],
      [
        'bibliothek',
        'Bibliothek',
        'M12 9c-1.4-1-3.2-1.4-5-1.2v8.6c1.8-.2 3.6.2 5 1.2 1.4-1 3.2-1.4 5-1.2V7.8C15.2 7.6 13.4 8 12 9zM12 9v8.6',
      ],
      [
        'bildung',
        'Bildung',
        'M6.4 10.4L12 8l5.6 2.4L12 12.8zM8.8 11.4v3c2 1.4 4.4 1.4 6.4 0v-3M17.6 10.4v3.2',
      ],
      [
        'soziales',
        'Soziales / Familie',
        'M10 10.2m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M14.6 11.6m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M7.2 16.8a2.8 2.8 0 0 1 5.6 0M12.8 16.8a1.8 1.8 0 0 1 3.6 0',
      ],
      ['gesundheit', 'Gesundheit', 'M10.4 6.8h3.2v3.6h3.6v3.2h-3.6v3.6h-3.2v-3.6H6.8v-3.2h3.6z'],
      [
        'sportplatz',
        'Sportplatz',
        'M6.6 8.4h10.8v7.2H6.6zM12 8.4v7.2M12 12m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M6.6 10.6h1.4v2.8H6.6M17.4 10.6H16v2.8h1.4',
      ],
      [
        'fitness',
        'Fitness',
        'M9.4 12h5.2M8 9.6v4.8M16 9.6v4.8M6.6 10.8v2.4M17.4 10.8v2.4M8 9.6h1.4v4.8H8M14.6 9.6H16v4.8h-1.4',
      ],
      [
        'kita',
        'Kita / Schule',
        'M7.4 17.2v-6l4.6-2.8 4.6 2.8v6M10.6 17.2v-3h2.8v3M12 8.4V5.8M12 5.8h2.4l-.6.8.6.8H12',
      ],
      [
        'bank',
        'Sitzen / Picknick',
        'M7.2 10.4h9.6M7.2 12.4h9.6M8.4 12.4l-1 4.4M15.6 12.4l1 4.4M6.6 14.6h10.8M9 10.4l.4 2M15 10.4l-.4 2',
      ],
      [
        'gemeinschaft',
        'Gemeinschaft',
        'M9.8 10.6m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M14.2 10.6m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M7 16.4a2.8 2.8 0 0 1 5.6 0M11.4 16.4a2.8 2.8 0 0 1 5.6 0',
      ],
      [
        'versammlung',
        'Versammlung',
        'M8.4 11m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M12 11m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M15.6 11m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0M6.2 16a2.2 2.2 0 0 1 4.4 0M9.8 16a2.2 2.2 0 0 1 4.4 0M13.4 16a2.2 2.2 0 0 1 4.4 0',
      ],
    ],
  },
  {
    k: 'kon',
    n: 'Context & Structure',
    farbe: '#6f7684',
    hell: '#e5e7eb',
    voll: '#a9afba',
    s: [
      [
        'bestand',
        'Bestand',
        'M7.4 11L12 7l4.6 4v6.2H7.4zM7.4 14.4l3.6-3.6M7.4 17.2l6.6-6.6M10.2 17.2l6.4-6.4M13.4 17.2l3.2-3.2',
      ],
      ['planung', 'Planung / Baufeld', 'M7.2 7.2h9.6v9.6H7.2zM10.4 16.8v-2.6l1.6-1.4 1.6 1.4v2.6'],
      [
        'technik',
        'Technik',
        'M12 12m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M12 7.4v1.4M12 15.2v1.4M7.4 12h1.4M15.2 12h1.4M8.8 8.8l1 1M14.2 14.2l1 1M8.8 15.2l1-1M14.2 9.8l1-1',
      ],
      [
        'denkmal',
        'Denkmal',
        'M7.4 9.2L12 6.8l4.6 2.4zM7.4 9.2h9.2M8.8 9.2v6.4M11.2 9.2v6.4M12.8 9.2v6.4M15.2 9.2v6.4M7 15.6h10v1.4H7z',
      ],
      [
        'mischung',
        'Nutzungsmischung',
        'M7 7.4h4.4v4.4H7zM12.6 7.4H17v6.4h-4.4zM7 13h4.4v3.6H7zM12.6 15.2H17v1.4h-4.4z',
      ],
      [
        'raster',
        'Raster / Struktur',
        'M7.6 7.6h2.2v2.2H7.6zM10.9 7.6h2.2v2.2h-2.2zM14.2 7.6h2.2v2.2h-2.2zM7.6 10.9h2.2v2.2H7.6zM10.9 10.9h2.2v2.2h-2.2zM14.2 10.9h2.2v2.2h-2.2zM7.6 14.2h2.2v2.2H7.6zM10.9 14.2h2.2v2.2h-2.2zM14.2 14.2h2.2v2.2h-2.2z',
      ],
      ['hoehe', 'Höhe', 'M8.4 7v10M7.2 8.2L8.4 7l1.2 1.2M7.2 15.8l1.2 1.2 1.2-1.2M11.4 8.6h5.4v6.8h-5.4z'],
      [
        'sicht',
        'Sichtachse',
        'M6.4 12s2.2-3.8 5.6-3.8 5.6 3.8 5.6 3.8-2.2 3.8-5.6 3.8S6.4 12 6.4 12zM12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0',
      ],
      ['erweiterung', 'Erweiterung', 'M7.4 16.6l9.2-9.2M12.6 7.4h4v4M11.4 16.6h-4v-4'],
      ['wegfuehrung', 'Wegeführung', 'M7.4 16.8c0-4.4 2.2-4.4 4.6-4.8s4.6-1.4 4.6-5.2'],
      [
        'verbindung',
        'Verbindung',
        'M8.6 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M15.4 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M10.2 12h3.6',
      ],
      [
        'verdichtung',
        'Verdichtung',
        'M6.4 12h4.4M9.4 10.6l1.4 1.4-1.4 1.4M17.6 12h-4.4M14.6 10.6L13.2 12l1.4 1.4',
      ],
      [
        'zentrum',
        'Zentrum',
        'M12 12m-4.4 0a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0-8.8 0M12 12m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0M12 12m-.8 0a.8.8 0 1 0 1.6 0a.8.8 0 1 0-1.6 0',
      ],
      [
        'ort',
        'Standort',
        'M12 17.2s-4-3.8-4-6.8a4 4 0 0 1 8 0c0 3-4 6.8-4 6.8zM12 10.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0',
      ],
      ['tor', 'Tor / Durchgang', 'M8.2 17.2V11a3.8 3.8 0 0 1 7.6 0v6.2M10.2 17.2V11a1.8 1.8 0 0 1 3.6 0v6.2'],
      [
        'mauer',
        'Mauer / Fassade',
        'M7 8h10v8H7zM7 10.7h10M7 13.3h10M9.6 8v2.7M14.4 8v2.7M12 10.7v2.6M9.6 13.3V16M14.4 13.3V16',
      ],
      ['fokus', 'Fokus / Fläche', 'M7.4 7.4h9.2v9.2H7.4zM12 12h.01'],
      [
        'geschlossen',
        'Nicht öffentlich',
        'M8.8 11.2h6.4v5.4H8.8zM10.2 11.2V9.6a1.8 1.8 0 0 1 3.6 0v1.6M12 13.4v1.2',
      ],
      [
        'offen',
        'Öffentlich zugänglich',
        'M8.8 11.2h6.4v5.4H8.8zM10.2 11.2V9.6a1.8 1.8 0 0 1 3.6-.4M12 13.4v1.2',
      ],
      [
        'grundwasser',
        'Grundwasser',
        'M12 6.6v5.4M10.6 10.6L12 12l1.4-1.4M7 14.4c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0M7 16.8c1.7-1.2 3.3 1.2 5 0s3.3 1.2 5 0',
      ],
      [
        'privat',
        'Privatheit',
        'M7.6 11h8.8M9.2 11l.8-3.2h4l.8 3.2M9.6 14.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M14.4 14.4m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M11 14.4h2',
      ],
      [
        'licht',
        'Beleuchtung',
        'M9.4 17.2V7.6h4M13.4 7.6v1.2M12 8.8h2.8l-.6 1.2h-1.6zM8 17.2h2.8M13 11.4l-.4.8M14.6 11.6v.8M16 11.4l.4.8',
      ],
      [
        'strom',
        'Hochspannung',
        'M9.6 17.2L12 6.6l2.4 10.6M8.4 9.4h7.2M8.8 11.8h6.4M10.6 14.6h2.8M10.2 9.4l3.6 2.4M13.8 9.4l-3.6 2.4',
      ],
      ['zeit', 'Zeit / Phase', 'M12 12m-4.8 0a4.8 4.8 0 1 0 9.6 0a4.8 4.8 0 1 0-9.6 0M12 9v3l2 1.4'],
    ],
  },
];
// Flächenfüllungen je Gruppe (Kreis): voll, schräg, kreuz, quer, Punkte, gestrichelt
const SYMB_FUELL = [
  ['voll', 'Fläche voll'],
  ['schraeg', 'Schraffur schräg'],
  ['kreuz', 'Schraffur Kreuz'],
  ['quer', 'Schraffur quer'],
  ['punkte', 'Punktraster'],
  ['leer', 'Umriss gestrichelt'],
];

/** Symbol der Bibliothek zu „gruppe:name“ (bzw. „gruppe:f:art“ für Füllungen). */
function symbBib(key) {
  const [g, a, b] = String(key).split(':'),
    G = SYMB.find((x) => x.k === g);
  if (!G) return null;
  if (a === 'f') return { g: G, fuell: b, n: (SYMB_FUELL.find((f) => f[0] === b) || [0, b])[1] };
  const s = G.s.find((x) => x[0] === a);
  return s ? { g: G, name: a, n: s[1], d: s[2] } : null;
}

/**
 * SVG-Pfad (M, L, H, V, C, S, Q, A, Z, auch relativ) in Linienzüge zerlegen. Ergebnis: [{pts:[[x,y],…], zu}].
 * Bögen und Kurven werden in kurze Strecken geteilt (n je Segment).
 */
function symPfadLinien(d, n = 8) {
  const t = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [],
    out = [];
  let i = 0,
    cmd = '',
    x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    cx2 = 0,
    cy2 = 0,
    cur = null;
  const num = () => parseFloat(t[i++]),
    neu = () => {
      cur = { pts: [[x, y]], zu: false };
      out.push(cur);
    },
    zu = (nx, ny) => {
      if (!cur) neu();
      cur.pts.push([nx, ny]);
      x = nx;
      y = ny;
    },
    bez = (x1, y1, x2, y2, ex, ey) => {
      const x0 = x,
        y0 = y;
      for (let k = 1; k <= n; k++) {
        const u = k / n,
          v = 1 - u;
        zu(
          v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * ex,
          v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * ey,
        );
      }
      cx2 = x2;
      cy2 = y2;
    },
    bogen = (rx, ry, rot, gross, uz, ex, ey) => {
      // Endpunkt-Darstellung -> Mittelpunkt (SVG 1.1, Anhang F.6)
      const x0 = x,
        y0 = y;
      if (!rx || !ry) return zu(ex, ey);
      const ph = (rot * Math.PI) / 180,
        c = Math.cos(ph),
        s = Math.sin(ph),
        dx = (x0 - ex) / 2,
        dy = (y0 - ey) / 2,
        x1 = c * dx + s * dy,
        y1 = -s * dx + c * dy;
      rx = Math.abs(rx);
      ry = Math.abs(ry);
      const l = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
      if (l > 1) {
        rx *= Math.sqrt(l);
        ry *= Math.sqrt(l);
      }
      const q = Math.max(
          0,
          (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) /
            (rx * rx * y1 * y1 + ry * ry * x1 * x1),
        ),
        f = (gross === uz ? -1 : 1) * Math.sqrt(q),
        cx = f * ((rx * y1) / ry),
        cy = f * (-(ry * x1) / rx),
        mx = c * cx - s * cy + (x0 + ex) / 2,
        my = s * cx + c * cy + (y0 + ey) / 2,
        w = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy),
        a0 = w(1, 0, (x1 - cx) / rx, (y1 - cy) / ry);
      let da = w((x1 - cx) / rx, (y1 - cy) / ry, (-x1 - cx) / rx, (-y1 - cy) / ry);
      if (!uz && da > 0) da -= 2 * Math.PI;
      if (uz && da < 0) da += 2 * Math.PI;
      const m = Math.max(4, Math.ceil((Math.abs(da) / Math.PI) * n * 1.5));
      for (let k = 1; k <= m; k++) {
        const a = a0 + (da * k) / m,
          px = rx * Math.cos(a),
          py = ry * Math.sin(a);
        zu(c * px - s * py + mx, s * px + c * py + my);
      }
    };
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase(),
      C = cmd.toUpperCase(),
      ox = rel ? x : 0,
      oy = rel ? y : 0;
    if (C === 'M') {
      x = num() + ox;
      y = num() + oy;
      sx = x;
      sy = y;
      neu();
      cmd = rel ? 'l' : 'L'; // weitere Paare = Linie
    } else if (C === 'L') zu(num() + ox, num() + oy);
    else if (C === 'H') zu(num() + ox, y);
    else if (C === 'V') zu(x, num() + oy);
    else if (C === 'C') {
      const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy];
      bez(...a);
    } else if (C === 'S') {
      const x1 = 2 * x - cx2,
        y1 = 2 * y - cy2,
        a = [num() + ox, num() + oy, num() + ox, num() + oy];
      bez(x1, y1, ...a);
    } else if (C === 'Q') {
      const qx = num() + ox,
        qy = num() + oy,
        ex = num() + ox,
        ey = num() + oy;
      bez(
        x + (2 / 3) * (qx - x),
        y + (2 / 3) * (qy - y),
        ex + (2 / 3) * (qx - ex),
        ey + (2 / 3) * (qy - ey),
        ex,
        ey,
      );
    } else if (C === 'A') {
      const rx = num(),
        ry = num(),
        rot = num(),
        gr = num(),
        uz = num(),
        ex = num() + ox,
        ey = num() + oy;
      bogen(rx, ry, rot, gr, uz, ex, ey);
    } else if (C === 'Z') {
      if (cur) {
        cur.zu = true;
        cur.pts.push([sx, sy]);
      }
      x = sx;
      y = sy;
      cur = null;
    } else i++; // Unbekanntes überspringen
    if (C !== 'C' && C !== 'S') {
      cx2 = x;
      cy2 = y;
    }
  }
  return out.filter((l) => l.pts.length > 1);
}

/** Bibliothekssymbol als SVG (für die Auswahl im Beschriften-Werkzeug). */
function symbSvg(key, px = 26) {
  const s = symbBib(key);
  if (!s) return '';
  const G = s.g,
    kreis = (f, st, da) =>
      `<circle cx="12" cy="12" r="10.6" fill="${f}" stroke="${G.farbe}" stroke-width="0.85"${da ? ' stroke-dasharray="1.6 1.2"' : ''}/>`;
  let innen = '';
  if (s.fuell) {
    const id = 'sf' + G.k + s.fuell,
      muster = {
        schraeg: `<pattern id="${id}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v2.4" stroke="${G.farbe}" stroke-width="0.6"/></pattern>`,
        kreuz: `<pattern id="${id}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v2.4M0 0h2.4" stroke="${G.farbe}" stroke-width="0.6"/></pattern>`,
        quer: `<pattern id="${id}" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><path d="M0 1.2h2.4" stroke="${G.farbe}" stroke-width="0.6"/></pattern>`,
        punkte: `<pattern id="${id}" width="2" height="2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.3" fill="${G.farbe}"/></pattern>`,
      }[s.fuell];
    innen =
      s.fuell === 'voll'
        ? kreis(G.voll)
        : s.fuell === 'leer'
          ? kreis('none', 0, 1)
          : `<defs>${muster}</defs>` + kreis(`url(#${id})`);
  } else
    innen =
      kreis(G.hell) +
      `<path d="${s.d}" fill="none" stroke="${G.farbe}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true">${innen}</svg>`;
}

/**
 * Bibliothekssymbol als Grundformen für die Beschriftung (anSym): Kreis, Glyphe bzw. Füllung in Linienzügen.
 * cx, cy, r in Ausgabeeinheiten, w = Linienbreite.
 */
function symbFormen(key, cx, cy, r, w) {
  const s = symbBib(key);
  if (!s) return [];
  const G = s.g,
    k = r / 10.6,
    P = (x, y) => [cx + (x - 12) * k, cy + (y - 12) * k],
    kreisPts = (rr, m = 48) =>
      Array.from({ length: m }, (_, i) => [
        cx + rr * Math.cos((i / m) * 2 * Math.PI),
        cy + rr * Math.sin((i / m) * 2 * Math.PI),
      ]),
    o = [];
  const kreis = (fill, dash) =>
    o.push({
      t: 'path',
      pts: kreisPts(r),
      closed: true,
      stroke: G.farbe,
      w: w * 0.8,
      dash: dash || [],
      fill,
      fa: 1,
    });
  if (s.fuell) {
    if (s.fuell === 'voll') kreis(G.voll);
    else if (s.fuell === 'leer') kreis(null, [r * 0.16, r * 0.11]);
    else {
      kreis(null);
      // Schraffur: Sehnen des Kreises; Punkte: kleine Kreise im Raster
      const a = r * 0.22,
        sehne = (nx, ny) => {
          for (let d = -r + a / 2; d < r; d += a) {
            const h = Math.sqrt(Math.max(0, r * r - d * d));
            if (h < a * 0.2) continue;
            o.push({
              t: 'path',
              pts: [
                [cx + nx * d - ny * h, cy + ny * d + nx * h],
                [cx + nx * d + ny * h, cy + ny * d - nx * h],
              ],
              closed: false,
              stroke: G.farbe,
              w: w * 0.55,
              dash: [],
              fill: null,
              fa: 1,
            });
          }
        };
      if (s.fuell === 'schraeg') sehne(Math.SQRT1_2, Math.SQRT1_2);
      if (s.fuell === 'kreuz') {
        sehne(Math.SQRT1_2, Math.SQRT1_2);
        sehne(Math.SQRT1_2, -Math.SQRT1_2);
      }
      if (s.fuell === 'quer') sehne(0, 1);
      if (s.fuell === 'punkte')
        for (let y = -r; y <= r; y += a)
          for (let x = -r; x <= r; x += a)
            if (x * x + y * y < (r - a * 0.4) ** 2)
              o.push({
                t: 'path',
                pts: [
                  [cx + x, cy + y],
                  [cx + x + 0.001, cy + y],
                ],
                closed: false,
                stroke: G.farbe,
                w: w * 0.7,
                dash: [],
                fill: null,
                fa: 1,
              });
    }
    return o;
  }
  kreis(G.hell);
  for (const l of symPfadLinien(s.d))
    o.push({
      t: 'path',
      pts: l.pts.map(([x, y]) => P(x, y)),
      closed: false,
      stroke: G.farbe,
      w: w * 0.9,
      dash: [],
      fill: null,
      fa: 1,
    });
  return o;
}

const SYMB_TEX = {};
/** Bibliothekssymbol („gruppe:name“) als Canvas-Textur für 3D-Marker, in den Farben seiner Gruppe. */
function symbTextur(key) {
  if (SYMB_TEX[key]) return SYMB_TEX[key];
  const s = symbBib(key),
    N = 128,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  x.scale(N / 24, N / 24);
  x.beginPath();
  x.arc(12, 12, 10.6, 0, Math.PI * 2);
  x.fillStyle = s ? s.g.hell : '#fff';
  x.fill();
  x.lineWidth = 1.1;
  x.strokeStyle = s ? s.g.farbe : '#888';
  x.stroke();
  if (s && s.d) {
    x.lineWidth = 1.6;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.stroke(new Path2D(s.d));
  }
  const t = new T.CanvasTexture(c);
  t.anisotropy = 4;
  SYMB_TEX[key] = t;
  return t;
}
