#!/usr/bin/env node

/**
 * Bay Area Events Scraper - Main Entry Point
 * 湾区活动抓取器主程序
 */

const EventScrapeOrchestrator = require('./scrape-events');
const PostGenerationOrchestrator = require('./generate-post');

function showMainHelp() {
  console.log(`
🎯 Bay Area Events Scraper for Xiaohongshu

这是一个自动抓取湾区活动并生成小红书发布内容的工具。

主要功能:
1. 📡 抓取 Eventbrite, SF Station, DoTheBay 的活动信息
2. 🤖 AI 智能分类和优先级排序
3. 👁️  生成人工审核文件供选择活动
4. 🔗 生成短链接 (Short.io)
5. 🌐 AI 翻译优化内容
6. 📱 生成小红书发布格式

使用流程:
┌─────────────────────────────────────────┐
│ 1. npm run scrape                       │ 
│    抓取活动 → 生成审核文件                │
├─────────────────────────────────────────┤
│ 2. 手动编辑审核文件                       │
│    选择要发布的活动 (selected: true)      │
├─────────────────────────────────────────┤ 
│ 3. npm run generate-post [文件路径]       │
│    生成短链接 → 翻译 → 小红书格式         │
└─────────────────────────────────────────┘

环境配置:
请先设置环境变量:
- SHORTIO_API_KEY=你的short.io API密钥
- OPENAI_API_KEY=你的OpenAI API密钥

常用命令:
  npm run scrape                    # 抓取活动，生成审核文件
  npm run generate-post <文件路径>   # 生成最终发布内容
  npm run validate                  # 验证环境配置
  
示例:
  npm run scrape
  npm run generate-post "./output/review_2024-09-19_1430.json"

更多帮助:
  npm run scrape -- --help         # 抓取命令帮助
  npm run generate-post -- --help  # 生成命令帮助
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  // 处理AI提供商选择
  const aiProviderIndex = args.indexOf('--ai-provider');
  if (aiProviderIndex !== -1 && args[aiProviderIndex + 1]) {
    const provider = args[aiProviderIndex + 1];
    if (['openai', 'gemini', 'claude'].includes(provider)) {
      process.env.AI_PROVIDER = provider;
      console.log(`🤖 Using AI provider: ${provider}`);
      // 移除这个参数
      args.splice(aiProviderIndex, 2);
    } else {
      console.error(`❌ Invalid AI provider: ${provider}`);
      console.error('Valid options: openai, gemini, claude');
      process.exit(1);
    }
  }
  
  const command = args[0];
  
  // 处理帮助请求
  if (!command || command === '--help' || command === '-h') {
    showMainHelp();
    return;
  }
  
  try {
    switch (command) {
      case 'scrape':
        const scrapeOrchestrator = new EventScrapeOrchestrator();
        await scrapeOrchestrator.run();
        break;
        
      case 'generate-post':
        if (args.length < 2) {
          console.error('❌ 请提供审核文件路径');
          console.error('用法: node src/index.js generate-post <文件路径>');
          process.exit(1);
        }
        const postOrchestrator = new PostGenerationOrchestrator();
        await postOrchestrator.run(args[1]);
        break;
        
      case 'validate':
        await validateEnvironment();
        break;
        
      default:
        console.error(`❌ 未知命令: ${command}`);
        console.error('运行 node src/index.js --help 查看可用命令');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

async function validateEnvironment() {
  console.log('🔍 验证环境配置...\n');
  
  const required = ['SHORTIO_API_KEY', 'OPENAI_API_KEY'];
  let valid = true;
  
  for (const key of required) {
    if (process.env[key]) {
      console.log(`✅ ${key}: 已配置`);
    } else {
      console.log(`❌ ${key}: 未配置`);
      valid = false;
    }
  }
  
  if (valid) {
    console.log('\n✅ 环境配置正确，可以开始使用！');
    console.log('\n下一步: npm run scrape');
  } else {
    console.log('\n❌ 请先配置缺失的环境变量');
    console.log('可以创建 .env 文件或设置环境变量');
  }
}

// 只在直接运行时执行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  EventScrapeOrchestrator,
  PostGenerationOrchestrator
};