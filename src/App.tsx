import React, { useState } from 'react';
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
    clusterResult,
    clustering,
    loadKlarfFile,
    setHoveredDefect,
    runClustering,
  } = useKlarfData();

  const [showClusters, setShowClusters] = useState(false);

  const handleRunClustering = () => {
    runClustering();
    setShowClusters(true);
  };

  return (
    <div className="app">
      <Toolbar
        onLoadFile={loadKlarfFile}
        loading={loading}
        progress={progress}
        onRunClustering={handleRunClustering}
        clustering={clustering}
        showClusters={showClusters}
        onToggleClusters={setShowClusters}
        scratchCount={clusterResult?.scratchCount}
      />
      <div className="main-content">
        <WaferMap
          defectData={defectData}
          dieData={dieData}
          waferInfo={waferInfo}
          onDefectHover={setHoveredDefect}
          clusters={clusterResult?.clusters}
          showClusters={showClusters}
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
