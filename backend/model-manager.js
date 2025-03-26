import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局单例状态对象
let modelState = {
  currentModel: "gemini-2.0-flash",
  groundingCount: 0,
  hourlyTokens: {},  // 格式: {"2025-03-26-14": 1234}
  lastReset: new Date().toISOString()
};

const CONFIG = {
  DAILY_GROUNDING_LIMIT: 500,
  DEFAULT_MODEL: "gemini-2.0-flash",
  FALLBACK_MODEL: "gemini-1.5-flash",
  HOURLY_TOKEN_THRESHOLD: 800000,
  STATE_FILE: path.join(__dirname, 'data', 'model-state.json')
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

// 获取当前应该使用的模型配置
async function getModelConfig(content, genAI) {
  // 检查日期重置
  checkDateReset();
  
  // 简单Token估算
  const estimatedTokens = Math.ceil(content.length / 4);
  
  // 获取当前小时键
  const hourKey = getCurrentHourKey();
  modelState.hourlyTokens[hourKey] = modelState.hourlyTokens[hourKey] || 0;
  
  // 检查是否需要切换模型
  if (modelState.currentModel === CONFIG.DEFAULT_MODEL && 
      modelState.hourlyTokens[hourKey] + estimatedTokens > CONFIG.HOURLY_TOKEN_THRESHOLD) {
    console.log(`即将超过小时Token阈值，切换到 ${CONFIG.FALLBACK_MODEL}`);
    modelState.currentModel = CONFIG.FALLBACK_MODEL;
    await saveState();
  }
  
  // 确定是否使用Grounding
  const useGrounding = modelState.currentModel === CONFIG.DEFAULT_MODEL && 
                     modelState.groundingCount < CONFIG.DAILY_GROUNDING_LIMIT;
  
  console.log(`基本配置 - 模型: ${modelState.currentModel}, 使用Grounding: ${useGrounding}`);
  
  // 修改配置结构以符合最新API
  const modelConfig = {
    model: modelState.currentModel,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      // 如果启用Grounding，添加tools配置
      tools: useGrounding ? [{
        functionDeclarations: [{
          name: "searchWeb",
          description: "Search the web for information",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query"
              }
            },
            required: ["query"]
          }
        }]
      }] : undefined
    }
  };
  
  // 记录是否使用Grounding
  modelConfig.useGrounding = useGrounding;
  
  return modelConfig;
}

// 记录API调用后的使用情况
async function recordUsage(response, usedGrounding) {
  // 从响应中获取Token数量（某些版本可能没有此信息）
  let totalTokens = 0;
  
  try {
    // 尝试从响应中获取token数量
    const promptTokens = response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
    totalTokens = promptTokens + outputTokens;
  } catch (error) {
    // 如果无法获取，使用简单估算
    console.log("无法从响应中获取Token信息，使用固定值");
    totalTokens = 1000; // 使用一个合理的固定值
  }
  
  // 更新当前小时的使用量
  const hourKey = getCurrentHourKey();
  modelState.hourlyTokens[hourKey] = (modelState.hourlyTokens[hourKey] || 0) + totalTokens;
  
  // 更新Grounding计数
  if (usedGrounding) {
    modelState.groundingCount++;
  }
  
  // 保存状态 (为减少I/O，可考虑实现节流保存)
  await saveState();
  
  console.log(`API使用记录 - 模型: ${modelState.currentModel}, Token: ${totalTokens}, Grounding计数: ${modelState.groundingCount}`);
  
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