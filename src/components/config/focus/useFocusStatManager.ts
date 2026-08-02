/**
 * Focus Stat Manager Hook
 *
 * Owns the store selectors, the draft value and the validation for the focus-stat bonus level.
 * The panel renders; this decides — matching every other configuration domain's `useXManager`.
 *
 * The draft is held as a string rather than a number so a half-typed value survives editing; it is
 * only parsed on save, and `isValid` gates that.
 *
 * **Validates: Requirements 9.1, 21.1-21.5**
 */

import { useState } from 'react';
import { useConfigStore } from '../../../stores/configStore';

export function useFocusStatManager() {
  const config = useConfigStore((state) => state.config);
  const setFocusStatBonusLevel = useConfigStore((state) => state.setFocusStatBonusLevel);

  const [draftValue, setDraftValue] = useState<string>(
    config?.focusStatBonusLevel.toString() ?? '0'
  );
  const [hasChanges, setHasChanges] = useState(false);

  const parsed = Number.parseInt(draftValue, 10);
  const isValid = !Number.isNaN(parsed) && parsed >= 0;

  const handleChange = (value: string) => {
    setDraftValue(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!isValid) return;

    // Persistence belongs to the store action
    setFocusStatBonusLevel(parsed);
    setHasChanges(false);
  };

  const handleReset = () => {
    setDraftValue(config?.focusStatBonusLevel.toString() ?? '0');
    setHasChanges(false);
  };

  return {
    config,
    hasConfiguration: config !== null,
    draftValue,
    /** The parsed draft — only meaningful when `isValid` */
    parsedValue: parsed,
    isValid,
    hasChanges,
    handleChange,
    handleSave,
    handleReset,
  };
}
