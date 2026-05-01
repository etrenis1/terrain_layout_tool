export interface Rotation3D {
  x: number;
  y: number;
  z: number;
}

export interface PlacedTile {
  instanceId: string;
  tileId: string;
  position: { x: number; z: number };
  rotation: Rotation3D;
}
