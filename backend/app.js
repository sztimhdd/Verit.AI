import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as modelManager from './model-manager.js';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// 服务初始化和就绪状态管理
let serviceReady = false;
let pendingRequests = [];
let initializationError = null;

// 修改配额跟踪对象
const quotaTracker = {
    groundingQuota: {
        daily: 500,  // 免费版每日 500 次 Grounding 请求限制
        remaining: 500,
        resetTime: new Date().setHours(24, 0, 0, 0)
    },
    gemini20Usage: {  // 改为使用量统计而不是配额限制
        dailyUsage: 0,
        resetTime: new Date().setHours(24, 0, 0, 0)
    },
    gemini15Usage: {  // 改为使用量统计而不是配额限制
        dailyUsage: 0,
        resetTime: new Date().setHours(24, 0, 0, 0)
    },
    
    // 更新使用情况
    updateQuota(type, tokensUsed = 0) {
        const now = new Date();
        
        // 检查是否需要重置统计
        Object.values(this).forEach(quota => {
            if (typeof quota === 'object' && quota.resetTime < now) {
                if (quota.daily) {  // Grounding 配额
                    quota.remaining = quota.daily;
                } else {  // Token 使用量
                    quota.dailyUsage = 0;
                }
                quota.resetTime = new Date().setHours(24, 0, 0, 0);
            }
        });
        
        // 更新具体使用量
        switch (type) {
            case 'grounding':
                this.groundingQuota.remaining--;
                break;
            case 'gemini-2.0':
                this.gemini20Usage.dailyUsage += tokensUsed;
                break;
            case 'gemini-1.5':
                this.gemini15Usage.dailyUsage += tokensUsed;
                break;
        }
    },
    
    // 获取状态日志
    getStatusLog() {
        return {
            grounding: {
                remaining: this.groundingQuota.remaining,
                resetIn: new Date(this.groundingQuota.resetTime) - new Date(),
                limit: this.groundingQuota.daily
            },
            gemini20: {
                dailyUsage: this.gemini20Usage.dailyUsage,
                resetIn: new Date(this.gemini20Usage.resetTime) - new Date()
            },
            gemini15: {
                dailyUsage: this.gemini15Usage.dailyUsage,
                resetIn: new Date(this.gemini15Usage.resetTime) - new Date()
            }
        };
    }
};

// 设置CORS，允许前端域名访问
app.use(cors({
  origin: ['https://veritai.up.railway.app', 'http://localhost:8080'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Enable CORS and request body limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 添加日志工具函数
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `api_${new Date().toISOString().split('T')[0]}.log`);

async function logToFile(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        message,
        data
    };
    
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error('日志写入失败:', error);
    }
}

// 修改初始化函数
async function initializeService() {
    try {
        console.log("开始初始化服务...");
        
        // 初始化模型管理器
        await modelManager.initialize(genAI);
        console.log("模型管理器初始化完成");
        
        // 设置服务为就绪状态
        serviceReady = true;
        console.log("服务已就绪");
        
        // 处理等待中的请求
        if (pendingRequests.length > 0) {
            console.log(`处理 ${pendingRequests.length} 个等待中的请求`);
            processPendingRequests();
        }
        
        return true;
    } catch (error) {
        console.error("服务初始化失败:", error);
        initializationError = error;
        return false;
    }
}

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
        let content = $('body').text().trim();

        // Clean content: remove image filenames, URLs, and other non-text content
        content = content
            // Remove image filenames and extensions
            .replace(/\b\w+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff|ico)(\?\S*)?\b/gi, '')
            // Remove URLs
            .replace(/https?:\/\/[^\s]+/gi, '')
            // Remove excessive whitespace and normalize
            .replace(/\s+/g, ' ')
            .trim();

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
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    await logToFile('REQUEST_START', `开始处理请求 ${requestId}`, {
        url: req.body.url,
        contentLength: req.body.content?.length,
        lang: req.body.lang
    });

    try {
        const { content, url, lang = "en" } = req.body;
        const needsTranslation = lang === 'zh';

        // 记录请求基本信息
        console.log(`\n=== 请求 ID: ${requestId} ===`);
        console.log(`时间: ${new Date().toLocaleString()}`);
        console.log(`内容长度: ${content?.length || 'N/A'}`);
        console.log(`URL: ${url || 'N/A'}`);
        console.log(`语言: ${lang}`);

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
        const modelConfig = await modelManager.getModelConfig(content || '', genAI);
        const activeModel = modelConfig.model;
        const useGrounding = modelConfig.useGrounding;
        
        await logToFile('MODEL_CONFIG', `模型配置 ${requestId}`, {
            model: activeModel,
            useGrounding,
            generationConfig: modelConfig.generationConfig
        });

        console.log(`\n=== 模型配置 ===`);
        console.log(`使用模型: ${activeModel}, 使用Grounding: ${useGrounding}`);
        console.log(`生成配置:`, modelConfig.generationConfig);

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
                // 如果启用Grounding，直接在模型配置中添加tools
                tools: useGrounding ? [{ googleSearch: {} }] : undefined
            });
            
            // 构建生成请求
            const requestConfig = {
                contents: [{ 
                    role: "user", 
                    parts: [{ text: prompt }] 
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                    topP: 0.8,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            console.log('\n=== API请求参数 ===');
            console.log(JSON.stringify(requestConfig, null, 2));

            // 调用API
            const result = await model.generateContent(requestConfig);
            const response = result.response;
            
            // 计算token使用量并更新配额
            const tokenUsage = calculateTokenUsage(analysisContent, response);
            
            // 更新配额统计
            if (activeModel === 'gemini-2.0-flash') {
                quotaTracker.updateQuota('gemini-2.0', tokenUsage.totalTokens);
                if (useGrounding) {
                    quotaTracker.updateQuota('grounding');
                }
            } else {
                quotaTracker.updateQuota('gemini-1.5', tokenUsage.totalTokens);
            }
            
            // 获取并输出配额状态
            const quotaStatus = quotaTracker.getStatusLog();
            console.log('\n=== 配额使用状态 ===');
            console.log(`Grounding请求剩余: ${quotaStatus.grounding.remaining}/${quotaStatus.grounding.limit}次`);
            console.log(`Gemini 2.0 今日使用: ${quotaStatus.gemini20.dailyUsage} tokens`);
            console.log(`Gemini 1.5 今日使用: ${quotaStatus.gemini15.dailyUsage} tokens`);
            console.log(`下次重置时间: ${new Date(quotaTracker.groundingQuota.resetTime).toLocaleString()}`);
            console.log('==================\n');
            
            // 记录到日志文件
            await logToFile('QUOTA_STATUS', '配额使用状态', quotaStatus);
            
            // 获取grounding元数据（如果有）
            if (response.candidates && response.candidates[0].groundingMetadata) {
                console.log('\n=== Grounding 元数据 ===');
                console.log(response.candidates[0].groundingMetadata);
            }

            // 提取响应文本
            let text = "";
            if (typeof response.text === 'function') {
                text = response.text().trim();
            } else if (response.text) {
                text = response.text.trim();
            } else {
                throw new Error("无法从响应中提取文本");
            }

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
            const timeUsed = Date.now() - startTime;

            console.log("\n=== API Call Statistics ===");
            console.log(`Input Tokens: ${tokenUsage.inputTokens}`);
            console.log(`Output Tokens: ${tokenUsage.outputTokens}`);
            console.log(`Total Tokens: ${tokenUsage.totalTokens}`);
            console.log(`Processing Time: ${timeUsed}ms`);
            console.log(`Language: ${lang}`);
            console.log(`Model: ${activeModel}, Grounding: ${useGrounding}`);
            console.log("==================\n");

            // 记录API响应
            await logToFile('API_RESPONSE', `API响应 ${requestId}`, {
                responseTime: timeUsed,
                hasText: !!text,
                textLength: text.length
            });

            // 返回成功响应
            res.json({
                status: "success",
                data: finalResult,
            });
            
        } catch (apiError) {
            await logToFile('API_ERROR', `API调用错误 ${requestId}`, {
                error: apiError.message,
                stack: apiError.stack
            });

            console.error('\n=== API错误 ===');
            console.error(apiError);
            
            // 如果启用了Grounding且发生错误，尝试禁用Grounding重试
            if (useGrounding) {
                console.log("API调用失败，尝试禁用Grounding后重试...");
                
                try {
                    const model = genAI.getGenerativeModel({ model: activeModel });
                    
                    // 不包含tools的简单请求
                    const fallbackRequest = {
                        contents: [{ 
                            role: "user", 
                            parts: [{ text: prompt }] 
                        }]
                    };
                    
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
                    
                    // 解析JSON响应
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
                        
                        // 记录API响应
                        await logToFile('API_RESPONSE', `API响应 ${requestId}`, {
                            responseTime: timeUsed,
                            hasText: !!text,
                            textLength: text.length
                        });

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
        await logToFile('REQUEST_ERROR', `请求处理错误 ${requestId}`, {
            error: error.message,
            stack: error.stack
        });

        console.error('\n=== 请求错误 ===');
        console.error(error);

        res.status(500).json({
            status: "error",
            error: {
                message: error.message || "Internal server error",
                details: error.stack
            }
        });
    } finally {
        const timeUsed = Date.now() - startTime;
        await logToFile('REQUEST_END', `请求处理完成 ${requestId}`, {
            timeUsed,
            timestamp: new Date().toISOString()
        });

        console.log(`\n=== 请求处理完成 ===`);
        console.log(`请求ID: ${requestId}`);
        console.log(`处理时间: ${timeUsed}ms`);
        console.log('==================\n');
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
        
        // 构建翻译请求
        const requestConfig = {
            contents: [{ 
                role: "user", 
                parts: [{ text: translationPrompt }] 
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
                topP: 0.8,
                topK: 40
            }
        };

        const translationResult = await model.generateContent(requestConfig);
        
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

// Detection endpoint (BEFORE middleware to ensure it always runs)
app.post("/api/extension/detect", async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.length < 50) {
            return res.json({
                status: "success",
                data: { requires_fact_check: false, category: "Unknown", confidence: 0.3, reason: "Content too short" }
            });
        }

        // Truncate for speed
        const truncatedContent = content.substring(0, 2000);

        // Simple heuristic-based detection (faster than API call)
        const lowerContent = truncatedContent.toLowerCase();
        
        // Keywords that indicate fact-checking is needed
        const newsKeywords = ['news', 'breaking', 'report', 'according to', 'study shows', 'research', 'scientists', ' experts'];
        const claimKeywords = ['claim', 'alleged', 'reportedly', 'suspected', 'believed'];
        
        // Keywords that indicate NO fact-checking needed
        const recipeKeywords = ['recipe', 'ingredients', 'cook', 'bake', 'preparation', 'instructions'];
        const fictionKeywords = ['chapter', 'novel', 'story', 'fiction', 'character', 'narrative'];
        const navKeywords = ['home', 'about us', 'contact', 'menu', 'navigation', 'login', 'sign in'];
        
        let score = 0;
        
        // Check for news/claims
        for (const kw of newsKeywords) {
            if (lowerContent.includes(kw)) score += 0.15;
        }
        for (const kw of claimKeywords) {
            if (lowerContent.includes(kw)) score += 0.1;
        }
        
        // Subtract for non-relevant content
        for (const kw of recipeKeywords) {
            if (lowerContent.includes(kw)) score -= 0.3;
        }
        for (const kw of fictionKeywords) {
            if (lowerContent.includes(kw)) score -= 0.3;
        }
        for (const kw of navKeywords) {
            if (lowerContent.includes(kw)) score -= 0.2;
        }

        const requiresFactCheck = score > 0.2;
        
        let category = "Other Content";
        if (requiresFactCheck) {
            if (score > 0.6) category = "News Report";
            else if (score > 0.4) category = "Blog Post";
            else category = "Social Media";
        } else {
            if (lowerContent.includes('recipe') || lowerContent.includes('cook')) category = "Recipe";
            else if (lowerContent.includes('chapter') || lowerContent.includes('novel')) category = "Fiction";
            else category = "Navigation/Other";
        }

        res.json({
            status: "success",
            data: {
                requires_fact_check: requiresFactCheck,
                category: category,
                confidence: Math.min(Math.abs(score) + 0.3, 0.95),
                reason: `Keyword analysis score: ${score.toFixed(2)}`
            }
        });

    } catch (error) {
        console.error("Detection error:", error);
        res.status(500).json({
            status: "error",
            error: { message: error.message }
        });
    }
});

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

// 健康检查端点
app.get('/health', (req, res) => {
    console.log("收到健康检查请求");
    const quotaStatus = quotaTracker.getStatusLog();
    
    if (serviceReady) {
        res.status(200).json({ 
            status: 'OK', 
            ready: true,
            timestamp: new Date().toISOString(),
            quota: {
                grounding: quotaStatus.grounding,
                gemini20: quotaStatus.gemini20,
                gemini15: quotaStatus.gemini15
            }
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

// 启动服务
app.listen(port, '0.0.0.0', async () => {
    console.log(`服务器启动于 http://0.0.0.0:${port}`);
    
    // 初始化服务
    const initialized = await initializeService();
    if (initialized) {
        console.log("服务初始化成功，可以开始接收请求");
    } else {
        console.error("服务初始化失败，请检查配置和依赖");
    }
});