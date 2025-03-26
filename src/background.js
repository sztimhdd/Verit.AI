let userLanguage = 'en';

// 检测用户语言
function detectUserLanguage() {
  // 获取浏览器语言
  const browserLang = navigator.language || navigator.userLanguage;
  
  // 判断是否为中文
  if (browserLang.startsWith('zh')) {
    userLanguage = 'zh';
  } else {
    userLanguage = 'en';
  }
  
  // 保存语言设置到存储中
  chrome.storage.local.set({ userLanguage });
  
  console.log(`检测到用户语言: ${userLanguage}`);
  return userLanguage;
}

// 在扩展启动时检测语言
detectUserLanguage();

// 将URL替换为实际的API地址
const API_URL = 'https://factchecker-ai-backend.railway.app/api/extension/analyze';
// 或从环境变量获取
// const API_URL = chrome.runtime.getURL('config.json')
//   .then(resp => fetch(resp))
//   .then(data => data.json())
//   .then(config => config.API_URL);

// 在发送API请求前获取语言设置
async function analyzeContent(content, url, title) {
  try {
    // 获取用户语言设置
    const { userLanguage } = await chrome.storage.local.get('userLanguage');
    
    // 构建API请求
    const requestData = {
      content,
      url,
      title,
      language: userLanguage || 'en' // 默认英文
    };
    
    // 调用API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // 处理响应
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('内容分析失败:', error);
    throw error;
  }
}

// 添加消息监听，处理语言变更
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LANGUAGE_CHANGED') {
    userLanguage = message.language;
    console.log(`语言已更改为: ${userLanguage}`);
    
    // 通知所有活动标签页
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'LANGUAGE_UPDATED', language: userLanguage });
        } catch (e) {
          // 忽略不可发送消息的标签页
        }
      });
    });
    
    sendResponse({ success: true });
  }
  return true; // 保持消息通道开放，支持异步响应
});

// 其他代码... 