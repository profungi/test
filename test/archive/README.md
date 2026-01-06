# Archived Test Files

这些测试文件已完成其目的，现已归档以供参考。

## 已完成的调试工具

### ID 迁移相关
- `debug-id-propagation.js` - 调试 ID 传递问题
- `test-id-migration.js` - 测试 ID 迁移逻辑
- 相关文档: [docs/archive/EVENTBRITE_DATA_FIX.md](../../docs/archive/EVENTBRITE_DATA_FIX.md)

### 去重性能测试
- `test-dedup-performance.js` - 测试去重时 performance 数据保留策略
- 相关文档: [docs/archive/DEDUPLICATION_REPORT.md](../../docs/archive/DEDUPLICATION_REPORT.md)

### 工作流调试
- `debug-scrape-workflow.js` - 调试抓取工作流
- `debug-translation-update.js` - 调试翻译更新问题

### 爬虫开发测试
- `test-configurable-scrapers.js` - 可配置爬虫测试
- `test-css-candidates.js` - CSS 选择器候选测试
- `test-dothebay-deep.js` - DoTheBay 深度抓取测试
- `test-new-sources.js` - 新数据源测试
- `test-ai-extraction.js` - AI 提取测试
- 相关文档: [docs/scraping-config-review.md](../../docs/scraping-config-review.md)

### 诊断工具
- `diagnose-scrape-issue.js` - 抓取问题诊断
- `quick-test-fixes.js` - 快速测试修复

## 当前活跃的测试工具

请参考主项目根目录下的测试文件：
- `test-scrape-isolated.js` - 隔离抓取测试
- `test-scrape-quick.js` - 快速抓取测试
- `test-full-scrape-workflow.js` - 完整工作流测试
- `test-translation-summary-update.js` - 翻译摘要更新测试
- `scrape-single-source-debug.js` - 单源调试工具（推荐）

详细测试指南: [docs/TESTING.md](../../docs/TESTING.md)
