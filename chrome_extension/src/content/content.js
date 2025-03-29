/**
 * VeritAI Fact Checker - 内容脚本 (精简版)
 */

// 全局状态
const state = {
  floatingCard: null,
  isCardVisible: false,
  currentData: null,
  language: 'zh',
  cardPersisted: false
};

// 检查扩展上下文是否有效
function isExtensionValid() {
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// 创建浮动卡片
async function createFloatingCard() {
  if (state.floatingCard) return Promise.resolve(state.floatingCard);

  // 移除可能存在的旧卡片
  removeFloatingCard();

  // 创建新iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'veritai-floating-card-frame';
  iframe.src = chrome.runtime.getURL('src/floating-card/floating-card.html');
  iframe.classList.add('veritai-floating-card-frame');
  
  // 添加到页面
  document.body.appendChild(iframe);
  state.floatingCard = iframe;

  // 等待iframe加载完成
  return new Promise((resolve) => {
    iframe.onload = () => {
      setTimeout(() => iframe.classList.add('veritai-frame-visible'), 100);
      resolve(iframe);
    };
  });
}

// 提取页面内容
function extractContent() {
  try {
    return {
      success: true,
      data: {
        content: document.body.innerText,
        title: document.title,
        url: window.location.href
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 向浮动卡片发送消息
function sendToFloatingCard(data) {
  if (!state.floatingCard || !state.floatingCard.contentWindow) return false;
  
  state.floatingCard.contentWindow.postMessage({
    type: 'UPDATE_CONTENT',
    data: data,
    language: state.language
  }, '*');
  
  return true;
}

// 显示浮动卡片
async function showFloatingCard(data) {
  try {
    const frame = await createFloatingCard();
    state.currentData = data;
    
    if (frame.contentWindow) {
      // 延迟发送数据，确保卡片已完全初始化
      setTimeout(() => sendToFloatingCard(data), 300);
      state.isCardVisible = true;
      return { success: true };
    }
    
    return { success: false, error: '无法获取浮动卡片窗口' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 隐藏浮动卡片
function hideFloatingCard() {
  if (!state.floatingCard) return { success: true };
  
  try {
    // 动画隐藏
    state.floatingCard.classList.remove('veritai-frame-visible');
    
    // 动画结束后移除
    setTimeout(() => {
      if (state.floatingCard && state.floatingCard.parentNode) {
        state.floatingCard.parentNode.removeChild(state.floatingCard);
        state.floatingCard = null;
        state.isCardVisible = false;
      }
    }, 300);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 移除浮动卡片
function removeFloatingCard() {
  const frames = [
    document.getElementById('veritai-floating-card-frame'),
    document.getElementById('factChecker-frame')
  ];
  
  frames.forEach(frame => {
    if (frame && frame.parentNode) {
      try {
        frame.parentNode.removeChild(frame);
      } catch (e) {
        if (frame.remove) frame.remove();
      }
    }
  });
  
  state.floatingCard = null;
  state.isCardVisible = false;
}

// 设置语言
function setLanguage(lang) {
  if (lang === 'zh' || lang === 'en') {
    state.language = lang;
    chrome.storage.local.set({ 'language': lang });
    
    if (state.isCardVisible && state.floatingCard && state.currentData) {
      state.floatingCard.contentWindow.postMessage({
        action: 'SET_LANGUAGE',
        language: lang
      }, '*');
    }
  }
  return { success: true };
}

// 安全发送消息到后台
function sendToBackground(message, callback) {
  if (!isExtensionValid()) return;
  
  chrome.runtime.sendMessage(message)
    .then(response => {
      if (callback) callback(response);
    })
    .catch(error => {
      // 忽略常见错误
      if (!error.message.includes('Extension context invalidated') && 
          !error.message.includes('Receiving end does not exist')) {
        console.error('发送消息失败:', error);
      }
    });
}

// 处理浮动卡片发来的消息
function handleFrameMessage(event) {
  // 确保消息来自我们的iframe
  if (!state.floatingCard || event.source !== state.floatingCard.contentWindow) return;
  
  const messageType = event.data.type || event.data.action;
  
  switch (messageType) {
    case 'CLOSE_CARD':
    case 'REMOVE_FRAME':
      state.cardPersisted = false;
      hideFloatingCard();
      break;
      
    case 'DATA_REQUEST':
      if (state.currentData) sendToFloatingCard(state.currentData);
      break;
      
    case 'LANGUAGE_CHANGE':
      setLanguage(event.data.language);
      break;
      
    case 'PERSIST_CARD':
      state.cardPersisted = event.data.persist === true;
      break;
      
    case 'RESIZE_CARD':
      if (event.data.height && state.floatingCard) {
        state.floatingCard.style.height = `${event.data.height}px`;
      }
      break;
  }
}

// 处理来自后台的消息
function handleBackgroundMessage(message, sender, sendResponse) {
  const { action, type, data, error } = message;
  
  // 响应ping请求
  if (type === 'PING' || type === 'SILENT_PING') {
    sendResponse({ ready: true });
    return true;
  }
  
  // 处理action类型消息
  switch (action) {
    case 'EXTRACT_CONTENT':
      sendResponse(extractContent());
      break;
      
    case 'showFloatingCard':
      if (data) {
        if (message.persist !== undefined) {
          state.cardPersisted = message.persist;
        }
        showFloatingCard(data)
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
      } else {
        sendResponse({ success: false, error: '无效的分析数据' });
      }
      break;
      
    case 'hideFloatingCard':
      sendResponse(hideFloatingCard());
      break;
      
    case 'setLanguage':
      sendResponse(setLanguage(message.language));
      break;
      
    case 'ping':
      sendResponse({ success: true });
      break;
      
    case 'setPersistence':
      state.cardPersisted = message.persist === true;
      sendResponse({ success: true, persisted: state.cardPersisted });
      break;
  }
  
  // 处理type类型消息
  switch (type) {
    case 'SHOW_RESULT':
      if (state.floatingCard) {
        sendToFloatingCard(data);
        sendResponse({ success: true });
      }
      break;
      
    case 'SHOW_ERROR':
      if (state.floatingCard) {
        state.floatingCard.contentWindow.postMessage({
          type: 'SHOW_ERROR',
          error: error
        }, '*');
        sendResponse({ success: true });
      }
      break;
      
    case 'REMOVE_CARD':
      removeFloatingCard();
      sendResponse({ success: true });
      break;
  }
  
  return true;
}

// 处理URL变化
function handleUrlChange() {
  if (state.cardPersisted && state.floatingCard) {
    state.floatingCard.style.display = 'none';
  } else {
    removeFloatingCard();
  }
}

// 初始化
function init() {
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .veritai-floating-card-frame {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      height: 450px;
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
    if (result.language) state.language = result.language;
  });
  
  // 设置事件监听器
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
  window.addEventListener('message', handleFrameMessage);
  window.addEventListener('popstate', handleUrlChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', removeFloatingCard);
  
  // 监听URL变化
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== window.lastUrl) {
      window.lastUrl = currentUrl;
      handleUrlChange();
    }
  });
  urlObserver.observe(document, { subtree: true, childList: true });
  
  // 通知后台脚本已准备就绪
  sendToBackground({ action: 'contentScriptReady' });
}

// 处理页面可见性变化
function handleVisibilityChange() {
  const isVisible = document.visibilityState === 'visible';
  
  // 如果页面变为可见且有需要恢复的卡片
  if (isVisible && state.cardPersisted && state.currentData && !state.isCardVisible) {
    if (state.floatingCard) {
      state.floatingCard.style.display = 'block';
      state.isCardVisible = true;
    } else {
      showFloatingCard(state.currentData);
    }
  }
}

// 导出清理函数供外部使用
window.factCheckerCleanup = function() {
  removeFloatingCard();
  window.removeEventListener('popstate', handleUrlChange);
  window.removeEventListener('beforeunload', removeFloatingCard);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
};

// 记录初始URL
window.lastUrl = location.href;

// 启动初始化
init();