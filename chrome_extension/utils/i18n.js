const messages = {
  zh: {
    loading: '正在分析...',
    error: '分析失败',
    retry: '重试',
    score: '可信度评分',
    flags: {
      title: '标记',
      factuality: '事实性',
      objectivity: '客观性',
      reliability: '可靠性',
      bias: '偏见'
    },
    summary: '摘要',
    sources: '来源',
    noContent: '无法获取页面内容',
    unknownError: '发生未知错误'
  },
  en: {
    loading: 'Analyzing...',
    error: 'Analysis failed',
    retry: 'Retry',
    score: 'Credibility Score',
    flags: {
      title: 'Flags',
      factuality: 'Factuality',
      objectivity: 'Objectivity',
      reliability: 'Reliability',
      bias: 'Bias'
    },
    summary: 'Summary',
    sources: 'Sources',
    noContent: 'Unable to get page content',
    unknownError: 'Unknown error occurred'
  }
};

export class I18n {
  constructor(locale = 'zh') {
    this.locale = locale;
  }

  t(key) {
    const keys = key.split('.');
    let value = messages[this.locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    
    return value || key;
  }

  setLocale(locale) {
    if (messages[locale]) {
      this.locale = locale;
      return true;
    }
    return false;
  }

  getLocale() {
    return this.locale;
  }
}

export const i18n = new I18n(); 