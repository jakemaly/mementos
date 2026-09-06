# Persona 5 SNS / Mementos chat — transferable visual language

- **Status:** Research only. No application code was changed. This is a graphic-system note for a product spec, not a reproduction brief.
- **Access date:** 2026-09-05
- **Scope:** The in-game smartphone **IMs / SNS** chat overlay, plus adjacent Atlus UI grammar that the chat inherits. Not a copy of game art, portraits, logos, fonts, or sakura effects.
- **Applied in:** [`docs/mementos-art-style.md`](../mementos-art-style.md) — destination canvases (Knowledge Base, Deep Research trace) use IMs grammar inside a paper `AppShell`. That spec is the implementer source of truth for tokens and components.
- **Companion note:** [`mementos-visual-direction.md`](./mementos-visual-direction.md) covers Mementos-as-place and verbal tone. This file covers the **chat surface** as a graphic system.

## Method and source tiers

Claims are tagged by origin:

| Tier | Meaning |
| --- | --- |
| **A — first party** | Atlus/SEGA official pages, web manual, marketing assets; developer talks reported by Famitsu; named interviews with Hashino / Sutoh (Sutou) / Wada |
| **B — reputable secondary** | Design write-ups that describe visible UI and cite developers; Game UI Database as a screenshot index |
| **C — observation** | Traits read from **official published screenshots** (Atlus web manual IMs page and Phantom Thief Life assets). Hex values are **JPEG-sampled approximations**, not Atlus tokens |
| **D — not shipped / fan** | Unused assets, fan CSS recreations. Used only to name a motion metaphor, never as a spec to copy |

Not found as a dedicated SNS art-book chapter: *Persona 5 Official Design Works* / *Official Visual Works* are character- and promo-art books with Soejima commentary, not a Sutoh SNS construction spec ([UDON listing](https://www.simonandschuster.net/books/Persona-5-+-Persona-5-Royal-Official-Design-Works/Atlus/9781772943238); [art-book review of contents](https://blog.lhyeung.net/2017/02/25/persona-5-official-design-works-artbook-review/)). UI process is documented in the CEDEC+KYUSHU 2017 talk, not in those volumes.

Do **not** treat sprite rips, fan “P5 fonts,” or LINE sticker sheets as implementable assets.

---

## 1. What “SNS / Mementos chat” actually is

Three different UIs get collapsed in casual talk. Only the first is the crimson chat overlay.

| Name in sources | What it is | Visual job |
| --- | --- | --- |
| **IMs** (official EN web manual, Field p.22) | Smartphone instant-message overlay: Confidant invites, party threads, request pings | Full-field crimson takeover; black/white balloons; offset portrait badges |
| **SNS** (JP player/wiki language; Megami Tensei Wiki “P. A. D.”) | Same phone chat, plus the Meta Nav app on the same device | Same overlay; Wiki screenshot shows Ryuji texting on a red field |
| **Mementos** (official: “Mementos: Everyone’s Palace”) | Shared, changing dungeon. Requests are accepted in the real world, then handled inside | Dungeon HUD + marketing collage (black field, red blocks, chains). **Not** the IM overlay |
| **Field dialogue** (manual p.20 “Conversation”) | In-world speech | Jagged black/white dialogue polygons with offset portraits — cousin of IM balloons, on the 3D scene, not a red chat field |

**Functional facts (A/B):** Square opens the IM list on the field. The list keeps a limited recent set (JP SNS wiki: latest **50**, older auto-deleted; commemorative photos are lost if never opened). The player does not free-type a social network; they read threads and pick replies (accept / decline / hold). Mishima’s texts are the usual path into Mementos requests.

**Design intent (A):** Hashino told Eurogamer the phone/chatroom exists because communication no longer requires face-to-face contact; Confidant logistics moved onto the phone versus Persona 4’s “go find them.” The same interview says early UI was “aggressively animated” and some **messages** were so diagonal the team said “this is way too much,” then **rotated messages more subtly and calmed animation** for readability.

---

## 2. Palette

### Official color policy (A)

- Series identity starts with **one main color**. P3 blue, P4 yellow, P5 **red** / **crimson red** / “passionate red” / “active, passionate red.” Sutoh: first color, then logo, then key font.
- Hashino (official Persona magazine, via PSU): red is the primary color and is **harsh on the eyes**; UI around it was difficult.
- Sutoh (Famitsu): after testing, **black and white text** on that crimson. He prefers **flat fills, not gradations**.
- CEDEC (Sutoh/Wada, Famitsu): P5 **avoids sub-colors** so the red stays dominant. **Exception: HP/MP numbers.** Usability is done with **gaze lines, angle, and lighting**, not a second brand hue.
- Hashino (A9VG): keyword **“Pop Punk”** — pop = mass-facing; punk = anti-establishment. UI is the inner, slightly wild world against boring streets.

Yellow in P5 is **not** the P3 “moonlight yellow” information color. Cyan/turquoise in write-ups is mostly **HP/MP and stat chips**, plus map “new spot” tags — not the IM thread’s main vocabulary.

### Approximate samples from official published images (C)

These are sampled from Atlus JPEGs/PNGs. Compression and lighting mean they are **not** a design-token spec.

| Role | Approx. hex | Where sampled | Use in SNS chat |
| --- | --- | --- | --- |
| Manual chrome crimson | `#D11E00` | Dominant field on [web manual p.22](https://atlus.com/persona5/manual/ps4/img/022.jpg) (also p.19–20) | Same family as the IM takeover; the **manual page itself** is designed in this red |
| Deeper in-frame crimson | `#A40001` | Secondary cluster on the same IMs page, in screenshot regions | Reads as the **in-game** chat field vs the manual’s slightly brighter page red |
| Mementos marketing red | `#AD051D`, `#990119` | [section_8_bg.png](https://atlus.com/persona5/img/phantom-life/section_8_bg.png) | Place-branding for Mementos, not the IM overlay |
| Pure marketing red | `#FF0000` | [section_8_info.png](https://atlus.com/persona5/img/phantom-life/section_8_info.png) | Graphic blocks on black; high chroma, no gradient |
| Black / white | `#000000` / `#FFFFFF` (near-pure in samples) | Manual + Phantom Life assets | Balloon fills, type, outlines, shadows |

**Yellow / cyan — roles, no sourced product hex:**

- **Yellow (C, IMs screenshot):** fill behind some **portrait badges** so a small face reads on crimson. Accent for *who is speaking*, not a second theme color.
- **Cyan (A+B):** reserved in policy for **meters / critical numbers**; in other HUD, small wayfinding (e.g. map tags on manual p.20). Do not flood the chat field with it.
- **Selection (B):** one write-up notes a small **blue** cursor chip in menus — a rare sub-color, not SNS chrome.

**Rule:** red is the room; black/white are the paper; yellow/cyan are **tiny signals**. Sutoh’s “no sub-color” policy is why the chat still reads as Persona 5 when you remove character art.

---

## 3. Shape language

Observed on official **IMs** screenshots (manual p.22) and cousin **Conversation** UI (p.20):

| Element | Geometry | Notes |
| --- | --- | --- |
| Chat field | Full-screen (or large) **flat crimson polygon**, often **tilted** vs the 3D world behind the phone | The “room” is a color field, not a rounded messenger sheet |
| Incoming balloon | **Black** irregular parallelogram / jagged polygon, **white** type | High contrast on red |
| Outgoing balloon | **White** polygon, **black** type | Invert of incoming — speaker polarity without extra hues |
| Speech tail | **Sharp elongated triangle**, not a rounded iMessage tail | Continues the cut-paper edge |
| Portrait badge | Small **square / trapezoid**, **offset** onto the balloon’s corner, often **rotated** a few degrees | Overlaps the bubble; not a centered circular avatar |
| Date / “IM” chrome | Stacked **tilted blocks**; ransom-note letter boxes on the **manual** headers | Game HUD date uses the same collage blocks |
| Reply choices | Stack of **skewed black bars**, white labels, a **white arrow** for selection | “Accept / Decline / Hold” as slammed menu strips |
| Depth | **Hard, unblurred, offset black (or white) shadows** | Sticker / paste-up, not CSS `box-shadow: blur` |
| Manual/marketing titles | Each letter or word in its **own** jagged box; mixed rotation | Same system as Phantom Life titles (“Mementos: Everyone’s Palace,” “A Mysterious App…”) |

**Dialogue vs SNS (C):** Field dialogue uses a **jagged white/black window + slanted nameplate + offset portrait** on the scene. SNS uses the **same cut-paper balloons** but **rehouses them in a crimson IM field** with a vertical thread and list chrome.

**Developer constraint (A):** extreme diagonals on messages were walked back. Skew should stay **mild enough to read**. Siliconera’s CEDEC summary: relevant information sits on the **white** side; **angle and contrast** change when descending a menu hierarchy.

**“Stamps” — do not confuse two things:**

1. **Graphic stamp (C, intended):** UI pieces look **inked and pasted**: thick outline, hard offset, slight rotation. Fan web recreations call this an “outlined sticker” (two stacked clipped polygons). That is the transferable system.
2. **LINE-style pictorial stamps (D):** TCRF documents **unused Royal “Showtime Stickers”** (mostly LINE art, temp icons; mostly scrapped). **Do not spec copying LINE/Atlus sticker art.** Shipped IMs emphasize **text balloons + photos**, not a sticker pack.

---

## 4. Typography character (feel, not files)

Atlus has **not** published in-game UI font names. Wiki “Futura Bold” hits **Persona 5 Royal logo**, not chat body. Fan “Persona 5 fonts” are **out of scope**.

| Layer | Feel | Where |
| --- | --- | --- |
| **Display / chrome** | Ransom-note **collage**: mixed case, mixed width, letters as separate blocks, heavy **white fill + thick black stroke** (sometimes an extra outer white hairline) | Manual headers (“IMs”), game date strip, Phantom Life titles, pause-menu labels |
| **Chat body** | **Calm, readable sans**, normal case, **not** spinning with the polygon. White on black or black on white | Balloon copy on official IMs shots |
| **Choice labels** | Heavy, slightly **slanted** sans on skewed bars | Accept / decline stacks |
| **Japanese vs EN** | Localized; display collage is **drawn**, body is a **workhorse gothic/sans** | Sutoh: key font is chosen with the logo — that is identity type, not paragraph type |

Verge: menus look like **cutout ransom-note text**. Kinga Olszewska: decorative cutout for **repeatable labels**; **plain sans** for variable text (dialogue, stats). That split is the usable rule.

Sutoh (CEDEC): concept is **pop-punk** — mass-readable **and** anti-grid.

**Do not:** ship Atlus/P5 font files, “P5 Optima” as a brand claim, or letter-by-letter logo clones. **Do:** one loud display treatment for **short labels**; one quiet sans for **reading**.

---

## 5. Motion: what moves vs what stays still

| Moves (A/B, plus C inferred from stills) | Stays still |
| --- | --- |
| **Entry:** UI **pops with no lag** (Sutoh: resident-memory GUIs). Menu **3D figure** travels, then **holds a pose** | Crimson **field** once the overlay is up — a flat fill, not a living 3D room |
| **Hierarchy:** layout **angle** and **lighting** change when going deeper; high-priority regions get **higher luminance** | **Sentence text** inside a balloon (Hashino: they reduced unreadable diagonals) |
| **Attention:** white **gaze line** in menus; battle UI **explodes** around the character (widely documented; not SNS) | Paper-like balloon **fills** after they land — no idle wobble required |
| **SNS thread (B/C, under-documented by staff):** new balloons / choice stacks **arrive in sequence**; badges **offset-pop**; reply bars **stack** | Date/IM chrome can **hold** while messages append |
| Hashino: early motion was **too aggressive**; they **calmed** it | Continuous pulse/shake is the failure mode they already rejected |

Fan recreations (D) describe a **“slammed onto the screen”** clip-path overshoot. Use that only as a **metaphor** for a short ease-out; it is not an official spec.

Hashino (A9VG): opening the UI should feel like putting on headphones in a dull street — **a contrast of energy**, not a second loading screen.

---

## 6. Iconic system vs copyrighted costume

**Iconic (evoke):**

- One **harsh red** field + **black/white** paper
- **Skewed polygons**, triangular tails, **offset** speaker badges
- **Hard** shadows / sticker outlines
- **Collage** labels; **quiet** body type
- **Pop-punk** contrast: lively chrome, readable content
- Gaze/priority via **line, angle, luminance**, not a rainbow of status colors

**Costume (do not copy):**

- Soejima **character portraits**, Phantom Thieves **logo**, calling-card **word-as-asset**, **Joker** menu model
- Atlus / Persona / “Take Your Heart” **wordmarks**
- **Sakura petals**, prison **chains** as decoration, official **title treatments** as UI chrome
- Game **font files**, ripped **IM textures**, unused **LINE stamps**, in-game **screenshots** as product skin
- Phantom Life **illustrations** (knives, skyline, specific Mementos title lockup)

Mementos **the place** (black, chains, “Everyone’s Palace”) is a **different costume** from SNS **the chat**. Borrow **one** at a time.

---

## 7. Evoking this in a research-notebook product (without a P5 clone)

The app’s design constitution is **light paper, cherry as attention, hierarchy over containers**. A full-time crimson OS would violate that and Hashino’s own “too much diagonal” lesson.

**Applied decision:** destination **canvases** (Knowledge Base, Deep Research trace) *are* the IM room; the sidebar stays paper. Tokens and components: [`docs/mementos-art-style.md`](../mementos-art-style.md). Do not paint the nav crimson.

Use the SNS system as a **mode**, not a skin:

| Notebook job | SNS grammar to borrow | What to refuse |
| --- | --- | --- |
| Archive chat / RAG thread | Optional **crimson session field** or a **single skewed transcript column**; black/white **polygons** for turns; **offset initial-badges** (letters, not faces) | Character art, “Phantom Thieves,” game fonts |
| Citations / sources | Numbered **sticker chips**; selected source = **hard offset outline**, not a red card wall | Ransom-note on every filename |
| Composer / send | One **skewed primary bar**; Enter stays a normal text control (untransformed caret) | Skewed textarea text |
| Status (searching, insufficient evidence) | Short **outlined label** + plain helper (see companion verbal note) | Lore-only labels |
| Rest of app | Keep **matte paper**; cherry only on active/selected | Full-bleed red chrome, sakura, menus that shout on every page |

**Stamp language in product terms:** treat **send, cite, claim, and speaker** as **pasted labels** (outline + offset). Do not add emoji sticker packs that mimic P5/LINE.

**Accessibility:** Sutoh already used **luminance and line** because red is a bad-only signal. Keep body type unskewed; honor `prefers-reduced-motion` with a static collage (Hashino already toned motion down).

---

## 8. Transferable rules (implementer)

1. **Three inks:** crimson field, black paper, white paper. Yellow or cyan only as a **badge or meter**, never as a second theme.
2. **Flat paint:** fills, not gradients (Sutoh).
3. **Polygons, not pills:** parallelograms / jagged quads; **triangular** tails; **no** iMessage radii.
4. **Speaker = offset badge** overlapping a corner, slightly rotated — initials or a generic mark, **not** a portrait.
5. **Polarity:** other = dark balloon/light type; self = light balloon/dark type.
6. **Sticker depth:** 1–2 px-feel **hard** offset shadow; no soft blur.
7. **Type split:** collage/outline **only** on short chrome; **upright sans** for anything longer than a label.
8. **Skew the container, not the sentence.** If type leans, keep it mild (Hashino).
9. **Motion is arrival, then stillness.** Slam/overshoot once per new object; field and body text hold. No idle pulse.
10. **Red is a room you enter** (chat/research session), not the OS. Paper remains the notebook.
11. **Priority without extra hues:** brighter region, white edge, or a line — matching CEDEC gaze/lighting.
12. **Never ship:** portraits, logos, Atlus fonts, petal FX, ripped HUD, LINE/P5 stamps, or letter-perfect calling-card titles.

---

## Sources

1. Atlus — [Persona 5 Web Manual (PS4)](https://atlus.com/persona5/manual/); IMs page: [manual UI `?pid=21`](https://atlus.com/persona5/manual/ps4/?pid=21); image: [022.jpg](https://atlus.com/persona5/manual/ps4/img/022.jpg) (Conversation/Map: [020.jpg](https://atlus.com/persona5/manual/ps4/img/020.jpg); Mementos flow: [028.jpg](https://atlus.com/persona5/manual/ps4/img/028.jpg))
2. Atlus — [Phantom Thief Life](https://atlus.com/persona5/phantom-life.html); Mementos assets: [bg](https://atlus.com/persona5/img/phantom-life/section_8_bg.png), [info](https://atlus.com/persona5/img/phantom-life/section_8_info.png), [title](https://atlus.com/persona5/img/phantom-life/section_8_title.png)
3. Atlus — [Persona 5 Royal site](https://persona.atlus.com/p5r/)
4. Famitsu — [CEDEC+KYUSHU 2017: Sutoh & Wada on Persona UI](https://www.famitsu.com/news/201711/13145540.html) (color → logo → key font; no sub-color except HP/MP; pop-punk; gaze line; luminance; 3D menu model)
5. Persona Central — [English report of the same CEDEC panel](https://personacentral.com/persona-5-panel-concept-development-ui/)
6. Siliconera — [CEDEC summary](https://www.siliconera.com/atlus-reveals-design-secrets-behind-persona-5s-distinctive-ui/) (white side = relevant info; angle/contrast for hierarchy)
7. Persona Central / Play-Asia — [Famitsu #1449 Sutou interview](https://personacentral.com/persona-5-interview-ui-design-sound-music/) (crimson + black/white type; no gradations; instant menus). Mirror: [SEGAbits](https://segabits.com/blog/2016/09/12/extensive-famitsu-interview-persona-5-art-audio-leads/)
8. Eurogamer — [Hashino on menus, pop-punk, calmed diagonals, phone as social layer](https://www.eurogamer.net/lets-talk-about-persona-5s-menus) ([archive](https://web.archive.org/web/20170419150605/http://www.eurogamer.net/articles/2017-04-19-lets-talk-about-persona-5s-menus))
9. A9VG — [Hashino: UI designed around “Pop Punk”; inner wild UI vs dull streets](https://www.a9vg.com/article/28361)
10. PlayStation Universe — [Hashino on red as harsh primary color](https://www.psu.com/news/persona-5-details-if-youve-played-p3-and-p4-you-should-feel-right-at-home/)
11. The Verge — [cutout / ransom-note menus](https://www.theverge.com/2017/4/4/15177098/persona-5-style-fashion-design)
12. Kinga Olszewska — [UI analysis: black/white as the working sub-colors; cutout vs plain sans; magenta/turquoise stats](https://medium.com/@kinga.olszewska/interface-so-good-that-people-make-cosplay-of-it-persona-5-ui-controversial-yet-brilliant-ac1ec4b95229)
13. Andre Rodrigues — [IM messenger in the time loop; dungeon black speech bubbles; motion as attention](https://ousiadroid.medium.com/what-you-can-learn-from-persona-5s-ui-design-4a4a646245b1)
14. Game UI Database — [Persona 5](https://www.gameuidatabase.com/gameData.php?id=72), [Royal](https://www.gameuidatabase.com/gameData.php?id=618) (screenshot index; not a license to copy pixels)
15. Megami Tensei Wiki — [P. A. D.](https://megamitensei.fandom.com/wiki/P._A._D.) (device + SNS screenshot)
16. P5R JP wiki — [SNS・怪盗ch](https://wikiwiki.jp/persona5r/SNS%E3%83%BB%E6%80%AA%E7%9B%97ch) (50-message cap, photos, non-freeform chat)
17. TCRF — [Persona 5 Royal unused graphics / Showtime Stickers](https://tcrf.net/Persona_5_Royal/Unused_Graphics) (LINE-origin stamps largely unused)
18. Cook & Becker — [key color + loud UI as youth energy](https://www.cookandbecker.com/en/article/137/persona-5-s-bombastic-art-direction.html) (secondary)

**Gaps:** No Atlus-published hex palette or SNS motion spec. No Soejima art-book chapter that constructs the IM overlay. Motion of the chat thread is inferred from stills + Hashino’s general “messages/animation” comments, not a Sutoh SNS reel.
