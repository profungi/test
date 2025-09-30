#!/usr/bin/env node

/**
 * 依赖测试脚本
 * 验证所有必需的依赖包是否正确安装
 */

console.log('🔍 检查依赖包...\n');

const dependencies = [
  { name: 'openai', package: 'openai' },
  { name: 'Google Generative AI', package: '@google/generative-ai' },
  { name: 'Anthropic SDK', package: '@anthropic-ai/sdk' },
  { name: 'axios', package: 'axios' },
  { name: 'cheerio', package: 'cheerio' },
  { name: 'date-fns', package: 'date-fns' },
  { name: 'dotenv', package: 'dotenv' },
  { name: 'sqlite3', package: 'sqlite3' }
];

let allPassed = true;

for (const dep of dependencies) {
  try {
    require(dep.package);
    console.log(`✅ ${dep.name} (${dep.package})`);
  } catch (error) {
    console.log(`❌ ${dep.name} (${dep.package})`);
    console.log(`   错误: ${error.message}`);
    allPassed = false;
  }
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ 所有依赖包检查通过！');
  console.log('\n你可以运行以下命令:');
  console.log('  npm run scrape          - 抓取活动');
  console.log('  npm run validate        - 验证环境配置');
} else {
  console.log('❌ 部分依赖包未找到！');
  console.log('\n请运行以下命令重新安装:');
  console.log('  npm install');
}

console.log('='.repeat(50));
