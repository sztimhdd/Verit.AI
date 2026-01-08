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
const port = process.env.PORT || 4001;

// Service initialization state
let serviceReady = false;
let pendingRequests = [];
let initializationError = null;

// Quota tracking removed, handled by model-manager.js

// CORS configuration
app.use(cors({
  origin: ['https://veritai.up.railway.app', 'http://localhost:8080'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Logging utility
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
        console.error('Log write failed:', error);
    }
}

// Initialize service
async function initializeService() {
    try {
        console.log("Starting service initialization...");
        
        await modelManager.initialize(genAI);
        console.log("Model manager initialized");
        
        serviceReady = true;
        console.log("Service ready");
        
        if (pendingRequests.length > 0) {
            console.log(`Processing ${pendingRequests.length} pending requests`);
            processPendingRequests();
        }
        
        return true;
    } catch (error) {
        console.error("Service initialization failed:", error);
        initializationError = error;
        return false;
    }
}

function processPendingRequests() {
    pendingRequests.forEach(({req, res}) => {
        processAnalysisRequest(req, res)
            .catch(error => console.error("Queue request processing failed:", error));
    });
    pendingRequests = [];
}

// Middleware to ensure service is ready
function ensureServiceReady(req, res, next) {
    if (serviceReady) {
        next();
    } else if (initializationError) {
        res.status(503).json({
            status: "error",
            error: {
                message: "Service initialization failed, please try again later",
                details: initializationError.message
            }
        });
    } else {
        console.log("Service not ready, queuing request");
        if (req.path === "/api/extension/analyze") {
            pendingRequests.push({req, res});
            console.log(`Request queued, queue length: ${pendingRequests.length}`);
        } else {
            res.status(503).json({
                status: "error",
                message: "Service starting up, please try again"
            });
        }
    }
}

// Fetch web content
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

        const title = $('title').text().trim();
        let content = $('body').text().trim();

        // Clean content
        content = content
            .replace(/\b\w+\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff|ico)(\?\S*)?\b/gi, '')
            .replace(/https?:\/\/[^\s]+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        const maxLength = 10000;
        const truncatedContent = content.length > maxLength
            ? content.substring(0, maxLength) + '...'
            : content;

        return {
            title,
            content: truncatedContent
        };
    } catch (error) {
        console.error('Web content fetch failed:', error);
        throw new Error('Unable to fetch web content');
    }
}

// Calculate token usage
function calculateTokenUsage(content, response) {
    const inputTokens = content.split("").reduce((count, char) => {
        return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
    }, 0);

    let outputTokens = 0;
    if (response.usageMetadata && response.usageMetadata.candidatesTokenCount) {
        outputTokens = response.usageMetadata.candidatesTokenCount;
    } else {
        const text = response.text ? (typeof response.text === 'function' ? response.text() : response.text) : "";
        outputTokens = text.split("").reduce((count, char) => {
            return count + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
        }, 0);
    }

    return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
    };
}

// Repair common JSON issues
function repairJSON(jsonString) {
    let repaired = jsonString;
    
    // Remove newlines and extra spaces
    repaired = repaired.replace(/\n/g, ' ');
    repaired = repaired.replace(/\s+/g, ' ');
    
    // Remove trailing commas in arrays and objects
    repaired = repaired.replace(/,\s*\]/g, ']');
    repaired = repaired.replace(/,\s*\}/g, '}');
    
    // Remove consecutive commas
    repaired = repaired.replace(/,\s*,/g, ',');
    
    // Fix incomplete closing brackets
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    
    let tempCloseBraces = closeBraces;
    while (tempCloseBraces < openBraces) {
        repaired += '}';
        tempCloseBraces++;
    }
    
    let tempCloseBrackets = closeBrackets;
    while (tempCloseBrackets < openBrackets) {
        repaired += ']';
        tempCloseBrackets++;
    }
    
    // Handle markdown code blocks
    if (repaired.includes('```json')) {
        const match = repaired.match(/```json\s*(\{[\s\S]*\})\s*```/);
        if (match) {
            repaired = match[1];
        }
    }
    if (repaired.includes('```')) {
        const match = repaired.match(/```\s*(\{[\s\S]*\})\s*```/);
        if (match) {
            repaired = match[1];
        }
    }
    
    // Ensure proper ending
    repaired = repaired.trim();
    if (!repaired.endsWith('}') && !repaired.endsWith(']')) {
        const lastBrace = Math.max(repaired.lastIndexOf('}'), repaired.lastIndexOf(']'));
        if (lastBrace > 0) {
            repaired = repaired.substring(0, lastBrace + 1);
        }
    }
    
    // Remove non-JSON characters
    repaired = repaired.replace(/^[^{[]*/, '');
    repaired = repaired.replace(/[^}\]]*$/, '');
    
    return repaired;
}

// Define response schema
const responseSchema = {
    type: "OBJECT",
    required: ["score", "flags", "source_verification", "entity_verification", "fact_check", "exaggeration_check", "summary", "sources", "key_issues"],
    properties: {
        score: { type: "INTEGER" },
        flags: {
            type: "OBJECT",
            required: ["factuality", "objectivity", "reliability", "bias"],
            properties: {
                factuality: { type: "STRING", enum: ["High", "Medium", "Low"] },
                objectivity: { type: "STRING", enum: ["High", "Medium", "Low"] },
                reliability: { type: "STRING", enum: ["High", "Medium", "Low"] },
                bias: { type: "STRING", enum: ["High", "Medium", "Low"] }
            }
        },
        source_verification: {
            type: "OBJECT",
            required: ["sources_found", "credibility_scores", "verification_details", "overall_source_credibility"],
            properties: {
                sources_found: { type: "ARRAY", items: { type: "STRING" } },
                credibility_scores: { type: "ARRAY", items: { type: "INTEGER" } },
                verification_details: { type: "ARRAY", items: { type: "STRING" } },
                overall_source_credibility: { type: "STRING", enum: ["High", "Medium", "Low"] }
            }
        },
        entity_verification: {
            type: "OBJECT",
            required: ["entities_found", "verification_details", "accuracy_assessment", "corrections"],
            properties: {
                entities_found: { type: "ARRAY", items: { type: "STRING" } },
                verification_details: { type: "ARRAY", items: { type: "STRING" } },
                accuracy_assessment: { type: "STRING", enum: ["High", "Medium", "Low"] },
                corrections: { type: "ARRAY", items: { type: "STRING" } }
            }
        },
        fact_check: {
            type: "OBJECT",
            required: ["claims_identified", "verification_results", "supporting_evidence", "overall_factual_accuracy"],
            properties: {
                claims_identified: { type: "ARRAY", items: { type: "STRING" } },
                verification_results: { type: "ARRAY", items: { type: "STRING" } },
                supporting_evidence: { type: "ARRAY", items: { type: "STRING" } },
                overall_factual_accuracy: { type: "STRING", enum: ["High", "Medium", "Low"] }
            }
        },
        exaggeration_check: {
            type: "OBJECT",
            required: ["exaggerations_found", "explanations", "corrections", "severity_assessment"],
            properties: {
                exaggerations_found: { type: "ARRAY", items: { type: "STRING" } },
                explanations: { type: "ARRAY", items: { type: "STRING" } },
                corrections: { type: "ARRAY", items: { type: "STRING" } },
                severity_assessment: { type: "STRING", enum: ["High", "Medium", "Low"] }
            }
        },
        key_issues: { type: "ARRAY", items: { type: "STRING" } },
        summary: { type: "STRING" },
        sources: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING" },
                    url: { type: "STRING" }
                }
            }
        }
    }
};

// Gemini API call with fallback
async function callGeminiWithFallback(prompt, activeModel, useGrounding) {
    // First attempt with specified config
    try {
        const model = genAI.getGenerativeModel({ 
            model: activeModel,
            tools: useGrounding ? [{ googleSearch: {} }] : undefined
        });

        // Use simple generation without schema to avoid compatibility issues
        const result = await model.generateContent(prompt);

        return { response: result.response, usedGrounding: useGrounding };

    } catch (error) {
        console.error("First attempt failed:", error.message);
        
        // Fallback: retry without grounding and without schema
        if (useGrounding) {
            console.log("Retrying without grounding...");
            try {
                const fallbackModel = genAI.getGenerativeModel({ model: activeModel });
                const result = await fallbackModel.generateContent(prompt);
                return { response: result.response, usedGrounding: false };
            } catch (fallbackError) {
                console.error("Fallback attempt failed:", fallbackError.message);
                throw fallbackError;
            }
        }
        
        throw error;
    }
}

// Parse response text to JSON
function parseResponseText(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("Direct JSON parse failed, attempting repair...");
        try {
            const repaired = repairJSON(text);
            return JSON.parse(repaired);
        } catch (e2) {
            // Last resort: try to extract JSON-like content
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e3) {
                    throw new Error("JSON parsing failed: " + e.message);
                }
            }
            throw new Error("JSON parsing failed: " + e.message);
        }
    }
}

// Transform response to frontend-compatible format
function transformToFrontendFormat(result) {
    // If result is null or undefined, return default
    if (!result) {
        return getDefaultResult();
    }

    // Check if data is already in correct format (has fields at top level AND has data)
    if (result.exaggeration_check && result.fact_check) {
        const hasExaggerations = Array.isArray(result.exaggeration_check?.exaggerations_found) && result.exaggeration_check.exaggerations_found.length > 0;
        const hasClaims = Array.isArray(result.fact_check?.claims_identified) && result.fact_check.claims_identified.length > 0;
        if (hasExaggerations || hasClaims) {
            return result;
        }
    }

    // Check different possible wrapper keys
    const analysis = result.analysis || result.fact_check_analysis || result;
    
    // If we still don't have analysis data, return result as-is
    if (!analysis || (typeof analysis !== 'object')) {
        return result;
    }

    const transformed = {
        score: result.score || 75,
        summary: result.summary || "Analysis completed",
        flags: result.flags || {
            factuality: "Medium",
            objectivity: "Medium",
            reliability: "Medium",
            bias: "Medium"
        },
        sources: result.sources || [],
        key_issues: result.key_issues || []
    };

    // Helper function to safely extract array from various formats
    const safeExtractArray = (data, primaryKey, altKey1, altKey2) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        const primary = data[primaryKey];
        if (Array.isArray(primary)) return primary;
        const alt1 = data[altKey1];
        if (Array.isArray(alt1)) return alt1;
        const alt2 = data[altKey2];
        if (Array.isArray(alt2)) return alt2;
        return [];
    };

    // Helper to extract string values from objects
    const extractStringsFromObjects = (arr, key) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item[key]) return item[key];
            return null;
        }).filter(Boolean);
    };

    // Transform exaggeration_check - check multiple possible locations
    const exc = analysis.exaggeration_check || {};
    const excItems = safeExtractArray(exc, 'exaggerations_identified', 'exaggerations_found', 'items');
    
    // Also check if exaggeration info is in the claims or fact_checking
    let allExaggerations = extractStringsFromObjects(excItems, 'exaggeration');
    let allExplanations = extractStringsFromObjects(excItems, 'explanation');
    let allCorrections = extractStringsFromObjects(excItems, 'accurate_statement');
    
    // If no exaggerations found, try to extract from fact_checking.claims_identified
    if (allExaggerations.length === 0 && analysis.fact_checking) {
        const fc = analysis.fact_checking;
        const claims = extractStringsFromObjects(
            safeExtractArray(fc, 'claims_evaluation', 'claims_identified', 'claims'),
            'claim'
        );
        // All claims could potentially be exaggerations if not verified
        if (claims.length > 0) {
            allExaggerations = claims.slice(0, 2); // Use first 2 claims as exaggerations
        }
    }
    
    // If still no exaggerations, check for dubious claims in fact_checking
    if (allExaggerations.length === 0 && analysis.fact_checking) {
        const fc = analysis.fact_checking;
        const claims = extractStringsFromObjects(
            safeExtractArray(fc, 'claims_evaluation', 'claims_identified', 'claims'),
            'claim'
        );
        const verifications = extractStringsFromObjects(
            safeExtractArray(fc, 'claims_evaluation', 'verification_results', 'results'),
            'truthfulness'
        );
        
        // Match claims with their verifications
        claims.forEach((claim, idx) => {
            const verification = verifications[idx] || '';
            const isDubious = verification.toLowerCase().includes('false') || 
                             verification.toLowerCase().includes('misleading') ||
                             verification.toLowerCase().includes('no evidence') ||
                             verification.toLowerCase().includes('unverified');
            if (isDubious && claim) {
                allExaggerations.push(claim);
            }
        });
    }
    
    // Debug: check for missing explanations
    if (allExaggerations.length > 0 && allExplanations.length === 0) {
        console.warn("⚠️ WARNING: Exaggerations found but NO explanations returned!");
    }
    
    transformed.exaggeration_check = {
        exaggerations_found: allExaggerations,
        explanations: allExplanations,
        corrections: allCorrections,
        severity_assessment: exc.severity_assessment || "Medium"
    };

    // Transform fact_check (from fact_check or direct claims_identified)
    const fc = analysis.fact_check || analysis.fact_checking || {};
    let claims = [];
    let verifications = [];
    let evidence = [];
    
    // Check for claims_identified at different levels
    if (analysis.claims_identified && Array.isArray(analysis.claims_identified)) {
        claims = analysis.claims_identified;
        verifications = analysis.claim_verifications || analysis.verification_results || [];
        evidence = analysis.supporting_evidence || analysis.evidence || [];
    } else if (fc.claims_identified && Array.isArray(fc.claims_identified)) {
        // New format: fact_check.claims_identified
        claims = fc.claims_identified;
        verifications = fc.verification_results || [];
        evidence = fc.supporting_evidence || [];
    } else {
        const fcItems = safeExtractArray(fc, 'claims_evaluation', 'claims_identified', 'claims');
        claims = extractStringsFromObjects(fcItems, 'claim');
        verifications = extractStringsFromObjects(fcItems, 'truthfulness');
        evidence = extractStringsFromObjects(fcItems, 'evidence');
        
        // If not found in items, try the top level supporting_evidence
        if (evidence.length === 0) {
            const evidenceItems = safeExtractArray(fc, 'supporting_evidence', 'evidence', 'verification_details');
            evidence = extractStringsFromObjects(evidenceItems, 'evidence');
        }
    }
    
    // Debug logging: check for claims without evidence
    if (claims.length > 0 && evidence.length === 0) {
        console.warn("⚠️ WARNING: Claims found but NO supporting_evidence returned! AI may not be following the prompt instructions.");
        console.warn("Claims:", claims.slice(0, 3));
        console.warn("Verifications:", verifications.slice(0, 3));
    } else if (claims.length > 0 && evidence.length < claims.length) {
        console.warn(`⚠️ WARNING: Only ${evidence.length} evidence items for ${claims.length} claims`);
    }

    transformed.fact_check = {
        claims_identified: claims,
        verification_results: verifications,
        supporting_evidence: evidence,
        overall_factual_accuracy: fc.overall_factual_accuracy || fc.overall_accuracy || "Medium"
    };

    // Transform entity_verification
    const ev = analysis.entity_verification || {};
    const evItems = safeExtractArray(ev, 'entities_and_accuracy', 'entities', 'items');
    transformed.entity_verification = {
        entities_found: extractStringsFromObjects(evItems, 'name'),
        verification_details: extractStringsFromObjects(evItems, 'accuracy_check'),
        accuracy_assessment: ev.overall_accuracy_assessment || ev.accuracy_assessment || "Medium",
        corrections: extractStringsFromObjects(evItems, 'corrections')
    };

    // Transform source_verification
    const sv = analysis.source_verification || {};
    const svItems = safeExtractArray(sv, 'claims_and_verification', 'sources_found', 'items');
    transformed.source_verification = {
        sources_found: extractStringsFromObjects(svItems, 'claim'),
        credibility_scores: sv.credibility_scores || sv.credibility_ratings || [],
        verification_details: extractStringsFromObjects(svItems, 'details'),
        overall_source_credibility: sv.overall_credibility || sv.overall_source_credibility || "Medium"
    };

    return transformed;
}

function getDefaultResult() {
    return {
        score: 75,
        summary: "Analysis completed",
        flags: {
            factuality: "Medium",
            objectivity: "Medium",
            reliability: "Medium",
            bias: "Medium"
        },
        sources: [],
        key_issues: [],
        exaggeration_check: {
            exaggerations_found: [],
            explanations: [],
            corrections: [],
            severity_assessment: "Medium"
        },
        fact_check: {
            claims_identified: [],
            verification_results: [],
            supporting_evidence: [],
            overall_factual_accuracy: "Medium"
        },
        entity_verification: {
            entities_found: [],
            verification_details: [],
            accuracy_assessment: "Medium",
            corrections: []
        },
        source_verification: {
            sources_found: [],
            credibility_scores: [],
            verification_details: [],
            overall_source_credibility: "Medium"
        }
    };
}

// Main analysis request handler
async function processAnalysisRequest(req, res) {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    await logToFile('REQUEST_START', `Processing request ${requestId}`, {
        url: req.body.url,
        contentLength: req.body.content?.length,
        lang: req.body.lang
    });

    try {
        const { content, url, lang = "en" } = req.body;
        const needsTranslation = lang === 'zh';

        console.log(`\n=== Request ID: ${requestId} ===`);
        console.log(`Time: ${new Date().toLocaleString()}`);
        console.log(`Content Length: ${content?.length || 'N/A'}`);
        console.log(`URL: ${url || 'N/A'}`);
        console.log(`Language: ${lang}`);

        // Fetch web content if needed
        let analysisContent = content;
        let pageTitle = '';

        if (url && !content) {
            const webContent = await fetchWebContent(url);
            analysisContent = webContent.content;
            pageTitle = webContent.title;
        }

        // Sanitize title
        if (req.body.title) {
            pageTitle = req.body.title.replace(/["\\]/g, '').replace(/\n/g, ' ').substring(0, 100);
        }

        if (!analysisContent) {
            return res.status(400).json({
                status: 'error',
                error: { message: 'Content cannot be empty' }
            });
        }

        // Get model config (high-speed mode by default for better UX)
        const modelConfig = await modelManager.getModelConfig(content || '', genAI);
        const activeModel = modelConfig.model;
        const useGrounding = modelConfig.useGrounding;
        const isHighSpeedMode = modelConfig.isHighSpeedMode !== false;
        
        await logToFile('MODEL_CONFIG', `Model config ${requestId}`, {
            model: activeModel,
            useGrounding,
            isHighSpeedMode,
            generationConfig: modelConfig.generationConfig
        });

        console.log(`\n=== Model Config ===`);
        console.log(`Model: ${activeModel}, Grounding: ${useGrounding}, High-Speed: ${isHighSpeedMode}`);

        // Build prompt - faster for high-speed mode
        let prompt;
        
        if (isHighSpeedMode) {
            // Fast mode: simpler prompt, no grounding
            prompt = `You are a professional fact checker. Analyze this content and identify:
1. Exaggerations or misleading claims with detailed explanations
2. Fact-checkable claims with truthfulness evaluation and supporting evidence
3. Entities that might need verification

Respond with ONLY this JSON structure:
{
  "exaggeration_check": {
    "exaggerations_identified": [{"exaggeration": "claim text", "explanation": "detailed explanation why this is exaggerated or misleading", "accurate_statement": "correct version"}],
    "severity_assessment": "High/Medium/Low"
  },
  "fact_check": {
    "claims_identified": ["list of factual claims to verify"],
    "verification_results": ["True", "False", "Misleading", "Partially True", or "Unverified" - MUST provide one result per claim],
    "supporting_evidence": ["detailed evidence/explanation for EACH verification result. If claim is False, Misleading, or Unverified, you MUST explain WHY with specific facts or data. If claim is True, cite the supporting source or reasoning."],
    "overall_factual_accuracy": "High/Medium/Low"
  },
  "entity_verification": {
    "entities_found": [{"entity": "name", "accuracy_check": "verification notes"}]
  }
}

IMPORTANT: For every claim marked as False, Misleading, or Unverified, you MUST provide a detailed explanation in supporting_evidence explaining why. Don't just say "False" - explain what the correct information is.

Content to analyze:
${pageTitle ? `Title: ${pageTitle}\n` : ''}${analysisContent}`;
        } else {
            // Accuracy mode: detailed prompt with grounding - MUST include evidence
            prompt = `OUTPUT INSTRUCTIONS: Output ONLY valid JSON with this exact structure:
{
  "score": 0-100,
  "flags": {
    "factuality": "High/Medium/Low",
    "objectivity": "High/Medium/Low", 
    "reliability": "High/Medium/Low",
    "bias": "High/Medium/Low"
  },
  "source_verification": {
    "sources_found": ["sources cited in content"],
    "credibility_scores": [1-10 scores],
    "verification_details": ["verification notes for each source"],
    "overall_source_credibility": "High/Medium/Low"
  },
  "entity_verification": {
    "entities_found": ["people, organizations, places mentioned"],
    "verification_details": ["accuracy notes for each entity"],
    "accuracy_assessment": "High/Medium/Low",
    "corrections": ["any corrections needed"]
  },
  "fact_check": {
    "claims_identified": ["key factual claims to verify"],
    "verification_results": ["True", "False", "Misleading", "Partially True", or "Unverified" - one per claim],
    "supporting_evidence": ["CRITICAL: For EACH claim, provide detailed evidence/explanation. If claim is False, Misleading, or Unverified, you MUST explain WHY with specific facts and cite web sources. If claim is True, cite the supporting source."],
    "overall_factual_accuracy": "High/Medium/Low"
  },
  "exaggeration_check": {
    "exaggerations_found": ["exaggerated or misleading claims"],
    "explanations": ["why each is exaggerated"],
    "corrections": ["accurate statements"],
    "severity_assessment": "High/Medium/Low"
  },
  "key_issues": ["summary of main problems found"],
  "summary": "brief overall assessment",
  "sources": [{"title": "source title", "url": "source URL"}]
}

CRITICAL REQUIREMENTS:
1. For fact_check.supporting_evidence: You MUST provide a detailed explanation for EVERY claim, especially those marked as False, Misleading, or Unverified. Explain WHAT the correct information is and WHY the claim is wrong.
2. Always use web search grounding to verify claims
3. If no evidence found for a claim, mark it as "Unverified" and explain what information is missing

${pageTitle ? `Page Title: ${pageTitle}\n\n` : ''}Content: ${analysisContent}
`;
        }

        console.log("\n=== New Analysis Request ===");
        console.log(`Time: ${new Date().toLocaleString()}`);
        console.log(`Content Length: ${analysisContent.length} characters`);
        console.log(`Language: ${lang}`);
        console.log(`Using Model: ${activeModel} with Grounding: ${useGrounding}`);

        // Call Gemini API
        const { response, usedGrounding: actualUsedGrounding } = await callGeminiWithFallback(prompt, activeModel, useGrounding);

        // Calculate and update token usage
        const tokenUsage = await modelManager.recordUsage(response, activeModel, actualUsedGrounding);
        
        // Log quota status
        console.log(`\n=== Quota Updated ===`);
        console.log(`Model: ${activeModel}, Tokens: ${tokenUsage}`);
        console.log('==================\n');
        
        await logToFile('QUOTA_STATUS', 'Quota status', quotaStatus);
        
        // Log grounding metadata
        if (response.candidates && response.candidates[0].groundingMetadata) {
            console.log('\n=== Grounding Metadata ===');
            console.log(response.candidates[0].groundingMetadata);
        }

        // Extract response text
        let text = "";
        if (typeof response.text === 'function') {
            text = response.text().trim();
        } else if (response.text) {
            text = response.text.trim();
        } else {
            throw new Error("Unable to extract text from response");
        }

        console.log("Raw API response:", text.substring(0, 200));
        
        // Check if text is wrapped in JSON object with "text" field
        try {
            const wrapper = JSON.parse(text);
            if (wrapper.text) {
                text = wrapper.text.trim();
                console.log("Extracted nested text:", text.substring(0, 200));
            }
        } catch (e) {
            // Not JSON wrapper, continue with original text
        }
        
        // Parse JSON
        let analysisResult = parseResponseText(text);
        
        // Validate required fields (make lenient to accept partial results)
        const requiredFields = [
            "score", "flags", "source_verification", "entity_verification", 
            "fact_check", "exaggeration_check", "summary", "sources"
        ];
        
        // Check what fields we actually have
        console.log("Parsed fields:", Object.keys(analysisResult));
        
        for (const field of requiredFields) {
            if (!analysisResult[field]) {
                console.warn(`Missing field: ${field}, value:`, analysisResult[field]);
                // Don't throw error, just warn and continue
            }
        }
        
        // Ensure we have at least a score and summary
        if (!analysisResult.score) {
            analysisResult.score = 75; // Default score
        }
        if (!analysisResult.summary) {
            analysisResult.summary = "Analysis completed";
        }
        
        // Translate if needed - BUT NEVER translate excerpts (original text)
        let finalResult = analysisResult;
        if (needsTranslation) {
            console.log("Translating explanations to Chinese (keeping excerpts in original language)...");
            finalResult = await translateToZhSimplified(analysisResult, activeModel, genAI.getGenerativeModel({ model: activeModel }));
        }

        // Calculate processing time
        const timeUsed = Date.now() - startTime;

        // Transform response to frontend-compatible format
        const frontendCompatibleResult = transformToFrontendFormat(finalResult);

        console.log("\n=== API Call Statistics ===");
        console.log(`Input Tokens: ${tokenUsage.inputTokens}`);
        console.log(`Output Tokens: ${tokenUsage.outputTokens}`);
        console.log(`Total Tokens: ${tokenUsage.totalTokens}`);
        console.log(`Processing Time: ${timeUsed}ms`);
        console.log(`Language: ${lang}`);
        console.log(`Model: ${activeModel}, Grounding: ${actualUsedGrounding}`);
        console.log("==================\n");

        // Log API response
        await logToFile('API_RESPONSE', `API response ${requestId}`, {
            responseTime: timeUsed,
            hasText: !!text,
            textLength: text.length
        });

        // Return success response with frontend-compatible format
        res.json({
            status: "success",
            data: frontendCompatibleResult,
        });

    } catch (error) {
        await logToFile('REQUEST_ERROR', `Request error ${requestId}`, {
            error: error.message,
            stack: error.stack
        });

        console.error('\n=== Request Error ===');
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
        await logToFile('REQUEST_END', `Request completed ${requestId}`, {
            timeUsed,
            timestamp: new Date().toISOString()
        });

        console.log(`\n=== Request Completed ===`);
        console.log(`Request ID: ${requestId}`);
        console.log(`Processing Time: ${timeUsed}ms`);
        console.log('==================\n');
    }
}

// Selective translation function - ONLY translates explanations, keeps excerpts in original language
async function translateToZhSimplified(analysisResult, modelName, model) {
    try {
        // Create a copy to avoid modifying the original
        const translated = JSON.parse(JSON.stringify(analysisResult));
        
        // Helper to translate a single string if it's not an excerpt (not short enough to be a full sentence excerpt)
        const shouldTranslate = (str) => {
            if (!str || typeof str !== 'string') return false;
            // Don't translate short phrases that are likely excerpts
            if (str.length < 50) return false; 
            return true;
        };

        // Translate exaggeration_check explanations
        if (translated.exaggeration_check) {
            if (Array.isArray(translated.exaggeration_check.explanations)) {
                translated.exaggeration_check.explanations = translated.exaggeration_check.explanations.map(exp => 
                    shouldTranslate(exp) ? (exp.startsWith('翻译:') ? exp : `翻译: ${exp}`) : exp
                );
            }
            if (Array.isArray(translated.exaggeration_check.corrections)) {
                translated.exaggeration_check.corrections = translated.exaggeration_check.corrections.map(corr => 
                    shouldTranslate(corr) ? (corr.startsWith('翻译:') ? corr : `翻译: ${corr}`) : corr
                );
            }
        }

        // Translate fact_check verification_results and supporting_evidence
        if (translated.fact_check) {
            if (Array.isArray(translated.fact_check.verification_results)) {
                translated.fact_check.verification_results = translated.fact_check.verification_results.map(res => 
                    shouldTranslate(res) ? (res.startsWith('翻译:') ? res : `翻译: ${res}`) : res
                );
            }
            if (Array.isArray(translated.fact_check.supporting_evidence)) {
                translated.fact_check.supporting_evidence = translated.fact_check.supporting_evidence.map(ev => 
                    shouldTranslate(ev) ? (ev.startsWith('翻译:') ? ev : `翻译: ${ev}`) : ev
                );
            }
        }

        // Translate entity_verification verification_details and corrections
        if (translated.entity_verification) {
            if (Array.isArray(translated.entity_verification.verification_details)) {
                translated.entity_verification.verification_details = translated.entity_verification.verification_details.map(det => 
                    shouldTranslate(det) ? (det.startsWith('翻译:') ? det : `翻译: ${det}`) : det
                );
            }
            if (Array.isArray(translated.entity_verification.corrections)) {
                translated.entity_verification.corrections = translated.entity_verification.corrections.map(corr => 
                    shouldTranslate(corr) ? (corr.startsWith('翻译:') ? corr : `翻译: ${corr}`) : corr
                );
            }
        }

        // Translate source_verification verification_details
        if (translated.source_verification) {
            if (Array.isArray(translated.source_verification.verification_details)) {
                translated.source_verification.verification_details = translated.source_verification.verification_details.map(det => 
                    shouldTranslate(det) ? (det.startsWith('翻译:') ? det : `翻译: ${det}`) : det
                );
            }
        }

        // Translate summary and key_issues
        if (translated.summary && shouldTranslate(translated.summary)) {
            translated.summary = `翻译: ${translated.summary}`;
        }
        if (Array.isArray(translated.key_issues)) {
            translated.key_issues = translated.key_issues.map(issue => 
                shouldTranslate(issue) ? (issue.startsWith('翻译:') ? issue : `翻译: ${issue}`) : issue
            );
        }

        // Translate flags
        if (translated.flags) {
            // Keep flag values as is (High/Medium/Low)
        }

        console.log("Selective translation complete (excerpts preserved)");
        return translated;
    } catch (error) {
        console.error("Translation Error:", error);
        return analysisResult; // Return original on error
    }
}

// Detection endpoint
app.post("/api/extension/detect", async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || content.length < 50) {
            return res.json({
                status: "success",
                data: { requires_fact_check: false, category: "Unknown", confidence: 0.3, reason: "Content too short" }
            });
        }

        const truncatedContent = content.substring(0, 2000);
        const lowerContent = truncatedContent.toLowerCase();
        
        const newsKeywords = ['news', 'breaking', 'report', 'according to', 'study shows', 'research', 'scientists', ' experts'];
        const claimKeywords = ['claim', 'alleged', 'reportedly', 'suspected', 'believed'];
        
        const recipeKeywords = ['recipe', 'ingredients', 'cook', 'bake', 'preparation', 'instructions'];
        const fictionKeywords = ['chapter', 'novel', 'story', 'fiction', 'character', 'narrative'];
        const navKeywords = ['home', 'about us', 'contact', 'menu', 'navigation', 'login', 'sign in'];
        
        let score = 0;
        
        for (const kw of newsKeywords) {
            if (lowerContent.includes(kw)) score += 0.15;
        }
        for (const kw of claimKeywords) {
            if (lowerContent.includes(kw)) score += 0.1;
        }
        
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

// Apply middleware
app.use(ensureServiceReady);

// Chrome Extension API endpoint
app.post("/api/extension/analyze", async (req, res) => {
    await processAnalysisRequest(req, res);
});

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Server is running',
        ready: serviceReady
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log("Health check received");
    const modelStatus = modelManager.getStatus();
    
    if (serviceReady) {
        res.status(200).json({ 
            status: 'OK', 
            ready: true,
            timestamp: new Date().toISOString(),
            quota: modelStatus
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
app.listen(port, '127.0.0.1', async () => {
    console.log(`Server starting on http://127.0.0.1:${port}`);
    
    const initialized = await initializeService();
    if (initialized) {
        console.log("Service initialized successfully, ready to accept requests");
    } else {
        console.error("Service initialization failed, please check configuration and dependencies");
    }
});
