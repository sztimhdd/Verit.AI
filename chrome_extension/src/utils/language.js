// 替换原有的i18n.js
export const getLanguage = () => {
  const browserLang = navigator.language || chrome.i18n.getUILanguage();
  console.log('[Language Detection] Raw browser language:', browserLang); // 更详细的日志
  const detectedLang = browserLang.startsWith('zh') ? 'zh' : 'en';
  console.log('[Language Detection] Using language:', detectedLang);
  return detectedLang;
};

export const texts = {
  en: {
    analyze: 'Analyze',
    analyzing: 'Analyzing...',
    serviceReady: 'Service Ready'
  },
  zh: {
    analyze: '开始核查',
    analyzing: '核查中...',
    serviceReady: '服务已就绪'
  }
};