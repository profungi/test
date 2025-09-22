const axios = require('axios');
const config = require('../config');

class URLShortener {
  constructor() {
    if (!config.apis.shortio.key) {
      throw new Error('Short.io API key is required');
    }
    
    this.apiKey = config.apis.shortio.key;
    this.baseUrl = config.apis.shortio.baseUrl;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
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
        
        const shortUrl = await this.shortenUrl(event.original_url, event.title);
        
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
  async shortenUrl(originalUrl, title = '') {
    if (!originalUrl) {
      throw new Error('URL is required');
    }

    // 验证URL格式
    if (!this.isValidUrl(originalUrl)) {
      throw new Error(`Invalid URL format: ${originalUrl}`);
    }

    const payload = {
      originalURL: originalUrl,
      domain: 'short.io', // 使用默认域名，也可以配置自定义域名
      allowDuplicates: false // 相同URL返回已存在的短链接
    };

    // 如果有标题，添加为自定义后缀 (可选)
    if (title) {
      const slug = this.generateSlug(title);
      if (slug) {
        payload.path = slug;
      }
    }

    try {
      const response = await this.axiosInstance.post('', payload);
      
      if (response.data && response.data.shortURL) {
        return response.data.shortURL;
      } else {
        throw new Error('Invalid response from Short.io API');
      }
      
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400 && data.error) {
          throw new Error(`Short.io API error: ${data.error}`);
        } else if (status === 401) {
          throw new Error('Short.io API key is invalid or expired');
        } else if (status === 403) {
          throw new Error('Short.io API quota exceeded or forbidden');
        } else if (status === 409 && data.shortURL) {
          // URL已存在，返回现有的短链接
          return data.shortURL;
        } else {
          throw new Error(`Short.io API error (${status}): ${data.message || 'Unknown error'}`);
        }
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  // 从事件标题生成URL友好的slug
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