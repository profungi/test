# Saratoga Events Not Being Scraped - Debug Analysis

## Event Information
- **Event**: French Holiday Market
- **URL**: https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039
- **Location**: Saratoga, CA
- **Issue**: Not appearing in scrape results despite being a quality event

## Configuration Status ✅

### 1. City in Scraping List
**File**: `src/config.js` line 75
```javascript
{ name: 'Saratoga', url: 'https://www.eventbrite.com/d/ca--saratoga/events/', maxEvents: 5 }
```
✅ **Confirmed**: Saratoga is in `additionalCities` array

### 2. Location Filtering
**File**: `src/config.js` lines 129-132
```javascript
southbay: [
  'San Jose', 'Santa Clara', 'Sunnyvale', 'Milpitas', 'Campbell', 'Los Gatos',
  'Saratoga', 'Morgan Hill', 'Gilroy', 'Cupertino', 'Los Altos'
],
```
✅ **Confirmed**: Saratoga is in `locations.southbay`

**File**: `src/config.js` lines 169-173
```javascript
secondary: [
  'Fremont', 'Milpitas', 'Campbell', 'Los Gatos', 'Saratoga', 'Morgan Hill',
  ...
]
```
✅ **Confirmed**: Saratoga is in `locations.secondary`

## Scraping Flow Analysis

### Step 1: URL Construction
**File**: `src/scrapers/eventbrite-scraper.js` line 34
```javascript
const cityUrl = `${city.url}?start_date_keyword=next_week`;
```
**Result**: `https://www.eventbrite.com/d/ca--saratoga/events/?start_date_keyword=next_week`

### Step 2: Page Fetching
**File**: `src/scrapers/eventbrite-scraper.js` line 104
```javascript
const $ = await this.fetchPage(url);
const pageEvents = await this.parseEventbritePage($);
```

### Step 3: Event Parsing
**File**: `src/scrapers/eventbrite-scraper.js` lines 136-175
- Tries multiple selectors to find event cards
- Extracts: title, time, location, URL, price, description

### Step 4: Detail Fetching
**File**: `src/scrapers/eventbrite-scraper.js` lines 108-127
- For each event found, fetches detail page
- Gets complete address, accurate time, detailed description

### Step 5: Location Filtering ⚠️ **POTENTIAL ISSUE #1**
**File**: `src/scrapers/base-scraper.js` lines 317-330 + line 187
```javascript
isRelevantLocation(location) {
  const allLocations = [
    ...config.locations.primary,
    ...config.locations.secondary,
    ...config.locations.keywords
  ];

  return allLocations.some(loc =>
    locationText.includes(loc.toLowerCase())
  );
}
```

**Critical Check**: Does the event's location text actually contain "Saratoga"?

## Potential Issues

### Issue #1: Time Range Filtering
**Severity**: 🔴 HIGH

The scraper uses `?start_date_keyword=next_week` parameter. This means:
- Events must start within "next week" (Monday to Sunday of the following week)
- If the French Holiday Market is scheduled for:
  - This week → Won't appear in next_week search
  - Two weeks out → Won't appear in next_week search
  - More than 2 weeks out → Won't appear in next_week search

**Solution**: Check the actual event date on Eventbrite

### Issue #2: Location Text Extraction
**Severity**: 🟡 MEDIUM

The location filtering checks if the location string contains "Saratoga". However:

**Example Issue**: If Eventbrite displays the location as:
- ❌ "Village of Saratoga" → might not match "Saratoga" (depends on case-insensitive matching)
- ❌ "14510 Big Basin Way, CA" → won't match "Saratoga" at all
- ✅ "Saratoga, CA" → will match
- ✅ "Downtown Saratoga" → will match

**Location Extraction Code**: `src/scrapers/eventbrite-scraper.js` lines 162-204
- First tries: `[class*="event-card__clamp-line--one"]`
- Falls back to: `[data-testid="event-location"]`, `.event-location`, etc.

**Solution**: Add debug logging to see what location text is extracted

### Issue #3: Event Not on Search Page
**Severity**: 🟡 MEDIUM

The scraper only looks at the first page of results:
```javascript
// File: src/scrapers/eventbrite-scraper.js line 103
const $ = await this.fetchPage(url); // Only first page
```

If the French Holiday Market is not in the top events on Saratoga's first search results page, it won't be found.

**Why it might not be on first page**:
- Lower popularity score
- Older/newer event date
- Different category sorting

### Issue #4: Event Card Not Recognized
**Severity**: 🟢 LOW

If Eventbrite changed their HTML structure, the event card selectors might fail:
```javascript
const eventSelectors = [
  '[data-testid="event-card"]',
  '.event-card',
  '.discover-search-desktop-card',
  '[data-event-id]',
  '.search-event-card'
];
```

Falls back to generic parsing if these fail.

### Issue #5: Required Fields Missing
**Severity**: 🟢 LOW

The parser requires these fields to be non-null:
- Title (line 182)
- Start Time (line 186)
- Location (line 190)
- Original URL (line 194)

If any of these fail to extract, the event is silently skipped.

## Recommended Debug Steps

### Step 1: Manual URL Check
Visit: `https://www.eventbrite.com/d/ca--saratoga/events/?start_date_keyword=next_week`

**Check**:
1. Does the French Holiday Market appear on this page?
2. What is the event's display date?
3. What is the location text shown?

### Step 2: Check Event's Actual Date
Visit: `https://www.eventbrite.com/e/french-holiday-market-tickets-1902205561039`

**Check**:
1. What is the actual start date/time?
2. Is it within "next week" timeframe?
3. What location is displayed?

### Step 3: Add Debug Logging
Modify `src/scrapers/eventbrite-scraper.js` to log:
```javascript
async scrapeEventsFromUrl(url, weekRange, seenUrls, maxEvents = 20) {
  console.log(`  🔍 Fetching: ${url}`);
  const pageEvents = await this.parseEventbritePage($);
  console.log(`  📋 Found ${pageEvents.length} events on page`);

  for (const event of pageEvents) {
    console.log(`  📍 Event: "${event.title}" at "${event.location}"`);
    console.log(`  🔗 URL: ${event.originalUrl}`);
  }
}
```

### Step 4: Check Location Filtering
Add logging to `src/scrapers/base-scraper.js`:
```javascript
if (this.isRelevantLocation(normalized.location)) {
  normalizedEvents.push(normalized);
} else {
  console.log(`  ❌ FILTERED: "${normalized.title}"`);
  console.log(`     Location: "${normalized.location}"`);
  console.log(`     Didn't match any of: ${allLocations.join(', ')}`);
}
```

## Most Likely Root Cause

Based on probability:

1. **70% chance**: Event date is not within "next week" timeframe
2. **20% chance**: Event not on first page of Saratoga search results
3. **8% chance**: Location text doesn't contain "Saratoga" string
4. **2% chance**: HTML parsing failure

## Quick Fix Recommendations

### Fix #1: Expand Time Range (if date is the issue)
```javascript
// In src/scrapers/eventbrite-scraper.js
const cityUrl = `${city.url}?start_date_keyword=this_month`; // Instead of next_week
```

### Fix #2: Increase Page Limit (if pagination is the issue)
```javascript
// In src/scrapers/eventbrite-scraper.js
const cityEvents = await this.scrapeEventsFromUrl(
  cityUrl,
  weekRange,
  seenUrls,
  20  // Increase from 5 to 20
);
```

### Fix #3: Improve Location Matching (if location text is the issue)
```javascript
// In src/config.js, add aliases
southbay: [
  'Saratoga', 'Village of Saratoga', 'Downtown Saratoga',
  // ... other cities
]
```

## Next Steps

To definitively identify the issue, the user should:

1. ✅ **Verify event date** - Visit the event URL and check if it's in "next week"
2. ✅ **Check search results** - Visit the Saratoga search URL and see if event appears
3. ⚙️ **Add debug logging** - Modify scrapers to output detailed parsing information
4. 🧪 **Run test script** - Execute `node test-saratoga-scrape.js` (requires Node.js)

Once we know which step fails, we can implement the appropriate fix.
