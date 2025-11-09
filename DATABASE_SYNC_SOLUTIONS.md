# 数据库同步解决方案 - 完整分析

**问题**: `events.db` 被 track 到 git,导致 repo 膨胀和合并冲突

---

## ⚠️ SQL 差量同步方案 - 潜在问题分析

### 🔴 **关键问题 1: 并发写入冲突**

#### 场景
两个开发者（或 Sculptor agents）**同时**运行 `npm run generate-post`:

```
时间线:
10:00 - Agent A: 开始生成 post_001
10:01 - Agent B: 开始生成 post_002
10:02 - Agent A: 写入数据库 events.db (添加 post_001)
10:03 - Agent B: 写入数据库 events.db (添加 post_002)
10:04 - Agent A: 导出 feedback-delta-20251108-1.sql
10:05 - Agent B: 导出 feedback-delta-20251108-2.sql
10:06 - 两个 delta 文件都包含各自的数据...
```

#### 问题表现

1. **Delta 文件命名冲突**
   ```bash
   # 两个 agent 可能生成相同的文件名
   feedback-delta-20251108.sql  # Agent A
   feedback-delta-20251108.sql  # Agent B (覆盖!)
   ```

2. **数据丢失**
   - Agent B 的导出会覆盖 Agent A 的文件
   - 或者 Agent A 提交后,Agent B pull 时会有冲突

3. **Git 合并冲突**
   ```sql
   <<<<<<< HEAD
   INSERT INTO posts VALUES ('post_001', ...);
   =======
   INSERT INTO posts VALUES ('post_002', ...);
   >>>>>>> feature-branch
   ```

#### 解决方案

**方案 A: 添加时间戳到文件名**
```javascript
// 使用精确到秒的时间戳
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const deltaFile = `feedback-delta-${timestamp}.sql`;
// 例如: feedback-delta-2025-11-08T10-02-35-123Z.sql
```

**方案 B: 使用 UUID**
```javascript
const { randomUUID } = require('crypto');
const deltaFile = `feedback-delta-${Date.now()}-${randomUUID().slice(0,8)}.sql`;
// 例如: feedback-delta-1699444955-a7b3c4d5.sql
```

**方案 C: Agent ID 前缀**
```javascript
const agentId = process.env.SCULPTOR_AGENT_ID || os.hostname();
const deltaFile = `feedback-delta-${agentId}-${Date.now()}.sql`;
// 例如: feedback-delta-agent-42-1699444955.sql
```

---

### 🔴 **关键问题 2: 交互流程被打断**

#### 场景
`generate-post.js` 有**多个交互式 readline** 提示:

1. **发布前确认** (line 169-176)
   ```
   请选择操作:
     [1] 覆盖最新的记录
     [2] 创建新版本
     [3] 取消，不保存
   ```

2. **编辑内容** (publication-confirmer.js)
   ```
   [1] 直接使用此内容发布
   [2] 编辑内容后发布
   [3] 取消，不保存记录
   ```

3. **手动添加活动** (publication-confirmer.js line 398-420)
   ```
   请输入新活动的URL
   活动 #1 URL: _____
   ```

#### 问题表现

**场景 1: 自动导出中断交互**
```javascript
// 如果在 performanceDB.createPost() 后自动导出...
await db.createPost(...);
await exportDelta();  // ← 这里会打印日志,干扰用户输入!

// 用户正在看到:
请选择 [1/2/3]: █

// 但突然出现:
✅ 导出了 5 posts, 12 events
📁 保存到: data/feedback-delta-xxx.sql

// 用户困惑: "这是什么?我该输入什么?"
```

**场景 2: 导出失败但流程已继续**
```javascript
await db.createPost(...);
console.log('✅ 发布记录已创建');
// 用户以为成功了

// 后台悄悄失败:
try {
  await exportDelta();
} catch (err) {
  // 静默失败,用户不知道
}

// 结果: 数据在 events.db,但没有 delta 文件
// 其他 agent 无法同步!
```

#### 解决方案

**方案 A: 延迟导出到最后**
```javascript
// 在 generate-post.js 最后
async run() {
  try {
    // ... 所有交互和生成逻辑 ...

    await this.performanceDB.close();

    console.log('\n✨ 内容生成完成！');

    // 最后才导出 (所有交互完成后)
    console.log('\n📦 正在同步数据...');
    await this.exportFeedbackDelta();
    console.log('✅ 数据已导出');

  } catch (error) {
    // ...
  }
}
```

**方案 B: 使用后台任务**
```javascript
// 使用 child_process 在后台导出
const { spawn } = require('child_process');

function exportDeltaInBackground() {
  const child = spawn('node', ['scripts/export-feedback-delta.js'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();  // 让主进程可以退出
}

// 调用
await db.createPost(...);
exportDeltaInBackground();  // 不等待
// 主流程继续...
```

**方案 C: 明确的同步命令**
```json
{
  "scripts": {
    "generate-post": "node src/generate-post.js",
    "sync-feedback": "node scripts/export-feedback-delta.js && git add data/feedback-delta-*.sql"
  }
}
```

```bash
# 用户工作流
npm run generate-post    # 专注于生成内容
# ... 所有交互 ...
# 完成后

npm run sync-feedback    # 手动同步数据
git commit -m "Add feedback"
```

---

### 🔴 **关键问题 3: 数据库锁定**

#### 场景
SQLite 使用**文件锁**,多个进程同时访问会有问题:

```
Process A: generate-post.js
  └─ [WRITE] events.db (SQLite 文件锁)

Process B: export-feedback-delta.js
  └─ [READ] events.db  ← BLOCKED! (等待锁释放)
```

#### 问题表现

```javascript
// generate-post.js 还在运行
await db.connect();
await db.createPost(...);
// db 连接还没关闭

// 同时运行导出脚本
$ npm run feedback:export-delta

// 错误:
Error: SQLITE_BUSY: database is locked
```

#### 解决方案

**方案 A: 确保关闭连接**
```javascript
async savePublicationRecord(...) {
  // ... 保存数据 ...

  await this.performanceDB.close();  // ← 必须关闭!
  return postId;
}
```

**方案 B: 使用 WAL 模式**
```sql
-- 启用 Write-Ahead Logging
PRAGMA journal_mode=WAL;
```

WAL 模式允许:
- 1个写入者 + 多个读取者同时工作
- 减少锁定冲突

在 `performance-database.js` 初始化时:
```javascript
async connect() {
  return new Promise((resolve, reject) => {
    this.db = new sqlite3.Database(this.dbPath, async (err) => {
      if (err) {
        reject(err);
      } else {
        // 启用 WAL 模式
        await this.run('PRAGMA journal_mode=WAL');
        console.log('📊 连接到性能数据库 (WAL模式)');
        resolve();
      }
    });
  });
}
```

**方案 C: 重试机制**
```javascript
async function readWithRetry(dbPath, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = new sqlite3.Database(dbPath);
      // ... 读取数据 ...
      return data;
    } catch (err) {
      if (err.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
        console.log(`⏳ 数据库忙,等待 ${i+1}s 后重试...`);
        await delay(1000 * (i + 1));
      } else {
        throw err;
      }
    }
  }
}
```

---

### 🔴 **关键问题 4: 增量文件累积**

#### 场景
每次运行都生成新的 delta 文件:

```bash
data/
├── feedback-delta-20251101.sql
├── feedback-delta-20251102.sql
├── feedback-delta-20251103.sql
├── ...
└── feedback-delta-20251230.sql  # 60天 = 60个文件!
```

#### 问题表现

1. **Git repo 膨胀**
   - 虽然每个文件小,但累积起来也不少
   - 60天 × 10KB/文件 = 600KB

2. **导入变慢**
   ```bash
   npm run feedback:apply-deltas
   # 需要应用 60 个文件...
   ```

3. **难以查找**
   - "11月5日的数据在哪个文件?"
   - 需要一个个打开查看

#### 解决方案

**方案 A: 定期合并 (Compaction)**

每月一次,合并所有 delta 到新的 base:

```javascript
// scripts/compact-feedback-data.js
async function compactFeedbackData() {
  // 1. 读取 base + 所有 deltas
  const baseData = readSQL('data/feedback-base.sql');
  const deltas = glob.sync('data/feedback-delta-*.sql')
    .sort()
    .map(file => readSQL(file));

  // 2. 合并到新 base
  const newBase = mergeAll([baseData, ...deltas]);

  // 3. 备份旧文件
  const backupDir = `data/archive/${YYYY-MM}`;
  fs.mkdirSync(backupDir, { recursive: true });
  mv('data/feedback-delta-*.sql', backupDir);

  // 4. 写入新 base
  fs.writeFileSync('data/feedback-base.sql', newBase);

  console.log(`✅ 合并了 ${deltas.length} 个增量文件`);
  console.log(`📦 旧文件已归档到: ${backupDir}`);
}
```

**运行时机**:
```json
{
  "scripts": {
    "feedback:compact": "node scripts/compact-feedback-data.js",
    "feedback:compact-monthly": "cron '0 0 1 * *' npm run feedback:compact"
  }
}
```

**方案 B: 滚动窗口**

只保留最近 N 天的 delta:

```javascript
// 只保留最近 30 天
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 30);

const oldDeltas = glob.sync('data/feedback-delta-*.sql')
  .filter(file => {
    const date = extractDateFromFilename(file);
    return date < cutoffDate;
  });

// 合并旧 deltas 到 base
await compactDeltas(oldDeltas);

// 删除旧 delta 文件
oldDeltas.forEach(file => fs.unlinkSync(file));
```

**方案 C: 按周归档**

```bash
data/
├── feedback-base.sql
├── deltas/
│   ├── 2025-W45/           # 第45周
│   │   ├── delta-mon.sql
│   │   ├── delta-tue.sql
│   │   └── ...
│   └── 2025-W46/           # 第46周
│       └── delta-mon.sql
└── archive/
    └── 2025-10/            # 每月归档
        └── october-complete.sql
```

---

### 🔴 **关键问题 5: 手动添加活动的处理**

#### 场景回顾

用户可以在发布前手动添加活动:

```javascript
// publication-confirmer.js line 361-98
async askAndAddNewEvents(weekRange) {
  // 循环添加新活动
  while (true) {
    const url = await prompt('活动 URL: ');
    const event = await scrapeEventFromUrl(url);

    // 生成短链接
    event.short_url = await urlShortener.shortenUrl(...);

    // 标记
    event._manually_added_at_publish = true;

    newEvents.push(event);
  }

  return newEvents;
}
```

#### 问题表现

**新活动没有完整的 metadata**:

```javascript
// 自动抓取的活动有:
{
  id: 123,
  event_type: 'market',
  priority: 8,
  chinese_relevant: true,
  _source_review: 'review_2025-11-08.json',
  _source_website: 'eventbrite.com'
  // ... 等等
}

// 手动添加的活动只有:
{
  title: 'Jazz Concert',
  startTime: '2025-11-15T19:00',
  location: 'SF',
  price: '$20',
  originalUrl: 'https://...',
  short_url: 'https://short.io/abc',
  _manually_added_at_publish: true,
  _source_website: 'eventbrite.com'
  // 缺少: event_type, priority, chinese_relevant!
}
```

#### 对 Delta 导出的影响

导出时会丢失字段:
```sql
-- 自动活动
INSERT INTO event_performance VALUES (
  'evt_001',
  'market',      -- event_type
  8,             -- priority
  true,          -- chinese_relevant
  ...
);

-- 手动活动
INSERT INTO event_performance VALUES (
  'evt_002',
  NULL,          -- event_type = NULL!
  NULL,          -- priority = NULL!
  NULL,          -- chinese_relevant = NULL!
  ...
);
```

#### 解决方案

**方案 A: 在添加时进行分类**

```javascript
async askAndAddNewEvents(weekRange) {
  const newEvents = [];

  while (true) {
    const event = await scrapeEventFromUrl(url);

    // ✅ 立即进行 AI 分类
    const AIClassifier = require('./ai-classifier');
    const classifier = new AIClassifier();

    const classified = await classifier.classifyEvent(event);

    event.event_type = classified.event_type;
    event.priority = classified.priority;
    event.chinese_relevant = classified.chinese_relevant;
    event._manually_added_at_publish = true;

    newEvents.push(event);
  }

  return newEvents;
}
```

**问题**: 增加了交互流程的时间 (每个活动 +2-3秒 AI 调用)

**方案 B: 延迟分类**

```javascript
// 在 generate-post.js
const { newEvents } = confirmResult;

if (newEvents.length > 0) {
  console.log('\n🤖 正在分类新添加的活动...');

  const classifier = new AIClassifier();
  for (const event of newEvents) {
    const classified = await classifier.classifyEvent(event);
    Object.assign(event, classified);
  }
}

// 然后翻译
const translatedNewEvents = await translator.translateAndOptimizeEvents(newEvents);
```

**方案 C: 使用默认值**

```javascript
// 手动添加的活动使用保守的默认值
event.event_type = event.event_type || 'other';
event.priority = event.priority || 5;  // 中等优先级
event.chinese_relevant = event.chinese_relevant || false;
```

---

### 🔴 **关键问题 6: 网络依赖**

#### 场景

Delta 导出/导入**完全依赖文件系统**,但:

1. **手动添加活动需要网络**:
   ```javascript
   await universalScraper.scrapeEventFromUrl(url);  // 抓取网页
   await urlShortener.shortenUrl(...);               // 调用 short.io API
   ```

2. **翻译需要网络**:
   ```javascript
   await translator.translateAndOptimizeEvents(...);  // AI API
   ```

#### 问题表现

**网络故障导致部分数据丢失**:

```
用户添加3个活动:
  Activity 1: ✅ 成功 (网页抓取 OK, 短链接 OK)
  Activity 2: ⚠️  部分成功 (网页OK, 短链接失败)
  Activity 3: ❌ 失败 (网页超时)

结果:
  - events.db 保存了 Activity 1, 2
  - Activity 3 完全丢失
  - Delta 文件只包含 Activity 1, 2
```

#### 解决方案

**方案 A: 失败重试**

```javascript
async askAndAddNewEvents() {
  const failedUrls = [];

  while (true) {
    try {
      const event = await scrapeWithRetry(url, maxRetries=3);
      newEvents.push(event);
    } catch (err) {
      console.log(`❌ 失败: ${err.message}`);
      failedUrls.push(url);

      const retry = await askYesNo('重试此活动?');
      if (retry) {
        continue;  // 重新尝试
      }
    }
  }

  if (failedUrls.length > 0) {
    console.log(`\n⚠️  ${failedUrls.length} 个活动未能添加:`);
    failedUrls.forEach(url => console.log(`   - ${url}`));
    console.log('💡 可以稍后手动重试');
  }

  return newEvents;
}
```

**方案 B: 保存失败记录**

```javascript
// 保存到文件,稍后重试
const failedLog = {
  timestamp: new Date().toISOString(),
  failed_urls: failedUrls,
  reason: 'network_error'
};

fs.writeFileSync(
  `output/failed-events-${Date.now()}.json`,
  JSON.stringify(failedLog, null, 2)
);

console.log('💾 失败记录已保存,稍后可手动处理');
```

---

## ✅ **综合解决方案**

综合上述所有问题,推荐的实施方案:

### 1. 文件命名策略
```javascript
// 使用精确时间戳 + 主机名
const hostname = os.hostname().replace(/[^a-z0-9]/gi, '').slice(0, 8);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const deltaFile = `feedback-delta-${timestamp}-${hostname}.sql`;
// 例如: feedback-delta-2025-11-08T10-02-35-sculptor.sql
```

### 2. 导出时机
```javascript
class PostGenerationOrchestrator {
  async run() {
    try {
      // ... 所有业务逻辑 ...

      // 关闭数据库连接
      await this.performanceDB.close();

      console.log('\n✨ 内容生成完成！');

      // 最后导出 (不干扰交互)
      await this.exportFeedbackDelta();

    } catch (error) {
      console.error(error);
    }
  }

  async exportFeedbackDelta() {
    console.log('\n📦 导出反馈数据...');

    try {
      const exporter = require('./scripts/export-feedback-delta');
      await exporter.exportDelta();

      console.log('✅ 数据已导出');
      console.log('💡 记得运行: git add data/feedback-delta-*.sql');

    } catch (err) {
      console.error('⚠️  导出失败:', err.message);
      console.error('   数据已保存到 events.db,稍后可手动导出');
    }
  }
}
```

### 3. 启用 WAL 模式
```javascript
// src/feedback/performance-database.js
async connect() {
  this.db = new sqlite3.Database(this.dbPath, async (err) => {
    if (!err) {
      // 启用 WAL 模式减少锁冲突
      await this.run('PRAGMA journal_mode=WAL');
      await this.run('PRAGMA synchronous=NORMAL');
    }
  });
}
```

### 4. 手动活动分类
```javascript
// src/utils/publication-confirmer.js
async askAndAddNewEvents(weekRange) {
  const AIClassifier = require('./ai-classifier');
  const classifier = new AIClassifier();

  const newEvents = [];

  while (true) {
    const event = await this.scrapeEventFromUrl(url);

    // 立即分类
    console.log('🤖 AI分类中...');
    const classification = await classifier.classifyEvent(event);

    Object.assign(event, classification);
    event._manually_added_at_publish = true;

    newEvents.push(event);
  }

  return newEvents;
}
```

### 5. 定期压缩
```json
{
  "scripts": {
    "feedback:compact": "node scripts/compact-feedback-data.js",
    "feedback:auto-compact": "test $(find data -name 'feedback-delta-*.sql' | wc -l) -gt 30 && npm run feedback:compact || echo 'No compaction needed'"
  }
}
```

在 `package.json` 的 `postinstall` 钩子:
```json
{
  "scripts": {
    "postinstall": "npm run feedback:import && npm run feedback:auto-compact"
  }
}
```

---

## 📋 对现有流程的影响总结

### ✅ **不受影响的部分**

1. **交互式选择**: 完全不变
   - Review 文件选择
   - 活动合并
   - 最终确认

2. **内容生成**: 完全不变
   - 短链接生成
   - AI 翻译
   - 小红书格式化

3. **发布确认**: 完全不变
   - 内容编辑
   - 覆盖/新建选择

### ⚠️ **受影响的部分**

1. **手动添加活动** (+5-10秒/活动)
   - 需要额外的 AI 分类步骤
   - 但保证数据完整性

2. **结束时导出** (+1-2秒)
   - 在最后增加导出步骤
   - 对用户几乎无感知

3. **首次 clone** (+5-10秒)
   - 需要运行 `npm run feedback:import`
   - 可以在 `postinstall` 自动执行

### 📊 **性能对比**

| 操作 | 当前 (track .db) | 新方案 (SQL delta) | 变化 |
|------|-----------------|-------------------|------|
| git clone | ~5秒 (420KB) | ~3秒 (50KB×30) | ⚡ 更快 |
| git pull | ~1秒 | ~1秒 | ➡️ 相同 |
| generate-post | ~30秒 | ~35秒 (+导出) | ⚠️ +5秒 |
| 手动添加活动 | ~3秒/个 | ~8秒/个 (+分类) | ⚠️ +5秒 |
| 数据同步 | 自动 | 自动 | ➡️ 相同 |

---

## 🎯 **最终建议**

### 立即可做 (低风险)

1. ✅ 启用 WAL 模式 (提升并发性能)
2. ✅ 改进文件命名 (避免冲突)
3. ✅ 将导出移到最后 (不干扰交互)

### 短期实施 (1-2天)

4. ✅ 实现 SQL delta 导出/导入
5. ✅ 添加手动活动分类
6. ✅ 从 git 移除 events.db

### 长期维护 (持续)

7. ✅ 定期压缩 (每月)
8. ✅ 监控 delta 文件数量
9. ✅ 优化导出性能

---

需要我开始实施吗? 我可以:
1. 创建导出/导入脚本
2. 修改 generate-post.js 添加导出步骤
3. 修改 publication-confirmer.js 添加分类
4. 启用 WAL 模式
5. 测试完整流程
