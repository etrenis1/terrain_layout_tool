/**
 * Generates binary STL test tiles at exact 25 mm grid dimensions.
 *
 * Tiles produced:
 *   2x2_flat.stl   – 50×10×50 mm,  Y-up (correct orientation out of the box)
 *   2x4_flat.stl   – 50×10×100 mm, Y-up
 *   4x4_flat.stl   – 100×10×100 mm, Y-up
 *   2x2_sideways.stl – same 50×50×10 mm box but Z-up (needs X-rotation to fix)
 *   4x4_sideways.stl – same 100×100×10 mm box but Z-up (needs X-rotation to fix)
 *   2x4_rotated.stl  – 100×50×10 mm box, Z-up, X extent is depth (needs Y-rotation after fix)
 *
 * Run: node scripts/generate-test-tiles.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'test-tiles');
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Binary STL writer
// A box is 6 faces × 2 triangles = 12 triangles total.
// Each triangle: normal(3f) + v0(3f) + v1(3f) + v2(3f) + attr(u16) = 50 bytes.
// ---------------------------------------------------------------------------

function vec3(x, y, z) { return [x, y, z]; }

/** Returns 12 triangles (each a [normal, v0, v1, v2] tuple) for an axis-aligned box. */
function boxTriangles(x0, y0, z0, x1, y1, z1) {
  const tris = [];

  const face = (n, a, b, c, d) => {
    // quad split: a-b-c and a-c-d (CCW when viewed from outside)
    tris.push([n, a, b, c]);
    tris.push([n, a, c, d]);
  };

  // +Y top
  face(vec3(0,1,0),  vec3(x0,y1,z0), vec3(x1,y1,z0), vec3(x1,y1,z1), vec3(x0,y1,z1));
  // -Y bottom
  face(vec3(0,-1,0), vec3(x0,y0,z1), vec3(x1,y0,z1), vec3(x1,y0,z0), vec3(x0,y0,z0));
  // +X right
  face(vec3(1,0,0),  vec3(x1,y0,z0), vec3(x1,y0,z1), vec3(x1,y1,z1), vec3(x1,y1,z0));
  // -X left
  face(vec3(-1,0,0), vec3(x0,y0,z1), vec3(x0,y0,z0), vec3(x0,y1,z0), vec3(x0,y1,z1));
  // +Z front
  face(vec3(0,0,1),  vec3(x0,y0,z1), vec3(x1,y0,z1), vec3(x1,y1,z1), vec3(x0,y1,z1));
  // -Z back
  face(vec3(0,0,-1), vec3(x1,y0,z0), vec3(x0,y0,z0), vec3(x0,y1,z0), vec3(x1,y1,z0));

  return tris;
}

function writeBinarySTL(filename, tris) {
  const HEADER = 80;
  const buf = Buffer.alloc(HEADER + 4 + tris.length * 50);
  buf.write(filename.padEnd(HEADER, ' '), 0, HEADER, 'ascii');
  buf.writeUInt32LE(tris.length, HEADER);

  let offset = HEADER + 4;
  for (const [n, v0, v1, v2] of tris) {
    for (const v of [n, v0, v1, v2]) {
      buf.writeFloatLE(v[0], offset);     offset += 4;
      buf.writeFloatLE(v[1], offset);     offset += 4;
      buf.writeFloatLE(v[2], offset);     offset += 4;
    }
    buf.writeUInt16LE(0, offset);         offset += 2;
  }

  const path = join(OUT, filename);
  writeFileSync(path, buf);
  console.log(`  wrote ${path}  (${tris.length} triangles)`);
}

// ---------------------------------------------------------------------------
// Tile definitions
// "flat" = Y-up:  width along X, height along Y (thin slab), depth along Z
// "sideways" = Z-up: width along X, height along Z, depth along Y
//   i.e. the slab is standing on its edge — needs X-axis rotation to lie flat
// ---------------------------------------------------------------------------

const GRID = 25;  // mm per grid cell
const SLAB = 10;  // thickness of the flat slab in mm

const tiles = [
  // Correctly oriented flat tiles (Y is up, slab sits on the ground plane)
  {
    name: '2x2_flat.stl',
    desc: '2×2 cells, correct orientation — should import and place without rotation',
    tris: boxTriangles(
      -1 * GRID, 0,       -1 * GRID,   // min corner (centered at origin)
       1 * GRID, SLAB,     1 * GRID,   // max corner
    ),
  },
  {
    name: '2x4_flat.stl',
    desc: '2×4 cells (50×100 mm footprint), correct orientation',
    tris: boxTriangles(
      -1 * GRID, 0, -2 * GRID,
       1 * GRID, SLAB, 2 * GRID,
    ),
  },
  {
    name: '4x4_flat.stl',
    desc: '4×4 cells (100×100 mm footprint), correct orientation',
    tris: boxTriangles(
      -2 * GRID, 0, -2 * GRID,
       2 * GRID, SLAB, 2 * GRID,
    ),
  },

  // Sideways tiles (Z is up in the STL — the slab is standing on its side)
  // These need ↑ (X-axis rotation, -90°) to lie flat on the grid.
  {
    name: '2x2_sideways.stl',
    desc: '2×2 cells but Z-up — use ↑ key once to rotate X and lay flat',
    tris: boxTriangles(
      -1 * GRID, -1 * GRID, 0,
       1 * GRID,  1 * GRID, SLAB,
    ),
  },
  {
    name: '4x4_sideways.stl',
    desc: '4×4 cells but Z-up — use ↑ key once to rotate X and lay flat',
    tris: boxTriangles(
      -2 * GRID, -2 * GRID, 0,
       2 * GRID,  2 * GRID, SLAB,
    ),
  },

  // A 2×4 tile that's also Z-up AND needs a Y-rotation to orient its long axis
  {
    name: '2x4_sideways_rotated.stl',
    desc: '2×4 cells, Z-up — use ↑ to fix tilt, then ← or → to orient long axis',
    tris: boxTriangles(
      -2 * GRID, -1 * GRID, 0,
       2 * GRID,  1 * GRID, SLAB,
    ),
  },
];

console.log('Generating test tiles...');
for (const tile of tiles) {
  writeBinarySTL(tile.name, tile.tris);
  console.log(`    (${tile.desc})`);
}
console.log('\nDone. Import these from public/test-tiles/ in the app.');
