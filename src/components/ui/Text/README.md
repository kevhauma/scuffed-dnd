# Text Component

A base text component with semantic variants for consistent typography throughout the application.

## Usage

```tsx
import { Text } from '@/components/ui';

// Basic usage
<Text>Default body text</Text>

// With variant
<Text variant="h2">Heading Text</Text>

// With custom element
<Text variant="body-secondary" as="p">
  Paragraph with secondary color
</Text>

// With additional classes
<Text variant="highlight" className="mb-4">
  STR
</Text>
```

## Available Variants

### Body Text
- `body` - Default body text (base size, ink-900)
- `body-secondary` - Secondary body text (base size, ink-700)
- `body-small` - Small body text (sm size, ink-900)
- `body-small-secondary` - Small secondary text (sm size, ink-700)

### Headings
- `h1` - Extra large heading (4xl, font-heading, semibold)
- `h2` - Large heading (3xl, font-heading, semibold)
- `h3` - Medium heading (2xl, font-heading, semibold)
- `h4` - Small heading (xl, font-heading, semibold)
- `h5` - Extra small heading (lg, font-heading, semibold)
- `h6` - Tiny heading (base, font-heading, semibold)

### Semantic Variants
- `label` - Form labels (sm, ink-900, medium weight)
- `caption` - Captions and small notes (xs, ink-700)
- `code` - Inline code (sm, mono font, parchment background)
- `error` - Error messages (sm, crimson)
- `success` - Success messages (sm, forest)
- `warning` - Warning messages (sm, amber)
- `muted` - Muted text (sm, ink-600)

### Special Variants
- `highlight` - Highlighted text badge (sm, mono, amber on parchment, rounded)

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `TextVariant` | `'body'` | Visual variant of the text |
| `as` | `'p' \| 'span' \| 'div' \| 'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6' \| 'label'` | `'span'` | HTML element to render |
| `children` | `React.ReactNode` | - | Content to display |
| `className` | `string` | `''` | Additional CSS classes for positioning |
| `htmlFor` | `string` | - | For label elements only |

## Examples

### Headings
```tsx
<Text variant="h1" as="h1">Main Title</Text>
<Text variant="h2" as="h2">Section Title</Text>
<Text variant="h3" as="h3">Subsection</Text>
```

### Body Text
```tsx
<Text variant="body" as="p">
  This is the main body text with default styling.
</Text>

<Text variant="body-secondary" as="p">
  This is secondary text with a lighter color.
</Text>
```

### Semantic Usage
```tsx
{/* Error message */}
<Text variant="error">This field is required</Text>

{/* Success message */}
<Text variant="success">Changes saved successfully</Text>

{/* Code snippet */}
<Text variant="code">STR * 2 + DEX</Text>

{/* Highlighted badge */}
<Text variant="highlight">STR</Text>
```

### With Layout
```tsx
<div className="flex justify-between">
  <Text variant="body-small-secondary">Max Level:</Text>
  <Text variant="body-small" className="font-semibold">10</Text>
</div>
```

## Design Principles

The Text component follows the base component architecture:

- **Encapsulates intrinsic styles**: Colors, typography, padding, borders
- **No positioning styles**: No margin, flexbox, or positioning properties
- **Accepts className**: For positioning and layout by parent components
- **Medieval theme**: Uses theme colors and fonts consistently
