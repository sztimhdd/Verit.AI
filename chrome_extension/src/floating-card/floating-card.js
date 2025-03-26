/**
 * VeritAI Fact Checker - 浮动卡片脚本
 */

// DOM 元素
const cardEl = document.querySelector('.floating-card');
const closeButton = document.getElementById('closeCard');
const analyzingStateEl = document.getElementById('analyzing-state');
const resultStateEl = document.getElementById('result-state');
const errorStateEl = document.getElementById('error-state');
const factStatusContainer = document.getElementById('fact-status-container');
const factStatusIcon = document.getElementById('fact-status-icon');
const factStatusText = document.getElementById('fact-status-text');
const highlightedTextEl = document.getElementById('highlighted-text');
const analysisDetailsEl = document.getElementById('analysis-details');
const sourceListEl = document.getElementById('source-list');
const errorMessageEl = document.getElementById('error-message');
const langOptions = document.querySelectorAll('.lang-option');

// 状态
let currentState = 'analyzing'; // analyzing, result, error
let currentLanguage = 'zh';
let currentData = null;

// 显示分析中状态
function showAnalyzingState() {
  analyzingStateEl.style.display = 'block';
  resultStateEl.style.display = 'none';
  errorStateEl.style.display = 'none';
  currentState = 'analyzing';
}

// 显示结果状态
function showResultState(data) {
  analyzingStateEl.style.display = 'none';
  resultStateEl.style.display = 'block';
  errorStateEl.style.display = 'none';
  currentState = 'result';
  
  updateResultContent(data);
}

// 显示错误状态
function showErrorState(error) {
  analyzingStateEl.style.display = 'none';
  resultStateEl.style.display = 'none';
  errorStateEl.style.display = 'block';
  currentState = 'error';
  
  errorMessageEl.textContent = error || '分析过程中发生错误';
}

// 更新结果内容
function updateResultContent(data) {
  if (!data) return;
  
  currentData = data;
  
  // 根据可信度更新状态图标和文本
  const status = getStatusFromVeracity(data.veracity);
  updateFactStatus(status);
  
  // 更新高亮文本
  if (data.highlightedText) {
    highlightedTextEl.textContent = data.highlightedText;
  } else {
    highlightedTextEl.textContent = '';
  }
  
  // 更新分析详情
  analysisDetailsEl.textContent = data.analysis || '';
  
  // 更新来源列表
  updateSourcesList(data.sources || []);
}

// 根据可信度获取状态
function getStatusFromVeracity(veracity) {
  if (!veracity) return 'unverified';
  
  const score = typeof veracity === 'number' ? veracity : 
               (veracity.score ? veracity.score : 0);
  
  if (score >= 80) return 'verified';
  if (score <= 30) return 'incorrect';
  return 'unverified';
}

// 更新事实状态
function updateFactStatus(status) {
  // 移除之前的状态类
  factStatusContainer.classList.remove('status-verified', 'status-unverified', 'status-incorrect', 'status-analyzing');
  
  // 添加新状态类
  factStatusContainer.classList.add(`status-${status}`);
  
  // 更新图标
  let iconClass = '';
  switch (status) {
    case 'verified':
      iconClass = 'fas fa-check-circle';
      break;
    case 'unverified':
      iconClass = 'fas fa-question-circle';
      break;
    case 'incorrect':
      iconClass = 'fas fa-times-circle';
      break;
    default:
      iconClass = 'fas fa-search';
  }
  
  factStatusIcon.className = `fact-status-icon ${iconClass}`;
  
  // 更新文本
  const messageKey = `status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  factStatusText.textContent = chrome.i18n.getMessage(messageKey) || status;
}

// 更新来源列表
function updateSourcesList(sources) {
  // 清空当前列表
  while (sourceListEl.children.length > 1) {
    sourceListEl.removeChild(sourceListEl.lastChild);
  }
  
  // 如果没有来源，隐藏整个部分
  if (!sources || sources.length === 0) {
    sourceListEl.style.display = 'none';
    return;
  }
  
  // 显示来源列表
  sourceListEl.style.display = 'block';
  
  // 添加每个来源
  sources.forEach((source, index) => {
    const sourceItem = document.createElement('div');
    sourceItem.className = 'source-item';
    
    const sourceIndex = document.createElement('div');
    sourceIndex.className = 'source-index';
    sourceIndex.textContent = index + 1;
    
    const sourceLink = document.createElement('a');
    sourceLink.className = 'source-link';
    sourceLink.href = source.url || '#';
    sourceLink.target = '_blank';
    sourceLink.textContent = source.title || source.url || `来源 ${index + 1}`;
    
    sourceItem.appendChild(sourceIndex);
    sourceItem.appendChild(sourceLink);
    sourceListEl.appendChild(sourceItem);
  });
}

// 设置语言
function setLanguage(lang) {
  currentLanguage = lang;
  
  // 更新语言选择器UI
  langOptions.forEach(option => {
    const optionLang = option.getAttribute('data-lang');
    if (optionLang === lang) {
      option.classList.add('active');
        } else {
      option.classList.remove('active');
    }
  });
  
  // 翻译界面
  translateUI();
  
  // 通知父窗口更新语言
  window.parent.postMessage({
    action: 'SET_LANGUAGE',
    language: lang
  }, '*');
}

// 翻译界面
function translateUI() {
  // 翻译使用data-i18n属性的元素
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.textContent = message;
    }
  });
  
  // 如果有结果数据，重新翻译状态文本
  if (currentState === 'result' && currentData) {
    const status = getStatusFromVeracity(currentData.veracity);
    const messageKey = `status${status.charAt(0).toUpperCase() + status.slice(1)}`;
    factStatusText.textContent = chrome.i18n.getMessage(messageKey) || status;
  }
}

// 关闭卡片
function closeCard() {
  // 通知父窗口关闭卡片
  window.parent.postMessage({
    action: 'CLOSE_CARD'
  }, '*');
}

// 事件监听器
function setupEventListeners() {
  // 关闭按钮
  closeButton.addEventListener('click', closeCard);
  
  // 语言切换
  langOptions.forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.getAttribute('data-lang');
      if (lang && lang !== currentLanguage) {
        setLanguage(lang);
      }
    });
  });
}

// 消息监听
window.addEventListener('message', (event) => {
  // 确保消息来自父窗口
  if (event.source === window.parent) {
    const { action, data, language } = event.data;
    
    switch (action) {
      case 'UPDATE_CONTENT':
        if (data.error) {
          showErrorState(data.error);
        } else {
          showResultState(data);
        }
        
        if (language) {
          setLanguage(language);
        }
        break;
        
      case 'SET_LANGUAGE':
        if (language) {
          setLanguage(language);
        }
        break;
        
      case 'SHOW_ERROR':
        showErrorState(data);
        break;
    }
  }
});

// 初始化
function init() {
  // 从存储中获取语言设置
  chrome.storage.local.get('language', (result) => {
    if (result.language) {
      currentLanguage = result.language;
    }
    
    // 设置初始状态
    showAnalyzingState();
    
    // 设置语言
    setLanguage(currentLanguage);
    
    // 设置事件监听器
    setupEventListeners();
  });
}

// 启动
document.addEventListener('DOMContentLoaded', init); 