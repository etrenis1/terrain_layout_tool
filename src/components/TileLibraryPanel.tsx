import React, { useRef, useState, useCallback } from 'react';
import { IonButton, IonIcon, IonBadge, IonNote, IonItemDivider, IonLabel } from '@ionic/react';
import {
  addOutline,
  trashOutline,
  folderOutline,
  folderOpenOutline,
  addCircleOutline,
  chevronForwardOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import { Tile } from '../models/Tile';
import { Folder } from '../models/Folder';

interface Props {
  tiles: Tile[];
  folders: Folder[];
  activeTileId: string | null;
  onSelect: (tile: Tile) => void;
  onImport: (file: File, folderId: string | null) => void;
  onDelete: (tileId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => string;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveTile: (tileId: string, targetFolderId: string | null) => void;
  onMoveFolder: (folderId: string, targetParentId: string | null) => void;
}

const TileLibraryPanel: React.FC<Props> = ({
  tiles, folders, activeTileId,
  onSelect, onImport, onDelete,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  onMoveTile, onMoveFolder,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFolderId, setImportFolderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverId, setDragOverId] = useState<string | 'root' | null>(null);
  const draggingRef = useRef<{ type: 'tile' | 'folder'; id: string } | null>(null);

  const toggleExpand = (folderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  const startRename = (folder: Folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameFolder(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const isDescendant = useCallback((folderId: string, candidateId: string): boolean => {
    let cur: Folder | undefined = folders.find(f => f.id === candidateId);
    while (cur) {
      if (cur.id === folderId) return true;
      cur = cur.parentId ? folders.find(f => f.id === cur!.parentId) : undefined;
    }
    return false;
  }, [folders]);

  const handleDrop = (targetFolderId: string | null) => {
    const drag = draggingRef.current;
    if (!drag) return;
    if (drag.type === 'tile') {
      onMoveTile(drag.id, targetFolderId);
    } else {
      if (drag.id === targetFolderId) return;
      if (targetFolderId && isDescendant(drag.id, targetFolderId)) return;
      onMoveFolder(drag.id, targetFolderId);
    }
    draggingRef.current = null;
    setDragOverId(null);
  };

  const triggerImport = (folderId: string | null) => {
    setImportFolderId(folderId);
    fileInputRef.current?.click();
  };

  const createFolder = (parentId: string | null) => {
    const id = onCreateFolder('New Folder', parentId);
    if (parentId) setExpanded(prev => new Set([...prev, parentId]));
    setRenamingId(id);
    setRenameValue('New Folder');
  };

  const importFolderName = importFolderId
    ? (folders.find(f => f.id === importFolderId)?.name ?? null)
    : null;

  const renderFolder = (folder: Folder, depth: number): React.ReactNode => {
    const isOpen = expanded.has(folder.id);
    const isDragOver = dragOverId === folder.id;
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const childTiles = tiles.filter(t => t.folderId === folder.id);

    return (
      <div key={folder.id}>
        <div
          draggable
          onDragStart={(e) => {
            draggingRef.current = { type: 'folder', id: folder.id };
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setDragOverId(folder.id);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOverId(null);
            }
          }}
          onDrop={(e) => { e.stopPropagation(); handleDrop(folder.id); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: `5px 8px 5px ${8 + depth * 16}px`,
            cursor: 'pointer',
            backgroundColor: isDragOver
              ? 'rgba(var(--ion-color-primary-rgb), 0.15)'
              : 'transparent',
            borderBottom: '1px solid var(--ion-color-light)',
            gap: '4px',
            userSelect: 'none',
          }}
        >
          <IonIcon
            icon={isOpen ? chevronDownOutline : chevronForwardOutline}
            style={{ fontSize: '11px', flexShrink: 0, color: 'var(--ion-color-medium)' }}
            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
          />
          <IonIcon
            icon={isOpen ? folderOpenOutline : folderOutline}
            style={{ fontSize: '15px', flexShrink: 0, color: '#f0a020' }}
            onClick={() => toggleExpand(folder.id)}
          />
          {renamingId === folder.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'var(--ion-color-light)',
                border: '1px solid var(--ion-color-primary)',
                borderRadius: '4px',
                padding: '1px 4px',
                fontSize: '0.875rem',
              }}
            />
          ) : (
            <span
              style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(folder); }}
              onClick={() => { toggleExpand(folder.id); setImportFolderId(folder.id); }}
            >
              {folder.name}
            </span>
          )}
          <IonIcon
            icon={addCircleOutline}
            title="Import STL into this folder"
            style={{
              fontSize: '15px',
              flexShrink: 0,
              color: importFolderId === folder.id ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)',
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); triggerImport(folder.id); }}
          />
          <IonIcon
            icon={folderOutline}
            title="New sub-folder"
            style={{ fontSize: '13px', flexShrink: 0, color: 'var(--ion-color-medium)', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); createFolder(folder.id); }}
          />
          <IonIcon
            icon={trashOutline}
            title="Delete folder (moves contents to parent)"
            style={{ fontSize: '13px', flexShrink: 0, color: 'var(--ion-color-danger)', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder.id);
              if (importFolderId === folder.id) setImportFolderId(null);
            }}
          />
        </div>
        {isOpen && (
          <div>
            {childFolders.map(cf => renderFolder(cf, depth + 1))}
            {childTiles.map(t => renderTile(t, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderTile = (tile: Tile, depth: number): React.ReactNode => {
    const isActive = activeTileId === tile.id;
    return (
      <div
        key={tile.id}
        draggable
        onDragStart={(e) => {
          draggingRef.current = { type: 'tile', id: tile.id };
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => onSelect(tile)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `5px 8px 5px ${8 + depth * 16}px`,
          cursor: 'pointer',
          backgroundColor: isActive ? 'var(--ion-color-primary)' : 'transparent',
          color: isActive ? 'var(--ion-color-primary-contrast)' : 'inherit',
          borderBottom: '1px solid var(--ion-color-light)',
          gap: '6px',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tile.name}
          </div>
          <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>
            {tile.dimensions.width}×{tile.dimensions.depth} cells
          </div>
        </div>
        <IonBadge color={isActive ? 'light' : 'medium'} style={{ flexShrink: 0, fontSize: '0.7rem' }}>
          {tile.dimensions.width}×{tile.dimensions.depth}
        </IonBadge>
        <IonIcon
          icon={trashOutline}
          style={{
            fontSize: '15px',
            flexShrink: 0,
            color: isActive ? 'var(--ion-color-primary-contrast)' : 'var(--ion-color-danger)',
            cursor: 'pointer',
          }}
          onClick={(e) => { e.stopPropagation(); onDelete(tile.id); }}
        />
      </div>
    );
  };

  const rootFolders = folders.filter(f => f.parentId === null);
  const rootTiles = tiles.filter(t => t.folderId === null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <IonItemDivider sticky>
        <IonLabel>Tile Library</IonLabel>
      </IonItemDivider>

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <IonButton expand="block" onClick={() => triggerImport(importFolderId)}>
          <IonIcon slot="start" icon={addOutline} />
          {importFolderName ? `Import into "${importFolderName}"` : 'Import STL'}
        </IonButton>
        <IonButton expand="block" fill="outline" size="small" onClick={() => createFolder(null)}>
          <IonIcon slot="start" icon={folderOutline} />
          New Folder
        </IonButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file, importFolderId);
            e.target.value = '';
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: dragOverId === 'root' ? 'rgba(var(--ion-color-primary-rgb), 0.05)' : 'transparent',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOverId('root'); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null);
        }}
        onDrop={(e) => { e.preventDefault(); handleDrop(null); }}
      >
        {tiles.length === 0 && folders.length === 0 && (
          <div style={{ padding: '16px 8px' }}>
            <IonNote style={{ fontSize: '0.85rem' }}>
              No tiles yet. Import an STL file to begin.
            </IonNote>
          </div>
        )}
        {rootFolders.map(f => renderFolder(f, 0))}
        {rootTiles.map(t => renderTile(t, 0))}
      </div>

      <div style={{ padding: '6px 8px', fontSize: '0.72rem', color: 'var(--ion-color-medium)', borderTop: '1px solid var(--ion-color-light)', lineHeight: 1.4 }}>
        <div>WASD pan · scroll zoom · drag orbit</div>
        <div>Select tile · ←→ Y-rot · ↑↓ X-rot · Shift+←→ Z-rot · Esc</div>
        <div>Double-click folder name to rename · Drag to move</div>
      </div>
    </div>
  );
};

export default TileLibraryPanel;
