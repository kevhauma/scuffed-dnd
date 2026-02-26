# Implementation Plan: Custom DnD Builder

## Overview

This plan implements a browser-based React application for creating and playing custom tabletop RPG experiences. The implementation follows a layered architecture: Data Layer (types and storage) → Core Logic (formula engine and calculators) → State Management (Zustand stores) → UI Components (configuration and play modes). The application uses TypeScript, React 18+, Vite, TanStack Router, Zustand, and Tailwind CSS.

## Tasks

- [x] 1. Project setup and core infrastructure
  - Install dependencies: Zustand, Tailwind CSS, Vitest, fast-check
  - Configure Tailwind CSS with medieval theme (fonts, colors, textures)
  - Add medieval/fantasy fonts (serif or medieval-style typefaces)
  - Define earthy color palette (browns, tans, dark greens, muted golds)
  - Set up TanStack Router file-based routing structure
  - Create basic project directory structure (routes, stores, engine, services, components, types, utils, components/ui)
  - _Requirements: 1.1, 19.1, 19.2, 22.1-22.6_

- [x] 2. Define core TypeScript types and data models
  - [x] 2.1 Create configuration types
    - Define Configuration, MainSkill, Stat, SpecialitySkill, CombatSkill types
    - Define Material, MaterialLevel, MaterialCategory, Item, EquipmentSlot types
    - Define Race, CurrencyTier, SkillModifier, CurrencyValue types
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 10.1, 20.1-20.7_
  
  - [x] 2.2 Create character types
    - Define Character, Inventory, CalculatedCharacter types
    - Define helper types for character state management
    - _Requirements: 11.1, 12.1, 14.1_
  
  - [x] 2.3 Create formula engine types
    - Define FormulaAST, FormulaContext, FormulaValidationResult types
    - Define DiceConfig and dice result types
    - _Requirements: 16.1, 5.2_

- [x] 3. Implement formula engine
  - [x] 3.1 Create formula parser
    - Implement tokenizer for formula strings
    - Build AST parser supporting +, -, *, /, parentheses
    - Support variable references (3-letter skill codes)
    - _Requirements: 16.1, 16.2, 3.2_
  
  - [x] 3.2 Create formula evaluator
    - Implement AST evaluation with FormulaContext
    - Handle arithmetic operations with proper precedence
    - Return calculated numeric results
    - _Requirements: 3.4, 4.4, 5.4_
  
  - [x] 3.3 Create formula validator
    - Validate formula syntax and return clear error messages
    - Detect undefined variable references
    - Detect circular dependencies in formula chains
    - Return list of referenced variables
    - _Requirements: 3.3, 4.5, 16.4, 16.5, 16.6, 18.1, 18.2_

- [x] 4. Implement calculation engine
  - [x] 4.1 Create stat calculator
    - Calculate maximum stat values from formulas and main skill levels
    - Recalculate when main skill levels change
    - Apply racial bonuses to main skills before calculation
    - _Requirements: 3.4, 3.6, 8.4_
  
  - [x] 4.2 Create speciality skill calculator
    - Calculate bonus from formula
    - Combine base level with formula bonus
    - Apply focus stat bonus if applicable
    - _Requirements: 4.3, 4.4, 9.3_
  
  - [x] 4.3 Create combat skill bonus calculator
    - Calculate bonus from formula referencing main and speciality skills
    - Support equipment bonuses in calculation
    - _Requirements: 5.4, 13.3_
  
  - [x] 4.4 Create equipment bonus aggregator
    - Collect bonuses from all equipped items
    - Combine bonuses additively
    - Apply material bonuses from items
    - _Requirements: 13.1, 13.2, 7.6_

- [ ] 5. Implement dice rolling system
  - [ ] 5.1 Create dice simulator
    - Simulate rolls for d4, d6, d8, d10, d12, d20
    - Support multiple dice of each type
    - Return individual die results
    - _Requirements: 5.5_
  
  - [ ] 5.2 Create combat roll aggregator
    - Combine dice results with calculated bonuses
    - Return breakdown of dice results, bonus, and total
    - _Requirements: 5.5, 5.6_

- [x] 6. Implement storage service
  - [x] 6.1 Create LocalStorage abstraction
    - Implement save/load for Configuration
    - Implement save/load for Character array
    - Handle JSON serialization/deserialization
    - Handle storage quota errors gracefully
    - _Requirements: 1.2, 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [x] 6.2 Create import/export service
    - Export Configuration as JSON file
    - Import Configuration from JSON file
    - Validate imported configuration before applying
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 7. Implement configuration validation service
  - [x] 7.1 Create configuration validator
    - Validate formula references point to existing skills
    - Validate equipment slot types referenced by items exist
    - Validate material categories referenced by materials exist
    - Validate no circular dependencies in formulas
    - Generate validation report with all issues
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 8. Create Zustand stores
  - [x] 8.1 Create ConfigStore
    - Initialize empty configuration state
    - Implement actions for CRUD operations on all config entities
    - Implement auto-save to LocalStorage on changes
    - Implement load from LocalStorage on init
    - _Requirements: 1.1, 1.2, 1.3, 17.1, 17.3_
  
  - [x] 8.2 Create CharacterStore
    - Initialize character list state
    - Implement character CRUD operations
    - Implement inventory management actions
    - Implement current stat value updates
    - Implement auto-save to LocalStorage on changes
    - Implement load from LocalStorage on init
    - _Requirements: 11.1, 12.5, 12.6, 14.2, 17.2, 17.4_
  
  - [x] 8.3 Create UIStore
    - Implement mode switching (config/play)
    - Implement dialog state management
    - Implement validation result storage
    - Implement roll history tracking
    - _Requirements: 19.3, 15.5_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create base component library with medieval theme
  - [x] 10.1 Create Button component
    - Implement base button with medieval styling (borders, colors, hover states)
    - Support variants (primary, secondary, danger)
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only (no margin/positioning)
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.2 Create Input component
    - Implement text input with medieval styling (parchment-like background, borders)
    - Support different input types (text, number)
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.3 Create Select component
    - Implement dropdown select with medieval styling
    - Support multi-select variant
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.4 Create Textarea component
    - Implement textarea with medieval styling
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.5 Create Checkbox component
    - Implement checkbox with medieval styling
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.6 Create Card component
    - Implement card container with parchment/medieval styling
    - Support header and footer sections
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.7 Create Label component
    - Implement form label with medieval typography
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.8 Create Dialog component
    - Implement modal dialog with medieval styling
    - Support header, body, footer sections
    - Accept className prop for positioning
    - Encapsulate intrinsic styles only
    - _Requirements: 21.1-21.5, 22.1-22.6_
  
  - [ ] 10.9 Create FormulaEditor component
    - Use base Input component
    - Implement formula input with syntax highlighting
    - Add autocomplete for available skill codes
    - Display real-time validation feedback
    - Show error messages for invalid formulas
    - Handle layout/positioning with className
    - _Requirements: 3.3, 4.5, 16.4, 21.1-21.5_
  
  - [ ] 10.10 Create ValidationReport component
    - Use base Card component
    - Display validation issues grouped by severity
    - Make issues clickable to navigate to problem area
    - Show summary count of issues
    - Handle layout/positioning with className
    - _Requirements: 18.5, 18.6, 21.1-21.5_

- [ ] 11. Implement configuration mode UI components
  - [ ] 11.1 Create SkillsConfigPanel component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display main skills list with add/edit/delete actions
    - Enforce unique 3-letter codes
    - Show dependency warnings before deletion
    - Display speciality skills with formula editor
    - Display combat skills with dice configuration
    - Handle all layout/positioning in this component
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 21.1-21.5_
  
  - [ ] 11.2 Create StatsConfigPanel component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display stats list with add/edit/delete actions
    - Integrate FormulaEditor for stat formulas
    - Show preview of calculated values with sample inputs
    - Handle all layout/positioning in this component
    - _Requirements: 3.1, 3.2, 3.3, 21.1-21.5_
  
  - [ ] 11.3 Create MaterialsConfigPanel component
    - Use base components (Button, Input, Select, Card, Label) exclusively
    - Display material categories with CRUD operations
    - Display materials nested under categories
    - Display material levels with bonus/penalty editor
    - Implement value editor with currency tier selection
    - Handle all layout/positioning in this component
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 21.1-21.5_
  
  - [ ] 11.4 Create ItemsConfigPanel component
    - Use base components (Button, Input, Select, Card, Label) exclusively
    - Display items list with filtering by category
    - Implement material assignment dropdown
    - Implement equipment slot type selector
    - Support optional material and equipment slot
    - Handle all layout/positioning in this component
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 21.1-21.5_
  
  - [ ] 11.5 Create RacesConfigPanel component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display races list with add/edit/delete actions
    - Implement skill modifier editor for main skills
    - Show preview of total modifiers
    - Handle all layout/positioning in this component
    - _Requirements: 8.1, 8.2, 8.5, 21.1-21.5_
  
  - [ ] 11.6 Create CurrencyConfigPanel component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display ordered currency tiers list
    - Implement drag-to-reorder functionality
    - Implement conversion rate editor
    - Show conversion calculator preview
    - Handle all layout/positioning in this component
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 21.1-21.5_
  
  - [ ] 11.7 Create EquipmentSlotsConfig component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display equipment slot types with CRUD operations
    - Handle all layout/positioning in this component
    - _Requirements: 7.5, 21.1-21.5_
  
  - [ ] 11.8 Create FocusStatConfig component
    - Use base components (Button, Input, Card, Label) exclusively
    - Configure focus stat bonus level
    - Handle all layout/positioning in this component
    - _Requirements: 9.1, 21.1-21.5_

- [ ] 12. Implement play mode UI components
  - [ ] 12.1 Create CharacterList component
    - Use base components (Button, Card) exclusively
    - Display all characters with names and summary info
    - Implement create character button
    - Implement delete character action with confirmation
    - Implement select character navigation
    - Handle all layout/positioning in this component
    - _Requirements: 11.1, 17.4, 21.1-21.5_
  
  - [ ] 12.2 Create CharacterCreationWizard component
    - Use base components (Button, Input, Select, Card, Label) exclusively
    - Step 1: Name input and race selection (multi-select)
    - Step 2: Main skill point allocation with validation
    - Step 3: Focus stat selection (one main or speciality skill)
    - Step 4: Review and confirm
    - Calculate all derived values automatically
    - Initialize empty inventory with equipment slots
    - Handle all layout/positioning in this component
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 21.1-21.5_
  
  - [ ] 12.3 Create CharacterSheet component
    - Use base components (Button, Input, Card, Label) exclusively
    - Display character header (name, races)
    - Display main skills with racial bonuses shown separately
    - Display stats with current/max values and edit controls
    - Display speciality skills (calculated, read-only)
    - Display combat skills with roll buttons
    - Integrate InventoryPanel
    - Handle all layout/positioning in this component
    - _Requirements: 8.5, 13.4, 14.1, 14.2, 21.1-21.5_
  
  - [ ] 12.4 Create InventoryPanel component
    - Use base components (Button, Select, Card, Label) exclusively
    - Display equipment slots grid
    - Display miscellaneous items list
    - Implement drag-and-drop item assignment
    - Implement add item from catalog
    - Implement remove item action
    - Validate equipment slot type matches when assigning
    - Handle all layout/positioning in this component
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 21.1-21.5_
  
  - [ ] 12.5 Create CombatSkillRoller component
    - Use base components (Button, Card) exclusively
    - Display roll button for each combat skill
    - Implement animated dice display with medieval aesthetics
    - Show result breakdown (individual dice, bonus, total)
    - Maintain roll history for session
    - Handle all layout/positioning in this component
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 21.1-21.5, 22.1-22.6_
  
  - [ ] 12.6 Create StatEditor component
    - Use base components (Button, Input, Label) exclusively
    - Display current and maximum stat values
    - Allow editing current values
    - Prevent current from exceeding maximum
    - Allow negative current values
    - Handle all layout/positioning in this component
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 21.1-21.5_

- [ ] 13. Implement routing and layout
  - [ ] 13.1 Create root layout
    - Use base components (Button, Card) exclusively
    - Implement mode switcher (config/play) with medieval styling
    - Create navigation for each mode
    - Prevent config modification in play mode
    - Handle all layout/positioning in this component
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 21.1-21.5, 22.1-22.6_
  
  - [ ] 13.2 Create configuration mode routes
    - /config - Dashboard with validation status
    - /config/skills - Skills configuration
    - /config/stats - Stats configuration
    - /config/materials - Materials configuration
    - /config/items - Items configuration
    - /config/races - Races configuration
    - /config/currency - Currency configuration
    - _Requirements: 19.4_
  
  - [ ] 13.3 Create play mode routes
    - /play - Character list
    - /play/create - Character creation wizard
    - /play/character/:id - Character sheet
    - _Requirements: 19.5_

- [ ] 14. Implement equipment bonus system
  - [ ] 14.1 Wire equipment changes to recalculation
    - When item equipped, trigger bonus recalculation
    - When item unequipped, remove bonuses and recalculate
    - Update character sheet display automatically
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 15. Implement import/export UI
  - [ ] 15.1 Create export button in config mode
    - Use base Button component
    - Trigger JSON file download with current configuration
    - Handle layout/positioning with className
    - _Requirements: 1.4, 21.1-21.5_
  
  - [ ] 15.2 Create import button in config mode
    - Use base Button and Dialog components
    - Open file picker for JSON files
    - Validate imported configuration
    - Show validation errors if any
    - Apply configuration if valid
    - Handle layout/positioning with className
    - _Requirements: 1.5, 1.6, 21.1-21.5_

- [ ] 16. Implement currency conversion utilities
  - [ ] 16.1 Create currency converter
    - Convert between currency tiers using conversion rates
    - Display item and material values in appropriate tiers
    - _Requirements: 10.4, 10.5_

- [ ] 17. Final integration and polish
  - [ ] 17.1 Wire all stores to components
    - Ensure all components use Zustand stores correctly
    - Verify auto-save triggers on all state changes
    - Test LocalStorage persistence across page reloads
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [ ] 17.2 Implement validation UI integration
    - Use base components (Button, Card) exclusively
    - Add validation status indicator to config dashboard
    - Add "Validate Configuration" button
    - Display ValidationReport when validation runs
    - Handle layout/positioning with className
    - _Requirements: 18.5, 18.6, 21.1-21.5_
  
  - [ ] 17.3 Test multi-race character support
    - Verify bonuses combine additively
    - Verify display shows all races
    - _Requirements: 8.3, 8.4_
  
  - [ ] 17.4 Test formula recalculation flows
    - Verify stats recalculate when main skills change
    - Verify speciality skills recalculate when dependencies change
    - Verify combat bonuses recalculate when equipment changes
    - _Requirements: 3.6, 13.3_
  
  - [ ] 17.5 Verify medieval theme consistency
    - Check all components use medieval styling consistently
    - Verify fonts, colors, and textures applied throughout
    - Test accessibility with medieval theme
    - Ensure readability and usability maintained
    - _Requirements: 22.1-22.6_
  
  - [ ] 17.6 Verify component library architecture
    - Ensure all feature components use base components exclusively
    - Verify base components have no positioning styles
    - Verify feature components handle all layout/positioning
    - Check className props work correctly for positioning
    - _Requirements: 21.1-21.5_

- [ ] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation follows a bottom-up approach: data models → logic → state → UI
- All formula-related functionality is centralized in the formula engine
- LocalStorage auto-save ensures no data loss during development
- Base component library (components/ui) encapsulates medieval theme and intrinsic styling
- Feature components use base components exclusively and handle all layout/positioning
- Medieval theme uses earthy colors, serif/medieval fonts, parchment textures while maintaining accessibility
