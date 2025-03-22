// 监听页面卸载事件
window.addEventListener('beforeunload', removeFloatingCard);

// 监听 URL 变化
let lastUrl = location.href;
let urlObserver = null;

function initializeUrlObserver() {
  if (urlObserver) {
    urlObserver.disconnect();
  }

  urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      handleUrlChange();
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });
}

// 使用 History API 监听 URL 变化
window.addEventListener('popstate', () => handleUrlChange());

// 处理 URL 变化
function handleUrlChange() {
  removeFloatingCard();
  try {
    chrome.runtime.sendMessage({ 
      type: 'URL_CHANGED',
      oldUrl: lastUrl,
      newUrl: location.href
    });
  } catch (error) {
    // 忽略扩展上下文失效错误
    if (!error.message.includes('Extension context invalidated')) {
      console.error('URL变化处理错误:', error);
    }
  }
}

// 移除浮动卡片
function removeFloatingCard() {
  const frame = document.getElementById('factChecker-frame');
  if (frame) {
    frame.remove();
  }
}

// 合并所有消息监听逻辑到一个统一的监听器
function initializeMessageListeners() {
  try {
    if (!chrome.runtime) {
      console.warn('chrome.runtime 不可用');
      return;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message);

      switch (message.type) {
        case 'SHOW_RESULT':
          console.log('Received SHOW_RESULT in content script:', message.data);
          const resultFrame = document.querySelector('#factChecker-frame');
          if (resultFrame) {
            console.log('Found frame, sending message to floating card');
            resultFrame.contentWindow.postMessage({
              type: 'UPDATE_RESULT',
              data: message.data
            }, '*');
          } else {
            console.warn('No floating card frame found!');
          }
          sendResponse({ success: true });
          break;

        case 'SHOW_ERROR':
          const errorFrame = document.querySelector('#factChecker-frame');
          if (errorFrame) {
            errorFrame.contentWindow.postMessage({
              type: 'SHOW_ERROR',
              error: message.error
            }, '*');
          }
          sendResponse({ success: true });
          break;

        case 'EXTRACT_CONTENT':
          try {
            const content = document.body.innerText;
            const title = document.title;
            const url = window.location.href;
            
            sendResponse({
              success: true,
              data: { content, title, url }
            });
          } catch (error) {
            sendResponse({
              success: false,
              error: error.message
            });
          }
          break;

        case 'REMOVE_CARD':
          removeFloatingCard();
          sendResponse({ success: true });
          break;
      }

      return true; // 保持消息通道开放
    });

  } catch (error) {
    // 忽略扩展上下文失效错误
    if (!error.message.includes('Extension context invalidated')) {
      console.error('消息监听器设置错误:', error);
    }
  }
}

// 修改 initialize 函数
function initialize() {
  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeMessageListeners();
      initializeUrlObserver();
    });
  } else {
    initializeMessageListeners();
    initializeUrlObserver();
  }

  // 监听 History API 变化
  window.addEventListener('popstate', handleUrlChange);
  
  // 监听来自 floating-card 的消息
  window.addEventListener('message', (event) => {
    const iframe = document.querySelector('#factChecker-frame');
    
    if (!iframe) return;

    switch (event.data.type) {
      case 'RESIZE_FRAME':
        console.log('content.js 接收到 RESIZE_FRAME 消息:', event.data);
        iframe.style.width = `${event.data.width}px`;
        iframe.style.height = `${event.data.height}px`;
        console.log('iframe 样式已更新为:', { width: iframe.style.width, height: iframe.style.height });
        break;
        
      case 'REMOVE_FRAME':
        removeFloatingCard();
        break;
        
      case 'CARD_READY':
        // 通知 background.js 卡片已准备就绪
        if (chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CARD_READY' });
        }
        break;
    }
  });
}

// 启动初始化
initialize();

// 添加 cleanup 函数
function cleanup() {
  // 移除浮动卡片
  removeFloatingCard();
  
  // 断开 URL 观察器
  if (urlObserver) {
    urlObserver.disconnect();
    urlObserver = null;
  }
  
  // 移除事件监听器
  window.removeEventListener('popstate', handleUrlChange);
  window.removeEventListener('beforeunload', removeFloatingCard);
}

// 导出清理函数供外部使用
window.factCheckerCleanup = cleanup;

// 通知 background script content script 已加载
chrome.runtime.sendMessage({ action: 'contentScriptReady' });

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