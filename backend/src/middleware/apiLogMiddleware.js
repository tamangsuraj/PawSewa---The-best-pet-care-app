/**
 * Global API request/response logging for debugging sync issues.
 * Logs: [API Call] Method Path | Body (for mutating requests) | Status
 */
function apiLogMiddleware(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;

  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const bodySnippet = hasBody && req.body && Object.keys(req.body).length > 0
    ? JSON.stringify(req.body).slice(0, 200) + (JSON.stringify(req.body).length > 200 ? '...' : '')
    : '';

  res.on('finish', () => {
    const status = res.statusCode;
    const duration = Date.now() - start;
    console.log(
      `[API Call] ${method} ${path} | ${status} | ${duration}ms` +
      (bodySnippet ? ` | Body: ${bodySnippet}` : '')
    );
  });

  next();
}

module.exports = apiLogMiddleware;
