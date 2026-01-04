#!/usr/bin/env node

/**
 * 测试 API Keys 配置和服务可用性
 */

require('dotenv').config();

const Translator = require('./src/utils/translator');
const Summarizer = require('./src/utils/summarizer');

console.log('═══════════════════════════════════════════════════════════');
console.log('  API Keys 配置检查');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('环境变量:');
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`  NEWAPI_API_KEY: ${process.env.NEWAPI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`  NEWAPI_MODEL: ${process.env.NEWAPI_MODEL || '❌ 未配置'}`);
console.log(`  MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`  GOOGLE_TRANSLATE_API_KEY: ${process.env.GOOGLE_TRANSLATE_API_KEY ? '✅ 已配置' : '❌ 未配置'}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('翻译器初始化:');
const translator = new Translator('auto');
console.log(`\n可用的翻译服务: ${translator.getAvailableProviders().join(', ')}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('摘要生成器初始化:');
const summarizer = new Summarizer();
const summaryProviders = summarizer.getAvailableProviders();
console.log(`\n可用的摘要服务: ${summaryProviders.length > 0 ? summaryProviders.join(', ') : '无'}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (summaryProviders.length === 0) {
  console.log('⚠️  没有可用的摘要服务！');
  console.log('\n要启用摘要服务，请配置以下环境变量之一：');
  console.log('  1. NEWAPI_API_KEY + NEWAPI_MODEL');
  console.log('  2. GEMINI_API_KEY');
  console.log('  3. MISTRAL_API_KEY\n');
  console.log('示例 .env 文件配置：');
  console.log('  GEMINI_API_KEY=your_key_here\n');
} else {
  console.log('✅ 摘要服务已配置！\n');
}
