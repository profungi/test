# 双语支持策略文档

## 方案对比总结

### 方案 A：只翻译 UI，活动数据保持英文原文 ✅ 当前实施

**数据库：** 不需要修改
- `title`: "Golden Gate Park Concert" (保持英文)
- `location`: "1275 Minnesota Street, San Francisco" (保持英文)
- `description`: "Opening Night Reception..." (保持英文)

**实现方式：**
- UI 元素完全双语（使用 next-intl）
- 活动数据显示英文原文
- 中文网站的按钮、筛选器等使用中文

**优势：**
- ✅ 不需要修改数据库结构
- ✅ 不需要翻译流程
- ✅ 保持原始信息准确性（地址、活动名不会翻译错）
- ✅ 维护简单
- ✅ 不影响现有 scraper 和小红书流程
- ✅ 快速上线，验证产品

**劣势：**
- ⚠️ 中文用户可能觉得不够本地化
- ⚠️ AI 搜索中文查询时，匹配度可能略低

**适用场景：**
- 湾区用户（即使华人也习惯英文地址和活动名）
- 快速上线，后续再考虑翻译

---

### 方案 B：添加中文字段到数据库（完全翻译）

**数据库修改：**
```sql
ALTER TABLE events ADD COLUMN title_zh TEXT NOT NULL;
ALTER TABLE events ADD COLUMN description_zh TEXT;
```

**数据结构：**
- `title`: "Golden Gate Park Concert"
- `title_zh`: "金门公园音乐会"
- `location`: "1275 Minnesota Street, San Francisco"
- `description`: "Opening Night Reception..."
- `description_zh`: "开幕酒会：周六..."

**优势：**
- ✅ 完全本地化体验
- ✅ AI 中文查询匹配度高
- ✅ 用户体验更好

**劣势：**
- ❌ 需要翻译流程（人工或 AI）
- ❌ 维护成本高（每个活动都要翻译）
- ❌ 数据库大小增加
- ⚠️ 需要修改 scraper 流程

---

### 方案 C：混合方案（可选翻译）🔄 未来升级路径

**数据库修改：**
```sql
ALTER TABLE events ADD COLUMN title_zh TEXT;        -- 可选
ALTER TABLE events ADD COLUMN description_zh TEXT;  -- 可选
```

**翻译策略：渐进式**

**阶段 1（MVP - 当前方案 A）：**
- UI 全部双语
- 活动数据保持英文
- `title_zh` 和 `description_zh` 字段不存在

**阶段 2（有资源后）：**
- 添加可选的中文字段到数据库
- 对高优先级活动（priority > 5）进行翻译
- 使用 AI 翻译 API（如 DeepL, Google Translate）
- 或者，用户贡献翻译

**阶段 3（长期）：**
- 建立完整的翻译流程
- 可能引入人工审核

**查询逻辑：**
```typescript
function getEventTitle(event, locale) {
  if (locale === 'zh' && event.title_zh) {
    return event.title_zh;  // 有中文翻译就用
  }
  return event.title;  // 否则用英文
}
```

**优势：**
- ✅ 灵活扩展，不强制翻译
- ✅ 可以先上线，后优化
- ✅ 数据库改动较小
- ✅ 不影响现有流程（title_zh 为 NULL 时用英文）
- ✅ 向后兼容

---

## 对现有流程的影响分析

### 当前流程：
```
1. Scraper 抓取活动 → 存入 events.db
2. AI 分类 event_type, priority
3. 小红书生成读取 events.db → 生成帖子
```

### 各方案影响对比：

| 方案 | Scraper 改动 | 小红书流程改动 | 风险 |
|------|------------|--------------|-----|
| A（只翻译UI）| 无需改动 | 无需改动 | ✅ 零风险 |
| B（必须翻译）| 需要添加翻译步骤 | 需要选择语言字段 | ⚠️ 中等风险 |
| C（可选翻译）| 可选添加翻译 | 兼容现有逻辑 | ✅ 低风险 |

---

## 翻译来源选项（方案 B/C 适用）

### 选项 1：AI 翻译 API
- **DeepL API**（质量最好，免费额度：500,000 字符/月）
- **Google Translate API**（便宜，质量不错）
- **OpenAI API**（可以带上下文，理解活动性质）

**成本估算：**
- 假设每周 50 个新活动
- 每个活动标题 + 描述约 200 字
- 每周 10,000 字 → 每月 40,000 字
- DeepL 免费额度完全够用

### 选项 2：人工翻译
- 自己翻译重点活动
- 或者，招募社区志愿者

### 选项 3：依赖用户浏览器翻译
- 添加提示："使用浏览器翻译功能"
- Chrome/Safari 自动翻译

---

## 升级路径：方案 A → 方案 C

### 数据库迁移：
```sql
-- 添加可选字段
ALTER TABLE events ADD COLUMN title_zh TEXT;
ALTER TABLE events ADD COLUMN description_zh TEXT;

-- 添加索引（如果需要按翻译状态查询）
CREATE INDEX idx_events_translated ON events(title_zh);
```

### 批量翻译脚本（可选）：
```python
import sqlite3
from deepl import Translator

translator = Translator(auth_key="YOUR_KEY")

db = sqlite3.connect('events.db')
cursor = db.cursor()

# 只翻译高优先级活动
events = cursor.execute("""
    SELECT id, title, description
    FROM events
    WHERE title_zh IS NULL AND priority > 5
""")

for event_id, title, description in events:
    title_zh = translator.translate_text(title, target_lang="ZH")
    description_zh = translator.translate_text(description, target_lang="ZH")

    cursor.execute("""
        UPDATE events
        SET title_zh = ?, description_zh = ?
        WHERE id = ?
    """, (title_zh, description_zh, event_id))

db.commit()
```

---

## 实施建议

### 当前（方案 A）：
1. ✅ 实现 Next.js i18n 路由（/en, /zh）
2. ✅ UI 元素完全双语
3. ✅ 活动数据保持英文
4. ✅ 添加语言切换组件
5. ✅ 配置自动语言检测

### 观察期：
- 收集用户反馈
- 分析中文用户是否需要翻译活动内容
- 确定哪些字段最需要翻译

### 未来升级（方案 C）：
- 添加可选的中文字段
- 实现 AI 翻译流程
- 优先翻译高优先级活动
- 保持向后兼容

---

## 决策记录

**日期：** 2025-11-19
**决策：** 先实施方案 A（UI 双语 + 数据保持英文）
**理由：**
1. 快速上线，验证产品需求
2. 零风险，不影响现有 scraper 和小红书流程
3. 湾区用户习惯英文活动信息
4. 保留未来升级到方案 C 的灵活性

**下一步：**
- 实现 next-intl 国际化
- 创建英文和中文翻译文件
- 测试双语切换功能
- 部署到 Vercel
