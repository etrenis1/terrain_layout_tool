import React, { useState, useEffect } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonInput,
  IonItemDivider,
} from '@ionic/react';
import { closeOutline, folderOpenOutline, trashOutline, saveOutline } from 'ionicons/icons';
import { Layout } from '../models/Layout';
import { loadLayouts, saveLayout, deleteLayout } from '../services/LayoutLibraryService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  placedTileCount: number;
  onSave: (name: string) => Layout;
  onOpen: (layout: Layout) => void;
}

const LayoutsModal: React.FC<Props> = ({ isOpen, onClose, placedTileCount, onSave, onOpen }) => {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLayouts(loadLayouts());
      setSaveName('');
    }
  }, [isOpen]);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    const layout = onSave(name);
    setLayouts(loadLayouts());
    setSaveName('');
    // If overwriting an existing name the list updates in place; otherwise scroll would land at bottom.
    // No extra work needed — loadLayouts() returns the fresh list.
    void layout;
  };

  const handleDelete = (id: string) => {
    deleteLayout(id);
    setLayouts(loadLayouts());
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} style={{ '--max-width': '480px', '--border-radius': '12px' }}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Layouts</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Save section */}
        <IonItemDivider sticky>
          <IonLabel>Save Current Layout</IonLabel>
        </IonItemDivider>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {placedTileCount === 0 ? (
            <IonNote style={{ fontSize: '0.875rem' }}>
              No tiles are placed — place some tiles before saving a layout.
            </IonNote>
          ) : (
            <>
              <IonNote style={{ fontSize: '0.8rem' }}>
                {placedTileCount} tile{placedTileCount !== 1 ? 's' : ''} in the current scene.
                Saving with an existing name will overwrite it.
              </IonNote>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <IonInput
                  value={saveName}
                  onIonInput={(e) => setSaveName(e.detail.value ?? '')}
                  placeholder="Layout name…"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  style={{
                    flex: 1,
                    '--border-radius': '6px',
                    '--background': 'var(--ion-color-light)',
                    '--padding-start': '10px',
                    '--padding-end': '10px',
                    border: '1px solid var(--ion-color-medium)',
                    borderRadius: '6px',
                  }}
                />
                <IonButton onClick={handleSave} disabled={!saveName.trim()}>
                  <IonIcon slot="start" icon={saveOutline} />
                  Save
                </IonButton>
              </div>
            </>
          )}
        </div>

        {/* Saved layouts list */}
        <IonItemDivider sticky>
          <IonLabel>Saved Layouts</IonLabel>
        </IonItemDivider>

        {layouts.length === 0 ? (
          <div style={{ padding: '16px' }}>
            <IonNote style={{ fontSize: '0.875rem' }}>No saved layouts yet.</IonNote>
          </div>
        ) : (
          <IonList>
            {[...layouts].reverse().map((layout) => (
              <IonItem key={layout.id} detail={false}>
                <IonLabel>
                  <h2 style={{ fontWeight: 600 }}>{layout.name}</h2>
                  <p style={{ fontSize: '0.78rem' }}>
                    {layout.placedTiles.length} tile{layout.placedTiles.length !== 1 ? 's' : ''}
                    {' · '}
                    {formatDate(layout.savedAt)}
                  </p>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => { onOpen(layout); onClose(); }}
                  title="Open this layout"
                >
                  <IonIcon icon={folderOpenOutline} />
                </IonButton>
                <IonButton
                  slot="end"
                  fill="clear"
                  color="danger"
                  onClick={() => handleDelete(layout.id)}
                  title="Delete this layout"
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonModal>
  );
};

export default LayoutsModal;
