// 添加语言变更监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LANGUAGE_UPDATED') {
    // 更新状态中的语言
    state.language = message.language;
    
    // 如果浮动卡片可见，则更新其内容
    if (state.isCardVisible && state.floatingCard && state.currentData) {
      state.floatingCard.contentWindow.postMessage({
        action: 'SET_LANGUAGE',
        language: message.language
      }, '*');
    }
    
    sendResponse({ success: true });
  }
  return true;
}); 