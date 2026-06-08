import React from 'react';
import WaferMap from './components/WaferMap';
import Toolbar from './components/Toolbar';
import DefectTooltip from './components/DefectTooltip';
import { useKlarfData } from './hooks/useKlarfData';
import './App.css';

const App: React.FC = () => {
  const {
    defectData,
    dieData,
    waferInfo,
    hoveredDefect,
    loading,
    progress,
    error,
    loadKlarfFile,
    setHoveredDefect,
  } = useKlarfData();

  return (
    <div className="app">
      <Toolbar onLoadFile={loadKlarfFile} loading={loading} progress={progress} />
      <div className="main-content">
        <WaferMap
          defectData={defectData}
          dieData={dieData}
          waferInfo={waferInfo}
          onDefectHover={setHoveredDefect}
        />
        {hoveredDefect && (
          <DefectTooltip defect={hoveredDefect} />
        )}
        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
};

export default App;
