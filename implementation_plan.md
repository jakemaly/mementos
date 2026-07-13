b# Implementation Plan: Second-Brain UI/UX Overhaul

## Overview
A 6-step sequential plan to overhaul the user interface of the `second-brain` dashboard to Google's Material Design 3 (MD3) spec with a 2-tab layout, enhanced styling, and playful micro-interactions. Every step leaves the application in a buildable and running state.

---

## Task List

### Step 1: Design System & CSS Variables Setup
- **Description:** Rewrite `app/app/globals.css` to declare MD3 style tokens (colors, layout grid adjustments, typography, elevation shadows, and global base styles).
- **Files touched:**
  - `app/app/globals.css` (edit)
- **Acceptance Criteria:**
  - [ ] MD3 color variables (`--md-sys-color-*`) and elevation variables (`--md-elevation-*`) are defined in `:root`.
  - [ ] Default system transitions are established for background, color, and borders.
  - [ ] App still builds and runs correctly on `npm run build` from the `app` directory.

---

### Step 2: Tab Navigation & State Layout Partitioning
- **Description:** Introduce `activeTab` state (`0` for Chat & Search, `1` for Ingest & Studio) in `app/app/page.tsx`. Create a fixed header containing the MD3 sliding tab navigation bar. Split the layout into two logical wrapper elements, only displaying the active workspace with a soft fade-in transition.
- **Files touched:**
  - `app/app/page.tsx` (edit)
  - `app/app/page.module.css` (edit)
- **Acceptance Criteria:**
  - [ ] State variable `activeTab` is defined.
  - [ ] Header includes tab navigation with buttons for "Chat & Search" and "Ingest & Studio".
  - [ ] Main grid elements are grouped programmatically inside conditional rendering or display-none visibility classes depending on `activeTab`.
  - [ ] The app builds cleanly with zero TypeScript errors.

---

### Step 3: Tab 1 (Chat & Search) Component Redesign
- **Description:** Restyle the interactive components under Tab 1: LightRAG Chat & Query, Local Similarity Search, and Deep Research (SIRA) cards. Update forms, selects, buttons, and containers inside these sections to match the new MD3 design.
- **Files touched:**
  - `app/app/page.tsx` (edit)
  - `app/app/page.module.css` (edit)
- **Acceptance Criteria:**
  - [ ] LightRAG query panel uses MD3 styling with rounded pills and elevated output fields.
  - [ ] Local similarity search query fields and result chips use secondary color themes.
  - [ ] SIRA deep research concept sketches render as interactive, colorful MD3 chips.
  - [ ] Chat markdown response boxes are formatted as elevated containers with clear hierarchy.

---

### Step 4: Tab 2 (Ingest & Studio) Component Redesign
- **Description:** Restyle the setup and ingestion components under Tab 2: Collections Manager, Local File Ingest, and LightRAG Graph Ingest. Create stylized sliders for chunk size/overlap, dropzones with file indicators, and progress status layouts.
- **Files touched:**
  - `app/app/page.tsx` (edit)
  - `app/app/page.module.css` (edit)
- **Acceptance Criteria:**
  - [ ] Collections Manager displays card layouts with dynamic badge counts.
  - [ ] File ingestion zones use a styled dropbox area with hover activation.
  - [ ] Sliders (chunk size/overlap) use customized track elements to match primary MD3 colors.
  - [ ] Ingest status logs and progress display with clean typography and tertiary accents.

---

### Step 5: Sliding Tab Pill & Interactive Micro-interactions
- **Description:** Polish the CSS and JS transitions to implement the sliding background tab indicator pill and custom animations: elastic hover/active scales on buttons, radial focus rings on text input areas, and pulsing upload dropzones.
- **Files touched:**
  - `app/app/page.module.css` (edit)
  - `app/app/page.tsx` (edit)
- **Acceptance Criteria:**
  - [ ] Sliding tab navigation uses a background pill that shifts position smoothly using CSS transitions.
  - [ ] Scale transformations are active on all primary/secondary button hover/active states.
  - [ ] Text inputs and selects expand a glowing focus ring when focused.
  - [ ] Upload dropzones pulse and animate dashes when drag events occur.

---

### Step 6: Layout Polishing, Responsiveness & Verification
- **Description:** Verify responsiveness of the 2-tab layout down to mobile sizing (768px). Clean up any legacy CSS, fix any visual bugs or overflows, and run build checks to ensure complete correctness.
- **Files touched:**
  - `app/app/page.module.css` (edit)
- **Acceptance Criteria:**
  - [ ] Media queries adjust tab panels and grid structures correctly on medium (1280px) and small (768px) displays.
  - [ ] Run `npm run build` and ensure successful build verification.
  - [ ] Ensure sidecar interaction remains functional for ingestion and querying on the newly structured panels.
