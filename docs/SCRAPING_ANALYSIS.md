# Scraping Configuration Analysis

> **Generated**: 2026-01-05  
> **Source**: Complete analysis of scraper code and configuration

## Overview

This document analyzes the current scraping setup, data sources, and configuration limits.

For detailed analysis, see: `/scraping-config-review.md`

---

## Current Data Sources (4 active)

| Source | Type | Status | This Week | Theoretical Max |
|--------|------|--------|-----------|----------------|
| **SJ Downtown API** | REST API | ✅ Excellent | 17 | 50 |
| **SF Station** | HTML | ✅ Good | 25 | 60 |
| **Eventbrite** | HTML | ⚠️ Underperforming | 11 | 150 |
| **Funcheap** | HTML | ❌ Poor | 1 | 50 |

**Total**: 54 events/week (Target: 60-100)

---

## Data Source Quality

### ⭐⭐⭐⭐⭐ SJ Downtown (REST API)
- **Stability**: Highest (REST API won't break)
- **Coverage**: San Jose Downtown, SoFA District
- **Event Types**: First Fridays, markets, art events
- **Update Frequency**: Real-time

### ⭐⭐⭐⭐ SF Station
- **Stability**: High
- **Coverage**: San Francisco citywide
- **Event Types**: Community, volunteer, cultural events
- **Note**: Many free volunteer activities

### ⭐⭐⭐⭐⭐ Eventbrite (Currently Issues)
- **Stability**: Medium (CSS changes affect scraping)
- **Coverage**: 15+ Bay Area cities
- **Event Types**: Commercial, paid, diverse
- **Issue**: Should get 80-150, only getting 11

### ⭐⭐⭐ Funcheap (Currently Issues)
- **Stability**: Low (CSS selectors failing)
- **Coverage**: SF primarily
- **Event Types**: Free events, festivals, markets
- **Issue**: Should get 20-50, only getting 1

---

## Potential Sources (Not Yet Activated)

### AI Scraping Sources (60+ configured)
- **Monthly**: San José Made, 365 Night Market, Oakland First Fridays
- **Seasonal (Jan-Feb)**: SF Chinese New Year Parade
- **Seasonal (Spring-Fall)**: 50+ festivals, fairs, cultural events

### Fixed-Time Events
- **First Fridays ArtWalk** (monthly)
- **Berryessa Night Market** (Apr-Oct, weekly)

---

## Key Findings

1. **SJ Downtown API is the most reliable source** (REST API)
2. **Eventbrite has potential for 10x more events** (150 vs 11)
3. **Funcheap CSS selectors likely broken** (1 vs 50)
4. **60+ seasonal sources not utilized** (winter months)

---

## Recommendations

### Priority 0 (Critical)
1. Fix Eventbrite scraper (debug CSS selectors)
2. Fix Funcheap scraper (update selectors)

### Priority 1 (High Impact)
3. Enable AI scraping sources (4 monthly + 1 seasonal)
4. Add more REST API sources (like SJ Downtown)

### Priority 2 (Long-term)
5. Increase scraper limits
6. Add farmers market specific scrapers
7. Optimize quality filtering

---

For complete analysis with code examples and debugging steps:
- See: `/scraping-config-review.md`
- Run: `npm run debug-eventbrite` to diagnose issues
