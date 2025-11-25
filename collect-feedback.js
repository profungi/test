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

    console.log('\n=== 单个活动数据 ===');
    console.log('提示: 如果无法获取单个活动的具体数据，可以按回车跳过\n');

    // 为每个活动收集数据
    let updatedCount = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`\n[${i + 1}/${events.length}] ${event.event_title}`);
      console.log(`    类型: ${event.event_type} | 地点: ${event.location}`);

      // Short.io 点击量
      const clicks = await question('  Short.io 点击量 (默认0): ') || '0';

      // 如果有点击数据，询问是否单独记录其他指标
      let likes = '0', favorites = '0', comments = '0', shares = '0';

      if (parseInt(clicks) > 0 || events.length === 1) {
        const hasDetail = await question('  是否有该活动的详细互动数据? (y/n, 默认n): ');
        if (hasDetail.toLowerCase() === 'y') {
          likes = await question('    点赞数: ') || '0';
          favorites = await question('    收藏数: ') || '0';
          comments = await question('    评论数: ') || '0';
          shares = await question('    分享数: ') || '0';
        }
      }

      // 更新数据库
      const feedbackData = {
        shortio_clicks: parseInt(clicks),
        xiaohongshu_likes: parseInt(likes),
        xiaohongshu_favorites: parseInt(favorites),
        xiaohongshu_comments: parseInt(comments),
        xiaohongshu_shares: parseInt(shares),
        data_source: 'manual'
      };

      await db.updateEventPerformance(event.id, feedbackData);
      updatedCount++;

      console.log(`  ✅ 已更新 (Engagement Score: ${db.calculateEngagementScore(feedbackData)})`);
    }

    console.log(`\n✅ 成功更新 ${updatedCount} 个活动的反馈数据`);

    // 显示统计
    const stats = await db.getEventsByPost(postId);
    const totalEngagement = stats.reduce((sum, e) => sum + (e.engagement_score || 0), 0);
    const totalClicks = stats.reduce((sum, e) => sum + (e.shortio_clicks || 0), 0);

    console.log('\n📊 统计摘要:');
    console.log(`   总 Engagement Score: ${totalEngagement.toFixed(1)}`);
    console.log(`   总点击量: ${totalClicks}`);
    console.log(`   平均 Engagement: ${(totalEngagement / stats.length).toFixed(1)}`);

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
