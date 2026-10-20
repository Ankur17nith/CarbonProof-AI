# CarbonProof AI — Design System Specification

## 1. Aesthetic Philosophy

The design system is inspired by Claude's editorial warmth, calm confidence, and functional elegance, merged with the rigor of environmental accounting and climate finance.

### Design Principles:
1. **Calm Precision over Flash**: Avoid neon accents, superfluous gradients, glow effects, or decorative charts. Clean lines, restrained borders, and clear typographic hierarchy convey authority.
2. **Warm Neutral Foundation**: Use warm ivory/paper tones (`#FBFBF9`, `#F5F4EF`) rather than stark `#FFFFFF` or cold blue-greys.
3. **Natural Accent Harmony**: Primary actions use a deep forest green (`#2D5A43`, `#244936`) evoking environmental integrity and trust.
4. **Never Rely on Color Alone**: All status badges, risk scores, and alert banners feature explicit text labels and corresponding icons (e.g. checkmark, alert triangle, info icon) to meet WCAG 2.2 AA non-text contrast guidelines.
5. **Generous Whitespace & Density Balance**: Spacious layouts for reading combined with compact, legible data tables for audit and credit management.

---

## 2. Color Palette & Tokens

### Light Theme (Default)
| Token | CSS Variable | Hex / Value | Purpose |
|---|---|---|---|
| Background | `--bg-primary` | `#FBFBF9` | Primary page canvas |
| Surface Primary | `--bg-surface` | `#FFFFFF` | Card surfaces, modals, popovers |
| Surface Secondary | `--bg-surface-secondary` | `#F5F4EF` | Table headers, secondary cards, chips |
| Surface Hover | `--bg-surface-hover` | `#EFECE4` | Interactive hover states |
| Border | `--border-subtle` | `#E6E3DB` | Standard element separators |
| Border Strong | `--border-strong` | `#D5D1C7` | Active borders, inputs |
| Foreground Primary | `--text-primary` | `#1C1917` | High-contrast body & headings |
| Foreground Secondary | `--text-secondary` | `#57534E` | Metadata, descriptions, captions |
| Foreground Muted | `--text-muted` | `#8C877D` | Placeholders, inactive icons |
| Accent Primary | `--accent-primary` | `#2D5A43` | Primary action buttons, brand accents |
| Accent Hover | `--accent-hover` | `#244936` | Primary hover state |
| Accent Soft | `--accent-soft` | `#E9EFEA` | Accent badge backgrounds |

### Dark Theme (Warm Night)
| Token | CSS Variable | Hex / Value | Purpose |
|---|---|---|---|
| Background | `--bg-primary` | `#141514` | Deep carbon night canvas |
| Surface Primary | `--bg-surface` | `#1C1D1C` | Cards and panels |
| Surface Secondary | `--bg-surface-secondary` | `#242624` | Contrast containers |
| Border | `--border-subtle` | `#2F312F` | Subtle borders |
| Foreground Primary | `--text-primary` | `#EDEDEB` | Text high-contrast |
| Foreground Secondary | `--text-secondary` | `#A1A19D` | Secondary body text |
| Accent Primary | `--accent-primary` | `#3D785A` | Vivid forest green |

### Semantic Status Tokens
- **Success / Verified**: Background `#ECFDF5`, Text `#047857`, Border `#A7F3D0`
- **Warning / Review**: Background `#FFFBEB`, Text `#B45309`, Border `#FDE68A`
- **Danger / Rejected**: Background `#FEF2F2`, Text `#B91C1C`, Border `#FECACA`
- **Info / Submitted**: Background `#F0FDF4`, Text `#15803D`, Border `#BBF7D0`

---

## 3. Typography Hierarchy

- **Font Family**: `Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace Family**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (used for IDs, hashes, credit quantities, and block numbers)

| Scale | Tailwind Class | Size / Leading | Weight | Usage |
|---|---|---|---|---|
| Display | `text-2xl` | 24px / 32px | 700 (Bold) | Dashboard hero metrics |
| Heading 1 | `text-xl` | 20px / 28px | 600 (Semi) | Primary page titles |
| Heading 2 | `text-lg` | 18px / 26px | 600 (Semi) | Section headings, modal titles |
| Heading 3 | `text-sm` | 14px / 20px | 600 (Semi) | Card titles, group headers |
| Body | `text-sm` | 14px / 20px | 400 (Regular) | Default content |
| Body Small | `text-xs` | 12px / 16px | 400 (Regular) | Supporting text, metadata |
| Micro / Caption | `text-[10px]` | 10px / 14px | 500 (Medium) | Hashes, timestamps, badges |

---

## 4. Reusable Component Primitives

All UI components are located in `src/components/ui/`:

1. **Button (`button.tsx`)**:
   - Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`
   - Sizes: `sm`, `md`, `lg`
   - Features: Built-in `isLoading` spinner state, accessible focus rings, full keyboard support (`Enter`/`Space`).

2. **Badge (`badge.tsx`)**:
   - Variants: `neutral`, `success`, `warning`, `danger`, `info`, `outline`
   - Features: Compact padding, subtle borders, high contrast.

3. **Card (`card.tsx`)**:
   - Subcomponents: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
   - Features: Soft borders, light elevated shadow, neutral background.

4. **Input & Textarea (`input.tsx`)**:
   - Features: Integrated label, required indicator, inline validation error text, helper hint text, ARIA invalid bindings.

5. **Select (`select.tsx`)**:
   - Features: Custom chevron icon, accessible label and error binding, native `<select>` semantics for maximum accessibility.

6. **Modal (`modal.tsx`)**:
   - Features: Accessible `dialog` landmark, `aria-labelledby`, `aria-describedby`, Escape-to-close handler, backdrop dismissal, body scroll lock.

7. **Table (`table.tsx`)**:
   - Subcomponents: `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
   - Features: Responsive horizontal scroll container, subtle row dividers, hover state.

8. **Tabs (`tabs.tsx`)**:
   - Features: Accessible tab navigation with indicator bar.

---

## 5. Accessibility (WCAG 2.2 AA Compliance)

- **Semantic Landmarks**: `<main id="main-content">`, `<nav aria-label="Main Navigation">`, `<aside aria-label="Sidebar Navigation">`, `<header>`.
- **Skip Links**: Accessible "Skip to main content" link for keyboard users.
- **Focus Rings**: Standardized `focus-ring` utility (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`).
- **Color Contrast**: All text elements achieve >= 4.5:1 contrast against their respective backgrounds in both light and dark modes.
