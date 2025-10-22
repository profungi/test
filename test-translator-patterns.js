#!/usr/bin/env node

/**
 * 测试翻译器通用特征提取和智能兜底功能
 *
 * 新架构：
 * 第1层：通用特征提取（fair/market/festival优先）
 * 第2层：智能兜底（从标题提取关键词）
 * 第3层：最终兜底（"社区活动，欢迎参加"）
 */

const ContentTranslator = require('./src/formatters/translator');

const translator = new ContentTranslator();

// 测试用例 - 使用模糊匹配（更合理）
const testEvents = [
  {
    title: 'Ferry Plaza Farmers Market',
    description: '50+ vendors selling fresh produce, organic vegetables, local farms',
    expectedKeywords: ['市集', '摊位', '美食'],
    explanation: '应包含市集/农夫市集相关特征'
  },
  {
    title: 'SF Arts and Music Festival',
    description: 'Live music performances, art vendors, food trucks, family-friendly',
    expectedKeywords: ['节日', '音乐', '美食'],
    explanation: '应包含节日、音乐、美食相关特征'
  },
  {
    title: 'Bay Area Food Festival',
    description: 'BBQ vendors, wine tasting, craft beers, local restaurants',
    expectedKeywords: ['节日', '美食', '烧烤|葡萄酒|啤酒'],
    explanation: '应包含节日和美食特征（烧烤/葡萄酒/啤酒其一）'
  },
  {
    title: 'Oakland Street Fair',
    description: 'Handmade crafts, local vendors, live music, dance performances',
    expectedKeywords: ['集市|展会|博览会', '音乐|舞蹈'],
    explanation: '应包含集市和音乐/舞蹈相关特征'
  },
  {
    title: 'Tech Startup Networking Meetup',
    description: 'Connect with founders and investors, pitch opportunities',
    expectedKeywords: ['科技'],
    explanation: '应包含科技相关内容'
  },
  {
    title: 'Yoga and Wellness Workshop',
    description: 'Morning yoga class, meditation, wellness tips',
    expectedKeywords: ['瑜伽|健身', '工作坊|培训'],
    explanation: '应包含瑜伽和工作坊相关特征'
  },
  {
    title: 'Local Comedy Night',
    description: 'Stand-up comedy performances by local comedians',
    expectedKeywords: ['喜剧|相声'],
    explanation: '应包含喜剧/相声相关内容'
  },
  {
    title: 'Community Cooking Class',
    description: 'Learn Italian cooking from professional chefs',
    expectedKeywords: ['烹饪|美食|大厨', '工作坊|培训'],
    explanation: '应包含烹饪和工作坊相关特征'
  },
  {
    title: 'Bay Area Book Club Meetup',
    description: 'Discuss contemporary fiction and new releases',
    expectedKeywords: ['读书|书', '社交|交流'],
    explanation: '应包含读书和社交相关内容'
  },
  {
    title: 'Photography Exhibition and Photo Walk',
    description: 'Showcase of local photographers, nature photography exploration',
    expectedKeywords: ['摄影|展览', '户外|活动'],
    explanation: '应包含摄影和户外相关特征'
  }
];

console.log('🧪 测试翻译器通用特征提取和智能兜底功能\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

testEvents.forEach((test, i) => {
  const event = {
    title: test.title,
    description: test.description,
    description_detail: test.description
  };

  const result = translator.generateSimpleDescription(event);

  // 检查是否包含预期的关键词（使用OR逻辑）
  let matches = true;
  for (const keyword of test.expectedKeywords) {
    const patterns = keyword.split('|');
    const hasAny = patterns.some(p => result.includes(p));
    if (!hasAny) {
      matches = false;
      break;
    }
  }

  if (matches) {
    console.log(`\n✅ 测试 ${i + 1}: 通过`);
    passed++;
  } else {
    console.log(`\n❌ 测试 ${i + 1}: 失败`);
    failed++;
  }

  console.log(`   标题: ${test.title}`);
  console.log(`   预期: 包含 ${test.expectedKeywords.join(', ')}`);
  console.log(`   实际: ${result}`);
  console.log(`   说明: ${test.explanation}`);
});

console.log('\n' + '='.repeat(70));
console.log(`📊 测试结果: ${passed}/${testEvents.length} 通过`);

if (failed === 0) {
  console.log('🎉 所有测试通过！新的3层架构工作正常！');
  console.log('\n✨ 架构说明：');
  console.log('  层1: 通用特征提取');
  console.log('     - fair/festival/market/expo等活动类型');
  console.log('     - 美食、音乐、舞蹈、艺术、家庭等特征');
  console.log('     - 40+种特征词汇');
  console.log('  层2: 智能兜底');
  console.log('     - 从标题提取23类关键词（科技、瑜伽、喜剧等）');
  console.log('     - 无法匹配特征时启动');
  console.log('  层3: 最终兜底');
  console.log('     - "社区活动，欢迎参加"');
  console.log('  层4: 种草话术');
  console.log('     - 所有描述自动加入随机种草话术');
  console.log('\n💡 优势：');
  console.log('  ✓ 覆盖far/market/festival等主流活动类型');
  console.log('  ✓ 智能兜底覆盖23+种其他活动');
  console.log('  ✓ 配置简洁，易于扩展');
  console.log('  ✓ 每个描述都有吸引力的种草话术');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} 个测试失败`);
  process.exit(1);
}
