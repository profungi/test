/**
 * Review文件合并工具
 * 负责扫描、分组和合并多个review文件
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ReviewMerger {
  constructor(outputDir = './output') {
    this.outputDir = outputDir;
  }

  /**
   * 扫描output目录，找到所有review文件
   * @returns {Array} Review文件信息列表
   */
  scanReviewFiles() {
    try {
      const files = fs.readdirSync(this.outputDir);
      const reviewFiles = files
        .filter(f => f.startsWith('review_') && f.endsWith('.json'))
        .map(filename => {
          const filepath = path.join(this.outputDir, filename);
          const stats = fs.statSync(filepath);

          // 读取文件获取target_week
          let target_week = null;
          let target_week_readable = null;
          let event_count = 0;
          let scraped_at = stats.mtime.toISOString();

          try {
            const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            target_week = content.target_week || null;
            target_week_readable = content.target_week_readable || null;
            event_count = content.events ? content.events.length : 0;
            scraped_at = content.generated_at || stats.mtime.toISOString();
          } catch (err) {
            console.warn(`⚠️  无法读取 ${filename}: ${err.message}`);
          }

          return {
            filename,
            filepath,
            target_week,
            target_week_readable,
            event_count,
            scraped_at,
            file_size: stats.size,
            modified_at: stats.mtime
          };
        })
        .filter(f => f.target_week !== null) // 过滤掉无法读取的文件
        .sort((a, b) => b.modified_at - a.modified_at); // 按修改时间降序

      return reviewFiles;
    } catch (err) {
      throw new Error(`扫描review文件失败: ${err.message}`);
    }
  }

  /**
   * 按 target_week 分组review文件
   * @param {Array} reviewFiles - Review文件列表
   * @returns {Array} 分组后的列表
   */
  groupByTargetWeek(reviewFiles) {
    const groups = {};

    for (const file of reviewFiles) {
      const key = file.target_week;
      if (!groups[key]) {
        groups[key] = {
          target_week: file.target_week,
          target_week_readable: file.target_week_readable,
          files: []
        };
      }
      groups[key].files.push(file);
    }

    // 转为数组并按target_week排序
    return Object.values(groups).sort((a, b) => {
      return a.target_week.localeCompare(b.target_week);
    });
  }

  /**
   * 交互式选择要合并的review文件组
   * @param {Array} groups - 分组后的review列表
   * @returns {Promise<Object>} 选中的group
   */
  async selectReviewGroup(groups) {
    if (groups.length === 0) {
      throw new Error('没有找到任何review文件');
    }

    console.log('\n' + '━'.repeat(70));
    console.log('📋 发现以下周的爬取记录:');
    console.log('━'.repeat(70));

    groups.forEach((group, index) => {
      console.log(`\n【第${index + 1}组: ${group.target_week_readable || group.target_week}】`);
      group.files.forEach(file => {
        const scrapedTime = new Date(file.scraped_at).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`  ✓ ${file.filename}`);
        console.log(`    爬取时间: ${scrapedTime} | 活动数: ${file.event_count}`);
      });
    });

    console.log('\n' + '━'.repeat(70));

    // 如果只有一个组，自动选择
    if (groups.length === 1) {
      console.log(`\n✅ 只有一个时间段，自动选择: ${groups[0].target_week_readable}`);
      return groups[0];
    }

    // 让用户选择
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question(`\n请选择要生成帖子的时间段 [1-${groups.length}]: `, resolve);
    });
    rl.close();

    const choice = parseInt(answer.trim());
    if (isNaN(choice) || choice < 1 || choice > groups.length) {
      throw new Error('无效的选择');
    }

    const selectedGroup = groups[choice - 1];
    console.log(`\n✅ 已选择「${selectedGroup.target_week_readable}」的 ${selectedGroup.files.length} 个review`);

    return selectedGroup;
  }

  /**
   * 合并多个review文件的活动列表
   * @param {Array} reviewFiles - Review文件列表
   * @returns {Object} 合并后的结果
   */
  mergeReviewFiles(reviewFiles) {
    const allEvents = [];
    const sourceReviews = [];

    for (const file of reviewFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(file.filepath, 'utf8'));
        const events = content.events || [];

        // 为每个活动添加来源信息
        events.forEach(event => {
          event._source_review = file.filename;
          event._source_website = event.source || 'unknown';
        });

        allEvents.push(...events);

        // 记录来源review信息
        sourceReviews.push({
          file: file.filename,
          event_count: events.length,
          scraped_at: file.scraped_at
        });
      } catch (err) {
        console.warn(`⚠️  读取 ${file.filename} 失败: ${err.message}`);
      }
    }

    return {
      allEvents,
      sourceReviews,
      totalBeforeDedup: allEvents.length
    };
  }

  /**
   * 活动去重 - 基于80%title相似度 + 地点匹配
   * @param {Array} events - 活动列表
   * @returns {Object} 去重后的结果
   */
  deduplicateEvents(events) {
    const uniqueEvents = [];
    const duplicates = [];

    for (const event of events) {
      let isDuplicate = false;

      for (const existing of uniqueEvents) {
        if (this.areEventsSimilar(event, existing)) {
          isDuplicate = true;
          duplicates.push({
            duplicate: event.title,
            original: existing.title,
            reason: 'title相似度>80% 且 地点匹配'
          });
          break;
        }
      }

      if (!isDuplicate) {
        uniqueEvents.push(event);
      }
    }

    return {
      uniqueEvents,
      duplicates,
      totalAfterDedup: uniqueEvents.length,
      removedCount: duplicates.length
    };
  }

  /**
   * 判断两个活动是否相似（去重判断）
   * @param {Object} event1
   * @param {Object} event2
   * @returns {Boolean}
   */
  areEventsSimilar(event1, event2) {
    // 计算title相似度
    const similarity = this.calculateStringSimilarity(event1.title || '', event2.title || '');

    // 检查地点是否匹配
    const locationMatch = this.normalizeLocation(event1.location) ===
                          this.normalizeLocation(event2.location);

    // title相似度 >= 80% 且地点匹配，认为是重复
    return similarity >= 0.8 && locationMatch;
  }

  /**
   * 计算字符串相似度 (Jaccard Similarity)
   * @param {String} str1
   * @param {String} str2
   * @returns {Number} 0-1之间的相似度
   */
  calculateStringSimilarity(str1, str2) {
    // 转小写并分词
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));

    // 计算交集
    const intersection = new Set([...words1].filter(x => words2.has(x)));

    // 计算并集
    const union = new Set([...words1, ...words2]);

    // Jaccard相似度 = 交集大小 / 并集大小
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 标准化地点字符串（用于比较）
   * @param {String} location
   * @returns {String}
   */
  normalizeLocation(location) {
    if (!location) return '';

    // 去除标点、空格，转小写
    return location
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 显示合并和去重结果
   * @param {Object} mergeResult
   * @param {Object} dedupResult
   */
  displayMergeResults(mergeResult, dedupResult) {
    console.log('\n' + '━'.repeat(70));
    console.log('📊 合并和去重结果');
    console.log('━'.repeat(70));
    console.log(`📁 来源review文件数: ${mergeResult.sourceReviews.length}`);
    console.log(`📝 合并前活动总数: ${mergeResult.totalBeforeDedup}`);
    console.log(`🔄 去重后活动总数: ${dedupResult.totalAfterDedup}`);
    console.log(`❌ 移除重复活动数: ${dedupResult.removedCount}`);

    if (dedupResult.removedCount > 0) {
      console.log('\n移除的重复活动:');
      dedupResult.duplicates.slice(0, 5).forEach((dup, i) => {
        console.log(`  ${i + 1}. ${dup.duplicate}`);
        console.log(`     (与 "${dup.original}" 重复)`);
      });
      if (dedupResult.duplicates.length > 5) {
        console.log(`  ... 还有 ${dedupResult.duplicates.length - 5} 个重复活动`);
      }
    }

    console.log('━'.repeat(70));
  }
}

module.exports = ReviewMerger;
