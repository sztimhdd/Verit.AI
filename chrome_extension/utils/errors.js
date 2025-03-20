export const ERROR_MESSAGES = {
  CONTENT_EXTRACTION: '无法提取页面内容',
  API_ERROR: 'API 服务暂时不可用',
  INVALID_RESPONSE: '无效的分析结果',
  NETWORK_ERROR: '网络连接错误',
  UNKNOWN_ERROR: '发生未知错误'
};

export function getErrorMessage(error) {
  if (error.includes('API')) {
    return ERROR_MESSAGES.API_ERROR;
  }
  if (error.includes('content')) {
    return ERROR_MESSAGES.CONTENT_EXTRACTION;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
} 