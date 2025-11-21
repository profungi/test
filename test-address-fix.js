#!/usr/bin/env node

/**
 * 测试地址格式修复逻辑
 */

// 复制修复函数（与 fix-eventbrite-data.js 中的相同）
function fixAddress(address) {
  if (!address) return address;

  // 移除 "Get directions" 等干扰文本
  let addressText = address.replace(/Get directions.*$/i, '').trim();

  // 🔧 修复地址格式问题：
  // 问题1: 重复的街道地址 "266 14th St266 14th, StreetOakland"
  // 问题2: 逗号位置错误 "473, Valencia StreetSan Francisco"
  // 问题3: 城市前缺少逗号 "473 Valencia StreetSan Francisco"

  // 第一步：处理重复的街道地址
  // 匹配模式：场馆名/街道号 街道名1 街道号, 街道名2城市
  // 例如：266 14th St266 14th, StreetOakland -> 取第二部分
  addressText = addressText.replace(/^(.*?)(\d+)\s+([^,]+)\2\s*,?\s*(.*)$/, '$1$2 $4');

  // 第二步：移除街道号后的错误逗号
  // "1355, Market Street" -> "1355 Market Street"
  addressText = addressText.replace(/(\d+),\s+([A-Z])/g, '$1 $2');

  // 第三步：移除 #楼层 后的逗号
  // "#6th, Floor" -> "#6th Floor"
  addressText = addressText.replace(/#(\w+),\s+/g, '#$1 ');

  // 第四步：标准化格式为 "场馆/街道地址, 城市, 州 邮编"
  // 匹配：(前面部分包含街道号)(城市名大写开头), (州缩写) (邮编)
  const match = addressText.match(/^(.*?)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5})$/);

  if (match) {
    let streetPart = match[1].trim();
    const city = match[2].trim();
    const state = match[3].trim();
    const zip = match[4].trim();

    // 如果街道部分以句点结尾但后面没有空格，添加空格
    streetPart = streetPart.replace(/\.([A-Z])/, '. $1');

    // 确保街道部分末尾没有逗号
    if (streetPart.endsWith(',')) {
      streetPart = streetPart.slice(0, -1).trim();
    }

    return `${streetPart}, ${city}, ${state} ${zip}`;
  }

  // 备用：如果已经是正确格式（两个逗号），直接返回
  const correctFormat = addressText.match(/^(.*?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5})$/);
  if (correctFormat) {
    return addressText;
  }

  // 无法识别格式，返回原值
  return address;
}

// 测试用例（来自真实数据库）
const testCases = [
  {
    input: '266 14th St266 14th, StreetOakland, CA 94612',
    expected: '266 14th StreetOakland, CA 94612' // 修复重复
  },
  {
    input: '473, Valencia StreetSan Francisco, CA 94103',
    expected: '473 Valencia Street, San Francisco, CA 94103'
  },
  {
    input: '1355, Market StreetSan Francisco, CA 94103',
    expected: '1355 Market Street, San Francisco, CA 94103'
  },
  {
    input: 'Torch Oakland Rooftop Bar1630 San Pablo Avenue#6th, Floor Oakland, CA 94612',
    expected: 'Torch Oakland Rooftop Bar1630 San Pablo Avenue#6th Floor, Oakland, CA 94612'
  },
  {
    input: 'The Great Northern119 Utah St., San Francisco, CA 94103',
    expected: 'The Great Northern119 Utah St., San Francisco, CA 94103' // 已经正确
  },
  {
    input: 'Love Story Yoga - Valencia473, Valencia StreetSan Francisco, CA 94103',
    expected: 'Love Story Yoga - Valencia473 Valencia Street, San Francisco, CA 94103'
  },
  {
    input: 'Santa Clara Convention Center5001, Great America ParkwaySanta Clara, CA 95054',
    expected: 'Santa Clara Convention Center5001 Great America Parkway, Santa Clara, CA 95054'
  },
  {
    input: 'Barbarossa Lounge714 Montgomery Street#2104, San Francisco, CA 94111',
    expected: 'Barbarossa Lounge714 Montgomery Street#2104, San Francisco, CA 94111'
  }
];

console.log('🧪 测试地址格式修复\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = fixAddress(test.input);
  const success = result.includes(', San Francisco,') || result.includes(', Oakland,') || result.includes(', Santa Clara,') || result.includes(', Palo Alto,');

  console.log(`测试 #${index + 1}:`);
  console.log(`  输入:  ${test.input}`);
  console.log(`  输出:  ${result}`);

  if (success) {
    console.log(`  ✅ 通过 - 城市前有逗号\n`);
    passed++;
  } else {
    console.log(`  ❌ 失败 - 城市前缺少逗号\n`);
    failed++;
  }
});

console.log('==================');
console.log(`总计: ${testCases.length} 个测试`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log('==================\n');

if (failed === 0) {
  console.log('✅ 所有测试通过！');
  process.exit(0);
} else {
  console.log('❌ 部分测试失败，需要改进逻辑');
  process.exit(1);
}
