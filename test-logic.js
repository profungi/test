// 测试今天 2025-11-22 (Friday) 的计算

console.log("=== 测试 2025-11-22 (Friday, day=5) ===\n");

// 新的修复逻辑（我刚才写的）
function getNextWeekNew() {
  const now = new Date('2025-11-22');
  const day = now.getDay();  // 5 (Friday)
  const daysToMonday = day === 0 ? 1 : (1 - day + 7);
  // daysToMonday = 1 - 5 + 7 = 3

  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);
  // monday = 22 + 3 = 25

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return `${fmt(monday)}_to_${fmt(sunday)}`;
}

// 正确的逻辑
function getNextWeekCorrect() {
  const now = new Date('2025-11-22');
  const day = now.getDay();  // 5 (Friday)

  // 先找到本周一
  const daysFromMonday = day === 0 ? 6 : day - 1;  // 5 - 1 = 4
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  // 下周一 = 本周一 + 7
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return `${fmt(nextMonday)}_to_${fmt(nextSunday)}`;
}

function getCurrentWeekCorrect() {
  const now = new Date('2025-11-22');
  const day = now.getDay();  // 5 (Friday)

  // 找到本周一
  const daysFromMonday = day === 0 ? 6 : day - 1;  // 5 - 1 = 4
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return `${fmt(thisMonday)}_to_${fmt(thisSunday)}`;
}

console.log("我的修复:", getNextWeekNew());
console.log("正确结果:", getNextWeekCorrect());
console.log("本周:", getCurrentWeekCorrect());
console.log("\n数据库中的周:");
console.log("  2025-11-17_to_2025-11-23 (本周, 42 events)");
console.log("  2025-11-24_to_2025-11-30 (下周, 52 events)");
