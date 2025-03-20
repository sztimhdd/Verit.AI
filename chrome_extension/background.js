
// 新增：模拟数据生成器
// 在文件顶部添加导入
// 确保只有一个CryptoJS导入
// 修改generateMockData函数

// 确保文件以模块方式加载
import CryptoJS from 'crypto-js';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onActivated.addListener((activeInfo) => {
  showSummary(activeInfo.tabId);
});
chrome.tabs.onUpdated.addListener(async (tabId) => {
  showSummary(tabId);
});
function generateMockData(content) {
  const hash = CryptoJS.MD5(content).toString().substring(0, 8);
  return {
    trustworthiness_score: Math.floor(Math.random() * 100),
    analysis_results: {
      key_issues: [
        "未经验证的消息来源",
        "数据统计方法存疑",
        "可能存在夸大描述"
      ]
    },
    debunking_card: `<p>这是对内容 "${content.substring(0, 50)}..." 的分析结果。</p>`,
    content_hash: hash
  };
}

// 修改：showSummary函数
async function showSummary(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url.startsWith('http')) {
    return;
  }
  
  const injection = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['scripts/extract-content.js']
  });
  
  const content = injection[0].result;
  const mockData = generateMockData(content);
  
  chrome.storage.session.set({ 
    pageContent: content,
    analysisResult: mockData
  });
}
