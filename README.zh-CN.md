# skill-indexer

[English](./README.md) | **简体中文**

[![npm version](https://img.shields.io/npm/v/skill-indexer.svg)](https://www.npmjs.com/package/skill-indexer)
[![CI](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/hymhub/skill-indexer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/skill-indexer.svg)](#)

> 零配置 CLI：扫描你 npm 依赖里的 `SKILL.md` 目录，**按 SKILL.md 规范严格校验**，再一键安装到 Cursor / Codex / Claude / Copilot / Amp / OpenCode / Goose 各自的 skills 目录。

库作者把 Agent Skill 放进自己的 npm 包发布出去；消费者只需 **一条命令**，就能把 `node_modules` 里所有合规的 skill 同步到 AI 助手识别的项目本地目录中。严格的 frontmatter 校验意味着：那些"碰巧也叫 `skills/`、但并不是真正 skill"的目录绝不会污染你的项目。

这个项目的设计目标是跨工具，而不是服务某一个 IDE 生态：npm 继续负责版本锁定、lockfile、provenance 和 audit；`agents.skills` 作为 npm 包内的声明协议，告诉各个工具哪些目录才是真正的 skill。SKILL.md 格式本身可以参考 [`agentskills.io`](https://agentskills.io) 的介绍；`skill-indexer` 只负责把 npm 包发布的 skill 同步到各工具的项目本地目录。

---

## 为什么再造一个轮子？

| 能力                                                               | `skill-indexer` | [`npm-agentskills`](https://github.com/onmax/npm-agentskills) | `add-skill` / 其它 |
| ------------------------------------------------------------------ | --------------- | ------------------------------------------------------------- | ------------------ |
| 声明式 `agents.skills` 字段                                        | 支持（推荐）    | 支持                                                          | 部分               |
| 约定式 fallback（依赖方无需改 `package.json`）                     | 支持            | 不支持                                                        | 部分               |
| 严格的 `SKILL.md` frontmatter 校验                                 | 支持            | 部分                                                          | 不支持             |
| experimental skill 通道                                            | 支持            | 不支持                                                        | 不支持             |
| `include` / `exclude` glob 双过滤                                  | 支持            | 不支持                                                        | 不支持             |
| 同名冲突策略（`error` / `first-wins` / `last-wins` / `keep-both`） | 支持            | 无                                                            | 无                 |
| 基于 manifest 的安全 `clean` + 来源审计                            | 支持            | 不支持                                                        | 不支持             |
| 一条命令同步到多个工具                                             | 支持            | 支持                                                          | 部分               |

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

在你的 npm 包里发布一个或多个 `SKILL.md` 目录。推荐做法是声明式：在 `package.json#agents.skills` 里列出每个 skill，让消费者不必猜哪些目录是给 agent 用的。

```
my-awesome-lib/
├── package.json
├── src/
└── skills/
    └── my-skill/
        ├── SKILL.md          # Required: metadata + instructions
        ├── scripts/          # Optional: executable code
        ├── references/       # Optional: documentation
        ├── assets/           # Optional: templates, resources
        └── ...               # Any additional files or directories
```

```markdown
---
name: my-skill
description: 用 my-awesome-lib API 做某件事。当用户提到 X、或者询问怎么 Y 时触发使用。
---

# my-skill

第 1 步：……
```

添加 `agents` 字段：

```json
{
  "name": "my-awesome-lib",
  "agents": {
    "skills": [
      { "name": "my-skill", "path": "./skills/my-skill" },
      { "name": "my-skill-deep-dive", "path": "./skills/my-skill-deep-dive" }
    ]
  }
}
```

如果包声明了 `agents.skills`，这些条目就是权威清单；如果没有声明，`skill-indexer` 才会 fallback 到 `skills/<name>/SKILL.md` 约定布局。

---

## 支持的目标工具

所有路径都是**项目本地**——`skill-indexer` 绝不会写入全局配置。

| Flag       | 工具                                                                                    | 目录               |
| ---------- | --------------------------------------------------------------------------------------- | ------------------ |
| `cursor`   | [Cursor](https://cursor.com/docs/skills)                                                | `.cursor/skills/`  |
| `codex`    | [OpenAI Codex](https://developers.openai.com/codex/skills)                              | `.codex/skills/`   |
| `claude`   | [Claude Code](https://code.claude.com/docs/en/skills)                                   | `.claude/skills/`  |
| `copilot`  | [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) | `.github/skills/`  |
| `amp`      | [Amp](https://ampcode.com/news/agent-skills)                                            | `.agents/skills/`  |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills)                                             | `.opencode/skill/` |
| `goose`    | [Goose](https://block.github.io/goose/docs/guides/context-engineering/using-skills)     | `.goose/skills/`   |
| `all`      | 上述全部                                                                                | —                  |

---

## CLI 参考

```bash
skill-indexer install [options]          # 安装依赖中的合法 skills
skill-indexer list    [options]          # 查看发现、跳过、过滤的 skills
skill-indexer validate [path] [options]  # 校验一个 skill 目录，或本地 ./skills
skill-indexer clean   [options]          # 删除 manifest 记录的 skills
```

### 通用参数

| 参数                   | 默认值           | 可选值                                                                    | 作用                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `-t, --target <list>`  | 配置值 / 无      | `cursor`, `codex`, `claude`, `copilot`, `amp`, `opencode`, `goose`, `all` | 选择要安装到哪些工具目录；多个目标用逗号分隔。              |
| `--cwd <dir>`          | `process.cwd()`  | 文件系统路径                                                              | 设置项目根目录。                                            |
| `--config <path>`      | 自动查找         | JSON 配置文件路径                                                         | 读取指定配置文件。                                          |
| `--include <patterns>` | 无               | 逗号分隔 glob                                                             | 只允许匹配的 npm 包。                                       |
| `--exclude <patterns>` | 无               | 逗号分隔 glob                                                             | 跳过匹配的 npm 包。                                         |
| `--overwrite <mode>`   | `skip`           | `skip`, `overwrite`, `merge`                                              | 目标已存在时：跳过、替换、或合并复制。                      |
| `--on-conflict <mode>` | `first-wins`     | `first-wins`, `last-wins`, `error`, `keep-both`                           | 同名冲突时：保留第一个、最后一个、报错、或改名后全部保留。  |
| `--scan <mode>`        | `declared-first` | `declared-first`, `both`, `convention`, `declarative`                     | 从声明优先发现、两种都扫、只扫 `skills/`、或只读 `agents`。 |
| `--strict`             | `false`          | boolean flag                                                              | 把校验 warning 当成错误。                                   |
| `--dry-run`            | `false`          | boolean flag                                                              | 只展示操作，不写文件。                                      |
| `--experimental`       | `false`          | boolean flag                                                              | 包含 experimental skills。                                  |
| `--no-convention`      | `false`          | boolean flag                                                              | 关闭 `skills/<name>/SKILL.md` fallback。                    |
| `--no-declarative`     | `false`          | boolean flag                                                              | 关闭 `package.json#agents` 发现。                           |
| `--json`               | `false`          | boolean flag                                                              | 输出 JSON。                                                 |

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

# 同名冲突时保留全部 skill，并为后来的冲突生成确定性名称
skill-indexer install -t all --on-conflict keep-both

# 显式安装 experimental skills
skill-indexer install -t codex --experimental

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
    "scan": { "mode": "declared-first" },
    "overwrite": "skip",
    "strict": false,
    "onConflict": "first-wins",
    "experimental": false
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
- **`keep-both`**：保留所有冲突 skill，并为后来的冲突生成确定性名称；
- 项目本地（`./skills/<name>`）的 skill **总是优先**，与策略无关。

`keep-both` 下，第一个 skill 保留原始 frontmatter `name`。后续冲突会追加包名后缀，例如 `shared` 和 `shared--beta-pkg`。如果同一个包暴露多个同名 skill，会继续带上目录名，例如 `shared--multi-pkg-two`。只有安装到目标目录里的 `SKILL.md` frontmatter 会被重写，`node_modules` 里的原包不会被修改。

---

## Manifest

每次 `install` 成功后，`skill-indexer` 会写一份 `./.skill-indexer.manifest.json`：

```json
{
  "version": 2,
  "updatedAt": "2026-05-19T07:00:00.000Z",
  "entries": [
    {
      "name": "my-skill",
      "channel": "stable",
      "contentHash": "sha256-...",
      "source": {
        "packageName": "my-awesome-lib",
        "packageVersion": "1.2.3",
        "kind": "declarative",
        "path": "skills/my-skill"
      },
      "targets": [
        { "target": "cursor", "dest": "/abs/path/to/.cursor/skills/my-skill" },
        { "target": "codex", "dest": "/abs/path/to/.codex/skills/my-skill" }
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

上面用到的所有类型（`ValidatedSkill`、`Target`、`SkillSyncConfig`、`Manifest`……）都从包根处导出。

---

## 发现策略一览

```
node_modules/<pkg>/package.json#agents.skills              <- 声明式
node_modules/<pkg>/package.json#agents.experimentalSkills  <- opt-in experimental
node_modules/<pkg>/package.json#agents.skillsDir           <- 声明式（整个目录）
node_modules/<pkg>/skills/<name>/SKILL.md                  <- 约定式 fallback
node_modules/@scope/<pkg>/skills/<name>/SKILL.md           <- 约定式 fallback（scoped 包）
node_modules/.pnpm/<id>/node_modules/<pkg>/skills/..       <- 约定式 fallback（pnpm 扁平存储）
<cwd>/skills/<name>/SKILL.md                              <- 本地（永远优先）
```

默认扫描模式是 `declared-first`：如果包声明了 `agents.skills`、`agents.experimentalSkills` 或 `agents.skillsDir`，就只按声明扫描；没有声明的包才 fallback 到 `skills/<name>/SKILL.md`。如果你确实想同时启用两种来源，可以传 `--scan both`。

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
