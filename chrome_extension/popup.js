// 状态管理
function showLoading() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('resultState').style.display = 'none';
}

function showError(message) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('resultState').style.display = 'none';
  document.getElementById('errorMessage').textContent = `🚫 ${message}`;
}

function showResults() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('resultState').style.display = 'block';
}

// 获取评分等级
function getScoreLevel(score) {
  if (score >= 80) return { class: 'safe', text: '可信' };
  if (score >= 60) return { class: 'warning', text: '需要核实' };
  return { class: 'critical', text: '低可信度' };
}

// 获取指标样式
function getSeverityClass(value) {
  switch(value.toLowerCase()) {
    case '高': return 'severity-low';
    case '中': return 'severity-medium';
    case '低': return 'severity-critical';
    default: return 'severity-medium';
  }
}

// 渲染分析结果
function renderAnalysisResult(result) {
  if (result.status === 'error') {
    showError(result.error.message);
    return;
  }

  const data = result.data;
  
  // 更新头部状态
  const scoreLevel = getScoreLevel(data.score);
  const headerIcon = document.getElementById('headerIcon');
  headerIcon.className = `header-icon ${scoreLevel.class}`;
  document.getElementById('headerTitle').textContent = `内容可信度${scoreLevel.text}！`;
  document.getElementById('headerSubtitle').textContent = 
    scoreLevel.class === 'critical' ? '请注意核实以下问题。' : '查看详细分析报告。';

  // 更新主分数
  document.getElementById('mainScore').textContent = data.score;
  
  // 更新指标
  const indicators = {
    'factualityIndicator': data.flags.factuality,
    'objectivityIndicator': data.flags.objectivity,
    'reliabilityIndicator': data.flags.reliability,
    'biasIndicator': data.flags.bias
  };

  for (const [id, value] of Object.entries(indicators)) {
    const element = document.getElementById(id);
    element.className = `severity-item ${getSeverityClass(value)}`;
    element.querySelector('.indicator-value').textContent = value;
  }

  // 更新来源验证
  const sourcesList = document.getElementById('sourcesList');
  sourcesList.innerHTML = data.source_verification.sources_found
    .map((source, index) => `
      <div class="analysis-list-item">
        <div class="source-item">
          <div class="source-name">${source}</div>
          <div class="source-score">
            <span class="status-tag ${getScoreLevel(data.source_verification.credibility_scores[index] * 10).class}">
              可信度: ${data.source_verification.credibility_scores[index]}/10
            </span>
          </div>
        </div>
      </div>
    `).join('');

  // 更新来源可信度进度条
  const credibilityScore = data.source_verification.credibility_scores.reduce((a, b) => a + b, 0) / 
    data.source_verification.credibility_scores.length;
  document.getElementById('sourceCredibilityBar').style.width = `${credibilityScore * 10}%`;

  // 更新事实核查
  const claimsList = document.getElementById('claimsList');
  claimsList.innerHTML = data.fact_check.claims_identified
    .map((claim, index) => `
      <div class="analysis-list-item">
        <div class="claim-content">${claim}</div>
        <div class="claim-verification">
          <span class="status-tag ${getSeverityClass(data.fact_check.verification_results[index])}">
            ${data.fact_check.verification_results[index]}
          </span>
        </div>
      </div>
    `).join('');

  // 更新内容摘要
  document.getElementById('contentSummary').textContent = data.summary;

  // 更新参考来源
  const referencesList = document.getElementById('referencesList');
  referencesList.innerHTML = data.sources
    .map(source => `
      <li class="analysis-list-item">
        <a href="${source.url}" target="_blank" rel="noopener noreferrer">
          ${source.title}
        </a>
      </li>
    `).join('');

  showResults();
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  showLoading();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('无法获取当前标签页信息');
    }

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'analysisComplete') {
        renderAnalysisResult(message.data);
      } else if (message.type === 'analysisError') {
        showError(message.error);
      }
      return true;
    });

    // 触发分析
    await chrome.runtime.sendMessage({
      action: 'analyze',
      tabId: tab.id,
      url: tab.url
    });

  } catch (error) {
    showError(error.message);
  }
});

// 重试按钮事件处理
document.getElementById('retryButton').addEventListener('click', () => {
  location.reload();
});