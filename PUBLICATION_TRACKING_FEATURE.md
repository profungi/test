# 发布内容追踪功能 (v1.6)

## 概述

实现了发布前确认和编辑功能，允许在生成帖子后、保存到数据库前进行内容编辑和手动添加新活动。同时记录生成内容和实际发布内容，以便后续追踪反馈效果。

## 实现时间

2025-11-07

## 问题背景

用户提出了两个核心需求：

1. **追踪实际发布内容**：系统生成内容后，用户可能在小红书发布时进行修改和删减，需要记录实际发布的内容以便准确追踪反馈效果。

2. **发布时添加新活动**：用户在编辑时可能想添加新的活动（如朋友推荐的活动），需要能够输入URL、抓取信息、生成短链接并记录到数据库。

## 解决方案

### 方案特点

- **发布前确认环节**：在生成内容后添加确认步骤，允许用户选择直接发布或编辑后发布
- **内容编辑**：支持在文本编辑器中修改帖子内容
- **手动添加新活动**：编辑后主动询问是否添加新活动（不做自动检测）
- **完整追踪**：同时保存生成内容和发布内容，标记是否被编辑
- **方案A实现**：允许编辑但不强制匹配，简单实用

### 新增字段

#### posts 表

```sql
-- v1.6: 发布内容追踪字段
generated_content TEXT           -- AI生成的原始内容
published_content TEXT           -- 实际发布的内容（可能经过编辑）
content_modified INTEGER         -- 是否被编辑过 (0/1)
manual_events_added INTEGER      -- 发布时手动添加的活动数量
```

#### event_performance 表

```sql
-- v1.6: 标记发布时手动添加的活动
manually_added_at_publish INTEGER  -- 是否在发布时手动添加 (0/1)
```

## 使用流程

### 1. 运行 generate-post

```bash
npm run generate-post
```

### 2. 内容生成后的确认环节

系统会显示生成的内容预览：

```
==================================================
📱 最终发布内容预览
==================================================
[显示生成的帖子内容]
==================================================
📏 字符总数: 856
📊 活动数量: 3 个
==================================================

📋 请选择下一步操作:
  [1] 直接使用此内容发布
  [2] 编辑内容后发布
  [3] 取消，不保存记录

请选择 [1/2/3]:
```

### 3. 选项说明

#### 选项1: 直接使用此内容发布

- 跳过编辑，直接保存到数据库
- `generated_content` 和 `published_content` 内容相同
- `content_modified = false`

#### 选项2: 编辑内容后发布

**步骤1：选择编辑方式**

系统会提供5种编辑方式供你选择：

```
📝 请选择编辑方式:

  [1] 保存到文件，我手动编辑（推荐）
  [2] 直接粘贴编辑后的内容
  [3] 使用系统默认编辑器（需要配置 $EDITOR）
  [4] 使用 nano（简单）
  [5] 使用 vim（高级）
  [0] 取消编辑

请选择 [1/2/3/4/5/0]:
```

**方式1（推荐）：保存到文件，手动编辑**

最简单、最灵活的方式：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 文件已保存，请用你喜欢的编辑器打开并修改:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /code/output/temp_post_1234567890.txt

💡 推荐编辑器:
   • VSCode:    code "/code/output/temp_post_1234567890.txt"
   • Sublime:   subl "/code/output/temp_post_1234567890.txt"
   • TextEdit:  open -a TextEdit "/code/output/temp_post_1234567890.txt"
   • 记事本:     notepad "/code/output/temp_post_1234567890.txt"

编辑完成后，保存文件并回到这里
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

完成编辑后按回车键继续...
```

你可以：
1. 复制文件路径
2. 用任何你喜欢的编辑器打开（VSCode、Sublime、记事本等）
3. 随意编辑
4. 保存文件
5. 回到终端按回车

**方式2：直接粘贴**

适合已经准备好内容的情况：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 请粘贴编辑后的内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 提示:
   1. 复制编辑好的内容
   2. 粘贴到下方
   3. 单独一行输入 "EOF" 结束
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[粘贴你的内容]
EOF
```

**方式3：系统默认编辑器**

如果你已经配置了 `$EDITOR` 环境变量（如 VSCode、Sublime 等）

**方式4：nano**

简单的终端编辑器，有提示：
- Ctrl+X 退出
- 按 Y 保存
- 回车确认

**方式5：vim**

高级用户使用，有提示：
- 按 i 进入编辑模式
- 按 ESC 退出编辑模式
- 输入 :wq 保存并退出

在编辑器中可以：
- 修改活动标题、描述
- 删除某些活动
- 添加新的活动文本
- 修改 hashtags

**步骤2：询问是否添加新活动**

编辑完成后，系统会主动询问：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ 你是否在编辑中添加了新的活动？

如果添加了新活动，我可以帮你：
  • 抓取活动信息
  • 生成短链接
  • 记录到数据库以便后续追踪反馈

是否添加了新活动？[y/N]:
```

如果回答 `y`，进入手动添加流程：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 请输入新活动的URL
   (输入 'done' 结束添加，输入 'skip' 跳过)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

活动 #1 URL: https://www.eventbrite.com/e/new-event-123

🔍 检测到: eventbrite
📥 正在获取活动详情...
✅ 活动信息：
   标题: New Cool Event
   时间: 2025-11-15 10:00
   地点: San Francisco

确认添加? [Y/n]: y
✅ 已添加

活动 #2 URL: done

📊 共添加了 1 个新活动
```

新活动会：
- 自动抓取信息（使用 universal-scraper）
- 生成短链接
- 标记 `manually_added_at_publish = true`
- 记录到数据库

**步骤3：保存到数据库**

```
💾 正在保存发布记录到数据库...
   ✅ 生成内容已保存
   ✅ 发布内容已保存 (已编辑)
   ✅ 原有活动: 3 个
   ✅ 新增活动: 1 个
   ✅ 总计: 4 个活动记录

📊 发布记录已创建:
   Post ID: post_2025-11-07T09-30
   原有活动: 3 个
   新增活动: 1 个
   总计: 4 个活动
   内容状态: 已编辑
```

#### 选项3: 取消

- 不保存任何记录
- 可以重新运行命令

### 4. 数据库记录示例

#### posts 表

```
post_id: post_2025-11-07T09-30
published_at: 2025-11-07T09:30:00.000Z
week_identifier: 2025-11-09_to_2025-11-15
total_events: 4
generated_content: "湾区本周活动 11.9-11.15\n\n🎪 活动1..."  (856字符)
published_content: "湾区本周活动 11.9-11.15\n\n🎪 活动1 (编辑版)..."  (923字符)
content_modified: 1
manual_events_added: 1
```

#### event_performance 表

```
# 原有活动
post_id: post_2025-11-07T09-30
event_title: "French Holiday Market"
source_website: eventbrite
manually_added_at_publish: 0

# 发布时手动添加的活动
post_id: post_2025-11-07T09-30
event_title: "New Cool Event"
source_website: eventbrite
manually_added_at_publish: 1  ← 标记为手动添加
```

## 技术实现

### 新增文件

1. **`/code/src/utils/publication-confirmer.js`**
   - `PublicationConfirmer` 类
   - 处理发布前确认、编辑、添加新活动

2. **`/code/src/feedback/schema-v1.6.sql`**
   - 数据库迁移脚本
   - 添加新字段

3. **`/code/test-publication-flow.js`**
   - 测试脚本
   - 验证数据库迁移和新功能

### 修改文件

1. **`/code/src/feedback/performance-database.js`**
   - 添加 `migrateToV16()` 方法
   - 更新 `createPost()` 接收新字段
   - 更新 `createEventPerformance()` 接收 `manually_added_at_publish`

2. **`/code/src/generate-post.js`**
   - 导入 `PublicationConfirmer`
   - 在步骤7和8之间插入确认环节
   - 更新 `savePublicationRecord()` 接收新参数
   - 传递新字段到数据库

### 关键代码片段

#### 发布确认流程

```javascript
// 8. 发布前确认和编辑 (v1.6: 新增)
const confirmResult = await this.publicationConfirmer.confirmPublication(
  postResult.content,
  translatedEvents,
  weekRange
);

if (!confirmResult) {
  console.log('\n❌ 操作已取消，未保存任何记录');
  return;
}

const { publishedContent, contentModified, newEvents } = confirmResult;

// 如果有新活动，需要翻译并合并
let finalEvents = translatedEvents;
if (newEvents.length > 0) {
  console.log(`\n🌐 正在翻译新添加的 ${newEvents.length} 个活动...`);
  const translatedNewEvents = await this.translator.translateAndOptimizeEvents(newEvents);
  finalEvents = [...translatedEvents, ...translatedNewEvents];
}
```

#### 保存记录

```javascript
await this.performanceDB.createPost({
  // ...
  generated_content: generatedContent,    // v1.6: 生成的原始内容
  published_content: publishedContent,    // v1.6: 实际发布的内容
  content_modified: contentModified,      // v1.6: 是否被编辑过
  manual_events_added: manualEventsAdded  // v1.6: 手动添加的活动数量
});

await this.performanceDB.createEventPerformance({
  // ...
  manually_added_at_publish: event._manually_added_at_publish || 0  // v1.6
});
```

## 测试方法

### 1. 测试数据库迁移

```bash
node test-publication-flow.js
```

预期输出：

```
🧪 测试数据库迁移到 v1.6

✅ 数据库连接成功
🔄 开始迁移到 Schema v1.6...
✅ Schema v1.6 迁移完成
✅ 表结构初始化完成（包括 v1.6 迁移）

📝 测试创建发布记录（包含 v1.6 新字段）...
✅ 发布记录创建成功: test_post_xxx

📝 测试创建活动表现记录...
  ✅ 活动1（原有活动）
  ✅ 活动3（发布时手动添加）

📊 验证数据...
✅ 发布记录读取成功
   Post ID: test_post_xxx
   总活动数: 3
   内容是否被编辑: 是
   手动添加的活动数: 1
   生成内容长度: 35 字符
   发布内容长度: 53 字符

✅ 活动记录读取成功 (2 个)
   手动添加的活动: 1 个
      - 活动3（新增）

🧹 清理测试数据...
✅ 测试数据已清理

======================================================================
✅ 所有测试通过！
======================================================================

v1.6 新功能验证成功:
  ✅ generated_content 字段
  ✅ published_content 字段
  ✅ content_modified 字段
  ✅ manual_events_added 字段
  ✅ manually_added_at_publish 字段

现在可以运行 npm run generate-post 来使用新功能了！
```

### 2. 实际测试完整流程

```bash
npm run generate-post
```

在确认环节选择 [2] 编辑，然后测试：
- 编辑内容
- 添加新活动
- 查看数据库记录

## 后续收集反馈

使用现有的反馈收集命令：

```bash
npm run collect-feedback post_2025-11-07T09-30
```

系统会：
- 读取 `published_content`（实际发布的内容）
- 收集所有活动的反馈（包括手动添加的）
- 更新 `engagement_score`

## 数据分析

可以通过以下 SQL 查询分析：

### 查看编辑情况

```sql
SELECT
  post_id,
  content_modified,
  manual_events_added,
  LENGTH(generated_content) as gen_len,
  LENGTH(published_content) as pub_len
FROM posts
WHERE published_at >= '2025-11-01'
ORDER BY published_at DESC;
```

### 查看手动添加的活动表现

```sql
SELECT
  event_title,
  source_website,
  engagement_score,
  manually_added_at_publish
FROM event_performance
WHERE post_id = 'post_2025-11-07T09-30'
ORDER BY manually_added_at_publish DESC, engagement_score DESC;
```

### 对比编辑前后的效果

```sql
SELECT
  p.post_id,
  p.content_modified,
  AVG(ep.engagement_score) as avg_score
FROM posts p
JOIN event_performance ep ON p.post_id = ep.post_id
WHERE ep.engagement_score > 0
GROUP BY p.post_id, p.content_modified
ORDER BY p.published_at DESC;
```

## 边界情况处理

### 1. 删除活动

- 用户编辑时删除某个活动
- `event_performance` 表仍保留该活动记录
- 该活动的短链接不会出现在帖子中，自然没有点击
- 分析时可以看到哪些活动被删除了

### 2. 添加活动但抓取失败

- 显示错误信息
- 询问是否继续添加其他活动
- 已成功添加的活动不受影响

### 3. 取消编辑

- 不保存任何记录
- 可以重新运行命令

### 4. 编辑器打开失败

- 回退到交互式输入模式
- 用户粘贴内容，输入 EOF 结束

## 优势

1. **精确追踪**：记录实际发布内容，反馈数据更准确
2. **灵活性高**：允许编辑和添加活动，不限制用户
3. **简单实用**：不做复杂的文本解析，由用户主动告知
4. **数据完整**：新活动也有完整的追踪数据
5. **向后兼容**：旧记录仍然可用，新字段为可选

## 注意事项

1. 编辑器环境变量：系统会尝试使用 `$EDITOR` 或 `$VISUAL`，默认 `nano`
2. 短链接配额：手动添加活动会消耗 Short.io 配额
3. AI API 调用：翻译新活动会消耗 AI API 配额
4. 数据一致性：采用方案A，允许文本和数据库不完全一致

## 未来改进

如果需要更精确的追踪，可以考虑：

1. **方案B升级**：解析 `published_content`，匹配活动记录
2. **版本控制**：保存多个编辑版本
3. **差异对比**：显示生成内容和发布内容的 diff
4. **批量添加**：支持粘贴多个URL一次性添加

## 相关文件

- `/code/src/utils/publication-confirmer.js` - 发布确认模块
- `/code/src/feedback/schema-v1.6.sql` - 数据库迁移脚本
- `/code/src/feedback/performance-database.js` - 数据库操作
- `/code/src/generate-post.js` - 主流程
- `/code/test-publication-flow.js` - 测试脚本
- `/code/PUBLICATION_TRACKING_FEATURE.md` - 本文档
