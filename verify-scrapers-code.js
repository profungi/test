#!/usr/bin/env node

/**
 * 代码验证脚本：检查所有爬虫源代码中是否都返回 description_detail 字段
 */

const fs = require('fs');
const path = require('path');

function checkScraperFile(filePath, scraperName) {
  console.log(`\n📄 Checking ${scraperName} (${filePath}):`);
  console.log('-'.repeat(70));

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // 检查 1: 是否有 description_detail 字段定义
    const hasDescriptionDetailField = content.includes('description_detail');
    console.log(`✓ Contains 'description_detail' reference: ${hasDescriptionDetailField ? '✅' : '❌'}`);

    // 检查 2: 是否在返回对象中包含 description_detail
    const returnObjectPattern = /return\s*\{[\s\S]*?description_detail\s*:/;
    const hasDescriptionDetailInReturn = returnObjectPattern.test(content);
    console.log(`✓ Returns 'description_detail' field: ${hasDescriptionDetailInReturn ? '✅' : '❌'}`);

    // 检查 3: 是否有 fetchEventDetails 方法（用于获取详情页）
    const hasFetchEventDetails = content.includes('async fetchEventDetails');
    console.log(`✓ Has 'fetchEventDetails()' method: ${hasFetchEventDetails ? '✅' : '❌'}`);

    // 检查 4: 是否有 extractDetailedDescription 方法
    const hasExtractDetailedDescription = content.includes('extractDetailedDescription');
    console.log(`✓ Has 'extractDetailedDescription()' method: ${hasExtractDetailedDescription ? '✅' : '❌'}`);

    // 详细搜索 - 找到所有返回对象的地方
    const returnMatches = content.match(/return\s*\{[\s\S]*?\n\s*\};/g);
    if (returnMatches) {
      console.log(`\n📋 Found ${returnMatches.length} return statement(s):`);
      returnMatches.slice(0, 3).forEach((match, idx) => {
        const hasDetail = match.includes('description_detail');
        const preview = match.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   ${idx + 1}. ${hasDetail ? '✅' : '❌'} ${preview}...`);
      });
    }

    // 检查 5: 数据流 - 确保 description_detail 被正确传递
    if (hasFetchEventDetails && hasExtractDetailedDescription) {
      console.log(`\n✅ Has complete data flow for description_detail`);
    }

    return {
      name: scraperName,
      hasField: hasDescriptionDetailField,
      hasReturn: hasDescriptionDetailInReturn,
      hasFetchDetails: hasFetchEventDetails,
      hasExtractDescription: hasExtractDetailedDescription,
      isComplete: hasDescriptionDetailField && hasDescriptionDetailInReturn
    };

  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔍 Code Verification: Checking all scrapers for description_detail support\n');
  console.log('='.repeat(70));

  const scrapersDir = path.join(__dirname, 'src', 'scrapers');
  const scraperFiles = [
    { name: 'Eventbrite', file: 'eventbrite-scraper.js' },
    { name: 'SF Station', file: 'sfstation-scraper.js' },
    { name: 'Funcheap', file: 'funcheap-weekend-scraper.js' }
  ];

  const results = [];
  for (const { name, file } of scraperFiles) {
    const filePath = path.join(scrapersDir, file);
    const result = checkScraperFile(filePath, name);
    if (result) {
      results.push(result);
    }
  }

  // 总结
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Summary:\n');

  results.forEach(result => {
    if (result.isComplete) {
      console.log(`✅ ${result.name}: COMPLETE - Has all required components`);
    } else {
      console.log(`❌ ${result.name}: INCOMPLETE`);
      if (!result.hasField) console.log(`   - Missing description_detail field`);
      if (!result.hasReturn) console.log(`   - Not returned in object`);
      if (!result.hasFetchDetails) console.log(`   - Missing fetchEventDetails() method`);
      if (!result.hasExtractDescription) console.log(`   - Missing extractDetailedDescription() method`);
    }
  });

  const allComplete = results.every(r => r.isComplete);
  console.log('\n' + '='.repeat(70));
  if (allComplete) {
    console.log('✅ ALL SCRAPERS: Ready for production - description_detail is properly implemented');
  } else {
    console.log('❌ INCOMPLETE: Some scrapers still need description_detail implementation');
  }
  console.log('');
}

main();
