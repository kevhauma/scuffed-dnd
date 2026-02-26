# Medieval Theme Configuration

This directory contains the medieval theme configuration for the Custom DnD Builder application.

## Theme Overview

The application uses a medieval-inspired visual theme to create an immersive tabletop RPG experience. The theme is configured using Tailwind CSS v4's `@theme` directive in `src/styles.css`.

## Color Palette

### Parchment Tones (Backgrounds)
- `parchment-50`: #fdfbf7 - Lightest parchment
- `parchment-100`: #f8f4e8 - Light parchment (main background)
- `parchment-200`: #f0e8d0 - Base parchment
- `parchment-300`: #e8dbb8 - Aged parchment
- `parchment-400`: #d4c5a0 - Dark parchment

### Ink Tones (Text)
- `ink-900`: #2a2419 - Deep ink black (primary text)
- `ink-800`: #3d3529 - Dark ink
- `ink-700`: #4f4739 - Medium ink
- `ink-600`: #6b5d4f - Light ink (secondary text)

### Accent Colors (Medieval Dyes)
- `crimson`: #8b2e2e - Deep red (danger, delete actions)
- `forest`: #3a5a40 - Deep green (success, confirm actions)
- `royal`: #2e4057 - Deep blue (primary actions)
- `amber`: #b8860b - Dark gold (highlights, focus states)

### Stone Tones (Neutral)
- `stone-100`: #e8e4df
- `stone-200`: #d1cbc2
- `stone-300`: #b9b2a5
- `stone-400`: #9a9188

## Typography

### Font Families
- **Body Text**: "Crimson Text" - Readable serif with medieval character
- **Headings**: "Cinzel" - Decorative medieval style
- **Code/Formulas**: "Courier New" - Monospace for technical content

Usage in Tailwind:
```tsx
<h1 className="font-heading">Medieval Heading</h1>
<p className="font-body">Body text with medieval feel</p>
<code className="font-mono">formula code</code>
```

## Custom Shadows

- `shadow-parchment`: Subtle shadow for cards and panels
- `shadow-parchment-lg`: Elevated shadow for modals and popovers

## Usage Examples

### Background Colors
```tsx
<div className="bg-parchment-100">Main background</div>
<div className="bg-parchment-50">Card background</div>
```

### Text Colors
```tsx
<p className="text-ink-900">Primary text</p>
<p className="text-ink-600">Secondary text</p>
```

### Accent Colors
```tsx
<button className="bg-royal text-white">Primary Action</button>
<button className="bg-crimson text-white">Delete</button>
<button className="bg-forest text-white">Confirm</button>
```

### Focus States
```tsx
<input className="focus:ring-2 focus:ring-amber" />
```

## Accessibility

The theme maintains WCAG AA standards:
- Body text on parchment: 7:1 contrast ratio (AAA)
- Interactive elements: Minimum 4.5:1 contrast ratio
- Focus indicators: High contrast amber on all backgrounds
- All interactive elements have visible focus states

## Design Principles

1. **Subtle Immersion**: Evoke medieval aesthetics without overwhelming the interface
2. **Readability First**: Never sacrifice legibility for aesthetic effect
3. **Accessibility Compliance**: Maintain WCAG standards for contrast and focus states
4. **Avoid Modern Patterns**: Minimize flat design, neon colors, and contemporary sans-serif typography
5. **Texture and Depth**: Use subtle shadows and borders to create tactile feel
