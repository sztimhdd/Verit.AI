# Oracle AI 新闻真实性检测系统

这是一个基于人工智能的新闻真实性检测系统,可以帮助用户快速判断新闻的可信度。

## 功能特点

- 新闻内容提取与分析
- 基于Google Gemini的AI真实性评估
- 可信度评分和详细分析报告
- 美观的结果展示界面

## 技术栈

- 后端: Node.js + Express
- AI: Google Gemini API
- 前端: HTML + CSS + JavaScript
- 爬虫: Cheerio

## 安装与使用

1. 克隆仓库:
```bash
git clone [repository-url]
```

2. 安装依赖:
```bash
cd backend
npm install
```

3. 配置环境变量:
创建 `.env` 文件并添加以下配置:
```
GEMINI_API_KEY=your_api_key_here
```

4. 启动服务器:
```bash
npm run dev
```

5. 访问应用:
打开 `frontend/index.html` 即可使用

## API 文档

### 检测新闻真实性
- 端点: POST /api/analyze
- 请求体: 
```json
{
    "url": "新闻URL"
}
```
- 响应:
```json
{
    "score": 85,
    "analysis": "详细分析...",
    "issues": ["问题1", "问题2"]
}
```

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License 