const express = require('express');
const path = require('path');
const app = express();
// 使用Railway分配的PORT (8080)
const PORT = process.env.PORT || 8080;

// 设置静态文件目录
app.use(express.static('./'));

// 所有路由都返回index.html，支持SPA应用
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// 在Express服务器中添加配置端点
app.get('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`
    window.APP_CONFIG = {
      API_BASE_URL: '${process.env.BACKEND_API_URL || 'https://veritai-api.up.railway.app'}'
    };
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`前端服务器运行在 http://0.0.0.0:${PORT}`);
}); 