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

      // 读取模板图片并转换为 base64
      const templatePath = path.join(__dirname, '../../assets/cover-template.jpg');
      const imageBuffer = await fs.readFile(templatePath);
      const base64Image = imageBuffer.toString('base64');

      // 初始化浏览器
      browser = await this.initBrowser();

      // 生成 HTML
      const html = this.generateHtml(dateRange, base64Image);

      // 创建页面
      const page = await browser.newPage();
      await page.setViewport({ width: this.width, height: this.height });
      await page.setContent(html, { waitUntil: 'networkidle0' });

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
   * 生成 HTML 模板 - 使用固定模板图片，只替换日期
   */
  generateHtml(dateRange, base64Image) {
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
      position: relative;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }

    /* 背景模板图片 */
    .template-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* 日期文字覆盖层 */
    .date-overlay {
      position: absolute;
      top: 320px;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 10;
    }

    .date {
      font-size: 95px;
      font-weight: 900;
      color: #2D2416;
      letter-spacing: -1px;
      margin: 0;
      padding: 0;
    }

  </style>
</head>
<body>
  <!-- 模板背景图片 (base64 embedded) -->
  <img src="data:image/jpeg;base64,${base64Image}" class="template-image" alt="Cover Template">

  <!-- 日期覆盖层 -->
  <div class="date-overlay">
    <div class="date">${dateRange}</div>
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
