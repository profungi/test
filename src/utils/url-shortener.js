const axios = require('axios');
const config = require('../config');
const CommonHelpers = require('./common-helpers');

// 可重试错误类
class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RetryableError';
    this.retryable = true;
  }
}

class URLShortener {
  constructor() {
    if (!config.apis.shortio.key) {
      console.warn('⚠️ Short.io API key not configured, will use original URLs');
      this.apiAvailable = false;
    } else {
      this.apiAvailable = true;
      this.apiKey = config.apis.shortio.key;
      this.baseUrl = config.apis.shortio.baseUrl;
      this.domain = config.apis.shortio.domain || 'short.io';

      this.axiosInstance = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'authorization': this.apiKey,
          'accept': 'application/json',
          'content-type': 'application/json'
        },
        timeout: 10000
      });
    }
  }

  // 为选中的事件生成短链接
  async generateShortUrls(selectedEvents) {
    console.log(`🔗 为 ${selectedEvents.length} 个选中活动生成短链接...`);

    const eventsWithShortUrls = [];
    const failedUrls = [];

    for (let i = 0; i < selectedEvents.length; i++) {
      const event = selectedEvents[i];

      try {
        console.log(`处理 ${i + 1}/${selectedEvents.length}: ${event.title}`);

        // 根据活动信息生成标签
        const tags = this.generateTagsForEvent(event);

        const shortUrl = await this.shortenUrl(event.original_url, event.title, tags);

        eventsWithShortUrls.push({
          ...event,
          short_url: shortUrl,
          url_shortened_at: new Date().toISOString()
        });

        // 添加延迟避免API限制
        if (i < selectedEvents.length - 1) {
          await this.delay(500);
        }

      } catch (error) {
        console.warn(`为活动 "${event.title}" 生成短链接失败: ${error.message}`);

        failedUrls.push({
          event: event.title,
          originalUrl: event.original_url,
          error: error.message
        });

        // 失败时使用原链接
        eventsWithShortUrls.push({
          ...event,
          short_url: event.original_url,
          url_shortening_failed: true,
          url_shortening_error: error.message
        });
      }
    }

    console.log(`✅ 短链接生成完成: ${eventsWithShortUrls.length - failedUrls.length} 成功, ${failedUrls.length} 失败`);

    if (failedUrls.length > 0) {
      console.log(`❌ 失败的链接:`);
      failedUrls.forEach(failed => {
        console.log(`   - ${failed.event}: ${failed.error}`);
      });
    }

    return {
      events: eventsWithShortUrls,
      summary: {
        total: selectedEvents.length,
        successful: eventsWithShortUrls.length - failedUrls.length,
        failed: failedUrls.length,
        failedUrls: failedUrls
      }
    };
  }

  // 使用 Short.io API 缩短单个URL
  async shortenUrl(originalUrl, title = '', tags = [], maxRetries = 5) {
    // 前置检查
    if (!originalUrl) throw new Error('URL is required');
    if (!this.apiAvailable) {
      console.log(`使用原始URL: ${originalUrl}`);
      return originalUrl;
    }
    if (!this.isValidUrl(originalUrl)) {
      throw new Error(`Invalid URL format: ${originalUrl}`);
    }

    // 重试循环
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.tryCreateShortLink(originalUrl, title, tags);
        return result.shortURL;

      } catch (error) {
        if (this.isRetryableError(error)) {
          console.log(`   重试 ${attempt + 1}/${maxRetries}: ${error.message}`);

          if (attempt === maxRetries - 1) {
            throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
          }

          continue;
        } else {
          throw error;
        }
      }
    }
  }

  // 尝试创建短链接
  async tryCreateShortLink(originalUrl, title, tags) {
    const customPath = this.generate4CharCode();
    const payload = {
      originalURL: originalUrl,
      domain: this.domain,
      path: customPath,
      allowDuplicates: false
    };

    if (title) payload.title = title;
    if (tags && tags.length > 0) payload.tags = tags;

    try {
      const response = await this.axiosInstance.post('', payload);
      if (!response.data || !response.data.shortURL) {
        throw new Error('Invalid API response');
      }

      const tagInfo = tags && tags.length > 0 ? `, 标签: ${tags.join(', ')}` : '';
      console.log(`   生成短链接: ${response.data.shortURL} (代码: ${customPath}${tagInfo})`);

      return response.data;

    } catch (error) {
      throw this.normalizeApiError(error, customPath);
    }
  }

  // 错误标准化
  normalizeApiError(error, customPath) {
    if (!error.response) {
      return new RetryableError(`Network error: ${error.message}`);
    }

    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        if (data.error && (data.error.includes('path') || data.error.includes('exist'))) {
          return new RetryableError(`Path ${customPath} already exists`);
        }
        return new Error(`Bad request: ${data.error}`);
      case 401:
        return new Error('API key is invalid or expired');
      case 403:
        return new Error('API quota exceeded or forbidden');
      case 409:
        return new RetryableError(`Path ${customPath} conflict`);
      default:
        return new Error(`API error (${status}): ${data.message || 'Unknown error'}`);
    }
  }

  // 判断是否可重试
  isRetryableError(error) {
    return error instanceof RetryableError;
  }

  // 根据活动信息生成标签
  generateTagsForEvent(event) {
    const tags = [];

    // 1. 检查是否免费
    if (this.isFreeEvent(event)) {
      tags.push('free');
    }

    // 2. 根据地点添加区域标签
    const locationTag = this.getLocationTag(event.location);
    if (locationTag) {
      tags.push(locationTag);
    }

    return tags;
  }

  // 判断是否为免费活动
  isFreeEvent(event) {
    if (!event.price) return false;

    const priceStr = event.price.toString().toLowerCase();

    // 检查常见的免费标识
    return priceStr.includes('free') ||
           priceStr.includes('免费') ||
           priceStr === '0' ||
           priceStr === '$0' ||
           priceStr === '$0.00';
  }

  // 根据地点获取区域标签 (使用共享helpers)
  getLocationTag(location) {
    const tag = CommonHelpers.getLocationTag(location);
    // 格式化标签以匹配现有格式
    if (tag === 'sf') return 'SF';
    if (tag === 'southbay') return 'South bay';
    if (tag === 'peninsula') return 'Peninsula';
    if (tag === 'eastbay') return 'East bay';
    if (tag === 'northbay') return 'North bay';
    return null;
  }


  // 生成4位字母数字混合代码（包含大小写字母和数字）
  generate4CharCode() {
    // 字符集：数字0-9 + 大写字母A-Z + 小写字母a-z = 62个字符
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let code = '';

    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }

    return code;
  }

  // 从事件标题生成URL友好的slug (已弃用，现在使用4位代码)
  generateSlug(title) {
    if (!title || title.length < 3) return null;

    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并
      .replace(/^-|-$/g, '') // 移除开头和结尾的连字符
      .substring(0, 30); // 限制长度
  }

  // 验证URL格式 (使用共享helpers)
  isValidUrl(url) {
    return CommonHelpers.isValidUrl(url);
  }

  // 延迟函数 (使用共享helpers)
  async delay(ms) {
    return CommonHelpers.delay(ms);
  }

  // 测试API连接
  async testConnection() {
    try {
      const testUrl = 'https://example.com';
      const shortUrl = await this.shortenUrl(testUrl);
      console.log(`✅ Short.io API连接测试成功: ${shortUrl}`);
      return true;
    } catch (error) {
      console.error(`❌ Short.io API连接测试失败: ${error.message}`);

      // 提供更详细的错误信息
      if (error.response) {
        console.error(`   HTTP状态码: ${error.response.status}`);
        console.error(`   响应数据:`, JSON.stringify(error.response.data, null, 2));
      }

      return false;
    }
  }

  // 获取短链接统计信息 (如果需要)
  async getLinkStats(shortUrl) {
    try {
      // 从短链接提取链接ID
      const linkId = this.extractLinkId(shortUrl);
      if (!linkId) {
        throw new Error('Cannot extract link ID from short URL');
      }

      const response = await this.axiosInstance.get(`/${linkId}/statistics`);
      return response.data;
      
    } catch (error) {
      console.warn(`无法获取短链接统计: ${error.message}`);
      return null;
    }
  }

  extractLinkId(shortUrl) {
    try {
      const url = new URL(shortUrl);
      return url.pathname.substring(1); // 移除开头的 '/'
    } catch {
      return null;
    }
  }

  // 批量处理URLs的优化方法
  async generateShortUrlsBatch(urls, batchSize = 3) {
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item, index) => {
        try {
          await this.delay(index * 200); // 错开请求时间
          const shortUrl = await this.shortenUrl(item.url, item.title);
          return { ...item, shortUrl, success: true };
        } catch (error) {
          return { ...item, shortUrl: item.url, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 批次间延迟
      if (i + batchSize < urls.length) {
        await this.delay(1000);
      }
    }
    
    return results;
  }
}

module.exports = URLShortener;