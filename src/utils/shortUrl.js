const axios = require('axios');
const config = require('../config');

class ShortUrlService {
  constructor() {
    this.apiKey = config.apis.shortio.key;
    this.baseUrl = config.apis.shortio.baseUrl;
  }

  async createShortUrl(originalUrl, customAlias = null) {
    try {
      if (!this.apiKey) {
        console.warn('Short.io API key not configured, returning original URL');
        return originalUrl;
      }

      const payload = {
        originalURL: originalUrl,
        domain: 'short.io',
        allowDuplicates: false
      };

      if (customAlias) {
        payload.path = customAlias;
      }

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.shortURL) {
        console.log(`Created short URL: ${response.data.shortURL} -> ${originalUrl}`);
        return response.data.shortURL;
      } else {
        console.warn('Short.io response missing shortURL, returning original');
        return originalUrl;
      }

    } catch (error) {
      console.error('Error creating short URL:', error.message);
      
      // 如果是重复URL错误，尝试获取已存在的短链接
      if (error.response && error.response.status === 409) {
        try {
          const existingUrl = await this.findExistingShortUrl(originalUrl);
          if (existingUrl) {
            console.log(`Found existing short URL: ${existingUrl}`);
            return existingUrl;
          }
        } catch (findError) {
          console.error('Error finding existing short URL:', findError.message);
        }
      }
      
      // 降级：返回原始URL
      return originalUrl;
    }
  }

  async findExistingShortUrl(originalUrl) {
    try {
      const response = await axios.get(`${this.baseUrl}?domain=short.io&originalURL=${encodeURIComponent(originalUrl)}`, {
        headers: {
          'Authorization': this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.links && response.data.links.length > 0) {
        return response.data.links[0].shortURL;
      }

      return null;
    } catch (error) {
      console.error('Error finding existing short URL:', error.message);
      return null;
    }
  }

  async batchCreateShortUrls(urls) {
    const results = [];
    
    for (const url of urls) {
      try {
        const shortUrl = await this.createShortUrl(url);
        results.push({ original: url, short: shortUrl });
        
        // 避免API限流
        await this.delay(500);
      } catch (error) {
        console.error(`Error creating short URL for ${url}:`, error.message);
        results.push({ original: url, short: url, error: error.message });
      }
    }
    
    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  generateEventAlias(title, date) {
    try {
      // 创建基于活动标题和日期的别名
      const cleanTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 20);
      
      const dateStr = new Date(date).toISOString().substring(0, 10).replace(/-/g, '');
      
      return `${cleanTitle}-${dateStr}`.substring(0, 50);
    } catch (error) {
      console.error('Error generating event alias:', error);
      return null;
    }
  }
}

module.exports = ShortUrlService;