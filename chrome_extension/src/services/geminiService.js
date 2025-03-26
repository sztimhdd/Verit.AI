import { GoogleGenerativeAI } from '@google/generative-ai';

// 从chrome.storage中获取API密钥
const GEMINI_API_KEY = 'AIzaSyAGgOYBLHYReZFylVtCIB3R9Zhv4QUPLhM';

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async analyzeContent(content, url) {
    try {
      // 使用模拟数据
      return this._generateMockData(content, url);
      
      // 实际API调用代码（暂时注释）
      /*
      const prompt = this._buildPrompt(content, url);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return this._parseResponse(response.text());
      */
    } catch (error) {
      console.error('Gemini API 调用失败:', error);
      throw error;
    }
  }

  _generateMockData(content, url) {
    // 基于内容生成一个固定的分数，确保相同内容得到相同结果
    const hash = this._hashString(content);
    const score = hash % 100;
    
    // 根据分数确定各个维度的评级
    const getLevel = (score) => {
      if (score >= 80) return '高';
      if (score >= 60) return '中';
      return '低';
    };

    return {
      score: score,
      flags: {
        factuality: getLevel(score),
        objectivity: getLevel(score),
        reliability: getLevel(score),
        bias: getLevel(100 - score) // 偏见度与可信度相反
      },
      summary: `这是对内容 "${content.substring(0, 100)}..." 的分析摘要。`,
      sources: [
        {
          title: "示例来源",
          url: url
        }
      ]
    };
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  _buildPrompt(content, url) {
    return `请分析以下网页内容的可信度：

URL: ${url}

内容：
${content}

请提供以下格式的JSON响应：
{
  "score": 0-100的整数,
  "flags": {
    "factuality": "高/中/低",
    "objectivity": "高/中/低",
    "reliability": "高/中/低",
    "bias": "高/中/低"
  },
  "summary": "内容摘要",
  "sources": [
    {
      "title": "来源标题",
      "url": "来源URL"
    }
  ]
}`;
  }

  _parseResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('解析响应失败:', error);
      throw new Error('无法解析API响应');
    }
  }
}

export const geminiService = new GeminiService(); 