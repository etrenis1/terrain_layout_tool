import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { Tile } from '../models/Tile';
import { PlacedTile } from '../models/PlacedTile';

export function exportTileListPDF(placedTiles: PlacedTile[], tiles: Tile[]): void {
  // Count how many times each tile type appears
  const counts = new Map<string, number>();
  for (const pt of placedTiles) {
    counts.set(pt.tileId, (counts.get(pt.tileId) ?? 0) + 1);
  }

  // Build rows, sorted alphabetically by tile name
  const tileMap = new Map(tiles.map((t) => [t.id, t]));
  const rows = [...counts.entries()]
    .map(([tileId, count]) => {
      const tile = tileMap.get(tileId);
      return tile ? { tile, count } : null;
    })
    .filter((r): r is { tile: Tile; count: number } => r !== null)
    .sort((a, b) => a.tile.name.localeCompare(b.tile.name));

  const totalPlaced = placedTiles.length;
  const uniqueTypes = rows.length;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header bar
  doc.setFillColor(40, 40, 40);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Terrain Layout — Tile Report', margin, 14);

  // Date (right-aligned in header)
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, pageW - margin - dateW, 14);

  // Summary line
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text(
    `${uniqueTypes} unique tile type${uniqueTypes !== 1 ? 's' : ''} · ${totalPlaced} tile${totalPlaced !== 1 ? 's' : ''} placed in total`,
    margin,
    32,
  );

  // Table
  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Tile Name', 'Grid Size', 'Qty']],
    body: rows.map((r) => [
      r.tile.name,
      `${r.tile.dimensions.width} × ${r.tile.dimensions.depth}`,
      String(r.count),
    ]),
    foot: [['', 'Total placed', String(totalPlaced)]],
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [40, 40, 40],
    },
    footStyles: {
      fillColor: [230, 230, 230],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
    },
    showFoot: 'lastPage',
  });

  const filename = `terrain-tiles-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
