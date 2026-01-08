import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局单例状态对象
let modelState = {
  currentModel: "gemini-2.5-flash",
  groundingCount: 0,
  hourlyTokens: {},
  lastReset: new Date().toISOString()
};

const CONFIG = {
  DAILY_GROUNDING_LIMIT: 500,
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gemini-2.5-flash",
  // Use 2.0-flash for high-speed mode (faster, cheaper)
  HIGH_SPEED_MODEL: "gemini-2.0-flash",
  FALLBACK_MODEL: "gemini-2.0-flash",
  HOURLY_TOKEN_THRESHOLD: 800000,
  STATE_FILE: path.join(__dirname, 'data', 'model-state.json'),
  // Speed vs Accuracy settings
  USE_GROUNDING_DEFAULT: true, // Enable web search grounding for accuracy
  HIGH_SPEED_MODE: false // Disable high-speed mode for better accuracy with grounding
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
  
  // 如果请求明确要求使用 grounding（高精度模式）
  const forceGrounding = options.useGrounding === true;
  
  // 如果强制使用 grounding，使用默认模型
  // 否则使用更快的模型
  const useFastModel = !forceGrounding;
  
  // 默认情况下禁用 grounding 以获得更快的响应 (2-5秒 vs 15-20秒)
  const useGrounding = forceGrounding && 
                       modelState.currentModel === CONFIG.DEFAULT_MODEL && 
                       modelState.groundingCount < CONFIG.DAILY_GROUNDING_LIMIT;
  
  // 高速模式：使用更快的模型，不使用 grounding
  const activeModel = useFastModel ? CONFIG.HIGH_SPEED_MODEL : modelState.currentModel;
  
  if (useFastModel) {
    console.log(`🚀 高速模式 - 使用 ${CONFIG.HIGH_SPEED_MODEL} (跳过 grounding)`);
  } else {
    console.log(`📚 精确模式 - 使用 ${activeModel} + grounding (${modelState.groundingCount}/${CONFIG.DAILY_GROUNDING_LIMIT})`);
  }
  
  // 返回简化的配置
  const modelConfig = {
    model: activeModel,
    useGrounding: useGrounding,
    isHighSpeedMode: useFastModel
  };
  
  return modelConfig;
}

// 记录API调用后的使用情况
async function recordUsage(response, usedGrounding) {
  const timestamp = new Date().toISOString();
  let totalTokens = 0;
  
  console.log('\n=== 记录API使用 ===');
  
  try {
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
    totalTokens = promptTokens + outputTokens;
    
    console.log('提示Token:', promptTokens);
    console.log('输出Token:', outputTokens);
    console.log('总Token:', totalTokens);
  } catch (error) {
    console.log('无法获取Token信息，使用估算值');
    totalTokens = 1000;
  }
  
  // 更新使用量
  const hourKey = getCurrentHourKey();
  modelState.hourlyTokens[hourKey] = (modelState.hourlyTokens[hourKey] || 0) + totalTokens;
  
  if (usedGrounding) {
    modelState.groundingCount++;
    console.log('Grounding使用次数更新:', modelState.groundingCount);
  }
  
  // 记录使用情况
  const usageLog = {
    timestamp,
    totalTokens,
    usedGrounding,
    hourlyTokens: modelState.hourlyTokens[hourKey],
    groundingCount: modelState.groundingCount
  };
  
  await fs.appendFile(
    path.join(process.cwd(), 'logs', 'usage.log'),
    JSON.stringify(usageLog) + '\n'
  );
  
  console.log('使用记录已保存');
  
  return totalTokens;
}

// 检查是否需要日期重置
function checkDateReset() {
  const now = new Date();
  const lastReset = new Date(modelState.lastReset);
  
  if (now.getDate() !== lastReset.getDate() || 
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()) {
    
    // 新的一天，重置状态
    modelState.currentModel = CONFIG.DEFAULT_MODEL;
    modelState.groundingCount = 0;
    modelState.lastReset = now.toISOString();
    
    // 清理过期小时数据，只保留今天的
    const today = now.toISOString().slice(0, 10);
    Object.keys(modelState.hourlyTokens).forEach(key => {
      if (!key.startsWith(today)) {
        delete modelState.hourlyTokens[key];
      }
    });
    
    // 异步保存，不等待结果
    saveState().catch(err => console.error("重置保存失败", err));
    console.log("执行日期重置，已切换回默认模型");
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

export { initialize, getModelConfig, recordUsage }; 
