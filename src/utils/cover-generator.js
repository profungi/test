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

      // 使用微秒级时间戳确保文件名唯一
      const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
      const uniqueId = Date.now() % 1000; // 添加毫秒级唯一性
      const filename = `cover_${timestamp}_${uniqueId}.png`;
      const filepath = path.join(this.outputDir, filename);

      // 使用 sharp 将 SVG 转换为 PNG，设置密度以提高清晰度
      await sharp(Buffer.from(svgString), { density: 150 })
        .png({ quality: 90 })
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
      <stop offset="0%" style="stop-color:#FFF5F7;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FFE8F0;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F0E8FF;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="${this.width}" height="${this.height}" fill="url(#bgGradient)"/>

  <!-- 装饰圆形背景 -->
  <circle cx="150" cy="200" r="120" fill="#D8B4FF" opacity="0.3"/>
  <circle cx="${this.width - 150}" cy="${this.height - 200}" r="140" fill="#B8E0FF" opacity="0.25"/>

  <!-- 左上角葡萄（更大） -->
  ${this.generateGrapeSvg(140, 180, 80, '#9D4EDD')}

  <!-- 右下角葡萄（更大） -->
  ${this.generateGrapeSvg(this.width - 140, this.height - 220, 95, '#7B2CBF')}

  <!-- 右上角葡萄 -->
  ${this.generateGrapeSvg(this.width - 120, 220, 60, '#C77DFF')}

  <!-- 左下角葡萄 -->
  ${this.generateGrapeSvg(120, this.height - 240, 70, '#A569BD')}

  <!-- 标题背景 -->
  <rect x="100" y="350" width="${this.width - 200}" height="280" fill="white" opacity="0.4" rx="20"/>

  <!-- 标题 -->
  <text x="${this.width / 2}" y="420" font-size="72" font-weight="900" font-family="Arial, sans-serif" text-anchor="middle" fill="#6A0DAD" letter-spacing="2">
    BAY AREA
  </text>
  <text x="${this.width / 2}" y="510" font-size="62" font-weight="900" font-family="Arial, sans-serif" text-anchor="middle" fill="#6A0DAD" letter-spacing="1">
    SELECTED EVENTS
  </text>

  <!-- 日期范围背景 -->
  <rect x="150" y="1050" width="${this.width - 300}" height="140" fill="#FF6B9D" rx="15" opacity="0.95" filter="url(#shadow)"/>

  <!-- 日期范围文字 -->
  <text x="${this.width / 2}" y="1140" font-size="80" font-weight="900" font-family="Arial, sans-serif" text-anchor="middle" fill="white" letter-spacing="1">
    ${dateRange}
  </text>

  <!-- 底部装饰 -->
  <circle cx="200" cy="${this.height - 100}" r="25" fill="#C77DFF" opacity="0.4"/>
  <circle cx="${this.width - 200}" cy="${this.height - 120}" r="30" fill="#9D4EDD" opacity="0.3"/>
</svg>`;

    return svg;
  }

  /**
   * 生成葡萄 SVG
   */
  generateGrapeSvg(x, y, size, color) {
    const grapeRadius = size / 3.5; // 更大的葡萄
    let svg = '';

    // 葡萄茎（更粗）
    svg += `<line x1="${x}" y1="${y - size / 2 - 10}" x2="${x}" y2="${y - 20}" stroke="#6B8E23" stroke-width="5" stroke-linecap="round"/>`;

    // 葡萄叶（更大更绿）
    svg += `<ellipse cx="${x - size / 3 - 15}" cy="${y - size / 2 - 30}" rx="${size / 4}" ry="${size / 3}" fill="#7BC542" transform="rotate(-35 ${x - size / 3 - 15} ${y - size / 2 - 30})"/>`;
    svg += `<ellipse cx="${x + size / 3 + 15}" cy="${y - size / 2 - 30}" rx="${size / 4}" ry="${size / 3}" fill="#7BC542" transform="rotate(35 ${x + size / 3 + 15} ${y - size / 2 - 30})"/>`;

    // 绘制葡萄球体（更多排）
    const rows = 5;
    const cols = 4;
    const spacing = grapeRadius * 2;

    for (let row = 0; row < rows; row++) {
      const offset = (row % 2) * grapeRadius;
      const colsInRow = row === 0 ? 2 : (row === rows - 1 ? 2 : cols);
      const rowStartCol = row === 0 ? 1 : (row === rows - 1 ? 1 : 0);

      for (let col = 0; col < colsInRow; col++) {
        const gx = x - (cols - 1) * spacing / 2 + offset + (rowStartCol + col) * spacing;
        const gy = y - size / 2 + row * spacing;

        // 葡萄球（加阴影）
        svg += `<circle cx="${gx}" cy="${gy}" r="${grapeRadius}" fill="${color}" filter="url(#shadow)"/>`;

        // 葡萄外圈高光
        svg += `<circle cx="${gx}" cy="${gy}" r="${grapeRadius}" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>`;

        // 葡萄高光（更大更亮）
        const highlightRadius = grapeRadius * 0.45;
        svg += `<circle cx="${gx - grapeRadius * 0.35}" cy="${gy - grapeRadius * 0.35}" r="${highlightRadius}" fill="white" opacity="0.65"/>`;

        // 更小的高光
        const smallHighlight = grapeRadius * 0.2;
        svg += `<circle cx="${gx + grapeRadius * 0.2}" cy="${gy - grapeRadius * 0.5}" r="${smallHighlight}" fill="white" opacity="0.5"/>`;
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
