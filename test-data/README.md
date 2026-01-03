# 测试数据目录

此目录用于存放隔离测试的数据库文件，不会影响生产或开发数据库。

## 文件说明

- `test-scrape.db` - 隔离测试时创建的SQLite数据库
- 此数据库在每次运行 `npm run test-scrape` 时会被重新创建（删除旧数据）

## 使用方法

### 运行隔离测试（下周活动）
```bash
npm run test-scrape
```

### 运行隔离测试（本周活动）
```bash
npm run test-scrape-current
```

### 查看测试数据库
```bash
# 使用sqlite3命令行
sqlite3 test-data/test-scrape.db

# 查询所有活动
sqlite3 test-data/test-scrape.db "SELECT title, source, start_time FROM events LIMIT 10;"

# 按来源统计
sqlite3 test-data/test-scrape.db "SELECT source, COUNT(*) as count FROM events GROUP BY source;"
```

### 清理测试数据
```bash
rm -rf test-data/
```

## 特点

✅ **完全隔离** - 不会污染 Turso 云数据库或本地开发数据库
✅ **自动清理** - 每次测试前自动删除旧数据
✅ **完整流程** - 运行完整的 scrape 流程（抓取、翻译、摘要、分类）
✅ **详细统计** - 测试结束后显示数据库统计信息

## 与正常scrape的区别

| 特性 | npm run scrape | npm run test-scrape |
|------|----------------|---------------------|
| 数据库 | Turso（生产）或本地开发 | 独立测试数据库 |
| 数据持久化 | 是 | 否（每次重新创建） |
| 数据同步 | 自动同步到Turso | 不同步 |
| 用途 | 生产环境抓取 | 调试和测试 |
