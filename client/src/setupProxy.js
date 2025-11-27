const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/ocr',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      timeout: 300000, // 5 minutes
      proxyTimeout: 300000, // 5 minutes
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(504).json({ error: 'Backend timeout - OCR processing may take a while' });
      }
    })
  );
  
  app.use(
    '/health',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
    })
  );
};
