// 配置
const CONFIG = {
    API_URL: 'https://fact-checkerai.replit.app/api/extension/analyze'
};

// DOM 元素
const elements = {
    form: document.getElementById('urlForm'),
    urlInput: document.getElementById('urlInput'),
    loadingState: document.getElementById('loadingState'),
    resultCard: document.getElementById('resultCard'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage')
};

// 事件监听
elements.form.addEventListener('submit', handleSubmit);

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
        const response = await fetch(CONFIG.API_URL, {
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
            throw new Error(`API请求失败: ${response.status}`);
        }

        const result = await response.json();
        return result.data || result;
    } catch (error) {
        console.error('API调用失败:', error);
        throw new Error('分析服务暂时不可用');
    }
}

// UI 更新函数
function showLoading() {
    elements.loadingState.classList.remove('hidden');
    elements.resultCard.classList.add('hidden');
    elements.errorState.classList.add('hidden');
}

function hideLoading() {
    elements.loadingState.classList.add('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorState.classList.remove('hidden');
    elements.resultCard.classList.add('hidden');
}

function showResult(result) {
    const content = createResultContent(result);
    elements.resultCard.innerHTML = content;
    elements.resultCard.classList.remove('hidden');
    elements.errorState.classList.add('hidden');
}

// 结果内容生成
function createResultContent(result) {
    return `
        <div class="result-card">
            <div class="flex items-center justify-between mb-6">
                <div class="text-center">
                    <div class="text-4xl font-bold ${getScoreColor(result.score)}">${result.score}</div>
                    <div class="text-gray-600">总体可信度评分</div>
                </div>
            </div>

            <div class="space-y-6">
                <div class="flex flex-wrap gap-2">
                    ${Object.entries(result.flags).map(([key, value]) => `
                        <div class="tag" style="background: ${getLevelColor(value)}20; 
                                            color: ${getLevelColor(value)}; 
                                            border: 1px solid ${getLevelColor(value)}">
                            ${getTagLabel(key)}: ${value}
                        </div>
                    `).join('')}
                </div>

                <div>
                    <h3 class="text-lg font-semibold mb-2">内容摘要</h3>
                    <p class="text-gray-700">${result.summary}</p>
                </div>

                <div>
                    <h3 class="text-lg font-semibold mb-2">信息来源</h3>
                    <div class="space-y-2">
                        ${result.source_verification.sources_found.map((source, index) => `
                            <div class="source-item">
                                <span>${source}</span>
                                <span class="bg-green-100 text-green-800 px-2 py-1 rounded">
                                    ${result.source_verification.credibility_scores[index]}/10
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div>
                    <h3 class="text-lg font-semibold mb-2">事实核查</h3>
                    ${result.fact_check.claims_identified.map((claim, index) => `
                        <div class="fact-check-item">
                            <div class="font-medium">${claim}</div>
                            <div class="text-gray-600 mt-1">
                                ${result.fact_check.verification_results[index]}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${result.exaggeration_check.exaggerations_found.length > 0 ? `
                    <div>
                        <h3 class="text-lg font-semibold mb-2">夸张表述</h3>
                        ${result.exaggeration_check.exaggerations_found.map((exag, index) => `
                            <div class="exaggeration-item">
                                <div class="text-orange-800">原文：${exag}</div>
                                <div class="text-green-800 mt-1">
                                    建议：${result.exaggeration_check.corrections[index]}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// 辅助函数
function getScoreColor(score) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
}

function getLevelColor(level) {
    switch(level) {
        case '高': return '#4caf50';
        case '中': return '#ff9800';
        case '低': return '#f44336';
        default: return '#757575';
    }
}

function getTagLabel(key) {
    const labels = {
        factuality: '事实性',
        objectivity: '客观性',
        reliability: '可靠性',
        bias: '偏见性'
    };
    return labels[key] || key;
} 