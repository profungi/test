const fs = require('fs');
const path = require('path');

// 验证项目结构和文件完整性
function validateProjectStructure() {
  console.log('🔍 Validating project structure...\n');
  
  const requiredFiles = [
    'package.json',
    'README.md',
    '.env.example',
    '.gitignore',
    'src/index.js',
    'src/config.js',
    'src/scrape-events.js',
    'src/generate-post.js',
    'src/utils/database.js',
    'src/utils/ai-classifier.js',
    'src/utils/ai-service.js',
    'src/utils/manual-review.js',
    'src/utils/url-shortener.js',
    'src/scrapers/base-scraper.js',
    'src/scrapers/eventbrite-scraper.js',
    'src/scrapers/sfstation-scraper.js',
    'src/scrapers/dothebay-scraper.js',
    'src/formatters/translator.js',
    'src/formatters/post-generator.js',
    'validate.js'
  ];
  
  const requiredDirs = [
    'src',
    'src/scrapers',
    'src/utils',
    'src/formatters',
    '.github',
    '.github/workflows'
  ];
  
  let allValid = true;
  
  // 检查目录
  console.log('📁 Checking directories:');
  requiredDirs.forEach(dir => {
    const exists = fs.existsSync(dir);
    console.log(`   ${dir}: ${exists ? '✅' : '❌'}`);
    if (!exists) allValid = false;
  });
  
  console.log('\n📄 Checking files:');
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    const size = exists ? fs.statSync(file).size : 0;
    console.log(`   ${file}: ${exists ? '✅' : '❌'} ${exists ? `(${size} bytes)` : ''}`);
    if (!exists) allValid = false;
  });
  
  return allValid;
}

// 验证关键文件内容
function validateFileContents() {
  console.log('\n🔍 Validating key file contents...\n');
  
  const checks = [];
  
  // 检查package.json
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    checks.push({
      file: 'package.json',
      check: 'Has required dependencies',
      status: pkg.dependencies && pkg.dependencies.puppeteer && pkg.dependencies.axios ? '✅' : '❌'
    });
    checks.push({
      file: 'package.json',
      check: 'Has test scripts',
      status: pkg.scripts && pkg.scripts.test && pkg.scripts.start ? '✅' : '❌'
    });
  } catch (error) {
    checks.push({
      file: 'package.json',
      check: 'Valid JSON',
      status: '❌'
    });
  }
  
  // 检查配置文件
  try {
    require('./src/config');
    checks.push({
      file: 'src/config.js',
      check: 'Exports valid config',
      status: '✅'
    });
  } catch (error) {
    checks.push({
      file: 'src/config.js',
      check: 'Exports valid config',
      status: '❌'
    });
  }
  
  // 检查主入口
  try {
    const indexContent = fs.readFileSync('src/index.js', 'utf-8');
    checks.push({
      file: 'src/index.js',
      check: 'Contains orchestrator imports',
      status: indexContent.includes('EventScrapeOrchestrator') && indexContent.includes('PostGenerationOrchestrator') ? '✅' : '❌'
    });
    checks.push({
      file: 'src/index.js',
      check: 'Has main function',
      status: indexContent.includes('async function main()') ? '✅' : '❌'
    });
  } catch (error) {
    checks.push({
      file: 'src/index.js',
      check: 'Readable',
      status: '❌'
    });
  }

  // 检查抓取脚本
  try {
    const scrapeContent = fs.readFileSync('src/scrape-events.js', 'utf-8');
    checks.push({
      file: 'src/scrape-events.js',
      check: 'Contains EventScrapeOrchestrator',
      status: scrapeContent.includes('class EventScrapeOrchestrator') ? '✅' : '❌'
    });
  } catch (error) {
    checks.push({
      file: 'src/scrape-events.js',
      check: 'Readable',
      status: '❌'
    });
  }

  // 检查内容生成脚本
  try {
    const generateContent = fs.readFileSync('src/generate-post.js', 'utf-8');
    checks.push({
      file: 'src/generate-post.js',
      check: 'Contains PostGenerationOrchestrator',
      status: generateContent.includes('class PostGenerationOrchestrator') ? '✅' : '❌'
    });
  } catch (error) {
    checks.push({
      file: 'src/generate-post.js',
      check: 'Readable',
      status: '❌'
    });
  }
  
  // 检查GitHub Actions
  try {
    const workflowContent = fs.readFileSync('.github/workflows/weekly-scrape.yml', 'utf-8');
    checks.push({
      file: 'GitHub Actions',
      check: 'Has scheduled trigger',
      status: workflowContent.includes('schedule:') && workflowContent.includes('cron:') ? '✅' : '❌'
    });
    checks.push({
      file: 'GitHub Actions',
      check: 'Has manual trigger',
      status: workflowContent.includes('workflow_dispatch:') ? '✅' : '❌'
    });
  } catch (error) {
    checks.push({
      file: 'GitHub Actions',
      check: 'Workflow file exists',
      status: '❌'
    });
  }
  
  // 打印检查结果
  checks.forEach(check => {
    console.log(`   ${check.file} - ${check.check}: ${check.status}`);
  });
  
  return checks.every(check => check.status === '✅');
}

// 生成项目摘要
function generateProjectSummary() {
  console.log('\n📊 Project Summary');
  console.log('='.repeat(50));
  
  const stats = {
    totalFiles: 0,
    totalLines: 0,
    totalSize: 0,
    filesByType: {}
  };
  
  function analyzeDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          analyzeDirectory(itemPath);
        }
      } else {
        const ext = path.extname(item);
        stats.totalFiles++;
        stats.totalSize += stat.size;
        stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1;
        
        // 计算代码行数
        if (['.js', '.json', '.md', '.yml'].includes(ext)) {
          try {
            const content = fs.readFileSync(itemPath, 'utf-8');
            stats.totalLines += content.split('\n').length;
          } catch (error) {
            // 忽略无法读取的文件
          }
        }
      }
    });
  }
  
  analyzeDirectory('.');
  
  console.log(`📁 Total files: ${stats.totalFiles}`);
  console.log(`📏 Total lines: ${stats.totalLines}`);
  console.log(`💾 Total size: ${(stats.totalSize / 1024).toFixed(1)} KB`);
  console.log('\n📋 Files by type:');
  Object.entries(stats.filesByType).forEach(([ext, count]) => {
    console.log(`   ${ext || '(no ext)'}: ${count}`);
  });
}

// 生成功能清单
function generateFeatureList() {
  console.log('\n✨ Implemented Features');
  console.log('='.repeat(50));
  
  const features = [
    '🕷️ Multi-source event scraping (Eventbrite, SFStation)',
    '📅 Smart date filtering (next week only)',
    '🔄 Duplicate event detection and removal',
    '🌐 AI-powered content translation and optimization',
    '🔗 Short URL generation via Short.io API',
    '📱 Xiaohongshu-optimized content formatting',
    '💾 SQLite database for event storage and history',
    '⏰ GitHub Actions automated scheduling',
    '📊 Comprehensive logging and error handling',
    '🛠️ Interactive setup and validation scripts',
    '🧪 Built-in testing framework',
    '🌍 Geographic filtering for Bay Area focus',
    '🏷️ Event type prioritization (market > fair > festival > food > music > free)',
    '📈 Performance monitoring and reporting',
    '🔍 Event validation and quality filtering'
  ];
  
  features.forEach(feature => console.log(`   ${feature}`));
}

// 主验证函数
function main() {
  console.log('🚀 Bay Area Events Scraper - Project Validation\n');
  
  const structureValid = validateProjectStructure();
  const contentValid = validateFileContents();
  
  console.log('\n' + '='.repeat(50));
  console.log(`📋 Validation Result: ${structureValid && contentValid ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (structureValid && contentValid) {
    generateProjectSummary();
    generateFeatureList();
    
    console.log('\n🎉 Next Steps:');
    console.log('1. Run: npm install (to install dependencies)');
    console.log('2. Run: npm run setup (to configure API keys)');
    console.log('3. Run: npm test (to test the system)');
    console.log('4. Run: npm start (to execute the scraper)');
    console.log('5. Configure GitHub repository secrets for automation');
  } else {
    console.log('\n❌ Please fix the validation errors before proceeding.');
  }
}

main();