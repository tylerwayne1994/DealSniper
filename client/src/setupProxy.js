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

  // Google OAuth routes (Gmail/Sheets connection flow) - must proxy
  // /auth/google/* to the backend. Scoped to /auth/google specifically
  // (not the whole /auth prefix) so it doesn't swallow client-side React
  // Router routes like /auth/callback (the Supabase Google Sign-In landing
  // page) - Express strips the mount prefix before this middleware ever
  // sees the request, so a broader '/auth' mount here would forward
  // '/auth/callback' to the backend as '/callback', which doesn't exist.
  app.use(
    '/auth/google',
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
