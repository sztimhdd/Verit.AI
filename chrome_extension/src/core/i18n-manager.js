class I18nManager {
  constructor() {
    this.currentLang = this.detectLanguage();
    this.resources = {
      zh: {
        title: 'Verit.ai 事实核查',
        serviceStatus: {
          ready: '服务状态: 正常',
          initializing: '服务正在启动中...',
          error: '服务异常'
        },
        buttons: {
          analyze: '开始核查',
          analyzing: '核查中...',
          retry: '重试',
          feedback: '提供反馈'
        },
        description: 'Verit.ai 使用先进的 AI 技术帮助您快速核实网页内容的可信度。',
        errors: {
          noActiveTab: '无法获取当前标签页信息',
          serviceUnavailable: '服务暂时不可用',
          initializationTimeout: '服务初始化超时',
          analysisError: '内容分析失败',
          networkError: '网络连接错误'
        }
      },
      en: {
        title: 'Verit.ai Fact Checker',
        serviceStatus: {
          ready: 'Service Status: Ready',
          initializing: 'Service Starting...',
          error: 'Service Error'
        },
        buttons: {
          analyze: 'Analyze',
          analyzing: 'Analyzing...',
          retry: 'Retry',
          feedback: 'Feedback'
        },
        description: 'Verit.ai uses advanced AI technology to help you quickly verify the credibility of web content.',
        errors: {
          noActiveTab: 'Cannot get current tab information',
          serviceUnavailable: 'Service temporarily unavailable',
          initializationTimeout: 'Service initialization timeout',
          analysisError: 'Content analysis failed',
          networkError: 'Network connection error'
        }
      }
    };
  }

  detectLanguage() {
    return chrome.i18n.getUILanguage().startsWith('zh') ? 'zh' : 'en';
  }

  async setLanguage(lang) {
    if (this.resources[lang]) {
      this.currentLang = lang;
      await this.updateAllTexts();
      // 保存语言偏好
      await chrome.storage.local.set({ preferredLanguage: lang });
    }
  }

  async initialize() {
    // 尝试加载保存的语言偏好
    const { preferredLanguage } = await chrome.storage.local.get('preferredLanguage');
    if (preferredLanguage && this.resources[preferredLanguage]) {
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
    const keys = key.split('.');
    let value = this.resources[this.currentLang];
    
    for (const k of keys) {
      value = value[k];
      if (!value) break;
    }
    
    return value || key;
  }
} 