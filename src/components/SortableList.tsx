import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

// ─── Wrapper de lista ordenable ────────────────────────────────────────────────

/**
 * Envuelve una lista de elementos con DnD.
 * @param items  Array de objetos con id (string).
 * @param onReorder  Callback con la nueva lista reordenada completa.
 * @param children  Render de cada elemento: recibe el id.
 * @param strategy  "vertical" o "grid" (defecto: "vertical").
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  strategy = "vertical",
}: {
  items: T[];
  onReorder: (newItems: T[]) => void;
  children: (item: T, index: number) => ReactNode;
  strategy?: "vertical" | "grid";
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item, index) => children(item, index))}
      </SortableContext>
    </DndContext>
  );
}

// ─── Elemento individual sortable ──────────────────────────────────────────────

/**
 * Envuelve un elemento individual para hacerlo arrastrable.
 * El handle de arrastre es el icono de grip (GripVertical).
 * @param id  ID único del elemento.
 * @param children  Contenido del elemento.
 * @param handleOnly  Si true, solo el handle de grip activa el arrastre.
 * @param className  Clases adicionales para el wrapper.
 */
export function SortableItem({
  id,
  children,
  className = "",
  handleOnly = false,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  handleOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...(handleOnly ? {} : { ...attributes, ...listeners })}
    >
      {handleOnly ? (
        <>
          {/* Grip handle — único punto de arrastre */}
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label="Arrastrar para reordenar"
            className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
}
