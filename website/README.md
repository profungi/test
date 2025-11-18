# 湾区活动网站 Bay Area Events Website

基于 Next.js 14 构建的湾区活动展示网站。

## ✅ 已完成

- ✅ 数据库查询模块 (`lib/db.ts`)
- ✅ TypeScript 类型定义 (`lib/types.ts`)
- ✅ 首页服务器组件 (`app/page.tsx`)
- ✅ 活动卡片组件 (`app/components/EventCard.tsx`)
- ✅ 筛选栏组件 (`app/components/FilterBar.tsx`)
- ✅ Next.js 配置 (`next.config.ts`)

### 关键特性
- 🗄️ **单一数据库**: 使用 `../data/events.db`
- 🔒 **只读模式 + WAL**: 不影响爬虫
- ⚡ **ISR 缓存**: 1小时重新验证
- 🎨 **响应式设计**: Tailwind CSS

## 🚀 下一步操作

### 1. 本地测试
```bash
cd website
npm run dev
```
访问 http://localhost:3000

### 2. 提交代码
```bash
cd ..
git add website/ WEBSITE_DESIGN.md SETUP_GUIDE.md
git commit -m "Add Bay Area Events website" --trailer "Co-authored-by: Sculptor <sculptor@imbue.com>"
git push
```

### 3. 部署到 Vercel
1. 登录 https://vercel.com (用 GitHub)
2. 点击 "Add New Project"
3. 选择仓库
4. **Root Directory**: `website` ← 重要！
5. 点击 "Deploy"

## 📊 自动更新

每周三：
1. GitHub Actions 运行爬虫
2. 更新 `data/events.db`
3. Git push
4. Vercel 自动部署
5. 30-60秒后生效

**完全自动化！**

## 📚 完整文档

- `../WEBSITE_DESIGN.md` - 设计文档
- `../SETUP_GUIDE.md` - 详细指南
