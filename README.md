# Custom DnD Builder

A browser-based React application for creating fully customizable tabletop RPG experiences.

## Project Structure

```
src/
├── routes/                    # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout with mode switcher
│   ├── index.tsx             # Landing page
│   ├── config/               # Configuration mode routes
│   │   ├── index.tsx         # Config dashboard
│   │   ├── skills.tsx        # Main/Speciality/Combat skills
│   │   ├── stats.tsx         # Stats configuration
│   │   ├── materials.tsx     # Materials and categories
│   │   ├── items.tsx         # Items and equipment slots
│   │   ├── races.tsx         # Race configuration
│   │   └── currency.tsx      # Currency tiers
│   └── play/                 # Play mode routes
│       ├── index.tsx         # Character list
│       ├── character.$id.tsx # Character sheet
│       └── create.tsx        # Character creation
├── stores/                   # Zustand state stores
├── engine/                   # Core logic
│   └── formula/             # Formula engine
├── services/                # External interactions
├── components/              # Reusable UI components
│   ├── config/             # Configuration components
│   ├── play/               # Play mode components
│   └── shared/             # Shared components
├── types/                   # TypeScript type definitions
└── utils/                   # Utility functions
```

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Routing**: TanStack Router (file-based routing)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Testing**: Vitest + fast-check

## Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Run tests
yarn test

# Build for production
yarn build
```

## Features

### Configuration Mode
- Define custom skills with 3-letter codes
- Create stats with formula-based calculations
- Build materials with bonuses and tiers
- Design items and equipment systems
- Configure races with skill modifiers
- Set up multi-tier currency systems

### Play Mode
- Create characters with your custom system
- Manage inventory and equipment
- Track stats and skill progression
- Roll combat skills with dice simulation
- All data stored locally in browser

## Development

The application uses file-based routing with TanStack Router. Routes are automatically generated from the `src/routes/` directory structure.

All data persists in browser LocalStorage with import/export capabilities for sharing configurations.

## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
yarn run lint
yarn run format
yarn run check
```
