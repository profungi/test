# 隐藏已过期活动功能

## 功能说明

网站现在会自动隐藏 `start_time` 在今天之前的活动，只显示今天及未来的活动。

## 实现细节

### 修改文件
- `/code/website/lib/turso-db.ts` - `getEvents()` 函数

### 过滤逻辑

在数据库查询时添加了日期过滤条件：

```typescript
// 6. 过滤已过期的活动（start_time 在今天之前的不显示）
const pacificToday = getPacificDate();
const todayStr = `${pacificToday.getFullYear()}-${String(pacificToday.getMonth() + 1).padStart(2, '0')}-${String(pacificToday.getDate()).padStart(2, '0')}`;

// 计算 Pacific 时区偏移量（自动处理夏令时）
const now = new Date();
const pacificTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
const utcTimeStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
const pacificTime = new Date(pacificTimeStr);
const utcTime = new Date(utcTimeStr);
const offsetHours = Math.round((utcTime.getTime() - pacificTime.getTime()) / (1000 * 60 * 60));

// SQL 过滤条件
conditions.push(`date(datetime(start_time, '-${offsetHours} hours')) >= ?`);
params.push(todayStr);
```

### 关键点

1. **时区处理**：数据库中存储的是 UTC 时间，需要转换为 Pacific 时区后再比较日期
   - 使用 SQLite 的 `datetime(start_time, '-N hours')` 转换时区
   - 自动计算偏移量，支持夏令时（PST: UTC-8, PDT: UTC-7）

2. **日期比较**：使用 `date()` 函数只比较日期部分，忽略具体时间
   - 今天的活动（任何时间）：显示 ✓
   - 今天之前的活动：隐藏 ✗
   - 今天之后的活动：显示 ✓

3. **数据保留**：过期活动仍保留在数据库中，只是查询时不返回

4. **缓存**：页面使用 ISR 缓存 1 小时，过期活动可能在缓存刷新前仍然显示（最多延迟 1 小时）

## 示例

假设今天是 2026-01-06（Pacific 时区）：

| start_time (UTC) | Pacific 时区 | 是否显示 |
|------------------|--------------|----------|
| 2026-01-05T10:00:00.000Z | 2026-01-05 02:00 | ✗ 过滤 |
| 2026-01-06T03:30:00.000Z | 2026-01-05 19:30 | ✗ 过滤 |
| 2026-01-06T08:00:00.000Z | 2026-01-06 00:00 | ✓ 显示 |
| 2026-01-06T18:00:00.000Z | 2026-01-06 10:00 | ✓ 显示 |
| 2026-01-07T10:00:00.000Z | 2026-01-07 02:00 | ✓ 显示 |

## 性能影响

- 过滤在数据库层面执行，不会增加网络传输
- SQL 查询增加了一个日期函数计算，性能影响可忽略不计
- 使用了现有的 ISR 缓存机制，无额外性能开销
