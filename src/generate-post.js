#!/usr/bin/env node

/**
 * Bay Area Events Post Generator - 内容生成脚本
 * 读取人工审核后的文件，生成短链接并创建最终的小红书发布内容
 */

const URLShortener = require('./utils/url-shortener');
const ContentTranslator = require('./formatters/translator');
const PostGenerator = require('./formatters/post-generator');
const ManualReviewManager = require('./utils/manual-review');
const PerformanceDatabase = require('./feedback/performance-database');
const ReviewMerger = require('./utils/review-merger');
const PublicationConfirmer = require('./utils/publication-confirmer');

class PostGenerationOrchestrator {
  constructor() {
    this.urlShortener = new URLShortener();
    this.translator = new ContentTranslator();
    this.postGenerator = new PostGenerator();
    this.reviewManager = new ManualReviewManager();
    this.performanceDB = new PerformanceDatabase();
    this.reviewMerger = new ReviewMerger();
    this.publicationConfirmer = new PublicationConfirmer();
  }

  async run(reviewFilePath) {
    console.log('📝 开始生成小红书发布内容...\n');

    try {
      let selectedEvents;
      let weekRange;
      let sourceReviews = null;  // v1.5: 多review来源信息
      let isMergedPost = false;   // v1.5: 是否为合并帖子

      // v1.5: 如果没有提供reviewFilePath，启用交互式选择模式
      if (!reviewFilePath) {
        console.log('🔍 扫描output目录的review文件...\n');

        // 1. 扫描review文件
        const reviewFiles = this.reviewMerger.scanReviewFiles();

        // 2. 按target_week分组
        const groups = this.reviewMerger.groupByTargetWeek(reviewFiles);

        // 3. 交互式选择
        const selectedGroup = await this.reviewMerger.selectReviewGroup(groups);

        // 4. 合并review文件（包括未选择的活动）
        const mergeResult = this.reviewMerger.mergeReviewFiles(selectedGroup.files);

        // 5. 去重已选择的活动
        const dedupResult = this.reviewMerger.deduplicateEvents(mergeResult.allEvents);

        // 6. 显示结果
        this.reviewMerger.displayMergeResults(mergeResult, dedupResult);

        // 7. 最终确认 - 允许用户微调选择（传入未选择的备选活动）
        const finalEvents = await this.reviewMerger.finalSelectionReview(
          dedupResult.uniqueEvents,
          mergeResult.unselectedEvents  // 传递备选活动列表
        );

        // 使用合并后的活动
        selectedEvents = finalEvents;
        weekRange = {
          identifier: selectedGroup.target_week,
          readable: selectedGroup.target_week_readable
        };
        sourceReviews = mergeResult.sourceReviews;
        isMergedPost = selectedGroup.files.length > 1;

        console.log(`\n✅ 准备生成帖子，共 ${selectedEvents.length} 个活动\n`);
      } else {
        // 传统模式：读取单个review文件
        const { reviewData, selectedEvents: events, weekRange: range } =
          await this.reviewManager.readReviewFile(reviewFilePath);

        this.reviewManager.validateReviewFile(reviewData);

        if (events.length === 0) {
          throw new Error('没有选中任何活动，请在审核文件中将要发布的活动的 "selected" 设为 true');
        }

        selectedEvents = events;
        weekRange = range;

        console.log(`✅ 读取审核文件成功，共选择了 ${selectedEvents.length} 个活动\n`);
      }
      
      // 3. 生成审核总结 (如果有reviewData)
      const reviewSummary = reviewFilePath
        ? this.reviewManager.generateReviewSummary(reviewData, selectedEvents)
        : { totalReviewed: selectedEvents.length, selectedCount: selectedEvents.length };
      
      // 4. 为选中的活动生成短链接
      console.log('🔗 开始生成短链接...');
      const urlResult = await this.urlShortener.generateShortUrls(selectedEvents);
      
      if (urlResult.summary.failed > 0) {
        console.log(`⚠️  ${urlResult.summary.failed} 个链接生成失败，将使用原始链接`);
      }
      
      // 5. 翻译和优化内容
      console.log('\n🌐 开始翻译和优化内容...');
      const translatedEvents = await this.translator.translateAndOptimizeEvents(urlResult.events);
      
      // 6. 生成最终发布内容
      console.log('\n📱 生成小红书发布内容...');
      const postResult = await this.postGenerator.generatePost(
        translatedEvents,
        weekRange,
        reviewSummary
      );

      // 7. 验证内容质量
      const contentSummary = this.postGenerator.generateContentSummary(postResult.content);
      this.displayGenerationSummary(postResult, contentSummary, urlResult.summary);

      // 8. 发布前确认和编辑 (v1.6: 新增)
      console.log('\n' + '='.repeat(70));
      console.log('📋 发布前确认');
      console.log('='.repeat(70));

      const confirmResult = await this.publicationConfirmer.confirmPublication(
        postResult.content,
        translatedEvents,
        weekRange
      );

      if (!confirmResult) {
        console.log('\n❌ 操作已取消，未保存任何记录');
        return;
      }

      const { publishedContent, contentModified, newEvents } = confirmResult;

      // 如果有新活动，需要翻译并合并
      let finalEvents = translatedEvents;
      if (newEvents.length > 0) {
        console.log(`\n🌐 正在翻译新添加的 ${newEvents.length} 个活动...`);
        const translatedNewEvents = await this.translator.translateAndOptimizeEvents(newEvents);
        finalEvents = [...translatedEvents, ...translatedNewEvents];
      }

      // 9. 检查是否已有该周的发布记录并选择覆盖或创建新版本
      await this.performanceDB.connect();
      await this.performanceDB.initializeFeedbackTables();

      const existingPosts = await this.performanceDB.getPostsByWeek(weekRange.identifier);

      if (existingPosts.length > 0) {
        console.log('\n' + '⚠️ '.repeat(35));
        console.log(`检测到该周 (${weekRange.identifier}) 已有 ${existingPosts.length} 条发布记录:`);
        existingPosts.forEach((post, index) => {
          console.log(`  ${index + 1}. ${post.post_id} (发布于 ${new Date(post.published_at).toLocaleString('zh-CN')})`);
          console.log(`     活动数: ${post.total_events}, 编辑: ${post.content_modified ? '是' : '否'}`);
        });
        console.log('⚠️ '.repeat(35));

        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        console.log('\n请选择操作:');
        console.log('  [1] 覆盖最新的记录（删除旧记录，保存新记录）');
        console.log('  [2] 创建新版本（保留旧记录，添加新记录）');
        console.log('  [3] 取消，不保存');

        const choice = await new Promise(resolve => {
          rl.question('\n请选择 [1/2/3]: ', resolve);
        });
        rl.close();

        if (choice.trim() === '3') {
          console.log('\n❌ 已取消，未保存发布记录');
          console.log(`📄 发布内容文件仍然已生成: ${postResult.filepath}`);
          await this.performanceDB.close();
          return;
        } else if (choice.trim() === '1') {
          // 删除最新的记录
          const latestPost = existingPosts[0];
          console.log(`\n🗑️  删除旧记录: ${latestPost.post_id}`);
          await this.performanceDB.deletePost(latestPost.post_id);
          console.log('✅ 旧记录已删除');
        } else if (choice.trim() === '2') {
          console.log('\n📝 创建新版本（保留旧记录）');
        } else {
          console.log('\n⚠️  无效的选择，默认创建新版本');
        }
      }

      // 10. 保存发布记录到数据库 (反馈系统)
      try {
        const postId = await this.savePublicationRecord(
          finalEvents,          // 使用最终的活动列表（包含新添加的）
          weekRange,
          reviewFilePath,
          postResult,
          sourceReviews,        // v1.5: 传递来源信息
          isMergedPost,         // v1.5: 传递是否为合并帖子
          postResult.content,   // v1.6: 生成的原始内容
          publishedContent,     // v1.6: 实际发布的内容
          contentModified,      // v1.6: 是否被编辑过
          newEvents.length      // v1.6: 手动添加的活动数量
        );

        console.log('\n📊 发布记录已创建:');
        console.log(`   Post ID: ${postId}`);
        console.log(`   原有活动: ${translatedEvents.length} 个`);
        if (newEvents.length > 0) {
          console.log(`   新增活动: ${newEvents.length} 个`);
        }
        console.log(`   总计: ${finalEvents.length} 个活动`);
        if (contentModified) {
          console.log(`   内容状态: 已编辑`);
        } else {
          console.log(`   内容状态: 未修改`);
        }
        if (isMergedPost) {
          console.log(`   来源: ${sourceReviews.length} 个review文件 (合并帖子)`);
        }
      } catch (dbError) {
        console.warn('⚠️  保存发布记录失败:', dbError.message);
        console.warn('   这不影响内容生成，但无法记录反馈数据');
      }

      console.log('\n✨ 内容生成完成！');
      console.log(`📄 发布内容: ${postResult.filepath}`);
      console.log('📱 现在可以复制内容到小红书发布了！');

      // 10. 提示下一步操作
      this.displayNextSteps(postResult);

    } catch (error) {
      console.error('❌ 生成过程中发生错误:', error.message);
      
      if (error.message.includes('审核文件')) {
        console.log('\n💡 提示:');
        console.log('1. 确保审核文件存在且格式正确');
        console.log('2. 将要发布的活动的 "selected" 字段改为 true');
        console.log('3. 保存文件后重新运行命令');
      }
      
      process.exit(1);
    }
  }

  /**
   * 保存发布记录到性能数据库
   * v1.5: 支持多review来源记录
   * v1.6: 支持保存生成内容和发布内容
   */
  async savePublicationRecord(
    events,
    weekRange,
    reviewFilePath,
    postResult,
    sourceReviews = null,
    isMergedPost = false,
    generatedContent = null,
    publishedContent = null,
    contentModified = false,
    manualEventsAdded = 0
  ) {
    // 注意: 调用前应已经 connect() 和 initializeFeedbackTables()
    // 这里不再重复调用，避免重复连接

    // 生成 post_id
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    const postId = `post_${timestamp}`;

    // 1. 创建发布记录
    await this.performanceDB.createPost({
      post_id: postId,
      published_at: new Date().toISOString(),
      week_identifier: weekRange.identifier,
      platform: 'xiaohongshu',
      total_events: events.length,
      review_file_path: reviewFilePath,
      output_file_path: postResult.filepath,
      cover_image_path: postResult.coverImage ? postResult.coverImage.filepath : null,
      source_reviews: sourceReviews,      // v1.5: 新增字段
      is_merged_post: isMergedPost,       // v1.5: 新增字段
      generated_content: generatedContent,    // v1.6: 生成的原始内容
      published_content: publishedContent,    // v1.6: 实际发布的内容
      content_modified: contentModified,      // v1.6: 是否被编辑过
      manual_events_added: manualEventsAdded  // v1.6: 手动添加的活动数量
    });

    // 2. 为每个活动创建表现记录
    for (const event of events) {
      await this.performanceDB.createEventPerformance({
        post_id: postId,
        event_id: event.id || null,
        event_title: event.title,
        event_type: event.event_type,
        event_url: event.short_url || event.original_url,
        location: event.location,
        location_category: this.detectLocationCategory(event.location),
        price: event.price,
        price_category: this.categorizePriceAuto(event.price),
        start_time: event.start_time,
        is_weekend: this.isWeekend(event.start_time),
        is_free: this.isFree(event.price),
        is_outdoor: event.tags?.includes('outdoor') || false,
        is_chinese_relevant: event.chinese_relevant || false,
        engagement_score: 0,
        source_review: event._source_review || null,       // v1.5: 新增字段
        source_website: event._source_website || event.source || null,  // v1.5: 新增字段
        manually_added_at_publish: event._manually_added_at_publish || 0  // v1.6: 发布时手动添加
      });
    }

    await this.performanceDB.close();
    return postId;
  }

  /**
   * 检测地理位置类别
   */
  detectLocationCategory(location) {
    if (!location) return null;

    const locationLower = location.toLowerCase();
    const config = require('./config');

    if (config.locations.sanfrancisco.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'sanfrancisco';
    } else if (config.locations.southbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'southbay';
    } else if (config.locations.peninsula.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'peninsula';
    } else if (config.locations.eastbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'eastbay';
    } else if (config.locations.northbay.some(loc => locationLower.includes(loc.toLowerCase()))) {
      return 'northbay';
    }

    return 'other';
  }

  /**
   * 自动分类价格
   */
  categorizePriceAuto(price) {
    if (!price || price.toLowerCase().includes('free')) {
      return 'free';
    }

    const dollarMatch = price.match(/\$(\d+)/);
    if (dollarMatch) {
      const amount = parseInt(dollarMatch[1]);
      if (amount <= 50) {
        return 'paid';
      } else {
        return 'expensive';
      }
    }

    return 'unknown';
  }

  /**
   * 判断是否为周末
   */
  isWeekend(timeStr) {
    if (!timeStr) return false;
    const weekendPattern = /(saturday|sunday)/i;
    return weekendPattern.test(timeStr);
  }

  /**
   * 判断是否免费
   */
  isFree(price) {
    if (!price) return true;
    return price.toLowerCase().includes('free');
  }

  /**
   * 显示下一步操作提示
   */
  displayNextSteps(postResult) {
    const postIdMatch = postResult.filepath.match(/weekly_events_(\d{4}-\d{2}-\d{2}_\d{4})/);
    const postId = postIdMatch ? `post_${postIdMatch[1]}` : 'post_XXXX';

    console.log('\n' + '━'.repeat(60));
    console.log('💡 下一步操作');
    console.log('━'.repeat(60));
    console.log('1. 📱 将内容发布到小红书');
    console.log('2. ⏰ 等待 2-3 天收集用户反馈');
    console.log(`3. 📊 运行反馈收集: npm run collect-feedback ${postId}`);
    console.log('━'.repeat(60));
  }

  displayGenerationSummary(postResult, contentSummary, urlSummary) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 内容生成总结');
    console.log('='.repeat(60));

    console.log(`📝 活动数量: ${postResult.stats.totalEvents}`);
    console.log(`📏 内容长度: ${contentSummary.character_count} 字符`);
    console.log(`🔗 链接数量: ${contentSummary.link_count}`);
    console.log(`#️⃣ 标签数量: ${contentSummary.hashtag_count}`);

    console.log(`\n🔗 短链接生成:`);
    console.log(`   ✅ 成功: ${urlSummary.successful}/${urlSummary.total}`);
    console.log(`   ❌ 失败: ${urlSummary.failed}/${urlSummary.total}`);

    console.log(`\n📱 内容验证:`);
    if (contentSummary.validation.valid) {
      console.log('   ✅ 内容格式符合要求');
    } else {
      console.log('   ⚠️  内容存在以下问题:');
      contentSummary.validation.issues.forEach(issue => {
        console.log(`      - ${issue}`);
      });
    }

    console.log('='.repeat(60));
  }

  // 显示帮助信息
  static showHelp() {
    console.log(`
🎯 Bay Area Events Post Generator

用法:
  npm run generate-post <审核文件路径>
  npm run generate-post <审核文件路径> --ai-provider gemini

示例:
  npm run generate-post "./output/review_2024-09-19_1430.json"
  npm run generate-post "./output/review_2024-09-19_1430.json" --ai-provider mistral

参数:
  --ai-provider <provider>  指定AI提供商 (openai, gemini, claude, mistral)

功能:
1. 读取人工审核后的活动选择
2. 为选中活动生成 Short.io 短链接
3. AI翻译优化内容适合小红书发布
4. 生成最终的发布文本

必需的环境变量:
- SHORTIO_API_KEY: Short.io API 密钥
- 至少一个AI API密钥:
  * OPENAI_API_KEY: OpenAI API 密钥
  * GEMINI_API_KEY: Google Gemini API 密钥
  * CLAUDE_API_KEY: Anthropic Claude API 密钥
  * MISTRAL_API_KEY: Mistral AI API 密钥
- AI_PROVIDER: 指定默认AI提供商 (openai, gemini, claude, mistral)

输出文件: ${require('./config').output.directory}/weekly_events_*.txt
`);
  }
}

// 处理命令行参数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    PostGenerationOrchestrator.showHelp();
    return;
  }
  
  // 处理AI提供商选择
  const aiProviderIndex = args.indexOf('--ai-provider');
  if (aiProviderIndex !== -1 && args[aiProviderIndex + 1]) {
    const provider = args[aiProviderIndex + 1];
    if (['openai', 'gemini', 'claude', 'mistral'].includes(provider)) {
      process.env.AI_PROVIDER = provider;
      console.log(`🤖 Using AI provider: ${provider}`);
      // 移除这个参数，以免被当作文件路径
      args.splice(aiProviderIndex, 2);
    } else {
      console.error(`❌ Invalid AI provider: ${provider}`);
      console.error('Valid options: openai, gemini, claude, mistral');
      process.exit(1);
    }
  }
  
  // v1.5: 如果没有提供参数，启用交互式选择模式
  const reviewFilePath = args.length > 0 ? args[0] : null;

  if (reviewFilePath === null) {
    console.log('💡 未指定review文件，启用交互式选择模式\n');
  }

  const orchestrator = new PostGenerationOrchestrator();
  await orchestrator.run(reviewFilePath);
}

// 只在直接运行时执行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = PostGenerationOrchestrator;