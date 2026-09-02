const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Helmet Security Headers Middleware
 */
const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://*.jattamkommerce.com"],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:", "https://*.jattamkommerce.com", "wss://*.jattamkommerce.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
      objectSrc: ["'none'"]
    }
  }
});

/**
 * Rate Limiter for Authentication & Sensitive endpoints
 * Limits to 100 requests per 15 minutes per IP
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Rate Limiter for General Public / API endpoints
 * Limits to 1000 requests per 15 minutes per IP
 */
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/health/db' || req.path.startsWith('/uploads'),
  message: {
    success: false,
    message: 'Rate limit exceeded. Please slow down your requests.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Correlation ID Middleware: Attaches unique X-Request-Id to every request and response
 */
function requestCorrelationId(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

/**
 * Production-safe structured request logging
 */
function requestLogger(req, res, next) {
  // Skip static assets or health checks from spamming logs
  if (req.path.startsWith('/uploads') || req.path === '/health') {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusCategory = statusCode >= 500 ? '🔴' : statusCode >= 400 ? '🟡' : '🟢';

    const logEntry = `[${new Date().toISOString()}] ${statusCategory} ${req.method} ${req.originalUrl || req.path} ${statusCode} - ${duration}ms [ReqID: ${req.id || 'N/A'}]`;

    if (statusCode >= 500) {
      console.error(logEntry);
    } else if (statusCode >= 400) {
      console.warn(logEntry);
    } else if (!isProduction || req.method !== 'GET') {
      console.log(logEntry);
    }
  });

  next();
}

module.exports = {
  securityHeaders,
  authRateLimiter,
  generalRateLimiter,
  requestCorrelationId,
  requestLogger
};
