# 封面图片生成器测试指南

## 🧪 测试方法

### 方法 1: 独立测试（推荐，最简单）

运行独立测试脚本，无需任何准备工作：

```bash
npm run test-cover
```

这个命令会：
- ✅ 生成 3 个测试封面图片
- ✅ 测试不同日期范围的计算
- ✅ 验证葡萄装饰元素
- ✅ 确认文件保存到正确位置

生成的文件位置：
```
output/covers/
├── cover_2024-10-30_XXXX.png  （测试案例 1）
├── cover_2024-10-30_XXXX.png  （测试案例 2）
└── cover_2024-10-30_XXXX.png  （测试案例 3）
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
- 📄 文本内容文件
- 📊 元数据文件
- 🎨 **封面图片**（在 output/covers/ 目录）

## 📋 检查生成的图片

生成后，查看图片：

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

- [ ] 尺寸为 1024x1536 像素（2:3 比例）
- [ ] 标题 "BAY AREA SELECTED EVENTS" 居中显示
- [ ] 日期范围格式正确（如 "11/5 - 11/9"）
- [ ] 四个角落有葡萄装饰元素
- [ ] 葡萄包含茎、叶片和球体
- [ ] 背景是浅蓝到浅粉的渐变
- [ ] 整体风格简洁卡通

## 🐛 故障排除

### 错误：找不到 canvas 模块

解决方案：安装依赖
```bash
npm install
```

### 错误：无法创建目录

解决方案：确保有写入权限
```bash
mkdir -p output/covers
chmod 755 output/covers
```

### 生成的图片打不开

可能原因：
1. canvas 库安装不完整（重新运行 `npm install`）
2. 系统缺少图形库依赖（参考 canvas 文档安装系统依赖）

## 📸 预期效果

封面图片特点：
- **风格**：简洁卡通
- **配色**：明亮活泼（浅蓝、浅粉背景，紫色葡萄）
- **布局**：标题在上方，日期在中下方，葡萄装饰在四角
- **文件大小**：约 50-100KB

## 🎨 自定义设计

如需调整设计，编辑文件：
```
src/utils/cover-generator.js
```

可以修改：
- 背景颜色和渐变
- 葡萄的位置和大小
- 字体和文字颜色
- 装饰元素的样式
