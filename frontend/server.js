const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
// 使用Railway分配的PORT (8080)
const PORT = process.env.PORT || 8080;

// 添加config.js路由 - 在现有路由之前添加这段代码
app.get('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`
    // 配置对象
    window.APP_CONFIG = {
      API_BASE_URL: '${process.env.BACKEND_API_URL || ''}'
    };
    console.log('配置已加载:', window.APP_CONFIG);
  `);
});

// 确保这个配置路由在静态文件中间件之前定义
// 然后是您现有的静态文件服务中间件
app.use(express.static('./'));

// 所有路由都返回index.html，支持SPA应用
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// 代理API请求
app.use('/api', createProxyMiddleware({
  target: 'https://veritai-api.up.railway.app',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api' // 保持路径不变
  },
  onProxyRes: function(proxyRes) {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
}));

// 添加健康检查代理
app.use('/health', createProxyMiddleware({
  target: 'https://veritai-api.up.railway.app',
  changeOrigin: true
}));

// 添加更多错误处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  // 不退出进程
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

// 增加请求体大小限制
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('应用错误:', err);
  res.status(500).send('服务器内部错误');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`前端服务器运行在 http://0.0.0.0:${PORT}`);
}); 