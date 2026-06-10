# second-brain

An interactive memory layer for your entire life.

## Notes System

A simple, flat-hierarchy file directory system for general life notes. See [[notes/index]] to get started.

### Structure

Five domain-based top-level folders under `notes/`:

- **school/** — Academic work, organized by course
- **recruiting/** — Internship and job recruiting (companies, applications, prep)
- **freelance/** — Client work, one folder per client
- **side-projects/** — Personal projects (active/ and ideas/)
- **hobbies/** — Reading, fitness, creative pursuits

### Conventions

- **Naming**: All files and directories use `kebab-case` (e.g., `lecture-notes.md`, `acme-corp/`)
- **Starter files**: Every directory contains an `index.md` serving as a table of contents
- **Frontmatter**: All `.md` files include YAML frontmatter with `title` and `tags` (required); `created`, `updated`, `status`, and `aliases` (optional)
- **Cross-referencing**: Use `[[wikilinks]]` for internal links (paths relative to `notes/`) and `#tags` in body text
- **Depth**: Maximum 2 levels below `notes/` (side-projects allow 3 for project isolation)
- **Tags**: Always lowercase, hyphen-separated (e.g., `#machine-learning`)

### Tooling

Tool-agnostic — works with any markdown editor, `grep`/`ripgrep` for search, and Git for version control. No proprietary formats or lock-in.
