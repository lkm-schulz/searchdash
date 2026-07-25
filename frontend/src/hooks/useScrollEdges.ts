import { useEffect, useRef, useState, type RefObject } from "react";

export interface ScrollEdges {
  /** Content is hidden past the left edge (the element is scrolled rightward). */
  left: boolean;
  /** Content is hidden past the right edge (more remains to scroll into view). */
  right: boolean;
}

/**
 * Tracks the horizontal-scroll position of a referenced element and reports
 * whether content overflows past either edge — used to fade the table sides as
 * a "more columns" affordance. Re-measures on scroll, on element resize, and
 * whenever `deps` change (column/row count alters the scrollable width without
 * resizing the element itself). Returns the ref to attach and the edge flags.
 */
export function useScrollEdges<T extends HTMLElement>(deps: unknown[] = []): {
  ref: RefObject<T>;
  edges: ScrollEdges;
} {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setEdges({
        left: scrollLeft > 1,
        right: scrollLeft + clientWidth < scrollWidth - 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, edges };
}
