// 初始化卡片UI
function initializeCardUI() {
  // 标题
  document.getElementById('resultTitle').textContent = chrome.i18n.getMessage('resultTitle');
  
  // 分类标签
  document.getElementById('factualityLabel').textContent = chrome.i18n.getMessage('factuality');
  document.getElementById('objectivityLabel').textContent = chrome.i18n.getMessage('objectivity');
  document.getElementById('reliabilityLabel').textContent = chrome.i18n.getMessage('reliability');
  document.getElementById('biasLabel').textContent = chrome.i18n.getMessage('bias');
  
  // 摘要标题
  document.getElementById('summaryLabel').textContent = chrome.i18n.getMessage('summary');
  
  // 来源标题
  document.getElementById('sourcesLabel').textContent = chrome.i18n.getMessage('sources');
  
  // 关闭按钮
  document.getElementById('closeButton').textContent = chrome.i18n.getMessage('close');
}

// 将评分转换为文本
function getFactualityText(level) {
  if (level === 'high' || level === '高') {
    return chrome.i18n.getMessage('factualityHigh');
  } else if (level === 'medium' || level === '中') {
    return chrome.i18n.getMessage('factualityMedium');
  } else {
    return chrome.i18n.getMessage('factualityLow');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', initializeCardUI);

// 添加消息监听器，处理语言更新
window.addEventListener('message', (event) => {
  if (event.data.action === 'SET_LANGUAGE') {
    // 更新UI文本
    initializeCardUI();
    
    // 如果有数据，重新渲染结果
    if (window.currentData) {
      renderAnalysisResult(window.currentData);
    }
    
    console.log(`浮动卡片语言已更新为: ${event.data.language}`);
  }
});

// 修改渲染函数，支持国际化显示
function renderAnalysisResult(data) {
  window.currentData = data;
  
  // 更新各项评分的显示文本
  document.getElementById('factualityValue').textContent = 
    chrome.i18n.getMessage(`factuality${capitalize(data.flags.factuality)}`);
  document.getElementById('objectivityValue').textContent = 
    chrome.i18n.getMessage(`factuality${capitalize(data.flags.objectivity)}`);
  // ... 其他评分项的国际化显示
  
  // 设置摘要文本
  document.getElementById('summaryContent').textContent = data.summary;
  
  // 设置来源链接...
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
} 