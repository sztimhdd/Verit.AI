// 加载语言设置
async function loadLanguageSettings() {
  const { userLanguage } = await chrome.storage.local.get('userLanguage');
  
  // 设置选择框值
  document.getElementById('languageSelect').value = userLanguage || 'en';
}

// 保存语言设置
async function saveLanguageSettings() {
  const language = document.getElementById('languageSelect').value;
  
  // 保存到存储
  await chrome.storage.local.set({ userLanguage: language });
  
  // 通知后台脚本语言已更改
  chrome.runtime.sendMessage({ action: 'LANGUAGE_CHANGED', language });
}

// 初始化设置页面
document.addEventListener('DOMContentLoaded', () => {
  loadLanguageSettings();
  
  // 添加事件监听器
  document.getElementById('languageSelect').addEventListener('change', saveLanguageSettings);
}); 