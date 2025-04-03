// 添加调试函数，可以放在文件开头
function debugLog(message, data) {
  console.log(`[Oracle调试] ${message}`, data || '');
}

// 语言检测功能
function detectUserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage || 'en';
  // 支持中文和英文，其他语言默认使用英文
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
    infoEvaluation: "多维度分析",
    sourceEvaluation: "来源核查",
    factChecking: "事实核查",
    exaggerationCheck: "夸张信息检查",
    entityVerification: "实体验证",
    showMoreEntities: "显示更多实体 >",
    hideEntities: "< 收起实体",
    factuality: "事实性",
    objectivity: "客观性",
    reliability: "可靠性",
    bias: "偏见度",
    noSourcesFound: "未找到相关信息来源",
    noFactsToCheck: "未发现需要核查的主要事实声明",
    noEntitiesFound: "未发现需要验证的实体",
    noExaggerations: "未发现夸张信息",
    errorMessage: "分析过程中出现错误，请重试。",
    retry: "重新核查",
    analyzing: "正在核查...",
    serviceWaking: "服务正在启动中，请稍候...",
    noSummary: "未提供摘要",
    moreAccurateStatement: "需要更准确的表述",
    true: "真实",
    partiallyTrue: "部分真实",
    false: "虚假",
    misleading: "误导",
    unverified: "需要核实",
    notEnoughEvidence: "证据不足",
    high: "高",
    medium: "中",
    low: "低",
    showAll: "显示全部",
    hideDetails: "隐藏详情",
    noEntitiesDetails: "没有实体详情可显示"
  },
  en: {
    loadingText: "Analyzing...",
    factCheckReport: "Fact Check Report",
    trustedFriend: "As your trusted friend",
    trustScore: "Trust Score",
    summary: "Summary",
    infoEvaluation: "Multi-dimension Analysis",
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
    noExaggerations: "No exaggerations found",
    errorMessage: "An error occurred during analysis. Please try again.",
    retry: "Retry",
    analyzing: "Analyzing...",
    serviceWaking: "Service is starting, please wait...",
    noSummary: "No summary provided",
    moreAccurateStatement: "A more accurate statement needed",
    true: "True",
    partiallyTrue: "Partially True",
    false: "False",
    misleading: "Misleading",
    unverified: "Unverified",
    notEnoughEvidence: "Not enough evidence",
    high: "High",
    medium: "Medium",
    low: "Low",
    showAll: "Show all",
    hideDetails: "Hide details",
    noEntitiesDetails: "No entity details to display"
  }
};

// 获取用户语言的翻译文本
function getText(key) {
  const lang = detectUserLanguage();
  return (i18n[lang] && i18n[lang][key]) || key;
}

// 添加函数，将检测到的语言信息传递给父窗口
function notifyLanguagePreference() {
  const userLang = detectUserLanguage();
  console.log('检测到用户语言:', userLang);
  window.parent.postMessage({
    type: 'LANGUAGE_DETECTED',
    lang: userLang
  }, '*');
}

// 状态管理
let cardState = 'loading'; // loading, result, error

// 添加到文件顶部 - 统一的颜色管理系统
const trustColors = {
  // 获取CSS变量值的辅助函数
  getCssVar: function(varName) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    console.log(`获取CSS变量 ${varName} = ${value}`);
    return value || this.fallbackColors[varName];
  },
  
  // 颜色的备用值，以防CSS变量读取失败
  fallbackColors: {
    '--rating-high': '#10b981',    // 绿色
    '--rating-medium': '#f59e0b',  // 黄色
    '--rating-low': '#ef4444',     // 红色
    '--rating-neutral': '#9ca3af', // 灰色
    '--primary-color': '#2196F3',  // 蓝色
    '--warning-color': '#FFC107',  // 黄色
    '--bias-high': '#ef4444',      // 红色
    '--bias-medium': '#f59e0b',    // 黄色
    '--bias-low': '#10b981'        // 绿色
  },
  
  // 根据任意评分值获取HSL色相值(0-120)
  getHue: (score, max = 100) => Math.max(0, Math.min(120, (score / max) * 120)),
  
  // 标准HSL参数
  saturation: 75,
  lightness: 45,
  
  // 获取任意评分的颜色 - 使用CSS变量时的兼容方法
  getColor: function(score, max = 100) {
    if (score >= 80) return this.fallbackColors['--rating-high'];
    if (score >= 60) return this.fallbackColors['--primary-color'];
    if (score >= 40) return this.fallbackColors['--rating-medium'];
    if (score >= 20) return this.fallbackColors['--warning-color'];
    return this.fallbackColors['--rating-low'];
  },
  
  // 获取任意评分的背景色 - 兼容旧代码
  getBackgroundColor: function(score, max = 100) {
    return this.getColor(score, max);
  },
  
  // 获取任意评分的级别文本
  getLevel: function(score, max = 100) {
    const normalizedScore = (score / max) * 100;
    if (normalizedScore >= 80) return 'high';
    if (normalizedScore >= 65) return 'medium-high';
    if (normalizedScore >= 50) return 'medium';
    if (normalizedScore >= 30) return 'medium-low';
    return 'low';
  },
  
  // 获取任意评分的CSS类名
  getLevelClass: function(score, max = 100) {
    const level = this.getLevel(score, max);
    return `rating-${level.replace('-', '-')}`;
  },
  
  // 评级文本到数值分数的映射
  ratingToScore: {
    'high': 85, 'medium': 60, 'low': 30,
    '高': 85, '中': 60, '低': 30,
    'true': 90, 'partially true': 60, 'false': 20, 'misleading': 40, 'unverified': 50
  },

  // 获取本地化状态文本
  getLocalizedStatus: function(status, targetLang) {
    if (!status) return targetLang === 'zh' ? '需要核实' : 'Unverified';
    
    // 统一转小写和去除空格
    const normalizedStatus = status.toLowerCase().trim();
    
    // 中英文状态映射表
    const statusMap = {
      // 英文状态 -> 中文
      'true': '真实',
      'partially true': '部分真实',
      'false': '虚假',
      'misleading': '误导',
      'unverified': '需要核实',
      'not enough evidence': '证据不足',
      'high': '高',
      'medium': '中',
      'low': '低',
      
      // 中文状态 -> 英文
      '真实': 'True',
      '部分真实': 'Partially True',
      '虚假': 'False',
      '误导': 'Misleading',
      '需要核实': 'Unverified',
      '证据不足': 'Not enough evidence',
      '高': 'High',
      '中': 'Medium',
      '低': 'Low'
    };
    
    // 执行翻译逻辑...其余代码保持不变
    if (targetLang === 'zh') {
      if (statusMap[normalizedStatus]) {
        return statusMap[normalizedStatus];
      }
      
      for (const [enKey, zhValue] of Object.entries(statusMap)) {
        if (typeof enKey === 'string' && enKey.length > 1 && normalizedStatus.includes(enKey)) {
          return zhValue;
        }
      }
    } else {
      for (const [zhKey, enValue] of Object.entries(statusMap)) {
        if (normalizedStatus === zhKey.toLowerCase()) {
          return enValue;
        }
      }
      
      for (const [zhKey, enValue] of Object.entries(statusMap)) {
        if (typeof zhKey === 'string' && zhKey.length > 1 && normalizedStatus.includes(zhKey.toLowerCase())) {
          return enValue;
        }
      }
    }
    
    if (targetLang === 'en' && status.length > 0) {
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
    
    return status;
  }
};

// 创建 i18n 管理器实例
let i18nManager;

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

  // 初始化 i18n 管理器
  i18nManager = new I18nManager();
  i18nManager.initialize().then(() => {
    // 应用语言本地化
    i18nManager.updateAllTexts();
    console.log('语言初始化完成: ', i18nManager.currentLang);
  });

  // 检测语言并应用特定样式
  const lang = i18nManager.currentLang;
  if (lang === 'en') {
    // 为英文界面添加特定类
    document.body.classList.add('lang-en');
  } else {
    document.body.classList.add('lang-zh');
  }

  // 设置卡片状态
  function setCardState(state) {
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    resultState.style.display = state === 'result' ? 'block' : 'none';
    errorState.style.display = state === 'error' ? 'block' : 'none';
  }

  // 获取本地化文本的辅助函数
  function getText(key) {
    return i18nManager.getText(key);
  }

  // 通知父窗口检测到的语言
  notifyLanguagePreference();

  // 监听消息
  window.addEventListener('message', (event) => {
    console.log('浮动卡片收到消息:', event.data);
    
    // 兼容两种消息格式(action或type)
    const messageType = event.data.action || event.data.type;
    console.log('消息类型:', messageType);
    
    // 确保能获取正确的数据对象
    let resultData = null;
    if (event.data.data) {
      resultData = event.data.data;
      // 检查是否有嵌套的data对象(处理可能的response.data.data情况)
      if (resultData.data && typeof resultData.data === 'object') {
        resultData = resultData.data;
      }
    }
    console.log('消息数据:', resultData);

    // 处理服务唤醒消息
    if (messageType === 'SERVICE_WAKING') {
      // 更新加载状态文本
      const loadingText = document.querySelector('.loading-text');
      loadingText.textContent = getText('serviceWaking');
      
      // 服务启动状态适配
      document.querySelector('.loading-spinner').classList.add('waking-up');
      
      // 添加启动计时器
      let startTime = Date.now();
      let waitSeconds = 0;
      
      // 清除任何现有的计时器
      if (window.wakingTimer) clearInterval(window.wakingTimer);
      
      // 创建新的计时器，每秒更新一次
      window.wakingTimer = setInterval(() => {
        waitSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // 根据等待时间优化提示
        if (waitSeconds < 10) {
          loadingText.textContent = `${getText('serviceWaking')} (${waitSeconds}秒)`;
        } else if (waitSeconds < 20) {
          loadingText.textContent = `${getText('serviceWaking')} (${waitSeconds}秒) 即将就绪...`;
        } else if (waitSeconds < 30) {
          loadingText.textContent = `正在努力启动服务... (${waitSeconds}秒)`;
        } else {
          loadingText.textContent = `服务启动时间较长，请耐心等待... (${waitSeconds}秒)`;
          
          // 添加脉动效果增强视觉反馈
          if (!document.querySelector('.loading-spinner').classList.contains('long-wait')) {
            document.querySelector('.loading-spinner').classList.add('long-wait');
          }
        }
      }, 1000);
    }

    // 处理结果更新(兼容多种消息类型)
    if (messageType === 'UPDATE_RESULT' || messageType === 'UPDATE_CONTENT' || messageType === 'showFloatingCard') {
      // 当结果更新时，清除任何启动计时器
      if (window.wakingTimer) {
        clearInterval(window.wakingTimer);
        window.wakingTimer = null;
      }
      
      // 恢复常规样式
      document.querySelector('.loading-spinner').classList.remove('waking-up');
      document.querySelector('.loading-spinner').classList.remove('long-wait');
      
      const result = resultData;
      console.log('准备更新结果显示:', result);

      if (result) {
        try {
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
          
          console.log('结果渲染完成');
          
          // 立即执行一次强制一致性
          forceLanguageConsistency();
          
          // 在DOM完全渲染后再执行一次，确保所有动态内容都被处理
          setTimeout(forceLanguageConsistency, 300);
          
          // 在可能的滚动操作后再执行一次
          setTimeout(forceLanguageConsistency, 1000);

          // 动态调整总结文本大小
          const summaryPreview = document.getElementById('summary-preview');
          if (summaryPreview) {
            const summary = result.summary || '';
            summaryPreview.textContent = summary;
            
            // 基于文本长度动态调整字体大小
            const textLength = summary.length;
            if (textLength > 300) {
              summaryPreview.style.fontSize = '10px';
              summaryPreview.style.lineHeight = '1.2';
              summaryPreview.style.webkitLineClamp = '4';
            } else if (textLength > 200) {
              summaryPreview.style.fontSize = '11px';
              summaryPreview.style.lineHeight = '1.3';
              summaryPreview.style.webkitLineClamp = '4';
            } else if (textLength > 100) {
              summaryPreview.style.fontSize = '12px';
              summaryPreview.style.lineHeight = '1.4';
            }
            
            // 为英文设置更小的字体
            if (i18nManager.currentLang === 'en' && textLength > 100) {
              summaryPreview.style.fontSize = 
                (parseInt(summaryPreview.style.fontSize) - 1) + 'px';
            }
          }

          // 修复滚动问题，添加到显示结果后的处理
          setTimeout(() => {
            const cardBody = document.querySelector('.card-body');
            const resultContent = document.querySelector('.result-content');
            
            if (cardBody && resultContent) {
              // 强制重新计算布局
              cardBody.style.display = 'none';
              void cardBody.offsetHeight; // 触发重排
              cardBody.style.display = 'block';
              
              // 确保滚动区域高度计算正确
              const headerHeight = document.querySelector('.card-header').offsetHeight;
              cardBody.style.height = `calc(100% - ${headerHeight}px)`;
              
              // 检查是否需要滚动条
              if (resultContent.scrollHeight > cardBody.clientHeight) {
                // 在结果内容太长的情况下，添加清晰的滚动提示
                const scrollIndicator = document.createElement('div');
                scrollIndicator.className = 'scroll-indicator';
                scrollIndicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
                cardBody.appendChild(scrollIndicator);
                
                // 监听滚动事件，隐藏已经滚动到底部时的指示器
                cardBody.addEventListener('scroll', () => {
                  if (cardBody.scrollTop + cardBody.clientHeight >= resultContent.offsetHeight - 20) {
                    scrollIndicator.style.opacity = '0';
                  } else {
                    scrollIndicator.style.opacity = '1';
                  }
                });
              }
            }
          }, 100);
        } catch (error) {
          console.error('渲染结果时出错:', error);
          showError('渲染结果时出错: ' + error.message);
        }
      } else {
        console.error('未提供结果数据');
        showError('结果数据无效');
      }
    }
  });

  // 显示错误
  function showError(message) {
    document.getElementById('error-message').textContent = message || getText('errors_analysisError');
    setCardState('error');
  }

  // 关闭按钮事件
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('关闭按钮被点击');
      // 发送多种格式的消息以确保兼容性
      window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
      window.parent.postMessage({ action: 'REMOVE_FRAME' }, '*');
      window.parent.postMessage({ action: 'CLOSE_CARD' }, '*');
      window.parent.postMessage({ type: 'CLOSE_CARD' }, '*');
    });
  }

  if (closeBtnError) {
    closeBtnError.addEventListener('click', () => {
      console.log('错误状态下关闭按钮被点击');
      // 发送多种格式的消息以确保兼容性
      window.parent.postMessage({ type: 'REMOVE_FRAME' }, '*');
      window.parent.postMessage({ action: 'REMOVE_FRAME' }, '*');
      window.parent.postMessage({ action: 'CLOSE_CARD' }, '*');
      window.parent.postMessage({ type: 'CLOSE_CARD' }, '*');
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
    const cardHeader = document.querySelector('.card-header');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    // 设置圆环动画（这些必须在JS中设置）
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // 移除所有之前的评分类
    cardHeader.classList.remove(
      'score-range-high', 
      'score-range-medium-high', 
      'score-range-medium', 
      'score-range-medium-low', 
      'score-range-low'
    );
    
    console.log(`设置评分: ${score}`);
    
    // 添加对应分数范围的CSS类并直接设置颜色
    let strokeColor, textColor, bgGradient;
    
    if (score >= 80) {
      cardHeader.classList.add('score-range-high');
      strokeColor = '#10b981'; // 绿色
      textColor = strokeColor;
      bgGradient = 'linear-gradient(135deg, #10b981, #34d399)';
    } else if (score >= 60) {
      cardHeader.classList.add('score-range-medium-high');
      strokeColor = '#2196F3'; // 蓝色
      textColor = strokeColor;
      bgGradient = 'linear-gradient(135deg, #2563eb, #3b82f6)';
    } else if (score >= 40) {
      cardHeader.classList.add('score-range-medium');
      strokeColor = '#f59e0b'; // 黄色
      textColor = strokeColor;
      bgGradient = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
    } else if (score >= 20) {
      cardHeader.classList.add('score-range-medium-low');
      strokeColor = '#FF8C00'; // 橙色
      textColor = strokeColor;
      bgGradient = 'linear-gradient(135deg, #ff8c00, #ffa533)';
    } else {
      cardHeader.classList.add('score-range-low');
      strokeColor = '#ef4444'; // 红色
      textColor = strokeColor;
      bgGradient = 'linear-gradient(135deg, #dc2626, #ef4444)';
    }
    
    // 直接设置颜色而不依赖CSS变量
    circle.style.stroke = strokeColor;
    scoreValue.style.color = textColor;
    cardHeader.style.background = bgGradient;
    
    // 设置评分值
    scoreValue.textContent = score;
    
    // 根据背景色调整文本颜色（依然需要动态设置）
    const titleElement = cardHeader.querySelector('h1');
    const summaryElement = cardHeader.querySelector('.summary-preview');
    
    const headerTextColor = score > 40 ? 'white' : (score > 20 ? '#111827' : 'white');
    if (titleElement) titleElement.style.color = headerTextColor;
    if (summaryElement) summaryElement.style.color = headerTextColor;
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
    // ---> Detect language ONCE at the beginning
    const uiLang = detectUserLanguage(); 

    debugLog('开始生成结果内容');
    debugLog('当前UI语言', uiLang); // Log the consistent language
    debugLog('评级指标原始值', result.flags);
    
    if (result.fact_check?.verification_results) {
      debugLog('事实核查状态原始值', result.fact_check.verification_results);
    }
    
    if (result.exaggeration_check?.corrections) {
      debugLog('夸张检查校正原始值', result.exaggeration_check.corrections);
    }

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
        bias: 'fa-exclamation-triangle'
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

    // 多维度评分布局生成代码
    const flagsHTML = `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-chart-bar"></i>
          ${getText('infoEvaluation')}
        </h2>
        <div class="flags-container">
          <div class="flags-row">
            ${createFlagItem('factuality', result.flags?.factuality || 'N/A', 'fas fa-check-circle', uiLang)}
            ${createFlagItem('objectivity', result.flags?.objectivity || 'N/A', 'fas fa-balance-scale', uiLang)}
          </div>
          <div class="flags-row">
            ${createFlagItem('reliability', result.flags?.reliability || 'N/A', 'fas fa-shield-alt', uiLang)}
            ${createFlagItem('bias', result.flags?.bias || 'N/A', 'fas fa-exclamation-triangle', uiLang)}
          </div>
        </div>
      </div>
    `;

    // 创建单个评分项辅助函数
    function createFlagItem(flagType, value, iconClass, currentUiLang) { 
      console.log(`创建评分项: ${flagType} = ${value}`); // 调试日志
      
      // API 返回的值已经是目标语言，直接用于显示
      const displayValue = value;
      const valueLower = (value || '').toLowerCase().trim();

      // 确定评分级别和对应的CSS类和颜色
      let ratingClass, iconStyleClass, textClass;
      let borderColor, iconColor, textColor;
      
      // 偏见特殊处理 - 高偏见是负面的
      if (flagType === 'bias') {
        if ((currentUiLang === 'zh' && valueLower.includes('高')) || (currentUiLang === 'en' && valueLower.includes('high'))) {
          ratingClass = 'bias-high';
          iconStyleClass = 'bias-icon-high';
          textClass = 'bias-text-high';
          borderColor = '#ef4444'; // 红色
          iconColor = '#ef4444';
          textColor = '#ef4444';
        } else if ((currentUiLang === 'zh' && valueLower.includes('中')) || (currentUiLang === 'en' && valueLower.includes('medium'))) {
          ratingClass = 'bias-medium';
          iconStyleClass = 'bias-icon-medium';
          textClass = 'bias-text-medium';
          borderColor = '#f59e0b'; // 黄色
          iconColor = '#f59e0b';
          textColor = '#f59e0b';
        } else if ((currentUiLang === 'zh' && valueLower.includes('低')) || (currentUiLang === 'en' && valueLower.includes('low'))) {
          ratingClass = 'bias-low';
          iconStyleClass = 'bias-icon-low';
          textClass = 'bias-text-low';
          borderColor = '#10b981'; // 绿色
          iconColor = '#10b981';
          textColor = '#10b981';
        } else {
          ratingClass = 'rating-neutral';
          iconStyleClass = 'icon-neutral';
          textClass = 'text-neutral';
          borderColor = '#9ca3af'; // 灰色
          iconColor = '#9ca3af';
          textColor = '#9ca3af';
        }
      } 
      // 其他指标 - 高是正面的
      else {
        if ((currentUiLang === 'zh' && valueLower.includes('高')) || (currentUiLang === 'en' && valueLower.includes('high'))) {
          ratingClass = 'rating-high';
          iconStyleClass = 'icon-high';
          textClass = 'text-high';
          borderColor = '#10b981'; // 绿色
          iconColor = '#10b981';
          textColor = '#10b981';
        } else if ((currentUiLang === 'zh' && valueLower.includes('中')) || (currentUiLang === 'en' && valueLower.includes('medium'))) {
          ratingClass = 'rating-medium';
          iconStyleClass = 'icon-medium';
          textClass = 'text-medium';
          borderColor = '#f59e0b'; // 黄色
          iconColor = '#f59e0b'; 
          textColor = '#f59e0b';
        } else if ((currentUiLang === 'zh' && valueLower.includes('低')) || (currentUiLang === 'en' && valueLower.includes('low'))) {
          ratingClass = 'rating-low';
          iconStyleClass = 'icon-low';
          textClass = 'text-low';
          borderColor = '#ef4444'; // 红色
          iconColor = '#ef4444';
          textColor = '#ef4444';
        } else {
          ratingClass = 'rating-neutral';
          iconStyleClass = 'icon-neutral';
          textClass = 'text-neutral';
          borderColor = '#9ca3af'; // 灰色
          iconColor = '#9ca3af'; 
          textColor = '#9ca3af';
        }
      }
      
      console.log(`评分项颜色: 边框=${borderColor}, 图标=${iconColor}, 文本=${textColor}`);
      
      // 返回带有内联样式的HTML，确保颜色正确显示
      return `
        <div class="flag-item ${ratingClass}" style="border-top: 3px solid ${borderColor}">
          <div class="flag-title">
            <i class="${iconClass} ${iconStyleClass}" style="color: ${iconColor}"></i>
            ${getText(flagType)}
          </div>
          <div class="flag-value ${textClass}" style="color: ${textColor}">${displayValue}</div>
        </div>
      `;
    }

    // 创建来源标签
    let sourcesHTML = '';
    if (result.source_verification?.sources_found && result.source_verification.sources_found.length > 0) {
      const sourceItems = (result.source_verification.sources_found || []).map((source, index) => {
        const score = result.source_verification.credibility_scores[index];
        
        // 使用统一的颜色映射(1-10分转换为百分比)
        const backgroundColor = trustColors.getBackgroundColor(score, 10);
        
        return `
          <div class="source-tag">
            <span class="source-credibility" style="background-color: ${backgroundColor}">${score}</span>
            ${source}
          </div>
        `;
      }).join('');
      
      // 添加来源核查区域的标题和内容
      sourcesHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-link"></i>
            ${getText('sourceEvaluation')}
          </h2>
          <div class="sources-container">
            ${sourceItems || `<div class="empty-section">${getText('noSourcesFound')}</div>`}
          </div>
        </div>
      `;
    }

    // 创建事实核查内容
    let factChecksHTML = '';
    if (result.fact_check?.claims_identified && result.fact_check.claims_identified.length > 0) {
      const factItems = (result.fact_check.claims_identified || []).map((claim, index) => {
        const currentLang = uiLang; // 使用一致的语言
        
        // 获取默认状态文本
        const defaultStatus = currentLang === 'zh' ? '需要核实' : 'Unverified';
        
        // 获取原始状态文本 (API已翻译)
        const originalStatus = result.fact_check.verification_results[index] || defaultStatus;
        const displayStatus = originalStatus; // 直接使用API值
        
        // 根据状态值确定CSS类和颜色
        let statusClass = 'fact-status-unverified'; // 默认类
        let bgColor = '#6b7280'; // 默认灰色
        let textColor = 'white';  // 默认文本颜色
        const statusLower = originalStatus.toLowerCase();
        
        if (currentLang === 'en') {
          if (statusLower.includes('true') && !statusLower.includes('partially')) {
            statusClass = 'fact-status-true';
            bgColor = '#10b981'; // 绿色
            textColor = 'white';
          } else if (statusLower.includes('partially true')) {
            statusClass = 'fact-status-partially-true';
            bgColor = '#f59e0b'; // 黄色
            textColor = '#111827';
          } else if (statusLower.includes('false')) {
            statusClass = 'fact-status-false';
            bgColor = '#ef4444'; // 红色
            textColor = 'white';
          } else if (statusLower.includes('misleading')) {
            statusClass = 'fact-status-misleading';
            bgColor = '#FFC107'; // 黄色警告
            textColor = '#111827';
          }
        } else { // 中文处理
          if (statusLower.includes('真实') && !statusLower.includes('部分')) {
            statusClass = 'fact-status-true';
            bgColor = '#10b981'; // 绿色
            textColor = 'white';
          } else if (statusLower.includes('部分真实')) {
            statusClass = 'fact-status-partially-true';
            bgColor = '#f59e0b'; // 黄色
            textColor = '#111827';
          } else if (statusLower.includes('虚假')) {
            statusClass = 'fact-status-false';
            bgColor = '#ef4444'; // 红色
            textColor = 'white';
          } else if (statusLower.includes('误导')) {
            statusClass = 'fact-status-misleading';
            bgColor = '#FFC107'; // 黄色警告
            textColor = '#111827';
          }
        }
        
        console.log(`处理状态: ${originalStatus} -> ${displayStatus} (CSS类: ${statusClass}, 背景: ${bgColor}, 文字: ${textColor})`);
        
        return `
          <div class="fact-item">
            <div class="fact-content">${claim}</div>
            <div class="fact-status ${statusClass}" style="background-color: ${bgColor}; color: ${textColor}">${displayStatus}</div>
          </div>
        `;
      }).join('');
      
      // 添加事实核查区域的标题和内容
      factChecksHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-check-double"></i>
            ${getText('factChecking')}
          </h2>
          <div class="facts-container">
            ${factItems}
          </div>
        </div>
      `;
    } else {
      // 没有事实核查内容时显示的空状态
      factChecksHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-check-double"></i>
            ${getText('factChecking')}
          </h2>
          <div class="empty-section">${getText('noFactsToCheck')}</div>
        </div>
      `;
    }

    // 创建夸张信息检查内容
    let exaggerationHTML = '';
    if (result.exaggeration_check?.exaggerations_found && result.exaggeration_check.exaggerations_found.length > 0) {
      const exaggerationItems = (result.exaggeration_check.exaggerations_found || []).map((exaggeration, index) => {
        const currentLang = uiLang; // 使用一致的语言
        
        // 获取夸张校正文本，优先使用API返回的校正
        const apiCorrection = result.exaggeration_check.corrections[index];
        
        // 当API没有返回校正时，使用本地化文本
        const fallbackText = getText('moreAccurateStatement');
        
        // 最终显示的校正文本
        const displayCorrection = apiCorrection || fallbackText;
        
        // 使用数据属性记录校正类型，而不是内联样式
        return `
          <div class="exaggeration-item">
            <div class="exaggeration-claim">${exaggeration}</div>
            <div class="exaggeration-correction" data-correction-type="${apiCorrection ? 'api' : 'default'}">
              ${displayCorrection}
            </div>
          </div>
        `;
      }).join('');
      
      // 添加夸张信息检查区域的标题和内容
      exaggerationHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-exclamation-triangle"></i>
            ${getText('exaggerationCheck')}
          </h2>
          <div class="exaggerations-container">
            ${exaggerationItems}
          </div>
        </div>
      `;
    } else {
      // 没有夸张信息检查内容时显示的空状态
      exaggerationHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-exclamation-triangle"></i>
            ${getText('exaggerationCheck')}
          </h2>
          <div class="empty-section">${getText('noExaggerations')}</div>
        </div>
      `;
    }

    // 创建实体验证内容
    let entitiesHTML = '';
    const entities = result.entity_verification?.entities_found || [];
    
    if (entities.length > 0) {
      const previewEntities = entities.slice(0, Math.min(10, entities.length));
      const hiddenEntities = entities.length > 10 ? entities.slice(10) : [];
      
      const previewHTML = previewEntities.map(entity => `
        <div class="entity-tag">${entity}</div>
      `).join('');
      
      let hiddenHTML = '';
      if (hiddenEntities.length > 0) {
        hiddenHTML = `
          <div class="hidden-entities" style="display: none;" id="hidden-entities">
            ${hiddenEntities.map(entity => `
              <div class="entity-tag">${entity}</div>
            `).join('')}
          </div>
          <button class="show-more-button" id="show-more-entities">
            ${getText('showMoreEntities')}
          </button>
          <button class="hide-button" id="hide-entities" style="display: none;">
            ${getText('hideEntities')}
          </button>
        `;
      }
      
      // 添加实体验证区域的标题和内容
      entitiesHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-user-check"></i>
            ${getText('entityVerification')}
          </h2>
          <div class="entities-container">
            <div class="entities-preview" id="entities-preview">
              ${previewHTML}
            </div>
            ${hiddenHTML}
          </div>
        </div>
      `;

      // 在渲染完成后添加"显示更多"按钮的事件监听器
      setTimeout(() => {
        const showMoreButton = document.getElementById('show-more-entities');
        const hideButton = document.getElementById('hide-entities');
        const hiddenEntitiesDiv = document.getElementById('hidden-entities');
        
        if (showMoreButton && hideButton && hiddenEntitiesDiv) {
          showMoreButton.addEventListener('click', () => {
            hiddenEntitiesDiv.style.display = 'flex';
            showMoreButton.style.display = 'none';
            hideButton.style.display = 'inline-block';
          });
          
          hideButton.addEventListener('click', () => {
            hiddenEntitiesDiv.style.display = 'none';
            showMoreButton.style.display = 'inline-block';
            hideButton.style.display = 'none';
          });
        }
      }, 100);
    } else {
      // 没有实体时显示的空状态
      entitiesHTML = `
        <div class="section">
          <h2 class="section-title">
            <i class="fas fa-user-check"></i>
            ${getText('entityVerification')}
          </h2>
          <div class="empty-section">${getText('noEntitiesFound')}</div>
        </div>
      `;
    }

    return `
      <div class="result-content">
        ${flagsHTML}
        ${sourcesHTML}
        ${factChecksHTML}
        ${exaggerationHTML}
        ${entitiesHTML}
      </div>
    `;
  }

  // 调整卡片高度
  function adjustCardHeight() {
    const resultContent = document.querySelector('.result-content');
    if (resultContent) {
      resultContent.style.height = 'auto';
      resultContent.style.height = resultContent.scrollHeight + 'px';
    }
  }

  // 强制语言一致性
  function forceLanguageConsistency() {
    // 实现语言一致性逻辑
  }
}

// 调用初始化函数
initializeFloatingCard();