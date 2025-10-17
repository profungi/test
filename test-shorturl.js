#!/usr/bin/env node
/**
 * 测试Short.io API连接和短链接生成
 */

const URLShortener = require('./src/utils/url-shortener');

async function testShortUrl() {
  console.log('🔗 测试Short.io API连接和4位代码生成...\n');

  const shortener = new URLShortener();

  // 测试1: 4位代码生成器
  console.log('测试1: 4位代码生成器');
  console.log('生成10个随机4位代码示例:');
  for (let i = 0; i < 10; i++) {
    const code = shortener.generate4CharCode();
    console.log(`   ${i + 1}. ${code}`);
  }

  // 测试2: 生成实际短链接（不带标签）
  console.log('\n测试2: 生成实际短链接（使用4位代码，无标签）');
  try {
    const testUrl = 'https://www.eventbrite.com/e/test-event-' + Date.now();
    console.log(`   原始URL: ${testUrl}`);
    const shortUrl = await shortener.shortenUrl(testUrl);
    console.log(`✅ 短链接生成成功: ${shortUrl}`);
  } catch (error) {
    console.error(`❌ 短链接生成失败: ${error.message}`);
  }

  // 测试2.5: 生成带标签的短链接
  console.log('\n测试2.5: 生成带标签的短链接');
  try {
    const testUrl = 'https://www.eventbrite.com/e/tagged-event-' + Date.now();
    const tags = ['test', 'bayarea', 'event'];
    console.log(`   原始URL: ${testUrl}`);
    console.log(`   标签: ${tags.join(', ')}`);
    const shortUrl = await shortener.shortenUrl(testUrl, 'Tagged Test Event', tags);
    console.log(`✅ 带标签的短链接生成成功: ${shortUrl}`);
  } catch (error) {
    console.error(`❌ 带标签的短链接生成失败: ${error.message}`);
  }

  // 测试3: 生成多个短链接
  console.log('\n测试3: 批量生成3个短链接');
  const testUrls = [
    'https://www.eventbrite.com/e/event-1-' + Date.now(),
    'https://www.eventbrite.com/e/event-2-' + Date.now(),
    'https://www.eventbrite.com/e/event-3-' + Date.now()
  ];

  for (let i = 0; i < testUrls.length; i++) {
    try {
      const shortUrl = await shortener.shortenUrl(testUrls[i]);
      console.log(`${i + 1}. ✅ ${shortUrl}`);
      await shortener.delay(500); // 避免API限制
    } catch (error) {
      console.error(`${i + 1}. ❌ ${error.message}`);
    }
  }

  console.log('\n✨ 测试完成！');
  console.log('\n📊 统计信息:');
  console.log(`   字符集: 0-9, A-Z, a-z (共62个字符)`);
  console.log(`   代码长度: 4位`);
  console.log(`   可能的组合数: 62^4 = 14,776,336`);
  console.log(`   冲突处理: 自动重试最多5次`);
}

testShortUrl().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
