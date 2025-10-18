#!/usr/bin/env node

/**
 * 测试翻译器模式匹配功能
 */

const ContentTranslator = require('./src/formatters/translator');

const translator = new ContentTranslator();

// 测试用例
const testEvents = [
  {
    title: 'Halloween Costume Party',
    description: 'Costume contest, pumpkin carving, trick-or-treating, scary movies',
    expected: /服装比赛.*南瓜雕刻.*不给糖就捣蛋.*万圣节/
  },
  {
    title: 'Oakland Diwali Festival',
    description: 'Indian dance performances and food vendors',
    expected: '印度舞蹈和音乐表演，南亚美食摊位，Diwali点灯仪式'
  },
  {
    title: 'Jazz Night - Miles Davis Tribute',
    description: 'Live jazz performance at the Blue Note',
    expected: /Miles Davis.*爵士/
  },
  {
    title: 'Pet Adoption Fair',
    description: 'Dogs and cats available for adoption',
    expected: /宠物/
  },
  {
    title: 'Ferry Plaza Farmers Market',
    description: '50+ vendors selling fresh produce',
    expected: /50多个.*摊位/
  },
  {
    title: 'Wedding Expo San Francisco',
    description: 'Meet wedding vendors',
    expected: /婚纱.*策划/
  }
];

console.log('🧪 测试翻译器模式匹配功能\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testEvents.forEach((test, i) => {
  const event = {
    title: test.title,
    description: test.description,
    description_detail: test.description
  };

  const result = translator.generateSimpleDescription(event);

  let matches = false;
  if (test.expected instanceof RegExp) {
    matches = test.expected.test(result);
  } else {
    matches = result === test.expected;
  }

  if (matches) {
    console.log(`\n✅ 测试 ${i + 1}: 通过`);
    passed++;
  } else {
    console.log(`\n❌ 测试 ${i + 1}: 失败`);
    failed++;
  }

  console.log(`   输入: ${test.title}`);
  console.log(`   预期: ${test.expected}`);
  console.log(`   实际: ${result}`);
});

console.log('\n' + '='.repeat(60));
console.log(`📊 测试结果: ${passed}/${testEvents.length} 通过`);

if (failed === 0) {
  console.log('🎉 所有测试通过！');
  process.exit(0);
} else {
  console.log(`⚠️  ${failed} 个测试失败`);
  process.exit(1);
}
