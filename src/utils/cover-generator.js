const { createCanvas } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const { format, parse } = require('date-fns');

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

      // 创建canvas
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext('2d');

      // 绘制背景和装饰
      this.drawBackground(ctx);
      this.drawGrapeDecorations(ctx);
      this.drawTitle(ctx);
      this.drawDateRange(ctx, dateRange);

      // 保存文件
      await this.ensureOutputDirectory();
      const filename = `cover_${format(new Date(), 'yyyy-MM-dd_HHmm')}.png`;
      const filepath = path.join(this.outputDir, filename);

      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(filepath, buffer);

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
   * 绘制背景（渐变色）
   */
  drawBackground(ctx) {
    // 创建渐变背景：浅蓝到浅粉
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#E8F4F8');    // 浅蓝
    gradient.addColorStop(1, '#FFE8F0');    // 浅粉

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * 绘制葡萄装饰元素
   */
  drawGrapeDecorations(ctx) {
    // 左上角葡萄
    this.drawGrapeCluster(ctx, 120, 150, 60, '#9B59B6');

    // 右下角葡萄
    this.drawGrapeCluster(ctx, this.width - 120, this.height - 180, 70, '#8E44AD');

    // 右上角小葡萄
    this.drawGrapeCluster(ctx, this.width - 100, 180, 40, '#A569BD');

    // 左下角小葡萄
    this.drawGrapeCluster(ctx, 100, this.height - 220, 45, '#9D4EDD');
  }

  /**
   * 绘制葡萄串
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - 中心X坐标
   * @param {number} y - 中心Y坐标
   * @param {number} size - 葡萄串大小
   * @param {string} color - 葡萄颜色
   */
  drawGrapeCluster(ctx, x, y, size, color) {
    const grapeRadius = size / 4;

    // 葡萄茎
    ctx.strokeStyle = '#4A7C59';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y - 15);
    ctx.stroke();

    // 葡萄叶（简化的叶子）
    ctx.fillStyle = '#4A7C59';
    ctx.beginPath();
    ctx.ellipse(x - size / 3, y - size / 2 - 20, size / 5, size / 4, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x + size / 3, y - size / 2 - 20, size / 5, size / 4, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

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
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(gx, gy, grapeRadius, 0, Math.PI * 2);
        ctx.fill();

        // 葡萄高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(gx - grapeRadius / 3, gy - grapeRadius / 3, grapeRadius / 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 绘制标题
   */
  drawTitle(ctx) {
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 64px Arial, Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const titleY = 400;
    const lineHeight = 80;

    // 绘制标题，分两行
    ctx.fillText('BAY AREA', this.width / 2, titleY);
    ctx.fillText('SELECTED EVENTS', this.width / 2, titleY + lineHeight);
  }

  /**
   * 绘制日期范围
   */
  drawDateRange(ctx, dateRange) {
    ctx.fillStyle = '#E74C3C';
    ctx.font = 'bold 72px Arial, Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(dateRange, this.width / 2, 1100);

    // 添加装饰线
    const lineY = 1150;
    const lineWidth = 200;
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(this.width / 2 - lineWidth, lineY);
    ctx.lineTo(this.width / 2 + lineWidth, lineY);
    ctx.stroke();
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
