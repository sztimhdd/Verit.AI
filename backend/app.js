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

// 添加翻译功能 - 新增
async function translateToZh(analysisResult) {
    try {
        // 构建翻译提示词
        const translationPrompt = `
            请将以下JSON格式的事实核查结果从英文翻译成中文，保持JSON结构不变。
            只翻译值部分，不要翻译键名。
            特别是以下关键术语的翻译:
            - "High" -> "高"
            - "Medium" -> "中"
            - "Low" -> "低"
            - "True" -> "真实"
            - "Partially True" -> "部分真实"
            - "False" -> "虚假"
            
            ${JSON.stringify(analysisResult)}
        `;
        
        // 调用Gemini API翻译
        const translationResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: translationPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
            }
        });
        
        // 解析返回结果
        const text = translationResult.response.text().trim();
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

        // 修改英文分析Prompt
        const prompt = `You are a professional fact checker. Please analyze the following content with multi-dimensional analysis.

        First, carefully read the entire text, identifying key information, claims, and information sources.
        Then, think through your analysis process step by step:

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

        // Call Gemini API
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 4096,
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

        // 如果需要中文，对结果进行翻译
        let finalResult = analysisResult;
        if (needsTranslation) {
            console.log("Translating results to Chinese...");
            finalResult = await translateToZh(analysisResult);
        }

        // Calculate and log token usage
        const tokenUsage = calculateTokenUsage(analysisContent, finalResult);
        const timeUsed = Date.now() - startTime;

        console.log("\n=== API Call Statistics ===");
        console.log(`Input Tokens: ${tokenUsage.inputTokens}`);
        console.log(`Output Tokens: ${tokenUsage.outputTokens}`);
        console.log(`Total Tokens: ${tokenUsage.totalTokens}`);
        console.log(`Processing Time: ${timeUsed}ms`);
        console.log(`Language: ${lang}`);
        console.log("Analysis Result:", JSON.stringify(finalResult, null, 2));
        console.log("==================\n");

        // Return success response
        res.json({
            status: "success",
            data: finalResult,
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