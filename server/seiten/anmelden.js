import { $, api, zeige } from '/seiten/gemeinsam.js';

const KARTEN = ['k-anmelden', 'k-vergessen', 'k-gesendet'];
const karte = (id) => zeige(id, ...KARTEN.filter((k) => k !== id));

$('f-anmelden').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const b = ev.submitter;
  b.disabled = true;
  $('fehler').textContent = '';
  try {
    await api('/api/anmelden', { email: $('email').value, passwort: $('passwort').value });
    location.href = '/';
  } catch (e) {
    $('fehler').textContent = e.message;
    $('passwort').value = '';
  }
  b.disabled = false;
});

$('f-vergessen').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const b = ev.submitter;
  b.disabled = true;
  $('fehler2').textContent = '';
  try {
    await api('/api/passwort-vergessen', { email: $('email2').value });
    karte('k-gesendet');
  } catch (e) {
    $('fehler2').textContent = e.message;
  }
  b.disabled = false;
});

$('zu-vergessen').addEventListener('click', () => {
  $('email2').value = $('email').value;
  karte('k-vergessen');
});
$('zurueck').addEventListener('click', () => karte('k-anmelden'));
$('zurueck2').addEventListener('click', () => karte('k-anmelden'));
