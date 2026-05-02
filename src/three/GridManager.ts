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

  // Snap worldX/Z to the correct tile center based on cell-count parity.
  // Odd-cell dimensions snap to cell centers (e.g. 12.5, 37.5 …);
  // even-cell dimensions snap to grid lines (e.g. 0, 25, 50 …).
  snapForTile(worldX: number, worldZ: number, widthCells: number, depthCells: number): { x: number; z: number } {
    return {
      x: this.snapAxis(worldX, widthCells),
      z: this.snapAxis(worldZ, depthCells),
    };
  }

  private snapAxis(value: number, cells: number): number {
    if (cells % 2 === 1) {
      return Math.round((value - GRID_SIZE / 2) / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
    }
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  // Anchor cell = top-left cell of the tile's footprint, derived from its world center.
  worldToAnchorCell(centerX: number, centerZ: number, widthCells: number, depthCells: number): { x: number; z: number } {
    return {
      x: Math.round(centerX / GRID_SIZE - widthCells / 2),
      z: Math.round(centerZ / GRID_SIZE - depthCells / 2),
    };
  }

  // World center of a tile given its anchor cell and footprint dimensions.
  anchorCellToWorld(anchorX: number, anchorZ: number, widthCells: number, depthCells: number): { x: number; z: number } {
    return {
      x: (anchorX + widthCells / 2) * GRID_SIZE,
      z: (anchorZ + depthCells / 2) * GRID_SIZE,
    };
  }

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
