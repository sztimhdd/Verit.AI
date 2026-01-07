document.addEventListener('DOMContentLoaded', function () {
    console.log('[Popup] DOMContentLoaded fired - POPUP.JS STARTING');
    console.log('[Popup] DOM state:', document.readyState);
    console.log('[Popup] Available elements:', {
        analyzeButton: !!document.getElementById('analyzeButton'),
        statusIndicator: !!document.getElementById('statusIndicator'),
        loadingIndicator: !!document.getElementById('loadingIndicator')
    });

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
        if (!serviceReady || isAnalyzing) {
            console.log('[Popup] Skipping analysis - serviceReady:', serviceReady, 'isAnalyzing:', isAnalyzing);
            return;
        }

        try {
            // 1. 更新UI状态为分析中
            isAnalyzing = true;
            analyzeButton.disabled = true;
            const analyzingText = i18n?.getText ? i18n.getText('buttons_analyzing') : '核查中...';
            analyzeButton.textContent = analyzingText;
            loadingIndicator.classList.remove('hidden');
            errorSection.classList.add('hidden');
            console.log('[Popup] UI updated to analyzing state');

            // 2. 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('没有活动标签页');
            }
            console.log('[Popup] Got tab:', tab.id, tab.url);

            // 3. 获取页面内容 (with timeout)
            console.log('[Popup] Extracting page content from tab:', tab.id);
            const contentResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'EXTRACT_CONTENT'
            });
            console.log('[Popup] Content response:', contentResponse);

            if (!contentResponse?.success) {
                throw new Error(contentResponse?.error || '内容提取失败');
            }

            console.log('[Popup] Content extracted, length:', contentResponse.data?.content?.length);

            // 4. 发送分析请求 (with 60 second timeout)
            console.log('[Popup] Sending analysis request to backend...');
            const analysisPromise = chrome.runtime.sendMessage({
                action: 'analyzeContent',
                content: contentResponse.data.content,
                url: tab.url,
                title: contentResponse.data.title,
                language: i18n?.currentLang || 'zh'
            });
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('分析请求超时 (60秒)')), 60000)
            );
            
            const analysisResponse = await Promise.race([analysisPromise, timeoutPromise]);
            console.log('[Popup] Analysis response received:', analysisResponse?.success);

            // 5. 处理分析结果
            if (analysisResponse?.success && analysisResponse?.data) {
                console.log('[Popup] Analysis successful, showing floating card...');
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'showFloatingCard',
                    data: analysisResponse.data
                });
                window.close();
            } else {
                throw new Error(analysisResponse?.error || '分析失败');
            }

        } catch (error) {
            // 6. 错误处理：显示错误信息
            console.error('[Popup] Analysis error:', error.message);
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error.message;
            retryButton.classList.remove('hidden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = i18n?.getText ? i18n.getText('buttons_analyze') : '开始核查';

        } finally {
            // 7. 清理状态
            isAnalyzing = false;
            loadingIndicator.classList.add('hidden');
            if (!analyzeButton.disabled) {
                analyzeButton.textContent = i18n?.getText ? i18n.getText('buttons_analyze') : '开始核查';
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
        console.log('[Popup] ========== BUTTON CLICK STARTED ==========');
        console.log('[Popup] Analyze button clicked, serviceReady:', serviceReady, 'isAnalyzing:', isAnalyzing);
        startAnalysis();
    });

    // 初始化
    checkServiceStatus();
}); 