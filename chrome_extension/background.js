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

// 添加语言偏好存储
let userLanguage = 'en'; // 默认英文

// 内联 handleError 函数
function handleError(error) {
  console.error('Error:', error);
  return {
    error: true,
    message: error.message || '发生未知错误'
  };
}

// 添加API服务预热函数
async function warmupApiService() {
  try {
    console.log('尝试预热API服务...');
    
    // 构建健康检查URL
    const healthUrl = `${CONFIG.API_URL.split('/api/')[0]}/health`;
    console.log(`健康检查URL: ${healthUrl}`);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // 检查服务的健康状态
    if (response.ok) {
      const healthData = await response.json();
      console.log('健康检查结果:', healthData);
      
      // 检查服务是否已就绪
      if (healthData.ready === true) {
        console.log('API服务已就绪');
        return { ready: true };
      } else {
        console.log('API服务正在初始化中...');
        return { ready: false, initializing: true };
      }
    } else if (response.status === 503) {
      // 服务正在启动但尚未就绪
      console.log('API服务正在启动中，尚未就绪');
      return { ready: false, initializing: true };
    } else {
      console.error(`健康检查失败: ${response.status}`);
      return { ready: false, error: `状态码: ${response.status}` };
    }
  } catch (error) {
    console.error('API预热失败:', error);
    return { ready: false, error: error.message };
  }
}

// 初始化扩展
async function initializeExtension() {
  // 注册事件监听器
  initializeEventListeners();
  
  // 清理现有卡片
  await cleanupExistingCards();
  
  // 尝试预热API服务
  await warmupApiService();
  
  // 添加定期清理
  setupPeriodicCleanup();
}

// 事件监听器初始化
function initializeEventListeners() {
  // 只保留扩展图标点击事件
  chrome.action.onClicked.addListener(async (tab) => {
    // 首先尝试预热服务
    warmupApiService().catch(() => {}); // 静默失败，将在实际分析时重试
    
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
  },

  SET_LANGUAGE: async (message) => {
    userLanguage = message.lang;
    console.log('语言偏好已设置为:', userLanguage);
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
    
    // 注入内容脚本并等待就绪信号
    const scriptInjected = await ensureContentScriptInjected(tabId);
    if (!scriptInjected) {
      throw new Error('无法注入内容脚本');
    }
    
    await injectFloatingCard(tabId);

    // 添加延迟，确保浮动卡片已加载完成
    await new Promise(resolve => setTimeout(resolve, 300));

    const content = await getPageContent(tabId);
    if (!content?.trim()) {
      throw new Error('无法获取页面内容');
    }

    const result = await analyzeContent(content, url);
    analysisManager.setResult(url, result);

    // 使用安全发送函数
    await safelyNotifyResult(tabId, result);
    await updateBadge(tabId, result);

  } catch (error) {
    await safelyNotifyError(tabId, error);
    await updateErrorBadge(tabId);
  } finally {
    analysisManager.removePending(url);
  }
}

// 新增: 确保内容脚本已注入的函数
async function ensureContentScriptInjected(tabId) {
  try {
    // 检查标签页是否存在
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      console.warn('标签页不存在，无法注入脚本');
      return false;
    }
    
    // 检查URL是否是扩展可以操作的URL
    if (!tab.url || !tab.url.startsWith('http')) {
      console.warn('标签页URL不允许注入脚本:', tab.url);
      return false;
    }
    
    // 注入content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch(error => {
      console.error('注入内容脚本失败:', error);
      return false;
    });
    
    // 等待脚本准备就绪
    return await waitForContentScript(tabId);
  } catch (error) {
    console.error('确保内容脚本注入时出错:', error);
    return false;
  }
}

// 新增: 等待内容脚本准备就绪
async function waitForContentScript(tabId, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // 发送ping消息检查内容脚本是否就绪
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
        .catch(() => ({ ready: false }));
      
      if (response && response.ready) {
        console.log('内容脚本已就绪');
        return true;
      }
      
      // 等待一段时间后再次尝试
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    } catch (error) {
      console.warn(`等待内容脚本就绪失败 (尝试 ${attempt+1}/${maxAttempts}):`, error);
    }
  }
  
  // 最终检查 - 如果所有尝试都失败，则使用静默检查
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SILENT_PING' });
    return true;
  } catch (error) {
    return false;
  }
}

// 修改: 安全地发送分析结果
async function safelyNotifyResult(tabId, result) {
  try {
    // 检查标签页是否存在
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      console.warn('标签页不存在，无法发送结果');
      return;
    }
    
    // 使用 Promise.race 和超时机制
    const sendMessagePromise = chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_RESULT',
      data: result
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('发送结果超时')), 2000);
    });
    
    await Promise.race([sendMessagePromise, timeoutPromise])
      .catch(error => {
        // 如果是连接错误，重新尝试注入脚本
        if (error.message.includes('Receiving end does not exist')) {
          console.warn('接收端不存在，尝试重新注入脚本');
          return ensureContentScriptInjected(tabId)
            .then(success => {
              if (success) {
                // 延迟后再次尝试发送
                return new Promise(resolve => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, {
                      type: 'SHOW_RESULT',
                      data: result
                    }).then(resolve).catch(() => resolve());
                  }, 300);
                });
              }
            });
        }
        console.error('发送结果失败:', error);
      });
    
    console.log('结果已发送到内容脚本');
  } catch (error) {
    console.error('安全发送结果失败:', error);
    // 即使出错也不抛出异常，避免中断流程
  }
}

// 修改: 安全地发送错误
async function safelyNotifyError(tabId, error) {
  try {
    // 检查标签页是否存在
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      console.warn('标签页不存在，无法发送错误');
      return;
    }
    
    // 重新注入内容脚本（如果需要）
    await ensureContentScriptInjected(tabId).catch(() => false);
    
    // 延迟发送，确保内容脚本已就绪
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_ERROR',
          error: error.message || '发生未知错误'
        }).catch(err => {
          console.warn('发送错误失败，忽略此错误:', err);
        });
        console.log('错误已发送到内容脚本');
      } catch (sendError) {
        console.warn('延迟发送错误失败:', sendError);
      }
    }, 300);
  } catch (error) {
    console.error('安全发送错误失败:', error);
    // 不抛出异常
  }
}

// API 调用 - 添加重试机制
async function analyzeContent(content, url, retryCount = 0) {
  const lang = userLanguage || 'en';
  console.log(`发送API请求，使用语言: ${lang}`);
  
  // 首次请求前先检查服务就绪状态
  if (retryCount === 0) {
    const serviceStatus = await warmupApiService();
    if (!serviceStatus.ready && serviceStatus.initializing) {
      console.log('检测到服务尚未就绪，进入等待模式');
    }
  }
  
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.substring(0, CONFIG.CONTENT_MAX_LENGTH),
        url: url || '',
        lang: lang
      })
    });

    // 处理不同的错误状态码
    if (!response.ok) {
      // 如果服务未就绪，返回503
      if (response.status === 503) {
        console.log('服务尚未就绪，等待后重试');
        throw new Error('API服务正在启动中，请稍候');
      } else {
        throw new Error(`API请求失败: ${response.status}`);
      }
    }

    const result = await response.json();
    console.log(`API返回结果，检查语言一致性`);
    if (result.data && result.data.fact_check && result.data.fact_check.verification_results) {
      console.log(`验证结果示例:`, result.data.fact_check.verification_results[0]);
    }
    return result.data || result;
  } catch (error) {
    console.error(`API调用失败 (尝试 ${retryCount + 1}/5):`, error);
    
    // 如果在合理的重试次数内
    if (retryCount < 4) { // 最多重试4次，总共5次尝试
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 显示服务启动中的消息
      if (tab?.id) {
        await notifyServiceWaking(tab.id).catch(() => {});
      }
      
      // 使用更智能的指数退避
      // 服务未就绪(503)时使用更长的等待时间
      const baseWaitTime = error.message.includes('启动中') ? 3000 : 1500;
      const waitTime = baseWaitTime * Math.pow(2, retryCount); // 从3秒开始，直到48秒
      console.log(`等待 ${waitTime/1000} 秒后重试...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 重试前再次检查服务状态
      if (retryCount >= 1) {
        const status = await warmupApiService();
        if (!status.ready) {
          console.log(`服务检查: 仍未就绪，继续等待`);
        } else {
          console.log(`服务检查: 已就绪，继续请求`);
        }
      }
      
      return analyzeContent(content, url, retryCount + 1);
    }
    
    throw new Error('分析服务暂时不可用，请稍后再试');
  }
}

// 更新通知服务启动函数
async function notifyServiceWaking(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SERVICE_WAKING',
      message: '服务正在启动中，这可能需要10-20秒钟...'
    });
  } catch (error) {
    console.error('发送服务启动通知失败:', error);
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
          width: 100px;  /* 稍微增加初始宽度 */
          height: 70px; /* 调整初始高度 */
          border: none;
          border-radius: 8px;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
          z-index: 2147483647;
          background: white;
          overflow: hidden;
          transition: all 0.3s ease;
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

// 添加定期清理机制
function setupPeriodicCleanup() {
  // 每小时清理一次不再需要的结果缓存
  setInterval(() => {
    const now = Date.now();
    const MAX_AGE = 3600000; // 1小时
    
    // 清理旧结果
    for (const [url, data] of analysisManager.results.entries()) {
      if (now - data.timestamp > MAX_AGE) {
        analysisManager.results.delete(url);
      }
    }
    
    // 清理超时的待处理请求
    for (const [url, timestamp] of analysisManager.pending.entries()) {
      if (now - timestamp > 120000) { // 2分钟
        analysisManager.pending.delete(url);
      }
    }
    
    console.log('已清理过期缓存数据');
  }, 3600000); // 1小时间隔
}

// 启动扩展
chrome.runtime.onInstalled.addListener(initializeExtension);