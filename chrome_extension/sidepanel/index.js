import DOMPurify from 'dompurify';
import { marked } from 'marked';

// The underlying model has a context of 1,024 tokens, out of which 26 are used by the internal prompt,
// leaving about 998 tokens for the input text. Each token corresponds, roughly, to about 4 characters, so 4,000
// is used as a limit to warn the user the content might be too long to summarize.
const MAX_MODEL_CHARS = 4000;

let pageContent = '';

const summaryElement = document.body.querySelector('#summary');
const warningElement = document.body.querySelector('#warning');
const summaryTypeSelect = document.querySelector('#type');
const summaryFormatSelect = document.querySelector('#format');
const summaryLengthSelect = document.querySelector('#length');

function onConfigChange() {
  const oldContent = pageContent;
  pageContent = '';
  onContentChange(oldContent);
}

[summaryTypeSelect, summaryFormatSelect, summaryLengthSelect].forEach((e) =>
  e.addEventListener('change', onConfigChange)
);

chrome.storage.session.get('pageContent', ({ pageContent }) => {
  onContentChange(pageContent);
});

chrome.storage.session.onChanged.addListener((changes) => {
  const pageContent = changes['pageContent'];
  onContentChange(pageContent.newValue);
});

// 新增：风险等级计算
function getRiskClass(score) {
  if (score >= 80) return 'low-risk';
  if (score >= 60) return 'medium-risk';
  return 'high-risk';
}

function getRiskLabel(score) {
  if (score >= 80) return '低风险';
  if (score >= 60) return '中等风险';
  return '高风险';
}

// 修改：onContentChange函数
async function onContentChange(newContent) {
  if (pageContent == newContent) return;
  
  pageContent = newContent;
  if (newContent) {
    showSummary('分析中...');
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    const result = generateMockData(newContent);
    displayAnalysisResult(result);
  } else {
    showSummary("无内容可分析");
  }
}

async function generateSummary(text) {
  try {
    const session = await createSummarizer(
      {
        type: summaryTypeSelect.value,
        format: summaryFormatSelect.value,
        length: length.value
      },
      (message, progress) => {
        console.log(`${message} (${progress.loaded}/${progress.total})`);
      }
    );
    const summary = await session.summarize(text);
    session.destroy();
    return summary;
  } catch (e) {
    console.log('Summary generation failed');
    console.error(e);
    return 'Error: ' + e.message;
  }
}

async function createSummarizer(config, downloadProgressCallback) {
  if (!window.ai || !window.ai.summarizer) {
    throw new Error('AI Summarization is not supported in this browser');
  }
  const canSummarize = await window.ai.summarizer.capabilities();
  if (canSummarize.available === 'no') {
    throw new Error('AI Summarization is not supported');
  }
  const summarizationSession = await self.ai.summarizer.create(
    config,
    downloadProgressCallback
  );
  if (canSummarize.available === 'after-download') {
    summarizationSession.addEventListener(
      'downloadprogress',
      downloadProgressCallback
    );
    await summarizationSession.ready;
  }
  return summarizationSession;
}

async function showSummary(text) {
  summaryElement.innerHTML = DOMPurify.sanitize(marked.parse(text));
}

async function updateWarning(warning) {
  warningElement.textContent = warning;
  if (warning) {
    warningElement.removeAttribute('hidden');
  } else {
    warningElement.setAttribute('hidden', '');
  }
}
