#!/usr/bin/env node

require('dotenv').config();
const Translator = require('./src/utils/translator');

async function testTranslation() {
  console.log('🧪 测试翻译功能...\n');

  // 测试用的活动标题
  const testTitles = [
    'San Francisco Jazz Festival 2025',
    'Golden Gate Park Weekend Market',
    'Tech Conference: AI and Future',
  ];

  // 创建翻译器实例（使用自动模式）
  const translator = new Translator('auto');

  console.log('📋 测试标题:');
  testTitles.forEach((title, i) => {
    console.log(`   ${i + 1}. ${title}`);
  });
  console.log('');

  // 批量翻译
  const results = await translator.translateBatch(testTitles, 3, 500);

  console.log('\n✅ 翻译结果:');
  results.forEach((result, i) => {
    console.log(`   ${i + 1}. ${testTitles[i]}`);
    console.log(`      → ${result.text}`);
    console.log(`      (使用服务: ${result.provider})\n`);
  });
}

testTranslation().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
