#!/usr/bin/env node
/**
 * 调试Short.io API详细信息
 */

require('dotenv').config();
const axios = require('axios');

async function debugShortioAPI() {
  console.log('🔍 调试Short.io API配置\n');

  // 检查环境变量
  console.log('1. 环境变量检查:');
  console.log(`   SHORTIO_API_KEY: ${process.env.SHORTIO_API_KEY ? '已设置 (长度: ' + process.env.SHORTIO_API_KEY.length + ')' : '❌ 未设置'}`);
  console.log(`   SHORTIO_DOMAIN: ${process.env.SHORTIO_DOMAIN || 'short.io (默认)'}`);

  if (!process.env.SHORTIO_API_KEY) {
    console.error('\n❌ 请在.env文件中设置SHORTIO_API_KEY');
    process.exit(1);
  }

  // 测试API调用
  console.log('\n2. 测试API调用:');
  console.log(`   Endpoint: https://api.short.io/links`);
  console.log(`   Method: POST`);

  const domain = process.env.SHORTIO_DOMAIN || 'short.io';
  const payload = {
    originalURL: 'https://example.com',
    domain: domain,
    allowDuplicates: false
  };

  console.log(`   Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post('https://api.short.io/links', payload, {
      headers: {
        'authorization': process.env.SHORTIO_API_KEY,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      timeout: 10000
    });

    console.log('\n✅ API调用成功!');
    console.log('   响应:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('\n❌ API调用失败');

    if (error.response) {
      console.log(`   HTTP状态码: ${error.response.status}`);
      console.log(`   状态文本: ${error.response.statusText}`);
      console.log(`   响应数据:`, JSON.stringify(error.response.data, null, 2));

      // 分析错误类型
      console.log('\n3. 错误分析:');
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        console.log('   ❌ 认证失败 - API key无效或已过期');
        console.log('   解决方案:');
        console.log('   1. 访问 https://app.short.io/settings/integrations/api-key');
        console.log('   2. 检查或重新生成API key');
        console.log('   3. 更新.env文件中的SHORTIO_API_KEY');
      } else if (status === 403) {
        console.log('   ❌ 访问被禁止');
        if (data.error && data.error.includes('quota')) {
          console.log('   原因: API配额已用完');
          console.log('   解决方案:');
          console.log('   1. 访问 https://app.short.io/settings/billing 查看配额使用情况');
          console.log('   2. 等待配额重置或升级计划');
        } else if (data.error && data.error.includes('domain')) {
          console.log(`   原因: 域名 "${domain}" 未在账户中配置`);
          console.log('   解决方案:');
          console.log('   1. 访问 https://app.short.io/settings/domains 查看可用域名');
          console.log('   2. 在.env文件中设置正确的SHORTIO_DOMAIN');
        } else {
          console.log('   原因: 账户权限不足或其他限制');
          console.log('   解决方案: 联系Short.io支持或检查账户状态');
        }
      } else if (status === 400) {
        console.log('   ❌ 请求参数错误');
        console.log('   错误详情:', data.error || '未知错误');
      }

    } else if (error.request) {
      console.log('   ❌ 网络错误 - 无法连接到Short.io API');
      console.log('   错误:', error.message);
    } else {
      console.log('   ❌ 未知错误:', error.message);
    }
  }
}

debugShortioAPI().catch(error => {
  console.error('调试脚本出错:', error);
  process.exit(1);
});
