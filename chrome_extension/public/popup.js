document.addEventListener('DOMContentLoaded', function () {
    const analyzeButton = document.getElementById('analyzeButton');
    const statusIndicator = document.getElementById('statusIndicator');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorSection = document.getElementById('errorSection');
    const errorMessageDisplay = document.getElementById('errorMessage');
    const retryButton = document.getElementById('retryButton');
    const highlightsToggle = document.getElementById('highlightsToggle');

    let serviceReady = false;
    let isAnalyzing = false;
    let i18n = null;

    // 初始化 i18n 管理器 (带错误处理)
    try {
        i18n = new I18nManager();
        i18n.initialize().then(() => {
            // 初始化完成后更新界面文本
            updateUITexts();
        }).catch(error => {
            console.error('[Popup] I18n initialization failed:', error);
            // Fallback to default text if i18n fails
            updateUITexts();
        });
    } catch (error) {
        console.error('[Popup] Failed to create I18nManager:', error);
        // Initialize with minimal functionality even if i18n fails
        updateUITexts();
    }

    // 初始化Highlights设置
    async function initHighlightsSettings() {
        try {
            const result = await chrome.storage.sync.get(['highlightsEnabled']);
            const enabled = result.highlightsEnabled !== false; // Default to true
            highlightsToggle.checked = enabled;
            
            // 监听设置变化
            highlightsToggle.addEventListener('change', async () => {
                const enabled = highlightsToggle.checked;
                await chrome.storage.sync.set({ highlightsEnabled: enabled });
                
                // 通知content script设置已更改
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.id) {
                        if (enabled) {
                            // 如果启用，重新应用高亮（需要重新分析的结果）
                            console.log('[Popup] Highlights enabled - user needs to re-analyze for new highlights');
                        } else {
                            // 如果禁用，清除当前页面的高亮
                            await chrome.tabs.sendMessage(tab.id, { action: 'clearHighlights' });
                        }
                    }
                } catch (error) {
                    console.warn('[Popup] Failed to notify content script:', error);
                }
            });
        } catch (error) {
            console.error('[Popup] Failed to load highlights settings:', error);
        }
    }
    
    // 初始化设置
    initHighlightsSettings();
    
    // 更新界面上的所有文本
    function updateUITexts() {
        // 更新按钮文本
        analyzeButton.textContent = i18n.getText('buttons_analyze');
        retryButton.textContent = i18n.getText('buttons_retry');
        
        // 更新当前显示的状态文本
        updateServiceStatusUI(serviceReady ? 'ready' : 'error');
    }

    // 更新服务状态显示
    function updateServiceStatusUI(status, error = null) {
        let statusText = '';
        let statusIconClass = '';
        let indicatorClass = '';

        if (status === 'ready') {
            statusText = i18n.getText('serviceStatusReady');
            statusIconClass = 'fas fa-check-circle status-icon-success';
            indicatorClass = 'status-indicator-success';
            serviceReady = true;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = false;
        } else if (status === 'initializing') {
            statusText = i18n.getText('serviceStatusInitializing');
            statusIconClass = 'fas fa-spinner fa-spin status-icon-initializing';
            indicatorClass = 'status-indicator-initializing';
            serviceReady = false;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = true;
        } else if (status === 'error') {
            statusText = i18n.getText('serviceStatusError');
            statusIconClass = 'fas fa-times-circle status-icon-error';
            indicatorClass = 'status-indicator-error';
            serviceReady = false;
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error || i18n.getText('errors_serviceUnavailable');
            retryButton.classList.remove('hidden');
            analyzeButton.disabled = true;
        }

        statusIndicator.querySelector('.status-text').textContent = statusText;
        const iconElement = statusIndicator.querySelector('.status-icon');
        iconElement.className = `status-icon ${statusIconClass}`;
        statusIndicator.className = `status-indicator ${indicatorClass}`;
    }

    // 检查服务状态
    async function checkServiceStatus() {
        try {
            console.log('[Popup] Checking service status...');
            const response = await chrome.runtime.sendMessage({ action: 'checkServiceStatus' });
            console.log('[Popup] Service status response:', response);
            updateServiceStatusUI(
                response.isReady ? 'ready' : 'error',
                response.error
            );
        } catch (error) {
            console.error('[Popup] Error checking service status:', error);
            updateServiceStatusUI('error', error.message);
        }
    }

    // 开始分析
    async function startAnalysis() {
        if (!serviceReady || isAnalyzing) return;

        try {
            // 1. 更新UI状态为分析中
            isAnalyzing = true;
            analyzeButton.disabled = true;
            analyzeButton.textContent = i18n.getText('buttons_analyzing');
            loadingIndicator.classList.remove('hidden');
            errorSection.classList.add('hidden');

            // 2. 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error(i18n.getText('errors_noActiveTab'));
            }

            // 3. 获取页面内容
            console.log('[Popup] Extracting page content from tab:', tab.id);
            const contentResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'EXTRACT_CONTENT'
            });
            console.log('[Popup] Content response:', contentResponse);

            if (!contentResponse?.success) {
                throw new Error(contentResponse?.error || i18n.getText('errors_analysisError'));
            }

            // 4. 发送分析请求
            console.log('[Popup] Sending analysis request to backend...');
            const analysisResponse = await chrome.runtime.sendMessage({
                action: 'analyzeContent',
                content: contentResponse.data.content,
                url: tab.url,
                title: contentResponse.data.title,
                language: i18n.currentLang // 添加语言参数
            });
            console.log('[Popup] Analysis response:', analysisResponse);

            // 5. 处理分析结果
            if (analysisResponse?.success && analysisResponse?.data) {
                // 高亮显示已在background.js中处理，这里只显示浮动卡片
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'showFloatingCard',
                    data: analysisResponse.data
                });
                window.close(); // 关闭popup
            } else {
                // 分析失败：显示错误信息
                throw new Error(analysisResponse?.error || i18n.getText('errors_analysisError'));
            }

        } catch (error) {
            // 6. 错误处理：显示错误信息
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error.message;
            retryButton.classList.remove('hidden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = i18n.getText('buttons_analyze');

        } finally {
            // 7. 清理状态
            isAnalyzing = false;
            loadingIndicator.classList.add('hidden');
            if (!analyzeButton.disabled) {
                analyzeButton.textContent = i18n.getText('buttons_analyze');
            }
        }
    }

    // 重试按钮事件处理
    retryButton.addEventListener('click', async () => {
        errorSection.classList.add('hidden');
        retryButton.classList.add('hidden');
        await startAnalysis(); // 直接重试分析
    });

    // 分析按钮事件处理
    analyzeButton.addEventListener('click', () => {
        console.log('[Popup] Analyze button clicked');
        console.log('[Popup] serviceReady:', serviceReady, 'isAnalyzing:', isAnalyzing);
        startAnalysis();
    });

    // 初始化
    checkServiceStatus();
}); 