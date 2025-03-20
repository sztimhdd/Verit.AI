import { i18n } from './utils/i18n.js';
import { handleError } from './utils/errorHandler.js';
import { ERROR_MESSAGES, getErrorMessage } from './utils/errors.js';

// 显示加载状态
function showLoading() {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <h1>Oracle AI Fact Checker</h1>
    <div class="loading-state">
      <div class="spinner"></div>
      <p>正在进行事实核查...</p>
    </div>
  `;
}

// 显示错误状态
function showError(message) {
  const container = document.querySelector('.container');
  container.innerHTML = `
    <h1>Oracle AI Fact Checker</h1>
    <div class="error-state">
      <p>🚫 ${message}</p>
      <button id="retryButton">重试</button>
    </div>
  `;
  
  document.getElementById('retryButton').addEventListener('click', initializePopup);
}

// 显示分析结果
function renderResults(result) {
  const container = document.querySelector('.container');
  
  if (!result || !result.score) {
    showError(ERROR_MESSAGES.INVALID_RESPONSE);
    return;
  }
  
  container.innerHTML = `
    <h1>Oracle AI Fact Checker</h1>
    <div class="score-container ${getScoreClass(result.score)}">
      <h2>分数: ${result.score}</h2>
    </div>
    
    <div class="flags-container">
      <h3>分析指标</h3>
      <ul>
        <li>事实性: ${result.flags.factuality}</li>
        <li>客观性: ${result.flags.objectivity}</li>
        <li>可靠性: ${result.flags.reliability}</li>
        <li>偏见性: ${result.flags.bias}</li>
      </ul>
    </div>
    
    <div class="summary-container">
      <h3>摘要</h3>
      <p>${result.summary}</p>
    </div>
    
    ${result.sources && result.sources.length > 0 ? `
      <div class="sources-container">
        <h3>来源</h3>
        <ul>
          ${result.sources.map(source => 
            `<li><a href="${source.url}" target="_blank">${source.title}</a></li>`
          ).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

// 获取分数对应的CSS类名
function getScoreClass(score) {
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-medium';
  if (score >= 40) return 'score-low';
  return 'score-very-low';
}

async function initializePopup() {
  try {
    showLoading();
    
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error(ERROR_MESSAGES.CONTENT_EXTRACTION);
    }

    // 触发分析并等待响应
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      tabId: tab.id,
      url: tab.url
    });

    if (!response || !response.received) {
      throw new Error('后台服务未响应');
    }

  } catch (error) {
    showError(getErrorMessage(error.message));
  }
}

// 确保消息监听器在DOM加载完成后就建立
document.addEventListener('DOMContentLoaded', () => {
  // 初始化弹出窗口
  initializePopup();
  
  // 建立消息监听
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'analysisComplete') {
      renderResults(message.data);
    } else if (message.type === 'analysisError') {
      showError(getErrorMessage(message.error));
    }
    return true; // 保持消息通道开放
  });
});