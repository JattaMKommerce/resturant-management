/**
 * ALL-IN-ONE hub: this browser's device id and exact location (cookies written by
 * https://hub.jattamkommerce.com/sdk/geo.js in index.html). The API runs on another domain where
 * those cookies are not sent, so login / logout calls carry them as two headers instead.
 * Only added to sign-in, sign-up and log-out requests.
 */
const AUTH_URL = /(^|\/)(auth|driver)\/|login|logout|verify-otp|register/i;

function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

export function addAioHeaders(config) {
  try {
    if (!AUTH_URL.test(config.url || '')) return config;
    const device = readCookie('aio_did');
    const geo = readCookie('aio_geo');
    if (device) config.headers['x-aio-device'] = device;
    if (geo) config.headers['x-aio-geo'] = geo;
  } catch (e) {
    /* never block a request */
  }
  return config;
}
