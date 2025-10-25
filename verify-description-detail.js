#!/usr/bin/env node

/**
 * 验证脚本：检查数据库中的 description_detail 字段是否被正确填充
 * 可以查看最新抓取的事件中有多少有 description_detail
 */

const EventDatabase = require('./src/utils/database');

async function verifyDescriptionDetail() {
  const db = new EventDatabase();

  try {
    console.log('📊 Verifying description_detail field in database...\n');
    console.log('='.repeat(70));

    // 连接数据库
    await db.connect();

    // 查询最近的事件
    db.db.all(`
      SELECT
        id,
        source,
        title,
        description,
        description_detail,
        LENGTH(description) as desc_length,
        LENGTH(description_detail) as detail_length,
        scraped_at
      FROM events
      ORDER BY scraped_at DESC, id DESC
      LIMIT 50
    `, (err, rows) => {
      if (err) {
        console.error('❌ Database query error:', err);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('⚠️  No events found in database');
        db.close();
        return;
      }

      console.log(`\n📌 Latest ${rows.length} events from database:\n`);

      // 统计数据
      let totalEvents = rows.length;
      let withDescription = 0;
      let withDetailDescription = 0;
      let bySource = {};

      rows.forEach((row, idx) => {
        if (row.description && row.description.trim().length > 0) {
          withDescription++;
        }
        if (row.description_detail && row.description_detail.trim().length > 0) {
          withDetailDescription++;
        }

        if (!bySource[row.source]) {
          bySource[row.source] = {
            total: 0,
            withDetail: 0
          };
        }
        bySource[row.source].total++;
        if (row.description_detail && row.description_detail.trim().length > 0) {
          bySource[row.source].withDetail++;
        }

        // 显示前10个事件的详情
        if (idx < 10) {
          console.log(`${idx + 1}. [${row.source}] ${row.title}`);
          console.log(`   📝 Description: ${row.desc_length > 0 ? `✅ ${row.desc_length} chars` : '❌ Empty'}`);
          console.log(`   📖 DetailDescription: ${row.detail_length > 0 ? `✅ ${row.detail_length} chars` : '❌ Empty'}`);

          if (row.description_detail && row.description_detail.trim().length > 0) {
            const preview = row.description_detail.substring(0, 100);
            console.log(`      Preview: ${preview}${row.description_detail.length > 100 ? '...' : ''}`);
          }
          console.log('');
        }
      });

      // 总体统计
      console.log('\n' + '='.repeat(70));
      console.log('\n📊 Overall Statistics:\n');
      console.log(`Total events: ${totalEvents}`);
      console.log(`With description: ${withDescription}/${totalEvents} (${((withDescription/totalEvents)*100).toFixed(1)}%)`);
      console.log(`With description_detail: ${withDetailDescription}/${totalEvents} (${((withDetailDescription/totalEvents)*100).toFixed(1)}%)`);

      // 按来源统计
      console.log('\n📍 Statistics by Source:\n');
      Object.keys(bySource).forEach(source => {
        const stats = bySource[source];
        const percentage = ((stats.withDetail / stats.total) * 100).toFixed(1);
        console.log(`${source}:`);
        console.log(`  Total: ${stats.total}`);
        console.log(`  With description_detail: ${stats.withDetail}/${stats.total} (${percentage}%)`);
        if (stats.withDetail === stats.total) {
          console.log(`  ✅ ALL events have description_detail`);
        } else if (stats.withDetail === 0) {
          console.log(`  ❌ NO events have description_detail`);
        } else {
          console.log(`  ⚠️  PARTIAL - ${stats.total - stats.withDetail} events missing description_detail`);
        }
      });

      // 建议
      console.log('\n' + '='.repeat(70));
      console.log('\n💡 Recommendations:\n');

      if (withDetailDescription === totalEvents) {
        console.log('✅ All events have description_detail - Everything looks good!');
      } else if (withDetailDescription === 0) {
        console.log('❌ No events have description_detail - Check if:');
        console.log('   1. Scrapers are correctly returning description_detail field');
        console.log('   2. Database migration added description_detail column');
        console.log('   3. Latest scraping run has completed');
      } else {
        console.log('⚠️  Partial description_detail coverage - Check:');
        console.log('   1. Which sources are missing description_detail');
        console.log('   2. If detail page fetching is working correctly');
        console.log('   3. If there are any errors in the scraper logs');
      }

      db.close();
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyDescriptionDetail();
