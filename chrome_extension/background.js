import { geminiService } from './services/geminiService.js';
import { handleError } from './utils/errorHandler.js';

// 存储最新的分析结果
const latestResults = {};

// 直接使用 webpack 定义的全局变量
const API_URL = 'http://localhost:4000'; // 硬编码 API 地址

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 延迟分析以确保内容脚本已加载
    setTimeout(() => analyzePage(tabId, tab.url), 1000);
  }
});

// 监听标签页激活
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      analyzePage(activeInfo.tabId, tab.url);
    }
  });
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    handleContentRequest(sender.tab.id, request.content)
      .then(sendResponse)
      .catch((error) => sendResponse(handleError(error)));
    return true;
  }
  
  if (request.action === 'getAnalysisResult') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const tabId = tabs[0].id;
        // 检查是否已有该标签页的分析结果
        if (latestResults[tabId]) {
          sendResponse(latestResults[tabId]);
        } else {
          // 如果没有结果，尝试分析当前页面或使用模拟数据
          try {
            // 尝试获取页面内容
            let content;
            try {
              content = await getPageContent(tabId);
            } catch (error) {
              console.warn('无法获取页面内容，使用URL作为模拟内容:', error);
              content = tabs[0].url;
            }
            
            const result = await geminiService.analyzeContent(content, tabs[0].url);
            // 保存结果并返回
            latestResults[tabId] = result;
            sendResponse(result);
          } catch (error) {
            console.error('分析失败:', error);
            sendResponse({ error: '分析失败' });
          }
        }
      } else {
        sendResponse({ error: '无法获取当前标签页' });
      }
    });
    return true; // 保持消息通道开放
  }
  
  if (request.action === 'retryAnalysis') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 删除缓存的结果，强制重新分析
        delete latestResults[tabs[0].id];
        analyzePage(tabs[0].id, tabs[0].url);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === 'analyze') {
    // 立即返回，表示我们会异步处理
    sendResponse({ received: true });
    
    // 异步处理分析请求
    analyzePage(request.tabId, request.url);
    return true; // 保持消息通道开放
  }

  return true;
});

async function analyzePage(tabId, url) {
  try {
    console.log('开始分析页面:', url);
    
    // 获取页面内容
    const content = await getPageContent(tabId);
    if (!content || !content.trim()) {
      throw new Error('无法获取页面内容');
    }

    console.log('获取到页面内容长度:', content.length);

    // 调用 API 进行分析
    const result = await analyzeContent(content);
    
    // 保存结果
    latestResults[tabId] = result;
    
    // 通知 popup 分析完成
    try {
      await chrome.runtime.sendMessage({
        type: 'analysisComplete',
        data: result,
        tabId
      });
    } catch (error) {
      console.log('Popup可能已关闭，结果已缓存');
    }

  } catch (error) {
    console.error('分析失败:', error);
    try {
      await chrome.runtime.sendMessage({
        type: 'analysisError',
        error: error.message,
        tabId
      });
    } catch (e) {
      console.log('Popup可能已关闭，错误已记录');
    }
  }
}

// 获取页面内容
async function getPageContent(tabId) {
  try {
    // 注入并执行content script
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => document.body.innerText
    });
    
    return result;
  } catch (error) {
    console.error('获取内容失败:', error);
    throw new Error('无法获取页面内容');
  }
}

async function showSummary(tabId, result) {
  await chrome.action.setBadgeText({
    text: result.score.toString(),
    tabId
  });
  
  await chrome.action.setBadgeBackgroundColor({
    color: getScoreColor(result.score),
    tabId
  });
}

async function showError(tabId, error) {
  await chrome.action.setBadgeText({
    text: '!',
    tabId
  });
  
  await chrome.action.setBadgeBackgroundColor({
    color: '#FF0000',
    tabId
  });
}

function getScoreColor(score) {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

async function handleContentRequest(tabId, content) {
  try {
    if (!content) {
      throw new Error('无法获取页面内容');
    }

    const url = (await chrome.tabs.get(tabId)).url;
    const result = await geminiService.analyzeContent(content, url);
    
    // 保存结果
    latestResults[tabId] = result;
    
    return result;
  } catch (error) {
    return handleError(error);
  }
}

// 调用API进行分析
async function analyzeContent(content) {
  try {
    const response = await fetch('http://localhost:4000/api/extension/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content.substring(0, 10000), // 限制内容长度
        lang: 'zh'
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API调用失败:', error);
    throw new Error('分析服务暂时不可用');
  }
}