# 重复功能分析报告

## 📋 检查时间
2025-12-10

## ✅ 已执行的清理操作

1. **删除旧的去重脚本**
   - ✅ 已删除 `remove-duplicates.js`
   - ✅ 新版本 `remove-duplicates-turso.js` 完全覆盖功能

2. **移动工具脚本到 scripts/ 目录**
   - ✅ `clear-all-events.js` → `scripts/clear-all-events.js`
   - ✅ `clear-database.js` → `scripts/clear-database.js`
   - ✅ `clear-next-week-events.js` → `scripts/clear-next-week-events.js`
   - ✅ `sync-database.js` → `scripts/sync-database.js`

3. **根目录 JS 文件数量**
   - 之前: 18 个文件
   - 现在: 13 个文件
   - 减少: 5 个文件 (-28%)

## 🔍 原始发现的重复或相似功能

### 1. 去重功能（有重复）⚠️

#### 文件对比

| 文件 | 大小 | 功能 | 状态 |
|------|------|------|------|
| `remove-duplicates.js` | 5.3 KB | 只支持本地 SQLite | 🟡 旧版本 |
| `remove-duplicates-turso.js` | 14.6 KB | 支持 Turso + 本地，改进逻辑 | ✅ 新版本 |

#### 详细对比

**remove-duplicates.js**（旧版本）：
```javascript
// 硬编码本地数据库
const dbPath = path.join(__dirname, 'data', 'events.db');
const db = new Database(dbPath);

// 使用 normalized_title 去重
GROUP BY normalized_title
```

**remove-duplicates-turso.js**（新版本）：
```javascript
// 支持环境变量检测
if (this.useTurso) {
  this.client = createClient({ url, authToken });
} else {
  this.db = new sqlite3.Database(dbPath);
}

// 默认使用 original_url 去重（更准确）
GROUP BY original_url

// 兼容旧逻辑
--dedupe-by=normalized_title
```

#### npm 脚本使用情况

```json
// 当前只使用新版本
"remove-duplicates": "node remove-duplicates-turso.js",
"remove-duplicates-preview": "node remove-duplicates-turso.js --dry-run",
"remove-duplicates-by-title": "node remove-duplicates-turso.js --dedupe-by=normalized_title"

// 旧版本没有 npm 脚本引用
```

#### 建议 ✅

**可以删除 `remove-duplicates.js`**：
- 新版本完全覆盖旧版本功能
- 新版本支持 `--dedupe-by=normalized_title` 兼容旧逻辑
- 没有 npm 脚本引用旧版本
- 保留会造成混淆

---

### 2. 同步功能（功能不同）✅

#### 文件对比

| 文件 | 功能 | 用途 |
|------|------|------|
| `sync-database.js` | 修复本地数据格式 | 一次性数据迁移工具 |
| `sync-from-turso.js` | Turso → Local 同步 | 日常同步工具 |

#### 详细说明

**sync-database.js**：
```javascript
// 目的：修复历史数据格式问题
// 1. 更新地址格式（逗号分隔）
// 2. 去掉 description 开头的 "Overview"
// 3. 一次性运行，修复遗留问题
```

**sync-from-turso.js**：
```javascript
// 目的：日常数据同步
// 1. 从 Turso 同步 events 表
// 2. 从 Turso 同步 user_feedback 表
// 3. 增量或全量同步
// 4. 定期运行
```

#### 建议 ✅

**保留两个文件**：
- 功能完全不同
- `sync-database.js` 是数据修复工具（一次性）
- `sync-from-turso.js` 是同步工具（日常使用）
- 但可以考虑将 `sync-database.js` 移到 `scripts/` 或 `archive/`

---

### 3. 清理功能（相似但用途不同）✅

#### 文件对比

| 文件 | 功能 | 用途 |
|------|------|------|
| `clear-database.js` | 删除整个数据库文件 | 开发测试 |
| `clear-all-events.js` | 清空 events 表 | 开发测试 |
| `clear-next-week-events.js` | 清空下周活动 | 开发测试 |

#### 详细对比

```javascript
// clear-database.js
fs.unlinkSync(dbPath);  // 删除文件

// clear-all-events.js
DELETE FROM events;  // 清空表

// clear-next-week-events.js
DELETE FROM events WHERE week_identifier = 'next_week';  // 清空特定数据
```

#### npm 脚本使用情况

```bash
grep "clear" package.json
# 没有发现任何引用
```

#### 建议 ⚠️

**三个文件都没有被使用**：
- 没有 npm 脚本引用
- 都是开发测试工具
- 功能有重叠但粒度不同

**选项**：
1. **移到 scripts/** - 标记为开发工具
2. **移到 archive/** - 不常用，归档
3. **删除** - 如果不需要可以用 SQL 直接操作
4. **合并** - 创建一个统一的清理工具：
   ```bash
   node scripts/clear-data.js --all       # 清空所有
   node scripts/clear-data.js --events    # 清空 events
   node scripts/clear-data.js --next-week # 清空下周
   ```

---

### 4. 初始化功能（功能不同）✅

#### 文件对比

| 文件 | 功能 | 状态 |
|------|------|------|
| `init-feedback-db.js` | 初始化 posts/event_performance 表 | ✅ 使用中 |
| `init-user-feedback-db.js` | 初始化 user_feedback 表 | ✅ 使用中 |

#### npm 脚本

```json
"init-feedback-db": "node init-feedback-db.js",
"init-user-feedback-db": "node init-user-feedback-db.js"
```

#### 建议 ✅

**保留两个文件**：
- 初始化不同的表
- 都有 npm 脚本引用
- 功能明确，不重复

---

## 📊 总结

### 确认有重复的功能

| 功能 | 旧文件 | 新文件 | 建议 |
|------|--------|--------|------|
| 去重 | `remove-duplicates.js` | `remove-duplicates-turso.js` | 🗑️ 删除旧版本 |

### 功能相似但不重复

| 类型 | 文件 | 状态 |
|------|------|------|
| 同步 | `sync-database.js` | ⚠️ 考虑移到 scripts/ |
| 同步 | `sync-from-turso.js` | ✅ 保留 |
| 清理 | `clear-*.js`（3个文件） | ⚠️ 考虑移到 scripts/ 或合并 |
| 初始化 | `init-*-db.js`（2个文件） | ✅ 保留 |

### 没有被使用的脚本

```bash
# 没有 npm 脚本引用的文件
clear-database.js
clear-all-events.js
clear-next-week-events.js
sync-database.js  # 只有一次性的引用
```

---

## 🎯 推荐行动

### ✅ 已完成

1. **删除 `remove-duplicates.js`** ✅
   - 理由：新版本完全覆盖，保留会混淆
   - 状态：已删除

2. **移动测试工具到 scripts/** ✅
   - `clear-all-events.js` → `scripts/`
   - `clear-database.js` → `scripts/`
   - `clear-next-week-events.js` → `scripts/`
   - `sync-database.js` → `scripts/`
   - 理由：这些是开发/测试工具，不是日常使用

### 可选执行（未来优化）

3. **合并 clear 脚本**
   创建 `scripts/clear-data.js` 统一管理：
   ```javascript
   // 接受参数：--all, --events, --next-week
   // 避免多个相似脚本
   ```
   状态：可选，目前保持现状

---

## 📝 检查清单

- [x] 检查所有根目录 .js 文件
- [x] 对比去重功能
- [x] 对比同步功能
- [x] 对比清理功能
- [x] 对比初始化功能
- [x] 检查 npm 脚本引用
- [x] 生成建议方案

---

## 📌 结论

**✅ 已清理的重复功能**：
- `remove-duplicates.js` vs `remove-duplicates-turso.js` → 已删除旧版本

**✅ 已移动的工具脚本**：
- `clear-*.js` (3个文件) → 已移到 `scripts/`
- `sync-database.js` → 已移到 `scripts/`

**✅ 项目更整洁**：
- 根目录 JS 文件从 18 个减少到 13 个
- 开发工具统一放在 `scripts/` 目录
- 日常使用的脚本保留在根目录

**当前根目录文件列表**：
```
clean-english-translations.js    - 清理英文翻译
collect-feedback.js              - 收集反馈
generate-english-posts.js        - 生成英文发布
init-feedback-db.js              - 初始化 feedback 表
init-user-feedback-db.js         - 初始化 user_feedback 表
remove-duplicates-turso.js       - 去重（支持 Turso）
scrape-single-source.js          - 单源抓取
setup.js                         - 初始化设置
sync-from-turso.js               - Turso 同步
test-gemini-models.js            - 测试 Gemini 模型
test-translation.js              - 测试翻译
translate-existing-events.js     - 翻译现有活动
translate-missing.js             - 翻译缺失标题
```

**scripts/ 目录文件列表**：
```
check-db-config.js               - 检查数据库配置
check-env.sh                     - 检查环境变量
clear-all-events.js              - 清空所有活动
clear-database.js                - 删除数据库文件
clear-next-week-events.js        - 清空下周活动
sync-database.js                 - 数据格式修复（一次性）
```
