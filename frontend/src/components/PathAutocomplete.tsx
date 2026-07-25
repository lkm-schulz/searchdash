import { useEffect, useRef, useState } from "react";
import { fetchBrowse } from "../api/client";
import type { BrowseEntry } from "../api/types";
import { cn } from "../util";

interface PathAutocompleteProps {
  /** Current input text (controlled by the parent). */
  value: string;
  /** Called as the text changes (typing, completing, or descending into a directory). */
  onChange: (value: string) => void;
  /** Called to open a datadir: Enter, or clicking a datadir suggestion / recent entry. */
  onSubmit: (path: string) => void;
  /** Recently opened datadirs, newest first, shown in the history dropdown. */
  recent: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 150;

/**
 * Path input with fish-shell-style directory completion and a recent-history
 * dropdown. Shared by the home picker and the dashboard header editor.
 *
 * Typing queries the browse endpoint for child directories (datadirs badged).
 * Completion mirrors fish: Tab on a single match descends into it immediately;
 * Tab on multiple matches freezes the candidate set and cycles through it,
 * previewing each in the input (Shift+Tab cycles back). Pressing `/` accepts the
 * previewed candidate and descends into it. Enter opens a datadir (or descends a
 * plain dir); Escape closes the dropdown.
 */
export default function PathAutocomplete({
  value,
  onChange,
  onSubmit,
  recent,
  placeholder,
  autoFocus,
}: PathAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<BrowseEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [selected, setSelected] = useState(-1);
  // Non-null while Tab-cycling: the frozen candidate set being cycled, so live
  // browse results don't reshuffle the list mid-cycle.
  const [cycle, setCycle] = useState<BrowseEntry[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = cycle ?? suggestions;

  useEffect(() => {
    // Suppress browsing while cycling: the candidate set is frozen until commit.
    if (!open || cycle) return;
    let active = true;
    const timer = setTimeout(() => {
      fetchBrowse(value)
        .then((entries) => active && setSuggestions(entries))
        .catch(() => active && setSuggestions([]));
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, open, cycle]);

  const resetCycle = () => {
    setCycle(null);
    setSelected(-1);
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowRecent(false);
        resetCycle();
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /** Descend into a directory: fill its path (trailing slash) and re-browse children. */
  const descend = (entry: BrowseEntry) => {
    resetCycle();
    setOpen(true);
    onChange(`${entry.path}/`);
  };

  /** Insert (don't open) a selected entry: fill its path; a datadir lands exactly, a plain dir descends. */
  const insert = (entry: BrowseEntry) => {
    if (entry.isDatadir) {
      resetCycle();
      setOpen(true);
      onChange(entry.path);
    } else {
      descend(entry);
    }
  };

  /** Act on a chosen entry: open a datadir, else descend into a plain directory. */
  const choose = (entry: BrowseEntry) => {
    if (entry.isDatadir) {
      onSubmit(entry.path);
    } else {
      descend(entry);
    }
  };

  const onTab = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) return; // nothing to complete: let focus move on
    event.preventDefault();
    if (cycle) {
      const len = cycle.length;
      const next = event.shiftKey ? (selected - 1 + len) % len : (selected + 1) % len;
      setSelected(next);
      onChange(cycle[next].path);
    } else if (items.length === 1) {
      descend(items[0]);
    } else {
      setCycle(items);
      setSelected(0);
      setOpen(true);
      onChange(items[0].path);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      onTab(event);
    } else if (event.key === "/" && cycle && selected >= 0) {
      event.preventDefault();
      descend(cycle[selected]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (items.length === 0) return;
      const next = Math.min(selected + 1, items.length - 1);
      setSelected(next);
      if (cycle) onChange(items[next].path);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(selected - 1, cycle ? 0 : -1);
      setSelected(next);
      if (cycle && next >= 0) onChange(items[next].path);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selected >= 0 && selected < items.length) {
        insert(items[selected]);
      } else {
        onSubmit(value);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setShowRecent(false);
      resetCycle();
    }
  };

  return (
    <div className="path-autocomplete" ref={containerRef}>
      <div className="path-input-row">
        <div className="path-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="path-input"
            value={value}
            placeholder={placeholder}
            autoFocus={autoFocus}
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setShowRecent(false);
              resetCycle();
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <div className="path-inset-actions">
            {value && (
              <button
                type="button"
                className="path-inset-btn path-clear"
                title="Clear path"
                aria-label="Clear path"
                onClick={() => {
                  onChange("");
                  resetCycle();
                  setOpen(true);
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
            {recent.length > 0 && (
              <button
                type="button"
                className="path-inset-btn path-recent-toggle"
                title="Recent experiments"
                aria-label="Recent experiments"
                onClick={() => {
                  setShowRecent((s) => !s);
                  setOpen(false);
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4.5V8l2.4 1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="path-icon-btn path-open"
          title="Open this datadir"
          aria-label="Open this datadir"
          disabled={!value.trim()}
          onClick={() => onSubmit(value)}
        >
          →
        </button>
      </div>

      {showRecent && recent.length > 0 && (
        <ul className="path-dropdown">
          {recent.map((path) => (
            <li key={path}>
              <button
                type="button"
                className="path-option"
                onClick={() => {
                  setShowRecent(false);
                  onSubmit(path);
                }}
              >
                <span className="path-option-name">{path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && items.length > 0 && (
        <ul className="path-dropdown">
          {items.map((entry, index) => (
            <li key={entry.path}>
              <button
                type="button"
                className={cn("path-option", index === selected && "highlighted")}
                onMouseEnter={() => setSelected(index)}
                onClick={() => choose(entry)}
              >
                <span className="path-option-name">{entry.name}</span>
                {entry.isDatadir && <span className="path-option-badge">datadir</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
