import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragEndEvent,
  type DragStartEvent,
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
import { useState, type ReactNode } from "react";

function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(15);
  }
}

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    buzz();
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    buzz();
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  const activeIndex = activeId ? items.findIndex((i) => i.id === activeId) : -1;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {items.map((item, index) => children(item, index))}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeItem ? (
          <div className="pointer-events-none rotate-1 scale-[1.03] opacity-95 shadow-2xl">
            {children(activeItem, activeIndex)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Elemento individual sortable ──────────────────────────────────────────────

/**
 * Envuelve un elemento individual para hacerlo arrastrable.
 * El handle de arrastre es el icono de grip (GripVertical).
 * Mientras se arrastra, el hueco se muestra como marco discontinuo: ahí caerá.
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
    zIndex: isDragging ? 10 : undefined,
  };

  const dropHint = isDragging
    ? "opacity-60 outline-2 outline-dashed outline-offset-2 outline-primary bg-primary/10 [&>*]:invisible"
    : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${dropHint}`}
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
            className="-m-1 cursor-grab touch-none rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing active:bg-primary/15 active:text-primary"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
}
