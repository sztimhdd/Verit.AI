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
  
  // 强制使用本地服务器进行测试
  CURRENT_API_URL = 'http://127.0.0.1:4000';
  console.log('使用本地API URL:', CURRENT_API_URL);
  
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
    // 不再加载保存的api_url，始终使用本地服务器
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

// Helper: Update Badge
async function updateBadge(tabId, text, color = '#4caf50') {
  try {
    await chrome.action.setBadgeText({ tabId, text: text.toString() });
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
  } catch (e) {
    console.warn('Failed to update badge:', e);
  }
}

// Helper: Save Analysis Result
async function saveAnalysisResult(tabId, data) {
  try {
    await chrome.storage.local.set({ [`analysis_${tabId}`]: data });
  } catch (e) {
    console.error('Failed to save analysis result:', e);
  }
}

// Helper: Get Badge Color based on score
function getScoreColor(score) {
  if (score >= 80) return '#4caf50'; // Green
  if (score >= 50) return '#ff9800'; // Orange
  return '#f44336'; // Red
}

// Core Analysis Logic (Reusable)
async function performAnalysis(content, url, title, lang, tabId) {
  try {
    const response = await fetch(`${CURRENT_API_URL}/api/extension/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, url, title, lang: lang || 'zh' })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data) {
        updateQuotaInfo(result.data.quota);
        
        // Save result
        await saveAnalysisResult(tabId, result.data);
        
        // Update badge with score
        if (result.data.score !== undefined) {
          updateBadge(tabId, result.data.score, getScoreColor(result.data.score));
        }

        // Apply highlights if tab is still available
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'applyHighlights',
            data: result.data
          });
          console.log('[Background] Highlights applied automatically');
        } catch (err) {
          console.log('[Background] Tab might be closed or inactive:', err);
        }

        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    updateBadge(tabId, 'ERR', '#999');
    return { success: false, error: error.message };
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    // 1. Service Status
    if (request.action === 'getServiceStatus' || request.action === 'checkServiceStatus') {
      if (request.action !== 'getServiceStatus' || (Date.now() - serviceStatus.lastCheck > 5 * 60 * 1000)) {
        await checkServiceStatus();
      }
      sendResponse({
        isReady: serviceStatus.isReady,
        error: serviceStatus.error,
        quota: serviceStatus.quota
      });
    } 
    
    // 2. Detect Content Category (New Auto-Flow)
    else if (request.action === 'detectContentCategory') {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      // Show loading state
      updateBadge(tabId, '...', '#2196f3');

      if (!serviceStatus.isReady) await checkServiceStatus();
      
      try {
        const response = await fetch(`${CURRENT_API_URL}/api/extension/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: request.content, 
            url: request.url,
            lang: request.language 
          })
        });

        if (response.ok) {
          const result = await response.json();
          const detection = result.data;
          
          console.log(`[Background] Detection result for tab ${tabId}:`, detection);

          if (detection.requires_fact_check) {
            // Proceed to Stage 2: Analysis
            console.log(`[Background] Auto-starting analysis for tab ${tabId}`);
            updateBadge(tabId, '⟳', '#2196f3'); // Analyzing icon
            
            const analysisResult = await performAnalysis(
              request.content, 
              request.url, 
              request.title, 
              request.language, 
              tabId
            );
            
            sendResponse({ success: true, stage: 'analysis_complete', data: analysisResult.data });
          } else {
            // No check needed
            console.log(`[Background] Content ignored: ${detection.category}`);
            updateBadge(tabId, ''); // Clear badge
            sendResponse({ success: true, stage: 'detection_ignored', category: detection.category });
          }
        } else {
          throw new Error('Detection endpoint failed');
        }
      } catch (error) {
        console.error('[Background] Detection failed:', error);
        updateBadge(tabId, '');
        sendResponse({ success: false, error: error.message });
      }
    }

    // 3. Manual Analysis (Legacy/Popup triggered)
    else if (request.action === 'analyzeContent') {
      if (!serviceStatus.isReady) {
        await checkServiceStatus();
        if (!serviceStatus.isReady) {
          sendResponse({ success: false, error: serviceStatus.error || '服务不可用' });
          return;
        }
      }

      // Determine Tab ID (might be from popup, try to get active tab)
      let tabId = sender.tab?.id;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      }

      if (tabId) updateBadge(tabId, '⟳', '#2196f3');

      const result = await performAnalysis(
        request.content, 
        request.url, 
        request.title, 
        request.language || request.lang, 
        tabId
      );
      
      sendResponse(result);
    } 
    
    // 4. Get Cached Result (For Popup)
    else if (request.action === 'getAnalysisResult') {
      let tabId = request.tabId;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      }
      
      if (tabId) {
        try {
          const data = await chrome.storage.local.get(`analysis_${tabId}`);
          sendResponse({ success: true, data: data[`analysis_${tabId}`] });
        } catch (e) {
          sendResponse({ success: false });
        }
      } else {
        sendResponse({ success: false });
      }
    }
    
    else if (request.action === 'contentScriptReady') {
      sendResponse({ ready: true });
    }
  })();
  return true;
});

// Clean up storage when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`analysis_${tabId}`);
});

// 初始化扩展
init();
