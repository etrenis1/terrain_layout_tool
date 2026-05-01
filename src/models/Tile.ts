export interface TileDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface Tile {
  id: string;
  name: string;
  dimensions: TileDimensions;
  defaultRotation: 0 | 90 | 180 | 270;
  createdAt: number;
  folderId: string | null;
}
