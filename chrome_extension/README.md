# Verit.AI Fact Checker Chrome Extension

基于 Google Gemini AI 的网页内容事实核查工具。

## 功能特点

- 实时分析网页内容的可信度
- 提供事实性、客观性、可靠性和偏见性评分
- 生成内容摘要
- 显示参考来源
- 支持中文内容分析
- 完整的双语支持（中文/英文）

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
│   ├── core/
│   │   └── i18n-manager.js
│   ├── utils/
│   │   ├── errorHandler.js
│   │   └── language.js
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── popup/
│   │   └── popup.js
│   └── floating-card/
│       └── floating-card.js
├── _locales/
│   ├── en/
│   │   └── messages.json
│   └── zh/
│       └── messages.json
├── public/
│   ├── icons/
│   ├── popup.html
│   └── popup.js
├── manifest.json
├── styles/
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── webpack.config.cjs
```

## 国际化（i18n）实现

本扩展支持中文和英文两种语言：

1. **Chrome官方i18n**：
   - 使用Chrome扩展API的`chrome.i18n.getMessage()`方法
   - 在`_locales`目录中提供本地化消息文件
   - 在`manifest.json`中使用`__MSG_messageName__`格式引用

2. **在代码中使用i18n**：
   ```javascript
   // 导入优化版的i18n模块
   import i18n from '../utils/i18n.js';
   
   // 获取本地化文本（带缓存机制）
   const localizedText = i18n.getMessage("messageName");
   
   // 为DOM元素设置本地化文本
   document.getElementById("elementId").textContent = localizedText;
   
   // 初始化页面上所有带data-i18n属性的元素
   await i18n.initializeI18n();
   ```

3. **HTML标记**：
   - 使用`data-i18n`属性标记需要本地化的元素
   - 通过JavaScript动态更新这些元素的文本内容
   ```html
   <button data-i18n="analyze">分析</button>
   <span data-i18n="reliability">可靠性</span>
   ```

4. **性能优化**：
   - 使用消息缓存避免重复调用Chrome API
   - 预加载常用消息
   - 批量更新DOM，减少布局重绘
   - 使用`requestAnimationFrame`确保DOM更新在最佳时机执行

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 浮动卡片调试与优化

浮动卡片功能在某些情况下可能会出现"analyzing..."一直显示而不更新结果的问题。我们通过以下步骤解决了这个问题：

### 问题诊断
1. 浮动卡片创建成功，但无法显示分析结果
2. 背景脚本与内容脚本之间的通信存在问题
3. 数据结构处理不一致，导致结果无法正确显示

### 修复措施
1. **浮动卡片组件增强**
   - 添加了更强健的数据请求机制
   - 实现了自主数据请求定时器
   - 增加了详细的调试日志
   - 改进了错误处理

2. **数据处理标准化**
   - 添加了`normalizeResultData`函数处理不同格式的数据结构
   - 支持多种嵌套数据结构的解析
   - 增强了对缺失字段的容错能力

3. **消息传递优化**
   - 改进了内容脚本与浮动卡片之间的通信
   - 支持多种消息格式以增强兼容性
   - 添加了消息确认和重试机制

4. **测试功能集成**
   - 添加了浮动卡片测试功能
   - 实现了模拟数据生成器
   - 启用了API故障时的回退策略

5. **国际化支持完善**
   - 添加了浮动卡片相关的本地化文本
   - 确保所有用户界面元素都支持中英文显示

### 使用测试功能
1. 在扩展弹出窗口中，点击"测试浮动卡片"按钮
2. 系统会生成测试数据并显示浮动卡片
3. 查看浮动卡片是否正确显示内容

### 调试技巧
如果浮动卡片无法正确显示结果：
1. 打开浏览器开发者工具 (F12 或 Ctrl+Shift+I)
2. 检查控制台中是否有错误消息
3. 验证数据格式是否与浮动卡片期望的格式一致
4. 使用测试按钮确认浮动卡片本身是否正常工作


