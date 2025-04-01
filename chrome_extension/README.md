# Oracle AI Fact Checker Chrome Extension

基于 Google Gemini AI 的网页内容事实核查工具，旨在帮助用户快速评估网页信息的可信度。

## 功能特点

- **实时内容分析：** 点击扩展图标即可触发对当前网页主要文本内容的分析。
- **浮动卡片展示：** 在页面右侧显示一个内容丰富的浮动卡片，展示分析结果。
- **可信度总分：** 提供 0-100 的整体可信度评分，并以颜色（红-黄-绿）直观展示。
- **多维度评估：**
    - **事实性 (Factuality)：** 评估陈述的真实程度。
    - **客观性 (Objectivity)：** 评估内容是否包含主观偏见。
    - **可靠性 (Reliability)：** 评估信息来源和论证的可信度。
    - **偏见度 (Bias)：** 评估内容是否存在特定立场或偏见。
- **内容摘要：** 生成当前网页内容的 AI 摘要。
- **事实核查：** 列出识别到的关键事实声明及其核查结果（真实、部分真实、虚假等）。
- **实体识别与验证：** 识别文中的关键实体（人名、地名、组织等）并提供简要验证信息。
- **夸张信息检查：** 指出内容中可能存在的夸张或过度宣传的表述。
- **国际化支持 (i18n)：**
    - 自动检测浏览器语言偏好（支持中文 `zh` 和英文 `en`）。
    - 界面文本和部分分析结果会自动切换语言。
- **后端服务健康检查：** 具备对后端 API 的健康检查和备用 URL 切换能力。
- **API 配额显示：** 可在后台查看 API 使用配额情况。

## 技术栈

- Chrome Extension Manifest V3
- JavaScript/TypeScript
- Webpack
- Google Gemini AI API
- Node.js/Express.js 后端 (用于 API 封装和配额管理)

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

1. 浏览网页时，点击浏览器工具栏的 Oracle AI Fact Checker 图标。
2. 扩展将提取页面内容并发送至后端进行分析，浮动卡片会显示"正在核查..."状态。
3. 分析完成后，浮动卡片将展示详细结果：
   - **顶部：** 醒目的可信度总分和颜色指示条。
   - **摘要：** AI 生成的内容概要。
   - **多维度分析：** 各项评估指标的评级（如：高/中/低，真实/虚假）及对应颜色。
   - **事实核查：** 具体事实声明的核查结论。
   - **实体识别：** 识别出的实体列表（可展开查看更多）。
   - **夸张信息：** 识别出的夸张表述。
4. 用户可以随时点击卡片右上角的关闭按钮隐藏卡片。
5. 如果分析出错或服务暂时不可用，卡片会显示错误信息和"重新核查"按钮。

## 核心机制说明

- **国际化 (i18n):** 通过 `navigator.language` (前端卡片) 和 `chrome.i18n.getUILanguage()` (后台) 检测用户语言，动态加载 `zh` 或 `en` 的文本资源。分析结果中的状态文本也会进行相应翻译。
- **消息传递:**
    - `Popup/Toolbar -> Background`: 请求分析、获取状态。
    - `Content Script <-> Background`: 内容脚本提取页面数据并请求分析，后台返回结果；内容脚本可查询后台服务状态。
    - `Content Script <-> Floating Card (iframe)`: 内容脚本控制卡片的显示/隐藏，并将分析数据和语言设置通过 `postMessage` 传递给卡片 iframe；卡片 iframe 通过 `postMessage` 通知内容脚本关闭自身或报告检测到的语言。
- **状态管理:**
    - **后台 (`background.js`):** 维护并持久化存储 API 服务状态（可用性、错误、配额、当前 URL），定期检查健康状态。
    - **内容脚本 (`content.js`):** 管理浮动卡片的实例、可见性、当前数据和语言。
    - **浮动卡片 (`floating-card.js`):** 管理卡片自身的 UI 状态（加载中、显示结果、错误）。

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
│   ├── background/     # 后台脚本 (事件处理, API 通信, 状态管理)
│   │   └── background.js
│   ├── content/        # 内容脚本 (页面交互, DOM 操作, 卡片注入)
│   │   ├── content.js
│   │   └── content.css
│   ├── core/           # 核心逻辑/工具 (如 i18n 管理器)
│   │   └── i18n-manager.js
│   ├── floating-card/  # 浮动卡片 UI (HTML, CSS, JS)
│   │   ├── floating-card.html
│   │   ├── floating-card.css
│   │   └── floating-card.js
│   └── popup/          # 浏览器工具栏弹窗 (如果需要)
│       └── styles/
├── public/             # 静态资源 (图标, manifest)
│   ├── icons/
│   ├── manifest.json
│   └── floating-card.html # 卡片的 HTML 模板 (会被 content script 加载)
├── dist/               # Webpack 构建输出目录
├── tests/              # 测试文件
├── .env.example        # 环境变量示例
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

## 联系方式

- 项目维护者：Hai Hu 胡海h
- 邮箱：[huhai.orion@gmail.com]
- 项目链接：[https://github.com/yourusername/oracle-ai-fact-checker](https://github.com/yourusername/oracle-ai-fact-checker) 
- Web版网址：[https://veritai.up.railway.app/](https://veritai.up.railway.app/)