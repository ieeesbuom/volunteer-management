# Custom Rules

- **Interactive Elements Cursor**: Always ensure that all clickable elements, interactive components, buttons, tabs, links, and custom elements with click handlers (`onClick`) display a hand cursor (`cursor: pointer` or `cursor-pointer` class) when hovered.

- **Confirmation for Crucial/Destructive Actions**: Always ensure that critical, destructive, state-altering, or workflow-disrupting actions (such as deleting items, opening/re-opening forms, closing forms, withdrawing requests, etc.) present a confirmation dialog to clarify user intent before executing the action.

---

## UI Design System

This project has an established design system defined in the skill `ui-design-system` (`.agents/skills/ui-design-system/SKILL.md`). The full reference document is at `.agents/skills/ui-design-system/references/ui_ux_agent_context.md`.

**You MUST follow the design system for ALL UI changes.** Key rules:

- **Font:** Inter (Google Fonts, 400/500/600/700). Never use system fonts.
- **Design language:** "Crafted Institutional" — purposeful, human, trustworthy. Not generic SaaS.
- **Color:** Use only the CSS custom properties defined in `globals.css`. Never hardcode hex/rgb values.
- **Shadows:** 3-level system (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-overlay`). Cards use `shadow-sm`. Dropdowns use `shadow-lg`.
- **Border radius:** `radius-sm` (4px) for badges · `radius-md` (8px) for cards/buttons/inputs · `radius-lg` (12px) for modals · `radius-xl` (16px) for login card.
- **Buttons:** 36px height · 13px/500 font · always `cursor-pointer` · primary has blue box-shadow · active state has `translateY(1px)`.
- **Badges:** 22px height · 4px left-border accent in tone color · `radius-sm`.
- **Cards:** `border-subtle` border · `shadow-sm` · hover navigable cards: `translateY(-1px) shadow-md`.
- **Inputs:** 38px height · on focus: border-primary + blue glow ring (`box-shadow: 0 0 0 3px primary/12%`).
- **Tables:** `<thead>` uses `bg-base` (off-white) · `th` text: 11px/uppercase/600/tracking-wide · row hover: bg-primary-soft.
- **Navigation:** Sidebar preferred (240px, fixed, white, border-right: border-subtle). If top-bar: active item uses bottom-border indicator, not pill.
- **Animations:** Card hover = translateY lift · Modal = scale(0.96→1) + fade · Notification dropdown = scale from top-right.
- **Leaderboard:** Gold/silver/bronze token colors for top-3 treatment.
- **Backend is off-limits:** Never modify `src/features/*/server/`, `src/app/api/`, `**/actions.ts`, `**/types.ts`, `**/validation.ts`, or `src/server/`.
- **Microcopy:** Human, specific, sentence-case. Eyebrow text only = ALL CAPS + tracking-widest.
