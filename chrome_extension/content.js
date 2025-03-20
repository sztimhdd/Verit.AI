// 监听来自 background script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'getPageContent') {
    // 优化内容提取
    const content = document.body ? extractMainContent(document.body) : '';
    console.log('Sending page content:', content.substring(0, 100) + '...');
    sendResponse({ content });
  }
  
  return true; // 保持消息通道开放
});

function extractMainContent(body) {
  // 移除导航、页眉、页脚等非主要内容
  const excludeSelectors = [
    'nav',
    'header',
    'footer',
    '.navigation',
    '.skip-link',
    '.site-index',
    '[role="navigation"]',
    'script',
    'style',
    'noscript',
    'iframe',
    'img'
  ];
  
  // 创建副本以避免修改原始 DOM
  const clone = body.cloneNode(true);
  
  // 移除不需要的元素
  excludeSelectors.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  // 获取清理后的文本并限制长度
  const text = clone.innerText.trim();
  // 限制为大约 10000 个字符（约 5000 个汉字）
  return text.length > 10000 ? text.substring(0, 10000) + '...' : text;
}

// 通知 background script content script 已加载
chrome.runtime.sendMessage({ action: 'contentScriptReady' });