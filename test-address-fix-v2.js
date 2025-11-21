#!/usr/bin/env node

/**
 * 测试改进的地址格式修复逻辑 v2
 */

// 复制修复函数
function fixAddress(address) {
  if (!address) return address;

  let addressText = address.replace(/Get directions.*$/i, '').trim();

  let cleaned = addressText;

  // 移除门牌号后的逗号
  cleaned = cleaned.replace(/(\d+),\s+/g, '$1 ');

  // 移除 # 后的逗号
  cleaned = cleaned.replace(/#([^,]+),\s+/g, '#$1 ');

  // 在场馆名和门牌号之间添加空格
  cleaned = cleaned.replace(/([a-zA-Z])(\d+)/g, '$1 $2');

  // 确保城市名前有逗号和空格
  const cityStateMatch = cleaned.match(/^(.+?)([A-Z][a-z]+(?:\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)?),\s*([A-Z]{2})\s+(\d{5})$/);

  if (cityStateMatch) {
    let addressPart = cityStateMatch[1].trim();
    const city = cityStateMatch[2].trim();
    const state = cityStateMatch[3].trim();
    const zip = cityStateMatch[4].trim();

    return `${addressPart}, ${city}, ${state} ${zip}`;
  }

  const correctFormat = cleaned.match(/^(.+?),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5})$/);
  if (correctFormat) {
    return cleaned;
  }

  return cleaned || address;
}

// 测试用例（来自真实数据库）
const testCases = [
  {
    name: 'SAP Center - 逗号在门牌号后',
    input: 'SAP Center525, West Santa Clara StreetSan Jose, CA 95113',
    expected: 'SAP Center 525 West Santa Clara Street, San Jose, CA 95113'
  },
  {
    name: 'Santa Clara Convention Center',
    input: 'Santa Clara Convention Center5001, Great America ParkwaySanta Clara, CA 95054',
    expected: 'Santa Clara Convention Center 5001 Great America Parkway, Santa Clara, CA 95054'
  },
  {
    name: 'Wildseed - 带楼层信息',
    input: 'Wildseed855 El Camino Real#Building 4, Palo Alto, CA 94301',
    expected: 'Wildseed 855 El Camino Real #Building 4, Palo Alto, CA 94301'
  },
  {
    name: 'Love Story Yoga',
    input: 'Love Story Yoga - Valencia473, Valencia StreetSan Francisco, CA 94103',
    expected: 'Love Story Yoga - Valencia 473 Valencia Street, San Francisco, CA 94103'
  },
  {
    name: 'San Jose Woman\'s Club',
    input: 'San Jose Woman\'s Club75 South 11th, StreetSan Jose, CA 95112',
    expected: 'San Jose Woman\'s Club 75 South 11th Street, San Jose, CA 95112'
  },
  {
    name: 'Barbarossa Lounge - 带楼层号',
    input: 'Barbarossa Lounge714 Montgomery Street#2104, San Francisco, CA 94111',
    expected: 'Barbarossa Lounge 714 Montgomery Street #2104, San Francisco, CA 94111'
  },
  {
    name: 'The Great Northern - 已正确',
    input: 'The Great Northern119 Utah St., San Francisco, CA 94103',
    expected: 'The Great Northern 119 Utah St., San Francisco, CA 94103'
  },
  {
    name: 'International Art Museum',
    input: 'International Art Museum of America1025, Market StreetSan Francisco, CA 94103',
    expected: 'International Art Museum of America 1025 Market Street, San Francisco, CA 94103'
  }
];

console.log('🧪 测试改进的地址格式修复 v2\n');
console.log('='.repeat(80) + '\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = fixAddress(test.input);
  const isCorrect = result === test.expected;

  console.log(`测试 #${index + 1}: ${test.name}`);
  console.log(`  输入:  ${test.input}`);
  console.log(`  输出:  ${result}`);
  console.log(`  预期:  ${test.expected}`);

  if (isCorrect) {
    console.log(`  ✅ 通过\n`);
    passed++;
  } else {
    console.log(`  ❌ 失败\n`);
    failed++;
  }
});

console.log('='.repeat(80));
console.log(`总计: ${testCases.length} 个测试`);
console.log(`通过: ${passed} ✅`);
console.log(`失败: ${failed} ❌`);
console.log('='.repeat(80) + '\n');

if (failed === 0) {
  console.log('✅ 所有测试通过！');
  process.exit(0);
} else {
  console.log(`❌ ${failed} 个测试失败，需要改进逻辑`);
  process.exit(1);
}
