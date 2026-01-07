/**
 * VeritAI Fact Checker - 内容脚本
 */

// 全局状态
const state = {
  floatingCard: null,
  isCardVisible: false,
  currentData: null,
  language: 'zh', // 默认语言
  highlightManager: null // Highlight manager instance
};

// 创建浮动卡片
function createFloatingCard() {
  if (state.floatingCard) {
    return Promise.resolve(state.floatingCard);
  }

  // 检查并移除可能存在的旧卡片
  const existingFrame = document.getElementById('veritai-floating-card-frame') || 
                        document.getElementById('factChecker-frame');
  if (existingFrame && existingFrame.parentNode) {
    try {
      existingFrame.parentNode.removeChild(existingFrame);
    } catch (e) {
      if (existingFrame.remove) {
        existingFrame.remove();
      }
    }
  }

  // 创建新iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'veritai-floating-card-frame'; // 统一使用这个ID
  iframe.src = chrome.runtime.getURL('floating-card.html');
  iframe.classList.add('veritai-floating-card-frame');
  
  // 添加到页面
  document.body.appendChild(iframe);
  state.floatingCard = iframe;

  // 等待iframe加载完成
  return new Promise((resolve) => {
    iframe.onload = () => {
      setTimeout(() => {
        iframe.classList.add('veritai-frame-visible');
      }, 100);
      resolve(iframe);
    };
  });
}

// 提取页面内容
function extractContent() {
  try {
    const content = document.body.innerText;
    const title = document.title;
    const url = window.location.href;
    return {
      success: true,
      data: { content, title, url }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 显示浮动卡片
async function showFloatingCard(data) {
  try {
    if (!data) {
      throw new Error('无效的分析数据');
    }

    // 1. 创建或获取浮动卡片
    const iframe = await createFloatingCard();
    state.isCardVisible = true;
    state.currentData = data;

    // 2. 等待iframe加载完成
    return new Promise((resolve) => {
      setTimeout(() => {
        // 3. 向iframe发送数据
        iframe.contentWindow.postMessage({
          action: 'UPDATE_CONTENT',
          data: data,
          language: state.language
        }, '*');
        resolve({ success: true });
      }, 300);
    });
  } catch (error) {
    console.error('显示浮动卡片失败:', error);
    return { success: false, error: error.message };
  }
}

// 隐藏浮动卡片
function hideFloatingCard() {
  console.log('执行隐藏浮动卡片');
  
  // 查找所有可能的浮动卡片元素
  const iframeById = document.getElementById('veritai-floating-card-frame');
  const iframeByClass = document.querySelector('.veritai-floating-card-frame');
  const factCheckerFrame = document.getElementById('factChecker-frame');
  
  // 确定要移除的元素
  const frameToRemove = state.floatingCard || iframeById || iframeByClass || factCheckerFrame;
  
  if (frameToRemove) {
    // 先隐藏元素
    frameToRemove.classList.remove('veritai-frame-visible');
    
    // 在动画完成后移除元素
    setTimeout(() => {
      try {
        // 检查元素是否仍在DOM中
        if (frameToRemove.parentNode) {
          frameToRemove.parentNode.removeChild(frameToRemove);
          console.log('浮动卡片已成功移除');
        } else {
          console.log('浮动卡片已不在DOM中');
        }
        
        // 重置状态
        state.floatingCard = null;
        state.isCardVisible = false;
      } catch (error) {
        console.error('移除浮动卡片失败:', error);
        
        // 尝试备用移除方法
        try {
          if (frameToRemove && frameToRemove.remove) {
            frameToRemove.remove();
            console.log('使用备用方法移除浮动卡片');
          }
          
          // 重置状态
          state.floatingCard = null;
          state.isCardVisible = false;
        } catch (backupError) {
          console.error('备用移除方法也失败:', backupError);
        }
      }
    }, 300);
  } else {
    console.log('未找到浮动卡片元素');
  }
  
  return { success: true };
}

// 设置语言
function setLanguage(lang) {
  state.language = lang;
  
  // 如果卡片已显示，更新语言
  if (state.isCardVisible && state.floatingCard && state.currentData) {
    state.floatingCard.contentWindow.postMessage({
      action: 'SET_LANGUAGE',
      language: lang
    }, '*');
  }
  return { success: true };
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);

  switch (message.action) {
    case 'EXTRACT_CONTENT':
      sendResponse(extractContent());
      break;

    case 'showFloatingCard':
      if (message.data) {
        showFloatingCard(message.data)
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ 
            success: false, 
            error: error.message 
          }));
        return true; // 保持消息通道开放
      } else {
        sendResponse({ 
          success: false, 
          error: '无效的分析数据' 
        });
      }
      break;

    case 'hideFloatingCard':
      sendResponse(hideFloatingCard());
      break;

    case 'setLanguage':
      sendResponse(setLanguage(message.language));
      break;

    case 'applyHighlights':
      if (message.data && state.highlightManager) {
        state.highlightManager.applyHighlights(message.data)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开放
      } else {
        sendResponse({ success: false, error: '无效的分析数据或HighlightManager未初始化' });
      }
      break;

    case 'clearHighlights':
      if (state.highlightManager) {
        state.highlightManager.clearHighlights();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'HighlightManager未初始化' });
      }
      break;

    case 'ping':
      // 用于检查内容脚本是否已加载
      sendResponse({ success: true });
      break;
        
    default:
      // 未知操作
      break;
  }
});

// 监听来自iframe的消息
window.addEventListener('message', (event) => {
  console.log('收到来自浮动卡片的消息:', event.data);
  
  // 兼容两种消息格式
  const msgType = event.data.type || event.data.action;
  
  // 确保消息来自我们的iframe
  if ((state.floatingCard && event.source === state.floatingCard.contentWindow) || 
      document.getElementById('veritai-floating-card-frame') || 
      document.getElementById('factChecker-frame')) {
    
    // 处理关闭消息
    if (msgType === 'REMOVE_FRAME' || msgType === 'CLOSE_CARD') {
      console.log('处理关闭卡片请求');
      hideFloatingCard();
    }
    
    // ... 其他消息处理
  }
});

// 初始化
function init() {
  console.log('VeritAI Fact Checker内容脚本已加载');
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .veritai-floating-card-frame {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      height: 600px;
      border: none;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      opacity: 0;
      transform: translateY(-10px);
      background-color: white;
    }
    
    .veritai-frame-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
  
  // 从存储中获取语言设置
  chrome.storage.local.get('language', (result) => {
    if (result.language) {
      state.language = result.language;
    }
  });
}

// 启动
init();

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
  
  // 清除页面上的高亮
  if (state.highlightManager) {
    state.highlightManager.clearHighlights();
  }
  
  // 使用安全发送函数
  sendMessageSafely({ 
    type: 'URL_CHANGED',
    oldUrl: lastUrl,
    newUrl: location.href
  });
}

// 移除浮动卡片
function removeFloatingCard() {
  try {
    // 查找所有可能的浮动卡片元素
    const frames = [
      document.getElementById('veritai-floating-card-frame'),
      document.querySelector('.veritai-floating-card-frame'),
      document.getElementById('factChecker-frame')
    ];
    
    // 移除找到的每个元素
    frames.forEach(frame => {
      if (frame && frame.parentNode) {
        try {
          frame.parentNode.removeChild(frame);
        } catch (e) {
          // 如果removeChild失败，尝试使用remove方法
          if (frame.remove) {
            frame.remove();
          }
        }
      }
    });
    
    // 重置状态
    if (state) {
      state.floatingCard = null;
      state.isCardVisible = false;
    }
  } catch (error) {
    console.error('移除浮动卡片时出错:', error);
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
  // 初始化HighlightManager
  try {
    state.highlightManager = new HighlightManager();
    state.highlightManager.init();
    console.log('[Content] HighlightManager initialized');
  } catch (error) {
    console.error('[Content] Failed to initialize HighlightManager:', error);
  }

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
  
  // 清理HighlightManager
  if (state.highlightManager) {
    state.highlightManager.destroy();
    state.highlightManager = null;
  }
  
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
        chrome.runtime.sendMessage({ action: 'contentScriptReady' })
          .catch(() => console.warn('无法发送content script就绪信号'));
      } catch (error) {
        console.warn('发送就绪信号出错:', error);
      }
    }
  }, 100);
}

// 统一消息处理函数
function sendMessageToFloatingCard(message) {
  if (!state.floatingCard) {
    console.warn('浮动卡片不存在，无法发送消息');
    return false;
  }
  
  try {
    state.floatingCard.contentWindow.postMessage(message, '*');
    return true;
  } catch (error) {
    console.error('向浮动卡片发送消息失败:', error);
    return false;
  }
}