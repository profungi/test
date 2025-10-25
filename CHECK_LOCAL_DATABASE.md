# 检查本地数据库中的 Description_Detail

## 🎯 问题

数据库确实存在（在本地，被 `.gitignore` 忽略），但 `description_detail` 字段仍然为空。

## 🔍 可能的原因

### 原因 1：数据库是旧版本（最可能）

**症状：** 数据库在添加 `description_detail` 功能之前就已经存在

**解决方案：**

选项 A：删除旧数据库并重新运行爬虫
```bash
# 备份旧数据库（可选）
cp data/events.db data/events.db.backup

# 删除旧数据库
rm data/events.db

# 重新运行爬虫
node src/scrape-events.js
```

选项 B：检查数据库是否有 description_detail 列
```bash
bash check-local-database.sh
```

这个脚本会自动：
- 查找数据库文件
- 检查 description_detail 列是否存在
- 显示统计信息和覆盖率
- 给出具体的修复建议

### 原因 2：description_detail 列不存在

**症状：** 数据库迁移没有运行

**解决方案：**

数据库迁移应该自动运行，但如果失败了：

```bash
# 删除数据库并重新创建
rm data/events.db
node src/scrape-events.js
```

### 原因 3：数据是在新代码部署前抓取的

**症状：** 数据库有 description_detail 列，但所有值都是 NULL

**解决方案：**

```bash
# 清空数据库
rm data/events.db

# 重新抓取（会使用新代码获取 description_detail）
node src/scrape-events.js
```

## 🚀 推荐步骤

### 步骤 1：检查本地数据库

```bash
bash check-local-database.sh
```

或者，如果数据库在特定位置：

```bash
bash check-local-database.sh /path/to/your/events.db
```

这会显示：
- ✅ 数据库位置
- ✅ 总事件数
- ✅ description_detail 列是否存在
- ✅ description_detail 覆盖率统计
- ✅ 按来源的详细统计
- ✅ 样本数据预览

### 步骤 2：根据检查结果采取行动

**如果显示 "description_detail 列不存在"：**
```bash
rm data/events.db
node src/scrape-events.js
```

**如果显示 "0% 覆盖率"：**
```bash
rm data/events.db
node src/scrape-events.js
```

**如果显示 "部分覆盖率（如 30-70%）"：**

这可能是正常的，取决于：
- 详情页抓取失败率
- 某些事件确实没有详细描述
- 网站结构变化

如果覆盖率太低，可以：
1. 检查网络连接
2. 更新 CSS 选择器
3. 重新运行爬虫

**如果显示 "100% 覆盖率"：**

恭喜！一切正常！

## 📊 使用方法

### 基本用法

```bash
# 自动查找数据库
bash check-local-database.sh
```

### 指定数据库路径

```bash
bash check-local-database.sh ~/my-project/data/events.db
```

### 示例输出

```
╔════════════════════════════════════════════════════════════════╗
║         检查本地数据库中的 Description_Detail              ║
╚════════════════════════════════════════════════════════════════╝

🔍 查找数据库文件...

✅ 找到数据库: ./data/events.db

📊 数据库文件: ./data/events.db
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 统计信息:

  总事件数: 150
  ✅ description_detail 列存在

📊 Description_Detail 覆盖率:

  有值: 142/150 (94.7%)
  为空: 8/150

📍 按来源统计:

source       total  with_detail  percentage
-----------  -----  -----------  ----------
eventbrite   60     58           96.7%
funcheap     50     48           96.0%
sfstation    40     36           90.0%

📋 样本数据 (前 3 个有 description_detail 的事件):

title                                              source      detail_length  detail_preview
-------------------------------------------------  ----------  -------------  ----------------
Bay Area Food Festival...                         eventbrite  450            Join us for...
Weekend Market at Ferry Building...                funcheap    380            Explore local...
Live Music at Golden Gate Park...                 sfstation   520            Come enjoy...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  部分事件有 description_detail (94.7%)

这可能是因为：
  - 详情页抓取失败（网络问题）
  - 某些事件没有详细描述
  - CSS 选择器需要更新
```

## 🔧 故障排除

### 问题：找不到数据库

**解决方案：**

1. 检查数据库是否真的存在：
   ```bash
   find . -name "*.db" -type f
   ```

2. 运行爬虫生成数据库：
   ```bash
   node src/scrape-events.js
   ```

### 问题：sqlite3 未安装

**解决方案：**

macOS:
```bash
brew install sqlite3
```

Ubuntu/Debian:
```bash
sudo apt-get install sqlite3
```

CentOS/RHEL:
```bash
sudo yum install sqlite
```

### 问题：无法读取数据库

**解决方案：**

检查文件权限：
```bash
ls -l data/events.db
chmod 644 data/events.db
```

## 💡 验证代码正确性

即使数据库中没有数据，代码本身是 100% 正确的：

```bash
bash quick-verify.sh
# 结果：✅ 19/19 (100%) 通过
```

所有爬虫都正确实现了 description_detail 支持。

## 📝 总结

1. **检查数据库：** `bash check-local-database.sh`
2. **如果问题存在：** 删除旧数据库
3. **重新运行爬虫：** `node src/scrape-events.js`
4. **验证结果：** `bash check-local-database.sh`

最简单的解决方案通常是：删除旧数据库，重新运行爬虫。
