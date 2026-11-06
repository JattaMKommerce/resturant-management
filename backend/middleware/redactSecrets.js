/**
 * Last line of defence for JSON responses: many handlers return whole database rows
 * (SELECT * FROM restaurants / users). Strip secrets before anything leaves the server.
 *  - razorpay_key_secret → '' plus razorpay_key_secret_set: true|false (admins can see one is saved)
 *  - password_hash / plain_password → removed
 */
const REMOVE_KEYS = new Set(['password_hash', 'plain_password']);

function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || depth > 8) return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = redact(value[i], depth + 1, seen);
    return value;
  }

  for (const key of Object.keys(value)) {
    if (REMOVE_KEYS.has(key)) {
      delete value[key];
    } else if (key === 'razorpay_key_secret') {
      value.razorpay_key_secret_set = Boolean(value[key]);
      value[key] = '';
    } else if (value[key] && typeof value[key] === 'object') {
      value[key] = redact(value[key], depth + 1, seen);
    }
  }
  return value;
}

function redactSecrets(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(redact(body));
  next();
}

module.exports = { redactSecrets, redact };
