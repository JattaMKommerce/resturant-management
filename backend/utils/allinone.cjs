/**
 * ALL-IN-ONE SDK (CommonJS) — for Node/Express projects that use require().
 * Zero dependencies. Never throws: if the hub is down, your app still works.
 *
 *   const AllInOne = require('./allinone.cjs');
 *   const hub = new AllInOne({ url: 'https://hub.yourcompany.com', apiKey: 'aio_...' });
 *
 *   // after the password is verified:
 *   hub.trackLogin(req, { id: user.id, email: user.email, name: user.name });
 *
 *   // device id + exact location: add <script src="https://hub.yourcompany.com/sdk/geo.js" defer></script>
 *   // to the website's <head>; this SDK then sends them automatically (location only if the person allowed it).
 *
 *   // enquiries from your website/app -> ONLINE leads in the hub
 *   hub.submitLead({ name: 'Ravi', email: 'ravi@x.com', phone: '98...', message: 'Need a quote' });
 */
'use strict';

const http = require('http');
const https = require('https');

class AllInOne {
  constructor({ url, apiKey, timeoutMs = 3000, debug = false } = {}) {
    if (!url || !apiKey) throw new Error('AllInOne: url and apiKey are required');
    this.base = url.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.debug = debug;
  }

  trackLogin(req, user, meta, context) {
    return this.track('login', req, user, meta, context);
  }
  trackLogout(req, user, meta, context) {
    return this.track('logout', req, user, meta, context);
  }
  trackSignup(req, user, meta, context) {
    return this.track('signup', req, user, meta, context);
  }
  trackFailedLogin(req, user, meta, context) {
    return this.track('failed_login', req, user, meta, context);
  }

  /** @returns {Promise<boolean>} true if the hub accepted the event. Never rejects. */
  /**
   * @param {object} [context] optional overrides: { deviceId, location: { lat, lng, accuracy } }
   */
  track(type, req, user = {}, meta, context = {}) {
    const body = { type, user: { id: user.id != null ? String(user.id) : undefined, email: user.email, name: user.name }, meta };
    if (req && req.headers) {
      body.ip = clientIp(req);
      body.userAgent = req.headers['user-agent'];
    }
    // Device id + exact location (from cookies written by /sdk/geo.js; location only if the person allowed it)
    const dc = deviceContext(req);
    body.deviceId = context.deviceId || dc.deviceId;
    const loc = context.location || dc.location;
    if (loc) body.location = loc;
    return this._post('/v1/events', body);
  }

  /**
   * Send an enquiry from your website/app. It becomes an ONLINE lead in the hub that the admin assigns to a sales person.
   * @param {{name: string, email?: string, phone?: string, company?: string, message?: string, source?: string}} lead  email or phone required
   * @returns {Promise<boolean>}
   */
  submitLead(lead) {
    return this._post('/v1/leads', lead);
  }

  _post(path, body) {
    const endpoint = new URL(this.base + path);
    const payload = JSON.stringify(body);
    const lib = endpoint.protocol === 'https:' ? https : http;

    // Uses the core http module so it works on every Node version (no fetch needed).
    return new Promise((resolve) => {
      const r = lib.request(
        endpoint,
        {
          method: 'POST',
          timeout: this.timeoutMs,
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'X-Api-Key': this.apiKey },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const ok = res.statusCode >= 200 && res.statusCode < 300;
            if (!ok && this.debug) console.warn('[AllInOne]', res.statusCode, data);
            resolve(ok);
          });
        },
      );
      r.on('timeout', () => r.destroy(new Error('timeout')));
      r.on('error', (err) => {
        if (this.debug) console.warn('[AllInOne] could not reach hub:', err.message);
        resolve(false);
      });
      r.end(payload);
    });
  }
}

// ---- device id + exact location (cookies written by the hub's /sdk/geo.js, or by this SDK) ----
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function readCookie(cookieHeader, name) {
  const m = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

/** "lat,lng,accuracy,timeMs" -> { lat, lng, accuracy, at } (only exists if the person allowed location). */
function parseGeo(v) {
  const p = String(v || '').split(',').map(Number);
  if (p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return undefined;
  return { lat: p[0], lng: p[1], accuracy: Number.isFinite(p[2]) ? p[2] : undefined, at: Number.isFinite(p[3]) ? p[3] : undefined };
}

function randomId() {
  const bytes = new Uint8Array(12);
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && c.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Server: read the browser's cookies from the request. Browser: read (or create) them directly. */
function deviceContext(req) {
  if (req && req.headers) {
    const cookie = req.headers.cookie;
    // Cookies when the API is on the website's own domain; the x-aio-* headers when the website calls an API on
    // another domain (cookies do not travel there) - see "API on a different domain" in docs/INTEGRATION.md
    const header = (n) => {
      const v = req.headers[n];
      return Array.isArray(v) ? v[0] : v;
    };
    const id = readCookie(cookie, 'aio_did') || header('x-aio-device');
    const geo = readCookie(cookie, 'aio_geo') || header('x-aio-geo');
    return { deviceId: id && ID_RE.test(id) ? id : undefined, location: parseGeo(geo && decodeURIComponent(geo)) };
  }
  if (typeof document !== 'undefined') {
    let id = readCookie(document.cookie, 'aio_did');
    if (!id || !ID_RE.test(id)) {
      id = randomId();
      document.cookie = 'aio_did=' + id + '; Max-Age=' + 730 * 86400 + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    return { deviceId: id, location: parseGeo(readCookie(document.cookie, 'aio_geo')) };
  }
  return {};
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.ip || (req.socket && req.socket.remoteAddress);
}

module.exports = AllInOne;
module.exports.default = AllInOne;
