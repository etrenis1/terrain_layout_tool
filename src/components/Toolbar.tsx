import React from 'react';
import { IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonNote } from '@ionic/react';
import { trashBinOutline, saveOutline, documentTextOutline, folderOutline } from 'ionicons/icons';

interface Props {
  onClear: () => void;
  onSave: () => void;
  onExportPDF: () => void;
  onLayouts: () => void;
}

const Toolbar: React.FC<Props> = ({ onClear, onSave, onExportPDF, onLayouts }) => (
  <IonToolbar>
    <IonTitle>Terrain Layout Tool</IonTitle>
    <IonNote slot="end" style={{ fontSize: '0.75rem', marginRight: '8px', opacity: 0.7 }}>
      ←→ Y · ↑↓ X · Shift+←→ Z
    </IonNote>
    <IonButtons slot="end">
      <IonButton onClick={onLayouts} title="Save or open a layout">
        <IonIcon slot="start" icon={folderOutline} />
        Layouts
      </IonButton>
      <IonButton onClick={onExportPDF} title="Export tile list as PDF">
        <IonIcon slot="start" icon={documentTextOutline} />
        Export PDF
      </IonButton>
      <IonButton onClick={onSave} title="Export scene as JSON">
        <IonIcon slot="start" icon={saveOutline} />
        Export JSON
      </IonButton>
      <IonButton color="danger" onClick={onClear} title="Clear all placed tiles">
        <IonIcon slot="start" icon={trashBinOutline} />
        Clear
      </IonButton>
    </IonButtons>
  </IonToolbar>
);

export default Toolbar;
