# ADMIN-DESIGN-GUIDE.md — ATR Bulletin Admin Panel

The design contract for the admin panel (`/admin` on the Pages dev domain). This is the
single source of truth for UI/UX decisions. The public bulletin site has its own design and
is NOT covered here.

Scope: admin site only. The bulletin public site is untouched by this guide.

## 1. Design philosophy

The admin follows Apple's Human Interface Guidelines, adapted for a dark web application:

- **Clarity** — text is legible at every size, hierarchy is driven by typography weight and
  size, not by borders or chrome.
- **Deference** — the content is the interface. Chrome recedes; colour is used for state,
  not decoration.
- **Depth** — layered surfaces with subtle elevation communicate what is interactive.
- **Everything responds** — every control has visible hover, focus, pressed and disabled
  states with consistent motion.

## 2. Tokens (the only source of truth)

All values come from `:root` variables in `public/admin.css`. Never hardcode colours, radii,
fonts or spacing in components — always reference a token. If a token does not exist, add it
here and to the CSS before using it.

### Colour (dark, default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d0f12` | App background, deepest layer |
| `--surface-1` | `#14171b` | Cards, sidebar |
| `--surface-2` | `#1a1e24` | Inputs, hover fills, nested panels |
| `--surface-3` | `#20252d` | Popovers, tooltips, elevated controls |
| `--border` | `#232830` | Hairline borders between sections |
| `--border-2` | `#2e343d` | Control borders, stronger dividers |
| `--text` | `#e8eaed` | Primary text |
| `--muted` | `#9aa3ad` | Secondary text |
| `--faint` | `#5f6771` | Tertiary text, labels, placeholders |
| `--accent` | `#7a9cc0` | Interactive elements, focus, selected state |
| `--accent-strong` | `#9cbcdd` | Active nav, highlighted values |
| `--accent-dim` | `rgba(122,156,192,.14)` | Selected/hover fills |
| `--amber` | `#ddad55` | Warnings, attention |
| `--red` | `#e07a6a` | Errors, destructive actions |
| `--green` | `#34c759` | Positive/on state (iOS system green) |

Rules:
- Accent is for interaction and state only. Do not use it for static decoration.
- Destructive actions are red. Never use red for anything non-destructive.
- Semantic states: green = on/positive, amber = warning/attention, red = error/destructive.

### Typography

| Token | Value |
|---|---|
| `--font` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif` |
| `--mono` | `"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace` |

- System font stack first so Apple devices render SF Pro natively.
- Body: 14px/1.5. Data tables: 13px. Mono for IDs, URLs, timestamps, readback.
- Hierarchy: weight and size, not borders. Card titles 15px/700, section labels 11px
  uppercase/600 with letterspacing, stat values 22px/700.

### Radii

| Token | Value | Use |
|---|---|---|
| `--radius` | `16px` | Cards, panels, modals |
| `--radius-md` | `12px` | Inputs, selects, buttons, nav items |
| `--radius-sm` | `8px` | Small inline elements, tooltips, history events |
| `999px` | full | Pills, badges, switches, avatars |

### Spacing scale (4px base)

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48`. Use the scale; never arbitrary gaps.

- Control height standard: **36px** for inputs, selects, buttons in toolbars. Small variant
  (`.btn-sm`, `.cat-edit`): 28px.
- Card padding: 20px. Content padding: 24px 28px 48px (desktop).
- Toolbar gap: 8px, controls aligned centre on one baseline.

### Motion

| Token | Value |
|---|---|
| `--ease` | `cubic-bezier(.25,.1,.25,1)` (Apple-style ease) |
| Durations | 200ms (hovers, colour), 300ms (appearance, panels), 300ms (switches) |

- No opacity-only transitions for interactive elements; combine with transform where
  movement helps (e.g. buttons, switches).
- Focus rings: `box-shadow: 0 0 0 3px var(--accent-dim)` on `:focus-visible` — never
  remove outlines without a visible replacement.

## 3. Component rules

### Cards
- `background: var(--surface-1)`, `border: 1px solid var(--border)`, `border-radius: var(--radius)`, padding 20px.
- Card heads: title 15px/700 left, actions right, 16px margin-bottom.

### Buttons
- `.btn` height 36px, `border-radius: var(--radius-md)`, padding 8px 14px, 13px/600.
- Primary: accent fill. Ghost: transparent with `--border-2` border. Danger: red border/text.
- Disabled: opacity .45. Every button needs hover + active states.

### Inputs, selects, textareas
- Height 36px (textarea auto), `border-radius: var(--radius-md)`, padding 8px 12px,
  `background: var(--surface-2)`, `border: 1px solid var(--border-2)`.
- Focus: accent border + 3px accent-dim ring.
- Selects must match input height and radius exactly when in the same toolbar.

### Tables
- Headers: 11px uppercase/600, `--faint`, letterspacing .06em, bottom border `--border-2`.
- Cells: 13px, `--muted`, padding 10px 12px, row separators `--border`.
- Hover row: subtle fill (white at ~4% on dark). Selected row: accent-dim fill.
- First column left-aligned flush to card edge.

### Pills / badges / switches
- Full radius (999px). Pills: 11px/600, surface-2 fill, border-2 border.
- Status badges: semantic colour at 12% alpha fill + coloured text + coloured border.
- iOS-style switch: 40x24 track, 20px knob, green `#34c759` when on, 300ms ease.

### Toolbars
- Flex row, `gap: 8px`, `align-items: center`, `flex-wrap: wrap`.
- All controls in one toolbar are identical height (36px) and radius (12px).
- Search input flexes to fill remaining width; min-width 180px.

### Modals (live editor)
- Scrim: rgba(0,0,0,.55), blur optional. Panel: `min(680px, 100%)`, radius 16px,
  shadow `0 24px 60px rgba(0,0,0,.5)`, max-height 88vh with internal scroll.
- Close affordance top-right, Escape closes.

## 4. Layout

- Sidebar 232px fixed, sticky, panel background with right hairline border.
- Topbar sticky, 14px 28px padding, hairline bottom border.
- Content max-width 1440px centred, 24px 28px padding.
- Breakpoints: 1100px (sidebar collapses to drawer), 1024px (grids stack), 900px
  (content padding tightens), 520px (stats single column, mobile action bar).

## 5. Copy and content rules

- Labels are sentence case ("Hidden only", not "Hidden Only").
- No em dashes in UI copy. Use commas, periods or rewrite.
- UK English spelling (colour, organise, centre).
- Buttons say what they do: "Save changes", "Remove", "Cancel", "Restore".

## 6. Verification

Before shipping any admin change:
1. Check every new colour/radius/spacing uses a token from this guide.
2. Verify control heights match the standard in shared toolbars.
3. Check hover, focus, pressed and disabled states exist on new interactive elements.
4. Confirm no change leaked into the public bulletin site files (`public/index.html`,
   `public/app.js`, `public/styles.css`).

## 7. Known deviations to fix (audit log)

This section tracks the audit against this guide. Each entry is fixed one at a time and
marked done.

- [ ] Toolbar controls historically mixed heights (32px selects vs 40px date inputs) —
      standardised to 36px; verify all toolbars.
- [ ] Old radius tokens (12px/8px) replaced with 16/12/8 scale; check cards, buttons,
      inputs all reference the new tokens.
- [ ] Nav item hover uses surface-2; should use a 4% white fill to match the table rows.
- [ ] Motion tokens not yet applied; transitions use ad-hoc 120ms/200ms values.
- [ ] `.vis-switch` green is hardcoded `#34c759`; move to `--green` token.
- [ ] Hardcoded rgba shadows and colours in tags/title tooltips; tokenise.
- [ ] Audit every tab (Live Items, Publish, Sources, Categories, Ops, Dashboard,
      Analytics, Newsletter, Sponsors, Profile) against the component rules.
