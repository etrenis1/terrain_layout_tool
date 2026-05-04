import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SceneManager } from '../three/SceneManager';
import { GridManager } from '../three/GridManager';
import { PlacementManager } from '../three/PlacementManager';
import { RaycastManager } from '../three/RaycastManager';
import { Tile } from '../models/Tile';
import { PlacedTile } from '../models/PlacedTile';
import { SceneState } from '../models/SceneState';
import { Layout } from '../models/Layout';
import { loadGeometry } from '../services/TileLibraryService';

export function useSceneManager(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const sceneRef = useRef<SceneManager | null>(null);
  const placementRef = useRef<PlacementManager | null>(null);
  const raycastRef = useRef<RaycastManager | null>(null);
  const geometryCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());

  const [placedTiles, setPlacedTiles] = useState<PlacedTile[]>([]);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sm = new SceneManager(canvas);
    const gm = new GridManager(sm.scene);
    const pm = new PlacementManager(sm.scene, gm);
    const rm = new RaycastManager(sm.camera, canvas);

    sceneRef.current = sm;
    placementRef.current = pm;
    raycastRef.current = rm;

    sm.startLoop();

    return () => {
      pm.deactivate();
      pm.clearAll();
      sm.stopLoop();
    };
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;

    const handlePointerDown = (e: PointerEvent) => {
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isDragging = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rm = raycastRef.current;
      const pm = placementRef.current;
      if (!rm || !pm) return;

      if (pm.isActive()) {
        const hit = rm.getGroundIntersection(e);
        if (hit) {
          pm.updateGhostPosition(hit.x, hit.z);
        } else {
          pm.hideGhost();
        }
        canvas.style.cursor = '';
      } else {
        const hits = rm.getSceneIntersections(e, pm.getPlacedMeshes());
        canvas.style.cursor = hits.length > 0 ? 'pointer' : '';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (isDragging) return;
      const rm = raycastRef.current;
      const pm = placementRef.current;
      if (!rm || !pm) return;

      if (pm.isActive()) {
        const hit = rm.getGroundIntersection(e);
        if (!hit) return;
        const placed = pm.place(hit.x, hit.z);
        if (placed) {
          setPlacedTiles((prev) => [...prev, placed]);
        }
      } else {
        // Click on a placed tile to pick it up
        const hits = rm.getSceneIntersections(e, pm.getPlacedMeshes());
        if (hits.length === 0) return;
        const instanceId = hits[0].object.userData.instanceId as string;
        if (!instanceId) return;
        const tileId = pm.pickUpTile(instanceId);
        if (tileId) {
          setPlacedTiles((prev) => prev.filter((pt) => pt.instanceId !== instanceId));
          setActiveTileId(tileId);
        }
      }
    };

    const handleMouseLeave = () => {
      placementRef.current?.hideGhost();
      canvas.style.cursor = '';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const pm = placementRef.current;
      if (!pm?.isActive()) {
        if (e.key === 'Escape') {
          pm?.deactivate();
          setActiveTileId(null);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          pm.rotateAxis(e.shiftKey ? 'z' : 'y', -1, 90);
          break;
        case 'ArrowRight':
          e.preventDefault();
          pm.rotateAxis(e.shiftKey ? 'z' : 'y', 1, 90);
          break;
        case 'ArrowUp':
          e.preventDefault();
          pm.rotateAxis('x', -1, 90);
          break;
        case 'ArrowDown':
          e.preventDefault();
          pm.rotateAxis('x', 1, 90);
          break;
        case 'q':
        case 'Q':
          e.preventDefault();
          pm.rotateAxis('y', -1, 45);
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          pm.rotateAxis('y', 1, 45);
          break;
        case 'Escape':
          pm.deactivate();
          setActiveTileId(null);
          break;
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvasRef]);

  const selectTile = useCallback(async (tile: Tile) => {
    let geo = geometryCache.current.get(tile.id);
    if (!geo) {
      geo = (await loadGeometry(tile.id)) ?? undefined;
      if (!geo) return;
      geometryCache.current.set(tile.id, geo);
    }
    placementRef.current?.activateTile(tile, geo);
    setActiveTileId(tile.id);
  }, []);

  const clearScene = useCallback(() => {
    placementRef.current?.clearAll();
    setPlacedTiles([]);
  }, []);

  const removePlacedTile = useCallback((instanceId: string) => {
    const removed = placementRef.current?.removeByInstanceId(instanceId);
    if (removed) {
      setPlacedTiles((prev) => prev.filter((pt) => pt.instanceId !== instanceId));
    }
  }, []);

  const serializeScene = useCallback((): string => {
    const state: SceneState = {
      version: 1,
      placedTiles,
      savedAt: Date.now(),
    };
    return JSON.stringify(state, null, 2);
  }, [placedTiles]);

  const loadScene = useCallback(async (layout: Layout, tiles: Tile[]) => {
    const pm = placementRef.current;
    if (!pm) return;

    pm.deactivate();
    pm.clearAll();
    setActiveTileId(null);

    const tileMap = new Map(tiles.map((t) => [t.id, t]));
    const uniqueTileIds = [...new Set(layout.placedTiles.map((pt) => pt.tileId))];

    for (const tileId of uniqueTileIds) {
      if (!geometryCache.current.has(tileId)) {
        const geo = await loadGeometry(tileId);
        if (geo) geometryCache.current.set(tileId, geo);
      }
    }

    await pm.restoreFromState(layout.placedTiles, geometryCache.current, tileMap);
    setPlacedTiles(layout.placedTiles);
  }, []);

  return {
    placedTiles,
    activeTileId,
    selectTile,
    clearScene,
    removePlacedTile,
    serializeScene,
    loadScene,
  };
}
