document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingState = document.getElementById('loadingState');
    const contentSummary = document.getElementById('contentSummary');
    const resultCard = document.getElementById('resultCard');
    const errorMessage = document.getElementById('errorMessage');

    // API端点（开发环境）
    const API_ENDPOINT = 'http://localhost:3000/api/analyze';

    analyzeBtn.addEventListener('click', async function() {
        const url = urlInput.value.trim();
        
        if (!url) {
            showError('请输入要核查的URL');
            return;
        }

        try {
            // 重置界面状态
            resetUI();
            
            // 显示加载状态
            loadingState.classList.remove('hidden');
            
            // 调用API
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // 隐藏加载状态
            loadingState.classList.add('hidden');
            
            // 显示内容汇总
            displayContentSummary(data.results);
            
            // 显示核查结果卡片
            displayResultCard(data.htmlCard);

        } catch (error) {
            showError('分析过程中出现错误：' + error.message);
        }
    });

    function resetUI() {
        loadingState.classList.add('hidden');
        contentSummary.classList.add('hidden');
        resultCard.classList.add('hidden');
        errorMessage.classList.add('hidden');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function displayContentSummary(results) {
        document.getElementById('articleTitle').textContent = results.title || '未获取到标题';
        document.getElementById('articleSource').textContent = results.source || '未获取到信源';
        document.getElementById('articleDate').textContent = results.date || '未获取到日期';
        document.getElementById('articleClaims').textContent = results.claims?.join('\n') || '未获取到主要观点';
        
        contentSummary.classList.remove('hidden');
    }

    function displayResultCard(htmlCard) {
        resultCard.innerHTML = htmlCard;
        resultCard.classList.remove('hidden');
    }
}); 