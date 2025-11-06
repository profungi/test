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
    const selectedEvents = [];
    const unselectedEvents = [];
    const sourceReviews = [];
    let totalCandidates = 0;

    for (const file of reviewFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(file.filepath, 'utf8'));
        const events = content.events || [];
        totalCandidates += events.length;

        // 分离已选择和未选择的活动
        for (const event of events) {
          // 为每个活动添加来源信息
          event._source_review = file.filename;
          event._source_website = event.source || 'unknown';

          if (event.selected === true) {
            selectedEvents.push(event);
          } else {
            unselectedEvents.push(event);
          }
        }

        // 记录来源review信息
        sourceReviews.push({
          file: file.filename,
          total_candidates: events.length,
          selected_count: events.filter(e => e.selected === true).length,
          event_count: events.filter(e => e.selected === true).length,  // 保留向后兼容
          scraped_at: file.scraped_at
        });
      } catch (err) {
        console.warn(`⚠️  读取 ${file.filename} 失败: ${err.message}`);
      }
    }

    // 如果没有选中任何活动，抛出错误
    if (selectedEvents.length === 0) {
      throw new Error(
        `没有找到任何选中的活动！\n` +
        `   总候选活动: ${totalCandidates} 个\n` +
        `   请在 review 文件中将要发布的活动的 "selected" 改为 true`
      );
    }

    // 按优先级排序未选择的活动
    unselectedEvents.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return {
      allEvents: selectedEvents,
      unselectedEvents,
      sourceReviews,
      totalBeforeDedup: selectedEvents.length,
      totalCandidates
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

    // 显示每个文件的选择统计
    mergeResult.sourceReviews.forEach(review => {
      const selectionRate = review.total_candidates > 0
        ? ((review.selected_count / review.total_candidates) * 100).toFixed(1)
        : '0.0';
      console.log(`   - ${review.file}: ${review.selected_count}/${review.total_candidates} 个活动 (${selectionRate}%)`);
    });

    console.log(`\n📝 选中活动总数: ${mergeResult.totalBeforeDedup}`);
    console.log(`🔄 去重后活动数: ${dedupResult.totalAfterDedup}`);
    console.log(`❌ 移除重复数: ${dedupResult.removedCount}`);

    if (dedupResult.removedCount > 0) {
      console.log('\n🔍 移除的重复活动:');
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

  /**
   * 显示最终活动列表供用户确认（支持移除和添加备选）
   * @param {Array} selectedEvents - 已选择的活动列表
   * @param {Array} candidateEvents - 备选活动列表
   * @returns {Promise<Array>} 用户确认后的活动列表
   */
  async finalSelectionReview(selectedEvents, candidateEvents = []) {
    let currentEvents = [...selectedEvents];

    while (true) {
      // 第一步：显示已选择的活动
      console.log('\n' + '━'.repeat(70));
      console.log(`📋 已选择的活动 (${currentEvents.length} 个)`);
      console.log('━'.repeat(70));

      currentEvents.forEach((event, index) => {
        const num = String(index + 1).padStart(2, ' ');
        const type = event.event_type || 'unknown';
        const title = event.title || 'Untitled';
        const location = this.truncateString(event.location || 'Unknown', 40);
        const price = event.price || 'Free';
        const time = this.extractTimeDisplay(event.time_display || event.start_time || '');

        console.log(`\n${num}. ✓ [${type}] ${title}`);
        console.log(`    📍 ${location} | 💰 ${price} | 📅 ${time}`);
      });

      console.log('\n' + '━'.repeat(70));
      console.log('💡 操作:');
      console.log('  • 继续: Enter  • 移除: 输入序号 (如: 2)');
      console.log('  • 手动添加URL: add  • 取消: n');
      console.log('━'.repeat(70));

      const rl1 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer1 = await new Promise(resolve => {
        rl1.question('\n请选择: ', resolve);
      });
      rl1.close();

      const input = answer1.trim().toLowerCase();

      // 取消操作
      if (input === 'n' || input === 'no') {
        throw new Error('用户取消操作');
      }

      // 直接继续
      if (input === '' || input === 'y' || input === 'yes') {
        console.log(`\n✅ 确认生成，共 ${currentEvents.length} 个活动`);
        return currentEvents;
      }

      // 手动添加活动
      if (input === 'add') {
        const newEvent = await this.addCustomEventFromUrl();
        if (newEvent) {
          currentEvents.push(newEvent);
          console.log(`\n✅ 活动已添加: ${newEvent.title}`);
          console.log(`📊 当前活动数: ${currentEvents.length} 个`);
        }
        continue;
      }

      // 解析要移除的序号
      const toRemove = this.parseRemovalInput(input, currentEvents.length);
      if (toRemove.length === 0) {
        console.log('\n⚠️  无效的输入');
        continue;
      }

      // 移除指定的活动
      const removedEvents = [];
      toRemove.forEach(num => {
        removedEvents.push(currentEvents[num - 1]);
      });

      currentEvents = currentEvents.filter((event, index) => !toRemove.includes(index + 1));

      console.log(`\n✅ 已移除 ${toRemove.length} 个活动:`);
      removedEvents.forEach(event => {
        console.log(`  - ${event.title}`);
      });

      // 第二步：询问是否添加备选活动
      if (candidateEvents.length > 0) {
        const added = await this.showCandidatesAndAdd(currentEvents, candidateEvents);
        if (added) {
          currentEvents.push(...added);
        }
      } else {
        console.log('\n💡 没有可用的备选活动');
        const continueAnyway = await this.askYesNo('是否继续生成? [Y/n]');
        if (!continueAnyway) {
          throw new Error('用户取消操作');
        }
        return currentEvents;
      }
    }
  }

  /**
   * 显示备选活动并询问是否添加
   * @param {Array} currentEvents - 当前已选活动
   * @param {Array} candidateEvents - 备选活动列表
   * @returns {Promise<Array|null>} 添加的活动数组，或 null
   */
  async showCandidatesAndAdd(currentEvents, candidateEvents) {
    console.log('\n' + '━'.repeat(70));
    console.log(`📦 可添加的备选活动 (${candidateEvents.length} 个，按优先级排序)`);
    console.log('━'.repeat(70));

    // 只显示前10个备选
    const displayCount = Math.min(10, candidateEvents.length);
    candidateEvents.slice(0, displayCount).forEach((event, index) => {
      const num = String(index + 1).padStart(2, ' ');
      const type = event.event_type || 'unknown';
      const title = event.title || 'Untitled';
      const location = this.truncateString(event.location || 'Unknown', 35);
      const price = event.price || 'Free';
      const time = this.extractTimeDisplay(event.time_display || event.start_time || '');
      const priority = event.priority ? `⭐ ${event.priority.toFixed(1)}` : '';

      console.log(`\n${num}. [${type}] ${title}`);
      console.log(`    📍 ${location} | 💰 ${price} | 📅 ${time} ${priority}`);
    });

    if (candidateEvents.length > displayCount) {
      console.log(`\n... 还有 ${candidateEvents.length - displayCount} 个备选活动未显示`);
    }

    console.log('\n' + '━'.repeat(70));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n添加备选活动? [序号/n/scrape]: ', resolve);
    });
    rl.close();

    const input = answer.trim().toLowerCase();

    // 取消添加
    if (input === 'n' || input === 'no' || input === '') {
      console.log(`\n📊 当前活动数: ${currentEvents.length} 个`);
      return null;
    }

    // 显示抓取提示
    if (input === 'scrape') {
      this.showScrapeHint();
      const continueAnyway = await this.askYesNo('\n是否继续当前流程（不添加新活动）? [y/N]', false);
      if (!continueAnyway) {
        throw new Error('用户选择重新抓取');
      }
      return null;
    }

    // 解析要添加的序号
    const toAdd = this.parseRemovalInput(input, candidateEvents.length);
    if (toAdd.length === 0) {
      console.log('\n⚠️  无效的输入');
      return null;
    }

    // 获取要添加的活动
    const addedEvents = toAdd.map(num => candidateEvents[num - 1]);

    console.log(`\n✅ 已添加 ${addedEvents.length} 个活动:`);
    addedEvents.forEach(event => {
      console.log(`  + ${event.title}`);
    });
    console.log(`📊 当前活动数: ${currentEvents.length + addedEvents.length} 个`);

    return addedEvents;
  }

  /**
   * 显示抓取提示
   */
  showScrapeHint() {
    console.log('\n' + '━'.repeat(70));
    console.log('💡 需要抓取更多活动');
    console.log('━'.repeat(70));
    console.log('\n快速抓取命令:');
    console.log('  npm run scrape-eventbrite  (推荐，活动质量高)');
    console.log('  npm run scrape-funcheap    (免费活动多)');
    console.log('  npm run scrape-all-sites   (全面但耗时)');
    console.log('\n抓取后:');
    console.log('  1. 在新的 review 文件中标记 selected: true');
    console.log('  2. 重新运行 npm run generate-post');
    console.log('  3. 系统会自动合并本周的所有 review');
    console.log('━'.repeat(70));
  }

  /**
   * 询问是非问题
   * @param {String} question - 问题
   * @param {Boolean} defaultYes - 默认是否为 Yes
   * @returns {Promise<Boolean>}
   */
  async askYesNo(question, defaultYes = true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question(question + ' ', resolve);
    });
    rl.close();

    const input = answer.trim().toLowerCase();

    if (input === '') {
      return defaultYes;
    }

    return input === 'y' || input === 'yes';
  }

  /**
   * 解析用户输入的移除序号
   * @param {String} input - 用户输入，如 "1,3,5" 或 "1 3 5"
   * @param {Number} maxNum - 最大序号
   * @returns {Array} 要移除的序号数组
   */
  parseRemovalInput(input, maxNum) {
    try {
      // 支持逗号或空格分隔
      const numbers = input.split(/[,\s]+/)
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= 1 && n <= maxNum);

      // 去重并排序
      return [...new Set(numbers)].sort((a, b) => a - b);
    } catch (err) {
      return [];
    }
  }

  /**
   * 截断字符串
   * @param {String} str
   * @param {Number} maxLength
   * @returns {String}
   */
  truncateString(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * 手动添加活动from URL
   * @returns {Promise<Object|null>} 提取的活动对象或null
   */
  async addCustomEventFromUrl() {
    console.log('\n' + '━'.repeat(70));
    console.log('🔗 手动添加活动from URL');
    console.log('━'.repeat(70));

    // 获取URL
    const rl1 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const url = await new Promise(resolve => {
      rl1.question('\n请输入活动URL (或输入 n 取消): ', resolve);
    });
    rl1.close();

    const urlInput = url.trim();

    if (urlInput === 'n' || urlInput === '') {
      console.log('❌ 已取消');
      return null;
    }

    try {
      // 使用UniversalScraper抓取活动
      const UniversalScraper = require('./universal-scraper');
      const scraper = new UniversalScraper();

      console.log('\n🔍 检测URL来源...');
      const source = scraper.detectSource(urlInput);
      console.log(`✅ 检测到: ${source}`);

      console.log('📥 正在获取活动详情...');
      const event = await scraper.scrapeEventFromUrl(urlInput);

      // 显示提取的活动信息
      console.log('\n' + '━'.repeat(70));
      console.log('📋 提取的活动信息');
      console.log('━'.repeat(70));
      console.log(`标题: ${event.title}`);
      console.log(`时间: ${this.formatDateTime(event.startTime)}`);
      if (event.endTime) {
        console.log(`结束时间: ${this.formatDateTime(event.endTime)}`);
      }
      console.log(`地点: ${event.location}`);
      console.log(`价格: ${event.price || 'N/A'}`);
      if (event.description) {
        const desc = event.description.substring(0, 150);
        console.log(`描述: ${desc}${event.description.length > 150 ? '...' : ''}`);
      }
      console.log(`URL: ${event.originalUrl}`);
      console.log('━'.repeat(70));

      // 确认添加
      const confirmed = await this.askYesNo('\n确认添加这个活动? [Y/n]');
      if (!confirmed) {
        console.log('❌ 已取消');
        return null;
      }

      // 转换为review格式
      const reviewEvent = this.convertToReviewFormat(event);
      return reviewEvent;

    } catch (error) {
      console.error(`\n❌ 抓取失败: ${error.message}`);
      console.log('💡 提示: 请检查URL是否正确，或者网站是否可访问');
      return null;
    }
  }

  /**
   * 将scraper返回的活动转换为review格式
   * @param {Object} event - scraper返回的活动
   * @returns {Object} review格式的活动
   */
  convertToReviewFormat(event) {
    return {
      title: event.title,
      location: event.location,
      start_time: event.startTime,
      end_time: event.endTime || null,
      time_display: this.formatDateTime(event.startTime),
      price: event.price || 'Free',
      description: event.description || '',
      original_url: event.originalUrl,
      event_type: this.guessEventType(event.title, event.description),
      priority: 5.0,  // 默认优先级
      selected: true,  // 手动添加的默认选中
      _source_website: event._source_website,
      _manually_added: true,
      _extraction_method: event._extraction_method || 'scraper'
    };
  }

  /**
   * 格式化日期时间
   * @param {String} isoString - ISO 8601时间字符串
   * @returns {String}
   */
  formatDateTime(isoString) {
    if (!isoString) return 'TBD';

    try {
      const date = new Date(isoString);
      const options = {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
      };
      return date.toLocaleString('en-US', options);
    } catch (e) {
      return isoString;
    }
  }

  /**
   * 猜测活动类型
   * @param {String} title - 活动标题
   * @param {String} description - 活动描述
   * @returns {String}
   */
  guessEventType(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();

    if (text.match(/\b(market|fair|bazaar|farmers)\b/i)) return 'market';
    if (text.match(/\b(festival|celebration|parade)\b/i)) return 'festival';
    if (text.match(/\b(food|dinner|lunch|brunch|tasting|culinary)\b/i)) return 'food';
    if (text.match(/\b(music|concert|band|jazz|orchestra)\b/i)) return 'music';
    if (text.match(/\b(art|gallery|exhibit|museum|paint)\b/i)) return 'art';
    if (text.match(/\b(tech|startup|developer|coding|hackathon)\b/i)) return 'tech';
    if (text.match(/\b(free|no cost|complimentary)\b/i)) return 'free';

    return 'other';
  }

  /**
   * 提取简化的时间显示
   * @param {String} timeStr
   * @returns {String}
   */
  extractTimeDisplay(timeStr) {
    if (!timeStr) return 'TBD';

    // 尝试提取 "Saturday 11/10" 这样的格式
    const match = timeStr.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}\/\d{1,2})/i);
    if (match) {
      return match[0]; // "Saturday 11/10"
    }

    // 如果没匹配到，截断到前30个字符
    return this.truncateString(timeStr, 30);
  }
}

module.exports = ReviewMerger;
