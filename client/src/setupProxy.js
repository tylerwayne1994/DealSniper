const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // OCR routes
  app.use(
    '/ocr',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      timeout: 300000,
      proxyTimeout: 300000,
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(504).json({ error: 'Backend timeout - OCR processing may take a while' });
      }
    })
  );
  
  // Health check
  app.use(
    '/health',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
    })
  );

  // Google OAuth routes - must proxy /auth/* to backend
  app.use(
    '/auth',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      pathRewrite: undefined, // Don't rewrite path
      logLevel: 'debug',
    })
  );

  // Email deals API routes
  app.use(
    '/api/email-deals',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
    })
  );

  // V2 API routes
  app.use(
    '/v2',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
    })
  );

  // Generic API catch-all
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
    })
  );
};
