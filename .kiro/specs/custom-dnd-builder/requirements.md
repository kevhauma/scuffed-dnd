# Requirements Document

## Introduction

This document specifies requirements for a custom DnD experience builder - a React-based frontend application that allows users to configure custom tabletop RPG experiences and enables players to use those configurations. The system operates entirely in the browser with no external API dependencies.

## Glossary

- **User**: The person who configures and designs the custom DnD experience
- **Player**: The person who uses the configured DnD experience to play
- **Character**: A Player's in-game persona with stats, skills, and equipment
- **Main_Skill**: A foundational skill identified by a 3-letter code with a level and points (e.g., STR, WIS, CON)
- **Stat**: A derived numeric value calculated from Main_Skills using User-defined formulas (e.g., health, mana, speed)
- **Speciality_Skill**: A skill similar to Main_Skill but with an additional bonus calculated from a User-defined formula
- **Combat_Skill**: A skill used in combat with configurable dice rolls and bonuses (e.g., melee, ranged, evasion)
- **Material**: A substance that provides bonuses or penalties to skills and has a monetary value
- **Material_Level**: A tier within a Material that scales bonuses and value
- **Material_Category**: A User-defined grouping of related Materials
- **Item**: An object with description, optional Material, optional Equipment_Slot, and category
- **Equipment_Slot**: A designated place on a Character where Items can be equipped (e.g., helmet, main hand)
- **Inventory**: A Character's collection of Equipment_Slots and miscellaneous Item storage
- **Race**: A Character lineage that provides bonuses or penalties to Main_Skills
- **Focus_Stat**: A Main_Skill or Speciality_Skill that a Character specializes in, receiving bonus levels
- **Currency_Tier**: A level in the monetary system with conversion rates between tiers
- **Configuration**: The complete User-defined ruleset for the DnD experience
- **Formula**: A User-defined mathematical expression used to calculate derived values

## Requirements

### Requirement 1: User Configuration Management

**User Story:** As a User, I want to create and manage custom DnD configurations, so that I can design unique game experiences.

#### Acceptance Criteria

1. THE Application SHALL provide a configuration creation interface
2. THE Application SHALL store configurations in browser local storage
3. WHEN a User creates a configuration, THE Application SHALL initialize empty skill, material, item, race, and currency systems
4. THE Application SHALL allow Users to export configurations as JSON files
5. THE Application SHALL allow Users to import configurations from JSON files
6. THE Application SHALL prevent data loss by validating imported configurations before applying them

### Requirement 2: Main Skills Configuration

**User Story:** As a User, I want to define custom main skills, so that I can create the foundational building blocks for my game system.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Main_Skills with a 3-letter code identifier
2. THE Application SHALL enforce unique 3-letter codes for each Main_Skill
3. THE Application SHALL allow Users to set a maximum level for each Main_Skill
4. THE Application SHALL allow Users to define point allocation rules for Main_Skills
5. THE Application SHALL allow Users to delete Main_Skills that are not referenced by other system components
6. WHEN a Main_Skill is referenced by other components, THE Application SHALL prevent deletion and display dependent components

### Requirement 3: Stats Configuration and Derivation

**User Story:** As a User, I want to define stats derived from main skills using custom formulas, so that I can create dynamic character attributes.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Stats with custom formulas
2. THE Application SHALL support formula syntax that references Main_Skill codes
3. THE Application SHALL validate formulas for syntax errors before saving
4. THE Application SHALL calculate Stat maximum values using the defined formulas
5. THE Application SHALL allow Players to track current Stat values separately from maximum values
6. WHEN Main_Skill values change, THE Application SHALL recalculate dependent Stat maximum values

### Requirement 4: Speciality Skills Configuration

**User Story:** As a User, I want to define speciality skills with bonus formulas, so that I can create advanced skill mechanics.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Speciality_Skills with 3-letter codes
2. THE Application SHALL allow Users to define a base level system for Speciality_Skills
3. THE Application SHALL allow Users to define bonus formulas that reference Main_Skills
4. THE Application SHALL calculate total Speciality_Skill values as base level plus formula bonus
5. THE Application SHALL validate Speciality_Skill formulas before saving

### Requirement 5: Combat Skills Configuration

**User Story:** As a User, I want to define combat skills with custom dice rolls and bonuses, so that I can create varied combat mechanics.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Combat_Skills with 3-letter codes
2. THE Application SHALL allow Users to configure multiple dice types for each Combat_Skill (d4, d6, d8, d10, d12, d20)
3. THE Application SHALL allow Users to specify quantity for each die type
4. THE Application SHALL allow Users to define bonus formulas that reference Main_Skills and Speciality_Skills
5. WHEN a Player uses a Combat_Skill, THE Application SHALL simulate dice rolls and add calculated bonuses
6. THE Application SHALL display the breakdown of dice results and bonuses for each roll

### Requirement 6: Materials System Configuration

**User Story:** As a User, I want to define materials with bonuses and value, so that I can create meaningful item crafting mechanics.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Materials with names and descriptions
2. THE Application SHALL allow Users to assign Materials to Material_Categories
3. THE Application SHALL allow Users to create Material_Categories
4. THE Application SHALL allow Users to define multiple Material_Levels for each Material
5. THE Application SHALL allow Users to specify skill bonuses and penalties for each Material_Level
6. THE Application SHALL allow Users to set monetary values for each Material_Level
7. THE Application SHALL support bonuses and penalties to Main_Skills, Speciality_Skills, and Combat_Skills

### Requirement 7: Items System Configuration

**User Story:** As a User, I want to define items with materials and equipment slots, so that I can create a comprehensive equipment system.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Items with names and descriptions
2. THE Application SHALL allow Users to assign an optional Material to each Item
3. THE Application SHALL allow Users to assign an optional Equipment_Slot type to each Item
4. THE Application SHALL allow Users to categorize Items with User-defined categories
5. THE Application SHALL allow Users to define Equipment_Slot types (helmet, shoes, main hand, off hand, etc.)
6. WHEN an Item has a Material, THE Application SHALL inherit the Material's bonuses

### Requirement 8: Character Race Configuration

**User Story:** As a User, I want to define character races with skill modifiers, so that I can create diverse character options.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Races with names and descriptions
2. THE Application SHALL allow Users to define Main_Skill bonuses and penalties for each Race
3. THE Application SHALL support multiple Races per Character
4. WHEN a Character has multiple Races, THE Application SHALL combine bonuses additively
5. THE Application SHALL display the total racial modifiers on the Character sheet

### Requirement 9: Focus Stats Configuration

**User Story:** As a User, I want to define focus stat mechanics, so that characters can specialize in specific skills.

#### Acceptance Criteria

1. THE Application SHALL allow Users to configure focus stat bonus levels
2. THE Application SHALL allow Characters to select one Main_Skill or Speciality_Skill as their Focus_Stat
3. WHEN a Character selects a Focus_Stat, THE Application SHALL apply the configured bonus level
4. THE Application SHALL limit each Character to one Focus_Stat

### Requirement 10: Currency System Configuration

**User Story:** As a User, I want to define a multi-tier currency system, so that I can create realistic economies.

#### Acceptance Criteria

1. THE Application SHALL allow Users to create Currency_Tiers with names
2. THE Application SHALL allow Users to define conversion rates between Currency_Tiers
3. THE Application SHALL allow Users to order Currency_Tiers from lowest to highest value
4. THE Application SHALL display Item and Material values in the appropriate Currency_Tiers
5. THE Application SHALL convert between Currency_Tiers using the defined conversion rates

### Requirement 11: Character Creation

**User Story:** As a Player, I want to create characters using the configured system, so that I can participate in the game.

#### Acceptance Criteria

1. THE Application SHALL allow Players to create Characters with names
2. THE Application SHALL allow Players to select one or more Races for their Character
3. THE Application SHALL allow Players to allocate points to Main_Skills according to User-defined rules
4. THE Application SHALL allow Players to select a Focus_Stat
5. THE Application SHALL calculate all derived Stats, Speciality_Skills, and Combat_Skills automatically
6. THE Application SHALL initialize an empty Inventory with configured Equipment_Slots

### Requirement 12: Character Inventory Management

**User Story:** As a Player, I want to manage my character's inventory, so that I can equip items and track possessions.

#### Acceptance Criteria

1. THE Application SHALL display all Equipment_Slots for a Character
2. THE Application SHALL allow Players to assign Items to Equipment_Slots
3. WHEN an Item is assigned to an Equipment_Slot, THE Application SHALL verify the Item's Equipment_Slot type matches
4. THE Application SHALL provide miscellaneous inventory slots for Items without Equipment_Slot types
5. THE Application SHALL allow Players to move Items between Equipment_Slots and miscellaneous slots
6. THE Application SHALL allow Players to remove Items from Inventory

### Requirement 13: Equipment Bonus Calculation

**User Story:** As a Player, I want equipped items to affect my character's stats, so that equipment choices matter.

#### Acceptance Criteria

1. WHEN an Item is equipped, THE Application SHALL apply the Item's Material bonuses to the Character
2. THE Application SHALL combine bonuses from all equipped Items additively
3. THE Application SHALL recalculate Main_Skills, Speciality_Skills, and Combat_Skills when equipment changes
4. THE Application SHALL display equipment bonuses separately from base values on the Character sheet
5. WHEN an Item is unequipped, THE Application SHALL remove its bonuses from the Character

### Requirement 14: Character Stat Manipulation

**User Story:** As a Player, I want to track current stat values during gameplay, so that I can manage resources like health and mana.

#### Acceptance Criteria

1. THE Application SHALL display both current and maximum values for all Stats
2. THE Application SHALL allow Players to modify current Stat values
3. THE Application SHALL prevent current Stat values from exceeding maximum values
4. THE Application SHALL allow current Stat values to be negative if gameplay requires it
5. THE Application SHALL persist current Stat values with the Character

### Requirement 15: Combat Skill Rolling

**User Story:** As a Player, I want to roll combat skills with visual feedback, so that I can resolve combat actions.

#### Acceptance Criteria

1. THE Application SHALL provide a roll interface for each Combat_Skill
2. WHEN a Player initiates a roll, THE Application SHALL simulate all configured dice
3. THE Application SHALL calculate and add the bonus from the Combat_Skill formula
4. THE Application SHALL display individual die results, bonus value, and total result
5. THE Application SHALL maintain a roll history for the current session

### Requirement 16: Formula Engine

**User Story:** As a User, I want a robust formula system, so that I can create complex game mechanics.

#### Acceptance Criteria

1. THE Application SHALL support basic arithmetic operators (+, -, *, /, parentheses)
2. THE Application SHALL support referencing Main_Skills by their 3-letter codes in formulas
3. THE Application SHALL support referencing Speciality_Skills by their 3-letter codes in formulas
4. THE Application SHALL validate formula syntax and display clear error messages
5. THE Application SHALL prevent circular dependencies in formulas
6. WHEN a formula references an undefined skill code, THE Application SHALL display an error

### Requirement 17: Data Persistence

**User Story:** As a User and Player, I want my data to persist between sessions, so that I don't lose my work.

#### Acceptance Criteria

1. THE Application SHALL save all Configuration changes to browser local storage automatically
2. THE Application SHALL save all Character changes to browser local storage automatically
3. WHEN the Application loads, THE Application SHALL restore the last used Configuration
4. THE Application SHALL restore all saved Characters on load
5. THE Application SHALL handle local storage quota errors gracefully

### Requirement 18: Configuration Validation

**User Story:** As a User, I want the system to validate my configuration, so that I can identify issues before players use it.

#### Acceptance Criteria

1. THE Application SHALL validate that all formula references point to existing skills
2. THE Application SHALL detect circular dependencies in formulas
3. THE Application SHALL validate that Equipment_Slot types referenced by Items exist
4. THE Application SHALL validate that Material_Categories referenced by Materials exist
5. THE Application SHALL display a validation report with all detected issues
6. THE Application SHALL allow Users to view validation status at any time

### Requirement 19: User Interface Modes

**User Story:** As a User and Player, I want distinct configuration and play modes, so that the interface matches my current task.

#### Acceptance Criteria

1. THE Application SHALL provide a configuration mode for Users
2. THE Application SHALL provide a play mode for Players
3. THE Application SHALL allow switching between configuration and play modes
4. WHEN in configuration mode, THE Application SHALL display all configuration tools
5. WHEN in play mode, THE Application SHALL display character management and gameplay tools
6. THE Application SHALL prevent Players from modifying Configuration in play mode

### Requirement 20: No Hardcoded Data

**User Story:** As a User, I want complete control over all game data, so that I can create truly custom experiences.

#### Acceptance Criteria

1. THE Application SHALL NOT include any predefined Main_Skills
2. THE Application SHALL NOT include any predefined Stats
3. THE Application SHALL NOT include any predefined Materials
4. THE Application SHALL NOT include any predefined Items
5. THE Application SHALL NOT include any predefined Races
6. THE Application SHALL NOT include any predefined Currency_Tiers
7. WHEN a new Configuration is created, THE Application SHALL start with empty systems requiring User input

### Requirement 21: Component Library Architecture

**User Story:** As a Developer, I want a clear separation between base UI components and feature components, so that the application maintains consistent styling and reusable components.

#### Acceptance Criteria

1. THE Application SHALL provide a component library containing all base UI components (inputs, buttons, selects, textareas, checkboxes, etc.)
2. THE base components SHALL encapsulate all intrinsic styling (colors, borders, padding, typography, hover states, focus states)
3. THE base components SHALL NOT include positioning styles (margin, flex properties, grid properties, absolute/relative positioning)
4. THE feature components SHALL use base components from the component library exclusively
5. THE feature components SHALL handle all layout and positioning concerns (flexbox, grid, margins, spacing)
6. THE base components SHALL accept className props to allow feature components to add positioning styles when needed
7. THE Application SHALL maintain visual consistency by centralizing all base component styling in the component library

### Requirement 22: Medieval Visual Theme

**User Story:** As a User and Player, I want the application to have a medieval aesthetic, so that it feels appropriate for a tabletop RPG experience.

#### Acceptance Criteria

1. THE Application SHALL use a medieval-inspired visual theme throughout the interface
2. THE visual design SHALL evoke a medieval aesthetic without requiring highly detailed ornamentation
3. THE Application SHALL avoid modern UI patterns that break immersion (e.g., overly flat design, neon colors, modern sans-serif fonts as primary typography)
4. THE Application SHALL use design elements that suggest a fantasy/medieval context (e.g., parchment-like backgrounds, serif or medieval-style fonts, earthy color palettes, subtle textures)
5. THE medieval theme SHALL remain subtle enough to not interfere with usability and readability
6. THE Application SHALL maintain accessibility standards while applying the medieval theme
