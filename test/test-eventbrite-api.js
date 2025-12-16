#!/usr/bin/env node

/**
 * Eventbrite API 探索测试
 * 用于测试 API key 的能力、速率限制和支持的功能
 */

require('dotenv').config();
const axios = require('axios');

class EventbriteAPITester {
  constructor() {
    this.apiKey = process.env.EVENTBRITE_API_KEY;
    this.baseUrl = 'https://www.eventbriteapi.com/v3';

    if (!this.apiKey) {
      console.error('❌ 错误: 未找到 EVENTBRITE_API_KEY 环境变量');
      console.error('   请在 .env 文件中添加: EVENTBRITE_API_KEY=your_key_here\n');
      process.exit(1);
    }

    // 配置 axios 默认 header
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'BayAreaEvents/1.0'
      },
      timeout: 10000
    });
  }

  /**
   * 显示速率限制信息
   */
  showRateLimitInfo(headers) {
    console.log('\n📊 速率限制信息:');
    const rateLimitHeaders = {
      'x-ratelimit-limit': '每小时请求限制',
      'x-ratelimit-remaining': '剩余请求次数',
      'x-ratelimit-reset': '重置时间（Unix时间戳）'
    };

    for (const [header, description] of Object.entries(rateLimitHeaders)) {
      const value = headers[header];
      if (value) {
        if (header === 'x-ratelimit-reset') {
          const resetTime = new Date(parseInt(value) * 1000);
          console.log(`   ${description}: ${resetTime.toLocaleString('zh-CN')}`);
        } else {
          console.log(`   ${description}: ${value}`);
        }
      }
    }
  }

  /**
   * 测试 1: 基本连接测试
   */
  async testBasicConnection() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 1: 基本连接测试');
    console.log('='.repeat(70));

    try {
      // 获取当前用户信息
      const response = await this.client.get('/users/me/');

      console.log('✅ API 连接成功！');
      console.log('\n👤 账户信息:');
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Name: ${response.data.name || 'N/A'}`);
      console.log(`   Email: ${response.data.emails?.[0]?.email || 'N/A'}`);

      this.showRateLimitInfo(response.headers);

      return true;
    } catch (error) {
      console.error('❌ 连接失败:', error.response?.data?.error_description || error.message);
      if (error.response?.status === 401) {
        console.error('   提示: API key 可能无效或已过期');
      }
      return false;
    }
  }

  /**
   * 测试 2: 基本活动搜索
   */
  async testBasicSearch() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 2: 基本活动搜索（无过滤条件）');
    console.log('='.repeat(70));

    try {
      const response = await this.client.get('/events/search/', {
        params: {
          'page_size': 5  // 只获取 5 个结果用于测试
        }
      });

      console.log(`✅ 找到 ${response.data.pagination.object_count} 个活动（总数）`);
      console.log(`   本页返回: ${response.data.events.length} 个`);

      this.showRateLimitInfo(response.headers);

      if (response.data.events.length > 0) {
        console.log('\n📋 第一个活动示例:');
        const event = response.data.events[0];
        console.log(`   ID: ${event.id}`);
        console.log(`   名称: ${event.name.text}`);
        console.log(`   开始时间: ${event.start?.local || 'N/A'}`);
        console.log(`   URL: ${event.url}`);
      }

      return response.data;
    } catch (error) {
      console.error('❌ 搜索失败:', error.response?.data?.error_description || error.message);
      return null;
    }
  }

  /**
   * 测试 3: 地理位置过滤
   */
  async testLocationFilter() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 3: 地理位置过滤（San Francisco Bay Area）');
    console.log('='.repeat(70));

    const locationTests = [
      {
        name: 'location.address',
        params: { 'location.address': 'San Francisco, CA', 'page_size': 3 }
      },
      {
        name: 'location.within + location.latitude/longitude',
        params: {
          'location.latitude': '37.7749',  // SF coordinates
          'location.longitude': '-122.4194',
          'location.within': '50mi',  // 50 miles radius
          'page_size': 3
        }
      }
    ];

    for (const test of locationTests) {
      console.log(`\n🌍 测试参数: ${test.name}`);
      console.log(`   参数: ${JSON.stringify(test.params, null, 2)}`);

      try {
        const response = await this.client.get('/events/search/', {
          params: test.params
        });

        console.log(`✅ 成功！找到 ${response.data.pagination.object_count} 个活动`);

        if (response.data.events.length > 0) {
          const event = response.data.events[0];
          console.log(`   示例: ${event.name.text}`);
          if (event.venue) {
            console.log(`   地点: ${event.venue.address?.city || 'N/A'}, ${event.venue.address?.region || 'N/A'}`);
          }
        }

        this.showRateLimitInfo(response.headers);
      } catch (error) {
        console.error(`❌ 失败: ${error.response?.data?.error_description || error.message}`);
        if (error.response?.data?.error === 'ARGUMENTS_ERROR') {
          console.log('   提示: 此参数可能不被支持');
        }
      }

      // 避免触发速率限制
      await this.sleep(1000);
    }
  }

  /**
   * 测试 4: 日期范围过滤
   */
  async testDateFilter() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 4: 日期范围过滤（下周）');
    console.log('='.repeat(70));

    // 计算下周的日期范围
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    const startDate = nextMonday.toISOString();
    const endDate = nextSunday.toISOString();

    console.log(`📅 搜索范围: ${nextMonday.toLocaleDateString('zh-CN')} 到 ${nextSunday.toLocaleDateString('zh-CN')}`);

    try {
      const response = await this.client.get('/events/search/', {
        params: {
          'start_date.range_start': startDate,
          'start_date.range_end': endDate,
          'location.address': 'San Francisco, CA',
          'page_size': 5
        }
      });

      console.log(`✅ 找到 ${response.data.pagination.object_count} 个下周的活动`);

      if (response.data.events.length > 0) {
        console.log('\n📋 前几个活动:');
        response.data.events.slice(0, 3).forEach((event, idx) => {
          console.log(`   ${idx + 1}. ${event.name.text}`);
          console.log(`      时间: ${event.start?.local || 'N/A'}`);
        });
      }

      this.showRateLimitInfo(response.headers);
    } catch (error) {
      console.error('❌ 失败:', error.response?.data?.error_description || error.message);
    }
  }

  /**
   * 测试 5: 类别过滤
   */
  async testCategoryFilter() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 5: 类别过滤');
    console.log('='.repeat(70));

    // 常见的 Eventbrite 类别 ID
    const categories = [
      { id: '110', name: 'Food & Drink' },
      { id: '115', name: 'Festivals & Fairs' },
      { id: '103', name: 'Music' },
      { id: '105', name: 'Performing & Visual Arts' }
    ];

    console.log('🎯 测试类别 ID 过滤...\n');

    for (const category of categories) {
      try {
        const response = await this.client.get('/events/search/', {
          params: {
            'categories': category.id,
            'location.address': 'San Francisco, CA',
            'page_size': 2
          }
        });

        console.log(`✅ ${category.name} (ID: ${category.id}): ${response.data.pagination.object_count} 个活动`);
      } catch (error) {
        console.error(`❌ ${category.name}: ${error.response?.data?.error_description || error.message}`);
      }

      await this.sleep(800);
    }
  }

  /**
   * 测试 6: 数据结构探索
   */
  async testDataStructure() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 6: 完整数据结构探索');
    console.log('='.repeat(70));

    try {
      const response = await this.client.get('/events/search/', {
        params: {
          'location.address': 'San Francisco, CA',
          'expand': 'venue,category,subcategory,format,ticket_availability',  // 获取完整信息
          'page_size': 1
        }
      });

      if (response.data.events.length > 0) {
        const event = response.data.events[0];

        console.log('📦 可用的数据字段:\n');
        console.log(JSON.stringify(event, null, 2));
      }
    } catch (error) {
      console.error('❌ 失败:', error.response?.data?.error_description || error.message);
    }
  }

  /**
   * 测试 7: 速率限制测试
   */
  async testRateLimit() {
    console.log('\n' + '='.repeat(70));
    console.log('测试 7: 速率限制测试（连续请求）');
    console.log('='.repeat(70));

    console.log('📊 发送 5 个连续请求，观察速率限制...\n');

    for (let i = 1; i <= 5; i++) {
      try {
        const startTime = Date.now();
        const response = await this.client.get('/events/search/', {
          params: { 'page_size': 1 }
        });
        const duration = Date.now() - startTime;

        console.log(`请求 ${i}:`);
        console.log(`   响应时间: ${duration}ms`);
        console.log(`   剩余请求数: ${response.headers['x-ratelimit-remaining'] || 'N/A'}`);
        console.log(`   请求限制: ${response.headers['x-ratelimit-limit'] || 'N/A'}\n`);
      } catch (error) {
        if (error.response?.status === 429) {
          console.error(`❌ 请求 ${i}: 触发速率限制！`);
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            console.log(`   需要等待: ${retryAfter} 秒`);
          }
          break;
        } else {
          console.error(`❌ 请求 ${i}: ${error.message}`);
        }
      }

      // 短暂延迟
      if (i < 5) await this.sleep(500);
    }
  }

  /**
   * 辅助函数：延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('\n🚀 Eventbrite API 探索测试');
    console.log('='.repeat(70));
    console.log(`API Key: ${this.apiKey.substring(0, 10)}...${this.apiKey.slice(-4)}`);
    console.log(`Base URL: ${this.baseUrl}`);

    // 1. 基本连接
    const connected = await this.testBasicConnection();
    if (!connected) {
      console.log('\n❌ 基本连接失败，停止测试');
      return;
    }

    await this.sleep(1000);

    // 2. 基本搜索
    await this.testBasicSearch();
    await this.sleep(1000);

    // 3. 地理位置过滤
    await this.testLocationFilter();
    await this.sleep(1000);

    // 4. 日期过滤
    await this.testDateFilter();
    await this.sleep(1000);

    // 5. 类别过滤
    await this.testCategoryFilter();
    await this.sleep(1000);

    // 6. 数据结构
    await this.testDataStructure();
    await this.sleep(1000);

    // 7. 速率限制
    await this.testRateLimit();

    console.log('\n' + '='.repeat(70));
    console.log('✅ 所有测试完成！');
    console.log('='.repeat(70));
    console.log('\n💡 下一步:');
    console.log('   1. 检查上面的输出，确认哪些功能可用');
    console.log('   2. 记录速率限制信息');
    console.log('   3. 决定如何整合到现有的 eventbrite-scraper.js\n');
  }
}

// 运行测试
if (require.main === module) {
  const tester = new EventbriteAPITester();
  tester.runAllTests().catch(error => {
    console.error('\n💥 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = EventbriteAPITester;
