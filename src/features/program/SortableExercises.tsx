"use client";

import { useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import type { ExerciseDef, PlannedExercise } from "@domain/index";
import { GripIcon } from "@shared/components/icons";
import { reorderExercises } from "@/server/program/edit-program";
import { ExerciseRow } from "./ExerciseRow";

function SortableRow({ item, index, byId, library }: {
  item: PlannedExercise;
  index: number;
  byId: Map<string, ExerciseDef>;
  library: ExerciseDef[];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id!,
  });
  const exercise = byId.get(item.exerciseId);
  return (
    <ExerciseRow
      item={item}
      exercise={exercise}
      index={index}
      library={library}
      dragging={isDragging}
      rowRef={setNodeRef}
      rowStyle={{ transform: CSS.Transform.toString(transform), transition }}
      handle={
        // touch-none: the drag starts on the handle only, the rest of the row still scrolls the page
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${exercise?.name ?? "exercise"}`}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      }
    />
  );
}

/** Drag-to-reorder list of a part's exercises. The new order is saved on drop. */
export function SortableExercises({ partId, items, exercises }: {
  partId: string;
  items: PlannedExercise[];
  exercises: ExerciseDef[];
}) {
  const [order, setOrder] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((i) => i.id === active.id);
    const to = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    start(async () => {
      const r = await reorderExercises(partId, next.map((i) => i.id!));
      if (r.ok) setError(null);
      else {
        setOrder(order);
        setError(r.error);
      }
    });
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={order.map((i) => i.id!)} strategy={verticalListSortingStrategy}>
          <ol className="divide-y divide-line">
            {order.map((item, i) => (
              <SortableRow key={item.id} item={item} index={i} byId={byId} library={exercises} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </>
  );
}
