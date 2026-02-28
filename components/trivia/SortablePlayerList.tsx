'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface SortablePlayer {
  id: number
  name: string
  team: string
  position: string
}

interface SortablePlayerListProps {
  players: SortablePlayer[]
  onReorder: (players: SortablePlayer[]) => void
}

function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-[#5a5a64]"
    >
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  )
}

function SortablePlayerCard({
  player,
  rank,
}: {
  player: SortablePlayer
  rank: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-xl border transition-colors select-none ${
        isDragging
          ? 'border-[#fbbf24] bg-[#fbbf24]/10 shadow-lg shadow-[#fbbf24]/5'
          : 'border-[#1e1e2a] bg-[#111118]'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 p-1"
        aria-label={`Reorder ${player.name}`}
      >
        <GripIcon />
      </button>

      {/* Rank badge */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm font-bold flex-shrink-0 bg-[#fbbf24] text-[#0a0a0f]">
        {rank}
      </div>

      {/* Player info */}
      <div className="text-left flex-1 min-w-0">
        <div className="font-mono font-bold text-[#e8e6e3] text-sm sm:text-base truncate">
          {player.name}
        </div>
        <div className="text-xs text-[#8a8a94] truncate">
          {player.team} &middot; {player.position}
        </div>
      </div>
    </div>
  )
}

export function SortablePlayerList({ players, onReorder }: SortablePlayerListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = players.findIndex(p => p.id === active.id)
    const newIndex = players.findIndex(p => p.id === over.id)
    onReorder(arrayMove(players, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={players.map(p => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="max-w-lg mx-auto space-y-3">
          {players.map((player, idx) => (
            <SortablePlayerCard
              key={player.id}
              player={player}
              rank={idx + 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
