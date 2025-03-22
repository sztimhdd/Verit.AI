import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Enable CORS and request body limits
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

// Chrome Extension API endpoint
app.post("/api/extension/analyze", async (req, res) => {
    const startTime = Date.now();
    try {
        const { content, url, lang = "zh" } = req.body;

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

        // Build multi-dimensional analysis prompt
        const prompt = `你是一个专业的事实核查助手。请对以下内容进行多维度分析，包括：
1. 来源验证：识别并验证文中提到的信息来源（如期刊、研究论文、机构等）的可信度
2. 实体验证：验证文中提到的人物、组织等实体的真实性和描述准确性
3. 事实核查：验证主要事实性陈述的准确性
4. 夸大检查：识别可能的夸大或误导性表述
5. 整体评估：考虑事实准确性、来源可信度、偏见程度和完整性

${pageTitle ? `标题：${pageTitle}\n` : ''}文本内容：${analysisContent}

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
    "summary": "作为用户信任的朋友和该领域专家，请用40个汉字以内给出关于这篇内容真实性和可信度的总结性建议，语气友好且专业",
    "sources": [
        {
            "title": "参考来源标题",
            "url": "链接地址"
        }
    ]
}`;

        // Log request start
        console.log("\n=== New Analysis Request ===");
        console.log(`Time: ${new Date().toLocaleString()}`);
        console.log(`Content Length: ${analysisContent.length} characters`);

        // Call Gemini API
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 2048,
            },
        });

        const response = await result.response;
        const text = response.text().trim();

        // Parse JSON response
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

        // Validate response format
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

        // Calculate and log token usage
        const tokenUsage = calculateTokenUsage(analysisContent, analysisResult);
        const timeUsed = Date.now() - startTime;

        console.log("\n=== API Call Statistics ===");
        console.log(`Input Tokens: ${tokenUsage.inputTokens}`);
        console.log(`Output Tokens: ${tokenUsage.outputTokens}`);
        console.log(`Total Tokens: ${tokenUsage.totalTokens}`);
        console.log(`Processing Time: ${timeUsed}ms`);
        console.log("Analysis Result:", JSON.stringify(analysisResult, null, 2));
        console.log("==================\n");

        // Return success response
        res.json({
            status: "success",
            data: analysisResult,
        });

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
});

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});