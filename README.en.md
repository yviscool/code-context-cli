# ctx (code-context-cli)

> 🚀 **Weave your codebase into AI-ready context.**

A CLI tool that transforms source code into optimized LLM input.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Smart Scanning** | Auto-applies `.gitignore`, glob pattern matching |
| 🎨 **Interactive TUI** | Vim-style keybindings, visual file tree |
| 📊 **Precise Tokens** | GPT tokenizer-based accurate counting |
| 💰 **Budget Control** | Auto-fit within token limits |
| 📦 **Smart Chunking** | Auto-split large projects |
| 🧬 **Symbol Parsing** | Function/class/interface analysis |
| ✂️ **Signatures Mode** | Export API signatures only |
| 📈 **Statistics** | Language distribution, token stats |
| 🗜️ **Compact Mode** | Remove comments and blank lines |

## Quick Start

```bash
# Scan directory
ctx ./src

# With token budget
ctx ./src --budget 32k

# Interactive mode (Vim-style keys)
ctx --interactive

# Show detailed statistics
ctx ./src --stats

# Compact output (remove comments)
ctx ./src --compact

# Export signatures only
ctx ./src --signatures-only
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--interactive` | Interactive TUI (Vim keybindings) |
| `-e, --ext <ext>` | File extensions |
| `-b, --budget <tok>` | Token budget |
| `--chunk <tok>` | Chunk size |
| `-s, --symbols` | Show symbol statistics |
| `--signatures-only` | Export signatures only |
| `--stats` | Show detailed stats (languages/tokens) |
| `--compact` | Compact output (remove comments) |
| `--no-test` | Exclude test files |
| `-c, --copy` | Copy to clipboard |
| `-o, --output <file>` | Output file |

## Interactive TUI Keybindings (Vim-style)

| Key | Action |
|-----|--------|
| `j/k` | Move up/down |
| `gg/G` | Jump to top/bottom |
| `Ctrl+d/u` | Half-page scroll |
| `h/l` | Collapse/Expand directory |
| `x` / `Space` | Toggle selection |
| `a` | Select all |
| `u` | Deselect all |
| `i` | Invert selection |
| `e` / `zR` | Expand all |
| `E` / `zM` | Collapse all |
| `*` | Select current directory |
| `t` | Toggle test files |
| `/` | Search |
| `c` / `ZZ` | Confirm and save |
| `q` | Quit |

## Programmatic API

```typescript
import { scan, format, parseSymbols, fitToBudget } from 'code-context-cli';

const results = await scan({ cwd: './src', patterns: ['**/*.ts'] });
const symbols = await parseSymbols(results[0].content, 'typescript');
const { included } = fitToBudget(results, { maxTokens: 32000 });
const output = format(included, { format: 'markdown', compact: true });
```

## License

MIT
