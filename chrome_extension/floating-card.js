// 语言检测功能
function detectUserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}

// 文本资源字典
const i18n = {
  zh: {
    loadingText: "正在核查...",
    factCheckReport: "事实核查报告",
    trustedFriend: "作为您信任的朋友",
    trustScore: "可信度评分",
    summary: "总结",
    infoEvaluation: "信息评估指标",
    sourceEvaluation: "信息来源评估",
    factChecking: "事实核查",
    exaggerationCheck: "夸张信息检查",
    entityVerification: "实体验证",
    showMoreEntities: "显示更多实体 >",
    hideEntities: "< 收起实体",
    factuality: "真实性",
    objectivity: "客观性",
    reliability: "可靠性",
    bias: "偏见度",
    noSourcesFound: "未找到相关信息来源",
    noFactsToCheck: "未发现需要核查的主要事实声明",
    noEntitiesFound: "未发现需要验证的实体",
    errorMessage: "分析过程中出现错误，请重试。",
    retry: "重新核查",
    analyzing: "正在核查..."
  },
  en: {
    loadingText: "Analyzing...",
    factCheckReport: "Fact Check Report",
    trustedFriend: "As your trusted friend",
    trustScore: "Trust Score",
    summary: "Summary",
    infoEvaluation: "Information Evaluation",
    sourceEvaluation: "Source Evaluation",
    factChecking: "Fact Checking",
    exaggerationCheck: "Exaggeration Check",
    entityVerification: "Entity Verification",
    showMoreEntities: "Show more entities >",
    hideEntities: "< Hide entities",
    factuality: "Factuality",
    objectivity: "Objectivity",
    reliability: "Reliability",
    bias: "Bias",
    noSourcesFound: "No related sources found",
    noFactsToCheck: "No major factual claims to check",
    noEntitiesFound: "No entities to verify",
    errorMessage: "An error occurred during analysis. Please try again.",
    retry: "Retry",
    analyzing: "Analyzing..."
  }
};

// 获取用户语言的翻译文本
function getText(key) {
  const lang = detectUserLanguage();
  return (i18n[lang] && i18n[lang][key]) || key;
}

// 状态管理
let cardState = 'loading'; // loading, result, error

// 初始化浮动卡片
function initializeFloatingCard() {
  // 获取DOM元素
  const loadingState = document.getElementById('loading-state');
  const resultState = document.getElementById('result-state');
  const errorState = document.getElementById('error-state');
  const closeBtn = document.getElementById('close-btn');
  const closeBtnError = document.getElementById('close-btn-error');
  const retryBtn = document.getElementById('retry-btn');
  
  console.log('事实核查卡片已初始化');

  // 应用语言本地化
  applyLanguageTexts();

  // 设置卡片状态
  function setCardState(state) {
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    resultState.style.display = state === 'result' ? 'block' : 'none';
    errorState.style.display = state === 'error' ? 'block' : 'none';
  }

  // 监听消息
  window.addEventListener('message', (event) => {
    console.log('收到消息:', event.data);

    if (event.data.type === 'UPDATE_RESULT') {
      const result = event.data.data;
      console.log('更新结果:', result);

      if (result) {
        // 设置评分和进度环
        setScoreProgress(result.score);
        // 生成结果内容
        document.getElementById('result-content').innerHTML = createResultContent(result);
        // 绑定显示更多实体的点击事件
        bindEntitiesToggle();
        // 显示结果状态
        setCardState('result');
        // 调整卡片高度
        adjustCardHeight();
      } else {
        console.error('未提供结果数据');
        showError('结果数据无效');
      }
    }
  });

  // 显示错误
  function showError(message) {
    document.getElementById('error-message').textContent = message || getText('errorMessage');
    setCardState('error');
  }

  // 关闭按钮事件
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
    });
  }

  if (closeBtnError) {
    closeBtnError.addEventListener('click', () => {
      window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
    });
  }

  // 重试按钮事件
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      setCardState('loading');
      window.parent.postMessage({ type: 'RETRY_ANALYSIS' }, '*');
    });
  }

  // 设置评分进度环
  function setScoreProgress(score) {
    const circle = document.getElementById('score-circle');
    const scoreValue = document.getElementById('score-value');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // 设置颜色
    let color;
    if (score >= 80) {
      color = 'var(--success)';
    } else if (score >= 60) {
      color = 'var(--primary)';
    } else if (score >= 40) {
      color = 'var(--warning)';
    } else {
      color = 'var(--danger)';
    }
    
    circle.style.stroke = color;
    scoreValue.textContent = score;
    scoreValue.style.color = color;
  }

  // 绑定显示更多实体的点击事件
  function bindEntitiesToggle() {
    const toggleBtn = document.getElementById('entities-toggle');
    if (toggleBtn) {
      const hiddenEntities = document.getElementById('entities-hidden');
      let entitiesShown = false;
      
      toggleBtn.addEventListener('click', () => {
        if (entitiesShown) {
          hiddenEntities.classList.add('entities-hidden');
          toggleBtn.textContent = getText('showMoreEntities');
        } else {
          hiddenEntities.classList.remove('entities-hidden');
          toggleBtn.textContent = getText('hideEntities');
        }
        entitiesShown = !entitiesShown;
      });
    }
  }

  // 创建结果内容
  function createResultContent(result) {
    if (!result) return '';
    
    // 设置顶部摘要
    const summaryPreview = document.getElementById('summary-preview');
    if (summaryPreview) {
      summaryPreview.textContent = result.summary || getText('noSummary');
    }
    
    // 评级映射函数
    const getRatingClass = (value) => {
      if (value === '高') return 'rating-high';
      if (value === '中') return 'rating-medium';
      return 'rating-low';
    };

    // 获取图标映射
    const getFlagIcon = (key) => {
      const icons = {
        factuality: 'fa-check-circle',
        objectivity: 'fa-balance-scale',
        reliability: 'fa-shield-alt',
        bias: 'fa-random'
      };
      return icons[key] || 'fa-flag';
    };

    // 获取标签名称
    const getFlagLabel = (key) => ({
      factuality: getText('factuality'),
      objectivity: getText('objectivity'),
      reliability: getText('reliability'),
      bias: getText('bias')
    })[key] || key;

    // 创建评估指标
    const flagsHTML = Object.entries(result.flags || {}).map(([key, value]) => `
      <div class="flag-item">
        <div class="flag-icon ${getRatingClass(value)}">
          <i class="fas ${getFlagIcon(key)}"></i>
        </div>
        <div class="flag-title">${getFlagLabel(key)}</div>
        <div class="flag-value">${value}</div>
      </div>
    `).join('');

    // 创建来源标签
    const sourcesHTML = (result.source_verification?.sources_found || []).map((source, index) => `
      <div class="source-tag">
        <span class="source-credibility">${result.source_verification.credibility_scores[index]}</span>
        ${source}
      </div>
    `).join('');

    // 创建事实检查项
    const factChecksHTML = (result.fact_check?.claims_identified || []).map((claim, index) => `
      <div class="fact-item">
        <div class="fact-content">${claim}</div>
        <div class="fact-status">${result.fact_check.verification_results[index] || '需要核实'}</div>
      </div>
    `).join('');

    // 创建夸张信息项
    const exaggerationsHTML = (result.exaggeration_check?.exaggerations_found || []).map((exaggeration, index) => `
      <div class="exaggeration-item">
        <div class="exaggeration-claim">${exaggeration}</div>
        <div class="exaggeration-correction">${result.exaggeration_check.corrections[index] || '需要更准确的表述'}</div>
      </div>
    `).join('');

    // 创建实体标签
    const entities = result.entity_verification?.entities_found || [];
    let entitiesHTML = '';
    
    if (entities.length > 0) {
      const previewEntities = entities.slice(0, Math.min(10, entities.length));
      const hiddenEntities = entities.length > 10 ? entities.slice(10) : [];
      
      const previewHTML = previewEntities.map(entity => `
        <div class="entity-tag">${entity}</div>
      `).join('');
      
      let hiddenHTML = '';
      if (hiddenEntities.length > 0) {
        hiddenHTML = `
          <span class="entities-toggle" id="entities-toggle">${getText('showMoreEntities')}</span>
          <div class="entities-container entities-hidden" id="entities-hidden">
            ${hiddenEntities.map(entity => `<div class="entity-tag">${entity}</div>`).join('')}
          </div>
        `;
      }
      
      entitiesHTML = `
        <div class="entities-container" id="entities-preview">
          ${previewHTML}
        </div>
        ${hiddenHTML}
      `;
    } else {
      entitiesHTML = `<p>${getText('noEntitiesFound')}</p>`;
    }

    return `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-flag"></i>
          <span data-i18n="infoEvaluation">${getText('infoEvaluation')}</span>
        </h2>
        <div class="flags-container">
          ${flagsHTML}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-link"></i>
          ${getText('sourceEvaluation')}
        </h2>
        <div class="sources-list">
          ${sourcesHTML || `<p>${getText('noSourcesFound')}</p>`}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-search"></i>
          ${getText('factChecking')}
        </h2>
        <div class="facts-container">
          ${factChecksHTML || `<p>${getText('noFactsToCheck')}</p>`}
        </div>
      </div>
      
      ${result.exaggeration_check?.exaggerations_found?.length > 0 ? `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-exclamation-triangle"></i>
          ${getText('exaggerationCheck')}
        </h2>
        <div class="exaggerations-container">
          ${exaggerationsHTML}
        </div>
      </div>
      ` : ''}
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-user-tag"></i>
          ${getText('entityVerification')}
        </h2>
        ${entitiesHTML}
      </div>
    `;
  }

  // 应用语言本地化到所有静态UI元素
  function applyLanguageTexts() {
    // 设置加载状态文本
    document.querySelector('.loading-text').textContent = getText('loadingText');
    
    // 设置标题文本
    document.querySelector('.card-header h1').textContent = getText('factCheckReport');
    
    // 设置标签页标题
    document.title = getText('factCheckReport');
    
    // 设置所有分类标题
    const sectionTitles = {
      'Information Evaluation': 'infoEvaluation',
      'Source Evaluation': 'sourceEvaluation',
      'Fact Checking': 'factChecking'
    };
    
    // 查找并替换英文标题为当前语言
    for (const [englishTitle, i18nKey] of Object.entries(sectionTitles)) {
      const elements = document.querySelectorAll(`h2:contains('${englishTitle}'), h3:contains('${englishTitle}')`);
      elements.forEach(el => {
        el.textContent = getText(i18nKey);
      });
    }
    
    // 其他所有标签
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = getText(key);
    });
  }

  // 调整卡片高度
  function adjustCardHeight() {
    console.log('调整卡片为结果状态尺寸：400x600');
    
    // 固定使用400x600的尺寸
    window.parent.postMessage({
      type: 'RESIZE_FRAME',
      width: 400,
      height: 600
    }, '*');
    
    // 添加额外的滚动容器处理
    const cardBody = document.getElementById('result-content');
    if (cardBody) {
      // 确保高度计算正确，强制设置样式
      setTimeout(() => {
        cardBody.style.maxHeight = '460px';
        cardBody.style.overflowY = 'auto';
        
        // 检查内容高度是否超过容器
        if (cardBody.scrollHeight > cardBody.clientHeight) {
          console.log('内容需要滚动，高度:', cardBody.scrollHeight);
          // 强制更新滚动状态
          cardBody.scrollTop = 1;
          cardBody.scrollTop = 0;
        }
      }, 100);
    }
  }

  // 初始化为加载状态
  setCardState('loading');
  window.parent.postMessage({ type: 'CARD_READY' }, '*');
}

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingCard);
} else {
  initializeFloatingCard();
} 