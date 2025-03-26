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
    noExaggerations: "未发现夸张信息",
    noEntitiesDetails: "没有实体详情可显示"
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
    noExaggerations: "No exaggerations found",
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
  // 根据任意评分值获取HSL色相值(0-120)
  getHue: (score, max = 100) => Math.max(0, Math.min(120, (score / max) * 120)),
  
  // 标准HSL参数
  saturation: 75,
  lightness: 45,
  
  // 获取任意评分的背景色
  getBackgroundColor: function(score, max = 100) {
    const hue = this.getHue(score, max);
    return `hsl(${hue}, ${this.saturation}%, ${this.lightness}%)`;
  },
  
  // 获取任意评分的渐变背景色
  getGradient: function(score, max = 100) {
    const hue = this.getHue(score, max);
    const lighterHue = Math.min(120, hue + 10);
    return `linear-gradient(135deg, 
      hsl(${hue}, ${this.saturation}%, ${this.lightness}%), 
      hsl(${lighterHue}, ${this.saturation}%, ${this.lightness+5}%))`;
  },
  
  // 获取文本颜色(确保可读性)
  getTextColor: function(score, max = 100) {
    const hue = this.getHue(score, max);
    // 蓝色到绿色区域用白色文本，黄色到红色区域用深色文本
    return (hue > 70) ? 'white' : (hue > 40) ? '#111827' : 'white';
  },
  
  // 获取预定义分数级别(用于快速评估)
  getLevel: function(score, max = 100) {
    const normalizedScore = (score / max) * 100;
    if (normalizedScore >= 80) return 'high';
    if (normalizedScore >= 65) return 'medium-high';
    if (normalizedScore >= 50) return 'medium';
    if (normalizedScore >= 30) return 'medium-low';
    return 'low';
  },
  
  // 评级文本到数值分数的映射(用于将文本评级转为数值)
  ratingToScore: {
    'high': 85, 'medium': 60, 'low': 30,
    '高': 85, '中': 60, '低': 30,
    'true': 90, 'partially true': 60, 'false': 20, 'misleading': 40, 'unverified': 50
  },

  // 添加到 trustColors 对象中的新方法 - 双语状态映射系统
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
    
    // 先精确匹配完整文本
    if (targetLang === 'zh') {
      // 从英文到中文的精确匹配
      if (statusMap[normalizedStatus]) {
        return statusMap[normalizedStatus];
      }
      
      // 部分匹配英文状态
      for (const [enKey, zhValue] of Object.entries(statusMap)) {
        if (typeof enKey === 'string' && enKey.length > 1 && normalizedStatus.includes(enKey)) {
          return zhValue;
        }
      }
    } else {
      // 从中文到英文的精确匹配
      for (const [zhKey, enValue] of Object.entries(statusMap)) {
        if (normalizedStatus === zhKey.toLowerCase()) {
          return enValue;
        }
      }
      
      // 部分匹配中文状态
      for (const [zhKey, enValue] of Object.entries(statusMap)) {
        if (typeof zhKey === 'string' && zhKey.length > 1 && normalizedStatus.includes(zhKey.toLowerCase())) {
          return enValue;
        }
      }
    }
    
    // 首字母大写处理
    if (targetLang === 'en' && status.length > 0) {
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
    
    // 无法翻译时原样返回
    return status;
  }
};

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
  
  // 通知父窗口检测到的语言
  notifyLanguagePreference();

  // 检测语言并应用特定样式
  const lang = detectUserLanguage();
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

  // 修改forceLanguageConsistency函数 - 全面加强元素替换逻辑
  function forceLanguageConsistency() {
    setTimeout(() => {
      const currentLang = detectUserLanguage();
      console.log("强制语言一致性执行，当前语言:", currentLang);
      
      if (currentLang === 'en') {
        // 1. 替换所有可能的中文文本 - 评级指标部分
        document.querySelectorAll('.flag-value').forEach(el => {
          if (el.textContent === '高') el.textContent = 'High';
          if (el.textContent === '中') el.textContent = 'Medium';
          if (el.textContent === '低') el.textContent = 'Low';
        });
        
        // 2. 替换所有中文状态标签 - 事实核查部分
        document.querySelectorAll('.fact-status').forEach(el => {
          if (el.textContent === '真实') el.textContent = 'True';
          if (el.textContent === '部分真实') el.textContent = 'Partially True';
          if (el.textContent === '虚假') el.textContent = 'False';
          if (el.textContent === '误导') el.textContent = 'Misleading';
          if (el.textContent === '需要核实') el.textContent = 'Unverified';
          if (el.textContent === '证据不足') el.textContent = 'Not enough evidence';
        });
        
        // 3. 替换夸张信息部分的中文文本
        document.querySelectorAll('.exaggeration-correction').forEach(el => {
          if (el.textContent === '需要更准确的表述') {
            el.textContent = 'A more accurate statement needed';
          }
          // 检查并替换其他可能的中文提示
          if (el.textContent.includes('需要')) {
            el.textContent = el.textContent.replace('需要', 'Needs');
          }
        });
        
        // 4. 处理可能出现中文的其他元素
        document.querySelectorAll('p').forEach(el => {
          if (el.textContent === '未找到相关信息来源') el.textContent = 'No related sources found';
          if (el.textContent === '未发现需要核查的主要事实声明') el.textContent = 'No major factual claims to check';
          if (el.textContent === '未发现需要验证的实体') el.textContent = 'No entities to verify';
          if (el.textContent === '未发现夸张信息') el.textContent = 'No exaggerations found';
        });
      } else if (currentLang === 'zh') {
        // 如果当前语言是中文，确保所有文本都是中文
        document.querySelectorAll('.flag-value').forEach(el => {
          if (el.textContent === 'High') el.textContent = '高';
          if (el.textContent === 'Medium') el.textContent = '中';
          if (el.textContent === 'Low') el.textContent = '低';
        });
        
        document.querySelectorAll('.fact-status').forEach(el => {
          if (el.textContent === 'True') el.textContent = '真实';
          if (el.textContent === 'Partially True') el.textContent = '部分真实';
          if (el.textContent === 'False') el.textContent = '虚假';
          if (el.textContent === 'Misleading') el.textContent = '误导';
          if (el.textContent === 'Unverified') el.textContent = '需要核实';
          if (el.textContent === 'Not enough evidence') el.textContent = '证据不足';
        });
        
        document.querySelectorAll('.exaggeration-correction').forEach(el => {
          if (el.textContent === 'A more accurate statement needed') {
            el.textContent = '需要更准确的表述';
          }
        });
      }
      
      console.log("语言强制一致性完成");
    }, 100);
  }

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
    document.getElementById('error-message').textContent = message || getText('errorMessage');
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
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // 使用统一色彩系统
    const backgroundColor = trustColors.getBackgroundColor(score);
    const gradient = trustColors.getGradient(score);
    const textColor = trustColors.getTextColor(score);
    
    // 应用颜色
    circle.style.stroke = backgroundColor;
    scoreValue.textContent = score;
    scoreValue.style.color = backgroundColor;
    cardHeader.style.background = gradient;
    
    // 根据背景色调整文本颜色
    const titleElement = cardHeader.querySelector('h1');
    const summaryElement = cardHeader.querySelector('.summary-preview');
    
    if (titleElement) titleElement.style.color = textColor;
    if (summaryElement) summaryElement.style.color = textColor;
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
    debugLog('开始生成结果内容');
    debugLog('当前UI语言', detectUserLanguage());
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

    // 创建评估指标 - 使用统一色彩系统和i18n
    const flagsHTML = Object.entries(result.flags || {}).map(([key, value]) => {
      // 获取当前界面语言
      const currentLang = detectUserLanguage();
      
      // 统一转换为当前界面语言
      let displayValue = value;
      
      // 标准化处理API返回值
      if (typeof value === 'string') {
        // 获取本地化的评级值 - 确保显示当前界面语言
        displayValue = trustColors.getLocalizedStatus(value, currentLang);
      }
      
      // 将评级文本转换为分数 - 使用原始值查找分数
      let score;
      const valueLower = value.toLowerCase();
      
      // 查找评分规则
      if (trustColors.ratingToScore[valueLower]) {
        score = trustColors.ratingToScore[valueLower];
      } else if (valueLower.includes('high') || valueLower.includes('高')) {
        score = 85;
      } else if (valueLower.includes('medium') || valueLower.includes('中')) {
        score = 60;
      } else if (valueLower.includes('low') || valueLower.includes('低')) {
        score = 30;
      } else {
        score = 50; // 默认值
      }
      
      // 获取统一风格的颜色
      const color = trustColors.getBackgroundColor(score);
      
      // 获取图标类
      const iconClass = getFlagIcon(key);
      
      return `
        <div class="flag-item">
          <div class="flag-icon" style="color: ${color}">
            <i class="fas ${iconClass}"></i>
    </div>
          <div class="flag-title">${getFlagLabel(key)}</div>
          <div class="flag-value">${displayValue}</div>
    </div>
      `;
    }).join('');

    // 创建来源标签 - 使用统一色彩系统
    const sourcesHTML = (result.source_verification?.sources_found || []).map((source, index) => {
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

    // 创建事实检查项 - 使用统一色彩系统
    const factChecksHTML = (result.fact_check?.claims_identified || []).map((claim, index) => {
      // 获取当前界面语言
      const currentLang = detectUserLanguage();
      
      // 获取默认状态文本
      const defaultStatus = currentLang === 'zh' ? '需要核实' : 'Unverified';
      
      // 获取原始状态文本
      const originalStatus = result.fact_check.verification_results[index] || defaultStatus;
      
      // 强制转换为当前界面语言
      const displayStatus = trustColors.getLocalizedStatus(originalStatus, currentLang);
      
      // 计算置信度分数
      let confidenceScore = 50; // 默认值
      
      // 使用英文规则统一判断分数
      const statusLower = originalStatus.toLowerCase();
      
      if (statusLower.includes('true') && !statusLower.includes('partially') && !statusLower.includes('not')) {
        confidenceScore = 90;
      } else if (statusLower.includes('partially true')) {
        confidenceScore = 60;
      } else if (statusLower.includes('false')) {
        confidenceScore = 20;
      } else if (statusLower.includes('misleading')) {
        confidenceScore = 40;
      } else if (statusLower.includes('unverified')) {
        confidenceScore = 50;
      }
      
      // 中文规则判断
      if (confidenceScore === 50) {
        if (statusLower.includes('真实') && !statusLower.includes('部分')) {
          confidenceScore = 90;
        } else if (statusLower.includes('部分真实')) {
          confidenceScore = 60;
        } else if (statusLower.includes('虚假')) {
          confidenceScore = 20;
        } else if (statusLower.includes('误导')) {
          confidenceScore = 40;
        } else if (statusLower.includes('需要核实')) {
          confidenceScore = 50;
        }
      }
      
      // 获取统一风格的背景色和文本颜色
      const backgroundColor = trustColors.getBackgroundColor(confidenceScore);
      const textColor = trustColors.getTextColor(confidenceScore);
      
      console.log(`处理状态: ${originalStatus} -> ${displayStatus} (分数: ${confidenceScore})`);
      
      return `
        <div class="fact-item">
          <div class="fact-content">${claim}</div>
          <div class="fact-status" style="background-color: ${backgroundColor}; color: ${textColor}">${displayStatus}</div>
    </div>
      `;
    }).join('');

    // 修改夸张信息项生成函数
    const exaggerationsHTML = (result.exaggeration_check?.exaggerations_found || []).map((exaggeration, index) => {
      // 获取当前界面语言
      const currentLang = detectUserLanguage();
      
      // 获取夸张校正文本，优先使用API返回的校正
      const apiCorrection = result.exaggeration_check.corrections[index];
      
      // 当API没有返回校正时，使用本地化文本
      const fallbackText = getText('moreAccurateStatement');
      
      // 最终显示的校正文本
      const displayCorrection = apiCorrection || fallbackText;
      
      // 使用统一配色系统
      const severity = 30; // 固定使用低可信度颜色
      const borderColor = trustColors.getBackgroundColor(severity);
      
      // 调试输出
      console.log(`夸张校正: API返回=${apiCorrection}, 使用=${displayCorrection}`);
      
      return `
        <div class="exaggeration-item">
          <div class="exaggeration-claim">${exaggeration}</div>
          <div class="exaggeration-correction" style="border-left-color: ${borderColor}" 
               data-correction-type="${apiCorrection ? 'api' : 'default'}">
            ${displayCorrection}
  </div>
  </div>
      `;
    }).join('');

    // 添加夸张信息检查部分的无内容处理
    const exaggerationSection = result.exaggeration_check?.exaggerations_found?.length > 0 ? `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-exclamation-triangle"></i>
          ${getText('exaggerationCheck')}
        </h2>
        <div class="exaggerations-container">
          ${exaggerationsHTML}
      </div>
            </div>
    ` : '';

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
  
      ${exaggerationSection}
      
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
    
    // 设置错误信息
    document.getElementById('error-message').textContent = getText('errorMessage');
    
    // 设置重试按钮
    document.getElementById('retry-btn').textContent = getText('retry');
    
    // 设置所有带data-i18n属性的元素
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

  // 添加新样式
  const addStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .loading-spinner.long-wait {
        border: 2px solid var(--gray-200);
        border-top: 2px solid var(--danger);
        animation: pulse-urgent 1s ease-in-out infinite alternate, spin 1.5s linear infinite;
      }
      
      @keyframes pulse-urgent {
        0% { opacity: 0.8; transform: scale(0.9) rotate(0deg); box-shadow: 0 0 5px rgba(220, 53, 69, 0.5); }
        100% { opacity: 1; transform: scale(1.1) rotate(360deg); box-shadow: 0 0 15px rgba(220, 53, 69, 0.8); }
      }
    `;
    document.head.appendChild(style);
  };

  // 初始化为加载状态
  setCardState('loading');
  window.parent.postMessage({ type: 'CARD_READY' }, '*');
  
  // 添加新样式
  addStyles();
}

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFloatingCard);
} else {
  initializeFloatingCard();
} 