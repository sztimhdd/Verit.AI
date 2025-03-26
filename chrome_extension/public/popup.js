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

    // ... existing i18n initialization ...

    // 更新服务状态显示
    function updateServiceStatusUI(status, error = null) {
        let statusText = '';
        let statusIconClass = '';
        let indicatorClass = '';

        if (status === 'ready') {
            statusText = i18nManager.getText('serviceStatus.ready');
            statusIconClass = 'fas fa-check-circle status-icon-success';
            indicatorClass = 'status-indicator-success';
            serviceReady = true;
            errorSection.classList.add('hidden'); // 隐藏错误区域
            retryButton.classList.add('hidden'); // 隐藏重试按钮
        } else if (status === 'initializing') {
            statusText = i18nManager.getText('serviceStatus.initializing');
            statusIconClass = 'fas fa-spinner fa-spin status-icon-initializing';
            indicatorClass = 'status-indicator-initializing';
            serviceReady = false;
            errorSection.classList.add('hidden'); // 隐藏错误区域
            retryButton.classList.add('hidden'); // 隐藏重试按钮
        } else if (status === 'error') {
            statusText = i18nManager.getText('serviceStatus.error');
            statusIconClass = 'fas fa-times-circle status-icon-error';
            indicatorClass = 'status-indicator-error';
            serviceReady = false;
            errorSection.classList.remove('hidden'); // 显示错误区域
            errorMessageDisplay.textContent = error || i18nManager.getText('errors.serviceUnavailable'); // 显示错误信息
            retryButton.classList.remove('hidden'); // 显示重试按钮
        }

        statusIndicator.querySelector('.status-text').textContent = statusText;
        const iconElement = statusIndicator.querySelector('.status-icon');
        iconElement.className = `status-icon ${statusIconClass}`;
        statusIndicator.className = `status-indicator ${indicatorClass}`;
    }


    // ... existing checkServiceStatus function ...

    // ... existing analyzeContent function ...

    // ... existing updateQuotaDisplay function (remove or comment out) ...
    /*
    function updateQuotaDisplay(quota) {
        if (!quota) return;
        groundingQuotaDisplay.textContent = quota.groundingRemaining !== undefined ? quota.groundingRemaining : '--';
        gemini20QuotaDisplay.textContent = quota.gemini20Remaining !== undefined ? quota.gemini20Remaining : '--';
        gemini15QuotaDisplay.textContent = quota.gemini15Remaining !== undefined ? quota.gemini15Remaining : '--';
        quotaInfo.classList.remove('hidden');
    }
    */

    // ... existing event listeners ...

    // 重试按钮事件监听
    retryButton.addEventListener('click', () => {
        errorSection.classList.add('hidden'); // 点击重试时隐藏错误区域
        checkServiceStatus(); // 重新检查服务状态
    });

    // 初始化检查服务状态
    checkServiceStatus();
}); 