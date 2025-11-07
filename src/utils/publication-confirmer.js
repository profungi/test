/**
 * 发布确认模块
 * 处理发布前的编辑、确认和手动添加活动流程
 */

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const UniversalScraper = require('./universal-scraper');
const URLShortener = require('./url-shortener');

class PublicationConfirmer {
  constructor() {
    this.universalScraper = new UniversalScraper();
    this.urlShortener = new URLShortener();
  }

  /**
   * 发布前确认流程
   * @param {string} generatedContent - AI生成的原始内容
   * @param {Array} events - 活动列表
   * @param {Object} weekRange - 周范围信息
   * @returns {Object} { publishedContent, contentModified, newEvents }
   */
  async confirmPublication(generatedContent, events, weekRange) {
    console.log('\n' + '='.repeat(70));
    console.log('📱 最终发布内容预览');
    console.log('='.repeat(70));
    console.log(generatedContent);
    console.log('='.repeat(70));
    console.log(`📏 字符总数: ${generatedContent.length}`);
    console.log(`📊 活动数量: ${events.length} 个`);
    console.log('='.repeat(70));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let choice;
    while (true) {
      console.log('\n📋 请选择下一步操作:');
      console.log('  [1] 直接使用此内容发布');
      console.log('  [2] 编辑内容后发布');
      console.log('  [3] 取消，不保存记录');

      choice = await new Promise(resolve => {
        rl.question('\n请选择 [1/2/3]: ', resolve);
      });

      const choiceNum = choice.trim();
      if (['1', '2', '3'].includes(choiceNum)) {
        choice = choiceNum;
        break;
      }
      console.log('⚠️  无效的选择，请输入 1、2 或 3');
    }

    rl.close();

    if (choice === '3') {
      console.log('\n❌ 已取消操作');
      return null;
    }

    let publishedContent = generatedContent;
    let contentModified = false;
    let newEvents = [];

    if (choice === '2') {
      // 编辑内容
      const editResult = await this.editContent(generatedContent);
      if (!editResult) {
        console.log('\n❌ 编辑已取消');
        return null;
      }
      publishedContent = editResult;
      contentModified = true;

      // 询问是否添加新活动
      newEvents = await this.askAndAddNewEvents(weekRange);
    }

    return {
      publishedContent,
      contentModified,
      newEvents
    };
  }

  /**
   * 编辑内容
   * @param {string} content - 原始内容
   * @returns {string|null} 编辑后的内容，或 null 表示取消
   */
  async editContent(content) {
    console.log('\n📝 请选择编辑方式:');
    console.log('');
    console.log('  [1] 保存到文件，我手动编辑（推荐）');
    console.log('  [2] 直接粘贴编辑后的内容');
    console.log('  [3] 使用系统默认编辑器（需要配置 $EDITOR）');
    console.log('  [4] 使用 nano（简单）');
    console.log('  [5] 使用 vim（高级）');
    console.log('  [0] 取消编辑');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const choice = await new Promise(resolve => {
      rl.question('\n请选择 [1/2/3/4/5/0]: ', resolve);
    });
    rl.close();

    const choiceNum = choice.trim();

    if (choiceNum === '0') {
      console.log('\n❌ 已取消编辑');
      return null;
    }

    // 创建临时文件
    const tempDir = path.join(__dirname, '../../output');
    const tempFile = path.join(tempDir, `temp_post_${Date.now()}.txt`);

    try {
      // 写入临时文件
      await fs.writeFile(tempFile, content, 'utf8');

      let editedContent = null;

      switch (choiceNum) {
        case '1':
          // 保存到文件，用户手动编辑
          editedContent = await this.editViaFile(tempFile, content);
          break;

        case '2':
          // 直接粘贴
          editedContent = await this.editViaPaste();
          break;

        case '3':
          // 系统默认编辑器
          const systemEditor = process.env.EDITOR || process.env.VISUAL;
          if (!systemEditor) {
            console.log('\n⚠️  未设置 $EDITOR 环境变量，请选择其他方式');
            return await this.editContent(content);
          }
          editedContent = await this.editViaEditor(tempFile, systemEditor);
          break;

        case '4':
          // nano
          editedContent = await this.editViaEditor(tempFile, 'nano');
          break;

        case '5':
          // vim
          editedContent = await this.editViaEditor(tempFile, 'vim');
          break;

        default:
          console.log('\n⚠️  无效的选择，默认使用方式1');
          editedContent = await this.editViaFile(tempFile, content);
      }

      // 清理临时文件
      try {
        await fs.unlink(tempFile);
      } catch (e) {
        // 忽略删除错误
      }

      if (editedContent) {
        console.log('\n✅ 内容已更新');
        console.log(`📏 原长度: ${content.length} 字符`);
        console.log(`📏 新长度: ${editedContent.length} 字符`);
      }

      return editedContent;

    } catch (error) {
      console.error('\n❌ 编辑过程出错:', error.message);

      // 清理临时文件
      try {
        await fs.unlink(tempFile);
      } catch (e) {
        // 忽略删除错误
      }

      return null;
    }
  }

  /**
   * 方式1: 保存到文件，用户手动编辑
   */
  async editViaFile(tempFile, originalContent) {
    console.log('\n' + '━'.repeat(70));
    console.log('📄 文件已保存，请用你喜欢的编辑器打开并修改:');
    console.log('━'.repeat(70));
    console.log(`\n   ${tempFile}\n`);
    console.log('💡 推荐编辑器:');
    console.log('   • VSCode:    code "' + tempFile + '"');
    console.log('   • Sublime:   subl "' + tempFile + '"');
    console.log('   • TextEdit:  open -a TextEdit "' + tempFile + '"');
    console.log('   • 记事本:     notepad "' + tempFile + '"');
    console.log('');
    console.log('编辑完成后，保存文件并回到这里');
    console.log('━'.repeat(70));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question('\n完成编辑后按回车键继续...', resolve);
    });
    rl.close();

    // 读取编辑后的内容
    const editedContent = await fs.readFile(tempFile, 'utf8');

    if (editedContent.trim() === originalContent.trim()) {
      console.log('\n⚠️  内容未改变');
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirm = await new Promise(resolve => {
        rl2.question('确认使用原内容？[Y/n]: ', resolve);
      });
      rl2.close();

      if (confirm.trim().toLowerCase() === 'n') {
        return null;
      }
    }

    return editedContent;
  }

  /**
   * 方式2: 直接粘贴编辑后的内容
   */
  async editViaPaste() {
    console.log('\n' + '━'.repeat(70));
    console.log('📋 请粘贴编辑后的内容');
    console.log('━'.repeat(70));
    console.log('💡 提示:');
    console.log('   1. 复制编辑好的内容');
    console.log('   2. 粘贴到下方');
    console.log('   3. 单独一行输入 "EOF" 结束');
    console.log('━'.repeat(70));
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const lines = [];
    let isReading = true;

    return new Promise((resolve) => {
      rl.on('line', (line) => {
        if (line.trim() === 'EOF') {
          rl.close();
        } else {
          lines.push(line);
        }
      });

      rl.on('close', () => {
        const content = lines.join('\n');
        if (content.trim().length === 0) {
          console.log('\n⚠️  内容为空，已取消');
          resolve(null);
        } else {
          resolve(content);
        }
      });
    });
  }

  /**
   * 方式3/4/5: 使用指定编辑器
   */
  async editViaEditor(tempFile, editor) {
    console.log(`\n📝 使用编辑器: ${editor}`);

    if (editor === 'nano') {
      console.log('💡 nano 使用提示:');
      console.log('   - 编辑内容');
      console.log('   - Ctrl+X 退出');
      console.log('   - 提示保存时按 Y');
      console.log('   - 按回车确认文件名');
    } else if (editor === 'vim') {
      console.log('💡 vim 使用提示:');
      console.log('   - 按 i 进入编辑模式');
      console.log('   - 编辑内容');
      console.log('   - 按 ESC 退出编辑模式');
      console.log('   - 输入 :wq 保存并退出');
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question('\n按回车键打开编辑器...', resolve);
    });
    rl.close();

    try {
      // 使用 spawn 以便继承 stdio
      await new Promise((resolve, reject) => {
        const child = spawn(editor, [tempFile], {
          stdio: 'inherit',
          shell: true
        });

        child.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`编辑器退出码: ${code}`));
          }
        });

        child.on('error', (err) => {
          reject(err);
        });
      });

      // 读取编辑后的内容
      const editedContent = await fs.readFile(tempFile, 'utf8');
      return editedContent;

    } catch (error) {
      console.error(`\n❌ 无法打开编辑器 ${editor}:`, error.message);
      console.log('建议使用方式1或方式2');
      return null;
    }
  }

  /**
   * 询问并添加新活动
   * @param {Object} weekRange - 周范围信息
   * @returns {Array} 新添加的活动列表
   */
  async askAndAddNewEvents(weekRange) {
    console.log('\n' + '━'.repeat(70));
    console.log('❓ 你是否在编辑中添加了新的活动？');
    console.log('');
    console.log('如果添加了新活动，我可以帮你：');
    console.log('  • 抓取活动信息');
    console.log('  • 生成短链接');
    console.log('  • 记录到数据库以便后续追踪反馈');
    console.log('━'.repeat(70));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n是否添加了新活动？[y/N]: ', resolve);
    });

    rl.close();

    const hasNewEvents = answer.trim().toLowerCase() === 'y';

    if (!hasNewEvents) {
      console.log('✅ 好的，继续保存');
      return [];
    }

    // 循环添加新活动
    const newEvents = [];
    let eventIndex = 1;

    console.log('\n' + '━'.repeat(70));
    console.log('🔗 请输入新活动的URL');
    console.log('   (输入 \'done\' 结束添加，输入 \'skip\' 跳过)');
    console.log('━'.repeat(70));

    while (true) {
      const rl2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const url = await new Promise(resolve => {
        rl2.question(`\n活动 #${eventIndex} URL: `, resolve);
      });

      rl2.close();

      const urlInput = url.trim();

      if (urlInput === 'done' || urlInput === '') {
        break;
      }

      if (urlInput === 'skip') {
        console.log('⏭️  跳过');
        break;
      }

      try {
        // 抓取活动信息
        console.log('\n🔍 检测URL来源...');
        const source = this.universalScraper.detectSource(urlInput);
        console.log(`✅ 检测到: ${source}`);

        console.log('📥 正在获取活动详情...');
        const event = await this.universalScraper.scrapeEventFromUrl(urlInput);

        // 显示活动信息
        console.log('\n✅ 活动信息：');
        console.log(`   标题: ${event.title}`);
        console.log(`   时间: ${event.startTime}`);
        console.log(`   地点: ${event.location}`);
        console.log(`   价格: ${event.price || 'N/A'}`);

        // 确认添加
        const rl3 = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const confirm = await new Promise(resolve => {
          rl3.question('\n确认添加? [Y/n]: ', resolve);
        });

        rl3.close();

        if (confirm.trim().toLowerCase() === 'n') {
          console.log('❌ 已跳过此活动');
          continue;
        }

        // 生成短链接
        console.log('🔗 正在生成短链接...');
        const shortUrlResult = await this.urlShortener.shortenUrl(
          event.originalUrl,
          `${event.title.substring(0, 30)} - Week ${weekRange.identifier}`
        );

        if (shortUrlResult.success) {
          event.short_url = shortUrlResult.shortUrl;
          console.log(`✅ 短链接: ${shortUrlResult.shortUrl}`);
        } else {
          console.log(`⚠️  短链接生成失败，将使用原始链接`);
          event.short_url = event.originalUrl;
        }

        // 标记为手动添加
        event._manually_added_at_publish = true;
        event._source_website = event._source_website || source;

        newEvents.push(event);
        console.log('✅ 已添加');

        eventIndex++;

      } catch (error) {
        console.error(`\n❌ 添加失败: ${error.message}`);
        console.log('');

        const rl4 = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const retry = await new Promise(resolve => {
          rl4.question('是否继续添加其他活动？[Y/n]: ', resolve);
        });

        rl4.close();

        if (retry.trim().toLowerCase() === 'n') {
          break;
        }
      }
    }

    if (newEvents.length > 0) {
      console.log(`\n📊 共添加了 ${newEvents.length} 个新活动`);
    }

    return newEvents;
  }

  /**
   * 简单的 Yes/No 询问
   * @param {string} question - 问题
   * @returns {Promise<boolean>}
   */
  async askYesNo(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question(question, resolve);
    });

    rl.close();

    return !answer.trim().toLowerCase().startsWith('n');
  }
}

module.exports = PublicationConfirmer;
