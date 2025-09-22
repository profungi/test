const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor(logLevel = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[logLevel] || this.levels.info;
    this.logDir = './logs';
    this.initLogDir();
  }

  async initLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // 如果无法创建日志目录，只输出到控制台
      console.warn('Cannot create log directory, logging to console only');
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
  }

  async writeToFile(level, message) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `scraper_${date}.log`;
      const filepath = path.join(this.logDir, filename);
      
      await fs.appendFile(filepath, message + '\n');
    } catch (error) {
      // 静默失败，继续使用控制台输出
    }
  }

  async log(level, message, meta = {}) {
    if (this.levels[level] > this.currentLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // 输出到控制台
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn :
                         console.log;
    
    consoleMethod(formattedMessage);
    
    // 写入文件
    await this.writeToFile(level, formattedMessage);
  }

  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  // 特殊方法：记录抓取统计
  async logScrapingStats(source, stats) {
    const message = `Scraping completed for ${source}`;
    const meta = {
      source,
      eventsFound: stats.eventsFound || 0,
      eventsValid: stats.eventsValid || 0,
      duplicates: stats.duplicates || 0,
      errors: stats.errors || 0,
      duration: stats.duration || 0
    };
    
    await this.info(message, meta);
  }

  // 特殊方法：记录错误详情
  async logError(error, context = {}) {
    const message = error.message || 'Unknown error';
    const meta = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    };
    
    await this.error(message, meta);
  }

  // 特殊方法：记录性能指标
  async logPerformance(operation, startTime, endTime, metadata = {}) {
    const duration = endTime - startTime;
    const message = `Performance: ${operation} completed in ${duration}ms`;
    const meta = {
      operation,
      duration,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      ...metadata
    };
    
    await this.info(message, meta);
  }

  // 创建子记录器，用于特定模块
  child(moduleName) {
    const childLogger = new Logger(Object.keys(this.levels)[this.currentLevel]);
    
    // 覆盖log方法以添加模块名
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = async (level, message, meta = {}) => {
      const moduleMessage = `[${moduleName}] ${message}`;
      return originalLog(level, moduleMessage, meta);
    };
    
    return childLogger;
  }
}

// 创建全局记录器实例
const logger = new Logger(process.env.LOG_LEVEL || 'info');

module.exports = logger;