const rateLimitMap = new Map();

/**
 * Simple in-memory rate limiter middleware for public endpoints
 * @param {number} windowMs - Time window in milliseconds (e.g. 15 * 60 * 1000 for 15 minutes)
 * @param {number} maxRequests - Max requests per IP in the window
 */
function createRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 10) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = rateLimitMap.get(ip);
    if (!record) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(ip, record);
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
        message: 'Too many application requests from this IP. Please try again later.'
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
