// 测试修复后的周标识符计算
console.log('=== Testing Fixed Week Calculation ===\n');

function getNextWeekIdentifier() {
  const now = new Date();
  console.log('Today:', now.toISOString().split('T')[0]);
  console.log('Day of week (0=Sun, 1=Mon, ..., 6=Sat):', now.getDay());

  const day = now.getDay();
  const daysToMonday = day === 0 ? 1 : (1 - day + 7); // 下周一距离今天的天数

  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const identifier = `${formatDate(monday)}_to_${formatDate(sunday)}`;
  console.log('Next week (下周):', identifier);
  return identifier;
}

function getCurrentWeekIdentifier() {
  const now = new Date();
  const day = now.getDay();
  const daysToMonday = day === 0 ? -6 : 1 - day; // 本周一距离今天的天数

  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const identifier = `${formatDate(monday)}_to_${formatDate(sunday)}`;
  console.log('Current week (本周):', identifier);
  return identifier;
}

getCurrentWeekIdentifier();
console.log('');
getNextWeekIdentifier();

console.log('\n=== Database Available Weeks ===');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/events.db', sqlite3.OPEN_READONLY);

db.all(`
  SELECT week_identifier, COUNT(*) as count
  FROM events
  GROUP BY week_identifier
  ORDER BY week_identifier DESC
`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    rows.forEach(row => {
      console.log(`  ${row.week_identifier}: ${row.count} events`);
    });
  }
  db.close();
});
