# Design system

Two visual languages, because two audiences.

The public site is an editorial corporate experience. The CMS is a dense
operational tool. They share a monorepo and almost nothing else, and trying to
make one system serve both would compromise both.

---

## The public site

### The premise

The consumer brand says _come and eat with us_. The corporate brand says _look at
what we are building_. Everything below follows from that.

### Colour

White dominant, charcoal secondary, Cheezious yellow as a controlled accent.

- **Paper** `#FBFAF7` — off-white rather than pure white. Large areas of `#FFF`
  glare, and the slight warmth reads as considered rather than unfinished.
- **Ink** `#14140F` — charcoal rather than black. True black against off-white is
  harsh at display sizes, and charcoal holds photographic detail in dark bands.
- **Brand** `#F2C230` — the Cheezious yellow, for accents and deliberate emphasis
  only. A page covered in yellow reads as a promotion, not as a company.
- **Signal** — success, warning, danger and info, tuned to the palette rather
  than borrowed from a framework.

### Type

One grotesque across display and body. The distinction is made through size,
weight and measure rather than through a second typeface, which keeps the system
coherent and one font file lighter.

Sizes are a fluid `clamp()` scale: the middle term is viewport-relative, so a
display headline scales continuously instead of jumping at breakpoints. Display
tops out around 96px on a wide screen and stays readable at 390px. Body copy is
18–20px; long-form editorial is a step larger again, because a newsroom article
is read rather than scanned, and a narrow measure at 16px is the single most
common reason a corporate article does not get finished.

The Urdu face is set separately, because a Latin grotesque does not render
Nastaliq.

### Layout

A 12-column grid with a fluid gutter, so the side margin grows with the viewport
instead of jumping at breakpoints, and never drops below 16px on a phone.

Four content widths: narrow (reading measure, around 68 characters), standard,
wide and full. Sections declare a width and a tone; blocks do not position
themselves.

### Restraint

- Radii are small and used sparingly. A corporate site is not a product tour.
- No endless card grids. Where a listing needs rhythm, it gets an editorial
  layout — a feature, then a row, then a list — rather than twelve identical
  boxes.
- Motion is short and functional: image reveals, a header that changes on scroll.
  Nothing that delays reading.
- Images honour an editor-set focal point, so a portrait cropped to a wide banner
  keeps the subject's face in frame rather than centring blindly.

### Influences, and what was taken

Aramco, McDonald's Corporate, KFC Global, Adobe, Porsche and DoorDash were
studied for _what they solve_: institutional scale and data presentation,
corporate-versus-consumer separation, global navigation depth, structured
editorial density, restraint and photographic confidence, operational clarity.

None of their layouts, copy, assets, illustrations or animation sequences are
reproduced. What is shared is a set of problems, not a set of solutions.

---

## The CMS

### Carbon's principles, not Carbon's pixels

IBM Carbon is the reference for productive interface design: high density,
square corners, a fixed dark global header, a productive type scale and an 8px
spacing grid. The implementation is this codebase's own.

### Density

An operational tool is used for hours. The type scale is small and the spacing
tight, because the alternative is scrolling — and scrolling is what makes a queue
of forty applications feel like work.

### Colour

A neutral Gray 10 ramp with a single interactive blue. Status colour is reserved
for status: a tag is coloured because a record is in review, never for
decoration.

### Labels over icons

Controls are labelled. An icon-only interface requires hovering to discover what
a control does, which is fine for a tool used daily by five people and wrong for
one used weekly by fifty.

### What the interface does not decide

The CMS shows or hides controls based on permissions as a courtesy, so nobody is
offered a button that will refuse them. It is not a security control; the API
checks every one of those permissions independently.

---

## Rules that apply to both

**Zoom is never capped.** Limiting it locks out anyone who needs to magnify text.
Layouts reflow rather than depending on a fixed scale.

**Every interactive element has an accessible name.** Where a control is an icon
or a coloured tag, the name is in an `sr-only` span.

**Focus moves where the user does.** Dialogs take focus when they open, because
WAI-ARIA asks for it and without it a keyboard user is left behind the overlay.
Full-page forms do not, because moving focus on page load interrupts a screen
reader part-way through announcing the page.

**Colour is never the only signal.** Status carries a word as well as a colour.

**Right-to-left is a direction, not a mirror.** Logical properties
(`ps`/`pe`, `ms`/`me`, `start`/`end`) are used throughout, so Urdu is genuinely
right-to-left rather than English text flipped.
