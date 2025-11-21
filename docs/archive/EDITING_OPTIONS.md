# 编辑方式选择指南

当你在 `npm run generate-post` 时选择"编辑内容后发布"，系统会提供5种编辑方式。

## 快速选择指南

### 推荐方式：方式1（保存到文件）

**适合所有人，特别是：**
- 习惯用 VSCode、Sublime 等图形界面编辑器
- 不熟悉终端编辑器
- 需要反复修改

**优点：**
- ✅ 最简单
- ✅ 使用你熟悉的编辑器
- ✅ 可以慢慢编辑，不用着急
- ✅ 支持所有编辑器

**流程：**
```
1. 系统保存文件到 /code/output/temp_post_xxx.txt
2. 显示文件路径
3. 你用任何编辑器打开并修改
4. 保存文件
5. 回到终端按回车
```

---

## 各方式详解

### 方式1：保存到文件，我手动编辑 ⭐ 推荐

```
📝 请选择编辑方式: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 文件已保存，请用你喜欢的编辑器打开并修改:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /code/output/temp_post_1699999999999.txt

💡 推荐编辑器:
   • VSCode:    code "/code/output/temp_post_1699999999999.txt"
   • Sublime:   subl "/code/output/temp_post_1699999999999.txt"
   • TextEdit:  open -a TextEdit "/code/output/temp_post_1699999999999.txt"
   • 记事本:     notepad "/code/output/temp_post_1699999999999.txt"

编辑完成后，保存文件并回到这里
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

完成编辑后按回车键继续...
```

**如何使用：**

**Mac/Linux:**
```bash
# VSCode
code "/code/output/temp_post_1699999999999.txt"

# Sublime
subl "/code/output/temp_post_1699999999999.txt"

# TextEdit (Mac)
open -a TextEdit "/code/output/temp_post_1699999999999.txt"

# 任何编辑器
open "/code/output/temp_post_1699999999999.txt"
```

**Windows:**
```bash
# VSCode
code "C:\code\output\temp_post_1699999999999.txt"

# 记事本
notepad "C:\code\output\temp_post_1699999999999.txt"

# 任何默认编辑器
start "C:\code\output\temp_post_1699999999999.txt"
```

---

### 方式2：直接粘贴编辑后的内容

```
📝 请选择编辑方式: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 请粘贴编辑后的内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 提示:
   1. 复制编辑好的内容
   2. 粘贴到下方
   3. 单独一行输入 "EOF" 结束
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

湾区本周活动 11.9-11.15

🎪 活动1: French Holiday Market
📅 时间: Saturday, November 15
📍 地点: Saratoga
💰 价格: Free

... [你的内容]

EOF
```

**适合：**
- 已经在其他地方编辑好了内容
- 不想来回切换窗口

**注意：**
- 粘贴后，单独一行输入 `EOF` 表示结束
- 如果内容中有 "EOF"，请用其他方式

---

### 方式3：使用系统默认编辑器

```
📝 请选择编辑方式: 3
```

**前提条件：**
需要设置环境变量 `$EDITOR` 或 `$VISUAL`

**如何设置：**

**Mac/Linux (临时):**
```bash
export EDITOR=code    # VSCode
export EDITOR=subl    # Sublime
export EDITOR=nano    # nano
```

**Mac/Linux (永久):**
```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'export EDITOR=code' >> ~/.bashrc
```

**Windows (临时):**
```bash
set EDITOR=code
```

**适合：**
- 已经配置好编辑器环境变量的用户
- 开发者

---

### 方式4：使用 nano（简单）

```
📝 请选择编辑方式: 4

📝 使用编辑器: nano
💡 nano 使用提示:
   - 编辑内容
   - Ctrl+X 退出
   - 提示保存时按 Y
   - 按回车确认文件名

按回车键打开编辑器...
```

**nano 快捷键：**
- `Ctrl+X` - 退出
- `Ctrl+O` - 保存（不退出）
- `Ctrl+K` - 剪切当前行
- `Ctrl+U` - 粘贴
- `Ctrl+W` - 搜索
- `Ctrl+G` - 帮助

**适合：**
- 需要在终端直接编辑
- 不熟悉 vim
- 简单修改

**优点：**
- 简单易用
- 有快捷键提示
- 不需要记忆命令

---

### 方式5：使用 vim（高级）

```
📝 请选择编辑方式: 5

📝 使用编辑器: vim
💡 vim 使用提示:
   - 按 i 进入编辑模式
   - 编辑内容
   - 按 ESC 退出编辑模式
   - 输入 :wq 保存并退出

按回车键打开编辑器...
```

**vim 基本命令：**
- `i` - 进入插入模式（开始编辑）
- `ESC` - 退出插入模式（回到命令模式）
- `:wq` - 保存并退出
- `:q!` - 不保存退出
- `dd` - 删除当前行
- `yy` - 复制当前行
- `p` - 粘贴

**适合：**
- vim 用户
- 高级用户

---

## 常见问题

### Q: 我应该选择哪个？

**A:** 如果你不确定，选择 **方式1**。这是最简单、最灵活的方式。

### Q: 方式1中，我用什么编辑器？

**A:** 任何你喜欢的！VSCode、Sublime、记事本、TextEdit 都可以。

### Q: 编辑器打不开怎么办？

**A:**
1. 复制文件路径
2. 手动打开你的编辑器
3. 在编辑器中打开这个文件
4. 编辑并保存
5. 回到终端按回车

### Q: 我选错了怎么办？

**A:** 选择 `[0]` 取消编辑，系统会返回上一级菜单。

### Q: nano 和 vim 有什么区别？

**A:**
- **nano**：简单，有提示，适合新手
- **vim**：强大，需要学习，适合高级用户

### Q: 我可以用 VSCode 吗？

**A:** 可以！选择方式1，然后用 `code "文件路径"` 命令打开。

### Q: Windows 用户应该选什么？

**A:** 推荐方式1，用记事本或 VSCode：
```bash
notepad "C:\code\output\temp_post_xxx.txt"
# 或
code "C:\code\output\temp_post_xxx.txt"
```

---

## 实际示例

### 示例1：使用 VSCode（方式1）

```bash
# 运行生成命令
npm run generate-post

# 选择编辑
请选择下一步操作: 2

# 选择方式1
请选择编辑方式: 1

# 复制显示的文件路径
# /code/output/temp_post_1699999999999.txt

# 在新终端或直接运行
code /code/output/temp_post_1699999999999.txt

# 在 VSCode 中编辑
# 保存文件 (Ctrl+S 或 Cmd+S)

# 回到原终端按回车
完成编辑后按回车键继续... [回车]
```

### 示例2：直接粘贴（方式2）

```bash
# 运行生成命令
npm run generate-post

# 选择编辑
请选择下一步操作: 2

# 选择方式2
请选择编辑方式: 2

# 粘贴你已经准备好的内容
[粘贴内容]

# 单独一行输入 EOF
EOF
```

### 示例3：使用 nano（方式4）

```bash
# 运行生成命令
npm run generate-post

# 选择编辑
请选择下一步操作: 2

# 选择方式4
请选择编辑方式: 4

# 按回车打开 nano
按回车键打开编辑器... [回车]

# 在 nano 中编辑
[编辑内容]

# Ctrl+X 退出
# 提示保存时按 Y
# 按回车确认文件名
```

---

## 推荐配置

### 为 VSCode 设置别名（Mac/Linux）

添加到 `~/.bashrc` 或 `~/.zshrc`:

```bash
# VSCode 别名
alias edit="code"

# 或设置为默认编辑器
export EDITOR="code --wait"
```

这样你可以：
```bash
edit /path/to/file
```

### 为 VSCode 设置环境变量（永久使用方式3）

```bash
# Mac/Linux
echo 'export EDITOR="code --wait"' >> ~/.bashrc
source ~/.bashrc

# 现在选择方式3会自动用 VSCode
```

---

## 总结

| 方式 | 适合人群 | 难度 | 灵活性 |
|-----|---------|------|-------|
| 方式1 | 所有人 | ⭐ 最简单 | ⭐⭐⭐ 最高 |
| 方式2 | 已准备好内容 | ⭐⭐ 简单 | ⭐⭐ 中等 |
| 方式3 | 开发者 | ⭐⭐ 简单 | ⭐⭐⭐ 高 |
| 方式4 | 终端用户 | ⭐⭐ 中等 | ⭐⭐ 中等 |
| 方式5 | vim 用户 | ⭐⭐⭐⭐ 难 | ⭐⭐⭐ 高 |

**建议：新手选择方式1，熟练用户选择方式3。**
