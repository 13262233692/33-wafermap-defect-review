import React from 'react';
import type { DefectHoverInfo } from '../types';
import './DefectTooltip.css';

interface DefectTooltipProps {
  defect: DefectHoverInfo;
}

const DefectTooltip: React.FC<DefectTooltipProps> = ({ defect }) => {
  return (
    <div className="defect-tooltip">
      <div className="tooltip-header">
        Defect #{defect.defectId}
      </div>
      <div className="tooltip-body">
        <div className="tooltip-row">
          <span className="tooltip-label">Position:</span>
          <span className="tooltip-value">
            ({defect.xRel.toFixed(3)}, {defect.yRel.toFixed(3)})
          </span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Die:</span>
          <span className="tooltip-value">
            ({defect.dieX}, {defect.dieY})
          </span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Class:</span>
          <span className="tooltip-value">{defect.defectClass}</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Bin:</span>
          <span className="tooltip-value">{defect.bin}</span>
        </div>
        <div className="tooltip-row">
          <span className="tooltip-label">Area:</span>
          <span className="tooltip-value">{defect.area.toFixed(2)} µm²</span>
        </div>
      </div>
    </div>
  );
};

export default DefectTooltip;
