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

document.addEventListener('DOMContentLoaded', function() {
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

async function onContentChange(newContent) {
  if (pageContent == newContent) {
    // no new content, do nothing
    return;
  }
  pageContent = newContent;
  let summary;
  if (newContent) {
    if (newContent.length > MAX_MODEL_CHARS) {
      updateWarning(
        `Text is too long for summarization with ${newContent.length} characters (maximum supported content length is ~4000 characters).`
      );
    } else {
      updateWarning('');
    }
    showSummary('Loading...');
    summary = await generateSummary(newContent);
  } else {
    summary = "There's nothing to summarize";
  }
  showSummary(summary);
}

async function generateSummary(text) {
  try {
    // 获取当前页面内容
chrome.runtime.sendMessage({
  action: 'extractContent',
  tabId: chrome.devtools.inspectedWindow.tabId
}, async (response) => {
  try {
    const analysisResult = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        content: response.content,
        lang: 'zh',
        content_hash: response.hash
      })
    });
    
    const result = await analysisResult.json();
    document.querySelector('.score-value').textContent = result.score;
    document.getElementById('issue-list').innerHTML = result.flags
      .map(flag => `<li>${flag}</li>`).join('');
    document.getElementById('report-content').innerHTML = result.details;
    
    document.querySelector('.risk-level').className = `risk-level ${getRiskClass(result.score)}`;
  } catch (error) {
    console.error('Fact check failed:', error);
  }
});

function getRiskClass(score) {
  if (score >= 80) return 'low-risk';
  if (score >= 60) return 'medium-risk';
  return 'high-risk';

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
