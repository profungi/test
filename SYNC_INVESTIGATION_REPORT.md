# 同步功能问题调查报告

## 调查时间
2025-12-10

## 问题描述
用户报告了两个同步相关的问题需要调查：

1. **user_feedback 表同步问题**：网站的点赞/反馈数据写入 Turso 数据库，但没有同步到本地
2. **remove-duplicates.js 脚本问题**：脚本似乎不能正常工作，而且没有针对 Turso 数据库去重

---

## 问题 1: user_feedback 表同步

### 现状分析

#### 数据流向
```
Website (Next.js)
  ↓
  写入 Turso: user_feedback 表
  ↓
  ❌ 没有同步到本地
```

#### 表结构
**Turso 和本地数据库都有 user_feedback 表**，结构完全一致：

```sql
CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,         -- 用户会话ID（匿名）
  feedback_type TEXT NOT NULL,      -- 'thumbs_up' 或 'thumbs_down'
  comment TEXT,                     -- 用户评论
  filter_state TEXT,                -- 过滤器状态（JSON）
  events_shown INTEGER,             -- 显示的活动数量
  user_agent TEXT,                  -- 浏览器信息
  referrer TEXT,                    -- 来源页面
  locale TEXT,                      -- 语言（en/zh）
  created_at TEXT NOT NULL,         -- 创建时间
  ip_hash TEXT                      -- IP哈希（隐私保护）
);
```

**索引**：
- `idx_feedback_type` on `feedback_type`
- `idx_feedback_created` on `created_at DESC`
- `idx_feedback_session` on `session_id`

#### 当前实现

**Website 写入**（`website/app/api/feedback/route.ts:44-56`）：
```typescript
// 直接写入 Turso
const result = await saveFeedback({
  sessionId,
  feedbackType,
  comment,
  filterState: filterState ? JSON.stringify(filterState) : undefined,
  eventsShown,
  userAgent,
  referrer,
  locale: locale || 'en',
  ipHash,
});
```

**sync-from-turso.js 当前只同步**：
- ✅ `events` 表
- ❌ **不同步** `user_feedback` 表

### 问题根源

`sync-from-turso.js` 设计时只考虑了单向同步 `events` 表（活动数据），没有包含 `user_feedback` 表。

**原始设计意图**（从 `sync-from-turso.js:7-10` 注释）：
```javascript
/**
 * 功能：
 * - 只同步 events 表（活动数据）
 * - 不触碰 feedback 表（posts, event_performance, weight_adjustments）
 */
```

这里的 "feedback 表" 指的是旧的本地反馈表（`posts`, `event_performance`, `weight_adjustments`），不包括新的 `user_feedback` 表。

### 影响范围

**无法同步会导致**：
1. 本地无法分析用户反馈数据
2. 如果有本地分析脚本依赖 `user_feedback`，将无法工作
3. 数据只存在云端，本地查询不到

**目前不受影响的功能**：
- Website 正常运行（直接读写 Turso）
- 用户反馈功能正常（写入 Turso）

### 解决方案建议

#### 方案 A：添加 user_feedback 到 sync-from-turso.js（推荐）

**优点**：
- 保持单向同步策略一致性
- 本地可以分析反馈数据
- 完整的数据副本

**实现要点**：
1. 在 `fetchFromTurso()` 中添加 `user_feedback` 表查询
2. 添加 `syncUserFeedback()` 方法
3. 使用 `id` 作为唯一标识（AUTOINCREMENT）
4. 支持增量同步（基于 `created_at`）

**注意事项**：
- 不能使用 `original_url` 去重（user_feedback 没有这个字段）
- 应该用 `id` 作为主键判断
- 或者用 `(session_id, created_at)` 组合判断

#### 方案 B：保持现状，本地不需要 user_feedback

**适用场景**：
- 所有反馈分析都在 Turso 上进行
- 本地不需要访问反馈数据
- Website 已经提供了查询接口（`GET /api/feedback`）

#### 方案 C：双向同步（不推荐）

复杂度高，与当前架构不符。

---

## 问题 2: remove-duplicates.js 脚本

### 现状分析

#### 脚本功能（`remove-duplicates.js:1-186`）

**目标**：删除本地数据库中的重复活动

**实现**：
1. 连接本地 SQLite：`data/events.db`
2. 删除无效活动（标题是网站域名的）
3. 按 `normalized_title` 分组查找重复
4. 保留优先级最高或 ID 最小的活动
5. 删除其他重复项

**关键代码**（`remove-duplicates.js:10-11`）：
```javascript
const dbPath = path.join(__dirname, 'data', 'events.db');
const db = new Database(dbPath);
```

### 问题根源

#### 问题 1：只操作本地数据库

脚本**硬编码**了本地 SQLite 路径，完全没有 Turso 支持：
- ❌ 不读取 `.env` 配置
- ❌ 不检查 `USE_TURSO` 环境变量
- ❌ 不使用 `@libsql/client`
- ❌ 只操作 `data/events.db`

**结果**：
```
scrape → Turso (产生重复数据)
  ↓
  ❌ remove-duplicates.js 只去重本地
  ↓
  Turso 的重复数据依然存在
```

#### 问题 2：脚本为什么"用不起来"？

**可能的原因**：

1. **数据不在本地**
   - 如果用户设置了 `USE_TURSO=1`
   - scraper 写入 Turso
   - 本地数据库是空的或过时的
   - 脚本运行没有效果（没有数据可去重）

2. **脚本本身的逻辑问题**
   - 使用 `GROUP_CONCAT()` 可能有长度限制
   - 异步回调嵌套可能有 race condition
   - `finishUp()` 的 `setTimeout(500)` 可能不够

3. **UNIQUE 约束冲突**
   - events 表有 UNIQUE 约束：`(normalized_title, start_time, location)`
   - 理论上不应该产生重复
   - 如果有重复，说明这三个字段中至少有一个不同

### 重复数据产生的原因

**events 表 UNIQUE 约束**（`complete_schema.sql:21`）：
```sql
UNIQUE(normalized_title, start_time, location)
```

**如果有重复，可能是**：
1. `start_time` 格式不一致（时区、格式差异）
2. `location` 文本细微差异（空格、大小写、缩写）
3. `normalized_title` 规范化不够彻底
4. 不同来源的相同活动，字段值略有不同

### 解决方案建议

#### 方案 A：支持 Turso 的去重脚本（推荐）

**新建** `remove-duplicates-turso.js`：
- 读取 `.env` 配置
- 根据 `USE_TURSO` 决定操作哪个数据库
- 使用 `@libsql/client` 连接 Turso
- 保持相同的去重逻辑

**优点**：
- 直接在源头去重（Turso）
- 保留旧脚本向后兼容
- 清晰明确

#### 方案 B：改进现有脚本

修改 `remove-duplicates.js`：
- 添加环境变量检测
- 动态选择数据库
- 统一接口

**缺点**：
- sqlite3 和 @libsql/client API 不同
- 需要适配两套 API
- 代码复杂度增加

#### 方案 C：从根本上防止重复

**在 scraper 层面**：
1. 改进 `normalized_title` 算法
2. 统一 `start_time` 格式
3. 清理 `location` 文本
4. 使用 `original_url` 作为唯一标识

**在数据库层面**：
```sql
-- 改进 UNIQUE 约束
UNIQUE(source, original_url)
-- 或者只用 original_url
UNIQUE(original_url)
```

**优点**：
- 预防胜于治疗
- 不需要事后去重

**缺点**：
- 需要修改 schema（已有数据迁移）
- `original_url` 可能变化（动态生成的 URL）

#### 方案 D：定期自动去重

在 scraper 流程中集成去重：
```bash
npm run scrape && npm run remove-duplicates-turso
```

**package.json**：
```json
"scrape-and-clean": "npm run scrape && npm run remove-duplicates-turso"
```

---

## 技术细节对比

### events 表 vs user_feedback 表

| 特性 | events | user_feedback |
|------|--------|---------------|
| **数据来源** | Scraper | Website 用户交互 |
| **写入频率** | 每周 1 次 | 持续不断 |
| **数据量** | 几百到上千条/周 | 取决于流量 |
| **唯一标识** | `original_url` | `id` 或 `(session_id, created_at)` |
| **是否有重复风险** | 有（需要去重） | 无（每次都是新记录） |
| **当前同步状态** | ✅ 已同步 | ❌ 未同步 |

### 去重逻辑对比

#### 当前 remove-duplicates.js
```javascript
// 1. 按 normalized_title 分组
GROUP BY normalized_title HAVING COUNT(*) > 1

// 2. 保留规则
保留: MAX(priority) 或 MIN(id)

// 3. 删除其他
DELETE FROM events WHERE id IN (...)
```

#### 理想的去重逻辑
```javascript
// 1. 按真正的唯一标识分组
GROUP BY source, original_url HAVING COUNT(*) > 1

// 2. 保留规则
保留: 最新的 scraped_at

// 3. 删除其他
```

---

## 推荐实现计划

### 短期（立即实施）

1. **添加 user_feedback 同步**
   - 修改 `sync-from-turso.js`
   - 添加 `syncUserFeedback()` 方法
   - 更新文档

2. **创建 Turso 去重脚本**
   - 新建 `remove-duplicates-turso.js`
   - 支持 `USE_TURSO` 环境变量
   - 添加到 `package.json` 脚本

### 中期（优化改进）

3. **改进去重逻辑**
   - 使用 `original_url` 作为唯一标识
   - 统一 `start_time` 格式
   - 清理 `location` 文本

4. **集成到工作流**
   - scraper 后自动去重
   - 同步前自动去重

### 长期（架构优化）

5. **Schema 改进**
   - 修改 UNIQUE 约束为 `(source, original_url)`
   - 迁移现有数据

6. **监控和告警**
   - 监控重复数据产生
   - 定期报告数据质量

---

## 相关文件

### user_feedback 相关
- `website/lib/turso-feedback.ts` - Turso 写入逻辑
- `website/app/api/feedback/route.ts` - API 端点
- `init-user-feedback-db.js` - 本地表初始化
- `complete_schema.sql` - 完整 schema

### 同步相关
- `sync-from-turso.js` - 当前同步脚本（只同步 events）
- `package.json:25` - `sync-from-turso` 脚本

### 去重相关
- `remove-duplicates.js` - 当前去重脚本（只支持本地）

### 文档
- `QUICK_START.md` - 快速开始指南
- `docs/DATA_ARCHITECTURE.md` - 数据架构文档

---

## 结论

### user_feedback 同步
- **问题明确**：需要添加到同步脚本
- **影响有限**：目前不影响 Website 运行
- **解决方案**：修改 `sync-from-turso.js` 添加 user_feedback 表同步
- **✅ 状态**：已完成实现（2025-12-10）

### remove-duplicates.js
- **根本原因**：只支持本地数据库，不支持 Turso
- **次要原因**：去重逻辑可能不够准确
- **解决方案**：创建支持 Turso 的版本，改进去重逻辑
- **✅ 状态**：已完成实现（2025-12-10）

### 优先级
1. ✅ ~~高优先级：添加 user_feedback 同步（完善数据同步）~~ - 已完成
2. ✅ ~~高优先级：创建 Turso 去重脚本（立即解决用户问题）~~ - 已完成
3. ✅ ~~中优先级：改进去重逻辑（提高准确性）~~ - 已完成
4. 💡 低优先级：Schema 优化（长期改进） - 待实现

---

## 实施记录

### 2025-12-10: user_feedback 同步功能已完成

**修改的文件**:
- `sync-from-turso.js` - 添加了 user_feedback 表的同步功能

**新增的方法**:
1. `getLastFeedbackSyncTime()` - 获取上次同步的 user_feedback 时间
2. `fetchFeedbackFromTurso(sinceTime)` - 从 Turso 获取 user_feedback 数据
3. `syncFeedbackToLocal(feedback, mode)` - 同步 user_feedback 到本地
4. `upsertFeedback(feedback)` - 插入或更新 user_feedback 记录
5. `clearLocalFeedback()` - 清空本地 user_feedback 表（全量同步用）
6. `previewFeedbackData(feedback)` - 预览 user_feedback 数据

**同步策略**:
- 使用 `id` 作为唯一标识（保留 Turso 的 AUTOINCREMENT id）
- 支持增量同步（基于 `created_at` 时间戳）
- 支持全量同步（清空并重新导入）
- Upsert 逻辑：存在则更新，不存在则插入

**文档更新**:
- 更新了 `sync-from-turso.js` 的帮助文档
- 更新了 `QUICK_START.md` 的数据库说明
- 更新了 `docs/DATA_ARCHITECTURE.md` 的数据分层说明

**测试**:
- ✅ JavaScript 语法检查通过
- ✅ 帮助文档显示正常
- ✅ 本地数据库确认有 user_feedback 表（2 条记录）
- ⚠️ 完整同步测试需要有效的 Turso 配置

---

### 2025-12-10: Turso 去重脚本已完成

**新建的文件**:
- `remove-duplicates-turso.js` - 支持 Turso 的去重脚本
- `DEDUPLICATION_GUIDE.md` - 详细的去重功能使用指南

**核心功能**:
1. **双数据库支持**: 自动检测 `USE_TURSO` 环境变量
   - USE_TURSO=1: 操作 Turso 云端数据库
   - USE_TURSO=0 或未设置: 操作本地 SQLite

2. **改进的去重逻辑**:
   - 默认使用 `original_url` 作为唯一标识（比 normalized_title 更准确）
   - 支持 `--dedupe-by=normalized_title` 兼容旧逻辑
   - 优先保留 priority 最高或 scraped_at 最新的活动

3. **安全特性**:
   - `--dry-run` 预览模式，查看将要删除的数据
   - 智能配置检测，占位符自动回退到本地数据库
   - 详细的统计信息和操作日志

4. **无效活动清理**:
   - 自动删除标题是域名的活动（www.sfstation.com 等）

**npm 脚本**:
- `npm run remove-duplicates` - 删除重复活动
- `npm run remove-duplicates-preview` - 预览模式
- `npm run remove-duplicates-by-title` - 使用标题去重

**去重策略**:
```javascript
// 对每组重复活动
1. 比较 priority（优先级）
   → 保留 priority 最高的

2. 如果 priority 相同，比较 scraped_at（抓取时间）
   → 保留最新抓取的

3. 删除其他重复项
```

**文档更新**:
- 创建了 `DEDUPLICATION_GUIDE.md` - 完整的使用指南
- 更新了 `QUICK_START.md` - 添加去重命令
- 更新了 `package.json` - 添加 3 个去重脚本
- 更新了调查报告状态

**测试**:
- ✅ JavaScript 语法检查通过
- ✅ 帮助文档显示正常
- ✅ 预览模式测试通过（本地数据库 480 条记录，0 重复）
- ✅ npm 脚本测试通过
- ✅ 智能配置回退测试通过
- ⚠️ Turso 实际去重测试需要有效配置
