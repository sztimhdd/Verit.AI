chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ...
    switch (message.action) {
        // ...
        case 'showFloatingCard':
            if (message.data) {
                showFloatingCard(message.data)
                    .then(response => sendResponse(response)) // 异步发送响应
                    .catch(error => sendResponse({
                        success: false,
                        error: error.message
                    }));
                return true; // 表示异步响应
            } else {
                sendResponse({
                    success: false,
                    error: '无效的分析数据'
                });
            }
            break;
        // ...
    }
    // ...
});

async function showFloatingCard(data) {
    try {
        if (!data) {
            throw new Error('无效的分析数据');
        }

        // 1. 创建或获取浮动卡片
        const iframe = await createFloatingCard();
        state.isCardVisible = true;
        state.currentData = data;

        // 2. 立即向 iframe 发送数据，不再延迟
        return new Promise((resolve) => {
            setTimeout(() => {
                iframe.contentWindow.postMessage({
                    action: 'UPDATE_CONTENT',
                    data: data,
                    language: state.language
                }, '*');
                resolve({ success: true });
            }, 100); // 减少延迟到 100ms
        });
    } catch (error) {
        console.error('显示浮动卡片失败:', error);
        return { success: false, error: error.message };
    }
} 