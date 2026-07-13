# Rubric: Second-Brain UI/UX Overhaul

Verification checklist mapped 1:1 to implementation steps. Each step must pass before moving to the next.

## Step 1: Design System & CSS Variables Setup
- [ ] `app/app/globals.css` defines the MD3 design variables (`--md-sys-color-*` and `--md-elevation-*`).
- [ ] Core color tokens for primary (Deep Violet), primary container (Lavender), secondary (Playful Teal), and tertiary (Sunny Amber) are declared.
- [ ] Box shadow elevation variables (0 to 3) are set using transparent violet tint overlays (`--md-sys-color-shadow`).
- [ ] Next.js app builds successfully without CSS or compilation errors.

---

## Step 2: Tab Navigation & State Layout Partitioning
- [ ] State variable `activeTab` (0 for Chat & Search, 1 for Ingest & Studio) is declared in `page.tsx`.
- [ ] Tab buttons are rendered in the center of the main header.
- [ ] Active and inactive workspaces switch visibility based on `activeTab` using CSS visibility or display classes (retaining local state).
- [ ] Collection Selector is placed in the global header next to the database status badge.
- [ ] Next.js build runs cleanly (`npm run build` exits 0).

---

## Step 3: Tab 1 (Chat & Search) Component Redesign
- [ ] Tab 1 displays a dual-column layout on wide screens.
- [ ] LightRAG chat interface is located in the left column.
- [ ] Local Similarity Search and Deep Research SIRA panels are stacked in the right column.
- [ ] SIRA search concept sketches render using interactive, styled MD3 chips.
- [ ] Chat query answer display utilizes elevated markdown-styled card structures.
- [ ] Next.js build compiles without typescript errors.

---

## Step 4: Tab 2 (Ingest & Studio) Component Redesign
- [ ] Tab 2 displays a dual-column layout.
- [ ] Collections Manager and Local DB File Ingestion are stacked on the left.
- [ ] LightRAG Graph Ingest panel is positioned in the right column.
- [ ] Sliders (chunk size and overlap) are styled with custom track and slider thumbs matching MD3 colors.
- [ ] Drag-and-drop file ingestion elements render modern dropzones with upload indicator layouts.

---

## Step 5: Sliding Tab Pill & Interactive Micro-interactions
- [ ] Sliding tab background indicator pill shifts position smoothly using CSS transforms/transitions.
- [ ] Elastic click effects (`scale(0.96)`) are active on all main layout buttons.
- [ ] Inputs and textareas transition outlines and glow with radial focus rings.
- [ ] Upload dropzones pulse and animate dashes when drag-and-drop hover actions occur.
- [ ] Loading and progress indicators animate with high-fidelity spin timing.

---

## Step 6: Layout Polishing, Responsiveness & Verification
- [ ] Main dashboard layout centers and restricts maximum content width to `1600px` on desktop displays.
- [ ] Responsiveness adapts columns seamlessly down to `1280px` (two equal columns) and `768px` (single stacked column).
- [ ] CSS code has no visual overlapping, unstyled boundaries, or horizontal overflows.
- [ ] Full local compilation (`npm run build`) runs and finishes with zero warning or error output.
