import { Layout } from '../models/Layout';
import { PlacedTile } from '../models/PlacedTile';

const STORAGE_KEY = 'terrain-layouts';

export function loadLayouts(): Layout[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveLayout(name: string, placedTiles: PlacedTile[]): Layout {
  const layouts = loadLayouts();
  const existing = layouts.find((l) => l.name.toLowerCase() === name.toLowerCase());

  const layout: Layout = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim(),
    savedAt: Date.now(),
    placedTiles,
  };

  const next = existing
    ? layouts.map((l) => (l.id === existing.id ? layout : l))
    : [...layouts, layout];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return layout;
}

export function deleteLayout(id: string): void {
  const next = loadLayouts().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
