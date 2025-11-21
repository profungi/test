# English Posts Generator (Reddit & Nextdoor)

Generate English event posts for Reddit and Nextdoor from scraped Bay Area events.

## Quick Start

```bash
# View demo
node demo-english-posts.js

# Generate posts
npm run generate-english
```

## Features

- ✅ Reddit Markdown format (小红书 style with emojis)
- ✅ Nextdoor text format (community friendly)
- ✅ Full descriptions (no truncation)
- ✅ Smart address formatting (auto-adds commas)
- ✅ Removes "Overview" prefix
- ✅ All scraped events (no filtering needed)
- ✅ No translation, no short URLs

## Format Examples

### Reddit
```markdown
**🛒 Ferry Plaza Farmers Market**
🕒 Sat 11/15, 10:00 AM - 2:00 PM
📍 San Francisco, CA
💰 Free
✨ Fresh produce, artisan goods, 100+ vendors
🔗 https://eventbrite.com/...
```

### Nextdoor
```
🛒 Sat 11/15 | Ferry Plaza Farmers Market
🕒 10:00 AM - 2:00 PM
📍 San Francisco, CA | Free
Fresh produce, artisan goods, 100+ vendors
→ https://eventbrite.com/...
```

## Usage

1. Run `npm run generate-english`
2. Enter week (e.g., `2025-11-10_to_2025-11-16`)
3. Choose platform (1=Reddit, 2=Nextdoor, 3=Both)
4. Files saved to `output/` directory

## Output Files

- `output/events_reddit_YYYY-MM-DD_HHMM.md`
- `output/events_nextdoor_YYYY-MM-DD_HHMM.txt`

## Posting Tips

**Reddit** (r/BayArea):
- Post Thursday evening or Friday morning
- Use neutral, helpful tone
- Avoid promotional language

**Nextdoor**:
- Post Thursday afternoon or Friday morning
- Use friendly, conversational tone
- Emphasize free/family events

## Files

- `src/formatters/english-post-generator.js` - Core generator
- `generate-english-posts.js` - CLI tool
- `demo-english-posts.js` - Demo script
- `test-english-generator.js` - Test script

## Customization

Edit templates in `src/config.js` under `englishPlatforms`:

```javascript
englishPlatforms: {
  reddit: {
    headerTemplate: `...`,
    eventTemplate: `...`,
    footerTemplate: `...`
  }
}
```
