---
name: Kinetic Dark Performance
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#79db8d'
  on-tertiary: '#003916'
  tertiary-container: '#55b66c'
  on-tertiary-container: '#00431b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#95f8a7'
  tertiary-fixed-dim: '#79db8d'
  on-tertiary-fixed: '#00210a'
  on-tertiary-fixed-variant: '#005323'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-metric:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-metric:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 2.5rem
  margin-screen: 1rem
  gutter-grid: 0.75rem
---

## Brand & Style

The design system delivers an elite, high-precision athletic tracking environment calibrated for performance athletes and modern fitness enthusiasts. It combines the rigorous engineering of native iOS design standards with an electrified, high-contrast performance dashboard atmosphere. The interface evokes discipline, kinetic energy, focus, and surgical precision. 

The aesthetic aligns with modern high-contrast functionalism paired with controlled glassmorphic depth. Dark slate foundations eliminate visual fatigue during low-light sessions, while electric neon emerald accents command attention toward critical metrics: heart rate, pace, output splits, and progression trends. Content maintains absolute legibility through systematic layout structures, crisp structural typography, and subtle optical glows that denote active physical exertion and completed milestones.

## Colors

The palette relies on deep oceanic slates balanced against radiant emerald and lime accents to construct an aggressive yet professional visual hierarchy.

- **Foundations**: `#0A0E17` serves as the canvas background. Surfaces elevate through `#131B2E` for solid groundings and translucent `rgba(30, 41, 59, 0.70)` for glassmorphic layers.
- **Accents**: `#10B981` acts as the primary action and state signal, supported by `#22C55E` for live status indicators, completed rings, and telemetry gauges. `#15803D` provides pressed feedback and structural active states.
- **Text & Content**: Primary values and headlines utilize `#F8FAFC`. Secondary meta-details use `#94A3B8`, and tertiary annotations or inactive states use `#64748B`.
- **Borders**: Subdued dividers employ `rgba(255, 255, 255, 0.08)`. Active, selected, or high-performance cards use illuminated outlines set to `rgba(34, 197, 94, 0.20)`.

## Typography

The type scale relies entirely on Inter to mirror native iOS San Francisco proportions while retaining strict tabular metrics for rapid data consumption.

- **Tabular Numerics**: Apply `font-feature-settings: "tnum" 1` across all metric readouts, stopwatches, rep counters, and telemetry data tables to prevent horizontal layout shift during live activity.
- **Metric Visuals**: Large figures utilize `display-metric` with tight letter spacing for maximum graphic impact within limited card footprints.
- **Labels**: Sub-headers, metrics, and gauge units use `label-metric` transformed to uppercase with explicit positive tracking (`0.06em`) to ensure instant categorization under high physical strain.

## Layout & Spacing

The layout is built around a mobile-first 4-column dynamic grid designed for quick vertical scanning and fluid reachability on handheld devices.

- **Screen Margins**: Fixed `16px` (`margin-screen`) horizontal inset from device viewport edges, accommodating modern iOS safe areas.
- **Rhythm & Gutters**: Strict 4pt/8pt baseline interval. Standard widget grids leverage an `8px` or `12px` (`gutter-grid`) gap, allowing dense side-by-side data cards (e.g., Heart Rate next to Active Kilocalories).
- **Form Factor Adaptations**:
  - *Compact Handheld (< 480px)*: Single or dual-column metric split cards. Floating primary action buttons stick to the thumb-zone above the bottom tab navigation.
  - *Tablet / Extended (> 768px)*: Transforms to an 8-column layout with pinned telemetric summaries alongside continuous workout timelines.

## Elevation & Depth

Visual hierarchy uses frosted glassmorphic backdrops, stacked slate containers, and luminous neon aura projections rather than conventional drop shadows.

- **Level 0 (Canvas)**: Solid `#0A0E17`. Houses passive chart gridlines and non-interactive track paths.
- **Level 1 (Structural Cards)**: Solid `#131B2E` with a hairline stroke of `rgba(255, 255, 255, 0.08)`. Used for background modules, session list items, and settings groups.
- **Level 2 (Glass Floating Overlays)**: `rgba(30, 41, 59, 0.70)` combined with `backdrop-filter: blur(20px)` and a top-edge highlight stroke (`rgba(255, 255, 255, 0.12)`). Used for sticky telemetry bars, live pace chips, and modal sheets.
- **Active State Glow (Kinetic Radiance)**: Critical metrics and active workout buttons omit harsh black drop shadows in favor of a targeted electric glow: `box-shadow: 0 0 24px rgba(16, 185, 129, 0.35)`.

## Shapes

The geometric architecture pairs structural curvature with aerodynamic pills:

- **Base Radius (`0.5rem` / `8px`)**: Nested internal indicators, step counters, and segmented progress bars.
- **Card Enclosures (`rounded-lg` / `1rem` / `16px`)**: Standard workout widgets, modal cards, and interactive summary modules.
- **Container Surfaces (`rounded-xl` / `1.5rem` / `24px`)**: Primary metric hero panels, bottom navigation sheets, and performance telemetry wraps.
- **Continuous Pills (`rounded-full` / `9999px`)**: Interactive filter chips, quick-start timers, heart rate zone tags, and floating action buttons.

## Components

### Action Buttons
- **Primary Kinetic Button**: High-contrast `#10B981` fill with `#0A0E17` bold typography. Height is fixed at 56px with a `rounded-full` shape for easy thumb targeting during runs. Uses `box-shadow: 0 0 20px rgba(16, 185, 129, 0.3)`. Pressed state scales to `0.98` and changes background to `#15803D`.
- **Secondary Ghost Button**: Transparent background enclosed in a 1px border of `rgba(255, 255, 255, 0.08)` with `#F8FAFC` text; highlights to `rgba(34, 197, 94, 0.20)` border on tap.

### Telemetry Cards & Metric Modules
- Encased in `rounded-2xl` surfaces with `rgba(30, 41, 59, 0.70)` fill and `backdrop-blur(16px)`. 
- Borders are set to a hairline `rgba(255, 255, 255, 0.08)`. When a metric achieves a target (e.g., heart rate zone 4/5), the border transitions to `rgba(34, 197, 94, 0.50)` with a subtle inner gradient.

### Metric Chips & Pills
- Compact status capsules using `rounded-full` contours. 
- Inactive chips use `#1E293B` background with `#94A3B8` labels. Active chips switch to `rgba(16, 185, 129, 0.15)` fill, `1px` border of `rgba(34, 197, 94, 0.40)`, and `#22C55E` text.

### Inputs & Selection Controls
- **Text Inputs**: Dark container `#131B2E` with an inset height of 48px, rounded to 12px. Inactive border is `rgba(255, 255, 255, 0.08)`; focus activates a glowing `#10B981` border with a 2px outer aura.
- **Checkboxes & Radios**: Custom circular targets (22px). Unchecked states feature an empty `#131B2E` core with a 1.5px border (`#64748B`). Checked states fill with `#10B981` and display a crisp neutral `#0A0E17` checkmark.

### Telemetry Gauges & Sparklines
- Segmented linear bars and arc dials use an unlit track of `#1E293B`.
- Lit values scale from `#10B981` to `#22C55E` with an end-cap neon dot producing an ambient blur to signal real-time velocity.