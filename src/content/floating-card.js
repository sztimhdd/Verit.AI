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