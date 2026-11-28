---
name: Traflinq
description: The operating system for corporate mobility. Portals for company admins, Traflinq operations and vendors.
colors:
  coral: "#e2622a"
  coral-dark: "#e8692e"
  coral-ink: "#b34a17"
  coral-ink-dark: "#f2905f"
  coral-soft: "#fdeee5"
  coral-line: "#f7c7ab"
  action-fill: "#c24b17"
  action-fill-hover: "#ad4314"
  action-fill-dark: "#c44d18"
  frame: "#ebebed"
  frame-dark: "#161616"
  page: "#f7f7f8"
  page-dark: "#0b0b0b"
  card: "#ffffff"
  card-dark: "#141414"
  elevated-dark: "#1c1c1c"
  ink: "#18181b"
  ink-dark: "#ededed"
  ink-secondary: "rgba(24,24,27,0.74)"
  ink-muted: "#63636b"
  ink-muted-dark: "rgba(237,237,237,0.55)"
  line: "rgba(24,24,27,0.09)"
  line-strong: "rgba(24,24,27,0.15)"
  line-dark: "rgba(255,255,255,0.08)"
  subtle: "rgba(24,24,27,0.045)"
  subtle-dark: "rgba(255,255,255,0.045)"
  success-ink: "#15803d"
  success-soft: "#edf9f1"
  warning-ink: "#a75a00"
  warning-soft: "#fdf6e3"
  danger-ink: "#c8333a"
  danger-soft: "#fdeeee"
  series-indigo: "#6e7ff0"
  series-indigo-dark: "#7d8cf5"
  series-green: "#2a9f59"
  series-green-dark: "#38b56a"
typography:
  page-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
rounded:
  badge: "6px"
  control: "8px"
  tile: "10px"
  card: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.action-fill-hover}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  icon-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.tile}"
    size: "36px"
  nav-item:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.tile}"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.coral-ink}"
  badge:
    rounded: "{rounded.badge}"
    padding: "0 8px"
    height: "22px"
---

# Design System: Traflinq

## Overview

**Creative North Star: "The Control Room"**

Traflinq is the screen a transport manager keeps open all day: calm, dense and trustworthy, so the one thing that needs attention is impossible to miss. Neutral zinc surfaces carry the work. A single coral accent is reserved for action, for the current place in the app, and for money found. Figures come before decoration; structure (borders, tiles, grids) does the organising, not colour or shadow.

The system is quiet and precise. Surfaces are flat with hairline borders and gain depth by tone, not by lifting. Every portal shares one component library (`app/admin/ui`) and one token set, applied to the company portal (`.company-portal`) and the Super Admin, its sign-in pages and the vendor portals (`.admin-portal`). Both themes are first-class and tuned separately, not inverted. One theme setting covers the whole app (every portal and the sign-in pages), and it defaults to dark.

The layout follows the HorizonHub reference the team chose: an open sidebar on a grey frame, the page in one rounded panel, the top bar inside that panel, icon tiles in card headers, grey bars with the focused bar in colour, and dark tooltips.

**Key Characteristics:**
- Zinc neutrals with one coral accent; semantic colours only for state.
- Frame + panel shell: sidebar on the frame colour, content in a rounded, bordered panel that scrolls on its own.
- Flat, bordered surfaces; tonal layering instead of shadows.
- Small, consistent radii: 8px controls, 10px tiles, 14px cards, 16px panels.
- Geist throughout; tight, fixed type scale; figures with their units set smaller and muted.
- Hugeicons Stroke Rounded for every icon, through one shared file.

## Colors

One warm accent on cool-neutral zinc, with a validated chart series and a reserved status palette.

### Primary
- **Signal Coral** (`coral`, `coral-dark`): the brand accent. Active navigation icons, focus rings, the "optimised route" on the sign-in map, progress fills, the first chart series and the busiest-day highlight. Never body text on white: it is only 3.5:1 against white.
- **Coral Ink** (`coral-ink`, `coral-ink-dark`): the accent as text: active nav labels, links, brand badges.
- **Ember Fill** (`action-fill`, `action-fill-hover`, `action-fill-dark`): the solid fill behind white text on primary buttons, darkened from Signal Coral to reach 4.75:1 or better with white.
- **Coral Wash** (`coral-soft`, `coral-line`): tinted backgrounds and borders for brand badges and selected states.

### Secondary
- **Route Indigo** (`series-indigo`, `series-indigo-dark`): the second chart series. On the company dashboard it always means shuttle trips (coral means chauffeur rides), so do not use it for unrelated data.
- **Route Green** (`series-green`, `series-green-dark`): the third chart series.

### Neutral
- **Frame Grey** (`frame`, `frame-dark`): the shell frame behind the sidebar and around the content panel.
- **Panel** (`page`, `page-dark`): the content panel and page background.
- **Card White / Card Black** (`card`, `card-dark`; `elevated-dark` for menus and dialogs in dark): card, input and tile surfaces.
- **Ink** (`ink`, `ink-dark`), **Secondary Ink** (`ink-secondary`), **Muted Ink** (`ink-muted`, `ink-muted-dark`): primary text, secondary text, labels and captions. Muted ink still clears 4.5:1 on its surface.
- **Hairline** (`line`, `line-dark`, `line-strong`): every border and divider.
- **Subtle** (`subtle`, `subtle-dark`): hover fills, segmented-control tracks, empty progress segments.

### Status
- **Success / Warning / Danger** (`success-ink` + `success-soft`, `warning-ink` + `warning-soft`, `danger-ink` + `danger-soft`): state only (completed, due soon, overdue, over budget), always with an icon or label beside the colour. Dark-mode equivalents live in `app/globals.css` (`--tone-*`).

### Named Rules
**The One Accent Rule.** Coral marks action, location and money found. If coral appears on something that is none of those, remove it.

**The Entity Colour Rule.** A colour that means something on a screen keeps that meaning everywhere on it: if indigo is shuttle in the chart, it is not also a department bar.

**The Status Is Reserved Rule.** Green, amber and red are never chart series or decoration; they report state and come with words.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui)
**Body Font:** Geist (one family for the whole product)
**Label/Mono Font:** Geist Mono, only for keyboard hints and codes
**Arabic:** Noto Sans Arabic, applied in RTL

**Character:** One neutral, well-drawn sans carries everything, from page titles to table cells. Hierarchy comes from weight and size in small steps, never from a second display face.

### Hierarchy
- **Page title** (600, 1.25rem on phones and 1.5rem from `sm`, -0.015em): one per page, in the page header.
- **Figure** (600, 1.5rem, -0.015em): headline numbers in KPI tiles and chart totals. Trailing units ("M", "%", "km/L") render at 0.6em in muted ink (`Figure` component).
- **Title** (600, 0.875rem): card titles.
- **Body** (400, 0.875rem, 1.45): table cells, list rows, form text.
- **Label** (500, 0.8125rem): KPI labels, form labels, nav items (0.875rem).
- **Caption** (400, 0.75rem): card descriptions, hints, deltas, axis ticks.

### Named Rules
**The Units Step Back Rule.** In a headline figure, the number is the information; its unit is smaller and muted.

**The Sentence Case Rule.** Labels, group names, buttons and titles are sentence case. No uppercase eyebrows above headings.

## Layout

The desktop shell is a frame with one panel. The sidebar (240px open, 64px collapsed, remembered per browser) sits directly on the frame colour; the content is a single panel with a 16px radius and a hairline border, inset 8px from the frame, and on desktop that panel is the scroll container, so the sidebar and the 64px top bar stay put. On phones the sidebar becomes a drawer, the panel loses its inset and border, and the window scrolls.

Page content is capped at 1400px (company) or 1600px (Super Admin) with 16px side padding on phones and 24-32px on desktop. Sections stack with 24px gaps; cards inside a section sit 16px apart.

Dashboards use a 3-column grid from `lg`: wide cards span 2 columns beside a 1-column companion, rows fill left to right, and no card sits next to an empty cell. Order follows the product's priorities: headline figures, then savings and what needs attention, then live operations, then this month, trends, and people.

Sign-in pages split the screen: a route-map panel (46%, max 672px) and the form, with a round theme switch in the top corner; on phones a 160px band of the map sits above the form.

## Elevation & Depth

Flat at rest. Depth comes from tonal layering (frame, panel, card, elevated) and hairline borders, not shadows. The only resting shadow is a 1px whisper on light-theme cards and controls; dark cards have none.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgba(24,24,27,0.04)`): light-theme cards and inputs.
- **Card hover** (`box-shadow: 0 4px 12px rgba(24,24,27,0.08)`): clickable cards only, on hover.
- **Active nav chip** (`box-shadow: 0 1px 2px rgba(24,24,27,0.06), 0 0 0 1px rgba(24,24,27,0.06)`; dark `0 0 0 1px rgba(255,255,255,0.08)`): the raised chip under the current page.
- **Overlay** (`box-shadow: 0 24px 48px rgba(24,24,27,0.16)`; dark `0 24px 64px rgba(0,0,0,0.7)`): dialogs, drawers, menus and chart tooltips.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only for something floating (overlays) or responding to the pointer (clickable cards).

## Shapes

Gently rounded, never pill-shaped except for avatars, status dots, round top-bar buttons and small tags. Radii step up with the size of the surface: badges 6px, controls and buttons 8px, icon tiles and nav items 10px, cards 14px, the content panel and dialogs 16px. Borders are always 1px hairlines; there are no accent stripes down the side of a card. Chart bars have 4px rounded data ends and square baselines, with a 2px surface gap between stacked segments.

## Components

### Buttons
- **Character:** compact and plain; the label does the work.
- **Shape:** gently rounded (8px); heights 32px (`sm`), 36px (default), 40px (`lg`).
- **Primary:** Ember Fill with white label; hover darkens one step.
- **Outline:** card surface with hairline border; hover fills with Subtle.
- **Ghost:** no surface; secondary ink that darkens on hover.
- **Danger / danger outline:** destructive actions only.
- **Focus:** a 2px coral ring offset from the surface, keyboard only.
- **Round icon buttons** (top bars): 36px circles with a hairline border on the card surface.

### Chips / Badges
- **Style:** 6px radius, 22px tall, tinted background with matching ink and border per tone (neutral, brand, success, warning, danger, info, purple); optional leading dot.
- **Use:** status and priority, always with words.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Card White / Card Black on the panel.
- **Shadow Strategy:** Card rest in light, none in dark (see Elevation).
- **Border:** 1px hairline.
- **Header:** optional 36px icon tile (10px radius, hairline border, muted icon), then title and caption description; actions (bordered dropdowns, segmented controls) on the right; a hairline under the header.
- **Footer:** an optional "View …" link row under a hairline.
- **Internal Padding:** 16-20px.

### Inputs / Fields
- **Style:** 36px tall, 8px radius, card surface, hairline input border that strengthens on hover.
- **Focus:** border turns coral with a soft coral ring.
- **Error / Disabled:** danger border and ring; disabled at half opacity.

### Navigation
- **Sidebar:** brand mark and wordmark with a collapse button; sentence-case group labels in muted caption type; 36px items with an 18px icon in a 40px slot. The active item is a raised card-coloured chip with a coral icon and Coral Ink label. Collapsed to the rail, the logo becomes the expand button on hover.
- **Top bar:** inside the panel, 64px, translucent panel colour with blur; left holds search (Super Admin) or the company name (company); right holds round icon buttons and an avatar menu with name and role.
- **Mobile:** sidebar in a drawer; the top bar adds a menu button and the wordmark.

### Charts
- **Bars:** neutral grey, with the focused or meaningful bar in colour (busiest day in coral; hover dims the rest to 35%).
- **Series:** fixed order coral, indigo, green, purple, amber, pink; never cycled. Totals beside series swatches double as the legend.
- **Grid:** dashed recessive lines; axes without lines; 11-12px muted ticks.
- **Tooltip:** inverted against the page (near-black in light, near-white in dark), 10px radius, a 3px colour marker per series, value above its label.
- **Access:** every chart ships a visually hidden data table.

### Segmented Progress (signature)
A row of thin 3px-gapped segments: solid coral ramping up in strength to the current value, light coral for a projection, a dark segment for a target such as a budget, grey for the rest.

### Sign-in Route Map (signature)
A night-time city map drawn in SVG: the replaced route as a grey dashed line full of detours, the optimised route in coral with pickup stops and the office pin, and the branded bird's-eye shuttle (`public/login/bus_birdeye.webp`) moving slowly along the optimised route (still under reduced motion). The map is a night scene in both themes; only the form side follows the theme.

## Do's and Don'ts

### Do:
- **Do** use tokens from `app/globals.css` through the Tailwind theme (`bg-card`, `text-fg-muted`, `border-line`, `bg-brand`), never raw hex in components.
- **Do** import every icon from `app/components/icons.tsx` (Hugeicons Stroke Rounded, stroke 2).
- **Do** put an icon tile in card headers that introduce a section, and keep card corners at 14px.
- **Do** show money as full PKR amounts and set figure units smaller and muted.
- **Do** design both themes. Dark is the default everywhere, and one setting (`app/lib/theme-store.ts`) controls every portal and the sign-in pages.
- **Do** give every chart a hidden data table and every status colour a word.

### Don't:
- **Don't** use navy or blue as a surface or brand colour; the old navy (`--cort-navy`) is legacy and survives only on the root `/` page.
- **Don't** add glass panels, blurred colour glows or gradient fills inside the product UI.
- **Don't** put uppercase eyebrows or kickers above headings.
- **Don't** draw a coloured stripe down one side of a card.
- **Don't** reuse status colours (green, amber, red) as chart series or decoration.
- **Don't** add shadows to resting surfaces beyond the 1px card whisper.

---

## Appendix: marketing site (traflinq-landing-page)

Carried over from the previous version of this file. It describes the separate `traflinq-landing-page` repository and was **not re-checked against code** in this refresh; verify it there before relying on it.

- **Structure:** fixed navbar with blur on scroll; hero (full viewport, two columns, animated route map); Problem ("Corporate mobility is broken"); Route Optimization; About ("Built for institutional scale"); Team; Operational Success Reports; CTA ("Stop managing logistics and start orchestrating movement"); footer.
- **Section pattern:** uppercase eyebrow (`text-xs tracking-widest uppercase`), headline (`text-4xl sm:text-5xl font-bold`), description (`text-lg leading-8` at 45% white), then content.
- **Interactive hero map:** toggles "Before" (detours) and "Traflinq" (optimised routes); isometric city SVG with animated cars; HQ hub with zones A, B and C in orange `#fe8503`, cyan `#22d3ee` and violet `#a78bfa`; status badges "LONGER ROUTES" and "ROUTES OPTIMIZED".
- **Background effects:** 1px grid overlay at 2.5% white on a 4rem grid; blurred orange glow `#fe8503` at 6%; section dividers at 4% white; glass panels at 2% white with 6% white borders. These are marketing-only and do not apply to the product UI.
