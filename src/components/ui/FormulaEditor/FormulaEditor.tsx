/**
 * Formula Editor Component
 *
 * Base formula input that surfaces validation errors inline rather than discarding them.
 *
 * **Validates: Requirements 16.4, 16.6, 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import { useState } from 'react';
import { validateFormula as validateFormulaSyntax } from '../../../engine/formula/validator';
import { Input } from '../Input/Input';
import { Label } from '../Label/Label';
import {
  containerStyles,
  errorMessageStyles,
  suggestionItemStyles,
  suggestionListStyles,
} from './FormulaEditor.style';

export interface FormulaEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableVariables: string[];
  onValidate?: (isValid: boolean, error?: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function FormulaEditor({
  value,
  onChange,
  availableVariables,
  onValidate,
  label,
  placeholder = 'Enter formula (e.g., STR * 2 + DEX)',
  className = '',
}: FormulaEditorProps) {
  const [error, setError] = useState<string | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Validate through the formula engine. Never scan the string here: a regex over
  // `skills.STL + 1` sees a bare `STL` that isn't there, and only the parser knows the
  // difference between a bare code and a namespace member.
  const validate = (formulaValue: string) => {
    if (!formulaValue.trim()) {
      setError(undefined);
      onValidate?.(true);
      return;
    }

    const result = validateFormulaSyntax(formulaValue, new Set(availableVariables));

    if (result.isValid) {
      setError(undefined);
      onValidate?.(true);
      return;
    }

    const errorMsg = result.errors.join('; ');
    setError(errorMsg);
    onValidate?.(false, errorMsg);
  };

  // Handle autocomplete suggestions and validation
  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    // Validate the new value
    validate(newValue);

    // Get the last word being typed
    // `^` belongs here with the other operators (TICKET-FORM-07): without it `STR^D` is one
    // word, and suggestions stop appearing after a tightly-typed power
    const words = newValue.split(/[\s+\-*/^()]/);
    const lastWord = words[words.length - 1].toUpperCase();

    if (lastWord.length > 0 && lastWord.length < 3) {
      // Show suggestions for partial matches
      const matches = availableVariables.filter((v) => v.startsWith(lastWord));
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Replace the last partial word with the suggestion
    const words = value.split(/(\s+|[+\-*/^()])/);
    words[words.length - 1] = suggestion;
    onChange(words.join(''));
    setShowSuggestions(false);
  };

  return (
    <div className={`${containerStyles} ${className}`}>
      {label && <Label className="mb-2">{label}</Label>}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          error={!!error}
          className="font-mono"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className={suggestionListStyles}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={suggestionItemStyles}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className={errorMessageStyles}>{error}</div>}
    </div>
  );
}
