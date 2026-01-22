# Caliper Flow Style Architecture

This project uses a modular CSS approach to maintain scalability and avoid class name collisions.

## Structure

Styles are located in `src/styles/`:

- `index.css`: Main entry point that imports all other modules.
- `modules/base.css`: CSS resets, variables, and global body styles.
- `modules/layout.css`: Header, navbar, and main content area layouts.
- `modules/components.css`: Reusable UI elements like buttons, cards, and glassmorphism.
- `modules/animations.css`: Common animation keyframes and classes.
- `modules/modals.css`: styles for modal overlays and content.

## Design System (Variables)

Key colors and tokens are defined in `base.css`:

```css
:root {
  --primary: #22d3ee;
  --secondary: #a855f7;
  --bg-color: #0f172a;
  /* ... */
}
```

## How to add a new style

1. Create a new file in `src/styles/modules/` (e.g., `pages.css`).
2. Add your styles there.
3. Import it in `src/styles/index.css`: `@import './modules/pages.css';`.
