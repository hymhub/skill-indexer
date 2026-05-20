---
name: example-skill-library
description: Demonstrates how to ship an Agent Skill from an npm package via skill-indexer. Use when learning how to author a skill or as a template for new skills.
---

# example-skill-library

This is a minimal Agent Skill shipped from inside an npm package. When a consumer
runs `skill-indexer install`, this directory is copied verbatim into their project's
`.cursor/skills/`, `.codex/skills/`, etc.

## Quick start

```ts
import { hello } from 'example-skill-library';
hello('world');
```

## Resources

- See [`references/api.md`](./references/api.md) for the full API reference.
