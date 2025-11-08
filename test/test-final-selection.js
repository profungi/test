#!/usr/bin/env node

/**
 * 测试最终选择确认功能（支持移除和添加备选）
 */

const ReviewMerger = require('../src/utils/review-merger');

async function testFinalSelection() {
  const merger = new ReviewMerger();

  // 创建测试的已选择活动
  const selectedEvents = [
    {
      id: 1,
      title: 'SF Jazz Festival',
      event_type: 'music',
      location: 'San Francisco',
      price: 'Free',
      time_display: 'Saturday 11/10 2:00 PM',
      priority: 8.5,
      _source_review: 'review_test.json',
      _source_website: 'eventbrite'
    },
    {
      id: 2,
      title: 'Golden Gate Park Concert',
      event_type: 'music',
      location: 'Golden Gate Park, San Francisco',
      price: '$25',
      time_display: 'Sunday 11/11 3:00 PM',
      priority: 7.2,
      _source_review: 'review_test.json',
      _source_website: 'funcheap'
    },
    {
      id: 3,
      title: 'Bay Area Food Truck Festival',
      event_type: 'food',
      location: 'Oakland',
      price: 'Free',
      time_display: 'Saturday 11/10 12:00 PM',
      priority: 8.0,
      _source_review: 'review_test.json',
      _source_website: 'eventbrite'
    }
  ];

  // 创建备选活动列表
  const candidateEvents = [
    {
      id: 4,
      title: 'Oakland Night Market',
      event_type: 'food',
      location: 'Oakland Chinatown',
      price: 'Free',
      time_display: 'Friday 11/09 6:00 PM',
      priority: 8.8,
      _source_review: 'review_test.json',
      _source_website: 'funcheap'
    },
    {
      id: 5,
      title: 'Museum Free Day',
      event_type: 'art',
      location: 'SFMOMA, San Francisco',
      price: 'Free',
      time_display: 'Sunday 11/11 10:00 AM',
      priority: 7.8,
      _source_review: 'review_test.json',
      _source_website: 'eventbrite'
    },
    {
      id: 6,
      title: 'Tech Talk: AI and Machine Learning',
      event_type: 'conference',
      location: 'San Jose Convention Center',
      price: '$50',
      time_display: 'Monday 11/12 6:00 PM',
      priority: 6.5,
      _source_review: 'review_test.json',
      _source_website: 'meetup'
    },
    {
      id: 7,
      title: 'Farmers Market',
      event_type: 'market',
      location: 'Ferry Building, SF',
      price: 'Free',
      time_display: 'Saturday 11/10 8:00 AM',
      priority: 7.5,
      _source_review: 'review_test.json',
      _source_website: 'funcheap'
    }
  ];

  console.log('🧪 测试最终选择确认功能（两步交互）\n');
  console.log('测试场景：');
  console.log('  - 已选择: 3 个活动');
  console.log('  - 备选: 4 个活动');
  console.log('  - 可以移除已选择的活动');
  console.log('  - 可以从备选中添加活动');
  console.log('  - 可以输入 "scrape" 查看抓取提示\n');

  try {
    const finalEvents = await merger.finalSelectionReview(selectedEvents, candidateEvents);

    console.log('\n' + '='.repeat(70));
    console.log('✅ 测试完成！');
    console.log('='.repeat(70));
    console.log(`\n最终选择了 ${finalEvents.length} 个活动:`);
    finalEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.title} [${event.event_type}]`);
    });
    console.log('\n' + '='.repeat(70));
  } catch (error) {
    if (error.message === '用户取消操作' || error.message === '用户选择重新抓取') {
      console.log('\n⚠️  ' + error.message);
    } else {
      console.error('\n❌ 测试失败:', error.message);
      console.error(error.stack);
    }
  }
}

// 运行测试
testFinalSelection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
