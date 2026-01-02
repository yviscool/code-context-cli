# ctx (code-context-cli)

> 🚀 **Weave your codebase into AI-ready context.**

将代码库转换为 AI 友好的上下文文件的命令行工具。

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 🔍 **智能扫描** | 自动应用 `.gitignore`，glob 模式匹配 |
| 🎨 **交互式 TUI** | 可视化文件树，多选/搜索过滤 |
| 📊 **精确 Token** | 基于 GPT tokenizer 精确计算 |
| 💰 **预算控制** | 自动适应 token 限制 |
| 📦 **智能分块** | 超大项目自动拆分 |
| 🧬 **符号解析** | 函数/类/接口级别分析 |
| ✂️ **签名模式** | 仅导出 API 签名，省略实现 |

## 快速开始

```bash
# 扫描目录
ctx ./src

# 限制 token 预算
ctx ./src --budget 32k

# 查看符号统计
ctx ./src --symbols

# 仅导出签名
ctx ./src --signatures-only

# 交互模式
ctx --interactive
```

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--interactive` | 交互式 TUI |
| `-e, --ext <ext>` | 文件扩展名 |
| `-b, --budget <tok>` | Token 预算 |
| `--chunk <tok>` | 分块大小 |
| `-s, --symbols` | 显示符号统计 |
| `--signatures-only` | 仅导出签名 |
| `--no-test` | 排除测试文件 |
| `-c, --copy` | 复制到剪贴板 |
| `-o, --output <file>` | 输出文件 |

## 编程接口

```typescript
import { scan, format, parseSymbols, fitToBudget } from 'code-context-cli';

const results = await scan({ cwd: './src', patterns: ['**/*.ts'] });
const symbols = await parseSymbols(results[0].content, 'typescript');
const { included } = fitToBudget(results, { maxTokens: 32000 });
const output = format(included, { format: 'markdown', signaturesOnly: true });
```

## License

MIT
