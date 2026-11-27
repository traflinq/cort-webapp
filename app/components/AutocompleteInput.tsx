import { useState, useMemo, useRef, useEffect } from "react";
import Fuse from "fuse.js";

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export function AutocompleteInput({
    value,
    onChange,
    options,
    placeholder,
    className,
    required,
}: AutocompleteInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const fuse = useMemo(() => {
        return new Fuse(options, {
            threshold: 0.4,
            distance: 100,
        });
    }, [options]);

    const suggestions = useMemo(() => {
        if (!value) return [];

        // If value matches exactly one of the options, don't show suggestions
        if (options.includes(value)) return [];

        const results = fuse.search(value);
        // Return top 5 matches
        return results.slice(0, 5).map((result) => result.item);
    }, [value, options, fuse]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (suggestions.length > 0) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [suggestions]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === "Enter") {
            if (isOpen && highlightedIndex >= 0) {
                e.preventDefault();
                onChange(suggestions[highlightedIndex]);
                setIsOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (suggestions.length > 0) setIsOpen(true);
                }}
                placeholder={placeholder}
                required={required}
                className={`h-11 w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm outline-none transition-all placeholder:text-[var(--text-placeholder)] focus:border-[var(--cort-orange)] focus:ring-4 focus:ring-[var(--cort-orange)]/10 text-[var(--text-primary)] ${className || ''}`}
            />

            {isOpen && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] shadow-2xl">
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {suggestions.map((suggestion, index) => (
                            <li
                                key={suggestion}
                                onClick={() => {
                                    onChange(suggestion);
                                    setIsOpen(false);
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${index === highlightedIndex
                                        ? "bg-[var(--cort-orange)]/10 text-[var(--cort-orange)]"
                                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                                    }`}
                            >
                                {suggestion}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
