# Documentation Index

> Central directory for all project documentation

---

## 📚 Core Documentation

### Getting Started
- **[README.md](../README.md)** - Project overview and quick start
- **[COMMANDS.md](../COMMANDS.md)** - All available npm commands
- **[Setup Guide](./setup/)** - Installation and configuration

### Architecture
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - System design and workflow
- **[DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md)** - Database schema and data flow
- **[DATABASE_CONFIG.md](./DATABASE_CONFIG.md)** - Database setup (SQLite & Turso)

---

## 🔧 Development

### Configuration & Analysis
- **[scraping-config-review.md](./scraping-config-review.md)** - **⭐ Complete scraper analysis**
  - Detailed code review of all scrapers
  - Data source comparison and limits
  - Debugging decision trees
  - Performance analysis

- **[SCRAPING_ANALYSIS.md](./SCRAPING_ANALYSIS.md)** - Quick reference summary
  - Current data sources overview
  - Quality comparison table
  - Recommendations

### Testing & Debugging
- **[TESTING.md](./TESTING.md)** - Testing guide
  - Debug tools usage
  - Testing workflow
  - Troubleshooting

### Translation & Content
- **[TRANSLATION_GUIDE.md](./TRANSLATION_GUIDE.md)** - Translation system guide
  - Provider configuration
  - API setup
  - Troubleshooting

---

## 🎯 Quick Reference

### By Use Case

**I want to...**

- **Understand the system** → [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Run scraping commands** → [COMMANDS.md](../COMMANDS.md)
- **Debug scrapers** → [TESTING.md](./TESTING.md) + [scraping-config-review.md](./scraping-config-review.md)
- **Analyze data sources** → [SCRAPING_ANALYSIS.md](./SCRAPING_ANALYSIS.md)
- **Setup database** → [DATABASE_CONFIG.md](./DATABASE_CONFIG.md)
- **Configure translation** → [TRANSLATION_GUIDE.md](./TRANSLATION_GUIDE.md)

### By Role

**Developer**
1. [ARCHITECTURE.md](../ARCHITECTURE.md) - Understand system design
2. [scraping-config-review.md](./scraping-config-review.md) - Deep dive into scrapers
3. [TESTING.md](./TESTING.md) - Testing workflow

**Operations**
1. [COMMANDS.md](../COMMANDS.md) - All commands
2. [DATABASE_CONFIG.md](./DATABASE_CONFIG.md) - Database setup
3. [SCRAPING_ANALYSIS.md](./SCRAPING_ANALYSIS.md) - Data source status

**Content Manager**
1. [README.md](../README.md) - Quick start
2. [TRANSLATION_GUIDE.md](./TRANSLATION_GUIDE.md) - Translation setup

---

## 📊 Key Insights (as of 2026-01-05)

### Data Sources Performance
- ✅ **SJ Downtown API**: Most reliable (REST API, 17/50)
- ✅ **SF Station**: Good (HTML, 25/60)
- ⚠️ **Eventbrite**: Underperforming (11/150) - needs debugging
- ❌ **Funcheap**: Poor (1/50) - selectors broken

### Current Status
- **Active scrapers**: 4
- **Weekly events**: ~54 (target: 60-100)
- **Potential sources**: 60+ seasonal AI sources
- **Key issue**: Eventbrite & Funcheap underperforming

### Next Steps
1. Debug Eventbrite CSS selectors → [scraping-config-review.md](./scraping-config-review.md#eventbrite-scraper)
2. Fix Funcheap selectors
3. Enable AI scraping sources
4. Add more REST API sources

---

## 📁 Directory Structure

```
docs/
├── INDEX.md                        # ← You are here
├── README.md                       # Docs overview
├── ARCHITECTURE.md                 # System design (root)
├── COMMANDS.md                     # Commands (root)
├── scraping-config-review.md       # ⭐ Complete analysis
├── SCRAPING_ANALYSIS.md            # Quick summary
├── TESTING.md                      # Testing guide
├── DATA_ARCHITECTURE.md            # Database schema
├── DATABASE_CONFIG.md              # DB setup
├── TRANSLATION_GUIDE.md            # Translation config
├── setup/                          # Setup guides
├── features/                       # Feature documentation
└── archive/                        # Deprecated docs
```

---

## 🔗 External Links

- **Project Repository**: (Add GitHub URL)
- **Issue Tracker**: (Add GitHub Issues URL)
- **Production Dashboard**: (Add Turso/monitoring URL)

---

## 📝 Documentation Maintenance

### Last Updated
- **scraping-config-review.md**: 2026-01-05 (Complete analysis)
- **SCRAPING_ANALYSIS.md**: 2026-01-05 (Summary)
- **TESTING.md**: 2026-01-05 (Created)
- **INDEX.md**: 2026-01-05 (Created)

### Update Guidelines
1. Update analysis docs after major scraper changes
2. Keep performance metrics current (weekly review)
3. Document new scrapers in scraping-config-review.md
4. Update this index when adding new documentation

---

**Need help?** Start with [README.md](../README.md) or check the [Quick Reference](#quick-reference) above.
