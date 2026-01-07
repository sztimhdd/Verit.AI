class I18nManager {
  constructor() {
    this.currentLang = this.detectLanguage();
  }

  detectLanguage() {
    try {
      if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
        return chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
      }
    } catch (e) {
      // chrome.i18n not available (e.g., in sandboxed pages)
      console.warn('[I18n] chrome.i18n not available, using default language');
    }
    return 'en'; // Default to English
  }

  async setLanguage(lang) {
    try {
      if ((lang === 'zh' || lang === 'en') && chrome && chrome.storage) {
        this.currentLang = lang;
        await this.updateAllTexts();
        await chrome.storage.local.set({ preferredLanguage: lang });
      }
    } catch (e) {
      console.warn('[I18n] Failed to set language:', e.message);
    }
  }

  async initialize() {
    try {
      if (chrome && chrome.storage) {
        const { preferredLanguage } = await chrome.storage.local.get('preferredLanguage');
        if (preferredLanguage) {
          this.currentLang = preferredLanguage;
        }
        await this.updateAllTexts();
      }
    } catch (e) {
      console.warn('[I18n] Failed to initialize:', e.message);
    }
  }

  async updateAllTexts() {
    try {
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = this.getText(key);
      });
    } catch (e) {
      console.warn('[I18n] Failed to update texts:', e.message);
    }
  }

  getText(key) {
    try {
      if (chrome && chrome.i18n && chrome.i18n.getMessage) {
        return chrome.i18n.getMessage(key) || key;
      }
    } catch (e) {
      // chrome.i18n not available
    }
    return key; // Return key as fallback
  }
} 