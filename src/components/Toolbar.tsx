import React, { useRef } from 'react';
import './Toolbar.css';

interface ToolbarProps {
  onLoadFile: (filePath: string) => void;
  loading: boolean;
  progress: number;
  onRunClustering?: () => void;
  clustering?: boolean;
  showClusters?: boolean;
  onToggleClusters?: (show: boolean) => void;
  scratchCount?: number;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onLoadFile,
  loading,
  progress,
  onRunClustering,
  clustering,
  showClusters,
  onToggleClusters,
  scratchCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const buffer = ev.target?.result;
        if (buffer instanceof ArrayBuffer) {
          onLoadFile('');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">WaferMap Defect Review</span>
      </div>
      <div className="toolbar-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".klar,.klarf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="toolbar-btn"
          onClick={handleOpenFile}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Open KLARF'}
        </button>
        {loading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {onRunClustering && (
          <button
            className="toolbar-btn"
            onClick={onRunClustering}
            disabled={clustering || loading}
            style={{ marginLeft: 8 }}
          >
            {clustering ? 'Scanning...' : 'Spatial Scan'}
          </button>
        )}
        {showClusters !== undefined && onToggleClusters && (
          <label className="toolbar-toggle" style={{ marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => onToggleClusters(e.target.checked)}
            />
            <span>Clusters</span>
            {scratchCount !== undefined && scratchCount > 0 && (
              <span className="scratch-badge">{scratchCount} ⚠ Scratch</span>
            )}
          </label>
        )}
      </div>
      <div className="toolbar-right">
        <span className="toolbar-hint">Scroll: Zoom | Drag: Pan | DblClick: Fit</span>
      </div>
    </div>
  );
};

export default Toolbar;
