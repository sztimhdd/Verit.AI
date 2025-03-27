# Verit.AI Fact Checker Chrome Extension

基于 Google Gemini AI 的网页内容事实核查工具。

## 功能特点

- 实时分析网页内容的可信度
- 提供事实性、客观性、可靠性和偏见性评分
- 生成内容摘要
- 显示参考来源
- 支持中文内容分析

## 技术栈

- Chrome Extension Manifest V3
- JavaScript/TypeScript
- Webpack
- Google Gemini AI API
- Express.js 后端

## 安装说明

1. 克隆仓库：
   ```bash
   git clone [your-repository-url]
   cd oracle-ai-fact-checker
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 构建扩展：
   ```bash
   npm run build
   ```

4. 在 Chrome 中加载扩展：
   - 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目的 `dist` 目录

## 使用方法

1. 在任意网页点击扩展图标
2. 等待分析完成
3. 查看分析结果：
   - 总体可信度分数
   - 详细分析指标
   - 内容摘要
   - 参考来源

## 开发

```bash
# 安装依赖
npm install

# 开发模式构建
npm run dev

# 生产模式构建
npm run build
```

## 许可证

[Your License]

## 项目结构

```
chrome_extension/
├── src/
│   ├── utils/
│   │   ├── errorHandler.js
│   │   └── i18n.js
│   ├── background.js
│   ├── content.js
│   └── popup.js
├── public/
│   ├── icons/
│   ├── manifest.json
│   └── popup.html
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── webpack.config.js
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request


