const rateLimitMap = new Map();

/**
 * Simple in-memory rate limiter middleware for public endpoints
 * @param {number} windowMs - Time window in milliseconds (e.g. 15 * 60 * 1000 for 15 minutes)
 * @param {number} maxRequests - Max requests per IP in the window
 * @param {string} [bucket='default'] - Separate counter name, so different endpoints don't share one count
 */
function createRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 10, bucket = 'default') {
  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || req.socket.remoteAddress || '127.0.0.1';
    const key = `${bucket}:${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, record);
    } else {
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
      } else {
        record.count += 1;
      }
    }

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests from this network. Please wait a few minutes and try again.'
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
