/* ===== Luftbild (WMS) für „Rasen flach“: echte Farbverteilung der Grünflächen, relativ zum Mittelwert (Layerfarbe bleibt Mittelwert) ===== */
const AIRK = {
  nrw: {
    name: 'Digitale Orthophotos NRW',
    u: 'https://www.wms.nrw.de/geobasis/wms_nw_dop',
    lay: 'nw_dop_rgb',
    bb: [5.8, 50.3, 9.5, 52.6],
    src: '© Geobasis NRW (dl-de/zero-2-0)',
  },
  by: {
    name: 'DOP40 Bayern',
    u: 'https://geoservices.bayern.de/od/wms/dop40',
    lay: 'by_dop40c',
    bb: [8.976, 47.18, 14.015, 50.57],
    src: '© Bayerische Vermessungsverwaltung, CC BY 4.0',
  },
};
{
  const _w = wmsRun;
  wmsRun = async function (lon, lat, size, snap) {
    const r = await _w.apply(this, arguments);
    try {
      if (!snap) {
        GEO.airLL = [lon, lat, size];
        GEO.air = null;
        GEO.airMsg = '';
        GEO.airBusy = 0;
        GEO.airTok = (GEO.airTok || 0) + 1;
      }
    } catch (e) {
      logErr(e, 'wmsRun');
    }
    return r;
  };
}
function airEnsure() {
  try {
    if (GEO.air || GEO.airBusy || !GEO.airLL || (S.fx[S.dar] || {}).air === 0) return;
    GEO.airBusy = 1;
    const [a, b, c] = GEO.airLL;
    airLoad(a, b, c)
      .catch((e) => {
        GEO.airMsg = 'Luftbild nicht geladen: ' + (e && e.message ? e.message : e);
      })
      .finally(() => {
        GEO.airBusy = 0;
        try {
          if ($('lyp').style.display === 'block') lyRender();
        } catch (e) {
          logErr(e, 'airEnsure>anonym');
        }
      });
  } catch (e) {
    logErr(e, 'airEnsure');
  }
}
async function airLoad(lon, lat, size) {
  const my = GEO.airTok;
  let st = null;
  try {
    st = await bundeslandC(lon, lat);
  } catch (e) {
    logErr(e, 'airLoad');
  }
  const a = st && AIRK[st.key];
  if (!a) {
    GEO.airMsg =
      'Kein Luftbild-Dienst für ' +
      ((st && st.name) || 'diesen Standort') +
      ' hinterlegt (derzeit NRW und Bayern).';
    GEO.airNo = 1;
    return;
  }
  if (lon < a.bb[0] || lon > a.bb[2] || lat < a.bb[1] || lat > a.bb[3])
    throw new Error('Standort außerhalb des Dienstgebiets');
  const px = Math.min(2048, Math.max(1024, Math.round(size * 3))),
    dlo = size / 2 / (111320 * Math.cos((lat * Math.PI) / 180)),
    dla = size / 2 / 110574;
  const u = `${a.u}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${a.lay}&STYLES=&CRS=EPSG:4326&BBOX=${lat - dla},${lon - dlo},${lat + dla},${lon + dlo}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/jpeg`;
  const r = await wfetch(u, 60000),
    b = await r.blob();
  if (!/image\//.test(r.headers.get('content-type') || b.type)) {
    const t = await b.text();
    throw new Error(
      'Dienst lieferte kein Bild: ' +
        t
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 140),
    );
  }
  const bm = await createImageBitmap(b);
  if (my !== GEO.airTok) return;
  GEO.air = bm;
  GEO.airMsg = 'Luftbild: ' + a.name + ', ' + px + ' px · ' + a.src;
  if (FX.grass && FX.flat) fxGrass();
}
/* Luftbild auf Maskengröße skalieren, Mittelwert über die Grasfläche bestimmen */
function airPrep(bm, mask) {
  try {
    const W = 2048,
      c = document.createElement('canvas');
    c.width = c.height = W;
    const x = c.getContext('2d');
    x.drawImage(bm, 0, 0, W, W);
    const N = 256,
      a = document.createElement('canvas'),
      b = document.createElement('canvas');
    a.width = a.height = b.width = b.height = N;
    const xa = a.getContext('2d', { willReadFrequently: true }),
      xb = b.getContext('2d', { willReadFrequently: true });
    xa.drawImage(c, 0, 0, N, N);
    xb.drawImage(mask, 0, 0, N, N);
    const da = xa.getImageData(0, 0, N, N).data,
      db = xb.getImageData(0, 0, N, N).data;
    let r = 0,
      g = 0,
      bl = 0,
      n = 0;
    for (let i = 0; i < N * N; i++)
      if (db[i * 4 + 3] > 128) {
        r += da[i * 4];
        g += da[i * 4 + 1];
        bl += da[i * 4 + 2];
        n++;
      }
    const m = n ? new T.Vector3(r / n / 255, g / n / 255, bl / n / 255) : new T.Vector3(0.4, 0.5, 0.3);
    m.max(new T.Vector3(0.05, 0.05, 0.05));
    const tex = new T.CanvasTexture(c);
    tex.flipY = false;
    tex.minFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    return { tex, mean: m };
  } catch (e) {
    console.error(e);
    return null;
  }
}
