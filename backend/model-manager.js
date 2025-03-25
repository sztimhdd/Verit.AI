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
  
  // 估算Token (优先使用官方API，失败则使用简单估算)
  let estimatedTokens;
  try {
    estimatedTokens = await countContentTokens(content, genAI);
  } catch (error) {
    console.warn("Token计数API调用失败，使用简单估算", error);
    estimatedTokens = Math.ceil(content.length / 4);
  }
  
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
  
  // 检查 Gemini API SDK 版本兼容性
  // 当前使用的是 @google/generative-ai 0.2.0 版本
  // 检查API版本兼容性 - v0.2.0不支持tools参数
  try {
    // 尝试获取SDK版本
    const sdkVersion = await getSdkVersion(genAI);
    
    console.log(`检测到Google Generative AI SDK版本: ${sdkVersion || '未知'}`);
    
    // v0.2.0版本需要使用searchQueries.enabled而不是tools参数
    if (useGrounding) {
      console.log(`启用Grounding, 使用兼容API方式, 模型: ${modelState.currentModel}`);
      return {
        model: modelState.currentModel,
        // v0.2.0 API版本兼容方式
        searchParams: {
          searchQueries: {
            enabled: true
          }
        },
        // 保留空tools以保持API返回格式一致性
        tools: []
      };
    } else {
      console.log(`不使用Grounding, 模型: ${modelState.currentModel}`);
      return {
        model: modelState.currentModel,
        // 不使用搜索特性
        searchParams: {
          searchQueries: {
            enabled: false
          }
        },
        tools: []
      };
    }
  } catch (error) {
    console.warn("API版本检测失败，使用兼容配置", error);
    
    // 安全回退 - 此格式在大多数版本中兼容
    return {
      model: modelState.currentModel,
      // 按照是否使用Grounding返回searchParams
      searchParams: useGrounding ? {
        searchQueries: {
          enabled: true
        }
      } : undefined,
      tools: []
    };
  }
}

// 尝试检测SDK版本
async function getSdkVersion(genAI) {
  try {
    // 对于v0.2.0，无法直接获取版本，使用特征检测
    // 检查是否存在特征函数/属性
    const isV02x = typeof genAI.models?.countTokens === 'function';
    
    return isV02x ? "~0.2.x" : "未知";
  } catch (error) {
    console.warn("无法检测SDK版本", error);
    return "未知";
  }
}

// 记录API调用后的使用情况
async function recordUsage(response, usedGrounding) {
  // 从响应中获取Token数量
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = promptTokens + outputTokens;
  
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

// 使用官方API计算Token数量
async function countContentTokens(content, genAI, modelName = CONFIG.DEFAULT_MODEL) {
  // 调用Gemini countTokens API
  const response = await genAI.models.countTokens({
    model: modelName,
    contents: [{ parts: [{ text: content }] }]
  });
  
  return response.totalTokens;
}

export { initialize, getModelConfig, recordUsage }; 