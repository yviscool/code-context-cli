这是一个非常具有前瞻性的工具构想。你实际上是在构建一个**“代码库 -> LLM 上下文”的 ETL（提取、转换、加载）管道**。

为了回答你的两个哲学问题并设计这个工具，我们需要超越简单的“文件拼接”，而是从**信息熵**和**交互体验**的角度来思考。

我们将这个工具暂定名为 **`ctx`** (Context 的缩写) 或 **`repo-digest`**。

---

### 第一部分：哲学思考 —— 什么是最适合 AI 阅读的源代码？

AI 不是人类，它阅读代码的方式受限于“上下文窗口（Context Window）”和“注意力机制（Attention Mechanism）”。简单的拼接会导致“大海捞针（Needle in a Haystack）”效应，即关键逻辑被大量样板代码淹没。

**最适合 AI 阅读的文件内容应具备以下 4 个特征：**

1. **高信噪比 (High Signal-to-Noise Ratio):**

* **去除干扰：** 自动剔除 `package-lock.json`、`dist`、`node_modules`、图片资源等高 token 消耗但低逻辑价值的内容。
* **压缩格式：** 移除多余的空行，甚至提供选项移除详细的 License 头部或无用的 `console.log`，只保留核心逻辑。

1. **显式拓扑结构 (Explicit Topology):**

* AI 缺乏对文件系统的“直觉”。它需要明确的元数据。
* **最佳格式：** 不仅仅是 Markdown 代码块，而是包含**文件路径**、**语言类型**甚至**依赖关系**的结构化数据。
* **XML Wrapping:** 相比 Markdown 的 `###` 标题，现代模型（如 Claude 3.5 Sonnet, GPT-4o）对 XML 标签（如 `<file path="src/main.rs">...</file>`）的解析能力更强，能防止 prompt 注入混淆。

1. **AST 级的粒度 (AST-Level Granularity):**

* **核心 vs 细节：** 有时 AI 只需要看接口定义（Interface/Types）而不需要看实现。工具应支持“仅导出签名”模式（类似 `.d.ts` 或 Rust 的 trait 定义）。
* **范围选择：** 所谓的“范围选择”不应只是行号，而应该是逻辑块（Function, Class）。

1. **上下文锚点 (Context Anchors):**

* 如果代码引用了另一个模块，AI 需要知道那个模块在哪里。
* **Tree Summary:** 在内容的开头，提供一个精简的 ASCII 目录树，让 AI 建立全局地图。

---

### 第二部分：哲学思考 —— 什么样的用户操作方式？

命令行工具的交互设计核心在于**“从发散到收敛”**的过程。用户面对的是海量代码，需要快速筛选出与当前 Prompt 相关的“最小可行上下文”。

**最理想的操作流（Workflow）：**

1. **可视化全景 (Visualize):**

* 类似于 `tre` 或 `tree` 命令，首先展示项目的目录结构。
* **关键点：** 必须默认集成 `.gitignore`，否则视图会被垃圾文件污染。

1. **交互式过滤 (Interactive Filtering):**

* 不要让用户手动输入路径。使用 TUI（文本用户界面）让用户通过键盘（上下键、空格）勾选文件或文件夹。
* 支持**模式匹配**：输入 `auth` 自动高亮所有包含 auth 的文件。

1. **渐进式精度 (Progressive Granularity):**

* **Level 1 (File):** 选中文件。
* **Level 2 (Scope):** 进入文件内部（按右键或 Enter），解析 AST，列出函数/类名，允许用户只选中某个函数。（这是一个高级功能，但非常符合“范围选择”的需求）。

1. **预设与记忆 (Presets & Memory):**

* 开发往往是重复的。用户会多次询问关于“登录模块”的问题。
* 工具应支持保存“上下文集（Context Set）”，例如 `ctx load auth-logic`。

---

### 第三部分：命令行工具设计方案

#### 1. 工具名称与定位

* **名称:** **`ctx`** (CLI command) / Project Name: **`code-context-cli`**
* **Slogan:** "Weave your codebase into AI-ready context."
* **技术栈:**
* Runtime: Node.js (TypeScript)
* UI Framework: **Ink** (React for CLI) - 实现复杂交互最强。
* AST Parsing: `tree-sitter` (跨语言支持最强，支持 Rust, Go, TS 等) 或 `synctax`。

#### 2. 核心功能架构

| 模块 | 功能描述 | 关键库/技术 |
| --- | --- | --- |
| **Scanner** | 扫描目录，应用 `.gitignore`，识别语言类型 | `globby`, `ignore` |
| **TUI Engine** | 交互式文件树选择，支持折叠/展开/多选 | `ink`, `ink-select-input` |
| **Parser** | (高级) 解析文件 AST，提取 Function/Class 列表以供细粒度选择 | `tree-sitter` bindings |
| **Formatter** | 将选中内容包装成 Markdown/XML，添加 Token 估算 | `gpt-tokenizer` (计算 token 数) |
| **Output** | 输出到 stdout (管道操作) 或 剪贴板 | `clipboardy` |

#### 3. 交互设计细节 (User Journey)

**Step 1: 启动与总览**

```bash
ctx

```

* 屏幕显示当前目录的树状结构（忽略 node_modules 等）。
* 底部显示操作提示：`[Space] Toggle` `[Enter] Expand` `[Right] Peek Content` `[C] Copy to Clipboard`

**Step 2: 智能筛选 (Smart Selection)**

* 用户输入 `/user`，列表自动过滤只显示路径含 user 的文件。
* 用户移动光标到 `src/services/UserService.ts`，按空格选中。

**Step 3: 范围选择 (AST Drill-down)**

* 用户在 `UserService.ts` 上按 `Shift + Right`。
* UI 变为显示该文件内的符号列表：
* `[ ] class UserService`
* `[x] method login`  <-- 用户只选了这个
* `[ ] method logout`

**Step 4: 输出预览**

* 底部状态栏实时显示：`Selected: 3 files, 1 snippet | Estimated Tokens: 1,450 (GPT-4)`。
* 这一步至关重要，防止 Context 超出 LLM 上限。

**Step 5: 生成**

* 用户按 `Ctrl + S` 或 `Enter`。
* 生成 `context.md` 或直接复制到剪贴板。

#### 4. 输出文件格式 (The AI-Optimized Format)

这是生成的 Markdown 内容模板：

```markdown
# Project Context

## Structure
- src/
  - main.rs
  - utils.rs

## Constraints
- Language: Rust, TypeScript
- Total Tokens: 1200

---

<file path="src/main.rs" language="rust">
use std::io;

fn main() {
    println!("Hello World");
}
</file>

<file path="src/utils.ts" language="typescript">
// User selected lines 10-15
export function helper() {
  return true;
}
</file>

```

#### 5. 命令行参数 (CLI Arguments)

除了交互模式，也支持管道模式供脚本调用：

```bash
# 交互模式
ctx 

# 快速模式：包含 src 下所有 ts 文件，排除 test
ctx scan ./src -e "ts" --no-test --output clipboard

# 配置文件模式
ctx load ./ctx-presets/auth-module.json

```

---

### 第四部分：实现路线图 (MVP)

1. **V0.1 (Skeleton):** 使用 `glob` 读取文件，简单的命令行参数过滤，简单的 Markdown 拼接输出。
2. **V0.5 (Interactive TUI):** 引入 `ink` 库，实现交互式文件树（类似 `tre`），支持 `.gitignore`。
3. **V1.0 (Token Awareness):** 加入 Token 计数器，实时显示选中内容的大小。
4. **V1.5 (AST Powers):** 引入 `tree-sitter`，支持“仅选中文件中的特定函数”功能。

### 总结

你的工具不仅仅是一个合并器，它是一个**“上下文编译器”**。通过在架构层面回答“什么内容适合 AI”（结构化、高信噪比）和“如何交互”（可视化、渐进式筛选），你可以构建出一个开发者离不开的 Prompt Engineering 辅助工具。

**Would you like me to generate the project structure and the initial code for the 'Scanner' and 'TUI' parts using the `ink` library?**
