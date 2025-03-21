// 配置常量
const CONFIG = {
  API_URL: 'https://factcheckerai-production.up.railway.app/api/extension/analyze',
  DEBOUNCE_TIME: 1000, // 防重复提交时间间隔
  CONTENT_MAX_LENGTH: 10000, // 内容最大长度限制
  BADGE_COLORS: {
    success: '#4CAF50',   // >= 80
    error: '#F44336',     // < 40
    loading: '#FFC107'     // >= 60
  }
};

// 统一的状态管理
const analysisManager = {
  results: new Map(), // 存储分析结果
  pending: new Map(), // 存储正在分析的请求

  isPending(url) {
    const lastTime = this.pending.get(url);
    return lastTime && (Date.now() - lastTime) < CONFIG.DEBOUNCE_TIME;
  },

  addPending(url) {
    this.pending.set(url, Date.now());
  },

  removePending(url) {
    this.pending.delete(url);
  },

  setResult(url, result) {
    this.results.set(url, {
      data: result,
      timestamp: Date.now()
    });
  },

  getResult(url) {
    return this.results.get(url)?.data;
  },

  clearAll(url) {
    this.pending.delete(url);
    this.results.delete(url);
  }
};

// 存储最新的分析结果
const latestResults = {};

// 跟踪当前分析状态
const analysisState = {
  inProgress: false,
  currentTabId: null,
  currentUrl: null
};

// 在文件顶部添加防重复提交跟踪
const pendingAnalysis = new Map(); // 记录正在分析的URL

// 内联 handleError 函数
function handleError(error) {
  console.error('Error:', error);
  return {
    error: true,
    message: error.message || '发生未知错误'
  };
}

// 初始化扩展
async function initializeExtension() {
  // 注册事件监听器
  initializeEventListeners();
  
  // 清理现有卡片
  await cleanupExistingCards();
}

// 事件监听器初始化
function initializeEventListeners() {
  // 只保留扩展图标点击事件
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab?.url && !analysisManager.isPending(tab.url)) {
      await analyzePage(tab.id, tab.url);
    }
  });

  // 标签页关闭时清理
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await cleanupTab(tabId);
  });

  // URL 变化时清理
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      cleanupTab(tabId);
    }
  });

  // 消息处理
  chrome.runtime.onMessage.addListener(handleMessage);
}

// 消息处理器映射
const messageHandlers = {
  CLOSE_CARD: async (message) => {
    analysisManager.clearAll(message.url);
    return { success: true };
  },

  URL_CHANGED: async (message) => {
    analysisManager.clearAll(message.oldUrl);
    return { success: true };
  },

  RETRY_ANALYSIS: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !analysisManager.isPending(tab.url)) {
      await analyzePage(tab.id, tab.url);
    }
    return { success: true };
  }
};

// 统一的消息处理函数
function handleMessage(message, sender, sendResponse) {
  const handler = messageHandlers[message.type];
  if (handler) {
    handler(message, sender)
      .then(sendResponse)
      .catch(error => {
        console.error('消息处理错误:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
  return false;
}

// 页面加载处理
async function handlePageLoad(tabId, url) {
  try {
    if (!analysisManager.isPending(url)) {
      await analyzePage(tabId, url);
    }
  } catch (error) {
    console.error('页面加载处理失败:', error);
  }
}

// 核心分析流程
async function analyzePage(tabId, url) {
  try {
    if (analysisManager.isPending(url)) {
      return;
    }

    analysisManager.addPending(url);
    await injectFloatingCard(tabId);

    const content = await getPageContent(tabId);
    if (!content?.trim()) {
      throw new Error('无法获取页面内容');
    }

    const result = await analyzeContent(content);
    analysisManager.setResult(url, result);

    await Promise.all([
      notifyResult(tabId, result),
      updateBadge(tabId, result)
    ]);

  } catch (error) {
    await Promise.all([
      notifyError(tabId, error),
      updateErrorBadge(tabId)
    ]);
  } finally {
    analysisManager.removePending(url);
  }
}

// API 调用
async function analyzeContent(content) {
  try {
    // 获取当前活动标签页的信息
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('无法获取当前标签页信息');
    }

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.substring(0, CONFIG.CONTENT_MAX_LENGTH),
        title: tab.title || '', // 使用标签页的标题
        url: tab.url || '',     // 使用标签页的 URL
        lang: 'zh'
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('API调用失败:', error);
    throw new Error('分析服务暂时不可用');
  }
}

// 浮动卡片注入
async function injectFloatingCard(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.getElementById('factChecker-frame')) {
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'factChecker-frame';
        iframe.src = chrome.runtime.getURL('floating-card.html');
        iframe.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          width: 360px;
          height: 200px;
          border: none;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          z-index: 2147483647;
          background: white;
        `;
        
        document.body.appendChild(iframe);
      }
    });
  } catch (error) {
    console.error('注入浮动卡片失败:', error);
    throw error;
  }
}

// 工具函数
async function getPageContent(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 在页面上下文中执行
        const title = document.title;
        const content = document.body.innerText;
        return { title, content };
      }
    });
    return result.content; // 只返回内容部分
  } catch (error) {
    console.error('获取页面内容失败:', error);
    throw new Error('无法获取页面内容');
  }
}

// 发送分析结果到内容脚本
async function notifyResult(tabId, result) {
  try {
    // 先检查标签页是否存在
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      throw new Error('标签页不存在');
    }

    // 确保内容脚本已注入
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(() => {});

    // 延迟发送消息，确保内容脚本已准备就绪
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_RESULT',
          data: result
        });
        console.log('Analysis result sent to content script');
      } catch (error) {
        console.error('发送结果失败:', error);
      }
    }, 500);
  } catch (error) {
    console.error('通知结果失败:', error);
  }
}

// 发送错误到内容脚本
async function notifyError(tabId, error) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_ERROR',
      error: error.message || '发生未知错误'
    });
    console.log('Error sent to content script');
  } catch (error) {
    console.error('发送错误失败:', error);
  }
}

async function updateBadge(tabId, result) {
  try {
    if (result && typeof result.score === 'number') {
      await Promise.all([
        chrome.action.setBadgeText({
          text: result.score.toString(),
          tabId
        }),
        chrome.action.setBadgeBackgroundColor({
          color: getBadgeColor(result.score),
          tabId
        })
      ]);
    }
  } catch (error) {
    console.error('更新徽章失败:', error);
  }
}

async function updateErrorBadge(tabId) {
  try {
    await Promise.all([
      chrome.action.setBadgeText({
        text: '!',
        tabId
      }),
      chrome.action.setBadgeBackgroundColor({
        color: CONFIG.BADGE_COLORS.error,
        tabId
      })
    ]);
  } catch (error) {
    console.error('更新错误徽章失败:', error);
  }
}

function getBadgeColor(score) {
  if (score >= 80) return CONFIG.BADGE_COLORS.success;
  if (score >= 60) return CONFIG.BADGE_COLORS.loading;
  if (score >= 40) return CONFIG.BADGE_COLORS.success;
  return CONFIG.BADGE_COLORS.error;
}

// 清理函数
async function cleanupExistingCards() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map(tab => 
      chrome.tabs.sendMessage(tab.id, { type: 'REMOVE_CARD' }).catch(() => {})
    ));
  } catch (error) {
    console.error('清理现有卡片失败:', error);
  }
}

async function cleanupTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'REMOVE_CARD' });
  } catch (error) {
    // 忽略错误，标签页可能已关闭
  }
}

// 启动扩展
chrome.runtime.onInstalled.addListener(initializeExtension);