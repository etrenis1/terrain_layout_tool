import * as THREE from 'three';

export const GRID_SIZE = 25;
const GRID_COUNT = 80;

export class GridManager {
  private grid: THREE.GridHelper;
  private highlightMesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const totalSize = GRID_COUNT * GRID_SIZE;
    this.grid = new THREE.GridHelper(totalSize, GRID_COUNT, 0x444444, 0x333333);
    this.grid.position.y = 0.1;
    scene.add(this.grid);

    // Base highlight is one cell; scaled by setHighlight() to match the tile footprint.
    const highlightGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.rotation.x = -Math.PI / 2;
    this.highlightMesh.position.y = 0.2;
    this.highlightMesh.visible = false;
    scene.add(this.highlightMesh);
  }

  snapToGrid(worldX: number, worldZ: number): { x: number; z: number } {
    return {
      x: Math.round(worldX / GRID_SIZE) * GRID_SIZE,
      z: Math.round(worldZ / GRID_SIZE) * GRID_SIZE,
    };
  }

  // Returns integer grid coordinates — Math.round guards against floating-point drift
  // so cell key strings always use clean integers.
  worldToGrid(snappedX: number, snappedZ: number): { x: number; z: number } {
    return {
      x: Math.round(snappedX / GRID_SIZE),
      z: Math.round(snappedZ / GRID_SIZE),
    };
  }

  gridToWorld(gridX: number, gridZ: number): { x: number; z: number } {
    return { x: gridX * GRID_SIZE, z: gridZ * GRID_SIZE };
  }

  // footprintX/Z are the tile's actual XZ extents in world units after rotation.
  // The highlight is scaled to cover exactly those cells.
  setHighlight(worldX: number, worldZ: number, footprintX = GRID_SIZE, footprintZ = GRID_SIZE): void {
    this.highlightMesh.position.x = worldX;
    this.highlightMesh.position.z = worldZ;
    this.highlightMesh.scale.set(footprintX / GRID_SIZE, 1, footprintZ / GRID_SIZE);
    this.highlightMesh.visible = true;
  }

  hideHighlight(): void {
    this.highlightMesh.visible = false;
  }
}
