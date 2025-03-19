import argparse
import hashlib
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional, Union

import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai.types import GenerateContentConfig, Tool
# Configuration
GEMINI_MODEL = "gemini-2.0-flash"
CACHE_FILE = "fact_check_cache.json"
GEMINI_API_KEY='AIzaSyAGgOYBLHYReZFylVtCIB3R9Zhv4QUPLhM'
class FactChecker:
    def __init__(self, api_key: str):
        """Initialize the fact checker with the Gemini API key."""
        self.client = genai.Client(api_key=api_key)
        self.config = genai.types.GenerateContentConfig(
            system_instruction="执行事实核查和分析的专家系统"
        )
        self.cache = self._load_cache()
        
    def _load_cache(self) -> Dict:
        """Load the cache from file if it exists."""
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def _save_cache(self):
        """Save the cache to file."""
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, ensure_ascii=False, indent=2)
    
    def _get_content_hash(self, content: str) -> str:
        """Generate a hash for the content to use as cache key."""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def fetch_content(self, url: str) -> str:
        """Fetch and extract the main text content from a URL."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.extract()
            
            # Get text
            text = soup.get_text()
            
            # Break into lines and remove leading and trailing space
            lines = (line.strip() for line in text.splitlines())
            # Break multi-headlines into a line each
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            # Drop blank lines
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return text
        except Exception as e:
            print(f"Error fetching URL: {e}")
            sys.exit(1)
    
    def analyze_content(self, content: str) -> Dict:
        """Analyze the content using Gemini API."""
        content_hash = self._get_content_hash(content)
        
        # Check if we have this in cache
        if content_hash in self.cache:
            print("Content found in cache. Using cached analysis.")
            return self.cache[content_hash]
        
        # Perform all analysis types
        result = {
            "source_verification": self._verify_sources(content),
            "entity_verification": self._verify_entities(content),
            "fact_check": self._check_facts(content),
            "exaggeration_check": self._check_exaggerations(content),
            "overall_assessment": self._get_overall_assessment(content)
        }
        
        # Save to cache
        self.cache[content_hash] = result
        self._save_cache()
        
        return result
    
    def _verify_sources(self, content: str) -> Dict:
        """Verify the sources mentioned in the content."""
        prompt = f"""
        Please analyze the following text and verify any sources mentioned (like journals, research papers, institutions, etc.).
        For each source:
        1. Identify the source and what claims it supposedly supports
        2. Verify if the source exists
        3. Check if the source actually made the claimed statements
        4. Rate the credibility of each source reference on a scale of 1-10
        
        Format your response as JSON with the following structure:
        {{
            "sources_found": [list of sources],
            "verification_results": [list of verification results],
            "credibility_scores": [list of scores],
            "overall_source_credibility": "High/Medium/Low"
        }}
        
        TEXT TO ANALYZE:
        {content}
        """
        
        try:
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            full_response = ''.join([chunk.text for chunk in response_stream if chunk.text])
            json_text = re.search(r'\{.*\}', full_response, re.DOTALL)
            if json_text:
                return json.loads(json_text.group(0))
            return {"error": "Could not parse JSON response"}
        except Exception as e:
            return {"error": f"Source verification failed: {str(e)}"}
    
    def _verify_entities(self, content: str) -> Dict:
        """Verify people and entities mentioned in the content."""
        prompt = f"""
        Please analyze the following text and verify key people and entities mentioned.
        For each person or entity:
        1. Identify the name and what is claimed about them
        2. Verify if they exist
        3. Check if the information about them is accurate
        4. Provide corrections for any inaccuracies
        
        Format your response as JSON with the following structure:
        {{
            "entities_found": [list of entities],
            "verification_results": [list of verification details],
            "accuracy_assessment": "High/Medium/Low"
        }}
        
        TEXT TO ANALYZE:
        {content}
        """
        
        try:
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            full_response = ''.join([chunk.text for chunk in response_stream if chunk.text])
            json_text = re.search(r'\{.*\}', full_response, re.DOTALL)
            if json_text:
                return json.loads(json_text.group(0))
            return {"error": "Could not parse JSON response"}
        except Exception as e:
            return {"error": f"Entity verification failed: {str(e)}"}
    
    def _check_facts(self, content: str) -> Dict:
        """Check key facts in the content against reliable sources."""
        prompt = f"""
        Please analyze the following text and verify the key factual claims.
        For each significant claim:
        1. Identify the claim
        2. Assess whether it's true, partially true, or false based on reliable sources
        3. Provide corrections for false or misleading claims
        4. Cite reliable sources for your verification where possible
        
        Format your response as JSON with the following structure:
        {{
            "claims_identified": [list of claims],
            "verification_results": [list of verification details],
            "overall_factual_accuracy": "High/Medium/Low"
        }}
        
        TEXT TO ANALYZE:
        {content}
        """
        
        try:
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            full_response = ''.join([chunk.text for chunk in response_stream if chunk.text])
            json_text = re.search(r'\{.*\}', full_response, re.DOTALL)
            if json_text:
                return json.loads(json_text.group(0))
            return {"error": "Could not parse JSON response"}
        except Exception as e:
            return {"error": f"Fact checking failed: {str(e)}"}
    
    def _check_exaggerations(self, content: str) -> Dict:
        """Check for exaggerations or misleading statements in the content."""
        prompt = f"""
        Please analyze the following text and identify any exaggerations or misleading statements.
        For each instance:
        1. Identify the exaggerated claim
        2. Explain why it's considered exaggerated or misleading
        3. Provide a more accurate representation of the facts
        
        Format your response as JSON with the following structure:
        {{
            "exaggerations_found": [list of exaggerated claims],
            "corrections": [list of corrections],
            "severity_assessment": "High/Medium/Low"
        }}
        
        TEXT TO ANALYZE:
        {content}
        """
        
        try:
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            full_response = ''.join([chunk.text for chunk in response_stream if chunk.text])
            json_text = re.search(r'\{.*\}', full_response, re.DOTALL)
            if json_text:
                return json.loads(json_text.group(0))
            return {"error": "Could not parse JSON response"}
        except Exception as e:
            return {"error": f"Exaggeration checking failed: {str(e)}"}
    
    def _get_overall_assessment(self, content: str) -> Dict:
        """Get an overall assessment of the content's reliability."""
        prompt = f"""
        Please analyze the following text and provide an overall assessment of its reliability.
        Consider:
        1. Overall factual accuracy
        2. Source credibility
        3. Bias and tone
        4. Context and completeness
        
        Provide an overall trustworthiness score from 0-100 and a brief explanation.
        
        Format your response as JSON with the following structure:
        {{
            "trustworthiness_score": number,
            "assessment_summary": "Brief explanation",
            "key_issues": [list of main issues]
        }}
        
        TEXT TO ANALYZE:
        {content}
        """
        
        try:
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            full_response = ''.join([chunk.text for chunk in response_stream if chunk.text])
            json_text = re.search(r'\{.*\}', full_response, re.DOTALL)
            if json_text:
                return json.loads(json_text.group(0))
            return {"error": "Could not parse JSON response"}
        except Exception as e:
            return {"error": f"Overall assessment failed: {str(e)}"}
    
    def generate_debunking_card(self, analysis_results: Dict, lang: str = 'en') -> str:
        with open('lang.json', 'r', encoding='utf-8') as f:
            lang_dict = json.load(f)
        """Generate a text-based debunking card from the analysis results."""
        overall = analysis_results.get("overall_assessment", {})
        score = overall.get("trustworthiness_score", "N/A")
        summary = overall.get("assessment_summary", "Assessment not available")
        
        fact_check = analysis_results.get("fact_check", {})
        accuracy = fact_check.get("overall_factual_accuracy", "Unknown")
        
        sources = analysis_results.get("source_verification", {})
        source_credibility = sources.get("overall_source_credibility", "Unknown")
        
        exaggerations = analysis_results.get("exaggeration_check", {})
        exag_severity = exaggerations.get("severity_assessment", "Unknown")
        
        # Build issues list
        issues = overall.get("key_issues", [])
        
        # Create the card template
        card = f"""
╔═══════════════════════════════════════════════════════════════════╗
║                  {{debunking_card}}                  ║".replace(
╠═══════════════════════════════════════════════════════════════════╣
║ TRUSTWORTHINESS SCORE: {score:3}/100                                 ║
╠═══════════════════════════════════════════════════════════════════╣
║ SUMMARY: {summary[:50] + '...' if len(summary) > 50 else summary:<{50}}║
╠═══════════════════════════════════════════════════════════════════╣
║ FACTUAL ACCURACY: {accuracy:<10}                                    ║
║ SOURCE CREDIBILITY: {source_credibility:<10}                                 ║
║ EXAGGERATION LEVEL: {exag_severity:<10}                                  ║
╠═══════════════════════════════════════════════════════════════════╣
║ KEY ISSUES:                                                       ║"""
        
        for issue in issues[:3]:  # Limit to top 3 issues
            issue_text = issue[:60] + '...' if len(issue) > 60 else issue
            card += f"\n║ • {issue_text:<{63}}║"
        
        if not issues:
            card += "\n║ • No significant issues found                                   ║"
        
        card += """
╚═══════════════════════════════════════════════════════════════════╝"""
        
        return card

    def translate_to_chinese(self, text: str) -> str:
        """使用Gemini API将文本翻译成中文"""
        try:
            prompt = f"""
            请将以下英文文本翻译成中文，保持专业性和准确性：
            
            {text}
            
            只需返回翻译结果，不要包含原文或解释。
            """
            
            response_stream = self.client.models.generate_content_stream(
                model=GEMINI_MODEL,
                config=self.config,
                contents=[prompt]
            )
            
            translated_text = ''.join([chunk.text for chunk in response_stream if chunk.text])
            return translated_text.strip()
        except Exception as e:
            print(f"Translation failed: {e}")
            return text  # 如果翻译失败，返回原文

    def translate_analysis_results(self, analysis_results: Dict) -> Dict:
        """将分析结果中的英文内容翻译成中文"""
        translated_results = analysis_results.copy()
        
        # 翻译整体评估部分
        if "overall_assessment" in translated_results:
            overall = translated_results["overall_assessment"]
            if "assessment_summary" in overall:
                overall["assessment_summary"] = self.translate_to_chinese(overall["assessment_summary"])
            if "key_issues" in overall:
                overall["key_issues"] = [self.translate_to_chinese(issue) for issue in overall["key_issues"]]
        
        # 翻译事实核查部分
        if "fact_check" in translated_results:
            fact_check = translated_results["fact_check"]
            if "overall_factual_accuracy" in fact_check:
                fact_check["overall_factual_accuracy"] = self.translate_to_chinese(fact_check["overall_factual_accuracy"])
            if "claims_identified" in fact_check:
                fact_check["claims_identified"] = [self.translate_to_chinese(claim) for claim in fact_check["claims_identified"]]
            if "verification_results" in fact_check:
                fact_check["verification_results"] = [self.translate_to_chinese(result) for result in fact_check["verification_results"]]
        
        # 翻译来源验证部分
        if "source_verification" in translated_results:
            source_verification = translated_results["source_verification"]
            if "overall_source_credibility" in source_verification:
                source_verification["overall_source_credibility"] = self.translate_to_chinese(source_verification["overall_source_credibility"])
        
        # 翻译夸大检查部分
        if "exaggeration_check" in translated_results:
            exaggeration = translated_results["exaggeration_check"]
            if "severity_assessment" in exaggeration:
                exaggeration["severity_assessment"] = self.translate_to_chinese(exaggeration["severity_assessment"])
        
        return translated_results

    def generate_html_debunking_card(self, analysis_results: Dict, lang: str = 'en') -> str:
        """生成HTML格式的辟谣卡片"""
        # 如果是中文输出，先翻译分析结果
        if lang == 'zh':
            analysis_results = self.translate_analysis_results(analysis_results)
        
        # 默认语言字典
        default_lang_dict = {
            "en": {
                "debunking_card": "FACT CHECK RESULT",
                "trustworthiness": "TRUSTWORTHINESS SCORE",
                "summary": "SUMMARY",
                "factual_accuracy": "FACTUAL ACCURACY",
                "source_credibility": "SOURCE CREDIBILITY",
                "exaggeration_level": "EXAGGERATION LEVEL",
                "key_issues": "KEY ISSUES",
                "no_issues": "No significant issues found"
            },
            "zh": {
                "debunking_card": "事实核查结果",
                "trustworthiness": "可信度评分",
                "summary": "总结",
                "factual_accuracy": "事实准确性",
                "source_credibility": "来源可信度",
                "exaggeration_level": "夸大程度",
                "key_issues": "主要问题",
                "no_issues": "未发现明显问题"
            }
        }
        
        # 尝试加载语言文件
        lang_dict = default_lang_dict
        try:
            with open('lang.json', 'r', encoding='utf-8') as f:
                loaded_dict = json.load(f)
                # 确保加载的字典包含所需的键
                if 'en' in loaded_dict and 'zh' in loaded_dict:
                    lang_dict = loaded_dict
        except Exception as e:
            print(f"Warning: Could not load language file: {e}. Using default language dictionary.")
        
        # 获取当前语言的翻译，如果当前语言不存在，则使用默认英文
        if lang in lang_dict:
            texts = lang_dict[lang]
        else:
            texts = lang_dict["en"] if "en" in lang_dict else default_lang_dict["en"]
        
        # 从分析结果中提取数据
        overall = analysis_results.get("overall_assessment", {})
        score = overall.get("trustworthiness_score", "N/A")
        summary = overall.get("assessment_summary", "Assessment not available")
        
        fact_check = analysis_results.get("fact_check", {})
        accuracy = fact_check.get("overall_factual_accuracy", "Unknown")
        
        sources = analysis_results.get("source_verification", {})
        source_credibility = sources.get("overall_source_credibility", "Unknown")
        
        exaggerations = analysis_results.get("exaggeration_check", {})
        exag_severity = exaggerations.get("severity_assessment", "Unknown")
        
        # 构建问题列表
        issues = overall.get("key_issues", [])
        if not issues:
            issues = [texts["no_issues"]]
        
        # 根据可信度评分决定颜色
        try:
            score_num = int(score)
            if score_num >= 70:
                score_color = "#4CAF50"  # 绿色，可信度高
            elif score_num >= 40:
                score_color = "#FF9800"  # 橙色，可信度中等
            else:
                score_color = "#F44336"  # 红色，可信度低
        except:
            score_color = "#9E9E9E"  # 灰色，无法确定评分
        
        # 构建HTML内容
        html = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{texts["debunking_card"]}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .card {{
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .card-header {{
            background-color: #2c3e50;
            color: white;
            padding: 15px 20px;
            font-size: 22px;
            font-weight: bold;
            text-align: center;
        }}
        .score-section {{
            padding: 20px;
            text-align: center;
            border-bottom: 1px solid #eee;
        }}
        .score {{
            font-size: 48px;
            font-weight: bold;
            color: {score_color};
        }}
        .score-label {{
            font-size: 16px;
            color: #666;
            margin-top: 5px;
        }}
        .summary-section {{
            padding: 20px;
            border-bottom: 1px solid #eee;
        }}
        .summary-title {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }}
        .summary-content {{
            line-height: 1.6;
            color: #333;
        }}
        .metrics-section {{
            display: flex;
            justify-content: space-between;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
            flex-wrap: wrap;
        }}
        .metric {{
            flex: 1;
            min-width: 200px;
            margin: 5px 0;
        }}
        .metric-title {{
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }}
        .metric-value {{
            font-size: 16px;
            font-weight: bold;
        }}
        .issues-section {{
            padding: 20px;
        }}
        .issues-title {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2c3e50;
        }}
        .issue-item {{
            margin-bottom: 12px;
            padding-left: 20px;
            position: relative;
            line-height: 1.5;
        }}
        .issue-item:before {{
            content: "•";
            position: absolute;
            left: 0;
            color: #F44336;
            font-weight: bold;
        }}
        .footer {{
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="card-header">
            {texts["debunking_card"]}
        </div>
        <div class="score-section">
            <div class="score">{score}/100</div>
            <div class="score-label">{texts["trustworthiness"]}</div>
        </div>
        <div class="summary-section">
            <div class="summary-title">{texts["summary"]}</div>
            <div class="summary-content">{summary}</div>
        </div>
        <div class="metrics-section">
            <div class="metric">
                <div class="metric-title">{texts["factual_accuracy"]}</div>
                <div class="metric-value">{accuracy}</div>
            </div>
            <div class="metric">
                <div class="metric-title">{texts["source_credibility"]}</div>
                <div class="metric-value">{source_credibility}</div>
            </div>
            <div class="metric">
                <div class="metric-title">{texts["exaggeration_level"]}</div>
                <div class="metric-value">{exag_severity}</div>
            </div>
        </div>
        <div class="issues-section">
            <div class="issues-title">{texts["key_issues"]}</div>
            {"".join([f'<div class="issue-item">{issue}</div>' for issue in issues])}
        </div>
    </div>
    <div class="footer">
        ©{time.strftime("%Y")} AI事实核查系统 - 由Gemini API提供支持
    </div>
</body>
</html>"""
        
        return html

def main():
    parser = argparse.ArgumentParser(description='Analyze web content for misinformation.')
    parser.add_argument('urls', nargs='+', help='URLs to analyze')
    parser.add_argument('--lang', choices=['auto', 'en', 'zh'], default='auto', help='Output language (auto/en/zh)')
    parser.add_argument('--format', choices=['text', 'html', 'both'], default='html', help='Output format (text/html/both)')
    parser.add_argument('--open', action='store_true', help='Open HTML card in browser after generation')
    args = parser.parse_args()
    
    fact_checker = FactChecker(GEMINI_API_KEY)
    
    for url in args.urls:
        print(f"\n{'#'*40}\nProcessing URL: {url}\n{'#'*40}")
        
        # Auto-detect language based on URL domain
        lang = args.lang
        if lang == 'auto':
            lang = 'zh' if 'weixin' in url else 'en'
        
        print(f"Fetching content from {url}...")
        content = fact_checker.fetch_content(url)
        
        print("Analyzing content...")
        analysis = fact_checker.analyze_content(content)
        
        print("\n=== ANALYSIS SUMMARY ===")
        overall = analysis.get("overall_assessment", {})
        print(f"Trustworthiness Score: {overall.get('trustworthiness_score', 'N/A')}/100")
        print(f"Assessment: {overall.get('assessment_summary', 'Not available')}")
        
        print("\n=== FACT CHECK RESULTS ===")
        facts = analysis.get("fact_check", {})
        print(f"Overall Factual Accuracy: {facts.get('overall_factual_accuracy', 'Unknown')}")
        
        claims = facts.get("claims_identified", [])
        results = facts.get("verification_results", [])
        
        for i, (claim, result) in enumerate(zip(claims[:3], results[:3])):
            print(f"\nClaim {i+1}: {claim}")
            print(f"Verification: {result}")
        
        # 生成输出文件名
        output_prefix = url.split('/')[-1]
        if not output_prefix or len(output_prefix) < 5:
            output_prefix = url.split('/')[-2]
        output_prefix = output_prefix[:30]
        
        # 生成并显示文本卡片（如果需要）
        if args.format in ['text', 'both']:
            print("\n=== DEBUNKING CARD (TEXT) ===")
            text_card = fact_checker.generate_debunking_card(analysis, lang)
            print(text_card)
            
            # 保存文本卡片到文件
            text_filename = f"debunk_{output_prefix}_{lang}.txt"
            with open(text_filename, "w", encoding="utf-8") as f:
                f.write(text_card)
            print(f"Text card saved to: {text_filename}")
        
        # 生成并保存HTML卡片（如果需要）
        if args.format in ['html', 'both']:
            # 对于中文网站，强制使用中文输出
            if 'weixin' in url:
                lang = 'zh'
            
            html_card = fact_checker.generate_html_debunking_card(analysis, lang)
            html_filename = f"debunk_{output_prefix}_{lang}.html"
            
            with open(html_filename, "w", encoding="utf-8") as f:
                f.write(html_card)
            
            print(f"\n=== DEBUNKING CARD (HTML) ===")
            print(f"HTML card saved to: {html_filename}")
            
            # 如果指定了--open参数，则自动在浏览器中打开HTML文件
            if args.open:
                try:
                    import webbrowser
                    html_path = os.path.abspath(html_filename)
                    webbrowser.open('file://' + html_path)
                    print("HTML card opened in browser")
                except Exception as e:
                    print(f"Could not open HTML file: {e}")
        
        # 验证缓存处理
        content_hash = fact_checker._get_content_hash(content)
        print(f"\nCache Status: {'HIT' if content_hash in fact_checker.cache else 'MISS'}")

if __name__ == "__main__":
    main()
