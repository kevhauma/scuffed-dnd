# CR-39 — Unused exports and a storage key nothing writes

**Severity:** Low · **Area:** engine, uiStore, services · **Type:** dead code

## Summary

Three confirmed-unused public surfaces (fallow static analysis, zero importers):

1. `FormulaParser` class export — `src/engine/formula/parser.ts:257`. The module's function
   surface (`parseFormula` etc.) is the real API.
2. `DialogState` type export — `src/stores/uiStore.ts:22`.
3. `dnd_builder_ui_state` LocalStorage key — defined and cleared in `clearAllData`
   (`src/services/storage.ts:27,225`) but nothing ever writes it; `uiStore` is fully ephemeral.
   Either a dead key or a persistence someone forgot to build.

## Impact

Noise in the public API; the phantom storage key suggests intent (persisted UI state?) that
either should be built or removed so the next reader doesn't chase it.

## Suggested direction

Un-export (or delete) the first two; for the storage key, decide: if uiStore persistence is
wanted (e.g. surviving roll history — see [CR-06](CR-06-clear-history-wipes-all-characters.md)),
keep the key and build it; otherwise delete key + clear line.
