// 使用新的i18n模块
import i18n from './i18n.js';

/**
 * 获取当前用户语言偏好
 * 兼容旧版实现，推荐直接使用i18n.getUILanguage()
 * @returns {string} 语言代码 ('zh' 或 'en')
 */
export const getLanguage = () => {
  const detectedLang = i18n.getUILanguage();
  console.log('[Language Detection] Using language:', detectedLang);
  return detectedLang;
};

/**
 * 保存用户语言偏好
 * 兼容旧版实现，推荐直接使用i18n.saveLanguagePreference()
 * @param {string} lang - 语言代码 ('zh' 或 'en')
 */
export const setLanguage = async (lang) => {
  if (lang === 'zh' || lang === 'en') {
    await i18n.saveLanguagePreference(lang);
    console.log('[Language Setting] Language set to:', lang);
  }
};

export default {
  getLanguage,
  setLanguage
};