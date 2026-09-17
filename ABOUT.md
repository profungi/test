# 📚 项目相关服务与产品清单 (About Services)

本文档整理了本项目（Bay Area Selected 湾区活动精选 / 爬虫与前端）目前所使用的所有**外部服务、API 及核心技术产品**，方便未来查阅与维护。

---

## 1. 🤖 AI大模型与翻译服务 (AI & Translation)
用于处理活动的**中文翻译**（标题）和**内容总结**（摘要/小红书文案）。代码中实现了优雅的降级和轮换机制。

*   **NewAPI (yinli.one)**
    *   **用途**：首选的第三方 AI 接口中转站（高优先级）。
    *   **配置**：当前使用 `gpt-4o-mini` 模型。
    *   **状态**：已配置有效 Key，渠道畅通。
*   **Google Gemini API**
    *   **用途**：主要的官方 AI 接口。代码支持配置多个 Key (`GEMINI_API_KEY`, `GEMINI_API_KEY_2`) 轮换以突破免费额度限制。
    *   **配置**：当前使用 `gemini-2.5-flash` 模型。
    *   **状态**：免费 tier (1500次/天，部分账号限 20次/天)，遇到 429 限速会自动等待 30 秒。
*   **Google Translate (免费接口)**
    *   **用途**：翻译服务的终极降级方案（无需 API Key）。
    *   **状态**：使用非官方公开 API 接口，爬虫翻译失败时自动调用。
*   **其他内置支持的 AI (备用)**
    *   **Mistral**：代码已接通 `mistral-small-latest`，当前账号免费额度已耗尽。
    *   **OpenAI/Claude**：代码支持直连官方，当前未配置官方 Key。

---

## 2. 🗄️ 数据库与存储引擎 (Database & Storage)
用于存储所有抓取到的活动信息以及生成的内容。

*   **Turso (libSQL)**
    *   **用途**：**核心生产数据库**（Serverless Edge SQLite）。
    *   **机制**：爬虫抓取数据后直接写入 Turso，前端网站通过 URL 读取。支持本地与云端的实时同步。
    *   **相关配置**：`TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。
*   **SQLite (本地)**
    *   **用途**：本地开发、测试时使用的轻量级数据库（`db.sqlite`）。

---

## 3. 🌐 前端框架与网站架构 (Frontend & Web)
网站代码位于 `website/` 目录中。

*   **Next.js (App Router)**
    *   **用途**：整个前端网站的基础框架，支持 SSR（服务端渲染），利于 SEO。
*   **React**
    *   **用途**：构建前端交互组件（如 `FilterBar`, `EventCard`）。
*   **Tailwind CSS**
    *   **用途**：用于页面元素的快速样式编写和响应式设计。
*   **Vercel (推测部署平台)**
    *   **用途**：托管并自动部署前端 Next.js 项目。

---

## 4. 🔌 第三方 API 集成 (Third-party Integrations)

*   **Short.io API**
    *   **用途**：生成活动的短链接。
    *   **场景**：主要用于生成发在**小红书**等社交平台上的紧凑型链接。
    *   **配置**：域名设定为 `ymjr.de` 或 `short.io`。
*   **Eventbrite API**
    *   **用途**：直接获取 Eventbrite 平台上的高质量活动数据（需要 API Key）。
*   **Resend** *(可选配置)*
    *   **用途**：邮件发送服务，保留了接口但当前似乎并非核心强依赖。

---

> **维护说明**：如果要更新这些服务的 API Key，请修改项目根目录的 `.env` 或 `.env.local` 文件，爬虫及前端都会自动加载。
