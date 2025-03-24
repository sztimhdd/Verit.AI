const prompt = `你是一个专业的事实核查助手。请对以下内容进行多维度分析。

首先，请仔细阅读整个文本，识别关键信息、声明和信息来源。
然后，一步步思考分析过程：

1. 来源验证：
   - 找出文中提到的所有信息来源（如期刊、研究论文、机构等）
   - 确认每个来源是否真实存在
   - 验证来源是否真的支持文中的相关声明
   - 为每个来源的可信度评分(1-10分)

2. 实体验证：
   - 识别文中提到的所有关键人物、组织和实体
   - 验证这些实体是否真实存在
   - 检查关于这些实体的描述是否准确
   - 提供对不准确描述的具体更正

3. 事实核查：
   - 识别文中所有重要的事实性声明
   - 评估每个声明是真实、部分真实还是虚假
   - 为虚假或误导性声明提供更正
   - 引用可靠来源支持你的验证结果

4. 夸大检查：
   - 识别文中所有夸大或误导性的表述
   - 解释为何这些表述被视为夸大或误导
   - 提供更准确的事实表述

5. 整体评估：
   - 综合考虑以上所有维度
   - 评估内容的整体可靠性和可信度
   - 指出内容中最关键的问题

${pageTitle ? `标题：${pageTitle}\n` : ''}文本内容：${analysisContent}

请先详细思考你的分析过程，确保全面考虑了所有证据，然后再给出最终结论。
在分析过程中，考虑不同立场和观点，避免个人偏见影响判断。
最后，严格按照以下JSON格式返回分析结果：
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
        "verification_details": ["详细验证结果，包括来源是否支持相关声明"],
        "overall_source_credibility": "高/中/低"
    },
    "entity_verification": {
        "entities_found": ["实体列表"],
        "verification_details": ["每个实体的验证详情"],
        "accuracy_assessment": "高/中/低",
        "corrections": ["需要更正的内容"]
    },
    "fact_check": {
        "claims_identified": ["主要声明列表"],
        "verification_results": ["验证结果列表，包括真实/部分真实/虚假的判断及理由"],
        "supporting_evidence": ["支持验证结果的证据或参考来源"],
        "overall_factual_accuracy": "高/中/低"
    },
    "exaggeration_check": {
        "exaggerations_found": ["夸大表述列表"],
        "explanations": ["解释为何这些是夸大或误导"],
        "corrections": ["更准确的表述"],
        "severity_assessment": "高/中/低"
    },
    "key_issues": ["内容中最主要的问题列表"],
    "summary": "作为用户信任的朋友和该领域专家，请用40个汉字以内给出关于这篇内容真实性和可信度的总结性建议，语气友好且专业",
    "sources": [
        {
            "title": "参考来源标题",
            "url": "链接地址"
        }
    ]
}`;

// 调整Gemini API调用参数
const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
        temperature: 0.1,        // 保持低温度确保结果一致性
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 4096,   // 增加输出长度上限，确保详细分析能完整输出
    },
    safetySettings: [           // 添加安全设置
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