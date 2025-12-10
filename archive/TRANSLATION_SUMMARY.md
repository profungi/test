# 翻译功能实现总结

## 🎯 实现的功能

为双语网站添加了自动活动标题翻译功能，支持中英文切换显示。

## ✅ 完成的工作

### 1. 核心翻译模块
**文件**: `src/utils/translator.js`

- ✅ 支持 Google Translate（免费）
- ✅ 支持 OpenAI GPT-4o-mini（付费）
- ✅ 批量翻译功能，带进度显示
- ✅ 错误处理和自动降级
- ✅ 速率限制保护

### 2. 数据库结构更新
**文件**: `src/utils/database.js`

- ✅ 添加 `title_zh` 字段到 events 表
- ✅ 自动迁移功能
- ✅ 向后兼容（字段可为空）

### 3. 爬虫流程集成
**文件**: `src/scrape-events.js`

**翻译节点**: AI 分类之后，生成审核文件之前

```
抓取 → 去重 → AI分类 → 【翻译标题】 → 生成审核文件 → 人工审核 → 发布
                              ↑ 在这里
```

**优势**:
- 只翻译筛选后的优质活动（节省成本）
- 人工审核时能看到中英文对照
- 翻译失败不影响主流程

### 4. 历史数据翻译脚本
**文件**: `translate-existing-events.js`

- ✅ 批量翻译已有的 325 个活动
- ✅ 进度显示和错误处理
- ✅ 支持重试（跳过已翻译的）
- ✅ 详细的统计报告

**运行命令**:
```bash
npm run translate-existing
```

### 5. 前端显示更新
**文件**:
- `website/lib/types.ts` - 添加 `title_zh` 类型
- `website/app/components/EventCard.tsx` - 根据语言显示对应标题

**逻辑**:
```typescript
const displayTitle = locale === 'zh' && event.title_zh
  ? event.title_zh  // 中文用户 + 有中文标题 = 显示中文
  : event.title;    // 否则显示英文
```

### 6. 配置和文档
**文件**:
- `.env.example` - 添加翻译相关环境变量
- `package.json` - 添加 `translate-existing` 脚本
- `TRANSLATION_GUIDE.md` - 详细使用指南
- `TRANSLATION_QUICKSTART.md` - 快速开始指南
- `TRANSLATION_SUMMARY.md` - 本文档

## 📊 数据统计

- **现有活动数**: 325 个
- **每周新活动**: ~103 个
- **平均标题长度**: 47 字符
- **预计翻译时间**: 3-5 分钟（首次）
- **月度成本**: $0.00（使用免费服务）

## 🌐 翻译服务对比

### Google Translate（免费）- **推荐**
- **成本**: $0.00/月
- **质量**: ⭐⭐⭐⭐ (4/5)
- **速度**: 快
- **配置**: 无需 API Key
- **限额**: 无限制（非官方接口）

### Google Translate API（官方）
- **成本**: $0.00/月（50万字符内）
- **质量**: ⭐⭐⭐⭐ (4/5)
- **速度**: 快
- **配置**: 需要 API Key
- **限额**: 50万字符/月

### OpenAI GPT-4o-mini
- **成本**: ~$0.004/月
- **质量**: ⭐⭐⭐⭐⭐ (5/5)
- **速度**: 中等
- **配置**: 需要 API Key
- **限额**: 按使用量付费

## 🚀 使用方法

### 一次性翻译历史数据
```bash
npm run translate-existing
```

### 未来爬虫自动翻译
```bash
npm run scrape  # 会自动翻译新活动
```

### 切换翻译服务
```bash
# 方法 1: 环境变量
TRANSLATOR_PROVIDER=openai npm run translate-existing

# 方法 2: 命令行参数
npm run translate-existing -- --provider openai
```

## 📁 文件结构

```
/code
├── src/
│   ├── utils/
│   │   ├── translator.js          # 翻译模块（新增）
│   │   └── database.js            # 数据库迁移（已更新）
│   └── scrape-events.js           # 爬虫流程（已更新）
├── website/
│   ├── lib/
│   │   └── types.ts               # 类型定义（已更新）
│   └── app/
│       └── components/
│           └── EventCard.tsx      # 前端组件（已更新）
├── translate-existing-events.js   # 历史数据翻译脚本（新增）
├── .env.example                   # 环境变量示例（已更新）
├── package.json                   # npm 脚本（已更新）
├── TRANSLATION_GUIDE.md           # 详细指南（新增）
├── TRANSLATION_QUICKSTART.md      # 快速开始（新增）
└── TRANSLATION_SUMMARY.md         # 本文档（新增）
```

## 🔧 技术实现

### 翻译流程
```javascript
// 1. 批量提取标题
const titles = events.map(e => e.title);

// 2. 分批翻译（避免速率限制）
for (batch of batches) {
  const translations = await Promise.all(
    batch.map(title => translator.translate(title))
  );

  // 等待间隔
  await delay(1000);
}

// 3. 添加到活动对象
events.forEach((event, i) => {
  event.title_zh = translations[i];
});
```

### 数据库迁移
```javascript
async migrateAddTitleZh() {
  // 检查字段是否存在
  const columns = await db.all("PRAGMA table_info(events)");
  const hasTitleZh = columns.some(col => col.name === 'title_zh');

  // 不存在则添加
  if (!hasTitleZh) {
    await db.run("ALTER TABLE events ADD COLUMN title_zh TEXT");
  }
}
```

### 前端显示
```typescript
// 根据语言和可用性选择标题
const displayTitle = locale === 'zh' && event.title_zh
  ? event.title_zh   // 优先显示中文
  : event.title;     // 降级到英文
```

## ⚙️ 配置选项

### 环境变量
```bash
# 翻译服务提供商
TRANSLATOR_PROVIDER=google          # google 或 openai

# Google Translate API Key（可选）
GOOGLE_TRANSLATE_API_KEY=xxx

# OpenAI API Key（如使用 OpenAI）
OPENAI_API_KEY=sk-xxx
```

### 脚本参数
```bash
# 批次大小（每批翻译的数量）
batchSize: 10

# 批次间隔（毫秒）
delayMs: 1000
```

可在代码中调整：
```javascript
await translator.translateEvents(events, 10, 1000);
//                                        ^^  ^^^^
//                                        |    批次间隔
//                                        批次大小
```

## 🎯 设计决策

### 为什么在 AI 分类后翻译？

1. **成本优化**: 只翻译筛选后的优质活动（100个 vs 300+个）
2. **用户体验**: 人工审核时能看到中英文对照
3. **可靠性**: 翻译失败不影响爬虫主流程
4. **效率**: 批量处理，利用并发优势

### 为什么支持多个翻译服务？

1. **灵活性**: 用户可根据需求选择
2. **降级方案**: 一个服务失败可切换到另一个
3. **成本控制**: 免费服务足够用，付费服务质量更好
4. **可扩展**: 未来可轻松添加其他服务

### 为什么使用免费 Google Translate？

1. **零成本**: 完全免费
2. **足够好**: 活动标题翻译质量可接受
3. **无限制**: 非官方接口无配额限制
4. **易用性**: 无需注册或配置

## 🚨 注意事项

1. **网络依赖**: 翻译需要访问外部 API
2. **翻译质量**: 建议人工审核，必要时手动修正
3. **速率限制**: 已内置批次延迟保护
4. **数据完整性**: 翻译失败不影响原始数据
5. **幂等性**: 可安全地多次运行翻译脚本

## 📈 未来优化方向

1. **缓存机制**: 相同标题不重复翻译
2. **人工校对**: 添加翻译质量审核流程
3. **批量导入**: 支持从文件批量导入翻译
4. **A/B 测试**: 对比不同翻译服务的质量
5. **多语言**: 扩展到其他语言（西班牙语、日语等）

## 🎉 总结

成功实现了双语网站的活动标题自动翻译功能，具有以下特点：

- ✅ **零成本**: 使用免费 Google Translate
- ✅ **自动化**: 爬虫流程自动翻译
- ✅ **易用性**: 一条命令翻译历史数据
- ✅ **可靠性**: 错误处理和降级方案
- ✅ **可扩展**: 支持多种翻译服务
- ✅ **用户友好**: 前端自动根据语言显示

用户现在可以：
1. 运行 `npm run translate-existing` 翻译所有历史活动
2. 正常使用 `npm run scrape`，新活动会自动翻译
3. 在中文网站上看到流畅的中文标题

**下一步**: 运行 `npm run translate-existing` 开始翻译！
