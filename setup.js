const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('🚀 Bay Area Events Scraper Setup\n');
  console.log('This setup will help you configure the scraper with your API keys and preferences.\n');
  
  try {
    // 检查.env文件是否存在
    let envContent = '';
    try {
      envContent = await fs.readFile('.env', 'utf-8');
      console.log('📄 Found existing .env file\n');
    } catch (error) {
      console.log('📄 Creating new .env file\n');
    }
    
    // 收集配置
    const config = {};
    
    console.log('🔑 API Keys Configuration');
    console.log('─'.repeat(30));
    
    // Short.io API Key
    const currentShortio = envContent.match(/SHORTIO_API_KEY=(.+)/)?.[1] || '';
    const shortioPrompt = currentShortio ? 
      `Short.io API Key (current: ${currentShortio.substring(0, 8)}...): ` :
      'Short.io API Key (press Enter to skip): ';
    
    const shortioKey = await question(shortioPrompt);
    config.SHORTIO_API_KEY = shortioKey || currentShortio;
    
    // OpenAI API Key  
    const currentOpenAI = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1] || '';
    const openaiPrompt = currentOpenAI ?
      `OpenAI API Key (current: ${currentOpenAI.substring(0, 8)}...): ` :
      'OpenAI API Key (press Enter to skip): ';
      
    const openaiKey = await question(openaiPrompt);
    config.OPENAI_API_KEY = openaiKey || currentOpenAI;
    
    console.log('\n🌍 Geographic Configuration');
    console.log('─'.repeat(30));
    
    const cities = await question('Target cities (default: San Francisco,Oakland,San Jose): ');
    config.TARGET_CITIES = cities || 'San Francisco,Oakland,San Jose,Palo Alto,Mountain View,Berkeley,Fremont';
    
    console.log('\n📂 Storage Configuration');
    console.log('─'.repeat(30));
    
    const outputDir = await question('Output directory (default: ./output): ');
    config.OUTPUT_DIR = outputDir || './output';
    
    const dataDir = await question('Data directory (default: ./data): ');
    config.DATA_DIR = dataDir || './data';
    
    // 生成.env内容
    const newEnvContent = `# Bay Area Events Scraper Configuration
# Generated on ${new Date().toISOString()}

# Short.io API for URL shortening
SHORTIO_API_KEY=${config.SHORTIO_API_KEY}

# OpenAI API for translation and content generation
OPENAI_API_KEY=${config.OPENAI_API_KEY}

# Scraping configuration
USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36

# Output settings
OUTPUT_DIR=${config.OUTPUT_DIR}
DATA_DIR=${config.DATA_DIR}

# Geographic focus
TARGET_CITIES=${config.TARGET_CITIES}

# Logging level (error, warn, info, debug)
LOG_LEVEL=info
`;
    
    // 保存.env文件
    await fs.writeFile('.env', newEnvContent);
    console.log('\n✅ Configuration saved to .env file');
    
    // 创建必要的目录
    console.log('\n📁 Creating directories...');
    await fs.mkdir(config.OUTPUT_DIR, { recursive: true });
    await fs.mkdir(config.DATA_DIR, { recursive: true });
    await fs.mkdir('./logs', { recursive: true });
    
    console.log(`   - ${config.OUTPUT_DIR} ✅`);
    console.log(`   - ${config.DATA_DIR} ✅`);
    console.log('   - ./logs ✅');
    
    // 检查依赖
    console.log('\n📦 Checking dependencies...');
    try {
      await fs.access('./node_modules', fs.constants.F_OK);
      console.log('   - Node modules: ✅');
    } catch (error) {
      console.log('   - Node modules: ❌ Run `npm install` to install dependencies');
    }
    
    // 显示下一步
    console.log('\n🎉 Setup completed!');
    console.log('\nNext steps:');
    console.log('1. If you haven\'t already, run: npm install');
    console.log('2. Test the setup: npm test');
    console.log('3. Run the scraper: npm start');
    console.log('4. For development: npm run dev');
    
    console.log('\n📚 Documentation:');
    console.log('- README.md for detailed usage');
    console.log('- Check ./output/ for generated content');
    console.log('- Logs are saved to ./logs/');
    
    if (!config.SHORTIO_API_KEY) {
      console.log('\n⚠️  Note: Short.io API key not set - original URLs will be used');
    }
    
    if (!config.OPENAI_API_KEY) {
      console.log('⚠️  Note: OpenAI API key not set - manual translations will be used');
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// API Key验证函数
async function validateAPIKeys() {
  console.log('\n🔍 Validating API keys...');
  
  const config = require('./src/config');
  
  // 验证Short.io
  if (config.apis.shortio.key) {
    try {
      const ShortUrlService = require('./src/utils/shortUrl');
      const service = new ShortUrlService();
      
      // 尝试创建一个测试短链接
      await service.createShortUrl('https://example.com');
      console.log('   - Short.io API: ✅');
    } catch (error) {
      console.log('   - Short.io API: ❌', error.message);
    }
  }
  
  // 验证OpenAI
  if (config.apis.openai.key) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: config.apis.openai.key });
      
      // 测试API调用
      await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });
      
      console.log('   - OpenAI API: ✅');
    } catch (error) {
      console.log('   - OpenAI API: ❌', error.message);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--validate')) {
    await validateAPIKeys();
  } else {
    await setup();
    
    if (args.includes('--validate-after')) {
      await validateAPIKeys();
    }
  }
}

main().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});