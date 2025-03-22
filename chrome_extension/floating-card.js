// 状态管理
let cardState = 'loading'; // loading, result, error

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    // 尝试访问 chrome.runtime
    return !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// 初始化浮动卡片
function initializeFloatingCard() {
  // 检查扩展上下文
  if (!isExtensionContextValid()) {
    console.warn('Extension context is invalid, reloading page...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    return;
  }

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
  const messageHandler = (event) => {
    try {
      // 再次检查扩展上下文
      if (!isExtensionContextValid()) {
        window.removeEventListener('message', messageHandler);
        window.location.reload();
        return;
      }

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

            // 等待内容渲染完成后更新高度
            requestAnimationFrame(() => {
              updateCardHeight();
              // 监听图片加载完成事件
              const images = resultState.getElementsByTagName('img');
              if (images.length > 0) {
                Array.from(images).forEach(img => {
                  img.onload = updateCardHeight;
                });
              }
            });
          } else {
            console.error('Required elements not found:', { resultState, cardContent });
          }
        } catch (error) {
          console.error('Error updating result:', error);
          showError('更新结果时发生错误');
        }
      }
    } catch (error) {
      console.error('Error in message handler:', error);
    }
  };

  window.addEventListener('message', messageHandler);

  // 关闭按钮事件
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      // 添加关闭动画
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
      }, 200);
    });
  }

  // 重试按钮事件
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      // 重置卡片状态
      if (loadingSpinner) loadingSpinner.style.display = 'block';
      if (headerText) headerText.textContent = '正在核查...';
      if (resultState) resultState.style.display = 'none';
      if (errorState) errorState.style.display = 'none';
      
      // 更新卡片状态和尺寸
      card.className = 'floating-card processing';
      window.parent.postMessage({
        type: 'RESIZE_FRAME',
        width: 280,
        height: 72
      }, '*');
      
      window.parent.postMessage({ type: 'RETRY_ANALYSIS' }, '*');
    });
  }

  function showError(message) {
    const errorState = document.getElementById('error-state');
    const resultState = document.getElementById('result-state');
    const card = document.querySelector('.floating-card');
    
    if (errorState) {
      const errorMessage = errorState.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = message;
      }
      errorState.style.display = 'block';
      if (resultState) {
        resultState.style.display = 'none';
      }
      
      // 更新卡片状态和高度
      card.className = 'floating-card completed';
      requestAnimationFrame(updateCardHeight);
    }
  }

  function createResultContent(result) {
    if (!result) {
      console.error('No result data provided');
      return '';
    }

    console.log('Creating result content with:', result);

    // 计算评分颜色
    const getScoreColor = (score) => {
      if (score >= 80) return 'var(--success-color)';
      if (score >= 60) return 'var(--warning-color)';
      if (score >= 40) return 'var(--warning-color)';
      return 'var(--error-color)';
    };

    return `
      <div class="score-summary">
        <div class="score-number" style="color: ${getScoreColor(result.score)}">${result.score}</div>
        <div class="score-label">总体可信度评分</div>
      </div>
      
      <div class="tags-container">
        ${Object.entries(result.flags).map(([key, value]) => `
          <div class="tag" style="background: ${getLevelColor(value)}15; 
                                color: ${getLevelColor(value)}; 
                                border: 1px solid ${getLevelColor(value)}">
            ${getTagLabel(key)}: ${value}
          </div>
        `).join('')}
      </div>

      <div class="section">
        <h3 class="section-title">内容摘要</h3>
        <div class="section-content">
          <p>${result.summary}</p>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">信息来源</h3>
        <div class="section-content">
          <div class="item-card">
            <p style="margin-bottom: 12px">整体可信度: ${result.source_verification.overall_source_credibility}</p>
            ${result.source_verification.sources_found.map((source, index) => `
              <div class="source-item">
                <span class="source-name">${source}</span>
                <span class="source-score">${result.source_verification.credibility_scores[index]}/10</span>
              </div>
            `).join('')}
          </div>

          ${result.sources.length > 0 ? `
            <h4 style="margin: 16px 0 12px">参考来源</h4>
            ${result.sources.map(source => `
              <div class="item-card source-item">
                <span class="source-name">${source.title}</span>
                <a href="${source.url}" target="_blank" class="source-link" 
                   style="color: var(--primary-color); text-decoration: none;">查看来源</a>
              </div>
            `).join('')}
          ` : ''}
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">实体验证</h3>
        <div class="section-content">
          <div class="item-card">
            <p style="margin-bottom: 12px">准确性评估: ${result.entity_verification.accuracy_assessment}</p>
            ${result.entity_verification.entities_found.length > 0 ? `
              ${result.entity_verification.entities_found.map((entity, index) => `
                <div style="margin-bottom: 8px">
                  <div style="font-weight: 500; margin-bottom: 4px">${entity}</div>
                  ${result.entity_verification.corrections[index] ? `
                    <div style="color: var(--error-color)">
                      需要更正: ${result.entity_verification.corrections[index]}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            ` : '<p>未发现需要验证的实体</p>'}
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">事实核查</h3>
        <div class="section-content">
          <p style="margin-bottom: 12px">整体准确性: ${result.fact_check.overall_factual_accuracy}</p>
          ${result.fact_check.claims_identified.map((claim, index) => `
            <div class="item-card fact-check-item">
              <div class="claim">${claim}</div>
              <div class="verification">${result.fact_check.verification_results[index] || '验证结果待更新'}</div>
            </div>
          `).join('')}
        </div>
      </div>

      ${result.exaggeration_check.exaggerations_found.length > 0 ? `
        <div class="section">
          <h3 class="section-title">夸张表述</h3>
          <div class="section-content">
            <p style="margin-bottom: 12px">严重程度: ${result.exaggeration_check.severity_assessment}</p>
            ${result.exaggeration_check.exaggerations_found.map((exag, index) => `
              <div class="item-card exaggeration-item">
                <div class="original">原文：${exag}</div>
                <div class="correction">建议：${result.exaggeration_check.corrections[index] || '修正建议待更新'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  // 辅助函数
  function getLevelColor(level) {
    switch(level) {
      case '高': return 'var(--success-color)';
      case '中': return 'var(--warning-color)';
      case '低': return 'var(--error-color)';
      default: return 'var(--text-secondary)';
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

// 计算并更新卡片高度
function updateCardHeight() {
  const card = document.querySelector('.floating-card');
  const resultState = document.getElementById('result-state');
  const errorState = document.getElementById('error-state');
  const cardContent = document.querySelector('.card-content');
  
  if (!card || !cardContent) return;

  const headerHeight = 56; // 头部高度
  const padding = 40; // 上下内边距总和
  const minHeight = headerHeight; // 最小高度
  const maxHeight = window.innerHeight * 0.9; // 最大高度为视窗的90%
  
  // 根据卡片状态计算高度
  if (card.classList.contains('processing')) {
    // 处理中状态 - 使用最小高度
    const processingHeight = headerHeight;
    card.style.height = `${processingHeight}px`;
    window.parent.postMessage({
      type: 'RESIZE_FRAME',
      width: 320,
      height: processingHeight
    }, '*');
  } else {
    // 完成状态 - 根据内容计算高度
    const contentHeight = (resultState && resultState.offsetHeight) || 
                        (errorState && errorState.offsetHeight) || 
                        0;
    const totalHeight = Math.min(contentHeight + headerHeight + padding, maxHeight);
    const finalHeight = Math.max(minHeight, totalHeight);
    
    // 更新卡片高度
    card.style.height = `${finalHeight}px`;
    window.parent.postMessage({
      type: 'RESIZE_FRAME',
      width: 480,
      height: finalHeight
    }, '*');
  }
}

// 监听窗口大小变化
window.addEventListener('resize', () => {
  requestAnimationFrame(updateCardHeight);
});

// 当 DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingCard);
} else {
  initializeFloatingCard();
} 