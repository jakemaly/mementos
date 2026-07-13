# Spec: Second-Brain UI/UX Overhaul

## Objective

Overhaul the existing `second-brain` dashboard UI/UX to transition from a multi-column, high-density dashboard into a modern, playful, dynamic 2-tab interface. The redesign is built on Google's Material Design 3 (MD3) specification, featuring enhanced visual depth, responsiveness, and premium micro-interactions (e.g. elastic scale effects, sliding tab background pill, radial expansion focus ring, and pulsing dropzones).

**Key differences from existing layout:**
- The current layout displays collections management, raw vector file ingestion, local semantic search, SIRA deep research, and LightRAG query/ingest panels concurrently on a single multi-column screen.
- The new layout divides functionality into two workspaces: **Tab 1: Chat & Search** (interactive workspace for querying and research) and **Tab 2: Ingest & Studio** (administrative workspace for loading data, organizing collections, and graph entity extraction).

---

## Tech Stack & Architecture Boundaries

- **Frontend:** Next.js 16.2.9 (App Router), TypeScript, Vanilla CSS Modules.
- **Backend/API:** Existing Next.js API proxy routes (`/api/query`, `/api/ingest`, `/api/collections`, `/api/research`, `/api/rag/query`, `/api/rag/ingest`) and FastAPI sidecar remain fully functional. No changes are to be made to backend databases or Python code.
- **Styling:** Vanilla CSS modules only (`globals.css` and `page.module.css`). No external UI frameworks (e.g., Tailwind CSS, Material-UI, Tailwind UI) or extra NPM icon packages unless explicitly requested. All icons (for tabs, status badges, buttons, drag-and-drop zones, etc.) are built using custom, lightweight inline SVGs to ensure high-fidelity styling, flexibility, and zero dependency overhead.

---

## 2-Tab Workspace Layout

To optimize performance and avoid resetting user input fields, sliders, search queries, and outputs, the application will use state retention (CSS-based toggle using a `.hidden` or `display: none` style class) rather than React conditional unmounting. This ensures that switching tabs does not clear any unsaved inputs or search results. The tab navigation is integrated directly in the center of the main header (between the logo and the database status indicator). The Collection Selector dropdown is placed globally in the top header on the right, next to the "Qdrant Active" database status badge, enabling seamless collection switching across all workspaces. On large displays, the layout container will be horizontally centered and constrained to a maximum width of `1600px` to prevent cards and inputs from stretching excessively and maintain premium visual balance.

### Tab 1: Interactive Workspace (Chat & Search)
This tab focuses on consuming, exploring, and synthesizing knowledge. It uses a **2-column layout grid**:
- **Left Column (Wider, e.g., 60% or `1.5fr`):** Houses the **LightRAG Chat & Query Panel**. This conversational interface displays multi-mode options (`naive`, `local`, `global`, `hybrid`) and renders response answers in high-depth styled containers.
- **Right Column (Narrower, e.g., 40% or `1fr`):** Houses the following panels stacked vertically:
  1. **Semantic Similarity Search Card:** Fast similarity lookups inside selected collections, displaying retrieved document snippets, similarity scores, metadata tags, and character offsets.
  2. **Deep Research (SIRA) Panel:** Deep web-crawling prompt, displaying generated concept sketches as dynamic interactive MD3 chips and matching search results with action tags.

### Tab 2: Knowledge Studio (Ingest & Setup)
This tab acts as the brain's data control center. It uses a **2-column layout grid**:
- **Left Column (Narrower, e.g., 40% or `1fr`):** Houses the following panels stacked vertically:
  1. **Collections Manager Card:** Displaying current collections with badge counts, and an interactive form/modal to create new collections.
  2. **Vector DB File Ingestion Card:** Drag-and-drop zone with embedding calculations, chunk size slider, and overlap controls.
- **Right Column (Wider, e.g., 60% or `1.5fr`):** Houses the **LightRAG Graph Ingest Card** (input text pasting and file upload dropzones dedicated to entity and relationship extraction).

---

## Design System & MD3 Tokens (CSS variables)

We define modern, vibrant MD3-inspired colors and shadows:

| CSS Variable | Value / Description | Role |
|---|---|---|
| `--md-sys-color-primary` | `#6750A4` (Deep Violet) | Highlight, brand color, primary buttons |
| `--md-sys-color-primary-hover` | `#533F8A` (Darkened Deep Violet) | Hover states for primary elements |
| `--md-sys-color-primary-container` | `#EADDFF` (Muted Lavender) | Highlights, active tab background, chips |
| `--md-sys-color-secondary` | `#038E8A` (Playful Teal) | Badges, tags, success states, secondary elements |
| `--md-sys-color-secondary-hover` | `#027370` (Darkened Playful Teal) | Hover states for secondary elements |
| `--md-sys-color-tertiary` | `#F9A825` (Sunny Amber) | Warning indicators, progress bars, highlights |
| `--md-sys-color-surface` | `#F8FAF8` (Soft Frost) | Background card fill |
| `--md-sys-color-surface-variant` | `#F1F3F1` | Secondary backgrounds, subtle card layers |
| `--md-sys-color-outline` | `#79747E` | Subtle borders, dividers |
| `--md-sys-color-shadow` | `rgba(103, 80, 164, 0.08)` | Colored shadows for visual depth |

### Elevation Levels (MD3 Shadows)
Instead of harsh grey/black borders, use colored shadows mapping to MD3 elevation values:
- **Elevation 0:** No shadow, flat border (`1px solid var(--md-sys-color-outline)`).
- **Elevation 1:** `0px 1px 3px 1px var(--md-sys-color-shadow), 0px 1px 2px 0px var(--md-sys-color-shadow)`
- **Elevation 2:** `0px 2px 6px 2px var(--md-sys-color-shadow), 0px 1px 2px 0px var(--md-sys-color-shadow)`
- **Elevation 3:** `0px 4px 8px 3px var(--md-sys-color-shadow), 0px 1px 3px 0px var(--md-sys-color-shadow)`

---

## Playful Motion & Micro-interactions

1. **Tab Navigation:** Sliding background pill indicator (`--md-sys-color-primary-container`) that smoothly slides horizontally behind the active tab button when selected.
2. **Elastic Buttons:** Scale transforms on action items:
   - Hover: `transform: translateY(-2px) scale(1.02);`
   - Active (Press): `transform: scale(0.96);`
3. **Radial Expansion Focus Ring:** Custom inputs/textareas transition their borders and grow a soft glow:
   - `:focus`: `border-color: var(--md-sys-color-primary); box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.25);`
4. **Pulsing Dropzones:** File upload areas animate a flowing dash offset and pulse when a file is dragged over.
5. **Loading Animation:** SVG circular load indicators rotate and pulse using custom timing curves for high-fidelity response.

---

## Out of Scope
- **Dark Mode Toggle:** Deferred to keep focus on light mode aesthetics.
- **Interactive Graph Visualizer:** Deferred to avoid complex Canvas/D3 library size.
- **Backend/API Refactoring:** Database collections and API logic are out of scope.

---

## Success Criteria
1. Tabs switch instantly with smooth opacity/transform transition.
2. Complete page elements are correctly classified into Tab 1 and Tab 2.
3. MD3 theme variables are defined in `globals.css` and applied across all panels.
4. Input validation and interactive state changes display clean warning/error badges.
5. Elastic interactions (hover/active scales) apply to all clickable buttons.
6. Local building (`npm run build`) compiles with no errors.
