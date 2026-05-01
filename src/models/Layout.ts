import { PlacedTile } from './PlacedTile';

export interface Layout {
  id: string;
  name: string;
  savedAt: number;
  placedTiles: PlacedTile[];
}
