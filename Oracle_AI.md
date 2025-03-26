# Oracle AI 辟谣助手 - PRD v2.1

## 项目定位
基于Gemini API （gemini-1.5-flash）的Web端辟谣系统，提供便捷的在线内容真实性验证服务，通过Chrome扩展实现页面内容一键核查

## 系统架构
```mermaid
graph TB
    A[API请求] --> B[服务就绪状态检查]
    B --> |就绪| C[模型管理器]
    B --> |未就绪| D[请求队列]
    D --> |服务就绪后| C
    C --> |选择最佳模型| E[Gemini API]
    E --> F[结果处理]
    F --> G[响应]
```

## 后端API架构升级

### 模型管理系统

#### 模型配置与调度
```yaml
可用模型:
  - gemini-2.0-flash:
      特点: 高级推理 + Google Search Grounding
      使用场景: 默认模型，需要外部验证时
      配额限制: 每日500次Grounding调用
  - gemini-1.5-flash:
      特点: 基础推理能力
      使用场景: 备选模型，无需外部验证时
      配额限制: 无

调度策略:
  优先级:
    1. gemini-2.0-flash + Grounding
    2. gemini-2.0-flash (无Grounding)
    3. gemini-1.5-flash
  
  切换条件:
    - 达到Grounding每日限额时禁用Grounding
    - API调用失败时降级到下一优先级
    - 每日00:00重置到最高优先级
```

#### 模型状态管理
```typescript
interface ModelState {
  currentModel: 'gemini-2.0-flash' | 'gemini-1.5-flash';
  useGrounding: boolean;
  groundingCount: number;
  lastReset: string; // ISO时间
  dailyQuota: {
    grounding: number;
    total: number;
  }
}

interface ModelConfig {
  modelName: string;
  temperature: number;
  topK: number;
  topP: number;
  tools?: {
    googleSearchRetrieval: Record<string, never>;
  }
}
```

### API响应结构优化

#### 分析结果格式
```typescript
interface AnalysisResult {
  score: number;          // 0-100
  flags: {
    factuality: '高' | '中' | '低';
    objectivity: '高' | '中' | '低';
    reliability: '高' | '中' | '低';
    bias: '高' | '中' | '低';
  };
  source_verification: {
    sources_found: string[];
    credibility_scores: number[];
    overall_source_credibility: string;
  };
  entity_verification: {
    entities_found: string[];
    accuracy_assessment: string;
    corrections: string[];
  };
  fact_check: {
    claims_identified: string[];
    verification_results: string[];
    overall_factual_accuracy: string;
  };
  exaggeration_check: {
    exaggerations_found: string[];
    corrections: string[];
    severity_assessment: string;
  };
  summary: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
}
```

### 服务状态管理

#### 健康检查接口
```typescript
// GET /api/health
interface HealthCheckResponse {
  status: 'OK' | 'ERROR' | 'INITIALIZING';
  ready: boolean;
  currentModel: string;
  groundingEnabled: boolean;
  timestamp: string;
  quotaStatus: {
    groundingRemaining: number;
    resetTime: string;
  };
}
```

#### 错误处理策略
```yaml
重试机制:
  最大重试次数: 5
  重试间隔: 指数退避 (1.5s, 3s, 6s, 12s, 24s)
  触发条件:
    - API超时
    - 服务未就绪
    - 配额限制临时超出

降级策略:
  条件与行为:
    - Grounding调用失败: 
        1. 禁用Grounding重试
        2. 若仍失败则切换模型
    - 模型调用失败:
        1. 切换到备用模型
        2. 若仍失败则返回错误
```

### 性能优化

#### 请求处理优化
```javascript
const OPTIMIZATION_CONFIG = {
  // 并发控制
  MAX_CONCURRENT_REQUESTS: 5,
  REQUEST_TIMEOUT: 30000,
  
  // 队列管理
  MAX_QUEUE_SIZE: 100,
  QUEUE_TIMEOUT: 60000,
  
  // Token估算
  CHAR_TO_TOKEN_RATIO: 4,
  MAX_INPUT_LENGTH: 30000,
  
  // 缓存设置
  CACHE_TTL: 7 * 24 * 60 * 60, // 7天
  MAX_CACHE_ITEMS: 1000
};
```

#### 缓存策略
```yaml
缓存机制:
  存储位置: backend/cache/
  缓存内容:
    - 分析结果: 7天有效期
    - 模型状态: 24小时更新
    - 配额计数: 每日重置
  
  清理策略:
    - 定时清理过期缓存
    - 超出容量时LRU淘汰
```

### 部署配置

#### 环境变量
```yaml
必需变量:
  - GEMINI_API_KEY: Google API密钥
  - NODE_ENV: 运行环境(development/production)
  - PORT: 服务端口
  - DAILY_GROUNDING_LIMIT: 每日Grounding限额(默认500)
```

#### 监控指标
```yaml
性能指标:
  - API响应时间
  - 请求成功率
  - 模型切换频率
  - Grounding使用量
  - 缓存命中率

告警阈值:
  - 响应时间 > 10s
  - 成功率 < 95%
  - 连续失败 > 3次
  - Grounding剩余量 < 50次
```

## 技术栈
### 前端技术
```yaml
架构: 单页面应用(SPA)
核心技术:
  - HTML5
  - JavaScript (ES6+)
  - Bootstrap 5.x
交互设计:
  - 响应式布局
  - 实时状态反馈
  - 动态结果展示
```

### 后端技术
```yaml
运行环境: Node.js
核心依赖:
  - Express.js: Web服务器框架
  - node-fetch: 网页内容获取
  - cheerio: HTML解析
API集成:
  - Gemini API: 内容分析引擎
数据存储:
  - 本地JSON缓存
  - Redis(可选): 分布式缓存
```

### Chrome扩展技术
```yaml
架构: Chrome Extension (Manifest V3)
核心技术:
  - JavaScript (ES6+)
  - HTML/CSS
  - Webpack: 模块打包
主要组件:
  - Background Service Worker: 后台分析与状态管理
  - Content Script: 页面内容获取
  - Popup: 结果展示界面
```
模型特性与使用场景
| 模型 | 特性 | 使用场景 |
|------|------|----------|
| gemini-2.0-flash | 更强大的推理能力 + Google Search Grounding | 默认模型，提供高质量事实核查 |
| gemini-1.5-flash | 基本推理能力，不使用外部搜索 | 接近配额限制或首选模型失败时的备选项 |

## 功能模块

### 1. Web界面
#### 用户交互
- URL输入框
- 分析进度指示器
- 语言切换(中/英)
- 分析结果可视化展示

#### 响应式设计
```css
/* 布局断点 */
移动端: <= 768px
平板: 768px - 1024px
桌面: >= 1024px
```

### 2. 后端服务
#### API端点
```javascript
// Chrome Extension和Web前端通用API
POST /api/extension/analyze
- 参数: { 
    url: string,       // 页面URL
    lang: string       // 语言代码（默认zh）
}
- 响应: {
    status: "success" | "error",  // API调用状态
    data?: {          // 成功时返回的数据
        score: number,     // 可信度评分(0-100)
        flags: {           // 各维度评级
            factuality: "高" | "中" | "低",    // 事实性
            objectivity: "高" | "中" | "低",   // 客观性
            reliability: "高" | "中" | "低",   // 可靠性
            bias: "高" | "中" | "低"          // 偏见性
        },
        source_verification: {     // 来源验证
            sources_found: string[],           // 发现的信息来源
            credibility_scores: number[],      // 来源可信度评分(1-10)
            overall_source_credibility: string // 整体来源可信度
        },
        entity_verification: {     // 实体验证
            entities_found: string[],          // 发现的实体
            accuracy_assessment: string,       // 准确性评估
            corrections: string[]              // 需要更正的内容
        },
        fact_check: {             // 事实核查
            claims_identified: string[],       // 主要声明列表
            verification_results: string[],    // 验证结果列表
            overall_factual_accuracy: string   // 整体事实准确性
        },
        exaggeration_check: {     // 夸大检查
            exaggerations_found: string[],     // 夸大表述列表
            corrections: string[],             // 更准确的表述
            severity_assessment: string        // 严重程度评估
        },
        summary: string,          // 内容摘要
        sources: [{               // 参考来源
            title: string,
            url: string
        }]
    },
    error?: {         // 错误时返回的信息
        message: string,
        details?: string
    }
}
```

### Chrome扩展适配指南
#### Popup UI 更新
```javascript
// popup.js 中需要更新的渲染逻辑
function renderAnalysisResult(result) {
    if (result.status === 'error') {
        showError(result.error.message);
        return;
    }

    const data = result.data;
    
    // 更新基础信息
    updateScore(data.score);
    updateFlags(data.flags);
    
    // 更新多维度分析结果
    updateSourceVerification(data.source_verification);
    updateEntityVerification(data.entity_verification);
    updateFactCheck(data.fact_check);
    updateExaggerationCheck(data.exaggeration_check);
    
    // 更新摘要和来源
    updateSummary(data.summary);
    updateSources(data.sources);
}

// 添加新的UI组件
const newUIComponents = `
    <div class="verification-section">
        <div class="source-verification">
            <h3>来源验证</h3>
            <!-- 来源验证结果展示 -->
        </div>
        <div class="entity-verification">
            <h3>实体验证</h3>
            <!-- 实体验证结果展示 -->
        </div>
        <div class="fact-check">
            <h3>事实核查</h3>
            <!-- 事实核查结果展示 -->
        </div>
        <div class="exaggeration-check">
            <h3>夸大检测</h3>
            <!-- 夸大检测结果展示 -->
        </div>
    </div>
`;
```

#### Background Service Worker 适配
```javascript
// background.js 中的分析处理逻辑
async function analyzePage(tabId, url) {
    try {
        // 显示加载状态
        await showLoadingState(tabId);
        
        // 获取页面内容
        const content = await getPageContent(tabId);
        
        // 调用更新后的API
        const response = await fetch('http://localhost:4000/api/extension/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                url,
                lang: 'zh'
            })
        });
        
        const result = await response.json();
        
        // 处理API响应
        if (result.status === 'success') {
            await showAnalysisResult(tabId, result.data);
        } else {
            await showError(tabId, result.error.message);
        }
        
    } catch (error) {
        await showError(tabId, error.message);
    }
}
```

### 错误处理规范
```javascript
// 统一的错误类型
const ERROR_TYPES = {
    CONTENT_ERROR: '内容获取失败',
    API_ERROR: 'API调用失败',
    PARSE_ERROR: '解析结果失败',
    RENDER_ERROR: '显示结果失败'
};

// 错误处理流程
async function handleError(error, tabId) {
    console.error('Error:', error);
    
    let errorMessage = ERROR_TYPES[error.type] || '未知错误';
    if (error.details) {
        errorMessage += `: ${error.details}`;
    }
    
    await showError(tabId, errorMessage);
}
```

#### 内容分析流程
1. URL有效性验证
2. 网页内容获取
3. 文本内容提取
4. 缓存查询/存储
5. Gemini API分析
6. 结果格式化

### 3. 分析引擎
#### 多维度分析
| 维度 | 检查点 | 输出 |
|------|--------|------|
| 信源 | 引用可靠性 | 评分(0-100) |
| 实体 | 人物/机构 | 验证结果 |
| 事实 | 核心陈述 | 真实性评估 |
| 夸大 | 表述准确性 | 偏差程度 |

### 评分细则
```typescript
interface ScoreBreakdown {
    source_credibility: number;    // 来源可信度得分
    entity_accuracy: number;       // 实体准确性得分
    factual_accuracy: number;      // 事实准确性得分
    exaggeration_penalty: number;  // 夸大表述扣分
    final_score: number;          // 最终得分
}

// 评分计算规则
const scoreCalculation = {
    source_credibility: {
        weight: 0.3,              // 权重30%
        calculation: 'average of credibility_scores'
    },
    entity_accuracy: {
        weight: 0.2,              // 权重20%
        calculation: 'percentage of accurate entities'
    },
    factual_accuracy: {
        weight: 0.3,              // 权重30%
        calculation: 'percentage of verified claims'
    },
    exaggeration_penalty: {
        weight: 0.2,              // 权重20%
        calculation: 'penalty based on severity_assessment'
    }
};
```

#### 生成策略
- 风险等级颜色编码（红/黄/绿）
- 证据按可信度排序（政府源 > 学术源 > 媒体源）
- 自动生成短链接（使用新浪短链API）



## 数据管理

### 评分日志结构
| 字段               | 类型     | 说明                     |
|--------------------|----------|--------------------------|
| evidence_mismatch | SMALLINT | 证据等级失配扣分项数量   |
| small_sample_flag | BOOLEAN  | 是否触发小样本警告       |
### 缓存结构设计
| 字段           | 类型     | 说明                          |
|----------------|----------|------------------------------|
| content_hash   | CHAR(8)  | 文章内容MD5前8位              |
| risk_level     | TINYINT  | 风险等级（1-5级）             |
| expire_time    | DATETIME | 缓存有效期（默认7天）         |

#### 结果呈现
```html
<div class="result-card">
  <!-- 动态评分展示 -->
  <!-- 问题摘要列表 -->
  <!-- 详细分析报告 -->
</div>
```

### 4. 缓存系统
```javascript
{
  "cache_key": "md5_hash",
  "analysis": {
    "timestamp": "ISO时间",
    "results": "分析结果",
    "expires_at": "过期时间"
  }
}
```



### 环境依赖
```bash
# 后端
Node.js >= 14.x
npm >= 6.x

# API密钥
GEMINI_API_KEY= AIzaSyAGgOYBLHYReZFylVtCIB3R9Zhv4QUPLhM
```


## Python版参考实现

### 模块架构设计
```mermaid
graph TB
    A[FactChecker类] --> B[内容获取模块]
    A --> C[分析引擎模块]
    A --> D[缓存管理模块]
    A --> E[结果生成模块]
    
    B --> B1[URL验证]
    B --> B2[内容抓取]
    B --> B3[文本提取]
    
    C --> C1[信源分析]
    C --> C2[实体验证]
    C --> C3[事实核查]
    C --> C4[夸大检测]
    
    D --> D1[哈希生成]
    D --> D2[缓存读写]
    
    E --> E1[文本报告]
    E --> E2[HTML报告]
```

### 数据结构设计
```python
# 核心类结构
class FactChecker:
    def __init__(self, api_key: str):
        self.client = genai.Client()
        self.cache = {}
        
    def analyze_content(self, content: str) -> Dict:
        return {
            "source_verification": Dict,
            "entity_verification": Dict,
            "fact_check": Dict,
            "exaggeration_check": Dict,
            "overall_assessment": Dict
        }

# 缓存数据结构
CacheEntry = {
    "content_hash": str,
    "analysis_results": Dict,
    "timestamp": datetime,
    "expire_time": datetime
}

# 分析结果结构
AnalysisResult = {
    "trustworthiness_score": int,  # 0-100
    "assessment_summary": str,
    "key_issues": List[str],
    "evidence_details": Dict
}
```

### Prompt模块设计
```python
PROMPT_TEMPLATES = {
    "source_verification": """
    分析文本中提到的信息来源:
    1. 识别引用的来源
    2. 验证来源真实性
    3. 评估可信度(1-10)
    输出JSON格式：
    {
        "sources_found": [],
        "verification_results": [],
        "credibility_scores": []
    }
    """,
    
    "entity_verification": """
    验证文本中提到的人物和机构:
    1. 识别关键实体
    2. 验证存在性
    3. 核实相关信息
    输出JSON格式：
    {
        "entities_found": [],
        "verification_results": [],
        "accuracy_assessment": ""
    }
    """,
    
    "fact_check": """
    核实文本中的关键事实:
    1. 提取事实性陈述
    2. 对比可靠来源
    3. 标注真实性评级
    输出JSON格式：
    {
        "claims_identified": [],
        "verification_results": [],
        "overall_accuracy": ""
    }
    """,
    
    "exaggeration_check": """
    检查夸大或误导性表述:
    1. 识别可疑表述
    2. 评估偏差程度
    3. 提供准确说法
    输出JSON格式：
    {
        "suspicious_claims": [],
        "corrections": [],
        "severity_level": ""
    }
    """
}
```

### 业务流程设计
```mermaid
sequenceDiagram
    participant U as 用户输入
    participant C as 缓存检查
    participant F as 内容获取
    participant A as AI分析
    participant R as 结果生成
    
    U->>F: 提供URL
    F->>F: 验证URL
    F->>F: 抓取内容
    F->>C: 生成内容哈希
    C->>C: 检查缓存
    alt 缓存命中
        C->>R: 返回缓存结果
    else 缓存未命中
        C->>A: 请求AI分析
        A->>A: 多维度分析
        A->>C: 存储结果
        A->>R: 返回分析结果
    end
    R->>U: 展示报告
```

## 后端API设计（前端抓取方案）

### 接口规范调整
```javascript
POST /api/v1/verify
Headers: 
  Authorization: Bearer <API_KEY>
  Content-Type: application/json

Body:
{
  "content": "已清洗的文本内容",  // 由扩展前端提供
  "lang": "zh",                // 语言代码
  "content_hash": "a1b2c3d4"    // 前端生成的内容哈希
}

Response:
{
  "status": "valid|invalid|pending",
  "verification_id": "xxx",     // 核查任务ID
  "score": 78,                 // 实时/缓存分数
  "flags": ["unverified_source", "data_conflict"]
}
```


## 5. Chrome扩展模块

### 功能概述
Chrome扩展作为用户的主要交互入口，可以直接对当前浏览的网页进行事实核查，提供即时的可信度评估。

### 核心工作流程
```mermaid
flowchart TD
    A[点击扩展图标] --> B[抓取页面内容]
    B --> C{内容校验}
    C -->|有效内容| D[调用验证API]
    C -->|无效内容| E[显示错误提示]
    D --> F[展示核查结果]
```

### 扩展架构
```mermaid
graph TB
    P[Popup界面] --> |用户交互| B[Background Service]
    B --> |消息传递| C[Content Script]
    C --> |内容抓取| W[Web页面]
    B --> |API调用| S[后端服务]
    S --> |返回分析| B
    B --> |更新UI| P
```

### 组件设计

#### Background Service Worker
```javascript
// 主要职责
- 标签页状态管理
- 内容分析请求处理
- 缓存管理
- 与Content Script通信
- 徽章状态更新

// 核心功能接口
async function analyzePage(tabId, url) 
async function getPageContent(tabId)
async function showSummary(tabId, result)
```

#### Content Script
```javascript
// 主要职责
- 页面内容提取
- 文本清洗
- 与Background通信

// 核心功能
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    const content = document.body ? document.body.innerText : '';
    sendResponse({ content });
  }
  return true;
})
```

#### Popup界面
```javascript
// 主要职责
- 显示分析结果
- 用户交互处理
- 错误状态显示

// 核心功能
function updateResultUI(result) {
  // 更新分数显示
  // 更新各维度评级
  // 更新摘要和来源
}
```

### 数据结构与接口

#### 内部消息结构
```javascript
// Background到Content Script消息
{
  action: "getPageContent"
}

// Content Script响应
{
  content: "页面文本内容"
}

// 分析结果结构
{
  score: 75,  // 0-100整数
  flags: {
    factuality: "高/中/低",
    objectivity: "高/中/低", 
    reliability: "高/中/低",
    bias: "高/中/低"
  },
  summary: "内容摘要",
  sources: [
    {
      title: "来源标题",
      url: "来源URL"
    }
  ]
}
```

#### 与后端API的通信接口
如果使用内置API：
```javascript
// 发送请求
async function analyzeWithAPI(content, url) {
  const response = await fetch('https://api.factchecker.com/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      content: content,
      url: url,
      lang: 'zh'
    })
  });
  
  return await response.json();
}
```

如果使用本地分析（当前使用的模拟数据方式）：
```javascript
// 本地分析函数
function generateAnalysisResult(content, url) {
  // 基于内容生成确定性哈希
  const hash = hashString(content);
  const score = hash % 100;
  
  // 根据分数确定各维度评级
  return {
    score: score,
    flags: {
      factuality: getLevelByScore(score),
      objectivity: getLevelByScore(score),
      reliability: getLevelByScore(score),
      bias: getLevelByScore(100 - score)
    },
    summary: `这是对内容的分析摘要...`,
    sources: [{ title: "示例来源", url: url }]
  };
}
```

### 用户界面设计

#### 弹出窗口布局
```html
<div class="popup-container">
  <header class="popup-header">
    <img src="icons/icon48.svg" alt="Logo" class="logo">
    <h1>Oracle AI Fact Checker</h1>
  </header>
  
  <div class="score-section">
    <div class="score-display" id="score">分数: 75</div>
  </div>
  
  <div class="analysis-section" id="flags">
    <h3>分析指标</h3>
    <ul>
      <li>事实性: 高</li>
      <li>客观性: 中</li>
      <li>可靠性: 高</li>
      <li>偏见性: 低</li>
    </ul>
  </div>
  
  <div class="summary-section" id="summary">
    <h3>摘要</h3>
    <p>这是对内容的分析摘要...</p>
  </div>
  
  <div class="sources-section" id="sources">
    <h3>来源</h3>
    <ul>
      <li><a href="#" target="_blank">示例来源</a></li>
    </ul>
  </div>
  
  <footer class="popup-footer">
    <p>Powered by Google Gemini AI</p>
  </footer>
</div>
```

### 扩展配置

#### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Oracle AI Fact Checker",
  "version": "1.0.0",
  "description": "使用 Google Gemini AI 进行网页内容事实核查",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.svg",
      "48": "icons/icon48.svg",
      "128": "icons/icon128.svg"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.svg",
    "48": "icons/icon48.svg",
    "128": "icons/icon128.svg"
  }
}
```

### 部署和打包

#### 构建流程
```bash
# 安装依赖
npm install

# 开发构建
npm run watch

# 生产构建
npm run build
```

#### 发布清单
1. manifest.json
2. 构建后的JS文件 (background.js, content.js, popup.js)
3. HTML/CSS文件 (popup.html, popup.css)
4. 图标资源 (icons/*.svg)
5. 依赖库 (如果需要)
```

### 前端渲染最佳实践
```typescript
// 结果渲染前的清理函数
function clearPreviousResults() {
    const sections = [
        'source-verification',
        'entity-verification',
        'fact-check',
        'exaggeration-check'
    ];
    
    sections.forEach(section => {
        const element = document.querySelector(`.${section}`);
        if (element) {
            element.innerHTML = '';
        }
    });
}

// 结果数组渲染函数
function renderArrayResults(container: HTMLElement, items: string[], results: string[]) {
    container.innerHTML = ''; // 清空容器
    if (!Array.isArray(items) || !Array.isArray(results)) {
        console.error('Invalid data format:', { items, results });
        return;
    }
    
    items.forEach((item, index) => {
        const result = results[index] || '未知结果';
        const itemElement = document.createElement('div');
        itemElement.className = 'result-item';
        itemElement.innerHTML = `
            <div class="item-content">${item}</div>
            <div class="item-result">${result}</div>
        `;
        container.appendChild(itemElement);
    });
}

// 实体验证渲染函数
function renderEntityVerification(data: EntityVerification) {
    const container = document.querySelector('.entity-verification');
    if (!container) return;
    
    clearSection(container);
    
    if (!data.entities_found?.length) {
        container.innerHTML = '<p>未发现需要验证的实体</p>';
        return;
    }
    
    const entitiesHtml = data.entities_found.map((entity, index) => `
        <div class="entity-item">
            <div class="entity-name">${entity}</div>
            <div class="entity-accuracy">${data.accuracy_assessment}</div>
            <div class="entity-correction">${data.corrections[index] || '无需更正'}</div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <h3>实体验证</h3>
        ${entitiesHtml}
    `;
}

// 事实核查渲染函数
function renderFactCheck(data: FactCheck) {
    const container = document.querySelector('.fact-check');
    if (!container) return;
    
    clearSection(container);
    
    if (!data.claims_identified?.length) {
        container.innerHTML = '<p>未发现需要核查的事实声明</p>';
        return;
    }
    
    const factsHtml = data.claims_identified.map((claim, index) => `
        <div class="fact-item">
            <div class="fact-claim">${claim}</div>
            <div class="fact-result">${data.verification_results[index] || '验证结果待更新'}</div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <h3>事实核查</h3>
        <div class="overall-accuracy">整体准确性：${data.overall_factual_accuracy}</div>
        ${factsHtml}
    `;
}

// 夸张表述渲染函数
function renderExaggerationCheck(data: ExaggerationCheck) {
    const container = document.querySelector('.exaggeration-check');
    if (!container) return;
    
    clearSection(container);
    
    if (!data.exaggerations_found?.length) {
        container.innerHTML = '<p>未发现夸张表述</p>';
        return;
    }
    
    const exaggerationsHtml = data.exaggerations_found.map((exaggeration, index) => `
        <div class="exaggeration-item">
            <div class="exaggeration-claim">${exaggeration}</div>
            <div class="exaggeration-correction">${data.corrections[index] || '修正建议待更新'}</div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <h3>夸张表述检查</h3>
        <div class="severity-assessment">严重程度：${data.severity_assessment}</div>
        ${exaggerationsHtml}
    `;
}

// 主渲染函数
function updateDetailsDisplay(result: ApiResponse) {
    if (result.status === 'error') {
        showError(result.error.message);
        return;
    }

    const data = result.data;
    if (!data) {
        showError('返回数据格式错误');
        return;
    }

    // 清空所有之前的结果
    clearPreviousResults();
    
    // 更新基础信息
    updateScore(data.score);
    updateFlags(data.flags);
    
    // 更新各个分析模块
    renderEntityVerification(data.entity_verification);
    renderFactCheck(data.fact_check);
    renderExaggerationCheck(data.exaggeration_check);
    
    // 更新摘要和来源
    updateSummary(data.summary);
    updateSources(data.sources);
}

// 错误处理和数据验证
interface ValidationResult {
    isValid: boolean;
    error?: string;
}

function validateApiResponse(data: any): ValidationResult {
    if (!data) {
        return { isValid: false, error: '响应数据为空' };
    }

    const requiredArrays = {
        'entity_verification': ['entities_found', 'corrections'],
        'fact_check': ['claims_identified', 'verification_results'],
        'exaggeration_check': ['exaggerations_found', 'corrections']
    };

    for (const [section, fields] of Object.entries(requiredArrays)) {
        if (!data[section]) {
            return { isValid: false, error: `
```