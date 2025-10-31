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
      font-family: 'Arial Black', 'Arial', sans-serif;
      background: #EDE8DB;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }

    /* 标题文字 */
    .title {
      font-size: 90px;
      font-weight: 900;
      color: #2D2416;
      letter-spacing: -2px;
      text-align: center;
      line-height: 1;
      margin-bottom: 20px;
      text-transform: uppercase;
    }

    .date {
      font-size: 75px;
      font-weight: 900;
      color: #2D2416;
      text-align: center;
      margin-bottom: 80px;
      letter-spacing: -1px;
    }

    /* 葡萄角色容器 */
    .grape-character {
      position: relative;
      width: 450px;
      height: 550px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* 阴影 */
    .shadow {
      position: absolute;
      bottom: 0;
      width: 200px;
      height: 40px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      filter: blur(10px);
    }

    /* 葡萄主体 */
    .grape-body {
      position: relative;
      width: 300px;
      height: 400px;
    }

    /* 叶子和茎 */
    .leaf {
      position: absolute;
      width: 90px;
      height: 110px;
      background: #8BAF6E;
      border: 5px solid #2D2416;
      border-radius: 50% 0;
      top: -35px;
      left: 50%;
      transform: translateX(-50%) rotate(-25deg);
      z-index: 20;
    }

    .stem {
      position: absolute;
      width: 15px;
      height: 45px;
      background: #6B5330;
      border: 4px solid #2D2416;
      border-radius: 8px;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 19;
    }

    /* 葡萄球（组成葡萄串身体） */
    .grape-ball {
      position: absolute;
      background: #9B7FB8;
      border: 5px solid #2D2416;
      border-radius: 50%;
    }

    .grape-ball::before {
      content: '';
      position: absolute;
      width: 28px;
      height: 35px;
      background: rgba(255, 255, 255, 0.45);
      border-radius: 50%;
      top: 15%;
      left: 20%;
    }

    /* 葡萄球位置 - 紧密排列形成葡萄串人物 */
    .ball-1 {
      width: 95px;
      height: 95px;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 12;
    }

    .ball-2 {
      width: 100px;
      height: 100px;
      top: 40px;
      left: 15px;
      z-index: 11;
    }

    .ball-3 {
      width: 100px;
      height: 100px;
      top: 40px;
      right: 15px;
      z-index: 11;
    }

    .ball-4 {
      width: 110px;
      height: 110px;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 13;
    }

    .ball-5 {
      width: 95px;
      height: 95px;
      top: 155px;
      left: 25px;
      z-index: 10;
    }

    .ball-6 {
      width: 95px;
      height: 95px;
      top: 155px;
      right: 25px;
      z-index: 10;
    }

    .ball-7 {
      width: 105px;
      height: 105px;
      top: 195px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 12;
    }

    /* 脸部特征 */
    .face {
      position: absolute;
      top: 160px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 15;
      width: 80px;
    }

    .eye {
      position: absolute;
      width: 16px;
      height: 16px;
      background: #2D2416;
      border-radius: 50%;
      top: 0;
    }

    .eye-left { left: 10px; }
    .eye-right { right: 10px; }

    .smile {
      width: 50px;
      height: 25px;
      border: 5px solid #2D2416;
      border-top: none;
      border-radius: 0 0 50px 50px;
      margin-top: 18px;
      margin-left: 15px;
    }

    /* 手臂 */
    .arm {
      position: absolute;
      width: 55px;
      height: 120px;
      background: #9B7FB8;
      border: 5px solid #2D2416;
      border-radius: 30px;
      z-index: 8;
    }

    .arm-left {
      top: 140px;
      left: -25px;
      transform: rotate(-20deg);
    }

    .arm-right {
      top: 135px;
      right: -30px;
      transform: rotate(30deg);
    }

    /* 腿 */
    .leg {
      position: absolute;
      width: 45px;
      height: 85px;
      background: #9B7FB8;
      border: 5px solid #2D2416;
      border-radius: 25px;
      bottom: -80px;
      z-index: 8;
    }

    .leg-left { left: 75px; }
    .leg-right { right: 75px; }

    /* 香槟杯 */
    .champagne {
      position: absolute;
      top: 110px;
      right: -110px;
      z-index: 16;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .champagne-container {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .glass-bowl {
      width: 55px;
      height: 85px;
      background: transparent;
      border: 5px solid #2D2416;
      border-radius: 12px 12px 28px 28px;
      position: relative;
      overflow: hidden;
      margin-bottom: -3px;
    }

    .champagne-liquid {
      position: absolute;
      bottom: 0;
      width: 100%;
      height: 55%;
      background: #F5C842;
      border-radius: 0 0 23px 23px;
    }

    .bubble {
      position: absolute;
      background: white;
      border-radius: 50%;
    }

    .bubble-1 {
      width: 9px;
      height: 9px;
      bottom: 18px;
      left: 18px;
    }

    .bubble-2 {
      width: 7px;
      height: 7px;
      bottom: 28px;
      left: 28px;
    }

    .glass-stem {
      width: 9px;
      height: 65px;
      background: #2D2416;
      border-radius: 5px;
      margin-bottom: -2px;
    }

    .glass-base {
      width: 18px;
      height: 42px;
      background: #2D2416;
      border-radius: 9px;
    }

    .sparkle {
      position: absolute;
      width: 14px;
      height: 14px;
      top: -30px;
      right: -8px;
    }

    .sparkle::before,
    .sparkle::after {
      content: '';
      position: absolute;
      background: #2D2416;
    }

    .sparkle::before {
      width: 4px;
      height: 14px;
      left: 50%;
      transform: translateX(-50%);
    }

    .sparkle::after {
      width: 14px;
      height: 4px;
      top: 50%;
      transform: translateY(-50%);
    }

    .sparkle-2 {
      top: -18px;
      right: 8px;
      width: 10px;
      height: 10px;
    }

    .sparkle-2::before {
      height: 10px;
      width: 3px;
    }

    .sparkle-2::after {
      width: 10px;
      height: 3px;
    }
  </style>
</head>
<body>
  <!-- 标题 -->
  <div class="title">BAY AREA<br>SELECTED<br>EVENTS</div>

  <!-- 日期 -->
  <div class="date">${dateRange}</div>

  <!-- 葡萄角色 -->
  <div class="grape-character">
    <!-- 阴影 -->
    <div class="shadow"></div>

    <!-- 葡萄主体 -->
    <div class="grape-body">
      <!-- 叶子和茎 -->
      <div class="leaf"></div>
      <div class="stem"></div>

      <!-- 葡萄球（组成身体） -->
      <div class="grape-ball ball-1"></div>
      <div class="grape-ball ball-2"></div>
      <div class="grape-ball ball-3"></div>
      <div class="grape-ball ball-4"></div>
      <div class="grape-ball ball-5"></div>
      <div class="grape-ball ball-6"></div>
      <div class="grape-ball ball-7"></div>

      <!-- 脸 -->
      <div class="face">
        <div class="eye eye-left"></div>
        <div class="eye eye-right"></div>
        <div class="smile"></div>
      </div>

      <!-- 手臂 -->
      <div class="arm arm-left"></div>
      <div class="arm arm-right"></div>

      <!-- 腿 -->
      <div class="leg leg-left"></div>
      <div class="leg leg-right"></div>

      <!-- 香槟杯 -->
      <div class="champagne">
        <div class="champagne-container">
          <div class="sparkle"></div>
          <div class="sparkle sparkle-2"></div>
          <div class="glass-bowl">
            <div class="champagne-liquid">
              <div class="bubble bubble-1"></div>
              <div class="bubble bubble-2"></div>
            </div>
          </div>
          <div class="glass-stem"></div>
          <div class="glass-base"></div>
        </div>
      </div>
    </div>
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
