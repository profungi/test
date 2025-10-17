# 短链接功能总结

## ✅ 已实现的功能

### 1. 4位随机代码生成
- **字符集**: `0-9, A-Z, a-z` (共62个字符)
- **代码长度**: 4位
- **可能组合**: 62^4 = 14,776,336 种
- **示例**: `a3Bz`, `9K2m`, `Xy8L`

### 2. 自动去重和重试
- 如果生成的代码已存在，自动重试
- 最多重试5次
- 处理API返回的409和400错误（路径冲突）

### 3. 智能标签支持 (Tags)
- 根据活动价格和地点**自动添加标签**
- 免费活动自动添加 `free` 标签
- 根据地点自动添加区域标签（SF、South-Bay、Peninsula、East-Bay、North-Bay）
- 标签可用于在Short.io后台分类和追踪链接

### 4. API调用修复
- 使用正确的headers格式
- 添加 `path` 参数来指定自定义短代码
- 添加 `title` 参数来设置链接标题
- 设置 `allowDuplicates: false` 防止重复

## 标签的自动添加逻辑

当生成短链接时，会根据活动的**价格**和**地点**自动添加标签：

### 1. 免费活动标签
如果活动是免费的，添加 `free` 标签

判断标准：
- 价格包含 "Free" 或 "免费"
- 价格为 "$0" 或 "$0.00"

### 2. 地点标签
根据活动地点自动添加区域标签：

| 区域 | 标签 | 包含城市 |
|------|------|----------|
| 旧金山 | `SF` | San Francisco |
| 南湾 | `South-Bay` | San Jose, Santa Clara, Los Gatos, Campbell |
| 半岛 | `Peninsula` | Palo Alto, Mountain View, San Mateo, Redwood City, San Carlos |
| 东湾 | `East-Bay` | Oakland, Fremont, Berkeley, Concord |
| 北湾 | `North-Bay` | Santa Rosa, San Rafael, Napa, Mill Valley |

### 标签示例

**免费音乐节 - 旧金山**
- 标签: `free`, `SF`

**付费科技会议 - San Jose**
- 标签: `South-Bay`

**免费社区活动 - Oakland**
- 标签: `free`, `East-Bay`

**付费美食节 - Mountain View**
- 标签: `Peninsula`

## 配置说明

### 环境变量 (.env)

```bash
# Short.io API密钥（必需）
SHORTIO_API_KEY=你的API密钥

# Short.io域名（必需）- 从 get-shortio-domains.js 获取
SHORTIO_DOMAIN=你的域名
```

### 获取配置信息和测试

1. **获取域名列表**:
   ```bash
   node get-shortio-domains.js
   ```

2. **测试API连接和功能**:
   ```bash
   node test-shorturl.js
   ```

3. **测试标签生成逻辑**:
   ```bash
   node test-tag-logic.js
   ```

4. **调试API问题**:
   ```bash
   node debug-shorturl-api.js
   ```

## 使用示例

### 生成单个短链接（手动指定标签）
```javascript
const URLShortener = require('./src/utils/url-shortener');
const shortener = new URLShortener();

const shortUrl = await shortener.shortenUrl(
  'https://example.com/event-123',
  'Event Title',
  ['custom-tag-1', 'custom-tag-2']
);
// 返回: https://你的域名.short.io/X9mL
// 标签: custom-tag-1, custom-tag-2
```

### 批量生成短链接（自动标签）
```javascript
const events = [
  {
    title: 'Free Concert',
    original_url: 'https://...',
    price: 'Free',
    location: 'San Francisco, CA'
  },
  {
    title: 'Tech Meetup',
    original_url: 'https://...',
    price: '$10',
    location: 'Palo Alto, CA'
  },
  {
    title: 'Community Event',
    original_url: 'https://...',
    price: '$0',
    location: 'Oakland, CA'
  }
];

const result = await shortener.generateShortUrls(events);
// 第一个链接标签: ['free', 'SF']
// 第二个链接标签: ['Peninsula']
// 第三个链接标签: ['free', 'East-Bay']
```

## 技术实现细节

### 文件修改
1. **src/utils/url-shortener.js**
   - 添加 `generate4CharCode()` 生成4位随机代码
   - 修改 `shortenUrl()` 支持tags参数，在创建链接时直接添加标签
   - 添加 `generateTagsForEvent()` 根据活动信息生成标签
   - 添加 `isFreeEvent()` 判断是否免费活动
   - 添加 `getLocationTag()` 根据地点获取区域标签

2. **src/config.js**
   - 移除了 `defaultTags` 配置项（改为自动判断）

3. **src/generate-post.js**
   - 移除了 `defaultTags` 参数传递

4. **.env.example**
   - 添加 `SHORTIO_DOMAIN`
   - 移除了 `SHORTIO_DEFAULT_TAGS`（改为自动判断）

### API端点
- **创建短链接（含标签）**: `POST https://api.short.io/links`
  - 支持在创建时直接传递 `tags` 参数
  - 标签会在短链接创建时一起添加，无需额外API调用

## 测试

### 1. 测试标签逻辑
运行标签逻辑测试，验证免费活动和地点标签判断：
```bash
node test-tag-logic.js
```

测试包括13个用例，覆盖：
- 免费活动判断
- 各个区域的地点判断
- 边界情况（无价格、无地点等）

### 2. 测试完整功能
运行完整API测试：
```bash
node test-shorturl.js
```

测试包括：
1. 生成10个示例4位代码
2. 生成不带标签的短链接
3. 生成带标签的短链接
4. 批量生成3个短链接
5. 显示统计信息

## 注意事项

1. **API限制**: 添加延迟避免API rate limiting
2. **标签失败不影响链接生成**: 如果标签添加失败，链接依然会创建成功
3. **重试机制**: 遇到代码冲突会自动重试最多5次
4. **LinkId**: 创建链接后返回的 `idString` 或 `id` 用于添加标签
5. **标签自动化**: 不需要手动配置标签，系统根据活动信息自动判断

## 查看标签

在Short.io后台可以：
1. 访问 https://app.short.io/links
2. 查看每个链接的标签
3. 使用标签筛选和分类链接（如筛选所有免费活动、所有SF活动等）
4. 查看每个标签的统计数据和点击量
