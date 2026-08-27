# InclusivePatch Design System

> Global source of truth for the InclusivePatch workspace. Page overrides in `pages/` take precedence when present.

**Product:** Developer-facing accessibility remediation SaaS workspace  
**Direction:** Warm editorial minimalism with Swiss grid discipline  
**Design dials:** Variance 4/10 / Motion 3/10 / Density 5/10

## Design intent

The interface should feel calm, rigorous, and human. Use warm paper rather than clinical white, charcoal rather than pure black, and clay only for active attention. Forest communicates verified or safe states. The visual language is Anthropic-inspired, not a literal brand copy.

## Color tokens

| Role | Token | Value |
| --- | --- | --- |
| App canvas | `--canvas` | `#f4f0e7` |
| Paper | `--paper` | `#fbf9f3` |
| Primary surface | `--surface` | `#fffdf8` |
| Muted surface | `--surface-muted` | `#f1eee6` |
| Strong ink | `--ink-strong` | `#181814` |
| Primary ink | `--ink` | `#292822` |
| Body text | `--text` | `#45423a` |
| Muted text | `--text-muted` | `#6c675e` |
| Border | `--border` | `#d9d2c5` |
| Clay accent | `--clay` | `#aa4d31` |
| Clay focus ring | `--ring` | `#b45336` |
| Verified forest | `--forest` | `#305b4e` |
| Warning | `--warning` | `#84501f` |
| Destructive | `--danger` | `#943d2f` |

Clay is reserved for focus, current state, selected evidence, and controlled warnings. Do not use it as decoration across every surface.

## Typography

- Display: `Iowan Old Style`, `Palatino Linotype`, Palatino, Georgia, serif.
- Interface/body: Inter when available, followed by the native system sans stack.
- Evidence and metadata: `SFMono-Regular`, Consolas, `Liberation Mono`, monospace.
- Display serif is limited to brand, workspace headings, checkout title, proposal title, and key metrics.
- Body copy remains sans-serif for dense scanning and form legibility.

## Shape and depth

- Outer workspace panels: 18px radius.
- Content cards: 12-14px radius.
- Inputs and buttons: 8-10px radius.
- Use one-pixel warm borders before shadows.
- Shadows remain neutral and low-opacity; no glow, glass cards, or colored drop shadows.

## Interaction rules

- Interactive targets are at least 44px tall where layout permits.
- Hover and focus transitions run 180ms and never shift surrounding layout.
- Focus is a visible 3px clay ring with 3px offset.
- Every interaction remains available by keyboard; hover never carries unique information.
- Respect `prefers-reduced-motion` and forced-colors mode.

## Layout rules

- Desktop uses two independent workspace panels on a 12-column-inspired split.
- The sticky judge walkthrough names four outcome-based milestones and exposes one contextual next action.
- Milestones use direct labels: Baseline proof, Scan checkout, Human review, and Journey proof. Do not replace them with generic numbered steps.
- The canvas and checkout stage use a subtle 24-28px grid to convey precision.
- At 900px the panels stack without horizontal scrolling.
- Validate at 375px, 768px, 1024px, and 1440px.

## Component rules

- Primary actions use charcoal with warm-white text.
- Secondary actions use paper, a warm border, and charcoal text.
- Status badges pair color with explicit text; color is never the sole signal.
- Forms always retain visible labels, helper text, and adjacent error feedback.
- Icons come exclusively from Lucide and remain decorative when adjacent text provides the name.

## Anti-patterns

- No purple AI gradients, neon glows, glassmorphism, oversized pills, or ornamental animation.
- No pure-black canvas, cool blue-gray surfaces, or generic enterprise-blue CTAs.
- No emoji icons, hidden focus rings, placeholder-only labels, or body text under 12px.
- Do not remove the deliberate baseline accessibility barriers used by the product demonstration.

## Pre-delivery checklist

- [ ] Text and controls meet WCAG contrast requirements except the explicitly planted low-contrast fixture.
- [ ] Focus indicators are visible and keyboard order matches visual order.
- [ ] Touch targets, responsive widths, and sticky elements work at all four target viewports.
- [ ] Reduced motion and forced colors are supported.
- [ ] No unexpected horizontal scrolling or clipped controls.
- [ ] The six planted issues and remediation workflow remain deterministic.
