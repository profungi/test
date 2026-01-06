# Testing & Debugging Guide

## Test Files Organization

### Active Debug Tools

Location: `/test/debug/`

#### `scrape-single-source-debug.js`
**Purpose**: Debug individual scrapers without saving to database
```bash
npm run debug-eventbrite
npm run debug-funcheap
npm run debug-sfstation
```
**Output**: Detailed statistics, samples, quality analysis

---

### Legacy Test Files

Location: `/test/legacy/`

These files were used during development but are now superseded by newer tools.

---

## Quick Testing Commands

### Scraper Testing
```bash
# Debug mode (no database save)
npm run debug-eventbrite
npm run debug-funcheap
npm run debug-sfstation

# With database save
npm run scrape-eventbrite
npm run scrape-funcheap
npm run scrape-sfstation

# Full scrape
npm run scrape
USE_TURSO=1 npm run scrape  # Production (Turso)
```

### Translation & Summary Testing
```bash
npm run test-translation-summary
```

### Database Testing
```bash
npm run check-turso        # Check Turso data
npm run verify-turso       # Verify Turso setup
```

---

## Development Workflow

1. **Test scraper**: `npm run debug-eventbrite`
2. **Check quality**: Review statistics output
3. **Save to DB**: `npm run scrape-eventbrite` 
4. **Full workflow**: `npm run scrape`
5. **Production**: `USE_TURSO=1 npm run scrape`

---

## Troubleshooting

### Scraper returns 0 events
- CSS selectors may have changed
- Check network connectivity
- Verify date range is correct

### Database errors
- Check `data/events.db` exists
- Verify Turso credentials (`.env`)
- Run `npm run verify-turso`

### Translation/Summary not saving
- Ensure event has `id` field
- Check API keys in `.env`
- Run `npm run test-translation-summary`
