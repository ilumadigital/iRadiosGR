# iRadiosGR v6.1 — Phase 2 Design System

## Scope

Implement a cohesive, premium **dark / glassmorphism / lime** visual language. This first implementation is an incremental UI foundation, not a finished end-to-end redesign. It deliberately does not modify streaming, payments, authentication, data models, or the stable player lifecycle.

## Tokens and rules

Single source of truth: `frontend/src/styles/design-system.css`.

| Token | Default | Use |
| --- | --- | --- |
| `--ir-color-bg` | `#05070a` | App background |
| `--ir-color-panel` | `#10151b` | Elevated opaque panels |
| `--ir-color-panel-raised` | `#171d25` | Hover/raised surfaces |
| `--ir-color-accent` | `#ccff00` | Brand actions, active indicators |
| `--ir-color-accent-soft` | `#e4ff83` | Accessible accents/hover |
| `--ir-color-text` | `#f5f7f9` | Main text |
| `--ir-color-muted` | `#a3adb8` | Supporting labels |
| `--ir-glass-border` | subtle light | Glass panel outline |
| `--ir-radius-card` | `1.5rem` | Cards and panels |
| `--ir-radius-control` | `0.875rem` | Search and button controls |

Use accent sparingly: active navigation, verified primary actions, radio statuses. Never place light gray text on lime. Keep dark opaque fallbacks where `backdrop-filter` is unavailable.

## Implemented classes

- `ir-glass`: reusable translucent surface (opt-in).
- `ir-app-topbar`: persistent header background and delineation.
- `ir-app-sidebar`: desktop navigation shell.
- `ir-app-mobile-nav`: bottom navigation with mobile safe-area handling.
- `ir-search-field`: 44px minimum accessible search input.
- `ir-nav-item`, `ir-nav-item--active`: navigation state with lime indicator.
- `ir-now-playing-card`: current-song station card.
- `ir-station-image`: station logo tile with hover treatment.
- `ir-action-primary`: prominent lime CTA, minimum 44px height.

## Accessible behavior

- Greek document language: `lang="el"`.
- User zoom enabled via viewport metadata; no `user-scalable=no`.
- Keyboard focus outlined visibly in lime.
- `prefers-reduced-motion` turns off expensive/continuous animations.
- `prefers-contrast: more` increases divider/muted-text contrast.
- Navigation tap targets at least 44px where class applies.
- Mobile fallback for Safari / older browsers without backdrop filter.

## Layout migration order

1. **Done in this PR**: global tokens, top bar, side bar, mobile navigation, Home station tiles, authenticated Home Now Playing.
2. Next: desktop sticky-player/miniplayer surface and accessible playback states, without remounting the audio element.
3. Next: station discovery, profile, search/filter, responsive grid, empty/loading/error states.
4. Next: login/registration/profile and marketing screens. Operational backoffice will receive its separate role-specific layout in Phase 5.
5. Final: device-level screenshots and functional validation at 360px, 390px, 768px, 1024px, 1440px; keyboard navigation; iOS notch/bottom safe area; player stability.

## Release guidance

**Do not merge or deploy purely on a CSS build:** first review visual differences in staging, test interactions and radio playback, ensure metadata remains authenticated, and check mobile navigation with the sticky player. All backend secrets stay outside Git. Production `play.iradios.gr` must remain unaffected by staging work.
