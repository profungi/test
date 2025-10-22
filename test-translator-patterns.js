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

// 测试用例
const testEvents = [
  {
    title: 'Ferry Plaza Farmers Market',
    description: '50+ vendors selling fresh produce, organic vegetables, local farms',
    expectedPatterns: ['农夫市集', '市集', '摊位'],
    category: '✅ Fair/Market/Festival - 农夫市集'
  },
  {
    title: 'SF Arts and Music Festival',
    description: 'Live music performances, art vendors, food trucks, family-friendly',
    expectedPatterns: ['现场音乐', '艺术', '美食', '家庭友好'],
    category: '✅ Fair/Market/Festival - 艺术音乐节'
  },
  {
    title: 'Bay Area Food Festival',
    description: 'BBQ vendors, wine tasting, craft beers, local restaurants',
    expectedPatterns: ['BBQ烧烤', '葡萄酒', '精酿啤酒', '美食'],
    category: '✅ Fair/Market/Festival - 美食节'
  },
  {
    title: 'Oakland Street Fair',
    description: 'Handmade crafts, local vendors, live music, dance performances',
    expectedPatterns: ['摊位', '手工艺品', '现场音乐', '舞蹈表演'],
    category: '✅ Fair/Market/Festival - 街头博览会'
  },
  {
    title: 'Tech Startup Networking Meetup',
    description: 'Connect with founders and investors, pitch opportunities',
    expectedPatterns: ['科技', '社交交流'],
    category: '✅ Smart Fallback - 科技活动'
  },
  {
    title: 'Yoga and Wellness Workshop',
    description: 'Morning yoga class, meditation, wellness tips',
    expectedPatterns: ['瑜伽健身', '工作坊培训'],
    category: '✅ Smart Fallback - 瑜伽课程'
  },
  {
    title: 'Local Comedy Night',
    description: 'Stand-up comedy performances by local comedians',
    expectedPatterns: ['相声喜剧'],
    category: '✅ Smart Fallback - 喜剧表演'
  },
  {
    title: 'Community Cooking Class',
    description: 'Learn Italian cooking from professional chefs',
    expectedPatterns: ['烹饪美食', '工作坊培训'],
    category: '✅ Smart Fallback - 烹饪课'
  },
  {
    title: 'Bay Area Book Club Meetup',
    description: 'Discuss contemporary fiction and new releases',
    expectedPatterns: ['读书会', '社交交流'],
    category: '✅ Smart Fallback - 读书会'
  },
  {
    title: 'Photography Exhibition and Photo Walk',
    description: 'Showcase of local photographers, nature photography exploration',
    expectedPatterns: ['摄影展', '户外活动'],
    category: '✅ Smart Fallback - 摄影活动'
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

  // 检查是否包含预期的关键词
  const matches = test.expectedPatterns.every(pattern => result.includes(pattern));

  if (matches) {
    console.log(`\n✅ 测试 ${i + 1}: 通过`);
    passed++;
  } else {
    console.log(`\n❌ 测试 ${i + 1}: 失败`);
    failed++;
  }

  console.log(`   分类: ${test.category}`);
  console.log(`   标题: ${test.title}`);
  console.log(`   预期包含: ${test.expectedPatterns.join(', ')}`);
  console.log(`   实际结果: ${result}`);
});

console.log('\n' + '='.repeat(70));
console.log(`📊 测试结果: ${passed}/${testEvents.length} 通过`);

if (failed === 0) {
  console.log('🎉 所有测试通过！新的4层架构工作正常！');
  console.log('\n✨ 架构说明：');
  console.log('  层1: 通用特征提取 (fair/market/festival + 其他类型)');
  console.log('  层2: 智能兜底 (从标题提取关键词如科技、瑜伽、喜剧等)');
  console.log('  层3: 最终兜底 (社区活动，欢迎参加)');
  console.log('  所有描述自动加入种草话术 (值得一去/不容错过/周末好去处等)');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} 个测试失败`);
  process.exit(1);
}
