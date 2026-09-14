---
name: VeloxRent ERP Design System
colors:
  surface: '#fcf9f3'
  surface-dim: '#dddad4'
  surface-bright: '#fcf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ed'
  surface-container: '#f1ede7'
  surface-container-high: '#ebe8e2'
  surface-container-highest: '#e5e2dc'
  on-surface: '#1c1c18'
  on-surface-variant: '#44474b'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f4f0ea'
  outline: '#74777b'
  outline-variant: '#c4c7cb'
  surface-tint: '#54606a'
  primary: '#0a161e'
  on-primary: '#ffffff'
  primary-container: '#1f2a33'
  on-primary-container: '#86919c'
  inverse-primary: '#bcc8d4'
  secondary: '#994700'
  on-secondary: '#ffffff'
  secondary-container: '#fd8a38'
  on-secondary-container: '#662d00'
  tertiary: '#00142d'
  on-tertiary: '#ffffff'
  tertiary-container: '#002951'
  on-tertiary-container: '#5692df'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e4f0'
  primary-fixed-dim: '#bcc8d4'
  on-primary-fixed: '#121d25'
  on-primary-fixed-variant: '#3d4852'
  secondary-fixed: '#ffdbc8'
  secondary-fixed-dim: '#ffb68a'
  on-secondary-fixed: '#321300'
  on-secondary-fixed-variant: '#743400'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a5c8ff'
  on-tertiary-fixed: '#001c3a'
  on-tertiary-fixed-variant: '#004785'
  background: '#fcf9f3'
  on-background: '#1c1c18'
  surface-variant: '#e5e2dc'
typography:
  headline-xl:
    fontFamily: Public Sans
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Public Sans
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Public Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-base:
    fontFamily: Public Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Public Sans
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
  label-md:
    fontFamily: Public Sans
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Public Sans
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  code-operational:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.02em
  code-operational-sm:
    fontFamily: Space Grotesk
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  spacing-2xs: 0.125rem
  spacing-xs: 0.25rem
  spacing-sm: 0.5rem
  spacing-md: 0.75rem
  spacing-base: 1rem
  spacing-lg: 1.25rem
  spacing-xl: 1.5rem
  spacing-2xl: 2rem
  spacing-3xl: 3rem
  gutter-desktop: 1rem
  margin-desktop: 1.5rem
  gutter-tablet: 0.75rem
  margin-tablet: 1rem
  gutter-mobile: 0.5rem
  margin-mobile: 0.75rem
---

## Brand & Style
The design system delivers an institutional, high-reliability visual language tailored for complex, multi-branch fleet management, contract operations, and vehicle lifecycle logistics. It is rooted in Corporate Modernism with functionalist discipline: clarity takes precedence over ornamentation, data density is calibrated to minimize operational fatigue, and visual hierarchy is established through disciplined typographic scales and structured borders rather than heavy decorative styling.

Targeting enterprise dispatchers, fleet maintenance directors, and billing analysts, the interface establishes an atmosphere of controlled precision, institutional trust, and rapid scanability. Information layouts prioritize horizontal datum lines, strict monospaced alignment for machine data, and immediate perceptual anchoring through purposeful, functional accents.

## Colors
The palette is engineered for high visual endurance across multi-hour operational shifts. Surfaces default to crisp starkness softened with warm structural tints, establishing clear organizational zones without visual clutter.

- **Primary Canvas & Surfaces**: Base background is `#FFFFFF`. Secondary container wells, table headers, and sidebar drawers utilize the tinted surface `#FAF9F5`. Dividers, structural frames, and cell borders resolve to `#E5E2DC`.
- **Primary Ink & Text**: Deep slate `#1F2A33` drives primary titles, navigation nodes, active states, and dominant borders. Secondary operational text is rendered in `#52606D`, and muted labels in `#7B8794`.
- **Secondary Functional Accent**: Industrial Amber `#C6600A` is reserved strictly for primary interactive CTAs, high-priority operational callouts, and live rental transition markers.
- **System States & Telemetry**:
  - **Success / Available**: Solid `#1E7D4B` (text/border: `#2F6B4F`, soft container tint: `#EBF5F0`).
  - **Warning / Inspection Due**: Text/glyph `#B5720A` paired with tinted container `#FDF1DE`.
  - **Danger / Critical Flag / Grounded**: Text/glyph `#C22B2B` with soft fill `#FBE9E9`.
  - **Info / Logistics Blue**: Accent `#2166B0` with container tint `#EEF4FB`.

## Typography
Typographic rules follow a dual-hierarchy engine:

1. **Public Sans**: Serves as the primary operational workhorse for structural headers, metadata, field descriptions, button copy, and table data. Its neutral geometric posture preserves clarity in complex multidimensional tables.
2. **Space Grotesk**: Deployed selectively for all technical, trackable, and machine-parsed assets. This includes license plate strings (e.g., `CA-789-KZ`), Vehicle Identification Numbers (VIN), dispatch timestamps, lease agreement keys, and inventory telemetry IDs. Its tabular figures and distinct geometric apertures prevent character confusion (e.g., distinguishing zero from 'O', and eight from 'B') during time-sensitive tasks.

## Layout & Spacing
Layout architecture relies on an explicit 4px baseline rhythm. Enterprise density is prioritized: row heights and component paddings default to a compact standard to maximize the number of visible records above the fold.

- **Grid System**: A 12-column fluid grid for desktop workspaces (breakpoints: `lg` 1024px, `xl` 1280px, `2xl` 1536px), transitioning to an 8-column layout for tablets (768px - 1023px), and a 4-column flow for mobile inspection views (<768px).
- **Workspace Canvas**: Master screens use an edge-to-edge docked side navigation (width: 260px expanded, 64px collapsed), an overhead global header fixed at 52px height, and a scrollable workpane structured with a minimum content margin of 24px (`spacing-xl`).
- **Data Densities**:
  - **Standard Data Grid**: 40px cell height with 8px vertical padding (`spacing-sm`) and 12px horizontal padding (`spacing-md`).
  - **Dense Audit Grid**: 32px cell height with 4px vertical padding (`spacing-xs`) and 8px horizontal padding (`spacing-sm`).

## Elevation & Depth
In alignment with the clean, minimalist corporate ethos, depth is rendered primarily via **Low-Contrast Structural Outlines** and **Tonal Layering**, eliminating heavy, decorative drop shadows.

- **Level 0 (Flat Foundation)**: Pure `#FFFFFF` canvas or `#FAF9F5` surface container with a 1px solid border (`#E5E2DC`).
- **Level 1 (Interactive Cards & Panels)**: Bounded by 1px solid `#E5E2DC`. On interactive hover, border transitions to `#1F2A33` or `#C6600A` without spatial translation.
- **Level 2 (Flyouts, Menus & Tooltips)**: Solid `#FFFFFF` surface bordered by 1px `#D1CEC7`, backed by a crisp, subdued technical shadow: `0 2px 4px 0 rgba(31, 42, 51, 0.06), 0 1px 2px 0 rgba(31, 42, 51, 0.04)`.
- **Level 3 (Modals & Slide-out Drawers)**: Pure `#FFFFFF` surface with an institutional border `1px solid #1F2A33` and deep ambient framing: `0 12px 28px -4px rgba(31, 42, 51, 0.16)`. Modal backdrop is `#1F2A33` at 45% opacity.

## Shapes
Geometry is disciplined and utilitarian. The global shape factor is fixed at **1 (Soft)**:

- Standard controls (input fields, action buttons, table cell wrappers, standard badges) implement a base radius of `0.25rem` (4px).
- Structural containers (cards, data tables, analytical chart panels, modal viewports) implement a roundedness of `0.375rem` (6px) or `0.5rem` (8px).
- Status tags and badge pills employ a conservative 4px edge; circular or completely rounded pill styling is strictly avoided to preserve the enterprise dashboard feel.

## Components

### Buttons
- **Primary Action**: Background `#1F2A33`, text `#FFFFFF`, border `1px solid #1F2A33`. Hover: `#121A20`. Focus: `2px solid #C6600A` with 2px offset.
- **Accent / Operational CTA**: Background `#C6600A`, text `#FFFFFF`, border `1px solid #C6600A`. Hover: `#A85208`.
- **Secondary**: Background `#FFFFFF`, text `#1F2A33`, border `1px solid #E5E2DC`. Hover: Background `#FAF9F5`, border `#1F2A33`.
- **Destructive**: Background `#FFFFFF`, text `#C22B2B`, border `1px solid #FBE9E9`. Hover: Background `#FBE9E9`, border `#C22B2B`.
- **Sizing**: Height 36px (compact) or 40px (standard), padding 0 16px, typography `label-md`.

### Status Badges & Chips
- Embedded in records to convey vehicle lifecycle, dispatch states, and payment status.
- Padding: 2px 8px. Radius: 4px. Font: `code-operational-sm` or `label-sm`.
- **Available / Inspected**: Fill `#EBF5F0`, text `#1E7D4B`, border `1px solid rgba(30, 125, 75, 0.2)`.
- **Rented / In Transit**: Fill `#EEF4FB`, text `#2166B0`, border `1px solid rgba(33, 102, 176, 0.2)`.
- **Maintenance / Flagged**: Fill `#FDF1DE`, text `#B5720A`, border `1px solid rgba(181, 114, 10, 0.25)`.
- **Grounded / Overdue**: Fill `#FBE9E9`, text `#C22B2B`, border `1px solid rgba(194, 43, 43, 0.2)`.

### Data Tables
- Header: Background `#FAF9F5`, height 36px, font `label-sm` uppercase, color `#7B8794`, border-bottom `1px solid #E5E2DC`.
- Body Row: Background `#FFFFFF`, border-bottom `1px solid #E5E2DC`. Hover state: `#FAF9F5`.
- Selected Row: Background `#F4F3EE`, left-border indicator `3px solid #C6600A`.
- Technical cells (Plate, VIN, Date, Tariff Code) use `code-operational` in Space Grotesk.

### Form Inputs & Select Fields
- Container: Background `#FFFFFF`, border `1px solid #E5E2DC`, radius 4px, height 36px, horizontal padding 12px.
- Typography: `body-base` in Public Sans. Placeholder in `#7B8794`.
- Focus: Border `1px solid #1F2A33`, box-shadow `0 0 0 1px #1F2A33`.
- Error: Border `1px solid #C22B2B`, error caption font `body-sm` in `#C22B2B`.

### Checkboxes & Radio Controls
- Base: 16px by 16px square (checkbox) or circle (radio), border `1px solid #B0ABA0`, background `#FFFFFF`.
- Checked: Background `#1F2A33`, border `#1F2A33`, icon glyph white.
- Indeterminate: Background `#FAF9F5`, border `#1F2A33`, horizontal line in `#1F2A33`.

### Cards & Metrics Tiles
- Background `#FFFFFF`, border `1px solid #E5E2DC`, radius 6px, padding 16px.
- KPI Display: Stat value set in `headline-xl` (Public Sans), category title in `label-sm` (Public Sans uppercase), comparative telemetry metric in `code-operational-sm` (Space Grotesk).