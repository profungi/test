# English Posts Generator Guide

## 📝 Overview

This tool generates English posts for **Reddit** and **Nextdoor** platforms using the scraped Bay Area events from your database.

## 🚀 Quick Start

### Generate Posts

Run the interactive generator:

```bash
node generate-english-posts.js
```

Or if you have npm scripts set up:

```bash
npm run generate-english
```

### What It Does

1. Asks you to select a week (e.g., `2025-11-10_to_2025-11-16`)
2. Fetches **ALL** events from the database for that week (ignores `selected` status)
3. Shows you statistics about the events
4. Lets you choose which platform(s) to generate:
   - Reddit (Markdown format)
   - Nextdoor (Plain text format)
   - Both
5. Generates the post files in the `output/` directory

## 📁 Output Files

Generated files will be saved as:

- **Reddit**: `output/events_reddit_YYYY-MM-DD_HHMM.md`
- **Nextdoor**: `output/events_nextdoor_YYYY-MM-DD_HHMM.txt`

## 📋 Post Formats

### Reddit Format

```markdown
# Bay Area Events This Week (Nov 10-16)

Compiled a list of local events for the week. Hope you find something fun!

## Markets & Fairs

**Ferry Plaza Farmers Market**
Sat 11/15, 10:00 AM - 2:00 PM | Ferry Building, SF | Free
Fresh produce, artisan goods, over 100 vendors
https://eventbrite.com/...

## Festivals
...

---
*Sources: Eventbrite, SFStation, Funcheap. Events listed for informational purposes.*
```

**Features:**
- Events grouped by category (Markets & Fairs, Festivals, Food & Drink, Music, Arts & Culture, Tech & Business, Free Events, Other)
- Markdown formatting with headers and bold
- Clean, information-dense layout
- Source attribution at the bottom

### Nextdoor Format

```
This Week's Local Events (Nov 10-16) 🌟

Hi neighbors! I put together a list of events happening around the Bay Area this week. Thought some of you might be interested:

🛒 Sat 11/15 | Ferry Plaza Farmers Market
🕒 10:00 AM - 2:00 PM
📍 Ferry Building, SF | Free
Fresh produce, artisan goods, over 100 vendors
→ https://eventbrite.com/...

🎉 Sat 11/15 | Art Festival
🕒 6:00 PM - 9:00 PM
📍 Downtown Oakland | Free
...

Let me know if you're planning to check any of these out! 😊
```

**Features:**
- Friendly, conversational tone
- Emojis for visual appeal (but not excessive)
- Events sorted by date
- Personal touch with opening and closing

## 🎯 Key Differences from 小红书 Posts

| Feature | 小红书 | Reddit/Nextdoor |
|---------|--------|-----------------|
| Language | Chinese | English |
| Translation | Yes, AI-powered | No, uses original text |
| Short URLs | Yes, via Short.io | No, original URLs |
| Event Selection | Manual review, `selected: true` | All scraped events |
| Length Limit | 1000 chars | No practical limit |
| AI Processing | Yes | No |

## 💡 Platform-Specific Tips

### Reddit

**Best Subreddits:**
- r/BayArea (largest audience)
- r/sanfrancisco
- r/oakland
- r/SanJose (for South Bay events)

**Posting Tips:**
- **Title**: Keep it simple and informative
  - Good: "Bay Area Events This Week (Nov 10-16)"
  - Bad: "Amazing events you don't want to miss!!!"
- **Best Time**: Thursday evening or Friday morning (when people plan weekends)
- **Tone**: Neutral and helpful, avoid promotional language
- **Engagement**: Respond to comments, be helpful

**Reddit Etiquette:**
- Don't spam multiple subreddits at once
- Don't post every week unless it's well-received
- Be transparent (mention it's aggregated from public sources)
- Accept feedback gracefully

### Nextdoor

**Posting Tips:**
- **Neighborhood Selection**: Choose the broadest relevant area
- **Category**: Select "Events" or "General"
- **Best Time**: Thursday afternoon or Friday morning
- **Tone**: Friendly and conversational, like talking to neighbors
- **Length**: Keep it reasonable (10-20 events max)

**Nextdoor Etiquette:**
- Focus on family-friendly events
- Emphasize free and local events
- Engage with neighbors who comment
- Don't post too frequently (once a week max)

## 🔧 Customization

### Edit Templates

Templates are in `src/config.js` under `englishPlatforms`:

```javascript
englishPlatforms: {
  reddit: {
    headerTemplate: `...`,
    eventTemplate: `...`,
    footerTemplate: `...`,
    groupByCategory: true
  },
  nextdoor: {
    // ...
  }
}
```

### Event Emoji Mapping

Located in `src/formatters/english-post-generator.js`:

```javascript
getEventEmoji(eventType) {
  const emojiMap = {
    'market': '🛒',
    'fair': '🎪',
    'festival': '🎉',
    'food': '🍽️',
    'music': '🎵',
    'art': '🎨',
    'tech': '💻',
    'free': '🆓',
    'other': '📅'
  };
  return emojiMap[eventType] || '📅';
}
```

## 📊 Event Data

### What Gets Included

- **All events** from the database for the selected week
- No filtering by `selected` status
- Includes all event types (market, festival, food, music, art, tech, free, other)
- Both free and paid events

### Event Information

Each event includes:
- Title (original English)
- Date and time
- Location
- Price
- Description (from `description_detail` or `description` field)
- Original event URL

### Data Sources

Events are scraped from:
- Eventbrite (multiple Bay Area cities)
- SFStation
- Funcheap

## 🐛 Troubleshooting

### "No events found for this week"

Run the scraper first:

```bash
node src/scrape-events.js
```

### "Invalid week identifier"

Format should be: `YYYY-MM-DD_to_YYYY-MM-DD`

Example: `2025-11-10_to_2025-11-16`

### Check Available Weeks

```bash
sqlite3 data/events.db "SELECT DISTINCT week_identifier FROM events ORDER BY week_identifier DESC LIMIT 5;"
```

### Test the Generator

Quick test script:

```bash
node test-english-generator.js
```

This will generate both Reddit and Nextdoor posts for a hardcoded week.

## 📝 Manual Editing

After generation:

1. Open the generated `.md` or `.txt` file
2. Review the content
3. Make any manual edits:
   - Remove events you don't want to include
   - Fix formatting issues
   - Add personal commentary
4. Copy and paste to the platform

## 🔮 Future Enhancements

Potential features to add:

- [ ] Filter by event type or location
- [ ] Custom event selection (interactive picker)
- [ ] Automatic posting via Reddit API
- [ ] Image generation for posts
- [ ] Performance tracking (like the 小红书 feedback loop)
- [ ] Template variants (formal vs casual)

## 📚 Related Files

- `src/formatters/english-post-generator.js` - Main generator
- `src/config.js` - Templates and configuration
- `generate-english-posts.js` - CLI tool
- `test-english-generator.js` - Quick test script
- `src/utils/database.js` - Database interface

## ❓ Questions?

Check the main README.md or existing documentation:
- `README.md` - Project overview
- `ARCHITECTURE.md` - System architecture
- `COMMANDS_REFERENCE.md` - All available commands
