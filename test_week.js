// 测试周标识符计算
function getNextWeekIdentifier() {
  const now = new Date();
  console.log('Today:', now.toISOString().split('T')[0]);
  console.log('Day of week:', now.getDay());

  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7; // 下周一
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const identifier = `${formatDate(monday)}_to_${formatDate(sunday)}`;
  console.log('Next week:', identifier);
  return identifier;
}

function getCurrentWeekIdentifier() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 本周一
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const identifier = `${formatDate(monday)}_to_${formatDate(sunday)}`;
  console.log('Current week:', identifier);
  return identifier;
}

console.log('=== Testing Week Calculation ===');
getCurrentWeekIdentifier();
getNextWeekIdentifier();
