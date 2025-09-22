const logger = require('./logger');

class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // 包装异步函数，添加错误处理和重试逻辑
  async withRetry(fn, context = '', maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await fn();
        const endTime = Date.now();
        
        if (attempt > 1) {
          await logger.info(`${context} succeeded on attempt ${attempt}`, {
            attempts: attempt,
            duration: endTime - startTime
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        await logger.warn(`${context} failed on attempt ${attempt}/${maxRetries}`, {
          attempt,
          maxRetries,
          error: error.message
        });
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.delay(delay);
        }
      }
    }
    
    // 所有重试都失败了
    await this.logError(lastError, `${context} failed after ${maxRetries} attempts`);
    throw lastError;
  }

  // 计算退避延迟（指数退避）
  calculateBackoffDelay(attempt) {
    return this.retryDelay * Math.pow(2, attempt - 1);
  }

  // 包装函数，添加超时处理
  async withTimeout(fn, timeoutMs = 30000, context = '') {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        error.context = context;
        reject(error);
      }, timeoutMs);

      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  // 记录错误并更新统计
  async logError(error, context = '', metadata = {}) {
    const errorKey = `${error.name || 'Error'}:${context}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    const errorInfo = {
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
      context,
      occurenceCount: currentCount + 1,
      ...metadata
    };

    await logger.error(`Error in ${context}: ${error.message}`, errorInfo);

    // 如果错误频率过高，发出警告
    if (currentCount + 1 >= 5) {
      await logger.warn(`High error frequency detected for ${errorKey}`, {
        count: currentCount + 1,
        suggestion: 'Consider investigating the root cause'
      });
    }
  }

  // 处理爬虫特定错误
  async handleScrapingError(error, source, url) {
    const context = `scraping ${source}`;
    const metadata = {
      source,
      url,
      errorType: this.categorizeScrapingError(error)
    };

    await this.logError(error, context, metadata);

    // 返回是否应该继续处理其他源
    return !this.isFatalScrapingError(error);
  }

  // 分类爬虫错误
  categorizeScrapingError(error) {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.message.includes('404')) return 'not_found';
    if (error.message.includes('403')) return 'forbidden';
    if (error.message.includes('rate limit')) return 'rate_limited';
    if (error.message.includes('ENOTFOUND')) return 'dns_error';
    if (error.message.includes('ECONNREFUSED')) return 'connection_refused';
    return 'unknown';
  }

  // 判断是否为致命错误（应该停止整个流程）
  isFatalScrapingError(error) {
    const fatalTypes = ['connection_refused', 'dns_error'];
    const errorType = this.categorizeScrapingError(error);
    return fatalTypes.includes(errorType);
  }

  // 处理数据库错误
  async handleDatabaseError(error, operation, data = null) {
    const context = `database ${operation}`;
    const metadata = {
      operation,
      data: data ? JSON.stringify(data).substring(0, 200) : null,
      sqliteErrorCode: error.code
    };

    await this.logError(error, context, metadata);

    // SQLite特定错误处理
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // 唯一约束违反，通常是重复数据
      return { handled: true, action: 'skip' };
    } else if (error.code === 'SQLITE_BUSY') {
      // 数据库忙，可以重试
      throw error; // 让重试机制处理
    } else if (error.code === 'SQLITE_CORRUPT') {
      // 数据库损坏，这是致命错误
      throw new Error('Database corruption detected. Manual intervention required.');
    }

    return { handled: false, action: 'throw' };
  }

  // 处理API错误（翻译、短链接等）
  async handleAPIError(error, service, operation) {
    const context = `${service} ${operation}`;
    const metadata = {
      service,
      operation,
      statusCode: error.response?.status,
      responseData: error.response?.data
    };

    await this.logError(error, context, metadata);

    // 根据状态码决定处理策略
    if (error.response?.status === 429) {
      // 速率限制，建议延迟后重试
      throw new Error(`Rate limited by ${service}. Retry after delay.`);
    } else if (error.response?.status === 401) {
      // 认证错误，不应该重试
      throw new Error(`Authentication failed for ${service}. Check API key.`);
    } else if (error.response?.status >= 500) {
      // 服务器错误，可以重试
      throw error;
    }

    // 其他错误，返回降级选项
    return { shouldDegrade: true };
  }

  // 生成错误报告
  generateErrorReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      errorBreakdown: Object.fromEntries(this.errorCounts),
      topErrors: this.getTopErrors(5)
    };

    return report;
  }

  // 获取最常见的错误
  getTopErrors(limit = 5) {
    return Array.from(this.errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  // 重置错误统计
  resetStats() {
    this.errorCounts.clear();
  }

  // 延迟工具函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 优雅关闭：保存错误统计
  async gracefulShutdown() {
    const report = this.generateErrorReport();
    if (report.totalErrors > 0) {
      await logger.info('Final error report', report);
    }
  }
}

// 创建全局错误处理器
const errorHandler = new ErrorHandler();

// 处理未捕获异常
process.on('uncaughtException', async (error) => {
  await errorHandler.logError(error, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  await errorHandler.logError(error, 'unhandled promise rejection');
});

// 优雅关闭
process.on('SIGINT', async () => {
  await errorHandler.gracefulShutdown();
  process.exit(0);
});

module.exports = errorHandler;