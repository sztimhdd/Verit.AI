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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`前端服务器运行在 http://0.0.0.0:${PORT}`);
}); 