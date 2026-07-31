# Mementos visual and verbal direction

Research note for the second-brain UI. This is an interpretation of the Persona 5 inspiration, not a reproduction of its artwork, logo, or interface.

## Executive direction

Borrow the **energy of a navigable altered reality**, not the game's surface decoration:

- Keep the existing app's warm paper background, restrained spacing, readable Inter body type, and cherry accent.
- Add Persona 5's visual tension only at moments of attention: the active route, research progress, selected evidence, and primary action.
- Use a small vocabulary of black, white, and red; use diagonal cuts, offset outlines, and pattern as occasional signposts rather than wallpaper.
- Treat research as a route through a shifting archive: the user enters a question, follows a trace, reviews evidence, and claims sources for a collection.

Recommended first experiment: combine **Prototype A — Navigator landing** with **Prototype B — Route map workspace** in a throwaway visual pass before changing the information architecture.

## Primary-source observations

### 1. Mementos is framed as a shared, changing space

Atlus's official Persona 5 page names the location **“Mementos: Everyone's Palace.”** It describes requests arriving from an informant, being accepted or declined, then being handled inside a vast dungeon whose shape changes between visits. The copy makes the space feel persistent, navigable, and slightly theatrical rather than merely scary.

Source: [Atlus — Persona 5: Phantom Thief Life](https://atlus.com/persona5/phantom-life.html) (Mementos section).

### 2. The surrounding fiction uses navigation and transformation language

The official Persona 5 Royal site calls the Metaverse Navigator a mysterious app that leads the Phantom Thieves into a distorted reality. Its surrounding copy repeatedly uses verbs such as *enter*, *steal*, *approach*, *strike*, *pave the way*, *conquer*, and *change*. The experience is framed as an active mission, not passive browsing.

Source: [Atlus — Persona 5 Royal](https://persona.atlus.com/p5r/).

### 3. The visual grammar is high-contrast collage

The official Mementos assets use a narrow palette and aggressive composition:

- near-black field;
- saturated red ground or blocks;
- thick, imperfect white contours;
- black chain and skyline silhouettes;
- tilted image panels with heavy borders;
- dense black-on-black geometric pattern behind white copy;
- large display lettering that feels cut, pasted, and offset rather than typeset on a neutral grid.

Sources: [Mementos background asset](https://atlus.com/persona5/img/phantom-life/section_8_bg.png), [Mementos information panel](https://atlus.com/persona5/img/phantom-life/section_8_info.png), and [Mementos title asset](https://atlus.com/persona5/img/phantom-life/section_8_title.png).

### 4. The voice is imperative, playful, and still concrete

The official copy combines a clear action with a theatrical metaphor. It uses short, energetic sentences, second-person address, verbs of movement, and occasional wordplay. The tone is confident and mischievous, but the user is always told what the thing does.

Useful traits to borrow:

- **imperative:** “Enter,” “trace,” “choose,” “claim”;
- **mission framing:** a query becomes a route, sources become evidence;
- **dry flourish:** one small wink after the plain instruction;
- **concrete nouns:** collection, source, route, result, evidence;
- **short status language:** avoid paragraphs while the system is working.

Do not copy Persona-specific lore into every label. The app should remain understandable to someone who has never played Persona 5.

## Translation into this app

The current app already has a good restraint baseline: warm off-white surfaces, a left navigation rail, cherry active states, sparse borders, and a four-pane research workspace. Its design constitution explicitly prefers hierarchy over containers, matte paper over constant glass, and one visual focal point per screen.

The main opportunity is not more decoration. It is to make the existing states feel intentional:

| Current behavior | Mementos-inspired translation |
| --- | --- |
| Research query form | A Navigator entry point: one clear question, one target collection, one decisive action |
| Research status badge | A route status marker: visible, compact, and slightly theatrical, with a plain meaning nearby |
| Execution graph | A route map: one highlighted path, quiet completed nodes, obvious current node |
| Observability timeline | A trace log: evidence of what the Navigator did, collapsed by default when not needed |
| Source list | An evidence deck: numbered, selectable, and easy to claim into a collection |
| Knowledge Base collection | An archive/collection with a persistent name; avoid calling every object a “Palace” |
| Empty state | A short invitation plus an explicit explanation of what will happen |

## Verbal direction

Use a two-layer pattern: **themed headline + plain helper text**.

| Context | Suggested copy |
| --- | --- |
| Research landing | **Enter a question.** Mementos will map the evidence. |
| Empty research state | **No route yet.** Ask a question to begin. |
| Running | **Following the trail** · Searching the open web |
| Completed | **Route mapped** · 18 sources ready to review |
| Import action | **Claim selected sources**; helper: “Add them to this collection.” |
| Empty source list | **The route is quiet.** Run a research query to surface evidence. |
| Knowledge Base chat | **Search the archive.** Ask about this collection. |
| Failure | **The route broke.** We could not finish this pass. Try again. |

Keep technical status available for accessibility and debugging. For example, render “Following the trail” with a smaller explicit label such as `Researching` rather than replacing the meaning entirely.

## Prototype proposals

### Prototype A — Navigator landing (recommended starting point)

**Question:** Can the landing screen feel like entering a distinct research space without adding controls?

**Shape:** Keep the current centered composer. Add one asymmetric red/black “ENTER THE ROUTE” marker, a more intentional query field, and a single primary button with a text label. Keep collection selection below the query as quiet context.

**Visual rules:**

- warm paper remains the page background;
- one black or charcoal anchor, not a full black page;
- a red offset outline or diagonal corner supplies tension;
- no decorative hero illustration;
- no extra cards, tips, or dashboard metrics before the first query.

**Success check:** A first-time user can identify the question field, collection, and start action in under three seconds. The visual treatment should be memorable even when the red marker is removed.

### Prototype B — Route map workspace

**Question:** Can the four-pane research workspace feel like one coherent journey instead of a dashboard of independent panels?

**Shape:** Keep the existing data and interactions, but make the execution graph the primary canvas. Connect the current node to a slim route line. Put the observability timeline behind a disclosure or compact side strip. Keep the research sketch and sources as a single evidence drawer that can be expanded.

**Visual rules:**

- one red route line for the active path;
- white/black nodes with a red edge only for current or selected state;
- slanted section labels for `BRIEF`, `TRACE`, `EVIDENCE`, and `COLLECTION`;
- sources use numbered rows and selection marks, not individual bordered cards;
- completed state quiets the route rather than adding more decoration.

**Success check:** The user can answer “where is research now?”, “what happened?”, and “what can I import?” without scanning four equally loud regions.

### Prototype C — Evidence dossier for Knowledge Base

**Question:** Can chat and retrieval feel like a personal archive while remaining calm and readable?

**Shape:** Keep the current Chat / Vector Search switcher. Reframe the page as a dossier: a small collection label, a paper-like transcript, and a source index that appears only after an answer. Use red tabs or underlines for selected sources instead of red-filled cards.

**Visual rules:**

- body copy remains ordinary and comfortable to read;
- active collection is a small “file label,” not a large dashboard control;
- citations become a numbered source index with a clear selected state;
- Vector Search uses the same source-row language as Deep Research;
- the only expressive flourish is a black/red edge or tab at the page boundary.

**Success check:** Chat remains the fastest path to an answer; the theme should not make users hunt for the composer or citations.

## What to avoid

- Full-screen red backgrounds or permanent black mode: they spend the accent everywhere and reduce calm.
- Slanted text everywhere: reserve skewed shapes for labels and transitions, not body copy.
- A new card for every existing pane: that would conflict with the repo's “hierarchy over containers” rule.
- Persona names, quotes, logos, or copied assets as UI labels or decoration.
- Animation that repeatedly pulses or shakes: use a single subtle route-progress motion and honor `prefers-reduced-motion`.
- Replacing clear labels with lore. “Claim sources” can coexist with “Import selected sources”; it should not replace it silently.

## Accessibility and implementation guardrails

- Preserve the current visible focus treatment and keyboard behavior.
- Maintain text contrast on warm paper and on red/black accents; never communicate status by color alone.
- Keep the display treatment to one heading/label face; retain the existing body font for reading.
- Prefer CSS shapes, borders, and pseudo-elements over new image assets or dependencies.
- Keep the first prototype CSS-only and reversible. Do not change the research data model or navigation until one visual direction proves clearer in the browser.

## Sources

1. [Atlus — Persona 5: Phantom Thief Life](https://atlus.com/persona5/phantom-life.html)
2. [Atlus — Persona 5 Royal official site](https://persona.atlus.com/p5r/)
3. [Atlus — Persona 5 Mementos background asset](https://atlus.com/persona5/img/phantom-life/section_8_bg.png)
4. [Atlus — Persona 5 Mementos information panel](https://atlus.com/persona5/img/phantom-life/section_8_info.png)
5. [Atlus — Persona 5 Mementos title asset](https://atlus.com/persona5/img/phantom-life/section_8_title.png)
6. [Atlus — Persona 5 web manual](https://atlus.com/persona5/manual/ps4/)
