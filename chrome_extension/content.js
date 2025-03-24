// 监听页面卸载事件
window.addEventListener('beforeunload', removeFloatingCard);

// 监听 URL 变化
let lastUrl = location.href;
let urlObserver = null;
let reconnectTimer = null;  // 移到顶部确保在使用前声明

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
  
  // 使用安全发送函数
  sendMessageSafely({ 
    type: 'URL_CHANGED',
    oldUrl: lastUrl,
    newUrl: location.href
  });
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
    if (!isExtensionContextValid()) {
      console.warn('扩展上下文无效，跳过消息监听器初始化');
      return;
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message);

      // 添加对PING消息的处理
      if (message.type === 'PING') {
        sendResponse({ ready: true });
        return true;
      }
      
      // 添加对静默PING的处理（不记录日志）
      if (message.type === 'SILENT_PING') {
        sendResponse({ ready: true });
        return true;
      }

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

        case 'SERVICE_WAKING':
          const frame = document.querySelector('#factChecker-frame');
          if (frame) {
            frame.contentWindow.postMessage({
              type: 'SERVICE_WAKING',
              message: message.message
            }, '*');
          }
          sendResponse({ success: true });
          break;
      }

      return true; // 保持消息通道开放
    });

  } catch (error) {
    console.warn('设置消息监听器失败:', error.message);
  }
}

// 添加重连机制
function setupReconnectionMechanism() {
  // 清除任何现有的重连定时器
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
  }
  
  // 每30秒尝试重新连接一次
  reconnectTimer = setInterval(() => {
    if (isExtensionContextValid()) {
      console.log('扩展上下文有效，重新初始化监听器');
      initializeMessageListeners();
    } else {
      console.warn('扩展上下文仍然无效，稍后将再次尝试');
    }
  }, 30000);
}

// 修改 initialize 函数
function initialize() {
  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeMessageListeners();
      initializeUrlObserver();
      signalContentReady();
    });
  } else {
    initializeMessageListeners();
    initializeUrlObserver();
    signalContentReady();
  }

  // 监听 History API 变化
  window.addEventListener('popstate', handleUrlChange);
  
  // 监听来自 floating-card 的消息
  window.addEventListener('message', handleFrameMessages);

  // 确保setupReconnectionMechanism在使用前已定义
  setupReconnectionMechanism();
}

// 分离出消息处理函数
function handleFrameMessages(event) {
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
    case 'LANGUAGE_DETECTED':
      // 使用安全发送函数
      sendMessageSafely({ 
        type: 'SET_LANGUAGE',
        lang: event.data.lang
      });
      console.log('语言偏好已发送:', event.data.lang);
      break;
  }
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
  
  // 清除重连定时器
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
  
  // 移除事件监听器
  window.removeEventListener('popstate', handleUrlChange);
  window.removeEventListener('beforeunload', removeFloatingCard);
}

// 导出清理函数供外部使用
window.factCheckerCleanup = cleanup;

// 通知 background script content script 已加载
try {
  if (isExtensionContextValid()) {
    chrome.runtime.sendMessage({ action: 'contentScriptReady' })
      .catch(error => console.warn('发送就绪信号失败:', error));
  }
} catch (error) {
  console.warn('初始就绪信号发送失败:', error);
}

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

// 添加强健的扩展上下文检查函数
function isExtensionContextValid() {
  try {
    // 尝试访问chrome.runtime.id - 如果上下文无效会抛出异常
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// 安全的消息发送函数
function sendMessageSafely(message, callback) {
  try {
    // 先检查扩展上下文是否有效
    if (!isExtensionContextValid()) {
      console.warn('扩展上下文已失效，无法发送消息:', message.type);
      return;
    }

    // 使用Promise处理消息发送
    chrome.runtime.sendMessage(message)
      .then(response => {
        if (callback && typeof callback === 'function') {
          callback(response);
        }
      })
      .catch(error => {
        // 忽略特定错误类型
        if (error && (
            error.message.includes('Extension context invalidated') ||
            error.message.includes('Receiving end does not exist')
          )) {
          console.warn(`消息发送失败(${error.message})，忽略此错误`);
        } else {
          console.error('消息发送失败:', error);
        }
      });
  } catch (error) {
    // 捕获所有其他可能的错误
    console.warn('发送消息过程中出现异常:', error.message);
  }
}

// 新增：通知后台脚本content script已就绪
function signalContentReady() {
  setTimeout(() => {
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' })
          .catch(() => console.warn('无法发送content script就绪信号'));
      } catch (error) {
        console.warn('发送就绪信号出错:', error);
      }
    }
  }, 100);
}