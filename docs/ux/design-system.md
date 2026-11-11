# Design System — "Paper & Ink"

The product should feel like a calm, well-lit studio: warm paper, confident ink, one deep green that signals "go", and a saffron highlight reserved for AI suggestions and things that need the user's attention. The application UI is deliberately quieter than the CVs it produces — the user's document is the hero.

Implementation lives in `src/styles/tokens.css` (CSS custom properties) and `src/components/ui/*`. Tokens here and in code must match; code is updated in the same PR as this file.

## 1. Brand identity

- **Name:** AI CV Studio. In UI copy we say "the Studio" or "we"; never "the AI model".
- **Logo:** wordmark "CV Studio" set in Fraunces Semibold with a small spruce square "page" mark whose top-right corner is folded (a sheet of paper). "AI" appears as a small-caps prefix in the wordmark, not as sparkles.
- **Personality:** capable, warm, plain-spoken, never hype. We show, not shout.
- **Imagery:** real rendered CVs instead of stock photos or illustrations of people.

## 2. Colour

| Token | Hex | Use | Contrast on paper |
|---|---|---|---|
| `--color-paper` | `#FAF8F4` | App background | — |
| `--color-surface` | `#FFFFFF` | Cards, panels, inputs | — |
| `--color-sunken` | `#F2EEE7` | Wells, preview canvas background | — |
| `--color-line` | `#E4DED3` | Dividers, card borders (decorative) | — |
| `--color-line-strong` | `#857F75` | Input borders, controls (meets 3:1) | 3.7:1 |
| `--color-ink` | `#1B1F24` | Primary text | 15.6:1 |
| `--color-ink-muted` | `#5A5F66` | Secondary text | 6.1:1 |
| `--color-ink-subtle` | `#6E737A` | Hints, placeholders | 4.5:1 |
| `--color-primary` | `#1E5A55` | Primary buttons, links, focus | 7.5:1 |
| `--color-primary-hover` | `#174843` | Hover/pressed | — |
| `--color-primary-soft` | `#E3EFEC` | Selected states, soft badges | primary text 6.7:1 |
| `--color-accent` | `#E9A23B` | AI/attention highlight (non-text) | — |
| `--color-accent-soft` | `#FBF0DC` | AI suggestion background | — |
| `--color-accent-ink` | `#7A4E0B` | Text on accent-soft | 6.4:1 |
| `--color-success` | `#2F7A4A` | Success text/icons | 4.95:1 |
| `--color-warning` | `#A15C07` | Warning text/icons | 4.9:1 |
| `--color-danger` | `#B42318` | Errors, destructive | 6.2:1 |
| `--color-info` | `#2C5BA8` | Informational | 6.3:1 |

Rules: colour never carries meaning alone (pair with icon or words); all text ≥ 4.5:1, large text and UI boundaries ≥ 3:1. Dark mode is out of MVP scope; tokens are named semantically so it can be added.

## 3. Typography

| Role | Font | Size / line-height | Weight |
|---|---|---|---|
| Display (Home hero) | Fraunces | 48/56 desktop, 36/44 mobile | 600 |
| H1 page title | Fraunces | 32/40, 28/36 mobile | 600 |
| H2 section | Figtree | 22/30 | 650 |
| H3 card title | Figtree | 18/26 | 600 |
| Body | Figtree | 16/24 | 400 |
| Body small / helper | Figtree | 14/20 | 400 |
| Label | Figtree | 14/20 | 600 |
| Caption | Figtree | 12/16 | 500 |

Body text is never smaller than 16 px on inputs (prevents mobile zoom). Line length 45–75 characters. Fonts are self-hosted (no third-party requests).

CV templates use their own curated font pairs (see `../engineering/template-engine.md`), independent of the UI fonts.

## 4. Spacing, layout and shape

- **Spacing scale (4 px base):** 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- **Radius:** `sm` 6 px (inputs, chips), `md` 10 px (buttons, cards), `lg` 16 px (panels, dialogs), `full` (pills, avatars).
- **Elevation:** `shadow-1` cards (0 1px 2px rgba(27,31,36,.06), 0 1px 1px rgba(27,31,36,.04)); `shadow-2` popovers; `shadow-page` CV pages in preview (soft, larger). No heavy drop shadows.
- **Containers:** content max-width 1200 px; reading width 680 px; editor panel 440 px (min 360, max 520).
- **Breakpoints:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

## 5. Components

| Component | Variants | Key rules |
|---|---|---|
| Button | primary, secondary (outlined), ghost, danger; sizes sm 36 px / md 44 px / lg 52 px | Min touch target 44 × 44; label is a verb ("Download PDF"); loading state keeps width and shows spinner + text |
| Icon button | ghost, outlined | Always has an accessible label and tooltip |
| Text field / textarea | default, error, disabled | Visible label above; helper text below; error replaces helper with icon + message |
| Select / segmented control | — | Segmented for ≤ 4 options (e.g. density), select for more |
| Checkbox, radio, switch | — | Whole row clickable |
| Chip | selectable, removable | Used for skills and suggestions |
| Card | static, interactive (selectable) | Interactive cards show selected state with primary border + check icon |
| Tabs | underline | Content/Design tabs; arrow-key navigation |
| Stepper | — | "Step 2 of 6 · Work history" text always visible; bar is decorative |
| Dialog | — | Rare; focus trapped; Esc closes; for account/CV deletion only |
| Sheet (mobile) | bottom | For menus and pickers on phones |
| Toast | neutral, success, error; with optional action (Undo) | Bottom-centre; 5 s, 8 s with action; announced politely to screen readers |
| Banner | info, warning, error | Inline, dismissible when non-critical |
| Skeleton | text, block, page | Matches final layout |
| AI suggestion card | — | Accent-soft background, "Suggested" label, actions Use this · Try again · Dismiss |
| Needs-input marker | — | Inline `[ … ]` highlight in accent; listed in Download checklist |

## 6. Icons

Lucide icon set (MIT), 20 px default (24 px in mobile tab bar), 1.75 px stroke, `currentColor`. Icons support labels; they never replace them in primary navigation.

## 7. Interaction states

| State | Treatment |
|---|---|
| Hover | Slight background tint (`primary-soft` for primary-ish, `sunken` for neutral); cursor pointer |
| Focus-visible | 3 px outline `--color-primary` with 2 px offset, never removed |
| Active/pressed | `primary-hover` / darker tint, 1 px translate down on buttons (reduced-motion: none) |
| Selected | Primary border + soft fill + check icon |
| Disabled | 45% opacity, no pointer events; avoid disabled primary buttons — explain what's missing instead |
| Loading | Spinner (16/20 px, primary) with text; skeletons for content areas |

Motion: 120 ms (micro), 200 ms (panels), 300 ms (page transitions); `cubic-bezier(.2,.7,.2,1)`. All non-essential motion disabled under `prefers-reduced-motion`.

## 8. Voice and copy

- Speak to one person: "Add your work history".
- Plain words: "design" not "template" in primary copy (template is fine as a secondary label); "job description" not "JD"; "applicant tracking systems" explained once in Help.
- Errors: what happened + what to do. "We couldn't create the PDF. Try again, or use Print to save it as a PDF."
- Encourage without flattery: "Nice — that's your work history done."

## 9. Accessibility (WCAG 2.2 AA minimum)

- Every interactive element reachable and operable by keyboard; visible focus.
- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `h1` per page.
- Form fields have programmatic labels; errors linked with `aria-describedby`; `aria-live` for save status and toasts.
- Reordering available without drag (buttons).
- Target size ≥ 24 × 24 CSS px (we use 44).
- Preview is supplementary; all content is editable through the form, so screen-reader users never depend on the visual preview.
- Respect `prefers-reduced-motion`, 200% zoom without loss, and text spacing overrides.
- Automated axe checks in end-to-end tests on every page.
