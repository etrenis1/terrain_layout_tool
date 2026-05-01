import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonContent,
  IonSplitPane,
  IonMenu,
  IonContent as IonMenuContent,
  useIonToast,
} from '@ionic/react';
import ThreeCanvas from '../components/ThreeCanvas';
import TileLibraryPanel from '../components/TileLibraryPanel';
import Toolbar from '../components/Toolbar';
import LayoutsModal from '../components/LayoutsModal';
import { useSceneManager } from '../hooks/useSceneManager';
import { Tile } from '../models/Tile';
import { Folder } from '../models/Folder';
import { Layout } from '../models/Layout';
import { importSTL } from '../services/STLImportService';
import {
  saveTile,
  loadTileMetadata,
  deleteTile,
  saveAllTileMetadata,
  loadFolders,
  saveFolders,
} from '../services/TileLibraryService';
import { saveLayout } from '../services/LayoutLibraryService';
import { exportTileListPDF } from '../services/PDFExportService';

const TerrainEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [present] = useIonToast();

  const { activeTileId, placedTiles, selectTile, clearScene, serializeScene, loadScene } =
    useSceneManager(canvasRef);

  useEffect(() => {
    setTiles(loadTileMetadata());
    setFolders(loadFolders());
  }, []);

  const handleImport = useCallback(
    async (file: File, folderId: string | null) => {
      try {
        const { tile: baseTile, geometry } = await importSTL(file);
        const tile: Tile = { ...baseTile, folderId };
        await saveTile(tile, geometry);
        setTiles((prev) => [...prev, tile]);
        present({ message: `"${tile.name}" imported successfully`, duration: 2000, color: 'success' });
      } catch (err) {
        console.error('STL import failed:', err);
        present({ message: 'Failed to import STL file', duration: 3000, color: 'danger' });
      }
    },
    [present],
  );

  const handleDelete = useCallback(async (tileId: string) => {
    await deleteTile(tileId);
    setTiles((prev) => prev.filter((t) => t.id !== tileId));
  }, []);

  const handleCreateFolder = useCallback((name: string, parentId: string | null): string => {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      createdAt: Date.now(),
    };
    setFolders((prev) => {
      const next = [...prev, folder];
      saveFolders(next);
      return next;
    });
    return folder.id;
  }, []);

  const handleRenameFolder = useCallback((folderId: string, name: string) => {
    setFolders((prev) => {
      const next = prev.map((f) => (f.id === folderId ? { ...f, name } : f));
      saveFolders(next);
      return next;
    });
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setFolders((prevFolders) => {
      const target = prevFolders.find((f) => f.id === folderId);
      const parentId = target?.parentId ?? null;

      const nextFolders = prevFolders
        .map((f) => (f.parentId === folderId ? { ...f, parentId } : f))
        .filter((f) => f.id !== folderId);
      saveFolders(nextFolders);

      setTiles((prevTiles) => {
        const nextTiles = prevTiles.map((t) =>
          t.folderId === folderId ? { ...t, folderId: parentId } : t,
        );
        saveAllTileMetadata(nextTiles);
        return nextTiles;
      });

      return nextFolders;
    });
  }, []);

  const handleMoveTile = useCallback((tileId: string, targetFolderId: string | null) => {
    setTiles((prev) => {
      const next = prev.map((t) => (t.id === tileId ? { ...t, folderId: targetFolderId } : t));
      saveAllTileMetadata(next);
      return next;
    });
  }, []);

  const handleMoveFolder = useCallback((folderId: string, targetParentId: string | null) => {
    setFolders((prev) => {
      const next = prev.map((f) => (f.id === folderId ? { ...f, parentId: targetParentId } : f));
      saveFolders(next);
      return next;
    });
  }, []);

  const handleSaveLayout = useCallback(
    (name: string): Layout => {
      const layout = saveLayout(name, placedTiles);
      present({ message: `Layout "${name}" saved`, duration: 2000, color: 'success' });
      return layout;
    },
    [placedTiles, present],
  );

  const handleOpenLayout = useCallback(
    async (layout: Layout) => {
      await loadScene(layout, tiles);
      present({ message: `Layout "${layout.name}" loaded`, duration: 2000, color: 'success' });
    },
    [loadScene, tiles, present],
  );

  const handleExportJSON = useCallback(() => {
    const json = serializeScene();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    present({ message: 'Scene exported as JSON', duration: 2000, color: 'success' });
  }, [serializeScene, present]);

  const handleExportPDF = useCallback(() => {
    if (placedTiles.length === 0) {
      present({ message: 'No tiles placed — nothing to export', duration: 2000, color: 'warning' });
      return;
    }
    exportTileListPDF(placedTiles, tiles);
  }, [placedTiles, tiles, present]);

  const handleClear = useCallback(() => {
    clearScene();
    present({ message: 'Scene cleared', duration: 1500 });
  }, [clearScene, present]);

  return (
    <IonPage>
      <IonHeader>
        <Toolbar
          onClear={handleClear}
          onSave={handleExportJSON}
          onExportPDF={handleExportPDF}
          onLayouts={() => setLayoutsOpen(true)}
        />
      </IonHeader>
      <IonContent
        scrollY={false}
        style={{ '--padding-start': '0', '--padding-end': '0', '--padding-top': '0', '--padding-bottom': '0' }}
      >
        <IonSplitPane contentId="main-content" when="xs" style={{ height: '100%' }}>
          <IonMenu contentId="main-content" style={{ '--side-width': '280px', '--side-max-width': '280px' }}>
            <IonMenuContent>
              <TileLibraryPanel
                tiles={tiles}
                folders={folders}
                activeTileId={activeTileId}
                onSelect={selectTile}
                onImport={handleImport}
                onDelete={handleDelete}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onMoveTile={handleMoveTile}
                onMoveFolder={handleMoveFolder}
              />
            </IonMenuContent>
          </IonMenu>
          <div id="main-content" style={{ height: '100%', position: 'relative', flex: 1 }}>
            <ThreeCanvas canvasRef={canvasRef} />
          </div>
        </IonSplitPane>
      </IonContent>

      <LayoutsModal
        isOpen={layoutsOpen}
        onClose={() => setLayoutsOpen(false)}
        placedTileCount={placedTiles.length}
        onSave={handleSaveLayout}
        onOpen={handleOpenLayout}
      />
    </IonPage>
  );
};

export default TerrainEditor;
