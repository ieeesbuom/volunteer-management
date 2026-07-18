# UI/UX Revamp — Agent Context Document
### IEEE Student Branch UoM — Volunteer Management System
**Authored from a 20+ year UI/UX engineering perspective**

---

## 1. Executive Brief

This system is a **closed, role-gated web application** used by IEEE Student Branch University of Moratuwa to manage volunteers, events, committees, roles, scoring/leaderboards, and notifications. Users are real students — not anonymous visitors. The system handles consequential workflows: event creation, role assignment, grade review, conclusion approval.

The current UI is **functional but cold and machine-generated** — flat, Tailwind-utility-piled, zero personality, minimal hierarchy, and no spatial rhythm. The revamp must make it **feel like a tool that a thoughtful human built with pride** — not a SaaS boilerplate. It must read as institutional yet approachable, serious yet not sterile, and dense in capability without feeling overwhelming.

**The backend, server actions, API routes, and data logic are strictly off-limits. Only UI layer changes.**

---

## 2. Current State Audit

### 2.1 What Exists

| Layer | Current State |
|---|---|
| **Color System** | Flat IEEE blue (`#1456a3`) on gray-white. Functional but corporate and anonymous |
| **Typography** | System fonts (`Segoe UI`). No web font. Text hierarchy works but feels accidental |
| **Spacing** | Inconsistent. Some areas breathe, others are packed |
| **Navigation** | Top-bar with pill-style tab nav. Completely flat, no depth. The whole header has two stacked zones (brand + nav) that don't feel like a coherent unit |
| **Cards** | Rounded `8px`, single-layer shadow `0 1px 2px`. Looks like every other Next.js starter |
| **Buttons** | Functional. Primary = solid IEEE blue, secondary = outlined. Both feel like defaults |
| **Badges** | 5 tones (neutral, primary, success, warning, danger). Semantically correct but visually basic |
| **Forms** | Input fields borderless on sides, bottom border on focus. Functional but indistinguishable from plain HTML |
| **Tables** | `divide-y` pattern. Bare, no row hover, no alternating treatment |
| **Loading** | Skeleton pulse. Good intent, poor execution — blocks don't match actual content shapes |
| **Empty States** | Icon + p text. Minimal to the point of being invisible |
| **Login Page** | Two-panel layout. Left: brand. Right: sign-in. Decent bones, lifeless execution |

### 2.2 Critical Pain Points

1. **No visual identity.** The header doesn't say "this is IEEE's tool." A coat of arms, a subtle pattern, even intentional typography would help.
2. **No spatial hierarchy.** Everything is the same visual weight. Cards look like divs. Sections run together.
3. **Navigation has no personality.** Tab pills in the header are adequate but feel generic. There's no clear active state differentiation beyond a soft blue pill.
4. **Forms are bare.** Inputs lack focus elegance, label placement is flat, helper text feels like an afterthought.
5. **The leaderboard (scoring) should feel exciting.** It currently looks like a settings panel.
6. **The notification bell dropdown** has no micro-animation, no elevation, no personality.
7. **The login page** has potential with its two-panel layout but the left side ("hero panel") is purely typographic — a missed opportunity for atmosphere.
8. **Tables need row interaction.** Click-through event links in tables feel accidental.

---

## 3. Design Philosophy

### "Crafted Institutional"

Think of how a **well-regarded university's internal tool** would look if designed by someone who cared: structured, legible, professional — but with personality in the details. Reference points:

- **Linear** (task management) — clean data density with personality in micro-interactions
- **Notion** (workspace tools) — human typography, restrained color, purposeful whitespace
- **GitHub** (developer tool) — semantic status colors, structured tables, disciplined component library
- **Stripe Dashboard** — the gold standard of dense, trustworthy, data-forward UI

### Guiding Principles

1. **Every pixel earns its place.** If a decorative element doesn't orient the user or add warmth, remove it.
2. **Hierarchy through contrast, not clutter.** Emphasize with weight, color, and scale — not more borders.
3. **Micro-interactions signal care.** A hover state, a smooth reveal, a loading pulse that matches real content — these are noticed even when users don't consciously register them.
4. **Consistency is the product.** Users should be able to predict the behavior of any component they haven't seen yet because every component follows the same design language.
5. **The emotional register is: confident and trustworthy.** Not playful. Not corporate. Human.

---

## 4. Design System Specification

### 4.1 Color Palette

Keep IEEE Blue as the anchor. Evolve the surrounding palette to give it more warmth and life.

```
/* Primary brand */
--primary:        hsl(216, 79%, 36%)    /* #1456a3 — keep */
--primary-hover:  hsl(216, 79%, 28%)    /* Darker on hover */
--primary-soft:   hsl(216, 80%, 97%)    /* Very light blue tint */
--primary-mid:    hsl(216, 60%, 92%)    /* Used for selected states */

/* Surface system — 3 levels of depth */
--bg-base:        hsl(220, 16%, 96%)    /* Page background — very slight blue-gray tint */
--surface-raised: hsl(0, 0%, 100%)      /* Cards, panels */
--surface-overlay:hsl(0, 0%, 100%)      /* Modals, dropdowns, elevated overlays */

/* Borders — 3 intensities */
--border-subtle:  hsl(220, 13%, 91%)    /* Card outlines, dividers */
--border-default: hsl(220, 13%, 84%)    /* Form inputs, table rows */
--border-strong:  hsl(220, 13%, 72%)    /* Active, focused, emphasized boundaries */

/* Text — 4 levels */
--text-strong:    hsl(220, 26%, 14%)    /* Headlines, primary labels */
--text-body:      hsl(220, 14%, 32%)    /* Body copy, descriptions */
--text-muted:     hsl(220, 10%, 52%)    /* Helper text, timestamps */
--text-placeholder:hsl(220, 8%, 68%)    /* Input placeholders */

/* Semantic tones */
--success:        hsl(142, 52%, 28%)
--success-soft:   hsl(142, 60%, 96%)
--success-mid:    hsl(142, 40%, 88%)

--warning:        hsl(38, 90%, 30%)
--warning-soft:   hsl(40, 100%, 96%)
--warning-mid:    hsl(38, 80%, 88%)

--danger:         hsl(0, 68%, 40%)
--danger-soft:    hsl(0, 80%, 97%)
--danger-mid:     hsl(0, 60%, 88%)

--neutral:        hsl(220, 10%, 50%)
--neutral-soft:   hsl(220, 12%, 94%)

/* Scoring / Leaderboard accent */
--gold:           hsl(43, 90%, 48%)
--silver:         hsl(220, 10%, 62%)
--bronze:         hsl(20, 65%, 48%)
```

### 4.2 Typography

**Switch from system fonts to Inter** — a humanist sans-serif built for UI. It's free via Google Fonts, handles all weights cleanly, and reads as human without being casual.

```
Font: Inter (weights: 400, 500, 600, 700)
Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

**Type Scale:**

| Role | Size | Weight | Usage |
|---|---|---|---|
| `page-title` | 28px / 32px | 700 | Page `<h1>` (not used currently; PageHeader h2) |
| `section-title` | 22px | 600 | PageHeader title |
| `card-title` | 15px | 600 | CardTitle |
| `body-lg` | 15px | 400 | Descriptions, lead text |
| `body` | 14px | 400 | Default body |
| `body-sm` | 13px | 400 | Secondary labels, table cells |
| `label` | 12px | 600 | Form labels, eyebrow text |
| `caption` | 11px | 500 | Timestamps, muted metadata |

**Letter spacing:**
- Eyebrow / label ALL CAPS text: `tracking-widest` (0.1em)
- All other text: default (0)

### 4.3 Border Radius

```
--radius-sm:   4px   /* Badges, chips, small inputs */
--radius-md:   8px   /* Cards, buttons, form inputs */
--radius-lg:  12px   /* Modals, large panels */
--radius-xl:  16px   /* Login card, hero panels */
```

### 4.4 Shadow System

Move from a single flat shadow to a 3-level system:

```
--shadow-sm:   0 1px 2px hsl(220 26% 14% / 0.04), 0 1px 3px hsl(220 26% 14% / 0.06);
--shadow-md:   0 4px 6px hsl(220 26% 14% / 0.05), 0 2px 4px hsl(220 26% 14% / 0.06);
--shadow-lg:   0 10px 15px hsl(220 26% 14% / 0.07), 0 4px 6px hsl(220 26% 14% / 0.05);
--shadow-overlay: 0 20px 25px hsl(220 26% 14% / 0.1), 0 8px 10px hsl(220 26% 14% / 0.06);
```

Cards use `shadow-sm`. Dropdowns use `shadow-lg`. Modals use `shadow-overlay`.

### 4.5 Transitions

```
--transition-fast:   100ms ease
--transition-base:   150ms ease
--transition-smooth: 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

All interactive elements (buttons, cards, form inputs, nav items) use `transition-smooth`.

---

## 5. Component-by-Component Redesign Specifications

### 5.1 AppShell / Navigation Header

**Current problem:** Two stacked rows (brand + nav tabs) feel disconnected. The brand mark (ShieldCheck icon) is too small and peripheral.

**Redesign approach:**

- **Sidebar navigation instead of top nav.** This is the biggest structural change and has the biggest visual impact. A left-side fixed sidebar gives the app genuine visual structure, separates navigation from content, and scales better as admin nav items grow.
- **If sidebar is rejected by team, improve the top-bar approach:**
  - Unify brand row and nav into one bar
  - Add a subtle `border-b` with a `1px` accent line in primary color beneath the nav
  - Give active nav item a solid bottom border indicator (like GitHub tabs) instead of a pill
  - Add hover underline / background on inactive nav items
  - Increase brand mark size; add the full IEEE SB UoM wordmark
  - Move user info and notification bell to far right in a `flex-none` group

**Sidebar specification (recommended):**

```
Width: 240px (collapsed: 64px on mobile)
Background: white (surface-raised)
Border-right: 1px border-subtle
Position: fixed left-0 top-0, full viewport height
Scroll: overflow-y: auto (content area scrolls independently)

Brand area:
  - Top of sidebar
  - ShieldCheck icon (24px) + "Volunteer Management" wordmark + "IEEE SB UoM" subtitle
  - Padding: 20px 16px

Nav items:
  - Height: 40px per item
  - Icon: 18px, left-aligned
  - Label: 14px / 500 weight
  - Padding: 0 12px
  - Border-radius: 6px (inset from sidebar edges by 8px)
  - Active: bg-primary-mid, text-primary, icon text-primary
  - Inactive: text-body, icon text-muted, hover bg-neutral-soft

Bottom section (pinned):
  - User avatar (initials-based) + name + role badge
  - Sign out button (ghost, shows icon + text)
  - Separator above this section

Admin section divider:
  - If user.isAdmin: show "ADMINISTRATION" label (all caps, caption-size, text-muted)
  - Admin nav items below the divider

Content area: margin-left: 240px, full remaining width
```

### 5.2 PageHeader Component

**Current:** A `flex-row` with a border-b. Title and description. Left: text. Right: actions.

**Redesign:**
- Add a subtle top eyebrow (already exists but needs styling upgrade)
- Eyebrow: ALL CAPS, 11px, 600 weight, `text-primary`, letter-spacing wide — feels like a section stamp
- Title: 24px, 700 weight — more authority
- Description: 14px, text-muted — lighter contrast from title
- Actions: flush right, `gap-2`
- The border-b should be `border-subtle` not `border-default` — lighter, more refined
- Add `pb-6` (currently `pb-5`) — more breathing room

### 5.3 Card Component

**Current:** Single `shadow-card` that's barely visible. Cards feel like divs with rounded corners.

**Redesign:**
- Switch from `shadow-card` to `shadow-sm` (slightly more dimensional)
- Border: `border-subtle` (lighter than current `border-border`)
- Hover state on navigable cards: `translateY(-1px)` + `shadow-md` + border lightening — this gives cards a "lift" feel
- `CardHeader`: add `16px` left-border accent in primary color for card types that are grouped (e.g., event detail sections). Not global — only for informational section headers.
- `CardTitle`: bump to 15px / 600 — feels more editorial

**New card variant: `Card variant="highlight"`**
- Used for the "Open Volunteer Opportunities" section on Dashboard
- `background: linear-gradient(135deg, white 0%, hsl(216 80% 97%) 100%)`
- Left border: 4px solid `--primary`
- Adds warmth and draws the eye

### 5.4 Button Component

**Current:** Correct variant structure (primary/secondary/ghost). Execution is flat.

**Redesign:**

```
Primary button:
  background: var(--primary)
  color: white
  border: 1px solid transparent
  box-shadow: 0 1px 2px hsl(216 79% 36% / 0.3), inset 0 1px 0 hsl(0 0% 100% / 0.1)
  hover: background: var(--primary-hover), box-shadow: 0 2px 4px hsl(216 79% 36% / 0.4)
  active: translateY(1px) — physical press feedback
  
Secondary button:
  background: white
  border: 1px solid var(--border-default)
  color: var(--text-strong)
  box-shadow: 0 1px 2px hsl(220 26% 14% / 0.04)
  hover: background: var(--neutral-soft), border-color: var(--border-strong)

Ghost button:
  background: transparent
  no border
  color: var(--text-muted)
  hover: color: var(--text-body), background: var(--neutral-soft)

Danger button (new):
  background: var(--danger)
  color: white
  box-shadow: 0 1px 2px hsl(0 68% 40% / 0.3)
  hover: background: hsl(0, 68%, 32%)

All buttons:
  Height: 36px (currently 40px — reduce slightly for refinement)
  Padding: 0 14px
  Font: 13px / 500 weight
  Border-radius: var(--radius-md) = 8px
  Transition: var(--transition-smooth)
  Letter-spacing: 0 (never use uppercase on buttons)
```

### 5.5 Badge Component

**Current:** Functional 5-tone system. Rounded, 7px height, 12px / medium.

**Redesign:**
- Reduce height from 28px → 22px — feels tighter, more like a label not a button
- Border-radius: 4px (--radius-sm) — more rectangular "stamp" look vs current pill
- Keep 5 semantic tones but refine their colors per new palette
- Add a 1.5px left-border accent matching the tone's main color — this makes badges read faster at a glance

```
Badge variants (from existing tones):
  neutral: bg-neutral-soft, text-neutral, border-border-subtle, left-border: --neutral
  primary: bg-primary-soft, text-primary, border-primary/20, left-border: --primary
  success: bg-success-soft, text-success, border-success/20, left-border: --success
  warning: bg-warning-soft, text-warning, border-warning/20, left-border: --warning
  danger:  bg-danger-soft, text-danger, border-danger/20, left-border: --danger
```

**New badge variant: `size="lg"`**
- Used in leaderboard top-3 positions (gold/silver/bronze)
- 28px height, 14px font, more prominent

### 5.6 Form Inputs

**Current:** `border-border bg-surface`, `focus:border-primary`. Nothing else.

**Redesign:**
```
Input:
  background: white
  border: 1px solid var(--border-default)
  border-radius: var(--radius-md) = 8px
  height: 38px
  padding: 0 12px
  font-size: 14px
  color: var(--text-strong)
  placeholder: var(--text-placeholder)
  transition: border-color 150ms, box-shadow 150ms
  
  focus:
    border-color: var(--primary)
    box-shadow: 0 0 0 3px hsl(216 79% 36% / 0.12)
    outline: none
  
  error state:
    border-color: var(--danger)
    box-shadow: 0 0 0 3px hsl(0 68% 40% / 0.10)

Label:
  font-size: 12px (--label)
  font-weight: 600
  color: var(--text-body)
  margin-bottom: 6px
  letter-spacing: 0 (NOT uppercase on form labels — only eyebrows use caps)
  
Helper / error text:
  font-size: 12px
  margin-top: 4px
  color: var(--text-muted) for helpers
  color: var(--danger) for errors
  display flex with icon (AlertCircle 12px) for errors

Textarea:
  Same as input but min-height: 100px, padding: 10px 12px, resize: vertical
  
Select:
  Same as input
  Custom chevron (replace browser default)
  padding-right: 36px for chevron space

Form section:
  Field groups use 16px gap, not 20px
  Grouping label above related fields (e.g. "Event Dates") in --label style
  Submit button area: margin-top: 24px, border-top: 1px border-subtle, padding-top: 16px
```

### 5.7 Tables

**Current:** `divide-y divide-border`, no hover state, no visual treatment.

**Redesign:**
```
Table wrapper:
  border-radius: var(--radius-md)
  border: 1px solid var(--border-subtle)
  overflow: hidden
  
Table head:
  background: var(--bg-base)   ← slightly off from card's white, creates depth
  border-bottom: 1px solid var(--border-default)
  
th cells:
  font-size: 11px
  font-weight: 600
  color: var(--text-muted)
  text-transform: uppercase
  letter-spacing: 0.06em
  padding: 10px 16px
  
Table body rows:
  background: white
  border-bottom: 1px solid var(--border-subtle)
  transition: background 100ms
  
  hover: background: var(--primary-soft) — very subtle blue wash
  
td cells:
  font-size: 13px
  padding: 12px 16px
  color: var(--text-body)
  
  Link cells: color: var(--primary), font-weight: 500, no underline by default, underline on hover
  
Last row: no border-bottom (via :last-child)
Empty state row: centered, 64px height, icon + text
```

### 5.8 Notification Bell Dropdown

**Current:** Click to open, renders notifications. Basic list.

**Redesign:**
```
Bell icon:
  background: none on default
  hover: rounded full background in neutral-soft
  Unread badge: 
    Position absolute top-right of bell
    Red dot (8px) with pulse animation when there are unread
    Number if count > 0: white text on red, 16px min-width, border-radius full

Dropdown panel:
  width: 360px
  border-radius: var(--radius-lg) = 12px
  border: 1px solid var(--border-subtle)
  box-shadow: var(--shadow-overlay)
  background: white
  overflow: hidden
  
  Header row:
    "Notifications" title (14px / 600)
    "Mark all read" button (ghost, 12px)
    Refresh icon button
    border-bottom: 1px border-subtle
  
  Notification item:
    padding: 12px 14px
    border-bottom: 1px border-subtle
    gap: 8px (icon | content)
    
    Unread state:
      background: var(--primary-soft)
      left border: 3px solid var(--primary)
    
    Read state:
      background: white
      left border: 3px solid transparent
    
    Title: 13px / 500, text-strong
    Body: 12px, text-muted, line-clamp-2
    Time: 11px, text-muted, text-right
    
    Hover: background shift + cursor-pointer
    Click: marks as read + navigates
  
  Entry/exit animation:
    Opening: scale(0.97) → scale(1) + opacity 0 → 1, 150ms
    Origin: top-right (transforms from bell icon area)
  
  Empty state:
    Inbox icon (24px, text-muted) + "You're all caught up" text
    Centered, 80px height
```

### 5.9 Login Page

**Current:** Two-column grid. Left: brand + feature tiles. Right: sign-in form.

**Redesign:**
```
Overall layout:
  Full viewport, flex center
  Background: subtle radial gradient — hsl(216, 40%, 96%) at center → hsl(220, 16%, 92%) at edges
  — this adds atmospheric depth to the page behind the card

Login card:
  width: min(920px, 95vw)
  border-radius: var(--radius-xl) = 16px
  box-shadow: var(--shadow-overlay)
  overflow: hidden
  display: grid [left: 1fr | right: 380px]

Left panel (brand / hero):
  background: linear-gradient(145deg, hsl(216, 79%, 28%) 0%, hsl(216, 79%, 18%) 100%)
  — rich, deep IEEE blue gradient (not plain flat blue)
  padding: 48px
  
  Top: IEEE SB UoM logo mark (ShieldCheck icon, 40px, white)
  Org name: "IEEE Student Branch" in uppercase caption style, white/60% opacity
  App name: 32px / 700, white, "Volunteer Management"
  Tagline: 15px, white/70% opacity, line-height 1.6
  
  Bottom feature tiles:
    2-column grid, each tile:
      background: white/10% (semi-transparent)
      border: 1px solid white/20%
      border-radius: 8px
      padding: 12px
      Icon: white/80%
      Text: white/70%, 13px
  
  Decorative element:
    Abstract geometric pattern (IEEE-inspired hexagons or circuit-board motif) 
    Overlaid at 5% opacity in the bottom-right corner of left panel
    — adds texture and signals "tech / engineering" without being distracting

Right panel (sign-in):
  background: white
  padding: 48px 40px
  display: flex, flex-direction: column, justify-center
  
  "Sign in" heading: 20px / 600, text-strong
  Subtext: 14px, text-muted
  
  Google button:
    Full width
    Include Google "G" logo (inline SVG) not just a generic LogIn icon
    White background, border-default border, shadow-sm
    Text: "Continue with Google", 14px / 500
    Hover: border-primary, shadow-md
  
  Error state:
    Rounded danger-soft panel
    AlertCircle icon inline with title
    14px / 500 for title, 13px for details
  
  Footer note:
    "@uom.lk" styled as code-like element (monospace, slightly different bg)
    Smaller, text-muted
```

### 5.10 Dashboard Page

**Current:** Grid of cards (Profile, Access, Opportunities, Event Responsibilities).

**Redesign:**
```
Page layout:
  After PageHeader, use a 3-column grid on xl screens:
    - 2/3 width: main content column
    - 1/3 width: sidebar column (profile summary + quick links)
  
  On smaller screens: single column stack

Profile + Access cards:
  Move into sidebar column as a condensed "identity panel"
  Show: avatar (initials with primary bg), name, email, UoM email, role badges
  Compact, no CardHeader / CardContent split — just a unified panel
  
Event Responsibilities:
  Full-width card
  Table redesign per §5.7
  Add "View Event →" action per row (ghost button)
  Empty state: more prominent — larger icon, more descriptive copy, action link

Volunteer Opportunities:
  Full-width, highlight variant card (per §5.3)
  2-col grid of opportunity items
  Each item: card within card (nested `surface-raised` bg, rounded border)
  Status badge: "Registration Open" with pulsing green dot
  CTA button: primary, full-width within the opportunity card
```

### 5.11 Events List Page

**Current:** Tab switcher (All Events / My Events) + grid of event cards.

**Redesign:**
```
Tab switcher:
  Replace pill-style tabs with underline tabs:
    - Bottom border indicator (2px, primary color) slides between tabs
    - Inactive: text-muted, no underline
    - Active: text-primary, bottom border
    - Hover: text-body, subtle background
    - Transition: sliding underline with 150ms ease

Event cards:
  Add a colored left-border accent (4px) per event status:
    - draft: neutral gray
    - planning: primary blue
    - published: primary blue (brighter)
    - ongoing: success green
    - pending_conclusion: warning amber
    - closed: neutral gray (dimmed opacity)
  
  Card hover: lift effect (translateY(-2px) + shadow-md)
  
  Term/Year: shown as a "stamp" — badge-like, not plain text
  
  Date formatting: more human — "Jul 18, 2026" not just a date string
  
  Conclusion status: show only if not "not_submitted" — don't clutter with empty data
  
  Truncated description (if present): line-clamp-2, shown below dates

Empty state:
  CalendarDays icon: 48px, primary-soft background circle behind it
  Title: "No events yet" — 16px / 600
  Description: 14px, text-muted
  CTA (if canCreate): primary button "Create your first event"
```

### 5.12 Event Detail Page

**Current:** Complex page with status management, committee management, role assignments, form connections. Very dense.

**Redesign strategy:**
```
Overall structure:
  Three zones:
    1. Event header (title, status badge, dates, action buttons)
    2. Main content area (tabbed or sectioned)
    3. Sidebar (quick info: created by, term/year, reference code, lifecycle tracker)

Status lifecycle display:
  Replace plain text with a visual "pipeline stepper":
    draft → planning → published → ongoing → pending_conclusion → closed
    Each stage: circle indicator
    Current stage: filled primary circle + label below
    Completed stages: checkmark, muted
    Upcoming stages: empty circle, muted
    — This is a key UX affordance — users immediately understand where the event is

Section tabs (if complex page):
  "Overview" / "Committees" / "Assignments" / "Registration Forms"
  Uses underline tab pattern

Committee cards:
  Each committee: its own card
  Header: committee name + member count badge + actions (Add Member, Delete)
  Member list: avatar-initial bubbles in a row (overlap like stack of avatars)
  "Add member" inline search: appears below list, not a modal — feels more immediate

Assign role modal:
  Sheet/drawer from right side instead of centered modal
  — More spatial; doesn't cover the underlying context

Action buttons for status transitions:
  In the header, right side
  Only show valid transitions (already done in code)
  Color per transition: Publish = primary, Archive = secondary, etc.
```

### 5.13 Scoring / Leaderboard Page

**Current:** Dense data dashboard with point ledger, grade requests, audit log. Visually flat.

**Redesign:**
```
This page deserves the most visual personality because it's motivational.

Leaderboard section:
  Top 3 positions: 
    LARGE featured items — gold/silver/bronze treatment
    Trophy icon per rank (Trophy, Award, Medal icons)
    Name: 18px / 700
    Score: 24px / 700, colored (gold/silver/bronze)
    Role: badge below name
    Card: slightly elevated with rank-appropriate border-color
    
  Remaining ranks:
    Table format, more compact
    Rank number: monospace, right-aligned, muted
    Score: bold, right column
    
  Term/Year filter:
    Tab row or segmented control at the top
    Clear "active term" indicator

Point ledger:
  Table with icons per action type (Plus = award, Minus = deduction)
  Color-code the change column (green for positive, red for negative)
  
Grade request cards:
  Status badge prominent
  Reviewer name + date
  Grade value large and centered
  
Audit log:
  Compact table, monospace timestamps
  Type column with color-coded chips
```

### 5.14 Profile / Volunteers Page

**Current:** Two-state form (view vs edit) with grid of ReadOnlyField rows.

**Redesign:**
```
View mode:
  Profile "hero" at top:
    Circle avatar with initials (64px, primary bg)
    Name (18px / 700) + Headline (14px, text-muted) side by side
    LinkedIn button (if set): external link icon
    Status + UoM verified badges row
  
  Two-column field grid:
    Each field: label (caption weight, text-muted) + value (body, text-strong)
    Subtle divider between rows
    No hard box outlines on individual fields — use spacing instead

Edit mode:
  Slides in as expanded form below the profile header
  Or: inline edit (click a field to edit it in-place)
  — Inline editing feels more human than wholesale form state toggle

Skills field:
  Comma-separated input currently. Consider a "chip" multi-value input:
    Type a skill → press Enter → appears as a removable badge/chip
    — More discoverable and enjoyable to fill in

Bio field:
  Character count visible bottom-right of textarea
```

### 5.15 Admin Pages (Users, Settings, Notifications, Recommendations)

```
Users list:
  Full-width table with avatar initials column
  Status badge in same row
  Role badges (SB roles, event roles) as compact chips
  Search/filter bar above table
  
Settings page:
  Sections with clear visual separators
  Each setting group: Card with CardHeader + CardContent
  Danger zone: red-tinted card at bottom for destructive settings
  
Notifications admin:
  Compose form: proper rich text feel (not textarea + buttons)
  Preview panel beside compose (or toggled preview tab)
  
Recommendations / Moderation:
  Decision cards: two prominent action buttons (Approve = success, Reject = danger)
  Context info above buttons (who submitted, when, details)
```

---

## 6. Interaction & Animation Patterns

```
Page transitions:
  Since Next.js App Router handles navigation, no full-page transitions
  But: content sections fade in on mount (opacity 0 → 1, 200ms, staggered 50ms per card)
  Use: CSS animation, not JS-heavy libraries

Hover micro-interactions:
  Cards: translateY(-1px) + shadow increase (smooth 200ms)
  Buttons: scale(0.99) on mousedown (press feedback)
  Nav items: background fade (150ms)
  Table rows: background wash (100ms)
  Badges: none — they're static indicators
  
Loading states:
  Match skeleton shapes to real content shapes (not generic rectangles)
  Dashboard skeleton: show 2 card-shaped skeletons + 1 table-shaped skeleton
  Card skeleton: correct aspect ratio, correct number of line stubs inside
  
  Pulse animation: use the existing Tailwind animate-pulse but with 
    a 1.5s duration (currently default 2s — speed it up for more liveliness)

Form interaction:
  Label stays in label position (no floating label animation — not appropriate for this UI density)
  Focus ring: glow effect (box-shadow 0 0 0 3px primary/12%) instead of harsh outline
  Error shake: form error fields do a subtle horizontal shake animation (200ms)
  
Modal/Overlay:
  Backdrop: rgba(0,0,0,0.3) with blur(2px) — adds depth
  Entry: scale 0.96 → 1 + opacity 0 → 1 (150ms)
  Exit: reverse (100ms)
  
Notification bell:
  Unread dot: subtle CSS pulse animation (scale 1 → 1.3 → 1, 2s loop)
  Dropdown: scale origin top-right, 150ms cubic-bezier(0.4, 0, 0.2, 1)

Status transitions (event lifecycle):
  When status changes: brief highlight flash on the status badge
  Pipeline stepper: fill animation on the completed step circle
```

---

## 7. Responsive Strategy

The current system targets desktop (max-w-7xl, px-5/8/10). The redesign should maintain this priority while improving mobile.

```
Breakpoints (reuse Tailwind defaults):
  sm: 640px
  md: 768px
  lg: 1024px
  xl: 1280px

Sidebar navigation:
  Desktop (lg+): fixed sidebar, 240px wide
  Tablet (md-lg): collapsed sidebar (icon-only, 64px), hover to expand
  Mobile (<md): hidden sidebar, bottom nav bar (4-5 primary items as icons)

Content area:
  All grid layouts: single column on mobile, 2-col on md, 3-col on xl
  Tables: horizontal scroll on mobile (overflow-x: auto)
  Event detail tabs: scroll horizontally on mobile

Header top bar (if keeping top-bar nav):
  Mobile: hamburger → slide-out drawer nav
  Brand + notification bell + user menu always visible
  Nav hidden behind hamburger on mobile
  
Forms:
  Full width on mobile
  Two-column layouts collapse to single-column
  
Cards:
  Full width on mobile
  Normal grid from md up
```

---

## 8. File-Level Implementation Map

This section maps every UI change to the exact files that need to be modified.

### Phase 1 — Design Tokens & Global Styles
| File | Change |
|---|---|
| [`globals.css`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/app/globals.css) | Replace CSS custom properties with new palette, add Inter font import, define shadow variables, transition variables |
| [`theme.ts`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/styles/theme.ts) | Update theme description to reflect new design system |
| [`layout.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/app/layout.tsx) | Add `<link>` for Google Fonts (Inter) in head |

### Phase 2 — Primitive Components
| File | Change |
|---|---|
| [`button.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/components/ui/button.tsx) | Redesign all 3 variants + add danger variant; update size/padding/shadow |
| [`badge.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/components/ui/badge.tsx) | Redesign all 5 tones; add left-border accent; add `size` prop; reduce height |
| [`card.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/components/ui/card.tsx) | Update shadow, border; add `highlight` variant; update CardHeader/CardTitle |

### Phase 3 — Layout Components
| File | Change |
|---|---|
| [`app-shell.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/components/layout/app-shell.tsx) | **Major rewrite** — implement sidebar nav or substantially improve top-nav |
| [`page-header.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/components/layout/page-header.tsx) | Update spacing, typography scale, eyebrow styling |

### Phase 4 — Feature Components
| File | Change |
|---|---|
| [`event-ui.ts`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/lib/event-ui.ts) | Update `eventInputClasses`, `eventTextareaClasses` per new form spec |
| [`EventList.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/EventList.tsx) | Redesign tab switcher; redesign event cards (status border, lift hover, stamp treatment) |
| [`EventDetail.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/EventDetail.tsx) | Add lifecycle pipeline stepper; reorganize sections; improve action button layout |
| [`CommitteeManagement.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/CommitteeManagement.tsx) | Redesign committee cards; member avatar stacks; inline member search |
| [`notification-bell.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/notifications/components/notification-bell.tsx) | Full dropdown redesign; add animation; unread state polish |
| [`scoring-dashboard.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/scoring/components/scoring-dashboard.tsx) | Leaderboard visual redesign (top-3 treatment, gold/silver/bronze, point ledger colors) |
| [`profile-details-form.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/volunteers/components/profile-details-form.tsx) | Profile hero section; form input redesign; view mode layout |
| [`CreateEventForm.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/CreateEventForm.tsx) | Apply updated input classes; section grouping; submit area treatment |
| [`EditEventForm.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/EditEventForm.tsx) | Same as CreateEventForm |
| [`AssignRoleModal.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/features/events/components/AssignRoleModal.tsx) | Consider drawer/sheet approach; improve form layout inside modal |

### Phase 5 — Page Files
| File | Change |
|---|---|
| [`login/page.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/app/login/page.tsx) | Deep blue gradient left panel; Google G logo; atmospheric background; refined error state |
| [`dashboard/page.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/app/dashboard/page.tsx) | Sidebar identity panel layout; table redesign; opportunity card polish |
| [`loading.tsx`](file:///Users/sadeepaherath/Projects/IEEE-VM/Volunteer%20Management/src/app/loading.tsx) | Shape-matched skeleton loader; faster pulse |

---

## 9. What NOT to Change

These are off-limits regardless of aesthetic consideration:

- All files in `src/server/`
- All files in `src/features/*/server/`
- All API route handlers in `src/app/api/`
- All `types.ts`, schema definitions, and validation logic
- All `lib/` utilities except where they directly generate CSS class strings (`event-ui.ts`)
- All Appwrite interaction, session, auth, and background job logic
- The navigation structure itself (routes, which pages exist, what they render)
- Any `actions.ts` files (server actions)

---

## 10. Execution Priority Order

When implementing, follow this order to maximize visual impact per unit of effort:

1. **`globals.css`** — foundational; everything else depends on it (Inter font + new token values)
2. **`app-shell.tsx`** — highest visual surface area; every page benefits
3. **`button.tsx` + `card.tsx` + `badge.tsx`** — primitive components; ripple through everything
4. **`page-header.tsx`** — every page uses it
5. **`event-ui.ts`** (form classes) — touches every form
6. **`login/page.tsx`** — first impression
7. **`EventList.tsx`** + **`EventDetail.tsx`** — most-used feature pages
8. **`notification-bell.tsx`** — visible on every page
9. **`scoring-dashboard.tsx`** — personality page
10. **`dashboard/page.tsx`** + **`profile-details-form.tsx`** — personal user experience
11. **`loading.tsx`** + admin pages — finishing polish

---

## 11. Tone & Voice (Copy / Microcopy)

Visual design is half the story. Microcopy is the other half.

**Current language is generic.** "Branch events and their lifecycle status." reads like a field description in a database schema, not UI copy.

**Revised microcopy guidelines:**

| Context | Current | Better |
|---|---|---|
| PageHeader description (Events) | "Branch events and their lifecycle status." | "All IEEE SB UoM events, from draft to conclusion." |
| PageHeader description (Dashboard) | "Your profile, access, responsibilities, and notification preferences." | "Everything about your account — roles, events, and how we reach you." |
| Empty events | "No events are available to display." | "No events yet. Once events are created, they'll appear here." |
| Empty notifications | n/a | "You're all caught up." |
| Loading button | "Creating..." | "Creating event…" |
| Sign out button | "Sign out" | "Sign out" ✓ (already correct) |
| Dashboard UoM not verified | "Verify in Profile" | "Verify University Email" |

**Tone words to aim for:** clear, matter-of-fact, human, specific, not corporate, not casual.

---

## 12. Accessibility Baseline

The current codebase already has some good practices (`aria-hidden` on decorative icons, semantic HTML elements). Maintain and improve:

- All interactive elements: `focus-visible` ring (keep existing global rule, just update the color to match new primary)
- Color contrast: all new colors must pass WCAG AA minimum (4.5:1 for text, 3:1 for UI elements)
- The new deep-blue login panel: ensure text on gradient background passes contrast check
- Gold/silver/bronze leaderboard colors: verify against white text
- Skeleton loaders: `aria-busy` and `aria-label` attributes
- Notification bell: `aria-expanded`, `aria-label="Notifications"`, `aria-live` region for new notifications

---

## 13. Summary of Character Change

| Attribute | Before | After |
|---|---|---|
| Personality | Generic SaaS boilerplate | Crafted institutional tool |
| Color feeling | Flat corporate blue | Deep, warm IEEE blue with purpose |
| Typography | System default (Segoe UI) | Inter — humanist, clean, legible |
| Card depth | Barely visible 1px shadow | Layered shadow system with hover lift |
| Navigation | Tab pills floating in header | Purposeful sidebar / structured top-bar |
| Forms | Plain browser inputs | Focused, elevated, feedback-rich |
| Tables | Hairline dividers, no personality | Structured headers, row hover, semantic cells |
| Badges | Basic colored chips | Stamp-style with tonal left-border accent |
| Leaderboard | Settings-panel aesthetic | Motivational, gold/silver/bronze energy |
| Login | Functional two-panel | Atmospheric, brand-proud, inviting |
| Micro-interactions | None | Lift, press, fade, pulse — life in the UI |
| Empty states | Icon + one line of text | Properly scaffolded with context and action |
| Loading | Generic pulse blocks | Shape-matched, purposeful skeletons |
