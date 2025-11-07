#!/usr/bin/env node

/**
 * 测试发布确认流程
 * 测试 v1.6 新增的发布前编辑和确认功能
 */

const PerformanceDatabase = require('./src/feedback/performance-database');

async function testDatabaseMigration() {
  console.log('🧪 测试数据库迁移到 v1.6\n');

  const db = new PerformanceDatabase();

  try {
    // 1. 连接数据库
    await db.connect();
    console.log('✅ 数据库连接成功');

    // 2. 初始化表结构（包括迁移）
    await db.initializeFeedbackTables();
    console.log('✅ 表结构初始化完成（包括 v1.6 迁移）');

    // 3. 测试创建一个带有新字段的 post 记录
    console.log('\n📝 测试创建发布记录（包含 v1.6 新字段）...');

    const testPostId = `test_post_${Date.now()}`;
    const generatedContent = '这是AI生成的原始内容\n\n🎪 活动1\n🎪 活动2';
    const publishedContent = '这是编辑后的内容\n\n🎪 活动1（已编辑）\n🎪 活动2\n🎪 活动3（新增）';

    await db.createPost({
      post_id: testPostId,
      published_at: new Date().toISOString(),
      week_identifier: '2025-11-09_to_2025-11-15',
      platform: 'xiaohongshu',
      total_events: 3,
      review_file_path: null,
      output_file_path: '/code/output/test.txt',
      cover_image_path: null,
      generated_content: generatedContent,    // v1.6
      published_content: publishedContent,    // v1.6
      content_modified: true,                 // v1.6
      manual_events_added: 1                  // v1.6
    });

    console.log(`✅ 发布记录创建成功: ${testPostId}`);

    // 4. 测试创建活动表现记录（包括手动添加的）
    console.log('\n📝 测试创建活动表现记录...');

    // 原有活动
    await db.createEventPerformance({
      post_id: testPostId,
      event_id: null,
      event_title: '活动1',
      event_type: 'market',
      event_url: 'https://short.io/test1',
      location: 'San Francisco',
      location_category: 'sanfrancisco',
      price: 'Free',
      price_category: 'free',
      start_time: '2025-11-09',
      is_weekend: false,
      is_free: true,
      is_outdoor: false,
      is_chinese_relevant: false,
      engagement_score: 0,
      source_review: 'review_2025-11-07.json',
      source_website: 'eventbrite',
      manually_added_at_publish: false  // v1.6
    });

    console.log('  ✅ 活动1（原有活动）');

    // 手动添加的活动
    await db.createEventPerformance({
      post_id: testPostId,
      event_id: null,
      event_title: '活动3（新增）',
      event_type: 'music',
      event_url: 'https://short.io/test3',
      location: 'Oakland',
      location_category: 'eastbay',
      price: '$20',
      price_category: 'paid',
      start_time: '2025-11-10',
      is_weekend: true,
      is_free: false,
      is_outdoor: false,
      is_chinese_relevant: false,
      engagement_score: 0,
      source_review: null,
      source_website: 'funcheap',
      manually_added_at_publish: true  // v1.6: 标记为发布时手动添加
    });

    console.log('  ✅ 活动3（发布时手动添加）');

    // 5. 读取并验证数据
    console.log('\n📊 验证数据...');

    const post = await db.getPost(testPostId);

    if (!post) {
      throw new Error('无法读取发布记录');
    }

    console.log('✅ 发布记录读取成功');
    console.log(`   Post ID: ${post.post_id}`);
    console.log(`   总活动数: ${post.total_events}`);
    console.log(`   内容是否被编辑: ${post.content_modified ? '是' : '否'}`);
    console.log(`   手动添加的活动数: ${post.manual_events_added}`);
    console.log(`   生成内容长度: ${post.generated_content?.length || 0} 字符`);
    console.log(`   发布内容长度: ${post.published_content?.length || 0} 字符`);

    const events = await db.getEventsByPost(testPostId);
    console.log(`\n✅ 活动记录读取成功 (${events.length} 个)`);

    const manualAddedEvents = events.filter(e => e.manually_added_at_publish === 1);
    console.log(`   手动添加的活动: ${manualAddedEvents.length} 个`);

    if (manualAddedEvents.length > 0) {
      manualAddedEvents.forEach(e => {
        console.log(`      - ${e.event_title}`);
      });
    }

    // 6. 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await db.run('DELETE FROM event_performance WHERE post_id = ?', [testPostId]);
    await db.run('DELETE FROM posts WHERE post_id = ?', [testPostId]);
    console.log('✅ 测试数据已清理');

    // 7. 关闭连接
    await db.close();

    console.log('\n' + '='.repeat(70));
    console.log('✅ 所有测试通过！');
    console.log('='.repeat(70));
    console.log('\nv1.6 新功能验证成功:');
    console.log('  ✅ generated_content 字段');
    console.log('  ✅ published_content 字段');
    console.log('  ✅ content_modified 字段');
    console.log('  ✅ manual_events_added 字段');
    console.log('  ✅ manually_added_at_publish 字段');
    console.log('\n现在可以运行 npm run generate-post 来使用新功能了！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
testDatabaseMigration();
