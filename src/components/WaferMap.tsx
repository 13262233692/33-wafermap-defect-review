import React, { useRef, useEffect, useCallback, useState } from 'react';
import { WaferMapRenderer } from '../renderer/WaferMapRenderer';
import type { WaferInfo, PackedDefectBuffer, DefectHoverInfo, DefectRecord, DieRecord, ClusterInfo } from '../types';
import './WaferMap.css';

interface WaferMapProps {
  defectData: PackedDefectBuffer | null;
  dieData: { positions: Float32Array; defectCounts: Uint32Array; defectStarts: Uint32Array; count: number } | null;
  waferInfo: WaferInfo | null;
  onDefectHover: (defect: DefectHoverInfo | null) => void;
  defects?: DefectRecord[];
  dies?: DieRecord[];
  clusters?: ClusterInfo[];
  showClusters?: boolean;
}

const WaferMap: React.FC<WaferMapProps> = ({
  defectData,
  dieData,
  waferInfo,
  onDefectHover,
  defects,
  dies,
  clusters,
  showClusters,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WaferMapRenderer | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new WaferMapRenderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.startRenderLoop();

    const handleResize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      renderer.resize(width, height);
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !waferInfo) return;
    rendererRef.current.setWaferInfo(waferInfo);
  }, [waferInfo]);

  useEffect(() => {
    if (!rendererRef.current || !defectData) return;
    rendererRef.current.setDefectData(
      defectData.positions,
      defectData.classes,
      defectData.dieIndices,
      defectData.count
    );
  }, [defectData]);

  useEffect(() => {
    if (!rendererRef.current || !clusters) return;
    rendererRef.current.setClusterData(clusters);
  }, [clusters]);

  useEffect(() => {
    if (!rendererRef.current || showClusters === undefined) return;
    rendererRef.current.setShowClusters(showClusters);
  }, [showClusters]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    rendererRef.current.zoomAt(factor, cx, cy);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    if (isPanning) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      rendererRef.current.panBy(dx, dy);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const defectIdx = rendererRef.current.pickDefect(cx, cy);

      if (defectIdx >= 0 && defects && defectIdx < defects.length) {
        const d = defects[defectIdx];
        const die = dies && d.dieIndex < dies.length ? dies[d.dieIndex] : null;
        onDefectHover({
          defectId: d.defectId,
          xRel: d.xRel,
          yRel: d.yRel,
          dieX: die?.dieX ?? 0,
          dieY: die?.dieY ?? 0,
          defectClass: d.defectClass,
          bin: d.bin,
          area: d.area,
        });

        if (dies) {
          rendererRef.current.setHoveredDie(d.dieIndex);
        }
      } else {
        onDefectHover(null);
        rendererRef.current.setHoveredDie(-1);
      }
    }
  }, [isPanning, defects, dies, onDefectHover]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    onDefectHover(null);
    if (rendererRef.current) {
      rendererRef.current.setHoveredDie(-1);
    }
  }, [onDefectHover]);

  const handleDblClick = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.fitToView();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="wafermap-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDblClick}
    >
      <canvas ref={canvasRef} className="wafermap-canvas" />
    </div>
  );
};

export default WaferMap;
