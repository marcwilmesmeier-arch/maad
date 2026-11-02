// Schlanker SMTP-Versand (STARTTLS oder SSL, Anmeldung per AUTH PLAIN). Ohne smtp.host: Testmodus,
// die Mail wird an <data_dir>/outbox.log angehängt.
import net from 'node:net';
import tls from 'node:tls';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ohneZeilenumbruch = (s) =>
  String(s || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
const adresse = (s) => (String(s).match(/<([^>]+)>/) || [null, s])[1].trim();
const kodiert = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);

function nachricht({ from, to, subject, text }) {
  const body = Buffer.from(text.replace(/\r?\n/g, '\r\n')).toString('base64').replace(/.{76}/g, '$&\r\n');
  const name = from.includes('<') ? from.slice(0, from.indexOf('<')).trim() : '';
  const absender = name ? `${kodiert(name)} <${adresse(from)}>` : adresse(from);
  return [
    `From: ${absender}`,
    `To: ${to}`,
    `Subject: ${kodiert(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${adresse(from).split('@')[1] || 'localhost'}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** Liest SMTP-Antworten zeilenweise; antwort() liefert die nächste vollständige Antwort {code, text}. */
function leser(sock) {
  let puffer = '';
  const warte = [];
  const fertig = [];
  let fehler = null;
  const verarbeite = () => {
    for (;;) {
      const lines = puffer.split('\r\n');
      let ende = -1;
      for (let i = 0; i < lines.length - 1; i++)
        if (/^\d{3} /.test(lines[i])) {
          ende = i;
          break;
        }
      if (ende < 0) return;
      const teil = lines.slice(0, ende + 1);
      puffer = lines.slice(ende + 1).join('\r\n');
      const r = { code: +teil[ende].slice(0, 3), text: teil.join('\n') };
      if (warte.length) warte.shift().res(r);
      else fertig.push(r);
    }
  };
  const anhaengen = (s) => {
    s.on('data', (d) => {
      puffer += d.toString('utf8');
      verarbeite();
    });
    s.on('error', (e) => {
      fehler = e;
      while (warte.length) warte.shift().rej(e);
    });
  };
  anhaengen(sock);
  return {
    neu: anhaengen,
    antwort: () =>
      new Promise((res, rej) => {
        if (fehler) return rej(fehler);
        if (fertig.length) return res(fertig.shift());
        warte.push({ res, rej });
      }),
  };
}

async function smtpSenden(s, mail) {
  const host = s.host;
  let sock = s.ssl
    ? tls.connect({ host, port: s.port, servername: host })
    : net.connect({ host, port: s.port });
  sock.setTimeout(20000, () => sock.destroy(new Error('Zeitüberschreitung beim Mailserver')));
  let r = leser(sock);
  const erwarte = async (codes) => {
    const a = await r.antwort();
    if (!codes.includes(a.code)) throw new Error(`Mailserver: ${a.text}`);
    return a;
  };
  const sende = async (zeile, codes) => {
    sock.write(zeile + '\r\n');
    return erwarte(codes);
  };
  try {
    await erwarte([220]);
    const helo = new URL(s.base_url || 'http://localhost').hostname;
    await sende(`EHLO ${helo}`, [250]);
    if (!s.ssl) {
      await sende('STARTTLS', [220]);
      sock = tls.connect({ socket: sock, servername: host });
      await new Promise((res, rej) => {
        sock.once('secureConnect', res);
        sock.once('error', rej);
      });
      r = leser(sock);
      await sende(`EHLO ${helo}`, [250]);
    }
    if (s.user) {
      const plain = Buffer.from(`\0${s.user}\0${s.password}`).toString('base64');
      await sende(`AUTH PLAIN ${plain}`, [235]);
    }
    await sende(`MAIL FROM:<${adresse(mail.from)}>`, [250]);
    await sende(`RCPT TO:<${mail.to}>`, [250, 251]);
    await sende('DATA', [354]);
    const daten = nachricht(mail).replace(/\r\n\./g, '\r\n..');
    await sende(daten + '\r\n.', [250]);
    sock.write('QUIT\r\n');
  } finally {
    sock.end();
  }
}

/** Verschickt eine Text-Mail; liefert true/false (Fehler stehen im Protokoll des Aufrufers). */
export async function sendeMail(konfig, to, subject, text) {
  to = ohneZeilenumbruch(to);
  subject = ohneZeilenumbruch(subject);
  const s = { ...konfig.smtp, base_url: konfig.base_url };
  if (!s.host) {
    appendFileSync(
      join(konfig.data_dir, 'outbox.log'),
      `--- ${new Date().toISOString()} an ${to}\nBetreff: ${subject}\n${text}\n\n`,
    );
    return true;
  }
  await smtpSenden(s, { from: s.from || s.user, to, subject, text });
  return true;
}
