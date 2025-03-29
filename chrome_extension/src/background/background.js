/**
 * VeritAI Fact Checker - 后台脚本 (精简版)
 */

// 配置常量
const API_BASE_URL = 'https://veritai-api.up.railway.app';
const STATE_KEY = 'veritai_state';
const QUOTA_KEY = 'veritai_quota';

// 服务状态
let serviceStatus = {
  isReady: false,
  lastCheck: 0,
  error: null,
  quota: {
    groundingRemaining: 0,
    resetTime: null
  }
};

// 初始化
async function init() {
  await loadState();
  await checkServiceStatus();
}

// 加载状态和配额信息
async function loadState() {
  try {
    const data = await chrome.storage.local.get([STATE_KEY, QUOTA_KEY]);
    if (data[STATE_KEY]) {
      const savedState = JSON.parse(data[STATE_KEY]);
      if (Date.now() - savedState.lastCheck < 30 * 60 * 1000) {
        serviceStatus = {...serviceStatus, ...savedState};
      }
    }
    if (data[QUOTA_KEY]) {
      const savedQuota = JSON.parse(data[QUOTA_KEY]);
      const now = new Date();
      const resetTime = savedQuota.resetTime ? new Date(savedQuota.resetTime) : null;
      if (resetTime && now < resetTime) {
        serviceStatus.quota = savedQuota;
      }
    }
  } catch (error) {
    console.error('加载状态失败:', error);
  }
}

// 检查API健康状态
async function checkServiceStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      serviceStatus.isReady = true;
      serviceStatus.lastCheck = Date.now();
      serviceStatus.error = null;
      
      if (data?.quota) {
        serviceStatus.quota = {
          groundingRemaining: data.quota.grounding?.remaining || 0,
          resetTime: data.quota.grounding?.resetTime || null
        };
        await chrome.storage.local.set({ [QUOTA_KEY]: JSON.stringify(serviceStatus.quota) });
      }
    } else {
      throw new Error("API响应异常");
    }
  } catch (error) {
    serviceStatus.isReady = false;
    serviceStatus.error = "服务不可用";
    console.error('API服务不可用:', error);
  }
  
  await chrome.storage.local.set({
    [STATE_KEY]: JSON.stringify({
      isReady: serviceStatus.isReady,
      lastCheck: serviceStatus.lastCheck,
      error: serviceStatus.error
    })
  });
  
  return serviceStatus;
}

// 发送消息到标签页
function sendMessage(tabId, message) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

// 生成模拟结果数据
function generateMockResult(content) {
  const summary = content.length > 100 ? content.substring(0, 100) + '...' : content;
  const score = Math.floor(50 + Math.random() * 40);
  
  return {
    success: true,
    score: score,
    trust_score: score,
    summary: summary,
    flags: [
      { name: '事实性', score: score - Math.floor(Math.random() * 15) },
      { name: '客观性', score: score - Math.floor(Math.random() * 20) }
    ],
    sources: [
      { url: 'https://example.com/news/article1', title: '示例新闻', domain: 'example.com' }
    ],
    timestamp: new Date().toISOString()
  };
}

// 处理分析内容请求
async function handleAnalyzeContent(message, sender, sendResponse) {
  const tabId = sender?.tab?.id;
  
  // 检查API服务是否可用
  if (!serviceStatus.isReady) {
    if (tabId) {
      sendMessage(tabId, {
        action: 'SHOW_ERROR',
        error: '服务不可用，请稍后再试'
      });
    }
    sendResponse({ success: false, error: '服务不可用' });
    return;
  }
  
  // 检查配额
  if (serviceStatus.quota.groundingRemaining <= 0) {
    if (tabId) {
      sendMessage(tabId, {
        action: 'SHOW_ERROR',
        error: '今日分析额度已用完'
      });
    }
    sendResponse({ success: false, error: '额度已用完' });
    return;
  }
  
  // 确保有内容可分析
  if (!message.data || !message.data.content) {
    sendResponse({ success: false, error: '无效的内容' });
    return;
  }
  
  // 显示加载状态
  if (tabId) {
    sendMessage(tabId, {
      action: 'showFloatingCard',
      data: { state: 'loading', message: '正在分析内容...' }
    });
  }
  
  // 判断是否使用测试数据
  if (message.data.test === true) {
    const mockResult = generateMockResult(message.data.content);
    setTimeout(() => {
      if (tabId) {
        sendMessage(tabId, {
          action: 'showFloatingCard',
          data: mockResult
        });
      }
      sendResponse({ success: true, data: mockResult });
    }, 1000);
    return;
  }
  
  try {
    // 调用API分析内容
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.data)
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 更新配额信息
    if (result.quota_remaining !== undefined) {
      serviceStatus.quota.groundingRemaining = result.quota_remaining;
      chrome.storage.local.set({ [QUOTA_KEY]: JSON.stringify(serviceStatus.quota) });
    }
    
    // 发送结果
    if (tabId) {
      sendMessage(tabId, {
        action: 'showFloatingCard',
        data: result
      });
    }
    
    sendResponse({ success: true, data: result });
  } catch (error) {
    // 使用测试数据作为回退
    if (message.data.fallbackToMock) {
      const mockResult = generateMockResult(message.data.content);
      if (tabId) {
        sendMessage(tabId, {
          action: 'showFloatingCard',
          data: mockResult
        });
      }
      sendResponse({ success: true, data: mockResult });
      return;
    }
    
    // 发送错误
    if (tabId) {
      sendMessage(tabId, {
        action: 'SHOW_ERROR',
        error: error.message
      });
    }
    
    sendResponse({ success: false, error: error.message });
  }
}

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理分析请求
  if (message.action === 'analyzeContent') {
    handleAnalyzeContent(message, sender, sendResponse);
    return true; // 异步响应
  }
  
  // 处理服务状态请求
  if (message.action === 'getServiceStatus' || message.action === 'checkServiceStatus') {
    // 如果状态过期，重新检查
    if (Date.now() - serviceStatus.lastCheck > 5 * 60 * 1000) {
      checkServiceStatus();
    }
    
    sendResponse({
      isReady: serviceStatus.isReady,
      error: serviceStatus.error,
      quota: serviceStatus.quota
    });
    
    return true;
  }
  
  // 其他消息处理
  if (message.action === 'contentScriptReady') {
    sendResponse({ ready: true });
    return true;
  }
});

// 定期检查服务状态 (每5分钟)
setInterval(checkServiceStatus, 5 * 60 * 1000);

// 初始化扩展
init();