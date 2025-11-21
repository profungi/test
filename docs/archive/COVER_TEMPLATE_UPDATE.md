# 封面模板更新说明

## 📸 更新内容

**更新时间**: 2025-11-03
**文件**: `/code/assets/cover-template.jpg`

### 新模板特点

✨ **新的可爱设计**:
- 🍇 卡通葡萄角色 - 紫色葡萄束拟人化设计
- 🍾 香槟庆祝主题 - 举着香槟庆祝，充满欢乐感
- 🌟 温暖色调 - 温和的橙黄色背景
- 📝 标题区域 - "BAY AREA SELECTED EVENTS" 清晰可读

### 尺寸规格

| 属性 | 值 |
|------|-----|
| 分辨率 | 1024 × 1536 像素 |
| 宽高比 | 2:3 (小红书标准) |
| 格式 | JPG |
| 文件大小 | 259KB |

---

## 🔧 技术集成

### 现有兼容性

✅ **完全兼容现有系统**:
- `cover-generator.js` 无需修改
- 自动读取 `/code/assets/cover-template.jpg`
- 在模板上覆盖日期显示
- 保存为PNG格式

### 日期显示配置

**当前配置**:
```javascript
// 日期样式
font-size: 95px;           // 字体大小
font-weight: 900;          // 字体粗度 (超粗)
color: #2D2416;            // 颜色 (深棕色)
top: 550px;                // 距离顶部位置
letter-spacing: -1px;      // 字距调整
```

**日期格式**:
```
M/d - M/d
示例: 11/4 - 11/8
```

---

## 🚀 使用方法

### 1. 自动生成封面

运行正常的生成命令，封面会自动生成:

```bash
npm run generate-post ./output/review_2025-11-04_1530.json
```

**输出**:
```
🎨 开始生成小红书封面图片...
✅ 封面图片已生成: ./output/covers/cover_2025-11-04_153025_123.png
```

### 2. 查看生成的封面

```bash
# 列出所有生成的封面
ls -lh ./output/covers/

# 或在文件管理器中打开
open ./output/covers/
```

---

## 📝 生成流程

```
1. 读取模板: /code/assets/cover-template.jpg
       ↓
2. 计算日期范围 (周三到周日)
       ↓
3. 生成HTML (模板 + 日期覆盖)
       ↓
4. Puppeteer 渲染
       ↓
5. 保存为PNG: ./output/covers/cover_YYYY-MM-DD_HHmmss_ms.png
```

---

## 🎨 可自定义选项

### 如果需要调整日期位置和样式

编辑 `/code/src/utils/cover-generator.js`:

```javascript
// 日期位置 (像素)
.date-overlay {
  top: 550px;  // ← 修改这里向上/向下移动
}

// 日期大小
.date {
  font-size: 95px;  // ← 修改这里调整大小
  color: #2D2416;   // ← 修改这里改变颜色
}
```

### 日期位置参考

| 位置 | top值 |
|------|-------|
| 靠近标题 | 300px |
| 中间偏上 | 450px |
| **当前位置** | **550px** |
| 中间偏下 | 650px |
| 靠近底部 | 800px |

---

## 📊 对比

### 旧模板 (葡萄卡通人物)

- 拟人化的单个葡萄
- 动态的跳跃姿态
- 中性色调

### 新模板 (葡萄庆祝主题)

- 🍇 葡萄束 + 🍾 香槟
- 庆祝欢乐主题
- 温暖的橙黄色
- **更适合活动推荐场景**

---

## ✅ 验证步骤

### 1. 检查文件

```bash
ls -lh /code/assets/cover-template.jpg
# 应该显示: 259K (或接近的大小)
```

### 2. 生成测试封面

```bash
npm run generate-post ./output/review_2025-10-30_0630.json
```

### 3. 查看生成的封面

```bash
# 在输出目录中找到 cover_*.png 文件
ls -lh ./output/covers/
```

### 4. 验证外观

- ✅ 模板图片清晰可见
- ✅ 日期显示在合适位置
- ✅ 日期颜色深棕色，易于阅读
- ✅ 整体布局美观

---

## 💡 最佳实践

### 发布到小红书

1. **生成封面**
   ```bash
   npm run generate-post [review_file]
   ```

2. **选择封面**
   - 打开 `./output/covers/`
   - 选择最新生成的 `cover_*.png`

3. **上传小红书**
   - 小红书宽高比: 2:3 ✅ 完美匹配
   - 分辨率: 1024×1536 ✅ 高清显示
   - 文件格式: PNG ✅ 透明支持

### 多张封面选择

系统每次生成多张变体(如果有多个周期)，可以选择最满意的一张。

---

## 🐛 故障排除

### 问题1: 封面未生成

**症状**: 没有看到 `✅ 封面图片已生成` 信息

**解决**:
1. 检查 Puppeteer 是否正确安装
   ```bash
   npm list puppeteer
   ```

2. 检查文件权限
   ```bash
   chmod 755 ./output/covers/
   ```

3. 查看详细错误
   ```bash
   npm run generate-post [file] 2>&1 | grep -i "error\|failed"
   ```

### 问题2: 日期位置不对

**解决**:
编辑 `/code/src/utils/cover-generator.js` 中的 `top` 值
- 向上移动: 减小 `top` 值
- 向下移动: 增大 `top` 值

### 问题3: 日期看不清

**解决**:
调整字体大小或颜色:
```javascript
.date {
  font-size: 110px;  // 改大
  color: #000000;    // 改黑色
}
```

---

## 📈 改进建议

未来可能的增强:

1. **多模板支持**
   - 季节性模板
   - 主题变化

2. **动态文字**
   - 活动数量显示
   - 周数显示

3. **水印功能**
   - 账号名称
   - 二维码

4. **批量生成**
   - 自动生成多个变体
   - AI智能选择最佳设计

---

## 📞 支持

有任何问题或建议?

1. 检查 `cover-generator.js` 的注释和代码
2. 查看 `README.md` 的封面相关章节
3. 参考 `TESTING_COVER_GENERATOR.md` 的测试指南

---

**最后更新**: 2025-11-03
**模板版本**: v2.0 (新设计)
**兼容版本**: v1.0+ (所有版本兼容)

✨ 享受新的可爱封面设计！
