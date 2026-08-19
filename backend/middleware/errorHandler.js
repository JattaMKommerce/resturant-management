const isProduction = process.env.NODE_ENV === 'production';

/**
 * Centralized Production Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // If response headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  // Structured Error Logging
  console.error(`❌ [${new Date().toISOString()}] Error [${errorCode}] on ${req.method} ${req.originalUrl || req.path}:`, {
    message: err.message,
    requestId: req.id,
    stack: !isProduction ? err.stack : undefined
  });

  // Handle specific known error types
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication session expired or invalid. Please sign in again.',
      code: 'AUTH_EXPIRED'
    });
  }

  if (err.name === 'MulterError') {
    let message = 'File upload failed.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size (5MB).';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected file field "${err.field}".`;
    }
    return res.status(400).json({
      success: false,
      message: message,
      code: `UPLOAD_${err.code}`
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload in request body.',
      code: 'INVALID_JSON'
    });
  }

  // MySQL / Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists.',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed. Please ensure DATABASE_URL is properly configured.',
      code: 'DATABASE_UNAVAILABLE'
    });
  }

  // Safe client response (no stack trace or internal SQL leak in production)
  const safeMessage = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message: safeMessage,
    code: errorCode,
    ...(req.id ? { requestId: req.id } : {})
  });
}

module.exports = errorHandler;
