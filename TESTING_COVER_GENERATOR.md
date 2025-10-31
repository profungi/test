# 小红书封面图片生成器

## 📱 功能介绍

自动生成小红书风格的封面图片，包含：
- 🍇 可爱的葡萄卡通人物（举着香槟杯庆祝）
- 📅 动态日期范围（自动计算周三到周日）
- 🎨 专业的设计样式
- 📏 标准尺寸：1024×1536 像素（2:3 比例）

## 🧪 测试方法

### 方法 1: 独立测试（推荐）

运行独立测试脚本，无需任何准备工作：

```bash
npm run test-cover
```

这个命令会：
- ✅ 生成 3 个测试封面图片
- ✅ 测试不同日期范围的计算
- ✅ 验证图片正确显示
- ✅ 确认文件保存到正确位置

生成的文件位置：
```
output/covers/
├── cover_2024-10-30_XXXX.png  （测试案例 1 - 11/6 - 11/10）
├── cover_2024-10-30_XXXX.png  （测试案例 2 - 9/18 - 9/22）
└── cover_2024-10-30_XXXX.png  （测试案例 3 - 1/1 - 1/5）
```

### 方法 2: 完整流程测试

如果你有完整的审核文件，可以测试整个发布流程：

```bash
# 1. 首先运行爬虫获取活动数据
npm run scrape

# 2. 人工审核活动（编辑生成的 review_*.json 文件，设置 selected: true）
# 文件位于 output/review_*.json

# 3. 生成最终内容（包括封面图片）
npm run generate-post output/review_XXXX.json
```

这会同时生成：
- 📄 文本内容文件：`output/weekly_events_YYYY-MM-DD_HHmm.txt`
- 📊 元数据文件：`output/weekly_events_YYYY-MM-DD_HHmm_metadata.json`
- 🎨 **封面图片**：`output/covers/cover_YYYY-MM-DD_HHmm_ms.png`

## 📋 查看生成的图片

```bash
# 查看生成的文件
ls -lh output/covers/

# 使用系统图片查看器打开（根据你的系统选择）
# macOS
open output/covers/cover_*.png

# Linux
xdg-open output/covers/cover_*.png

# Windows
start output/covers/cover_*.png
```

## ✅ 验证清单

生成的封面图片应该包含：

- [x] 尺寸为 1024x1536 像素（2:3 比例）
- [x] 标题 "BAY AREA SELECTED EVENTS" 在顶部
- [x] 日期范围（如 "11/5 - 11/9"）在中间下方，字体大（95px）
- [x] 可爱的葡萄卡通人物（紫色葡萄球组成）
- [x] 葡萄拿着香槟杯（黄色液体）
- [x] 绿色叶子和棕色茎
- [x] 橙色/黄色温暖背景
- [x] 整体风格简洁卡通

## 🐛 故障排除

### 生成的图片是黑色的

**原因**：模板图片没有正确加载

**解决方案**：
```bash
# 确保模板文件存在
ls -l assets/cover-template.jpg

# 如果文件不存在，重新复制
cp /path/to/template.jpg assets/cover-template.jpg
```

### 日期显示有重叠

**原因**：日期位置或字体大小需要调整

**解决方案**：编辑 `src/utils/cover-generator.js`
```javascript
// 调整日期位置（修改 top 值）
.date-overlay {
  top: 550px;  // 可以调整这个值
}

// 调整日期字体大小（修改 font-size 值）
.date {
  font-size: 95px;  // 可以调整这个值
}
```

### 错误：无法创建目录

解决方案：确保有写入权限
```bash
mkdir -p output/covers
chmod 755 output/covers
```

## 📸 设计细节

### 日期计算逻辑
- **输入**：周范围（例如："2024-11-04_to_2024-11-10"）
- **输出**：周三到周日的日期（例如："11/6 - 11/10"）
- 自动处理月份边界和跨年情况

### 文件命名规则
```
cover_YYYY-MM-DD_HHmmss_ms.png
```
- `YYYY-MM-DD_HHmmss`：生成时间
- `ms`：毫秒级唯一标识符，防止文件覆盖

### 设计特点
- **图片来源**：使用 `assets/cover-template.jpg` 作为模板
- **覆盖层**：只在模板上叠加动态日期文字
- **渲染方式**：Puppeteer 浏览器渲染 + PNG 截图
- **文件格式**：PNG，质量高，文件大小合理

## 🎨 自定义设计

### 替换模板图片

如果想使用不同的设计：

```bash
# 1. 准备新的模板图片（1024×1536 像素）
# 2. 替换现有文件
cp /path/to/new-template.jpg assets/cover-template.jpg
# 3. 重新生成（无需修改代码）
npm run test-cover
```

### 调整日期样式

编辑 `src/utils/cover-generator.js` 中的 CSS：

```css
.date {
  font-size: 95px;        /* 字体大小 */
  font-weight: 900;       /* 字体粗细 */
  color: #2D2416;         /* 字体颜色 */
  letter-spacing: -1px;   /* 字间距 */
}

.date-overlay {
  top: 550px;             /* 距离顶部的距离 */
}
```

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| `src/utils/cover-generator.js` | 封面生成器核心逻辑 |
| `assets/cover-template.jpg` | 封面模板图片 |
| `test-cover-generator.js` | 独立测试脚本 |
| `src/formatters/post-generator.js` | 调用封面生成器的主流程 |

## 🚀 工作流程

```
周范围数据
    ↓
[CoverGenerator]
    ↓
读取模板图片 (base64)
    ↓
计算日期范围 (周三-周日)
    ↓
生成 HTML (Puppeteer)
    ↓
截图为 PNG
    ↓
保存到 output/covers/
```

## ⚡ 性能

- **生成速度**：< 2 秒/张
- **文件大小**：约 100-150KB
- **内存占用**：Puppeteer 浏览器进程管理

## 📝 日志输出示例

```
🎨 开始生成小红书封面图片...
✅ 封面图片已生成: /code/output/covers/cover_2024-10-30_235959_123.png
```
