# PWA Icons

This directory should contain the following PWA icon files:

- `icon-192x192.png` — Standard Android home screen icon (192×192px)
- `icon-512x512.png` — Splash screen / install banner icon (512×512px)
- `icon-maskable-192x192.png` — Maskable icon for adaptive shapes (192×192px)
- `icon-maskable-512x512.png` — Maskable icon large (512×512px)

Additionally, the following file should be placed in `public/`:

- `apple-touch-icon.png` — iOS home screen icon (180×180px)

## Notes

- Maskable icons should have extra padding (safe zone) so they display correctly in different shapes (circle, squircle, etc.)
- Use a tool like https://maskable.app/ to test maskable icons
- The theme color is `#1e40af` (Tailwind blue-800)
- Background color for icons should be `#1e40af` or transparent depending on the variant
