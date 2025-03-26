import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as modelManager from './model-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// 服务初始化和就绪状态管理
let serviceReady = false;
let pendingRequests = [];
let initializationError = null;

// Enable CORS and request body limits
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 初始化模型管理器
(async function() {
    try {
        console.log("开始初始化模型管理器...");
        await modelManager.initialize(genAI);
        console.log("模型管理器已初始化完成");
        
        // 设置服务为就绪状态
        serviceReady = true;
        
        // 处理所有等待中的请求
        console.log(`处理 ${pendingRequests.length} 个等待中的请求`);
        processPendingRequests();
    } catch (error) {
        console.error("初始化失败:", error);
        initializationError = error;
    }
})();

// 处理等待中的请求
function processPendingRequests() {
    pendingRequests.forEach(({req, res}) => {
        processAnalysisRequest(req, res)
            .catch(error => console.error("处理队列请求失败:", error));
    });
    pendingRequests = [];
}

// 确保服务就绪的中间件
function ensureServiceReady(req, res, next) {
    if (serviceReady) {
        next();
    } else if (initializationError) {
        res.status(503).json({
            status: "error",
            error: {
                message: "服务初始化失败，请稍后再试",
                details: initializationError.message
            }
        });
    } else {
        console.log("服务尚未就绪，将请求加入队列");
        // 如果是分析请求，加入队列
        if (req.path === "/api/extension/analyze") {
            pendingRequests.push({req, res});
            console.log(`请求已加入队列，当前队列长度: ${pendingRequests.length}`);
        } else {
            // 其他请求返回服务尚未就绪
            res.status(503).json({
                status: "error",
                message: "服务正在启动中，请稍后再试"
            });
        }
    }
}

// Function to fetch web content
async function fetchWebContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        // Remove unnecessary elements
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();
        $('iframe').remove();
        $('img').remove();

        // Get main content
        const title = $('title').text().trim();
        const content = $('body').text().trim();

        // Limit content length
        const maxLength = 10000;
        const truncatedContent = content.length > maxLength 
            ? content.substring(0, maxLength) + '...' 
            : content;

        return {
            title,
            content: truncatedContent
        };
    } catch (error) {
        console.error('Failed to fetch web content:', error);
        throw new Error('Unable to fetch web content');
    }
}

// Token usage statistics function
function calculateTokenUsage(content, response) {
    const inputTokens = content.split("").reduce((count, char) => {
        return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
    }, 0);

    const outputText = JSON.stringify(response);
    const outputTokens = outputText.split("").reduce((count, char) => {
        return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
    }, 0);

    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
    };
}

// 主要分析处理函数
async function processAnalysisRequest(req, res) {
    const startTime = Date.now();
    try {
        const { content, url, lang = "en" } = req.body;
        const needsTranslation = lang === 'zh';

        // If URL is provided but no content, fetch web content
        let analysisContent = content;
        let pageTitle = '';

        if (url && !content) {
            const webContent = await fetchWebContent(url);
            analysisContent = webContent.content;
            pageTitle = webContent.title;
        }

        if (!analysisContent) {
            return res.status(400).json({
                status: 'error',
                error: {
                    message: 'Content cannot be empty'
                }
            });
        }

        // 获取模型配置
        const modelConfig = await modelManager.getModelConfig(analysisContent, genAI);
        const activeModel = modelConfig.model;
        const useGrounding = modelConfig.useGrounding || false;
        
        console.log(`使用模型: ${activeModel}, 使用Grounding: ${useGrounding}`);

        // 分析Prompt
        let prompt = `You are a professional fact checker. Please analyze the following content with multi-dimensional analysis.

        First, carefully read the entire text, identifying key information, claims, and information sources.
        Then, think through your analysis process step by step:`;
        
        // 如果使用Grounding，添加特殊的搜索引擎查询提示
        if (useGrounding) {
            prompt += `\n\nThis task requires factual accuracy. Use web search extensively to verify all information and claims. Search for sources, check facts, and validate entities.`;
        }
        
        prompt += `

        1. Source verification:
           - Identify all information sources mentioned (journals, research papers, institutions, etc.)
           - Confirm whether each source actually exists
           - Verify if the sources actually support the related claims in the text
           - Rate the credibility of each source (1-10 score)

        2. Entity verification:
           - Identify all key people, organizations, and entities mentioned
           - Verify if these entities actually exist
           - Check if the descriptions about these entities are accurate
           - Provide specific corrections for inaccurate descriptions

        3. Fact checking:
           - Identify all important factual claims in the text
           - Evaluate if each claim is true, partially true, or false
           - Provide corrections for false or misleading claims
           - Cite reliable sources to support your verification results

        4. Exaggeration check:
           - Identify all exaggerated or misleading statements
           - Explain why these statements are considered exaggerated or misleading
           - Provide more accurate factual statements

        5. Overall assessment:
           - Consider all dimensions above comprehensively
           - Assess the overall reliability and credibility of the content
           - Identify the most critical issues in the content

        ${pageTitle ? `Title: ${pageTitle}\n` : ''}Content: ${analysisContent}

        Think through your analysis carefully, considering all evidence before reaching final conclusions.
        Consider different perspectives and viewpoints, avoiding personal bias in your judgment.

        Please return the analysis results in the following JSON format:
        {
            "score": integer from 0-100,
            "flags": {
                "factuality": "High/Medium/Low",
                "objectivity": "High/Medium/Low",
                "reliability": "High/Medium/Low",
                "bias": "High/Medium/Low"
            },
            "source_verification": {
                "sources_found": ["list of sources"],
                "credibility_scores": [list of scores from 1-10],
                "verification_details": ["detailed verification results, including whether sources support related claims"],
                "overall_source_credibility": "High/Medium/Low"
            },
            "entity_verification": {
                "entities_found": ["list of entities"],
                "verification_details": ["verification details for each entity"],
                "accuracy_assessment": "High/Medium/Low",
                "corrections": ["content needing correction"]
            },
            "fact_check": {
                "claims_identified": ["list of main claims"],
                "verification_results": ["list of verification results, including true/partially true/false judgments and reasons"],
                "supporting_evidence": ["evidence or references supporting verification results"],
                "overall_factual_accuracy": "High/Medium/Low"
            },
            "exaggeration_check": {
                "exaggerations_found": ["list of exaggerated statements"],
                "explanations": ["explanations of why these are exaggerated or misleading"],
                "corrections": ["more accurate statements"],
                "severity_assessment": "High/Medium/Low"
            },
            "key_issues": ["list of the main issues in the content"],
            "summary": "As a trusted friend and expert in this field, provide a 40-word summary about the truthfulness and credibility of this content in a friendly yet professional tone",
            "sources": [
                {
                    "title": "Reference source title",
                    "url": "link"
                }
            ]
        }`;

        // Log request start
        console.log("\n=== New Analysis Request ===");
        console.log(`Time: ${new Date().toLocaleString()}`);
        console.log(`Content Length: ${analysisContent.length} characters`);
        console.log(`Language: ${lang}`);
        console.log(`Using Model: ${activeModel} with Grounding: ${useGrounding}`);

        try {
            // 获取模型实例
            const model = genAI.getGenerativeModel({ 
                model: activeModel,
                generationConfig: modelConfig.generationConfig
            });
            
            // 构建请求内容
            const requestParams = {
                contents: [{ 
                    role: "user", 
                    parts: [{ text: prompt }] 
                }]
            };

            // 如果启用Grounding，添加Google Search工具
            if (useGrounding) {
                requestParams.tools = [{
                    googleSearchRetrieval: {}
                }];
            }
            
            // 调用API生成内容
            const result = await model.generateContent(requestParams);
            
            // 获取响应结果
            const response = result.response;
            let text = "";
            
            // 提取响应文本
            if (typeof response.text === 'function') {
                text = response.text().trim();
            } else if (response.text) {
                text = response.text.trim();
            } else {
                throw new Error("无法从响应中提取文本");
            }

            // 记录API使用情况
            await modelManager.recordUsage(response, useGrounding);

            // 解析JSON响应
            let analysisResult;
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No valid JSON found in response");
                }
                analysisResult = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError);
                console.log("Raw Response:", text);
                return res.status(500).json({
                    status: "error",
                    error: {
                        message: "Failed to parse analysis result",
                        details: parseError.message,
                    },
                });
            }

            // 验证响应格式
            const requiredFields = [
                "score",
                "flags",
                "source_verification",
                "entity_verification",
                "fact_check",
                "exaggeration_check",
                "summary",
                "sources"
            ];

            for (const field of requiredFields) {
                if (!analysisResult[field]) {
                    return res.status(500).json({
                        status: "error",
                        error: {
                            message: `Missing required field: ${field}`,
                        },
                    });
                }
            }

            // 如果需要中文，对结果进行翻译
            let finalResult = analysisResult;
            if (needsTranslation) {
                console.log("Translating results to Chinese...");
                finalResult = await translateToZhSimplified(analysisResult, activeModel, model);
            }

            // 计算和记录token使用情况
            const tokenUsage = calculateTokenUsage(analysisContent, finalResult);
            const timeUsed = Date.now() - startTime;

            console.log("\n=== API Call Statistics ===");
            console.log(`Input Tokens: ${tokenUsage.inputTokens}`);
            console.log(`Output Tokens: ${tokenUsage.outputTokens}`);
            console.log(`Total Tokens: ${tokenUsage.totalTokens}`);
            console.log(`Processing Time: ${timeUsed}ms`);
            console.log(`Language: ${lang}`);
            console.log(`Model: ${activeModel}, Grounding: ${useGrounding}`);
            console.log("==================\n");

            // 返回成功响应
            res.json({
                status: "success",
                data: finalResult,
            });
            
        } catch (apiError) {
            console.error("Gemini API Error:", apiError);
            
            // 如果启用了Grounding且发生错误，尝试禁用Grounding重试
            if (useGrounding) {
                console.log("API调用失败，尝试禁用Grounding后重试...");
                
                try {
                    // 获取无Grounding的模型实例
                    const model = genAI.getGenerativeModel({ 
                        model: activeModel,
                        generationConfig: modelConfig.generationConfig
                    });
                    
                    // 使用更简单的提示词，禁用Grounding
                    const simplePrompt = prompt.replace(/This task requires factual accuracy.*extensively/g, '');
                    
                    // 简化的请求参数，不包含tools
                    const fallbackRequest = {
                        contents: [{ 
                            role: "user", 
                            parts: [{ text: simplePrompt }] 
                        }]
                    };
                    
                    // 调用API
                    const result = await model.generateContent(fallbackRequest);
                    
                    // 获取响应结果
                    const response = result.response;
                    let text = "";
                    
                    // 提取响应文本
                    if (typeof response.text === 'function') {
                        text = response.text().trim();
                    } else if (response.text) {
                        text = response.text.trim();
                    } else {
                        throw new Error("无法从回退响应中提取文本");
                    }
                    
                    // 记录使用情况，标记为未使用Grounding
                    await modelManager.recordUsage(response, false);
                    
                    // 处理响应
                    let analysisResult;
                    try {
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        if (!jsonMatch) {
                            throw new Error("No valid JSON found in response");
                        }
                        analysisResult = JSON.parse(jsonMatch[0]);
                        
                        // 验证所需字段
                        const requiredFields = [
                            "score",
                            "flags",
                            "source_verification",
                            "entity_verification",
                            "fact_check",
                            "exaggeration_check",
                            "summary",
                            "sources"
                        ];

                        for (const field of requiredFields) {
                            if (!analysisResult[field]) {
                                throw new Error(`Missing required field: ${field}`);
                            }
                        }
                        
                        // 如果需要中文，对结果进行翻译
                        let finalResult = analysisResult;
                        if (needsTranslation) {
                            console.log("回退模式：翻译结果为中文...");
                            finalResult = await translateToZhSimplified(analysisResult, activeModel, model);
                        }
                        
                        // 计算和记录token使用情况
                        const tokenUsage = calculateTokenUsage(analysisContent, finalResult);
                        const timeUsed = Date.now() - startTime;

                        console.log("\n=== 回退API调用统计 ===");
                        console.log(`输入Token: ${tokenUsage.inputTokens}`);
                        console.log(`输出Token: ${tokenUsage.outputTokens}`);
                        console.log(`总Token: ${tokenUsage.totalTokens}`);
                        console.log(`处理时间: ${timeUsed}ms`);
                        console.log(`语言: ${lang}`);
                        console.log(`模型: ${activeModel}, 使用Grounding: false (回退模式)`);
                        console.log("==================\n");
                        
                        // 返回成功响应
                        return res.json({
                            status: "success",
                            data: finalResult,
                        });
                        
                    } catch (parseError) {
                        console.error("回退模式解析失败:", parseError);
                        throw parseError; // 继续向外层抛出异常
                    }
                    
                } catch (fallbackError) {
                    console.error("回退模式API调用也失败:", fallbackError);
                    throw apiError;
                }
            } else {
                throw apiError;
            }
        }

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({
            status: "error",
            error: {
                message: error.message || "Internal server error",
                details: error.stack
            }
        });
    }
}

// 简化的翻译功能 - 适配最新API
async function translateToZhSimplified(analysisResult, modelName, model) {
    try {
        // 构建翻译提示词
        const translationPrompt = `
            请将以下JSON格式的事实核查结果从英文翻译成中文，保持JSON结构不变。
            只翻译值部分，不要翻译键名。
            特别是以下关键术语必须严格按照下面的映射进行翻译:
            - "High" -> "高"
            - "Medium" -> "中"
            - "Low" -> "低"
            - "True" -> "真实"
            - "Partially True" -> "部分真实"
            - "False" -> "虚假"
            - "Misleading" -> "误导"
            - "Unverified" -> "需要核实"
            - "Not enough evidence" -> "证据不足"
            
            ${JSON.stringify(analysisResult)}
        `;
        
        // 使用最新API文档的调用方式
        const translationResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: translationPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
            }
        });
        
        // 获取响应文本
        const response = translationResult.response;
        let text = "";
        
        if (typeof response.text === 'function') {
            text = response.text().trim();
        } else if (response.text) {
            text = response.text.trim();
        } else {
            throw new Error("无法从翻译响应中提取文本");
        }
        
        // 解析返回结果
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error("Translation JSON Parse Error:", parseError);
                return analysisResult; // 解析失败时返回原始结果
            }
        }
        
        return analysisResult; // 未找到JSON时返回原始结果
    } catch (error) {
        console.error("Translation API Error:", error);
        return analysisResult; // 出错时返回原始结果
    }
}

// 应用服务就绪中间件
app.use(ensureServiceReady);

// Chrome Extension API endpoint
app.post("/api/extension/analyze", async (req, res) => {
    // 由于中间件已经处理了服务就绪状态，这里直接处理请求
    await processAnalysisRequest(req, res);
});

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running',
        ready: serviceReady
    });
});

// 添加健康检查端点 - 返回实际就绪状态
app.get('/health', (req, res) => {
  if (serviceReady) {
    res.status(200).json({ 
      status: 'OK', 
      ready: true,
      timestamp: new Date().toISOString() 
    });
  } else if (initializationError) {
    res.status(503).json({ 
      status: 'ERROR', 
      ready: false,
      error: initializationError.message,
      timestamp: new Date().toISOString() 
    });
  } else {
    res.status(503).json({ 
      status: 'INITIALIZING', 
      ready: false,
      timestamp: new Date().toISOString() 
    });
  }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});