# Personal Achievement Hub — Design System

> **V3 visual direction (active): Auros-inspired abyssal data interface.** Earlier directions below remain as history only. Public pages use a rationed deep-teal surface stack, silver body copy, crisp white display type, lavender-phosphor figures, and small aurora-gradient CTAs. No Refero or Auros proprietary assets/typefaces are copied.

## V3 public tokens and motion

- Surface stack only: abyss `#011d1c`, base `#012624`, raised `#003734`.
- Text: headings `#ffffff`, body silver `#bbc7c6`, bright mist `#edfffe`; emphasis figures `#fde9ff`.
- Aurora gradient is reserved for primary CTAs and the signature data-orb highlight. It is not used for page backgrounds or text.
- Matter is approximated with the distributable Geist family: weight 500 headings, 1.0 display line-height, 1.4 body line-height.
- Display scale: 96 / 61 / 36 / 24 / 16 / 10px with fluid clamps. Eyebrows use 0.08–0.15em uppercase tracking.
- Complete radius vocabulary: 6px controls and buttons, 16px cards. No pills and no drop shadows.
- Motion language: softly breathing data orbs; pointer-responsive hero parallax; staggered heading and card reveal; count-up-style statistic entrances; a low-contrast scanning line; CTA light sweep; subtle card lift via color and border only. Reduced-motion mode disables continuous, parallax, and marquee motion.

## V2 public tokens

- Canvas: `#e5e4e0`; ink: `#1d1d1d`; ash: `#bfbebe`; paper: `#f5f4f0`.
- Display typography: Geist Sans as the legally distributable approximation, weight 500, 0.82–0.9 line height, tight negative tracking.
- Display sizes: `clamp(4.2rem, 10.5vw, 9.3rem)`; section titles `clamp(3rem, 7vw, 6.6rem)`.
- Public cards have 0px radius and no shadow. Structure comes from 1px ash rules.
- Buttons, fields, and compact interactive controls use 10px radius.
- Color is reserved for one 255-degree yellow → pink → blue → white sphere in the hero.
- Motion: staggered text masks, 700–900ms cubic-bezier entrances, slow pointer/scroll-responsive sphere drift, and 250ms image/card hover. All motion is disabled or reduced under `prefers-reduced-motion`.

## Product character

Personal Achievement Hub feels like a calm, capable SaaS workspace: editorial whitespace, crisp hierarchy, restrained glass surfaces, and a purple-to-blue identity with cyan used only for emphasis. Public pages prioritize storytelling; the admin prioritizes scanning and safe actions.

## Color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#F7F8FC` | `#080B14` | Page background |
| Surface | `#FFFFFF` | `#101522` | Cards and panels |
| Surface elevated | `#FFFFFFE8` | `#151B2BE8` | Glass navigation/dialogs |
| Text | `#16182D` | `#F5F7FF` | Primary copy |
| Muted | `#667085` | `#A5AEC4` | Secondary copy |
| Border | `#E4E7EC` | `#273044` | Dividers and fields |
| Primary | `#6D4AFF` | `#9178FF` | Primary actions and focus |
| Blue | `#3178FF` | `#65A0FF` | Links and gradients |
| Cyan | `#16B8C8` | `#43D4DF` | Small accents only |
| Success | `#168A61` | `#43C997` | Published/success |
| Warning | `#B36A05` | `#F2B84B` | Draft/protected |
| Danger | `#C6374A` | `#FF7185` | Destructive/error |

The brand gradient is `linear-gradient(125deg, #6D4AFF, #3178FF 62%, #16B8C8)`. Glows are limited to hero decoration and focused featured cards at low opacity.

## Typography

- UI and body: Geist Sans with system fallbacks.
- Code and identifiers: Geist Mono.
- Body: 16px minimum, line-height 1.65.
- Labels: 15px/600. Buttons: 14–16px/650.
- Display: fluid `clamp(2.75rem, 7vw, 5.75rem)`, compact tracking.
- Page title: fluid `clamp(2rem, 4vw, 3.5rem)`.
- Use a maximum readable line length of 68 characters for prose.

## Spacing and layout

- 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 112.
- Public max width: 1240px; reading width: 760px; admin max width: 1600px.
- Desktop page gutters: 32–48px. Tablet: 24px. Mobile: 16px.
- Sections: 80–112px vertical desktop, 56–72px mobile.
- Minimum interactive target: 44×44px.

## Shape, borders, and shadow

- Controls: 12px radius; cards: 18px; feature panels: 24px; dialogs: 24px; pills: 999px.
- Borders are always visible in both themes; glass is never the only separator.
- Card shadow: `0 12px 40px rgba(33, 38, 72, .08)`.
- Elevated shadow: `0 24px 70px rgba(20, 24, 56, .16)`.
- Focus: 3px translucent primary ring with 2px surface offset.

## Components

- Top navigation: translucent sticky surface, clear active state, language/theme controls.
- Admin sidebar: 272px expanded, 80px collapsed, independently scrollable; persistent collapse preference.
- Mobile admin: fixed five-item bottom bar plus a More sheet; content receives safe bottom padding.
- Cards: bordered surfaces with eyebrow, title, readable summary, tags, status, and explicit action area.
- Status badges: semantic color plus text/icon—never color alone.
- Forms: grouped in titled panels; labels above fields; help/error text below; sticky save actions on long forms.
- Tables: desktop only. Below 768px each row becomes an information card with the same actions.
- Dialog/lightbox: focus trapped, Escape and close button, viewport-safe padding; certificate viewer supports zoom.
- Empty/error/permission states: icon, plain explanation, and one concrete next action.
- Skeletons preserve final layout to reduce shift.
- Toasts confirm save, publish, archive, restore, upload, and failures without hiding inline errors.

## Motion

- Framer Motion is limited to 160–280ms opacity/translate transitions and light stagger.
- Hover movement is at most 2px; no looping decorative motion.
- Under `prefers-reduced-motion: reduce`, transitions and smooth scrolling are disabled.

## Responsive rules

- Breakpoints: 360/390 mobile checks, 768 tablet, 1024 desktop navigation change, 1366 and 1920 desktop checks.
- Grids use `minmax(0, 1fr)` and collapse 3 → 2 → 1 columns.
- No fixed content widths. Long URLs and filenames use wrapping plus optional middle truncation.
- Images use stable aspect-ratio containers and `object-fit`; certificate thumbnails use lower-resolution transforms.
- Dialogs cap at `calc(100dvh - 32px)` and scroll internally.
- Public filters collapse into a touch-friendly sheet on mobile.

## Accessibility

- WCAG AA contrast target; semantic landmarks and heading order.
- Full keyboard operation, visible focus, skip link, descriptive labels, and live regions for async states.
- Icons that convey meaning have accessible names; decorative icons are hidden.
- Errors are associated with their fields and summarized after failed submit.
- Language is set per locale; dates and numbers use locale-aware formatting.
