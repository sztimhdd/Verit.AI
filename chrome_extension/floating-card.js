// 状态管理
let cardState = 'loading'; // loading, result, error

// 初始化浮动卡片
function initializeFloatingCard() {
  const card = document.querySelector('.floating-card');
  const resultState = document.getElementById('result-state');
  const errorState = document.getElementById('error-state');
  const loadingSpinner = document.querySelector('.spinner');
  const headerText = document.querySelector('.header-text');
  const closeBtn = document.getElementById('close-btn');
  const retryBtn = document.getElementById('retry-btn');
  const cardContent = document.querySelector('.card-content');

  console.log('Floating card initialized');

  // 监听消息
  window.addEventListener('message', (event) => {
    console.log('Floating card received message:', event.data);

    if (event.data.type === 'UPDATE_RESULT') {
      const result = event.data.data;
      console.log('Updating result:', result);

      try {
        // 更新加载状态
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (headerText) headerText.textContent = '核查完成';
        
        // 显示结果
        if (resultState && cardContent) {
          // 显示卡片内容容器
          cardContent.style.display = 'block';
          
          // 生成并显示结果内容
          resultState.innerHTML = createResultContent(result);
          resultState.style.display = 'block';
          
          // 隐藏错误状态
          if (errorState) {
            errorState.style.display = 'none';
          }

          // 更新卡片状态
          card.className = 'floating-card completed';

          // 调整卡片大小
          window.parent.postMessage({
            type: 'RESIZE_FRAME',
            width: 360,
            height: 500
          }, '*');
        } else {
          console.error('Required elements not found:', { resultState, cardContent });
        }
      } catch (error) {
        console.error('Error updating result:', error);
        showError('更新结果时发生错误');
      }
    }
  });

  // 关闭按钮事件
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
    });
  }

  // 重试按钮事件
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (loadingSpinner) loadingSpinner.style.display = 'block';
      if (headerText) headerText.textContent = '正在核查...';
      if (resultState) resultState.style.display = 'none';
      if (errorState) errorState.style.display = 'none';
      if (card) card.className = 'floating-card processing';
      
      window.parent.postMessage({ type: 'RETRY_ANALYSIS' }, '*');
    });
  }

  function showError(message) {
    if (errorState) {
      const errorMessage = errorState.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = message;
      }
      errorState.style.display = 'block';
      if (resultState) {
        resultState.style.display = 'none';
      }
    }
  }

  function createResultContent(result) {
    if (!result) {
      console.error('No result data provided');
      return '';
    }

    console.log('Creating result content with:', result);

    return `
      <div class="score-summary">
        <div class="score-number">${result.score}</div>
        <div class="score-label">总体可信度评分</div>
      </div>
      
      <div class="analysis-details">
        <div class="tags-container">
          ${Object.entries(result.flags).map(([key, value]) => `
            <div class="tag" style="background: ${getLevelColor(value)}20; 
                                  color: ${getLevelColor(value)}; 
                                  border: 1px solid ${getLevelColor(value)}">
              ${getTagLabel(key)}: ${value}
            </div>
          `).join('')}
        </div>

        <div class="summary-section">
          <h4>内容摘要</h4>
          <p>${result.summary}</p>
        </div>

        <div class="sources-section">
          <h4>信息来源 (整体可信度: ${result.source_verification.overall_source_credibility})</h4>
          <div class="sources-list">
            ${result.source_verification.sources_found.map((source, index) => `
              <div class="source-item">
                <span class="source-name">${source}</span>
                <span class="source-score">${result.source_verification.credibility_scores[index]}/10</span>
              </div>
            `).join('')}
            ${result.sources.length > 0 ? `
              <div style="margin-top: 12px;">
                <h5>参考来源</h5>
                ${result.sources.map(source => `
                  <div class="source-item">
                    <span class="source-name">${source.title}</span>
                    <a href="${source.url}" target="_blank" class="source-link">查看来源</a>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="entity-section">
          <h4>实体验证 (准确性评估: ${result.entity_verification.accuracy_assessment})</h4>
          ${result.entity_verification.entities_found.length > 0 ? `
            <div class="entities-list">
              ${result.entity_verification.entities_found.map((entity, index) => `
                <div class="entity-item">
                  <span class="entity-name">${entity}</span>
                  ${result.entity_verification.corrections[index] ? `
                    <div class="entity-correction">
                      需要更正: ${result.entity_verification.corrections[index]}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<p>未发现需要验证的实体</p>'}
        </div>

        <div class="fact-check-section">
          <h4>事实核查 (整体准确性: ${result.fact_check.overall_factual_accuracy})</h4>
          <div class="fact-check-list">
            ${result.fact_check.claims_identified.map((claim, index) => `
              <div class="fact-check-item">
                <div class="claim">${claim}</div>
                <div class="verification">${result.fact_check.verification_results[index] || '验证结果待更新'}</div>
              </div>
            `).join('')}
          </div>
        </div>

        ${result.exaggeration_check.exaggerations_found.length > 0 ? `
          <div class="exaggeration-section">
            <h4>夸张表述 (严重程度: ${result.exaggeration_check.severity_assessment})</h4>
            ${result.exaggeration_check.exaggerations_found.map((exag, index) => `
              <div class="exaggeration-item">
                <div class="original">原文：${exag}</div>
                <div class="correction">建议：${result.exaggeration_check.corrections[index] || '修正建议待更新'}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 辅助函数
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

  // 通知父窗口卡片已准备就绪
  window.parent.postMessage({ type: 'CARD_READY' }, '*');
}

// 当 DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingCard);
} else {
  initializeFloatingCard();
} 