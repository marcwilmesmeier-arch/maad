#!/usr/bin/env python3
"""maad-Server: Anmeldung per E-Mail-Link, Freigabe durch Administratoren, Auslieferung von maad.html.
Nur Python-Standardbibliothek (ab Python 3.9). Daten in SQLite. Start: python3 maadserver.py [config.json]"""
import hashlib, hmac, html, http.client, ipaddress, json, socket, ssl, os, re, secrets, smtplib, sqlite3, sys, threading, time
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urljoin

HERE = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'config.json')
DEFAULT = {
    'base_url': 'http://localhost:8080',      # öffentliche Adresse, z. B. https://maad.beispiel.de
    'host': '127.0.0.1', 'port': 8080,
    'data_dir': os.path.join(HERE, 'data'),
    'tool_file': os.path.join(HERE, 'maad.html'),          # Vollversion – nur nach Anmeldung
    'demo_file': os.path.join(HERE, 'maad-demo.html'),     # abgespeckte Demo ohne gesperrte Funktionen
    'admin_emails': [],                        # diese Adressen sind Administratoren
    'session_days': 30, 'link_minutes': 15,
    'smtp': {'host': '', 'port': 587, 'user': '', 'password': '', 'from': '', 'ssl': False},
    'app_name': 'maad',
    'maptiler_key': '',                        # MapTiler-Schlüssel (liegt nur hier, nicht im ausgelieferten Code der Demo); im MapTiler-Konto auf Ihre Domain beschränken
    'proxy': True,                             # Weiterleitung für Geodienste ohne Browser-Freigabe (nur für angemeldete Nutzer)
    'proxy_max_mb': 80,
}
PERMS = ['project_new', 'project_open', 'export_xlsx', 'export_ifc', 'lod', 'team', 'own_sources']
PLANS = {
    'demo':       [],
    'starter':    ['project_new', 'project_open', 'export_xlsx'],
    'buero':      ['project_new', 'project_open', 'export_xlsx', 'export_ifc', 'lod', 'team'],
    'enterprise': PERMS,
}
ROLES = ['user', 'lead', 'admin']


def load_cfg():
    c = json.loads(json.dumps(DEFAULT))
    if os.path.exists(CFG_PATH):
        u = json.load(open(CFG_PATH, encoding='utf-8'))
        for k, v in u.items():
            if isinstance(v, dict) and isinstance(c.get(k), dict):
                c[k].update(v)
            else:
                c[k] = v
    c['admin_emails'] = [e.strip().lower() for e in c['admin_emails']]
    return c


CFG = load_cfg()
os.makedirs(CFG['data_dir'], exist_ok=True)
DB = os.path.join(CFG['data_dir'], 'maad.db')
SECURE = CFG['base_url'].startswith('https://')
LOCK = threading.Lock()
RATE = {}


def db():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY, name TEXT DEFAULT '', org TEXT DEFAULT '', plan TEXT DEFAULT 'starter',
          role TEXT DEFAULT 'user', status TEXT DEFAULT 'invited', perms TEXT DEFAULT '[]', valid_until TEXT DEFAULT '',
          created TEXT, last_login TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS tokens(h TEXT PRIMARY KEY, email TEXT, expires REAL, used INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS sessions(h TEXT PRIMARY KEY, email TEXT, expires REAL);
        CREATE TABLE IF NOT EXISTS log(ts TEXT, email TEXT, event TEXT, detail TEXT);
        CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
        """)
        if not c.execute("SELECT v FROM kv WHERE k='wm_secret'").fetchone():
            c.execute("INSERT INTO kv(k,v) VALUES('wm_secret',?)", (secrets.token_hex(32),))
        for e in CFG['admin_emails']:
            r = c.execute('SELECT email FROM users WHERE email=?', (e,)).fetchone()
            if not r:
                c.execute('INSERT INTO users(email,plan,role,status,perms,created) VALUES(?,?,?,?,?,?)',
                          (e, 'enterprise', 'admin', 'invited', json.dumps(PERMS), now()))
            else:
                c.execute("UPDATE users SET role='admin' WHERE email=?", (e,))


def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def log(email, event, detail=''):
    try:
        with db() as c:
            c.execute('INSERT INTO log VALUES(?,?,?,?)', (now(), email, event, detail[:300]))
    except Exception:
        pass


EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$')


def valid_email(e):
    return bool(EMAIL_RE.match(e or '')) and len(e) <= 254


def rate_ok(key, limit, secs):
    t = time.time()
    with LOCK:
        L = [x for x in RATE.get(key, []) if t - x < secs]
        if len(L) >= limit:
            RATE[key] = L
            return False
        L.append(t)
        RATE[key] = L
        return True


# ---------- E-Mail ----------
def send_mail(to, subject, body):
    s = CFG['smtp']
    if not s.get('host'):
        # Entwicklungsmodus: Mail in Datei schreiben
        with open(os.path.join(CFG['data_dir'], 'outbox.log'), 'a', encoding='utf-8') as f:
            f.write(f'--- {now()} an {to}\nBetreff: {subject}\n{body}\n\n')
        return True
    m = EmailMessage()
    m['From'] = s.get('from') or s.get('user')
    m['To'] = to
    m['Subject'] = subject
    m.set_content(body)
    try:
        if s.get('ssl'):
            srv = smtplib.SMTP_SSL(s['host'], int(s['port']), timeout=20)
        else:
            srv = smtplib.SMTP(s['host'], int(s['port']), timeout=20)
            srv.starttls()
        if s.get('user'):
            srv.login(s['user'], s['password'])
        srv.send_message(m)
        srv.quit()
        return True
    except Exception as e:
        log(to, 'mail_fehler', str(e))
        return False


def mail_login(email, name, first):
    tok = secrets.token_urlsafe(32)
    with db() as c:
        c.execute('INSERT INTO tokens VALUES(?,?,?,0)', (sha(tok), email, time.time() + CFG['link_minutes'] * 60))
    url = f"{CFG['base_url'].rstrip('/')}/auth?t={tok}"
    hello = f'Guten Tag{" " + name if name else ""},'
    if first:
        txt = f"{hello}\n\nSie wurden für {CFG['app_name']} freigegeben. Mit diesem Link aktivieren Sie Ihren Zugang:\n\n{url}\n\nDer Link ist {CFG['link_minutes']} Minuten gültig und nur einmal nutzbar. Danach melden Sie sich jederzeit mit Ihrer E-Mail-Adresse an."
        subj = f"Ihr Zugang zu {CFG['app_name']}"
    else:
        txt = f"{hello}\n\nIhr Anmeldelink für {CFG['app_name']}:\n\n{url}\n\nDer Link ist {CFG['link_minutes']} Minuten gültig und nur einmal nutzbar. Wenn Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail."
        subj = f"Anmeldelink für {CFG['app_name']}"
    return send_mail(email, subj, txt)


# ---------- Nutzer / Sitzungen ----------
def user_row(email):
    with db() as c:
        return c.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()


def active_ok(u):
    if not u or u['status'] == 'blocked':
        return False
    if u['valid_until'] and u['valid_until'] < datetime.now(timezone.utc).strftime('%Y-%m-%d'):
        return False
    return True


def pub_user(u):
    return {'email': u['email'], 'name': u['name'], 'org': u['org'], 'plan': u['plan'], 'role': u['role'],
            'status': u['status'], 'perms': json.loads(u['perms'] or '[]'), 'valid_until': u['valid_until'],
            'created': u['created'], 'last_login': u['last_login']}


def new_session(email):
    sid = secrets.token_urlsafe(32)
    with db() as c:
        c.execute('INSERT INTO sessions VALUES(?,?,?)', (sha(sid), email, time.time() + CFG['session_days'] * 86400))
        c.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        c.execute('DELETE FROM tokens WHERE expires<?', (time.time() - 86400,))
    return sid


def clean_perms(p):
    return [x for x in (p or []) if x in PERMS]


def read_file(path):
    with open(path, 'rb') as f:
        return f.read()


PAGE_CSS = """body{margin:0;background:#f2f2f0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1d1d1b}
a{color:inherit}"""


def get_cfg():
    try:
        with db() as c:
            r = c.execute("SELECT v FROM kv WHERE k='toolcfg'").fetchone()
        return json.loads(r['v']) if r else None
    except Exception:
        return None


def wm_id(email):
    """Kennung je Kunde (HMAC mit geheimem Schlüssel) – steckt unsichtbar in der ausgelieferten Vollversion."""
    with db() as c:
        sec = c.execute("SELECT v FROM kv WHERE k='wm_secret'").fetchone()['v']
        w = hmac.new(sec.encode(), email.lower().encode(), hashlib.sha256).hexdigest()[:12]
        c.execute("INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)", ('wm:' + w, email.lower()))
    return w


def zw(s):
    """Text als unsichtbare Zeichen (Nullbreite) kodieren."""
    bits = ''.join(format(b, '08b') for b in s.encode())
    return '\u2060' + ''.join('\u200b' if x == '0' else '\u200c' for x in bits) + '\u2060'


def watermark(raw, w):
    raw = raw.replace('</title>', zw(w) + '</title>', 1)
    parts = raw.split('</script>')
    for i in range(1, len(parts), 2):
        parts[i] = '<!--w:' + w + '-->' + parts[i]
    raw = '</script>'.join(parts)
    i = raw.rfind('</body>')
    tail = '<!--maad-lizenz:' + w + '-->'
    return raw[:i] + tail + raw[i:] if i >= 0 else raw + tail


OLD_KEY = '0jnOTw9obPwX3gZ4OJSu'
OLD_PROXY = 'https://lot-cors.marc-wilmesmeier.workers.dev/?url='


def prep_tool(raw, full):
    raw = raw.replace(OLD_PROXY, '/api/proxy?url=' if (full and CFG.get('proxy')) else '')
    if not full:
        raw = raw.replace(OLD_KEY, '')
    elif CFG.get('maptiler_key'):
        raw = raw.replace(OLD_KEY, CFG['maptiler_key'])
    return raw


class _PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, ip, **kw):
        super().__init__(host, **kw)
        self._ip = ip

    def connect(self):
        sock = socket.create_connection((self._ip, self.port or 443), self.timeout)
        self.sock = ssl.create_default_context().wrap_socket(sock, server_hostname=self.host)


def public_ip(host):
    """Löst den Namen auf und liefert nur eine öffentliche Adresse (Schutz vor Zugriffen auf interne Dienste)."""
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except Exception:
        return None
    ips = [i[4][0] for i in infos]
    if not ips or not all(ipaddress.ip_address(x).is_global for x in ips):
        return None
    return ips[0]


def proxy_fetch(url, hdrs, max_bytes):
    """Holt eine https-Adresse (bis zu 4 Weiterleitungen) und gibt (Status, Header, Daten) zurück."""
    for _ in range(5):
        u = urlparse(url)
        if u.scheme != 'https' or not u.hostname or (u.port not in (None, 443)):
            return 400, {}, b'Nur https auf Port 443 erlaubt'
        ip = public_ip(u.hostname)
        if not ip:
            return 403, {}, b'Adresse nicht erlaubt'
        con = _PinnedHTTPS(u.hostname, ip, timeout=120)
        try:
            con.request('GET', (u.path or '/') + ('?' + u.query if u.query else ''), headers=hdrs)
            r = con.getresponse()
            if r.status in (301, 302, 303, 307, 308) and r.getheader('Location'):
                url = urljoin(url, r.getheader('Location'))
                r.read()
                continue
            data = r.read(max_bytes + 1)
            if len(data) > max_bytes:
                return 413, {}, b'Antwort zu gro\xc3\x9f'
            return r.status, {k: r.getheader(k) for k in ('Content-Type', 'Content-Range', 'Content-Encoding', 'Last-Modified', 'ETag') if r.getheader(k)}, data
        finally:
            con.close()
    return 508, {}, b'Zu viele Weiterleitungen'


def tool_page(user):
    if user:
        raw = prep_tool(read_file(CFG['tool_file']).decode('utf-8'), True)
        acc = {'mode': 'full', 'user': {'email': user['email'], 'name': user['name'], 'plan': user['plan'], 'role': user['role'],
                                        'perms': json.loads(user['perms'] or '[]')}}
        w = wm_id(user['email'])
        acc['wm'] = w
        raw = watermark(raw, w)
    else:
        raw = prep_tool(read_file(CFG['demo_file']).decode('utf-8'), False)   # fehlt die Demo-Datei, wird NICHT die Vollversion ausgeliefert
        acc = {'mode': 'demo'}
    acc['server'] = True
    acc['cfg'] = get_cfg()
    inj = '<script>window.MAAD_ACC=' + json.dumps(acc).replace('</', '<\\/') + ';</script>'
    m = re.search(r'<head[^>]*>', raw, re.I)
    if m:
        raw = raw[:m.end()] + inj + raw[m.end():]
    else:
        raw = inj + raw
    return raw.encode('utf-8')


class H(BaseHTTPRequestHandler):
    server_version = 'maad'
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    # --- Hilfen ---
    def ip(self):
        return self.headers.get('X-Forwarded-For', self.client_address[0]).split(',')[0].strip()

    def send(self, code, body=b'', ctype='text/html; charset=utf-8', extra=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def js(self, code, obj, extra=None):
        self.send(code, json.dumps(obj, ensure_ascii=False), 'application/json; charset=utf-8', extra)

    def redirect(self, to, extra=None):
        self.send(302, b'', 'text/plain', [('Location', to)] + (extra or []))

    def session_user(self):
        ck = cookies.SimpleCookie(self.headers.get('Cookie', ''))
        if 'maad_sid' not in ck:
            return None
        with db() as c:
            s = c.execute('SELECT * FROM sessions WHERE h=?', (sha(ck['maad_sid'].value),)).fetchone()
            if not s or s['expires'] < time.time():
                return None
            u = c.execute('SELECT * FROM users WHERE email=?', (s['email'],)).fetchone()
        return u if active_ok(u) else None

    def body_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > (2100000 if urlparse(self.path).path == '/api/admin/cfg' else 100000):
            raise ValueError('zu groß')
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            raise ValueError('ungültiges JSON')

    def cookie_hdr(self, sid, maxage):
        return ('Set-Cookie', f"maad_sid={sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age={maxage}" + ('; Secure' if SECURE else ''))

    # --- Routen ---
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        p = urlparse(self.path)
        path = p.path
        try:
            if path == '/':
                return self.send(200, tool_page(self.session_user()))
            if path == '/login':
                return self.send(200, read_file(os.path.join(HERE, 'login.html')))
            if path == '/auth':
                return self.auth(parse_qs(p.query).get('t', [''])[0])
            if path == '/admin':
                u = self.session_user()
                if not u or u['role'] != 'admin':
                    return self.redirect('/login')
                return self.send(200, read_file(os.path.join(HERE, 'admin.html')))
            if path == '/api/me':
                u = self.session_user()
                return self.js(200, {'user': pub_user(u) if u else None, 'plans': PLANS, 'perms': PERMS})
            if path == '/api/admin/users':
                u = self.admin()
                if not u:
                    return
                with db() as c:
                    rows = [pub_user(r) for r in c.execute('SELECT * FROM users ORDER BY created DESC')]
                return self.js(200, {'users': rows, 'plans': PLANS, 'perms': PERMS, 'roles': ROLES})
            if path == '/api/admin/log':
                u = self.admin()
                if not u:
                    return
                with db() as c:
                    rows = [dict(r) for r in c.execute('SELECT * FROM log ORDER BY ts DESC LIMIT 200')]
                return self.js(200, {'log': rows})
            if path == '/api/proxy':
                u = self.session_user()
                if not u:
                    return self.js(401, {'error': 'Nicht angemeldet'})
                if not CFG.get('proxy'):
                    return self.js(404, {'error': 'Proxy deaktiviert'})
                if not rate_ok('px:' + u['email'], 1500, 600):
                    return self.js(429, {'error': 'Zu viele Anfragen'})
                tgt = parse_qs(p.query).get('url', [''])[0]
                hd = {'User-Agent': 'maad-proxy', 'Accept': self.headers.get('Accept', '*/*'), 'Accept-Encoding': 'identity'}
                if self.headers.get('Range'):
                    hd['Range'] = self.headers['Range']
                try:
                    st, rh, data = proxy_fetch(tgt, hd, int(CFG.get('proxy_max_mb', 80)) * 1048576)
                except Exception as e:
                    return self.js(502, {'error': 'Dienst nicht erreichbar'})
                ex = [(k, v) for k, v in rh.items() if k != 'Content-Type']
                return self.send(st, data, rh.get('Content-Type', 'application/octet-stream'), ex)
            if path == '/api/admin/wm':
                u = self.admin()
                if not u:
                    return
                w = (parse_qs(p.query).get('id', [''])[0] or '').strip()
                with db() as c:
                    r = c.execute('SELECT v FROM kv WHERE k=?', ('wm:' + w,)).fetchone()
                return self.js(200, {'id': w, 'email': r['v'] if r else None})
            if path == '/healthz':
                return self.send(200, 'ok', 'text/plain')
            return self.send(404, 'Nicht gefunden', 'text/plain; charset=utf-8')
        except FileNotFoundError:
            return self.send(500, 'Datei fehlt auf dem Server (maad.html, maad-demo.html, login.html oder admin.html).', 'text/plain; charset=utf-8')
        except Exception as e:
            log('', 'fehler', repr(e))
            return self.send(500, 'Serverfehler', 'text/plain; charset=utf-8')

    def admin(self):
        u = self.session_user()
        if not u:
            self.js(401, {'error': 'Nicht angemeldet'})
            return None
        if u['role'] != 'admin':
            self.js(403, {'error': 'Keine Berechtigung'})
            return None
        return u

    def auth(self, tok):
        if not tok:
            return self.redirect('/login')
        with db() as c:
            r = c.execute('SELECT * FROM tokens WHERE h=?', (sha(tok),)).fetchone()
            ok = r and not r['used'] and r['expires'] > time.time()
            if ok:
                c.execute('UPDATE tokens SET used=1 WHERE h=?', (sha(tok),))
        if not ok:
            return self.send(400, '<meta charset=utf-8><body style="font-family:system-ui;padding:40px"><h2>Link ungültig oder abgelaufen</h2><p><a href="/login">Neuen Anmeldelink anfordern</a></p>')
        u = user_row(r['email'])
        if not active_ok(u):
            log(r['email'], 'anmeldung_abgelehnt')
            return self.send(403, '<meta charset=utf-8><body style="font-family:system-ui;padding:40px"><h2>Zugang nicht aktiv</h2><p>Bitte wenden Sie sich an Ihren Ansprechpartner.</p>')
        sid = new_session(u['email'])
        with db() as c:
            c.execute("UPDATE users SET status='active', last_login=? WHERE email=?", (now(), u['email']))
        log(u['email'], 'anmeldung', self.ip())
        return self.redirect('/', [self.cookie_hdr(sid, CFG['session_days'] * 86400)])

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            if self.headers.get('X-Maad') != '1':
                return self.js(400, {'error': 'Ungültige Anfrage'})
            d = self.body_json()
            if path == '/api/login-link':
                email = str(d.get('email', '')).strip().lower()
                if not valid_email(email):
                    return self.js(400, {'error': 'Bitte eine gültige E-Mail-Adresse eingeben.'})
                if not (rate_ok('ip:' + self.ip(), 20, 600) and rate_ok('em:' + email, 5, 600)):
                    return self.js(429, {'error': 'Zu viele Anfragen. Bitte später erneut versuchen.'})
                u = user_row(email)
                if active_ok(u):
                    mail_login(email, u['name'], u['status'] == 'invited')
                    log(email, 'link_angefordert', self.ip())
                else:
                    log(email, 'link_abgelehnt', self.ip())
                return self.js(200, {'ok': True})      # immer gleiche Antwort
            if path == '/api/logout':
                ck = cookies.SimpleCookie(self.headers.get('Cookie', ''))
                if 'maad_sid' in ck:
                    with db() as c:
                        c.execute('DELETE FROM sessions WHERE h=?', (sha(ck['maad_sid'].value),))
                return self.js(200, {'ok': True}, [self.cookie_hdr('', 0)])
            if path == '/api/admin/cfg':
                a = self.admin()
                if not a:
                    return
                cfg = d.get('cfg')
                if not isinstance(cfg, dict):
                    return self.js(400, {'error': 'Ungültige Konfiguration'})
                raw = json.dumps(cfg)
                if len(raw) > 2_000_000:
                    return self.js(400, {'error': 'Konfiguration zu groß'})
                with db() as c:
                    c.execute("INSERT INTO kv(k,v) VALUES('toolcfg',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (raw,))
                log(a['email'], 'cfg', str(len(raw)) + ' Bytes')
                return self.js(200, {'ok': True})
            if path == '/api/admin/invite':
                a = self.admin()
                if not a:
                    return
                email = str(d.get('email', '')).strip().lower()
                if not valid_email(email):
                    return self.js(400, {'error': 'Ungültige E-Mail-Adresse'})
                plan = d.get('plan', 'starter')
                role = d.get('role', 'user')
                if plan not in PLANS or role not in ROLES:
                    return self.js(400, {'error': 'Ungültiges Abo oder ungültige Rolle'})
                perms = clean_perms(d['perms']) if isinstance(d.get('perms'), list) else PLANS[plan]
                vu = str(d.get('valid_until', ''))[:10]
                if vu and not re.match(r'^\d{4}-\d{2}-\d{2}$', vu):
                    return self.js(400, {'error': 'Datum bitte als JJJJ-MM-TT'})
                name = str(d.get('name', ''))[:120]
                org = str(d.get('org', ''))[:120]
                with db() as c:
                    ex = c.execute('SELECT email FROM users WHERE email=?', (email,)).fetchone()
                    if ex:
                        c.execute("UPDATE users SET name=?,org=?,plan=?,role=?,perms=?,valid_until=?,status=CASE WHEN status='blocked' THEN 'invited' ELSE status END WHERE email=?",
                                  (name, org, plan, role, json.dumps(perms), vu, email))
                    else:
                        c.execute('INSERT INTO users(email,name,org,plan,role,status,perms,valid_until,created) VALUES(?,?,?,?,?,?,?,?,?)',
                                  (email, name, org, plan, role, 'invited', json.dumps(perms), vu, now()))
                sent = False
                if d.get('send', True):
                    sent = mail_login(email, name, True)
                log(a['email'], 'freigabe', f'{email} {plan} {role}')
                return self.js(200, {'ok': True, 'mail': sent})
            if path == '/api/admin/user':
                a = self.admin()
                if not a:
                    return
                email = str(d.get('email', '')).strip().lower()
                act = d.get('action')
                u = user_row(email)
                if not u:
                    return self.js(404, {'error': 'Nicht gefunden'})
                if email == a['email'] and act in ('block', 'delete'):
                    return self.js(400, {'error': 'Das eigene Konto kann nicht gesperrt oder gelöscht werden.'})
                with db() as c:
                    if act == 'block':
                        c.execute("UPDATE users SET status='blocked' WHERE email=?", (email,))
                        c.execute('DELETE FROM sessions WHERE email=?', (email,))
                    elif act == 'unblock':
                        c.execute("UPDATE users SET status='invited' WHERE email=?", (email,))
                    elif act == 'delete':
                        c.execute('DELETE FROM users WHERE email=?', (email,))
                        c.execute('DELETE FROM sessions WHERE email=?', (email,))
                    elif act == 'resend':
                        pass
                    else:
                        return self.js(400, {'error': 'Unbekannte Aktion'})
                if act == 'resend':
                    mail_login(email, u['name'], u['status'] == 'invited')
                log(a['email'], 'kunde_' + str(act), email)
                return self.js(200, {'ok': True})
            return self.js(404, {'error': 'Nicht gefunden'})
        except ValueError as e:
            return self.js(400, {'error': str(e)})
        except Exception as e:
            log('', 'fehler', repr(e))
            return self.js(500, {'error': 'Serverfehler'})


class Quiet(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def main():
    init_db()
    srv = Quiet((CFG['host'], int(CFG['port'])), H)
    print(f"maad-Server läuft auf http://{CFG['host']}:{CFG['port']}  (öffentlich: {CFG['base_url']})", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
