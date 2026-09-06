# Mementos art style

Canonical visual system for destination canvases. Use this document when restyling Settings, Collections, empty states, or any new surface inside `AppShell`.

Copy the **recipes already in CSS**, not Persona 5 artwork.

## How to use this file

1. Keep the cream sidebar. Paint the **content area** crimson.
2. Build chrome from **black/white jagged badges** (skewed rectangles, hard offset shadows, square corners).
3. Reuse existing classes before inventing new ones. The live sources of truth are:
   - `app/app/components/knowledge-base/knowledge-base.module.css`
   - `app/app/components/deep-research/deep-research.module.css` (from `.traceMain` down)
   - `app/app/globals.css` (shared tokens, focus, reduced motion)
4. Interaction philosophy still lives in `docs/design.md` (restraint, hierarchy, one focal point, accessibility). This file **supersedes** that document’s “light-first / red is only an accent / no large red backgrounds” rules for destination canvases.

Sourced graphic-system research: [`docs/research/persona-5-sns-visual-language.md`](research/persona-5-sns-visual-language.md) (official name **IMs**; SNS is JP/wiki language). Place-and-voice research: [`docs/research/mementos-visual-direction.md`](research/mementos-visual-direction.md). Treat that note’s “avoid full-screen red” guidance as superseded for Deep Research (active trace) and Knowledge Base — those destinations **are** the IM room.

---

## Intent

The product should feel like entering a navigable archive: a deep red field, objects slammed onto it as black and white stickers, a jagged black track connecting a sequence of moves.

Borrow the **graphic system** of Persona 5’s **IMs** overlay (the crimson phone chat), not the Mementos dungeon HUD:

- one passionate red as the identity color (Sutoh/Wada, CEDEC);
- almost no extra hues except tiny speaker/status marks;
- **flat fills**, not gradients (Sutoh);
- angle, contrast, and luminance — not extra colors — create hierarchy;
- relevant reading sits on the **white** side of a panel;
- skew the **container**, keep body type mild enough to read (Hashino walked back over-diagonal messages).

Idle Deep Research still uses a dialogue-box PNG, a protagonist portrait, and local Optima (`DialogueCanvas`). That is a **composer special case**. Do not spread those bitmaps or that font into other screens.

---

## Lineage (why these rules)

Full citations live in the [IMs / SNS research note](research/persona-5-sns-visual-language.md). The product rules come from:

- **IMs, not Mementos-the-dungeon.** Atlus’s English web manual names the crimson chat overlay **IMs** (Field p.22). Mementos (“Everyone’s Palace”) is a different costume: black field, chains, marketing collage. Knowledge Base chat copies **IMs grammar**. The Deep Research ribbon is sequential process, not the dungeon HUD.
- **One red, black/white paper.** CEDEC (Sutoh/Wada): passionate red as identity; almost no sub-colors except meters; hierarchy from gaze lines, angle, and luminance. Sutoh: black/white type, **flat fills, no gradations**. Hashino: that red is harsh; early messages were too diagonal and too animated, then calmed.
- **Sticker geometry.** Official IMs stills: skewed polygons, triangular tails, offset portrait badges, hard unblurred shadows. We replace faces with letter chips. Sampled JPEG reds (`#D11E00` manual chrome, `#A40001` in-frame) are **approximations** — the product token is `#c90000`.
- **Clip-path warning.** Percentage polygons distort on tall content. This repo already hit that on the Knowledge Base spine; tile a fixed period (`repeat-y`) or measure the ribbon.

---

## Two rooms

| Room | Material | Where |
| --- | --- | --- |
| **Frame** | Warm paper | `AppShell` sidebar, `html`/`body` |
| **Canvas** | Crimson field | Knowledge Base workspace, Deep Research **trace** |

The sidebar stays `--paper` (`#f5f1e9`). Never paint the nav crimson. The destination’s root (`main`, `.workspace`, `.traceMain`) fills the remaining column with field red and owns all badges.

Idle Deep Research composer is still paper (View A). Once a run starts, View B (`.traceMain`) is the canvas. Knowledge Base is canvas immediately.

When restyling a third destination (Settings, a future page): it should open as a **canvas**, not as another paper dashboard.

---

## Tokens

Declare these on the destination root. Knowledge Base uses `--kb-*`; the trace uses `--trace-*`. Same values — keep them aligned.

```css
--field: #c90000;   /* destination background — not the shell cherry */
--ink: #000000;
--paper: #ffffff;
--label: #ffb3b8;   /* uppercase labels on black */
--quiet: #c7c0b8;   /* secondary text on black */
--you: #fbe432;     /* user portrait chip */
--archive: #4ac5e1; /* assistant / KB portrait chip */
--ok: #9bc6a6;      /* success mark on black */
--bad: #f3a29f;     /* failure / error copy on black */
```

Shell cherry (do not use as the canvas fill):

```css
--red: #b7193b;
--red-bright: #e12f49;
--paper: #f5f1e9;   /* globals.css — sidebar only */
--ink: #1d1b19;
```

On the canvas, **field red + black + white** do the work. Yellow and cyan exist only on the tiny portrait chips. Green/pink exist only as status marks, never as fills.

Focus on canvas: `outline: 3px solid #fff; outline-offset: 3px`.
Focus on paper: `outline: 3px solid var(--red-bright); outline-offset: 3px`.

No gradients. No `border-radius` except `0`. No glass.

---

## Geometry recipes

Every badge is the same idea: a sharp rectangle, a hard shadow that is a copy of the fill color (usually black), a few degrees of skew, inner content unskewed so type stays readable.

### 1. Skewed badge (copy this)

```css
.badge {
  border: 4px solid var(--paper);
  background: var(--ink);
  color: var(--paper);
  box-shadow: 7px 7px 0 var(--ink);
  transform: skewX(-8deg) rotate(-0.5deg);
}
.badge > * {
  transform: skewX(8deg);
}
```

Invert for “user / primary paper” objects: white fill, black border, opposite skew (`skewX(7deg) rotate(0.6deg)`), unskew children with `skewX(-7deg)`.

Shadow offsets in the live CSS: `3px` (inputs), `4px` (tabs, buttons, portraits), `5–6px` (stamps, composer), `7–8px` (speech bubbles, milestone / ingest cards). Pick one and keep it consistent on a given object.

### 2. Speech tail

Archive bubble: triangle on the left (`border-right: 12px solid white`).
User bubble: triangle on the right (`border-left: 12px solid black`).

### 3. Portrait chip

Square, ~2.55rem, 3px border, 4px black offset, rotated ±8–9°. Letters inside (`YOU`, `KB`, `VS`), not faces. User = yellow; archive = cyan.

### 4. Stamp / dossier label

Black block, thick white **left** bar (`border-left: 0.45rem solid white`), slight rotate (`0.8deg`), hard shadow. Uppercase micro-label in `--label`, title in white, helper in `--quiet`. See `.archiveStamp` and `.statusStamp`.

### 5. Track / ribbon

A black jagged strip **behind** the sequence, never the sequence itself.

- Knowledge Base: `.spine` is a `repeat-y` SVG tile, `background-size: 100% 5rem`, `filter: drop-shadow(10px 12px 0 #000)`. Render it only after there is a message. Do not use a percentage `clip-path` on a full-height box — tall answers stretch the teeth.
- Deep Research: one measured filled SVG ribbon (`.traceWires path { fill: #000 }`) with the same drop-shadow. Nodes sit on it; search batches stack vertically.

Tails that pin a card to the ribbon are CSS triangles (`.routeTailTop` / `.routeTailBottom`).

### 6. Pending vs live

Pending: dashed 2px border, reduced opacity fill. Failed: keep the badge, shift the shadow or mark to `--error` / `--bad`. Never hide a failed step.

---

## Typography

Body font is Inter (`--font-body`). Display Georgia (`--font-display`) is for paper-composer headlines and the source-register title only.

| Role | Size | Weight | Tracking | Case |
| --- | --- | --- | --- | --- |
| Screen kicker (`03 Knowledge Base · …`) | 0.66–0.68rem | 800 | 0.13em | uppercase |
| Badge kicker (`ARCHIVE`, `YOU`) | 0.64rem | 800–850 | 0.12em | uppercase |
| Badge body | 0.84–0.95rem | 650–800 | normal | sentence |
| Helper / meta | 0.66–0.72rem | 400–650 | normal | sentence |
| Mono (elapsed, scores, semantic query) | 0.68–0.82rem | 400–750 | — | — |

Kickers on black use `--label` (`#ffb3b8`). Kickers on white use field red or shell cherry. Do **not** skew the glyphs — skew the box, then unskew the children.

Numbered destinations (`01`, `02`, `03`) are tabular and sit in a black chip or in the sidebar rail. They are wayfinding, not decoration.

---

## Layout

### Destination column

```
[ AppShell paper nav | crimson canvas ]
                     | utility strip (kicker + local actions)
                     | scrollable stage (max ~1080–1120px)
                     | sticky composer / primary action (if any)
```

Horizontal padding: `clamp(1rem, 3vw, 2.4rem)` (KB) or `clamp(1rem, 4vw, 4rem)` (trace). The stage is `width: min(1120px, 100%); margin-inline: auto`.

### Knowledge Base

- Chat is the default local view. Vector Search is a second tab, same canvas, state retained while switching.
- Utility: numbered kicker, collection stamp, Chat / Vector Search tabs (skewed).
- Thread: column, `gap: 1.15rem`. Empty = quiet line of copy, **no spine**. After the first message, add `.threadActive` gutter and the tiled spine.
- User bubbles right-align (`margin-left: auto; flex-direction: row-reverse`). Archive bubbles left-align on the track.
- Composer stays at the bottom of the panel on field red. Enter sends; Shift+Enter newline.

### Deep Research trace

- Query is a calling-card canvas (ransom-note lettering) plus a semantic text equivalent.
- Utility: status stamp, elapsed mono time, Cancel / New research (white badges).
- Route is a vertical list in process order. Desktop zig-zags checkpoints left/right; batches stack on the ribbon. Narrow screens collapse to one column (`max-width: 768px`).
- No pan, zoom, minimap, or horizontal trace scroll.

### Narrow screens

Tabs and stamps go full width. Thread gutter shrinks (`padding-left: 3.6rem`, spine `width: 3.1rem`). Composer stacks to one column; send button goes full width. Drawers (when restyled) should already be `width: 100%` under 768px.

---

## Component catalog

These already exist. Restyle by **reusing** them, not redrawing.

### Frame (`app-shell`)

| Piece | Class / file | Notes |
| --- | --- | --- |
| Shell grid | `.shell` | Paper nav ~208–224px + fluid canvas |
| Wordmark | `.wordmark` | “Mementos” + square cherry mark |
| Destinations | `.destination` | `01/02/03`, `aria-current="page"` |
| Context action | `.contextAction` | Cherry fill — the one loud paper control |

### Knowledge Base canvas

| Piece | Class | Role |
| --- | --- | --- |
| Field | `.workspace` | `--kb-red` fill |
| Kicker | `.kicker` | `03 Knowledge Base · Archive dossier` |
| Collection stamp | `.archiveStamp` | Active collection name |
| View tabs | `.tabs button` | Chat / Vector Search |
| Thread | `.thread` / `.threadActive` | Scroll region |
| Spine | `.spine` | Tiled track; only when the thread is live |
| Archive bubble | `.assistantMessage` `.bubble` | Black, white border, left tail |
| User bubble | `.userMessage` `.bubble` | White, black border, right tail |
| Portrait | `.portrait` | Letter chip |
| Composer | `.chatComposer` | White skewed field + black send |
| Source index | `.sourceIndex` | Numbered citations under the answer |
| Vector match | `.result` inside `.assistantMessage` | Same bubble language as chat |

Components: `KnowledgeBase.tsx`, `RagChat.tsx`, `VectorSearch.tsx`, `ChatComposer.tsx`, `CitationList.tsx`.

### Deep Research canvas (trace)

| Piece | Class | Role |
| --- | --- | --- |
| Field | `.traceMain` | `--trace-red` fill |
| Status stamp | `.statusStamp` | Left white bar; status color on success/fail |
| Calling card | `.callingCardCanvas` | Query identity |
| Ribbon | `.traceWires` | Measured SVG fill, drop-shadow |
| Milestone | `.milestoneCard` | White, first Brief + Sketch stop |
| Checkpoint | `.checkpointCard` | Black, supervisor iteration |
| Batch | `.batchCard` | Black, one search; even rows counter-rotate |
| Ranked | `.rankedCard` | White, evidence ranked |
| Ingest | `.ingestNode` | White, locked until ranked |
| Source register | `.sourceRegister` | White panel, black header |

Components: `TraceSurface.tsx`, `SourceList.tsx`, `trace-route.ts`. Calling-card drawing: `app/lib/calling-card-text`.

### Not yet on this system

| Surface | Current look | When you touch it |
| --- | --- | --- |
| Collections drawer | Rounded paper, `#9f1239` pills | Restyle as a canvas overlay: black/white badges, square corners, field or black sheet — not Material |
| Settings (same trigger) | Same drawer | Same as Collections |
| Idle research composer | Paper + `DialogueCanvas` bitmaps | Leave unless explicitly redesigning View A |

---

## Motion

Default: **arrival, then stillness** (Hashino already rejected aggressive idle motion). Skew and rotation are **pose**, not animation.

Allowed:

- Trace ribbon fade-in (`traceDrawOn`, 0.5s) as a segment completes.
- Running marker pulse (`tracePulse`) on the active checkpoint only.

Honor `prefers-reduced-motion: reduce`: drop transforms on badges, portraits, tabs, and composer fields; skip draw-on and pulse; show the final state immediately. Global reduced-motion flattening already lives in `globals.css`.

Do not: shake, loop sakura, bounce every card, animate clip-path teeth, or keep a field pulsing once it has landed.

---

## Accessibility (non-negotiable)

- Status is text (`Answer ready`, `Retrieving evidence`, `0 matches`) plus a mark — never color alone.
- Live regions announce status, not each streamed token (`aria-live="off"` on the transcript).
- Decorative tracks/ribbons are `aria-hidden` or `pointer-events: none`.
- Process order in the DOM matches reading order even when the trace zig-zags.
- Only real actions are tabbable (composer, tabs, Brief/Sketch rows, Ingest, Copy, Stop). Display-only batches are not extra tab stops.
- Contrast: white on `#c90000`, white on `#000`, black on `#fff`. Do not put `--quiet` grey on field red for essential copy.
- Empty canvas: heading, collection context, composer. No fake track, no marketing illustration.

---

## Recipe: stylize another part of the site

Work in this order:

1. Wrap the destination in `AppShell`. Put field red on the **child** root, not on `.shell`.
2. Copy the token block (`--field / --ink / --paper / --label / --quiet`) onto that root.
3. Utility strip: numbered kicker + one stamp + the few actions that belong on this screen.
4. Primary objects as skewed badges. Unskew inner text. Square corners, 3–4px borders, hard `box-shadow: Npx Npx 0 #000`.
5. If there is a sequence (steps, messages, files), add a **tiled** black track behind it after the first item exists. Do not clip-path a full-height polygon.
6. Sticky composer / primary action at the bottom if the user must keep typing.
7. Focus rings white on red. Reduced-motion unwraps skew.
8. Match an existing component if one already does this job (stamp, tab, bubble, checkpoint, button).

A new CSS module is fine. A new color, font, or illustration is not.

---

## Forbidden

- Persona portraits, logos, sakura, Atlus/LINE pictorial stamps, or additional game fonts.
- Percentage `clip-path` on a box that grows with content.
- Gradients, glass, rounded Material controls, soft drop shadows (`rgb(0 0 0 / 25%)` blurs).
- Painting the sidebar crimson or inverting the whole app to black.
- Skewed body copy (always unskew children).
- Extra accent hues beyond the portrait chips and status marks.
- Dashboard card grids competing at equal weight.
- Exposing chain-of-thought, `### References` dumps, or raw prompts in the UI.

---

## Sources

1. Live CSS: `knowledge-base.module.css`, `deep-research.module.css` (`.traceMain` onward), `app-shell.module.css`, `globals.css`.
2. [`docs/research/persona-5-sns-visual-language.md`](research/persona-5-sns-visual-language.md) — IMs overlay graphic system (first-party citations).
3. [`docs/research/mementos-visual-direction.md`](research/mementos-visual-direction.md) — Mementos-as-place and verbal tone.
4. [Atlus — Persona 5 web manual, IMs (Field p.22)](https://atlus.com/persona5/manual/ps4/?pid=21)
5. `docs/design.md` — interaction constitution (restraint still applies; canvas color rules here win).
6. `docs/deep-research-trace-redesign-spec.md` and `docs/knowledge-base-design-overhaul-spec.md` — product behavior these visuals sit on.
