### Design Constitution v1.0

*A design manifesto for humans and AI agents. This document defines principles, not pixels. When in doubt, follow the philosophy over the implementation.*

---

# 1. North Star

The interface should feel **smart before beautiful**.

Beauty emerges from restraint, hierarchy, and clarity—not decoration.

A user should never stop to understand the interface. Their attention belongs on their task.

The ideal reaction is not:

> "This UI is gorgeous."

It is:

> "This just makes sense."

Every design decision should reduce friction, increase confidence, and quietly communicate craftsmanship.

---

# 2. Core Values

## Restraint

Nothing exists solely because it can.

Every border.
Every icon.
Every shadow.
Every animation.
Every card.

must justify its existence.

If removing something makes the interface clearer, remove it.

---

## Hierarchy over Containers

Spacing, typography, alignment, and scale create hierarchy.

Containers exist only when information truly becomes a separate object.

Avoid "dashboard soup."

Prefer

```
Title

Subtitle

Content

Action
```

instead of

```
┌───────────────┐
│ Title         │
│ Subtitle      │
│ Content       │
└───────────────┘
```

unless that card represents a genuinely independent entity.

---

## Calm Confidence

The interface never shouts.

No bright gradients.
No oversized shadows.
No dramatic contrast.

Everything should feel intentional.

---

## Intelligence

The UI should appear designed by engineers who appreciate design—not designers trying to imitate engineering.

Precision.

Consistency.

Predictability.

---

# 3. Visual Language

## Theme

Light-first.

Dark mode is a reinterpretation—not an inversion.

The light experience defines the identity.

---

## Materials

Primary material:

> Matte paper.

Surfaces should feel clean, soft, and tangible.

Secondary material:

> Frosted glass.

Glass is reserved for floating elements:

* navigation
* command palette
* modal dialogs
* overlays
* floating controls

Never use glass as the default card style.

Glass is an accent.

---

## Color Philosophy

Almost monochrome.

The interface should remain beautiful with saturation removed.

Use color only when it carries information.

Accent:

Cherry red.

The accent exists to direct attention—not decorate.

It appears on:

* active state
* selected items
* primary actions
* focused controls
* small highlights

Not:

* large backgrounds
* giant buttons
* decorative gradients

---

## Contrast

Prefer subtle contrast over hard borders.

Instead of

black on white

prefer

charcoal on warm white.

---

# 4. Typography

Typography carries the hierarchy.

Not containers.

Not color.

Not icons.

Reading should feel effortless.

---

Rules:

Large headings are confident.

Body text is calm.

Line length remains comfortable.

Avoid excessive font weights.

Most UI should live between:

Regular

Medium

Semibold

Reserve bold for exceptional emphasis.

---

# 5. Spacing

Whitespace is an interface element.

Do not compress layouts merely to fit more information.

Every section should have room to breathe.

Grouping is created through proximity.

Not boxes.

---

Rhythm should feel like:

```
Section

    Heading

    Description

    Content

Next Section
```

not

```
Everything

Touches

Everything
```

---

# 6. Geometry

Mixed corner radii.

Large surfaces:

soft.

Buttons:

moderately rounded.

Inputs:

slightly tighter.

Floating elements:

most rounded.

The geometry should imply function.

---

# 7. Motion

Motion rewards interaction.

It never demands attention.

Animations should communicate:

state

intent

continuity

never spectacle.

---

Everything moves:

slightly slower than expected

slightly smoother than expected

slightly less than expected

---

Preferred animations:

fade

scale

blur

elevation

soft slide

Never:

bounce

elastic

overshoot

dramatic rotations

attention-seeking effects

---

# 8. Elevation

Use depth sparingly.

The interface is mostly flat.

Elevation appears only when interaction requires it.

Hover:

small lift.

Modal:

clear lift.

Navigation:

slight floating.

Avoid stacked shadows.

---

# 9. Components

## Buttons

Look touchable.

Not loud.

Primary buttons earn attention through placement—not saturation.

---

## Cards

Cards represent objects.

Not sections.

If the content can simply live on the page—

do not create a card.

---

## Forms

Simple.

Generous spacing.

Clear labels.

Minimal borders.

Focus states should be obvious.

---

## Tables

Prefer whitespace.

Avoid excessive separators.

Readable before beautiful.

---

## Navigation

Navigation should disappear mentally after first use.

It is infrastructure.

Not decoration.

---

# 10. Icons

Icons support text.

They do not replace text.

Avoid icon-only interfaces unless universally understood.

Icon size remains visually secondary.

---

# 11. Empty Space

Do not fear unfinished-looking layouts.

Space creates confidence.

Crowding creates anxiety.

A slightly sparse interface feels premium.

A slightly crowded interface feels rushed.

---

# 12. Glass Usage

Glass should create moments.

Examples:

floating navbar

search palette

quick actions

popover

context menu

Never cover the entire application in blur.

Glass loses value when overused.

---

# 13. Information Architecture

Ask before adding another visual container:

> Is this actually a different thing?

If not—

use spacing.

Ask before adding another section:

> Does the user need this distinction?

If not—

merge it.

The interface should feel edited.

Not assembled.

---

# 14. Accessibility

Beauty never overrides usability.

Readable contrast.

Visible focus states.

Keyboard navigable.

Motion respects reduced-motion preferences.

Interactive elements remain comfortably clickable.

Nothing relies solely on color.

---

# 15. Anti-Patterns

Never generate:

* unnecessary cards
* decorative gradients
* random accent colors
* inconsistent spacing
* excessive shadows
* floating buttons everywhere
* giant rounded pills
* unnecessary dividers
* borders around everything
* nested cards
* unnecessary icons
* decorative illustrations without purpose
* more than one visual focal point per screen
* visual noise disguised as modern design

---

# 16. Decision Hierarchy

When making design decisions, follow this order:

1. Does this improve understanding?
2. Does this reduce cognitive load?
3. Does this simplify the interface?
4. Does this improve hierarchy?
5. Does this improve consistency?
6. Does this feel calm?
7. Does this feel premium?
8. Does it look beautiful?

Beauty is the outcome—not the objective.

---

# 17. The Litmus Test

Before shipping any screen, ask:

* Could I remove one component?
* Could two sections become one?
* Could spacing replace a border?
* Could typography replace another heading?
* Could one accent color do the work of three?
* Does motion teach something?
* Does every visual element have a reason to exist?

If the answer is "yes," simplify.

---

## Final Principle

> **The interface should feel inevitable.**

Nothing appears arbitrary. Every choice feels like the only reasonable choice. Users shouldn't notice the design—they should notice how little they have to think. That is the highest compliment this design system can receive.
