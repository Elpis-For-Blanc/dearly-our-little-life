export interface RoomTheme {
  id: string
  name: string
  wallFrom: string
  wallTo: string
  floorFrom: string
  floorTo: string
  baseboard: string
}

/**
 * `'living-room'` keeps its original id from before themes existed, so
 * placements saved by earlier versions keep resolving to the same look.
 */
export const ROOM_THEMES: RoomTheme[] = [
  {
    id: 'living-room',
    name: '아이보리 리빙룸',
    wallFrom: '#faf5ec',
    wallTo: '#f2e6d2',
    floorFrom: '#f3e4cf',
    floorTo: '#e7d0ab',
    baseboard: 'rgba(178, 148, 104, 0.35)',
  },
  {
    id: 'rose',
    name: '로즈 핑크 룸',
    wallFrom: '#faeef4',
    wallTo: '#f4d9e6',
    floorFrom: '#f6e2e9',
    floorTo: '#e9c3d2',
    baseboard: 'rgba(199, 121, 152, 0.35)',
  },
  {
    id: 'blue',
    name: '파스텔 블루 룸',
    wallFrom: '#eef6fb',
    wallTo: '#dcedf6',
    floorFrom: '#e6f1f7',
    floorTo: '#c9dfeb',
    baseboard: 'rgba(120, 160, 185, 0.35)',
  },
  {
    id: 'lavender',
    name: '라벤더 룸',
    wallFrom: '#f5eefb',
    wallTo: '#e8dcf4',
    floorFrom: '#ece2f5',
    floorTo: '#d3c0e6',
    baseboard: 'rgba(154, 128, 190, 0.35)',
  },
  {
    id: 'sage',
    name: '세이지 민트 룸',
    wallFrom: '#f0f6ee',
    wallTo: '#e1edda',
    floorFrom: '#eaf0e2',
    floorTo: '#cddcc0',
    baseboard: 'rgba(129, 155, 100, 0.35)',
  },
]

export function getRoomTheme(id: string): RoomTheme {
  return ROOM_THEMES.find((theme) => theme.id === id) ?? ROOM_THEMES[0]
}
