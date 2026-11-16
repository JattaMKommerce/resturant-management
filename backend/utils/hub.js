/**
 * ALL-IN-ONE hub login tracking: tells hub.jattamkommerce.com who logged in, when, from which device and where.
 * Turned on by ALLINONE_URL + ALLINONE_KEY in backend/.env. Without them it does nothing.
 * Never throws and never slows a login down (sent in the background).
 */
const AllInOne = require('./allinone.cjs');

let hub;
function getHub() {
  if (hub !== undefined) return hub;
  const url = process.env.ALLINONE_URL;
  const key = process.env.ALLINONE_KEY;
  try {
    hub = url && key ? new AllInOne({ url, apiKey: key }) : null;
  } catch (e) {
    hub = null;
  }
  return hub;
}

/** type: 'login' | 'failed_login' | 'signup' | 'logout' */
function track(type, req, u = {}, meta) {
  const h = getHub();
  if (!h) return;
  try {
    h.track(type, req, { id: u.id, email: u.email || null, name: u.name || u.phone || null }, meta).catch(() => {});
  } catch (e) {
    /* tracking must never affect the hotel app */
  }
}

module.exports = { track };
