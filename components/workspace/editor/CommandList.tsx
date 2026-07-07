"use client";

/**
 * CommandList — floating slash-command palette rendered by PageEditor.
 *
 * Receives items + onSelect from the @tiptap/suggestion renderer.
 * Keyboard: ↑↓ to move, Enter to confirm, Escape to close.
 * The parent wires onKeyDown from the suggestion to this component
 * via an imperative ref handle.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SlashCommandItem } from "./SlashCommand";

// ── Imperative handle exposed to suggestion renderer ──────────────────────

export interface CommandListHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  items:    SlashCommandItem[];
  query:    string;
  onSelect: (item: SlashCommandItem) => void;
  /** Cap the palette height (keyboard-aware value from PageEditor). */
  maxHeight?: number;
}

// ── Component ─────────────────────────────────────────────────────────────

const CommandList = forwardRef<CommandListHandle, Props>(
  function CommandList({ items, query, onSelect, maxHeight }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset selection when items change.
    useEffect(() => setSelectedIndex(0), [items]);

    // Scroll selected item into view.
    useEffect(() => {
      const el = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-index="${selectedIndex}"]`
      );
      el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    // Expose keyboard handler to suggestion renderer.
    useImperativeHandle(ref, () => ({
      onKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (e.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (e.key === "Enter") {
          const item = items[selectedIndex];
          if (item) onSelect(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-palette" style={maxHeight ? { maxHeight } : undefined}>
          <div className="slash-palette-empty">No commands match "{query}"</div>
        </div>
      );
    }

    return (
      <div className="slash-palette" ref={listRef} style={maxHeight ? { maxHeight } : undefined}>
        {items.map((item, i) => (
          <button
            key={item.id}
            className="slash-palette-item"
            data-index={i}
            data-active={i === selectedIndex ? "true" : "false"}
            onMouseEnter={() => setSelectedIndex(i)}
            onClick={() => onSelect(item)}
          >
            <span className="slash-palette-icon">{item.icon}</span>
            <span className="slash-palette-text">
              <span className="slash-palette-title">{item.title}</span>
              <span className="slash-palette-desc">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
);

export default CommandList;
