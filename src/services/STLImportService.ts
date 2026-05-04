import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Tile } from '../models/Tile';

export const GRID_SIZE = 25;

/**
 * Rotate geometry in-place so Y is always "up" (Three.js convention).
 *
 * Many STL exporters (Blender, FreeCAD, many slicers) use Z-up, meaning the
 * ground plane is XY and height goes along Z. Others use X as the thin axis.
 * We detect which axis is the slab's thickness (smallest bounding-box dimension)
 * and rotate so that axis aligns with Y before any footprint math is done.
 *
 * After this call the geometry is permanently transformed — it is stored in
 * IndexedDB already oriented correctly, so re-loads are also correct.
 */
function autoOrientToYUp(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox!.getSize(size);

  if (size.z < size.x && size.z < size.y) {
    // Z-up (Blender default, most CAD tools): ground plane = XY, height = Z.
    // Rotate -90° around X  →  old Z becomes new Y, old Y becomes new -Z.
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  } else if (size.x < size.y && size.x < size.z) {
    // X is the thin axis: rotate +90° around Z  →  old X becomes new Y.
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  }
  // If Y is already the smallest (or equal), the file is already Y-up — no change.
}

export async function importSTL(file: File): Promise<{ tile: Tile; geometry: THREE.BufferGeometry }> {
  const buffer = await file.arrayBuffer();
  const loader = new STLLoader();
  const geometry = loader.parse(buffer);

  // 1. Auto-orient: rotate geometry so Y is "up" before any other calculations.
  autoOrientToYUp(geometry);

  // 2. Center the geometry at the origin.
  geometry.computeBoundingBox();
  const center = new THREE.Vector3();
  geometry.boundingBox!.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  // 3. Compute grid footprint from X (width) and Z (depth) — always correct now.
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox!.getSize(size);

  const widthUnits = Math.max(1, Math.round(size.x / GRID_SIZE));
  const depthUnits = Math.max(1, Math.round(size.z / GRID_SIZE));

  // 4. Normalize scale so the tile fits its grid footprint exactly.
  const scaleX = (widthUnits * GRID_SIZE) / (size.x || 1);
  const scaleZ = (depthUnits * GRID_SIZE) / (size.z || 1);
  const scale = Math.min(scaleX, scaleZ);
  geometry.scale(scale, scale, scale);

  // 5. Recompute after scaling — uniform scale may reduce actual cell count
  //    (e.g. a 75mm × 36mm tile at scale 0.69 becomes ~52mm × 25mm → 2×1 not 3×1).
  geometry.computeBoundingBox();
  const scaledSize = new THREE.Vector3();
  geometry.boundingBox!.getSize(scaledSize);
  const finalWidth = Math.max(1, Math.round(scaledSize.x / GRID_SIZE));
  const finalDepth = Math.max(1, Math.round(scaledSize.z / GRID_SIZE));

  // 6. Ensure normals exist (some binary STLs omit them).
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }

  const tile: Tile = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.stl$/i, ''),
    dimensions: { width: finalWidth, depth: finalDepth, height: scaledSize.y },
    defaultRotation: 0,
    createdAt: Date.now(),
    folderId: null,
  };

  return { tile, geometry };
}
