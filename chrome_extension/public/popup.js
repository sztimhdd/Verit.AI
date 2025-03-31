document.addEventListener('DOMContentLoaded', function () {
    const analyzeButton = document.getElementById('analyzeButton');
    const statusIndicator = document.getElementById('statusIndicator');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorSection = document.getElementById('errorSection');
    const errorMessageDisplay = document.getElementById('errorMessage');
    const retryButton = document.getElementById('retryButton');
    // const quotaInfo = document.querySelector('.quota-info'); //  移除配额信息相关元素引用
    // const groundingQuotaDisplay = document.getElementById('groundingQuota'); //  移除配额信息相关元素引用
    // const gemini20QuotaDisplay = document.getElementById('gemini20Quota'); //  移除配额信息相关元素引用
    // const gemini15QuotaDisplay = document.getElementById('gemini15Quota'); //  移除配额信息相关元素引用

    let serviceReady = false;
    let isAnalyzing = false;
    
    // 初始化 i18n 管理器
    const i18n = new I18nManager();
    i18n.initialize().then(() => {
        // 初始化完成后更新界面文本
        updateUITexts();
    });
    
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
            const response = await chrome.runtime.sendMessage({ action: 'checkServiceStatus' });
            updateServiceStatusUI(
                response.isReady ? 'ready' : 'error',
                response.error
            );
        } catch (error) {
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
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { 
                action: 'EXTRACT_CONTENT' 
            });
            
            if (!contentResponse?.success) {
                throw new Error(contentResponse?.error || i18n.getText('errors_analysisError'));
            }

            // 4. 发送分析请求
            const analysisResponse = await chrome.runtime.sendMessage({
                action: 'analyzeContent',
                content: contentResponse.data.content,
                url: tab.url,
                title: contentResponse.data.title,
                language: i18n.currentLang // 添加语言参数
            });

            // 5. 处理分析结果
            if (analysisResponse?.success && analysisResponse?.data) {
                // 成功：显示浮动卡片
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
    analyzeButton.addEventListener('click', startAnalysis);

    // 初始化
    checkServiceStatus();
}); 