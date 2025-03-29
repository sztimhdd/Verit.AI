/**
 * 统一的国际化(i18n)工具
 * 基于Chrome扩展官方i18n API
 * 包含性能优化缓存机制
 */

// 消息缓存，避免重复调用chrome.i18n API
const messageCache = new Map();

/**
 * 获取本地化消息
 * @param {string} messageName - 消息名称
 * @param {string[]} [substitutions=[]] - 替换项
 * @returns {string} 本地化消息文本
 */
export const getMessage = (messageName, substitutions = []) => {
  if (!messageName) return '';
  
  // 生成缓存键，包含替换项信息
  const cacheKey = substitutions.length > 0 
    ? `${messageName}:${substitutions.join(',')}`
    : messageName;
  
  // 检查缓存
  if (messageCache.has(cacheKey)) {
    return messageCache.get(cacheKey);
  }
  
  // 调用官方API并缓存结果
  const message = chrome.i18n.getMessage(messageName, substitutions);
  messageCache.set(cacheKey, message);
  return message;
};

/**
 * 获取当前UI语言
 * @returns {string} 语言代码 (例如: 'zh', 'en')
 */
let cachedLanguage = null;
export const getUILanguage = () => {
  if (cachedLanguage) return cachedLanguage;
  
  const fullLang = chrome.i18n.getUILanguage();
  // 简化语言代码, 目前只支持zh和en
  cachedLanguage = fullLang.startsWith('zh') ? 'zh' : 'en';
  return cachedLanguage;
};

/**
 * 更新所有带有data-i18n属性的元素文本
 * 不会影响元素的事件绑定，只更新textContent
 * 使用requestAnimationFrame优化性能
 */
export const updateI18nElements = () => {
  // 使用requestAnimationFrame确保DOM操作在适当的时机执行
  return new Promise(resolve => {
    window.requestAnimationFrame(() => {
      const elements = document.querySelectorAll('[data-i18n]');
      const updates = [];
      
      // 收集所有需要更新的元素和消息
      elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = getMessage(key);
        if (message) {
          updates.push({ element, message });
        }
      });
      
      // 批量更新DOM
      updates.forEach(({ element, message }) => {
        element.textContent = message;
      });
      
      resolve();
    });
  });
};

/**
 * 保存用户语言偏好
 * @param {string} lang - 语言代码 ('zh' 或 'en')
 */
export const saveLanguagePreference = async (lang) => {
  if (lang === 'zh' || lang === 'en') {
    await chrome.storage.local.set({ preferredLanguage: lang });
    // 更新缓存
    cachedLanguage = lang;
    // 清除消息缓存，因为语言已变更
    messageCache.clear();
  }
};

/**
 * 获取用户语言偏好
 * 如果没有保存偏好，则返回浏览器UI语言
 * @returns {Promise<string>} 语言代码 ('zh' 或 'en')
 */
export const getLanguagePreference = async () => {
  try {
    const { preferredLanguage } = await chrome.storage.local.get('preferredLanguage');
    if (preferredLanguage === 'zh' || preferredLanguage === 'en') {
      // 更新缓存
      cachedLanguage = preferredLanguage;
      return preferredLanguage;
    }
  } catch (error) {
    console.error('获取语言偏好失败:', error);
  }
  return getUILanguage();
};

/**
 * 初始化i18n功能
 * 预加载常用消息并更新页面元素
 * 应当在页面加载时调用一次
 */
export const initializeI18n = async () => {
  // 预加载常用消息到缓存
  const commonMessages = [
    'analyze', 'analyzing', 'retry', 'close', 'feedback',
    'factuality', 'objectivity', 'reliability', 'bias',
    'summary', 'sources', 'high', 'medium', 'low',
    'true', 'partiallyTrue', 'false', 'misleading', 'unverified'
  ];
  
  commonMessages.forEach(key => {
    getMessage(key);
  });
  
  // 更新页面上所有标记的元素
  await updateI18nElements();
  
  // 返回当前语言
  return cachedLanguage || getUILanguage();
};

/**
 * 清除缓存
 * 在长时间运行或内存受限的情况下可能需要调用
 */
export const clearCache = () => {
  messageCache.clear();
  cachedLanguage = null;
};

export default {
  getMessage,
  getUILanguage,
  updateI18nElements,
  saveLanguagePreference,
  getLanguagePreference,
  initializeI18n,
  clearCache
}; 