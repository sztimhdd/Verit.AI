/**
 * VeritAI Fact Checker - 后台脚本
 */

// 配置常量
const API_BASE_URLS = [
  'http://127.0.0.1:4000', // 本地测试URL (优先)
  'https://veritai-api.up.railway.app' // Railway生产URL
];
const STATE_KEY = 'veritai_state';
const QUOTA_KEY = 'veritai_quota';
let CURRENT_API_URL = API_BASE_URLS[0];

// 储存服务状态
let serviceStatus = {
  isReady: false,
  lastCheck: 0,
  error: null,
  quota: {
    groundingRemaining: 0,
    gemini20Remaining: 0,
    gemini15Remaining: 0,
    resetTime: null
  }
};

// 初始化
async function init() {
  console.log('VeritAI Fact Checker 初始化...');
  await loadState();
  await checkServiceStatus();
}

// 加载状态和配额信息
async function loadState() {
  try {
    const data = await chrome.storage.local.get([STATE_KEY, QUOTA_KEY, 'api_url']);
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
    if (data['api_url'] && API_BASE_URLS.includes(data['api_url'])) {
      CURRENT_API_URL = data['api_url'];
      console.log('使用已保存API URL:', CURRENT_API_URL);
    }
  } catch (error) {
    console.error('加载状态失败:', error);
  }
}

// 尝试连接到所有API基础URL并检查服务状态
async function tryAllApiUrls() {
  for (const url of API_BASE_URLS) {
    if (await checkApiHealth(url)) {
      CURRENT_API_URL = url;
      await chrome.storage.local.set({ 'api_url': url });
      console.log('已切换API URL:', url);
      return true;
    }
  }
  return false;
}

// 检查单个API URL的健康状态
async function checkApiHealth(apiUrl) {
  try {
    console.log(`检查API健康状态: ${apiUrl}/health`);
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      const isReady = data === true || (data?.status?.toLowerCase() === 'ok' || data?.status?.toLowerCase() === 'ready') || data?.ready === true;
      if (isReady) {
        console.log(`API ${apiUrl} 健康`);
        return { url: apiUrl, data };
      }
    }
    console.warn(`API ${apiUrl} 不健康或无响应`);
  } catch (error) {
    console.warn(`API ${apiUrl} 连接失败: ${error.message}`);
  }
  return null;
}

// 检查服务状态并更新
async function checkServiceStatus() {
  const healthResult = await checkApiHealth(CURRENT_API_URL);
  if (healthResult) {
    serviceStatus.isReady = true;
    serviceStatus.lastCheck = Date.now();
    serviceStatus.error = null;
    updateQuotaInfo(healthResult.data?.quota);
    console.log('服务状态: 在线');
    return serviceStatus;
  } else {
    console.warn('当前API URL不可用，尝试其他URL');
    if (await tryAllApiUrls()) {
      const newHealthResult = await checkApiHealth(CURRENT_API_URL);
      if (newHealthResult) {
        serviceStatus.isReady = true;
        serviceStatus.lastCheck = Date.now();
        serviceStatus.error = null;
        updateQuotaInfo(newHealthResult.data?.quota);
        console.log('服务状态: 在线 (已切换API URL)');
        return serviceStatus;
      }
    }
    serviceStatus.isReady = false;
    serviceStatus.error = '所有API URL均不可用';
    console.error('服务状态: 离线 - 所有API URL不可用');
    await saveServiceState();
    return serviceStatus;
  }
}

// 更新配额信息
async function updateQuotaInfo(quotaData) {
  if (quotaData) {
    serviceStatus.quota = {
      groundingRemaining: quotaData.grounding?.remaining || 0,
      gemini20Remaining: quotaData.gemini20?.dailyUsage || 0,
      gemini15Remaining: quotaData.gemini15?.dailyUsage || 0,
      resetTime: quotaData.grounding?.resetTime || null
    };
    await chrome.storage.local.set({ [QUOTA_KEY]: JSON.stringify(serviceStatus.quota) });
    console.log('配额信息已更新');
  }
}

// 保存服务状态到本地存储
async function saveServiceState() {
  await chrome.storage.local.set({
    [STATE_KEY]: JSON.stringify({
      isReady: serviceStatus.isReady,
      lastCheck: serviceStatus.lastCheck,
      error: serviceStatus.error
    })
  });
}

// 定期检查服务状态 (每5分钟)
setInterval(checkServiceStatus, 5 * 60 * 1000);

// 消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    if (request.action === 'getServiceStatus' || request.action === 'checkServiceStatus') {
      if (request.action === 'getServiceStatus' && (Date.now() - serviceStatus.lastCheck <= 5 * 60 * 1000)) {
      } else {
        await checkServiceStatus();
      }
      sendResponse({
        isReady: serviceStatus.isReady,
        error: serviceStatus.error,
        quota: serviceStatus.quota
      });
    } else if (request.action === 'analyzeContent') {
      if (!serviceStatus.isReady) {
        await checkServiceStatus();
        if (!serviceStatus.isReady) {
          sendResponse({ 
            success: false, 
            error: serviceStatus.error || '服务不可用' 
          });
          return;
        }
      }

      try {
        const response = await fetch(`${CURRENT_API_URL}/api/extension/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: request.content, 
            url: request.url,
            title: request.title,
            lang: request.language || request.lang || 'zh'
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            updateQuotaInfo(result.data.quota);
            
            // 发送高亮指令
            try {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tab && tab.id) {
                await chrome.tabs.sendMessage(tab.id, {
                  action: 'applyHighlights',
                  data: result.data
                });
                console.log('[Background] Highlights applied successfully');
              }
            } catch (highlightError) {
              console.warn('[Background] Failed to apply highlights:', highlightError);
            }
            
            sendResponse({ 
              success: true, 
              data: result.data 
            });
          } else {
            console.error('内容分析失败: result.error || Unknown error');
            sendResponse({ 
              success: false, 
              error: result.error || 'Unknown error' 
            });
          }
        } else {
          const errorMsg = `HTTP ${response.status}: ${response.statusText || 'Network error'}`;
          console.error('内容分析请求失败:', errorMsg);
          sendResponse({ 
            success: false, 
            error: errorMsg 
          });
        }
      } catch (error) {
        console.error('内容分析请求异常:', error);
        sendResponse({ 
          success: false, 
          error: `请求失败: ${error.message}` 
        });
      }
    } else if (request.action === 'contentScriptReady') {
      sendResponse({ ready: true });
    }
  })();
  return true;
});

// 初始化扩展
init();
