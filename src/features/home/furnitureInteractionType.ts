import { getSitSlots, getStandSlots, getUsableLieSlots } from '../simulation/furnitureInteractionEngine'
import type { FurnitureDefinition } from './types'

/**
 * A display/classification label for "what kind of thing is this piece",
 * per the spec's own seat/table/storage/decor/lighting grouping — **never**
 * a new stored field on `FurnitureDefinition`, and never consulted by the
 * actual interaction/auto-furniture-use systems (`furnitureUsageTrigger.ts`,
 * `autoFurnitureUseEngine.ts`), which already correctly gate on the real
 * `interactionSlots` data (a piece with zero `'sit'`/`'lie'` slots was
 * already never offerable as a seat, with or without this classifier — see
 * `isSittableFurniture`/`isLieableFurniture`). This module exists purely so
 * catalog UI (a future filter/badge) can *label* a piece correctly without
 * duplicating slot data into a second, driftable field.
 */
export type InteractionTypeLabel = 'seat' | 'lie' | 'table' | 'storage' | 'lighting' | 'decor'

export const INTERACTION_TYPE_LABELS: Record<InteractionTypeLabel, string> = {
  seat: '좌석',
  lie: '침구',
  table: '테이블',
  storage: '수납',
  lighting: '조명',
  decor: '장식',
}

/**
 * Table-type pieces that, like the original `desk`, have no real
 * interaction slot of their own (a character sits in a *separate* chair
 * placed nearby, never on the table/desk itself — see CLAUDE.md's furniture
 * interaction sections) — so they can't be distinguished from `'decor'` by
 * slot data alone. Kept as a small, explicit, documented set rather than a
 * derived guess; add a new no-slot table-like piece's id here when one is
 * added (`furnitureInteractionType.test.ts`'s catalog-completeness check
 * fails loudly if a real 'kitchen'/'study'/'living' table-shaped piece is
 * left out, so this can't silently drift).
 */
const TABLE_TYPE_NO_SLOT_IDS = new Set(['desk', 'computer-desk', 'coffee-table', 'side-table'])

/**
 * Storage-purpose pieces — their whole reason for existing is holding
 * things, never sitting/lying/standing-at. Same "explicit, documented,
 * completeness-tested" reasoning as `TABLE_TYPE_NO_SLOT_IDS` above.
 */
const STORAGE_IDS = new Set([
  'nightstand',
  'vanity',
  'wardrobe',
  'dresser',
  'tv-stand',
  'bookshelf',
  'bookrack',
  'kitchen-cabinet',
  'sink',
  'fridge',
  'low-cabinet',
  'console',
  'kitchen-counter',
])

/**
 * Classifies a furniture definition into the spec's seat/table/storage/
 * decor/lighting grouping. Order matters: a real interaction slot always
 * wins first (so a piece that's genuinely sittable/lie-able/usable-as-a-
 * table is never mislabeled `'storage'`/`'decor'` just because it also
 * happens to share a category with storage furniture), then the explicit
 * no-slot-table set, then `lightSource`, then the explicit storage set,
 * and finally `'decor'` as the catch-all for everything else (rugs,
 * plants, frames, mirrors, props, window/wall decor).
 */
export function classifyInteractionType(definition: FurnitureDefinition): InteractionTypeLabel {
  if (getSitSlots(definition).length > 0) return 'seat'
  if (getUsableLieSlots(definition).length > 0) return 'lie'
  if (getStandSlots(definition).length > 0) return 'table'
  if (TABLE_TYPE_NO_SLOT_IDS.has(definition.id)) return 'table'
  if (definition.lightSource) return 'lighting'
  if (STORAGE_IDS.has(definition.id)) return 'storage'
  return 'decor'
}
