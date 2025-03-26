// 配置
const CONFIG = {
    API_BASE_URL: 'http://localhost:4000'
};

// DOM 元素
const elements = {
    urlInput: document.getElementById('urlInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.querySelector('.error-message'),
    results: document.getElementById('results'),
    status: document.getElementById('status'),
    statusIndicator: document.querySelector('.status-indicator')
};

// 状态管理
const UIState = {
    setLoading(isLoading) {
        elements.loadingState.classList.toggle('hidden', !isLoading);
        elements.analyzeBtn.disabled = isLoading;
        elements.analyzeBtn.style.backgroundColor = isLoading ? '#cccccc' : '#4CAF50';
    },

    showError(message) {
        elements.errorState.classList.remove('hidden');
        elements.errorMessage.textContent = message;
        elements.results.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
    },

    showResult(result) {
        console.log('显示结果:', result);
        elements.results.classList.remove('hidden');
        elements.errorState.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
        displayResults(result);
    },

    updateServiceStatus(status) {
        const statusConfig = {
            'running': { text: '运行中', color: '#4CAF50', ready: true },
            'initializing': { text: '启动中', color: '#FFA726', ready: false },
            'error': { text: '错误', color: '#F44336', ready: false },
            'offline': { text: '离线', color: '#F44336', ready: false }
        };

        const config = statusConfig[status] || statusConfig.error;
        
        elements.status.textContent = `服务状态: ${config.text}`;
        elements.status.style.color = config.color;
        elements.statusIndicator.style.backgroundColor = config.color;
        elements.analyzeBtn.disabled = !config.ready;
        elements.analyzeBtn.style.backgroundColor = config.ready ? '#4CAF50' : '#cccccc';
        
        return config.ready;
    },

    reset() {
        elements.urlInput.value = '';
        elements.results.classList.add('hidden');
        elements.errorState.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
        elements.urlInput.focus();
    }
};

// API 服务
const APIService = {
    async checkHealth() {
        try {
            console.log(`[${new Date().toLocaleTimeString()}] 执行健康检查...`);
            const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
            const status = await response.json();
            return UIState.updateServiceStatus(status.ready ? 'running' : 'initializing');
        } catch (error) {
            console.error(`[${new Date().toLocaleTimeString()}] 健康检查失败:`, error);
            return UIState.updateServiceStatus('offline');
        }
    },

    async analyze(input) {
        const isUrl = input.startsWith('http://') || input.startsWith('https://');
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/extension/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: isUrl ? input : '',
                content: isUrl ? '' : input,
                lang: 'zh'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `请求失败: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'error') {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('返回数据格式错误');
        }

        return result.data;
    }
};

// 事件处理
async function handleAnalyzeClick() {
    const input = elements.urlInput.value.trim();
    
    if (!input) {
        UIState.showError('请输入网址或内容');
        return;
    }

    try {
        UIState.setLoading(true);
        const result = await APIService.analyze(input);
        UIState.showResult(result);
    } catch (error) {
        console.error('分析失败:', error);
        UIState.showError(error.message);
    } finally {
        UIState.setLoading(false);
    }
}

// 初始化
function initialize() {
    // 事件监听
    elements.analyzeBtn.addEventListener('click', handleAnalyzeClick);
    elements.clearBtn.addEventListener('click', UIState.reset);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAnalyzeClick();
    });

    // 添加状态样式
    const statusStyles = `
        .status-container {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            border-radius: 4px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 1000;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }

        .results-section {
            display: block;
            margin-top: 20px;
        }

        .result-container {
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = statusStyles;
    document.head.appendChild(styleSheet);

    // 初始健康检查
    APIService.checkHealth();
    
    // 修改为30秒执行一次健康检查
    setInterval(APIService.checkHealth, 30000); // 30000ms = 30秒
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initialize);

// 表单提交处理
async function handleSubmit(event) {
    event.preventDefault();
    const url = elements.urlInput.value.trim();
    
    if (!url) {
        showError('请输入有效的URL');
        return;
    }

    try {
        showLoading();
        const result = await analyzeUrl(url);
        showResult(result);
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// API 调用
async function analyzeUrl(url) {
    try {
        // 先检查服务是否就绪
        const healthCheck = await fetch(`${CONFIG.API_BASE_URL}/health`);
        const healthStatus = await healthCheck.json();
        
        if (!healthStatus.ready) {
            throw new Error('后端服务正在启动中，请稍后再试');
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/extension/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                lang: 'zh'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API请求失败: ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 'error') {
            throw new Error(result.error.message);
        }
        return result.data;
    } catch (error) {
        console.error('API调用失败:', error);
        throw new Error(error.message || '分析服务暂时不可用');
    }
}

// 修改分析函数
async function analyzeContent() {
    const content = document.getElementById('content').value;
    const url = document.getElementById('url').value;
    
    if (!content && !url) {
        showError('请输入内容或URL');
        return;
    }

    try {
        showLoading();
        
        // 检查后端服务是否就绪
        const healthCheck = await fetch(`${CONFIG.API_BASE_URL}/health`);
        const healthStatus = await healthCheck.json();
        
        if (!healthStatus.ready) {
            showError('后端服务正在启动中，请稍后再试');
            return;
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/extension/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                url,
                lang: 'zh' // 默认使用中文
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '分析请求失败');
        }

        const result = await response.json();
        
        if (result.status === 'error') {
            throw new Error(result.error.message);
        }

        displayResults(result.data);
        hideLoading();

    } catch (error) {
        console.error('Analysis failed:', error);
        showError(error.message);
        hideLoading();
    }
}

async function displayResults(data) {
    console.log('处理结果数据:', data);
    const resultsDiv = document.getElementById('results');
    
    // 清空现有结果
    resultsDiv.innerHTML = '';
    
    // 创建结果容器
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-container';
    
    // 不需要手动设置 display 属性
    // resultContainer.style.display = 'block';
    
    // 添加总体评分
    const scoreSection = document.createElement('div');
    scoreSection.className = 'score-section';
    scoreSection.innerHTML = `
        <div class="score-circle ${getScoreClass(data.score)}">
            <span class="score-number">${data.score}</span>
            <span class="score-label">可信度评分</span>
        </div>
    `;
    resultContainer.appendChild(scoreSection);

    // 添加标志指标
    const flagsSection = document.createElement('div');
    flagsSection.className = 'flags-section';
    flagsSection.innerHTML = `
        <h3>核心指标</h3>
        <div class="flags-grid">
            <div class="flag-item ${getLevelClass(data.flags.factuality)}">
                <span class="flag-label">事实性</span>
                <span class="flag-value">${data.flags.factuality}</span>
            </div>
            <div class="flag-item ${getLevelClass(data.flags.objectivity)}">
                <span class="flag-label">客观性</span>
                <span class="flag-value">${data.flags.objectivity}</span>
            </div>
            <div class="flag-item ${getLevelClass(data.flags.reliability)}">
                <span class="flag-label">可靠性</span>
                <span class="flag-value">${data.flags.reliability}</span>
            </div>
            <div class="flag-item ${getLevelClass(data.flags.bias)}">
                <span class="flag-label">偏见程度</span>
                <span class="flag-value">${data.flags.bias}</span>
            </div>
        </div>
    `;
    resultContainer.appendChild(flagsSection);

    // 添加摘要
    const summarySection = document.createElement('div');
    summarySection.className = 'summary-section';
    summarySection.innerHTML = `
        <h3>总体评估</h3>
        <p class="summary-text">${data.summary}</p>
    `;
    resultContainer.appendChild(summarySection);

    // 添加关键问题
    if (data.key_issues && data.key_issues.length > 0) {
        const issuesSection = document.createElement('div');
        issuesSection.className = 'issues-section';
        issuesSection.innerHTML = `
            <h3>主要问题</h3>
            <ul class="issues-list">
                ${data.key_issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
        `;
        resultContainer.appendChild(issuesSection);
    }

    // 添加详细分析结果
    const detailsSection = document.createElement('div');
    detailsSection.className = 'details-section';
    
    // 源验证
    const sourceVerification = `
        <div class="detail-card">
            <h3>信息来源验证</h3>
            <div class="detail-content">
                <p><strong>总体可信度：</strong>${data.source_verification.overall_source_credibility}</p>
                ${data.source_verification.sources_found.length > 0 ? `
                    <div class="sources-list">
                        <h4>发现的来源：</h4>
                        <ul>
                            ${data.source_verification.sources_found.map((source, index) => `
                                <li>
                                    ${source}
                                    <span class="credibility-score">
                                        (可信度: ${data.source_verification.credibility_scores[index]}/10)
                                    </span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="verification-details">
                    <h4>验证详情：</h4>
                    <ul>
                        ${data.source_verification.verification_details.map(detail => `
                            <li>${detail}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    // 实体验证
    const entityVerification = `
        <div class="detail-card">
            <h3>实体信息验证</h3>
            <div class="detail-content">
                <p><strong>准确性评估：</strong>${data.entity_verification.accuracy_assessment}</p>
                ${data.entity_verification.entities_found.length > 0 ? `
                    <div class="entities-list">
                        <h4>发现的实体：</h4>
                        <ul>
                            ${data.entity_verification.entities_found.map(entity => `
                                <li>${entity}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="verification-details">
                    <h4>验证详情：</h4>
                    <ul>
                        ${data.entity_verification.verification_details.map(detail => `
                            <li>${detail}</li>
                        `).join('')}
                    </ul>
                </div>
                ${data.entity_verification.corrections.length > 0 ? `
                    <div class="corrections">
                        <h4>需要更正：</h4>
                        <ul>
                            ${data.entity_verification.corrections.map(correction => `
                                <li>${correction}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // 事实核查
    const factCheck = `
        <div class="detail-card">
            <h3>事实核查</h3>
            <div class="detail-content">
                <p><strong>总体事实准确性：</strong>${data.fact_check.overall_factual_accuracy}</p>
                <div class="claims-section">
                    <h4>主要论述核查：</h4>
                    ${data.fact_check.claims_identified.map((claim, index) => `
                        <div class="claim-item">
                            <p class="claim-text">${claim}</p>
                            <p class="verification-result">${data.fact_check.verification_results[index]}</p>
                            ${data.fact_check.supporting_evidence[index] ? `
                                <p class="supporting-evidence">证据：${data.fact_check.supporting_evidence[index]}</p>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // 夸大检查
    const exaggerationCheck = `
        <div class="detail-card">
            <h3>夸大检查</h3>
            <div class="detail-content">
                <p><strong>夸大程度评估：</strong>${data.exaggeration_check.severity_assessment}</p>
                ${data.exaggeration_check.exaggerations_found.length > 0 ? `
                    <div class="exaggerations-list">
                        ${data.exaggeration_check.exaggerations_found.map((exaggeration, index) => `
                            <div class="exaggeration-item">
                                <p class="exaggeration-text">夸大表述：${exaggeration}</p>
                                <p class="explanation">解释：${data.exaggeration_check.explanations[index]}</p>
                                <p class="correction">更准确的表述：${data.exaggeration_check.corrections[index]}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>未发现明显夸大表述。</p>'}
            </div>
        </div>
    `;

    // 参考来源
    const sources = `
        <div class="detail-card">
            <h3>参考来源</h3>
            <div class="detail-content">
                <div class="sources-grid">
                    ${data.sources.map(source => `
                        <div class="source-item">
                            <span class="source-title">${source.title}</span>
                            <a href="${source.url}" target="_blank" rel="noopener noreferrer">查看来源</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    detailsSection.innerHTML = sourceVerification + entityVerification + factCheck + exaggerationCheck + sources;
    resultContainer.appendChild(detailsSection);

    // 将结果添加到页面
    resultsDiv.appendChild(resultContainer);
}

// 辅助函数
function getScoreClass(score) {
    if (score >= 80) return 'high-score';
    if (score >= 60) return 'medium-score';
    return 'low-score';
}

function getLevelClass(level) {
    switch(level.toLowerCase()) {
        case '高':
        case 'high':
            return 'level-high';
        case '中':
        case 'medium':
            return 'level-medium';
        case '低':
        case 'low':
            return 'level-low';
        default:
            return '';
    }
}