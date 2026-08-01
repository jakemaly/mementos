# Spec: Persona-style Deep Research Composer

## Status

Proposed.

## Objective

Replace the current Deep Research composer textarea with one large, clean, Persona 5-inspired dialogue box while preserving the existing research workflow:

> choose a collection → write one research question → start research

The composer should feel like a focused prompt surface, not a game recreation or a second dashboard.

## Scope

### In scope

- The idle Deep Research composer only.
- A large dialogue-box treatment around the existing native `<textarea>`.
- A compact speaker/name plate.
- Existing collection selection and submit action, integrated into the box footer.
- Responsive behavior, keyboard support, visible focus, reduced motion, and validation states.
- Reuse of the existing React/CSS-module implementation with no new dependency.

### Out of scope

- Replacing the active research workspace.
- Character portraits, emotion/costume menus, dialogue export, image generation, or canvas rendering.
- Copying Persona 5 logos, portraits, background art, or proprietary UI assets.
- Adding a font dependency or importing fonts from the reference repository without an explicit licensing review.
- Changing request contracts, research state, source ingestion, or collection behavior.

## Design direction

Use a restrained **Persona-inspired** visual language:

- Off-white page background from the existing Mementos theme.
- One large near-black dialogue panel with a hard cherry-red offset edge/shadow.
- White text area with a sharp, slightly skewed/angled panel edge.
- Small black speaker plate with white uppercase text: `MEMENTOS` or `RESEARCH QUERY`.
- Cherry red reserved for focus, the submit action, and the active edge.
- No gradients, glass effects, decorative portraits, or noisy background texture.
- Keep the rest of the page sparse so the box is the one focal point.

The result should read as “a sharp dialogue prompt” rather than “a themed form.”

## Proposed layout

```text
┌──────────────────────────────────────────────────────────────┐
│  MEMENTOS                                      DEEP RESEARCH  │  ← speaker plate / eyebrow
│                                                              │
│  What should Mementos research?                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Write a question worth following...                   │  │  ← native textarea
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ────────────────────────────────────────────────────────── │
│  Save evidence to  [ collection                         ▾ ] │
│                                      [ START RESEARCH  ↗ ]  │
└──────────────────────────────────────────────────────────────┘
       ▬ cherry offset edge / angular accent
```

### Desktop

- Box width: `min(100%, 58rem)`.
- Minimum height: approximately `27rem`; allow the textarea to remain spacious rather than filling the page with surrounding copy.
- The textarea should occupy the dominant area: minimum `14rem` height.
- Speaker plate overlaps the upper-left edge by roughly `1rem`.
- Footer aligns collection selector left and submit action right.
- Remove the current large intro copy, route note, decorative circle, and separate composer hint from the focal area. Keep only a short keyboard hint below the box if space allows.

### Mobile

- Box becomes full width with 1rem page gutters.
- Minimum height: approximately `22rem`.
- Speaker plate remains attached to the upper-left edge but does not overflow the viewport.
- Footer stacks collection selector and submit button vertically.
- Textarea remains at least `11rem` high.
- No horizontal overflow or clipped angled decorations.

## Component behavior

### Speaker plate

Render a semantic label above or overlapping the textarea:

- Primary label: `MEMENTOS`.
- Secondary context: `DEEP RESEARCH`.
- Decorative skew/offset must not be the only way to understand the label.

Do not make it editable or interactive.

### Query input

Keep the existing controlled textarea and contract:

- `id="research-query"`.
- `aria-label="Research query"`.
- Placeholder: `What should Mementos research?`.
- `Enter` submits when the prompt and collection are valid.
- `Shift+Enter` inserts a newline.
- Preserve multiline input and native text selection.
- `resize: vertical` is acceptable, but the default state must already be large.
- Do not impose a character limit unless the API already requires one.

### Collection selector

Keep the existing native `<select>` and collection behavior:

- Label remains visible: `Save evidence to`.
- Preserve the selected collection when returning from a run.
- If collections are unavailable, show the existing unavailable state and keep submit disabled.
- Do not introduce a custom dropdown just for visual fidelity.

### Submit action

Keep one primary action:

- Visible text: `START RESEARCH`.
- Existing submit semantics and disabled validation remain unchanged.
- Use a red/black high-contrast button with a small arrow glyph.
- Do not add a second “send” button inside the textarea.

## States

| State | Treatment |
|---|---|
| Empty | Placeholder visible; submit disabled; neutral black panel edge. |
| Query entered, no collection | Query remains editable; submit disabled; collection label explains required selection. |
| Ready | Red focus/active edge and enabled submit. |
| Focused | Visible 3px focus ring around the textarea, not only a color change. |
| Starting | Disable input and controls; change action text to `STARTING…`. |
| Error | Preserve the existing alert outside or immediately below the box; do not rely on red decoration alone. |
| Reduced motion | Disable skew/hover transitions and offset animations. |

The starting state is controlled by the existing `disabled` prop; the composer must not introduce a second lifecycle model.

## Accessibility

- Use the existing semantic `<form>`, `<label>`, `<textarea>`, `<select>`, and `<button>` elements.
- Keep visible labels; placeholder text is not a label.
- Ensure black/white/red combinations meet WCAG AA contrast.
- Use `:focus-visible` with an outline that remains visible against both the white text area and black frame.
- Decorative pseudo-elements use `aria-hidden` behavior by being CSS-only.
- Do not use skewed text or background shape as the sole status signal.
- Respect `prefers-reduced-motion`.

## Implementation guidance

### Preferred approach

Modify:

- `app/app/components/deep-research/ResearchComposer.tsx`
- The composer section of `app/app/components/deep-research/deep-research.module.css`

Reuse the current state, handlers, request contract, and native controls. Do not add a library or canvas.

Use CSS pseudo-elements for the red offset edge and angular corner. Keep the actual input rectangular and semantic; transform only decorative wrappers where possible so caret placement, selection, and focus behavior remain reliable.

Suggested class responsibilities:

- `.composerMain`: sparse page background and centering.
- `.composerPanel`: dialogue frame, black surface, red offset edge.
- `.dialogueHeader`: speaker plate and context label.
- `.composerInput`: large white native textarea.
- `.composerFooter`: collection and submit controls.

Avoid hard-coded Persona 5 assets from the reference repository. The open-source implementation is useful as a reference for layered canvas composition, black/red/white contrast, hard offset shadows, and angular framing; its character assets and fonts are not required for this feature.

### Reference implementation findings

`opennoise1/p5-dialogue-generator` uses:

- Layered canvas elements for portrait, dialogue box, name, and text.
- Hard black borders and offset shadows.
- Red/black/white contrast.
- Proprietary-looking bundled fonts and Atlus character assets.
- A broad generator surface with portrait, costume, emotion, font, upload, and download controls.

Only the visual grammar is relevant here. The Deep Research composer should deliberately omit the generator's menus, canvas, portrait selection, export flow, and dense control surface.

The repository README attributes its portraits and logos to Atlus and describes them as fair use. No project `LICENSE` file was available at the referenced `main` path during review. Therefore, this feature should use original CSS geometry and existing project typography/assets unless legal approval is obtained.

## Acceptance criteria

- [ ] Idle Deep Research shows one dominant large dialogue-style composer instead of a generic underline textarea.
- [ ] The prompt remains a real native textarea with existing Enter/Shift+Enter behavior.
- [ ] Collection selection and submit remain inside the composer footer and preserve current behavior.
- [ ] The box is visually sharp and Persona-inspired using CSS-only geometry and the existing theme palette.
- [ ] No portrait, logo, canvas, font, generator menu, or export dependency is added.
- [ ] Desktop composer is spacious without requiring page scrolling for the initial state.
- [ ] Mobile composer is readable at 390px with no horizontal overflow.
- [ ] Empty, invalid, focused, starting, error, and reduced-motion states are legible.
- [ ] Keyboard navigation and visible focus remain intact.
- [ ] Knowledge Base, active research workspace, SSE behavior, and ingestion behavior are unchanged.
- [ ] Existing frontend checks, lint, build, and `git diff --check` pass.

## Verification

From `app/`:

```bash
node test-deep-research-frontend.mjs
npm run build
npx eslint app/components/deep-research/ResearchComposer.tsx
```

Manual checks:

- 1440px: composer reads as the single focal point and has no unnecessary surrounding decoration.
- 768px: footer and frame remain aligned.
- 390px: no clipped red edge, horizontal overflow, or inaccessible controls.
- Keyboard: focus textarea → collection → submit; `Enter` submits and `Shift+Enter` inserts a newline.
- Reduced motion: no meaningful animated offset or transition remains.

## Non-goals / future threshold

Do not add portraits, generated dialogue images, font switching, or downloadable output unless the product later becomes a general-purpose dialogue-card generator. That would be a separate feature with separate asset/licensing and mobile requirements.
