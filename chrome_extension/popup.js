// 更新结果处理逻辑
function updateResultUI(data) {
  // 分数显示
  document.getElementById('score').textContent = `${data.score}/100`;
  
  // 警告列表
  const flagsContainer = document.getElementById('flags');
  flagsContainer.innerHTML = data.flags.map(flag => 
    `<li class="flag-item">⚠️ ${flag}</li>`
  ).join('');
  
  // 新增指标显示
  document.querySelectorAll('.metric-value').forEach((elem, index) => {
    elem.textContent = Object.values(data.metrics)[index];
  });
}

// 添加DOM加载监听
document.addEventListener('DOMContentLoaded', () => {
  // 初始化默认值
  updateResultUI({
    score: 0,
    flags: ["Initializing..."],
    metrics: { accuracy: "-", credibility: "-", exaggeration: "-" }
  });

  // 添加调试日志
  console.log('[Popup] 监听器已激活');
});

// 重构消息监听器
chrome.runtime.onMessage.addListener((message) => {
  console.log('[Popup] 收到消息:', message);
  
  if (message.action === 'SHOW_RESULT') {
    try {
      updateResultUI(message.data);
      document.getElementById('score').style.display = 'block';
    } catch (e) {
      console.error('[Popup] 更新失败:', e);
      document.getElementById('score').textContent = 'ERR';
    }
  }
});

// 保持原有updateResultUI函数不变