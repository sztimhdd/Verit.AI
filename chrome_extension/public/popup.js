document.addEventListener('DOMContentLoaded', async function () {
    // 导入i18n模块
    const { getMessage } = chrome.i18n;
    
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

    // 初始化i18n - 更新所有带data-i18n属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const message = getMessage(key);
        if (message) {
            element.textContent = message;
        }
    });

    // 更新服务状态显示
    function updateServiceStatusUI(status, error = null) {
        let statusKey = '';
        let statusIconClass = '';
        let indicatorClass = '';

        if (status === 'ready') {
            statusKey = 'statusReady';
            statusIconClass = 'fas fa-check-circle status-icon-success';
            indicatorClass = 'status-indicator-success';
            serviceReady = true;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = false;
        } else if (status === 'initializing') {
            statusKey = 'statusInitializing';
            statusIconClass = 'fas fa-spinner fa-spin status-icon-initializing';
            indicatorClass = 'status-indicator-initializing';
            serviceReady = false;
            errorSection.classList.add('hidden');
            retryButton.classList.add('hidden');
            analyzeButton.disabled = true;
        } else if (status === 'error') {
            statusKey = 'statusError';
            statusIconClass = 'fas fa-times-circle status-icon-error';
            indicatorClass = 'status-indicator-error';
            serviceReady = false;
            errorSection.classList.remove('hidden');
            errorMessageDisplay.textContent = error || getMessage('serviceUnavailable');
            retryButton.classList.remove('hidden');
            analyzeButton.disabled = true;
        }

        // 使用i18n获取状态文本
        const statusText = getMessage('serviceStatus', [getMessage(statusKey)]);
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
                data: {
                    content: contentResponse.data.content,
                    url: tab.url,
                    title: contentResponse.data.title
                }
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

    // 获取UI元素
    const apiUrlInput = document.getElementById('api-url');
    const saveButton = document.getElementById('save-button');
    const statusLabel = document.getElementById('status-label');
    const quotaLabel = document.getElementById('quota-label');
    const testButton = document.getElementById('test-button');
    const languageSelect = document.getElementById('language-select');
    
    // 初始化设置
    initializeSettings();
    
    // 保存API URL
    saveButton.addEventListener('click', function() {
        const apiUrl = apiUrlInput.value.trim();
        if (!apiUrl) {
            showStatus('请输入有效的API URL', 'error');
            return;
        }
        
        // 保存URL到存储
        chrome.storage.local.set({ 'apiUrl': apiUrl }, function() {
            showStatus(getMessage('settingsSaved'), 'success');
            
            // 通知background更新URL
            chrome.runtime.sendMessage({
                action: 'updateApiUrl', 
                url: apiUrl
            }, function(response) {
                updateStatusDisplay(response);
            });
        });
    });
    
    // 测试连接按钮
    if (testButton) {
        testButton.addEventListener('click', function() {
            chrome.runtime.sendMessage({
                action: 'checkServiceStatus'
            }, function(response) {
                updateStatusDisplay(response);
            });
        });
    }
    
    // 添加测试浮动卡片按钮
    const testCardButton = document.createElement('button');
    testCardButton.id = 'test-card-button';
    testCardButton.className = 'action-button';
    testCardButton.textContent = getMessage('testFloatingCard') || '测试浮动卡片';
    testCardButton.style.marginTop = '10px';
    testCardButton.style.backgroundColor = '#4CAF50';
    
    // 将测试按钮添加到页面
    const container = document.querySelector('.container') || document.body;
    container.appendChild(testCardButton);
    
    // 添加测试按钮点击事件
    testCardButton.addEventListener('click', function() {
        // 显示测试中状态
        showStatus(getMessage('testingCard') || '正在测试浮动卡片...', 'info');
        
        // 向当前活动标签页发送测试请求
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'contentScriptReady'
                }, function(response) {
                    if (chrome.runtime.lastError || !response) {
                        showStatus(getMessage('contentScriptNotReady') || '内容脚本未准备好', 'error');
                        return;
                    }
                    
                    // 内容脚本已就绪，发送分析请求
                    testFloatingCard(tabs[0].id);
                });
            } else {
                showStatus(getMessage('noActiveTab') || '没有活动的标签页', 'error');
            }
        });
    });
    
    // 添加语言选择器变更监听
    if (languageSelect) {
        languageSelect.addEventListener('change', function() {
            const selectedLanguage = languageSelect.value;
            
            // 保存语言偏好
            chrome.storage.local.set({ 'language': selectedLanguage }, function() {
                showStatus(getMessage('languageChanged') || '语言已更改', 'success');
                
                // 通知所有标签页更新语言
                chrome.tabs.query({}, function(tabs) {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'setLanguage',
                            language: selectedLanguage
                        }).catch(() => {/* 忽略可能的错误 */});
                    });
                });
            });
        });
    }
    
    // 初始化设置
    function initializeSettings() {
        // 加载已保存的API URL
        chrome.storage.local.get(['apiUrl', 'language'], function(result) {
            if (result.apiUrl) {
                apiUrlInput.value = result.apiUrl;
            }
            
            // 设置语言选择器
            if (languageSelect && result.language) {
                languageSelect.value = result.language;
            }
        });
        
        // 获取服务状态
        chrome.runtime.sendMessage({
            action: 'getServiceStatus'
        }, function(response) {
            updateStatusDisplay(response);
        });
    }
    
    // 更新状态显示
    function updateStatusDisplay(response) {
        if (!response) return;
        
        if (response.isReady) {
            statusLabel.textContent = getMessage('serviceOnline') || '服务在线';
            statusLabel.className = 'status-label online';
        } else {
            statusLabel.textContent = getMessage('serviceOffline') || '服务离线';
            statusLabel.className = 'status-label offline';
        }
        
        // 显示配额信息
        if (response.quota && quotaLabel) {
            const remaining = response.quota.groundingRemaining;
            quotaLabel.textContent = getMessage('quotaRemaining', [remaining]) || 
                                    `剩余额度: ${remaining}`;
        }
    }
    
    // 显示状态消息
    function showStatus(message, type = 'info') {
        const statusMessage = document.getElementById('status-message');
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
        
        // 3秒后隐藏
        setTimeout(function() {
            statusMessage.style.opacity = '0';
            setTimeout(function() {
                statusMessage.style.display = 'none';
                statusMessage.style.opacity = '1';
            }, 500);
        }, 3000);
    }
    
    // 测试浮动卡片
    function testFloatingCard(tabId) {
        // 获取页面内容作为测试数据
        chrome.tabs.sendMessage(tabId, {
            action: 'EXTRACT_CONTENT'
        }, function(response) {
            if (chrome.runtime.lastError || !response || !response.success) {
                showStatus(getMessage('extractContentFailed') || '提取内容失败', 'error');
                return;
            }
            
            // 发送分析请求，带上测试标志
            const testData = {
                ...response.data,
                test: true,
                fallbackToMock: true
            };
            
            chrome.runtime.sendMessage({
                action: 'analyzeContent',
                data: testData
            }, function(analysisResponse) {
                if (chrome.runtime.lastError || !analysisResponse || !analysisResponse.success) {
                    showStatus(getMessage('testFailed') || '测试失败', 'error');
                } else {
                    showStatus(getMessage('testSuccess') || '测试成功', 'success');
                }
            });
        });
    }
}); 