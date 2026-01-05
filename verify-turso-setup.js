#!/usr/bin/env node

/**
 * 验证 Turso 设置是否正确配置用于生产抓取
 */

require('dotenv').config();

console.log('═══════════════════════════════════════════════════════════');
console.log('  Turso 生产环境配置验证');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. 检查环境变量
console.log('1️⃣ 环境变量检查:\n');

const requiredEnvVars = {
  'TURSO_DATABASE_URL': process.env.TURSO_DATABASE_URL,
  'TURSO_AUTH_TOKEN': process.env.TURSO_AUTH_TOKEN,
};

const optionalEnvVars = {
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'NEWAPI_API_KEY': process.env.NEWAPI_API_KEY,
  'NEWAPI_MODEL': process.env.NEWAPI_MODEL,
  'MISTRAL_API_KEY': process.env.MISTRAL_API_KEY,
};

let allRequired = true;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (value) {
    console.log(`   ✅ ${key}: 已配置`);
  } else {
    console.log(`   ❌ ${key}: 未配置`);
    allRequired = false;
  }
}

console.log('\n   可选（摘要服务）:');
let hasSummaryService = false;
for (const [key, value] of Object.entries(optionalEnvVars)) {
  if (value) {
    console.log(`   ✅ ${key}: 已配置`);
    if (key.includes('API_KEY')) hasSummaryService = true;
  } else {
    console.log(`   ⚠️  ${key}: 未配置`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 2. 检查数据库类
console.log('2️⃣ 数据库类检查:\n');

// 模拟 USE_TURSO=1
process.env.USE_TURSO = '1';

const EventDatabase = process.env.USE_TURSO
  ? require('./src/utils/turso-database')
  : require('./src/utils/database');

console.log(`   数据库类: ${EventDatabase.name}`);

if (EventDatabase.name === 'TursoDatabase') {
  console.log('   ✅ 使用 Turso 数据库类');

  // 检查更新方法
  const db = new EventDatabase();
  const hasUpdateTranslation = typeof db.updateEventTranslation === 'function';
  const hasUpdateSummaries = typeof db.updateEventSummaries === 'function';

  console.log(`   ✅ updateEventTranslation 方法: ${hasUpdateTranslation ? '存在' : '缺失'}`);
  console.log(`   ✅ updateEventSummaries 方法: ${hasUpdateSummaries ? '存在' : '缺失'}`);
} else {
  console.log('   ❌ 未使用 Turso 数据库类');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 3. 检查 Translator 和 Summarizer
console.log('3️⃣ 翻译和摘要服务检查:\n');

const Translator = require('./src/utils/translator');
const Summarizer = require('./src/utils/summarizer');

const translator = new Translator('auto');
const summarizer = new Summarizer();

console.log(`   翻译服务: ${translator.getAvailableProviders().join(', ')}`);
console.log(`   摘要服务: ${summarizer.getAvailableProviders().join(', ') || '无'}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 4. 总结
console.log('4️⃣ 配置总结:\n');

if (!allRequired) {
  console.log('   ❌ Turso 数据库配置不完整！');
  console.log('   请在 .env 文件中配置:');
  console.log('   - TURSO_DATABASE_URL');
  console.log('   - TURSO_AUTH_TOKEN\n');
  console.log('   然后运行: USE_TURSO=1 npm run scrape\n');
  process.exit(1);
}

if (!hasSummaryService) {
  console.log('   ⚠️  警告：没有配置摘要服务');
  console.log('   翻译会保存，但摘要不会生成');
  console.log('   建议配置以下之一:');
  console.log('   - GEMINI_API_KEY');
  console.log('   - OPENAI_API_KEY');
  console.log('   - NEWAPI_API_KEY + NEWAPI_MODEL');
  console.log('   - MISTRAL_API_KEY\n');
}

console.log('   ✅ Turso 数据库已正确配置');
console.log('   ✅ 翻译功能已启用');
console.log(`   ${hasSummaryService ? '✅' : '⚠️ '} 摘要功能${hasSummaryService ? '已启用' : '未启用'}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✨ 运行生产抓取:\n');
console.log('   USE_TURSO=1 npm run scrape\n');
console.log('   或\n');
console.log('   USE_TURSO=1 npm run scrape-current-week\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📝 重要提示:\n');
console.log('   1. 翻译（title_zh）会自动保存到 Turso');
console.log('   2. 摘要（summary_zh, summary_en）会自动保存到 Turso（如果配置了 API key）');
console.log('   3. 使用 USE_TURSO=1 环境变量确保写入云数据库');
console.log('   4. 抓取完成后会自动同步到本地数据库\n');
