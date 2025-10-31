const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

class CoverGenerator {
  constructor() {
    // 图片规格：1024宽 x 1536高（2:3比例）
    this.width = 1024;
    this.height = 1536;
    this.outputDir = path.join(__dirname, '../../output/covers');
  }

  /**
   * 生成封面图片
   * @param {Object} weekRange - 周范围信息 {identifier: "2024-09-23_to_2024-09-29"}
   * @returns {Promise<Object>} {filepath, filename}
   */
  async generateCover(weekRange) {
    console.log('🎨 开始生成小红书封面图片...');

    try {
      // 计算日期范围
      const dateRange = this.extractWeekDates(weekRange.identifier);

      // 生成 SVG
      const svgString = this.generateSvg(dateRange);

      // 保存文件
      await this.ensureOutputDirectory();
      const filename = `cover_${format(new Date(), 'yyyy-MM-dd_HHmm')}.png`;
      const filepath = path.join(this.outputDir, filename);

      // 使用 sharp 将 SVG 转换为 PNG
      await sharp(Buffer.from(svgString))
        .png()
        .toFile(filepath);

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
   * 生成 SVG 字符串
   */
  generateSvg(dateRange) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E8F4F8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFE8F0;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${this.width}" height="${this.height}" fill="url(#bgGradient)"/>

  <!-- 左上角葡萄 -->
  ${this.generateGrapeSvg(120, 150, 60, '#9B59B6')}

  <!-- 右下角葡萄 -->
  ${this.generateGrapeSvg(this.width - 120, this.height - 180, 70, '#8E44AD')}

  <!-- 右上角小葡萄 -->
  ${this.generateGrapeSvg(this.width - 100, 180, 40, '#A569BD')}

  <!-- 左下角小葡萄 -->
  ${this.generateGrapeSvg(100, this.height - 220, 45, '#9D4EDD')}

  <!-- 标题 -->
  <text x="${this.width / 2}" y="420" font-size="64" font-weight="bold" font-family="Arial, Helvetica" text-anchor="middle" fill="#2C3E50">
    BAY AREA
  </text>
  <text x="${this.width / 2}" y="500" font-size="64" font-weight="bold" font-family="Arial, Helvetica" text-anchor="middle" fill="#2C3E50">
    SELECTED EVENTS
  </text>

  <!-- 日期范围 -->
  <text x="${this.width / 2}" y="1100" font-size="72" font-weight="bold" font-family="Arial, Helvetica" text-anchor="middle" fill="#E74C3C">
    ${dateRange}
  </text>

  <!-- 装饰线 -->
  <line x1="${this.width / 2 - 200}" y1="1150" x2="${this.width / 2 + 200}" y2="1150" stroke="#E74C3C" stroke-width="4"/>
</svg>`;

    return svg;
  }

  /**
   * 生成葡萄 SVG
   */
  generateGrapeSvg(x, y, size, color) {
    const grapeRadius = size / 4;
    let svg = '';

    // 葡萄茎
    svg += `<line x1="${x}" y1="${y - size / 2}" x2="${x}" y2="${y - 15}" stroke="#4A7C59" stroke-width="3"/>`;

    // 葡萄叶
    svg += `<ellipse cx="${x - size / 3}" cy="${y - size / 2 - 20}" rx="${size / 5}" ry="${size / 4}" fill="#4A7C59" transform="rotate(-45 ${x - size / 3} ${y - size / 2 - 20})"/>`;
    svg += `<ellipse cx="${x + size / 3}" cy="${y - size / 2 - 20}" rx="${size / 5}" ry="${size / 4}" fill="#4A7C59" transform="rotate(45 ${x + size / 3} ${y - size / 2 - 20})"/>`;

    // 绘制葡萄球体
    const rows = 4;
    const cols = 3;
    const spacing = grapeRadius * 2.2;

    for (let row = 0; row < rows; row++) {
      const offset = (row % 2) * grapeRadius;
      for (let col = 0; col < cols; col++) {
        const gx = x - spacing + offset + col * spacing;
        const gy = y - size / 2 + row * spacing;

        // 葡萄球
        svg += `<circle cx="${gx}" cy="${gy}" r="${grapeRadius}" fill="${color}"/>`;

        // 葡萄高光
        const highlightRadius = grapeRadius / 3;
        svg += `<circle cx="${gx - grapeRadius / 3}" cy="${gy - grapeRadius / 3}" r="${highlightRadius}" fill="white" opacity="0.4"/>`;
      }
    }

    return svg;
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
