import { useState } from 'react';
import { Input } from '../Input/Input';
import { Label } from '../Label/Label';
import { containerStyles, errorMessageStyles, suggestionListStyles, suggestionItemStyles } from './FormulaEditor.style';

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

  // Validate formula and check for undefined variables
  const validateFormula = (formulaValue: string) => {
    if (!formulaValue.trim()) {
      setError(undefined);
      onValidate?.(true);
      return;
    }

    // Extract potential variable references (3-letter uppercase sequences)
    const variablePattern = /\b[A-Z]{3}\b/g;
    const referencedVars = formulaValue.match(variablePattern) || [];
    const undefinedVars = referencedVars.filter(v => !availableVariables.includes(v));

    if (undefinedVars.length > 0) {
      const errorMsg = `Undefined variables: ${undefinedVars.join(', ')}`;
      setError(errorMsg);
      onValidate?.(false, errorMsg);
    } else {
      setError(undefined);
      onValidate?.(true);
    }
  };

  // Handle autocomplete suggestions and validation
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Validate the new value
    validateFormula(newValue);

    // Get the last word being typed
    const words = newValue.split(/[\s+\-*/()]/);
    const lastWord = words[words.length - 1].toUpperCase();

    if (lastWord.length > 0 && lastWord.length < 3) {
      // Show suggestions for partial matches
      const matches = availableVariables.filter(v => v.startsWith(lastWord));
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Replace the last partial word with the suggestion
    const words = value.split(/(\s+|[+\-*/()])/);
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
