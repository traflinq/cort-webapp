import { useState, useMemo, useRef, useEffect, useId } from "react";
import Fuse from "fuse.js";
import { inputBase } from "@/app/admin/ui";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    required?: boolean;
}

/** Free-text input with fuzzy suggestions (ARIA combobox). Styled with the shared kit input. */
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
    const listId = useId();

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

    const open = isOpen && suggestions.length > 0;

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
                autoComplete="off"
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
                className={cn(inputBase, className)}
            />

            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-popover p-1 text-fg shadow-[var(--shadow-modal)] animate-menu-in"
                >
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === highlightedIndex}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                onChange(suggestion);
                                setIsOpen(false);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={cn(
                                "cursor-pointer rounded-md px-2.5 py-2 text-sm transition-colors",
                                index === highlightedIndex ? "bg-subtle text-fg" : "text-fg-secondary",
                            )}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
