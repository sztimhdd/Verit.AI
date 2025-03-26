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

class PopupManager {
  constructor() {
    this.state = {
      serviceStatus: 'initializing',
      isAnalyzing: false,
      lastError: null
    };
    
    this.i18n = new I18nManager();
    this.elements = this.getElements();
    
    this.checkServiceStatusThrottled = this.throttle(this.checkServiceStatus.bind(this), 5000);
    
    this.setupPerformanceMonitoring();
    
    this.initialize();
  }

  getElements() {
    return {
      statusIndicator: document.getElementById('statusIndicator'),
      statusIcon: document.querySelector('.status-icon'),
      statusText: document.querySelector('.status-text'),
      analyzeButton: document.getElementById('analyzeButton'),
      loadingIndicator: document.getElementById('loadingIndicator'),
      errorSection: document.getElementById('errorState'),
      errorMessage: document.getElementById('errorMessage'),
      retryButton: document.getElementById('retryButton')
    };
  }

  async initialize() {
    await this.i18n.initialize();
    this.setupEventListeners();
    this.checkServiceStatus();
  }

  setupEventListeners() {
    this.elements.analyzeButton.addEventListener('click', () => this.handleAnalyzeClick());
    this.elements.retryButton.addEventListener('click', () => this.handleRetry());
    
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'SERVICE_STATUS':
          this.updateServiceStatus(message.status);
          break;
        case 'ANALYSIS_COMPLETE':
          this.handleAnalysisComplete(message.result);
          break;
        case 'ANALYSIS_ERROR':
          this.handleAnalysisError(message.error);
          break;
      }
      return true;
    });
  }

  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }

  async checkServiceStatus() {
    try {
      const response = await fetch('http://localhost:4000/health');
      const data = await response.json();
      
      // 匹配后端返回的格式
      const statusMap = {
        'OK': 'ready',
        'ERROR': 'error',
        'INITIALIZING': 'initializing'
      };

      this.updateServiceStatus({
        status: statusMap[data.status] || 'error',
        ready: data.ready,
        quota: data.quota, // 新增配额信息显示
        timestamp: data.timestamp
      });
      
      // 如果有配额信息，更新UI
      if (data.quota) {
        this.updateQuotaDisplay(data.quota);
      }

    } catch (error) {
      this.updateServiceStatus({
        status: 'error',
        ready: false,
        error: error.message
      });
    }
  }

  updateServiceStatus(status) {
    this.state.serviceStatus = status;
    
    // 更新图标类名
    const iconClasses = {
      ready: 'fas fa-circle ready',
      initializing: 'fas fa-circle initializing',
      error: 'fas fa-circle error'
    };
    
    this.elements.statusIcon.className = iconClasses[status] || iconClasses.error;
    this.elements.statusText.textContent = this.i18n.getText(`serviceStatus.${status}`);
    this.elements.analyzeButton.disabled = status !== 'ready';
  }

  async handleAnalyzeClick() {
    if (this.state.isAnalyzing) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error(this.i18n.getText('errors.noActiveTab'));
      }

      this.setState({ isAnalyzing: true });
      this.showLoading();

      // 获取页面内容
      const content = await this.getPageContent(tab.id);
      
      // 调用分析API
      const response = await fetch('http://localhost:4000/api/extension/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          url: tab.url,
          lang: this.i18n.currentLang
        })
      });

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.error.message);
      }

      // 验证API返回的数据结构
      this.validateApiResponse(result.data);

      // 显示浮动卡片结果
      await chrome.runtime.sendMessage({
        action: 'SHOW_FLOATING_CARD',
        data: result.data
      });

      // 关闭popup
      window.close();

    } catch (error) {
      this.handleAnalysisError(error);
    }
  }

  validateApiResponse(data) {
    const requiredFields = [
      'score',
      'flags',
      'source_verification',
      'entity_verification',
      'fact_check',
      'exaggeration_check',
      'summary',
      'sources'
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 验证flags结构
    const requiredFlags = ['factuality', 'objectivity', 'reliability', 'bias'];
    for (const flag of requiredFlags) {
      if (!data.flags[flag]) {
        throw new Error(`Missing required flag: ${flag}`);
      }
      if (!['高', '中', '低'].includes(data.flags[flag])) {
        throw new Error(`Invalid flag value for ${flag}: ${data.flags[flag]}`);
      }
    }
  }

  handleAnalysisComplete(result) {
    this.setState({ isAnalyzing: false });
    // 结果会在浮动卡片中显示，这里可以关闭popup
    window.close();
  }

  async handleAnalysisError(error) {
    const errorTypes = {
      'CONTENT_ERROR': '内容获取失败',
      'API_ERROR': 'API调用失败',
      'PARSE_ERROR': '解析结果失败',
      'RENDER_ERROR': '显示结果失败',
      'SERVICE_UNAVAILABLE': '服务暂时不可用',
      'INITIALIZATION_TIMEOUT': '服务初始化超时',
      'NETWORK_ERROR': '网络连接错误'
    };

    let errorType = 'API_ERROR';
    let errorMessage = error.message;

    // 根据错误信息判断错误类型
    if (error.message.includes('content')) {
      errorType = 'CONTENT_ERROR';
    } else if (error.message.includes('parse')) {
      errorType = 'PARSE_ERROR';
    } else if (error.message.includes('service')) {
      errorType = 'SERVICE_UNAVAILABLE';
    } else if (error.message.includes('timeout')) {
      errorType = 'INITIALIZATION_TIMEOUT';
    } else if (error.message.includes('network')) {
      errorType = 'NETWORK_ERROR';
    }

    this.setState({
      isAnalyzing: false,
      lastError: {
        type: errorType,
        message: errorTypes[errorType],
        details: errorMessage
      }
    });

    this.showError(errorTypes[errorType]);
    
    // 记录错误
    console.error('[Popup Error]', {
      type: errorType,
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  handleRetry() {
    this.setState({ lastError: null });
    this.hideError();
    this.checkServiceStatus();
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.updateUI();
  }

  async updateUI() {
    performance.mark('ui-update-start');
    const { isAnalyzing, lastError } = this.state;
    
    this.elements.analyzeButton.disabled = isAnalyzing;
    this.elements.loadingIndicator.classList.toggle('hidden', !isAnalyzing);
    this.elements.errorSection.classList.toggle('hidden', !lastError);
    
    if (lastError) {
      this.elements.errorMessage.textContent = lastError.message;
    }
    performance.mark('ui-update-end');
    performance.measure('ui-update', 'ui-update-start', 'ui-update-end');
  }

  showLoading() {
    this.elements.loadingIndicator.classList.remove('hidden');
    this.elements.analyzeButton.disabled = true;
  }

  hideLoading() {
    this.elements.loadingIndicator.classList.add('hidden');
    this.elements.analyzeButton.disabled = false;
  }

  showError(message) {
    this.elements.errorSection.classList.remove('hidden');
    this.elements.errorMessage.textContent = message;
  }

  hideError() {
    this.elements.errorSection.classList.add('hidden');
  }

  setupPerformanceMonitoring() {
    // 监控UI渲染性能
    this.renderTimes = [];
    
    // 使用 Performance API 记录关键操作时间
    performance.mark('popup-init-start');
    
    window.addEventListener('load', () => {
      performance.mark('popup-init-end');
      performance.measure('popup-init', 'popup-init-start', 'popup-init-end');
    });
  }

  updateQuotaDisplay(quota) {
    // 添加配额信息显示
    const quotaInfo = document.createElement('div');
    quotaInfo.className = 'quota-info';
    quotaInfo.innerHTML = `
      <div class="quota-item">
        <i class="fas fa-search"></i>
        <span>Grounding: ${quota.grounding.remaining}/${quota.grounding.limit}</span>
      </div>
      <div class="quota-item">
        <i class="fas fa-bolt"></i>
        <span>Gemini 2.0: ${quota.gemini20.dailyUsage} tokens</span>
      </div>
    `;
    
    this.elements.statusIndicator.appendChild(quotaInfo);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});