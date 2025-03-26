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

    // ... existing i18n initialization ...

    // 更新服务状态显示
    function updateServiceStatusUI(status, error = null) {
        let statusText = '';
        let statusIconClass = '';
        let indicatorClass = '';

        if (status === 'ready') {
            statusText = '服务状态: 正常';
            statusIconClass = 'fas fa-check-circle status-icon-success';
            indicatorClass = 'status-indicator-success';
            serviceReady = true;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = false;
        } else if (status === 'initializing') {
            statusText = '服务状态: 初始化中';
            statusIconClass = 'fas fa-spinner fa-spin status-icon-initializing';
            indicatorClass = 'status-indicator-initializing';
            serviceReady = false;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = true;
        } else if (status === 'error') {
            statusText = '服务状态: 错误';
            statusIconClass = 'fas fa-times-circle status-icon-error';
            indicatorClass = 'status-indicator-error';
            serviceReady = false;
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error || '服务不可用';
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
            loadingIndicator.classList.remove('hidden');
            errorSection.classList.add('hidden');

            // 2. 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('无法获取当前标签页');
            }

            // 3. 获取页面内容
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { 
                action: 'EXTRACT_CONTENT' 
            });
            
            if (!contentResponse?.success) {
                throw new Error(contentResponse?.error || '无法获取页面内容');
            }

            // 4. 发送分析请求
            const analysisResponse = await chrome.runtime.sendMessage({
                action: 'analyzeContent',
                content: contentResponse.data.content,
                url: tab.url,
                title: contentResponse.data.title
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
                throw new Error(analysisResponse?.error || '分析失败');
            }

        } catch (error) {
            // 6. 错误处理：显示错误信息
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error.message;
            retryButton.classList.remove('hidden');
            analyzeButton.disabled = false;

        } finally {
            // 7. 清理状态
            isAnalyzing = false;
            loadingIndicator.classList.add('hidden');
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