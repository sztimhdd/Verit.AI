class I18nManager {
  constructor() {
    this.currentLang = this.detectLanguage();
  }

  detectLanguage() {
    return chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
  }

  async setLanguage(lang) {
    // 注意：Chrome i18n API 不允许在运行时更改语言
    // 这个方法仅用于记录用户偏好，实际翻译仍取决于浏览器语言
    if (lang === 'zh' || lang === 'en') {
      this.currentLang = lang;
      await this.updateAllTexts();
      await chrome.storage.local.set({ preferredLanguage: lang });
    }
  }

  async initialize() {
    const { preferredLanguage } = await chrome.storage.local.get('preferredLanguage');
    if (preferredLanguage) {
      this.currentLang = preferredLanguage;
    }
    await this.updateAllTexts();
  }

  async updateAllTexts() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.getText(key);
    });
  }

  getText(key) {
    // 直接使用 Chrome 的 i18n API
    return chrome.i18n.getMessage(key) || key;
  }
} 