const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

class CoverGenerator {
  constructor() {
    // 图片规格：1024宽 x 1536高（2:3比例）
    this.width = 1024;
    this.height = 1536;
    this.outputDir = path.join(__dirname, '../../output/covers');
    this.browser = null;
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 生成封面图片
   * @param {Object} weekRange - 周范围信息 {identifier: "2024-09-23_to_2024-09-29"}
   * @returns {Promise<Object>} {filepath, filename}
   */
  async generateCover(weekRange) {
    console.log('🎨 开始生成小红书封面图片...');

    let browser;
    try {
      // 计算日期范围
      const dateRange = this.extractWeekDates(weekRange.identifier);

      // 初始化浏览器
      browser = await this.initBrowser();

      // 生成 HTML
      const html = this.generateHtml(dateRange);

      // 创建页面
      const page = await browser.newPage();
      await page.setViewport({ width: this.width, height: this.height });
      await page.setContent(html);

      // 保存文件
      await this.ensureOutputDirectory();

      // 使用微秒级时间戳确保文件名唯一
      const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
      const uniqueId = Date.now() % 1000;
      const filename = `cover_${timestamp}_${uniqueId}.png`;
      const filepath = path.join(this.outputDir, filename);

      // 截图保存为 PNG
      await page.screenshot({
        path: filepath,
        type: 'png',
        omitBackground: false
      });

      await page.close();

      console.log(`✅ 封面图片已生成: ${filepath}`);

      return {
        filepath,
        filename,
        dateRange
      };
    } catch (error) {
      console.error('❌ 生成封面图片失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成 HTML 模板
   */
  generateHtml(dateRange) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bay Area Events</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: ${this.width}px;
      height: ${this.height}px;
      font-family: 'Arial', 'Helvetica', sans-serif;
      background: linear-gradient(135deg, #FFF5F7 0%, #FFE8F0 50%, #F0E8FF 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 40px;
      position: relative;
      overflow: hidden;
    }

    /* 背景装饰 */
    .bg-decoration {
      position: absolute;
      border-radius: 50%;
      opacity: 0.3;
    }

    .decoration-1 {
      width: 240px;
      height: 240px;
      background: linear-gradient(135deg, #D8B4FF, #C77DFF);
      top: 80px;
      left: 40px;
      box-shadow: 0 10px 30px rgba(157, 78, 221, 0.2);
    }

    .decoration-2 {
      width: 280px;
      height: 280px;
      background: linear-gradient(135deg, #B8E0FF, #7BC542);
      bottom: 120px;
      right: 30px;
      box-shadow: 0 10px 30px rgba(123, 197, 66, 0.2);
    }

    /* 葡萄容器 */
    .grape-container {
      position: absolute;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 5;
    }

    .grape-left-top {
      width: 180px;
      height: 240px;
      top: 80px;
      left: 20px;
    }

    .grape-right-top {
      width: 140px;
      height: 180px;
      top: 140px;
      right: 40px;
    }

    .grape-left-bottom {
      width: 160px;
      height: 220px;
      bottom: 100px;
      left: 40px;
    }

    .grape-right-bottom {
      width: 190px;
      height: 260px;
      bottom: 80px;
      right: 20px;
    }

    /* 单个葡萄 */
    .grape {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      position: relative;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), inset -2px -2px 4px rgba(0, 0, 0, 0.1);
      margin: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .grape::before {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), transparent);
      border-radius: 50%;
      top: 4px;
      left: 4px;
    }

    .grape.purple {
      background: linear-gradient(135deg, #9D4EDD 0%, #6A0DAD 100%);
    }

    .grape.dark-purple {
      background: linear-gradient(135deg, #7B2CBF 0%, #5A1B8C 100%);
    }

    .grape.light-purple {
      background: linear-gradient(135deg, #C77DFF 0%, #A569BD 100%);
    }

    /* 葡萄束 */
    .grape-cluster {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      padding: 10px;
    }

    .grape-cluster.large {
      grid-template-columns: repeat(4, 1fr);
    }

    /* 葡萄茎和叶子 */
    .grape-stem {
      position: absolute;
      width: 3px;
      height: 25px;
      background: #6B8E23;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 2px;
    }

    .grape-leaf {
      position: absolute;
      width: 35px;
      height: 45px;
      background: #7BC542;
      border-radius: 50% 0;
      top: -30px;
    }

    .leaf-left {
      left: 10px;
      transform: rotate(-45deg);
    }

    .leaf-right {
      right: 10px;
      transform: rotate(45deg);
    }

    /* 内容容器 */
    .content {
      position: relative;
      z-index: 10;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex: 1;
    }

    /* 标题部分 */
    .title-box {
      background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(10px);
      border-radius: 30px;
      padding: 40px 50px;
      margin-bottom: 100px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .title {
      font-size: 72px;
      font-weight: 900;
      color: #6A0DAD;
      letter-spacing: 3px;
      margin: 0;
      line-height: 1.1;
    }

    .subtitle {
      font-size: 52px;
      font-weight: 900;
      color: #6A0DAD;
      letter-spacing: 2px;
      margin: 15px 0 0 0;
      line-height: 1.1;
    }

    /* 日期范围 */
    .date-box {
      background: linear-gradient(135deg, #FF6B9D 0%, #FF4757 100%);
      border-radius: 20px;
      padding: 25px 60px;
      box-shadow: 0 10px 40px rgba(255, 107, 157, 0.3);
      margin-top: 60px;
    }

    .date-range {
      font-size: 80px;
      font-weight: 900;
      color: white;
      letter-spacing: 2px;
      text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      margin: 0;
    }

    /* 底部装饰 */
    .bottom-decoration {
      position: absolute;
      bottom: 30px;
      display: flex;
      gap: 300px;
      width: 100%;
      justify-content: center;
    }

    .dot {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
    }

    .dot-1 {
      background: linear-gradient(135deg, #C77DFF, #A569BD);
      opacity: 0.6;
    }

    .dot-2 {
      background: linear-gradient(135deg, #9D4EDD, #7B2CBF);
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <!-- 背景装饰 -->
  <div class="bg-decoration decoration-1"></div>
  <div class="bg-decoration decoration-2"></div>

  <!-- 左上角葡萄 -->
  <div class="grape-container grape-left-top">
    <div style="position: relative; width: 100%; height: 100%;">
      <div class="grape-stem"></div>
      <div class="grape-leaf leaf-left"></div>
      <div class="grape-leaf leaf-right"></div>
      <div class="grape-cluster">
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
      </div>
    </div>
  </div>

  <!-- 右上角葡萄 -->
  <div class="grape-container grape-right-top">
    <div style="position: relative; width: 100%; height: 100%;">
      <div class="grape-stem"></div>
      <div class="grape-leaf leaf-left"></div>
      <div class="grape-leaf leaf-right"></div>
      <div class="grape-cluster">
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
      </div>
    </div>
  </div>

  <!-- 左下角葡萄 -->
  <div class="grape-container grape-left-bottom">
    <div style="position: relative; width: 100%; height: 100%;">
      <div class="grape-stem"></div>
      <div class="grape-leaf leaf-left"></div>
      <div class="grape-leaf leaf-right"></div>
      <div class="grape-cluster">
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
      </div>
    </div>
  </div>

  <!-- 右下角葡萄 -->
  <div class="grape-container grape-right-bottom">
    <div style="position: relative; width: 100%; height: 100%;">
      <div class="grape-stem"></div>
      <div class="grape-leaf leaf-left"></div>
      <div class="grape-leaf leaf-right"></div>
      <div class="grape-cluster large">
        <div class="grape purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape light-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape dark-purple"></div>
        <div class="grape light-purple"></div>
      </div>
    </div>
  </div>

  <!-- 主内容 -->
  <div class="content">
    <div class="title-box">
      <h1 class="title">BAY AREA</h1>
      <h2 class="subtitle">SELECTED EVENTS</h2>
    </div>

    <div class="date-box">
      <p class="date-range">${dateRange}</p>
    </div>
  </div>

  <!-- 底部装饰 -->
  <div class="bottom-decoration">
    <div class="dot dot-1"></div>
    <div class="dot dot-2"></div>
  </div>
</body>
</html>`;
  }

  /**
   * 从周范围标识符中提取日期
   * @param {string} identifier - 格式: "2024-09-23_to_2024-09-29"
   * @returns {string} - 格式: "11/5 - 11/9"
   */
  extractWeekDates(identifier) {
    const [startStr, endStr] = identifier.split('_to_');
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    // 从开始日期找到周三
    const startDay = startDate.getDay(); // 0=Sunday, 1=Monday, etc.
    let wednesdayDate = new Date(startDate);

    if (startDay === 0) { // Sunday
      wednesdayDate.setDate(startDate.getDate() + 3);
    } else if (startDay === 1) { // Monday
      wednesdayDate.setDate(startDate.getDate() + 2);
    } else if (startDay === 2) { // Tuesday
      wednesdayDate.setDate(startDate.getDate() + 1);
    } else if (startDay === 3) { // Wednesday
      // 保持原样
    } else {
      // Thursday-Saturday，回到前面的周三
      wednesdayDate.setDate(startDate.getDate() - (startDay - 3));
    }

    // 从周三向后推到周日
    const sundayDate = new Date(wednesdayDate);
    sundayDate.setDate(wednesdayDate.getDate() + 4);

    const wednesdayFormatted = format(wednesdayDate, 'M/d');
    const sundayFormatted = format(sundayDate, 'M/d');

    return `${wednesdayFormatted} - ${sundayFormatted}`;
  }

  /**
   * 确保输出目录存在
   */
  async ensureOutputDirectory() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }
}

module.exports = CoverGenerator;
