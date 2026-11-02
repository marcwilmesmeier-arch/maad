import { $, api, zeige } from '/seiten/gemeinsam.js';

const t = new URLSearchParams(location.search).get('t') || '';
// Token aus der Adresszeile entfernen (Verlauf, Bildschirmfreigaben)
history.replaceState(null, '', '/passwort');

const info = await api('/api/passwort-link?t=' + encodeURIComponent(t)).catch(() => ({ gueltig: false }));
if (!info.gueltig) zeige('k-ungueltig', 'k-setzen');
else {
  zeige('k-setzen', 'k-ungueltig');
  $('titel').textContent = info.neu ? 'Willkommen – Passwort festlegen' : 'Neues Passwort festlegen';
  $('fuer').textContent = 'Zugang: ' + info.email;
  $('email').value = info.email;
  $('regel').textContent = `Mindestens ${info.min} Zeichen. Am besten ein Satz oder mehrere Wörter.`;
}

$('f-setzen').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('fehler').textContent = '';
  if ($('pw1').value !== $('pw2').value) {
    $('fehler').textContent = 'Die Passwörter stimmen nicht überein.';
    return;
  }
  const b = ev.submitter;
  b.disabled = true;
  try {
    await api('/api/passwort-setzen', { t, passwort: $('pw1').value });
    location.href = '/';
  } catch (e) {
    $('fehler').textContent = e.message;
  }
  b.disabled = false;
});
