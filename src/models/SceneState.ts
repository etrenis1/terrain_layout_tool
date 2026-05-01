import { PlacedTile } from './PlacedTile';

export interface SceneState {
  version: 1;
  placedTiles: PlacedTile[];
  savedAt: number;
}

export const EMPTY_SCENE_STATE: SceneState = {
  version: 1,
  placedTiles: [],
  savedAt: 0,
};
