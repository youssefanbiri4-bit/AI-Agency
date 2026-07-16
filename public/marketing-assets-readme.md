# AgentFlow AI — Marketing Assets Inventory

> **Last updated:** 2026-07-15  
> **Design team:** Internal  
> **Format preferences:** SVG for logos, PNG for screenshots, JPG for photos

---

## Brand Assets

| Asset | File | Format | Dimensions | Usage |
|-------|------|--------|------------|-------|
| Marketing Logo | `logo-marketing.svg` | SVG | Vector | Full-color logo for marketing materials, hero sections, and print |
| Favicon | `favicon.ico` | ICO | 32×32 | Browser tab icon |
| Favicon (SVG) | `favicon.svg` | SVG | Vector | Modern browsers |
| App Icon | `icon.svg` | SVG | Vector | PWA and app icon |
| Apple Touch Icon | `apple-icon.png` | PNG | 180×180 | iOS home screen |
| PWA Icon 192 | `icon-192.png` | PNG | 192×192 | PWA manifest |
| PWA Icon 512 | `icon-512.png` | PNG | 512×512 | PWA manifest |
| Maskable 192 | `maskable-192.png` | PNG | 192×192 | PWA adaptive icon |
| Maskable 512 | `maskable-512.png` | PNG | 512×512 | PWA adaptive icon |
| Agency Mark | `agency-mark.svg` | SVG | Vector | Small mark/badge variant |

## Marketing Images

| Asset | File | Format | Dimensions | Usage |
|-------|------|--------|------------|-------|
| Hero Banner | `hero-banner.png` | PNG | 1920×1080 | Homepage hero background |
| OG Image | `og-image.jpg` | JPG | 1200×630 | Social sharing preview (Open Graph) |
| Social Card | `social-card.png` | PNG | 1200×630 | Social media posts and ads |
| Demo Video Placeholder | `demo-video-placeholder.png` | PNG | 1280×720 | Video thumbnail before demo is produced |
| Dashboard Screenshot | `screenshot-dashboard.png` | PNG | 1920×1080 | Feature pages, blog posts, presentations |
| Workflow Screenshot | `screenshot-workflow.png` | PNG | 1920×1080 | Workflow/automation feature pages |

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Berry) | `#F7CBCA` | Accents, buttons, highlights |
| Primary Dark | `#CA2851` | Hover states, active elements |
| Secondary (Coral) | `#F7CBCA` | Secondary accents |
| Surface | `#F1F7F7` | Page backgrounds |
| Dark Surface | `#5D6B6B` | Dark sections, inverted areas |
| Text Primary | `#000000` | Main body text |
| Text Secondary | `rgba(0,0,0,0.62)` | Secondary text |

## Typography

| Usage | Font | Weight |
|-------|------|--------|
| Headings (Marketing) | Inter | 900 (Black) |
| Body (Marketing) | Inter | 400–700 |
| Code/Mono | JetBrains Mono | Variable |

## Logo Usage Guidelines

1. **Clear space** — Maintain minimum clear space equal to the height of the mark on all sides
2. **Minimum size** — Do not display the logo smaller than 32px in digital media
3. **Backgrounds** — On dark backgrounds, use the white version; on light backgrounds, use the full-color version
4. **Do not** — Alter colors, add effects, rotate, or crop the logo
5. **Favicon** — Always use the SVG favicon for modern browsers with ICO fallback

## OG Image Guidelines

1. **Dimensions** — 1200×630px (1.91:1 aspect ratio)
2. **File size** — Keep under 1MB for fast loading
3. **Text** — Ensure maximum 20% text coverage; text should be legible at small sizes
4. **Branding** — Include AgentFlow AI logo and relevant page title
5. **Updates** — Update OG images whenever the brand or major features change

## Social Card Guidelines

1. **Dimensions** — 1200×630px
2. **Platforms** — Twitter/X, LinkedIn, Facebook, Instagram (stories: 1080×1920)
3. **Text** — Clear headline + CTA, legible without clicking through
4. **Branding** — Consistent with OG image brand identity

## Adding New Assets

When adding new marketing assets to the `public/` directory:

1. Follow the naming convention: `{type}-{description}.{format}`
2. Optimize images (PNG: use pngquant; JPG: use mozjpeg; SVG: use svgo)
3. Update this README with the new asset details
4. For screenshots: capture at 1920×1080, then optimize
5. For social cards: create in both 1200×630 and square (1080×1080) formats

---

*For questions about marketing assets, contact the design team.*
