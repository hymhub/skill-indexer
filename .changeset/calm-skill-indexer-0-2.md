---
'skill-indexer': minor
---

Add the 0.2.0 cross-tool skill package contract.

- Use `declared-first` scanning by default: `agents.skills`, `agents.experimentalSkills`, and `agents.skillsDir` are authoritative when present; packages without declarations still fall back to `skills/<name>/SKILL.md`.
- Add the `experimentalSkills` channel and `--experimental` opt-in install path.
- Add `--on-conflict keep-both`, which preserves duplicate skill names by installing later conflicts with deterministic package/folder-derived names and rewriting only the copied `SKILL.md` frontmatter.
- Upgrade manifests to v2 with channel, source path, original name, and content hash metadata while preserving v1 reads for clean.
