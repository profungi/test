# 文档目录

本文件夹包含项目的详细文档。

## 文档结构

```
docs/
├── README.md              # 本文件
├── DATABASE_CONFIG.md     # 数据库配置说明
├── DATA_ARCHITECTURE.md   # 数据架构设计
├── TRANSLATION_GUIDE.md   # 翻译功能指南
├── features/              # 功能文档
│   ├── AI_SUMMARY_FEATURE.md       # AI 摘要功能
│   ├── I18N_STRATEGY.md            # 国际化策略
│   ├── USER_FEEDBACK_DOCUMENTATION.md  # 用户反馈功能
│   └── WEBSITE_DESIGN.md           # 网站设计文档
├── setup/                 # 设置和指南
│   ├── COMMANDS_REFERENCE.md   # 命令参考
│   ├── DEDUPLICATION_GUIDE.md  # 去重功能指南
│   ├── QUICK_START.md          # 快速入门
│   └── SETUP_GUIDE.md          # 初始设置指南
└── archive/               # 历史文档归档
    └── ...                # 开发过程中的报告和总结
```

## 主要文档

### 功能文档 (`features/`)

| 文档 | 说明 |
|------|------|
| [AI_SUMMARY_FEATURE.md](features/AI_SUMMARY_FEATURE.md) | AI 活动摘要生成功能 |
| [USER_FEEDBACK_DOCUMENTATION.md](features/USER_FEEDBACK_DOCUMENTATION.md) | 用户反馈和偏好记忆功能 |
| [I18N_STRATEGY.md](features/I18N_STRATEGY.md) | 网站国际化方案 |
| [WEBSITE_DESIGN.md](features/WEBSITE_DESIGN.md) | 网站 UI/UX 设计文档 |

### 设置指南 (`setup/`)

| 文档 | 说明 |
|------|------|
| [QUICK_START.md](setup/QUICK_START.md) | 快速入门指南 |
| [SETUP_GUIDE.md](setup/SETUP_GUIDE.md) | 完整设置指南 |
| [DEDUPLICATION_GUIDE.md](setup/DEDUPLICATION_GUIDE.md) | 数据去重功能指南 |
| [COMMANDS_REFERENCE.md](setup/COMMANDS_REFERENCE.md) | 命令行参考 |

### 核心文档

| 文档 | 说明 |
|------|------|
| [DATABASE_CONFIG.md](DATABASE_CONFIG.md) | Turso 和本地 SQLite 配置 |
| [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) | 数据流和架构设计 |
| [TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md) | 翻译 API 配置和使用 |

### 根目录文档

| 文档 | 说明 |
|------|------|
| [../README.md](../README.md) | 项目总览 |
| [../COMMANDS.md](../COMMANDS.md) | 命令大全（推荐入口） |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | 系统架构详解 |

## 归档文档

`archive/` 文件夹包含开发过程中的历史文档，如 Sprint 总结、Bug 修复报告、功能实施记录等。这些文档主要用于参考，不需要日常查阅。

---

**最后更新**: 2024-12-17
