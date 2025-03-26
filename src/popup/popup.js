// 初始化UI文本
function initializeUI() {
  // 标题
  document.getElementById('appTitle').textContent = chrome.i18n.getMessage('extName');
  
  // 状态文本
  const statusText = document.getElementById('statusText');
  statusText.textContent = chrome.i18n.getMessage('serviceStatus', [
    chrome.i18n.getMessage('statusReady')
  ]);
  
  // 分析按钮
  const analyzeBtn = document.getElementById('analyzeButton');
  analyzeBtn.textContent = chrome.i18n.getMessage('analyze');
  
  // 其他UI元素...
  document.getElementById('feedbackLink').textContent = chrome.i18n.getMessage('feedback');
  
  // 设置状态更新函数
  window.updateStatus = function(status) {
    const statusMessage = chrome.i18n.getMessage(`status${status}`);
    statusText.textContent = chrome.i18n.getMessage('serviceStatus', [statusMessage]);
  };
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializeUI); 