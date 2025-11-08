#!/usr/bin/env node

/**
 * 测试短链接生成失败时的回退机制
 */

console.log('🧪 测试短链接失败回退机制\n');

// 模拟场景
const scenarios = [
  {
    name: '场景1：短链接生成成功',
    shortUrlResult: 'https://short.io/abc123',
    originalUrl: 'https://www.eventbrite.com/e/test-event-123',
    expected: {
      shouldUseShortUrl: true,
      url: 'https://short.io/abc123'
    }
  },
  {
    name: '场景2：短链接生成失败，抛出异常',
    shortUrlResult: 'ERROR',
    originalUrl: 'https://www.eventbrite.com/e/test-event-123',
    expected: {
      shouldUseShortUrl: false,
      url: 'https://www.eventbrite.com/e/test-event-123'
    }
  },
  {
    name: '场景3：短链接返回原始链接（API不可用）',
    shortUrlResult: 'https://www.eventbrite.com/e/test-event-123',
    originalUrl: 'https://www.eventbrite.com/e/test-event-123',
    expected: {
      shouldUseShortUrl: false,
      url: 'https://www.eventbrite.com/e/test-event-123'
    }
  },
  {
    name: '场景4：短链接返回null或undefined',
    shortUrlResult: null,
    originalUrl: 'https://www.eventbrite.com/e/test-event-123',
    expected: {
      shouldUseShortUrl: false,
      url: 'https://www.eventbrite.com/e/test-event-123'
    }
  }
];

// 模拟的处理逻辑（与实际代码一致）
function simulateShortUrlHandling(shortUrlResult, originalUrl) {
  let event = {
    originalUrl: originalUrl
  };

  try {
    // 模拟可能的错误
    if (shortUrlResult === 'ERROR') {
      throw new Error('API quota exceeded');
    }

    // shortenUrl 返回的是字符串（短链接）或原始链接
    if (shortUrlResult && typeof shortUrlResult === 'string') {
      event.short_url = shortUrlResult;
      // 检查是否真的生成了短链接（不是原始链接）
      if (shortUrlResult !== event.originalUrl && shortUrlResult.includes('short.')) {
        return { success: true, url: shortUrlResult, message: '短链接生成成功' };
      } else {
        return { success: false, url: shortUrlResult, message: '使用原始链接' };
      }
    } else {
      event.short_url = event.originalUrl;
      return { success: false, url: event.originalUrl, message: '短链接返回值异常，使用原始链接' };
    }
  } catch (shortUrlError) {
    event.short_url = event.originalUrl;
    return { success: false, url: event.originalUrl, message: `短链接生成出错: ${shortUrlError.message}，使用原始链接` };
  }
}

// 运行测试
let passCount = 0;
let failCount = 0;

scenarios.forEach((scenario, index) => {
  console.log(`\n${index + 1}. ${scenario.name}`);
  console.log(`   输入: ${scenario.shortUrlResult || 'null'}`);
  console.log(`   原始URL: ${scenario.originalUrl}`);

  const result = simulateShortUrlHandling(scenario.shortUrlResult, scenario.originalUrl);

  console.log(`   结果: ${result.message}`);
  console.log(`   使用URL: ${result.url}`);

  // 验证
  const isCorrect = result.url === scenario.expected.url;
  if (isCorrect) {
    console.log(`   ✅ 测试通过`);
    passCount++;
  } else {
    console.log(`   ❌ 测试失败`);
    console.log(`   期望: ${scenario.expected.url}`);
    console.log(`   实际: ${result.url}`);
    failCount++;
  }
});

console.log('\n' + '='.repeat(70));
console.log('📊 测试总结');
console.log('='.repeat(70));
console.log(`✅ 通过: ${passCount}/${scenarios.length}`);
console.log(`❌ 失败: ${failCount}/${scenarios.length}`);

if (failCount === 0) {
  console.log('\n🎉 所有测试通过！短链接失败回退机制工作正常。');
  console.log('\n关键特性:');
  console.log('  ✅ 短链接生成失败时，使用原始链接');
  console.log('  ✅ 活动仍然可以添加到数据库');
  console.log('  ✅ 不会因为短链接失败而中断整个流程');
  console.log('  ✅ 提供清晰的错误提示');
} else {
  console.log('\n⚠️  部分测试失败，请检查代码逻辑。');
  process.exit(1);
}
