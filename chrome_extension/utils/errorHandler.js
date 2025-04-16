/**
 * 简单的错误处理工具
 */

/**
 * 处理错误并返回标准格式
 * @param {Error} error - 错误对象
 * @returns {Object} 标准化的错误响应
 */
export function handleError(error) {
  console.error('发生错误:', error);
  
  return {
    success: false,
    error: {
      message: error.message || '未知错误',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };
}

export class AppError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export const ErrorCodes = {
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export function isAppError(error) {
  return error instanceof AppError;
} 