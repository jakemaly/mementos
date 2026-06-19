# Brain — Agent Bootstrap

> Loaded every session. Procedural schema and navigation.

## Brain layout

- `index.md` — navigation map of all knowledge
- `log.md` — chronological activity log (append-only)
- `raw/` — immutable source truth (never edit)
  - `raw/static/` — PDFs, repos, docs, video transcripts
  - `raw/dynamic/` — calendar, inbox (MCP-connected)
- `wiki/` — agent-owned, LLM-compiled
  - `wiki/entities/` — semantic memory (`.yaml` files)
  - `wiki/concepts/` — conceptual knowledge (`.md` files)
  - `wiki/procedures/` — procedural memory (`.md` files)
- `diary/` — episodic memory (one file per day, append-only)
- `tasks/` — active and archived tasks

## Memory types

### Episodic (`diary/`)
- Append timestamped chunks: `HH:MM — event description`
- End-of-day: summarize into 3–5 bullets, then archive raw chunks

### Semantic (`wiki/entities/`)
- Query the graph **before writing** to avoid duplicates
- Newest info overwrites old facts directly
- Attach deprecation notes when the change itself is meaningful

### Procedural (`wiki/procedures/`)
- Detect repeated success patterns from diary entries
- Write as agent-actionable markdown instructions
- Injected into context at session start via this file

## Write rules

1. Never edit files in `raw/`
2. Always check for existing entities before creating new ones in `wiki/entities/`
3. Diary entries are append-only — never rewrite past entries
4. All knowledge must be human-readable and git-trackable
