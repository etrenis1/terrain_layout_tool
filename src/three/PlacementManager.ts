import * as THREE from 'three';
import { PlacedTile, Rotation3D } from '../models/PlacedTile';
import { Tile } from '../models/Tile';
import { GridManager, GRID_SIZE } from './GridManager';

export type RotationAxis = 'x' | 'y' | 'z';

// Always snap to 45° granularity so 45° and 90° steps can be freely mixed.
function snapDeg(deg: number): number {
  return ((Math.round(deg / 45) * 45) % 360 + 360) % 360;
}

// Grid-based AABB collision is only meaningful when every rotation axis is a
// multiple of 90°. A tile at 45° has a diamond footprint — the rectangular
// cell system can't represent it.
function isAxisAligned(rot: Rotation3D): boolean {
  return rot.x % 90 === 0 && rot.y % 90 === 0 && rot.z % 90 === 0;
}

interface RotatedBounds {
  yOffset: number;
  widthCells: number;
  depthCells: number;
  footprintX: number;
  footprintZ: number;
}

// Rotate the geometry's local bounding box by the given Euler angles and read extents.
// This handles all three axes correctly — critical when X/Z rotation fixes a sideways import.
function computeRotatedBounds(
  geometry: THREE.BufferGeometry,
  rotX: number,
  rotY: number,
  rotZ: number,
): RotatedBounds {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!.clone();
  box.applyMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(rotX),
        THREE.MathUtils.degToRad(rotY),
        THREE.MathUtils.degToRad(rotZ),
      ),
    ),
  );
  const size = new THREE.Vector3();
  box.getSize(size);
  // Use floor+threshold instead of round so that the √2 AABB inflation from a
  // 45° rotation doesn't push a tile into a larger cell count than its logical
  // footprint. A cell is only added when the overhang exceeds 30% of a cell.
  const widthCells = Math.max(1, Math.floor(size.x / GRID_SIZE + 0.3));
  const depthCells = Math.max(1, Math.floor(size.z / GRID_SIZE + 0.3));
  return {
    yOffset: -box.min.y,
    widthCells,
    depthCells,
    footprintX: widthCells * GRID_SIZE,
    footprintZ: depthCells * GRID_SIZE,
  };
}

// Enumerate all cell keys occupied by a tile given its anchor (top-left) cell.
function getOccupiedCells(anchorX: number, anchorZ: number, widthCells: number, depthCells: number): string[] {
  const cells: string[] = [];
  for (let dx = 0; dx < widthCells; dx++) {
    for (let dz = 0; dz < depthCells; dz++) {
      cells.push(`${anchorX + dx},${anchorZ + dz}`);
    }
  }
  return cells;
}

export class PlacementManager {
  private scene: THREE.Scene;
  private gridManager: GridManager;

  private ghostMesh: THREE.Mesh | null = null;
  private activeTile: Tile | null = null;
  private activeGeometry: THREE.BufferGeometry | null = null;
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private isBlocked = false;
  private cachedBounds: RotatedBounds | null = null;

  // Tracks which cells each placed tile occupies so removal is O(k) not O(n).
  private placedMeshes: Map<string, { mesh: THREE.Mesh; tile: Tile; rotation: Rotation3D }> = new Map();
  private placedCells: Map<string, string[]> = new Map();
  private occupiedCells: Set<string> = new Set();

  private ghostMaterialNormal = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  private ghostMaterialBlocked = new THREE.MeshStandardMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  constructor(scene: THREE.Scene, gridManager: GridManager) {
    this.scene = scene;
    this.gridManager = gridManager;
  }

  activateTile(tile: Tile, geometry: THREE.BufferGeometry): void {
    this.clearGhost();
    this.activeTile = tile;
    this.activeGeometry = geometry;
    this.rotX = 0;
    this.rotY = tile.defaultRotation;
    this.rotZ = 0;
    this.cachedBounds = null;
    this.createGhost();
  }

  deactivate(): void {
    this.clearGhost();
    this.gridManager.hideHighlight();
    this.activeTile = null;
    this.activeGeometry = null;
    this.cachedBounds = null;
  }

  private getBounds(): RotatedBounds {
    if (!this.cachedBounds && this.activeGeometry) {
      this.cachedBounds = computeRotatedBounds(this.activeGeometry, this.rotX, this.rotY, this.rotZ);
    }
    return this.cachedBounds ?? { yOffset: 0, widthCells: 1, depthCells: 1, footprintX: GRID_SIZE, footprintZ: GRID_SIZE };
  }

  private createGhost(): void {
    if (!this.activeGeometry) return;
    this.ghostMesh = new THREE.Mesh(this.activeGeometry, this.ghostMaterialNormal);
    this.applyGhostRotation();
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);
  }

  private clearGhost(): void {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
  }

  private applyGhostRotation(): void {
    if (!this.ghostMesh) return;
    this.cachedBounds = null; // invalidate cache whenever rotation changes
    const bounds = this.getBounds();
    this.ghostMesh.rotation.set(
      THREE.MathUtils.degToRad(this.rotX),
      THREE.MathUtils.degToRad(this.rotY),
      THREE.MathUtils.degToRad(this.rotZ),
    );
    this.ghostMesh.position.y = bounds.yOffset;
  }

  rotateAxis(axis: RotationAxis, direction: 1 | -1, step: 45 | 90 = 90): void {
    const delta = step * direction;
    if (axis === 'x') this.rotX = snapDeg(this.rotX + delta);
    else if (axis === 'y') this.rotY = snapDeg(this.rotY + delta);
    else this.rotZ = snapDeg(this.rotZ + delta);
    this.applyGhostRotation();
  }

  getCurrentRotation(): Rotation3D {
    return { x: this.rotX, y: this.rotY, z: this.rotZ };
  }

  updateGhostPosition(worldX: number, worldZ: number): void {
    if (!this.ghostMesh || !this.activeTile) return;
    const bounds = this.getBounds();
    const snapped = this.gridManager.snapForTile(worldX, worldZ, bounds.widthCells, bounds.depthCells);

    this.ghostMesh.position.set(snapped.x, bounds.yOffset, snapped.z);
    this.ghostMesh.visible = true;

    const currentRot = { x: this.rotX, y: this.rotY, z: this.rotZ };
    if (isAxisAligned(currentRot)) {
      const anchor = this.gridManager.worldToAnchorCell(snapped.x, snapped.z, bounds.widthCells, bounds.depthCells);
      const cells = getOccupiedCells(anchor.x, anchor.z, bounds.widthCells, bounds.depthCells);
      this.isBlocked = cells.some((c) => this.occupiedCells.has(c));
      this.gridManager.setHighlight(snapped.x, snapped.z, bounds.footprintX, bounds.footprintZ);
    } else {
      // Non-axis-aligned: block only if another tile is already at the same snap position.
      this.isBlocked = Array.from(this.placedMeshes.values()).some(
        (e) => Math.abs(e.mesh.position.x - snapped.x) < 1 && Math.abs(e.mesh.position.z - snapped.z) < 1,
      );
      this.gridManager.setHighlight(snapped.x, snapped.z, bounds.footprintX, bounds.footprintZ);
    }
    this.ghostMesh.material = this.isBlocked ? this.ghostMaterialBlocked : this.ghostMaterialNormal;
  }

  hideGhost(): void {
    if (this.ghostMesh) this.ghostMesh.visible = false;
    this.gridManager.hideHighlight();
  }

  place(worldX: number, worldZ: number): PlacedTile | null {
    if (!this.activeTile || !this.activeGeometry || this.isBlocked) return null;

    const rotation = { x: this.rotX, y: this.rotY, z: this.rotZ };
    const bounds = this.getBounds();
    const snapped = this.gridManager.snapForTile(worldX, worldZ, bounds.widthCells, bounds.depthCells);

    const aligned = isAxisAligned(rotation);
    const anchor = this.gridManager.worldToAnchorCell(snapped.x, snapped.z, bounds.widthCells, bounds.depthCells);
    const cells = aligned ? getOccupiedCells(anchor.x, anchor.z, bounds.widthCells, bounds.depthCells) : [];

    if (aligned && cells.some((c) => this.occupiedCells.has(c))) return null;
    if (!aligned && Array.from(this.placedMeshes.values()).some(
      (e) => Math.abs(e.mesh.position.x - snapped.x) < 1 && Math.abs(e.mesh.position.z - snapped.z) < 1,
    )) return null;

    const instanceId = crypto.randomUUID();
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(this.activeGeometry, mat);
    mesh.position.set(snapped.x, bounds.yOffset, snapped.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(this.rotX),
      THREE.MathUtils.degToRad(this.rotY),
      THREE.MathUtils.degToRad(this.rotZ),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.instanceId = instanceId;
    this.scene.add(mesh);

    this.placedMeshes.set(instanceId, { mesh, tile: this.activeTile, rotation });
    this.placedCells.set(instanceId, cells);
    cells.forEach((c) => this.occupiedCells.add(c));

    return {
      instanceId,
      tileId: this.activeTile.id,
      position: anchor,
      rotation: { x: this.rotX, y: this.rotY, z: this.rotZ },
    };
  }

  removeByInstanceId(instanceId: string): boolean {
    const entry = this.placedMeshes.get(instanceId);
    if (!entry) return false;

    this.scene.remove(entry.mesh);
    (entry.mesh.material as THREE.Material).dispose();
    this.placedMeshes.delete(instanceId);

    const cells = this.placedCells.get(instanceId) ?? [];
    cells.forEach((c) => this.occupiedCells.delete(c));
    this.placedCells.delete(instanceId);

    return true;
  }

  // Remove a placed tile from the scene and re-activate it as the ghost with its original rotation.
  // Returns the tile's ID so the caller can update React state, or null if not found.
  pickUpTile(instanceId: string): string | null {
    const entry = this.placedMeshes.get(instanceId);
    if (!entry) return null;

    const { mesh, tile, rotation } = entry;
    const geometry = mesh.geometry as THREE.BufferGeometry;

    this.scene.remove(mesh);
    (mesh.material as THREE.Material).dispose();
    this.placedMeshes.delete(instanceId);

    const cells = this.placedCells.get(instanceId) ?? [];
    cells.forEach((c) => this.occupiedCells.delete(c));
    this.placedCells.delete(instanceId);

    this.clearGhost();
    this.activeTile = tile;
    this.activeGeometry = geometry;
    this.rotX = rotation.x;
    this.rotY = rotation.y;
    this.rotZ = rotation.z;
    this.cachedBounds = null;
    this.createGhost();

    return tile.id;
  }

  async restoreFromState(
    placedTiles: PlacedTile[],
    geometryMap: Map<string, THREE.BufferGeometry>,
    tileMap: Map<string, Tile>,
  ): Promise<void> {
    for (const pt of placedTiles) {
      const geo = geometryMap.get(pt.tileId);
      const tile = tileMap.get(pt.tileId);
      if (!geo || !tile) continue;

      const bounds = computeRotatedBounds(geo, pt.rotation.x, pt.rotation.y, pt.rotation.z);
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      // pt.position stores the anchor cell; convert to world center using tile dimensions.
      const worldPos = this.gridManager.anchorCellToWorld(pt.position.x, pt.position.z, bounds.widthCells, bounds.depthCells);
      mesh.position.set(worldPos.x, bounds.yOffset, worldPos.z);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(pt.rotation.x),
        THREE.MathUtils.degToRad(pt.rotation.y),
        THREE.MathUtils.degToRad(pt.rotation.z),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.instanceId = pt.instanceId;
      this.scene.add(mesh);

      const aligned = isAxisAligned(pt.rotation);
      const cells = aligned ? getOccupiedCells(pt.position.x, pt.position.z, bounds.widthCells, bounds.depthCells) : [];
      this.placedMeshes.set(pt.instanceId, { mesh, tile, rotation: pt.rotation });
      this.placedCells.set(pt.instanceId, cells);
      cells.forEach((c) => this.occupiedCells.add(c));
    }
  }

  clearAll(): void {
    for (const { mesh } of this.placedMeshes.values()) {
      this.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.placedMeshes.clear();
    this.placedCells.clear();
    this.occupiedCells.clear();
  }

  getPlacedMeshes(): THREE.Mesh[] {
    return Array.from(this.placedMeshes.values()).map(e => e.mesh);
  }

  isActive(): boolean {
    return this.activeTile !== null;
  }
}
