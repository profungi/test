const BayAreaEventsScraper = require('./src/index');
const logger = require('./src/utils/logger');
const DateUtils = require('./src/utils/dateUtils');

async function testWorkflow() {
  console.log('🧪 Starting Bay Area Events Scraper Test...\n');
  
  try {
    // 显示测试配置
    const weekRange = DateUtils.getNextWeekRange();
    console.log(`📅 Test target week: ${DateUtils.formatDateRange(weekRange.start, weekRange.end)}`);
    console.log(`🗓️ Week identifier: ${weekRange.identifier}\n`);
    
    // 检查环境变量
    console.log('🔧 Checking configuration...');
    console.log(`- SHORTIO_API_KEY: ${process.env.SHORTIO_API_KEY ? 'Set ✅' : 'Not set ⚠️'}`);
    console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set ✅' : 'Not set ⚠️'}`);
    console.log();
    
    // 运行主程序
    const scraper = new BayAreaEventsScraper();
    await scraper.run();
    
    console.log('\n✅ Test completed successfully!');
    
    // 显示生成的文件
    console.log('\n📁 Generated files:');
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const outputFiles = await fs.readdir('./output');
      outputFiles.forEach(file => {
        console.log(`   - output/${file}`);
      });
    } catch (error) {
      console.log('   No output files found');
    }
    
    try {
      const dataFiles = await fs.readdir('./data');
      dataFiles.forEach(file => {
        console.log(`   - data/${file}`);
      });
    } catch (error) {
      console.log('   No data files found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// 简单的模块测试函数
async function testModules() {
  console.log('🔬 Testing individual modules...\n');
  
  // 测试日期工具
  console.log('📅 Testing DateUtils...');
  const weekRange = DateUtils.getNextWeekRange();
  console.log(`- Next week range: ${JSON.stringify(weekRange)}`);
  console.log(`- Is event in next week (test date): ${DateUtils.isEventInNextWeek(weekRange.start)}`);
  
  // 测试数据库
  console.log('\n💾 Testing Database...');
  const EventDatabase = require('./src/utils/database');
  const db = new EventDatabase();
  
  try {
    await db.connect();
    console.log('- Database connection: ✅');
    
    // 测试事件保存
    const testEvent = {
      title: 'Test Event',
      startTime: weekRange.start.toISOString(),
      location: 'San Francisco',
      price: 'Free',
      originalUrl: 'http://example.com',
      source: 'test',
      eventType: 'test',
      priority: 5,
      weekIdentifier: weekRange.identifier
    };
    
    const result = await db.saveEvent(testEvent);
    console.log(`- Event save test: ${result.saved ? '✅' : '⚠️ (might be duplicate)'}`);
    
    await db.close();
    console.log('- Database cleanup: ✅');
    
  } catch (error) {
    console.error('- Database test failed:', error.message);
  }
  
  // 测试内容格式化
  console.log('\n📝 Testing ContentFormatter...');
  const ContentFormatter = require('./src/formatters/ContentFormatter');
  const formatter = new ContentFormatter();
  
  try {
    // 测试简单内容生成
    const testEvents = [{
      title: 'Test Market Event',
      start_time: weekRange.start.toISOString(),
      location: 'San Francisco',
      price: 'Free',
      original_url: 'http://example.com',
      event_type: 'market',
      priority: 10
    }];
    
    const formatted = await formatter.formatWeeklyPost(testEvents, weekRange);
    console.log('- Content formatting: ✅');
    console.log(`- Generated content length: ${formatted.content.length} characters`);
    
  } catch (error) {
    console.error('- Content formatting test failed:', error.message);
  }
  
  console.log('\n🏁 Module tests completed!');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--modules-only')) {
    await testModules();
  } else if (args.includes('--full')) {
    await testModules();
    console.log('\n' + '='.repeat(50) + '\n');
    await testWorkflow();
  } else {
    console.log('Bay Area Events Scraper Test\n');
    console.log('Options:');
    console.log('  --modules-only  Test individual modules only');
    console.log('  --full         Test modules and run full workflow');
    console.log('  (no args)      Run full workflow only\n');
    
    await testWorkflow();
  }
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});