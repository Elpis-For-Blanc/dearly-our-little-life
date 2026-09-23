import { useId } from 'react'
import type { FurniturePlacement } from '../types'
import {
  BedDoubleIllustration,
  BedroomBenchIllustration,
  BedSingleIllustration,
  CanopyBedIllustration,
  DresserIllustration,
  FloorMirrorIllustration,
  NightstandIllustration,
  VanityIllustration,
  WardrobeIllustration,
} from './BedroomIllustrations'
import { BedIllustration } from './BedIllustration'
import { FallbackIllustration } from './FallbackIllustration'
import {
  BookrackIllustration,
  CoffeeMachineIllustration,
  ComputerDeskIllustration,
  DeskIllustration,
  DiningBenchIllustration,
  DiningChairIllustration,
  DiningTableIllustration,
  DiningTableLargeIllustration,
  FloorLampIllustration,
  FridgeIllustration,
  KettleIllustration,
  KitchenCabinetIllustration,
  KitchenCounterIllustration,
  MicrowaveIllustration,
  OfficeChairIllustration,
  SinkIllustration,
  StoolIllustration,
  ToasterIllustration,
} from './KitchenStudyIllustrations'
import {
  ArmchairIllustration,
  BookshelfIllustration,
  CoffeeTableIllustration,
  ConsoleIllustration,
  LowCabinetIllustration,
  OttomanIllustration,
  RoundTableIllustration,
  SideTableIllustration,
  SofaLongIllustration,
  SofaSingleIllustration,
  TvStandIllustration,
} from './LivingIllustrations'
import { PlantIllustration } from './PlantIllustration'
import {
  BearDollIllustration,
  BookStackIllustration,
  BunnyDollIllustration,
  CandleIllustration,
  CurtainIllustration,
  CushionIllustration,
  DeskClockIllustration,
  DisplayShelfIllustration,
  FrameIllustration,
  MugIllustration,
  PendantLightIllustration,
  StorageBasketIllustration,
  TableLampIllustration,
  VaseIllustration,
  WallClockIllustration,
  WallMirrorIllustration,
} from './PropIllustrations'
import { RugIllustration } from './RugIllustration'
import { SofaIllustration } from './SofaIllustration'
import { TableIllustration } from './TableIllustration'
import { WindowIllustration } from './WindowIllustration'
import type { FurnitureIllustrationProps } from './types'

interface FurnitureIconProps {
  furnitureId: string
  width: number
  height: number
  colorway: string
  /** The placement's chosen shape (a rug's 원형/직사각형/…) — omit for the default. */
  variant?: string
  /** The placement's per-part color overrides and surface patterns — omit for a plain preset look (catalog cards). */
  colors?: FurniturePlacement['colors']
  patterns?: FurniturePlacement['patterns']
}

/**
 * Branches to the illustration for a furniture type. The catalog card, the
 * properties panel preview, the decorate room and the live room all render
 * through this one component, so a piece always looks identical everywhere.
 * A plain `switch` (not an id → component map used as a JSX tag) keeps oxlint's
 * unstable-component check happy. Falls back if a saved placement references a
 * removed catalog id.
 */
export function FurnitureIcon({ furnitureId, width, height, colorway, variant, colors, patterns }: FurnitureIconProps) {
  // One useId per rendered piece: every pattern id inside its SVG is prefixed with it, so two pieces (or a preview and a placed copy) can never collide on a `<pattern>` id. Colons from useId are replaced so the id is safe inside url(#…).
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '_')
  const style = colors || patterns ? { idPrefix: `fp${uid}`, colors, patterns } : undefined
  const props = { width, height, colorway, variant, style }
  switch (furnitureId) {
    case 'sofa':
      return <SofaIllustration {...props} />
    case 'table':
      return <TableIllustration {...props} />
    case 'bed':
      return <BedIllustration {...props} />
    case 'plant':
      return <PlantIllustration {...props} />
    case 'rug':
      return <RugIllustration {...props} />
    case 'window':
      return <WindowIllustration {...props} />
    case 'sofa-single':
      return <SofaSingleIllustration {...props} />
    case 'sofa-long':
      return <SofaLongIllustration {...props} />
    case 'armchair':
      return <ArmchairIllustration {...props} />
    case 'coffee-table':
      return <CoffeeTableIllustration {...props} />
    case 'side-table':
      return <SideTableIllustration {...props} />
    case 'tv-stand':
      return <TvStandIllustration {...props} />
    case 'bookshelf':
      return <BookshelfIllustration {...props} />
    case 'bed-single':
      return <BedSingleIllustration {...props} />
    case 'bed-double':
      return <BedDoubleIllustration {...props} />
    case 'nightstand':
      return <NightstandIllustration {...props} />
    case 'vanity':
      return <VanityIllustration {...props} />
    case 'wardrobe':
      return <WardrobeIllustration {...props} />
    case 'floor-mirror':
      return <FloorMirrorIllustration {...props} />
    case 'dining-table':
      return <DiningTableIllustration {...props} />
    case 'dining-chair':
      return <DiningChairIllustration {...props} />
    case 'fridge':
      return <FridgeIllustration {...props} />
    case 'kitchen-cabinet':
      return <KitchenCabinetIllustration {...props} />
    case 'sink':
      return <SinkIllustration {...props} />
    case 'microwave':
      return <MicrowaveIllustration {...props} />
    case 'desk':
      return <DeskIllustration {...props} />
    case 'office-chair':
      return <OfficeChairIllustration {...props} />
    case 'bookrack':
      return <BookrackIllustration {...props} />
    case 'floor-lamp':
      return <FloorLampIllustration {...props} />
    case 'table-lamp':
      return <TableLampIllustration {...props} />
    case 'cushion':
      return <CushionIllustration {...props} />
    case 'bunny-doll':
      return <BunnyDollIllustration {...props} />
    case 'bear-doll':
      return <BearDollIllustration {...props} />
    case 'vase':
      return <VaseIllustration {...props} />
    case 'frame':
      return <FrameIllustration {...props} />
    case 'desk-clock':
      return <DeskClockIllustration {...props} />
    case 'book-stack':
      return <BookStackIllustration {...props} />
    case 'mug':
      return <MugIllustration {...props} />
    case 'wall-clock':
      return <WallClockIllustration {...props} />
    case 'curtain':
      return <CurtainIllustration {...props} />
    case 'dresser':
      return <DresserIllustration {...props} />
    case 'candle':
      return <CandleIllustration {...props} />
    case 'canopy-bed':
      return <CanopyBedIllustration {...props} />
    case 'round-table':
      return <RoundTableIllustration {...props} />
    case 'bedroom-bench':
      return <BedroomBenchIllustration {...props} />
    case 'dining-bench':
      return <DiningBenchIllustration {...props} />
    case 'ottoman':
      return <OttomanIllustration {...props} />
    case 'computer-desk':
      return <ComputerDeskIllustration {...props} />
    case 'low-cabinet':
      return <LowCabinetIllustration {...props} />
    case 'console':
      return <ConsoleIllustration {...props} />
    case 'pendant-light':
      return <PendantLightIllustration {...props} />
    case 'wall-mirror':
      return <WallMirrorIllustration {...props} />
    case 'display-shelf':
      return <DisplayShelfIllustration {...props} />
    case 'dining-table-large':
      return <DiningTableLargeIllustration {...props} />
    case 'stool':
      return <StoolIllustration {...props} />
    case 'storage-basket':
      return <StorageBasketIllustration {...props} />
    case 'kitchen-counter':
      return <KitchenCounterIllustration {...props} />
    case 'toaster':
      return <ToasterIllustration {...props} />
    case 'kettle':
      return <KettleIllustration {...props} />
    case 'coffee-machine':
      return <CoffeeMachineIllustration {...props} />
    default:
      return <FallbackIllustration {...props} />
  }
}

export type { FurnitureIllustrationProps }
