// Not Found Handler - Catches requests to non-existent routes
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global Error Handler - Catches all errors and returns clean JSON response
const errorHandler = (err, req, res, next) => {
  // Always log the real error to console so 500s can be debugged from the terminal
  console.error('[Error Handler]', err.message);
  if (err.stack) console.error(err.stack);

  // If status code is 200 (default), set it to 500 (Internal Server Error)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Cloudinary "Stale request" = server clock out of sync with Cloudinary (e.g. >1 hour off)
  let message = err.message;
  if (typeof message === 'string' && message.includes('Stale request') && message.includes('reported time')) {
    message =
      'Image upload failed: server clock may be out of sync. Sync this machine\'s time with NTP and try again.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only show stack trace in development mode
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    // Additional error details in development
    ...(process.env.NODE_ENV === 'development' && {
      error: err,
      path: req.originalUrl,
      method: req.method,
    }),
  });
};

module.exports = { notFound, errorHandler };
