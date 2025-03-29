// 添加调试函数，可以放在文件开头
function debugLog(message, data) {
  console.log(`[Oracle调试] ${message}`, data || '');
}

// 导入统一的i18n模块
import i18n from '../utils/i18n.js';

// 语言检测功能 - 使用新的i18n模块
function detectUserLanguage() {
  return i18n.getUILanguage();
}

// 获取用户语言的翻译文本 - 使用新的i18n模块
function getText(key) {
  return i18n.getMessage(key) || key;
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

// 全局变量
let globalState = {
  language: 'zh',
  resultData: null,
  isPersisted: false,  // 添加持久化状态
  // ...现有状态
};

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
async function initializeFloatingCard() {
  // 获取DOM元素
  const loadingState = document.getElementById('loading-state');
  const resultState = document.getElementById('result-state');
  const errorState = document.getElementById('error-state');
  const closeBtn = document.getElementById('close-btn');
  const closeBtnError = document.getElementById('close-btn-error');
  const retryBtn = document.getElementById('retry-btn');
  
  console.log('事实核查卡片已初始化');

  // 初始化i18n
  await i18n.initializeI18n();
  
  // 应用语言本地化
  applyLanguageTexts();
  
  // 通知父窗口检测到的语言
  notifyLanguagePreference();
  
  // 向父窗口请求数据
  requestResultData();

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
    console.log(`设置卡片状态: ${state}`);
    cardState = state;
    loadingState.style.display = state === 'loading' ? 'flex' : 'none';
    resultState.style.display = state === 'result' ? 'block' : 'none';
    errorState.style.display = state === 'error' ? 'block' : 'none';
  }

  // 主动请求结果数据
  function requestResultData() {
    console.log('主动请求分析结果数据...');
    
    // 设置超时，如果长时间没有收到数据则请求
    window.dataRequestTimer = setTimeout(() => {
      console.log('数据请求超时，主动发送请求...');
      window.parent.postMessage({
        type: 'DATA_REQUEST',
        message: '请求分析结果数据'
      }, '*');
    }, 1000);
    
    // 再次尝试
    window.secondRequestTimer = setTimeout(() => {
      console.log('二次数据请求...');
      window.parent.postMessage({
        type: 'DATA_REQUEST',
        message: '二次请求分析结果数据'
      }, '*');
    }, 3000);
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

  // 监听消息 - 增强错误处理和调试
  window.addEventListener('message', (event) => {
    console.log('浮动卡片收到消息:', event.data);
    
    // 收到任何消息后清除数据请求计时器
    if (window.dataRequestTimer) {
      clearTimeout(window.dataRequestTimer);
      window.dataRequestTimer = null;
    }
    
    if (window.secondRequestTimer) {
      clearTimeout(window.secondRequestTimer);
      window.secondRequestTimer = null;
    }
    
    // 兼容两种消息格式(action或type)
    const messageType = event.data.action || event.data.type;
    console.log('消息类型:', messageType);
    
    // 确保能获取正确的数据对象
    let resultData = null;
    
    try {
      if (event.data.data) {
        resultData = event.data.data;
        
        // 特殊处理嵌套数据结构
        if (typeof resultData === 'object') {
          // 处理 data.data 格式
          if (resultData.data && typeof resultData.data === 'object') {
            resultData = resultData.data;
          }
          
          // 处理 data.result 格式
          if (resultData.result && typeof resultData.result === 'object') {
            resultData = resultData.result;
          }
          
          // 检查 success 属性
          if (resultData.success === false) {
            console.error('数据包含错误:', resultData.error || '未知错误');
            showError(resultData.error || '未知错误');
            return;
          }
        }
      } else if (event.data.result) {
        // 直接使用 result 属性
        resultData = event.data.result;
      }
      
      console.log('处理后的消息数据:', resultData);
    } catch (error) {
      console.error('解析消息数据时出错:', error);
    }

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
      const spinner = document.querySelector('.loading-spinner');
      if (spinner) {
        spinner.classList.remove('waking-up');
        spinner.classList.remove('long-wait');
      }
      
      // 如果卡片不在结果状态，设置结果状态
      if (cardState !== 'result') {
        console.log('接收到结果数据，处理中...');
      
        // 检查数据合法性
        if (!resultData) {
          console.error('数据为空，显示错误');
          showError('无效的分析数据');
          return;
        }

        try {
          // 分析数据结构
          console.log('分析数据结构:', JSON.stringify(Object.keys(resultData)).substring(0, 200));
          
          // 检查必要的评分属性
          if (resultData.score === undefined) {
            console.warn('结果数据缺少score属性，寻找替代...');
            // 可能在其他嵌套属性中
            if (resultData.trust_score) resultData.score = resultData.trust_score;
            else if (resultData.trustScore) resultData.score = resultData.trustScore;
            else resultData.score = 75; // 默认值
          }
          
          // 设置评分和进度环
          setScoreProgress(resultData.score);
          
          // 生成结果内容
          const resultContent = document.getElementById('result-content');
          if (resultContent) {
            resultContent.innerHTML = createResultContent(resultData);
            console.log('结果内容已生成');
          } else {
            console.error('找不到结果内容容器');
          }
          
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
        console.log('卡片已经处于结果状态，忽略重复数据');
      }
    } else if (messageType === 'SHOW_ERROR') {
      // 显示错误消息
      const errorMsg = event.data.error || event.data.message || '未知错误';
      console.error('收到错误消息:', errorMsg);
      showError(errorMsg);
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
  function createResultContent(data) {
    console.log('创建结果内容，原始数据:', JSON.stringify(data).substring(0, 200) + '...');
    
    try {
      // 标准化数据
      const normalizedData = normalizeResultData(data);
      console.log('标准化后的数据:', normalizedData);
      
      let html = '';
      
      // 添加标志部分
      if (normalizedData.flags && normalizedData.flags.length > 0) {
        html += `
          <div class="section">
            <div class="section-title"><i class="fas fa-flag"></i>${getText('flagsTitle')}</div>
            <div class="flags-container">
              ${createFlagsItems(normalizedData.flags)}
            </div>
          </div>
        `;
      }
      
      // 添加详细分析摘要部分
      if (normalizedData.summary) {
        html += `
          <div class="section">
            <div class="section-title"><i class="fas fa-file-alt"></i>${getText('analysisTitle')}</div>
            <div class="analysis-text">
              ${Array.isArray(normalizedData.summary) ? normalizedData.summary.join('<br>') : normalizedData.summary}
            </div>
          </div>
        `;
      }
      
      // 添加来源部分
      if (normalizedData.sources && normalizedData.sources.length > 0) {
        html += `
          <div class="section">
            <div class="section-title"><i class="fas fa-link"></i>${getText('sourcesTitle')}</div>
            <div class="sources-list">
              ${createSourcesItems(normalizedData.sources)}
            </div>
          </div>
        `;
      }
      
      // 添加实体部分
      if (normalizedData.entities && normalizedData.entities.length > 0) {
        html += `
          <div class="section">
            <div class="section-title"><i class="fas fa-tags"></i>${getText('entitiesTitle')}</div>
            <div class="entities-container">
              ${createEntitiesList(normalizedData.entities)}
            </div>
          </div>
        `;
      }
      
      return html;
    } catch (error) {
      console.error('创建结果内容时出错:', error);
      return `<div class="error-message">${getText('errorRenderingResults')}: ${error.message}</div>`;
    }
  }

  // 标准化结果数据结构
  function normalizeResultData(data) {
    // 创建一个基本结构
    const normalizedData = {
      score: 0,
      summary: '',
      flags: [],
      sources: [],
      entities: []
    };
    
    // 处理嵌套结构
    let workingData = { ...data };
    
    // 向下尝试获取data.data或data.result
    if (workingData.data && typeof workingData.data === 'object') {
      workingData = { ...workingData, ...workingData.data };
    }
    if (workingData.result && typeof workingData.result === 'object') {
      workingData = { ...workingData, ...workingData.result };
    }
    
    // 提取score
    if (workingData.score !== undefined) {
      normalizedData.score = workingData.score;
    } else if (workingData.trust_score !== undefined) {
      normalizedData.score = workingData.trust_score;
    } else if (workingData.trustScore !== undefined) {
      normalizedData.score = workingData.trustScore;
    } else {
      normalizedData.score = 75; // 默认中等信任度
    }
    
    // 提取summary
    if (workingData.summary) {
      normalizedData.summary = workingData.summary;
    } else if (workingData.analysis) {
      normalizedData.summary = workingData.analysis;
    } else if (workingData.content_summary) {
      normalizedData.summary = workingData.content_summary;
    }
    
    // 提取flags
    if (Array.isArray(workingData.flags)) {
      normalizedData.flags = workingData.flags;
    } else if (Array.isArray(workingData.aspectScores)) {
      // 处理另一种格式
      normalizedData.flags = workingData.aspectScores.map(aspect => ({
        name: aspect.name || aspect.aspect,
        score: aspect.score || 0,
        explanation: aspect.description || aspect.explanation || ''
      }));
    } else if (workingData.flags && typeof workingData.flags === 'object') {
      // 处理对象格式的flags
      normalizedData.flags = Object.keys(workingData.flags).map(key => ({
        name: key,
        score: workingData.flags[key].score || workingData.flags[key],
        explanation: workingData.flags[key].explanation || ''
      }));
    }
    
    // 处理sources
    if (Array.isArray(workingData.sources)) {
      normalizedData.sources = workingData.sources;
    } else if (Array.isArray(workingData.references)) {
      normalizedData.sources = workingData.references.map(ref => ({
        url: ref.url || ref.link || '',
        title: ref.title || ref.name || '',
        domain: ref.domain || extractDomainFromUrl(ref.url || ref.link || '')
      }));
    }
    
    // 处理entities
    if (Array.isArray(workingData.entities)) {
      normalizedData.entities = workingData.entities;
    } else if (Array.isArray(workingData.namedEntities)) {
      normalizedData.entities = workingData.namedEntities;
    }
    
    return normalizedData;
  }

  // 从URL中提取域名
  function extractDomainFromUrl(url) {
    try {
      if (!url) return '';
      // 移除协议部分
      let domain = url.replace(/(^\w+:|^)\/\//, '');
      // 获取域名部分
      domain = domain.split('/')[0];
      return domain;
    } catch (e) {
      return url;
    }
  }

  // 创建标志项
  function createFlagsItems(flags) {
    if (!flags || !Array.isArray(flags) || flags.length === 0) {
      return `<div class="no-items">${getText('noFlagsFound')}</div>`;
    }

    return flags.map(flag => {
      // 确保标志有效
      if (!flag || typeof flag !== 'object') return '';
      
      // 获取标志名称和分数
      let name = '';
      let score = 0;
      let icon = 'fa-info-circle';
      
      // 支持多种数据格式
      if (flag.name) name = flag.name;
      else if (flag.title) name = flag.title;
      else if (flag.aspect) name = flag.aspect;
      else if (flag.type) name = flag.type;
      
      // 支持多种评分格式
      if (flag.score !== undefined) score = flag.score;
      else if (flag.value !== undefined) score = flag.value;
      
      // 中文国际化友好的标志名称
      let displayName = name;
      
      // 根据标志名称选择合适的图标
      if (name.includes('政治') || name.includes('偏见') || name.includes('bias') || name.includes('political')) {
        icon = 'fa-balance-scale';
      } else if (name.includes('事实') || name.includes('fact')) {
        icon = 'fa-check-circle';
      } else if (name.includes('情感') || name.includes('sentiment') || name.includes('emotion')) {
        icon = 'fa-heart';
      } else if (name.includes('时效') || name.includes('timely') || name.includes('current')) {
        icon = 'fa-clock';
      } else if (name.includes('一致') || name.includes('consistent')) {
        icon = 'fa-sync-alt';
      } else if (name.includes('来源') || name.includes('source')) {
        icon = 'fa-link';
      } else if (name.includes('专业') || name.includes('expert') || name.includes('professional')) {
        icon = 'fa-user-graduate';
      } else if (name.includes('客观') || name.includes('objective')) {
        icon = 'fa-eye';
      }

      // 根据评分选择颜色
      let colorClass = getTrustColor(score);

      return `
        <div class="flag-item">
          <div class="flag-icon ${colorClass}">
            <i class="fas ${icon}"></i>
          </div>
          <div class="flag-title">${displayName}</div>
          <div class="flag-value ${colorClass}">${Math.round(score)}</div>
        </div>
      `;
    }).join('');
  }

  // 创建来源列表
  function createSourcesItems(sources) {
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return `<div class="no-items">${getText('noSourcesFound')}</div>`;
    }

    // 显示的最大来源数量
    const MAX_VISIBLE_SOURCES = 3;
    const hasHiddenSources = sources.length > MAX_VISIBLE_SOURCES;

    // 构建可见来源的HTML
    const visibleSourcesHtml = sources.slice(0, MAX_VISIBLE_SOURCES).map(source => {
      // 验证来源格式
      if (!source) return '';
      
      let url = '';
      let title = '';
      let domain = '';
      
      // 支持多种数据格式
      if (source.url) url = source.url;
      else if (source.link) url = source.link;
      
      if (source.title) title = source.title;
      else if (source.name) title = source.name;
      
      if (source.domain) domain = source.domain;
      else domain = extractDomainFromUrl(url);
      
      // 如果没有标题，使用域名
      if (!title && domain) title = domain;
      
      // 确保URL是安全的
      const safeUrl = url && url.startsWith('http') ? url : '#';
      
      return `
        <div class="source-item">
          <div class="source-icon"><i class="fas fa-globe"></i></div>
          <div class="source-content">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="source-title">${title || domain || getText('unknownSource')}</a>
            ${domain ? `<div class="source-domain">${domain}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 如果有更多来源，添加"显示更多"按钮
    const showMoreHtml = hasHiddenSources ? `
      <div class="show-more-container">
        <button id="show-more-sources" class="show-more-btn">
          <i class="fas fa-plus-circle"></i> ${getText('showMoreSources')} (${sources.length - MAX_VISIBLE_SOURCES})
        </button>
      </div>
    ` : '';

    // 构建隐藏来源的HTML
    const hiddenSourcesHtml = hasHiddenSources ? `
      <div id="hidden-sources" class="hidden-sources" style="display: none;">
        ${sources.slice(MAX_VISIBLE_SOURCES).map(source => {
          if (!source) return '';
          
          let url = '';
          let title = '';
          let domain = '';
          
          if (source.url) url = source.url;
          else if (source.link) url = source.link;
          
          if (source.title) title = source.title;
          else if (source.name) title = source.name;
          
          if (source.domain) domain = source.domain;
          else domain = extractDomainFromUrl(url);
          
          if (!title && domain) title = domain;
          const safeUrl = url && url.startsWith('http') ? url : '#';
          
          return `
            <div class="source-item">
              <div class="source-icon"><i class="fas fa-globe"></i></div>
              <div class="source-content">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="source-title">${title || domain || getText('unknownSource')}</a>
                ${domain ? `<div class="source-domain">${domain}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    // 组合所有内容
    return `
      ${visibleSourcesHtml}
      ${showMoreHtml}
      ${hiddenSourcesHtml}
    `;
  }

  // 创建实体列表
  function createEntitiesList(entities) {
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return `<div class="no-items">${getText('noEntitiesFound')}</div>`;
    }

    // 显示的最大实体数量
    const MAX_VISIBLE_ENTITIES = 5;
    const hasHiddenEntities = entities.length > MAX_VISIBLE_ENTITIES;

    // 构建可见实体的HTML
    const visibleEntitiesHtml = entities.slice(0, MAX_VISIBLE_ENTITIES).map(entity => {
      if (!entity) return '';
      
      // 支持多种数据格式
      const name = entity.name || entity.text || '';
      const type = entity.type || entity.category || '';
      const score = entity.score || entity.relevance || entity.salience || 0;
      
      // 获取类型图标
      let iconClass = 'fa-tag';
      if (type && type.toLowerCase().includes('person')) iconClass = 'fa-user';
      else if (type && type.toLowerCase().includes('location')) iconClass = 'fa-map-marker-alt';
      else if (type && type.toLowerCase().includes('organization')) iconClass = 'fa-building';
      else if (type && type.toLowerCase().includes('date')) iconClass = 'fa-calendar-alt';
      
      return `
        <div class="entity-item">
          <div class="entity-icon"><i class="fas ${iconClass}"></i></div>
          <div class="entity-content">
            <div class="entity-name">${name}</div>
            ${type ? `<div class="entity-type">${type}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 如果有更多实体，添加"显示更多"按钮
    const showMoreHtml = hasHiddenEntities ? `
      <div class="show-more-container">
        <button id="show-more-entities" class="show-more-btn">
          <i class="fas fa-plus-circle"></i> ${getText('showMoreEntities')} (${entities.length - MAX_VISIBLE_ENTITIES})
        </button>
      </div>
    ` : '';

    // 构建隐藏实体的HTML
    const hiddenEntitiesHtml = hasHiddenEntities ? `
      <div id="hidden-entities" class="hidden-entities" style="display: none;">
        ${entities.slice(MAX_VISIBLE_ENTITIES).map(entity => {
          if (!entity) return '';
          
          const name = entity.name || entity.text || '';
          const type = entity.type || entity.category || '';
          const score = entity.score || entity.relevance || entity.salience || 0;
          
          let iconClass = 'fa-tag';
          if (type && type.toLowerCase().includes('person')) iconClass = 'fa-user';
          else if (type && type.toLowerCase().includes('location')) iconClass = 'fa-map-marker-alt';
          else if (type && type.toLowerCase().includes('organization')) iconClass = 'fa-building';
          else if (type && type.toLowerCase().includes('date')) iconClass = 'fa-calendar-alt';
          
          return `
            <div class="entity-item">
              <div class="entity-icon"><i class="fas ${iconClass}"></i></div>
              <div class="entity-content">
                <div class="entity-name">${name}</div>
                ${type ? `<div class="entity-type">${type}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    // 组合所有内容
    return `
      ${visibleEntitiesHtml}
      ${showMoreHtml}
      ${hiddenEntitiesHtml}
    `;
  }

  // 应用语言本地化到所有静态UI元素
  function applyLanguageTexts() {
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
    
    // 设置加载文本
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = getText('loadingText');
    }
    
    // 持久化文本
    const persistLabel = document.querySelector('.persist-label');
    if (persistLabel) {
      persistLabel.textContent = getText('persistCard');
    }
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

  // 添加持久化开关
  function addPersistenceToggle() {
    const container = document.querySelector('.card-header') || document.querySelector('.card-container');
    if (!container) return;
    
    const persistToggle = document.createElement('div');
    persistToggle.className = 'persist-toggle';
    persistToggle.innerHTML = `
      <label class="persist-switch">
        <input type="checkbox" id="persistence-checkbox">
        <span class="persist-slider round"></span>
      </label>
      <span class="persist-label">${getText('persistCard')}</span>
    `;
    container.appendChild(persistToggle);
    
    // 设置样式
    const style = document.createElement('style');
    style.textContent = `
      .persist-toggle {
        display: flex;
        align-items: center;
        margin-left: auto;
        margin-right: 10px;
      }
      .persist-switch {
        position: relative;
        display: inline-block;
        width: 30px;
        height: 17px;
      }
      .persist-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .persist-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        -webkit-transition: .3s;
        transition: .3s;
      }
      .persist-slider:before {
        position: absolute;
        content: "";
        height: 13px;
        width: 13px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        -webkit-transition: .3s;
        transition: .3s;
      }
      .persist-slider.round {
        border-radius: 17px;
      }
      .persist-slider.round:before {
        border-radius: 50%;
      }
      input:checked + .persist-slider {
        background-color: #3366cc;
      }
      input:focus + .persist-slider {
        box-shadow: 0 0 1px #3366cc;
      }
      input:checked + .persist-slider:before {
        -webkit-transform: translateX(13px);
        -ms-transform: translateX(13px);
        transform: translateX(13px);
      }
      .persist-label {
        margin-left: 5px;
        font-size: 12px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
    
    // 添加事件监听器
    const checkbox = document.getElementById('persistence-checkbox');
    checkbox.checked = globalState.isPersisted;
    
    checkbox.addEventListener('change', (e) => {
      globalState.isPersisted = e.target.checked;
      
      // 通知内容脚本
      window.parent.postMessage({
        type: 'PERSIST_CARD',
        persist: globalState.isPersisted
      }, '*');
      
      debugLog('设置卡片持久化状态:', globalState.isPersisted);
    });
  }

  // 初始化UI
  function initUI() {
    createCardStructure();
    setCardState('loading');
    addStyles();
    
    // 添加持久化开关
    addPersistenceToggle();
    
    // 添加事件监听器
    document.getElementById('close-button').addEventListener('click', closeCard);
    
    // 请求数据
    requestResultData();
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