import { useRef, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PillToggle from "./PillToggle";
interface SortablePillsProps<T> {
  /** Items in their current (drag-authored) display order. */
  items: T[];
  /** Membership set marking which items are on. */
  selected: Set<T>;
  /** Stable string id per item (dnd-kit ids must be strings; `null` needs a sentinel). */
  getKey: (item: T) => string;
  /** Pill label for an item. */
  renderLabel: (item: T) => ReactNode;
  /** Toggle an item on/off (click, not drag). */
  onToggle: (item: T) => void;
  /** New item order after a drag-and-drop reorder. */
  onReorder: (items: T[]) => void;
}

/** One draggable pill: wires `useSortable` onto `PillToggle`. */
function SortablePill({
  id,
  checked,
  label,
  onToggle,
}: {
  id: string;
  checked: boolean;
  label: ReactNode;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // CSS.Translate (not CSS.Transform) drops the scaleX/scaleY the horizontal
  // strategy attaches, which would otherwise stretch/shrink the pill as the
  // cursor moves. We only want the translate.
  return (
    <PillToggle
      ref={setNodeRef}
      checked={checked}
      onChange={onToggle}
      {...attributes}
      {...listeners}
      className={isDragging ? "is-dragging" : undefined}
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
    >
      {label}
    </PillToggle>
  );
}

/**
 * Horizontal list of toggle pills whose order the user can change by dragging.
 * A small pointer-move threshold distinguishes a click (toggle) from a drag
 * (reorder); a post-drag guard also suppresses the stray click the browser
 * fires after a pointerup that completed a drag. Keyboard accessible via
 * `@dnd-kit`'s `KeyboardSensor` (space to grab, arrows to move).
 */
export function SortablePills<T>({
  items,
  selected,
  getKey,
  renderLabel,
  onToggle,
  onReorder,
}: SortablePillsProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Suppresses the click event browsers fire right after a drag-completing
  // pointerup, which would otherwise toggle the dropped pill.
  const justDraggedRef = useRef(false);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => getKey(item) === active.id);
    const to = items.findIndex((item) => getKey(item) === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(items, from, to));
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 50);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getKey)} strategy={horizontalListSortingStrategy}>
        <div className="sortable-pills">
          {items.map((item) => (
            <SortablePill
              key={getKey(item)}
              id={getKey(item)}
              checked={selected.has(item)}
              label={renderLabel(item)}
              onToggle={() => {
                if (justDraggedRef.current) return;
                onToggle(item);
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
