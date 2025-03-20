# Oracle AI 辟谣助手 - PRD v2.0

## 项目定位
基于Gemini API的Web端辟谣系统，提供便捷的在线内容真实性验证服务

## 系统架构
```mermaid
graph TB
    A[Web前端] --> |HTTP请求| B[Node.js后端]
    B --> C[内容解析器]
    C --> D[缓存检查]
    D -->|新内容| E[Gemini API分析]
    E --> F[结果生成器]
    F --> G[HTML报告]
    F --> H[JSON响应]
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
POST /api/analyze
- 参数: { url, lang }
- 响应: {
    status: "success/error",
    data: {
      trustworthiness_score: number,
      analysis_results: object,
      debunking_card: string
    }
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
```json
"score_breakdown": {
    "sources_error": "来源可靠性扣分",
    "entities_error": "实体识别错误扣分",
    "data_error": "数据偏差扣分",
    "evidence_mismatch": "证据等级失配扣分",
    "stat_errors": "统计方法错误扣分",
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

主要流程步骤：
1. 接收URL输入
2. 验证URL合法性
3. 抓取网页内容
4. 生成内容哈希值
5. 检查结果缓存
6. 执行AI多维度分析
7. 缓存分析结果
8. 生成分析报告
9. 返回结果给用户

这些架构设计为Node.js后端实现提供了清晰的参考模型，特别是在：
- 模块化设计
- 数据结构定义
- Prompt模板管理
- 业务流程控制

等方面提供了具体的实现思路。