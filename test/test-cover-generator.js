#!/usr/bin/env node

/**
 * 测试封面图片生成器
 * 独立测试脚本，无需完整的活动数据
 */

const CoverGenerator = require('../src/utils/cover-generator');

async function testCoverGenerator() {
  console.log('🧪 开始测试封面图片生成器...\n');

  try {
    const generator = new CoverGenerator();

    // 测试案例1：模拟11月第一周（从周一2024-11-04开始）
    console.log('📋 测试案例 1: 2024年11月第一周');
    const weekRange1 = {
      identifier: '2024-11-04_to_2024-11-10',
      start: '2024-11-04',
      end: '2024-11-10'
    };

    const result1 = await generator.generateCover(weekRange1);
    console.log('✅ 测试案例 1 成功！');
    console.log(`   生成的日期范围: ${result1.dateRange}`);
    console.log(`   文件路径: ${result1.filepath}`);
    console.log(`   文件名: ${result1.filename}\n`);

    // 测试案例2：模拟9月第三周（从周一2024-09-16开始）
    console.log('📋 测试案例 2: 2024年9月第三周');
    const weekRange2 = {
      identifier: '2024-09-16_to_2024-09-22',
      start: '2024-09-16',
      end: '2024-09-22'
    };

    const result2 = await generator.generateCover(weekRange2);
    console.log('✅ 测试案例 2 成功！');
    console.log(`   生成的日期范围: ${result2.dateRange}`);
    console.log(`   文件路径: ${result2.filepath}`);
    console.log(`   文件名: ${result2.filename}\n`);

    // 测试案例3：模拟12月第四周（跨年）
    console.log('📋 测试案例 3: 2024年12月第四周（跨年测试）');
    const weekRange3 = {
      identifier: '2024-12-30_to_2025-01-05',
      start: '2024-12-30',
      end: '2025-01-05'
    };

    const result3 = await generator.generateCover(weekRange3);
    console.log('✅ 测试案例 3 成功！');
    console.log(`   生成的日期范围: ${result3.dateRange}`);
    console.log(`   文件路径: ${result3.filepath}`);
    console.log(`   文件名: ${result3.filename}\n`);

    console.log('=' .repeat(60));
    console.log('🎉 所有测试通过！');
    console.log('=' .repeat(60));
    console.log('\n📁 生成的图片保存在: output/covers/');
    console.log('💡 提示: 使用图片查看器打开PNG文件查看效果\n');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('\n详细错误信息:');
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
testCoverGenerator();
