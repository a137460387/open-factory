'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SearchBarProps {
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
}

export function SearchBar({
  value: controlledValue,
  onChange,
  placeholder = 'Search plugins, effects, transitions...',
  autoFocus = false,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState('');
  const value = controlledValue ?? internalValue;
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setInternalValue(next);
      }
      // Debounce the onChange callback
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange?.(next);
      }, 300);
    },
    [controlledValue, onChange],
  );

  const handleClear = useCallback(() => {
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
    inputRef.current?.focus();
  }, [controlledValue, onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      {/* Search icon */}
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
        <svg
          className="h-4 w-4 text-[var(--text-tertiary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-3 pl-11 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all focus:border-[var(--accent)] focus:outline-none focus:ring-1"
        style={{ '--tw-ring-color': 'rgba(var(--accent-rgb), 0.3)' } as React.CSSProperties}
      />

      {/* Clear button */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
          aria-label="Clear search"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
