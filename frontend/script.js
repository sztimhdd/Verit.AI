// 配置
const CONFIG = window.APP_CONFIG || {
    API_BASE_URL: ''  // 使用空字符串作为默认值，使用相对路径
};

// DOM 元素
const elements = {
    urlInput: document.getElementById('urlInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.querySelector('.error-message'),
    results: document.getElementById('results'),
    statusText: document.getElementById('status-text'),
    statusIndicator: document.getElementById('status-indicator'),
    statusContainer: document.getElementById('status-container'),
    heroImageContainer: document.querySelector('.hero-image-container'),
    heroBrowserMockup: document.querySelector('.chrome-browser-mockup'),
    heroImage: document.querySelector('.hero-image'),
    particles: document.getElementById('particles')
};

// 状态管理
const UIState = {
    setLoading(isLoading) {
        elements.loadingState.classList.toggle('hidden', !isLoading);
        elements.analyzeBtn.disabled = isLoading;
        elements.analyzeBtn.innerHTML = isLoading 
            ? '<i class="fas fa-circle-notch fa-spin mr-2"></i><span>分析中...</span>' 
            : '<i class="fas fa-microscope mr-2"></i><span>开始核查</span>';
    },

    showError(message) {
        elements.errorState.classList.remove('hidden');
        elements.errorMessage.textContent = message;
        elements.results.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
        
        // 平滑滚动到错误信息
        elements.errorState.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    showResult(result) {
        console.log('显示结果:', result);
        elements.results.classList.remove('hidden');
        elements.errorState.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
        displayResults(result);
        
        // 平滑滚动到结果区域
        elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    updateServiceStatus(status) {
        const statusConfig = {
            'running': { text: '服务运行中', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', ready: true },
            'initializing': { text: '服务启动中', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)', ready: false },
            'error': { text: '服务错误', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', ready: false },
            'offline': { text: '服务离线', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', ready: false }
        };

        const config = statusConfig[status] || statusConfig.error;
        
        elements.statusText.textContent = config.text;
        elements.statusText.style.color = config.color;
        elements.statusIndicator.style.backgroundColor = config.color;
        elements.statusContainer.style.backgroundColor = config.bgColor;
        elements.statusContainer.classList.remove('hidden');
        elements.analyzeBtn.disabled = !config.ready;
        
        return config.ready;
    },

    reset() {
        elements.urlInput.value = '';
        elements.results.classList.add('hidden');
        elements.errorState.classList.add('hidden');
        elements.loadingState.classList.add('hidden');
        elements.urlInput.focus();
        
        // 添加清除按钮的微交互动画
        elements.clearBtn.classList.add('animate-pulse');
        setTimeout(() => {
            elements.clearBtn.classList.remove('animate-pulse');
        }, 500);
    }
};

// API 服务
const APIService = {
    async checkHealth() {
        try {
            console.log(`[${new Date().toLocaleTimeString()}] 执行健康检查...`);
            const url = `${CONFIG.API_BASE_URL}/health`;
            console.log('健康检查URL:', url);
            const response = await fetch(url);
            const status = await response.json();
            return UIState.updateServiceStatus(status.ready ? 'running' : 'initializing');
        } catch (error) {
            console.error(`[${new Date().toLocaleTimeString()}] 健康检查失败:`, error);
            return UIState.updateServiceStatus('offline');
        }
    },

    async analyze(input) {
        const isUrl = input.startsWith('http://') || input.startsWith('https://');
        
        // 显示通知
        showNotification('开始分析', '正在准备分析请求...', 'info');
        
        const response = await fetch(`/api/extension/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: isUrl ? input : '',
                content: isUrl ? '' : input,
                lang: 'zh'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `请求失败: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'error') {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('返回数据格式错误');
        }

        // 显示成功通知
        showNotification('分析完成', '已成功获取分析结果', 'success');
        
        return result.data;
    }
};

// 事件处理
async function handleAnalyzeClick() {
    const input = elements.urlInput.value.trim();
    
    if (!input) {
        UIState.showError('请输入网址或内容');
        return;
    }

    try {
        UIState.setLoading(true);
        const result = await APIService.analyze(input);
        UIState.showResult(result);
    } catch (error) {
        console.error('分析失败:', error);
        UIState.showError(error.message);
    } finally {
        UIState.setLoading(false);
    }
}

// Hero区域的特效
function initHeroEffects() {
    // 如果这些元素不存在，直接返回
    if (!elements.heroImageContainer || !elements.heroBrowserMockup || !elements.heroImage) {
        return;
    }
    
    // 3D视差效果
    elements.heroImageContainer.addEventListener('mousemove', (e) => {
        const rect = elements.heroImageContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        const tiltAmount = 10; // 倾斜程度
        const tiltX = tiltAmount * (0.5 - y);
        const tiltY = tiltAmount * (x - 0.5);
        
        elements.heroBrowserMockup.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        
        // 光泽效果
        const shine = elements.heroBrowserMockup.querySelector('.shine-effect');
        if (shine) {
            shine.style.opacity = `${0.7 * Math.max(0.2, x)}`;
        }
    });
    
    // 鼠标离开时恢复
    elements.heroImageContainer.addEventListener('mouseleave', () => {
        elements.heroBrowserMockup.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        
        const shine = elements.heroBrowserMockup.querySelector('.shine-effect');
        if (shine) {
            shine.style.opacity = '0';
        }
    });
    
    // 鼠标点击效果
    elements.heroImageContainer.addEventListener('mousedown', () => {
        elements.heroBrowserMockup.style.transform = 'perspective(1000px) scale(0.98) rotateX(0deg) rotateY(0deg)';
    });
    
    elements.heroImageContainer.addEventListener('mouseup', () => {
        // 恢复之前的变换
        const rect = elements.heroImageContainer.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        
        const tiltAmount = 10;
        const tiltX = tiltAmount * (0.5 - y);
        const tiltY = tiltAmount * (x - 0.5);
        
        elements.heroBrowserMockup.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });
    
    // 图片切换效果
    const screenshots = ['sc1.png', 'sc2.png'];
    let currentScreenshotIndex = 0;
    
    // 每5秒切换一次图片
    setInterval(() => {
        currentScreenshotIndex = (currentScreenshotIndex + 1) % screenshots.length;
        const nextScreenshot = screenshots[currentScreenshotIndex];
        
        elements.heroImage.style.opacity = '0';
        setTimeout(() => {
            elements.heroImage.src = `images/${nextScreenshot}`;
            elements.heroImage.style.opacity = '1';
        }, 500);
    }, 5000);
    
    // 设置初始的过渡效果
    elements.heroImage.style.transition = 'opacity 0.5s ease';
}

// 粒子背景
function createParticles() {
    if (!elements.particles) return;
    
    // 清除现有粒子
    elements.particles.innerHTML = '';
    
    const numParticles = 20; // 粒子数量
    const particleSizes = [3, 4, 5, 6, 7]; // 粒子尺寸
    
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // 随机位置、大小和动画延迟
        const size = particleSizes[Math.floor(Math.random() * particleSizes.length)];
        const xPos = Math.random() * 100; // 水平位置 (%)
        const delay = Math.random() * 5; // 延迟时间 (秒)
        const duration = 10 + Math.random() * 20; // 动画持续时间 (秒)
        const opacity = 0.1 + Math.random() * 0.4; // 透明度
        
        // 应用样式
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${xPos}%`;
        particle.style.bottom = '0';
        particle.style.opacity = `${opacity}`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        elements.particles.appendChild(particle);
    }
}

// 初始化
function initialize() {
    // 事件监听
    elements.analyzeBtn.addEventListener('click', handleAnalyzeClick);
    elements.clearBtn.addEventListener('click', UIState.reset);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAnalyzeClick();
    });

    // 添加输入框动画
    elements.urlInput.addEventListener('focus', () => {
        elements.urlInput.parentElement.classList.add('scale-105');
        elements.urlInput.parentElement.style.transition = 'transform 0.3s ease';
    });
    
    elements.urlInput.addEventListener('blur', () => {
        elements.urlInput.parentElement.classList.remove('scale-105');
    });
    
    // LOGO动画效果
    const logoContainers = document.querySelectorAll('.logo-container');
    logoContainers.forEach(container => {
        container.addEventListener('mouseenter', () => {
            const logoImg = container.querySelector('.logo-img');
            if (logoImg) {
                logoImg.style.transition = 'transform 0.5s ease';
                logoImg.style.transform = 'rotate(5deg) scale(1.1)';
            }
        });
        
        container.addEventListener('mouseleave', () => {
            const logoImg = container.querySelector('.logo-img');
            if (logoImg) {
                logoImg.style.transform = 'rotate(0) scale(1)';
            }
        });
    });

    // 初始健康检查
    APIService.checkHealth();
    
    // 修改为20秒执行一次健康检查
    setInterval(APIService.checkHealth, 20000);
    
    // 初始化Hero特效
    initHeroEffects();
    
    // 创建粒子背景
    createParticles();
    
    // 窗口大小变化时重新创建粒子
    window.addEventListener('resize', () => {
        createParticles();
    });
}

// LOGO动画函数 - 已移除，保持简洁设计
function initLogoAnimations() {
    // 函数保留但不执行任何操作，保持兼容性
    console.log("Logo animations removed for simplified design");
}

// 通知函数
function showNotification(title, message, type = 'info') {
    // 如果浏览器支持通知API
    if ('Notification' in window && Notification.permission === 'granted') {
        // 创建一个自定义的图标URL，添加动态参数以防止缓存
        const iconUrl = `images/V.png?t=${new Date().getTime()}`;
        
        // 创建通知
        const notification = new Notification(title, {
            body: message,
            icon: iconUrl,
            badge: iconUrl,
            // 根据通知类型设置不同的图标和样式
            data: {
                notificationType: type
            }
        });
        
        // 设置通知关闭时间
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        // 添加点击事件处理
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
    
    // 如果不支持或未授权，只在控制台打印
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
}

// 请求通知权限
function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification('通知已启用', '您将收到分析结果的通知提醒', 'success');
                }
            });
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initialize();
    requestNotificationPermission();
    
    // 设置页面图标 - 动态更新favicon
    updateFavicon();
});

// 更新网站图标函数
function updateFavicon() {
    // 检查是否已存在favicon
    let faviconLink = document.querySelector("link[rel='icon']");
    
    // 如果不存在，则创建一个新的
    if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/svg+xml';
        document.head.appendChild(faviconLink);
    }
    
    // 更新图标路径
    faviconLink.href = `favicon.svg`;
    
    // 同时更新苹果设备上的触摸图标
    let touchIconLink = document.querySelector("link[rel='apple-touch-icon']");
    
    if (!touchIconLink) {
        touchIconLink = document.createElement('link');
        touchIconLink.rel = 'apple-touch-icon';
        document.head.appendChild(touchIconLink);
    }
    
    touchIconLink.href = `favicon.svg`;
}

// 显示结果函数
function displayResults(data) {
    console.log('处理结果数据:', data);
    const resultsDiv = document.getElementById('results');
    
    // 清空现有结果
    resultsDiv.innerHTML = '';
    
    // 创建结果容器
    const resultContainer = document.createElement('div');
    resultContainer.className = 'card rounded-xl p-6 hover:shadow-xl transition-all duration-300 animate__animated animate__fadeIn';
    
    // 添加总体评分
    const scoreSection = document.createElement('div');
    scoreSection.className = 'flex flex-col items-center mb-8';
    
    const scoreClass = getScoreColorClass(data.score);
    
    scoreSection.innerHTML = `
        <div class="score-circle w-32 h-32 rounded-full flex flex-col items-center justify-center mb-4 ${scoreClass} shadow-lg">
            <span class="text-4xl font-bold">${data.score}</span>
            <span class="text-sm mt-1">可信度</span>
        </div>
        <h3 class="text-xl font-semibold">可信度评分</h3>
        <p class="text-sm mt-1 opacity-70 max-w-md text-center">基于多维度分析，得出的内容整体可信度评分</p>
    `;
    resultContainer.appendChild(scoreSection);

    // 添加标志指标
    const flagsSection = document.createElement('div');
    flagsSection.className = 'mb-8';
    flagsSection.innerHTML = `
        <h3 class="text-xl font-semibold mb-4 flex items-center">
            <i class="fas fa-chart-bar mr-2" style="color: var(--primary-color);"></i>核心指标
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${createIndicatorCard('事实性', data.flags.factuality, '内容中事实陈述的准确性')}
            ${createIndicatorCard('客观性', data.flags.objectivity, '内容呈现的角度是否客观公正')}
            ${createIndicatorCard('可靠性', data.flags.reliability, '信息来源的可靠程度')}
            ${createIndicatorCard('偏见程度', data.flags.bias, '内容中包含的主观倾向或偏见')}
        </div>
    `;
    resultContainer.appendChild(flagsSection);

    // 添加摘要
    const summarySection = document.createElement('div');
    summarySection.className = 'card p-5 rounded-lg mb-8';
    summarySection.style.backgroundColor = 'var(--bg-secondary)';
    summarySection.innerHTML = `
        <h3 class="text-xl font-semibold mb-3 flex items-center">
            <i class="fas fa-file-alt mr-2" style="color: var(--primary-color);"></i>总体评估
        </h3>
        <p class="leading-relaxed">${data.summary}</p>
    `;
    resultContainer.appendChild(summarySection);

    // 添加关键问题
    if (data.key_issues && data.key_issues.length > 0) {
        const issuesSection = document.createElement('div');
        issuesSection.className = 'mb-8';
        issuesSection.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 flex items-center">
                <i class="fas fa-exclamation-circle mr-2" style="color: var(--primary-color);"></i>主要问题
            </h3>
            <ul class="space-y-2 pl-5">
                ${data.key_issues.map(issue => `
                    <li class="flex items-start">
                        <span class="inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full text-xs" style="background-color: var(--bg-secondary);">
                            <i class="fas fa-exclamation"></i>
                        </span>
                        <span>${issue}</span>
                    </li>
                `).join('')}
            </ul>
        `;
        resultContainer.appendChild(issuesSection);
    }

    // 添加详情切换卡片
    const detailsSection = document.createElement('div');
    detailsSection.className = 'mb-8';
    detailsSection.innerHTML = `
        <h3 class="text-xl font-semibold mb-4 flex items-center">
            <i class="fas fa-list-alt mr-2" style="color: var(--primary-color);"></i>详细分析
        </h3>
        <div class="border rounded-lg overflow-hidden" style="border-color: var(--border-color);">
            <ul class="flex flex-wrap text-sm font-medium text-center" role="tablist">
                <li class="mr-2" role="presentation">
                    <button class="inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300 dark:hover:border-gray-600 active-tab" data-target="source-tab" role="tab">
                        <i class="fas fa-link mr-1"></i>来源验证
                    </button>
                </li>
                <li class="mr-2" role="presentation">
                    <button class="inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300 dark:hover:border-gray-600" data-target="entity-tab" role="tab">
                        <i class="fas fa-user-tag mr-1"></i>实体信息
                    </button>
                </li>
                <li class="mr-2" role="presentation">
                    <button class="inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300 dark:hover:border-gray-600" data-target="fact-tab" role="tab">
                        <i class="fas fa-check-double mr-1"></i>事实核查
                    </button>
                </li>
                <li role="presentation">
                    <button class="inline-block p-4 rounded-t-lg border-b-2 border-transparent hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300 dark:hover:border-gray-600" data-target="exaggeration-tab" role="tab">
                        <i class="fas fa-expand-arrows-alt mr-1"></i>夸大检查
                    </button>
                </li>
            </ul>
            <div class="p-4">
                <div id="source-tab" class="tab-content">
                    ${createSourceVerificationContent(data.source_verification)}
                </div>
                <div id="entity-tab" class="tab-content hidden">
                    ${createEntityVerificationContent(data.entity_verification)}
                </div>
                <div id="fact-tab" class="tab-content hidden">
                    ${createFactCheckContent(data.fact_check)}
                </div>
                <div id="exaggeration-tab" class="tab-content hidden">
                    ${createExaggerationContent(data.exaggeration_check)}
                </div>
            </div>
        </div>
    `;
    resultContainer.appendChild(detailsSection);

    // 添加参考来源
    const sourcesSection = document.createElement('div');
    sourcesSection.className = 'mb-2';
    sourcesSection.innerHTML = `
        <h3 class="text-xl font-semibold mb-4 flex items-center">
            <i class="fas fa-bookmark mr-2" style="color: var(--primary-color);"></i>参考来源
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${data.sources.map(source => `
                <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="card p-4 rounded-lg hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
                    <div class="flex items-start">
                        <i class="fas fa-external-link-alt mr-2 mt-1" style="color: var(--primary-color);"></i>
                        <div>
                            <h4 class="font-medium mb-1 line-clamp-2">${source.title}</h4>
                            <span class="text-xs opacity-70 truncate block">${truncateUrl(source.url)}</span>
                        </div>
                    </div>
                </a>
            `).join('')}
        </div>
    `;
    resultContainer.appendChild(sourcesSection);

    // 将结果添加到页面
    resultsDiv.appendChild(resultContainer);

    // 添加标签页切换逻辑
    const tabButtons = resultsDiv.querySelectorAll('[role="tab"]');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有活动状态
            tabButtons.forEach(btn => {
                btn.classList.remove('active-tab');
                btn.style.borderColor = 'transparent';
                btn.style.color = '';
            });
            
            // 隐藏所有内容
            const tabContents = resultsDiv.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            // 激活点击的选项卡
            button.classList.add('active-tab');
            button.style.borderColor = 'var(--primary-color)';
            button.style.color = 'var(--primary-color)';
            
            // 显示对应内容
            const target = button.getAttribute('data-target');
            document.getElementById(target).classList.remove('hidden');
        });
    });

    // 默认激活第一个标签
    tabButtons[0].style.borderColor = 'var(--primary-color)';
    tabButtons[0].style.color = 'var(--primary-color)';
}

// 辅助函数
function getScoreColorClass(score) {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 60) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
}

function getLevelIconAndColor(level) {
    const config = {
        '高': { icon: 'check-circle', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900 dark:bg-opacity-30' },
        '中': { icon: 'exclamation-circle', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30' },
        '低': { icon: 'times-circle', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900 dark:bg-opacity-30' },
        'high': { icon: 'check-circle', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900 dark:bg-opacity-30' },
        'medium': { icon: 'exclamation-circle', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30' },
        'low': { icon: 'times-circle', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900 dark:bg-opacity-30' }
    };
    return config[level.toLowerCase()] || config['中'];
}

function createIndicatorCard(title, level, description) {
    const { icon, color, bg } = getLevelIconAndColor(level);
    return `
        <div class="card p-4 rounded-lg hover:shadow-md transition-all duration-200 border-l-4 ${color.replace('text', 'border')}">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-medium">${title}</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${color}">
                    <i class="fas fa-${icon} mr-1"></i>${level}
                </span>
            </div>
            <p class="text-xs opacity-70">${description}</p>
        </div>
    `;
}

function createSourceVerificationContent(sourceData) {
    return `
        <div>
            <div class="flex items-center mb-4">
                <div class="w-2 h-2 rounded-full mr-2" style="background-color: var(--primary-color);"></div>
                <h4 class="font-medium">总体可信度</h4>
                <span class="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-300">
                    ${sourceData.overall_source_credibility}
                </span>
            </div>
            
            <div class="mb-4">
                <h4 class="font-medium mb-2">发现的来源</h4>
                ${sourceData.sources_found.length > 0 
                    ? `<ul class="space-y-2">
                        ${sourceData.sources_found.map((source, index) => `
                            <li class="p-2 rounded-lg flex justify-between items-center" style="background-color: var(--bg-secondary);">
                                <span class="truncate">${source}</span>
                                <span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-600 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-300">
                                    可信度: ${sourceData.credibility_scores[index]}/10
                                </span>
                            </li>
                        `).join('')}
                    </ul>` 
                    : '<p class="text-sm opacity-70">未发现明确的信息来源</p>'
                }
            </div>
            
            <div>
                <h4 class="font-medium mb-2">验证详情</h4>
                <ul class="space-y-2">
                    ${sourceData.verification_details.map(detail => `
                        <li class="p-3 rounded-lg border-l-2 border-blue-400 text-sm" style="background-color: var(--bg-secondary);">
                            ${detail}
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

function createEntityVerificationContent(entityData) {
    return `
        <div>
            <div class="flex items-center mb-4">
                <div class="w-2 h-2 rounded-full mr-2" style="background-color: var(--primary-color);"></div>
                <h4 class="font-medium">准确性评估</h4>
                <span class="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-300">
                    ${entityData.accuracy_assessment}
                </span>
            </div>
            
            <div class="mb-4">
                <h4 class="font-medium mb-2">识别的实体</h4>
                ${entityData.entities_found.length > 0 
                    ? `<div class="flex flex-wrap gap-2">
                        ${entityData.entities_found.map(entity => `
                            <span class="px-2 py-1 rounded-full text-xs font-medium tag" style="background-color: var(--bg-secondary);">
                                ${entity}
                            </span>
                        `).join('')}
                    </div>` 
                    : '<p class="text-sm opacity-70">未识别出关键实体</p>'
                }
            </div>
            
            <div class="mb-4">
                <h4 class="font-medium mb-2">验证详情</h4>
                <ul class="space-y-2">
                    ${entityData.verification_details.map(detail => `
                        <li class="p-3 rounded-lg border-l-2 border-purple-400 text-sm" style="background-color: var(--bg-secondary);">
                            ${detail}
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            ${entityData.corrections.length > 0 
                ? `<div>
                    <h4 class="font-medium mb-2 flex items-center">
                        <i class="fas fa-edit mr-2 text-amber-500"></i>需要更正
                    </h4>
                    <ul class="space-y-2">
                        ${entityData.corrections.map(correction => `
                            <li class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900 dark:bg-opacity-30 text-sm border-l-2 border-amber-400">
                                ${correction}
                            </li>
                        `).join('')}
                    </ul>
                </div>` 
                : ''
            }
        </div>
    `;
}

function createFactCheckContent(factData) {
    return `
        <div>
            <div class="flex items-center mb-4">
                <div class="w-2 h-2 rounded-full mr-2" style="background-color: var(--primary-color);"></div>
                <h4 class="font-medium">总体事实准确性</h4>
                <span class="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-300">
                    ${factData.overall_factual_accuracy}
                </span>
            </div>
            
            <div>
                <h4 class="font-medium mb-2">主要论述核查</h4>
                ${factData.claims_identified.map((claim, index) => `
                    <div class="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div class="flex items-start mb-2">
                            <i class="fas fa-quote-left mt-1 mr-2 text-gray-400"></i>
                            <p class="font-medium">${claim}</p>
                        </div>
                        <div class="pl-6 border-l-2" style="border-color: var(--primary-color);">
                            <p class="mb-2">${factData.verification_results[index]}</p>
                            ${factData.supporting_evidence[index] 
                                ? `<div class="p-2 rounded text-xs mt-2" style="background-color: var(--bg-secondary);">
                                    <span class="font-medium">证据：</span>${factData.supporting_evidence[index]}
                                </div>` 
                                : ''
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function createExaggerationContent(exaggerationData) {
    return `
        <div>
            <div class="flex items-center mb-4">
                <div class="w-2 h-2 rounded-full mr-2" style="background-color: var(--primary-color);"></div>
                <h4 class="font-medium">夸大程度评估</h4>
                <span class="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-300">
                    ${exaggerationData.severity_assessment}
                </span>
            </div>
            
            ${exaggerationData.exaggerations_found.length > 0 
                ? `<div>
                    ${exaggerationData.exaggerations_found.map((exaggeration, index) => `
                        <div class="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900 dark:bg-opacity-20 border-l-4 border-amber-400">
                            <div class="mb-2">
                                <span class="font-medium text-amber-700 dark:text-amber-300">夸大表述：</span>
                                <p class="italic">"${exaggeration}"</p>
                            </div>
                            <div class="mb-2">
                                <span class="font-medium text-gray-700 dark:text-gray-300">解释：</span>
                                <p>${exaggerationData.explanations[index]}</p>
                            </div>
                            <div>
                                <span class="font-medium text-green-700 dark:text-green-300">更准确的表述：</span>
                                <p class="italic">"${exaggerationData.corrections[index]}"</p>
                            </div>
                        </div>
                    `).join('')}
                </div>` 
                : '<p class="text-center py-4 opacity-70">未检测到明显的夸大表述</p>'
            }
        </div>
    `;
}

function truncateUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch (e) {
        return url.length > 40 ? url.substring(0, 40) + '...' : url;
    }
}