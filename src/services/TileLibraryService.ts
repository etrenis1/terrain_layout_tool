import * as THREE from 'three';
import { Tile } from '../models/Tile';
import { Folder } from '../models/Folder';

const DB_NAME = 'terrain-tool';
const DB_VERSION = 1;
const STORE_NAME = 'geometries';
const METADATA_KEY = 'tile-library-metadata';
const FOLDERS_KEY = 'tile-library-folders';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ─── Tile operations ────────────────────────────────────────────────────────

export async function saveTile(tile: Tile, geometry: THREE.BufferGeometry): Promise<void> {
  const existing = loadTileMetadata();
  localStorage.setItem(METADATA_KEY, JSON.stringify([...existing, tile]));

  const db = await getDB();
  const positions = Array.from(geometry.attributes.position.array as Float32Array);
  const normals = geometry.attributes.normal
    ? Array.from(geometry.attributes.normal.array as Float32Array)
    : null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ positions, normals }, tile.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function loadTileMetadata(): Tile[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = JSON.parse(localStorage.getItem(METADATA_KEY) ?? '[]');
    // Backfill folderId for tiles saved before folder support was added.
    return raw.map((t) => ({ folderId: null, ...t }));
  } catch {
    return [];
  }
}

// Persist the full tile list in one call (used for moves and bulk updates).
export function saveAllTileMetadata(tiles: Tile[]): void {
  localStorage.setItem(METADATA_KEY, JSON.stringify(tiles));
}

export async function loadGeometry(tileId: string): Promise<THREE.BufferGeometry | null> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(tileId);
    req.onsuccess = () => {
      const data = req.result as { positions: number[]; normals: number[] | null } | undefined;
      if (!data) return resolve(null);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
      if (data.normals) {
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
      } else {
        geo.computeVertexNormals();
      }
      resolve(geo);
    };
    req.onerror = () => resolve(null);
  });
}

export async function deleteTile(tileId: string): Promise<void> {
  const existing = loadTileMetadata().filter((t) => t.id !== tileId);
  localStorage.setItem(METADATA_KEY, JSON.stringify(existing));
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(tileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Folder operations ───────────────────────────────────────────────────────

export function loadFolders(): Folder[] {
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveFolders(folders: Folder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}
