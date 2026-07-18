---
name: ui-design-system
description: >
  UI/UX design system and revamp specification for the IEEE SB UoM Volunteer Management System.
  Triggers on any task involving UI changes, styling, component edits, CSS, layout, visual design,
  color, typography, navigation, forms, cards, buttons, badges, animations, or page structure.
  Contains the complete design philosophy, token system, component specs, and file-level implementation
  map for the "Crafted Institutional" revamp. Must be followed for ALL UI changes to ensure the entire
  system stays visually consistent.
---

# UI Design System — IEEE SB UoM Volunteer Management

> This skill contains the authoritative design context for all UI work on this project.
> Read and follow it in full before making any UI change.
> Full reference: `.agents/skills/ui-design-system/references/ui_ux_agent_context.md`

---

## Quick Identity Rules

1. **Design language:** "Crafted Institutional" — serious, trustworthy, human. Not a SaaS template.
2. **Reference products:** Linear (density + micro-interactions), Notion (typography), GitHub (semantic status), Stripe Dashboard (data density).
3. **Font:** Inter (Google Fonts, weights 400/500/600/700). **Never use system fonts.**
4. **Backend is off-limits.** Only touch: CSS, TSX component classes, layout structure, animation, and purely visual logic. Do not touch server actions, API routes, types, or validation.

---

## Color Tokens (CSS Custom Properties)

All colors live in `src/app/globals.css`. Use these variable names in all Tailwind classes.

```
Primary:
  --primary:         hsl(216, 79%, 36%)   /* IEEE blue */
  --primary-hover:   hsl(216, 79%, 28%)
  --primary-soft:    hsl(216, 80%, 97%)
  --primary-mid:     hsl(216, 60%, 92%)

Surfaces (3-level depth):
  --bg-base:         hsl(220, 16%, 96%)   /* page background */
  --surface-raised:  hsl(0, 0%, 100%)     /* cards, panels */
  --surface-overlay: hsl(0, 0%, 100%)     /* modals, dropdowns */

Borders (3 intensities):
  --border-subtle:   hsl(220, 13%, 91%)
  --border-default:  hsl(220, 13%, 84%)
  --border-strong:   hsl(220, 13%, 72%)

Text (4 levels):
  --text-strong:     hsl(220, 26%, 14%)   /* headlines */
  --text-body:       hsl(220, 14%, 32%)   /* body copy */
  --text-muted:      hsl(220, 10%, 52%)   /* helper text */
  --text-placeholder:hsl(220, 8%,  68%)   /* input placeholder */

Semantic:
  --success:        hsl(142, 52%, 28%)  --success-soft: hsl(142, 60%, 96%)
  --warning:        hsl(38,  90%, 30%)  --warning-soft: hsl(40, 100%, 96%)
  --danger:         hsl(0,   68%, 40%)  --danger-soft:  hsl(0, 80%, 97%)
  --neutral:        hsl(220, 10%, 50%)  --neutral-soft: hsl(220, 12%, 94%)

Leaderboard:
  --gold:   hsl(43,  90%, 48%)
  --silver: hsl(220, 10%, 62%)
  --bronze: hsl(20,  65%, 48%)
```

---

## Design Tokens

```
Border radius:
  --radius-sm:  4px    (badges, chips)
  --radius-md:  8px    (cards, buttons, inputs)
  --radius-lg: 12px    (modals, large panels)
  --radius-xl: 16px    (login card)

Shadows (3 levels):
  --shadow-sm:      0 1px 2px hsl(220 26% 14% / 0.04), 0 1px 3px hsl(220 26% 14% / 0.06)
  --shadow-md:      0 4px 6px hsl(220 26% 14% / 0.05), 0 2px 4px hsl(220 26% 14% / 0.06)
  --shadow-lg:      0 10px 15px hsl(220 26% 14% / 0.07), 0 4px 6px hsl(220 26% 14% / 0.05)
  --shadow-overlay: 0 20px 25px hsl(220 26% 14% / 0.1), 0 8px 10px hsl(220 26% 14% / 0.06)

Transitions:
  --transition-fast:   100ms ease
  --transition-base:   150ms ease
  --transition-smooth: 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Typography Scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| section-title | 22px | 700 | PageHeader h2 |
| card-title | 15px | 600 | CardTitle |
| body-lg | 15px | 400 | Lead text |
| body | 14px | 400 | Default |
| body-sm | 13px | 400 | Table cells, secondary |
| label | 12px | 600 | Form labels |
| caption | 11px | 500 | Timestamps, eyebrow text (+ tracking-widest if ALL CAPS) |

---

## Component Contracts

### Button
- **3 existing variants:** primary / secondary / ghost  
- **New variant:** danger (red bg, white text)
- Height: 36px | Padding: 0 14px | Font: 13px/500 | Radius: 8px
- Primary: box-shadow with blue glow | active: translateY(1px)
- Secondary: white bg, border-default, shadow-sm
- All: transition-smooth, cursor-pointer

### Badge
- Height: 22px | Radius: 4px | Font: 12px/500
- **5 tones:** neutral / primary / success / warning / danger
- Each tone has a **3px solid left-border** in its main color
- **New prop:** `size="lg"` (28px, 14px) for leaderboard rank badges

### Card
- Border: border-subtle | Shadow: shadow-sm | Radius: 8px
- Navigable cards: `hover:translate-y-[-1px] hover:shadow-md` (lift effect)
- **New variant:** `highlight` — left 4px primary border + subtle blue-white gradient bg

### Form Inputs
- Height: 38px | Padding: 0 12px | Font: 14px | Radius: 8px
- Focus: border-primary + `box-shadow: 0 0 0 3px hsl(216 79% 36% / 0.12)`
- Error: border-danger + `box-shadow: 0 0 0 3px hsl(0 68% 40% / 0.10)`

### Tables
- `<thead>` bg: bg-base (slightly off-white) with border-bottom: border-default
- `th` text: 11px / 600 / uppercase / tracking-wide / text-muted
- `tr` hover: bg-primary-soft (very subtle blue)
- `td` padding: 12px 16px | font: 13px | text-body

### AppShell / Navigation
- **Recommended:** Left sidebar (240px fixed, white bg, border-right: border-subtle)
- Nav items: 40px height, 18px icon, active = bg-primary-mid + text-primary
- Brand at top, user identity + sign-out pinned at bottom
- Admin section: labeled "ADMINISTRATION" separator
- Content area: margin-left: 240px

### Notification Bell Dropdown
- 360px wide | Radius: 12px | Shadow: shadow-overlay
- Unread item: bg-primary-soft + 3px left border primary
- Entry animation: scale(0.97→1) + opacity(0→1), 150ms, origin: top-right
- Unread dot: CSS pulse animation on bell icon

### Login Page
- Left panel: deep blue gradient `linear-gradient(145deg, hsl(216,79%,28%), hsl(216,79%,18%))`
- Right panel: white, Google "G" SVG logo inline in button
- Card: shadow-overlay, radius-xl (16px)
- Page bg: subtle radial gradient

### Scoring / Leaderboard
- Top 3: gold/silver/bronze card treatment with rank-colored borders + large score numbers
- Point changes: green for positive, red for negative, monospace font
- Use `--gold`, `--silver`, `--bronze` tokens

---

## Interaction Patterns

- **Card hover:** `translateY(-1px)` + shadow increase, 200ms
- **Button press:** `scale(0.99)` on mousedown
- **Modal entry:** `scale(0.96→1)` + `opacity(0→1)`, 150ms
- **Focus ring:** `box-shadow: 0 0 0 3px primary/12%` — never a harsh outline
- **Skeleton pulse:** `animate-pulse` at 1.5s duration; shapes must match real content

---

## What NOT to Touch

| Directory / Pattern | Reason |
|---|---|
| `src/features/*/server/` | Server-side logic |
| `src/app/api/` | API route handlers |
| `**/actions.ts` | Server actions |
| `**/types.ts` | Type definitions |
| `**/validation.ts` | Zod schemas |
| `src/server/` | Core server utilities |
| `src/lib/` (except event-ui.ts) | Utilities |

---

## Execution Priority (when implementing)

1. `src/app/globals.css` — new token values + Inter font
2. `src/app/layout.tsx` — Google Fonts link
3. `src/components/ui/button.tsx` + `card.tsx` + `badge.tsx` — primitive components
4. `src/components/layout/app-shell.tsx` — navigation (highest surface area)
5. `src/components/layout/page-header.tsx` — used on every page
6. `src/features/events/lib/event-ui.ts` — form input/textarea classes
7. `src/app/login/page.tsx` — first impression
8. Event feature components (EventList, EventDetail, CommitteeManagement)
9. `src/features/notifications/components/notification-bell.tsx`
10. `src/features/scoring/components/scoring-dashboard.tsx`
11. Profile, dashboard page, admin pages, loading skeleton

---

## Microcopy Guidelines

- **Never**: "Branch events and their lifecycle status." → dry, schema-like
- **Always**: "All IEEE SB UoM events, from draft to conclusion." → clear, human
- Form labels: Title Case, NOT ALL CAPS
- Eyebrow text: ALL CAPS + tracking-widest (this is the *only* place caps are used)
- Button text: Sentence case only. Never uppercase buttons.
- Empty states: Explain what will appear here + provide an action when applicable
- Error messages: Specific. "Event title is required." not "Invalid input."

---

> **For full detailed specs** (all component measurements, animation curves, responsive breakpoints,
> page-by-page redesign instructions, before/after microcopy tables, accessibility checklist):
> Read `.agents/skills/ui-design-system/references/ui_ux_agent_context.md`
