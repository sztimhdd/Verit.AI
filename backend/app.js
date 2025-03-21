import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// 增加请求体大小限制
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// 初始化 Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Token 使用统计函数
function calculateTokenUsage(content, response) {
  const inputTokens = content.split('').reduce((count, char) => {
    return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
  }, 0);
  
  const outputText = JSON.stringify(response);
  const outputTokens = outputText.split('').reduce((count, char) => {
    return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
  }, 0);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}

// Chrome Extension专用API
app.post('/api/extension/analyze', async (req, res) => {
  const startTime = Date.now();
  try {
    const { content, url, lang = 'zh' } = req.body;

    if (!content) {
      return res.status(400).json({
        status: 'error',
        error: {
          message: '内容不能为空'
        }
      });
    }

    // 构建多维度分析提示词
    const prompt = `你是一个专业的事实核查助手。请对以下内容进行多维度分析，包括：
1. 来源验证：识别并验证文中提到的信息来源（如期刊、研究论文、机构等）的可信度
2. 实体验证：验证文中提到的人物、组织等实体的真实性和描述准确性
3. 事实核查：验证主要事实性陈述的准确性
4. 夸大检查：识别可能的夸大或误导性表述
5. 整体评估：考虑事实准确性、来源可信度、偏见程度和完整性

文本内容：${content}

请严格按照以下JSON格式返回分析结果：
{
  "score": 0-100的整数,
  "flags": {
    "factuality": "高/中/低",
    "objectivity": "高/中/低",
    "reliability": "高/中/低",
    "bias": "高/中/低"
  },
  "source_verification": {
    "sources_found": ["来源列表"],
    "credibility_scores": [1-10的评分列表],
    "overall_source_credibility": "高/中/低"
  },
  "entity_verification": {
    "entities_found": ["实体列表"],
    "accuracy_assessment": "高/中/低",
    "corrections": ["需要更正的内容"]
  },
  "fact_check": {
    "claims_identified": ["主要声明列表"],
    "verification_results": ["验证结果列表"],
    "overall_factual_accuracy": "高/中/低"
  },
  "exaggeration_check": {
    "exaggerations_found": ["夸大表述列表"],
    "corrections": ["更准确的表述"],
    "severity_assessment": "高/中/低"
  },
  "summary": "内容摘要",
  "sources": [
    {
      "title": "参考来源标题",
      "url": "链接地址"
    }
  ]
}`;

    // 记录请求开始
    console.log('\n=== 新的分析请求 ===');
    console.log(`时间: ${new Date().toLocaleString()}`);
    console.log(`内容长度: ${content.length} 字符`);

    // 调用 Gemini API
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2048,
      }
    });
    
    const response = await result.response;
    const text = response.text().trim();
    
    // 解析 JSON 响应
    let analysisResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.log('Raw Response:', text);
      return res.status(500).json({
        status: 'error',
        error: {
          message: '分析结果解析失败',
          details: parseError.message
        }
      });
    }

    // 验证返回的数据格式
    const requiredFields = [
      'score', 'flags', 'source_verification', 
      'entity_verification', 'fact_check', 
      'exaggeration_check', 'summary', 'sources'
    ];
    
    for (const field of requiredFields) {
      if (!analysisResult[field]) {
        return res.status(500).json({
          status: 'error',
          error: {
            message: `缺少必要字段: ${field}`
          }
        });
      }
    }

    // 计算并记录 token 使用量
    const tokenUsage = calculateTokenUsage(content, analysisResult);
    const timeUsed = Date.now() - startTime;
    
    console.log('\n=== API调用统计 ===');
    console.log(`输入Token数: ${tokenUsage.inputTokens}`);
    console.log(`输出Token数: ${tokenUsage.outputTokens}`);
    console.log(`总Token消耗: ${tokenUsage.totalTokens}`);
    console.log(`处理时间: ${timeUsed}ms`);
    console.log('分析结果:', JSON.stringify(analysisResult, null, 2));
    console.log('==================\n');

    // 返回成功响应
    res.json({
      status: 'success',
      data: analysisResult
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      status: 'error',
      error: {
        message: error.message || '内部服务器错误',
        details: error.stack
      }
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`后端服务运行在 http://localhost:${port}`);
}); 