// 验证修复后的逻辑
console.log("=== 验证修复 (今天是 2025-11-22, Friday) ===\n");

function getNextWeekIdentifier() {
  const now = new Date('2025-11-22');
  const day = now.getDay();

  // 先找到本周一（0=Sunday, 1=Monday, ..., 6=Saturday）
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  // 下周一 = 本周一 + 7 天
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);

  // 下周日 = 下周一 + 6 天
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  return `${formatDate(nextMonday)}_to_${formatDate(nextSunday)}`;
}

function getCurrentWeekIdentifier() {
  const now = new Date('2025-11-22');
  const day = now.getDay();

  // 找到本周一（0=Sunday, 1=Monday, ..., 6=Saturday）
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);

  // 本周日 = 本周一 + 6 天
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  return `${formatDate(thisMonday)}_to_${formatDate(thisSunday)}`;
}

const currentWeek = getCurrentWeekIdentifier();
const nextWeek = getNextWeekIdentifier();

console.log("✅ 本周 (Current Week):", currentWeek);
console.log("✅ 下周 (Next Week):", nextWeek);

console.log("\n📊 数据库中的周:");
console.log("   2025-11-17_to_2025-11-23 (42 events) - 本周");
console.log("   2025-11-24_to_2025-11-30 (52 events) - 下周");

console.log("\n🔍 匹配结果:");
console.log("   本周匹配:", currentWeek === "2025-11-17_to_2025-11-23" ? "✅ 正确" : "❌ 错误");
console.log("   下周匹配:", nextWeek === "2025-11-24_to_2025-11-30" ? "✅ 正确" : "❌ 错误");
