#!/usr/bin/env node
/**
 * 获取Short.io账户中配置的域名列表
 */

require('dotenv').config();
const axios = require('axios');

async function getDomains() {
  console.log('🔍 获取Short.io账户中的域名列表...\n');

  if (!process.env.SHORTIO_API_KEY) {
    console.error('❌ 请在.env文件中设置SHORTIO_API_KEY');
    process.exit(1);
  }

  try {
    const response = await axios.get('https://api.short.io/api/domains', {
      headers: {
        'authorization': process.env.SHORTIO_API_KEY,
        'accept': 'application/json'
      }
    });

    console.log('✅ 成功获取域名列表!\n');

    if (response.data && response.data.length > 0) {
      console.log(`找到 ${response.data.length} 个域名:\n`);

      response.data.forEach((domain, index) => {
        console.log(`${index + 1}. ${domain.hostname || domain.hostName || domain.domain}`);
        if (domain.id) console.log(`   ID: ${domain.id}`);
        if (domain.plan) console.log(`   计划: ${domain.plan}`);
        if (domain.active !== undefined) console.log(`   状态: ${domain.active ? '激活' : '未激活'}`);
        console.log('');
      });

      const firstDomain = response.data[0].hostname || response.data[0].hostName || response.data[0].domain;
      console.log('💡 使用建议:');
      console.log(`   在.env文件中设置: SHORTIO_DOMAIN=${firstDomain}`);

    } else {
      console.log('❌ 你的账户中没有配置任何域名');
      console.log('\n解决方案:');
      console.log('1. 访问 https://app.short.io/settings/domains');
      console.log('2. 添加一个新域名（可以是免费的short.io子域名，如 yourname.short.io）');
      console.log('3. 然后重新运行此脚本');
    }

    console.log('\n完整响应数据:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ 获取域名列表失败\n');

    if (error.response) {
      console.log(`HTTP状态码: ${error.response.status}`);
      console.log(`状态文本: ${error.response.statusText}`);
      console.log(`响应数据:`, JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.log('\n原因: API key无效或已过期');
        console.log('解决方案: 访问 https://app.short.io/settings/integrations/api-key 重新生成');
      }
    } else {
      console.log('错误:', error.message);
    }
  }
}

getDomains().catch(error => {
  console.error('脚本出错:', error);
  process.exit(1);
});
