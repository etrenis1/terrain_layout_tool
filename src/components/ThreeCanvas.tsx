import React from 'react';

interface ThreeCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ canvasRef }) => {
  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        outline: 'none',
        cursor: 'crosshair',
      }}
      tabIndex={0}
    />
  );
};

export default ThreeCanvas;
