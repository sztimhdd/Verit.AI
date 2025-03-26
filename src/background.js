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
    const response = await fetch('https://your-api-endpoint.com/analyze', {
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

// 其他代码... 