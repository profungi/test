const axios = require('axios');
const config = require('../config');

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
    if (!originalUrl) {
      throw new Error('URL is required');
    }

    // 如果API不可用，直接返回原始URL
    if (!this.apiAvailable) {
      console.log(`使用原始URL: ${originalUrl}`);
      return originalUrl;
    }

    // 验证URL格式
    if (!this.isValidUrl(originalUrl)) {
      throw new Error(`Invalid URL format: ${originalUrl}`);
    }

    // 尝试多次生成不重复的短链接
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const customPath = this.generate4CharCode();

      const payload = {
        originalURL: originalUrl,
        domain: this.domain,
        path: customPath,
        allowDuplicates: false
      };

      // 如果提供了标题，添加到payload (可选)
      if (title) {
        payload.title = title;
      }

      // 如果提供了标签，直接在创建时添加
      if (tags && tags.length > 0) {
        payload.tags = tags;
      }

      try {
        const response = await this.axiosInstance.post('', payload);

        if (response.data && response.data.shortURL) {
          const shortUrl = response.data.shortURL;

          // 显示标签信息
          if (tags && tags.length > 0) {
            console.log(`   生成短链接: ${shortUrl} (代码: ${customPath}, 标签: ${tags.join(', ')})`);
          } else {
            console.log(`   生成短链接: ${shortUrl} (代码: ${customPath})`);
          }

          return shortUrl;
        } else {
          throw new Error('Invalid response from Short.io API');
        }

      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          if (status === 400 && data.error) {
            // 如果是路径已存在的错误，重试生成新代码
            if (data.error.includes('path') || data.error.includes('exist')) {
              console.log(`   代码 ${customPath} 已存在，重试... (${attempt + 1}/${maxRetries})`);
              continue; // 重试下一次
            }
            throw new Error(`Short.io API error: ${data.error}`);
          } else if (status === 401) {
            throw new Error('Short.io API key is invalid or expired');
          } else if (status === 403) {
            throw new Error('Short.io API quota exceeded or forbidden');
          } else if (status === 409) {
            // 路径冲突，重试生成新代码
            console.log(`   代码 ${customPath} 已存在，重试... (${attempt + 1}/${maxRetries})`);
            continue;
          } else {
            throw new Error(`Short.io API error (${status}): ${data.message || 'Unknown error'}`);
          }
        } else {
          throw new Error(`Network error: ${error.message}`);
        }
      }
    }

    // 所有重试都失败
    throw new Error(`Failed to generate unique short code after ${maxRetries} attempts`);
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

  // 根据地点获取区域标签
  getLocationTag(location) {
    if (!location) return null;

    const locationStr = location.toString().toLowerCase();

    // San Francisco
    if (locationStr.includes('san francisco') || locationStr.includes('sf')) {
      return 'SF';
    }

    // South Bay
    const southBayCities = ['san jose', 'santa clara', 'los gatos', 'campbell'];
    if (southBayCities.some(city => locationStr.includes(city))) {
      return 'South bay';
    }

    // Peninsula
    const peninsulaCities = ['palo alto', 'mountain view', 'san mateo', 'redwood city', 'san carlos'];
    if (peninsulaCities.some(city => locationStr.includes(city))) {
      return 'Peninsula';
    }

    // East Bay
    const eastBayCities = ['oakland', 'fremont', 'berkeley', 'concord'];
    if (eastBayCities.some(city => locationStr.includes(city))) {
      return 'East bay';
    }

    // North Bay
    const northBayCities = ['santa rosa', 'san rafael', 'napa', 'mill valley'];
    if (northBayCities.some(city => locationStr.includes(city))) {
      return 'North bay';
    }

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

  // 验证URL格式
  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // 延迟函数
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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