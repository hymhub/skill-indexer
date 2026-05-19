# skill-indexer

[English](./README.md) | **简体中文**

[![npm version](https://img.shields.io/npm/v/skill-indexer.svg)](https://www.npmjs.com/package/skill-indexer)
[![CI](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/skill-indexer.svg)](#)

> 零配置 CLI：扫描你 npm 依赖里的 `SKILL.md` 目录，**按 SKILL.md 规范严格校验**，再一键安装到 Cursor / Codex / Claude / Copilot / Amp / OpenCode / Goose 各自的 skills 目录。

库作者把 Agent Skill 放进自己的 npm 包发布出去；消费者只需 **一条命令**，就能把 `node_modules` 里所有合规的 skill 同步到 AI 助手识别的目录中。严格的 frontmatter 校验意味着：那些"碰巧也叫 `skills/`、但并不是真正 skill"的目录绝不会污染你的项目。

---

## 为什么再造一个轮子？

| 能力 | `skill-indexer` | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `add-skill` / 其它 |
|---|---|---|---|
| 约定式扫描（依赖方无需改 `package.json`） | 支持 | 不支持 | 部分 |
| 声明式 `agents.skills` 字段 | 支持（兼容） | 支持 | 部分 |
| 严格的 `SKILL.md` frontmatter 校验 | 支持 | 部分 | 不支持 |
| `include` / `exclude` glob 双过滤 | 支持 | 不支持 | 不支持 |
| 同名冲突策略（`error` / `first-wins` / `last-wins`） | 支持 | 无 | 无 |
| 基于 manifest 的安全 `clean` | 支持 | 不支持 | 不支持 |
| 一条命令同步到多个工具 | 支持 | 支持 | 部分 |

如果你曾遇到过某个依赖里恰好有 `skills/` 目录或一个并非给 agent 用的 `SKILL.md`，`skill-indexer` 会静默跳过，不让它污染你的 `.cursor/skills/`。

---

## 快速开始

### 作为消费者

```bash
# 1. 安装一次（项目本地或全局都可）
npm i -D skill-indexer

# 2. 把依赖中所有合法 skill 同步到 Cursor + Codex + Claude
npx skill-indexer install -t cursor,codex,claude
```

就这样。CLI 会：

1. 扫描 `node_modules`（npm / yarn / pnpm 各种布局都支持），找出所有候选 skill；
2. 校验每个候选目录的 `SKILL.md` frontmatter；
3. 把通过校验的 skill 复制到 `.cursor/skills/`、`.codex/skills/` 和 `.claude/skills/`；
4. 写一份 `.skill-indexer.manifest.json`，之后 `skill-indexer clean` 可以精确删除这些文件。

加进 `postinstall` 让 skills 始终保持同步：

```json
{
  "scripts": {
    "postinstall": "skill-indexer install -t cursor,codex,claude"
  }
}
```

### 作为库作者

在你的 npm 包里放一个 `SKILL.md`。最简单的"约定式"布局**不需要**改 `package.json`：

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-awesome-lib/
        ├── SKILL.md
        └── reference.md
```

```markdown
---
name: my-awesome-lib
description: 用 my-awesome-lib API 做某件事。当用户提到 X、或者询问怎么 Y 时触发使用。
---

# my-awesome-lib

第 1 步：……
```

更喜欢声明式（兼容 `npm-agentskills`）？加一个 `agents` 字段即可：

```json
{
  "name": "my-awesome-lib",
  "agents": {
    "skills": [
      { "name": "my-awesome-lib", "path": "./skills/my-awesome-lib" }
    ]
  }
}
```

两种形式都会被自动识别。

---

## 支持的目标工具

所有路径都是**项目本地**——`skill-indexer` 绝不会写入全局配置。

| Flag | 工具 | 目录 |
|------|------|-----------|
| `cursor` | [Cursor](https://cursor.com/docs/skills) | `.cursor/skills/` |
| `codex` | [OpenAI Codex](https://developers.openai.com/codex/skills) | `.codex/skills/` |
| `claude` | [Claude Code](https://code.claude.com/docs/en/skills) | `.claude/skills/` |
| `copilot` | [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | `.github/skills/` |
| `amp` | [Amp](https://ampcode.com/news/agent-skills) | `.agents/skills/` |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills) | `.opencode/skill/` |
| `goose` | [Goose](https://block.github.io/goose/docs/guides/context-engineering/using-skills) | `.goose/skills/` |
| `all` | 上述全部 | — |

---

## CLI 参考

```bash
skill-indexer install [options]
skill-indexer list    [options]
skill-indexer validate [path] [options]
skill-indexer clean   [options]
```

### 通用参数

| 参数 | 说明 |
|------|-------------|
| `-t, --target <list>` | 逗号分隔的目标工具，例如 `cursor,codex,claude`，或写 `all`。 |
| `--cwd <dir>` | 项目根目录（默认 `process.cwd()`）。 |
| `--config <path>` | 显式指定配置文件路径。 |
| `--include <patterns>` | 逗号分隔的 glob（按 npm 包名匹配）。 |
| `--exclude <patterns>` | 逗号分隔的 glob（按 npm 包名匹配）。 |
| `--overwrite <mode>` | `skip`（默认）/ `overwrite` / `merge`。 |
| `--on-conflict <mode>` | `error` / `first-wins`（默认）/ `last-wins`。 |
| `--strict` | 把所有校验警告升级为错误。 |
| `--dry-run` | 只打印将执行的操作，不写盘。 |
| `--no-convention` | 关闭约定式扫描。 |
| `--no-declarative` | 关闭声明式扫描。 |
| `--json` | 输出机器可读的 JSON（进度信息走 stderr）。 |

### 示例

```bash
# 把所有发现的 skill 安装到所有支持的目标
skill-indexer install -t all

# CI 严格校验：任何候选不合规就失败
skill-indexer install -t cursor --strict --dry-run

# 只允许自家组织的包，并屏蔽某个遗留包
skill-indexer install -t cursor \
  --include "@my-org/*" \
  --exclude "legacy-*"

# 用 JSON 输出列表（适合给工具消费）
skill-indexer list --json

# 提交前先校验项目内自己的 skill
skill-indexer validate --strict

# 把之前为 Claude 安装的所有 skill 移除
skill-indexer clean -t claude
```

---

## 配置

可以放在 `package.json` 的 `skillIndexer` 字段，或独立的 `skill-indexer.config.json`：

```json
{
  "skillIndexer": {
    "targets": ["cursor", "codex", "claude"],
    "include": ["@my-org/*", "awesome-skills"],
    "exclude": ["legacy-pkg", "**/internal-only/*"],
    "scan": { "convention": true, "declarative": true },
    "overwrite": "skip",
    "strict": false,
    "onConflict": "first-wins"
  }
}
```

优先级（低 → 高）：默认值 → `package.json#skillIndexer` → 配置文件 → CLI 参数。

---

## `SKILL.md` 校验规则

只有 `SKILL.md` 满足以下条件的目录才会被识别为合法 skill：

- 文件以 YAML frontmatter 开头（`--- ... ---`）；
- `name`：必填，`^[a-z0-9][a-z0-9-]{0,63}$`，长度 ≤ 64；
- `description`：必填、非空、长度 ≤ 1024。

下列情况只会发出 warning（在 `--strict` 下升级为 error）：

- 目录名与 `name` 不一致；
- `SKILL.md` 超过 500 行（软上限；过长的 skill 会浪费上下文）。

任何不满足必填规则的目录，在 `install` 时会被静默跳过；运行 `list` 可以看到具体被跳过的原因。

---

## 同名冲突处理

当两个依赖各自暴露了同 `name` 的 skill 时：

- **`error`**：直接以非零退出码报错，列出冲突的来源；
- **`first-wins`**（默认）：保留先发现的，warning 列出被丢弃的；
- **`last-wins`**：保留最后匹配到的；适合显式遮蔽上游 skill 的场景；
- 项目本地（`./skills/<name>`）的 skill **总是优先**，与策略无关。

---

## Manifest

每次 `install` 成功后，`skill-indexer` 会写一份 `./.skill-indexer.manifest.json`：

```json
{
  "version": 1,
  "updatedAt": "2026-05-19T07:00:00.000Z",
  "entries": [
    {
      "name": "my-awesome-lib",
      "source": { "packageName": "my-awesome-lib", "packageVersion": "1.2.3", "kind": "convention" },
      "targets": [
        { "target": "cursor", "dest": "/abs/path/to/.cursor/skills/my-awesome-lib" },
        { "target": "codex", "dest": "/abs/path/to/.codex/skills/my-awesome-lib" }
      ],
      "installedAt": "2026-05-19T07:00:00.000Z"
    }
  ]
}
```

`clean` 只会删除这份 manifest 里记录的路径，所以**永远不会**误删你手写的 skill。

---

## 编程 API

```ts
import {
  loadConfig,
  scanAll,
  resolveSkills,
  installSkills,
  cleanInstalled,
  validateSkill,
} from 'skill-indexer';

const { config } = await loadConfig({ cwd: process.cwd(), overrides: { targets: ['cursor'] } });
const candidates = await scanAll({ cwd: config.cwd, scan: config.scan });
const report = await resolveSkills(candidates, config);
const result = await installSkills(report.skills, { config });
console.log(result.entries);
```

上面用到的所有类型（`Skill`、`ValidatedSkill`、`Target`、`SkillSyncConfig`、`Manifest`……）都从包根处导出。

---

## 发现策略一览

```
node_modules/<pkg>/skills/<name>/SKILL.md            <- 约定式扫描
node_modules/@scope/<pkg>/skills/<name>/SKILL.md     <- 约定式（scoped 包）
node_modules/.pnpm/<id>/node_modules/<pkg>/skills/.. <- 约定式（pnpm 扁平存储）
node_modules/<pkg>/package.json#agents.skills        <- 声明式
node_modules/<pkg>/package.json#agents.skillsDir     <- 声明式（整个目录）
<cwd>/skills/<name>/SKILL.md                         <- 本地（永远优先）
```

符号链接会被解引用并按真实路径去重，pnpm 的 hardlink 与顶层 symlink 不会被扫描两遍。

---

## 文档

- [作者指南（库作者）](./docs/authoring.md)
- [消费者指南](./docs/consuming.md)
- [编程 API 参考](./docs/api.md)
- [与同类工具的对比](./docs/comparison.md)

---

## 参与贡献

欢迎 PR！见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。开发工作流：

```bash
npm install
npm run build
npm run test
npm run lint
```

任何用户可见的改动都请加一个 [changeset](https://github.com/changesets/changesets)：

```bash
npx changeset
```

---

## License

[MIT](./LICENSE)
