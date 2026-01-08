import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局单例状态对象
let modelState = {
  currentModel: "gemini-2.5-flash",
  groundingCount: 0,
  dailyRequests: {
    "gemini-2.5-flash-lite": 0,
    "gemini-2.5-flash": 0,
    "gemini-2.5-pro": 0
  },
  hourlyTokens: {},
  lastReset: new Date().toISOString()
};

// 内存中记录每分钟的请求数
let minuteRequests = {
  "gemini-2.5-flash-lite": { count: 0, lastMinute: Math.floor(Date.now() / 60000) },
  "gemini-2.5-flash": { count: 0, lastMinute: Math.floor(Date.now() / 60000) },
  "gemini-2.5-pro": { count: 0, lastMinute: Math.floor(Date.now() / 60000) }
};

const CONFIG = {
  MODELS: {
    LITE: "gemini-2.5-flash-lite",
    FLASH: "gemini-2.5-flash",
    PRO: "gemini-2.5-pro"
  },
  LIMITS: {
    "gemini-2.5-flash-lite": { rpm: 15, rpd: 1000 },
    "gemini-2.5-flash": { rpm: 10, rpd: 250 },
    "gemini-2.5-pro": { rpm: 5, rpd: 100 }
  },
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gemini-2.5-flash",
  HIGH_SPEED_MODEL: "gemini-2.5-flash-lite",
  STATE_FILE: path.join(__dirname, 'data', 'model-state.json'),
  USE_GROUNDING_DEFAULT: true, 
  HIGH_SPEED_MODE: false 
};

// 初始化系统
async function initialize(genAI) {
  try {
    // 确保目录存在
    await fs.mkdir(path.dirname(CONFIG.STATE_FILE), { recursive: true });
    
    // 尝试加载状态
    try {
      const data = await fs.readFile(CONFIG.STATE_FILE, 'utf8');
      modelState = JSON.parse(data);
      // 确保lastReset是字符串
      if (typeof modelState.lastReset === 'object') {
        modelState.lastReset = modelState.lastReset.toISOString(); 
      }
    } catch (err) {
      if (err.code !== 'ENOENT') console.error("读取状态文件失败", err);
      // 文件不存在则使用默认状态，无需处理
    }
    
    // 启动时检查日期重置
    checkDateReset();
    console.log(`模型管理器已初始化，当前模型: ${modelState.currentModel}`);
  } catch (error) {
    console.error("初始化失败", error);
  }
}

// 添加日志记录
async function logModelState() {
    const timestamp = new Date().toISOString();
    const stateLog = {
        timestamp,
        currentModel: modelState.currentModel,
        groundingCount: modelState.groundingCount,
        hourlyTokens: modelState.hourlyTokens,
        lastReset: modelState.lastReset
    };
    
    try {
        await fs.appendFile(
            path.join(process.cwd(), 'logs', 'model_state.log'),
            JSON.stringify(stateLog) + '\n'
        );
    } catch (error) {
        console.error('模型状态日志写入失败:', error);
    }
}

// 获取当前应该使用的模型配置
async function getModelConfig(content, genAI, options = {}) {
  // 检查日期重置
  checkDateReset();
  
  // 确定目标模型
  let targetModel = options.usePro ? CONFIG.MODELS.PRO : 
                   (options.useGrounding || !CONFIG.HIGH_SPEED_MODE ? CONFIG.MODELS.FLASH : CONFIG.MODELS.LITE);
  
  // 检查该模型的 RPM 和 RPD
  if (!checkRateLimit(targetModel)) {
    // 如果 Flash 达到限制，尝试使用 Lite
    if (targetModel === CONFIG.MODELS.FLASH && checkRateLimit(CONFIG.MODELS.LITE)) {
      console.log(`⚠️ ${targetModel} 达到限制，自动降级到 ${CONFIG.MODELS.LITE}`);
      targetModel = CONFIG.MODELS.LITE;
    } else {
      throw new Error(`Model quota exceeded for ${targetModel}. Please try again later.`);
    }
  }

  // Grounding 仅在 Flash 或 Pro 上启用（根据需求）
  const useGrounding = (targetModel === CONFIG.MODELS.FLASH || targetModel === CONFIG.MODELS.PRO) && 
                       options.useGrounding !== false;
  
  console.log(`🤖 使用模型: ${targetModel} | Grounding: ${useGrounding}`);
  
  return {
    model: targetModel,
    useGrounding: useGrounding,
    isHighSpeedMode: targetModel === CONFIG.MODELS.LITE
  };
}

// 检查频率限制 (RPM and RPD)
function checkRateLimit(model) {
  const nowMinute = Math.floor(Date.now() / 60000);
  const limit = CONFIG.LIMITS[model];
  
  // 初始化或重置分钟计数
  if (!minuteRequests[model] || minuteRequests[model].lastMinute !== nowMinute) {
    minuteRequests[model] = { count: 0, lastMinute: nowMinute };
  }
  
  // 检查 RPM
  if (minuteRequests[model].count >= limit.rpm) {
    console.warn(`[Quota] RPM limit reached for ${model}`);
    return false;
  }
  
  // 检查 RPD
  if ((modelState.dailyRequests[model] || 0) >= limit.rpd) {
    console.warn(`[Quota] RPD limit reached for ${model}`);
    return false;
  }
  
  return true;
}

// 记录API调用后的使用情况
async function recordUsage(response, model, usedGrounding) {
  const timestamp = new Date().toISOString();
  
  // 增加请求计数
  minuteRequests[model].count++;
  modelState.dailyRequests[model] = (modelState.dailyRequests[model] || 0) + 1;
  
  let totalTokens = 0;
  try {
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
    totalTokens = promptTokens + outputTokens;
  } catch (error) {
    totalTokens = 1000; // 估算
  }
  
  // 更新 Token 使用情况
  const hourKey = getCurrentHourKey();
  modelState.hourlyTokens[hourKey] = (modelState.hourlyTokens[hourKey] || 0) + totalTokens;
  
  if (usedGrounding) {
    modelState.groundingCount++;
  }
  
  // 记录详细日志
  const usageLog = {
    timestamp,
    model,
    totalTokens,
    usedGrounding,
    hourlyTokens: modelState.hourlyTokens[hourKey],
    dailyRequests: modelState.dailyRequests
  };
  
  await fs.appendFile(
    path.join(process.cwd(), 'logs', 'usage.log'),
    JSON.stringify(usageLog) + '\n'
  );
  
  await saveState();
  return totalTokens;
}

// 检查是否需要日期重置
function checkDateReset() {
  const now = new Date();
  const lastReset = new Date(modelState.lastReset);
  
  if (now.getDate() !== lastReset.getDate() || 
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()) {
    
    console.log("执行每日配额重置...");
    
    // 重置每日计数
    Object.keys(modelState.dailyRequests).forEach(key => {
      modelState.dailyRequests[key] = 0;
    });
    
    modelState.groundingCount = 0;
    modelState.lastReset = now.toISOString();
    
    // 清理 Token 记录
    modelState.hourlyTokens = {};
    
    saveState().catch(err => console.error("重置保存失败", err));
  }
}

// 获取当前小时的键名
function getCurrentHourKey() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}`;
}

// 保存状态到文件
async function saveState() {
  try {
    await fs.writeFile(CONFIG.STATE_FILE, JSON.stringify(modelState), 'utf8');
  } catch (error) {
    console.error("保存状态失败", error);
  }
}

// 使用简单估算代替API计算Token数量
async function countContentTokens(content, genAI, modelName = CONFIG.DEFAULT_MODEL) {
  // 不再尝试调用API，直接使用简单估算
  return Math.ceil(content.length / 4);
}

// 获取当前状态
function getStatus() {
  return {
    ...modelState,
    limits: CONFIG.LIMITS
  };
}

export { initialize, getModelConfig, recordUsage, getStatus }; 
