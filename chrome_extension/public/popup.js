document.addEventListener('DOMContentLoaded', async function () {
    console.log('[Popup] DOMContentLoaded fired - POPUP.JS STARTING');
    console.log('[Popup] DOM state:', document.readyState);

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
    let cachedResult = null;

    // 初始化 i18n 管理器 (带错误处理)
    try {
        i18n = new I18nManager();
        i18n.initialize().then(() => {
            updateUITexts();
        }).catch(error => {
            console.error('[Popup] I18n initialization failed:', error);
            updateUITexts();
        });
    } catch (error) {
        console.error('[Popup] Failed to create I18nManager:', error);
        updateUITexts();
    }

    // 检查缓存结果和徽章状态
    async function checkCachedState() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            // 检查徽章文本 (检测/分析中状态)
            try {
                const badgeText = await chrome.action.getBadgeText({ tabId: tab.id });
                if (badgeText === '...' || badgeText === '⟳') {
                    console.log('[Popup] Analysis in progress, showing loading state');
                    isAnalyzing = true;
                    analyzeButton.disabled = true;
                    analyzeButton.textContent = '自动核查中...';
                    loadingIndicator.classList.remove('hidden');
                    return;
                }
            } catch (e) {
                console.warn('[Popup] Could not get badge text:', e);
            }

            // 检查缓存的分析结果
            const resultResponse = await chrome.runtime.sendMessage({
                action: 'getAnalysisResult',
                tabId: tab.id
            });

            if (resultResponse?.success && resultResponse?.data) {
                console.log('[Popup] Found cached result, score:', resultResponse.data.score);
                cachedResult = resultResponse.data;
                serviceReady = true;
                updateUITexts();
            }
        } catch (error) {
            console.error('[Popup] Error checking cached state:', error);
        }
    }

    // 初始化Highlights设置
    async function initHighlightsSettings() {
        try {
            const result = await chrome.storage.sync.get(['highlightsEnabled']);
            const enabled = result.highlightsEnabled !== false;
            highlightsToggle.checked = enabled;

            highlightsToggle.addEventListener('change', async () => {
                const enabled = highlightsToggle.checked;
                await chrome.storage.sync.set({ highlightsEnabled: enabled });

                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.id) {
                        if (enabled) {
                            console.log('[Popup] Highlights enabled - user needs to re-analyze for new highlights');
                        } else {
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
    checkCachedState();

    // 更新界面上的所有文本
    function updateUITexts() {
        if (cachedResult) {
            // 显示已完成的分析结果
            const score = cachedResult.score || 0;
            analyzeButton.textContent = `查看结果 (得分: ${score})`;
            analyzeButton.disabled = false;
            serviceReady = true;
            statusIndicator.className = 'status-indicator status-indicator-success';
            statusIndicator.querySelector('.status-text').textContent = '已完成';
            statusIndicator.querySelector('.status-icon').className = 'status-icon fas fa-check-circle status-icon-success';
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
        } else {
            analyzeButton.textContent = i18n.getText('buttons_analyze');
        }
        retryButton.textContent = i18n.getText('buttons_retry');

        if (!cachedResult) {
            updateServiceStatusUI(serviceReady ? 'ready' : 'error');
        }
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
            if (!cachedResult) analyzeButton.disabled = false;
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

    // 开始分析或显示结果
    async function startAnalysis() {
        // 如果有缓存结果，直接显示
        if (cachedResult) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'showFloatingCard',
                        data: cachedResult
                    });
                    window.close();
                }
            } catch (error) {
                console.error('[Popup] Error showing cached result:', error);
            }
            return;
        }

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
                cachedResult = analysisResponse.data;
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
            if (!analyzeButton.disabled && !cachedResult) {
                analyzeButton.textContent = i18n?.getText ? i18n.getText('buttons_analyze') : '开始核查';
            }
        }
    }

    // 重试按钮事件处理
    retryButton.addEventListener('click', async () => {
        errorSection.classList.add('hidden');
        retryButton.classList.add('hidden');
        await startAnalysis();
    });

    // 分析按钮事件处理
    analyzeButton.addEventListener('click', () => {
        console.log('[Popup] ========== BUTTON CLICK STARTED ==========');
        console.log('[Popup] Analyze button clicked, serviceReady:', serviceReady, 'isAnalyzing:', isAnalyzing, 'cachedResult:', !!cachedResult);
        startAnalysis();
    });

    // 初始化
    checkServiceStatus();
});
