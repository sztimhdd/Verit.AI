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
    document.getElementById('error-message').textContent = message || '分析过程中出现错误，请重试。';
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
          toggleBtn.textContent = '显示更多实体 >';
        } else {
          hiddenEntities.classList.remove('entities-hidden');
          toggleBtn.textContent = '< 收起实体';
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
      summaryPreview.textContent = result.summary || '无法提供内容总结';
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
      factuality: '真实性',
      objectivity: '客观性',
      reliability: '可靠性',
      bias: '偏见度'
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
          <span class="entities-toggle" id="entities-toggle">显示更多实体 ></span>
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
      entitiesHTML = '<p>未发现需要验证的实体</p>';
    }

    return `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-flag"></i>
          信息评估指标
        </h2>
        <div class="flags-container">
          ${flagsHTML}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-link"></i>
          信息来源评估
        </h2>
        <div class="sources-list">
          ${sourcesHTML || '<p>未找到相关信息来源</p>'}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-search"></i>
          事实核查
        </h2>
        <div class="facts-container">
          ${factChecksHTML || '<p>未发现需要核查的主要事实声明</p>'}
        </div>
      </div>
      
      ${result.exaggeration_check?.exaggerations_found?.length > 0 ? `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-exclamation-triangle"></i>
          夸张信息检查
        </h2>
        <div class="exaggerations-container">
          ${exaggerationsHTML}
        </div>
      </div>
      ` : ''}
      
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-user-tag"></i>
          实体验证
        </h2>
        ${entitiesHTML}
      </div>
    `;
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