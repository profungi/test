#!/usr/bin/env node

/**
 * Feedback Collection Script
 * 收集指定发布的反馈数据（点击量、点赞、收藏等）
 *
 * Usage: npm run collect-feedback <post_id>
 * Example: npm run collect-feedback post_2025-11-15_2143
 */

const PerformanceDatabase = require('./src/feedback/performance-database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function collectFeedbackForPost(postId) {
  const db = new PerformanceDatabase();

  try {
    await db.connect();
    await db.initializeFeedbackTables();

    // 获取发布记录
    const post = await db.getPost(postId);

    if (!post) {
      console.error(`❌ 找不到发布记录: ${postId}`);
      console.log('\n💡 提示: 使用以下命令查看所有发布记录:');
      console.log('   node collect-feedback.js --list');
      process.exit(1);
    }

    console.log('\n📋 发布信息:');
    console.log(`   Post ID: ${post.post_id}`);
    console.log(`   发布时间: ${post.published_at}`);
    console.log(`   周标识: ${post.week_identifier}`);
    console.log(`   活动数量: ${post.total_events}`);
    if (post.xiaohongshu_url) {
      console.log(`   小红书链接: ${post.xiaohongshu_url}`);
    }
    console.log('');

    // 获取该发布的所有活动
    const events = await db.getEventsByPost(postId);

    if (events.length === 0) {
      console.error('❌ 该发布没有关联的活动记录');
      process.exit(1);
    }

    console.log(`📊 找到 ${events.length} 个活动，开始收集反馈数据...\n`);

    // 收集整体数据（小红书层面）
    console.log('=== 小红书帖子整体数据 ===');
    const postLikes = await question('总点赞数 (likes): ');
    const postFavorites = await question('总收藏数 (favorites): ');
    const postComments = await question('总评论数 (comments): ');
    const postShares = await question('总分享数 (shares, 默认0): ') || '0';
    const postViews = await question('总浏览数 (views, 默认0): ') || '0';

    // 保存小红书整体数据到posts表
    await db.updatePostXiaohongshuData(postId, {
      total_likes: parseInt(postLikes) || 0,
      total_favorites: parseInt(postFavorites) || 0,
      total_comments: parseInt(postComments) || 0,
      total_shares: parseInt(postShares) || 0,
      total_views: parseInt(postViews) || 0
    });

    console.log('✅ 小红书整体数据已保存到posts表\n');

    console.log('=== 单个活动数据 ===');
    console.log('提示: 为每个活动输入Short.io点击量\n');

    // 为每个活动收集数据
    let updatedCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`\n[${i + 1}/${events.length}] ${event.event_title}`);
      console.log(`    类型: ${event.event_type} | 地点: ${event.location}`);

      // Short.io 点击量（这是唯一可以获取的单个活动数据）
      const clicks = await question('  Short.io 点击量 (默认0): ') || '0';

      // 更新数据库 - 只保存点击量
      // 小红书的互动数据（点赞、收藏、评论）已保存在posts表，不在这里重复
      const feedbackData = {
        shortio_clicks: parseInt(clicks),
        xiaohongshu_likes: 0,  // 活动级别没有单独的点赞数
        xiaohongshu_favorites: 0,  // 活动级别没有单独的收藏数
        xiaohongshu_comments: 0,  // 活动级别没有单独的评论数
        xiaohongshu_shares: 0,  // 活动级别没有单独的分享数
        data_source: 'manual'
      };

      await db.updateEventPerformance(event.id, feedbackData);
      updatedCount++;

      console.log(`  ✅ 已更新 (点击量: ${clicks})`);
    }

    console.log(`\n✅ 成功更新 ${updatedCount} 个活动的反馈数据`);

    // 显示统计
    const stats = await db.getEventsByPost(postId);
    const totalClicks = stats.reduce((sum, e) => sum + (e.shortio_clicks || 0), 0);

    // 重新获取posts表数据以显示完整信息
    const updatedPost = await db.getPost(postId);

    console.log('\n📊 数据收集统计:');
    console.log('\n小红书帖子整体数据:');
    console.log(`   点赞数: ${updatedPost.xiaohongshu_total_likes || 0}`);
    console.log(`   收藏数: ${updatedPost.xiaohongshu_total_favorites || 0}`);
    console.log(`   评论数: ${updatedPost.xiaohongshu_total_comments || 0}`);
    console.log(`   分享数: ${updatedPost.xiaohongshu_total_shares || 0}`);
    console.log(`   浏览数: ${updatedPost.xiaohongshu_total_views || 0}`);

    console.log('\n单个活动点击数据:');
    console.log(`   总点击量: ${totalClicks}`);
    console.log(`   平均点击: ${(totalClicks / stats.length).toFixed(1)}`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await db.close();
    rl.close();
  }
}

async function listPosts() {
  const db = new PerformanceDatabase();

  try {
    await db.connect();
    const posts = await db.getRecentPosts(20);

    console.log('\n📋 最近的发布记录:\n');
    console.log('Post ID                      发布时间              周标识                   活动数  反馈状态');
    console.log('─'.repeat(95));

    for (const post of posts) {
      const events = await db.getEventsByPost(post.post_id);
      const hasFeedback = events.some(e => e.engagement_score > 0);
      const feedbackStatus = hasFeedback ? '✅ 已收集' : '⏳ 待收集';

      console.log(
        `${post.post_id.padEnd(28)} ${post.published_at.slice(0, 16).padEnd(20)} ${post.week_identifier.padEnd(24)} ${String(post.total_events).padEnd(7)} ${feedbackStatus}`
      );
    }

    console.log('\n💡 使用方法:');
    console.log('   npm run collect-feedback <post_id>');
    console.log('\n例如:');
    console.log(`   npm run collect-feedback ${posts[0]?.post_id || 'post_2025-11-15_2143'}`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('用法: npm run collect-feedback <post_id>');
    console.log('');
    console.log('选项:');
    console.log('  --list, -l     列出所有发布记录');
    console.log('  --help, -h     显示帮助信息');
    console.log('');
    console.log('示例:');
    console.log('  npm run collect-feedback post_2025-11-15_2143');
    console.log('  npm run collect-feedback --list');
    process.exit(0);
  }

  if (args[0] === '--list' || args[0] === '-l') {
    await listPosts();
    return;
  }

  const postId = args[0];
  await collectFeedbackForPost(postId);
}

main().catch(error => {
  console.error('❌ 未处理的错误:', error);
  process.exit(1);
});
