# Persona Dialogue Direct Input

## Objective

Use the existing Persona 5 dialogue-box asset as the visible query surface. When the user clicks the dialogue box and types, the query must be rendered inside the box with the repository generator's **Optima Nova LT** font and main-box coordinates.

## Requirements

- Modify only the idle Deep Research composer; preserve the research request, collection selection, submit behavior, and active workspace.
- Keep the existing dialogue-box asset. Do not add or render a new background.
- Render query text with the generator's canvas technique and coordinates:
  - canvas: `1275 × 500`
  - box image: `x=320`, `y=234`
  - text: `x=500`, rows `373`, `403`, `433`
  - two entered lines use the generator's centered offsets: `387`, `417`
- Use the bundled **Optima Nova LT** font (`P5 Optima`) at the generator's `18pt` size.
- The user clicks directly in the dialogue area to type. The native controlled textarea remains the keyboard, focus, selection, and accessibility surface, but its HTML text must be transparent; the canvas is the only visible query text.
- Preserve Enter-to-submit and Shift+Enter newline behavior.
- Do not render the old dialogue name plate, context label, placeholder, or any other existing text inside the dialogue image.
- Do not change the surrounding collection and submit controls or research lifecycle.

## Non-goals

- No portraits, menus, font selector, export/download flow, or generator background.
- No changes to the active research workspace or API contract.
- No new dependency.

## Verification

From `app/`:

```bash
npm run lint
npm run build
node test-deep-research-frontend.mjs
```

Manual checks: click anywhere in the dialogue text region, type one to three lines, confirm the visible canvas text uses Optima Nova LT and remains aligned at desktop and mobile widths; confirm keyboard submission and Shift+Enter still work.
