#!/usr/bin/env node
/**
 * 调试标签添加功能 - 测试在创建链接时直接添加tags
 */

require('dotenv').config();
const axios = require('axios');

async function debugTags() {
  console.log('🔍 调试Short.io标签添加功能\n');

  if (!process.env.SHORTIO_API_KEY) {
    console.error('❌ 请在.env文件中设置SHORTIO_API_KEY');
    process.exit(1);
  }

  if (!process.env.SHORTIO_DOMAIN) {
    console.error('❌ 请在.env文件中设置SHORTIO_DOMAIN');
    process.exit(1);
  }

  const apiKey = process.env.SHORTIO_API_KEY;
  const domain = process.env.SHORTIO_DOMAIN;

  console.log('配置信息:');
  console.log(`  API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`  Domain: ${domain}\n`);

  // 步骤1: 创建短链接（在创建时直接添加tags）
  console.log('步骤1: 创建短链接（尝试在创建时添加tags参数）');
  const testUrl = 'https://example.com/test-' + Date.now();
  const customPath = 'T' + Math.random().toString(36).substring(2, 5).toUpperCase();
  const testTags = ['test-tag', 'SF', 'free'];

  console.log(`  原始URL: ${testUrl}`);
  console.log(`  自定义路径: ${customPath}`);
  console.log(`  标签: ${testTags.join(', ')}`);

  let linkId = null;
  let shortUrl = null;
  let createResponse = null;

  try {
    createResponse = await axios.post('https://api.short.io/links', {
      originalURL: testUrl,
      domain: domain,
      path: customPath,
      tags: testTags,  // 尝试在创建时添加tags
      allowDuplicates: false
    }, {
      headers: {
        'authorization': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });

    console.log('\n✅ 短链接创建成功!');
    console.log('  响应数据:', JSON.stringify(createResponse.data, null, 2));

    shortUrl = createResponse.data.shortURL;
    linkId = createResponse.data.idString || createResponse.data.id;

    console.log(`\n  短链接: ${shortUrl}`);
    console.log(`  Link ID: ${linkId}`);
    console.log(`  ID类型: ${typeof linkId}`);

  } catch (error) {
    console.error('\n❌ 创建短链接失败');
    if (error.response) {
      console.error(`  状态码: ${error.response.status}`);
      console.error(`  响应:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`  错误: ${error.message}`);
    }
    process.exit(1);
  }

  // 步骤2: 检查返回的tags
  console.log('\n步骤2: 检查返回数据中的tags字段');
  if (createResponse.data.tags) {
    if (createResponse.data.tags.length > 0) {
      console.log(`  ✅ 标签已添加! 共${createResponse.data.tags.length}个标签`);
      console.log(`  标签内容: ${JSON.stringify(createResponse.data.tags)}`);
    } else {
      console.log(`  ⚠️ tags字段存在但为空数组`);
    }
  } else {
    console.log(`  ⚠️ 返回数据中没有tags字段`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 总结:');
  console.log(`  短链接: ${shortUrl}`);
  console.log(`  Link ID: ${linkId}`);
  console.log(`  请求的标签: ${testTags.join(', ')}`);
  console.log(`  返回的标签: ${createResponse.data.tags ? JSON.stringify(createResponse.data.tags) : '无'}`);
  console.log('\n💡 请访问 https://app.short.io/links 查看链接详情');
  console.log('='.repeat(60));
}

debugTags().catch(error => {
  console.error('脚本出错:', error);
  process.exit(1);
});
