# 重复发布处理功能

## 概述

现在系统会检测同一周的重复发布，并提供三个选项：覆盖旧记录、创建新版本、或取消操作。

## 问题背景

用户反馈：
> "我已经跑了一次让系统生成最后版本，我如果再生成一次的话，希望可以覆盖之前的最后版本。目前是这样设定的吗？"

**原问题：**
- 每次运行都创建新记录
- 同一周可能有多条发布记录
- 数据重复，反馈分析时混淆

## 解决方案

### 新流程

当你再次为同一周生成帖子时，系统会：

1. **检测已有记录**
2. **显示现有记录详情**
3. **提供三个选项**：
   - [1] 覆盖最新的记录
   - [2] 创建新版本
   - [3] 取消，不保存

### 实际使用示例

```bash
npm run generate-post

# ... 生成内容、编辑、确认 ...

# 如果该周已有发布记录：

⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️
检测到该周 (2025-11-09_to_2025-11-15) 已有 1 条发布记录:
  1. post_2025-11-07T09-30 (发布于 2025-11-7 09:30:00)
     活动数: 5, 编辑: 是
⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️

请选择操作:
  [1] 覆盖最新的记录（删除旧记录，保存新记录）
  [2] 创建新版本（保留旧记录，添加新记录）
  [3] 取消，不保存

请选择 [1/2/3]:
```

## 三个选项详解

### 选项1：覆盖最新的记录 ✅ 推荐

**什么时候用：**
- 你修正了之前生成的内容
- 你要用新的版本替换旧的
- 你不需要保留旧记录

**会发生什么：**
```bash
请选择 [1/2/3]: 1

🗑️  删除旧记录: post_2025-11-07T09-30
✅ 旧记录已删除

📊 发布记录已创建:
   Post ID: post_2025-11-07T10-15
   总计: 6 个活动
   内容状态: 已编辑
```

**结果：**
- ❌ 删除 `post_2025-11-07T09-30`（及其所有活动记录）
- ✅ 创建 `post_2025-11-07T10-15`（新的记录）
- 数据库中该周只有一条记录

**数据库影响：**
```sql
-- 删除前
SELECT * FROM posts WHERE week_identifier = '2025-11-09_to_2025-11-15';
-- post_2025-11-07T09-30 (5个活动)

-- 删除后
SELECT * FROM posts WHERE week_identifier = '2025-11-09_to_2025-11-15';
-- post_2025-11-07T10-15 (6个活动)  ← 新记录
```

---

### 选项2：创建新版本

**什么时候用：**
- 你想保留旧版本做对比
- 你在测试不同的内容
- 你想看多个版本的反馈效果

**会发生什么：**
```bash
请选择 [1/2/3]: 2

📝 创建新版本（保留旧记录）

📊 发布记录已创建:
   Post ID: post_2025-11-07T10-15
   总计: 6 个活动
   内容状态: 已编辑
```

**结果：**
- ✅ 保留 `post_2025-11-07T09-30`
- ✅ 创建 `post_2025-11-07T10-15`
- 数据库中该周有两条记录

**数据库影响：**
```sql
SELECT * FROM posts WHERE week_identifier = '2025-11-09_to_2025-11-15';
-- post_2025-11-07T09-30 (5个活动)  ← 保留
-- post_2025-11-07T10-15 (6个活动)  ← 新增
```

**注意：**
- 两条记录会在反馈分析时都被包含
- 需要手动指定使用哪个版本收集反馈

---

### 选项3：取消，不保存

**什么时候用：**
- 你不确定要用新版本
- 你想先看看生成的内容
- 你发现选错了活动

**会发生什么：**
```bash
请选择 [1/2/3]: 3

❌ 已取消，未保存发布记录
📄 发布内容文件仍然已生成: /code/output/weekly_events_2025-11-07_1015.txt

✨ 内容生成完成！
```

**结果：**
- ❌ 不保存任何数据库记录
- ✅ 输出文件仍然生成（你可以查看内容）
- ✅ 旧记录保持不变

**使用场景：**
- 你想先看看生成的内容质量
- 确认满意后，再重新运行一次选择[1]覆盖

---

## 技术实现

### 数据库方法

**新增到 `/code/src/feedback/performance-database.js`：**

#### 1. 查询某周的所有发布记录

```javascript
async getPostsByWeek(weekIdentifier) {
  const sql = `
    SELECT * FROM posts
    WHERE week_identifier = ?
    ORDER BY published_at DESC
  `;
  return await this.all(sql, [weekIdentifier]);
}
```

**用法：**
```javascript
const existingPosts = await db.getPostsByWeek('2025-11-09_to_2025-11-15');
// 返回该周的所有发布记录，最新的在前
```

#### 2. 删除发布记录（级联删除）

```javascript
async deletePost(postId) {
  // 先删除活动表现记录
  await this.run('DELETE FROM event_performance WHERE post_id = ?', [postId]);

  // 再删除发布记录
  await this.run('DELETE FROM posts WHERE post_id = ?', [postId]);
}
```

**用法：**
```javascript
await db.deletePost('post_2025-11-07T09-30');
// 同时删除:
// - posts 表中的记录
// - event_performance 表中该 post_id 的所有活动记录
```

### 主流程集成

**在 `/code/src/generate-post.js` 的第9步：**

```javascript
// 9. 检查是否已有该周的发布记录并选择覆盖或创建新版本
await this.performanceDB.connect();
await this.performanceDB.initializeFeedbackTables();

const existingPosts = await this.performanceDB.getPostsByWeek(weekRange.identifier);

if (existingPosts.length > 0) {
  // 显示现有记录
  console.log(`检测到该周 (${weekRange.identifier}) 已有 ${existingPosts.length} 条发布记录:`);
  existingPosts.forEach((post, index) => {
    console.log(`  ${index + 1}. ${post.post_id} (发布于 ${new Date(post.published_at).toLocaleString('zh-CN')})`);
    console.log(`     活动数: ${post.total_events}, 编辑: ${post.content_modified ? '是' : '否'}`);
  });

  // 提供选择
  console.log('\n请选择操作:');
  console.log('  [1] 覆盖最新的记录（删除旧记录，保存新记录）');
  console.log('  [2] 创建新版本（保留旧记录，添加新记录）');
  console.log('  [3] 取消，不保存');

  const choice = await getInput();

  if (choice === '3') {
    // 取消
    await this.performanceDB.close();
    return;
  } else if (choice === '1') {
    // 覆盖：删除最新的记录
    const latestPost = existingPosts[0];
    await this.performanceDB.deletePost(latestPost.post_id);
  } else if (choice === '2') {
    // 创建新版本：什么都不做
  }
}

// 10. 保存发布记录到数据库
const postId = await this.savePublicationRecord(...);
```

## 使用建议

### 推荐做法

1. **首次生成**：正常生成，会直接保存

2. **修正错误**：
   - 如果发现内容有错误
   - 重新运行 `npm run generate-post`
   - 选择 **[1] 覆盖**

3. **A/B测试**：
   - 如果想测试不同版本的效果
   - 重新运行生成不同的内容
   - 选择 **[2] 创建新版本**
   - 分别发布并收集反馈
   - 对比两个版本的表现

4. **预览内容**：
   - 如果只是想看看生成的效果
   - 选择 **[3] 取消**
   - 查看输出文件
   - 满意后重新运行选择[1]

### 注意事项

#### 关于选项1（覆盖）

⚠️ **警告：** 覆盖会永久删除旧记录和相关数据

**删除的内容：**
- ❌ 旧的 `posts` 记录
- ❌ 旧的 `event_performance` 记录（所有活动）
- ❌ 如果已收集反馈，反馈数据也会丢失

**何时可以安全覆盖：**
- ✅ 旧记录刚生成，还没发布
- ✅ 旧记录有错误，需要修正
- ✅ 还没收集反馈数据

**何时不应该覆盖：**
- ❌ 旧记录已经发布到小红书
- ❌ 已经收集了反馈数据
- ❌ 想保留多个版本对比

#### 关于选项2（创建新版本）

📝 **结果：** 该周会有多条记录

**适用场景：**
- A/B测试不同内容
- 保留历史版本
- 对比分析

**需要注意：**
- 收集反馈时需要指定具体的 `post_id`
- 数据分析时注意区分不同版本

#### 关于选项3（取消）

💡 **提示：** 文件仍然生成，只是不保存数据库记录

**输出文件位置：**
```
/code/output/weekly_events_2025-11-07_1015.txt
/code/output/weekly_events_2025-11-07_1015_metadata.json
/code/assets/covers/cover_2025-11-09_to_2025-11-15.png
```

## 数据库查询示例

### 查看某周的所有版本

```sql
SELECT
  post_id,
  published_at,
  total_events,
  content_modified,
  manual_events_added
FROM posts
WHERE week_identifier = '2025-11-09_to_2025-11-15'
ORDER BY published_at DESC;
```

### 对比两个版本的活动

```sql
-- 版本1的活动
SELECT event_title, event_type, location
FROM event_performance
WHERE post_id = 'post_2025-11-07T09-30';

-- 版本2的活动
SELECT event_title, event_type, location
FROM event_performance
WHERE post_id = 'post_2025-11-07T10-15';
```

### 查看哪些周有多个版本

```sql
SELECT
  week_identifier,
  COUNT(*) as version_count,
  GROUP_CONCAT(post_id) as post_ids
FROM posts
GROUP BY week_identifier
HAVING COUNT(*) > 1
ORDER BY published_at DESC;
```

## 相关文件

- `/code/src/feedback/performance-database.js` - 数据库操作（新增方法）
- `/code/src/generate-post.js` - 主流程（检测和选择逻辑）
- `/code/DUPLICATE_POST_HANDLING.md` - 本文档

## 总结

现在系统会：
✅ 检测同一周的重复发布
✅ 提供覆盖/创建新版本/取消三个选项
✅ 级联删除相关的活动记录
✅ 保持数据一致性

**推荐使用：选项1（覆盖）** - 对于大部分场景来说是最合适的选择。
